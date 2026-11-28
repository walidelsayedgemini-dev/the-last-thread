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
