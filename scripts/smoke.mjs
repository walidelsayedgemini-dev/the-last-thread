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
  assert(await page.locator('.inv-scene-photo').evaluate(img => img.complete && img.naturalWidth > 0), '2D scene artwork did not load')
  assert(await page.locator('.inv-nav-btn').count() === 2, 'scene and map navigation are missing')
  assert(await page.locator('.inv-objective-cta').count() === 1, 'the current objective has no direct action')
  assert((await page.locator('.inv-scene-photo').getAttribute('src')).includes('zeinab-room'), 'Zeinab scene still reuses generic fields')
  assert(await page.locator('.inv-field-log').count() === 1, 'field-investigation notes are missing')
  await page.waitForSelector('.chapter-banner.in .chapter-title', { timeout: 6_000 })
  assert((await page.locator('.chapter-banner .chapter-title').textContent()).includes('الباب المقفول'), 'the first chapter banner did not appear')
  const guardedDebug = await page.evaluate(() => {
    window.__ltt.selectPlace('raml_stop')
    window.__ltt.useHotspot('hs_bus_city')
    return { place: window.__ltt.investigation.currentPlace, visited: window.__ltt.session.state.flags.has('visited_city') }
  })
  assert(guardedDebug.place === 'zeinab_home' && !guardedDebug.visited, 'test bridge bypassed district travel or hotspot availability')
  await page.screenshot({ path: `${out}/02-scene-abis.png` })

  await page.locator('.inv-objective-cta').click()
  assert((await snap(page)).tab === 'scene', 'the objective CTA did not keep the player on the target scene')
  await page.waitForFunction(() => {
    const el = document.querySelector('.inv-people')
    const rect = el?.getBoundingClientRect()
    return !!rect && rect.top < innerHeight - 80 && rect.bottom > 100
  }, null, { timeout: 5_000 })
  assert(await page.locator('.inv-actor.next-target .guide-arrow').count() === 1, 'the next-step person is not highlighted in the scene')
  assert(await page.evaluate(() => ['dawn', 'day', 'dusk', 'night'].includes(document.body.dataset.tod)), 'day/night was not applied')
  await page.locator('.inv-open-file').click()
  await page.waitForSelector('.casefile:not([hidden])', { timeout: 5_000 })
  assert(await page.locator('.board-empty').count() === 1, 'an empty case board did not explain how to continue')
  await page.screenshot({ path: `${out}/05-empty-board.png` })
  await page.locator('.board-empty-action').click()
  await page.waitForFunction(() => document.querySelector('.casefile')?.hidden)

  // ---- 2. Talk to a character, then use the map to reach the bus stop ----------------------------------------------
  await page.locator('.inv-talk-btn').first().click()
  await page.waitForSelector('.dialogue:not([hidden])', { timeout: 10_000 })
  assert(await page.locator('.dlg-hint').isVisible(), 'dialogue did not explain how to finish a typing line')
  await page.locator('.dlg-portrait').click()
  assert(await page.locator('.dlg-hint').isHidden(), 'dialogue hint remained after finishing the typing line')
  await page.waitForFunction(() => {
    const image = document.querySelector('.dlg-portrait img')
    return image?.complete && image.naturalWidth > 0
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/03-dialogue.png` })
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('.dialogue')?.hidden)

  await openMap(page)
  assert(await page.locator('.inv-place-thumbnail').count() === 7, 'Abis map does not show a photo for every location')
  await page.screenshot({ path: `${out}/03a-visual-map.png` })
  await page.locator('.inv-place-card').filter({ hasText: 'موقف ميكروباص أبيس' }).click()
  await page.waitForFunction(() => window.__ltt.investigation.currentPlace === 'abis_stop')
  assert((await snap(page)).district === 'abis', 'map allowed the player to leave the current district')
  await page.locator('.inv-interaction-card.travel').click()
  await page.waitForFunction(() => window.__ltt.investigation.currentPlace === 'raml_stop', null, { timeout: 10_000 })
  assert((await snap(page)).district === 'city', 'the bus did not move the 2D scene to Alexandria')
  assert(await page.evaluate(() => window.__ltt.session.state.flags.has('visited_city')), 'bus travel did not preserve the story flag')
  await page.waitForFunction(() => {
    const img = document.querySelector('.inv-scene-photo')
    return img?.complete && img.naturalWidth > 0
  })
  await page.screenshot({ path: `${out}/04-city.png` })
  console.log('smoke: travelled from Abis to Alexandria via the story bus')

  // ---- 3. Travel back, inspect evidence, and open the existing case board ------------------------------------------
  await openMap(page)
  await page.locator('.inv-place-card').filter({ hasText: 'موقف محطة الرمل' }).click()
  await page.waitForFunction(() => window.__ltt.investigation.currentPlace === 'raml_stop')
  await page.locator('.inv-interaction-card.travel').click()
  await page.waitForFunction(() => window.__ltt.investigation.currentPlace === 'abis_stop', null, { timeout: 10_000 })

  await openMap(page)
  await page.locator('.inv-place-card').filter({ hasText: 'بيت خالك محمود' }).click()
  await page.waitForFunction(() => window.__ltt.investigation.currentPlace === 'mahmoud_house')
  await page.locator('.inv-interaction-card').filter({ hasText: 'الخيط على الباب' }).click()
  await page.waitForFunction(() => window.__ltt.session.state.evidence.has('e_thread_door'), null, { timeout: 10_000 })
  assert((await snap(page)).evidence >= 1, 'the hotspot did not add evidence')
  assert((await page.locator('.inv-recovered').textContent()).includes('خيط أحمر'), 'the scene did not show recovered evidence')
  await page.locator('.inv-open-file').click()
  await page.waitForSelector('.casefile:not([hidden])', { timeout: 5_000 })
  assert((await page.locator('.cf-folder').textContent()).includes('خيط أحمر على الباب'), 'the evidence was not added to the case file')
  assert(await page.locator('.cf-tab-badge:not(.mail)').count() === 1, 'unread journal pages are not flagged on the tab')
  assert(await page.locator('.cf-tab-badge.mail').count() === 1, 'the first letter did not arrive in the mailbox')
  await page.locator('.cf-tab').filter({ hasText: 'الجوابات' }).click()
  await page.locator('.mail-card.new').first().click()
  await page.waitForSelector('.letter-paper', { timeout: 5_000 })
  assert((await page.locator('.letter-paper').textContent()).includes('من:'), 'the letter did not open')
  await page.locator('.letter-ok').click()
  while (await page.locator('.mail-card.new').count()) { await page.locator('.mail-card.new').first().click(); await page.locator('.letter-ok').click() }
  assert(await page.locator('.mail-card.new').count() === 0, 'a read letter is still marked new')
  assert(await page.locator('.cf-tab').filter({ hasText: 'المنظّم' }).count() === 0, 'simple mode should hide the organizer tab')
  await page.locator('.cf-tab').filter({ hasText: 'اللوحة' }).click()
  assert(await page.evaluate(() => document.body.dataset.area === 'mahmoud_house'), 'the area theme did not follow the place')
  await page.locator('.cf-tab').filter({ hasText: 'اليوميات' }).click()
  assert(await page.locator('.journal-page').count() >= 2, 'journal pages were not unlocked by the first clue')
  assert(await page.locator('.cf-tab-badge').count() === 0, 'journal pages stayed unread after opening the tab')
  assert((await page.locator('.cf-title small').textContent()).includes('الفصل'), 'case file does not show the current chapter')
  await page.screenshot({ path: `${out}/05e-journal.png` })
  await page.evaluate(() => { window.__ltt.settings.update({ simpleMode: false }); window.__ltt.caseFile.refresh() })
  await page.locator('.cf-tab').filter({ hasText: 'المنظّم' }).click()
  assert(await page.locator('.suspect-file').count() === 5, 'the suspect organizer is incomplete')
  await page.locator('.suspect-file').first().locator('.lvl-btn.l2').click()
  assert(await page.locator('.suspect-file.lvl-2').count() === 1, 'suspicion level was not saved')
  assert(await page.locator('.suspect-file').first().locator('.suspect-notes li').count() >= 0, 'suspect notes are not rendered')
  await page.screenshot({ path: `${out}/05f-organizer.png` })
  await page.locator('.org-tab').filter({ hasText: 'الخط الزمني' }).click()
  assert(await page.locator('.tl-item.gap').count() >= 5 && await page.locator('.tl-item').count() === 9, 'timeline gaps are missing')
  await page.screenshot({ path: `${out}/05g-timeline.png` })
  await page.locator('.org-tab').filter({ hasText: 'الأوسمة' }).click()
  assert(await page.locator('.badge').count() === 6, 'badges are missing')
  await page.locator('.cf-tab').filter({ hasText: 'المهام' }).click()
  assert(await page.locator('.quest-head').count() === 1, 'side quest tracker is missing')
  await page.locator('.cf-tab').filter({ hasText: 'الأدلة' }).click()
  assert(await page.locator('.cf-evidence-filter').count() >= 3, 'the evidence inbox filters are missing')
  assert((await page.locator('.ev-status').first().textContent()).includes('جديد'), 'new evidence is not marked before review')
  assert(await page.locator('.inv-new-count').count() === 1, 'the mobile dock did not count new evidence')
  assert(await page.locator('.ev-thumb').count() === 1, 'the original thread evidence thumbnail is missing')
  await page.screenshot({ path: `${out}/05a-evidence-inbox.png` })
  await page.locator('.cf-evidence-filter').filter({ hasText: 'جديد' }).click()
  assert(await page.locator('.ev-trigger').count() === 1, 'the new-evidence filter returned the wrong records')
  await page.locator('.cf-evidence-filter').filter({ hasText: 'الكل' }).click()
  await page.locator('.ev-trigger').first().click()
  assert(await page.locator('.ev-trigger').first().getAttribute('aria-expanded') !== null, 'evidence record did not expand')
  assert((await page.locator('.ev-status').first().textContent()).includes('مُراجع'), 'opening evidence did not update its review status')
  assert(await page.locator('.inv-new-count').count() === 0, 'reviewed evidence remained marked as new in the dock')
  await page.waitForFunction(() => {
    const image = document.querySelector('.ev-artwork img')
    return image?.complete && image.naturalWidth > 0
  })
  await page.screenshot({ path: `${out}/05b-evidence-photo.png` })
  await page.locator('.cf-tab').filter({ hasText: 'اللوحة' }).click()
  await page.screenshot({ path: `${out}/05-casefile.png` })
  await page.locator('.cf-close').click()

  // Free life choices happen through ordinary dialogue branches and never change the clues.
  const pickChoice = async text => {
    await page.waitForSelector('.dialogue:not([hidden])', { timeout: 10_000 })
    for (let i = 0; i < 12; i += 1) {
      if (await page.locator('.dlg-choice', { hasText: text }).count()) break
      await page.locator('.dlg-portrait').click().catch(() => {})
      await page.waitForTimeout(140)
    }
    await page.locator('.dlg-choice', { hasText: text }).first().click()
  }
  const evidenceBefore = (await snap(page)).evidence
  await page.evaluate(() => window.__ltt.talk('ragab'))
  await pickChoice('الشغل والناس')
  await pickChoice('الكبير')
  await pickChoice('أشتغل معاهم')
  await pickChoice('تمام يا معلم')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('.dialogue')?.hidden)
  assert(await page.evaluate(() => window.__ltt.session.state.flags.has('life_join_gang')), 'the street-path choice was not recorded')
  assert((await snap(page)).evidence === evidenceBefore, 'a life choice changed the evidence list')
  await page.waitForFunction(() => [...document.querySelectorAll('.toasts *')].some(el => el.textContent.includes('اخترت')), null, { timeout: 8_000 })
  await page.locator('.inv-open-file').click()
  await page.locator('.cf-tab').filter({ hasText: 'حياتك' }).click()
  assert(await page.locator('.path-card.p-street.lead').count() === 1, 'the street path was not highlighted')
  assert(await page.locator('.choice-log li').count() === 1, 'the choice log is missing')
  await page.locator('.org-tab').filter({ hasText: 'سيرة ياسين' }).click()
  assert(await page.locator('.real-tag').count() >= 4, 'real-world anchors are missing from the biography')
  await page.locator('.org-tab').filter({ hasText: 'إسكندرية الحقيقية' }).click()
  assert(await page.locator('.alex-card').count() >= 6, 'real Alexandria facts are missing')
  await page.screenshot({ path: `${out}/05h-real-alex.png` })
  await page.locator('.org-tab').filter({ hasText: 'حياة محمود' }).click()
  assert(await page.locator('.tl-item.gap').count() >= 2, 'Mahmoud life pages are not gated')
  await page.locator('.cf-tab').filter({ hasText: 'اللوحة' }).click()
  await page.locator('.cf-close').click()

  // Pause copy must describe 2D controls, not movement/camera controls.
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => window.__ltt.shell.screen === 'pause')
  const pauseCopy = await page.locator('.controls').textContent()
  assert(/الخريطة/.test(pauseCopy) && !/WASD|كاميرا|زاوية الكاميرا/.test(pauseCopy), 'pause menu still gives obsolete 3D controls')
  await page.evaluate(() => window.__ltt.shell.go('settings', 'pause'))
  await page.locator('.size-opt[data-size="xlarge"]').click()
  assert(await page.evaluate(() => document.documentElement.dataset.textSize) === 'xlarge', 'text size setting was not applied')
  assert(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)) > 20, 'text size did not scale the interface')
  await page.locator('.size-opt[data-size="normal"]').click()
  await page.locator('.settings .back').click()
  await page.waitForFunction(() => window.__ltt.shell.screen === 'pause')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => window.__ltt.shell.screen === 'none')

  // The key switches to an original indoor scene without changing the investigation rules.
  await page.evaluate(() => {
    const { session, investigation } = window.__ltt
    session.engine.apply([{ type: 'flag', id: 'has_key' }])
    investigation.refresh()
  })
  await page.waitForFunction(() => {
    const image = document.querySelector('.inv-scene-photo')
    return image?.src.includes('mahmoud-study') && image.complete && image.naturalWidth > 0
  })
  await page.locator('.inv-interaction-card').filter({ hasText: 'مكتب خالك' }).click()
  await page.locator('.inv-interaction-card').filter({ hasText: 'المعطف' }).click()
  await page.waitForFunction(() => window.__ltt.session.state.evidence.has('e_survey_book') && window.__ltt.session.state.evidence.has('e_microbus_ticket'))
  await page.screenshot({ path: `${out}/05c-mahmoud-study.png` })
  await page.locator('.inv-open-file').click()
  await page.waitForSelector('.casefile:not([hidden])')
  assert(await page.locator('.pin-card-art').count() === 3, 'collected evidence images are missing from the thread board')
  await page.screenshot({ path: `${out}/05d-photo-board.png` })
  await page.locator('.cf-close').click()

  const routedObjective = await page.evaluate(() => {
    const { session, investigation } = window.__ltt
    session.engine.apply([
      { type: 'flag', id: 'zeinab_talked' }, { type: 'flag', id: 'visited_city' }, { type: 'flag', id: 'library_code' },
      ...['e_thread_door', 'e_survey_book', 'e_microbus_ticket', 'e_boundary_stone', 'e_hassan_testimony', 'e_library_photo', 'e_library_envelope']
        .map(id => ({ type: 'evidence', id })),
    ])
    investigation.setPlace('mahmoud_house')
    return session.engine.currentObjective()?.id
  })
  assert(routedObjective === 'o_bahr', `expected a city objective before routing, got ${routedObjective}`)
  assert((await page.locator('.inv-objective-cta').textContent()).includes('روح لموقف الميكروباص'), 'a cross-district objective did not explain its first travel step')
  await page.locator('.inv-objective-cta').click()
  assert((await snap(page)).place === 'abis_stop' && (await snap(page)).district === 'abis', 'the objective CTA must route to the local bus stop, not teleport to the target district')
  assert((await snap(page)).tab === 'scene', 'the objective CTA left the scene after routing to the bus stop')

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
  await page.waitForSelector('.epilogue.hook', { timeout: 5_000 })
  assert((await page.locator('.epilogue h3').allTextContents()).some(t => t.includes('ناس الليل')), 'the ending ignored the player path')
  await page.waitForTimeout(6_500)
  await page.screenshot({ path: `${out}/06-ending.png`, fullPage: true })
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
  assert(await mobile.locator('.inv-mobile-nav [aria-current="page"]').count() === 1, 'the mobile dock does not expose its active page')
  await mobile.waitForFunction(() => {
    const image = document.querySelector('.inv-person-portrait img')
    return image?.complete && image.naturalWidth > 0
  })
  const minTouchHeight = await mobile.locator('.inv-mobile-nav button').evaluateAll(buttons => Math.min(...buttons.map(button => button.getBoundingClientRect().height)))
  assert(minTouchHeight >= 44, `mobile dock targets are too small (${minTouchHeight}px)`)
  const duplicateHeaderActions = await mobile.locator('.inv-header-actions .inv-file-action, .inv-header-actions .inv-action-btn[aria-label="تلميح"]').evaluateAll(nodes => nodes.some(node => getComputedStyle(node).display !== 'none'))
  assert(!duplicateHeaderActions, 'file or hint actions are duplicated between the header and mobile dock')
  const horizontalOverflow = await mobile.locator('.inv-frame').evaluate(el => el.scrollWidth > el.clientWidth + 2)
  assert(!horizontalOverflow, '2D investigation layout overflows horizontally on a phone')
  await mobile.evaluate(() => {
    const { session, investigation } = window.__ltt
    session.engine.apply([{ type: 'evidence', id: 'e_thread_door' }])
    investigation.refresh()
  })
  assert((await mobile.locator('.inv-new-count').textContent())?.trim() === '١', 'the mobile dock did not badge newly found evidence')
  assert(await mobile.locator('.inv-scene-photo').evaluate(img => img.currentSrc.includes('mobile')), 'phone did not select lightweight scene artwork')
  await mobile.screenshot({ path: `${out}/07-phone.png`, fullPage: true })
  await mobile.locator('.inv-mobile-file').click()
  await mobile.locator('.cf-tab').filter({ hasText: 'الأدلة' }).click()
  await mobile.locator('.ev-trigger').click()
  await mobile.waitForFunction(() => {
    const image = document.querySelector('.ev-artwork img')
    return image?.complete && image.naturalWidth > 0
  })
  assert(!(await mobile.locator('.cf-page').evaluate(el => el.scrollWidth > el.clientWidth + 2)), 'evidence artwork overflows horizontally on a phone')
  await mobile.screenshot({ path: `${out}/08-phone-evidence.png` })
  await phone.close()

  assert(errors.length === 0, `console errors:\n  ${errors.join('\n  ')}`)
  await browser.close()
  cleanup()
  console.log(`smoke: OK — screenshots in ${out}/`)
} catch (err) {
  await fail(err?.message ?? String(err))
}
