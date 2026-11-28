import type { Condition } from './types'

/**
 * Narrative layer for case 01. It only READS the case state (flags / evidence / deductions);
 * nothing here changes investigation rules, clues or the accusation requirements.
 */
export type Chapter = {
  id: string
  title: string
  kicker: string
  text: string
  when: Condition
}

/** Ordered: the highest matching chapter is the current one. */
export const CHAPTERS: Chapter[] = [
  { id: 'ch_door', title: 'الباب المقفول', kicker: 'تلات أيام من الصمت',
    text: 'خيط أحمر على مقبض باب… وراجل مش بيسيب حاجة للصدفة.', when: {} },
  { id: 'ch_stone', title: 'الحجر اللي اتحرّك', kicker: 'الأرض بتتكلم لمين يعرف يقيسها',
    text: 'الدفتر بيقول ٣ متر. والتراب الطازة بيقول إن حد استعجل.', when: { evidence: ['e_survey_book'] } },
  { id: 'ch_bus', title: 'آخر ميكروباص', kicker: 'أبيس ← الإسكندرية',
    text: 'المدينة كبيرة… والخيط رفيع. بس خالك سابله علامات.', when: { flags: ['visited_city'] } },
  { id: 'ch_letters', title: 'اللي بيحفظ الحروف', kicker: 'جدار المكتبة',
    text: 'جدار كامل من الحروف، وسطر واحد بس فيه الحقيقة.', when: { flags: ['library_code'] } },
  { id: 'ch_knot', title: 'عقدة البحّارة', kicker: 'الميناء الشرقي',
    text: 'الخيط اللي ربطه حد علّمه البحر… وعلّمه إزاي يستخبّى.', when: { flags: ['shed_known'] } },
  { id: 'ch_found', title: 'الخيط وصل', kicker: 'تحت سور القلعة',
    text: 'شمعة صغيرة، وباب خشب متواري… وصوت تعرفه.', when: { flags: ['found_mahmoud'] } },
  { id: 'ch_verdict', title: 'الحساب', kicker: 'كل خيط له طرفين',
    text: 'الأدلة اتربطت. فاضل تقول الاسم… وتتحمّل وزنه.', when: { flags: ['found_mahmoud'], deductions: ['d_markers', 'd_forgery', 'd_trail'] } },
]

export type JournalEntry = {
  id: string
  chapter: string
  title: string
  text: string
  when: Condition
}

