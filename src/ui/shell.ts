/**
 * Menu shell: title, profiles, character creation, mode selection, intro, pause, settings, ending.
 * Rendered as full-screen "case file" pages; the HUD and overlays live in their own modules.
 */
import { arabicDigits } from '../core/clock'
import { CASE_01 } from '../data/case01'
import { CHARACTERS } from '../data/characters'
import { endingLines } from '../data/endings'
import { PATHS, dominantPath } from '../data/life'
import type { GameMode } from '../data/types'
import type { Audio } from '../engine/audio'
import type { Settings, SettingsStore } from '../engine/save'
import { ACHIEVEMENTS, getAchievement } from '../game/achievements'
import type { Session } from '../game/session'
import { HOMES, MAX_PROFILES, type Avatar, type ProfileService } from '../services/profiles'
import { cinematicUrl, playerPortrait, portraitUrl, titleArt } from './art'
import { h, setChildren, svg } from './dom'
import { CHARACTER_ART, SCENE_ART } from './visualAssets'

export type ScreenId = 'boot' | 'title' | 'profiles' | 'create' | 'mode' | 'intro' | 'pause' | 'settings' | 'achievements' | 'ending' | 'none'

export type ShellActions = {
  help: () => void
  /** Start playing an existing profile. */
  play(profileId: string): void
  /** Create a profile and start its intro. */
  create(avatar: Partial<Avatar>, mode: GameMode): void
  resume(): void
  quit(): void
  casefile(): void
  settings(patch: Partial<Settings>): void
  /** Finish the intro and enter the world. */
  startWorld(): void
  /** Open the next case for the current profile (shown on the ending screen). */
  nextCase(): void
  /** Reset the active profile's onboarding and show it again when possible. */
  replayTutorial(): void
  memoryCampaign(): void
}

const ACCENTS = ['#b3121f', '#d9a441', '#3b7ea1', '#5b8c5a', '#8a5aa8', '#e2e2e2']

export class Shell {
  readonly el: HTMLElement
  screen: ScreenId = 'boot'
  private back?: ScreenId
  private readonly bootBar = h('i')
  private draft: { avatar: Partial<Avatar> } = { avatar: { kind: 'yassin', gender: 'male', accent: ACCENTS[0], home: HOMES[0], name: 'ياسين' } }
  private typer?: { el: HTMLElement; full: string; at: number; done: () => void }
  private revealIntro?: () => void
  private introTimer?: number

  constructor(
    private readonly s: { settings: SettingsStore; profiles: ProfileService; audio: Audio },
    private readonly act: ShellActions,
  ) {
    this.el = h('div', { class: 'shell' })
    this.go('boot')
  }

  setBootProgress(p: number): void {
    this.bootBar.style.width = `${Math.round(p * 100)}%`
  }

  /** Typewriter tick (called every frame). */
  frame(dt: number): void {
    const t = this.typer
    if (!t) return
    t.at += dt * 42
    t.el.textContent = t.full.slice(0, Math.floor(t.at))
    if (t.at >= t.full.length) {
      this.typer = undefined
      t.done()
    }
  }

  go(screen: ScreenId, back?: ScreenId): void {
    this.screen = screen
    this.back = back
    this.typer = undefined
    this.revealIntro = undefined
    window.clearTimeout(this.introTimer)
    this.el.hidden = screen === 'none'
    this.el.dataset.screen = screen
    const page = {
      boot: () => this.boot(), title: () => this.title(), profiles: () => this.profiles(), create: () => this.create(), mode: () => this.mode(),
      intro: () => h('div'), pause: () => this.pause(), settings: () => this.settingsPage(), achievements: () => this.achievements(), ending: () => h('div'), none: () => h('div'),
    }[screen]()
    setChildren(this.el, page)
    if (screen !== 'boot' && screen !== 'none') this.s.audio.play('ui')
  }

