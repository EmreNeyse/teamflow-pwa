import { getSupabase } from '@/lib/sync/supabase-client';
import { isCloudSyncAvailable } from '@/lib/sync/config';
import { saveUserData } from '@/lib/storage/user-storage';
import { normalizeGroqKey } from '@/lib/ai/client';
import type { CloudSyncConfig, UserData } from '@/types';

export const CLOUD_PAYLOAD_VERSION = 1 as const;

export interface CloudPayload {
  version: typeof CLOUD_PAYLOAD_VERSION;
  localUpdatedAt: string;
  user: UserData;
}

export type CloudSyncResult = 'pushed' | 'pulled' | 'unchanged' | 'skipped' | 'session_expired' | 'error';

let pushTimer: number | null = null;
let pushInFlight = false;

function nowIso(): string {
  return new Date().toISOString();
}

function getCloudConfig(data: UserData): CloudSyncConfig | undefined {
  return data.cfg.cloud;
}

export function touchCloudRevision(data: UserData): UserData {
  const cloud = getCloudConfig(data);
  if (!cloud?.enabled) return data;

  return {
    ...data,
    cfg: {
      ...data.cfg,
      cloud: {
        ...cloud,
        localUpdatedAt: nowIso(),
      },
    },
  };
}

function buildPayload(data: UserData): CloudPayload {
  const stamped = touchCloudRevision(data);
  return {
    version: CLOUD_PAYLOAD_VERSION,
    localUpdatedAt: stamped.cfg.cloud?.localUpdatedAt ?? nowIso(),
    user: stamped,
  };
}

function isCloudPayload(value: unknown): value is CloudPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as CloudPayload;
  return (
    payload.version === CLOUD_PAYLOAD_VERSION
    && typeof payload.localUpdatedAt === 'string'
    && !!payload.user?.profile?.id
    && Array.isArray(payload.user.tasks)
  );
}

export async function getCloudSessionEmail(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  return data.session?.user.email ?? null;
}

export async function signUpCloudAccount(email: string, password: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Bulut senkronu yapılandırılmamış');

  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
  });
  if (error) throw new Error(error.message);
}

export async function signInCloudAccount(email: string, password: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Bulut senkronu yapılandırılmamış');

  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error) throw new Error(error.message);
}

export async function signOutCloudAccount(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}

async function fetchCloudPayload(): Promise<{ payload: CloudPayload; updatedAt: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;

  const { data, error } = await supabase
    .from('user_data')
    .select('payload, updated_at')
    .eq('user_id', sessionData.session.user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.payload || !isCloudPayload(data.payload)) return null;

  return {
    payload: data.payload,
    updatedAt: data.updated_at ?? data.payload.localUpdatedAt,
  };
}

export async function pushUserDataToCloud(data: UserData): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Bulut senkronu yapılandırılmamış');

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error('Bulut oturumu açık değil');

  const payload = buildPayload(data);
  const syncedAt = nowIso();
  const cloudConfig: CloudSyncConfig = {
    enabled: true,
    email: session.user.email ?? data.cfg.cloud?.email ?? '',
    localUpdatedAt: payload.localUpdatedAt,
    lastSyncedAt: syncedAt,
    lastPushedAt: syncedAt,
    lastPulledAt: data.cfg.cloud?.lastPulledAt,
  };

  payload.user = {
    ...payload.user,
    cfg: {
      ...payload.user.cfg,
      cloud: cloudConfig,
    },
  };

  const { error } = await supabase.from('user_data').upsert({
    user_id: session.user.id,
    payload,
    updated_at: syncedAt,
  });

  if (error) throw new Error(error.message);
}

export function applyCloudPayload(
  payload: CloudPayload,
  sessionEmail: string,
  localCfg?: UserData['cfg'],
): UserData {
  const remoteCfg = payload.user.cfg ?? {};
  const syncedAt = nowIso();
  const merged: UserData = {
    ...payload.user,
    cfg: {
      ...remoteCfg,
      groq: normalizeGroqKey(remoteCfg.groq) || normalizeGroqKey(localCfg?.groq) || undefined,
      cloud: {
        enabled: true,
        email: sessionEmail,
        localUpdatedAt: payload.localUpdatedAt,
        lastSyncedAt: syncedAt,
        lastPulledAt: syncedAt,
        lastPushedAt: payload.user.cfg.cloud?.lastPushedAt,
      },
    },
  };

  return saveUserData(merged.profile.id, merged);
}

