import { reportsChanged, tasksChanged } from '@/data/sample-tasks';
import { syncDemoTasksForUser } from '@/lib/tasks/demo-sync';
import { esc } from '@/lib/utils';
import { tasksForWeek, todayIso, weekKey, weekLabel, normalizeWeekOffset } from '@/lib/tasks/week';
import { uid } from '@/lib/utils';
import { getState, patchState } from '@/app/state';
import { toast } from '@/app/toast';
import type { Report, Task, TaskPriority } from '@/types';
import {
  chartLegend,
  donutChart,
  horizontalBars,
  areaTrendChart,
  ringProgress,
  type ChartSegment,
} from '@/lib/charts/svg-charts';

interface LiveStats {
  total: number;
  done: number;
  inprogress: number;
  todo: number;
  overdue: number;
  completion: number;
  high: number;
  medium: number;
  low: number;
}

function countByPriority(tasks: Task[]): Record<TaskPriority, number> {
  return {
    high: tasks.filter((task) => task.prio === 'high').length,
    medium: tasks.filter((task) => task.prio === 'medium').length,
    low: tasks.filter((task) => task.prio === 'low').length,
  };
}

function liveStats(tasks: Task[]): LiveStats {
  const today = todayIso();
  const done = tasks.filter((task) => task.status === 'done').length;
  const inprogress = tasks.filter((task) => task.status === 'inprogress').length;
  const todo = tasks.filter((task) => task.status === 'todo').length;
  const overdue = tasks.filter((task) => task.due && task.due < today && task.status !== 'done').length;
  const prio = countByPriority(tasks);

  return {
    total: tasks.length,
    done,
    inprogress,
    todo,
    overdue,
    completion: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    high: prio.high,
    medium: prio.medium,
    low: prio.low,
  };
}

function statusSegments(stats: Pick<LiveStats, 'done' | 'inprogress' | 'todo'>): ChartSegment[] {
  return [
    { value: stats.done, color: 'var(--green)', label: 'Tamamlandı' },
    { value: stats.inprogress, color: 'var(--orange)', label: 'Devam Ediyor' },
    { value: stats.todo, color: 'var(--teal)', label: 'Bekliyor' },
  ];
}

function countAttrs(value: number, suffix = '', prefix = '', delay = 0): string {
  return ` data-count-to="${value}" data-count-prefix="${prefix}" data-count-suffix="${suffix}" data-count-delay="${delay}"`;
}

function countText(value: number, suffix = '', prefix = ''): string {
  return `${prefix}0${suffix}`;
}

function progressBar(target: number): string {
  return `<div class="dash-progress-fill" data-progress-to="${target}"></div>`;
}

const COUNT_DURATION = 900;
const COUNT_STAGGER = 60;
let weeklyTrendChartBound = false;

function selectWeeklyTrendPoint(wrap: HTMLElement, index: number): void {
  wrap.querySelectorAll('.area-chart-point').forEach((element, pointIndex) => {
    const active = pointIndex === index;
    element.classList.toggle('is-active', active);
    element.setAttribute('aria-pressed', String(active));
    const dot = element.querySelector('.area-chart-dot');
    dot?.setAttribute('r', active ? '5.5' : '3.5');
    dot?.classList.toggle('area-chart-dot--active', active);
  });

  wrap.querySelectorAll('.area-chart-highlight').forEach((element, pointIndex) => {
    element.classList.toggle('is-active', pointIndex === index);
  });

  wrap.querySelectorAll('.area-chart-label').forEach((element, pointIndex) => {
    element.classList.toggle('is-active', pointIndex === index);
  });

  const point = wrap.querySelector(`.area-chart-point[data-index="${index}"]`);
  if (!point) return;

  const value = point.getAttribute('data-value') ?? '0';
  const label = point.getAttribute('data-label') ?? '';

  const footValue = wrap.querySelector('.area-chart-foot-value');
  const footWeek = wrap.querySelector('.area-chart-foot-week');
  if (footValue) footValue.textContent = value;
  if (footWeek) footWeek.textContent = label;
}

