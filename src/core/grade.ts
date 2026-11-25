import type { CaseFile, EvidenceId } from '../data/types'
import type { CaseState } from './caseState'

export type GradeLabel = 'ممتاز' | 'جيد جدًا' | 'جيد' | 'مقبول'
export type GradeBreakdown = { label: string; delta: number }
export type GradeResult = {
  grade: GradeLabel
  stars: 1 | 2 | 3 | 4 | 5
  breakdown: GradeBreakdown[]
  missed: EvidenceId[]
}

export type GradeStats = {
  photos: number
  hints: number
  wrongAccusations: number
  /** Number of hints used at each progressive tier. Added without breaking old saves. */
  hintTiers?: Partial<Record<1 | 2 | 3, number>>
}

/**
 * Deterministic case report. Evidence and deductions earn points; photos and careful questioning
 * add bonuses, while hints and false accusations subtract points. The returned missed list is useful
 * to the ending UI and intentionally includes only evidence not found in this case.
 */
export function computeGrade(stats: GradeStats, file: CaseFile, state: Pick<CaseState, 'evidence' | 'deductions'>): GradeResult {
  const found = state.evidence.size
  const evidencePoints = file.evidence.length ? Math.round((found / file.evidence.length) * 55) : 0
  const deductionPoints = file.deductions.length ? Math.round((state.deductions.size / file.deductions.length) * 20) : 0
  const photoPoints = Math.min(10, Math.max(0, stats.photos) * 2)
  const tierCounts = stats.hintTiers ?? {}
  const hintPenalty = (tierCounts[1] ?? 0) * 1 + (tierCounts[2] ?? 0) * 3 + (tierCounts[3] ?? 0) * 6
  const legacyHintPenalty = stats.hintTiers ? 0 : Math.max(0, stats.hints) * 2
  const wrongPenalty = Math.max(0, stats.wrongAccusations) * 8
  const raw = Math.max(0, Math.min(100, evidencePoints + deductionPoints + photoPoints - hintPenalty - legacyHintPenalty - wrongPenalty))
  const stars: 1 | 2 | 3 | 4 | 5 = raw >= 90 ? 5 : raw >= 75 ? 4 : raw >= 58 ? 3 : raw >= 38 ? 2 : 1
  const grade: GradeLabel = stars === 5 ? 'ممتاز' : stars === 4 ? 'جيد جدًا' : stars === 3 ? 'جيد' : 'مقبول'
  const missed = file.evidence.filter(e => !state.evidence.has(e.id)).map(e => e.id)
  return {
    grade, stars, missed,
    breakdown: [
      { label: `الأدلة (${found}/${file.evidence.length})`, delta: evidencePoints },
      { label: `الاستنتاجات (${state.deductions.size}/${file.deductions.length})`, delta: deductionPoints },
      { label: 'الصور', delta: photoPoints },
      { label: 'خصم التلميحات', delta: -(hintPenalty + legacyHintPenalty) },
      { label: 'خصم الاتهامات الغلط', delta: -wrongPenalty },
    ],
  }
}
