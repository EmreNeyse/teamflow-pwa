import { STORAGE_KEYS } from '@/data/constants';
import type {
  LegacyState,
  SessionState,
  UserData,
  UserProfile,
  UserRegistry,
  UserSummary,
} from '@/types';
import { syncDemoTasksForUser } from '@/lib/tasks/demo-sync';
import { uid } from '@/lib/utils';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function userKey(userId: string): string {
  return `${STORAGE_KEYS.userPrefix}${userId}`;
}

function emptyUserData(profile: UserProfile): UserData {
  return {
    profile,
    cfg: {},
    tasks: [],
    reports: [],
    notifications: [],
    routineFlags: {},
    wkOff: 0,
    filter: 'all',
    darkMode: true,
    ready: true,
  };
}

function toSummary(profile: UserProfile): UserSummary {
  return {
    id: profile.id,
    name: profile.name,
    surname: profile.surname,
    email: profile.email,
    avatarIdx: profile.avatarIdx,
  };
}

function migrateLegacyIfNeeded(): void {
  const legacyRaw = localStorage.getItem(STORAGE_KEYS.legacy);
  if (!legacyRaw) return;

  try {
    const legacy = JSON.parse(legacyRaw) as LegacyState;
    if (!legacy.ready || !legacy.profile) return;

    const userId = uid('u');
    const profile: UserProfile = {
      id: userId,
      name: legacy.profile.name,
      surname: legacy.profile.surname ?? '',
      email: legacy.profile.email ?? '',
      pin: legacy.profile.pin,
      avatarIdx: legacy.profile.avatarIdx ?? 0,
    };

    const data: UserData = {
      profile,
      cfg: legacy.cfg ?? {},
      tasks: legacy.tasks ?? [],
      reports: legacy.reports ?? [],
      notifications: [],
      routineFlags: {},
      wkOff: legacy.wkOff ?? 0,
      filter: legacy.filter ?? 'all',
      darkMode: legacy.darkMode ?? true,
      ready: true,
    };

    writeJson(userKey(userId), data);
    writeJson(STORAGE_KEYS.registry, {
      users: [toSummary(profile)],
      lastUserId: userId,
    } satisfies UserRegistry);
    localStorage.removeItem(STORAGE_KEYS.legacy);
  } catch {
    // ignore broken legacy payloads
  }
}

export function initStorage(): void {
  migrateLegacyIfNeeded();
}

export function getRegistry(): UserRegistry {
  return readJson<UserRegistry>(STORAGE_KEYS.registry, { users: [] });
}

export function saveRegistry(registry: UserRegistry): void {
  writeJson(STORAGE_KEYS.registry, registry);
}

export function getSession(): SessionState | null {
  return readJson<SessionState | null>(STORAGE_KEYS.session, null);
}

export function setSession(userId: string | null): void {
  if (!userId) {
    localStorage.removeItem(STORAGE_KEYS.session);
    return;
  }
  writeJson(STORAGE_KEYS.session, { userId } satisfies SessionState);
}

export function loadUserData(userId: string): UserData | null {
  return readJson<UserData | null>(userKey(userId), null);
}

export function saveUserData(userId: string, data: UserData): UserData {
  const synced = syncDemoTasksForUser(data);
  writeJson(userKey(userId), synced);
  const registry = getRegistry();
  const summary = toSummary(synced.profile);
  const index = registry.users.findIndex((user) => user.id === userId);
  if (index >= 0) registry.users[index] = summary;
  else registry.users.push(summary);
  registry.lastUserId = userId;
  saveRegistry(registry);
  return synced;
}

export function findUserByNameAndPin(name: string, pin: string): string | null {
  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName || !/^\d{4}$/.test(pin)) return null;

  for (const summary of getRegistry().users) {
    const data = loadUserData(summary.id);
    if (!data) continue;
    if (
      data.profile.name.trim().toLowerCase() === normalizedName
      && data.profile.pin === pin
    ) {
      return summary.id;
    }
  }

  return null;
}

export function createUser(profileInput: Omit<UserProfile, 'id'>): UserData {
  const profile: UserProfile = { ...profileInput, id: uid('u') };
  const data = emptyUserData(profile);
  return saveUserData(profile.id, data);
}

export function updateUserProfile(userId: string, profileInput: Omit<UserProfile, 'id'>): UserData {
  const existing = loadUserData(userId);
  if (!existing) throw new Error('Kullanıcı bulunamadı');

  const profile: UserProfile = { ...profileInput, id: userId };
  return saveUserData(userId, { ...existing, profile, ready: true });
}

export function deleteUser(userId: string): void {
  localStorage.removeItem(userKey(userId));
  const registry = getRegistry();
  registry.users = registry.users.filter((user) => user.id !== userId);
  if (registry.lastUserId === userId) {
    registry.lastUserId = registry.users[0]?.id;
  }
  saveRegistry(registry);

  const session = getSession();
  if (session?.userId === userId) setSession(null);
}

export function resetAllData(): void {
  const registry = getRegistry();
  registry.users.forEach((user) => localStorage.removeItem(userKey(user.id)));
  localStorage.removeItem(STORAGE_KEYS.registry);
  localStorage.removeItem(STORAGE_KEYS.session);
  localStorage.removeItem(STORAGE_KEYS.legacy);
}

