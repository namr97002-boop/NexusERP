// ==================== SW نهائي - تجارتي v6 ====================
const CACHE_NAME = 'tagarati-v6';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  // المكتبات الأساسية للتخزين الكامل
  'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://apis.google.com/js/api.js'
];

// ==================== INSTALL ====================
self.addEventListener("install", (event) => {
  console.log("[SW] تثبيت:", CACHE_NAME);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] جاري تخزين الملفات...");
      return Promise.allSettled(
        PRECACHE_URLS.map(url => {
          return cache.add(url).catch(err => {
            console.warn('[SW] فشل تخزين:', url, err);
          });
        })
      );
    })
  );
});

// ==================== ACTIVATE ====================
self.addEventListener("activate", (event) => {
  console.log("[SW] تفعيل:", CACHE_NAME);
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) {
            console.log("[SW] حذف الكاش القديم:", name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ==================== FETCH (الاستراتيجية الذهبية: Cache First ثم Network Update) ====================
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  
  // للملفات المحلية: نعرض المخزن فورًا، ثم نحدثه من الشبكة
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // جلب التحديث من الشبكة بصمت
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        // نعيد النسخة المخزنة فورًا إن وجدت، وإلا ننتظر الشبكة
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
  
  // للملفات الخارجية (CDN): نفس الاستراتيجية
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});