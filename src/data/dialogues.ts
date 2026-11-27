import type { CharacterId, Dialogue, DialogueChoice } from './types'
import { GATES } from './case01'
import { VILLAGER_DIALOGUES } from './dialogues.villagers01'
import { VILLAGER_DIALOGUES_02 } from './dialogues.villagers02'
import { VILLAGER_DIALOGUES_03 } from './dialogues.villagers03'

/**
 * Branching dialogue trees. Effects (evidence / flags) are applied when a node is shown or a choice
 * is taken. `{player}` is replaced with the player's name at runtime. The first matching `entries`
 * item decides where a conversation starts, so characters greet differently as the case evolves.
 */

const showZeinabThread: DialogueChoice = {
  text: 'ورّيها الخيط', next: 'z_show_thread', present: 'e_thread_door',
  when: { evidence: ['e_thread_door'], notFlags: ['zeinab_thread_shown'] },
}
const showZeinabPhoto: DialogueChoice = {
  text: 'مين كان واقف جنب محمود يوم الصورة دي؟', next: 'z_show_photo', present: 'e_old_photo',
  when: { evidence: ['e_old_photo'], notFlags: ['zeinab_photo_shown'] },
}

const zeinab: Dialogue = {
  character: 'zeinab',
  entries: [
    { node: 'z_done', when: { flags: ['case_solved'] } },
    { node: 'z_again', when: { flags: ['has_key'] } },
    { node: 'z_first' },
  ],
  nodes: {
    z_first: {
      id: 'z_first',
      lines: [
        { who: 'zeinab', text: 'يا ضنايا يا {player}… خالك محمود له تلات أيام ماجاش، وبابه مقفول. قلبي واكلني عليه.' },
      ],
      choices: [
        { text: 'هو قالك كان رايح فين؟', next: 'z_where' },
        { text: 'محتاج أدخل بيته يا ستّي.', next: 'z_key' },
        { text: 'اهدي يا ستّي… أنا هلاقيه.', next: 'z_calm' },
        showZeinabThread,
        showZeinabPhoto,
      ],
    },
    z_calm: {
      id: 'z_calm',
      lines: [
        { who: 'player', text: 'اهدي يا ستّي… أنا هلاقيه. وعد.' },
        { who: 'zeinab', text: 'ربنا يحفظك. بس الوعود زي الخيوط… لازم عقدتها تبقى محكمة.' },
      ],
      next: 'z_hub',
    },
    z_where: {
      id: 'z_where',
      lines: [
        { who: 'zeinab', text: 'قال رايح يخلّص مساحة القطعة ١٥ للجمعية. ورجع آخر مرة وشه أصفر… قاللي: «الأرض فيها ريحة فلوس يا أمي، والفلوس بتودّي في داهية».' },
        { who: 'player', text: 'مين اللي كان بيقابله؟' },
        { who: 'zeinab', text: 'ماقاليش اسم. بس لما سمع عربية بتعدّي من الشارع، شد الستارة وبص من الشباك كتير.' },
        { who: 'zeinab', text: 'كان زمان بيرجع من إسكندرية ومعاه واحد شايل ملف أزرق. فيه صورة من الأيام دي في درج الماكينة. لو لقيتها هاتها ونبصّ عليها سوا.' },
      ],
      effects: [{ type: 'flag', id: 'zeinab_talked' }],
      next: 'z_hub',
    },
    z_key: {
      id: 'z_key',
      lines: [
        { who: 'zeinab', text: 'المفتاح الاحتياطي ده معايا من يوم ما أخوك سافر. خده يا ضنايا… بس إوعى حد يشوفك.' },
        { who: 'narrator', text: 'خدت المفتاح. معدنه بارد… وعليه خيط أحمر صغير ملفوف حواليه.' },
      ],
      effects: [{ type: 'flag', id: 'has_key' }, { type: 'flag', id: 'zeinab_talked' }],
      next: 'z_hub',
    },
    z_hub: {
      id: 'z_hub',
      lines: [{ who: 'zeinab', text: 'إيه تاني يا ضنايا؟' }],
      choices: [
        { text: 'فين مفتاح بيته؟', next: 'z_key', when: { notFlags: ['has_key'] } },
        { text: 'ماكينتك السنجر… خالي كان بيقعد جنبها كتير.', next: 'z_machine', when: { flags: ['zeinab_talked'], notFlags: ['machine_hint'] } },
        { text: 'مين كان بيزوره من إسكندرية؟', next: 'z_trust', when: { flags: ['machine_hint'], notFlags: ['zeinab_trust'] } },
        { text: 'أم سعيد جارتنا محتاجة حاجة؟', next: 'z_neighbor', when: { flags: ['zeinab_talked'], notFlags: ['life_help_neighbor'] } },
        { text: 'كتب خالي اللي فوق الدولاب… ينفع أذاكر منها؟', next: 'z_books', when: { flags: ['has_key'], notFlags: ['life_study_books'] } },
        { text: 'احكيلي عن ماما والخيط الأحمر.', next: 'z_thread', when: { flags: ['zeinab_talked'], notFlags: ['zeinab_thread_story'] } },
        { text: 'سلامو عليكو يا ستّي.', next: 'z_bye' },
        showZeinabThread,
        showZeinabPhoto,
      ],
    },
    z_show_thread: {
      id: 'z_show_thread',
      lines: [
        { who: 'player', text: 'بصّي يا ستّي. لقيت الخيط ده مربوط في مقبض باب خالي. تعرفي العقدة؟' },
        { who: 'zeinab', text: 'اللون من عوايدنا، بس العقدة دي مش عقدتنا. دي شبه عقدة في حبل جابه مرة واحد من إسكندرية.' },
        { who: 'zeinab', text: 'ماعرفتش اسمه. لو لقيت حاجة تقول خالك راح أنهي حتة في إسكندرية، اسأل هناك عن العقدة.' },
      ],
      effects: [{ type: 'flag', id: 'zeinab_thread_shown' }],
      next: 'z_hub',
    },
    z_show_photo: {
      id: 'z_show_photo',
      lines: [
        { who: 'player', text: 'مين اللي واقف جنب خالي قدّام عمود السواري؟' },
        { who: 'zeinab', text: 'ده شوقي. وقت الصورة كانوا بيشتغلوا سوا. شوف الملف في إيده وشريط القياس في إيد محمود.' },
        { who: 'zeinab', text: 'محمود بطّل يجيب سيرته بعد خلاف على ورق أرض. لو قابلت حد فاكر أيام العمود، اسأله عن الورق ده.' },
        { who: 'zeinab', text: 'تبصّ على كتف محمود؟ فيه صوابع حد جاي من طرف الصورة. كنت فاكرة إن الصورة اتقطعت بالغلط… اسأل خالك لما تلاقيه.' },
      ],
      effects: [{ type: 'flag', id: 'zeinab_photo_shown' }],
      next: 'z_hub',
    },
    z_neighbor: {
      id: 'z_neighbor',
      lines: [
        { who: 'zeinab', text: 'أم سعيد أرملة وعيالها بعيد، وسطحها بيخرّ من المطر. خدلها الأكل ده وبصّلها يا ضنايا… الحاجة بتتحسب عند ربنا حتى لو محدّش سمع.' },
      ],
      choices: [
        { text: 'وصّل الأكل ونضّف لها السطح.', next: 'z_neighbor_do' },
        { text: 'مش فاضي دلوقتي يا ستّي، ورايا قضية.', next: 'z_hub' },
      ],
    },
    z_neighbor_do: {
      id: 'z_neighbor_do',
      lines: [
        { who: 'narrator', text: 'طلعت السطح بالمقشة. أم سعيد بصّتلك وقالت: «ربنا يفتحها في وشك زي ما فتحتلي الهوا». ريّحك الكلام أكتر من أي دليل.' },
        { who: 'zeinab', text: 'عارفة إنك تعمل كده. إنت ابن أمك.' },
      ],
      effects: [{ type: 'flag', id: 'life_help_neighbor' }],
      next: 'z_hub',
    },
    z_books: {
      id: 'z_books',
      lines: [
        { who: 'zeinab', text: 'دولاب خالك كان فيه كتب المساحة والقانون العقاري. قال لي مرة: «اللي مايعرفش القانون يتباع في سوق الأراضي».' },
        { who: 'narrator', text: 'فتحت أول كتاب. على الهامش بخط خالك: «الخريطة تكسب لو الورق صح».' },
      ],
      choices: [
        { text: 'اقعد وذاكر ليلتك كلها.', next: 'z_books_do' },
        { text: 'مش وقته دلوقتي.', next: 'z_hub' },
      ],
    },
    z_books_do: {
      id: 'z_books_do',
      lines: [
        { who: 'narrator', text: 'ذاكرت لحد الفجر. فهمت يعني إيه «حدود ملكية» و«نسبة تعويض» و«توقيع بتاريخ». حسيت إن القضية بقت أوضح… وإنت أقوى.' },
      ],
      effects: [{ type: 'flag', id: 'life_study_books' }],
      next: 'z_hub',
    },
    z_thread: {
      id: 'z_thread',
      lines: [
        { who: 'zeinab', text: 'أمك كانت أصغر واحدة في الدار وأعندهم. يوم ما جوزي غرق في الترعة، هي اللي ربطت خيط أحمر في إيد محمود وإيد أخوها الصغير وقالت: «اللي يتوه يشدّ الخيط».' },
        { who: 'zeinab', text: 'ماتت وسابتكم، بس الخيط فضل. محمود كان بيربط خيط جديد كل ما يسافر… وكل مرة بيرجع كان بيقول لي «اتّصل بيّ الخيط يا أمي».' },
        { who: 'narrator', text: 'للحظة، ستّك زينب بصّت للمسبحة بدل ما تبصلك. «ماتبكيش» قلتها لنفسك قبل ما تقولها لها.' },
      ],
      effects: [{ type: 'flag', id: 'zeinab_thread_story' }],
      next: 'z_hub',
    },
    z_machine: {
      id: 'z_machine',
      lines: [
        { who: 'zeinab', text: 'آه… الدرج بتاعها فيه حاجات محمود كان بيخبّيها وهو صغير. افتحه يا ضنايا، يمكن فيه ريحته.' },
      ],
      effects: [{ type: 'flag', id: 'machine_hint' }],
      next: 'z_hub',
    },
    z_trust: {
      id: 'z_trust',
      lines: [
        { who: 'zeinab', text: 'هقولك اللي ماقولتوش لحد… كان بيروح كل خميس إسكندرية يقابل «واحد من زمان». ماعرفتش مين. بس لما رجع آخر مرة قال لي: «شوقي بيه مش هيسيبنا».' },
      ],
      effects: [{ type: 'flag', id: 'zeinab_trust' }, { type: 'flag', id: 'shawky_named' }],
      next: 'z_hub',
    },
    z_bye: { id: 'z_bye', lines: [{ who: 'zeinab', text: 'في أمان الله. ومتتأخرش.' }] },
    z_again: {
      id: 'z_again',
      lines: [{ who: 'zeinab', text: 'لقيت حاجة يا {player}؟ طمّني.' }],
      choices: [
        { text: 'لسه بدوّر يا ستّي.', next: 'z_hub' },
        { text: 'خالي مش مخطوف… هو متخبّي.', next: 'z_hope', when: { flags: ['found_mahmoud'] } },
        showZeinabThread,
        showZeinabPhoto,
      ],
    },
    z_hope: {
      id: 'z_hope',
      lines: [{ who: 'zeinab', text: 'الحمد لله! أنا قلبي قالي. روح له وقوله إن الخيط لسه مربوط.' }],
    },
    z_done: {
      id: 'z_done',
      lines: [{ who: 'zeinab', text: 'محمود رجع… والقعدة رجعت. ربنا ما يحرمنيش منكم يا {player}.' }],
    },
  },
}

