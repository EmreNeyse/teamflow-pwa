let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(message: string, type: '' | 'ok' | 'err' = ''): void {
  const element = document.getElementById('toast');
  if (!element) return;
  element.textContent = message;
  element.className = `toast show${type ? ` ${type}` : ''}`;
  clearTimeout(timer);
  timer = setTimeout(() => element.classList.remove('show'), 3000);
}
