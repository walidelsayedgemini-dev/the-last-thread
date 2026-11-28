/**
 * Case state: the single mutable record of what the player knows.
 *
 * `CaseEngine` interprets a static `CaseFile` (data) against a `CaseState` (progress). It is pure
 * TypeScript with no DOM / three.js dependency so rules can be unit-tested and reused unchanged by
 * the AntiGravity phase.
 */
import type { CaseFile, CharacterId, Condition, DeductionId, Effect, Evidence, EvidenceId, Hotspot, Objective, PlaceId } from '../data/types'
import { evalGate, type GateContext } from './gates'

export type CaseLogKind = 'dialogue' | 'evidence' | 'deduction'
export type CaseLogEntry = { kind: CaseLogKind; id: string; at: number; hour: number; place?: PlaceId }

/** Serializable progress snapshot (stored by ProfileService). */
export type CaseSnapshot = {
  flags: string[]
  /** Evidence id → Cairo stamp when found. */
  evidence: { id: EvidenceId; at: number }[]
  deductions: DeductionId[]
  /** Consumed one-shot hotspots. */
  hotspots: string[]
  /** `once` dialogue choices already taken (`character:node:index`). */
  seenChoices: string[]
  /** Evidence records opened by the player; optional so pre-migration saves remain valid. */
  reviewedEvidence?: EvidenceId[]
  /** Exact evidence pairs the player tied; optional for saves created before pair tracking. */
  threads?: { deduction: DeductionId; pair: [EvidenceId, EvidenceId] }[]
  /** Characters temporarily offended by a wrong accusation. Optional for old saves. */
  offended?: { character: CharacterId; untilEvidence: number; untilMinute: number }[]
  /** Discovered case activity only; optional so older saves remain valid. */
  caseLog?: CaseLogEntry[]
}

/** Recover only legacy links that are mathematically unambiguous from the old snapshot. */
export function restoreLegacyThreads(snapshot: CaseSnapshot, file: CaseFile): void {
  if (snapshot.threads !== undefined) return
  const found = new Set(snapshot.evidence.map(item => item.id))
  const tied = new Set(snapshot.deductions)
  snapshot.threads = []
  for (const deduction of file.deductions) {
    if (!tied.has(deduction.id)) continue
    const candidates = deduction.pairs.filter(([a, b]) => found.has(a) && found.has(b))
    if (candidates.length === 1) snapshot.threads.push({ deduction: deduction.id, pair: candidates[0] })
  }
}

export class CaseState {
  readonly flags = new Set<string>()
  readonly evidence = new Map<EvidenceId, number>()
  readonly deductions = new Set<DeductionId>()
  readonly hotspots = new Set<string>()
  readonly seenChoices = new Set<string>()
  readonly reviewedEvidence = new Set<EvidenceId>()
  readonly threads = new Map<DeductionId, [EvidenceId, EvidenceId][]>()
  readonly offended = new Map<CharacterId, { untilEvidence: number; untilMinute: number }>()
  readonly caseLog: CaseLogEntry[] = []

  snapshot(): CaseSnapshot {
    return {
      flags: [...this.flags],
      evidence: [...this.evidence].map(([id, at]) => ({ id, at })),
      deductions: [...this.deductions],
      hotspots: [...this.hotspots],
      seenChoices: [...this.seenChoices],
      reviewedEvidence: [...this.reviewedEvidence],
      threads: [...this.threads].flatMap(([deduction, pairs]) => pairs.map(pair => ({ deduction, pair }))),
      offended: [...this.offended].map(([character, value]) => ({ character, ...value })),
      caseLog: this.caseLog.map(entry => ({ ...entry })),
    }
  }

