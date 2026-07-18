export function esc(value: string | undefined | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function showScreen(id: string): void {
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.remove('active');
  });
  document.getElementById(id)?.classList.add('active');
}
