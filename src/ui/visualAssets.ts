import type { CharacterId, EvidenceId, PlaceId } from '../data/types'

export type SceneArt = { src: string; mobileSrc?: string; alt: string; mood: string; contain?: boolean; credit?: { label: string; href: string } }

/** Original portraits for the recurring cast; these are presentation-only and never drive story logic. */
export const CHARACTER_ART: Partial<Record<CharacterId, { src: string; alt: string }>> = {
  nabil_survey: { src: new URL('../assets/portraits/nabil_survey.webp', import.meta.url).href, alt: 'عم نبيل بجاكت بني وكوفية رمادي' },
  mona_archive: { src: new URL('../assets/portraits/mona_archive.webp', import.meta.url).href, alt: 'منى بحجاب فاتح وجاكت كحلي' },
  yassin: { src: new URL('../assets/characters/yassin.webp', import.meta.url).href, alt: 'ياسين، طالب هندسة ومساعد مساحة' },
  zeinab: { src: new URL('../assets/characters/zeinab.webp', import.meta.url).href, alt: 'الحاجة مهدية، جدة ياسين وخيّاطة متقاعدة' },
  hassan: { src: new URL('../assets/characters/hassan.webp', import.meta.url).href, alt: 'عم حسن، فلاح أبيس وشاهد على الأراضي القديمة' },
  ragab: { src: new URL('../assets/characters/ragab.webp', import.meta.url).href, alt: 'المعلم رجب، صاحب قهوة العزبة' },
  mahmoud: { src: new URL('../assets/characters/mahmoud.webp', import.meta.url).href, alt: 'محمود، مهندس المساحة المفقود' },
  shawky: { src: new URL('../assets/characters/shawky.webp', import.meta.url).href, alt: 'المعلم شوقي، سمسار الأراضي' },
  bahr: { src: new URL('../assets/characters/bahr.webp', import.meta.url).href, alt: 'عم بحر، صياد من ميناء القلعة' },
  fathy: { src: new URL('../assets/characters/fathy.webp', import.meta.url).href, alt: 'عم فتحي، حارس موقع عمود السواري' },
  am_mahdi: { src: new URL('../assets/portraits/am_mahdi.webp', import.meta.url).href, alt: 'عم مهدي، صاحب قهوة عم مهدي في قرية ١٥' },
  am_arafa: { src: new URL('../assets/portraits/am_arafa.webp', import.meta.url).href, alt: 'عم عرفة، صاحب قهوة ناصية قرية ١٥' },
  ahmed_basheer: { src: new URL('../assets/portraits/ahmed_basheer.webp', import.meta.url).href, alt: 'أحمد بشير، صاحب ياسين من عزبة ٥ الثورة الرئيسية' },
  alaa_emad: { src: new URL('../assets/portraits/alaa_emad.webp', import.meta.url).href, alt: 'علاء عماد، مساعد قياس وزمل ياسين من قرية ٥/٨ التمنيات' },
}

