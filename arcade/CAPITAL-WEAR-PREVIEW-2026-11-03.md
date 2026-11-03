# «Выживший»: опытная отрисовка повреждений крупных кораблей

03.11.2026. Этап B визуальных эффектов. Этот документ описывает **только сравнение на диагностической странице**, а не внедрение в боевой режим.

## Выявленные проблемы

- В combat-feedback.js обычный drawHullDamage рисует небольшие тёмные окружности с красноватыми линиями около центра любой цели.
- Для детальных крейсера, авианосца и дредноута линии на рисунке выглядят как поверхностные полосы и почти не передают постепенное разрушение обшивки.
- Текущие иллюстрации имеют высоту 3,85 × e.r; у тяжёлого противника e.r = 22, следовательно, нарисованный корпус достигает 84,7 игровых единиц при диаметре области попадания 44. Это существенное различие, но нельзя просто удвоить радиус столкновения: изменятся попадания, сложность и поведение противников.

## Что сравнивает галерея

Переключатель «Нынешние / Опытный вариант / Без следов» сохраняет одну и ту же исходную иллюстрацию и показывает три способа её представления. При новом варианте:

1. Пороговые значения повреждений повторяют действующую систему: менее 68%, 43% и 22% здоровья, не затрагивая расчёт самого HP.
2. Для каждого крупного корабля определены три разных места повреждения на его конструкции. Они выбираются детерминированно.
3. Изображение копируется в отдельный холст один раз для каждой стадии. На копию накладываются неровные затемнённые пятна и короткие горячие трещины. Операция source-atop не позволяет цвету выйти за исходный непрозрачный силуэт.
4. В режиме «Без следов» можно оценить, сохраняет ли иллюстрация читаемость на уменьшенном игровом размере.

Сначала необходимо посмотреть три настоящих PNG при нескольких размерах — 2,4; 2,65 и 3,85 радиуса — и при 35% и 15% прочности. При увеличении × 5 любые грубые и чужеродные элементы лучше заметны.

## Критерии допуска в игру

- Никаких красных полос, напоминающих нарисованные поверх корпуса черточки.
- Пятна находятся на реальной обшивке, не пересекают пустые прозрачные области.
- На размере 2,4–2,65 радиуса хотя бы две стадии визуально различимы, а силуэт остаётся узнаваемым.
- Следы не затмевают предупреждения о ракете, щите и орбитальном ударе.
- Нет создания градиентов, чтения пикселей и рисования сложных фигур **в основном цикле**; подготовленные кадры переиспользуются.
- Если опытный вариант проигрывает исходному, он не переносится в боевой режим.

Технические ориентиры: [MDN: предварительная отрисовка Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas), [MDN: source-atop](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation).

## Visual QA iteration 2

The first (soft) experiment was too faint even at 15% HP. The gallery now also offers an alpha-clipped torn-metal rim and a short hot fracture. Keep both modes available for a direct comparison; only the gallery draws either one. Visually inspect all three ships at their actual on-screen size before gameplay adoption. Bright cracks must remain contained inside the ship silhouette, and no candidate may conceal the basic orientation of the craft.

## Visual QA iteration 3 - hull breach and vent

Live screenshots revealed that the second candidate's yellow fractures resemble decorative ribbon lines. The next gallery-only variant replaces those lines with an alpha-clipped soot crater, a few irregular exposed-metal edges, and a bounded trail of vapour venting aft. It is inspired by the **combination of location-specific hull damage sockets, staged burn effects, and trailing effects** described by the Homeworld 3 VFX development team (official developer post, 15 February 2023: https://store.steampowered.com/news/posts/?enddate=1676473212&feed=steam_community_announcements). No source assets or code are copied.

**Acceptance before gameplay integration:** compare the three ships at 35% and 15% health, at scales 2.25, 2.65 and 3.85; confirm smoke does not erase the silhouette, particles drift from the rear in ship-local coordinates, effects disappear at full health, and the site remains responsive. Check reduced-motion rendering. The QA canvas is throttled to about 13 frames/s; this is not gameplay rendering. Do not assume an 80%-larger illustration can use the unchanged circular hitbox. Production gameplay remains on existing damage until separate adoption review.

## Visual QA iteration 4 — asymmetric rupture and cached vapour sprite