export async function pullUserDataFromCloud(): Promise<UserData | null> {
  const remote = await fetchCloudPayload();
  if (!remote) return null;

  const email = (await getCloudSessionEmail()) ?? remote.payload.user.cfg.cloud?.email ?? '';
  return applyCloudPayload(remote.payload, email);
}

export async function syncUserDataWithCloud(localData: UserData): Promise<CloudSyncResult> {
  if (!isCloudSyncAvailable()) return 'skipped';

  const cloud = getCloudConfig(localData);
  if (!cloud?.enabled) return 'skipped';

  const supabase = getSupabase();
  if (!supabase) return 'skipped';

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return 'session_expired';

  try {
    const remote = await fetchCloudPayload();
    const localUpdatedAt = cloud.localUpdatedAt ?? '';

    if (!remote) {
      await pushUserDataToCloud(localData);
      return 'pushed';
    }

    const remoteUpdatedAt = remote.payload.localUpdatedAt || remote.updatedAt;
    if (remoteUpdatedAt > localUpdatedAt) {
      applyCloudPayload(
        remote.payload,
        sessionData.session.user.email ?? cloud.email,
        localData.cfg,
      );
      return 'pulled';
    }

    if (localUpdatedAt > remoteUpdatedAt) {
      await pushUserDataToCloud(localData);
      return 'pushed';
    }

    return 'unchanged';
  } catch {
    return 'error';
  }
}

export function scheduleCloudPush(data: UserData): void {
  if (!isCloudSyncAvailable()) return;
  if (!data.cfg.cloud?.enabled) return;

  if (pushTimer) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    void flushCloudPush();
  }, 1800);
}

async function flushCloudPush(): Promise<void> {
  if (pushInFlight) return;
  pushInFlight = true;

  try {
    const { getState } = await import('@/app/state');
    await pushUserDataToCloud(getState());
  } catch (error) {
    console.warn('Cloud push failed', error);
  } finally {
    pushInFlight = false;
  }
}

export async function restoreFromCloudAccount(email: string, password: string): Promise<UserData> {
  await signInCloudAccount(email, password);
  const pulled = await pullUserDataFromCloud();
  if (!pulled) throw new Error('Bulutta kayıtlı veri bulunamadı');
  return pulled;
}

export async function enableCloudSyncForCurrentUser(
  email: string,
  password: string,
  mode: 'signup' | 'signin',
): Promise<UserData> {
  if (mode === 'signup') {
    await signUpCloudAccount(email, password);
  } else {
    await signInCloudAccount(email, password);
  }

  const sessionEmail = await getCloudSessionEmail();
  if (!sessionEmail) {
    throw new Error('Bulut oturumu açılamadı. E-posta doğrulaması gerekebilir.');
  }

  const { getState } = await import('@/app/state');
  const local = getState();
  const stamped = touchCloudRevision({
    ...local,
    cfg: {
      ...local.cfg,
      cloud: {
        enabled: true,
        email: sessionEmail,
        localUpdatedAt: nowIso(),
      },
    },
  });

  await pushUserDataToCloud(stamped);
  return saveUserData(stamped.profile.id, {
    ...stamped,
    cfg: {
      ...stamped.cfg,
      cloud: {
        ...stamped.cfg.cloud!,
        lastSyncedAt: nowIso(),
        lastPushedAt: nowIso(),
      },
    },
  });
}

export async function disableCloudSyncForCurrentUser(): Promise<void> {
  await signOutCloudAccount();
  const { patchState } = await import('@/app/state');
  patchState((local) => ({
    ...local,
    cfg: {
      ...local.cfg,
      cloud: {
        enabled: false,
        email: local.cfg.cloud?.email ?? '',
        lastSyncedAt: local.cfg.cloud?.lastSyncedAt,
        lastPulledAt: local.cfg.cloud?.lastPulledAt,
        lastPushedAt: local.cfg.cloud?.lastPushedAt,
        localUpdatedAt: local.cfg.cloud?.localUpdatedAt,
      },
    },
  }));
}

export async function runCloudSyncOnAppEnter(): Promise<CloudSyncResult> {
  const { getCurrentUserId, getState, openUserSession } = await import('@/app/state');
  const userId = getCurrentUserId();
  if (!userId) return 'skipped';

  const result = await syncUserDataWithCloud(getState());
  if (result === 'pulled') {
    openUserSession(userId);
  }
  return result;
}
