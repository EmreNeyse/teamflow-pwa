export interface ChartSegment {
  value: number;
  color: string;
  label: string;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  if (end - start >= 359.99) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`;
  }
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}

export function donutChart(segments: ChartSegment[], size = 128, stroke = 18, center?: string): string {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;

  if (!total) {
    return `
      <svg class="chart-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(148,163,184,.25)" stroke-width="${stroke}" />
        ${center ? `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" class="chart-center" data-count-to="${center}">0</text>` : ''}
      </svg>`;
  }

  let angle = 0;
  const paths = segments
    .filter((seg) => seg.value > 0)
    .map((seg) => {
      const sweep = (seg.value / total) * 360;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      return `<path class="chart-arc" pathLength="1" d="${arcPath(cx, cy, r, start, end)}" fill="none" stroke="${seg.color}" stroke-width="${stroke}" stroke-linecap="butt" />`;
    })
    .join('');

  return `
    <svg class="chart-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      ${paths}
      ${center ? `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" class="chart-center" data-count-to="${center}">0</text>` : ''}
    </svg>`;
}

export function ringProgress(percent: number, size = 112, stroke = 10): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;
  const end = (clamped / 100) * 360;

  return `
    <svg class="chart-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(148,163,184,.22)" stroke-width="${stroke}" />
      ${clamped > 0 ? `<path class="chart-arc" pathLength="1" d="${arcPath(cx, cy, r, 0, end)}" fill="none" stroke="var(--orange)" stroke-width="${stroke}" stroke-linecap="round" />` : ''}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" dominant-baseline="central" class="chart-center chart-center-lg" data-count-to="${clamped}" data-count-suffix="%">0%</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="chart-center-sub">Tamamlandı</text>
    </svg>`;
}

export interface BarItem {
  label: string;
  value: number;
  color?: string;
  sub?: string;
}

export function verticalBars(items: BarItem[], maxValue?: number): string {
  const max = maxValue ?? Math.max(1, ...items.map((item) => item.value));
  const bars = items.map((item) => {
    const pct = Math.round((item.value / max) * 100);
    const color = item.color ?? 'var(--orange)';
    return `
      <div class="vbar-col">
        <div class="vbar-track"><div class="vbar-fill" style="height:${pct}%;background:${color}"></div></div>
        <div class="vbar-val">${item.value}</div>
        <div class="vbar-lbl">${item.label}</div>
        ${item.sub ? `<div class="vbar-sub">${item.sub}</div>` : ''}
      </div>`;
  }).join('');

  return `<div class="vbar-chart">${bars}</div>`;
}

export function horizontalBars(items: BarItem[], maxValue?: number): string {
  const max = maxValue ?? Math.max(1, ...items.map((item) => item.value));
  const bars = items.map((item) => {
    const pct = Math.round((item.value / max) * 100);
    const color = item.color ?? 'var(--teal)';
    return `
      <div class="hbar-row">
        <div class="hbar-meta"><span class="hbar-lbl">${item.label}</span><span class="hbar-val">${item.value}</span></div>
        <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>`;
  }).join('');

  return `<div class="hbar-chart">${bars}</div>`;
}

export function chartLegend(segments: ChartSegment[]): string {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0) || 1;
  return `
    <div class="chart-legend">
      ${segments.map((seg) => {
        const pct = Math.round((seg.value / total) * 100);
        return `
          <div class="chart-legend-item">
            <span class="chart-legend-dot" style="background:${seg.color}"></span>
            <span class="chart-legend-lbl">${seg.label}</span>
            <span class="chart-legend-val">${seg.value}</span>
            <span class="chart-legend-pct">${pct}%</span>
          </div>`;
      }).join('')}
    </div>`;
}

export function areaTrendChart(
  items: { label: string; value: number }[],
  width = 320,
  height = 168,
  chartId = 'weekly-trend',
): string {
  if (!items.length) {
    return '<div class="area-chart-empty">Henüz trend verisi yok</div>';
  }

  const pad = { top: 18, right: 14, bottom: 30, left: 14 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...items.map((item) => item.value));
  const baseY = pad.top + chartH;

  const points = items.map((item, index) => {
    const x = pad.left + (items.length > 1 ? (index / (items.length - 1)) * chartW : chartW / 2);
    const y = pad.top + chartH - (item.value / max) * chartH;
    return { x, y, label: item.label, value: item.value };
  });

  const smoothLine = (pts: typeof points): string => {
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const current = pts[i];
      const next = pts[i + 1];
      const midX = (current.x + next.x) / 2;
      path += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
    }
    return path;
  };

  const linePath = smoothLine(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`;
  const last = points[points.length - 1];
  const defaultIndex = points.length - 1;
  const fillId = `${chartId}-fill`;
  const lineId = `${chartId}-line`;

  const gridLines = [0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = pad.top + chartH * (1 - ratio);
    return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" class="area-chart-grid"/>`;
  }).join('');

  const highlights = points.map((point, index) => (
    `<rect x="${point.x - 14}" y="${pad.top}" width="28" height="${chartH}" rx="8" class="area-chart-highlight${index === defaultIndex ? ' is-active' : ''}" data-index="${index}"/>`
  )).join('');

  const labels = points.map((point, index) => (
    `<text x="${point.x}" y="${height - 8}" text-anchor="middle" class="area-chart-label${index === defaultIndex ? ' is-active' : ''}" data-index="${index}">${point.label}</text>`
  )).join('');

  const pointGroups = points.map((point, index) => {
    const isActive = index === defaultIndex;
    return `
      <g
        class="area-chart-point${isActive ? ' is-active' : ''}"
        data-index="${index}"
        data-label="${point.label}"
        data-value="${point.value}"
        role="button"
        tabindex="0"
        aria-pressed="${isActive}"
        aria-label="Hafta ${point.label}, ${point.value} tamamlanan görev"
      >
        <circle cx="${point.x}" cy="${point.y}" r="16" class="area-chart-hit"/>
        <circle cx="${point.x}" cy="${point.y}" r="${isActive ? 5.5 : 3.5}" class="area-chart-dot${isActive ? ' area-chart-dot--active' : ''}"/>
      </g>`;
  }).join('');

  return `
    <div class="area-chart-wrap" id="weeklyTrendChart" role="group" aria-label="Haftalık tamamlanan görev trendi, haftalara tıklayarak seçin">
      <svg class="area-chart" viewBox="0 0 ${width} ${height}" width="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <linearGradient id="${fillId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--orange)" stop-opacity="0.38"/>
            <stop offset="55%" stop-color="var(--orange)" stop-opacity="0.12"/>
            <stop offset="100%" stop-color="var(--teal)" stop-opacity="0.02"/>
          </linearGradient>
          <linearGradient id="${lineId}" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="var(--orange)"/>
            <stop offset="100%" stop-color="var(--teal-light)"/>
          </linearGradient>
        </defs>
        ${gridLines}
        ${highlights}
        <path d="${areaPath}" class="area-chart-area" fill="url(#${fillId})"/>
        <path d="${linePath}" class="area-chart-line" fill="none" stroke="url(#${lineId})" stroke-width="2.75" stroke-linecap="round"/>
        ${pointGroups}
        ${labels}
      </svg>
      <div class="area-chart-foot">
        <span>Tamamlanan görev</span>
        <strong class="area-chart-foot-value">${last.value}</strong>
        <span class="area-chart-foot-week area-chart-foot-sub">${last.label}</span>
      </div>
      <div class="area-chart-hint">Haftaya tıklayarak detayı gör</div>
    </div>`;
}

