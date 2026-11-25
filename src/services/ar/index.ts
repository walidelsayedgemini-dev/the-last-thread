/**
 * AR engine service: decides whether a "photograph" proves the player reached a landmark.
 *
 * Two capture sources feed the same pipeline:
 *  - `world`: the in-game camera. Verified by pure geometry (distance + view direction).
 *  - `photo`: a real photo taken in Alexandria. Verified by image quality, plus either
 *     a remote vision provider (AI analysis, needs a server, OFF by default) or the device GPS
 *     being inside the landmark's real-world radius.
 *
 * Providers are small strategy objects so a smarter analyser (server-side vision, on-device ML)
 * can be added without touching the game: implement {@link ArProvider} and register it.
 */
import type { GeoPoint } from '../../data/types'

export type Gps = { lat: number; lng: number; accuracyM?: number }

/** Down-sampled grayscale thumbnail used for cheap quality checks (no full image kept in memory). */
export type LumaSample = { width: number; height: number; luma: Uint8ClampedArray }

export type ArTarget = { id: string; label: string; x: number; z: number; geo?: GeoPoint }

export type ArCapture =
  | { kind: 'world'; x: number; z: number; /** Unit view direction on the ground plane. */ dirX: number; dirZ: number; fovDeg: number }
  | { kind: 'photo'; sample?: LumaSample; gps?: Gps; /** Original file for remote analysis. */ file?: Blob }

export type ArVerdict = {
  ok: boolean
  /** 0..1 */
  confidence: number
  provider: string
  /** Arabic text shown to the player. */
  message: string
  /** True when the result relied on a fallback because AI image analysis is not available offline. */
  needsServer?: boolean
}

export interface ArProvider {
  readonly name: string
  supports(capture: ArCapture): boolean
  verify(target: ArTarget, capture: ArCapture): Promise<ArVerdict>
}

const EARTH_RADIUS_M = 6_371_000

/** Great-circle distance between two coordinates in metres. */
export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Reject photos that are nearly black/white or blurry. Returns an Arabic reason or undefined. */
export function checkPhotoQuality(sample: LumaSample | undefined): string | undefined {
  if (!sample || sample.width < 4 || sample.height < 4) return undefined
  const { width: w, height: h, luma } = sample
  let sum = 0
  for (let i = 0; i < luma.length; i++) sum += luma[i]
  const mean = sum / luma.length
  if (mean < 22) return 'الصورة معتمة جداً… قرّب من مصدر ضوء أو صوّر بالنهار.'
  if (mean > 240) return 'الصورة محروقة من الضوء… غيّر الزاوية.'
  // Sharpness: mean absolute horizontal+vertical gradient. Flat/blurry frames score very low.
  let grad = 0
  let n = 0
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x
      grad += Math.abs(luma[i] - luma[i + 1]) + Math.abs(luma[i] - luma[i + w])
      n += 2
    }
  }
  return grad / n < 1.2 ? 'الصورة مش واضحة… ثبّت الكاميرا وصوّر مرة تانية.' : undefined
}

/** In-game camera check: close enough, and the landmark lies inside the view cone. */
export class WorldCameraProvider implements ArProvider {
  readonly name = 'world-camera'
  constructor(private readonly minDist = 8, private readonly maxDist = 140) {}
  supports(c: ArCapture): boolean {
    return c.kind === 'world'
  }
  async verify(target: ArTarget, c: ArCapture): Promise<ArVerdict> {
    if (c.kind !== 'world') throw new Error('unsupported capture')
    const dx = target.x - c.x
    const dz = target.z - c.z
    const dist = Math.hypot(dx, dz)
    if (dist > this.maxDist) return fail(this.name, 'بعيد قوي عن الهدف… قرّب شوية.')
    if (dist < this.minDist) return fail(this.name, 'قريب زيادة… ارجع لورا عشان المعلم كله يبان في الكادر.')
    const cos = (dx * c.dirX + dz * c.dirZ) / dist
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)))
    const limit = ((c.fovDeg * Math.PI) / 180) * 0.35
    if (angle > limit) return fail(this.name, `لف الكاميرا ناحية ${target.label}… لسه مش في الكادر.`)
    return { ok: true, confidence: Math.max(0.5, 1 - angle / limit / 2), provider: this.name, message: `الكادر مظبوط على ${target.label}.` }
  }
}

