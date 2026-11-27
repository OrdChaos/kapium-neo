const CACHE_VERSION = 'v2';
const CACHE_STATIC = `static-${CACHE_VERSION}`;
const CACHE_PAGES = `pages-${CACHE_VERSION}`;

const PRECACHE_URLS = ['/offline/', '/manifest.json'];

const IMAGE_EXTENSIONS = ['.avif', '.webp', '.jpg', '.jpeg', '.png', '.gif'];

// Race the CDN against the R2 custom domain. The browser still chooses the
// image format via <picture>; the SW only chooses the faster origin.
const IMAGE_HOSTS = ['blog-pics.ordchaos.com', 'blog-pics-cn.ordchaos.com'];

self.addEventListener('install', (event) => {
  console.log(
    '%c[SW Install]%c Caching static assets...',
    'color: #007bff; font-weight: bold;',
    'color: inherit;',
  );

  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn(
          '%c[SW Install]%c Some assets failed to cache:',
          'color: #dc3545; font-weight: bold;',
          'color: inherit;',
          err,
        );
      });
    }),
  );

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(
    '%c[SW Activate]%c Cleaning old caches...',
    'color: #28a745; font-weight: bold;',
    'color: inherit;',
  );

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_STATIC && cacheName !== CACHE_PAGES) {
            console.log(
              '%c[SW Activate]%c Deleting old cache: ' + cacheName,
              'color: #ffc107; font-weight: bold;',
              'color: inherit;',
            );
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );

  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  const pathnameLower = url.pathname.toLowerCase();
  const isImage = IMAGE_EXTENSIONS.some((ext) => pathnameLower.endsWith(ext));
  const isTargetImage = isImage && IMAGE_HOSTS.includes(url.hostname);

  if (isTargetImage) {
    event.respondWith(raceImage(event.request, url));
    return;
  }

  const isHtmlRequest =
    request.headers.get('accept')?.includes('text/html') ||
    (!url.pathname.includes('.') && !url.pathname.includes('/api/'));
  const isStaticAsset = url.pathname.startsWith('/_astro/');
  const isJsonRequest = url.pathname.endsWith('.json');

  if (isJsonRequest) {
    handleJsonRequest(event, request);
  } else if (isHtmlRequest) {
    handleHtmlRequest(event, request);
  } else if (isStaticAsset) {
    handleStaticAsset(event, request);
  }
});

async function raceImage(request, originalUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  const attempts = IMAGE_HOSTS.map((host) => {
    const target = new URL(originalUrl);
    target.hostname = host;

    return fetch(target, {
      method: 'GET',
      headers: request.headers,
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit',
      cache: 'default',
      redirect: 'follow',
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`${host}: HTTP ${response.status}`);
      }
      console.log(
        `%c[SW Image Race]%c ${host} won: ${target.pathname}`,
        'color: #28a745; font-weight: bold;',
        'color: inherit;',
      );
      return response;
    });
  });

  try {
    return await Promise.any(attempts);
  } catch (err) {
    console.error(
      '%c[SW Image Race]%c all origins failed: ' + originalUrl.pathname,
      'color: #dc3545; font-weight: bold;',
      'color: inherit;',
      err,
    );
    return new Response('', {
      status: 404,
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
    });
  } finally {
    clearTimeout(timer);
  }
}

function handleJsonRequest(event, request) {
  event.respondWith(
    fetch(request).catch(() => {
      console.warn(
        '%c[SW JSON]%c Offline, rejecting: ' + event.request.url,
        'color: #dc3545; font-weight: bold;',
        'color: inherit;',
      );
      return new Response(JSON.stringify({ error: 'offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
}

function handleHtmlRequest(event, request) {
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const cacheClone = response.clone();
          caches.open(CACHE_PAGES).then((cache) => cache.put(request, cacheClone));
        }
        return response;
      })
      .catch(() => {
        console.log(
          '%c[SW HTML]%c Offline for: ' + event.request.url,
          'color: #ffc107; font-weight: bold;',
          'color: inherit;',
        );
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          return caches.match('/offline/').then((offlinePage) => {
            return (
              offlinePage ||
              new Response('<!DOCTYPE html><html><body><h1>离线</h1></body></html>', {
                status: 200,
                headers: { 'Content-Type': 'text/html' },
              })
            );
          });
        });
      }),
  );
}

function handleStaticAsset(event, request) {
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const cacheClone = response.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(request, cacheClone));
          }
          return response;
        })
        .catch(() => {
          console.warn(
            '%c[SW Asset]%c Offline, no cache for: ' + request.url,
            'color: #ffc107; font-weight: bold;',
            'color: inherit;',
          );
          return new Response('Resource offline', { status: 503 });
        });
    }),
  );
}
