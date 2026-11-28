/**
 * Player settings (audio, accessibility, service endpoints). Case progress is NOT stored here;
 * that belongs to `services/profiles.ts`. Corrupt or foreign data falls back to defaults.
 */
import type { StorageAdapter } from '../services/storage'


export type TextSize = 'normal' | 'large' | 'xlarge'
export type DialogueSpeed = 'slow' | 'normal' | 'fast' | 'instant'
export function dialogueSpeedRate(speed: DialogueSpeed): number | 'instant' {
  return speed === 'slow' ? 24 : speed === 'fast' ? 96 : speed === 'instant' ? 'instant' : 48
}
export type Settings = {
  version: 1
  musicVolume: number
  ambientVolume: number
  sfxVolume: number
  voiceVolume: number
  voiceEnabled: boolean
  muted: boolean
  reducedMotion: boolean
  /** Reading comfort: UI text size and a plainer, more legible heading font. */
  textSize: TextSize
  clearFont: boolean
  /** Simple mode: fewer tabs, bigger buttons and plainer screens (on by default). */
  simpleMode: boolean
  /** Reading size multiplier for dialogue, narration and hints (accessibility). */
  textScale: number
  /** Typewriter rate is configurable independently from motion-reduction preferences. */
  dialogueSpeed: DialogueSpeed
  /** Stronger borders/brighter text for low-vision players and bright sunlight. */
  highContrast: boolean
  /** Opt-in local crash capture and transmission when a build endpoint is configured. */
  crashReportsEnabled: boolean
  helpSeen: boolean
  hintEndpoint: string
  eventsUrl: string
}

const ROOT_FONT_SIZE: Record<TextSize, number> = { normal: 16, large: 20, xlarge: 22 }
export function rootFontSize(settings: Pick<Settings, 'textSize' | 'textScale'>): number {
  return Math.round(ROOT_FONT_SIZE[settings.textSize] * Math.min(1.2, Math.max(0.85, settings.textScale)))
}

const SETTINGS_KEY = 'ltt.settings.v1'

function defaultSettings(): Settings {
  return {
    version: 1,
    musicVolume: 0.7,
    ambientVolume: 0.65,
    sfxVolume: 0.8,
    voiceVolume: 0.85,
    voiceEnabled: true,
    muted: false,
    reducedMotion: false,
    textSize: 'normal',
    clearFont: true,
    simpleMode: true,
    highContrast: false,
    helpSeen: false,
    hintEndpoint: '',
    eventsUrl: '',
    textScale: 1,
    dialogueSpeed: 'normal',
    crashReportsEnabled: false,
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
    textSize: d.textSize === 'large' || d.textSize === 'xlarge' ? d.textSize : 'normal',
    clearFont: d.clearFont !== false,
    simpleMode: d.simpleMode !== false,
    highContrast: d.highContrast === true,
    helpSeen: d.helpSeen === true,
    hintEndpoint: url(d.hintEndpoint),
    eventsUrl: url(d.eventsUrl),
    textScale: num(d.textScale, base.textScale, 0.85, 1.4),
    dialogueSpeed: d.dialogueSpeed === 'slow' || d.dialogueSpeed === 'fast' || d.dialogueSpeed === 'instant' ? d.dialogueSpeed : 'normal',
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
