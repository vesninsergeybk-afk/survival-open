/**
 * Sound design manifest for Survivor: Space Frontier.
 *
 * Production audio routing shared with the public sound laboratory.
 * Keys match WEAPONS[*].id in ../src/data.js, production on 2026-10-28.
 *
 * Studio sources are not redistributed. Gameplay uses CC0 sound files:
 * public Kenney samples, station sounds, and recorded Foley. No procedural fallback.
 */
export const WEAPON_SOUNDS = {
  starter_pulse: { label: 'Учебный импульс', profile: 'pulse', family: 'energy', gain: 0.34, priority: 3, minIntervalMs: 95, sampleUrl: './assets/sfx/starter_pulse.ogg', note: 'Короткий упругий щелчок и мягкий электрический хвост.' },
  starter_soft: { label: 'Плазменный автоогонь · механический импульс', profile: 'softpulse', family: 'energy', gain: 0.34, priority: 2, minIntervalMs: 170, note: 'Пять вариантов короткого пиротехнического или механического удара, дополненных тихим металлическим слоем. Реальные записи, без электронного сигнала.' },
  whip: { label: 'Плазменная дуга', profile: 'arc', family: 'energy', gain: 0.46, priority: 3, minIntervalMs: 160, sampleUrl: './assets/sfx/studio/whip.ogg', note: 'Широкий дуговой хлест с сухим верхним щелчком.' },
  magic_wand: { label: 'Ионная пушка', profile: 'ion', family: 'energy', gain: 0.40, priority: 3, minIntervalMs: 100, sampleUrl: './assets/sfx/studio/magic_wand.ogg', note: 'Заряженный электрический сгусток, нисходящий тон.' },
  knife: { label: 'Ракетный залп', profile: 'rocket', family: 'ballistic', gain: 0.53, priority: 4, minIntervalMs: 150, sampleUrl: './assets/sfx/studio/knife.ogg', note: 'Пуск и короткий реактивный выхлоп; не дублировать звук на каждую ракету залпа.' },
  orbit: { label: 'Боевые спутники', profile: 'orbit', family: 'mechanical', gain: 0.28, priority: 1, minIntervalMs: 380, sampleUrl: './assets/sfx/studio/orbit.ogg', note: 'Редкий металлический энергетический контакт, не постоянное гудение.' },
  lightning: { label: 'Электроразряд', profile: 'lightning', family: 'energy', gain: 0.55, priority: 4, minIntervalMs: 260, sampleUrl: './assets/sfx/studio/lightning.ogg', note: 'Треск и характерный электрический разрыв; одна атака — один звук.' },
  mine: { label: 'Гравимина', profile: 'mine', family: 'ballistic', gain: 0.30, priority: 2, minIntervalMs: 280, sampleUrl: './assets/sfx/studio/mine.ogg', note: 'Механический сброс, отдельно от взрыва при подрыве.' },
  garlic: { label: 'Энергощит', profile: 'shield', family: 'ambient', gain: 0.20, priority: 1, minIntervalMs: 900, sampleUrl: './assets/sfx/studio/garlic.ogg', note: 'Короткая пульсация, не проигрывать на каждом тике урона.' },
  frost_nova: { label: 'Криоимпульс', profile: 'cryo', family: 'energy', gain: 0.43, priority: 3, minIntervalMs: 300, sampleUrl: './assets/sfx/studio/frost_nova.ogg', note: 'Воздушный ледяной выброс и низкий круговой удар.' },
  soul_drain: { label: 'Ремонтный луч', profile: 'repair', family: 'support', gain: 0.21, priority: 1, minIntervalMs: 700, sampleUrl: './assets/sfx/studio/soul_drain.ogg', note: 'Тихая магнитная вибрация; не озвучивать каждый лечебный тик.' },
  boomerang: { label: 'Возвратная торпеда', profile: 'torpedo', family: 'ballistic', gain: 0.43, priority: 3, minIntervalMs: 180, sampleUrl: './assets/sfx/studio/boomerang.ogg', note: 'Вращающийся свист и короткий пуск.' },
  railgun: { label: 'Рельсотрон', profile: 'rail', family: 'ballistic', gain: 0.66, priority: 5, minIntervalMs: 250, sampleUrl: './assets/sfx/studio/railgun.ogg', note: 'Мощный сухой удар плюс низкий корпусной резонанс, без длинной каши.' },
  drone_swarm: { label: 'Эскадрилья поддержки', profile: 'drone', family: 'mechanical', gain: 0.22, priority: 2, minIntervalMs: 650, sampleUrl: './assets/sfx/studio/drone_swarm.ogg', note: 'Микросервопривод и короткий радиоимпульс, только при старте очереди.' },
  retro_blaster: { label: 'Квантовый бластер', profile: 'quantum', family: 'energy', gain: 0.44, priority: 3, minIntervalMs: 120, sampleUrl: './assets/sfx/studio/retro_blaster.ogg', note: 'Яркий ретрофутуристический залп с плотным среднечастотным телом.' }
};