function bindWeeklyTrendChart(): void {
  const list = document.getElementById('rptList');
  if (!list || weeklyTrendChartBound) return;
  weeklyTrendChartBound = true;

  list.addEventListener('click', (event) => {
    const point = (event.target as Element).closest('.area-chart-point');
    if (!point) return;
    const wrap = point.closest('.area-chart-wrap');
    if (!wrap) return;
    const index = Number(point.getAttribute('data-index'));
    if (!Number.isFinite(index)) return;
    selectWeeklyTrendPoint(wrap as HTMLElement, index);
  });

  list.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const point = (event.target as Element).closest('.area-chart-point');
    if (!point) return;
    event.preventDefault();
    const wrap = point.closest('.area-chart-wrap');
    if (!wrap) return;
    const index = Number(point.getAttribute('data-index'));
    if (!Number.isFinite(index)) return;
    selectWeeklyTrendPoint(wrap as HTMLElement, index);
  });
}

function animateReportNumbers(container: HTMLElement | null): void {
  if (!container) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  container.querySelectorAll<HTMLElement>('[data-count-to]').forEach((element) => {
    const target = Number(element.dataset.countTo);
    if (!Number.isFinite(target)) return;

    const prefix = element.dataset.countPrefix ?? '';
    const suffix = element.dataset.countSuffix ?? '';
    const delay = Number(element.dataset.countDelay ?? 0);

    if (reducedMotion) {
      element.textContent = `${prefix}${target}${suffix}`;
      return;
    }

    element.textContent = countText(0, suffix, prefix);
    const startAt = performance.now() + delay;

    const tick = (now: number) => {
      const progress = Math.min(Math.max((now - startAt) / COUNT_DURATION, 0), 1);
      const eased = 1 - (1 - progress) ** 3;
      element.textContent = `${prefix}${Math.round(target * eased)}${suffix}`;
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });

  container.querySelectorAll<HTMLElement>('[data-progress-to]').forEach((element, index) => {
    const target = Number(element.dataset.progressTo);
    if (!Number.isFinite(target)) return;

    const width = `${Math.max(0, Math.min(100, target))}%`;
    element.style.transition = reducedMotion ? 'none' : 'width 1s ease-in-out';

    if (reducedMotion) {
      element.style.width = width;
      return;
    }

    element.style.width = '0%';
    window.setTimeout(() => {
      element.style.width = width;
    }, 140 + index * 90);
  });
}

function kpiCard(value: number | string, label: string, tone: string, hint?: string, index = 0): string {
  let valueHtml: string;
  if (typeof value === 'number') {
    valueHtml = `<div class="dash-kpi-val"${countAttrs(value, '', '', index * COUNT_STAGGER)}>${countText(value)}</div>`;
  } else if (value.endsWith('%')) {
    const numeric = parseInt(value, 10);
    valueHtml = `<div class="dash-kpi-val"${countAttrs(numeric, '%', '', index * COUNT_STAGGER)}>${countText(numeric, '%')}</div>`;
  } else {
    valueHtml = `<div class="dash-kpi-val">${value}</div>`;
  }

  return `
    <div class="dash-kpi dash-kpi-${tone}">
      ${valueHtml}
      <div class="dash-kpi-lbl">${label}</div>
      ${hint ? `<div class="dash-kpi-hint">${hint}</div>` : ''}
    </div>`;
}

function renderDashboardHeader(stats: LiveStats, week: string, wkOff: number): string {
  return `
    <div class="dash-header">
      <div>
        <div class="dash-eyebrow">${weekLabel(wkOff)} · ${week}</div>
        <div class="dash-title">Performans Özeti</div>
      </div>
      <div class="rpt-download-wrap">
        <button type="button" class="dash-header-badge dash-header-download" onclick="toggleReportDownloadMenu(event)" aria-haspopup="menu" aria-controls="rptDownloadMenu" aria-expanded="false">Rapor İndir</button>
      </div>
    </div>
    <div class="dash-kpi-grid">
      ${kpiCard(stats.total, 'Toplam', 'neutral', undefined, 0)}
      ${kpiCard(stats.done, 'Bitti', 'green', undefined, 1)}
      ${kpiCard(stats.inprogress, 'Devam', 'orange', undefined, 2)}
      ${kpiCard(stats.todo, 'Bekliyor', 'teal', undefined, 3)}
      ${kpiCard(stats.overdue, 'Gecikmiş', 'red', stats.overdue ? 'Aksiyon gerekli' : 'Temiz', 4)}
      ${kpiCard(`${stats.completion}%`, 'Oran', 'accent', undefined, 5)}
    </div>`;
}

function buildTrendItems(tasks: Task[], wkOff: number): { label: string; value: number }[] {
  const items: { label: string; value: number }[] = [];
  for (let index = 0; index < 6; index += 1) {
    const offset = wkOff - (5 - index);
    const week = weekKey(offset);
    const weekTasks = tasksForWeek(tasks, offset);
    items.push({
      label: week.slice(5),
      value: weekTasks.filter((task) => task.status === 'done').length,
    });
  }
  return items;
}

function renderChartsRow(stats: LiveStats, reports: Report[], tasks: Task[], wkOff: number): string {
  const segments = statusSegments(stats);
  const trendItems = buildTrendItems(tasks, wkOff);
  const savedReport = reports.find((report) => report.wk === weekKey(wkOff));

  return `
    <div class="dash-charts-grid">
      <div class="dash-panel">
        <div class="dash-panel-head"><span>Görev Dağılımı</span><span class="dash-panel-tag">Pie</span></div>
        <div class="dash-panel-body dash-panel-split">
          ${donutChart(segments, 132, 20, String(stats.total))}
          ${chartLegend(segments)}
        </div>
      </div>
      <div class="dash-panel">
        <div class="dash-panel-head"><span>Haftalık Trend</span><span class="dash-panel-tag">Area</span></div>
        <div class="dash-panel-body dash-panel-body--trend">
          ${areaTrendChart(trendItems, 320, 168, 'weekly-trend')}
        </div>
      </div>
      <div class="dash-panel">
        <div class="dash-panel-head"><span>Tamamlanma Oranı</span><span class="dash-panel-tag">Ring</span></div>
        <div class="dash-panel-body dash-panel-center">
          ${ringProgress(stats.completion, 120, 11)}
          <div class="dash-ring-meta">
            <span>${stats.done}/${stats.total || 0} görev</span>
            ${stats.overdue ? `<span class="dash-warn">${stats.overdue} gecikmiş</span>` : '<span class="dash-ok">Gecikme yok</span>'}
          </div>
        </div>
      </div>
    </div>
    <div class="dash-charts-grid dash-charts-grid-2">
      <div class="dash-panel">
        <div class="dash-panel-head"><span>Öncelik Dağılımı</span><span class="dash-panel-tag">Stack</span></div>
        <div class="dash-panel-body">
          ${horizontalBars([
            { label: 'Yüksek', value: stats.high, color: 'var(--red)' },
            { label: 'Orta', value: stats.medium, color: 'var(--orange)' },
            { label: 'Düşük', value: stats.low, color: 'var(--teal)' },
          ], stats.total || 1)}
        </div>
      </div>
      <div class="dash-panel">
        <div class="dash-panel-head"><span>Hızlı Özet</span><span class="dash-panel-tag">Live</span></div>
        <div class="dash-panel-body dash-summary-list">
          <div class="dash-summary-row"><span>Aktif görevler</span><strong${countAttrs(stats.inprogress + stats.todo, '', '', 320)}>${countText(stats.inprogress + stats.todo)}</strong></div>
          <div class="dash-summary-row"><span>Tamamlanan oran</span><strong${countAttrs(stats.completion, '%', '', 380)}>${countText(stats.completion, '%')}</strong></div>
          <div class="dash-summary-row"><span>Yüksek öncelik</span><strong${countAttrs(stats.high, '', '', 440)}>${countText(stats.high)}</strong></div>
          <div class="dash-summary-row"><span>Kayıtlı rapor</span><strong${countAttrs(reports.length, '', '', 500)}>${countText(reports.length)}</strong></div>
          ${savedReport ? `<div class="dash-summary-row dash-summary-note"><span>Kayıtlı özet</span><span class="dash-summary-saved">✓ ${savedReport.wk.slice(5)}</span></div>` : ''}
        </div>
      </div>
    </div>`;
}

function renderHistoryDetail(report: Report): string {
  const completion = report.total ? Math.round((report.done / report.total) * 100) : 0;
  const segments = statusSegments(report);

  return `
    <div class="dash-history-viewer-head">
      <div>
        <div class="dash-history-viewer-title">Hafta ${report.wk}</div>
        <div class="dash-history-viewer-date">${new Date(report.created).toLocaleString('tr-TR')}</div>
      </div>
      <div class="dash-history-viewer-pct"><span${countAttrs(completion, '%', '', 80)}>${countText(completion, '%')}</span><span>tamamlanma</span></div>
    </div>
    <div class="dash-history-viewer-body">
      <div class="dash-history-viewer-chart">
        ${donutChart(segments, 88, 14, String(report.total))}
        ${chartLegend(segments)}
      </div>
      <div class="dash-history-viewer-meta">
        <div class="dash-history-kpis">
          <div><strong${countAttrs(report.total, '', '', 120)}>${countText(report.total)}</strong><span>Toplam</span></div>
          <div><strong${countAttrs(report.done, '', '', 160)}>${countText(report.done)}</strong><span>Bitti</span></div>
          <div><strong${countAttrs(report.inprogress, '', '', 200)}>${countText(report.inprogress)}</strong><span>Devam</span></div>
          <div><strong${countAttrs(report.todo, '', '', 240)}>${countText(report.todo)}</strong><span>Bekliyor</span></div>
          <div><strong${countAttrs(report.overdue, '', '', 280)}>${countText(report.overdue)}</strong><span>Gecikmiş</span></div>
        </div>
        <p class="dash-history-summary">${esc(report.summary)}</p>
        <div class="dash-progress-wrap">
          <div class="dash-progress-label"><span>Haftalık ilerleme</span><span${countAttrs(completion, '%', '', 320)}>${countText(completion, '%')}</span></div>
          <div class="dash-progress">${progressBar(completion)}</div>
        </div>
      </div>
    </div>`;
}

function renderHistoryRow(report: Report, active: boolean, index = 0): string {
  const completion = report.total ? Math.round((report.done / report.total) * 100) : 0;
  const created = new Date(report.created);

  return `
    <button type="button" class="dash-history-row${active ? ' active' : ''}" id="rpt-row-${report.id}" onclick="viewReport('${report.id}')">
      <span class="dash-history-row-wk">Hafta ${report.wk}</span>
      <span class="dash-history-row-date">
        ${created.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
        <small>${created.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</small>
      </span>
      <span class="dash-history-row-pct"${countAttrs(completion, '%', '', index * 40)}>${countText(completion, '%')}</span>
      <span class="dash-history-row-stat done"${countAttrs(report.done, '', '', index * 40 + 20)}>${countText(report.done)}</span>
      <span class="dash-history-row-stat prog"${countAttrs(report.inprogress, '', '', index * 40 + 30)}>${countText(report.inprogress)}</span>
      <span class="dash-history-row-stat wait"${countAttrs(report.todo, '', '', index * 40 + 40)}>${countText(report.todo)}</span>
      <span class="dash-history-row-arrow" aria-hidden="true">›</span>
    </button>`;
}

function renderHistorySection(reports: Report[]): string {
  return `
    <div class="dash-history-panel">
      <div class="dash-history-panel-head">
        <div>
          <div class="dash-history-panel-title">Kayıtlı Haftalık Raporlar</div>
          <div class="dash-history-panel-sub">Satıra tıklayarak rapor detayını görüntüle</div>
        </div>
        <span class="dash-history-badge"${countAttrs(reports.length, ' kayıt', '', 20)}>${countText(reports.length, ' kayıt')}</span>
      </div>
      ${reports.length ? `
        <div class="dash-history-list">
          <div class="dash-history-list-head" aria-hidden="true">
            <span>Hafta</span>
            <span>Oluşturulma</span>
            <span>Oran</span>
            <span>Bitti</span>
            <span>Devam</span>
            <span>Bekliyor</span>
            <span></span>
          </div>
          ${reports.map((report, index) => renderHistoryRow(report, index === 0)).join('')}
        </div>
        <div class="dash-history-viewer" id="rptViewer">
          ${renderHistoryDetail(reports[0])}
        </div>
      ` : `
        <div class="dash-empty-history">
          <div class="dash-empty-icon">📋</div>
          <div>Henüz kayıtlı rapor yok</div>
          <div class="dash-empty-sub"><strong>Rapor Oluştur</strong> butonuyla bu haftanın özetini kaydedebilirsin · AI Group Head Cuma 16:30'da otomatik rapor oluşturur</div>
        </div>
      `}
    </div>`;
}

function renderReportTabs(activeTab: 'current' | 'history', reportCount: number, wkOff: number): string {
  return `
    <div class="board-ctrl rpt-tabs" role="tablist" aria-label="Rapor görünümü">
      <button type="button" class="fpill${activeTab === 'current' ? ' active' : ''}" role="tab" data-tab="current" aria-selected="${activeTab === 'current'}" onclick="switchReportTab('current')">Güncel Rapor</button>
      <button type="button" class="fpill${activeTab === 'history' ? ' active' : ''}" role="tab" data-tab="history" aria-selected="${activeTab === 'history'}" onclick="switchReportTab('history')">Tüm Raporlar${reportCount ? `<span class="rpt-tab-count">${reportCount}</span>` : ''}</button>
      <div class="week-nav">
        <button class="warr" type="button" onclick="chReportWeek(-1)" aria-label="Önceki hafta">‹</button>
        <span class="week-lbl" id="rptWeekLbl">${weekLabel(wkOff)}</span>
        <button class="warr" type="button" onclick="chReportWeek(1)" aria-label="Sonraki hafta">›</button>
      </div>
    </div>`;
}

let activeReportTab: 'current' | 'history' = 'current';
let reportDownloadMenuBound = false;

function bindReportDownloadMenu(): void {
  if (reportDownloadMenuBound) return;
  reportDownloadMenuBound = true;

  document.addEventListener('click', (event) => {
    const menu = document.getElementById('rptDownloadMenu');
    const button = document.querySelector('.dash-header-download');
    if (!menu?.classList.contains('open')) return;

    const target = event.target as Node;
    if (menu.contains(target) || button?.contains(target)) return;
    closeReportDownloadMenu();
  });

  window.addEventListener('resize', () => {
    if (document.getElementById('rptDownloadMenu')?.classList.contains('open')) {
      positionReportDownloadMenu();
    } else {
      closeReportDownloadMenu();
    }
  });

  window.addEventListener('scroll', () => {
    if (document.getElementById('rptDownloadMenu')?.classList.contains('open')) {
      positionReportDownloadMenu();
    }
  }, true);
}

function positionReportDownloadMenu(): void {
  const button = document.querySelector('.dash-header-download');
  const menu = document.getElementById('rptDownloadMenu');
  if (!(button instanceof HTMLElement) || !menu?.classList.contains('open')) return;

  menu.style.display = 'block';
  const rect = button.getBoundingClientRect();
  const menuWidth = menu.offsetWidth || 168;
  const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);

  menu.style.top = `${rect.bottom + 8}px`;
  menu.style.left = `${left}px`;
  menu.style.right = 'auto';
}

