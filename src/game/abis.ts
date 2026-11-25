/**
 * Abis / Ezbet 15 – the village district. Dim dirt roads, a canal with a concrete bridge, farm
 * plots, the mosque, Ragab's café and the microbus stop. Coordinates follow `data/places.ts`.
 */
import * as THREE from 'three'
import { PLACES } from '../data/places'
import type { ModelId } from './assetTable'
import { noiseTexture, rowsTexture, signTexture } from './textures'
import { seeded, ZoneKit, type Zone } from './zoneKit'
import type { ModelLibrary } from './models'

export const ABIS_MODELS: ModelId[] = [
  'buildings/village_house', 'buildings/village_mosque', 'nature/palm_tree', 'nature/water_buffalo', 'vehicles/microbus',
  'vehicles/tuktuk', 'props/street_lamp', 'props/sewing_machine',
]

const Q = Math.PI / 2

export function buildAbis(lib: ModelLibrary): Zone {
  const k = new ZoneKit(lib)
  const rnd = seeded(15)
  k.collision.bounds = { minX: -110, maxX: 230, minZ: 118, maxZ: 318 }

  // ---- Ground, fields and roads -------------------------------------------------------------
  const earth = k.mat('#85715a', { map: noiseTexture('#85715a', 0.35, 40, 3), rough: 1 })
  const road = k.mat('#4a4036', { map: noiseTexture('#4a4036', 0.5, 14, 5), rough: 1 })
  const grass = k.mat('#4d5a3a', { map: rowsTexture('#46532f', '#3a4728', 10, 8), rough: 1 })
  const crop = k.mat('#59663f', { map: rowsTexture('#52603a', '#3d4a2b', 8, 6), rough: 1 })
  k.plane(60, 220, 420, 300, earth)
  k.plane(150, 168, 52, 42, crop, 0.01) // plot 15
  k.plane(-45, 176, 80, 38, grass, 0.01)
  k.plane(60, 130, 340, 22, grass, 0.01) // north bank of the canal
  k.plane(190, 255, 60, 60, grass, 0.01)
  k.plane(60, 215, 340, 7, road, 0.02) // main road
  k.plane(40, 224, 5, 18, road, 0.02) // to Zeinab's house
  k.plane(78, 240, 5, 50, road, 0.02) // to the mosque
  k.plane(40, 183, 5, 66, road, 0.02) // towards the bridge
  k.plane(-30, 200, 5, 30, road, 0.02) // to the bus stop

  // ---- Canal and bridge ------------------------------------------------------------------------
  const water = k.mat('#0d2230', { rough: 0.15, metal: 0.35 })
  k.plane(60, 150, 340, 14, water, -0.12)
  k.collision.addBox({ minX: -110, maxX: 33.5, minZ: 143.5, maxZ: 156.5 })
  k.collision.addBox({ minX: 46.5, maxX: 230, minZ: 143.5, maxZ: 156.5 })
  const concrete = k.mat('#7b7770', { rough: 0.95 })
  k.box(40, 150, 12, 0.35, 15, concrete, { y: -0.3, shadow: true })
  for (const side of [-1, 1]) k.box(40 + side * 5.8, 150, 0.4, 0.9, 15, concrete, { collide: true })

  // ---- Houses, mosque -----------------------------------------------------------------------------
  const zp = PLACES.zeinab_home.pos
  const mp = PLACES.mahmoud_house.pos
  const mo = PLACES.abis_mosque.pos
  k.prop('buildings/village_house', 7.5, zp.x, zp.z, { rotY: Math.PI, collide: 'box' })
  k.prop('buildings/village_house', 7.5, mp.x, mp.z, { rotY: 0, collide: 'box' })
  k.prop('buildings/village_mosque', 13, mo.x, mo.z, { rotY: Math.PI, collide: 'box' })
  const fillers: [number, number, number][] = [
    [-30, 242, Math.PI], [8, 250, Math.PI], [110, 244, Math.PI], [140, 252, Math.PI], [172, 236, Math.PI], [-62, 238, Math.PI],
    [-78, 196, 0], [135, 204, 0], [172, 205, 0], [20, 186, 0],
  ]
  for (const [x, z, r] of fillers) k.prop('buildings/village_house', 6 + rnd() * 2, x, z, { rotY: r, collide: 'box' })

  // ---- Zeinab's porch with the sewing machine ----------------------------------------------------
  k.prop('props/sewing_machine', 1.2, zp.x - 6, zp.z - 9, { rotY: Q, y: 0.78 })
  k.box(zp.x - 6, zp.z - 9, 1.6, 0.78, 0.9, k.mat('#5a4330'), { collide: true })

  // ---- Ragab's café -----------------------------------------------------------------------------------
  const cp = PLACES.cafe_ragab.pos
  const wood = k.mat('#5b4733', { rough: 0.8 })
  const darkWood = k.mat('#2e2318')
  k.box(cp.x, cp.z + 4, 15, 0.06, 11, k.mat('#3b3631', { map: noiseTexture('#3b3631', 0.4, 4, 9) }), { y: 0.02, shadow: false })
  k.box(cp.x, cp.z - 1.2, 13, 3.4, 0.5, k.mat('#8a7d68'), { collide: true })
  k.sign(signTexture('قهوة الأصحاب', { fg: '#f0e6cc' }), cp.x, 2.6, cp.z - 0.9, 5.2, 1.6)
  for (const [dx, dz] of [[-6.5, -0.6], [6.5, -0.6], [-6.5, 9], [6.5, 9]] as const) k.cylinder(cp.x + dx, cp.z + dz, 0.12, 3.2, darkWood, { collide: true })
  // Single-sided roof: visible from below only, so the follow-camera never gets stuck inside it.
  const roof = k.plane(cp.x, cp.z + 4.2, 14.5, 11, k.mat('#334526', { rough: 1 }), 3.2)
  roof.rotation.x = Math.PI / 2
  roof.name = 'vine-roof'
  const bulbMat = k.glow('#ffd28a')
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), bulbMat)
    b.position.set(cp.x - 6 + i * 2.4, 3.05, cp.z + 4)
    k.group.add(b)
  }
  k.lamps.push(new THREE.Vector3(cp.x, 3, cp.z + 4))
  for (const [dx, dz] of [[-3.5, 4], [3.5, 4], [-3.5, 7.5], [3.5, 7.5]] as const) {
    k.cylinder(cp.x + dx, cp.z + dz, 0.55, 0.75, wood, { collide: true })
    for (const s of [-1, 1]) k.box(cp.x + dx + s * 1.1, cp.z + dz, 0.45, 0.45, 0.45, darkWood, { collide: true })
  }
  const tv = k.box(cp.x + 4.5, cp.z - 0.8, 1.9, 1.1, 0.12, k.mat('#0a0a0a'), { y: 1.6 })
  const screenMat = new THREE.MeshBasicMaterial({ color: '#4a7bd0' })
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.92), screenMat)
  screen.position.set(tv.position.x, tv.position.y, tv.position.z + 0.07)
  k.group.add(screen)
  k.tickers.push((_dt, t) => screenMat.color.setHSL(0.6, 0.55, 0.28 + 0.12 * Math.sin(t * 7.3) * Math.sin(t * 2.1)))

  // ---- Microbus stop --------------------------------------------------------------------------------------
  const sp = PLACES.abis_stop.pos
  const steel = k.mat('#4a4f52', { rough: 0.6, metal: 0.4 })
  k.box(sp.x, sp.z - 1, 5, 0.12, 3, steel, { y: 2.6 })
  for (const dx of [-2.3, 2.3]) k.cylinder(sp.x + dx, sp.z - 2.3, 0.07, 2.7, steel)
  k.box(sp.x, sp.z - 2.4, 4, 0.12, 0.5, k.mat('#6b5a44'), { y: 0.45, collide: true })
  k.sign(signTexture('أبيس ← محطة الرمل', { w: 640, h: 160, font: '700 62px Cairo, sans-serif' }), sp.x, 2.1, sp.z - 2.25, 3.4, 0.85)
  k.prop('vehicles/microbus', 6, sp.x + 8, sp.z + 3, { rotY: Q, collide: 'box' })
  k.prop('vehicles/tuktuk', 3, 18, 222, { rotY: Q + 0.2, collide: 'box' })

  // ---- Boundary stone on plot 15 -----------------------------------------------------------------------
  const pp = PLACES.plot15.pos
  const stoneMat = k.mat('#8d877b')
  k.box(pp.x + 14, pp.z + 13, 0.55, 0.9, 0.4, stoneMat, { collide: true })
  k.sign(signTexture('١٥', { w: 128, h: 128, bg: '#8d877b', fg: '#2a2622', border: '#8d877b', font: '800 90px Cairo, sans-serif' }), pp.x + 14, 0.55, pp.z + 13.22, 0.4, 0.4)
  k.box(pp.x + 11, pp.z + 13, 0.08, 0.22, 0.08, k.mat('#b3121f'), { y: 0 }) // the old (original) mark, now a red peg
  for (const dz of [-8, 0, 8]) k.box(pp.x - 26, pp.z + dz, 0.12, 0.8, 0.12, darkWood) // fence posts

  // ---- Nature and street furniture ---------------------------------------------------------------------
  for (const x of [-90, -62, -34, -6, 22, 50, 78, 106, 134, 162, 190]) k.lamp(x, 211.6)
  const palms: [number, number][] = [[-70, 163], [-20, 160], [12, 162], [66, 161], [100, 164], [126, 162], [200, 170], [-40, 228], [64, 226], [124, 228], [-95, 262], [20, 280], [150, 285], [200, 220], [-90, 215], [210, 200]]
  for (const [x, z] of palms) k.prop('nature/palm_tree', 8 + rnd() * 3, x, z, { rotY: rnd() * 6, collide: 'circle', shrink: 0.12 })
  for (const [x, z, r] of [[112, 176, 0.5], [-50, 168, 2.2]] as const) k.prop('nature/water_buffalo', 2.6, x, z, { rotY: r, collide: 'circle', shrink: 0.7 })

  // Hay bales and crates add clutter for scale reference and cover.
  for (let i = 0; i < 14; i++) {
    const x = -90 + rnd() * 300
    const z = 225 + rnd() * 80
    k.cylinder(x, z, 0.5, 0.7, k.mat('#8c7a3e'), { collide: true })
  }
  return k.toZone('abis', 'dirt')
}

export function abisLoad(lib: ModelLibrary): Promise<void> {
  return lib.load(ABIS_MODELS)
}
