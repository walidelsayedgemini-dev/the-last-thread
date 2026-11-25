import { describe, expect, it } from 'vitest'
import { CASE_01 } from '../src/data/case01'
import { CASE_02 } from '../src/data/case02'
import { CASE_03 } from '../src/data/case03'
const CASES = [CASE_01, CASE_02, CASE_03]
import { PIN_POS } from '../src/ui/art'

// Every hotspot needs a hand-placed pin on its photo, and two pins of the same case/place must not sit on top of each other.
describe('scene pins', () => {
  for (const file of CASES) {
    it(`${file.id}: every hotspot has a PIN_POS and pins are apart`, () => {
      // Village hotspots (hs_<place>_<object>) are tied to an object in the art; older ones may use the auto ring layout.
      const missing = file.hotspots.filter(h => (file.id === 'case01' || h.id.startsWith('hs_')) && !PIN_POS[h.id]).map(h => h.id)
      expect(missing).toEqual([])
      const byPlace = new Map<string, { id: string; x: number; y: number }[]>()
      for (const h of file.hotspots) {
        const p = PIN_POS[h.id]
        if (!p) continue
        expect(p.x).toBeGreaterThanOrEqual(6); expect(p.x).toBeLessThanOrEqual(94)
        expect(p.y).toBeGreaterThanOrEqual(8); expect(p.y).toBeLessThanOrEqual(92)
        const list = byPlace.get(h.place) ?? []
        list.push({ id: h.id, ...p })
        byPlace.set(h.place, list)
      }
      const close: string[] = []
      for (const list of byPlace.values()) {
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
          if (Math.abs(list[i].x - list[j].x) < 6 && Math.abs(list[i].y - list[j].y) < 6) close.push(`${list[i].id} ~ ${list[j].id}`)
        }
      }
      expect(close).toEqual([])
    })
  }
})
