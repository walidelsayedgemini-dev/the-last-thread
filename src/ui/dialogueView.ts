/**
 * Dialogue overlay in visual-novel style: blurred scene backdrop, large speaker portrait (tense after a
 * confrontation), the investigator's portrait on the other side, typewriter lines and choices. Choices that
 * present evidence are rendered as small evidence cards.
 * Keyboard: Space/Enter/E continue, 1–9 pick a choice, Esc leaves.
 */
import type { DialogueSession, DialogueView as View } from '../core/dialogue'
import { CHARACTERS } from '../data/characters'
import { voicePath } from '../data/voice'
import type { CharacterProfile, DialogueLine, EvidenceId, EvidenceKind } from '../data/types'
import type { Audio } from '../engine/audio'
import type { Avatar } from '../services/profiles'
import { playerPortrait, portraitUrl } from './art'
import { h, setChildren } from './dom'

export type DialogueContext = {
  /** Active case ID, used to keep identical node IDs across cases distinct. */
  caseId?: string
  /** Scene photograph shown blurred behind the conversation. */
  backdrop?: string
  avatar?: Partial<Avatar>
  /** Resolves evidence presented in a choice. */
  evidence?: (id: EvidenceId) => { title: string; kind: EvidenceKind } | undefined
  /** Feedback hook (haptics) for confrontations. */
  onConfront?: (lie: boolean) => void
}

const KIND_NAME: Record<EvidenceKind, string> = { object: 'غرض', testimony: 'شهادة', document: 'مستند', photo: 'صورة', trace: 'أثر' }
const initial = (name: string) => name.replace(/^(ال|عم |المعلم |الحاجة )/, '').slice(0, 1)

export class DialogueView {
  readonly el: HTMLElement
  private readonly backdrop: HTMLElement
  private readonly npcArt: HTMLElement
  private readonly playerArt: HTMLElement
  private readonly nameEl: HTMLElement
  private readonly roleEl: HTMLElement
  private readonly textEl: HTMLElement
  private readonly choicesEl: HTMLElement
  private readonly moreEl: HTMLButtonElement
  private session?: DialogueSession
  private lines: DialogueLine[] = []
  private lineIndex = 0
  private typing = 0
  private full = ''
  private onClose?: () => void
  private flush?: () => void
  private who?: CharacterProfile
  private playerName = ''
  private ctx: DialogueContext = {}
  /** The NPC turns tense after being confronted with evidence. */
  private tense = false
  private lastTick = 0

  constructor(private readonly audio: Audio, private readonly fill: (t: string) => string) {
    this.backdrop = h('div', { class: 'dlg-backdrop', 'aria-hidden': true })
    this.npcArt = h('figure', { class: 'dlg-art npc', 'aria-hidden': true })
    this.playerArt = h('figure', { class: 'dlg-art player', 'aria-hidden': true })
    this.nameEl = h('b', { class: 'dlg-name' })
    this.roleEl = h('small', { class: 'dlg-role' })
    this.textEl = h('p', { class: 'dlg-text' })
    this.choicesEl = h('div', { class: 'dlg-choices', role: 'group', 'aria-label': 'ردودك' })
    this.moreEl = h('button', { class: 'dlg-more', onclick: () => this.next() }, 'كمّل')
    this.el = h('section', { class: 'dialogue', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'حوار' },
      this.backdrop,
      this.npcArt,
      this.playerArt,
      h('button', { class: 'dlg-leave', 'aria-label': 'إنهاء الحوار', onclick: () => this.close() }, '✕', h('span', null, 'سيب الحوار')),
      h('div', { class: 'dlg-box' },
        h('header', { class: 'dlg-speaker' }, this.nameEl, this.roleEl),
        h('div', { class: 'dlg-text-wrap', 'aria-live': 'polite' }, this.textEl),
        this.choicesEl,
        this.moreEl),
    )
    this.el.addEventListener('click', e => {
      const t = e.target as HTMLElement
      if (t === this.textEl || t === this.el || t === this.backdrop || t.classList.contains('dlg-text-wrap')) this.next()
    })
  }

  get open(): boolean {
    return !this.el.hidden
  }

  start(session: DialogueSession, who: CharacterProfile, playerName: string, onClose: () => void, flush: () => void, ctx: DialogueContext = {}): void {
    this.flush = flush
    this.session = session
    this.who = who
    this.playerName = playerName
    this.onClose = onClose
    this.ctx = ctx
    this.tense = false
    this.backdrop.style.backgroundImage = ctx.backdrop ? `url("${ctx.backdrop}")` : ''
    this.el.style.setProperty('--accent', who.figure.accent)
    this.el.hidden = false
    this.el.classList.remove('leaving')
    this.el.classList.add('entering')
    window.setTimeout(() => this.el.classList.remove('entering'), 500)
    this.audio.play('door')
    this.loadNode()
  }

  private loadNode(): void {
    this.flush?.()
    const v = this.session?.view()
    if (!v) return this.close()
    this.lines = v.lines
    this.lineIndex = 0
    if (this.lines.length === 0) {
      this.lines = [{ who: 'narrator', text: '…' }]
    }
    this.showLine()
  }

