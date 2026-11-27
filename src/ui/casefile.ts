/**
 * Case-file overlay (the "investigation folder"): evidence, people, objectives, the red-thread
 * board, real-world calendar and the final accusation. Built with the safe DOM helper.
 */
import { formatClock, formatDate, formatDateTime, arabicDigits } from '../core/clock'
import { PLACES } from '../data/places'
import type { Deduction, DeductionId, Evidence, EvidenceId, EventKind } from '../data/types'
import type { Audio } from '../engine/audio'
import type { Session } from '../game/session'
import type { EventsDb } from '../services/eventsDb'
import { evidenceUrl, portraitUrl } from './art'
import { clueDetail } from './clueDetails'
import { h, setChildren, svg } from './dom'
import { CHAPTERS, JOURNAL, SUSPECT_NOTES, TIMELINE } from '../data/story'
import { LIFE_CHOICES, MAHMOUD_LIFE, PATHS, REAL_ALEX, YASSIN_LIFE, dominantPath, pathScores, type PathId } from '../data/life'
import type { LetterView } from './letterView'
import { onSwipe, type LensView } from './extras'
import type { StoryDirector } from './storyView'
import { CHARACTER_ART, EVIDENCE_ART } from './visualAssets'

type Tab = 'letters' | 'evidence' | 'people' | 'objectives' | 'board' | 'journal' | 'organizer' | 'life' | 'map' | 'calendar'
type LifeView = 'paths' | 'yassin' | 'mahmoud' | 'alex'
type OrgView = 'suspects' | 'timeline' | 'badges'
const TABS: [Tab, string][] = [
  ['board', 'اللوحة'], ['evidence', 'الأدلة'], ['letters', 'الجوابات'], ['journal', 'اليوميات'], ['organizer', 'المنظّم'], ['life', 'حياتك'], ['people', 'الأشخاص'], ['objectives', 'المهام'], ['map', 'الخريطة'], ['calendar', 'التقويم'],
]
const SIMPLE_HIDDEN: Tab[] = ['organizer', 'map', 'calendar']
type EvidenceFilter = 'all' | 'new' | Evidence['kind']
const KIND_LABEL: Record<Evidence['kind'], string> = { object: 'جسم', testimony: 'شهادة', document: 'مستند', photo: 'صورة', trace: 'أثر' }
const KIND_ICON: Record<Evidence['kind'], string> = { object: '▣', testimony: '“ ”', document: '▤', photo: '◉', trace: '⌁' }
const EVENT_LABEL: Record<EventKind, string> = { match_ittihad: 'مباراة الاتحاد', match_ahly: 'مباراة الأهلي', market_day: 'سوق', friday_prayer: 'صلاة الجمعة' }
const ART_NOTE = 'رسوم توضيحية أصلية مكمّلة لسجلّ الدليل النصّي.'
const CARD_W = 150
const CARD_H = 164
type EvidencePair = { a: EvidenceId; b: EvidenceId; deduction?: Deduction }

export type CaseFileDeps = {
  audio: Audio
  events: EventsDb
  story: StoryDirector
  letters: LetterView
  lens: LensView
  /** Simple mode hides the advanced tabs. */
  simple: () => boolean
  /** Where the player stands (for the map). */
  where: () => { zone: 'abis' | 'city'; x: number; z: number }
  onClose: () => void
  onAccused: (result: 'ok' | 'wrong-culprit' | 'wrong-motive' | 'locked') => void
}

export class CaseFileView {
  readonly el: HTMLElement
  private readonly pageEl: HTMLElement
  private readonly tabsEl: HTMLElement
  private session?: Session
  private shownCase?: string
  private tab: Tab = 'board'
  private selected?: EvidenceId
  private readonly pos = new Map<EvidenceId, { x: number; y: number }>()
  private flash?: { a: EvidenceId; b: EvidenceId }
  private note = ''
  private orgView: OrgView = 'suspects'
  private lifeView: LifeView = 'paths'
  private noteKind: '' | 'success' | 'fail' | 'info' | 'ok' | 'bad' = ''
  private fresh?: { a: EvidenceId; b: EvidenceId; id?: DeductionId }
  private lastPair?: EvidencePair
  private comparisonOpen = false
  private freshTimer = 0
  private focusDeduction?: DeductionId
  private readonly tried = new Set<string>()
  private accSuspect?: string
  private accMotive?: string
  private accConfirm = false
  private accusationReview?: 'wrong-culprit' | 'wrong-motive'
  private evidenceFilter: EvidenceFilter = 'all'
  private evidenceLayout: 'list' | 'gallery' = 'list'
  private expandedEvidence?: EvidenceId
  private readonly reviewedEvidence = new Set<EvidenceId>()

  constructor(private readonly d: CaseFileDeps) {
    this.tabsEl = h('nav', { class: 'cf-tabs', role: 'tablist' })
    this.pageEl = h('div', { class: 'cf-page' })
    this.el = h('section', { class: 'casefile', hidden: true, role: 'dialog', 'aria-label': 'ملف القضية' },
      h('div', { class: 'cf-folder' },
        h('header', { class: 'cf-head' },
          h('div', { class: 'cf-stamp' }, 'سرّي'),
          h('div', { class: 'cf-title' }, h('small', { id: 'cf-chapter' }, 'ملف القضية'), h('b', { id: 'cf-case-title' }, '')),
          h('button', { class: 'cf-close', 'aria-label': 'إغلاق', onclick: () => this.close() }, '✕')),
        this.tabsEl, this.pageEl),
    )
    onSwipe(this.pageEl, { left: () => this.swipeTab(1), right: () => this.swipeTab(-1), ignore: t => t instanceof Element && !!t.closest('.board, .board-wall, input, textarea, select') })
  }

  get open(): boolean {
    return !this.el.hidden
  }

  show(session: Session, tab: Tab = this.tab): void {
    if (this.session !== session || this.shownCase !== session.caseId) {
      this.reviewedEvidence.clear()
      this.evidenceFilter = 'all'
      this.expandedEvidence = undefined
      this.tried.clear()
      this.selected = undefined
      this.fresh = undefined
      this.lastPair = undefined
      this.comparisonOpen = false
      this.focusDeduction = undefined
      this.accSuspect = undefined
      this.accMotive = undefined
      this.accConfirm = false
      this.accusationReview = undefined
      this.note = ''
      this.pos.clear()
    }
    this.session = session
    this.shownCase = session.caseId
    this.el.hidden = false
    this.el.querySelector('#cf-case-title')!.textContent = `القضية ${session.engine.file.number}: ${session.engine.file.title}`
    this.setTab(tab)
    this.d.audio.play('paper')
  }

  close(): void {
    if (this.el.hidden) return
    this.el.hidden = true
    this.d.audio.play('back')
    this.d.onClose()
  }

  refresh(): void {
    if (this.open) this.render()
  }

  key(e: KeyboardEvent): boolean {
    if (!this.open) return false
    if (e.code === 'Escape' && this.tab === 'board' && this.selected) {
      this.selected = undefined
      this.setNote('اتلغى تحديد الدليل.', 'info')
      this.render()
      return true
    }
    if (e.code === 'Escape' || e.code === 'Tab' || e.code === 'KeyJ') {
      this.close()
      return true
    }
    return false
  }

