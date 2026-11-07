import { offsetForWeek, weekKey } from '@/lib/tasks/week';
import { getState } from '@/app/state';

type PickHandler = (week: string) => void;

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

let anchorEl: HTMLElement | null = null;
let onPick: PickHandler | null = null;
let selectedWeek = '';
let viewYear = 0;
let viewMonth = 0;
let mode: 'weeks' | 'months' = 'weeks';
let bound = false;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

function taskCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const task of getState().tasks ?? []) counts.set(task.wk, (counts.get(task.wk) ?? 0) + 1);
  return counts;
}

function ensureRoot(): HTMLElement {
  let root = document.getElementById('weekPicker');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'weekPicker';
  root.className = 'week-picker';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Hafta seç');
  document.body.appendChild(root);

  root.addEventListener('click', (event) => {
    event.stopPropagation();
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-wp]');
    if (!target) return;
    const action = target.dataset.wp;
    const value = target.dataset.value ?? '';

    if (action === 'prev' || action === 'next') {
      const step = action === 'prev' ? -1 : 1;
      if (mode === 'weeks') {
        viewMonth += step;
        if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
        if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
      } else {
        viewYear += step;
      }
      render();
    } else if (action === 'mode') {
      mode = mode === 'weeks' ? 'months' : 'weeks';
      render();
    } else if (action === 'month') {
      viewMonth = Number(value);
      mode = 'weeks';
      render();
    } else if (action === 'week' || action === 'today') {
      pick(action === 'today' ? weekKey(0) : value);
    } else if (action === 'jump') {
      pick(weekKey(Number(value)));
    }
  });

  return root;
}

function pick(week: string): void {
  const handler = onPick;
  closeWeekPicker();
  handler?.(week);
}

function renderWeeks(counts: Map<string, number>): string {
  const current = weekKey(0);
  const first = new Date(viewYear, viewMonth, 1, 12);
  const last = new Date(viewYear, viewMonth + 1, 0, 12);
  let cursor = mondayOf(first);
  const rows: string[] = [];

  while (cursor <= last) {
    const key = toKey(cursor);
    const days: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(cursor);
      day.setDate(cursor.getDate() + i);
      const outside = day.getMonth() !== viewMonth;
      days.push(`<span class="wp-day${outside ? ' out' : ''}">${day.getDate()}</span>`);
    }
    const count = counts.get(key) ?? 0;
    const cls = ['wp-week'];
    if (key === selectedWeek) cls.push('sel');
    if (key === current) cls.push('now');
    rows.push(`
      <button type="button" class="${cls.join(' ')}" data-wp="week" data-value="${key}" aria-label="${key} haftası${count ? `, ${count} görev` : ''}">
        ${days.join('')}
        <span class="wp-count${count ? '' : ' empty'}">${count || ''}</span>
      </button>
    `);
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
  }

  return `
    <div class="wp-days-head">${DAYS.map((day) => `<span>${day}</span>`).join('')}<span class="wp-count-head" title="Görev sayısı">#</span></div>
    <div class="wp-weeks">${rows.join('')}</div>
  `;
}

function renderMonths(counts: Map<string, number>): string {
  const now = new Date();
  const selected = parseKey(selectedWeek);
  const perMonth = new Array(12).fill(0) as number[];
  counts.forEach((count, key) => {
    const date = parseKey(key);
    if (date.getFullYear() === viewYear) perMonth[date.getMonth()] += count;
  });

  return `<div class="wp-months">${MONTHS.map((name, index) => {
    const cls = ['wp-month'];
    if (selected.getFullYear() === viewYear && selected.getMonth() === index) cls.push('sel');
    if (now.getFullYear() === viewYear && now.getMonth() === index) cls.push('now');
    return `<button type="button" class="${cls.join(' ')}" data-wp="month" data-value="${index}">${name.slice(0, 3)}${perMonth[index] ? `<small>${perMonth[index]}</small>` : ''}</button>`;
  }).join('')}</div>`;
}

function render(): void {
  const root = ensureRoot();
  const counts = taskCounts();
  const title = mode === 'weeks' ? `${MONTHS[viewMonth]} ${viewYear}` : String(viewYear);
  const offset = offsetForWeek(selectedWeek);

  root.innerHTML = `
    <div class="wp-head">
      <button type="button" class="wp-nav" data-wp="prev" aria-label="${mode === 'weeks' ? 'Önceki ay' : 'Önceki yıl'}">‹</button>
      <button type="button" class="wp-title" data-wp="mode" aria-label="${mode === 'weeks' ? 'Ay seç' : 'Haftalara dön'}">${title} <span aria-hidden="true">▾</span></button>
      <button type="button" class="wp-nav" data-wp="next" aria-label="${mode === 'weeks' ? 'Sonraki ay' : 'Sonraki yıl'}">›</button>
    </div>
    ${mode === 'weeks' ? renderWeeks(counts) : renderMonths(counts)}
    <div class="wp-quick">
      <button type="button" class="wp-chip${offset === 0 ? ' sel' : ''}" data-wp="today">Bu Hafta</button>
      <button type="button" class="wp-chip${offset === -1 ? ' sel' : ''}" data-wp="jump" data-value="-1">Geçen Hafta</button>
      <button type="button" class="wp-chip${offset === -4 ? ' sel' : ''}" data-wp="jump" data-value="-4">1 Ay Önce</button>
      <button type="button" class="wp-chip${offset === -13 ? ' sel' : ''}" data-wp="jump" data-value="-13">3 Ay Önce</button>
    </div>
  `;
  position();
}

function position(): void {
  const root = document.getElementById('weekPicker');
  if (!root || !anchorEl) return;
  const rect = anchorEl.getBoundingClientRect();
  const width = root.offsetWidth;
  const height = root.offsetHeight;
  const gutter = 16;
  let left = rect.left + rect.width / 2 - width / 2;
  left = Math.max(gutter, Math.min(left, window.innerWidth - width - gutter));
  let top = rect.bottom + 10;
  if (top + height > window.innerHeight - gutter && rect.top - height - 10 > gutter) {
    top = rect.top - height - 10;
  }
  root.style.left = `${left}px`;
  root.style.top = `${Math.max(gutter, top)}px`;
}

function bindGlobal(): void {
  if (bound) return;
  bound = true;
  document.addEventListener('click', (event) => {
    const root = document.getElementById('weekPicker');
    if (!root?.classList.contains('open')) return;
    if (anchorEl?.contains(event.target as Node)) return;
    closeWeekPicker();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeWeekPicker();
  });
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
}

export function openWeekPicker(anchor: HTMLElement, currentWeek: string, handler: PickHandler): void {
  const root = ensureRoot();
  if (root.classList.contains('open') && anchorEl === anchor) {
    closeWeekPicker();
    return;
  }
  bindGlobal();
  anchorEl = anchor;
  onPick = handler;
  selectedWeek = currentWeek;
  const date = parseKey(currentWeek);
  // Haftanın Perşembesi hangi aydaysa o ayı göster (ay geçişindeki haftalar için).
  date.setDate(date.getDate() + 3);
  viewYear = date.getFullYear();
  viewMonth = date.getMonth();
  mode = 'weeks';
  root.classList.add('open');
  anchor.setAttribute('aria-expanded', 'true');
  render();
}

export function closeWeekPicker(): void {
  document.getElementById('weekPicker')?.classList.remove('open');
  anchorEl?.setAttribute('aria-expanded', 'false');
  anchorEl = null;
  onPick = null;
}