export const EVENT_SOUNDS = {
  hit: { label: 'Попадание по противнику', profile: 'hit', family: 'impact', gain: 0.24, priority: 1, minIntervalMs: 95, sampleUrl: './assets/sfx/hit.ogg' },
  armor_hit: { label: 'Попадание по броне', profile: 'armor', family: 'impact', gain: 0.35, priority: 2, minIntervalMs: 115, sampleUrl: './assets/sfx/armor_hit.ogg' },
  shield_hit: { label: 'Попадание по щиту', profile: 'shield_hit', family: 'impact', gain: 0.27, priority: 2, minIntervalMs: 110, sampleUrl: './assets/sfx/studio/shield_hit.ogg' },
  explosion_small: { label: 'Малый взрыв', profile: 'explosion_small', family: 'impact', gain: 0.52, priority: 4, minIntervalMs: 140, sampleUrl: './assets/sfx/explosion_small.ogg' },
  explosion_big: { label: 'Мощный взрыв', profile: 'explosion_big', family: 'impact', gain: 0.75, priority: 5, minIntervalMs: 420, sampleUrl: './assets/sfx/studio/explosion_big.ogg' },
  boss_warning: { label: 'Предупреждение о боссе', profile: 'warning', family: 'ui', gain: 0.42, priority: 5, minIntervalMs: 1300, sampleUrl: './assets/sfx/studio/boss_warning.ogg' },
  pickup: { label: 'Подбор ресурса', profile: 'pickup', family: 'ui', gain: 0.22, priority: 1, minIntervalMs: 110, sampleUrl: './assets/sfx/pickup.ogg' },
  level_up: { label: 'Улучшение', profile: 'levelup', family: 'ui', gain: 0.38, priority: 4, minIntervalMs: 400, sampleUrl: './assets/sfx/studio/level_up.ogg' },
  player_damage: { label: 'Урон игроку', profile: 'damage', family: 'impact', gain: 0.46, priority: 5, minIntervalMs: 210, sampleUrl: './assets/sfx/studio/player_damage.ogg' },
  player_death: { label: 'Гибель корабля', profile: 'damage', family: 'impact', gain: 0.68, priority: 5, minIntervalMs: 1200, sampleUrl: './assets/sfx/studio/player_death.ogg' },
  boss_spawn: { label: 'Появление босса', profile: 'explosion_big', family: 'impact', gain: 0.64, priority: 5, minIntervalMs: 1200, sampleUrl: './assets/sfx/studio/boss_spawn.ogg' },
  achievement: { label: 'Достижение', profile: 'levelup', family: 'ui', gain: 0.33, priority: 3, minIntervalMs: 450, sampleUrl: './assets/sfx/studio/achievement.ogg' },
  engine: { label: 'Двигатель корабля', profile: 'engine', family: 'ambient', gain: 0.16, priority: 1, minIntervalMs: 1200, sampleUrl: null }
};

