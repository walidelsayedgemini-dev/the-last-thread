import { describe, expect, it } from 'vitest'
import { HintService, type HintProvider } from '../src/services/hints'
import { MAX_PROFILES, PROGRESS_VERSION, ProfileService, migrate, newProgress } from '../src/services/profiles'
import { MemoryStorage } from '../src/services/storage'
import { dialogueSpeedRate, parseSettings, rootFontSize, SettingsStore } from '../src/engine/save'
import { CrashReporter } from '../src/services/crash'

describe('ProfileService', () => {
  it('creates, saves, lists and reloads profiles', () => {
    const storage = new MemoryStorage()
    const svc = new ProfileService(storage, () => 1000)
    const p = svc.create({ kind: 'custom', name: ' سلمى<b> ', gender: 'female', accent: '#ff0000', home: 'العجمي' }, 'realistic')
    expect(p.avatar.name).toBe('سلمىb')
    const progress = newProgress('realistic')
    progress.case.flags.push('has_key')
    svc.save(progress)
    const again = new ProfileService(storage)
    expect(again.list()).toHaveLength(1)
    expect(again.select(p.id)!.progress.case.flags).toContain('has_key')
    expect(again.list()[0]).toMatchObject({ name: 'سلمىb', mode: 'realistic', evidence: 0, solved: false })
  })
  it('limits slots and deletes', () => {
    const svc = new ProfileService(new MemoryStorage())
    for (let i = 0; i < MAX_PROFILES; i++) svc.create({}, 'story')
    expect(svc.canCreate).toBe(false)
    expect(() => svc.create({}, 'story')).toThrow()
    svc.delete(svc.list()[0].id)
    expect(svc.canCreate).toBe(true)
  })
  it('migrates v1 progress and survives garbage', () => {
    const v1 = { v: 1, caseId: 'case01', mode: 'story', case: { flags: ['a'], evidence: ['e_thread_door'], deductions: [], hotspots: [], seenChoices: [] } }
    const m = migrate(v1)
    expect(m.v).toBe(PROGRESS_VERSION)
    expect(m.case.evidence).toEqual([{ id: 'e_thread_door', at: 0 }])
    expect(m.case.reviewedEvidence).toEqual([])
    expect(m.case.threads).toBeUndefined()
    expect(m.stats.photos).toBe(0)
    expect(migrate('nonsense').v).toBe(PROGRESS_VERSION)
    expect(migrate({ case: { flags: [1, 'x'] } }).case.flags).toEqual(['x'])
  })
  it('migrates reviewed-evidence markers independently for every case', () => {
    const migrated = migrate({
      v: 5, caseId: 'case01', mode: 'story',
      case: { flags: [], evidence: [], deductions: [], hotspots: [], seenChoices: [], reviewedEvidence: ['e_thread_door'] },
      cases: { case02: { flags: [], evidence: [], deductions: [], hotspots: [], seenChoices: [], reviewedEvidence: ['e02_black_envelope'] } },
    })
    expect(migrated.case.reviewedEvidence).toEqual(['e_thread_door'])
    expect(migrated.cases?.case02.reviewedEvidence).toEqual(['e02_black_envelope'])
  })
  it('migrates the discovered case log per case and drops malformed entries', () => {
    const migrated = migrate({
      v: 7, caseId: 'case01', mode: 'story',
      case: {
        flags: [], evidence: [], deductions: [], hotspots: [], seenChoices: [],
        caseLog: [
          { kind: 'dialogue', id: 'zeinab', at: 1200, hour: 26, place: 'zeinab_home' },
          { kind: 'evidence', id: 'e_thread_door', at: 'now', hour: 8 },
          { kind: 'hidden-answer', id: 'future_solution', at: 1200, hour: 8 },
        ],
      },
      cases: {
        case02: {
          flags: [], evidence: [], deductions: [], hotspots: [], seenChoices: [],
          caseLog: [{ kind: 'evidence', id: 'e02_black_envelope', at: 3400, hour: 9, place: 'abis_market' }],
        },
      },
    })
    expect(migrated.case.caseLog).toEqual([{ kind: 'dialogue', id: 'zeinab', at: 1200, hour: 2, place: 'zeinab_home' }])
    expect(migrated.cases?.case02.caseLog).toEqual([{ kind: 'evidence', id: 'e02_black_envelope', at: 3400, hour: 9, place: 'abis_market' }])
  })
  it('migrates exact thread pairs while leaving legacy pair data absent for safe reconstruction', () => {
    const legacy = migrate({ v: 6, case: { flags: [], deductions: ['d_trail'], evidence: [], hotspots: [], seenChoices: [] } })
    expect(legacy.case.threads).toBeUndefined()
    const migrated = migrate({
      v: 6,
      case: {
        flags: [], deductions: ['d_trail'], evidence: [], hotspots: [], seenChoices: [],
        threads: [{ deduction: 'd_trail', pair: ['e_thread_door', 'e_qaitbay_photo'] }],
      },
    })
    expect(migrated.case.threads).toEqual([{ deduction: 'd_trail', pair: ['e_thread_door', 'e_qaitbay_photo'] }])
  })
  it('exports and imports a profile, rejecting foreign files', () => {
    const a = new ProfileService(new MemoryStorage())
    const p = a.create({ name: 'ياسين' }, 'story')
    const json = a.exportProfile(p.id)!
    const b = new ProfileService(new MemoryStorage())
    expect(b.importProfile(json).avatar.name).toBe('ياسين')
    expect(b.list()).toHaveLength(1)
    expect(() => b.importProfile('{"x":1}')).toThrow('ليس ملف حفظ')
    expect(() => b.importProfile('not json')).toThrow('غير صالح')
  })
})

