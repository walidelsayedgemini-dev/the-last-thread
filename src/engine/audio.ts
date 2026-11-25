/**
 * Noir audio director. Everything is synthesised with Web Audio except optional
 * music files supplied by the caller. The procedural graph deliberately reuses
 * one small noise buffer and schedules sparse one-shots rather than keeping a
 * large graph per location.
 *
 * Browsers only allow audio after a user gesture, so call `unlock()` from the
 * first click/key.
 */
export type Sfx =
  | 'ui' | 'back' | 'evidence' | 'deduction' | 'paper' | 'thread' | 'shutter'
  | 'error' | 'travel' | 'accuse' | 'solved' | 'door'
  | 'confront' | 'lie' | 'wrong' | 'pin' | 'drawer' | 'found' | 'typewriter'
export type District = 'abis' | 'city'

interface NoiseLoop {
  source: AudioBufferSourceNode
  gain: GainNode
  filter: BiquadFilterNode
}

interface PlaceLayer {
  id: string
  gain: GainNode
  sources: AudioScheduledSourceNode[]
  nodes: AudioNode[]
  controls: Record<string, GainNode>
}

interface MusicTrack {
  element: HTMLAudioElement
  source: MediaElementAudioSourceNode
  gain: GainNode
}

interface VoiceTrack {
  element: HTMLAudioElement
  source: MediaElementAudioSourceNode
  gain: GainNode
}

export type AmbientCue = 'wind' | 'birds' | 'crickets' | 'frogs' | 'prayer' | 'rain' | 'tram' | 'waves' | 'gulls' | 'cafe' | 'backgammon' | 'water' | 'reeds' | 'traffic' | 'street'

/** Pure location/hour routing used by the procedural director and unit tests. */
export function ambientSelection(placeId: string, hour: number): readonly AmbientCue[] {
  const h = ((hour % 24) + 24) % 24
  const night = h < 6 || h >= 19
  const prayerWindow = (h >= 4.5 && h < 6.5) || (h >= 18 && h < 21)
  switch (placeId) {
    case 'abis_mosque': return prayerWindow ? ['wind', 'birds', 'prayer'] : night ? ['wind', 'crickets'] : ['wind', 'birds']
    case 'raml_stop': return ['rain', 'tram', 'traffic']
    case 'qaitbay':
    case 'corniche': return ['waves', 'gulls', 'wind']
    case 'cafe_ragab': return ['cafe', 'backgammon']
    case 'canal_bridge':
    case 'plot15': return night ? ['water', 'reeds', 'crickets', 'frogs'] : ['water', 'reeds', 'birds']
    case 'mansheya': return ['traffic', 'street']
    case 'pompey': return night ? ['wind', 'crickets'] : ['wind', 'birds']
    default: return night ? ['wind', 'crickets'] : ['wind', 'birds']
  }
}

export class Audio {
  readonly ctx: AudioContext
  private readonly master: GainNode
  private readonly ambience: GainNode
  private readonly musicBus: GainNode
  private readonly sfx: GainNode
  private readonly voiceBus: GainNode
  private noise?: AudioBuffer
  private running = false
  private started = false
  private tension = 0.2
  private district: District = 'abis'
  private night = 0.5
  private timers: number[] = []
  private placeTimers: number[] = []
  private placeEventToken = 0
  private placeLayer?: PlaceLayer
  private placeId?: string
  private sceneHour = -1
  private droneFilter?: BiquadFilterNode
  private droneGain?: GainNode
  private dissonance?: GainNode
  private windGain?: GainNode
  private districtGain?: GainNode
  private districtFilter?: BiquadFilterNode
  private music?: MusicTrack
  private voice?: VoiceTrack
  private volume = { music: 0.7, ambient: 0.65, sfx: 0.8, voice: 0.85, voiceEnabled: true, muted: false }
  private lastTypewriterAt = -Infinity

