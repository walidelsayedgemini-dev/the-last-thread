import type { StorageAdapter } from './storage'

const BUFFER_KEY = 'ltt.crash.v1'
const MAX_EVENTS = 12
const ENDPOINT = import.meta.env.VITE_CRASH_ENDPOINT ?? ''

type CrashRecord = {
  at: string
  kind: 'error' | 'unhandledrejection'
  message: string
  stack?: string
  url: string
}

const text = (value: unknown): string => {
  if (value instanceof Error) return value.message || value.name
  if (typeof value === 'string') return value
  try { return JSON.stringify(value) } catch { return String(value) }
}

export class CrashReporter {
  private enabled: boolean
  private readonly onError = (event: ErrorEvent) => this.capture({
    kind: 'error', message: event.message || text(event.error), stack: event.error?.stack,
  })
  private readonly onRejection = (event: PromiseRejectionEvent) => this.capture({
    kind: 'unhandledrejection', message: text(event.reason), stack: event.reason instanceof Error ? event.reason.stack : undefined,
  })

  constructor(private readonly storage: StorageAdapter, enabled = false) {
    this.enabled = enabled
    if (typeof window !== 'undefined') {
      window.addEventListener('error', this.onError)
      window.addEventListener('unhandledrejection', this.onRejection)
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (enabled) void this.flush()
  }

  get records(): CrashRecord[] {
    return this.read()
  }

  dispose(): void {
    if (typeof window === 'undefined') return
    window.removeEventListener('error', this.onError)
    window.removeEventListener('unhandledrejection', this.onRejection)
  }

  capture(input: { kind: CrashRecord['kind']; message: string; stack?: string }): void {
    const next: CrashRecord = {
      at: new Date().toISOString(), kind: input.kind, message: input.message.slice(0, 600),
      stack: input.stack?.slice(0, 1600), url: typeof location === 'undefined' ? '' : location.pathname,
    }
    const records = [...this.read(), next].slice(-MAX_EVENTS)
    try { this.storage.set(BUFFER_KEY, JSON.stringify(records)) } catch { /* storage is best effort */ }
    if (this.enabled && ENDPOINT) void this.flush()
  }

  private read(): CrashRecord[] {
    try {
      const parsed = JSON.parse(this.storage.get(BUFFER_KEY) ?? '[]')
      return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.message === 'string').slice(-MAX_EVENTS) : []
    } catch { return [] }
  }

  private async flush(): Promise<void> {
    if (!this.enabled || !ENDPOINT || typeof fetch === 'undefined') return
    const records = this.read()
    if (!records.length) return
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ app: 'al-khayt-al-akheer', version: 1, records }), keepalive: true,
      })
      if (response.ok) this.storage.remove(BUFFER_KEY)
    } catch { /* crash reporting must never affect play */ }
  }
}
