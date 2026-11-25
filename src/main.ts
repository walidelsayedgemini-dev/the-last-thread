import './styles/main.css'
import './styles/investigation.css'
import './styles/dialogue.css'
import './styles/overhaul.css'
import { arabicDigits, cairoStamp, nowFromQuery } from './core/clock'
import type { CaseEvent } from './core/caseState'
import { CHARACTER_LIST } from './data/characters'
import { PLACE_LIST, PLACES } from './data/places'
import type { CharacterId, Hotspot, PlaceId } from './data/types'
import { Audio } from './engine/audio'
import { GameLoop } from './engine/loop'
import { SettingsStore, type Settings } from './engine/save'
import { Session } from './game/session'
import { haptic, onBackButton } from './services/native'
import { EventsDb, JsonUrlProvider, type EventsDocument } from './services/eventsDb'
import { HintService, RemoteChatProvider } from './services/hints'
import { ProfileService, type Profile } from './services/profiles'
import { LocalStorageAdapter, MemoryStorage } from './services/storage'
import { CaseFileView } from './ui/casefile'
import { DialogueView } from './ui/dialogueView'
import { Hud } from './ui/hud'
import { InvestigationView } from './ui/investigation'
import { Shell } from './ui/shell'

const SEED_FALLBACK: EventsDocument = { schemaVersion: 1, version: 0, events: [] }

async function loadSeed(): Promise<EventsDocument> {
  try {
    const res = await fetch(new URL('data/events.json', document.baseURI))
    if (res.ok) return (await res.json()) as EventsDocument
  } catch {
    // Offline first run: the cached copy (if any) still loads in EventsDb.init.
  }
  return SEED_FALLBACK
}

function nearestPlace(zone: 'abis' | 'city', x: number, z: number): PlaceId {
  const candidates = PLACE_LIST.filter(place => place.district === zone)
  const closest = candidates.sort((a, b) => Math.hypot(a.pos.x - x, a.pos.z - z) - Math.hypot(b.pos.x - x, b.pos.z - z))[0]
  return closest?.id ?? (zone === 'city' ? 'raml_stop' : 'zeinab_home')
}