  constructor() {
    this.ctx = new AudioContext()
    const comp = this.ctx.createDynamicsCompressor()
    this.master = this.ctx.createGain()
    this.ambience = this.ctx.createGain()
    this.musicBus = this.ctx.createGain()
    this.sfx = this.ctx.createGain()
    this.voiceBus = this.ctx.createGain()
    this.ambience.connect(this.master)
    this.musicBus.connect(this.master)
    this.sfx.connect(this.master)
    this.voiceBus.connect(this.master)
    this.master.connect(comp).connect(this.ctx.destination)
    this.setVolumes(0.7, 0.8, false, 0.65, 0.85, true)
  }

  unlock(): void {
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  /** Music, ambience, effects, and voice each scale their own bus. Values are 0..1. */
  setVolumes(music: number, sfx: number, muted = false, ambient = music, voice = 0.85, voiceEnabled = true): void {
    this.volume = { music, ambient, sfx, voice, voiceEnabled, muted }
    const t = this.ctx.currentTime
    this.ambience.gain.setTargetAtTime(muted || !this.running ? 0 : ambient * 0.6, t, 0.08)
    this.musicBus.gain.setTargetAtTime(muted ? 0 : music * 0.6, t, 0.08)
    this.sfx.gain.setTargetAtTime(muted ? 0 : sfx * 0.9, t, 0.05)
    this.voiceBus.gain.setTargetAtTime(muted || !voiceEnabled ? 0 : voice, t, 0.05)
  }

  /** One shared 2 s noise buffer (~350 KB) reused by wind, sea and every percussive sound. */
  private noiseBuffer(): AudioBuffer {
    if (this.noise) return this.noise
    const len = this.ctx.sampleRate * 2
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      // Brown-ish noise: smoother and darker than white, suits wind/sea.
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
      data[i] = last * 3.5
    }
    this.noise = buf
    return buf
  }

  private loopNoise(type: BiquadFilterType, freq: number, q: number, gain: number, dest: AudioNode): NoiseLoop {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer()
    src.loop = true
    const filter = this.ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    filter.Q.value = q
    const g = this.ctx.createGain()
    g.gain.value = gain
    src.connect(filter).connect(g).connect(dest)
    src.start()
    return { source: src, gain: g, filter }
  }

  /** Start (or resume) the ambience bed. Safe to call repeatedly. */
  startAmbience(): void {
    if (this.running) return
    this.running = true
    this.setVolumes(this.volume.music, this.volume.sfx, this.volume.muted, this.volume.ambient, this.volume.voice, this.volume.voiceEnabled)
    if (!this.started) this.buildBed()
    this.applyScene()
    this.switchPlace(this.placeId)
    this.scheduleHeartbeat()
    this.scheduleDistrictEvent()
  }

