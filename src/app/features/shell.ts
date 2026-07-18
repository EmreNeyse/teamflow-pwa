import { AVATARS } from '@/data/constants';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/routines/scheduler';
import {
  bindNotificationOutsideClick,
  closeNotificationMenu,
  positionNotificationMenu,
  refreshNotifications,
  toggleNotificationMenu,
} from '@/lib/notifications/ui';
import { syncDemoTasksForUser } from '@/lib/tasks/demo-sync';
import { getRegistry } from '@/lib/storage/user-storage';
import { showScreen } from '@/lib/utils';
import { closeUserSession, getState, patchState } from '@/app/state';
import { closeChatSuggestions } from '@/app/features/ai';
import { closeReportDownloadMenu, renderReports } from '@/app/features/reports';
import { renderSettings } from '@/app/features/settings';
import { renderTasks } from '@/app/features/tasks';

export function enterApp(): void {
  patchState((state) => syncDemoTasksForUser({ ...state, filter: 'all' }));

  const state = getState();
  const profile = state.profile;

  (document.getElementById('navAv') as HTMLElement).textContent = AVATARS[profile.avatarIdx] ?? AVATARS[0];
  (document.getElementById('navNm') as HTMLElement).textContent = profile.name;
  (document.getElementById('pdAv') as HTMLElement).textContent = AVATARS[profile.avatarIdx] ?? AVATARS[0];
  (document.getElementById('pdName') as HTMLElement).textContent = `${profile.name} ${profile.surname || ''}`.trim();
  (document.getElementById('pdEmail') as HTMLElement).textContent = profile.email || '—';

  showScreen('appScreen');
  applyDarkMode();
  renderTasks();
  renderReports();
  refreshNotifications(state);

  void import('@/app/features/cloud-sync').then(({ runCloudSyncOnAppEnter }) => {
    void runCloudSyncOnAppEnter().then((result) => {
      if (result === 'pulled') {
        renderTasks();
        renderReports();
        refreshNotifications(getState());
      }
    });
  });
}

export function switchTab(tab: 'tasks' | 'ai' | 'reports' | 'settings'): void {
  if (tab !== 'ai') closeChatSuggestions();
  if (tab !== 'reports') closeReportDownloadMenu();

  setActiveNavTab(tab);

  if (tab === 'reports') renderReports();
  if (tab === 'settings') renderSettings();
}

function setActiveNavTab(tab: 'tasks' | 'ai' | 'reports' | 'settings'): void {
  document.querySelectorAll('[data-nav-tab]').forEach((element) => {
    const navTab = element.getAttribute('data-nav-tab');
    element.classList.toggle('active', tab !== 'settings' && navTab === tab);
  });

  (['tasks', 'ai', 'reports', 'settings'] as const).forEach((name) => {
    document.getElementById(`tc-${name}`)?.classList.toggle('active', name === tab);
  });
}

function positionProfileMenu(): void {
  const trigger = document.getElementById('profileTrigger');
  const menu = document.getElementById('profileDropdown');
  if (!trigger || !menu?.classList.contains('open')) return;
  const rect = trigger.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 10}px`;
  menu.style.right = `${window.innerWidth - rect.right}px`;
}

export function toggleProfileMenu(): void {
  const menu = document.getElementById('profileDropdown');
  const caret = document.getElementById('profileCaret');
  if (!menu || !caret) return;

  const opening = !menu.classList.contains('open');
  menu.classList.toggle('open');
  caret.classList.toggle('open');
  if (opening) positionProfileMenu();
}

export function profileAction(action: 'settings' | 'dark' | 'logout'): void {
  document.getElementById('profileDropdown')?.classList.remove('open');
  document.getElementById('profileCaret')?.classList.remove('open');

  if (action === 'settings') {
    setActiveNavTab('settings');
    renderSettings();
    return;
  }

  if (action === 'dark') {
    toggleDarkMode();
    const isDark = document.body.classList.contains('dark');
    (document.getElementById('pdDarkIcon') as HTMLElement).textContent = isDark ? '☀️' : '🌙';
    (document.getElementById('pdDarkLabel') as HTMLElement).textContent = isDark ? 'Açık Tema' : 'Koyu Tema';
    return;
  }

  closeUserSession();
  const registry = getRegistry();
  void import('@/app/features/login').then(({ buildLogin }) => {
    buildLogin(registry.lastUserId ?? registry.users[0]?.id ?? null);
    showScreen('loginScreen');
  });
}

export function toggleDarkMode(): void {
  const isDark = document.body.classList.toggle('dark');
  patchState((state) => ({ ...state, darkMode: isDark }));
  const toggle = document.getElementById('darkToggle');
  if (toggle) toggle.textContent = isDark ? '☀️' : '🌙';
}

export function applyDarkMode(): void {
  const isDark = getState().darkMode !== false;
  document.body.classList.toggle('dark', isDark);
  const toggle = document.getElementById('darkToggle');
  if (toggle) toggle.textContent = isDark ? '☀️' : '🌙';
  const icon = document.getElementById('pdDarkIcon');
  const label = document.getElementById('pdDarkLabel');
  if (icon) icon.textContent = isDark ? '☀️' : '🌙';
  if (label) label.textContent = isDark ? 'Açık Tema' : 'Koyu Tema';
}

export function markAllRead(): void {
  patchState((state) => markAllNotificationsRead(state));
  closeNotificationMenu();
}

export function handleNotificationOpen(notificationId: string): void {
  patchState((state) => markNotificationRead(state, notificationId));
  closeNotificationMenu();

  const notification = getState().notifications.find((item) => item.id === notificationId);
  if (!notification) return;

  if (notification.type === 'friday_report') switchTab('reports');
  else switchTab('ai');
}

export function bindShellEvents(): void {
  bindNotificationOutsideClick();

  document.addEventListener('click', (event) => {
    const wrap = document.getElementById('profileMenuWrap');
    const menu = document.getElementById('profileDropdown');
    const target = event.target as Node;
    if (!wrap || !menu) return;
    if (!wrap.contains(target) && !menu.contains(target)) {
      menu.classList.remove('open');
      document.getElementById('profileCaret')?.classList.remove('open');
    }
  });

  window.addEventListener('resize', () => {
    positionProfileMenu();
    positionNotificationMenu();
  });
  window.addEventListener('scroll', () => {
    positionProfileMenu();
    positionNotificationMenu();
  }, true);

  window.addEventListener('tf:notif-open', (event) => {
    const detail = (event as CustomEvent<{ id: string }>).detail;
    if (detail?.id) handleNotificationOpen(detail.id);
  });
}

export { toggleNotificationMenu, positionNotificationMenu };