const hassan: Dialogue = {
  character: 'hassan',
  entries: [{ node: 'h_again', when: { evidence: ['e_hassan_testimony'] } }, { node: 'h_first' }],
  nodes: {
    h_first: {
      id: 'h_first',
      lines: [
        { who: 'hassan', text: 'زمان يا ابني كانت أبيس كلها برسيم وجاموس… دلوقتي الطريق الجديد هيعدّي من هنا وكل واحد مرتب فلوسه.' },
      ],
      choices: [
        { text: 'سمعت حاجة عن خالي محمود؟', next: 'h_night' },
        { text: 'مين المستفيد من الطريق؟', next: 'h_road' },
      ],
    },
    h_night: {
      id: 'h_night',
      lines: [
        { who: 'hassan', text: 'يا ابني ليلتها كنت صاحي من الحر… شفت مرسيدس سودا واقفة عند كوبري الترعة قرابة نص الليل.' },
        { who: 'hassan', text: 'نزلوا اتنين، معاهم كشاف وعتلة، وراحوا ناحية القطعة ١٥. ورجعوا والتراب على جزمهم.' },
        { who: 'hassan', text: 'واحد منهم صوته أعرفه… سيّد، سواق المعلم شوقي.' },
      ],
      effects: [{ type: 'evidence', id: 'e_hassan_testimony' }],
      next: 'h_hub',
    },
    h_road: {
      id: 'h_road',
      lines: [
        { who: 'hassan', text: 'اللي عنده ورق. والمعلم شوقي عنده ورق كتير… مع إن أبوه كان فلاح زيّي.' },
      ],
      effects: [{ type: 'flag', id: 'hassan_history' }],
      next: 'h_hub',
    },
    h_hub: {
      id: 'h_hub',
      lines: [{ who: 'hassan', text: 'عاوز تعرف إيه تاني؟' }],
      choices: [
        { text: 'احكيلي عن شوقي زمان.', next: 'h_history', when: { notFlags: ['hassan_history'] } },
        { text: 'مين شاف الكوبري غيرك؟', next: 'h_others' },
        { text: 'الحجر الجنوبي ده اتحط إمتى؟', next: 'h_stone', when: { notFlags: ['hassan_stone'] } },
        { text: 'شكلك متضايق… في إيه؟', next: 'h_water', when: { notFlags: ['life_help_water'] } },
        { text: 'واجهته بدفتر القهوة: سيّد كان عنده.', next: 'h_confront_right', when: { evidence: ['e_cafe_bill'], notFlags: ['hassan_confronted'] }, present: 'e_cafe_bill', confront: true },
        { text: 'أوريك الصورة القديمة؟ يمكن تفتكر.', next: 'h_confront_wrong', when: { evidence: ['e_old_photo'], notFlags: ['hassan_confronted'] }, present: 'e_old_photo', confront: true },
        { text: 'شكراً يا عم حسن.', next: 'h_bye' },
      ],
    },
    h_water: {
      id: 'h_water',
      lines: [
        { who: 'hassan', text: 'ابن عمدة الحتة بيحجز ميّه الترعة لأرضه ويسيب أرضي ناشفة. دوري في الري مش بيجي، والبرسيم بيموت.' },
        { who: 'hassan', text: 'أنا راجل كبير… محدّش بيسمعني. بس لو واحد متعلّم زيّك اتكلم معاهم…' },
      ],
      choices: [
        { text: 'تعال نروح للمهندس الزراعي ونكتب شكوى بالدور.', next: 'h_water_do' },
        { text: 'ده مش شغلي يا عم حسن.', next: 'h_hub' },
      ],
    },
    h_water_do: {
      id: 'h_water_do',
      lines: [
        { who: 'narrator', text: 'وقفت جنبه قدّام مهندس الري. قلت رقم الحوض وتاريخ الدور من دفتر خالك. الراجل كتب الشكوى وهزّ راسه: «حقه معاه».' },
        { who: 'hassan', text: 'الأرض بتفتكر اللي وقف جنبها. وأنا كمان.' },
      ],
      effects: [{ type: 'flag', id: 'life_help_water' }],
      next: 'h_hub',
    },
    h_stone: {
      id: 'h_stone',
      lines: [
        { who: 'hassan', text: 'سنة الإصلاح الزراعي. أنا اللي شلت الحجر على كتفي مع المساح الكبير، وأبو شوقي كان واقف يتفرّج وقال: «يوم هيجي هنزّحه بإيدي».' },
        { who: 'hassan', text: 'ضحكنا يومها. النهاردة بفتكر الضحكة… وبحس إني كنت أعمى.' },
      ],
      effects: [{ type: 'flag', id: 'hassan_stone' }],
      next: 'h_hub',
    },
    h_history: {
      id: 'h_history',
      lines: [
        { who: 'hassan', text: 'شوقي وأبوه ومحمود كلهم قعدوا على الدكة دي. محمود بيقيس وشوقي بيدفع… وبعدين الخلاف بقى على ورقة واحدة.' },
        { who: 'narrator', text: 'اتفتح دفتر الملاحظات: الشراكة القديمة بين محمود وشوقي. دي حتة مهمة.' },
      ],
      effects: [{ type: 'flag', id: 'hassan_history' }],
      next: 'h_hub',
    },
    h_others: {
      id: 'h_others',
      lines: [{ who: 'hassan', text: 'القهوة. رجب سامع وشايف كل حاجة… بس اسأله بعد الضهر، قبلها بيبقى مخنوق.' }],
      next: 'h_hub',
    },
    h_confront_right: { id: 'h_confront_right', lines: [{ who: 'player', text: 'الفاتورة باسم سيّد الساعة ١١:٠٥… إنت قلت إنك ما شفتش حد.' }, { who: 'hassan', text: 'أنا ماكدبتش يا ابني… بس خفت أقول إن سيّد رجع وسأل عن الحجر. خد بالك: كان بيسأل عن ورقة في مكتب شوقي.' }], effects: [{ type: 'flag', id: 'hassan_confronted' }, { type: 'flag', id: 'hassan_secret' }], next: 'h_hub' },
    h_confront_wrong: { id: 'h_confront_wrong', lines: [{ who: 'hassan', text: 'الصورة دي من زمان يا ابني. حلوة، بس مالهاش علاقة بليلة الترعة. سيبني أفتكر اللي شفته.' }], next: 'h_hub' },
    h_bye: { id: 'h_bye', lines: [{ who: 'hassan', text: 'الله معاك يا ابني. وخلّي عينك في الأرض.' }] },
    h_again: {
      id: 'h_again',
      lines: [{ who: 'hassan', text: 'رجعت يا ابني؟ اسأل اللي إنت عاوزه.' }],
      choices: [
        { text: 'احكيلي عن شوقي زمان.', next: 'h_history', when: { notFlags: ['hassan_history'] } },
        { text: 'الحجر الجنوبي ده اتحط إمتى؟', next: 'h_stone', when: { notFlags: ['hassan_stone'] } },
        { text: 'متشكر يا عم حسن.', next: 'h_bye' },
      ],
    },
  },
}

