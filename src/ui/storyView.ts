/**
 * Story director: shows a cinematic chapter banner once per chapter and tracks which journal
 * pages were unlocked/read. All progress lives in the existing case flags, so it is saved with
 * the profile and never touches clues, deductions or accusation rules.
 */
import { arabicDigits } from '../core/clock'
import { CHAPTERS, JOURNAL, SIDE_QUESTS, type Chapter, type JournalEntry, type SideQuest } from '../data/story'
import { CASE_01 } from '../data/case01'
import { LIFE_CHOICES, dominantPath, pathScores, type LifeChoice } from '../data/life'
import type { Audio } from '../engine/audio'
import type { Session } from '../game/session'
import { h, setChildren } from './dom'

const SHOW_MS = 6200

export type QuestView = { quest: SideQuest; steps: { text: string; done: boolean }[]; done: boolean }
export type Badge = { id: string; title: string; text: string; earned: boolean }

export class StoryDirector {
  readonly el: HTMLElement
  private timer = 0

  constructor(private readonly audio: Audio) {
    this.el = h('aside', { class: 'chapter-banner', hidden: true, role: 'status', 'aria-live': 'polite' })
  }

  /** Index of the highest chapter whose condition matches (the player's current chapter). */
  chapterIndex(session: Session): number {
    let at = 0
    CHAPTERS.forEach((chapter, i) => { if (session.engine.matches(chapter.when)) at = i })
    return at
  }

  current(session: Session): Chapter {
    return CHAPTERS[this.chapterIndex(session)]
  }

  /** Show the banner for a newly reached chapter (earlier ones are marked as seen silently). */
  checkChapter(session: Session): Chapter | undefined {
    const at = this.chapterIndex(session)
    const flag = (c: Chapter) => `ch_seen_${c.id}`
    const fresh = !session.state.flags.has(flag(CHAPTERS[at]))
    const pending = CHAPTERS.slice(0, at + 1).filter(c => !session.state.flags.has(flag(c)))
    if (!pending.length) return undefined
    session.engine.apply(pending.map(c => ({ type: 'flag', id: flag(c) }) as const))
    session.save()
    if (!fresh) return undefined
    this.show(CHAPTERS[at], at)
    return CHAPTERS[at]
  }

  show(chapter: Chapter, index: number): void {
    window.clearTimeout(this.timer)
    this.audio.play('paper')
    this.el.hidden = false
    this.el.classList.remove('out')
    setChildren(this.el,
      h('div', { class: 'chapter-card' },
        h('small', { class: 'chapter-num' }, `الفصل ${arabicDigits(index + 1)} من ${arabicDigits(CHAPTERS.length)}`),
        h('b', { class: 'chapter-title' }, chapter.title),
        h('span', { class: 'chapter-kicker' }, chapter.kicker),
        h('p', null, chapter.text)))
    // Restart the CSS animation when two chapters arrive close together.
    void this.el.offsetWidth
    this.el.classList.add('in')
    this.timer = window.setTimeout(() => {
      this.el.classList.add('out')
      this.timer = window.setTimeout(() => { this.el.hidden = true; this.el.classList.remove('in', 'out') }, 900)
    }, SHOW_MS)
  }

  /** Journal pages that are unlocked. */
  unlocked(session: Session): JournalEntry[] {
    return JOURNAL.filter(entry => session.engine.matches(entry.when))
  }

  /** Newly unlocked journal pages since the last call (flags make this persistent). */
  collectJournal(session: Session): JournalEntry[] {
    const fresh = this.unlocked(session).filter(entry => !session.state.flags.has(`j_seen_${entry.id}`))
    if (!fresh.length) return []
    session.engine.apply(fresh.map(entry => ({ type: 'flag', id: `j_seen_${entry.id}` }) as const))
    session.save()
    return fresh
  }

  unreadCount(session: Session): number {
    return this.unlocked(session).filter(entry => !session.state.flags.has(`j_read_${entry.id}`)).length
  }

  markRead(session: Session): void {
    const unread = this.unlocked(session).filter(entry => !session.state.flags.has(`j_read_${entry.id}`))
    if (!unread.length) return
    session.engine.apply(unread.map(entry => ({ type: 'flag', id: `j_read_${entry.id}` }) as const))
    session.save()
  }

  /** Life choices made since the last call (persisted through flags). */
  collectChoices(session: Session): LifeChoice[] {
    const fresh = LIFE_CHOICES.filter(choice => session.state.flags.has(choice.flag) && !session.state.flags.has(`lc_seen_${choice.flag}`))
    if (!fresh.length) return []
    session.engine.apply(fresh.map(choice => ({ type: 'flag', id: `lc_seen_${choice.flag}` }) as const))
    session.save()
    return fresh
  }

  hide(): void {
    window.clearTimeout(this.timer)
    this.el.hidden = true
    this.el.classList.remove('in', 'out')
  }

  /** Side quests whose tracker row is visible, with step status. */
  quests(session: Session): QuestView[] {
    return SIDE_QUESTS.filter(quest => session.engine.matches(quest.visible)).map(quest => {
      const steps = quest.steps.map(step => ({ text: step.text, done: session.engine.matches(step.when) }))
      return { quest, steps, done: steps.every(step => step.done) }
    })
  }

  /** Quests completed since the last call (persisted with flags). */
  collectQuests(session: Session): SideQuest[] {
    const fresh = this.quests(session).filter(q => q.done && !session.state.flags.has(`q_done_${q.quest.id}`)).map(q => q.quest)
    if (!fresh.length) return []
    session.engine.apply(fresh.map(quest => ({ type: 'flag', id: `q_done_${quest.id}` }) as const))
    session.save()
    return fresh
  }

  /** Light-weight achievements derived from the current save (nothing extra is stored). */
  badges(session: Session): Badge[] {
    const quests = this.quests(session)
    const allQuests = SIDE_QUESTS.every(quest => quests.find(q => q.quest.id === quest.id)?.done)
    return [
      { id: 'b_eye', title: 'عين الصقر', text: 'اجمع كل أدلة القضية.', earned: session.state.evidence.size >= CASE_01.evidence.length },
      { id: 'b_threads', title: 'سيّد الخيوط', text: 'اربط كل الاستنتاجات.', earned: session.state.deductions.size >= CASE_01.deductions.length },
      { id: 'b_stories', title: 'صاحب الحكايات', text: 'أنهِ كل المهام الجانبية.', earned: allQuests },
      { id: 'b_diary', title: 'قارئ اليوميات', text: 'افتح كل صفحات اليوميات.', earned: this.unlocked(session).length >= JOURNAL.length },
      { id: 'b_path', title: 'اخترت طريقك', text: 'ابنِ سمعة قوية في طريق واحد (٦ نقاط).', earned: (() => { const p = dominantPath(session.state.flags); return !!p && pathScores(session.state.flags)[p] >= 6 })() },
      { id: 'b_fair', title: 'حكم عادل', text: 'اقفل القضية من غير اتهام خاطئ.', earned: session.state.flags.has('case_solved') && session.progress.stats.wrongAccusations === 0 },
    ]
  }
}
