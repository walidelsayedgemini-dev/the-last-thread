/**
 * Extra polish modules: read-aloud, evidence magnifier, travel cut-scene, "last time" recap,
 * save chip, day/night + weather and dialogue moods. All are plain DOM and keep no game state.
 */
import { formatClock } from '../core/clock'
import { h, setChildren, svg } from './dom'

// ---- Read aloud (Web Speech, offline-safe: hidden when the browser has no voices) -----------------------------
export const speech = {
  supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
  },
  speaking(): boolean {
    return this.supported() && window.speechSynthesis.speaking
  },
  stop(): void {
    if (this.supported()) window.speechSynthesis.cancel()
  },
  speak(text: string, onEnd?: () => void): void {
    if (!this.supported()) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/[«»…]/g, ' '))
    const voices = window.speechSynthesis.getVoices()
    const voice = voices.find(v => /^ar[-_]EG/i.test(v.lang)) ?? voices.find(v => /^ar/i.test(v.lang))
    if (voice) u.voice = voice
    u.lang = voice?.lang ?? 'ar-EG'
    u.rate = 0.92
    u.onend = () => onEnd?.()
    u.onerror = () => onEnd?.()
    window.speechSynthesis.speak(u)
  },
}

/** A small button that reads `getText()` aloud and toggles to stop. */
export function speakButton(getText: () => string, cls = 'speak-btn'): HTMLElement | undefined {
  if (!speech.supported()) return undefined
  const btn = h('button', { class: cls, type: 'button', 'aria-label': 'اقرا لي بصوت عالي' }, h('span', { 'aria-hidden': true }, '🔊'), ' اقرا لي')
  btn.addEventListener('click', e => {
    e.stopPropagation()
    if (btn.classList.contains('on')) { speech.stop(); btn.classList.remove('on'); return }
    btn.classList.add('on')
    speech.speak(getText(), () => btn.classList.remove('on'))
  })
  return btn
}

export function buzz(ms = 25): void {
  if (document.body.classList.contains('reduced-motion')) return
  try { navigator.vibrate?.(ms) } catch { /* not supported */ }
}

// ---- Day / night / weather ------------------------------------------------------------------------------------
export type Tod = 'dawn' | 'day' | 'dusk' | 'night'
export const TOD_LABEL: Record<Tod, string> = { dawn: 'فجر', day: 'نهار', dusk: 'غروب', night: 'ليل' }
export const TOD_ICON: Record<Tod, string> = { dawn: '🌅', day: '☀', dusk: '🌇', night: '🌙' }
export function todOf(hour: number): Tod {
  const hr = ((hour % 24) + 24) % 24
  if (hr >= 5 && hr < 7.5) return 'dawn'
  if (hr >= 7.5 && hr < 16.5) return 'day'
  if (hr >= 16.5 && hr < 19) return 'dusk'
  return 'night'
}
/** Rain is rare and only in the city, on every third in-game day, towards evening. */
export function weatherOf(tod: Tod, district: 'abis' | 'city', day: number): 'rain' | 'clear' {
  return district === 'city' && day % 3 === 0 && (tod === 'dusk' || tod === 'night') ? 'rain' : 'clear'
}
export function applyWorldTime(hour: number, district: 'abis' | 'city', day: number): Tod {
  const tod = todOf(hour)
  document.body.dataset.tod = tod
  document.body.dataset.weather = weatherOf(tod, district, day)
  document.querySelectorAll('.inv-tod-chip').forEach(el => { el.textContent = `${TOD_ICON[tod]} ${TOD_LABEL[tod]} • ${formatClock(hour)}` })
  return tod
}
export function rainLayer(): HTMLElement {
  const drops = Array.from({ length: 26 }, (_, i) => {
    const a = (i * 9301 + 49297) % 233280 / 233280
    const b = (i * 7919 + 1237) % 10007 / 10007
    return h('i', { style: { left: `${(a * 100).toFixed(1)}%`, animationDelay: `${(-b * 2).toFixed(2)}s`, animationDuration: `${(.6 + a * .5).toFixed(2)}s` } })
  })
  return h('div', { class: 'inv-rain', 'aria-hidden': true }, drops)
}

