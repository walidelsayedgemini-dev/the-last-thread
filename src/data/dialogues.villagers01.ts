import type { CharacterId, Dialogue } from './types'

/** Case01 village cast. Each tree keeps the optional errand in dialogue/hotspot flags so it never blocks the main objective HUD. */

const umm_saeed: Dialogue = {
  character: 'umm_saeed',
  entries: [{ node: 'us_done', when: { flags: ['umm_saeed_done'] } }, { node: 'us_trust', when: { evidence: ['e_bakery_ration'] } }, { node: 'us_first' }],
  nodes: {
    us_first: { id: 'us_first', lines: [{ who: 'umm_saeed', text: 'يا ضنايا، العيش لسه طالع سخن… بس وشّك يقول إنك جاي على حكاية تقيلة.' }], choices: [
      { text: 'مين بياخد عيش زيادة؟', next: 'us_bread' },
      { text: 'حد سأل عن بيت محمود؟', next: 'us_stranger' },
      { text: 'أبدأ منين يا أم سعيد؟', next: 'us_route' },
    ] },
    us_bread: { id: 'us_bread', lines: [{ who: 'umm_saeed', text: 'فيه حد بياخد رغيفين زيادة وبيمثل إنه ناسي. فتّش رفوف العيش، الصفحة اللي ناقصة هتقولك مين.' }], effects: [{ type: 'flag', id: 'umm_saeed_started' }], next: 'us_hub' },
    us_stranger: { id: 'us_stranger', lines: [{ who: 'umm_saeed', text: 'غريب بجاكت كحلي سأل عن بيت المسّاح قبل الفجر بيومين. السوق شافه أكتر مني… اسأل فاطمة.' }], effects: [{ type: 'flag', id: 'umm_saeed_trust' }], next: 'us_hub' },
    us_route: { id: 'us_route', lines: [{ who: 'umm_saeed', text: 'انزل من بدري يا ضنايا، بص على رفوف العيش هنا، ولو لقيت نمرة عربية عدّى على عم بركات في المزلقان.' }], next: 'us_hub' },
    us_hub: { id: 'us_hub', lines: [{ who: 'umm_saeed', text: 'عاوز تسأل في إيه تاني؟' }], choices: [
      { text: 'وريني صفحة العيش.', next: 'us_trust', when: { evidence: ['e_bakery_ration'] }, present: 'e_bakery_ration', confront: true },
      { text: 'متشكر يا أم سعيد.', next: 'us_bye' },
    ] },
    us_trust: { id: 'us_trust', lines: [{ who: 'player', text: 'الصفحة بتقول إن «س. س.» كان بياخد الزيادة وبيسأل عن بيت خالي.' }, { who: 'umm_saeed', text: 'يا ضنايا… ده سواق شوقي. خوفت أقول، بس الحق رغيفه ما يتخبّاش.' }], effects: [{ type: 'flag', id: 'umm_saeed_trust' }, { type: 'flag', id: 'umm_saeed_done' }], next: 'us_done' },
    us_bye: { id: 'us_bye', lines: [{ who: 'umm_saeed', text: 'ربنا يقوّيك. خد رغيف، التحقيق على معدة فاضية بيزوّغ.' }] },
    us_done: { id: 'us_done', lines: [{ who: 'umm_saeed', text: 'السوق عند فاطمة، والمزلقان عند بركات. امشِ ورا اللي بيتكتب مش اللي بيتقال.' }] },
  },
}

const omda: Dialogue = {
  character: 'omda',
  entries: [{ node: 'om_done', when: { flags: ['omda_done'] } }, { node: 'om_trust', when: { evidence: ['e_omda_guestbook'] } }, { node: 'om_first' }],
  nodes: {
    om_first: { id: 'om_first', lines: [{ who: 'omda', text: 'اقعد يا بني. الدوّار بابه واحد، والكلام اللي يتقال جواه عندي أمانة.' }], choices: [
      { text: 'دفتر الزوّار فيه إيه؟', next: 'om_book' },
      { text: 'شوقي زارك قريب؟', next: 'om_shawky' },
      { text: 'حد غريب دخل العزبة؟', next: 'om_rumor' },
    ] },
    om_book: { id: 'om_book', lines: [{ who: 'omda', text: 'الدفتر على الترابيزة. بص في الصفحة اللي قبل زيارة شوقي… بس ما تقلبش الكلام لفضيحة.' }], effects: [{ type: 'flag', id: 'omda_ledger_started' }], next: 'om_hub' },
    om_shawky: { id: 'om_shawky', lines: [{ who: 'omda', text: 'زارني وقال «تبرع». الكلمة كانت تقيلة على لسانه… واللي بعده أتقل. شوف دفتر الزيارات.' }], next: 'om_hub' },
    om_rumor: { id: 'om_rumor', lines: [{ who: 'omda', text: 'العربية وقفت هنا وما دخلتش. اللي شافها صح كان عم بركات عند السكة، واللي شاف أثرها عند المية عم عبده.' }], next: 'om_hub' },
    om_hub: { id: 'om_hub', lines: [{ who: 'omda', text: 'الكلام ده عندي أمانة. قول سؤالك.' }], choices: [
      { text: 'هراجع الدفتر وأرجعلك.', next: 'om_bye' },
      { text: 'أنا لقيت اسم شوقي وكلمة «تبرع».', next: 'om_trust', when: { evidence: ['e_omda_guestbook'] }, present: 'e_omda_guestbook', confront: true },
    ] },
    om_trust: { id: 'om_trust', lines: [{ who: 'player', text: 'ده مش تبرع يا عمدة. شوقي كان عايز توقيعك على تسوية القطعة.' }, { who: 'omda', text: 'صدقت يا بني. وقّعت من عشر سنين وما قريتش سطر الحدود… وكان عايز يكررها بالفلوس.' }], effects: [{ type: 'flag', id: 'omda_ledger_seen' }, { type: 'flag', id: 'omda_trust' }, { type: 'flag', id: 'omda_done' }], next: 'om_done' },
    om_bye: { id: 'om_bye', lines: [{ who: 'omda', text: 'روح وارجع بورقة، مش بظن. والكلام ده عندي أمانة.' }] },
    om_done: { id: 'om_done', lines: [{ who: 'omda', text: 'الطريق له نمرة، والمية لها دفتر. العزبة كلها شايفة، بس كل عين من شباك.' }] },
  },
}

