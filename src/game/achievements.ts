import type { GradeLabel } from '../core/grade'
import type { ProgressStats } from '../services/profiles'

export type AchievementContext = {
  caseId: string
  solved: boolean
  mode: 'story' | 'realistic'
  grade?: GradeLabel
  evidenceFound: number
  evidenceTotal: number
  photoEvidenceFound: number
  photoEvidenceTotal: number
  deductionsFound: number
  deductionsTotal: number
  talkedTo: number
  charactersTotal: number
  correctConfrontations: number
  secretsUnlocked: number
  secretsTotal: number
  pastUnlocked: number
  pastTotal: number
  storyMinutes: number
  solvedCaseIds: string[]
  flags: ReadonlySet<string>
  stats: ProgressStats
}

export type Achievement = {
  id: string
  title: string
  description: string
  icon: string
  test: (context: AchievementContext) => boolean
}

const solved = (c: AchievementContext) => c.solved

/** Definitions are deliberately based on capabilities/counts, not case IDs, so case03 can opt in. */
export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first_thread', title: 'أول خيط', description: 'اجمع أول دليل في أي قضية.', icon: '∿', test: c => c.evidenceFound > 0 },
  { id: 'red_thread', title: 'شبكة الخيوط', description: 'اربط كل الاستنتاجات في قضية.', icon: '⟡', test: c => solved(c) && c.deductionsTotal > 0 && c.deductionsFound >= c.deductionsTotal },
  { id: 'eagle_eye', title: 'عين صقر', description: 'اعثر على كل الأدلة في القضية.', icon: '◉', test: c => solved(c) && c.evidenceTotal > 0 && c.evidenceFound >= c.evidenceTotal },
  { id: 'shutterbug', title: 'عين الإسكندرية', description: 'صوّر كل الأدلة الفوتوغرافية في القضية.', icon: '▣', test: c => solved(c) && c.photoEvidenceTotal > 0 && c.photoEvidenceFound >= c.photoEvidenceTotal },
  { id: 'quiet_method', title: 'من غير غش', description: 'حل قضية من غير ما تستخدم تلميح.', icon: '◇', test: c => solved(c) && c.stats.hints === 0 },
  { id: 'clean_record', title: 'سجل نضيف', description: 'حل قضية من غير اتهام غلط.', icon: '✓', test: c => solved(c) && c.stats.wrongAccusations === 0 },
  { id: 'master_interrogator', title: 'كل الوجوه', description: 'اتكلم مع كل الشخصيات في القضية.', icon: '◌', test: c => solved(c) && c.charactersTotal > 0 && c.talkedTo >= c.charactersTotal },
  { id: 'confrontation', title: 'في وشّ الحقيقة', description: 'استخدم المواجهة الصحيحة ٣ مرات.', icon: '!', test: c => c.correctConfrontations >= 3 },
  { id: 'secrets', title: 'ما بين السطور', description: 'افتح كل الأسرار في القضية.', icon: '▤', test: c => solved(c) && c.secretsTotal > 0 && c.secretsUnlocked >= c.secretsTotal },
  { id: 'past_unlocked', title: 'ماضي الناس', description: 'افتح كل صفحات الماضي في القضية.', icon: '◍', test: c => solved(c) && c.pastTotal > 0 && c.pastUnlocked >= c.pastTotal },
  { id: 'perfect_grade', title: 'الخيط كامل', description: 'اختم القضية بتقدير ممتاز.', icon: '★', test: c => solved(c) && c.grade === 'ممتاز' },
  { id: 'fast_case', title: 'قبل ما يبرد الأثر', description: 'حل القضية في أقل من ٣ ساعات داخل اللعبة.', icon: '◷', test: c => solved(c) && c.storyMinutes < 180 },
  { id: 'case02_complete', title: 'ما بعد أبيس', description: 'خلّص القضية التانية.', icon: '↗', test: c => c.solvedCaseIds.includes('case02') },
  { id: 'realistic_solver', title: 'على الميعاد', description: 'حل قضية في الوضع الواقعي.', icon: '⌖', test: c => solved(c) && c.mode === 'realistic' },
  { id: 'two_cases', title: 'ملفّين مفتوحين', description: 'حل قضيتين على الأقل.', icon: 'Ⅱ', test: c => c.solvedCaseIds.length >= 2 },
]

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id)
}

export function evaluateAchievements(context: AchievementContext, alreadyUnlocked: readonly string[] = []): Achievement[] {
  const known = new Set(alreadyUnlocked)
  return ACHIEVEMENTS.filter(a => !known.has(a.id) && a.test(context))
}

export function achievementContext(input: Omit<AchievementContext, 'solved' | 'grade'> & { solved?: boolean; grade?: GradeLabel }): AchievementContext {
  return { ...input, solved: Boolean(input.solved), grade: input.grade }
}
