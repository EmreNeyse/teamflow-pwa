let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(message: string, type: '' | 'ok' | 'err' = ''): void {
  const element = document.getElementById('toast');
  if (!element) return;
  element.textContent = message;
  element.className = `toast show${type ? ` ${type}` : ''}`;
  clearTimeout(timer);
  timer = setTimeout(() => element.classList.remove('show'), 3000);
}

/** Eylem butonlu bildirim (ör. "Geri Al"). Buton tıklanınca bildirim kapanır. */
export function toastAction(message: string, actionLabel: string, onAction: () => void, duration = 6000): void {
  const element = document.getElementById('toast');
  if (!element) return;

  element.textContent = '';
  const text = document.createElement('span');
  text.className = 'toast-text';
  text.textContent = message;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'toast-action';
  button.textContent = actionLabel;
  button.addEventListener('click', () => {
    clearTimeout(timer);
    element.classList.remove('show', 'has-action');
    onAction();
  }, { once: true });
  element.append(text, button);

  element.className = 'toast show has-action';
  clearTimeout(timer);
  timer = setTimeout(() => element.classList.remove('show', 'has-action'), duration);
}
