/** Area theming: CSS variables for the whole UI, a drifting particle layer and the arrival card. */
import { AREA_THEMES, type AreaTheme } from '../data/areas'
import type { Place, PlaceId } from '../data/types'
import { h, setChildren } from './dom'

export function themeOf(id: PlaceId): AreaTheme {
  return AREA_THEMES[id]
}

/** Recolour the whole UI for the area the player stands in. */
export function applyAreaTheme(id: PlaceId): void {
  const t = themeOf(id)
  const root = document.documentElement
  root.style.setProperty('--area-accent', t.accent)
  root.style.setProperty('--area-glow', t.glow)
  root.style.setProperty('--area-base', t.base)
  root.style.setProperty('--area-wash', t.wash)
  document.body.dataset.area = id
  document.body.dataset.fx = t.fx
}

/** Deterministic drifting particles (same layout every render, so refreshes do not jump around). */
export function ambientLayer(id: PlaceId): HTMLElement {
  const t = themeOf(id)
  const n = t.fx === 'rain' ? 28 : 16
  const dots = Array.from({ length: n }, (_, i) => {
    const seed = (i * 9301 + 49297) % 233280 / 233280
    const seed2 = (i * 7919 + 1237) % 10007 / 10007
    return h('i', { style: { left: `${(seed * 100).toFixed(1)}%`, animationDelay: `${(-seed2 * 12).toFixed(2)}s`, animationDuration: `${(9 + seed * 9).toFixed(1)}s`, '--sz': `${(2 + seed2 * 5).toFixed(1)}px`, '--dx': `${((seed2 - .5) * 90).toFixed(0)}px` } })
  })
  return h('div', { class: `inv-ambient fx-${t.fx}`, 'aria-hidden': true }, dots)
}

/** Cinematic title card shown when the player enters a new place. */
export class ArrivalCard {
  readonly el = h('aside', { class: 'arrival-card', hidden: true, 'aria-live': 'polite' })
  private timer = 0
  show(place: Place, time: string): void {
    const t = themeOf(place.id)
    window.clearTimeout(this.timer)
    setChildren(this.el,
      h('div', { class: 'arrival-inner' },
        h('small', null, place.district === 'abis' ? 'أبيس • عزبة ١٥' : 'الإسكندرية'),
        h('b', null, place.name),
        h('span', { class: 'arrival-time' }, `وصلت الساعة ${time}`),
        h('span', { class: 'arrival-mood' }, t.mood),
        h('p', null, t.arrive)))
    this.el.hidden = false
    this.el.classList.remove('in', 'out')
    void this.el.offsetWidth
    this.el.classList.add('in')
    this.timer = window.setTimeout(() => {
      this.el.classList.add('out')
      this.timer = window.setTimeout(() => { this.el.hidden = true; this.el.classList.remove('in', 'out') }, 700)
    }, 3600)
  }
  hide(): void {
    window.clearTimeout(this.timer)
    this.el.hidden = true
  }
}
