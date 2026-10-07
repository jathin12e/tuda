/*
 * Service worker for the TUDA inauguration app.
 *
 * It stores the application shell and every built asset so the ceremony screen
 * keeps working without a network connection. The two placeholders below are
 * filled in by the build (see vite.config.js).
 *
 * An updated worker never calls skipWaiting(): a new version only takes over
 * once every tab / Home Screen instance of the app has been closed, so nothing
 * changes or reloads in the middle of a ceremony.
 */
const VERSION = '__SW_VERSION__';
const PRECACHE_URLS = ['__PRECACHE_URLS__'];

const CACHE_PREFIX = 'tuda-ceremony-';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const SCOPE = self.registration.scope;
const SHELL_URL = new URL('./', SCOPE).href;
const ESSENTIAL_URLS = [
  SHELL_URL,
  ...PRECACHE_URLS.filter((url) => !url.startsWith('__')).map((url) => new URL(url, SCOPE).href),
];

// A redirected response cannot be used to answer a navigation, so rebuild it.
async function cleanResponse(response) {
  if (!response.redirected) return response;
  const body = await response.blob();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function findMissing(cache) {
  const checks = await Promise.all(ESSENTIAL_URLS.map((url) => cache.match(url)));
  return ESSENTIAL_URLS.filter((_, index) => !checks[index]);
}

async function store(cache, urls) {
  await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(new Request(url, { cache: 'reload' }));
      if (!response.ok) throw new Error(`Could not cache ${url} (${response.status})`);
      await cache.put(url, await cleanResponse(response));
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => store(cache, ESSENTIAL_URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // The operator signal is live data: never cached, never intercepted.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    // Every page of this single-page app is served by the same shell.
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const shell = await cache.match(SHELL_URL);
        if (shell) return shell;
        try {
          return await fetch(request);
        } catch {
          return new Response('This page is not available offline yet.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      return cached || fetch(request);
    })()
  );
});

// The organiser page asks whether everything needed offline is really stored.
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'VERIFY_CACHE') return;
  const port = event.ports && event.ports[0];
  if (!port) return;

  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        let missing = await findMissing(cache);
        if (missing.length > 0) {
          // Try to repair an incomplete cache; ignore failures (e.g. offline).
          await store(cache, missing).catch(() => {});
          missing = await findMissing(cache);
        }
        port.postMessage({
          version: VERSION,
          total: ESSENTIAL_URLS.length,
          missing: missing.length,
        });
      } catch {
        port.postMessage({ version: VERSION, total: ESSENTIAL_URLS.length, missing: -1 });
      }
    })()
  );
});
