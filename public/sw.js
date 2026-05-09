const CACHE_NAME = 'sherpa-v4';
const IMG_CACHE = 'sherpa-img-v1';
const CACHE_PREFIX = 'sherpa-';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME && k !== IMG_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Skip API/auth/oauth requests entirely
  if (
    request.url.includes('/rest/') ||
    request.url.includes('/auth/') ||
    request.url.includes('/~oauth') ||
    request.url.includes('/functions/v1/')
  ) {
    return;
  }

  // Cache images aggressively (cache-first), including cross-origin
  // (Supabase storage). This is the biggest perf win on repeat visits.
  const isImage =
    request.destination === 'image' ||
    /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(url.pathname) ||
    url.pathname.includes('/storage/v1/object/public/') ||
    url.pathname.includes('/storage/v1/render/image/');

  if (isImage) {
    event.respondWith(
      caches.open(IMG_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          // Refresh in background
          fetch(request).then((res) => { if (res && res.ok) cache.put(request, res.clone()); }).catch(() => {});
          return cached;
        }
        try {
          const res = await fetch(request);
          if (res && res.ok) cache.put(request, res.clone());
          return res;
        } catch (e) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  const isViteDevAsset =
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.includes('/.vite/');
  const isRuntimeCode = ['script', 'style', 'worker'].includes(request.destination);
  if (isViteDevAsset || isRuntimeCode) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === 'basic' && request.destination === 'font') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Push notification support
self.addEventListener('push', (event) => {
  let data = { title: 'Sherpa', body: 'You have a new notification' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Sherpa', {
      body: data.body || 'You have a new notification',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data.url || '/',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