export function toggleReportDownloadMenu(event: Event): void {
  event.preventDefault();
  event.stopPropagation();

  const menu = document.getElementById('rptDownloadMenu');
  const button = event.currentTarget as HTMLButtonElement | null;
  if (!menu || !button) return;

  const opening = !menu.classList.contains('open');
  menu.classList.toggle('open', opening);
  button.setAttribute('aria-expanded', String(opening));

  if (opening) {
    positionReportDownloadMenu();
  } else {
    menu.style.display = '';
    menu.style.top = '';
    menu.style.left = '';
  }
}

export function closeReportDownloadMenu(): void {
  const menu = document.getElementById('rptDownloadMenu');
  menu?.classList.remove('open');
  menu?.style.removeProperty('display');
  menu?.style.removeProperty('top');
  menu?.style.removeProperty('left');
  document.querySelector('.dash-header-download')?.setAttribute('aria-expanded', 'false');
}

function buildReportExportPayload(wkOff: number): {
  userName: string;
  weekLabel: string;
  weekKey: string;
  generatedAt: string;
  stats: LiveStats;
  summary?: string;
  tasks: Task[];
} {
  const state = getState();
  const week = weekKey(wkOff);
  const weekTasks = tasksForWeek(state.tasks, wkOff);
  const stats = liveStats(weekTasks);
  const savedReport = state.reports.find((report) => report.wk === week);

  return {
    userName: `${state.profile.name} ${state.profile.surname}`.trim(),
    weekLabel: weekLabel(wkOff),
    weekKey: week,
    generatedAt: new Date().toLocaleString('tr-TR'),
    stats,
    summary: savedReport?.summary,
    tasks: weekTasks,
  };
}

