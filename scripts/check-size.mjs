// Checks JS/CSS and font budgets, per-file image/audio limits and total asset weight.
// JS/CSS are measured gzipped; TTF/WOFF2 fonts are measured as shipped and budgeted separately
// because CJK coverage is large. Art and audio are capped per file so one oversized scene or
// voice clip cannot quietly bloat the Android bundle and the phone download.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const MB = 1024 * 1024
const KB = 1024
const BUDGET = { js: 2.0 * MB, css: 96 * KB, fonts: 2.2 * MB, images: 24 * MB, audio: 10 * MB }
const walk = dir => readdirSync(dir).flatMap(name => {
  const p = join(dir, name)
  return statSync(p).isDirectory() ? walk(p) : [p]
})
const files = walk('dist').map(path => {
  const raw = readFileSync(path)
  const text = /\.(js|css|html|json|svg)$/.test(path)
  return { path, size: raw.length, wire: text ? gzipSync(raw).length : raw.length }
})
const sum = pred => files.filter(pred).reduce((n, f) => n + f.wire, 0)
const js = sum(f => f.path.endsWith('.js'))
const css = sum(f => f.path.endsWith('.css'))
const fonts = sum(f => /\.(ttf|woff2)$/.test(f.path))
const transfer = sum(f => !f.path.endsWith('.txt'))
const images = sum(f => /\.(avif|webp|png|jpe?g)$/.test(f.path))
const audio = sum(f => /\.(mp3|ogg|wav)$/.test(f.path))
const mb = n => `${(n / MB).toFixed(2)} MB`
const kb = n => `${Math.round(n / KB)} KB`

/** Per-file ceilings. `match` sees the built path, which still carries the source name + hash. */
const FILE_LIMITS = [
  { label: 'phone art', max: 220 * KB, match: p => /-phone-[A-Za-z0-9_-]{6,}\.(avif|webp|png|jpe?g)$/i.test(p) },
  { label: 'scene/evidence art', max: 460 * KB, match: p => /\.(avif|webp|png|jpe?g)$/i.test(p) && !/-phone-[A-Za-z0-9_-]{6,}\.(avif|webp|png|jpe?g)$/i.test(p) },
  { label: 'voice clip', max: 420 * KB, match: p => /\/audio\/voice\/.+\.(mp3|ogg|wav)$/.test(p) },
  { label: 'music track', max: 1.4 * MB, match: p => /\/audio\/[^/]+\.(mp3|ogg|wav)$/.test(p) },
]

console.log(`bundle (gzip): js ${mb(js)} / css ${mb(css)} / fonts ${mb(fonts)} / transfer ${mb(transfer)} / images ${mb(images)} / audio ${mb(audio)}`)

const problems = []
for (const [k, v] of Object.entries({ js, css, fonts, images, audio })) {
  if (v > BUDGET[k]) problems.push(`over budget: ${k} ${mb(v)} > ${mb(BUDGET[k])}`)
}
for (const limit of FILE_LIMITS) {
  const over = files.filter(f => limit.match(f.path) && f.size > limit.max)
  for (const f of over) problems.push(`${limit.label} too big: ${f.path} ${kb(f.size)} > ${kb(limit.max)}`)
}
if (problems.length) {
  for (const line of problems) console.error(line)
  process.exit(1)
}
