/**
 * Game clock and Cairo-time helpers.
 *
 * All calendar logic works on a "Cairo stamp": the wall-clock time in Africa/Cairo expressed as the
 * milliseconds of the same wall-clock read as UTC. A stamp therefore ignores daylight-saving jumps
 * after conversion and can be compared, added to and decomposed with plain arithmetic. Event data
 * (`RealEvent.at`) is stored in the same local format, so no time-zone maths leaks into gameplay.
 */
import type { GameMode } from '../data/types'

export const MS_HOUR = 3_600_000
export const MS_DAY = 86_400_000
const CAIRO_TZ = 'Africa/Cairo'

export type CairoParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number
  /** Fractional hour of day (e.g. 18.5 = 18:30). */
  hourFloat: number
  /** `YYYY-MM-DD`. */
  date: string
}

const cairoFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: CAIRO_TZ, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
})

/** Convert an absolute instant to a Cairo stamp. */
export function cairoStamp(instant: Date | number): number {
  const parts: Record<string, number> = {}
  for (const p of cairoFormat.formatToParts(instant)) if (p.type !== 'literal') parts[p.type] = Number(p.value)
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
}

/** Parse `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm[:ss]` (Cairo local) into a stamp; NaN if malformed. */
export function parseCairoLocal(text: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(text.trim())
  if (!m) return Number.NaN
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = m
  const stamp = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)
  // Reject overflowed dates such as 2026-02-31.
  const back = new Date(stamp)
  return back.getUTCMonth() === +mo - 1 && back.getUTCDate() === +d ? stamp : Number.NaN
}

/** Parse `HH:mm` into fractional hours (NaN if malformed). */
export function parseHm(text: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim())
  if (!m || +m[1] > 24 || +m[2] > 59) return Number.NaN
  return +m[1] + +m[2] / 60
}

export function partsOf(stamp: number): CairoParts {
  const d = new Date(stamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  const hour = d.getUTCHours()
  const minute = d.getUTCMinutes()
  return {
    year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour, minute,
    weekday: d.getUTCDay(), hourFloat: hour + minute / 60,
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
  }
}

/** Start of the Cairo day containing `stamp`. */
export function startOfDay(stamp: number): number {
  return Math.floor(stamp / MS_DAY) * MS_DAY
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
export function arabicDigits(text: string | number): string {
  return String(text).replace(/\d/g, d => AR_DIGITS[+d])
}

/** `٠٧:٣٠ م` style clock face. */
export function formatClock(hourFloat: number): string {
  const total = Math.round(((hourFloat % 24) + 24) * 60) % (24 * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${arabicDigits(String(h12))}:${arabicDigits(String(m).padStart(2, '0'))} ${h >= 12 ? 'م' : 'ص'}`
}

const AR_WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
export function formatDate(stamp: number): string {
  const p = partsOf(stamp)
  return `${AR_WEEKDAYS[p.weekday]} ${arabicDigits(p.day)} ${AR_MONTHS[p.month - 1]} ${arabicDigits(p.year)}`
}
export function formatDateTime(stamp: number): string {
  return `${formatDate(stamp)} – ${formatClock(partsOf(stamp).hourFloat)}`
}

/** True when `hour` lies inside the [from, to) window; windows may wrap past midnight. */
export function hourInWindow(hour: number, from: number, to: number): boolean {
  if (from === to) return true
  return from < to ? hour >= from && hour < to : hour >= from || hour < to
}

/** Story-mode clock constants (see {@link GameClock}). */
export const STORY = { startHour: 17.5, hoursPerMinute: 0.12, hoursPerEvidence: 0.35 } as const

export type ClockOptions = {
  mode: GameMode
  /** Injectable wall clock (tests, `?now=` override). Returns the current Cairo stamp. */
  now?: () => number
}

/**
 * Single source of "what time is it in the game".
 *
 * - Realistic: the real Cairo time (or an override that keeps advancing in real time).
 * - Story: a private clock that starts at dusk and advances with play time and discovered clues, so
 *   the mood darkens as the case deepens regardless of the real hour.
 */
export class GameClock {
  mode: GameMode
  private readonly now: () => number
  private storyMinutes = 0
  private evidenceCount = 0
  private penaltyMsValue = 0

  constructor(opts: ClockOptions) {
    this.mode = opts.mode
    this.now = opts.now ?? (() => cairoStamp(new Date()))
  }

  /** Advance story time by real elapsed seconds (called from the fixed step). */
  tick(seconds: number): void {
    this.storyMinutes += seconds / 60
  }

  setEvidenceCount(n: number): void {
    this.evidenceCount = n
  }

  /** Restore saved story progress. */
  restore(storyMinutes: number): void {
    this.storyMinutes = Math.max(0, storyMinutes)
  }
  /** Advance the investigation clock deliberately (for consequences such as a false accusation). */
  advanceMinutes(minutes: number): void {
    if (!Number.isFinite(minutes) || minutes <= 0) return
    if (this.mode === 'realistic') this.penaltyMsValue += minutes * 60_000
    else this.storyMinutes += minutes
  }

  /**
   * Realistic-mode penalty carried by wrong accusations, in real milliseconds. It is saved with
   * the profile so the lost hour survives closing and reopening the game.
   */
  get penaltyMs(): number {
    return this.penaltyMsValue
  }

  /** Restore a saved penalty (values are clamped to a sane range). */
  restorePenalty(ms: number): void {
    this.penaltyMsValue = Number.isFinite(ms) ? Math.min(7 * MS_DAY, Math.max(0, ms)) : 0
  }
  get elapsedStoryMinutes(): number {
    return this.storyMinutes
  }

  /** Current Cairo stamp (always the real calendar; story mode only uses it for display of dates). */
  get stamp(): number {
    return this.now() + this.penaltyMsValue
  }

  /** Hour of the in-game day, 0–24. */
  get hour(): number {
    if (this.mode === 'realistic') return partsOf(this.stamp).hourFloat
    const h = STORY.startHour + STORY.hoursPerMinute * this.storyMinutes + STORY.hoursPerEvidence * this.evidenceCount
    return ((h % 24) + 24) % 24
  }
}

/**
 * Build a `now()` source from URL query parameters. `?now=2026-11-27T18:30` pins the starting
 * Cairo time and lets it keep running, which is how realistic-mode gates are tested without waiting.
 */
export function nowFromQuery(search: string, real: () => number = () => cairoStamp(new Date())): () => number {
  const raw = new URLSearchParams(search).get('now')
  const pinned = raw ? parseCairoLocal(raw) : Number.NaN
  if (Number.isNaN(pinned)) return real
  const offset = pinned - real()
  return () => real() + offset
}
