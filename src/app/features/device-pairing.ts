import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import {
  createPairingSession,
  extractPairingToken,
  fetchPairingSession,
  getPairingStatusMessage,
  markPairingConsumed,
  PAIRING_TTL_MS,
  waitForPairingConsumed,
} from '@/lib/sync/device-pairing';
import { isCloudSyncAvailable } from '@/lib/sync/config';
import { importUserBackup } from '@/lib/storage/backup';
import { getCurrentUserId, openUserSession } from '@/app/state';
import { enterApp } from '@/app/features/shell';
import { buildLogin } from '@/app/features/login';
import { getRegistry } from '@/lib/storage/user-storage';
import { showScreen } from '@/lib/utils';
import { closeModal, openModal } from '@/app/features/tasks';
import { toast } from '@/app/toast';

let hostCountdownTimer: number | null = null;
let qrScanner: Html5Qrcode | null = null;
let scanProcessing = false;

function clearHostTimers(): void {
  if (hostCountdownTimer) {
    window.clearInterval(hostCountdownTimer);
    hostCountdownTimer = null;
  }
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

async function applyPairingPayload(token: string): Promise<void> {
  const payload = await fetchPairingSession(token);
  if (!payload) {
    throw new Error('QR kodu geçersiz veya süresi dolmuş');
  }

  const userId = importUserBackup(payload);
  await markPairingConsumed(token);
  openUserSession(userId);
}

export function renderDevicePairingSettings(): void {
  const metaEl = document.getElementById('devicePairingMeta');
  const actionsEl = document.getElementById('devicePairingActions');
  if (!metaEl || !actionsEl) return;

  if (!isCloudSyncAvailable()) {
    metaEl.textContent = getPairingStatusMessage();
    actionsEl.innerHTML = '';
    return;
  }

  metaEl.textContent = getPairingStatusMessage();
  actionsEl.innerHTML = `
    <button class="btn btn-teal" type="button" onclick="openPairingHostModal()">QR Kod Göster (Masaüstü)</button>
    <button class="btn btn-outline" type="button" onclick="openPairingScanModal()">QR Kod Tara (Telefon)</button>
  `;
}

export function renderLoginPairingHint(): void {
  const hint = document.getElementById('loginPairingHint');
  if (!hint) return;

  if (!isCloudSyncAvailable()) {
    hint.classList.add('hidden');
    hint.innerHTML = '';
    return;
  }

  hint.classList.remove('hidden');
  hint.innerHTML = `
    <div class="login-install-copy">
      <strong>Bilgisayarındaki hesabı telefona aktar</strong>
      <span>Masaüstünde QR göster → buradan tara</span>
    </div>
    <button class="btn btn-outline btn-sm" type="button" onclick="openPairingScanModal()">QR Tara</button>
  `;
}

export async function openPairingHostModal(): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) {
    toast('Önce giriş yap', 'err');
    return;
  }

  clearHostTimers();

  const qrEl = document.getElementById('pairHostQr');
  const statusEl = document.getElementById('pairHostStatus');
  const codeEl = document.getElementById('pairHostCode');
  if (!qrEl || !statusEl || !codeEl) return;

  qrEl.innerHTML = '<div class="pair-loading">QR oluşturuluyor…</div>';
  statusEl.textContent = 'Hazırlanıyor…';
  codeEl.textContent = '—';
  openModal('pairHostModal');

  try {
    const session = await createPairingSession(userId);
    const dataUrl = await QRCode.toDataURL(session.url, {
      width: 280,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    });

    qrEl.innerHTML = `<img src="${dataUrl}" width="280" height="280" alt="Eşleştirme QR kodu">`;
    codeEl.textContent = session.token.slice(0, 8).toUpperCase();
    statusEl.textContent = `Telefonunla tara · ${formatCountdown(PAIRING_TTL_MS)} kaldı`;

    const expiresAt = session.expiresAt.getTime();
    hostCountdownTimer = window.setInterval(() => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        statusEl.textContent = 'Süre doldu — yeni QR oluştur';
        clearHostTimers();
        return;
      }
      statusEl.textContent = `Telefonunla tara · ${formatCountdown(remaining)} kaldı`;
    }, 1000);

    void waitForPairingConsumed(session.token).then((consumed) => {
      if (!consumed) return;
      statusEl.textContent = 'Telefon eşleştirildi ✓';
      toast('Cihaz eşleştirildi ✓', 'ok');
      clearHostTimers();
    });
  } catch (error) {
    qrEl.innerHTML = '';
    statusEl.textContent = error instanceof Error ? error.message : 'QR oluşturulamadı';
    toast(statusEl.textContent, 'err');
  }
}

