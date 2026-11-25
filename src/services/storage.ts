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

/** `localStorage` with graceful degradation (private mode / quota errors fall back to memory). */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly fallback = new MemoryStorage()
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return this.fallback.get(key)
    }
  }
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch {
      this.fallback.set(key, value)
    }
  }
  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      this.fallback.remove(key)
    }
  }
}