  /** Build the permanent oscillator/noise graph once. */
  private buildBed(): void {
    this.started = true
    const ctx = this.ctx
    // Drone: detuned low saws through a low-pass, plus a hidden tritone that fades in with tension.
    const droneBus = ctx.createGain()
    droneBus.gain.value = this.music ? 0.105 : 0.16
    this.droneGain = droneBus
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 160
    filter.Q.value = 4
    filter.connect(droneBus).connect(this.ambience)
    this.droneFilter = filter
    for (const [f, detune] of [[55, -7], [55, 8], [82.4, 0]] as const) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = detune
      o.connect(filter)
      o.start()
    }
    const tri = ctx.createOscillator()
    tri.type = 'sine'
    tri.frequency.value = 77.8
    this.dissonance = ctx.createGain()
    this.dissonance.gain.value = 0
    tri.connect(this.dissonance).connect(droneBus)
    tri.start()
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.07
    lfoGain.gain.value = 60
    lfo.connect(lfoGain).connect(filter.frequency)
    lfo.start()
    // Wind.
    const wind = this.loopNoise('bandpass', 420, 0.7, 0.08, this.ambience)
    this.windGain = wind.gain
    const windLfo = ctx.createOscillator()
    const windLfoGain = ctx.createGain()
    windLfo.frequency.value = 0.11
    windLfoGain.gain.value = 220
    windLfo.connect(windLfoGain).connect(wind.filter.frequency)
    windLfo.start()
    // District bed (sea in the city / soft air in the village), retuned in setScene().
    const bed = this.loopNoise('lowpass', 500, 0.5, 0.0, this.ambience)
    this.districtGain = bed.gain
    this.districtFilter = bed.filter
  }

  /** Fade the bed out and cancel scheduled events (pause / back to title). */
  stopAmbience(): void {
    this.running = false
    this.stopVoice()
    this.timers.forEach(clearTimeout)
    this.timers = []
    this.cancelPlaceEvents()
    const old = this.placeLayer
    this.placeLayer = undefined
    if (old) this.fadeOutPlace(old)
    this.ambience.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2)
  }

  /** Update the mood: district, darkness (0 day … 1 night) and tension (0..1). */
  setScene(district: District, night: number, tension: number): void {
    this.district = district
    this.night = night
    this.tension = Math.min(1, Math.max(0, tension))
    this.applyScene()
  }

  /** Update darkness from the story clock without exposing WebAudio details to the UI. */
  setClock(hour: number): void {
    const normalized = ((hour % 24) + 24) % 24
    if (Math.abs(normalized - this.sceneHour) < 0.05) return
    this.sceneHour = normalized
    const darkness = normalized < 6 ? 1 : normalized < 7 ? 0.65 : normalized < 18 ? 0 : normalized < 19 ? 0.55 : 1
    this.setScene(this.district, darkness, this.tension)
  }

  private applyScene(): void {
    if (!this.started) return
    const t = this.ctx.currentTime
    this.droneFilter?.frequency.setTargetAtTime(140 + this.tension * 260, t, 1.5)
    this.dissonance?.gain.setTargetAtTime(this.tension * 0.5, t, 2)
    this.windGain?.gain.setTargetAtTime(0.04 + this.night * 0.07, t, 2)
    const city = this.district === 'city'
    this.districtFilter?.frequency.setTargetAtTime(city ? 380 : 700, t, 1)
    this.districtGain?.gain.setTargetAtTime(city ? 0.22 : 0.03, t, 1.5)
  }

  /**
   * Select a sparse location-specific sound bed. Unknown IDs are valid and
   * simply receive the district bed. The transition is approximately 1.5 s.
   */
  setPlace(placeId: string): void {
    if (this.placeId === placeId && (this.placeLayer || !this.running)) return
    this.placeId = placeId
    if (this.running && this.started) this.switchPlace(placeId)
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(() => this.running && fn(), ms))
    if (this.timers.length > 40) this.timers.splice(0, 20)
  }

  private scheduleHeartbeat(): void {
    const beat = () => {
      if (this.tension > 0.35 && this.ctx.state === 'running') {
        this.thump(0.12 + this.tension * 0.2)
        this.later(170, () => this.thump(0.08 + this.tension * 0.14))
      }
      this.later(1500 - this.tension * 800, beat)
    }
    this.later(2000, beat)
  }

  private scheduleDistrictEvent(): void {
    const tick = () => {
      if (this.ctx.state === 'running') {
        const cue = this.district === 'city' ? 'traffic' : this.night > 0.4 ? 'crickets' : 'birds'
        if (cue === 'crickets') this.crickets()
        else if (cue === 'birds') this.birds()
        else this.tone(180, 120, 0.22, 'sawtooth', 0.012, 0, this.ambience)
      }
      this.later(7000 + Math.random() * 9000, tick)
    }
    this.later(4000, tick)
  }

  private env(g: GainNode, t: number, attack: number, peak: number, decay: number): void {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  }

  private tone(freq: number, end: number, dur: number, type: OscillatorType, vol: number, delay = 0, dest: AudioNode = this.sfx): void {
    const t = this.ctx.currentTime + delay
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(end, 20), t + dur)
    this.env(g, t, 0.01, vol, dur)
    o.connect(g).connect(dest)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  private burst(freq: number, q: number, dur: number, vol: number, delay = 0, dest: AudioNode = this.sfx): void {
    const t = this.ctx.currentTime + delay
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer()
    src.playbackRate.value = 1 + Math.random() * 0.4
    const f = this.ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = freq
    f.Q.value = q
    const g = this.ctx.createGain()
    this.env(g, t, 0.005, vol, dur)
    src.connect(f).connect(g).connect(dest)
    src.start(t, Math.random())
    src.stop(t + dur + 0.05)
  }

  private thump(vol: number): void {
    this.tone(70, 38, 0.18, 'sine', vol, 0, this.ambience)
  }
  private crickets(dest: AudioNode = this.ambience): void {
    for (let i = 0; i < 6; i++) this.tone(4200, 4300, 0.05, 'sine', 0.012, i * 0.09, dest)
  }
  private birds(dest: AudioNode = this.ambience): void {
    const base = 1800 + Math.random() * 900
    this.tone(base, base * 1.18, 0.08, 'sine', 0.012, 0, dest)
    this.tone(base * 1.2, base * 0.95, 0.1, 'sine', 0.01, 0.16, dest)
  }
  private frogs(dest: AudioNode = this.ambience): void {
    this.tone(230, 180, 0.12, 'triangle', 0.025, 0, dest)
    this.tone(260, 200, 0.1, 'triangle', 0.018, 0.2, dest)
  }
  private gull(dest: AudioNode = this.ambience): void {
    this.tone(1050, 1550, 0.34, 'sine', 0.018, 0, dest)
    this.tone(1550, 930, 0.28, 'sine', 0.014, 0.24, dest)
  }
  private prayer(dest: AudioNode = this.ambience): void {
    // A distant, wordless call-like swell: intentionally sparse and atmospheric, never a looped prayer recording.
    for (const [freq, delay] of [[220, 0], [277, 0.22], [330, 0.48], [277, 0.82]] as const) this.tone(freq, freq * 1.015, 0.85, 'sine', 0.012, delay, dest)
  }
  private rain(dest: AudioNode = this.ambience): void {
    this.burst(3900, 0.5, 0.12, 0.025, 0, dest)
    this.burst(5200, 0.6, 0.08, 0.016, 0.13, dest)
  }
  private tramBell(dest: AudioNode = this.ambience): void {
    this.tone(1320, 1300, 0.9, 'sine', 0.02, 0, dest)
    this.tone(1320, 1300, 0.9, 'sine', 0.02, 0.35, dest)
  }

  private newPlaceLayer(id: string): PlaceLayer {
    const gain = this.ctx.createGain()
    gain.gain.value = 0.0001
    gain.connect(this.ambience)
    return { id, gain, sources: [], nodes: [gain], controls: {} }
  }

  private addPlaceNoise(layer: PlaceLayer, name: string, type: BiquadFilterType, freq: number, q: number, gain: number): GainNode {
    const loop = this.loopNoise(type, freq, q, gain, layer.gain)
    layer.sources.push(loop.source)
    layer.nodes.push(loop.source, loop.filter, loop.gain)
    layer.controls[name] = loop.gain
    return loop.gain
  }

  private addPlaceTone(layer: PlaceLayer, freq: number, gain: number): void {
    const oscillator = this.ctx.createOscillator()
    const nodeGain = this.ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = freq
    nodeGain.gain.value = gain
    oscillator.connect(nodeGain).connect(layer.gain)
    oscillator.start()
    layer.sources.push(oscillator)
    layer.nodes.push(oscillator, nodeGain)
  }

  private buildPlaceLayer(id: string): PlaceLayer | undefined {
    const layer = this.newPlaceLayer(id)
    switch (id) {
      case 'cafe_ragab':
        this.addPlaceNoise(layer, 'crowd', 'bandpass', 720, 0.7, 0.045)
        this.addPlaceNoise(layer, 'tv', 'bandpass', 1650, 0.45, 0.012)
        break
      case 'canal_bridge':
      case 'plot15':
        this.addPlaceNoise(layer, 'water', 'lowpass', 850, 0.5, 0.07)
        this.addPlaceNoise(layer, 'reeds', 'bandpass', 1350, 0.65, 0.025)
        if (id === 'plot15') this.addPlaceNoise(layer, 'wind', 'bandpass', 330, 0.55, 0.025)
        break
      case 'zeinab_home':
        this.addPlaceNoise(layer, 'room', 'lowpass', 250, 0.4, 0.012)
        break
      case 'mahmoud_house':
        this.addPlaceNoise(layer, 'room', 'lowpass', 160, 0.35, 0.006)
        break
      case 'abis_mosque':
        this.addPlaceNoise(layer, 'wind', 'bandpass', 480, 0.55, 0.018)
        this.addPlaceNoise(layer, 'birds', 'bandpass', 2350, 0.7, 0.008)
        break
      case 'abis_stop':
        this.addPlaceNoise(layer, 'engine', 'lowpass', 125, 0.7, 0.045)
        break
      case 'raml_stop':
        this.addPlaceNoise(layer, 'engine', 'lowpass', 115, 0.8, 0.06)
        this.addPlaceNoise(layer, 'tram', 'bandpass', 420, 0.5, 0.015)
        this.addPlaceNoise(layer, 'rain', 'highpass', 3600, 0.45, 0.012)
        break
      case 'qaitbay':
      case 'corniche':
        this.addPlaceNoise(layer, 'waves', 'lowpass', 430, 0.55, 0.09)
        this.addPlaceNoise(layer, 'foam', 'bandpass', 950, 0.5, 0.025)
        this.addPlaceNoise(layer, 'gulls', 'bandpass', 1800, 0.55, 0.004)
        break
      case 'bibliotheca':
        this.addPlaceNoise(layer, 'hall', 'lowpass', 600, 0.35, 0.012)
        this.addPlaceTone(layer, 146, 0.008)
        break
      case 'mansheya':
        this.addPlaceNoise(layer, 'traffic', 'lowpass', 190, 0.65, 0.05)
        this.addPlaceNoise(layer, 'street', 'bandpass', 720, 0.5, 0.018)
        break
      case 'pompey':
        this.addPlaceNoise(layer, 'wind', 'bandpass', 380, 0.6, 0.025)
        this.addPlaceNoise(layer, 'city', 'lowpass', 105, 0.45, 0.025)
        break
      default:
        return undefined
    }
    return layer
  }

  private switchPlace(id = this.placeId): void {
    this.cancelPlaceEvents()
    const old = this.placeLayer
    this.placeLayer = undefined
    if (old) this.fadeOutPlace(old)
    if (!this.running || !this.started || !id) return
    const next = this.buildPlaceLayer(id)
    if (!next) return
    this.placeLayer = next
    const t = this.ctx.currentTime
    next.gain.gain.setValueAtTime(0.0001, t)
    next.gain.gain.setTargetAtTime(1, t, 0.5)
    this.schedulePlaceEvents(next)
  }

  private fadeOutPlace(layer: PlaceLayer): void {
    const t = this.ctx.currentTime
    layer.gain.gain.cancelScheduledValues(t)
    layer.gain.gain.setTargetAtTime(0.0001, t, 0.35)
    window.setTimeout(() => this.disposePlaceLayer(layer), 1700)
  }

  private disposePlaceLayer(layer: PlaceLayer): void {
    for (const source of layer.sources) {
      try { source.stop() } catch { /* already stopped */ }
      source.disconnect()
    }
    for (const node of layer.nodes) node.disconnect()
  }

  private cancelPlaceEvents(): void {
    this.placeEventToken++
    for (const timer of this.placeTimers) window.clearTimeout(timer)
    this.placeTimers = []
  }

  private schedulePlaceTimer(layer: PlaceLayer, token: number, delay: number, fn: () => void): void {
    let timer = 0
    timer = window.setTimeout(() => {
      this.placeTimers = this.placeTimers.filter(item => item !== timer)
      if (this.running && this.placeEventToken === token && this.placeLayer === layer) fn()
    }, delay)
    this.placeTimers.push(timer)
  }

  private schedulePlaceEvents(layer: PlaceLayer): void {
    const token = this.placeEventToken
    this.schedulePlaceTimer(layer, token, 2200, () => this.placeEvent(layer, token))
  }

  private placePulse(layer: PlaceLayer, token: number, delay: number, fn: () => void): void {
    this.schedulePlaceTimer(layer, token, delay, fn)
  }

  private placeEvent(layer: PlaceLayer, token: number): void {
    const dest = layer.gain
    switch (layer.id) {
      case 'cafe_ragab':
        layer.controls.crowd?.gain.setTargetAtTime(0.025 + Math.random() * 0.04, this.ctx.currentTime, 0.7)
        layer.controls.tv?.gain.setTargetAtTime(0.006 + Math.random() * 0.012, this.ctx.currentTime, 1.2)
        if (Math.random() < 0.42) {
          // Two dry wooden clicks: a backgammon move in the café's foreground.
          this.tone(1550, 1250, 0.08, 'triangle', 0.025, 0, dest)
          this.tone(2300, 1900, 0.055, 'sine', 0.016, 0.07, dest)
        }
        break
      case 'canal_bridge':
      case 'plot15':
        if (this.night > 0.35) this.frogs(dest)
        else if (Math.random() < 0.7) this.birds(dest)
        if (Math.random() < 0.58) {
          this.tone(720 + Math.random() * 90, 640, 0.16, 'sine', 0.025, 0, dest)
          this.tone(1040, 920, 0.11, 'sine', 0.012, 0.18, dest)
        }
        if (this.night > 0.35 && Math.random() < 0.35) {
          this.tone(430, 280, 0.2, 'sine', 0.03, 0, dest)
          this.tone(520, 360, 0.16, 'sine', 0.018, 0.22, dest)
        }
        break
      case 'zeinab_home':
        if (Math.random() < 0.45) {
          // Four gentle treadle/clicks: a short rhythm, then silence again.
          for (const delay of [0, 160, 340, 520]) {
            this.placePulse(layer, token, delay, () => {
              this.burst(1250, 2.2, 0.035, 0.022, 0, dest)
              this.tone(92, 72, 0.1, 'sine', 0.018, 0, dest)
            })
          }
        }
        break
      case 'mahmoud_house':
        if (Math.random() < 0.5) {
          this.burst(180, 1.2, 0.28, 0.045, 0, dest)
          this.tone(92, 63, 0.3, 'triangle', 0.025, 0, dest)
        }
        break
      case 'abis_mosque':
        if (ambientSelection(layer.id, this.sceneHour).includes('prayer') && Math.random() < 0.13) this.prayer(dest)
        else if (Math.random() < 0.8) {
          const base = 2200 + Math.random() * 700
          this.tone(base, base * 1.08, 0.08, 'sine', 0.018, 0, dest)
          this.tone(base * 1.18, base * 1.12, 0.1, 'sine', 0.014, 0.11, dest)
        }
        break
      case 'abis_stop':
      case 'raml_stop':
        if (Math.random() < 0.52) this.tone(440, 520, 0.16, 'square', 0.025, 0, dest)
        if (layer.id === 'raml_stop' && Math.random() < 0.3) this.rain(dest)
        if (layer.id === 'raml_stop' && Math.random() < 0.34) this.tramBell(dest)
        break
      case 'qaitbay':
      case 'corniche':
        layer.controls.waves?.gain.setTargetAtTime(0.06 + Math.random() * 0.06, this.ctx.currentTime, 0.9)
        if (Math.random() < 0.52) {
          this.tone(1250, 1750, 0.12, 'sine', 0.02, 0, dest)
          this.tone(1750, 1200, 0.13, 'sine', 0.014, 0.14, dest)
        }
        if (Math.random() < 0.3) this.gull(dest)
        if (Math.random() < 0.32) this.burst(360, 1.1, 0.25, 0.028, 0, dest)
        break
      case 'bibliotheca':
        if (Math.random() < 0.62) {
          this.burst(500, 0.9, 0.06, 0.018, 0, dest)
          this.burst(680, 1.1, 0.08, 0.014, 0.22, dest)
        }
        break
      case 'mansheya':
        if (Math.random() < 0.55) this.tone(260, 180, 0.18, 'sawtooth', 0.025, 0, dest)
        if (Math.random() < 0.25) this.burst(1050, 1.4, 0.15, 0.035, 0, dest)
        break
      case 'pompey':
        if (this.night > 0.35) this.crickets(dest)
        if (Math.random() < 0.3) this.tone(220, 180, 0.18, 'sine', 0.018, 0, dest)
        break
    }
    const next = layer.id === 'zeinab_home' ? 5000 + Math.random() * 5000 : 3500 + Math.random() * 6500
    this.schedulePlaceTimer(layer, token, next, () => this.placeEvent(layer, token))
  }

  /** Stream an optional music file through the ambience/music bus. */
  playMusic(url: string | null, opts?: { loop?: boolean; fade?: number }): void {
    const fade = Math.max(0, opts?.fade ?? 1.5)
    const previous = this.music
    this.music = undefined
    if (previous) this.fadeOutMusic(previous, fade)

    if (!url) {
      this.droneGain?.gain.setTargetAtTime(0.16, this.ctx.currentTime, 0.35)
      return
    }

    let element: HTMLAudioElement
    let source: MediaElementAudioSourceNode
    try {
      element = document.createElement('audio')
      element.preload = 'auto'
      element.loop = opts?.loop ?? true
      element.crossOrigin = 'anonymous'
      element.src = url
      source = this.ctx.createMediaElementSource(element)
    } catch {
      // Unsupported media elements (or a non-browser test environment) are silent failures.
      this.droneGain?.gain.setTargetAtTime(0.16, this.ctx.currentTime, 0.35)
      return
    }

    const gain = this.ctx.createGain()
    gain.gain.value = 0.0001
    source.connect(gain).connect(this.musicBus)
    const track: MusicTrack = { element, source, gain }
    this.music = track
    this.droneGain?.gain.setTargetAtTime(0.105, this.ctx.currentTime, 0.35)
    const t = this.ctx.currentTime
    if (fade === 0) gain.gain.setValueAtTime(1, t)
    else gain.gain.setTargetAtTime(1, t, Math.max(0.05, fade / 3))
    element.addEventListener('ended', () => {
      if (this.music === track) {
        this.music = undefined
        this.fadeOutMusic(track, fade)
        this.droneGain?.gain.setTargetAtTime(0.16, this.ctx.currentTime, 0.35)
      }
    })
    element.addEventListener('error', () => {
      if (this.music === track) {
        this.music = undefined
        this.fadeOutMusic(track, fade)
        this.droneGain?.gain.setTargetAtTime(0.16, this.ctx.currentTime, 0.35)
      }
    })
    void element.play().catch(() => undefined)
  }

  /** Play one keyed dialogue clip; the caption remains the source of truth. */
  playVoice(url: string | null): void {
    this.stopVoice()
    if (!url || !this.volume.voiceEnabled || this.volume.muted) return
    let element: HTMLAudioElement
    let source: MediaElementAudioSourceNode
    try {
      element = document.createElement('audio')
      element.preload = 'auto'
      element.crossOrigin = 'anonymous'
      element.src = url
      source = this.ctx.createMediaElementSource(element)
    } catch {
      return
    }
    const gain = this.ctx.createGain()
    gain.gain.value = 0.0001
    source.connect(gain).connect(this.voiceBus)
    const track: VoiceTrack = { element, source, gain }
    this.voice = track
    const t = this.ctx.currentTime
    gain.gain.setTargetAtTime(1, t, 0.03)
    const duck = this.volume.muted ? 0 : 0.28
    this.ambience.gain.setTargetAtTime(this.running ? this.volume.ambient * 0.6 * duck : 0, t, 0.08)
    this.musicBus.gain.setTargetAtTime(this.volume.music * 0.6 * duck, t, 0.08)
    const finish = () => { if (this.voice === track) this.stopVoice(track) }
    element.addEventListener('ended', finish, { once: true })
    element.addEventListener('error', finish, { once: true })
    void element.play().catch(finish)
  }

  stopVoice(track = this.voice): void {
    if (!track || (this.voice && track !== this.voice)) return
    if (this.voice === track) this.voice = undefined
    try { track.element.pause() } catch { /* already stopped */ }
    track.source.disconnect()
    track.gain.disconnect()
    this.setVolumes(this.volume.music, this.volume.sfx, this.volume.muted, this.volume.ambient, this.volume.voice, this.volume.voiceEnabled)
  }

  private fadeOutMusic(track: MusicTrack, fade: number): void {
    const t = this.ctx.currentTime
    track.gain.gain.cancelScheduledValues(t)
    track.gain.gain.setTargetAtTime(0.0001, t, Math.max(0.03, fade / 3))
    window.setTimeout(() => {
      track.element.pause()
      track.source.disconnect()
      track.gain.disconnect()
    }, Math.max(50, fade * 1000 + 100))
  }

  /** Soft footstep; call at stride intervals. `sprint` makes it heavier. */
  footstep(zone: 'dirt' | 'stone', sprint: boolean): void {
    if (this.ctx.state !== 'running') return
    this.burst(zone === 'dirt' ? 380 : 900, 0.8, 0.09, sprint ? 0.16 : 0.1)
  }

  play(name: Sfx): void {
    if (this.ctx.state !== 'running') return
    switch (name) {
      case 'ui': this.tone(540, 520, 0.05, 'triangle', 0.1); break
      case 'back': this.tone(380, 300, 0.08, 'triangle', 0.1); break
      case 'paper': this.burst(2400, 0.6, 0.18, 0.12); this.burst(1800, 0.7, 0.12, 0.08, 0.1); break
      case 'thread': this.tone(660, 640, 0.6, 'triangle', 0.14); this.tone(990, 960, 0.5, 'sine', 0.06, 0.02); break
      case 'shutter': this.burst(3000, 1.2, 0.05, 0.25); this.burst(1200, 1, 0.08, 0.2, 0.09); break
      case 'error': this.tone(180, 110, 0.3, 'sawtooth', 0.12); break
      case 'travel': this.burst(300, 0.4, 0.9, 0.18); this.tone(110, 70, 0.9, 'sawtooth', 0.06); break
      case 'door': this.tone(120, 60, 0.35, 'square', 0.08); this.burst(500, 0.8, 0.2, 0.1); break
      case 'evidence':
        // Rising dissonant sting: minor second over a low hit, like a clue "landing".
        this.tone(55, 40, 0.8, 'sine', 0.3)
        this.tone(466, 466, 1.4, 'triangle', 0.09, 0.02)
        this.tone(494, 494, 1.4, 'triangle', 0.08, 0.02)
        this.tone(740, 740, 1.8, 'sine', 0.05, 0.25)
        break
      case 'deduction':
        for (const [i, f] of [392, 466, 587, 784].entries()) this.tone(f, f, 1.2, 'triangle', 0.08, i * 0.12)
        this.tone(49, 40, 1.2, 'sine', 0.25)
        break
      case 'accuse': this.tone(65, 45, 1.4, 'sawtooth', 0.14); this.tone(98, 95, 1.4, 'sine', 0.14); break
      case 'solved':
        for (const [i, f] of [262, 330, 392, 523].entries()) this.tone(f, f, 1.8, 'sine', 0.1, i * 0.25)
        break
      case 'confront':
        this.tone(58, 35, 0.65, 'sine', 0.23)
        this.tone(145, 520, 1.05, 'sawtooth', 0.045)
        this.tone(218, 690, 0.9, 'triangle', 0.025, 0.05)
        break
      case 'lie':
        this.burst(2450, 1.5, 0.12, 0.18)
        this.tone(740, 620, 0.28, 'square', 0.1)
        this.tone(1030, 820, 0.24, 'sawtooth', 0.08, 0.015)
        break
      case 'wrong':
        this.tone(92, 48, 0.3, 'sine', 0.19)
        this.burst(170, 0.8, 0.18, 0.09, 0.02)
        this.tone(220, 75, 0.55, 'triangle', 0.07, 0.08)
        break
      case 'pin':
        this.burst(2200, 2, 0.045, 0.06)
        this.tone(980, 860, 0.06, 'triangle', 0.045, 0.01)
        break
      case 'drawer':
        this.burst(1450, 0.7, 0.2, 0.055)
        this.burst(850, 0.8, 0.16, 0.035, 0.1)
        break
      case 'found':
        this.play('evidence')
        this.tone(1047, 1568, 0.55, 'sine', 0.07, 0.04)
        this.tone(1568, 2093, 0.7, 'triangle', 0.04, 0.16)
        break
      case 'typewriter': {
        // Dialogue can call this every character; never schedule more than 25/s.
        const now = this.ctx.currentTime
        if (now - this.lastTypewriterAt < 0.04) break
        this.lastTypewriterAt = now
        this.burst(2650, 1.8, 0.025, 0.028)
        break
      }
    }
  }
}
