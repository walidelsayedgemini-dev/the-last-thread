import { arabicDigits } from '../core/clock'
import { CHARACTER_LIST } from '../data/characters'
import { PLACES, PLACE_LIST } from '../data/places'
import type { CharacterId, Hotspot, Place, PlaceId } from '../data/types'
import type { Audio } from '../engine/audio'
import type { Session } from '../game/session'
import { h, setChildren, svg } from './dom'

export type InvestigationTab = 'scene' | 'map'

export type InvestigationDeps = {
  audio: Audio
  onHotspot: (hotspot: Hotspot) => void
  onTalk: (characterId: CharacterId) => void
  onPlaceChange: (placeId: PlaceId) => void
  onCaseFile: () => void
  onHint: () => void
  onPause: () => void
}

const SCENE_IMAGES: Record<PlaceId, string> = {
  zeinab_home: new URL('../assets/scenes/abis-fields.webp', import.meta.url).href,
  mahmoud_house: new URL('../assets/scenes/abis-house.webp', import.meta.url).href,
  cafe_ragab: new URL('../assets/scenes/abis-fields.webp', import.meta.url).href,
  abis_mosque: new URL('../assets/scenes/abis-fields.webp', import.meta.url).href,
  canal_bridge: new URL('../assets/scenes/abis-fields.webp', import.meta.url).href,
  plot15: new URL('../assets/scenes/abis-fields.webp', import.meta.url).href,
  abis_stop: new URL('../assets/scenes/abis-fields.webp', import.meta.url).href,
  raml_stop: new URL('../assets/scenes/alexandria-street.webp', import.meta.url).href,
  mansheya: new URL('../assets/scenes/alexandria-street.webp', import.meta.url).href,
  qaitbay: new URL('../assets/scenes/qaitbay-harbor.webp', import.meta.url).href,
  bibliotheca: new URL('../assets/scenes/bibliotheca.webp', import.meta.url).href,
  pompey: new URL('../assets/scenes/alexandria-street.webp', import.meta.url).href,
  corniche: new URL('../assets/scenes/qaitbay-harbor.webp', import.meta.url).href,
}

const KIND_LABEL: Record<Hotspot['kind'], string> = {
  inspect: 'فحص ميداني', photo: 'صورة موقع', travel: 'انتقال', rest: 'استراحة',
}

export class InvestigationView {
  readonly el: HTMLElement
  private session?: Session
  private placeId: PlaceId = 'zeinab_home'
  private tab: InvestigationTab = 'scene'

  constructor(private readonly d: InvestigationDeps) {
    this.el = h('main', { class: 'investigation', hidden: true, 'aria-label': 'واجهة التحقيق ثنائية الأبعاد' })
  }

  get currentPlace(): PlaceId {
    return this.placeId
  }

  get currentTab(): InvestigationTab {
    return this.tab
  }

  show(session: Session, placeId: PlaceId): void {
    this.session = session
    this.placeId = placeId
    this.tab = 'scene'
    this.el.hidden = false
    this.render()
  }

  hide(): void {
    this.el.hidden = true
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
    this.tab = 'scene'
    this.d.audio.play('ui')
    this.d.onPlaceChange(placeId)
    this.render()
  }

  private render(): void {
    const s = this.session
    if (!s) return
    const place = PLACES[this.placeId]
    this.el.dataset.place = place.id
    this.el.dataset.district = place.district
    setChildren(this.el,
      h('div', { class: 'inv-frame' },
        this.header(place),
        h('div', { class: 'inv-layout' },
          h('section', { class: 'inv-main-panel', 'aria-live': 'polite' }, this.tab === 'scene' ? this.scenePage(s, place) : this.mapPage(place)),
          this.sidebar(s, place)),
        this.mobileNav()),
    )
  }

