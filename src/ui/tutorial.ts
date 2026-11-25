import type { Session } from '../game/session'
import { h } from './dom'

export type TutorialAction = 'inspect' | 'photo' | 'talk' | 'casefile' | 'thread' | 'hint' | 'travel'
export type TutorialStep = { id: TutorialAction; title: string; body: string; selectors: string[] }

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'talk', title: 'كلّم الناس', body: 'ابدأ بزينب: الوشوش اللي في المشهد شايلة نص الحقيقة. دوس عليها واتكلم معاها.', selectors: ['.inv-person', '.inv-stage'] },
  { id: 'inspect', title: 'بصّ على العلامة', body: 'دوس على دبوس المكان عشان تفحص الأثر وتسمع الحكاية.', selectors: ['.inv-pin.kind-inspect', '.inv-pin', '.inv-stage'] },
  { id: 'casefile', title: 'افتح ملف القضية', body: 'من زر الملف شوف الأدلة والناس والخطوة الجاية.', selectors: ['.inv-file-btn', '.inv-header'] },
  { id: 'hint', title: 'خد تلميح لو اتزنقت', body: 'زر التلميح يديك دفعة صغيرة. بس خلي بالك: التلميحات بتخصم من التقدير.', selectors: ['.inv-actions .inv-act:nth-child(4)', '.inv-mobile-nav button:nth-child(4)', '.inv-header'] },
  { id: 'travel', title: 'اتنقّل بالخريطة', body: 'افتح الخريطة، اختار المكان، وبعدها اركب من الموقف عشان تعدّي بين أبيس وإسكندرية.', selectors: ['.inv-nav-btn:nth-child(2)', '.inv-mobile-nav button:nth-child(2)', '.inv-map-card:not(.here)', '.inv-header'] },
  { id: 'photo', title: 'صوّر اللي يهم', body: 'لما تلاقي حاجة تستاهل، دوس على دبوس الكاميرا وصوّرها.', selectors: ['.inv-pin.kind-photo', '.inv-pin', '.inv-stage'] },
  { id: 'thread', title: 'اربط الخيوط', body: 'على اللوحة دوس على دليل، وبعده دليل له علاقة بيه. كده الاستنتاج يظهر.', selectors: ['.pin-card:not(.ghost)', '.cf-folder'] },
]

export function nextTutorialStep(current: number, action: TutorialAction): number {
  if (current >= TUTORIAL_STEPS.length) return current
  return TUTORIAL_STEPS[current].id === action ? current + 1 : current
}

type TutorialDeps = { onComplete: (skipped: boolean) => void }

/** A spotlight that never owns pointer events, so the real highlighted control remains clickable. */
export class Tutorial {
  readonly el = h('div', { class: 'tutorial-layer', hidden: true, 'aria-live': 'polite' })
  private step = 0
  private running = false
  private readonly spotlight = h('div', { class: 'tutorial-spotlight', 'aria-hidden': true })
  private readonly bubble = h('aside', { class: 'tutorial-bubble', role: 'dialog', 'aria-label': 'شرح التحقيق' })
  private readonly title = h('h2')
  private readonly body = h('p')
  private readonly counter = h('small')
  private raf = 0

  constructor(private readonly d: TutorialDeps) {
    const skip = h('button', { class: 'tutorial-skip', type: 'button', onclick: () => this.finish(true) }, 'تخطّي الشرح')
    this.bubble.append(this.counter, this.title, this.body, skip)
    this.el.append(this.spotlight, this.bubble)
    window.addEventListener('resize', () => this.position())
    window.addEventListener('scroll', () => this.position(), { passive: true })
  }

  start(session: Session): void {
    if (session.caseId !== 'case01' || session.progress.tutorial.completed) return
    this.step = 0
    this.running = true
    this.el.hidden = false
    this.render()
  }

  stop(): void {
    this.running = false
    this.el.hidden = true
    cancelAnimationFrame(this.raf)
  }

  action(action: TutorialAction): void {
    if (!this.running) return
    const next = nextTutorialStep(this.step, action)
    if (next === this.step) return
    this.step = next
    if (this.step >= TUTORIAL_STEPS.length) this.finish(false)
    else this.render()
  }

  private finish(skipped: boolean): void {
    if (!this.running) return
    this.running = false
    this.el.hidden = true
    this.d.onComplete(skipped)
  }

  private render(): void {
    const current = TUTORIAL_STEPS[this.step]
    if (!current) return this.finish(false)
    this.counter.textContent = `${this.toArabic(this.step + 1)} / ${this.toArabic(TUTORIAL_STEPS.length)}`
    this.title.textContent = current.title
    this.body.textContent = current.body
    this.el.dataset.step = current.id
    this.position()
  }

  private position(): void {
    if (!this.running) return
    cancelAnimationFrame(this.raf)
    this.raf = requestAnimationFrame(() => {
      const current = TUTORIAL_STEPS[this.step]
      const target = current?.selectors.map(selector => [...document.querySelectorAll<HTMLElement>(selector)].find(el => el.offsetParent !== null)).find(Boolean)
      const r = target?.getBoundingClientRect()
      if (!r || r.width === 0 || r.height === 0) {
        this.spotlight.style.cssText = ''
        this.bubble.style.insetInline = 'auto 5vw'
        this.bubble.style.top = '18vh'
        return
      }
      const pad = 8
      this.spotlight.style.left = `${Math.max(4, r.left - pad)}px`
      this.spotlight.style.top = `${Math.max(4, r.top - pad)}px`
      this.spotlight.style.width = `${r.width + pad * 2}px`
      this.spotlight.style.height = `${r.height + pad * 2}px`
      const below = r.bottom + 18
      const above = r.top - 18 - this.bubble.offsetHeight
      this.bubble.style.top = `${Math.max(12, below + this.bubble.offsetHeight < window.innerHeight - 12 ? below : above)}px`
      const left = Math.min(Math.max(12, r.left + r.width / 2 - this.bubble.offsetWidth / 2), window.innerWidth - this.bubble.offsetWidth - 12)
      this.bubble.style.left = `${left}px`
      this.bubble.style.insetInline = 'auto'
    })
  }

  private toArabic(value: number): string {
    return String(value).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
  }
}
