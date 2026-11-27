import type { CaseFile, CharacterId, CharacterProfile, Dialogue } from './types'

export const ARCHIVE_WITNESSES = {
  nabil_survey: {
    id: 'nabil_survey', name: 'عم نبيل المسّاح', age: 58, role: 'مساعد مساحة سابق',
    home: 'كوم الدكة', place: 'kom_dikka',
    appearance: 'جاكت بني قديم وكوفية رمادي. لسه شايل متر جيب في إيده.',
    personality: ['ملاحظ', 'حذر'],
    past: [{ text: 'اشتغل مع محمود قبل ما يسيب المساحة ويشتغل في ترميم الحجر.' }],
    secret: { text: 'احتفظ بنسخة من الصورة يوم ما مُسح اسم آمنة من الملف.', unlock: 'amna_nabil_heard' },
    relationToCase: 'كان حاضر يوم ما اتصوّرت النسخة الأولى من مخطط الأرض.',
    voice: 'بيسكت شوية قبل ما يرد.', quote: 'أنا فاكر اللي اتشال من الصورة أكتر من اللي فضل فيها.',
    figure: { body: '#70503a', accent: '#beb2a0', skin: '#b88560', headwear: 'none' },
    appearsWhen: 'amna_route',
  },
  mona_archive: {
    id: 'mona_archive', name: 'منى أمينة الأرشيف', age: 42, role: 'أمينة أرشيف',
    home: 'وسط إسكندرية', place: 'alex_museum',
    appearance: 'حجاب فاتح وجاكت كحلي، وعلى إيدها آثار حبر الفهرسة.',
    personality: ['دقيقة', 'كتومة'],
    past: [{ text: 'ساعدت سكان أبيس يحفظوا صور ونسخ من أوراقهم في أرشيف أهلي.' }],
    relationToCase: 'معاها نسخة أودعها محمود عشان تفضل موجودة حتى لو ملف المكتب اختفى.',
    voice: 'بتقرأ الورق بصوت واضح.', quote: 'اسم اللي حمى الورقة يستاهل مكانه عليها.',
    figure: { body: '#34475e', accent: '#bba887', skin: '#bd906b', headwear: 'scarf' },
    appearsWhen: 'amna_route',
  },
} satisfies Partial<Record<CharacterId, CharacterProfile>>