export async function downloadReport(format: 'excel' | 'pdf'): Promise<void> {
  closeReportDownloadMenu();
  const wkOff = normalizeWeekOffset(getState().wkOff);
  const payload = buildReportExportPayload(wkOff);

  try {
    const { exportReportExcel, exportReportPdf } = await import('@/lib/reports/export');
    if (format === 'excel') exportReportExcel(payload);
    else exportReportPdf(payload);
    toast('Rapor indirildi ✓', 'ok');
  } catch {
    toast('Rapor indirilemedi', 'err');
  }
}

export function chReportWeek(delta: number): void {
  patchState((state) => ({ ...state, wkOff: normalizeWeekOffset(state.wkOff + delta) }));
  syncWeekLabels();
  renderReports();
}

function syncWeekLabels(): void {
  const wkOff = normalizeWeekOffset(getState().wkOff);
  const week = weekKey(wkOff);
  const label = weekLabel(wkOff);

  const tasksWeekLbl = document.getElementById('weekLbl');
  if (tasksWeekLbl) tasksWeekLbl.textContent = label;

  const boardSub = document.getElementById('boardSub');
  if (boardSub) boardSub.textContent = `Hafta: ${week}`;
}

export function switchReportTab(tab: 'current' | 'history'): void {
  activeReportTab = tab;
  document.querySelectorAll('.rpt-tabs .fpill').forEach((el) => {
    const isActive = el.getAttribute('data-tab') === tab;
    el.classList.toggle('active', isActive);
    el.setAttribute('aria-selected', String(isActive));
  });
  document.getElementById('rpt-panel-current')?.classList.toggle('active', tab === 'current');
  document.getElementById('rpt-panel-history')?.classList.toggle('active', tab === 'history');
}

