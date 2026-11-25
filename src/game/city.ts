/**
 * Alexandria city district: Raml station, Mansheya (Shawky's office), the Corniche, Qaitbay spit
 * and harbour, Pompey's Pillar hill and the Bibliotheca. Coordinates follow `data/places.ts`; the sea
 * lies north (-Z).
 */
import * as THREE from 'three'
import { PLACES } from '../data/places'
import type { ModelId } from './assetTable'
import { noiseTexture, signTexture } from './textures'
import { seeded, ZoneKit, type Zone } from './zoneKit'
import type { ModelLibrary } from './models'

export const CITY_MODELS: ModelId[] = [
  'buildings/alex_building', 'landmarks/bibliotheca', 'landmarks/qaitbay_citadel', 'landmarks/pompey_pillar', 'vehicles/alex_tram',
  'vehicles/black_sedan', 'vehicles/microbus', 'props/fishing_boat', 'props/street_lamp', 'nature/palm_tree',
]

const Q = Math.PI / 2

export function buildCity(lib: ModelLibrary): Zone {
  const k = new ZoneKit(lib)
  const rnd = seeded(31)
  k.collision.bounds = { minX: -400, maxX: 250, minZ: -390, maxZ: -70 }

  // ---- Ground, sea, promenade ---------------------------------------------------------------------------
  const stone = k.mat('#4a4a4c', { map: noiseTexture('#4a4a4c', 0.35, 60, 7), rough: 1 })
  const asphalt = k.mat('#222225', { map: noiseTexture('#222225', 0.3, 30, 2), rough: 0.95 })
  const promenade = k.mat('#6a655c', { map: noiseTexture('#6a655c', 0.3, 40, 4), rough: 1 })
  const dust = k.mat('#6d5e4b', { map: noiseTexture('#6d5e4b', 0.4, 20, 8), rough: 1 })
  const sea = k.mat('#0b2233', { rough: 0.2, metal: 0.3 })
  k.plane(-75, -185, 700, 230, stone)
  k.plane(-325, -340, 150, 100, dust, 0.01) // Qaitbay spit
  k.plane(0, -430, 1600, 280, sea, -0.4)
  k.plane(0, -290, 500, 12, promenade, 0.02) // corniche promenade
  k.plane(-75, -197, 700, 14, asphalt, 0.02) // main street
  k.plane(0, -243, 14, 100, asphalt, 0.02) // street to the sea
  k.plane(-210, -112, 70, 50, dust, 0.015) // Pompey hill
  // Sea blockers: everything north of the wall, east of the spit.
  k.collision.addBox({ minX: -250, maxX: 260, minZ: -420, maxZ: -297 })
  const wallMat = k.mat('#77736a', { rough: 0.95 })
  k.box(0, -296.5, 500, 1.0, 0.8, wallMat, { collide: false })

  // ---- Tram line ------------------------------------------------------------------------------------------------
  const rail = k.mat('#8a8a8c', { rough: 0.4, metal: 0.8 })
  for (const dz of [-0.7, 0.7]) k.box(-75, -178 + dz, 700, 0.08, 0.1, rail, { y: 0.03, shadow: false })
  const tram = k.prop('vehicles/alex_tram', 13, -300, -178, { rotY: Q })
  const tramLamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), k.glow('#ffe2a0'))
  tramLamp.position.set(0, 2.2, 0)
  tram.add(tramLamp)
  let tramX = -330
  k.tickers.push(dt => {
    tramX += dt * 5.5
    if (tramX > 280) tramX = -380
    tram.position.x = tramX
  })

  // ---- Mansheya: the facade row with Shawky's office --------------------------------------------------------
  // Buildings are placed so every facade lies on z = -205 regardless of their size.
  const FACADE_N = -205
  const facade = (x: number, size: number, south = false) => {
    const half = 0.49 * size
    k.prop('buildings/alex_building', size, x, south ? -165 + half : FACADE_N - half, { rotY: south ? Math.PI : 0, collide: 'box', shrink: 0.95 })
  }
  for (let x = -300; x <= -28; x += 16) facade(x, x === -140 ? 28 : 22 + rnd() * 8)
  for (let x = 28; x <= 76; x += 16) facade(x, 22 + rnd() * 8)
  // Southern row across the tram line (skipping Pompey's hill).
  for (let x = -300; x <= 80; x += 18) if (x < -250 || x > -170) facade(x, 20 + rnd() * 8, true)
  const mp = PLACES.mansheya.pos
  k.sign(signTexture('شوقي للعقارات والاستثمار', { w: 640, h: 160, font: '700 54px Cairo, sans-serif', fg: '#d9b26a', border: '#d9b26a' }), mp.x, 2.9, FACADE_N + 0.35, 6.2, 1.6)
  const officeWin = new THREE.MeshBasicMaterial({ color: '#c9a45c' })
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.5), officeWin)
  win.position.set(mp.x - 12, 1.9, FACADE_N + 0.35)
  k.group.add(win)
  k.box(mp.x - 12, FACADE_N + 0.3, 2.6, 0.12, 0.12, k.mat('#2a2622'), { y: 2.7 })
  // Lit window by day (people inside) – dark at night when the office is empty.
  k.tickers.push((_dt, _t, night) => officeWin.color.set(night > 0.7 ? '#10131a' : '#c9a45c'))
  k.prop('vehicles/black_sedan', 5.2, mp.x + 6, mp.z + 4, { rotY: Q, collide: 'box' })
  k.lamps.push(new THREE.Vector3(mp.x - 6, 4, mp.z + 8))

  // ---- Raml stop ---------------------------------------------------------------------------------------------------------
  const rp = PLACES.raml_stop.pos
  const steel = k.mat('#4a4f52', { rough: 0.6, metal: 0.4 })
  k.box(rp.x, rp.z - 2, 6, 0.14, 3.2, steel, { y: 2.7 })
  for (const dx of [-2.8, 2.8]) k.cylinder(rp.x + dx, rp.z - 3.4, 0.08, 2.8, steel)
  k.sign(signTexture('محطة الرمل', { w: 512, h: 150, font: '700 70px Cairo, sans-serif' }), rp.x, 2.3, rp.z - 3.3, 3.6, 1.05)
  k.prop('vehicles/microbus', 6, rp.x + 10, rp.z + 3, { rotY: Q, collide: 'box' })

  // ---- Bibliotheca ----------------------------------------------------------------------------------------------------------
  const bp = PLACES.bibliotheca.pos
  k.prop('landmarks/bibliotheca', 64, bp.x, bp.z, { rotY: 0, collide: 'box', shrink: 0.92 })
  // Granite wall of letters + the evidence locker.
  const lp = new THREE.Vector3(bp.x + 24, 0, bp.z + 40)
  const locker = k.box(lp.x, lp.z, 1.4, 1.5, 0.8, k.mat('#3a3f44', { rough: 0.5, metal: 0.6 }), { collide: true })
  const lockMat = new THREE.MeshBasicMaterial({ color: '#b3121f' })
  const lockLed = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.14), lockMat)
  lockLed.position.set(locker.position.x, 1.1, lp.z + 0.41)
  k.group.add(lockLed)
  k.tickers.push((_d, t) => lockMat.color.set(Math.sin(t * 3) > 0 ? '#b3121f' : '#4a0a10'))

  // ---- Pompey's Pillar ---------------------------------------------------------------------------------------------------
  const pp = PLACES.pompey.pos
  k.prop('landmarks/pompey_pillar', 34, pp.x, pp.z - 10, { collide: 'circle', shrink: 0.3 })
  const ruinMat = k.mat('#8a8274')
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2
    const r = 8 + rnd() * 14
    k.cylinder(pp.x + Math.cos(a) * r, pp.z - 10 + Math.sin(a) * r, 0.5 + rnd() * 0.4, 0.8 + rnd() * 2.2, ruinMat, { collide: true })
  }
  for (const dx of [-12, -6, 0, 6, 12]) k.box(pp.x + dx, pp.z + 24, 0.2, 1, 0.2, k.mat('#2a2622')) // site fence posts

  // ---- Qaitbay citadel, harbour and shed -------------------------------------------------------------------------------------
  const qp = PLACES.qaitbay.pos
  k.prop('landmarks/qaitbay_citadel', 62, qp.x, qp.z - 26, { collide: 'box', shrink: 0.9 })
  const shedWood = k.mat('#4a3a2a', { rough: 0.95 })
  const sx = qp.x + 14
  const sz = qp.z + 13
  k.box(sx, sz, 6, 3, 5, shedWood, { collide: true })
  k.box(sx, sz, 6.8, 0.25, 5.8, k.mat('#2a2018'), { y: 3 })
  const candle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), k.glow('#ffb347'))
  candle.position.set(sx, 1.2, sz + 2.6)
  k.group.add(candle)
  k.lamps.push(new THREE.Vector3(sx, 1.4, sz + 3.2))
  // Red thread on the iron ladder (visible once photographed; always present in the world).
  const thread = k.box(sx + 3.4, sz + 2.5, 0.05, 1.8, 0.05, k.mat('#b3121f', { emissive: '#b3121f', emissiveIntensity: 0.6 }), { y: 0.3, shadow: false })
  k.tickers.push((_d, t) => { thread.rotation.z = Math.sin(t * 1.4) * 0.08 })
  for (let i = 0; i < 6; i++) k.box(qp.x + 4 + (i % 3) * 1.1, qp.z + 25 + Math.floor(i / 3) * 1.1, 0.9, 0.9, 0.9, k.mat('#6a4f2f'), { collide: true }) // fishing crates

  const boats: THREE.Group[] = []
  for (const [x, z, r] of [[-236, -322, 0.3], [-228, -346, -0.5], [-240, -368, 0.1]] as const) {
    const boat = k.prop('props/fishing_boat', 8, x, z, { rotY: r, y: -0.12 })
    boats.push(boat)
  }
  k.tickers.push((_d, t) => boats.forEach((b, i) => { b.position.y = -0.12 + Math.sin(t * 1.2 + i * 2) * 0.08; b.rotation.z = Math.sin(t * 0.9 + i) * 0.03 }))

  // ---- Lamps and palms -------------------------------------------------------------------------------------------------------------
  for (let x = -240; x <= 240; x += 40) k.lamp(x, -288)
  for (let x = -270; x <= 60; x += 48) k.lamp(x, -205)
  for (let x = -230; x <= 230; x += 34) k.prop('nature/palm_tree', 9 + rnd() * 2, x + rnd() * 6, -283 + rnd() * 2, { collide: 'circle', shrink: 0.12 })
  return k.toZone('city', 'stone')
}

export function cityLoad(lib: ModelLibrary): Promise<void> {
  return lib.load(CITY_MODELS)
}