  /** Swipe left/right on touch screens to move between tabs (the board keeps its own drag). */
  private swipeTab(dir: 1 | -1): void {
    const s = this.session
    if (!s || this.tab === 'board') return
    const tabs = (this.d.simple() ? TABS.filter(([id]) => !SIMPLE_HIDDEN.includes(id)) : TABS).map(([id]) => id)
    const next = tabs[tabs.indexOf(this.tab) + dir]
    if (next) { this.d.audio.play('paper'); this.setTab(next) }
  }
  private setTab(tab: Tab): void {
    this.tab = tab
    this.render()
  }

  private render(): void {
    const s = this.session
    if (!s) return
    const chapterAt = this.d.story.chapterIndex(s)
    const chapterEl = this.el.querySelector('#cf-chapter')
    if (chapterEl) chapterEl.textContent = `الفصل ${arabicDigits(chapterAt + 1)} · ${CHAPTERS[chapterAt].title}`
    const unread = this.tab === 'journal' ? 0 : this.d.story.unreadCount(s)
    const mail = this.d.letters.unreadCount(s)
    const tabs = this.d.simple()
      ? TABS.filter(([id]) => !SIMPLE_HIDDEN.includes(id) || (id === 'calendar' && s.mode === 'realistic'))
      : TABS
    if (!tabs.some(([id]) => id === this.tab)) this.tab = 'board'
    setChildren(this.tabsEl, tabs.map(([id, label]) =>
      h('button', { class: `cf-tab${id === this.tab ? ' on' : ''}`, role: 'tab', 'aria-selected': String(id === this.tab), onclick: () => { this.d.audio.play('ui'); this.setTab(id) } },
        label, id === 'journal' && unread > 0 && h('span', { class: 'cf-tab-badge', 'aria-label': `${arabicDigits(unread)} صفحة جديدة` }, arabicDigits(unread)),
        id === 'letters' && mail > 0 && h('span', { class: 'cf-tab-badge mail', 'aria-label': `${arabicDigits(mail)} جواب جديد` }, arabicDigits(mail)))))
    const page = { letters: () => this.d.letters.list(s), evidence: () => this.evidence(s), people: () => this.people(s), objectives: () => this.objectives(s), board: () => this.board(s), journal: () => this.journal(s), organizer: () => this.organizer(s), life: () => this.life(s), map: () => this.map(s), calendar: () => this.calendar(s) }[this.tab]()
    this.pageEl.classList.remove('entering')
    void this.pageEl.offsetWidth
    setChildren(this.pageEl, page)
    this.pageEl.classList.add('entering')
  }

  // ---- Evidence -----------------------------------------------------------------------------------------------------

  private evidence(s: Session): HTMLElement {
    const all = s.engine.file.evidence
    const found = Array.from(s.state.evidence.keys()).reverse().map(id => s.engine.evidenceInfo(id))
    const fresh = found.filter(e => !this.reviewedEvidence.has(e.id))
    const categories: Evidence['kind'][] = ['object', 'testimony', 'document', 'photo', 'trace']
    const filters: { id: EvidenceFilter; label: string; count: number }[] = [
      { id: 'all', label: 'الكل', count: found.length },
      { id: 'new', label: 'جديد', count: fresh.length },
      ...categories.map(kind => ({ id: kind, label: KIND_LABEL[kind], count: found.filter(e => e.kind === kind).length })),
    ]
    const visible = found.filter(e => this.evidenceFilter === 'all'
      || (this.evidenceFilter === 'new' ? !this.reviewedEvidence.has(e.id) || this.expandedEvidence === e.id : e.kind === this.evidenceFilter))
    return h('div', { class: 'cf-evidence-page' },
      h('div', { class: 'cf-evidence-toolbar' },
        h('div', { class: 'cf-evidence-summary' },
          h('b', null, `${arabicDigits(found.length)} من ${arabicDigits(all.length)} دليل`),
          h('small', null, `${arabicDigits(this.reviewedEvidence.size)} تمت مراجعته`)),
        found.length > 0 && h('div', { class: 'cf-evidence-layout', role: 'group', 'aria-label': 'طريقة عرض الأدلة' },
          (['list', 'gallery'] as const).map(layout => h('button', {
            type: 'button', 'aria-pressed': String(this.evidenceLayout === layout),
            onclick: (event: Event) => {
              if (layout === this.evidenceLayout) return
              const hadFocus = document.activeElement === event.currentTarget
              this.evidenceLayout = layout
              this.render()
              if (hadFocus) this.pageEl.querySelector<HTMLButtonElement>('.cf-evidence-layout [aria-pressed="true"]')?.focus()
            },
          }, layout === 'list' ? 'قائمة' : 'معرض الصور'))),
        h('nav', { class: 'cf-evidence-filters', 'aria-label': 'تصفية الأدلة' }, filters.map(filter =>
          h('button', {
            class: `cf-evidence-filter${this.evidenceFilter === filter.id ? ' on' : ''}`,
            'aria-pressed': String(this.evidenceFilter === filter.id),
            disabled: filter.id !== 'all' && filter.id !== this.evidenceFilter && filter.count === 0,
            onclick: () => {
              if (this.evidenceFilter === filter.id) return
              this.evidenceFilter = filter.id
              this.expandedEvidence = undefined
              this.d.audio.play('ui')
              this.render()
              this.pageEl.querySelector<HTMLElement>('.cf-evidence-filter.on')?.focus({ preventScroll: true })
            },
          }, h('span', null, filter.label), h('b', null, arabicDigits(filter.count))))),
      ),
      found.length
        ? visible.length ? h('div', { class: `cf-evidence-list${this.evidenceLayout === 'gallery' ? ' gallery' : ''}` }, visible.map(e => this.evidenceCard(s, e)))
          : h('p', { class: 'cf-empty' }, 'مفيش أدلة في التصنيف ده لسه.')
        : h('p', { class: 'cf-empty' }, 'لسه ما جمعتش أي دليل. افحص المكان وكلّم الناس.'))
  }

  private evidenceCard(s: Session, e: Evidence): HTMLElement {
    const at = s.state.evidence.get(e.id)
    const reviewed = this.reviewedEvidence.has(e.id)
    const expanded = this.expandedEvidence === e.id
    const artSrc = EVIDENCE_ART[e.id]?.src ?? evidenceUrl(e.id)
    const artAlt = EVIDENCE_ART[e.id]?.alt ?? e.title
    const art = artSrc ? { src: artSrc, alt: artAlt } : undefined
    return h('article', { class: `ev kind-${e.kind}${reviewed ? ' reviewed' : ' unreviewed'}${expanded ? ' expanded' : ''}` },
      h('button', {
        class: 'ev-trigger',
        'aria-expanded': String(expanded),
        'aria-controls': `ev-record-${e.id}`,
        onclick: () => {
          this.reviewedEvidence.add(e.id)
          this.expandedEvidence = expanded ? undefined : e.id
          this.d.audio.play('ui')
            this.render()
            this.pageEl.querySelector<HTMLElement>(`[aria-controls="ev-record-${e.id}"]`)?.focus({ preventScroll: true })
        },
      },
        art
          ? h('span', { class: 'ev-thumb', 'aria-hidden': true }, h('img', { src: art.src, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }))
          : h('span', { class: 'ev-kind-icon', 'aria-hidden': true }, KIND_ICON[e.kind]),
        h('span', { class: 'ev-trigger-copy' },
          h('span', { class: 'ev-meta-row' },
            h('span', { class: 'ev-tag' }, KIND_LABEL[e.kind]),
            h('span', { class: `ev-status${reviewed ? ' done' : ''}` }, reviewed ? 'مُراجع' : 'جديد')),
          h('b', null, e.title),
          h('small', null, `${PLACES[e.place].name} · ${e.source}`)),
        h('span', { class: 'ev-chevron', 'aria-hidden': true }, expanded ? '−' : '＋')),
      h('div', { id: `ev-record-${e.id}`, class: 'ev-record', hidden: !expanded },
        expanded && clueDetail(e.id),
        art && h('figure', { class: 'ev-artwork' },
          h('img', { src: art.src, alt: art.alt, loading: 'lazy', decoding: 'async' }),
          h('figcaption', null, ART_NOTE),
          h('button', { class: 'ev-lens-btn', onclick: () => this.d.lens.show(art, e.title, e.summary, e.detail) }, h('span', { 'aria-hidden': true }, '🔍 '), 'افحص بالعدسة')),
        h('p', { class: 'ev-sum' }, e.summary),
        h('p', { class: 'ev-detail' }, e.detail),
        e.question && h('p', { class: 'ev-question' }, h('strong', null, 'سؤال الدليل '), s.fill(e.question.text)),
        h('footer', null, at !== undefined ? `وقت العثور: ${formatDateTime(at)}` : '')))
  }

