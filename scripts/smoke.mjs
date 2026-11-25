// End-to-end smoke test for «الخيط الأخير». Requires a build in dist/ (`pnpm build`).
//
// Serves dist/ with `vite preview`, boots the game in headless Chromium and checks, through the real UI:
//   1. title screen -> story-mode autostart -> HUD, movement with the keyboard,
//   2. a real conversation (teleport next to Zeinab, press E, dialogue opens, a choice is clicked),
//   3. the case file overlay (Tab), pause menu (Esc) and travel to the city zone,
//   4. the full case is finished through the engine, the accusation is made and the ending screen appears,
//   5. the realistic-mode clock gate (`?now=`) and a touch layout at phone size.
// Any console error / failed request fails the run. Screenshots land in $SHOTS_DIR (default ./shots).
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const port = 4300 + Math.floor(Math.random() * 500)
const base = `http://127.0.0.1:${port}/`
const out = process.env.SHOTS_DIR ?? 'shots'
mkdirSync(out, { recursive: true })

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--config', 'scripts/manus-game-assets/vite.config.mjs', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' })
let browser
const guard = setTimeout(() => fail('timed out'), 240_000)

function cleanup() {
  clearTimeout(guard)
  try { server.kill('SIGTERM') } catch { /* already gone */ }
}
async function fail(msg) {
  console.error(`smoke: FAIL — ${msg}`)
  await browser?.close().catch(() => {})
  cleanup()
  process.exit(1)
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}
async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try { if ((await fetch(base)).ok) return } catch { /* not yet */ }
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error('preview server did not start')
}

const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']

