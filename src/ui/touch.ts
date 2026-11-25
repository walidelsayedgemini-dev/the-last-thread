import type { Input } from '../engine/input'
import { h } from './dom'

/**
 * On-screen touch controls: a floating stick on the left half, drag-to-look on the right half and
 * a hold-to-run button. Interaction, camera, hints and the case file use the HUD buttons, which are
 * large enough to tap. Enabled automatically on the first touch.
 */
export class TouchControls {
  readonly el: HTMLElement
  private stickId: number | null = null
  private lookId: number | null = null
  private origin = { x: 0, y: 0 }
  private last = { x: 0, y: 0 }
  private readonly stick: HTMLElement
  private readonly knob: HTMLElement

  constructor(canvas: HTMLCanvasElement, private readonly input: Input, private readonly active: () => boolean) {
    this.knob = h('i')
    this.stick = h('div', { class: 'touch-stick' }, this.knob)
    const run = h('button', { class: 'touch-run', 'aria-label': 'جري' }, 'جري')
    this.el = h('div', { class: 'touch' }, this.stick, run)
    const radius = 56
    const enable = () => document.body.classList.add('has-touch')
    if (matchMedia('(pointer: coarse)').matches) enable()
    window.addEventListener('touchstart', enable, { once: true, passive: true })
    window.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') this.input.method = 'touch'
    }, { capture: true })
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' || !this.active()) return
      if (e.clientX < window.innerWidth * 0.45 && this.stickId === null) {
        this.stickId = e.pointerId
        this.origin = { x: e.clientX, y: e.clientY }
        this.stick.style.left = `${e.clientX}px`
        this.stick.style.top = `${e.clientY}px`
        this.stick.classList.add('is-active')
      } else if (this.lookId === null) {
        this.lookId = e.pointerId
        this.last = { x: e.clientX, y: e.clientY }
      }
    })
    window.addEventListener('pointermove', e => {
      if (e.pointerId === this.stickId) {
        let dx = e.clientX - this.origin.x
        let dy = e.clientY - this.origin.y
        const len = Math.hypot(dx, dy)
        if (len > radius) {
          dx = (dx / len) * radius
          dy = (dy / len) * radius
        }
        this.knob.style.transform = `translate(${dx}px, ${dy}px)`
        this.input.setTouchMove(dx / radius, -dy / radius)
      } else if (e.pointerId === this.lookId) {
        this.input.addTouchLook(e.clientX - this.last.x, e.clientY - this.last.y)
        this.last = { x: e.clientX, y: e.clientY }
      }
    })
    const end = (e: PointerEvent) => {
      if (e.pointerId === this.stickId) {
        this.stickId = null
        this.knob.style.transform = ''
        this.stick.classList.remove('is-active')
        this.input.setTouchMove(0, 0)
      }
      if (e.pointerId === this.lookId) this.lookId = null
    }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    run.addEventListener('pointerdown', e => {
      e.preventDefault()
      run.setPointerCapture(e.pointerId)
      run.classList.add('is-down')
      this.input.setTouchButton('sprint', true)
    })
    const up = () => {
      run.classList.remove('is-down')
      this.input.setTouchButton('sprint', false)
    }
    run.addEventListener('pointerup', up)
    run.addEventListener('pointercancel', up)
  }
}
