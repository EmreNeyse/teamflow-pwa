import type { UserData } from '@/types';
import { loadUserData, saveUserData, setSession } from '@/lib/storage/user-storage';

export const BACKUP_VERSION = 1 as const;

export interface UserBackupFile {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  app: 'teamflow-pwa';
  user: UserData;
}

export function createUserBackup(userId: string): UserBackupFile | null {
  const data = loadUserData(userId);
  if (!data) return null;

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'teamflow-pwa',
    user: data,
  };
}

export function downloadUserBackup(userId: string, displayName: string): boolean {
  const backup = createUserBackup(userId);
  if (!backup) return false;

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = displayName.replace(/[^\w\-]+/g, '_').slice(0, 24) || 'hesap';

  link.href = url;
  link.download = `teamflow-yedek-${safeName}-${backup.exportedAt.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

function isValidBackup(value: unknown): value is UserBackupFile {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as UserBackupFile;
  return (
    candidate.app === 'teamflow-pwa'
    && candidate.version === BACKUP_VERSION
    && !!candidate.user?.profile?.id
    && !!candidate.user?.profile?.pin
    && Array.isArray(candidate.user.tasks)
    && Array.isArray(candidate.user.reports)
  );
}

export function importUserBackup(raw: unknown): string {
  if (!isValidBackup(raw)) {
    throw new Error('Geçersiz yedek dosyası');
  }

  const userId = raw.user.profile.id;
  saveUserData(userId, raw.user);
  setSession(userId);
  return userId;
}
