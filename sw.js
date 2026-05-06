// ==================== إصدار الكاش ====================
const CACHE_VERSION = 'v6';
const STATIC_CACHE = `store-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `store-dynamic-${CACHE_VERSION}`;

// ==================== الملفات الحرجة للتخزين ====================
const CRITICAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.gstatic.com/s/tajawal/v12/Iura6YBj_oCad4k1nzSBC45I.woff2',
  'https://fonts.gstatic.com/s/tajawal/v12/Iurf6YBj_oCad4k1l4qkHrRpiYlJ.woff2'
];

// ==================== التثبيت ====================
self.addEventListener('install', event => {
  console.log('[SW] جاري التثبيت...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] تخزين الملفات الحرجة...');
        return cache.addAll(CRITICAL_ASSETS).catch(err => {
          console.warn('[SW] تعذر تحميل بعض الملفات لكن سنكمل:', err);
        });
      })
      .then(() => {
        console.log('[SW] تم التثبيت - تخطي الانتظار');
        return self.skipWaiting();
      })
  );
});

// ==================== التفعيل ====================
self.addEventListener('activate', event => {
  console.log('[SW] جاري التفعيل...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => {
          return name.startsWith('store-') && name !== STATIC_CACHE && name !== DYNAMIC_CACHE;
        }).map(name => {
          console.log('[SW] حذف الكاش القديم:', name);
          return caches.delete(name);
        })
      );
    }).then(() => {
      console.log('[SW] تم التفعيل');
      return self.clients.claim();
    })
  );
});

// ==================== استراتيجية الكاش أولاً ====================
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/__')) return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // تحديث الكاش في الخلفية
          fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.ok) {
              caches.open(DYNAMIC_CACHE).then(cache => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }

        // جلب من الشبكة
        return fetch(event.request).then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseClone = networkResponse.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        }).catch(() => {
          // صفحة احتياطية للـ HTML
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('./index.html');
          }
          return new Response('غير متاح', { status: 408 });
        });
      })
  );
});

console.log('[SW] ✅ Service Worker جاهز');