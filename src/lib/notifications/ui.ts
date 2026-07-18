import { ROUTINE_META } from '@/data/constants';
import type { AppNotification, UserData } from '@/types';
import { unreadCount } from '@/lib/routines/scheduler';
import { esc } from '@/lib/utils';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderItem(notification: AppNotification): string {
  const meta = ROUTINE_META[notification.type];
  return `
    <button class="notif-item${notification.read ? '' : ' unread'}" data-id="${notification.id}">
      <span class="notif-item-icon">${meta.icon}</span>
      <div class="notif-item-body">
        <div class="notif-item-title">${esc(notification.title)}</div>
        <div class="notif-item-text">${esc(notification.body)}</div>
        <div class="notif-item-time">${formatTime(notification.createdAt)}</div>
      </div>
    </button>
  `;
}

export function renderNotificationBadge(data: UserData): void {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;

  const count = unreadCount(data);
  badge.textContent = String(count);
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

export function renderNotificationMenu(data: UserData): void {
  const list = document.getElementById('notifList');
  const empty = document.getElementById('notifEmpty');
  if (!list || !empty) return;

  if (!data.notifications.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = data.notifications.map(renderItem).join('');

  list.querySelectorAll('.notif-item').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-id');
      if (!id) return;
      window.dispatchEvent(new CustomEvent('tf:notif-open', { detail: { id } }));
    });
  });
}

export function positionNotificationMenu(): void {
  const trigger = document.getElementById('notifTrigger');
  const menu = document.getElementById('notifDropdown');
  if (!trigger || !menu?.classList.contains('open')) return;

  const rect = trigger.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 10}px`;
  menu.style.right = `${window.innerWidth - rect.right}px`;
}

export function toggleNotificationMenu(): void {
  const menu = document.getElementById('notifDropdown');
  if (!menu) return;

  const opening = !menu.classList.contains('open');
  menu.classList.toggle('open');
  if (opening) positionNotificationMenu();
}

export function closeNotificationMenu(): void {
  document.getElementById('notifDropdown')?.classList.remove('open');
}

export function bindNotificationOutsideClick(): void {
  document.addEventListener('click', (event) => {
    const wrap = document.getElementById('notifWrap');
    const menu = document.getElementById('notifDropdown');
    const target = event.target as Node;
    if (!wrap || !menu) return;
    if (!wrap.contains(target) && !menu.contains(target)) closeNotificationMenu();
  });
}

export function refreshNotifications(data: UserData): void {
  renderNotificationBadge(data);
  renderNotificationMenu(data);
}
