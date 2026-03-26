const CACHE_NAME = 'prey-run-v6';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/game.js',
  '/ui.js',
  '/vocabulary.js',
  '/manifest.json',
  '/icon-512.png',
  '/anime_bg.png',
  '/anime_deer.png',
  '/anime_lion.png',
  '/rock_obstacle.png',
  '/log_obstacle.png',
  '/puddle_obstacle.png',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&display=swap'
];

// Install: cache tất cả tài nguyên
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Thêm từng asset, bỏ qua nếu có lỗi
      return Promise.allSettled(ASSETS.map(url => cache.add(url)));
    })
  );
  self.skipWaiting();
});

// Activate: xóa cache cũ
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Cache-first strategy
self.addEventListener('fetch', (event) => {
  // Bỏ qua các request không phải GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache các response thành công
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