  static from(snapshot: CaseSnapshot): CaseState {
    const s = new CaseState()
    snapshot.flags.forEach(f => s.flags.add(f))
    snapshot.evidence.forEach(e => s.evidence.set(e.id, e.at))
    snapshot.deductions.forEach(d => s.deductions.add(d))
    snapshot.hotspots.forEach(h => s.hotspots.add(h))
    snapshot.seenChoices.forEach(c => s.seenChoices.add(c))
    snapshot.reviewedEvidence?.forEach(id => s.reviewedEvidence.add(id))
    for (const { deduction, pair } of snapshot.threads ?? []) {
      const pairs = s.threads.get(deduction) ?? []
      if (pair[0] !== pair[1] && !pairs.some(([a, b]) => (a === pair[0] && b === pair[1]) || (a === pair[1] && b === pair[0]))) pairs.push(pair)
      s.threads.set(deduction, pairs)
    }
    for (const item of snapshot.offended ?? []) s.offended.set(item.character, { untilEvidence: item.untilEvidence, untilMinute: item.untilMinute })
    s.caseLog.push(...(snapshot.caseLog ?? []).map(entry => ({ ...entry })))
    return s
  }
}

/** Something that changed as a result of an action, for toasts, sounds and autosave. */
export type CaseEvent =
  | { type: 'evidence'; evidence: Evidence }
  | { type: 'evidence-gated'; evidence: Evidence; reason?: string }
  | { type: 'flag'; id: string }
  | { type: 'deduction'; id: DeductionId }

export type TieResult =
  | { ok: true; deduction: DeductionId; fresh: boolean; pairFresh: boolean }
  | { ok: false; reason: 'same' | 'missing' | 'no-link' }

export class CaseEngine {
  private readonly evidenceById: Map<EvidenceId, Evidence>

  constructor(
    readonly file: CaseFile,
    readonly state: CaseState,
    /** Supplies the current mode/time/event lookup; read lazily so it always reflects "now". */
    private readonly gateContext: () => GateContext,
  ) {
    this.evidenceById = new Map(file.evidence.map(e => [e.id, e]))
  }

  evidenceInfo(id: EvidenceId): Evidence {
    const e = this.evidenceById.get(id)
    if (!e) throw new Error(`Unknown evidence ${id}`)
    return e
  }

  has(id: EvidenceId): boolean {
    return this.state.evidence.has(id)
  }

  /** Does the condition currently hold? */
  matches(cond: Condition | undefined): boolean {
    if (!cond) return true
    const s = this.state
    if (cond.flags && !cond.flags.every(f => s.flags.has(f))) return false
    if (cond.notFlags && cond.notFlags.some(f => s.flags.has(f))) return false
    if (cond.evidence && !cond.evidence.every(e => s.evidence.has(e))) return false
    if (cond.notEvidence && cond.notEvidence.some(e => s.evidence.has(e))) return false
    if (cond.deductions && !cond.deductions.every(d => s.deductions.has(d))) return false
    const ctx = this.gateContext()
    if (cond.gate && !evalGate(cond.gate, ctx).open) return false
    if (cond.closedGate && evalGate(cond.closedGate, ctx).open) return false
    return true
  }

  /**
   * Apply data effects. Evidence behind a closed real-time gate is refused (reported as
   * `evidence-gated`) so a gate cannot be bypassed by reaching the content another way.
   */
  apply(effects: Effect[] | undefined): CaseEvent[] {
    const events: CaseEvent[] = []
    for (const fx of effects ?? []) {
      if (fx.type === 'flag') {
        if (!this.state.flags.has(fx.id)) {
          this.state.flags.add(fx.id)
          events.push({ type: 'flag', id: fx.id })
        }
      } else if (fx.type === 'unflag') this.state.flags.delete(fx.id)
      else events.push(...this.grant(fx.id))
    }
    return events
  }

  private grant(id: EvidenceId): CaseEvent[] {
    if (this.state.evidence.has(id)) return []
    const evidence = this.evidenceInfo(id)
    const ctx = this.gateContext()
    const gate = evalGate(evidence.gate, ctx)
    if (!gate.open) return [{ type: 'evidence-gated', evidence, reason: gate.reason }]
    this.state.evidence.set(id, ctx.stamp)
    return [{ type: 'evidence', evidence }]
  }