/** Real photo accepted when the phone was inside the landmark's real radius (GPS fence). */
export class GeoFenceProvider implements ArProvider {
  readonly name = 'geo-fence'
  supports(c: ArCapture): boolean {
    return c.kind === 'photo'
  }
  async verify(target: ArTarget, c: ArCapture): Promise<ArVerdict> {
    if (c.kind !== 'photo') throw new Error('unsupported capture')
    if (!target.geo) return fail(this.name, 'المعلم ده ما لهوش موقع حقيقي مسجّل.')
    if (!c.gps) return fail(this.name, 'محتاجين إذن الموقع (GPS) عشان نتأكد إنك قدام المكان.')
    const d = haversineM(c.gps, target.geo)
    const slack = Math.min(c.gps.accuracyM ?? 0, 150)
    if (d > target.geo.radiusM + slack) {
      return fail(this.name, `انت على بعد حوالي ${Math.round(d / 100) / 10} كم من ${target.label}. روح المكان الحقيقي وصوّره.`)
    }
    return {
      ok: true, confidence: Math.max(0.55, 1 - d / (target.geo.radiusM * 2)), provider: this.name, needsServer: true,
      message: `تم التحقق من موقعك الحقيقي قدام ${target.label}.`,
    }
  }
}

/**
 * Optional server-side image analysis (a vision model). Disabled until an endpoint is configured.
 * Contract: POST multipart {landmark, image} → JSON {match: boolean, confidence: number}.
 */
export class RemoteVisionProvider implements ArProvider {
  readonly name = 'remote-vision'
  constructor(private readonly endpoint: string | undefined, private readonly timeoutMs = 12_000) {}
  get enabled(): boolean {
    return !!this.endpoint
  }
  supports(c: ArCapture): boolean {
    return this.enabled && c.kind === 'photo' && !!c.file
  }
  async verify(target: ArTarget, c: ArCapture): Promise<ArVerdict> {
    if (c.kind !== 'photo' || !c.file || !this.endpoint) throw new Error('unsupported capture')
    const form = new FormData()
    form.set('landmark', target.id)
    form.set('image', c.file)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs)
    try {
      const res = await fetch(this.endpoint, { method: 'POST', body: form, signal: ctrl.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const out = (await res.json()) as { match?: boolean; confidence?: number }
      const confidence = Math.max(0, Math.min(1, Number(out.confidence) || 0))
      return out.match && confidence >= 0.6
        ? { ok: true, confidence, provider: this.name, message: `الذكاء الاصطناعي تعرّف على ${target.label}.` }
        : fail(this.name, `الذكاء الاصطناعي مش شايف ${target.label} في الصورة دي.`)
    } finally {
      clearTimeout(timer)
    }
  }
}

function fail(provider: string, message: string): ArVerdict {
  return { ok: false, confidence: 0, provider, message }
}

/** Orchestrates providers: quality gate first, then the best available verifier, with fallback. */
export class ArEngine {
  constructor(private readonly providers: ArProvider[]) {}

  async verify(target: ArTarget, capture: ArCapture): Promise<ArVerdict> {
    if (capture.kind === 'photo') {
      const bad = checkPhotoQuality(capture.sample)
      if (bad) return fail('quality', bad)
    }
    for (const provider of this.providers.filter(p => p.supports(capture))) {
      try {
        return await provider.verify(target, capture)
      } catch {
        // Network failure etc.: try the next provider.
      }
    }
    return fail('none', 'مفيش وسيلة تحقق متاحة دلوقتي.')
  }
}

/** Default pipeline: world geometry, then remote AI when configured, then the GPS fence. */
export function createArEngine(remoteEndpoint?: string): ArEngine {
  return new ArEngine([new WorldCameraProvider(), new RemoteVisionProvider(remoteEndpoint), new GeoFenceProvider()])
}
