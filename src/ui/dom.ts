/**
 * Tiny safe DOM builder. All text goes through `textContent`, never `innerHTML`, so names typed by
 * players or remote event titles can never inject markup.
 *
 *   h('button', { class: 'btn', onclick: go }, 'ابدأ')
 */
type Child = Node | string | number | false | null | undefined
type Attrs = Record<string, unknown>

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener)
      else if (k === 'class') el.className = String(v)
      else if (k === 'style' && typeof v === 'object') {
        // Custom properties (--x) are ignored by Object.assign on CSSStyleDeclaration.
        for (const [prop, value] of Object.entries(v as Record<string, string>)) {
          if (prop.startsWith('--')) el.style.setProperty(prop, value)
          else (el.style as unknown as Record<string, string>)[prop] = value
        }
      }
      else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v)
      else if (v === true) el.setAttribute(k, '')
      else el.setAttribute(k, String(v))
    }
  }
  append(el, children)
  return el
}

function append(el: Element, children: (Child | Child[])[]): void {
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue
    el.append(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c)
  }
}

/** Replace all children. */
export function setChildren(el: Element, ...children: (Child | Child[])[]): void {
  el.replaceChildren()
  append(el, children)
}

/** SVG element helper (namespaced). */
export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  return el
}
