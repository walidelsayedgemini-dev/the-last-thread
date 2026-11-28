import { describe, expect, it } from 'vitest'
import { parseCairoLocal } from '../src/core/clock'
import { CASE01_SOLUTION } from '../src/data/case01'
import { EventsDb } from '../src/services/eventsDb'
import { HintService } from '../src/services/hints'
import { MemoryStorage } from '../src/services/storage'
import { ProfileService, migrate } from '../src/services/profiles'
import { Session } from '../src/game/session'

/**
 * Progress and time must survive closing the game: story minutes, the realistic-mode hour lost to a
 * wrong accusation, and the board state that was already linked.
 */
const NOW = parseCairoLocal('2026-11-25T18:00')
const HOUR = 60 * 60_000

function setup(mode: 'story' | 'realistic') {
  const storage = new MemoryStorage()
  const profiles = new ProfileService(storage, () => 1000)
  const profile = profiles.create({ name: 'ياسين' }, mode)
  const open = () => new Session(profiles.get(profile.id)!, {
    events: new EventsDb(storage), profiles, hints: new HintService(undefined, undefined, 0, () => 0), now: () => NOW,
  })
  return { profiles, open }
}

describe('autosave and restore', () => {
  it('persists the exact evidence pairs linked under an existing deduction', () => {
    const { open } = setup('story')
    const session = open()
    for (const id of ['e_library_envelope', 'e_survey_book', 'e_forged_contract'] as const) session.state.evidence.set(id, 0)
    session.save()

    expect(session.tie('e_library_envelope', 'e_forged_contract')).toMatchObject({ ok: true, fresh: true, pairFresh: true })
    expect(session.tie('e_survey_book', 'e_forged_contract')).toMatchObject({ ok: true, fresh: false, pairFresh: true })

    const reopened = open()
    expect(reopened.state.threads.get('d_forgery')).toEqual([
      ['e_library_envelope', 'e_forged_contract'], ['e_survey_book', 'e_forged_contract'],
    ])
  })

  it('loads legacy deductions without inventing ambiguous evidence links', () => {
    const { profiles, open } = setup('story')
    const id = profiles.list()[0].id
    const legacy = profiles.get(id)!
    legacy.progress.case = {
      flags: [],
      evidence: [
        { id: 'e_boundary_stone', at: 0 }, { id: 'e_survey_book', at: 0 },
        { id: 'e_library_envelope', at: 0 }, { id: 'e_forged_contract', at: 0 },
      ],
      deductions: ['d_markers', 'd_forgery'], hotspots: [], seenChoices: [],
    }
    legacy.progress.cases = { case01: legacy.progress.case }
    legacy.progress.caseId = 'case01'
    profiles.save(legacy.progress)

    const restored = open()
    expect(restored.state.threads.get('d_markers')).toEqual([['e_boundary_stone', 'e_survey_book']])
    expect(restored.state.threads.has('d_forgery')).toBe(false)
  })

  it('persists reviewed evidence per case and restores it after reload', () => {
    const { open } = setup('story')
    const session = open()
    session.state.reviewedEvidence.add('e_thread_door')
    session.save()

    const reopened = open()
    expect(reopened.state.reviewedEvidence.has('e_thread_door')).toBe(true)
    expect(reopened.startCase('case02')).toBe(true)
    expect(reopened.state.reviewedEvidence.size).toBe(0)
    reopened.state.reviewedEvidence.add('e02_black_envelope')
    reopened.save()

    expect(reopened.startCase('case01')).toBe(true)
    expect(reopened.state.reviewedEvidence.has('e_thread_door')).toBe(true)
    expect(reopened.startCase('case02')).toBe(true)
    expect(reopened.state.reviewedEvidence.has('e02_black_envelope')).toBe(true)
    const restored = open()
    expect(restored.state.reviewedEvidence.has('e02_black_envelope')).toBe(true)
  })

  it('keeps the hour lost to a wrong accusation after reopening', () => {
    const { open } = setup('realistic')
    const session = open()
    CASE01_SOLUTION.forEach(id => session.state.deductions.add(id))
    session.state.flags.add('found_mahmoud')

    expect(session.accuse('hassan', 'm_road')).toBe('wrong-culprit')
    expect(session.clock.penaltyMs).toBe(HOUR)
    expect(session.clock.stamp).toBe(NOW + HOUR)
    session.save()

    const reopened = open()
    expect(reopened.clock.penaltyMs).toBe(HOUR)
    expect(reopened.clock.stamp).toBe(NOW + HOUR)
    expect(reopened.progress.stats.wrongAccusations).toBe(1)
    expect(CASE01_SOLUTION.every(id => reopened.state.deductions.has(id))).toBe(true)
    expect(reopened.state.flags.has('found_mahmoud')).toBe(true)
  })

  it('restores story time and play time', () => {
    const { open } = setup('story')
    const session = open()
    session.tick(600) // ten story minutes of play
    expect(session.clock.elapsedStoryMinutes).toBeCloseTo(10, 5)
    session.save()

    const reopened = open()
    expect(reopened.clock.elapsedStoryMinutes).toBeCloseTo(10, 5)
    expect(reopened.progress.playMs).toBeCloseTo(600_000, 0)
  })

  it.each(['realistic', 'story'] as const)('uses the same post-penalty one-hour cooldown in %s mode', mode => {
    const { open } = setup(mode)
    const session = open()
    CASE01_SOLUTION.forEach(id => session.state.deductions.add(id))
    session.state.flags.add('found_mahmoud')
    expect(session.accuse('hassan', 'm_road')).toBe('wrong-culprit')
    if (mode === 'realistic') expect(session.clock.stamp).toBe(NOW + HOUR)
    else expect(session.clock.elapsedStoryMinutes).toBe(60)
    expect(session.dialogueUnavailableReason('hassan')).toContain('متضايق')
    session.save()

    const reopened = open()
    expect(reopened.dialogueUnavailableReason('hassan')).toContain('متضايق')
    reopened.clock.advanceMinutes(60)
    reopened.dialogueUnavailableReason('hassan')
    expect(reopened.state.offended.has('hassan')).toBe(false)
  })

  it('does not carry a penalty into a fresh realistic session', () => {
    const { open } = setup('realistic')
    expect(open().clock.penaltyMs).toBe(0)
    expect(open().clock.stamp).toBe(NOW)
  })

  it('sanitises a corrupt stored penalty instead of trusting it', () => {
    expect(migrate({ v: 4, penaltyMs: 'soon' }).penaltyMs).toBe(0)
    expect(migrate({ v: 4, penaltyMs: -9_000 }).penaltyMs).toBe(0)
    expect(migrate({ v: 4, penaltyMs: HOUR }).penaltyMs).toBe(HOUR)
    expect(migrate({ v: 4, penaltyMs: 400 * 24 * HOUR }).penaltyMs).toBe(7 * 24 * HOUR)
    expect(migrate({ v: 3 }).penaltyMs).toBe(0)
  })
})
