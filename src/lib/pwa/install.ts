import { toast } from '@/app/toast';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type InstallPlatform = 'ios' | 'android' | 'desktop' | 'unknown';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installUiBound = false;

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: window-controls-overlay)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIos) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return 'desktop';
  return 'unknown';
}

function platformLabel(platform: InstallPlatform): string {
  if (platform === 'ios') return 'iPhone / iPad';
  if (platform === 'android') return 'Android telefon / tablet';
  if (platform === 'desktop') return 'Masaüstü (Windows / Mac / Linux)';
  return 'Bu cihaz';
}

function iosInstallSteps(): string {
  return `
    <ol class="pwa-install-steps-list">
      <li>Safari'de sayfanın altındaki <strong>Paylaş</strong> (□↑) simgesine dokun.</li>
      <li><strong>Ana Ekrana Ekle</strong> seçeneğini seç.</li>
      <li>İsim olarak <strong>TeamFlow</strong> görünecek — <strong>Ekle</strong>'ye bas.</li>
    </ol>
  `;
}

function androidInstallSteps(): string {
  if (deferredPrompt) {
    return '<p>Aşağıdaki <strong>Uygulamayı Yükle</strong> düğmesine bas veya tarayıcı menüsünden <strong>Ana ekrana ekle</strong> / <strong>Uygulamayı yükle</strong> seçeneğini kullan.</p>';
  }
  return `
    <ol class="pwa-install-steps-list">
      <li>Chrome menüsünü (⋮) aç.</li>
      <li><strong>Ana ekrana ekle</strong> veya <strong>Uygulamayı yükle</strong> seçeneğini seç.</li>
      <li>Onayla — TeamFlow ana ekranda ve uygulama listesinde görünür.</li>
    </ol>
  `;
}

function desktopInstallSteps(): string {
  if (deferredPrompt) {
    return '<p>Aşağıdaki <strong>Uygulamayı Yükle</strong> düğmesine bas. Chrome / Edge adres çubuğundaki ⊕ simgesini de kullanabilirsin.</p>';
  }
  return `
    <ol class="pwa-install-steps-list">
      <li>Chrome veya Edge kullan (Safari masaüstünde sınırlı destek sunar).</li>
      <li>Adres çubuğunun sağındaki <strong>Yükle</strong> (⊕) simgesine tıkla.</li>
      <li><strong>Yükle</strong> onayını ver — TeamFlow Başlat menüsüne veya Dock'a eklenir.</li>
    </ol>
  `;
}

function installStepsForPlatform(platform: InstallPlatform): string {
  if (platform === 'ios') return iosInstallSteps();
  if (platform === 'android') return androidInstallSteps();
  if (platform === 'desktop') return desktopInstallSteps();
  return androidInstallSteps();
}

function notifyInstallUiChange(): void {
  renderInstallSettings();
  renderLoginInstallHint();
  renderAppInstallBanner();
}

export function initPwaInstall(): void {
  if (installUiBound) return;
  installUiBound = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifyInstallUiChange();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    toast('TeamFlow yüklendi ✓', 'ok');
    notifyInstallUiChange();
  });

  window.matchMedia('(display-mode: standalone)').addEventListener('change', notifyInstallUiChange);
  notifyInstallUiChange();
}

export async function installPwaApp(): Promise<void> {
  if (isStandalone()) {
    toast('TeamFlow zaten yüklü', 'ok');
    return;
  }

  if (!deferredPrompt) {
    toast('Tarayıcı menüsünden yüklemeyi dene — adımlar aşağıda.', 'err');
    return;
  }

  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    notifyInstallUiChange();

    if (choice.outcome === 'accepted') {
      toast('TeamFlow yükleniyor…', 'ok');
    }
  } catch {
    toast('Yükleme başlatılamadı', 'err');
  }
}

