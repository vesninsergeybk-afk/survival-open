import {migrateLegacyPlayerExperience} from './experience.js?v=early-experience-1';
import {rebaseSavedHull} from './balance.js';
import {inheritStrategicExperience,validStrategicExperience} from './strategic-experience.js?v=strategic-xp-pass2-1-sector-density-2';
import {createRegionalSupply,regionalSupplyValid} from './regional-supply.js?v=living-world-3-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-repair-qa-1-enemy-economy-1-enemy-balance-2-supply-stronghold-1-territory-war-1';
import {World} from './world.js?v=living-world-3-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-repair-qa-1-enemy-domains-1-supply-stronghold-1-territory-war-1-living-world-population-1-sector-density-2-pressure-response-1-frontier-siege-1-rescue-depth-1';
import {quoteLoadout,FRAME_STEPS} from './ship-loadout.js?v=first-contract-reward-1-campaign-1-menu-focus-1-pressure-response-1';
import {FIELD_WEAPONS,missionAssignment} from './field-weapons.js?v=living-world-2-campaign-1';
import {createTactical,validTactical} from './tactical-fields.js?v=tactical-field-2';
import {validFieldEvolution} from './field-evolution.js?v=parasite-clarity-1';
import {validFieldLoot,createFieldLoot} from './field-loot.js?v=eye-loot-1';
import {validCombatTempo,createCombatTempo} from './combat-tempo.js?v=tempo-1';
import {validFortification} from './enemy-fortifications.js?v=industrial-forts-1';
import {validSortieReports} from './sortie-economy.js?v=economy-integrity-1-campaign-1-sector-density-2';
import {validEconomyExpenses} from './sortie-ledger.js?v=economy-ledger-1';
import {createOpeningArc,validateOpeningArc} from './opening-arc.js?v=opening-arc-5-rescue-depth-1';
import {stationRaidValid} from './strategic-command.js?v=campaign-1-repair-qa-1-world-feedback-1-flux-offense-1-territory-war-1';
import {createContours,validContours,autoConnectContours} from './territory-system.js?v=automatic-contours-1-contour-trials-1-support-three-1-triangle-defense-1-territory-logistics-1-flux-siphon-roads-1';
import {validFluxArtillery} from './flux-artillery.js?v=turret-preload-20261109-1-audit-1-frontier-siege-1-territory-logistics-1-corecharge-20261110';
import {validFluxSupports} from './flux-supports.js?v=turret-preload-20261109-1-audit-1-frontier-siege-1-territory-logistics-1-corecharge-20261110';
import {validFluxDepots} from './flux-depots.js?v=territory-logistics-1-flux-siphon-roads-1';
import {validFluxEconomy} from './territory-economy.js?v=territory-logistics-1-flux-siphon-roads-1';
import {validFluxRoutes} from './flux-routes.js?v=flux-siphon-roads-1';
import {ensureTrialLedger} from './contour-trials.js?v=swarm-siege-1-pressure-response-1-corecharge-20261110';
import {clearCoreRocks} from './core-rock-clearance.js';
import {createEnemyExpansion,validEnemyExpansion} from './enemy-expansion.js?v=enemy-expansion-1-enemy-balance-2-living-world-population-1-sector-density-2';
import {validStationId} from './station-ids.js?v=living-world-checkpoint-1-living-world-population-1-sector-density-2';
import {expandSavedPopulation,ensurePopulationStations,seedPopulationTerritory,validPopulation} from './world-population.js?v=sector-density-2-frontier-siege-1';
import {compressCheckpoint,decompressCheckpoint} from './checkpoint-compression.js?v=sector-density-2';
import {validFieldOperation,FIELD_OPERATIONS} from './field-operations.js?v=field-operations-1-audit-1-field-experience-1-mission-depth-1-mission-integrity-2-mission-choices-1';

