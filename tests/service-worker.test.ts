import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const workerSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')

describe('service worker runtime asset cache', () => {
  it('caches a voice clip under audio/voice and serves the cached response on a later offline lookup', async () => {
    const listeners = new Map<string, (event: any) => void>()
    const cache = { match: vi.fn(async (): Promise<any> => undefined), put: vi.fn(async () => undefined) }
    const caches = {
      open: vi.fn(async () => cache),
      keys: vi.fn(async () => []),
      delete: vi.fn(async () => true),
      match: vi.fn(async () => undefined),
    }
    const networkResponse = { ok: true, clone: () => ({ cachedCopy: true }) }
    const fetch = vi.fn(async () => networkResponse)
    const self = {
      location: { origin: 'https://game.test' },
      addEventListener: (type: string, callback: (event: any) => void) => listeners.set(type, callback),
      skipWaiting: vi.fn(async () => undefined),
    }
    runInNewContext(workerSource, { self, caches, fetch, URL })
    const request = {
      method: 'GET',
      url: 'https://game.test/audio/voice/case01-intro.mp3',
      mode: 'cors',
      headers: { get: () => null },
    }
    const dispatch = () => {
      let response: Promise<unknown> | undefined
      listeners.get('fetch')!({ request, respondWith: (value: Promise<unknown>) => { response = value } })
      return response!
    }

    expect(await dispatch()).toBe(networkResponse)
    expect(fetch).toHaveBeenCalledOnce()
    expect(cache.put).toHaveBeenCalledWith(request, { cachedCopy: true })

    const offlineResponse = { ok: true, cached: true }
    cache.match.mockResolvedValue(offlineResponse)
    expect(await dispatch()).toBe(offlineResponse)
    expect(fetch).toHaveBeenCalledOnce()
  })
})
