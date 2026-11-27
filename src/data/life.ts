import type { Condition } from './types'
import { JOURNAL, SUSPECT_NOTES, type EpilogueBlock, type JournalEntry } from './story'

/**
 * Life layer: Yassin's background, Mahmoud's life story, moral paths and the real Alexandria
 * around the case. Choices are optional dialogue branches that set flags; they change reputation,
 * journal pages and the ending, but never the clues needed to solve the case.
 */
export type PathId = 'good' | 'study' | 'trade' | 'street'

export const PATHS: Record<PathId, { title: string; short: string; text: string }> = {
  good: { title: 'جانب الخير', short: 'الخير', text: 'تقف جنب الناس وتساعدهم حتى لو مالكش مصلحة.' },
  study: { title: 'طريق العلم', short: 'العلم', text: 'تذاكر وتفهم الأرض والقانون والتاريخ قبل ما تحكم.' },
  trade: { title: 'سوق الكورنيش', short: 'التجارة', text: 'تبيع وتشتري وتساوم… كل حاجة ليها تمن، وانت بتعرف تحسبه.' },
  street: { title: 'ناس الليل', short: 'الشارع', text: 'تقرب من العصابات والقعدات والفلوس السهلة… ومعاها الخطر.' },
}

export type LifeChoice = { flag: string; path: PathId; points: number; title: string; text: string }

/** Every optional life choice in the dialogues, with its reputation weight. */
export const LIFE_CHOICES: LifeChoice[] = [
  { flag: 'life_help_neighbor', path: 'good', points: 2, title: 'أكل أم سعيد', text: 'وصّلت أكل ستّك لأم سعيد الأرملة ونضّفت لها السطح.' },
  { flag: 'life_help_water', path: 'good', points: 2, title: 'دور الميّه', text: 'وقفت مع عم حسن لما حد حاول ياخد دوره في ميّه الري.' },
  { flag: 'life_good_report', path: 'good', points: 3, title: 'مراكب من غير نور', text: 'بلّغت خفر السواحل عن مراكب التهريب بالليل.' },
  { flag: 'life_refuse_bribe', path: 'good', points: 3, title: 'الظرف المقفول', text: 'رفضت ظرف شوقي ورجّعته له مقفول.' },
  { flag: 'life_refuse_cards', path: 'good', points: 1, title: 'قعدة الكوتشينة', text: 'قلت لأ لقعدة الرهان في القهوة.' },
  { flag: 'life_refuse_gang', path: 'good', points: 1, title: 'شغل «الكبير»', text: 'رفضت تشتغل مع ناس «الكبير».' },
  { flag: 'life_study_books', path: 'study', points: 2, title: 'كتب خالك', text: 'ذاكرت كتب المساحة والقانون اللي فوق دولاب خالك.' },
  { flag: 'life_study_history', path: 'study', points: 2, title: 'درس عم فتحي', text: 'اتعلّمت تاريخ عمود السواري من حارسه.' },
  { flag: 'life_study_promise', path: 'study', points: 3, title: 'وعد المساحة', text: 'وعدت خالك تكمّل دراستك وتتخصص في المساحة.' },
  { flag: 'life_trade_phone', path: 'trade', points: 2, title: 'موبايل عطية', text: 'اشتريت موبايل مستعمل بكاميرا كويسة من ابن عم رجب بعد مساومة.' },
  { flag: 'life_trade_fish', path: 'trade', points: 2, title: 'حلقة السمك', text: 'اشتغلت فجرية في حلقة السمك وكسبت أول فلوسك من البحر.' },
  { flag: 'life_haggle', path: 'trade', points: 2, title: 'تمن السكوت', text: 'ساومت شوقي على تمن سكوتك… وسيبته معلّق.' },
  { flag: 'life_cards', path: 'street', points: 2, title: 'دور كوتشينة', text: 'لعبت دور كوتشينة على رهان في القهوة.' },
  { flag: 'life_street_boat', path: 'street', points: 3, title: 'رحلة الليل', text: 'ركبت مركب تهريب ليلة واحدة مع رجالة الميناء.' },
  { flag: 'life_join_gang', path: 'street', points: 3, title: 'رجالة «الكبير»', text: 'دخلت شغل التوصيل مع ناس «الكبير».' },
  { flag: 'life_bribe', path: 'street', points: 3, title: 'ظرف شوقي', text: 'خدت ظرف شوقي… وحطيته في جيبك.' },
]

