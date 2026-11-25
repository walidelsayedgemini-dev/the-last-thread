/** Letters: arrival envelope, paper reader and the mailbox list (all progress lives in case flags). */
import { arabicDigits } from '../core/clock'
import { LETTERS, LETTER_KIND, type Letter } from '../data/letters'
import type { PlaceId } from '../data/types'
import type { Audio } from '../engine/audio'
import type { Session } from '../game/session'
import { h, setChildren } from './dom'
import { onSwipe, speakButton, speech } from './extras'

const got = (l: Letter) => `lt_got_${l.id}`
const read = (l: Letter) => `lt_read_${l.id}`

export class LetterView {
  readonly el: HTMLElement
  private readonly reader: HTMLElement
  private readonly notice: HTMLElement
  private timer = 0
  onChange: () => void = () => undefined
  constructor(private readonly audio: Audio) {
    this.reader = h('div', { class: 'letter-reader', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'جواب' })
    this.notice = h('aside', { class: 'letter-notice', hidden: true, role: 'status', 'aria-live': 'polite' })
    this.el = h('div', { class: 'letter-layer' }, this.notice, this.reader)
    onSwipe(this.reader, { down: () => this.close() })
  }
  get open(): boolean {
    return !this.reader.hidden
  }
  /** Letters that have reached the player (stored as flags), oldest first. */
  delivered(s: Session): Letter[] {
    return LETTERS.filter(l => s.state.flags.has(got(l)))
  }
  unreadCount(s: Session): number {
    return this.delivered(s).filter(l => !s.state.flags.has(read(l))).length
  }
  /** Hand over every letter whose condition is met (and whose place, if any, matches). */
  collect(s: Session, place: PlaceId): Letter[] {
    const fresh = LETTERS.filter(l => !s.state.flags.has(got(l)) && (!l.at || l.at === place) && s.engine.matches(l.when))
    if (!fresh.length) return []
    s.engine.apply(fresh.map(l => ({ type: 'flag', id: got(l) }) as const))
    s.save()
    return fresh
  }
  /** Envelope slides in; the player opens it now or later from the mailbox. */
  announce(s: Session, letter: Letter, more = 0): void {
    window.clearTimeout(this.timer)
    this.audio.play('paper')
    setChildren(this.notice,
      h('span', { class: 'ln-env', 'aria-hidden': true }, '✉'),
      h('div', { class: 'ln-text' },
        h('small', null, more > 0 ? `وصلك ${arabicDigits(more + 1)} جوابات` : 'وصلك جواب جديد'),
        h('b', null, `من ${letter.from}`)),
      h('button', { class: 'ln-open', onclick: () => { this.notice.hidden = true; this.openLetter(s, letter) } }, 'افتح الجواب'),
      h('button', { class: 'ln-later', 'aria-label': 'بعدين', onclick: () => { this.notice.hidden = true } }, '×'))
    this.notice.hidden = false
    this.notice.classList.remove('in')
    void this.notice.offsetWidth
    this.notice.classList.add('in')
    this.timer = window.setTimeout(() => { this.notice.hidden = true }, 9000)
  }
  openLetter(s: Session, letter: Letter): void {
    if (!s.state.flags.has(read(letter))) {
      s.engine.apply([{ type: 'flag', id: read(letter) }])
      s.save()
    }
    this.audio.play('paper')
    const kind = LETTER_KIND[letter.kind]
    setChildren(this.reader,
      h('div', { class: 'letter-backdrop', onclick: () => this.close() }),
      h('article', { class: `letter-paper kind-${letter.kind}` },
        h('button', { class: 'letter-close', 'aria-label': 'قفل الجواب', onclick: () => this.close() }, '×'),
        h('div', { class: 'letter-head' },
          h('span', { class: 'letter-stamp' }, h('b', null, kind.icon), kind.label),
          h('small', null, letter.date)),
        h('h3', null, letter.title),
        h('p', { class: 'letter-from' }, `من: ${letter.from}`, h('em', null, ` — ${letter.role}`)),
        h('div', { class: 'letter-body' }, letter.body.map(p => h('p', null, p))),
        letter.ps && h('p', { class: 'letter-ps' }, h('b', null, 'ملحوظة: '), letter.ps),
        letter.real && h('p', { class: 'letter-real' }, h('span', null, 'واقعي'), letter.real),
        speakButton(() => [letter.title, ...letter.body, letter.ps ?? ''].join('. '), 'speak-btn letter-speak'),
        h('button', { class: 'btn primary letter-ok', onclick: () => this.close() }, 'حفظت الجواب')))
    this.reader.hidden = false
    this.onChange()
  }
  close(): void {
    if (this.reader.hidden) return
    speech.stop()
    this.reader.hidden = true
    this.onChange()
  }
  hideNotice(): void {
    window.clearTimeout(this.timer)
    this.notice.hidden = true
  }
  hide(): void {
    window.clearTimeout(this.timer)
    this.notice.hidden = true
    this.reader.hidden = true
  }
  key(e: KeyboardEvent): boolean {
    if (!this.open) return false
    if (e.code === 'Escape' || e.code === 'Enter') { this.close(); return true }
    return false
  }
  /** Mailbox page used by the case file. */
  list(s: Session): HTMLElement {
    const mine = this.delivered(s)
    const unread = this.unreadCount(s)
    const waiting = LETTERS.length - mine.length
    return h('div', { class: 'mailbox' },
      h('p', { class: 'mail-intro' }, mine.length
        ? `عندك ${arabicDigits(mine.length)} جواب${unread ? `، منهم ${arabicDigits(unread)} لسه ما اتقراش` : ''}. بعض الجوابات بتوصلك لما تروح مكان معين.`
        : 'لسه ما وصلكش أي جواب. الناس بتبعت لك ورق لما تقرّب منهم.'),
      h('div', { class: 'mail-grid' },
        mine.slice().reverse().map(l => {
          const isNew = !s.state.flags.has(read(l))
          const kind = LETTER_KIND[l.kind]
          return h('button', { class: `mail-card kind-${l.kind}${isNew ? ' new' : ''}`, onclick: () => this.openLetter(s, l) },
            h('span', { class: 'mail-env', 'aria-hidden': true }, isNew ? '✉' : '▭'),
            h('span', { class: 'mail-copy' },
              h('small', null, `${kind.label} • ${l.date}`),
              h('b', null, l.title),
              h('em', null, `من ${l.from}`)),
            isNew && h('i', { class: 'mail-new' }, 'جديد'))
        }),
        waiting > 0 && h('div', { class: 'mail-card locked' },
          h('span', { class: 'mail-env', 'aria-hidden': true }, '…'),
          h('span', { class: 'mail-copy' }, h('b', null, `${arabicDigits(waiting)} جواب في الطريق`), h('em', null, 'اتحرك واتكلم مع الناس.')))))
  }
}