const ragab: Dialogue = {
  character: 'ragab',
  entries: [
    { node: 'r_closed', when: { closedGate: GATES.cafeOpen } },
    { node: 'r_again', when: { evidence: ['e_cafe_bill'] } },
    { node: 'r_first' },
  ],
  nodes: {
    r_closed: { id: 'r_closed', lines: [{ who: 'ragab', text: 'القهوة لسه ما فتحتش يا باشا… تعالى بعد العصر وهطلّعلك أحلى شاي.' }] },
    r_first: {
      id: 'r_first',
      lines: [{ who: 'ragab', text: 'أهلاً يا باشا! شاي ولا قهوة؟ ولا جاي تسأل عن بشمهندس محمود؟' }],
      choices: [
        { text: 'عاوز أسألك عن ليلة الاختفاء.', next: 'r_night' },
        { text: 'احكيلي عن الشغل والناس هنا يا معلم.', next: 'r_life' },
        { text: 'أنا جاي أشرب شاي بس.', next: 'r_tea' },
      ],
    },
    r_tea: { id: 'r_tea', lines: [{ who: 'ragab', text: 'عيني! شاي سكر برة… ولو افتكرت حاجة هناديك.' }], next: 'r_first' },
    r_night: {
      id: 'r_night',
      lines: [
        { who: 'ragab', text: 'الليلة دي القهوة كانت مقلوبة… بس سيّد، سواق المعلم شوقي، قعد حوالي ساعة وشرب شيشتين.' },
        { who: 'ragab', text: 'دفعلي ٩٥ جنيه وطلب فاتورة… عمره ما طلب فاتورة قبل كده! هو ده الراجل الغريب.' },
        { who: 'narrator', text: 'رجب فتح الدفتر وأراك السطر. اسم «سيّد» وتوقيت ١١:٠٥ م.' },
      ],
      effects: [{ type: 'evidence', id: 'e_cafe_bill' }],
      next: 'r_again',
    },
    r_again: {
      id: 'r_again',
      lines: [{ who: 'ragab', text: 'فاكر حاجة تانية يا باشا. اسألني.' }],
      choices: [
        { text: 'فاكر حاجة تانية من الليلة دي؟', next: 'r_more', when: { notEvidence: ['e_match_night_photo'] } },
        { text: 'احكيلي عن الشغل والناس هنا يا معلم.', next: 'r_life' },
        { text: 'انت وشوقي بينكم إيه يا معلم؟', next: 'r_debt', when: { notFlags: ['ragab_trust'] } },
        { text: 'عم حسن شاف عربية شوقي. إنت عارف أكتر.', next: 'r_confront_right', when: { evidence: ['e_hassan_testimony'], notFlags: ['ragab_confronted'] }, present: 'e_hassan_testimony', confront: true },
        { text: 'شوفت الصورة القديمة دي؟', next: 'r_confront_wrong', when: { evidence: ['e_old_photo'], notFlags: ['ragab_confronted'] }, present: 'e_old_photo', confront: true },
        { text: 'متشكر يا معلم.', next: 'r_bye' },
      ],
    },
    r_life: {
      id: 'r_life',
      lines: [
        { who: 'ragab', text: 'الإسكندرية كلها تجارة يا باشا… اللي بيبيع سمك، واللي بيبيع أرض، واللي بيبيع كلام. اختار تقف فين.' },
        { who: 'ragab', text: 'فيه تلات حاجات بتدور في القهوة: قعدة كوتشينة آخر الليل، وموبايل مستعمل عند ابن عمي عطية، وشغل توصيل بالليل لناس «الكبير».' },
      ],
      choices: [
        { text: 'قعدة الكوتشينة دي… فيها إيه؟', next: 'r_cards', when: { notFlags: ['life_cards', 'life_refuse_cards'] } },
        { text: 'موبايل ابن عمك… كاميرته كويسة؟', next: 'r_phone', when: { notFlags: ['life_trade_phone'] } },
        { text: 'مين «الكبير» ده؟', next: 'r_gang', when: { notFlags: ['life_join_gang', 'life_refuse_gang'] } },
        { text: 'تمام يا معلم، شكراً.', next: 'r_bye' },
      ],
    },
    r_cards: {
      id: 'r_cards',
      lines: [
        { who: 'ragab', text: 'دور واحد يا باشا، والرهان خدمة مش فلوس: اللي يخسر يجيب شاي للقهوة كلها. بس الناس اللي بتلعب بتتكلم… وأنا ودني على كل كلمة.' },
        { who: 'narrator', text: 'على الترابيزة خمس كروت مقلوبة، وعيون كتير بتتفرّج عليك.' },
      ],
      choices: [
        { text: 'اقعد وألعب دور.', next: 'r_cards_play' },
        { text: 'لأ، مش بلعب رهان.', next: 'r_cards_no' },
      ],
    },
    r_cards_play: {
      id: 'r_cards_play',
      lines: [
        { who: 'narrator', text: 'لعبت. خسرت دورين وكسبت الأخير بحركة ذكية. الشاي اتقسم والناس ضحكت… وسمعت من واحد على الترابيزة إن سيّد «بيقبض كاش من فوق»، وإن «الكبير» عارف كل حاجة عن اللي بيشتغل مع شوقي.' },
        { who: 'ragab', text: 'شفت؟ القهوة بتدّي أكتر ما بتاخد… بس خد بالك من الدور الجاي.' },
      ],
      effects: [{ type: 'flag', id: 'life_cards' }],
      next: 'r_life',
    },
    r_cards_no: {
      id: 'r_cards_no',
      lines: [
        { who: 'player', text: 'أنا جاي أدوّر على خالي، مش أراهن.' },
        { who: 'ragab', text: 'عين العقل. بس بلاش تقول الكلمة دي قدام الناس، تفتكر إنك مقصّر.' },
      ],
      effects: [{ type: 'flag', id: 'life_refuse_cards' }],
      next: 'r_life',
    },
    r_phone: {
      id: 'r_phone',
      lines: [
        { who: 'ragab', text: 'عطية عنده موبايل بكاميرا عال، جابه من واحد مسافر. هيطلب ألف ونص… بس لو عرفت تساومه هينزل على تمانية.' },
      ],
      choices: [
        { text: 'أساوم عطية.', next: 'r_phone_do' },
        { text: 'مش محتاج دلوقتي.', next: 'r_life' },
      ],
    },
    r_phone_do: {
      id: 'r_phone_do',
      lines: [
        { who: 'narrator', text: 'ساومت ٣ ساعات بالشاي والمقارنة. عطية قال: «إنت إسكندراني من جوّه». اشتريته بـ٨٥٠ جنيه والكاميرا فعلاً حلوة.' },
        { who: 'ragab', text: 'التجارة مش سرقة يا باشا. التجارة إنك تفهم قيمة الحاجة قبل صاحبها.' },
      ],
      effects: [{ type: 'flag', id: 'life_trade_phone' }],
      next: 'r_life',
    },
    r_gang: {
      id: 'r_gang',
      lines: [
        { who: 'ragab', text: '«الكبير» ده مش بيقول اسمه. عنده رجالة بيوصّلوا بضاعة بالليل من الميناء للعزبة: سجاير وقطع غيار… وحاجات مابتتسألش عنها. الأجر كويس، والخطر أحسن.' },
        { who: 'ragab', text: 'وأنا بحذّرك: اللي يدخل عندهم يبقى ليه دين، واللي يرفض يبقى ليه عين عليه.' },
      ],
      choices: [
        { text: 'أشتغل معاهم ليلة وأشوف.', next: 'r_gang_join' },
        { text: 'أرفض، ماليش في كده.', next: 'r_gang_no' },
      ],
    },
    r_gang_join: {
      id: 'r_gang_join',
      lines: [
        { who: 'narrator', text: 'وصّلت كرتونتين من ميكروباص لمخزن في آخر الترعة. الراجل اللي استلم مادّلكش اسمه، بس دفعلك ٤٠٠ جنيه ومسك كتفك: «الكبير بيحب اللي بيسكت».' },
        { who: 'narrator', text: 'وأنت راجع، سمعت اسم سيّد… بيتقال بين رجالة الكبير كأنه واحد منهم.' },
        { who: 'ragab', text: 'خلاص بقيت من الليل يا باشا… اتحمّل نتايجه.' },
      ],
      effects: [{ type: 'flag', id: 'life_join_gang' }],
      next: 'r_life',
    },
    r_gang_no: {
      id: 'r_gang_no',
      lines: [
        { who: 'player', text: 'أنا جاي أرجّع خالي، مش أشتغل في الضلمة.' },
        { who: 'ragab', text: 'يفتكروك. بس الحكاية مش هتنساك.' },
      ],
      effects: [{ type: 'flag', id: 'life_refuse_gang' }],
      next: 'r_life',
    },
    r_debt: {
      id: 'r_debt',
      lines: [
        { who: 'ragab', text: '…اقعد يا باشا. من خمس سنين القهوة كانت هتتقفل، وشوقي سلّفني. من يومها وهو بيسلّم عليّا كإني أخوه… وأنا بسلّم عليه كإني مديون.' },
        { who: 'ragab', text: 'مقدرتش أقولك قبل كده. بس الفاتورة دي… أنا كتبتها لأني زهقت من الخوف.' },
        { who: 'narrator', text: 'رجب مسح الترابيزة بإيد بتترعش. الضحكة اللي كانت على وشه اختفت أول مرة.' },
      ],
      effects: [{ type: 'flag', id: 'ragab_trust' }],
      next: 'r_again',
    },
    r_more: {
      id: 'r_more',
      lines: [{ who: 'ragab', text: '…استنى أفتكر.' }],
      choices: [
        { text: '(افتكر)', next: 'r_match', when: { gate: GATES.matchDay } },
        { text: '(انتظر)', next: 'r_nomatch', when: { closedGate: GATES.matchDay } },
      ],
    },
    r_match: {
      id: 'r_match',
      lines: [
        { who: 'ragab', text: 'النهاردة ماتش الاتحاد… وصوت الجمهور فكّرني! كنت بصوّر الجمهور الليلة دي… استنى!' },
        { who: 'ragab', text: 'شوف الصورة. في الخلفية شوقي نفسه بيكلّم سيّد قدام المرسيدس. ماكنتش واخد بالي!' },
      ],
      effects: [{ type: 'evidence', id: 'e_match_night_photo' }],
    },
    r_nomatch: {
      id: 'r_nomatch',
      lines: [{ who: 'ragab', text: 'مش جاي لي حاجة دلوقتي… بس كلّمني يوم ماتش الاتحاد، الجمهور بيصحّي ذاكرتي.' }],
    },
    r_confront_right: { id: 'r_confront_right', lines: [{ who: 'player', text: 'عم حسن شاف عربية شوقي عند الكوبري. إنت عارف أكتر من اللي قلته.' }, { who: 'ragab', text: 'يا ساتر… ماشي. سيّد ساب عندي مفتاح صغير وقال لي لو سأل حد أقول ماجاش. المفتاح كان رايح لمكتب شوقي.' }], effects: [{ type: 'flag', id: 'ragab_confronted' }, { type: 'flag', id: 'ragab_trust' }], next: 'r_again' },
    r_confront_wrong: { id: 'r_confront_wrong', lines: [{ who: 'ragab', text: 'دي صورة قديمة يا باشا، وأنا مش ناقص ذكريات. لو عندك سؤال عن الليلة هاته واضح.' }], next: 'r_again' },
    r_bye: { id: 'r_bye', lines: [{ who: 'ragab', text: 'تحت أمرك يا باشا. القهوة مفتوحة.' }] },
  },
}

