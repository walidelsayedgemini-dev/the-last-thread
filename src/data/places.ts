import type { Place, PlaceId } from './types'

/**
 * World layout. The playable map compresses the real geography: the city (and the sea to its north)
 * occupies negative Z; Abis lies to the south-east across the farmland and is linked by the
 * microbus line. Landmark GPS anchors are the real public coordinates used for field photography.
 */
export const PLACES: Record<PlaceId, Place> = {
  zeinab_home: {
    id: 'zeinab_home', name: 'بيت ستّك زينب', short: 'البيت', mapPos: { lat: 31.1472, lng: 30.0062 }, realSite: false, district: 'abis', pos: { x: 40, z: 240 },
    description: 'بيت طوب أحمر بدورين في آخر شارع الجامع في عزبة ١٥. الباب الأخضر مشقق من الشمس، وماكينة الخياطة السنجر بتاعة ستّك لسه بتشتغل بالرجل. هنا بتصحى وهنا بترجع تنام.',
  },
  mahmoud_house: {
    id: 'mahmoud_house', name: 'بيت خالك محمود', short: 'بيت الخال', mapPos: { lat: 31.1478, lng: 30.0079 }, realSite: false, district: 'abis', pos: { x: 95, z: 205 },
    description: 'أوضتين وصالة قريبين من الترعة، الشبابيك الزرقا مقفولة من تلات أيام. على الباب خيط أحمر مربوط في المقبض: نفس الخيط اللي أمك الله يرحمها كانت بتربطه في إيد خالك.',
  },
  cafe_ragab: {
    id: 'cafe_ragab', name: 'قهوة المعلم رجب', short: 'القهوة', mapPos: { lat: 31.1465, lng: 30.0068 }, realSite: false, district: 'abis', pos: { x: 5, z: 205 },
    description: 'كراسي خشب وترابيزات صاج تحت تعريشة عنب، وتليفزيون معلّق على الحيطة مايتطفيش وقت ماتشات الاتحاد. كل أخبار العزبة بتعدّي من هنا قبل ما توصل لأصحابها.',
  },
  abis_mosque: {
    id: 'abis_mosque', name: 'جامع العزبة', short: 'الجامع', mapPos: { lat: 31.1461, lng: 30.008 }, realSite: false, district: 'abis', pos: { x: 70, z: 268 },
    description: 'جامع صغير بمادنة بيضا وقبة خضرا. عم حسن بيقعد على دكّته بعد صلاة العصر يحكي عن أيام ما كانت أبيس كلها أرض زراعية.',
  },
  canal_bridge: {
    id: 'canal_bridge', name: 'كوبري الترعة', short: 'الكوبري', mapPos: { lat: 31.1488, lng: 30.007 }, realSite: false, district: 'abis', pos: { x: 40, z: 150 },
    description: 'كوبري خرساني ضيق على ترعة المحمودية الفرعية. العربيات الملاكي نادراً ما بتعدّي هنا، فأي عربية غريبة بتتشاف.',
  },
  plot15: {
    id: 'plot15', name: 'أرض القطعة ١٥', short: 'القطعة ١٥', mapPos: { lat: 31.1495, lng: 30.0092 }, realSite: false, district: 'abis', pos: { x: 150, z: 168 },
    description: 'فدانين برسيم على حافة الترعة. خالك كان بيقيسها الأسبوع اللي فات لحساب الجمعية، وفيه كلام إن الطريق الجديد هيعدّي من هنا وسعر القيراط هيضرب السما.',
  },
  abis_stop: {
    id: 'abis_stop', name: 'موقف ميكروباص أبيس', short: 'الموقف', mapPos: { lat: 31.1455, lng: 30.005 }, realSite: false, district: 'abis', pos: { x: -30, z: 185 },
    description: 'مظلة صاج ودكة أسمنت ويافطة باهتة: "أبيس – محطة الرمل". السواق عم سيد بينادي على الركاب من الفجر للعشا.',
  },
  raml_stop: {
    id: 'raml_stop', name: 'موقف محطة الرمل', short: 'محطة الرمل', mapPos: { lat: 31.2014, lng: 29.9011 }, realSite: true, district: 'city', pos: { x: 0, z: -195 },
    description: 'قلب إسكندرية: الترام الأصفر بيرن، وريحة البحر والفول والكتب القديمة على الرصيف مختلطين.',
  },
  mansheya: {
    id: 'mansheya', name: 'المنشية – مكتب شوقي', short: 'المنشية', mapPos: { lat: 31.1989, lng: 29.8933 }, realSite: true, district: 'city', pos: { x: -140, z: -215 },
    description: 'عمارات إيطالي قديمة بشبابيك خشب. تحت واحدة منهم مكتب "شوقي للعقارات والاستثمار"، وقدامه دايماً عربية مرسيدس سودا.',
  },
  qaitbay: {
    id: 'qaitbay', name: 'قلعة قايتباي', short: 'القلعة', mapPos: { lat: 31.2137, lng: 29.8855 }, realSite: true, district: 'city', pos: { x: -330, z: -325 }, photographable: true,
    geo: { lat: 31.21403, lng: 29.88564, radiusM: 450 },
    description: 'قلعة السلطان قايتباي مبنية على أنقاض فنار إسكندرية القديم. مراكب الصيادين الزرقا راسية عند سور الميناء الشرقي.',
  },
  bibliotheca: {
    id: 'bibliotheca', name: 'مكتبة الإسكندرية', short: 'المكتبة', mapPos: { lat: 31.2087, lng: 29.9089 }, realSite: true, district: 'city', pos: { x: 130, z: -250 }, photographable: true,
    geo: { lat: 31.20888, lng: 29.90916, radiusM: 450 },
    description: 'قرص مايل ناحية البحر، وجدار جرانيت محفور عليه حروف من كل لغات الدنيا. خالك كان بيقول إن الحروف دي "بتحفظ السر أحسن من الخزنة".',
  },
  pompey: {
    id: 'pompey', name: 'عمود السواري', short: 'العمود', mapPos: { lat: 31.1819, lng: 29.8965 }, realSite: true, district: 'city', pos: { x: -210, z: -120 }, photographable: true,
    geo: { lat: 31.18251, lng: 29.89633, radiusM: 450 },
    description: 'عمود جرانيت أحمر طوله ٢٧ متر فوق تل كرموز، وحواليه أبو الهول صغير وأطلال. عم فتحي بيحرسه بقاله تلاتين سنة.',
  },
  corniche: {
    id: 'corniche', name: 'الكورنيش', short: 'الكورنيش', mapPos: { lat: 31.2058, lng: 29.9045 }, realSite: true, district: 'city', pos: { x: 0, z: -285 },
    description: 'سور الكورنيش الطويل، وأعمدة النور الصفرا بتترعش في الشبورة، والموج بيرزع في الصخر.',
  },
}

export const PLACE_LIST = Object.values(PLACES)
