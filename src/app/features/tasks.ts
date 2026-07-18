import type { Task, TaskPriority, TaskStatus } from '@/types';
import { esc } from '@/lib/utils';
import { ensureSampleTasks, tasksChanged } from '@/data/sample-tasks';
import { weekKey, weekLabel, todayIso, normalizeWeekOffset } from '@/lib/tasks/week';
import { getState, patchState } from '@/app/state';
import { toast } from '@/app/toast';

let editId: string | null = null;
let dragId: string | null = null;
let dragSource: TaskStatus | null = null;

const PRIORITY_META = {
  high: { cls: 'p-high', label: 'Yüksek' },
  medium: { cls: 'p-medium', label: 'Orta' },
  low: { cls: 'p-low', label: 'Düşük' },
} as const;

export function renderTasks(): void {
  const state = getState();
  const wkOff = normalizeWeekOffset(state.wkOff);
  const week = weekKey(wkOff);
  const syncedTasks = ensureSampleTasks(state.tasks, week);

  if (tasksChanged(state.tasks, syncedTasks) || state.wkOff !== wkOff) {
    patchState((current) => ({ ...current, tasks: syncedTasks, wkOff }));
  }

  (document.getElementById('weekLbl') as HTMLElement).textContent = weekLabel(wkOff);
  (document.getElementById('boardSub') as HTMLElement).textContent = `Hafta: ${week}`;

  let tasks = syncedTasks.filter((task) => task.wk === week);
  if (state.filter !== 'all') tasks = tasks.filter((task) => task.prio === state.filter);

  (['todo', 'inprogress', 'done'] as const).forEach((status) => {
    const column = document.getElementById(`col-${status}`);
    const items = tasks.filter((task) => task.status === status);
    (document.getElementById(`cnt-${status}`) as HTMLElement).textContent = String(items.length);

    if (!column) return;
    if (!items.length) {
      const icons = { todo: '📭', inprogress: '⏳', done: '✅' };
      const labels = { todo: 'Yapılacak yok', inprogress: 'Devam eden yok', done: 'Tamamlanan yok' };
      column.innerHTML = `<div class="empty-col"><div class="ec-icon">${icons[status]}</div><div class="ec-txt">${labels[status]}</div></div>`;
    } else {
      column.innerHTML = items.map(buildCard).join('');
    }
  });

  bindDrag();
}

function buildCard(task: Task): string {
  const priority = PRIORITY_META[task.prio] ?? PRIORITY_META.medium;
  const today = todayIso();
  const overdue = task.due && task.due < today && task.status !== 'done';

  return `
    <div class="task-card" draggable="true" data-id="${task.id}" onclick="openDetail('${task.id}')">
      <div class="tc-title">${esc(task.title)}</div>
      <div class="tc-meta">
        <span class="ptag ${priority.cls}">${priority.label}</span>
        ${task.due ? `<span class="dtag${overdue ? ' ov' : ''}">📅 ${task.due}</span>` : ''}
        ${task.tag ? `<span class="dtag">🏷 ${esc(task.tag)}</span>` : ''}
      </div>
    </div>
  `;
}

function bindDrag(): void {
  document.querySelectorAll('.task-card[draggable]').forEach((element) => {
    const card = element as HTMLElement;
    card.ondragstart = (event) => {
      const id = card.dataset.id ?? '';
      dragId = id || null;
      dragSource = card.closest('.k-col')?.getAttribute('data-col') as TaskStatus | null;
      setTimeout(() => card.classList.add('dragging'), 0);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
      }
    };
    card.ondragend = () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.k-col').forEach((column) => column.classList.remove('drag-over'));
      dragId = null;
      dragSource = null;
    };
  });
}

export function onDragOver(event: DragEvent, column: HTMLElement): void {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.k-col').forEach((item) => item.classList.remove('drag-over'));
  column.classList.add('drag-over');
}

export function onDragLeave(column: HTMLElement): void {
  column.classList.remove('drag-over');
}

