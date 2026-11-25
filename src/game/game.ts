/**
 * 3D game controller: owns the scene, the two districts (Abis and the city), actors, the camera,
 * interaction and travel. Rules live in `Session`; this class only turns them into pixels and input.
 *
 * Memory strategy: the city district (models, meshes) is created lazily after the village is on
 * screen and is hidden (not rendered) while the player is in Abis, and vice versa.
 */
import * as THREE from 'three'
import type { Audio } from '../engine/audio'
import type { Assets } from '../engine/assets'
import type { Input } from '../engine/input'
import type { Renderer } from '../engine/renderer'
import type { CaseEvent } from '../core/caseState'
import type { DialogueSession } from '../core/dialogue'
import { CHARACTERS, PLAYER_MODELS } from '../data/characters'
import { PLACES } from '../data/places'
import type { CharacterProfile, Hotspot, PlaceId } from '../data/types'
import { abisLoad, buildAbis } from './abis'
import { Atmosphere } from './atmosphere'
import { buildCity, cityLoad } from './city'
import { MODEL_URL, type ModelId } from './assetTable'
import { angleDelta, NpcActor, PlayerActor, yawFor } from './actors'
import { CONFIG } from './config'
import { ModelLibrary } from './models'
import type { Session } from './session'
import type { Zone, ZoneId } from './zoneKit'
import { tuning } from './tuning'

export type GameMode = 'idle' | 'playing' | 'ui' | 'photo' | 'paused'

/** Callbacks into the UI layer. */
export type GameHooks = {
  prompt(text: string | null, kind?: 'npc' | 'hotspot' | 'photo' | 'travel'): void
  narrate(text: string): void
  toast(text: string, kind: 'evidence' | 'deduction' | 'info' | 'warn'): void
  openDialogue(session: DialogueSession, who: CharacterProfile): void
  openCamera(h: Hotspot): void
  /** Fade to black, run `change` while hidden, fade back. */
  fade(change: () => Promise<void> | void): Promise<void>
  loading(text: string | null): void
  /** The Case-file / objective state changed (evidence, flags): refresh HUD. */
  caseChanged(events: CaseEvent[]): void
}

type Candidate = { kind: 'npc'; npc: NpcActor; dist: number } | { kind: 'hotspot'; hotspot: Hotspot; dist: number }

const ZONE_OF: Record<PlaceId, ZoneId> = Object.fromEntries(Object.values(PLACES).map(p => [p.id, p.district])) as Record<PlaceId, ZoneId>