/** CC0 station and progression cues; see assets/sfx/base/SOURCES.md. */
export const BASE_SOUNDS = {
  base_arsenal_start: { label: "Запуск арсенала", profile: 'base_start', family: 'structure', gain: 0.61, priority: 5, minIntervalMs: 1900, sampleUrl: './assets/sfx/base/base_arsenal_start.ogg', fixedPitch: true },
  base_carrier_start: { label: "Запуск авианосца", profile: 'base_start', family: 'structure', gain: 0.60, priority: 5, minIntervalMs: 1900, sampleUrl: './assets/sfx/base/base_carrier_start.ogg', fixedPitch: true },
  base_laboratory_start: { label: "Запуск лаборатории", profile: 'base_start', family: 'structure', gain: 0.61, priority: 5, minIntervalMs: 1900, sampleUrl: './assets/sfx/base/base_laboratory_start.ogg', fixedPitch: true },
  base_repair_start: { label: "Запуск ремонтного дока", profile: 'base_start', family: 'structure', gain: 0.61, priority: 5, minIntervalMs: 1900, sampleUrl: './assets/sfx/base/base_repair_start.ogg', fixedPitch: true },
  base_outpost_start: { label: "Запуск аванпоста", profile: 'base_start', family: 'structure', gain: 0.61, priority: 5, minIntervalMs: 1900, sampleUrl: './assets/sfx/base/base_outpost_start.ogg', fixedPitch: true, note: "Лёгкий высокочастотный привод аванпоста, синхронный запуску." },
  upgrade_standard: { label: "Установка обычного улучшения", profile: 'levelup', family: 'ui', gain: 0.30, priority: 3, minIntervalMs: 200, sampleUrl: './assets/sfx/base/upgrade_standard.ogg' },
  upgrade_weapon: { label: "Усиление вооружения", profile: 'levelup', family: 'ui', gain: 0.38, priority: 3, minIntervalMs: 200, sampleUrl: './assets/sfx/base/upgrade_weapon.ogg' },
  upgrade_armor: { label: "Усиление брони и щита", profile: 'shield', family: 'ui', gain: 0.32, priority: 3, minIntervalMs: 200, sampleUrl: './assets/sfx/base/upgrade_armor.ogg' },
  upgrade_drones: { label: "Развитие эскадрильи", profile: 'drone', family: 'ui', gain: 0.33, priority: 3, minIntervalMs: 200, sampleUrl: './assets/sfx/base/upgrade_drones.ogg' },
  unlock_branch_arsenal: { label: "Открыта ветвь арсенала", profile: 'levelup', family: 'ui', gain: 0.39, priority: 4, minIntervalMs: 700, sampleUrl: './assets/sfx/base/unlock_branch_arsenal.ogg' },
  unlock_branch_carrier: { label: "Открыта ветвь авианосца", profile: 'levelup', family: 'ui', gain: 0.39, priority: 4, minIntervalMs: 700, sampleUrl: './assets/sfx/base/unlock_branch_carrier.ogg' },
  unlock_branch_laboratory: { label: "Открыта ветвь лаборатории", profile: 'levelup', family: 'ui', gain: 0.39, priority: 4, minIntervalMs: 700, sampleUrl: './assets/sfx/base/unlock_branch_laboratory.ogg' },
  unlock_branch_repair: { label: "Открыта ветвь дока", profile: 'levelup', family: 'ui', gain: 0.39, priority: 4, minIntervalMs: 700, sampleUrl: './assets/sfx/base/unlock_branch_repair.ogg' },
  unlock_tech_tier: { label: "Новый технологический допуск", profile: 'levelup', family: 'ui', gain: 0.47, priority: 5, minIntervalMs: 1800, sampleUrl: './assets/sfx/base/unlock_tech_tier.ogg' },
  base_resonance_link: { label: "Станции сопряжены", profile: 'base_signal', family: 'structure', gain: 0.51, priority: 5, minIntervalMs: 1800, sampleUrl: './assets/sfx/base/base_resonance_link.ogg', note: "Сигнал возникает после запуска второй однотипной станции." },
  base_resonance_discount: { label: "Скидка благодаря сопряжению", profile: 'pickup', family: 'ui', gain: 0.31, priority: 3, minIntervalMs: 350, sampleUrl: './assets/sfx/base/base_resonance_discount.ogg', note: "Короткий акустический знак реальной скидки при покупке модуля." },
  base_turret_construct: { label: "Монтаж новой турели", profile: 'base_build', family: 'structure', gain: 0.48, priority: 4, minIntervalMs: 350, sampleUrl: './assets/sfx/base/base_turret_construct.ogg' },
  base_section_construct: { label: "Строительство секции", profile: 'base_build', family: 'structure', gain: 0.46, priority: 4, minIntervalMs: 550, sampleUrl: './assets/sfx/base/base_section_construct.ogg' },
  base_repair_pulse: { label: "Ремонт корпуса", profile: 'repair', family: 'structure', gain: 0.37, priority: 3, minIntervalMs: 250, sampleUrl: './assets/sfx/base/base_repair_pulse.ogg' },
  base_escort_launch: { label: "Запуск ведомого", profile: 'rocket', family: 'structure', gain: 0.40, priority: 4, minIntervalMs: 420, sampleUrl: './assets/sfx/base/base_escort_launch.ogg' },
  base_hangar_expand: { label: "Расширение ангара", profile: 'base_build', family: 'structure', gain: 0.42, priority: 4, minIntervalMs: 700, sampleUrl: './assets/sfx/base/base_hangar_expand.ogg' },
  base_shield_engage: { label: "Аварийный стазис базы", profile: 'shield', family: 'structure', gain: 0.59, priority: 5, minIntervalMs: 1200, sampleUrl: './assets/sfx/base/base_shield_engage.ogg', note: "Реальное включение аварийного стазиса под огнём." },
  base_shield_break: { label: "Резерв щита исчерпан", profile: 'damage', family: 'structure', gain: 0.49, priority: 5, minIntervalMs: 900, sampleUrl: './assets/sfx/base/base_shield_break.ogg', note: "Стазис израсходовал резерв; турели снова уязвимы." },
  base_raid_warning: { label: "Угроза станции", profile: 'base_warning', family: 'ui', gain: 0.51, priority: 5, minIntervalMs: 2200, sampleUrl: './assets/sfx/base/base_raid_warning.ogg', note: "Однократно при обнаружении осадной группы, затем при атаке." },
  base_raid_success: { label: "База успешно защищена", profile: 'levelup', family: 'ui', gain: 0.44, priority: 5, minIntervalMs: 1500, sampleUrl: './assets/sfx/base/base_raid_success.ogg', note: "Только после успешной обороны." },
  base_destroyed: { label: "Станция уничтожена", profile: 'base_down', family: 'structure', gain: 0.62, priority: 5, minIntervalMs: 1600, sampleUrl: './assets/sfx/base/base_destroyed.ogg' },
  upgrade_research: { label: "Исследовательская ветвь", profile: 'levelup', family: 'ui', gain: 0.34, priority: 3, minIntervalMs: 280, sampleUrl: './assets/sfx/base/upgrade_research.ogg' },
  upgrade_logistics: { label: "Логистическая ветвь", profile: 'drone', family: 'ui', gain: 0.33, priority: 3, minIntervalMs: 280, sampleUrl: './assets/sfx/base/upgrade_logistics.ogg' },
  upgrade_defense: { label: "Оборонительная ветвь", profile: 'shield', family: 'ui', gain: 0.34, priority: 3, minIntervalMs: 280, sampleUrl: './assets/sfx/base/upgrade_defense.ogg' }
};

