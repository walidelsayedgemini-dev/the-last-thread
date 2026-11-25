/**
 * Art lookup: scene photographs (night + optional daytime variant) and character portraits
 * (neutral + optional "tense" variant). Files are discovered with Vite globs, so missing variants
 * simply fall back to the night/neutral image and new art only needs to be dropped in the folder.
 */
import type { Avatar } from '../services/profiles'

const NIGHT = import.meta.glob('../assets/scenes/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const DAY = import.meta.glob('../assets/scenes/day/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const PHONE = import.meta.glob('../assets/scenes/phone/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const PHONE_DAY = import.meta.glob('../assets/scenes/phone/day/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const PORTRAITS = import.meta.glob('../assets/portraits/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const TITLE = import.meta.glob('../assets/title-bg.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

/** Which photograph belongs to each place (file stem in src/assets/scenes). */
const SCENE_FILE: Record<string, string> = {
  zeinab_home: 'zeinab-home',
  mahmoud_house: 'abis-house',
  cafe_ragab: 'cafe-ragab',
  abis_mosque: 'abis-mosque',
  canal_bridge: 'canal-bridge',
  plot15: 'plot15',
  abis_stop: 'abis-stop',
  raml_stop: 'raml-stop',
  mansheya: 'mansheya',
  qaitbay: 'qaitbay-harbor',
  bibliotheca: 'bibliotheca',
  pompey: 'pompey',
  corniche: 'corniche',
}

const byStem = (files: Record<string, string>, stem: string) => files[Object.keys(files).find(k => k.endsWith(`/${stem}.webp`)) ?? '']

/** Daylight runs from 07:00 to 17:00 (in-game or real Cairo time). */
export const isDaytime = (hour: number) => hour >= 7 && hour < 17

export function sceneUrl(placeId: string, hour = 21): string {
  const stem = SCENE_FILE[placeId] ?? 'abis-fields'
  const night = byStem(NIGHT, stem) ?? byStem(NIGHT, 'abis-fields')
  return (isDaytime(hour) && byStem(DAY, stem)) || night
}

/** Responsive sources for the current scene; the public sceneUrl API remains synchronous. */
export function sceneSrcSet(placeId: string, hour = 21): string {
  const stem = SCENE_FILE[placeId] ?? 'abis-fields'
  const phone = (isDaytime(hour) && byStem(PHONE_DAY, stem)) || byStem(PHONE, stem)
  const full = sceneUrl(placeId, hour)
  return phone ? `${phone} 960w, ${full} 1600w` : full
}

/** Same-district neighbors are cheap to preload; every other scene stays out of the request queue. */
export function sceneNeighbors(placeId: string): string[] {
  const ids = Object.keys(SCENE_FILE)
  const index = Math.max(0, ids.indexOf(placeId))
  const district = placeId.includes('raml') || placeId === 'mansheya' || placeId === 'qaitbay' || placeId === 'bibliotheca' || placeId === 'pompey' || placeId === 'corniche' ? 'city' : 'abis'
  const same = ids.filter(id => (id.includes('raml') || id === 'mansheya' || id === 'qaitbay' || id === 'bibliotheca' || id === 'pompey' || id === 'corniche' ? 'city' : 'abis') === district)
  const at = Math.max(0, same.indexOf(placeId))
  return [same[at - 1], same[at + 1]].filter((id): id is string => Boolean(id) && id !== ids[index])
}

export function titleArt(): string | undefined {
  return Object.values(TITLE)[0]
}

/** Portrait for an NPC id, or the player (Yassin / female investigator / custom). */
export function portraitUrl(id: string, variant: 'neutral' | 'tense' = 'neutral'): string | undefined {
  const base = byStem(PORTRAITS, id)
  if (variant === 'tense') return byStem(PORTRAITS, `${id}-tense`) ?? base
  return base
}

export function playerPortrait(avatar?: Partial<Avatar>, variant: 'neutral' | 'tense' = 'neutral'): string | undefined {
  if (avatar?.gender === 'female') return portraitUrl('player-f', variant)
  return portraitUrl('yassin', variant)
}

/**
 * Hand-placed pin positions (percent of the scene photograph) so markers sit on the object they
 * describe. Hotspots without an entry fall back to a position derived from their world offset.
 */
export const PIN_POS: Record<string, { x: number; y: number }> = {
  hs_sewing: { x: 14, y: 50 },
  hs_door_thread: { x: 74, y: 44 },
  hs_desk: { x: 44, y: 70 },
  hs_coat: { x: 88, y: 36 },
  hs_stone: { x: 36, y: 62 },
  hs_bus_city: { x: 70, y: 62 },
  hs_bus_abis: { x: 86, y: 62 },
  hs_photo_library: { x: 78, y: 34 },
  hs_locker: { x: 64, y: 62 },
  hs_photo_pompey: { x: 74, y: 40 },
  hs_photo_qaitbay: { x: 38, y: 30 },
  hs_shed: { x: 44, y: 64 },
  hs_office_window: { x: 54, y: 58 },
}