export function renderInstallSettings(): void {
  const statusEl = document.getElementById('pwaInstallStatus');
  const metaEl = document.getElementById('pwaInstallMeta');
  const stepsEl = document.getElementById('pwaInstallSteps');
  const actionsEl = document.getElementById('pwaInstallActions');
  if (!statusEl || !metaEl || !stepsEl || !actionsEl) return;

  const platform = detectPlatform();
  const installed = isStandalone();

  if (installed) {
    statusEl.innerHTML = '<span class="ok">✓ Yüklü</span>';
    metaEl.textContent = 'TeamFlow bu cihazda uygulama olarak çalışıyor.';
    stepsEl.classList.add('hidden');
    stepsEl.innerHTML = '';
    actionsEl.innerHTML = '';
    return;
  }

  statusEl.innerHTML = '<span class="no">Tarayıcıda</span>';
  metaEl.textContent = `${platformLabel(platform)} için TeamFlow'u ana ekrana veya masaüstüne ekleyebilirsin.`;
  stepsEl.classList.remove('hidden');
  stepsEl.innerHTML = installStepsForPlatform(platform);

  if (deferredPrompt) {
    actionsEl.innerHTML = '<button class="btn btn-teal" type="button" onclick="installPwaApp()">Uygulamayı Yükle</button>';
    return;
  }

  if (platform === 'ios') {
    actionsEl.innerHTML = '<span class="pwa-install-note">Safari gerekli — Chrome iOS\'ta yükleme desteklemez.</span>';
    return;
  }

  actionsEl.innerHTML = '<span class="pwa-install-note">Yükleme düğmesi görünmüyorsa yukarıdaki adımları izle.</span>';
}

export function renderLoginInstallHint(): void {
  const hint = document.getElementById('loginInstallHint');
  if (!hint) return;

  if (isStandalone()) {
    hint.classList.add('hidden');
    hint.innerHTML = '';
    return;
  }

  const platform = detectPlatform();
  hint.classList.remove('hidden');

  if (deferredPrompt) {
    hint.innerHTML = `
      <div class="login-install-copy">
        <strong>TeamFlow'u bu cihaza yükle</strong>
        <span>Masaüstü, telefon veya tablette uygulama gibi kullan.</span>
      </div>
      <button class="btn btn-teal btn-sm" type="button" onclick="installPwaApp()">Yükle</button>
    `;
    return;
  }

  if (platform === 'ios') {
    hint.innerHTML = `
      <div class="login-install-copy">
        <strong>iPhone / iPad'e ekle</strong>
        <span>Safari → Paylaş → Ana Ekrana Ekle</span>
      </div>
    `;
    return;
  }

  hint.innerHTML = `
    <div class="login-install-copy">
      <strong>Uygulama olarak yükle</strong>
      <span>${platform === 'android' ? 'Chrome menüsü → Ana ekrana ekle' : 'Adres çubuğu → Yükle (⊕)'}</span>
    </div>
  `;
}

export function renderAppInstallBanner(): void {
  const banner = document.getElementById('pwaInstallBanner');
  if (!banner) return;

  const appActive = document.getElementById('appScreen')?.classList.contains('active') ?? false;
  if (!appActive || isStandalone()) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
    return;
  }

  banner.classList.remove('hidden');

  if (deferredPrompt) {
    banner.innerHTML = `
      <span>📲 TeamFlow'u bu cihaza yükle — çevrimdışı ve tam ekran kullan.</span>
      <button class="btn btn-teal btn-sm" type="button" onclick="installPwaApp()">Yükle</button>
    `;
    return;
  }

  banner.innerHTML = `
    <span>📲 Ayarlar → Uygulamayı Yükle bölümünden cihazına ekleyebilirsin.</span>
    <button class="btn btn-outline btn-sm" type="button" onclick="switchTab('settings')">Ayarlara Git</button>
  `;
}

export function handlePwaDeepLink(): void {
  const action = new URLSearchParams(window.location.search).get('action');
  if (action !== 'new-task') return;
  if (!document.getElementById('appScreen')?.classList.contains('active')) return;

  void import('@/app/features/tasks').then(({ openNewTask }) => {
    openNewTask();
  });

  const url = new URL(window.location.href);
  url.searchParams.delete('action');
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);
}
