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
    await page.keyboard.press('Escape')
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
  for (const caseId of ['case01', 'case02']) {
    const page = await ctx.newPage(); watch(page)
    await page.goto(BASE + '?autostart=story')
    await page.waitForFunction(() => window.__ltt?.session && !window.__ltt.investigation.el.hidden, null, { timeout: 60000 })
    if (caseId === 'case02') {
      await page.evaluate(() => { window.__ltt.session.startCase('case02'); window.__ltt.investigation.render?.() })
    }
    await page.waitForTimeout(1500)
    const places = await page.evaluate(() => Object.keys(window.__PLACES ?? {}))
    const ids = places.length ? places : await page.evaluate(() => [...document.querySelectorAll('.inv-map-card, [data-place]')].map(e => e.dataset.place).filter(Boolean))
    // Visit places through the investigation API (both districts).
    const all = await page.evaluate(() => window.__ltt.places ?? null)
    const placeIds = all ?? ['zeinab_home', 'cafe_ragab', 'abis_mosque', 'canal_bridge', 'plot15', 'abis_stop', 'mahmoud_house', 'raml_stop', 'mansheya', 'bibliotheca', 'pompey', 'qaitbay', 'corniche']
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
    const everyone = caseId === 'case01' ? ['zeinab', 'mahmoud', 'ragab', 'hassan', 'shawky', 'bahr', 'fathy'] : ['salma', 'nabil', 'adham', 'zeinab']
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
    await page.close()
  }
  await ctx.close()
}
await browser.close()
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1))
const byKind = {}
for (const r of report) (byKind[r.kind] ??= []).push(`${r.vp}/${r.where}: ${r.detail}`)
for (const [k, v] of Object.entries(byKind)) { console.log(`\n## ${k} (${v.length})`); for (const l of [...new Set(v)].slice(0, 60)) console.log('  ' + l) }