export function pathScores(flags: ReadonlySet<string>): Record<PathId, number> {
  const scores: Record<PathId, number> = { good: 0, study: 0, trade: 0, street: 0 }
  for (const choice of LIFE_CHOICES) if (flags.has(choice.flag)) scores[choice.path] += choice.points
  return scores
}

/** The strongest path, or undefined when the player has not chosen anything yet / it is tied. */
export function dominantPath(flags: ReadonlySet<string>): PathId | undefined {
  const scores = pathScores(flags)
  const sorted = (Object.keys(scores) as PathId[]).sort((a, b) => scores[b] - scores[a])
  if (scores[sorted[0]] === 0 || scores[sorted[0]] === scores[sorted[1]]) return undefined
  return sorted[0]
}

export type LifeEvent = { year: string; title: string; text: string; real?: boolean; when?: Condition }

/** Yassin's background. Real-world anchors are marked `real`. */
export const YASSIN_LIFE: LifeEvent[] = [
  { year: '٢٠٠٤', title: 'اتولد في عزبة ١٥', text: 'في بيت الطوب الأحمر في أبيس، على أطراف الإسكندرية، بين الغيطان وريحة الترعة.' },
  { year: '٢٠١١', title: 'يناير في محطة الرمل', real: true, text: 'كان عنده ٧ سنين لما مصر كلها خرجت للشوارع، ومنها الإسكندرية. فاكر خاله شايله على كتفه في محطة الرمل والناس مالية الميدان.' },
  { year: '٢٠١٦', title: 'تعويم الجنيه', real: true, text: 'في نوفمبر ٢٠١٦ الجنيه اتعوّم والأسعار نطّت. ستّه مهدية بقت تفصّل الجلاليب بالأجل، وخاله بقى يشتغل شغلانتين.' },
  { year: '٢٠١٧', title: 'ماما', text: 'أمه ماتت وهو في الإعدادية. من يومها اتربّى عند ستّه مهدية، وخاله محمود بقى أبوه التاني.' },
  { year: '٢٠٢٠', title: 'الكمامة وليلة القاضية ممكن', real: true, text: 'كورونا قفلت المدارس، وذاكر من موبايل خاله القديم. وفي نوفمبر شاف نهائي أفريقيا للأهلي في القهوة ورجع يكمل رسم خرائط الأرض مع خاله.' },
  { year: '٢٠٢١', title: 'موكب المومياوات الملكية', real: true, text: 'يوم ٣ أبريل ٢٠٢١ قعد هو وستّه مهدية وخاله قدام التليفزيون يشوفوا موكب المومياوات الملكية. خاله قاله يومها: «اللي يحترم تاريخ بلده يعرف يحمي أثرها وأرضها».' },
  { year: '٢٠٢٢', title: 'هندسة إسكندرية', text: 'دخل كلية الهندسة – قسم عمارة. بيروح الكلية بميكروباص «رمل رمل» وبيكمّل بالترام وهو لابس كاب الأهلي في الشنطة.' },
  { year: '٢٠٢٤', title: 'سعر المتر', real: true, text: 'مع تعويم مارس ٢٠٢٤ الأراضي بقت مخزن فلوس. ولما اتعلن مسار الطريق الجديد ناحية أبيس، كل متر بقى ليه صاحب فجأة.' },
  { year: '٢٠٢٦', title: 'تطوير ترام الرمل', real: true, text: 'في أبريل ٢٠٢٦ وقفوا ترام الرمل القديم علشان يتحوّل لمترو سريع. وفي نوفمبر من نفس السنة… خاله اختفى.' },
]