const mounir: Dialogue = {
  character: 'mounir',
  entries: [{ node: 'mo_done', when: { flags: ['mounir_done'] } }, { node: 'mo_trust', when: { evidence: ['e_handwriting'] } }, { node: 'mo_first' }],
  nodes: {
    mo_first: { id: 'mo_first', lines: [{ who: 'mounir', text: 'يا بني، محمود كان أشطر واد دخل الفصل. خطه كان يميل قبل ما قلمه يميل.' }], choices: [
      { text: 'محتاج أقارن خطه.', next: 'mo_notebooks' },
      { text: 'كان بيحب الأرض ليه؟', next: 'mo_memory' },
      { text: 'مين كان بيزوّر كلامه؟', next: 'mo_rumor' },
    ] },
    mo_notebooks: { id: 'mo_notebooks', lines: [{ who: 'mounir', text: 'الكراسات في الدولاب. افحص السبورة الأول، وبعدين حط دفتر المساحة جنب كراسة الحساب.' }], effects: [{ type: 'flag', id: 'mounir_notebooks_started' }], next: 'mo_hub' },
    mo_memory: { id: 'mo_memory', lines: [{ who: 'mounir', text: 'كان بيقول إن الخط المستقيم أصدق من البشر. بعده روح المطحنة؛ صابر سمع كلاماً عن الأرض.' }], next: 'mo_hub' },
    mo_rumor: { id: 'mo_rumor', lines: [{ who: 'mounir', text: 'التزوير مش في شكل الحروف بس، يا بني… شوف خانة المية. اللي استعجل هناك استعجل في كل حاجة.' }], next: 'mo_hub' },
    mo_hub: { id: 'mo_hub', lines: [{ who: 'mounir', text: 'هات الورقة، وأنا أقول لك إيد مين سابتها.' }], choices: [
      { text: 'دي مقارنة الخط.', next: 'mo_trust', when: { evidence: ['e_handwriting'] }, present: 'e_handwriting', confront: true },
      { text: 'هرجعلك بعد ما ألاقي الكراسة.', next: 'mo_bye' },
    ] },
    mo_trust: { id: 'mo_trust', lines: [{ who: 'player', text: 'الخط ده بتاع محمود، بس خانة المية مش خطه.' }, { who: 'mounir', text: 'بالضبط يا بني. اللي كتب الخانة كان مستعجل يخلي الأرض عطشانة… اسأل عم عبده عن الموتور.' }], effects: [{ type: 'flag', id: 'mounir_trust' }, { type: 'flag', id: 'mounir_done' }], next: 'mo_done' },
    mo_bye: { id: 'mo_bye', lines: [{ who: 'mounir', text: 'الورق ما يهربش. بس الإنسان اللي بيهرب يسيب خطه وراه.' }] },
    mo_done: { id: 'mo_done', lines: [{ who: 'mounir', text: 'خلي عينك على ميل الحروف يا بني؛ التزوير بيبان في آخر السطر.' }] },
  },
}

const abdo: Dialogue = {
  character: 'abdo',
  entries: [{ node: 'ab_done', when: { flags: ['abdo_done'] } }, { node: 'ab_trust', when: { evidence: ['e_pump_payment'] } }, { node: 'ab_first' }],
  nodes: {
    ab_first: { id: 'ab_first', lines: [{ who: 'abdo', text: 'الموتور بيدور أو بيقف. الكلام الكتير ما يغيّرش صوته.' }], choices: [
      { text: 'المية اتقفلت عن القطعة؟', next: 'ab_log' },
      { text: 'مين لمس دفتر النوبتجية؟', next: 'ab_payment' },
      { text: 'سمعت عربية ناحية الجوافة؟', next: 'ab_rumor' },
    ] },
    ab_log: { id: 'ab_log', lines: [{ who: 'abdo', text: 'دفتر النوبتجية معلق. اقرأه الأول، ولو عايز الكلام كله بص على البراميل… الفلوس تسيب ريحتها.' }], effects: [{ type: 'flag', id: 'abdo_log_started' }], next: 'ab_hub' },
    ab_payment: { id: 'ab_payment', lines: [{ who: 'abdo', text: 'أنا ما ببيعش المية يا ابني… بس فيه إيصال جاز اتساب في الدرج. شوفه وانت ساكت.' }], next: 'ab_hub' },
    ab_rumor: { id: 'ab_rumor', lines: [{ who: 'abdo', text: 'العجلة عدّت من الجنينة قبل ما توصل هنا. عم بركات عند السكة كاتب وقتها أدق مني.' }], next: 'ab_hub' },
    ab_hub: { id: 'ab_hub', lines: [{ who: 'abdo', text: 'قول اللي عندك بسرعة، المية ليها ميعاد.' }], choices: [
      { text: 'الإيصال ده كان تمن قفل المية؟', next: 'ab_trust', when: { evidence: ['e_pump_payment'] }, present: 'e_pump_payment', confront: true },
      { text: 'هرجع بعد ما أقرأ الدفتر.', next: 'ab_bye' },
    ] },
    ab_trust: { id: 'ab_trust', lines: [{ who: 'player', text: 'الإيصال قبل وقف القطعة بيوم، والحرف «ش» واضح.' }, { who: 'abdo', text: 'حد دفعلي عشان أقفلها أسبوع. ماعرفتش إنهم هيحرّكوا الحجر… بس شوقي كان مستعجل.' }], effects: [{ type: 'flag', id: 'abdo_trust' }, { type: 'flag', id: 'abdo_done' }], next: 'ab_done' },
    ab_bye: { id: 'ab_bye', lines: [{ who: 'abdo', text: 'الموتور ما بيكدبش. ارجعلي بورقة، وأنا أهز راسي.' }] },
    ab_done: { id: 'ab_done', lines: [{ who: 'abdo', text: 'اللي يقفل المية يقدر يعرّي الأرض. واللي يدفع لازم يظهر في الدفتر.' }] },
  },
}

