import { AVATARS } from '@/data/constants';
import { ensureSampleTasks } from '@/data/sample-tasks';
import { deleteUser, getRegistry, loadUserData, updateUserProfile } from '@/lib/storage/user-storage';
import { tasksForWeek, todayIso } from '@/lib/tasks/week';
import { esc, showScreen } from '@/lib/utils';
import type { Task, TaskStatus } from '@/types';
import { openUserSession } from '@/app/state';
import { toast } from '@/app/toast';
import { enterApp } from '@/app/features/shell';
import { renderCloudSyncLogin } from '@/app/features/cloud-sync';

const SHOWCASE_PRIORITY = {
  high: { cls: 'p-high', label: 'Yüksek' },
  medium: { cls: 'p-medium', label: 'Orta' },
  low: { cls: 'p-low', label: 'Düşük' },
} as const;

const SHOWCASE_COLUMNS: { status: TaskStatus; dot: string; label: string }[] = [
  { status: 'todo', dot: 'todo', label: 'Yapılacak' },
  { status: 'inprogress', dot: 'inp', label: 'Devam Ediyor' },
  { status: 'done', dot: 'done', label: 'Tamamlandı' },
];

let selectedUserId: string | null = null;
let pinBuffer = '';
let pinKeyboardBound = false;
let resetPinNew = '';
let resetPinConfirm = '';
let resetPinKeyboardBound = false;

export function buildLogin(preferredUserId: string | null = null): void {
  const registry = getRegistry();
  selectedUserId = preferredUserId && registry.users.some((user) => user.id === preferredUserId)
    ? preferredUserId
    : registry.users[0]?.id ?? null;

  renderUserPicker(registry.users);
  renderSelectedUser();
  renderLoginShowcase(selectedUserId);
  renderCloudSyncLogin();
  resetPinInput();
  bindPinKeyboard();
  focusPinInput();
}

function resetPinInput(): void {
  pinBuffer = '';
  syncPinUi();
  const error = document.getElementById('pinErr');
  if (error) error.textContent = '';
}

function syncPinUi(): void {
  const input = document.getElementById('pinInput') as HTMLInputElement | null;
  if (input && input.value !== pinBuffer) input.value = pinBuffer;
  for (let i = 0; i < 4; i += 1) {
    document.getElementById(`pd${i}`)?.classList.toggle('filled', i < pinBuffer.length);
  }
}

function focusPinInput(): void {
  window.setTimeout(() => {
    (document.getElementById('pinInput') as HTMLInputElement | null)?.focus();
  }, 60);
}

function bindPinKeyboard(): void {
  if (pinKeyboardBound) return;
  pinKeyboardBound = true;

  const input = document.getElementById('pinInput') as HTMLInputElement | null;
  if (!input) return;

  input.addEventListener('input', () => {
    pinBuffer = input.value.replace(/\D/g, '').slice(0, 4);
    syncPinUi();
    if (pinBuffer.length === 4) window.setTimeout(checkPin, 80);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && pinBuffer.length === 4) {
      event.preventDefault();
      checkPin();
    }
  });

  document.querySelector('.pin-entry')?.addEventListener('click', focusPinInput);
}

function renderUserPicker(users: ReturnType<typeof getRegistry>['users']): void {
  const picker = document.getElementById('userPicker');
  if (!picker) return;

  if (!users.length) {
    picker.innerHTML = '<div class="user-picker-empty">Henüz hesap yok. Yeni hesap oluştur.</div>';
    return;
  }

  picker.innerHTML = users.map((user) => `
    <button class="user-chip${user.id === selectedUserId ? ' active' : ''}" data-user-id="${user.id}">
      <span class="user-chip-av">${AVATARS[user.avatarIdx] ?? AVATARS[0]}</span>
      <span class="user-chip-name">${esc(user.name)}</span>
      <span class="user-chip-close" data-remove-id="${user.id}" title="Hesabı sil">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>
      </span>
    </button>
  `).join('');

  picker.querySelectorAll('.user-chip-close').forEach((close) => {
    close.addEventListener('click', (event) => {
      event.stopPropagation();
      const userId = (close as HTMLElement).getAttribute('data-remove-id');
      if (userId) removeAccount(userId);
    });
  });

  picker.querySelectorAll('.user-chip').forEach((button) => {
    button.addEventListener('click', () => {
      selectedUserId = button.getAttribute('data-user-id');
      picker.querySelectorAll('.user-chip').forEach((chip) => {
        chip.classList.toggle('active', chip.getAttribute('data-user-id') === selectedUserId);
      });
      renderSelectedUser();
      renderLoginShowcase(selectedUserId);
      resetPinInput();
      focusPinInput();
    });
  });
}

function removeAccount(userId: string): void {
  const registry = getRegistry();
  const user = registry.users.find((item) => item.id === userId);
  if (!user) return;
  if (!confirm(`"${user.name}" hesabını silmek istediğine emin misin?`)) return;

  deleteUser(userId);
  const updated = getRegistry();
  toast('Hesap silindi');

  if (!updated.users.length) {
    void import('@/app/features/setup').then(({ goSetup }) => goSetup());
    return;
  }

  const nextId = selectedUserId === userId ? (updated.lastUserId ?? updated.users[0].id) : selectedUserId;
  buildLogin(nextId);
}

