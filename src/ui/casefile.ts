/**
 * Case-file overlay (the "investigation folder"): evidence, people, objectives, the red-thread
 * board, map, real-world calendar and the final accusation. Built with the safe DOM helper.
 */
import { formatClock, formatDate, formatDateTime, arabicDigits } from '../core/clock'
import { PLACES } from '../data/places'
import type { Evidence, EvidenceId, EventKind } from '../data/types'
import type { Audio } from '../engine/audio'
import type { Session } from '../game/session'
import type { EventsDb } from '../services/eventsDb'
import { h, setChildren, svg } from './dom'

type Tab = 'evidence' | 'people' | 'objectives' | 'board' | 'map' | 'calendar'
const TABS: [Tab, string][] = [
  ['board', 'اللوحة'], ['evidence', 'الأدلة'], ['people', 'الأشخاص'], ['objectives', 'المهام'], ['map', 'الخريطة'], ['calendar', 'التقويم'],
]
const KIND_LABEL: Record<Evidence['kind'], string> = { object: 'جسم', testimony: 'شهادة', document: 'مستند', photo: 'صورة', trace: 'أثر' }
const EVENT_LABEL: Record<EventKind, string> = { match_ittihad: 'مباراة الاتحاد', market_day: 'سوق', friday_prayer: 'صلاة الجمعة' }
const CARD_W = 150
const CARD_H = 96

