import { describe, expect, it } from 'vitest'
import { GameClock, STORY, formatClock, hourInWindow, nowFromQuery, parseCairoLocal, partsOf } from '../src/core/clock'
import { evalGate, type GateContext } from '../src/core/gates'
import { GATES } from '../src/data/case01'
import { EventsDb, sanitizeEvent, type EventsDocument } from '../src/services/eventsDb'
import { MemoryStorage } from '../src/services/storage'
import seed from '../public/data/events.json'

const at = (s: string) => parseCairoLocal(s)

describe('clock', () => {
  it('parses Cairo-local strings and rejects overflowed dates', () => {
    expect(partsOf(at('2026-11-27T19:30')).hourFloat).toBe(19.5)
    expect(partsOf(at('2026-11-27T19:30')).weekday).toBe(5) // Friday
    expect(Number.isNaN(at('2026-02-31T10:00'))).toBe(true)
    expect(Number.isNaN(at('garbage'))).toBe(true)
  })
  it('wraps hour windows past midnight', () => {
    expect(hourInWindow(1, 14, 2)).toBe(true)
    expect(hourInWindow(13.9, 14, 2)).toBe(false)
    expect(hourInWindow(2, 14, 2)).toBe(false)
    expect(hourInWindow(5, 9, 17)).toBe(false)
  })
  it('formats Arabic clock faces', () => {
    expect(formatClock(19.5)).toBe('٧:٣٠ م')
    expect(formatClock(0)).toBe('١٢:٠٠ ص')
  })
  it('story clock darkens with play time and evidence', () => {
    const c = new GameClock({ mode: 'story', now: () => at('2026-01-01T09:00') })
    expect(c.hour).toBeCloseTo(STORY.startHour)
    c.tick(600)
    c.setEvidenceCount(4)
    expect(c.hour).toBeCloseTo(STORY.startHour + STORY.hoursPerMinute * 10 + STORY.hoursPerEvidence * 4)
  })
  it('realistic clock follows the injected real time', () => {
    const c = new GameClock({ mode: 'realistic', now: () => at('2026-01-01T09:15') })
    expect(c.hour).toBeCloseTo(9.25)
  })
  it('?now= pins the starting time and keeps advancing', () => {
    let real = at('2026-05-05T10:00')
    const now = nowFromQuery('?now=2026-11-27T18:30', () => real)
    expect(now()).toBe(at('2026-11-27T18:30'))
    real += 60_000
    expect(now()).toBe(at('2026-11-27T18:31'))
    expect(nowFromQuery('?now=bad', () => real)()).toBe(real)
  })
})

function ctx(mode: 'realistic' | 'story', when: string, near = false): GateContext {
  return { mode, stamp: at(when), eventNear: () => near }
}

describe('gates', () => {
  it('opens and closes by hour in realistic mode with a reason', () => {
    expect(evalGate(GATES.cafeOpen, ctx('realistic', '2026-11-25T15:00')).open).toBe(true)
    expect(evalGate(GATES.cafeOpen, ctx('realistic', '2026-11-25T01:00')).open).toBe(true)
    const closed = evalGate(GATES.cafeOpen, ctx('realistic', '2026-11-25T09:00'))
    expect(closed.open).toBe(false)
    expect(closed.reason).toContain('مقفولة')
  })
  it('story mode ignores every gate', () => {
    expect(evalGate(GATES.cafeOpen, ctx('story', '2026-11-25T09:00')).open).toBe(true)
    expect(evalGate(GATES.matchDay, ctx('story', '2026-11-25T09:00', false)).open).toBe(true)
  })
  it('onlyEventToday needs a nearby event', () => {
    expect(evalGate(GATES.matchDay, ctx('realistic', '2026-11-27T19:00', true)).open).toBe(true)
    expect(evalGate(GATES.matchDay, ctx('realistic', '2026-11-27T19:00', false)).open).toBe(false)
  })
  it('orEventToday opens outside hours when an event is near', () => {
    const gate = { hours: [{ from: 9, to: 10 }], orEventToday: 'market_day' as const }
    expect(evalGate(gate, ctx('realistic', '2026-11-26T20:00', true)).open).toBe(true)
    expect(evalGate(gate, ctx('realistic', '2026-11-26T20:00', false)).open).toBe(false)
  })
  it('an undefined gate is always open', () => {
    expect(evalGate(undefined, ctx('realistic', '2026-11-26T03:00')).open).toBe(true)
  })
})

