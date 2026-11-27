import { arabicDigits } from '../core/clock'
import { REGIONS, YEARS, type MemoryPlace } from '../data/memoryWorld'
import { h } from './dom'

const MEMORY_ART = import.meta.glob('../assets/memory/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const SCENE_NIGHT = import.meta.glob('../assets/scenes/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const SCENE_DAY = import.meta.glob('../assets/scenes/day/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const pick = (files: Record<string, string>, stem: string) =>
  files[Object.keys(files).find(k => k.endsWith(`/${stem}.webp`)) ?? ''] ?? ''

const mem = (stem: string) => pick(MEMORY_ART, stem)
const night = (stem: string) => pick(SCENE_NIGHT, stem)
const day = (stem: string) => pick(SCENE_DAY, stem) || night(stem)
const docPhoto = (stem: string, preferDay = false) =>
  mem(stem) || (preferDay ? day(stem) : night(stem)) || night(stem)

export type MemoryScenePhoto = {
  src: string
  alt: string
  era: '1992' | '2002' | '2011' | '2021' | '2026' | 'present'
  yearLabel: string
}

const ARCHIVE_PLATES = [
  mem('dakka-alama'),
  mem('survey-room'),
  mem('narrow-alley'),
  mem('custody-window'),
  mem('darkroom'),
  mem('archive-courtyard'),
  mem('testimony-hall'),
  mem('saha-ijtimaa'),
  mem('reading-podium'),
]

/** Era-linked historical photography (real events + documentary scenes) for past mode. */
const ERA_PAST_POOLS: Record<number, string[]> = {
  // 1992 Earthquake + 90s Abis/Alex records
  0: [mem('event-1992-quake'), mem('survey-room'), mem('dakka-alama'), mem('narrow-alley'), night('kom-dikka')],
  // 2002 Bibliotheca opening + early Abis surveys
  1: [mem('alex-bibliotheca'), night('bibliotheca'), mem('custody-window'), night('abis-stop'), night('rail-crossing')],
  // 2011 Revolution squares + street witnesses
  2: [mem('event-2011-alex'), mem('testimony-hall'), day('mansheya'), day('raml-stop'), day('mudayfa')],
  // 2021 Royal Mummies Parade + coastal/canal verification
  3: [mem('event-2021-mummies'), mem('alex-harbor'), day('thawra-ezba5'), night('pump-station'), day('guava-orchard')],
  // 2026 Raml Tram modernization + Ahly café & final sessions
  4: [mem('alex-tram'), mem('event-ahly-match'), night('cafe-mahdi'), night('cafe-arafa'), mem('saha-ijtimaa')],
}

export function resolveMemoryScene(place: MemoryPlace, past: boolean): MemoryScenePhoto {
  const region = REGIONS[place.region]
  const regionPhoto = region[6]
  const alt = `${place.site[0]} — ${place.site[1]} (${region[0]})`
  if (!past) {
    // Cycle across region's signature photo and nearby clean landmark plates so each of 5 slots feels distinct
    const fallbackAlex = [mem('alex-mahatat-misr'), mem('alex-opera'), mem('alex-mahmoudia'), mem('alex-shatby'), mem('alex-bakous')]
    const fallbackAbis = [day(regionPhoto), night(regionPhoto), mem('abis-canal-1'), mem('abis-canal-2'), mem('abis-fields-farmers')]
    const presentPool = region[1] === 'الإسكندرية'
      ? [docPhoto(regionPhoto, true), mem(regionPhoto) || day('corniche'), fallbackAlex[place.slot % fallbackAlex.length], mem('alex-harbor'), day('bibliotheca')]
      : [docPhoto(regionPhoto, true), day(regionPhoto), fallbackAbis[(place.region + place.slot) % fallbackAbis.length], day('tamanyat-5-8'), mem('abis-mosque-facade')]
    const src = presentPool[place.slot % presentPool.length] || docPhoto(regionPhoto, true) || ARCHIVE_PLATES[place.id % ARCHIVE_PLATES.length]
    return { src, alt, era: 'present', yearLabel: arabicDigits(2026) }
  }

  const eraPool = ERA_PAST_POOLS[place.phase] ?? ARCHIVE_PLATES
  const pastChoices = [
    eraPool[place.slot % eraPool.length],
    ARCHIVE_PLATES[(place.region + place.slot) % ARCHIVE_PLATES.length],
    docPhoto(regionPhoto, false),
  ].filter(Boolean)
  const src = pastChoices[place.slot === 0 ? 0 : (place.region + place.slot) % pastChoices.length] || ARCHIVE_PLATES[0]
  const year = String(YEARS[place.phase] ?? 2026) as MemoryScenePhoto['era']
  return { src, alt, era: year, yearLabel: arabicDigits(YEARS[place.phase] ?? 2026) }
}

export function createMemorySceneFigure(place: MemoryPlace, past: boolean): HTMLElement {
  const photo = resolveMemoryScene(place, past)
  return h('figure', { class: 'memory-plate', 'data-era': photo.era },
    h('img', {
      class: 'memory-photo',
      src: photo.src,
      alt: photo.alt,
      loading: 'lazy',
      decoding: 'async',
    }),
    h('figcaption', { class: 'memory-plate-caption' },
      h('span', null, place.site[0]),
      h('span', { class: 'memory-plate-year' }, `${photo.yearLabel} · ${REGIONS[place.region][0]}`)))
}