export const RUN_KEYS=['survivor.run.v1.a','survivor.run.v1.b'];
export const MAX_CHECKPOINT_LENGTH=850000;
const FORBIDDEN=new Set(['__proto__','prototype','constructor']);
// Radio cells contain runtime Maps and are rebuilt from the restored ships.
// Keep serialization strict for every other field; never dismantle the live mesh.
const DERIVED=new Set(['capitalPaintCache','_commsCell']);
const FIELDS=('player skillRanks shipLoadout firstHardwareReward weaponThermal moduleClocks heavyCharge heavyCooldown '+
 'doctrine lastDamageAt network enemies allies drops shots missiles flashes support zones time '+
 'spawnClock miningNoise lastNoiseSource noiseAlert miningNoiseWarned miningIntroShown coverWearWarned '+
 'contract operation geoScanUntil overchargeUntil fieldLoan fieldTrialTaken fieldReturnAt ionMasteryAwarded '+
 'holdFire beamClock rocketClock zoneClock stationary lastX lastY hacks activeBases enemySerial '+
 'allySerial groupSerial heavyPortalShown lastEncounter lastEncounterLabelAt amberBeltSeen ionFieldSeen '+
 'waypoint manualWaypoint lastIonAudioCycle fieldEffects tactical sortieReports economyExpenses openingArc fieldEvolution fieldLoot combatTempo').split(' ');
const finite=(v,min=-1e9,max=1e9)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const validFieldCounters=counts=>counts===undefined||object(counts)&&
 Object.entries(counts).length<=Object.keys(FIELD_OPERATIONS).length&&
 Object.entries(counts).every(([id,count])=>Object.hasOwn(FIELD_OPERATIONS,id)&&
  Number.isInteger(count)&&count>=0&&count<=100000);
const validFieldHistory=history=>history===undefined||Array.isArray(history)&&
 history.length<=8&&history.every(entry=>object(entry)&&
  Object.hasOwn(FIELD_OPERATIONS,entry.id)&&typeof entry.full==='boolean'&&
  (entry.seconds===null||Number.isInteger(entry.seconds)&&entry.seconds>=0&&entry.seconds<=1e7)&&
  Number.isInteger(entry.tier)&&entry.tier>=0&&entry.tier<=3&&
  (entry.convoyHp===null||Number.isInteger(entry.convoyHp)&&entry.convoyHp>=0&&entry.convoyHp<=100));
const cell=validStationId;
const hash=text=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(16);};

// Runtime targets, operation/cargo objects and station missions share references.
// A small data-only graph keeps that identity; images, DOM and class instances
// cannot enter a save. Decoding never evaluates source or restores prototypes.
export function packRun(root){
 const nodes=[],seen=new Map(),queue=[];
 const atom=value=>{
  if(value===null||typeof value==='boolean'||typeof value==='string')return value;
  if(typeof value==='number'){
   if(Number.isNaN(value))throw new Error('invalid-number');
   return Number.isFinite(value)?value:{number:value>0?'infinity':'-infinity'};
  }
  if(!value||typeof value!=='object')throw new Error('non-data');
  const proto=Object.getPrototypeOf(value);
  if(!Array.isArray(value)&&proto!==Object.prototype&&proto!==null)throw new Error('non-data');
  if(seen.has(value))return {ref:seen.get(value)};
  if(nodes.length>=40000)throw new Error('too-large');
  const id=nodes.length;seen.set(value,id);nodes.push(null);queue.push([id,value]);return {ref:id};
 };
 const entry=atom(root);
 for(let i=0;i<queue.length;i++){
  const [id,value]=queue[i];
  if(Array.isArray(value))nodes[id]=['array',value.map(v=>atom(v===undefined?null:v))];
  else nodes[id]=['object',Object.entries(value).filter(([k,v])=>v!==undefined&&!DERIVED.has(k)).map(([k,v])=>{
   if(FORBIDDEN.has(k))throw new Error('unsafe-key');return [k,atom(v)];
  })];
 }
 const text=JSON.stringify({entry,nodes});
 const body=text.length>320000?compressCheckpoint(text):text;
 if(body.length>MAX_CHECKPOINT_LENGTH)throw new Error('too-large');
 return body;
}
export function unpackRun(text){
 if(typeof text!=='string'||text.length>MAX_CHECKPOINT_LENGTH)throw new Error('too-large');
 const graph=JSON.parse(decompressCheckpoint(text));
 if(!object(graph)||!Array.isArray(graph.nodes)||graph.nodes.length>40000)throw new Error('bad-graph');
 const values=graph.nodes.map(n=>{
  if(!Array.isArray(n)||n.length!==2||!['array','object'].includes(n[0])||!Array.isArray(n[1]))throw new Error('bad-node');
  return n[0]==='array'?[]:{};
 });
 const atom=v=>{
  if(v===null||['string','boolean','number'].includes(typeof v))return v;
  if(!object(v)||Object.keys(v).length!==1)throw new Error('bad-atom');
  if(Number.isInteger(v.ref)&&v.ref>=0&&v.ref<values.length)return values[v.ref];
  if(v.number==='infinity')return Infinity;
  if(v.number==='-infinity')return -Infinity;
  throw new Error('bad-reference');
 };
 graph.nodes.forEach((n,i)=>{
  if(n[0]==='array')for(const v of n[1])values[i].push(atom(v));
  else for(const pair of n[1]){
   if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||
    FORBIDDEN.has(pair[0])||Object.hasOwn(values[i],pair[0]))throw new Error('bad-key');
   values[i][pair[0]]=atom(pair[1]);
  }
 });
 return atom(graph.entry);
}

