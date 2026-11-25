import { describe, expect, it } from 'vitest'
import { CaseEngine, CaseState } from '../src/core/caseState'
import { DialogueSession } from '../src/core/dialogue'
import { computeGrade } from '../src/core/grade'
import { parseCairoLocal } from '../src/core/clock'
import { CASE_01 } from '../src/data/case01'
import { CASE_02 } from '../src/data/case02'
import { DIALOGUES, DIALOGUES_BY_CASE } from '../src/data/dialogues'
import { getCase } from '../src/data/cases'
import { EventsDb } from '../src/services/eventsDb'
import { HintService } from '../src/services/hints'
import { MemoryStorage } from '../src/services/storage'
import { ProfileService, migrate } from '../src/services/profiles'
import { Session } from '../src/game/session'
import type { GateContext } from '../src/core/gates'

const ctx: GateContext = { mode: 'story', stamp: parseCairoLocal('2026-11-25T18:00'), eventNear: () => false }
const engineFor = (file = CASE_01) => new CaseEngine(file, new CaseState(), () => ctx)

function session(): Session {
  const storage = new MemoryStorage()
  const profiles = new ProfileService(storage, () => 1000)
  const profile = profiles.create({ name: 'ياسين' }, 'story')
  return new Session(profile, { events: new EventsDb(storage), profiles, hints: new HintService(undefined, undefined, 0, () => 0), now: () => ctx.stamp })
}

describe('overhaul: confrontations', () => {
  it('marks evidence cards and exposes the right confrontation branch', () => {
    const e = engineFor()
    e.apply([{ type: 'evidence', id: 'e_hassan_testimony' }, { type: 'evidence', id: 'e_cafe_bill' }])
    const d = new DialogueSession(DIALOGUES.ragab!, e)
    expect(d.start()).toBe(true)
    expect(d.view()!.nodeId).toBe('r_again')
    const choice = d.view()!.choices.find(c => c.present === 'e_hassan_testimony')!
    expect(choice.confront).toBe(true)
    d.choose(choice.index)
    expect(e.state.flags.has('ragab_trust')).toBe(true)
  })
  it('dismisses irrelevant presented evidence in character', () => {
    const e = engineFor()
    e.apply([{ type: 'evidence', id: 'e_hassan_testimony' }, { type: 'evidence', id: 'e_old_photo' }, { type: 'evidence', id: 'e_cafe_bill' }])
    const d = new DialogueSession(DIALOGUES.ragab!, e)
    d.start()
    const choice = d.view()!.choices.find(c => c.present === 'e_old_photo')!
    d.choose(choice.index)
    expect(d.view()!.lines[0].text).toContain('صورة قديمة')
    expect(e.state.flags.has('ragab_trust')).toBe(false)
  })
})

