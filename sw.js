// Bump the cache version when publishing an update.
const CACHE = 'calistenia28-v2-20261026-1';
const PREFIX = 'calistenia28-';
const ASSETS = ["/", "/index.html", "/app.js", "/program.js", "/app.css", "/manifest.webmanifest", "/assets/01dc6c15203b8589.webp", "/assets/0cc92fef4f539f1d.webp", "/assets/1cf69fc4e905731e.webp", "/assets/22f4ece1db39403d.webp", "/assets/2920533bc9d2fe6e.webp", "/assets/37d1a67d9f23521a.webp", "/assets/38e559f9d5890fda.webp", "/assets/40e35d3ac391660f.webp", "/assets/48dbcf08e3bf6f7b.webp", "/assets/79437dbf0f104aaf.webp", "/assets/7ded8496dff33d22.webp", "/assets/ad1baba74d619d49.webp", "/assets/b1fb4bdcb2fa4dd5.webp", "/assets/b6424df9df103230.webp", "/assets/b661c20918cd254c.webp", "/assets/b707244a8f5548b4.webp", "/assets/c45c0e870530c177.webp", "/assets/cc9e60a2a89accb1.webp", "/assets/cf9262efe43b92ec.webp", "/assets/d3f55109da4a43cb.webp", "/assets/f0deb46b0dfebc3a.webp", "/assets/f10bcfe4b1100663.webp", "/assets/f7eaf89543d18e70.webp", "/icons/icon-192.png", "/icons/icon-512.png", "/imagenes_mi_movilizacion/ankles.jpg", "/imagenes_mi_movilizacion/ankles.webp", "/imagenes_mi_movilizacion/ankles_fases.webp", "/imagenes_mi_movilizacion/breathing.jpg", "/imagenes_mi_movilizacion/breathing.webp", "/imagenes_mi_movilizacion/breathing_fases.webp", "/imagenes_mi_movilizacion/catcow.jpg", "/imagenes_mi_movilizacion/catcow.webp", "/imagenes_mi_movilizacion/catcow_fases.webp", "/imagenes_mi_movilizacion/hips.jpg", "/imagenes_mi_movilizacion/hips.webp", "/imagenes_mi_movilizacion/hips_fases.webp", "/imagenes_mi_movilizacion/shoulders.jpg", "/imagenes_mi_movilizacion/shoulders.webp", "/imagenes_mi_movilizacion/shoulders_fases.webp"];
self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
 event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => {
 if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
 if (event.request.mode === 'navigate') {
  event.respondWith(caches.open(CACHE).then(async cache => {
   // A single cached version keeps HTML, program and controls consistent.
   return await cache.match('/') || fetch(event.request);
  }));
 } else if (ASSETS.includes(url.pathname)) {
  event.respondWith(caches.open(CACHE).then(async cache => {
   const hit = await cache.match(url.pathname);
   return hit || fetch(event.request);
  }));
 }
});
