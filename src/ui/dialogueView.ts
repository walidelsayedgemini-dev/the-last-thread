/**
 * Dialogue overlay: portrait dossier card, typewriter lines and numbered choices.
 * Keyboard: Space/Enter/E continue, 1–4 pick a choice, Esc leaves.
 */
import type { DialogueSession } from '../core/dialogue'
import { CHARACTERS } from '../data/characters'
import type { CharacterProfile, DialogueLine } from '../data/types'
import type { Audio } from '../engine/audio'
import { h, setChildren } from './dom'

export class DialogueView {
  readonly el: HTMLElement
  private readonly portrait: HTMLElement
  private readonly nameEl: HTMLElement
  private readonly textEl: HTMLElement
  private readonly choicesEl: HTMLElement
  private readonly moreEl: HTMLElement
  private session?: DialogueSession
  private lines: DialogueLine[] = []
  private lineIndex = 0
  private typing = 0
  private full = ''
  private onClose?: () => void
  private flush?: () => void
  private who?: CharacterProfile
  private playerName = ''

  constructor(private readonly audio: Audio, private readonly fill: (t: string) => string) {
    this.portrait = h('div', { class: 'dlg-portrait' })
    this.nameEl = h('div', { class: 'dlg-name' })
    this.textEl = h('p', { class: 'dlg-text' })
    this.choicesEl = h('div', { class: 'dlg-choices' })
    this.moreEl = h('button', { class: 'dlg-more', onclick: () => this.next() }, 'كمّل ◂')
    this.el = h('section', { class: 'dialogue', hidden: true, role: 'dialog', 'aria-live': 'polite' },
      h('div', { class: 'dlg-card' }, this.portrait, h('div', { class: 'dlg-body' }, this.nameEl, this.textEl, this.choicesEl, this.moreEl)),
    )
    this.el.addEventListener('click', e => {
      if (e.target === this.textEl || e.target === this.el) this.next()
    })
  }

  get open(): boolean {
    return !this.el.hidden
  }

  start(session: DialogueSession, who: CharacterProfile, playerName: string, onClose: () => void, flush: () => void): void {
    this.flush = flush
    this.session = session
    this.who = who
    this.playerName = playerName
    this.onClose = onClose
    this.el.hidden = false
    this.loadNode()
  }

  private loadNode(): void {
    this.flush?.()
    const v = this.session?.view()
    if (!v) return this.close()
    this.lines = v.lines
    this.lineIndex = 0
    this.showLine()
  }

  private showLine(): void {
    const line = this.lines[this.lineIndex]
    const speaker = line.who === 'player' ? undefined : line.who === 'narrator' ? undefined : CHARACTERS[line.who]
    const label = line.who === 'player' ? this.playerName : line.who === 'narrator' ? 'الراوي' : speaker?.nickname ?? speaker?.name ?? ''
    const prof = speaker ?? this.who!
    this.portrait.style.setProperty('--accent', line.who === 'player' ? '#b3121f' : prof.figure.accent)
    this.portrait.style.setProperty('--body', line.who === 'player' ? '#1a1a1a' : prof.figure.body)
    setChildren(this.portrait,
      h('span', { class: 'dlg-initial' }, line.who === 'narrator' ? '…' : label.replace(/^(ال|عم |المعلم |الحاجة )/, '').slice(0, 1)),
      h('span', { class: 'dlg-file' }, line.who === 'player' ? 'المحقّق' : line.who === 'narrator' ? '' : `ملف: ${prof.role}`),
    )
    this.el.dataset.who = line.who
    this.nameEl.textContent = label
    this.full = this.fill(line.text)
    this.typing = 0
    this.textEl.textContent = ''
    setChildren(this.choicesEl)
    this.moreEl.hidden = true
    this.audio.play('paper')
  }

  /** Advance the typewriter by real time; called every frame while open. */
  frame(dt: number): void {
    if (!this.open || this.typing >= this.full.length) return
    this.typing = Math.min(this.full.length, this.typing + dt * 55)
    this.textEl.textContent = this.full.slice(0, Math.floor(this.typing))
    if (this.typing >= this.full.length) this.finishLine()
  }

  private finishLine(): void {
    this.typing = this.full.length
    this.textEl.textContent = this.full
    const lastLine = this.lineIndex >= this.lines.length - 1
    const v = this.session?.view()
    if (lastLine && v && v.choices.length > 0) {
      setChildren(this.choicesEl, v.choices.map((c, i) =>
        h('button', { class: 'dlg-choice', onclick: () => this.choose(c.index) }, h('b', null, String(i + 1)), this.fill(c.text))))
      this.moreEl.hidden = true
    } else {
      this.moreEl.hidden = false
      this.moreEl.textContent = lastLine && v?.finished ? 'إنهاء ◂' : 'كمّل ◂'
    }
  }

  next(): void {
    if (!this.open) return
    if (this.typing < this.full.length) return this.finishLine()
    if (this.lineIndex < this.lines.length - 1) {
      this.lineIndex++
      return this.showLine()
    }
    const v = this.session?.view()
    if (v && v.choices.length > 0) return
    if (this.session?.advance()) this.loadNode()
    else this.close()
  }

  choose(index: number): void {
    this.audio.play('ui')
    this.session?.choose(index)
    this.loadNode()
  }

  /** Keyboard while open. Returns true when handled. */
  key(e: KeyboardEvent): boolean {
    if (!this.open) return false
    if (e.code === 'Escape') {
      this.close()
      return true
    }
    if (/^Digit[1-9]$/.test(e.code)) {
      const btn = this.choicesEl.querySelectorAll<HTMLButtonElement>('button')[Number(e.code.slice(5)) - 1]
      btn?.click()
      return true
    }
    if (['Space', 'Enter', 'KeyE', 'NumpadEnter'].includes(e.code)) {
      this.next()
      return true
    }
    return false
  }

  close(): void {
    if (this.el.hidden) return
    this.el.hidden = true
    this.session?.end()
    this.flush?.()
    const cb = this.onClose
    this.onClose = undefined
    cb?.()
  }
}