/** Original fictional environments; existing landmark imagery stays unchanged. */
export const SCENE_ART: Partial<Record<PlaceId, SceneArt>> = {
  kom_dikka: { src: new URL('../assets/scenes/kom-dikka.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/phone/kom-dikka.webp', import.meta.url).href, alt: 'المسرح الروماني بكوم الدكة ليلًا تحت إضاءة هادئة وضباب الإسكندرية', mood: 'صدى الحجر • كوم الدكة' },
  alex_museum: { src: new URL('../assets/scenes/alex-museum.webp', import.meta.url).href, alt: 'واجهة متحف الإسكندرية القومي الهادئة', mood: 'ذاكرة الورق • المتحف القومي' },
  zeinab_home: { src: new URL('../assets/scenes/zeinab-home.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/phone/zeinab-home.webp', import.meta.url).href, alt: 'أوضة ريفية قديمة، ماكينة خياطة ستّك مهدية وضوء دافي', mood: 'دفا البيت • عند ستّك' },
  mahmoud_house: { src: new URL('../assets/scenes/abis-house.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/phone/abis-house.webp', import.meta.url).href, alt: 'باب بيت محمود الأخضر وعليه الخيط الأحمر', mood: 'باب مقفول • أثر أحمر' },
  cafe_ragab: { src: new URL('../assets/scenes/cafe-ragab.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/phone/cafe-ragab.webp', import.meta.url).href, alt: 'قهوة المعلم رجب تحت تعريشة عنب، كراسي وشاي وتليفزيون بعيد', mood: 'دخان الشاي • القهوة' },
  abis_mosque: { src: new URL('../assets/scenes/abis-mosque.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/phone/abis-mosque.webp', import.meta.url).href, alt: 'واجهة جامع قرية ١٥ الحجري الهادئ وقت المغرب', mood: 'سكون الجامع • قرية ١٥' },
  mudayfa: { src: new URL('../assets/scenes/mudayfa.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/phone/mudayfa.webp', import.meta.url).href, alt: 'مضيفة قرية ١٥ المفتوحة وفي ضهرها مئذنة وجدار الجامع', mood: 'المضيفة • في ضهرها الجامع' },
  cafe_mahdi: { src: new URL('../assets/scenes/cafe-mahdi.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/phone/cafe-mahdi.webp', import.meta.url).href, alt: 'قهوة عم مهدي بسقفها القش وترابيزاتها القديمة في قرية ١٥', mood: 'لمّة المغرب • قهوة عم مهدي' },
  cafe_arafa: { src: new URL('../assets/scenes/cafe-arafa.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/phone/cafe-arafa.webp', import.meta.url).href, alt: 'قهوة عم عرفة على ناصية شارع قرية ١٥ وناسها حوالين الكراسي', mood: 'ناصية الشارع • قهوة عم عرفة' },
  thawra_ezba5: { src: new URL('../assets/scenes/thawra-ezba5.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/phone/thawra-ezba5.webp', import.meta.url).href, alt: 'عزبة ٥ بالثورة الرئيسية على شط الترعة ومركب خشب ومكنة الري', mood: 'ترعة الثورة • عزبة ٥' },
  tamanyat_5_8: { src: new URL('../assets/scenes/tamanyat-5-8.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/phone/tamanyat-5-8.webp', import.meta.url).href, alt: 'شارع قرية ٥/٨ التمنيات ببيوت الطوب الأحمر والنخل وقت العصر', mood: 'طريق التمنيات • قرية ٥/٨' },
  canal_bridge: { src: new URL('../assets/scenes/canal-bridge.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/canal-bridge-mobile.webp', import.meta.url).href, alt: 'كوبري خرساني ضيق على الترعة وماء يعكس أنوار الليل', mood: 'ضباب الميّه • الكوبري' },
  plot15: { src: new URL('../assets/scenes/plot15.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/phone/plot15.webp', import.meta.url).href, alt: 'حقل برسيم على حافة الترعة وحجر حدودي عند طرف الأرض', mood: 'تراب طازة • القطعة ١٥' },
  abis_stop: { src: new URL('../assets/scenes/abis-stop.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/abis-stop-mobile.webp', import.meta.url).href, alt: 'مظلة صاج ودكة وميكروباص على طريق ريفي عند الغروب', mood: 'آخر ضو • الموقف' },
  raml_stop: { src: new URL('../assets/scenes/raml-stop.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/raml-stop-mobile.webp', import.meta.url).href, alt: 'شوارع الإسكندرية القديمة عند محطة الرمل مع الترام', mood: 'صوت الترام • المدينة' },
  mansheya: { src: new URL('../assets/scenes/mansheya.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/phone/mansheya.webp', import.meta.url).href, alt: 'شارع حضري قديم ومكتب عقارات مضاء في المنشية', mood: 'نور المكتب • المنشية' },
  qaitbay: { src: new URL('../assets/scenes/qaitbay-harbor.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/phone/qaitbay-harbor.webp', import.meta.url).href, alt: 'قلعة قايتباي والمراكب عند الميناء', mood: 'ريح البحر • الميناء' },
  bibliotheca: { src: new URL('../assets/scenes/bibliotheca.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/phone/bibliotheca.webp', import.meta.url).href, alt: 'مكتبة الإسكندرية وجدارها الحجري', mood: 'الحروف والسر • المكتبة' },
  pompey: { src: new URL('../assets/scenes/pompey.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/phone/pompey.webp', import.meta.url).href, alt: 'منطقة عمود السواري وأبي الهول في كرموز بالإسكندرية وقت الغروب', mood: 'أثر قديم • كرموز' },
  corniche: { src: new URL('../assets/scenes/corniche.webp', import.meta.url).href, mobileSrc: new URL('../assets/scenes/phone/corniche.webp', import.meta.url).href, alt: 'كورنيش الإسكندرية ليلاً، سور وموج وأنوار على البحر', mood: 'موج وشبورة • الكورنيش' },
}

