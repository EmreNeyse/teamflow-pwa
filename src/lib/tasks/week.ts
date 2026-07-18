function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function weekKey(offset = 0): string {
  const safeOffset = Number.isFinite(offset) ? offset : 0;
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + safeOffset * 7);
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return formatLocalDate(monday);
}

export function weekLabel(offset: number): string {
  const safeOffset = Number.isFinite(offset) ? offset : 0;
  if (safeOffset === 0) return 'Bu Hafta';
  if (safeOffset === -1) return 'Geçen Hafta';
  if (safeOffset === 1) return 'Gelecek Hafta';
  return `${Math.abs(safeOffset)} hafta ${safeOffset < 0 ? 'önce' : 'sonra'}`;
}

export function tasksForWeek<T extends { wk: string }>(tasks: T[], offset = 0): T[] {
  return tasks.filter((task) => task.wk === weekKey(offset));
}

export function todayIso(): string {
  return formatLocalDate(new Date());
}

export function normalizeWeekOffset(offset: unknown): number {
  return Number.isFinite(offset) ? Number(offset) : 0;
}
