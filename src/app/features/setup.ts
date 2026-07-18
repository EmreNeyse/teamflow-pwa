import { AVATARS } from '@/data/constants';
import type { UserProfile } from '@/types';
import {
  createUser,
  findUserByNameAndPin,
  getRegistry,
  loadUserData,
  saveUserData,
  updateUserProfile,
} from '@/lib/storage/user-storage';
import { buildLogin } from '@/app/features/login';
import { renderCloudSyncLogin } from '@/app/features/cloud-sync';
import { showScreen } from '@/lib/utils';
import { closeUserSession, getCurrentUserId, openUserSession } from '@/app/state';
import { toast } from '@/app/toast';

let selectedAvatar = 0;
let editingUserId: string | null = null;

export function buildSetup(): void {
  editingUserId = getCurrentUserId();
  const existing = editingUserId ? loadUserData(editingUserId) : null;
  selectedAvatar = existing?.profile.avatarIdx ?? 0;

  const grid = document.getElementById('avGrid');
  if (!grid) return;
  grid.innerHTML = '';

  AVATARS.forEach((avatar, index) => {
    const button = document.createElement('button');
    button.className = `av-btn${index === selectedAvatar ? ' sel' : ''}`;
    button.textContent = avatar;
    button.onclick = () => {
      selectedAvatar = index;
      grid.querySelectorAll('.av-btn').forEach((item, idx) => {
        item.classList.toggle('sel', idx === index);
      });
    };
    grid.appendChild(button);
  });

  const profile = existing?.profile;
  (document.getElementById('sName') as HTMLInputElement).value = profile?.name ?? '';
  (document.getElementById('sSurname') as HTMLInputElement).value = profile?.surname ?? '';
  (document.getElementById('sPin') as HTMLInputElement).value = '';
  (document.getElementById('sGroq') as HTMLInputElement).value = existing?.cfg?.groq ?? '';

  const title = document.getElementById('setupTitle');
  if (title) title.textContent = editingUserId ? 'Profili Düzenle' : 'Yeni Hesap Oluştur';
  renderCloudSyncLogin();
}

export function finishSetup(): void {
  const name = (document.getElementById('sName') as HTMLInputElement).value.trim();
  const pin = (document.getElementById('sPin') as HTMLInputElement).value.trim();
  const profileInput = {
    name,
    surname: (document.getElementById('sSurname') as HTMLInputElement).value.trim(),
    email: editingUserId ? (loadUserData(editingUserId)?.profile.email ?? '') : '',
    pin,
    avatarIdx: selectedAvatar,
  };

  if (!name) {
    toast('Ad gerekli', 'err');
    return;
  }
  if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
    toast('4 haneli sayısal PIN gerekli', 'err');
    return;
  }

  const groqKey = (document.getElementById('sGroq') as HTMLInputElement).value.trim();
  const cfg = {
    ...(editingUserId ? (loadUserData(editingUserId)?.cfg ?? {}) : {}),
    groq: groqKey,
  };

  if (editingUserId) {
    const updated = updateUserProfile(editingUserId, profileInput as Omit<UserProfile, 'id'>);
    updated.cfg = cfg;
    saveUserData(editingUserId, updated);
    openUserSession(editingUserId);
    toast('Profil güncellendi ✓', 'ok');
    void import('@/app/features/shell').then(({ enterApp }) => enterApp());
    return;
  }

  const existingUserId = findUserByNameAndPin(name, pin);
  if (existingUserId) {
    toast('Bu hesap bu cihazda zaten kayıtlı. Giriş ekranından devam et.', 'ok');
    buildLogin(existingUserId);
    showScreen('loginScreen');
    return;
  }

  const created = createUser(profileInput as Omit<UserProfile, 'id'>);
  created.cfg = cfg;
  saveUserData(created.profile.id, created);
  openUserSession(created.profile.id);
  toast('Hesap oluşturuldu ✓', 'ok');
  buildLogin(created.profile.id);
  showScreen('loginScreen');
}

export function goSetup(fromApp = false): void {
  if (fromApp) closeUserSession();
  buildSetup();
  showScreen('setupScreen');
}

export function startNewAccount(): void {
  goSetup(true);
}

export function goLogin(): void {
  const registry = getRegistry();
  buildLogin(registry.lastUserId ?? registry.users[0]?.id ?? null);
  showScreen('loginScreen');
}