async function boot(): Promise<void> {
  const ui = document.getElementById('ui')!
  const splash = document.getElementById('splash')
  // `?autostart` (tests/demos) runs on throwaway memory storage so it can never touch real saves.
  const auto = new URLSearchParams(location.search).get('autostart')
  const storage = auto === 'story' || auto === 'realistic' ? new MemoryStorage() : new LocalStorageAdapter()
  const settings = new SettingsStore(storage)
  const profiles = new ProfileService(storage)
  const now = nowFromQuery(location.search, () => cairoStamp(new Date()))
  const audio = new Audio()

  // ---- Services -------------------------------------------------------------------------------------------------
  const events = new EventsDb(storage, settings.data.eventsUrl ? [new JsonUrlProvider('custom', settings.data.eventsUrl)] : [])
  const hints = new HintService(undefined, settings.data.hintEndpoint ? new RemoteChatProvider(settings.data.hintEndpoint) : undefined)

  let session: Session | undefined
  let loopRef: GameLoop | undefined
  let unsubscribeCase: (() => void) | undefined
  let currentPlace: PlaceId = 'zeinab_home'
  let active = false
  let paused = false
  let saveTimer = 0
  let endingTimer = 0

  const applySettings = (d: Settings) => {
    audio.setVolumes(d.musicVolume, d.sfxVolume, d.muted)
    document.body.classList.toggle('reduced-motion', d.reducedMotion)
    document.body.classList.toggle('high-contrast', d.highContrast)
    document.documentElement.style.setProperty('--text-scale', String(d.textScale))
    document.documentElement.style.fontSize = `${Math.round(16 * Math.min(1.2, d.textScale))}px`
  }
  const MUSIC = {
    title: new URL('audio/title.mp3', document.baseURI).href,
    abis: new URL('audio/abis.mp3', document.baseURI).href,
    city: new URL('audio/city.mp3', document.baseURI).href,
  }
  const musicFor = (id: PlaceId) => (PLACES[id]?.district === 'city' ? MUSIC.city : MUSIC.abis)

  // ---- 2D investigation UI -------------------------------------------------------------------------------------
  const dialogue = new DialogueView(audio, text => session?.fill(text) ?? text)
  const hud = new Hud()
  const caseFile = new CaseFileView({
    audio, events,
    onClose: () => undefined,
    onAccused: result => {
      if (result === 'ok') { haptic('success'); caseFile.close(); scheduleEnding(); return }
      if (result === 'wrong-culprit' || result === 'wrong-motive') {
        audio.play('wrong')
        haptic('error')
        hud.toast('اتهام غلط: الشخص اتضايق، والساعة عدّت، والتقدير اتخصم منه.', 'warn')
        investigation.refresh()
      }
    },
  })
  const investigation = new InvestigationView({
    audio,
    onHotspot: hotspot => handleHotspot(hotspot),
    onTalk: id => beginDialogue(id),
    onPlaceChange: id => persistPlace(id),
    onCaseFile: () => openCaseFile(),
    onHint: () => void askHint(),
    onPause: () => pause(),
  })

  const shell = new Shell({ settings, profiles, events, audio, now }, {
    play: id => void beginProfile(profiles.select(id)),
    create: (avatar, mode) => void beginProfile(profiles.create(avatar, mode), 'force'),
    resume: () => resume(),
    quit: () => quit(),
    casefile: () => { shell.go('none'); openCaseFile() },
    settings: patch => {
      settings.update(patch)
      applySettings(settings.data)
      if ('hintEndpoint' in patch) hints.setRemote(settings.data.hintEndpoint ? new RemoteChatProvider(settings.data.hintEndpoint) : undefined)
    },
    startWorld: () => startWorld(),
    nextCase: () => startNextCase(),
  })
  ui.append(shell.el, investigation.el, hud.el, dialogue.el, caseFile.el)
  applySettings(settings.data)

  // ---- Boot ----------------------------------------------------------------------------------------------------
  splash?.remove()
  shell.setBootProgress(0.12)
  // The title theme starts on the first gesture (browsers block autoplay before that).
  const startTitleMusic = () => { audio.unlock(); if (!active) audio.playMusic(MUSIC.title, { loop: true }) }
  window.addEventListener('pointerdown', startTitleMusic, { once: true })
  window.addEventListener('keydown', startTitleMusic, { once: true })
  const seedPromise = loadSeed()
  await document.fonts.ready
  shell.setBootProgress(0.58)
  events.init(await seedPromise)
  void events.refresh()
  shell.setBootProgress(1)

  // ---- Flow ----------------------------------------------------------------------------------------------------
  const deps = () => ({ events, profiles, hints, now })

  async function beginProfile(profile: Profile | undefined, intro: 'auto' | 'force' | 'skip' = 'auto'): Promise<void> {
    if (!profile) return
    audio.unlock()
    shell.go('none')
    unsubscribeCase?.()
    session = new Session(profile, deps())
    currentPlace = nearestPlace(session.progress.position.zone, session.progress.position.x, session.progress.position.z)
    unsubscribeCase = session.onCase(handleCaseEvents)
    audio.startAmbience()
    const fresh = intro === 'force' || (intro === 'auto' && session.state.evidence.size === 0 && session.progress.playMs < 1000)
    if (fresh) shell.showIntro(session)
    else startWorld()
  }

  function startWorld(): void {
    if (!session) return
    shell.el.onclick = null
    shell.go('none')
    paused = false
    active = true
    investigation.show(session, currentPlace)
    hud.show(true)
    audio.playMusic(musicFor(currentPlace), { loop: true })
    loopRef?.resetAccumulator()
  }

  function startNextCase(): void {
    if (!session) return
    const next = session.nextCaseId()
    if (!next || !session.startCase(next)) return
    window.clearTimeout(endingTimer)
    const first = session.caseFile.hotspots[0]?.place ?? 'zeinab_home'
    currentPlace = first
    const place = PLACES[first]
    session.setPosition(place.district, place.pos.x, place.pos.z, 0)
    session.save()
    unsubscribeCase?.()
    unsubscribeCase = session.onCase(handleCaseEvents)
    shell.showIntro(session)
  }

  function persistPlace(id: PlaceId): void {
    if (!session) return
    const place = PLACES[id]
    const before = PLACES[currentPlace]?.district
    currentPlace = id
    session.setPosition(place.district, place.pos.x, place.pos.z, 0)
    session.save()
    if (before !== place.district) audio.playMusic(musicFor(id), { loop: true })
    hud.hideNarration()
  }

  function openCaseFile(): void {
    if (!session || !active) return
    if (paused) {
      paused = false
      shell.go('none')
      loopRef?.resetAccumulator()
    }
    caseFile.show(session)
  }

  function pause(): void {
    if (!active || paused) return
    paused = true
    shell.go('pause')
    audio.play('ui')
  }

  function resume(): void {
    if (shell.screen === 'ending') {
      startWorld()
      return
    }
    if (!paused) return
    paused = false
    shell.go('none')
    loopRef?.resetAccumulator()
    investigation.refresh()
  }

  function quit(): void {
    window.clearTimeout(endingTimer)
    if (dialogue.open) dialogue.close()
    caseFile.el.hidden = true
    session?.save()
    unsubscribeCase?.()
    unsubscribeCase = undefined
    audio.stopAmbience()
    audio.playMusic(MUSIC.title, { loop: true })
    hud.show(false)
    investigation.hide()
    active = false
    paused = false
    session = undefined
    shell.el.onclick = null
    shell.go('title')
  }

  function scheduleEnding(): void {
    window.clearTimeout(endingTimer)
    endingTimer = window.setTimeout(() => {
      if (!session) return
      audio.play('solved')
      audio.playMusic(MUSIC.title, { loop: true })
      active = false
      paused = false
      caseFile.el.hidden = true
      hud.show(false)
      investigation.hide()
      shell.showEnding(session)
    }, 900)
  }

  function handleCaseEvents(changes: CaseEvent[]): void {
    for (const change of changes) {
      if (change.type === 'evidence') {
        audio.play('found')
        haptic('medium')
        investigation.celebrate(change.evidence)
        hud.toast(`دليل جديد: ${change.evidence.title}`, 'evidence')
      } else if (change.type === 'evidence-gated') {
        hud.toast(change.reason ?? 'الدليل ده لسه ماظهرش… ارجع في وقت تاني.', 'warn')
      } else if (change.type === 'deduction') {
        audio.play('deduction')
        haptic('success')
        hud.toast('ربطت خيط جديد!', 'deduction')
      }
    }
    caseFile.refresh()
    investigation.refresh()
    if (changes.some(change => change.type === 'flag' && change.id === 'case_solved')) scheduleEnding()
  }

  function handleHotspot(hotspot: Hotspot): void {
    if (!session || !active || paused) return
    audio.play('ui')
    if (hotspot.text) hud.narrate(session.fill(hotspot.text))
    if (hotspot.kind === 'travel' && hotspot.to) {
      session.useHotspot(hotspot)
      investigation.setPlace(hotspot.to)
      return
    }
    if (hotspot.kind === 'photo') {
      const changes = session.useHotspot(hotspot)
      if (changes.some(change => change.type === 'evidence')) {
        session.progress.stats.photos++
        session.save()
        audio.play('shutter')
      }
      investigation.refresh()
      return
    }
    session.useHotspot(hotspot)
    investigation.refresh()
  }

  function beginDialogue(id: CharacterId): void {
    if (!session || !active || paused) return
    const person = CHARACTER_LIST.find(c => c.id === id)
    if (!person) return
    const dlg = session.talk(id)
    if (!dlg) {
      audio.play('error')
      hud.toast(session.dialogueUnavailableReason(id) ?? `${person.name} مش عاوز يتكلم دلوقتي.`, 'info')
      return
    }
    hud.hideNarration()
    const s = session
    dialogue.start(dlg, person, s.profile.avatar.name,
      () => { session?.save(); investigation.refresh() },
      () => session?.flushDialogue(dlg),
      {
        backdrop: investigation.sceneImage,
        avatar: s.profile.avatar,
        evidence: eid => { const e = s.caseFile.evidence.find(x => x.id === eid); return e && { title: e.title, kind: e.kind } },
        onConfront: lie => haptic(lie ? 'warning' : 'medium'),
      },
    )
  }

  async function askHint(): Promise<void> {
    if (!session || !active || paused) return
    const cost = session.nextHintCost()
    const result = await session.hint()
    if (!result) hud.toast('القضية اتقفلت، مفيش تلميحات.', 'info')
    else if ('wait' in result) hud.toast(`استنى ${arabicDigits(result.wait)} ثانية قبل التلميح الجاي.`, 'info')
    else { audio.play('paper'); hud.hint(result.text, result.tier, result.source, cost) }
    session.save()
  }

  // ---- Input and timing ----------------------------------------------------------------------------------------
  window.addEventListener('keydown', event => {
    const handled = dialogue.key(event) || caseFile.key(event) || shell.key(event)
    if (handled) {
      event.preventDefault()
      return
    }
    if (!active || paused) return
    if (event.code === 'Escape') { event.preventDefault(); pause() }
    else if (event.code === 'Tab') { event.preventDefault(); openCaseFile() }
    else if (event.code === 'KeyH') { event.preventDefault(); void askHint() }
    else if (event.code === 'KeyM') { event.preventDefault(); investigation.setTab('map') }
    else if (event.code === 'KeyJ') { event.preventDefault(); caseFile.show(session!, 'objectives') }
  })
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause() })
  // Android back button: close the innermost layer first; returning false minimises the app.
  onBackButton(() => {
    if (dialogue.open) { dialogue.close(); return true }
    if (!caseFile.el.hidden) { caseFile.close(); return true }
    if (investigation.back()) return true
    if (active && !paused) { pause(); return true }
    if (paused) { resume(); return true }
    if (shell.screen !== 'title' && shell.screen !== 'boot') { shell.key(new KeyboardEvent('keydown', { code: 'Escape' })); return true }
    return false
  })
  window.addEventListener('pagehide', () => session?.save())

  const loop = new GameLoop({
    step: dt => {
      if (!session || !active || paused) return
      session.tick(dt)
      saveTimer += dt
      if (saveTimer >= 20) {
        saveTimer = 0
        session.save()
      }
    },
    render: (_alpha, dt) => {
      shell.frame(dt)
      dialogue.frame(dt)
      if (session && active && !paused) {
        investigation.tickClock(session.clock.hour)
      }
    },
  })
  loopRef = loop
  loop.start()

  // Debug/test hook: omit it from ordinary production sessions.
  if (import.meta.env.DEV || auto === 'story' || auto === 'realistic') {
    ;(window as unknown as { __ltt: unknown }).__ltt = {
      get session() { return session },
      shell, hud, caseFile, investigation, events, profiles, settings,
      selectPlace: (id: PlaceId) => {
        if (PLACES[id]?.district === PLACES[investigation.currentPlace]?.district) investigation.setPlace(id)
      },
      useHotspot: (id: string) => {
        const hotspot = session?.engine.activeHotspots().find(item => item.id === id && item.place === investigation.currentPlace)
        if (hotspot) handleHotspot(hotspot)
      },
      talk: (id: CharacterId) => beginDialogue(id),
      openCaseFile: () => openCaseFile(),
      pause: () => pause(),
      resume: () => resume(),
    }
  }

  window.setTimeout(() => {
    if (auto === 'story' || auto === 'realistic') {
      void beginProfile(profiles.create({ kind: 'yassin' }, auto), 'skip')
    } else shell.go('title')
  }, 250)
}

boot().catch(err => {
  console.error(err)
  const el = document.getElementById('ui')
  if (el) {
    el.replaceChildren()
    const d = document.createElement('div')
    d.className = 'fatal'
    d.textContent = `تعذّر تشغيل اللعبة: ${String((err as Error)?.message ?? err)}`
    el.append(d)
  }
})
