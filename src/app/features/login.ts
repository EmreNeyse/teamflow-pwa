import { AVATARS } from '@/data/constants';
import {
  createUser,
  deleteUser,
  findUserByLogin,
  findUserForPinReset,
  getRegistry,
  loadUserData,
  updateUserProfile,
} from '@/lib/storage/user-storage';
import { isCloudSyncAvailable } from '@/lib/sync/config';
import { tasksForWeek, todayIso } from '@/lib/tasks/week';
import { esc, showScreen } from '@/lib/utils';
import type { Task, TaskStatus, UserProfile } from '@/types';
import { closeUserSession, openUserSession } from '@/app/state';
import { toast } from '@/app/toast';
import { enterApp } from '@/app/features/shell';
import { renderCloudSyncLogin } from '@/app/features/cloud-sync';
import { renderLoginInstallHint } from '@/lib/pwa/install';
import { renderLoginPairingHint } from '@/app/features/device-pairing';

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

export type AuthMode = 'login' | 'register' | 'forgot';

let selectedUserId: string | null = null;
let registerAvatar = 0;
let resetPinNew = '';
let resetPinConfirm = '';
let resetPinKeyboardBound = false;

function field(id: string): HTMLInputElement {
  return document.getElementById(id) as HTMLInputElement;
}

function setError(id: string, message: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = message;
}

function shake(id: string): void {
  const element = document.getElementById(id);
  if (!element) return;
  element.classList.remove('shake');
  void element.offsetWidth;
  element.classList.add('shake');
  window.setTimeout(() => element.classList.remove('shake'), 400);
}

function onlyDigits(input: HTMLInputElement): void {
  if (input.dataset.digitsBound) return;
  input.dataset.digitsBound = '1';
  input.addEventListener('input', () => {
    const clean = input.value.replace(/\D/g, '').slice(0, 4);
    if (clean !== input.value) input.value = clean;
  });
}

export function buildLogin(preferredUserId: string | null = null, mode?: AuthMode): void {
  const registry = getRegistry();
  selectedUserId = preferredUserId && registry.users.some((user) => user.id === preferredUserId)
    ? preferredUserId
    : registry.users[0]?.id ?? null;

  ['loginPin', 'regPin', 'regPin2'].forEach((id) => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (input) onlyDigits(input);
  });

  renderUserPicker(registry.users);
  renderRegisterAvatars();
  renderLoginShowcase(selectedUserId);
  renderCloudSyncLogin();
  renderLoginInstallHint();
  renderLoginPairingHint();
  document.getElementById('forgotCloudNote')?.classList.toggle('hidden', !isCloudSyncAvailable());

  prefillLogin();
  setAuthMode(mode ?? (registry.users.length ? 'login' : 'register'));
}

function prefillLogin(): void {
  const user = getRegistry().users.find((item) => item.id === selectedUserId);
  const id = field('loginId');
  const pin = field('loginPin');
  if (id) id.value = user ? (user.email || user.name) : '';
  if (pin) pin.value = '';
  setError('loginErr', '');
}

export function setAuthMode(mode: AuthMode): void {
  const card = document.getElementById('authCard');
  if (card) card.dataset.mode = mode;

  const panels: Record<AuthMode, string> = { login: 'authLogin', register: 'authRegister', forgot: 'authForgot' };
  (Object.keys(panels) as AuthMode[]).forEach((key) => {
    document.getElementById(panels[key])?.classList.toggle('hidden', key !== mode);
  });

  const tabMode = mode === 'register' ? 'register' : 'login';
  const loginTab = document.getElementById('authTabLogin');
  const registerTab = document.getElementById('authTabRegister');
  loginTab?.classList.toggle('active', tabMode === 'login');
  registerTab?.classList.toggle('active', tabMode === 'register');
  loginTab?.setAttribute('aria-selected', String(tabMode === 'login'));
  registerTab?.setAttribute('aria-selected', String(tabMode === 'register'));

  ['loginErr', 'registerErr', 'forgotErr'].forEach((id) => setError(id, ''));

  if (mode === 'forgot') {
    const loginId = field('loginId')?.value.trim() ?? '';
    if (loginId && !field('forgotId').value) field('forgotId').value = loginId;
  }

  const focusId = mode === 'register'
    ? 'regName'
    : mode === 'forgot'
      ? (field('forgotId')?.value ? 'forgotSurname' : 'forgotId')
      : (field('loginId')?.value ? 'loginPin' : 'loginId');
  window.setTimeout(() => field(focusId)?.focus(), 60);
}

export function submitLogin(): void {
  const identifier = field('loginId').value.trim();
  const pin = field('loginPin').value.trim();

  if (!identifier) {
    setError('loginErr', 'Adını veya e-postanı gir');
    field('loginId').focus();
    return;
  }
  if (!/^\d{4}$/.test(pin)) {
    setError('loginErr', '4 haneli PIN gir');
    shake('loginPin');
    field('loginPin').focus();
    return;
  }

  const userId = findUserByLogin(identifier, pin);
  if (!userId) {
    setError('loginErr', 'Ad/e-posta veya PIN hatalı');
    field('loginPin').value = '';
    shake('loginPin');
    field('loginPin').focus();
    return;
  }

  selectedUserId = userId;
  openUserSession(userId);
  enterApp();
}