const hamada: Dialogue = {
  character: 'hamada',
  entries: [{ node: 'ha_done', when: { flags: ['hamada_done'] } }, { node: 'ha_trust', when: { evidence: ['e_pigeon_note'] } }, { node: 'ha_first' }],
  nodes: {
    ha_first: { id: 'ha_first', lines: [{ who: 'hamada', text: 'يا عم، الحمامة رجعت من إسكندرية قبلي! بس الرسالة تمنها مش فلوس.' }], choices: [
      { text: 'محمود كان بيستلف حمامك؟', next: 'ha_pigeon' },
      { text: 'شوفت عربية سودا؟', next: 'ha_rumor' },
      { text: 'هات اللي مخبيه.', next: 'ha_dare' },
    ] },
    ha_pigeon: { id: 'ha_pigeon', lines: [{ who: 'hamada', text: 'كان ياخد واحدة ويرجّعها من ناحية البحر. علبة الحلقات فيها حاجة لسه ما قريتهاش… افتحها وبعدين كلّمني.' }], effects: [{ type: 'flag', id: 'hamada_started' }], next: 'ha_hub' },
    ha_rumor: { id: 'ha_rumor', lines: [{ who: 'hamada', text: 'العربية وقفت جنب السوق، والسواق اشترى سجاير. فاطمة شافته، بس أنا شفت الحمامة وهي راجعة.' }], next: 'ha_hub' },
    ha_dare: { id: 'ha_dare', lines: [{ who: 'hamada', text: 'مش ببلاش يا عم! افتش علبة الحلقات الأول، وبعدها نتكلم جد.' }], next: 'ha_hub' },
    ha_hub: { id: 'ha_hub', lines: [{ who: 'hamada', text: 'رجعت؟ لقيت الورقة ولا لسه؟' }], choices: [
      { text: 'الرسالة دي بخط محمود.', next: 'ha_trust', when: { evidence: ['e_pigeon_note'] }, present: 'e_pigeon_note', confront: true },
      { text: 'استنى يا حمادة.', next: 'ha_bye' },
    ] },
    ha_trust: { id: 'ha_trust', lines: [{ who: 'player', text: '«ما تثقش في اللي ييجي بعربية سودا»… كان حاسس إن حد مراقبه.' }, { who: 'hamada', text: 'كنت عارف إنه خايف. خد الرسالة، وأنا أقولك: آخر حمامة خرجت من هنا رايحة لبيت الخال.' }], effects: [{ type: 'flag', id: 'hamada_trust' }, { type: 'flag', id: 'hamada_done' }], next: 'ha_done' },
    ha_bye: { id: 'ha_bye', lines: [{ who: 'hamada', text: 'الحمامة ترجع لصاحبها… وانت كمان هترجعلي لما تعرف.' }] },
    ha_done: { id: 'ha_done', lines: [{ who: 'hamada', text: 'الرسالة وصلت يا عم. اسأل الكبار عن الأرض، وأنا أراقب السما.' }] },
  },
}

