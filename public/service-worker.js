const CACHE_VERSION = 'v1';
const CACHE_STATIC = `static-${CACHE_VERSION}`;
const CACHE_IMAGES = `images-${CACHE_VERSION}`;
const CACHE_PAGES = `pages-${CACHE_VERSION}`;

const PRECACHE_URLS = ['/offline/', '/manifest.json'];

const IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.avif', '.webp'];

const PRIMARY_HOST = 'base.pics.ordchaos.com';
const FALLBACK_HOSTS = ['n0.pics.ordchaos.com', 'n1.pics.ordchaos.com', 'n2.pics.ordchaos.com'];

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
          if (
            cacheName !== CACHE_STATIC &&
            cacheName !== CACHE_IMAGES &&
            cacheName !== CACHE_PAGES
          ) {
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
  const isImage = IMAGE_TYPES.some((ext) => pathnameLower.endsWith(ext));
  const isTargetImage = isImage && url.hostname === PRIMARY_HOST;

  if (isTargetImage) {
    event.respondWith(handleImageWithFallback(event.request, url));
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

async function handleImageWithFallback(request, originalUrl) {
  const acceptHeader = request.headers.get('accept') || '';
  let targetExt = '';
  let targetPath = originalUrl.pathname;

  if (acceptHeader.includes('image/avif')) {
    targetExt = '.avif';
  } else if (acceptHeader.includes('image/webp')) {
    targetExt = '.webp';
  }

  if (targetExt) {
    targetPath = originalUrl.pathname.replace(/\.(jpg|jpeg|png)$/i, targetExt);
  }

  const primaryTarget = new URL(originalUrl);
  primaryTarget.pathname = targetPath;

  try {
    const primaryResp = await fetch(primaryTarget, {
      mode: 'cors',
      credentials: 'omit',
      cache: 'default',
      redirect: 'follow',
    });
    if (primaryResp.ok) {
      console.log(
        '%c[SW Image Success]%c ' + PRIMARY_HOST + targetPath,
        'color: #28a745; font-weight: bold;',
        'color: inherit;',
      );
      return primaryResp;
    }
  } catch (e) {
    console.warn(
      '%c[SW Primary Fail]%c ' + PRIMARY_HOST + ' → ' + e.message,
      'color: #dc3545; font-weight: bold;',
      'color: inherit;',
    );
  }

  console.log(
    '%c[SW Fallback]%c ' + originalUrl.pathname + ' → concurrent n0/n1/n2',
    'color: #ffc107; font-weight: bold;',
    'color: inherit;',
  );

  const fallbackPromises = FALLBACK_HOSTS.map((host) => {
    const fbUrl = new URL(primaryTarget);
    fbUrl.hostname = host;
    return fetch(fbUrl, { mode: 'cors', credentials: 'omit', cache: 'default', redirect: 'follow' })
      .then((resp) => {
        if (resp.ok) {
          console.log(
            '%c[SW Fallback OK]%c ' + host + fbUrl.pathname,
            'color: #28a745; font-weight: bold;',
            'color: inherit;',
          );
          return resp;
        }
        throw new Error('status ' + resp.status);
      })
      .catch((err) => {
        console.warn(
          '%c[SW Fallback Fail]%c ' + host + ' → ' + err.message,
          'color: #dc3545; font-weight: bold;',
          'color: inherit;',
        );
        return null;
      });
  });

  const firstSuccess = await Promise.race(fallbackPromises);
  if (firstSuccess) return firstSuccess;

  console.error(
    '%c[SW All Failed]%c ' + originalUrl.pathname,
    'color: #dc3545; font-weight: bold;',
    'color: inherit;',
  );
  return new Response(
    new Blob([
      new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x01, 0x03, 0x00, 0x00, 0x00, 0x25,
        0xdb, 0x56, 0xca, 0x00, 0x00, 0x00, 0x03, 0x50, 0x4c, 0x54, 0x45, 0x00, 0x00, 0x00, 0xa7,
        0x7a, 0x5f, 0x00, 0x00, 0x00, 0x01, 0x74, 0x52, 0x4e, 0x53, 0x00, 0x40, 0xe6, 0xd8, 0x66,
        0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
        0xae, 0x42, 0x60, 0x82,
      ]),
    ]),
    { status: 200, headers: { 'Content-Type': 'image/png' } },
  );
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