const bahr: Dialogue = {
  character: 'bahr',
  entries: [
    { node: 'b_done', when: { flags: ['found_mahmoud'] } },
    { node: 'b_again', when: { evidence: ['e_bahr_testimony'] } },
    { node: 'b_first' },
  ],
  nodes: {
    b_first: {
      id: 'b_first',
      lines: [{ who: 'bahr', text: 'إيه يا ريّس؟ مش من هنا انت. جاي تسأل على إيه؟' }],
      choices: [
        { text: 'جاي أدوّر على خالي.', next: 'b_cold' },
        { text: 'الخيط ده تعرفه؟', next: 'b_thread', when: { evidence: ['e_thread_door'] } },
        { text: 'الصورة دي فيها العشة… قول اللي تعرفه.', next: 'b_confront_right', when: { evidence: ['e_qaitbay_photo'], notFlags: ['bahr_confronted'] }, present: 'e_qaitbay_photo', confront: true },
        { text: 'معايا دفتر قهوة… يمكن يهمك؟', next: 'b_confront_wrong', when: { evidence: ['e_cafe_bill'], notFlags: ['bahr_confronted'] }, present: 'e_cafe_bill', confront: true },
      ],
    },
    b_cold: { id: 'b_cold', lines: [{ who: 'bahr', text: 'ما أعرفش حد. الموج بيرمي كل يوم ناس… ويرجّعهم.' }], next: 'b_first' },
    b_thread: {
      id: 'b_thread',
      lines: [
        { who: 'bahr', text: '…العقدة دي عقدة بحّارة. أنا اللي علّمتها لمحمود من عشرين سنة.' },
        { who: 'bahr', text: 'جالي بعد المغرب وهو مرعوب وقاللي: «لو حد جه يسأل… ابعتله الخيط». خبّيته في العشة القديمة تحت القلعة.' },
        { who: 'bahr', text: 'روح للميناء… وصوّر القلعة من هناك. لو شفت الخيط الأحمر على السلم، يبقى إنت جاي من عنده.' },
      ],
      effects: [{ type: 'evidence', id: 'e_bahr_testimony' }, { type: 'flag', id: 'shed_known' }],
    },
    b_confront_right: { id: 'b_confront_right', lines: [{ who: 'player', text: 'الخيط ظاهر على سلم العشة. مين كان مستني هنا؟' }, { who: 'bahr', text: 'محمود كان مستني حد يجيب له ورقة. ماشفتهوش يمشي معاه… بس شفت عربية سودا بعيد عن السور.' }], effects: [{ type: 'flag', id: 'bahr_confronted' }, { type: 'flag', id: 'bahr_secret' }], next: 'b_first' },
    b_confront_wrong: { id: 'b_confront_wrong', lines: [{ who: 'bahr', text: 'ده حساب قهوة يا ريّس، والبحر مالهش في الحسابات دي. ورّيني حاجة فيها ملح أو حبل.' }], next: 'b_first' },
    b_again: {
      id: 'b_again',
      lines: [{ who: 'bahr', text: 'العشة تحت السور… صوّر القلعة وشوف الخيط. وبعدين افتح العشة بإيدك.' }],
      choices: [
        { text: 'احكيلي عن خالي زمان يا ريّس.', next: 'b_story', when: { notFlags: ['bahr_story'] } },
        { text: 'فيه شغل في الحلقة يا ريّس؟', next: 'b_fish', when: { notFlags: ['life_trade_fish'] } },
        { text: 'شفت مراكب بتطلع من غير نور بالليل.', next: 'b_boats', when: { notFlags: ['life_good_report', 'life_street_boat'] } },
        { text: 'تمام يا ريّس.', next: 'b_bye' },
      ],
    },
    b_story: {
      id: 'b_story',
      lines: [
        { who: 'bahr', text: 'من عشرين سنة جالنا شاب نحيف بشريط قياس، وقاللنا: «الميناء ده هيتباع، وانتوا مش هتعرفوا». رسم الخريطة بتاعتنا ببلاش، ورفض ياخد ولا جنيه.' },
        { who: 'bahr', text: 'يوم ما المستثمرين جم، الخريطة دي كانت دليلنا إن المراسي بتاعتنا. من يومها قلت: اللي يحمي الميّه، الميّه تحميه.' },
        { who: 'narrator', text: 'عم بحر شد الطاقية على جبينه. دي أطول جملة قالها من ساعة ما شفته.' },
      ],
      effects: [{ type: 'flag', id: 'bahr_story' }],
      next: 'b_again',
    },
    b_fish: {
      id: 'b_fish',
      lines: [
        { who: 'bahr', text: 'الحلقة بتفتح قبل الفجر في الأنفوشي. لو عرفت تحسب الميزان وتسكت، هتاخد ٣٠٠ جنيه على ساعتين. بس ماتبيعش ماتفهمش.' },
      ],
      choices: [
        { text: 'اشتغل معاهم الفجرية.', next: 'b_fish_do' },
        { text: 'مرة تانية يا ريّس.', next: 'b_again' },
      ],
    },
    b_fish_do: {
      id: 'b_fish_do',
      lines: [
        { who: 'narrator', text: '٤ الفجر. التلج بيلسع إيدك والمزاد بيجري. اتعلمت الفرق بين البوري والدنيس والمرجان من أول نظرة، وخدت ٣٠٠ جنيه وكيس سمك لستّك.' },
        { who: 'bahr', text: 'البحر بيدّي اللي بيصحى بدري يا ريّس.' },
      ],
      effects: [{ type: 'flag', id: 'life_trade_fish' }],
      next: 'b_again',
    },
    b_boats: {
      id: 'b_boats',
      lines: [
        { who: 'bahr', text: 'مراكب بتطفّي نورها وتطلع من ورا الحاجز: سجاير ومحروقات رخيصة وحاجات تانية. رجالة «الكبير» بيدفعوا كويس لأي واحد يركب معاهم أو يسكت.' },
        { who: 'bahr', text: 'انت بتختار، يا ريّس: تبلّغ خفر السواحل… ولا تركب ليلة وتعرف مين اللي واقف ورا.' },
      ],
      choices: [
        { text: 'أبلّغ خفر السواحل.', next: 'b_boats_report' },
        { text: 'أركب معاهم ليلة.', next: 'b_boats_ride' },
        { text: 'مش هتدخّل.', next: 'b_again' },
      ],
    },
    b_boats_report: {
      id: 'b_boats_report',
      lines: [
        { who: 'narrator', text: 'كتبت الرقم اللي قاله عم بحر واتصلت بغرفة العمليات. بعد ساعة، لنش خفر السواحل كان بيلف عند الحاجز. المراكب ماظهرتش تاني الليلة دي.' },
        { who: 'bahr', text: 'عملت اللي مافيش واحد عمله من سنين. بس انتبه… البحر ليه ودان.' },
      ],
      effects: [{ type: 'flag', id: 'life_good_report' }],
      next: 'b_again',
    },
    b_boats_ride: {
      id: 'b_boats_ride',
      lines: [
        { who: 'narrator', text: 'المركب شقّ الضلمة من غير نور. الموج ضرب في الجنب وإنت ماسك الحبل. شفت كراتين مغطاة بالزيت، وراجل بيحصي فلوس بخط محمود نفسه… ثانية، خط محمود؟ لا، شبهه بس.' },
        { who: 'narrator', text: 'رجعتوا قبل الفجر. خدت ٥٠٠ جنيه وكلمة: «الكبير هيعرف إنك ثقة».' },
      ],
      effects: [{ type: 'flag', id: 'life_street_boat' }],
      next: 'b_again',
    },
    b_bye: { id: 'b_bye', lines: [{ who: 'bahr', text: 'الموج معاك يا ريّس.' }] },
    b_done: {
      id: 'b_done',
      lines: [{ who: 'bahr', text: 'محمود لقيك أحسن ما كنت أتمنّى. ربنا يسلّمكم يا ريّس.' }],
      choices: [
        { text: 'احكيلي عن خالي زمان يا ريّس.', next: 'b_story', when: { notFlags: ['bahr_story'] } },
        { text: 'تمام يا ريّس.', next: 'b_bye' },
      ],
    },
  },
}

