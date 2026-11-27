import { arabicDigits } from '../core/clock'
import { MemoryCampaign } from '../core/memoryCampaign'
import { MAIN_STORIES, MEMORY_CHAPTERS, MEMORY_PEOPLE, MEMORY_PLACES, NETWORKS, PHASES, REGIONS, YEARS, relatedChapters, type MemoryChapter, type MemoryPlace, type MemoryWitness } from '../data/memoryWorld'
import type { StorageAdapter } from '../services/storage'
import { h, setChildren } from './dom'
import { createMemorySceneFigure } from './memoryScene'

type Page = 'scene' | 'map' | 'timeline' | 'people' | 'networks'
const PAGES: [Page, string][] = [['scene', 'المكان'], ['map', 'الخريطة'], ['timeline', 'التسلسل الزمني'], ['people', 'الشهود'], ['networks', 'الشبكات']]
const yearLabel = (phase: number) => arabicDigits(YEARS[phase])

export class MemoryView {
  readonly el = h('dialog', { class: 'memory-view', 'aria-labelledby': 'memory-title' })
  readonly campaign: MemoryCampaign
  private readonly content = h('div', { class: 'memory-content' })
  private readonly heading = h('h2', { id: 'memory-title' }, 'أرشيف ياسين')
  private readonly nav = h('nav', { class: 'memory-tabs', 'aria-label': 'أقسام أرشيف ياسين' })
  private readonly progress = h('p', { class: 'memory-progress' })
  private readonly announcement = h('p', { class: 'memory-sr', role: 'status' })
  private page: Page = 'scene'
  private past = false
  private mapRegion = 0
  private mapDistrict: 'all' | 'abis' | 'alex' = 'all'
  private timelinePhase = 0
  private selectedWitness?: number
  private feedback = ''

  constructor(storage: StorageAdapter) {
    this.campaign = new MemoryCampaign(storage)
    this.mapRegion = this.place.region
    this.timelinePhase = this.place.phase
    this.el.append(h('header', { class: 'memory-head' }, h('div', null, this.heading, this.progress),
      h('button', { type: 'button', class: 'memory-button memory-quiet', onclick: () => this.el.close() }, 'رجوع للعبة')),
    this.nav, this.content, this.announcement)
  }

  get open(): boolean { return this.el.open }
  private get place(): MemoryPlace { return MEMORY_PLACES[this.campaign.location] }
  private get chapter(): MemoryChapter { return MEMORY_CHAPTERS[this.place.chapter] }

  show(): void {
    if (this.open) return
    this.render()
    this.el.showModal()
  }
  close(): void { if (this.open) this.el.close() }

  private button(label: string, action: () => void, className = '', attrs: Record<string, unknown> = {}): HTMLButtonElement {
    return h('button', { type: 'button', class: `memory-button ${className}`, onclick: action, ...attrs }, label)
  }
  private selectPage(page: Page): void {
    this.page = page
    this.feedback = ''
    this.selectedWitness = undefined
    this.render(true)
    this.nav.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus()
  }
  private visit(place: MemoryPlace, past = false): void {
    this.campaign.visit(place)
    this.past = past
    this.mapRegion = place.region
    this.timelinePhase = place.phase
    this.selectPage('scene')
    this.announcement.textContent = place.title
  }
  private render(resetScroll = false): void {
    const game = this.campaign
    this.progress.textContent = `${arabicDigits(game.clueCount)} / ${arabicDigits(MEMORY_PLACES.length)} دليل · ${arabicDigits(game.witnessCount)} / ${arabicDigits(MEMORY_PEOPLE.length)} شهادة · ${arabicDigits(game.confirmedCount)} / ${arabicDigits(MEMORY_CHAPTERS.length)} واقعة (٥٠٠ أبيس + ٥٠٠ الإسكندرية)`
    setChildren(this.nav, PAGES.map(([page, label]) => this.button(label, () => this.selectPage(page), 'memory-quiet', { 'aria-current': page === this.page ? 'page' : undefined })))
    const view = { scene: () => this.scene(), map: () => this.map(), timeline: () => this.timeline(), people: () => this.people(), networks: () => this.networks() }
    this.content.classList.remove('entering')
    void this.content.offsetWidth
    setChildren(this.content, view[this.page]())
    this.content.classList.add('entering')
    if (resetScroll) this.el.scrollTop = 0
  }

