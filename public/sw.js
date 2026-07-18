const CACHE = 'teamflow-v4';
const SHELL = ['./', './index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.hostname.includes('api.groq.com')) return;
  if (request.method !== 'GET') return;

  const isAsset = url.pathname.includes('/assets/')
    || url.pathname.endsWith('.js')
    || url.pathname.endsWith('.css')
    || url.pathname.includes('/src/');

  event.respondWith(
    isAsset
      ? fetch(request)
          .then((response) => {
            if (!response || response.status !== 200) return response;
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone));
            return response;
          })
          .catch(() => caches.match(request))
      : fetch(request)
          .then((response) => {
            if (!response || response.status !== 200) return response;
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone));
            return response;
          })
          .catch(() => caches.match('./index.html')),
  );
});
