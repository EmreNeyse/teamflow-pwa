import {
  ensureSampleReports,
  ensureSampleTasks,
  reportsChanged,
  tasksChanged,
} from '@/data/sample-tasks';
import { normalizeWeekOffset, weekKey } from '@/lib/tasks/week';
import { getRegistry, loadUserData, saveUserData } from '@/lib/storage/user-storage';
import type { UserData } from '@/types';

export function syncDemoTasksForUser(data: UserData): UserData {
  const wkOff = normalizeWeekOffset(data.wkOff);
  const tasks = ensureSampleTasks(data.tasks, weekKey(wkOff));
  const reports = ensureSampleReports(data.reports, tasks);

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
    if (
      tasksChanged(data.tasks, synced.tasks)
      || reportsChanged(data.reports, synced.reports)
      || data.wkOff !== synced.wkOff
    ) {
      saveUserData(user.id, synced);
    }
  });
}