function renderSelectedUser(): void {
  const registry = getRegistry();
  const user = registry.users.find((item) => item.id === selectedUserId);
  const card = document.getElementById('loginCard');
  if (!user || !card) {
    card?.classList.add('hidden');
    return;
  }

  card.classList.remove('hidden');
  (document.getElementById('loginAv') as HTMLElement).textContent = AVATARS[user.avatarIdx] ?? AVATARS[0];
  (document.getElementById('loginName') as HTMLElement).textContent = `${user.name} ${user.surname || ''}`.trim();
  (document.getElementById('loginEmail') as HTMLElement).textContent = user.email || '';
}

function buildShowcaseCard(task: Task): string {
  const priority = SHOWCASE_PRIORITY[task.prio] ?? SHOWCASE_PRIORITY.medium;
  return `
    <div class="task-card">
      <div class="tc-title">${esc(task.title)}</div>
      <div class="tc-meta"><span class="ptag ${priority.cls}">${priority.label}</span></div>
    </div>
  `;
}

function buildShowcaseColumn(
  status: TaskStatus,
  dot: string,
  label: string,
  tasks: Task[],
): string {
  const items = tasks.filter((task) => task.status === status);
  const card = items.length
    ? buildShowcaseCard(items[0])
    : '<div class="task-card showcase-empty"><div class="tc-title">Görev yok</div></div>';

  return `
    <div class="k-col">
      <div class="k-head">
        <div class="k-title">
          <div class="k-dot ${dot}"></div>
          <span class="k-name">${label}</span>
        </div>
        <span class="k-cnt">${items.length}</span>
      </div>
      <div class="k-tasks">${card}</div>
    </div>
  `;
}

function computeShowcaseStats(allTasks: Task[], weekTasks: Task[]): {
  active: number;
  onTime: number;
  weekTotal: number;
} {
  const today = todayIso();
  const active = allTasks.filter((task) => task.status !== 'done').length;
  const weekTotal = weekTasks.length;
  const overdue = weekTasks.filter((task) => task.due && task.due < today && task.status !== 'done').length;
  const onTime = weekTotal ? Math.round(((weekTotal - overdue) / weekTotal) * 100) : 100;

  return { active, onTime, weekTotal };
}

function renderLoginShowcase(userId: string | null): void {
  const kanban = document.getElementById('loginShowcaseKanban');
  const statsEl = document.getElementById('loginShowcaseStats');
  if (!kanban || !statsEl) return;

  if (!userId) {
    kanban.innerHTML = SHOWCASE_COLUMNS.map(({ status, dot, label }) => (
      buildShowcaseColumn(status, dot, label, [])
    )).join('');
    statsEl.innerHTML = `
      <div class="showcase-stat"><strong>0</strong><span>Aktif Görev</span></div>
      <div class="showcase-stat"><strong>%100</strong><span>Zamanında</span></div>
      <div class="showcase-stat"><strong>0</strong><span>Bu Hafta</span></div>
    `;
    return;
  }

  const data = loadUserData(userId);
  if (!data) {
    renderLoginShowcase(null);
    return;
  }

  const syncedTasks = ensureSampleTasks(data.tasks);
  const weekTasks = tasksForWeek(syncedTasks, 0);
  const stats = computeShowcaseStats(syncedTasks, weekTasks);

  kanban.innerHTML = SHOWCASE_COLUMNS.map(({ status, dot, label }) => (
    buildShowcaseColumn(status, dot, label, weekTasks)
  )).join('');

  statsEl.innerHTML = `
    <div class="showcase-stat"><strong>${stats.active}</strong><span>Aktif Görev</span></div>
    <div class="showcase-stat"><strong>%${stats.onTime}</strong><span>Zamanında</span></div>
    <div class="showcase-stat"><strong>${stats.weekTotal}</strong><span>Bu Hafta</span></div>
  `;
}

function checkPin(): void {
  if (!selectedUserId) {
    toast('Önce bir hesap seç', 'err');
    return;
  }

  const data = loadUserData(selectedUserId);
  if (!data) {
    toast('Hesap verisi bulunamadı', 'err');
    return;
  }

  if (pinBuffer === data.profile.pin) {
    openUserSession(selectedUserId);
    enterApp();
    return;
  }

  pinBuffer = '';
  syncPinUi();
  const error = document.getElementById('pinErr');
  if (error) error.textContent = 'Yanlış PIN, tekrar dene';

  const pinEntry = document.getElementById('pinEntry');
  if (pinEntry) {
    pinEntry.classList.add('shake');
    window.setTimeout(() => {
      pinEntry.classList.remove('shake');
      focusPinInput();
    }, 400);
  }
}

export function logout(): void {
  resetPinInput();
  buildLogin(selectedUserId);
  showScreen('loginScreen');
}

