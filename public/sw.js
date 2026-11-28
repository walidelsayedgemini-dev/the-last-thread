const CACHE_NAME = 'ltt-cache-v3'
// Runtime cache: scene art, voice clips (including audio/voice/), music and fonts enter when requested.
const ASSET_CACHE = /\/(?:assets\/[^/]+-[A-Za-z0-9_-]{6,}\.[^/]+|audio\/(?:voice\/)?[^/]+\.(?:mp3|ogg|wav)|fonts\/[^/]+\.woff2)$/

function isSingleByteRange(header) {
  return /^bytes=(?:\d*-[0-9]+|[0-9]+-\d*)$/i.test(header)
}

function withoutRange(request) {
  const headers = new Headers(request.headers)
  headers.delete('range')
  headers.delete('if-range')
  return new Request(request.url, { method: 'GET', headers, mode: request.mode, credentials: request.credentials })
}

async function toPartialResponse(response, rangeHeader) {
  const bytes = await response.arrayBuffer()
  const size = bytes.byteLength
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader)
  const headers = new Headers(response.headers)
  headers.delete('content-encoding')
  headers.delete('content-length')
  headers.delete('content-range')
  headers.set('accept-ranges', 'bytes')

  if (!match || (!match[1] && !match[2]) || size === 0) {
    headers.set('content-range', `bytes */${size}`)
    return new Response(null, { status: 416, statusText: 'Range Not Satisfiable', headers })
  }

  let start
  let end
  if (!match[1]) {
    const suffix = Number(match[2])
    if (!Number.isSafeInteger(suffix) || suffix <= 0) {
      headers.set('content-range', `bytes */${size}`)
      return new Response(null, { status: 416, statusText: 'Range Not Satisfiable', headers })
    }
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] ? Number(match[2]) : size - 1
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) {
      headers.set('content-range', `bytes */${size}`)
      return new Response(null, { status: 416, statusText: 'Range Not Satisfiable', headers })
    }
    end = Math.min(end, size - 1)
  }

  headers.set('content-range', `bytes ${start}-${end}/${size}`)
  headers.set('content-length', String(end - start + 1))
  return new Response(bytes.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers })
}

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
    const rangeHeader = request.headers.get('range')
    if (rangeHeader && !isSingleByteRange(rangeHeader)) {
      event.respondWith(fetch(request))
      return
    }
    const cacheRequest = rangeHeader ? withoutRange(request) : request
    event.respondWith(caches.open(CACHE_NAME).then(async cache => {
      let response = await cache.match(cacheRequest)
      if (!response) {
        response = await fetch(cacheRequest)
        if (!response.ok || response.status !== 200) return response
        await cache.put(cacheRequest, response.clone())
      }
      return rangeHeader ? toPartialResponse(response, rangeHeader) : response
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