/** Mahmoud's life; pages unlock as the investigation reveals them. */
export const MAHMOUD_LIFE: LifeEvent[] = [
  { year: '١٩٧٨', title: 'ابن الترعة', text: 'اتولد في أبيس. أبوه غرق في الترعة وهو صغير، وأخته الكبيرة (أم ياسين) ربطت في إيده أول خيط أحمر.', when: { flags: ['zeinab_thread_story'] } },
  { year: '١٩٩٢', title: 'زلزال ١٢ أكتوبر', real: true, text: 'يوم زلزال ١٩٩٢ كان محمود شاب بيجري مع أهل العزبة يطمن على البيوت القديمة ومآذن المساجد ودفاتر الجمعية اللي وقعت من الرفوف.', when: { flags: ['hassan_history'] } },
  { year: '١٩٩٦', title: 'شريط القياس', text: 'اشتغل مساعد مساح مع الجمعية الزراعية وهو لسه طالب. عم حسن بيقول إنه كان «بيقيس بعينه قبل الشريط».', when: { flags: ['hassan_history'] } },
  { year: '١٩٩٨', title: 'تلات شركاء', text: 'فتح مكتب مساحة صغير مع شوقي وشريك تالت. اللي فضل من الصورة فيه وشّين وطرف مقصوص.', when: { evidence: ['e_old_photo'] } },
  { year: '٢٠٠٢', title: 'المكتبة الجديدة', real: true, text: 'حضر افتتاح مكتبة الإسكندرية الجديدة سنة ٢٠٠٢ وقال: «المكان ده هيحفظ اللي إحنا بننساه». بعد ٢٤ سنة خبّى فيها الحقيقة.', when: { evidence: ['e_library_envelope'] } },
  { year: '٢٠٠٦', title: 'خريطة الصيادين', text: 'رسم خريطة الميناء الشرقي للصيادين ببلاش علشان يثبتوا مراسيهم. عم بحر علّمه عقدة البحّارة يومها.', when: { flags: ['bahr_story'] } },
  { year: '٢٠٠٨', title: 'الفراق', text: 'الشراكة مع شوقي اتفضّت بعد خلاف على عقد بيع أرض. محمود خرج بديون، وشوقي خرج بالمكتب.', when: { flags: ['hassan_history'] } },
  { year: '٢٠١٦', title: 'الجنيه والأرض', real: true, text: 'لما الجنيه اتعوّم في نوفمبر ٢٠١٦ الناس جريت ورا الأرض. محمود بقى يقيس أكتر ويكسب أقل، ولاحظ إن الورق بقى أخطر من الطين.', when: { flags: ['mahmoud_life'] } },
  { year: '٢٠١٧', title: 'أب تاني', text: 'بعد موت أخته، بقى المسؤول عن ياسين. باع عربيته علشان مصاريف المدرسة وماقالش لحد.', when: { flags: ['zeinab_talked'] } },
  { year: '٢٠٢١', title: 'ليلة المومياوات', real: true, text: 'وقت نقل ٢٢ مومياء ملكية للمتحف القومي للحضارة، كتب في مذكرته: «الآثار اتصانت، فاضل نصون حدود الناس البسيطة من التزوير».', when: { flags: ['mahmoud_life'] } },
  { year: '٢٠٢٤', title: 'القطعة ١٥', text: 'الجمعية كلفته يعيد مساحة القطعة ١٥ بعد إعلان مسار الطريق. اكتشف إن الحجر الجنوبي مش في مكانه.', when: { evidence: ['e_survey_book'] } },
  { year: 'نوفمبر ٢٠٢٦', title: 'آخر ميكروباص', text: 'ركب ٦:٤٠ مساءً لمحطة الرمل، وراح للميناء مرعوب، واستخبّى في عشة المراكب.', when: { evidence: ['e_microbus_ticket'] } },
  { year: 'نوفمبر ٢٠٢٦', title: 'الخيط وصل', text: 'ياسين لقاه تحت سور القلعة. أول جملة قالها: «إنت اتأخرت».', when: { flags: ['found_mahmoud'] } },
]