export function captureCheckpoint(game,base){
 if(game.dead||!game.paused||!base||base.enemy||base.ruined||base.hp<=0)
  throw new Error('not-docked');
 const state={};for(const name of FIELDS)if(game[name]!==undefined)state[name]=game[name];
 const rocks=[];
 for(const [key,list] of game.world.rocks){
  const changed=list.filter(r=>r.originKind==='event'||!r.alive||r.hp<r.maxHp||
   Math.abs(r.x-r.originX)>.01||Math.abs(r.y-r.originY)>.01||Math.abs(r.vx)+Math.abs(r.vy)>.01);
  if(changed.length)rocks.push([key,changed]);
 }
 return {version:2,seed:game.seed,baseId:base.id,state,world:{
  regionalSupply:game.world.regionalSupply,contours:game.world.contours,
  enemyExpansion:game.world.enemyExpansion,
  population:game.world.population,
  stations:[...game.world.stations],rocks,discovered:[...game.world.discovered]}};
}
export function migrateCheckpoint(data){
 if(data?.version!==1)return data;
 const old=data.state,s={...old};
 s.fieldLoan=old.fieldLoan||old.ionLoan||null;
 if(s.fieldLoan){
  s.fieldLoan={...s.fieldLoan,moduleId:s.fieldLoan.moduleId||'ion'};
  s.fieldLoan.assignment=s.fieldLoan.assignment||
   (s.fieldLoan.missionStarted?missionAssignment(s.operation,s.contract):null);
  s.fieldLoan.returnDue=!!s.fieldLoan.missionStarted&&!s.fieldLoan.assignment;
 }
 s.fieldTrialTaken=old.fieldTrialTaken??old.ionTrialTaken??false;
 s.fieldReturnAt=old.fieldReturnAt??old.ionReturnAt??-Infinity;s.fieldEffects=[];
 delete s.ionLoan;delete s.ionTrialTaken;delete s.ionReturnAt;
 return {...data,version:2,state:s};
}
export function validateCheckpoint(data){
 if(!object(data)||data.version!==2||!Number.isInteger(data.seed)||!cell(data.baseId)||
  !object(data.state)||!object(data.world))return false;
 const s=data.state,p=s.player,w=data.world;
 if(w.regionalSupply!==undefined&&!regionalSupplyValid(w.regionalSupply,s.time))return false;
 if(!object(p)||!finite(p.x)||!finite(p.y)||!finite(p.hp,.001,100000)||
  !finite(p.maxHp,p.hp,100000)||!Number.isInteger(p.level)||p.level<1||p.level>1000||
  !['xp','ore','data','points'].every(k=>finite(p[k],0,1e12))||!finite(s.time,0,1e9)||
  !object(s.skillRanks)||!object(s.network)||!object(s.support)||!object(s.shipLoadout)||
  !Number.isInteger(s.shipLoadout.frame)||!FRAME_STEPS[s.shipLoadout.frame])return false;
 if(Object.values(s.skillRanks).some(v=>!Number.isInteger(v)||v<0||v>10)||
  Object.keys(s).some(k=>!FIELDS.includes(k)))return false;
 if(s.manualWaypoint!=null&&(!object(s.manualWaypoint)||s.manualWaypoint.id!=='map:manual'||
  !finite(s.manualWaypoint.x)||!finite(s.manualWaypoint.y)))return false;
 if(s.sortieReports!==undefined&&!validSortieReports(s.sortieReports))return false;
 if(s.economyExpenses!==undefined&&!validEconomyExpenses(s.economyExpenses))return false;
 if(s.openingArc!==undefined&&!validateOpeningArc(s.openingArc))return false;
 if(s.tactical!==undefined&&!validTactical(s.tactical,s.time))return false;
 if(s.fieldEvolution!==undefined&&!validFieldEvolution(s.fieldEvolution,s.time))return false;
 if(!validFieldLoot(s.fieldLoot,s.time)||!validCombatTempo(s.combatTempo,s.time))return false;
 if(s.firstHardwareReward!==undefined&&s.firstHardwareReward!==null&&
  !['pending','rail','flak','plasma'].includes(s.firstHardwareReward))return false;
 if(['rail','flak','plasma'].includes(s.firstHardwareReward)&&
  !(s.shipLoadout.owned?.[s.firstHardwareReward]>0))return false;
 for(const k of ['enemies','allies','drops','shots','missiles','flashes','zones','hacks'])
  if(!Array.isArray(s[k])||s[k].length>2000)return false;
 if(s.enemies.length>512||s.allies.length>64||!Array.isArray(s.support.missions)||
  s.enemies.some(e=>!stationRaidValid(e.stationRaid,s.time)))return false;
 if([...s.enemies,...s.allies].some(u=>!object(u)||!finite(u.x)||!finite(u.y)||!finite(u.hp,0,1e6)))return false;
 if(!Array.isArray(w.stations)||w.stations.length>10000||!Array.isArray(w.rocks)||w.rocks.length>8000||
  !Array.isArray(w.discovered))return false;
 const ids=new Set();let dock=null,home=false;
 for(const pair of w.stations){
  if(!Array.isArray(pair)||pair.length!==2||!cell(pair[0])||ids.has(pair[0]))return false;
  const b=pair[1];
  if(!object(b)||b.id!==pair[0]||!['dock','arsenal','lab','carrier'].includes(b.type)||
   !finite(b.x)||!finite(b.y)||typeof b.active!=='boolean'||typeof b.enemy!=='boolean'||
   !Array.isArray(b.turrets)||!validFortification(b,s.time))return false;
  if(!validFieldCounters(b.fieldOperationRuns)||
   !validFieldCounters(b.fieldOperationFullRuns)||
   !validFieldCounters(b.fieldOperationAttempts)||
   !validFieldHistory(b.fieldOperationHistory))return false;
  if(b.reputation!==undefined&&(!Number.isInteger(b.reputation)||b.reputation<0||b.reputation>5))return false;
  if(b.contractRuns!==undefined&&(!Number.isInteger(b.contractRuns)||b.contractRuns<0||b.contractRuns>100000))return false;
  // Persistent regional machine archives contain only bounded, dated threat
  // categories. Older checkpoints without this optional field remain valid.
  if(b.meshArchive!==undefined&&(!Array.isArray(b.meshArchive)||
    b.meshArchive.length>5||b.meshArchive.some(a=>
      !object(a)||!['long','area','close','sabotage'].includes(a.kind)||
      !finite(a.lastAt,0,s.time)||
      !Number.isInteger(a.reports)||a.reports<1||a.reports>3||
      !(a.assetId==null||typeof a.assetId==='string'&&a.assetId.length<=100))))
    return false;
  if((b.suppressed!==undefined&&typeof b.suppressed!=='boolean')||
   (b.suppressedUntil!==undefined&&!finite(b.suppressedUntil,0,s.time+14))||
   (b.suppressed===true&&b.suppressedUntil===undefined))return false;
  if(b.fluxJamUntil!==undefined&&!finite(b.fluxJamUntil,0,s.time+105))return false;
  if(b.fluxBreachProgress!==undefined&&!finite(b.fluxBreachProgress,0,110))return false;
  if(b.fluxBreachUntil!==undefined&&!finite(b.fluxBreachUntil,0,s.time+270))return false;
  if(b.fluxBreachRepairAt!==undefined&&!finite(b.fluxBreachRepairAt,0,s.time+150))return false;
  if((b.fluxBreachProgress>0||b.fluxBreachUntil>0||b.fluxBreachRepairAt>0)&&
   !['central-depot','military','frontier-azure-depot','frontier-teal-depot']
    .includes(b.strategicRole))return false;
  if(b.defense!==undefined&&(!object(b.defense)||
   !Number.isInteger(b.defense.charges)||b.defense.charges<0||
   b.defense.charges>(b.fluxInfrastructure?.defense||0)+2||
   !finite(b.defense.rechargeAt,0,1e9)||!finite(b.defense.interceptAt,0,1e9)||
   !finite(b.defense.stasisAt,0,1e9)||
   (b.defense.lastLinked!==undefined&&typeof b.defense.lastLinked!=='boolean')||
   (b.defense.meteorEnabled!==undefined&&typeof b.defense.meteorEnabled!=='boolean')||
   !['','shot','meteor','stasis'].includes(b.defense.visualKind)||
   !finite(b.defense.visualAt,-Infinity,1e9)))return false;
  ids.add(b.id);if(b.id===data.baseId)dock=b;if(b.id==='0:0')home=true;
 }
 if(!home||!dock||dock.enemy||dock.ruined||dock.hp<=0||
  (!dock.active&&!dock.discovered)||Math.hypot(p.x-dock.x,p.y-dock.y)>210||
  w.discovered.some(id=>!ids.has(id)))return false;
 if(p.strategicXp!==undefined&&!validStrategicExperience(p.strategicXp,w.stations))return false;
 if(w.contours!==undefined&&(!validContours(w.contours,w.stations)||
   !validFluxArtillery(w.contours)||!validFluxSupports(w.contours)||
   !validFluxDepots(w.contours)||!validFluxEconomy(w.contours,w.stations)||
   !validFluxRoutes(w.contours)))return false;
 if(!validEnemyExpansion(w.enemyExpansion,w.stations,s.time))return false;
 if(!validPopulation(w.population,w.stations,s.time))return false;
 if(s.enemies.some(e=>e.stationRaid&&!ids.has(e.stationRaid.stationId))||
   w.regionalSupply?.command?.reports.some(r=>!ids.has(r.stationId)))return false;
 for(const pair of w.rocks){
  if(!Array.isArray(pair)||pair.length!==2||!cell(pair[0])||!Array.isArray(pair[1]))return false;
  for(const r of pair[1])if(!object(r)||typeof r.id!=='string'||!r.id.startsWith(pair[0]+'/')||
   !finite(r.x)||!finite(r.y)||!finite(r.hp,0,1e6)||typeof r.alive!=='boolean')return false;
 }
 if(s.operation&&(!ids.has(s.operation.baseId)||
  !(['silent-corridor','last-signal','relay-defense','carrier-interception'].includes(s.operation.id)||
    validFieldOperation(s.operation))))return false;
 if(s.contract&&!ids.has(s.contract.baseId))return false;
 if(s.fieldLoan){
  const loan=s.fieldLoan,spec=FIELD_WEAPONS[loan.moduleId||'ion'];
  if(!spec||!Number.isInteger(loan.charges)||loan.charges<0||loan.charges>spec.capacity||
   !finite(loan.cooldownUntil,0,1e9)||!Number.isInteger(loan.used)||loan.used<0)return false;
  if(loan.assignment&&(!['operation','contract'].includes(loan.assignment.kind)||
   typeof loan.assignment.id!=='string'||!ids.has(loan.assignment.baseId)))return false;
 }
 if(s.fieldEffects&&(!Array.isArray(s.fieldEffects)||s.fieldEffects.length>1||s.fieldEffects.some(e=>
  !finite(e.until,0,1e9)||!Array.isArray(e.targets)||e.targets.length>3||
  e.targets.some(t=>!object(t)||!object(t.target)||!['enemy','jammer','turret','base'].includes(t.kind)))))return false;
 try{return quoteLoadout(s.shipLoadout,s.shipLoadout,{baseActive:true,level:p.level,ore:0,
  ranks:s.skillRanks,fieldLoan:s.fieldLoan,firstHardwareReward:s.firstHardwareReward,
  loadout:s.shipLoadout,earlyRail:w.stations.find(([id])=>id==='0:0')?.[1].corridorSecured}).ok;}catch{return false;}
}
export function restoreCheckpoint(game,data){
 data=migrateCheckpoint(data);
 if(!validateCheckpoint(data))throw new Error('invalid-checkpoint');
 const world=new World(data.seed);
 world.stations=new Map(data.world.stations);world.home=world.stations.get('0:0');
 world.discovered=new Set(data.world.discovered);
 world.ensureRegionalStations();
 const legacyPopulation=data.world.population?.colonies.length===30;
 world.population=expandSavedPopulation(data.world.population,data.seed,data.state.time);
 ensurePopulationStations(world);
 world.regionalSupply=data.world.regionalSupply||createRegionalSupply(data.state.time);
 world.contours=data.world.contours||createContours();
 world.contours.artillery??=[];
 world.contours.artilleryPackets??=[];
 world.contours.artilleryShells??=[];
 world.contours.artillerySerial??=0;
 world.contours.supportTurrets??=[];
 world.contours.supportPackets??=[];
 world.contours.supportSerial??=0;
 world.contours.fluxDepots??=[];
 world.contours.fluxDepotPackets??=[];
 world.contours.fluxDepotSerial??=0;
 world.contours.fluxSiphonHives??=[];
 world.contours.fluxSiphonSerial??=0;
 world.contours.fluxRoads??=[];
 world.contours.fluxRoadPackets??=[];
 world.contours.fluxRoadSerial??=0;
 world.contours.fluxHarvestedLocally??=0;
 world.contours.fluxSpilled??=0;
 world.contours.maintenanceDebt??=0;
 world.contours.territoryPowered??=true;
 world.enemyExpansion=data.world.enemyExpansion||createEnemyExpansion(data.state.time);
 if(!data.world.population||!data.world.enemyExpansion||legacyPopulation)seedPopulationTerritory(world);
 for(const b of world.stations.values())if(b.suppressed&&b.suppressedUntil<=data.state.time)b.suppressed=false;
 for(const [key,patches] of data.world.rocks){
  const [x,y]=key.split(':').map(Number),list=world.rockCell(x,y);
  for(const patch of patches){
   const rock=list.find(r=>r.id===patch.id);
   if(rock)Object.assign(rock,patch);
   else if(patch.originKind==='event')list.push(patch);
   else throw new Error('unknown-rock');
  }
 }
 // Older checkpoints may contain rocks inside a previously formed socket.
 // Reconcile their patches against the persistent territorial layout.
 for(const core of world.contours.trials?.entries||[])
  clearCoreRocks(world,core,false);
 // Commit only after the complete world has been reconstructed successfully.
 // Older saves may contain three powered nodes but only two manually drawn
 // links. Complete the mesh now, without awarding retroactive rewards.
 autoConnectContours(world);
 // Existing checkpoints never required territory battles. Their already
 // claimed land stays productive; only future expansions create trials.
 if(!world.contours.trials){
  const ledger=ensureTrialLedger(world);
  ledger.completed=Math.min(12,Object.keys(world.contours.launches||{}).length);
 }
 game.world=world;game.seed=data.seed;
 for(const name of FIELDS)if(Object.hasOwn(data.state,name))game[name]=data.state[name];
 // Formation decisions and reinforcement timers are reconstructed at runtime.
 // A courier that had already left the screen must not become stuck waiting
 // for a queue which deliberately is not part of the saved data graph.
 game._moteSquadStates=new Map();game._moteSeenRoots=new Set();
 game._moteReinforcementQueue=[];game._nextMoteSwarmAt=0;
 for(const enemy of game.enemies){
  if(!enemy.microSwarm||!enemy.moteCourierReturning)continue;
  enemy.moteCourierReturning=false;enemy.moteEscape=true;
  enemy.moteCourier=true;
  enemy.moteEscapeGoal??={x:enemy.x,y:enemy.y};
 }
 rebaseSavedHull(game.player,game.skillRanks?.hull);
 game.fieldLoot=data.state.fieldLoot||createFieldLoot();
 game.combatTempo=data.state.combatTempo||createCombatTempo();
 game._nextFieldLootCheckAt=0;
 // Convert older saves only once, retaining every already earned skill point.
 migrateLegacyPlayerExperience(game.player);
 inheritStrategicExperience(game.player,world);
 game.tactical=data.state.tactical||createTactical();game.tacticalPointer=null;game.targetField=null;
 game.artilleryDecoys=[]; // Temporary battlefield signatures never survive docking.
 game.mouseAim=null;game.mobileMineArmed=false;
 game.buildPlanning=null;game.artilleryMenuTarget=null;
 if(game.mouseArsenal)game.mouseArsenal={cometReadyAt:0,minesReadyAt:0,projectiles:[],mines:[],bursts:[]};
 game.openingArc=data.state.openingArc||{...createOpeningArc(world.home),status:'skipped'};
 // The enemy escort protects the actual saved tug, not a JSON copy of it.
 // This is essential after restoring a checkpoint during the rescue mission.
 if(game.openingArc?.kind==='rescue'){
  const tug=game.enemies.find(e=>e.serial===game.openingArc.rescueTugSerial&&e.hp>0);
  for(const escort of game.enemies)if(escort.openingRescueRole==='escort')
   escort.protect=tug||null;
 }
 game.openingRepairing=false;
 game.sortieReports=data.state.sortieReports||[];
 game.sortieStart=null;
 game.keys.clear();game.touch.x=0;game.touch.y=0;
 game.player.vx=0;game.player.vy=0;game.player.burstRemaining=0;
 game.actionHeld=null;game.mining={active:false,target:null,fxClock:0};game.probeRepairing=false;
 game.regionalStormFields=[];game._stormQueryAt=0;game._stormWarnings=[];
 game.nearRocks=[];game.localStations=[];game.worldQueryClock=0;game.worldVisualLast=-Infinity;
 game.nextDefenseCheckAt=0;game.lastDefenseNoticeAt=-Infinity;
 game.defenseTopology=null;game.defenseTopologyAt=0;
 game.cachedTarget=null;game.cachedWorldLinks=[];game.cachedNetworkLinked=world.networkTopology().linked;
 game.contourVisualAt=-Infinity;game.contourVisualFields=null;
 game.enemyContourVisualAt=-Infinity;game.enemyContourVisualFields=null;
 game.lastContourNoticeAt=-Infinity;game.contourFirst=null;game.contourSelection=null;game.contourError='';
 game.contourFeedback=null;game.contourBirths=[];game.contourDynamics=null;game.contourTrial=null;
 game.docked=world.stations.get(data.baseId);game.dead=false;game.paused=true;game.pausedRenderPending=true;
 game.cruiseCharge=0;game.cruising=false;
 return game.docked;
}

