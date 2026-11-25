import type { CharacterId, EvidenceId, PlaceId } from '../data/types'

export type SceneArt = { src: string; mobileSrc?: string; alt: string; mood: string; contain?: boolean; credit?: { label: string; href: string } }

/** Original portraits for the recurring cast; these are presentation-only and never drive story logic. */
export const CHARACTER_ART: Record<CharacterId, { src: string; alt: string }> = {
  yassin: { src: new URL('../assets/characters/yassin.webp', import.meta.url).href, alt: 'ياسين، طالب هندسة ومساعد مساحة' },
  zeinab: { src: new URL('../assets/characters/zeinab.webp', import.meta.url).href, alt: 'الحاجة زينب، جدة ياسين وخيّاطة متقاعدة' },
  hassan: { src: new URL('../assets/characters/hassan.webp', import.meta.url).href, alt: 'عم حسن، فلاح أبيس وشاهد على الأراضي القديمة' },
  ragab: { src: new URL('../assets/characters/ragab.webp', import.meta.url).href, alt: 'المعلم رجب، صاحب قهوة العزبة' },
  mahmoud: { src: new URL('../assets/characters/mahmoud.webp', import.meta.url).href, alt: 'محمود، مهندس المساحة المفقود' },
  shawky: { src: new URL('../assets/characters/shawky.webp', import.meta.url).href, alt: 'المعلم شوقي، سمسار الأراضي' },
  bahr: { src: new URL('../assets/characters/bahr.webp', import.meta.url).href, alt: 'عم بحر، صياد من ميناء القلعة' },
  fathy: { src: new URL('../assets/characters/fathy.webp', import.meta.url).href, alt: 'عم فتحي، حارس موقع عمود السواري' },
}

/** Original fictional environments; existing landmark imagery stays unchanged. */
export const SCENE_ART: Record<PlaceId, SceneArt> = {
  zeinab_home: { src: new URL('../assets/scenes/zeinab-room.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/zeinab-room-mobile.webp', import.meta.url).href, alt: 'أوضة ريفية قديمة، ماكينة خياطة وباب أخضر وضوء فانوس', mood: 'ضوء الفانوس • البيت' },
  mahmoud_house: { src: new URL('../assets/scenes/abis-house.webp', import.meta.url).href, alt: 'باب بيت محمود الأخضر وعليه الخيط الأحمر', mood: 'باب مقفول • أثر أحمر' },
  cafe_ragab: { src: new URL('../assets/scenes/ragab-cafe.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/ragab-cafe-mobile.webp', import.meta.url).href, alt: 'قهوة ريفية تحت تعريشة عنب، كراسي وشاي وتليفزيون بعيد', mood: 'دخان الشاي • القهوة' },
  abis_mosque: { src: new URL('../assets/scenes/abis-mosque-yard.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/abis-mosque-yard-mobile.webp', import.meta.url).href, alt: 'ساحة جامع ريفي صغير ودكة حجرية وقت الغروب', mood: 'سكون الساحة • الجامع' },
  canal_bridge: { src: new URL('../assets/scenes/canal-bridge.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/canal-bridge-mobile.webp', import.meta.url).href, alt: 'كوبري خرساني ضيق على الترعة وماء يعكس أنوار الليل', mood: 'ضباب الميّه • الكوبري' },
  plot15: { src: new URL('../assets/scenes/plot15-field.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/plot15-field-mobile.webp', import.meta.url).href, alt: 'حقل برسيم على حافة الترعة وحجر حدودي عند طرف الأرض', mood: 'تراب طازة • القطعة ١٥' },
  abis_stop: { src: new URL('../assets/scenes/abis-stop.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/abis-stop-mobile.webp', import.meta.url).href, alt: 'مظلة صاج ودكة وميكروباص على طريق ريفي عند الغروب', mood: 'آخر ضو • الموقف' },
  raml_stop: { src: new URL('../assets/scenes/raml-stop.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/raml-stop-mobile.webp', import.meta.url).href, alt: 'مشهد مستوحى من شوارع الإسكندرية القديمة مع ترام أصفر', mood: 'صوت الترام • المدينة' },
  mansheya: { src: new URL('../assets/scenes/mansheya-office.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/mansheya-office-mobile.webp', import.meta.url).href, alt: 'شارع حضري قديم ومكتب عقارات مضاء وعربية سوداء', mood: 'نور المكتب • المنشية' },
  qaitbay: { src: new URL('../assets/scenes/qaitbay-harbor.webp', import.meta.url).href, alt: 'قلعة قايتباي والمراكب عند الميناء', mood: 'ريح البحر • الميناء' },
  bibliotheca: { src: new URL('../assets/scenes/bibliotheca.webp', import.meta.url).href, alt: 'مكتبة الإسكندرية وجدارها الحجري', mood: 'الحروف والسر • المكتبة' },
  pompey: { src: new URL('../assets/scenes/pompeys-pillar.webp', import.meta.url).href, alt: 'صورة حقيقية لعمود السواري وأبي الهول في الإسكندرية، تصوير Daniel Mayer', mood: 'أثر قديم • كرموز', contain: true, credit: { label: 'Daniel Mayer • CC BY-SA 4.0', href: new URL('../assets/scenes/pompeys-pillar-license.txt', import.meta.url).href } },
  corniche: { src: new URL('../assets/scenes/corniche-night.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/corniche-night-mobile.webp', import.meta.url).href, alt: 'كورنيش ليلي مستوحى من الإسكندرية، سور وموج وأنوار في الضباب', mood: 'موج وشبورة • الكورنيش' },
}

