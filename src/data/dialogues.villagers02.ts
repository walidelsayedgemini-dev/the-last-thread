import type { CharacterId, Dialogue } from './types'

const villager = (character: CharacterId, text: string, id: string): Dialogue => ({
  character,
  entries: [{ node: id }],
  nodes: { [id]: { id, lines: [{ who: character, text }] } },
})

export const VILLAGER_DIALOGUES_02: Partial<Record<CharacterId, Dialogue>> = {
  umm_saeed: villager('umm_saeed', 'يا ضنايا، بعد ما رجع محمود بقى بياخد عيشه ويسأل مين سأل عليه. واحد غريب كان بيلف حوالين البيت قبل ما الظرف الأسود يظهر.', 'u2_first'),
  omda: villager('omda', 'الكلام ده عندي أمانة: بعد قضية شوقي، كل غريب دخل العزبة اتكتب اسمه. اللي بيدوّر على طريق البحر ماكانش من أهلنا.', 'om2_first'),
  mounir: villager('mounir', 'يا بني، محمود رجع بس عينه فضلت على الدفاتر. اللي يزوّر سطر في سجل، يقدر يزوّر طريقاً كاملاً لو الناس نامت.', 'mo2_first'),
  abdo: villager('abdo', 'الموتور ما بيكدبش… بعد ليلة محمود، واحد سألني عن مواعيد النوبتجية. ما لمسش الماكينة، بس كان عارف صوتها.', 'ab2_first'),
  hamada: villager('hamada', 'يا عم، حمامة محمود رجعت من إسكندرية بدري يومها. الورقة اللي كانت في رجلها اتشالت، بس ريحة البحر لسه فيها.', 'ha2_first'),
  hagga_fatma: villager('hagga_fatma', 'اسمع مني، السوق شاف عربية سودا بتشتري سجاير وتسأل عن بيت المسّاح. بعد ما محمود رجع، العربية ما بقتش تعدّي من هنا.', 'hf2_first'),
  metwally: villager('metwally', 'بسم الله… بعد حكاية شوقي، لقيت خيط أحمر جنب حوش العيلة. مش خيط دفن، خيط واحد خايف يسيب أثره.', 'me2_first'),
  dr_amal: villager('dr_amal', 'بالراحة، محمود جه يسألني عن جرح في إيده وماحبش اسمه يتكتب. قال إن اللي وراه مش قضية واحدة، دي شبكة بتتنفس بهدوء.', 'da2_first'),
  barakat: villager('barakat', 'حسب التعليمات، كل عربية بتعدّي بتتكتب. بعد رجوع محمود، عربية سودا وقفت قبل المزلقان وسألت عن أقصر سكة للبحر.', 'ba2_first'),
  saber: villager('saber', 'كل شيكارة ليها وزن، وكل إشاعة ليها مصدر. سمعت إن حد كان بيخبّي ورق الأرض بين شكاير الدقيق قبل ما الظرف يوصل.', 'sa2_first'),
  mohamed_fakhr: villager('mohamed_fakhr', 'يا ياسو، سجل التسليم في القضية دي لازم يتقري مع تاريخه وتوقيعه. أنا موجود في مكتب المنشية لو محتاج نفهم الورق سوا.', 'mf2_first'),
}
