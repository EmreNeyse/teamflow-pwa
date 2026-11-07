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

function parseWeekKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

/** Verilen hafta anahtarının bu haftaya göre offset'i (geçmiş haftalar negatif). */
export function offsetForWeek(key: string): number {
  const diff = parseWeekKey(key).getTime() - parseWeekKey(weekKey(0)).getTime();
  return Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

/** "2–8 Kas 2026" biçiminde hafta aralığı etiketi. */
export function weekRangeLabel(key: string): string {
  const start = parseWeekKey(key);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const month = (date: Date) => date.toLocaleDateString('tr-TR', { month: 'short' });
  const startText = start.getMonth() === end.getMonth()
    ? String(start.getDate())
    : `${start.getDate()} ${month(start)}`;
  return `${startText}–${end.getDate()} ${month(end)} ${end.getFullYear()}`;
}
