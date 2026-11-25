import type { CaseFile } from './types'

/** Case 02 continues directly from Mahmoud's anonymous envelope. Every critical clue is ungated. */
export const CASE_02: CaseFile = {
  id: 'case02', number: '٢', title: 'ظرف من غير اسم', tagline: 'الظرف الأخير فتح باباً أقدم من الخيط.',
  intro: [
    'بعد ما رجع محمود، لقيت ظرفاً أسود على مكتبه من غير اسم ولا طابع.',
    'جواه تذكرة قديمة وجملة واحدة: «اللي باع السر، لسه بيقبض تمنه عند البحر».',
    'القضية دي أقصر… بس كل خطوة فيها هتقرّبك من الشخص اللي كان بيحرّك الخيوط من بعيد.',
  ],
  suspects: [
    { id: 'salma', label: 'سلمى – موظفة الأرشيف' },
    { id: 'nabil', label: 'نبيل – سواق الميكروباص' },
    { id: 'adham', label: 'أدهم – حارس الكورنيش' },
    { id: 'unknown', label: 'المرسل المجهول' },
  ],
  evidence: [
    { id: 'e02_black_envelope', title: 'الظرف الأسود', kind: 'document', place: 'mahmoud_house', source: 'مكتب محمود', summary: 'ظرف بلا اسم فيه تذكرة بحرية وجملة عن سر بيتباع عند البحر.', detail: 'الورق متقطع من دفتر قديم، وعلى الحافة أثر ملح ورقم ٧ مكتوب بقلم أزرق.', },
    { id: 'e02_burned_map', title: 'خريطة محروقة', kind: 'trace', place: 'plot15', source: 'طرف القطعة ١٥', summary: 'جزء من خريطة طريق جديد، محروق عند مكان التحويلة.', detail: 'الخط الأحمر لا يطابق طريق الجمعية؛ التحويلة بتعدّي على الكورنيش قبل ما ترجع للمدينة.', },
    { id: 'e02_red_receipt', title: 'إيصال أحمر', kind: 'document', place: 'cafe_ragab', source: 'دفتر رجب القديم', summary: 'إيصال دفع باسم «أ.س.» ليلة قبل اختفاء ملف الجمعية.', detail: 'التاريخ بعد القبض على شوقي بيوم، والمبلغ متقسم على ثلاث دفعات صغيرة.', },
    { id: 'e02_corniche_photo', title: 'صورة سور الكورنيش', kind: 'photo', place: 'corniche', source: 'هاتف ياسين', summary: 'ظل شخص عند السور ماسك حقيبة معدنية.', detail: 'في الخلفية فانوس عليه نفس رقم ٧، والظل لابس جاكت حارس مش جلابية.', },
    { id: 'e02_key_tag', title: 'بطاقة مفتاح', kind: 'object', place: 'mansheya', source: 'درج مكتب شوقي', summary: 'بطاقة نحاس مكتوب عليها «مخزن ٧».', detail: 'المفتاح اتساب في درج شوقي بعد القبض عليه، وعلى ظهر البطاقة حرف أ.', },
    { id: 'e02_ledger_page', title: 'صفحة من سجل الأرشيف', kind: 'document', place: 'bibliotheca', source: 'أرشيف المكتبة', summary: 'سجل استعارة يربط شوقي بملف الطريق القديم.', detail: 'الملف اتسحب باسم مستعار، لكن توقيع المستلم هو نفس انحناءة حرف أ في البطاقة.', },
    { id: 'e02_messenger_note', title: 'رسالة المرسول', kind: 'testimony', place: 'qaitbay', source: 'تحت حجر عند الميناء', summary: 'رسالة قصيرة: «المبلغ وصل. اقفل الباب عند السور».', detail: 'الحبر ممزوج برمل البحر، وفي آخر السطر اختصار «أد».', },
    { id: 'e02_sea_glass', title: 'زجاجة البحر', kind: 'trace', place: 'corniche', source: 'تحت سور الكورنيش', summary: 'قطعة زجاج أخضر عليها بقايا شمع أسود.', detail: 'الشمع نفسه على طرف الظرف. كانت بتستخدم لإخفاء ورقة صغيرة جوه الزجاجة.', },
    { id: 'e02_recording', title: 'تسجيل سواق', kind: 'testimony', place: 'raml_stop', source: 'هاتف نبيل', summary: 'صوت بيطلب توصيل حقيبة للميناء قبل الفجر.', detail: 'الصوت بيقول «يا أدهم» مرة واحدة، وبعدين يطلب عدم سؤال الراكب.', },
    { id: 'e02_archive_stamp', title: 'ختم الأرشيف', kind: 'document', place: 'bibliotheca', source: 'سلمى موظفة الأرشيف', summary: 'ختم يثبت إن صفحة السجل اتبدلت بعد سحب الملف.', detail: 'الختم اتطبق بالمقلوب، والنسخة الأصلية مخبّية تحت كارت فهرسة قديم.', },
  ],
  deductions: [
    { id: 'd02_route', title: 'طريق البحر', conclusion: 'الخريطة، الزجاجة، وتسجيل السواق بيحطوا الحقيبة على خط واحد من أبيس للبحر.', pairs: [['e02_burned_map', 'e02_recording'], ['e02_sea_glass', 'e02_recording']], sets: ['case02_route_tied'] },
    { id: 'd02_motive', title: 'فلوس بعد القبض', conclusion: 'الإيصال الأحمر يثبت إن حد تاني كان بيقبض بعد ما وقع شوقي.', pairs: [['e02_red_receipt', 'e02_black_envelope']], sets: ['case02_money_tied'] },
    { id: 'd02_forgery', title: 'الأرشيف اتلعب فيه', conclusion: 'بطاقة المفتاح وسجل الأرشيف والختم المقلوب بيكشفوا تبديل الملف.', pairs: [['e02_key_tag', 'e02_ledger_page'], ['e02_ledger_page', 'e02_archive_stamp']], sets: ['case02_archive_tied'] },
    { id: 'd02_betrayal', title: 'المرسل هو الحارس', conclusion: 'صورة السور والرسالة والتسجيل بيحطوا أدهم في قلب التسليم.', pairs: [['e02_corniche_photo', 'e02_messenger_note'], ['e02_messenger_note', 'e02_recording']], sets: ['case02_adham_tied'] },
  ],
  objectives: [
    { id: 'o02_envelope', title: 'افتح الظرف الأخير', detail: 'الظرف الأسود سايب لك أول رقم.', place: 'mahmoud_house', doneWhen: { evidence: ['e02_black_envelope'] } },
    { id: 'o02_map', title: 'راجع أثر الخريطة', detail: 'القطعة ١٥ لسه فيها ورق ما اتحرقش كله.', place: 'plot15', when: { evidence: ['e02_black_envelope'] }, doneWhen: { evidence: ['e02_burned_map'] } },
    { id: 'o02_ragab', title: 'اسأل رجب عن الدفتر القديم', detail: 'الإيصال الأحمر اتخبّى بين حسابات القهوة.', place: 'cafe_ragab', when: { evidence: ['e02_burned_map'] }, doneWhen: { evidence: ['e02_red_receipt'] } },
    { id: 'o02_salma', title: 'قابل سلمى في المكتبة', detail: 'الأرشيف ممكن يفسّر بطاقة المفتاح.', place: 'bibliotheca', when: { evidence: ['e02_red_receipt'] }, doneWhen: { evidence: ['e02_ledger_page', 'e02_archive_stamp'] } },
    { id: 'o02_nabil', title: 'كلّم نبيل في محطة الرمل', detail: 'التسجيل آخر رحلة قبل الفجر.', place: 'raml_stop', when: { flags: ['visited_city'] }, doneWhen: { evidence: ['e02_recording'] } },
    { id: 'o02_key', title: 'فتّش درج مكتب شوقي', detail: 'بطاقة مخزن ٧ لسه ما اتسلمتش.', place: 'mansheya', when: { evidence: ['e02_red_receipt'] }, doneWhen: { evidence: ['e02_key_tag'] } },
    { id: 'o02_adham', title: 'واجه أدهم عند البحر', detail: 'الصورة والتسجيل مش صدفة.', place: 'corniche', when: { evidence: ['e02_recording'] }, doneWhen: { evidence: ['e02_messenger_note', 'e02_corniche_photo'] } },
    { id: 'o02_final', title: 'اربط قضية الظرف', detail: 'اللوحة هتقول مين كان بيقبض بعد شوقي.', when: { evidence: ['e02_messenger_note'] }, doneWhen: { flags: ['case02_solved'] } },
  ],
  hotspots: [
    { id: 'hs02_envelope', label: 'الظرف الأسود', place: 'mahmoud_house', offset: { x: -3, z: 5 }, kind: 'inspect', consumable: true, text: 'الظرف متثبت تحت ورقة مساحة قديمة. ريحة الملح طالعة منه.', effects: [{ type: 'evidence', id: 'e02_black_envelope' }, { type: 'flag', id: 'case02_started' }] },
    { id: 'hs02_map', label: 'رماد عند القطعة', place: 'plot15', offset: { x: 10, z: 10 }, kind: 'inspect', when: { evidence: ['e02_black_envelope'] }, consumable: true, text: 'بين الرماد خط أحمر لسه باين.', effects: [{ type: 'evidence', id: 'e02_burned_map' }] },
    { id: 'hs02_receipt', label: 'دفتر رجب القديم', place: 'cafe_ragab', offset: { x: 2, z: 5 }, kind: 'inspect', when: { evidence: ['e02_burned_map'] }, consumable: true, text: 'صفحة لازقة في بعضها… والإيصال الأحمر واقع بينها.', effects: [{ type: 'evidence', id: 'e02_red_receipt' }] },
    { id: 'hs02_library', label: 'سجل الأرشيف', place: 'bibliotheca', offset: { x: 4, z: 38 }, kind: 'inspect', when: { evidence: ['e02_red_receipt'] }, consumable: true, text: 'سلمى دلتك على درج السجلات المقفول.', effects: [{ type: 'evidence', id: 'e02_ledger_page' }, { type: 'evidence', id: 'e02_archive_stamp' }] },
    { id: 'hs02_key', label: 'درج مكتب شوقي', place: 'mansheya', offset: { x: -8, z: 15 }, kind: 'inspect', when: { evidence: ['e02_red_receipt'] }, consumable: true, text: 'ورا ملفات العقود، بطاقة نحاس باردة.', effects: [{ type: 'evidence', id: 'e02_key_tag' }] },
    { id: 'hs02_nabil_recording', label: 'هاتف نبيل', place: 'raml_stop', offset: { x: 4, z: 1 }, kind: 'inspect', when: { flags: ['visited_city'] }, consumable: true, text: 'نبيل شغّل لك التسجيل من غير ما يسأل كتير.', effects: [{ type: 'evidence', id: 'e02_recording' }] },
    { id: 'hs02_corniche_photo', label: 'صوّر سور الكورنيش', place: 'corniche', offset: { x: 0, z: 12 }, kind: 'photo', consumable: true, text: 'ظل الحارس ظهر جنب الفانوس رقم ٧.', effects: [{ type: 'evidence', id: 'e02_corniche_photo' }] },
    { id: 'hs02_sea_glass', label: 'زجاجة عند السور', place: 'corniche', offset: { x: 12, z: 8 }, kind: 'inspect', consumable: true, text: 'قطعة زجاج أخضر ملفوفة في شمع أسود.', effects: [{ type: 'evidence', id: 'e02_sea_glass' }] },
    { id: 'hs02_note', label: 'الحجر عند الميناء', place: 'qaitbay', offset: { x: 12, z: 18 }, kind: 'inspect', when: { evidence: ['e02_recording'] }, consumable: true, text: 'تحت الحجر رسالة مطوية ومبلولة.', effects: [{ type: 'evidence', id: 'e02_messenger_note' }] },
    { id: 'hs02_bus_city', label: 'اركب لإسكندرية', place: 'abis_stop', offset: { x: 0, z: 0 }, kind: 'travel', to: 'raml_stop', effects: [{ type: 'flag', id: 'visited_city' }], text: 'الميكروباص اتحرك ناحية محطة الرمل.' },
    { id: 'hs02_bus_abis', label: 'ارجع أبيس', place: 'raml_stop', offset: { x: 0, z: 0 }, kind: 'travel', to: 'abis_stop' },
  ],
  finale: {
    requires: { deductions: ['d02_route', 'd02_forgery', 'd02_betrayal'], flags: ['case02_adham_tied'] }, culprit: 'adham',
    motives: [
      { id: 'm02_money', text: 'كان بياخد نصيبه من فلوس بيع الملفات القديمة.', correct: true },
      { id: 'm02_fear', text: 'كان خايف من البحر فقرر ينتقم منه.', correct: false },
      { id: 'm02_shawky', text: 'كان بينفذ أوامر شوقي بعد القبض عليه.', correct: false },
    ], wrongCulprit: 'الظرف بيشير لشخص اتحرك بعد شوقي… راجع التسجيل والختم.', wrongMotive: 'الدافع لازم يفسّر الفلوس والملفات، مش مجرد خوف قديم.', ending: [
      'الرسالة اتفكت: أدهم كان بيستلم فلوس مقابل تمرير ملفات الأراضي عند السور.',
      'لما واجهته، سكت شوية وبعدين سلّمك دفتر الأسماء. «أنا كنت فاكر إن محدش هيربط الخيطين».',
      'محمود بص للظرف الأسود وقال: «دي مش آخر خيوطهم… بس دلوقتي إحنا اللي ماسكينها».',
    ],
  },
}