/** Documented context about Alexandria that the story leans on (no live news). */
export const REAL_ALEX: { title: string; text: string; source: string }[] = [
  { title: 'زلزال ١٢ أكتوبر ١٩٩٢', source: 'سجل الزلازل – ١٩٩٢',
    text: 'زلزال ٥.٨ هزّ القاهرة والدلتا ووصل للإسكندرية وأبيس. كتير من السجلات الورقية القديمة اتبهدلت واتنقلت مخازن تانية وقتها، ودي الفجوة اللي بيحكي عنها كبار السن.' },
  { title: 'مكتبة الإسكندرية', source: 'افتتاح أكتوبر ٢٠٠٢',
    text: 'اتفتحت سنة ٢٠٠٢ قريب من مكان المكتبة القديمة، وجدارها الجرانيت محفور عليه حروف من لغات كتير… وهو أصل لغز «اللي بيحفظ الحروف».' },
  { title: 'الجنيه والأرض', source: 'وقائع ٢٠١٦ و٢٠٢٤',
    text: 'مصر عوّمت الجنيه في نوفمبر ٢٠١٦ ومارس ٢٠٢٤. الناس لجأت للأرض والعقارات تحفظ قيمة فلوسها، وده بيخلّي أي تعويض طريق حلم لناس زي شوقي.' },
  { title: 'موكب المومياوات الملكية', source: '٣ أبريل ٢٠٢١',
    text: '٢٢ مومياء ملكية اتنقلت في موكب مهيب من التحرير للمتحف القومي للحضارة. أهالي أبيس وإسكندرية اتفرجوا عليه سوا كفرحة وطنية كبيرة ربطت الجيلين بالتاريخ.' },
  { title: 'تطوير ترام الرمل وخط أبو قير', source: 'أبريل – ٢٠٢٦',
    text: 'اتوقف ترام الرمل التاريخي وخط أبو قير لتحويلهم لقطار خفيف ومترو حديث، فالميكروباصات بقت شريان الحركة الأساسي بين أبيس ومحطة الرمل.' },
  { title: 'الدوري المصري والكورة في إسكندرية', source: 'موسم ٢٠٢٦–٢٠٢٧',
    text: 'ياسين أهلاوي صميم بيفتكر ٢٠٠٦ والقاضية ممكن، لكن في قعدة قهوة رجب أو قهوة عم مهدي في قرية ١٥، الهزار بين الأهلاوية وجماهير الاتحاد السكندري جزء من يوم الناس (مع ماتش الاتحاد وطلائع الجيش ٣ ديسمبر ٢٠٢٦).' },
  { title: 'قلعة قايتباي', source: 'القرن الخامس عشر',
    text: 'السلطان قايتباي بناها في القرن الـ١٥ مكان فنار الإسكندرية القديم، وحواليها الميناء الشرقي ومراكب الصيادين.' },
  { title: 'عمود السواري', source: 'حوالي سنة ٢٩٧م',
    text: 'عمود جرانيت أحمر اتعمل تكريمًا للإمبراطور دقلديانوس، رغم إن اسمه الشعبي مربوط بـ«بومبي».' },
  { title: 'حاجات إسكندرانية', source: 'حياة يومية',
    text: 'حلقة السمك في الأنفوشي فجرًا، فول وطعمية على الواقف، الكورنيش بالليل، نوّات الشتا اللي بتقلب البحر، وصوت السواق: «رمل رمل رمل».' },
]