export function closePairingHostModal(): void {
  clearHostTimers();
  closeModal('pairHostModal');
}

async function handleScanSuccess(raw: string): Promise<void> {
  if (scanProcessing) return;
  scanProcessing = true;

  try {
    const token = extractPairingToken(raw);
    if (!token) {
      toast('Geçersiz QR kodu', 'err');
      return;
    }

    await applyPairingPayload(token);
    await stopPairingScanner();
    closeModal('pairScanModal');

    if (document.getElementById('appScreen')?.classList.contains('active')) {
      enterApp();
      toast('Hesap telefona aktarıldı ✓', 'ok');
      return;
    }

    buildLogin(getRegistry().lastUserId ?? null);
    showScreen('loginScreen');
    toast('Hesap yüklendi — PIN ile giriş yap ✓', 'ok');
  } catch (error) {
    toast(error instanceof Error ? error.message : 'Eşleştirme başarısız', 'err');
  } finally {
    scanProcessing = false;
  }
}

async function stopPairingScanner(): Promise<void> {
  if (!qrScanner) return;

  try {
    const state = qrScanner.getState();
    if (state === 2) {
      await qrScanner.stop();
    }
    qrScanner.clear();
  } catch {
    // scanner may already be stopped
  } finally {
    qrScanner = null;
  }
}

export async function openPairingScanModal(): Promise<void> {
  if (!isCloudSyncAvailable()) {
    toast(getPairingStatusMessage(), 'err');
    return;
  }

  scanProcessing = false;
  const reader = document.getElementById('pairScanReader');
  const statusEl = document.getElementById('pairScanStatus');
  if (!reader || !statusEl) return;

  reader.innerHTML = '';
  statusEl.textContent = 'Kamera açılıyor…';
  openModal('pairScanModal');

  await stopPairingScanner();
  qrScanner = new Html5Qrcode('pairScanReader');

  try {
    await qrScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decoded) => {
        void handleScanSuccess(decoded);
      },
      () => {
        // ignore scan miss frames
      },
    );
    statusEl.textContent = 'Masaüstündeki QR kodu kadraja getir';
  } catch (error) {
    statusEl.textContent = 'Kamera açılamadı — izin ver veya QR linkine dokun';
    toast(error instanceof Error ? error.message : 'Kamera hatası', 'err');
  }
}

export async function closePairingScanModal(): Promise<void> {
  await stopPairingScanner();
  closeModal('pairScanModal');
}

export async function consumePairingFromUrl(): Promise<boolean> {
  const token = extractPairingToken(new URL(window.location.href).searchParams.get('pair') ?? '');
  if (!token) return false;

  const url = new URL(window.location.href);
  url.searchParams.delete('pair');
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);

  try {
    await applyPairingPayload(token);

    if (document.getElementById('appScreen')?.classList.contains('active')) {
      enterApp();
    } else {
      buildLogin(getRegistry().lastUserId ?? null);
      showScreen('loginScreen');
    }

    toast('QR ile eşleştirme tamamlandı ✓', 'ok');
    return true;
  } catch (error) {
    toast(error instanceof Error ? error.message : 'Eşleştirme başarısız', 'err');
    return false;
  }
}

export function renderSetupPairingHint(): void {
  if (!isCloudSyncAvailable()) return;

  const hint = document.getElementById('setupPairingHint');
  if (!hint) return;

  hint.classList.remove('hidden');
  hint.innerHTML = `
    <div class="setup-pairing-copy">
      <strong>Bilgisayarında hesabın var mı?</strong>
      <span>Masaüstünde QR göster, buradan tara — yeni hesap açmana gerek kalmaz.</span>
    </div>
    <button class="btn btn-outline btn-sm" type="button" onclick="openPairingScanModal()">QR Tara</button>
  `;
}
