/**
 * Lightweight 2D ground-plane collision.
 *
 * The investigation game never needs rigid-body physics: characters walk on flat ground and bump
 * into buildings, water and walls. Axis-aligned boxes and circles with a circle-vs-shape push-out
 * are exact enough, cost almost no memory and keep the physics WASM out of the download.
 */
export type Aabb = { minX: number; maxX: number; minZ: number; maxZ: number }
export type Circle = { x: number; z: number; r: number }
export type Bounds = Aabb

export class CollisionWorld {
  private boxes: Aabb[] = []
  private circles: Circle[] = []
  bounds: Bounds = { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity }

  addBox(box: Aabb): void {
    this.boxes.push(box)
  }
  addCircle(c: Circle): void {
    this.circles.push(c)
  }
  /** Convenience: box from centre and full size. */
  addRect(cx: number, cz: number, w: number, d: number): void {
    this.boxes.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 })
  }
  get count(): number {
    return this.boxes.length + this.circles.length
  }

  /** Push a circle of `radius` at (x, z) out of every obstacle and keep it inside the bounds. */
  resolve(x: number, z: number, radius: number): { x: number; z: number } {
    // Two passes settle corners where two obstacles touch.
    for (let pass = 0; pass < 2; pass++) {
      for (const b of this.boxes) {
        const nx = Math.max(b.minX, Math.min(x, b.maxX))
        const nz = Math.max(b.minZ, Math.min(z, b.maxZ))
        let dx = x - nx
        let dz = z - nz
        const d2 = dx * dx + dz * dz
        if (d2 >= radius * radius) continue
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2)
          x += (dx / d) * (radius - d)
          z += (dz / d) * (radius - d)
        } else {
          // Centre is inside the box: leave through the nearest face.
          dx = Math.min(x - b.minX, b.maxX - x)
          dz = Math.min(z - b.minZ, b.maxZ - z)
          if (dx < dz) x = x - b.minX < b.maxX - x ? b.minX - radius : b.maxX + radius
          else z = z - b.minZ < b.maxZ - z ? b.minZ - radius : b.maxZ + radius
        }
      }
      for (const c of this.circles) {
        const dx = x - c.x
        const dz = z - c.z
        const min = radius + c.r
        const d2 = dx * dx + dz * dz
        if (d2 >= min * min) continue
        const d = Math.sqrt(d2) || 1e-4
        x = c.x + (dx / d) * min
        z = c.z + (dz / d) * min
      }
    }
    const bd = this.bounds
    return { x: Math.max(bd.minX + radius, Math.min(bd.maxX - radius, x)), z: Math.max(bd.minZ + radius, Math.min(bd.maxZ - radius, z)) }
  }

  /** Is the point inside any obstacle (used to validate spawn points in tests)? */
  blocked(x: number, z: number, radius = 0): boolean {
    const r = this.resolve(x, z, radius)
    return Math.abs(r.x - x) > 1e-6 || Math.abs(r.z - z) > 1e-6
  }
}
