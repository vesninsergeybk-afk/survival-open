/**
 * Sound design manifest for Survivor: Space Frontier.
 *
 * Production audio routing shared with the public sound laboratory.
 * Keys match WEAPONS[*].id in ../src/data.js, production on 2026-10-28.
 *
 * Studio sources are not redistributed. Gameplay uses bundled Kenney CC0 recordings\n * and existing CC0 station recordings; there is no procedural fallback.
 */
export const WEAPON_SOUNDS = {
  starter_pulse: { label: 'Учебный импульс', profile: 'pulse', family: 'energy', gain: 0.34, priority: 3, minIntervalMs: 95, sampleUrl: './assets/sfx/starter_pulse.ogg', note: 'Короткий упругий щелчок и мягкий электрический хвост.' },
  starter_soft: { label: 'Мягкий плазменный импульс', profile: 'softpulse', family: 'energy', gain: 0.36, priority: 2, minIntervalMs: 170, note: 'Тихий, округлый импульс для частой автоматической стрельбы; три близких варианта, без резкой атаки.' },
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
const replacements = {
  starter_soft: [k('laserSmall_000'),k('laserSmall_002'),k('laserSmall_003'),k('laserSmall_004')],
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
  knife: .52, orbit: .35, garlic: .55, frost_nova: .65,
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

const cue = (label,family,sampleUrl,gain,priority=1,minIntervalMs=150,maxDuration=.65) =>
  ({label,profile:'recorded',family,sampleUrl,gain,priority,minIntervalMs,maxDuration});
export const AUX_SOUNDS = {
  ui_open: cue('Открыть панель','ui',k('doorOpen_000'),.12),
  ui_map: cue('Карта','ui',k('doorOpen_001'),.10),
  ui_tab: cue('Вкладка','ui',k('doorClose_000'),.055,1,90,.24),
  ui_dock: cue('Стыковка','ui',k('doorOpen_002'),.12),
  ui_close: cue('Закрыть панель','ui',k('doorClose_000'),.09),
  ui_select: cue('Выбор','ui',k('laserSmall_002'),.07,1,85,.22),
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
  extractor_loop: cue('Работа экстрактора','ambient',k('engineCircular_000'),.12,1,500,.9)
};

AUX_SOUNDS.ui_slider.sampleUrls = [k('impactMetal_heavy_000'),k('impactMetal_heavy_001')];

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
