/**
 * User / profile management service.
 *
 * Phase 1 is offline: up to three local save slots, each holding the player's avatar choice and a
 * versioned progress record. The service talks only to a {@link StorageAdapter}, so the cloud-sync
 * phase can replace the adapter (or wrap this service) without touching gameplay code.
 *
 * Progress records carry a `v` field; `migrate()` upgrades older shapes step by step, which is how
 * the schema keeps evolving with continuous updates without invalidating players' saves.
 */
import type { GameMode } from '../data/types'
import type { CaseSnapshot } from '../core/caseState'
import type { StorageAdapter } from './storage'

export const MAX_PROFILES = 3
export const PROGRESS_VERSION = 4
const INDEX_KEY = 'ltt.profiles.index'
const profileKey = (id: string) => `ltt.profile.${id}`

export type Gender = 'male' | 'female'

/** The playable character: the canonical hero or a custom creation. */
export type Avatar = {
  kind: 'yassin' | 'custom'
  name: string
  gender: Gender
  /** CSS colour used for the player's marker / accent. */
  accent: string
  home: string
}

export type ProgressStats = {
  photos: number
  hints: number
  wrongAccusations: number
  hintTiers?: Partial<Record<1 | 2 | 3, number>>
}

export type Progress = {
  v: number
  caseId: string
  mode: GameMode
  case: CaseSnapshot
  /** Snapshots for completed/current cases; `case` remains the current-case compatibility alias. */
  cases?: Record<string, CaseSnapshot>
  /** Where the player stands: zone + world position + yaw. */
  position: { zone: 'abis' | 'city'; x: number; z: number; yaw: number }
  storyMinutes: number
  /** Realistic-mode wrong-accusation penalty in real milliseconds; survives reloads. */
  penaltyMs?: number
  playMs: number
  /** Bookkeeping for the end-of-case report. */
  stats: ProgressStats
  /** Profile-scoped unlocks, shared by every completed case in this save slot. */
  achievements: string[]
  /** The in-story onboarding is shown once per profile, not once per browser. */
  tutorial: { completed: boolean }
}

export type Profile = {
  id: string
  avatar: Avatar
  createdAt: number
  updatedAt: number
  progress: Progress
}

export type ProfileSummary = {
  id: string
  name: string
  mode: GameMode
  updatedAt: number
  evidence: number
  solved: boolean
}

export const HOMES = ['عزبة ١٥ – أبيس', 'العجمي', 'المنتزه', 'سيدي بشر', 'محرم بك'] as const

export function newProgress(mode: GameMode, caseId = 'case01'): Progress {
  const initial: CaseSnapshot = { flags: [], evidence: [], deductions: [], hotspots: [], seenChoices: [] }
  return {
    v: PROGRESS_VERSION, caseId, mode,
    case: initial, cases: { [caseId]: initial },
    position: { zone: 'abis', x: 30, z: 232, yaw: 0 },
    storyMinutes: 0, penaltyMs: 0, playMs: 0, stats: { photos: 0, hints: 0, wrongAccusations: 0, hintTiers: {} },
    achievements: [], tutorial: { completed: false },
  }
}

/**
 * Upgrade any stored progress object to the current version. Unknown/garbled input yields a fresh
 * record rather than throwing so a corrupted slot never bricks the game.
 */
export function migrate(raw: unknown, mode: GameMode = 'story'): Progress {
  if (!raw || typeof raw !== 'object') return newProgress(mode)
  const p = raw as Record<string, unknown>
  let v = typeof p.v === 'number' ? p.v : 1
  const out = p as Record<string, unknown>
  if (v < 2) {
    // v1 stored evidence as a bare id list without discovery stamps and had no stats block.
    const c = (out.case ?? {}) as Record<string, unknown>
    const ev = Array.isArray(c.evidence) ? c.evidence : []
    c.evidence = ev.map(e => (typeof e === 'string' ? { id: e, at: 0 } : e))
    out.case = c
    out.stats = out.stats ?? { photos: 0, hints: 0, wrongAccusations: 0 }
    v = 2
  }
  const caseId = typeof out.caseId === 'string' ? out.caseId : 'case01'
  const base = newProgress((out.mode as GameMode) ?? mode, caseId)
  const c = (out.case ?? {}) as Partial<CaseSnapshot>
  const migratedCase = {
    flags: strings(c.flags), deductions: strings(c.deductions) as CaseSnapshot['deductions'],
    hotspots: strings(c.hotspots), seenChoices: strings(c.seenChoices),
    evidence: Array.isArray(c.evidence) ? c.evidence.filter(e => e && typeof e.id === 'string').map(e => ({ id: e.id, at: Number(e.at) || 0 })) : [],
    offended: Array.isArray(c.offended) ? c.offended.filter(x => x && typeof x.character === 'string').map(x => ({ character: x.character as never, untilEvidence: Number(x.untilEvidence) || 0, untilMinute: Number(x.untilMinute) || 0 })) : [],
  } satisfies CaseSnapshot
  const rawCases = out.cases && typeof out.cases === 'object' ? out.cases as Record<string, unknown> : {}
  const cases: Record<string, CaseSnapshot> = { ...base.cases, [caseId]: migratedCase }
  for (const [id, value] of Object.entries(rawCases)) {
    if (id === caseId || !value || typeof value !== 'object') continue
    const x = value as Partial<CaseSnapshot>
    cases[id] = {
      flags: strings(x.flags), deductions: strings(x.deductions) as CaseSnapshot['deductions'], hotspots: strings(x.hotspots), seenChoices: strings(x.seenChoices),
      evidence: Array.isArray(x.evidence) ? x.evidence.filter(e => e && typeof e.id === 'string').map(e => ({ id: e.id, at: Number(e.at) || 0 })) : [], offended: [],
    }
  }
  const penalty = Number(out.penaltyMs)
  return {
    ...base, ...(out as Partial<Progress>), v: PROGRESS_VERSION,
    penaltyMs: Number.isFinite(penalty) ? Math.min(7 * 86_400_000, Math.max(0, penalty)) : 0,
    case: migratedCase, cases,
    position: { ...base.position, ...((out.position as object) ?? {}) },
    stats: { ...base.stats, ...((out.stats as object) ?? {}) },
    achievements: strings(out.achievements),
    tutorial: { completed: Boolean((out.tutorial as { completed?: unknown } | undefined)?.completed) },
  }
}

