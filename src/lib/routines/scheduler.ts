import { ROUTINE_META } from '@/data/constants';
import type { AppNotification, RoutineType, Task, UserData } from '@/types';
import { tasksForWeek, todayIso, weekKey } from '@/lib/tasks/week';
import { uid } from '@/lib/utils';

function countOverdue(tasks: Task[]): number {
  const today = todayIso();
  return tasks.filter((task) => task.due && task.due < today && task.status !== 'done').length;
}

function buildMondayBody(tasks: Task[]): string {
  if (!tasks.length) {
    return 'Bu hafta henüz görev yok. AI Group Head haftalık plan için birkaç odak görevi eklemeni öneriyor.';
  }

  const todo = tasks.filter((task) => task.status === 'todo').length;
  const inProgress = tasks.filter((task) => task.status === 'inprogress').length;
  const high = tasks.filter((task) => task.prio === 'high').length;
  const overdue = countOverdue(tasks);

  const parts = [
    `${tasks.length} görev planlandı (${todo} yapılacak, ${inProgress} devam ediyor).`,
    high ? `${high} yüksek öncelikli görev var.` : 'Yüksek öncelikli görev tanımlı değil.',
    overdue ? `${overdue} görev gecikmiş durumda.` : 'Geciken görev yok.',
  ];

  return parts.join(' ');
}

function buildWednesdayBody(tasks: Task[]): string {
  const active = tasks.filter((task) => task.status !== 'done');
  if (!active.length) {
    return 'Hafta ortasında tamamlanacak aktif görev kalmadı. Yeni hedefler ekleyebilir veya rapor hazırlığına geçebilirsin.';
  }

  const likely = active
    .filter((task) => task.status === 'inprogress' || task.prio === 'high')
    .slice(0, 3)
    .map((task) => task.title);

  const base = `${active.length} aktif görev var. Hafta sonuna kadar öncelikli odak:`;
  return likely.length ? `${base} ${likely.join(', ')}.` : `${base} devam eden görevlerini sırayla tamamla.`;
}

function buildFridayBody(tasks: Task[]): string {
  const done = tasks.filter((task) => task.status === 'done').length;
  const inProgress = tasks.filter((task) => task.status === 'inprogress').length;
  const todo = tasks.filter((task) => task.status === 'todo').length;
  const overdue = countOverdue(tasks);

  return `Haftalık özet: ${done} tamamlandı, ${inProgress} devam ediyor, ${todo} bekliyor${overdue ? `, ${overdue} gecikmiş` : ''}. Detaylı rapor Raporlar sekmesinde.`;
}

function buildBody(type: RoutineType, tasks: Task[]): string {
  if (type === 'monday_plan') return buildMondayBody(tasks);
  if (type === 'wednesday_checkin') return buildWednesdayBody(tasks);
  return buildFridayBody(tasks);
}

function createNotification(type: RoutineType, data: UserData, week: string): AppNotification {
  const tasks = tasksForWeek(data.tasks, 0);
  const meta = ROUTINE_META[type];

  return {
    id: uid('n'),
    type,
    title: meta.title,
    body: buildBody(type, tasks),
    read: false,
    createdAt: new Date().toISOString(),
    weekKey: week,
  };
}

function buildWeeklyReport(data: UserData, week: string) {
  const tasks = tasksForWeek(data.tasks, 0);
  const done = tasks.filter((task) => task.status === 'done').length;
  const inProgress = tasks.filter((task) => task.status === 'inprogress').length;
  const todo = tasks.filter((task) => task.status === 'todo').length;
  const overdue = countOverdue(tasks);

  const summary = `Toplam ${tasks.length} görev · ${done} tamamlandı · ${inProgress} devam · ${todo} bekliyor · ${overdue} gecikmiş`;

  data.reports.unshift({
    id: uid('r'),
    wk: week,
    created: new Date().toISOString(),
    total: tasks.length,
    done,
    inprogress: inProgress,
    todo,
    overdue,
    summary,
  });
}

export function runRoutineChecks(data: UserData): UserData {
  const day = new Date().getDay();
  const week = weekKey(0);
  const next = structuredClone(data);

  const routines: Array<{ minDay: number; type: RoutineType; flag: keyof UserData['routineFlags'] }> = [
    { minDay: 1, type: 'monday_plan', flag: 'mondayWeek' },
    { minDay: 3, type: 'wednesday_checkin', flag: 'wednesdayWeek' },
    { minDay: 5, type: 'friday_report', flag: 'fridayWeek' },
  ];

  for (const routine of routines) {
    if (day < routine.minDay) continue;
    if (next.routineFlags[routine.flag] === week) continue;

    next.notifications.unshift(createNotification(routine.type, next, week));
    next.routineFlags[routine.flag] = week;

    if (routine.type === 'friday_report') {
      buildWeeklyReport(next, week);
    }
  }

  return next;
}

export function unreadCount(data: UserData): number {
  return data.notifications.filter((item) => !item.read).length;
}

export function markNotificationRead(data: UserData, notificationId: string): UserData {
  const next = structuredClone(data);
  const item = next.notifications.find((notification) => notification.id === notificationId);
  if (item) item.read = true;
  return next;
}

export function markAllNotificationsRead(data: UserData): UserData {
  const next = structuredClone(data);
  next.notifications.forEach((notification) => {
    notification.read = true;
  });
  return next;
}