function decodeRecord(text){
 if(!text)return null;
 const r=JSON.parse(text);
 if(!object(r)||![1,2].includes(r.format)||!Number.isSafeInteger(r.serial)||r.serial<1||
  typeof r.runId!=='string'||r.runId.length>100||!['checkpoint','new','ended'].includes(r.kind)||
  typeof r.body!=='string'||r.body.length>MAX_CHECKPOINT_LENGTH||
  hash(r.serial+'|'+r.runId+'|'+r.kind+'|'+r.body)!==r.checksum)throw new Error('invalid-record');
 if(r.kind==='checkpoint'){
  const raw=unpackRun(r.body);if(raw?.version>2)throw new Error('unsupported-version');
  r.data=migrateCheckpoint(raw);if(!validateCheckpoint(r.data))throw new Error('invalid-checkpoint');
 }
 return r;
}
export class RunCheckpointStore{
 constructor(storage,now=()=>Date.now()){
  this.storage=storage;this.now=now;this.record=null;this.issue='';this.blocked=false;
  this.lastBody=null;this.runId=null;this.read();
 }
 read(){
  const records=[];let damaged=false,unsupported=false;
  if(!this.storage){this.issue='unavailable';return null;}
  for(const key of RUN_KEYS)try{
   const text=this.storage.getItem(key);if(!text)continue;
   const header=JSON.parse(text);
   if(![1,2].includes(header?.format)){unsupported=true;continue;}
   records.push(decodeRecord(text));
  }catch(e){if(e?.message==='unsupported-version')unsupported=true;else damaged=true;
   if(e?.name==='SecurityError'){this.issue='unavailable';this.blocked=true;}}
  if(unsupported){this.issue='unsupported';this.blocked=true;return null;}
  const latest=records.sort((a,b)=>b.serial-a.serial)[0]||null;
  this.issue=this.blocked?this.issue:damaged?'damaged':'';
  return latest;
 }
 load(){
  this.record=this.read();this.runId=this.record?.runId||null;
  this.lastBody=this.record?.kind==='checkpoint'?this.record.body:null;
  return this.record?.kind==='checkpoint'?this.record.data:null;
 }
 recoveryCheckpoint(){
  if(this.blocked||!this.runId)return null;
  const latest=this.read();
  if(this.blocked)return null;
  if((latest?.serial||0)!==(this.record?.serial||0)||latest?.runId!==this.runId){
   this.blocked=true;this.issue='conflict';return null;
  }
  // Read the immutable saved graph, never the dying ship's mutable world.
  return latest?.kind==='checkpoint'?latest.data:null;
 }
 startNew(){
  if(this.blocked)return {ok:false,reason:this.issue};
  this.record=this.read();
  this.runId=String(this.now())+'-'+Math.random().toString(36).slice(2,11);this.lastBody=null;
  return this.write('new','');
 }
 write(kind,body){
  if(this.blocked||!this.storage)return {ok:false,reason:this.issue||'unavailable'};
  const latest=this.read();
  if(this.blocked)return {ok:false,reason:this.issue};
  if((latest?.serial||0)!==(this.record?.serial||0)){
   this.blocked=true;this.issue='conflict';return {ok:false,reason:'conflict'};
  }
  const serial=(latest?.serial||0)+1;
  const r={format:2,serial,runId:this.runId,kind,savedAt:this.now(),body,
   checksum:hash(serial+'|'+this.runId+'|'+kind+'|'+body)};
  try{this.storage.setItem(RUN_KEYS[serial%2],JSON.stringify(r));}
  catch{return {ok:false,reason:'unavailable'};}
  this.record=r;this.lastBody=kind==='checkpoint'?body:null;this.issue='';return {ok:true};
 }
 save(data){
  try{
   if(!validateCheckpoint(data))return {ok:false,reason:'invalid'};
   const body=packRun(data);
   // Check another tab even when this menu's own state has not changed.
   const latest=this.read();
   if((latest?.serial||0)!==(this.record?.serial||0)){
    this.blocked=true;this.issue='conflict';return {ok:false,reason:'conflict'};
   }
   if(body===this.lastBody&&!this.blocked)return {ok:true,unchanged:true};
   return this.write('checkpoint',body);
  }catch(e){return {ok:false,reason:e.message==='too-large'?'too-large':'invalid'};}
 }
 end(){return this.write('ended','');}
}
