/**
 * Menu shell: title, profiles, character creation, mode selection, intro, pause, settings, ending.
 * Rendered as full-screen "case file" pages; the HUD and overlays live in their own modules.
 */
import { arabicDigits, formatDateTime } from '../core/clock'
import { CASE_01 } from '../data/case01'
import { CHARACTERS, PLAYER_MODELS } from '../data/characters'
import type { GameMode } from '../data/types'
import type { Audio } from '../engine/audio'
import type { Quality, Settings, SettingsStore } from '../engine/save'
import type { Session } from '../game/session'
import type { EventsDb } from '../services/eventsDb'
import { HOMES, MAX_PROFILES, type Avatar, type ProfileService } from '../services/profiles'
import { h, setChildren, svg } from './dom'

export type ScreenId = 'boot' | 'title' | 'profiles' | 'create' | 'mode' | 'intro' | 'pause' | 'settings' | 'ending' | 'none'

export type ShellActions = {
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
}

const ACCENTS = ['#b3121f', '#d9a441', '#3b7ea1', '#5b8c5a', '#8a5aa8', '#e2e2e2']

export class Shell {
  readonly el: HTMLElement
  screen: ScreenId = 'boot'
  private back?: ScreenId
  private readonly bootBar = h('i')
  private draft: { avatar: Partial<Avatar> } = { avatar: { kind: 'yassin', gender: 'male', accent: ACCENTS[0], home: HOMES[0], name: 'ياسين' } }
  private typer?: { el: HTMLElement; full: string; at: number; done: () => void }

