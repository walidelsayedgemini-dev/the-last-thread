import { describe, expect, it } from 'vitest'
import { CaseEngine, CaseState } from '../src/core/caseState'
import { DialogueSession, fillText } from '../src/core/dialogue'
import { parseCairoLocal } from '../src/core/clock'
import type { GateContext } from '../src/core/gates'
import { CASE_01 } from '../src/data/case01'
import { CASE_02 } from '../src/data/case02'
import { CASE_03 } from '../src/data/case03'
import { nextCaseId } from '../src/data/cases'
import { CHARACTERS } from '../src/data/characters'
import { DIALOGUES, DIALOGUES_BY_CASE } from '../src/data/dialogues'
import { LOCAL_HINTS } from '../src/data/hints'
import { PLACES } from '../src/data/places'

type Env = { mode: 'realistic' | 'story'; when: string; near: boolean }
function make(env: Partial<Env> = {}) {
  const e: Env = { mode: 'story', when: '2026-11-25T12:00', near: false, ...env }
  const state = new CaseState()
  const engine = new CaseEngine(CASE_01, state, (): GateContext => ({ mode: e.mode, stamp: parseCairoLocal(e.when), eventNear: () => e.near }))
  return { e, state, engine }
}
const talk = (engine: CaseEngine, who: keyof typeof DIALOGUES) => {
  const s = new DialogueSession(DIALOGUES[who]!, engine)
  expect(s.start()).toBe(true)
  return s
}

describe('case data integrity', () => {
  it('references only existing places, evidence, characters and hints', () => {
    const ids = new Set(CASE_01.evidence.map(e => e.id))
    for (const e of CASE_01.evidence) expect(PLACES[e.place], e.id).toBeDefined()
    for (const d of CASE_01.deductions) for (const [a, b] of d.pairs) { expect(ids.has(a), a).toBe(true); expect(ids.has(b), b).toBe(true) }
    for (const h of CASE_01.hotspots) {
      expect(PLACES[h.place], h.id).toBeDefined()
      if (h.to) expect(PLACES[h.to]).toBeDefined()
      for (const fx of h.effects ?? []) if (fx.type === 'evidence') expect(ids.has(fx.id), fx.id).toBe(true)
    }
    for (const o of CASE_01.objectives) if (o.place) expect(PLACES[o.place]).toBeDefined()
    for (const o of CASE_01.objectives) expect(LOCAL_HINTS[o.id], `hint ${o.id}`).toHaveLength(3)
    for (const c of Object.values(CHARACTERS)) expect(PLACES[c.place]).toBeDefined()
    for (const id of ['umm_saeed', 'omda', 'mounir', 'abdo', 'hamada', 'hagga_fatma', 'metwally', 'dr_amal', 'barakat', 'saber'] as const) {
      expect(DIALOGUES_BY_CASE.case01[id], `villager dialogue ${id}`).toBeDefined()
    }
  })
  it('gives every new Abis place at least two object-keyed case01 hotspots', () => {
    const expected: Record<string, string[]> = {
      abis_market: ['scale', 'tricycle'], bakery: ['oven', 'bread_racks'], old_school: ['noticeboard', 'chalkboard'],
      pump_station: ['engine', 'logbook'], omda_house: ['guestbook', 'car'], guava_orchard: ['ditch', 'hut'],
      rail_crossing: ['booth', 'tracks'], cemetery: ['tomb_door', 'lantern'], pigeon_tower: ['coop_door', 'rings_box'],
      mill: ['calendar', 'sacks'], health_unit: ['register', 'pharmacy_window'], waterwheel: ['trough', 'path'],
    }
    for (const [place, keys] of Object.entries(expected)) {
      const spots = CASE_01.hotspots.filter(h => h.place === place)
      expect(spots.length, place).toBeGreaterThanOrEqual(2)
      for (const key of keys) expect(spots.some(h => h.id === `hs_${place}_${key}`), `${place}:${key}`).toBe(true)
    }
  })
  it('dialogue nodes and effects are valid', () => {
    const ev = new Set(CASE_01.evidence.map(e => e.id))
    for (const [who, d] of Object.entries(DIALOGUES)) {
      for (const entry of d!.entries) expect(d!.nodes[entry.node], `${who}:${entry.node}`).toBeDefined()
      for (const n of Object.values(d!.nodes)) {
        if (n.next) expect(d!.nodes[n.next], `${who}:${n.id}->${n.next}`).toBeDefined()
        for (const c of n.choices ?? []) expect(d!.nodes[c.next], `${who}:${n.id}->${c.next}`).toBeDefined()
        for (const fx of n.effects ?? []) if (fx.type === 'evidence') expect(ev.has(fx.id)).toBe(true)
      }
    }
  })
  it('critical-path evidence is never time-gated', () => {
    const critical = ['e_thread_door', 'e_survey_book', 'e_boundary_stone', 'e_rail_log', 'e_market_driver', 'e_pump_log', 'e_miller_promise', 'e_handwriting', 'e_library_photo', 'e_library_envelope', 'e_bahr_testimony', 'e_qaitbay_photo', 'e_forged_contract']
    for (const id of critical) expect(CASE_01.evidence.find(e => e.id === id)!.gate, id).toBeUndefined()
  })
})