const fathy: Dialogue = {
  character: 'fathy',
  entries: [
    { node: 'f_closed', when: { closedGate: GATES.siteOpen } },
    { node: 'f_again', when: { evidence: ['e_fathy_testimony'] } },
    { node: 'f_first' },
  ],
  nodes: {
    f_closed: { id: 'f_closed', lines: [{ who: 'fathy', text: 'الموقع قفل يا بيه. ارجع الصبح، من التاسعة للخامسة.' }] },
    f_first: {
      id: 'f_first',
      lines: [
        { who: 'fathy', text: 'العمود ده عمره أكتر من ألف وسبعمية سنة. أنا هنا بقالي تلاتين سنة وماشفتش حاجة بتتغيّر… غير الناس.' },
      ],
      choices: [
        { text: 'شوفت المعلم شوقي هنا؟', next: 'f_shawky' },
        { text: 'محمود زار المكان ده؟', next: 'f_mahmoud' },
        { text: 'بتحرس الليل كله لوحدك؟', next: 'f_story', when: { notFlags: ['fathy_story'] } },
        { text: 'علّمني عن العمود يا عم فتحي.', next: 'f_lesson', when: { notFlags: ['life_study_history'] } },
        { text: 'الصورة دي بتفكّرك بمحمود وشوقي؟', next: 'f_confront_right', when: { evidence: ['e_old_photo'], notFlags: ['fathy_confronted'] }, present: 'e_old_photo', confront: true },
        { text: 'عندي خيط أحمر… تعرفه؟', next: 'f_confront_wrong', when: { evidence: ['e_thread_door'], notFlags: ['fathy_confronted'] }, present: 'e_thread_door', confront: true },
      ],
    },
    f_story: {
      id: 'f_story',
      lines: [
        { who: 'fathy', text: 'من تلاتين سنة وأنا بكتب في كراسة: مين عدّى، وإمتى، ولابس إيه. الناس فاكرة إني نايم… بس الحجر ما بيناموش، وأنا بتعلّم منه.' },
        { who: 'fathy', text: 'شوقي جه عندي أربع مرات في شهر واحد. كل مرة بعد نص الليل، وكل مرة بيبص ورا كتفه. الكراسة موجودة لو احتجتوها.' },
        { who: 'narrator', text: 'الكراسة ورقها أصفر ومرتب. تحس إن أمانة الراجل ده أتقل من العمود نفسه.' },
      ],
      effects: [{ type: 'flag', id: 'fathy_story' }],
      next: 'f_first',
    },
    f_mahmoud: {
      id: 'f_mahmoud',
      lines: [{ who: 'fathy', text: 'من سنين كان بيجي هو وشوقي شباب… وبيتصوّروا تحت العمود. وبعدين وقفوا يجوا.' }],
      next: 'f_first',
    },
    f_shawky: {
      id: 'f_shawky',
      lines: [
        { who: 'fathy', text: 'جه من تلات ليالي وكان متوتّر. رمى ورقة ممزقة في الصندوق اللي عند المدخل.' },
        { who: 'fathy', text: 'أنا لقيتها الصبح: نص عقد بيع أرض، وعليه ختم الجمعية… والتوقيع مش توقيع محمود. أنا عارف خطه.' },
      ],
      effects: [{ type: 'evidence', id: 'e_fathy_testimony' }],
    },
    f_confront_right: { id: 'f_confront_right', lines: [{ who: 'player', text: 'إنت شفتهم زمان، وورقة شوقي كانت في إيدك. قول الحقيقة.' }, { who: 'fathy', text: 'أيوه… محمود كان بيحاول يحذّر شوقي، مش يشاركه. الورقة اتقطعت قدامي، والتوقيع المزوّر كان واضح.' }], effects: [{ type: 'flag', id: 'fathy_confronted' }, { type: 'flag', id: 'fathy_secret' }], next: 'f_first' },
    f_confront_wrong: { id: 'f_confront_wrong', lines: [{ who: 'fathy', text: 'الخيط ده يخص محمود، يا ابني. أنا حارس حجر وورق، مش صياد عقد. اسألني عن اللي شوفته هنا.' }], next: 'f_first' },
    f_again: {
      id: 'f_again',
      lines: [{ who: 'fathy', text: 'لو احتجت شهادتي أنا موجود. الحق لازم يتقال.' }],
      choices: [
        { text: 'بتحرس الليل كله لوحدك؟', next: 'f_story', when: { notFlags: ['fathy_story'] } },
        { text: 'علّمني عن العمود يا عم فتحي.', next: 'f_lesson', when: { notFlags: ['life_study_history'] } },
        { text: 'متشكر يا عم فتحي.', next: 'f_bye' },
      ],
    },
    f_lesson: {
      id: 'f_lesson',
      lines: [
        { who: 'fathy', text: 'العمود ده اتعمل حوالي سنة ٢٩٧ ميلادية للإمبراطور دقلديانوس، مش لبومبي. الناس سمّته كده بالغلط من قرون. وتحته كان فيه معبد السيرابيوم ومكتبة صغيرة.' },
        { who: 'fathy', text: 'الحاجة اللي بتتعلّمها بجد هي اللي بتتحقق منها بنفسك. حتى لو الكل قال العكس.' },
        { who: 'narrator', text: 'سجّلت كل كلمة في دفترك، ولأول مرة من أسابيع حسيت إنك بتتعلّم مش بتجري.' },
      ],
      effects: [{ type: 'flag', id: 'life_study_history' }],
      next: 'f_again',
    },
    f_bye: { id: 'f_bye', lines: [{ who: 'fathy', text: 'الله معاك يا ابني.' }] },
  },
}

