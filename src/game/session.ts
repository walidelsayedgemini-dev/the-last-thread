import { CaseEngine, CaseState, type CaseEvent, type TieResult } from '../core/caseState'
import { GameClock, hourInWindow } from '../core/clock'
import { DialogueSession, fillText } from '../core/dialogue'
import type { GateContext } from '../core/gates'
import { computeGrade, type GradeResult } from '../core/grade'
import { getCase, nextCaseId as registryNextCaseId } from '../data/cases'
import { CHARACTERS } from '../data/characters'
import { DIALOGUES, DIALOGUES_BY_CASE } from '../data/dialogues'
import { PLACES } from '../data/places'
import type { CharacterId, CharacterProfile, EvidenceId, Hotspot, PlaceId } from '../data/types'
import type { EventsDb } from '../services/eventsDb'
import type { Hint, HintService } from '../services/hints'
import { newProgressStats, type Profile, type ProfileService, type Progress } from '../services/profiles'

export type SessionDeps = { events: EventsDb; profiles: ProfileService; hints: HintService; now: () => number }
type Listener = (events: CaseEvent[]) => void

export class Session {
  readonly clock: GameClock
  readonly progress: Progress
  state: CaseState
  engine: CaseEngine
  private listeners = new Set<Listener>()

  constructor(readonly profile: Profile, private readonly deps: SessionDeps) {
    this.progress = structuredClone(profile.progress)
    this.progress.caseId ||= 'case01'
    this.progress.cases ??= { [this.progress.caseId || 'case01']: this.progress.case }
    this.progress.caseStats ??= { [this.progress.caseId]: this.progress.stats }
    this.progress.caseStats[this.progress.caseId] ??= this.progress.stats ?? newProgressStats()
    this.progress.stats = this.progress.caseStats[this.progress.caseId]
    const snapshot = this.progress.cases[this.progress.caseId] ?? this.progress.case
    this.progress.case = snapshot
    this.progress.cases[this.progress.caseId] = snapshot
    this.clock = new GameClock({ mode: this.progress.mode, now: deps.now })
    this.clock.restore(this.progress.storyMinutes)
    this.clock.restorePenalty(this.progress.penaltyMs ?? 0)
    this.state = CaseState.from(snapshot)
    this.engine = new CaseEngine(getCase(this.progress.caseId), this.state, () => this.gateContext())
    this.clock.setEvidenceCount(this.state.evidence.size)
  }

  get mode() { return this.progress.mode }
  get caseId() { return this.progress.caseId }
  get caseFile() { return this.engine.file }

  lastEvidence() {
    const id = Array.from(this.state.evidence.keys()).at(-1)
    return id ? this.engine.evidenceInfo(id) : undefined
  }

  openQuestions() {
    if (this.state.flags.has('case_solved')) return []
    return Array.from(this.state.evidence.keys()).flatMap(id => {
      const evidence = this.engine.evidenceInfo(id)
      const question = evidence?.question
      return question && !question.answeredWhen.some(condition => this.engine.matches(condition))
        ? [{ id, title: evidence.title, text: question.text }] : []
    })
  }

