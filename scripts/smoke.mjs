// End-to-end smoke test for «الخيط الأخير». Requires a build in dist/ (`pnpm build`).
// Exercises the real 2D case-file interface, both district transfers, evidence and story gates.
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

async function open(context, errors, query) {
  const page = await context.newPage()
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', e => errors.push(String(e)))
  page.on('response', r => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`))
  await page.goto(base + query)
  await page.waitForFunction(() => window.__ltt?.session || document.querySelector('.shell')?.dataset.screen === 'title', null, { timeout: 60_000 })
  return page
}
const snap = page => page.evaluate(() => {
  const { investigation, session, shell } = window.__ltt
  return {
    place: investigation.currentPlace,
    district: investigation.el.dataset.district,
    tab: investigation.currentTab,
    evidence: session.state.evidence.size,
    mode: session.mode,
    screen: shell.screen,
    hour: session.clock.hour,
  }
})
const openMap = async page => {
  const desktopButton = page.locator('.inv-nav-btn').nth(1)
  if (await desktopButton.isVisible()) await desktopButton.click()
  else await page.locator('.inv-mobile-nav button').nth(1).click()
  await page.waitForFunction(() => window.__ltt.investigation.currentTab === 'map')
}

const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']

try {
  await waitForServer()
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium', args: GL_ARGS }).catch(() => chromium.launch({ args: GL_ARGS }))
  const errors = []

  // ---- 1. Main menu and the active 2D scene -------------------------------------------------------------------------
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ar-EG' })
  const title = await open(desktop, errors, '')
  await title.waitForFunction(() => document.querySelector('.shell')?.dataset.screen === 'title', null, { timeout: 30_000 })
  assert(await title.evaluate(() => document.documentElement.dir === 'rtl'), 'document is not RTL')
  assert(await title.locator('canvas#game').count() === 0, 'legacy 3D canvas is still in the page')
  await title.screenshot({ path: `${out}/01-title.png` })
  await title.close()

  const page = await open(desktop, errors, '?autostart=story')
  await page.waitForFunction(() => window.__ltt.session && !window.__ltt.investigation.el.hidden, null, { timeout: 60_000 })
  assert((await snap(page)).place === 'zeinab_home', 'new story did not start at Zeinab’s house')
  assert(await page.locator('.inv-photo').evaluate(img => img.complete && img.naturalWidth > 0), '2D scene artwork did not load')
  assert(await page.locator('.inv-nav-btn').count() === 2, 'scene and map navigation are missing')
  const guardedDebug = await page.evaluate(() => {
    window.__ltt.selectPlace('raml_stop')
    window.__ltt.useHotspot('hs_bus_city')
    return { place: window.__ltt.investigation.currentPlace, visited: window.__ltt.session.state.flags.has('visited_city') }
  })
  assert(guardedDebug.place === 'zeinab_home' && !guardedDebug.visited, 'test bridge bypassed district travel or hotspot availability')
  await page.waitForTimeout(1400)
  await page.screenshot({ path: `${out}/02-scene-abis.png` })

  // ---- 2. Talk to a character, then use the map to reach the bus stop ----------------------------------------------
  await page.locator('.inv-person').first().click()
  await page.waitForSelector('.dialogue:not([hidden])', { timeout: 10_000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/03-dialogue.png` })
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('.dialogue')?.hidden)

  await openMap(page)
  await page.locator('.inv-map-card').filter({ hasText: 'موقف ميكروباص أبيس' }).click()
  await page.waitForFunction(() => window.__ltt.investigation.currentPlace === 'abis_stop')
  assert((await snap(page)).district === 'abis', 'map allowed the player to leave the current district')
  await page.locator('.inv-pin.kind-travel').click()
  await page.waitForFunction(() => window.__ltt.investigation.currentPlace === 'raml_stop', null, { timeout: 10_000 })
  assert((await snap(page)).district === 'city', 'the bus did not move the 2D scene to Alexandria')
  assert(await page.evaluate(() => window.__ltt.session.state.flags.has('visited_city')), 'bus travel did not preserve the story flag')
  await page.waitForFunction(() => {
    const img = document.querySelector('.inv-photo')
    return img?.complete && img.naturalWidth > 0
  })
  await page.waitForTimeout(1400)
  await page.screenshot({ path: `${out}/04-city.png` })
  console.log('smoke: travelled from Abis to Alexandria via the story bus')

  // ---- 3. Travel back, inspect evidence, and open the existing case board ------------------------------------------
  await openMap(page)
  await page.locator('.inv-map-card').filter({ hasText: 'موقف محطة الرمل' }).click()
  await page.waitForFunction(() => window.__ltt.investigation.currentPlace === 'raml_stop')
  await page.locator('.inv-pin.kind-travel').click()
  await page.waitForFunction(() => window.__ltt.investigation.currentPlace === 'abis_stop', null, { timeout: 10_000 })

  await openMap(page)
  await page.locator('.inv-map-card').filter({ hasText: 'بيت خالك محمود' }).click()
  await page.waitForFunction(() => window.__ltt.investigation.currentPlace === 'mahmoud_house')
  await page.locator('.inv-pin').filter({ hasText: 'الخيط على الباب' }).click()
  await page.waitForFunction(() => window.__ltt.session.state.evidence.has('e_thread_door'), null, { timeout: 10_000 })
  assert((await snap(page)).evidence >= 1, 'the hotspot did not add evidence')
  assert((await page.locator('.inv-chips').textContent()).includes('خيط أحمر'), 'the scene did not show recovered evidence')
  await page.locator('.inv-header .inv-file-btn').click()
  await page.waitForSelector('.casefile:not([hidden])', { timeout: 5_000 })
  assert((await page.locator('.cf-folder').textContent()).includes('خيط أحمر على الباب'), 'the evidence was not added to the case file')
  await page.screenshot({ path: `${out}/05-casefile.png` })
  await page.locator('.cf-close').click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${out}/05b-scene-mahmoud.png` })

  // Pause copy must describe 2D controls, not movement/camera controls.
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => window.__ltt.shell.screen === 'pause')
  const pauseCopy = await page.locator('.controls').textContent()
  assert(/الخريطة/.test(pauseCopy) && !/WASD|كاميرا|زاوية الكاميرا/.test(pauseCopy), 'pause menu still gives obsolete 3D controls')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => window.__ltt.shell.screen === 'none')

  // ---- 4. Finish the existing case through its unchanged engine and verify the ending -------------------------------
  const ending = await page.evaluate(() => {
    const { session } = window.__ltt
    const e = session.engine
    const evidence = ['e_thread_door', 'e_survey_book', 'e_microbus_ticket', 'e_boundary_stone', 'e_library_envelope',
      'e_forged_contract', 'e_qaitbay_photo', 'e_hassan_testimony', 'e_bahr_testimony']
    e.apply(evidence.map(id => ({ type: 'evidence', id })))
    e.apply([{ type: 'flag', id: 'found_mahmoud' }])
    session.tie('e_boundary_stone', 'e_survey_book')
    session.tie('e_library_envelope', 'e_forged_contract')
    session.tie('e_thread_door', 'e_qaitbay_photo')
    const wrong = session.accuse('hassan', 'm_road')
    const ok = session.accuse('shawky', 'm_road')
    return { wrong, ok, grade: e.grade() }
  })
  assert(ending.wrong === 'wrong-culprit' && ending.ok === 'ok', `unexpected accusation results ${JSON.stringify(ending)}`)
  await page.waitForFunction(() => window.__ltt.shell.screen === 'ending', null, { timeout: 15_000 })
  await page.screenshot({ path: `${out}/06-ending.png` })
  console.log(`smoke: case solved, grade ${ending.grade}`)
  await page.close()

  // ---- 5. Realistic time gates still use the Cairo clock -----------------------------------------------------------
  const real = await open(desktop, errors, '?autostart=realistic&now=2026-11-25T10:00')
  await real.waitForFunction(() => window.__ltt.session?.mode === 'realistic', null, { timeout: 60_000 })
  const time = await snap(real)
  assert(Math.abs(time.hour - 10) < 0.5, `realistic clock should be ~10, got ${time.hour}`)
  const daytimeGate = await real.evaluate(() => {
    const { session } = window.__ltt
    session.engine.apply([{ type: 'evidence', id: 'e_library_envelope' }, { type: 'flag', id: 'visited_city' }])
    return session.engine.activeHotspots().some(h => h.id === 'hs_office_window')
  })
  assert(!daytimeGate, 'the night-only office hotspot was available at 10:00')
  await real.close()

  const night = await open(desktop, errors, '?autostart=realistic&now=2026-11-25T22:00')
  await night.waitForFunction(() => window.__ltt.session?.mode === 'realistic', null, { timeout: 60_000 })
  const nighttimeGate = await night.evaluate(() => {
    const { session } = window.__ltt
    session.engine.apply([{ type: 'evidence', id: 'e_library_envelope' }, { type: 'flag', id: 'visited_city' }])
    return session.engine.activeHotspots().some(h => h.id === 'hs_office_window')
  })
  assert(nighttimeGate, 'the night-only office hotspot did not open at 22:00')
  await night.close()
  await desktop.close()

  // ---- 6. Phone layout and touch-friendly 2D navigation ------------------------------------------------------------
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ar-EG' })
  const mobile = await open(phone, errors, '?autostart=story')
  await mobile.waitForFunction(() => window.__ltt.session && !window.__ltt.investigation.el.hidden, null, { timeout: 60_000 })
  const mobileNav = await mobile.locator('.inv-mobile-nav').evaluate(el => getComputedStyle(el).display)
  assert(mobileNav === 'grid', 'mobile investigation navigation is not visible')
  const horizontalOverflow = await mobile.locator('.investigation').evaluate(el => el.scrollWidth > el.clientWidth + 2)
  assert(!horizontalOverflow, '2D investigation layout overflows horizontally on a phone')
  await mobile.waitForTimeout(1200)
  await mobile.screenshot({ path: `${out}/07-phone.png` })
  await mobile.locator('.inv-person').first().click()
  await mobile.waitForSelector('.dialogue:not([hidden])', { timeout: 10_000 })
  await mobile.waitForTimeout(1500)
  await mobile.screenshot({ path: `${out}/08-phone-dialogue.png` })
  await mobile.keyboard.press('Escape')
  await openMap(mobile)
  await mobile.waitForTimeout(600)
  await mobile.screenshot({ path: `${out}/09-phone-map.png` })
  await phone.close()

  assert(errors.length === 0, `console errors:\n  ${errors.join('\n  ')}`)
  await browser.close()
  cleanup()
  console.log(`smoke: OK — screenshots in ${out}/`)
} catch (err) {
  await fail(err?.message ?? String(err))
}