  private scene(): HTMLElement {
    const game = this.campaign
    const place = this.place
    const chapter = this.chapter
    const known = game.identified(place)
    const open = game.unlocked(chapter)
    const past = open && this.past
    const phase = PHASES[place.phase]
    const region = REGIONS[place.region]
    const sceneFigure = createMemorySceneFigure(place, past)
    const notify = (message: string) => { this.announcement.textContent = message }
    return h('div', { class: 'memory-scene' },
      game.clueCount === 0 && h('p', { class: 'memory-intro' }, 'لقيت اسم أمي على ورقة واحدة من ملف القطعة ١٥. عشان أفهم مين غيّر الخريطة قبل اختفاء خالي، هابدأ مع علاء في التمنيات. كل شاهد محتاج يشوف دليل قبل ما أثبّت كلامه.'),
      this.leads(),
      h('div', { class: 'memory-scene-layout' },
        h('section', { class: 'memory-card' },
          h('div', { class: 'memory-section-head' }, h('div', null, h('small', null, region[0]), h('h3', null, place.site[0])),
            h('div', { class: 'memory-switch', role: 'group', 'aria-label': 'وقت المشهد' },
              this.button('الحاضر', () => this.togglePast(false), 'memory-quiet', { 'aria-pressed': String(!past) }),
              this.button(`الماضي · ${yearLabel(place.phase)}`, () => this.togglePast(true), 'memory-quiet', { disabled: !open, 'aria-pressed': String(past) }))),
          sceneFigure,
          h('p', null, past ? place.site[3] : `${place.site[1]}. ${region[2]}`),
          open && MAIN_STORIES[chapter.id] && h('p', { class: 'memory-note' }, this.summary(chapter)),
          !open && h('p', { class: 'memory-note' }, 'الفترة دي لسه مقفولة. ثبّت الوقائع المطلوبة في الخيط الرئيسي عشان تفتحها.'),
          open && !known && (past
            ? this.button(`افحص ${place.site[2]}`, () => {
                if (game.inspect(place)) { this.render(); notify('اتسجل الدليل: ' + place.site[2]); this.content.querySelector<HTMLElement>('.memory-clue')?.focus() }
              }, 'memory-action')
            : this.button('ارجع للماضي وافحص المكان', () => this.togglePast(true), 'memory-action')),
          known && h('p', { class: 'memory-clue', tabindex: '-1' }, h('strong', null, 'الدليل '), `${place.site[2]}. علامة المنطقة «${region[5]}». ${phase.clue}`),
        ),
        h('aside', { class: 'memory-card' }, h('h3', null, phase.name),
          h('ul', { class: 'memory-list memory-place-list' }, chapter.sites.map(site =>
            h('li', null, this.button(`${game.identified(site) ? '✓ ' : ''}${site.site[0]}`, () => this.visit(site, this.past), 'memory-quiet', { 'aria-current': site.id === place.id ? 'location' : undefined })))),
          h('h4', null, 'شهود الواقعة'),
          chapter.witnesses.map(w => this.button(w.name, () => this.openWitness(w), 'memory-quiet memory-witness-link')),
          h('details', null, h('summary', null, 'وقائع مرتبطة'),
            relatedChapters(chapter).map(related => this.chapterLink(related))),
        )),
    )
  }

