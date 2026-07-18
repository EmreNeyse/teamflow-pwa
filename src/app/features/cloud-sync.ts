import { isCloudSyncAvailable, getCloudSyncStatusMessage } from '@/lib/sync/config';
import {
  disableCloudSyncForCurrentUser,
  enableCloudSyncForCurrentUser,
  getCloudSessionEmail,
  pullUserDataFromCloud,
  pushUserDataToCloud,
  restoreFromCloudAccount,
  runCloudSyncOnAppEnter,
  syncUserDataWithCloud,
} from '@/lib/sync/cloud-sync';
import { esc } from '@/lib/utils';
import { getCurrentUserId, getState, openUserSession } from '@/app/state';
import { enterApp } from '@/app/features/shell';
import { renderReports } from '@/app/features/reports';
import { renderSettings } from '@/app/features/settings';
import { renderTasks } from '@/app/features/tasks';
import { toast } from '@/app/toast';

function readCloudCredentials(prefix = 'cloud'): { email: string; password: string } {
  const email = (document.getElementById(`${prefix}Email`) as HTMLInputElement | null)?.value.trim() ?? '';
  const password = (document.getElementById(`${prefix}Password`) as HTMLInputElement | null)?.value ?? '';
  return { email, password };
}

function validateCloudCredentials(email: string, password: string): string | null {
  if (!isCloudSyncAvailable()) return 'Bulut senkronu yapılandırılmamış';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Geçerli bir e-posta gir';
  if (password.length < 6) return 'Bulut şifresi en az 6 karakter olmalı';
  return null;
}

function refreshCloudPanels(): void {
  renderCloudSyncSettings();
  renderCloudSyncLogin();
}

export function renderCloudSyncSettings(): void {
  const statusEl = document.getElementById('cloudSyncStatus');
  const metaEl = document.getElementById('cloudSyncMeta');
  const actionsEl = document.getElementById('cloudSyncActions');
  if (!statusEl || !metaEl || !actionsEl) return;

  if (!isCloudSyncAvailable()) {
    statusEl.innerHTML = `<span class="no">Yapılandırma gerekli</span>`;
    metaEl.textContent = getCloudSyncStatusMessage();
    actionsEl.innerHTML = '';
    return;
  }

  const cloud = getState().cfg.cloud;
  const sessionEmailPromise = getCloudSessionEmail();

  void sessionEmailPromise.then((sessionEmail) => {
    const active = Boolean(cloud?.enabled && sessionEmail);
    statusEl.innerHTML = active
      ? '<span class="ok">✓ Etkin</span>'
      : '<span class="no">Kapalı</span>';

    const parts = [
      cloud?.email ? `Hesap: ${esc(cloud.email)}` : null,
      cloud?.lastSyncedAt ? `Son senkron: ${new Date(cloud.lastSyncedAt).toLocaleString('tr-TR')}` : null,
    ].filter(Boolean);

    metaEl.textContent = parts.join(' · ') || 'Bulut hesabınla cihazlar arası otomatik senkron yapabilirsin.';

    if (active) {
      actionsEl.innerHTML = `
        <button class="btn btn-teal" type="button" onclick="syncCloudNow()">Şimdi Senkronize Et</button>
        <button class="btn btn-outline" type="button" onclick="pullCloudNow()">Buluttan Yükle</button>
        <button class="btn btn-outline" type="button" onclick="disableCloudSync()">Bulut Senkronunu Kapat</button>
      `;
      return;
    }

    actionsEl.innerHTML = `
      <button class="btn btn-teal" type="button" onclick="enableCloudSync('signup')">Bulut Hesabı Oluştur</button>
      <button class="btn btn-outline" type="button" onclick="enableCloudSync('signin')">Buluta Bağlan</button>
    `;
  });
}

export function renderCloudSyncLogin(): void {
  const loginPanel = document.getElementById('cloudLoginPanel');
  const setupPanel = document.getElementById('cloudSetupPanel');
  const available = isCloudSyncAvailable();

  loginPanel?.classList.toggle('hidden', !available);
  setupPanel?.classList.toggle('hidden', !available);
}

