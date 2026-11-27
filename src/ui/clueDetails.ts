import type { EvidenceId } from '../data/types'
import { h, setChildren } from './dom'

const wallRows = [
  ['م', 'س', 'ر', '٦', 'ع', 'ك'],
  ['ط', 'ق', 'ل', '١', 'هـ', '٥'],
  ['ن', '٧', 'ب', 'ش', 'ج', 'د'],
  ['ي', '٣', 'ص', 'ف', '٩', 'و'],
]

export function libraryWall(): HTMLElement {
  const grid = h('div', { class: 'clue-wall-grid', dir: 'rtl', role: 'group', 'aria-label': 'نقوش الجدار، بالترتيب من اليمين للشمال' },
      wallRows.flatMap((row, y) => row.map((letter, x) => {
        const marked = y === 1 && x % 2 === 1
        return h('span', { class: marked ? 'pigment' : undefined }, letter,
          marked && h('small', { class: 'clue-sr' }, '، أثر صبغة'))
      })))
  const zoom = h('button', { type: 'button', class: 'tray-btn', 'aria-pressed': 'false', onclick: () => {
    const enlarged = grid.classList.toggle('enlarged')
    zoom.setAttribute('aria-pressed', String(enlarged))
    zoom.textContent = enlarged ? 'صغّر الصورة' : 'كبّر الصورة'
  } }, 'كبّر الصورة')
  return h('figure', { class: 'clue-wall' },
    h('div', { class: 'clue-wall-scroll', dir: 'rtl' }, grid),
    h('figcaption', null, 'لقطة من صورة جدار المكتبة', zoom))
}

export function clueDetail(id: EvidenceId): HTMLElement | undefined {
  switch (id) {
    case 'e_library_photo': return libraryWall()
    case 'e_thread_door': return h('figure', { class: 'clue-specimen clue-knot' },
      h('div', { class: 'clue-knot-lines', role: 'img', 'aria-label': 'لفتين من خيط أحمر ماسكين في بعض وطرف مشدود من كل ناحية' },
        h('i'), h('i')), h('figcaption', null, 'العقدة من قريب'))
    case 'e_boundary_stone': return h('figure', { class: 'clue-specimen clue-stone' },
      h('b', null, '١٥'), h('figcaption', null, 'الرقم المحفور على وشّ الحجر'))
    case 'e_library_envelope':
    case 'e_forged_contract': {
      const original = id === 'e_library_envelope'
      return h('figure', { class: `clue-specimen clue-paper ${original ? 'original' : 'copy'}` },
        h('b', { class: 'clue-payload' }, original ? 'شهادة مساحة' : 'عقد بيع'),
        h('span', { class: 'clue-stamp' }, 'الجمعية الزراعية'),
        h('span', { class: 'clue-signature', 'aria-label': original ? 'محمود، توقيع مستقيم' : 'محمود، توقيع مائل وممدود' }, original ? 'محمود' : 'محـــمود'),
        h('figcaption', null, 'الختم والتوقيع من المستند'))
    }
  }
}

function normalizeLockerCode(value: string): string {
  return value.trim().toLowerCase().replace(/[\s\u061c\u200e\u200f\p{Pd}]/gu, '').replace(/^q/, 'ق')
    .replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) - (digit <= '٩' ? 0x660 : 0x6f0)))
}

export class LockerView {
  readonly el = h('dialog', { class: 'clue-locker', 'aria-labelledby': 'locker-title' })

  show(code: string, onUnlock: () => void): void {
    if (this.el.open) return
    const input = h('input', { id: 'locker-code', maxlength: 16, required: true, autocomplete: 'off', spellcheck: 'false', dir: 'auto' })
    const status = h('p', { class: 'locker-status', role: 'status' })
    const form = h('form', { onsubmit: (event: SubmitEvent) => {
      event.preventDefault()
      if (normalizeLockerCode(input.value) !== code) {
        status.textContent = 'الخزنة لسه مقفولة. راجع ترتيب العلامات في الصورة.'
        input.setAttribute('aria-invalid', 'true')
        input.focus()
        input.select()
        return
      }
      this.el.close()
      onUnlock()
    } },
    h('label', { for: input.id }, 'علامة الخزنة'),
    h('div', { class: 'locker-controls' }, input, h('button', { class: 'btn primary', type: 'submit' }, 'جرّب الكود')),
    status)
    input.addEventListener('input', () => { status.textContent = ''; input.removeAttribute('aria-invalid') })
    setChildren(this.el,
      h('header', null, h('h3', { id: 'locker-title' }, 'خزنة الأمانات'),
        h('button', { type: 'button', class: 'tray-btn', onclick: () => this.el.close() }, 'إغلاق')),
      h('details', null, h('summary', null, 'افتح صورة الجدار'), libraryWall()),
      form,
      h('details', null, h('summary', null, 'خد تلميح'),
        h('p', null, 'دوّر على آثار الصبغة في نفس الصف. اقرأ العلامات دي من اليمين للشمال، زي قراءة كلمة.')))
    this.el.showModal()
    input.focus()
  }
}