export type CaseFileDeps = {
  audio: Audio
  events: EventsDb
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
  private tab: Tab = 'board'
  private selected?: EvidenceId
  private readonly pos = new Map<EvidenceId, { x: number; y: number }>()
  private flash?: { a: EvidenceId; b: EvidenceId }
  private note = ''

  constructor(private readonly d: CaseFileDeps) {
    this.tabsEl = h('nav', { class: 'cf-tabs', role: 'tablist' })
    this.pageEl = h('div', { class: 'cf-page' })
    this.el = h('section', { class: 'casefile', hidden: true, role: 'dialog', 'aria-label': 'ملف القضية' },
      h('div', { class: 'cf-folder' },
        h('header', { class: 'cf-head' },
          h('div', { class: 'cf-stamp' }, 'سرّي'),
          h('div', { class: 'cf-title' }, h('small', null, 'ملف القضية'), h('b', { id: 'cf-case-title' }, '')),
          h('button', { class: 'cf-close', 'aria-label': 'إغلاق', onclick: () => this.close() }, '✕')),
        this.tabsEl, this.pageEl),
    )
  }

  get open(): boolean {
    return !this.el.hidden
  }

  show(session: Session, tab: Tab = this.tab): void {
    this.session = session
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
    if (e.code === 'Escape' || e.code === 'Tab' || e.code === 'KeyJ') {
      this.close()
      return true
    }
    return false
  }

  private setTab(tab: Tab): void {
    this.tab = tab
    this.render()
  }

  private render(): void {
    const s = this.session
    if (!s) return
    setChildren(this.tabsEl, TABS.map(([id, label]) =>
      h('button', { class: `cf-tab${id === this.tab ? ' on' : ''}`, role: 'tab', 'aria-selected': id === this.tab, onclick: () => { this.d.audio.play('ui'); this.setTab(id) } }, label)))
    const page = { evidence: () => this.evidence(s), people: () => this.people(s), objectives: () => this.objectives(s), board: () => this.board(s), map: () => this.map(s), calendar: () => this.calendar(s) }[this.tab]()
    setChildren(this.pageEl, page)
  }

  // ---- Evidence -----------------------------------------------------------------------------------------------------

  private evidence(s: Session): HTMLElement {
    const all = s.engine.file.evidence
    const found = all.filter(e => s.engine.has(e.id))
    const rows = found.map(e => this.evidenceCard(s, e, true))
    return h('div', { class: 'cf-list' },
      h('p', { class: 'cf-count' }, `${arabicDigits(found.length)} من ${arabicDigits(all.length)} دليل`),
      rows.length ? rows : h('p', { class: 'cf-empty' }, 'لسه ما جمعتش أي دليل. افحص المكان وكلّم الناس.'))
  }

  private evidenceCard(s: Session, e: Evidence, full: boolean): HTMLElement {
    const at = s.state.evidence.get(e.id)
    return h('article', { class: `ev kind-${e.kind}` },
      h('div', { class: 'ev-tag' }, KIND_LABEL[e.kind]),
      h('h3', null, e.title),
      h('p', { class: 'ev-sum' }, e.summary),
      full && h('p', { class: 'ev-detail' }, e.detail),
      h('footer', null, `${PLACES[e.place].name} • ${e.source}`, at ? ` • ${formatDateTime(at)}` : ''))
  }

  // ---- People -------------------------------------------------------------------------------------------------------

  private people(s: Session): HTMLElement {
    const cards = s.knownCharacters().map(c => {
      const unlockedPast = c.past.filter(p => !p.unlock || s.state.flags.has(p.unlock))
      const secret = c.secret && s.state.flags.has(c.secret.unlock) ? c.secret.text : undefined
      const hidden = c.id === 'mahmoud' && !s.state.flags.has('found_mahmoud')
      return h('article', { class: 'person' },
        h('div', { class: 'person-fig', style: { '--body': c.figure.body, '--accent': c.figure.accent } }, h('span', null, c.name.replace(/^(ال|عم |المعلم |الحاجة )/, '').slice(0, 1))),
        h('div', { class: 'person-body' },
          h('h3', null, c.name, h('small', null, ` • ${c.age} سنة`)),
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
    return h('div', { class: 'cf-list' }, items.map(({ objective, done }) =>
      h('article', { class: `obj${done ? ' done' : ''}` },
        h('span', { class: 'obj-box' }, done ? '✔' : '◻'),
        h('div', null, h('h3', null, objective.title), h('p', null, objective.detail),
          objective.place && h('small', null, `📍 ${PLACES[objective.place].name}`)))))
  }

  // ---- Board ---------------------------------------------------------------------------------------------------------------------

  private board(s: Session): HTMLElement {
    const found = s.engine.file.evidence.filter(e => s.engine.has(e.id))
    found.forEach((e, i) => {
      if (!this.pos.has(e.id)) this.pos.set(e.id, { x: 24 + (i % 5) * (CARD_W + 28), y: 24 + Math.floor(i / 5) * (CARD_H + 56) })
    })
    const W = 5 * (CARD_W + 28) + 40
    const H = Math.max(320, (Math.floor((found.length - 1) / 5) + 1) * (CARD_H + 56) + 40)
    const lines = svg('svg', { class: 'board-lines', width: W, height: H, viewBox: `0 0 ${W} ${H}` })
    const drawLine = (a: EvidenceId, b: EvidenceId, cls: string) => {
      const pa = this.pos.get(a)
      const pb = this.pos.get(b)
      if (!pa || !pb) return
      const x1 = pa.x + CARD_W / 2
      const y1 = pa.y + 10
      const x2 = pb.x + CARD_W / 2
      const y2 = pb.y + 10
      const sag = Math.min(60, Math.hypot(x2 - x1, y2 - y1) * 0.18)
      const path = svg('path', { d: `M${x1} ${y1} Q${(x1 + x2) / 2} ${(y1 + y2) / 2 + sag} ${x2} ${y2}`, class: cls })
      lines.append(path)
    }
    for (const dd of s.engine.file.deductions) if (s.state.deductions.has(dd.id)) for (const [a, b] of dd.pairs) if (s.engine.has(a) && s.engine.has(b)) drawLine(a, b, 'thread')
    if (this.flash) drawLine(this.flash.a, this.flash.b, 'thread-fail')

    const cards = found.map(e => {
      const p = this.pos.get(e.id)!
      const card = h('div', { class: `pin-card kind-${e.kind}${this.selected === e.id ? ' selected' : ''}`, style: { left: `${p.x}px`, top: `${p.y}px`, width: `${CARD_W}px`, height: `${CARD_H}px` }, tabindex: 0, role: 'button', 'aria-label': e.title },
        h('i', { class: 'pin' }), h('small', null, KIND_LABEL[e.kind]), h('b', null, e.title))
      this.dragCard(card, e.id, lines, W, H)
      return card
    })

    const tied = s.engine.file.deductions.filter(dd => s.state.deductions.has(dd.id))
    const sel = this.selected ? s.engine.evidenceInfo(this.selected) : undefined
    const wrap = h('div', { class: 'board-wrap' }, h('div', { class: 'board', style: { width: `${W}px`, height: `${H}px` } }, lines, cards))
    return h('div', { class: 'board-page' },
      h('p', { class: 'board-help' }, found.length < 2 ? 'اجمع دليلين على الأقل عشان تقدر تربط بينهم.' : 'اضغط على دليل ثم على دليل تاني لتربطهم بخيط أحمر. اسحب الكروت لترتّبها.'),
      wrap,
      h('div', { class: 'board-side' },
        sel && h('div', { class: 'sel-detail' }, h('h4', null, sel.title), h('p', null, sel.detail)),
        this.note && h('p', { class: 'board-note' }, this.note),
        h('h4', null, 'الاستنتاجات'),
        tied.length ? h('ul', { class: 'deductions' }, tied.map(dd => h('li', null, h('b', null, dd.title), ' – ', dd.conclusion))) : h('p', { class: 'cf-empty' }, 'لسه ما ربطتش أي خيط.'),
        this.accuseBlock(s)))
  }

  private dragCard(card: HTMLElement, id: EvidenceId, lines: SVGElement, W: number, H: number): void {
    let start: { px: number; py: number; x: number; y: number } | undefined
    let moved = false
    card.addEventListener('pointerdown', e => {
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
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') this.pick(id) })
    void lines
  }

  private pick(id: EvidenceId): void {
    const s = this.session
    if (!s) return
    this.d.audio.play('ui')
    this.note = ''
    this.flash = undefined
    if (!this.selected || this.selected === id) {
      this.selected = this.selected === id ? undefined : id
      return this.render()
    }
    const a = this.selected
    this.selected = undefined
    const r = s.tie(a, id)
    if (r.ok) {
      const dd = s.engine.file.deductions.find(x => x.id === r.deduction)!
      this.note = r.fresh ? `✔ خيط جديد: ${dd.title}` : 'الخيط ده مربوط قبل كده.'
      if (r.fresh) this.d.audio.play('thread')
    } else {
      this.flash = { a, b: id }
      this.d.audio.play('error')
      this.note = r.reason === 'no-link' ? '✖ مفيش علاقة واضحة بين الدليلين دول… لسه.' : 'اختار دليلين مختلفين.'
    }
    this.render()
  }

  private accuseBlock(s: Session): HTMLElement {
    const can = s.engine.canAccuse()
    const solved = s.state.flags.has('case_solved')
    if (solved) return h('p', { class: 'board-note' }, 'القضية اتقفلت. ✔')
    const fin = s.engine.file.finale
    const culprit = h('select', { 'aria-label': 'المتهم' }, h('option', { value: '' }, 'اختار المتهم…'), s.engine.file.suspects.map(x => h('option', { value: x.id }, x.label)))
    const motive = h('select', { 'aria-label': 'الدافع' }, h('option', { value: '' }, 'اختار الدافع…'), fin.motives.map(m => h('option', { value: m.id }, m.text)))
    const go = h('button', { class: 'btn danger', disabled: !can, onclick: () => {
      if (!culprit.value || !motive.value) { this.note = 'اختار المتهم والدافع الأول.'; return this.render() }
      this.d.audio.play('accuse')
      const r = s.accuse(culprit.value, motive.value)
      if (r === 'wrong-culprit') this.note = fin.wrongCulprit
      else if (r === 'wrong-motive') this.note = fin.wrongMotive
      this.d.onAccused(r)
      this.render()
    } }, 'اتّهام')
    return h('div', { class: 'accuse' }, h('h4', null, 'الاتهام النهائي'),
      can ? [culprit, motive, go] : h('p', { class: 'cf-empty' }, 'اربط الخيوط الأساسية (الحدود – العقد – الطريق) قبل ما تتّهم حد.'))
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