export function viewReport(id: string): void {
  const report = getState().reports.find((item) => item.id === id);
  if (!report) return;

  document.querySelectorAll('.dash-history-row').forEach((row) => row.classList.remove('active'));
  document.getElementById(`rpt-row-${id}`)?.classList.add('active');

  const viewer = document.getElementById('rptViewer');
  if (viewer) {
    viewer.innerHTML = renderHistoryDetail(report);
    requestAnimationFrame(() => animateReportNumbers(viewer));
  }
}

export function buildReport(): void {
  const state = getState();
  const wkOff = normalizeWeekOffset(state.wkOff);
  const week = weekKey(wkOff);
  const tasks = tasksForWeek(state.tasks, wkOff);
  const stats = liveStats(tasks);

  patchState((state) => ({
    ...state,
    reports: [{
      id: uid('r'),
      wk: week,
      created: new Date().toISOString(),
      total: stats.total,
      done: stats.done,
      inprogress: stats.inprogress,
      todo: stats.todo,
      overdue: stats.overdue,
      summary: `Toplam ${stats.total} görev · ${stats.done} tamamlandı · ${stats.inprogress} devam · ${stats.todo} bekliyor · ${stats.overdue} gecikmiş`,
    }, ...state.reports.filter((report) => report.wk !== week)],
  }));

  renderReports();
  const latest = getState().reports[0];
  if (latest) {
    switchReportTab('history');
    viewReport(latest.id);
  }
  toast('Rapor oluşturuldu ✓', 'ok');
}