  private togglePast(value: boolean): void {
    this.past = value
    this.render()
    this.content.querySelector<HTMLButtonElement>('.memory-switch [aria-pressed="true"]')?.focus()
  }
  private leads(): HTMLElement {
    const game = this.campaign
    if (game.ready) {
      const ending = game.verdict === 'credit'
        ? 'اتنشر ملخص القضية بأسماء الشهود اللي وافقوا. ظهر دور آمنة في النسخة الأولى، وساعدت إفادات القرى في فتح ملفات الممرات والتعويضات من جديد.'
        : 'سلّمت ملخص القضية من غير الأسماء الخاصة. النسخ برقمها وتاريخها اتجمعت، ورسائل الأهالي فضلت معاهم.'
      return h('section', { class: 'memory-leads' }, h('h3', null, game.verdict ? 'محضر الجلسة' : 'قرار الجلسة'),
        game.verdict ? h('p', null, ending) : h('div', null,
          h('p', null, 'جمع مجلس الشهود نسخ الريف والمدينة. اختار طريقة نشر الملخص.'),
          this.button('انشر الملخص بالأسماء المصرّح بها', () => { game.conclude('credit'); this.render() }, 'memory-action'),
          this.button('انشر الوقائع واحفظ الأسماء الخاصة', () => { game.conclude('privacy'); this.render() }, 'memory-quiet')),
        h('p', null, game.confirmedCount === MEMORY_CHAPTERS.length
          ? `اتقفل الأرشيف بعد ما اتثبتت كل الوقائع (${arabicDigits(MEMORY_CHAPTERS.length)} واقعة في أبيس والإسكندرية). كل منطقة بقت تقدر ترجع لنسختها وتعرف كانت متصلة بمين.`
          : `الملف فيه ${arabicDigits(game.confirmedCount)} واقعة مثبتة من أصل ${arabicDigits(MEMORY_CHAPTERS.length)}. كل واقعة إضافية تدخل في الأرشيف مع أدلتها وشهودها.`))
    }
    return h('section', { class: 'memory-leads' },
      h('div', null, h('small', null, 'الخيط الرئيسي'), h('h3', null, `${yearLabel(game.stage)} · ${PHASES[game.stage].name}`)),
      h('div', { class: 'memory-link-row' }, game.mainLeads().map(chapter => this.chapterLink(chapter))))
  }
  private chapterLink(chapter: MemoryChapter): HTMLButtonElement {
    return this.button(`${this.campaign.confirmed(chapter) ? '✓ ' : ''}${REGIONS[chapter.region][0]} · ${yearLabel(chapter.phase)}`,
      () => this.visit(chapter.sites.find(site => !this.campaign.identified(site)) ?? chapter.sites[0]), 'memory-quiet')
  }
  private summary(chapter: MemoryChapter): string {
    const story = MAIN_STORIES[chapter.id]
    if (story) return this.campaign.confirmed(chapter) ? story.finding : story.opening
    return `${REGIONS[chapter.region][2]} ${PHASES[chapter.phase].clue}`
  }
  private map(): HTMLElement {
    const visibleRegions = REGIONS.map((r, i) => ({ r, i })).filter(({ r }) =>
      this.mapDistrict === 'all' ? true : this.mapDistrict === 'alex' ? r[1] === 'الإسكندرية' : r[1] !== 'الإسكندرية')
    if (!visibleRegions.some(x => x.i === this.mapRegion)) this.mapRegion = visibleRegions[0]?.i ?? 0
    const region = REGIONS[this.mapRegion]
    const abisCount = REGIONS.filter(r => r[1] !== 'الإسكندرية').length * PHASES.length * 5
    const alexCount = REGIONS.filter(r => r[1] === 'الإسكندرية').length * PHASES.length * 5
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${region[7]},${region[8]}`
    const screen = h('section', { class: 'memory-map' }, h('h3', null, 'خريطة أبيس والإسكندرية'), h('p', { class: 'memory-note' },
      `الأرشيف يضم ${arabicDigits(abisCount)} موقع في أبيس و${arabicDigits(alexCount)} موقع جديد في أحياء الإسكندرية الحقيقية بإحداثيات جوجل ماب وربط زمني من زلزال ١٩٩٢ لحد ٢٠٢٦.`))
    const choose = h('select', { id: 'memory-region', onchange: () => {
      this.mapRegion = Number(choose.value)
      this.render()
      this.content.querySelector('select')?.focus()
    } }, visibleRegions.map(({ r, i }) => h('option', { value: i, selected: i === this.mapRegion }, `${r[0]} — ${r[1]}`)))
    screen.append(
      h('div', { class: 'memory-link-row', role: 'group', 'aria-label': 'تصفية حسب النطاق' },
        this.button(`الكل (${arabicDigits(abisCount + alexCount)})`, () => { this.mapDistrict = 'all'; this.render() }, 'memory-quiet', { 'aria-pressed': String(this.mapDistrict === 'all') }),
        this.button(`أبيس والضواحي (${arabicDigits(abisCount)})`, () => { this.mapDistrict = 'abis'; this.render() }, 'memory-quiet', { 'aria-pressed': String(this.mapDistrict === 'abis') }),
        this.button(`أحياء الإسكندرية (${arabicDigits(alexCount)})`, () => { this.mapDistrict = 'alex'; this.render() }, 'memory-quiet', { 'aria-pressed': String(this.mapDistrict === 'alex') })),
      h('div', { class: 'memory-filters' },
        h('label', { for: choose.id }, 'المنطقة'), choose,
        h('a', { class: 'memory-button memory-quiet', href: mapsUrl, target: '_blank', rel: 'noopener noreferrer' }, 'خرائط جوجل ↗')),
      h('div', { class: 'memory-card' }, h('h4', null, region[0]), h('p', null, region[2])),
      h('div', { class: 'memory-map-grid' }, PHASES.map((phase, index) => {
        const chapter = MEMORY_CHAPTERS[this.mapRegion * PHASES.length + index]
        return h('article', { class: 'memory-card' }, h('small', null, yearLabel(index)), h('h4', null, phase.name),
          h('ul', { class: 'memory-list memory-place-list' }, chapter.sites.map(place =>
            h('li', null, this.button(`${this.campaign.identified(place) ? '✓ ' : ''}${place.site[0]}`, () => this.visit(place), 'memory-quiet')))))
      })))
    return screen
  }
  private timeline(): HTMLElement {
    const phase = this.timelinePhase
    const events = MEMORY_CHAPTERS.filter(c => c.phase === phase).sort((a, b) => a.month - b.month || a.day - b.day)
    return h('div', { class: 'memory-timeline' }, h('h3', null, 'التسلسل الزمني'),
      h('div', { class: 'memory-link-row', role: 'group', 'aria-label': 'اختار سنة' }, YEARS.map((_year, i) =>
        this.button(yearLabel(i), () => {
          this.timelinePhase = i
          this.render()
          this.content.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()
        }, 'memory-quiet', { 'aria-pressed': String(i === phase) }))),
      h('p', { class: 'memory-note' }, PHASES[phase].stakes),
      h('ol', { class: 'memory-list memory-events' }, events.map(chapter => {
        const complete = this.campaign.confirmed(chapter)
        const open = this.campaign.unlocked(chapter)
        return h('li', { class: 'memory-card' },
          h('small', null, `${arabicDigits(chapter.day)} / ${arabicDigits(chapter.month)} / ${yearLabel(chapter.phase)}`),
          h('div', { class: 'memory-section-head' }, h('h4', null, REGIONS[chapter.region][0]), h('span', { class: 'memory-state' }, complete ? 'مثبتة' : open ? 'تحت التحقيق' : 'مقفولة')),
          complete && h('p', null, this.summary(chapter)),
          open && this.button('شوف مشهد الماضي', () => this.visit(chapter.sites.find(site => !this.campaign.identified(site)) ?? chapter.sites[0], true), 'memory-quiet'),
          complete && h('details', null, h('summary', null, 'الشهادات ومسارات التأكيد'), chapter.witnesses.map(w => h('p', null, `${w.name} — ${w.line}`)), relatedChapters(chapter).map(c => this.chapterLink(c))))
      })))
  }
  private openWitness(witness: MemoryWitness): void {
    this.page = 'people'
    this.selectedWitness = witness.id
    this.feedback = ''
    this.render(true)
    this.content.querySelector<HTMLElement>('.memory-person-heading')?.focus()
  }
  private people(): HTMLElement {
    const chapter = this.chapter
    const game = this.campaign
    return h('div', null, h('h3', { class: 'memory-person-heading', tabindex: '-1' }, `شهود ${REGIONS[chapter.region][0]} · ${yearLabel(chapter.phase)}`),
      h('div', { class: 'memory-people' }, chapter.witnesses.map(witness => {
        const active = this.selectedWitness === witness.id
        const checked = game.checked(witness.id)
        const canAsk = game.canQuestion(chapter, witness.id)
        const missing = game.missing(chapter, witness.id)
        return h('article', { class: 'memory-card' }, h('h4', null, witness.name),
          h('small', null, witness.friend ? 'صديق لياسين' : witness.role), h('p', null, witness.intro),
          checked ? h('p', { class: 'memory-clue' }, witness.line)
            : !game.unlocked(chapter) ? h('p', null, 'الشهادة تتفتح مع السنة دي.')
              : !canAsk ? h('div', null, h('p', null, missing.length ? 'افحص الأماكن دي قبل السؤال.' : 'ثبّت الشهادة الأولى قبل ما تقارنها بالتانية.'),
                missing.map(site => this.button(site.site[0], () => this.visit(site, true), 'memory-quiet')))
                : active ? h('div', null, h('p', null, `«${witness.friend ? 'النسخة بتبين' : 'فاكر'} ${chapter.sites[witness.correctSlot].site[1]}.» أنهي دليل يثبت مكان الواقعة؟`),
                  h('details', null, h('summary', null, 'راجع الأوصاف في الدفتر'),
                    h('ul', { class: 'memory-list' }, witness.needs.map(slot => h('li', null, `${chapter.sites[slot].site[2]} · ${chapter.sites[slot].site[1]}`)))),
                  h('div', { class: 'memory-link-row' }, witness.needs.map(slot =>
                    this.button(chapter.sites[slot].site[2], () => {
                      const ok = game.substantiate(chapter, witness.id, slot)
                      this.feedback = ok ? '' : 'الأثر ده من مكان تاني. قارن وصف الشاهد بوصف المكان في الأرشيف.'
                      this.render()
                      this.announcement.textContent = ok ? `اتثبتت شهادة ${witness.name}` : this.feedback
                      this.content.querySelector<HTMLElement>('.memory-person-heading')?.focus()
                    }, 'memory-quiet'))),
                  this.feedback && h('p', { class: 'memory-note' }, this.feedback))
                  : this.button('قارن الشهادة بالأثر', () => this.openWitness(witness), 'memory-action'))
      })),
      game.confirmed(chapter) && h('div', { class: 'memory-leads' }, h('p', null, this.summary(chapter)), this.button('راجع الخيط الرئيسي', () => this.selectPage('scene'), 'memory-action')),
      this.castDirectory())
  }
  private castDirectory(): HTMLElement {
    const results = h('ul', { class: 'memory-list memory-directory-results' })
    const update = (query: string) => {
      const normalized = query.trim()
      const matches = MEMORY_PEOPLE.filter(({ chapter, witness }) =>
        normalized ? `${REGIONS[chapter.region][0]} ${witness.name}`.includes(normalized) : witness.friend)
      setChildren(results, matches.length ? matches.slice(0, 24).map(({ chapter, witness }) =>
        h('li', null, this.button(`${witness.name} · ${REGIONS[chapter.region][0]}`, () => {
          this.campaign.visit(chapter.sites[0])
          this.mapRegion = chapter.region
          this.timelinePhase = chapter.phase
          this.past = false
          this.openWitness(witness)
        }, 'memory-quiet'))) : h('li', null, 'مفيش أسماء بالبحث ده.'))
    }
    const input = h('input', { id: 'memory-person-search', type: 'search', oninput: () => update(input.value) })
    update('')
    return h('details', { class: 'memory-card memory-directory' }, h('summary', null, 'دليل الشخصيات'),
      h('div', { class: 'memory-filters' }, h('label', { for: input.id }, 'ابحث بالاسم أو المنطقة'), input), results)
  }
  private networks(): HTMLElement {
    return h('div', null, h('h3', null, 'شبكات القضية'), h('div', { class: 'memory-networks' }, NETWORKS.map((network, index) =>
      h('article', { class: 'memory-card' }, h('h4', null, network.name), h('p', null, network.role),
        h('ul', { class: 'memory-list' }, PHASES.flatMap((phase, i) => phase.network === index ? [
          h('li', null, h('p', null, `${yearLabel(i)} · ${phase.name}`),
            this.campaign.mainLeads(i).map(chapter => this.chapterLink(chapter))),
        ] : []))))))
  }
}
