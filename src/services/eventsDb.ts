/**
 * Real-events database service.
 *
 * Holds the calendar of real-world happenings (football fixtures, market days, prayer times) that
 * influence when clues appear in Realistic mode. Designed to grow without game releases:
 *
 * - **Layered sources**: bundled seed → cached copy → any number of remote JSON providers.
 * - **Idempotent merge**: records are keyed by `id`; the higher `updatedAt` wins, so republishing a
 *   corrected fixture list simply overrides the placeholder. A document may also list `removed` ids.
 * - **Versioned schema**: documents carry `schemaVersion`; unknown future versions are ignored
 *   rather than crashing, and malformed records are dropped one by one.
 * - **Recurrence**: weekly schedules are expanded on demand, never stored as thousands of rows.
 *
 * Everything time-related uses Cairo stamps (see `core/clock.ts`).
 */
import type { EventKind, RealEvent } from '../data/types'
import { MS_DAY, MS_HOUR, parseCairoLocal, parseHm, partsOf, startOfDay } from '../core/clock'
import type { StorageAdapter } from './storage'

const EVENTS_SCHEMA_VERSION = 1
const CACHE_KEY = 'ltt.events.v1'
const KINDS: readonly EventKind[] = ['match_ittihad', 'match_ahly', 'market_day', 'friday_prayer']
/** Default duration when `endsAt` is missing. */
const DEFAULT_DURATION_H: Record<EventKind, number> = { match_ittihad: 2, match_ahly: 2, market_day: 7, friday_prayer: 2 }

export type EventsDocument = {
  schemaVersion: number
  version: number
  events: RealEvent[]
  /** Ids to delete (tombstones), applied after upserts of the same document. */
  removed?: string[]
}

/** Where event documents come from. Implement for a REST API, Firestore, a CMS … */
export interface EventsProvider {
  readonly name: string
  load(): Promise<EventsDocument>
}

/** One concrete occurrence of an event on the calendar. */
export type Occurrence = { event: RealEvent; start: number; end: number }

/** Fetches a JSON document over HTTP with a timeout. */
export class JsonUrlProvider implements EventsProvider {
  constructor(readonly name: string, private readonly url: string, private readonly timeoutMs = 6000) {}
  async load(): Promise<EventsDocument> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs)
    try {
      const res = await fetch(this.url, { signal: ctrl.signal, cache: 'no-cache' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as EventsDocument
    } finally {
      clearTimeout(timer)
    }
  }
}

/** Validate and normalise one record; returns undefined when it is unusable. */
export function sanitizeEvent(raw: unknown, source: string): RealEvent | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const e = raw as Partial<RealEvent>
  if (typeof e.id !== 'string' || !e.id || !e.kind || !KINDS.includes(e.kind) || typeof e.title !== 'string') return undefined
  if (typeof e.at !== 'string' || Number.isNaN(parseCairoLocal(e.at))) return undefined
  if (e.endsAt !== undefined && Number.isNaN(parseCairoLocal(e.endsAt))) return undefined
  if (e.recurring) {
    const r = e.recurring
    if (!Number.isInteger(r.weekday) || r.weekday < 0 || r.weekday > 6 || Number.isNaN(parseHm(r.from)) || Number.isNaN(parseHm(r.to))) return undefined
  }
  return {
    id: e.id.slice(0, 80), kind: e.kind, title: e.title.slice(0, 160), at: e.at, endsAt: e.endsAt,
    venue: e.venue?.slice(0, 120), note: e.note?.slice(0, 240), recurring: e.recurring,
    provisional: e.provisional === true, source: e.source ?? source, updatedAt: Number.isFinite(e.updatedAt) ? e.updatedAt : 0,
  }
}

export class EventsDb {
  private events = new Map<string, RealEvent>()
  private version = 0
  /** Ids deleted by a remote document; persisted so a bundled seed cannot resurrect them. */
  private readonly removed = new Set<string>()

  constructor(private readonly storage: StorageAdapter, private readonly providers: EventsProvider[] = []) {}

  /** Load bundled seed, then the cached copy. Call once at boot; never throws. */
  init(seed: EventsDocument): void {
    this.merge(seed, 'seed')
    try {
      const cached = this.storage.get(CACHE_KEY)
      if (cached) this.merge(JSON.parse(cached) as EventsDocument, 'cache')
    } catch {
      this.storage.remove(CACHE_KEY)
    }
  }

