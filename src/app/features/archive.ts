import type { Task, TaskStatus } from '@/types';
import { esc } from '@/lib/utils';
import { offsetForWeek, weekKey, weekLabel, weekRangeLabel } from '@/lib/tasks/week';
import { getState, patchState } from '@/app/state';
import { toast } from '@/app/toast';

const selected = new Set<string>();

const STATUS_META: Record<TaskStatus, { label: string; cls: string }> = {
  todo: { label: 'Yapılacak', cls: 'st-todo' },
  inprogress: { label: 'Devam Ediyor', cls: 'st-inp' },
  done: { label: 'Tamamlandı', cls: 'st-done' },
};

const PRIORITY_META = {
  high: { cls: 'p-high', label: 'Yüksek' },
  medium: { cls: 'p-medium', label: 'Orta' },
  low: { cls: 'p-low', label: 'Düşük' },
} as const;

function inputValue(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value ?? '';
}

function weekOptionLabel(key: string): string {
  const offset = offsetForWeek(key);
  const rel = offset >= -1 && offset <= 1 ? ` · ${weekLabel(offset)}` : '';
  return `${weekRangeLabel(key)}${rel}`;
}

/** Geçmiş haftalara ait görevler (bu haftadan önceki tüm haftalar). */
function pastTasks(): Task[] {
  const current = weekKey(0);
  return (getState().tasks ?? []).filter((task) => task.wk < current);
}

function fillWeekFilter(tasks: Task[]): void {
  const select = document.getElementById('archWeek') as HTMLSelectElement | null;
  if (!select) return;
  const previous = select.value;
  const weeks = [...new Set(tasks.map((task) => task.wk))].sort().reverse();
  select.innerHTML = `<option value="all">Tüm geçmiş haftalar</option>${weeks
    .map((wk) => `<option value="${wk}">${esc(weekOptionLabel(wk))}</option>`)
    .join('')}`;
  select.value = weeks.includes(previous) ? previous : 'all';
}

function fillTargetWeek(tasks: Task[]): void {
  const select = document.getElementById('archTargetWeek') as HTMLSelectElement | null;
  if (!select) return;
  const previous = select.value || weekKey(0);

  const earliest = tasks.reduce((min, task) => (task.wk < min ? task.wk : min), weekKey(-8));
  const from = Math.min(offsetForWeek(earliest), -8);
  const options: string[] = [];
  for (let offset = 8; offset >= from; offset -= 1) {
    const key = weekKey(offset);
    options.push(`<option value="${key}">${esc(weekOptionLabel(key))}</option>`);
  }
  select.innerHTML = options.join('');
  select.value = previous;
  if (!select.value) select.value = weekKey(0);
}

export function renderArchive(): void {
  const root = document.getElementById('archBody');
  if (!root) return;

  const all = pastTasks();
  fillWeekFilter(all);
  fillTargetWeek(all);

  const week = inputValue('archWeek') || 'all';
  const status = inputValue('archStatus') || 'all';
  const query = inputValue('archSearch').trim().toLocaleLowerCase('tr-TR');

  const tasks = all
    .filter((task) => week === 'all' || task.wk === week)
    .filter((task) => status === 'all' || task.status === status)
    .filter((task) => !query
      || task.title.toLocaleLowerCase('tr-TR').includes(query)
      || (task.tag ?? '').toLocaleLowerCase('tr-TR').includes(query))
    .sort((a, b) => (a.wk === b.wk ? a.title.localeCompare(b.title, 'tr') : b.wk.localeCompare(a.wk)));

  // Görünmeyen ya da artık geçmişte olmayan seçimleri bırak.
  const visibleIds = new Set(tasks.map((task) => task.id));
  [...selected].forEach((id) => {
    if (!visibleIds.has(id)) selected.delete(id);
  });

  const sub = document.getElementById('archSub');
  if (sub) {
    const weekCount = new Set(all.map((task) => task.wk)).size;
    sub.textContent = all.length
      ? `${weekCount} geçmiş haftada ${all.length} görev · seçtiğin görevleri istediğin haftaya ata`
      : 'Geçmiş haftalara ait görev yok';
  }

  if (!tasks.length) {
    root.innerHTML = `<tr><td colspan="7"><div class="empty-col"><div class="ec-icon">🗂</div><div class="ec-txt">${all.length ? 'Filtreye uyan görev yok' : 'Geçmiş haftalara ait görev yok'}</div></div></td></tr>`;
  } else {
    root.innerHTML = tasks.map(buildRow).join('');
  }

  const allBox = document.getElementById('archAll') as HTMLInputElement | null;
  if (allBox) {
    allBox.checked = tasks.length > 0 && tasks.every((task) => selected.has(task.id));
    allBox.indeterminate = !allBox.checked && tasks.some((task) => selected.has(task.id));
  }
  updateAssignBar();
}

