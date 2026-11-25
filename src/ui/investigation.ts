import { arabicDigits } from '../core/clock'
import { CHARACTER_LIST } from '../data/characters'
import { PLACES, PLACE_LIST } from '../data/places'
import type { CharacterId, EvidenceId, Hotspot, Objective, Place, PlaceId } from '../data/types'
import type { Audio } from '../engine/audio'
import type { Session } from '../game/session'
import { h, setChildren, svg } from './dom'
import { ambientLayer, applyAreaTheme, themeOf } from './worldFx'
import { applyWorldTime, rainLayer } from './extras'
import { MAP_GLYPH, RealMap } from './realMap'
import { partsOf } from '../core/clock'
import { CHARACTER_ART, EVIDENCE_ART, HOTSPOT_ANCHORS, MAHMOUD_STUDY, SCENE_ART } from './visualAssets'

export type InvestigationTab = 'scene' | 'map'

export type InvestigationDeps = {
  audio: Audio
  onHotspot: (hotspot: Hotspot) => void
  onTalk: (characterId: CharacterId) => void
  onPlaceChange: (placeId: PlaceId) => void
  onCaseFile: () => void
  onHint: () => void
  onPause: () => void
  onMail: () => void
  onMute: () => void
  onFarPlace: (id: PlaceId) => void
  onTextSize: () => void
  isMuted: () => boolean
  onHelp: () => void
  mailCount: () => number
}

const KIND_LABEL: Record<Hotspot['kind'], string> = {
  inspect: 'فحص ميداني', photo: 'صورة موقع', travel: 'انتقال', rest: 'استراحة',
}
const CONVERSATION_OBJECTIVE = /كلّم|اسأل|واجه/

export class InvestigationView {
  readonly el: HTMLElement
  private session?: Session
  private placeId: PlaceId = 'zeinab_home'
  private tab: InvestigationTab = 'scene'
  private visit = 0
  private drawerOpen = false
  private moved = false
  private mapKind: 'real' | 'drawn' = 'real'
  private readonly realMap = new RealMap({
    onSelect: id => this.selectPlace(id),
    onFar: id => this.d.onFarPlace(id),
    onUnavailable: () => { if (this.mapKind === 'real') { this.mapKind = 'drawn'; if (this.tab === 'map') this.render() } },
  })
  private readonly reviewedEvidence = new Set<EvidenceId>()

