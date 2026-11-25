/**
 * Shared data contracts for "الخيط الأخير".
 *
 * Everything narrative (characters, places, cases, dialogue, real-world events) is plain data typed
 * here, so it can be edited, translated or moved to another engine (AntiGravity phase) without
 * touching rendering code. Systems in `src/systems/` interpret these records; they stay pure.
 */

/** Realistic mode follows the real clock/calendar; Story mode follows narrative progress only. */
export type GameMode = 'realistic' | 'story'

export type Vec2 = { x: number; z: number }

/** Real-world anchor used by field photography (GPS verification). */

export type PlaceId =
  | 'zeinab_home' | 'mahmoud_house' | 'cafe_ragab' | 'abis_mosque' | 'canal_bridge' | 'plot15'
  | 'abis_stop' | 'raml_stop' | 'mansheya' | 'qaitbay' | 'bibliotheca' | 'pompey' | 'corniche'

export type Place = {
  id: PlaceId
  name: string
  district: 'abis' | 'city'
  /** World position (metres). North is -Z, the sea lies north of the city. */
  pos: Vec2
  /** Short label for the minimap. */
  short: string
  description: string
  /** Landmarks that can be photographed (in-world camera or real photo). */
  photographable?: boolean
}

/** Hour window in Cairo local time; `to` may be smaller than `from` (wraps past midnight). */
export type HourWindow = { from: number; to: number }

/**
 * Availability rule for evidence, NPCs or dialogue lines.
 * Story mode ignores clock/calendar rules and checks only `story` flags.
 */
export type Gate = {
  /** Realistic mode: open during any of these hour windows. */
  hours?: HourWindow[]
  /** Realistic mode: also open all day when the calendar has an event of this kind today. */
  orEventToday?: EventKind
  /** Realistic mode: open only on a day with this event kind (stricter than orEventToday). */
  onlyEventToday?: EventKind
  /** Explanation shown when closed, e.g. "القهوة بتفتح بعد العصر". */
  closedText?: string
}

export type EventKind = 'match_ittihad' | 'market_day' | 'friday_prayer'

export type RealEvent = {
  id: string
  kind: EventKind
  title: string
  /** ISO date-time in Cairo local time (no offset), e.g. "2026-11-28T19:00". */
  at: string
  /** Optional end (Cairo local). Defaults per kind (match = kickoff + 2h). */
  endsAt?: string
  venue?: string
  note?: string
  /** Weekly recurrence: the event repeats every `weekday` (0 = Sunday) between `from` and `to` (HH:mm). */
  recurring?: { weekday: number; from: string; to: string }
  /** True for placeholder fixtures that must be replaced by the official schedule. */
  provisional?: boolean
  /** Where the record came from ("seed", "remote:<url>", "user"). */
  source?: string
  /** Monotonic revision: a higher value wins when the same id arrives from two sources. */
  updatedAt?: number
}

export type CharacterId =
  | 'yassin' | 'zeinab' | 'hassan' | 'ragab' | 'mahmoud' | 'shawky' | 'bahr' | 'fathy'
  | 'salma' | 'nabil' | 'adham' | 'nadia' | 'farid' | 'omar' | 'hoda' | 'khaled'

/** Deep character profile ("ملف تعريف"): drives the notebook, dialogue tone and the figure. */
export type CharacterProfile = {
  id: CharacterId
  name: string
  nickname?: string
  age: number
  role: string
  home: string
  /** Detailed visual description: used for the dossier and as the art brief for later phases. */
  appearance: string
  personality: string[]
  /** The character's past, unlocked progressively through `pastUnlock` flags. */
  past: { text: string; unlock?: string }[]
  /** What they hide (revealed only after a flag). */
  secret?: { text: string; unlock: string }
  relationToCase: string
  voice: string
  quote: string
  /** Palette used for dossier portraits and the minimap marker. */
  figure: { body: string; accent: string; skin: string; headwear?: 'turban' | 'scarf' | 'cap' | 'none' }
  /** Where they stand; realistic mode may use the schedule instead. */
  place: PlaceId
  schedule?: { hours: HourWindow; place: PlaceId }[]
  /** Present only once this flag is set (e.g. Mahmoud appears after he is found). */
  appearsWhen?: string
}

export type EvidenceKind = 'object' | 'testimony' | 'document' | 'photo' | 'trace'

