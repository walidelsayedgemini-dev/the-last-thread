import { describe, expect, it } from 'vitest'
import { ambientSelection } from '../src/engine/audio'
import { voicePath } from '../src/data/voice'

describe('atmosphere routing', () => {
  it('looks up only explicitly voiced key lines', () => {
    expect(voicePath('case01', 'r_confront_right', 0)).toBe('audio/voice/c01_r_confront_player.mp3')
    expect(voicePath('case02', 'a_confront', 1)).toBe('audio/voice/c02_a_confront_adham.mp3')
    expect(voicePath('case01', 'intro', 3)).toBeUndefined()
    expect(voicePath('case99', 'a_confront', 1)).toBeUndefined()
  })

  it('routes mosque ambience by hour, including sparse prayer windows', () => {
    expect(ambientSelection('abis_mosque', 12)).toContain('birds')
    expect(ambientSelection('abis_mosque', 19)).toContain('prayer')
    expect(ambientSelection('abis_mosque', 23)).toContain('crickets')
  })

  it('routes distinct place atmospheres', () => {
    expect(ambientSelection('raml_stop', 21)).toEqual(expect.arrayContaining(['rain', 'tram']))
    expect(ambientSelection('corniche', 10)).toEqual(expect.arrayContaining(['waves', 'gulls']))
    expect(ambientSelection('canal_bridge', 22)).toEqual(expect.arrayContaining(['crickets', 'frogs']))
    expect(ambientSelection('cafe_ragab', 16)).toEqual(expect.arrayContaining(['cafe', 'backgammon']))
  })
})