  constructor(private readonly d: InvestigationDeps) {
    this.el = h('main', { class: 'investigation', hidden: true, 'aria-label': 'واجهة التحقيق ثنائية الأبعاد' })
    // Gentle pointer parallax on the scene photo (desktop only; CSS ignores it when motion is reduced).
    let frame = 0
    this.el.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const art = this.el.querySelector<HTMLElement>('.inv-scene-art')
        if (!art) return
        const r = art.getBoundingClientRect()
        art.style.setProperty('--px', (((e.clientX - r.left) / r.width - .5) * 2).toFixed(3))
        art.style.setProperty('--py', (((e.clientY - r.top) / r.height - .5) * 2).toFixed(3))
      })
    })
  }

  get currentPlace(): PlaceId {
    return this.placeId
  }

  get currentTab(): InvestigationTab {
    return this.tab
  }

  show(session: Session, placeId: PlaceId): void {
    if (this.session !== session) this.reviewedEvidence.clear()
    this.session = session
    this.placeId = placeId
    this.visit++
    this.tab = 'scene'
    document.body.classList.add('investigation-active')
    this.el.hidden = false
    this.render()
  }

  hide(): void {
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

  setTab(tab: InvestigationTab): void {
    if (this.el.hidden) return
    this.tab = tab
    this.d.audio.play('ui')
    this.render()
  }

  /** Called by the travel hotspot handler after the case engine has applied its effects. */
  setPlace(placeId: PlaceId): void {
    const next = PLACES[placeId]
    if (!next || !this.session) return
    this.placeId = placeId
    this.visit++
    this.moved = true
    this.tab = 'scene'
    this.d.audio.play('travel')
    this.d.onPlaceChange(placeId)
    this.render()
  }

  private selectPlace(placeId: PlaceId): void {
    const next = PLACES[placeId]
    const here = PLACES[this.placeId]
    if (!this.session || !next || next.district !== here.district) return
    if (placeId === this.placeId) {
      this.tab = 'scene'
      this.d.audio.play('ui')
      this.render()
      return
    }
    this.placeId = placeId
    this.visit++
    this.moved = true
    this.tab = 'scene'
    this.d.audio.play('ui')
    this.d.onPlaceChange(placeId)
    this.render()
  }

  private goToObjective(objective?: Objective): void {
    if (!objective?.place) {
      this.d.onCaseFile()
      return
    }
    const target = PLACES[objective.place]
    const here = PLACES[this.placeId]
    if (target.district !== here.district) {
      const stop: PlaceId = here.district === 'abis' ? 'abis_stop' : 'raml_stop'
      this.selectPlace(stop)
      this.scrollTo('.inv-interactions')
      return
    }
    this.selectPlace(target.id)
    this.scrollTo(CONVERSATION_OBJECTIVE.test(objective.title) ? '.inv-people' : '.inv-interactions')
  }

  private scrollTo(selector: string): void {
    window.requestAnimationFrame(() => {
      this.el.querySelector(selector)?.scrollIntoView({ behavior: document.body.classList.contains('reduced-motion') ? 'auto' : 'smooth', block: 'center' })
    })
  }

  private newEvidenceCount(): number {
    if (!this.session) return 0
    return this.session.engine.file.evidence.filter(e => this.session!.engine.has(e.id) && !this.reviewedEvidence.has(e.id)).length
  }

  private render(): void {
    const s = this.session
    if (!s) return
    const place = PLACES[this.placeId]
    this.el.dataset.place = place.id
    applyAreaTheme(place.id)
    this.el.dataset.district = place.district
    setChildren(this.el,
      h('div', { class: 'inv-frame' },
        this.header(place),
        h('div', { class: 'inv-layout' },
          h('section', { class: 'inv-main-panel', 'aria-live': 'polite' }, this.tab === 'scene' ? this.scenePage(s, place) : this.mapPage(place)),
          this.sidebar(s, place)),
        this.mobileNav()),
    )
    this.updateWorldTime()
    this.moved = false
  }
  /** Day/night + weather from the story clock (called on render and by a slow timer). */
  updateWorldTime(): void {
    const s = this.session
    if (!s || this.el.hidden) return
    applyWorldTime(s.clock.hour, PLACES[this.placeId].district, partsOf(s.clock.stamp).day)
  }
  /** The thing the next objective points at in this scene (pin, hotspot card or person). */
  private guideTarget(place: Place, active: Hotspot[], people: { id: CharacterId; name: string; nickname?: string }[], current?: Objective): { kind: 'pin' | 'person'; id: string } | undefined {
    if (!current || current.place !== place.id) return undefined
    if (CONVERSATION_OBJECTIVE.test(current.title)) {
      const strip = (t: string) => t.replace(/^(ال|عم |المعلم |الحاجة |ستّك )/, '')
      const who = people.find(c => current.title.includes(strip(c.nickname ?? c.name)) || current.title.includes(strip(c.name))) ?? people[0]
      return who ? { kind: 'person', id: who.id } : undefined
    }
    const d = current.doneWhen
    const hit = active.find(hs => hs.effects?.some(ef => (ef.type === 'evidence' && d.evidence?.includes(ef.id)) || (ef.type === 'flag' && d.flags?.includes(ef.id))))
      ?? active.find(hs => hs.kind !== 'travel') ?? active[0]
    return hit ? { kind: 'pin', id: hit.id } : undefined
  }

  /** Small progress ring: how much of the case file is collected. */
  private ring(): HTMLElement {
    const s = this.session
    const pct = s ? Math.round((s.state.evidence.size / Math.max(1, s.engine.file.evidence.length)) * 100) : 0
    return h('span', { class: 'inv-ring', style: { '--p': `${pct}%` }, role: 'img', 'aria-label': `اكتمل ${arabicDigits(pct)}٪ من الأدلة` }, h('b', null, arabicDigits(pct)))
  }
  private header(place: Place): HTMLElement {
    return h('header', { class: 'inv-header' },
      h('div', { class: 'inv-brand' },
        this.ring(),
        h('div', null,
          h('small', null, 'ملف تحقيق • القضية ٠١'),
          h('b', null, 'الخيط الأخير'))),
      h('div', { class: 'inv-current' },
        h('small', null, place.district === 'abis' ? 'أبيس • عزبة ١٥' : 'الإسكندرية'),
        h('b', null, place.name)),
      h('nav', { class: 'inv-nav', 'aria-label': 'التنقّل في التحقيق' },
        h('button', { class: `inv-nav-btn${this.tab === 'scene' ? ' active' : ''}`, 'aria-current': this.tab === 'scene' ? 'page' : undefined, onclick: () => this.setTab('scene') }, 'المشهد'),
        h('button', { class: `inv-nav-btn${this.tab === 'map' ? ' active' : ''}`, 'aria-current': this.tab === 'map' ? 'page' : undefined, onclick: () => this.setTab('map') }, 'خريطة المواقع')),
      h('div', { class: 'inv-header-actions' },
        h('button', { class: `inv-action-btn inv-quick${this.d.isMuted() ? ' off' : ''}`, 'aria-label': this.d.isMuted() ? 'شغّل الصوت' : 'اكتم الصوت', 'aria-pressed': String(this.d.isMuted()), onclick: this.d.onMute }, '♪'),
        h('button', { class: 'inv-action-btn inv-quick', 'aria-label': 'غيّر حجم الخط', onclick: this.d.onTextSize }, 'أ+'),
        h('button', { class: 'inv-action-btn inv-mail-action', 'aria-label': 'الجوابات', onclick: this.d.onMail }, h('span', { 'aria-hidden': true }, '✉ '), 'الجوابات', this.d.mailCount() > 0 && h('b', { class: 'inv-mail-count' }, arabicDigits(this.d.mailCount()))),
        h('button', { class: 'inv-action-btn inv-help-action', 'aria-label': 'إزاي ألعب', onclick: this.d.onHelp }, '؟'),
        h('button', { class: 'inv-action-btn inv-file-action', onclick: this.d.onCaseFile }, 'ملف القضية'),
        h('button', { class: 'inv-action-btn', 'aria-label': 'تلميح', onclick: this.d.onHint }, 'تلميح'),
        h('button', { class: 'inv-action-btn inv-pause-action', 'aria-label': 'إيقاف مؤقت', onclick: this.d.onPause }, 'إيقاف')))
  }

  private scenePage(s: Session, place: Place): HTMLElement {
    const active = s.engine.activeHotspots().filter(hotspot => hotspot.place === place.id)
    const people = CHARACTER_LIST.filter(c => c.id !== 'yassin' && c.place === place.id && s.present(c))
    const current = s.engine.currentObjective()
    const foundHere = s.engine.file.evidence.filter(e => e.place === place.id && s.engine.has(e.id))
    const consumed = s.engine.file.hotspots.filter(hotspot => hotspot.place === place.id && hotspot.consumable && s.state.hotspots.has(hotspot.id))
    const visual = place.id === 'mahmoud_house' && s.state.flags.has('has_key') ? MAHMOUD_STUDY : SCENE_ART[place.id]
    const target = this.guideTarget(place, active, people, current)
    const art = h('div', { class: `inv-scene-art${this.moved ? ' enter' : ''}${visual.contain ? ' inv-scene-contain' : ''}` },
      h('picture', null,
        visual.mobileSrc && h('source', { media: '(max-width: 560px)', srcset: visual.mobileSrc }),
        h('img', { class: 'inv-scene-photo', src: visual.src, alt: visual.alt, draggable: 'false', decoding: 'async', fetchpriority: 'high' })),
      h('div', { class: 'inv-scene-shade', 'aria-hidden': true }),
      h('div', { class: 'inv-scene-wash', 'aria-hidden': true }),
      ambientLayer(place.id),
      h('div', { class: 'inv-tod', 'aria-hidden': true }),
      rainLayer(),
      h('span', { class: 'inv-tod-chip', 'aria-hidden': true }),
      h('div', { class: 'inv-scene-grain', 'aria-hidden': true }),
      h('div', { class: 'inv-scene-stamp' }, `سجل ميداني • ${arabicDigits(PLACE_LIST.findIndex(p => p.id === place.id) + 1)}`),
      h('span', { class: 'inv-scene-mood' }, visual.mood),
        h('div', { class: 'inv-scene-caption' },
          h('small', null, place.district === 'abis' ? 'أبيس / عزبة ١٥' : 'الإسكندرية'),
          h('b', null, place.name),
        h('span', null, active.length ? `${arabicDigits(active.length)} نقاط تفاعل • اضغط العلامة أو البطاقة` : 'لا توجد نقاط تفاعل متاحة')),
      visual.credit && h('a', { class: 'inv-scene-credit', href: visual.credit.href, target: '_blank', rel: 'noopener noreferrer' }, visual.credit.label),
      ...active.map((hotspot, index) => this.scenePin(hotspot, index, target?.kind === 'pin' && target.id === hotspot.id)),
      people.length > 0 && h('div', { class: 'inv-actors' }, people.map(c => {
        const next = target?.kind === 'person' && target.id === c.id
        return h('button', { class: `inv-actor${next ? ' next-target' : ''}`, 'aria-label': `كلّم ${c.nickname ?? c.name}`, onclick: () => this.d.onTalk(c.id) },
          h('span', { class: 'inv-actor-photo', style: { '--accent': c.figure.accent } }, h('img', { src: CHARACTER_ART[c.id].src, alt: '', draggable: 'false', decoding: 'async' })),
          h('b', null, c.nickname ?? c.name),
          next && h('span', { class: 'guide-arrow' }, 'كلّمه'))
      })),
    )
    return h('div', { class: 'inv-scene-page' },
      art,
      h('div', { class: `inv-drawer${this.drawerOpen ? ' open' : ''}` },
        h('button', { class: 'inv-drawer-handle', 'aria-label': 'التفاصيل', onclick: (e: Event) => { this.drawerOpen = ((e.currentTarget as HTMLElement).parentElement as HTMLElement).classList.toggle('open') } },
          h('span', { class: 'inv-drawer-grip', 'aria-hidden': true }), h('span', { class: 'inv-drawer-title' }, current ? `الخطوة الجاية: ${current.title}` : 'التفاصيل والأدلة'), h('span', { class: 'inv-drawer-chev', 'aria-hidden': true }, '⌃')),
        h('div', { class: 'inv-drawer-body' },
      h('div', { class: 'inv-field-log' },
        h('span', { class: 'inv-field-log-icon', 'aria-hidden': true }, '⌕'),
        h('div', null, h('small', null, 'ملاحظة من دفتر الميدان'), h('p', null, place.description),
          h('p', { class: 'inv-whisper' }, '— ' + themeOf(place.id).whispers[this.visit % themeOf(place.id).whispers.length])),
        h('span', { class: 'inv-field-log-code', 'aria-hidden': true }, `${place.district === 'abis' ? 'AB' : 'AX'} / ${String(PLACE_LIST.findIndex(p => p.id === place.id) + 1).padStart(2, '0')}`)),
      current && h('div', { class: 'inv-objective-strip' },
        h('span', { class: 'inv-objective-mark', 'aria-hidden': true }, '⌖'),
        h('div', null,
          h('small', null, 'الخيط التالي'), h('b', null, current.title), h('p', null, current.detail),
          current.place && PLACES[current.place].district !== place.district && h('small', { class: 'inv-route-note' },
            `الهدف في ${PLACES[current.place].district === 'abis' ? 'أبيس' : 'الإسكندرية'} • ابدأ من ${PLACES[place.district === 'abis' ? 'abis_stop' : 'raml_stop'].name}`)),
        h('button', { class: 'inv-objective-cta', onclick: () => this.goToObjective(current) },
          !current.place ? 'افتح الملف' : PLACES[current.place].district !== place.district ? 'روح لموقف الميكروباص' : current.place === place.id
            ? CONVERSATION_OBJECTIVE.test(current.title) ? 'روح للشاهد' : 'افحص الهدف' : 'اذهب للمكان',
          h('span', { 'aria-hidden': true }, '←'))),
      h('section', { class: 'inv-interactions' },
        h('div', { class: 'inv-section-heading' },
          h('div', null, h('small', null, 'افحص المكان'), h('h3', null, 'نقاط التحقيق')),
          h('span', { class: 'inv-count-badge' }, `${arabicDigits(active.length)} متاح`)),
        active.length
          ? h('div', { class: 'inv-card-grid' }, active.map((hotspot, index) => { const card = this.hotspotCard(hotspot, index); if (target?.kind === 'pin' && target.id === hotspot.id) card.classList.add('next-target'); return card }))
          : h('p', { class: 'inv-empty' }, 'مفيش أثر جديد ظاهر هنا دلوقتي. ارجع للموقع بعد ما تجمع خيطاً جديداً.'),
      ),
      people.length > 0 && h('section', { class: 'inv-people' },
        h('div', { class: 'inv-section-heading' },
          h('div', null, h('small', null, 'شهود وأشخاص'), h('h3', null, 'مين موجود؟')),
          h('span', { class: 'inv-count-badge cyan' }, `${arabicDigits(people.length)} ملفات`)),
          h('div', { class: 'inv-card-grid people-grid' }, people.map(character =>
          h('article', { class: 'inv-person-card' },
            h('div', { class: 'inv-person-portrait', style: { '--body': character.figure.body, '--accent': character.figure.accent } },
              h('img', { class: 'character-portrait-image', src: CHARACTER_ART[character.id].src, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' })),
            h('div', { class: 'inv-person-copy' },
              h('small', null, character.role),
              h('b', null, character.nickname ?? character.name),
              h('p', null, character.quote)),
            h('button', { class: 'inv-talk-btn', onclick: () => this.d.onTalk(character.id) }, s.state.flags.has(`met_${character.id}`) ? 'تابع الحديث' : 'ابدأ الحوار')))),
      ),
      foundHere.length > 0 && h('section', { class: 'inv-recovered' },
        h('small', null, 'أدلة عُثر عليها هنا'),
        h('div', { class: 'inv-recovered-list' }, foundHere.map(e => h('button', { class: 'inv-recovered-evidence', onclick: this.d.onCaseFile },
          EVIDENCE_ART[e.id] && h('img', { src: EVIDENCE_ART[e.id]!.src, alt: '', loading: 'lazy', decoding: 'async' }),
          h('span', null, e.title)))),
      ),
      consumed.length > 0 && h('p', { class: 'inv-scene-note' }, `تم فحص ${arabicDigits(consumed.length)} نقطة في هذا الموقع.`),
    )))
  }

  private scenePin(hotspot: Hotspot, index: number, next = false): HTMLButtonElement {
    const anchor = HOTSPOT_ANCHORS[hotspot.id]
    const left = anchor?.x ?? Math.max(12, Math.min(88, 50 + hotspot.offset.x * 3.2))
    const top = anchor?.y ?? Math.max(28, Math.min(72, 58 + hotspot.offset.z * 1.35))
    const marker = h('button', {
      class: `inv-scene-pin kind-${hotspot.kind}${next ? ' next-target' : ''}`,
      style: { left: `${left}%`, top: `${top}%` },
      'data-label': hotspot.label,
      'aria-label': hotspot.label,
      title: hotspot.label,
      onclick: () => this.d.onHotspot(hotspot),
    }, arabicDigits(index + 1), next && h('span', { class: 'guide-arrow' }, 'اضغط هنا'))
    return marker
  }

  private hotspotCard(hotspot: Hotspot, index: number): HTMLElement {
    const kindClass = hotspot.kind === 'photo' ? 'photo' : hotspot.kind === 'travel' ? 'travel' : 'inspect'
    const icon = hotspot.kind === 'photo' ? '◉' : hotspot.kind === 'travel' ? '↗' : '⌕'
    const action = hotspot.kind === 'photo' ? 'راجع الصورة' : hotspot.kind === 'travel' ? 'ابدأ الانتقال' : 'افحص الأثر'
    return h('button', { class: `inv-interaction-card ${kindClass}`, onclick: () => this.d.onHotspot(hotspot) },
      h('span', { class: 'inv-card-index' }, arabicDigits(index + 1)),
      h('span', { class: 'inv-card-icon', 'aria-hidden': true }, icon),
      h('span', { class: 'inv-card-copy' },
        h('small', null, KIND_LABEL[hotspot.kind]),
        h('b', null, hotspot.label),
        h('i', null, action)),
      h('span', { class: 'inv-card-arrow', 'aria-hidden': true }, '←'))
  }

  private mapPage(place: Place): HTMLElement {
    const districtPlaces = PLACE_LIST.filter(p => p.district === place.district)
    return h('div', { class: 'inv-map-page' },
      h('div', { class: 'inv-map-heading' },
        h('div', null,
          h('div', { class: 'inv-section-kicker' }, h('span', null, 'تنقّل ميداني'), h('i', null, 'MAP / 2D')),
          h('h2', null, place.district === 'abis' ? 'خريطة أبيس' : 'خريطة الإسكندرية'),
          h('p', null, 'اختر موقعاً داخل المنطقة الحالية. الانتقال بين أبيس والإسكندرية يتم من موقفي الميكروباص داخل القصة.')),
        h('span', { class: 'inv-map-district' }, place.district === 'abis' ? 'أبيس • ٠١' : 'الإسكندرية • ٠٢')),
      h('div', { class: 'inv-map-switch', role: 'group', 'aria-label': 'نوع الخريطة' },
        h('button', { class: this.mapKind === 'real' ? 'on' : '', type: 'button', onclick: () => { this.mapKind = 'real'; this.render() } }, 'خريطة حقيقية'),
        h('button', { class: this.mapKind === 'drawn' ? 'on' : '', type: 'button', onclick: () => { this.mapKind = 'drawn'; this.render() } }, 'خريطة مرسومة')),
      this.mapKind === 'real' && RealMap.available() ? this.realMap.show(place.id) : this.mapSvg(districtPlaces, place),
      h('div', { class: 'inv-place-grid' }, districtPlaces.map(p =>
        h('button', { class: `inv-place-card${p.id === place.id ? ' selected' : ''}`, 'aria-current': p.id === place.id ? 'location' : undefined, onclick: () => this.selectPlace(p.id) },
          h('img', { class: 'inv-place-thumbnail', src: SCENE_ART[p.id].mobileSrc ?? SCENE_ART[p.id].src, alt: '', loading: 'lazy', decoding: 'async' }),
          h('span', { class: 'inv-place-index' }, arabicDigits(districtPlaces.indexOf(p) + 1)),
          h('span', { class: 'inv-place-copy' }, h('b', null, p.name), h('small', null, p.short)),
          p.id === place.id ? h('span', { class: 'inv-place-state' }, 'أنت هنا') : h('span', { class: 'inv-place-arrow' }, '←')))),
      h('p', { class: 'inv-map-footnote' }, `خريطة توضيحية • ${arabicDigits(districtPlaces.length)} مواقع في المنطقة`),
    )
  }

  private mapSvg(places: Place[], current: Place): SVGSVGElement {
    const W = 760
    const H = 340
    const xs = places.map(p => p.pos.x)
    const zs = places.map(p => p.pos.z)
    const minX = Math.min(...xs) - 35
    const maxX = Math.max(...xs) + 35
    const minZ = Math.min(...zs) - 25
    const maxZ = Math.max(...zs) + 25
    const px = (x: number) => 42 + ((x - minX) / Math.max(1, maxX - minX)) * (W - 84)
    const py = (z: number) => 35 + ((z - minZ) / Math.max(1, maxZ - minZ)) * (H - 70)
    const root = svg('svg', {
      class: `inv-map-svg ${current.district}`,
      viewBox: `0 0 ${W} ${H}`,
      role: 'group',
      'aria-label': current.district === 'abis' ? 'خريطة أبيس التفاعلية' : 'خريطة الإسكندرية التفاعلية',
    })
    root.append(svg('rect', { x: 0, y: 0, width: W, height: H, class: 'inv-map-bg' }))
    if (current.district === 'city') {
      root.append(svg('rect', { x: 0, y: 0, width: W, height: H * 0.23, class: 'inv-map-sea' }))
      root.append(svg('path', { d: `M0 ${H * 0.23} C${W * 0.22} ${H * 0.19}, ${W * 0.37} ${H * 0.31}, ${W * 0.58} ${H * 0.24} S${W * 0.83} ${H * 0.18}, ${W} ${H * 0.24}`, class: 'inv-map-shore' }))
    } else {
      root.append(svg('path', { d: `M0 ${H * 0.45} C${W * 0.22} ${H * 0.4}, ${W * 0.34} ${H * 0.49}, ${W * 0.57} ${H * 0.44} S${W * 0.82} ${H * 0.4}, ${W} ${H * 0.46}`, class: 'inv-map-canal' }))
      root.append(svg('path', { d: `M0 ${H * 0.74} C${W * 0.2} ${H * 0.68}, ${W * 0.48} ${H * 0.82}, ${W} ${H * 0.68}`, class: 'inv-map-road' }))
    }
    this.mapDecor(root, current.district, W, H)
    const ordered = [...places].sort((a, b) => a.pos.x - b.pos.x)
    if (ordered.length > 1) {
      const route = ordered.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.pos.x)} ${py(p.pos.z)}`).join(' ')
      root.append(svg('path', { d: route, class: 'inv-map-route' }))
    }
    for (const p of places) {
      const g = svg('g', {
        class: `inv-map-pin${p.id === this.placeId ? ' current' : ''}`,
        transform: `translate(${px(p.pos.x)} ${py(p.pos.z)})`,
        tabindex: '0',
        role: 'button',
        'aria-label': p.name,
      })
      g.append(svg('circle', { cx: 0, cy: 0, r: p.id === this.placeId ? 19 : 14, class: 'pin-halo' }))
      g.append(svg('circle', { cx: 0, cy: 0, r: p.id === this.placeId ? 13 : 10, class: 'pin-dot' }))
      const glyph = svg('text', { x: 0, y: 5, 'text-anchor': 'middle', class: 'pin-glyph' })
      glyph.textContent = MAP_GLYPH[p.id] ?? '●'
      g.append(glyph)
      if (p.id === this.placeId) { const here = svg('text', { x: 0, y: 34, 'text-anchor': 'middle', class: 'pin-here' }); here.textContent = 'أنت هنا'; g.append(here) }
      const label = svg('text', { x: 0, y: -22, 'text-anchor': 'middle', class: 'pin-label' })
      label.textContent = p.short
      g.append(label)
      const choose = () => this.selectPlace(p.id)
      g.addEventListener('click', choose)
      g.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          choose()
        }
      })
      root.append(g)
    }
    return root
  }

  /** Hand-drawn style scenery: palms, boats, houses, fields, tram rails and a compass. */
  private mapDecor(root: SVGSVGElement, district: 'abis' | 'city', W: number, H: number): void {
    const g = svg('g', { class: 'inv-map-decor', 'aria-hidden': 'true' })
    const palm = (x: number, y: number, k = 1) => {
      g.append(svg('path', { d: `M${x} ${y} q${2 * k} ${-10 * k} ${-1 * k} ${-18 * k}`, class: 'd-trunk' }))
      for (const a of [-50, -20, 15, 45]) g.append(svg('path', { d: `M${x - k} ${y - 18 * k} q${a * .45 * k} ${-12 * k} ${a * .8 * k} ${-4 * k}`, class: 'd-leaf' }))
    }
    const house = (x: number, y: number) => {
      g.append(svg('rect', { x, y, width: 16, height: 11, class: 'd-house' }))
      g.append(svg('path', { d: `M${x - 2} ${y} L${x + 8} ${y - 8} L${x + 18} ${y}Z`, class: 'd-roof' }))
    }
    if (district === 'city') {
      for (const [x, y] of [[90, 26], [300, 40], [560, 20], [690, 44]]) {
        g.append(svg('path', { d: `M${x} ${y} l22 0 l-5 8 l-12 0Z`, class: 'd-hull' }))
        g.append(svg('path', { d: `M${x + 11} ${y} l0 -16 l9 14Z`, class: 'd-sail' }))
      }
      g.append(svg('path', { d: `M0 ${H * .36} C${W * .25} ${H * .3}, ${W * .5} ${H * .42}, ${W} ${H * .34}`, class: 'd-rail' }))
      g.append(svg('path', { d: `M0 ${H * .38} C${W * .25} ${H * .32}, ${W * .5} ${H * .44}, ${W} ${H * .36}`, class: 'd-rail' }))
      for (let i = 0; i < 9; i++) g.append(svg('rect', { x: 30 + i * 80, y: H * .78 - (i % 3) * 10, width: 22, height: 26 + (i % 4) * 8, class: 'd-block' }))
      for (const x of [60, 250, 480, 700]) palm(x, H * .5 + (x % 7))
    } else {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) g.append(svg('rect', { x: 40 + c * 24 + r * 6, y: H * .1 + r * 12, width: 20, height: 8, class: 'd-field' }))
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) g.append(svg('rect', { x: W - 190 + c * 30, y: H * .84 + r * 4 - 20, width: 24, height: 8, class: 'd-field' }))
      for (const [x, y] of [[120, 120], [330, 112], [560, 128], [690, 100]]) house(x, y)
      for (const x of [60, 210, 470, 640]) palm(x, H * .62 + (x % 9))
      for (let i = 0; i < 8; i++) g.append(svg('path', { d: `M${40 + i * 90} ${H * .5} l-2 -9 M${44 + i * 90} ${H * .5} l1 -11`, class: 'd-reed' }))
    }
    const cx = W - 52
    const cy = 52
    g.append(svg('circle', { cx, cy, r: 22, class: 'd-compass' }), svg('path', { d: `M${cx} ${cy - 18} l5 18 l-5 -4 l-5 4Z`, class: 'd-needle' }))
    const n = svg('text', { x: cx, y: cy - 25, 'text-anchor': 'middle', class: 'd-n' })
    n.textContent = 'ش'
    g.append(n)
    root.append(g)
  }
  private sidebar(s: Session, place: Place): HTMLElement {
    const objective = s.engine.currentObjective()
    const found = s.state.evidence.size
    const total = s.engine.file.evidence.length
    const pct = Math.round((found / Math.max(1, total)) * 100)
    const reviewed = this.reviewedEvidence.size
    const deductions = s.state.deductions.size
    const totalDeductions = s.engine.file.deductions.length
    const recent = s.engine.file.evidence.filter(e => s.engine.has(e.id)).slice(-3).reverse()
    const objectives = s.engine.objectives().filter(x => !x.done).slice(0, 3)
    return h('aside', { class: 'inv-sidebar', 'aria-label': 'ملخص القضية' },
      h('article', { class: 'inv-case-card' },
        h('div', { class: 'inv-case-card-head' }, h('small', null, 'القضية الحالية'), h('span', { class: 'inv-classified' }, 'سرّي')),
        h('h3', null, s.engine.file.title),
        h('p', null, s.engine.file.tagline),
        h('div', { class: 'inv-progress' },
          h('div', { class: 'inv-progress-meta' }, h('span', null, 'الأدلة المجموعة'), h('b', null, `${arabicDigits(found)} / ${arabicDigits(total)}`)),
          h('div', { class: 'inv-progress-track', role: 'progressbar', 'aria-label': 'الأدلة المجموعة', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': found }, h('i', { style: { width: `${pct}%` } }))),
        h('div', { class: 'inv-progress-stats' },
          h('div', null, h('small', null, 'مُراجع'), h('b', null, `${arabicDigits(Math.min(reviewed, found))} / ${arabicDigits(found)}`)),
          h('div', null, h('small', null, 'خيوط مربوطة'), h('b', null, `${arabicDigits(deductions)} / ${arabicDigits(totalDeductions)}`))),
        h('button', { class: 'inv-open-file', onclick: this.d.onCaseFile }, 'افتح ملف القضية', h('span', { 'aria-hidden': true }, '←'))),
      h('article', { class: 'inv-side-section' },
        h('div', { class: 'inv-side-title' }, h('small', null, 'الخطوة التالية'), h('span', { class: 'inv-side-signal' }, '●')),
        objective
          ? h('div', { class: 'inv-side-objective' }, h('b', null, objective.title), h('p', null, objective.detail), objective.place && h('small', null, `المكان: ${PLACES[objective.place].name}`))
          : h('p', { class: 'inv-empty small' }, 'لا توجد مهمة مفتوحة. راجع لوحة الأدلة.'),
        h('button', { class: 'inv-side-link', onclick: this.d.onHint }, 'طلب تلميح', h('span', { 'aria-hidden': true }, '↘'))),
      objectives.length > 0 && h('article', { class: 'inv-side-section inv-objective-list' },
        h('div', { class: 'inv-side-title' }, h('small', null, 'سجل المهام'), h('span', null, arabicDigits(objectives.length))),
        h('ul', null, objectives.map(({ objective: item }) => h('li', null, item.title)))),
      h('article', { class: 'inv-side-section inv-recent-section' },
        h('div', { class: 'inv-side-title' }, h('small', null, 'آخر الأدلة'), h('span', null, recent.length ? arabicDigits(recent.length) : '—')),
        recent.length
          ? h('ul', null, recent.map(e => h('li', null,
            EVIDENCE_ART[e.id] ? h('img', { class: 'inv-recent-thumb', src: EVIDENCE_ART[e.id]!.src, alt: '', loading: 'lazy', decoding: 'async' }) : h('span', { class: `inv-evidence-dot kind-${e.kind}`, 'aria-hidden': true }),
            h('span', { class: 'inv-recent-title' }, e.title),
            h('small', { class: 'inv-recent-kind' }, ({ object: 'جسم', testimony: 'شهادة', document: 'مستند', photo: 'صورة', trace: 'أثر' } as const)[e.kind]))))
          : h('p', { class: 'inv-empty small' }, 'لسه مفيش أدلة في الملف.'),
      ),
      h('div', { class: 'inv-location-tag' }, h('span', { class: 'inv-location-pulse' }), h('span', null, `${place.district === 'abis' ? 'أبيس' : 'الإسكندرية'} • ${place.short}`)),
    )
  }

  private mobileNav(): HTMLElement {
    const fresh = this.newEvidenceCount()
    return h('nav', { class: 'inv-mobile-nav', 'aria-label': 'اختصارات التحقيق' },
      h('button', { class: this.tab === 'scene' ? 'active' : '', 'aria-current': this.tab === 'scene' ? 'page' : undefined, onclick: () => this.setTab('scene') },
        h('span', { class: 'inv-mobile-icon', 'aria-hidden': true }, '⌖'), 'المشهد'),
      h('button', { class: this.tab === 'map' ? 'active' : '', 'aria-current': this.tab === 'map' ? 'page' : undefined, onclick: () => this.setTab('map') },
        h('span', { class: 'inv-mobile-icon', 'aria-hidden': true }, '▦'), 'الخريطة'),
      h('button', { class: fresh ? 'inv-mobile-file has-new' : 'inv-mobile-file', 'aria-label': fresh ? `ملف القضية، ${arabicDigits(fresh)} أدلة جديدة` : 'ملف القضية', onclick: this.d.onCaseFile },
        h('span', { class: 'inv-mobile-icon', 'aria-hidden': true }, '▤'), 'ملف القضية',
        fresh > 0 && h('b', { class: 'inv-new-count', 'aria-hidden': true }, arabicDigits(fresh))),
      h('button', { class: this.d.mailCount() ? 'inv-mobile-file has-new' : '', 'aria-label': 'الجوابات', onclick: this.d.onMail }, h('span', { class: 'inv-mobile-icon', 'aria-hidden': true }, '✉'), 'جوابات',
        this.d.mailCount() > 0 && h('b', { class: 'inv-new-count', 'aria-hidden': true }, arabicDigits(this.d.mailCount()))),
      h('button', { onclick: this.d.onHint }, h('span', { class: 'inv-mobile-icon', 'aria-hidden': true }, '؟'), 'تلميح'))
  }
}
