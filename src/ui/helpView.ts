/** "How to play" card: four plain steps anyone can follow. */
import { h, setChildren } from './dom'

const STEPS: [string, string, string][] = [
  ['◉', 'دوس على العلامات', 'في كل مكان فيه علامات على الصورة. دوس عليها علشان تفحص حاجة أو تصوّر.'],
  ['☺', 'كلّم الناس', 'اختار الكلام اللي يعجبك. مفيش اختيار غلط… كل اختيار بيكوّن حكايتك.'],
  ['▤', 'اربط الأدلة', 'افتح «ملف القضية» واختار دليلين يتربطوا ببعض على اللوحة.'],
  ['✉', 'اقرا جواباتك', 'الناس بتبعتلك جوابات. افتحها من الظرف اللي فوق، فيها حكايات وأسرار.'],
]

export class HelpView {
  readonly el = h('div', { class: 'help-layer', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'إزاي تلعب' })
  get open(): boolean { return !this.el.hidden }
  show(onDone?: () => void): void {
    setChildren(this.el,
      h('div', { class: 'help-backdrop' }),
      h('article', { class: 'help-card' },
        h('small', null, 'دليل سريع'),
        h('h2', null, 'إزاي تلعب «الخيط الأخير»؟'),
        h('p', { class: 'help-lead' }, 'انت ياسين، وخالك محمود اختفى. دوّر وراه خطوة خطوة.'),
        h('ol', null, STEPS.map(([icon, title, text]) =>
          h('li', null, h('span', { class: 'help-ic', 'aria-hidden': true }, icon), h('div', null, h('b', null, title), h('p', null, text))))),
        h('button', { class: 'btn primary', onclick: () => { this.hide(); onDone?.() } }, 'فهمت… يلا نبدأ')))
    this.el.hidden = false
  }
  hide(): void { this.el.hidden = true }
  key(e: KeyboardEvent): boolean {
    if (!this.open) return false
    if (e.code === 'Escape' || e.code === 'Enter') { this.hide(); return true }
    return false
  }
}
