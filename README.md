# الخيط الأخير — The Last Thread

لعبة تحقيق «نوار» عالم مفتوح في الإسكندرية وقراها، مركزها **أبيس / عزبة ١٥**. اللاعب هو «ياسين» (أو شخصية
يصنعها بنفسه)، وخاله محمود اختفى وساب خيطًا أحمر على الباب. اللعبة بالعربي بالكامل (RTL) وبالعامية
المصرية في الحوار، وتشتغل على الكمبيوتر والموبايل (لمس) من المتصفح.

> **المرحلة ١ (Manus):** كل شيء يعمل على جهاز اللاعب بلا خادم. **المرحلة ٢ (AntiGravity):** خادم/وكيل
> للتلميحات الذكية (ChatGPT) وتحليل صور حقيقية، عبر واجهات جاهزة بالفعل — شوف «النقل إلى AntiGravity».

```bash
pnpm install
pnpm dev        # تشغيل التطوير
pnpm test       # اختبارات الوحدات (المنطق + الخدمات)
pnpm build      # فحص أنواع + بناء + ميزانية الحجم
pnpm smoke      # بعد البناء: لعب كامل في متصفح headless + لقطات في shots/
```

روابط تجريبية للمطوّر: `?autostart=story|realistic` يبدأ بلا قوائم وعلى **ذاكرة مؤقتة** (لا يلمس حفظ اللاعب)،
و`?now=2026-11-27T19:30` يثبّت توقيت القاهرة لتجربة الوضع الواقعي.

## الهوية البصرية والجو العام

أحمر وأسود. واجهة على شكل **ملف قضية** (ورق، ختم «سري»، لوحة أدلة بخيوط حمراء). إضاءة خافتة
بتتغيّر بالساعة (غروب برتقالي ← ليل أزرق ونجوم)، ضباب، وحبيبات وفينييت على الشاشة. الصوت كله
**يُولَّد برمجيًا** (`engine/audio.ts`): درون، رياح، نبض قلب يتصاعد مع التوتر، خطوات وستينجرز عند
اكتشاف الأدلة — بلا ملفات صوت.

الفكرة الأساسية: **النص والبيانات هي اللعبة**. المجسّمات المسجّلة سابقًا (٢٤ ملف GLB) تُعاد استخدامها فقط؛ لا
مجسّمات جديدة. كل الأماكن والشخصيات والأدلة والحوارات ملفات بيانات.

## البنية (طبقات منفصلة، كل طبقة تعتمد على اللي تحتها فقط)

```
src/
  data/       محتوى خالص (بلا منطق): types, places, characters, case01, dialogues, hints
  core/       قواعد اللعبة النقية (بلا DOM ولا three) ومغطّاة بالاختبارات
                clock (توقيت القاهرة)، gates (بوابات الوقت/الأحداث)، caseState (CaseEngine)،
                dialogue (شجرة الحوار)، collision (تصادم ثنائي الأبعاد)
  services/   خدمات مستقلة خلف واجهات صغيرة (قابلة للاستبدال)
                storage      StorageAdapter: localStorage ← ذاكرة عند فشل الحصة (جاهز لمحوّل سحابي)
                profiles     إدارة المستخدمين: ٣ خانات، نقل إصدارات، تصدير/استيراد
                eventsDb     قاعدة الأحداث الواقعية: دمج طبقات، تكرار أسبوعي، مقابر حذف، near()
                ar/          محرّك الواقع المعزّز: WorldCamera + GeoFence + RemoteVision اختياري
                hints        HintService: تلميحات محلية ٣ مستويات + مزوّد دردشة بعيد اختياري
  engine/     غلاف المنصّة: renderer, loop, input, audio, assets, save (الإعدادات)
  game/       طبقة three.js: atmosphere, zoneKit, abis, city, actors, models, textures,
              session (جلسة بلا رسم)، game (المتحكّم)، tuning (Tweak)
  ui/         واجهة DOM آمنة (h() بلا innerHTML): shell, hud, dialogueView, casefile, cameraView, touch
  main.ts     نقطة التجميع (composition root): توصيل الخدمات بالواجهة واللعبة
```