// Every public gameplay event uses decoded CC0 audio. Studio placeholders are
// superseded by verified Kenney files or recordings already stored in base/.
const k = file => './assets/sfx/kenney/' + file + '.ogg';
const b = file => './assets/sfx/base/' + file + '.ogg';
const f = file => './assets/sfx/foley/' + file + '.ogg';
const replacements = {
  starter_soft: [f('rd_shot_01'),f('rd_shot_02'),f('rd_shot_03'),f('om_clamour5'),f('om_clamour7')],
  whip: [k('laserRetro_003')], magic_wand: [k('laserLarge_000'),k('laserLarge_001')],
  knife: [k('thrusterFire_000')], orbit: [k('spaceEngineSmall_000')],
  lightning: [k('forceField_000')], mine: [k('doorClose_001')],
  garlic: [k('forceField_001')], frost_nova: [k('forceField_002')],
  soul_drain: [b('base_repair_pulse')], boomerang: [k('laserRetro_004')],
  railgun: [k('laserLarge_004'),k('laserLarge_003')], drone_swarm: [b('base_escort_launch')],
  retro_blaster: [k('laserRetro_000'),k('laserRetro_001')],
  shield_hit: [k('forceField_003')],
  explosion_big: [k('explosionCrunch_003'),k('explosionCrunch_004')],
  boss_warning: [b('base_raid_warning')], level_up: [b('unlock_tech_tier')],
  player_damage: [k('impactMetal_002'),k('impactMetal_003')],
  player_death: [k('explosionCrunch_004')], boss_spawn: [k('explosionCrunch_001'),k('lowFrequency_explosion_000')],
  achievement: [b('base_raid_success')], engine: [k('spaceEngineLow_000')]
};
const limits = {
  starter_soft: .82, knife: .52, orbit: .35, garlic: .55, frost_nova: .65,
  boomerang: .48, railgun: .62, lightning: .55, drone_swarm: .72,
  engine: .55, explosion_big: 1.45, player_death: 1.8, boss_spawn: 1.4
};
for (const [key, paths] of Object.entries(replacements)) {
  const def = WEAPON_SOUNDS[key] || EVENT_SOUNDS[key];
  if (!def) throw new Error('Unknown recorded cue: ' + key);
  def.sampleUrl = paths[0];
  def.sampleUrls = paths;
  if (limits[key]) def.maxDuration = limits[key];
}

