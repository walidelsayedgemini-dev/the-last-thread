# أصول الجولة البصرية — الخيط الأخير

تضم الجولة السابقة ١٧ أصلًا أصليًا: ١٠ خلفيات للمواقع و٧ رسوم توضيحية للأدلة. أُضيفت في جولة تجربة الاستخدام ٨ صور شخصية أصلية (ياسين وسبعة من الشخصيات المتكررة)، ليصبح الإجمالي ٢٥ أصلًا بصريًا جديدًا. تحافظ الصور على أجواء النوار المصرية: الظلال الباردة، الضوء الكهرماني، والملامح والملابس المتسقة مع أوصاف الشخصيات في ملف اللعبة.

تُحفظ الصور الشخصية التي تستخدمها اللعبة في `characters/` بصيغة WebP، بعد تصغيرها إلى ٥١٢×٦٤٠ بكسل. أصول PNG عالية الدقة الأصلية محفوظة محليًا في `generated/characters/` المستثناة من Git ولا تُحمّلها اللعبة. خلفيات المواقع لها نسخ WebP أخف للهاتف؛ بقية الأصول تُستخدم مباشرة دون إضافة نص برمجي فوقها.

الخلفيات الجديدة تصوّر بيئات خيالية أو مستوحاة من المكان، ولا تدّعي إعادة تصوير مبانٍ أو معالم حقيقية بعينها. صور المكتبة وقلعة قايتباي الموجودة سابقًا لم تتغير. صورة عمود السواري الحقيقية الجديدة من Wikimedia Commons، تصوير Daniel Mayer، بترخيص CC BY-SA 4.0؛ التفاصيل في `scenes/pompeys-pillar-license.txt` ومرتبطة من مشهد الموقع.

صور الأدلة رسوم توضيحية أصلية مكمّلة، وليست مستندات قانونية حقيقية أو مصادر لكلمات وأرقام جديدة. نص القضية الأصلي يظل سجل الدليل المعتمد. الربط في `src/ui/visualAssets.ts` منفصل عن محرك القضية، ولا يُعرض أي دليل مصوّر في ملف القضية أو اللوحة قبل جمعه. داخل بيت محمود يظهر فقط بعد علم القصة الأصلي `has_key`. صور الشخصيات للعرض فقط؛ لا تغيّر الحوار أو الحضور أو شروط فتح الشخصيات.

## صور وتوثيق المواقع والأرشيف الإضافية (CC / الملكية العامة)
تُستخدم الصور الوثائقية والريفية والإسكندرية المضافة في `scenes/` و`evidence/` و`portraits/` و`memory/` وفق تراخيص Creative Commons أو الملكية العامة، مع إزالة كل ملفات الصور المكررة:
- معالم وشوارع الإسكندرية (محطة الرمل، المنشية، بحري والأنفوشي، كوبري ستانلي، جليم، سيدي بشر، محرم بك، العطارين، سموحة، كرموز، كوم الدكة، الشاطبي، محطة سيدي جابر، محطة مصر، المنتزه، سان ستيفانو، ترعة المحمودية): تصوير مصورين موثّقين على Wikimedia Commons (`Abdelrhman 1990`، `Roland Unger`، `D-Stanley`، `Slyronit`، `Шухрат Саъдиев`، `Faris El-Gwely`، `Marsupium`، `Pfctdayelise`، `Islam90`، `TheEgyptian`، `Delengar`، `Ashraf f. bakry`، `Bilal Detailz`، `A maraqa`، `Jerrye & Roy Klotz MD`، `Mohab30`، `A.M. Kuchling`) برخصتي CC BY-SA / CC BY.
- القرى والترع المصرية وصور المزارعين والمقاهي والأدلة التوثيقية: `LBM1948` (Nile Delta CC BY-SA 4.0)، `Hbegzee` (The Egyptian Farmer CC BY-SA 4.0)، `Marsupium` (Buffet Misr CC BY 4.0)، `HannahPethen` (Café Giza CC BY-SA)، `Mark Fischer` (Cairo Portrait CC BY-SA)، `David Rosen` / `KellyB.` (Studio Portraits CC BY)، `Al Jazeera English` (25 Jan Alexandria CC BY-SA)، `Crosskimo` (Al Ahly Match CC BY-SA 4.0)، `Al-Ahram / Egyptian Government` (1992 Earthquake / Pharaohs Parade, Public Domain)، `Prof. Mortel` (NMEC CC BY)، `martinhoward` / `RBerteig` / `Generationbass.com` (Close-ups CC BY).