export async function enableCloudSync(mode: 'signup' | 'signin'): Promise<void> {
  const { email, password } = readCloudCredentials('cloudSettings');
  const error = validateCloudCredentials(email, password);
  if (error) {
    toast(error, 'err');
    return;
  }

  try {
    const updated = await enableCloudSyncForCurrentUser(email, password, mode);
    openUserSession(updated.profile.id);
    renderCloudSyncSettings();
    renderSettings();
    toast(mode === 'signup' ? 'Bulut hesabı oluşturuldu ve veriler yüklendi ✓' : 'Buluta bağlandı ✓', 'ok');
  } catch (cause) {
    toast(cause instanceof Error ? cause.message : 'Bulut bağlantısı başarısız', 'err');
  }
}

export async function disableCloudSync(): Promise<void> {
  try {
    await disableCloudSyncForCurrentUser();
    renderCloudSyncSettings();
    toast('Bulut senkronu kapatıldı');
  } catch (cause) {
    toast(cause instanceof Error ? cause.message : 'İşlem başarısız', 'err');
  }
}

export async function syncCloudNow(): Promise<void> {
  try {
    const result = await syncUserDataWithCloud(getState());
    if (result === 'pulled') {
      const userId = getCurrentUserId();
      if (userId) openUserSession(userId);
      renderTasks();
      renderReports();
    }
    renderCloudSyncSettings();
    renderSettings();

    const messages: Record<string, string> = {
      pushed: 'Veriler buluta gönderildi ✓',
      pulled: 'Veriler buluttan güncellendi ✓',
      unchanged: 'Veriler zaten güncel',
      skipped: 'Bulut senkronu kapalı',
      error: 'Senkron başarısız',
    };
    toast(messages[result] ?? 'Senkron tamamlandı', result === 'error' ? 'err' : 'ok');
  } catch (cause) {
    toast(cause instanceof Error ? cause.message : 'Senkron başarısız', 'err');
  }
}

export async function pullCloudNow(): Promise<void> {
  try {
    const pulled = await pullUserDataFromCloud();
    if (!pulled) {
      toast('Bulutta kayıtlı veri yok', 'err');
      return;
    }

    const userId = pulled.profile.id;
    openUserSession(userId);
    renderTasks();
    renderReports();
    renderCloudSyncSettings();
    renderSettings();
    toast('Buluttan yüklendi ✓', 'ok');
  } catch (cause) {
    toast(cause instanceof Error ? cause.message : 'Buluttan yükleme başarısız', 'err');
  }
}

export async function pushCloudNow(): Promise<void> {
  try {
    await pushUserDataToCloud(getState());
    renderCloudSyncSettings();
    toast('Buluta gönderildi ✓', 'ok');
  } catch (cause) {
    toast(cause instanceof Error ? cause.message : 'Buluta gönderilemedi', 'err');
  }
}

export async function signInFromCloudOnLogin(): Promise<void> {
  const { email, password } = readCloudCredentials('cloudLogin');
  const error = validateCloudCredentials(email, password);
  if (error) {
    toast(error, 'err');
    return;
  }

  try {
    const data = await restoreFromCloudAccount(email, password);
    openUserSession(data.profile.id);
    enterApp();
    toast('Bulut hesabından giriş yapıldı ✓', 'ok');
  } catch (cause) {
    toast(cause instanceof Error ? cause.message : 'Bulut girişi başarısız', 'err');
  }
}

export async function signInFromCloudOnSetup(): Promise<void> {
  const { email, password } = readCloudCredentials('cloudSetup');
  const error = validateCloudCredentials(email, password);
  if (error) {
    toast(error, 'err');
    return;
  }

  try {
    const data = await restoreFromCloudAccount(email, password);
    openUserSession(data.profile.id);
    enterApp();
    toast('Bulut hesabından devam ediliyor ✓', 'ok');
  } catch (cause) {
    toast(cause instanceof Error ? cause.message : 'Bulut girişi başarısız', 'err');
  }
}

export { runCloudSyncOnAppEnter, refreshCloudPanels };