// Five matched pairs of real field recordings; layer two stays quiet.
WEAPON_SOUNDS.starter_soft.sampleLayerUrls = [
  f('om_clamour5'),f('om_clamour7'),f('om_clamour1'),
  f('om_toasterstep1'),f('om_toasterstep2')
];
WEAPON_SOUNDS.starter_soft.layerGain = .19;
WEAPON_SOUNDS.starter_soft.fixedPitch = true;

const cue = (label,family,sampleUrl,gain,priority=1,minIntervalMs=150,maxDuration=.65) =>
  ({label,profile:'recorded',family,sampleUrl,gain,priority,minIntervalMs,maxDuration});
export const AUX_SOUNDS = {
  ui_open: cue('Открыть панель','ui',k('doorOpen_000'),.12),
  ui_map: cue('Карта','ui',k('doorOpen_001'),.10),
  ui_tab: cue('Вкладка','ui',k('doorClose_000'),.055,1,90,.24),
  ui_dock: cue('Стыковка','ui',k('doorOpen_002'),.12),
  ui_close: cue('Закрыть панель','ui',k('doorClose_000'),.09),
  ui_select: cue('Выбор','ui',k('impactGeneric_light_000'),.07,1,85,.22),
  ui_confirm: cue('Подтверждение','ui',b('upgrade_standard'),.14),
  ui_deny: cue('Недоступное действие','ui',b('base_shield_break'),.11),
  ui_cancel: cue('Отмена','ui',k('doorClose_001'),.08),
  ui_slider: cue('Регулировка','ui',k('impactMetal_heavy_000'),.052,1,90,.16),
  ui_audio_on: cue('Звук включён','ui',b('upgrade_standard'),.11),
  world_discover: cue('Обнаружение','ui',b('base_raid_success'),.15,2,600),
  world_amber: cue('Низкий уровень энергии','ui',b('base_raid_warning'),.15,3,1100),
  world_ion: cue('Ионная аномалия','ambient',k('forceField_003'),.16,2,1100),
  world_contract: cue('Контракт','ui',b('base_resonance_link'),.13,2,750),
  scene_alert: cue('Нарастание угрозы','ui',b('base_raid_warning'),.13,3,2500,1.35),
  scene_battle: cue('Начало боя','ui',b('base_shield_engage'),.14,3,2500,1.35),
  scene_siege: cue('Штурм','ui',b('base_destroyed'),.20,4,2500,1.6),
  scene_recovery: cue('Опасность миновала','ui',b('base_raid_success'),.11,3,2500,1.1),
  ambient_void: cue('Фоновая электроника космоса','ambient',k('computerNoise_000'),.065,1,9500,4.4),
  ambient_station: cue('Механизмы станции','ambient',k('spaceEngineLow_000'),.085,1,9500,4.5),
  ambient_alert: cue('Отдалённая помеха','ambient',k('computerNoise_001'),.075,1,9500,3.3),
  ambient_battle: cue('Дальний мотор','ambient',k('spaceEngineLow_001'),.065,1,9500,2.7),
  ambient_siege: cue('Осадный фон','ambient',k('spaceEngineLarge_000'),.11,1,9500,4.2),
  rock_chip: cue('Крошка руды','impact',k('impactMining_001'),.16,1,85,.2),
  rock_break: cue('Разлом астероида','impact',k('impactMining_003'),.29,2,155,.55),
  extractor_loop: cue('Работа экстрактора','ambient',k('engineCircular_000'),.12,1,500,.9),
  // Mission cues are recorded CC0 foley; each is attached to a real state
  // transition, not to a frame of animation or an unread notice.
  field_work: cue('Работа с оборудованием','structure',b('base_repair_pulse'),.11,1,900,.42),
  field_shield_up: cue('Включение резервного щита','structure',b('base_shield_engage'),.29,3,900,1.15),
  field_shield_break: cue('Разрушение щита узла','impact',b('base_shield_break'),.32,3,750,.85),
  field_relay_repair: cue('Связь восстановлена','structure',b('base_resonance_link'),.28,3,600,1.0),
  field_convoy_repair: cue('Восстановление корпуса конвоя','structure',b('base_repair_pulse'),.33,3,650,.85),
  field_beacon_ok: cue('Найден поддельный маяк','ui',b('base_raid_success'),.23,3,750,.9),
  field_beacon_alarm: cue('Маяк поднял тревогу','ui',b('base_raid_warning'),.24,4,1400,1.15),
  field_uplink_start: cue('Перевод сигнала на ответный узел','ambient',k('computerNoise_000'),.23,3,850,.8),
  field_uplink_ready: cue('Запись маршрута сохранена','structure',k('doorOpen_001'),.28,3,850,.85),
  field_link_sync: cue('Узлы связи сопрягаются','structure',k('forceField_001'),.23,3,920,.65),
  field_salvage: cue('Уцелевший контейнер поднят','structure',k('doorOpen_002'),.24,3,500,.7),
  field_cassette: cue('Кассета извлечена','structure',k('doorClose_001'),.19,2,350,.5),
  field_raid: cue('Нападение на оборудование','ui',b('base_raid_warning'),.19,3,1400,1.0),
  field_scan: cue('Опасный сканер раскрыт','ambient',k('computerNoise_001'),.23,3,1100,1.1),
  field_scan_captured: cue('Получен спектр зрачка','ui',b('base_raid_success'),.15,2,500,.6),
  field_scan_miss: cue('Сектор сканирования пройден без записи','ui',k('computerNoise_000'),.13,2,630,.55),
  field_reactor_charge: cue('Реактор готовится к выбросу','ambient',k('forceField_003'),.26,3,1300,.9),
  field_reactor_cool: cue('Клапан охлаждения реактора открыт','structure',k('forceField_000'),.24,3,920,.9),
  field_pulse: cue('Разряд аномалии','impact',k('forceField_002'),.29,3,750,.85),
  mission_emp_charge: cue('Заряд глушителя','ambient',k('computerNoise_000'),.24,3,1200,1.2),
  mission_emp_pulse: cue('Разряд глушителя','impact',k('forceField_003'),.38,4,600,.75),
  mission_probe_weld: cue('Работа ремонтного луча','structure',b('base_repair_pulse'),.15,2,1200,.75),
  mission_probe_ready: cue('Телеметрия зонда восстановлена','structure',b('base_raid_success'),.27,4,800,.85),
  mission_relay_wave: cue('Подход атакующей волны','ui',b('base_raid_warning'),.24,3,1800,1.1),
  mission_relay_prepare: cue('Резервный барьер ретранслятора установлен','structure',k('forceField_001'),.3,3,1050,.9),
  mission_relay_impact: cue('Удар по передатчику','impact',k('impactMetal_heavy_001'),.32,3,190,.4),
  mission_relay_online: cue('Связь ретранслятора восстановлена','structure',b('base_resonance_link'),.37,4,1800,1.3),
  mission_carrier_contact: cue('Выход вражеского грузовика','ambient',k('spaceEngineLarge_000'),.21,2,1500,1.0),
  mission_carrier_boost: cue('Форсаж вражеского грузовика','ambient',k('thrusterFire_000'),.34,3,1700,.9),
  // Manual area weapons have separate physical Foley for release, arming and
  // impact. The low-frequency body is a recorded sample, never an oscillator.
  comet_launch: cue('Пуск Голубой кометы','energy',f('rd_fw_01'),.32,4,300,1.36),
  comet_burst: cue('Удар Голубой кометы','impact',f('rd_cannon_01'),.53,5,240,1.90),
  comet_core_accent: cue('Усиленный эпицентр кометы','impact',k('lowFrequency_explosion_000'),.18,3,850,1.0),
  comet_cryo_accent: cue('Криоволна кометы','energy',k('forceField_000'),.19,3,850,.95),
  mine_launch: cue('Сброс минного веера','mechanical',f('om_plugpull'),.29,3,320,.80),
  mine_arm: cue('Мины встали на боевой взвод','mechanical',f('om_tap'),.14,2,600,1.12),
  mine_burst: cue('Подрыв мин','impact',f('rd_bang_02'),.51,5,140,1.50),
  mine_pierce_accent: cue('Бронебойный удар мины','impact',k('impactMetal_heavy_001'),.18,3,1100,.85),
  mine_snare_accent: cue('Сдерживающее поле мины','energy',k('forceField_002'),.17,3,1100,.85),
  target_mark: cue('Назначена приоритетная цель','ui',f('om_clamour11'),.14,3,180,1.10),
  dash_burst: cue('Рывок корабля','mechanical',f('rd_fw_03'),.30,3,350,1.48),
  swarm_arrival: cue('Приближение организованного роя','ambient',f('om_clamour6'),.15,2,2100,1.43),
  swarm_split: cue('Рой делится','mechanical',f('om_scrape1'),.19,3,1150,1.12),
  swarm_merge: cue('Рои объединяются','mechanical',f('om_clamour9'),.19,3,1150,.88),
  swarm_warning: cue('Рой готовит выстрел','ui',f('om_clamour11'),.16,3,1600,1.12),
  // Field artillery has its own physical sound vocabulary. All samples are
  // CC0 recordings already pinned by the Foley/base manifests, not beeps.
  artillery_build: cue('Сборка артиллерийской платформы','structure',b('base_turret_construct'),.40,3,700,1.8),
  artillery_online: cue('Артиллерийская платформа подключена','structure',b('base_resonance_link'),.23,3,1100,1.8),
  artillery_charge: cue('Поступил заряд в артиллерию','mechanical',f('om_toasterstep1'),.14,2,500,.75),
  artillery_servo: cue('Поворот тяжёлой башни','mechanical',f('om_scrape2'),.16,2,900,1.12),
  artillery_acquire: cue('Артиллерия взяла цель','mechanical',f('om_clamour11'),.13,2,650,.7),
  artillery_launch: cue('Выстрел артиллерийской гаубицы','ballistic',f('rd_cannon_01'),.45,4,950,1.94),
  artillery_impact: cue('Попадание тяжёлого снаряда','impact',f('rd_bang_10'),.48,5,650,1.7),
  artillery_hit: cue('Попадание по артиллерийскому корпусу','impact',f('om_clamour1'),.24,3,250,.9),
  artillery_destroyed: cue('Артиллерийская платформа разрушена','impact',f('rd_cannon_02'),.49,5,1200,1.96)
};

