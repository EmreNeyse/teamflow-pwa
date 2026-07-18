import { tasksForWeek, weekKey, weekLabel, normalizeWeekOffset } from '@/lib/tasks/week';
import type { UserData } from '@/types';

const STATUS_LABELS = {
  todo: 'bekliyor',
  inprogress: 'devam ediyor',
  done: 'tamamlandı',
} as const;

const PRIO_LABELS = {
  high: 'yüksek',
  medium: 'orta',
  low: 'düşük',
} as const;

function formatTaskLine(task: UserData['tasks'][number]): string {
  const parts = [
    STATUS_LABELS[task.status],
    `${PRIO_LABELS[task.prio]} öncelik`,
  ];
  if (task.due) parts.push(`bitiş ${task.due}`);
  if (task.tag) parts.push(`etiket ${task.tag}`);
  return `• "${task.title}" — ${parts.join(', ')}`;
}

export function buildGroupHeadSystemPrompt(state: UserData): string {
  const wkOff = normalizeWeekOffset(state.wkOff);
  const week = weekKey(wkOff);
  const tasks = tasksForWeek(state.tasks, wkOff);
  const todo = tasks.filter((task) => task.status === 'todo').length;
  const inProgress = tasks.filter((task) => task.status === 'inprogress').length;
  const done = tasks.filter((task) => task.status === 'done').length;
  const high = tasks.filter((task) => task.prio === 'high').length;
  const taskLines = tasks.length
    ? tasks.map(formatTaskLine).join('\n')
    : '• Bu hafta kayıtlı görev yok.';

  return `Sen TeamFlow uygulamasında ${state.profile.name} adlı kullanıcının kişisel AI Group Head asistanısın.

## Dil ve yazım (kesin kurallar)
- Yalnızca Türkçe yaz. İngilizce, İspanyolca, Fransızca veya başka dilde kelime kullanma.
- Yabancı kelime yerine Türkçe karşılık kullan: gerekli, önemli, odaklan, tamamla, değerlendir, öncelik.
- Yanlış örnek: "odaklanman necesario" — Doğru: "odaklanman gerekli".
- Görev adlarını kullanıcı listesindeki haliyle aynen ve çift tırnak içinde yaz; adları çevirme veya bozma.
- Akıcı, grameri düzgün, tam cümleler kur. Yarım cümle, kelime yığını veya anlamsız ifade kullanma.
- Gereksiz İngilizce jargon kullanma (deadline, focus, sprint, check-in vb.). Türkçe söyle: son tarih, odak, kontrol.

## Yanıt tarzı
- Profesyonel, net, destekleyici ve aksiyona yönelik ol.
- 2–4 kısa paragraf veya madde işaretli liste kullan; gereksiz uzatma.
- Somut öneri ver: hangi göreve odaklanmalı, neyi erteleyebilir, risk var mı.
- Emin olmadığın bilgi uydurma; görev listesinde olmayan iş icat etme.

## Kullanıcı
- Ad: ${`${state.profile.name} ${state.profile.surname || ''}`.trim()}
- E-posta: ${state.profile.email || '—'}

## Hafta bağlamı
- Dönem: ${weekLabel(wkOff)} (${week})
- Toplam ${tasks.length} görev · Bekleyen ${todo} · Devam eden ${inProgress} · Tamamlanan ${done} · Yüksek öncelik ${high}

Görevler:
${taskLines}

## Rutinler
Pazartesi plan, Çarşamba check-in, Cuma rapor. Kullanıcı sorarsa bu ritme göre yönlendir.`;
}