const shawky: Dialogue = {
  character: 'shawky',
  entries: [
    { node: 's_after', when: { evidence: ['e_forged_contract'] } },
    { node: 's_confront_bribe', when: { evidence: ['e_library_envelope'], flags: ['life_bribe'] } },
    { node: 's_confront', when: { evidence: ['e_library_envelope'] } },
    { node: 's_first' },
  ],
  nodes: {
    s_first: {
      id: 's_first',
      lines: [
        { who: 'shawky', text: 'أهلاً يا بشمهندس! صاحب خالك الله يرحمه… قصدي الله يرجعه بالسلامة. اتفضل.' },
        { who: 'player', text: '«الله يرحمه»؟ هو مات؟' },
        { who: 'shawky', text: 'لا لا… لسان زلق. اتفضل اسأل.' },
      ],
      choices: [
        { text: 'كنت فين ليلة الأربعاء؟', next: 's_alibi' },
        { text: 'سيّد سواقك كان في أبيس.', next: 's_driver', when: { evidence: ['e_cafe_bill'] } },
        { text: 'ورقة الأرض اللي اترمت في الموقع؟', next: 's_paper', when: { evidence: ['e_fathy_testimony'] } },
        { text: 'الطريق الجديد مهم أوي بالنسبة لك.', next: 's_debt', when: { flags: ['shawky_pressed'] } },
        { text: '(سيبه يتكلم…)', next: 's_offer', when: { flags: ['shawky_debt'], notFlags: ['life_bribe', 'life_refuse_bribe', 'life_haggle'] } },
      ],
    },
    s_debt: {
      id: 's_debt',
      lines: [
        { who: 'shawky', text: 'مهم؟ يا بشمهندس… البنك بيدق على بابي كل أسبوع. الراجل اللي بتشوفه قدامك ده معلّق بخيط أرفع من خيطك.' },
        { who: 'player', text: 'وده يديك الحق تقطع خيط غيرك؟' },
        { who: 'shawky', text: '…محدّش بيسأل الغريق عن حقه.' },
        { who: 'shawky', text: 'بنتي بتدرس برّه… كل مصروفاتها على قرض، والقرض بيكبر كل شهر. ماقولتلكش علشان تشفق عليّا. قولتلك علشان تفهم إن الخوف بيعمل أكتر من الطمع.' },
      ],
      effects: [{ type: 'flag', id: 'shawky_debt' }],
      next: 's_first',
    },
    s_offer: {
      id: 's_offer',
      lines: [
        { who: 'shawky', text: 'مفيش داعي نكمل اللعبة دي يا بشمهندس. معايا هنا خمسين ألف جنيه. تكمل دراستك، تساعد ستّك، وتنسى إسم الراجل ده وصورة ١٩٩٨.' },
        { who: 'narrator', text: 'الظرف على المكتب، سميك ومقفول. عيون شوقي ثابتة… بس صوابعه بتترعش على حافة الدرج.' },
      ],
      choices: [
        { text: '(خد الظرف.)', next: 's_take' },
        { text: '(رجّع الظرف مقفول.)', next: 's_refuse' },
        { text: 'قول رقم تاني… وأفكّر.', next: 's_haggle' },
      ],
    },
    s_take: {
      id: 's_take',
      lines: [
        { who: 'narrator', text: 'حطيت الظرف في جيبك. تقله غريب… أتقل من الخمسين ألف. شوقي ابتسم لأول مرة: «كنت عارف إنك عاقل».' },
        { who: 'shawky', text: 'هنتفاهم يا بشمهندس.' },
      ],
      effects: [{ type: 'flag', id: 'life_bribe' }],
      next: 's_first',
    },
    s_refuse: {
      id: 's_refuse',
      lines: [
        { who: 'player', text: 'ستّي عمرها ما خدت جنيه من حرام. وأنا ابنها.' },
        { who: 'narrator', text: 'رجّعت الظرف ببطء. شوقي ماحاولش يوقفك… بس عينه نزلت لأول مرة.' },
      ],
      effects: [{ type: 'flag', id: 'life_refuse_bribe' }],
      next: 's_first',
    },
    s_haggle: {
      id: 's_haggle',
      lines: [
        { who: 'player', text: 'خمسين ألف؟ ده تمن الحجر الجنوبي بس. قول رقم يليق بالقطعة كلها.' },
        { who: 'shawky', text: '…إنت بتكبر بسرعة يا بشمهندس. وده بيخوّفني أكتر.' },
      ],
      effects: [{ type: 'flag', id: 'life_haggle' }],
      next: 's_first',
    },
    s_alibi: {
      id: 's_alibi',
      lines: [{ who: 'shawky', text: 'في بيتي نايم زي الخلق. الشهود كتير… وإنت حافظ كلام الناس.' }],
      next: 's_first',
    },
    s_driver: {
      id: 's_driver',
      lines: [
        { who: 'shawky', text: '…سيّد؟ بيروح بيشرب شاي. مالي أنا؟' },
        { who: 'narrator', text: 'عينه رمشت مرتين. إيده اتحرّكت ناحية الدرج.' },
      ],
      effects: [{ type: 'flag', id: 'shawky_pressed' }],
      next: 's_first',
    },
    s_paper: {
      id: 's_paper',
      lines: [{ who: 'shawky', text: 'ورقة؟ أنا بتخلّص من ورق كتير يا بشمهندس. ده شغلي.' }],
      effects: [{ type: 'flag', id: 'shawky_pressed' }],
      next: 's_first',
    },
    s_confront: {
      id: 's_confront',
      lines: [
        { who: 'player', text: 'عندي الشهادة الأصلية من الجمعية، بتوقيع محمود… قبل ما تزحزح الحجر.' },
        { who: 'shawky', text: '…ده كلام فاضي. مفيش حاجة تثبت.' },
        { who: 'player', text: 'العقد اللي في درجك مزوّر. وده الدليل.' },
      ],
      choices: [
        { text: 'افتح الدرج بنفسك.', next: 's_snap', present: 'e_library_envelope', confront: true },
        { text: 'لو سلّمت نفسك دلوقتي هتنزل عقوبتك.', next: 's_snap', present: 'e_fathy_testimony', confront: true },
        { text: 'أوريك صورة قديمة وخلاص؟', next: 's_dismiss', when: { evidence: ['e_old_photo'] }, present: 'e_old_photo', confront: true },
      ],
    },
    s_dismiss: { id: 's_dismiss', lines: [{ who: 'shawky', text: 'صورة قديمة يا بشمهندس؟ دي ذكريات، مش دليل. لما يبقى معاك ورق اتكلم.' }], next: 's_confront' },
    s_confront_bribe: {
      id: 's_confront_bribe',
      lines: [
        { who: 'narrator', text: 'الظرف لسه في جيبك. تقله بيزيد كل ما تقرّب من المكتب.' },
        { who: 'shawky', text: 'يا بشمهندس… إنت خدت مني قبل كده. هتبيع لسانك ولا هتبيع ضميرك؟' },
        { who: 'player', text: 'هرجّعلك فلوسك… وإنت تسلّم الورق.' },
      ],
      choices: [
        { text: 'افتح الدرج بنفسك.', next: 's_snap' },
        { text: 'لو سلّمت نفسك دلوقتي هتنزل عقوبتك.', next: 's_snap' },
      ],
    },
    s_snap: {
      id: 's_snap',
      lines: [
        { who: 'shawky', text: '…خد! خد العقد الملعون! بس إنت مش هتخرج بيه من هنا يا بشمهندس…' },
        { who: 'narrator', text: 'رمى الملف على المكتب وإيده بتترعش. الورقة عليها توقيع محمود… بس الحروف مايلة بشكل مريب.' },
      ],
      effects: [{ type: 'evidence', id: 'e_forged_contract' }, { type: 'flag', id: 'shawky_confronted' }],
    },
    s_after: {
      id: 's_after',
      lines: [{ who: 'shawky', text: 'روح للي تروحله… أنا مش هتكلم تاني من غير محامي.' }],
    },
  },
}

const mahmoud: Dialogue = {
  character: 'mahmoud',
  entries: [
    { node: 'm_after', when: { flags: ['case_solved'] } },
    { node: 'm_hub', when: { flags: ['mahmoud_briefed'] } },
    { node: 'm_first' },
  ],
  nodes: {
    m_first: {
      id: 'm_first',
      lines: [
        { who: 'mahmoud', text: 'يا ابن الإيه! لقيتني… بسرعة أكتر من اللي توقعت.' },
        { who: 'player', text: 'عقدة البحّارة… ماكنتش هتفوتني.' },
        { who: 'narrator', text: 'خالك قام من مكانه ببطء، ومسك كتفك بإيدين بتترعش. للحظة، ماحدّش فيكم عرف يتكلم.' },
        { who: 'mahmoud', text: 'شوقي زحزح حجر الحدود وزوّر عقد البيع علشان تعويض الطريق. وأنا خبّيت الشهادة الأصلية في خزنة أمانات المكتبة. سيبت علامة على الجدار علشان تعرف تفتحها.' },
        { who: 'mahmoud', text: 'واجهه بالورق. وسيب اللوحة تتكلم. أنا مستنيك هنا… بس خد بالك.' },
      ],
      effects: [{ type: 'flag', id: 'mahmoud_briefed' }],
      next: 'm_hub',
    },
    m_hub: {
      id: 'm_hub',
      lines: [{ who: 'mahmoud', text: 'قول يا {player}… إيه اللي لسه شاغلك؟' }],
      choices: [
        { text: 'ليه ماكلمتنيش؟ كنت مرعوب منّي؟', next: 'm_why', when: { notFlags: ['mahmoud_why'] } },
        { text: 'مين اللي كان معاك في صورة ١٩٩٨؟', next: 'm_third', when: { evidence: ['e_old_photo'], notFlags: ['third_man_hint'] } },
        { text: 'احكيلي عن حياتك يا خالي… من أولها.', next: 'm_life', when: { notFlags: ['mahmoud_life'] } },
        { text: 'عايز أكمّل دراسة المساحة… تفتكر أنفع؟', next: 'm_study', when: { notFlags: ['life_study_promise'] } },
        { text: 'خليك هنا. أنا هرجع بالنهاية.', next: 'm_go' },
      ],
    },
    m_why: {
      id: 'm_why',
      lines: [
        { who: 'mahmoud', text: 'كلّمتك مرة واتنين… بس كل مرة كنت بسمع صوتك وأقفل. خفت أدخّلك في حاجة أكبر منك.' },
        { who: 'player', text: 'أنا ماردّيتش… وده اللي بيوجعني.' },
        { who: 'mahmoud', text: 'ولا يهمك. الخيط مش بيتقاس بالمكالمات يا ابني. وإنت جيت.' },
      ],
      effects: [{ type: 'flag', id: 'mahmoud_why' }],
      next: 'm_hub',
    },
    m_third: {
      id: 'm_third',
      lines: [
        { who: 'mahmoud', text: '…لسه فاكرها؟ كنا اتنين قدام العمود، بس الصورة اتصوّرت بتلات. الراجل التالت هو اللي دلّ شوقي على أول عقد مشبوه.' },
        { who: 'mahmoud', text: 'مش وقته أقولك اسمه. اقفل القضية دي الأول، وبعدين نفتح اللي بعدها.' },
        { who: 'narrator', text: 'اتحفر في دماغك سطر واحد: فيه راجل تالت… لسه ماحدّش قال اسمه.' },
      ],
      effects: [{ type: 'flag', id: 'third_man_hint' }],
      next: 'm_hub',
    },
    m_life: {
      id: 'm_life',
      lines: [
        { who: 'mahmoud', text: 'اتولدت في أبيس سنة ٧٨. أبويا غرق في الترعة، وأمك — أختي الكبيرة — ربطت في إيدي أول خيط أحمر وقالت: «اللي يتوه يشدّه».' },
        { who: 'mahmoud', text: 'اشتغلت مساح قبل ما أخلّص الكلية، وفتحت مكتب مع شوقي وراجل تالت. وبعدين اتفرقنا. سنة ٢٠١٦ لما الجنيه اتعوّم، الناس بدأت تجري ورا الأرض، وأنا بقيت أقيس أكتر وأربح أقل.' },
        { who: 'mahmoud', text: 'يوم ٢٠٢٤ لما اتعلن الطريق، عرفت إن فيه ناس هتغيّر الحدود. وماكنتش عارف إني هتحرك لوحدي.' },
        { who: 'narrator', text: 'سمعت قصة حياته كلها لأول مرة. حسيت إنك بتعرفه بجد.' },
      ],
      effects: [{ type: 'flag', id: 'mahmoud_life' }],
      next: 'm_hub',
    },
    m_study: {
      id: 'm_study',
      lines: [
        { who: 'mahmoud', text: 'المساحة مش بس شريط وميزان. هي قانون وتاريخ وضمير. لو كمّلت، هعلّمك أسرارها بنفسي.' },
        { who: 'player', text: 'أوعدك.' },
        { who: 'mahmoud', text: 'الوعود زي الخيوط يا ابني. اربطها صح.' },
      ],
      effects: [{ type: 'flag', id: 'life_study_promise' }],
      next: 'm_hub',
    },
    m_go: {
      id: 'm_go',
      lines: [
        { who: 'mahmoud', text: 'عقدة البحّارة اللي ربطتها في إيدك دلوقتي… ماتفكهاش لحد ما تخلّص.' },
      ],
    },
    m_after: {
      id: 'm_after',
      lines: [{ who: 'mahmoud', text: 'الخيط اتربط يا {player}. وعقدته المرة دي مش هتتفك.' }],
    },
  },
}