AUX_SOUNDS.ui_slider.sampleUrls = [k('impactMetal_heavy_000'),k('impactMetal_heavy_001')];
const recordedLayers = {
  comet_launch:{main:[f('rd_fw_01'),f('rd_fw_02')],
    layer:[f('om_scrape1'),f('om_scrape2')],gain:.19},
  comet_burst:{main:[f('rd_cannon_01'),f('rd_cannon_02')],
    layer:[f('rd_bang_08'),f('rd_bang_10')],gain:.31},
  mine_launch:{main:[f('om_plugpull'),f('om_toasterstep1')],
    layer:[f('om_clamour5'),f('om_clamour7')],gain:.22},
  mine_arm:{main:[f('om_tap')],layer:[f('om_clamour11')],gain:.15},
  mine_burst:{main:[f('rd_bang_02'),f('rd_bang_03'),f('rd_bang_06')],
    layer:[f('om_clamour1'),f('om_clamour3'),f('om_clamour6')],gain:.25},
  target_mark:{main:[f('om_clamour11')],layer:[f('om_tap')],gain:.12},
  dash_burst:{main:[f('rd_fw_03'),f('rd_fw_05')],
    layer:[f('om_scrape1'),f('om_scrape2')],gain:.22},
  swarm_arrival:{main:[f('om_clamour6'),f('om_clamour9')],
    layer:[f('om_toasterstep1'),f('om_toasterstep2')],gain:.13},
  swarm_split:{main:[f('om_scrape1'),f('om_scrape2')],
    layer:[f('om_clamour5'),f('om_clamour7')],gain:.18},
  swarm_merge:{main:[f('om_clamour9'),f('om_clamour10')],
    layer:[f('om_toasterstep1'),f('om_toasterstep2')],gain:.16},
  swarm_warning:{main:[f('om_clamour11'),f('om_clamour7')],
    layer:[f('om_tap'),f('om_toasterstep2')],gain:.15},
  artillery_servo:{main:[f('om_scrape2'),f('om_scrape1')],
    layer:[f('om_clamour5'),f('om_clamour7')],gain:.14},
  artillery_launch:{main:[f('rd_cannon_01'),f('rd_cannon_02')],
    layer:[f('om_clamour3'),f('om_clamour6')],gain:.21},
  artillery_impact:{main:[f('rd_bang_10'),f('rd_bang_08')],
    layer:[f('rd_bang_08'),f('rd_bang_10')],gain:.25},
  artillery_destroyed:{main:[f('rd_cannon_02'),f('rd_bang_10')],
    layer:[f('om_scrape2'),f('om_clamour1')],gain:.25}
};
for(const [key,{main,layer,gain}] of Object.entries(recordedLayers)){
  AUX_SOUNDS[key].sampleUrls=main;
  AUX_SOUNDS[key].sampleLayerUrls=layer;
  AUX_SOUNDS[key].layerGain=gain;
  AUX_SOUNDS[key].fixedPitch=true;
}

export const SOUND_CATALOG = { ...WEAPON_SOUNDS, ...EVENT_SOUNDS, ...BASE_SOUNDS, ...AUX_SOUNDS };

export const BUS_PRESET = Object.freeze({
  master: 0.74, weapons: 0.75, impacts: 0.78, ui: 0.68, structures: 0.66, ambience: 0.32, music: 0.40
});

export const MUSIC_STATES = Object.freeze({
  exploration: { label: 'Исследование', mood: 'воздушный эмбиент, простор, редкий пульс', targetLufs: -20 },
  threat: { label: 'Приближение угрозы', mood: 'нарастающий низкий ритм, напряжение', targetLufs: -18 },
  combat: { label: 'Бой', mood: 'ритм без перегруженной середины, место для оружия', targetLufs: -17 },
  boss: { label: 'Босс', mood: 'плотная драматичная фактура с паузами для ударов', targetLufs: -17 },
  debrief: { label: 'База / док', mood: 'тихий теплый пространственный слой', targetLufs: -21 }
});
