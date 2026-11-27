import { MAIN_REGIONS, MEMORY_CHAPTERS, MEMORY_PLACES, PHASES, type MemoryChapter, type MemoryPlace } from '../data/memoryWorld'
import type { StorageAdapter } from '../services/storage'

const SAVE_KEY = 'ltt:yassin-memory-campaign:v1'
type Verdict = 'credit' | 'privacy'
type Save = { version: 1; location: number; clues: number[]; witnesses: number[]; verdict?: Verdict }

export class MemoryCampaign {
  private readonly clues = new Set<number>()
  private readonly witnesses = new Set<number>()
  location = 0
  verdict?: Verdict

  constructor(private readonly storage: StorageAdapter) {
    try {
      const saved: Partial<Save> = JSON.parse(storage.get(SAVE_KEY) ?? '{}') ?? {}
      if (saved.version !== 1) return
      // Rebuild in phase order so an incomplete or partially written save stays playable.
      const savedClues = new Set(Array.isArray(saved.clues) ? saved.clues : [])
      const savedWitnesses = new Set(Array.isArray(saved.witnesses) ? saved.witnesses : [])
      for (let phase = 0; phase < PHASES.length && phase <= this.stage; phase++) {
        for (const chapter of MEMORY_CHAPTERS.filter(c => c.phase === phase)) {
          for (const place of chapter.sites) if (savedClues.has(place.id)) this.clues.add(place.id)
          for (const witness of chapter.witnesses) if (savedWitnesses.has(witness.id) && this.canQuestion(chapter, witness.id)) this.witnesses.add(witness.id)
        }
      }
      if (typeof saved.location === 'number' && MEMORY_PLACES[saved.location]) this.location = saved.location
      if (this.ready && (saved.verdict === 'credit' || saved.verdict === 'privacy')) this.verdict = saved.verdict
    } catch {
      // A corrupt save can be replaced on the next interaction.
    }
  }

  get stage(): number {
    const index = MAIN_REGIONS.findIndex((regions, phase) => regions.some(area => !this.confirmed(MEMORY_CHAPTERS[area * PHASES.length + phase])))
    return index === -1 ? PHASES.length : index
  }
  get ready(): boolean { return this.stage === PHASES.length }
  get clueCount(): number { return this.clues.size }
  get witnessCount(): number { return this.witnesses.size }
  get confirmedCount(): number { return this.witnesses.size === 0 ? 0 : MEMORY_CHAPTERS.filter(chapter => this.confirmed(chapter)).length }
  mainLeads(phase = this.stage): MemoryChapter[] {
    return (MAIN_REGIONS[phase] ?? []).map(area => MEMORY_CHAPTERS[area * PHASES.length + phase])
  }
  identified(place: MemoryPlace): boolean { return this.clues.has(place.id) }
  checked(witnessId: number): boolean { return this.witnesses.has(witnessId) }
  confirmed(chapter: MemoryChapter): boolean { return chapter.witnesses.every(w => this.checked(w.id)) }
  unlocked(chapter: MemoryChapter): boolean { return chapter.phase <= this.stage }
  missing(chapter: MemoryChapter, witnessId: number): MemoryPlace[] {
    const witness = chapter.witnesses.find(w => w.id === witnessId)
    return (witness?.needs ?? []).map(slot => chapter.sites[slot]).filter(place => !this.identified(place))
  }
  canQuestion(chapter: MemoryChapter, witnessId: number): boolean {
    const index = chapter.witnesses.findIndex(w => w.id === witnessId)
    return index >= 0 && this.unlocked(chapter) && this.missing(chapter, witnessId).length === 0
      && (index === 0 || this.checked(chapter.witnesses[0].id))
  }
  visit(place: MemoryPlace): void {
    this.location = place.id
    this.save()
  }
  inspect(place: MemoryPlace): boolean {
    if (this.location !== place.id || !this.unlocked(MEMORY_CHAPTERS[place.chapter]) || this.identified(place)) return false
    this.clues.add(place.id)
    this.save()
    return true
  }
  substantiate(chapter: MemoryChapter, witnessId: number, slot: number): boolean {
    const witness = chapter.witnesses.find(w => w.id === witnessId)
    if (!witness || witness.correctSlot !== slot || !this.canQuestion(chapter, witnessId) || this.checked(witnessId)) return false
    this.witnesses.add(witnessId)
    this.save()
    return true
  }
  conclude(verdict: Verdict): boolean {
    if (!this.ready || this.verdict) return false
    this.verdict = verdict
    this.save()
    return true
  }
  private save(): void {
    const save: Save = { version: 1, location: this.location, clues: [...this.clues], witnesses: [...this.witnesses], verdict: this.verdict }
    this.storage.set(SAVE_KEY, JSON.stringify(save))
  }
}