/** Journal pages written about the player's own choices. */
export const LIFE_JOURNAL: JournalEntry[] = [
  { id: 'jl_good_neighbor', chapter: 'ch_door', title: 'سطح أم سعيد', when: { flags: ['life_help_neighbor'] },
    text: 'ماكنتش فاكر إن مقشة وكيس أكل ممكن يريّحوا قلبي كده. ستّي كانت تقول: الحاجة الصغيرة اللي بتتعمل من غير شاهد هي اللي بتتحسب.' },
  { id: 'jl_good_water', chapter: 'ch_stone', title: 'دور الميّه', when: { flags: ['life_help_water'] },
    text: 'عم حسن مسك إيدي وقال «الأرض بتفتكر». يمكن الأرض اللي بتفتكر هي اللي هتقف جنب خالي لما أحتاج.' },
  { id: 'jl_good_report', chapter: 'ch_knot', title: 'نور اللنش', when: { flags: ['life_good_report'] },
    text: 'اتصلت وقلبي بيدق. لنش خفر السواحل لف عند الحاجز وسابني أسأل نفسي: هل ده شجاعة ولا غباء؟ وجه الجواب بعد أسبوع: ناس كتير ما فكّرتش فيهم اتحموا.' },
  { id: 'jl_good_bribe', chapter: 'ch_found', title: 'ظرف رجع مقفول', when: { flags: ['life_refuse_bribe'] },
    text: 'خمسين ألف. كنت أقدر أسدد بيها مصاريف الكلية سنتين. بس لما رجّعته مقفول حسيت إني بقيت أخف من أي وقت، وإن ستّي كانت هتفرح بيا لو شافتني.' },
  { id: 'jl_study', chapter: 'ch_stone', title: 'هامش الكتاب', when: { flags: ['life_study_books'] },
    text: '«الخريطة تكسب لو الورق صح». فهمت من هامش خالي إن أقوى سلاح هنا مش العصا ولا الفلوس… هو الورق اللي مايتزوّرش.' },
  { id: 'jl_study_history', chapter: 'ch_bus', title: 'العمود اللي اسمه غلط', when: { flags: ['life_study_history'] },
    text: 'الناس سمّت العمود على اسم بومبي بالغلط من قرون، والحقيقة كانت مكتوبة تحت. كام حاجة في حياتنا اسمها غلط، ومحتاجة حد يقرا القاعدة؟' },
  { id: 'jl_study_promise', chapter: 'ch_found', title: 'وعد', when: { flags: ['life_study_promise'] },
    text: 'وعدت خالي أكمّل المساحة. الوعود زي الخيوط… وأنا هربط دي بإيدي.' },
  { id: 'jl_trade_phone', chapter: 'ch_stone', title: 'ثمانمية وخمسين جنيه', when: { flags: ['life_trade_phone'] },
    text: 'ساومت عطية تلات ساعات وطلعت بالموبايل بنص السعر. عرفت إن المساومة مش وقاحة… هي إنك تفهم قيمة الحاجة. وده ينفع في القضية أكتر مما أتخيل.' },
  { id: 'jl_trade_fish', chapter: 'ch_bus', title: 'حلقة الأنفوشي', when: { flags: ['life_trade_fish'] },
    text: 'الساعة ٤ الفجر، التلج في إيدي، والمزاد بيجري. أول مرة أكسب فلوس من البحر. حسيت إني ابن المدينة دي بجد، مش بس زائر عندها.' },
  { id: 'jl_trade_haggle', chapter: 'ch_found', title: 'تمن السكوت', when: { flags: ['life_haggle'] },
    text: 'ساومت شوقي على رقم أكبر وهو مش مصدّق. ماكنتش ناوي آخد، بس عايز أعرف قد إيه بيقدّر نفسه… وخايف أكتر من الجواب.' },
  { id: 'jl_street_cards', chapter: 'ch_stone', title: 'قعدة آخر الليل', when: { flags: ['life_cards'] },
    text: 'خسرت دورين وكسبت واحد. المهم إني سمعت اسم «الكبير» لأول مرة، والناس بتنطقه بنفس نبرة الصوت اللي بينطقوا بيها اسم الدين.' },
  { id: 'jl_street_boat', chapter: 'ch_knot', title: 'مركب من غير نور', when: { flags: ['life_street_boat'] },
    text: 'الموج كان بيضرب في جنب المركب، وأنا ماسك الحبل ومش عارف إن كنت بجري ورا خالي ولا بهرب من نفسي. شفت الكراتين، وشفت الناس… وفهمت إن الضلمة ليها ناس كتير.' },
  { id: 'jl_street_gang', chapter: 'ch_bus', title: 'كرتونتين', when: { flags: ['life_join_gang'] },
    text: 'استلمت ٤٠٠ جنيه عن توصيلة واحدة. الراجل قال «الكبير بيحب اللي بيسكت». أنا ساكت… بس لو خالي عرف، مش عارف هيبصلي إزاي.' },
  { id: 'jl_street_bribe', chapter: 'ch_found', title: 'الظرف في جيبي', when: { flags: ['life_bribe'] },
    text: 'الظرف لسه في جيبي وكل ما أقرّب من الحقيقة بيتقل. أنا مش بطل زي ما كنت فاكر. يمكن لسه فيا وقت أرجّعه.' },
]
JOURNAL.push(...LIFE_JOURNAL)

