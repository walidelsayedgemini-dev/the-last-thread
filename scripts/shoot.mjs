// Usage: node scripts/shoot.mjs <outDir> <step...>   (dev server on :3000)
// Steps are JS snippets run in the page after autostart; each "shot:name" saves a screenshot.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const out = process.argv[2] ?? '/home/ubuntu/scratch/shots'
const query = process.env.Q ?? '?autostart=story'
const script = JSON.parse(process.env.STEPS ?? '[]')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 720) } })
const errors = []
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`) })
page.on('pageerror', e => errors.push(`[pageerror] ${e.stack ?? e}`))
page.on('response', r => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`))
await page.goto(`http://127.0.0.1:3000/${query}`)
await page.waitForTimeout(Number(process.env.BOOT ?? 6000))
for (const step of script) {
  if (typeof step === 'string' && step.startsWith('shot:')) {
    await page.screenshot({ path: `${out}/${step.slice(5)}.png` })
  } else if (typeof step === 'number') await page.waitForTimeout(step)
  else if (step.key) await page.keyboard.press(step.key)
  else if (step.click) await page.click(step.click)
  else if (step.eval) {
    const r = await page.evaluate(step.eval)
    if (r !== undefined) console.log('eval →', JSON.stringify(r))
  }
}
console.log(errors.slice(0, 25).join('\n') || 'no console errors')
await browser.close()
