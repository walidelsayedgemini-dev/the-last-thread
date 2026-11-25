// Focused artwork/load audit. Throwaway autostart storage never changes player saves.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
const port = 4909
const out = process.env.SHOTS_DIR ?? 'shots/visual-update'
mkdirSync(out, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--config', 'scripts/manus-game-assets/vite.config.mjs', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
let browser
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: 'ar-EG' })
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`) })
  await page.goto(`http://127.0.0.1:${port}/?autostart=story`)
  await page.waitForFunction(() => window.__ltt?.session && !window.__ltt.investigation.el.hidden)
  const loaded = async () => {
    await page.waitForFunction(() => {
      const img = document.querySelector('.inv-scene-photo')
      return img?.complete && img.naturalWidth > 0
    })
    await page.locator('.inv-scene-photo').evaluate(img => img.decode())
    await page.waitForTimeout(150)
  }
  const resetScroll = () => page.locator('.investigation').evaluate(el => { el.scrollTop = 0 })
  const auditDistrict = async ids => {
    for (const id of ids) {
      await page.evaluate(id => window.__ltt.selectPlace(id), id)
      await loaded()
      const got = await page.locator('.inv-scene-photo').evaluate(img => ({ src: img.currentSrc, alt: img.alt }))
      if (!got.alt) throw new Error(`missing scene alt: ${id}`)
      console.log(`visual: loaded ${id}`)
    }
  }
  await loaded()
  await page.waitForFunction(() => {
    const image = document.querySelector('.inv-person-portrait img')
    return image?.complete && image.naturalWidth > 0
  })
  await page.screenshot({ path: `${out}/desktop-investigation.png` })
  await auditDistrict(['zeinab_home', 'mahmoud_house', 'cafe_ragab', 'abis_mosque', 'canal_bridge', 'plot15', 'abis_stop'])
  await page.evaluate(() => window.__ltt.investigation.setTab('map'))
  await page.locator('.inv-place-grid').scrollIntoViewIfNeeded()
  await page.waitForFunction(() => [...document.querySelectorAll('.inv-place-thumbnail')].every(img => img.complete && img.naturalWidth > 0))
  await page.locator('.inv-place-thumbnail').evaluateAll(images => Promise.all(images.map(img => img.decode())))
  await page.waitForTimeout(150)
  const sources = await page.locator('.inv-place-thumbnail').evaluateAll(images => images.map(img => img.src))
  if (new Set(sources).size !== 7) throw new Error('Abis sites reuse artwork')
  await page.screenshot({ path: `${out}/illustrated-location-map.png` })
  await page.evaluate(() => { window.__ltt.selectPlace('abis_stop'); window.__ltt.useHotspot('hs_bus_city') })
  await page.waitForFunction(() => window.__ltt.investigation.currentPlace === 'raml_stop')
  await auditDistrict(['raml_stop', 'mansheya', 'qaitbay', 'bibliotheca', 'pompey', 'corniche'])
  await page.evaluate(() => window.__ltt.selectPlace('pompey'))
  await loaded()
  await resetScroll()
  await page.screenshot({ path: `${out}/real-pompeys-pillar.png` })
  await page.evaluate(() => { window.__ltt.selectPlace('raml_stop'); window.__ltt.useHotspot('hs_bus_abis') })
  await page.waitForFunction(() => window.__ltt.investigation.currentPlace === 'abis_stop')
  await page.evaluate(() => {
    const { session, investigation } = window.__ltt
    session.engine.apply([{ type: 'flag', id: 'has_key' }])
    window.__ltt.selectPlace('mahmoud_house')
    investigation.refresh()
  })
  await loaded()
  await resetScroll()
  await page.waitForTimeout(6500)
  await page.screenshot({ path: `${out}/mahmoud-interior.png` })
  await page.evaluate(() => {
    const { session, investigation } = window.__ltt
    session.engine.apply(['e_thread_door','e_survey_book','e_microbus_ticket','e_boundary_stone','e_library_envelope','e_forged_contract','e_cafe_bill'].map(id => ({ type: 'evidence', id })))
    investigation.refresh()
  })
  await page.locator('.inv-open-file').click()
  await page.locator('.pin-card').first().focus()
  await page.keyboard.press('Enter')
  if (await page.locator('.pin-card.selected').count() !== 1) throw new Error('board keyboard selection failed')
  if (await page.locator('.pin-card').first().getAttribute('aria-pressed') !== 'true') throw new Error('board selection state is not exposed to assistive technology')
  if (!(await page.locator('.board-help').textContent()).includes('اتحدد')) throw new Error('board did not explain the second selection step')
  // Select the survey book after the thread; an invalid pair should leave rules intact.
  await page.locator('.pin-card').nth(1).focus()
  await page.keyboard.press('Enter')
  if (!(await page.locator('.board-note').textContent()).includes('مفيش علاقة')) throw new Error('invalid pair bypassed original rules')
  await page.locator('.pin-card').nth(1).focus()
  await page.keyboard.press('Enter')
  await page.locator('.pin-card').nth(3).focus()
  await page.keyboard.press('Enter')
  if (!(await page.evaluate(() => window.__ltt.session.state.deductions.has('d_markers')))) throw new Error('valid pair no longer links')
  if (await page.locator('.board-progress .board-stat').count() !== 3) throw new Error('board progress strip is missing')
  if (await page.locator('.deduction-card').count() !== 1) throw new Error('tied deduction card is missing')
  if (!(await page.locator('.board-note.success').textContent()).includes('استنتاج جديد')) throw new Error('fresh deduction feedback is missing')
  await page.locator('.pin-card').first().focus()
  await page.keyboard.press('Enter')
  if (await page.locator('.tray-slot.filled').count() !== 1) throw new Error('selection tray did not show the first evidence')
  await page.keyboard.press('Escape')
  if (await page.locator('.pin-card.selected').count() !== 0 || await page.locator('.casefile').isHidden()) throw new Error('Escape should cancel the selection before closing the file')
  for (let i = 0; i < 2; i += 1) {
    await page.locator('.pin-card').first().focus()
    await page.keyboard.press('Enter')
    await page.locator('.pin-card').nth(1).focus()
    await page.keyboard.press('Enter')
  }
  if (!(await page.locator('.board-note').textContent()).includes('جرّبت')) throw new Error('repeated failed pair was not remembered')
  if (await page.locator('.accuse-checklist li').count() < 4) throw new Error('locked accusation does not list its requirements')
  await page.evaluate(() => {
    const { session, caseFile } = window.__ltt
    session.engine.apply([{ type: 'evidence', id: 'e_qaitbay_photo' }, { type: 'flag', id: 'found_mahmoud' }])
    session.tie('e_library_envelope', 'e_forged_contract')
    session.tie('e_thread_door', 'e_qaitbay_photo')
    caseFile.refresh()
  })
  await page.locator('.deduction-head').first().click()
  if (await page.locator('.pin-card.dim').count() === 0) throw new Error('deduction focus did not highlight its evidence')
  if (await page.locator('.suspect-card img').count() < 4) throw new Error('suspect portraits are missing from the accusation')
  await page.locator('.suspect-card').nth(2).click()
  await page.locator('.motive-card').first().click()
  await page.locator('.accuse-go').click()
  if (!(await page.locator('.accuse-go').textContent()).includes('أكيد')) throw new Error('accusation is not confirmed in two steps')
  if (await page.evaluate(() => window.__ltt.session.progress.stats.wrongAccusations) !== 0) throw new Error('first accusation click submitted the accusation')
  await page.locator('.accuse .tray-btn').click()
  await page.locator('.deduction-head').first().click()
  const selected = page.locator('.pin-card').first()
  const before = await selected.boundingBox()
  await page.mouse.move(before.x + 30, before.y + 100)
  await page.mouse.down()
  await page.mouse.move(before.x + 54, before.y + 112, { steps: 6 })
  await page.mouse.up()
  const after = await page.locator('.pin-card').first().boundingBox()
  if (Math.abs(after.x - before.x) < 10) throw new Error('art card dragging failed')
  await page.waitForFunction(() => [...document.querySelectorAll('.pin-card-art')].every(img => img.complete && img.naturalWidth > 0))
  await page.screenshot({ path: `${out}/red-thread-photo-board.png` })
  await page.locator('.cf-tab').filter({ hasText: 'الأدلة' }).click()
  await page.locator('.ev-trigger').filter({ hasText: 'خيط أحمر على الباب' }).click()
  await page.waitForFunction(() => document.querySelector('.ev-record:not([hidden]) .ev-artwork img')?.complete)
  await page.locator('.ev-record:not([hidden]) .ev-artwork').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${out}/evidence-closeup.png` })
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const mobile = await phone.newPage()
  await mobile.goto(`http://127.0.0.1:${port}/?autostart=story`)
  await mobile.waitForFunction(() => window.__ltt?.session && document.querySelector('.inv-scene-photo')?.complete)
  await mobile.evaluate(() => {
    const { session, investigation } = window.__ltt
    session.engine.apply([{ type: 'flag', id: 'machine_hint' }])
    investigation.refresh()
  })
  await mobile.waitForSelector('.inv-scene-pin')
  const touchPinLabelOpacity = Number(await mobile.locator('.inv-scene-pin').first().evaluate(pin => getComputedStyle(pin, '::after').opacity))
  if (touchPinLabelOpacity < .9) throw new Error('scene hotspot labels are not visible on touch screens')
  await mobile.screenshot({ path: `${out}/phone-investigation.png` })
  await phone.close()
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(`visual: PASS — 13 site images,7 distinct Abis thumbnails, key-gated interior,7 evidence arts, board keyboard/link/drag, phone; screenshots in ${out}`)
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