const strings = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [])

function cleanAvatar(a: Partial<Avatar>): Avatar {
  const name = (a.name ?? '').replace(/[<>]/g, '').trim().slice(0, 18) || 'ياسين'
  const accent = /^#[0-9a-f]{6}$/i.test(a.accent ?? '') ? a.accent! : '#b3121f'
  return {
    kind: a.kind === 'custom' ? 'custom' : 'yassin', name, gender: a.gender === 'female' ? 'female' : 'male',
    accent, home: (a.home ?? HOMES[0]).slice(0, 40),
  }
}

export class ProfileService {
  private activeId: string | null = null

  constructor(private readonly storage: StorageAdapter, private readonly now: () => number = Date.now) {}

  private readIndex(): string[] {
    try {
      const ids = JSON.parse(this.storage.get(INDEX_KEY) ?? '[]') as unknown
      return strings(ids)
    } catch {
      return []
    }
  }
  private writeIndex(ids: string[]): void {
    this.storage.set(INDEX_KEY, JSON.stringify(ids))
  }

  /** Load one profile (migrating its progress); undefined if absent or unreadable. */
  get(id: string): Profile | undefined {
    try {
      const raw = this.storage.get(profileKey(id))
      if (!raw) return undefined
      const p = JSON.parse(raw) as Profile
      return { ...p, id, avatar: cleanAvatar(p.avatar ?? {}), progress: migrate(p.progress) }
    } catch {
      return undefined
    }
  }

  list(): ProfileSummary[] {
    return this.readIndex().flatMap(id => {
      const p = this.get(id)
      return p
        ? [{ id, name: p.avatar.name, mode: p.progress.mode, updatedAt: p.updatedAt, evidence: p.progress.case.evidence.length, solved: p.progress.case.flags.includes('case_solved') }]
        : []
    })
  }

  get canCreate(): boolean {
    return this.readIndex().length < MAX_PROFILES
  }

  create(avatar: Partial<Avatar>, mode: GameMode): Profile {
    const ids = this.readIndex()
    if (ids.length >= MAX_PROFILES) throw new Error('لا توجد خانات حفظ فارغة')
    const t = this.now()
    const id = `p${t.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
    const profile: Profile = { id, avatar: cleanAvatar(avatar), createdAt: t, updatedAt: t, progress: newProgress(mode) }
    this.storage.set(profileKey(id), JSON.stringify(profile))
    this.writeIndex([...ids, id])
    this.activeId = id
    return profile
  }

  select(id: string): Profile | undefined {
    const p = this.get(id)
    this.activeId = p ? id : null
    return p
  }

  get active(): Profile | undefined {
    return this.activeId ? this.get(this.activeId) : undefined
  }

  /** Union of achievements unlocked in the available save slots. */
  allAchievementIds(): string[] {
    return [...new Set(this.readIndex().flatMap(id => this.get(id)?.progress.achievements ?? []))]
  }

  /** Persist progress for the active profile. */
  save(progress: Progress): void {
    const p = this.active
    if (!p) return
    this.storage.set(profileKey(p.id), JSON.stringify({ ...p, updatedAt: this.now(), progress: { ...progress, v: PROGRESS_VERSION } }))
  }

  delete(id: string): void {
    this.storage.remove(profileKey(id))
    this.writeIndex(this.readIndex().filter(x => x !== id))
    if (this.activeId === id) this.activeId = null
  }

  /** Portable JSON for backup / moving a save between devices. */
  exportProfile(id: string): string | undefined {
    const p = this.get(id)
    return p ? JSON.stringify({ app: 'the-last-thread', format: 1, profile: p }) : undefined
  }

  /** Import a backup into a free slot. Throws a user-readable Arabic message on failure. */
  importProfile(json: string): Profile {
    let doc: { app?: string; profile?: Profile }
    try {
      doc = JSON.parse(json)
    } catch {
      throw new Error('الملف غير صالح')
    }
    if (doc.app !== 'the-last-thread' || !doc.profile?.avatar) throw new Error('هذا ليس ملف حفظ للعبة')
    const created = this.create(doc.profile.avatar, doc.profile.progress?.mode === 'realistic' ? 'realistic' : 'story')
    const progress = migrate(doc.profile.progress)
    this.storage.set(profileKey(created.id), JSON.stringify({ ...created, progress }))
    return { ...created, progress }
  }
}
