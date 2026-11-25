/** Regression tests for the issues found in the architecture review. */
import { describe, expect, it, vi } from 'vitest'
import { CaseEngine, CaseState } from '../src/core/caseState'
import { parseCairoLocal } from '../src/core/clock'
import type { GateContext } from '../src/core/gates'
import { CASE_01 } from '../src/data/case01'
import { EventsDb, type EventsDocument } from '../src/services/eventsDb'
import { LocalStorageAdapter, MemoryStorage } from '../src/services/storage'

describe('finale gate', () => {
  it('stays closed until Mahmoud has been found, even with every deduction tied', () => {
    const state = new CaseState()
    const engine = new CaseEngine(CASE_01, state, (): GateContext => ({ mode: 'story', stamp: parseCairoLocal('2026-11-25T12:00'), eventNear: () => false }))
    engine.apply(['e_boundary_stone', 'e_survey_book', 'e_library_envelope', 'e_forged_contract', 'e_thread_door', 'e_qaitbay_photo'].map(id => ({ type: 'evidence', id }) as never))
    engine.tie('e_boundary_stone', 'e_survey_book')
    engine.tie('e_library_envelope', 'e_forged_contract')
    engine.tie('e_thread_door', 'e_qaitbay_photo')
    expect(engine.canAccuse()).toBe(false)
    engine.apply([{ type: 'flag', id: 'found_mahmoud' }])
    expect(engine.canAccuse()).toBe(true)
  })
})

describe('events tombstones', () => {
  const seed: EventsDocument = { schemaVersion: 1, version: 1, events: [{ id: 'x', title: 't', at: '2026-12-01T18:00', kind: 'match_ittihad' }] }
  it('a remote deletion of a seeded event survives a restart', () => {
    const storage = new MemoryStorage()
    const a = new EventsDb(storage)
    a.init(seed)
    expect(a.all().map(e => e.id)).toEqual(['x'])
    a.merge({ schemaVersion: 1, version: 2, events: [], removed: ['x'] }, 'remote')
    a.upsert({ id: 'y', title: 'other', at: '2026-12-02T18:00', kind: 'match_ittihad' }) // forces persist()
    const b = new EventsDb(storage)
    b.init(seed)
    expect(b.all().map(e => e.id)).toEqual(['y'])
  })
})

describe('LocalStorageAdapter quota handling', () => {
  it('switches to memory after a failed write so reads return the newest value', () => {
    const real = new Map<string, string>([['k', 'old']])
    let full = false
    vi.stubGlobal('localStorage', {
      get length() { return real.size },
      key: (i: number) => [...real.keys()][i] ?? null,
      getItem: (k: string) => real.get(k) ?? null,
      setItem: (k: string, v: string) => { if (full) throw new Error('quota'); real.set(k, v) },
      removeItem: (k: string) => { real.delete(k) },
    })
    const s = new LocalStorageAdapter()
    expect(s.get('k')).toBe('old')
    full = true
    s.set('k', 'new')
    expect(s.get('k')).toBe('new')
    expect(s.isDegraded).toBe(true)
    vi.unstubAllGlobals()
  })
})
