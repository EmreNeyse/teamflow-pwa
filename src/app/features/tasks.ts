import type { Task, TaskPriority, TaskStatus } from '@/types';
import { esc } from '@/lib/utils';
import { weekKey, weekLabel, weekRangeLabel, todayIso, normalizeWeekOffset, offsetForWeek } from '@/lib/tasks/week';
import { openWeekPicker } from '@/app/features/week-picker';
import { getState, patchState } from '@/app/state';
import { toast, toastAction } from '@/app/toast';
import { renderArchive } from '@/app/features/archive';

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
  const allTasks = state.tasks ?? [];

  if (state.wkOff !== wkOff) {
    patchState((current) => ({ ...current, wkOff }));
  }

  (document.getElementById('weekLbl') as HTMLElement).textContent = Math.abs(wkOff) > 1 ? weekRangeLabel(week) : weekLabel(wkOff);
  (document.getElementById('boardSub') as HTMLElement).textContent = `Hafta: ${weekRangeLabel(week)}${Math.abs(wkOff) > 1 ? ` · ${weekLabel(wkOff)}` : ''}`;

  let tasks = allTasks.filter((task) => task.wk === week);
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
        ${task.carriedFrom ? `<span class="dtag dtag-carry" title="${esc(weekRangeLabel(task.carriedFrom))} haftasından aktarıldı">↩ Önceki haftadan</span>` : ''}
        ${task.carriedTo ? `<span class="dtag dtag-carry" title="${esc(weekRangeLabel(task.carriedTo))} haftasına aktarıldı">➜ ${esc(weekRangeLabel(task.carriedTo))}</span>` : ''}
      </div>
    </div>
  `;
}

function bindDrag(): void {
  document.querySelectorAll('.task-card[draggable]').forEach((element) => {
    const card = element as HTMLElement;
    const column = card.closest('.k-col')?.getAttribute('data-col') as TaskStatus | null;

    card.ondragstart = (event) => {
      const id = card.dataset.id ?? '';
      dragId = id || null;
      dragSource = column;
      setTimeout(() => card.classList.add('dragging'), 0);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
      }
      if (column === 'todo') showTrashZone();
    };
    card.ondragend = () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.k-col').forEach((item) => item.classList.remove('drag-over'));
      hideTrashZone();
      dragId = null;
      dragSource = null;
    };

    if (column === 'todo') bindSwipeToDelete(card);
  });
}

/* ---------- Sola sürükleyerek silme ---------- */

const SWIPE_THRESHOLD = 110;
let suppressClickUntil = 0;

function trashZone(): HTMLElement | null {
  return document.getElementById('trashZone');
}

function showTrashZone(): void {
  const zone = trashZone();
  if (!zone) return;
  zone.classList.remove('armed');
  zone.classList.add('visible');
}

function hideTrashZone(): void {
  trashZone()?.classList.remove('visible', 'armed');
}

export function onTrashDragOver(event: DragEvent): void {
  if (dragSource !== 'todo') return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  trashZone()?.classList.add('armed');
}

export function onTrashDragLeave(): void {
  trashZone()?.classList.remove('armed');
}

export function onTrashDrop(event: DragEvent): void {
  event.preventDefault();
  const id = event.dataTransfer?.getData('text/plain') || dragId;
  const source = dragSource;
  hideTrashZone();
  if (!id || source !== 'todo') return;
  const card = document.querySelector<HTMLElement>(`.task-card[data-id="${CSS.escape(id)}"]`);
  removeWithAnimation(id, card);
}

/** Dokunmatik ekranda bekleyen kartı sola kaydırarak silme. */
function bindSwipeToDelete(card: HTMLElement): void {
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let tracking = false;
  let swiping = false;
  let pointerId = -1;

  const reset = () => {
    tracking = false;
    swiping = false;
    card.classList.remove('swiping');
    card.style.removeProperty('--swipe-x');
    card.style.removeProperty('--swipe-p');
  };

  card.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;
    tracking = true;
    swiping = false;
    startX = event.clientX;
    startY = event.clientY;
    dx = 0;
    pointerId = event.pointerId;
  });

  card.addEventListener('pointermove', (event) => {
    if (!tracking || event.pointerId !== pointerId) return;
    const moveX = event.clientX - startX;
    const moveY = event.clientY - startY;

    if (!swiping) {
      if (Math.abs(moveY) > 10 && Math.abs(moveY) > Math.abs(moveX)) { reset(); return; }
      if (moveX < -10 && Math.abs(moveX) > Math.abs(moveY)) {
        swiping = true;
        try { card.setPointerCapture(pointerId); } catch { /* işaretçi yakalanamazsa da kaydırma çalışır */ }
        card.classList.add('swiping');
        showTrashZone();
      } else {
        return;
      }
    }

    dx = Math.min(0, moveX);
    const progress = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD);
    card.style.setProperty('--swipe-x', `${dx}px`);
    card.style.setProperty('--swipe-p', progress.toFixed(3));
    trashZone()?.classList.toggle('armed', progress >= 1);
  });

  const finish = () => {
    if (!tracking) return;
    const wasSwiping = swiping;
    const commit = wasSwiping && Math.abs(dx) >= SWIPE_THRESHOLD;
    tracking = false;
    hideTrashZone();
    if (!wasSwiping) return;

    suppressClickUntil = Date.now() + 400;
    if (commit) {
      swiping = false;
      removeWithAnimation(card.dataset.id ?? '', card);
      return;
    }
    card.classList.add('swipe-return');
    reset();
    window.setTimeout(() => card.classList.remove('swipe-return'), 260);
  };

  card.addEventListener('pointerup', finish);
  card.addEventListener('pointercancel', finish);
  card.addEventListener('click', (event) => {
    if (Date.now() < suppressClickUntil) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);
}

function removeWithAnimation(id: string, card: HTMLElement | null): void {
  if (!id) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!card || reduce || typeof card.animate !== 'function') {
    deleteTaskWithUndo(id);
    return;
  }

  const height = card.offsetHeight;
  const startX = getComputedStyle(card).getPropertyValue('--swipe-x').trim() || '0px';
  card.classList.add('removing');
  card.style.pointerEvents = 'none';
  const animation = card.animate([
    { transform: `translateX(${startX}) scale(1)`, opacity: 1, height: `${height}px`, marginBottom: '0px' },
    { transform: 'translateX(-120%) rotate(-6deg) scale(.9)', opacity: 0, height: `${height}px`, offset: 0.6 },
    { transform: 'translateX(-120%) rotate(-6deg) scale(.9)', opacity: 0, height: '0px', paddingTop: '0px', paddingBottom: '0px', marginBottom: '-8px', borderWidth: '0px' },
  ], { duration: 420, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
  // Animasyon arka plandaki sekmede ilerlemezse de silme tamamlansın.
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    deleteTaskWithUndo(id);
  };
  animation.onfinish = finish;
  window.setTimeout(finish, 600);
}

function deleteTaskWithUndo(id: string): void {
  let removed: Task | null = null;
  let index = -1;
  patchState((state) => {
    index = state.tasks.findIndex((task) => task.id === id);
    if (index < 0) return state;
    removed = state.tasks[index];
    const tasks = [...state.tasks];
    tasks.splice(index, 1);
    return { ...state, tasks };
  });

  renderTasks();
  renderArchive();
  const task = removed as Task | null;
  if (!task) return;

  toastAction(`"${task.title}" silindi`, 'Geri Al', () => {
    patchState((state) => {
      if (state.tasks.some((item) => item.id === task.id)) return state;
      const tasks = [...state.tasks];
      tasks.splice(Math.min(index, tasks.length), 0, task);
      return { ...state, tasks };
    });
    renderTasks();
    renderArchive();
    toast('Görev geri alındı ✓', 'ok');
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

export function openBoardWeekPicker(anchor: HTMLElement): void {
  openWeekPicker(anchor, weekKey(normalizeWeekOffset(getState().wkOff)), (week) => {
    const delta = offsetForWeek(week) - normalizeWeekOffset(getState().wkOff);
    if (delta) chWeek(delta);
  });
}

export function setF(filter: 'all' | TaskPriority, element: HTMLElement): void {
  patchState((state) => ({ ...state, filter }));
  document.querySelectorAll('.fpill[data-prio]').forEach((pill) => pill.classList.remove('active'));
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
    ...existing,
    id: editId ?? `t${Date.now()}`,
    title,
    desc: (document.getElementById('fDesc') as HTMLTextAreaElement).value.trim(),
    prio: (document.getElementById('fPrio') as HTMLSelectElement).value as TaskPriority,
    status: (document.getElementById('fStatus') as HTMLSelectElement).value as TaskStatus,
    due: (document.getElementById('fDue') as HTMLInputElement).value,
    tag: (document.getElementById('fTag') as HTMLInputElement).value.trim(),
    // Düzenlenen görev kendi haftasında kalır; yeni görev görüntülenen haftaya eklenir.
    wk: existing?.wk ?? weekKey(state.wkOff),
    created: existing?.created ?? new Date().toISOString(),
    notes: existing?.notes ?? [],
  };

  patchState((current) => {
    const tasks = [...current.tasks];
    const index = tasks.findIndex((item) => item.id === task.id);
    if (index >= 0) tasks[index] = task;
    else tasks.push(task);
    return { ...current, tasks, filter: 'all' };
  });

  document.querySelectorAll('.fpill[data-prio]').forEach((pill, index) => pill.classList.toggle('active', index === 0));
  closeModal('taskModal');
  renderTasks();
  renderArchive();
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

  let removed = false;
  patchState((state) => {
    const nextTasks = state.tasks.filter((task) => task.id !== id);
    removed = nextTasks.length < state.tasks.length;
    if (!removed) return state;
    return { ...state, tasks: nextTasks };
  });

  if (!removed) {
    toast('Görev bulunamadı', 'err');
    return;
  }

  closeModal('detailModal');
  renderTasks();
  renderArchive();
  toast('Görev silindi');
}

function openModal(id: string): void {
  document.getElementById(id)?.classList.add('open');
}

function closeModal(id: string): void {
  document.getElementById(id)?.classList.remove('open');
}

export { openModal, closeModal };