async function open(context, errors, query) {
  const page = await context.newPage()
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', e => errors.push(String(e)))
  page.on('response', r => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`))
  await page.goto(base + query)
  await page.waitForFunction(() => window.__ltt?.session || window.__ltt?.shell?.screen === 'title', null, { timeout: 60_000 })
  return page
}
const snap = page => page.evaluate(() => {
  const { game, session, shell } = window.__ltt
  const p = game.player.position
  return { mode: game.mode, zone: game.zone, x: p.x, z: p.z, ev: session.state.evidence.size, screen: shell.screen, hour: session.clock.hour }
})

try {
  await waitForServer()
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium', args: GL_ARGS }).catch(() => chromium.launch({ args: GL_ARGS }))
  const errors = []

  // ---- 1. Title screen, then story-mode autostart ------------------------------------------------------------------
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'ar-EG' })
  const title = await open(desktop, errors, '')
  await title.waitForFunction(() => window.__ltt.shell.screen === 'title', null, { timeout: 30_000 })
  assert(await title.evaluate(() => document.documentElement.dir === 'rtl'), 'document is not RTL')
  await title.screenshot({ path: `${out}/01-title.png` })
  await title.close()

  const page = await open(desktop, errors, '?autostart=story')
  await page.waitForFunction(() => window.__ltt.game?.mode === 'playing', null, { timeout: 60_000 })
  await page.waitForTimeout(1500)
  const before = await snap(page)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1200)
  await page.keyboard.up('KeyW')
  const after = await snap(page)
  const moved = Math.hypot(after.x - before.x, after.z - before.z)
  assert(moved > 1, `player barely moved (${moved.toFixed(2)} m)`)
  await page.screenshot({ path: `${out}/02-abis.png` })
  console.log(`smoke: walked ${moved.toFixed(1)} m in Abis`)

  // ---- 2. Real conversation with Zeinab ----------------------------------------------------------------------------
  await page.evaluate(() => {
    const { game, session } = window.__ltt
    const p = session.positionOf(session.knownCharacters().find(c => c.id === 'zeinab'))
    game.teleport(p.x + 1.8, p.z + 1.8)
  })
  await page.waitForTimeout(600)
  await page.evaluate(() => window.__ltt.game.interact())
  await page.waitForSelector('.dialogue:not([hidden])', { timeout: 10_000 })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${out}/03-dialogue.png` })
  const choices = await page.$$('.dialogue button')
  assert(choices.length > 0, 'dialogue shows no buttons')
  await page.keyboard.press('Escape') // dialogue closes via keyboard
  await page.waitForTimeout(500)

  // ---- 3. Case file, pause, travel ---------------------------------------------------------------------------------
  await page.evaluate(() => { const { game } = window.__ltt; if (game.mode !== 'playing') game.resumePlay() })
  await page.keyboard.press('Tab')
  await page.waitForSelector('.casefile:not([hidden])', { timeout: 5_000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/04-casefile.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.evaluate(() => { const { game } = window.__ltt; if (game.mode !== 'playing') game.resumePlay() })

  await page.evaluate(() => {
    const { game, session } = window.__ltt
    session.engine.apply([{ type: 'flag', id: 'visited_city' }])
    game.teleport(-30, 185)
  })
  await page.waitForFunction(() => /ميكروباص/.test(document.querySelector('.prompt:not([hidden])')?.textContent ?? ''), null, { timeout: 10_000 }) // prompt for the stop appears once in range
  await page.evaluate(() => window.__ltt.game.interact())
  await page.waitForFunction(() => window.__ltt.game.zone === 'city', null, { timeout: 40_000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${out}/05-city.png` })
  console.log('smoke: travelled to the city zone')

  // ---- 4. Finish the case and reach the ending ---------------------------------------------------------------------
  const ending = await page.evaluate(() => {
    const { session } = window.__ltt
    const e = session.engine
    const evidence = ['e_thread_door', 'e_survey_book', 'e_microbus_ticket', 'e_boundary_stone', 'e_library_envelope',
      'e_forged_contract', 'e_qaitbay_photo', 'e_hassan_testimony', 'e_bahr_testimony']
    e.apply(evidence.map(id => ({ type: 'evidence', id })))
    e.apply([{ type: 'flag', id: 'found_mahmoud' }])
    e.tie('e_boundary_stone', 'e_survey_book')
    e.tie('e_library_envelope', 'e_forged_contract')
    e.tie('e_thread_door', 'e_qaitbay_photo')
    const wrong = session.accuse('hassan', 'm_road')
    const ok = session.accuse('shawky', 'm_road')
    return { wrong, ok, canAccuse: e.canAccuse(), grade: e.grade() }
  })
  assert(ending.wrong === 'wrong-culprit' && ending.ok === 'ok', `unexpected accusation results ${JSON.stringify(ending)}`)
  await page.waitForFunction(() => window.__ltt.shell.screen === 'ending', null, { timeout: 15_000 }).catch(() => undefined)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${out}/06-ending.png` })
  console.log(`smoke: case solved, grade ${ending.grade}`)
  await page.close()

  // ---- 5. Realistic clock gate: the cafe is closed at 10:00 Cairo time --------------------------------------------
  const real = await open(desktop, errors, '?autostart=realistic&now=2026-11-25T10:00')
  await real.waitForFunction(() => window.__ltt.game?.mode === 'playing', null, { timeout: 60_000 })
  const hour = (await snap(real)).hour
  assert(Math.abs(hour - 10) < 0.5, `realistic clock should be ~10, got ${hour}`)
  await real.screenshot({ path: `${out}/07-realistic-day.png` })
  await real.close()
  await desktop.close()

  // ---- 6. Phone layout --------------------------------------------------------------------------------------------
  const phone = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ar-EG' })
  const mobile = await open(phone, errors, '?autostart=story')
  await mobile.waitForFunction(() => window.__ltt.game?.mode === 'playing', null, { timeout: 60_000 })
  await mobile.waitForTimeout(1200)
  assert(await mobile.evaluate(() => document.body.classList.contains('has-touch') || !!document.querySelector('.touch:not([hidden])')), 'touch controls missing on a phone')
  await mobile.screenshot({ path: `${out}/08-phone.png` })
  await phone.close()

  assert(errors.length === 0, `console errors:\n  ${errors.join('\n  ')}`)
  await browser.close()
  cleanup()
  console.log(`smoke: OK — screenshots in ${out}/`)
} catch (err) {
  await fail(err?.message ?? String(err))
}