function refreshReportsState(): void {
  const current = getState();
  const synced = syncDemoTasksForUser(current);
  if (
    reportsChanged(current.reports, synced.reports)
    || tasksChanged(current.tasks, synced.tasks)
    || current.wkOff !== synced.wkOff
  ) {
    patchState(() => synced);
  }
}

export function renderReports(): void {
  refreshReportsState();

  const list = document.getElementById('rptList');
  if (!list) return;

  closeReportDownloadMenu();

  const state = getState();
  const wkOff = normalizeWeekOffset(state.wkOff);
  const week = weekKey(wkOff);
  const { reports, tasks } = state;
  const weekTasks = tasksForWeek(tasks, wkOff);
  const stats = liveStats(weekTasks);

  list.innerHTML = `
    <div class="rpt-dashboard">
      ${renderReportTabs(activeReportTab, reports.length, wkOff)}
      <div class="rpt-tab-panel${activeReportTab === 'current' ? ' active' : ''}" id="rpt-panel-current" role="tabpanel">
        ${renderDashboardHeader(stats, week, wkOff)}
        ${renderChartsRow(stats, reports, tasks, wkOff)}
      </div>
      <div class="rpt-tab-panel${activeReportTab === 'history' ? ' active' : ''}" id="rpt-panel-history" role="tabpanel">
        ${renderHistorySection(reports)}
      </div>
    </div>`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => animateReportNumbers(list));
  });
  bindWeeklyTrendChart();
  bindReportDownloadMenu();
}