export const DIALOGUES: Partial<Record<CharacterId, Dialogue>> = { ...VILLAGER_DIALOGUES, zeinab, hassan, ragab, bahr, fathy, shawky, mahmoud }


const salma: Dialogue = {
  character: 'salma', entries: [{ node: 'sa_done', when: { flags: ['case02_solved'] } }, { node: 'sa_first' }],
  nodes: {
    sa_first: { id: 'sa_first', lines: [{ who: 'salma', text: 'إنت قريب محمود؟ شفت الظرف في إيدك… الورق ده مش جديد.' }], choices: [
      { text: 'عاوز أعرف مين لعب في سجل الطريق.', next: 'sa_archive', when: { evidence: ['e02_red_receipt'] } },
      { text: 'معايا بطاقة مخزن ٧.', next: 'sa_key', when: { evidence: ['e02_key_tag'] }, present: 'e02_key_tag', confront: true },
    ] },
    sa_archive: { id: 'sa_archive', lines: [{ who: 'player', text: 'الإيصال بيقول إن الدفع كمل بعد شوقي.' }, { who: 'salma', text: 'يبقى دور على صفحة الاستعارة. الملف اتسحب باسم مستعار، بس اللي كتبه كان مستعجل.' }], effects: [{ type: 'flag', id: 'salma_trust' }], next: 'sa_done' },
    sa_key: { id: 'sa_key', lines: [{ who: 'salma', text: 'البطاقة دي من مخزن البلدية، مش من مكتب عقارات. حرف «أ» عليها مش صدفة.' }], effects: [{ type: 'flag', id: 'salma_pressed' }], next: 'sa_done' },
    sa_done: { id: 'sa_done', lines: [{ who: 'salma', text: 'السجل وختمه عندك. متسيبش الورق يرجع يتبدل.' }] },
  },
}

const nabil: Dialogue = {
  character: 'nabil', entries: [{ node: 'n_done', when: { evidence: ['e02_recording'] } }, { node: 'n_first' }],
  nodes: {
    n_first: { id: 'n_first', lines: [{ who: 'nabil', text: 'بص يا باشا، أنا سواق مش شاهد… بس التسجيل ده فضل في موبايلي.' }], choices: [
      { text: 'شغّل التسجيل.', next: 'n_record', when: { flags: ['visited_city'] } },
      { text: 'الظرف ده تعرفه؟', next: 'n_dismiss', present: 'e02_black_envelope', confront: true, when: { evidence: ['e02_black_envelope'] } },
    ] },
    n_record: { id: 'n_record', lines: [{ who: 'nabil', text: 'الراكب قال: «على السور قبل الفجر… وخلي أدهم يستلم». أنا عملت نفسي مش سامع.' }], effects: [{ type: 'evidence', id: 'e02_recording' }, { type: 'flag', id: 'nabil_trust' }], next: 'n_done' },
    n_dismiss: { id: 'n_dismiss', lines: [{ who: 'nabil', text: 'ظرف إيه يا باشا؟ أنا ماليش في الورق. لو عايز الحقيقة اسمع التسجيل.' }], next: 'n_first' },
    n_done: { id: 'n_done', lines: [{ who: 'nabil', text: 'أنا قلت اللي سمعته. بعد كده الطريق هو اللي يكمّل.' }] },
  },
}

const adham: Dialogue = {
  character: 'adham', entries: [{ node: 'a_solved', when: { flags: ['case02_solved'] } }, { node: 'a_confront', when: { evidence: ['e02_corniche_photo', 'e02_recording'] } }, { node: 'a_first' }],
  nodes: {
    a_first: { id: 'a_first', lines: [{ who: 'adham', text: 'السور مقفول بعد نص الليل. امشي يا ابني.' }], choices: [
      { text: 'الفانوس رقم ٧ ظهر في الصورة.', next: 'a_dismiss', present: 'e02_corniche_photo', confront: true, when: { evidence: ['e02_corniche_photo'] } },
      { text: 'أنا بدوّر على محمود.', next: 'a_cold' },
    ] },
    a_dismiss: { id: 'a_dismiss', lines: [{ who: 'adham', text: 'الصورة ظلال يا ابني. البحر بيكبر كل حاجة.' }], next: 'a_first' },
    a_cold: { id: 'a_cold', lines: [{ who: 'adham', text: 'محمود خلص قضيته. دي مش نوبتي.' }], next: 'a_first' },
    a_confront: {
      id: 'a_confront',
      lines: [{ who: 'player', text: 'التسجيل نادى اسمك، والصورة حطتك عند الفانوس. الرسالة دي كانت ليك.' }, { who: 'adham', text: 'إنت جايب خيوط كتير… بس البحر لسه يقدر يبلعها.' }],
      effects: [{ type: 'flag', id: 'case02_adham_tied' }, { type: 'flag', id: 'case02_final_confronted' }],
      choices: [
        { text: 'واجهه بصوت التسجيل.', next: 'a_record', present: 'e02_recording', confront: true },
        { text: 'حط الرسالة قدامه.', next: 'a_note', when: { evidence: ['e02_messenger_note'] }, present: 'e02_messenger_note', confront: true },
        { text: 'اقفل عليه بالسجل والصوت.', next: 'a_final', when: { evidence: ['e02_messenger_note', 'e02_radio_log', 'e02_stock_manifest'] }, present: 'e02_stock_manifest', confront: true },
      ],
    },
    a_record: { id: 'a_record', lines: [{ who: 'player', text: 'الصوت قال اسمك قبل الفجر. مفيش بحر هيشوّش التسجيل.' }, { who: 'adham', text: 'كان اسمي في الشغل… مش معنى كده إني استلمت.' }], effects: [{ type: 'flag', id: 'adham_record_pressed' }], next: 'a_confront' },
    a_note: { id: 'a_note', lines: [{ who: 'player', text: '«المبلغ وصل. اقفل الباب عند السور». الرسالة مكتوبة للّي كان واقف هناك.' }, { who: 'adham', text: 'الرسالة ممكن تكون لأي حارس. إنت لسه ناقصك مين سلّم ومين قبض.' }], effects: [{ type: 'flag', id: 'adham_note_pressed' }], next: 'a_confront' },
    a_final: {
      id: 'a_final',
      lines: [
        { who: 'player', text: 'دفتر اللاسلكي حطّك عند مخزن ٧، والكشف يربط البطاقة بالفلوس. دي مش نوبة… دي سلسلة.' },
        { who: 'adham', text: 'أنا كنت آخر واحد في السور. ماعرفتش مين فوقي.' },
        { who: 'player', text: 'بس عرفت إن الدفع كمل بعد شوقي، وإنك فتحت الباب. قدامك فرصة واحدة تقول كل الأسماء.' },
        { who: 'adham', text: 'خلاص… شوقي بدأ، وفريد غطّى الأرقام، وأنا كنت الباب. خدوا الدفتر، وسيبوا البحر يشهد.' },
      ],
      effects: [{ type: 'flag', id: 'case02_adham_tied' }, { type: 'flag', id: 'case02_final_confronted' }, { type: 'flag', id: 'adham_confronted' }],
    },
    a_solved: { id: 'a_solved', lines: [{ who: 'adham', text: 'الدفتر عند النيابة. أنا هواجه اللي عملته.' }] },
  },
}

