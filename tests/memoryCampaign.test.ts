import { describe, expect, it } from 'vitest'
import { MemoryCampaign } from '../src/core/memoryCampaign'
import { MAIN_STORIES, MEMORY_CHAPTERS, MEMORY_PEOPLE, MEMORY_PLACES, REGIONS, YEARS, relatedChapters, type MemoryChapter } from '../src/data/memoryWorld'
import { MemoryStorage } from '../src/services/storage'
import { resolveMemoryScene } from '../src/ui/memoryScene'

function solve(game: MemoryCampaign, chapter: MemoryChapter) {
  for (const place of chapter.sites) {
    game.visit(place)
    expect(game.inspect(place)).toBe(true)
  }
  for (const witness of chapter.witnesses) {
    expect(game.substantiate(chapter, witness.id, witness.correctSlot)).toBe(true)
  }
}

describe('Yassin’s archive', () => {
  it('connects 1000 playable places (500 Abis + 500 Alexandria) and 400 witnesses to 200 dated events', () => {
    expect(REGIONS).toHaveLength(40)
    expect(REGIONS.filter(r => r[1] === 'الإسكندرية')).toHaveLength(20)
    expect(MEMORY_PLACES.filter(p => REGIONS[p.region][1] === 'الإسكندرية')).toHaveLength(500)
    expect(MEMORY_PLACES.filter(p => REGIONS[p.region][1] !== 'الإسكندرية')).toHaveLength(500)
    expect(MEMORY_PLACES).toHaveLength(1000)
    expect(new Set(MEMORY_PLACES.map(place => place.title)).size).toBe(1000)
    expect(MEMORY_PEOPLE).toHaveLength(400)
    expect(new Set(MEMORY_PEOPLE.map(({ witness }) => witness.name)).size).toBe(400)
    expect(MEMORY_CHAPTERS).toHaveLength(200)
    expect(new Set(MEMORY_CHAPTERS.map(event => [event.year, event.month, event.day].join('-'))).size).toBe(200)
    const discovered = new Set<number>()
    const queue = [MEMORY_CHAPTERS[0]]
    for (const chapter of queue) {
      if (discovered.has(chapter.id)) continue
      discovered.add(chapter.id)
      queue.push(...relatedChapters(chapter))
      for (const witness of chapter.witnesses) expect(witness.needs).toContain(witness.correctSlot)
    }
    expect(discovered.size).toBe(200)
    expect(MEMORY_PEOPLE.filter(({ witness }) => witness.friend).map(({ witness }) => witness.name))
      .toEqual(['علاء عماد', 'أحمد بشير', 'ياسمين سلطان'])
  })

  it.each(['credit', 'privacy'] as const)('plays all five eras and preserves %s after reload', verdict => {
    const storage = new MemoryStorage()
    let game = new MemoryCampaign(storage)
    expect(game.conclude(verdict)).toBe(false)
    const locked = MEMORY_CHAPTERS[1].sites[0]
    game.visit(locked)
    expect(game.inspect(locked)).toBe(false)
    for (const _year of YEARS) {
      const phase = game.stage
      const required = game.mainLeads()
      expect(required).toHaveLength(2)
      for (const chapter of required) {
        expect(MAIN_STORIES[chapter.id]?.finding).toBeTruthy()
        expect(game.substantiate(chapter, chapter.witnesses[0].id, chapter.witnesses[0].correctSlot)).toBe(false)
      }
      solve(game, required[0])
      expect(game.stage).toBe(phase)
      solve(game, required[1])
      game = new MemoryCampaign(storage)
      expect(game.stage).toBe(phase + 1)
    }
    expect(game.ready).toBe(true)
    expect(game.witnessCount).toBe(20)
    expect(game.conclude(verdict)).toBe(true)
    expect(new MemoryCampaign(storage).verdict).toBe(verdict)
    const sideChapter = MEMORY_CHAPTERS.find(event => !game.confirmed(event))!
    solve(game, sideChapter)
    expect(new MemoryCampaign(storage).confirmedCount).toBe(11)
  })

  it('requires source order and rejects the wrong evidence', () => {
    const game = new MemoryCampaign(new MemoryStorage())
    const chapter = MEMORY_CHAPTERS[0]
    const [first, second] = chapter.witnesses
    for (const place of chapter.sites) {
      game.visit(place)
      game.inspect(place)
    }
    expect(game.substantiate(chapter, second.id, second.correctSlot)).toBe(false)
    expect(game.substantiate(chapter, first.id, 1 - first.correctSlot)).toBe(false)
    expect(game.substantiate(chapter, first.id, first.correctSlot)).toBe(true)
    expect(game.substantiate(chapter, second.id, second.correctSlot)).toBe(true)
    expect(game.confirmed(chapter)).toBe(true)
  })

  it('resolves photorealistic scene assets for every archive place in past and present', () => {
    for (const place of MEMORY_PLACES) {
      for (const past of [false, true]) {
        const scene = resolveMemoryScene(place, past)
        expect(scene.src).toMatch(/\.webp($|\?)/)
        expect(scene.alt.length).toBeGreaterThan(0)
        expect(scene.yearLabel.length).toBe(4)
      }
    }
  })
})
