/**
 * Atmosphere: hour-keyed palette for sky, fog, sun/moon and ambient light.
 *
 * The look is deliberately noir: low light levels, desaturated daytime, a short orange dusk, then
 * deep blue nights with yellow lamps. `paletteAt` is pure (unit-tested); `Atmosphere` applies it to
 * the three.js scene every frame at negligible cost (one lerp per colour, no allocations).
 */
import * as THREE from 'three'
import { CONFIG } from './config'

export type Palette = {
  skyTop: string
  skyHorizon: string
  fog: string
  fogDensity: number
  sun: string
  sunIntensity: number
  hemiSky: string
  hemiGround: string
  hemiIntensity: number
}

/** Keyframes by hour of day; the list wraps from 24 back to 0. */
export const KEYS: { h: number; p: Palette }[] = [
  { h: 0, p: { skyTop: '#02040a', skyHorizon: '#0b1122', fog: '#0a0f1a', fogDensity: 0.013, sun: '#6b7fb0', sunIntensity: 0.35, hemiSky: '#1b2640', hemiGround: '#1a1512', hemiIntensity: 0.55 } },
  { h: 5, p: { skyTop: '#05091a', skyHorizon: '#1a1d30', fog: '#12141f', fogDensity: 0.013, sun: '#6b7fb0', sunIntensity: 0.3, hemiSky: '#1b2640', hemiGround: '#1a1512', hemiIntensity: 0.55 } },
  { h: 6.5, p: { skyTop: '#2a2d4a', skyHorizon: '#9a4f3a', fog: '#4a3430', fogDensity: 0.011, sun: '#ff9a5a', sunIntensity: 0.9, hemiSky: '#53506a', hemiGround: '#1c1612', hemiIntensity: 0.7 } },
  { h: 9, p: { skyTop: '#3d566f', skyHorizon: '#8c9aa2', fog: '#6b757a', fogDensity: 0.007, sun: '#fff0d8', sunIntensity: 1.5, hemiSky: '#8296a8', hemiGround: '#2a241d', hemiIntensity: 0.85 } },
  { h: 12.5, p: { skyTop: '#46607d', skyHorizon: '#9eaab0', fog: '#7a868a', fogDensity: 0.006, sun: '#fff4e0', sunIntensity: 1.8, hemiSky: '#93a6b6', hemiGround: '#2d261e', hemiIntensity: 0.9 } },
  { h: 16, p: { skyTop: '#44566f', skyHorizon: '#b09474', fog: '#80725f', fogDensity: 0.007, sun: '#ffd49a', sunIntensity: 1.5, hemiSky: '#8a8f9b', hemiGround: '#2a2119', hemiIntensity: 0.8 } },
  { h: 17.8, p: { skyTop: '#3a3350', skyHorizon: '#dd6f33', fog: '#5a3a30', fogDensity: 0.009, sun: '#ff7a30', sunIntensity: 1.1, hemiSky: '#6b5a66', hemiGround: '#3a2a22', hemiIntensity: 0.65 } },
  { h: 19, p: { skyTop: '#1a1830', skyHorizon: '#7a3a3a', fog: '#2a1a22', fogDensity: 0.011, sun: '#a84a40', sunIntensity: 0.45, hemiSky: '#3b3555', hemiGround: '#2a1d1a', hemiIntensity: 0.55 } },
  { h: 20.5, p: { skyTop: '#080a1c', skyHorizon: '#1e1826', fog: '#141420', fogDensity: 0.013, sun: '#6b7fb0', sunIntensity: 0.32, hemiSky: '#1d2842', hemiGround: '#1a1512', hemiIntensity: 0.55 } },
  { h: 24, p: { skyTop: '#02040a', skyHorizon: '#0b1122', fog: '#0a0f1a', fogDensity: 0.013, sun: '#6b7fb0', sunIntensity: 0.35, hemiSky: '#1b2640', hemiGround: '#1a1512', hemiIntensity: 0.55 } },
]

const COLOR_KEYS = ['skyTop', 'skyHorizon', 'fog', 'sun', 'hemiSky', 'hemiGround'] as const
const NUM_KEYS = ['fogDensity', 'sunIntensity', 'hemiIntensity'] as const

const scratchA = new THREE.Color()
const scratchB = new THREE.Color()