export function onDrop(event: DragEvent, column: HTMLElement): void {
  event.preventDefault();
  column.classList.remove('drag-over');

  const id = event.dataTransfer?.getData('text/plain') || dragId;
  if (!id) return;

  const target = column.dataset.col as TaskStatus | undefined;
  if (!target) return;

  patchState((state) => {
    const index = state.tasks.findIndex((item) => item.id === id);
    if (index < 0) return state;
    if (state.tasks[index].status === target) return state;
    const tasks = [...state.tasks];
    tasks[index] = { ...tasks[index], status: target };
    return { ...state, tasks };
  });

  renderTasks();
  const task = getState().tasks.find((item) => item.id === id);
  if (task) {
    const labels = { todo: 'Yapılacak', inprogress: 'Devam Ediyor', done: 'Tamamlandı' };
    toast(`"${task.title}" → ${labels[target]}`, 'ok');
  }
}

export function chWeek(delta: number): void {
  patchState((state) => ({ ...state, wkOff: normalizeWeekOffset(state.wkOff + delta) }));
  renderTasks();
  const wkOff = normalizeWeekOffset(getState().wkOff);
  const rptWeekLbl = document.getElementById('rptWeekLbl');
  if (rptWeekLbl) rptWeekLbl.textContent = weekLabel(wkOff);
}

export function setF(filter: 'all' | TaskPriority, element: HTMLElement): void {
  patchState((state) => ({ ...state, filter }));
  document.querySelectorAll('.fpill').forEach((pill) => pill.classList.remove('active'));
  element.classList.add('active');
  renderTasks();
}

export function openNewTask(status: TaskStatus = 'todo'): void {
  editId = null;
  (document.getElementById('tModalTitle') as HTMLElement).textContent = 'Yeni Görev';
  ['fTitle', 'fDesc', 'fDue', 'fTag'].forEach((id) => {
    (document.getElementById(id) as HTMLInputElement).value = '';
  });
  (document.getElementById('fPrio') as HTMLSelectElement).value = 'medium';
  (document.getElementById('fStatus') as HTMLSelectElement).value = status;
  openModal('taskModal');
}

export function saveTask(): void {
  const title = (document.getElementById('fTitle') as HTMLInputElement).value.trim();
  if (!title) {
    toast('Başlık gerekli', 'err');
    return;
  }

  const state = getState();
  const existing = editId ? state.tasks.find((task) => task.id === editId) : undefined;
  const task: Task = {
    id: editId ?? `t${Date.now()}`,
    title,
    desc: (document.getElementById('fDesc') as HTMLTextAreaElement).value.trim(),
    prio: (document.getElementById('fPrio') as HTMLSelectElement).value as TaskPriority,
    status: (document.getElementById('fStatus') as HTMLSelectElement).value as TaskStatus,
    due: (document.getElementById('fDue') as HTMLInputElement).value,
    tag: (document.getElementById('fTag') as HTMLInputElement).value.trim(),
    wk: weekKey(state.wkOff),
    created: new Date().toISOString(),
    notes: existing?.notes ?? [],
  };

  patchState((current) => {
    const tasks = [...current.tasks];
    const index = tasks.findIndex((item) => item.id === task.id);
    if (index >= 0) tasks[index] = task;
    else tasks.push(task);
    return { ...current, tasks, filter: 'all' };
  });

  document.querySelectorAll('.fpill').forEach((pill, index) => pill.classList.toggle('active', index === 0));
  closeModal('taskModal');
  renderTasks();
  toast(editId ? 'Güncellendi ✓' : 'Görev eklendi ✓', 'ok');
}

