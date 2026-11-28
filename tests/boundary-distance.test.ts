import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CASE_01 } from '../src/data/case01'
import { BOUNDARY_STONE_SHIFT_METERS, BOUNDARY_STONE_SHIFT_TEXT } from '../src/data/boundaryStone'
import { REGIONS } from '../src/data/memoryWorld'
import { CHAPTERS, JOURNAL, TIMELINE } from '../src/data/story'

const sources = ['case01.ts', 'story.ts', 'memoryWorld.ts', 'dialogues.villagers01.ts']
const sourceText = sources.map(name => readFileSync(new URL(`../src/data/${name}`, import.meta.url), 'utf8'))

describe('boundary stone distance consistency', () => {
  it('keeps the moved boundary stone at fourteen meters in all player-facing records', () => {
    expect(BOUNDARY_STONE_SHIFT_METERS).toBe(14)
    expect(BOUNDARY_STONE_SHIFT_TEXT).toBe('١٤')
    expect(CASE_01.evidence.find(item => item.id === 'e_survey_book')?.detail).toContain(`${BOUNDARY_STONE_SHIFT_TEXT} متر`)
    expect(CASE_01.deductions.find(item => item.id === 'd_markers')?.conclusion).toContain(`${BOUNDARY_STONE_SHIFT_TEXT} متر`)
    expect(CHAPTERS.find(item => item.id === 'ch_stone')?.text).toContain(`${BOUNDARY_STONE_SHIFT_TEXT} متر`)
    expect(JOURNAL.find(item => item.id === 'j_book')?.text).toContain(`${BOUNDARY_STONE_SHIFT_TEXT} متر`)
    expect(TIMELINE.find(item => item.title === 'الحجر بيتزحزح')?.text).toContain(`${BOUNDARY_STONE_SHIFT_TEXT} متر`)
    expect(REGIONS.find(item => item[0] === 'حوض القطعة ١٥ والساقية')?.[2]).toContain(`${BOUNDARY_STONE_SHIFT_TEXT} متر`)
  })

  it('uses the shared distance token instead of stale three-meter text in affected source files', () => {
    for (const text of sourceText) {
      expect(text).toContain('BOUNDARY_STONE_SHIFT_TEXT')
      expect(text).not.toMatch(/(?:٣|3)\s*متر/)
    }
  })
})
