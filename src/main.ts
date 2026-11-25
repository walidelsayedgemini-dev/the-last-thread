/**
 * Application composition root: wires the services (profiles, real events, AR, hints), the UI and
 * the 3D game together. No game rules live here; see `game/session.ts` and `core/`.
 *
 * Dev shortcuts (query string): `?now=2026-11-27T19:30` pins Cairo time, `?autostart=story|realistic`
 * skips the menus with the default hero.
 */
import './styles/main.css'
import { cairoStamp, nowFromQuery } from './core/clock'
import { CASE_01 } from './data/case01'
import { Audio } from './engine/audio'
import { Assets } from './engine/assets'
import { Input } from './engine/input'
import { GameLoop } from './engine/loop'
import { SettingsStore, type Settings } from './engine/save'
import type { Game } from './game/game'
import { Session } from './game/session'
import { ArEngine, createArEngine } from './services/ar'
import { EventsDb, JsonUrlProvider, type EventsDocument } from './services/eventsDb'
import { HintService, RemoteChatProvider } from './services/hints'
import { ProfileService, type Profile } from './services/profiles'
import { LocalStorageAdapter, MemoryStorage } from './services/storage'
import { CameraView } from './ui/cameraView'
import { CaseFileView } from './ui/casefile'
import { DialogueView } from './ui/dialogueView'
import { Hud } from './ui/hud'
import { Shell } from './ui/shell'
import { TouchControls } from './ui/touch'

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

