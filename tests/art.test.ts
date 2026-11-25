import { describe, expect, it } from 'vitest'
import { evidenceUrl } from '../src/ui/art'

describe('evidence art lookup', () => {
  it('returns a URL for authored evidence and undefined for future missing IDs', () => {
    expect(evidenceUrl('e_thread_door')).toMatch(/e_thread_door\.webp/)
    expect(evidenceUrl('evidence_from_a_future_case')).toBeUndefined()
  })
})
