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
const EVIDENCE = import.meta.glob('../assets/evidence/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const CINEMATICS = import.meta.glob('../assets/cinematics/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

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
  abis_market: 'abis-market',
  bakery: 'bakery',
  old_school: 'old-school',
  pump_station: 'pump-station',
  omda_house: 'omda-house',
  guava_orchard: 'guava-orchard',
  rail_crossing: 'rail-crossing',
  cemetery: 'cemetery',
  pigeon_tower: 'pigeon-tower',
  mill: 'mill',
  health_unit: 'health-unit',
  waterwheel: 'waterwheel',
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

export function titleArt(): string | undefined {
  return Object.values(TITLE)[0]
}

/** Close-up evidence art; absent IDs intentionally return undefined for future case streams. */
export function evidenceUrl(id: string): string | undefined {
  return byStem(EVIDENCE, id)
}

/** Widescreen intro/ending art, with a compact phone crop available for narrow screens. */
export function cinematicUrl(id: string, variant: 'desktop' | 'phone' = 'desktop'): string | undefined {
  return byStem(CINEMATICS, variant === 'phone' ? `${id}-phone` : id)
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
  hs_mahmoud_voicemail: { x: 34, y: 43 },
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
  hs_abis_market_scale: { x: 22, y: 53 },
  hs_abis_market_tricycle: { x: 70, y: 58 },
  hs_bakery_oven: { x: 25, y: 52 },
  hs_bakery_bread_racks: { x: 25, y: 68 },
  hs_old_school_noticeboard: { x: 18, y: 56 },
  hs_old_school_chalkboard: { x: 53, y: 47 },
  hs_pump_station_engine: { x: 31, y: 53 },
  hs_pump_station_logbook: { x: 42, y: 39 },
  hs_pump_station_drums: { x: 58, y: 50 },
  hs_omda_house_guestbook: { x: 23, y: 60 },
  hs_omda_house_car: { x: 65, y: 64 },
  hs_guava_orchard_ditch: { x: 55, y: 68 },
  hs_guava_orchard_hut: { x: 39, y: 45 },
  hs_rail_crossing_booth: { x: 73, y: 43 },
  hs_rail_crossing_tracks: { x: 51, y: 66 },
  hs_cemetery_tomb_door: { x: 20, y: 57 },
  hs_cemetery_lantern: { x: 31, y: 70 },
  hs_pigeon_tower_coop_door: { x: 50, y: 66 },
  hs_pigeon_tower_rings_box: { x: 61, y: 64 },
  hs_mill_calendar: { x: 68, y: 32 },
  hs_mill_sacks: { x: 59, y: 61 },
  hs_health_unit_register: { x: 22, y: 74 },
  hs_health_unit_pharmacy_window: { x: 33, y: 39 },
  hs_waterwheel_trough: { x: 58, y: 59 },
  hs_waterwheel_path: { x: 48, y: 70 },
  hs02_radio: { x: 28, y: 43 },
  hs02_manifest: { x: 63, y: 56 },
  hs03_staple: { x: 46, y: 60 },
  hs03_mud: { x: 34, y: 66 },
  hs03_register: { x: 23, y: 55 },
  hs03_lantern: { x: 58, y: 62 },
  hs03_note: { x: 71, y: 50 },
  hs03_negative: { x: 48, y: 62 },
  hs03_tide: { x: 65, y: 54 },
  hs03_lock: { x: 77, y: 64 },
  hs03_permit: { x: 43, y: 58 },
  hs_abis_market_scale_c2: { x: 22, y: 53 },
  hs_abis_market_crates_c2: { x: 37, y: 63 },
  hs_bakery_oven_c2: { x: 25, y: 52 },
  hs_bakery_ledger_c2: { x: 66, y: 63 },
  hs_old_school_noticeboard_c2: { x: 18, y: 56 },
  hs_old_school_chalkboard_c2: { x: 53, y: 47 },
  hs_pump_station_engine_c2: { x: 31, y: 53 },
  hs_pump_station_logbook_c2: { x: 42, y: 39 },
  hs_omda_house_guestbook_c2: { x: 23, y: 60 },
  hs_omda_house_door_c2: { x: 36, y: 50 },
  hs_guava_orchard_hut_c2: { x: 39, y: 45 },
  hs_guava_orchard_crates_c2: { x: 33, y: 66 },
  hs_rail_crossing_barrier_c2: { x: 33, y: 58 },
  hs_rail_crossing_booth_c2: { x: 73, y: 43 },
  hs_cemetery_tomb_door_c2: { x: 20, y: 57 },
  hs_cemetery_lantern_c2: { x: 31, y: 70 },
  hs_pigeon_tower_ladder_c2: { x: 38, y: 63 },
  hs_pigeon_tower_rings_box_c2: { x: 61, y: 64 },
  hs_mill_sacks_c2: { x: 59, y: 61 },
  hs_mill_calendar_c2: { x: 68, y: 32 },
  hs_health_unit_pharmacy_window_c2: { x: 33, y: 39 },
  hs_health_unit_register_c2: { x: 22, y: 74 },
  hs_waterwheel_wheel_c2: { x: 34, y: 43 },
  hs_waterwheel_trough_c2: { x: 58, y: 59 },
  hs_abis_market_scale_c3: { x: 22, y: 53 },
  hs_abis_market_crates_c3: { x: 37, y: 63 },
  hs_bakery_oven_c3: { x: 25, y: 52 },
  hs_bakery_ledger_c3: { x: 66, y: 63 },
  hs_old_school_noticeboard_c3: { x: 18, y: 56 },
  hs_old_school_chalkboard_c3: { x: 53, y: 47 },
  hs_pump_station_engine_c3: { x: 31, y: 53 },
  hs_pump_station_logbook_c3: { x: 42, y: 39 },
  hs_omda_house_guestbook_c3: { x: 23, y: 60 },
  hs_omda_house_door_c3: { x: 36, y: 50 },
  hs_guava_orchard_hut_c3: { x: 39, y: 45 },
  hs_guava_orchard_ditch_c3: { x: 55, y: 68 },
  hs_rail_crossing_barrier_c3: { x: 33, y: 58 },
  hs_rail_crossing_booth_c3: { x: 73, y: 43 },
  hs_cemetery_tomb_door_c3: { x: 20, y: 57 },
  hs_cemetery_lantern_c3: { x: 31, y: 70 },
  hs_pigeon_tower_ladder_c3: { x: 38, y: 63 },
  hs_pigeon_tower_coop_door_c3: { x: 50, y: 66 },
  hs_mill_millstone_c3: { x: 34, y: 67 },
  hs_mill_calendar_c3: { x: 68, y: 32 },
  hs_health_unit_pharmacy_window_c3: { x: 33, y: 39 },
  hs_health_unit_register_c3: { x: 22, y: 74 },
  hs_waterwheel_wheel_c3: { x: 34, y: 43 },
  hs_waterwheel_trough_c3: { x: 58, y: 59 },
}