const hagga_fatma: Dialogue = {
  character: 'hagga_fatma',
  entries: [{ node: 'hf_done', when: { flags: ['fatma_done'] } }, { node: 'hf_trust', when: { evidence: ['e_market_driver'] } }, { node: 'hf_first' }],
  nodes: {
    hf_first: { id: 'hf_first', lines: [{ who: 'hagga_fatma', text: 'اسمع مني يا ابني، السوق مراية العزبة… اللي يعدّي قدامي يسيب وشّه حتى لو خبّى اسمه.' }], choices: [
      { text: 'سواق عربية سودا سأل عن محمود؟', next: 'hf_driver' },
      { text: 'إيه اللي على الصناديق؟', next: 'hf_crates' },
      { text: 'مين بيمر من ناحية المزلقان؟', next: 'hf_rumor' },
    ] },
    hf_driver: { id: 'hf_driver', lines: [{ who: 'hagga_fatma', text: 'التروسيكل اللي عندي عليه العلامة. بص عليه، وبعدها أقولك السواق كان لابس إيه.' }], effects: [{ type: 'flag', id: 'fatma_started' }], next: 'hf_hub' },
    hf_crates: { id: 'hf_crates', lines: [{ who: 'hagga_fatma', text: 'الصندوق اللي عليه الختم الأزرق اتساب ورا السوق. العربية كانت تقيلة ومشيت ناحية السكة.' }], next: 'hf_hub' },
    hf_rumor: { id: 'hf_rumor', lines: [{ who: 'hagga_fatma', text: 'بركات بيكتب النمر، وأنا بفتكر الوشوش. روح له الأول، وبعدها ارجعلي بالنمرة.' }], next: 'hf_hub' },
    hf_hub: { id: 'hf_hub', lines: [{ who: 'hagga_fatma', text: 'قول يا بن أخت محمود، جبت نمرة ولا جاي تسمع وبس؟' }], choices: [
      { text: 'دي النمرة والوصف مع بعض.', next: 'hf_trust', when: { evidence: ['e_market_driver'] }, present: 'e_market_driver', confront: true },
      { text: 'لسه براجع السوق.', next: 'hf_bye' },
    ] },
    hf_trust: { id: 'hf_trust', lines: [{ who: 'player', text: 'الوصف طابق العربية اللي في دفتر المزلقان.' }, { who: 'hagga_fatma', text: 'يبقى سواق شوقي يا اسمع مني. سأل عن بيت المسّاح، واشترى سجاير كأنه داخل على مشوار طويل.' }], effects: [{ type: 'flag', id: 'fatma_trust' }, { type: 'flag', id: 'fatma_done' }], next: 'hf_done' },
    hf_bye: { id: 'hf_bye', lines: [{ who: 'hagga_fatma', text: 'ما تستعجلش. السوق مراية، بس لازم تقف قدامها.' }] },
    hf_done: { id: 'hf_done', lines: [{ who: 'hagga_fatma', text: 'العربية خرجت من هنا ناحية السكة. وأنا ما بنساش وش حد.' }] },
  },
}

const metwally: Dialogue = {
  character: 'metwally',
  entries: [{ node: 'mt_done', when: { flags: ['metwally_done'] } }, { node: 'mt_trust', when: { evidence: ['e_cemetery_cache'] } }, { node: 'mt_first' }],
  nodes: {
    mt_first: { id: 'mt_first', lines: [{ who: 'metwally', text: 'بسم الله… الأحياء بيكدبوا يا بني، إنما الحجر يفتكر كل خطوة.' }], choices: [
      { text: 'حوش عيلة محمود فين؟', next: 'mt_tomb' },
      { text: 'حد حفر هنا بالليل؟', next: 'mt_digging' },
      { text: 'محمود كان بييجي إمتى؟', next: 'mt_memory' },
    ] },
    mt_tomb: { id: 'mt_tomb', lines: [{ who: 'metwally', text: 'الباب الأبيض التاني. هو ساب حاجة جوّه من أسبوعين، وأنا شفت فانوساً غريباً عنده.' }], effects: [{ type: 'flag', id: 'metwally_started' }], next: 'mt_hub' },
    mt_digging: { id: 'mt_digging', lines: [{ who: 'metwally', text: 'حفر جنب الحوش وهرب لما شاف النور. لو عايز تعرف اللي اتخبّى، افتح باب العيلة.' }], next: 'mt_hub' },
    mt_memory: { id: 'mt_memory', lines: [{ who: 'metwally', text: 'كل خميس بعد العصر. وكان يمشي من الساقية للبيت، كأنه بيراجع خريطة في دماغه.' }], next: 'mt_hub' },
    mt_hub: { id: 'mt_hub', lines: [{ who: 'metwally', text: 'لقيت العلبة؟ وريهالي بالراحة.' }], choices: [
      { text: 'العلبة فيها مفتاح وأرقام.', next: 'mt_trust', when: { evidence: ['e_cemetery_cache'] }, present: 'e_cemetery_cache', confront: true },
      { text: 'هارجع بعدين.', next: 'mt_bye' },
    ] },
    mt_trust: { id: 'mt_trust', lines: [{ who: 'player', text: 'محمود خبّى دي هنا قبل ما يختفي.' }, { who: 'metwally', text: 'ربنا يستر عليه. كان عارف إن حد بيدوّر، فساب أثره عند أهله مش عند الأرض.' }], effects: [{ type: 'flag', id: 'metwally_trust' }, { type: 'flag', id: 'metwally_done' }], next: 'mt_done' },
    mt_bye: { id: 'mt_bye', lines: [{ who: 'metwally', text: 'ارجع بنور، يا بني. الترب ما بتحبش العجلة.' }] },
    mt_done: { id: 'mt_done', lines: [{ who: 'metwally', text: 'محمود مرّ من هنا حيّ وخايف. ده اللي الحجر فاكره.' }] },
  },
}