export const ARCHIVE_DIALOGUES: Partial<Record<CharacterId, Dialogue>> = {
  nabil_survey: {
    character: 'nabil_survey', entries: [{ node: 'start' }], nodes: {
      start: { id: 'start', lines: [{ who: 'nabil_survey', text: 'محمود كان بيحب يقابلني هنا. درجات المسرح بتخليني أعرف لو حد قرب قبل ما أشوف وشّه.' }], choices: [
        { text: 'ليه محمود كتب اسمك على المظروف؟', next: 'memory' },
        { text: 'ورّيه النيجاتيف واسأله مين قص الصورة', next: 'negative', present: 'e_odeon_negative', when: { evidence: ['e_odeon_negative'] } },
      ] },
      memory: { id: 'memory', lines: [
        { who: 'nabil_survey', text: 'محمود طلب مني أحتفظ بغلاف نيجاتيف. شُفت صاحبة القلم الأحمر وهي بتسلّم صورة خريطة الأرض. محمود وقف جنبها، بس يوم الاجتماع ماعرفش يحمي اسمها.' },
        { who: 'nabil_survey', text: 'الغلاف في شنطتي على الدكة. لو عرفت رقم الإيداع اللي عليه، منى في المتحف تقدر تطابقه في سجلّها.' },
      ], effects: [{ type: 'flag', id: 'amna_nabil_heard' }, { type: 'evidence', id: 'e_nabil_memory' }], next: 'start' },
      negative: { id: 'negative', lines: [
        { who: 'nabil_survey', text: 'دي إيد أمك يا {player}. يومها قالت لمحمود: لو اسمي اتشال من الورقة، المهم حدود البلد ما تتمسحش معاها.' },
        { who: 'nabil_survey', text: 'وأنا سكت. خفت أفقد الشغل. لو كتبت حكايتي، اكتب إني سكت وقتها.' },
      ], next: 'start' },
    },
  },
  mona_archive: {
    character: 'mona_archive', entries: [{ node: 'start' }], nodes: {
      start: { id: 'start', lines: [{ who: 'mona_archive', text: 'المتحف بيحفظ حاجات عمرها قرون. أنا كمان بحفظ نسخ أهالي أبيس في أرشيف صغير برّه الشغل. دور في سجل الإيداع على رقميْن مطابقين قبل ما تفتح ظرف.' }], choices: [
        { text: 'ورّيها النيجاتيف وإيصال الإيداع', next: 'match', present: 'e_odeon_negative', when: { evidence: ['e_odeon_negative', 'e_museum_receipt'], notFlags: ['amna_letter_read'] } },
        { text: 'قرّر صوت مين يظهر في ملف القضية', next: 'choice', when: { deductions: ['d_amna_archive'], notFlags: ['amna_decided'] } },
      ] },
      match: { id: 'match', lines: [{ who: 'mona_archive', text: 'في السجل تلات خانات فيها صور. أنهي رقم عليه نفس العلامة اللي على غلاف النيجاتيف؟' }], choices: [
        { text: '٢٤', next: 'mismatch' },
        { text: '٤٢', next: 'letter' },
        { text: '٤٧', next: 'mismatch' },
        { text: 'هراجع الدليلين في الملف الأول', next: 'review' },
      ] },
      mismatch: { id: 'mismatch', lines: [{ who: 'mona_archive', text: 'الرقم ده فيه صورة، بس علامة الشطب مش زي اللي على الغلاف. أهو السجل قدّامك.' }], next: 'match' },
      review: { id: 'review', lines: [{ who: 'mona_archive', text: 'خد وقتك. هتلاقيني هنا.' }] },
      letter: { id: 'letter', lines: [
        { who: 'mona_archive', text: 'نفس رقم الإيداع، ونفس الشطب الأحمر. ده ظرف آمنة.' },
        { who: 'narrator', text: 'قريت خط أمك: «يا محمود، افتكر إن الخريطة ساعات بتحمي الناس وساعات بتفضحهم. لو الورقة دي وصلت لابني، سيبه يختار يحكي الحكاية إزاي.»' },
      ], effects: [{ type: 'evidence', id: 'e_amna_letter' }, { type: 'flag', id: 'amna_letter_read' }], next: 'start' },
      choice: { id: 'choice', lines: [{ who: 'mona_archive', text: 'النسخة الموقّعة هتفضل محفوظة هنا في الحالتين. تحب تذكر اسم أمك في ملخص القضية، ولا تخلي رسالتها بينك وبين العيلة؟' }], choices: [
        { text: 'اذكر اسم آمنة في الملخص', next: 'credit' },
        { text: 'خلّي رسالتها للعيلة', next: 'privacy' },
      ] },
      credit: { id: 'credit', lines: [{ who: 'mona_archive', text: 'كتبت: «آمنة، صاحبة النسخة الأصلية». لما حد يرجع للملف بعدنا هيعرف مين حماها.' }], effects: [{ type: 'flag', id: 'amna_decided' }, { type: 'flag', id: 'amna_credit' }] },
      privacy: { id: 'privacy', lines: [{ who: 'mona_archive', text: 'هكتب إن النسخة أودعتها واحدة من أبيس. وخُد الرسالة لستّك زينب. حقكم تقروها سوا.' }], effects: [{ type: 'flag', id: 'amna_decided' }, { type: 'flag', id: 'amna_private' }] },
    },
  },
}

