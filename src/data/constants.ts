export const AVATARS = [
  '🦸', '🦸‍♀️', '🦹', '🦹‍♀️', '🧙', '🧙‍♀️',
  '🧝', '🧝‍♀️', '🧛', '🧛‍♀️', '🧟', '🧟‍♀️',
] as const;

export const AI_PROMPTS = {
  plan: 'Bu haftanın planını çıkar. Görevlerimi öncelik ve son tarihe göre değerlendir; eksik varsa net Türkçe öneriler sun.',
  checkin: 'Çarşamba check-in yap. Devam eden görevlerimi değerlendir; hafta sonuna kadar tamamlanabilecek işleri Türkçe ve maddeli şekilde sırala.',
  report: 'Bu haftanın rapor özetini yaz. Tamamlanan, devam eden ve geciken görevleri düzgün Türkçe ile özetle; somut aksiyon öner.',
  focus: 'Bugün neye odaklanmalıyım? Görevlerimi öncelik ve son tarihe göre sırala; en kritik 3 görevi Türkçe ve net biçimde belirt.',
} as const;

export const STORAGE_KEYS = {
  registry: 'tf_registry',
  session: 'tf_session',
  userPrefix: 'tf_user_',
  legacy: 'tf_v2',
} as const;

export const ROUTINE_META = {
  monday_plan: {
    title: '📅 Pazartesi — Haftalık Plan',
    icon: '📅',
  },
  wednesday_checkin: {
    title: '📊 Çarşamba — Check-in',
    icon: '📊',
  },
  friday_report: {
    title: '📋 Cuma — Haftalık Rapor',
    icon: '📋',
  },
} as const;