export const MAHMOUD_STUDY: SceneArt = {
  src: new URL('../assets/scenes/mahmoud-study.webp', import.meta.url).href,
  mobileSrc: new URL('../assets/scenes/mahmoud-study-mobile.webp', import.meta.url).href,
  alt: 'داخل بيت محمود: مكتب عليه دفتر مساحة، معطف على اليسار وباب أخضر على اليمين',
  mood: 'المفتاح معاك • داخل البيت',
}

/** Illustrative close-ups supplement, but never replace, the original evidence text. */
export const EVIDENCE_ART: Partial<Record<EvidenceId, { src: string; alt: string }>> = {
  e_odeon_negative: { src: new URL('../assets/evidence/e_odeon_negative.webp', import.meta.url).href, alt: 'نيجاتيف قديم في غلاف بعلامتين حمراوين' },
  e_museum_receipt: { src: new URL('../assets/evidence/e_museum_receipt.webp', import.meta.url).href, alt: 'إيصال أرشيف قديم بختم وخطين حمراوين' },
  e_amna_letter: { src: new URL('../assets/evidence/e_amna_letter.webp', import.meta.url).href, alt: 'جواب مطوي بجوار رسم حدود للأرض بقلم أحمر' },
  e_thread_door: { src: new URL('../assets/evidence/e_thread_door.webp', import.meta.url).href, alt: 'صورة توضيحية لخيط أحمر معقود على مقبض باب أخضر' },
  e_survey_book: { src: new URL('../assets/evidence/e_survey_book.webp', import.meta.url).href, alt: 'صورة توضيحية لدفتر مساحة مفتوح ورسم حدود الأرض' },
  e_microbus_ticket: { src: new URL('../assets/evidence/e_microbus_ticket.webp', import.meta.url).href, alt: 'صورة توضيحية لتذكرة ورقية مكرمشة في جيب معطف' },
  e_boundary_stone: { src: new URL('../assets/evidence/e_boundary_stone.webp', import.meta.url).href, alt: 'صورة توضيحية لحجر حدودي وتربة مضطربة وآثار على الطين' },
  e_forged_contract: { src: new URL('../assets/evidence/e_forged_contract.webp', import.meta.url).href, alt: 'صورة توضيحية لعقد ورقي في ملف أزرق بختم وتوقيع' },
  e_library_envelope: { src: new URL('../assets/evidence/e_library_envelope.webp', import.meta.url).href, alt: 'صورة توضيحية لمظروف أصفر وشهادة المساحة الأصلية' },
  e_cafe_bill: { src: new URL('../assets/evidence/e_cafe_bill.webp', import.meta.url).href, alt: 'صورة توضيحية لدفتر حساب القهوة على ترابيزة الشاي' },
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
