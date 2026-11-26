/**
 * Dialogue session engine: walks a branching `Dialogue` tree while applying effects to the case.
 *
 * The UI only renders what `view()` returns and calls `choose()` / `advance()`; all branching,
 * condition checks and one-shot choices live here so they can be tested without a DOM.
 */
import type { CaseEngine, CaseEvent } from './caseState'
import { LIFE_CHOICES } from '../data/life'
import type { Dialogue, DialogueChoice, DialogueLine, DialogueNode } from '../data/types'

export type DialogueView = {
  nodeId: string
  lines: DialogueLine[]
  /** Choices currently available (conditions and `once` filtering already applied). */
  choices: { index: number; text: string; present?: DialogueChoice['present']; confront?: boolean; lie?: boolean; path?: string }[]
  /** Conversation has nothing further after this node. */
  finished: boolean
}

export class DialogueSession {
  private node: DialogueNode | undefined
  /** Case changes caused since the last call to {@link drainEvents}. */
  private events: CaseEvent[] = []

  constructor(private readonly dialogue: Dialogue, private readonly caseEngine: CaseEngine) {}

  /** Begin at the first entry whose condition holds. Returns false if nothing matches. */
  start(): boolean {
    const entry = this.dialogue.entries.find(e => this.caseEngine.matches(e.when))
    if (!entry) return false
    this.enter(entry.node)
    return true
  }

  private enter(nodeId: string): void {
    const node = this.dialogue.nodes[nodeId]
    if (!node) throw new Error(`Dialogue ${this.dialogue.character}: unknown node ${nodeId}`)
    this.node = node
    this.events.push(...this.caseEngine.apply(node.effects))
  }

  private choiceKey(index: number): string {
    return `${this.dialogue.character}:${this.node!.id}:${index}`
  }

  private visibleChoices(): { index: number; choice: DialogueChoice }[] {
    const choices = this.node?.choices ?? []
    return choices
      .map((choice, index) => ({ choice, index }))
      .filter(({ choice, index }) => this.caseEngine.matches(choice.when) && !(choice.once && this.caseEngine.state.seenChoices.has(this.choiceKey(index))))
  }

  /** Moral path a choice leads to (its own effects, or those of the node it opens). */
  private pathOf(choice: DialogueChoice): string | undefined {
    const effects = [...(choice.effects ?? []), ...(this.dialogue.nodes[choice.next]?.effects ?? [])]
    for (const ef of effects) {
      if (ef.type !== 'flag') continue
      const hit = LIFE_CHOICES.find(l => l.flag === ef.id)
      if (hit) return hit.path
    }
    return undefined
  }
  view(): DialogueView | undefined {
    if (!this.node) return undefined
    const choices = this.visibleChoices()
    return {
      nodeId: this.node.id,
      lines: this.node.lines,
      choices: choices.map(({ index, choice }) => ({ index, text: choice.text, present: choice.present, confront: choice.confront, lie: choice.lie, path: this.pathOf(choice) })),
      finished: choices.length === 0 && !this.node.next,
    }
  }

  /** Pick a choice by its original index. */
  choose(index: number): void {
    const picked = this.visibleChoices().find(c => c.index === index)
    if (!picked) return
    if (picked.choice.once) this.caseEngine.state.seenChoices.add(this.choiceKey(index))
    this.events.push(...this.caseEngine.apply(picked.choice.effects))
    this.enter(picked.choice.next)
  }

  /** Continue to the next node when the current node has no choices; ends the session otherwise. */
  advance(): boolean {
    const next = this.node?.next
    if (!next || this.visibleChoices().length > 0) {
      this.node = undefined
      return false
    }
    this.enter(next)
    return true
  }

  get active(): boolean {
    return this.node !== undefined
  }

  end(): void {
    this.node = undefined
  }

  drainEvents(): CaseEvent[] {
    const out = this.events
    this.events = []
    return out
  }
}

/** Replace `{player}` / `{home}` placeholders. Unknown placeholders are left untouched. */
export function fillText(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, key: string) => vars[key] ?? m)
}
