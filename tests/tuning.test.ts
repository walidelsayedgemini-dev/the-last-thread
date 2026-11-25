import { afterEach, describe, expect, it } from 'vitest'
import { CONFIG, DEFAULT_CONFIG } from '../src/game/config'
import { tuning } from '../src/game/tuning'

const defaults = Object.fromEntries(tuning.controls.map(control => [control.id, control.default]))
afterEach(() => {
  tuning.apply(defaults)
  tuning.activate('session')
})

describe('Three.js tuning', () => {
  it('validates the entire patch before committing and preserves source defaults', () => {
    const before = tuning.read()
    for (const patch of [{ 'player.walkSpeed': 4, 'camera.fov': 999 }, { 'player.walkSpeed': 8, 'player.sprintSpeed': 5 },
      { 'player.walkSpeed': 3.1 }, { 'player.walkSpeed': '4' }, { 'camera.fov': Infinity }, { unknown: 4 }]) {
      expect(() => tuning.apply(patch)).toThrow()
      expect(tuning.read()).toEqual(before)
    }
    tuning.apply({ 'player.walkSpeed': 4, 'player.sprintSpeed': 7 })
    expect(CONFIG.player.walkSpeed).toBe(4)
    expect(CONFIG.player.sprintSpeed).toBe(7)
    expect(DEFAULT_CONFIG.player.walkSpeed).toBe(3)
  })
  it('keeps atmosphere values live and cosmetic', () => {
    tuning.apply({ 'atmosphere.darkness': 0.5 })
    expect(CONFIG.atmosphere.darkness).toBe(0.5)
    expect(tuning.unranked).toBe(false)
  })
  it('marks gameplay edits as unranked', () => {
    tuning.apply({ 'player.walkSpeed': 4 })
    expect(tuning.unranked).toBe(true)
  })
})