describe('EventsDb', () => {
  const doc = (events: unknown[], version = 1, extra: Partial<EventsDocument> = {}): EventsDocument => ({ schemaVersion: 1, version, events: events as EventsDocument['events'], ...extra })
  const match = { id: 'm1', kind: 'match_ittihad', title: 'مباراة', at: '2026-11-27T19:00', updatedAt: 1 }

  it('loads the bundled seed and expands weekly recurrence', () => {
    const db = new EventsDb(new MemoryStorage())
    db.init(seed as unknown as EventsDocument)
    expect(db.size).toBeGreaterThanOrEqual(5)
    // 2026-11-27 is a Friday: prayer 11:30-13:30.
    expect(db.activeAt(at('2026-11-27T12:00'), 'friday_prayer')).toHaveLength(1)
    expect(db.activeAt(at('2026-11-27T15:00'), 'friday_prayer')).toHaveLength(0)
    expect(db.occurrencesOn(at('2026-12-03T10:00'), 'market_day')).toHaveLength(1) // Thursday
  })
  it('matches are active for kickoff+2h and "near" extends by padding', () => {
    const db = new EventsDb(new MemoryStorage())
    db.merge(doc([match]), 'test')
    expect(db.activeAt(at('2026-11-27T20:30'), 'match_ittihad')).toHaveLength(1)
    expect(db.near('match_ittihad', at('2026-11-27T16:30'), 3)).toBe(true)
    expect(db.near('match_ittihad', at('2026-11-27T23:30'), 3)).toBe(true)
    expect(db.near('match_ittihad', at('2026-11-28T12:00'), 3)).toBe(false)
  })
  it('lists upcoming events in order', () => {
    const db = new EventsDb(new MemoryStorage())
    db.merge(doc([match, { ...match, id: 'm2', at: '2026-12-04T20:30' }]), 'test')
    const up = db.upcoming(at('2026-11-26T00:00'), 5, 'match_ittihad')
    expect(up.map(o => o.event.id)).toEqual(['m1', 'm2'])
  })
  it('higher updatedAt replaces a placeholder; lower is ignored; tombstones remove', () => {
    const db = new EventsDb(new MemoryStorage())
    db.merge(doc([{ ...match, provisional: true }]), 'seed')
    expect(db.merge(doc([{ ...match, at: '2026-11-28T18:00', updatedAt: 2 }], 2), 'remote')).toBe(1)
    expect(db.all()[0].at).toBe('2026-11-28T18:00')
    expect(db.all()[0].provisional).toBe(false)
    expect(db.merge(doc([{ ...match, at: '2026-11-29T18:00', updatedAt: 1 }]), 'old')).toBe(0)
    db.merge(doc([], 3, { removed: ['m1'] }), 'remote')
    expect(db.size).toBe(0)
  })
  it('drops malformed records and unknown future schemas', () => {
    expect(sanitizeEvent({ id: 'x', kind: 'nope', title: 't', at: '2026-01-01T10:00' }, 's')).toBeUndefined()
    expect(sanitizeEvent({ id: 'x', kind: 'match_ittihad', title: 't', at: 'soon' }, 's')).toBeUndefined()
    const db = new EventsDb(new MemoryStorage())
    expect(db.merge({ schemaVersion: 99, version: 1, events: [match as never] }, 'x')).toBe(0)
  })
  it('persists a remote refresh and survives provider failure', async () => {
    const storage = new MemoryStorage()
    const ok = { name: 'ok', load: async () => doc([match], 5) }
    const bad = { name: 'bad', load: async () => { throw new Error('offline') } }
    const db = new EventsDb(storage, [bad, ok])
    expect(await db.refresh()).toBe(1)
    const db2 = new EventsDb(storage)
    db2.init(doc([]))
    expect(db2.size).toBe(1)
    expect(db2.docVersion).toBe(5)
  })
})