قاعدة الحفاظ على الذاكرة: المدينة والقرية **تُبنيان عند الحاجة** (lazy)، النماذج تُستنسخ مع مشاركة
المواد، والظلال بخريطة صغيرة تتبع اللاعب. حجم الحزمة: JS ≈ ٠٫٢ MB gzip (الميزانية ٢ MB).

## وضعا اللعب

- **طور القصة:** الوقت يمرّ داخل اللعبة وكل الأدلة متاحة دائمًا.
- **الطور الواقعي:** يستخدم الساعة الحقيقية بتوقيت القاهرة وقاعدة الأحداث. **الأدلة الأساسية لا تُحجب
  أبدًا**؛ المحجوب فقط أدلة إضافية ترفع التقدير (مثلًا: القهوة مقفولة بالنهار، صورة العمود بالنهار فقط،
  ذاكرة رجب لا تصحو إلا يوم ماتش الاتحاد).

## القضية الأولى «خيط القطعة ١٥»

١٦ دليلًا، ٦ استنتاجات (ربط دليلين على اللوحة)، ١٢ هدفًا متسلسلًا، ١٤ نقطة تفاعل، ٨ ملفات شخصيات
بماضٍ يُكشف تدريجيًا، ونهاية بالاتهام. بوابة الاتهام: ٣ استنتاجات **و** العثور على محمود (`found_mahmoud`).
ملفات الشخصيات تظهر في الملف بعد التحدّث معها (علم `met_<id>`).

### إضافة قضية جديدة
1. أنشئ `src/data/case02.ts` بنوع `CaseFile` (انظر `data/types.ts`)؛ أي أماكن جديدة تُضاف في `places.ts`.
2. أضف حوارات الشخصيات في `dialogues.ts` وتلميحات الأهداف في `hints.ts`.
3. أضف اختبار تكامل شبيه بـ «plays the whole case end-to-end» في `tests/case.test.ts`.

لا حاجة لتعديل `core/` أو `ui/`: كلها تقرأ البيانات.

## قاعدة الأحداث الواقعية (`public/data/events.json`)

```jsonc
{ "schemaVersion": 1, "version": 1,
  "events": [{ "id": "...", "kind": "match_ittihad|market_day|friday_prayer", "title": "...",
               "at": "2026-11-27T19:30",            // توقيت القاهرة
               "endsAt": "…", "recurring": { "weekday": 5, "from": "11:30", "to": "13:30" },
               "provisional": true, "updatedAt": 3 }],
  "removed": ["id-to-delete"] }                      // مقابر حذف تُحفظ وتمنع عودة الحدث من البذرة
```

الدمج: البذرة المدمجة ← النسخة المخزّنة ← المزوّدون عن بُعد (الأحدث `updatedAt` يفوز). لتحديث المواعيد بلا
إصدار جديد، اضبط رابط JSON في إعدادات اللعبة (`eventsUrl`) أو ركّب `EventsProvider` جديد (REST/Firestore/CMS).

> ⚠️ **مواعيد مباريات الاتحاد في الملف الحالي أمثلة مؤقتة (`provisional: true`)** ولازم تُستبدل بالجدول الرسمي.

## محرّك الواقع المعزّز (`services/ar`)

كل المزوّدين ينفّذون `ArProvider { supports(capture); verify(target, capture) }`:

| المزوّد | الحالة | ما يتحقق منه |
|---|---|---|
| `WorldCameraProvider` | يعمل الآن | هندسة الكادر داخل العالم الافتراضي (اتجاه + مسافة + FOV) |
| `GeoFenceProvider` | يعمل الآن | **موقع GPS الحقيقي** داخل نطاق المَعلم + جودة الصورة. **لا يحلّل محتوى الصورة** |
| `RemoteVisionProvider` | معطّل افتراضيًا | `POST multipart {landmark, image}` ← `{match, confidence}` — يحتاج خادمًا |

**صراحةً:** تحليل الصور الحقيقية بالذكاء الاصطناعي يتطلب خادمًا/وكيلًا (مفتاح نموذج رؤية لا يجوز وضعه في
المتصفح). حتى يُضاف في المرحلة ٢، الصورة الحقيقية تُقبل بالموقع فقط وتُوسَم `needsServer`، وتقول الرسالة
للاعب ذلك صراحةً.

## التلميحات الذكية (`services/hints`)

