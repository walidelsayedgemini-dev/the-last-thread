/**
 * Real map of the game world on top of OpenStreetMap tiles (a Google-Maps-like street map, with a
 * satellite switch). Landmarks such as Qaitbay Citadel or the Bibliotheca sit at their real
 * coordinates; the Abis spots are fictional but placed inside the real Abis district.
 * Every place has an "open in Google Maps" link. If the tiles cannot load (offline) the caller
 * falls back to the drawn map.
 */
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { PLACE_LIST, PLACES } from '../data/places'
import type { Place, PlaceId } from '../data/types'
import { h } from './dom'

export const MAP_GLYPH: Record<string, string> = {
  zeinab_home: '⌂', mahmoud_house: '⌂', cafe_ragab: '♨', abis_mosque: '☪', canal_bridge: '≋', plot15: '▦', abis_stop: '⇄',
  raml_stop: '⇄', mansheya: '⚖', qaitbay: '♜', bibliotheca: '▤', pompey: '┃', corniche: '⚓',
}

export const googleMapsUrl = (p: Place) => `https://www.google.com/maps/search/?api=1&query=${p.mapPos.lat},${p.mapPos.lng}`
export const googleDirectionsUrl = (a: Place, b: Place) => `https://www.google.com/maps/dir/?api=1&origin=${a.mapPos.lat},${a.mapPos.lng}&destination=${b.mapPos.lat},${b.mapPos.lng}`

const TILES = {
  street: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap', max: 19 },
  sat: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles © Esri', max: 18 },
} as const

export type RealMapDeps = {
  /** Player picks a place in the current district. */
  onSelect: (id: PlaceId) => void
  /** Player picks a place in the other district (needs the microbus). */
  onFar: (id: PlaceId) => void
  /** Tiles never loaded: show the drawn map instead. */
  onUnavailable: () => void
}

export class RealMap {
  readonly el: HTMLElement
  private readonly canvas: HTMLElement
  private map?: L.Map
  private tiles?: L.TileLayer
  private markers = new Map<PlaceId, L.Marker>()
  private route?: L.Polyline
  private style: 'street' | 'sat' = 'street'
  private loaded = 0
  private failed = 0
  private current: PlaceId = 'zeinab_home'
  private scope: 'district' | 'all' = 'district'
  private reportedBad = false
  private readonly styleBtn: HTMLButtonElement
  private readonly scopeBtn: HTMLButtonElement

  constructor(private readonly d: RealMapDeps) {
    this.canvas = h('div', { class: 'rm-canvas', role: 'application', 'aria-label': 'خريطة حقيقية للإسكندرية وأبيس' })
    this.styleBtn = h('button', { class: 'rm-chip', type: 'button', onclick: () => this.toggleStyle() }, 'قمر صناعي')
    this.scopeBtn = h('button', { class: 'rm-chip', type: 'button', onclick: () => this.toggleScope() }, 'اعرض الكل')
    this.el = h('div', { class: 'rm' },
      this.canvas,
      h('div', { class: 'rm-bar' }, this.styleBtn, this.scopeBtn,
        h('a', { class: 'rm-chip rm-gmaps', target: '_blank', rel: 'noopener noreferrer', href: googleMapsUrl(PLACES[this.current]) }, 'افتح في خرائط جوجل ↗')),
      h('p', { class: 'rm-note' }, 'القلعة والمكتبة والعمود والمحطات أماكن حقيقية بإحداثياتها. بيوت وقهوة عزبة ١٥ متخيَّلة جوه حي أبيس الحقيقي.'))
  }

  /** Whether the browser even has a chance of loading remote tiles. */
  static available(): boolean {
    return typeof navigator === 'undefined' || navigator.onLine !== false
  }

