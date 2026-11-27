import { arabicDigits, formatClock, partsOf } from '../core/clock'
import { CHARACTER_LIST } from '../data/characters'
import { PLACES, PLACE_LIST } from '../data/places'
import type { CharacterId, CharacterProfile, Evidence, EvidenceId, Hotspot, Place, PlaceId } from '../data/types'
import type { Audio } from '../engine/audio'
import type { Session } from '../game/session'
import { evidenceUrl, PIN_POS, isDaytime, portraitUrl, sceneNeighbors, sceneSrcSet, sceneUrl } from './art'
import { h, setChildren, svg } from './dom'
import { applyAreaTheme } from './worldFx'
import { applyWorldTime } from './extras'
import { RealMap } from './realMap'

export type InvestigationTab = 'scene' | 'map'
export type InvestigationDeps = {
  audio: Audio
  onHotspot: (hotspot: Hotspot) => void
  onTalk: (characterId: CharacterId) => void
  onPlaceChange: (placeId: PlaceId) => void
  onCaseFile: () => void
  onHint: () => void
  onPause: () => void
  onMail?: () => void
  mailCount?: () => number
  onHelp?: () => void
  onFarPlace?: (id: PlaceId) => void
  onMute?: () => void
  onTextSize?: () => void
  isMuted?: () => boolean
}

const KIND_LABEL: Record<Hotspot['kind'], string> = {
  inspect: 'افحص', photo: 'صوّر', travel: 'سافر', rest: 'استريّح',
}
const KIND_ICON: Record<Hotspot['kind'], string> = { inspect: '⌕', photo: '◉', travel: '⇢', rest: '☾' }
const STOPS: Record<Place['district'], PlaceId> = { abis: 'abis_stop', city: 'raml_stop' }
const DISTRICT_NAME: Record<Place['district'], string> = { abis: 'أبيس • عزبة ١٥', city: 'الإسكندرية' }
const WIDE = '(min-width: 1100px)'

/** Strip honorifics so the initial fallback is the person's own name. */
const initial = (name: string) => name.replace(/^(ال|عم |المعلم |الحاجة )/, '').slice(0, 1)

export class InvestigationView {
  readonly el: HTMLElement
  private session?: Session
  private placeId: PlaceId = 'zeinab_home'
  private tab: InvestigationTab = 'scene'
  private readonly reviewedEvidence = new Set<EvidenceId>()
  private visit = 0
  /** Desktop side drawer / mobile bottom sheet. */
  private drawerOpen = false
  private lastScene = ''
  private readonly clockEl = h('span', { class: 'inv-clock', 'aria-label': 'الساعة' })
  private lastClock = ''
  private lastDay: boolean | undefined
  private mapKind: 'real' | 'drawn' = 'real'
  private destination?: HTMLDialogElement
  private readonly realMap = new RealMap({
    onSelect: id => this.selectPlace(id),
    onFar: id => this.d.onFarPlace?.(id),
    onUnavailable: () => { if (this.mapKind === 'real') { this.mapKind = 'drawn'; if (this.tab === 'map') this.render() } },
  })