SUSPECT_NOTES.push(
  { suspect: 'unknown', label: 'ملاحظة', text: 'رجالة «الكبير» بيتكلموا عن سيّد كأنه واحد منهم، وبيقبض كاش.', when: { flags: ['life_join_gang'] } },
  { suspect: 'unknown', label: 'ملاحظة', text: 'سمعت من قعدة القهوة إن «الكبير» عارف كل حاجة عن شغل شوقي.', when: { flags: ['life_cards'] } },
  { suspect: 'shawky', label: 'ملاحظة', text: 'عرض عليك خمسين ألف علشان تنسى الموضوع.', when: { flags: ['shawky_debt'], evidence: ['e_library_envelope'] } },
)

/** Ending scenes shaped by the player's strongest path and by the bribe. */
export function lifeEpilogue(flags: ReadonlySet<string>): EpilogueBlock[] {
  const blocks: EpilogueBlock[] = []
  const path = dominantPath(flags)
  const lines: Record<PathId, string[]> = {
    good: [
      'أم سعيد بقت بتناديك «ابني» قدام الجيران. عم حسن رجّع دور الميّه، وجه ناس من الحتة يسلّموا عليك من غير سبب.',
      'اللي وقفت جنبهم مش هيدفعوا دينك، بس هيفتحوا لك أبوابهم لو احتجتهم. وده في أبيس أغلى من أي جنيه.',
    ],
    study: [
      'خلصت ترمك بتقدير، وقدّمت مشروع تخرجك عن «حدود الملكية الزراعية وتعويضات الطرق». الدكتور سألك: «حد ساعدك؟» قلت: «خالي… وخيط أحمر».',
      'محمود بدأ يعلّمك أسرار المساحة، وعقدتك الأولى في الميزان كانت مضبوطة.',
    ],
    trade: [
      'بقيت معروف في الأنفوشي وعند عطية وعند رجب: «ابن الحاجة مهدية اللي بيعرف يساوم». فتحت مشروع صغير تبيع فيه معدّات مساحة مستعملة.',
      'عرفت إن البيع والشراء مش عيب، بس لازم يبقى فيه ميزان نضيف.',
    ],
    street: [
      'رجالة «الكبير» بيسلّموا عليك في الشارع. فيه ناس بتنتظرك آخر الليل، وناس بتخاف منك… والخيط الأحمر اللي في إيدك بقى تقيل.',
      'رسالة من غير اسم وصلتك: «الباب مفتوح لما تحب ترجع». مش عارف تقراها تهديد ولا دعوة.',
    ],
  }
  if (path) blocks.push({ title: `طريقك: ${PATHS[path].title}`, lines: lines[path], when: {} })
  else blocks.push({ title: 'طريقك لسه بيتحدد', lines: ['ما اخترتش جنب واحد بوضوح… ولسه في قدّامك قضية جديدة وفرص تتعلم فيها تختار.'], when: {} })
  if (flags.has('life_bribe')) blocks.push({ title: 'الظرف', lines: ['الخمسين ألف لسه في درج مكتبك. رجّعتها لشوقي بعد القبض عليه… ولا بقيت تبص عليها كل ليلة؟'], when: {} })
  if (flags.has('life_refuse_bribe')) blocks.push({ title: 'الظرف', lines: ['شوقي بعد القبض عليه قال للنيابة: «الولد ده رجّعلي ظرفي مقفول». وده اتسجّل في المحضر.'], when: {} })
  return blocks
}
