import { isSampleReportId, isSampleTaskId } from '@/data/sample-tasks';
import { normalizeWeekOffset } from '@/lib/tasks/week';
import { getRegistry, loadUserData, saveUserData } from '@/lib/storage/user-storage';
import type { UserData } from '@/types';

export function syncDemoTasksForUser(data: UserData): UserData {
  const wkOff = normalizeWeekOffset(data.wkOff);
  const tasks = (data.tasks ?? []).filter((task) => !isSampleTaskId(task.id));
  const reports = (data.reports ?? []).filter((report) => !isSampleReportId(report.id));

  return {
    ...data,
    wkOff,
    filter: data.filter ?? 'all',
    darkMode: data.darkMode ?? true,
    tasks,
    reports,
    notifications: data.notifications ?? [],
    routineFlags: data.routineFlags ?? {},
    cfg: data.cfg ?? {},
  };
}

export function migrateAllUserDemoTasks(): void {
  const registry = getRegistry();
  registry.users.forEach((user) => {
    const data = loadUserData(user.id);
    if (!data) return;

    const synced = syncDemoTasksForUser(data);
    if (JSON.stringify(data) !== JSON.stringify(synced)) {
      saveUserData(user.id, synced);
    }
  });
}