  /** Escape key inside menus. Returns true if handled. */
  key(e: KeyboardEvent): boolean {
    if (this.screen === 'none' || this.screen === 'boot') return false
    if (e.code === 'Escape') {
      if (this.screen === 'pause') this.act.resume()
      else if (this.back) this.go(this.back)
      return true
    }
    if (this.revealIntro && ['Space', 'Enter', 'KeyE'].includes(e.code) && !(e.target instanceof HTMLButtonElement)) {
      this.revealIntro()
      return true
    }
    return false
  }

  // ---- Screens -----------------------------------------------------------------------------------------------

  private boot(): HTMLElement {
    return h('section', { class: 'page boot' },
      this.logo(), h('p', { class: 'boot-line' }, 'جارٍ فتح ملف القضية…'), h('div', { class: 'bar' }, this.bootBar))
  }

  private logo(): HTMLElement {
    return h('div', { class: 'logo' },
      h('small', null, 'لعبة تحقيق • أبيس والإسكندرية'),
      h('h1', null, 'الخيط ', h('span', null, 'الأخير')),
      this.threadArt())
  }

  /** Animated red thread tied in a knot under the title. */
  private threadArt(): SVGElement {
    const el = svg('svg', { class: 'thread-art', viewBox: '0 0 300 30', 'aria-hidden': 'true' })
    el.append(svg('path', { d: 'M0 18 C40 4 70 28 110 15 S150 2 150 15 S120 28 150 22 S200 6 230 16 S280 26 300 12', class: 'art-line' }))
    return el
  }

  private title(): HTMLElement {
    const has = this.s.profiles.list().length > 0
    const action = (label: string, hint: string, number: string, primary: boolean, onclick: () => void) =>
      h('button', { class: `title-action${primary ? ' is-primary' : ''}`, onclick },
        h('span', { class: 'title-action-number', 'aria-hidden': true }, number),
        h('span', { class: 'title-action-copy' }, h('b', null, label), h('small', null, hint)),
        h('span', { class: 'title-action-arrow', 'aria-hidden': true }, '←'))
    const slides = (['qaitbay', 'bibliotheca', 'corniche', 'canal_bridge'] as const).map((id, i) =>
      h('img', { class: 'title-slide', style: { animationDelay: `${i * 7}s` }, src: SCENE_ART[id]?.mobileSrc ?? SCENE_ART[id]?.src ?? '', alt: '', decoding: 'async', draggable: 'false' }))
    return h('section', { class: 'page title' },
      h('div', { class: 'title-backdrop', 'aria-hidden': true }, slides, h('i', { class: 'title-thread' })),
      h('div', { class: 'title-atmosphere', 'aria-hidden': true },
        titleArt() && h('img', { class: 'title-bg', src: titleArt(), alt: '', draggable: 'false' }),
        h('div', { class: 'title-glow' }),
        h('div', { class: 'title-horizon' }),
        h('div', { class: 'title-wire' })),
      h('div', { class: 'title-content' },
        h('div', { class: 'title-copy' },
          h('p', { class: 'title-kicker' }, h('span', { class: 'title-live' }), 'آخر اتصال • منذ ٣ أيام'),
          this.logo(),
          h('p', { class: 'tagline' }, CASE_01.tagline),
          h('div', { class: 'title-location' },
            h('span', { class: 'title-location-mark', 'aria-hidden': true }, '⌖'),
            h('span', null, 'أبيس / عزبة ١٥'),
            h('span', { class: 'title-location-rule' }))),
        h('nav', { class: 'title-menu', 'aria-label': 'القائمة الرئيسية' },
          h('p', { class: 'title-menu-heading' }, 'ابدأ التحقيق'),
          h('div', { class: 'menu' },
            has && action('كمّل التحقيق', 'افتح ملف الحفظ وشوف آخر دليل', '٠١', true, () => this.go('profiles', 'title')),
            action('تحقيق جديد', 'ابدأ قضية من أول الخيط', has ? '٠٢' : '٠١', !has, () => this.startCreate()),
            action('أرشيف ياسين', 'القرى والشهود ووقائع الماضي', '◈', false, () => this.act.memoryCampaign()),
            action('الإنجازات', 'شوف الخيوط اللي فتحتها', has ? '٠٣' : '٠٢', false, () => this.go('achievements', 'title')),
            action('الإعدادات', 'الصوت وحجم الخط والتباين', has ? '٠٤' : '٠٣', false, () => this.go('settings', 'title'))))),
      h('footer', null,
        h('span', null, 'لعبة تحقيق بأجواء نوار'),
        h('span', { class: 'title-footer-divider', 'aria-hidden': true }, '•'),
        h('span', null, 'إسكندرية وأبيس')))
  }