describe('HintService', () => {
  let now = 0
  const ctx = { objectiveId: 'o_zeinab', objectiveTitle: 't', objectiveDetail: 'd', evidenceTitles: [] }
  it('escalates tiers with a cooldown and offline fallback', async () => {
    const svc = new HintService(undefined, undefined, 4000, () => now)
    const h1 = await svc.request(ctx)
    expect(h1).toMatchObject({ source: 'local', tier: 1 })
    expect(await svc.request(ctx)).toEqual({ wait: 4 })
    now += 5000
    expect(await svc.request(ctx)).toMatchObject({ tier: 2 })
    now += 5000
    await svc.request(ctx)
    now += 5000
    expect(await svc.request(ctx)).toMatchObject({ tier: 3 })
  })
  it('uses the remote provider and falls back when it fails', async () => {
    now = 0
    const remote: HintProvider = { name: 'r', hint: async () => 'تلميح ذكي' }
    const svc = new HintService(undefined, remote, 0, () => now)
    expect(await svc.request(ctx)).toMatchObject({ source: 'remote', text: 'تلميح ذكي' })
    svc.setRemote({ name: 'r', hint: async () => { throw new Error('timeout') } })
    expect(await svc.request(ctx)).toMatchObject({ source: 'local' })
  })
})

describe('settings', () => {
  it('maps each dialogue-speed setting to a distinct readable pacing value', () => {
    expect(dialogueSpeedRate('slow')).toBe(24)
    expect(dialogueSpeedRate('normal')).toBe(48)
    expect(dialogueSpeedRate('fast')).toBe(96)
    expect(dialogueSpeedRate('instant')).toBe('instant')
  })

  it('maps the selected text size to a larger rendered root font size', () => {
    expect(rootFontSize({ textSize: 'normal', textScale: 1 })).toBe(16)
    expect(rootFontSize({ textSize: 'large', textScale: 1 })).toBe(20)
    expect(rootFontSize({ textSize: 'xlarge', textScale: 1 })).toBe(22)
    expect(rootFontSize({ textSize: 'large', textScale: 1.2 })).toBe(24)
  })

  it('sanitises stored data', () => {
    const s = parseSettings(JSON.stringify({ musicVolume: 9, hintEndpoint: 'javascript:alert(1)', eventsUrl: 'https://x.test/e', textScale: 7 }))
    expect(s.musicVolume).toBe(1)
    expect(s.hintEndpoint).toBe('')
    expect(s.eventsUrl).toBe('https://x.test/e')
    expect(s.textScale).toBe(1.4)
    expect(s.dialogueSpeed).toBe('normal')
    expect(parseSettings(JSON.stringify({ dialogueSpeed: 'fast' })).dialogueSpeed).toBe('fast')
    expect(parseSettings(JSON.stringify({ dialogueSpeed: 'warp' })).dialogueSpeed).toBe('normal')
    expect(parseSettings('{{')).toEqual(parseSettings(null))
  })
  it('stores updates', () => {
    const st = new MemoryStorage()
    const store = new SettingsStore(st)
    store.update({ muted: true, dialogueSpeed: 'slow' })
    expect(new SettingsStore(st).data.muted).toBe(true)
    expect(new SettingsStore(st).data.dialogueSpeed).toBe('slow')
  })
})

describe('CrashReporter', () => {
  it('keeps a bounded local ring buffer and stays disabled by default', () => {
    const storage = new MemoryStorage()
    const reporter = new CrashReporter(storage)
    for (let i = 0; i < 15; i++) reporter.capture({ kind: 'error', message: `error-${i}` })
    expect(reporter.records).toHaveLength(12)
    expect(reporter.records[0].message).toBe('error-3')
    expect(reporter.records.at(-1)?.message).toBe('error-14')
    reporter.dispose()
  })
})
