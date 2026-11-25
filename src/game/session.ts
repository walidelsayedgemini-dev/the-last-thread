/**
 * Investigation session: the rendering-free glue between one player profile, the case engine,
 * the clock and the services (events DB, AR, hints, profiles).
 *
 * The 3D `Game` and the DOM `Ui` both talk to this object; neither owns rules. Everything here is
 * plain TypeScript and covered by tests/session.test.ts.
 */
import { CaseEngine, CaseState, type CaseEvent, type TieResult } from '../core/caseState'
import { GameClock } from '../core/clock'
import { DialogueSession, fillText } from '../core/dialogue'
import type { GateContext } from '../core/gates'
import { CASE_01 } from '../data/case01'
import { CHARACTERS } from '../data/characters'
import { DIALOGUES } from '../data/dialogues'
import { PLACES } from '../data/places'
import type { CharacterId, CharacterProfile, EvidenceId, Hotspot } from '../data/types'
import type { ArCapture, ArEngine, ArVerdict } from '../services/ar'
import type { EventsDb } from '../services/eventsDb'
import type { Hint, HintService } from '../services/hints'
import type { Profile, ProfileService, Progress } from '../services/profiles'

export type SessionDeps = {
  events: EventsDb
  profiles: ProfileService
  hints: HintService
  ar: ArEngine
  /** Cairo-stamp source (real time or the `?now=` override). */
  now: () => number
}

type Listener = (events: CaseEvent[]) => void

export class Session {
  readonly clock: GameClock
  readonly state: CaseState
  readonly engine: CaseEngine
  readonly progress: Progress
  private listeners = new Set<Listener>()

  constructor(readonly profile: Profile, private readonly deps: SessionDeps) {
    this.progress = structuredClone(profile.progress)
    this.clock = new GameClock({ mode: this.progress.mode, now: deps.now })
    this.clock.restore(this.progress.storyMinutes)
    this.state = CaseState.from(this.progress.case)
    this.engine = new CaseEngine(CASE_01, this.state, () => this.gateContext())
    this.clock.setEvidenceCount(this.state.evidence.size)
  }

  get mode() {
    return this.progress.mode
  }

  gateContext(): GateContext {
    return {
      mode: this.progress.mode,
      stamp: this.clock.stamp,
      eventNear: (kind, stamp, pad) => this.deps.events.near(kind, stamp, pad),
    }
  }

  /** Placeholders for narration and dialogue. */
  vars(): Record<string, string> {
    return { player: this.profile.avatar.name, home: this.profile.avatar.home }
  }
  fill(text: string): string {
    return fillText(text, this.vars())
  }

  onCase(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** Broadcast case changes, keep the story clock in sync and autosave. */
  emit(events: CaseEvent[]): void {
    if (events.length === 0) return
    this.clock.setEvidenceCount(this.state.evidence.size)
    this.listeners.forEach(fn => fn(events))
    this.save()
  }

  /** Is this character in the world right now? */
  present(c: CharacterProfile): boolean {
    if (c.id === 'yassin') return false
    return !c.appearsWhen || this.state.flags.has(c.appearsWhen)
  }

  /** World position of a character (schedule-aware in realistic mode). */
  positionOf(c: CharacterProfile): { x: number; z: number } {
    const p = PLACES[c.place].pos
    return { x: p.x + c.offset.x, z: p.z + c.offset.z }
  }

  hotspotPosition(h: Hotspot): { x: number; z: number } {
    const p = PLACES[h.place].pos
    return { x: p.x + h.offset.x, z: p.z + h.offset.z }
  }

  /** Start a conversation; events are emitted as the session advances (see `flushDialogue`). */
  talk(id: CharacterId): DialogueSession | undefined {
    const d = DIALOGUES[id]
    if (!d) return undefined
    const s = new DialogueSession(d, this.engine)
    if (!s.start()) return undefined
    if (!this.state.flags.has(`met_${id}`)) this.emit(this.engine.apply([{ type: 'flag', id: `met_${id}` }]))
    return s
  }

  flushDialogue(s: DialogueSession): void {
    this.emit(s.drainEvents())
  }

  useHotspot(h: Hotspot): CaseEvent[] {
    const events = this.engine.useHotspot(h)
    this.emit(events)
    return events
  }

  /** Verify a photo for a `photo` hotspot; on success its effects are applied. */
  async photograph(h: Hotspot, capture: ArCapture): Promise<{ verdict: ArVerdict; events: CaseEvent[] }> {
    const place = PLACES[h.landmark ?? h.place]
    const verdict = await this.deps.ar.verify({ id: place.id, label: place.name, x: place.pos.x, z: place.pos.z, geo: place.geo }, capture)
    this.progress.stats.photos++
    if (!verdict.ok) return { verdict, events: [] }
    return { verdict, events: this.useHotspot(h) }
  }

  tie(a: EvidenceId, b: EvidenceId): TieResult {
    const { result, events } = this.engine.tie(a, b)
    this.emit(events)
    return result
  }

  accuse(culprit: string, motive: string): ReturnType<CaseEngine['accuse']> {
    const r = this.engine.accuse(culprit, motive)
    if (r === 'wrong-culprit' || r === 'wrong-motive') this.progress.stats.wrongAccusations++
    if (r === 'ok') this.emit([{ type: 'flag', id: 'case_solved' }])
    else this.save()
    return r
  }

  async hint(): Promise<Hint | { wait: number } | undefined> {
    const o = this.engine.currentObjective()
    if (!o) return undefined
    const r = await this.deps.hints.request({
      objectiveId: o.id, objectiveTitle: o.title, objectiveDetail: o.detail,
      evidenceTitles: [...this.state.evidence.keys()].map(id => this.engine.evidenceInfo(id).title),
    })
    if ('text' in r) this.progress.stats.hints++
    return r
  }

  tick(seconds: number): void {
    this.clock.tick(seconds)
    this.progress.playMs += seconds * 1000
  }

  setPosition(zone: 'abis' | 'city', x: number, z: number, yaw: number): void {
    this.progress.position = { zone, x, z, yaw }
  }

  save(): void {
    this.progress.case = this.state.snapshot()
    this.progress.storyMinutes = this.clock.elapsedStoryMinutes
    this.deps.profiles.save(this.progress)
  }

  /**
   * Characters for the dossier tab: the missing uncle and grandmother are known from the start,
   * everyone else only after the player has talked to them (`met_<id>` flag set by `talk`).
   */
  knownCharacters(): CharacterProfile[] {
    return Object.values(CHARACTERS).filter(c => c.id === 'mahmoud' || c.id === 'zeinab' || this.state.flags.has(`met_${c.id}`))
  }
}
