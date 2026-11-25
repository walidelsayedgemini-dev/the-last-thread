import { describe, expect, it } from 'vitest'
import { endingLines } from '../src/data/endings'
import { evaluateAchievements, type AchievementContext } from '../src/game/achievements'
import { nextTutorialStep, TUTORIAL_STEPS } from '../src/ui/tutorial'
import { PROGRESS_VERSION, migrate } from '../src/services/profiles'

const context = (patch: Partial<AchievementContext> = {}): AchievementContext => ({
  caseId: 'case01', solved: true, mode: 'story', grade: 'ممتاز',
  evidenceFound: 2, evidenceTotal: 2, photoEvidenceFound: 1, photoEvidenceTotal: 1,
  deductionsFound: 2, deductionsTotal: 2, talkedTo: 2, charactersTotal: 2,
  correctConfrontations: 3, secretsUnlocked: 1, secretsTotal: 1, pastUnlocked: 2, pastTotal: 2,
  storyMinutes: 80, solvedCaseIds: ['case01'], flags: new Set(),
  stats: { photos: 1, hints: 0, wrongAccusations: 0 }, ...patch,
})

describe('onboarding, endings, achievements', () => {
  it('advances the tutorial only for the current real action', () => {
    expect(nextTutorialStep(0, 'inspect')).toBe(0)
    expect(nextTutorialStep(0, 'talk')).toBe(1)
    expect(nextTutorialStep(TUTORIAL_STEPS.length - 1, 'thread')).toBe(TUTORIAL_STEPS.length)
  })

  it('evaluates achievements without unlocking duplicates', () => {
    const unlocked = evaluateAchievements(context(), ['first_thread'])
    expect(unlocked.map(a => a.id)).toContain('perfect_grade')
    expect(unlocked.map(a => a.id)).not.toContain('first_thread')
    expect(evaluateAchievements(context({ solved: false }), []).map(a => a.id)).not.toContain('perfect_grade')
  })

  it('returns grade epilogues and falls back for an unlisted case/grade', () => {
    expect(endingLines('case01', 'ممتاز', ['fallback'])[0]).not.toBe('fallback')
    expect(endingLines('case03', 'جيد', ['fallback'])).toEqual(['fallback'])
  })

  it('migrates old saves with default tutorial and achievement state', () => {
    const migrated = migrate({ v: 3, mode: 'story', caseId: 'case01', case: { flags: [], evidence: [], deductions: [], hotspots: [], seenChoices: [] }, stats: {} })
    expect(migrated.v).toBe(PROGRESS_VERSION)
    expect(migrated.achievements).toEqual([])
    expect(migrated.tutorial).toEqual({ completed: false })
    expect(migrate({ ...migrated, achievements: ['first_thread'], tutorial: { completed: true } }).tutorial.completed).toBe(true)
  })
})