/** Interpolated palette (colours as THREE.Color written into `out`). */
export function paletteAt(hour: number, out: Record<(typeof COLOR_KEYS)[number], THREE.Color> & Record<(typeof NUM_KEYS)[number], number>): void {
  const h = ((hour % 24) + 24) % 24
  let i = 0
  while (i < KEYS.length - 2 && h >= KEYS[i + 1].h) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const t = (h - a.h) / (b.h - a.h)
  const s = t * t * (3 - 2 * t)
  for (const k of COLOR_KEYS) out[k].copy(scratchA.set(a.p[k])).lerp(scratchB.set(b.p[k]), s)
  for (const k of NUM_KEYS) out[k] = a.p[k] + (b.p[k] - a.p[k]) * s
}

/** 0 = broad daylight, 1 = deep night. */
export function nightFactor(hour: number): number {
  const h = ((hour % 24) + 24) % 24
  if (h >= 20.5 || h < 5) return 1
  if (h >= 7 && h < 17) return 0
  if (h >= 17) return (h - 17) / 3.5
  return 1 - (h - 5) / 2
}

const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`
const SKY_FRAG = `uniform vec3 top; uniform vec3 horizon; varying vec3 vDir;
void main(){ float t = pow(clamp(vDir.y, 0.0, 1.0), 0.55); gl_FragColor = vec4(mix(horizon, top, t), 1.0); }`

export class Atmosphere {
  readonly sun: THREE.DirectionalLight
  readonly hemi: THREE.HemisphereLight
  private readonly sky: THREE.Mesh
  private readonly stars: THREE.Points
  private readonly fog: THREE.FogExp2
  private readonly pal = {
    skyTop: new THREE.Color(), skyHorizon: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(),
    hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), fogDensity: 0, sunIntensity: 0, hemiIntensity: 0,
  }
  private readonly uniforms = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } }
  night = 0

  constructor(private readonly scene: THREE.Scene, shadowSize: number, shadows: boolean) {
    this.fog = new THREE.FogExp2('#0a0f1a', 0.01)
    scene.fog = this.fog
    this.hemi = new THREE.HemisphereLight('#334', '#111', 0.6)
    this.sun = new THREE.DirectionalLight('#fff', 1)
    this.sun.castShadow = shadows
    this.sun.shadow.mapSize.set(shadowSize, shadowSize)
    const cam = this.sun.shadow.camera
    cam.left = -34; cam.right = 34; cam.top = 34; cam.bottom = -34; cam.near = 1; cam.far = 160
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.04
    scene.add(this.hemi, this.sun, this.sun.target)

    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 24, 12),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false }),
    )
    this.sky.renderOrder = -10
    this.sky.frustumCulled = false
    scene.add(this.sky)

    const pts = new Float32Array(320 * 3)
    for (let i = 0; i < 320; i++) {
      const a = Math.random() * Math.PI * 2
      const e = Math.acos(Math.random() * 0.92 + 0.08) // keep above the horizon haze
      pts.set([Math.sin(e) * Math.cos(a) * 850, Math.cos(e) * 850, Math.sin(e) * Math.sin(a) * 850], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3))
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#cdd6f0', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }))
    this.stars.frustumCulled = false
    scene.add(this.stars)
  }

  /** Apply the palette for `hour`, centred on `focus` so the shadow box follows the player. */
  update(hour: number, focus: THREE.Vector3, renderer: THREE.WebGLRenderer): void {
    paletteAt(hour, this.pal)
    this.night = nightFactor(hour)
    const p = this.pal
    this.uniforms.top.value.copy(p.skyTop)
    this.uniforms.horizon.value.copy(p.skyHorizon)
    this.fog.color.copy(p.fog)
    this.fog.density = p.fogDensity * CONFIG.atmosphere.fog
    this.hemi.color.copy(p.hemiSky)
    this.hemi.groundColor.copy(p.hemiGround)
    this.hemi.intensity = p.hemiIntensity * 2.9
    this.sun.color.copy(p.sun)
    this.sun.intensity = p.sunIntensity
    // Sun by day (east → west), moon by night from the opposite side and higher up.
    const h = ((hour % 24) + 24) % 24
    const day = h >= 6 && h <= 18
    const u = day ? (h - 6) / 12 : ((h + 6) % 24) / 12
    const az = Math.PI * (1 - u)
    const el = Math.max(0.18, Math.sin(Math.PI * u)) * (day ? 1.05 : 0.8)
    this.sun.position.set(focus.x + Math.cos(az) * 70, focus.y + Math.sin(el) * 90 + 8, focus.z + Math.sin(az * 0.6) * 40 - 30)
    this.sun.target.position.copy(focus)
    this.sun.target.updateMatrixWorld()
    this.sky.position.copy(focus)
    this.stars.position.copy(focus)
    ;(this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, this.night - 0.15)
    renderer.toneMappingExposure = CONFIG.atmosphere.darkness
    this.scene.background = null
  }
}