  constructor(private readonly d: InvestigationDeps) {
    this.el = h('main', { class: 'investigation', hidden: true, 'aria-label': 'واجهة التحقيق' })
    this.drawerOpen = window.matchMedia?.(WIDE).matches ?? false
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.layoutPins()).observe(this.el)
  }

  get currentPlace(): PlaceId {
    return this.placeId
  }

  get currentTab(): InvestigationTab {
    return this.tab
  }

  /** Current scene photograph (used as the dialogue backdrop). */
  get sceneImage(): string {
    return sceneUrl(this.placeId, this.session?.clock.hour)
  }

  /** Cheap per-frame clock update; re-renders only when day turns to night (or back). */
  tickClock(hour: number): void {
    if (this.el.hidden) return
    this.d.audio.setClock(hour)
    const text = formatClock(hour)
    if (text !== this.lastClock) {
      this.lastClock = text
      this.clockEl.textContent = `◷ ${text}`
    }
    const day = isDaytime(hour)
    if (this.lastDay !== undefined && day !== this.lastDay) {
      this.lastDay = day
      this.render()
    }
    this.lastDay = day
  }

  show(session: Session, placeId: PlaceId): void {
    if (this.session !== session) this.reviewedEvidence.clear()
    this.session = session
    this.placeId = placeId
    this.visit++
    this.tab = 'scene'
    document.body.classList.add('investigation-active')
    this.el.hidden = false
    this.d.audio.setClock(session.clock.hour)
    this.d.audio.setPlace(placeId)
    this.render()
  }

  hide(): void {
    this.destination?.close()
    this.el.hidden = true
    document.body.classList.remove('investigation-active')
  }

  markEvidenceReviewed(id: EvidenceId): void {
    this.reviewedEvidence.add(id)
    if (!this.el.hidden) this.render()
  }

  refresh(): void {
    if (!this.el.hidden) this.render()
  }

  updateWorldTime(): void {
    if (this.session) applyWorldTime(this.session.clock.hour, PLACES[this.placeId].district, partsOf(this.session.clock.stamp).day)
  }

  /** Close the map or the mobile sheet; true if something was closed (Android back button). */
  back(): boolean {
    if (this.el.hidden) return false
    if (this.destination?.open) { this.destination.close(); return true }
    if (this.tab === 'map') {
      this.setTab('scene')
      return true
    }
    if (this.drawerOpen && !window.matchMedia?.(WIDE).matches) {
      this.toggleDrawer(false)
      return true
    }
    return false
  }

  get destinationOpen(): boolean { return this.destination?.open ?? false }

  setTab(tab: InvestigationTab): void {
    if (this.el.hidden) return
    this.tab = tab
    this.d.audio.play(tab === 'map' ? 'drawer' : 'ui')
    this.render()
  }

  /** Called by the travel hotspot handler after the case engine has applied its effects. */
  setPlace(placeId: PlaceId): void {
    const next = PLACES[placeId]
    if (!next || !this.session) return
    this.placeId = placeId
    this.visit++
    this.tab = 'scene'
    this.d.audio.play('travel')
    this.d.audio.setPlace(placeId)
    this.d.onPlaceChange(placeId)
    this.render()
  }

  /** A card flies from the scene into the case-file button when evidence is found. */
  celebrate(evidence: Evidence): void {
    if (this.el.hidden) return
    const target = [...this.el.querySelectorAll<HTMLElement>('.inv-file-btn')].find(b => b.offsetParent !== null)
    if (document.body.classList.contains('reduced-motion')) {
      target?.classList.add('bump')
      window.setTimeout(() => target?.classList.remove('bump'), 700)
      return
    }
    const art = evidenceUrl(evidence.id)
    const card = h('div', { class: 'inv-fly-card', role: 'presentation' },
      art && h('img', { src: art, alt: '', loading: 'lazy', decoding: 'async' }),
      h('div', null, h('small', null, 'دليل جديد'), h('b', null, evidence.title)))
    const from = this.el.querySelector<HTMLElement>('.inv-stage')?.getBoundingClientRect()
    card.style.left = `${from ? from.left + from.width / 2 : window.innerWidth / 2}px`
    card.style.top = `${from ? from.top + from.height / 2 : window.innerHeight / 2}px`
    document.body.append(card)
    requestAnimationFrame(() => card.classList.add('in'))
    window.setTimeout(() => {
      const to = target?.getBoundingClientRect()
      if (to) {
        card.style.left = `${to.left + to.width / 2}px`
        card.style.top = `${to.top + to.height / 2}px`
      }
      card.classList.add('fly')
    }, 1100)
    window.setTimeout(() => {
      card.remove()
      target?.classList.add('bump')
      window.setTimeout(() => target?.classList.remove('bump'), 700)
    }, 1800)
  }

  private selectPlace(placeId: PlaceId): void {
    const next = PLACES[placeId]
    const here = PLACES[this.placeId]
    if (!this.session || !next || next.district !== here.district) return
    this.tab = 'scene'
    if (placeId !== this.placeId) {
      this.placeId = placeId
      this.d.audio.play('travel')
      this.d.audio.setPlace(placeId)
      this.d.onPlaceChange(placeId)
    } else this.d.audio.play('ui')
    this.render()
  }

  private toggleDrawer(open = !this.drawerOpen): void {
    this.drawerOpen = open
    this.d.audio.play('drawer')
    this.el.classList.toggle('drawer-open', open)
    this.el.querySelector('.inv-drawer-toggle')?.setAttribute('aria-expanded', String(open))
  }

  private render(): void {
    const s = this.session
    if (!s) return
    const place = PLACES[this.placeId]
    this.el.dataset.place = place.id
    applyAreaTheme(place.id)
    this.el.dataset.district = place.district
    this.el.dataset.tab = this.tab
    this.el.dataset.daytime = String(isDaytime(s.clock.hour))
    this.el.classList.toggle('drawer-open', this.drawerOpen)
    const sceneKey = `${place.id}:${this.tab}`
    const entering = sceneKey !== this.lastScene
    this.lastScene = sceneKey
    setChildren(this.el,
      this.header(s, place),
      h('div', { class: 'inv-body' },
        h('section', { class: `inv-stage${entering ? ' entering' : ''}`, 'aria-live': 'polite' },
          ...(this.tab === 'scene' ? this.scene(s, place) : [this.mapPage(s, place)])),
        this.drawer(s, place)),
      this.mobileNav(s),
    )
    if (this.tab === 'scene') {
      this.layoutPins()
      const photo = this.el.querySelector<HTMLImageElement>('.inv-photo')
      if (photo && !photo.complete) photo.addEventListener('load', () => this.layoutPins(), { once: true })
    }
  }
  /**
   * Pins are authored as percentages of the 16:9 photograph, but the photo is cropped with
   * object-fit: cover. Map each pin onto the visible crop, keep it fully on screen, out from under
   * the guide / standees / drawer tab, and away from other pins.
   */
  private layoutPins(): void {
    const stage = this.el.querySelector<HTMLElement>('.inv-stage')
    const pins = [...this.el.querySelectorAll<HTMLElement>('.inv-pin')]
    if (!stage || pins.length === 0 || this.el.hidden) return
    const W = stage.clientWidth
    const H = stage.clientHeight
    if (!W || !H) return
    const photo = stage.querySelector<HTMLImageElement>('.inv-photo')
    const ratio = photo?.naturalWidth && photo.naturalHeight ? photo.naturalWidth / photo.naturalHeight : 16 / 9
    const scale = Math.max(W / ratio, H)
    const iw = scale * ratio
    const ih = scale
    const ox = (W - iw) / 2
    const oy = (H - ih) / 2
    const box = stage.getBoundingClientRect()
    const rel = (el: Element | null) => {
      const r = el?.getBoundingClientRect()
      return r && r.width > 0 ? { l: r.left - box.left, r: r.right - box.left, t: r.top - box.top, b: r.bottom - box.top } : undefined
    }
    const guide = rel(stage.querySelector('.inv-guide'))
    const people = rel(stage.querySelector('.inv-people'))
    const margin = 8
    const guideBelow = stage.querySelector('.inv-guide.opening') !== null
    const top = (guide && !guideBelow ? guide.b : 0) + margin
    const placed: { l: number; r: number; t: number; b: number }[] = []
    for (const pin of pins) {
      const pw = pin.offsetWidth
      const ph = pin.offsetHeight
      let x = ox + (Number(pin.dataset.x) / 100) * iw
      let y = oy + (Number(pin.dataset.y) / 100) * ih
      if (W <= 540 && pin.classList.contains('opening-thread')) {
        x = W * 0.61
        y = H * 0.55
      }
      x = Math.max(margin + pw / 2, Math.min(W - margin - pw / 2, x))
      const overlapsPeople = (cx: number) => people && cx + pw / 2 > people.l && cx - pw / 2 < people.r
      const bottom = Math.min(overlapsPeople(x) ? people!.t : H, guide && guideBelow ? guide.t : H) - margin
      y = Math.max(top + ph / 2, Math.min(bottom - ph / 2, y))
      // Nudge down (then up) until it no longer collides with an already placed pin.
      const hits = (cy: number) => placed.some(p => x - pw / 2 < p.r && x + pw / 2 > p.l && cy - ph / 2 < p.b + 4 && cy + ph / 2 > p.t - 4)
      if (hits(y)) {
        const step = ph / 2
        for (let k = 1; k < 12; k++) {
          const down = y + k * step
          const up = y - k * step
          if (down + ph / 2 <= bottom && !hits(down)) { y = down; break }
          if (up - ph / 2 >= top && !hits(up)) { y = up; break }
        }
      }
      placed.push({ l: x - pw / 2, r: x + pw / 2, t: y - ph / 2, b: y + ph / 2 })
      pin.style.left = `${Math.round(x)}px`
      pin.style.top = `${Math.round(y)}px`
    }
  }

  private header(s: Session, place: Place): HTMLElement {
    const found = s.state.evidence.size
    const map = this.tab === 'map'
    const mail = this.d.mailCount ? this.d.mailCount() : 0
    return h('header', { class: 'inv-header' },
      h('div', { class: 'inv-where' },
        h('small', null, DISTRICT_NAME[place.district], this.clockEl),
        h('b', null, place.name)),
      h('nav', { class: 'inv-actions', 'aria-label': 'أوامر التحقيق' },
        h('button', { class: `inv-act inv-nav-btn${!map ? ' active' : ''}`, 'aria-pressed': String(!map), onclick: () => this.setTab('scene') },
          h('span', { class: 'ico', 'aria-hidden': true }, '◉'), h('span', null, 'المشهد')),
        h('button', { class: `inv-act inv-nav-btn${map ? ' active' : ''}`, 'aria-pressed': String(map), onclick: () => this.setTab('map') },
          h('span', { class: 'ico', 'aria-hidden': true }, '◫'), h('span', null, 'الخريطة'), h('kbd', null, 'M')),
        h('button', { class: 'inv-act inv-file-btn', onclick: this.d.onCaseFile },
          h('span', { class: 'ico', 'aria-hidden': true }, '▤'), h('span', null, 'ملف القضية'),
          h('em', { class: 'inv-badge', 'aria-label': `${found} دليل` }, arabicDigits(found))),
        mail > 0 && h('button', { class: 'inv-act inv-file-btn', onclick: this.d.onMail },
          h('span', { class: 'ico', 'aria-hidden': true }, '✉'), h('span', null, 'الجوابات'),
          h('em', { class: 'inv-badge' }, arabicDigits(mail))),
        h('button', { class: 'inv-act', onclick: this.d.onHint },
          h('span', { class: 'ico', 'aria-hidden': true }, '✦'), h('span', null, 'تلميح'), h('kbd', null, 'H')),
        h('button', { class: 'inv-act inv-pause-action', 'aria-label': 'القائمة', onclick: this.d.onPause },
          h('span', { class: 'ico', 'aria-hidden': true }, '☰'), h('span', { class: 'lbl' }, 'القائمة'))))
  }

  // ---- Scene -----------------------------------------------------------------------------------------------------
  private scene(s: Session, place: Place): (HTMLElement | false)[] {
    const active = s.engine.activeHotspots().filter(hotspot => hotspot.place === place.id)
    const people = CHARACTER_LIST.filter(c => c.id !== 'yassin' && c.place === place.id && s.present(c))
    const hour = s.clock.hour
    const opening = s.caseId === 'case01' && place.id === 'mahmoud_house' && !s.state.flags.has('zeinab_talked')
    const voicemail = opening ? active.find(hotspot => hotspot.id === 'hs_mahmoud_voicemail') : undefined
    const pins = active.filter(hotspot => hotspot !== voicemail)
    return [
      ...sceneNeighbors(place.id).map(id => h('link', {
        rel: 'preload', as: 'image', href: sceneUrl(id, hour), imagesrcset: sceneSrcSet(id, hour),
        imagesizes: '100vw', fetchpriority: 'low',
      })),
      h('img', {
        class: 'inv-photo', src: sceneUrl(place.id, hour), srcset: sceneSrcSet(place.id, hour), sizes: '100vw',
        alt: place.name, draggable: 'false', loading: 'eager', fetchpriority: 'high', decoding: 'async',
      }),
      h('div', { class: 'inv-photo-shade', 'aria-hidden': true }),
      this.guide(s, place, active.length + people.length, opening, voicemail),
      h('div', { class: 'inv-pins' }, pins.map((hotspot, i) => this.pin(hotspot, i, pins.length))),
      people.length > 0 && h('div', { class: 'inv-people', role: 'group', 'aria-label': 'الموجودين هنا' },
        people.map(c => this.person(s, c))),
      active.length === 0 && people.length === 0
        && h('p', { class: 'inv-quiet' }, 'المكان هادي دلوقتي ومفيش أثر جديد. بص على الخطوة الجاية فوق.'),
    ]
  }

  /** The single source of "what do I do now" guidance. */
  private guide(s: Session, place: Place, things: number, opening: boolean, voicemail?: Hotspot): HTMLElement {
    const objective = s.engine.currentObjective()
    if (!objective) {
      return h('div', { class: 'inv-guide done' },
        h('span', { class: 'inv-guide-mark', 'aria-hidden': true }, '✓'),
        h('div', { class: 'inv-guide-copy' }, h('small', null, 'الخطوة الجاية'), h('b', null, 'افتح ملف القضية واربط الخيوط')),
        h('button', { class: 'inv-guide-go', onclick: this.d.onCaseFile }, 'الملف', h('span', { 'aria-hidden': true }, '←')))
    }
    const thread = opening && s.state.evidence.has('e_thread_door') ? s.engine.evidenceInfo('e_thread_door') : undefined
    const threadArt = thread && evidenceUrl(thread.id)
    const target = objective.place ? PLACES[objective.place] : undefined
    let action: HTMLElement | false = false
    let where = objective.detail
    if (target && target.id !== place.id) {
      if (target.district === place.district) {
        where = `المكان: ${target.name}`
        action = h('button', { class: 'inv-guide-go', onclick: () => this.selectPlace(target.id) }, `روح ${target.short}`, h('span', { 'aria-hidden': true }, '←'))
      } else {
        const stop = PLACES[STOPS[place.district]]
        where = `في ${target.district === 'city' ? 'إسكندرية' : 'أبيس'}: ${target.name}. اركب من ${stop.short}.`
        if (place.id !== stop.id) action = h('button', { class: 'inv-guide-go', onclick: () => this.selectPlace(stop.id) }, `روح ${stop.short}`, h('span', { 'aria-hidden': true }, '←'))
      }
    } else if (target && things > 0 && !opening) {
      where = 'انت في المكان الصح. افحص العلامات أو كلّم اللي موجود.'
    }
    return h('div', { class: `inv-guide${opening ? ' opening' : ''}` },
      h('span', { class: 'inv-guide-mark', 'aria-hidden': true }, '⌖'),
      h('div', { class: 'inv-guide-copy' },
        h('small', null, 'الخطوة الجاية'),
        h('b', null, objective.title),
        h('span', null, where),
        thread && h('div', { class: 'inv-opening-evidence', role: 'status' },
          threadArt && h('img', { src: threadArt, alt: '', decoding: 'async' }),
          h('div', null, h('small', null, 'الدليل اتسجل'), h('b', null, thread.title),
            thread.question && h('span', null, thread.question.text)))),
      h('div', { class: 'inv-guide-actions' },
        voicemail && h('button', { class: 'inv-guide-go inv-voicemail', onclick: () => this.d.onHotspot(voicemail) },
          h('span', { 'aria-hidden': true }, '▶'), voicemail.label),
        action))
  }

  private pin(hotspot: Hotspot, index: number, count: number): HTMLButtonElement {
    const fixed = PIN_POS[hotspot.id]
    const spread = count > 1 ? (index - (count - 1) / 2) * 20 : 0
    const left = fixed?.x ?? Math.max(14, Math.min(86, 50 + hotspot.offset.x * 3 + spread))
    const top = fixed?.y ?? Math.max(34, Math.min(62, 50 + hotspot.offset.z * 0.6))
    const thread = hotspot.id === 'hs_door_thread'
    const voicemail = hotspot.id === 'hs_mahmoud_voicemail'
    const label = voicemail ? 'اسمع' : KIND_LABEL[hotspot.kind]
    return h('button', {
      class: `inv-pin kind-${hotspot.kind}${left > 60 ? ' label-start' : ''}${thread ? ' opening-thread' : ''}${voicemail ? ' voicemail' : ''}`,
      style: { left: `${left}%`, top: `${top}%`, '--i': String(index) },
      'data-x': String(left), 'data-y': String(top),
      'aria-label': `${label}: ${hotspot.label}`,
      onclick: () => { this.d.audio.play('pin'); this.d.onHotspot(hotspot) },
    },
    h('span', { class: 'inv-pin-dot', 'aria-hidden': true }, voicemail ? '▶' : KIND_ICON[hotspot.kind]),
    h('span', { class: 'inv-pin-label' }, h('small', null, label), h('b', null, hotspot.label)))
  }

  private person(s: Session, c: CharacterProfile): HTMLElement {
    const src = portraitUrl(c.id)
    const met = s.state.flags.has(`met_${c.id}`)
    return h('button', { class: 'inv-person', onclick: () => this.d.onTalk(c.id), 'aria-label': `كلّم ${c.nickname ?? c.name}` },
      h('span', { class: 'inv-person-art', style: { '--accent': c.figure.accent, '--body': c.figure.body } },
        src ? h('img', { src, alt: '', draggable: 'false', loading: 'lazy', decoding: 'async' }) : h('span', { class: 'inv-person-initial' }, initial(c.name))),
      h('span', { class: 'inv-person-copy' },
        h('b', null, c.nickname ?? c.name),
        h('small', null, c.role),
        h('i', null, h('span', { 'aria-hidden': true }, '☏ '), met ? 'كمّل الكلام' : 'كلّمه')))
  }

  // ---- Map ---------------------------------------------------------------------------------------------------------
  private mapPage(s: Session, place: Place): HTMLElement {
    const districtPlaces = PLACE_LIST.filter(p => p.district === place.district)
    const goal = s.engine.currentObjective()?.place
    return h('div', { class: 'inv-map' },
      h('div', { class: 'inv-map-head' },
        h('h2', null, place.district === 'abis' ? 'خريطة أبيس' : 'خريطة الإسكندرية'),
        h('p', null, 'اختار مكان تروحه. السفر بين أبيس وإسكندرية بيبقى من موقف الميكروباص.')),
      h('div', { class: 'inv-map-switch', role: 'group', 'aria-label': 'نوع الخريطة' },
        h('button', { class: this.mapKind === 'real' ? 'on' : '', type: 'button', onclick: () => { this.mapKind = 'real'; this.render() } }, 'خريطة حقيقية'),
        h('button', { class: this.mapKind === 'drawn' ? 'on' : '', type: 'button', onclick: () => { this.mapKind = 'drawn'; this.render() } }, 'خريطة مرسومة')),
      this.mapKind === 'real' && RealMap.available() ? this.realMap.show(place.id, s.clock.hour) : this.mapSvg(districtPlaces, place, goal),
      h('div', { class: 'inv-map-list' }, districtPlaces.map(p => {
        const here = p.id === place.id
        const isGoal = p.id === goal
        return h('button', {
          class: `inv-map-card${here ? ' here' : ''}${isGoal ? ' goal' : ''}`,
          'aria-current': here ? 'location' : undefined,
          onclick: () => this.previewPlace(p.id),
        },
        h('img', { src: sceneUrl(p.id, s.clock.hour), srcset: sceneSrcSet(p.id, s.clock.hour), sizes: '220px', alt: '', loading: 'lazy', decoding: 'async' }),
        h('span', null, h('b', null, p.name), h('small', null, here ? 'انت هنا' : isGoal ? 'الخطوة الجاية هنا' : p.short)))
      })))
  }

  private previewPlace(id: PlaceId): void {
    const session = this.session
    const place = PLACES[id]
    if (this.destinationOpen || !session || place.district !== PLACES[this.placeId].district) return
    const here = id === this.placeId
    const dialog = h('dialog', { class: 'inv-destination', 'aria-labelledby': 'inv-destination-name' },
      h('img', { src: sceneUrl(id, session.clock.hour), srcset: sceneSrcSet(id, session.clock.hour), sizes: '420px', alt: '' }),
      h('div', { class: 'inv-destination-copy' },
        h('small', null, here ? 'إنت هنا' : 'الوجهة المختارة'),
        h('h3', { id: 'inv-destination-name' }, place.name),
        h('div', { class: 'inv-destination-actions' },
          h('button', { class: 'btn ghost', onclick: () => dialog.close() }, 'رجوع للخريطة'),
          h('button', { class: 'btn primary', onclick: () => { dialog.close(); this.selectPlace(id) } }, here ? 'ارجع للمشهد' : 'روح المكان'))))
    dialog.addEventListener('close', () => {
      if (this.destination === dialog) this.destination = undefined
      dialog.remove()
    }, { once: true })
    this.destination = dialog
    this.el.after(dialog)
    dialog.showModal()
  }

  private mapSvg(places: Place[], current: Place, goal?: PlaceId): SVGSVGElement {
    const W = 760
    // A crowded district (the village has ~19 places) gets a taller canvas so pins and labels breathe.
    const H = places.length > 10 ? 470 : 280
    const xs = places.map(p => p.pos.x)
    const zs = places.map(p => p.pos.z)
    const minX = Math.min(...xs) - 35
    const maxX = Math.max(...xs) + 35
    const minZ = Math.min(...zs) - 25
    const maxZ = Math.max(...zs) + 25
    const px = (x: number) => 42 + ((x - minX) / Math.max(1, maxX - minX)) * (W - 84)
    const py = (z: number) => 44 + ((z - minZ) / Math.max(1, maxZ - minZ)) * (H - 80)
    const root = svg('svg', { class: `inv-map-svg ${current.district}${places.length > 10 ? ' dense' : ''}`, viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': 'الخريطة' })
    // Canal / railway strokes run edge to edge; clip them to the rounded card so they never poke out of it.
    const clipId = `inv-map-clip-${current.district}`
    const clip = svg('clipPath', { id: clipId })
    clip.append(svg('rect', { x: 0, y: 0, width: W, height: H, rx: 12 }))
    const defs = svg('defs', {})
    defs.append(clip)
    root.append(defs)
    root.append(svg('rect', { x: 0, y: 0, width: W, height: H, class: 'inv-map-bg', rx: 12 }))
    const terrain = svg('g', { 'clip-path': `url(#${clipId})` })
    root.append(terrain)
    const byId = new Map(places.map(p => [p.id, p]))
    if (current.district === 'city') {
      terrain.append(svg('path', { d: `M0 0 H${W} V${H * 0.18} C${W * 0.7} ${H * 0.26}, ${W * 0.4} ${H * 0.13}, 0 ${H * 0.22} Z`, class: 'inv-map-sea' }))
    } else {
      // The canal runs through the places that sit on its bank (bridge, waterwheel, pump); the railway crosses it.
      const bank = (['canal_bridge', 'waterwheel', 'pump_station'] as PlaceId[]).map(id => byId.get(id)).filter((p): p is Place => !!p)
      const cy = bank.length ? bank.reduce((t, p) => t + py(p.pos.z), 0) / bank.length + 14 : H * 0.45
      terrain.append(svg('path', { d: `M0 ${cy + 8} C${W * 0.22} ${cy - 10}, ${W * 0.34} ${cy + 14}, ${W * 0.57} ${cy + 2} S${W * 0.82} ${cy - 10}, ${W} ${cy + 6}`, class: 'inv-map-canal' }))
      const rail = byId.get('rail_crossing')
      if (rail) {
        const rx = px(rail.pos.x)
        const d = `M${rx + 46} 0 L${rx - 30} ${H}`
        terrain.append(svg('path', { d, class: 'inv-map-rail' }))
        terrain.append(svg('path', { d, class: 'inv-map-rail-ties' }))
      }
    }
    // Roads: a minimum spanning tree over the pins reads like a village path network instead of a zig-zag.
    const pts = places.map(p => ({ id: p.id, x: px(p.pos.x), y: py(p.pos.z) }))
    const inTree = new Set([0])
    const roads: string[] = []
    while (inTree.size < pts.length) {
      let best: [number, number, number] = [Infinity, -1, -1]
      for (const i of inTree) {
        for (let j = 0; j < pts.length; j++) {
          if (inTree.has(j)) continue
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
          if (d < best[0]) best = [d, i, j]
        }
      }
      inTree.add(best[2])
      roads.push(`M${pts[best[1]].x} ${pts[best[1]].y} L${pts[best[2]].x} ${pts[best[2]].y}`)
    }
    root.append(svg('path', { d: roads.join(' '), class: 'inv-map-route' }))
    // Labels: greedy placement (current + goal first) trying above/below/sides until nothing overlaps.
    type Box = { x1: number, y1: number, x2: number, y2: number }
    const taken: Box[] = pts.map(p => ({ x1: p.x - 12, y1: p.y - 12, x2: p.x + 12, y2: p.y + 12 }))
    const hit = (b: Box) => b.x1 < 4 || b.x2 > W - 4 || b.y1 < 4 || b.y2 > H - 4 || taken.some(t => b.x1 < t.x2 && b.x2 > t.x1 && b.y1 < t.y2 && b.y2 > t.y1)
    const labelFor = (p: Place) => p.id === current.id ? `${p.short} (انت هنا)` : p.short
    const order = [...places].sort((a, b) => Number(b.id === current.id) - Number(a.id === current.id) || Number(b.id === goal) - Number(a.id === goal))
    const placement = new Map<PlaceId, { dx: number, dy: number, anchor: string }>()
    for (const p of order) {
      const x = px(p.pos.x)
      const y = py(p.pos.z)
      const w = labelFor(p).length * 9.6 + 10
      const hgt = 22
      const options = [
        { dx: 0, dy: -18, anchor: 'middle', box: { x1: x - w / 2, y1: y - 18 - hgt + 5, x2: x + w / 2, y2: y - 13 } },
        { dx: 0, dy: 32, anchor: 'middle', box: { x1: x - w / 2, y1: y + 13, x2: x + w / 2, y2: y + 13 + hgt } },
        { dx: 16, dy: 6, anchor: 'start', box: { x1: x + 14, y1: y - hgt / 2, x2: x + 14 + w, y2: y + hgt / 2 } },
        { dx: -16, dy: 6, anchor: 'end', box: { x1: x - 14 - w, y1: y - hgt / 2, x2: x - 14, y2: y + hgt / 2 } },
        { dx: 0, dy: -40, anchor: 'middle', box: { x1: x - w / 2, y1: y - 40 - hgt + 5, x2: x + w / 2, y2: y - 35 } },
        { dx: 0, dy: 54, anchor: 'middle', box: { x1: x - w / 2, y1: y + 35, x2: x + w / 2, y2: y + 35 + hgt } },
      ]
      const pick = options.find(o => !hit(o.box)) ?? options[0]
      taken.push(pick.box)
      placement.set(p.id, pick)
    }
    for (const p of places) {
      const cls = `inv-map-pin${p.id === current.id ? ' current' : ''}${p.id === goal ? ' goal' : ''}`
      const g = svg('g', { class: cls, transform: `translate(${px(p.pos.x)} ${py(p.pos.z)})`, tabindex: '0', role: 'button',
        'aria-current': p.id === current.id ? 'location' : 'false', 'aria-label': p.id === goal ? `${p.name}، الخطوة الجاية` : p.name })
      // Generous invisible hit area: the visible dot is small on phones once the SVG scales down.
      g.append(svg('circle', { r: places.length > 10 ? 26 : 42, class: 'pin-hit' }))
      if (p.id === goal) g.append(svg('circle', { r: 19, class: 'pin-goal' }))
      g.append(svg('circle', { r: p.id === current.id ? 12 : 9, class: 'pin-halo' }))
      g.append(svg('circle', { r: p.id === current.id ? 5 : 4, class: 'pin-dot' }))
      const pl = placement.get(p.id)!
      const label = svg('text', { x: pl.dx, y: pl.dy, 'text-anchor': pl.anchor, class: 'pin-label' })
      label.textContent = labelFor(p)
      g.append(label)
      g.addEventListener('click', () => this.previewPlace(p.id))
      g.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.previewPlace(p.id) }
      })
      root.append(g)
    }
    return root
  }
  // ---- Drawer ------------------------------------------------------------------------------------------------------
  private drawer(s: Session, place: Place): HTMLElement {
    const file = s.engine.file
    const found = s.state.evidence.size
    const total = file.evidence.length
    const foundHere = file.evidence.filter(e => e.place === place.id && s.engine.has(e.id))
    const recent = file.evidence.filter(e => s.engine.has(e.id)).slice(-3).reverse()
    const objectives = s.engine.objectives()
    const done = objectives.filter(o => o.done).length
    const meter = (label: string, a: number, b: number) => h('div', { class: 'inv-meter' },
      h('span', null, label), h('b', null, `${arabicDigits(a)} من ${arabicDigits(b)}`),
      h('i', { class: 'track' }, h('i', { style: { width: `${Math.round((a / Math.max(1, b)) * 100)}%` } })))
    return h('aside', { class: 'inv-drawer', 'aria-label': 'تفاصيل المكان والقضية' },
      h('button', { class: 'inv-drawer-toggle', 'aria-expanded': String(this.drawerOpen), onclick: () => this.toggleDrawer() },
        h('span', { class: 'grip', 'aria-hidden': true }), h('span', null, 'التفاصيل'), h('span', { class: 'chev', 'aria-hidden': true }, '›')),
      h('div', { class: 'inv-drawer-body' },
        h('section', null,
          h('small', null, 'عن المكان'),
          h('p', null, place.description),
          foundHere.length > 0 && h('div', { class: 'inv-chips' }, foundHere.map(e => h('span', { class: `chip kind-${e.kind}` }, e.title)))),
        h('section', null,
          h('small', null, `القضية ${file.number} • ${file.title}`),
          meter('الأدلة', found, total),
          meter('المهام', done, objectives.length)),
        h('section', null,
          h('small', null, 'آخر الأدلة'),
          recent.length
            ? h('ul', { class: 'inv-recent' }, recent.map(e => h('li', null, h('span', { class: `dot kind-${e.kind}`, 'aria-hidden': true }), e.title)))
            : h('p', { class: 'muted' }, 'لسه مفيش أدلة. افحص العلامات اللي على الصورة.')),
        h('button', { class: 'inv-d-open', onclick: this.d.onCaseFile }, 'افتح ملف القضية ولوحة الخيوط', h('span', { 'aria-hidden': true }, '←'))))
  }

  private mobileNav(s: Session): HTMLElement {
    const found = s.state.evidence.size
    const mail = this.d.mailCount ? this.d.mailCount() : 0
    return h('nav', { class: 'inv-mobile-nav', 'aria-label': 'اختصارات التحقيق' },
      h('button', { class: this.tab === 'scene' ? 'on' : '', onclick: () => this.setTab('scene') }, h('span', { class: 'ico', 'aria-hidden': true }, '◉'), h('span', null, 'المشهد')),
      h('button', { class: this.tab === 'map' ? 'on' : '', onclick: () => this.setTab('map') }, h('span', { class: 'ico', 'aria-hidden': true }, '◫'), h('span', null, 'الخريطة')),
      h('button', { class: 'inv-file-btn', onclick: this.d.onCaseFile }, h('span', { class: 'ico', 'aria-hidden': true }, '▤'), h('span', null, 'الملف'), found > 0 && h('em', { class: 'inv-badge' }, arabicDigits(found))),
      mail > 0 && h('button', { class: 'inv-file-btn', onclick: this.d.onMail }, h('span', { class: 'ico', 'aria-hidden': true }, '✉'), h('span', null, 'الجوابات'), h('em', { class: 'inv-badge' }, arabicDigits(mail))),
      h('button', { onclick: this.d.onHint }, h('span', { class: 'ico', 'aria-hidden': true }, '✦'), h('span', null, 'تلميح')),
      h('button', { onclick: this.d.onPause }, h('span', { class: 'ico', 'aria-hidden': true }, '☰'), h('span', null, 'القائمة')))
  }
}