/** Yassin's private notebook: first-person entries unlocked by the investigation. */
export const JOURNAL: JournalEntry[] = [
  { id: 'j_call', chapter: 'ch_door', title: 'المكالمة اللي ماردّيتش عليها',
    text: 'كان بيتصل بيا الأربعاء وأنا في المحاضرة. بصّيت للشاشة وقلت «هكلمه بالليل». الليل جه… وخالي مجاش. من يومها وأنا بسمع الرسالة الصوتية كل ساعة، وكل مرة بحس إن آخر كلمة فيها ماكانتش لازم تتقال بالهدوء ده.',
    when: {} },
  { id: 'j_zeinab', chapter: 'ch_door', title: 'ستّي ومسبحتها',
    text: 'ستّي مش بتبكي قدامي. بتلف المسبحة وتقول «يا ضنايا» كل شوية، كإنها بتتأكد إني لسه موجود. الراجل اللي رباني بعد ماما مش هسيبه يضيع، حتى لو اللي وراه ناس أكبر مني.',
    when: { flags: ['zeinab_talked'] } },
  { id: 'j_thread', chapter: 'ch_door', title: 'العقدة مش بتاعته',
    text: 'خالي عمره ما ربط عقدة كده. دي مش عقدة مساحين ولا عقدة فلاحين… دي عقدة حد عاش على البحر. يعني الخيط ده مش مجرد علامة، ده عنوان.',
    when: { evidence: ['e_thread_door'] } },
  { id: 'j_photo', chapter: 'ch_door', title: 'شاب قدام العمود',
    text: 'شفت خالي في الصورة وهو شاب، ماسك الشريط وعينه فيها ثقة ماشفتهاش من سنين. جنبه شوقي ماسك ملف وبيضحك. الاتنين كانوا شركاء… والضحكة دي بقت تخوّفني.',
    when: { evidence: ['e_old_photo'] } },
  { id: 'j_book', chapter: 'ch_stone', title: 'الدفتر ما بيجمّلش',
    text: 'خط خالي صغير ومنظّم زي ما هو. «الحجر الجنوبي اتزحزح ٣ متر شرقاً». مفيش تهويل ولا خوف في الكلام… بس الصفحة الأخيرة مقطوعة. اللي قطعها عارف إن الصفحة دي تكفي تقلب القطعة كلها.',
    when: { evidence: ['e_survey_book'] } },
  { id: 'j_stone', chapter: 'ch_stone', title: 'تراب طازة',
    text: 'وقفت قدام الحجر وحسّيت إن الأرض بتبصلي. أثر جزمة جلد مصقولة في طين الغيط… مفيش فلاح بيلبس كده. اللي جه هنا ماكانش عارف يمشي بين الزرع، بس كان عارف بالظبط هو جاي ياخد إيه.',
    when: { evidence: ['e_boundary_stone'] } },
  { id: 'j_hassan', chapter: 'ch_stone', title: 'الأرض ما بتكدبش',
    text: 'عم حسن قاللي نص الحكاية وسابلي النص التاني أفهمه. مرسيدس سودا عند الكوبري، وصوت أعرفه: سيّد، سواق شوقي. كل ما أقرّب لحد، الخيط بيرجع لنفس الراجل.',
    when: { evidence: ['e_hassan_testimony'] } },
  { id: 'j_ragab', chapter: 'ch_stone', title: 'القهوة بتسمع',
    text: 'رجب بيضحك كتير، بس لما قلت اسم شوقي صوته نزل درجة. فيه ديون قديمة تحت كل الضحك ده. الناس هنا مش جبانة… الناس بس عارفة تمن الكلام.',
    when: { flags: ['ragab_trust'] } },
  { id: 'j_city', chapter: 'ch_bus', title: 'محطة الرمل',
    text: 'ركبت نفس الميكروباص اللي ركبه. بصّيت من الشباك وأنا بفكّر: هو شاف إيه في الطريق ده خلّاه يطلع مرعوب؟ المدينة مش بتدّي إجابات… بس بتخبّي ناس كويس.',
    when: { flags: ['visited_city'] } },
  { id: 'j_letters', chapter: 'ch_letters', title: 'علامات على الجدار',
    text: 'الحروف على الجدار ماكانتش كلها زينة. في مربعات عليها صبغة. «الأمانة عند اللي بيحفظ الحروف»… محتاج أراجع الصورة قبل ما أجرّب الخزنة.',
    when: { flags: ['library_code'] } },
  { id: 'j_amna_route', chapter: 'ch_letters', title: 'الصورة قبل القص',
    text: 'محمود كتب اسم نبيل على ظهر المظروف. ألاقيه عند درجات المسرح الروماني بكوم الدكة.',
    when: { flags: ['amna_route'] } },
  { id: 'j_amna_archive', chapter: 'ch_letters', title: 'مين حفظ الخريطة؟',
    text: 'شهادة نبيل والجواب بيرجعوا اسم أمي للخريطة القديمة. منى مستنية قراري في المتحف.',
    when: { deductions: ['d_amna_archive'] } },
  { id: 'j_amna_credit', chapter: 'ch_letters', title: 'اسم آمنة في الملف',
    text: 'اخترت إن اسم أمي يظهر في ملخص القضية. اللي يفتح الملف بعدنا هيعرف مين حافظ على النسخة الأولى.',
    when: { flags: ['amna_credit'] } },
  { id: 'j_amna_private', chapter: 'ch_letters', title: 'جواب للبيت',
    text: 'طلبت من منى تحتفظ بالنسخة وتسيب الجواب للعيلة. هاقراه مع ستّي مهدية في البيت.',
    when: { flags: ['amna_private'] } },
  { id: 'j_envelope', chapter: 'ch_letters', title: 'نسخة الحقيقة',
    text: 'الشهادة الأصلية بتوقيعه وختم الجمعية. شايف كتابة باهتة على ظهر المظروف كمان. أقدر أرجع أفحصها في المكتبة.',
    when: { evidence: ['e_library_envelope'] } },
  { id: 'j_sea', chapter: 'ch_knot', title: 'اللي علّمه البحر',
    text: 'عم بحر ماقالش كلمة زيادة، بس لما شاف العقدة إيده اتحرّكت لوحدها كإنها بتفتكر. الخيط ماكانش إنذار… كان رسالة: «أنا لسه عايش، تعالى بهدوء».',
    when: { flags: ['shed_known'] } },
  { id: 'j_forgery', chapter: 'ch_knot', title: 'حروف مايلة',
    text: 'التوقيع شبه توقيع خالي… بس شبه حد بيحاول يقلّد الراجل وهو بيترعش. التاريخ بعد اختفائه بيومين. شوقي كان مستعجل أوي لدرجة إنه نسي إن الورق بيتكلم برضه.',
    when: { evidence: ['e_forged_contract'] } },
  { id: 'j_found', chapter: 'ch_found', title: 'لقيته',
    text: 'الباب اتفتح، والشمعة نورت وش خالي. تعبان… بس هو. أول حاجة قالها: «إنت اتأخرت». ضحكت وأنا بعيط. التلات أيام دول علّموني إن الخيط ممكن يتقطع، بس مين يربطه بيفضل مهم.',
    when: { flags: ['found_mahmoud'] } },
  { id: 'j_weight', chapter: 'ch_verdict', title: 'وزن الاسم',
    text: 'كل الخيوط في إيدي، والاسم على طرف لساني. الغلط هنا مش درجة بتنقص… ده ظلم لراجل أو هروب لتاني. هفكّر في كل خيط قبل ما أنطق.',
    when: { deductions: ['d_markers', 'd_forgery', 'd_trail', 'd_vehicle', 'd_water_pressure', 'd_handwriting'] } },
  { id: 'j_end', chapter: 'ch_verdict', title: 'الخيط الأخير',
    text: 'القضية اتقفلت، وخالي رجع، وستّي نامت أول ليلة مرتاحة بعد تلات أيام. بس الظرف اللي على المكتب… بدون اسم ولا طابع. حاسس إن الخيط ده ماكانش الأخير بجد.',
    when: { flags: ['case_solved'] } },
]