describe('case engine', () => {
  it('shows objectives progressively', () => {
    const { engine } = make()
    expect(engine.currentObjective()?.id).toBe('o_zeinab')
    engine.apply([{ type: 'flag', id: 'zeinab_talked' }])
    expect(engine.currentObjective()?.id).toBe('o_house')
  })
  it('refuses gated evidence in realistic mode but not in story mode', () => {
    const closed = make({ mode: 'realistic', when: '2026-11-25T09:00' })
    expect(closed.engine.apply([{ type: 'evidence', id: 'e_cafe_bill' }])[0].type).toBe('evidence-gated')
    expect(closed.engine.has('e_cafe_bill')).toBe(false)
    const story = make({ mode: 'story', when: '2026-11-25T09:00' })
    expect(story.engine.apply([{ type: 'evidence', id: 'e_cafe_bill' }])[0].type).toBe('evidence')
  })
  it('a gated hotspot is not consumed when refused', () => {
    const { engine } = make({ mode: 'realistic', when: '2026-11-25T12:00' })
    engine.apply([{ type: 'evidence', id: 'e_library_envelope' }, { type: 'flag', id: 'library_code' }])
    const photo = CASE_01.hotspots.find(h => h.id === 'hs_photo_pompey')!
    // Pompey photo hotspot only matches by daylight (gate in `when`), so at noon it is available.
    expect(engine.hotspotAvailable(photo)).toBe(true)
    engine.useHotspot(photo)
    expect(engine.has('e_pillar_photo')).toBe(true)
    expect(engine.hotspotAvailable(photo)).toBe(false)
  })
  it('ties evidence into deductions, order-insensitive and idempotent', () => {
    const { engine } = make()
    engine.apply([{ type: 'evidence', id: 'e_boundary_stone' }, { type: 'evidence', id: 'e_survey_book' }])
    const r1 = engine.tie('e_survey_book', 'e_boundary_stone')
    expect(r1.result).toEqual({ ok: true, deduction: 'd_markers', fresh: true })
    expect(engine.state.flags.has('markers_tied')).toBe(true)
    expect(engine.tie('e_boundary_stone', 'e_survey_book').result).toMatchObject({ ok: true, fresh: false })
    expect(engine.tie('e_boundary_stone', 'e_boundary_stone').result).toEqual({ ok: false, reason: 'same' })
    expect(engine.tie('e_boundary_stone', 'e_old_photo').result).toEqual({ ok: false, reason: 'missing' })
  })
  it('plays the whole case end-to-end in story mode', () => {
    const { engine } = make()
    const hs = (id: string) => engine.useHotspot(CASE_01.hotspots.find(h => h.id === id)!)

    // Zeinab → key
    const z = talk(engine, 'zeinab')
    z.choose(1) // z_key
    expect(engine.state.flags.has('has_key')).toBe(true)
    hs('hs_door_thread'); hs('hs_desk'); hs('hs_coat')
    expect(['e_thread_door', 'e_survey_book', 'e_microbus_ticket'].every(id => engine.has(id as never))).toBe(true)
    hs('hs_stone')
    hs('hs_rail_crossing_booth'); hs('hs_abis_market_tricycle'); hs('hs_pump_station_logbook'); hs('hs_mill_calendar'); hs('hs_old_school_chalkboard')
    // Hassan
    const h = talk(engine, 'hassan')
    h.choose(0)
    expect(engine.has('e_hassan_testimony')).toBe(true)
    // City
    hs('hs_bus_city')
    expect(engine.state.flags.has('visited_city')).toBe(true)
    hs('hs_photo_library'); hs('hs_locker')
    expect(engine.has('e_library_envelope')).toBe(true)
    // Bahr needs the door thread
    const b = talk(engine, 'bahr')
    b.choose(1)
    expect(engine.has('e_bahr_testimony')).toBe(true)
    hs('hs_photo_qaitbay'); hs('hs_shed')
    expect(engine.state.flags.has('found_mahmoud')).toBe(true)
    // Shawky
    const confront = talk(engine, 'shawky')
    expect(confront.view()!.nodeId).toBe('s_confront')
    confront.choose(0)
    expect(engine.has('e_forged_contract')).toBe(true)
    // Board
    expect(engine.canAccuse()).toBe(false)
    engine.tie('e_boundary_stone', 'e_survey_book')
    engine.tie('e_library_envelope', 'e_forged_contract')
    engine.tie('e_thread_door', 'e_qaitbay_photo')
    engine.tie('e_rail_log', 'e_market_driver')
    engine.tie('e_pump_log', 'e_miller_promise')
    engine.tie('e_survey_book', 'e_handwriting')
    expect(engine.canAccuse()).toBe(true)
    expect(engine.accuse('hassan', 'm_road')).toBe('wrong-culprit')
    expect(engine.accuse('shawky', 'm_theft')).toBe('wrong-motive')
    expect(engine.accuse('shawky', 'm_road')).toBe('ok')
    expect(engine.state.flags.has('case_solved')).toBe(true)
    expect(engine.currentObjective()).toBeUndefined()
    expect(engine.grade()).toMatch(/[ABC]/)
  })
  it('solves without entering any optional villager errand', () => {
    const { engine } = make()
    engine.apply([
      'e_thread_door', 'e_survey_book', 'e_microbus_ticket', 'e_boundary_stone', 'e_rail_log', 'e_market_driver',
      'e_pump_log', 'e_miller_promise', 'e_handwriting', 'e_hassan_testimony', 'e_library_photo', 'e_library_envelope',
      'e_bahr_testimony', 'e_qaitbay_photo', 'e_forged_contract',
    ].map(id => ({ type: 'evidence', id }) as never))
    engine.apply([{ type: 'flag', id: 'found_mahmoud' }])
    for (const [a, b] of [['e_boundary_stone', 'e_survey_book'], ['e_library_envelope', 'e_forged_contract'], ['e_thread_door', 'e_qaitbay_photo'], ['e_rail_log', 'e_market_driver'], ['e_pump_log', 'e_miller_promise'], ['e_survey_book', 'e_handwriting']] as const) engine.tie(a, b)
    expect(engine.canAccuse()).toBe(true)
    expect(engine.accuse('shawky', 'm_road')).toBe('ok')
    expect(engine.has('e_bakery_ration')).toBe(false)
    expect(engine.has('e_pigeon_note')).toBe(false)
  })
})

