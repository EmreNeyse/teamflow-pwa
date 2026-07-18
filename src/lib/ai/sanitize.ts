const FOREIGN_WORD_FIXES: Record<string, string> = {
  necesario: 'gerekli',
  importante: 'önemli',
  prioritario: 'öncelikli',
  urgente: 'acil',
  posible: 'mümkün',
  recomiendo: 'öneriyorum',
  recomendado: 'önerilir',
  focus: 'odak',
  deadline: 'son tarih',
  sprint: 'sprint',
  checkin: 'kontrol',
  'check-in': 'kontrol',
  asap: 'en kısa sürede',
  ok: 'tamam',
  priority: 'öncelik',
  task: 'görev',
  tasks: 'görevler',
  important: 'önemli',
  necessary: 'gerekli',
  should: 'gerekir',
  must: 'gerekir',
  please: 'lütfen',
  reminder: 'hatırlatma',
  update: 'güncelleme',
  pending: 'bekleyen',
  completed: 'tamamlanan',
  progress: 'ilerleme',
  review: 'değerlendir',
  evaluate: 'değerlendir',
};

const FOREIGN_WORD_PATTERN = new RegExp(
  `\\b(${Object.keys(FOREIGN_WORD_FIXES).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'gi',
);

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function fixForeignWords(text: string): string {
  return text.replace(FOREIGN_WORD_PATTERN, (match) => {
    const key = match.toLowerCase();
    const replacement = FOREIGN_WORD_FIXES[key];
    if (!replacement) return match;
    if (match === match.toUpperCase()) return replacement.toUpperCase();
    if (match[0] === match[0]?.toUpperCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  });
}

function fixBrokenTurkishPatterns(text: string): string {
  return text
    .replace(/\b(man|lan)\s+(necesario|gerekli|importante|önemli)\b/gi, 'gerekli')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([^\n])\s-\s/g, '$1 — ');
}

export function sanitizeTurkishReply(text: string): string {
  if (!text.trim()) return 'Şu an net bir yanıt oluşturamadım. Sorunu biraz daha açık yazar mısın?';

  const cleaned = fixBrokenTurkishPatterns(fixForeignWords(normalizeWhitespace(text)));
  return cleaned || 'Şu an net bir yanıt oluşturamadım. Sorunu biraz daha açık yazar mısın?';
}
