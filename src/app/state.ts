import { syncDemoTasksForUser } from '@/lib/tasks/demo-sync';
import type { UserData } from '@/types';
import {
  getSession,
  loadUserData,
  saveUserData,
  setSession,
} from '@/lib/storage/user-storage';
import { scheduleCloudPush, touchCloudRevision } from '@/lib/sync/cloud-sync';
import { runRoutineChecks } from '@/lib/routines/scheduler';
import { refreshNotifications } from '@/lib/notifications/ui';
import { rolloverWeek } from '@/lib/tasks/rollover';

let currentUserId: string | null = null;
let currentData: UserData | null = null;

export function getCurrentUserId(): string | null {
  return currentUserId;
}

export function getState(): UserData {
  if (!currentData) throw new Error('Oturum açık değil');
  return currentData;
}

export function setState(data: UserData, persist = true): void {
  let next = data;
  if (persist && next.cfg.cloud?.enabled) {
    next = touchCloudRevision(next);
  }

  const synced = persist && currentUserId
    ? saveUserData(currentUserId, next)
    : syncDemoTasksForUser(next);
  currentData = synced;
  refreshNotifications(synced);

  if (persist && synced.cfg.cloud?.enabled) {
    scheduleCloudPush(synced);
  }
}

export function openUserSession(userId: string): UserData | null {
  const loaded = loadUserData(userId);
  if (!loaded) return null;

  // Görüntülenen hafta oturuma özeldir: aynı kullanıcı yeniden yüklenirse (ör. buluttan çekme) korunur.
  const keepWkOff = currentUserId === userId && currentData ? currentData.wkOff : loaded.wkOff;

  const rolled = rolloverWeek({ ...loaded, wkOff: keepWkOff });
  let synced = saveUserData(userId, rolled.changed ? touchCloudRevision(rolled.data) : rolled.data);
  currentUserId = userId;
  setSession(userId);

  const withRoutines = runRoutineChecks(synced);
  if (withRoutines !== synced) {
    synced = saveUserData(userId, withRoutines);
  }
  currentData = synced;
  lastRolloverCarried = rolled.carried;
  refreshNotifications(currentData);

  if (rolled.changed && currentData.cfg.cloud?.enabled) {
    scheduleCloudPush(currentData);
  }
  return currentData;
}

let lastRolloverCarried = 0;

/** Son oturum açılışında / hafta geçişinde devredilen görev sayısını verir ve sıfırlar. */
export function consumeRolloverCarried(): number {
  const count = lastRolloverCarried;
  lastRolloverCarried = 0;
  return count;
}

/**
 * Arka plan hafta takibi: takvim haftası değiştiyse devri uygular,
 * rutinleri çalıştırır ve görünümü bu haftaya döndürür. Hafta değişmediyse false döner.
 */
export function checkWeekRollover(): boolean {
  if (!currentUserId || !currentData) return false;
  const rolled = rolloverWeek(currentData);
  if (!rolled.changed) return false;

  setState(runRoutineChecks(rolled.data));
  lastRolloverCarried = rolled.carried;
  return true;
}

export function closeUserSession(): void {
  currentUserId = null;
  currentData = null;
  setSession(null);
}

export function restoreSessionFromStorage(): UserData | null {
  const session = getSession();
  if (!session?.userId) return null;
  return openUserSession(session.userId);
}

export function patchState(updater: (data: UserData) => UserData): void {
  setState(updater(getState()));
}
