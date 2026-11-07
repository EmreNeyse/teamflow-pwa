import type { UserData } from '@/types';
import { weekKey } from '@/lib/tasks/week';

export interface RolloverResult {
  data: UserData;
  /** Hafta değişti mi (veya ilk kez takip edilmeye başlandı mı)? */
  changed: boolean;
  /** Bu haftanın bekleyen listesine devredilen görev sayısı. */
  carried: number;
}

/**
 * Hafta değiştiyse, geçmiş haftalarda kalan bekleyen ve devam eden görevleri
 * bu haftanın "Yapılacak" listesine taşır. Tamamlanan görevler geçmişte kalır.
 * Yalnızca hafta geçişinde çalışır; böylece arşivden bilerek geçmiş bir haftaya
 * atanan görevler bir sonraki hafta geçişine kadar yerinde kalır.
 */
export function rolloverWeek(data: UserData): RolloverResult {
  const current = weekKey(0);
  if (data.currentWeek === current) return { data, changed: false, carried: 0 };

  let carried = 0;
  const tasks = (data.tasks ?? []).map((task) => {
    if (task.wk >= current || task.status === 'done') return task;
    carried += 1;
    return {
      ...task,
      wk: current,
      status: 'todo' as const,
      carriedFrom: task.carriedFrom ?? task.wk,
    };
  });

  return {
    data: { ...data, tasks, currentWeek: current, wkOff: 0 },
    changed: true,
    carried,
  };
}