// ---- Dialogue moods (derived from the text, no extra data needed) ---------------------------------------------
export type Mood = 'calm' | 'shout' | 'sad' | 'ask' | 'fear'
export const MOOD_LABEL: Record<Mood, string> = { calm: '', shout: 'منفعل', sad: 'حزين', ask: 'بيسأل', fear: 'خايف' }
export function moodOf(text: string): Mood {
  if (/خايف|مرعوب|خوف|ارتجف|بيرتعش|ماتقولش لحد/.test(text)) return 'fear'
  if (/!|！/.test(text)) return 'shout'
  if (/…|\.\.\.|وحشني|مات|اتوفى|ماتت|غرق|حزين|وجع/.test(text)) return 'sad'
  if (/[؟?]/.test(text)) return 'ask'
  return 'calm'
}

// ---- Evidence magnifier ---------------------------------------------------------------------------------------
export class LensView {
  readonly el = h('div', { class: 'lens-layer', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'فحص الدليل بالعدسة' })
  get open(): boolean { return !this.el.hidden }
  show(art: { src: string; alt: string }, title: string, summary: string, detail: string): void {
    const zoom = 2.6
    const size = 150
    const img = h('img', { class: 'lens-img', src: art.src, alt: art.alt, draggable: 'false' })
    const glass = h('div', { class: 'lens-glass', 'aria-hidden': true })
    glass.style.backgroundImage = `url("${art.src}")`
    const stage = h('div', { class: 'lens-stage' }, img, glass)
    const move = (e: PointerEvent) => {
      const r = img.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      const inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height
      glass.style.opacity = inside ? '1' : '0'
      if (!inside) return
      glass.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`
      glass.style.backgroundSize = `${r.width * zoom}px ${r.height * zoom}px`
      glass.style.backgroundPosition = `${-(x * zoom - size / 2)}px ${-(y * zoom - size / 2)}px`
      const rx = ((y / r.height) - .5) * -6
      const ry = ((x / r.width) - .5) * 6
      stage.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`
    }
    stage.addEventListener('pointermove', move)
    stage.addEventListener('pointerdown', move)
    stage.addEventListener('pointerleave', () => { glass.style.opacity = '0'; stage.style.transform = '' })
    setChildren(this.el,
      h('div', { class: 'lens-backdrop', onclick: () => this.hide() }),
      h('article', { class: 'lens-card' },
        h('button', { class: 'lens-close', 'aria-label': 'قفل', onclick: () => this.hide() }, '×'),
        h('small', null, 'فحص بالعدسة'),
        h('h3', null, title),
        stage,
        h('p', { class: 'lens-tip' }, 'حرّك صباعك أو الماوس على الصورة علشان تكبّر التفاصيل.'),
        h('p', { class: 'lens-note' }, h('b', null, 'ملاحظة المحقق: '), summary),
        h('p', { class: 'lens-detail' }, detail)))
    this.el.hidden = false
  }
  hide(): void { this.el.hidden = true }
  key(e: KeyboardEvent): boolean {
    if (!this.open) return false
    if (e.code === 'Escape' || e.code === 'Enter') { this.hide(); return true }
    return false
  }
}

