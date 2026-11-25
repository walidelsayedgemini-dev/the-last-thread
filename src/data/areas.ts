/**
 * Area themes: every place has its own colour mood, drifting ambient effect and an arrival line.
 * Pure data (unit-tested): the UI turns it into CSS variables and a particle layer.
 */
import type { PlaceId } from './types'

export type AreaFx = 'dust' | 'embers' | 'sea' | 'mist' | 'leaves' | 'pages' | 'city' | 'rain'
export type AreaTheme = {
  /** Accent colour (replaces the gold of the whole UI while you are here). */
  accent: string
  /** Second accent for glows and highlights. */
  glow: string
  /** Dark base colour of the page background. */
  base: string
  /** Colour wash laid over the scene art (with alpha). */
  wash: string
  fx: AreaFx
  /** Short mood word shown on the arrival card. */
  mood: string
  /** Arrival line: what the player notices when they walk in. */
  arrive: string
  /** Small ambient lines rotated in the field log. */
  whispers: string[]
}

export const AREA_THEMES: Record<PlaceId, AreaTheme> = {
  zeinab_home: {
    accent: '#e0a458', glow: '#ffcf8b', base: '#17120d', wash: 'rgba(224,164,88,.16)', fx: 'embers', mood: 'دفا البيت',
    arrive: 'ريحة العيش السخن وصوت ماكينة الخياطة… البيت ده هو الأمان الوحيد اللي فضل.',
    whispers: ['ستّك بتغنّي بصوت واطي وهي بتخيط.', 'الخيط الأحمر على الحيطة لسه مربوط.', 'براد الشاي على النار مش بيهدى.'],
  },
  mahmoud_house: {
    accent: '#a8b57a', glow: '#d3e0a1', base: '#12150e', wash: 'rgba(120,140,80,.16)', fx: 'dust', mood: 'غياب',
    arrive: 'التراب على الكراسي وساعة الحيطة واقفة. كأن البيت مستني صاحبه.',
    whispers: ['الشريط المتري لسه متعلّق على المسمار.', 'فيه كوباية شاي متنشّفة على المكتب.', 'الباب بيصرّ لما بتفتحه، كأنه بيسألك: «لوحدك؟»'],
  },
  cafe_ragab: {
    accent: '#d9822b', glow: '#ffb464', base: '#1a0f0a', wash: 'rgba(217,130,43,.18)', fx: 'embers', mood: 'دخان وكلام',
    arrive: 'دخان الشيشة، وطرقعة الطاولة، وراديو بيذيع أخبار الدوري. كل الكلام هنا ليه ودن.',
    whispers: ['حد بيلعب طاولة بصوت عالي.', 'رجب بيمسح الكوباية للمرة العاشرة.', 'الواد اللي على الباب بيبصّ لك مرتين.'],
  },
  abis_mosque: {
    accent: '#6cc7b4', glow: '#a8efe0', base: '#0b1715', wash: 'rgba(108,199,180,.14)', fx: 'leaves', mood: 'سكينة',
    arrive: 'ضل الجامع بارد، والحمام نايم على الدكة. عم حسن قاعد زي ما بيقعد من ٥٠ سنة.',
    whispers: ['حمامة بتنزل على السور وبترجع.', 'صوت قرآن خافت من ميكروفون قديم.', 'عم حسن بيسبّح وعينه عليك.'],
  },
  canal_bridge: {
    accent: '#6fa8dc', glow: '#a9d2ff', base: '#0a1220', wash: 'rgba(60,110,190,.2)', fx: 'mist', mood: 'ميّه وضلمة',
    arrive: 'الترعة ماشية بهدوء تحت الكوبري، وفي الضلمة صوت ضفدعة بعيدة. المكان ده شاف حاجات كتير.',
    whispers: ['شكل نور بعيد بيتهز على الميّه.', 'الكوبري بيتهز لما موتوسيكل بيعدّي.', 'حد كان واقف هنا من شوية… لسه ريحة سجايره.'],
  },
  plot15: {
    accent: '#c9a064', glow: '#f2ce8e', base: '#1a140c', wash: 'rgba(190,140,70,.18)', fx: 'dust', mood: 'أرض واسعة',
    arrive: 'الأرض مفتوحة والريح فيها تراب. أرض كل واحد بيحلم بيها… وعليها كل الخناقة.',
    whispers: ['الأرض ممتدة لحد الأفق.', 'طوبة مرمية جنب الحجر.', 'فيه آثار عجل جرّار حديثة.'],
  },
  abis_stop: {
    accent: '#c7b98a', glow: '#efe3b2', base: '#15130d', wash: 'rgba(200,185,130,.15)', fx: 'dust', mood: 'سفر',
    arrive: 'ميكروباصات بتزعق: «رمل رمل رمل!»، وناس شايلة شنط وحكايات. من هنا بتبدأ الإسكندرية.',
    whispers: ['السواق بيعدّ فكّة بسرعة.', 'ست بتبيع ذرة مشوي على الناصية.', 'أول ميكروباص بيملى في ثواني.'],
  },
  raml_stop: {
    accent: '#e5c34b', glow: '#fff09a', base: '#0d151b', wash: 'rgba(229,195,75,.14)', fx: 'city', mood: 'زحمة وضوء',
    arrive: 'محطة الرمل بتنبض. الترام الأصفر واقف ساكت… لأنه في سنتين استراحة قبل ما يرجع قطار خفيف.',
    whispers: ['بياع جرايد بينادي على الأخبار.', 'ريحة بحر مخلوطة بريحة عادم.', 'الترام الأصفر على الجنب بيستنى دوره.'],
  },
  mansheya: {
    accent: '#9aa7c9', glow: '#cbd6ff', base: '#0c0f19', wash: 'rgba(120,140,200,.16)', fx: 'city', mood: 'برود وسلطة',
    arrive: 'مكتب فخم بسقف عالي. كل حاجة هنا تلمع… إلا الوجوه.',
    whispers: ['تكييف صوته عالي وضوء مكتب خافت.', 'السكرتيرة بتكتب بسرعة مش طبيعية.', 'تمثال صغير على المكتب بيبصّ للباب.'],
  },
  qaitbay: {
    accent: '#58b4d6', glow: '#a2e6ff', base: '#07151d', wash: 'rgba(60,160,200,.2)', fx: 'sea', mood: 'بحر وتاريخ',
    arrive: 'القلعة الحجر الأصفر بتلمع، والموج بيخبّط في الصخر. هنا فنار الإسكندرية القديم كان بيضوّي.',
    whispers: ['صيادين بيرتّبوا الشباك.', 'نورس بيحوم حوالين الميناء.', 'ريحة سمك وملح وحبر قديم.'],
  },
  bibliotheca: {
    accent: '#b98ae0', glow: '#dcb8ff', base: '#100d18', wash: 'rgba(160,110,220,.15)', fx: 'pages', mood: 'سكون وحروف',
    arrive: 'سقف مايل ضخم وجدار حروف من كل لغة. هنا الصوت بيتحوّل لهمس.',
    whispers: ['حد بيقلّب ورقة بعيد.', 'ضوء من فوق بيخش على الرفوف.', 'الحروف على الجدار بتلمع لما تقرّب.'],
  },
  pompey: {
    accent: '#d08a6a', glow: '#ffbf9d', base: '#1a100d', wash: 'rgba(210,140,100,.17)', fx: 'dust', mood: 'تاريخ ساكت',
    arrive: 'العمود الكبير واقف لوحده منذ ١٧ قرن تقريباً. حتى الهوا هنا بيحترمه.',
    whispers: ['عم فتحي بيكنس الحجارة.', 'تماثيل أبو الهول الصغيرة بتبصّلك.', 'ضلّ العمود بيطول مع الغروب.'],
  },
  corniche: {
    accent: '#4cc3a8', glow: '#9af0d9', base: '#07181a', wash: 'rgba(60,190,170,.17)', fx: 'sea', mood: 'نسيم وفلوس',
    arrive: 'الكورنيش بيلمع بآخر الشمس. باعة، وصيادين، وناس عايشة اليوم بيومه.',
    whispers: ['حد بيبيع ذرة وترمس وعصير قصب.', 'الموج بيضرب السور بصوت متقطع.', 'بياع بيعدّ فلوسه بصوت عالي.'],
  },
}

export const AREA_FX_COUNT = 14
