/**
 * Player settings (audio, accessibility, service endpoints). Case progress is NOT stored here;
 * that belongs to `services/profiles.ts`. Corrupt or foreign data falls back to defaults.
 */
import type { StorageAdapter } from '../services/storage'


export type Settings = {
  version: 1
  musicVolume: number
  ambientVolume: number
  sfxVolume: number
  voiceVolume: number
  voiceEnabled: boolean
  muted: boolean
  reducedMotion: boolean
  /** Optional URL of your hint proxy that talks to ChatGPT (see services/hints.ts). Empty = offline hints. */
  hintEndpoint: string
  /** Optional URL of a remote real-events JSON document (see services/eventsDb.ts). */
  eventsUrl: string
  /** Reading size multiplier for dialogue, narration and hints (accessibility). */
  textScale: number
  /** Stronger borders/brighter text for low-vision players and bright sunlight. */
  highContrast: boolean
  /** Opt-in local crash capture and transmission when a build endpoint is configured. */
  crashReportsEnabled: boolean
}

const SETTINGS_KEY = 'ltt.settings.v1'

function defaultSettings(): Settings {
  return {
    version: 1, musicVolume: 0.7, ambientVolume: 0.65, sfxVolume: 0.8, voiceVolume: 0.85, voiceEnabled: true, muted: false,
    reducedMotion: false, hintEndpoint: '', eventsUrl: '',
    textScale: 1, highContrast: false, crashReportsEnabled: false,
  }
}

const num = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
const url = (v: unknown) => (typeof v === 'string' && /^https?:\/\//i.test(v.trim()) ? v.trim().slice(0, 300) : '')

/** Parse untrusted stored JSON into valid settings (pure; unit tested). */
export function parseSettings(raw: string | null): Settings {
  const base = defaultSettings()
  if (!raw) return base
  let d: Record<string, unknown>
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return base
    d = parsed as Record<string, unknown>
  } catch {
    return base
  }
  return {
    version: 1,
    musicVolume: num(d.musicVolume, base.musicVolume, 0, 1),
    ambientVolume: num(d.ambientVolume, base.ambientVolume, 0, 1),
    sfxVolume: num(d.sfxVolume, base.sfxVolume, 0, 1),
    voiceVolume: num(d.voiceVolume, base.voiceVolume, 0, 1),
    voiceEnabled: d.voiceEnabled !== false,
    muted: d.muted === true,
    reducedMotion: d.reducedMotion === true,
    hintEndpoint: url(d.hintEndpoint),
    eventsUrl: url(d.eventsUrl),
    textScale: num(d.textScale, base.textScale, 0.85, 1.4),
    highContrast: d.highContrast === true,
    crashReportsEnabled: d.crashReportsEnabled === true,
  }
}

export class SettingsStore {
  data: Settings
  constructor(private readonly storage: StorageAdapter) {
    this.data = parseSettings(storage.get(SETTINGS_KEY))
  }
  update(patch: Partial<Settings>): void {
    this.data = parseSettings(JSON.stringify({ ...this.data, ...patch }))
    this.storage.set(SETTINGS_KEY, JSON.stringify(this.data))
  }
}