// ---- Travel cut-scene -----------------------------------------------------------------------------------------
export class TravelView {
  readonly el = h('div', { class: 'travel-layer', hidden: true, role: 'status', 'aria-live': 'polite' })
  private raf = 0
  private done?: () => void
  get open(): boolean { return !this.el.hidden }
  play(from: 'abis' | 'city', to: 'abis' | 'city', onDone: () => void): void {
    cancelAnimationFrame(this.raf)
    this.done = onDone
    const toCity = from === 'abis' && to === 'city'
    const W = 400
    const H = 250
    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'travel-map', 'aria-hidden': 'true' })
    const add = (tag: 'rect' | 'path' | 'circle' | 'text' | 'g', attrs: Record<string, string | number>, text?: string) => {
      const el = svg(tag, attrs)
      if (text) el.textContent = text
      root.append(el)
      return el
    }
    add('rect', { width: W, height: H, class: 't-land' })
    add('rect', { width: W, height: 70, class: 't-sea' })
    add('path', { d: `M0 70 C70 56 130 84 210 66 S340 56 400 72 L400 0 L0 0Z`, class: 't-sea' })
    for (let i = 0; i < 6; i++) add('path', { d: `M${20 + i * 62} ${24 + (i % 2) * 14} q8 -5 16 0 t16 0`, class: 't-wave' })
    for (let i = 0; i < 5; i++) add('rect', { x: 20 + i * 24, y: 170 + (i % 2) * 10, width: 16, height: 10, class: 't-field' })
    add('path', { d: 'M40 205 C110 190 150 150 215 135 S320 100 360 88', class: 't-road' })
    add('path', { d: 'M40 205 C110 190 150 150 215 135 S320 100 360 88', class: 't-road-dash' })
    add('circle', { cx: 40, cy: 205, r: 9, class: 't-node' })
    add('circle', { cx: 360, cy: 88, r: 9, class: 't-node' })
    add('text', { x: 40, y: 232, class: 't-label', 'text-anchor': 'middle' }, 'أبيس')
    add('text', { x: 360, y: 72, class: 't-label', 'text-anchor': 'middle' }, 'الإسكندرية')
    for (let i = 0; i < 4; i++) add('rect', { x: 340 + i * 9, y: 98 + (i % 2) * 6, width: 7, height: 14 + (i % 3) * 5, class: 't-bld' })
    const road = root.querySelector<SVGPathElement>('.t-road')!
    const bus = svg('g', { class: 't-bus' })
    bus.append(svg('rect', { x: -13, y: -8, width: 26, height: 14, rx: 3, class: 't-bus-body' }), svg('rect', { x: -9, y: -5, width: 18, height: 5, class: 't-bus-win' }), svg('circle', { cx: -7, cy: 6, r: 3, class: 't-bus-wheel' }), svg('circle', { cx: 7, cy: 6, r: 3, class: 't-bus-wheel' }))
    root.append(bus)
    const lines = toCity
      ? ['الميكروباص طلع من موقف أبيس…', 'الترعة وراك، والغيطان بتجري ناحية الشباك.', 'ريحة البحر بدأت تظهر… «رمل رمل رمل!»']
      : ['الميكروباص راجع على أبيس…', 'الأنوار بتقل، والطريق بيهدى.', 'ريحة الطين والترعة… وصلت.']
    const text = h('p', { class: 'travel-line' }, lines[0])
    setChildren(this.el,
      h('div', { class: 'travel-card' },
        h('small', null, toCity ? 'من أبيس إلى الإسكندرية' : 'من الإسكندرية إلى أبيس'),
        root, text,
        h('button', { class: 'travel-skip', onclick: () => this.finish() }, 'تخطي ▸')))
    this.el.hidden = false
    const total = road.getTotalLength()
    const reduced = document.body.classList.contains('reduced-motion')
    const dur = reduced ? 500 : 2800
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur)
      const d = (toCity ? k : 1 - k) * total
      const p = road.getPointAtLength(d)
      const q = road.getPointAtLength(Math.min(total, d + 1))
      const angle = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI
      bus.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${angle}) scale(${toCity ? 1 : -1}, 1)`)
      text.textContent = lines[Math.min(2, Math.floor(k * 3))]
      if (k < 1) this.raf = requestAnimationFrame(step)
      else window.setTimeout(() => this.finish(), 350)
    }
    this.raf = requestAnimationFrame(step)
  }
  finish(): void {
    if (this.el.hidden) return
    cancelAnimationFrame(this.raf)
    this.el.hidden = true
    const cb = this.done
    this.done = undefined
    cb?.()
  }
  key(e: KeyboardEvent): boolean {
    if (!this.open) return false
    if (['Escape', 'Enter', 'Space'].includes(e.code)) { this.finish(); return true }
    return false
  }
}

// ---- "Last time" recap ----------------------------------------------------------------------------------------
export type RecapData = { chapter: string; kicker: string; evidence: number; total: number; letters: number; lastLetter?: string; next?: string; nextDetail?: string }
export class RecapView {
  readonly el = h('div', { class: 'recap-layer', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'اللي فات' })
  get open(): boolean { return !this.el.hidden }
  show(d: RecapData, onDone: () => void): void {
    setChildren(this.el,
      h('div', { class: 'help-backdrop' }),
      h('article', { class: 'help-card recap-card' },
        h('small', null, 'اللي فات'),
        h('h2', null, 'أهلاً بيك تاني يا ياسين'),
        h('ul', { class: 'recap-list' },
          h('li', null, h('b', null, 'فين وصلت؟ '), `${d.chapter} — ${d.kicker}`),
          h('li', null, h('b', null, 'اللي معاك: '), `${d.evidence} من ${d.total} دليل${d.letters ? ` و${d.letters} جواب` : ''}`),
          d.lastLetter && h('li', null, h('b', null, 'آخر جواب: '), d.lastLetter),
          d.next && h('li', { class: 'recap-next' }, h('b', null, 'الخطوة الجاية: '), d.next, d.nextDetail && h('em', null, ` — ${d.nextDetail}`))),
        h('button', { class: 'btn primary', onclick: () => { this.hide(); onDone() } }, 'كمّل التحقيق')))
    this.el.hidden = false
  }
  hide(): void { this.el.hidden = true }
  key(e: KeyboardEvent): boolean {
    if (!this.open) return false
    if (e.code === 'Escape' || e.code === 'Enter') { this.hide(); return true }
    return false
  }
}

// ---- Save chip ------------------------------------------------------------------------------------------------
export class SaveChip {
  readonly el = h('div', { class: 'save-chip', hidden: true, 'aria-live': 'polite' }, '✓ اتحفظ')
  private timer = 0
  flash(): void {
    window.clearTimeout(this.timer)
    this.el.hidden = false
    this.el.classList.remove('in')
    void this.el.offsetWidth
    this.el.classList.add('in')
    this.timer = window.setTimeout(() => { this.el.hidden = true }, 1800)
  }
}

// ---- Juice: evidence card flying to the file, thread burst, camera shutter ------------------------------------
export class FlashFx {
  readonly el = h('div', { class: 'fx-layer', 'aria-hidden': 'true' })
  /** A polaroid pops up, then flies to the case-file button. */
  evidence(title: string, art?: { src: string }): void {
    const card = h('div', { class: 'ev-fly' },
      art ? h('img', { src: art.src, alt: '', draggable: 'false' }) : h('span', { class: 'ev-fly-icon' }, '▣'),
      h('b', null, title), h('small', null, 'اتضاف لملف القضية'))
    this.el.append(card)
    const target = [...document.querySelectorAll<HTMLElement>('.inv-file-action, .inv-mobile-file')].find(el => el.offsetParent !== null)
    const reduced = document.body.classList.contains('reduced-motion')
    const done = () => card.remove()
    if (reduced || !card.animate) { window.setTimeout(done, 1800); return }
    const pop = card.animate([
      { opacity: 0, transform: 'translate(-50%, -30%) scale(.5) rotate(-8deg)' },
      { opacity: 1, transform: 'translate(-50%, -50%) scale(1) rotate(-2deg)', offset: .35 },
      { opacity: 1, transform: 'translate(-50%, -50%) scale(1) rotate(-2deg)' },
    ], { duration: 1500, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'forwards' })
    pop.onfinish = () => {
      const r = card.getBoundingClientRect()
      const t = target?.getBoundingClientRect()
      const dx = t ? t.left + t.width / 2 - (r.left + r.width / 2) : 0
      const dy = t ? t.top + t.height / 2 - (r.top + r.height / 2) : -200
      const fly = card.animate([
        { transform: 'translate(-50%, -50%) scale(1) rotate(-2deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.12) rotate(12deg)`, opacity: .2 },
      ], { duration: 650, easing: 'cubic-bezier(.6,0,.9,.4)', fill: 'forwards' })
      fly.onfinish = () => { done(); target?.classList.add('file-bump'); window.setTimeout(() => target?.classList.remove('file-bump'), 500) }
    }
  }
  /** Red threads burst outwards when two clues connect. */
  thread(): void {
    const burst = h('div', { class: 'thread-burst' })
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + (i % 2) * .1
      const d = 120 + (i * 37 % 140)
      burst.append(h('i', { style: { '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d}px`, '--rot': `${a}rad`, animationDelay: `${(i % 4) * 25}ms` } }))
    }
    this.el.append(burst)
    window.setTimeout(() => burst.remove(), 1300)
  }
  /** Viewfinder + white flash for photo hotspots. */
  shutter(): void {
    const s = h('div', { class: 'shutter' }, h('span', { class: 'vf tl' }), h('span', { class: 'vf tr' }), h('span', { class: 'vf bl' }), h('span', { class: 'vf br' }), h('span', { class: 'vf-dot' }, 'REC'))
    this.el.append(s)
    window.setTimeout(() => s.remove(), 900)
  }
}

/** Horizontal / downward swipe helper for touch screens. */
export function onSwipe(el: HTMLElement, h: { left?: () => void; right?: () => void; down?: () => void; ignore?: (t: EventTarget | null) => boolean }): void {
  let x = 0, y = 0, t = 0, on = false
  el.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || h.ignore?.(e.target)) { on = false; return }
    x = e.touches[0].clientX; y = e.touches[0].clientY; t = Date.now(); on = true
  }, { passive: true })
  el.addEventListener('touchend', e => {
    if (!on) return
    on = false
    const c = e.changedTouches[0]
    const dx = c.clientX - x, dy = c.clientY - y
    if (Date.now() - t > 600) return
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.8) (dx < 0 ? h.left : h.right)?.()
    else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.8) h.down?.()
  }, { passive: true })
}
