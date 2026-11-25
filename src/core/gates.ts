/**
 * Real-time gates: decide whether optional content (bonus evidence, shopkeepers, informants) is
 * reachable right now.
 *
 * Realistic mode honours opening hours and real-world events. Story mode ignores the calendar
 * entirely so the case can always be finished at the player's pace. Critical-path evidence carries
 * no gate by design (see `data/case01.ts`), so a closed gate never blocks the main investigation.
 */
import type { EventKind, Gate, GameMode } from '../data/types'
import { hourInWindow, partsOf } from './clock'

/** Hours around a match/event during which "event day" content is available. */
export const EVENT_PADDING_HOURS = 3

export type GateContext = {
  mode: GameMode
  /** Current Cairo stamp. */
  stamp: number
  /** Is an occurrence of `kind` within `paddingHours` of `stamp` (before its start / after its end)? */
  eventNear: (kind: EventKind, stamp: number, paddingHours: number) => boolean
}

export type GateResult = { open: boolean; reason?: string }

export function evalGate(gate: Gate | undefined, ctx: GateContext): GateResult {
  if (!gate || ctx.mode === 'story') return { open: true }
  const closed: GateResult = { open: false, reason: gate.closedText }
  const hour = partsOf(ctx.stamp).hourFloat
  const inHours = !gate.hours || gate.hours.some(w => hourInWindow(hour, w.from, w.to))
  const near = (kind: EventKind) => ctx.eventNear(kind, ctx.stamp, EVENT_PADDING_HOURS)

  if (gate.onlyEventToday) return near(gate.onlyEventToday) && inHours ? { open: true } : closed
  if (gate.orEventToday && near(gate.orEventToday)) return { open: true }
  return inHours ? { open: true } : closed
}