  /** Pull every remote provider; failures are isolated. Returns how many records changed. */
  async refresh(): Promise<number> {
    let changed = 0
    for (const provider of this.providers) {
      try {
        changed += this.merge(await provider.load(), `remote:${provider.name}`)
      } catch {
        // Offline or server down: keep serving what we have.
      }
    }
    if (changed > 0) this.persist()
    return changed
  }

  /** Merge a document. Returns the number of inserted/updated/removed records. */
  merge(doc: EventsDocument, source: string): number {
    if (!doc || typeof doc !== 'object' || doc.schemaVersion > EVENTS_SCHEMA_VERSION || !Array.isArray(doc.events)) return 0
    let changed = 0
    for (const raw of doc.events) {
      const ev = sanitizeEvent(raw, source)
      if (!ev) continue
      const prev = this.events.get(ev.id)
      if (!prev || (ev.updatedAt ?? 0) > (prev.updatedAt ?? 0)) {
        this.events.set(ev.id, ev)
        changed++
      }
    }
    for (const id of doc.removed ?? []) {
      if (typeof id !== 'string') continue
      this.removed.add(id)
      if (this.events.delete(id)) changed++
    }
    this.version = Math.max(this.version, doc.version ?? 0)
    return changed
  }

  /** Add or replace a record directly (admin tools, tests). */
  upsert(event: RealEvent): boolean {
    const ev = sanitizeEvent(event, event.source ?? 'user')
    if (!ev) return false
    this.events.set(ev.id, ev)
    this.persist()
    return true
  }

  private persist(): void {
    const doc: EventsDocument = { schemaVersion: EVENTS_SCHEMA_VERSION, version: this.version, events: [...this.events.values()], removed: [...this.removed] }
    try {
      this.storage.set(CACHE_KEY, JSON.stringify(doc))
    } catch {
      // Storage full/disabled: the in-memory copy still works.
    }
  }

  get size(): number {
    return this.events.size
  }
  get docVersion(): number {
    return this.version
  }
  all(): RealEvent[] {
    return [...this.events.values()]
  }

  /** Expand one event into the occurrences overlapping [from, to]. */
  private expand(ev: RealEvent, from: number, to: number): Occurrence[] {
    const out: Occurrence[] = []
    if (ev.recurring) {
      const r = ev.recurring
      const first = parseCairoLocal(ev.at)
      const h0 = parseHm(r.from)
      const h1 = parseHm(r.to)
      for (let day = startOfDay(from) - MS_DAY; day <= to; day += MS_DAY) {
        if (partsOf(day).weekday !== r.weekday || day + MS_DAY <= startOfDay(first)) continue
        const start = day + h0 * MS_HOUR
        const end = day + (h1 > h0 ? h1 : h1 + 24) * MS_HOUR
        if (end >= from && start <= to) out.push({ event: ev, start, end })
      }
    } else {
      const start = parseCairoLocal(ev.at)
      const end = ev.endsAt ? parseCairoLocal(ev.endsAt) : start + DEFAULT_DURATION_H[ev.kind] * MS_HOUR
      if (end >= from && start <= to) out.push({ event: ev, start, end })
    }
    return out
  }

  /** All occurrences overlapping [from, to], sorted by start. */
  between(from: number, to: number, kind?: EventKind): Occurrence[] {
    const out: Occurrence[] = []
    for (const ev of this.events.values()) if (!kind || ev.kind === kind) out.push(...this.expand(ev, from, to))
    return out.sort((a, b) => a.start - b.start)
  }

  /** Occurrences happening at `stamp`. */
  activeAt(stamp: number, kind?: EventKind): Occurrence[] {
    return this.between(stamp, stamp, kind)
  }

  /** Occurrences on the Cairo calendar day of `stamp`. */
  occurrencesOn(stamp: number, kind?: EventKind): Occurrence[] {
    const day = startOfDay(stamp)
    return this.between(day, day + MS_DAY - 1, kind)
  }

  /** Is an occurrence of `kind` happening within `paddingHours` before its start or after its end? */
  near(kind: EventKind, stamp: number, paddingHours: number): boolean {
    const pad = paddingHours * MS_HOUR
    return this.between(stamp - pad, stamp + pad, kind).some(o => stamp >= o.start - pad && stamp <= o.end + pad)
  }

  /** Next `limit` occurrences starting after `stamp`, looking up to `horizonDays` ahead. */
  upcoming(stamp: number, limit = 5, kind?: EventKind, horizonDays = 120): Occurrence[] {
    return this.between(stamp, stamp + horizonDays * MS_DAY, kind).filter(o => o.end >= stamp).slice(0, limit)
  }
}
