import {renderContinuation,renderDeathScreen,renderOpeningSignals,renderOpeningHardware,renderRunConfirmation} from './menu-screens.js?v=all-menus-1-menu-audit-1';
import {renderPilotMenu} from './pilot-menu.js?v=all-menus-1-menu-rebuild-1-development-tree-1-devux-3-first-loops-1-menu-audit-1-manual-qa-1';
import {developmentTab} from './development-panel.js?v=menu-rebuild-1-development-tree-1-devux-3-clarity-pass-1-first-loops-1-menu-audit-1-progression-art-6-sketch-menu-consistency-6-semantic-1-manual-weapon-1-manual-qa-2';
import {paintProgressionLinks} from './progression-screen.js?v=progression-art-6-sketch-menu-consistency-6-semantic-1-manual-weapon-1-manual-qa-1';
import {openSystemMenu,mountSystemMenu,attachMenuAccess,menuReturnLabels} from './game-menu.js?v=all-menus-1-first-loops-1-menu-audit-1-menu-shortcuts-2-control-audit-1';
import {borrowAndFit} from './direct-fitting.js?v=direct-fit-2';
import {menuHints} from './menu-hints.js?v=direct-fit-2-menu-focus-1';
import {updateRegionalStorms,drawRegionalStorms,drawStormCharge,stormWeaponDamage} from './regional-storms.js?v=regions-1';
import {updateRegionalWorld,drawRegionalWorld,hitRegionalCargo,spawnRegionalRaid,spawnCentralRaid,spawnFrontierRaid,rememberCargoEscort} from './region-runtime.js?v=living-world-4-logistics-audit-1-lab-logistics-1-enemy-gunnery-1-opening-arc-1-lab-logistics-qa-1-enemy-objectives-1-radio-shadow-1-home-conflict-1-theater-1-expedition-1-campaign-1-theater-audit-1-repair-qa-1-mesh-1-tactical-field-2-backbone-2-world-feedback-1-enemy-economy-1-enemy-domains-1-enemy-balance-2-supply-stronghold-1-radio-retry-1-flux-offense-1-territory-war-1-contour-counterattack-1-first-loops-1-station-ops-2';
import {REGIONS,regionAt} from './regions.js?v=regions-audit-1';
import {focusContourRegion} from './contour-preview.js?v=contour-visual-1-menu-focus-1-menu-reaudit-1-automatic-contours-1';
import {EXPEDITION_CRUISE,updateCruise} from './expedition-cruise.js?v=expedition-1';
import {strategicCapture} from './regional-supply.js?v=living-world-3-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-repair-qa-1-enemy-economy-1-enemy-balance-2-supply-stronghold-1-territory-war-1';
import {disableCentralWorker} from './central-industry.js?v=living-world-1-home-conflict-1-enemy-balance-2-supply-stronghold-1-territory-war-1';
import {damageFrontierAsset} from './frontier-industry.js?v=living-world-3-radio-shadow-1-expedition-1-repair-qa-1-supply-stronghold-1-territory-war-1';
import {grantExperience,experienceFromPickup,firstRichAsteroidExperience,qualifiesForDirectCombatXp,XP_CURVE_VERSION} from './experience.js?v=early-experience-1-xp-feedback-pass1-1-clarity-pass-1';
import {createStrategicExperience,claimStationActivation,claimStationCapture,claimExploration,
 claimContourExpansion,claimFirstFluxDelivery,claimGeologicalSurvey,claimStrategicSabotage} from './strategic-experience.js?v=strategic-xp-pass2-1';
import {makeRoomForDrop} from './drop-capacity.js?v=xp-feedback-pass1-1';
import {createFieldLoot,rewardEyeKill,collectFieldLoot,updateFieldLoot,
 fieldLootDamage,fieldLootArmor,chainFieldLoot,drawFieldLootAura,BOOSTS} from './field-loot.js?v=eye-loot-1';
import {createCombatTempo,recordCombatContact,ambientTempoPlan} from './combat-tempo.js?v=tempo-1';
import {fortificationShield} from './enemy-fortifications.js?v=industrial-forts-1';
import {renderEvolutionMenu,installedEvolution} from './evolution-menu.js?v=mouse-arms-1';
import {updateTerritoryBenefits} from './territory-benefits.js?v=first-loops-1';
import {FIELD_EVOLUTION_SKILLS,createFieldEvolution,offerLevelCrystals,refreshEvolutionOffers,
 enemyFieldReward,collectParasiteCore,absorbParasiteImpact,markDashPass,fieldWeaponImpact,
 updateFieldEvolution,parasiteTargetMode,setParasiteTargetMode} from './field-evolution.js?v=mouse-arms-1-manual-weapon-1';
import {drawEvolutionEnvironment,drawParasiteCore,drawEvolutionEnemy,
 drawEvolutionConnections,drawEvolutionPlayer} from './field-evolution-vfx.js?v=field-evolution-1-first-loops-1';
import {RULES, clamp, dist, length, hash, expForNext, spawnOutside, outsideCamera, SpatialGrid, baseNames, baseColor, openingThreat, burstStats} from './balance.js?v=xp-feedback-pass1-1';
import {World} from './world.js?v=living-world-3-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-repair-qa-1-enemy-economy-1-enemy-domains-1-supply-stronghold-1-flux-reserve-1-flux-offense-1-territory-war-1';
import {updateStationDefense,drawStationDefense,defenseLinked,ensureStationDefense,
 synchronizeStationDefenses} from './network-defense.js?v=network-defense-4';
import {firstRockImpact,nearAmberBelt} from './terrain.js?v=arcade-belt-26';
import {contactOnCircle,contactAtPoint} from './impact-geometry.js?v=arcade-impact-51';
import {ENEMY_TYPES, updateEnemy, updateAlly} from './ai.js?v=enemy-learning-1-enemy-comms-1-regions-1-enemy-world-response-1-network-defense-4-enemy-audit-5-enemy-gunnery-1-opening-arc-1-enemy-plans-1-theater-1-campaign-1-theater-audit-1-repair-qa-1-mesh-1-tactical-field-2-backbone-2-enemy-fixes-1-mesh-strategy-v2-1-mesh-response-v2-1-radio-retry-1-flux-offense-1-territory-war-1-contour-counterattack-1-first-loops-1-station-ops-2';
import {drawEnemyGunWarnings,drawEnemyDefenseGoals} from './enemy-gunnery.js?v=enemy-gunnery-1-opening-arc-1-enemy-fixes-1';
import {hitFriendlyShip} from './enemy-shot-targets.js?v=enemy-targets-1';
import {EnemyLearning,learnedTurretAim} from './enemy-learning.js?v=enemy-learning-1-enemy-audit-2';
import {EnemyComms,ENEMY_COMMS,incomingFireEstimate,estimatedWeaponRange} from './enemy-comms.js?v=enemy-comms-1-enemy-world-response-1-enemy-audit-5-enemy-gunnery-1-enemy-plans-1-theater-1-campaign-1-theater-audit-1-repair-qa-1-mesh-1-tactical-field-2-backbone-2-world-feedback-1-enemy-fixes-1-mesh-strategy-v2-1-mesh-response-v2-1-radio-retry-1-flux-offense-1';
import {drawEnemyIntentions} from './enemy-intentions.js?v=enemy-intents-2-enemy-world-response-2';
import {enemySalvage,enemyDataReward} from './combat-rewards.js?v=economy-balance-1-regions-1-enemy-audit-3-enemy-gunnery-1-opening-arc-1-enemy-objectives-1-campaign-1-repair-qa-1-tactical-field-2-radio-retry-1-flux-offense-1-contour-counterattack-1-first-loops-1-station-ops-2';
import {createSignalIntel,alertSignalIntel,alertSignalThreat} from './signal-perception.js?v=arcade-perception-61-enemy-world-response-2-first-loops-1';
import {planEncounter} from './encounters.js?v=arcade-balanced-bases-30';
import {ArcadeVisuals} from './visuals.js?v=regions-1-campaign-1-counterattack-1-mission-pack-1';
import {ReactorLandmark} from './reactor-landmark.js?v=reactor-fog-motion-v8';
import {recordCapitalHit} from './capital-hit-wear.js?v=arcade-capital-hit-63';
import {markDockEvent} from './repair-dock-art.js?v=dock-identity-1';
import {CockpitDisplay} from './hud.js?v=weapons-cycle-2-opening-arc-1-opening-balance-1-opening-audit-1-home-conflict-1-opening-audit-2-campaign-1-opening-touch-1-repair-qa-1-economy-hud-1-xp-feedback-pass1-1-territory-war-1-clarity-pass-1-first-loops-1-station-ops-2-ops-audit-2-field-ops-1-audit-1-field-experience-1-mission-depth-1-mission-integrity-2-mission-choices-1-radar-clarity-1-enemy-growth-1';
import {chooseInteraction,activeInteraction,automaticFireAllowed} from './controls.js?v=arcade-controls-63';
import {CONTROL_ACTIONS,DEFAULT_CONTROLS,CONTROL_STORAGE_KEY,readControls,changeControl,readableKey,isPressed,isMapShortcut,isMapCloseShortcut} from './control-layout.js?v=control-audit-1';
import {MOTE_SWARM,updateMoteSwarmOrders,drawMoteSwarms} from './mote-swarm.js?v=control-audit-1-recorded-combat-1-realfoley-2';
import {manualWeapons,selectedManual,cycleManual,manualClick,pointerWeaponAction} from './manual-weapon-controls.js?v=control-audit-1';
import {MINING_NOISE,extractionNoiseDelta,extractorStats,rockYield,miningTarget,impactRock,updateRockMotion,drawRockScars,drawExtraction} from './mining.js?v=checkpoint-1';
import {ArcadeHeritage} from './heritage.js?v=foley-autofire-03-carrier-2-weapon-feel-1-mission-av-1-mission-pack-1-mission-variety-1-mission-choices-1-recorded-combat-1-realfoley-2-first-cue-1-manual-qa-1';
import {drawOrbitalWarning,drawOrbitalAfterglow,drawEnergyFlash,drawSeekingMissile,drawHullDamage} from './combat-feedback.js?v=arcade-vfx-viewport-44';
import {emitWeaponFx,updateWeaponFx,drawWeaponFx} from './weapon-fx.js';
import {paintMissionCell,paintMissionMorph,paintMissionImpact} from './mission-objective-art.js?v=mission-pack-1';
import {ION_FIELD,ionPhase,inIonField,ionApproach,drawIonField} from './ion-field.js?v=regions-1';
import {renderBasePanel,baseOffer,transitCost,eligibleContractProgress,contractReadyAtStation,stationModule,BASE_TABS} from './base-panel.js?v=first-contract-reward-1-regions-1-network-defense-4-station-flow-1-defense-rules-1-frontier-3-station-layout-2-station-audit-2-rpg-precision-1-logistics-audit-1-lab-logistics-qa-1-radio-shadow-1-home-conflict-1-station-clarity-1-expedition-1-station-menu-fold-1-campaign-1-repair-qa-1-mesh-log-1-station-clear-2-tactical-field-2-unified-controls-1-backbone-2-direct-fit-2-orbital-terminal-1-xp-feedback-pass1-2-menu-flow-2-menu-focus-1-station-terminal-art-1-menu-reaudit-1-menu-rebuild-1-territory-war-1-map-art-1-automatic-contours-1-auto-reward-1-reward-feedback-1-clarity-pass-1-first-loops-1-menu-audit-1-progression-art-1-station-ops-2-ops-audit-2-station-menu-v2-1-field-ops-1-station-polish-1-audit-1-field-experience-1-portrait-1-menu-prof-1-mission-depth-1-menu-simplify-1-trial-layout-1-menu-consistency-6-mission-integrity-2-mission-choices-1-menu-sketch-1-semantic-1-manual-weapon-1-manual-qa-2-enemy-growth-1';
import {CORRIDOR_OPERATION,isCorridorDock,createCorridorOperation,corridorPosition,corridorAmbush,corridorScanBonus,
 PROBE_OPERATION,isProbeLab,createProbeOperation,operationDestination,isOperationWaypoint,probeDataReady,chooseOperationLead} from './operations.js?v=station-operations-2-ops-audit-2';
import {FIELD_OPERATIONS,isFieldOperation,fieldOperationIds,fieldRewardFactor,createFieldOperation,fieldOperationInteraction,
 advanceFieldOperation,fieldOperationMining,drawFieldOperation} from './field-operations.js?v=field-operations-1-audit-1-field-experience-1-mission-art-5-mission-av-1-mission-pack-1-mission-depth-1-mission-integrity-2-mission-variety-1-mission-choices-1';
import {renderWorldMap} from './map-panel.js?v=menu-exit-1-enemy-intents-2-regions-1-enemy-world-response-2-network-defense-4-living-world-3-frontier-3-rpg-precision-1-logistics-audit-1-rpg-audit-1-lab-logistics-qa-1-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-repair-qa-1-mesh-log-1-backbone-2-living-atlas-3-enemy-radio-2-world-feedback-1-contour-dynamics-2-enemy-economy-1-all-menus-1-enemy-domains-1-global-constellations-1-spacing-1-supply-stronghold-1-map-ux-1-menu-focus-1-flux-reserve-1-menu-reaudit-1-flux-offense-1-menu-rebuild-1-territory-war-1-map-art-1-territory-fixes-1-automatic-contours-1-contour-trials-1-counterattack-1-clarity-pass-1-first-loops-1-menu-audit-1-station-ops-2-ops-audit-2-field-ops-1-station-polish-1-audit-1-field-experience-1-mission-depth-1-mission-integrity-2-mission-variety-1-swarm-map-label-1-mission-choices-1-control-audit-1-enemy-growth-1';
import {mapViewport,mapViewSpec,zoomMap,panMap,pointerOnMap,worldAtMapPoint,insideMap} from './map-navigation.js?v=map-ux-1';
import {contractReturnStation,contractDefenseZone,corridorCue,automaticRange} from './mission-feedback.js?v=weapons-cycle-2-campaign-1-station-ops-2-ops-audit-2-field-ops-1-audit-1-field-experience-1-mission-depth-1-mission-integrity-2-mission-choices-1';
import {RELAY_DEFENSE,isRelayArsenal,createRelayDefense,relayDefenseCue,relayWavePlan,
 relayAttacker,relayPrepInteraction,relayIncomingTargets} from './relay-defense.js?v=station-operations-2-ops-audit-2-mission-choices-1';
import {CARRIER_INTERCEPTION,isCarrierBase,createCarrierInterception,carrierInFlight,carrierDistanceRemaining,moveCarrierCargo,carrierPatrolModifier,carrierRoute,advanceCarrierSystems,hitCarrierCargo,carrierPulseState,carrierTacticalCue} from './carrier-interception.js?v=carrier-intercept-2-campaign-1';
import {ION_CONDUCTOR,markIonCluster,planIonDischarge,ionMasteryAward,drawIonMark} from './ion-conductor.js?v=weapons-cycle-2-campaign-1';

import {createLoadout,loadoutProfile,stageOwnedModule,HangarSession,slotOpen,SHIP_UPGRADES,createThermal,coolWeapons,moduleStats,MODULES,matchingFieldLoan} from './ship-loadout.js?v=first-contract-reward-1-rpg-precision-1-campaign-1-weapon-mechanics-2-unified-controls-1-direct-fit-2-menu-flow-2-menu-focus-1';
import {claimFirstContractModule} from './first-contract-reward.js?v=first-contract-reward-1-campaign-1';
import {captureHangarView,restoreHangarView} from './hangar-view.js?v=hangar-2-station-clear-2-menu-rebuild-1-menu-audit-1-devscroll-1';
import {keepTabInMenu,focusMenu,captureMenuControl,restoreMenuControl,setMenuBackgroundInert} from './menu-dialog.js?v=menu-exit-1-all-menus-1-menu-reaudit-1-menu-audit-1';
import {updateAutomaticWeapons,updateFlakPellets,fireAimedRail,planHowitzer,updateHowitzer,drawHowitzerAim,drawBallisticWeapons,RAIL_AIM_ASSIST} from './ship-weapons.js?v=mouse-area-1';
import {precisionRailUnlocked,PRECISION_RAIL_TECH,labLogisticsUnlocked,labLogisticsIntel,LAB_LOGISTICS_TECH} from './station-progression.js?v=lab-logistics-qa-1-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-repair-qa-1-unified-controls-1-supply-stronghold-1';
import {combatTargets,targetAlive,targetRadius,clearLine,damageTarget} from './combat-targets.js?v=mouse-arms-1';
import {pickDesignatedTarget,activeDesignatedTarget,designationLabel} from './target-designation.js?v=mouse-area-1';
import {createMouseArsenal,canAimMouseWeapon,fireMouseWeapon,updateMouseArsenal,drawMouseArsenal} from './mouse-arsenal.js?v=mouse-arms-1-recorded-combat-1-realfoley-2-manual-weapon-1-manual-qa-1';
import {FIELD_WEAPONS,fieldWeapon,createFieldLoan,fieldLoanOffer,refillQuote,missionAssignment,bindFieldLoan,finishFieldAssignment,planResonance,resonanceDamage,updateFieldEffects,drawFieldEffects} from './field-weapons.js?v=living-world-2-weapon-feel-1-expedition-1-campaign-1';
import {TACTICAL_DEVICES,createTactical,applyTacticalChoice,activateTactical,updateTactical,drawTactical,tacticalAim,tacticalSpec} from './tactical-fields.js?v=tactical-field-2';
import {drawTacticalVfx} from './tactical-vfx.js?v=tactical-vfx-1';
import {RunCheckpointStore,captureCheckpoint,restoreCheckpoint} from './run-checkpoint.js?v=first-contract-reward-1-radio-checkpoint-1-regions-1-network-defense-3-living-world-1-living-world-3-opening-arc-1-opening-balance-1-opening-audit-1-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-opening-touch-1-repair-qa-1-tactical-field-2-backbone-2-contour-dynamics-2-enemy-economy-1-enemy-domains-1-early-xp-1-supply-stronghold-1-strategic-xp-pass2-1-map-ux-1-flux-reserve-1-flux-offense-1-territory-war-1-automatic-contours-1-contour-trials-1-first-loops-1-field-ops-1-audit-1-field-experience-1-mission-depth-1-mission-integrity-2-mouse-arms-1-mission-choices-1';
import {startSortie,finishSortie,appendSortieReport} from './sortie-economy.js?v=economy-integrity-1-econ-audit-2-campaign-1';
import {recordSortieIncome,recordSortieDamage,recordSortieRepair,recordSortieDroneLoss,
 creditContractReward,recordEconomyExpense,emptyEconomyExpenses} from './sortie-ledger.js?v=economy-ledger-1';
import {OPENING_ARC,createOpeningArc,beginOpeningArc,advanceOpeningArc,
 openingArcActive,openingArcPressure,openingArcObjective,openingWaypointCue,recordOpeningCommanderDefeat,runClock} from './opening-arc.js?v=opening-arc-5-early-xp-1';
import {homeConflictPressure,homeConflictTarget,updateHomeConflict} from './home-conflict.js?v=home-conflict-1-campaign-1-repair-qa-1-enemy-balance-2';
import {ambientPatrolRoute,patrolCanLeave} from './enemy-awareness.js?v=living-world-roaming-patrol-2';
import {recordWorldFeedback,recordContourFeedback,advanceWorldFeedback,drawWorldFeedback,drawImpactInvestigation} from './world-feedback.js?v=world-feedback-1-flux-reserve-1';
import {regionalCampaignPressure,campaignDestination,strongholdThreat} from './regional-campaign.js?v=campaign-1-repair-qa-1-enemy-economy-1-stronghold-1-territory-war-1-enemy-growth-1';
import {updateStationInterdiction,interruptStationInterdiction,threatenedStations} from './strategic-command.js?v=campaign-1-repair-qa-1-tactical-balance-1-world-feedback-1-flux-reserve-1-flux-offense-1-territory-war-1';
import {autonomousStrikeCarrier,AUTONOMOUS_STRIKE_RANGE} from './carrier-interception.js?v=carrier-intercept-2-campaign-1';
import {autoConnectContours,contourFields,contourArea,contourProduction,advanceContours,fieldAt,armContourReserve,CONTOURS} from './territory-system.js?v=automatic-contours-1-audit-faces-2-contour-trials-1-first-loops-1';
import {launchFluxSortie,advanceFluxSortie,FLUX_SORTIE} from './flux-offense.js?v=flux-offense-1-territory-war-1';
import {recordIndustrialBreachHit,advanceIndustrialBreaches,INDUSTRIAL_BREACH} from './industrial-breach.js?v=territory-war-1-territory-war-1-breach-fix-1';
import {contourCoverOffer,selectCoverTarget,CONTOUR_COVER} from './contour-cover.js?v=territory-war-2-territory-war-1-topology-fix-1';
import {territoryTech,TERRITORY_TECH} from './territory-tech.js?v=territory-war-1-territory-war-1';
import {warFronts} from './war-fronts.js?v=campaign-1-repair-qa-1-enemy-balance-2-territory-war-1';
import {drawContourWorld} from './contour-visuals.js?v=contour-visual-1-world-feedback-1-contour-dynamics-2-enemy-domains-1-flux-offense-1-territory-war-1-auto-1-contour-trials-1-counterattack-1-first-loops-1';
import {syncContourDynamics,resumeContourTransition} from './contour-dynamics.js?v=contour-dynamics-3-auto-1';
import {registerContourTrials,productiveContourFields,pendingContourTrials} from './contour-trials.js?v=contour-trials-1-clarity-pass-1-first-loops-1';
import {updateContourTrials} from './contour-trial-director.js?v=contour-trials-1-counterattack-1-clarity-pass-1-first-loops-1';
import {drawContourTrialHUD} from './contour-trial-vfx.js?v=contour-trials-1-counterattack-1-clarity-pass-1-first-loops-1';
import {drawContourIrisCharge} from './contour-trial-iris.js?v=contour-counterattack-1';

const $=id=>document.getElementById(id);
const TAU=Math.PI*2;
const SKILLS=[
 {id:'beam',branch:'Оружие',title:'Калибровка орудий',max:5,from:2,desc:'Каждый ранг усиливает урон автоматических орудий и ионной цепи на 20%, темп автоогня на 8% от базового'},
 {id:'double',branch:'Оружие',title:'Разделение луча',max:2,from:4,requires:'beam',desc:'Делит плазменный залп между двумя или тремя ближайшими целями. По одиночной цели сохраняет всю мощность'},
 {id:'range',branch:'Оружие',title:'Фокусировка',max:3,from:3,desc:'Увеличивает рабочую дальность, не убирая спад силы'},
 {id:'rocket',branch:'Оружие',title:'Авторакеты',max:3,from:5,desc:'Редкий сильный залп с полной дальнобойной силой'},
 {id:'hull',branch:'Корабль',title:'Укрепление корпуса',max:5,from:2,desc:'+22 к прочности и частичный ремонт'},
 {id:'engine',branch:'Корабль',title:'Импульсный форсаж',max:4,from:2,desc:'Ускоряет корабль и улучшает короткий рывок на Shift'},
 {id:'shield',branch:'Корабль',title:'Энергощит',max:3,from:4,requires:'hull',desc:'Часть урона поглощает восстанавливаемый щит'},
 {id:'dodge',branch:'Корабль',title:'Уклонение',max:3,from:3,desc:'Короткий ускоренный рывок после попадания'},
 {id:'magnet',branch:'Добыча',title:'Магнитный захват',max:3,from:2,desc:'Притягивает сплав и данные с большей дистанции'},
 {id:'mining',branch:'Добыча',title:'Геологическая подготовка',max:4,from:2,desc:'Усиливает экстрактор; первый ранг уменьшает шум добычи на 16%, каждый второй добавляет сплав. Каждый ранг даёт +2 опыта за новое далёкое месторождение (до шести участков).'},
 {id:'extractor',branch:'Добыча',title:'Дуговой экстрактор',max:3,from:3,requires:'mining',desc:'Экстрактор быстрее расщепляет астероиды и отделяет больше сплава'},
 {id:'radar',branch:'Технологии',title:'Навигационный радар',max:2,from:3,desc:'Обнаруживает станции раньше; каждый ранг добавляет +2 опыта за первую разведку новой станции (не более 18 станций).'},
 {id:'tactics',branch:'Технологии',title:'Боевой протокол',max:3,from:5,desc:'Союзники быстрее выбирают опасные цели'},
 ...FIELD_EVOLUTION_SKILLS
];

const DOCTRINES=[
 {id:'assault',title:'Штурмовик',desc:'Плазменный луч наносит на 22% больше урона в пределах 180 м. Подходите ближе к опасным целям.'},
 {id:'command',title:'Командир',desc:'Ведомые рядом с вами наносят на 25% больше урона. Сильнее всего с развитой эскадрой.'},
 {id:'prospect',title:'Старатель',desc:'Экстрактор на 15% мощнее и приносит ещё 1 сплав за астероид.'}
];
const fmt=n=>Number(n.toFixed(2)).toString().replace('.',',');
const pointsWord=n=>n%100>=11&&n%100<=14?'очков':n%10===1?'очко':
 n%10>=2&&n%10<=4?'очка':'очков';
function nextSkillEffect(id,rank,levels={}){
 const n=rank+1;
 switch(id){
  case 'beam':return 'Автооружие: урон ×'+fmt(1+rank*.2)+' → ×'+fmt(1+n*.2)+
    ' · темп ×'+fmt(1+rank*.08)+' → ×'+fmt(1+n*.08)+' · тот же прирост урона ионной цепи';
  case 'double':return n===1?'Две цели получают по 60% залпа; одиночная — 100%':
    'Три цели получают по 45% залпа; две — по 60%; одиночная — 100%';
  case 'range':return 'Дальность луча: '+(435+rank*56)+' → '+(435+n*56);
  case 'rocket':{
   const before=moduleStats('rocket',levels),after=moduleStats('rocket',{...levels,rocket:n});
   return rank===0?'Даст ракетный модуль: '+fmt(after.damage)+' урона каждые '+fmt(after.interval)+
    ' с. Установите его в узел и примените сборку.':'Урон ракеты: '+fmt(before.damage)+' → '+fmt(after.damage)+
    ' · интервал '+fmt(before.interval)+' → '+fmt(after.interval)+' с';
  }
  case 'hull':return 'Прочность корпуса: ещё +22 · сразу частичный ремонт';
  case 'engine':return 'Скорость: '+(272+rank*35)+' → '+(272+n*35)+
    ' · перезарядка рывка: '+fmt(burstStats(rank).cooldown)+' → '+fmt(burstStats(n).cooldown)+' с';
  case 'shield':return rank===0?'Откроет щит: до 40 ед. · восстановление после 3 с без урона':
    'Запас щита: '+(16+rank*24)+' → '+(16+n*24)+' · быстрее восстановление вне боя';
  case 'dodge':return 'Аварийный отход: '+(rank*120)+' → '+(n*120)+
    ' · неуязвимость после удара: '+fmt(.55+rank*.12)+' → '+fmt(.55+n*.12)+' с';
  case 'magnet':return 'Притяжение трофеев: '+(105+rank*55)+' → '+(105+n*55);
  case 'mining':return 'Мощность экстрактора: '+extractorStats(levels.extractor||0,rank).damagePerSecond+' → '+
    extractorStats(levels.extractor||0,n).damagePerSecond+' урона/с'+
    (n%2===0?' · +1 сплав за астероид':'')+
    (n===1?' · шум добычи −16%':'')+' · опыт за новый участок: +'+
    (9+rank*2)+' → +'+(9+n*2);
  case 'extractor':return 'Разряд: '+extractorStats(rank,levels.mining||0).damagePerSecond+
    ' → '+extractorStats(n,levels.mining||0).damagePerSecond+' урона/с'+
    (n===1||n===3?' · +1 сплав за астероид':'');
  case 'radar':return 'Радиус обнаружения станций: '+(570+rank*190)+' → '+(570+n*190)+
    ' · опыт за новую станцию: +'+(6+rank*2)+' → +'+(6+n*2);
  case 'tactics':return 'Решения ведомых: чаще на '+(Math.round(n*.2*100))+
    '% относительно базового темпа';
  case 'parasite':return 'Сразу 1 заряд защиты · затем энергоядро за каждые 3 личные победы · запас до 2';
  case 'conduit':return 'Рывок оставляет метки на 4 с · точное попадание удерживает до 3 целей на 1,25 с';
  case 'wreck':return 'До 3 обломков-укрытий после побед · 19 с · 48 прочности';
  case 'capture':return 'Комета отмечает поражённого дрона · добейте его лично для захвата на 16 с (1 ядро)';
  case 'signal':return 'Попадание кометы внедряет ядро в прочную цель · разведка звена 16 с';
  case 'cometRadius':return 'Радиус взрыва кометы: '+(90+rank*17)+' → '+(90+n*17)+' м';
  case 'mineArray':return 'Мины за залп: '+(4+rank)+' → '+(4+n);
  case 'cometCore':return 'Урон в эпицентре кометы: +'+(rank===0?0:rank===1?25:45)+'% → +'+(n===1?25:45)+'%';
  case 'cometCryo':return 'Замедление после кометы: '+(rank===0?'нет':rank===1?'2,2 с, скорость ×0,66':'3,2 с, скорость ×0,52')+
   ' → '+(n===1?'2,2 с, скорость ×0,66':'3,2 с, скорость ×0,52');
  case 'minePierce':return 'Урон по тяжёлым кораблям от мин: +'+(rank===0?0:rank===1?30:50)+'% → +'+(n===1?30:50)+'%';
  case 'mineSnare':return 'Замедление от мин: '+(rank===0?'нет':rank===1?'1,8 с, скорость ×0,60':'2,8 с, скорость ×0,42')+
   ' → '+(n===1?'1,8 с, скорость ×0,60':'2,8 с, скорость ×0,42');
  default:return '';
 }
}
const MODELS={
 scout:'../assets/space/enemy_drone.png',
 fighter:'../assets/space/enemy_fighter.png',
 flanker:'../assets/space/enemy_interceptor.png',
 healer:'../assets/space/enemy_shield.png',
 berserker:'../assets/space/enemy_bomber.png',
 gunship:'../assets/space/enemy_caster.png',
 allyfighter:'../assets/space/ship_fighter.png',
 allyscout:'../assets/space/ship_scout.png',
 allybomber:'../assets/space/ship_mage.png',
 fieldProps:'./assets/missions/field-props-v1.webp',
 relayPoses:'./assets/missions/relay-poses-v3.webp',
 relayRuined:'./assets/missions/relay-ruined-v1.webp',
 repairDrone:'./assets/missions/repair-drone-v1.webp',
 convoyHealth:'./assets/missions/convoy-health-v2.webp',
 convoyWreck:'./assets/missions/convoy-wreck-v1.webp',
 convoyDebris:'./assets/missions/convoy-debris-v1.webp',
 salvageCrate:'./assets/missions/salvage-crate-v1.webp',
 missionSpecial:'./assets/missions/special-objectives-v1.webp',
 missionHardware:'./assets/missions/reactor-hardware-v1.webp',
 missionFreighter:'./assets/missions/hostile-freighter-v1.webp',
 missionImpacts:'./assets/missions/mission-impacts-v1.webp',
 rock:'../assets/space/asteroid-ore.webp',
 rock2:'../assets/space/asteroid-realistic.webp'
};
const sprite=(url,table,key)=>{
 const img=new Image();img.decoding='async';img.src=url;table[key]=img;return img;
};
export class ArcadeGame {
 constructor(){
  this.canvas=$('game');this.ctx=this.canvas.getContext('2d',{alpha:true});
  this.overlay=$('overlay');this.message=$('message');this.keys=new Set();
  this.touch={x:0,y:0};this.seed=20261102;
  this.world=new World(this.seed);this.visuals=new ArcadeVisuals();
  this.reactor=new ReactorLandmark();
  // Capital hull impact painting is explicitly opt-in for visual QA.
  this.visuals.capitalDamageQA=typeof location!=='undefined'&&
   new URLSearchParams(location.search).get('capitalDamageQa')==='1';
  this.firstLoopsQA=typeof location!=='undefined'&&new URLSearchParams(location.search).get('qa')==='first-loops';
  this.cockpit=new CockpitDisplay();
  this.heritage=new ArcadeHeritage();this.grid=new SpatialGrid(110);
  this.lastIonAudioCycle=-1;
  this.shotGrid=new SpatialGrid(95);
  this.rockGrid=new SpatialGrid(140);
  this.player={x:0,y:0,vx:0,vy:0,r:19,hp:110,maxHp:110,shield:0,
    xp:0,level:1,points:0,xpCurveVersion:XP_CURVE_VERSION,firstRichRockStudied:false,
    strategicXp:createStrategicExperience(),
    ore:0,data:0,invul:0,angle:0,
     burstRemaining:0,burstCooldown:0,burstX:0,burstY:-1};
  this.skillRanks=Object.fromEntries(SKILLS.map(s=>[s.id,0]));
  this.fieldEvolution=createFieldEvolution();
  this.fieldLoot=createFieldLoot();this.combatTempo=createCombatTempo();
  this.shipLoadout=createLoadout();
  this.firstHardwareReward=null;
  let hangarStorage=null;try{if(!this.firstLoopsQA)hangarStorage=window.localStorage;}catch{}
  this.recordStorage=hangarStorage;
  this.controls=readControls(hangarStorage);
  this.bindingCapture=null;
  let priorBest=0;try{priorBest=Number(hangarStorage?.getItem('survivor.best-flight.v1')||0);}catch{}
  this.bestFlight=Number.isFinite(priorBest)&&priorBest>=0?priorBest:0;
  this.hangarSession=new HangarSession(hangarStorage);
  this.enemyLearning=(this.visuals.capitalDamageQA||this.firstLoopsQA)?null:new EnemyLearning(hangarStorage);
  this.enemyComms=new EnemyComms();
  this.designatedTarget=null;
  this.targetField=null;
  this.mouseArsenal=createMouseArsenal();this.mouseAim=null;this.mobileMineArmed=false;
  this.lastTargetHintAt=-Infinity;
  this.cruiseCharge=0;this.cruising=false;
  window.addEventListener?.('pagehide',()=>this.enemyLearning?.flush(this.time));
  this.manualRailMode=false;this.precisionRailAvailable=false;this.selectedManualWeapon=null;
  this.weaponThermal=createThermal();this.moduleClocks={rail:0,flak:0};
  this.heavyCharge=null;this.heavyCooldown=0;this.syncShipLoadout();
  this.doctrine=null;this.lastDamageAt=-Infinity;
  this.network={armor:0,armament:0,engine:0,strikePower:0};
  this.enemies=[];this.allies=[];this.drops=[];this.shots=[];this.missiles=[];this.flakPellets=[];this.heavyShells=[];this.flashes=[];this.weaponFx=[];
   this.support={charges:0,cooldown:0,missions:[]};
  this.zones=[];this.images={};this.time=0;this.spawnClock=9;this.miningNoise=0;
  this.lastNoiseSource=null;this.noiseAlert=null;
  this.miningNoiseWarned=false;this.miningIntroShown=false;this.coverWearWarned=false;
  this.contract=null;this.operation=null;this.probeRepairing=false;this.baseTab='summary';
  this.hangarView='weapons';this.developmentDomain='pilot';this.developmentFocus='';this.developmentWeapon=null;
  this.developmentTactic='pulse';this.mapReturnToBase=false;
  this.mapView='map';this.contourRegion='all';this.contourFirst=null;this.contourSelection=null;this.contourError='';this.contourInfo='';this.enemyBackboneMap=false;
  this.mapViewports={};this.mapPointers=new Map();this.mapDraggedUntil=0;this.lastMapPanRender=0;this.mapMarkMode=false;
  this.contourFeedback=null;this.contourBirths=[];this.contourDynamics=null;this.contourTrial=null;
  this.openingArc=createOpeningArc(this.world.home);this.openingRepairing=false;
  this.sortieStart=null;this.sortieReports=[];this.stationExitArmed=false;
  this.lastContractReceipt=null;
  this.economyExpenses=emptyEconomyExpenses();
   this.geoScanUntil=0;this.overchargeUntil=0;
   this.fieldLoan=null;this.fieldTrialTaken=false;this.fieldReturnAt=-Infinity;this.fieldEffects=[];
   this.tactical=createTactical();this.tacticalPointer=null;
   this.ionMasteryAwarded=false;
  this.mining={active:false,target:null,fxClock:0};
  this.actionHeld=null;this.interactionFocus=null;this.holdFire=false;this.localStations=[];
  this.beamClock=.25;this.rocketClock=4;this.zoneClock=80;
  this.stationary=0;this.lastX=0;this.lastY=0;this.hacks=[];this.activeBases=0;
  this.enemySerial=0;this.allySerial=0;this.groupSerial=0;this.heavyPortalShown=false;
  this.lastEncounter='';this.lastEncounterLabelAt=-30;this.paused=false;
  this.pausedRenderPending=false;
  this.dead=false;this.deathSceneEnd=0;this.deathVfxAt=0;this.fps=60;this.frameSamples=[];this.lastHud=0;
  this.nearRocks=[];this.worldQueryClock=0;this.worldQueryX=0;this.worldQueryY=0;
  this.amberBeltSeen=false;this.ionFieldSeen=false;
   this.renderScale=1;this.qualityTimer=0;
  this.messageUntil=0;this.worldFeedback={history:[],pending:[],serial:0};this.vw=1200;this.vh=800;
  this.worldVisualLast=-Infinity;this.cachedWorldLinks=[];
  this.contourVisualAt=-Infinity;this.contourVisualFields=null;this.lastContourNoticeAt=-Infinity;
  this.cachedNetworkLinked=new Set();this.cachedTarget=null;
  this.nextDefenseCheckAt=0;this.lastDefenseNoticeAt=-Infinity;
  this.defenseTopology=null;this.defenseTopologyAt=0;
   this.waypoint={id:this.world.home.id,x:this.world.home.x,y:this.world.home.y,label:'Домашний док'};
   this.manualWaypoint=null;
   this.nearArsenalBonus=false;this.nearArsenalDefense=false;this.nearDockField=false;this.nearQuietLab=false;
  for(const [k,url] of Object.entries(MODELS))sprite(url,this.images,k);
  // One ordinary heavy AI ship is exposed only for capital hull visual QA.
  if(this.visuals.capitalDamageQA){
   const kind=new URLSearchParams(location.search).get('capitalShip')||'cruiser';
   const serial=({cruiser:6,carrier:4,dreadnought:2})[kind]||6;
   const def=ENEMY_TYPES.gunship;
   this.enemySerial=serial;
   this.enemies.push({serial,group:++this.groupSerial,type:'gunship',
    x:this.player.x+185,y:this.player.y-92,vx:0,vy:0,r:22,
    hp:def.hp,maxHp:def.hp,damage:def.dmg,think:0,fire:1.1,
    state:'hunt',commitUntil:0,target:this.player,angle:0,hit:0,
    expAwarded:false,scenario:'capital-visual-qa',protect:null,
    entryPortalPending:false});
  }
  this.bind();this.resize();this.world.discover(0,0);
  this.notice(matchMedia('(pointer: coarse)').matches?
   'Подлетите к доку и нажмите «Действие».':
   'WASD или стрелки — полёт · Tab / M — карта · '+this.controlLabel('interact')+' — домашний док · В доке можно бесплатно взять полевой модуль · '+this.controlLabel('dash')+' — рывок.',9);
  this.runStore=(this.visuals.capitalDamageQA||this.firstLoopsQA)?null:new RunCheckpointStore(hangarStorage);
  const saved=this.runStore?.load();
  if(saved||['damaged','unsupported'].includes(this.runStore?.issue))this.offerContinuation(saved);
  else this.runStore?.startNew();
  if(this.firstLoopsQA)window.__survivorFirstLoops=this;
  this.last=performance.now();this.loop=this.loop.bind(this);
  requestAnimationFrame(this.loop);
 }
 resize(){
  const w=window.innerWidth,h=window.innerHeight;
  const mobile=matchMedia('(pointer: coarse)').matches;
  this.isTouchLayout=mobile;
  this.vw=mobile&&w<h?620:1200;
  this.vh=this.vw*h/Math.max(1,w);
  const scale=Math.min(window.devicePixelRatio||1,1.45)*this.renderScale;
  this.canvas.width=Math.max(1,Math.round(w*scale));
  this.canvas.height=Math.max(1,Math.round(h*scale));
  this.canvas.style.width=w+'px';this.canvas.style.height=h+'px';
  this.ctx.setTransform(this.canvas.width/this.vw,0,0,this.canvas.height/this.vh,0,0);
 }
 camera(){return {x:this.player.x-this.vw/2,y:this.player.y-this.vh/2,w:this.vw,h:this.vh};}
 controlLabel(action){return readableKey((this.controls||DEFAULT_CONTROLS)[action]);}
 bindControlSettings(){
  const panel=$('controlSettings'),list=$('controlsBindingList'),message=$('controlsBindingMessage');
  if(!panel||!list||!message)return;
  const render=()=>{
   const extraOpen=!!list.querySelector?.('details')?.open;
   const row=x=>'<div class="control-binding-row"><span>'+x.name+
    '</span><button type="button" data-bind="'+x.id+'" aria-label="Изменить клавишу: '+x.name+'">'+
    readableKey(this.controls[x.id])+'</button></div>';
   const main=new Set(['up','left','down','right','dash','field','interact','map']);
   list.innerHTML=CONTROL_ACTIONS.filter(x=>main.has(x.id)).map(row).join('')+
    '<details class="control-binding-extra"'+(extraOpen?' open':'')+'><summary>Дополнительные команды</summary>'+
    CONTROL_ACTIONS.filter(x=>!main.has(x.id)).map(row).join('')+'</details>';
  };
  const status=(text,error=false)=>{message.textContent=text;message.classList.toggle('error',error);};
  render();
  panel.addEventListener('toggle',()=>{
   if(panel.open){
    if(document.getElementById?.('gameMenuDialog')&&!document.getElementById('gameMenuDialog').open)return;
    if(!this.paused&&!this.dead&&this.overlay.hidden){this._controlsPausedGame=true;this.paused=true;
     this.heritage.pause('controls');}
   }else{
    this.bindingCapture=null;
    render();status('Нажмите клавишу в списке, чтобы изменить её.');
    if(this._controlsPausedGame){this._controlsPausedGame=false;
     if(this.overlay.hidden&&!this.dead){this.paused=false;this.heritage.resume();}}
   }
  });
  list.addEventListener('click',e=>{
   const button=e.target.closest?.('button[data-bind]');if(!button)return;
   this.bindingCapture=button.dataset.bind;status('Нажмите клавишу для «'+
    CONTROL_ACTIONS.find(x=>x.id===this.bindingCapture).name+'». Esc — отмена.');
   button.textContent='…';button.focus();
  });
  $('controlsReset')?.addEventListener('click',()=>{
   this.bindingCapture=null;this.controls={...DEFAULT_CONTROLS};this.keys.clear();this.endInteraction();
   try{this.recordStorage?.setItem(CONTROL_STORAGE_KEY,JSON.stringify(this.controls));}catch{}
   render();status('Стандартные клавиши восстановлены.');this.hud?.();
  });
  document.addEventListener('keydown',e=>{
   if(!this.bindingCapture){
    if(panel.open&&e.code==='Escape'&&!document.getElementById?.('gameMenuDialog')?.open){
     e.preventDefault();e.stopImmediatePropagation();panel.open=false;
    }
    return;
   }
   e.preventDefault();e.stopImmediatePropagation();
   if(e.code==='Escape'){
    const action=this.bindingCapture;this.bindingCapture=null;render();
    status('Изменение отменено.');list.querySelector('[data-bind="'+action+'"]')?.focus();return;
   }
   if(e.ctrlKey||e.metaKey||e.altKey){status('Назначьте одну клавишу без Ctrl, Alt или Cmd.',true);return;}
   const changed=changeControl(this.controls,this.bindingCapture,e.code);
   if(!changed.ok){status(changed.reason,true);return;}
   const action=this.bindingCapture;
   this.controls=changed.bindings;this.bindingCapture=null;this.keys.clear();this.endInteraction();
   try{this.recordStorage?.setItem(CONTROL_STORAGE_KEY,JSON.stringify(this.controls));}catch{}
   render();status('Клавиша сохранена на этом устройстве.');
   list.querySelector('[data-bind="'+action+'"]')?.focus();this.hud?.();
  },true);
 }
 bind(){
  this.controls||={...DEFAULT_CONTROLS};
  window.addEventListener('resize',()=>this.resize());
  this.bindControlSettings();mountSystemMenu(this);
  $('evolutionPrompt')?.addEventListener('click',event=>{
   const button=event.target.closest?.('[data-evolution]');
   if(!button)return;
   if(button.dataset.evolution==='open'){this.openEvolution();return;}
   if(button.dataset.evolution==='parasiteMode'){
    this.setParasiteMode(parasiteTargetMode(this)==='capture'?'signal':'capture');return;
   }
   if(button.dataset.evolution==='later'){this.deferEvolution();return;}
   this.chooseEvolution(button.dataset.evolution);
  });
  document.addEventListener('keydown',e=>{
   const launchOpen=document.getElementById?.('mobileLaunch')?.hidden===false;
   if(document.getElementById?.('gameMenuDialog')?.open||document.getElementById?.('creditsDialog')?.open)return;
   if(!launchOpen&&!this.overlay.hidden&&keepTabInMenu(e,this.overlay))return;
   if(launchOpen)return;
   if(!this.overlay.hidden&&this.overlay.dataset.mode==='map'&&!e.repeat&&
      !e.ctrlKey&&!e.metaKey&&!e.altKey&&isMapCloseShortcut(e.code,this.controls)&&
      !e.target?.closest?.('input,textarea,select,[contenteditable="true"]')){
    e.preventDefault();this.goBackInMenu();return;
   }
   if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&this.overlay.dataset.mode==='evolution'&&!this.overlay.hidden&&this.fieldEvolution?.offers.length&&
    ['Digit1','Digit2','Digit3'].includes(e.code)&&!e.repeat&&
    !e.target?.closest?.('input,textarea,select,[contenteditable="true"]')){
    e.preventDefault();this.chooseEvolution(this.fieldEvolution.offers[Number(e.code.slice(-1))-1]);return;
   }
   if(e.ctrlKey||e.metaKey||e.altKey)return;
   // Escape belongs to the open screen, even if the focused element is a button.
   if(e.code==='Escape'){
    e.preventDefault();
    if(e.repeat)return;
    if(this.overlay.hidden)openSystemMenu(this);
    else this.goBackInMenu();
    return;
   }
   // Game commands never pass through a modal screen.
   if(!this.overlay.hidden)return;
   if(e.target?.closest?.('input,textarea,select,button,summary,a'))return;
   if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',...Object.values(this.controls)].includes(e.code)||
      isMapShortcut(e.code,this.controls))e.preventDefault();
   if(!e.repeat){
    if(e.code===this.controls.interact)this.beginInteraction('keyboard');
    if(e.code===this.controls.cease)this.toggleHoldFire();
    if(e.code===this.controls.hack)this.hack();
    if(e.code===this.controls.field)this.callFieldWeapon();
    if(e.code===this.controls.howitzer)this.callHowitzer();
    if(e.code===this.controls.strike)this.callStrike();
    if(e.code===this.controls.railMode&&!this.dead)this.toggleManualRail();
    if(isMapShortcut(e.code,this.controls))this.openMap();
    if(e.code===this.controls.skills)this.skills();
    if(e.code===this.controls.railMode&&this.dead)location.reload();
   }
   this.keys.add(e.code);
   if(!e.repeat&&e.code===this.controls.dash)this.startBurst();
  });
  document.addEventListener('keyup',e=>{
   this.keys.delete(e.code);
   if(e.code===this.controls.interact)this.endInteraction('keyboard');
  });
  window.addEventListener('blur',()=>{this.keys.clear();this.endInteraction();});
  document.addEventListener('survivor:mobile-launch-closed',()=>{
   if(!this.overlay.hidden)focusMenu(this.overlay);
   else this.canvas?.focus?.({preventScroll:true});
  });
  document.addEventListener('visibilitychange',()=>{
   if(document.hidden){this.keys.clear();this.endInteraction();}
   this.heritage.visibility(document.hidden);
  });
  this.overlay.addEventListener('click',e=>{
   if(Date.now()<this.mapDraggedUntil){e.preventDefault();return;}
   const mapSvg=e.target.closest?.('svg[data-map-world]');
   if(this.overlay.dataset.mode==='map'&&this.mapMarkMode&&mapSvg){
    this.setMapWaypoint(pointerOnMap(mapSvg,e.clientX,e.clientY));return;
   }
   const b=e.target.closest('[data-act]');if(!b)return;
   const act=b.dataset.act;
   if(b.disabled)return;
   if(this.pendingStationModule&&this.overlay.dataset.mode==='base'&&
    !b.closest('.base-module-confirm'))return;
   if(act==='evolutionPick'){this.chooseEvolution(b.dataset.id);return;}
   if(act==='parasiteMode'){this.setParasiteMode(b.dataset.mode);return;}
   if(act==='evolutionAll'){this.skills(true);return;}
   if(act==='trialRoute'){
    const entry=pendingContourTrials(this.world).find(t=>String(t.id)===b.dataset.id);
    if(entry){this.mapView='map';this.openMap(entry);}
    return;
   }
   if(act==='trialWaypoint'&&this.overlay.dataset.mode==='map'){
    const entry=pendingContourTrials(this.world).find(t=>String(t.id)===b.dataset.id);
    if(entry)this.setNavigationCourse({id:'trial-'+entry.id,x:entry.x,y:entry.y,
     label:'Оборона нового треугольника'},'Курс к месту обороны. Нападение начнётся при сближении.');
    return;
   }
   if(act==='systemMenu'){openSystemMenu(this);return;}
   if(act==='requestRunNew'||act==='requestRestart'){this.requestRunAction(act==='requestRestart'?'restart':'runNew');return;}
   if(act==='cancelRunNew'){this.cancelRunAction();return;}
   if(act==='confirmRunNew'||act==='confirmRestart'){
    const expected=act==='confirmRestart'?'restart':'runNew';
    if(this.pendingRunAction!==expected||!this.overlay.querySelector('.run-confirm'))return;
    this.cancelRunAction();
    if(expected==='restart'){this.runStore?.end();location.reload();return;}
    this.pendingCheckpoint=null;this.runStore?.startNew();this.overlay.dataset.mode='';this.dismiss();
    this.notice('Новый вылет. Прогресс сохраняется на активных станциях.',4);return;
   }
   if(act==='pilotStation'){this.returnToStation();return;}
   if(act==='pilotHangar'){this.baseTab='hangar';this.hangarView='weapons';this.returnToStation();return;}
   if(act==='pilotMap'){this.openMap();return;}
   if(act==='pilotSkills'){this.skills();return;}
   if(act==='openShipService'&&this.docked?.active){
    this.baseTab='hangar';this.hangarView='services';this.hangarSession.message='';
    this.heritage.ui('tab');this.renderDock();return;
   }
   if(act==='openDevelopment'){
    this.openDevelopment(b.dataset.id,b.dataset.focus,b.dataset.upgrade);return;
   }
   if(act==='devDomain'){
    this.developmentDomain=developmentTab(b.dataset.id);this.developmentFocus='';this.renderDock();return;
   }
   if(act==='devFocus'){
    this.developmentFocus=b.dataset.id||'';this.renderDock();return;
   }
   if(act==='devPilotBranch'&&['Корабль','Технологии','Добыча'].includes(b.dataset.id)){
    this.skillBranch=b.dataset.id;this.developmentFocus='';this.renderDock();return;
   }
   if(act==='devWeapon'&&(Object.hasOwn(MODULES,b.dataset.id)||['comet','mines'].includes(b.dataset.id))){
    this.developmentWeapon=b.dataset.id;
    if(Object.hasOwn(MODULES,b.dataset.id))this.hangarSession.focusWeapon=b.dataset.id;
    this.developmentFocus='';this.renderDock();return;
   }
   if(act==='devTactic'&&(Object.hasOwn(TACTICAL_DEVICES,b.dataset.id)||b.dataset.id==='abilities')){
    this.developmentTactic=b.dataset.id;this.developmentFocus='';this.renderDock();return;
   }
   if(act==='fitWeapon'){this.focusFittingWeapon(b.dataset.id);return;}
   if(act==='runContinue'){this.continueRun();return;}
   if(act==='conflictPlan'){this.chooseConflictPlan(b.dataset.role);return;}
   if(act==='campaignFront'){
    const target=campaignDestination(this,b.dataset.role);
    if(!this.dead&&target&&['base','map'].includes(this.overlay.dataset.mode))
     this.setNavigationCourse(target,'Курс задан. Подготовьте корабль перед вылетом.');
    return;
   }
   if(act==='defendStation'){this.chooseStationDefense(b.dataset.role);return;}
   if(act==='runNew'){
    this.pendingCheckpoint=null;this.runStore?.startNew();
    this.overlay.dataset.mode='';this.dismiss();
    this.notice('Новый вылет. На активных станциях прогресс сохраняется.',5);return;
   }
   if(act==='openingPick'){this.chooseOpeningRoute(b.dataset.role);return;}
   if(act==='openingSkip'){this.skipOpeningRoute();return;}
   if(act==='openingReward'){this.claimOpeningReward(b.dataset.role);return;}
   if(act.startsWith('hg')){this.hangarAction(b.dataset);return;}
   if(act==='skillBranch'&&['Корабль','Технологии','Добыча','Оружие'].includes(b.dataset.id)){
    this.skillBranch=b.dataset.id;
    if(this.overlay.dataset.mode==='base')this.renderDock();
    else this.renderSkills();
    this.overlay.querySelector('.skill-branch-tabs [aria-pressed="true"]')?.focus({preventScroll:true});return;
   }
   if(act==='mapView'&&['map','territory','targets'].includes(b.dataset.id)){
    this.mapView=b.dataset.id;this.renderMap();
    this.overlay.querySelector('.map-view-switch [aria-pressed="true"]')?.focus({preventScroll:true});return;
   }
   if(act==='mapZoom'){
    this.zoomMapAt(b.dataset.id==='in'?1.45:1/1.45);return;
   }
   if(act==='mapCenter'){
    delete this.mapViewports[mapViewSpec(this).key];this.renderMap();return;
   }
   if(act==='mapClearWaypoint'){
    this.manualWaypoint=null;this.contourInfo='Личная метка удалена. Основной маршрут сохранён.';
    this.mapCourseMessage=this.contourInfo;
    this.pausedRenderPending=true;this.renderMap();return;
   }
   if(act==='mapMarkMode'){
    this.mapMarkMode=!this.mapMarkMode;this.renderMap();return;
   }
   if(act==='mapFocusPlan'){
    const stations=(b.dataset.ids||'').split(',').map(id=>this.world.stations.get(id)).filter(Boolean);
    if(stations.length!==3)return;
    const spec=mapViewSpec(this);
    if(!spec.key.startsWith('region:'))return;
    const xs=stations.map(s=>s.x),ys=stations.map(s=>s.y);
    const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
    const scale=Math.min(spec.limits[1],Math.max(spec.limits[0],
     Math.min(510/(right-left+500),340/(bottom-top+500))));
    this.mapViewports[spec.key]={center:{x:(left+right)/2,y:(top+bottom)/2},scale};
    this.renderMap();return;
   }
   if(act==='contourRegion'){
    focusContourRegion(this,b.dataset.id);
    this.renderMap();return;
   }
   if(act==='contourTarget'){
    const node=this.world.stations.get(b.dataset.id);
    if(!node?.enemy||!node.discovered||
      !warFronts(this.world).some(f=>f.depotId===node.id))return;
    const region=regionAt(node.x,node.y);
    this.mapView='territory';this.contourRegion=region.id;
    this.contourFirst=null;this.contourSelection=node.id;this.contourError='';
    this.mapViewports||={};
    this.mapViewports['region:'+region.id]={center:{x:node.x,y:node.y},
     scale:region.id==='amethyst'?.055:.049};
    this.renderMap();return;
   }
   if(act==='contourEnemyRadio'){
    this.enemyBackboneMap=!this.enemyBackboneMap;
    if(this.enemyBackboneMap)this.contourRegion='all';
    this.renderMap();
    this.overlay.querySelector('[data-act="contourEnemyRadio"]')?.focus({preventScroll:true});
    return;
   }
   if(act==='contourPulse'){
    const state=this.world.contours,p=this.player;
    if(state.flux>=5&&this.time>=(state.pulseReadyAt||0)&&p.shield<42&&
      fieldAt(this.world,p.x,p.y)){
     const shieldBefore=p.shield;
     state.flux-=5;state.pulseReadyAt=this.time+120;p.shield=Math.min(42,p.shield+22);
     this.heritage.vfx.nova(p.x,p.y,110,'cyan');this.heritage.ui('upgrade');
     this.contourInfo='Потрачено 5 флюкса: щит +'+Math.round(p.shield-shieldBefore)+
      '. Повторное применение — через 120 секунд.';
     recordWorldFeedback(this,{key:'contour-pulse:'+Math.floor(this.time),kind:'industry',
      cause:'Вы потратили 5 флюкса в своём поле',
      effect:'Щит усилен на '+Math.round(p.shield-shieldBefore)+'; перезарядка 120 с',
      label:'ЗАЩИТА ВОССТАНОВЛЕНА',x:p.x,y:p.y});
    }
    this.renderMap();this.pausedRenderPending=true;return;
   }
  if(act==='contourReserve'){
   const id=b.dataset.id,base=this.world.stations.get(id);
   const result=armContourReserve(this.world,id,this.time);
   if(result.ok){
    this.contourError='';this.contourInfo='';
    this.contourFeedback={title:'Ложный маяк установлен',at:this.time,
     text:'Потрачено '+CONTOURS.reserveCost+' флюкса. Через '+CONTOURS.reserveArmSeconds+
      ' с маяк сможет один раз сорвать налёт носителя помех на станцию «'+
      (base?.title||'Узел')+'», если ПВО не справится.'};
    recordWorldFeedback(this,{key:'contour-reserve-armed:'+id+':'+Math.floor(this.time),
     kind:'industry',label:'ЛОЖНЫЙ МАЯК УСТАНОВЛЕН',
     cause:'На опорный узел доставлено '+CONTOURS.reserveCost+' флюкса',
     effect:'Через '+CONTOURS.reserveArmSeconds+' с будет готова одна защита от приказа на подавление связи',
     x:base?.x,y:base?.y});
    this.heritage.ui('upgrade');
   }else{
    this.contourError=result.reason;this.heritage.ui('cancel');
   }
   this.renderMap();this.pausedRenderPending=true;return;
  }
  if(act==='contourSortie'){
   const result=launchFluxSortie(this.world,b.dataset.id,this.time);
   if(result.ok){
    this.contourError='';this.contourInfo='';
    this.contourFeedback={title:'Наступательный рейс отправлен',at:this.time,
     text:'Потрачено '+FLUX_SORTIE.cost+' флюкса. Постановщик помех летит к «'+
      (result.target.title||'промышленному посту')+'». Если он доберётся, радиосвязь и отправка новых подкреплений прервутся на '+
      FLUX_SORTIE.duration+' с. Уже вылетевшие враги останутся в бою.'};
    recordWorldFeedback(this,{key:'flux-sortie-launch:'+Math.floor(this.time),
     kind:'industry',label:'ПОСТАНОВЩИК ПОМЕХ В ПУТИ',
     cause:'С контура вылетел оплаченный флюксом корабль',
     effect:'Цель: промышленная радиосеть; корабль можно перехватить',
     x:result.source.x,y:result.source.y});
    this.heritage.ui('upgrade');
   }else{this.contourError=result.reason;this.heritage.ui('cancel');}
   this.renderMap();this.pausedRenderPending=true;return;
  }
   if(act==='contourNode'){
    const id=b.dataset.id,node=this.world.stations.get(id);
    if(!node)return;
    this.contourSelection=id;this.contourError='';this.contourInfo='';
    this.contourFirst=null;
    this.renderMap();return;
   }
   if(act==='installModule'){this.askStationModule(b.dataset.role);return;}
   if(act==='confirmModule'){this.confirmStationModule(b.dataset.role||'');return;}
   if(act==='cancelModule'){this.cancelStationModule(b.dataset.role||'');return;}
   if(act==='cancelDeparture'){this.cancelDeparture();return;}
   if(act==='returnHangar'){this.returnToHangar();return;}
   if(act==='discardDeparture'){this.confirmDeparture();return;}
   if(act==='close'){this.dismiss();return;}
   if(act==='toggleAudio'){
    const enabled=this.toggleAudio();
    b.textContent=enabled?'🔊 Звук включён':'♫ Включить звук';
    b.setAttribute('aria-pressed',String(enabled));
    return;
   }
   if(act==='menuBack'||act==='baseBack'){this.goBackInMenu();return;}
    if(act==='baseTab'&&BASE_TABS.includes(b.dataset.role)){
     this.baseTab=b.dataset.role;this.heritage.ui('tab');this.renderDock();
     this.overlay.querySelector('.base-tabs [aria-selected="true"]')?.focus({preventScroll:true});}
   if(act==='showFieldTrial'&&this.docked?.id==='0:0'&&
    !this.fieldTrialTaken&&!this.fieldLoan){
    this.baseTab='summary';this.fieldTrialPickerOpen=!this.fieldTrialPickerOpen;
    this.heritage.ui('tab');this.renderDock();
    this.overlay.querySelector('.base-trial-picker')?.scrollIntoView({block:'nearest'});
    this.overlay.querySelector(this.fieldTrialPickerOpen?
     '.base-trial-picker [data-act="loanField"]':'[data-act="showFieldTrial"]')?.focus({preventScroll:true});
   }
   if(act==='baseContours'&&this.docked?.active){
    const region=regionAt(this.docked.x,this.docked.y);
    this.mapView='territory';this.mapViewports||={};
    this.mapViewports['region:'+region.id]={center:{x:this.docked.x,y:this.docked.y},scale:region.id==='amethyst'?.055:.049};
    focusContourRegion(this,region.id,this.docked.id);
    this.openMap();return;
   }
    if(act==='baseMap'){
     // A mission route must open the navigational chart. The player's last
     // map tab may be the territory atlas, which has no operation marker.
     this.mapView='map';
     const op=b.dataset.target==='operation'?this.operation:null;
     const returnBase=op?.phase==='return'?this.world.stations.get(op.baseId):null;
     const focus=returnBase||(op&&operationDestination(op,this.world))||
      (b.dataset.target==='contract'?this.world.stations.get(this.contract?.baseId):null);
     this.openMap(focus);return;
    }
   if(act==='operationWaypoint'&&this.operation&&this.overlay.dataset.mode==='map'){
    const op=this.operation,base=op.phase==='return'?this.world.stations.get(op.baseId):null;
    const destination=base||operationDestination(op,this.world);
    if(!Number.isFinite(destination?.x)||!Number.isFinite(destination?.y))return;
    const waypoint={id:op.id,x:destination.x,y:destination.y,
     label:base?'Сдать операцию: '+(baseNames[base.type]||'станция'):
      op.id===PROBE_OPERATION.id&&op.located===false?'Район поиска зонда':'Операция: '+op.name};
    this.setNavigationCourse(waypoint,'Курс проложен: '+waypoint.label);
    return;
   }
   if(act==='toggleMeteorDefense'&&this.docked?.active){
    const base=this.docked;
    const linked=defenseLinked(base,this.world.networkTopology());
    const defense=ensureStationDefense(base,linked,this.time);
    defense.meteorEnabled=!defense.meteorEnabled;
    this.heritage.ui('tab');
    this.renderDock();
    this.overlay.querySelector('[data-act="toggleMeteorDefense"]')?.focus({preventScroll:true});
    return;
   }
    if(act==='abandonOperation')this.abandonOperation();
   if(act==='skill')this.buySkill(b.dataset.id);
   if(act==='doctrine')this.buyDoctrine(b.dataset.id);
    if(act==='waypoint')this.selectWaypoint(b.dataset);
    if(act==='abandonContract')this.abandonContract();
    if(['loanField','returnField','fieldCharge','loanIon','returnIon'].includes(act)){
     this.baseAction(act,b.dataset.role||'');return;
    }
   if(act==='acceptOperation'||act==='acceptFieldOperation'||act==='claimFieldOperation'||act==='claimProbeData'||act==='activate'||act==='upgrade'||act==='hire'||act==='repair'||act==='repairDrones'||act==='supply'||act==='service'||act==='respec'||act==='transfer'||act==='acceptContract'||act==='claimContract'||act==='claimFirstModule'||act==='installModule'||act==='antenna')
    this.baseAction(act,b.dataset.role||'');
   if(act==='restart'){this.runStore?.end();location.reload();}
  });
  this.overlay.addEventListener('wheel',e=>{
   if(this.overlay.dataset.mode!=='map'||!e.target.closest?.('svg[data-map-world]'))return;
   e.preventDefault();
   const pixel=pointerOnMap(e.target.closest('svg[data-map-world]'),e.clientX,e.clientY);
   if(insideMap(pixel))this.zoomMapAt(Math.max(.7,Math.min(1.45,
    Math.exp(-e.deltaY*(e.deltaMode===1?.045:.0018)))),pixel);
  },{passive:false});
  this.overlay.addEventListener('contextmenu',e=>{
   const svg=e.target.closest?.('svg[data-map-world]');
   if(this.overlay.dataset.mode!=='map'||!svg)return;
   e.preventDefault();
   this.setMapWaypoint(pointerOnMap(svg,e.clientX,e.clientY));
  });
  this.overlay.addEventListener('pointerdown',e=>{
   if(this.overlay.dataset.mode!=='map'||e.button!==0||!e.target.closest?.('svg[data-map-world]'))return;
   this.mapPointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,dragging:false});
   if(this.mapPointers.size>1)this.mapDraggedUntil=Date.now()+200;
  });
  window.addEventListener('pointermove',e=>{
   const current=this.mapPointers.get(e.pointerId);
   if(!current||this.overlay.dataset.mode!=='map')return;
   const svg=this.overlay.querySelector('svg[data-map-world]');if(!svg)return;
   const before=[...this.mapPointers.values()].map(p=>({x:p.x,y:p.y}));
   const moved=Math.hypot(e.clientX-current.startX,e.clientY-current.startY);
   if(moved>7&&!current.dragging){
    current.dragging=true;this.mapDraggedUntil=Date.now()+250;
    try{this.overlay.setPointerCapture(e.pointerId);}catch{}
   }
   const previous={x:current.x,y:current.y};
   current.x=e.clientX;current.y=e.clientY;
   if(!current.dragging&&this.mapPointers.size<2)return;
   if(this.mapPointers.size>=2){
    this.mapDraggedUntil=Date.now()+250;
    for(const pointer of this.mapPointers.values())pointer.dragging=true;
   }
   e.preventDefault();
   const oldPixel=pointerOnMap(svg,previous.x,previous.y);
   const newPixel=pointerOnMap(svg,e.clientX,e.clientY);
   if(!oldPixel||!newPixel)return;
   let view=mapViewport(this);
   if(this.mapPointers.size>=2){
    const after=[...this.mapPointers.values()].slice(0,2);
    const prev=before.slice(0,2);
    const oldDistance=Math.hypot(prev[0].x-prev[1].x,prev[0].y-prev[1].y);
    const newDistance=Math.hypot(after[0].x-after[1].x,after[0].y-after[1].y);
    const midpoint={x:(prev[0].x+prev[1].x)/2,y:(prev[0].y+prev[1].y)/2};
    const pixel=pointerOnMap(svg,midpoint.x,midpoint.y);
    if(insideMap(pixel)&&oldDistance>12&&newDistance>12)
     view=zoomMap(view,pixel,newDistance/oldDistance,mapViewSpec(this).limits);
    const newMidpoint=pointerOnMap(svg,(after[0].x+after[1].x)/2,(after[0].y+after[1].y)/2);
    if(pixel&&newMidpoint)view=panMap(view,{x:newMidpoint.x-pixel.x,y:newMidpoint.y-pixel.y});
   }else view=panMap(view,{x:newPixel.x-oldPixel.x,y:newPixel.y-oldPixel.y});
   this.mapViewports[view.key]={center:view.center,scale:view.scale};
   if(Date.now()-this.lastMapPanRender>35){
    this.lastMapPanRender=Date.now();this.renderMap();
   }
  },{passive:false});
  const releaseMapPointer=e=>{
   if(!this.mapPointers.has(e.pointerId))return;
   const moved=this.mapPointers.get(e.pointerId).dragging;
   this.mapPointers.delete(e.pointerId);
   if(moved){this.mapDraggedUntil=Date.now()+200;this.renderMap();}
  };
  window.addEventListener('pointerup',releaseMapPointer);
  window.addEventListener('pointercancel',releaseMapPointer);
  this.overlay.addEventListener('keydown',e=>{
   if(e.target.matches?.('.contour-node,.contour-region')&&(e.key==='Enter'||e.key===' ')){
    e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));return;
   }
   const secondary=e.target.closest('.hg-view-nav button,.hg-weapon-views button,.skill-branch-tabs button,.map-view-switch button');
   if(secondary&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
    const buttons=[...secondary.parentElement.querySelectorAll('button')],current=buttons.indexOf(secondary);
    const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:
     (current+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    e.preventDefault();buttons[next].click();return;
   }
   const button=e.target.closest('.base-tabs button[role="tab"]');
   if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
   const tabs=BASE_TABS;
   const current=tabs.indexOf(button.dataset.role);
   const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:
    (current+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
   e.preventDefault();this.baseTab=tabs[next];this.heritage.ui('tab');this.renderDock();
   this.overlay.querySelector('.base-tabs [aria-selected="true"]')?.focus({preventScroll:true});
  });
  $('audioBtn').onclick=()=>this.toggleAudio();
  const quickAudio=$('quickAudio');if(quickAudio)quickAudio.onclick=()=>this.toggleAudio();
  const credits = $('creditsDialog'), creditsButton = $('audioCredits');
  if (credits && creditsButton) {
   creditsButton.addEventListener('click', () => {
    if (credits.open) return;
    this._creditsRestore={paused:this.paused,modal:this.heritage.modal};
    this.paused=true;this.pausedRenderPending=true;
    this.heritage.pause('credits');
    credits.showModal();
    $('creditsClose')?.focus({preventScroll:true});
   });
   credits.addEventListener('close', () => {
    const prior=this._creditsRestore;
    if (!prior) return;
    this._creditsRestore=null;
    this.paused=prior.paused;
    this.pausedRenderPending=true;
    if(prior.paused)this.heritage.pause(prior.modal || 'map');
    else this.heritage.resume();
    creditsButton.focus({preventScroll:true});
   });
   credits.addEventListener('keydown',e=>e.stopPropagation());
   credits.addEventListener('click',e=>{if(e.target===credits)credits.close();});
  }
  for(const control of document.querySelectorAll('[data-audio-channel]')){
   const channel=control.dataset.audioChannel;
   control.value=String(Math.round(this.heritage.settings[channel]*100));
   control.addEventListener('input',()=>{
    this.heritage.setVolume(channel,Number(control.value)/100);
    const output=document.querySelector('[data-audio-value="'+channel+'"]');
    if(output)output.textContent=control.value+'%';
   });
   control.addEventListener('change',()=>this.heritage.ui('slider'));
   const output=document.querySelector('[data-audio-value="'+channel+'"]');
   if(output)output.textContent=control.value+'%';
  }
  $('skillBtn').onclick=()=>this.skills();
   const mapButton=$('mapBtn');if(mapButton)mapButton.onclick=()=>this.openMap();
  $('quietBtn').onclick=()=>this.toggleHoldFire();
  $('hackBtn').onclick=()=>this.hack();
   const ionButton=$('ionBtn');if(ionButton)ionButton.onclick=()=>this.callFieldWeapon();
   const heavyButton=$('heavyBtn');if(heavyButton)heavyButton.onclick=()=>this.callHowitzer();
   const railButton=$('precisionBtn');if(railButton)railButton.onclick=()=>this.toggleManualRail();
   const strikeButton=$('strikeBtn');if(strikeButton)strikeButton.onclick=()=>this.callStrike();
   const mineButton=$('minefieldBtn');if(mineButton)mineButton.onclick=()=>{
    this.mobileMineArmed=!this.mobileMineArmed;
    this.notice(this.mobileMineArmed?'МИНЫ · коснитесь места установки и отпустите палец':'МИНЫ · выбор отменён',2.5);
    this.syncControlUI();
   };
  $('burstBtn').onclick=()=>this.startBurst();
  const actionButton=$('actionBtn');
  if(actionButton){
   actionButton.addEventListener('pointerdown',e=>{
    if(actionButton.disabled)return;
    actionButton.setPointerCapture(e.pointerId);
    this.beginInteraction('touch');e.preventDefault();
   });
   const stopAction=()=>this.endInteraction('touch');
   actionButton.addEventListener('pointerup',stopAction);
   actionButton.addEventListener('pointercancel',stopAction);
   actionButton.addEventListener('lostpointercapture',stopAction);
  }
  const pad=$('stick');let active=null;
  const pointer=e=>{
   const r=pad.getBoundingClientRect();const dx=e.clientX-(r.left+r.width/2);
   const dy=e.clientY-(r.top+r.height/2);const m=Math.hypot(dx,dy);
   const n=Math.max(1,m);const k=Math.min(1,m/(r.width*.34));
   this.touch.x=dx/n*k;this.touch.y=dy/n*k;
   $('knob').style.transform='translate('+this.touch.x*35+'px,'+this.touch.y*35+'px)';
  };
  pad.addEventListener('pointerdown',e=>{active=e.pointerId;pad.setPointerCapture(active);pointer(e);});
  pad.addEventListener('pointermove',e=>{if(e.pointerId===active)pointer(e);});
  const release=e=>{if(e.pointerId!==active)return;active=null;this.touch.x=0;this.touch.y=0;$('knob').style.transform='';};
  pad.addEventListener('pointerup',release);pad.addEventListener('pointercancel',release);
  // A held mouse button previews the actual blast/mine area; releasing fires.
  // The ship keeps moving while aiming. An equipped rail/howitzer is still
  // available on LMB by cycling manual weapons with the mouse wheel.
  const worldAt=(x,y)=>{
   const rect=this.canvas.getBoundingClientRect(),cam=this.camera();
   return rect.width&&rect.height?{x:cam.x+(x-rect.left)/rect.width*cam.w,
    y:cam.y+(y-rect.top)/rect.height*cam.h}:null;
  };
  let aimStart=null,longPressTimer=null;
  const cancelLongPress=()=>{if(longPressTimer!==null){clearTimeout(longPressTimer);longPressTimer=null;}};
  this.canvas?.addEventListener('pointerdown',e=>{
   if(this.paused||this.dead||!this.overlay.hidden||aimStart)return;
   this.tacticalPointer={x:e.clientX,y:e.clientY};
   if(e.button!==0&&e.button!==2)return;
   // An optional Ctrl+LMB click restores manual priority without changing
   // the everyday comet / mine buttons or consuming their cooldowns.
   const weapon=selectedManual(this.selectedManualWeapon,this.manualWeaponsHere());
   const {kind,mark}=pointerWeaponAction(e,weapon,this.mobileMineArmed);
   if(kind){
    const ready=canAimMouseWeapon(this,kind);
    if(!ready.ok){this.notice(ready.reason,1.5);e.preventDefault();return;}
   }
   aimStart={id:e.pointerId,x:e.clientX,y:e.clientY,kind,button:e.button,mark};
   const point=worldAt(e.clientX,e.clientY);
   if(kind&&point)this.mouseAim={kind,point,clientX:e.clientX,clientY:e.clientY};
   try{this.canvas.setPointerCapture?.(e.pointerId);}catch{}
   if(e.button===2||mark)e.preventDefault();
   // On touch, a manual rail uses a tap to shoot. Holding a target always
   // remains an available way to designate it for automatic weapons.
   if(!kind&&e.pointerType==='touch'&&this.manualRailMode){
    cancelLongPress();
    const pointerId=e.pointerId;
    longPressTimer=setTimeout(()=>{
     longPressTimer=null;
     if(!aimStart||aimStart.id!==pointerId||this.paused||this.dead)return;
     aimStart.longPress=true;
     const point=worldAt(aimStart.x,aimStart.y);
     if(point)this.designateTargetAt(point);
    },460);
   }
  });
  this.canvas?.addEventListener('pointermove',e=>{
   if(e.pointerType==='mouse')this.tacticalPointer={x:e.clientX,y:e.clientY};
   if(!aimStart||e.pointerId!==aimStart.id)return;
   if(aimStart.kind){
    const point=worldAt(e.clientX,e.clientY);
    if(point)this.mouseAim={kind:aimStart.kind,point,clientX:e.clientX,clientY:e.clientY};
   }else if(Math.hypot(e.clientX-aimStart.x,e.clientY-aimStart.y)>14)cancelLongPress();
  });
  this.canvas?.addEventListener('contextmenu',e=>e.preventDefault());
  this.canvas?.addEventListener('pointerup',e=>{
   if(!aimStart||e.pointerId!==aimStart.id)return;
   cancelLongPress();
   const moved=Math.hypot(e.clientX-aimStart.x,e.clientY-aimStart.y);
   const held=!!aimStart.longPress,kind=aimStart.kind,mark=aimStart.mark;
   aimStart=null;this.mouseAim=null;
   if(this.paused||this.dead||!this.overlay.hidden)return;
   const worldPoint=worldAt(e.clientX,e.clientY);if(!worldPoint)return;
   if(mark){if(!held&&moved<=14)this.designateTargetAt(worldPoint);return;}
   if(kind){this.fireActiveMouseWeapon(kind,worldPoint);
    if(e.pointerType==='touch')this.mobileMineArmed=false;
    return;
   }
   if(held||moved>14)return;
   this.fireSelectedManualAt(worldPoint);
  });
  this.canvas?.addEventListener('wheel',e=>{
   if(this.dead||this.paused||!this.overlay.hidden||this.mouseAim||!this.manualWeaponsHere().length)return;
   // Without multiple manual mounts the wheel remains free for the page.
   if(this.manualWeaponsHere().length<2)return;
   e.preventDefault();this.switchManualWeapon(e.deltaY>0?1:-1);
  },{passive:false});
  const cancelAim=()=>{cancelLongPress();aimStart=null;this.mouseAim=null;};
  this.canvas?.addEventListener('pointercancel',cancelAim);
  window.addEventListener?.('blur',cancelAim);
  document.addEventListener?.('visibilitychange',()=>{if(document.hidden)cancelAim();});
 }
 designateTargetAt(worldPoint){
   const rect=this.canvas.getBoundingClientRect(),cam=this.camera();
   const item=pickDesignatedTarget(this,worldPoint,Math.max(55,46*cam.w/Math.max(1,rect.width)));
   if(item){
    this.designatedTarget={target:item.target,expiresAt:this.time+3.5};
   this.heritage?.play?.('targetMark',.2,item.target);
    const parasite=!!this.skillRanks.parasite;
    const mode=parasite?parasiteTargetMode(this):'guard';
    const active=this.enemies.some(e=>e.parasiteCapture&&e.hp>0);
    const action=parasite&&mode!=='guard'&&this.fieldEvolution?.charge===0?' Для паразита требуется энергоядро.':
     mode==='capture'&&active?' Захват пока занят: ваш союзник ещё действует.':
     mode==='capture'&&this.fieldEvolution.captureReadyAt>this.time?' Захват восстановится через '+Math.ceil(this.fieldEvolution.captureReadyAt-this.time)+' с.':
     mode==='capture'?' Добейте врага лично для захвата (1 ядро).':
     mode==='signal'?' Попадите по врагу с достаточной прочностью для разведки (1 ядро).':'';
    if(this.time-this.lastTargetHintAt>2.5||action){
     this.lastTargetHintAt=this.time;
     this.notice('МЕТКА · '+designationLabel(item)+'.'+action,3.2);
    }
   }else if(this.time-this.lastTargetHintAt>3){
    this.lastTargetHintAt=this.time;
    this.designatedTarget=null;
    this.notice('Для метки нет цели. Наведите курсор на противника и нажмите Ctrl + ЛКМ.',3.2);
   }else{
    this.designatedTarget=null;
   }
 }
 notice(text,seconds=3){this.message.textContent=text;this.messageUntil=this.time+seconds;}
 rewardNotice(text,previousLevel,seconds=5){
  // The level-up notification is otherwise overwritten by the operation's
  // completion message in the same frame. Keep both results in one notice.
  if(this.player.level>previousLevel){
   text+=' Новый уровень: '+this.player.level+'! '+(this.isTouchLayout?
    'Откройте «Развитие» в меню.':'Навыки пилота — '+this.controlLabel('skills')+'.');
  }
  this.notice(text,seconds);
 }
 toggleAudio(){
  const enabled=this.heritage.toggleSound();
  $('audioBtn').textContent=enabled?'🔊 Звук включён':'♫ Начать со звуком';
  $('audioBtn').setAttribute('aria-pressed',String(enabled));
  const quick=$('quickAudio');if(quick){quick.textContent=enabled?'♫':'♪';quick.setAttribute('aria-pressed',String(enabled));quick.setAttribute('aria-label',enabled?'Выключить звук':'Включить звук');}
  if(enabled)void this.heritage.announceSoundEnabled();
  this.notice(enabled?'Звук и музыка включены':'Звук и музыка выключены',2.3);
  return enabled;
 }
 startBurst(){
   const p=this.player;
   if(this.dead||this.paused||p.burstCooldown>0)return false;
   let dx=Number(isPressed(this.keys,this.controls,'right')||this.keys.has('ArrowRight'))-
     Number(isPressed(this.keys,this.controls,'left')||this.keys.has('ArrowLeft'))+this.touch.x;
   let dy=Number(isPressed(this.keys,this.controls,'down')||this.keys.has('ArrowDown'))-
     Number(isPressed(this.keys,this.controls,'up')||this.keys.has('ArrowUp'))+this.touch.y;
   let m=length(dx,dy);
   if(m<.1){dx=p.vx;dy=p.vy;m=length(dx,dy);}
   if(m<.1){dx=Math.sin(p.angle);dy=-Math.cos(p.angle);m=1;}
   p.burstX=dx/m;p.burstY=dy/m;
   const stats=burstStats(this.skillRanks.engine);
   p.burstRemaining=stats.duration;
   p.burstCooldown=stats.cooldown;
   this.heritage.vfx.engineTrail(p.x,p.y,p.angle,'fighter',true,.12);
   this.heritage.play('boost',.6,{x:p.x,y:p.y});
   return true;
  }
  presentMenu(preferred=''){
   attachMenuAccess(this.overlay);menuHints(this.overlay);
   if(typeof document!=='undefined'&&!this.menuFocusOrigin&&
    !this.overlay.contains?.(document.activeElement))
    this.menuFocusOrigin=document.activeElement;
   setMenuBackgroundInert(this.overlay,true);
   if(typeof document!=='undefined'&&document.getElementById?.('mobileLaunch')?.hidden===false)return;
   focusMenu(this.overlay,preferred);
  }
  releaseMenu(){
   setMenuBackgroundInert(this.overlay,false);
   const previous=this.menuFocusOrigin;
   this.menuFocusOrigin=null;
   if(typeof document==='undefined')return;
   const target=previous&&previous!==document.body&&previous.isConnected?previous:this.canvas;
   target?.focus?.({preventScroll:true});
  }
  // Keep the view and the focused control of the screen that opened this one.
  // The pause dialog may sit over any of these screens.
  enterMenu(mode,fromPause=''){
   const previous=this.overlay.hidden?null:this.overlay.dataset.mode;
   if(previous===mode&&!fromPause)return;
   const trail=this.menuTrail??=[];
   if(!previous&&!fromPause){trail.length=0;return;}
   const revisit=trail.findIndex(entry=>entry.mode===mode);
   if(revisit>=0){trail.splice(revisit);return;}
   if(previous==='base')this.rememberDockView();
   trail.push({mode:previous,fromPause,focus:captureMenuControl(this.overlay),
    scroll:this.overlay.querySelector('.dialog')?.scrollTop||0,
    baseTab:this.baseTab,hangarView:this.hangarView,mapView:this.mapView,skillBranch:this.skillBranch});
  }
  menuBackLabel(){
   const entry=this.menuTrail?.at(-1);
   if(entry?.fromPause)return 'К паузе';
   return menuReturnLabels[entry?.mode]||'';
  }
  goBackInMenu(){
   if(this.overlay.querySelector('.run-confirm'))return this.cancelRunAction();
   if(this.overlay.querySelector('.departure-confirm'))return this.cancelDeparture();
   if(this.pendingStationModule)return this.cancelStationModule(this.pendingStationModule.role);
   const mode=this.overlay.dataset.mode;
   if(['run-start','death'].includes(mode))return;
   const previous=this.menuTrail?.pop();
   if(previous){
    this.mapReturnToBase=false;
    if(!previous.mode){
     this.overlay.hidden=true;
     this.paused=false;
     this.releaseMenu();
    }else{
     this.overlay.dataset.mode=previous.mode;
     this.heritage.pause(previous.mode);
     this.skillBranch=previous.skillBranch;
     if(previous.mode==='base'){
      this.baseTab=previous.baseTab;
      this.hangarView=previous.hangarView;
      this.renderDock();
     }else if(previous.mode==='map'){
      this.mapView=previous.mapView;
      this.mapReturnToBase=!!this.docked&&this.stationExitArmed;
      this.renderMap();
     }else if(previous.mode==='skills')this.renderSkills();
     else if(previous.mode==='evolution')this.renderEvolution();
     const panel=this.overlay.querySelector('.dialog');
     if(panel)panel.scrollTop=previous.scroll;
     if(previous.focus)restoreMenuControl(this.overlay,previous.focus);
    }
    if(previous.fromPause){
     openSystemMenu(this);
     document.getElementById(previous.fromPause)?.focus({preventScroll:true});
    }
    return;
   }
   if(this.stationExitArmed&&this.docked){
    if(mode!=='base')return this.returnToStation();
    if(this.baseTab==='hangar'&&this.hangarView==='weapon-upgrades'){
     this.hangarAction({act:'hgView',id:'weapons'});
     return;
    }
    if(this.baseTab!=='summary'){
     this.baseTab='summary';
     this.renderDock();
     return;
    }
    return openSystemMenu(this);
   }
   return this.dismiss();
  }
  askDepartureConfirmation(){
   if(this.overlay.querySelector('.departure-confirm'))return;
   const dialog=this.overlay.querySelector('.dialog');
   if(!dialog)return;
   this.departureFocus=captureMenuControl(this.overlay);
   dialog.inert=true;
   this.overlay.insertAdjacentHTML('beforeend',
    '<section class="departure-confirm" role="alertdialog" aria-modal="true" '+
    'aria-labelledby="departure-title" aria-describedby="departure-description">'+
    '<span class="departure-kicker">АНГАР · НЕЗАВЕРШЁННАЯ ПОДГОТОВКА</span>'+
    '<h2 id="departure-title">Схема не применена</h2>'+
    '<p id="departure-description">Загруженная схема ещё не применена. '+
    'Если вылететь сейчас, корабль сохранит прежнее вооружение, а новые настройки пропадут. '+
    'Сплав за предварительную сборку не списан.</p>'+
    '<div class="departure-actions">'+
    '<button type="button" data-act="returnHangar" class="departure-primary">Вернуться к сборке</button>'+
    '<button type="button" data-act="cancelDeparture">Остаться здесь</button>'+
    '<button type="button" data-act="discardDeparture" class="departure-discard">Вылететь без изменений</button>'+
    '</div></section>');
   focusMenu(this.overlay,'[data-act="returnHangar"]');
  }
  cancelDeparture(){
   this.overlay.querySelector('.departure-confirm')?.remove();
   const dialog=this.overlay.querySelector('.dialog');
   if(dialog)dialog.inert=false;
   restoreMenuControl(this.overlay,this.departureFocus,'[data-act="close"]');
   this.departureFocus=null;
  }
  returnToHangar(){
   this.cancelDeparture();
   if(!this.docked)return;
   this.menuTrail=[];
   this.baseTab='hangar';this.hangarView='weapons';this.mapReturnToBase=false;
   this.overlay.dataset.mode='base';this.heritage.pause('base');this.renderDock();
   focusMenu(this.overlay,'[data-act="hgReset"]:not([disabled])');
   this.revealLoadoutApply();
  }
  confirmDeparture(){
   if(!this.overlay.querySelector?.('.departure-confirm'))return false;
   return this.dismiss(true);
  }
 showOpeningChoice(){
  if(this.openingArc?.status!=='offer'||!this.overlay.hidden||this.paused||this.dead)return;
  this.paused=true;this.pausedRenderPending=true;
  this.overlay.dataset.mode='opening-choice';this.overlay.hidden=false;
  this.heritage.pause('map');
  this.overlay.innerHTML=renderOpeningSignals(this.controlLabel('interact'));
  this.presentMenu('[data-act="openingPick"]');
 }
 skipOpeningRoute(){
  if(this.overlay.dataset.mode!=='opening-choice')return;
  this.openingArc.status='skipped';this.dismiss();
  this.notice('Сигналы пропущены. Все обычные задания и операции доступны.',4);
 }
 chooseOpeningRoute(kind){
  if(this.overlay.dataset.mode!=='opening-choice'||
   !beginOpeningArc(this.openingArc,kind,this.time))return;
  const arc=this.openingArc;
  arc.returnWaypoint=this.waypoint?.id&&Number.isFinite(this.waypoint.x)&&
   Number.isFinite(this.waypoint.y)?{...this.waypoint}:null;
  if(kind==='intercept'){
   const spec=ENEMY_TYPES.fighter,serial=++this.enemySerial;
   const group=++this.groupSerial;
   const commander={serial,group,type:'fighter',
    x:arc.interceptX,y:arc.interceptY,vx:0,vy:0,r:18,
    hp:Math.max(100,spec.hp*1.8),maxHp:Math.max(100,spec.hp*1.8),
    damage:spec.dmg,think:.2,fire:1.1,state:'hunt',commitUntil:0,
    target:this.player,angle:0,hit:0,expAwarded:false,scenario:'opening-intercept',
    protect:null,openingCommander:true,missionStructure:true,entryPortalPending:false};
   this.enemies.push(commander);
   for(const offset of [-1,1]){
    const scout=ENEMY_TYPES.scout;
    this.enemies.push({serial:++this.enemySerial,group,type:'scout',
     x:arc.interceptX+offset*78,y:arc.interceptY+offset*64,vx:0,vy:0,r:14,
     hp:scout.hp,maxHp:scout.hp,damage:scout.dmg,think:.15,fire:1.3,
     state:'hunt',commitUntil:0,target:this.player,angle:0,hit:0,
     expAwarded:false,scenario:'opening-escort',protect:commander,
     entryPortalPending:false});
   }
   arc.commanderSerial=serial;
  }
  this.waypoint={id:'opening-'+kind,
   x:kind==='intercept'?arc.interceptX:arc.rescueX,
   y:kind==='intercept'?arc.interceptY:arc.rescueY,
   label:kind==='intercept'?'Вражеский наводчик':'Аварийная капсула'};
  this.dismiss();
  this.notice(kind==='intercept'?
   'Наводчик с охраной держит дистанцию. Сближайтесь рывком ('+this.controlLabel('dash')+'); зажмите ЛКМ и выпустите «Голубую комету» по траектории его полёта.':
   'Капсула отмечена. Удерживайте '+(this.isTouchLayout?'«Действие»':this.controlLabel('interact'))+
    ' рядом: прогресс сохраняется после паузы, а на половине работы сработает её защитный импульс.',6);
 }
 showOpeningReward(){
  if(this.firstHardwareReward!=='pending'||!this.overlay.hidden||this.dead)return;
  this.paused=true;this.pausedRenderPending=true;
  this.overlay.dataset.mode='opening-reward';this.overlay.hidden=false;
  this.heritage.pause('base');
  this.overlay.innerHTML=renderOpeningHardware(this.shipLoadout);
  this.presentMenu('[data-act="openingReward"]');
 }
 claimOpeningReward(id){
  if(this.overlay.dataset.mode!=='opening-reward')return;
  const preserveDraft=!!this.hangarSession?.dirty?.(this.shipLoadout);
  const reward=claimFirstContractModule(this.shipLoadout,this.firstHardwareReward,id,{preserveDraft});
  if(!reward.ok){this.notice(reward.reason,3);return;}
  this.shipLoadout=reward.loadout;this.firstHardwareReward=reward.status;
  if(this.lastContractReceipt){
   this.lastContractReceipt.firstHardwareReward=id;
   this.lastContractReceipt.firstHardwareInstalled=reward.installed;
  }
  if(!preserveDraft)this.hangarSession?.begin(this.shipLoadout);
  this.syncShipLoadout();this.dismiss();
  this.heritage.ui('upgrade');
  const criticalHull=this.player?.maxHp>0&&this.player.hp/this.player.maxHp<.45;
  this.notice(reward.installed?
   'ОРУЖИЕ УСТАНОВЛЕНО: '+MODULES[id].name+'. '+
    (criticalHull?'Корпус повреждён — возвращайтесь к доку для ремонта!':
     'Попробуйте его в следующем бою!'):
   'Орудие на складе. Освободите узел в ангаре и примените сборку.',6);
 }
 updateOpeningArc(dt){
  const arc=this.openingArc;
  if(!arc||this.visuals.capitalDamageQA)return;
  if(arc.status==='offer'){
   if(this.time>130){arc.status='skipped';return;}
   // Do not interrupt a contract the pilot already chose in the station.
   // The crisis can be offered later, while there is still time to respond.
   if(this.time>=OPENING_ARC.offerAt&&!this.operation&&!this.contract&&
     Math.hypot(this.player.x-this.world.home.x,this.player.y-this.world.home.y)<2200)
    this.showOpeningChoice();
   return;
  }
  if(!openingArcActive(arc))return;
  if(arc.kind==='intercept'&&!arc.commanderDefeated&&this.waypoint?.id==='opening-intercept'){
   // The leader actively hunts the player. The arrow must follow the ship,
   // rather than forever pointing at its original spawn coordinates.
   const leader=this.enemies.find(e=>e.serial===arc.commanderSerial&&e.hp>0&&!e.converted);
   if(leader){this.waypoint.x=leader.x;this.waypoint.y=leader.y;}
  }
  const near=arc.kind==='rescue'&&
   Math.hypot(this.player.x-arc.rescueX,this.player.y-arc.rescueY)<=OPENING_ARC.repairRange;
  const hadPulse=!!arc.rescuePulseUsed;
  const result=advanceOpeningArc(arc,this.time,dt,{
   commanderDefeated:arc.commanderDefeated===true,
   repairing:!!this.openingRepairing,withinRange:near});
  if(!hadPulse&&arc.rescuePulseUsed&&result!=='failed'){
   // One visible mid-task gain: the capsule can shield the pilot once and
   // disrupt nearby hostile projectiles, but cannot defeat pursuing ships.
   this.player.shield=Math.max(this.player.shield,OPENING_ARC.rescuePulseShield);
   for(const shot of this.shots||[])if(shot.alive&&
    Math.hypot(shot.x-arc.rescueX,shot.y-arc.rescueY)<=OPENING_ARC.rescuePulseRadius)
    shot.alive=false;
   this.heritage?.vfx?.nova?.(arc.rescueX,arc.rescueY,OPENING_ARC.rescuePulseRadius,'green');
   this.heritage?.play?.('hack',.5,{x:arc.rescueX,y:arc.rescueY});
   this.notice('Защитный импульс капсулы: щит не ниже '+OPENING_ARC.rescuePulseShield+
    ', ближайшие снаряды погашены. Можно отбиться и продолжить спасение.',4.5);
  }
  if(result==='failed'){
   if(this.waypoint?.id==='opening-'+arc.kind)this.waypoint=arc.returnWaypoint;
   this.notice('Срочный сигнал потерян. Забег продолжается; обычные операции доступны.',5);
   return;
  }
  if(!result.endsWith('-complete'))return;
  const previousLevel=this.player.level;
  this.endInteraction();
  if(this.waypoint?.id==='opening-'+arc.kind)this.waypoint=arc.returnWaypoint;
  if(arc.kind==='intercept'){
   this.player.ore+=OPENING_ARC.interceptRewardOre;
   recordSortieIncome(this,'ore','operation',OPENING_ARC.interceptRewardOre);
   this.cockpit.resourceGain(OPENING_ARC.interceptRewardOre,this.time);
   this.collect({type:'data',value:OPENING_ARC.interceptRewardData,source:'operation'});
   this.spawnClock=Math.max(this.spawnClock,15);
   this.rewardNotice('Наводчик уничтожен: патрули у дока стали реже на 2 минуты. '+
    '+'+OPENING_ARC.interceptRewardData+' данных и опыта!',previousLevel,6);
  }else{
   this.player.ore+=OPENING_ARC.rescueRewardOre;
   recordSortieIncome(this,'ore','operation',OPENING_ARC.rescueRewardOre);
   this.cockpit.resourceGain(OPENING_ARC.rescueRewardOre,this.time);
   this.player.shield=Math.max(this.player.shield,OPENING_ARC.rescueShield);
   this.awardExperience(OPENING_ARC.rescueRewardXp);
   this.spawnClock=Math.max(this.spawnClock,9);
   if(!this.waypoint&&this.player.hp/this.player.maxHp<.45){
    const dock=this.world.home;
    this.waypoint={id:dock.id,x:dock.x,y:dock.y,label:'Вернуться на ремонт'};
   }
   this.rewardNotice('Эвакуация завершена: +'+OPENING_ARC.rescueRewardOre+
    ' сплава, +'+OPENING_ARC.rescueRewardXp+
    ' опыта и аварийный щит. Враг получил сигнал: патрули участятся.',previousLevel,6);
  }
  if(this.firstHardwareReward==null)this.firstHardwareReward='pending';
  this.showOpeningReward();
 }
  dismiss(discardDraft=false){
   if(!this.overlay.hidden&&['run-start','death'].includes(this.overlay.dataset.mode))return false;
   if(!this.overlay.hidden&&this.overlay.dataset.mode==='opening-choice'&&
      this.openingArc?.status==='offer')this.openingArc.status='skipped';
   if(!discardDraft&&!this.overlay.hidden&&this.docked&&this.stationExitArmed&&
    typeof this.hangarSession?.dirty==='function'&&this.hangarSession.dirty(this.shipLoadout)){
    this.askDepartureConfirmation();return false;
   }
   this.overlay.querySelector?.('.departure-confirm')?.remove();
   this.departureFocus=null;
   const dialog=this.overlay.querySelector?.('.dialog');if(dialog)dialog.inert=false;
   if(discardDraft)this.hangarSession?.begin(this.shipLoadout);
   this.pendingStationModule=null;
   // A player can depart directly, through the map or through another panel.
   // The station arms one departure until the overlay actually closes; maps
   // opened later during a flight must not reset that flight's baseline.
   if(!this.overlay.hidden&&this.docked&&
    (this.stationExitArmed||this.overlay.dataset.mode==='base'))
    this.sortieStart=startSortie(this);
   if(this.sortieStart)this.lastContractReceipt=null;
   this.stationExitArmed=false;
   const plan=(this.manualWaypoint||this.waypoint)?.conflictPlan;
   if(plan&&this.world.regionalSupply?.central?.conflict)
    this.world.regionalSupply.central.conflict.plan=plan;
   this.saveAtStation();
   this.endInteraction();
   if(!this.overlay.hidden)this.heritage.ui('close');
   resumeContourTransition(this);
   this.overlay.hidden=true;this.paused=false;this.mapReturnToBase=false;this.menuTrail=[];this.heritage.resume();
   this.releaseMenu();
   this.canvas?.focus?.({preventScroll:true});
   return true;
  }
  abandonOperation(){
   if(!this.operation||this.dead)return;
   const op=this.operation,operationId=op.id;
   finishFieldAssignment(this.fieldLoan,'operation',this.operation);
   if(isFieldOperation(op)){
    const base=this.world.stations.get(op.baseId);
    if(base){base.fieldMission=null;base.fieldOperationCooldowns??={};
     base.fieldOperationCooldowns[op.id]=this.time+40;}
    this.enemies=this.enemies.filter(e=>e.fieldOperation!==op.id);
    this.operation=null;
    if(isOperationWaypoint(this.waypoint,op))this.waypoint=null;
    this.heritage.ui('cancel');
    this.notice('Операция «'+op.name+'» отменена. Следующая попытка доступна на станции через 40 секунд.',4);
    if(this.overlay.dataset.mode==='map')this.renderMap();
    else if(this.overlay.dataset.mode==='base')this.renderDock();
    return;
   }
   const preservingCarrierReturn=operationId===CARRIER_INTERCEPTION.id&&this.operation.phase==='return';
   if(operationId===RELAY_DEFENSE.id){
    const base=this.world.stations.get(this.operation.baseId);
    if(base){
     base.relayMission=null;
     if(this.operation.phase!=='approach'){
      base.relayRetryAt=this.time+RELAY_DEFENSE.retryDelay;
      base.relayAttempts=(base.relayAttempts||0)+1;
     }
    }
    this.enemies=this.enemies.filter(e=>e.relayAssault!==this.operation.baseId);
   }
   if(operationId===CARRIER_INTERCEPTION.id){
    const base=this.world.stations.get(this.operation.baseId);
    if(base&&this.operation.phase!=='return')base.carrierMission=null;
    this.enemies=this.enemies.filter(e=>!e.interceptCargo&&e.carrierEscort!==this.operation.baseId);
   }
   this.operation=null;this.probeRepairing=false;
   if(isOperationWaypoint(this.waypoint,op))this.waypoint=null;
   this.heritage.ui('cancel');this.notice('Операция «'+op.name+'» отложена. '+
    (operationId===RELAY_DEFENSE.id?'Следующую попытку начните в арсенале. После начавшегося налёта действует задержка.':
     operationId===CARRIER_INTERCEPTION.id?(preservingCarrierReturn?
      'Сведения сохранены. Передайте их при следующем посещении авианосца.':
      'Погоня отменена. Новый груз появится при следующем вылете.'):
     operationId===PROBE_OPERATION.id?(op.phase==='return'?'Данные сохранены. Сдайте их в лаборатории.':
      'Прогресс ремонта сохранён.'+(op.strikerSerial?' Налёт на зонд продолжится.':'')):
     operationId===CORRIDOR_OPERATION.id&&this.world.stations.get(this.world.home.id)?.corridorMission?.phase==='return'?
      'Телеметрия сохранена. Возобновите операцию в доке, чтобы сдать её.':'Повреждения передатчика сохранены.'),4);
   if(this.overlay.dataset.mode==='map')this.renderMap();
   else if(this.overlay.dataset.mode==='base')this.renderDock();
  }
  abandonContract(){
   if(!this.contract||this.dead||this.contract.progress>=this.contract.goal)return;
   const name=this.contract.name;finishFieldAssignment(this.fieldLoan,'contract',this.contract);this.contract=null;
   this.heritage.ui('cancel');
   this.notice('Поручение «'+name+'» отменено. Прогресс потерян.',3.4);
   if(this.overlay.dataset.mode==='map')this.renderMap();
   else if(this.overlay.dataset.mode==='base')this.renderDock();
  }
  setMapWaypoint(pixel){
   if(!insideMap(pixel))return false;
   const target=worldAtMapPoint(mapViewport(this),pixel);
   if(!Number.isFinite(target.x)||!Number.isFinite(target.y))return false;
   this.manualWaypoint={id:'map:manual',x:Math.round(target.x),y:Math.round(target.y),label:'Моя метка'};
   this.mapMarkMode=false;
   this.contourInfo='Метка поставлена · '+Math.round(dist(this.player,this.manualWaypoint))+
    ' м от корабля. Закройте карту, чтобы лететь по указателю.';
   this.mapCourseMessage='Метка поставлена. Продолжите полёт, чтобы лететь по указателю.';
   this.heritage.ui('tab');this.pausedRenderPending=true;this.renderMap();return true;
  }
  renderMap(){
  const old=this.overlay.querySelector('.map-dialog'),identity=old?captureMenuControl(this.overlay):null;
  const scroll=old?.scrollTop||0;
  const same=old?.classList?.contains('map-mode-'+(this.mapView||'map'));
  this.overlay.innerHTML=renderWorldMap(this);this.presentMenu();
  const panel=this.overlay.querySelector('.map-dialog');if(panel)panel.scrollTop=same?scroll:0;
  const fallback=this.menuBackLabel()||this.mapReturnToBase?
   '.map-footer-actions [data-act="menuBack"], .map-footer-actions [data-act="baseBack"]':
   '.map-footer-actions [data-act="close"]';
  restoreMenuControl(this.overlay,identity,fallback);
 }
 zoomMapAt(factor,pixel={x:340,y:240}){
  const spec=mapViewSpec(this),view=zoomMap(mapViewport(this),pixel,factor,spec.limits);
  this.mapViewports[view.key]={center:view.center,scale:view.scale};
  if(spec.key.startsWith('region:')&&factor<1&&view.scale<=spec.limits[0]+1e-7){
   const anchor=worldAtMapPoint(view,pixel);
   this.contourRegion='all';
   const global=mapViewSpec(this),scale=global.limits[1];
   this.mapViewports[global.key]={scale,center:{
    x:anchor.x-(pixel.x-340)/scale,y:anchor.y-(pixel.y-240)/scale}};
  }
  // The world atlas becomes an editable regional chart when zoomed far enough.
  if(spec.key==='overview'&&factor>1&&view.scale>=spec.limits[1]-1e-7){
   const anchor=worldAtMapPoint(view,pixel);
   this.contourRegion=regionAt(anchor.x,anchor.y).id;
   const detailed=mapViewSpec(this),scale=detailed.limits[0]*1.3;
   this.mapViewports[detailed.key]={scale,center:{
    x:anchor.x-(pixel.x-340)/scale,y:anchor.y-(pixel.y-240)/scale}};
  }
  this.renderMap();
 }
 refreshAutomaticContours(){
  const oldFields=contourFields(this.world),oldArea=contourArea(oldFields);
  const oldProduction=contourProduction(oldFields);
  const added=autoConnectContours(this.world);
  if(!added.length)return false;
  const after=contourFields(this.world);
  const gain=Math.max(0,contourArea(after)-oldArea);
  const newTrials=registerContourTrials(this.world,oldFields,after,gain);
  const fluxGain=Math.max(0,contourProduction(productiveContourFields(this.world,after))-oldProduction);
  this.cachedWorldLinks=[];this.contourVisualAt=-Infinity;this.pausedRenderPending=true;
  syncContourDynamics(this);
  if(this.paused&&gain>1&&this.contourDynamics?.transition?.kind==='claim')
   this.contourDynamics.transition.pendingResume=true;
  if(gain>1){
   const previousLevel=this.player.level;
   const strategicXp=this.awardStrategicExperience(claimContourExpansion(this.player,after,gain));
   this.contourFeedback={title:'Контур замкнут · враг обнаружил сигнал',text:'Новая территория: +'+
    (gain/1000000).toFixed(1)+' усл. км². '+(newTrials.length?
    'Враг готовит контратаку '+newTrials[0].tier+'/12.':
    'Добыча: +'+fluxGain.toFixed(1)+' флюкса за 3 минуты.')+
    (strategicXp?' +'+strategicXp+' опыта за новую территорию.':''),at:this.time};
   this.rewardNotice('ТРЕУГОЛЬНИК ЗАМКНУЛСЯ! Территория создана автоматически. '+
    'Вражеская сеть обнаружила всплеск. '+
    (newTrials.length?'Ожидается контратака: защитите поле, чтобы запустить воронку и добычу.':
     'Добыча флюкса продолжается.')+
    (strategicXp?' +'+strategicXp+' опыта.':''),previousLevel,6);
   // The centre of a new outer face can coincide with old territory.
   // Vortex arrival follows the fill, rather than appearing on click.
   const born=after.filter(f=>!oldFields.some(old=>old.id===f.id));
   this.contourBirths=born.map(f=>({id:f.id,x:f.center.x,y:f.center.y,at:this.time+2.5}));
   const anchor=born[0]?.center;
   recordWorldFeedback(this,{key:'contour-auto:'+this.time+':'+added[0][0],
    kind:'industry',label:'КОНТУР ЗАМКНУЛСЯ',
    cause:'Три работающие станции автоматически образовали территориальную сеть',
    effect:newTrials.length?'Вражеская контратака: защитите новое поле, чтобы открыть добычу флюкса':
     'Новое поле добывает флюкс: +'+fluxGain.toFixed(1)+' за 3 минуты. Враг может атаковать его опорные узлы',
    x:anchor?.x,y:anchor?.y});
   if(anchor)this.heritage?.vfx?.nova?.(anchor.x,anchor.y,145,'cyan');
  }else this.contourFeedback={title:'Связи установлены автоматически',
   text:'Когда три подходящие станции образуют замкнутую область, появится воронка.',at:this.time};
  return true;
 }
 returnToStation(){
  if(!this.docked||!this.stationExitArmed)return false;
  this.mapReturnToBase=false;this.overlay.dataset.mode='base';this.overlay.hidden=false;
  this.heritage.pause('base');this.renderDock();return true;
 }
 requestRunAction(action){
  if(!['run-start','death'].includes(this.overlay.dataset.mode)||!['runNew','restart'].includes(action))return false;
  if(this.overlay.querySelector('.run-confirm'))return false;
  this.pendingRunAction=action;
  const dialog=this.overlay.querySelector('.dialog');if(dialog)dialog.inert=true;
  this.overlay.insertAdjacentHTML('beforeend',renderRunConfirmation(action==='restart'));
  focusMenu(this.overlay,'[data-act="cancelRunNew"]');return true;
 }
 cancelRunAction(){
  this.pendingRunAction=null;this.overlay.querySelector('.run-confirm')?.remove();
  const dialog=this.overlay.querySelector('.dialog');if(dialog)dialog.inert=false;
  focusMenu(this.overlay,'[data-act="runContinue"]');
 }
  openMap(focus=null,fromPause=''){
   if(this.dead)return;
   this.endInteraction();
   if(!focus&&!this.overlay.hidden&&this.overlay.dataset.mode==='map')return;
   this.enterMenu('map',fromPause);
   this.keys.clear();
   this.mapCourseMessage='';
   this.mapPointers.clear();this.mapMarkMode=false;delete this.mapViewports.local;
   if(focus&&Number.isFinite(focus.x)&&Number.isFinite(focus.y)){
    const dx=Math.abs(focus.x-this.player.x),dy=Math.abs(focus.y-this.player.y);
    const scale=Math.max(.025,Math.min(.16,580/Math.max(850,dx),400/Math.max(650,dy)));
    // Keep nearby pilot + target on screen; centre on distant objectives when
    // the local chart cannot contain both at its supported minimum zoom.
    const both=dx*scale<=580&&dy*scale<=400;
    this.mapViewports.local={center:both?{x:(focus.x+this.player.x)/2,y:(focus.y+this.player.y)/2}:
     {x:focus.x,y:focus.y},scale};
   }
   this.mapReturnToBase=!this.overlay.hidden&&!!this.docked&&(this.overlay.dataset.mode==='base'||this.stationExitArmed);
   this.paused=true;this.pausedRenderPending=true;this.heritage.pause('map');
   this.overlay.dataset.mode='map';this.overlay.hidden=false;
   this.renderMap();
   this.heritage.ui('map');
  }
  selectWaypoint(data){
   if(this.overlay.dataset.mode!=='map')return;
   if(data.id==='clear'){
    this.setNavigationCourse(null,'Маршрут сброшен.');return;
   }
   const x=Number(data.x),y=Number(data.y);
   if(!Number.isFinite(x)||!Number.isFinite(y))return;
   const base=this.world.stations.get(data.id);
   const region=REGIONS.find(r=>'region-'+r.id===data.id);
   const cargo=[...(this.world.regionalSupply?.convoys||[]),
    ...(this.world.regionalSupply?.central?.convoys||[]),
    ...(this.world.regionalSupply?.frontier?.azure?.convoys||[]),
    ...(this.world.regionalSupply?.frontier?.teal?.convoys||[]),
    this.world.regionalSupply?.frontier?.azure?.repairExpedition,
    this.world.regionalSupply?.frontier?.teal?.repairExpedition]
    .find(c=>c?.id===data.id&&c.seen);
   const intel=labLogisticsIntel(this.world,this.player).contacts.find(c=>c.id===data.id);
   // The strategic atlas deliberately exposes the campaign stations before
   // local reconnaissance; its route button must actually work for them.
   if(!region&&!cargo&&!intel&&(!base||(!base.discovered&&!data.signal&&this.mapView!=='territory')))return;
   const waypoint=intel?{id:intel.id,x:intel.x,y:intel.y,label:intel.label,
    ...(intel.kind==='cargo'?{radioContact:true,signalLabel:intel.label,signalLive:true}:{})}:
    region?{id:data.id,...region.survey,label:region.name}:
    cargo?{id:cargo.id,x:cargo.x,y:cargo.y,label:cargo.frontierRepair?
     'Ремонтный корабль':cargo.frontierCargo?
     (cargo.frontierNetwork==='azure'?'Энерготранспорт':'Ремонтный груз'):
     cargo.centralCargo?'Местный груз':'Рудный транспорт'}:
    {id:data.id,x,y,label:data.label||'Сигнал станции'};
   this.setNavigationCourse(waypoint,'Курс задан. Летите по указателю после выхода с карты.');
  }
  chooseConflictPlan(plan){
   if(this.dead||!['base','map'].includes(this.overlay.dataset.mode))return false;
   const target=homeConflictTarget(this,plan);
   if(!target)return false;
   updateHomeConflict(this);
   this.setNavigationCourse({...target,conflictPlan:plan},'Курс задан. План вступит в силу при вылете.');
   return true;
  }
  chooseStationDefense(id){
   if(this.dead||!['base','map'].includes(this.overlay.dataset.mode))return false;
   const base=threatenedStations(this).find(station=>station.id===id);
   if(!base)return false;
   this.setNavigationCourse({id:base.id,x:base.x,y:base.y,
    label:'Защитить: '+(base.title||baseNames[base.type])},
    'Маршрут к станции под угрозой. Подготовку импульса можно прервать прицельным рельсом или ионом.');
   return true;
  }
  setNavigationCourse(waypoint,message){
   if(!this.overlay.hidden&&this.overlay.dataset.mode==='base'&&waypoint){
    this.mapView='map';
    this.openMap(waypoint);
   }
   if(this.overlay.hidden||this.overlay.dataset.mode!=='map')return;
   this.waypoint=waypoint;
   this.manualWaypoint=null;
   this.mapCourseMessage=message;
   this.pausedRenderPending=true;
   this.heritage.ui('tab');
   this.renderMap();
  }
 openDevelopment(category='weapons',focus='',upgrade=''){
  if(this.dead||!this.docked?.active)return;
  const target=developmentTab(category==='station'?'network':category);
  this.baseTab='development';this.developmentDomain=target;this.developmentFocus='';
  if(target==='weapons'){
   if(Object.hasOwn(MODULES,focus)){
    this.hangarSession.focusWeapon=focus;this.developmentWeapon=focus;
   }else if(['comet','mines'].includes(focus))this.developmentWeapon=focus;
   else if(!this.developmentWeapon)this.developmentWeapon=this.hangarSession.focusWeapon;
  }else if(target==='tactics'){
   if(Object.hasOwn(TACTICAL_DEVICES,focus))this.developmentTactic=focus;
  }else{
   const skill=SKILLS.find(s=>s.id===focus);
   if(skill)this.skillBranch=skill.branch;
  }
  if(upgrade&&SKILLS.some(s=>s.id===upgrade))this.developmentFocus='skill-'+upgrade;
  this.paused=true;this.pausedRenderPending=true;this.mapReturnToBase=false;
  this.overlay.hidden=false;this.overlay.dataset.mode='base';this.heritage.pause('base');
  this.heritage.ui('tab');this.renderDock();
  this.overlay.querySelector('.prog-node[aria-pressed="true"]')?.focus({preventScroll:true});
 }
 focusFittingWeapon(id){
  if(this.dead||!this.docked?.active||!Object.hasOwn(MODULES,id))return;
  const heavy=MODULES[id].kind==='heavy';
  const matches=(value,i)=>slotOpen(this.shipLoadout,i)&&(i===5)===heavy;
  const same=this.shipLoadout.slots.findIndex((value,i)=>value===id&&matches(value,i));
  const free=this.shipLoadout.slots.findIndex((value,i)=>!value&&matches(value,i));
  const slot=same>=0?same:free>=0?free:heavy?5:0;
  this.baseTab='hangar';this.hangarView='weapons';this.mapReturnToBase=false;
  this.overlay.dataset.mode='base';this.overlay.hidden=false;this.paused=true;
  this.hangarSession.dispatch({act:'hgSlot',id:String(slot)},this.baseState());
  this.hangarSession.dispatch({act:'hgFocusWeapon',id},this.baseState());
  this.hangarSession.catalog=true;this.heritage.ui('tab');this.renderDock();
  this.overlay.querySelector('.hg-weapon-inspector')?.scrollIntoView({block:'nearest'});
 }
 skills(full=false,fromPause=''){
  if(this.dead)return;
  if(!full&&this.overlay.hidden&&this.player.points>0&&this.fieldEvolution?.offers.length){this.openEvolution();return;}
  this.endInteraction();
  if(this.docked?.active&&this.stationExitArmed){
   this.enterMenu('base',fromPause);
   this.openDevelopment('pilot');
   return;
  }
  if(!this.overlay.hidden&&this.overlay.dataset.mode==='skills')return;
  this.enterMenu('skills',fromPause);
  this.keys.clear();
  this.paused=true;this.pausedRenderPending=true;
  this.heritage.pause('skills');
  this.overlay.dataset.mode='skills';this.overlay.hidden=false;
  this.heritage.ui('open');
  this.renderSkills();
 }
 renderSkills(){
  const focusIdentity=this.overlay.querySelector('.skill-dialog')?captureMenuControl(this.overlay):null;
  const previousScroll=this.overlay.querySelector('.skill-dialog')?.scrollTop||0;
  this.overlay.innerHTML=renderPilotMenu({player:this.player,ranks:this.skillRanks,doctrine:this.doctrine,
   skills:SKILLS,doctrines:DOCTRINES,branch:this.skillBranch||'Корабль',nextEffect:nextSkillEffect,
   nextXp:expForNext(this.player.level),atStation:!!this.docked&&this.stationExitArmed,
   backLabel:this.menuBackLabel()});
  this.overlay.querySelector('.skill-dialog').scrollTop=previousScroll;
  this.presentMenu();
  restoreMenuControl(this.overlay,focusIdentity,'.skill-branch-tabs [aria-pressed="true"]');
 }
 openEvolution(){
  if(this.dead)return;
  if(this.docked&&this.stationExitArmed){this.openDevelopment('pilot');return;}
  this.endInteraction();this.keys.clear();
  this.enterMenu('evolution');
  this.paused=true;this.pausedRenderPending=true;
  this.overlay.dataset.mode='evolution';this.overlay.hidden=false;
  this.heritage.pause('evolution');
  this.renderEvolution();
 }
 renderEvolution(){
  this.overlay.innerHTML=renderEvolutionMenu(this,SKILLS.filter(s=>!SHIP_UPGRADES.has(s.id)));
  this.presentMenu('[data-act="evolutionPick"], [data-act="parasiteMode"], [data-act="menuBack"], [data-act="close"]');
 }
 setParasiteMode(mode){
  if(!setParasiteTargetMode(this,mode))return false;
  const name=mode==='capture'?'ЗАХВАТ — добейте отмеченную цель':'РАЗВЕДКА — попадите по отмеченной цели';
  this.notice('ПАРАЗИТ · '+name+'. Понадобится одно энергоядро.',3.6);
  this.syncEvolutionPrompt();
  if(this.overlay.dataset.mode==='evolution'&&!this.overlay.hidden){
   this.renderEvolution();
   this.overlay.querySelector('[data-act="parasiteMode"][data-mode="'+mode+'"]')?.focus({preventScroll:true});
  }
  return true;
 }
 syncEvolutionPrompt(){
  const panel=$('evolutionPrompt');if(!panel)return;
  const state=this.fieldEvolution;
  const installed=installedEvolution(this.skillRanks,SKILLS.filter(s=>!SHIP_UPGRADES.has(s.id))),available=state?.offers?.length&&this.player.points>0;
  if(this.dead||!available&&!installed.length){panel.hidden=true;panel.innerHTML='';return;}
  const dual=this.skillRanks.capture&&this.skillRanks.signal;
  const mode=parasiteTargetMode(this);
  const cooldown=mode==='capture'?Math.max(0,Math.ceil((state?.captureReadyAt||0)-this.time)):0;
  const readiness=!state?.charge&&mode!=='guard'?'Нужно ядро':cooldown?'Захват через '+cooldown+' с':
   mode==='guard'?'Автощит':mode==='capture'?'Захват по метке':'Разведка по метке';
  panel.innerHTML='<button type="button" class="evolution-open" data-evolution="open"><strong>'+
   (available?'Улучшить · '+this.player.points+' очк.':'Способности · '+installed.length)+
   '</strong><span>'+(this.skillRanks.parasite?'Энергоядра '+(state?.charge||0)+'/2 · ':'')+
   (this.skillRanks.parasite?readiness+' · ':'')+
   'Открыть с паузой</span></button>'+
   (dual?'<button type="button" class="evolution-mode-quick" data-evolution="parasiteMode" aria-label="Изменить режим паразита"><span>Паразит: '+
    (mode==='capture'?'захват':'разведка')+'</span><small>Сменить режим</small></button>':'');
  panel.hidden=false;
 }
 chooseEvolution(id){
  if(this.overlay.dataset.mode!=='evolution'||this.overlay.hidden||!id||!this.fieldEvolution?.offers.includes(id)||this.player.points<1)return false;
  const spent=this.buySkill(id);
  if(spent){
   this.evolutionReceipt={id,title:SKILLS.find(s=>s.id===id)?.title||id,at:this.time};
   this.heritage.vfx.nova(this.player.x,this.player.y,82,'green');
   this.heritage.play('doctrine',.28,{x:this.player.x,y:this.player.y});
   this.syncEvolutionPrompt();
   this.openEvolution();
  }
  return !!spent;
 }
 deferEvolution(){
  this.fieldEvolution.pending=0;
  this.fieldEvolution.offers=[];this.fieldEvolution.crystals=[];
  this.syncEvolutionPrompt();
  this.notice('Очко развития сохранено — потратьте его в меню пилота',3);
 }
 buyDoctrine(id){
  if(this.dead||this.doctrine||this.player.level<4||this.player.points<1||
    !DOCTRINES.some(d=>d.id===id))return;
  this.player.points--;this.doctrine=id;
  this.notice('Доктрина: '+DOCTRINES.find(d=>d.id===id).title,3);
  this.heritage.play('doctrine');
  if(this.hangarSession)this.hangarSession.message='Выбрана доктрина: '+DOCTRINES.find(d=>d.id===id).title;
  if(this.overlay.dataset.mode==='base')this.renderDock();else this.renderSkills();
 }
 buySkill(id){
  const skill=SKILLS.find(s=>s.id===id),p=this.player;
  if(SHIP_UPGRADES.has(id)&&(!this.docked?.active||this.overlay.hidden||this.overlay.dataset.mode!=='base'||
   !['hangar','development'].includes(this.baseTab)))return;
  if(!skill||p.points<=0||p.level<skill.from||
    (skill.exclusiveWith&&this.skillRanks[skill.exclusiveWith])||
    (skill.masteryLevel&&(this.skillRanks[id]||0)>0&&p.level<skill.masteryLevel)||
    (skill.requires&&!this.skillRanks[skill.requires])||(this.skillRanks[id]||0)>=skill.max)return false;
  this.skillRanks[id]=(this.skillRanks[id]||0)+1;p.points--;
  if(id==='parasite'&&this.skillRanks[id]===1&&this.fieldEvolution)
   this.fieldEvolution.charge=Math.max(1,this.fieldEvolution.charge);
  if(this.fieldEvolution?.pending>0){
   this.fieldEvolution.pending--;
   refreshEvolutionOffers(this,SKILLS);
  }
  if(id==='hull'){p.maxHp+=22;p.hp=Math.min(p.maxHp,p.hp+32);}
  if(id==='shield')p.shield+=18;
  let moduleSuggested=false;
  if(id==='rocket'&&this.skillRanks.rocket===1){
   this.shipLoadout.owned.rocket=(this.shipLoadout.owned.rocket||0)+1;
   moduleSuggested=this.suggestShipModule('rocket');
  }
  this.heritage.play('upgrade',.14);
  this.notice(id==='parasite'?'ПАРАЗИТ · 1/2 ядра. Защита сработает сама при сильном ударе.':
   id==='capture'?'ЗАХВАТ · попадите кометой по обычному дрону и добейте отмеченную цель с ядром в запасе.':
   id==='signal'?'ПЕРЕДАТЧИК · попадите кометой по прочному врагу с ядром в запасе.':
   'Улучшение: '+skill.title,3.6);
  if(SHIP_UPGRADES.has(id)){
   this.hangarSession.message=moduleSuggested?'Ракетный модуль добавлен в предварительную сборку. Нажмите «Применить».':
    id==='rocket'&&this.skillRanks.rocket===1?'Ракетный модуль получен. Выберите узел, установите его и примените сборку.':'Улучшение изучено: '+skill.title;
   if(moduleSuggested){this.baseTab='hangar';this.hangarView='weapons';}
   this.renderDock();
   if(moduleSuggested)this.revealLoadoutApply();
   else this.overlay.querySelector('[data-act="hgUpgrade"][data-id="'+id+'"]')?.focus({preventScroll:true});
  }else if(this.overlay.dataset.mode==='base'){
   this.hangarSession.message='Изучено: '+skill.title+' · потрачено 1 очко развития';this.renderDock();
  }else if(this.overlay.hidden){this.hud();this.syncEvolutionPrompt();}
  else if(this.overlay.dataset.mode!=='evolution')this.renderSkills();
  return true;
 }

 advanceContract(kind,subject=null){
  const c=this.contract;
  const station=c?this.world.stations.get(c.baseId):null;
  const pilotParticipated=kind==='kill'&&qualifiesForDirectCombatXp(subject,this.time);
  if(!eligibleContractProgress(c,kind,subject,station,pilotParticipated))return;
  c.progress++;
  if(c.progress===c.goal){
   c.completedSortieId=this.sortieStart?.id??null;
   if(station&&Number.isFinite(station.x)&&Number.isFinite(station.y)&&
    !this.waypoint&&!this.manualWaypoint)
    this.waypoint={id:station.id,x:station.x,y:station.y,
     label:'Награда: '+(baseNames[station.type]||'исходная станция')};
   this.notice('Задание выполнено! '+
    'Вернитесь на '+(station?baseNames[station.type]:'станцию')+'. Награда начислится при стыковке.'+
    (this.waypoint?.id===station?.id?' Маршрут отмечен.':''),4.5);
  }
 }

 creditContractKill(enemy){
  if(!enemy||enemy.converted||enemy.contractKillCredited)return false;
  if(enemy.microSwarm){
   // A pack is one coordinated opponent for ordinary kill contracts. A
   // damaged pack must be finished, and an area blast counts it only once.
   if(this.enemies.some(other=>other!==enemy&&other.microSwarm&&
     other.moteRoot===enemy.moteRoot&&other.hp>0))return false;
   this._moteContractCredited??=new Set();
   if(this._moteContractCredited.has(enemy.moteRoot))return false;
   this._moteContractCredited.add(enemy.moteRoot);
  }
  enemy.contractKillCredited=true;
  this.advanceContract('kill',enemy);
  return true;
 }

 finishFieldOperation(partial=false){
  const op=this.operation;
  if(!isFieldOperation(op)||!this.docked||this.docked.id!==op.baseId)return false;
  const eligible=op.phase==='return'||partial&&op.phase==='active'&&
   ['deep-resonance','line-break','sleeping-reactor'].includes(op.id)&&op.progress>=1;
  if(!eligible)return false;
  const base=this.docked,spec=FIELD_OPERATIONS[op.id],runs=base.fieldOperationRuns?.[op.id]||0;
  const limited=partial||op.partial;
  const factor=(runs?0.75:1)*fieldRewardFactor(op.threatTier);
  const ore=Math.round((limited?spec.partialOre:spec.ore)*factor);
  const data=Math.round((limited?spec.partialData:spec.data)*factor);
  base.fieldOperationRuns??={};base.fieldOperationRuns[op.id]=runs+1;
  // A cautious partial retreat must not silently raise the difficulty of
  // future sorties. Keep attempts, completed runs and full successes distinct.
  const previousFull=base.fieldOperationFullRuns?.[op.id]??runs;
  base.fieldOperationFullRuns??={};
  base.fieldOperationFullRuns[op.id]=previousFull+(limited?0:1);
  const elapsed=Number.isFinite(op.startedAt)&&op.startedAt>=0?
   Math.max(0,Math.round(this.time-op.startedAt)):null;
  base.fieldOperationHistory??=[];
  base.fieldOperationHistory.push({id:op.id,full:!limited,seconds:elapsed,
   tier:op.threatTier||0,convoyHp:op.id==='broken-convoy'?Math.round(op.hp):null});
  if(base.fieldOperationHistory.length>8)base.fieldOperationHistory.shift();
  base.fieldOperationCooldowns??={};base.fieldOperationCooldowns[op.id]=this.time+110;
  base.fieldMission=null;
  finishFieldAssignment(this.fieldLoan,'operation',op);
  this.enemies=this.enemies.filter(e=>e.fieldOperation!==op.id);
  this.operation=null;
  if(isOperationWaypoint(this.waypoint,op))this.waypoint=null;
  this.player.ore+=ore;recordSortieIncome(this,'ore','operation',ore);
  this.cockpit.resourceGain(ore,this.time);
  const previousLevel=this.player.level;
  this.collect({type:'data',value:data,source:'operation'});
  if(!limited){
   if(op.id==='deep-resonance')this.geoScanUntil=Math.max(this.geoScanUntil||0,this.time+75);
   if(op.id==='reverse-hunt')this.geoScanUntil=Math.max(this.geoScanUntil||0,this.time+105);
   if(op.id==='line-break')this.geoScanUntil=Math.max(this.geoScanUntil||0,this.time+90);
   if(op.id==='false-call')this.spawnClock=Math.max(this.spawnClock||0,12);
   if(op.id==='two-fronts')this.spawnClock=Math.max(this.spawnClock||0,13);
   if(op.id==='sleeping-reactor')this.player.shield=Math.max(this.player.shield||0,
    Math.min(30,(this.player.shield||0)+20));
   if(op.id==='broken-convoy'&&this.support)
    this.support.charges=Math.min(2,(this.support.charges||0)+1);
  }
  this.heritage.station('claimContract',base.type);
  this.rewardNotice((limited?'ЧАСТИЧНЫЙ УСПЕХ':'ОПЕРАЦИЯ ЗАВЕРШЕНА')+' · «'+op.name+'». +'+ore+
   ' сплава, +'+data+' опыта.'+(op.id==='deep-resonance'&&!limited?' Геологический сканер активен 75 с.':
   op.id==='reverse-hunt'&&!limited?' Спектральный поиск действует 105 с.':
   op.id==='line-break'&&!limited?' Разведка восстановлена на 90 с.':
   op.id==='false-call'&&!limited?' Вражеский вызов сорван.':
   op.id==='two-fronts'&&!limited?' Участок защищён, патрули временно отступили.':
   op.id==='sleeping-reactor'&&!limited?' Аварийный конденсатор дал +20 щита (до 30).':
   op.id==='broken-convoy'&&!limited?' Доставленные запасы дают один ударный вылет (максимум два).':''),previousLevel,5.5);
  return true;
 }

 failFieldOperation(op){
  if(this.operation!==op)return;
  const base=this.world.stations.get(op.baseId);
  if(base){base.fieldMission=null;base.fieldOperationCooldowns??={};
   base.fieldOperationCooldowns[op.id]=this.time+45;}
  finishFieldAssignment(this.fieldLoan,'operation',op);
  this.enemies=this.enemies.filter(e=>e.fieldOperation!==op.id);
  this.operation=null;
  if(isOperationWaypoint(this.waypoint,op))this.waypoint=null;
  this.notice('Операция «'+op.name+'» сорвана. Повторное задание появится через 45 секунд.',5);
 }

 // Finite assault on a fragile relay. Leaving the sector never grants a free win.
 prepareMissionStrike(enemy,target,spec){
  enemy.missionStrike={target:spec.target,range:spec.range,damage:spec.damage,charge:spec.charge};
  for(const offset of [0,.15,-.15,.3,-.3]){
   const a=spec.angle+offset;
   const x=target.x+Math.cos(a)*spec.range,y=target.y+Math.sin(a)*spec.range;
   enemy.missionFlight={x,y,speed:ENEMY_TYPES[enemy.type].speed};
   const rocks=this.world.nearbyRocks((x+target.x)*.5,(y+target.y)*.5,spec.range*.5+65);
   if(!firstRockImpact(x,y,target.x,target.y,rocks,8,null))break;
  }
 }
 updateMissionStrike(enemy,target){
  const spec=enemy.missionStrike;
  if(!target||target.hp<=0||dist(enemy,target)>spec.range+20||
     this.time<(enemy.stasisUntil||0)||this.time<(enemy.chargeDisabledUntil||0)){
   enemy.relayChargeUntil=0;return;
  }
  if(this.time<(enemy.relayCooldownUntil||0))return;
  if(!enemy.relayChargeUntil){enemy.relayChargeUntil=this.time+spec.charge;return;}
  if(this.time<enemy.relayChargeUntil)return;
  enemy.relayChargeUntil=0;enemy.relayCooldownUntil=this.time+2.1;
  const rocks=this.world.nearbyRocks((enemy.x+target.x)*.5,(enemy.y+target.y)*.5,dist(enemy,target)*.5+65);
  const cover=firstRockImpact(enemy.x,enemy.y,target.x,target.y,rocks,3,null);
  if(cover)this.damageRock(cover.rock,spec.damage,cover.x,cover.y,'cover',false);
  let absorbed=0,hullDamage=0;
  if(!cover){
   absorbed=Math.min(target.fieldShield||0,spec.damage);
   if(absorbed){target.fieldShield=Math.max(0,target.fieldShield-absorbed);
    target.fieldShieldHitAt=this.time;
    target.fieldShieldHitAngle=Math.atan2(enemy.y-target.y,enemy.x-target.x);
    if(target.fieldShield===0){target.fieldShieldBreakAt=this.time;
     this.heritage.vfx.nova(target.x,target.y,33,'cyan');}}
   hullDamage=spec.damage-absorbed;
   if(hullDamage>0){target.hp=Math.max(0,target.hp-hullDamage);target.fieldHullHitAt=this.time;}
  }
  this.flash(enemy.x,enemy.y,cover?.x??target.x,cover?.y??target.y,
   absorbed?'#8ef5e4':'#ffb585');
  // A rock hit already has its own mining/impact sound. A relay shield is not
  // the player's hull, and the cargo transport has its own fatal explosion.
  if(!cover){
   const position={x:target.x,y:target.y};
   if(target.hp<=0&&target!==this.operation){
    this.heritage.vfx.nova(target.x,target.y,43,'red');
    this.heritage.play('largeExplosion',.28,position);
   }else if(hullDamage>0)this.heritage.play(
    this.operation?.id===RELAY_DEFENSE.id?'missionRelayImpact':'armorHit',.17,position);
   else if(absorbed>0)this.heritage.play(target.fieldShield===0?'shieldBreak':'shieldHit',.17,position);
  }
 }
 spawnRelayWave(op,index){
  const roster=relayWavePlan(op,index);if(!roster.length)return;
  if(this.actionHeld?.kind==='relay-prep')this.actionHeld=null;
  if(!op.prepared){op.prepProgress=0;op.prepTarget=null;}
  op.enemySerials=[];op.wave=index+1;op.phase='wave';
  for(let i=0;i<roster.length;i++){
   const spec=roster[i],def=ENEMY_TYPES[spec.type];
   const target=spec.target==='antenna'?(op.antenna?.hp>0?op.antenna:op):
    spec.target==='relay'?op:null;
   const origin=target||op,radius=spec.range?spec.range+170:600;
   let angle=spec.angle,x=op.x+Math.cos(angle)*radius,y=op.y+Math.sin(angle)*radius;
   for(const offset of [0,.16,-.16,.32,-.32,.58]){
    angle=spec.angle+offset;
    const px=origin.x+Math.cos(angle)*radius,py=origin.y+Math.sin(angle)*radius;
    const obstructed=this.world.nearbyRocks(px,py,62).some(r=>r.alive&&dist(r,{x:px,y:py})<r.r+28);
    if(!obstructed){x=px;y=py;break;}
   }
   const serial=++this.enemySerial;
   const enemy={serial,group:++this.groupSerial,type:spec.type,
    x,y,vx:0,vy:0,r:spec.type==='gunship'?22:14,
    hp:def.hp,maxHp:def.hp,damage:def.dmg,think:0,fire:1.4,
    state:'hunt',commitUntil:0,target:target||this.player,angle:0,hit:0,
    expAwarded:true,scenario:'relay-assault',protect:null,
    relayAssault:op.baseId,relayScreen:!target,relayCooldownUntil:this.time+.9,relayChargeUntil:0,
    operationGuard:true,fieldChargeOperation:this.operation?.id,fieldChargeBaseId:this.operation?.baseId,entryPortalPending:false};
   if(target)this.prepareMissionStrike(enemy,target,{...spec,
    target:target===op?'relay':spec.target,angle});
   this.enemies.push(enemy);
   op.enemySerials.push(serial);
  }
  const relayHit=roster.some(s=>s.target==='relay');
  const antennaHit=roster.some(s=>s.target==='antenna');
  this.notice('Волна '+op.wave+'/3. '+(relayHit&&antennaHit?
   'Атакуют передатчик и антенну.':antennaHit?'Главная цель — резервная антенна.':
    'Главная цель — передатчик.')+' Перехватывайте заряжающиеся корабли.',4.6);
  this.heritage.play('missionRelayWave',1.1,{x:op.x,y:op.y});
 }
 updateRelayDefense(dt){
  const op=this.operation;
  if(!op||op.id!==RELAY_DEFENSE.id||this.dead)return;
  if(op.hp<=0){this.failRelayDefense(op);return;}
  if(['warning','intermission'].includes(op.phase)&&!op.prepared){
   const held=this.actionHeld;
   if(held?.kind==='relay-prep'&&(held.target===op||held.target===op.antenna)&&
    held.target.hp>0&&dist(this.player,held.target)<=125){
    const target=held.target===op?'relay':'antenna';
    if(op.prepTarget!==target){op.prepTarget=target;op.prepProgress=0;}
    op.prepProgress=Math.min(RELAY_DEFENSE.prepHold,(op.prepProgress||0)+dt);
    if(this.time-(op.lastPrepSoundAt??-Infinity)>1){
     op.lastPrepSoundAt=this.time;
     this.heritage.play('fieldWork',.2,{x:held.target.x,y:held.target.y});
    }
    if(op.prepProgress>=RELAY_DEFENSE.prepHold){
     if(this.player.ore>=RELAY_DEFENSE.prepCost){
      this.player.ore-=RELAY_DEFENSE.prepCost;
      recordEconomyExpense(this,'repairs',RELAY_DEFENSE.prepCost);
      held.target.fieldShield=RELAY_DEFENSE.prepShield;
      op.prepared=true;op.prepProgress=0;
      this.heritage.play('missionRelayPrepare',.2,{x:held.target.x,y:held.target.y});
      this.heritage.vfx.nova(held.target.x,held.target.y,65,'cyan');
      this.notice('Барьер установлен на '+(target==='relay'?'передатчик':'антенну')+
       '. Второй объект без резервной защиты.',4.5);
     }else this.notice('Для резервного барьера требуется 5 сплава.',3);
     this.actionHeld=null;
    }
   }
  }
  if(op.hp<=RELAY_DEFENSE.maxHp*.35&&!op.criticalWarned){
   op.criticalWarned=true;
   this.notice('ТРЕВОГА: ретранслятор повреждён! Перехватывайте заряжающиеся корабли.',4);
  }
  if(op.phase==='approach'){
   if(dist(this.player,op)<=RELAY_DEFENSE.triggerRange){
    op.phase='warning';op.nextAt=this.time+RELAY_DEFENSE.preparation;
    this.notice('Угроза ретранслятору. Стрелки покажут направления и цели налёта. Удержанием действия можно заранее защитить один объект за 5 сплава.',5.5);
   }
   return;
  }
  if(op.phase==='warning'||op.phase==='intermission'){
   if(this.time>=op.nextAt)this.spawnRelayWave(op,op.wave);
   return;
  }
  if(op.phase!=='wave')return;
  let surviving=0;
  for(const e of this.enemies){
   if(e.relayAssault!==op.baseId||!op.enemySerials.includes(e.serial)||
      e.hp<=0||e.converted)continue;
   surviving++;
   if(e.missionStrike){
    const antenna=e.missionStrike.target==='antenna';
    const target=antenna?op.antenna:op;
    const wasIntact=antenna&&target?.hp>0;
    this.updateMissionStrike(e,target);
    if(wasIntact&&target.hp<=0){
     this.heritage.vfx.shipExplosion(target.x,target.y,15,'#ffa373');
     this.notice('Резервная антенна потеряна. Передатчик ещё можно спасти.',4);
     delete e.missionFlight;delete e.missionStrike;
     e.relayScreen=true;e.target=this.player;
    }
    continue;
   }
   if(e.relayScreen)continue;
   // A checkpoint made during a wave can still contain old close-range attackers.
   if(dist(e,op)>RELAY_DEFENSE.assaultRange){
    e.relayChargeUntil=0;continue;
   }
   if(this.time<(e.relayCooldownUntil||0))continue;
   if(!e.relayChargeUntil){
    e.relayChargeUntil=this.time+1.3;
   }else if(this.time>=e.relayChargeUntil){
    const damage=e.type==='gunship'?23:e.type==='fighter'?14:e.type==='flanker'?13:10;
    op.hp=Math.max(0,op.hp-damage);
   op.fieldHullHitAt=this.time;
    e.relayChargeUntil=0;e.relayCooldownUntil=this.time+3.1;
    this.flash(e.x,e.y,op.x,op.y,'#ffb585');
   this.heritage.play('missionRelayImpact',.2,{x:op.x,y:op.y});
    if(op.hp<=RELAY_DEFENSE.maxHp*.35&&!op.criticalWarned){
     op.criticalWarned=true;
     this.notice('ТРЕВОГА: ретранслятор повреждён! Перехватывайте заряжающиеся корабли.',4);
    }
   }
  }
  if(op.hp<=0){this.failRelayDefense(op);return;}
  if(!surviving){
   if(op.wave>=RELAY_DEFENSE.waves.length){this.completeRelayDefense(op);return;}
   op.phase='intermission';op.nextAt=this.time+RELAY_DEFENSE.intermission;
   this.notice('Волна '+op.wave+'/3 отражена. До следующей атаки '+RELAY_DEFENSE.intermission+
    ' секунд. Проверьте её цель; неиспользованный резервный барьер ещё можно установить.',5);
  }
 }
 failRelayDefense(op){
  if(this.operation!==op)return;
  finishFieldAssignment(this.fieldLoan,'operation',op);
  const base=this.world.stations.get(op.baseId);
  if(base){
   base.relayMission=null;base.relayRetryAt=this.time+RELAY_DEFENSE.retryDelay;
   base.relayAttempts=(base.relayAttempts||0)+1;
  }
  this.enemies=this.enemies.filter(e=>e.relayAssault!==op.baseId);
  this.operation=null;
  if(this.waypoint?.id===RELAY_DEFENSE.id)this.waypoint=null;
  this.heritage.vfx.shipExplosion(op.x,op.y,32,'#ff8c74');
  this.heritage.play('largeExplosion',.3,{x:op.x,y:op.y});
  this.notice('Ретранслятор потерян. Арсенал цел; повторить оборону можно через 45 секунд.',5);
 }
 completeRelayDefense(op){
  const base=this.world.stations.get(op.baseId);
  if(!base||base.relayDefenseDone||this.operation!==op||op.hp<=0)return;
  finishFieldAssignment(this.fieldLoan,'operation',op);
  base.relayDefenseDone=true;base.relayMission=null;this.operation=null;
  base.relaySite={x:op.x,y:op.y,hp:op.hp,maxHp:op.maxHp,antenna:op.antenna,onlineAt:this.time};
  if(this.waypoint?.id===RELAY_DEFENSE.id)this.waypoint=null;
  const antennaSaved=op.antenna?.hp>0;
  const next=(antennaSaved||!op.antenna)&&chooseOperationLead(this.world,op,base.id,'carrier',2500);
  if(next){next.discovered=true;this.world.discovered.add(next.id);
   if(!this.waypoint)this.waypoint={id:next.id,x:next.x,y:next.y,
    label:baseNames[next.type]||'Станция'};}
  const ore=RELAY_DEFENSE.rewardOre+(antennaSaved?RELAY_DEFENSE.bonusOre:0);
  const data=RELAY_DEFENSE.rewardData+(antennaSaved?RELAY_DEFENSE.bonusData:0);
  this.player.ore+=ore;
  recordSortieIncome(this,'ore','operation',ore);
  this.cockpit.resourceGain(ore,this.time);
  const previousLevel=this.player.level;
  this.collect({type:'data',value:data});
  recordSortieIncome(this,'data','operation',data);
  this.heritage.station('claimContract',base.type);
  this.heritage.play('missionRelayOnline',.4,{x:op.x,y:op.y});
  this.rewardNotice('ОБОРОНА ЗАВЕРШЕНА. Связь восстановлена. +'+ore+' сплава, +'+data+' опыта.'+
   (antennaSaved?' Антенна уцелела: обзор карты у арсенала +'+RELAY_DEFENSE.bonusScan+' м.':'')+
   (next?' Отмечен следующий узел.':''),previousLevel,6.5);
 }

  // A carrier operation begins only when the player reaches the contact area.
  // Cargo coordinates are shared by navigation, combat and rendering.
  updateCarrierInterception(dt){
   const op=this.operation;
   if(!op||op.id!==CARRIER_INTERCEPTION.id||this.dead)return;
   if(op.phase==='return')return;
   if(op.phase==='approach'){
    if(dist(this.player,op)>CARRIER_INTERCEPTION.triggerRange)return;
    op.phase='contact';op.contactAt=this.time;
    op.serial=++this.enemySerial;op.group=++this.groupSerial;
    op.fire=999;op.damage=0;op.state='transit';op.think=999;
    op.target=this.player;op.protect=null;op.entryPortalPending=false;
    this.enemies.push(op);
    this.spawnCarrierEscort(op,'fighter',0);
    this.spawnCarrierEscort(op,'scout',1);
    this.heritage.play('missionCarrierContact',.4,{x:op.x,y:op.y});
    this.notice('Конвой обнаружен! Нос бронирован, двигатели уязвимы с кормы. Повредите их, чтобы замедлить груз.',5);
   }
   if(!carrierInFlight(op))return;
   const events=advanceCarrierSystems(op,dt);
   const result=moveCarrierCargo(op,dt);
   // A massive transport fractures small asteroids instead of passing through
   // their artwork. Hostile destruction yields neither alloy nor mining credit.
   for(const rock of this.world.nearbyRocks(op.x,op.y,110)){
    if(rock.alive&&dist(rock,op)<rock.r+op.r+8)
     this.damageRock(rock,rock.hp,op.x,op.y,'cover');
   }
   if(events.boostWarning){
    this.heritage.play('missionCarrierBoost',.4,{x:op.x,y:op.y});
    this.notice('Транспорт готовит форсаж! Заходите на корму: попадания по двигателям замедляют груз.',3.5);
   }
   if(events.pulseWarning){
    this.heritage.play('ramWarning',1.8,{x:op.x,y:op.y});
    this.notice('КРУГОВОЙ РАЗРЯД: выйдите за отмеченные 230 м. После разряда броня откроется на 3 секунды.',3.5);
   }
   if(events.discharge){
    this.heritage.vfx.nova(op.x,op.y,CARRIER_INTERCEPTION.pulseRange,'violet');
    this.heritage.play('carrierPulse',.3,{x:op.x,y:op.y});
    if(dist(this.player,op)<=CARRIER_INTERCEPTION.pulseRange)this.hurt(CARRIER_INTERCEPTION.pulseDamage,op);
   }
   // Updating our own target leaves a manually selected station route untouched.
   if(this.waypoint?.id===CARRIER_INTERCEPTION.id){
    this.waypoint.x=op.x;this.waypoint.y=op.y;
   }
   if(!op.warningSent&&op.routeIndex===0&&
      dist(op,op.route[1])<=CARRIER_INTERCEPTION.warningDistance){
    op.warningSent=true;
    this.notice('Конвой готовится изменить курс. Срезайте угол и держите его в дальности оружия!',4.5);
   }
   if(result.turned&&!op.reinforcementSent){
    op.phase='turn';op.reinforcementSent=true;
    this.spawnCarrierEscort(op,'flanker',2);
    this.notice('Конвой сменил курс! К выходу подтягивается последний перехватчик.',4);
   }
   const remaining=carrierDistanceRemaining(op);
   if(remaining<=CARRIER_INTERCEPTION.lastChanceDistance&&!op.lastChanceSent){
    op.phase='last';op.lastChanceSent=true;
    this.notice('ПОСЛЕДНИЙ ШАНС: до выхода груза '+Math.ceil(remaining)+' м. Сблизьтесь для атаки!',5);
   }else if(op.phase==='contact'&&this.time-op.contactAt>=4){
    op.phase='pursuit';
   }
   if(result.escaped)this.failCarrierInterception(op);
  }
  spawnCarrierEscort(op,type,index){
   if(this.enemies.length>=RULES.maxEnemies)return false;
   const def=ENEMY_TYPES[type];if(!def)return false;
   const angles=[-.95,1.18,2.6],angle=angles[index]??0;
   let x=op.x+Math.cos(angle)*115,y=op.y+Math.sin(angle)*115;
   for(let step=0;step<7;step++){
    const a=angle+step*TAU/7,px=op.x+Math.cos(a)*115,py=op.y+Math.sin(a)*115;
    if(!this.world.nearbyRocks(px,py,55).some(r=>r.alive&&dist(r,{x:px,y:py})<r.r+22)){
     x=px;y=py;break;
    }
   }
   const serial=++this.enemySerial;
   this.enemies.push({serial,group:++this.groupSerial,type,
    x,y,vx:0,vy:0,r:14,hp:def.hp,maxHp:def.hp,damage:def.dmg,
    think:.12+index*.08,fire:1.15,state:'hunt',commitUntil:0,target:this.player,
    angle:0,hit:0,expAwarded:false,scenario:'carrier-escort',protect:op,
    carrierEscort:op.baseId,operationGuard:true,fieldChargeOperation:this.operation?.id,fieldChargeBaseId:this.operation?.baseId,entryPortalPending:false});
   op.escortSerials.push(serial);
   return true;
  }
  failCarrierInterception(op){
   if(this.operation!==op||op.phase==='return')return;
   finishFieldAssignment(this.fieldLoan,'operation',op);
   const base=this.world.stations.get(op.baseId);
   if(base){base.carrierMission=null;base.carrierRetryAt=this.time+CARRIER_INTERCEPTION.retryDelay;}
   this.enemies=this.enemies.filter(e=>e!==op&&e.carrierEscort!==op.baseId);
   this.operation=null;
   if(this.waypoint?.id===CARRIER_INTERCEPTION.id)this.waypoint=null;
   this.heritage.vfx.nova(op.x,op.y,72,'red');
   this.notice('Груз ушёл через обозначенную границу. Награда не выдана. Повторите попытку на авианосце через 35 секунд.',6);
  }
  completeCarrierInterception(op){
   if(this.operation!==op||!carrierInFlight(op))return;
   const base=this.world.stations.get(op.baseId);
   if(!base)return;
   op.phase='return';op.hp=0;op.vx=0;op.vy=0;
   this.enemies=this.enemies.filter(e=>e!==op);
   this.waypoint={id:CARRIER_INTERCEPTION.id,x:base.x,y:base.y,
    label:'Вернуться на авианосец с телеметрией'};
   this.heritage.vfx.shipExplosion(op.x,op.y,64,'#ffc47d',true);
   this.heritage.vfx.nova(op.x,op.y,114,'red');
   this.heritage.play('largeExplosion',.22,{x:op.x,y:op.y});
   this.notice('ГРУЗ ПЕРЕХВАЧЕН! Доставьте телеметрию на авианосец ('+this.controlLabel('interact')+'), чтобы получить награду и ослабить патрули.',6);
  }
  deliverCarrierInterception(){
   const op=this.operation;
   if(!op||op.id!==CARRIER_INTERCEPTION.id||op.phase!=='return')return;
   const base=this.world.stations.get(op.baseId);
   if(!base||base.supplyIntercepted)return;
   finishFieldAssignment(this.fieldLoan,'operation',op);
   base.supplyIntercepted=true;base.carrierMission=null;this.operation=null;
   if(isOperationWaypoint(this.waypoint,op))this.waypoint=null;
   this.player.ore+=CARRIER_INTERCEPTION.rewardOre;
   recordSortieIncome(this,'ore','operation',CARRIER_INTERCEPTION.rewardOre);
   this.cockpit.resourceGain(CARRIER_INTERCEPTION.rewardOre,this.time);
   const previousLevel=this.player.level;
   this.collect({type:'data',value:CARRIER_INTERCEPTION.rewardData});
   const sabotageXp=this.awardStrategicExperience(claimStrategicSabotage(this.player,'carrier',base.id));
   recordSortieIncome(this,'data','operation',CARRIER_INTERCEPTION.rewardData);
   this.spawnClock=Math.max(this.spawnClock||0,10);
   this.heritage.vfx.nova(base.x,base.y,132,'green');
   this.heritage.station('claimContract',base.type);
   this.rewardNotice('СНАБЖЕНИЕ ПЕРЕХВАЧЕНО! +'+CARRIER_INTERCEPTION.rewardOre+' сплава, +'+
    CARRIER_INTERCEPTION.rewardData+' данных и опыта.'+
    (sabotageXp?' +'+sabotageXp+' опыта за срыв снабжения.':'')+
    ' Вдоль маршрута вражеские патрули станут реже.',previousLevel,6);
  }

 // After a successful intercept, the telemetry is valuable only when delivered.
 // Pursuers can be fought or outrun; they are not mandatory kill targets.
 updateCorridorReturn(op){
  const base=this.world.stations.get(op.baseId);
  if(!base||op.pursuitStarted||this.time<(op.pursuitRetryAt||0))return;
  const ambush=op.radio==='sent'?corridorAmbush(base,op):null;
  if(ambush?dist(this.player,ambush)>CORRIDOR_OPERATION.ambushRadius:op.radio!==undefined||dist(this.player,base)>900)return;
  const angle=Math.atan2(this.player.y-base.y,this.player.x-base.x);
  let spawned=0;
  for(const spec of [{type:'scout',back:255,side:-85},{type:'fighter',back:325,side:100}]){
   if(this.enemies.length>=RULES.maxEnemies)break;
   const def=ENEMY_TYPES[spec.type];if(!def)continue;
   const anchor=ambush||this.player,back=ambush?130:spec.back;
   let site=null;
   for(const offset of [0,.55,-.55,1.15,-1.15,Math.PI]){
    const a=angle+offset;
    const point={x:anchor.x+Math.cos(a)*back-Math.sin(a)*spec.side,
     y:anchor.y+Math.sin(a)*back+Math.cos(a)*spec.side};
    if(dist(this.player,point)<130||this.world.nearbyRocks(point.x,point.y,70)
      .some(rock=>rock.alive&&dist(point,rock)<rock.r+35))continue;
    if(this.enemies.some(e=>e.scenario==='corridor-pursuit'&&dist(e,point)<50))continue;
    site=point;break;
   }
   if(!site)continue;
   const hp=def.hp*(1+Math.min(1,this.time/900));
   this.enemies.push({serial:++this.enemySerial,group:++this.groupSerial,
    type:spec.type,...site,vx:0,vy:0,r:14,hp,maxHp:hp,
    damage:def.dmg,think:.12,fire:1.2,state:'hunt',commitUntil:0,
    target:this.player,angle:0,hit:0,expAwarded:false,
    scenario:'corridor-pursuit',protect:null,operationGuard:true,fieldChargeOperation:op.id,fieldChargeBaseId:op.baseId});
   spawned++;
  }
  if(spawned){
   op.pursuitStarted=true;
   this.notice('Засада на обратном пути. Уходите к доку на форсаже или примите бой.',4);
  }else op.pursuitRetryAt=this.time+.75;
 }

 stopCorridorRadio(op){
  if(op.radio!=='calling'||this.time>=op.radioAt)return;
  op.radio='blocked';
  if(this.operation===op)this.notice('Разведчик перехвачен. Засада на пути к доку сорвана.',4);
 }
 updateCorridorRadio(op){
  if(op.radio!=='calling')return;
  const scout=this.enemies.find(e=>e.serial===op.radioSerial);
  if(this.time<op.radioAt){
   if(scout&&(scout.hp<=0||scout.converted))this.stopCorridorRadio(op);
   return;
  }
  op.radio='sent';
  if(scout){delete scout.missionFlight;scout.think=0;}
  if(this.operation===op)this.notice('Тревога передана. На карте отмечена засада между глушителем и доком.',4.5);
 }

 // A tangible, single-use operation: a jammer, an EMP duel, and a return leg.
 updateCorridor(dt=0){
  if(this.dead)return;
  const op=this.operation?.id===CORRIDOR_OPERATION.id?this.operation:null;
  const pending=op||this.world?.home?.corridorMission;
  if(pending)this.updateCorridorRadio(pending);
  if(!op)return;
  if(op.phase==='return'){this.updateCorridorReturn(op);return;}
  if(op.hp<=0)return;
  const d=dist(this.player,op);
  // The actual charge controls warnings; after discharge there is a tactical window.
  if(this.time<(op.overheatedUntil||0)){
   op.pulseCharge=0;op.pulseLocked=false;
  }else if(d<=CORRIDOR_OPERATION.pulseRange||op.pulseLocked){
   op.pulseCharge=Math.min(CORRIDOR_OPERATION.pulsePeriod,(op.pulseCharge||0)+Math.max(0,dt));
   if(op.pulseCharge>=CORRIDOR_OPERATION.pulsePeriod*.28)op.pulseLocked=true;
   if(!op.pulseWarned&&op.pulseCharge>.25){
    op.pulseWarned=true;
    this.heritage.play?.('missionEmpCharge',.5,{x:op.x,y:op.y});
    this.notice('Бортовой ИИ: глушитель заряжает ЭМ-импульс. Выйдите за 315 м.',3.5);
   }
   if(op.pulseCharge>=CORRIDOR_OPERATION.pulsePeriod){
    op.pulseCharge=0;
    op.pulseLocked=false;op.pulseWarned=false;
    op.pulseFlashUntil=this.time+.55;
    op.overheatedUntil=this.time+2.3;
    this.heritage.vfx.nova(op.x,op.y,180,'cyan');
    this.heritage.play?.('missionEmpPulse',.27,{x:op.x,y:op.y});
    if(d<=CORRIDOR_OPERATION.pulseRange)
     this.hurt(CORRIDOR_OPERATION.pulseDamage,{x:op.x,y:op.y});
    this.notice('Бортовой ИИ: разряд! Глушитель перегревается — сейчас его защита слабее.',2.7);
   }
  }else{
   op.pulseCharge=Math.max(0,(op.pulseCharge||0)-Math.max(0,dt)*1.5);
   if(op.pulseCharge<=.01)op.pulseWarned=false;
  }
  if(d>op.escortTrigger&&op.hp>=op.maxHp)return;
  if(!op.guardsSpawned){
   const first=this.spawnCorridorGuard('scout',0);
   if(first)this.spawnCorridorGuard('fighter',1);
   if(first){
    op.guardsSpawned=true;op.reinforcementsAt=this.time+32;
    const bearing=Math.atan2(op.y-this.player.y,op.x-this.player.x)+.68;
    first.corridorCourier=true;
    first.missionFlight={x:op.x+Math.cos(bearing)*1120,y:op.y+Math.sin(bearing)*1120,speed:128};
    op.radio='calling';op.radioSerial=first.serial;op.radioAt=this.time+CORRIDOR_OPERATION.radioDelay;
    this.notice('Разведчик уходит передавать тревогу. Перехватите отмеченный корабль, пока идёт отсчёт.',4.8);
   }
  }else if((op.radio==='sent'||op.radio===undefined)&&op.waves<1&&this.time>=op.reinforcementsAt){
   if(this.spawnCorridorGuard('fighter',2)){
    op.waves++;this.notice('Глушитель вызвал подкрепление!',2.8);
   }
  }
 } spawnCorridorGuard(type,index,placement=null){
  if(this.enemies.length>=RULES.maxEnemies)return false;
  const op=this.operation;if(!op)return false;
  const def=ENEMY_TYPES[type];if(!def)return false;
  const angle=placement?.angle??([-1.15,1.12,2.55][index]??0);
  const offset=placement?.distance??(125+index*34);
  let x=op.x+Math.cos(angle)*offset,y=op.y+Math.sin(angle)*offset;
  // Do not place an escort inside a procedurally generated asteroid.
  for(let step=0;step<7;step++){
   const a=angle+step*TAU/7;
   const px=op.x+Math.cos(a)*offset,py=op.y+Math.sin(a)*offset;
   if(!this.world.nearbyRocks(px,py,55).some(rock=>dist(rock,{x:px,y:py})<rock.r+24)){
    x=px;y=py;break;
   }
  }
  const hp=def.hp*(1+Math.min(1,this.time/900));
  const enemy={serial:++this.enemySerial,group:++this.groupSerial,type,
   x,y,vx:0,vy:0,
   r:14,hp,maxHp:hp,damage:def.dmg,think:.12+index*.09,fire:1.2,
   state:'hunt',commitUntil:0,target:this.player,angle:0,hit:0,
   expAwarded:false,scenario:'corridor-escort',protect:null,
   operationGuard:true,fieldChargeOperation:op.id,fieldChargeBaseId:op.baseId};
  this.enemies.push(enemy);return enemy;
 }
 completeCorridor(){
  const op=this.operation;
  if(!op||op.id!==CORRIDOR_OPERATION.id||op.phase==='return')return;
  const base=this.world.stations.get(op.baseId);if(!base)return;
  op.phase='return';op.hp=0;op.pulseCharge=0;op.pulseLocked=false;
  if(op.radio==='idle')op.radio='blocked';
  this.waypoint={id:CORRIDOR_OPERATION.id,x:base.x,y:base.y,label:'Вернуться с телеметрией в док'};
  this.heritage.vfx.shipExplosion(op.x,op.y,55,'#b876ff');
  this.heritage.vfx.nova(op.x,op.y,160,'green');
  this.notice('Глушитель отключён. Вернитесь в док с телеметрией.'+
   (op.radio==='calling'?' Разведчик ещё может передать тревогу.':op.radio==='sent'?' Обойдите отмеченную засаду.':''),5);
 }
 deliverCorridor(){
  const op=this.operation;
  if(!op||op.id!==CORRIDOR_OPERATION.id||op.phase!=='return')return;
  const base=this.world.stations.get(op.baseId);if(!base||base.corridorSecured)return;
  finishFieldAssignment(this.fieldLoan,'operation',op);
  base.corridorSecured=true;base.corridorMission=null;this.operation=null;
  base.corridorQuiet=op.radio==='blocked'&&!!op.radioSerial;
  const courier=this.enemies.find(e=>e.corridorCourier&&e.serial===op.radioSerial);
  if(courier){delete courier.missionFlight;courier.think=0;}
  if(isOperationWaypoint(this.waypoint,op))this.waypoint=null;
  // The reclaimed corridor yields a lead to the next station, not free resources.
  const nextStation=chooseOperationLead(this.world,op,base.id,'lab',2400);
  if(nextStation){
   nextStation.discovered=true;
   this.world.discovered.add(nextStation.id);
   if(!this.waypoint)this.waypoint={id:nextStation.id,x:nextStation.x,y:nextStation.y,
    label:baseNames[nextStation.type]||'Станция'};
  }
  this.player.ore+=CORRIDOR_OPERATION.rewardOre;
  recordSortieIncome(this,'ore','operation',CORRIDOR_OPERATION.rewardOre);
  this.cockpit.resourceGain(CORRIDOR_OPERATION.rewardOre,this.time);
  const previousLevel=this.player.level;
  this.collect({type:'data',value:CORRIDOR_OPERATION.rewardData});
  const sabotageXp=this.awardStrategicExperience(claimStrategicSabotage(this.player,'corridor',base.id));
  recordSortieIncome(this,'data','operation',CORRIDOR_OPERATION.rewardData);
  this.heritage.vfx.nova(base.x,base.y,130,'green');
  this.heritage.station('claimContract',base.type);
  this.rewardNotice('КОРИДОР ОТКРЫТ! +'+CORRIDOR_OPERATION.rewardOre+' сплава, +'+CORRIDOR_OPERATION.rewardData+
   ' данных и опыта.'+(sabotageXp?' +'+sabotageXp+' опыта за отключение глушителя.':'')+
   (base.corridorQuiet?' Перехват разведчика расширил обзор карты у дока на '+corridorScanBonus(base)+' м.':'')+
   ' Патрулей у дока станет меньше. В ангаре открыт чертёж рельса: изготовление — 36 сплава.'+
   (nextStation?' На карте отмечена станция: '+(baseNames[nextStation.type]||'неизвестная')+'.':''),previousLevel,6);
 }

 updateProbe(){
  if(this.dead)return;
  const active=this.operation?.id===PROBE_OPERATION.id?this.operation:null;
  if(active&&active.phase!=='return'){
   active.hp??=PROBE_OPERATION.maxHp;
   active.r??=28;
   if(active.located===false&&dist(this.player,active)<=PROBE_OPERATION.detectRange){
    active.located=true;
    if(isOperationWaypoint(this.waypoint,active))
     this.waypoint={id:active.id,x:active.x,y:active.y,label:'Аварийный зонд'};
    this.notice('Зонд найден. Подлетите к нему и удерживайте '+this.controlLabel('interact')+' для ремонта.',4);
   }
   if(active.strikerSerial&&!this.enemies.some(e=>e.serial===active.strikerSerial)){
    // Recover a suspended mission whose attacker was culled in an older build.
    active.waves=Math.max(0,active.waves-1);active.strikerSerial=null;
   }
  }
  for(const striker of this.enemies){
   if(striker.missionStrike?.target!=='probe')continue;
   const op=active?.baseId===striker.probeAssault?active:
    this.world.stations.get(striker.probeAssault)?.probeMission;
   if(!op||op.phase==='return'||op.strikerSerial!==striker.serial)continue;
   if(striker.hp<=0||striker.converted){op.strikerSerial=null;continue;}
   this.updateMissionStrike(striker,op);
   if(op.hp<=0)this.loseProbe(op);
  }
 }
 loseProbe(op){
  const base=this.world.stations.get(op.baseId);if(!base)return;
  const active=this.operation===op;
  this.enemies=this.enemies.filter(e=>e.probeAssault!==op.baseId);
  op.strikerSerial=null;
  if(active)this.probeRepairing=false;
  this.heritage.vfx.shipExplosion(op.x,op.y,29,'#ff956c');
  if(op.repair>=PROBE_OPERATION.telemetryAt){
   op.phase='return';
   if(active)this.waypoint={id:op.id,x:base.x,y:base.y,label:'Лаборатория · сдать данные'};
   this.notice((active?'Зонд':'Отложенный зонд')+' потерян. Данные у вас, их можно сдать в лаборатории.',5);
  }else{
   base.probeMission=null;base.probeRetryAt=this.time+PROBE_OPERATION.retryDelay;
   finishFieldAssignment(this.fieldLoan,'operation',op);
   if(active){
    this.operation=null;
    if(isOperationWaypoint(this.waypoint,op))this.waypoint=null;
   }
   this.notice((active?'Зонд':'Отложенный зонд')+' потерян. Новый сигнал можно принять в лаборатории через '+PROBE_OPERATION.retryDelay+' с.',5);
  }
 }
 // A repair stage preserves earned progress while a striker forces the pilot to fight.
 repairProbe(dt){
  const op=this.operation;
  if(op?.id!==PROBE_OPERATION.id||op.phase==='return'||op.located===false||this.dead)return;
  const before=op.repair;
  if(this.time-(op.lastRepairCueAt??-Infinity)>=1.4){
   op.lastRepairCueAt=this.time;
   this.heritage.play('missionProbeWeld',1.1,{x:op.x,y:op.y});
  }
  const stage=PROBE_OPERATION.stages[op.waves];
  let repair=before+PROBE_OPERATION.repairPerSecond*dt;
  if(stage&&repair>=stage.at&&!op.strikerSerial){
   const striker=this.spawnCorridorGuard(stage.type,op.waves,{angle:stage.angle,distance:stage.range+120});
   if(striker){
    striker.probeAssault=op.baseId;
    this.prepareMissionStrike(striker,op,{...stage,target:'probe'});
    op.strikerSerial=striker.serial;op.waves++;
    if(op.waves===1){
     const screen=this.spawnCorridorGuard('scout',1,{angle:stage.angle-1.25,distance:415});
     if(screen)screen.probeAssault=op.baseId;
    }
    this.notice('Налётчик глушит ремонтный луч и наводится на зонд. Отпустите '+
     this.controlLabel('interact')+' и перехватите отмеченный корабль.',4.5);
   }else repair=Math.min(repair,stage.at);
  }
  const limit=op.strikerSerial?PROBE_OPERATION.stages[op.waves-1].limit:PROBE_OPERATION.maxRepair;
  op.repair=Math.max(before,Math.min(limit,repair));
  if(before<PROBE_OPERATION.telemetryAt&&op.repair>=PROBE_OPERATION.telemetryAt){
   op.repairMilestoneAt=this.time;
   this.heritage.play('missionProbeReady',.3,{x:op.x,y:op.y});
   this.notice('Координаты сохранены. Можно сдать данные в лаборатории или продолжить ремонт ради обзора карты.',4.8);
  }
  if(op.repair>=PROBE_OPERATION.maxRepair)this.completeProbe();
 }
 completeProbe(partial=false){
  const op=this.operation;
  if(!op||op.id!==PROBE_OPERATION.id)return;
  const base=this.world.stations.get(op.baseId);
  if(!base||base.probeRecovered||base.probeTelemetryDelivered)return;
  if(partial?(this.docked!==base||op.repair<PROBE_OPERATION.telemetryAt):
   (op.phase==='return'||op.repair<PROBE_OPERATION.maxRepair))return;
  finishFieldAssignment(this.fieldLoan,'operation',op);
  if(partial)base.probeTelemetryDelivered=true;else base.probeRecovered=true;
  base.probeMission=null;
  this.enemies=this.enemies.filter(e=>e.probeAssault!==op.baseId);
  this.operation=null;this.probeRepairing=false;
  if(isOperationWaypoint(this.waypoint,op))this.waypoint=null;
  const next=chooseOperationLead(this.world,op,base.id,'arsenal',2300);
  if(next){
   next.discovered=true;this.world.discovered.add(next.id);
   if(!this.waypoint)this.waypoint={id:next.id,x:next.x,y:next.y,
    label:baseNames[next.type]||'Станция'};
  }
  const ore=partial?PROBE_OPERATION.partialOre:PROBE_OPERATION.rewardOre;
  const data=partial?PROBE_OPERATION.partialData:PROBE_OPERATION.rewardData;
  this.player.ore+=ore;
  recordSortieIncome(this,'ore','operation',ore);
  this.cockpit.resourceGain(ore,this.time);
  const previousLevel=this.player.level;
  this.collect({type:'data',value:data});
  recordSortieIncome(this,'data','operation',data);
  if(!partial)this.heritage.vfx.nova(op.x,op.y,105,'cyan');
  this.heritage.station('claimContract',base.type);
  this.rewardNotice((partial?'ТЕЛЕМЕТРИЯ ДОСТАВЛЕНА. ':'ЗОНД ВОССТАНОВЛЕН. ')+'+'+ore+' сплава, +'+data+' опыта.'+
   (partial?'':' Обзор карты у лаборатории +300 м.')+
   (next?' Отмечен новый узел сети.':''),previousLevel,5.5);
 }
 syncShipLoadout(){
  if(!this.shipLoadout)return;
  const available=id=>MODULES[id]?.kind!=='manual'||!!matchingFieldLoan({fieldLoan:this.fieldLoan},id);
  this.shipLoadout.slots=this.shipLoadout.slots.map(id=>available(id)?id:null);
  if(this.hangarSession?.draft)this.hangarSession.draft.slots=this.hangarSession.draft.slots.map(id=>available(id)?id:null);
  this.weaponProfile=loadoutProfile(this.shipLoadout);
  this.syncManualWeaponSelection();
  if(!this.weaponProfile.resonator)this.fieldEffects=[];
  this.player.weaponSlots=this.shipLoadout.slots;
 }
 manualWeaponsHere(){
  return ['comet',...manualWeapons(this.weaponProfile,precisionRailUnlocked(this.world))];
 }
 syncManualWeaponSelection(){
  const next=selectedManual(this.selectedManualWeapon,this.manualWeaponsHere());
  if(next!==this.selectedManualWeapon){
   this.selectedManualWeapon=next;
   // Merely fitting a rail must not silently remove it from auto-fire.
   // The first desktop LMB shot switches this mount to manual operation.
   this.manualRailMode=false;
  }else if(next!=='rail')this.manualRailMode=false;
  this.canvas?.classList?.toggle('rail-manual',!!this.manualRailMode);
 }
 switchManualWeapon(step=1){
  if(this.dead||this.paused||!this.overlay.hidden)return false;
  const choices=this.manualWeaponsHere();if(choices.length<2)return false;
  this.selectedManualWeapon=cycleManual(this.selectedManualWeapon,choices,step);
  this.manualRailMode=false;
  this.canvas?.classList?.toggle('rail-manual',this.manualRailMode);
  this.notice('ЛКМ · '+(this.selectedManualWeapon==='rail'?'Рельсовое орудие':
   this.selectedManualWeapon==='howitzer'?'Гаубица':'Голубая комета')+' · удерживайте для прицеливания',2.4);
  this.hud();return true;
 }
 fireSelectedManualAt(point){
  const choice=manualClick(selectedManual(this.selectedManualWeapon,this.manualWeaponsHere()),
   this.manualRailMode,!!this.isTouchLayout);
  if(choice==='comet')return this.fireActiveMouseWeapon('comet',point);
  if(choice==='rail'){
   this.manualRailMode=true;this.canvas?.classList?.add('rail-manual');
   return this.fireManualRailAt(point);
  }
  if(choice==='howitzer')return this.callHowitzer(point);
  this.designateTargetAt(point);return true;
 }
 fireActiveMouseWeapon(kind,point){
  const result=fireMouseWeapon(this,kind,point);
  if(!result.ok){this.notice(result.reason,2);return false;}
  if(kind==='mines'){
   this.notice('МИННЫЙ ВЕЕР · капсулы летят в указанную область · '+result.count+' мины',2.5);
  }
  this.hud();return true;
 }
 suggestShipModule(id){
  return stageOwnedModule(this.shipLoadout,this.hangarSession,id,{baseActive:!!this.docked?.active,
   level:this.player.level,ore:this.player.ore,ranks:this.skillRanks,fieldLoan:this.fieldLoan,
   loadout:this.shipLoadout,firstHardwareReward:this.firstHardwareReward,earlyRail:!!this.world.home?.corridorSecured});
 }
 revealLoadoutApply(){
  this.overlay.querySelector('.hg-apply-bar')?.scrollIntoView({block:'center'});
  this.overlay.querySelector('[data-act="hgApply"]')?.focus({preventScroll:true});
 }
 hangarUpgrades(){
  return SKILLS.filter(s=>SHIP_UPGRADES.has(s.id)).map(s=>{
   const rank=this.skillRanks[s.id],maxed=rank>=s.max;
   const reason=maxed?'Максимум':this.player.level<s.from?'Нужен уровень '+s.from:
    s.requires&&!this.skillRanks[s.requires]?'Сначала '+SKILLS.find(x=>x.id===s.requires).title:
    !this.player.points?'Нужно очко развития':'Изучить · 1 очко';
   return {...s,rank,effect:maxed?'Изучено полностью':nextSkillEffect(s.id,rank,this.skillRanks),
    reason,canBuy:!maxed&&this.player.level>=s.from&&(!s.requires||this.skillRanks[s.requires])&&this.player.points>0};
  });
 }
 hangarAction(data){
  const developmentActions=new Set(['hgUpgrade','hgSpec','hgFrame','hgTacticEquip','hgTacticUnlock','hgTacticUpgrade']);
  if(this.dead||!this.paused||this.overlay.hidden||this.overlay.dataset.mode!=='base'||
   !(this.baseTab==='hangar'||this.baseTab==='development'&&developmentActions.has(data.act))||!this.docked?.active)return;
  if(data.act==='hgSlot'&&!slotOpen(this.shipLoadout,Number(data.id))){this.openDevelopment('ship');return;}
  if(data.act==='hgView'){
   // Backwards-compatible shortcut from legacy weapon-upgrade tabs.
   if(data.id==='weapon-upgrades'){this.openDevelopment('weapons',this.hangarSession.focusWeapon);return;}
   if(!['weapons','tactics','upgrades','services'].includes(data.id))return;
   this.hangarView=data.id;this.hangarSession.message='';this.heritage.ui('tab');this.renderDock();
   const nav=data.id==='weapons'||data.id==='weapon-upgrades'?'.hg-weapon-views':'.hg-view-nav';
   this.overlay.querySelector(nav+' [aria-pressed="true"]')?.focus({preventScroll:true});
   return;
  }
  if(data.act==='hgBorrow'){
   if(this.hangarSession.dirty(this.shipLoadout)){
    this.hangarSession.message='Сначала примените или отмените загруженную схему';this.renderDock();return;
   }
   const result=borrowAndFit(this.docked,this.shipLoadout,this.hangarSession.slot,data.id,
    {...this.baseState(),baseActive:true,ranks:this.skillRanks});
   if(result.ok){
    recordEconomyExpense(this,'services',result.loanCost);
    recordEconomyExpense(this,'weapons',result.cost);
    this.fieldLoan=result.fieldLoan;if(result.trial)this.fieldTrialTaken=true;
    this.shipLoadout=result.loadout;this.player.ore=result.ore;this.syncShipLoadout();
    this.hangarSession.begin(result.loadout);
    this.hangarSession.message=FIELD_WEAPONS[data.id].name+' · установлено · 3 заряда';
    this.heritage.ui('upgrade');
   }else{this.hangarSession.message=result.reason;this.heritage.ui('deny');}
   this.renderDock();
   if(result.ok)this.overlay.querySelector('[data-act="hgSlot"][data-id="'+this.hangarSession.slot+'"]')?.focus({preventScroll:true});
   return;
  }
  if(['hgTacticEquip','hgTacticUnlock','hgTacticUpgrade'].includes(data.act)){
   const act=({hgTacticEquip:'equip',hgTacticUnlock:'unlock',hgTacticUpgrade:'upgrade'})[data.act];
   const [id,path]=String(data.id||'').split(':');
   const outcome=applyTacticalChoice(this.tactical,act,id,{path,baseActive:true,
    level:this.player.level,activeBases:this.activeBases,ore:this.player.ore,points:this.player.points});
   if(outcome.ok){
    if(outcome.oreCost)recordEconomyExpense(this,'weapons',outcome.oreCost);
    this.tactical=outcome.state;this.player.ore=outcome.ore;this.player.points=outcome.points;
    this.hangarSession.message=TACTICAL_DEVICES[id].name+': '+
     (act==='equip'?'установлено':act==='unlock'?'получено':'ветка улучшена')+'.';
    this.heritage.ui('upgrade');
   }else{this.hangarSession.message=outcome.reason;this.heritage.ui('tab');}
   this.renderDock();return;
  }
  if(data.act==='hgUpgrade'){this.buySkill(data.id);return;}
  const result=this.hangarSession.dispatch(data,{loadout:this.shipLoadout,level:this.player.level,
   ore:this.player.ore,points:this.player.points,activeBases:this.activeBases,
   ranks:this.skillRanks,fieldLoan:this.fieldLoan,baseActive:this.docked.active,
   firstHardwareReward:this.firstHardwareReward,earlyRail:!!this.world.home?.corridorSecured});
  if(result?.ok){
   recordEconomyExpense(this,'weapons',Math.max(0,this.player.ore-result.ore));
   this.shipLoadout=result.loadout;this.player.ore=result.ore;
   if(result.type==='specialization')this.player.points=result.points;
   this.syncShipLoadout();
   this.heritage.ui('upgrade');
  }else this.heritage.ui('tab');
  if(data.act==='hgSlot'&&this.hangarSession.draft.slots[this.hangarSession.slot])this.hangarSession.catalog=false;
  this.renderDock();
  const selector='[data-act="'+data.act+'"]'+(data.id?'[data-id="'+data.id+'"]':'');
  const focus=this.overlay.querySelector(selector);
  if(focus&&!focus.disabled)focus.focus({preventScroll:true});
  if(result?.ok&&['hgEquip','hgUnequip'].includes(data.act))
   this.overlay.querySelector('[data-act="hgSlot"][data-id="'+this.hangarSession.slot+'"]')?.focus({preventScroll:true});
  if(data.act==='hgFocusWeapon'){
   this.overlay.querySelector('.hg-weapon-inspector')?.scrollIntoView({block:'nearest'});
  }
  if(data.act==='hgFocusTactic')this.overlay.querySelector('.hg-tactic-detail')?.scrollIntoView({block:'nearest'});
  if(data.act==='hgInstall'||data.act==='hgRemove')this.revealLoadoutApply();
  if(data.act==='hgSelect'){
   const choice=this.overlay.querySelector('.hg-inspector [data-act="hgInstall"]:not(:disabled)')||
    this.overlay.querySelector('.hg-inspector [data-act="hgCatalog"]');
   choice?.focus({preventScroll:true});
  }
  if((this.isTouchLayout||(typeof matchMedia==='function'&&matchMedia('(max-width:700px), (max-height:580px)').matches))&&
   ['hgSlot','hgShip','hgInstall','hgSelect','hgCatalog'].includes(data.act)){
   this.overlay.querySelector('.base-dialog').scrollTop=0;
  }
  if(data.act==='hgCatalog'){
   const selected=this.overlay.querySelector('.hg-arsenal [data-act="hgFocusWeapon"][aria-pressed="true"]')||
    this.overlay.querySelector('.hg-arsenal [data-act="hgFilter"]');
   selected?.focus({preventScroll:true});
   this.overlay.querySelector('.hg-arsenal')?.scrollIntoView({block:'start'});
  }
 }
 updateShipWeapons(dt){
  updateAutomaticWeapons(this,dt,!this.heavyCharge&&automaticFireAllowed(this.holdFire,
   this.mining.active,this.probeRepairing||this.openingRepairing||
    ['field-work','relay-prep'].includes(this.actionHeld?.kind)));
 }
  toggleManualRail(){
   if(this.dead||this.paused||!this.overlay.hidden)return false;
   if(!precisionRailUnlocked(this.world)){
    this.notice('Ручной прицел откроется после включения или захвата арсенала. Затем установите рельсовое орудие в ангаре.',5);return false;
   }
   if(!this.weaponProfile.rail){this.notice('Ручной прицел открыт. Установите рельсовое орудие в ангаре.',4);return false;}
   this.selectedManualWeapon='rail';this.manualRailMode=!this.manualRailMode;
   if(!this.manualRailMode)this.selectedManualWeapon='comet';
   this.canvas?.classList?.toggle('rail-manual',this.manualRailMode);
   this.notice(this.manualRailMode?
    'РЕЛЬС · РУЧНОЙ РЕЖИМ. Щёлкните рядом с врагом: прицел подхватит ближайшую цель. Остальные орудия стреляют сами.':
    'РЕЛЬС · АВТООГОНЬ. ЛКМ — комета (либо другое выбранное колесом орудие), ПКМ — мины.',4);
   this.heritage.ui('tab');this.hud();return true;
  }
  fireManualRailAt(point){
   if(this.dead||this.paused||!this.overlay.hidden||this.openingRepairing||
    this.actionHeld?.kind==='opening-repair')return false;
   const preparing=this.enemies.filter(e=>e.hp>0&&e.stationRaid?.chargeAt!=null);
   const result=fireAimedRail(this,point);
   if(!result.ok){this.notice(result.reason,2);return false;}
   const interrupted=preparing.some(e=>e.hp>0&&e.stationRaid?.chargeAt===null);
   this.notice(interrupted?'ПРИЦЕЛЬНЫЙ ВЫСТРЕЛ · подготовка импульса сорвана':result.hits?'ТОЧНЫЙ ВЫСТРЕЛ · попадание'+(result.hits>1?' ×'+result.hits:''):
    result.rocksHit?'Выстрел перехвачен астероидом':'Рельсовый выстрел прошёл мимо цели',1.6);
   this.hud();return true;
  }
 callHowitzer(point=null){
  if(this.dead||this.paused||!this.overlay.hidden||this.mining.active||
   this.probeRepairing||this.openingRepairing||this.actionHeld?.kind==='opening-repair')return false;
  const plan=planHowitzer(this,point);
  if(!plan.ok){this.notice(plan.reason,2.8);return false;}
  this.heavyCharge=plan.charge;this.heritage.play('rocket',.2);this.hud();return true;
 }
 baseState(){
  const topology=this.world.networkTopology();
  return {loadout:this.shipLoadout,tactical:this.tactical,controls:this.controls,hangarSession:this.hangarSession,skillRanks:this.skillRanks,points:this.player.points,hangarUpgrades:this.hangarUpgrades(),ore:this.player.ore,data:this.player.data,xp:this.player.xp,level:this.player.level,
   firstHardwareReward:this.firstHardwareReward,openingArc:this.openingArc,enemies:this.enemies,
   nextXp:expForNext(this.player.level),world:this.world,hp:this.player.hp,maxHp:this.player.maxHp,time:this.time,
   civilianBases:[...this.world.stations.values()].filter(b=>b.active&&!b.captured).length,
   relayGain:this.docked&&!this.docked.relayBoost?
    Math.max(0,this.world.networkTopology(this.docked.id).count-topology.count):0,
   activeBases:this.activeBases,connectedBases:topology.count,
   connected:!!this.docked?.active&&topology.linked.has(this.docked.id),
   allies:this.allies.length,droneRoles:this.allies.map(a=>a.role),network:this.network,doctrine:this.doctrine,
   droneDamage:this.allies.reduce((sum,a)=>sum+Math.max(0,a.maxHp-a.hp),0),
   charges:this.support.charges,contract:this.contract,operation:this.operation,baseTab:this.baseTab,
   menuBackLabel:this.menuBackLabel(),
   soundOn:this.heritage.soundOn,
   hangarView:this.hangarView||'weapons',skillBranch:this.skillBranch,
   developmentDomain:this.developmentDomain,developmentFocus:this.developmentFocus,
   developmentWeapon:this.developmentWeapon,
   developmentTactic:this.developmentTactic,isTouchLayout:this.isTouchLayout,
   pilotSkills:SKILLS,pilotDoctrines:DOCTRINES,nextSkillEffect,
   sortieReports:this.sortieReports,economyExpenses:this.economyExpenses,
   lastContractReceipt:this.lastContractReceipt,
    fieldLoan:this.fieldLoan,fieldTrialTaken:this.fieldTrialTaken,fieldTrialPickerOpen:!!this.fieldTrialPickerOpen,
    earlyRail:!!this.world.home?.corridorSecured,
    fieldReturnNotice:this.time-this.fieldReturnAt<6,
    position:{x:this.player.x,y:this.player.y},shield:this.player.shield,
   scanRemaining:Math.max(0,this.geoScanUntil-this.time),
   overchargeRemaining:Math.max(0,this.overchargeUntil-this.time),
   transfers:this.docked&&this.docked.active&&topology.linked.has(this.docked.id)?
    [...topology.linked].map(id=>this.world.stations.get(id))
     .filter(b=>b&&b.id!==this.docked.id)
     .map(b=>({id:b.id,x:b.x,y:b.y,type:b.type})):[]};
 }
 rememberDockView(){
  if(!this.overlay.querySelectorAll)return;
  const view=captureHangarView(this.overlay);
  this.stationViews||={};
  if(view.tab)this.stationViews[view.tab+':'+(view.section||'')]=view;
 }
 renderDock(){
  if(!this.docked)return;
  const focusIdentity=captureMenuControl(this.overlay);
  this.pendingStationModule=null;
  if(this.fieldLoan?.returnDue)this.returnBorrowedWeapon();
  this.syncShipLoadout();
  this.rememberDockView();
  const checkpointNote=this.saveAtStation();
  this.overlay.innerHTML=renderBasePanel(this.docked,{...this.baseState(),checkpointNote});
  const section=this.baseTab==='hangar'?(this.hangarView||'weapons'):
   this.baseTab==='development'?this.developmentDomain+':'+(this.developmentDomain==='pilot'?this.skillBranch:
    this.developmentDomain==='weapons'?(this.developmentWeapon||this.hangarSession.focusWeapon):
    this.developmentDomain==='tactics'?this.developmentTactic:''):'';
  const key=this.baseTab+':'+section;
  if(this.stationViews[key])restoreHangarView(this.overlay,this.stationViews[key]);
  this.presentMenu();
  paintProgressionLinks(this.overlay.querySelector('.prog-tree'));
  restoreMenuControl(this.overlay,focusIdentity,'[data-act="baseTab"][aria-selected="true"]');
  this.hud();
 }
 returnBorrowedWeapon(){
  this.fieldLoan=null;this.fieldReturnAt=this.time;this.syncShipLoadout();
 }
 offerContinuation(saved){
  this.pendingCheckpoint=saved;this.paused=true;this.pausedRenderPending=true;
  this.overlay.dataset.mode='run-start';this.overlay.hidden=false;this.heritage.pause('base');
  this.overlay.innerHTML=renderContinuation(saved,this.runStore?.issue);
  this.presentMenu('[data-act="'+(saved?'runContinue':'runNew')+'"]');
 }
 continueRun(){
  if(!this.pendingCheckpoint)return;
  try{restoreCheckpoint(this,this.pendingCheckpoint);}
  catch{this.notice('Сохранённый вылет не удалось восстановить. Запись оставлена без изменений.',6);return;}
  this.heritage.dead=false;
  this.deathSceneEnd=0;
  this.enemyComms=new EnemyComms();
  this.designatedTarget=null;this.targetField=null;this.interactionFocus=null;this.weaponFx=[];
  this.mouseArsenal=createMouseArsenal();this.mouseAim=null;this.mobileMineArmed=false;
  this.nearArsenalBonus=false;this.nearArsenalDefense=false;
  this.nearDockField=false;this.nearQuietLab=false;this.nearDock=null;
  if(this.enemyLearning){
   this.enemyLearning.lastPlayer=null;this.enemyLearning.lastObservation=-Infinity;
   this.enemyLearning.nextSave=this.time+15;
  }
  this.precisionRailAvailable=precisionRailUnlocked(this.world);
  this.manualRailMode=false;this.selectedManualWeapon=null;
  this.canvas?.classList?.remove('rail-manual');
  // Existing saves predate the reward: preserve their contract progress and
  // offer the choice once instead of requiring another completed contract.
  if(this.firstHardwareReward==null&&[...this.world.stations.values()].some(b=>
   (b.contractRuns||0)>0||b.contractClaimed||b.completedContract))this.firstHardwareReward='pending';
  this.visuals.updateSky(this.player.x,this.player.y);
  this.nearRocks=this.world.nearbyRocks(this.player.x,this.player.y,Math.max(this.vw,this.vh)*.85+450);
  this.localStations=this.world.nearbyStations(this.player.x,this.player.y,1000,false);
  this.grid?.clear();this.shotGrid?.clear();this.rockGrid?.clear();
  for(const rock of this.nearRocks)if(rock.alive)this.rockGrid?.insert(rock);
  this.pendingCheckpoint=null;this.syncShipLoadout();this.hangarSession.begin(this.shipLoadout);
  this.baseTab='summary';this.overlay.dataset.mode='base';this.overlay.hidden=false;
  this.stationExitArmed=true;
  this.heritage.pause('base');
  if(contractReadyAtStation(this.contract,this.docked))this.baseAction('claimContract','');
  else this.renderDock();
  this.notice('Вылет продолжен с последней стыковки.',4);
 }
 saveAtStation(){
  if(!this.runStore||this.dead||!this.paused||!this.docked?.active||this.docked.enemy||
   dist(this.player,this.docked)>RULES.baseInteract||this.overlay.dataset.mode==='run-start')return '';
  let result;
  try{result=this.runStore.save(captureCheckpoint(this,this.docked));}
  catch{result={ok:false,reason:'invalid'};}
  if(result.ok)return 'Вылет сохранён на этой станции. После перезагрузки продолжите отсюда.';
  if(result.reason==='conflict')return 'Вылет изменён в другой вкладке. Эта вкладка не перезаписывает сохранение; для продолжения перезагрузите игру.';
  if(result.reason==='unsupported')return 'Прежнее сохранение оставлено без изменений. Этот вылет пока не сохраняется.';
  return 'Не удалось сохранить вылет. Чтобы продолжить его, оставьте эту вкладку открытой.';
 }
 nearestInteractionStation(){
  let nearest=null,closest=RULES.baseInteract;
  for(const b of this.localStations){
   if(b.enemy)continue;
   const d=dist(b,this.player);
   if(d<=closest){closest=d;nearest=b;}
  }
  return nearest;
 }
 currentInteraction(){
  const arc=this.openingArc;
  if(openingArcActive(arc)&&arc.kind==='rescue'&&
   Math.hypot(this.player.x-arc.rescueX,this.player.y-arc.rescueY)<=OPENING_ARC.repairRange)
   return {kind:'opening-repair',target:{x:arc.rescueX,y:arc.rescueY},
    label:'Эвакуация',hold:true};
  const op=this.operation;
  const probe=op?.id===PROBE_OPERATION.id&&op.located!==false&&op.phase!=='return'?op:null;
  const relay=relayPrepInteraction(op,this.player);
  if(relay)return relay;
  const field=fieldOperationInteraction(op,this.player);
  if(field)return field;
  const rock=this.mining.target;
  const range=extractorStats(this.skillRanks.extractor||0,this.skillRanks.mining||0).range;
  return chooseInteraction({player:this.player,probe,station:this.nearestInteractionStation(),
   rock,probeRange:PROBE_OPERATION.repairRange,
   stationRange:RULES.baseInteract,rockRange:range+(rock?.r||0)*.3});
 }
 beginInteraction(source){
  if(this.dead||this.paused||!this.overlay.hidden||this.actionHeld)return false;
  const action=this.currentInteraction();
  if(!action)return false;
  if(action.kind==='station'){this.dock(action.target);return true;}
  this.heavyCharge=null;
  this.actionHeld={kind:action.kind,source,target:action.target};
  return true;
 }
 endInteraction(source=null){
  if(!this.actionHeld)return;
  if(source&&this.actionHeld.source!==source)return;
  this.actionHeld=null;this.probeRepairing=false;this.openingRepairing=false;this.mining.active=false;
  this.heritage.extraction(false);
 }
 toggleHoldFire(){
  if(this.dead||this.paused||!this.overlay.hidden)return;
  this.holdFire=!this.holdFire;
  this.heritage.ui('tab');
  this.notice(this.holdFire?
   'Автоогонь выключен: корабль и ведомые прекращают атаки; оружие остывает быстрее. Добыча по-прежнему создаёт сигнал.':
   'Автоогонь включён: корабль и ведомые вновь защищаются.',3.8);
  this.hud();
 }
 syncControlUI(){
  const button=$('actionBtn');
  if(button){
   const focus=this.actionHeld||this.interactionFocus;
   const label=focus?.kind==='repair'?'Ремонт':focus?.kind==='mine'?'Добыча':
    ['field-work','relay-prep'].includes(focus?.kind)?focus.label:
    focus?.kind==='opening-repair'?'Эвакуация':
    focus?.kind==='station'?'Станция':'Действие';
   if(button.textContent!==label)button.textContent=label;
   button.disabled=!focus;
   button.setAttribute('aria-label',focus?(focus.kind==='station'?'Открыть станцию':
    focus.kind==='opening-repair'?'Удерживать для эвакуации капсулы':
    ['field-work','relay-prep'].includes(focus.kind)?'Удерживать для действия: '+focus.label:
    focus.kind==='repair'?'Удерживать для ремонта зонда':'Удерживать для добычи'):'Нет объектов для взаимодействия');
  }
  const quiet=$('quietBtn');
  if(quiet){
   quiet.setAttribute('aria-pressed',String(this.holdFire));
   quiet.classList.toggle('is-quiet',this.holdFire);
   quiet.textContent=this.holdFire?'Огонь выкл.':'Огонь вкл.';
  }
  const hack=$('hackBtn');if(hack)hack.hidden=!this.hacks.length;
  const strike=$('strikeBtn');if(strike)strike.hidden=!(this.support?.charges>0);
   const ion=$('ionBtn'),spec=this.fieldLoan&&fieldWeapon(this.fieldLoan);
   const fitted=!!spec&&!!this.weaponProfile[spec.id];
   const ready=fitted&&this.fieldLoan.charges>0&&this.fieldLoan.cooldownUntil<=this.time;
   const tactic=this.tactical||createTactical(),tacticModule=TACTICAL_DEVICES[tactic.equipped];
   const tacticRemaining=Math.max(0,Math.ceil(tactic.readyAt-this.time));
    const tacticText=tacticModule.short+(tacticRemaining?' · '+tacticRemaining+' с':' · '+this.controlLabel('field'));
   const fieldText=spec?spec.short+' · '+this.fieldLoan.charges+'/'+spec.capacity+
    (this.fieldLoan.cooldownUntil>this.time?' · зарядка '+Math.ceil(this.fieldLoan.cooldownUntil-this.time)+' с':' · '+this.controlLabel('field')):'';
   if(ion){ion.hidden=false;ion.disabled=fitted?!ready:!!tacticRemaining;
    ion.textContent=fitted?fieldText.split(' · ')[0]:tacticModule.short;}
   const arsenal=this.mouseArsenal||createMouseArsenal();
   const cometRest=Math.max(0,Math.ceil(arsenal.cometReadyAt-this.time));
   const mineRest=Math.max(0,Math.ceil(arsenal.minesReadyAt-this.time));
   const mineButton=$('minefieldBtn');if(mineButton){
    mineButton.disabled=!!mineRest;mineButton.setAttribute('aria-pressed',String(!!this.mobileMineArmed));
    mineButton.textContent=mineRest?'Мины · '+mineRest+'с':this.mobileMineArmed?'Мины · цель':'Мины · выбор';
   }
   const status=$('fieldWeaponStatus');if(status){
    const manual=selectedManual(this.selectedManualWeapon,this.manualWeaponsHere());
    const manualText=manual==='rail'?(this.manualRailMode?'ЛКМ · РЕЛЬС (ручной)':'ЛКМ · РЕЛЬС (первый выстрел переводит в ручной режим)'):
     manual==='howitzer'?'ЛКМ · ГАУБИЦА':'ЛКМ · КОМЕТА'+(cometRest?' · '+cometRest+' с':' · готова');
    const wheel=this.manualWeaponsHere().length>1?' · колесо — сменить оружие':'';
    const text=[manualText+wheel,'ПКМ · МИНЫ'+(mineRest?' · '+mineRest+' с':' · готовы'),
     fitted?fieldText:tacticText].join(' | ');
    status.hidden=!text||this.paused||this.dead||!this.overlay.hidden;
    status.textContent=text;status.setAttribute('aria-label',text);
   }
   const precision=$('precisionBtn'),precisionAvailable=!!this.weaponProfile.rail&&
    (this.precisionRailAvailable??precisionRailUnlocked(this.world));
   if(precision){
    precision.hidden=!precisionAvailable;
    precision.setAttribute('aria-pressed',String(!!this.manualRailMode));
    precision.textContent=this.manualRailMode?'Рельс · руч.':'Рельс · авто';
    precision.setAttribute('aria-label',this.manualRailMode?
     'Перевести рельсовое орудие в автоматический режим':
     'Перевести рельсовое орудие в ручной режим прицеливания');
   }
   const heavy=$('heavyBtn');if(heavy){heavy.hidden=!this.weaponProfile.howitzer;
    heavy.disabled=!!this.heavyCharge||!!this.heavyShells?.length||this.heavyCooldown>0||this.weaponThermal.locked;
    heavy.textContent=this.heavyCharge?'Подготовка…':this.heavyShells?.length?'Гаубица · полёт':this.heavyCooldown>0?'Гаубица · '+Math.ceil(this.heavyCooldown)+'с':'Гаубица';}
   const controlLabels=[['hudHackSlot','hack'],['hudStrikeSlot','strike'],['burst','dash']];
   for(const [id,action] of controlLabels){
    const key=$(id)?.querySelector?.('.hud-ability-key');
    if(key)key.textContent=readableKey((this.controls||DEFAULT_CONTROLS)[action]);
   }
   const tip=$('tips');if(tip){
    const key=action=>readableKey((this.controls||DEFAULT_CONTROLS)[action]);
    const chosen=selectedManual(this.selectedManualWeapon,this.manualWeaponsHere());
    const shot=chosen==='rail'?'рельс':chosen==='howitzer'?'гаубица':'комета';
    const flight=['up','left','down','right'].map(key).join('/');
    const base=flight+' / стрелки — полёт · '+key('dash')+' — рывок · '+key('interact')+
     ' — действие · ЛКМ — '+shot+' · ПКМ — мины · '+key('field')+' — поле';
    const extra=(this.manualWeaponsHere().length>1?' · колесо — сменить орудие':'')+
     ' · Tab / M — карта · Esc — меню';
    if(tip.textContent!==base+extra)tip.textContent=base+extra;
   }
  const skills=$('skillBtn');
  if(skills)skills.classList.toggle('has-points',this.player.points>0);
 }
 drawInteractionFocus(c,cam){
  const held=this.actionHeld;
  // The two new 3D-looking mission objects already carry charge/repair visuals.
  // A second dashed circle and a generic 'Action' label would cover their art.
  if(held?.kind==='field-work'&&['two-fronts','broken-convoy'].includes(this.operation?.id))return;
  const focus=held?
   (held.kind==='mine'&&this.mining.target?.alive?
    {kind:'mine',target:this.mining.target,label:'Добыча'}:
    held.kind==='opening-repair'&&openingArcActive(this.openingArc)?
     {kind:'opening-repair',target:{x:this.openingArc.rescueX,y:this.openingArc.rescueY},label:'Эвакуация'}:
    held.kind==='repair'&&this.operation?.id===PROBE_OPERATION.id?
     {kind:'repair',target:this.operation,label:'Ремонт'}:
    ['field-work','relay-prep'].includes(held.kind)?{kind:held.kind,target:held.target,
     label:held.kind==='relay-prep'?'Установка барьера':'Действие'}:null):this.interactionFocus;
  if(!focus?.target||outsideCamera(focus.target.x,focus.target.y,cam,85))return;
  const t=focus.target,r=focus.kind==='mine'?t.r+12:focus.kind==='station'?61:38;
  c.save();c.lineWidth=1.7;c.strokeStyle=['repair','opening-repair','field-work','relay-prep'].includes(focus.kind)?'#ffc678':
   focus.kind==='station'?'#87f0cf':'#7de5f5';
  c.setLineDash([7,6]);c.beginPath();c.arc(t.x,t.y,r,0,TAU);c.stroke();
  c.setLineDash([]);c.fillStyle='#c9f6f6';c.font='bold 12px system-ui';
  c.textAlign='center';
  if(!(focus.kind==='mine'&&this.mining.active))
   c.fillText(focus.label+(this.isTouchLayout?'':' · '+this.controlLabel('interact')),t.x,t.y-r-13);
  c.restore();
 }
 drawOpeningBeacon(c,cam){
  const arc=this.openingArc;
  if(!openingArcActive(arc)||arc.kind!=='rescue'||
    outsideCamera(arc.rescueX,arc.rescueY,cam,105))return;
  const x=arc.rescueX,y=arc.rescueY;
  const glow=this.visuals.reducedMotion?0:Math.sin(this.time*3)*4;
  c.save();c.translate(x,y);
  c.fillStyle='#10283c';c.strokeStyle='#f4c17c';c.lineWidth=2.5;
  c.beginPath();c.roundRect(-30,-17,60,34,8);c.fill();c.stroke();
  c.fillStyle='#f9c887';c.fillRect(-12,-7,24,14);
  c.strokeStyle='#78f5de';c.lineWidth=2;
  c.beginPath();c.arc(0,0,44+glow,0,TAU);c.stroke();
  c.strokeStyle='#ffda92';c.lineWidth=4;
  c.beginPath();c.arc(0,0,53,-Math.PI/2,
   -Math.PI/2+TAU*(arc.repair/OPENING_ARC.repairSeconds));c.stroke();
  c.textAlign='center';c.font='bold 12px system-ui';c.fillStyle='#fff1d0';
  c.fillText('АВАРИЙНАЯ КАПСУЛА',0,-66);
  c.font='11px system-ui';
  c.fillText(Math.round(arc.repair/OPENING_ARC.repairSeconds*100)+'% · '+
   (this.isTouchLayout?'ДЕРЖИТЕ «ДЕЙСТВИЕ»':'УДЕРЖИВАЙТЕ '+this.controlLabel('interact')),0,-51,220);
  c.restore();
  if(this.openingRepairing){
   c.save();c.strokeStyle='#83fbe4';c.lineWidth=3;
   c.beginPath();c.moveTo(this.player.x,this.player.y);c.lineTo(x,y);c.stroke();c.restore();
  }
 }
  dock(selected=null){
  if(this.dead)return;
  if(!this.overlay.hidden&&this.overlay.dataset.mode==='base'){this.dismiss();return;}
  const b=selected?
   (dist(selected,this.player)<=RULES.baseInteract?selected:null):
   this.world.nearbyStations(this.player.x,this.player.y,210,false)
    .filter(s=>dist(s,this.player)<=RULES.baseInteract)
    .sort((a,c)=>dist(a,this.player)-dist(c,this.player))[0];
  if(!b){this.heritage.ui('deny');this.notice('Подлетите ближе к станции ('+this.controlLabel('interact')+')',2);return;}
  if(this.operation?.id===CORRIDOR_OPERATION.id&&this.operation.phase==='return'&&this.operation.baseId===b.id)this.deliverCorridor();
   if(this.operation?.id===CARRIER_INTERCEPTION.id&&this.operation.phase==='return'&&this.operation.baseId===b.id)this.deliverCarrierInterception();
   if(this.fieldLoan?.returnDue||(this.fieldLoan?.missionStarted&&!this.fieldLoan.assignment&&!this.operation&&!this.contract))this.returnBorrowedWeapon();
  const report=finishSortie(this.sortieStart,this,b);
  this.sortieReports=appendSortieReport(this.sortieReports,report);
  this.sortieStart=null;
  this.endInteraction();
  this.hangarSession?.begin(this.shipLoadout);
  this.fieldTrialPickerOpen=false;
  this.docked=b;this.stationViews={};this.baseTab='summary';this.hangarView='weapons';this.paused=true;this.pausedRenderPending=true;
  if(isFieldOperation(this.operation)&&this.operation.phase==='return'&&this.operation.baseId===b.id)
   this.finishFieldOperation();
  this.stationExitArmed=true;
  this.heritage.pause('base');
  this.overlay.dataset.mode='base';this.overlay.hidden=false;
  this.heritage.ui('dock');
  if(contractReadyAtStation(this.contract,b))this.baseAction('claimContract','');
  else this.renderDock();
 }
 askStationModule(role){
  this.pendingStationModule=null;
  this.overlay.querySelector('.base-module-confirm')?.remove();
  const base=this.docked,spec=base?stationModule(base.type,role):null;
  if(this.overlay.dataset.mode!=='base'||!base?.active||!spec||base.module||this.player.ore<spec.cost){
   this.heritage.ui('deny');this.notice('Недостаточно сплава или модуль уже выбран',2.5);return;
  }
  const container=this.overlay.querySelector('.base-modules');if(!container)return;
  const panel=document.createElement('aside');panel.className='base-module-confirm';
  panel.setAttribute('role','alertdialog');panel.setAttribute('aria-modal','true');
  panel.setAttribute('aria-labelledby','base-module-confirm-title');
  panel.setAttribute('aria-describedby','base-module-confirm-desc');
  const heading=document.createElement('strong');heading.textContent='Подтвердить выбор: '+spec.name;
  heading.id='base-module-confirm-title';
  const explanation=document.createElement('p');explanation.textContent=spec.desc+' Стоимость: '+spec.cost+
   ' сплава. После установки изменить специализацию этой станции в этом прохождении нельзя.';
  explanation.id='base-module-confirm-desc';
  const buttons=document.createElement('div');
  const cancel=document.createElement('button');cancel.type='button';cancel.dataset.act='cancelModule';cancel.dataset.role=role;cancel.textContent='Вернуться к выбору';
  const confirm=document.createElement('button');confirm.type='button';confirm.dataset.act='confirmModule';confirm.dataset.role=role;confirm.className='base-decision-primary';confirm.textContent='Установить за '+spec.cost+' сплава';
  confirm.setAttribute('aria-describedby','base-module-confirm-desc');
  buttons.append(cancel,confirm);panel.append(heading,explanation,buttons);container.append(panel);
  this.pendingStationModule={baseId:base.id,role,cost:spec.cost};
  panel.scrollIntoView({block:'nearest'});
  // Keep focus on the safe choice: holding Enter on the first purchase button
  // must not accidentally accept the newly created, irreversible decision.
  cancel.focus({preventScroll:true});
 }
 confirmStationModule(role){
  const pending=this.pendingStationModule,base=this.docked;
  const panel=this.overlay.querySelector('.base-module-confirm');
  const spec=base?stationModule(base.type,role):null;
  if(this.overlay.dataset.mode!=='base'||!panel||!pending||!base||
   pending.baseId!==base.id||pending.role!==role||pending.cost!==spec?.cost){
   this.heritage.ui('deny');return false;
  }
  this.pendingStationModule=null;
  this.baseAction('installModule',role);
  return true;
 }
 cancelStationModule(role){
  this.pendingStationModule=null;
  this.overlay.querySelector('.base-module-confirm')?.remove();
  this.overlay.querySelector('[data-act="installModule"][data-role="'+role+'"]')?.focus({preventScroll:true});
 }
 baseAction(act,role){
  const b=this.docked,p=this.player;if(!b||this.dead)return;
  const o=baseOffer(b,this.baseState());
  if(act==='loanField'||act==='loanIon'){
   const id=act==='loanIon'?'ion':role,offer=fieldLoanOffer(b,this.baseState(),id);
   if(!offer||offer.mode==='return'||offer.reason){this.heritage.ui('deny');return;}
   if(this.hangarSession.dirty(this.shipLoadout)){
    this.hangarSession.message='Сначала примените или отмените предварительную сборку оружия.';
    this.baseTab='hangar';this.hangarView='weapons';this.heritage.ui('deny');this.renderDock();return;
   }
   p.ore-=offer.cost;
   recordEconomyExpense(this,'services',offer.cost);
   this.fieldLoan=createFieldLoan(id,b.id,this.time,missionAssignment(this.operation,this.contract));
   const suggested=this.suggestShipModule(id);
   if(suggested){
    const fit=this.hangarSession.dispatch({act:'hgApply'},{...this.baseState(),loadout:this.shipLoadout,
     ranks:this.skillRanks,baseActive:true});
    if(fit?.ok){this.shipLoadout=fit.loadout;this.player.ore=fit.ore;this.syncShipLoadout();}
   }
   if(offer.mode==='trial')this.fieldTrialTaken=true;
   this.fieldTrialPickerOpen=false;
   this.baseTab='hangar';
   if(!suggested)this.hangarView='weapons';
   const name=FIELD_WEAPONS[id].name;
   this.hangarSession.message=suggested?name+' установлен. Можно вылетать.':
    name+' на складе. Выберите узел корабля, затем этот модуль.';
   this.notice(this.hangarSession.message,5);this.heritage.ui('upgrade');this.renderDock();
   return;
  }
  if(act==='returnField'||act==='returnIon'){
   if(!this.fieldLoan)return;
   const name=fieldWeapon(this.fieldLoan).name;this.returnBorrowedWeapon();
   this.notice(name+' возвращён на станцию',3.2);this.heritage.ui('dock');this.renderDock();return;
  }
  if(act==='fieldCharge'){
   const quote=refillQuote(this.fieldLoan,p.ore);
   if(!quote.ok){this.notice(quote.reason,2.5);this.heritage.ui('deny');return;}
   p.ore-=quote.cost;this.fieldLoan.charges=quote.charges;
   recordEconomyExpense(this,'services',quote.cost);
   this.notice(fieldWeapon(this.fieldLoan).short+': зарядов '+quote.charges+'/3 · −'+quote.cost+' сплава',3);
   this.heritage.ui('upgrade');this.renderDock();return;
  }
   if(act==='claimProbeData'){
    const probe=this.operation||b.probeMission;
    if(!probeDataReady(b,probe)||!this.paused||this.overlay?.dataset.mode!=='base')return;
    this.operation=probe;
    this.completeProbe(true);this.pausedRenderPending=true;this.renderDock();return;
   }
   if(act==='acceptFieldOperation'){
   const [id,choice='safe']=String(role).split(':');
    if(this.operation||!b.active||!fieldOperationIds(b.type).includes(id)||
      (b.fieldOperationCooldowns?.[id]||0)>this.time||
      (id==='broken-convoy'&&!['safe','fast'].includes(choice))){
     this.heritage.ui('deny');this.notice('Сейчас эта операция недоступна.',2.5);return;
    }
    const attempt=b.fieldOperationAttempts?.[id]??b.fieldOperationRuns?.[id]??0;
    const fullRuns=b.fieldOperationFullRuns?.[id]??b.fieldOperationRuns?.[id]??0;
    const mission=createFieldOperation(id,b,this.world,attempt,choice,this.player.level,fullRuns);
    if(!mission){this.heritage.ui('deny');this.notice('Подходящий участок пока не найден.',3);return;}
    b.fieldOperationAttempts??={};b.fieldOperationAttempts[id]=attempt+1;
    this.operation=mission;b.fieldMission=mission;
    bindFieldLoan(this.fieldLoan,missionAssignment(mission,this.contract));
    this.waypoint={id:mission.id,x:mission.x,y:mission.y,label:mission.name};
    this.heritage.station('acceptContract',b.type);
    this.notice('«'+mission.name+'»: цель отмечена на карте. У задания несколько исходов.',5);
    this.pausedRenderPending=true;this.renderDock();return;
   }
   if(act==='claimFieldOperation'){
    if(this.finishFieldOperation(true)){this.pausedRenderPending=true;this.renderDock();}
    return;
   }
   if(act==='acceptOperation'){
   const corridor=isCorridorDock(b),probe=isProbeLab(b),relay=isRelayArsenal(b),carrier=isCarrierBase(b);
   if(!b.active||this.operation||(!corridor&&!probe&&!relay&&!carrier)||
    (corridor&&b.corridorSecured)||(probe&&(b.probeRecovered||b.probeTelemetryDelivered||b.probeRetryAt>this.time))||
    (relay&&(b.relayDefenseDone||b.relayRetryAt>this.time))||
     (carrier&&(b.supplyIntercepted||b.carrierRetryAt>this.time))){
    this.heritage.ui('deny');this.notice('Особая операция сейчас недоступна',2.3);return;
   }
   this.operation=corridor?(b.corridorMission||createCorridorOperation(b)):
    probe?(b.probeMission||createProbeOperation(b,this.world)):
    relay?(b.relayMission||createRelayDefense(b,this.world)):
     (b.carrierMission||createCarrierInterception(b));
   if(!this.operation)return;
    bindFieldLoan(this.fieldLoan,missionAssignment(this.operation,this.contract));
   if(corridor)b.corridorMission=this.operation;
   else if(probe)b.probeMission=this.operation;
   else if(relay)b.relayMission=this.operation;
   else b.carrierMission=this.operation;
   const returning=this.operation.phase==='return';
   const destination=operationDestination(this.operation,this.world);
   this.waypoint={id:this.operation.id,x:destination.x,y:destination.y,
    label:returning?(carrier?'Вернуться на авианосец':probe?'Лаборатория · сдать данные':'Вернуться с телеметрией в док'):
     corridor?'Вражеский глушитель':probe?(this.operation.located===false?'Район поиска зонда':'Аварийный зонд'):
      relay?'Боевой ретранслятор':'Район перехвата груза'};
   if(this.baseTab!=='summary')this.baseTab='operations';
   if(returning&&!probe){if(carrier)this.deliverCarrierInterception();else this.deliverCorridor();
    this.pausedRenderPending=true;this.renderDock();return;}
   this.heritage.station('acceptContract',b.type);
   this.notice(corridor?'«Глухой коридор»: цель отмечена на карте. Подготовьте корабль и вылетайте.':
    probe?(returning?'Данные у вас. Сдайте их в разделе операций.':
     '«Последний сигнал»: следуйте в район поиска. Бортовой сканер уточнит направление при сближении.'):
    relay?'«Оборона ретранслятора»: подлетите к отмеченному узлу. Налёт начнётся после сближения.':
     '«Перехват снабжения»: найдите отмеченный район встречи. Груз тронется только при обнаружении.',5);
   this.pausedRenderPending=true;this.renderDock();return;
  }
  if(act==='antenna'){
   if(o.reasons.antenna){this.heritage.ui('deny');this.notice(o.reasons.antenna,2.6);return;}
   p.ore-=o.antennaCost;b.relayBoost=true;
   recordEconomyExpense(this,'stations',o.antennaCost);
   const topology=this.world.networkTopology();
   this.cachedNetworkLinked=topology.linked;
   this.defenseTopology=null;
   synchronizeStationDefenses(this.world,this.time,topology);
   this.notice('Антенна усилена · в сети '+topology.count+' станций',3.5);
   this.heritage.vfx.nova(b.x,b.y,105,'cyan');
   this.heritage.station('upgrade',b.type,{tech:'relay'});
   this.pausedRenderPending=true;this.renderDock();return;
  }
  if(act==='installModule'){
   const spec=stationModule(b.type,role);
   if(!b.active||!spec||b.module||p.ore<spec.cost){this.heritage.ui('deny');this.notice('Модуль недоступен: проверьте сплав и оснащение станции',3);return;}
   p.ore-=spec.cost;b.module=role;
   recordEconomyExpense(this,'stations',spec.cost);
   this.notice('Оснащение станции: '+spec.name+' · −'+spec.cost+' сплава',3.2);
   this.heritage.vfx.nova(b.x,b.y,96,'cyan');
   this.heritage.station('upgrade',b.type,{tech:'module'});
   this.pausedRenderPending=true;this.renderDock();return;
  }
  if(act==='acceptContract'){
   if(!b.active||this.contract||(b.contractCooldownUntil||0)>this.time)return;
   const c=o.contractOptions.find(item=>item.id===role)||(!role?o.contractOptions[0]:null);
   if(!c)return;
   this.contract={baseId:b.id,kind:c.kind,goal:c.goal,progress:0,choiceId:c.id,
    name:c.name,ore:c.ore,data:c.data};
    bindFieldLoan(this.fieldLoan,missionAssignment(this.operation,this.contract));
   this.notice('Задание принято: '+c.name+' · '+c.goal+' целей',3.2);
   this.heritage.station(act,b.type);
   this.pausedRenderPending=true;this.renderDock();return;
  }else if(act==='claimContract'){
   const c=this.contract;
   if(!b.active||!c||c.baseId!==b.id||c.progress<c.goal)return;
   b.contractClaimed=true;b.completedContract=c.choiceId;
   b.contractRuns=(b.contractRuns||0)+1;b.contractCooldownUntil=this.time+150;
   this.contract=null;
   finishFieldAssignment(this.fieldLoan,'contract',c);
   p.ore+=c.ore;this.cockpit.resourceGain(c.ore,this.time);
   const previousLevel=p.level;
   this.collect({type:'data',value:c.data});
   const levelsGained=p.level-previousLevel;
   this.sortieReports=creditContractReward(this.sortieReports||[],c,b);
   this.lastContractReceipt={ore:c.ore,data:c.data,levelsGained,
    credited:this.sortieReports.some(r=>r.id===c.completedSortieId&&r.details?.oreContracts>=c.ore)||
     (c.completedSortieId==null&&this.sortieReports.some(r=>r.baseId===b.id))};
   if(this.waypoint?.id===b.id&&this.waypoint.label?.startsWith('Награда:'))this.waypoint=null;
   if(this.firstHardwareReward==null)this.firstHardwareReward='pending';
   this.baseTab='summary';
   this.rewardNotice('Поручение выполнено: +'+c.ore+' сплава · +'+c.data+
    ' данных · +'+c.data+' опыта.'+
    (this.firstHardwareReward==='pending'?' Выберите бесплатное оружие!':''),previousLevel,5);
   this.heritage.station(act,b.type);
   this.pausedRenderPending=true;this.renderDock();return;
  }else if(act==='claimFirstModule'){
   if(!b.active||!this.paused||this.overlay?.hidden||this.overlay?.dataset?.mode!=='base')return;
   const preserveDraft=!!this.hangarSession?.dirty?.(this.shipLoadout);
   const reward=claimFirstContractModule(this.shipLoadout,this.firstHardwareReward,role,{preserveDraft});
   if(!reward.ok){this.heritage.ui('deny');this.notice(reward.reason,3);return;}
   this.shipLoadout=reward.loadout;this.firstHardwareReward=reward.status;
   if(this.lastContractReceipt){
    this.lastContractReceipt.firstHardwareReward=role;
    this.lastContractReceipt.firstHardwareInstalled=reward.installed;
   }
   if(!preserveDraft)this.hangarSession?.begin(this.shipLoadout);
   this.syncShipLoadout();
   this.notice(MODULES[role].name+(reward.installed?' установлен на корабль!':
    ' получен на склад; освободите узел в ангаре.'),5);
   this.heritage.ui('upgrade');
   this.pausedRenderPending=true;this.renderDock();return;
  }else if(act==='respec'){
   if(!b.active||!this.doctrine||p.ore<12){this.notice('Нужны активная база и 12 сплава',2);return;}
   p.ore-=12;this.doctrine=null;p.points++;
   recordEconomyExpense(this,'services',12);
   this.heritage.station('respec',b.type);
   this.openDevelopment('pilot');return;
  }
  if(act==='activate'){
   if(o.reasons.activate){this.notice(o.reasons.activate,2);return;}
    const precisionUnlockedHere=b.type==='arsenal'&&!precisionRailUnlocked(this.world);
    const labUnlockedHere=b.type==='lab'&&!labLogisticsUnlocked(this.world);
   p.ore-=o.relayCost;
   recordEconomyExpense(this,'stations',o.relayCost);
   b.active=true;b.discovered=true;this.activeBases++;b.activationIndex=this.activeBases;
    if(precisionUnlockedHere)this.precisionRailAvailable=true;
    if(this.waypoint?.id===b.id)this.waypoint=null;
   b.activated=true;b.activationTime=this.time;
   p.ore+=o.rewardAlloy;
   p.hp=Math.min(p.maxHp,p.hp+o.rewardRepair);
   const previousLevel=p.level;
   const stationXp=this.awardStrategicExperience(claimStationActivation(p,b));
   const topology=this.world.networkTopology();
   this.cachedNetworkLinked=topology.linked;
   this.defenseTopology=null;
   synchronizeStationDefenses(this.world,this.time,topology);
    this.rewardNotice('Станция активна'+(topology.linked.has(b.id)?
    ' · подключено узлов: '+topology.count:' · ищите ретранслятор')+
    (o.rewardAlloy?' · +'+o.rewardAlloy+' сплава':'')+
     (stationXp?' · +'+stationXp+' опыта':'')+
     (o.relayCost?' · −'+o.relayCost+' сплава':'')+
     (precisionUnlockedHere?' · ОТКРЫТО: '+PRECISION_RAIL_TECH.name+' (ЛКМ)':'')+
     (labUnlockedHere?' · ОТКРЫТО: '+LAB_LOGISTICS_TECH.name+' (карта)':
      b.type==='lab'?' · Область радиоперехвата расширена':''),
     previousLevel,precisionUnlockedHere||labUnlockedHere?7:3.8);
   this.heritage.vfx.nova(b.x,b.y,130,'cyan');
   this.refreshAutomaticContours();
  }else if(!b.active){this.notice('Сначала активируйте станцию',2);return;}
  else if(act==='hire'){
   if(o.reasons.hire||role!==o.drone.role){this.notice(o.reasons.hire||'Нет такого дрона',2);return;}
   p.ore-=o.hireCost;
   recordEconomyExpense(this,'drones',o.hireCost);
   if(o.replacing)this.allies.splice(o.replacementIndex,1);
   const maxHp=role==='fighter'?78:58;
   this.allies.push({serial:++this.allySerial,role,x:b.x,y:b.y,vx:0,vy:0,
    r:role==='fighter'?15:13,hp:maxHp,maxHp,fire:.3,think:0,
    state:'follow',commitUntil:0,message:'Вылетаю с базы',
    messageUntil:this.time+2.2,angle:0});
   this.notice((o.replacing?'Дрон заменён: ':'Нанят ')+o.drone.name+' · '+this.allies.length+' / '+o.cap,2.6);
   this.heritage.vfx.nova(b.x,b.y,58,'cyan');
  }else if(act==='upgrade'){
   if(o.reasons.upgrade){this.notice(o.reasons.upgrade,2);return;}
   p.ore-=o.upgradeCost;this.network[o.tech.key]++;b.usedUpgrade=true;
   recordEconomyExpense(this,'stations',o.upgradeCost);
   this.notice('Технология: '+o.tech.name+' · уровень '+this.network[o.tech.key],3);
   this.heritage.vfx.nova(b.x,b.y,90,'violet');
  }else if(act==='repair'){
   if(o.reasons.repair){this.notice(o.reasons.repair,2);return;}
   p.ore-=o.repairCost;p.hp=Math.min(p.maxHp,p.hp+Math.round(p.maxHp*.45));
   recordEconomyExpense(this,'repairs',o.repairCost);
   this.notice('Корпус восстановлен',2.4);
   this.heritage.vfx.nova(p.x,p.y,70,'green');
  }else if(act==='repairDrones'){
   if(o.reasons.drones){this.notice(o.reasons.drones,2);return;}
   p.ore-=o.droneRepairCost;
   recordEconomyExpense(this,'repairs',o.droneRepairCost);
   for(const a of this.allies)a.hp=a.maxHp;
   this.notice('Дроны восстановлены',2.4);
   this.heritage.vfx.nova(b.x,b.y,60,'green');
  }else if(act==='service'){
   if(!o.localService||o.reasons.service){
    this.notice(o.reasons.service||'Услуга недоступна',2);return;
   }
   p.ore-=o.localService.cost;
   recordEconomyExpense(this,'services',o.localService.cost);
   if(b.type==='dock')p.shield=Math.max(30,p.shield);
   else if(b.type==='lab')this.geoScanUntil=this.time+o.localService.duration;
   else if(b.type==='arsenal')this.overchargeUntil=this.time+o.localService.duration;
   this.notice(o.localService.name+' · −'+o.localService.cost+' сплава',3);
   this.heritage.vfx.nova(b.x,b.y,78,'cyan');
  }else if(act==='supply'){
   if(o.reasons.supply){this.notice(o.reasons.supply,2);return;}
   p.ore-=o.chargeCost;this.support.charges++;
   recordEconomyExpense(this,'services',o.chargeCost);
   this.notice('Вылетов: '+this.support.charges+' / 2 · B: удар у базы или прикрытие внутри своего контура',3.4);
   this.heritage.vfx.nova(b.x,b.y,70,'cyan');
  }else if(act==='transfer'){
   const topology=this.world.networkTopology(),target=this.world.stations.get(role);
   if(!b.active||!topology.linked.has(b.id)||topology.count<2||
      !target?.active||target.enemy||target.id===b.id||!topology.linked.has(target.id)){
    this.notice('Маршрут недоступен: соедините станции с сетью',2.5);return;
   }
   const price=transitCost(b,target);
   if(p.ore<price){this.notice('Для перелёта нужно ещё '+(price-p.ore)+' сплава',2.5);return;}
   // Teleporting is a departure too: never discard a pending hangar draft
   // without the same explicit decision required for an ordinary launch.
   if(this.hangarSession?.dirty?.(this.shipLoadout)){
    this.baseTab='hangar';this.renderDock();
    this.notice('Сначала примените или отмените изменения в ангаре',3.5);return;
   }
   p.ore-=price;
   recordEconomyExpense(this,'travel',price);
   this.heritage.vfx.nova(b.x,b.y,110,'cyan');
   p.x=target.x+75;p.y=target.y+30;p.vx=0;p.vy=0;p.burstRemaining=0;
   for(let i=0;i<this.allies.length;i++){
    const ally=this.allies[i];ally.x=p.x+(i?45:-45);ally.y=p.y+34;
    ally.vx=0;ally.vy=0;ally.state='follow';ally.target=null;
   }
   this.mining.target=null;this.mining.active=false;
   this.heritage.vfx.nova(p.x,p.y,100,'cyan');
   // The fare is a station expense, not earnings lost during the new flight.
   // Capture the post-payment baseline BEFORE dismiss() loses the dock.
   this.sortieStart=startSortie(this);
   this.docked=null;this.dismiss();
   this.notice('Сетевой перелёт: '+(baseNames[target.type]||'станция')+' · −'+price+' сплава',3.2);
   this.heritage.station('transfer',target.type);
   return;
  }else return;
  // Do not replay the dock animation on rejected purchases.
  markDockEvent(b,act,this.time);
  this.heritage.station(act,b.type,{tech:act==='upgrade'?o.tech.key:null});
  this.pausedRenderPending=true;this.renderDock();
 }
 callFieldWeapon(){
  if(!this.fieldLoan||!this.weaponProfile?.[this.fieldLoan.moduleId||'ion'])return this.callTacticalField();
  if((this.fieldLoan?.moduleId||'ion')!=='resonator')return this.callIonDischarge();
  if(this.dead||this.paused||!this.overlay.hidden)return false;
  if(this.mining.active||this.probeRepairing||this.openingRepairing){
   this.notice('Отпустите '+this.controlLabel('interact')+', чтобы применить полевой модуль.',2.5);return false;}
  if(!this.weaponProfile.resonator){this.notice('Установите резонатор в ангаре и примените сборку.',3);return false;}
  if(this.weaponThermal.locked||this.heavyCharge){this.notice('Дождитесь охлаждения или завершения выстрела гаубицы.',2.5);return false;}
  const plan=planResonance(this);
  if(!plan.ok){this.notice(plan.reason,2.8);return false;}
  this.fieldEffects=[plan.effect];this.fieldLoan.charges=plan.chargesAfter;
  this.fieldLoan.cooldownUntil=plan.cooldownUntil;this.fieldLoan.used++;
  this.heritage.vfx.nova(plan.effect.targets[0].target.x,plan.effect.targets[0].target.y,43,'violet');
  this.heritage.play('resonatorShot',.26,{x:this.player.x,y:this.player.y});
  this.notice('РЕЗОНАНС · '+plan.effect.targets.length+' цели · 4 секунды связи · зарядов '+this.fieldLoan.charges+'/3',3);
  this.hud();return true;
 }
 tacticalAimPoint(){
  if(this.isTouchLayout){
   const designated=activeDesignatedTarget(this);
   if(designated)return {x:designated.x,y:designated.y};
  }
  const pointer=this.tacticalPointer;
  if(!pointer)return tacticalAim(this.player,null);
  const rect=this.canvas?.getBoundingClientRect?.(),cam=this.camera();
  if(!rect?.width||!rect?.height)return tacticalAim(this.player,null);
  return {x:cam.x+(pointer.x-rect.left)/rect.width*cam.w,
   y:cam.y+(pointer.y-rect.top)/rect.height*cam.h};
 }
 callTacticalField(){
  if(this.dead||this.paused||!this.overlay.hidden)return false;
  if(this.mining.active||this.probeRepairing||this.openingRepairing){
   this.notice('Отпустите '+this.controlLabel('interact')+', чтобы включить полевое устройство.',2);return false;
  }
  const result=activateTactical(this,this.tacticalAimPoint());
  if(!result.ok){this.notice(result.reason,1.8);return false;}
  if(result.kind==='pulse'){
   this.tactical.pulseAt=this.time;this.tactical.pulseX=this.player.x;
   this.tactical.pulseY=this.player.y;this.tactical.pulseRadius=tacticalSpec(this.tactical).radius;
  }
  this.heritage.vfx.nova(result.point.x,result.point.y,result.kind==='pulse'?55:37,
   result.kind==='jam'?'cyan':'violet');
  this.heritage.play('resonatorShot',.2,{x:this.player.x,y:this.player.y});
  this.notice(result.name+' · '+(result.affected?'затронуто целей: '+result.affected+' · ':'')+
   'зарядка '+result.cooldown+' с',2.5);
  this.hud();return true;
 }
 weaponHit(item,dealt,source,manual=false){
  if(item.kind==='enemy'&&dealt>0)fieldWeaponImpact(this,item.target);
  if(item.kind==='enemy'&&dealt>0&&(source==='ion'||source==='rail'&&manual))
   interruptStationInterdiction(this,item.target,source==='ion'?'ion':'precision');
  if(source==='beam'&&this.fieldLoan&&this.weaponProfile.ion){
   const targets=combatTargets(this,ION_CONDUCTOR.dischargeRange+ION_CONDUCTOR.markRadius).map(x=>x.target);
   markIonCluster(targets,item.target,this.time,this.fieldLoan,(a,b)=>clearLine(this,a,b));
  }
  if(['beam','rail','flak','rocket','howitzer','ion'].includes(source))resonanceDamage(this,item,dealt);
 }
 callIonDischarge(){
  if(this.dead||this.paused||!this.overlay.hidden)return false;
  if(this.mining.active||this.probeRepairing||this.openingRepairing){
   this.notice('Во время добычи и ремонта ионный разряд недоступен',2.5);return false;
  }
  if(this.fieldLoan&&!this.weaponProfile.ion){this.notice('Установите ионный проводник в свободный узел ангара',3);return false;}
  if(this.weaponThermal.locked||this.heavyCharge){this.notice('Разряд недоступен: перегрев или подготовка гаубицы',2.5);return false;}
  if(this.fieldLoan&&(this.fieldLoan.moduleId||'ion')!=='ion')return false;
  const candidates=combatTargets(this,ION_CONDUCTOR.dischargeRange);
  const plan=planIonDischarge(candidates.map(x=>x.target),this.player,this.time,this.fieldLoan,(a,b)=>clearLine(this,a,b),this.skillRanks.beam);
  if(!plan.ok){this.notice(plan.reason,2.5);return false;}
  let from=this.player,disrupted=false;
  for(let i=0;i<plan.targets.length;i++){
   const target=plan.targets[i];
   target.ionMarkUntil=0;
   const item=candidates.find(x=>x.target===target);
   const point=contactOnCircle(target.x,target.y,targetRadius(item),from.x,from.y);
   emitWeaponFx(this,'ion',from,point);
   const preparing=target.stationRaid?.chargeAt!=null;
   damageTarget(this,item,plan.damage[i],'ion',point);
   if(preparing&&target.hp>0&&target.stationRaid?.chargeAt===null)disrupted=true;
   from=target;
  }
  this.fieldLoan.charges=plan.chargesAfter;
  this.fieldLoan.cooldownUntil=plan.cooldownUntil;
  this.fieldLoan.used++;
  const mastery=ionMasteryAward(plan.targets.length,this.ionMasteryAwarded);
  const previousLevel=this.player.level;
  if(mastery){this.ionMasteryAwarded=true;this.collect({type:'data',value:mastery});
   recordSortieIncome(this,'data','other',mastery);}
  this.heritage.vfx.nova(plan.targets[0].x,plan.targets[0].y,43,'cyan');
  this.heritage.play('ionShot',.26,{x:plan.targets[0].x,y:plan.targets[0].y});
  const result=mastery?'Цепной разряд освоен: '+plan.targets.length+
   ' цели · +'+mastery+' данных и опыта · ион '+this.fieldLoan.charges+'/'+ION_CONDUCTOR.charges:
   'Ионный разряд: '+plan.targets.length+' '+
   (plan.targets.length===1?'цель':'цели')+' · осталось '+this.fieldLoan.charges;
  this.rewardNotice(result+(disrupted?' · Подготовка импульса сорвана':''),previousLevel,mastery?4.2:2.3);
  this.hud();return true;
 }
 callStrike(){
  if(this.dead||this.paused)return false;
  const sup=this.support;
  if(!sup.charges){this.notice('Снарядите авиаудар на подключённом авианосце или захваченном сборочном узле',3);return false;}
  if(sup.cooldown>0){this.notice('Перезарядка связи: '+Math.ceil(sup.cooldown)+' с',2);return false;}
  const enemy=this.nearbyEnemyBase(720);
  if(!enemy){
   // The B key has one clear meaning: call an already-paid carrier flight.
   // A linked territory adds a defensive use where it actually matters.
   const cover=contourCoverOffer(this.world,this.player,this.enemies,sup.charges,sup.cooldown);
   if(!cover.ok){this.notice(cover.reason,3);return false;}
   const carrier=cover.carrier,p=this.player,angle=Math.atan2(p.y-carrier.y,p.x-carrier.x);
   const hp=carrier.module==='armor'?Math.round(68*1.45):68;
   const craft=[-1,1].map((side,i)=>({x:p.x-Math.cos(angle)*370+side*Math.sin(angle)*48,
    y:p.y-Math.sin(angle)*370-side*Math.cos(angle)*48,r:17,hp,maxHp:hp,
    role:'bomber',angle:angle+Math.PI/2,lane:side,serial:i+1}));
   sup.missions.push({mode:'cover',carrier,craft,age:0,shotAt:CONTOUR_COVER.entrySeconds,
    volleys:0});
   sup.charges--;sup.cooldown=35;
   let repairCue='';
   if(territoryTech(this.world).teal&&p.hp<p.maxHp){
    const repaired=Math.min(16,p.maxHp-p.hp);
    p.hp+=repaired;
    this.heritage.vfx.nova(p.x,p.y,72,'green');
    repairCue=' · ремонт +'+Math.round(repaired);
   }
   this.notice('СЕТЬ: авиакрыло идёт на прикрытие'+repairCue+'. Держитесь внутри поля!',4);
   this.heritage.play('strikeCall',.5,{x:p.x,y:p.y});
   this.heritage.vfx.nova(p.x,p.y,115,'cyan');
   recordWorldFeedback(this,{key:'territory-cover:'+Math.floor(this.time),kind:'industry',
    label:'КОНТУР ВЫЗВАЛ АВИАКРЫЛО',cause:'Снаряжённый авианосец связан с территорией',
    effect:'Прикрытие корабля у границы поля · израсходован один авиаудар',x:p.x,y:p.y});
   return true;
  }
  const topology=this.world.networkTopology();
  const carriers=[...this.world.stations.values()].filter(b=>
   b.active&&!b.enemy&&!b.suppressed&&b.type==='carrier'&&
    (topology.linked.has(b.id)||autonomousStrikeCarrier(b)&&dist(b,enemy)<=AUTONOMOUS_STRIKE_RANGE));
  if(!carriers.length){this.notice('Нет доступного авианосца: нужна связь сети или трофейный сборочный узел в пределах 9800 м от цели',4);return false;}
  carriers.sort((a,b)=>dist(a,enemy)-dist(b,enemy));
  const carrier=carriers[0],dx=enemy.x-carrier.x,dy=enemy.y-carrier.y,n=Math.hypot(dx,dy)||1;
  const ux=dx/n,uy=dy/n,approach=Math.max(this.vw,this.vh)*.8+240;
  const bomberHp=carrier.module==='armor'?Math.round(68*1.45):68;
   const craft=[-1,1].map((side,i)=>({
   x:enemy.x-ux*approach-uy*side*46,
   y:enemy.y-uy*approach+ux*side*46,
   r:17,hp:bomberHp,maxHp:bomberHp,role:'bomber',angle:Math.atan2(uy,ux)+Math.PI/2,
   lane:side,serial:i+1}));
  sup.missions.push({base:enemy,carrier,craft,age:0,shotAt:2.3,volleys:0});
  sup.charges--;sup.cooldown=35;
  this.notice('Ударная группа на подходе! Прикрывайте заход.',4);
  this.heritage.play('strikeCall',.5,{x:this.player.x,y:this.player.y});
  this.heritage.vfx.nova(this.player.x,this.player.y,85,'cyan');
  return true;
 }
 updateStrikes(dt){
  const sup=this.support;sup.cooldown=Math.max(0,sup.cooldown-dt);
  for(const mission of sup.missions){
   mission.age+=dt;
   if(mission.mode==='cover'){
    const p=this.player,c=mission.carrier,age=mission.age;
    const connected=fieldAt(this.world,p.x,p.y);
    for(const craft of mission.craft){
     craft.hit=Math.max(0,(craft.hit||0)-dt);
     if(craft.hp<=0)continue;
     const t=Math.min(1,age/CONTOUR_COVER.entrySeconds);
     const theta=Math.atan2(p.y-c.y,p.x-c.x),side=craft.lane;
     const radius=t<1?370*(1-t)+118*t:118;
     const sweep=theta+(t<1?0:(age-CONTOUR_COVER.entrySeconds)*.52);
     craft.x=p.x-Math.cos(sweep)*radius+Math.sin(sweep)*side*48;
     craft.y=p.y-Math.sin(sweep)*radius-Math.cos(sweep)*side*48;
     craft.angle=sweep+Math.PI/2;
    }
    if(age>=mission.shotAt&&mission.volleys<CONTOUR_COVER.shots){
     const {tech,target}=connected?selectCoverTarget(this.world,p,this.enemies):{tech:null,target:null};
     if(target){
      const craft=mission.craft.filter(c=>c.hp>0)
       [mission.volleys%Math.max(1,mission.craft.filter(c=>c.hp>0).length)];
      if(craft){
       const damage=(32+Math.min(6,this.network.strikePower)*5)*
        (target.regionalCargo&&!tech.north?.7:1);
       this.damageEnemy(target,damage,'carrier');
       if(target.regionalCargo&&!mission.cargoEngaged){
        mission.cargoEngaged=true;
        this.notice('Авиакрыло перехватило конвой! Добейте транспорт, чтобы сорвать доставку.',4);
        this.heritage.vfx.nova(target.x,target.y,54,'cyan');
       }
       if(tech.azure&&!target.regionalCargo&&target.hp>0){
        target.tacticalSlowUntil=Math.max(target.tacticalSlowUntil||0,this.time+2.5);
        target.tacticalSlowFactor=.68;
        this.heritage.vfx.nova(target.x,target.y,45,'cyan');
       }
       this.flash(craft.x,craft.y,target.x,target.y,'#92eaff');
       this.heritage.play('rocket',.26,{x:craft.x,y:craft.y});
       mission.volleys++;mission.shotAt=age+CONTOUR_COVER.shotInterval;
      }
     }
    }
    continue;
   }
   const b=mission.base,c=mission.carrier;
   const dx=b.x-c.x,dy=b.y-c.y,n=Math.hypot(dx,dy)||1;
   const ux=dx/n,uy=dy/n,range=Math.max(this.vw,this.vh)*.8+240;
   for(const craft of mission.craft){
    craft.hit=Math.max(0,(craft.hit||0)-dt);
    if(craft.hp<=0)continue;
    const travel=mission.age<2.4?-range*(1-mission.age/2.4):
     Math.min(range,(mission.age-2.4)*195);
    const side=craft.lane*46;
    craft.x=b.x+ux*travel-uy*side;
    craft.y=b.y+uy*travel+ux*side;
    craft.angle=Math.atan2(uy,ux)+Math.PI/2;
    craft.vx=ux*(mission.age<2.4?range/2.4:195);
    craft.vy=uy*(mission.age<2.4?range/2.4:195);
   }
   if(mission.age>=mission.shotAt&&mission.volleys<4){
    mission.shotAt+=1.03;mission.volleys++;
    const alive=mission.craft.filter(c=>c.hp>0);
    if(!alive.length)continue;
    const craft=alive[(mission.volleys-1)%alive.length];
    const target=b.turrets?.find(t=>t.hp>0)||b;
    if(target.hp<=0)continue;
    const damage=(44+Math.min(6,this.network.strikePower)*10)*(c.module==='guidance'?1.2:1);
    if(target===b)this.hitEnemyBase(b,damage,'bomber');
    else this.hitTurret(target,damage,null,'bomber');
    this.heritage.vfx.meteorStrike(target.x,target.y,26,false);
    this.flash(craft.x,craft.y,target.x,target.y,'#ffcf7b');
    this.heritage.play('rocket',.32,{x:craft.x,y:craft.y});
   }
  }
  sup.missions=sup.missions.filter(m=>m.age<(m.mode==='cover'?CONTOUR_COVER.duration:7.5)&&
   m.volleys<(m.mode==='cover'?CONTOUR_COVER.shots:4)&&m.craft.some(c=>c.hp>0));
 }

 hack(){
  if(this.dead)return;
  if(!this.hacks.length){this.notice('Нужен код захваченной вражеской базы',2);return;}
  const charge=this.hacks.shift(),cam=this.camera();
  let count=0;
  for(const e of this.enemies){
   if(e.hp<=0||e.converted||e.type==='gunship')continue;
   const eligible=charge==='screen'? !outsideCamera(e.x,e.y,cam,e.r):
      dist(e,this.player)<260;
   if(eligible&&count<24){
    e.converted=true;e.convertedTime=19;e.state='converted';e.fire=.2;count++;
    e.stasisUntil=0;e.stasisLabelUntil=0;e.stasisImmuneUntil=0;
    this.flashes.push({x:e.x,y:e.y,x2:e.x,y2:e.y,color:'#78ffd6',ttl:.5});
   }
  }
  this.heritage.vfx.nova(this.player.x,this.player.y,260,'green');
  this.heritage.play('hack');
  this.notice('Перепрограммировано кораблей: '+count,3.5);
 }
 hurt(damage,source=null){
  const p=this.player;if(p.invul>0)return;
  if(this.nearDockField||this.nearArsenalDefense)damage*=.82;
  damage=fieldLootArmor(this,damage);
  damage=absorbParasiteImpact(this,damage);
  if(damage<=0){p.invul=.28;this.lastDamageAt=this.time;return;}
  const absorbed=Math.min(p.shield,damage);p.shield-=absorbed;
  const remaining=Math.max(0,damage-absorbed);
  const previousHp=p.hp;
  p.hp-=remaining;p.invul=.55+this.skillRanks.dodge*.12;this.lastDamageAt=this.time;
  recordCombatContact(this);
  recordSortieDamage(this,Math.min(previousHp,remaining),absorbed);
  if(previousHp/p.maxHp>.3&&p.hp/p.maxHp<=.3&&p.hp>0)
   this.heritage.play('criticalHull',3);
  const contact=source?contactOnCircle(p.x,p.y,p.r,source.x,source.y):null;
  this.heritage.vfx.arcadePlayerHurt(p.x,p.y,absorbed>0,remaining>0,contact);
  this.heritage.play('damage',.35);
  this.cockpit.impact(damage/Math.max(1,p.maxHp),absorbed>0&&remaining===0);
  const boost=this.skillRanks.dodge;
  if(boost){
   const sx=source? p.x-source.x : p.vx,sy=source? p.y-source.y : p.vy;
   const m=length(sx,sy);
   const dx=m>1?sx/m:Math.sin(p.angle),dy=m>1?sy/m:-Math.cos(p.angle);
   p.vx+=dx*boost*120;p.vy+=dy*boost*120;
   this.heritage.vfx.engineTrail(p.x,p.y,p.angle,'fighter',false,.13);
  }
  if(p.hp<=0){p.hp=0;this.die();}
 }
 die(){
  if(this.dead)return;
  for(const e of this.enemies)this.enemyLearning?.finish(e,this.time);
  this.enemyLearning?.flush(this.time);
  const failed=finishSortie(this.sortieStart,this,this.docked||this.world.home,'lost');
  this.sortieReports=appendSortieReport(this.sortieReports,failed);
  this.sortieStart=null;
  this.heritage.vfx.shipExplosion(this.player.x,this.player.y,35,'#83e9ff',false);
  this.heritage.vfx.nova(this.player.x,this.player.y,100,'cyan');
  this.heritage.play('death',.1);
  this.heritage.onDeath();
  this.dead=true;this.paused=true;this.pausedRenderPending=true;
  if(this.time>this.bestFlight){
   this.bestFlight=Math.floor(this.time);
   try{this.recordStorage?.setItem('survivor.best-flight.v1',String(this.bestFlight));}catch{}
  }
  this.pendingCheckpoint=this.runStore?.recoveryCheckpoint()||null;
  if(!this.pendingCheckpoint)this.runStore?.end();
  this.deathVfxAt=performance.now();this.deathSceneEnd=this.deathVfxAt+1100;
  this.overlay.hidden=true;this.overlay.dataset.mode='death';
  this.overlay.innerHTML=renderDeathScreen(this,failed);
 }
 updateMissiles(dt){
  for(const m of this.missiles){
   const item={kind:m.targetKind||'enemy',target:m.target,base:m.targetBase};
   if(targetAlive(this,item)){m.tx=m.target.x;m.ty=m.target.y;}
   m.prevX=m.x;m.prevY=m.y;
   if(!m.trail)m.trail=[];
   if(!m.trail.length||Math.hypot(m.x-m.trail[m.trail.length-1].x,m.y-m.trail[m.trail.length-1].y)>5){
    m.trail.push({x:m.x,y:m.y});if(m.trail.length>9)m.trail.shift();
   }
   const dx=m.tx-m.x,dy=m.ty-m.y,d=Math.hypot(dx,dy);
   const step=Math.min(d,m.speed*dt);
   if(d>0){m.x+=dx/d*step;m.y+=dy/d*step;}
   m.life-=dt;
   const cover=firstRockImpact(m.prevX,m.prevY,m.x,m.y,
    this.rockGrid.query((m.prevX+m.x)*.5,(m.prevY+m.y)*.5,step*.5+60),3,this.player);
   if(cover){
    const contact=contactAtPoint(cover.rock.x,cover.rock.y,cover.x,cover.y);
    this.damageRock(cover.rock,m.damage*.85,m.prevX,m.prevY,'auto',true,contact);
    this.heritage.vfx.rocketImpact(cover.x,cover.y,26,contact);
    this.heritage.play('rocketImpact',.2,{x:cover.x,y:cover.y});
    m.life=-1;continue;
   }
   const arrived=d<=m.speed*dt+8;
   if(arrived||m.life<=0){
    const e=m.target;
    const hit=targetAlive(this,item)&&Math.hypot(m.x-e.x,m.y-e.y)<targetRadius(item)+24;
    const contact=hit?contactOnCircle(e.x,e.y,targetRadius(item),m.prevX,m.prevY):null;
    if(hit)damageTarget(this,item,m.damage,'rocket',contact);
    if(hit)this.heritage.vfx.rocketImpact(contact?.x??m.x,contact?.y??m.y,26,contact);
    else this.heritage.vfx.rocketImpact(m.x,m.y,12);
    // The warhead has an audible detonation, not just a visual flash.
    this.heritage.play('rocketImpact',.2,{x:contact?.x??m.x,y:contact?.y??m.y});
    m.life=-1;
   }
  }
  this.missiles=this.missiles.filter(m=>m.life>0);
 }
 hitAlly(a,damage){
  if(!a||a.hp<=0||damage<=0)return;
  a.hp-=damage;a.hit=.18;
  if(this.time>(a.nextVfxHit||0)){
   this.heritage.vfx.hullImpact(a.x,a.y,false);
   a.nextVfxHit=this.time+.24;
  }
 }
 damageEnemy(e,damage,source='other',contact=null){
  if(e.hp<=0)return;
  if(e.regionalCargo){hitRegionalCargo(this,e,damage,contact,source);return;}
  if(e.centralWorker){
   e.hp=Math.max(0,e.hp-damage);e.hit=.15;
   this.heritage.vfx.hullImpact(contact?.x??e.x,contact?.y??e.y,damage>30,contact);
   if(disableCentralWorker(this.world,e,this.time)){
    this.enemyComms?.reportIncident(e,this,'mining');
    this.heritage.vfx.shipExplosion(e.x,e.y,35,'#90f7d7',false);
    this.notice('Рудный рабочий уничтожен: местная добыча остановилась. Уже отправленные грузы ещё опасны.',7);
   }
   return;
  }
  if(e.frontierWorker||e.frontierSalvage){
   const result=damageFrontierAsset(this.world,e,damage,this.time);
   if(result){
    e.hit=.16;
    this.heritage.vfx.hullImpact(contact?.x??e.x,contact?.y??e.y,damage>30,contact);
    if(result==='worker'||result==='wreck'){
     this.enemyComms?.reportIncident(e,this,
      result==='worker'?'recycling':'salvage');
     this.heritage.vfx.shipExplosion(e.x,e.y,34,'#8bdfbe',false);
     if(result==='wreck')this.addDrop('ore',e.x,e.y,3,{source:'salvage',life:60});
     this.notice(result==='worker'?
      'Сборщик выведен из строя. Утилизационный комбинат больше не получает новые материалы.':
      'Одна залежь обломков уничтожена. У комбината стало меньше материала для будущих рейсов.',6);
    }
   }
   return;
  }
  if(e.interceptCargo){
   const origin=contact?.directed?contact:
    source&&typeof source==='object'?source:this.player;
   const hit=hitCarrierCargo(e,damage,origin);damage=hit.damage;e.hit=.15;
   if(hit.engineDisabled)this.notice('ДВИГАТЕЛИ ПОВРЕЖДЕНЫ! Груз замедлен на 4 секунды.',2.8);
   if(this.time>(e.nextVfxHit||0)){
    this.heritage.vfx.hullImpact(contact?.x??e.x,contact?.y??e.y,damage>30,contact);
    e.nextVfxHit=this.time+.14;
   }
   this.heritage.play('armorHit',.24,{x:e.x,y:e.y});
   if(e.hp<=0)this.completeCarrierInterception(e);
   return;
  }
  // A surviving ship can infer an approximate firing sector from an impact.
  // Other attackers cannot reveal the player's coordinates by proxy.
  const aggressor=(['beam','rocket','ion','rail','flak','howitzer','comet','mine'].includes(source))?this.player:
    (source&&typeof source==='object'&&Number.isFinite(source.x)&&
     Number.isFinite(source.y)&&source.hp>0)?source:null;
  // A damaged patrol does not obtain a live target coordinate through a wall.
  // Actual optical contact is allowed to identify an attacker; otherwise it
  // can only investigate a coarse direction inferred from the impact.
  const sawAttacker=!!aggressor&&this.enemyCanSee(e,aggressor);
  const attackRange=aggressor===this.player&&!sawAttacker?
    estimatedWeaponRange(source):aggressor?dist(e,aggressor):0;
  const impactEstimate=aggressor===this.player&&!sawAttacker?
    incomingFireEstimate(e,attackRange,contact):null;
  if(impactEstimate&&e.hp>0)e._awarenessImpact={...impactEstimate,at:this.time};
  if(e.signalIntel&&aggressor){
    if(sawAttacker)alertSignalIntel(e.signalIntel,aggressor,this.time);
    else alertSignalThreat(e.signalIntel,impactEstimate,this.time);
  }
  const hpBefore=e.hp;
  damage=fieldLootDamage(this,damage,source);
  damage=stormWeaponDamage(e,damage,source,this.time);
  // A dock checkpoint may be captured before the next death-processing frame.
  // Health must already satisfy the saved enemy state contract at that point.
  e.hp=Math.max(0,e.hp-damage);e.hit=.12;
  if(aggressor===this.player && damage>0){
   e.lastPlayerHitAt=this.time;
   recordCombatContact(this);
   chainFieldLoot(this,e,damage,source);
  }
  this.enemyLearning?.damaged(e,Math.min(hpBefore,Math.max(0,damage)));
  this.enemyComms?.reportHit(e,Math.min(hpBefore,Math.max(0,damage)),this.time);
  if(aggressor===this.player&&e.hp>0)
   this.enemyComms?.reportAttack(e,source,attackRange,this.time,contact);
  if(e.hp<=0)this.enemyComms?.reportLoss(e,this,
    aggressor===this.player?{weapon:source,range:attackRange,contact}:null);
  if(this.visuals?.capitalDamageQA&&e.type==='gunship'&&e.serial%2===0)
   recordCapitalHit(e,contact,this.time);
  if(this.time>(e.nextVfxHit||0)){
   this.heritage.vfx.hullImpact(
    contact?.directed?contact.x:e.x,contact?.directed?contact.y:e.y,
    damage>45,contact);
   e.nextVfxHit=this.time+.13;
  }
  this.heritage.play('hit',.24,{x:e.x,y:e.y});
 }
 flash(x,y,x2,y2,color='#a7eeff'){
  if(this.flashes.length>=90)this.flashes.shift();
  this.flashes.push({x,y,x2,y2,color,ttl:.16});
 }
 announceIndustrialBreach(breach){
  if(breach?.kind!=='breach')return;
  const depot=breach.depot;
  this.heritage.vfx.nova(depot.x,depot.y,200,'cyan');
  this.heritage.play('capturedBase',.26,{x:depot.x,y:depot.y});
  this.notice('ПРОРЫВ СВЯЗИ! Промышленный пост остановлен до ремонта. Враг потратит сырьё на восстановление.',7);
  recordWorldFeedback(this,{key:'industrial-breach:'+depot.id+':'+Math.floor(this.time),
   kind:'industry',label:'ПРОМЫШЛЕННАЯ ДИВЕРСИЯ',
   cause:'Вы повредили турели или открытый корпус поста под прикрытием радиопомех',
   effect:'Выход новых грузов остановлен; досрочный ремонт потребует настоящего сырья',
   x:depot.x,y:depot.y,notify:true});
 }
 hitTurret(t,damage,contact=null,source='player'){
  if(t.hp<=0)return;
  if(source==='player'){
   damage*=fortificationShield(this.world,t);
   damage=fieldLootDamage(this,damage,'beam');
   recordCombatContact(this);
  }
  const dealt=Math.min(t.hp,Math.max(0,damage));
  this.enemyLearning?.damaged(t,Math.min(t.hp,Math.max(0,damage)));
  t.hp-=damage;t.flash=.1;
  if(t.hp<=0)this.enemyLearning?.finish(t,this.time);
  if(this.time>(t.nextVfxHit||0)){
   this.heritage.vfx.hullImpact(
    contact?.directed?contact.x:t.x,contact?.directed?contact.y:t.y,
    damage>=40,contact);
   t.nextVfxHit=this.time+.15;
  }
  this.heritage.play('armorHit',.35,{x:t.x,y:t.y});
  if(source==='player'){
   const breach=recordIndustrialBreachHit(this.world,t,dealt,this.time);
   this.announceIndustrialBreach?.(breach);
  }
  if(t.hp<=0){this.heritage.vfx.shipExplosion(t.x,t.y,21,'#ff6974');
   this.heritage.play('explosion',.25,{x:t.x,y:t.y});}
 }
 hitEnemyBase(base,damage,source='player'){
  // A captured base is friendly even though the repaired structure has positive HP.
  if(base.hp<=0||base.captured||!base.enemy)return;
  if(base.turrets.some(t=>t.hp>0))return;
  // Damage to a production site can be reported by actual nearby witnesses.
  // The mesh only receives the site's identity, never the attacker's position.
  if(this.time>=(base._nextWitnessAlarmAt??0)){
   const witnesses=this.enemyComms?.reportIncident(base,this,'industry')||0;
   if(witnesses)base._nextWitnessAlarmAt=this.time+9;
  }
  if(this.time>(base.nextVfxHit||0)){
   this.heritage.vfx.hullImpact(base.x,base.y,damage>=40);
   base.nextVfxHit=this.time+.2;
  }
  if(source==='bomber'){
   const reserve=base.maxHp*.2;
   base.hp=Math.max(reserve,base.hp-damage);
   if(base.hp<=reserve&&!base.coreExposed){
    base.coreExposed=true;
    this.notice('Ядро базы открыто! Подлетите и добейте его своим лучом.',4);
    this.heritage.vfx.nova(base.x,base.y,120,'red');
   }
   return;
  }
  const dealt=Math.min(base.hp,Math.max(0,damage));
  base.hp-=damage;
  if(source==='player'){
   const breach=recordIndustrialBreachHit(this.world,base,dealt,this.time);
   this.announceIndustrialBreach?.(breach);
  }
  if(base.hp<=0){
   const precisionUnlockedHere=base.type==='arsenal'&&!precisionRailUnlocked(this.world);
   const labUnlockedHere=base.type==='lab'&&!labLogisticsUnlocked(this.world);
   const warFront=warFronts(this.world).find(f=>f.depotId===base.id);
   base.hp=Math.max(1,Math.round(base.maxHp*.3));base.captured=true;base.enemy=false;base.active=true;
   const previousLevel=this.player.level;
   const captureXp=this.awardStrategicExperience(claimStationCapture(this.player,base));
   const captureReward=captureXp?' +'+captureXp+' опыта.':'';
   this.enemyContourVisualAt=-Infinity;
   if(precisionUnlockedHere)this.precisionRailAvailable=true;
   this.defenseTopology=null;
   base.activated=true;base.activationTime=this.time;
   this.activeBases++;base.activationIndex=this.activeBases;
   synchronizeStationDefenses(this.world,this.time);
   this.hacks.push(base.rank>=3?'screen':'area');
   if(this.hacks.length>3)this.hacks.shift();
   this.heritage.vfx.nova(base.x,base.y,200,'green');
   this.heritage.play('capturedBase',.2,{x:base.x,y:base.y});
   if(strategicCapture(this.world,base,this.time)){
    this.addDrop('ore',base.x,base.y,25,{source:'salvage',life:60});
    const notice={mine:'Добывающий комплекс захвачен. Новые грузы не выйдут; транспорт в пути ещё нужно перехватить.',
     military:'Военный узел захвачен. Подготовка тяжёлых подкреплений остановлена.',
     'central-source':'Местная шахта захвачена. Добыча остановлена, но уже отправленные грузы ещё в пути.',
     'central-depot':'Сборочный пост захвачен. Промышленные налёты прекращены, фоновые патрули остаются. Прежние грузы больше не дадут противнику корабли.',
     'frontier-azure-source':'Индукционная вышка захвачена. Электроангар перестанет получать новые батареи.',
     'frontier-azure-depot':'Электроангар захвачен. Организованные рейсы ионных перехватчиков остановлены.',
     'frontier-teal-source':'Комбинат захвачен. Разбор обломков и отправка запчастей остановлены.',
     'frontier-teal-depot':'Ремонтная верфь захвачена. Подготовка новых ремонтных караулов прекращена.'};
    const newTech=warFront&&TERRITORY_TECH[warFront.key];
    this.rewardNotice((notice[base.strategicRole]||'Промышленный узел захвачен.')+captureReward+
     (newTech?' Трофейная технология: '+newTech.name+'. '+newTech.description:'')+
     (precisionUnlockedHere?' Открыт ручной прицел рельса (ЛКМ).':'')+
     (labUnlockedHere?' Открыт радиоперехват снабжения (карта).':''),previousLevel,7);
   }else this.rewardNotice('Вражеская база захвачена! Заряд кода: Q'+captureReward+
    (precisionUnlockedHere?' · Ручной прицел рельса открыт (ЛКМ)':'')+
    (labUnlockedHere?' · Радиоперехват снабжения открыт (карта)':
     base.type==='lab'?' · Радионаблюдение расширено':''),previousLevel,6);
   this.refreshAutomaticContours();
  }
 }
 nearbyEnemyBase(radius=900){
  return this.world.nearbyStations(this.player.x,this.player.y,radius)
   .filter(b=>b.enemy&&!b.captured&&(b.strategicRole||this.enemyBasesUnlocked())).sort((a,b)=>dist(this.player,a)-dist(this.player,b))[0]||null;
 }
 enemyBasesUnlocked(){return this.player.level>=RULES.enemyBaseUnlockLevel&&
  this.activeBases>=RULES.enemyBaseUnlockStations;}
 assaulting(b){return dist(this.player,b)<430 && !b.captured;}
 enemyShot(x,y,tx,ty,damage,options=null){
  if(this.shots.length>=RULES.maxShots)return false;
  const d=length(tx-x,ty-y)||1,speed=options?.speed||230;
  this.shots.push({x,y,vx:(tx-x)/d*speed,vy:(ty-y)/d*speed,
   damage,r:options?.r||6,life:3.3,alive:true,kind:options?.kind||'laser',
   learnToken:options?.learnToken||null,trialId:this.activeEnemyFirer?.trialId});
  this.heritage.play('enemyShot',.28,{x,y});
  return true;
 }
 shotsNear(x,y,r){return this.shotGrid.query(x,y,r);}
 avoidance(x,y,r){
  let vx=0,vy=0;
  for(const z of this.zones){
   if(z.fuse<=0)continue;
   const d=length(x-z.x,y-z.y),reach=z.r+r+65;
   if(d<reach){
    const k=(reach-d)/Math.max(1,d);
    vx+=(x-z.x)*k;vy+=(y-z.y)*k;
   }
  }
  const phase=ionPhase(this.time);
  if(phase.state==='warning'||phase.state==='discharge'){
   const d=length(x-ION_FIELD.x,y-ION_FIELD.y),reach=ION_FIELD.r+r+65;
   if(d>1&&d<reach){
    vx+=(x-ION_FIELD.x)/d*(reach-d);
    vy+=(y-ION_FIELD.y)/d*(reach-d);
   }
  }
  for(const rock of this.nearRocks||[]){
   if(!rock.alive)continue;
   const dx=x-rock.x,dy=y-rock.y;
   if(Math.abs(dx)>100||Math.abs(dy)>100)continue;
   const d=length(dx,dy),reach=rock.r+r+22;
   if(d>1&&d<reach){vx+=dx/d*(reach-d);vy+=dy/d*(reach-d);}
  }
  const m=length(vx,vy);
  return m>0?{x:clamp(vx/m*clamp(m/60,0,1),-1,1),y:clamp(vy/m*clamp(m/60,0,1),-1,1)}:{x:0,y:0};
 }
 enemyCanSee(enemy,target){
  const d=dist(enemy,target);
  if(d>290)return false;
  const dx=target.x-enemy.x,dy=target.y-enemy.y;
  const speed=length(enemy.vx,enemy.vy);
  // A nearby contact is detected from any angle. At distance, a moving
  // patrol must be facing roughly toward the contact.
  if(d>88&&speed>24&&(enemy.vx*dx+enemy.vy*dy)/(speed*Math.max(1,d))<-.2)
   return false;
  const rocks=this.rockGrid.query((enemy.x+target.x)*.5,(enemy.y+target.y)*.5,d*.5+80);
  return !firstRockImpact(enemy.x,enemy.y,target.x,target.y,rocks,0,target);
 }
 playerCanInspectEnemyIntent(enemy){
  const p=this.player,d=dist(p,enemy);
  if(d>290)return false;
  // Player visibility depends on cover, not on where an enemy is facing.
  // This is deliberately different from the enemy's directional sensor.
  const rocks=this.rockGrid.query((p.x+enemy.x)*.5,(p.y+enemy.y)*.5,d*.5+80);
  return !firstRockImpact(p.x,p.y,enemy.x,enemy.y,rocks,0,enemy);
 }
 playerCanInterceptEnemyRadio(enemy){
  // Listening to nearby broadcasts does not reveal the broadcaster's position.
  return !!enemy&&dist(this.player,enemy)<=ENEMY_COMMS.interceptRange;
 }
 sectorDirector(director){
  let adjusted=homeConflictPressure(regionalCampaignPressure(director,this.world,this.player),this.world,this.player);
  if(director.types.length){
   const control=this.world.sectorControl?.(this.player.x,this.player.y)||{kind:'neutral',base:null};
   if(control.kind==='hostile'&&(control.base?.strategicRole||this.enemyBasesUnlocked()))adjusted={...adjusted,
    cap:Math.min(RULES.maxEnemies,adjusted.cap+3),interval:adjusted.interval*.82};
   else if(control.kind==='secured')adjusted={...adjusted,
    cap:Math.max(4,adjusted.cap-3),interval:adjusted.interval*1.2};
  }
  const carrierModifier=Math.max(1,...[...this.world.stations.values()]
   .filter(b=>b.type==='carrier'&&b.supplyIntercepted)
   .map(b=>carrierPatrolModifier(b,this.player.x,this.player.y)));
  if(carrierModifier>1&&adjusted.types.length)adjusted={...adjusted,
   cap:Math.max(3,adjusted.cap-1),interval:adjusted.interval*carrierModifier};
  const home=this.world.home;
  const modifier=home?.corridorSecured&&Math.hypot(this.player.x-home.x,this.player.y-home.y)<1250?1.17:1;
  if(modifier>1&&adjusted.types.length)adjusted={...adjusted,
   cap:Math.max(4,adjusted.cap-1),interval:adjusted.interval*modifier};
  const region=regionAt(this.player.x,this.player.y);
  const stronghold=strongholdThreat(this.world,this.player);
  const dangerKey=stronghold.nearStronghold&&stronghold.tier>=3?
   stronghold.region+':'+stronghold.tier:null;
  if(dangerKey&&this._lastStrongholdWarning!==dangerKey){
   this._lastStrongholdWarning=dangerKey;
   this.notice?.('Вражеский рубеж: угроза '+stronghold.tier+'/5. Рекомендуемый уровень корабля — '+
    stronghold.recommendedLevel+'+. Можно отступить, улучшить оснащение или перерезать снабжение.',7);
  }
  if(!dangerKey)this._lastStrongholdWarning=null;
  if(Math.hypot(this.player.x,this.player.y)<=70000&&['amethyst','amber'].includes(region.id)&&this.world.regionalSupply)
   adjusted={...adjusted,types:adjusted.types.filter(type=>type!=='gunship')};
  return openingArcPressure(adjusted,this.openingArc,this.time,this.player,home);
 }
 spawnGroup(director=openingThreat(this.time,this.player.level),noiseSignal=null){
  if(!director.types.length||this.enemies.length>=RULES.maxEnemies)return 0;
  const cap=Math.min(RULES.maxEnemies,director.cap);
  const available=cap-this.enemies.length;
  if(available<=0)return 0;
  const side=Math.floor(Math.random()*4),middle=.2+Math.random()*.6;
  const ambient={...director,allowMotes:!noiseSignal&&
   this.enemies.filter(e=>e.microSwarm&&e.hp>0).length<16};
  const plan=planEncounter(this.time,ambient,available,side,middle,
    Math.random(),noiseSignal?'':this.lastEncounter);
  if(!plan.members.length)return 0;
  if(!noiseSignal)this.lastEncounter=plan.pattern;
  const group=++this.groupSerial,cam=this.camera(),created=[];
  const intelSource=noiseSignal;
  const strongholdTier=Math.max(1,Math.min(5,director.strongholdTier||1));
  const industrialTech=Math.max(0,Math.min(3,director.industrialTech||0));
  for(let i=0;i<plan.members.length;i++){
   const member=plan.members[i];
   const xy=spawnOutside(cam,member.side,member.position,170+i*12);
   const type=member.type,def=ENEMY_TYPES[type],serial=++this.enemySerial;
   const microSwarm=plan.pattern==='motes';
   const hp=(microSwarm?MOTE_SWARM.hp:def.hp)*(type==='scout'?(1+Math.min(.65,this.time/1600)):
    (1+Math.min(2.5,this.time/550)))*
    (1+.16*(strongholdTier-1))*(1+.05*industrialTech);
   const enemy={serial,group,type,x:xy.x,y:xy.y,vx:0,vy:0,
    r:microSwarm?MOTE_SWARM.radius:type==='gunship'?22:14,hp,maxHp:hp,
    damage:(microSwarm?MOTE_SWARM.damage:def.dmg)*(1+.05*(strongholdTier-1)+.015*industrialTech),
    strongholdTier,industrialTech,think:Math.random()*.32,fire:1+Math.random(),state:'hunt',
    commitUntil:0,target:this.player,angle:0,hit:0,expAwarded:false,
    scenario:plan.pattern,protect:null,
    // Ordinary traffic has a route through the sector. Only a documented
    // noise report can dispatch ships towards a known incident position.
    _patrolRoute:noiseSignal?null:
      ambientPatrolRoute(cam,member.side,member.position,serial),
    stormAdapted:regionAt(xy.x,xy.y).id==='azure'&&type==='flanker',
    entryPortalPending:type==='gunship'&&!this.heavyPortalShown};
   if(microSwarm)Object.assign(enemy,{microSwarm:true,moteRoot:group,motePack:group,
    moteSpawnedAt:this.time,moteFlank:0,moteReformUntil:0,
    // Enter as an ordinary traffic formation; only local sensing may
    // replace this route with a last-known position of the moving player.
    moteApproach:enemy._patrolRoute});
   if(intelSource)Object.assign(enemy,{signalIntel:createSignalIntel(
      intelSource.x,intelSource.y,this.time),signalLeader:i===0,
     signalSlot:i,signalExitX:xy.x,signalExitY:xy.y});
   if(!intelSource&&i===0&&plan.label&&this.time-this.lastEncounterLabelAt>=14){
    enemy.encounterLabel=plan.label;this.lastEncounterLabelAt=this.time;
   }
   created.push(enemy);
  }
  // Direct references keep formations cheap: no squad-wide search each frame.
  for(let i=0;i<created.length;i++){
   const index=plan.members[i].protectIndex;
   if(index>=0)created[i].protect=created[index];
  }
  this.enemies.push(...created);
  return plan.pause;
 }
 handleFieldMining(rock,kind){
  const op=this.operation;
  if(op?.id==='deep-resonance'&&op.phase==='active'&&kind==='strike'&&
   op.samples.some(s=>!s.done&&s.id===rock.id)){
   op.resonance=Math.min(100,op.resonance+55);
   op.nextGeologyCheck=0;
   this.notice('Раскалывающий удар разрушил образец. Руда получена, но лаборатории потребуется другая целая залежь. Резонанс усилился.',5);
   return;
  }
  if(!fieldOperationMining(this.operation,rock,kind))return;
  this.notice(op.phase==='return'?'Оба образца получены. Возвращайтесь в лабораторию.':
   'Первый образец готов. Можно отступить с частью награды или добыть второй.',4.5);
  if(this.waypoint?.id===op.id){
   const target=op.phase==='return'?this.world.stations.get(op.baseId):op;
   if(target){this.waypoint.x=target.x;this.waypoint.y=target.y;}
  }
 }
 damageRock(rock,damage,sourceX,sourceY,kind='auto',showImpact=true,contact=null){
  if(!rock?.alive)return;
  if(rock.evolutionWreck){
   rock.hp=Math.max(0,rock.hp-Math.max(0,damage));
   if(showImpact)this.heritage.vfx.hullImpact(contact?.x??rock.x,contact?.y??rock.y,damage>30,contact);
   if(rock.hp<=0){rock.alive=false;this.heritage.vfx.nova(rock.x,rock.y,rock.r,'cyan');}
   return;
  }
  const destroyed=impactRock(rock,damage,sourceX,sourceY,kind);
  // Emit noise as the ore fractures so the player can judge danger in time.
  if(kind==='extract'&&damage>0){
   const emitted=extractionNoiseDelta(rock,this.skillRanks.mining||0,this.nearQuietLab);
   if(emitted>0){
    this.miningNoise+=emitted;
    this.lastNoiseSource={x:rock.x,y:rock.y};
   }
  }
  if(showImpact){
   const point=contact||contactOnCircle(rock.x,rock.y,rock.r,sourceX,sourceY);
   this.heritage.vfx.asteroidImpact(
    point?.directed?point.x:rock.x,point?.directed?point.y:rock.y,
    rock.r,kind==='extract'&&!!rock.rich,point);
   if(kind==='auto')this.heritage.play('stone',.27,{x:rock.x,y:rock.y});
   // Electric extraction has one continuous tool sound, managed in heritage.
  }
  if(!destroyed)return;
  this.handleFieldMining?.(rock,kind);
  if(kind==='extract'){
   this.advanceContract('mine',rock);
   // Check whether the first-rich-rock bonus had already been paid *before*
   // this extraction. Migrated saves may have no historical survey ledger.
   const surveyXp=claimGeologicalSurvey(this.player,rock,kind,this.skillRanks.mining||0);
   const discoveryXp=firstRichAsteroidExperience(this.player,rock,kind);
   if(discoveryXp||surveyXp){
    const previousLevel=this.player.level;
    this.awardExperience(discoveryXp+surveyXp);
    this.rewardNotice(discoveryXp?'Исследован первый богатый астероид: +'+discoveryXp+' опыта':
     'Изучено новое месторождение: +'+surveyXp+' опыта',previousLevel,3.5);
   }
  }
  this.heritage.vfx.asteroidBreak(rock.x,rock.y,rock.r);
  this.heritage.play('rockBreak',.22,{x:rock.x,y:rock.y});
  // Hostile fire consumes stone cover; only player actions can yield alloy.
  if(kind==='cover')return;
  const total=rockYield(rock,kind,{...this.skillRanks,doctrine:this.doctrine}),count=kind==='strike'?3:kind==='auto'?1:2;
  for(let i=0;i<count;i++){
   const value=Math.floor(total/count)+(i<total%count?1:0);
   const a=i*Math.PI*2/count+rock.x*.13,scatter=22+rock.r*.25;
   this.addDrop('ore',rock.x+Math.cos(a)*scatter,rock.y+Math.sin(a)*scatter,
    value,{life:kind==='strike'?25:34,hot:kind==='strike',
     vx:Math.cos(a)*(kind==='strike'?120:70),
     vy:Math.sin(a)*(kind==='strike'?120:70)});
  }
 }
 addDrop(type,x,y,value,options={}){
  // A distant kill or a crowded field cannot silently credit uncollected loot.
  // Prefer replacing a fading ordinary drop; preserve special field charges.
  if(!makeRoomForDrop(this.drops,RULES.maxDrops))return false;
  this.drops.push({type,x,y,value,source:options.source||null,
   vx:options.vx??(Math.random()-.5)*55,
   vy:options.vy??(Math.random()-.5)*55,
   xpGranted:options.xpGranted===true,hot:!!options.hot,life:options.life??34});
 }
 issueFieldCharge(e){
  if(e.fieldDropChecked||e.hp>0||e.converted)return false;
  e.fieldDropChecked=true;
  const id=e.fieldChargeOperation,base=this.world.stations.get(e.fieldChargeBaseId),loan=this.fieldLoan;
  if(!id||!base||!loan||(base.fieldChargeIssued||{})[id]||loan.charges>=fieldWeapon(loan).capacity)return false;
  if(this.addDrop('fieldCell',e.x+12,e.y,1,{life:34})===false)return false;
  base.fieldChargeIssued??={};base.fieldChargeIssued[id]=true;return true;
 }
 awardExperience(amount){
  const gained=grantExperience(this.player,amount);
  if(gained){
   this.heritage.play('levelUp',.4);
   this.evolutionReceipt=null;
   if(this.fieldEvolution){
    this.fieldEvolution.levelAt=this.time;
    offerLevelCrystals(this,gained,SKILLS);
    this.syncEvolutionPrompt();
   }
   this.heritage.vfx.nova(this.player.x,this.player.y,105,'cyan');
   this.notice((gained>1?'Получено уровней: '+gained+'. ':'НОВЫЙ УРОВЕНЬ! ')+
    (this.fieldEvolution?.offers.length?'Откройте «Улучшить»: новый навык добавится к прежним. Очко можно сохранить.':
     'Очко развития ждёт вас в меню пилота.'),4.2);
  }
  return gained;
 }
 awardStrategicExperience(amount){
  if(amount>0)this.awardExperience(amount);
  return amount;
 }
 collect(item){
  const p=this.player;
  if(item.type==='parasiteCore')return collectParasiteCore(this);
  if(item.type==='fieldBoost'||item.type==='fieldRepair')return collectFieldLoot(this,item);
  if(item.type==='fieldCell'){
   const spec=this.fieldLoan&&fieldWeapon(this.fieldLoan);
   if(!spec||this.fieldLoan.charges>=spec.capacity)return false;
   this.fieldLoan.charges=Math.min(spec.capacity,this.fieldLoan.charges+1);
   this.heritage.play('pickup',.21);
   this.notice(spec.short+': подобран заряд · '+this.fieldLoan.charges+'/'+spec.capacity,2.5);return true;
  }
  this.heritage.play('pickup',.21);
  if(item.type==='ore'){
   p.ore+=item.value;this.cockpit.resourceGain(item.value,this.time);
   recordSortieIncome(this,'ore',item.source||'mining',item.value);
  }
  else{
   if(item.source)recordSortieIncome(this,'data',item.source,item.value);
   p.data+=item.value;
   // Combat experience is earned at the kill, independently of collected data.
   this.awardExperience(experienceFromPickup(item));
  }
 }
 update(dt){
  const p=this.player;this.time+=dt;this.visuals.updateSky(p.x,p.y);
  updateFieldEvolution(this,dt);
  updateFieldLoot(this);
  if(this.enemyLearning?.dirty&&this.time>=this.enemyLearning.nextSave)
   this.enemyLearning.flush(this.time);
  updateFieldEffects(this);
  coolWeapons(this.weaponThermal,dt,this.holdFire);
  this.heritage.tick(dt,this);
  this.updateCarrierInterception(dt);
  this.updateCorridor(dt);
  this.updateRelayDefense(dt);
  advanceFieldOperation(this,dt);
  if(this.operation?.phase==='failed'&&isFieldOperation(this.operation))this.failFieldOperation(this.operation);
  if(isFieldOperation(this.operation)&&this.waypoint?.id===this.operation.id){
   const target=this.operation.phase==='return'?this.world.stations.get(this.operation.baseId):this.operation;
   if(target){this.waypoint.x=target.x;this.waypoint.y=target.y;}
  }
  const sortieEvents=advanceFluxSortie(this.world,this.time,dt,this.enemies,this.player);
  for(const event of sortieEvents){
   const target=this.world.stations.get(event.targetId),title=target?.title||'Промышленный пост';
   const arrived=event.kind==='sortieArrived';
   const cause=arrived?'Постановщик помех добрался до радиовышки':
    event.kind==='sortieLost'?'Враги перехватили постановщик помех':
    event.kind==='sortieAborted'?'Вражеский пост уже выведен из строя':
    'Рейс завершился без доставки';
   const effect=arrived?'Связь поста «'+title+'» нарушена на '+FLUX_SORTIE.duration+' с. Повредите турели или открытый корпус поста, чтобы остановить выпуск грузов дольше':
    'Уже оплаченный флюкс потрачен; новый рейс потребует ресурсов';
   recordWorldFeedback(this,{key:'flux-sortie:'+event.kind+':'+event.targetId+':'+Math.floor(this.time),
    kind:arrived?'industry':'loss',label:arrived?'РАДИОУЗЕЛ ЗАГЛУШЕН':'РЕЙС ПРЕРВАН',
    cause,effect,x:arrived?target?.x:event.x,y:arrived?target?.y:event.y});
   this.notice(cause+'. '+effect+'.',arrived?6:5);
   if(arrived){this.flash?.(event.x,event.y,target.x,target.y,'#9df8ed');
    this.heritage?.vfx?.nova?.(target.x,target.y,165,'cyan');}
  }
  for(const event of advanceIndustrialBreaches(this.world,this.time)){
   recordWorldFeedback(this,{key:'industrial-repair:'+event.depot.id+':'+Math.floor(this.time),
    kind:'industry',label:'ВРАГ ВОССТАНОВИЛ ПОСТ',
    cause:'Промышленность потратила '+event.cost+' ед. сырья на ремонт связи',
    effect:'Отправка грузов может возобновиться, если у источника остались материалы',
    x:event.depot.x,y:event.depot.y});
   if(dist(this.player,event.depot)<1800)this.notice('Вражеский пост восстановил связь за '+event.cost+' ед. сырья.',5);
  }
  updateRegionalWorld(this,dt);
  // Also covers restored saves and stations recovering from temporary jamming.
  if(this.time>=(this.nextAutoContourCheckAt||0)){
   this.nextAutoContourCheckAt=this.time+1.5;
   this.refreshAutomaticContours();
  }
  syncContourDynamics(this);
  updateContourTrials(this,dt);
  updateTerritoryBenefits(this,dt);
  const contourEvents=advanceContours(this.world,this.time,dt,this.enemies,this.player);
  recordContourFeedback(this,contourEvents);
  this.contourDeliveryFX=(this.contourDeliveryFX||[])
   .filter(fx=>this.time-fx.at<1.5);
  let firstDeliveryXp=0;
  for(const event of contourEvents){
   if(event.kind==='delivered'&&event.amount>.01){
    this.contourDeliveryFX.push({fieldId:event.fieldId,amount:event.amount,at:this.time});
    firstDeliveryXp+=claimFirstFluxDelivery(p,event.amount);
   }
  }
  if(firstDeliveryXp){
   const previousLevel=p.level;
   this.awardStrategicExperience(firstDeliveryXp);this.lastContourNoticeAt=this.time;
   this.rewardNotice('Первая доставка флюкса из территориальной воронки: +'+firstDeliveryXp+
    ' опыта. Запас доступен на карте контуров.',previousLevel,5);
  }else if(contourEvents.some(e=>e.kind==='reserveLost')){
   this.notice('Опорная станция потеряна. Её ложный маяк уничтожен вместе с запасом флюкса.',5);
  }else if(contourEvents.some(e=>e.kind==='lost')&&this.time-this.lastContourNoticeAt>18){
   this.lastContourNoticeAt=this.time;
   this.notice('Вражеский налёт уничтожил добывающего плазмофага. Следующая экспедиция отправится автоматически.',5);
  }else if(contourEvents.some(e=>e.kind==='delivered'&&e.amount>.05)&&
   this.time-this.lastContourNoticeAt>48&&fieldAt(this.world,this.player.x,this.player.y)){
   this.lastContourNoticeAt=this.time;
   this.notice('Сборщики доставили флюкс. На карте контуров его можно потратить на щит или ложный маяк для опорной станции.',4);
  }
  let mx=(isPressed(this.keys,this.controls,'right')||this.keys.has('ArrowRight')?1:0)-
    (isPressed(this.keys,this.controls,'left')||this.keys.has('ArrowLeft')?1:0)+this.touch.x;
  let my=(isPressed(this.keys,this.controls,'down')||this.keys.has('ArrowDown')?1:0)-
    (isPressed(this.keys,this.controls,'up')||this.keys.has('ArrowUp')?1:0)+this.touch.y;
  const m=length(mx,my);if(m>1){mx/=m;my/=m;}
  const cruiseStarted=updateCruise(this,mx,my,dt);
  if(cruiseStarted&&this.time>this.messageUntil)
   this.notice('Маршевый перелёт ×'+EXPEDITION_CRUISE.multiplier+
    ': при угрозе корабль возвращается к обычной скорости.',3.5);
  const speed=(272+this.skillRanks.engine*35)*(this.mining.active?.78:1)*
   (this.cruising?EXPEDITION_CRUISE.multiplier:1);
  const boosting=p.burstRemaining>0;
  const targetX=boosting?p.burstX*speed*2.25:mx*speed;
  const targetY=boosting?p.burstY*speed*2.25:my*speed;
  const response=1-Math.exp(-(boosting?17:5.6)*dt);
  p.vx+=(targetX-p.vx)*response;
  p.vy+=(targetY-p.vy)*response;
  p.burstRemaining=Math.max(0,p.burstRemaining-dt);
  p.burstCooldown=Math.max(0,p.burstCooldown-dt*(this.territorySupport?.dashRate||1));
  const previousX=p.x,previousY=p.y;
  p.x+=p.vx*dt;p.y+=p.vy*dt;
  if(boosting)markDashPass(this,previousX,previousY);
  // Cull decorative effects at creation, not only when painting the frame.
  this.heritage.vfx.setViewport(this.camera());
  if(length(p.vx,p.vy)>9)p.angle=Math.atan2(p.vy,p.vx)+Math.PI/2;
  if(Math.hypot(p.vx,p.vy)>150)
   this.heritage.vfx.engineTrail(p.x,p.y,p.angle,'fighter',boosting,dt);
  p.invul=Math.max(0,p.invul-dt);
  if(this.skillRanks.shield && this.time-this.lastDamageAt>3 &&
   p.shield<16+this.skillRanks.shield*24)
   p.shield=Math.min(16+this.skillRanks.shield*24,
    p.shield+dt*(1.8+this.skillRanks.shield*1.2));
  if(length(p.x-this.lastX,p.y-this.lastY)>120){
   this.lastX=p.x;this.lastY=p.y;this.stationary=0;
  }else this.stationary+=dt;
  if(!this.contourTrial&&this.time>55&&this.stationary>8){
   this.stationary=0;this.zones.push({x:p.x+35,y:p.y-25,r:85,fuse:1.8,fuseStart:1.8,ttl:.3});
   this.heritage.play('orbitalWarning',1.3,{x:p.x+35,y:p.y-25});
   this.notice('Орбитальная наводка — уходите из круга!',2);
  }
  if(!this.contourTrial)this.zoneClock-=dt;
  if(!this.contourTrial&&this.zoneClock<=0){
   this.zoneClock=Math.max(12,28-this.time/110);
   const a=Math.random()*TAU;
   const zone={x:p.x+Math.cos(a)*135,y:p.y+Math.sin(a)*110,
     r:64,fuse:2.4,fuseStart:2.4,ttl:.3};
   this.zones.push(zone);
   this.heritage.play('orbitalWarning',1.3,zone);
  }
  // Rock positions and station discovery are spatially stable. Recheck only
  // after travel or a short interval instead of traversing world cells each AI tick.
  this.worldQueryClock-=dt;
  if(this.worldQueryClock<=0||Math.hypot(p.x-this.worldQueryX,p.y-this.worldQueryY)>75){
   this.nearRocks=this.world.nearbyRocks(p.x,p.y,Math.max(this.vw,this.vh)*.85+450);
   let discoveredXp=0;const friendlyFinds=[];let exploredCount=0;
   for(const b of this.world.discover(p.x,p.y,570+this.skillRanks.radar*190)){
    if(this.waypoint?.id===b.id)this.waypoint={id:b.id,x:b.x,y:b.y,label:b.title||baseNames[b.type]};
    exploredCount++;
    discoveredXp+=claimExploration(p,b,this.skillRanks.radar||0);
    if(!b.enemy&&!b.active){
     friendlyFinds.push(baseNames[b.type]);this.heritage.world('discover');
    }
   }
   if(discoveredXp){
    const previousLevel=p.level;
    this.awardStrategicExperience(discoveredXp);
    this.rewardNotice((exploredCount===1?'Обнаружена новая станция':'Обнаружены станции: '+exploredCount)+
     ' · +'+discoveredXp+' опыта за разведку.',previousLevel,4);
   }else if(friendlyFinds.length)
    this.notice('Обнаружена станция: '+friendlyFinds[0],3);
   this.localStations=this.world.nearbyStations(p.x,p.y,1000,false);
   const localStations=this.localStations.filter(b=>b.active);
   this.nearDock=localStations.find(b=>b.type==='dock'&&dist(b,p)<185)||null;
   this.nearArsenalBonus=localStations.some(b=>b.type==='arsenal'&&b.module==='amplifier'&&dist(b,p)<650);
   this.nearArsenalDefense=localStations.some(b=>b.type==='arsenal'&&b.module==='jammer'&&dist(b,p)<650);
   this.nearDockField=localStations.some(b=>b.type==='dock'&&b.module==='bulwark'&&dist(b,p)<650);
   this.nearQuietLab=localStations.some(b=>b.type==='lab'&&!b.suppressed&&b.module==='quiet'&&dist(b,p)<900);
    this.worldQueryX=p.x;this.worldQueryY=p.y;this.worldQueryClock=.18;
  }
  this.rockGrid.clear();
  for(const rock of this.nearRocks){
   updateRockMotion(rock,dt);
   if(rock.alive&&rock.r>=34)this.rockGrid.insert(rock);
  }
  for(const wreck of this.fieldEvolution?.wrecks||[])if(wreck.alive)this.rockGrid.insert(wreck);
  if(!this.amberBeltSeen&&nearAmberBelt(p.x,p.y)){
   this.amberBeltSeen=true;
   this.heritage.world('amber');
   this.notice('Малый янтарный пояс: крупные астероиды задерживают вражеские снаряды. Используйте их как укрытие!',5);
  }
  if(!this.ionFieldSeen&&ionApproach(p,ION_FIELD,650)){
   this.ionFieldSeen=true;
   this.heritage.world('ion');
   this.notice('Лазурный разлом: голубое кольцо — область ионного разряда. Следите за отсчётом и обходите опасную зону.',6);
  }
  if(this.nearDock&&dist(this.nearDock,p)<165&&this.time-this.lastDamageAt>4){
   const before=p.hp;
   p.hp=Math.min(p.maxHp,p.hp+2.9*dt*(this.nearDock.module==='workshop'?1.6:1));
   recordSortieRepair(this,p.hp-before);
   let serviced=p.hp>before;
   for(const a of this.allies)if(dist(a,this.nearDock)<200){
    const prior=a.hp;
    a.hp=Math.min(a.maxHp,a.hp+3.4*dt*(this.nearDock.module==='workshop'?1.6:1));
    serviced=serviced||a.hp>prior;
   }
   if(serviced&&this.time-(this.nearDock.lastRepairVisualAt??-Infinity)>2.1){
    markDockEvent(this.nearDock,'repair',this.time);
    this.nearDock.lastRepairVisualAt=this.time;
   }
  }
  const miningStats=extractorStats(this.skillRanks.extractor||0,this.skillRanks.mining||0);
  const candidate=miningTarget(this.nearRocks,p,this.mining.target,miningStats.range);
  this.mining.target=candidate;
  this.updateProbe();
  const probe=this.operation?.id===PROBE_OPERATION.id?this.operation:null;
  const atProbe=!!probe&&probe.located!==false&&probe.phase!=='return'&&dist(p,probe)<=PROBE_OPERATION.repairRange;
  this.interactionFocus=this.currentInteraction();
  // Action kind is locked when pressed. Neither docking nor repair may hijack mining.
  this.probeRepairing=activeInteraction(this.actionHeld,'repair',atProbe);
  this.openingRepairing=activeInteraction(this.actionHeld,'opening-repair',
   openingArcActive(this.openingArc)&&this.openingArc.kind==='rescue'&&
   Math.hypot(p.x-this.openingArc.rescueX,p.y-this.openingArc.rescueY)<=OPENING_ARC.repairRange);
  this.mining.active=activeInteraction(this.actionHeld,'mine',candidate?.alive);
  this.updateOpeningArc(dt);
  if(this.mining.active&&!this.miningIntroShown){
   this.miningIntroShown=true;
   this.notice(matchMedia('(pointer: coarse)').matches?
    'Добыча: удерживайте «Действие». Шум привлекает патрули.':
    'Удерживайте '+this.controlLabel('interact')+' для добычи. Техногенный сигнал привлекает патрули — выбирайте момент.',4.5);
  }
  this.heritage.extraction(this.mining.active);
  if(this.mining.active){
   const effect=this.mining.fxClock<=0;
   this.damageRock(candidate,miningStats.damagePerSecond*(this.doctrine==='prospect'?1.15:1)*dt,
    p.x,p.y,'extract',effect);
   this.mining.fxClock=effect?.20:this.mining.fxClock-dt;
  }else this.mining.fxClock=0;
  if(this.probeRepairing)this.repairProbe(dt);
  this.grid.clear();
  for(const e of this.enemies)if(e.hp>0)this.grid.insert(e);
  updateMoteSwarmOrders(this);
  this.enemyComms?.update(this);
  this.shotGrid.clear();
  for(const s of this.shots)if(s.alive)this.shotGrid.insert(s);
  this.miningNoise=Math.max(0,Math.min(110,this.miningNoise-dt*MINING_NOISE.decay));
  if(this.miningNoise<MINING_NOISE.clear)this.miningNoiseWarned=false;
  if(this.miningNoise>=MINING_NOISE.warn&&!this.miningNoiseWarned){
   this.miningNoiseWarned=true;
   this.notice('Сигнал добычи усиливается. Следующий патруль может засечь вас!',3.6);
  }
  if(this.miningNoise>=MINING_NOISE.patrol&&this.time>=MINING_NOISE.firstPatrolAt){
   const alarm=this.sectorDirector(openingThreat(this.time,this.player.level));
   if(this.enemies.length<alarm.cap){
    const before=this.enemies.length;
    const source=this.lastNoiseSource||{x:p.x,y:p.y};
    const responders=alarm.types.filter(type=>
      type==='scout'||type==='fighter'||type==='flanker');
    const recovery=this.spawnGroup({...alarm,types:responders,
      groupSize:Math.min(2,alarm.groupSize)},source);
    if(this.enemies.length>before){
     this.noiseAlert={x:source.x,y:source.y,startedAt:this.time,until:this.time+2.8};
     // The patrol replaces the next scheduled group instead of surrounding
     // the player with two unrelated arrivals in the same moment.
     this.spawnClock=Math.max(this.spawnClock,4.5+recovery);
     this.miningNoise=0;this.miningNoiseWarned=false;
     this.notice('Экстрактор выдал позицию! Патруль идёт на сигнал.',4);
    }
   }
  }
  this.spawnClock-=dt;
  if(this.spawnClock<=0){
   if(this.contourTrial||
       (this.operation?.id===RELAY_DEFENSE.id&&this.operation.phase!=='approach')||
       carrierInFlight(this.operation)||this.operation?.strikerSerial){
    // The authored assault replaces ambient patrols; cap combat pressure.
    this.spawnClock=4.5;
   }else{
   const director=this.sectorDirector(openingThreat(this.time,this.player.level));
   const tempo=ambientTempoPlan(this,director);
   if(tempo.mode==='wait'){
    this.spawnClock=Math.max(.65,tempo.delay);
   }else{
   const stageDirector=tempo.director;
   const frontier=spawnFrontierRaid(this,stageDirector);
   const central=frontier?0:spawnCentralRaid(this,stageDirector);
   // Paid reinforcements now accompany a regular encounter. They must not
   // silently grant six seconds of relief after the larger formation.
   const recovery=frontier||central||spawnRegionalRaid(this,stageDirector)||this.spawnGroup(stageDirector);
   // Give the player room to clear an overwhelming formation, without
   // suppressing the large waves when a strong build is mowing them down.
   const pressure=this.enemies.length/Math.max(1,stageDirector.cap);
   this.spawnClock=(tempo.mode==='flock'?15:tempo.mode==='normal'&&this.time>=175?11:director.interval)+recovery+
    Math.min(3.5,Math.max(0,pressure-.48)*8.5);
   }
   }
  }
  this.updateStrikes(dt);
  updateTactical(this);
  for(const e of this.enemies){
   this.activeEnemyFirer=e;
   if(!e.interceptCargo&&!updateStationInterdiction(this,e,dt))updateEnemy(e,this,dt);
   if(e.hp>0&&!e.trialId&&patrolCanLeave(e,this)){
    e.hp=0;e.expAwarded=true;
   }
   if(e.entryPortalPending){
    if(this.heavyPortalShown)e.entryPortalPending=false;
    else if(e.hp>0&&!outsideCamera(e.x,e.y,this.camera(),e.r+12)){
     e.entryPortalPending=false;this.heavyPortalShown=true;
     this.heritage.vfx.bossPortal(e.x,e.y,35);
     this.heritage.play('boss',.1,{x:e.x,y:e.y});
    }
   }
  }
  this.activeEnemyFirer=null;
  this.enemyComms?.confirmExecution(this);
  for(const a of this.allies){
   a.hit=Math.max(0,(a.hit||0)-dt);
   updateAlly(a,this,dt);
  }
  this.updateMissiles(dt);
  updateFlakPellets(this,dt);
  updateHowitzer(this,dt);
  updateMouseArsenal(this,dt);
  // Defense resolves warned impacts and imminent shots before collision damage.
  // It does not kill enemies or award loot/experience while the player waits.
  updateStationDefense(this);
  for(const s of this.shots){
   if(!s.alive)continue;
   const nextX=s.x+s.vx*dt,nextY=s.y+s.vy*dt;
   const travel=Math.hypot(nextX-s.x,nextY-s.y);
   const candidates=this.rockGrid.query((s.x+nextX)*.5,(s.y+nextY)*.5,65+travel*.5);
   const cover=firstRockImpact(s.x,s.y,nextX,nextY,candidates,s.r,p);
   s.x=cover?.x??nextX;s.y=cover?.y??nextY;s.life-=dt;
   if(cover){
    s.alive=false;
    const rock=cover.rock;
    // Stone stops this projectile, but repeated fire can destroy the shelter.
    this.damageRock(rock,Math.min(12,Math.max(1,s.damage*.5)),s.x,s.y,'cover',false);
    if(!this.coverWearWarned&&rock.alive&&rock.hp<=rock.maxHp*.52&&dist(rock,p)<310){
     this.coverWearWarned=true;
     this.notice('Укрытие осыпается под огнём. Пора менять позицию.',3.2);
    }
    if(this.time-(rock.lastCoverVfxAt??-Infinity)>.12){
     rock.lastCoverVfxAt=this.time;
     this.heritage.vfx.coverImpact(s.x,s.y,rock.r,
      contactAtPoint(rock.x,rock.y,s.x,s.y));
    }
   }
   if(s.life<=0)s.alive=false;
   if(s.alive){
    if(!hitFriendlyShip(this,s)&&dist(s,p)<s.r+p.r){
      s.alive=false;
      const before=p.hp+p.shield;
      this.hurt(s.damage,{x:s.x,y:s.y});
      this.enemyLearning?.dealt(s.learnToken,Math.max(0,before-p.hp-p.shield));
    }
   }
  }
  this.shots=this.shots.filter(s=>s.alive);
  for(const e of this.enemies){
   e.hit=Math.max(0,(e.hit||0)-dt);
   if(e.hp>0)continue;
   if(e.corridorCourier){
    const op=this.world.home.corridorMission||this.operation;
    if(op?.radioSerial===e.serial)this.stopCorridorRadio(op);
   }
   if(e.probeAssault){
    const op=this.world.stations.get(e.probeAssault)?.probeMission||this.operation;
    if(op?.strikerSerial===e.serial)op.strikerSerial=null;
   }
   if(e.trialId!==undefined&&e.trialId===this.contourTrial?.entry?.id)
    this.contourTrial.defeatedIds?.add(e.serial);
   if(e.trialId!==undefined&&!e.fieldRewarded&&!e.converted&&!e.trialRetreatUntil){
    e.fieldRewarded=true;
    enemyFieldReward(this,e,qualifiesForDirectCombatXp(e,this.time));
    if(e.converted)continue;
   }
   rememberCargoEscort(e);
   recordOpeningCommanderDefeat(this.openingArc,e,this.time);
   if(!e.visualDeath){
    e.visualDeath=true;
    const heavy=e.type==='gunship';
    if(e.microSwarm){
     this.heritage.vfx.nova(e.x,e.y,13,'cyan');
     if(this.time>=(this._nextMoteDeathSoundAt||0)){
      this.heritage.play('explosion',.075,{x:e.x,y:e.y});
      this._nextMoteDeathSoundAt=this.time+.32;
     }
    }else{
     this.heritage.vfx.shipExplosion(e.x,e.y,e.r*(heavy?1.65:1),
      e.converted?'#73ffda':'#ff8594',heavy);
     if(heavy)this.heritage.vfx.nova(e.x,e.y,110,'red');
     this.heritage.play(heavy?'largeExplosion':'explosion',.18,{x:e.x,y:e.y});
    }
   }
   this.enemyLearning?.finish(e,this.time);
   this.issueFieldCharge(e);
   // A previously XP-rewarded field guard can still count as a combat kill
   // in a simultaneously accepted contract, provided the pilot participated.
   this.creditContractKill(e);
   if(!e.expAwarded&&!e.converted){
    e.expAwarded=true;
    const combatXp=enemyDataReward(e);
    const directXp=qualifiesForDirectCombatXp(e,this.time);
    if(directXp)this.awardExperience(combatXp);
    rewardEyeKill(this,e,directXp);
    if(!e.microSwarm)this.addDrop('data',e.x,e.y,combatXp,
     {source:'combat',life:50,xpGranted:directXp});
    const salvage=enemySalvage(e);
    // The dock repairs the ship for free. Standing inside its healing field
    // should never become a safe, automatic source of alloy.
    if(salvage&&!(this.nearDock&&dist(this.nearDock,p)<180))
     this.addDrop('ore',e.x+10,e.y-9,salvage,{source:'salvage',life:24});
    enemyFieldReward(this,e,directXp);
   }
  }
  this.enemies=this.enemies.filter(e=>{
   const probe=e.missionStrike?.target==='probe'&&this.world.stations.get(e.probeAssault)?.probeMission;
   const retained=e.hp>0&&(e.interceptCargo||e.relayAssault||e.stationRaid||
    (isFieldOperation(this.operation)&&e.fieldOperation===this.operation.id)||
    (e.probeAssault&&e.probeAssault===this.operation?.baseId)||(probe&&probe.strikerSerial===e.serial)||
    (e.corridorCourier&&e.serial===(this.world.home.corridorMission||this.operation)?.radioSerial)||
    (e.openingCommander&&openingArcActive(this.openingArc))||
    dist(e,p)<Math.max(this.vw,this.vh)*1.65+500);
   if(!retained)rememberCargoEscort(e);
   return retained;
  });
  for(const a of this.allies){
   for(const e of this.grid.query(a.x,a.y,a.r+35)){
    if(e.hp<=0||e.converted||dist(a,e)>a.r+e.r)continue;
    this.hitAlly(a,e.damage*dt*.8);
   }
  }
  this.updateShipWeapons(dt);
  updateRegionalStorms(this,dt);
  const radar=400+this.skillRanks.radar*220;
  for(const b of this.world.nearbyStations(p.x,p.y,Math.max(900,radar))){
   if(!b.enemy||(!b.strategicRole&&!this.enemyBasesUnlocked())||b.captured)continue;
   if(dist(b,p)>850)continue;
   for(const t of b.turrets){
    if(t.hp<=0||t.kind&&t.kind!=='turret')continue;
    const turretStyle=this.enemyLearning?.styleFor(t,this.time,'turret');
    t.shot-=dt;t.flash=Math.max(0,(t.flash||0)-dt);
    if(t.shot<=0){
     t.shot=2.2+Math.random()*.35;
     const target=this.support.missions.flatMap(m=>m.craft)
      .filter(a=>a.hp>0&&dist(a,t)<350)
      .sort((a,c)=>dist(t,a)-dist(t,c))[0]||p;
     if(dist(t,target)<530){
      // Turrets track only a target within their own weapon envelope.
      // Other patrols' motion sightings cannot adjust this gun's aim.
      if(target===p)this.enemyLearning?.observePlayer(p,this.time,t);
      const aim=target===p?learnedTurretAim(target,turretStyle,
       t._learningObservation?.turnSign||0):{x:target.x,y:target.y};
      if(this.enemyShot(t.x,t.y,aim.x,aim.y,16+b.rank*2,
       {learnToken:this.enemyLearning?.shotToken(t)})!==false)
       this.enemyLearning?.fired(t);
     }
    }
   }
  }
  for(const z of this.zones){
   if(z.fuse>0){z.fuse-=dt;continue;}
   z.ttl-=dt;
   if(!z.done){
    z.done=true;z.ttl=.62;
    this.heritage.vfx.meteorStrike(z.x,z.y,z.r,z.r>80);
    this.heritage.play('largeExplosion',.28,{x:z.x,y:z.y});
    if(dist(z,p)<z.r+p.r)this.hurt(27,{x:z.x,y:z.y});
    for(const e of this.grid.query(z.x,z.y,z.r+30))
     if(e.hp>0&&dist(z,e)<z.r+e.r)this.damageEnemy(e,32);
    for(const a of this.allies)if(a.hp>0&&dist(z,a)<z.r+a.r)this.hitAlly(a,31);
    // The same orbital strike breaks mineral rocks: a risky free mining opportunity.
    let cracked=0;
    for(const rock of this.nearRocks){
     if(!rock.alive||Math.hypot(rock.x-z.x,rock.y-z.y)>z.r+rock.r*.65)continue;
     this.damageRock(rock,62,z.x,z.y,'strike',cracked<5);
     if(++cracked>=16)break;
    }
   }
  }
  this.zones=this.zones.filter(z=>z.fuse>0||z.ttl>0).slice(-9);
  // A pulse affects each ship at most once per cycle, even with substeps.
  // The visible ring and these exact contact checks share ION_FIELD.r.
  const ion=ionPhase(this.time);
  if(ion.state==='warning'&&this.lastIonAudioCycle!==ion.cycle&&
    Math.hypot(p.x-ION_FIELD.x,p.y-ION_FIELD.y)<ION_FIELD.r+180){
   this.lastIonAudioCycle=ion.cycle;
   this.heritage.play('ionWarning',3,ION_FIELD);
  }
  if(ion.state==='discharge'){
   if(inIonField(p)&&p.lastIonCycle!==ion.cycle){
    p.lastIonCycle=ion.cycle;this.hurt(16,ION_FIELD);
   }
   for(const e of this.enemies)if(e.hp>0&&inIonField(e)&&e.lastIonCycle!==ion.cycle){
    e.lastIonCycle=ion.cycle;this.damageEnemy(e,20);
   }
   for(const a of this.allies)if(a.hp>0&&inIonField(a)&&a.lastIonCycle!==ion.cycle){
    a.lastIonCycle=ion.cycle;this.hitAlly(a,16);
   }
  }
  for(const a of this.allies)if(a.hp<=0&&!a.visualDeath){
   a.visualDeath=true;
   this.heritage.vfx.shipExplosion(a.x,a.y,a.r*1.2,'#8df5e2');
   this.heritage.play('droneDestroyed',.22,{x:a.x,y:a.y});
  }
  recordSortieDroneLoss(this,this.allies.filter(a=>a.hp<=0).length);
  this.allies=this.allies.filter(a=>a.hp>0);
  for(const d of this.drops){
   d.life-=dt;d.x+=d.vx*dt;d.y+=d.vy*dt;
   d.vx*=Math.exp(-2*dt);d.vy*=Math.exp(-2*dt);
   const dx=p.x-d.x,dy=p.y-d.y,m=length(dx,dy);
   const pull=105+this.skillRanks.magnet*55+(this.territorySupport?.magnetBonus||0);
   if(m<pull){d.x+=dx*dt*4;d.y+=dy*dt*4;}
   if(m<27&&this.collect(d)!==false)d.life=-1;
  }
  this.drops=this.drops.filter(d=>d.life>0);
  // Legacy checkpoints can contain floating offers. They are never pickups.
  if(this.fieldEvolution?.crystals.length)this.fieldEvolution.crystals=[];
  for(const f of this.flashes)f.ttl-=dt;
  this.flashes=this.flashes.filter(f=>f.ttl>0);
  updateWeaponFx(this,dt);
 }
 drawSprite(image,x,y,w,h,angle=0){
  const c=this.ctx;
  if(!image?.complete||!image.naturalWidth)return false;
  c.save();c.translate(x,y);c.rotate(angle);
  c.drawImage(image,-w/2,-h/2,w,h);c.restore();return true;
 }
 drawCarrierRoute(c,cam){
  const op=this.operation?.id===CARRIER_INTERCEPTION.id?this.operation:null;
  const missions=op?[{route:op.route,phase:op.phase}]:[];
  for(const base of this.world.stations.values()){
   if(base.type==='carrier'&&base.supplyIntercepted&&dist(base,this.player)<4200)
    missions.push({route:carrierRoute(base),phase:'secured'});
  }
  for(const mission of missions){
   const route=mission.route;if(!route)continue;
   const secured=mission.phase==='secured',returning=mission.phase==='return';
   c.save();c.lineWidth=secured?2.7:2.2;
   c.strokeStyle=secured?'#74e8a797':returning?'#e3c17b65':'#ffbb7099';
   c.setLineDash(secured?[18,10]:[10,12]);
   c.beginPath();c.moveTo(route[0].x,route[0].y);
   c.lineTo(route[1].x,route[1].y);c.lineTo(route[2].x,route[2].y);c.stroke();
   c.setLineDash([]);
   const exit=route[2];
   if(!outsideCamera(exit.x,exit.y,cam,150)){
    c.translate(exit.x,exit.y);
    const a=Math.atan2(exit.y-route[1].y,exit.x-route[1].x);
    c.rotate(a+Math.PI/2);
    c.strokeStyle=secured?'#9af8c0':'#ffc078';c.lineWidth=3;
    c.beginPath();c.moveTo(-100,-48);c.lineTo(-100,48);
    c.moveTo(100,-48);c.lineTo(100,48);c.stroke();
    c.setLineDash([6,6]);c.beginPath();c.moveTo(-100,0);c.lineTo(100,0);c.stroke();
    c.setLineDash([]);c.rotate(-a-Math.PI/2);
    c.fillStyle=secured?'#b8f8c9':'#ffe0b3';c.textAlign='center';
    c.font='bold 12px system-ui';c.fillText(secured?'МАРШРУТ ОТКРЫТ':'ЛИНИЯ УХОДА ГРУЗА',0,-65,240);
   }
   c.restore();
   if(op&&mission.phase==='approach'&&!outsideCamera(route[0].x,route[0].y,cam,160)){
    c.save();c.strokeStyle='#ffdba1';c.lineWidth=2;c.setLineDash([8,7]);
    c.beginPath();c.arc(route[0].x,route[0].y,CARRIER_INTERCEPTION.triggerRange,0,TAU);c.stroke();
    c.setLineDash([]);c.font='bold 12px system-ui';c.textAlign='center';c.fillStyle='#ffe9bd';
    c.fillText('РАЙОН ВСТРЕЧИ КОНВОЯ',route[0].x,route[0].y-63,230);c.restore();
   }
  }
 }
 drawCarrierCargo(c,e){
  const pulse=carrierPulseState(e);
  if(pulse.key==='charging'){
   c.save();c.translate(e.x,e.y);c.fillStyle='#bb82ff12';c.strokeStyle='#d6a6ff';c.lineWidth=2.5;
   c.beginPath();c.arc(0,0,CARRIER_INTERCEPTION.pulseRange,0,TAU);c.fill();
   c.setLineDash([10,7]);c.stroke();c.setLineDash([]);
   c.lineWidth=4;c.beginPath();c.arc(0,0,60,-Math.PI/2,-Math.PI/2+TAU*pulse.charge);c.stroke();c.restore();
  }
  c.save();c.translate(e.x,e.y);c.rotate(e.angle||0);
  const flash=e.hit>0;
  const damage=1-Math.max(0,Math.min(1,e.hp/Math.max(1,e.maxHp)));
  const painted=paintMissionMorph(c,this.images?.missionFreighter,0,1,
   0,0,104,126,Math.min(1,Math.max(0,(damage-.12)/.7)),{rows:1});
  if(!painted){
   c.shadowColor='#ffb46c';c.shadowBlur=this.fps<34?2:flash?19:8;
   c.fillStyle='#111e36';c.strokeStyle=flash?'#fff0ca':'#ffb882';c.lineWidth=3;
   c.beginPath();c.moveTo(0,-55);c.lineTo(35,-29);c.lineTo(43,18);
   c.lineTo(28,48);c.lineTo(-28,48);c.lineTo(-43,18);
   c.lineTo(-35,-29);c.closePath();c.fill();c.stroke();c.shadowBlur=0;
   for(const x of [-25,0,25]){
    c.fillStyle=x===0?'#5b554a':'#554c42';c.fillRect(x-10,-24,20,55);
    c.strokeStyle='#e7ae68';c.lineWidth=1.7;c.strokeRect(x-10,-24,20,55);
   }
   c.fillStyle='#78d5f5';c.fillRect(-25,42,12,7);c.fillRect(13,42,12,7);
  }
  if(flash)paintMissionCell(c,this.images?.missionImpacts,0,0,0,90,90,
   {alpha:Math.min(.7,e.hit*.32)});
  c.strokeStyle=pulse.key==='vent'?'#8af0ca':'#afc5ff';c.lineWidth=4;
  c.setLineDash(pulse.key==='vent'?[5,8]:[]);
  c.beginPath();c.arc(0,0,62,-Math.PI/2-1.1,-Math.PI/2+1.1);c.stroke();c.setLineDash([]);
  c.strokeStyle=e.flightTime<(e.engineDisabledUntil||0)?'#ffbd75':'#83e6c2';c.lineWidth=3;
  c.beginPath();c.moveTo(-26,54);c.lineTo(0,63);c.lineTo(26,54);c.stroke();
  c.restore();
  const pct=Math.max(0,Math.ceil(e.hp/e.maxHp*100));
  c.save();c.textAlign='center';c.font='bold 12px system-ui';
  c.fillStyle='#ffdfb3';c.fillText('ТРАНСПОРТ · '+pct+'%',e.x,e.y-77,230);
  c.fillStyle='#142338';c.fillRect(e.x-48,e.y-68,96,7);
  c.fillStyle=pct<26?'#ff8569':'#ffcb78';c.fillRect(e.x-47,e.y-67,94*pct/100,5);
  c.font='bold 11px system-ui';c.fillStyle=pulse.key==='charging'?'#e6beff':'#a8f0d8';
  c.fillText(carrierTacticalCue(e,this.player),e.x,e.y+88,430);
  c.restore();
 }

 drawRelayDefense(c,cam){
  const op=this.operation;
  for(const base of this.localStations||[])
   if(base.relaySite)this.drawRelaySite(c,cam,base.relaySite,true);
  if(op?.id!==RELAY_DEFENSE.id)return;
  this.drawRelaySite(c,cam,op);
  if(op.phase==='wave')for(const e of this.enemies){
   if(e.relayAssault===op.baseId)this.drawMissionStrikeWarning(c,cam,e,
    e.missionStrike?.target==='antenna'?op.antenna:op);
  }
 }
 drawRelaySite(c,cam,op,online=false){
  if(!outsideCamera(op.x,op.y,cam,560)){
   const phase=online?'СВЯЗЬ ВОССТАНОВЛЕНА':relayDefenseCue(op,this.time);
   const hp=Math.max(0,op.hp/op.maxHp);
   c.save();c.translate(op.x,op.y);
   const pulse=this.visuals.reducedMotion?0:.5+.5*Math.sin(this.time*2.8);
   c.strokeStyle=online?'#85eeb0':'#81e4df';c.lineWidth=3;
   c.beginPath();c.arc(0,0,39,0,TAU);c.stroke();
   if(!online&&op.fieldShield>0){
    c.strokeStyle='#83fbe9';c.lineWidth=4;
    c.beginPath();c.arc(0,0,60,0,TAU*op.fieldShield/RELAY_DEFENSE.prepShield);c.stroke();
   }
   c.strokeStyle='rgba(130,237,221,'+(.22+pulse*.28).toFixed(3)+')';
   c.lineWidth=1.7;c.beginPath();c.arc(0,0,55+pulse*5,0,TAU);c.stroke();
   const relay=this.images?.relayPoses;
   if(relay?.complete&&relay.naturalWidth>=768){
    c.drawImage(relay,online?512:0,0,256,256,-52,-52,104,104);
   }else{
    c.fillStyle='#09304a';c.beginPath();
    for(let i=0;i<6;i++){
     const a=i*TAU/6-Math.PI/2;
     if(i===0)c.moveTo(Math.cos(a)*29,Math.sin(a)*29);
     else c.lineTo(Math.cos(a)*29,Math.sin(a)*29);
    }
    c.closePath();c.fill();c.stroke();
    c.fillStyle='#b4fff6';c.fillRect(-15,-5,30,10);
   }
   paintMissionImpact(this,c,'metal',0,0,op.fieldHullHitAt,104,.43);
   c.strokeStyle='#1a3945';c.lineWidth=4;c.beginPath();c.moveTo(-42,67);c.lineTo(42,67);c.stroke();
   c.strokeStyle=hp<.35?'#ff9c88':'#82e8bb';c.beginPath();
   c.moveTo(-42,67);c.lineTo(-42+84*hp,67);c.stroke();
   c.textAlign='center';c.font='bold 11px system-ui';c.fillStyle='#bcfff3';
   c.fillText('БОЕВОЙ РЕТРАНСЛЯТОР',0,-77,210);
   c.fillStyle=online?'#a2f8bc':hp<.35?'#ffac98':'#ffe8b7';
   c.fillText(phase,0,-61,250);
   if(!online&&op.prepProgress>0&&!op.prepared&&op.prepTarget==='relay'){
    c.strokeStyle='#ffcf93';c.lineWidth=4;
    c.beginPath();c.arc(0,0,65,-Math.PI/2,
     -Math.PI/2+TAU*op.prepProgress/RELAY_DEFENSE.prepHold);c.stroke();
   }
   if(online){
    const age=this.time-op.onlineAt;
    c.strokeStyle='#a1ffc0';c.lineWidth=2;
    for(let i=0;i<3;i++){
     const radius=16+i*8+(this.visuals.reducedMotion?0:pulse*3);
     c.globalAlpha=age<4?.8:.5;
     c.beginPath();c.arc(0,-25,radius,-2.2,-.94);c.stroke();
    }
   }else if(op.phase==='warning'||op.phase==='intermission'){
    const incoming=relayIncomingTargets(op);
    if(incoming.relay){c.strokeStyle='#ffb877';c.lineWidth=3;c.setLineDash([9,8]);
     c.beginPath();c.arc(0,0,88,0,TAU);c.stroke();c.setLineDash([]);}
    for(const spec of relayWavePlan(op).filter(s=>s.target)){
     c.save();c.rotate(spec.angle);c.strokeStyle='#ffbf75';c.lineWidth=3;
     c.beginPath();c.moveTo(113,-8);c.lineTo(97,0);c.lineTo(113,8);c.stroke();c.restore();
    }
   }
   c.restore();
  }
  const a=op.antenna;
  if(a&&!outsideCamera(a.x,a.y,cam,75)){
   c.save();c.translate(a.x,a.y);c.strokeStyle=a.hp>0?'#a9dffd':'#bf8179';c.lineWidth=2;
   if(a.fieldShield>0){c.strokeStyle='#8bf3e3';c.lineWidth=3;
    c.beginPath();c.arc(0,0,44,0,TAU*a.fieldShield/RELAY_DEFENSE.prepShield);c.stroke();}
   if(!online&&['warning','intermission'].includes(op.phase)&&relayIncomingTargets(op).antenna){
    c.strokeStyle='#ffb877';c.lineWidth=2.5;c.setLineDash([8,6]);
    c.beginPath();c.arc(0,0,57,0,TAU);c.stroke();c.setLineDash([]);
   }
   if(!online&&op.prepProgress>0&&!op.prepared&&op.prepTarget==='antenna'){
    c.strokeStyle='#ffcf93';c.lineWidth=4;c.beginPath();c.arc(0,0,48,-Math.PI/2,
     -Math.PI/2+TAU*op.prepProgress/RELAY_DEFENSE.prepHold);c.stroke();
   }
   c.strokeStyle=a.hp>0?'#a9dffd':'#bf8179';
   if(!paintMissionCell(c,this.images?.missionHardware,a.hp>0?2:3,0,0,67,67)){
    c.fillStyle='#122936';c.beginPath();c.arc(0,0,16,0,TAU);c.fill();c.stroke();
    c.beginPath();c.arc(0,-8,11,-2.45,-.69);c.stroke();
    c.beginPath();c.moveTo(0,-17);c.lineTo(0,9);c.stroke();
   }
   paintMissionImpact(this,c,'metal',0,0,a.fieldHullHitAt,90,.4);
   c.textAlign='center';c.font='bold 10px system-ui';c.fillStyle=c.strokeStyle;
   c.fillText('РЕЗЕРВНАЯ АНТЕННА',0,32,125);
   c.fillText(a.hp>0?Math.ceil(a.hp/a.maxHp*100)+'%':'ПОТЕРЯНА',0,45,125);
   c.restore();
  }
 }
 drawMissionStrikeWarning(c,cam,e,target){
  if(!target||e.hp<=0||e.converted)return;
  const charging=e.relayChargeUntil>this.time;
  if(!e.missionStrike&&!charging)return;
  const visible=!outsideCamera(e.x,e.y,cam,58);
  if(!visible&&(!charging||outsideCamera(target.x,target.y,cam,60)))return;
  c.save();c.strokeStyle='#ffb078c0';c.lineWidth=2;
  if(charging){
   c.setLineDash([8,7]);c.beginPath();c.moveTo(e.x,e.y);c.lineTo(target.x,target.y);c.stroke();
   c.setLineDash([]);
  }
  if(visible){
   c.beginPath();c.arc(e.x,e.y,e.r+8,0,TAU);c.stroke();
   c.font='bold 10px system-ui';c.fillStyle='#ffcca4';c.textAlign='center';
   c.fillText(charging?'ЗАЛП ЧЕРЕЗ '+(e.relayChargeUntil-this.time).toFixed(1)+' С':
    e.missionStrike?.target==='field-node'?'ЦЕЛИТСЯ В УЗЕЛ':
    e.missionStrike?.target==='field-convoy'?'АТАКУЕТ КОНВОЙ':
    e.missionStrike?.target==='probe'?'ГЛУШИТ РЕМОНТ':e.missionStrike?.target==='antenna'?'ЦЕЛИТСЯ В АНТЕННУ':'АТАКУЕТ ПЕРЕДАТЧИК',e.x,e.y-e.r-16,154);
  }
  c.restore();
 }
 drawCorridorBeacon(c,cam){
  const home=this.world.home,op=this.operation;
  const returning=op?.id===CORRIDOR_OPERATION.id&&op.phase==='return';
  const active=op?.id===CORRIDOR_OPERATION.id&&op.hp>0&&!returning,secured=!!home.corridorSecured;
  if(!active&&!secured&&!returning)return;
  const site=active?op:corridorPosition(home);
  if(secured){
   // A quiet, persistent change in the environment after the mission.
   c.save();c.lineWidth=2.5;c.strokeStyle='#66d6ae55';c.setLineDash([19,12]);
   c.beginPath();c.moveTo(home.x,home.y);c.lineTo(site.x,site.y);c.stroke();
   c.restore();
  }
  if(outsideCamera(site.x,site.y,cam,90))return;
  const pulse=.5+.5*Math.sin(this.time*3.6);
  c.save();c.translate(site.x,site.y);
  if(active){
   // The focusing perimeter is faint and only appears as the ship approaches.
   if(dist(this.player,site)<510){
    c.save();c.strokeStyle='#d6a0ff25';c.lineWidth=2;c.setLineDash([8,15]);
    c.beginPath();c.arc(0,0,automaticRange(this),0,TAU);c.stroke();
    c.setLineDash([]);c.lineWidth=1.6;c.strokeStyle='#d699cf70';
    c.beginPath();c.arc(0,0,CORRIDOR_OPERATION.pulseRange,0,TAU);c.stroke();
    const charge=(op.pulseCharge||0)/CORRIDOR_OPERATION.pulsePeriod;
    if(this.time<(op.overheatedUntil||0)){
     c.strokeStyle='#81f0c0a8';c.lineWidth=3.5;
     c.beginPath();c.arc(0,0,CORRIDOR_OPERATION.pulseRange,0,TAU);c.stroke();
    }else if(charge>.01){
     c.strokeStyle=charge>.73?'#ffd499de':'#f1abffaf';c.lineWidth=4;
     c.beginPath();c.arc(0,0,CORRIDOR_OPERATION.pulseRange,-Math.PI/2,-Math.PI/2+TAU*charge);c.stroke();
    }
    c.restore();
   }
   c.shadowColor='#b455e7';c.shadowBlur=this.fps<34?4:15;
   c.fillStyle='#181b38';c.strokeStyle='#bc74ed';c.lineWidth=3;
  }else{
   c.fillStyle='#142530';c.strokeStyle='#4a897f';c.lineWidth=2;
  }
  if(!paintMissionCell(c,this.images?.missionSpecial,active?0:1,0,0,108,108)){
   c.beginPath();
   for(let i=0;i<6;i++){const a=-Math.PI/2+i*TAU/6;
    const x=Math.cos(a)*40,y=Math.sin(a)*40;
    if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
   }
   c.closePath();c.fill();c.stroke();
   c.save();c.rotate(active?this.time*.45:.18);
   for(let i=0;i<3;i++){
    const a=i*TAU/3;
    c.save();c.rotate(a);c.fillStyle=active?'#472357':'#29434a';
    c.fillRect(-8,-52,16,29);
    c.strokeStyle=active?'#de82f6':'#668e84';c.lineWidth=2;
    c.strokeRect(-8,-52,16,29);c.restore();
   }
   c.restore();
   c.beginPath();c.arc(0,0,active?15+pulse*3:13,0,TAU);
   c.fillStyle=active?'#d680ff':'#546c71';c.fill();
  }
  c.shadowBlur=0;
  paintMissionImpact(this,c,'emp',0,0,(op?.pulseFlashUntil??-Infinity)-.55,
   155,.55);
  if(active){
   c.strokeStyle='#f3c5ff';c.lineWidth=2;c.beginPath();
   c.arc(0,0,29,-Math.PI/2,-Math.PI/2+TAU*op.hp/op.maxHp);c.stroke();
   c.font='bold 11px system-ui';c.textAlign='center';
   c.fillStyle='#f8d7ff';c.fillText('ГЛУШИТЕЛЬ',0,-68);
   const distanceToJammer=dist(this.player,op);
   const cue=corridorCue(op,this.time,distanceToJammer,automaticRange(this));
   if(cue){
    // One small solid backing keeps the mission status readable over bright asteroids.
    // The same phase appears in the cockpit when the target leaves the screen.
    c.save();c.shadowBlur=0;
    c.fillStyle='#081a2be8';c.strokeStyle=cue.color;c.lineWidth=1.2;
    c.fillRect(-160,-127,320,47);
    c.strokeRect(-160,-127,320,47);
    c.textAlign='center';c.fillStyle=cue.color;c.font='bold 11px system-ui';
    c.fillText('БОРТОВОЙ ИИ · '+cue.label,0,-107,302);
    c.fillStyle='#e1eef4';c.font='10px system-ui';
    c.fillText(cue.hint,0,-90,300);
    c.restore();
   }
   c.fillStyle='#e3b9f4';c.font='10px system-ui';
   const attackDistanceOk=distanceToJammer<=automaticRange(this);
   c.fillText(Math.ceil(op.hp/op.maxHp*100)+'% · '+
    (attackDistanceOk?'В ДАЛЬНОСТИ АВТООРУДИЙ':'СБЛИЗЬТЕСЬ ДЛЯ АТАКИ'),0,-54);
  }else{
   c.fillStyle='#9adac8';c.font='bold 10px system-ui';c.textAlign='center';
   c.fillText(returning?'ПЕРЕДАТЧИК ОТКЛЮЧЁН':'СИГНАЛ ВОССТАНОВЛЕН',0,-57);
  }
  c.restore();
 }

 drawProbe(c,cam){
  const op=this.operation;
  if(op?.id!==PROBE_OPERATION.id||op.phase==='return'||op.located===false)return;
  const striker=op.strikerSerial&&this.enemies.find(e=>e.serial===op.strikerSerial);
  if(striker)this.drawMissionStrikeWarning(c,cam,striker,op);
  if(outsideCamera(op.x,op.y,cam,95))return;
  const pulse=.5+.5*Math.sin(this.time*3.1);
  c.save();c.translate(op.x,op.y);
  c.lineWidth=2;c.strokeStyle='#73d6edbd';c.fillStyle='#102b3c';
  if(!paintMissionMorph(c,this.images?.missionSpecial,2,3,0,0,112,112,
   Math.max(0,Math.min(1,(op.repair-12)/85)))){
   c.shadowColor='#66c9ed';c.shadowBlur=this.fps<34?4:14;
   c.beginPath();c.moveTo(-33,0);c.lineTo(-13,-20);c.lineTo(14,-20);
   c.lineTo(33,0);c.lineTo(14,20);c.lineTo(-13,20);c.closePath();c.fill();c.stroke();
   c.shadowBlur=0;
   c.strokeStyle='#bbf4ff';c.lineWidth=3;
   c.beginPath();c.arc(0,0,8+pulse*2,0,TAU);c.stroke();
  }
  paintMissionImpact(this,c,'repair',0,0,op.repairMilestoneAt,94,.63);
  c.lineWidth=4;c.strokeStyle='#67e7dc';
  c.beginPath();c.arc(0,0,43,-Math.PI/2,-Math.PI/2+TAU*op.repair/100);c.stroke();
  c.textAlign='center';c.font='bold 12px system-ui';c.fillStyle='#dbfbff';
  c.fillText('АВАРИЙНЫЙ ЗОНД',0,-69);
  c.font='11px system-ui';c.fillStyle='#9fe7e7';
  c.fillText('РЕМОНТ '+Math.round(op.repair)+'% · КОРПУС '+Math.ceil((op.hp??PROBE_OPERATION.maxHp)/PROBE_OPERATION.maxHp*100)+'%',0,-52);
  c.restore();
  if(this.probeRepairing){
   c.save();c.strokeStyle='#81f7e0a9';c.lineWidth=4;c.setLineDash([11,7]);
   c.beginPath();c.moveTo(this.player.x,this.player.y);c.lineTo(op.x,op.y);c.stroke();
   c.restore();
  }
 }
 drawCorridorCourier(c,cam){
  const op=this.operation;
  if(op?.radio!=='calling')return;
  const scout=this.enemies.find(e=>e.serial===op.radioSerial);
  if(!scout||outsideCamera(scout.x,scout.y,cam,70))return;
  c.save();c.strokeStyle='#ffc273';c.fillStyle='#ffe1a4';c.lineWidth=2;
  c.beginPath();c.arc(scout.x,scout.y,27,0,TAU);c.stroke();
  c.font='bold 11px system-ui';c.textAlign='center';
  c.fillText('РАЗВЕДЧИК · '+Math.max(0,op.radioAt-this.time).toFixed(1)+' С',scout.x,scout.y-37,150);
  c.restore();
 }
 drawBase(b,readyBaseId=null){
  this.visuals.drawBase(this.ctx,b,this.time,this.player.x,this.player.y,
   this.network,this.cachedNetworkLinked.has(b.id));
  if(this.weaponProfile.ion&&this.fieldLoan?.charges>0){
   drawIonMark(this.ctx,b,this.time,60);
   for(const t of b.turrets||[])drawIonMark(this.ctx,t,this.time,22);
  }
  if(b.strategicRole){
   const c=this.ctx;c.save();c.font='bold 12px system-ui';c.textAlign='center';
   c.fillStyle=b.enemy?'#ffd2a1':'#b1f2d0';c.fillText(b.title,b.x,b.y-138);c.restore();
  }
  if(b.id!==readyBaseId)return;
  // The return cue never affects station behavior or mission rewards.
  const c=this.ctx,steady=this.visuals.reducedMotion;
  const wave=steady?0:.5+.5*Math.sin(this.time*2.5);
  c.save();c.translate(b.x,b.y);
  c.lineWidth=2.5;c.strokeStyle='rgba(255,205,103,'+(.55+wave*.36).toFixed(3)+')';
  c.beginPath();c.arc(0,0,122+wave*6,0,TAU);c.stroke();
  c.lineWidth=1.4;c.strokeStyle='rgba(255,230,154,.52)';
  c.beginPath();c.arc(0,0,136+wave*4,0,TAU);c.stroke();
  c.fillStyle='#ffe09c';c.textAlign='center';c.font='bold 13px system-ui';
  c.fillText('!',0,-145,30);
  c.font='bold 10px system-ui';
  c.fillText('НАГРАДА ГОТОВА',0,-161,160);
  c.restore();
 }
 render(){
  const c=this.ctx,p=this.player,cam=this.camera();
  if(this.mouseAim){
   const rect=this.canvas.getBoundingClientRect();
   if(rect.width&&rect.height)this.mouseAim.point={
    x:cam.x+(this.mouseAim.clientX-rect.left)/rect.width*cam.w,
    y:cam.y+(this.mouseAim.clientY-rect.top)/rect.height*cam.h};
  }
  c.setTransform(this.canvas.width/this.vw,0,0,this.canvas.height/this.vh,0,0);
  // Keep full-screen nebula in CSS compositor instead of resampling per Canvas frame.
  c.clearRect(0,0,this.vw,this.vh);
  this.visuals.drawAtmosphere(c,cam,this.time,this.fps);
  // Deterministic fixed stars: no allocations or scrolling canvas buffers.
  c.save();c.translate(-cam.x,-cam.y);
  drawRegionalWorld(this,c,cam);
  drawHowitzerAim(c,this.heavyCharge);
  const grid=260;
  for(let gy=Math.floor(cam.y/grid)-1;gy<=Math.ceil((cam.y+cam.h)/grid);gy++)
   for(let gx=Math.floor(cam.x/grid)-1;gx<=Math.ceil((cam.x+cam.w)/grid);gx++)
    for(let i=0;i<5;i++){
     const x=(gx+hash(gx*9+i,gy,this.seed))*grid;
     const y=(gy+hash(gx,gy*9+i,this.seed+7))*grid;
     c.fillStyle=i===0?'#9aafd0':'#526984';
     c.fillRect(x,y,i===0?2:1,i===0?2:1);
    }
  // Reactor hull and core share a world anchor; nearby gameplay is drawn above them.
  this.reactor.draw(c,cam,this.time,this.fps,this.visuals.reducedMotion);
  if(this.time-this.worldVisualLast>.35){
   this.worldVisualLast=this.time;
   const topology=this.world.networkTopology();
   this.cachedNetworkLinked=topology.linked;
   this.cachedWorldLinks=topology.links.filter(([a,b])=>
    Math.min(dist(a,p),dist(b,p))<2600);
   const mission=this.contract;
   const nextTrial=pendingContourTrials(this.world)[0];
   const trialRoute=nextTrial&&!this.operation&&!mission&&this.waypoint?.id===this.world.home?.id?
    {...nextTrial,label:'Испытание контура'}:null;
   this.cachedTarget=this.manualWaypoint||trialRoute||this.waypoint||operationDestination(this.operation,this.world)||(mission&&mission.progress>=mission.goal?
    this.world.stations.get(mission.baseId):null);
  }
  for(const [a,b] of this.cachedWorldLinks){
   c.lineWidth=2;c.strokeStyle='#59dbc180';c.setLineDash([14,8]);
   c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.setLineDash([]);
  }
  drawContourWorld(this,c,cam);
  this.heritage.vfx.render(c,'back',
   {worldX:cam.x,worldY:cam.y,width:cam.w,height:cam.h});
  this.visuals.drawDerelict(c,cam,this.time,this.fps);
  drawRegionalStorms(this,c,cam);
  if(!outsideCamera(ION_FIELD.x,ION_FIELD.y,cam,ION_FIELD.r+30))
   drawIonField(c,ION_FIELD,ionPhase(this.time),this.time,this.fps,this.visuals.reducedMotion);
  for(const rock of this.nearRocks||[]){
   if(!rock.alive||outsideCamera(rock.x,rock.y,cam,rock.r+10))continue;
   const ore=!!rock.rich;
   if(!this.visuals.drawRock(c,rock,this.images[ore?'rock':'rock2'],ore)){
    c.fillStyle='#8a7e72';c.beginPath();c.arc(rock.x,rock.y,rock.r,0,TAU);c.fill();
   }
   drawRockScars(c,rock);
   if(rock.rich&&this.geoScanUntil>this.time){
    // Static highlight to avoid flicker and costly animation.
    c.save();c.lineWidth=2;c.strokeStyle='#ffc56e';
    c.setLineDash([7,5]);c.beginPath();c.arc(rock.x,rock.y,rock.r+12,0,TAU);
    c.stroke();c.restore();
   }
  }
  drawEvolutionEnvironment(c,this,cam);
  if((!this.contourTrial||this.mining.active)&&this.mining.target?.alive && !outsideCamera(this.mining.target.x,this.mining.target.y,cam,50))
   drawExtraction(c,p,this.mining.target,this.time,this.skillRanks.extractor||0,this.mining.active);
  // A brief field pulse connects the intercepted emission with its source.
  const intercept=this.noiseAlert;
  if(intercept&&intercept.until>this.time&&!outsideCamera(intercept.x,intercept.y,cam,180)){
   const age=this.time-intercept.startedAt,fade=Math.max(0,1-age/2.8);
   c.save();c.lineWidth=1.8;c.setLineDash([7,8]);
   for(let ring=0;ring<2;ring++){
    const radius=26+Math.max(0,age-ring*.34)*85;
    c.strokeStyle='rgba(255,198,111,'+(fade*(ring? .28:.58)).toFixed(3)+')';
    c.beginPath();c.arc(intercept.x,intercept.y,radius,0,TAU);c.stroke();
   }
   c.restore();
  }
  const defenseZone=contractDefenseZone(this.contract,this.world);
  if(defenseZone&&!outsideCamera(defenseZone.station.x,defenseZone.station.y,cam,defenseZone.radius+30)){
   const base=defenseZone.station,r=defenseZone.radius;
   c.save();c.lineWidth=2;c.setLineDash([14,12]);c.strokeStyle='#78e4d68c';
   c.beginPath();c.arc(base.x,base.y,r,0,TAU);c.stroke();c.setLineDash([]);
   c.fillStyle='#b8fff0';c.font='bold 12px system-ui';c.textAlign='center';
   c.fillText('ЗОНА ЗАЩИТЫ · 650 М',base.x,base.y-r-13,190);
   c.restore();
  }
  const returnBase=this.operation?.id===CARRIER_INTERCEPTION.id&&this.operation.phase==='return'?
    this.world.stations.get(this.operation.baseId):
    this.operation?.id===CORRIDOR_OPERATION.id&&this.operation.phase==='return'?
   this.world.stations.get(this.operation.baseId):contractReturnStation(this.contract,this.world);
  for(const b of this.world.nearbyStations(p.x,p.y,Math.max(cam.w,cam.h)+350)){
   if(b.enemy&&!b.strategicRole&&!this.enemyBasesUnlocked())continue;
   if(!outsideCamera(b.x,b.y,cam,170)){
    this.drawBase(b,returnBase?.id);
    if(b.active&&!b.enemy)
     drawStationDefense(c,b,defenseLinked(b,{count:this.cachedNetworkLinked.size,
      linked:this.cachedNetworkLinked}),this.time,p,this.visuals.reducedMotion,this.enemies);
   }
  }
  this.drawInteractionFocus(c,cam);
  this.drawOpeningBeacon(c,cam);
  for(const d of this.drops){
   if(outsideCamera(d.x,d.y,cam,20))continue;
   if(d.type==='parasiteCore'){
    drawParasiteCore(c,d,this.time,this.fps);continue;
   }
   if(d.type==='fieldBoost'||d.type==='fieldRepair'){
    const color=d.type==='fieldRepair'?'#90ffc2':BOOSTS[d.value]?.color||'#ffe7a9';
    c.save();c.strokeStyle=color;c.fillStyle=color;c.lineWidth=2;
    const rotation=this.visuals.reducedMotion?0:this.time*1.4;
    c.translate(d.x,d.y);c.rotate(rotation);
    c.beginPath();c.moveTo(0,-12);c.lineTo(11,0);c.lineTo(0,12);c.lineTo(-11,0);c.closePath();c.stroke();
    c.globalAlpha=.65;c.beginPath();c.arc(0,0,4,0,TAU);c.fill();c.restore();continue;
   }
   if(d.hot){c.fillStyle='#ff96323d';c.beginPath();c.arc(d.x,d.y,12,0,TAU);c.fill();}
   c.fillStyle=d.type==='fieldCell'?'#d5a1f0':d.type==='ore'?(d.hot?'#ffd296':'#efbb70'):'#69e7ec';
   c.beginPath();c.arc(d.x,d.y,d.type==='fieldCell'?7:d.type==='ore'?6:4,0,TAU);c.fill();
   if(d.type==='fieldCell'){c.font='bold 10px system-ui';c.textAlign='center';c.fillStyle='#ffffff';c.fillText('+',d.x,d.y+3);c.fillText('ЗАРЯД',d.x,d.y-13);}
  }
  for(const z of this.zones){
   if(z.fuse>0){
    drawOrbitalWarning(c,z,this.time,this.visuals.reducedMotion);
   }else if(z.done&&z.ttl>0){
    if(!outsideCamera(z.x,z.y,cam,z.r*1.75))drawOrbitalAfterglow(c,z);
   }
  }
  this.drawCorridorBeacon(c,cam);
  this.drawCorridorCourier(c,cam);
  if(this.weaponProfile.ion&&this.fieldLoan?.charges>0&&this.operation?.id===CORRIDOR_OPERATION.id)drawIonMark(c,this.operation,this.time,30);
  this.drawCarrierRoute(c,cam);
  this.drawRelayDefense(c,cam);
  this.drawProbe(c,cam);
  drawFieldOperation(this,c,cam);
  this.heritage.vfx.beginSurfaceLights();
  const chosenTarget=activeDesignatedTarget(this);
  drawEvolutionConnections(c,this,cam);
  if(this.manualRailMode&&!this.isTouchLayout&&this.tacticalPointer&&this.overlay.hidden){
   const rect=this.canvas.getBoundingClientRect(),pointer=this.tacticalPointer;
   if(pointer.x>=rect.left&&pointer.x<=rect.right&&pointer.y>=rect.top&&pointer.y<=rect.bottom){
    const mx=cam.x+(pointer.x-rect.left)/Math.max(1,rect.width)*cam.w;
    const my=cam.y+(pointer.y-rect.top)/Math.max(1,rect.height)*cam.h;
    c.save();c.globalAlpha=.55;c.strokeStyle='#92dbe9';c.lineWidth=1.2;
    c.setLineDash([3,8]);c.beginPath();c.arc(mx,my,RAIL_AIM_ASSIST,0,TAU);c.stroke();
    c.setLineDash([]);c.restore();
   }
  }
  if(this.cruising){
   c.save();c.textAlign='center';c.font='bold 11px system-ui';c.fillStyle='#9afce5';
   c.fillText('МАРШЕВЫЙ ПЕРЕЛЁТ ×'+EXPEDITION_CRUISE.multiplier,p.x,p.y+56);c.restore();
  }
  if(chosenTarget&&!outsideCamera(chosenTarget.x,chosenTarget.y,cam,60)){
   const radius=(chosenTarget.r||24)+14;
   c.save();c.strokeStyle='#b7f9e0';c.lineWidth=1.8;
   c.setLineDash([7,5]);c.beginPath();
   c.arc(chosenTarget.x,chosenTarget.y,radius,0,TAU);c.stroke();
   c.setLineDash([]);c.textAlign='center';c.font='bold 10px system-ui';
   const parasiteAction=this.skillRanks.parasite&&this.skillRanks[parasiteTargetMode(this)]?
    ' · '+(this.fieldEvolution.charge>0?(parasiteTargetMode(this)==='capture'?'ЗАХВАТ':'РАЗВЕДКА'):'НЕТ ЯДРА'):'';
   c.fillStyle='#c9fff1';c.fillText('ПРИОРИТЕТ'+parasiteAction+' · '+Math.max(0,Math.ceil(this.designatedTarget.expiresAt-this.time))+' С',
    chosenTarget.x,chosenTarget.y-radius-12);
   c.restore();
  }
  // Heading previews belong to the tactical world, not to the cockpit HUD.
  drawEnemyIntentions(c,cam,this,this.visuals.reducedMotion,this.fps);
  drawMoteSwarms(c,this.enemies,cam,this.time,this.visuals.reducedMotion,this.moteFormationFx);
  const signaledGroups=new Set();
  for(const e of this.enemies){
   if(outsideCamera(e.x,e.y,cam,e.r+30))continue;
   if(e.microSwarm)continue;
   if(e.interceptCargo){this.drawCarrierCargo(c,e);continue;}
   if(e.converted){
    c.strokeStyle='#77ffcb';c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,e.r+8,0,TAU);c.stroke();
   }else if(e.type==='healer'){
    c.strokeStyle='#8be5a7';c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,e.r+7,0,TAU);c.stroke();
   }else if(e.state==='charge'||e.state==='windup'){
    const preparing=e.state==='windup';
    c.strokeStyle=preparing?'#ffc070':'#ff7552';c.lineWidth=preparing?2.5:3;
    c.beginPath();c.arc(e.x,e.y,e.r+(preparing?8+3*Math.sin(this.time*19):9),0,TAU);c.stroke();
   }
   if(e.openingCommander&&openingArcActive(this.openingArc)&&
      this.openingArc.commanderSerial===e.serial){
    c.save();c.strokeStyle='#ffd08f';c.lineWidth=3;
    c.setLineDash([9,5]);c.beginPath();c.arc(e.x,e.y,e.r+19,0,TAU);c.stroke();
    c.setLineDash([]);c.fillStyle='#ffe2a9';c.font='bold 11px system-ui';
    c.textAlign='center';c.fillText('НАВОДЧИК',e.x,e.y-e.r-34);c.restore();
   }
   const spriteKey=e.type;
   drawContourIrisCharge(c,e,this.time,this.visuals.reducedMotion);
   if(!this.visuals.drawEnemy(c,e,this.time)&&
      !this.drawSprite(this.images[spriteKey],e.x,e.y,e.r*3,e.r*3,e.angle)){
    c.fillStyle=e.converted?'#6fe7ba':'#f07887';c.beginPath();c.arc(e.x,e.y,e.r,0,TAU);c.fill();
   }
   this.heritage.vfx.renderSurfaceLight(c,e.x,e.y,e.r);
   drawStormCharge(c,e,this.time);
   if(e.frontierRole){
    const specialist=e.stormAdapted?'ЭНЕРГО':e.type==='healer'?'РЕМОНТ':'ОХРАНА';
    c.save();c.strokeStyle=e.frontierRole==='azure'?'#8de4ff':'#94e8b7';
    c.lineWidth=2;c.setLineDash([5,4]);c.beginPath();c.arc(e.x,e.y,e.r+12,0,TAU);c.stroke();
    c.setLineDash([]);c.font='bold 10px system-ui';c.fillStyle=c.strokeStyle;c.textAlign='center';
    c.fillText(specialist,e.x,e.y-e.r-21);c.restore();
   }
   if(this.time<(e.stasisUntil||0)){
    c.save();c.strokeStyle='#d5a6ff';c.lineWidth=2.5;
    c.beginPath();c.arc(e.x,e.y,e.r+10,0,TAU);c.stroke();
    if(this.time<(e.stasisLabelUntil||0)){
     c.fillStyle='#f4d8ff';c.textAlign='center';c.font='bold 10px system-ui';
     c.fillText('СТАЗИС',e.x,e.y-e.r-16,90);
    }
    c.restore();
   }
   if((e._tacticalSpeed||1)<1||this.time<(e._tacticalDecoyUntil||0)){
    const distracted=this.time<(e._tacticalDecoyUntil||0);
    c.save();c.strokeStyle=distracted?'#ffd38c':'#8fe5f8';c.lineWidth=1.8;
    c.globalAlpha=.75;c.beginPath();c.arc(e.x,e.y,e.r+7,0,TAU);c.stroke();
    if(distracted){
     c.fillStyle='#ffd38c';c.textAlign='center';c.font='bold 9px system-ui';
     c.fillText('ЛОЖНЫЙ СИГНАЛ',e.x,e.y-e.r-17,100);
    }
    c.restore();
   }
   if(this.weaponProfile.ion&&this.fieldLoan?.charges>0)drawIonMark(c,e,this.time);
   // The painted rupture supersedes the old circular damage decal.
   if(!e.capitalWearPainted)
    drawHullDamage(c,e,this.time,this.fps,this.visuals.reducedMotion);
   const intel=e.signalIntel;
   if(intel&&!e.converted&&!signaledGroups.has(intel)){
    signaledGroups.add(intel);
    const engaged=intel.mode==='engaged',leaving=intel.mode==='withdraw';
    if((!leaving||this.time<intel.cueUntil)&&
       (!engaged||this.time<intel.cueUntil)){
     const tint=engaged?'#ff7474':leaving?'#8ed8ea':'#ffd08a';
     const glyph=engaged?'!':leaving?'↗':'?';
     c.save();c.translate(e.x,e.y-e.r-26);
     c.fillStyle='rgba(7,15,30,.89)';c.strokeStyle=tint;c.lineWidth=1.6;
     c.beginPath();c.arc(0,0,9.5,0,TAU);c.fill();c.stroke();
     c.fillStyle=tint;c.textAlign='center';c.textBaseline='middle';
     c.font='bold 13px system-ui';c.fillText(glyph,0,.5);c.restore();
    }
   }
   if(e.encounterLabel&&!e.converted){
    if(e.encounterLabelStart===undefined)e.encounterLabelStart=this.time;
    if(this.time-e.encounterLabelStart<2.3){
     c.save();c.textAlign='center';c.font='bold 11px system-ui';
     c.shadowColor='#170d22';c.shadowBlur=5;c.fillStyle='#ffd4aa';
     c.fillText(e.encounterLabel,e.x,e.y-e.r-28);c.restore();
    }
   }
   if(e.hit>0){c.fillStyle='#fff9';c.beginPath();c.arc(e.x,e.y,e.r*.65,0,TAU);c.fill();}
   if(e.hp<e.maxHp*.65&&!e.converted){
    c.fillStyle='#542836';c.fillRect(e.x-15,e.y-e.r-14,30,3);
    c.fillStyle='#e77e7e';c.fillRect(e.x-15,e.y-e.r-14,30*clamp(e.hp/e.maxHp,0,1),3);
   }
   if(e.healFlash>0){c.fillStyle='#b4ffbd';c.font='bold 12px system-ui';c.fillText('+',e.x+20,e.y-18);}
   drawEvolutionEnemy(c,e,this.time,this.fps,this.visuals.reducedMotion);
  }
  for(const a of this.allies){
   if(outsideCamera(a.x,a.y,cam,50))continue;
   const image=this.images[a.role==='fighter'?'allyfighter':'allyscout'];
   this.visuals.drawAlly(c,a,this.time,image);
   this.heritage.vfx.renderSurfaceLight(c,a.x,a.y,a.r);
   drawHullDamage(c,a,this.time,this.fps,this.visuals.reducedMotion);
   if(a.messageUntil>this.time){
    c.font='11px system-ui';c.textAlign='center';c.fillStyle='#9af8ff';
    c.fillText(a.message,a.x,a.y-a.r-19);
   }
  }
  for(const mission of this.support.missions){
   for(const craft of mission.craft){
    if(craft.hp<=0||outsideCamera(craft.x,craft.y,cam,45))continue;
    this.visuals.drawAlly(c,craft,this.time,this.images.allybomber);
    this.heritage.vfx.renderSurfaceLight(c,craft.x,craft.y,craft.r);
    drawHullDamage(c,craft,this.time,this.fps,this.visuals.reducedMotion);
    c.save();c.fillStyle='#ffe1a4';c.textAlign='center';c.font='bold 10px system-ui';
    c.fillText('АВИАГРУППА',craft.x,craft.y-34);c.restore();
   }
  }
  drawFieldEffects(c,this);
  drawTacticalVfx(c,this,cam);
  drawTactical(c,this);
  drawEnemyGunWarnings(c,this,cam,this.fps);
  drawEnemyDefenseGoals(c,this,cam,this.fps);
  // Actual radio-message receipts, drawn in world space behind ship sprites.
  this.enemyComms?.render(c,cam,this.time,this.visuals.reducedMotion,this.fps,this);
  // Brief local evidence: industrial outcomes and genuine searches for the
  // origin of incoming fire. Neither creates a target marker for hidden intel.
  drawWorldFeedback(c,cam,this,this.visuals.reducedMotion,this.fps);
  drawImpactInvestigation(c,cam,this);
  for(const m of this.missiles){
   if(outsideCamera(m.x,m.y,cam,80))continue;
   drawSeekingMissile(c,m,this.fps);
  }
  drawBallisticWeapons(c,this,this.fps,this.visuals.reducedMotion,cam);
  drawMouseArsenal(c,this);
  for(const s of this.shots){
   if(outsideCamera(s.x,s.y,cam,15))continue;
   if(this.fps>=28&&this.visuals.drawHostileShot(c,s))continue;
   const d=Math.hypot(s.vx,s.vy)||1,ux=s.vx/d,uy=s.vy/d;
   c.save();c.strokeStyle=s.kind==='iris'?'#c49aff':'#ff7186';
   c.lineWidth=s.kind==='iris'?3.2:4;c.lineCap='round';
   c.beginPath();c.moveTo(s.x-ux*12,s.y-uy*12);
   c.lineTo(s.x+ux*5,s.y+uy*5);c.stroke();c.restore();
  }
  if(!this.dead&&(p.invul<=0||Math.sin(this.time*35)>.1)){
   if(!this.visuals.drawPlayer(c,p,p.level,this.time)){
    c.fillStyle='#8cecff';c.beginPath();c.moveTo(p.x,p.y-25);c.lineTo(p.x-16,p.y+20);
    c.lineTo(p.x+16,p.y+20);c.fill();
   }
   this.heritage.vfx.renderSurfaceLight(c,p.x,p.y,22);
  }
  if(!this.dead&&p.shield>0){
   c.strokeStyle='#73dffc77';c.lineWidth=3;c.beginPath();c.arc(p.x,p.y,37,0,TAU);c.stroke();
  }
  drawEvolutionPlayer(c,this);
  if(!this.dead)drawFieldLootAura(c,this);
  for(const f of this.flashes)drawEnergyFlash(c,f,this.fps);
  drawWeaponFx(c,this.weaponFx,this.fps,this.visuals.reducedMotion,cam);
  this.heritage.vfx.render(c,'front',
   {worldX:cam.x,worldY:cam.y,width:cam.w,height:cam.h});
  c.restore();
  drawContourTrialHUD(c,this);
  // Directional station indicator is screen-fixed and never covers the ship.
  const activeOp=this.operation;
  const threat=activeOp?.id===RELAY_DEFENSE.id?relayAttacker(activeOp,this.enemies,this.time):
   activeOp&&this.enemies.find(e=>e.hp>0&&!e.converted&&(
    (activeOp.phase!=='return'&&activeOp.radio==='calling'&&e.serial===activeOp.radioSerial)||
    (e.probeAssault&&e.serial===activeOp.strikerSerial)));
  const target=this.manualWaypoint||threat||this.cachedTarget;
  if(target){
   const dx=target.x-p.x,dy=target.y-p.y,d=length(dx,dy);
   if(d>140){
    const a=Math.atan2(dy,dx),r=Math.min(this.vw,this.vh)*.36;
    const x=this.vw/2+Math.cos(a)*r,y=this.vh/2+Math.sin(a)*r;
    c.save();c.translate(x,y);c.rotate(a+Math.PI/2);
    c.fillStyle=target===threat?'#ffbf75':'#71f4e0';c.beginPath();c.moveTo(0,-12);c.lineTo(-8,7);
    c.lineTo(8,7);c.fill();c.restore();
    const cue=target===threat?(threat.corridorCourier?'Разведчик':threat.missionStrike?.target==='antenna'?
     'Атака на антенну':'Налётчик')+' · '+Math.round(d)+' м':openingWaypointCue(target,d);
    c.save();c.textAlign='center';
    if(cue){
     // A bare distance can look like the label of a station directly behind
     // the arrow. The first two assignments identify their target explicitly.
     c.font='bold 11px system-ui';
     const w=Math.min(204,Math.max(118,c.measureText(cue).width+18));
     const bx=clamp(x,w/2+8,this.vw-w/2-8),by=clamp(y+25,22,this.vh-16);
     c.fillStyle='#082235e8';c.fillRect(bx-w/2,by-14,w,24);
     c.strokeStyle='#edc487b0';c.lineWidth=1;c.strokeRect(bx-w/2,by-14,w,24);
     c.fillStyle='#ffdfab';c.fillText(cue,bx,by+2,w-12);
    }else{
     c.font='12px system-ui';c.fillStyle='#b4edec';
     c.fillText(Math.round(d)+' м',x,y+25);
    }
    c.restore();
   }
  }
 }
 hud(){
  advanceWorldFeedback(this);
  this.cockpit.update(this,expForNext(this.player.level),burstStats(this.skillRanks.engine).cooldown);
  this.syncControlUI();
  const panel=$('evolutionPrompt');
  if(panel){
   const captureWait=Math.max(0,Math.ceil((this.fieldEvolution?.captureReadyAt||0)-this.time));
   const key=this.fieldEvolution?.pending+'|'+this.fieldEvolution?.offers.join('|')+'|'+this.player.points+'|'+this.fieldEvolution?.charge+'|'+this.fieldEvolution?.targetMode+'|'+captureWait+'|'+installedEvolution(this.skillRanks,SKILLS.filter(s=>!SHIP_UPGRADES.has(s.id))).length+'|'+this.dead;
   if(panel.dataset.state!==key){panel.dataset.state=key;this.syncEvolutionPrompt();}
  }
 }
 loop(now){
  const frameMs=clamp(now-this.last,0,220);this.last=now;
  if(frameMs>0){this.frameSamples.push(frameMs);if(this.frameSamples.length>100)this.frameSamples.shift();
   this.fps=this.fps*.92+(.08*1000/Math.max(1,frameMs));}
  if(!this.paused&&!this.dead&&frameMs>0){
   this.qualityTimer+=frameMs;
   if(this.qualityTimer>5000){
    if(this.fps<34&&this.renderScale>.72){this.renderScale=.72;this.resize();}
    else if(this.fps>55&&this.renderScale<1){this.renderScale=1;this.resize();}
    this.heritage.setBudget(this.fps);
    this.qualityTimer=0;
   }
  }
  if(!this.paused&&!this.dead&&frameMs>0){
   // Never skip simulation solely because the rendering device is slow.
   // Bound catch-up work and subdivide large steps to keep collisions stable.
   const simMs=Math.min(frameMs,130);
   const n=Math.min(4,Math.max(1,Math.ceil(simMs/35)));
   const dt=simMs/1000/n;
   for(let i=0;i<n&&!this.paused;i++)this.update(dt);
  }
  // A fatal explosion needs its own short presentation clock. Gameplay stays
  // stopped; the damage, loot and enemy simulation never advance after death.
  if(this.dead&&now<this.deathSceneEnd){
   this.heritage.vfx.update(Math.min(.05,(now-this.deathVfxAt)/1000));
   this.deathVfxAt=now;
   this.render();this.pausedRenderPending=false;
  }else{
   if(this.dead&&this.overlay.hidden){
    this.overlay.hidden=false;this.pausedRenderPending=true;
    this.presentMenu(this.pendingCheckpoint?'[data-act="runContinue"]':'[data-act="restart"]');
   }
   // Other paused dialogs need one static backdrop, not a permanent redraw.
   if((!this.paused&&!this.dead)||this.pausedRenderPending){
    this.render();this.pausedRenderPending=false;
   }
  }
  if(!this.paused&&now-this.lastHud>180){this.lastHud=now;this.hud();}
  requestAnimationFrame(this.loop);
 }
}
new ArcadeGame();
