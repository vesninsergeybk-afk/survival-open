import {RULES,spawnOutside} from './balance.js?v=arcade-balanced-bases-30';
import {ENEMY_TYPES} from './ai.js?v=enemy-learning-1-enemy-comms-1-regions-1';
import {regionAt,centralOutline,centralBoundary} from './regions.js?v=regions-1';
import {SUPPLY,SUPPLY_ROUTE,advanceRegionalSupply,interceptSupply,supplyEvent} from './regional-supply.js?v=living-world-1';
import {CENTRAL_INDUSTRY,CENTRAL_ROUTE,centralWorkerPosition,centralEvent} from './central-industry.js?v=living-world-1';
const outline=centralOutline();
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function makeEnemy(game,type,x,y,scenario,protect=null){
 const def=ENEMY_TYPES[type];
 return {serial:++game.enemySerial,group:game.groupSerial,type,x,y,vx:0,vy:0,
  r:type==='gunship'?22:14,hp:def.hp,maxHp:def.hp,damage:def.dmg,
  think:.1,fire:1.8,state:'hunt',commitUntil:0,target:game.player,
  angle:0,hit:0,expAwarded:false,scenario,protect,entryPortalPending:false};
}
export function updateRegionalWorld(game,dt){
 const world=game.world,s=world.regionalSupply;if(!s)return;
 const region=regionAt(game.player.x,game.player.y);
 if(!s.visited.includes(region.id)){
  s.visited.push(region.id);game.notice(region.name+'. '+region.cue,7);
 }
 const events=advanceRegionalSupply(world,game.time);
 if(game.waypoint?.id?.startsWith('regional-cargo-')||game.waypoint?.id?.startsWith('central-cargo-')){
  const cargo=[...s.convoys,...(s.central?.convoys||[])].find(c=>c.id===game.waypoint.id);
  if(cargo)Object.assign(game.waypoint,{x:cargo.x,y:cargo.y});else game.waypoint=null;
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
   game.notice('Груз прибыл. Сборочный пост готовит местное подкрепление.',5);
 }
 // A finite local defense. Leaving the screen does not create a fresh garrison.
 if(mine?.enemy&&distance(mine,game.player)<800&&!mine.regionalGuard&&game.enemies.length<=RULES.maxEnemies-2){
  mine.regionalGuard=true;++game.groupSerial;
  for(let i=0;i<2;i++)game.enemies.push(makeEnemy(game,i?'fighter':'scout',mine.x-180+i*280,mine.y-220,'mine-guard'));
 }
 for(const cargo of [...s.convoys,...(s.central?.convoys||[])]){
  cargo.hit=Math.max(0,(cargo.hit||0)-dt);
  if(distance(cargo,game.player)<1000){
   cargo.seen=true;
   if(!cargo.escorted&&game.enemies.length<=RULES.maxEnemies-2){
    cargo.escorted=true;++game.groupSerial;
    for(let i=0;i<2;i++)game.enemies.push(makeEnemy(game,'fighter',cargo.x+(i?95:-95),cargo.y+85,'regional-escort',cargo));
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
  game.notice('Перехвачена передача: сборочный пост выпустил патруль. Его снабжает местная шахта — перехватывайте грузы.',7);
 }
}
// Spend one delivery for a local, modest patrol. This replaces one ambient
// encounter; it never adds an unbounded wave on top of the director.
export function spawnCentralRaid(game,director){
 const s=game.world.regionalSupply?.central,raid=s?.pendingRaid;
 const origin=game.world.stations.get(CENTRAL_INDUSTRY.depotId);
 if(!raid?.announced||!origin?.enemy||game.time<raid.readyAt||
  distance(game.player,origin)>11000||
  game.enemies.length+2>Math.min(RULES.maxEnemies,director.cap))return false;
 const cam=game.camera(),dx=origin.x-game.player.x,dy=origin.y-game.player.y;
 const side=Math.abs(dx)>Math.abs(dy)?(dx>0?1:0):(dy>0?3:2);
 ++game.groupSerial;
 for(let i=0;i<2;i++){
  const pos=spawnOutside(cam,side,.43+i*.14,150+i*25);
  game.enemies.push(makeEnemy(game,i?'fighter':'scout',pos.x,pos.y,'central-funded'));
 }
 s.pendingRaid=null;s.raids++;s.nextRaid=game.time+90;
 centralEvent(s,'central-raid',game.time);
 game.notice('Местный патруль прибыл. Разрушение грузовой цепочки сократит такие вылеты.',5);
 return true;
}
// Replace one ambient encounter, respect its pressure cap, and spend one
// delivered cargo. A warning always precedes the arrival, including on return.
export function spawnRegionalRaid(game,director){
 const s=game.world.regionalSupply,raid=s?.pendingRaid;
 if(!raid?.announced||game.time<raid.readyAt||Math.hypot(game.player.x,game.player.y)>70000||
  !['amethyst','amber'].includes(regionAt(game.player.x,game.player.y).id)||
  game.enemies.length+3>Math.min(RULES.maxEnemies,director.cap))return false;
 const cam=game.camera(),origin=game.world.stations.get(SUPPLY.militaryId);
 const dx=origin.x-game.player.x,dy=origin.y-game.player.y;
 const side=Math.abs(dx)>Math.abs(dy)?(dx>0?1:0):(dy>0?3:2);
 ++game.groupSerial;let leader=null;
 for(let i=0;i<3;i++){
  const pos=spawnOutside(cam,side,.5+(i-1)*.11,170+i*12);
  const e=makeEnemy(game,i?'fighter':'gunship',pos.x,pos.y,'regional-heavy',leader);
  if(!leader)leader=e;game.enemies.push(e);
 }
 s.pendingRaid=null;s.raids++;s.nextRaid=game.time+SUPPLY.raidPeriod;
 supplyEvent(s,'raid',game.time);return true;
}
export function hitRegionalCargo(game,cargo,damage,contact=null){
 if(cargo.hp<=0||!Number.isFinite(damage)||damage<=0)return;
 cargo.hp=Math.max(0,cargo.hp-damage);cargo.hit=.18;
 game.heritage.vfx.hullImpact(contact?.x??cargo.x,contact?.y??cargo.y,damage>30,contact);
 if(cargo.hp>0||!interceptSupply(game.world,cargo,game.time))return;
 game.heritage.vfx.shipExplosion(cargo.x,cargo.y,55,'#ffc47d',true);
 game.heritage.play('largeExplosion',.22,cargo);
 game.addDrop('ore',cargo.x,cargo.y,cargo.centralCargo?CENTRAL_INDUSTRY.oreReward:SUPPLY.oreReward,{source:'salvage',life:60});
 game.addDrop('data',cargo.x+14,cargo.y,cargo.centralCargo?CENTRAL_INDUSTRY.dataReward:SUPPLY.dataReward,{source:'combat',life:60});
 game.notice(cargo.centralCargo?
  'Местный груз уничтожен: сборочный пост не получит эту партию. Запас уже доставленной руды пока остаётся.':
  'Груз перехвачен. Военный узел не получит эту руду — одного тяжёлого отряда не будет. Трофеи рядом.',7);
}
export function drawRegionalWorld(game,c,cam){
 const p=game.player,s=game.world.regionalSupply;if(!s)return;
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
  CENTRAL_ROUTE.forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));c.stroke();c.restore();
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
}