  constructor(
    private readonly s: { settings: SettingsStore; profiles: ProfileService; events: EventsDb; audio: Audio; now: () => number },
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
    this.el.hidden = screen === 'none'
    this.el.dataset.screen = screen
    const page = {
      boot: () => this.boot(), title: () => this.title(), profiles: () => this.profiles(), create: () => this.create(), mode: () => this.mode(),
      intro: () => h('div'), pause: () => this.pause(), settings: () => this.settingsPage(), ending: () => h('div'), none: () => h('div'),
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
    if (this.screen === 'intro' && ['Space', 'Enter', 'KeyE'].includes(e.code)) {
      this.skipTyping()
      return true
    }
    return false
  }

  private skipTyping(): void {
    const t = this.typer
    if (!t) return
    t.at = t.full.length
  }

  // ---- Screens -----------------------------------------------------------------------------------------------

  private boot(): HTMLElement {
    return h('section', { class: 'page boot' },
      this.logo(), h('p', { class: 'boot-line' }, 'جارٍ فتح ملف القضية…'), h('div', { class: 'bar' }, this.bootBar))
  }

  private logo(): HTMLElement {
    return h('div', { class: 'logo' },
      h('small', null, 'قضية رقم ١ • الإسكندرية'),
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
    return h('section', { class: 'page title' },
      this.logo(),
      h('p', { class: 'tagline' }, CASE_01.tagline),
      h('div', { class: 'menu' },
        has && h('button', { class: 'btn primary', onclick: () => this.go('profiles', 'title') }, 'متابعة التحقيق'),
        h('button', { class: has ? 'btn' : 'btn primary', onclick: () => this.startCreate() }, 'تحقيق جديد'),
        h('button', { class: 'btn ghost', onclick: () => this.go('settings', 'title') }, 'الإعدادات')),
      h('footer', null, 'لعبة تحقيق بأجواء نوار – إسكندرية وأبيس • المرحلة ١ (Manus)'))
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
          h('div', { class: 'portrait', style: { '--body': yassin.figure.body, '--accent': yassin.figure.accent } }, h('span', null, 'ي')),
          h('b', null, 'ياسين'), h('small', null, `${yassin.role} • ${yassin.home}`), h('p', null, yassin.appearance), h('blockquote', null, yassin.quote)),
        h('button', { class: `card${custom ? ' on' : ''}`, onclick: () => { a.kind = 'custom'; a.name = ''; this.go('create', this.back) } },
          h('div', { class: 'portrait', style: { '--body': '#222', '--accent': a.accent ?? ACCENTS[0] } }, h('span', null, '؟')),
          h('b', null, 'شخصية خاصة'), h('small', null, 'اسم ومظهر ومكان سكن من اختيارك'), h('p', null, 'محقّق جديد في أبيس… الماضي بتاعه بيتكتب مع كل خطوة.'))),
      custom && h('div', { class: 'form' },
        h('label', null, 'الاسم', name),
        h('div', { class: 'row' }, h('span', null, 'النوع'),
          (['male', 'female'] as const).map(g => h('button', { class: `chip${a.gender === g ? ' on' : ''}`, onclick: () => { a.gender = g; this.go('create', this.back) } }, g === 'male' ? 'ذكر' : 'أنثى'))),
        h('div', { class: 'row' }, h('span', null, 'لون مميّز'),
          ACCENTS.map(c => h('button', { class: `swatch${a.accent === c ? ' on' : ''}`, style: { background: c }, 'aria-label': c, onclick: () => { a.accent = c; this.go('create', this.back) } }))),
        h('label', null, 'سكنك',
          h('select', { onchange: (e: Event) => { a.home = (e.target as HTMLSelectElement).value } }, HOMES.map(x => h('option', { value: x, selected: a.home === x }, x))))),
      h('p', { class: 'note' }, `الجسم: ${a.gender === 'female' ? 'أنثى' : 'ذكر'} (${PLAYER_MODELS[a.gender === 'female' ? 'female' : 'male'].heightM} م)`),
      h('div', { class: 'row end' },
        h('button', { class: 'btn ghost', onclick: () => this.go(this.s.profiles.list().length ? 'profiles' : 'title') }, 'رجوع'),
        h('button', { class: 'btn primary', onclick: () => { if (custom && !(a.name ?? '').trim()) { name.focus(); return } this.go('mode', 'create') } }, 'التالي')))
  }

  private mode(): HTMLElement {
    const now = this.s.now()
    const next = this.s.events.upcoming(now, 3, 'match_ittihad')
    const pick = (mode: GameMode) => this.act.create(this.draft.avatar, mode)
    return h('section', { class: 'page mode' },
      h('h2', null, 'اختار طريقة اللعب'),
      h('div', { class: 'cards' },
        h('button', { class: 'card', onclick: () => pick('realistic') },
          h('b', null, 'الوضع الواقعي'), h('small', null, 'بالوقت والتاريخ الحقيقي'),
          h('p', null, 'القهوة بتقفل بالليل، حارس الموقع بيمشي بعد الخامسة، وبعض الأدلة الإضافية بتظهر بس في يوم ماتش الاتحاد. الأدلة الأساسية متاحة دايماً.'),
          h('div', { class: 'clock-now' }, h('b', null, 'دلوقتي في القاهرة'), h('span', null, formatDateTime(now))),
          next.length > 0 && h('ul', { class: 'fixtures' }, next.map(o => h('li', null, `${o.event.title} – ${formatDateTime(o.start)}`, o.event.provisional && h('em', null, ' (مؤقت)'))))),
        h('button', { class: 'card', onclick: () => pick('story') },
          h('b', null, 'وضع القصة'), h('small', null, 'من غير ضغط وقت'),
          h('p', null, 'كل الأدلة والأماكن متاحة في أي وقت. الساعة جوه اللعبة بتتحرك مع التحقيق وبتغمّق الأجواء كل ما تكتشف أكتر.'))),
      h('button', { class: 'btn ghost back', onclick: () => this.go('create', 'profiles') }, 'رجوع'))
  }

  /** Typewriter intro; calls `startWorld` when finished or on click. */
  showIntro(session: Session): void {
    this.screen = 'intro'
    this.el.hidden = false
    this.el.dataset.screen = 'intro'
    const lines = CASE_01.intro.map(l => session.fill(l))
    const body = h('div', { class: 'intro-lines' })
    const skip = h('button', { class: 'btn primary', onclick: () => this.act.startWorld() }, 'ابدأ التحقيق ◂')
    skip.hidden = true
    setChildren(this.el, h('section', { class: 'page intro' },
      h('div', { class: 'stamp' }, 'ملف رقم ١'), h('h2', null, CASE_01.title), body, skip))
    let i = 0
    const next = () => {
      if (i >= lines.length) {
        skip.hidden = false
        return
      }
      const p = h('p')
      body.append(p)
      this.s.audio.play('paper')
      this.typer = { el: p, full: lines[i++], at: 0, done: () => setTimeout(next, 450) }
    }
    next()
    this.el.onclick = () => this.skipTyping()
  }

  showEnding(session: Session): void {
    this.screen = 'ending'
    this.el.hidden = false
    this.el.dataset.screen = 'ending'
    this.el.onclick = null
    const grade = session.engine.grade()
    const st = session.progress.stats
    const found = session.state.evidence.size
    setChildren(this.el, h('section', { class: 'page ending' },
      h('div', { class: 'stamp solved' }, 'القضية اتقفلت'),
      h('h2', null, CASE_01.title),
      CASE_01.finale.ending.map(l => h('p', { class: 'end-line' }, session.fill(l))),
      h('div', { class: 'report' },
        h('div', null, h('small', null, 'التقدير'), h('b', { class: `grade g${grade}` }, grade)),
        h('div', null, h('small', null, 'الأدلة'), h('b', null, `${arabicDigits(found)}/${arabicDigits(CASE_01.evidence.length)}`)),
        h('div', null, h('small', null, 'صور'), h('b', null, arabicDigits(st.photos))),
        h('div', null, h('small', null, 'تلميحات'), h('b', null, arabicDigits(st.hints))),
        h('div', null, h('small', null, 'اتهامات خاطئة'), h('b', null, arabicDigits(st.wrongAccusations)))),
      found < CASE_01.evidence.length && h('p', { class: 'note' }, 'لسه فيه أدلة إضافية ما لقيتهاش: جرّب الوضع الواقعي في مواعيد مختلفة (أيام الماتشات)، أو ارجع واكمل البحث.'),
      h('div', { class: 'row end' },
        h('button', { class: 'btn', onclick: () => this.act.resume() }, 'كمّل اللعب'),
        h('button', { class: 'btn primary', onclick: () => this.act.quit() }, 'القائمة الرئيسية'))))
  }

  private pause(): HTMLElement {
    return h('section', { class: 'page pause' },
      h('h2', null, 'التحقيق متوقف'),
      h('div', { class: 'menu' },
        h('button', { class: 'btn primary', onclick: () => this.act.resume() }, 'كمّل'),
        h('button', { class: 'btn', onclick: () => this.act.casefile() }, 'ملف القضية'),
        h('button', { class: 'btn', onclick: () => this.go('settings', 'pause') }, 'الإعدادات'),
        h('button', { class: 'btn ghost', onclick: () => this.act.quit() }, 'حفظ والخروج')),
      h('p', { class: 'controls' }, 'التحرك: WASD / الأسهم • الجري: Shift • تفاعل: E • ملف القضية: Tab • كاميرا: C • تلميح: H • زاوية الكاميرا: V • الماوس للنظر'))
  }

  private settingsPage(): HTMLElement {
    const d = this.s.settings.data
    const slider = (label: string, key: 'musicVolume' | 'sfxVolume' | 'sensitivity', min: number, max: number, step: number) =>
      h('label', { class: 'set' }, label, h('input', { type: 'range', min, max, step, value: d[key], oninput: (e: Event) => this.act.settings({ [key]: Number((e.target as HTMLInputElement).value) }) }))
    const check = (label: string, key: 'muted' | 'invertY' | 'reducedMotion') =>
      h('label', { class: 'set row' }, h('input', { type: 'checkbox', checked: d[key], onchange: (e: Event) => this.act.settings({ [key]: (e.target as HTMLInputElement).checked }) }), label)
    const url = (label: string, key: 'hintEndpoint' | 'visionEndpoint' | 'eventsUrl', ph: string) =>
      h('label', { class: 'set' }, label, h('input', { type: 'url', dir: 'ltr', placeholder: ph, value: d[key], onchange: (e: Event) => this.act.settings({ [key]: (e.target as HTMLInputElement).value }) }))
    return h('section', { class: 'page settings' },
      h('h2', null, 'الإعدادات'),
      h('div', { class: 'grid' },
        slider('صوت الأجواء', 'musicVolume', 0, 1, 0.05), slider('صوت المؤثرات', 'sfxVolume', 0, 1, 0.05), slider('حساسية الماوس', 'sensitivity', 0.3, 2.5, 0.1),
        h('label', { class: 'set' }, 'جودة الرسوم', h('select', { onchange: (e: Event) => this.act.settings({ quality: (e.target as HTMLSelectElement).value as Quality }) },
          ([['low', 'منخفضة (للموبايل)'], ['medium', 'متوسطة'], ['high', 'عالية']] as const).map(([v, t]) => h('option', { value: v, selected: d.quality === v }, t)))),
        check('كتم الصوت', 'muted'), check('عكس المحور الرأسي', 'invertY'), check('تقليل الحركة', 'reducedMotion')),
      h('details', null, h('summary', null, 'الخدمات المتقدمة (اختياري)'),
        h('p', { class: 'note' }, 'روابط خوادمك الخاصة. من غيرها اللعبة بتشتغل أوفلاين بالتلميحات والتحقق المحلي.'),
        url('رابط التلميحات الذكية (ChatGPT)', 'hintEndpoint', 'https://your-proxy.example/hint'),
        url('رابط تحليل الصور بالذكاء الاصطناعي', 'visionEndpoint', 'https://your-proxy.example/vision'),
        url('رابط قاعدة الأحداث الواقعية', 'eventsUrl', 'https://your-host.example/events.json')),
      h('button', { class: 'btn ghost back', onclick: () => this.go(this.back ?? 'title') }, 'رجوع'))
  }
}
