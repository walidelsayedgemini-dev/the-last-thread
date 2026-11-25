/**
 * Overlay feedback for the 2D investigation: compact toasts (max two, top centre, auto-dismiss, duplicates
 * merged), a narration card for hotspot text, the hint bubble and the fade/loading layers. Guidance about what
 * to do next lives only in the investigation view's objective banner, so nothing here repeats it.
 */
import { arabicDigits } from '../core/clock'
import type { GameMode, Objective } from '../data/types'
import { h } from './dom'

export type HudActions = {
  casefile(): void
  hint(): void
  camera(): void
  pause(): void
  interact(): void
}

export type HudFrame = {
  hour: number
  mode: GameMode
  objective?: Objective
  evidence: number
  total: number
  photoNearby: boolean
}

export type ToastKind = 'evidence' | 'deduction' | 'info' | 'warn'
const ICON: Record<ToastKind, string> = { evidence: '▤', deduction: '⟡', info: '•', warn: '!' }
const TIER_NAME = ['', 'تلميح خفيف', 'تلميح أوضح', 'الحل تقريباً']

export class Hud {
  readonly el: HTMLElement
  private readonly toasts = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' })
  private readonly narrationText = h('p')
  private readonly narration: HTMLElement
  private readonly hintText = h('p')
  private readonly hintMeta = h('small')
  private readonly hintBubble: HTMLElement
  private readonly fadeEl = h('div', { class: 'fade' })
  private readonly loadEl = h('div', { class: 'loading-note', hidden: true })
  private narrationTimer = 0
  private hintTimer = 0

  constructor(_actions: HudActions) {
    this.narration = h('aside', { class: 'narration', hidden: true, onclick: () => this.hideNarration() },
      h('span', { class: 'narration-mark', 'aria-hidden': true }, '❝'), this.narrationText,
      h('small', { class: 'narration-close' }, 'اضغط للإغلاق'))
    this.hintBubble = h('aside', { class: 'hint-bubble', hidden: true, role: 'note', onclick: () => (this.hintBubble.hidden = true) },
      h('span', { class: 'hint-mark', 'aria-hidden': true }, '✦'), h('div', null, this.hintMeta, this.hintText))
    this.el = h('div', { class: 'hud', hidden: true }, this.toasts, this.narration, this.hintBubble)
  }

  get layers(): HTMLElement[] {
    return [this.fadeEl, this.loadEl]
  }

  show(on: boolean): void {
    this.el.hidden = !on
    if (!on) {
      this.hideNarration()
      this.hintBubble.hidden = true
    }
  }

  /** Kept for the game loop; the investigation header owns all persistent status now. */
  frame(_f: HudFrame): void {}

  prompt(_text: string | null, _kind = 'hotspot'): void {}

  toast(text: string, kind: ToastKind): void {
    const existing = [...this.toasts.children].find(t => t.textContent?.endsWith(text)) as HTMLElement | undefined
    existing?.remove()
    const t = h('div', { class: `toast ${kind}` }, h('span', { class: 'toast-ico', 'aria-hidden': true }, ICON[kind]), h('span', null, text))
    this.toasts.append(t)
    while (this.toasts.children.length > 2) this.toasts.firstElementChild?.remove()
    const life = kind === 'info' ? 2600 : 3800
    window.setTimeout(() => t.classList.add('out'), life)
    window.setTimeout(() => t.remove(), life + 450)
  }

  narrate(text: string): void {
    this.narration.hidden = false
    this.narrationText.textContent = text
    this.narration.classList.remove('in')
    void this.narration.offsetWidth
    this.narration.classList.add('in')
    clearTimeout(this.narrationTimer)
    this.narrationTimer = window.setTimeout(() => this.hideNarration(), Math.min(11000, 3500 + text.length * 60))
  }

  hideNarration(): void {
    clearTimeout(this.narrationTimer)
    this.narration.hidden = true
  }

  hint(text: string, tier: number, source: string, cost?: number): void {
    this.hintBubble.hidden = false
    this.hintText.textContent = text
    this.hintMeta.textContent = `${TIER_NAME[tier] ?? 'تلميح'}${source === 'remote' ? ' • ذكي' : ''}${cost ? ` • خصم ${arabicDigits(cost)} من التقدير` : ''}`
    this.hintBubble.dataset.tier = String(tier)
    clearTimeout(this.hintTimer)
    this.hintTimer = window.setTimeout(() => (this.hintBubble.hidden = true), 12000)
  }

  async fade(change: () => Promise<void> | void): Promise<void> {
    this.fadeEl.classList.add('on')
    await new Promise(r => setTimeout(r, 450))
    await change()
    await new Promise(r => setTimeout(r, 250))
    this.fadeEl.classList.remove('on')
  }

  loading(text: string | null): void {
    this.loadEl.hidden = text === null
    if (text) this.loadEl.textContent = text
  }
}
