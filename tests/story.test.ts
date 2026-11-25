import { describe, expect, it } from 'vitest'
import { CASE_01 } from '../src/data/case01'
import { CHARACTERS } from '../src/data/characters'
import { DIALOGUES } from '../src/data/dialogues'
import { CHAPTERS, EPILOGUE, JOURNAL, SIDE_QUESTS, SUSPECT_NOTES, TIMELINE } from '../src/data/story'
import { LIFE_CHOICES, MAHMOUD_LIFE, dominantPath, lifeEpilogue, pathScores } from '../src/data/life'
import type { Condition, Effect } from '../src/data/types'

/** Every flag that some part of the game can set. */
function settableFlags(): Set<string> {
  const flags = new Set<string>(['case_solved'])
  const take = (effects?: Effect[]) => effects?.forEach(fx => { if (fx.type === 'flag') flags.add(fx.id) })
  for (const dialogue of Object.values(DIALOGUES)) {
    for (const node of Object.values(dialogue!.nodes)) {
      take(node.effects)
      node.choices?.forEach(choice => take(choice.effects))
    }
  }
  CASE_01.hotspots.forEach(hotspot => take(hotspot.effects))
  CASE_01.deductions.forEach(deduction => deduction.sets?.forEach(id => flags.add(id)))
  return flags
}

const conditions = (): { where: string; cond: Condition }[] => [
  ...CHAPTERS.map(c => ({ where: `chapter ${c.id}`, cond: c.when })),
  ...JOURNAL.map(j => ({ where: `journal ${j.id}`, cond: j.when })),
  ...EPILOGUE.map((e, i) => ({ where: `epilogue ${i}`, cond: e.when })),
  ...SIDE_QUESTS.flatMap(q => [{ where: `quest ${q.id}`, cond: q.visible }, ...q.steps.map((st, i) => ({ where: `quest ${q.id} step ${i}`, cond: st.when }))]),
  ...MAHMOUD_LIFE.map((e, i) => ({ where: `mahmoud life ${i}`, cond: e.when ?? {} })),
  ...TIMELINE.map((t, i) => ({ where: `timeline ${i}`, cond: t.when })),
  ...SUSPECT_NOTES.map((n, i) => ({ where: `suspect note ${i}`, cond: n.when })),
]

describe('narrative layer', () => {
  it('only references flags, evidence and deductions that exist', () => {
    const flags = settableFlags()
    const evidence = new Set(CASE_01.evidence.map(e => e.id))
    const deductions = new Set(CASE_01.deductions.map(d => d.id))
    for (const { where, cond } of conditions()) {
      cond.flags?.forEach(f => expect(flags.has(f), `${where}: unknown flag ${f}`).toBe(true))
      cond.evidence?.forEach(e => expect(evidence.has(e), `${where}: unknown evidence ${e}`).toBe(true))
      cond.deductions?.forEach(d => expect(deductions.has(d), `${where}: unknown deduction ${d}`).toBe(true))
    }
  })

  it('has unique ids and every journal page belongs to a chapter', () => {
    const chapters = new Set(CHAPTERS.map(c => c.id))
    expect(chapters.size).toBe(CHAPTERS.length)
    expect(new Set(JOURNAL.map(j => j.id)).size).toBe(JOURNAL.length)
    JOURNAL.forEach(j => expect(chapters.has(j.chapter), j.id).toBe(true))
    CHAPTERS.forEach(c => expect(JOURNAL.some(j => j.chapter === c.id), `${c.id} has no journal page`).toBe(true))
  })

  it('unlocks the unlockable dossier entries through flags the dialogues really set', () => {
    const flags = settableFlags()
    for (const person of Object.values(CHARACTERS)) {
      person.past.forEach(p => p.unlock && expect(flags.has(p.unlock), `${person.id}: ${p.unlock}`).toBe(true))
      if (person.secret) expect(flags.has(person.secret.unlock), `${person.id} secret ${person.secret.unlock}`).toBe(true)
    }
  })

  it('keeps the original critical path: three deductions and Mahmoud decide the accusation', () => {
    expect(CASE_01.finale.requires.deductions).toEqual(['d_markers', 'd_forgery', 'd_trail'])
    expect(CASE_01.finale.requires.flags).toEqual(['found_mahmoud'])
    expect(CASE_01.finale.culprit).toBe('shawky')
    expect(CASE_01.evidence).toHaveLength(15)
  })

  it('has new dialogue branches that lead back to a valid node', () => {
    for (const dialogue of Object.values(DIALOGUES)) {
      const ids = new Set(Object.keys(dialogue!.nodes))
      dialogue!.entries.forEach(entry => expect(ids.has(entry.node), `${dialogue!.character}:${entry.node}`).toBe(true))
      for (const node of Object.values(dialogue!.nodes)) {
        if (node.next) expect(ids.has(node.next), `${node.id} -> ${node.next}`).toBe(true)
        node.choices?.forEach(choice => expect(ids.has(choice.next), `${node.id} -> ${choice.next}`).toBe(true))
      }
    }
  })
  it('has playable side quests with unique ids, steps and rewards, and valid suspects', () => {
    expect(new Set(SIDE_QUESTS.map(q => q.id)).size).toBe(SIDE_QUESTS.length)
    SIDE_QUESTS.forEach(q => { expect(q.steps.length, q.id).toBeGreaterThanOrEqual(2); expect(q.reward.length, q.id).toBeGreaterThan(40) })
    const suspects = new Set(CASE_01.suspects.map(x => x.id as string))
    SUSPECT_NOTES.forEach(n => expect(suspects.has(n.suspect), n.suspect).toBe(true))
  })
  it('life choices: every flag is set by a dialogue branch, scores follow weights, and endings adapt', () => {
    const flags = settableFlags()
    LIFE_CHOICES.forEach(choice => expect(flags.has(choice.flag), choice.flag).toBe(true))
    expect(new Set(LIFE_CHOICES.map(c => c.flag)).size).toBe(LIFE_CHOICES.length)
    const none = new Set<string>()
    expect(dominantPath(none)).toBeUndefined()
    const street = new Set(['life_join_gang', 'life_street_boat'])
    expect(pathScores(street).street).toBe(6)
    expect(dominantPath(street)).toBe('street')
    expect(dominantPath(new Set(['life_help_neighbor', 'life_study_books']))).toBeUndefined()
    expect(lifeEpilogue(street)[0].title).toContain('ناس الليل')
    expect(lifeEpilogue(new Set(['life_bribe'])).some(b => b.title === 'الظرف')).toBe(true)
  })

  it('never makes a life choice a requirement for the solution', () => {
    const critical = JSON.stringify([CASE_01.finale.requires, CASE_01.deductions, CASE_01.hotspots.map(h => h.when)])
    LIFE_CHOICES.forEach(choice => expect(critical.includes(choice.flag), choice.flag).toBe(false))
  })
})

