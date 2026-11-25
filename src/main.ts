import './styles/main.css'
import './styles/investigation.css'
import './styles/scene-atmosphere.css'
import './styles/evidence-visuals.css'
import './styles/board-visuals.css'
import './styles/story-visuals.css'
import './styles/organizer-visuals.css'
import './styles/world-visuals.css'
import './styles/polish-visuals.css'
import './styles/juice-visuals.css'
import { cairoStamp, nowFromQuery } from './core/clock'
import type { CaseEvent } from './core/caseState'
import { CASE_01 } from './data/case01'
import { CHARACTER_LIST } from './data/characters'
import { PATHS } from './data/life'
import { PLACE_LIST, PLACES } from './data/places'
import type { CharacterId, Hotspot, PlaceId } from './data/types'
import { Audio } from './engine/audio'
import { GameLoop } from './engine/loop'
import { SettingsStore, type Settings } from './engine/save'
import { Session } from './game/session'
import { createArEngine, type ArEngine } from './services/ar'
import { EventsDb, JsonUrlProvider, type EventsDocument } from './services/eventsDb'
import { HintService, RemoteChatProvider } from './services/hints'
import { ProfileService, type Profile } from './services/profiles'
import { LocalStorageAdapter, MemoryStorage } from './services/storage'
import { CaseFileView } from './ui/casefile'
import { DialogueView } from './ui/dialogueView'
import { HelpView } from './ui/helpView'
import { Hud } from './ui/hud'
import { LetterView } from './ui/letterView'
import { ArrivalCard } from './ui/worldFx'
import { FlashFx, LensView, RecapView, SaveChip, TravelView, buzz } from './ui/extras'
import { EVIDENCE_ART } from './ui/visualAssets'
import { InvestigationView } from './ui/investigation'
import { Shell } from './ui/shell'
import { StoryDirector } from './ui/storyView'

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
  if (auto === 'story' || auto === 'realistic') settings.update({ helpSeen: true })
  const profiles = new ProfileService(storage)
  const now = nowFromQuery(location.search, () => cairoStamp(new Date()))
  const audio = new Audio()

  // ---- Services -------------------------------------------------------------------------------------------------
  const events = new EventsDb(storage, settings.data.eventsUrl ? [new JsonUrlProvider('custom', settings.data.eventsUrl)] : [])
  const hints = new HintService(undefined, settings.data.hintEndpoint ? new RemoteChatProvider(settings.data.hintEndpoint) : undefined)
  let ar: ArEngine = createArEngine(settings.data.visionEndpoint || undefined)

  let session: Session | undefined
  let loopRef: GameLoop | undefined
  let unsubscribeCase: (() => void) | undefined
  let currentPlace: PlaceId = 'zeinab_home'
  let active = false
  let paused = false
  let saveTimer = 0
  let recapShown = false
  let endingTimer = 0

  const applySettings = (d: Settings) => {
    audio.setVolumes(d.musicVolume, d.sfxVolume, d.muted)
    document.body.classList.toggle('reduced-motion', d.reducedMotion)
    document.body.classList.toggle('clear-font', d.clearFont)
    document.body.classList.toggle('simple', d.simpleMode)
    document.body.classList.toggle('high-contrast', d.highContrast)
    document.documentElement.dataset.textSize = d.textSize
  }

  // ---- 2D investigation UI -------------------------------------------------------------------------------------
  const story = new StoryDirector(audio)
  const letters = new LetterView(audio)
  const help = new HelpView()
  const arrival = new ArrivalCard()
  const lens = new LensView()
  const travel = new TravelView()
  const recap = new RecapView()
  const saveChip = new SaveChip()
  const fx = new FlashFx()
  const dialogue = new DialogueView(audio, text => session?.fill(text) ?? text)
  const hud = new Hud({
    casefile: () => openCaseFile(),
    hint: () => void askHint(),
    camera: () => hud.toast('التوثيق هنا من خلال مشاهد القضية ثنائية الأبعاد.', 'info'),
    pause: () => pause(),
    interact: () => hud.toast('اختار نقطة فحص أو شخصية من المشهد.', 'info'),
  })
  const caseFile = new CaseFileView({
    audio, events, story, letters, lens, simple: () => settings.data.simpleMode,
    where: () => {
      const pos = session?.progress.position ?? { zone: 'abis' as const, x: 30, z: 232, yaw: 0 }
      return { zone: pos.zone, x: pos.x, z: pos.z }
    },
    onClose: () => window.setTimeout(storyCheck, 350),
    onAccused: result => { if (result === 'ok') { caseFile.close(); scheduleEnding() } },
    onEvidenceReviewed: id => investigation.markEvidenceReviewed(id),
  })
  const investigation = new InvestigationView({
    audio,
    onHotspot: hotspot => handleHotspot(hotspot),
    onTalk: id => beginDialogue(id),
    onPlaceChange: id => persistPlace(id),
    onCaseFile: () => openCaseFile(),
    onHint: () => void askHint(),
    onPause: () => pause(),
    onMail: () => { if (session && active && !paused) caseFile.show(session, 'letters') },
    onHelp: () => showHelp(),
    onFarPlace: id => hud.toast(`${PLACES[id].name} في ${PLACES[id].district === 'city' ? 'الإسكندرية' : 'أبيس'}… اركب الميكروباص من الموقف.`, 'info'),
    onMute: () => { settings.update({ muted: !settings.data.muted }); applySettings(settings.data); investigation.refresh() },
    onTextSize: () => { const order = ['normal', 'large', 'xlarge'] as const; settings.update({ textSize: order[(order.indexOf(settings.data.textSize) + 1) % 3] }); applySettings(settings.data); hud.toast('حجم الخط: ' + ({ normal: 'عادي', large: 'كبير', xlarge: 'كبير جدًا' })[settings.data.textSize], 'info') },
    isMuted: () => settings.data.muted,
    mailCount: () => (session ? letters.unreadCount(session) : 0),
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
      if ('visionEndpoint' in patch) ar = createArEngine(settings.data.visionEndpoint || undefined)
    },
    startWorld: () => startWorld(),
    help: () => showHelp(),
  })
  ui.append(shell.el, investigation.el, hud.el, story.el, arrival.el, dialogue.el, caseFile.el, letters.el, lens.el, help.el, recap.el, travel.el, saveChip.el, fx.el, ...hud.layers)
  letters.onChange = () => { investigation.refresh(); caseFile.refresh() }
  applySettings(settings.data)

  // ---- Boot ----------------------------------------------------------------------------------------------------
  splash?.remove()
  shell.setBootProgress(0.12)
  const seedPromise = loadSeed()
  await document.fonts.ready
  shell.setBootProgress(0.58)
  events.init(await seedPromise)
  void events.refresh()
  shell.setBootProgress(1)

  // ---- Flow ----------------------------------------------------------------------------------------------------
  const deps = () => ({ events, profiles, hints, ar, now })

  async function beginProfile(profile: Profile | undefined, intro: 'auto' | 'force' | 'skip' = 'auto'): Promise<void> {
    if (!profile) return
    audio.unlock()
    shell.go('none')
    unsubscribeCase?.()
    session = new Session(profile, deps())
    currentPlace = nearestPlace(session.progress.position.zone, session.progress.position.x, session.progress.position.z)
    unsubscribeCase = session.onCase(handleCaseEvents)
    audio.startAmbience()
    audio.setArea(currentPlace)
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
    if (session.state.flags.has(`ch_seen_${story.current(session).id}`)) arrival.show(PLACES[currentPlace])
    hud.show(true)
    audio.setArea(currentPlace)
    audio.setScene(PLACES[currentPlace].district, 0.4, 0.2)
    if (!settings.data.helpSeen) window.setTimeout(() => showHelp(), 900)
    else maybeRecap()
    loopRef?.resetAccumulator()
    window.setTimeout(storyCheck, 700)
  }

  /** Chapter banner + journal notice; waits while a dialogue, file or pause screen is open. */
  function storyCheck(): void {
    if (!session || !active || paused || dialogue.open || caseFile.open || letters.open || help.open || recap.open || travel.open || lens.open) return
    if (story.checkChapter(session)) {
      window.setTimeout(storyCheck, 6800)
      return
    }
    const choices = story.collectChoices(session)
    if (choices.length) {
      const choice = choices[choices.length - 1]
      audio.play('ui')
      hud.toast(`اخترت: ${choice.title} · ${PATHS[choice.path].short} ‎+${choice.points}`, 'info')
    }
    const done = story.collectQuests(session)
    if (done.length) {
      audio.play('solved')
      hud.toast(`اكتملت حكاية جانبية: ${done[done.length - 1].title}`, 'deduction')
    }
    const mail = letters.collect(session, currentPlace)
    if (mail.length) {
      letters.announce(session, mail[mail.length - 1], mail.length - 1)
      investigation.refresh()
    }
    const pages = story.collectJournal(session)
    if (pages.length) {
      audio.play('paper')
      hud.toast(`صفحة جديدة في يومياتك: ${pages[pages.length - 1].title}`, 'info')
    }
    if (done.length || pages.length || choices.length) investigation.refresh()
  }

  /** "Last time" card when the player comes back to a save that already has progress. */
  function maybeRecap(): void {
    if (!session || recapShown) return
    recapShown = true
    const s = session
    if (s.state.evidence.size === 0 && letters.unreadCount(s) === 0) return
    const chapter = story.current(s)
    const delivered = letters.delivered(s)
    const next = s.engine.currentObjective()
    recap.show({
      chapter: chapter.title, kicker: chapter.kicker, evidence: s.state.evidence.size, total: CASE_01.evidence.length,
      letters: delivered.length, lastLetter: delivered[delivered.length - 1]?.title, next: next?.title, nextDetail: next?.detail,
    }, () => window.setTimeout(storyCheck, 300))
  }

  function showHelp(): void {
    if (!session || !active) return
    settings.update({ helpSeen: true })
    help.show()
  }

  function persistPlace(id: PlaceId): void {
    if (!session) return
    const place = PLACES[id]
    if (place.id !== currentPlace) arrival.show(place)
    audio.setArea(place.id)
    audio.setScene(place.district, 0.4, 0.2)
    investigation.updateWorldTime()
    window.setTimeout(storyCheck, 1200)
    currentPlace = id
    session.setPosition(place.district, place.pos.x, place.pos.z, 0)
    session.save()
    saveChip.flash()
  }

  function openCaseFile(): void {
    if (!session || !active) return
    if (paused) {
      paused = false
      shell.go('none')
      loopRef?.resetAccumulator()
    }
    letters.hideNotice()
    caseFile.show(session)
  }

  function pause(): void {
    if (!active || paused) return
    paused = true
    letters.hideNotice()
    story.hide()
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
    window.setTimeout(storyCheck, 300)
  }

  function quit(): void {
    window.clearTimeout(endingTimer)
    if (dialogue.open) dialogue.close()
    caseFile.el.hidden = true
    story.hide()
    letters.hide()
    arrival.hide()
    lens.hide()
    recap.hide()
    recapShown = false
    session?.save()
    unsubscribeCase?.()
    unsubscribeCase = undefined
    audio.stopAmbience()
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
      active = false
      paused = false
      caseFile.el.hidden = true
      story.hide()
      hud.show(false)
      investigation.hide()
      shell.showEnding(session)
    }, 900)
  }

  function handleCaseEvents(changes: CaseEvent[]): void {
    for (const change of changes) {
      if (change.type === 'evidence') {
        audio.play('evidence')
        buzz(30)
        hud.toast(`دليل جديد: ${change.evidence.title}`, 'evidence')
        fx.evidence(change.evidence.title, EVIDENCE_ART[change.evidence.id])
      } else if (change.type === 'evidence-gated') {
        hud.toast(change.reason ?? 'الدليل ده لسه ماظهرش… ارجع في وقت تاني.', 'warn')
      } else if (change.type === 'deduction') {
        audio.play('deduction')
        hud.toast('ربطت خيطاً جديداً!', 'deduction')
        fx.thread()
      }
    }
    caseFile.refresh()
    investigation.refresh()
    if (changes.some(change => change.type === 'flag' && change.id === 'case_solved')) scheduleEnding()
    else window.setTimeout(storyCheck, 900)
  }

  function handleHotspot(hotspot: Hotspot): void {
    if (!session || !active || paused) return
    audio.play('ui')
    if (hotspot.text) hud.narrate(session.fill(hotspot.text))
    if (hotspot.kind === 'travel' && hotspot.to) {
      session.useHotspot(hotspot)
      const to = hotspot.to
      travel.play(PLACES[currentPlace].district, PLACES[to].district, () => investigation.setPlace(to))
      return
    }
    if (hotspot.kind === 'photo') {
      fx.shutter()
      const changes = session.useHotspot(hotspot)
      if (changes.some(change => change.type === 'evidence')) {
        session.progress.stats.photos++
        session.save()
        hud.toast('تمت إضافة سجل الصورة إلى ملف القضية.', 'info')
      }
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
      hud.toast(`${person.name} مش عاوز يتكلم دلوقتي.`, 'info')
      return
    }
    dialogue.start(dlg, person, session.profile.avatar.name,
      () => { session?.save(); investigation.refresh(); window.setTimeout(storyCheck, 400) },
      () => session?.flushDialogue(dlg),
    )
  }

  async function askHint(): Promise<void> {
    if (!session || !active || paused) return
    const result = await session.hint()
    if (!result) hud.toast('القضية اتقفلت… مفيش تلميحات.', 'info')
    else if ('wait' in result) hud.toast(`استنى ${result.wait} ثانية قبل التلميح الجاي.`, 'info')
    else hud.hint(result.text, result.tier, result.source)
    session.save()
  }

  // ---- Input and timing ----------------------------------------------------------------------------------------
  window.addEventListener('keydown', event => {
    const handled = travel.key(event) || recap.key(event) || lens.key(event) || help.key(event) || letters.key(event) || dialogue.key(event) || caseFile.key(event) || shell.key(event)
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
  window.addEventListener('pagehide', () => session?.save())

  const loop = new GameLoop({
    step: dt => {
      if (!session || !active || paused) return
      session.tick(dt)
      saveTimer += dt
      if (saveTimer >= 20) {
        saveTimer = 0
        session.save()
        saveChip.flash()
      }
    },
    render: (_alpha, dt) => {
      shell.frame(dt)
      dialogue.frame(dt)
      if (session && active && !paused) {
        hud.frame({
          hour: session.clock.hour,
          mode: session.mode,
          objective: session.engine.currentObjective(),
          evidence: session.state.evidence.size,
          total: CASE_01.evidence.length,
          photoNearby: false,
        })
      }
    },
  })
  loopRef = loop
  loop.start()
  window.setInterval(() => { if (active && !paused) investigation.updateWorldTime() }, 8000)

  // Debug/test hook: omit it from ordinary production sessions.
  if (import.meta.env.DEV || auto === 'story' || auto === 'realistic') {
    ;(window as unknown as { __ltt: unknown }).__ltt = {
      get session() { return session },
      shell, hud, caseFile, investigation, events, profiles, settings, story, letters, help, arrival, lens, travel, recap,
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