export type EvidenceId =
  | 'e_thread_door' | 'e_survey_book' | 'e_old_photo' | 'e_hassan_testimony' | 'e_boundary_stone'
  | 'e_cafe_bill' | 'e_microbus_ticket' | 'e_bahr_testimony' | 'e_harbor_thread'
  | 'e_library_envelope' | 'e_forged_contract' | 'e_fathy_testimony'
  | 'e_library_photo' | 'e_qaitbay_photo' | 'e_pillar_photo' | 'e_match_night_photo'
  | 'e02_black_envelope' | 'e02_burned_map' | 'e02_red_receipt' | 'e02_corniche_photo'
  | 'e02_key_tag' | 'e02_ledger_page' | 'e02_messenger_note' | 'e02_sea_glass'
  | 'e02_recording' | 'e02_archive_stamp' | 'e02_radio_log' | 'e02_stock_manifest'
  | 'e03_mud_prints' | 'e03_coop_register' | 'e03_broken_lantern' | 'e03_bus_token'
  | 'e03_negative' | 'e03_river_note' | 'e03_red_staple' | 'e03_tide_chart'
  | 'e03_camera_roll' | 'e03_lock_key' | 'e03_false_permit' | 'e03_final_statement'

export type Evidence = {
  id: EvidenceId
  title: string
  kind: EvidenceKind
  /** What the player sees in the notebook. */
  summary: string
  /** Close inspection text (the "magnifying glass" view). */
  detail: string
  /** Where it is found. */
  place: PlaceId
  source: string
  /** Optional real-time gate (realistic mode). */
  gate?: Gate
}

export type DeductionId =
  | 'd_trail' | 'd_markers' | 'd_alibi' | 'd_where' | 'd_forgery' | 'd_motive'
  | 'd02_route' | 'd02_motive' | 'd02_forgery' | 'd02_betrayal' | 'd02_chain' | 'd02_confrontation'
  | 'd03_route' | 'd03_records' | 'd03_witness' | 'd03_motive' | 'd03_confrontation'

export type Deduction = {
  id: DeductionId
  title: string
  /** Any one of these evidence pairs creates the thread. Order does not matter. */
  pairs: [EvidenceId, EvidenceId][]
  conclusion: string
  /** Flags set when the thread is tied. */
  sets?: string[]
}

/** Dialogue effects are data, applied by `systems/state.ts`. */
export type Effect =
  | { type: 'evidence'; id: EvidenceId }
  | { type: 'flag'; id: string }
  | { type: 'unflag'; id: string }

export type Condition = {
  /** Realistic mode only: the gate must currently be closed (always false in story mode). */
  closedGate?: Gate
  flags?: string[]
  notFlags?: string[]
  evidence?: EvidenceId[]
  notEvidence?: EvidenceId[]
  deductions?: DeductionId[]
  gate?: Gate
}

export type DialogueLine = { who: CharacterId | 'player' | 'narrator'; text: string }

export type DialogueChoice = {
  text: string
  next: string
  when?: Condition
  effects?: Effect[]
  /** Hide after it was chosen once. */
  once?: boolean
  /** Evidence card presented during this choice; the UI can render it beside the text. */
  present?: EvidenceId
  /** Narrative metadata for an evidence confrontation. */
  confront?: boolean
  /** Optional signal that this choice is an intentional lie/false claim. */
  lie?: boolean
}

export type DialogueNode = {
  id: string
  lines: DialogueLine[]
  effects?: Effect[]
  choices?: DialogueChoice[]
  /** Next node when there are no choices; omit to end. */
  next?: string
}

export type Dialogue = {
  character: CharacterId
  /** First matching entry wins: lets a character greet differently as the case evolves. */
  entries: { node: string; when?: Condition }[]
  nodes: Record<string, DialogueNode>
}

/** A world interaction spot: inspect evidence, photograph a landmark or ride the microbus. */
export type Hotspot = {
  id: string
  label: string
  place: PlaceId
  offset: Vec2
  kind: 'inspect' | 'photo' | 'travel' | 'rest'
  when?: Condition
  /** Effects applied once on inspection. */
  effects?: Effect[]
  /** Narration shown while inspecting. */
  text?: string
  /** For travel: destination stop. */
  to?: PlaceId
  /** Hide after the effects are collected. */
  consumable?: boolean
}

export type Objective = {
  id: string
  title: string
  detail: string
  place?: PlaceId
  /** Visible while `when` matches; completed when `doneWhen` matches. */
  when?: Condition
  doneWhen: Condition
}

export type Suspect = { id: CharacterId | 'unknown'; label: string }

export type CaseFile = {
  id: string
  number: string
  title: string
  tagline: string
  /** Opening narration: `{player}`, `{nightEvent}` and `{home}` are filled in at runtime. */
  intro: string[]
  evidence: Evidence[]
  deductions: Deduction[]
  objectives: Objective[]
  hotspots: Hotspot[]
  suspects: Suspect[]
  /** Final accusation: needs these deductions and flags. */
  finale: {
    requires: Condition
    culprit: CharacterId
    motives: { id: string; text: string; correct: boolean }[]
    wrongCulprit: string
    wrongMotive: string
    ending: string[]
  }
}
