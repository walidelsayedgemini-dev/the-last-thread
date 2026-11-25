/**
 * All gameplay and mood tuning in one place. Change numbers here before touching game code; the
 * Tweak panel (`tuning.ts`) edits the active copy live in Preview.
 */
export const DEFAULT_CONFIG = {
  player: {
    /** Collision radius on the ground plane (m). */
    radius: 0.38,
    walkSpeed: 3.0,
    sprintSpeed: 5.5,
    acceleration: 22,
    /** Radians per second the body turns toward the movement direction. */
    turnSpeed: 10,
    /** Eye height for the optional first-person view (m). */
    eyeHeight: 1.62,
  },
  camera: {
    distance: 4.6,
    height: 1.55,
    minPitch: -0.25,
    maxPitch: 1.0,
    follow: 9,
    fov: 62,
  },
  atmosphere: {
    /** Multiplies scene exposure; below 1 keeps the noir "dim lighting". */
    darkness: 0.85,
    /** Multiplies fog density (1 = default palette). */
    fog: 1,
  },
  interaction: {
    /** Metres within which hotspots and characters can be used. */
    reach: 3.4,
  },
} as const

// Gameplay always reads active values here. Source defaults remain immutable for
// Tweak Reset and Save with Manus; Apply never writes source or local storage.
type MutableConfig<T> = { -readonly [K in keyof T]: T[K] extends number ? number : T[K] extends object ? MutableConfig<T[K]> : T[K] }
export const CONFIG: MutableConfig<typeof DEFAULT_CONFIG> = structuredClone(DEFAULT_CONFIG)
