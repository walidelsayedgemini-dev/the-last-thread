const CACHE_NAME = 'ltt-cache-v2'
// Runtime cache: scene art, voice clips (including audio/voice/), music and fonts enter when requested.
const ASSET_CACHE = /\/(?:assets\/[^/]+-[A-Za-z0-9_-]{6,}\.[^/]+|audio\/(?:voice\/)?[^/]+\.(?:mp3|ogg|wav)|fonts\/[^/]+\.woff2)$/

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (ASSET_CACHE.test(url.pathname)) {
    event.respondWith(caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) await cache.put(request, response.clone())
      return response
    }))
    return
  }
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) void caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()))
      return response
    }).catch(() => caches.match(request).then(cached => cached ?? caches.match('./index.html'))))
  }
})