  /**
   * The player ties two pieces of evidence together on the investigation board. Returns which
   * deduction (if any) they prove.
   */
  tie(a: EvidenceId, b: EvidenceId): { result: TieResult; events: CaseEvent[] } {
    if (a === b) return { result: { ok: false, reason: 'same' }, events: [] }
    if (!this.has(a) || !this.has(b)) return { result: { ok: false, reason: 'missing' }, events: [] }
    const hit = this.file.deductions.find(d => d.pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a)))
    if (!hit) return { result: { ok: false, reason: 'no-link' }, events: [] }
    const pairs = this.state.threads.get(hit.id) ?? []
    const pairFresh = !pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
    if (pairFresh) {
      pairs.push([a, b])
      this.state.threads.set(hit.id, pairs)
    }
    const fresh = !this.state.deductions.has(hit.id)
    const events: CaseEvent[] = []
    if (fresh) {
      this.state.deductions.add(hit.id)
      events.push({ type: 'deduction', id: hit.id })
      events.push(...this.apply((hit.sets ?? []).map(id => ({ type: 'flag', id }) as Effect)))
    }
    return { result: { ok: true, deduction: hit.id, fresh, pairFresh }, events }
  }

  /** Objectives currently visible (their `when` holds) with completion status. */
  objectives(): { objective: Objective; done: boolean }[] {
    return this.file.objectives
      .map(objective => ({ objective, done: this.matches(objective.doneWhen) }))
      .filter(o => o.done || this.matches(o.objective.when))
  }

  /** The first unfinished visible objective, used by the HUD and the hint service. */
  currentObjective(): Objective | undefined {
    return this.objectives().find(o => !o.done)?.objective
  }

  /** Hotspots the player can use now (conditions hold and not consumed). */
  activeHotspots(): Hotspot[] {
    return this.file.hotspots.filter(h => this.hotspotAvailable(h))
  }

  hotspotAvailable(h: Hotspot): boolean {
    if (h.consumable && this.state.hotspots.has(h.id)) return false
    return this.matches(h.when)
  }

  /** Use a hotspot: apply its effects once and mark consumable ones as used. */
  useHotspot(h: Hotspot, code?: string): CaseEvent[] {
    if (h.lockCode && (h.lockCode !== code || !this.hotspotAvailable(h))) return []
    const events = this.apply(h.effects)
    // A gated evidence refusal must not consume the hotspot: the player can come back later.
    const refused = events.some(e => e.type === 'evidence-gated')
    if (h.consumable && !refused) this.state.hotspots.add(h.id)
    return events
  }

  /** Share of all evidence found, 0..1 (used for the final grade). */
  completeness(): number {
    const required = this.file.evidence.filter(e => !e.bonus)
    return required.length ? required.filter(e => this.state.evidence.has(e.id)).length / required.length : 1
  }

  /** Can the player make the final accusation? */
  canAccuse(): boolean {
    return this.matches(this.file.finale.requires)
  }

  /** Grade the accusation. */
  accuse(culprit: string, motiveId: string): 'ok' | 'wrong-culprit' | 'wrong-motive' | 'locked' {
    if (!this.canAccuse()) return 'locked'
    if (culprit !== this.file.finale.culprit) return 'wrong-culprit'
    const motive = this.file.finale.motives.find(m => m.id === motiveId)
    if (!motive?.correct) return 'wrong-motive'
    this.state.flags.add('case_solved')
    return 'ok'
  }

  /** Letter grade by completeness once the case is solved. */
  grade(): 'S' | 'A' | 'B' | 'C' {
    const c = this.completeness()
    return c >= 1 ? 'S' : c >= 0.85 ? 'A' : c >= 0.7 ? 'B' : 'C'
  }
}