`HintProvider { hint(ctx) → Promise<string> }`. المحلي ثلاثة مستويات (غمزة ← اتجاه ← حل) لكل هدف ويعمل
دائمًا بلا إنترنت. `RemoteChatProvider` يرسل `POST {game, locale:'ar', dialect:'egyptian', ...HintContext}`
ويتوقع `{hint: string}`؛ عند أي فشل أو مهلة (٧ ثوانٍ) يرجع للمحلي تلقائيًا. نقطة النهاية تُضبط من الإعدادات
(`hintEndpoint`) — الوكيل الذي يستدعي ChatGPT يكون في المرحلة ٢.

## إدارة المستخدمين (`services/profiles`)

٣ خانات حفظ محلية (اسم، مظهر، طور اللعب، تقدّم القضية، إحصاءات)، نقل تلقائي بين إصدارات المخطط، وتصدير/
استيراد JSON يدويًا. لا حسابات ولا مزامنة سحابية. لو امتلأ `localStorage` يتحوّل المحوّل للذاكرة ويعلن
`isDegraded`، فلا تُرجع القراءات بيانات قديمة.

## النقل إلى AntiGravity (المرحلة ٢)

- استبدل `LocalStorageAdapter` بمحوّل سحابي (نفس واجهة `StorageAdapter`) لمزامنة الحفظ.
- ركّب `RemoteVisionProvider` و`RemoteChatProvider` على خادم المرحلة ٢، واضبط عناوينهما من الإعدادات.
- مصدر الأحداث: خدمة JSON/REST تُنتج نفس `EventsDocument` (فيه `version` و`removed`).
- `core/` و`data/` بلا أي اعتماد على المتصفح، فتُنقل كما هي.

## GitHub

المستودع: `walidelsayedgemini-dev/the-last-thread` (خاص). `scripts/mirror-github.sh` يدفع كل تحديث مع
مجسّمات `assets/models` (المستبعدة من مستودع Manus) إلى GitHub.

## ما ليس موجودًا بعد (بصراحة)

مجسّمات/أصوات احترافية (الصوت مولّد برمجيًا)، قضايا إضافية، تحليل صور حقيقي بالـ AI، تلميحات ChatGPT
الحيّة، ومواعيد المباريات الرسمية.

## Credits

Fonts: Cairo and Reem Kufi (SIL OFL 1.1, licenses in `public/fonts/`). Library: three.js (MIT).

## Preview Tweak

`src/game/tuning.ts` is this game's parameter manager. The Addon panel reads its
catalog; `config.ts` owns source defaults and the active configuration used by gameplay.
When adapting the game, keep only controls with actual gameplay consumers, and preserve
stable IDs for unchanged parameters. Define ranges, units and the correct activation
boundary. Register through `scripts/manus-tuning/adapter.js` only under `import.meta.env.DEV`.
Keep the Vite plugin and `scripts/__manus__/` helpers intact; production builds exclude
the browser adapter and never inject the bridge.

Apply changes preview state only. `LIVE` parameters are read in the next game update;
`NEXT_ACTION` parameters activate at the relevant jump/dash start; `NEXT_RUN` parameters
activate in `Game.start`. Model/collider size and gravity are not exposed by this version.
Do not mutate the source defaults or persist Apply to localStorage. Save with Manus
checks the snapshot against the current catalog and edits `DEFAULT_CONFIG`, then uses
the normal Three.js Web build/checkpoint workflow. Keep existing gameplay parameter
managers when extending an older project; do not create a competing store.

For server-authoritative multiplayer, expose local cosmetic controls only until gameplay
parameters have explicit server-side development support. The descriptor's GAMEPLAY flag
is a classification, not server authorization or ranked-score enforcement.

The preview plugin reads the ignored `.manus-webdev/preview-identity.json` v1 projection
written by the Runtime when initializing, attaching or restoring this project. It contains
only the resource ID and canonical project directory; private Host bindings and starter
receipts are not template dependencies. Missing identity disables the bridge.
The manager latches `tuning.unranked` when non-default GAMEPLAY values become active and
resets it only at the next run using that run's active values. `Game` snapshots this onto
`RunState.unranked`; local results cannot save such runs. Preserve this guard when changing
scoring. When adding online leaderboards, skip submissions for unranked runs and enforce
eligibility in the authoritative server too; client flags are not proof of a fair score.