  private header(place: Place): HTMLElement {
    return h('header', { class: 'inv-header' },
      h('div', { class: 'inv-brand' },
        h('span', { class: 'inv-brand-mark', 'aria-hidden': true }, '⌕'),
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
    const art = h('div', { class: 'inv-scene-art' },
      h('img', { class: 'inv-scene-photo', src: SCENE_IMAGES[place.id], alt: '', draggable: 'false' }),
      h('div', { class: 'inv-scene-shade', 'aria-hidden': true }),
      h('div', { class: 'inv-scene-stamp' }, 'سجل ميداني • ٠١'),
      h('div', { class: 'inv-scene-caption' },
        h('small', null, place.district === 'abis' ? 'أبيس / عزبة ١٥' : 'الإسكندرية'),
        h('b', null, place.name),
        h('span', null, `${arabicDigits(active.length)} تفاعلات متاحة`)),
      ...active.map((hotspot, index) => this.scenePin(hotspot, index)),
    )

    return h('div', { class: 'inv-scene-page' },
      art,
      h('div', { class: 'inv-place-copy' },
        h('div', { class: 'inv-section-kicker' }, h('span', null, 'المشهد الحالي'), h('i', null, place.district === 'abis' ? 'ABIS / 01' : 'ALEX / 01')),
        h('h2', null, place.name),
        h('p', null, place.description),
        current && h('div', { class: 'inv-objective-strip' },
          h('span', { class: 'inv-objective-mark', 'aria-hidden': true }, '⌖'),
          h('div', null, h('small', null, 'الخيط التالي'), h('b', null, current.title), h('p', null, current.detail))),
      ),
      h('section', { class: 'inv-interactions' },
        h('div', { class: 'inv-section-heading' },
          h('div', null, h('small', null, 'افحص المكان'), h('h3', null, 'نقاط التحقيق')),
          h('span', { class: 'inv-count-badge' }, `${arabicDigits(active.length)} متاح`)),
        active.length
          ? h('div', { class: 'inv-card-grid' }, active.map((hotspot, index) => this.hotspotCard(hotspot, index)))
          : h('p', { class: 'inv-empty' }, 'مفيش أثر جديد ظاهر هنا دلوقتي. ارجع للموقع بعد ما تجمع خيطاً جديداً.'),
      ),
      people.length > 0 && h('section', { class: 'inv-people' },
        h('div', { class: 'inv-section-heading' },
          h('div', null, h('small', null, 'شهود وأشخاص'), h('h3', null, 'مين موجود؟')),
          h('span', { class: 'inv-count-badge cyan' }, `${arabicDigits(people.length)} ملفات`)),
        h('div', { class: 'inv-card-grid people-grid' }, people.map(character =>
          h('article', { class: 'inv-person-card' },
            h('div', { class: 'inv-person-portrait', style: { '--body': character.figure.body, '--accent': character.figure.accent } },
              h('span', null, character.name.replace(/^(ال|عم |المعلم |الحاجة )/, '').slice(0, 1))),
            h('div', { class: 'inv-person-copy' },
              h('small', null, character.role),
              h('b', null, character.nickname ?? character.name),
              h('p', null, character.quote)),
            h('button', { class: 'inv-talk-btn', onclick: () => this.d.onTalk(character.id) }, s.state.flags.has(`met_${character.id}`) ? 'تابع الحديث' : 'ابدأ الحوار')))),
      ),
      foundHere.length > 0 && h('section', { class: 'inv-recovered' },
        h('small', null, 'أدلة عُثر عليها هنا'),
        h('div', { class: 'inv-recovered-list' }, foundHere.map(e => h('span', null, e.title))),
      ),
      consumed.length > 0 && h('p', { class: 'inv-scene-note' }, `تم فحص ${arabicDigits(consumed.length)} نقطة في هذا الموقع.`),
    )
  }

  private scenePin(hotspot: Hotspot, index: number): HTMLButtonElement {
    const left = Math.max(12, Math.min(88, 50 + hotspot.offset.x * 3.2))
    const top = Math.max(28, Math.min(78, 58 + hotspot.offset.z * 1.35))
    const marker = h('button', {
      class: `inv-scene-pin kind-${hotspot.kind}`,
      style: { left: `${left}%`, top: `${top}%` },
      'aria-label': hotspot.label,
      title: hotspot.label,
      onclick: () => this.d.onHotspot(hotspot),
    }, arabicDigits(index + 1))
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
      this.mapSvg(districtPlaces, place),
      h('div', { class: 'inv-place-grid' }, districtPlaces.map(p =>
        h('button', { class: `inv-place-card${p.id === place.id ? ' selected' : ''}`, 'aria-current': p.id === place.id ? 'location' : undefined, onclick: () => this.selectPlace(p.id) },
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
      g.append(svg('circle', { cx: 0, cy: 0, r: p.id === this.placeId ? 12 : 8, class: 'pin-halo' }))
      g.append(svg('circle', { cx: 0, cy: 0, r: p.id === this.placeId ? 5 : 3.5, class: 'pin-dot' }))
      const label = svg('text', { x: 0, y: -15, 'text-anchor': 'middle', class: 'pin-label' })
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

  private sidebar(s: Session, place: Place): HTMLElement {
    const objective = s.engine.currentObjective()
    const found = s.state.evidence.size
    const total = s.engine.file.evidence.length
    const pct = Math.round((found / Math.max(1, total)) * 100)
    const recent = s.engine.file.evidence.filter(e => s.engine.has(e.id)).slice(-3).reverse()
    const objectives = s.engine.objectives().filter(x => !x.done).slice(0, 3)
    return h('aside', { class: 'inv-sidebar', 'aria-label': 'ملخص القضية' },
      h('article', { class: 'inv-case-card' },
        h('div', { class: 'inv-case-card-head' }, h('small', null, 'القضية الحالية'), h('span', { class: 'inv-classified' }, 'سرّي')),
        h('h3', null, s.engine.file.title),
        h('p', null, s.engine.file.tagline),
        h('div', { class: 'inv-progress' },
          h('div', { class: 'inv-progress-meta' }, h('span', null, 'الأدلة المجموعة'), h('b', null, `${arabicDigits(found)} / ${arabicDigits(total)}`)),
          h('div', { class: 'inv-progress-track' }, h('i', { style: { width: `${pct}%` } }))),
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
          ? h('ul', null, recent.map(e => h('li', null, h('span', { class: `inv-evidence-dot kind-${e.kind}` }), h('span', null, e.title))))
          : h('p', { class: 'inv-empty small' }, 'لسه مفيش أدلة في الملف.'),
      ),
      h('div', { class: 'inv-location-tag' }, h('span', { class: 'inv-location-pulse' }), h('span', null, `${place.district === 'abis' ? 'أبيس' : 'الإسكندرية'} • ${place.short}`)),
    )
  }

  private mobileNav(): HTMLElement {
    return h('nav', { class: 'inv-mobile-nav', 'aria-label': 'اختصارات التحقيق' },
      h('button', { class: this.tab === 'scene' ? 'active' : '', onclick: () => this.setTab('scene') }, 'المشهد'),
      h('button', { class: this.tab === 'map' ? 'active' : '', onclick: () => this.setTab('map') }, 'الخريطة'),
      h('button', { onclick: this.d.onCaseFile }, 'ملف القضية'),
      h('button', { onclick: this.d.onHint }, 'تلميح'))
  }
}
