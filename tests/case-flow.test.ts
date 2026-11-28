import { describe, expect, it } from 'vitest'
import { CaseEngine, CaseState } from '../src/core/caseState'
import { parseCairoLocal } from '../src/core/clock'
import type { GateContext } from '../src/core/gates'
import type { CaseFile, Effect } from '../src/data/types'
import { CASE_01 } from '../src/data/case01'
import { CASE_02 } from '../src/data/case02'
import { CASE_03 } from '../src/data/case03'
import { DIALOGUES_BY_CASE } from '../src/data/dialogues'
import { EventsDb } from '../src/services/eventsDb'
import { HintService } from '../src/services/hints'
import { MemoryStorage } from '../src/services/storage'
import { ProfileService } from '../src/services/profiles'
import { Session } from '../src/game/session'
import { LOCAL_HINTS } from '../src/data/hints'

/**
 * Walk a case the way a player would: every hotspot whose gate is open, every pair the board can
 * link, repeated until nothing changes. Dialogue grants are treated as available up front, so this
 * test is about the *world* graph (places, hotspots, flags, ties) and catches dead ends such as a
 * hotspot that only opens after evidence it is supposed to lead to.
 */
const ctx: GateContext = { mode: 'story', stamp: parseCairoLocal('2026-11-25T18:00'), eventNear: () => false }
const CASES: CaseFile[] = [CASE_01, CASE_02, CASE_03]

function dialogueGrants(caseId: string): Effect[] {
  const out: Effect[] = []
  for (const dialogue of Object.values(DIALOGUES_BY_CASE[caseId] ?? {})) {
    // Talking to someone always sets met_<id> (see Session.talk), which unlocks their follow-up hotspots.
    out.push({ type: 'flag', id: `met_${dialogue.character}` })
    for (const node of Object.values(dialogue.nodes)) {
      out.push(...(node.effects ?? []), ...(node.choices ?? []).flatMap(choice => choice.effects ?? []))
    }
  }
  return out
}

function sessionFor(file: CaseFile): Session {
  const storage = new MemoryStorage()
  const profiles = new ProfileService(storage, () => 1000)
  const profile = profiles.create({ name: 'ياسين' }, 'story')
  const session = new Session(profile, { events: new EventsDb(storage), profiles, hints: new HintService(undefined, undefined, 0, () => 0), now: () => ctx.stamp })
  expect(session.startCase(file.id)).toBe(true)
  return session
}

function sessionAt(mode: 'story' | 'realistic', time: string): Session {
  const storage = new MemoryStorage()
  const profiles = new ProfileService(storage, () => 1000)
  const profile = profiles.create({ name: 'ياسين' }, mode)
  return new Session(profile, { events: new EventsDb(storage), profiles, hints: new HintService(undefined, undefined, 0, () => 0), now: () => parseCairoLocal(time) })
}

function walk(file: CaseFile): { state: CaseState } {
  const state = new CaseState()
  const engine = new CaseEngine(file, state, () => ctx)
  engine.apply(dialogueGrants(file.id))
  let changed = true
  while (changed) {
    changed = false
    const before = state.evidence.size + state.flags.size + state.deductions.size
    // A keypad code is player knowledge, not a data gate: type the one the clue reveals.
    for (const hotspot of file.hotspots) if (engine.hotspotAvailable(hotspot)) engine.useHotspot(hotspot, hotspot.lockCode)
    for (const deduction of file.deductions) {
      if (state.deductions.has(deduction.id)) continue
      const pair = deduction.pairs.find(([a, b]) => state.evidence.has(a) && state.evidence.has(b))
      if (pair) engine.tie(pair[0], pair[1])
    }
    changed = state.evidence.size + state.flags.size + state.deductions.size !== before
  }
  return { state }
}

describe.each(CASES.map(file => [file.id, file] as const))('%s is walkable', (_id, file) => {
  const { state } = walk(file)

  it('finds every piece of evidence', () => {
    const missing = file.evidence.filter(item => !state.evidence.has(item.id)).map(item => item.id)
    expect(missing).toEqual([])
  })

  it('unlocks the accusation, then completes every objective', () => {
    // Accuse through the real Session so the solved flags are set exactly as the game sets them.
    const session = sessionFor(file)
    session.state.flags.forEach(flag => state.flags.add(flag))
    state.flags.forEach(flag => session.state.flags.add(flag))
    state.evidence.forEach((at, id) => session.state.evidence.set(id, at))
    state.deductions.forEach(id => session.state.deductions.add(id))
    const solvedEngine = session.engine
    expect(solvedEngine.canAccuse()).toBe(true)
    expect(session.accuse(file.finale.culprit, file.finale.motives.find(m => m.correct)!.id)).toBe('ok')
    const stuck = file.objectives.filter(objective => !solvedEngine.matches(objective.doneWhen)).map(objective => objective.id)
    expect(stuck).toEqual([])
    expect(solvedEngine.currentObjective()).toBeUndefined()
  })
})