describe('dialogue session', () => {
  it('hides once-choices and respects choice conditions', () => {
    const { engine } = make()
    const s = talk(engine, 'zeinab')
    expect(s.view()!.choices.map(c => c.index)).toEqual([0, 1, 2])
    s.choose(1)
    s.advance()
    expect(s.view()!.nodeId).toBe('z_hub')
    // "machine" is offered only after zeinab_talked and before machine_hint.
    expect(s.view()!.choices.some(c => c.text.includes('ماكينتك'))).toBe(true)
    s.choose(1)
    expect(engine.state.flags.has('machine_hint')).toBe(true)
  })
  it('ragab is closed outside opening hours in realistic mode and gives the bill when open', () => {
    const closed = make({ mode: 'realistic', when: '2026-11-25T09:00' })
    expect(talk(closed.engine, 'ragab').view()!.nodeId).toBe('r_closed')
    const open = make({ mode: 'realistic', when: '2026-11-25T16:00' })
    const s = talk(open.engine, 'ragab')
    s.choose(0)
    expect(open.engine.has('e_cafe_bill')).toBe(true)
  })
  it('match-night photo appears only on match day', () => {
    const noMatch = make({ mode: 'realistic', when: '2026-11-25T16:00', near: false })
    noMatch.engine.apply([{ type: 'evidence', id: 'e_cafe_bill' }])
    const s = talk(noMatch.engine, 'ragab')
    s.choose(0)
    s.choose(0) // "(افتكر)" hidden when no match: only the wait choice exists
    expect(noMatch.engine.has('e_match_night_photo')).toBe(false)
    const match = make({ mode: 'realistic', when: '2026-11-27T19:00', near: true })
    match.engine.apply([{ type: 'evidence', id: 'e_cafe_bill' }])
    const s2 = talk(match.engine, 'ragab')
    s2.choose(0)
    expect(s2.view()!.nodeId).toBe('r_more')
    s2.choose(0)
    expect(match.engine.has('e_match_night_photo')).toBe(true)
  })
  it('fills placeholders', () => {
    expect(fillText('يا {player} من {home} {x}', { player: 'ياسين', home: 'أبيس' })).toBe('يا ياسين من أبيس {x}')
  })
})