Live QA of iteration 3 at 2.70 × radius, HP 35% and 20% on cruiser, carrier and dreadnought: the holes still appeared too circular and the vapour too weak to communicate sustained damage clearly. Rated **3/5**. The new **rupture** mode remains gallery-only for comparison: longer non-round armour cuts, short cool-metal edges, a critical internal heat point and five faint vapour sprites per emitter. The 32×32 vapour sprite is generated once, then reused by `drawImage`; heavy gradient construction is absent from per-frame drawing. Two emitters maximum. Compare against *breach*, do not delete either until visual QA. No HP, collision or enemy AI changes.

## Visual QA iteration 5 — bundled Kenney smoke sprite

Live QA of iteration 4: the longer tears are less circular, but at 2.70 × radius the smoke is faint and stage-3 scars still resemble dark strokes. Keep `rupture` available (about **3/5**). An additional `textured` gallery mode uses the repository's CC0 Kenney `assets/fx/smoke_05.png` on a 128px one-time cache. The original opaque light background is converted to transparency using luminance measured from the source corners; the dark cloud remains semi-transparent. This conversion is isolated here and does not change the shared WorldVFX particle pipeline. If loading or pixel extraction fails, reuse the cached procedural vapor. Compare all three hulls, full/35/20% HP, and reduced motion before considering integration.

## Итог проверки в браузере — 3 ноября 2026 года

На опубликованной странице проверены крейсер, авианосец и дредноут в режимах `breach`, `rupture` и `textured`, прежде всего при 35% и 20% прочности и высоте изображения 2,70 радиуса цели. Отдельно проверен вариант `rupture` при действующем масштабе 3,85 радиуса. У неповреждённого корабля следы исчезают.

**Результат:** новая текстура дыма делает его неоднородным, но в маленьком игровом изображении разница с предыдущим вариантом почти неразличима. Разрывы остаются короткими тёмными штрихами и слабо показывают степень разрушения. Предварительная художественная оценка всех трёх вариантов — около **3/5**, недостаточно для переноса в основной бой. Это оценка наблюдаемой картинки, а не автоматических тестов: проверки кода аркады прошли успешно, однако боевой FPS на этом этапе не измерялся.

### Почему дальнейшая настройка тех же пятен вряд ли решит задачу

1. Сейчас три места повреждений заданы заранее. Они не связаны с точками, в которые действительно попал игрок; визуальное состояние корабля почти ничего не сообщает о прошедшем бою.
2. Для крупной иллюстрации при высоте 3,85 × радиус круг столкновения охватывает заметно меньшую часть силуэта. Это способно создавать ложные ожидания попадания. Уменьшение рисунка до 2,65–2,70 помогает, но требует проверки в бою; автоматически увеличивать область столкновения нельзя.
3. Разница между стадиями выражается главным образом количеством следов. Игроку полезнее видеть изменения в работе конкретных узлов, кратковременный отклик на попадание и последующее ухудшение состояния.

### Следующий технический этап — подготовить проверяемый боевой опыт

- Сначала изучить фактическую структуру данных о попадании в `damageEnemy` и способ преобразовать точку контакта из координат мира в координаты повёрнутого корпуса. Не менять расчёт урона и порядок вызовов ради эффекта.
- Развести два вида реакции: **краткую** (вспышка, выброс мелких осколков и кратковременный след на месте удара) и **устойчивую** (обгоревшая панель, локальный дым/утечка или неисправный узел). Постоянных дымящихся точек — не более двух на корабль одновременно.
- Подготовить несколько графически согласованных накладок для каждого из трёх корпусов; при необходимости использовать спрайты из имеющегося набора Kenney или изготовить новые. Проверять их после уменьшения до настоящих 60–85 игровых пикселей, а не только в исходном разрешении.
- Первыми проверять три различимых состояния: целый корабль; заметное повреждение с сохранёнными функциями; критическое состояние перед уничтожением. Состояние должно быть понятно и без ярко-красных надписей, не закрывать направление движения и предупреждения об атаке.
- Провести отдельную проверку соответствия видимого корпуса и области попадания, сравнить масштабирование и иную форму столкновения на одинаковых игровых ситуациях. Изменение геометрии не вводить без проверки сложности.
- Встраивать следующую версию сначала в **отключаемый испытательный режим боя**. Обязательны проверки на обычных и маломощных устройствах, при включённом сокращении анимации, с несколькими тяжёлыми противниками одновременно и при отсутствии загруженных текстур.

**Условие перехода в основную игру:** как минимум 4/5 по визуальной проверке в реальном бою, понятная реакция на попадание, отсутствие ложных ожиданий из-за геометрии и отсутствие измеримой деградации производительности по сравнению с исходной сборкой. Числовой предел просадки FPS установить после замера исходного состояния, а не назначать произвольно.
