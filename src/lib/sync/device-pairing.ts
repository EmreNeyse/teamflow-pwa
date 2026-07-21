import { createUserBackup, type UserBackupFile } from '@/lib/storage/backup';
import { isCloudSyncAvailable } from '@/lib/sync/config';
import { getSupabase } from '@/lib/sync/supabase-client';

export const PAIRING_TTL_MS = 5 * 60 * 1000;

export interface PairingSession {
  token: string;
  url: string;
  expiresAt: Date;
}

function generatePairingToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function buildPairingUrl(token: string): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('pair', token);
  return url.toString();
}

export function extractPairingToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get('pair');
    if (fromQuery && /^[a-f0-9]{32}$/.test(fromQuery)) return fromQuery;
  } catch {
    // not a URL — fall through
  }

  if (/^[a-f0-9]{32}$/.test(trimmed)) return trimmed;
  return null;
}

function isValidPairingPayload(value: unknown): value is UserBackupFile {
  if (!value || typeof value !== 'object') return false;
  const payload = value as UserBackupFile;
  return (
    payload.app === 'teamflow-pwa'
    && payload.version === 1
    && !!payload.user?.profile?.id
    && Array.isArray(payload.user.tasks)
  );
}

export async function createPairingSession(userId: string): Promise<PairingSession> {
  if (!isCloudSyncAvailable()) {
    throw new Error('QR eşleştirme için Supabase yapılandırması gerekli (.env veya GitHub Secrets)');
  }

  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase istemcisi başlatılamadı');

  const backup = createUserBackup(userId);
  if (!backup) throw new Error('Hesap verisi bulunamadı');

  const token = generatePairingToken();
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);

  const { error } = await supabase.from('device_pairings').insert({
    token,
    payload: backup,
    expires_at: expiresAt.toISOString(),
  });

  if (error) throw new Error(error.message);

  return {
    token,
    url: buildPairingUrl(token),
    expiresAt,
  };
}

export async function fetchPairingSession(token: string): Promise<UserBackupFile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('device_pairings')
    .select('payload, expires_at, consumed_at')
    .eq('token', token)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.consumed_at) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  if (!isValidPairingPayload(data.payload)) return null;

  return data.payload;
}

export async function markPairingConsumed(token: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  await supabase
    .from('device_pairings')
    .update({ consumed_at: new Date().toISOString() })
    .eq('token', token);
}

export async function waitForPairingConsumed(
  token: string,
  timeoutMs = PAIRING_TTL_MS,
  intervalMs = 2000,
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await supabase
      .from('device_pairings')
      .select('consumed_at')
      .eq('token', token)
      .maybeSingle();

    if (data?.consumed_at) return true;
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }

  return false;
}

export function getPairingStatusMessage(): string {
  if (!isCloudSyncAvailable()) {
    return 'QR eşleştirme için VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlanmalı. supabase/pairing.sql şemasını da çalıştır.';
  }
  return 'Masaüstünde QR göster, telefonda tara — hesabın ve görevlerin tek seferde aktarılır (5 dk geçerli).';
}