export const MAHMOUD_STUDY: SceneArt = {
  src: new URL('../assets/scenes/mahmoud-study.webp', import.meta.url).href,
  mobileSrc: new URL('../assets/scenes/mahmoud-study-mobile.webp', import.meta.url).href,
  alt: 'داخل بيت محمود: مكتب عليه دفتر مساحة، معطف على اليسار وباب أخضر على اليمين',
  mood: 'المفتاح معاك • داخل البيت',
}

/** Illustrative close-ups supplement, but never replace, the original evidence text. */
export const EVIDENCE_ART: Partial<Record<EvidenceId, { src: string; alt: string }>> = {
  e_thread_door: { src: new URL('../assets/evidence/red-thread.webp', import.meta.url).href, alt: 'صورة توضيحية لخيط أحمر معقود على مقبض باب أخضر' },
  e_survey_book: { src: new URL('../assets/evidence/survey-book.webp', import.meta.url).href, alt: 'صورة توضيحية لدفتر مساحة مفتوح ورسم حدود الأرض' },
  e_microbus_ticket: { src: new URL('../assets/evidence/ticket.webp', import.meta.url).href, alt: 'صورة توضيحية لتذكرة ورقية مكرمشة في جيب معطف' },
  e_boundary_stone: { src: new URL('../assets/evidence/boundary-stone.webp', import.meta.url).href, alt: 'صورة توضيحية لحجر حدودي وتربة مضطربة وآثار على الطين' },
  e_forged_contract: { src: new URL('../assets/evidence/forged-contract.webp', import.meta.url).href, alt: 'صورة توضيحية لعقد ورقي في ملف أزرق بختم وتوقيع' },
  e_library_envelope: { src: new URL('../assets/evidence/envelope.webp', import.meta.url).href, alt: 'صورة توضيحية لمظروف أصفر وشهادة المساحة الأصلية' },
  e_cafe_bill: { src: new URL('../assets/evidence/cafe-ledger.webp', import.meta.url).href, alt: 'صورة توضيحية لدفتر حساب القهوة على ترابيزة الشاي' },
}

/** Scene-space anchors instead of the former 3D-coordinate projection. */
export const HOTSPOT_ANCHORS: Record<string, { x: number; y: number }> = {
  hs_door_thread: { x: 78, y: 53 }, hs_desk: { x: 49, y: 58 }, hs_coat: { x: 20, y: 42 },
  hs_sewing: { x: 25, y: 59 }, hs_stone: { x: 78, y: 62 },
  hs_bus_city: { x: 60, y: 55 }, hs_bus_abis: { x: 54, y: 53 },
  hs_photo_library: { x: 52, y: 47 }, hs_locker: { x: 75, y: 58 },
  hs_photo_pompey: { x: 50, y: 41 }, hs_photo_qaitbay: { x: 50, y: 45 }, hs_shed: { x: 72, y: 63 },
  hs_office_window: { x: 69, y: 51 },
}