const dr_amal: Dialogue = {
  character: 'dr_amal',
  entries: [{ node: 'da_done', when: { flags: ['amal_done'] } }, { node: 'da_trust', when: { evidence: ['e_health_alias'] } }, { node: 'da_first' }],
  nodes: {
    da_first: { id: 'da_first', lines: [{ who: 'dr_amal', text: 'بالراحة يا ياسين. الوحدة مكان مرضى، بس أحياناً الجرح بيحكي أكتر من صاحبه.' }], choices: [
      { text: 'حد جه يوم ٢٤ بجرح في إيده؟', next: 'da_register' },
      { text: 'محمود كان مصاب؟', next: 'da_wound' },
      { text: 'مين سأل عنه؟', next: 'da_rumor' },
    ] },
    da_register: { id: 'da_register', lines: [{ who: 'dr_amal', text: 'السجل على المكتب. الصفحة اتشالت، لكن مكانها لسه باين. افحصها وبعدين نتكلم من غير ما نكشف سر مريض.' }], effects: [{ type: 'flag', id: 'amal_started' }], next: 'da_hub' },
    da_wound: { id: 'da_wound', lines: [{ who: 'dr_amal', text: 'ماقدرش أقول من غير ورقة. اللي أقدر أقوله إن الجرح كان في اليد، وصاحبه كان مستعجل يمشي.' }], next: 'da_hub' },
    da_rumor: { id: 'da_rumor', lines: [{ who: 'dr_amal', text: 'ماحدش سأل باسمه. عم بركات شاف عربية، وأم سعيد شافت راجل غريب قبل الفجر.' }], next: 'da_hub' },
    da_hub: { id: 'da_hub', lines: [{ who: 'dr_amal', text: 'لقيت الصفحة؟ بالراحة… دي خصوصية إنسان.' }], choices: [
      { text: 'السجل باسم «م. سالم».', next: 'da_trust', when: { evidence: ['e_health_alias'] }, present: 'e_health_alias', confront: true },
      { text: 'هسيب الصفحة مكانها.', next: 'da_bye' },
    ] },
    da_trust: { id: 'da_trust', lines: [{ who: 'player', text: 'الوصف يطابق جرح محمود. هو كان بيستخبى.' }, { who: 'dr_amal', text: 'أيوه. طلب مني الاسم المستعار، ووعدته ما أقولش. دلوقتي أقولك: خرج من هنا لوحده، مش مع حد.' }], effects: [{ type: 'flag', id: 'amal_trust' }, { type: 'flag', id: 'amal_done' }], next: 'da_done' },
    da_bye: { id: 'da_bye', lines: [{ who: 'dr_amal', text: 'ده الصح. لو عايز الحقيقة، خلي الدليل يتكلم من غير ما تجرح حد.' }] },
    da_done: { id: 'da_done', lines: [{ who: 'dr_amal', text: 'الجرح كان لمحمود، والخروج كان لوحده. بالراحة هتوصل.' }] },
  },
}

const barakat: Dialogue = {
  character: 'barakat',
  entries: [{ node: 'br_done', when: { flags: ['barakat_done'] } }, { node: 'br_trust', when: { evidence: ['e_rail_log'] } }, { node: 'br_first' }],
  nodes: {
    br_first: { id: 'br_first', lines: [{ who: 'barakat', text: 'حسب التعليمات، كل عجلة تعدّي تتكتب. بس التعليمات ما قالتش لي أفتكر بدل الدفتر.' }], choices: [
      { text: 'عربية سودا عدّت ليلة الاختفاء؟', next: 'br_log' },
      { text: 'نمرتها كانت إيه؟', next: 'br_memory' },
      { text: 'راحت ناحية فين؟', next: 'br_rumor' },
    ] },
    br_log: { id: 'br_log', lines: [{ who: 'barakat', text: 'دفتر الكشك مفتوح. دور على خانة ١٢:١٧، وبعدها لو لقيت النمرة ارجعلي من غير لف.' }], effects: [{ type: 'flag', id: 'barakat_started' }], next: 'br_hub' },
    br_memory: { id: 'br_memory', lines: [{ who: 'barakat', text: 'آخرها ١٢٣٤ س ن ع. كتبتها بعد ما صحيت، وده مخالف للتعليمات… بس الرقم ما خاننيش.' }], next: 'br_hub' },
    br_rumor: { id: 'br_rumor', lines: [{ who: 'barakat', text: 'ناحية الأرض ثم رجوع قبل القطر. اللي شاف الطين على الكاوتش عند الجنينة، مش أنا.' }], next: 'br_hub' },
    br_hub: { id: 'br_hub', lines: [{ who: 'barakat', text: 'هات الدفتر. الكلام الرسمي له ختم.' }], choices: [
      { text: 'النمرة عندي في الدفتر.', next: 'br_trust', when: { evidence: ['e_rail_log'] }, present: 'e_rail_log', confront: true },
      { text: 'هراجع السطر تاني.', next: 'br_bye' },
    ] },
    br_trust: { id: 'br_trust', lines: [{ who: 'player', text: 'النمرة تطابق عربية شوقي.' }, { who: 'barakat', text: 'كنت نايم ساعة، يا ابني. بس كتبتها من الذاكرة. حسب التعليمات، الحق أهم من النوم.' }], effects: [{ type: 'flag', id: 'barakat_trust' }, { type: 'flag', id: 'barakat_done' }], next: 'br_done' },
    br_bye: { id: 'br_bye', lines: [{ who: 'barakat', text: 'الدفتر ما يتخانقش. راجع الساعة والنمرة.' }] },
    br_done: { id: 'br_done', lines: [{ who: 'barakat', text: 'القطر له ميعاد، والعربيات كمان. اللي يعدّي من غير أثر يبقى ماعدّاش.' }] },
  },
}

