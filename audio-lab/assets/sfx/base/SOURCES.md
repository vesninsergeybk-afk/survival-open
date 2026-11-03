# Эффекты баз и развития — CC0

Комплект игры «Выживший», обновление 9.1 (29.10.2026).

## Проверенные первоисточники

Все исходные записи из трёх коллекций выпущены авторами под **CC0 1.0**:

1. **rubberduck — 50 CC0 Sci-Fi SFX**: https://opengameart.org/content/50-cc0-sci-fi-sfx (сигналы терминалов, механизмы, переходы).
2. **Joth — 7 Assorted Sound Effects (Menu, Level Up)**: https://opengameart.org/content/7-assorted-sound-effects-menu-level-up (Ability Learn и Level Up).
3. **Julie Damsgaard / Spring Spring — Power-Up Sound Effects**: https://opengameart.org/content/power-up-sound-effects (три варианта повышения уровня).

Условия CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/

Все 29 OGG в этой папке — монтажные версии исходников. Имена, использованные фрагменты, длительность и хеши первых 13 файлов зафиксированы в исходном `survivor_base_upgrade_sfx_2026-10-28/manifest.json` (рабочий архив, 28.10.2026). В игровой сборке распространяются только OGG. Нельзя путать этот комплект со студийными записями Sonniss в соседней папке `studio/`: у них отдельная лицензия.

## Первые 13 эффектов: исходные слои

| Эффект | Исходные записи |
| --- | --- |
| base_arsenal_start | rubberduck: loop_machine_03, misc_09, misc_03, terminal_04 |
| base_carrier_start | rubberduck: loop_machine_02, misc_10, teleport_01, terminal_08 |
| base_laboratory_start | rubberduck: loop_machine_01, terminal_03, weird_03, terminal_07 |
| base_repair_start | rubberduck: loop_machine_03, misc_08, terminal_09; Spring Spring: power-up v2 |
| upgrade_standard | Spring Spring: power-up v3; rubberduck: terminal_02 |
| upgrade_weapon | Spring Spring: power-up v1; rubberduck: misc_05 |
| upgrade_armor | Spring Spring: power-up v2; rubberduck: terminal_01 |
| upgrade_drones | rubberduck: terminal_05, terminal_06; Spring Spring: power-up v3 |
| unlock_branch_arsenal | Joth: Ability Learn; rubberduck: misc_09 |
| unlock_branch_carrier | Joth: Ability Learn; rubberduck: terminal_08, terminal_06 |
| unlock_branch_laboratory | Joth: Ability Learn; rubberduck: teleport_01, terminal_07 |
| unlock_branch_repair | Joth: Ability Learn; Spring Spring: power-up v2; rubberduck: terminal_09 |
| unlock_tech_tier | Joth: Level Up; rubberduck: terminal_07 |

## 16 новых монтажных версий (29.10.2026)

Новые файлы собраны **только из 13 предыдущих CC0-мастеров**, без сторонних лицензий и генеративных коммерческих библиотек. Изменены скорость воспроизведения, длина, наложения, огибающие и уровень. Тем самым каждый новый эффект наследует CC0 первоисточников.

| Эффект | Использованные CC0-мастера |
| --- | --- |
| base_outpost_start | base_laboratory_start + base_carrier_start + unlock_tech_tier |
| base_resonance_link | unlock_tech_tier + unlock_branch_laboratory |
| base_resonance_discount | upgrade_standard + unlock_tech_tier |
| base_turret_construct | base_arsenal_start + upgrade_weapon |
| base_section_construct | base_carrier_start + base_arsenal_start |
| base_repair_pulse | base_repair_start + upgrade_armor |
| base_escort_launch | base_carrier_start + upgrade_drones |
| base_hangar_expand | base_carrier_start + base_arsenal_start |
| base_shield_engage | upgrade_armor + base_laboratory_start |
| base_shield_break | base_laboratory_start + base_arsenal_start |
| base_raid_warning | unlock_branch_arsenal (две нисходящие посылки) |
| base_raid_success | unlock_tech_tier + unlock_branch_carrier |
| base_destroyed | base_arsenal_start + base_carrier_start |
| upgrade_research | unlock_branch_laboratory + upgrade_standard |
| upgrade_logistics | upgrade_drones + upgrade_standard |
| upgrade_defense | upgrade_armor + base_arsenal_start |

Оригинальные WAV-мастера и скрипт обработки сохраняются отдельно от веб-сборки, чтобы не увеличивать размер игры. Для субъективной проверки тембра и громкости используйте `/games/survivor/audio-lab/`.