export type EpilogueBlock = { title: string; lines: string[]; when: Condition }

/** Extra ending scenes: shown after the original ending lines. */
export const EPILOGUE: EpilogueBlock[] = [
  { title: 'اللي بقي في أبيس', when: {},
    lines: [
      'ستّك مهدية فتحت ماكينة السنجر لأول مرة من سنين، وفصّلت لمحمود جلابية جديدة… وربطت في طرفها خيط أحمر صغير.',
      'عم حسن قعد على دكة الجامع ورا المضيفة وحكى للشباب: «زمان كنا بنحمي الزرع بالوقفة سوا، والنهاردة لازم نحميه قبل ما يتزوّر ورقه».',
    ] },
  { title: 'اللي كشفته الأدلة الإضافية', when: { evidence: ['e_match_night_photo', 'e_fathy_testimony', 'e_pillar_photo'] },
    lines: [
      'رجب علّق صورة ليلة الماتش على حيطة القهوة وكتب تحتها: «الجمهور بيصحّي الذاكرة».',
      'عم فتحي سلّم نصف العقد الممزق للنيابة بنفسه، ولأول مرة من تلاتين سنة اتكلم الصحافة عن العمود… وعن الراجل اللي حرسه.',
    ] },
  { title: 'الظرف الأخير', when: {},
    lines: [
      'على مكتب خالك، الظرف اللي مالوش اسم. جواه نيجاتيف قديم للصورة بتاعة «شركاء – ١٩٩٨».',
      'لما نوّرته على الضوء، ظهر كتف تالت عند طرف الكادر. حد اتقصّ من الصورة عمداً.',
      'وعلى الورقة المرفقة سطر واحد بخط محمود: «الخيط ده أقدم من القطعة ١٥».',
    ] },
]

export type SideQuest = {
  id: string
  title: string
  giver: string
  summary: string
  steps: { text: string; when: Condition }[]
  /** Optional: shown in the tracker only once this holds. */
  visible: Condition
  /** Lore revealed when every step is done. */
  reward: string
}

