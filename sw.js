/**
 * CIRCUITO TENEX - SERVICE WORKER (PWA)
 * Versión de caché: tenex-pwa-v2
 * Soporta funcionamiento sin conexión y actualización transparente en GitHub Pages.
 */

const CACHE_NAME = 'circuito-tenex-v2.1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles.css',
  './config.js',
  './app.js',
  './icon.svg',
  './reportes-circuito-tenex.json'
];

// Instalación: Precarga de recursos esenciales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activación: Purga de cachés obsoletas (ej. tenex-v1) y toma de control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Eliminando caché obsoleta:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Intercepción de peticiones (Fetch): Stale-While-Revalidate para recursos locales
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Solo procesar peticiones HTTP/HTTPS de tipo GET
  if (req.method !== 'GET') return;

  // No interceptar peticiones externas (como Google Analytics)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(req).then((cachedResponse) => {
        // Petición a red en paralelo para mantener la caché al día (Stale-While-Revalidate)
        const fetchPromise = fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(req, networkResponse.clone());
          }
          return networkResponse;
        }).catch((err) => {
          // Si estamos fuera de línea, ignorar error de red si ya teníamos versión en caché
          if (cachedResponse) {
            return cachedResponse;
          }
          throw err;
        });

        // Devolver inmediatamente la respuesta en caché si existe, o esperar a la red
        return cachedResponse || fetchPromise;
      });
    })
  );
});
