/**
 * ZoneKit: small builder used by the zone files to assemble a district from primitives and the
 * registered models, while recording collision and lamp positions. Materials are cached so a whole
 * district uses a handful of GPU materials (low memory on phones).
 */
import * as THREE from 'three'
import { CollisionWorld } from '../core/collision'
import type { ModelLibrary } from './models'
import type { ModelId } from './assetTable'

export type ZoneId = 'abis' | 'city'

export type Zone = {
  id: ZoneId
  group: THREE.Group
  collision: CollisionWorld
  /** World positions of lamp bulbs; a pooled set of point lights follows the nearest ones. */
  lamps: THREE.Vector3[]
  /** Per-frame animation (trams, boats, flickering screens). */
  tick: (dt: number, time: number, night: number) => void
  /** Footstep material under the player. */
  surface: 'dirt' | 'stone'
}

export type PropOpts = {
  rotY?: number
  /** `box` fits an axis-aligned collider to the footprint; `circle` uses the mean radius. */
  collide?: 'box' | 'circle' | false
  /** Collider scale relative to the footprint (<1 = forgiving). */
  shrink?: number
  y?: number
}

export class ZoneKit {
  readonly group = new THREE.Group()
  readonly collision = new CollisionWorld()
  readonly lamps: THREE.Vector3[] = []
  readonly tickers: ((dt: number, time: number, night: number) => void)[] = []
  private readonly mats = new Map<string, THREE.Material>()
  private readonly boxGeo = new THREE.BoxGeometry(1, 1, 1)
  private readonly planeGeo = new THREE.PlaneGeometry(1, 1)
  private readonly cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10)

  constructor(readonly lib: ModelLibrary) {}

  /** Cached standard material; key by colour + options. */
  mat(color: string, opts: { rough?: number; metal?: number; emissive?: string; emissiveIntensity?: number; map?: THREE.Texture | null } = {}): THREE.MeshStandardMaterial {
    const key = `${color}|${opts.rough ?? 0.9}|${opts.metal ?? 0}|${opts.emissive ?? ''}|${opts.emissiveIntensity ?? 1}|${opts.map?.uuid ?? ''}`
    let m = this.mats.get(key) as THREE.MeshStandardMaterial | undefined
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        // A texture already carries the colour; tinting it again would square the darkness.
        color: opts.map ? '#ffffff' : color, roughness: opts.rough ?? 0.9, metalness: opts.metal ?? 0, map: opts.map ?? null,
        emissive: opts.emissive ?? '#000000', emissiveIntensity: opts.emissiveIntensity ?? 1,
      })
      this.mats.set(key, m)
    }
    return m
  }

  /** Unlit glowing material (bulbs, screens) so bloom and fog treat it as a light source. */
  glow(color: string): THREE.MeshBasicMaterial {
    const key = `glow|${color}`
    let m = this.mats.get(key) as THREE.MeshBasicMaterial | undefined
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, fog: true })
      this.mats.set(key, m)
    }
    return m
  }

  /** Horizontal rectangle lying on the ground (`y` lifts roads above the ground to avoid z-fighting). */
  plane(cx: number, cz: number, w: number, d: number, material: THREE.Material, y = 0): THREE.Mesh {
    const m = new THREE.Mesh(this.planeGeo, material)
    m.rotation.x = -Math.PI / 2
    m.scale.set(w, d, 1)
    m.position.set(cx, y, cz)
    m.receiveShadow = true
    this.group.add(m)
    return m
  }

  /** Box centred at (cx, cz) standing on `y`. */
  box(cx: number, cz: number, w: number, h: number, d: number, material: THREE.Material, opts: { y?: number; rotY?: number; collide?: boolean; shadow?: boolean } = {}): THREE.Mesh {
    const m = new THREE.Mesh(this.boxGeo, material)
    m.scale.set(w, h, d)
    m.position.set(cx, (opts.y ?? 0) + h / 2, cz)
    m.rotation.y = opts.rotY ?? 0
    m.castShadow = opts.shadow !== false
    m.receiveShadow = true
    this.group.add(m)
    if (opts.collide) this.collision.addRect(cx, cz, w, d)
    return m
  }

  cylinder(cx: number, cz: number, r: number, h: number, material: THREE.Material, opts: { y?: number; collide?: boolean } = {}): THREE.Mesh {
    const m = new THREE.Mesh(this.cylGeo, material)
    m.scale.set(r, h, r)
    m.position.set(cx, (opts.y ?? 0) + h / 2, cz)
    m.castShadow = true
    m.receiveShadow = true
    this.group.add(m)
    if (opts.collide) this.collision.addCircle({ x: cx, z: cz, r })
    return m
  }

  /** A registered model scaled to `size` metres on its longest side. */
  prop(id: ModelId, size: number, x: number, z: number, opts: PropOpts = {}): THREE.Group {
    const { root, half } = this.lib.prop(id, size)
    root.position.set(x, opts.y ?? 0, z)
    root.rotation.y = opts.rotY ?? 0
    this.group.add(root)
    if (opts.collide) {
      const k = opts.shrink ?? 0.85
      const quarter = Math.abs(Math.round((opts.rotY ?? 0) / (Math.PI / 2))) % 2 === 1
      const hx = (quarter ? half.z : half.x) * k
      const hz = (quarter ? half.x : half.z) * k
      if (opts.collide === 'box') this.collision.addRect(x, z, hx * 2, hz * 2)
      else this.collision.addCircle({ x, z, r: (hx + hz) / 2 })
    }
    return root
  }

  /** Street lamp: model plus a glowing bulb; registers the bulb position for the light pool. */
  lamp(x: number, z: number, rotY = 0): void {
    const size = 5.2
    this.prop('props/street_lamp', size, x, z, { rotY, collide: 'circle', shrink: 0.35 })
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), this.glow('#ffc070'))
    bulb.position.set(x, size * 0.93, z)
    this.group.add(bulb)
    this.lamps.push(new THREE.Vector3(x, size * 0.9, z))
  }

  /** Sign plane facing +Z (towards the viewer standing south of it). */
  sign(texture: THREE.Texture, cx: number, y: number, cz: number, w: number, h: number): THREE.Mesh {
    const m = new THREE.Mesh(this.planeGeo, new THREE.MeshBasicMaterial({ map: texture, fog: true }))
    m.scale.set(w, h, 1)
    m.position.set(cx, y, cz)
    this.group.add(m)
    return m
  }

  toZone(id: ZoneId, surface: Zone['surface']): Zone {
    const tickers = this.tickers
    return { id, group: this.group, collision: this.collision, lamps: this.lamps, surface, tick: (dt, t, n) => tickers.forEach(fn => fn(dt, t, n)) }
  }
}

/** Deterministic pseudo-random so the world is identical on every load. */
export function seeded(seed: number): () => number {
  let s = seed
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296)
}