const nadia: Dialogue = {
  character: 'nadia', entries: [{ node: 'n2_done', when: { evidence: ['e02_radio_log'] } }, { node: 'n2_first' }],
  nodes: {
    n2_first: { id: 'n2_first', lines: [{ who: 'nadia', text: 'إنت قريب محمود؟ لو جاي تسأل عن صوت الليلة دي، اقفل الباب الأول.' }], choices: [
      { text: 'معايا رسالة من عند السور.', next: 'n2_log', when: { evidence: ['e02_messenger_note'] }, present: 'e02_messenger_note', confront: true },
      { text: 'عاوز أعرف مين قال «مخزن ٧».', next: 'n2_hint' },
    ] },
    n2_hint: { id: 'n2_hint', lines: [{ who: 'nadia', text: 'الصوت اتقطع عند كلمة «مخزن». دور في دفتر اللاسلكي، الورق ساعات يسمع أكتر من الجهاز.' }], next: 'n2_first' },
    n2_log: { id: 'n2_log', lines: [{ who: 'nadia', text: 'الرسالة دي اتكتبت بعد الاتصال. اسمع السطر اللي اتشال: «أدهم… مخزن سبعة». بعده التشويش بلع باقي الكلام.' }], effects: [{ type: 'evidence', id: 'e02_radio_log' }, { type: 'flag', id: 'nadia_trust' }], next: 'n2_done' },
    n2_done: { id: 'n2_done', lines: [{ who: 'nadia', text: 'دلوقتي الصوت عندك. متخليش حد يقنعك إن التشويش معناه مفيش حقيقة.' }] },
  },
}

const farid: Dialogue = {
  character: 'farid', entries: [{ node: 'f2_done', when: { evidence: ['e02_stock_manifest'] } }, { node: 'f2_first' }],
  nodes: {
    f2_first: { id: 'f2_first', lines: [{ who: 'farid', text: 'مخزن ٧ مش مفتوح للزيارات. واللي يفتح درج من غير إذن، بيقفل على نفسه.' }], choices: [
      { text: 'بطاقة المفتاح من درج شوقي.', next: 'f2_card', when: { evidence: ['e02_key_tag'] }, present: 'e02_key_tag', confront: true },
      { text: 'الصوت جاب اسم مخزن ٧.', next: 'f2_manifest', when: { evidence: ['e02_radio_log'] }, present: 'e02_radio_log', confront: true },
    ] },
    f2_card: { id: 'f2_card', lines: [{ who: 'farid', text: 'البطاقة دي خرجت من عندنا. بس الختم اللي عليها اتعمل من غير رقم وارد.' }], effects: [{ type: 'flag', id: 'farid_pressed' }], next: 'f2_manifest' },
    f2_manifest: { id: 'f2_manifest', lines: [{ who: 'farid', text: 'لو عايز الورق، بص تحت دفتر الاستلام. الكشف اتقص منه تلات خانات، لكن اللي اتشال سايب مكانه واضح.' }], effects: [{ type: 'evidence', id: 'e02_stock_manifest' }, { type: 'flag', id: 'farid_trust' }], next: 'f2_done' },
    f2_done: { id: 'f2_done', lines: [{ who: 'farid', text: 'الرقم اتربط. أنا هقول للنيابة كل اللي فاكره قبل ما حد يبدّل الدفتر.' }] },
  },
}

const omar: Dialogue = {
  character: 'omar', entries: [{ node: 'o3_done', when: { evidence: ['e03_river_note'] } }, { node: 'o3_first' }],
  nodes: {
    o3_first: { id: 'o3_first', lines: [{ who: 'omar', text: 'البوابة بتفتح وقتها بس. لو جاي من طرف الجمعية، أنا ما شوفتش حاجة.' }], choices: [
      { text: 'الفانوس اتكسر من جوّه.', next: 'o3_lantern', when: { evidence: ['e03_broken_lantern'] }, present: 'e03_broken_lantern', confront: true },
      { text: 'آثار العجل وصلت للترعة.', next: 'o3_prints', when: { evidence: ['e03_mud_prints'] }, present: 'e03_mud_prints', confront: true },
    ] },
    o3_lantern: { id: 'o3_lantern', lines: [{ who: 'omar', text: 'سمعت خَبطة جوّه البوابة، مش من برّه. العربية كانت شايلة صندوق وختم.' }], next: 'o3_note' },
    o3_prints: { id: 'o3_prints', lines: [{ who: 'omar', text: 'أنا شفت نفس النقشة. العربية وقفت عند البوابة، وبعدها الميّه مشيت في اتجاه تاني.' }], next: 'o3_note' },
    o3_note: { id: 'o3_note', lines: [{ who: 'omar', text: 'كتبت الوقت في دفتري: ٢:٤٠. الاسم كان هدى… شطبته أول ما سمعت عربية الجمعية.' }], effects: [{ type: 'evidence', id: 'e03_river_note' }, { type: 'flag', id: 'omar_trust' }], next: 'o3_done' },
    o3_done: { id: 'o3_done', lines: [{ who: 'omar', text: 'لو هتواجه حد، واجهه بالساعة. الساعة ما بتخافش من الختم.' }] },
  },
}

const hoda: Dialogue = {
  character: 'hoda', entries: [{ node: 'h3_confront', when: { evidence: ['e03_false_permit', 'e03_camera_roll'] } }, { node: 'h3_first' }],
  nodes: {
    h3_first: { id: 'h3_first', lines: [{ who: 'hoda', text: 'الجمعية فاتحة للناس، بس مش كل ورقة ينفع تتقري قدام القهوة.' }], choices: [
      { text: 'عاوز أسأل عن رقم بوابة ٣.', next: 'h3_route' },
      { text: 'السجل ده فيه توقيعك.', next: 'h3_route', when: { evidence: ['e03_coop_register'] }, present: 'e03_coop_register', confront: true },
    ] },
    h3_route: { id: 'h3_route', lines: [{ who: 'hoda', text: 'البوابة اتفتحت للصيانة. لو الميّه اتغيرت، يبقى الطلمبة لعبت مش الختم.' }], effects: [{ type: 'flag', id: 'hoda_pressed' }], next: 'h3_first' },
    h3_confront: {
      id: 'h3_confront', lines: [{ who: 'player', text: 'النيجاتيف حط عربية الجمعية عند البوابة، والتصريح يديها سبب. والسجل بيقول إن الختم كان عندك.' }, { who: 'hoda', text: 'إنت فاكر إن صورة وورقة يقدروا يهدّوا جمعية كاملة؟' }], choices: [
        { text: 'واجهها بالسجل.', next: 'h3_final', when: { evidence: ['e03_coop_register'] }, present: 'e03_coop_register', confront: true },
        { text: 'واجهها بالتصريح المزوّر.', next: 'h3_final', present: 'e03_false_permit', confront: true },
        { text: 'واجهها ببكرة الفيلم.', next: 'h3_final', present: 'e03_camera_roll', confront: true },
      ],
    },
    h3_final: { id: 'h3_final', lines: [{ who: 'player', text: 'التوقيت والملف والصور في ناحية، وكلامك في الناحية التانية.' }, { who: 'hoda', text: 'أنا غيّرت المجرى أسبوع واحد. قالوا لي الجمعية هتعلن إفلاسها لو ما مضيتش. كنت بحمي ناس كتير… بس حميت الورق الأول.' }], effects: [{ type: 'evidence', id: 'e03_final_statement' }, { type: 'flag', id: 'case03_confronted' }], next: 'h3_done' },
    h3_done: { id: 'h3_done', lines: [{ who: 'hoda', text: 'اكتب اسمي زي ما هو. بس اكتب كمان مين كان مستني العقد.' }] },
  },
}

const khaled: Dialogue = {
  character: 'khaled', entries: [{ node: 'k3_done', when: { evidence: ['e03_camera_roll'] } }, { node: 'k3_first' }],
  nodes: {
    k3_first: { id: 'k3_first', lines: [{ who: 'khaled', text: 'أنا بصوّر اللي الناس بتعدّيه. بس الفيلم ده مش للبيع.' }], choices: [
      { text: 'عاوز أشوف العربية عند الترعة.', next: 'k3_roll' },
      { text: 'مين حاول ياخد النيجاتيف؟', next: 'k3_warn' },
    ] },
    k3_warn: { id: 'k3_warn', lines: [{ who: 'khaled', text: 'حد من الجمعية عرض فلوس، وبعدها بعت حد يهددني. عشان كده خبّيت البكرة تحت مقعد البحر.' }], next: 'k3_roll' },
    k3_roll: { id: 'k3_roll', lines: [{ who: 'khaled', text: 'خد الصور. العربية والصندوق واضحين. اليد اللي فتحت الدرج ست… والختم النبيتي مش صدفة.' }], effects: [{ type: 'evidence', id: 'e03_negative' }, { type: 'evidence', id: 'e03_camera_roll' }, { type: 'flag', id: 'khaled_trust' }], next: 'k3_done' },
    k3_done: { id: 'k3_done', lines: [{ who: 'khaled', text: 'لو هتكتبها، اكتب إن الصورة اتاخدت قبل ما الميّه تغيّر لونها.' }] },
  },
}

/** Case01 remains the default export for old callers; new callers select by case id. */
export const DIALOGUES_BY_CASE: Record<string, Partial<Record<CharacterId, Dialogue>>> = {
  case01: DIALOGUES,
  case02: { salma, nabil, adham, nadia, farid, ...VILLAGER_DIALOGUES_02 },
  case03: { omar, hoda, khaled, ...VILLAGER_DIALOGUES_03 },
}
