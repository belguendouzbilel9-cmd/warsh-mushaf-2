// Offline support done safely this time:
// - index.html (and anything not explicitly listed below) is always fetched
//   fresh from the network first, so updates take effect immediately. Cache
//   is only a fallback for when there's no internet connection.
// - The big PDF part files, icons, and manifest rarely change once uploaded,
//   so they're served from cache instantly when available (fast + offline),
//   and refreshed in the cache in the background for next time.
const CACHE_NAME = "warsh-mushaf-v3";
const CACHE_FIRST_PATTERNS = [/\.pdf$/i, /\.png$/i, /manifest\.json$/i];

function isCacheFirst(url){
  return CACHE_FIRST_PATTERNS.some((re) => re.test(url));
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (isCacheFirst(req.url)) {
    // cache-first, refresh in background for next visit
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const networkFetch = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return cached || (await networkFetch) || new Response('', {status: 504});
    })());
  } else {
    // network-first, so page updates always show up when online;
    // cache is only used as an offline fallback
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, res.clone());
        }
        return res;
      } catch (e) {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        if (cached) return cached;
        throw e;
      }
    })());
  }
});