  // ---- People -------------------------------------------------------------------------------------------------------

  private people(s: Session): HTMLElement {
    const cards = s.knownCharacters().map(c => {
      const unlockedPast = c.past.filter(p => !p.unlock || s.state.flags.has(p.unlock))
      const secret = c.secret && s.state.flags.has(c.secret.unlock) ? c.secret.text : undefined
      const hidden = c.id === 'mahmoud' && !s.state.flags.has('found_mahmoud')
      return h('article', { class: 'person' },
        h('div', { class: 'person-fig', style: { '--body': c.figure.body, '--accent': c.figure.accent } },
          portraitUrl(c.id) && !hidden ? h('img', { class: 'character-portrait-image', src: portraitUrl(c.id), alt: '', loading: 'lazy' }) : h('span', null, hidden ? '؟' : c.name.replace(/^(ال|عم |المعلم |الحاجة )/, '').slice(0, 1))),
        h('div', { class: 'person-body' },
          h('h3', null, c.name, h('small', null, ` • ${arabicDigits(c.age)} سنة`)),
          h('p', { class: 'role' }, hidden ? 'مفقود' : c.role),
          h('p', null, hidden ? 'لسه ما قدرتش تتأكد من مكانه… الخيط الأحمر هو أثره الوحيد.' : c.appearance),
          !hidden && h('p', { class: 'rel' }, h('b', null, 'علاقته بالقضية: '), c.relationToCase),
          !hidden && h('ul', { class: 'past' }, unlockedPast.map(p => h('li', null, p.text))),
          unlockedPast.length < c.past.length && !hidden && h('p', { class: 'locked' }, '▮▮▮ جزء من ماضيه لسه مقفول… اكسب ثقته.'),
          secret && h('p', { class: 'secret' }, h('b', null, 'سرّ: '), secret),
          h('blockquote', null, c.quote)))
    })
    return h('div', { class: 'cf-list people' }, cards)
  }

  // ---- Objectives ---------------------------------------------------------------------------------------------------------

  private objectives(s: Session): HTMLElement {
    const items = s.engine.objectives()
    const questions = s.openQuestions().reverse()
    const renderQuestions = (items: typeof questions) => h('ul', null, items.map(question =>
      h('li', null, h('small', null, question.title), h('b', null, s.fill(question.text)))))
    const quests = this.d.story.quests(s)
    const doneCount = quests.filter(q => q.done).length
    return h('div', { class: 'cf-list' },
      questions.length > 0 && h('section', { class: 'case-questions', 'aria-label': 'أسئلة مفتوحة' },
        h('h3', null, 'أسئلة مفتوحة'),
        renderQuestions(questions.slice(0, 3)),
        questions.length > 3 && h('details', null, h('summary', null, 'باقي الأسئلة المفتوحة'), renderQuestions(questions.slice(3)))),
      items.map(({ objective, done }) =>
        h('article', { class: `obj${done ? ' done' : ''}` },
          h('span', { class: 'obj-box' }, done ? '✔' : '◻'),
          h('div', null, h('h3', null, objective.title), h('p', null, objective.detail),
            objective.place && h('small', null, `📍 ${PLACES[objective.place].name}`)))),
      h('div', { class: 'quest-head' },
        h('h3', null, 'حكايات جانبية'),
        h('small', null, quests.length ? `${arabicDigits(doneCount)} من ${arabicDigits(quests.length)} مكتملة` : 'لسه ما ظهرتش')),
      quests.length === 0 && h('p', { class: 'cf-empty' }, 'كلّم الناس واسمعهم. كل شخص عنده حكاية، وبعضها بيفتح باب مش متوقع.'),
      quests.map(({ quest, steps, done }) =>
        h('article', { class: `quest${done ? ' done' : ''}` },
          h('header', null, h('b', null, quest.title), h('span', { class: 'quest-giver' }, quest.giver)),
          h('p', { class: 'quest-summary' }, quest.summary),
          h('ul', { class: 'quest-steps' }, steps.map(step =>
            h('li', { class: step.done ? 'done' : '' }, h('span', { 'aria-hidden': true }, step.done ? '✔' : '◻'), step.text))),
          done
            ? h('blockquote', { class: 'quest-reward' }, h('small', null, 'الحكاية كاملة'), quest.reward)
            : h('p', { class: 'quest-locked' }, '▮▮▮ حكاية مخفية بتتفتح لما تخلّص الخطوات.'))))
  }

  // ---- Board ---------------------------------------------------------------------------------------------------------------------

  private pairKey(a: EvidenceId, b: EvidenceId): string {
    return [a, b].sort().join('|')
  }

  /** Evidence ids the player has actually found that take part in a tied deduction. */
  private threadsOf(s: Session, dd: Deduction): [EvidenceId, EvidenceId][] {
    return dd.pairs.filter(([a, b]) => s.engine.has(a) && s.engine.has(b))
  }