describe('solution conditions are one list', () => {
  it.each(CASES.map(file => [file.id, file] as const))('%s: objectives and finale agree', (_id, file) => {
    const required = [...(file.finale.requires.deductions ?? [])].sort()
    for (const objective of file.objectives) {
      const declared = objective.doneWhen.deductions ?? objective.when?.deductions
      if (declared) expect([...declared].sort()).toEqual(required)
    }
  })

  it('every case has a hint for its closing objective', () => {
    for (const file of CASES) {
      const closing = file.objectives[file.objectives.length - 1]
      expect(LOCAL_HINTS[closing.id], `${file.id} has no hint for ${closing.id}`).toBeTruthy()
    }
    for (const id of ['o_board', 'o03_final']) expect(LOCAL_HINTS[id]?.[2]).toBeTruthy()
  })
})

describe('case-scoped report statistics', () => {
  it('does not carry photos, hints, or false accusations into another case and restores each report', () => {
    const session = sessionFor(CASE_01)
    session.progress.stats.photos = 3
    session.progress.stats.hints = 2
    session.progress.stats.wrongAccusations = 1
    session.progress.stats.hintTiers = { 1: 1, 2: 1 }
    session.save()
    expect(session.gradeReport().breakdown).toContainEqual({ label: 'الصور', delta: 6 })
    expect(session.gradeReport().breakdown).toContainEqual({ label: 'خصم الاتهامات الغلط', delta: -8 })

    expect(session.startCase('case02')).toBe(true)
    expect(session.progress.stats).toMatchObject({ photos: 0, hints: 0, wrongAccusations: 0 })
    expect(session.gradeReport().breakdown).toContainEqual({ label: 'الصور', delta: 0 })
    expect(session.gradeReport().breakdown).toContainEqual({ label: 'خصم الاتهامات الغلط', delta: 0 })
    session.progress.stats.photos = 1
    session.save()

    expect(session.startCase('case01')).toBe(true)
    expect(session.progress.stats).toMatchObject({ photos: 3, hints: 2, wrongAccusations: 1, hintTiers: { 1: 1, 2: 1 } })
    expect(session.gradeReport().breakdown).toContainEqual({ label: 'الصور', delta: 6 })
    expect(session.gradeReport().breakdown).toContainEqual({ label: 'خصم الاتهامات الغلط', delta: -8 })
  })
})

describe('schedule-aware scene cast', () => {
  it('moves a scheduled witness between places in realistic mode but keeps story-mode placement', () => {
    const realistic = sessionAt('realistic', '2026-11-25T15:00')
    expect(realistic.startCase('case02')).toBe(true)
    expect(realistic.charactersAt('abis_market').some(c => c.id === 'umm_saeed')).toBe(true)
    expect(realistic.charactersAt('bakery').some(c => c.id === 'umm_saeed')).toBe(false)

    const story = sessionAt('story', '2026-11-25T15:00')
    expect(story.startCase('case02')).toBe(true)
    expect(story.charactersAt('bakery').some(c => c.id === 'umm_saeed')).toBe(true)
    expect(story.charactersAt('abis_market').some(c => c.id === 'umm_saeed')).toBe(false)
  })
})

describe('case 03 route order', () => {
  it('opens the bus stop after the association record, not after the pigeon note', () => {
    const state = new CaseState()
    const engine = new CaseEngine(CASE_03, state, () => ctx)
    const bus = CASE_03.hotspots.find(h => h.id === 'hs03_bus_city')!
    expect(engine.hotspotAvailable(bus)).toBe(false)
    engine.apply([{ type: 'evidence', id: 'e03_red_staple' }, { type: 'evidence', id: 'e03_mud_prints' }])
    expect(engine.hotspotAvailable(bus)).toBe(false)
    engine.apply([{ type: 'evidence', id: 'e03_coop_register' }])
    expect(engine.hotspotAvailable(bus)).toBe(true)
    expect(engine.currentObjective()?.id).toBe('o03_bus')
    engine.useHotspot(bus)
    expect(engine.has('e03_bus_token')).toBe(true)
    expect(state.flags.has('visited_city')).toBe(true)
    expect(engine.currentObjective()?.id).toBe('o03_lantern')
  })

  it('names the real number of links in the closing hint', () => {
    expect(LOCAL_HINTS.o03_final[2]).toContain('العشرة')
    expect(LOCAL_HINTS.o_board[2]).toContain('ستة')
  })
})