async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#game')!
  const ui = document.getElementById('ui')!
  const splash = document.getElementById('splash')
  // `?autostart` (tests/demos) runs on throwaway memory storage so it can never touch real saves.
  const auto = new URLSearchParams(location.search).get('autostart')
  const storage = auto === 'story' || auto === 'realistic' ? new MemoryStorage() : new LocalStorageAdapter()
  const settings = new SettingsStore(storage)
  const profiles = new ProfileService(storage)
  const now = nowFromQuery(location.search, () => cairoStamp(new Date()))
  const audio = new Audio()
  const input = new Input(canvas)
  const assets = new Assets()

  // ---- Services -------------------------------------------------------------------------------------------------
  const events = new EventsDb(storage, settings.data.eventsUrl ? [new JsonUrlProvider('custom', settings.data.eventsUrl)] : [])
  const hints = new HintService(undefined, settings.data.hintEndpoint ? new RemoteChatProvider(settings.data.hintEndpoint) : undefined)
  let ar: ArEngine = createArEngine(settings.data.visionEndpoint || undefined)

  let game: Game | undefined
  let session: Session | undefined
  let loopRef: GameLoop | undefined
  let endingTimer = 0

  const applySettings = (d: Settings) => {
    input.sensitivity = d.sensitivity
    input.invertY = d.invertY
    audio.setVolumes(d.musicVolume, d.sfxVolume, d.muted)
    if (game) game.reducedMotion = d.reducedMotion
  }

  // ---- UI pieces ------------------------------------------------------------------------------------------------------
  const dialogue = new DialogueView(audio, t => session?.fill(t) ?? t)
  const hud = new Hud({
    casefile: () => openCaseFile(),
    hint: () => void askHint(),
    camera: () => game?.tryCamera(),
    pause: () => pause(),
    interact: () => game?.interact(),
  })
  const camera = new CameraView({
    audio,
    pose: () => game!.cameraPose(),
    zoom: fov => game?.setZoom(fov),
    enter: () => { game?.enterPhoto(); input.unlockPointer() },
    exit: () => { game?.resumePlay() },
    onEvents: () => undefined,
    aiConfigured: () => !!settings.data.visionEndpoint,
  })
  const caseFile = new CaseFileView({
    audio, events,
    where: () => ({ zone: game?.zone ?? 'abis', x: game?.player?.position.x ?? 0, z: game?.player?.position.z ?? 0 }),
    onClose: () => { game?.resumePlay() },
    onAccused: r => { if (r === 'ok') { caseFile.close(); scheduleEnding() } },
  })
  const touch = new TouchControls(canvas, input, () => game?.mode === 'playing')

  const shell: Shell = new Shell({ settings, profiles, events, audio, now }, {
    play: id => void beginProfile(profiles.select(id)),
    create: (avatar, mode) => void beginProfile(profiles.create(avatar, mode), 'force'),
    resume: () => resume(),
    quit: () => quit(),
    casefile: () => { shell.go('none'); openCaseFile() },
    settings: patch => {
      const prev = settings.data
      settings.update(patch)
      applySettings(settings.data)
      if (patch.quality && patch.quality !== prev.quality) { renderer?.applyQuality(patch.quality); game?.setQuality() }
      if ('hintEndpoint' in patch) hints.setRemote(settings.data.hintEndpoint ? new RemoteChatProvider(settings.data.hintEndpoint) : undefined)
      if ('visionEndpoint' in patch) ar = createArEngine(settings.data.visionEndpoint || undefined)
    },
    startWorld: () => startWorld(),
  })
  ui.append(shell.el, hud.el, dialogue.el, caseFile.el, camera.el, touch.el, ...hud.layers)
  document.body.classList.toggle('reduced-motion', settings.data.reducedMotion)
  applySettings(settings.data)

  // ---- Heavy modules load behind the boot screen ------------------------------------------------------------------
  splash?.remove()
  shell.setBootProgress(0.1)
  const seedPromise = loadSeed()
  const [{ Game: GameClass }, { Renderer, suggestQuality }] = await Promise.all([import('./game/game'), import('./engine/renderer')])
  shell.setBootProgress(0.6)
  await document.fonts.ready
  events.init(await seedPromise)
  void events.refresh()
  if (settings.firstRun) settings.update({ quality: suggestQuality() })
  const renderer = new Renderer(canvas, settings.data.quality)
  game = new GameClass(renderer, input, audio, assets, {
    prompt: (text, kind) => hud.prompt(text, kind),
    narrate: text => hud.narrate(text),
    toast: (text, kind) => hud.toast(text, kind),
    openDialogue: (dlg, who) => {
      input.unlockPointer()
      dialogue.start(dlg, who, session!.profile.avatar.name, () => game?.resumePlay(), () => session!.flushDialogue(dlg))
    },
    openCamera: h => { camera.show(session!, h); input.unlockPointer() },
    fade: change => hud.fade(change),
    loading: text => hud.loading(text),
    caseChanged: evts => {
      game!.handleEvents(evts)
      caseFile.refresh()
      if (evts.some(e => e.type === 'flag' && e.id === 'case_solved')) scheduleEnding()
    },
  })
  game.reducedMotion = settings.data.reducedMotion
  if (import.meta.env.DEV) {
    const [{ registerGameTuning }, { tuning }] = await Promise.all([import('../scripts/manus-tuning/adapter.js'), import('./game/tuning')])
    await registerGameTuning(tuning)
  }
  shell.setBootProgress(1)

  // ---- Flow --------------------------------------------------------------------------------------------------------------
  const deps = () => ({ events, profiles, hints, ar, now })

  async function beginProfile(profile: Profile | undefined, intro: 'auto' | 'force' | 'skip' = 'auto'): Promise<void> {
    if (!profile || !game) return
    audio.unlock()
    shell.go('none')
    hud.loading('جارٍ تحضير مسرح القضية…')
    session = new Session(profile, deps())
    await game.begin(session)
    hud.loading(null)
    audio.startAmbience()
    const fresh = intro === 'force' || (intro === 'auto' && session.state.evidence.size === 0 && session.progress.playMs < 1000)
    if (fresh) shell.showIntro(session)
    else startWorld()
  }

  function startWorld(): void {
    shell.el.onclick = null
    shell.go('none')
    hud.show(true)
    game?.resumePlay()
    loopRef?.resetAccumulator()
    input.lockPointer()
    hud.narrate('اضغط E للتفاعل • Tab لملف القضية • H لتلميح')
  }

  function openCaseFile(): void {
    if (!game || !session || (game.mode !== 'playing' && game.mode !== 'paused')) return
    if (game.mode === 'paused') { game.resume(); shell.go('none') }
    game.enterUi()
    input.unlockPointer()
    caseFile.show(session)
  }

  function pause(): void {
    if (game?.mode !== 'playing') return
    game.pause()
    shell.go('pause')
    input.unlockPointer()
  }

  function resume(): void {
    if (game?.mode !== 'paused') return
    game.resume()
    shell.go('none')
    loopRef?.resetAccumulator()
    input.lockPointer()
  }

  function quit(): void {
    window.clearTimeout(endingTimer)
    game?.endSession()
    audio.stopAmbience()
    hud.show(false)
    caseFile.el.hidden = true
    session = undefined
    shell.el.onclick = null
    shell.go('title')
    input.unlockPointer()
  }

  function scheduleEnding(): void {
    window.clearTimeout(endingTimer)
    endingTimer = window.setTimeout(() => {
      if (!session) return
      audio.play('solved')
      game?.enterUi()
      hud.show(false)
      input.unlockPointer()
      shell.showEnding(session)
    }, 1500)
  }

  async function askHint(): Promise<void> {
    if (!session || game?.mode !== 'playing') return
    const r = await session.hint()
    if (!r) hud.toast('القضية اتقفلت… مفيش تلميحات.', 'info')
    else if ('wait' in r) hud.toast(`استنى ${r.wait} ثانية قبل التلميح الجاي.`, 'info')
    else hud.hint(r.text, r.tier, r.source)
  }

  // ---- Input routing -------------------------------------------------------------------------------------------------------
  window.addEventListener('keydown', e => {
    const handled = dialogue.key(e) || camera.key(e) || caseFile.key(e) || shell.key(e)
    if (handled) {
      e.preventDefault()
      input.endFrame()
    }
  })
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && game?.mode === 'playing' && input.method === 'keyboard') pause()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause()
  })
  canvas.addEventListener('click', () => {
    if (game?.mode === 'playing') input.lockPointer()
  })
  window.addEventListener('pagehide', () => session?.save())

  const g = game
  const loop = new GameLoop({
    beforeFrame: dt => input.update(dt),
    step: dt => g.step(dt),
    render: (alpha, dt) => {
      if (g.mode === 'playing') {
        if (input.consume('interact')) g.interact()
        else if (input.consume('camera')) g.tryCamera()
        if (input.consume('casefile')) openCaseFile()
        if (input.consume('hint')) void askHint()
        if (input.consume('view')) g.toggleView()
        if (input.consume('pause')) pause()
      } else if (g.mode === 'paused' && input.consume('pause')) resume()
      loop.paused = g.mode === 'paused'
      g.render(alpha, dt)
      shell.frame(dt)
      dialogue.frame(dt)
      if (session && (g.mode === 'playing' || g.mode === 'ui' || g.mode === 'photo')) {
        hud.frame({
          hour: session.clock.hour, mode: session.mode, objective: session.engine.currentObjective(), arrow: g.objectiveArrow(),
          evidence: session.state.evidence.size, total: CASE_01.evidence.length, photoNearby: g.photoNearby,
        })
      }
      input.endFrame()
    },
  })
  loopRef = loop
  loop.start()

  // Debug/test hook (read-only use): smoke tests inspect game state through it.
  ;(window as unknown as { __ltt: unknown }).__ltt = {
    get game() { return g }, get session() { return session }, shell, hud, input, events, profiles, settings,
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
