import '@/styles/globals.css';
import { boot, registerWindowApi } from '@/app/boot';

registerWindowApi();
boot();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));

      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.filter((key) => key.startsWith('teamflow-')).map((key) => caches.delete(key)));

      if (import.meta.env.DEV) {
        console.log('SW disabled in dev — fresh modules from Vite');
        return;
      }

      await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
      console.log('SW registered (teamflow-v4, network-first assets)');
    } catch (error) {
      console.log('SW error', error);
    }
  });
}