  private art(target: HTMLElement, src: string | undefined, fallback: string, accent: string): void {
    const cur = target.querySelector('img')?.getAttribute('src')
    if (src && cur === src) return
    setChildren(target, src
      ? h('img', { src, alt: '', draggable: 'false' })
      : h('span', { class: 'dlg-initial', style: { color: accent } }, fallback))
  }

  private showLine(): void {
    const line = this.lines[this.lineIndex]
    const who = this.who!
    const nodeId = this.session?.view()?.nodeId ?? ''
    const speaker = line.who === 'player' || line.who === 'narrator' ? undefined : CHARACTERS[line.who]
    const npc = speaker && speaker.id !== 'yassin' ? speaker : who
    const label = line.who === 'player' ? this.playerName : line.who === 'narrator' ? 'الراوي' : speaker?.nickname ?? speaker?.name ?? ''
    const tenseNode = /(?:confront|snap|lie|caught|pressed|dismiss)/i.test(nodeId)
    const tenseArt = this.tense || tenseNode
    this.art(this.npcArt, portraitUrl(npc.id, tenseArt ? 'tense' : 'neutral'), initial(npc.name), npc.figure.accent)
    this.art(this.playerArt, playerPortrait(this.ctx.avatar, tenseArt ? 'tense' : 'neutral'), initial(this.playerName || 'ي'), '#c9aa78')
    this.el.dataset.who = line.who === 'player' ? 'player' : line.who === 'narrator' ? 'narrator' : 'npc'
    this.el.classList.toggle('tense', tenseArt)
    this.nameEl.textContent = label
    this.roleEl.textContent = line.who === 'player' ? 'المحقّق' : line.who === 'narrator' ? '' : (speaker ?? npc).role
    this.full = this.fill(line.text)
    this.typing = 0
    this.textEl.textContent = ''
    setChildren(this.choicesEl)
    this.moreEl.hidden = true
    this.audio.play('paper')
    this.audio.playVoice(voicePath(this.ctx.caseId ?? 'case01', nodeId, this.lineIndex) ?? null)
  }

  /** Advance the typewriter by real time; called every frame while open. */
  frame(dt: number): void {
    if (!this.open || this.typing >= this.full.length) return
    const speed = document.body.classList.contains('reduced-motion') ? 400 : 48
    this.typing = Math.min(this.full.length, this.typing + dt * speed)
    this.textEl.textContent = this.full.slice(0, Math.floor(this.typing))
    const now = performance.now()
    if (now - this.lastTick > 70) {
      this.lastTick = now
      this.audio.play('typewriter')
    }
    if (this.typing >= this.full.length) this.finishLine()
  }

  private finishLine(): void {
    this.typing = this.full.length
    this.textEl.textContent = this.full
    const lastLine = this.lineIndex >= this.lines.length - 1
    const v = this.session?.view()
    if (lastLine && v && v.choices.length > 0) {
      setChildren(this.choicesEl, v.choices.map((c, i) => this.choiceButton(c, i)))
      this.moreEl.hidden = true
      this.choicesEl.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    } else {
      this.moreEl.hidden = false
      this.moreEl.textContent = lastLine && v?.finished ? 'إنهاء الحوار' : 'كمّل'
    }
  }

  private choiceButton(c: View['choices'][number], i: number): HTMLButtonElement {
    const ev = c.present ? this.ctx.evidence?.(c.present) : undefined
    const cls = `dlg-choice${c.present ? ' present' : ''}${c.confront ? ' confront' : ''}${c.lie ? ' lie' : ''}`
    return h('button', { class: cls, onclick: () => this.choose(c.index, c) },
      h('kbd', null, String(i + 1)),
      h('span', { class: 'dlg-choice-text' },
        c.confront && h('small', null, c.lie ? 'كدبة' : 'مواجهة'),
        this.fill(c.text)),
      ev && h('span', { class: `dlg-ev kind-${ev.kind}` }, h('small', null, `اعرض ${KIND_NAME[ev.kind]}`), h('b', null, ev.title)))
  }

  next(): void {
    if (!this.open) return
    this.audio.stopVoice()
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

  choose(index: number, meta?: { confront?: boolean; lie?: boolean; present?: EvidenceId }): void {
    this.audio.stopVoice()
    if (meta?.confront || meta?.present) {
      this.tense = true
      this.audio.play(meta.lie ? 'lie' : 'confront')
      this.ctx.onConfront?.(Boolean(meta.lie))
      this.el.classList.remove('shake')
      this.el.classList.remove('flash')
      void this.el.offsetWidth
      this.el.classList.add('shake')
      this.el.classList.add('flash')
    } else this.audio.play('ui')
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
    if (/^(Digit|Numpad)[1-9]$/.test(e.code)) {
      const btn = this.choicesEl.querySelectorAll<HTMLButtonElement>('button')[Number(e.code.slice(-1)) - 1]
      btn?.click()
      return true
    }
    if (['Space', 'Enter', 'KeyE', 'NumpadEnter'].includes(e.code)) {
      if (document.activeElement instanceof HTMLButtonElement && this.choicesEl.contains(document.activeElement)) return false
      this.next()
      return true
    }
    return false
  }

  close(): void {
    if (this.el.hidden) return
    this.audio.stopVoice()
    this.el.hidden = true
    this.session?.end()
    this.flush?.()
    this.audio.play('back')
    const cb = this.onClose
    this.onClose = undefined
    cb?.()
  }
}
