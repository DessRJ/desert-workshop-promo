// Service worker: la app abre sin internet. Cambia VERSION en cada despliegue con cambios.
const VERSION = 'dw-v1';
const SHELL = [
  '/', '/index.html', '/styles.css', '/app.js', '/manifest.webmanifest',
  '/icons/mark-white.png', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/favicon-64.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.pathname.startsWith('/.netlify/')) return; // el API nunca se cachea

  // Páginas: primero red (para ver cambios), si falla usa la copia guardada
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { caches.open(VERSION).then((c) => c.put('/index.html', res.clone())); return res; })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Archivos estáticos y fuentes: usa la copia y actualiza en segundo plano
  const cacheable = url.origin === location.origin ||
    url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!cacheable) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => { if (res.ok || res.type === 'opaque') caches.open(VERSION).then((c) => c.put(req, res.clone())); return res; })
        .catch(() => hit);
      return hit || net;
    })
  );
});