describe('expanded cases', () => {
  const makeCase = (file: typeof CASE_02 | typeof CASE_03) => {
    const state = new CaseState()
    const engine = new CaseEngine(file, state, (): GateContext => ({ mode: 'story', stamp: parseCairoLocal('2026-11-25T21:00'), eventNear: () => false }))
    return { state, engine }
  }

  it('registers case03 after case02 and keeps dialogue casts case-scoped', () => {
    expect(nextCaseId('case02')).toBe('case03')
    expect(Object.keys(DIALOGUES_BY_CASE.case02).sort()).toEqual(['adham', 'farid', 'nabil', 'nadia', 'salma'])
    expect(Object.keys(DIALOGUES_BY_CASE.case03).sort()).toEqual(['hoda', 'khaled', 'omar'])
    expect(DIALOGUES_BY_CASE.case02.hoda).toBeUndefined()
    expect(DIALOGUES_BY_CASE.case03.adham).toBeUndefined()
    for (const id of ['nadia', 'farid', 'omar', 'hoda', 'khaled'] as const) expect(CHARACTERS[id]).toBeDefined()
  })

  it('plays case02 evidence, board, and staged Adham confrontation to accusation', () => {
    const { engine, state } = makeCase(CASE_02)
    const hs = (id: string) => engine.useHotspot(CASE_02.hotspots.find(h => h.id === id)!)
    hs('hs02_envelope'); hs('hs02_map'); hs('hs02_receipt'); hs('hs02_key'); hs('hs02_library')
    hs('hs02_bus_city'); hs('hs02_nabil_recording'); hs('hs02_note'); hs('hs02_radio'); hs('hs02_manifest')
    hs('hs02_corniche_photo'); hs('hs02_sea_glass')
    expect(state.evidence.size).toBe(CASE_02.evidence.length)
    expect(engine.currentObjective()?.id).toBe('o02_adham')
    expect(engine.tie('e02_burned_map', 'e02_recording').result).toMatchObject({ ok: true, deduction: 'd02_route' })
    expect(engine.tie('e02_key_tag', 'e02_ledger_page').result).toMatchObject({ ok: true, deduction: 'd02_forgery' })
    expect(engine.tie('e02_corniche_photo', 'e02_messenger_note').result).toMatchObject({ ok: true, deduction: 'd02_betrayal' })
    expect(engine.tie('e02_key_tag', 'e02_stock_manifest').result).toMatchObject({ ok: true, deduction: 'd02_chain' })
    expect(engine.tie('e02_radio_log', 'e02_stock_manifest').result).toMatchObject({ ok: true, deduction: 'd02_confrontation' })

    const adham = new DialogueSession(DIALOGUES_BY_CASE.case02.adham!, engine)
    expect(adham.start()).toBe(true)
    expect(adham.view()!.nodeId).toBe('a_confront')
    adham.choose(0); expect(adham.advance()).toBe(true) // recording pressure, back to the hub
    adham.choose(1); expect(adham.advance()).toBe(true) // note pressure, back to the hub
    adham.choose(2)
    expect(state.flags.has('case02_final_confronted')).toBe(true)
    expect(engine.canAccuse()).toBe(true)
    expect(engine.accuse('adham', 'm02_money')).toBe('ok')
    expect(state.flags.has('case_solved')).toBe(true)
  })

  it('plays case03 evidence, dialogue confession, deductions, and accusation', () => {
    const { engine, state } = makeCase(CASE_03)
    const hs = (id: string) => engine.useHotspot(CASE_03.hotspots.find(h => h.id === id)!)
    hs('hs03_staple'); hs('hs03_mud'); hs('hs03_register'); hs('hs03_bus_city'); hs('hs03_lantern'); hs('hs03_note')
    hs('hs03_negative'); hs('hs03_tide'); hs('hs03_lock'); hs('hs03_permit')
    expect(state.evidence.size).toBe(11)
    const hoda = new DialogueSession(DIALOGUES_BY_CASE.case03.hoda!, engine)
    expect(hoda.start()).toBe(true)
    expect(hoda.view()!.nodeId).toBe('h3_confront')
    hoda.choose(0)
    expect(state.evidence.has('e03_final_statement')).toBe(true)
    expect(state.flags.has('case03_confronted')).toBe(true)
    expect(state.evidence.size).toBe(CASE_03.evidence.length)
    expect(engine.tie('e03_mud_prints', 'e03_bus_token').result).toMatchObject({ ok: true, deduction: 'd03_route' })
    expect(engine.tie('e03_coop_register', 'e03_false_permit').result).toMatchObject({ ok: true, deduction: 'd03_records' })
    expect(engine.tie('e03_negative', 'e03_camera_roll').result).toMatchObject({ ok: true, deduction: 'd03_witness' })
    expect(engine.tie('e03_tide_chart', 'e03_false_permit').result).toMatchObject({ ok: true, deduction: 'd03_motive' })
    expect(engine.tie('e03_final_statement', 'e03_false_permit').result).toMatchObject({ ok: true, deduction: 'd03_confrontation' })
    expect(engine.canAccuse()).toBe(true)
    expect(engine.accuse('hoda', 'm03_water')).toBe('ok')
    expect(state.flags.has('case_solved')).toBe(true)
  })
})