const saber: Dialogue = {
  character: 'saber',
  entries: [{ node: 'sa_done', when: { flags: ['saber_done'] } }, { node: 'sa_trust', when: { evidence: ['e_miller_promise'] } }, { node: 'sa_first' }],
  nodes: {
    sa_first: { id: 'sa_first', lines: [{ who: 'saber', text: 'شوفي شغلك يا ابني وقول عاوز إيه دوغري… المكن شغال والدنيا زحمة.' }], choices: [
      { text: 'مين وعدك بأرض القطعة؟', next: 'sa_promise' },
      { text: 'نتيجة الحيطة بتخبي إيه؟', next: 'sa_calendar' },
      { text: 'إنت كنت مستفيد؟', next: 'sa_debt' },
    ] },
    sa_promise: { id: 'sa_promise', lines: [{ who: 'saber', text: 'ورقة الوعد ملزّقة ورا نتيجة الحيطة. اقراها الأول وبعدين تعالَ كلمني.' }], effects: [{ type: 'flag', id: 'saber_started' }], next: 'sa_hub' },
    sa_calendar: { id: 'sa_calendar', lines: [{ who: 'saber', text: 'النتيجة واقفة على شهر قديم، بس القلم اللي وراها جديد. شوقي قال إن الأرض هتبقى رخيصة لما محمود يبعد.' }], next: 'sa_hub' },
    sa_debt: { id: 'sa_debt', lines: [{ who: 'saber', text: 'ديون الجمعية على رقبتي. عشان كده هقول الحق على المكشوف، شوقي هو اللي جاب الوعد.' }], next: 'sa_hub' },
    sa_hub: { id: 'sa_hub', lines: [{ who: 'saber', text: 'هتوريني الورقة ولا هتكلمني من غير سند؟' }], choices: [
      { text: 'الوعد مكتوب واسم شوقي واضح.', next: 'sa_trust', when: { evidence: ['e_miller_promise'] }, present: 'e_miller_promise', confront: true },
      { text: 'هراجع النتيجة.', next: 'sa_bye' },
    ] },
    sa_trust: { id: 'sa_trust', lines: [{ who: 'player', text: 'ده وعد بشراء الأرض بعد إبعاد محمود.' }, { who: 'saber', text: 'أيوه. كنت غرقان في الديون، واللي جرّني للسكة دي شوقي. الأرض ما كانتش هتتباع طول ما محمود موجود.' }], effects: [{ type: 'flag', id: 'saber_trust' }, { type: 'flag', id: 'saber_done' }], next: 'sa_done' },
    sa_bye: { id: 'sa_bye', lines: [{ who: 'saber', text: 'لما تجيب الورقة ابقى اتكلم معايا.' }] },
    sa_done: { id: 'sa_done', lines: [{ who: 'saber', text: 'قولت كل اللي عندي قدام الورق… ومفيش كلمة هزودها.' }] },
  },
}

const am_mahdi: Dialogue = {
  character: 'am_mahdi',
  entries: [{ node: 'am_done', when: { flags: ['found_mahmoud'] } }, { node: 'am_again', when: { flags: ['am_mahdi_talked'] } }, { node: 'am_first' }],
  nodes: {
    am_first: {
      id: 'am_first',
      lines: [
        { who: 'am_mahdi', text: 'أهلاً يا ياسين يا أهلاوي! تعالَ اقعد هنا، البراد لسه منزله من على النار.' },
        { who: 'player', text: 'عامل إيه يا عم مهدي؟ خالي محمود عدّى عليك قبل ما يختفي؟' },
        { who: 'am_mahdi', text: 'محمود؟ قعد هنا ليلة الحد اللي فات مع علاء بتاع ٥/٨ يشربوا شاي. كانوا بيبصوا في كراسة قياس وقلقانين، وقال لي قبل ما يقوم: «لو حد سأل عني في المضيفة قول لهم سافر إسكندرية».' },
      ],
      choices: [
        { text: 'كانوا بيتكلموا عن إيه مع علاء؟', next: 'am_alaa' },
        { text: 'قهوة عم عرفة شافت عربية؟', next: 'am_arafa_hint' },
        { text: 'لسه فاكر ماتش الأهلي والقاضية هنا؟', next: 'am_ahly' },
      ],
    },
    am_alaa: {
      id: 'am_alaa',
      lines: [
        { who: 'am_mahdi', text: 'علاء عماد جايله من قرية ٥/٨ التمنيات ومعاه مسودة حدود الترعة القديمة من التسعينات، من أيام ما نقلوا الدفاتر بعد زلزال ٩٢. روح له ٥/٨ وهو هيفرّدلك الأرقام.' },
      ],
      effects: [{ type: 'flag', id: 'am_mahdi_talked' }],
      next: 'am_again',
    },
    am_arafa_hint: {
      id: 'am_arafa_hint',
      lines: [
        { who: 'am_mahdi', text: 'ناصية قهوة عم عرفة كاشفة حارة المضيفة والجامع كويس أوي. عم عرفة قال لي إنه شاف عربية ملاكي غريبة وقفت ورا المضيفة عند جامع قرية ١٥.' },
      ],
      effects: [{ type: 'flag', id: 'am_mahdi_talked' }],
      next: 'am_again',
    },
    am_ahly: {
      id: 'am_ahly',
      lines: [
        { who: 'am_mahdi', text: 'ههههه ده اليوم ده انت وخالك وعلاء وأحمد بشير قلبتوا القهوة فرح! والاتحداوية في قهوة رجب كانوا بيضحكوا معانا برضه. ربنا يرجّع خالك بالسلامة ونشوف الماتش الجاي سوا.' },
      ],
      effects: [{ type: 'flag', id: 'am_mahdi_talked' }],
      next: 'am_again',
    },
    am_again: {
      id: 'am_again',
      lines: [{ who: 'am_mahdi', text: 'قهوة قرية ١٥ بيتك يا بشمهندس. عدّيت على عم عرفة أو علاء في ٥/٨؟' }],
      choices: [
        { text: 'أحمد بشير كان هنا إمتى؟', next: 'am_ahmed' },
        { text: 'نازل أشوفهم دلوقتي يا عم مهدي.', next: 'am_bye' },
      ],
    },
    am_ahmed: {
      id: 'am_ahmed',
      lines: [{ who: 'am_mahdi', text: 'أحمد بشير لسه مروح من ساعة على عزبة ٥ عند الثورة الرئيسية. شاف عربية سودة طالعة على الطريق العمومي ونمرتها معلّقة في دماغه.' }],
      next: 'am_again',
    },
    am_bye: { id: 'am_bye', lines: [{ who: 'am_mahdi', text: 'الله يطمن ستّك مهدية يا ابني، سلم لي عليها.' }] },
    am_done: { id: 'am_done', lines: [{ who: 'am_mahdi', text: 'ألف حمد لله على سلامة خالك يا أهلاوي! النهارده الشاي في القهوة على حسابي للجميع.' }] },
  },
}

