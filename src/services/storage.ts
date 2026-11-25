/**
 * Storage abstraction shared by services. The browser uses `localStorage`; tests use memory; the
 * AntiGravity phase can plug in a cloud-synced adapter without changing any service.
 */
export interface StorageAdapter {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export class MemoryStorage implements StorageAdapter {
  private readonly data = new Map<string, string>()
  get(key: string): string | null {
    return this.data.get(key) ?? null
  }
  set(key: string, value: string): void {
    this.data.set(key, value)
  }
  remove(key: string): void {
    this.data.delete(key)
  }
}

/**
 * `localStorage` with graceful degradation. After the first failed write (quota full, private mode)
 * the adapter switches to memory for good, so reads never return stale data behind a newer save.
 */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly fallback = new MemoryStorage()
  private degraded = false
  /** True once the browser storage refused a write; the UI may warn that progress is session-only. */
  get isDegraded(): boolean {
    return this.degraded
  }
  get(key: string): string | null {
    if (this.degraded) return this.fallback.get(key)
    try {
      return localStorage.getItem(key)
    } catch {
      return this.fallback.get(key)
    }
  }
  set(key: string, value: string): void {
    if (!this.degraded) {
      try {
        localStorage.setItem(key, value)
        return
      } catch {
        this.degrade()
      }
    }
    this.fallback.set(key, value)
  }
  remove(key: string): void {
    this.fallback.remove(key)
    if (this.degraded) return
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore: nothing to remove
    }
  }
  /** Copy what is readable into memory, then stop touching localStorage. */
  private degrade(): void {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k) this.fallback.set(k, localStorage.getItem(k) ?? '')
      }
    } catch {
      // unreadable as well: start empty
    }
    this.degraded = true
  }
}
