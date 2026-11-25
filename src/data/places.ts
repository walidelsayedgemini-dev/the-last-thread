import type { Place, PlaceId } from './types'

/**
 * World layout. The playable map compresses the real geography: the city (and the sea to its north)
 * occupies negative Z; Abis lies to the south-east across the farmland and is linked by the
 * microbus line. Landmark GPS anchors are the real public coordinates used for field photography.
 */
export const PLACES: Record<PlaceId, Place> = {
  zeinab_home: {
    id: 'zeinab_home', name: 'بيت ستّك زينب', short: 'البيت', district: 'abis', pos: { x: 40, z: 240 },
    description: 'بيت طوب أحمر بدورين في آخر شارع الجامع في عزبة ١٥. الباب الأخضر مشقق من الشمس، وماكينة الخياطة السنجر بتاعة ستّك لسه بتشتغل بالرجل. هنا بتصحى وهنا بترجع تنام.',
  },
  mahmoud_house: {
    id: 'mahmoud_house', name: 'بيت خالك محمود', short: 'بيت الخال', district: 'abis', pos: { x: 95, z: 205 },
    description: 'أوضتين وصالة قريبين من الترعة، الشبابيك الزرقا مقفولة من تلات أيام. على الباب خيط أحمر مربوط في المقبض: نفس الخيط اللي أمك الله يرحمها كانت بتربطه في إيد خالك.',
  },
  cafe_ragab: {
    id: 'cafe_ragab', name: 'قهوة المعلم رجب', short: 'القهوة', district: 'abis', pos: { x: 5, z: 205 },
    description: 'كراسي خشب وترابيزات صاج تحت تعريشة عنب، وتليفزيون معلّق على الحيطة مايتطفيش وقت ماتشات الاتحاد. كل أخبار العزبة بتعدّي من هنا قبل ما توصل لأصحابها.',
  },
  abis_mosque: {
    id: 'abis_mosque', name: 'جامع العزبة', short: 'الجامع', district: 'abis', pos: { x: 70, z: 268 },
    description: 'جامع صغير بمادنة بيضا وقبة خضرا. عم حسن بيقعد على دكّته بعد صلاة العصر يحكي عن أيام ما كانت أبيس كلها أرض زراعية.',
  },
  canal_bridge: {
    id: 'canal_bridge', name: 'كوبري الترعة', short: 'الكوبري', district: 'abis', pos: { x: 40, z: 150 },
    description: 'كوبري خرساني ضيق على ترعة المحمودية الفرعية. العربيات الملاكي نادراً ما بتعدّي هنا، فأي عربية غريبة بتتشاف.',
  },
  plot15: {
    id: 'plot15', name: 'أرض القطعة ١٥', short: 'القطعة ١٥', district: 'abis', pos: { x: 150, z: 168 },
    description: 'فدانين برسيم على حافة الترعة. خالك كان بيقيسها الأسبوع اللي فات لحساب الجمعية، وفيه كلام إن الطريق الجديد هيعدّي من هنا وسعر القيراط هيضرب السما.',
  },
  abis_stop: {
    id: 'abis_stop', name: 'موقف ميكروباص أبيس', short: 'الموقف', district: 'abis', pos: { x: -30, z: 185 },
    description: 'مظلة صاج ودكة أسمنت ويافطة باهتة: "أبيس – محطة الرمل". السواق عم سيد بينادي على الركاب من الفجر للعشا.',
  },
  raml_stop: {
    id: 'raml_stop', name: 'موقف محطة الرمل', short: 'محطة الرمل', district: 'city', pos: { x: 0, z: -195 },
    description: 'قلب إسكندرية: الترام الأصفر بيرن، وريحة البحر والفول والكتب القديمة على الرصيف مختلطين.',
  },
  mansheya: {
    id: 'mansheya', name: 'المنشية – مكتب شوقي', short: 'المنشية', district: 'city', pos: { x: -140, z: -215 },
    description: 'عمارات إيطالي قديمة بشبابيك خشب. تحت واحدة منهم مكتب "شوقي للعقارات والاستثمار"، وقدامه دايماً عربية مرسيدس سودا.',
  },
  qaitbay: {
    id: 'qaitbay', name: 'قلعة قايتباي', short: 'القلعة', district: 'city', pos: { x: -330, z: -325 }, photographable: true,
    description: 'قلعة السلطان قايتباي مبنية على أنقاض فنار إسكندرية القديم. مراكب الصيادين الزرقا راسية عند سور الميناء الشرقي.',
  },
  bibliotheca: {
    id: 'bibliotheca', name: 'مكتبة الإسكندرية', short: 'المكتبة', district: 'city', pos: { x: 130, z: -250 }, photographable: true,
    description: 'قرص مايل ناحية البحر، وجدار جرانيت محفور عليه حروف من كل لغات الدنيا. خالك كان بيقول إن الحروف دي "بتحفظ السر أحسن من الخزنة".',
  },
  pompey: {
    id: 'pompey', name: 'عمود السواري', short: 'العمود', district: 'city', pos: { x: -210, z: -120 }, photographable: true,
    description: 'عمود جرانيت أحمر طوله ٢٧ متر فوق تل كرموز، وحواليه أبو الهول صغير وأطلال. عم فتحي بيحرسه بقاله تلاتين سنة.',
  },
  corniche: {
    id: 'corniche', name: 'الكورنيش', short: 'الكورنيش', district: 'city', pos: { x: 0, z: -285 },
    description: 'سور الكورنيش الطويل، وأعمدة النور الصفرا بتترعش في الشبورة، والموج بيرزع في الصخر.',
  },
  abis_market: {
    id: 'abis_market', name: 'سوق التلات', short: 'السوق', district: 'abis', pos: { x: -70, z: 235 },
    description: 'سوق العزبة الأسبوعي: صناديق طماطم وبرتقال على الأرض، ميزان نحاس قديم، تروسيكلات محمّلة جرجير، ولمبات جاز متعلقة على حبال. كل حكاية في أبيس بتتباع هنا بنص التمن.',
  },
  bakery: {
    id: 'bakery', name: 'فرن أم سعيد البلدي', short: 'الفرن', district: 'abis', pos: { x: 10, z: 272 },
    description: 'فرن طوب لبن بيولّع من قبل الفجر. أقفاص العيش البلدي بتبرد على الرف، وشكاير الدقيق مرصوصة جنب دفتر صرف التموين. ريحة العيش السخن بتلم العزبة كلها.',
  },
  old_school: {
    id: 'old_school', name: 'مدرسة العزبة القديمة', short: 'المدرسة', district: 'abis', pos: { x: 125, z: 292 },
    description: 'مدرسة ابتدائي بدور واحد، بوابة حديد صدّية وسارية علم مايلة. على السبورة جوه الفصل لسه فيه حساب مكتوب بالطباشير من سنين، ولوحة إعلانات مليانة ورق قديم.',
  },
  pump_station: {
    id: 'pump_station', name: 'ماكينة الري', short: 'الماكينة', district: 'abis', pos: { x: 195, z: 135 },
    description: 'أوضة طوب أحمر على الترعة فيها ماكينة ديزل بتشفط المية للأراضي. ماسورة تخينة بتصب في القناية، وبراميل جاز، ودفتر نوبتجيات متعلق على مسمار.',
  },
  omda_house: {
    id: 'omda_house', name: 'دوّار العمدة', short: 'الدوّار', district: 'abis', pos: { x: -15, z: 300 },
    description: 'بيت كبير قديم بمندرة ودكك خشب وفانوس نحاس. على الترابيزة الجانبية دفتر الزيارات، وقدام الباب البيجو القديمة بتاعة العمدة اللي ما بتتحركش غير في المناسبات.',
  },
  guava_orchard: {
    id: 'guava_orchard', name: 'جنينة الجوافة', short: 'الجنينة', district: 'abis', pos: { x: 205, z: 230 },
    description: 'صفوف شجر جوافة وقناية مية بين الصفوف، وعشّة الغفير الخشب في الآخر. الجوافة الواقعة على الأرض بتقول إن حد عدّى من هنا بالليل.',
  },
  rail_crossing: {
    id: 'rail_crossing', name: 'مزلقان السكة الحديد', short: 'المزلقان', district: 'abis', pos: { x: -85, z: 145 },
    description: 'مزلقان بحاجز أحمر وأبيض وكشك صغير لعامل المزلقان. القضبان بتختفي في الشبورة، والجرس بيرن قبل القطر بدقيقة كاملة. اللي بيعدّي من هنا بيتكتب في الدفتر.',
  },
  cemetery: {
    id: 'cemetery', name: 'ترب العزبة', short: 'الترب', district: 'abis', pos: { x: 165, z: 305 },
    description: 'أحواش مدهونة جير أبيض وصبّار على الأبواب، وسكة تراب بين الأحواش. التُربي بيولّع فانوسه كل ليلة، والورد الناشف على الباب بيحكي مين زار ومين نسي.',
  },
  pigeon_tower: {
    id: 'pigeon_tower', name: 'برج الحمام', short: 'برج الحمام', district: 'abis', pos: { x: 115, z: 245 },
    description: 'برج حمام طين عالي على شكل قمع، بسلّم خشب ومزاغل صغيرة. الحمام الزاجل بيرجع لصاحبه مهما بعد، ومعاه أحياناً رسايل محدش يعرف عنها حاجة.',
  },
  mill: {
    id: 'mill', name: 'مطحنة الغلال', short: 'المطحنة', district: 'abis', pos: { x: -55, z: 282 },
    description: 'مطحنة قديمة بحجر رحاية كبير وسير جلد بيلف. غبار الدقيق متعلق في النور، والشكاير مرصوصة جنب ميزان بلدي ونتيجة حيطة واقفة على شهر قديم.',
  },
  health_unit: {
    id: 'health_unit', name: 'الوحدة الصحية', short: 'الوحدة', district: 'abis', pos: { x: 60, z: 305 },
    description: 'وحدة صحية دورين مدهونة أزرق وأبيض، دكة انتظار طويلة وشباك صيدلية صغير. على الحيطة بوستر التطعيمات، وعلى المكتب دفتر الكشف اللي بيتسجل فيه كل اللي دخل.',
  },
  waterwheel: {
    id: 'waterwheel', name: 'الساقية القديمة', short: 'الساقية', district: 'abis', pos: { x: 125, z: 128 },
    description: 'ساقية خشب قديمة على الترعة، وحوض حجر جنبها وجاموسة بتريّح في الضل. على حجر الحوض أسامي محفورة من أجيال، منهم اسم خالك وهو صغير.',
  },
}

export const PLACE_LIST = Object.values(PLACES)
