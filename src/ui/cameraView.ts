/**
 * Photo overlay: a viewfinder over the live 3D view (in-game camera) plus an option to submit a
 * real photograph taken in Alexandria. Verification runs through the AR service
 * (`services/ar`); this view only gathers the capture and shows the verdict.
 */
import type { CaseEvent } from '../core/caseState'
import type { Hotspot } from '../data/types'
import type { Audio } from '../engine/audio'
import type { Session } from '../game/session'
import type { ArCapture, Gps, LumaSample } from '../services/ar'
import { h, setChildren } from './dom'

export type CameraDeps = {
  audio: Audio
  pose: () => { x: number; z: number; dirX: number; dirZ: number; fovDeg: number }
  zoom: (fov: number) => void
  enter: () => void
  exit: () => void
  onEvents: (events: CaseEvent[]) => void
  /** Is a remote AI endpoint configured? (changes the helper text) */
  aiConfigured: () => boolean
}

/** Down-sample an image file to a small grayscale thumbnail for quality checks. */
export async function sampleImage(file: Blob, size = 48): Promise<LumaSample | undefined> {
  try {
    const bmp = await createImageBitmap(file)
    const c = document.createElement('canvas')
    c.width = c.height = size
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.drawImage(bmp, 0, 0, size, size)
    bmp.close?.()
    const px = g.getImageData(0, 0, size, size).data
    const luma = new Uint8ClampedArray(size * size)
    for (let i = 0; i < luma.length; i++) luma[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]
    return { width: size, height: size, luma }
  } catch {
    return undefined
  }
}

function currentGps(timeoutMs = 9000): Promise<Gps | undefined> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(undefined)
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    )
  })
}

export class CameraView {
  readonly el: HTMLElement
  private readonly status: HTMLElement
  private readonly shutter: HTMLButtonElement
  private readonly zoomInput: HTMLInputElement
  private readonly result: HTMLElement
  private readonly file: HTMLInputElement
  private readonly flash: HTMLElement
  private hotspot?: Hotspot
  private session?: Session
  private busy = false

  constructor(private readonly d: CameraDeps) {
    this.status = h('p', { class: 'cam-status' })
    this.shutter = h('button', { class: 'cam-shutter', 'aria-label': 'التقاط', onclick: () => void this.snapWorld() })
    this.zoomInput = h('input', { type: 'range', min: 20, max: 70, value: 50, 'aria-label': 'تقريب', oninput: () => d.zoom(Number(this.zoomInput.value)) })
    this.result = h('div', { class: 'cam-result', hidden: true })
    this.flash = h('div', { class: 'cam-flash' })
    this.file = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: () => void this.snapReal() })
    this.el = h('section', { class: 'camera', hidden: true, 'aria-label': 'الكاميرا' },
      h('div', { class: 'vf' }, h('i', { class: 'c tl' }), h('i', { class: 'c tr' }), h('i', { class: 'c bl' }), h('i', { class: 'c br' }), h('i', { class: 'cross' }), h('span', { class: 'rec' }, '● REC')),
      this.status,
      h('div', { class: 'cam-bar' },
        h('button', { class: 'btn ghost', onclick: () => this.close() }, 'رجوع'),
        this.shutter,
        h('div', { class: 'cam-side' },
          h('label', null, 'تقريب', this.zoomInput),
          h('button', { class: 'btn ghost', onclick: () => this.file.click() }, '📷 صورة حقيقية'))),
      this.result, this.flash, this.file)
  }

  get open(): boolean {
    return !this.el.hidden
  }

  show(session: Session, hotspot: Hotspot): void {
    this.session = session
    this.hotspot = hotspot
    this.el.hidden = false
    this.result.hidden = true
    this.zoomInput.value = '50'
    this.d.zoom(50)
    this.d.enter()
    const place = session.engine.file.hotspots.find(x => x.id === hotspot.id)?.label ?? 'الهدف'
    this.status.textContent = `${place} — وجّه الكاميرا ناحية المعلم واضغط الزر.${this.d.aiConfigured() ? '' : ' (الصور الحقيقية بتتأكد بالموقع GPS)'}`
  }

  close(): void {
    if (this.el.hidden) return
    this.el.hidden = true
    this.d.exit()
  }

  key(e: KeyboardEvent): boolean {
    if (!this.open) return false
    if (e.code === 'Escape' || e.code === 'KeyC') {
      this.close()
      return true
    }
    if (e.code === 'Space' || e.code === 'Enter') {
      void this.snapWorld()
      return true
    }
    return false
  }

  private async submit(capture: ArCapture): Promise<void> {
    if (this.busy || !this.session || !this.hotspot) return
    this.busy = true
    this.shutter.disabled = true
    this.status.textContent = 'جارٍ تحليل الصورة…'
    this.d.audio.play('shutter')
    this.flash.classList.remove('go')
    void this.flash.offsetWidth
    this.flash.classList.add('go')
    try {
      const { verdict, events } = await this.session.photograph(this.hotspot, capture)
      const gained = events.filter(e => e.type === 'evidence')
      setChildren(this.result,
        h('h3', { class: verdict.ok ? 'ok' : 'bad' }, verdict.ok ? 'تم التحليل ✔' : 'الصورة مرفوضة ✖'),
        h('p', null, verdict.message),
        verdict.ok && h('p', { class: 'conf' }, `نسبة الثقة: ${Math.round(verdict.confidence * 100)}٪ • ${verdict.provider === 'geo-fence' ? 'تحقق بالموقع الجغرافي' : verdict.provider === 'remote-vision' ? 'تحليل ذكاء اصطناعي' : 'كاميرا اللعبة'}`),
        verdict.needsServer && h('p', { class: 'hint-small' }, 'ملاحظة: تحليل محتوى الصورة بالذكاء الاصطناعي يحتاج خادم (المرحلة الثانية). حالياً التأكد بموقعك الحقيقي.'),
        gained.length > 0 && h('p', { class: 'gain' }, gained.map(e => (e.type === 'evidence' ? `دليل جديد: ${e.evidence.title}` : '')).join(' • ')),
        h('button', { class: 'btn', onclick: () => { this.result.hidden = true; if (verdict.ok) this.close() } }, verdict.ok ? 'تمام' : 'حاول تاني'))
      this.result.hidden = false
      this.d.onEvents(events)
    } finally {
      this.busy = false
      this.shutter.disabled = false
      this.status.textContent = ''
    }
  }

  private snapWorld(): Promise<void> {
    return this.submit({ kind: 'world', ...this.d.pose() })
  }

  private async snapReal(): Promise<void> {
    const f = this.file.files?.[0]
    this.file.value = ''
    if (!f) return
    this.status.textContent = 'جارٍ قراءة موقعك…'
    const [sample, gps] = await Promise.all([sampleImage(f), currentGps()])
    await this.submit({ kind: 'photo', sample, gps, file: f })
  }
}
