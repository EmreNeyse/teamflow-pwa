const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;

export function normalizeGroqKey(raw: string | undefined | null): string {
  return (raw ?? '')
    .replace(ZERO_WIDTH, '')
    .replace(/\s/g, '')
    .trim();
}

export function isGroqKeyFormat(key: string): boolean {
  return /^gsk_[A-Za-z0-9_]+$/.test(key) && key.length >= 20;
}

export class GroqApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'GroqApiError';
    this.status = status;
    this.code = code;
  }
}

interface AskAIOptions {
  temperature?: number;
  maxTokens?: number;
}

async function parseGroqError(response: Response): Promise<GroqApiError> {
  let message = `Groq API ${response.status}`;
  let code: string | undefined;

  try {
    const data = await response.json() as { error?: { message?: string; code?: string } };
    if (data.error?.message) message = data.error.message;
    code = data.error?.code;
  } catch {
    // ignore malformed error bodies
  }

  return new GroqApiError(message, response.status, code);
}

export async function verifyGroqKey(groqKey: string): Promise<void> {
  const key = normalizeGroqKey(groqKey);
  if (!key) throw new GroqApiError('API anahtarı boş', 0);
  if (!isGroqKeyFormat(key)) {
    throw new GroqApiError('Geçersiz format — Groq anahtarı gsk_ ile başlamalı', 0, 'invalid_format');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });

  if (!response.ok) {
    throw await parseGroqError(response);
  }
}

export async function askAI(
  system: string,
  userText: string,
  cfg: { groq?: string },
  options: AskAIOptions = {},
): Promise<string | null> {
  const groqKey = normalizeGroqKey(cfg.groq);
  if (!groqKey) return null;

  let response: Response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: options.temperature ?? 0.35,
        top_p: 0.9,
        max_tokens: options.maxTokens ?? 700,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userText },
        ],
      }),
    });
  } catch {
    throw new GroqApiError('Ağ hatası — internet bağlantını kontrol et', 0, 'network_error');
  }

  if (!response.ok) {
    throw await parseGroqError(response);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    return 'Yanıt alınamadı.';
  }

  return content.trim();
}

export function groqErrorMessage(error: unknown): string {
  if (error instanceof GroqApiError) {
    if (error.code === 'network_error' || error.status === 0) {
      return error.message;
    }
    if (error.status === 401 || error.code === 'invalid_api_key') {
      return 'Geçersiz Groq API anahtarı. Ayarlar\'dan anahtarı yeniden yapıştır ve kaydet.';
    }
    if (error.status === 429) {
      return 'Groq istek limiti aşıldı. Birkaç dakika sonra tekrar dene.';
    }
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Bağlantı hatası. Groq API anahtarını ve internet bağlantını kontrol et.';
}
