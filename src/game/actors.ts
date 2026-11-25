/**
 * Animated actors: the player body and the townspeople. Both wrap a `Figure` from the model library
 * and blend idle / walk / run with short cross-fades. Movement is resolved against the zone's 2D
 * collision world (no rigid-body physics needed for walking investigators).
 */
import * as THREE from 'three'
import type { CollisionWorld } from '../core/collision'
import type { CharacterId } from '../data/types'
import { CONFIG } from './config'
import type { ClipName, Figure } from './models'

const TAU = Math.PI * 2
/** Shortest signed angle from a to b. */
export function angleDelta(a: number, b: number): number {
  return ((((b - a) % TAU) + TAU + Math.PI) % TAU) - Math.PI
}
/** Yaw that makes a -Z-facing body look along (dx, dz). */
export function yawFor(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz)
}

/** Clip playback speed that matches the authored stride (metres per second at timeScale 1). */
const NATIVE_SPEED: Record<ClipName, number> = { idle: 1, walk: 1.35, run: 4.0 }

export class Animator {
  private current: ClipName = 'idle'
  constructor(private readonly figure: Figure) {}

  /** Pick the clip for a ground speed and adapt its playback rate to avoid foot sliding. */
  drive(speed: number, sprinting: boolean, dt: number): void {
    const a = this.figure.actions
    let want: ClipName = speed < 0.25 ? 'idle' : sprinting && a.run ? 'run' : 'walk'
    if (!a[want]) want = a.walk && want === 'run' ? 'walk' : 'idle'
    if (want !== this.current) {
      const from = a[this.current]
      const to = a[want]
      if (to) {
        to.reset().play()
        if (from) to.crossFadeFrom(from, 0.22, false)
      }
      this.current = want
    }
    const act = a[this.current]
    if (act && this.current !== 'idle') act.timeScale = THREE.MathUtils.clamp(speed / NATIVE_SPEED[this.current], 0.6, 1.6)
    this.figure.mixer.update(dt)
  }
}

export class PlayerActor {
  readonly position = new THREE.Vector3()
  /** Body facing (radians, 0 = -Z). */
  yaw = 0
  readonly velocity = new THREE.Vector2()
  private readonly animator: Animator
  private stride = 0
  speed = 0
  sprinting = false

  constructor(readonly figure: Figure) {
    this.animator = new Animator(figure)
  }

  place(x: number, z: number, yaw: number): void {
    this.position.set(x, 0, z)
    this.yaw = yaw
    this.velocity.set(0, 0)
    this.sync()
  }

  /**
   * Advance one fixed step. `moveX/moveY` is stick intent (right/forward), `camYaw` the camera
   * heading. Returns true when a footstep should sound.
   */
  step(dt: number, moveX: number, moveY: number, camYaw: number, sprint: boolean, world: CollisionWorld): boolean {
    const p = CONFIG.player
    const fx = -Math.sin(camYaw)
    const fz = -Math.cos(camYaw)
    const rx = Math.cos(camYaw)
    const rz = -Math.sin(camYaw)
    const mag = Math.min(1, Math.hypot(moveX, moveY))
    this.sprinting = sprint && mag > 0.5
    const target = (this.sprinting ? p.sprintSpeed : p.walkSpeed) * mag
    const dirX = fx * moveY + rx * moveX
    const dirZ = fz * moveY + rz * moveX
    const len = Math.hypot(dirX, dirZ) || 1
    const tvx = (dirX / len) * target
    const tvz = (dirZ / len) * target
    const k = 1 - Math.exp(-p.acceleration * dt * 0.25)
    this.velocity.x += (tvx - this.velocity.x) * k
    this.velocity.y += (tvz - this.velocity.y) * k
    const nx = this.position.x + this.velocity.x * dt
    const nz = this.position.z + this.velocity.y * dt
    const r = world.resolve(nx, nz, p.radius)
    // Actual speed after collisions drives the animation (no running on the spot against walls).
    this.speed = Math.hypot(r.x - this.position.x, r.z - this.position.z) / dt
    this.position.x = r.x
    this.position.z = r.z
    if (this.speed > 0.2) {
      const want = yawFor(this.velocity.x, this.velocity.y)
      this.yaw += angleDelta(this.yaw, want) * Math.min(1, p.turnSpeed * dt)
    }
    let step = false
    if (this.speed > 0.4) {
      this.stride += dt
      const period = this.sprinting ? 0.33 : 0.52
      if (this.stride > period) {
        this.stride = 0
        step = true
      }
    } else this.stride = 0.4
    return step
  }

  /** Per-render-frame animation and transform update. */
  animate(dt: number): void {
    this.animator.drive(this.speed, this.sprinting, dt)
    this.sync()
  }

  private sync(): void {
    this.figure.root.position.copy(this.position)
    this.figure.root.rotation.y = this.yaw
  }

  setVisible(v: boolean): void {
    this.figure.root.visible = v
  }
}

export class NpcActor {
  private readonly animator: Animator
  readonly home: THREE.Vector3
  private yaw: number
  private readonly restYaw: number

  constructor(readonly id: CharacterId, readonly name: string, readonly figure: Figure, x: number, z: number, faceX: number, faceZ: number) {
    this.animator = new Animator(figure)
    this.home = new THREE.Vector3(x, 0, z)
    this.restYaw = yawFor(faceX - x, faceZ - z)
    this.yaw = this.restYaw
    figure.root.position.copy(this.home)
    figure.root.rotation.y = this.yaw
  }

  /** Turn toward the player when close, back to the resting pose otherwise. */
  update(dt: number, player: THREE.Vector3): void {
    const dx = player.x - this.home.x
    const dz = player.z - this.home.z
    const near = dx * dx + dz * dz < 49
    const want = near ? yawFor(dx, dz) : this.restYaw
    this.yaw += angleDelta(this.yaw, want) * Math.min(1, dt * 4)
    this.figure.root.rotation.y = this.yaw
    this.animator.drive(0, false, dt)
  }

  get visible(): boolean {
    return this.figure.root.visible
  }
  set visible(v: boolean) {
    this.figure.root.visible = v
  }
}
