// QA tour: visits every screen/place/tab at several viewports, records console errors and layout problems.
// Usage: node scripts/qa-tour.mjs <outDir>   (needs `pnpm preview` on :4173)
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const out = process.argv[2] ?? '/home/ubuntu/qa'
mkdirSync(out, { recursive: true })
const BASE = process.env.BASE ?? 'http://127.0.0.1:4173/'
const VIEWPORTS = (process.env.VP ?? 'desk:1280x800,phone:390x844,small:1024x600,land:844x390').split(',').map(s => {
  const [name, wh] = s.split(':'); const [w, h] = wh.split('x').map(Number); return { name, w, h }
})
const report = []
const note = (vp, where, kind, detail) => report.push({ vp, where, kind, detail })

// Layout probe executed in the page: elements spilling out of the viewport, clipped text, tiny tap targets,
// and overlaps between the important floating widgets.
const probe = () => {
  const vw = innerWidth, vh = innerHeight
  const issues = []
  const visible = el => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false
    const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2
  }
  const label = el => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}${el.textContent ? ` «${el.textContent.trim().slice(0, 30)}»` : ''}`
  const clippedByAncestor = el => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p)
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX + cs.overflowY) && p !== document.body && p !== document.documentElement) return p
    }
    return null
  }
  const all = [...document.querySelectorAll('#ui *')].filter(el => !el.closest('[hidden]') && visible(el))
  for (const el of all) {
    const r = el.getBoundingClientRect()
    const anc = clippedByAncestor(el)
    if (!anc && (r.right > vw + 2 || r.left < -2) && getComputedStyle(el).position !== 'fixed') issues.push(['offscreen-x', label(el), Math.round(r.left), Math.round(r.right)])
    // interactive things must be reachable
    if (el.matches('button, a, [role=button], input, select')) {
      if (r.right > vw + 1 || r.left < -1 || r.bottom > vh + 1 || r.top < -1) {
        if (!anc || (() => { const a = anc.getBoundingClientRect(); return r.right > a.right + 1 && getComputedStyle(anc).overflowX !== 'auto' })()) issues.push(['button-outside', label(el), Math.round(r.left), Math.round(r.top)])
      }
      if ((r.width < 32 || r.height < 28) && !el.closest('.cf-tabs')) issues.push(['small-target', label(el), Math.round(r.width), Math.round(r.height)])
    }
    // text clipped inside a box with overflow hidden (and no ellipsis)
    const cs = getComputedStyle(el)
    if (el.children.length === 0 && el.textContent.trim() && cs.overflow === 'hidden' && cs.textOverflow !== 'ellipsis' && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 3)) issues.push(['text-clipped', label(el), el.scrollWidth, el.clientWidth])
    // Latin digits in visible Arabic text
    if (el.children.length === 0 && /[0-9]/.test(el.textContent) && /[\u0600-\u06ff]/.test(el.textContent) && !el.closest('kbd, input, .lat')) issues.push(['latin-digits', label(el)])
  }
  // overlaps among floating widgets
  const floating = ['.inv-guide', '.inv-people', '.narration', '.hint-bubble', '.toasts .toast', '.inv-drawer-toggle', '.inv-mobile-nav', '.inv-chips', '.inv-quiet']
  const boxes = floating.flatMap(sel => [...document.querySelectorAll(sel)].filter(el => !el.closest('[hidden]') && visible(el)).map(el => [sel, el.getBoundingClientRect()]))
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, ra] = boxes[i], [b, rb] = boxes[j]
    const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
    if (ox > 6 && oy > 6 && a !== b) issues.push(['overlap', `${a} × ${b}`, Math.round(ox), Math.round(oy)])
  }
  // pins overlapping each other (labels unreadable)
  const pins = [...document.querySelectorAll('.inv-pin')].filter(visible).map(el => [el.textContent.trim().slice(0, 20), el.getBoundingClientRect()])
  for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) {
    const [a, ra] = pins[i], [b, rb] = pins[j]
    const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
    if (ox > 8 && oy > 8) issues.push(['pin-overlap', `${a} × ${b}`])
  }
  // pins hidden under the drawer / guide / people
  for (const [name, r] of pins) {
    for (const [sel, rb] of boxes) {
      const ox = Math.min(r.right, rb.right) - Math.max(r.left, rb.left), oy = Math.min(r.bottom, rb.bottom) - Math.max(r.top, rb.top)
      if (ox > 10 && oy > 10) issues.push(['pin-covered', `${name} under ${sel}`])
    }
    if (r.right > vw || r.left < 0 || r.bottom > vh || r.top < 0) issues.push(['pin-offscreen', name])
  }
  const dr = document.querySelector('.inv-drawer')
  if (dr && visible(dr)) {
    const d = dr.getBoundingClientRect()
    for (const [name, r] of pins) if (Math.min(r.right, d.right) - Math.max(r.left, d.left) > 10 && Math.min(r.bottom, d.bottom) - Math.max(r.top, d.top) > 10) issues.push(['pin-under-drawer', name])
    for (const p of document.querySelectorAll('.inv-person')) { const r = p.getBoundingClientRect(); if (Math.min(r.right, d.right) - Math.max(r.left, d.left) > 10 && Math.min(r.bottom, d.bottom) - Math.max(r.top, d.top) > 10) issues.push(['person-under-drawer', p.textContent.trim().slice(0, 20)]) }
  }
  // village/city map labels colliding with each other
  const labels = [...document.querySelectorAll('.inv-map-svg .pin-label')].filter(visible).map(el => [el.textContent.trim(), el.getBoundingClientRect()])
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
    const [a, ra] = labels[i], [b, rb] = labels[j]
    const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
    if (ox > 2 && oy > 2) issues.push(['map-label-overlap', `${a} × ${b}`])
  }
  // any two visible leaf texts painted on top of each other (the classic "things overlapping" bug)
  const textBox = el => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect() }
  const texts = all.filter(el => el.children.length === 0 && el.textContent.trim() && !el.closest('svg, .inv-pin, .toasts, kbd, .inv-badge, details:not([open]) > :not(summary)') && getComputedStyle(el).position !== 'absolute')
    .map(el => [el, textBox(el)]).filter(([, r]) => r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw)
    // keep only texts that are actually on top at their own centre (drops everything under an open modal/sheet)
    .filter(([el, r]) => { const t = document.elementFromPoint(Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), Math.min(vh - 1, Math.max(0, r.top + r.height / 2))); return !!t && (el.contains(t) || t.contains(el)) })
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const [a, ra] = texts[i], [b, rb] = texts[j]
    if (a.contains(b) || b.contains(a)) continue
    const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
    if (ox > 6 && oy > 6) {
      // only count it when both are actually painted there (not one scrolled away under a sticky header)
      const cx = Math.max(ra.left, rb.left) + ox / 2, cy = Math.max(ra.top, rb.top) + oy / 2
      const top = document.elementFromPoint(cx, cy)
      if (top && (a.contains(top) || b.contains(top) || top.contains(a) || top.contains(b))) issues.push(['text-overlap', `${label(a)} × ${label(b)}`, Math.round(ox), Math.round(oy)])
    }
  }
  if (document.documentElement.scrollWidth > vw + 1) issues.push(['page-hscroll', document.documentElement.scrollWidth])
  return issues
}

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] })
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ar-EG', hasTouch: vp.name !== 'desk' && vp.name !== 'small', isMobile: vp.name === 'phone' || vp.name === 'land' })
  const shot = async (page, name) => {
    await page.waitForTimeout(250)
    const issues = await page.evaluate(probe)
    const seen = new Set()
    for (const i of issues) { const k = i.slice(0, 2).join('|'); if (!seen.has(k)) { seen.add(k); note(vp.name, name, i[0], i.slice(1).join(' ')) } }
    await page.screenshot({ path: `${out}/${vp.name}-${name}.png` })
  }
  const watch = page => {
    page.on('console', m => (m.type() === 'error' || m.type() === 'warning') && note(vp.name, 'console', m.type(), m.text().slice(0, 300)))
    page.on('pageerror', e => note(vp.name, 'pageerror', 'error', String(e.stack ?? e).slice(0, 400)))
    page.on('response', r => r.status() >= 400 && note(vp.name, 'http', String(r.status()), r.url()))
    page.on('requestfailed', request => {
      const failure = request.failure()?.errorText ?? 'unknown network error'
      if (failure !== 'net::ERR_ABORTED') note(vp.name, 'requestfailed', failure, request.url())
    })
  }
  // ---- shell screens --------------------------------------------------------------------------------------------
  {
    const page = await ctx.newPage(); watch(page)
    await page.goto(BASE)
    await page.waitForFunction(() => document.querySelector('.shell')?.dataset.screen === 'title', null, { timeout: 60000 })
    await page.waitForTimeout(800)
    await shot(page, 'title')
    for (const btn of await page.locator('.shell button').all()) { if ((await btn.textContent()).includes('الإعدادات')) { await btn.click(); break } }
    await shot(page, 'settings')
    await page.evaluate(() => document.querySelector('.shell .page')?.scrollTo?.(0, 99999)); await page.waitForTimeout(200); await shot(page, 'settings-bottom')
    await page.keyboard.press('Escape')
    await page.evaluate(() => window.__ltt?.shell.go('achievements')); await page.waitForTimeout(400); await shot(page, 'achievements')
    await page.evaluate(() => window.__ltt?.shell.go('title')); await page.waitForTimeout(400)
    await page.locator('.shell button').first().click()
    await shot(page, 'create')
    const custom = page.locator('.shell .card').nth(1)
    if (await custom.count()) { await custom.click(); await shot(page, 'create-custom') }
    const nameInput = page.locator('.shell input[type=text], .shell input:not([type])').first()
    if (await nameInput.count()) await nameInput.fill('مريم')
    await page.locator('.shell .btn.primary').last().click()
    await shot(page, 'mode')
    await page.locator('.shell .card, .shell .mode-card, .shell button').filter({ hasText: 'قصة' }).first().click().catch(() => {})
    await page.waitForTimeout(600)
    await shot(page, 'intro')
    await page.close()
  }
  // ---- investigation: every place, map, case file, dialogues, pause --------------------------------------------
  for (const caseId of (process.env.QA_CASES ?? 'case01,case02,case03').split(',')) {
    const page = await ctx.newPage(); watch(page)
    await page.goto(BASE + '?autostart=story')
    await page.waitForFunction(() => window.__ltt?.session && !window.__ltt.investigation.el.hidden, null, { timeout: 60000 })
    if (caseId === 'case01') {
      // first-run coach marks
      await page.waitForTimeout(1200)
      if (await page.evaluate(() => !!document.querySelector('.tutorial-layer:not([hidden])'))) await shot(page, 'case01-tutorial')
      await page.evaluate(() => document.querySelector('.tutorial-skip, [data-tutorial-skip]')?.click())
    } else {
      await page.evaluate(id => { window.__ltt.session.startCase(id); window.__ltt.investigation.render?.() }, caseId)
    }
    await page.waitForTimeout(1500)
    await page.evaluate(() => window.__ltt.shell.showIntro(window.__ltt.session)); await page.waitForTimeout(2500); await shot(page, `${caseId}-intro`)
    await page.evaluate(() => window.__ltt.shell.go('none')); await page.waitForTimeout(300)
    const places = await page.evaluate(() => Object.keys(window.__PLACES ?? {}))
    const ids = places.length ? places : await page.evaluate(() => [...document.querySelectorAll('.inv-map-card, [data-place]')].map(e => e.dataset.place).filter(Boolean))
    // Visit places through the investigation API (both districts).
    const all = await page.evaluate(() => window.__ltt.places ?? null)
    const placeIds = all ?? []
    if (!placeIds.length) note(vp.name, caseId, 'setup', 'window.__ltt.places missing')
    void ids
    for (const id of placeIds) {
      const ok = await page.evaluate(id => { try { window.__ltt.investigation.setPlace(id); return window.__ltt.investigation.currentPlace === id } catch (e) { return String(e) } }, id)
      if (ok !== true) { note(vp.name, `${caseId}-${id}`, 'setPlace', String(ok)); continue }
      await page.waitForTimeout(1300)
      await shot(page, `${caseId}-place-${id}`)
    }
    await page.evaluate(() => window.__ltt.investigation.setPlace('zeinab_home'))
    await page.evaluate(() => window.__ltt.investigation.setTab('map')); await page.waitForTimeout(600); await shot(page, `${caseId}-map-abis`)
    await page.evaluate(() => window.__ltt.investigation.setPlace('raml_stop')); await page.evaluate(() => window.__ltt.investigation.setTab('map')); await page.waitForTimeout(600); await shot(page, `${caseId}-map-city`)
    await page.evaluate(() => window.__ltt.investigation.setTab('scene'))
    for (const tab of ['board', 'evidence', 'people', 'objectives', 'calendar']) {
      await page.evaluate(tab => window.__ltt.caseFile.show(window.__ltt.session, tab), tab)
      await page.waitForTimeout(500)
      await shot(page, `${caseId}-cf-${tab}`)
    }
    await page.evaluate(() => window.__ltt.caseFile.close())
    const chars = await page.evaluate(() => (window.__ltt.session.knownCharacters?.() ?? []).map(c => c.id))
    const everyone = await page.evaluate(() => window.__ltt.cast?.() ?? [])
    for (const id of [...new Set([...everyone, ...chars])]) {
      await page.evaluate(id => window.__ltt.talk(id), id)
      await page.waitForTimeout(900)
      const open = await page.evaluate(() => !document.querySelector('.dialogue')?.hidden)
      if (open) {
        await shot(page, `${caseId}-dlg-${id}`)
        await page.keyboard.press('Escape'); await page.waitForTimeout(300)
        if (await page.evaluate(() => !document.querySelector('.dialogue')?.hidden)) { await page.evaluate(() => document.querySelector('.dlg-leave')?.click()); await page.waitForTimeout(300) }
      }
    }
    await page.evaluate(() => window.__ltt.pause()); await page.waitForTimeout(400); await shot(page, `${caseId}-pause`)
    await page.evaluate(() => window.__ltt.resume())
    const ended = await page.evaluate(() => { try { window.__ltt.shell.showEnding(window.__ltt.session); return true } catch (e) { return String(e) } })
    if (ended === true) { await page.waitForTimeout(1200); await shot(page, `${caseId}-ending`) } else note(vp.name, `${caseId}-ending`, 'ending', ended)
    await page.close()
  }
  await ctx.close()
}
await browser.close()
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1))
const byKind = {}
for (const r of report) (byKind[r.kind] ??= []).push(`${r.vp}/${r.where}: ${r.detail}`)
for (const [k, v] of Object.entries(byKind)) { console.log(`\n## ${k} (${v.length})`); for (const l of [...new Set(v)].slice(0, 60)) console.log('  ' + l) }
const serious = new Set(['pin-offscreen', 'button-outside', 'pageerror', 'http', 'requestfailed'])
const seriousCount = report.filter(item => serious.has(item.kind)).length
console.log(`\nqa-tour: ${report.length} total findings; ${seriousCount} serious findings`)
if (seriousCount > 0) process.exitCode = 1
