import { describe, expect, it } from 'vitest'
import { HintService, type HintProvider } from '../src/services/hints'
import { ArEngine, GeoFenceProvider, WorldCameraProvider, checkPhotoQuality, createArEngine, haversineM, type ArTarget } from '../src/services/ar'
import { MAX_PROFILES, PROGRESS_VERSION, ProfileService, migrate, newProgress } from '../src/services/profiles'
import { MemoryStorage } from '../src/services/storage'
import { parseSettings, SettingsStore } from '../src/engine/save'
import { PLACES } from '../src/data/places'

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
    expect(m.stats.photos).toBe(0)
    expect(migrate('nonsense').v).toBe(PROGRESS_VERSION)
    expect(migrate({ case: { flags: [1, 'x'] } }).case.flags).toEqual(['x'])
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

describe('AR engine', () => {
  const lib = PLACES.bibliotheca
  const target: ArTarget = { id: 'bibliotheca', label: lib.name, x: lib.pos.x, z: lib.pos.z, geo: lib.geo }
  const world = (x: number, z: number, dirX: number, dirZ: number) => ({ kind: 'world' as const, x, z, dirX, dirZ, fovDeg: 62 })

  it('haversine matches known real distance (Bibliotheca ↔ Qaitbay ≈ 2.3 km)', () => {
    const d = haversineM(PLACES.bibliotheca.geo!, PLACES.qaitbay.geo!)
    expect(d).toBeGreaterThan(2000)
    expect(d).toBeLessThan(2600)
  })
  it('world camera: looking at the landmark from range succeeds, wrong direction or distance fails', async () => {
    const engine = createArEngine()
    expect((await engine.verify(target, world(lib.pos.x, lib.pos.z + 50, 0, -1))).ok).toBe(true)
    expect((await engine.verify(target, world(lib.pos.x, lib.pos.z + 50, 0, 1))).ok).toBe(false)
    expect((await engine.verify(target, world(lib.pos.x, lib.pos.z + 500, 0, -1))).message).toContain('بعيد')
    expect((await engine.verify(target, world(lib.pos.x, lib.pos.z + 2, 0, -1))).message).toContain('قريب')
  })
  it('real photo: accepted inside the GPS fence, rejected far away or without GPS', async () => {
    const engine = new ArEngine([new GeoFenceProvider()])
    const near = await engine.verify(target, { kind: 'photo', gps: { ...lib.geo!, accuracyM: 20 } })
    expect(near).toMatchObject({ ok: true, needsServer: true })
    const far = await engine.verify(target, { kind: 'photo', gps: { lat: 30.0, lng: 31.2 } })
    expect(far.ok).toBe(false)
    expect((await engine.verify(target, { kind: 'photo' })).message).toContain('GPS')
  })
  it('rejects dark or flat images before verification', () => {
    const dark = { width: 16, height: 16, luma: new Uint8ClampedArray(256).fill(5) }
    expect(checkPhotoQuality(dark)).toContain('معتمة')
    const flat = { width: 16, height: 16, luma: new Uint8ClampedArray(256).fill(120) }
    expect(checkPhotoQuality(flat)).toContain('مش واضحة')
    const noisy = { width: 16, height: 16, luma: Uint8ClampedArray.from({ length: 256 }, (_, i) => (i % 2 ? 60 : 180)) }
    expect(checkPhotoQuality(noisy)).toBeUndefined()
  })
  it('world provider limits are configurable', async () => {
    const p = new WorldCameraProvider(5, 30)
    expect((await p.verify(target, world(target.x, target.z + 40, 0, -1))).ok).toBe(false)
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
  it('sanitises stored data', () => {
    const s = parseSettings(JSON.stringify({ musicVolume: 9, quality: 'ultra', hintEndpoint: 'javascript:alert(1)', visionEndpoint: 'https://x.test/v', sensitivity: 'a' }))
    expect(s.musicVolume).toBe(1)
    expect(s.quality).toBe('medium')
    expect(s.hintEndpoint).toBe('')
    expect(s.visionEndpoint).toBe('https://x.test/v')
    expect(s.sensitivity).toBe(1)
    expect(parseSettings('{{')).toEqual(parseSettings(null))
  })
  it('stores updates and reports first run', () => {
    const st = new MemoryStorage()
    const store = new SettingsStore(st)
    expect(store.firstRun).toBe(true)
    store.update({ muted: true })
    expect(new SettingsStore(st).data.muted).toBe(true)
    expect(store.firstRun).toBe(false)
  })
})
