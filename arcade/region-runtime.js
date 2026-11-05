import {RULES,spawnOutside} from './balance.js?v=arcade-balanced-bases-30';
import {ENEMY_TYPES} from './ai.js?v=enemy-learning-1-enemy-comms-1-regions-1-enemy-world-response-1-network-defense-4-enemy-audit-5-enemy-gunnery-1-opening-arc-1-enemy-plans-1-theater-1-campaign-1-theater-audit-1-repair-qa-1-mesh-1-tactical-field-2-backbone-1';
import {regionAt,centralOutline,centralBoundary} from './regions.js?v=regions-audit-1';
import {SUPPLY,SUPPLY_ROUTE,advanceRegionalSupply,interceptSupply,supplyEvent} from './regional-supply.js?v=living-world-3-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-repair-qa-1';
import {CENTRAL_INDUSTRY,CENTRAL_ROUTE,centralRoute,centralWorkerPosition,centralEvent} from './central-industry.js?v=home-conflict-1';
import {FRONTIERS,FRONTIER_STORM_FIELD,FRONTIER_RESPONSE,frontierRoute,frontierRadioCoverage,frontierWorkerPosition,frontierEvent,recordFrontierCargoAttack} from './frontier-industry.js?v=living-world-3-radio-shadow-1-expedition-1-repair-qa-1';
import {updateHomeConflict,HOME_CONFLICT} from './home-conflict.js?v=home-conflict-1-campaign-1-repair-qa-1';
import {updateStrategicCommand,assignStationInterdiction,drawStationInterdiction} from './strategic-command.js?v=campaign-1-repair-qa-1';
import {stormPhase} from './regional-storms.js?v=regions-1';
import {labLogisticsIntel,cargoStrengthensEnemy} from './station-progression.js?v=lab-logistics-qa-1-home-conflict-1-campaign-1-repair-qa-1';
const outline=centralOutline();
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function makeEnemy(game,type,x,y,scenario,protect=null,frontierRole=null){
 const def=ENEMY_TYPES[type];
 return {serial:++game.enemySerial,group:game.groupSerial,type,x,y,vx:0,vy:0,
  r:type==='gunship'?22:14,hp:def.hp,maxHp:def.hp,damage:def.dmg,
  think:.1,fire:1.8,state:'hunt',commitUntil:0,target:game.player,
  angle:0,hit:0,expAwarded:false,scenario,protect,entryPortalPending:false,
  frontierRole,stormAdapted:frontierRole==='azure'&&type==='flanker',
  healReserve:frontierRole==='teal'&&type==='healer'?90:undefined};
}
export function updateRegionalWorld(game,dt){
 const world=game.world,s=world.regionalSupply;if(!s)return;
 const region=regionAt(game.player.x,game.player.y);
 if(!s.visited.includes(region.id)){
  s.visited.push(region.id);game.notice(region.name+'. '+region.cue,7);
 }
 const events=advanceRegionalSupply(world,game.time);
 if(Math.floor(game.time)>Math.floor(game.time-dt)){
  updateHomeConflict(game);updateStrategicCommand(game);
 }
 if(game.waypoint?.id?.startsWith('regional-cargo-')||game.waypoint?.id?.startsWith('central-cargo-')||
    game.waypoint?.id?.startsWith('frontier-cargo-')||
    game.waypoint?.id?.startsWith('frontier-repair-')){
  const cargo=[...s.convoys,...(s.central?.convoys||[]),
   ...(s.frontier?.azure?.convoys||[]),...(s.frontier?.teal?.convoys||[]),
   s.frontier?.azure?.repairExpedition,s.frontier?.teal?.repairExpedition]
   .find(c=>c?.id===game.waypoint.id);
  if(!cargo||game.waypoint.radioContact&&!cargoStrengthensEnemy(world,cargo))game.waypoint=null;
  else if(!game.waypoint.radioContact)Object.assign(game.waypoint,{x:cargo.x,y:cargo.y});
  else {
   // A radio target is live only inside a working laboratory's coverage.
   // Outside that area the pilot keeps the last known location, not a
   // magically updated position. Reacquisition is checked once per second.
   if(Math.floor(game.time)>Math.floor(game.time-dt)){
    const contact=labLogisticsIntel(world,game.player).contacts.find(c=>c.id===cargo.id);
    game.waypoint.signalLive=!!contact;
    game.waypoint.label=contact?game.waypoint.signalLabel:
     'Последняя радиометка · '+game.waypoint.signalLabel;
   }
   if(game.waypoint.signalLive)Object.assign(game.waypoint,{x:cargo.x,y:cargo.y});
  }
 }
 // A triangulated industrial position is provisional. Replace it when the
 // station is actually discovered; remove a marker once its lead is resolved.
 // A one-second tick avoids scanning the station network on every frame.
 if(game.waypoint?.id?.startsWith('intel:')&&Math.floor(game.time)>Math.floor(game.time-dt)){
  const current=labLogisticsIntel(world,game.player).contacts.find(c=>c.id===game.waypoint.id);
  if(current)Object.assign(game.waypoint,{x:current.x,y:current.y,label:current.label});
  else game.waypoint=null;
 }
 const mine=world.stations.get(SUPPLY.mineId);
 const local=world.stations.get(CENTRAL_INDUSTRY.sourceId);
 for(const e of events){
  if(e.kind==='dispatch'&&mine?.discovered)
   game.notice('Добывающий комплекс отправил руду на север. Маршрут снабжения отмечен на карте.',6);
  if(e.kind==='delivery'&&mine?.discovered)
   game.notice('Руда доставлена военному узлу. Противник собирает тяжёлый отряд.',5);
  if(e.kind==='central-dispatch'&&local?.discovered)
   game.notice('Малая шахта отправила груз к сборочному посту. Транспорт можно перехватить.',5);
  if(e.kind==='central-delivery'&&(local?.discovered||world.stations.get(CENTRAL_INDUSTRY.depotId)?.discovered))
   game.notice('Груз разгружен. Сборочный пост собирает тяжёлый корабль и два истребителя; затем предупредит об их выходе.',6);
  if(e.kind==='central-screen-ready'&&local?.discovered)
   game.notice('После потери груза шахта оплатила подготовку тяжёлого охранения. Каждый новый усиленный рейс тоже расходует дополнительную руду.',7);
  if(e.kind==='central-route-changed'&&local?.discovered)
   game.notice('После повторного перехвата враг потратил руду на обходной путь. Новый маршрут виден на карте; уже вышедший груз сохраняет прежний курс.',7);
  if(e.network&&(world.stations.get(FRONTIERS[e.network].sourceId)?.discovered||
    world.stations.get(FRONTIERS[e.network].depotId)?.discovered)){
   if(e.kind==='dispatch')game.notice(e.network==='azure'?
    'Индукционная вышка отправила батареи в электроангар. Перехватите транспорт до его прибытия.':
    'Комбинат отправил обломки на ремонтную верфь. Перехват оборвёт этот ремонтный рейс.',6);
   if(e.kind==='delivery')game.notice(e.network==='azure'?
    'Заряды доставлены: электроангар готовит ионных перехватчиков.':
    'Запчасти доставлены: верфь собирает отряд с ремонтником.',5);
   if(e.kind==='route-prep')game.notice('Перехват переговоров: после потерь транспорта враг готовит обходной маршрут. Перестройка требует времени и ресурсов.',7);
   if(e.kind==='route-changed')game.notice('Вражеский грузовой путь изменён. Новый маршрут показан на карте; уже вышедшие корабли продолжают прежний рейс.',7);
   if(e.kind==='screen-prep')game.notice('Перехват переговоров: после дальнобойных атак враг готовит усиленное охранение. Это уменьшит его запас материалов.',7);
   if(e.kind==='screen-ready')game.notice('Враг подготовил усиленное охранение. Его получат только новые транспорты, если хватит материалов.',6);
   if(e.kind==='screen-dispatch')game.notice('Вышел транспорт с усиленным охранением. Охрана отвлечёт огонь; можно атаковать её или лишить сеть снабжения.',7);
   if(e.kind==='shipment-overdue')game.notice(e.network==='azure'?
    'Электроангар не дождался груза. Донесение о пропаже теперь поступает в командную сеть.':
    'Ремонтная верфь не дождалась груза. Донесение о пропаже теперь поступает в командную сеть.',7);
   if(e.kind==='repair-depot-dispatch')game.notice(e.network==='azure'?
    'Индукционная вышка потратила батареи на ремонтный рейс к электроангару. Перехватите корабль до прибытия.':
    'Комбинат отправил запчасти для ремонта верфи. Ремонтный корабль можно перехватить в пути.',8);
   if(e.kind==='repair-source-dispatch')game.notice(e.network==='azure'?
    'Электроангар потратил готовый резерв на ремонт индукционной вышки. Корабль идёт обратно по грузовой дороге.':
    'Верфь потратила готовый резерв на ремонт комбината. Ремонтный корабль возвращается к источнику.',8);
   if(e.kind==='repair-screened-dispatch')game.notice(
    'Противник потратил дополнительные материалы на усиленное сопровождение ремонтного корабля.',7);
   if(e.kind==='repair-depot-complete'||e.kind==='repair-source-complete')game.notice(
    'Ремонтный корабль достиг цели. Корпус и уцелевшие турели станции частично восстановлены.',7);
   if(e.kind==='repair-intercept')game.notice('Ремонтный рейс противника сорван. Потраченные материалы враг не вернёт.',6);
   if(e.kind==='repair-aborted')game.notice('Ремонтный корабль прибыл слишком поздно: станция уже захвачена.',6);
  }
 }
 // A finite local defense. Leaving the screen does not create a fresh garrison.
 if(mine?.enemy&&distance(mine,game.player)<800&&!mine.regionalGuard&&game.enemies.length<=RULES.maxEnemies-2){
  mine.regionalGuard=true;++game.groupSerial;
  for(let i=0;i<2;i++)game.enemies.push(makeEnemy(game,i?'fighter':'scout',
   mine.x-180+i*280,mine.y-220,'mine-guard',mine));
 }
 for(const cargo of [...s.convoys,...(s.central?.convoys||[]),
   ...(s.frontier?.azure?.convoys||[]),...(s.frontier?.teal?.convoys||[]),
   s.frontier?.azure?.repairExpedition,s.frontier?.teal?.repairExpedition].filter(Boolean)){
  cargo.hit=Math.max(0,(cargo.hit||0)-dt);
  if(distance(cargo,game.player)<1000){
   cargo.seen=true;
   if(!cargo.escorted&&game.enemies.length<=RULES.maxEnemies-2){
    cargo.escorted=true;++game.groupSerial;
    const roster=cargo.frontierRepair?
     (cargo.frontierNetwork==='azure'?(cargo.screened?['flanker','gunship']:['fighter','flanker']):
      cargo.screened?['gunship','healer']:['fighter','healer']):cargo.frontierCargo?
     (cargo.screened?(cargo.frontierNetwork==='azure'?['flanker','gunship']:['gunship','healer']):
      FRONTIERS[cargo.frontierNetwork].escort):
     cargo.centralCargo&&cargo.screened?['gunship','fighter']:['fighter','fighter'];
    for(let i=0;i<2;i++)game.enemies.push(makeEnemy(game,roster[i],cargo.x+(i?95:-95),cargo.y+85,
     cargo.frontierRepair?'frontier-repair-escort':cargo.frontierCargo?'frontier-escort':'regional-escort',
     cargo,cargo.frontierNetwork||null));
   }
  }
 }
 const pending=s.pendingRaid;
 if(pending&&Math.hypot(game.player.x,game.player.y)<=70000&&['amethyst','amber'].includes(region.id)&&!pending.announced){
  pending.announced=true;pending.readyAt=Math.max(pending.readyAt,game.time+SUPPLY.warning);
  game.notice('Перехвачена передача: с севера идёт тяжёлый отряд. Руда доставлена; готовьтесь к бою.',7);
 }
 const localPending=s.central?.pendingRaid;
 if(localPending&&!localPending.announced&&
  distance(game.player,world.stations.get(CENTRAL_INDUSTRY.depotId))<11000){
  localPending.announced=true;
  localPending.readyAt=Math.max(localPending.readyAt,game.time+CENTRAL_INDUSTRY.warning);
  game.notice('Перехвачена передача: сборочный пост готовит налёт — тяжёлый корабль и два истребителя. До готовности не менее '+CENTRAL_INDUSTRY.warning+' с. Захват поста отменит выход.',8);
 }
 for(const id of ['azure','teal']){
  const raid=s.frontier?.[id]?.pendingRaid,config=FRONTIERS[id];
  if(!raid||raid.announced||region.id!==id||
     distance(game.player,config.depot)>13500)continue;
  raid.announced=true;raid.readyAt=Math.max(raid.readyAt,game.time+config.warning);
  game.notice(id==='azure'?
   'Перехват радиосвязи: электроангар готовит вылет перехватчиков. Их питают батареи индукционной вышки.':
   'Перехват радиосвязи: ремонтная верфь готовит охраняемый отряд. Ей нужны запчасти утилизационного комбината.',7);
 }
 for(const id of ['azure','teal']){
  const cfg=FRONTIERS[id],state=s.frontier?.[id],emergency=state?.strategy?.emergency;
  if(!emergency||emergency.announced||region.id!==id||
    !world.stations.get(cfg.depotId)?.enemy||
    distance(game.player,cfg.source)>13500)continue;
  emergency.announced=true;
  emergency.readyAt=Math.max(emergency.readyAt,game.time+FRONTIER_RESPONSE.emergencyWarning);
  game.notice('Перехват радиосвязи: после захвата производственной станции верфь готовит ответный отряд из накопленного резерва. Отступление или бой — ваш выбор.',8);
 }
}
// A shipment adds a specialist to an ordinary encounter; it never substitutes
// a weaker, unscaled formation for the normal director wave. If there is no
// room for both, the paid reinforcement remains pending until a later wave.
// Storm pilots seek electrical discharges; teal medics support the same wave.
export function spawnFrontierRaid(game,director){
 const region=regionAt(game.player.x,game.player.y).id;
 const cfg=FRONTIERS[region],s=game.world.regionalSupply?.frontier?.[region];
 if(!cfg||!s||!game.world.stations.get(cfg.depotId)?.enemy)return false;
 const emergency=s.strategy?.emergency;
 const emergencyReady=emergency?.announced&&game.time>=emergency.readyAt&&
  distance(game.player,cfg.source)<=13500;
 const ordinaryReady=s.pendingRaid?.announced&&game.time>=s.pendingRaid.readyAt&&
  distance(game.player,cfg.depot)<=13500;
 const cap=Math.min(RULES.maxEnemies,director.cap);
 if((!emergencyReady&&!ordinaryReady)||
   !director.types?.length||!game.spawnGroup||
   game.enemies.length+Math.max(1,director.groupSize||0)+1>cap)return false;
 const before=game.enemies.length;
 const pause=game.spawnGroup(director);
 if(game.enemies.length<=before||game.enemies.length>=cap)return false;
 const retaliating=Boolean(emergencyReady),origin=retaliating?cfg.source:cfg.depot;
 const cam=game.camera(),dx=origin.x-game.player.x,dy=origin.y-game.player.y;
 const side=Math.abs(dx)>Math.abs(dy)?(dx>0?1:0):(dy>0?3:2);
 ++game.groupSerial;
 const pos=spawnOutside(cam,side,.5,170);
 const specialist=makeEnemy(game,cfg.reinforcement,pos.x,pos.y,
  region+(retaliating?'-last-reserve':'-funded'),null,region);
 specialist.hp*=1+Math.min(2.5,game.time/550);
 specialist.maxHp=specialist.hp;
 if(region==='teal')specialist.healReserve=120;
 game.enemies.push(specialist);
 if(retaliating){
  s.strategy.emergency=null;s.strategy.emergencyRaids++;
  frontierEvent(s,region,'emergency-raid',game.time);
  game.notice('Верфь отправила последний резервный корабль с обычным патрулём. Нового снабжения нет, но готовые запасы ещё опасны.',7);
 }else{
  s.pendingRaid=null;s.raids++;s.nextRaid=game.time+cfg.raidInterval;
  frontierEvent(s,region,'raid',game.time);
  game.notice(region==='azure'?
   'Снабжение усилило обычный патруль заряженным перехватчиком. Лишите электроангар батарей, чтобы остановить такие подкрепления.':
   'Снабжение добавило к патрулю ремонтника. Перехватывайте запчасти, чтобы лишить врага этого усиления.',6);
 }
 assignStationInterdiction(game,specialist,region);
 return Math.max(.001,pause||0);
}
// A delivered local shipment finances one additional three-ship sortie. The
// bounded background wave stays separate; three reserved slots prevent the
// ambient population from indefinitely suppressing an already paid assault.
export function spawnCentralRaid(game,director){
 const s=game.world.regionalSupply?.central,raid=s?.pendingRaid;
 const origin=game.world.stations.get(CENTRAL_INDUSTRY.depotId);
 const limit=Math.min(RULES.maxEnemies,director.cap+HOME_CONFLICT.raidShips);
 const ambientRoom=Math.max(0,Math.min(director.groupSize||0,director.cap-game.enemies.length));
 if(!raid?.announced||!origin?.enemy||game.time<raid.readyAt||
  distance(game.player,origin)>11000||
  director.cap<4||!director.types?.length||!game.spawnGroup||
  game.enemies.length+ambientRoom+HOME_CONFLICT.raidShips>limit)return false;
 const ambientRecovery=ambientRoom>0?game.spawnGroup(director):0;
 if(game.enemies.length+HOME_CONFLICT.raidShips>limit)return false;
 const cam=game.camera(),dx=origin.x-game.player.x,dy=origin.y-game.player.y;
 const side=Math.abs(dx)>Math.abs(dy)?(dx>0?1:0):(dy>0?3:2);
 ++game.groupSerial;
 let lead=null;
 for(const [i,type] of ['gunship','fighter','fighter'].entries()){
  const pos=spawnOutside(cam,side,.38+i*.12,180+i*20);
  const ship=makeEnemy(game,type,pos.x,pos.y,'central-funded',lead);
  ship.hp*=1+Math.min(2.5,game.time/550);ship.maxHp=ship.hp;
  game.enemies.push(ship);
  if(!lead)lead=ship;
 }
 s.pendingRaid=null;s.raids++;s.nextRaid=game.time+90;
 centralEvent(s,'central-raid',game.time);
 game.notice('Из сборочного поста прибыл оплаченный грузом налёт: тяжёлый корабль и два истребителя. Они идут со стороны поста. Перехват следующей поставки предотвратит следующий такой отряд.',7);
 assignStationInterdiction(game,lead,'home');
 return Math.max(.001,ambientRecovery);
}
// Add one funded heavy ship to an ambient encounter, respect its pressure cap,
// and spend one delivered cargo. A warning precedes every arrival.
export function spawnRegionalRaid(game,director){
 const s=game.world.regionalSupply,raid=s?.pendingRaid;
 if(!raid?.announced||game.time<raid.readyAt||Math.hypot(game.player.x,game.player.y)>70000||
  !['amethyst','amber'].includes(regionAt(game.player.x,game.player.y).id)||
  !director.types?.length||!game.spawnGroup||
  game.enemies.length+Math.max(1,director.groupSize||0)+1>Math.min(RULES.maxEnemies,director.cap))return false;
 const before=game.enemies.length;
 const pause=game.spawnGroup(director);
 if(game.enemies.length<=before||game.enemies.length>=Math.min(RULES.maxEnemies,director.cap))return false;
 const cam=game.camera(),origin=game.world.stations.get(SUPPLY.militaryId);
 const dx=origin.x-game.player.x,dy=origin.y-game.player.y;
 const side=Math.abs(dx)>Math.abs(dy)?(dx>0?1:0):(dy>0?3:2);
 ++game.groupSerial;
 const pos=spawnOutside(cam,side,.5,170);
 const heavy=makeEnemy(game,'gunship',pos.x,pos.y,'regional-heavy');
 heavy.hp*=1+Math.min(2.5,game.time/550);
 heavy.maxHp=heavy.hp;
 game.enemies.push(heavy);
 s.pendingRaid=null;s.raids++;s.nextRaid=game.time+SUPPLY.raidPeriod;
 supplyEvent(s,'raid',game.time);
 game.notice('Военный узел добавил тяжёлый корабль к обычному патрулю. Перехват руды предотвращает такое усиление.',5);
 assignStationInterdiction(game,heavy,'north');
 return Math.max(.001,pause||0);
}
export function hitRegionalCargo(game,cargo,damage,contact=null,source='other'){
 if(cargo.hp<=0||!Number.isFinite(damage)||damage<=0)return;
 const silentLoss=(cargo.frontierCargo||cargo.frontierRepair)&&
  !frontierRadioCoverage(game.world,cargo.frontierNetwork,cargo);
 if(cargo.frontierCargo||cargo.frontierRepair)recordFrontierCargoAttack(game.world,cargo,source,
  distance(game.player,cargo),game.time);
 cargo.hp=Math.max(0,cargo.hp-damage);cargo.hit=.18;
 // Local escorts can witness an attack and call nearby pilots to the
 // convoy's last reported position. The industrial network separately
 // accounts for destroyed cargo and paid strategic responses.
 if(game.time>=(cargo._nextWitnessAlarmAt??0)){
  const witnesses=game.enemyComms?.reportIncident(cargo,game,'convoy')||0;
  if(witnesses)cargo._nextWitnessAlarmAt=game.time+10;
 }
 game.heritage.vfx.hullImpact(contact?.x??cargo.x,contact?.y??cargo.y,damage>30,contact);
 if(cargo.hp>0||!interceptSupply(game.world,cargo,game.time))return;
 game.heritage.vfx.shipExplosion(cargo.x,cargo.y,55,'#ffc47d',true);
 game.heritage.play('largeExplosion',.22,cargo);
 const frontier=cargo.frontierCargo?FRONTIERS[cargo.frontierNetwork]:null;
 game.addDrop('ore',cargo.x,cargo.y,cargo.frontierRepair?4:frontier?.rewardOre??(cargo.centralCargo?CENTRAL_INDUSTRY.oreReward:SUPPLY.oreReward),{source:'salvage',life:60});
 game.addDrop('data',cargo.x+14,cargo.y,cargo.frontierRepair?5:frontier?.rewardData??(cargo.centralCargo?CENTRAL_INDUSTRY.dataReward:SUPPLY.dataReward),{source:'combat',life:60});
 game.notice(cargo.frontierRepair?
  'Вражеский ремонтный корабль уничтожен. Запас на этот рейс потрачен, повреждённая станция останется без ремонта.'+
   (silentLoss?' В радиотени пропажу заметят позже.':' Сигнал об атаке получен вражеской сетью.'):frontier?
  (cargo.frontierNetwork==='azure'?
   'Батареи уничтожены: электроангар не получит усиление для одного будущего патруля. Готовые резервы сохраняются.':
   'Запчасти уничтожены: верфь не усилит патруль ремонтником из этой поставки. Готовые резервы сохраняются.')+
   (silentLoss?' Радиотень: сигнал бедствия не ушёл. Пропажу заметят позже.':
    ' Сигнал бедствия ушёл на ближайшую вражескую станцию.'):
  cargo.centralCargo?
  'Местный груз уничтожен: один будущий налёт из трёх кораблей лишился материалов. Прежние резервы сохраняются. Враг готовит защиту следующих рейсов — ей тоже нужна руда.':
  'Рудный груз перехвачен: военный узел не усилит один будущий патруль тяжёлым кораблём. Резервы сохраняются.',7);
}
export function drawRegionalWorld(game,c,cam){
 const p=game.player,s=game.world.regionalSupply;if(!s)return;
 drawStationInterdiction(game,c,cam);
 const delta=Math.abs(Math.hypot(p.x,p.y)-centralBoundary(Math.atan2(p.y,p.x)));
 if(delta<Math.max(cam.w,cam.h)){
  c.save();c.strokeStyle='#c99be278';c.lineWidth=3;c.setLineDash([24,20]);c.beginPath();
  for(let i=0;i<outline.length;i++){const q=outline[i];if(i)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y);}
  c.stroke();c.restore();
 }
 const mine=game.world.stations.get(SUPPLY.mineId);
 if(mine?.discovered&&mine.enemy){
  c.save();c.strokeStyle='#ffbd7944';c.lineWidth=2;c.setLineDash([18,25]);c.beginPath();
  SUPPLY_ROUTE.forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));c.stroke();c.restore();
 }
 const local=game.world.stations.get(CENTRAL_INDUSTRY.sourceId);
 if(local?.discovered&&local.enemy){
  c.save();c.strokeStyle='#7ceac37a';c.lineWidth=2;c.setLineDash([11,14]);c.beginPath();
  centralRoute(s.central?.strategy?.rerouted?'diversion':'direct').forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));c.stroke();c.restore();
 }
 const depot=game.world.stations.get(CENTRAL_INDUSTRY.depotId),central=s.central;
 if(depot?.discovered&&depot.enemy&&central&&
   depot.x>cam.x-150&&depot.x<cam.x+cam.w+150&&depot.y>cam.y-150&&depot.y<cam.y+cam.h+150){
  const unloading=central.history.some(e=>e.kind==='central-delivery'&&game.time-e.time<2);
  const assembling=central.reserves>0&&game.time<central.assemblyUntil;
  const pending=central.pendingRaid;
  c.save();c.strokeStyle=unloading?'#8df5d4':'#ffb679';c.lineWidth=3;
  if(unloading||assembling||pending){
   c.beginPath();c.arc(depot.x,depot.y,136,-Math.PI/2,-Math.PI/2+Math.PI*2*
    (assembling?Math.max(0,1-(central.assemblyUntil-game.time)/CENTRAL_INDUSTRY.assembly):1));c.stroke();
  }
  c.fillStyle='#ffe3b8';c.font='13px sans-serif';c.textAlign='center';
  c.fillText(unloading?'РАЗГРУЗКА МАТЕРИАЛОВ':pending?
   'ОТРЯД ОПЛАЧЕН · '+(pending.readyAt>game.time?Math.ceil(pending.readyAt-game.time)+' с':'ГОТОВ'):
   assembling?'СБОРКА ОТРЯДА · '+Math.ceil(central.assemblyUntil-game.time)+' с':
   'ОЖИДАНИЕ МАТЕРИАЛОВ',depot.x,depot.y+160);c.restore();
 }
 const w=s.central?.worker;
 if(w&&w.hp>0&&local?.enemy){
  const pos=centralWorkerPosition(w,game.time);
  if(pos.x>cam.x-40&&pos.x<cam.x+cam.w+40&&pos.y>cam.y-40&&pos.y<cam.y+cam.h+40){
   c.save();c.translate(pos.x,pos.y);c.rotate(game.time*.65);
   c.fillStyle='#153d3e';c.strokeStyle='#81f4d3';c.lineWidth=3;
   c.beginPath();c.arc(0,0,15,0,Math.PI*2);c.fill();c.stroke();
   for(let i=0;i<4;i++){const a=i*Math.PI/2;c.fillStyle='#60dfce';c.fillRect(Math.cos(a)*21-4,Math.sin(a)*21-4,8,8);}
   c.restore();c.save();c.fillStyle='#b7ffe3';c.font='11px system-ui';c.textAlign='center';
   c.fillText(w.phase==='mining'?'ДОБЫЧА · ВЫБЕРИТЕ ЦЕЛЬ':'РАБОЧИЙ · ВЫБЕРИТЕ ЦЕЛЬ',pos.x,pos.y-34);c.restore();
  }
 }
 for(const cargo of s.convoys){
  if(cargo.x<cam.x-120||cargo.x>cam.x+cam.w+120||cargo.y<cam.y-120||cargo.y>cam.y+cam.h+120)continue;
  c.save();c.translate(cargo.x,cargo.y);c.rotate(cargo.angle);
  c.fillStyle='#192739';c.strokeStyle=cargo.hit?'#fff4d3':'#ffc17c';c.lineWidth=3;
  c.beginPath();c.moveTo(0,-43);c.lineTo(32,-20);c.lineTo(32,32);c.lineTo(-32,32);c.lineTo(-32,-20);c.closePath();c.fill();c.stroke();
  for(const x of [-18,0,18]){c.fillStyle='#9c693d';c.fillRect(x-6,-18,12,40);}
  c.fillStyle='#78dcff';c.fillRect(-23,33,12,8);c.fillRect(11,33,12,8);c.restore();
  c.save();c.textAlign='center';c.font='bold 12px system-ui';c.fillStyle='#ffe1b5';
  c.fillText('РУДНЫЙ ТРАНСПОРТ',cargo.x,cargo.y-68);
  c.fillStyle='#382c32';c.fillRect(cargo.x-40,cargo.y-59,80,5);
  c.fillStyle='#ffc17c';c.fillRect(cargo.x-40,cargo.y-59,80*cargo.hp/cargo.maxHp,5);c.restore();
 }
 for(const cargo of s.central?.convoys||[]){
  if(cargo.x<cam.x-80||cargo.x>cam.x+cam.w+80||cargo.y<cam.y-80||cargo.y>cam.y+cam.h+80)continue;
  c.save();c.translate(cargo.x,cargo.y);c.rotate(cargo.angle);
  c.fillStyle='#1b3937';c.strokeStyle=cargo.hit?'#fff':'#82f0cc';c.lineWidth=3;
  c.beginPath();c.moveTo(0,-29);c.lineTo(23,13);c.lineTo(0,24);c.lineTo(-23,13);c.closePath();c.fill();c.stroke();
  c.fillStyle='#efba65';c.fillRect(-9,-8,18,25);c.restore();
  c.save();c.textAlign='center';c.font='bold 11px system-ui';c.fillStyle='#b9ffed';
  c.fillText('МЕСТНЫЙ ГРУЗ',cargo.x,cargo.y-45);
  c.fillStyle='#23383b';c.fillRect(cargo.x-32,cargo.y-38,64,4);
  c.fillStyle='#82f0cc';c.fillRect(cargo.x-32,cargo.y-38,64*cargo.hp/cargo.maxHp,4);c.restore();
 }
 for(const id of ['azure','teal']){
  const cfg=FRONTIERS[id],net=s.frontier?.[id];
  if(!net)continue;
  const source=game.world.stations.get(cfg.sourceId);
  if(source?.discovered&&source.enemy){
   c.save();c.lineWidth=2;c.strokeStyle=id==='azure'?'#8bdafc71':'#7ad8bd70';
   c.setLineDash(id==='azure'?[10,8]:[19,11]);c.beginPath();
   frontierRoute(id,net.strategy?.route).forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));c.stroke();c.restore();
  }
  if(id==='azure'&&source?.enemy&&FRONTIER_STORM_FIELD&&
    distance(source,p)<1900){
   const phase=stormPhase(FRONTIER_STORM_FIELD,game.time);
   const emitting=phase.state==='discharge';
   c.save();c.strokeStyle=emitting?'#b5f7ffb0':'#72dbff4d';
   c.lineWidth=emitting?3:1;c.setLineDash(emitting?[]:[8,15]);
   c.beginPath();c.moveTo(source.x,source.y);c.lineTo(FRONTIER_STORM_FIELD.x,FRONTIER_STORM_FIELD.y);
   c.stroke();c.restore();
  }
  if(id==='teal'){
   for(const wreck of net.wrecks){
    if(wreck.hp<=0||wreck.x<cam.x-65||wreck.x>cam.x+cam.w+65||
      wreck.y<cam.y-65||wreck.y>cam.y+cam.h+65)continue;
    c.save();c.translate(wreck.x,wreck.y);c.rotate(wreck.id.length*.4);
    c.fillStyle='#294444';c.strokeStyle='#76cbbf';c.lineWidth=3;
    c.beginPath();c.moveTo(-39,-13);c.lineTo(16,-30);c.lineTo(35,5);
    c.lineTo(4,28);c.lineTo(-29,17);c.closePath();c.fill();c.stroke();c.restore();
    c.save();c.font='11px system-ui';c.textAlign='center';c.fillStyle='#b6f5db';
    c.fillText('ОБЛОМКИ · ВЫБЕРИТЕ ЦЕЛЬ',wreck.x,wreck.y-47);
    c.fillText('МАТЕРИАЛ '+Math.ceil(wreck.stock),wreck.x,wreck.y+51);c.restore();
   }
   const worker=net.worker;
   if(worker?.hp>0&&source?.enemy){
    const pos=frontierWorkerPosition(worker,game.time);
    if(pos.x>cam.x-45&&pos.x<cam.x+cam.w+45&&pos.y>cam.y-45&&pos.y<cam.y+cam.h+45){
     c.save();c.translate(pos.x,pos.y);c.rotate(game.time*.5);
     c.fillStyle='#153c35';c.strokeStyle='#c6ffe5';c.lineWidth=3;
     c.fillRect(-14,-14,28,28);c.strokeRect(-14,-14,28,28);
     for(const x of [-22,22]){c.fillStyle='#71cf9e';c.fillRect(x-4,-5,8,10);}
     c.restore();c.save();c.textAlign='center';c.font='bold 11px system-ui';c.fillStyle='#b8ffe8';
     c.fillText('СБОРЩИК · ВЫБЕРИТЕ ЦЕЛЬ',pos.x,pos.y-31);c.restore();
    }
   }
  }
  for(const cargo of net.convoys){
   if(cargo.x<cam.x-85||cargo.x>cam.x+cam.w+85||
      cargo.y<cam.y-85||cargo.y>cam.y+cam.h+85)continue;
   const electric=id==='azure',color=electric?'#92dcff':'#a6e5b7';
   c.save();c.translate(cargo.x,cargo.y);c.rotate(cargo.angle);
   c.fillStyle=electric?'#18354c':'#263c32';c.strokeStyle=cargo.hit?'#fff':color;c.lineWidth=3;
   c.beginPath();c.moveTo(0,-32);c.lineTo(28,-5);c.lineTo(25,23);
   c.lineTo(-25,23);c.lineTo(-28,-5);c.closePath();c.fill();c.stroke();
   c.fillStyle=electric?'#c1f9ff':'#cfb38a';c.fillRect(-12,-8,24,25);c.restore();
   c.save();c.textAlign='center';c.font='bold 11px system-ui';c.fillStyle=color;
   c.fillText(cargo.screened?'УСИЛЕННАЯ ОХРАНА':
    (electric?'ЭНЕРГОТРАНСПОРТ':'РЕМОНТНЫЙ ГРУЗ'),cargo.x,cargo.y-49);
   if(source?.discovered&&source.enemy){
    const onAir=frontierRadioCoverage(game.world,id,cargo);
    c.font='10px system-ui';c.fillStyle=onAir?'#a6f3d0':'#ffe0a5';
    c.fillText(onAir?'НА СВЯЗИ':'РАДИОТЕНЬ',cargo.x,cargo.y-65);
   }
   c.fillStyle='#22313e';c.fillRect(cargo.x-33,cargo.y-42,66,4);
   c.fillStyle=color;c.fillRect(cargo.x-33,cargo.y-42,66*cargo.hp/cargo.maxHp,4);c.restore();
  }
  const repair=net.repairExpedition;
  if(repair&&repair.x>cam.x-80&&repair.x<cam.x+cam.w+80&&
     repair.y>cam.y-80&&repair.y<cam.y+cam.h+80){
   c.save();c.translate(repair.x,repair.y);c.rotate(repair.angle);
   c.fillStyle='#303b4f';c.strokeStyle=repair.hit?'#fff9c4':'#ffc78b';c.lineWidth=3;
   c.beginPath();c.moveTo(0,-33);c.lineTo(27,-9);c.lineTo(22,20);
   c.lineTo(-22,20);c.lineTo(-27,-9);c.closePath();c.fill();c.stroke();
   c.fillStyle='#f1bb7e';c.fillRect(-14,-3,28,15);c.restore();
   c.save();c.textAlign='center';c.font='bold 11px system-ui';c.fillStyle='#ffe0ad';
   c.fillText('РЕМОНТНАЯ ЭКСПЕДИЦИЯ',repair.x,repair.y-49);
   c.fillStyle='#493a36';c.fillRect(repair.x-34,repair.y-41,68,4);
   c.fillStyle='#ffc78b';c.fillRect(repair.x-34,repair.y-41,68*repair.hp/repair.maxHp,4);
   c.restore();
  }
 }
}
