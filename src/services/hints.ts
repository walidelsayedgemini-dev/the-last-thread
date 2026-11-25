/**
 * Smart-hint service (the "ChatGPT" slot).
 *
 * Two interchangeable providers behind one interface:
 *  - {@link LocalHintProvider}: tiered, hand-written hints from `data/hints.ts` (always available).
 *  - {@link RemoteChatProvider}: POSTs the case context to *your own proxy endpoint*, which calls an
 *    LLM. API keys must never ship in the browser, which is why the game only knows a URL.
 *
 * `HintService` rate-limits requests (cooldown), escalates tiers per objective, and silently falls
 * back to the local provider when the remote one is missing, slow or fails.
 */
import { FALLBACK_HINT, LOCAL_HINTS } from '../data/hints'

export type HintContext = {
  objectiveId: string
  objectiveTitle: string
  objectiveDetail: string
  /** 1 = nudge, 2 = location, 3 = explicit action. */
  tier: 1 | 2 | 3
  evidenceTitles: string[]
}

export type Hint = { text: string; source: 'local' | 'remote'; tier: 1 | 2 | 3 }

export interface HintProvider {
  readonly name: string
  hint(ctx: HintContext): Promise<string>
}

class LocalHintProvider implements HintProvider {
  readonly name = 'local'
  async hint(ctx: HintContext): Promise<string> {
    const set = LOCAL_HINTS[ctx.objectiveId] ?? FALLBACK_HINT
    return set[ctx.tier - 1]
  }
}

/** Contract: POST JSON {game, locale:'ar', ...HintContext} → {hint: string}. */
export class RemoteChatProvider implements HintProvider {
  readonly name = 'remote-chat'
  constructor(private readonly endpoint: string, private readonly timeoutMs = 7000) {}
  async hint(ctx: HintContext): Promise<string> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs)
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ game: 'the-last-thread', locale: 'ar', dialect: 'egyptian', ...ctx }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const out = (await res.json()) as { hint?: unknown }
      if (typeof out.hint !== 'string' || !out.hint.trim()) throw new Error('empty')
      return out.hint.trim().slice(0, 400)
    } finally {
      clearTimeout(timer)
    }
  }
}

export class HintService {
  private readonly tiers = new Map<string, 1 | 2 | 3>()
  private lastAt = -Infinity

  constructor(
    private readonly local: HintProvider = new LocalHintProvider(),
    private remote?: HintProvider,
    private readonly cooldownMs = 4000,
    private readonly clock: () => number = () => performance.now(),
  ) {}

  setRemote(provider: HintProvider | undefined): void {
    this.remote = provider
  }

  get remoteEnabled(): boolean {
    return !!this.remote
  }

  /** Seconds the player must still wait before asking again (0 = ready). */
  cooldownLeft(): number {
    return Math.max(0, Math.ceil((this.lastAt + this.cooldownMs - this.clock()) / 1000))
  }

  /** Ask for the next hint for an objective; each request escalates until tier 3. */
  async request(ctx: Omit<HintContext, 'tier'>): Promise<Hint | { wait: number }> {
    const wait = this.cooldownLeft()
    if (wait > 0) return { wait }
    this.lastAt = this.clock()
    const tier = this.tiers.get(ctx.objectiveId) ?? 1
    this.tiers.set(ctx.objectiveId, tier === 3 ? 3 : ((tier + 1) as 2 | 3))
    const full: HintContext = { ...ctx, tier }
    if (this.remote) {
      try {
        return { text: await this.remote.hint(full), source: 'remote', tier }
      } catch {
        // Fall through to the offline hints.
      }
    }
    return { text: await this.local.hint(full), source: 'local', tier }
  }

  /** Tier that the next request for an objective will use. */
  nextTier(objectiveId: string): 1 | 2 | 3 {
    return this.tiers.get(objectiveId) ?? 1
  }

  /** Forget one objective's escalation (normally useful when switching cases). */
  resetObjective(objectiveId: string): void {
    this.tiers.delete(objectiveId)
  }

  /** Forget escalation (e.g. when the objective changes or a new case starts). */
  reset(): void {
    this.tiers.clear()
  }
}
