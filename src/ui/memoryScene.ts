import { REGIONS, YEARS, type MemoryPlace } from '../data/memoryWorld'

const SKY = ['#b58f63', '#7e9891', '#a37d65', '#b29f78', '#7294a0']
const SHADOW = ['#372d28', '#293b38', '#40302c', '#312e25', '#172d39']
const BUILDING = ['#9b765a', '#698377', '#a47a63', '#8d8d70', '#6c8794']

/** Draw one deterministic reconstruction. Only the open location needs a canvas in-game. */
export function paintMemoryScene(canvas: HTMLCanvasElement, place: MemoryPlace, past: boolean): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width = 720
  const h = canvas.height = 410
  let seed = (place.id + 1) * 0x9e3779b1 >>> 0
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const box = (color: string, x: number, y: number, width: number, height: number) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, width, height)
  }
  const shape = (color: string, points: [number, number][]) => {
    ctx.beginPath()
    for (const [x, y] of points) ctx.lineTo(x, y)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }
  const [, , , , kind] = place.site
  const urban = REGIONS[place.region][1] === 'الإسكندرية'
  const color = (place.region + place.phase * 2) % SKY.length
  const sky = past ? SKY[color] : '#687d85'
  const shade = SHADOW[color]
  const walls = BUILDING[color]
  const horizon = 196 + Math.round(random() * 44)
  const light = 106 + Math.round(random() * 492)
  const gradient = ctx.createLinearGradient(0, 0, 0, h)
  gradient.addColorStop(0, shade)
  gradient.addColorStop(horizon / h, sky)
  gradient.addColorStop(1, '#201e1e')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)

  if (kind === 'room') {
    box(walls, 144, 28, 434, 294)
    const win = 188 + Math.round(random() * 218)
    box('#2b2420', win - 6, 57, 120, 128)
    box(sky, win, 63, 108, 114)
    box(shade, win + 50, 63, 5, 114)
    box(shade, win, 113, 108, 5)
    shape('#2b24225f', [[win, 177], [win + 108, 177], [630, 410], [510, 410]])
    for (let shelf = 0; shelf < 3; shelf++) {
      const y = 156 + shelf * 40
      box('#4c3225', 522, y, 148, 7)
      for (let folder = 0; folder < 7; folder++) {
        const tall = 11 + random() * 22
        box(folder % 2 ? '#a38662' : '#625d4a', 528 + folder * 19, y - tall, 15, tall)
      }
    }
    shape('#563a2d', [[116, 283], [546, 273], [613, 334], [87, 347]])
    box('#2c221d', 98, 347, 27, 63)
    box('#30221d', 573, 332, 26, 78)
  } else {
    ctx.beginPath()
    ctx.arc(light, 92 + random() * 37, 26 + random() * 12, 0, Math.PI * 2)
    ctx.fillStyle = past ? '#fddca487' : '#d3e2dd73'
    ctx.fill()
    for (let index = 0; index < 14; index++) {
      const x = index * 54 + random() * 22 - 34
      const height = 24 + random() * (urban ? 138 : 68)
      box(index % 2 ? shade : walls, x, horizon - height, 47 + random() * 35, height)
      for (let row = 12; row < height - 5; row += 15) {
        box('#e8c69670', x + 10, horizon - height + row, 7, 7)
        box('#13171c6e', x + 28, horizon - height + row, 6, 8)
      }
    }
    if (kind === 'field') {
      shape('#344a3c', [[0, horizon], [720, horizon], [720, 410], [0, 410]])
      shape('#688387', [[453, horizon], [508, horizon], [672, 410], [291, 410]])
      for (let n = 0; n < 14; n++) {
        const y = horizon + random() * (410 - horizon)
        box('#b0c2a35e', 439 + random() * 95, y, 11 + random() * 44, 2)
      }
      for (const base of [20, 145, 658]) {
        const height = 64 + random() * 70
        box('#62422e', base + 19, 365 - height, 7, height)
        for (let leaf = -2; leaf <= 2; leaf++) shape('#57644a', [[base + 23, 365 - height], [base + leaf * 27, 344 - height - Math.abs(leaf) * 9], [base + leaf * 23, 371 - height]])
      }
    } else {
      shape('#7c6856', [[308, horizon], [438, horizon], [690, 410], [22, 410]])
      if (kind === 'rail') {
        for (let step = 1; step <= 12; step++) {
          const gap = step * step / 144
          box('#3e312a', 367 - gap * 300, horizon + gap * 205, 18 + gap * 569, 2 + gap * 5)
        }
        shape('#b9a19b', [[348, horizon], [352, horizon], [164, 410], [151, 410]])
        shape('#b9a19b', [[397, horizon], [401, horizon], [576, 410], [564, 410]])
      } else {
        for (let j = 0; j < 5; j++) box('#312723', 125 + j * 18, 250, 5, 113)
        box('#513c32', 117, 279, 90, 8)
        box('#513c32', 117, 308, 90, 8)
      }
    }
  }
  const clueX = 343 + Math.round(random() * 92)
  const clueY = kind === 'room' ? 289 : 306 + Math.round(random() * 29)
  if (!past) {
    // The physical clue survived as a trace, but the object belongs to the reconstruction.
    box('#292d30', clueX - 40, clueY - 6, 81, 5)
    box('#585c56', clueX - 31, clueY - 10, 27, 3)
    if (kind === 'room') {
      box('#675c4f', 158, 48, 405, 13)
      box('#b08e68', 164, 48, 395, 3)
      box('#a49a7b', 579, 222, 46, 35)
      box('#636a61', 583, 227, 39, 2)
    } else {
      box('#343537', 550, 231, 10, 117)
      box('#343537', 633, 231, 10, 117)
      box('#706757', 547, 229, 98, 28)
      for (let n = 0; n < 6; n++) shape('#52453d', [[552 + n * 15, 256], [557 + n * 15, 256], [571 + n * 15, 231], [565 + n * 15, 231]])
    }
  } else if (place.slot === 0) {
    box('#49352b', clueX - 48, clueY - 14, 103, 31)
    box('#c34e34', clueX, clueY, 23, 3)
  } else {
    ctx.save()
    ctx.translate(clueX, clueY)
    ctx.rotate((random() - .5) * .42)
    box('#d5b88e', -32, -12, 65, 33)
    box('#9e4538', -19, -7, 33, 3)
    for (let line = 0; line < place.slot; line++) box('#725441', -19, line * 4 + 2, 36, 1)
    ctx.restore()
  }

  for (let pixel = 0; pixel < 1800; pixel++) {
    const x = random() * w, y = random() * h
    box(pixel % 2 ? '#180f112e' : '#f8dec02b', x, y, 1 + random() * 3, 1)
  }
  const vignette = ctx.createRadialGradient(360, 210, 140, 360, 210, 490)
  vignette.addColorStop(0, '#0000')
  vignette.addColorStop(1, '#100c0ce6')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, w, h)
  box('#151719bb', 0, 366, 720, 44)
  ctx.font = 'bold 18px Arial'
  ctx.textAlign = 'right'
  ctx.fillStyle = '#f8ddaf'
  ctx.fillText(place.title, 697, 394, 542)
  ctx.textAlign = 'left'
  ctx.font = 'bold 17px monospace'
  ctx.fillText(past ? String(YEARS[place.phase]) : '2026', 22, 395)
}