/** Optional character stories. They reuse existing scenes and never gate the main case. */
export const SIDE_QUESTS: SideQuest[] = [
  { id: 'q_mother', title: 'خيط الأم', giver: 'ستّك مهدية', visible: { flags: ['zeinab_talked'] },
    summary: 'ستّك بتخبّي حكاية أول خيط أحمر في العيلة.',
    steps: [
      { text: 'اسأل ستّك عن ماما والخيط الأحمر', when: { flags: ['zeinab_thread_story'] } },
      { text: 'افتح درج ماكينة السنجر', when: { evidence: ['e_old_photo'] } },
    ],
    reward: 'ورا الصورة القديمة، بخط أمك الصغير: «لو اتلخبطت الطرق، اربطوا الخيط في أقرب حاجة ثابتة». ستّك قالت إن خالك اتعلّم المساحة علشان الجملة دي.' },
  { id: 'q_reform', title: 'شاهد الإصلاح', giver: 'عم حسن', visible: { flags: ['zeinab_talked'] },
    summary: 'عم حسن شاف أول حجر حدود اتحط في القطعة ١٥.',
    steps: [
      { text: 'اسمع حكاية شوقي وأبوه زمان', when: { flags: ['hassan_history'] } },
      { text: 'اسأله الحجر الجنوبي اتحط إمتى', when: { flags: ['hassan_stone'] } },
    ],
    reward: 'عم حسن طلّع من جيبه ورقة صفرا عليها رسم الحجر سنة ٦٢، بقلم المساح الكبير. نفس المكان اللي في دفتر خالك… بالسنتيمتر.' },
  { id: 'q_debt', title: 'دين القهوة', giver: 'المعلم رجب', visible: { evidence: ['e_cafe_bill'] },
    summary: 'رجب بيضحك كتير… بس فيه حاجة تقيلة على قلبه.',
    steps: [
      { text: 'خد الفاتورة من دفتر الحساب', when: { evidence: ['e_cafe_bill'] } },
      { text: 'اسأله هو وشوقي بينهم إيه', when: { flags: ['ragab_trust'] } },
    ],
    reward: 'رجب قطع صفحة الدين من دفتره قدامك وقال: «لو اتقبض عليه، الدين يسقط… ولو ما اتقبضش، يبقى أنا بشهد ببلاش». ضحك أول ضحكة حقيقية.' },
  { id: 'q_rayes', title: 'حكاية الريّس', giver: 'عم بحر', visible: { flags: ['shed_known'] },
    summary: 'الصياد اللي علّم خالك العقدة عنده حكاية ماحدّش سمعها.',
    steps: [
      { text: 'خلّي عم بحر يثق فيك ويحكيلك عن العشة', when: { flags: ['shed_known'] } },
      { text: 'اسأله عن خالي زمان', when: { flags: ['bahr_story'] } },
    ],
    reward: 'من عشرين سنة، خالك رسم خريطة الميناء ببلاش علشان الصيادين ما يخسروش مراسيهم للمستثمرين. من يومها، عم بحر بيقول: «اللي يحمي الميّه، الميّه تحميه».' },
  { id: 'q_guard', title: 'حارس العمود', giver: 'عم فتحي', visible: { flags: ['visited_city'] },
    summary: 'عم فتحي بيحرس العمود من تلاتين سنة… وبيحرس سر صغير.',
    steps: [
      { text: 'اسمع شهادته عن الورقة الممزقة', when: { evidence: ['e_fathy_testimony'] } },
      { text: 'اسأله عن الليالي اللي بيحرسها', when: { flags: ['fathy_story'] } },
    ],
    reward: 'عم فتحي بيكتب كل ليلة في كراسة: مين عدّى، وإمتى، ولابس إيه. الكراسة فيها أربع زيارات لشوقي في شهر واحد… وكلها بعد نص الليل.' },
  { id: 'q_face', title: 'الوش التاني', giver: 'المعلم شوقي', visible: { flags: ['visited_city'] },
    summary: 'الراجل اللي مابيرفعش صوته… إيه اللي مخوّفه؟',
    steps: [
      { text: 'اضغط عليه بدليل من أبيس', when: { flags: ['shawky_pressed'] } },
      { text: 'اسأله ليه الطريق مهم أوي ليه', when: { flags: ['shawky_debt'] } },
    ],
    reward: 'شوقي كان عنده بنت بتدرس برّه، ومصاريفها هي اللي غرّقته في البنك. ده مايبررش اللي عمله… بس بيفسّر ليه إيده كانت بتترعش وهو بيزوّر.' },
  { id: 'q_third', title: 'الرجل التالت', giver: 'خالك محمود', visible: { flags: ['found_mahmoud'] },
    summary: 'صورة «شركاء – ١٩٩٨» ناقصة حد.',
    steps: [
      { text: 'لاقي الصورة القديمة', when: { evidence: ['e_old_photo'] } },
      { text: 'اسأل خالك عن صورة ١٩٩٨', when: { flags: ['third_man_hint'] } },
    ],
    reward: 'خالك قال جملة واحدة وسكت: «التالت كان أشطرنا… وأول واحد عرف إن الخريطة أغلى من الأرض». الخيط ده مستنيك في القضية الجاية.' },
]