describe('overhaul: session consequences and grade', () => {
  it('penalizes a wrong accusation, advances story time, and offends the accused', () => {
    const s = session()
    s.engine.apply([{ type: 'evidence', id: 'e_boundary_stone' }, { type: 'evidence', id: 'e_survey_book' }, { type: 'evidence', id: 'e_library_envelope' }, { type: 'evidence', id: 'e_forged_contract' }, { type: 'evidence', id: 'e_thread_door' }, { type: 'evidence', id: 'e_qaitbay_photo' }, { type: 'evidence', id: 'e_rail_log' }, { type: 'evidence', id: 'e_market_driver' }, { type: 'evidence', id: 'e_pump_log' }, { type: 'evidence', id: 'e_miller_promise' }, { type: 'evidence', id: 'e_handwriting' }, { type: 'flag', id: 'found_mahmoud' }])
    s.tie('e_boundary_stone', 'e_survey_book'); s.tie('e_library_envelope', 'e_forged_contract'); s.tie('e_thread_door', 'e_qaitbay_photo'); s.tie('e_rail_log', 'e_market_driver'); s.tie('e_pump_log', 'e_miller_promise'); s.tie('e_survey_book', 'e_handwriting')
    expect(s.accuse('hassan', 'm_road')).toBe('wrong-culprit')
    expect(s.progress.stats.wrongAccusations).toBe(1)
    expect(s.clock.elapsedStoryMinutes).toBe(60)
    expect(s.dialogueUnavailableReason('hassan')).toContain('متضايق')
    s.engine.apply([{ type: 'evidence', id: 'e_old_photo' }])
    expect(s.dialogueUnavailableReason('hassan')).toBeUndefined()
  })
  it('computes Arabic grade labels, stars, deductions, and missed evidence purely', () => {
    const state = new CaseState()
    state.evidence.set(CASE_01.evidence[0].id, 1)
    const result = computeGrade({ photos: 0, hints: 0, wrongAccusations: 0 }, CASE_01, state)
    expect(result.grade).toBe('مقبول')
    expect(result.stars).toBe(1)
    expect(result.missed).toContain('e_survey_book')
    expect(result.breakdown.some(x => x.label.includes('الأدلة'))).toBe(true)
  })
  it('does not penalize skipping bonus side-quest evidence', () => {
    const withoutBonus = new CaseState()
    withoutBonus.evidence.set('e_thread_door', 1)
    const withBonus = new CaseState()
    withBonus.evidence.set('e_thread_door', 1)
    withBonus.evidence.set('e_bakery_ration', 2)
    const a = computeGrade({ photos: 0, hints: 0, wrongAccusations: 0 }, CASE_01, withoutBonus)
    const b = computeGrade({ photos: 0, hints: 0, wrongAccusations: 0 }, CASE_01, withBonus)
    expect(b.breakdown[0]).toEqual(a.breakdown[0])
    expect(b.missed).not.toContain('e_bakery_ration')
  })
  it('exposes progressive hint cost', () => {
    const s = session()
    expect(s.hintCost(1)).toBe(1)
    expect(s.hintCost(2)).toBe(3)
    expect(s.hintCost(3)).toBe(6)
  })
})

describe('overhaul: saves and case02', () => {
  it('migrates missing caseId to case01 and creates a per-case snapshot map', () => {
    const migrated = migrate({ v: 2, mode: 'story', case: { flags: [], evidence: [], deductions: [], hotspots: [], seenChoices: [] }, stats: {} })
    expect(migrated.caseId).toBe('case01')
    expect(migrated.cases?.case01).toBeDefined()
  })
  it('plays all critical case02 evidence, deductions, confrontation, and finale', () => {
    expect(getCase('case02')).toBe(CASE_02)
    const e = engineFor(CASE_02)
    const hs = (id: string) => e.useHotspot(CASE_02.hotspots.find(h => h.id === id)!)
    hs('hs02_envelope'); hs('hs02_map'); hs('hs02_receipt'); hs('hs02_bus_city'); hs('hs02_library'); hs('hs02_key'); hs('hs02_nabil_recording'); hs('hs02_corniche_photo'); hs('hs02_sea_glass'); hs('hs02_note')
    const salma = new DialogueSession(DIALOGUES_BY_CASE.case02.salma!, e); salma.start(); salma.choose(0)
    const adham = new DialogueSession(DIALOGUES_BY_CASE.case02.adham!, e); adham.start()
    // The first entry dismisses until both photo and recording are present; then confrontation entry wins.
    expect(adham.view()!.nodeId).toBe('a_confront'); adham.advance()
    expect(e.state.flags.has('case02_adham_tied')).toBe(true)
    e.tie('e02_burned_map', 'e02_recording'); e.tie('e02_key_tag', 'e02_ledger_page'); e.tie('e02_corniche_photo', 'e02_messenger_note')
    expect(e.canAccuse()).toBe(true)
    expect(e.accuse('adham', 'm02_money')).toBe('ok')
    expect(e.state.flags.has('case_solved')).toBe(true)
  })
})
describe('overhaul: case-scoped cast', () => {
  it('only shows characters that have a part in the active case', async () => {
    const { CHARACTERS } = await import('../src/data/characters')
    const s = session()
    expect(s.present(CHARACTERS.ragab)).toBe(true)
    expect(s.present(CHARACTERS.salma)).toBe(false)
    expect(s.knownCharacters().map(c => c.id).sort()).toEqual(['mahmoud', 'zeinab'])
    s.startCase('case02')
    expect(s.present(CHARACTERS.ragab)).toBe(false)
    expect(s.present(CHARACTERS.salma)).toBe(true)
    expect(s.knownCharacters().some(c => c.id === 'mahmoud' || c.id === 'zeinab')).toBe(false)
  })
})