const am_arafa: Dialogue = {
  character: 'am_arafa',
  entries: [{ node: 'aa_done', when: { flags: ['found_mahmoud'] } }, { node: 'aa_again', when: { flags: ['am_arafa_talked'] } }, { node: 'aa_first' }],
  nodes: {
    aa_first: {
      id: 'aa_first',
      lines: [
        { who: 'am_arafa', text: 'تعالَ يا ياسين، خُد كرسي عالناصية هنا. أنا عيني على شارع المضيفة والجامع طول النهار.' },
        { who: 'player', text: 'شفت حد غريب قرب المضيفة أو جامع قرية ١٥ يا عم عرفة؟' },
        { who: 'am_arafa', text: 'آه والله! قبل اختفاء خالك بيوم، وقفت عربية سودا ورا حيطة المضيفة من ناحية الجامع. نزل منها واحد لابس بدلة وسأل العيال على بيت «المهندس محمود بتاع الجمعية».' },
      ],
      choices: [
        { text: 'كان معاه حد أو ساب حاجة في المضيفة؟', next: 'aa_mudayfa' },
        { text: 'طلعت من القرية على فين؟', next: 'aa_direction' },
      ],
    },
    aa_mudayfa: {
      id: 'aa_mudayfa',
      lines: [
        { who: 'am_arafa', text: 'دخلوا المضيفة القريبة من الجامع ربع ساعة يتكلموا مع العمدة وبعدها خرجوا وشهم مقلوب. ستّك مهدية كانت بتوصي محمود ما يمضيش ورقة في المضيفة من غير ما يقرأها.' },
      ],
      effects: [{ type: 'flag', id: 'am_arafa_talked' }],
      next: 'aa_again',
    },
    aa_direction: {
      id: 'aa_direction',
      lines: [
        { who: 'am_arafa', text: 'لفّت ناحية ترعة الثورة وعزبة ٥، ناحية بيت صاحبك أحمد بشير. اسأله هو وأبوه، العربيات التقيلة هناك ما بتفلتش من عينهم.' },
      ],
      effects: [{ type: 'flag', id: 'am_arafa_talked' }],
      next: 'aa_again',
    },
    aa_again: {
      id: 'aa_again',
      lines: [{ who: 'am_arafa', text: 'الشاي سخن لو نفسك فيه يا ابني… وأي عربية هتدخل ناصية قرية ١٥ هدّيك خبر.' }],
      choices: [
        { text: 'المضيفة وراها الجامع مفتوح؟', next: 'aa_mosque' },
        { text: 'تسلم يا عم عرفة.', next: 'aa_bye' },
      ],
    },
    aa_mosque: {
      id: 'aa_mosque',
      lines: [{ who: 'am_arafa', text: 'أيوه، باب المضيفة في وش الطريق وباب جامع قرية ١٥ في ضهرها على طول. عم حسن قاعد هناك بعد العصر.' }],
      next: 'aa_again',
    },
    aa_bye: { id: 'aa_bye', lines: [{ who: 'am_arafa', text: 'ربنا معاك يا ياسين ويطمن قلبك.' }] },
    aa_done: { id: 'aa_done', lines: [{ who: 'am_arafa', text: 'الحمد لله إن خالك رجع وسط أهله يا ياسين. قرية ١٥ كلها كانت قلقانة.' }] },
  },
}