  private startCreate(): void {
    if (!this.s.profiles.canCreate) {
      this.go('profiles', 'title')
      return
    }
    this.go('create', 'title')
  }

  private profiles(): HTMLElement {
    const list = this.s.profiles.list()
    const when = (t: number) => new Date(t).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })
    return h('section', { class: 'page' },
      h('h2', null, 'ملفات التحقيق'),
      h('div', { class: 'slots' }, list.map(p => h('article', { class: 'slot' },
        h('div', null, h('b', null, p.name), h('small', null, `${p.mode === 'realistic' ? 'واقعي' : 'قصة'} • ${arabicDigits(p.evidence)} دليل • ${when(p.updatedAt)}`), p.solved && h('em', null, 'قضية مغلقة')),
        h('div', { class: 'slot-btns' },
          h('button', { class: 'btn primary', onclick: () => this.act.play(p.id) }, 'تابع'),
          h('button', { class: 'btn ghost', onclick: () => this.exportProfile(p.id), title: 'تصدير نسخة احتياطية' }, '⬇'),
          h('button', { class: 'btn ghost danger', onclick: () => { if (confirm(`مسح ملف ${p.name}؟`)) { this.s.profiles.delete(p.id); this.go('profiles', this.back) } } }, '🗑'))))),
      list.length < MAX_PROFILES && h('button', { class: 'btn', onclick: () => this.go('create', 'profiles') }, '+ تحقيق جديد'),
      h('label', { class: 'btn ghost import' }, 'استيراد نسخة', h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: (e: Event) => void this.importFile(e) })),
      h('button', { class: 'btn ghost back', onclick: () => this.go('title') }, 'رجوع'))
  }

  private exportProfile(id: string): void {
    const json = this.s.profiles.exportProfile(id)
    if (!json) return
    const a = h('a', { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: 'al-khayt-al-akheer-save.json' })
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  private async importFile(e: Event): Promise<void> {
    const f = (e.target as HTMLInputElement).files?.[0]
    if (!f) return
    try {
      this.s.profiles.importProfile(await f.text())
      this.go('profiles', this.back)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  private create(): HTMLElement {
    const a = this.draft.avatar
    const name = h('input', { type: 'text', maxlength: 18, value: a.name ?? 'ياسين', 'aria-label': 'اسم الشخصية', oninput: (e: Event) => { a.name = (e.target as HTMLInputElement).value } })
    const custom = a.kind === 'custom'
    const yassin = CHARACTERS.yassin
    return h('section', { class: 'page create' },
      h('h2', null, 'اختار شخصيتك'),
      h('div', { class: 'cards' },
        h('button', { class: `card${!custom ? ' on' : ''}`, onclick: () => { a.kind = 'yassin'; a.name = 'ياسين'; a.gender = 'male'; this.go('create', this.back) } },
          h('div', { class: 'portrait has-img', style: { '--body': yassin.figure.body, '--accent': yassin.figure.accent } },
            h('img', { class: 'character-portrait-image', src: CHARACTER_ART.yassin?.src ?? portraitUrl('yassin'), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' })),
          h('b', null, 'ياسين'), h('small', null, `${yassin.role} • ${yassin.home}`), h('p', null, yassin.appearance), h('blockquote', null, yassin.quote)),
        h('button', { class: `card${custom ? ' on' : ''}`, onclick: () => { a.kind = 'custom'; a.name = ''; this.go('create', this.back) } },
          h('div', { class: 'portrait has-img', style: { '--body': '#222', '--accent': a.accent ?? ACCENTS[0] } }, custom ? h('img', { src: playerPortrait(a), alt: '' }) : h('span', null, '؟')),
          h('b', null, 'شخصية خاصة'), h('small', null, 'اسم ومظهر ومكان سكن من اختيارك'), h('p', null, 'محقّق جديد في أبيس… الماضي بتاعه بيتكتب مع كل خطوة.'))),
      custom && h('div', { class: 'form' },
        h('label', null, 'الاسم', name),
        h('div', { class: 'row' }, h('span', null, 'النوع'),
          (['male', 'female'] as const).map(g => h('button', { class: `chip${a.gender === g ? ' on' : ''}`, onclick: () => { a.gender = g; this.go('create', this.back) } }, g === 'male' ? 'ذكر' : 'أنثى'))),
        h('div', { class: 'row' }, h('span', null, 'لون مميّز'),
          ACCENTS.map(c => h('button', { class: `swatch${a.accent === c ? ' on' : ''}`, style: { background: c }, 'aria-label': c, onclick: () => { a.accent = c; this.go('create', this.back) } }))),
        h('label', null, 'سكنك',
          h('select', { onchange: (e: Event) => { a.home = (e.target as HTMLSelectElement).value } }, HOMES.map(x => h('option', { value: x, selected: a.home === x }, x))))),
            h('div', { class: 'row end' },
        h('button', { class: 'btn ghost', onclick: () => this.go(this.s.profiles.list().length ? 'profiles' : 'title') }, 'رجوع'),
        h('button', { class: 'btn primary', onclick: () => { if (custom && !(a.name ?? '').trim()) { name.focus(); return } this.go('mode', 'create') } }, 'التالي')))
  }

  private mode(): HTMLElement {
    const pick = (mode: GameMode) => this.act.create(this.draft.avatar, mode)
    return h('section', { class: 'page mode' },
      h('h2', null, 'اختار طريقة اللعب'),
      h('div', { class: 'cards' },
        h('button', { class: 'card', onclick: () => pick('story') },
          h('b', null, 'وضع القصة'), h('small', null, 'العب في أي وقت'),
          h('p', null, 'الساعة جوه اللعبة بتتحرك مع التحقيق.')),
        h('button', { class: 'card', onclick: () => pick('realistic') },
          h('b', null, 'الوضع الواقعي'), h('small', null, 'توقيت القاهرة بيفتح أدلة إضافية'),
          h('p', null, 'الأدلة الأساسية متاحة دايمًا. مواعيد الماتشات في تقويم ملف القضية.'))),
      h('button', { class: 'btn ghost back', onclick: () => this.go('create', 'profiles') }, 'رجوع'))
  }

  /** Let players read at their own pace before entering the investigation. */
  showIntro(session: Session): void {
    this.screen = 'intro'
    this.el.hidden = false
    this.el.dataset.screen = 'intro'
    const file = session.caseFile
    const lines = file.intro.map(l => session.fill(l))
    const body = h('div', { class: 'intro-lines' })
    const introImageId = (index: number) => file.id === 'case01'
      ? ['case01-phone-call', 'case01-red-thread-door', 'case01-microbus-dawn'][Math.min(index, 2)]
      : `${file.id}-intro`
    const visual = h('div', { class: 'intro-visual', 'aria-hidden': true }, h('img', { src: cinematicUrl(introImageId(0)) ?? '', alt: '', decoding: 'async' }))
    const start = h('button', { class: 'btn primary', hidden: true, onclick: () => this.act.startWorld() }, 'ابدأ التحقيق ◂')
    const reveal = h('button', { class: 'btn ghost', onclick: () => {
      this.revealIntro?.()
      start.focus()
    } }, 'اعرض النص كله')
    const finish = () => {
      this.revealIntro = undefined
      reveal.hidden = true
      start.hidden = false
    }
    setChildren(this.el, h('section', { class: 'page intro' },
      visual, h('div', { class: 'intro-copy' }, h('div', { class: 'stamp' }, `ملف رقم ${file.number}`), h('h2', null, file.title), body, reveal, start)))
    const updateArt = (index: number) => {
      const art = cinematicUrl(introImageId(index))
      if (art) visual.querySelector('img')!.src = art
    }
    this.revealIntro = () => {
      window.clearTimeout(this.introTimer)
      this.typer = undefined
      setChildren(body, lines.map(line => h('p', null, line)))
      updateArt(lines.length - 1)
      finish()
    }
    if (this.s.settings.data.reducedMotion) {
      this.revealIntro()
      return
    }
    let i = 0
    const next = () => {
      if (i >= lines.length) {
        finish()
        return
      }
      updateArt(i)
      const p = h('p')
      body.append(p)
      this.s.audio.play('paper')
      this.typer = { el: p, full: lines[i++], at: 0, done: () => { this.introTimer = window.setTimeout(next, 450) } }
    }
    next()
  }

  showEnding(session: Session): void {
    this.screen = 'ending'
    this.el.hidden = false
    this.el.dataset.screen = 'ending'
    const file = session.caseFile
    const report = session.gradeReport()
    const st = session.progress.stats
    const found = session.state.evidence.size
    const next = session.nextCaseId()
    const stars = h('div', { class: 'stars', 'aria-label': `${report.stars} من ٥ نجوم` },
      [1, 2, 3, 4, 5].map(i => h('span', { class: i <= report.stars ? 'on' : '', style: { '--d': `${i * 0.12}s` } }, '★')))
    const missed = report.missed.map(id => file.evidence.find(e => e.id === id)).filter(e => e !== undefined)
    const archiveEpilogue = file.id === 'case01' && (
      session.state.flags.has('amna_credit') ? 'منى أضافت اسم آمنة للملخص. ولأول مرة، النسخة اللي حمت الأرض رجع عليها اسم صاحبتها.'
        : session.state.flags.has('amna_private') ? 'بعد ما الملف اتقفل، قريت جواب آمنة مع ستّك مهدية. سابتك تكمّل القراءة على صوت ماكينة الخياطة.'
          : undefined)
    const epilogue = [...endingLines(file.id, report.grade, file.finale.ending)]
    if (archiveEpilogue) epilogue.push(archiveEpilogue)
    const endingArt = cinematicUrl(`${file.id}-ending`)
    const unlocked = session.progress.achievements.map(id => getAchievement(id)).filter((a): a is NonNullable<typeof a> => Boolean(a))
    setChildren(this.el, h('section', { class: 'page ending' },
      h('div', { class: 'stamp solved' }, 'القضية اتقفلت'),
      h('small', { class: 'ending-case' }, `القضية ${file.number}`),
      h('h2', null, file.title),
      endingArt && h('div', { class: 'ending-visual' }, h('img', { src: endingArt, alt: '', loading: 'eager', decoding: 'async' })),
      h('div', { class: 'epilogue' }, h('small', null, 'خاتمة على مقاس الخيط'), epilogue.map(l => h('p', { class: 'end-line' }, session.fill(l)))),
      h('div', { class: 'grade-card' },
        h('div', { class: 'grade-head' }, h('small', null, 'تقديرك'), h('b', { class: 'grade-word' }, report.grade), stars),
        h('ul', { class: 'breakdown' }, report.breakdown.map(b =>
          h('li', { class: b.delta < 0 ? 'minus' : 'plus' }, h('span', null, b.label), h('b', null, `${b.delta > 0 ? '+' : b.delta < 0 ? '−' : ''}${arabicDigits(Math.abs(b.delta))}`))))),
      h('div', { class: 'report' },
        h('div', null, h('small', null, 'طريقك'), h('b', { class: 'path-name' }, dominantPath(session.state.flags) ? PATHS[dominantPath(session.state.flags)!].short : 'لسه')),
        h('div', null, h('small', null, 'الأدلة'), h('b', null, `${arabicDigits(found)} من ${arabicDigits(file.evidence.length)}`)),
        h('div', null, h('small', null, 'صور'), h('b', null, arabicDigits(st.photos))),
        h('div', null, h('small', null, 'تلميحات'), h('b', null, arabicDigits(st.hints))),
        h('div', null, h('small', null, 'اتهامات غلط'), h('b', null, arabicDigits(st.wrongAccusations)))),
      unlocked.length > 0 && h('section', { class: 'ending-achievements' },
        h('h3', null, 'إنجازات اتفتحت'),
        h('div', { class: 'achievement-strip' }, unlocked.map(a => h('article', { class: 'achievement-card' }, h('b', null, a.icon), h('span', null, a.title))))),
      missed.length > 0 && h('details', { class: 'missed' },
        h('summary', null, `فاتك ${arabicDigits(missed.length)} دليل`),
        h('ul', null, missed.map(e => h('li', null, h('b', null, e.title), h('small', null, ` • ${e.source}`)))),
        h('p', { class: 'note' }, 'بعض الأدلة الإضافية بتظهر بس في الوضع الواقعي في مواعيد معيّنة.')),
      h('div', { class: 'row end' },
        h('button', { class: 'btn', onclick: () => this.act.memoryCampaign() }, 'افتح أرشيف ياسين'),
        h('button', { class: 'btn ghost', onclick: () => this.act.resume() }, 'ارجع للتحقيق'),
        h('button', { class: `btn${next ? '' : ' primary'}`, onclick: () => this.act.quit() }, 'القائمة الرئيسية'),
        next && h('button', { class: 'btn primary', onclick: () => this.act.nextCase() }, 'ابدأ القضية التانية'))))
  }

  private pause(): HTMLElement {
    return h('section', { class: 'page pause' },
      h('h2', null, 'التحقيق متوقف'),
      h('div', { class: 'menu' },
        h('button', { class: 'btn primary', onclick: () => this.act.resume() }, 'كمّل'),
        h('button', { class: 'btn', onclick: () => this.act.memoryCampaign() }, 'أرشيف ياسين'),
        h('button', { class: 'btn', onclick: () => this.act.casefile() }, 'ملف القضية'),
        h('button', { class: 'btn', onclick: () => this.act.help() }, 'إزاي ألعب؟'),
        h('button', { class: 'btn', onclick: () => this.go('achievements', 'pause') }, 'الإنجازات'),
        h('button', { class: 'btn', onclick: () => this.go('settings', 'pause') }, 'الإعدادات'),
        h('button', { class: 'btn ghost', onclick: () => this.act.quit() }, 'حفظ والخروج')),
      h('p', { class: 'controls' }, 'اضغط على العلامات اللي على الصورة أو على الشخص اللي عاوز تكلّمه. من الخريطة اتنقّل بين أماكن المنطقة، والميكروباص بيوصّل أبيس بإسكندرية. ملف القضية: F • الخريطة: M • تلميح: H • القائمة: Esc'))
  }

  private settingsPage(): HTMLElement {
    const d = this.s.settings.data
    const slider = (label: string, key: 'musicVolume' | 'ambientVolume' | 'sfxVolume' | 'voiceVolume', min: number, max: number, step: number) =>
      h('label', { class: 'set' }, label, h('input', { type: 'range', min, max, step, value: d[key], oninput: (e: Event) => this.act.settings({ [key]: Number((e.target as HTMLInputElement).value) }) }))
    const sizes: [Settings['textSize'], string][] = [['normal', 'عادي'], ['large', 'كبير'], ['xlarge', 'كبير جدًا']]
    const textSize = h('div', { class: 'set size-set', role: 'radiogroup', 'aria-label': 'حجم الخط' },
      h('span', null, 'حجم الخط'),
      h('div', { class: 'size-options' }, sizes.map(([id, label]) =>
        h('button', { class: `size-opt${d.textSize === id ? ' on' : ''}`, role: 'radio', 'aria-checked': String(d.textSize === id), 'data-size': id,
          onclick: () => { this.act.settings({ textSize: id }); this.go('settings', this.back) } }, h('b', null, 'أ'), label))))
    const check = (label: string, key: 'muted' | 'voiceEnabled' | 'reducedMotion' | 'clearFont' | 'simpleMode' | 'highContrast' | 'crashReportsEnabled') =>
      h('label', { class: 'set row' }, h('input', { type: 'checkbox', checked: d[key], onchange: (e: Event) => this.act.settings({ [key]: (e.target as HTMLInputElement).checked }) }), label)
    const url = (label: string, key: 'hintEndpoint' | 'eventsUrl', ph: string) =>
      h('label', { class: 'set' }, label, h('input', { type: 'url', dir: 'ltr', placeholder: ph, value: d[key], onchange: (e: Event) => this.act.settings({ [key]: (e.target as HTMLInputElement).value }) }))
    return h('section', { class: 'page settings' },
      h('h2', null, 'الإعدادات'),
      h('div', { class: 'grid' },
        slider('صوت المزيكا', 'musicVolume', 0, 1, 0.05), slider('صوت الأجواء', 'ambientVolume', 0, 1, 0.05),
        slider('صوت المؤثرات', 'sfxVolume', 0, 1, 0.05), slider('صوت الحوار', 'voiceVolume', 0, 1, 0.05),
        check('الصوت المنطوق', 'voiceEnabled'), check('كتم الصوت', 'muted'), check('تقليل الحركة', 'reducedMotion'),
        check('خط واضح للعناوين (أسهل في القراءة)', 'clearFont'), check('وضع مبسّط لكل الأعمار (تبويبات أقل وأزرار أكبر)', 'simpleMode'),
        check('تباين عالي (أوضح في الشمس)', 'highContrast'), check('مشاركة تقارير الأعطال (اختياري)', 'crashReportsEnabled'),
        textSize),
      h('div', { class: 'settings-tutorial' },
        h('b', null, 'شرح البداية'), h('p', { class: 'note' }, 'عايز تفتكر خطوات التحقيق؟ شغّل العلامات الإرشادية تاني.'),
        h('button', { class: 'btn ghost', onclick: this.act.replayTutorial }, 'اعرض الشرح تاني')),
      h('details', null, h('summary', null, 'الخدمات المتقدمة (اختياري)'),
        h('p', { class: 'note' }, 'روابط اختيارية. من غيرها تفضل القصة والتلميحات المحلية شغّالة أوفلاين.'),
        url('رابط التلميحات الذكية (ChatGPT)', 'hintEndpoint', 'https://your-proxy.example/hint'),
        url('رابط قاعدة الأحداث الواقعية', 'eventsUrl', 'https://your-host.example/events.json')),
      h('button', { class: 'btn ghost back', onclick: () => this.go(this.back ?? 'title') }, 'رجوع'))
  }

  private achievements(): HTMLElement {
    const unlocked = new Set(this.s.profiles.allAchievementIds())
    return h('section', { class: 'page achievements-page' },
      h('div', { class: 'stamp' }, 'ملف الإنجازات'),
      h('h2', null, 'الخيوط اللي فتحتها'),
      h('p', { class: 'note' }, `${arabicDigits(unlocked.size)} من ${arabicDigits(ACHIEVEMENTS.length)} إنجاز`),
      h('div', { class: 'achievement-grid' }, ACHIEVEMENTS.map(a =>
        h('article', { class: `achievement-card${unlocked.has(a.id) ? ' unlocked' : ' locked'}` },
          h('b', { class: 'achievement-icon', 'aria-hidden': true }, unlocked.has(a.id) ? a.icon : '؟'),
          h('div', null, h('h3', null, unlocked.has(a.id) ? a.title : 'إنجاز مقفول'), h('p', null, a.description))))),
      h('button', { class: 'btn ghost back', onclick: () => this.go(this.back ?? 'title') }, 'رجوع'))
  }
}
