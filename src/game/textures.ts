/**
 * Small procedural canvas textures. They replace shipped images (zero download, ~100 KB of GPU
 * memory each) and keep the flat ground and walls from looking like plastic.
 */
import * as THREE from 'three'

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

function finish(c: HTMLCanvasElement, repeatX: number, repeatY: number, color = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  t.anisotropy = 4
  if (color) t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Mottled ground: base colour with random darker/lighter speckles. */
export function noiseTexture(base: string, amount: number, repeat: number, seed = 1): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256)
  g.fillStyle = base
  g.fillRect(0, 0, 256, 256)
  let s = seed * 9301
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  for (let i = 0; i < 2600; i++) {
    const v = (rnd() - 0.5) * amount
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`
    const r = 1 + rnd() * 5
    g.fillRect(rnd() * 256, rnd() * 256, r, r)
  }
  return finish(c, repeat, repeat)
}

/** Crop rows for farmland. */
export function rowsTexture(base: string, row: string, repeatX: number, repeatY: number): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128)
  g.fillStyle = base
  g.fillRect(0, 0, 128, 128)
  g.fillStyle = row
  for (let x = 0; x < 128; x += 16) g.fillRect(x, 0, 6, 128)
  return finish(c, repeatX, repeatY)
}

/** Painted Arabic sign: dark plate with light lettering. */
export function signTexture(text: string, opts: { bg?: string; fg?: string; font?: string; w?: number; h?: number; border?: string } = {}): THREE.CanvasTexture {
  const { bg = '#12100f', fg = '#e9e2d0', font = '700 78px Cairo, sans-serif', w = 512, h = 160, border = '#b3121f' } = opts
  const [c, g] = canvas(w, h)
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  g.strokeStyle = border
  g.lineWidth = 8
  g.strokeRect(6, 6, w - 12, h - 12)
  g.fillStyle = fg
  g.font = font
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.direction = 'rtl'
  g.fillText(text, w / 2, h / 2 + 4, w - 40)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Soft radial light-pool used under street lamps. */
export function glowTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128)
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,190,100,0.55)')
  grad.addColorStop(1, 'rgba(255,190,100,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