const ahmed_basheer: Dialogue = {
  character: 'ahmed_basheer',
  entries: [{ node: 'ab_done', when: { flags: ['found_mahmoud'] } }, { node: 'ab_again', when: { flags: ['ahmed_talked'] } }, { node: 'ab_first' }],
  nodes: {
    ab_first: {
      id: 'ab_first',
      lines: [
        { who: 'ahmed_basheer', text: 'أهلاً يا ياسو، نزلت لك أول ما سمعت إن الحاج محمود مرجعش. الدنيا هنا في عزبة ٥ على الثورة الرئيسية كاشفة كل اللي طالع من قرية ١٥.' },
        { who: 'player', text: 'أحمد، شفت عربية ملاكي سودا عدّت من الثورة الرئيسية ناحية الطريق الزراعي ليلة التلات؟' },
        { who: 'ahmed_basheer', text: 'يا يسطا أيوه! شوفتها قدام الترعة هنا الساعة حداشر ونص بالليل تقريباً. كانت مبطّئة ومعدّية المزلقان بسرعة أول ما طالع طريق إسكندرية. اللي سايقها كان جاي من ناحية المنشية وموقف الترام القديم.' },
      ],
      choices: [
        { text: 'عرفنا إزاي إنها من المنشية؟', next: 'ab_clue' },
        { text: 'كلمت علاء عماد في ٥/٨؟', next: 'ab_alaa' },
      ],
    },
    ab_clue: {
      id: 'ab_clue',
      lines: [
        { who: 'ahmed_basheer', text: 'كانت مركّبة طين طازة على الكاوتش زي طين القطعة ١٥، وكان لازق على الإكصدام استيكر باركنج المنشية. وكنت بكلمك وقتها علشان ماتش الأهلي ونسيت أبص في باقي الأرقام، حقك عليّا.' },
      ],
      effects: [{ type: 'flag', id: 'ahmed_talked' }],
      next: 'ab_again',
    },
    ab_alaa: {
      id: 'ab_alaa',
      lines: [
        { who: 'ahmed_basheer', text: 'علاء عماد مستنيك في قرية ٥/٨ التمنيات من امبارح. قالي معاه فرق مساحات بين ورق الجمعية بتاع ٢٠٢٤ وورق الإصلاح الزراعي، وده اللي كان معصب خالك.' },
      ],
      effects: [{ type: 'flag', id: 'ahmed_talked' }],
      next: 'ab_again',
    },
    ab_again: {
      id: 'ab_again',
      lines: [{ who: 'ahmed_basheer', text: 'أي مشوار في الثورة أو أبيس كلمني يا ياسو وأنا تحت أمرك.' }],
      choices: [
        { text: 'بعد ما نرجّع خالي علينا قعدة في قهوة عم مهدي.', next: 'ab_match' },
        { text: 'ربنا يخليك يا أحمد.', next: 'ab_bye' },
      ],
    },
    ab_match: {
      id: 'ab_match',
      lines: [{ who: 'ahmed_basheer', text: 'أكيد يا باشا، بس نخلّص موضوع الحاج محمود الأول، وبعدها التالتة شمال مستنيانا!' }],
      next: 'ab_again',
    },
    ab_bye: { id: 'ab_bye', lines: [{ who: 'ahmed_basheer', text: 'خلي تليفونك مفتوح يا ياسين.' }] },
    ab_done: { id: 'ab_done', lines: [{ who: 'ahmed_basheer', text: 'مبروك يا ياسو! وجود الحاج محمود بينا بالسلامة أحلى من أي بطولة!' }] },
  },
}

const alaa_emad: Dialogue = {
  character: 'alaa_emad',
  entries: [{ node: 'al_done', when: { flags: ['found_mahmoud'] } }, { node: 'al_again', when: { flags: ['alaa_talked'] } }, { node: 'al_first' }],
  nodes: {
    al_first: {
      id: 'al_first',
      lines: [
        { who: 'alaa_emad', text: 'أهلاً يا ياسين. كنت متأكد إنك هتوصل هنا لقرية ٥/٨ التمنيات، خالك محمود لسه سايب عندي كراسة مقارنة الأحواض.' },
        { who: 'player', text: 'علاء، خالي لاحظ إيه في القياس الجديد قبل ما يختفي؟' },
        { who: 'alaa_emad', text: 'قعدنا هنا يوم الجمعة نطابق إحداثيات أحواض التمنيات وقرية ١٥ مع لوح الأرشيف القديمة اللي فضلت بعد نقل ملفات زلزال ٩٢. لقينا حجر القطعة ١٥ الجنوبي اتنقل ١٤ متر ناحية الترعة علشان يوسّع أرض التعويضات لملف شوقي.' },
      ],
      choices: [
        { text: 'والنسخة الأصلية السليمة فين دلوقتي؟', next: 'al_copy' },
        { text: 'ليه ربط موضوع الترام والمكتبة ببعض؟', next: 'al_timeline' },
      ],
    },
    al_copy: {
      id: 'al_copy',
      lines: [
        { who: 'alaa_emad', text: 'محمود عمل صورة مصدّقة ومضاها في مكتبة الإسكندرية اللي حضر افتتاحها سنة ٢٠٠٢، وحطها في مظروف بأرقام جدارية الحروف عشان مفيش سمسار يوصلها. ومعايا هنا نوتة بالإحداثيات الصحيحة تشهدله.' },
      ],
      effects: [{ type: 'flag', id: 'alaa_talked' }],
      next: 'al_again',
    },
    al_timeline: {
      id: 'al_timeline',
      lines: [
        { who: 'alaa_emad', text: 'قال لي من ساعة زلزال ٩٢ لحد موكب المومياوات ٢٠٢١ الناس بتهتم بالتاريخ الكبير وتنسى خرائط العزب الصغيرة. ووقت تطوير ترام الرمل السريع السنة دي والزحمة على طريق أبيس، كل اللي ساوموا على الأرض اتكشفوا.' },
      ],
      effects: [{ type: 'flag', id: 'alaa_talked' }],
      next: 'al_again',
    },
    al_again: {
      id: 'al_again',
      lines: [{ who: 'alaa_emad', text: 'القياسات الأصلية متسجلة عندي يا ياسين… لما تروح إسكندرية وتجيب الظرف من المكتبة، الحقيقة كلها هتركب على بعضها.' }],
      choices: [
        { text: 'أشوفك على خير يا علاء.', next: 'al_bye' },
      ],
    },
    al_bye: { id: 'al_bye', lines: [{ who: 'alaa_emad', text: 'مع السلامة يا ياسين، وسلم على ستّك مهدية.' }] },
    al_done: { id: 'al_done', lines: [{ who: 'alaa_emad', text: 'خالك علّمنا إن المساحة الصح بتبان حتى بعد سنين. مبروك رجوعه يا ياسين.' }] },
  },
}

export const VILLAGER_DIALOGUES: Partial<Record<CharacterId, Dialogue>> = {
  umm_saeed, omda, mounir, abdo, hamada, hagga_fatma, metwally, dr_amal, barakat, saber,
  am_mahdi, am_arafa, ahmed_basheer, alaa_emad,
}
