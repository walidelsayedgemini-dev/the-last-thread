/**
 * Model library: loads the registered GLBs, normalises them to real-world sizes and hands out
 * cheap clones. Static props share geometry and materials (clone is nearly free); characters use
 * `SkeletonUtils.clone` so each instance has its own skeleton and animation mixer.
 *
 * Source-model facts (see assets.lock.json): every model is normalised to ~1 unit on its longest
 * side, centred on the origin. Characters stand on y = 0, are ~1.0 tall and FACE +X, so the wrapper
 * rotates them by +π/2 to face -Z (the game's "forward").
 */
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Assets } from '../engine/assets'
import { MODEL_URL, type ModelId } from './assetTable'

export type ClipName = 'idle' | 'walk' | 'run'

export type Figure = {
  /** Add this to the scene; origin at the feet, forward = -Z. */
  root: THREE.Group
  mixer: THREE.AnimationMixer
  actions: Partial<Record<ClipName, THREE.AnimationAction>>
  /** Body mesh(es) for toggling visibility (first-person view). */
  meshes: THREE.Object3D[]
}

type Entry = { scene: THREE.Group; clips: THREE.AnimationClip[]; size: THREE.Vector3; center: THREE.Vector3; minY: number }

export class ModelLibrary {
  private readonly entries = new Map<ModelId, Entry>()
  /** castShadow flag applied to clones; the renderer quality preset toggles it. */
  shadows = true

  constructor(private readonly assets: Assets) {}

  /** Load models (in parallel). Already-loaded ids are skipped. */
  async load(ids: readonly ModelId[]): Promise<void> {
    await Promise.all(
      ids.filter(id => !this.entries.has(id)).map(async id => {
        const url = import.meta.env.VITE_STATIC_MODEL_ASSETS === 'true'
          ? `assets/models/${id}.glb`
          : MODEL_URL[id]
        const gltf = await this.assets.gltf(url)
        const scene = gltf.scene
        scene.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(scene)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        this.entries.set(id, { scene, clips: gltf.animations, size, center, minY: box.min.y })
      }),
    )
  }

  has(id: ModelId): boolean {
    return this.entries.has(id)
  }

  private entry(id: ModelId): Entry {
    const e = this.entries.get(id)
    if (!e) throw new Error(`Model not loaded: ${id}`)
    return e
  }

  /**
   * A static model scaled so its longest side equals `size` metres, centred on x/z and resting on
   * y = 0. `footprint` reports the scaled half extents for collision.
   */
  prop(id: ModelId, size: number): { root: THREE.Group; half: { x: number; y: number; z: number } } {
    const e = this.entry(id)
    const longest = Math.max(e.size.x, e.size.y, e.size.z)
    const k = size / longest
    const inner = e.scene.clone(true)
    inner.position.set(-e.center.x * k, -e.minY * k, -e.center.z * k)
    inner.scale.setScalar(k)
    const root = new THREE.Group()
    root.add(inner)
    this.flagShadows(root)
    return { root, half: { x: (e.size.x * k) / 2, y: e.size.y * k, z: (e.size.z * k) / 2 } }
  }

  /** A rigged character `heightM` metres tall with idle/walk/run actions where available. */
  character(id: ModelId, heightM: number): Figure {
    const e = this.entry(id)
    const model = cloneSkinned(e.scene) as THREE.Group
    const scale = heightM / Math.max(e.size.y, 1e-3)
    const holder = new THREE.Group()
    holder.rotation.y = Math.PI / 2
    holder.scale.setScalar(scale)
    // Feet to y = 0 regardless of how the source was exported.
    model.position.y = -e.minY
    holder.add(model)
    const root = new THREE.Group()
    root.add(holder)
    const meshes: THREE.Object3D[] = []
    model.traverse(o => {
      if ((o as THREE.Mesh).isMesh) {
        o.frustumCulled = false
        o.castShadow = this.shadows
        meshes.push(o)
      }
    })
    const mixer = new THREE.AnimationMixer(model)
    const actions: Figure['actions'] = {}
    const pick = (name: ClipName): THREE.AnimationClip | undefined => e.clips.find(c => c.name.toLowerCase().includes(name))
    // Characters that only ship one pose (e.g. "standing_relax") use it as their idle.
    const idleClip = pick('idle') ?? (e.clips.find(c => !/walk|run/i.test(c.name)) ?? e.clips[0])
    for (const [name, clip] of [['idle', idleClip], ['walk', pick('walk')], ['run', pick('run')]] as const) {
      if (!clip) continue
      const action = mixer.clipAction(clip)
      action.setLoop(THREE.LoopRepeat, Infinity)
      actions[name] = action
    }
    // Random phase so a crowd of idle characters does not move in lockstep.
    actions.idle?.play()
    mixer.update(Math.random() * 6)
    return { root, mixer, actions, meshes }
  }

  private flagShadows(root: THREE.Object3D): void {
    root.traverse(o => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = this.shadows
        o.receiveShadow = this.shadows
      }
    })
  }
}
