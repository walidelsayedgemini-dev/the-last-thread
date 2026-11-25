import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.env.BASE ?? 'http://127.0.0.1:4184/'
const out = process.env.OUT ?? 'docs/store'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] })

async function waitGame(page) {
  await page.goto(`${base}?autostart=story`)
  await page.waitForFunction(() => window.__ltt?.session && !window.__ltt.investigation.el.hidden, null, { timeout: 60_000 })
  await page.waitForSelector('.inv-photo', { state: 'visible' })
  await page.waitForTimeout(900)
}
async function map(page) {
  await page.evaluate(() => window.__ltt.investigation.setTab('map'))
  await page.waitForTimeout(500)
}
async function caseFile(page) {
  await page.evaluate(() => window.__ltt.caseFile.show(window.__ltt.session, 'board'))
  await page.waitForSelector('.casefile:not([hidden])')
  await page.waitForTimeout(450)
}
async function solve(page) {
  await page.evaluate(() => {
    const { session } = window.__ltt
    const e = session.engine
    e.apply(['e_thread_door', 'e_survey_book', 'e_microbus_ticket', 'e_boundary_stone', 'e_library_envelope', 'e_forged_contract', 'e_qaitbay_photo', 'e_hassan_testimony', 'e_bahr_testimony'].map(id => ({ type: 'evidence', id })))
    e.apply([{ type: 'flag', id: 'found_mahmoud' }])
    session.tie('e_boundary_stone', 'e_survey_book')
    session.tie('e_library_envelope', 'e_forged_contract')
    session.tie('e_thread_door', 'e_qaitbay_photo')
    session.accuse('shawky', 'm_road')
  })
  await page.waitForFunction(() => window.__ltt.shell.screen === 'ending', null, { timeout: 15_000 })
  await page.waitForTimeout(400)
}

async function phoneShots() {
  const context = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ar-EG' })
  const title = await context.newPage()
  await title.goto(base)
  await title.waitForFunction(() => document.querySelector('.shell')?.dataset.screen === 'title', null, { timeout: 60_000 })
  await title.waitForTimeout(700)
  await title.screenshot({ path: `${out}/phone-01-title.png` })
  await title.locator('.title-action').filter({ hasText: 'الإعدادات' }).click()
  await title.waitForTimeout(300)
  await title.screenshot({ path: `${out}/phone-07-settings.png` })
  await title.close()

  const page = await context.newPage()
  await waitGame(page)
  await page.screenshot({ path: `${out}/phone-02-scene.png` })
  await page.locator('.inv-person').first().click()
  await page.waitForSelector('.dialogue:not([hidden])', { timeout: 10_000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/phone-03-dialogue.png` })
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('.dialogue')?.hidden)
  await map(page)
  await page.screenshot({ path: `${out}/phone-04-map.png` })
  await page.evaluate(() => window.__ltt.investigation.setTab('scene'))
  await page.waitForTimeout(300)
  await caseFile(page)
  await page.screenshot({ path: `${out}/phone-05-casefile.png` })
  await page.evaluate(() => window.__ltt.caseFile.close())
  await page.waitForTimeout(250)
  await page.evaluate(() => window.__ltt.pause())
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/phone-06-pause.png` })
  await page.evaluate(() => window.__ltt.resume())
  await solve(page)
  await page.screenshot({ path: `${out}/phone-08-ending.png` })
  await context.close()
}

async function tabletShots() {
  const context = await browser.newContext({ viewport: { width: 800, height: 1280 }, deviceScaleFactor: 1.35, isMobile: true, hasTouch: true, locale: 'ar-EG' })
  const page = await context.newPage()
  await waitGame(page)
  await page.screenshot({ path: `${out}/tablet-01-scene.png` })
  await map(page)
  await page.screenshot({ path: `${out}/tablet-02-map.png` })
  await context.close()
}

await phoneShots()
await tabletShots()
await browser.close()
console.log(`store shots: ${out}`)