export const ARCHIVE_EVIDENCE: CaseFile['evidence'] = [
  { id: 'e_odeon_negative', place: 'kom_dikka', kind: 'photo', bonus: true, title: 'نيجاتيف الصورة الكاملة', source: 'غلاف عم نبيل',
    summary: 'الصورة قبل القص ومعاها ختم إيداع ٤٢.',
    detail: 'على يمين محمود وشوقي إيد ماسكة قلم أحمر وخريطة مطوية. على الغلاف ختم إيداع ٤٢ بخطّين أحمرين.',
    question: { text: 'هل رقم الإيداع في سجل منى هو نفس الرقم على الغلاف؟', answeredWhen: [{ evidence: ['e_museum_receipt'] }] } },
  { id: 'e_nabil_memory', place: 'kom_dikka', kind: 'testimony', bonus: true, title: 'شهادة عم نبيل', source: 'دكة كوم الدكة',
    summary: 'صاحبة القلم الأحمر سلّمت النسخة الأولى قبل اجتماع الشركاء.',
    detail: 'عم نبيل شاف صاحبة القلم الأحمر وهي بتسلّم الخريطة. في الاجتماع شاف نفس الخريطة بعد ما اسم صاحبتها اتشال.',
    question: { text: 'مين اللي وقّع النسخة قبل ما يتشال اسمها؟', answeredWhen: [{ deductions: ['d_amna_archive'] }] } },
  { id: 'e_museum_receipt', place: 'alex_museum', kind: 'document', bonus: true, title: 'إيصال إيداع ٤٢', source: 'سجل الأرشيف الأهلي عند منى',
    summary: 'رقم ٤٢ وخطّين أحمرين جنب خانة صورة وخريطة.',
    detail: 'إيداع ٤٢ فيه نسخة فوتوغرافية وخريطة وجواب شخصي. الإيصال مؤرخ قبل اجتماع الشركاء بأسبوع.',
    question: { text: 'إيه اللي اتكتب في الجواب اللي مع الخريطة؟', answeredWhen: [{ evidence: ['e_amna_letter'] }] } },
  { id: 'e_amna_letter', place: 'alex_museum', kind: 'document', bonus: true, title: 'جواب آمنة لمحمود', source: 'ظرف إيداع ٤٢',
    summary: 'آمنة بتطلب حفظ نسخة من خريطة أرض أبيس خارج مكتب الشركاء.',
    detail: 'الجواب موقّع «آمنة». على الضهر رسم لحدود القطعة ١٥ بالقلم الأحمر، وتحت الرسم نفس تاريخ الإيصال.',
    question: { text: 'هل شهادة عم نبيل تؤكد إن آمنة سلّمت النسخة قبل الشطب؟', answeredWhen: [{ deductions: ['d_amna_archive'] }] } },
]

export const ARCHIVE_DEDUCTION: CaseFile['deductions'][number] = {
  id: 'd_amna_archive', title: 'آمنة صاحبة النسخة', pairs: [['e_nabil_memory', 'e_amna_letter']],
  pairReasons: ['القلم الأحمر والرسم في الجواب يطابقوا وصف نبيل، وتوقيت التسليم كان قبل شطب الاسم.'],
  conclusion: 'أمّك حفظت خريطة أبيس قبل ما اسمها يتمسح من الملف. ارجع لمنى وحدد إزاي توثّق دورها.',
}

export const ARCHIVE_HOTSPOTS: CaseFile['hotspots'] = [
  { id: 'hs_amna_negative', place: 'kom_dikka', label: 'غلاف النيجاتيف على الدكة', kind: 'inspect', offset: { x: 8, z: 1 }, consumable: true,
    when: { flags: ['amna_nabil_heard'] }, effects: [{ type: 'evidence', id: 'e_odeon_negative' }],
    text: 'في الغلاف نيجاتيف كامل، وختم صغير بخطّين أحمرين.' },
  { id: 'hs_amna_receipt', place: 'alex_museum', label: 'سجل الإيداع', kind: 'inspect', offset: { x: 8, z: 0 }, consumable: true,
    when: { flags: ['amna_route'] }, effects: [{ type: 'evidence', id: 'e_museum_receipt' }],
    text: 'منى بتفتح سجل الأرشيف الأهلي وتسيبك تراجع خانة الإيداع بنفسك.' },
]

export const ARCHIVE_OBJECTIVES: CaseFile['objectives'] = [
  { id: 'o_amna_search', title: 'تتبّع الصورة قبل القص', detail: 'لو عايز تعرف مين اتقصّ من الصورة، راجع ظهر مظروف المكتبة.',
    place: 'bibliotheca', when: { evidence: ['e_library_envelope'], notFlags: ['case_solved'] }, doneWhen: { flags: ['amna_route'] } },
  { id: 'o_amna_nabil', title: 'اسأل عم نبيل عن الصورة', detail: 'قابله في كوم الدكة وافحص الغلاف اللي هيدلّك عليه.',
    place: 'kom_dikka', when: { flags: ['amna_route'], notFlags: ['case_solved'] }, doneWhen: { evidence: ['e_odeon_negative'] } },
  { id: 'o_amna_mona', title: 'طابق رقم الإيداع مع منى', detail: 'راجع سجل الإيداع عند المتحف القومي وورّي منى الدليلين.',
    place: 'alex_museum', when: { evidence: ['e_odeon_negative'], notFlags: ['case_solved'] }, doneWhen: { evidence: ['e_amna_letter'] } },
  { id: 'o_amna_decide', title: 'اختار إزاي تحكي حكاية آمنة', detail: 'اربط الجواب بشهادة نبيل على اللوحة، وبعدها ارجع لمنى.',
    place: 'alex_museum', when: { evidence: ['e_amna_letter'], notFlags: ['case_solved'] }, doneWhen: { flags: ['amna_decided'] } },
]