function renderRegisterAvatars(): void {
  const grid = document.getElementById('regAvatars');
  if (!grid) return;
  grid.innerHTML = AVATARS.map((avatar, index) => (
    `<button type="button" class="auth-av${index === registerAvatar ? ' sel' : ''}" data-av="${index}" aria-label="Avatar ${index + 1}" aria-pressed="${index === registerAvatar}">${avatar}</button>`
  )).join('');
  grid.querySelectorAll<HTMLButtonElement>('.auth-av').forEach((button) => {
    button.addEventListener('click', () => {
      registerAvatar = Number(button.dataset.av);
      grid.querySelectorAll<HTMLButtonElement>('.auth-av').forEach((item) => {
        const active = Number(item.dataset.av) === registerAvatar;
        item.classList.toggle('sel', active);
        item.setAttribute('aria-pressed', String(active));
      });
    });
  });
}

export function submitRegister(): void {
  const name = field('regName').value.trim();
  const surname = field('regSurname').value.trim();
  const email = field('regEmail').value.trim().toLowerCase();
  const pin = field('regPin').value.trim();
  const pin2 = field('regPin2').value.trim();

  const fail = (message: string, focusId: string) => {
    setError('registerErr', message);
    shake(focusId);
    field(focusId).focus();
  };

  if (!name) return fail('Ad gerekli', 'regName');
  if (!surname) return fail('Soyad gerekli (PIN sıfırlamada doğrulama için kullanılır)', 'regSurname');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Geçerli bir e-posta gir', 'regEmail');
  if (!/^\d{4}$/.test(pin)) return fail('PIN 4 haneli sayı olmalı', 'regPin');
  if (pin !== pin2) return fail('PIN\'ler eşleşmiyor', 'regPin2');

  const exists = getRegistry().users.some((user) => (user.email ?? '').toLowerCase() === email);
  if (exists) return fail('Bu e-posta ile kayıtlı bir hesap var. Giriş yap sekmesini kullan.', 'regEmail');

  const created = createUser({ name, surname, email, pin, avatarIdx: registerAvatar } as Omit<UserProfile, 'id'>);
  ['regName', 'regSurname', 'regEmail', 'regPin', 'regPin2'].forEach((id) => { field(id).value = ''; });
  selectedUserId = created.profile.id;
  openUserSession(created.profile.id);
  enterApp();
  toast(`Hoş geldin ${name}! Hesabın oluşturuldu ✓`, 'ok');
}

export function submitForgot(): void {
  const identifier = field('forgotId').value.trim();
  const surname = field('forgotSurname').value.trim();
  if (!identifier) {
    setError('forgotErr', 'Adını veya e-postanı gir');
    field('forgotId').focus();
    return;
  }

  const userId = findUserForPinReset(identifier, surname);
  if (!userId) {
    setError('forgotErr', 'Bu bilgilerle eşleşen hesap bulunamadı');
    shake('forgotSurname');
    return;
  }

  selectedUserId = userId;
  field('forgotSurname').value = '';
  openForgotPin();
}

function renderUserPicker(users: ReturnType<typeof getRegistry>['users']): void {
  const picker = document.getElementById('userPicker');
  document.getElementById('authAccounts')?.classList.toggle('hidden', !users.length);
  if (!picker) return;

  picker.innerHTML = users.map((user) => `
    <button type="button" class="user-chip${user.id === selectedUserId ? ' active' : ''}" data-user-id="${user.id}" title="${esc(user.email || user.name)}">
      <span class="user-chip-av">${AVATARS[user.avatarIdx] ?? AVATARS[0]}</span>
      <span class="user-chip-name">${esc(user.name)}</span>
      <span class="user-chip-close" data-remove-id="${user.id}" title="Hesabı bu cihazdan sil">
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
      renderLoginShowcase(selectedUserId);
      prefillLogin();
      field('loginPin').focus();
    });
  });
}

function removeAccount(userId: string): void {
  const registry = getRegistry();
  const user = registry.users.find((item) => item.id === userId);
  if (!user) return;
  if (!confirm(`"${user.name}" hesabını bu cihazdan silmek istediğine emin misin?`)) return;

  deleteUser(userId);
  const updated = getRegistry();
  toast('Hesap silindi');

  const nextId = selectedUserId === userId ? (updated.lastUserId ?? updated.users[0]?.id ?? null) : selectedUserId;
  buildLogin(nextId);
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

  const syncedTasks = data.tasks ?? [];
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

export function logout(): void {
  buildLogin(selectedUserId, 'login');
  showScreen('loginScreen');
}

/** Yeni hesap: oturumu kapatıp giriş ekranını kayıt modunda açar. */
export function openRegister(): void {
  closeUserSession();
  buildLogin(null, 'register');
  showScreen('loginScreen');
}

export function openForgotPin(): void {
  if (!selectedUserId) {
    setAuthMode('forgot');
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
  setAuthMode('login');
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

  toast('PIN güncellendi ✓ Yeni PIN ile giriş yapabilirsin', 'ok');
  resetForgotPinForm();
  buildLogin(selectedUserId, 'login');
  showScreen('loginScreen');
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