import { AREA_THEMES } from '../src/data/areas'
import { LETTERS } from '../src/data/letters'
import { PLACE_LIST } from '../src/data/places'
import { CASE_01 as CASE_FOR_LETTERS } from '../src/data/case01'

describe('letters and area themes', () => {
  it('every place has a complete area theme', () => {
    for (const place of PLACE_LIST) {
      const t = AREA_THEMES[place.id]
      expect(t, place.id).toBeTruthy()
      expect(t.accent).toMatch(/^#[0-9a-f]{6}$/i)
      expect(t.arrive.length).toBeGreaterThan(20)
      expect(t.whispers.length).toBeGreaterThanOrEqual(3)
    }
  })
  it('letters have unique ids, real places and known conditions', () => {
    const ids = new Set<string>()
    const evidence = new Set(CASE_FOR_LETTERS.evidence.map(e => e.id))
    const deductions = new Set(CASE_FOR_LETTERS.deductions.map(d => d.id))
    for (const l of LETTERS) {
      expect(ids.has(l.id), l.id).toBe(false)
      ids.add(l.id)
      expect(l.body.length).toBeGreaterThanOrEqual(2)
      if (l.at) expect(PLACE_LIST.some(p => p.id === l.at), l.id).toBe(true)
      for (const e of l.when.evidence ?? []) expect(evidence.has(e), l.id).toBe(true)
      for (const d of l.when.deductions ?? []) expect(deductions.has(d), l.id).toBe(true)
    }
    expect(LETTERS.length).toBeGreaterThanOrEqual(15)
  })
})

import { moodOf, todOf, weatherOf } from '../src/ui/extras'

describe('world polish helpers', () => {
  it('maps hours to time of day', () => {
    expect([todOf(6), todOf(12), todOf(17.5), todOf(22), todOf(2)]).toEqual(['dawn', 'day', 'dusk', 'night', 'night'])
  })
  it('rain is only in the city, in the evening, every third day', () => {
    expect(weatherOf('night', 'city', 3)).toBe('rain')
    expect(weatherOf('night', 'city', 4)).toBe('clear')
    expect(weatherOf('day', 'city', 3)).toBe('clear')
    expect(weatherOf('night', 'abis', 3)).toBe('clear')
  })
  it('reads a mood from dialogue text', () => {
    expect(moodOf('خلاص كفاية!')).toBe('shout')
    expect(moodOf('إنت رايح فين؟')).toBe('ask')
    expect(moodOf('أنا خايف عليك')).toBe('fear')
    expect(moodOf('صباح الخير يا ابني')).toBe('calm')
  })
})

import { PLACE_LIST as PLACES_FOR_MAP } from '../src/data/places'

describe('real map coordinates', () => {
  it('every place sits inside the Alexandria area and real sites are in the city', () => {
    for (const p of PLACES_FOR_MAP) {
      expect(p.mapPos.lat, p.id).toBeGreaterThan(31.1)
      expect(p.mapPos.lat, p.id).toBeLessThan(31.25)
      expect(p.mapPos.lng, p.id).toBeGreaterThan(29.8)
      expect(p.mapPos.lng, p.id).toBeLessThan(30.1)
      if (p.district === 'abis') expect(p.realSite, p.id).toBe(false)
    }
  })
})