function buildRow(task: Task): string {
  const priority = PRIORITY_META[task.prio] ?? PRIORITY_META.medium;
  const status = STATUS_META[task.status] ?? STATUS_META.todo;
  const checked = selected.has(task.id);
  return `
    <tr class="${checked ? 'sel' : ''}" data-id="${task.id}" onclick="archToggle('${task.id}')">
      <td class="arch-chk"><input type="checkbox" ${checked ? 'checked' : ''} aria-label="Seç" onclick="event.stopPropagation();archToggle('${task.id}')"></td>
      <td class="arch-title">
        <button type="button" class="arch-link" onclick="event.stopPropagation();openDetail('${task.id}')">${esc(task.title)}</button>
        ${task.carriedFrom ? `<div class="arch-note">↪ ${esc(weekRangeLabel(task.carriedFrom))} haftasından devredildi</div>` : ''}
      </td>
      <td class="arch-nowrap">${esc(weekRangeLabel(task.wk))}</td>
      <td><span class="ptag ${priority.cls}">${priority.label}</span></td>
      <td><span class="arch-status ${status.cls}">${status.label}</span></td>
      <td class="arch-hide-sm">${task.tag ? esc(task.tag) : '—'}</td>
      <td class="arch-nowrap arch-hide-sm">${task.due || '—'}</td>
    </tr>
  `;
}

function updateAssignBar(): void {
  const count = document.getElementById('archSelCount');
  const button = document.getElementById('archAssignBtn') as HTMLButtonElement | null;
  if (count) count.textContent = selected.size ? `${selected.size} görev seçildi` : 'Görev seçilmedi';
  if (button) button.disabled = selected.size === 0;
}

export function archToggle(id: string): void {
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  renderArchive();
}

export function archToggleAll(checked: boolean): void {
  document.querySelectorAll<HTMLTableRowElement>('#archBody tr[data-id]').forEach((row) => {
    const id = row.dataset.id;
    if (!id) return;
    if (checked) selected.add(id);
    else selected.delete(id);
  });
  renderArchive();
}

export function archAssign(): void {
  if (!selected.size) {
    toast('Önce görev seç', 'err');
    return;
  }

  const targetWeek = inputValue('archTargetWeek') || weekKey(0);
  const targetStatus = (inputValue('archTargetStatus') || 'todo') as TaskStatus;
  const ids = new Set(selected);

  patchState((state) => ({
    ...state,
    tasks: state.tasks.map((task) => (ids.has(task.id)
      ? { ...task, wk: targetWeek, status: targetStatus }
      : task)),
  }));

  selected.clear();
  renderArchive();
  void import('@/app/features/tasks').then(({ renderTasks }) => renderTasks());

  const offset = offsetForWeek(targetWeek);
  const weekText = offset >= -1 && offset <= 1 ? weekLabel(offset) : weekRangeLabel(targetWeek);
  toast(`${ids.size} görev → ${weekText} · ${STATUS_META[targetStatus].label} ✓`, 'ok');
}