export class Game {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 1500)
  readonly lib: ModelLibrary
  mode: GameMode = 'idle'
  session?: Session
  player?: PlayerActor
  zone: ZoneId = 'abis'
  private zones: Partial<Record<ZoneId, Zone>> = {}
  private cityPromise?: Promise<void>
  private npcs: { npc: NpcActor; profile: CharacterProfile; zone: ZoneId }[] = []
  private markers = new Map<string, THREE.Object3D>()
  private readonly atmosphere: Atmosphere
  private readonly lampLights: THREE.PointLight[] = []
  private camYaw = 0
  private camPitch = 0.28
  private firstPerson = false
  private readonly camPos = new THREE.Vector3()
  private readonly focus = new THREE.Vector3()
  private time = 0
  private lampTimer = 0
  private sceneTimer = 0
  private saveTimer = 0
  private candidate?: Candidate
  private lastPrompt: string | null = null
  private unsubscribe?: () => void
  reducedMotion = false
  private readonly markerGeo = new THREE.OctahedronGeometry(0.2, 0)
  private readonly ringGeo = new THREE.RingGeometry(0.55, 0.7, 28)
  private readonly beamGeo = new THREE.CylinderGeometry(0.05, 0.05, 9, 6, 1, true)

  constructor(
    private readonly renderer: Renderer,
    private readonly input: Input,
    private readonly audio: Audio,
    assets: Assets,
    private readonly hooks: GameHooks,
  ) {
    this.lib = new ModelLibrary(assets)
    this.lib.shadows = renderer.shadowMapSize > 0 && renderer.gl.shadowMap.enabled
    this.atmosphere = new Atmosphere(this.scene, renderer.shadowMapSize, renderer.gl.shadowMap.enabled)
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight('#ffb36b', 0, 22, 1.6)
      this.lampLights.push(l)
      this.scene.add(l)
    }
  }

  // ---- Loading ---------------------------------------------------------------------------------------------

  /** Load the village (and the models the player needs) before the first frame. */
  async prepare(avatarGender: 'male' | 'female'): Promise<void> {
    const ids = new Set<ModelId>()
    for (const c of Object.values(CHARACTERS)) if (ZONE_OF[c.place] === 'abis' && c.id !== 'yassin') ids.add(c.model as ModelId)
    ids.add(PLAYER_MODELS[avatarGender].model as ModelId)
    await Promise.all([abisLoad(this.lib), this.lib.load([...ids])])
    if (!this.zones.abis) {
      this.zones.abis = buildAbis(this.lib)
      this.scene.add(this.zones.abis.group)
    }
  }

  /** Create the city district in the background (idempotent). */
  ensureCity(): Promise<void> {
    this.cityPromise ??= (async () => {
      const ids = Object.values(CHARACTERS).filter(c => ZONE_OF[c.place] === 'city').map(c => c.model as ModelId)
      await Promise.all([cityLoad(this.lib), this.lib.load(ids)])
      const zone = buildCity(this.lib)
      zone.group.visible = this.zone === 'city'
      this.zones.city = zone
      this.scene.add(zone.group)
      this.spawnNpcs('city')
      this.buildMarkers()
      this.refreshMarkers()
    })()
    return this.cityPromise
  }

  // ---- Session lifecycle ------------------------------------------------------------------------------

  /** Begin (or resume) an investigation. */
  async begin(session: Session): Promise<void> {
    this.unsubscribe?.()
    this.session = session
    tuning.activate('session')
    await this.prepare(session.profile.avatar.gender)
    this.clearActors()
    const a = session.profile.avatar
    const spec = a.kind === 'yassin' ? PLAYER_MODELS.male : PLAYER_MODELS[a.gender]
    const figure = this.lib.character(spec.model as ModelId, spec.heightM)
    this.player = new PlayerActor(figure)
    this.scene.add(figure.root)
    const pos = session.progress.position
    this.setZone(pos.zone === 'city' ? 'city' : 'abis', false)
    if (pos.zone === 'city') {
      this.hooks.loading('جارٍ تحميل الإسكندرية…')
      await this.ensureCity()
      this.setZone('city', false)
      this.hooks.loading(null)
    } else {
      void this.ensureCity()
    }
    this.player.place(pos.x, pos.z, pos.yaw)
    this.camYaw = pos.yaw
    this.camPitch = 0.28
    this.firstPerson = false
    this.spawnNpcs('abis')
    if (this.zones.city) this.spawnNpcs('city')
    this.buildMarkers()
    this.refreshMarkers()
    this.unsubscribe = session.onCase(events => {
      this.refreshMarkers()
      this.refreshNpcVisibility()
      this.hooks.caseChanged(events)
    })
    this.mode = 'ui'
    this.lastPrompt = null
    this.snapCamera()
  }

  private clearActors(): void {
    for (const { npc } of this.npcs) this.scene.remove(npc.figure.root)
    this.npcs = []
    if (this.player) this.scene.remove(this.player.figure.root)
    for (const m of this.markers.values()) m.parent?.remove(m)
    this.markers.clear()
  }

  private spawnNpcs(zone: ZoneId): void {
    if (!this.session) return
    for (const c of Object.values(CHARACTERS)) {
      if (c.id === 'yassin' || ZONE_OF[c.place] !== zone || this.npcs.some(n => n.profile.id === c.id)) continue
      if (!this.lib.has(c.model as ModelId)) continue
      const fig = this.lib.character(c.model as ModelId, c.heightM)
      const p = this.session.positionOf(c)
      // Face the middle of the street / the place the character belongs to.
      const npc = new NpcActor(c.id, c.name, fig, p.x, p.z, PLACES[c.place].pos.x, PLACES[c.place].pos.z + (zone === 'abis' ? 30 : 20))
      this.scene.add(fig.root)
      this.npcs.push({ npc, profile: c, zone })
    }
    this.refreshNpcVisibility()
  }

  private refreshNpcVisibility(): void {
    if (!this.session) return
    for (const n of this.npcs) n.npc.visible = n.zone === this.zone && this.session.present(n.profile)
  }

  private setZone(zone: ZoneId, announce = true): void {
    this.zone = zone
    for (const [id, z] of Object.entries(this.zones) as [ZoneId, Zone][]) z.group.visible = id === zone
    this.refreshNpcVisibility()
    if (announce) this.audio.setScene(zone, this.atmosphere.night, 0.3)
  }

  // ---- Hotspot markers -------------------------------------------------------------------------------------

  private buildMarkers(): void {
    if (!this.session) return
    for (const h of this.session.engine.file.hotspots) {
      const zone = this.zones[ZONE_OF[h.place]]
      if (!zone || this.markers.has(h.id)) continue
      const color = h.kind === 'travel' ? '#e2a83b' : '#ff2a3a'
      const g = new THREE.Group()
      const gem = new THREE.Mesh(this.markerGeo, new THREE.MeshBasicMaterial({ color, fog: false }))
      gem.scale.y = 1.5
      gem.position.y = 1.9
      gem.name = 'gem'
      const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }))
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.06
      const beam = new THREE.Mesh(this.beamGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))
      beam.position.y = 4.5
      beam.name = 'beam'
      g.add(gem, ring, beam)
      const p = this.session.hotspotPosition(h)
      g.position.set(p.x, 0, p.z)
      zone.group.add(g)
      this.markers.set(h.id, g)
    }
  }

  private refreshMarkers(): void {
    if (!this.session) return
    const objective = this.session.engine.currentObjective()
    for (const h of this.session.engine.file.hotspots) {
      const m = this.markers.get(h.id)
      if (!m) continue
      const on = this.session.engine.hotspotAvailable(h)
      m.visible = on
      const beam = m.getObjectByName('beam')
      if (beam) beam.visible = on && !!objective?.place && objective.place === h.place && h.kind !== 'travel' || (on && h.kind === 'travel' && objective?.place === h.place)
    }
  }

  // ---- Frame loop ---------------------------------------------------------------------------------------------

  get night(): number {
    return this.atmosphere.night
  }

  /** Fixed-step simulation. */
  step(dt: number): void {
    const s = this.session
    const player = this.player
    if (!s || !player) return
    if (this.mode === 'playing' || this.mode === 'ui') s.tick(dt)
    if (this.mode !== 'playing') return
    const zone = this.zones[this.zone]
    if (!zone) return
    const mv = this.input.move
    const footstep = player.step(dt, mv.x, mv.y, this.camYaw, this.input.held('sprint'), zone.collision)
    if (footstep) this.audio.footstep(zone.surface === 'stone' ? 'stone' : 'dirt', player.sprinting)
    this.updateCandidate()
    this.saveTimer += dt
    if (this.saveTimer > 20) {
      this.saveTimer = 0
      s.setPosition(this.zone, player.position.x, player.position.z, player.yaw)
      s.save()
    }
  }

  /** Per-frame camera, animation, atmosphere. */
  render(_alpha: number, dt: number): void {
    this.time += dt
    const s = this.session
    const player = this.player
    if (s && player) {
      if (this.mode === 'playing' || this.mode === 'photo' || this.mode === 'ui') {
        const look = this.input.takeLook()
        if (this.mode !== 'ui') {
          this.camYaw -= look.x
          this.camPitch = THREE.MathUtils.clamp(this.camPitch + look.y, CONFIG.camera.minPitch, CONFIG.camera.maxPitch)
        }
      }
      player.animate(dt)
      for (const n of this.npcs) if (n.npc.visible) n.npc.update(dt, player.position)
      this.updateCamera(dt)
      this.focus.copy(player.position)
      this.atmosphere.update(s.clock.hour, this.focus, this.renderer.gl)
      this.zones[this.zone]?.tick(dt, this.time, this.atmosphere.night)
      this.animateMarkers()
      this.lampTimer -= dt
      if (this.lampTimer <= 0) {
        this.lampTimer = 0.3
        this.updateLamps()
      }
      this.sceneTimer -= dt
      if (this.sceneTimer <= 0) {
        this.sceneTimer = 1
        const ev = s.state.evidence.size
        this.audio.setScene(this.zone, this.atmosphere.night, 0.15 + (ev / 16) * 0.5 + this.atmosphere.night * 0.2 + (s.state.flags.has('found_mahmoud') ? 0.15 : 0))
      }
    }
    this.renderer.render(this.scene, this.camera)
  }

  private updateLamps(): void {
    const zone = this.zones[this.zone]
    const p = this.player
    if (!zone || !p) return
    const sorted = [...zone.lamps].sort((a, b) => a.distanceToSquared(p.position) - b.distanceToSquared(p.position))
    const power = 0.25 + this.atmosphere.night * 2.4
    this.lampLights.forEach((light, i) => {
      const lamp = sorted[i]
      light.visible = !!lamp
      if (lamp) light.position.copy(lamp)
      light.intensity = lamp ? power * 18 : 0
    })
  }

  private animateMarkers(): void {
    for (const m of this.markers.values()) {
      if (!m.visible) continue
      const gem = m.getObjectByName('gem')
      if (gem) {
        gem.rotation.y = this.time * 1.6
        gem.position.y = 1.9 + Math.sin(this.time * 2) * 0.12
      }
    }
  }

  // ---- Camera ------------------------------------------------------------------------------------------------------

  toggleView(): void {
    this.firstPerson = !this.firstPerson
  }

  /** Photo-spot reachable right now? (shows the camera button) */
  get photoNearby(): boolean {
    const c = this.candidate
    return this.mode === 'playing' && c?.kind === 'hotspot' && c.hotspot.kind === 'photo'
  }

  /** Direction and distance to the current objective for the HUD arrow. */
  objectiveArrow(): { angle: number; dist: number; otherZone?: string } | undefined {
    const o = this.session?.engine.currentObjective()
    const p = this.player
    if (!o?.place || !p) return undefined
    const place = PLACES[o.place]
    if (place.district !== this.zone) return { angle: 0, dist: 0, otherZone: place.district === 'city' ? 'إسكندرية' : 'أبيس' }
    const dx = place.pos.x - p.position.x
    const dz = place.pos.z - p.position.z
    return { angle: angleDelta(this.camYaw, yawFor(dx, dz)), dist: Math.hypot(dx, dz) }
  }

  private snapCamera(): void {
    this.updateCamera(1)
  }

  private updateCamera(dt: number): void {
    const p = this.player
    if (!p) return
    const c = CONFIG.camera
    const photo = this.mode === 'photo'
    const fp = this.firstPerson || photo
    p.setVisible(!fp)
    if (!photo) this.camera.fov = c.fov
    this.camera.updateProjectionMatrix()
    const yaw = this.camYaw
    if (fp) {
      this.camera.position.set(p.position.x, CONFIG.player.eyeHeight, p.position.z)
      this.camera.rotation.order = 'YXZ'
      this.camera.rotation.set(-(this.camPitch - 0.28) * 1.1, yaw, 0)
      this.camPos.copy(this.camera.position)
      return
    }
    const target = new THREE.Vector3(p.position.x, c.height, p.position.z)
    const cp = Math.cos(this.camPitch)
    const dir = new THREE.Vector3(Math.sin(yaw) * cp, Math.sin(this.camPitch), Math.cos(yaw) * cp)
    // Pull the camera in when a building/wall would sit between it and the player.
    const world = this.zones[this.zone]?.collision
    let dist = c.distance
    if (world) {
      for (let d = 0.8; d <= c.distance; d += 0.6) {
        if (world.blocked(target.x + dir.x * d, target.z + dir.z * d, 0.25)) {
          dist = Math.max(0.9, d - 0.6)
          break
        }
      }
    }
    const desired = target.clone().addScaledVector(dir, dist)
    desired.y = Math.max(0.35, desired.y)
    if (dt >= 1 || this.reducedMotion) this.camPos.copy(desired)
    else this.camPos.lerp(desired, 1 - Math.exp(-c.follow * dt))
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(target)
  }

  /** Pose used by the AR world-camera provider. */
  cameraPose(): { x: number; z: number; dirX: number; dirZ: number; fovDeg: number } {
    const d = new THREE.Vector3()
    this.camera.getWorldDirection(d)
    const len = Math.hypot(d.x, d.z) || 1
    return { x: this.camera.position.x, z: this.camera.position.z, dirX: d.x / len, dirZ: d.z / len, fovDeg: this.camera.fov }
  }

  setZoom(fov: number): void {
    this.camera.fov = THREE.MathUtils.clamp(fov, 18, 75)
    this.camera.updateProjectionMatrix()
  }

  // ---- Interaction -------------------------------------------------------------------------------------------------

  private updateCandidate(): void {
    const s = this.session
    const p = this.player
    if (!s || !p) return
    const reach = CONFIG.interaction.reach
    let best: Candidate | undefined
    const consider = (c: Candidate) => {
      if (!best || c.dist < best.dist) best = c
    }
    for (const n of this.npcs) {
      if (!n.npc.visible) continue
      const d = Math.hypot(n.npc.home.x - p.position.x, n.npc.home.z - p.position.z)
      if (d < reach + 0.6) consider({ kind: 'npc', npc: n.npc, dist: d - 0.6 })
    }
    for (const h of s.engine.file.hotspots) {
      if (ZONE_OF[h.place] !== this.zone || !s.engine.hotspotAvailable(h)) continue
      const pos = s.hotspotPosition(h)
      const d = Math.hypot(pos.x - p.position.x, pos.z - p.position.z)
      if (d < reach) consider({ kind: 'hotspot', hotspot: h, dist: d })
    }
    this.candidate = best
    let text: string | null = null
    let kind: 'npc' | 'hotspot' | 'photo' | 'travel' = 'hotspot'
    const cand = best as Candidate | undefined
    if (cand?.kind === 'npc') {
      text = `تكلّم مع ${cand.npc.name}`
      kind = 'npc'
    } else if (cand?.kind === 'hotspot') {
      text = cand.hotspot.label
      kind = cand.hotspot.kind === 'photo' ? 'photo' : cand.hotspot.kind === 'travel' ? 'travel' : 'hotspot'
    }
    if (text !== this.lastPrompt) {
      this.lastPrompt = text
      this.hooks.prompt(text, kind)
    }
  }

  /** Use whatever the prompt currently offers (E key / touch button). */
  interact(): void {
    if (this.mode !== 'playing') return
    const c = this.candidate
    const s = this.session
    if (!c || !s) return
    this.audio.play('ui')
    if (c.kind === 'npc') {
      const entry = this.npcs.find(n => n.npc === c.npc)!
      const dlg = s.talk(entry.profile.id)
      if (!dlg) {
        this.hooks.toast(`${entry.profile.name} مش عاوز يتكلم دلوقتي.`, 'info')
        return
      }
      this.mode = 'ui'
      this.hooks.prompt(null)
      this.lastPrompt = null
      this.hooks.openDialogue(dlg, entry.profile)
      return
    }
    const h = c.hotspot
    if (h.kind === 'photo') {
      this.hooks.openCamera(h)
      return
    }
    if (h.kind === 'travel' && h.to) {
      void this.travel(h)
      return
    }
    this.audio.play('door')
    if (h.text) this.hooks.narrate(s.fill(h.text))
    s.useHotspot(h)
  }

  /** Open the viewfinder if a photo spot is in reach (C key / camera button). */
  tryCamera(): void {
    if (this.mode !== 'playing') return
    const c = this.candidate
    if (c?.kind === 'hotspot' && c.hotspot.kind === 'photo') this.hooks.openCamera(c.hotspot)
    else this.hooks.toast('مفيش حاجة تتصوّر هنا… دوّر على علامة الكاميرا الحمرا.', 'info')
  }

  /** Toasts and sounds for case events from any source. */
  handleEvents(events: CaseEvent[]): void {
    for (const e of events) {
      if (e.type === 'evidence') {
        this.audio.play('evidence')
        this.hooks.toast(`دليل جديد: ${e.evidence.title}`, 'evidence')
      } else if (e.type === 'evidence-gated') this.hooks.toast(e.reason ?? 'الدليل ده لسه ماظهرش… ارجع في وقت تاني.', 'warn')
      else if (e.type === 'deduction') {
        this.audio.play('deduction')
        this.hooks.toast('ربطت خيطاً جديداً!', 'deduction')
      }
    }
  }

  // ---- Travel -----------------------------------------------------------------------------------------------------------

  private async travel(h: Hotspot): Promise<void> {
    const s = this.session
    const p = this.player
    if (!s || !p || !h.to) return
    const dest = PLACES[h.to]
    this.mode = 'ui'
    this.hooks.prompt(null)
    this.lastPrompt = null
    this.audio.play('travel')
    if (h.text) this.hooks.narrate(s.fill(h.text))
    await this.hooks.fade(async () => {
      if (dest.district === 'city' && !this.zones.city) {
        this.hooks.loading('جارٍ تحميل الإسكندرية…')
        await this.ensureCity()
        this.hooks.loading(null)
      }
      this.setZone(dest.district)
      const off = dest.district === 'city' ? { x: 4, z: 6 } : { x: 3, z: 3 }
      p.place(dest.pos.x + off.x, dest.pos.z + off.z, 0)
      this.camYaw = 0
      this.snapCamera()
      s.useHotspot(h)
      s.setPosition(this.zone, p.position.x, p.position.z, p.yaw)
      s.save()
    })
    this.mode = 'playing'
  }

  // ---- Modes ------------------------------------------------------------------------------------------------------------------

  /** UI closed a modal (dialogue / case file): return to play. */
  resumePlay(): void {
    if (this.mode === 'ui' || this.mode === 'photo') {
      this.mode = 'playing'
      this.camera.fov = CONFIG.camera.fov
    }
  }
  enterUi(): void {
    if (this.mode === 'playing') this.mode = 'ui'
  }
  enterPhoto(): void {
    this.mode = 'photo'
    this.camPitch = 0.28
  }
  pause(): void {
    if (this.mode === 'playing') this.mode = 'paused'
  }
  resume(): void {
    if (this.mode === 'paused') this.mode = 'playing'
  }
  /** Leave the session (back to title). */
  endSession(): void {
    if (this.session && this.player) {
      this.session.setPosition(this.zone, this.player.position.x, this.player.position.z, this.player.yaw)
      this.session.save()
    }
    this.unsubscribe?.()
    this.session = undefined
    this.mode = 'idle'
  }

  setQuality(): void {
    this.lib.shadows = this.renderer.gl.shadowMap.enabled
    this.atmosphere.sun.castShadow = this.lib.shadows
    this.scene.traverse(o => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = this.lib.shadows && o.castShadow
    })
  }

  /** Test/debug helper. */
  teleport(x: number, z: number): void {
    this.player?.place(x, z, this.player.yaw)
  }
  nearest(): Candidate | undefined {
    return this.candidate
  }
  get modelCount(): number {
    return Object.keys(MODEL_URL).length
  }
}
