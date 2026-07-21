import { AI_PROMPTS } from '@/data/constants';
import { askAI, groqErrorMessage } from '@/lib/ai/client';
import { buildGroupHeadSystemPrompt } from '@/lib/ai/prompts';
import { sanitizeTurkishReply } from '@/lib/ai/sanitize';
import { tasksForWeek, weekLabel, normalizeWeekOffset } from '@/lib/tasks/week';
import { esc } from '@/lib/utils';
import { getState } from '@/app/state';

let messageCount = 0;

function buildDemoReply(userText: string): string {
  const state = getState();
  const wkOff = normalizeWeekOffset(state.wkOff);
  const tasks = tasksForWeek(state.tasks, wkOff);
  const done = tasks.filter((task) => task.status === 'done').length;
  const active = tasks.filter((task) => task.status !== 'done');
  const overdue = active.filter((task) => task.due && task.due < new Date().toISOString().slice(0, 10));
  const focusTasks = [...active]
    .sort((left, right) => {
      const prioWeight = { high: 0, medium: 1, low: 2 };
      return prioWeight[left.prio] - prioWeight[right.prio];
    })
    .slice(0, 3)
    .map((task) => `"${task.title}"`);

  const intro = `${weekLabel(wkOff)} için ${done}/${tasks.length || 0} görev tamamlandı.`;
  const focus = focusTasks.length
    ? `Öncelik sırası: ${focusTasks.join(', ')}.`
    : 'Bu hafta odaklanacak aktif görev görünmüyor.';
  const overdueNote = overdue.length
    ? `${overdue.length} geciken görev var; önce bunların bitiş tarihini netleştirmeni öneririm.`
    : 'Geciken görev bulunmuyor.';
  const apiNote = 'Daha detaylı ve kişisel yanıtlar için Ayarlar bölümünden Groq API anahtarı ekleyebilirsin.';

  if (/plan|rutin|pazartesi/i.test(userText)) {
    return sanitizeTurkishReply(`${intro} ${focus} ${overdueNote} Haftaya 3 net hedef koyup yüksek öncelikli işlerle başlamanı öneririm. ${apiNote}`);
  }

  if (/check|çarş|değerlendir/i.test(userText)) {
    return sanitizeTurkishReply(`${intro} ${focus} ${overdueNote} Hafta ortasında tamamlanabilir işleri kısa bir listeye indirip bugün en kritik olanı seç. ${apiNote}`);
  }

  if (/rapor|özet|cuma/i.test(userText)) {
    return sanitizeTurkishReply(`${intro} ${focus} ${overdueNote} Raporlar sekmesinden haftalık dashboard ve indirilebilir özeti kontrol edebilirsin. ${apiNote}`);
  }

  return sanitizeTurkishReply(`${intro} ${focus} ${overdueNote} ${apiNote}`);
}

export async function sendMsg(): Promise<void> {
  const input = document.getElementById('chatInp') as HTMLInputElement;
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  addMsg('user', text);
  const loadingId = addMsg('ai', '<div class="ldots"><span></span><span></span><span></span></div>');

  try {
    const state = getState();
    const reply = await askAI(buildGroupHeadSystemPrompt(state), text, state.cfg);
    if (!reply) {
      updateMsg(loadingId, buildDemoReply(text));
      return;
    }
    updateMsg(loadingId, sanitizeTurkishReply(reply));
  } catch (error) {
    updateMsg(loadingId, groqErrorMessage(error));
  }
}

export function aiTrig(key: keyof typeof AI_PROMPTS): void {
  closeChatSuggestions();
  const input = document.getElementById('chatInp') as HTMLInputElement;
  input.value = AI_PROMPTS[key];
  void sendMsg();
}

export function toggleChatSuggestions(event?: Event): void {
  event?.stopPropagation();
  const menu = document.getElementById('chatSuggestMenu');
  const fab = document.getElementById('chatSuggestFab');
  if (!menu || !fab) return;

  const opening = !menu.classList.contains('open');
  menu.classList.toggle('open', opening);
  fab.classList.toggle('open', opening);
  fab.setAttribute('aria-expanded', String(opening));
  const icon = fab.querySelector('.chat-suggest-fab-icon');
  if (icon) icon.textContent = opening ? 'close' : 'check';
  menu.setAttribute('aria-hidden', String(!opening));
}

export function closeChatSuggestions(): void {
  const menu = document.getElementById('chatSuggestMenu');
  const fab = document.getElementById('chatSuggestFab');
  if (!menu?.classList.contains('open')) return;

  menu.classList.remove('open');
  fab?.classList.remove('open');
  if (fab) {
    fab.setAttribute('aria-expanded', 'false');
    const icon = fab.querySelector('.chat-suggest-fab-icon');
    if (icon) icon.textContent = 'check';
  }
  menu.setAttribute('aria-hidden', 'true');
}

export function bindChatSuggestEvents(): void {
  document.addEventListener('click', (event) => {
    const menu = document.getElementById('chatSuggestMenu');
    if (!menu?.classList.contains('open')) return;

    const target = event.target as Node;
    const wrap = document.querySelector('.chat-suggest-fab-wrap');
    if (wrap?.contains(target)) return;

    closeChatSuggestions();
  });
}

function addMsg(role: 'user' | 'ai', content: string): string {
  const id = `m${++messageCount}`;
  const container = document.getElementById('chatMsgs');
  if (!container) return id;

  const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const avatar = role === 'user'
    ? (document.getElementById('navAv')?.textContent ?? '🦸')
    : '🤖';

  const bubble = role === 'user' ? esc(content) : content;

  container.insertAdjacentHTML('beforeend', `
    <div class="chat-msg ${role}" id="${id}">
      <div class="msg-av">${avatar}</div>
      <div>
        <div class="msg-bubble">${bubble}</div>
        <div class="msg-time">${now}</div>
      </div>
    </div>
  `);
  container.scrollTop = container.scrollHeight;
  return id;
}

function updateMsg(id: string, text: string): void {
  const element = document.getElementById(id);
  const bubble = element?.querySelector('.msg-bubble');
  if (bubble) bubble.innerHTML = esc(text).replace(/\n/g, '<br>');
}