export function completedTrendChart(items: { label: string; value: number }[]): string {
  if (!items.length) {
    return '<div class="trend-list trend-list--empty">Henüz tamamlanan görev verisi yok</div>';
  }

  const max = Math.max(1, ...items.map((item) => item.value));
  const last = items[items.length - 1]?.value ?? 0;
  const prev = items.length > 1 ? items[items.length - 2]?.value ?? last : last;
  const delta = last - prev;
  const deltaLabel = items.length > 1
    ? (delta > 0 ? `↑ ${delta} artış` : delta < 0 ? `↓ ${Math.abs(delta)} azalış` : '→ sabit')
    : 'Tek hafta';

  const rows = items.map((item) => {
    const pct = Math.round((item.value / max) * 100);
    const width = item.value > 0 ? Math.max(pct, 8) : 0;
    return `
      <div class="trend-row">
        <span class="trend-row-lbl">${item.label}</span>
        <div class="trend-row-track" aria-hidden="true">
          <div class="trend-row-fill" style="width:${width}%"></div>
        </div>
        <span class="trend-row-val">${item.value}</span>
      </div>`;
  }).join('');

  return `
    <div class="trend-list" role="img" aria-label="Haftalık tamamlanan görev trendi">
      <div class="trend-list-meta">
        <span class="trend-list-hint">Her satır o hafta tamamlanan görev sayısı</span>
        <span class="trend-list-delta${delta > 0 ? ' up' : delta < 0 ? ' down' : ''}">${deltaLabel}</span>
      </div>
      ${rows}
    </div>`;
}

export function sparkline(values: number[], width = 120, height = 36): string {
  if (!values.length) return '';
  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values.map((val, i) => {
    const x = i * step;
    const y = height - ((val - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return `
    <svg class="sparkline" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">
      <polyline pathLength="1" points="${points}" fill="none" stroke="var(--orange)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>`;
}
