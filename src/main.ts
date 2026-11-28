import './styles/main.css'
import './styles/investigation.css'
import './styles/dialogue.css'
import './styles/overhaul.css'
import './styles/asset-art.css'
import './styles/asset-art-dialogue.css'
import './styles/scene-atmosphere.css'
import './styles/evidence-visuals.css'
import './styles/board-visuals.css'
import './styles/story-visuals.css'
import './styles/organizer-visuals.css'
import './styles/world-visuals.css'
import './styles/polish-visuals.css'
import './styles/juice-visuals.css'
import './styles/clue-details.css'
import './styles/memory.css'
import { arabicDigits, cairoStamp, nowFromQuery } from './core/clock'
import type { CaseEvent } from './core/caseState'
import { CHARACTER_LIST } from './data/characters'
import { PATHS } from './data/life'
import { PLACE_LIST, PLACES } from './data/places'
import type { CharacterId, Hotspot, PlaceId } from './data/types'
import { Audio } from './engine/audio'
import { GameLoop } from './engine/loop'
import { SettingsStore, type Settings } from './engine/save'
import { Session } from './game/session'
import { haptic, onBackButton } from './services/native'
import { EventsDb, JsonUrlProvider, type EventsDocument } from './services/eventsDb'
import { voicePath } from './data/voice'
import { HintService, RemoteChatProvider } from './services/hints'
import { ProfileService, type Profile } from './services/profiles'
import { LocalStorageAdapter, MemoryStorage } from './services/storage'
import { achievementContext, evaluateAchievements } from './game/achievements'
import { CrashReporter } from './services/crash'
import { CaseFileView } from './ui/casefile'
import { LockerView } from './ui/clueDetails'
import { MemoryView } from './ui/memoryView'
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
import { Tutorial } from './ui/tutorial'

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
  const crash = new CrashReporter(storage, settings.data.crashReportsEnabled)
  if (auto === 'story' || auto === 'realistic') settings.update({ helpSeen: true })
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
  let recapShown = false
  let endingTimer = 0

  const applySettings = (d: Settings) => {
    audio.setVolumes(d.musicVolume, d.sfxVolume, d.muted, d.ambientVolume, d.voiceVolume, d.voiceEnabled)
    document.body.classList.toggle('reduced-motion', d.reducedMotion)
    document.body.classList.toggle('clear-font', d.clearFont)
    document.body.classList.toggle('simple', d.simpleMode)
    document.body.classList.toggle('high-contrast', d.highContrast)
    document.documentElement.dataset.textSize = d.textSize
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
  const hud = new Hud()
  const tutorial = new Tutorial({
    onComplete: () => {
      if (!session) return
      session.progress.tutorial.completed = true
      session.save()
    },
  })
  const caseFile = new CaseFileView({
    audio,
    events,
    story,
    letters,
    lens,
    simple: () => settings.data.simpleMode,
    where: () => {
      const pos = session?.progress.position ?? { zone: 'abis' as const, x: 30, z: 232, yaw: 0 }
      return { zone: pos.zone, x: pos.x, z: pos.z }
    },
    onClose: () => window.setTimeout(storyCheck, 350),
    onAccused: result => {
      if (result === 'ok') {
        haptic('success')
        caseFile.close()
        scheduleEnding()
        return
      }
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
    onMail: () => { if (session && active && !paused) caseFile.show(session, 'letters') },
    onHelp: () => showHelp(),
    onFarPlace: (id: PlaceId) => hud.toast(`${PLACES[id].name} في ${PLACES[id].district === 'city' ? 'الإسكندرية' : 'أبيس'}… اركب الميكروباص من الموقف.`, 'info'),
    onMute: () => { settings.update({ muted: !settings.data.muted }); applySettings(settings.data); investigation.refresh() },
    onTextSize: () => { const order = ['normal', 'large', 'xlarge'] as const; settings.update({ textSize: order[(order.indexOf(settings.data.textSize) + 1) % 3] }); applySettings(settings.data); hud.toast('حجم الخط: ' + ({ normal: 'عادي', large: 'كبير', xlarge: 'كبير جدًا' })[settings.data.textSize], 'info') },
    isMuted: () => settings.data.muted,
    mailCount: () => (session ? letters.unreadCount(session) : 0),
  })

  let memoryView: MemoryView | undefined
  const shell = new Shell({ settings, profiles, audio }, {
    play: id => void beginProfile(profiles.select(id)),
    create: (avatar, mode) => void beginProfile(profiles.create(avatar, mode), 'force'),
    resume: () => resume(),
    quit: () => quit(),
    memoryCampaign: () => {
      if (!memoryView) {
        memoryView = new MemoryView(storage)
        ui.append(memoryView.el)
      }
      memoryView.show()
    },
    casefile: () => { shell.go('none'); openCaseFile() },
    settings: patch => {
      settings.update(patch)
      applySettings(settings.data)
      if ('crashReportsEnabled' in patch) crash.setEnabled(settings.data.crashReportsEnabled)
      if ('hintEndpoint' in patch) hints.setRemote(settings.data.hintEndpoint ? new RemoteChatProvider(settings.data.hintEndpoint) : undefined)
    },
    replayTutorial: () => {
      if (!session) {
        const saved = profiles.active
        if (saved) {
          saved.progress.tutorial.completed = false
          profiles.save(saved.progress)
        }
        return
      }
      session.progress.tutorial.completed = false
      session.save()
      if (session.caseId === 'case01' && active) {
        paused = false
        shell.go('none')
        tutorial.start(session)
      }
    },
    startWorld: () => {
      if (session?.caseId === 'case01' && !session.state.evidence.has('e_thread_door')) {
        currentPlace = 'mahmoud_house'
        const place = PLACES[currentPlace]
        session.setPosition(place.district, place.pos.x, place.pos.z, 0)
        session.save()
      }
      startWorld()
    },
    nextCase: () => startNextCase(),
    help: () => showHelp(),
  })
  const locker = new LockerView()
  ui.append(shell.el, investigation.el, hud.el, story.el, arrival.el, dialogue.el, caseFile.el, letters.el, lens.el, help.el, recap.el, travel.el, saveChip.el, fx.el, tutorial.el, locker.el)
  letters.onChange = () => { investigation.refresh(); caseFile.refresh() }
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
    if (intro === 'skip' || new URLSearchParams(location.search).get('tutorial') === '0') {
      session.progress.tutorial.completed = true
      session.save()
    }
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
    shell.go('none')
    paused = false
    active = true
    investigation.show(session, currentPlace)
    if (session.state.flags.has(`ch_seen_${story.current(session).id}`)) arrival.show(PLACES[currentPlace])
    hud.show(true)
    audio.playMusic(musicFor(currentPlace), { loop: true })
    audio.setArea(currentPlace)
    audio.setScene(PLACES[currentPlace].district, 0.4, 0.2)
    const atOpeningDoor = session.caseId === 'case01' && currentPlace === 'mahmoud_house' && !session.state.flags.has('zeinab_talked')
    if (!maybeRecap() && !atOpeningDoor && !settings.data.helpSeen) window.setTimeout(() => showHelp(), 900)
    loopRef?.resetAccumulator()
    window.setTimeout(storyCheck, 700)
    if (!atOpeningDoor && session.caseId === 'case01' && new URLSearchParams(location.search).get('tutorial') !== '0') tutorial.start(session)
  }

  function startNextCase(): void {
    if (!session) return
    const next = session.nextCaseId()
    if (!next || !session.startCase(next)) return
    window.clearTimeout(endingTimer)
    tutorial.stop()
    const first = session.caseFile.hotspots[0]?.place ?? 'zeinab_home'
    currentPlace = first
    const place = PLACES[first]
    session.setPosition(place.district, place.pos.x, place.pos.z, 0)
    session.save()
    unsubscribeCase?.()
    unsubscribeCase = session.onCase(handleCaseEvents)
    shell.showIntro(session)
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
  function maybeRecap(): boolean {
    if (!session || recapShown) return false
    const s = session
    if (s.state.evidence.size === 0 && letters.unreadCount(s) === 0) return false
    recapShown = true
    const delivered = letters.delivered(s)
    const next = s.engine.currentObjective()
    const question = s.openQuestions().at(-1)
    recap.show({
      caseTitle: s.caseFile.title, lastEvidence: s.lastEvidence()?.title,
      lastLetter: delivered.at(-1)?.title, question: question && s.fill(question.text), next: next?.title,
    }, () => window.setTimeout(storyCheck, 300))
    return true
  }

  function showHelp(): void {
    if (!session || !active) return
    settings.update({ helpSeen: true })
    help.show()
  }

  function persistPlace(id: PlaceId): void {
    if (!session) return
    const place = PLACES[id]
    const before = PLACES[currentPlace]?.district
    if (place.id !== currentPlace) audio.stopVoice()
    if (place.id !== currentPlace) arrival.show(place)
    audio.setArea(place.id)
    audio.setScene(place.district, 0.4, 0.2)
    investigation.updateWorldTime()
    window.setTimeout(storyCheck, 1200)
    currentPlace = id
    session.setPosition(place.district, place.pos.x, place.pos.z, 0)
    session.save()
    saveChip.flash()
    if (before !== place.district) audio.playMusic(musicFor(id), { loop: true })
    if (before !== place.district) tutorial.action('travel')
    hud.hideNarration()
    if (id === 'zeinab_home' && session.caseId === 'case01' && !session.state.flags.has('zeinab_talked') &&
      new URLSearchParams(location.search).get('tutorial') !== '0') tutorial.start(session)
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
    tutorial.action('casefile')
  }

  function pause(): void {
    if (!active || paused) return
    paused = true
    hud.show(false)
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
    hud.show(true)
    loopRef?.resetAccumulator()
    investigation.refresh()
    window.setTimeout(storyCheck, 300)
  }

  function quit(): void {
    window.clearTimeout(endingTimer)
    tutorial.stop()
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
      checkAchievements()
      tutorial.stop()
      audio.play('solved')
      audio.playMusic(MUSIC.title, { loop: true })
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
        audio.play('found')
        haptic('medium')
        buzz(30)
        if (change.evidence.id !== 'e_thread_door' || session?.state.flags.has('zeinab_talked')) {
          hud.toast(`دليل جديد: ${change.evidence.title}`, 'evidence')
          fx.evidence(change.evidence.title, EVIDENCE_ART[change.evidence.id])
        }
      } else if (change.type === 'evidence-gated') {
        hud.toast(change.reason ?? 'الدليل ده لسه ماظهرش… ارجع في وقت تاني.', 'warn')
      } else if (change.type === 'deduction') {
        audio.play('deduction')
        haptic('success')
        hud.toast('ربطت خيطاً جديداً!', 'deduction')
        fx.thread()
        tutorial.action('thread')
      }
    }
    caseFile.refresh()
    investigation.refresh()
    checkAchievements()
    if (changes.some(change => change.type === 'flag' && change.id === 'case_solved')) scheduleEnding()
    else window.setTimeout(storyCheck, 900)
  }

  function handleHotspot(hotspot: Hotspot, code?: string): void {
    if (!session || !active || paused || !session.engine.hotspotAvailable(hotspot)) return
    const lockCode = hotspot.lockCode
    if (lockCode && code !== lockCode) {
      const currentSession = session
      locker.show(lockCode, () => {
        if (session === currentSession && currentPlace === hotspot.place) handleHotspot(hotspot, lockCode)
      })
      return
    }
    audio.play('ui')
    if (hotspot.kind === 'inspect') tutorial.action('inspect')
    else if (hotspot.kind === 'photo') tutorial.action('photo')
    const openingThread = hotspot.id === 'hs_door_thread' && !session.state.flags.has('zeinab_talked')
    if (hotspot.text && !openingThread) hud.narrate(session.fill(hotspot.text))
    const voice = voicePath(session.caseId, hotspot.id, 0)
    if (voice) audio.playVoice(voice)
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
        audio.play('shutter')
      }
      investigation.refresh()
      return
    }
    session.useHotspot(hotspot, code)
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
      () => {
        tutorial.action('talk')
        session?.save()
        investigation.refresh()
        checkAchievements()
        window.setTimeout(storyCheck, 400)
      },
      () => session?.flushDialogue(dlg),
      {
        caseId: s.caseId,
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
    tutorial.action('hint')
    if (!result) hud.toast('القضية اتقفلت، مفيش تلميحات.', 'info')
    else if ('wait' in result) hud.toast(`استنى ${arabicDigits(result.wait)} ثانية قبل التلميح الجاي.`, 'info')
    else { audio.play('paper'); hud.hint(result.text, result.tier, result.source, cost) }
    session.save()
    checkAchievements()
  }

  function checkAchievements(): void {
    if (!session) return
    const current = session
    const file = current.caseFile
    const characters = CHARACTER_LIST.filter(c => current.inCase(c))
    const solvedCaseIds = Object.entries(current.progress.cases ?? {})
      .filter(([, snapshot]) => snapshot.flags.includes('case_solved'))
      .map(([id]) => id)
    if (current.state.flags.has('case_solved') && !solvedCaseIds.includes(current.caseId)) solvedCaseIds.push(current.caseId)
    const secretsTotal = characters.filter(c => c.secret).length
    const secretsUnlocked = characters.filter(c => c.secret && current.state.flags.has(c.secret.unlock)).length
    const pastTotal = characters.reduce((sum, c) => sum + c.past.length, 0)
    const pastUnlocked = characters.reduce((sum, c) => sum + c.past.filter(p => !p.unlock || current.state.flags.has(p.unlock)).length, 0)
    const context = achievementContext({
      caseId: current.caseId,
      mode: current.mode,
      evidenceFound: current.state.evidence.size,
      evidenceTotal: file.evidence.length,
      photoEvidenceFound: file.evidence.filter(e => e.kind === 'photo' && current.state.evidence.has(e.id)).length,
      photoEvidenceTotal: file.evidence.filter(e => e.kind === 'photo').length,
      deductionsFound: current.state.deductions.size,
      deductionsTotal: file.deductions.length,
      talkedTo: characters.filter(c => current.state.flags.has(`met_${c.id}`)).length,
      charactersTotal: characters.length,
      correctConfrontations: [...session.state.flags].filter(id => /_confronted$/.test(id)).length,
      secretsUnlocked, secretsTotal, pastUnlocked, pastTotal,
      storyMinutes: current.clock.elapsedStoryMinutes,
      solvedCaseIds,
      flags: current.state.flags,
      stats: current.progress.stats,
      solved: current.state.flags.has('case_solved'),
      grade: current.state.flags.has('case_solved') ? current.gradeReport().grade : undefined,
    })
    const unlocked = evaluateAchievements(context, current.progress.achievements)
    if (!unlocked.length) return
    current.progress.achievements = [...new Set([...current.progress.achievements, ...unlocked.map(a => a.id)])]
    current.save()
    unlocked.forEach(a => hud.toast(`إنجاز جديد: ${a.title}`, 'deduction'))
  }

  // ---- Input and timing ----------------------------------------------------------------------------------------
  window.addEventListener('keydown', event => {
    if (memoryView?.open || locker.el.open || investigation.destinationOpen) return
    const handled = travel.key(event) || recap.key(event) || lens.key(event) || help.key(event) || letters.key(event) || dialogue.key(event) || caseFile.key(event) || shell.key(event)
    if (handled) {
      event.preventDefault()
      return
    }
    if (!active || paused) return
    if (event.code === 'Tab' && caseFile.open) return
    if (event.code === 'Escape') { event.preventDefault(); pause() }
    else if (event.code === 'Tab') { event.preventDefault(); openCaseFile() }
    else if (event.code === 'KeyH') { event.preventDefault(); void askHint() }
    else if (event.code === 'KeyM') { event.preventDefault(); investigation.setTab('map') }
    else if (event.code === 'KeyJ') { event.preventDefault(); caseFile.show(session!, 'objectives') }
  })
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause() })
  // Android back button: close the innermost layer first; returning false minimises the app.
  onBackButton(() => {
    if (memoryView?.open) { memoryView.close(); return true }
    if (locker.el.open) { locker.el.close(); return true }
    if (lens.open) { lens.hide(); return true }
    if (recap.open) return recap.key(new KeyboardEvent('keydown', { code: 'Escape' }))
    if (dialogue.open) { dialogue.close(); return true }
    if (!caseFile.el.hidden) { caseFile.close(); return true }
    if (investigation.back()) return true
    if (active && !paused) { pause(); return true }
    if (paused) { resume(); return true }
    if (shell.screen !== 'title' && shell.screen !== 'boot') { shell.key(new KeyboardEvent('keydown', { code: 'Escape' })); return true }
    return false
  })
  window.addEventListener('pagehide', () => session?.save())

  let clockRefresh = 0
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
        clockRefresh += dt
        if (clockRefresh >= 0.25) {
          clockRefresh = 0
          investigation.tickClock(session.clock.hour)
        }
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
      shell, hud, caseFile, investigation, events, profiles, settings, story, letters, help, arrival, lens, travel, recap, tutorial,
      /** QA helpers: every place id, and the characters that have a dialogue in the running case. */
      places: PLACE_LIST.map(p => p.id),
      cast: () => CHARACTER_LIST.filter(c => c.id !== 'yassin' && session?.inCase(c)).map(c => c.id),
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