/** Journal pages for finished side stories (appended to the journal). */
export const QUEST_JOURNAL: JournalEntry[] = [
  { id: 'jq_mother', chapter: 'ch_door', title: 'جملة ماما', when: { flags: ['zeinab_thread_story'], evidence: ['e_old_photo'] },
    text: 'عمري ما عرفت إن ماما كانت بتكتب. خطها شبه خطي لما بستعجل. «اربطوا الخيط في أقرب حاجة ثابتة»… يمكن علشان كده خالي ساب الخيط على الباب: أثبت حاجة في البيت.' },
  { id: 'jq_reform', chapter: 'ch_door', title: 'ورقة سنة ٦٢', when: { flags: ['hassan_history', 'hassan_stone'] },
    text: 'عم حسن شايل ورقة عمرها أكبر من أبويا في جيب الجلابية. الأرض هنا ليها ذاكرة، والذاكرة دي ساكنة في جيوب العواجيز.' },
  { id: 'jq_debt', chapter: 'ch_door', title: 'صفحة مقطوعة', when: { evidence: ['e_cafe_bill'], flags: ['ragab_trust'] },
    text: 'رجب قطع صفحة الدين. أول مرة أشوف حد بيتحرر من حاجة بورقة. شوقي ماكانش بيشتري أراضي بس… كان بيشتري سكوت.' },
  { id: 'jq_rayes', chapter: 'ch_knot', title: 'اللي يحمي الميّه', when: { flags: ['shed_known', 'bahr_story'] },
    text: 'خالي عمره ما حكى إنه رسم خريطة الميناء ببلاش. هو كده: بيعمل الصح ويسكت. يمكن علشان كده الناس كلها خبّته من غير ما يطلب.' },
  { id: 'jq_guard', chapter: 'ch_bus', title: 'كراسة الحارس', when: { evidence: ['e_fathy_testimony'], flags: ['fathy_story'] },
    text: 'أربع زيارات بعد نص الليل. الناس فاكرة إن الحارس نايم… بس الحارس الحقيقي هو اللي بيكتب.' },
  { id: 'jq_face', chapter: 'ch_bus', title: 'إيد بتترعش', when: { flags: ['shawky_pressed', 'shawky_debt'] },
    text: 'كنت عايز أكرهه وخلاص. بس لما شفته بيتكلم عن بنته، فهمت إن أخطر الناس مش الوحوش… أخطرهم اللي مقتنعين إن مالهمش اختيار.' },
  { id: 'jq_third', chapter: 'ch_found', title: 'أشطرنا', when: { evidence: ['e_old_photo'], flags: ['third_man_hint'] },
    text: 'خالي قال إن الشريك التالت كان ورا العدسة. أما طرف الصورة المقصوص، فده خيط تاني. لازم أعرف مين كان بيصوّر… بعد ما القضية تتقفل.' },
]
JOURNAL.push(...QUEST_JOURNAL)

