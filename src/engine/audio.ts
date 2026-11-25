/**
 * Noir audio director. Everything is synthesised with Web Audio (no audio files, ~0 KB shipped,
 * very low memory): a slow drone, wind, a heartbeat that quickens with tension, district
 * ambience (crickets/rooster in the village, sea and tram bell in the city) and one-shot stingers
 * for evidence, deductions, paper, thread and the camera.
 *
 * Browsers only allow audio after a user gesture, so call `unlock()` from the first click/key.
 */
export type Sfx = 'ui' | 'back' | 'evidence' | 'deduction' | 'paper' | 'thread' | 'shutter' | 'error' | 'travel' | 'accuse' | 'solved' | 'door'
export type District = 'abis' | 'city'

export class Audio {
  readonly ctx: AudioContext
  private readonly master: GainNode
  private readonly ambience: GainNode
  private readonly sfx: GainNode
  private noise?: AudioBuffer
  private running = false
  private started = false
  private tension = 0.2
  private district: District = 'abis'
  private night = 0.5
  private timers: number[] = []
  private droneFilter?: BiquadFilterNode
  private dissonance?: GainNode
  private windGain?: GainNode
  private districtGain?: GainNode
  private districtFilter?: BiquadFilterNode
  private volume = { music: 0.7, sfx: 0.8, muted: false }

  constructor() {
    this.ctx = new AudioContext()
    const comp = this.ctx.createDynamicsCompressor()
    this.master = this.ctx.createGain()
    this.ambience = this.ctx.createGain()
    this.sfx = this.ctx.createGain()
    this.ambience.connect(this.master)
    this.sfx.connect(this.master)
    this.master.connect(comp).connect(this.ctx.destination)
    this.setVolumes(0.7, 0.8)
  }

  unlock(): void {
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  /** `music` scales the ambience bed, `sfx` the stingers. Both 0..1. */
  setVolumes(music: number, sfx: number, muted = false): void {
    this.volume = { music, sfx, muted }
    const t = this.ctx.currentTime
    this.ambience.gain.setTargetAtTime(muted || !this.running ? 0 : music * 0.6, t, 0.08)
    this.sfx.gain.setTargetAtTime(muted ? 0 : sfx * 0.9, t, 0.05)
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

  private loopNoise(type: BiquadFilterType, freq: number, q: number, gain: number, dest: AudioNode): { gain: GainNode; filter: BiquadFilterNode } {
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
    return { gain: g, filter }
  }

  /** Start (or resume) the ambience bed. Safe to call repeatedly. */
  startAmbience(): void {
    if (this.running) return
    this.running = true
    this.setVolumes(this.volume.music, this.volume.sfx, this.volume.muted)
    if (!this.started) this.buildBed()
    this.applyScene()
    this.scheduleHeartbeat()
    this.scheduleDistrictEvent()
  }

  /** Build the permanent oscillator/noise graph once. */
  private buildBed(): void {
    this.started = true
    const ctx = this.ctx
    // Drone: detuned low saws through a low-pass, plus a hidden tritone that fades in with tension.
    const droneBus = ctx.createGain()
    droneBus.gain.value = 0.16
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
    this.timers.forEach(clearTimeout)
    this.timers = []
    this.ambience.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2)
  }

  /** Update the mood: district, darkness (0 day … 1 night) and tension (0..1). */
  setScene(district: District, night: number, tension: number): void {
    this.district = district
    this.night = night
    this.tension = Math.min(1, Math.max(0, tension))
    this.applyScene()
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
        if (this.district === 'abis' && this.night > 0.4) this.crickets()
        else if (this.district === 'abis') this.rooster()
        else this.tramBell()
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
  private crickets(): void {
    for (let i = 0; i < 6; i++) this.tone(4200, 4300, 0.05, 'sine', 0.012, i * 0.09, this.ambience)
  }
  private rooster(): void {
    this.tone(520, 700, 0.25, 'sawtooth', 0.01, 0, this.ambience)
    this.tone(700, 420, 0.5, 'sawtooth', 0.01, 0.28, this.ambience)
  }
  private tramBell(): void {
    this.tone(1320, 1300, 0.9, 'sine', 0.02, 0, this.ambience)
    this.tone(1320, 1300, 0.9, 'sine', 0.02, 0.35, this.ambience)
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
    }
  }
}
