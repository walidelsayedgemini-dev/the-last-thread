import type { Place, PlaceId } from './types'

/**
 * World layout. The playable map compresses the real geography: the city (and the sea to its north)
 * occupies negative Z; Abis lies to the south-east across the farmland and is linked by the
 * microbus line. Landmark GPS anchors are the real public coordinates used for field photography.
 */
export const PLACES: Record<PlaceId, Place> = {
  kom_dikka: {
    id: 'kom_dikka', name: 'المسرح الروماني بكوم الدكة', short: 'كوم الدكة', realSite: true, district: 'city',
    mapPos: { lat: 31.1944, lng: 29.9046 }, pos: { x: 25, z: -108 },
    description: 'درجات حجر بتلف حوالين أرضية المسرح الروماني. على دكة برّه، عم نبيل مستني حد يسأله عن صورة بقالها سنين في شنطته.',
  },
  alex_museum: {
    id: 'alex_museum', name: 'متحف الإسكندرية القومي', short: 'المتحف القومي', realSite: true, district: 'city',
    mapPos: { lat: 31.2007, lng: 29.9136 }, pos: { x: 172, z: -151 },
    description: 'واجهة فيلا فاتحة وسلّم مزدوج على طريق الحرية. قرب المدخل، منى بتقابل أهل أبيس اللي مودعين صورهم في أرشيفها الأهلي.',
  },
  zeinab_home: {
    id: 'zeinab_home', name: 'بيت ستّك مهدية', short: 'البيت', mapPos: { lat: 31.1472, lng: 30.0062 }, realSite: false, district: 'abis', pos: { x: 40, z: 240 },
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
    id: 'abis_mosque', name: 'جامع قرية ١٥', short: 'الجامع', mapPos: { lat: 31.1461, lng: 30.008 }, realSite: false, district: 'abis', pos: { x: 70, z: 268 },
    description: 'جامع القرية بمئذنته البيضا وقبته القريبة، والمضيفة مبنية قدامه مباشرة في وش الشارع. عم حسن بيقعد هنا بعد العصر يحكي عن أيام ما كانت أبيس كلها أرض زراعية.',
  },
  mudayfa: {
    id: 'mudayfa', name: 'المضيفة — قرية ١٥', short: 'المضيفة', mapPos: { lat: 31.1463, lng: 30.0079 }, realSite: false, district: 'abis', pos: { x: 66, z: 256 },
    description: 'المضيفة المفتوحة بتاعة قرية ١٥، وفي ضهرها على طول جامع القرية بمئذنته البيضا. هنا بيتجمع كبار العزبة في المناسبات والعزا والقعدات العائلية ساعة الجد.',
  },
  cafe_mahdi: {
    id: 'cafe_mahdi', name: 'قهوة عم مهدي — قرية ١٥', short: 'قهوة عم مهدي', mapPos: { lat: 31.1474, lng: 30.0086 }, realSite: false, district: 'abis', pos: { x: 132, z: 220 },
    description: 'قهوة بلدي بسقف قش ولمبات دافية في قرية ١٥. الفلاحين وصنايعية العزبة بيتلمّوا فيها بعد الشغل على شاي براد وقعدة هادية بعيد عن زحمة الموقف.',
  },
  cafe_arafa: {
    id: 'cafe_arafa', name: 'قهوة عم عرفة — قرية ١٥', short: 'قهوة عم عرفة', mapPos: { lat: 31.1464, lng: 30.0091 }, realSite: false, district: 'abis', pos: { x: 152, z: 262 },
    description: 'قهوة ناصية في قلب قرية ١٥ عند تفرّع الشوارع الداخلية. كنكة الشاي ما بتبطلش على النار، وعم عرفة حافظ وش كل واحد دخل القرية من الصبح لليل.',
  },
  thawra_ezba5: {
    id: 'thawra_ezba5', name: 'عزبة ٥ — الثورة الرئيسية', short: 'عزبة ٥ / الثورة', mapPos: { lat: 31.1214, lng: 30.0039 }, realSite: false, district: 'abis', pos: { x: -45, z: 128 },
    description: 'عزبة ٥ على طريق الثورة الرئيسية جنب الترعة ومكنة الري القديمة. هنا ساكن أحمد بشير، وأي نقل تقيل بين قرية ١٥ والطريق العمومي بيعدّي من قدام بابهم.',
  },
  tamanyat_5_8: {
    id: 'tamanyat_5_8', name: 'قرية ٥/٨ — التمنيات', short: 'قرية ٥/٨', mapPos: { lat: 31.1328, lng: 30.0156 }, realSite: false, district: 'abis', pos: { x: 215, z: 185 },
    description: 'طريق هادي ببيوت طوب أحمر ونخل طويل في قرية خمسة تمانية (التمنيات). هنا بيت علاء عماد زميل ياسين في القياسات، وعنده أوراق حصر الترع القديمة.',
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
  abis_market: {
    id: 'abis_market', name: 'سوق التلات', short: 'السوق', mapPos: { lat: 31.1448, lng: 30.0035 }, realSite: false, district: 'abis', pos: { x: -70, z: 235 },
    description: 'سوق العزبة الأسبوعي: صناديق طماطم وبرتقال على الأرض، ميزان نحاس قديم، تروسيكلات محمّلة جرجير، ولمبات جاز متعلقة على حبال. كل حكاية في أبيس بتتباع هنا بنص التمن.',
  },
  bakery: {
    id: 'bakery', name: 'فرن أم سعيد البلدي', short: 'الفرن', mapPos: { lat: 31.1468, lng: 30.0072 }, realSite: false, district: 'abis', pos: { x: 10, z: 272 },
    description: 'فرن طوب لبن بيولّع من قبل الفجر. أقفاص العيش البلدي بتبرد على الرف، وشكاير الدقيق مرصوصة جنب دفتر صرف التموين. ريحة العيش السخن بتلم العزبة كلها.',
  },
  old_school: {
    id: 'old_school', name: 'مدرسة العزبة القديمة', short: 'المدرسة', mapPos: { lat: 31.1458, lng: 30.0095 }, realSite: false, district: 'abis', pos: { x: 125, z: 292 },
    description: 'مدرسة ابتدائي بدور واحد، بوابة حديد صدّية وسارية علم مايلة. على السبورة جوه الفصل لسه فيه حساب مكتوب بالطباشير من سنين، ولوحة إعلانات مليانة ورق قديم.',
  },
  pump_station: {
    id: 'pump_station', name: 'ماكينة الري', short: 'الماكينة', mapPos: { lat: 31.1498, lng: 30.0085 }, realSite: false, district: 'abis', pos: { x: 195, z: 135 },
    description: 'أوضة طوب أحمر على الترعة فيها ماكينة ديزل بتشفط المية للأراضي. ماسورة تخينة بتصب في القناية، وبراميل جاز، ودفتر نوبتجيات متعلق على مسمار.',
  },
  omda_house: {
    id: 'omda_house', name: 'دوّار العمدة', short: 'الدوّار', mapPos: { lat: 31.1445, lng: 30.0042 }, realSite: false, district: 'abis', pos: { x: -15, z: 300 },
    description: 'بيت كبير قديم بمندرة ودكك خشب وفانوس نحاس. على الترابيزة الجانبية دفتر الزيارات، وقدام الباب البيجو القديمة بتاعة العمدة اللي ما بتتحركش غير في المناسبات.',
  },
  guava_orchard: {
    id: 'guava_orchard', name: 'جنينة الجوافة', short: 'الجنينة', mapPos: { lat: 31.1482, lng: 30.0110 }, realSite: false, district: 'abis', pos: { x: 205, z: 230 },
    description: 'صفوف شجر جوافة وقناية مية بين الصفوف، وعشّة الغفير الخشب في الآخر. الجوافة الواقعة على الأرض بتقول إن حد عدّى من هنا بالليل.',
  },
  rail_crossing: {
    id: 'rail_crossing', name: 'مزلقان السكة الحديد', short: 'المزلقان', mapPos: { lat: 31.1440, lng: 30.0020 }, realSite: false, district: 'abis', pos: { x: -85, z: 145 },
    description: 'مزلقان بحاجز أحمر وأبيض وكشك صغير لعامل المزلقان. القضبان بتختفي في الشبورة، والجرس بيرن قبل القطر بدقيقة كاملة. اللي بيعدّي من هنا بيتكتب في الدفتر.',
  },
  cemetery: {
    id: 'cemetery', name: 'ترب العزبة', short: 'الترب', mapPos: { lat: 31.1450, lng: 30.0105 }, realSite: false, district: 'abis', pos: { x: 165, z: 305 },
    description: 'أحواش مدهونة جير أبيض وصبّار على الأبواب، وسكة تراب بين الأحواش. التُربي بيولّع فانوسه كل ليلة، والورد الناشف على الباب بيحكي مين زار ومين نسي.',
  },
  pigeon_tower: {
    id: 'pigeon_tower', name: 'برج الحمام', short: 'برج الحمام', mapPos: { lat: 31.1475, lng: 30.0090 }, realSite: false, district: 'abis', pos: { x: 115, z: 245 },
    description: 'برج حمام طين عالي على شكل قمع، بسلّم خشب ومزاغل صغيرة. الحمام الزاجل بيرجع لصاحبه مهما بعد، ومعاه أحياناً رسايل محدش يعرف عنها حاجة.',
  },
  mill: {
    id: 'mill', name: 'مطحنة الغلال', short: 'المطحنة', mapPos: { lat: 31.1452, lng: 30.0048 }, realSite: false, district: 'abis', pos: { x: -55, z: 282 },
    description: 'مطحنة قديمة بحجر رحاية كبير وسير جلد بيلف. غبار الدقيق متعلق في النور، والشكاير مرصوصة جنب ميزان بلدي ونتيجة حيطة واقفة على شهر قديم.',
  },
  health_unit: {
    id: 'health_unit', name: 'الوحدة الصحية', short: 'الوحدة', mapPos: { lat: 31.1462, lng: 30.0058 }, realSite: false, district: 'abis', pos: { x: 60, z: 305 },
    description: 'وحدة صحية دورين مدهونة أزرق وأبيض، دكة انتظار طويلة وشباك صيدلية صغير. على الحيطة بوستر التطعيمات، وعلى المكتب دفتر الكشف اللي بيتسجل فيه كل اللي دخل.',
  },
  waterwheel: {
    id: 'waterwheel', name: 'الساقية القديمة', short: 'الساقية', mapPos: { lat: 31.1490, lng: 30.0075 }, realSite: false, district: 'abis', pos: { x: 125, z: 128 },
    description: 'ساقية خشب قديمة على الترعة، وحوض حجر جنبها وجاموسة بتريّح في الضل. على حجر الحوض أسامي محفورة من أجيال، منهم اسم خالك وهو صغير.',
  },
}

export const PLACE_LIST = Object.values(PLACES)
