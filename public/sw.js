const CACHE = 'zawa-client-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/icon-maskable.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Never cache API or media streams
  if (url.pathname.startsWith('/api/') || /\.(mp4|m3u8|ts|vtt|srt|webm|mov)(\?|$)/i.test(url.pathname)) return;
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((hit) => hit || (url.pathname === url.origin ? caches.match('/index.html') : Promise.reject()))
      )
  );
});
