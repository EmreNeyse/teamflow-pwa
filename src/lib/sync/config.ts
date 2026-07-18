export function isCloudSyncAvailable(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key);
}

export function getCloudSyncStatusMessage(): string {
  if (isCloudSyncAvailable()) {
    return 'Bulut senkronu hazır. E-posta ve bulut şifrenle cihazlar arası eşitleme yapabilirsin.';
  }
  return 'Bulut senkronu yapılandırılmamış. VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlanmalı.';
}