  gateContext(): GateContext {
    return { mode: this.progress.mode, stamp: this.clock.stamp, eventNear: (kind, stamp, pad) => this.deps.events.near(kind, stamp, pad) }
  }
  vars(): Record<string, string> { return { player: this.profile.avatar.name, home: this.profile.avatar.home } }
  fill(text: string): string { return fillText(text, this.vars()) }
  onCase(fn: Listener): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn) }

  emit(events: CaseEvent[]): void {
    if (!events.length) return
    this.clock.setEvidenceCount(this.state.evidence.size)
    this.listeners.forEach(fn => fn(events))
    this.save()
  }

  /** Switch to a registered case, preserving the previous case snapshot in the profile. */
  startCase(id: string): boolean {
    const target = getCase(id)
    if (!target || (target.id !== id && id !== 'case01')) return false
    this.save()
    const snapshot = this.progress.cases?.[id] ?? { flags: [], evidence: [], deductions: [], hotspots: [], seenChoices: [] }
    this.progress.caseId = id
    this.progress.case = snapshot
    this.progress.cases ??= {}
    this.progress.cases[id] = snapshot
    this.progress.caseStats ??= {}
    this.progress.stats = this.progress.caseStats[id] ?? newProgressStats()
    this.progress.caseStats[id] = this.progress.stats
    this.state = CaseState.from(snapshot)
    this.engine = new CaseEngine(target, this.state, () => this.gateContext())
    this.deps.hints.reset()
    this.clock.setEvidenceCount(this.state.evidence.size)
    this.save()
    return true
  }

  nextCaseId(): string | undefined { return registryNextCaseId(this.caseId) }

  /** True when the character has a part (dialogue) in the active case. */
  inCase(c: CharacterProfile): boolean {
    return Boolean(DIALOGUES_BY_CASE[this.caseId]?.[c.id])
  }
  present(c: CharacterProfile): boolean {
    if (c.id === 'yassin' || !this.inCase(c)) return false
    return !c.appearsWhen || this.state.flags.has(c.appearsWhen)
  }

  /** Current schedule-aware location; critical evidence is never hidden by this helper. */
  whereIs(id: CharacterId): { available: boolean; place: PlaceId; text: string } {
    const c = CHARACTERS[id]
    if (!c) return { available: false, place: 'zeinab_home', text: 'الشخص ده مش موجود في ملفات القضية.' }
    if (this.progress.mode !== 'realistic' || !c.schedule?.length) return { available: this.present(c), place: c.place, text: this.present(c) ? `موجود في ${PLACES[c.place].name}.` : 'لسه ما ظهرش في التحقيق.' }
    const slot = c.schedule.find(item => hourInWindow(this.clock.hour, item.hours.from, item.hours.to))
    if (slot) return { available: this.present(c), place: slot.place, text: this.present(c) ? `موجود في ${PLACES[slot.place].name}.` : 'لسه ما ظهرش في التحقيق.' }
    return { available: false, place: c.place, text: `${c.name} مش موجود دلوقتي… جرّب في وقت تاني.` }
  }


  private offended(id: CharacterId): boolean {
    const item = this.state.offended.get(id)
    if (!item) return false
    const minutes = this.progress.mode === 'realistic' ? this.clock.stamp / 60_000 : this.clock.elapsedStoryMinutes
    if (this.state.evidence.size >= item.untilEvidence || minutes >= item.untilMinute) { this.state.offended.delete(id); return false }
    return true
  }
  dialogueUnavailableReason(id: CharacterId): string | undefined {
    if (this.offended(id)) return `${CHARACTERS[id]?.name ?? 'الشخص'} متضايق منك ومش هيتكلم دلوقتي. هات دليل جديد أو استنى شوية.`
    if (!this.present(CHARACTERS[id])) return 'الشخص ده لسه مش ظاهر في المكان.'
    const where = this.whereIs(id)
    return where.available ? undefined : where.text
  }

  talk(id: CharacterId): DialogueSession | undefined {
    if (this.dialogueUnavailableReason(id)) return undefined
    const d = DIALOGUES_BY_CASE[this.caseId]?.[id] ?? (this.caseId === 'case01' ? DIALOGUES[id] : undefined)
    if (!d) return undefined
    const s = new DialogueSession(d, this.engine)
    if (!s.start()) return undefined
    if (!this.state.flags.has(`met_${id}`)) this.emit(this.engine.apply([{ type: 'flag', id: `met_${id}` }]))
    return s
  }
  flushDialogue(s: DialogueSession): void { this.emit(s.drainEvents()) }
  useHotspot(h: Hotspot, code?: string): CaseEvent[] { const events = this.engine.useHotspot(h, code); this.emit(events); return events }

  tie(a: EvidenceId, b: EvidenceId): TieResult { const { result, events } = this.engine.tie(a, b); this.emit(events); return result }

  accuse(culprit: string, motive: string): ReturnType<CaseEngine['accuse']> {
    const result = this.engine.accuse(culprit, motive)
    if (result === 'wrong-culprit' || result === 'wrong-motive') {
      this.progress.stats.wrongAccusations++
      this.clock.advanceMinutes(60)
      const untilMinute = this.progress.mode === 'realistic' ? this.clock.stamp / 60_000 + 60 : this.clock.elapsedStoryMinutes + 60
      if (culprit in CHARACTERS && culprit !== 'yassin') this.state.offended.set(culprit as CharacterId, { untilEvidence: this.state.evidence.size + 1, untilMinute })
      this.save()
    } else if (result === 'ok') {
      // `case_solved` is the shared flag; `<caseId>_solved` is what that case's last objective waits for.
      this.state.flags.add('case_solved')
      this.state.flags.add(`${this.caseId}_solved`)
      this.emit([{ type: 'flag', id: 'case_solved' }, { type: 'flag', id: `${this.caseId}_solved` }])
    }
    return result
  }

  hintCost(tier: 1 | 2 | 3): number { return tier === 1 ? 1 : tier === 2 ? 3 : 6 }
  nextHintCost(): number {
    const o = this.engine.currentObjective()
    return this.hintCost(this.deps.hints.nextTier(o?.id ?? ''))
  }
  async hint(): Promise<Hint | { wait: number } | undefined> {
    const o = this.engine.currentObjective()
    if (!o) return undefined
    const r = await this.deps.hints.request({ objectiveId: o.id, objectiveTitle: o.title, objectiveDetail: o.detail, evidenceTitles: [...this.state.evidence.keys()].map(id => this.engine.evidenceInfo(id).title) })
    if ('text' in r) {
      this.progress.stats.hints++
      this.progress.stats.hintTiers ??= {}
      this.progress.stats.hintTiers[r.tier] = (this.progress.stats.hintTiers[r.tier] ?? 0) + 1
    }
    return r
  }

  gradeReport(): GradeResult {
    return computeGrade(this.progress.caseStats ?? { [this.caseId]: this.progress.stats }, this.caseFile, this.state)
  }
  tick(seconds: number): void { this.clock.tick(seconds); this.progress.playMs += seconds * 1000 }
  setPosition(zone: 'abis' | 'city', x: number, z: number, yaw: number): void { this.progress.position = { zone, x, z, yaw } }
  save(): void {
    this.progress.case = this.state.snapshot()
    this.progress.cases ??= {}
    this.progress.cases[this.caseId] = this.progress.case
    this.progress.caseStats ??= {}
    this.progress.caseStats[this.caseId] = this.progress.stats
    this.progress.storyMinutes = this.clock.elapsedStoryMinutes
    this.progress.penaltyMs = this.clock.penaltyMs
    this.deps.profiles.save(this.progress)
  }
  knownCharacters(): CharacterProfile[] {
    const opening = this.caseId === 'case01' ? ['mahmoud', 'zeinab'] : []
    return Object.values(CHARACTERS).filter(c => this.inCase(c) || opening.includes(c.id))
      .filter(c => opening.includes(c.id) || this.state.flags.has(`met_${c.id}`))
  }
}