  private ensure(): L.Map {
    if (this.map) return this.map
    const map = L.map(this.canvas, { zoomControl: true, attributionControl: true, worldCopyJump: false, minZoom: 9, maxZoom: 19 })
    this.map = map
    map.setView([PLACES[this.current].mapPos.lat, PLACES[this.current].mapPos.lng], 14)
    this.setTiles()
    for (const p of PLACE_LIST) {
      const m = L.marker([p.mapPos.lat, p.mapPos.lng], { icon: this.icon(p, false), keyboard: true, title: p.name, riseOnHover: true }).addTo(map)
      m.bindTooltip(p.short, { permanent: true, direction: 'top', offset: [0, -22], className: `rm-tip${p.realSite ? ' real' : ''}` })
      m.on('click', () => this.open(p))
      this.markers.set(p.id, m)
    }
    const a = PLACES.abis_stop.mapPos
    const b = PLACES.raml_stop.mapPos
    this.route = L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: '#e5c34b', weight: 3, dashArray: '8 8', opacity: .9 }).addTo(map)
    const km = (map.distance([a.lat, a.lng], [b.lat, b.lng]) / 1000).toFixed(0)
    this.route.bindTooltip(`ميكروباص «رمل رمل» ≈ ${km} كم`, { sticky: true, className: 'rm-tip route' })
    return map
  }

  private setTiles(): void {
    if (!this.map) return
    this.tiles?.remove()
    const t = TILES[this.style]
    this.tiles = L.tileLayer(t.url, { maxZoom: t.max, attribution: t.attr, crossOrigin: true })
    this.tiles.on('tileload', () => { this.loaded++ })
    this.tiles.on('tileerror', () => {
      this.failed++
      if (this.loaded === 0 && this.failed >= 6 && !this.reportedBad) { this.reportedBad = true; this.d.onUnavailable() }
    })
    this.tiles.addTo(this.map)
  }

  private icon(p: Place, current: boolean): L.DivIcon {
    return L.divIcon({
      className: 'rm-icon-wrap',
      html: `<div class="rm-pin${p.realSite ? ' real' : ' fiction'}${current ? ' current' : ''}${p.district === 'city' ? ' city' : ' abis'}"><span>${MAP_GLYPH[p.id] ?? '●'}</span></div>`,
      iconSize: [34, 34], iconAnchor: [17, 17],
    })
  }

  private open(p: Place): void {
    if (!this.map) return
    const here = PLACES[this.current]
    const same = p.district === here.district
    const body = h('div', { class: 'rm-pop' },
      h('b', null, p.name),
      h('small', null, p.realSite ? 'مكان حقيقي في الإسكندرية' : 'مكان متخيَّل جوه حي أبيس الحقيقي'),
      h('p', null, p.description),
      h('div', { class: 'rm-pop-actions' },
        p.id === this.current ? h('span', { class: 'rm-here' }, 'أنت هنا') : same
          ? h('button', { class: 'rm-go', type: 'button', onclick: () => { this.map?.closePopup(); this.d.onSelect(p.id) } }, 'روح هنا')
          : h('button', { class: 'rm-go far', type: 'button', onclick: () => { this.map?.closePopup(); this.d.onFar(p.id) } }, 'محتاج ميكروباص'),
        h('a', { class: 'rm-link', href: googleMapsUrl(p), target: '_blank', rel: 'noopener noreferrer' }, 'خرائط جوجل ↗'),
        p.id !== this.current && h('a', { class: 'rm-link', href: googleDirectionsUrl(here, p), target: '_blank', rel: 'noopener noreferrer' }, 'الاتجاهات ↗')))
    L.popup({ className: 'rm-popup', offset: [0, -14], maxWidth: 260 }).setLatLng([p.mapPos.lat, p.mapPos.lng]).setContent(body).openOn(this.map)
  }

  private toggleStyle(): void {
    this.style = this.style === 'street' ? 'sat' : 'street'
    this.styleBtn.textContent = this.style === 'street' ? 'قمر صناعي' : 'خريطة الشوارع'
    this.el.classList.toggle('sat', this.style === 'sat')
    this.setTiles()
  }

  private toggleScope(): void {
    this.scope = this.scope === 'district' ? 'all' : 'district'
    this.scopeBtn.textContent = this.scope === 'district' ? 'اعرض الكل' : 'ركّز على المنطقة'
    this.fit()
  }

  private fit(): void {
    const map = this.map
    if (!map) return
    const here = PLACES[this.current]
    const pts = PLACE_LIST.filter(p => this.scope === 'all' || p.district === here.district).map(p => [p.mapPos.lat, p.mapPos.lng] as [number, number])
    map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: this.scope === 'all' ? 12 : 16, animate: false })
  }

  /** Update the player's place and (re)size the map after the element has been attached. */
  show(current: PlaceId): HTMLElement {
    const prevDistrict = PLACES[this.current].district
    this.current = current
    const map = this.ensure()
    for (const p of PLACE_LIST) this.markers.get(p.id)?.setIcon(this.icon(p, p.id === current))
    const link = this.el.querySelector<HTMLAnchorElement>('.rm-gmaps')
    if (link) link.href = googleMapsUrl(PLACES[current])
    requestAnimationFrame(() => {
      map.invalidateSize()
      if (PLACES[current].district !== prevDistrict || !this.fitted) { this.fit(); this.fitted = true }
    })
    return this.el
  }
  private fitted = false
}