export function openForgotPin(): void {
  if (!selectedUserId) {
    toast('Önce bir hesap seç', 'err');
    return;
  }

  const registry = getRegistry();
  const user = registry.users.find((item) => item.id === selectedUserId);
  const data = loadUserData(selectedUserId);
  if (!user || !data) {
    toast('Hesap verisi bulunamadı', 'err');
    return;
  }

  (document.getElementById('resetPinAv') as HTMLElement).textContent = AVATARS[user.avatarIdx] ?? AVATARS[0];
  (document.getElementById('resetPinName') as HTMLElement).textContent = `${user.name} ${user.surname || ''}`.trim();
  (document.getElementById('resetPinEmail') as HTMLElement).textContent = user.email || '';

  resetForgotPinForm();
  bindResetPinKeyboard();
  showScreen('resetPinScreen');
  focusResetPinInput(1);
}

export function cancelForgotPin(): void {
  resetForgotPinForm();
  showScreen('loginScreen');
  focusPinInput();
}

export function saveForgotPin(): void {
  const error = document.getElementById('resetPinErr');
  if (error) error.textContent = '';

  if (!selectedUserId) return;

  if (!/^\d{4}$/.test(resetPinNew)) {
    if (error) error.textContent = '4 haneli sayısal PIN gerekli';
    shakeResetPinEntry(1);
    focusResetPinInput(1);
    return;
  }
  if (!/^\d{4}$/.test(resetPinConfirm)) {
    if (error) error.textContent = 'Yeni PIN\'i tekrar girin';
    shakeResetPinEntry(2);
    focusResetPinInput(2);
    return;
  }
  if (resetPinNew !== resetPinConfirm) {
    if (error) error.textContent = 'PIN\'ler eşleşmiyor, tekrar dene';
    resetPinConfirm = '';
    syncResetPinUi(2);
    shakeResetPinEntry(2);
    focusResetPinInput(2);
    return;
  }

  const data = loadUserData(selectedUserId);
  if (!data) {
    toast('Hesap verisi bulunamadı', 'err');
    return;
  }

  const { id: _id, ...profileRest } = data.profile;
  updateUserProfile(selectedUserId, { ...profileRest, pin: resetPinNew });

  toast('PIN güncellendi ✓', 'ok');
  resetForgotPinForm();
  resetPinInput();
  showScreen('loginScreen');
  focusPinInput();
}

function resetForgotPinForm(): void {
  resetPinNew = '';
  resetPinConfirm = '';
  syncResetPinUi(1);
  syncResetPinUi(2);
  const error = document.getElementById('resetPinErr');
  if (error) error.textContent = '';
}

function syncResetPinUi(step: 1 | 2): void {
  const buffer = step === 1 ? resetPinNew : resetPinConfirm;
  const inputId = step === 1 ? 'resetPin1' : 'resetPin2';
  const dotPrefix = step === 1 ? 'rpd1' : 'rpd2';

  const input = document.getElementById(inputId) as HTMLInputElement | null;
  if (input && input.value !== buffer) input.value = buffer;

  for (let i = 0; i < 4; i += 1) {
    document.getElementById(`${dotPrefix}${i}`)?.classList.toggle('filled', i < buffer.length);
  }
}

function focusResetPinInput(step: 1 | 2): void {
  window.setTimeout(() => {
    (document.getElementById(step === 1 ? 'resetPin1' : 'resetPin2') as HTMLInputElement | null)?.focus();
  }, 60);
}

function shakeResetPinEntry(step: 1 | 2): void {
  const entry = document.getElementById(step === 1 ? 'resetPinEntry1' : 'resetPinEntry2');
  if (!entry) return;
  entry.classList.add('shake');
  window.setTimeout(() => entry.classList.remove('shake'), 400);
}

function bindResetPinKeyboard(): void {
  if (resetPinKeyboardBound) return;
  resetPinKeyboardBound = true;

  bindResetPinInput('resetPin1', 'resetPinEntry1', () => resetPinNew, (value) => {
    resetPinNew = value;
  }, () => {
    if (resetPinNew.length === 4) focusResetPinInput(2);
  }, () => saveForgotPin());

  bindResetPinInput('resetPin2', 'resetPinEntry2', () => resetPinConfirm, (value) => {
    resetPinConfirm = value;
  }, () => {
    if (resetPinConfirm.length === 4) window.setTimeout(saveForgotPin, 80);
  }, () => saveForgotPin());
}

function bindResetPinInput(
  inputId: string,
  entryId: string,
  getBuffer: () => string,
  setBuffer: (value: string) => void,
  onComplete: () => void,
  onEnter: () => void,
): void {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  if (!input) return;

  const step: 1 | 2 = inputId === 'resetPin1' ? 1 : 2;

  input.addEventListener('input', () => {
    setBuffer(input.value.replace(/\D/g, '').slice(0, 4));
    syncResetPinUi(step);
    if (getBuffer().length === 4) onComplete();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && getBuffer().length === 4) {
      event.preventDefault();
      onEnter();
    }
  });

  document.getElementById(entryId)?.addEventListener('click', () => focusResetPinInput(step));
}

export { buildLogin as refreshLogin };
