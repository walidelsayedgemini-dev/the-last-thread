/**
 * Player settings (audio, graphics, controls, service endpoints). Case progress is NOT stored here;
 * that belongs to `services/profiles.ts`. Corrupt or foreign data falls back to defaults.
 */
import type { StorageAdapter } from '../services/storage'

export type Quality = 'low' | 'medium' | 'high'

export type TextSize = 'normal' | 'large' | 'xlarge'
export type Settings = {
  version: 1
  musicVolume: number
  sfxVolume: number
  muted: boolean
  sensitivity: number
  invertY: boolean
  quality: Quality
  reducedMotion: boolean
  /** Reading comfort: UI text size and a plainer, more legible heading font. */
  textSize: TextSize
  clearFont: boolean
  /** Simple mode: fewer tabs, bigger buttons and plainer screens (on by default). */
  simpleMode: boolean
  /** Stronger borders and text contrast for low vision. */
  highContrast: boolean
  /** The first-run help card was shown. */
  helpSeen: boolean
  /** Optional URL of your hint proxy that talks to ChatGPT (see services/hints.ts). Empty = offline hints. */
  hintEndpoint: string
  /** Optional URL of the AI photo-analysis endpoint (see services/ar). Empty = GPS verification. */
  visionEndpoint: string
  /** Optional URL of a remote real-events JSON document (see services/eventsDb.ts). */
  eventsUrl: string
}

export const SETTINGS_KEY = 'ltt.settings.v1'

export function defaultSettings(): Settings {
  return {
    version: 1, musicVolume: 0.7, sfxVolume: 0.8, muted: false, sensitivity: 1, invertY: false,
    quality: 'medium', reducedMotion: false, textSize: 'normal', clearFont: true, simpleMode: true, highContrast: false, helpSeen: false, hintEndpoint: '', visionEndpoint: '', eventsUrl: '',
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
    sfxVolume: num(d.sfxVolume, base.sfxVolume, 0, 1),
    muted: d.muted === true,
    sensitivity: num(d.sensitivity, base.sensitivity, 0.3, 2.5),
    invertY: d.invertY === true,
    quality: d.quality === 'low' || d.quality === 'medium' || d.quality === 'high' ? d.quality : base.quality,
    reducedMotion: d.reducedMotion === true,
    textSize: d.textSize === 'large' || d.textSize === 'xlarge' ? d.textSize : 'normal',
    clearFont: d.clearFont !== false,
    simpleMode: d.simpleMode !== false,
    highContrast: d.highContrast === true,
    helpSeen: d.helpSeen === true,
    hintEndpoint: url(d.hintEndpoint),
    visionEndpoint: url(d.visionEndpoint),
    eventsUrl: url(d.eventsUrl),
  }
}

export class SettingsStore {
  data: Settings
  constructor(private readonly storage: StorageAdapter) {
    this.data = parseSettings(storage.get(SETTINGS_KEY))
  }
  /** True when nothing was ever stored (used to choose a first-run quality preset). */
  get firstRun(): boolean {
    return this.storage.get(SETTINGS_KEY) === null
  }
  update(patch: Partial<Settings>): void {
    this.data = parseSettings(JSON.stringify({ ...this.data, ...patch }))
    this.storage.set(SETTINGS_KEY, JSON.stringify(this.data))
  }
}
