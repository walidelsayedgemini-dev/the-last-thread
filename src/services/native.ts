import type { BackButtonListener } from '@capacitor/app'

type NativeCapacitor = {
  isNativePlatform?: () => boolean
}

type AppPlugin = {
  addListener: (eventName: 'backButton', listenerFunc: BackButtonListener) => Promise<{ remove: () => Promise<void> }>
  minimizeApp?: () => Promise<void>
  exitApp?: () => Promise<void>
}

type HapticsPlugin = {
  impact: (options: { style: 'LIGHT' | 'MEDIUM' }) => Promise<void>
  notification: (options: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }) => Promise<void>
}

function capacitor(): NativeCapacitor | undefined {
  if (typeof globalThis === 'undefined') return undefined
  return (globalThis as typeof globalThis & { Capacitor?: NativeCapacitor }).Capacitor
}

/** True when the game is running inside a Capacitor native WebView. */
export function isNative(): boolean {
  try {
    return capacitor()?.isNativePlatform?.() === true
  } catch {
    return false
  }
}

/** Register Android's hardware back handler. On web this intentionally does nothing. */
export function onBackButton(handler: () => boolean): void {
  if (!isNative()) return
  void import('@capacitor/app').then(async ({ App }) => {
    const plugin = App as unknown as AppPlugin
    await plugin.addListener('backButton', () => {
      let handled = false
      try { handled = handler() } catch { handled = false }
      if (!handled) void (plugin.minimizeApp?.() ?? plugin.exitApp?.() ?? Promise.resolve())
    })
  }).catch(() => undefined)
}

/** Trigger a semantic haptic; native failures and unsupported web APIs are always ignored. */
export function haptic(kind: 'light' | 'medium' | 'success' | 'warning' | 'error'): void {
  if (isNative()) {
    void import('@capacitor/haptics').then(async ({ Haptics }) => {
      const plugin = Haptics as unknown as HapticsPlugin
      if (kind === 'light' || kind === 'medium') await plugin.impact({ style: kind.toUpperCase() as 'LIGHT' | 'MEDIUM' })
      else await plugin.notification({ type: kind.toUpperCase() as 'SUCCESS' | 'WARNING' | 'ERROR' })
    }).catch(() => undefined)
    return
  }
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    const pattern: number | number[] = kind === 'light' ? 10 : kind === 'medium' ? 22 : kind === 'success' ? [12, 18, 12] : kind === 'warning' ? [18, 18, 18] : [28, 24, 28]
    navigator.vibrate(pattern)
  } catch {
    // Haptics are best-effort and must never interrupt gameplay.
  }
}
