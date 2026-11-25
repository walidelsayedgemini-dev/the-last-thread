/**
 * In-game HUD: objective card with a direction arrow, clock + mode badge, interaction prompt,
 * toasts, narration box, hint bubble and the fade/loading layers. Everything is plain DOM so it
 * costs no GPU memory and works the same on desktop and phones.
 */
import { arabicDigits, formatClock } from '../core/clock'
import type { GameMode, Objective } from '../data/types'
import { h, setChildren } from './dom'

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
  /** Direction to the objective relative to the camera (radians, 0 = straight ahead) and metres. */
  arrow?: { angle: number; dist: number; otherZone?: string }
  evidence: number
  total: number
  photoNearby: boolean
}

export class Hud {
  readonly el: HTMLElement
  private readonly objTitle = h('b')
  private readonly objDetail = h('span')
  private readonly arrow = h('i', { class: 'arrow' }, '➤')
  private readonly arrowText = h('small')
  private readonly clock = h('b')
  private readonly modeBadge = h('span', { class: 'mode' })
  private readonly count = h('span', { class: 'ev-count' })
  private readonly promptBtn: HTMLButtonElement
  private readonly toasts = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite', 'aria-relevant': 'additions' })
  private readonly narration = h('p', { class: 'narration', hidden: true })
  private readonly hintBubble = h('p', { class: 'hint-bubble', hidden: true })
  private readonly fadeEl = h('div', { class: 'fade' })
  private readonly loadEl = h('div', { class: 'loading-note', hidden: true })
  private readonly camBtn: HTMLButtonElement
  private narrationTimer = 0
  private hintTimer = 0
  private lastObjective = ''
  private lastClock = ''

  constructor(actions: HudActions) {
    this.promptBtn = h('button', { class: 'prompt', hidden: true, onclick: actions.interact })
    this.camBtn = h('button', { class: 'hud-btn cam', hidden: true, 'aria-label': 'كاميرا', onclick: actions.camera }, '📷', h('kbd', null, 'C'))
    this.el = h('div', { class: 'hud', hidden: true },
      h('div', { class: 'hud-top' },
        h('div', { class: 'objective' }, h('small', null, 'المهمة'), this.objTitle, this.objDetail, h('div', { class: 'dir' }, this.arrow, this.arrowText)),
        h('div', { class: 'status' }, this.clock, this.modeBadge, this.count)),
      this.toasts, this.narration, this.hintBubble,
      this.promptBtn,
      h('div', { class: 'hud-btns' },
        this.camBtn,
        h('button', { class: 'hud-btn', 'aria-label': 'تلميح', onclick: actions.hint }, '💡', h('kbd', null, 'H')),
        h('button', { class: 'hud-btn', 'aria-label': 'ملف القضية', onclick: actions.casefile }, '🗂', h('kbd', null, 'Tab')),
        h('button', { class: 'hud-btn', 'aria-label': 'إيقاف مؤقت', onclick: actions.pause }, '⏸', h('kbd', null, 'Esc'))),
    )
  }

  get layers(): HTMLElement[] {
    return [this.fadeEl, this.loadEl]
  }

  show(on: boolean): void {
    this.el.hidden = !on
  }

  frame(f: HudFrame): void {
    const key = f.objective?.id ?? 'none'
    if (key !== this.lastObjective) {
      this.lastObjective = key
      this.objTitle.textContent = f.objective?.title ?? 'القضية اتقفلت'
      this.objDetail.textContent = f.objective?.detail ?? 'عظمة على الشغل يا محقّق.'
    }
    const clock = formatClock(f.hour)
    if (clock !== this.lastClock) {
      this.lastClock = clock
      this.clock.textContent = clock
      this.modeBadge.textContent = f.mode === 'realistic' ? 'واقعي' : 'قصة'
      this.modeBadge.dataset.mode = f.mode
      this.count.textContent = `🗂 ${arabicDigits(f.evidence)}/${arabicDigits(f.total)}`
    }
    if (f.arrow) {
      this.arrow.style.transform = `rotate(${-90 - (f.arrow.angle * 180) / Math.PI}deg)`
      this.arrow.style.visibility = f.arrow.otherZone ? 'hidden' : 'visible'
      this.arrowText.textContent = f.arrow.otherZone ? `الهدف في ${f.arrow.otherZone}` : `${arabicDigits(Math.round(f.arrow.dist))} م`
    } else {
      this.arrow.style.visibility = 'hidden'
      this.arrowText.textContent = ''
    }
    this.camBtn.hidden = !f.photoNearby
  }

  prompt(text: string | null, kind: string = 'hotspot'): void {
    this.promptBtn.hidden = text === null
    if (text === null) return
    this.promptBtn.dataset.kind = kind
    setChildren(this.promptBtn, h('kbd', null, 'E'), text)
  }

  toast(text: string, kind: 'evidence' | 'deduction' | 'info' | 'warn'): void {
    const t = h('div', { class: `toast ${kind}` }, text)
    this.toasts.append(t)
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove()
    window.setTimeout(() => t.classList.add('out'), kind === 'info' ? 3200 : 4800)
    window.setTimeout(() => t.remove(), kind === 'info' ? 3700 : 5300)
  }

  narrate(text: string): void {
    this.narration.hidden = false
    this.narration.textContent = text
    clearTimeout(this.narrationTimer)
    this.narrationTimer = window.setTimeout(() => (this.narration.hidden = true), Math.min(9000, 2500 + text.length * 55))
  }

  hint(text: string, tier: number, source: string): void {
    this.hintBubble.hidden = false
    this.hintBubble.textContent = `💡 ${text}`
    this.hintBubble.dataset.tier = String(tier)
    this.hintBubble.title = source === 'remote' ? 'تلميح ذكي' : 'تلميح'
    clearTimeout(this.hintTimer)
    this.hintTimer = window.setTimeout(() => (this.hintBubble.hidden = true), 9000)
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
