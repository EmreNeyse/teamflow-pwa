import type { Task, TaskStatus, UserData } from '@/types';
import { weekKey } from '@/lib/tasks/week';

export interface RolloverResult {
  data: UserData;
  /** Veri değişti mi (hafta geçişi, ilk takip veya eski sürüm düzeltmesi)? */
  changed: boolean;
  /** Bu haftanın bekleyen listesine kopyalanan görev sayısı. */
  carried: number;
}

function newTaskId(): string {
  return `t${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
}

/** Bir görevi başka bir haftaya kopya olarak ekler; kaynak görev kendi haftasında kalır. */
export function copyTaskToWeek(task: Task, week: string, status: TaskStatus): Task {
  return {
    ...task,
    id: newTaskId(),
    wk: week,
    status,
    created: new Date().toISOString(),
    notes: [...(task.notes ?? [])],
    carriedFrom: task.wk,
    sourceId: task.id,
    carriedTo: undefined,
  };
}

/**
 * Önceki sürüm devredilen görevleri yeni haftaya *taşıyordu* (carriedFrom var, sourceId yok).
 * Bu görevleri ilk haftalarına geri koyar ve bulundukları haftaya bir kopyasını bırakır.
 */
function restoreMovedTasks(tasks: Task[]): { tasks: Task[]; changed: boolean } {
  let changed = false;
  const next: Task[] = [];
  for (const task of tasks) {
    if (!task.carriedFrom || task.sourceId || task.carriedFrom >= task.wk) {
      next.push(task);
      continue;
    }
    changed = true;
    const original: Task = { ...task, wk: task.carriedFrom, carriedFrom: undefined, carriedTo: task.wk };
    const copy: Task = { ...task, id: newTaskId(), carriedFrom: task.carriedFrom, sourceId: task.id, notes: [...(task.notes ?? [])] };
    next.push(original, copy);
  }
  return { tasks: next, changed };
}

/**
 * Hafta değiştiyse geçmiş haftalarda tamamlanmamış (bekleyen / devam eden) ve henüz
 * aktarılmamış görevlerin birer kopyasını bu haftanın "Yapılacak" listesine ekler.
 * Orijinal görevler açıldıkları haftada olduğu gibi kalır.
 */
export function rolloverWeek(data: UserData): RolloverResult {
  const current = weekKey(0);
  const restored = restoreMovedTasks(data.tasks ?? []);
  const weekChanged = data.currentWeek !== current;

  if (!weekChanged) {
    return restored.changed
      ? { data: { ...data, tasks: restored.tasks }, changed: true, carried: 0 }
      : { data, changed: false, carried: 0 };
  }

  const copies: Task[] = [];
  const tasks = restored.tasks.map((task) => {
    if (task.wk >= current || task.status === 'done' || task.carriedTo) return task;
    copies.push(copyTaskToWeek(task, current, 'todo'));
    return { ...task, carriedTo: current };
  });

  return {
    data: { ...data, tasks: [...tasks, ...copies], currentWeek: current, wkOff: 0 },
    changed: true,
    carried: copies.length,
  };
}
