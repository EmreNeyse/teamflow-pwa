import { AVATARS } from '@/data/constants';
import { normalizeGroqKey, isGroqKeyFormat, verifyGroqKey, groqErrorMessage } from '@/lib/ai/client';
import { downloadUserBackup, importUserBackup } from '@/lib/storage/backup';
import {
  deleteUser,
  getRegistry,
  resetAllData,
} from '@/lib/storage/user-storage';
import { getCurrentUserId, getState, openUserSession, patchState } from '@/app/state';
import { toast } from '@/app/toast';
import { renderCloudSyncSettings } from '@/app/features/cloud-sync';
import { renderInstallSettings } from '@/lib/pwa/install';
import { renderDevicePairingSettings } from '@/app/features/device-pairing';
import { goSetup } from '@/app/features/setup';
import { buildLogin } from '@/app/features/login';
import { closeModal } from '@/app/features/tasks';
import { enterApp } from '@/app/features/shell';

export function renderSettings(): void {
  const state = getState();
  const profile = state.profile;

  (document.getElementById('sProfile') as HTMLElement).innerHTML = `
    <div class="s-row"><span class="s-key">Avatar</span><span class="s-val" style="font-size:22px">${AVATARS[profile.avatarIdx] ?? AVATARS[0]}</span></div>
    <div class="s-row"><span class="s-key">Ad Soyad</span><span class="s-val">${profile.name} ${profile.surname || ''}</span></div>
    <div class="s-row"><span class="s-key">Kullanıcı ID</span><span class="s-val" style="font-size:11px">${profile.id}</span></div>
  `;

  const ok = '<span class="ok">✓ Bağlı</span>';
  const no = '<span class="no">✗ Ayarlanmamış</span>';
  (document.getElementById('s-grq') as HTMLElement).innerHTML = state.cfg?.groq ? ok : no;
  (document.getElementById('setGroq') as HTMLInputElement).value = state.cfg?.groq ?? '';

  const pinView = document.getElementById('settingsPinView') as HTMLInputElement | null;
  if (pinView) {
    pinView.value = profile.pin;
    pinView.type = 'password';
  }

  resetSecretToggles(document.getElementById('tc-settings'));
  renderInstallSettings();
  renderDevicePairingSettings();
  renderCloudSyncSettings();
}

export function toggleSecret(inputId: string, button: HTMLElement): void {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  if (!input) return;

  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  button.classList.toggle('is-visible', visible);
  button.setAttribute('aria-label', visible ? 'Gizle' : 'Göster');
}

function resetSecretToggles(root: ParentNode | null): void {
  root?.querySelectorAll('.secret-toggle.is-visible').forEach((button) => {
    button.classList.remove('is-visible');
    button.setAttribute('aria-label', 'Göster');
  });
  root?.querySelectorAll('.input-secret-wrap input').forEach((input) => {
    (input as HTMLInputElement).type = 'password';
  });
}

export async function saveGroqKey(): Promise<void> {
  const raw = (document.getElementById('setGroq') as HTMLInputElement).value;
  const groqKey = normalizeGroqKey(raw);

  if (groqKey && !isGroqKeyFormat(groqKey)) {
    toast('Geçersiz format — Groq anahtarı gsk_ ile başlamalı', 'err');
    return;
  }

  patchState((state) => ({
    ...state,
    cfg: { ...state.cfg, groq: groqKey || undefined },
  }));
  renderSettings();

  if (!groqKey) {
    toast('Groq API key kaldırıldı');
    return;
  }

  try {
    await verifyGroqKey(groqKey);
    toast('Groq API key kaydedildi ve doğrulandı ✓', 'ok');
  } catch (error) {
    toast(groqErrorMessage(error), 'err');
  }
}

export async function testGroqKey(): Promise<void> {
  const saved = normalizeGroqKey(getState().cfg?.groq);
  const draft = normalizeGroqKey((document.getElementById('setGroq') as HTMLInputElement).value);
  const groqKey = draft || saved;

  if (!groqKey) {
    toast('Önce Groq API key gir', 'err');
    return;
  }

  if (!isGroqKeyFormat(groqKey)) {
    toast('Geçersiz format — Groq anahtarı gsk_ ile başlamalı', 'err');
    return;
  }

  try {
    await verifyGroqKey(groqKey);
    toast('Groq bağlantısı çalışıyor ✓', 'ok');
  } catch (error) {
    toast(groqErrorMessage(error), 'err');
  }
}

export function exportAccountBackup(): void {
  const userId = getCurrentUserId();
  if (!userId) return;

  const profile = getState().profile;
  const displayName = `${profile.name}${profile.surname ? `_${profile.surname}` : ''}`;
  if (!downloadUserBackup(userId, displayName)) {
    toast('Yedek oluşturulamadı', 'err');
    return;
  }

  toast('Yedek dosyası indirildi ✓', 'ok');
}

export function triggerImportBackup(): void {
  (document.getElementById('backupImportInput') as HTMLInputElement | null)?.click();
}

export function handleImportBackupFile(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const userId = importUserBackup(parsed);
      openUserSession(userId);
      toast('Yedek içe aktarıldı ✓', 'ok');
      enterApp();
    } catch {
      toast('Yedek dosyası okunamadı veya geçersiz', 'err');
    } finally {
      input.value = '';
    }
  };
  reader.onerror = () => {
    toast('Yedek dosyası okunamadı', 'err');
    input.value = '';
  };
  reader.readAsText(file);
}

export function hardReset(): void {
  if (!confirm('Tüm hesaplar ve veriler silinecek, emin misin?')) return;
  resetAllData();
  location.reload();
}

export function deleteAccount(): void {
  const userId = getCurrentUserId();
  if (!userId) return;
  if (!confirm('Bu hesabı silmek istediğine emin misin?')) return;
  deleteUser(userId);
  const registry = getRegistry();
  buildLogin(registry.lastUserId ?? registry.users[0]?.id ?? null);
  toast('Hesap silindi');
  location.reload();
}

export function closePinModal(): void {
  closeModal('pinModal');
  (document.getElementById('pinOld') as HTMLInputElement).value = '';
  (document.getElementById('pinNew') as HTMLInputElement).value = '';
  (document.getElementById('pinNew2') as HTMLInputElement).value = '';
  (document.getElementById('pinModalErr') as HTMLElement).textContent = '';
  resetSecretToggles(document.getElementById('pinModal'));
}

export function changePin(): void {
  const oldPin = (document.getElementById('pinOld') as HTMLInputElement).value.trim();
  const newPin = (document.getElementById('pinNew') as HTMLInputElement).value.trim();
  const confirmPin = (document.getElementById('pinNew2') as HTMLInputElement).value.trim();
  const error = document.getElementById('pinModalErr');
  if (!error) return;
  error.textContent = '';

  const profile = getState().profile;
  if (oldPin !== profile.pin) {
    error.textContent = 'Mevcut PIN hatalı.';
    return;
  }
  if (!/^\d{4}$/.test(newPin)) {
    error.textContent = 'Yeni PIN 4 haneli sayı olmalı.';
    return;
  }
  if (newPin !== confirmPin) {
    error.textContent = 'Yeni PIN\'ler eşleşmiyor.';
    return;
  }
  if (newPin === oldPin) {
    error.textContent = 'Yeni PIN eskiyle aynı olamaz.';
    return;
  }

  patchState((state) => ({
    ...state,
    profile: { ...state.profile, pin: newPin },
  }));

  closePinModal();
  renderSettings();
  toast('PIN başarıyla değiştirildi ✓', 'ok');
}

export { goSetup };