export function openDetail(id: string): void {
  const task = getState().tasks.find((item) => item.id === id);
  if (!task) return;

  const priority = { high: '🔴 Yüksek', medium: '🟡 Orta', low: '🟢 Düşük' }[task.prio] ?? 'Orta';
  const status = { todo: '⬜ Yapılacak', inprogress: '🔄 Devam Ediyor', done: '✅ Tamamlandı' }[task.status] ?? '';

  (document.getElementById('detailBody') as HTMLElement).innerHTML = `
    <h3 style="font-size:16px;margin-bottom:.75rem">${esc(task.title)}</h3>
    ${task.desc ? `<p style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:1rem">${esc(task.desc)}</p>` : ''}
    <div class="two-col" style="margin-bottom:1rem">
      <div style="background:var(--surface2);padding:9px;border-radius:8px;border:1px solid var(--border)"><div style="font-size:10px;color:var(--text3);margin-bottom:3px">DURUM</div><div style="font-size:13px;font-weight:500">${status}</div></div>
      <div style="background:var(--surface2);padding:9px;border-radius:8px;border:1px solid var(--border)"><div style="font-size:10px;color:var(--text3);margin-bottom:3px">ÖNCELİK</div><div style="font-size:13px;font-weight:500">${priority}</div></div>
      ${task.due ? `<div style="background:var(--surface2);padding:9px;border-radius:8px;border:1px solid var(--border)"><div style="font-size:10px;color:var(--text3);margin-bottom:3px">BİTİŞ</div><div style="font-size:13px;font-weight:500">📅 ${task.due}</div></div>` : ''}
      ${task.tag ? `<div style="background:var(--surface2);padding:9px;border-radius:8px;border:1px solid var(--border)"><div style="font-size:10px;color:var(--text3);margin-bottom:3px">ETİKET</div><div style="font-size:13px;font-weight:500">🏷 ${esc(task.tag)}</div></div>` : ''}
    </div>
    ${task.notes?.length ? `<div style="margin-bottom:1rem"><div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:7px">NOTLAR</div>${task.notes.map((note) => `<div style="padding:7px 10px;background:var(--orange-bg);border-left:3px solid var(--orange);border-radius:0 6px 6px 0;margin-bottom:5px;font-size:12px;color:var(--orange-dark)">${esc(note.text)}<span style="font-size:10px;color:var(--text3);margin-left:8px">${note.at}</span></div>`).join('')}</div>` : ''}
    <div><div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">NOT EKLE</div><textarea class="form-input" id="noteInp" placeholder="İlerleme notu..." style="min-height:60px"></textarea></div>
  `;

  (document.getElementById('detailFoot') as HTMLElement).innerHTML = `
    <button class="btn btn-ghost" onclick="closeModal('detailModal')">Kapat</button>
    <button class="btn btn-outline" onclick="addNote('${id}')">Not Ekle</button>
    <button class="btn btn-outline" onclick="editTask('${id}')">Düzenle</button>
    <button class="btn btn-danger btn-sm" onclick="deleteTask('${id}')">Sil</button>
  `;

  openModal('detailModal');
}

export function addNote(id: string): void {
  const text = (document.getElementById('noteInp') as HTMLTextAreaElement).value.trim();
  if (!text) return;

  patchState((state) => {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) return state;
    if (!task.notes) task.notes = [];
    task.notes.push({ text, at: new Date().toLocaleString('tr-TR') });
    return { ...state, tasks: [...state.tasks] };
  });

  closeModal('detailModal');
  toast('Not eklendi ✓');
}

export function editTask(id: string): void {
  const task = getState().tasks.find((item) => item.id === id);
  if (!task) return;

  closeModal('detailModal');
  editId = id;
  (document.getElementById('tModalTitle') as HTMLElement).textContent = 'Görevi Düzenle';
  (document.getElementById('fTitle') as HTMLInputElement).value = task.title;
  (document.getElementById('fDesc') as HTMLTextAreaElement).value = task.desc || '';
  (document.getElementById('fPrio') as HTMLSelectElement).value = task.prio;
  (document.getElementById('fStatus') as HTMLSelectElement).value = task.status;
  (document.getElementById('fDue') as HTMLInputElement).value = task.due || '';
  (document.getElementById('fTag') as HTMLInputElement).value = task.tag || '';
  openModal('taskModal');
}

export function deleteTask(id: string): void {
  if (!confirm('Bu görevi silmek istediğine emin misin?')) return;
  patchState((state) => ({ ...state, tasks: state.tasks.filter((task) => task.id !== id) }));
  closeModal('detailModal');
  renderTasks();
  toast('Görev silindi');
}

function openModal(id: string): void {
  document.getElementById(id)?.classList.add('open');
}

function closeModal(id: string): void {
  document.getElementById(id)?.classList.remove('open');
}

export { openModal, closeModal };