/** Night reconstruction: each moment appears once its source evidence is found. */
export const TIMELINE: { time: string; title: string; text: string; when: Condition }[] = [
  { time: '١٩٩٨', title: 'شركاء', text: 'محمود وشوقي بيفتحوا مكتب مساحة صغير. الصورة اتصوّرت قدام عمود السواري.', when: { evidence: ['e_old_photo'] } },
  { time: 'الأربعاء ٦:٤٠ م', title: 'آخر ميكروباص', text: 'محمود بيركب «أبيس – محطة الرمل» لابس المعطف.', when: { evidence: ['e_microbus_ticket'] } },
  { time: 'بعد المغرب', title: 'العشة', text: 'محمود بيوصل لعم بحر مرعوب، ويستخبّى تحت القلعة.', when: { evidence: ['e_bahr_testimony'] } },
  { time: '١١:٠٥ م', title: 'فاتورة غريبة', text: 'سيّد سواق شوقي بيطلب فاتورة في قهوة رجب لأول مرة.', when: { evidence: ['e_cafe_bill'] } },
  { time: 'قرب نص الليل', title: 'مرسيدس عند الكوبري', text: 'اتنين بعتلة وكشاف رايحين ناحية القطعة ١٥.', when: { evidence: ['e_hassan_testimony'] } },
  { time: 'نص الليل', title: 'الحجر بيتزحزح', text: 'الحجر الجنوبي بيتنقل ٣ متر شرقاً. أثر جزمة جلد وعجلات تقيلة.', when: { evidence: ['e_boundary_stone'] } },
  { time: 'ليلة الماتش', title: 'الصورة اللي في الخلفية', text: 'شوقي بنفسه بيكلّم سيّد قدام المرسيدس.', when: { evidence: ['e_match_night_photo'] } },
  { time: 'بعد نص الليل', title: 'صندوق الموقع', text: 'شوقي بيرمي ورقة ممزقة عند عمود السواري.', when: { evidence: ['e_fathy_testimony'] } },
  { time: 'بعد يومين', title: 'تاريخ العقد', text: 'العقد المزوّر متأرّخ بعد اختفاء محمود بيومين.', when: { evidence: ['e_forged_contract'] } },
]

/** Facts the player has established about each suspect (no conclusion is drawn for them). */
export const SUSPECT_NOTES: { suspect: string; label: 'دافع' | 'فرصة' | 'حجة غياب' | 'ملاحظة'; text: string; when: Condition }[] = [
  { suspect: 'shawky', label: 'دافع', text: 'خلاف قديم مع محمود على عقود الأراضي.', when: { flags: ['hassan_history'] } },
  { suspect: 'shawky', label: 'دافع', text: 'ديون للبنك، وتعويض الطريق فرصته.', when: { flags: ['shawky_debt'] } },
  { suspect: 'shawky', label: 'فرصة', text: 'سواقه سيّد كان عند كوبري الترعة نص الليل.', when: { evidence: ['e_hassan_testimony'] } },
  { suspect: 'shawky', label: 'حجة غياب', text: 'بيقول إنه كان نايم في بيته… والفاتورة بتقول إن سواقه كان في أبيس.', when: { evidence: ['e_cafe_bill'] } },
  { suspect: 'shawky', label: 'ملاحظة', text: 'العقد المزوّر خرج من درج مكتبه.', when: { evidence: ['e_forged_contract'] } },
  { suspect: 'ragab', label: 'ملاحظة', text: 'هو اللي سجّل الفاتورة بخطه.', when: { evidence: ['e_cafe_bill'] } },
  { suspect: 'ragab', label: 'دافع', text: 'مديون لشوقي من خمس سنين.', when: { flags: ['ragab_trust'] } },
  { suspect: 'hassan', label: 'ملاحظة', text: 'شاهد على العربية عند الكوبري، وعارف صوت السواق.', when: { evidence: ['e_hassan_testimony'] } },
  { suspect: 'hassan', label: 'ملاحظة', text: 'هو اللي شال الحجر الجنوبي أول مرة سنة الإصلاح.', when: { flags: ['hassan_stone'] } },
  { suspect: 'fathy', label: 'ملاحظة', text: 'لقى نص العقد الممزق في صندوق الموقع.', when: { evidence: ['e_fathy_testimony'] } },
  { suspect: 'fathy', label: 'ملاحظة', text: 'بيكتب كل زيارة بعد نص الليل في كراسته.', when: { flags: ['fathy_story'] } },
  { suspect: 'unknown', label: 'فرصة', text: 'أثر جزمة جلد مصقولة وعجلات عربية تقيلة عند الحجر.', when: { evidence: ['e_boundary_stone'] } },
]