  private board(s: Session): HTMLElement {
    const file = s.engine.file
    const found = file.evidence.filter(e => s.engine.has(e.id))
    const selId = this.selected && found.some(e => e.id === this.selected) ? this.selected : undefined
    const selectedEvidence = selId ? found.find(e => e.id === selId) : undefined
    const columns = Math.min(window.innerWidth < 560 ? 2 : 5, Math.max(1, found.length))
    found.forEach((e, i) => {
      if (!this.pos.has(e.id)) this.pos.set(e.id, { x: 24 + (i % columns) * (CARD_W + 28), y: 24 + Math.floor(i / columns) * (CARD_H + 56) })
    })
    const W = found.length === 1 ? 390 : columns * (CARD_W + 28) + 40
    const H = Math.max(320, Math.ceil(found.length / columns) * (CARD_H + 56) + 40)
    const tied = file.deductions.filter(dd => s.state.deductions.has(dd.id))
    const focus = tied.find(dd => dd.id === this.focusDeduction)
    const focusIds = new Set<EvidenceId>(focus ? this.threadsOf(s, focus).flat() : [])
    const threadCount = new Map<EvidenceId, number>()
    for (const dd of tied) for (const id of new Set(this.threadsOf(s, dd).flat())) threadCount.set(id, (threadCount.get(id) ?? 0) + 1)

    const lines = svg('svg', { class: 'board-lines', width: W, height: H, viewBox: `0 0 ${W} ${H}` })
    const labelLayer = svg('svg', { class: 'board-lines board-labels', width: W, height: H, viewBox: `0 0 ${W} ${H}` })
    const labels = svg('g', { class: 'thread-labels' })
    const drawLine = (a: EvidenceId, b: EvidenceId, cls: string, label?: string) => {
      const pa = this.pos.get(a)
      const pb = this.pos.get(b)
      if (!pa || !pb) return
      const x1 = pa.x + CARD_W / 2
      const y1 = pa.y + 10
      const x2 = pb.x + CARD_W / 2
      const y2 = pb.y + 10
      const sag = Math.min(60, Math.hypot(x2 - x1, y2 - y1) * 0.18)
      const d = `M${x1} ${y1} Q${(x1 + x2) / 2} ${(y1 + y2) / 2 + sag} ${x2} ${y2}`
      lines.append(svg('path', { d, class: `thread-shadow ${cls}` }))
      lines.append(svg('path', { d, class: cls, pathLength: 1 }))
      if (cls.startsWith('thread ') || cls === 'thread') {
        lines.append(svg('circle', { cx: x1, cy: y1, r: 4.5, class: 'thread-knot' }), svg('circle', { cx: x2, cy: y2, r: 4.5, class: 'thread-knot' }))
      }
      if (label) {
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2 + sag / 2
        const w = Math.max(54, label.length * 6.4 + 18)
        const g = svg('g', { class: `thread-label${cls.includes('dim') ? ' dim' : ''}` })
        g.append(svg('rect', { x: mx - w / 2, y: my - 11, width: w, height: 22, rx: 3 }))
        const t = svg('text', { x: mx, y: my + 4, 'text-anchor': 'middle' })
        t.textContent = label
        g.append(t)
        labels.append(g)
      }
    }
    for (const dd of tied) {
      const isFocus = !focus || focus.id === dd.id
      for (const [a, b] of this.threadsOf(s, dd)) {
        const fresh = this.fresh && this.pairKey(this.fresh.a, this.fresh.b) === this.pairKey(a, b)
        drawLine(a, b, `thread${fresh ? ' fresh' : ''}${isFocus ? '' : ' dim'}`, fresh || (focus && isFocus) ? dd.title : undefined)
      }
    }
    if (this.flash) drawLine(this.flash.a, this.flash.b, 'thread-fail')
    labelLayer.append(labels)

    const cards = found.map(e => {
      const p = this.pos.get(e.id)!
      const art = EVIDENCE_ART[e.id]?.src ?? evidenceUrl(e.id)
      const count = threadCount.get(e.id) ?? 0
      const freshPulse = this.fresh && (this.fresh.a === e.id || this.fresh.b === e.id)
      const state = `${this.selected === e.id ? ' selected' : ''}${focus ? (focusIds.has(e.id) ? ' in-focus' : ' dim') : ''}${freshPulse ? ' linked-pulse' : ''}`
      const card = h('div', { class: `pin-card kind-${e.kind}${state}`, style: { left: `${p.x}px`, top: `${p.y}px`, width: `${CARD_W}px`, height: `${CARD_H}px` }, tabindex: 0, role: 'button', 'aria-pressed': String(this.selected === e.id), 'aria-label': `${e.title}${count ? `، مربوط بـ ${arabicDigits(count)} خيط` : ''}` },
        h('i', { class: `pin kind-${e.kind}` }),
        count > 0 && h('span', { class: 'pin-count', 'aria-hidden': true, title: 'خيوط مربوطة' }, arabicDigits(count)),
        art ? h('img', { class: 'pin-card-art', src: art, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' })
          : h('span', { class: 'pin-card-art pin-card-placeholder', 'aria-hidden': true }, '▣'),
        h('small', null, KIND_LABEL[e.kind]), h('b', null, e.title),
        h('span', { class: 'pin-card-summary' }, e.summary))
      this.dragCard(card, e.id, lines, W, H)
      return card
    })

    const sel = selId ? s.engine.evidenceInfo(selId) : undefined
    const selectedArt = sel && (EVIDENCE_ART[sel.id]?.src ?? evidenceUrl(sel.id))
    const wrap = found.length
      ? h('div', { class: `board-wrap${found.length === 1 ? ' board-wrap-single' : ''}` },
        h('div', { class: 'board', style: { width: `${W}px`, height: `${H}px` } }, lines, cards, labelLayer),
      )
      : h('div', { class: 'board-wrap board-wrap-empty' },
        h('div', { class: 'board-empty' },
          h('span', { class: 'board-empty-mark', 'aria-hidden': true }, '⌕'),
          h('b', null, 'اللوحة لسه فاضية'),
          h('p', null, 'كل خيط بيبدأ بدليل. افحص المشهد أو اسأل الموجودين.'),
          h('button', { class: 'board-empty-action', onclick: () => this.close() }, 'ارجع للتحقيق', h('span', { 'aria-hidden': true }, '←'))))

    const need = file.finale.requires.deductions ?? []
    const needDone = need.filter(id => s.state.deductions.has(id)).length
    const progress = h('div', { class: 'board-progress', 'aria-label': 'تقدّم التحقيق' },
      this.stat('الأدلة', `${arabicDigits(found.length)} / ${arabicDigits(file.evidence.length)}`, found.length / file.evidence.length),
      this.stat('الخيوط', `${arabicDigits(tied.length)} / ${arabicDigits(file.deductions.length)}`, tied.length / file.deductions.length),
      need.length > 0 && this.stat('خيوط الاتهام', `${arabicDigits(needDone)} / ${arabicDigits(need.length)}`, needDone / need.length, true))

    const slot = (title: string, ev: Evidence | undefined, n: string) =>
      h('div', { class: `tray-slot${ev ? ' filled' : ''}` }, h('small', null, n), h('b', null, ev ? ev.title : title))
    const pair = this.lastPair
    const tray = found.length >= 2 ? h('div', { class: 'board-tray' },
      slot('اختار الدليل', selectedEvidence ?? (pair && s.engine.evidenceInfo(pair.a)), 'الدليل الأول'),
      h('span', { class: 'tray-link', 'aria-hidden': true }, selectedEvidence || pair ? '⟿' : '·  ·  ·'),
      slot('بعده الدليل التاني', pair && s.engine.evidenceInfo(pair.b), 'الدليل الثاني'),
      h('div', { class: 'tray-actions' },
        h('button', { class: 'tray-btn', disabled: !selectedEvidence, onclick: () => { this.selected = undefined; this.note = 'اتلغى تحديد الدليل.'; this.d.audio.play('back'); this.render() } }, 'إلغاء التحديد'),
        h('button', { class: 'tray-btn board-reorder', onclick: () => { this.pos.clear(); this.d.audio.play('paper'); this.render() } }, 'ترتيب الكروت'))) : undefined

    return h('div', { class: 'board-page' },
      h('div', { class: 'board-help' },
        h('p', { 'aria-live': 'polite' }, found.length === 0 ? 'سجل الخيوط هيتكوّن مع كل دليل جديد.'
          : found.length < 2 ? 'اتسجل أول دليل. اجمع دليلًا تانيًا عشان تبدأ الربط.'
            : selectedEvidence ? `اتحدد «${selectedEvidence.title}». اختار دليل تاني عشان تكمّل الربط.`
              : 'اختار دليل، وبعده دليل تاني عشان تربطهم بخيط أحمر.')),
      progress,
      this.note && h('p', { class: `board-note${this.noteKind ? ` ${this.noteKind}` : ''}`, role: 'status', 'aria-live': 'polite' }, this.note),
      tray,
      sel && h('details', { class: 'sel-detail' },
          h('summary', null, `تفاصيل ${sel.title}`),
          selectedArt && h('figure', { class: 'sel-artwork' },
            h('img', { src: selectedArt, alt: EVIDENCE_ART[sel.id]?.alt ?? sel.title, loading: 'lazy', decoding: 'async' }),
            h('figcaption', null, ART_NOTE)),
          h('p', null, sel.detail)),
      wrap,
      pair && this.comparePair(s, pair.a, pair.b, pair.deduction),
      h('div', { class: 'board-side' },
        h('h4', null, 'الاستنتاجات'),
        this.deductionList(s, tied),
        this.accuseBlock(s)))
  }

  private comparePair(s: Session, a: EvidenceId, b: EvidenceId, deduction?: Deduction): HTMLElement {
    const clues = [s.engine.evidenceInfo(a), s.engine.evidenceInfo(b)]
    const matchIndex = deduction?.pairs.findIndex(([x, y]) => this.pairKey(x, y) === this.pairKey(a, b)) ?? -1
    const reason = deduction?.pairReasons?.[matchIndex]
    const details = h('details', { class: 'board-compare', open: this.comparisonOpen },
      h('summary', null, 'قارن الدليلين'),
      this.clueComparison(s, clues))
    details.addEventListener('toggle', () => { if (details.isConnected) this.comparisonOpen = details.open })
    return h('section', { class: 'board-link-result' },
      h('small', null, clues.map(clue => clue.title).join(' + ')),
      deduction && h('div', { class: 'board-link-explanation', role: 'status' },
        h('b', null, deduction.title),
        reason && h('span', null, h('strong', null, 'وجه الربط '), reason),
        h('span', null, deduction.conclusion)),
      details)
  }

  private clueComparison(s: Session, clues: Evidence[]): HTMLElement {
    return h('div', { class: 'board-compare-grid clue-comparison' }, clues.map(clue => {
      const art = EVIDENCE_ART[clue.id]
      return h('article', null, h('b', null, clue.title), clueDetail(clue.id),
        art && h('button', { class: 'tray-btn', onclick: () => this.d.lens.show(art, clue.title, clue.summary, s.fill(clue.detail)) }, 'كبّر الصورة'),
        h('p', null, s.fill(clue.detail)))
    }))
  }

  private reviewAccusation(s: Session): HTMLElement | undefined {
    const result = this.accusationReview
    if (!result) return
    const file = s.engine.file
    const caseOnePairs: Partial<Record<string, [EvidenceId, EvidenceId]>> = {
      ragab: ['e_cafe_bill', 'e_hassan_testimony'],
      hassan: ['e_hassan_testimony', 'e_boundary_stone'],
      fathy: ['e_fathy_testimony', 'e_forged_contract'],
    }
    const preferred = s.caseId === 'case01' && result === 'wrong-culprit' ? caseOnePairs[this.accSuspect ?? ''] : undefined
    const activePair = preferred?.every(id => s.engine.has(id)) ? preferred
      : file.deductions.filter(d => file.finale.requires.deductions?.includes(d.id))
        .sort((a, b) => Number(b.id === 'd_forgery') - Number(a.id === 'd_forgery'))
        .flatMap(d => d.pairs).find(pair => pair.every(id => s.engine.has(id)))
    const reason = result === 'wrong-culprit' ? file.finale.wrongCulprit : file.finale.wrongMotive
    return h('section', { class: 'clue-review', tabindex: '-1', 'aria-label': 'راجع الاتهام' },
      h('h5', null, 'راجع الاتهام مع الأدلة'),
      h('p', { role: 'status' }, preferred && activePair === preferred
        ? 'قارن الدليلين. هل الشخص اللي اخترته اتشاف وهو بيغيّر الحدود، ولا هو اللي شاف أو سجّل حاجة؟'
        : reason),
      activePair && this.clueComparison(s, activePair.map(id => s.engine.evidenceInfo(id))))
  }

  private stat(label: string, value: string, ratio: number, accent = false): HTMLElement {
    return h('div', { class: `board-stat${accent ? ' accent' : ''}` },
      h('span', null, label), h('b', null, value),
      h('i', { class: 'board-stat-bar' }, h('i', { style: { width: `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%` } })))
  }

  private deductionList(s: Session, tied: Deduction[]): HTMLElement {
    const total = s.engine.file.deductions.length
    const cards = tied.map(dd => {
      const evs = [...new Set(this.threadsOf(s, dd).flat())].slice(0, 4)
      const on = this.focusDeduction === dd.id
      return h('article', { class: `deduction-card${on ? ' on' : ''}${this.fresh?.id === dd.id ? ' fresh' : ''}` },
        h('button', { class: 'deduction-head', 'aria-pressed': String(on), onclick: () => { this.focusDeduction = on ? undefined : dd.id; this.d.audio.play('ui'); this.render() } },
          h('span', { class: 'deduction-knot', 'aria-hidden': true }, '●'),
          h('b', null, dd.title),
          h('small', null, on ? 'إخفاء التمييز' : 'ميّز على اللوحة')),
        h('p', null, dd.conclusion),
        h('div', { class: 'deduction-chips' }, evs.map(id => h('span', { class: 'deduction-chip' }, s.engine.evidenceInfo(id).title))))
    })
    const locked = Math.max(0, total - tied.length)
    return h('div', { class: 'deductions-list' }, cards,
      locked > 0 && h('div', { class: 'deduction-locked' },
        h('span', { 'aria-hidden': true }, '؟'),
        h('p', null, tied.length ? `لسه ${arabicDigits(locked)} ${locked === 1 ? 'خيط' : 'خيوط'} مستنيين يتربطوا.` : 'لسه ما ربطتش أي خيط. كل استنتاج بيتسجل هنا بدليله.')))
  }

  private dragCard(card: HTMLElement, id: EvidenceId, lines: SVGElement, W: number, H: number): void {
    let start: { px: number; py: number; x: number; y: number } | undefined
    let moved = false
    card.addEventListener('pointerdown', e => {
      if (window.matchMedia('(max-width: 720px)').matches) return
      const p = this.pos.get(id)!
      start = { px: e.clientX, py: e.clientY, x: p.x, y: p.y }
      moved = false
      card.setPointerCapture(e.pointerId)
    })
    card.addEventListener('pointermove', e => {
      if (!start) return
      const dx = e.clientX - start.px
      const dy = e.clientY - start.py
      if (!moved && Math.hypot(dx, dy) < 6) return
      moved = true
      const p = this.pos.get(id)!
      p.x = Math.max(0, Math.min(W - CARD_W, start.x + dx))
      p.y = Math.max(0, Math.min(H - CARD_H, start.y + dy))
      card.style.left = `${p.x}px`
      card.style.top = `${p.y}px`
    })
    const end = () => {
      if (!start) return
      start = undefined
      if (moved) return this.render()
      this.pick(id)
    }
    card.addEventListener('pointerup', end)
    card.addEventListener('pointercancel', () => { start = undefined })
    card.addEventListener('click', () => { if (window.matchMedia('(max-width: 720px)').matches) this.pick(id) })
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.pick(id) } })
    void lines
  }

  private setNote(text: string, kind: '' | 'success' | 'fail' | 'info' = ''): void {
    this.note = text
    this.noteKind = kind
  }

  private pick(id: EvidenceId): void {
    const s = this.session
    if (!s) return
    this.d.audio.play('ui')
    this.setNote('')
    this.lastPair = undefined
    this.comparisonOpen = false
    this.flash = undefined
    if (!this.selected || this.selected === id) {
      if (!this.selected) this.d.audio.play('pin')
      const title = s.engine.evidenceInfo(id)?.title ?? 'الدليل'
      this.selected = this.selected === id ? undefined : id
      this.setNote(this.selected ? `اتحدد «${title}». اختار دليل تاني عشان تكمّل الربط.` : 'اتلغى تحديد الدليل.', 'info')
      return this.render()
    }
    const a = this.selected
    this.selected = undefined
    const key = this.pairKey(a, id)
    const pair: EvidencePair = { a, b: id }
    this.lastPair = pair
    const r = s.tie(a, id)
    if (r.ok) {
      const dd = s.engine.file.deductions.find(x => x.id === r.deduction)!
      pair.deduction = dd
      if (r.fresh) {
        this.d.audio.play('thread')
        this.fresh = { a, b: id, id: dd.id }
        this.focusDeduction = undefined
        window.clearTimeout(this.freshTimer)
        this.freshTimer = window.setTimeout(() => { this.fresh = undefined; this.refresh() }, 2200)
      } else this.setNote('الخيط ده مربوط قبل كده.', 'info')
    } else {
      this.flash = { a, b: id }
      this.d.audio.play('error')
      if (r.reason === 'no-link') {
        const again = this.tried.has(key)
        this.tried.add(key)
        this.setNote(again ? '✖ جرّبت الدليلين دول قبل كده: مفيش علاقة واضحة بينهم… لسه.' : '✖ مفيش علاقة واضحة بين الدليلين دول… لسه.', 'fail')
      } else this.setNote('اختار دليلين مختلفين.', 'fail')
    }
    this.render()
    if (window.matchMedia('(max-width: 720px)').matches) {
      this.pageEl.querySelector('.board-link-result')?.scrollIntoView({ block: 'nearest' })
    }
  }

  private accuseBlock(s: Session): HTMLElement {
    const can = s.engine.canAccuse()
    const solved = s.state.flags.has('case_solved')
    if (solved) return h('p', { class: 'board-note ok' }, 'القضية اتقفلت.')
    const fin = s.engine.file.finale
    const need = fin.requires.deductions ?? []
    const needFlags = fin.requires.flags ?? []
    if (!can) {
      const rows = [
        ...need.map((id, i) => ({ done: s.state.deductions.has(id), text: s.state.deductions.has(id) ? s.engine.file.deductions.find(d => d.id === id)!.title : `خيط أساسي رقم ${arabicDigits(i + 1)}` })),
        ...needFlags.map(f => ({ done: s.state.flags.has(f), text: f === 'found_mahmoud' ? 'تتأكد من مكان محمود' : 'شرط من القصة' })),
      ]
      return h('div', { class: 'accuse accuse-locked' }, h('h4', null, 'الاتهام النهائي'),
        h('p', { class: 'cf-empty' }, 'الاتهام بيتفتح لما تكمّل الأساس اللي بيثبت القضية:'),
        h('ul', { class: 'accuse-checklist' }, rows.map(r => h('li', { class: r.done ? 'done' : '' }, h('span', { 'aria-hidden': true }, r.done ? '✔' : '◻'), r.text))))
    }
    const suspectCards = s.engine.file.suspects.map(x => {
      const art = x.id === 'unknown' ? undefined : CHARACTER_ART[x.id]
      const [name, role] = x.label.split(' – ')
      const on = this.accSuspect === x.id
      return h('button', { class: `suspect-card${on ? ' on' : ''}`, role: 'radio', 'aria-checked': String(on), onclick: () => {
        if (!on) this.accusationReview = undefined
        this.accSuspect = x.id
        this.accConfirm = false
        this.d.audio.play('ui')
        this.render()
      } },
        art ? h('img', { src: art.src, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }) : h('span', { class: 'suspect-unknown', 'aria-hidden': true }, '؟'),
        h('b', null, name), role && h('small', null, role))
    })
    const motiveCards = fin.motives.map(m => {
      const on = this.accMotive === m.id
      return h('button', { class: `motive-card${on ? ' on' : ''}`, role: 'radio', 'aria-checked': String(on), onclick: () => {
        if (!on) this.accusationReview = undefined
        this.accMotive = m.id
        this.accConfirm = false
        this.d.audio.play('ui')
        this.render()
      } },
        h('span', { class: 'motive-mark', 'aria-hidden': true }, on ? '◉' : '○'), m.text)
    })
    const suspect = s.engine.file.suspects.find(x => x.id === this.accSuspect)
    const motive = fin.motives.find(m => m.id === this.accMotive)
    const ready = !!suspect && !!motive
    const go = h('button', { class: `btn danger accuse-go${this.accConfirm ? ' confirm' : ''}`, disabled: !ready, onclick: () => {
      if (!ready) { this.setNote('اختار المتهم والدافع الأول.', 'fail'); return this.render() }
      if (!this.accConfirm) { this.accConfirm = true; this.d.audio.play('ui'); return this.render() }
      this.d.audio.play('accuse')
      this.accConfirm = false
      const r = s.accuse(this.accSuspect!, this.accMotive!)
      this.accusationReview = r === 'wrong-culprit' || r === 'wrong-motive' ? r : undefined
      this.d.onAccused(r)
      this.render()
      this.pageEl.querySelector<HTMLElement>('.clue-review')?.focus()
    } }, this.accConfirm ? 'أكيد، قدّم الاتهام' : ready ? 'راجع الاتهام' : 'اتّهام')
    return h('div', { class: 'accuse' }, h('h4', null, 'الاتهام النهائي'),
      h('p', { class: 'accuse-step' }, '١. مين الجاني؟'),
      h('div', { class: 'suspect-grid', role: 'radiogroup', 'aria-label': 'المتهم' }, suspectCards),
      h('p', { class: 'accuse-step' }, '٢. إيه الدافع؟'),
      h('div', { class: 'motive-list', role: 'radiogroup', 'aria-label': 'الدافع' }, motiveCards),
      ready && h('p', { class: 'accuse-summary' }, this.accConfirm ? 'هتقدّم الاتهام ضد ' : 'الاتهام: ', h('b', null, suspect.label.split(' – ')[0]), ' — الاتهام الغلط بيتحسب عليك.'),
      go,
      this.reviewAccusation(s),
      this.accConfirm && h('button', { class: 'tray-btn', onclick: () => { this.accConfirm = false; this.render() } }, 'رجوع'))
  }

  // ---- Journal --------------------------------------------------------------------------------------------------------

  private journal(s: Session): HTMLElement {
    const at = this.d.story.chapterIndex(s)
    const unlocked = new Set(this.d.story.unlocked(s).map(entry => entry.id))
    const fresh = new Set(JOURNAL.filter(entry => unlocked.has(entry.id) && !s.state.flags.has(`j_read_${entry.id}`)).map(entry => entry.id))
    this.d.story.markRead(s)
    let page = 0
    const rail = h('ol', { class: 'chapter-rail', 'aria-label': 'فصول القضية' }, CHAPTERS.map((chapter, i) =>
      h('li', { class: i < at ? 'done' : i === at ? 'now' : 'locked', 'aria-current': i === at ? 'step' : undefined },
        h('span', { class: 'rail-dot', 'aria-hidden': true }, i < at ? '✔' : arabicDigits(i + 1)),
        h('b', null, i <= at ? chapter.title : 'فصل لسه ما اتفتحش'))))
    const sections = CHAPTERS.slice(0, at + 1).map((chapter, i) => {
      const entries = JOURNAL.filter(entry => entry.chapter === chapter.id && unlocked.has(entry.id))
      return h('section', { class: 'journal-chapter' },
        h('header', null, h('small', null, `الفصل ${arabicDigits(i + 1)}`), h('h3', null, chapter.title), h('p', null, chapter.kicker)),
        entries.length
          ? entries.map(entry => h('article', { class: `journal-page${fresh.has(entry.id) ? ' fresh' : ''}` },
            h('div', { class: 'journal-meta' }, h('span', null, `صفحة ${arabicDigits(++page)}`), fresh.has(entry.id) && h('b', null, 'جديدة')),
            h('h4', null, entry.title),
            h('p', null, s.fill(entry.text))))
          : h('p', { class: 'cf-empty' }, 'لسه ما كتبتش حاجة في الفصل ده… كمّل التحقيق.'))
    }).reverse()
    const total = JOURNAL.length
    return h('div', { class: 'journal' },
      h('aside', { class: 'journal-side' },
        h('div', { class: 'journal-cover' }, h('small', null, 'دفتر خاص'), h('b', null, `يوميات ${s.profile.avatar.name}`),
          h('span', null, `${arabicDigits(unlocked.size)} من ${arabicDigits(total)} صفحة`)),
        rail),
      h('div', { class: 'journal-pages' }, sections))
  }

  // ---- Organizer -------------------------------------------------------------------------------------------------------

  private organizer(s: Session): HTMLElement {
    const views: [OrgView, string][] = [['suspects', 'المشتبهون'], ['timeline', 'الخط الزمني'], ['badges', 'الأوسمة']]
    const body = this.orgView === 'suspects' ? this.suspectBoard(s) : this.orgView === 'timeline' ? this.timeline(s) : this.badgeBoard(s)
    return h('div', { class: 'organizer' },
      h('nav', { class: 'org-tabs', 'aria-label': 'أقسام المنظّم' }, views.map(([id, label]) =>
        h('button', { class: `org-tab${this.orgView === id ? ' on' : ''}`, 'aria-pressed': String(this.orgView === id),
          onclick: () => { this.orgView = id; this.d.audio.play('ui'); this.render() } }, label))),
      body)
  }

  private suspectBoard(s: Session): HTMLElement {
    const levels: [number, string][] = [[0, 'مش مشتبه'], [1, 'محتمل'], [2, 'مشتبه رئيسي']]
    const level = (id: string) => (s.state.flags.has(`sus_${id}_2`) ? 2 : s.state.flags.has(`sus_${id}_1`) ? 1 : 0)
    const setLevel = (id: string, value: number) => {
      s.engine.apply([{ type: 'unflag', id: `sus_${id}_1` }, { type: 'unflag', id: `sus_${id}_2` }, ...(value ? [{ type: 'flag', id: `sus_${id}_${value}` } as const] : [])])
      s.save()
      this.d.audio.play('ui')
      this.render()
    }
    return h('div', { class: 'suspects' },
      h('p', { class: 'org-hint' }, 'منظّمك الشخصي: علّم درجة شكّك في كل شخص، وراجع اللي اتأكدت منه عنه. ده تنظيم لأفكارك بس، مش بيأثر على الاتهام.'),
      s.engine.file.suspects.map(x => {
        const art = x.id === 'unknown' ? undefined : CHARACTER_ART[x.id]
        const [name, role] = x.label.split(' – ')
        const notes = SUSPECT_NOTES.filter(n => n.suspect === x.id && s.engine.matches(n.when))
        const current = level(x.id)
        return h('article', { class: `suspect-file lvl-${current}` },
          h('div', { class: 'suspect-photo' }, art ? h('img', { src: art.src, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }) : h('span', { 'aria-hidden': true }, '؟')),
          h('div', { class: 'suspect-info' },
            h('h3', null, name, role && h('small', null, ` · ${role}`)),
            h('div', { class: 'suspect-levels', role: 'radiogroup', 'aria-label': `درجة الشك في ${name}` }, levels.map(([value, label]) =>
              h('button', { class: `lvl-btn l${value}${current === value ? ' on' : ''}`, role: 'radio', 'aria-checked': String(current === value), onclick: () => setLevel(x.id, value) }, label))),
            notes.length
              ? h('ul', { class: 'suspect-notes' }, notes.map(n => h('li', null, h('b', { class: `tag-${n.label === 'دافع' ? 'motive' : n.label === 'فرصة' ? 'chance' : n.label === 'حجة غياب' ? 'alibi' : 'note'}` }, n.label), n.text)))
              : h('p', { class: 'cf-empty' }, 'لسه ما اتأكدتش من حاجة عنه.')))
      }))
  }

  private timeline(s: Session): HTMLElement {
    const known = TIMELINE.filter(item => s.engine.matches(item.when)).length
    return h('div', { class: 'timeline' },
      h('p', { class: 'org-hint' }, `${arabicDigits(known)} من ${arabicDigits(TIMELINE.length)} لحظة اتكشفت. كل دليل جديد بيملّي فجوة في الليلة دي.`),
      h('ol', null, TIMELINE.map(item => s.engine.matches(item.when)
        ? h('li', { class: 'tl-item known' }, h('time', null, item.time), h('div', null, h('b', null, item.title), h('p', null, item.text)))
        : h('li', { class: 'tl-item gap' }, h('time', null, '؟'), h('div', null, h('b', null, 'لحظة لسه ناقصة'), h('p', null, 'دليل لسه ما اتجمعش.'))))))
  }

  private badgeBoard(s: Session): HTMLElement {
    const badges = this.d.story.badges(s)
    return h('div', { class: 'badges' },
      h('p', { class: 'org-hint' }, `${arabicDigits(badges.filter(b => b.earned).length)} من ${arabicDigits(badges.length)} وسام.`),
      h('div', { class: 'badge-grid' }, badges.map(b =>
        h('article', { class: `badge${b.earned ? ' earned' : ''}` },
          h('span', { class: 'badge-seal', 'aria-hidden': true }, b.earned ? '★' : '☆'),
          h('b', null, b.title), h('p', null, b.text), h('small', null, b.earned ? 'مكتسب' : 'لسه')))))
  }

  // ---- Life ------------------------------------------------------------------------------------------------------------

  private life(s: Session): HTMLElement {
    const views: [LifeView, string][] = [['paths', 'مساراتك'], ['yassin', 'سيرة ياسين'], ['mahmoud', 'حياة محمود'], ['alex', 'إسكندرية الحقيقية']]
    const body = { paths: () => this.lifePaths(s), yassin: () => this.lifeTimeline(YASSIN_LIFE.map(e => ({ ...e, known: true }))), mahmoud: () => this.lifeTimeline(MAHMOUD_LIFE.map(e => ({ ...e, known: s.engine.matches(e.when) }))), alex: () => this.lifeAlex() }[this.lifeView]()
    return h('div', { class: 'life organizer' },
      h('nav', { class: 'org-tabs', 'aria-label': 'أقسام حياتك' }, views.map(([id, label]) =>
        h('button', { class: `org-tab${this.lifeView === id ? ' on' : ''}`, 'aria-pressed': String(this.lifeView === id),
          onclick: () => { this.lifeView = id; this.d.audio.play('ui'); this.render() } }, label))),
      body)
  }

  private lifePaths(s: Session): HTMLElement {
    const scores = pathScores(s.state.flags)
    const lead = dominantPath(s.state.flags)
    const ids = Object.keys(PATHS) as PathId[]
    const made = LIFE_CHOICES.filter(choice => s.state.flags.has(choice.flag))
    return h('div', { class: 'life-paths' },
      h('p', { class: 'org-hint' }, 'حريتك كاملة: ساعد الناس، أو ذاكر، أو اشتغل بالبيع والشراء، أو قرّب من ناس الليل. الاختيارات دي مابتغيّرش الأدلة ولا الحل، لكنها بتغيّر سمعتك وصفحات يومياتك ونهايتك.'),
      h('div', { class: 'path-grid' }, ids.map(id => {
        const score = scores[id]
        return h('article', { class: `path-card p-${id}${lead === id ? ' lead' : ''}` },
          h('header', null, h('b', null, PATHS[id].title), lead === id && h('span', { class: 'path-lead' }, 'الأقوى')),
          h('p', null, PATHS[id].text),
          h('div', { class: 'path-meter', role: 'img', 'aria-label': `${arabicDigits(score)} نقطة` }, h('i', { style: { width: `${Math.min(100, score * 10)}%` } })),
          h('small', null, `${arabicDigits(score)} نقطة`))
      })),
      h('h3', { class: 'quest-head-title' }, `اختياراتك (${arabicDigits(made.length)} من ${arabicDigits(LIFE_CHOICES.length)})`),
      made.length
        ? h('ul', { class: 'choice-log' }, made.map(choice =>
          h('li', { class: `c-${choice.path}` }, h('b', null, choice.title), h('span', null, choice.text), h('small', null, `${PATHS[choice.path].short} ‎+${arabicDigits(choice.points)}`))))
        : h('p', { class: 'cf-empty' }, 'لسه ما اخترتش. كلّم الناس: رجب وعم بحر وعم حسن وستّك وشوقي عندهم عروض ومواقف بتكشف إنت مين.'))
  }

  private lifeTimeline(items: { year: string; title: string; text: string; real?: boolean; known: boolean }[]): HTMLElement {
    const known = items.filter(item => item.known).length
    return h('div', { class: 'timeline' },
      h('p', { class: 'org-hint' }, `${arabicDigits(known)} من ${arabicDigits(items.length)} محطة معروفة. الوسم «واقعي» يعني حدث حقيقي حصل في مصر أو الإسكندرية.`),
      h('ol', null, items.map(item => item.known
        ? h('li', { class: 'tl-item known' }, h('time', null, item.year), h('div', null, h('b', null, item.title, item.real && h('em', { class: 'real-tag' }, 'واقعي')), h('p', null, item.text)))
        : h('li', { class: 'tl-item gap' }, h('time', null, item.year), h('div', null, h('b', null, 'صفحة لسه مقفولة'), h('p', null, 'كمّل التحقيق أو اسمع الناس علشان تتفتح.'))))))
  }

  private lifeAlex(): HTMLElement {
    return h('div', { class: 'alex' },
      h('p', { class: 'org-hint' }, 'حقائق موثّقة بتدعم أجواء القصة، من غير أخبار لحظية أو مواقف سياسية. التقويم الواقعي في اللعبة بيستخدم مواعيد حقيقية للمباريات، وبيتحدّث من ملف الأحداث.'),
      h('div', { class: 'alex-grid' }, REAL_ALEX.map(item =>
        h('article', { class: 'alex-card' }, h('b', null, item.title), h('p', null, item.text), h('small', null, `المصدر: ${item.source}`)))),
      h('button', { class: 'tray-btn', onclick: () => this.setTab('calendar') }, 'افتح التقويم الواقعي'))
  }

  // ---- Map ------------------------------------------------------------------------------------------------------------------------

  private map(s: Session): HTMLElement {
    const here = this.d.where()
    const objective = s.engine.currentObjective()
    const makeMap = (zone: 'abis' | 'city', title: string, bounds: { x0: number; x1: number; z0: number; z1: number }) => {
      const W = 420
      const H = Math.round((W * (bounds.z1 - bounds.z0)) / (bounds.x1 - bounds.x0))
      const px = (x: number) => ((x - bounds.x0) / (bounds.x1 - bounds.x0)) * W
      const pz = (z: number) => ((z - bounds.z0) / (bounds.z1 - bounds.z0)) * H
      const root = svg('svg', { class: 'map-svg', viewBox: `0 0 ${W} ${H}`, width: '100%' })
      root.append(svg('rect', { x: 0, y: 0, width: W, height: H, class: 'map-bg' }))
      if (zone === 'city') root.append(svg('rect', { x: 0, y: 0, width: W, height: pz(-297), class: 'map-sea' }))
      if (zone === 'abis') root.append(svg('rect', { x: 0, y: pz(143), width: W, height: pz(157) - pz(143), class: 'map-sea' }))
      for (const p of Object.values(PLACES).filter(pl => pl.district === zone)) {
        const g = svg('g', { class: `map-pin${objective?.place === p.id ? ' goal' : ''}` })
        g.append(svg('circle', { cx: px(p.pos.x), cy: pz(p.pos.z), r: 5 }))
        const t = svg('text', { x: px(p.pos.x), y: pz(p.pos.z) - 9, 'text-anchor': 'middle' })
        t.textContent = p.short
        g.append(t)
        root.append(g)
      }
      if (here.zone === zone) {
        const me = svg('g', { class: 'map-me' })
        me.append(svg('circle', { cx: px(here.x), cy: pz(here.z), r: 6 }), svg('circle', { cx: px(here.x), cy: pz(here.z), r: 11, class: 'pulse' }))
        root.append(me)
      }
      return h('figure', { class: 'map' }, h('figcaption', null, title, here.zone === zone ? ' (انت هنا)' : ''), root)
    }
    return h('div', { class: 'maps' },
      makeMap('abis', 'أبيس – عزبة ١٥', { x0: -110, x1: 230, z0: 118, z1: 318 }),
      makeMap('city', 'الإسكندرية', { x0: -400, x1: 250, z0: -390, z1: -70 }),
      objective?.place && h('p', { class: 'board-note' }, `الهدف الحالي: ${objective.title} – ${PLACES[objective.place].name}`))
  }

  // ---- Calendar -----------------------------------------------------------------------------------------------------------------------

  private calendar(s: Session): HTMLElement {
    const now = s.clock.stamp
    const upcoming = this.d.events.upcoming(now, 8)
    return h('div', { class: 'cf-list' },
      h('article', { class: 'cal-now' },
        h('h3', null, s.mode === 'realistic' ? 'الوضع الواقعي' : 'وضع القصة'),
        h('p', null, s.mode === 'realistic'
          ? `الوقت في القاهرة الآن: ${formatDateTime(now)}. الأدلة الإضافية بتظهر حسب مواعيد الناس والأحداث الحقيقية.`
          : `ساعة القصة: ${formatClock(s.clock.hour)}. التوقيت الحقيقي مش بيأثر على الأدلة.`)),
      h('h4', null, 'أحداث قادمة'),
      upcoming.length ? upcoming.map(o => h('article', { class: 'cal-ev' },
        h('b', null, o.event.title), h('small', null, ` • ${EVENT_LABEL[o.event.kind]}`),
        h('p', null, `${formatDate(o.start)} – ${formatClock((o.start % 86_400_000) / 3_600_000)}${o.event.venue ? ` • ${o.event.venue}` : ''}`),
        o.event.provisional && h('p', { class: 'warn' }, '⚠ موعد مؤقت للتجربة'))) : h('p', { class: 'cf-empty' }, 'مفيش أحداث مسجّلة.'),
      h('p', { class: 'cf-foot' }, `قاعدة الأحداث: ${arabicDigits(this.d.events.size)} سجل • إصدار ${arabicDigits(this.d.events.docVersion)}`))
  }
}
