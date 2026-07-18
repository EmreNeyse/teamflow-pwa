import type { AppConfig } from '@/types';

interface AskAIOptions {
  temperature?: number;
  maxTokens?: number;
}

export async function askAI(
  system: string,
  userText: string,
  cfg: AppConfig,
  options: AskAIOptions = {},
): Promise<string | null> {
  const groqKey = cfg.groq?.trim();
  if (!groqKey) return null;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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

  if (!response.ok) {
    throw new Error(`Groq API ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    return 'Yanıt alınamadı.';
  }

  return content.trim();
}
