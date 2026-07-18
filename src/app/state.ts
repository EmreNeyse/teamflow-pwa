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

  const synced = saveUserData(userId, loaded);
  currentUserId = userId;
  setSession(userId);

  const withRoutines = runRoutineChecks(synced);
  currentData = withRoutines;
  if (withRoutines !== synced) {
    currentData = saveUserData(userId, withRoutines);
  }
  refreshNotifications(currentData);
  return currentData;
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
