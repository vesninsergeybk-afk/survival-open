import {warFronts,warFront,FRONT_KEYS} from './war-fronts.js?v=campaign-1-repair-qa-1';
import {firstRockImpact} from './terrain.js?v=arcade-belt-26';
import {ensureStationDefense,defenseLinked} from './network-defense.js?v=network-defense-4';
import {baseNames} from './balance.js?v=arcade-balanced-bases-30';

export const STATION_INTERDICTION=Object.freeze({memory:180,radioSpeed:900,reportDelay:3,
 observationPeriod:1,observersPerTick:12,orderCooldown:95,missionDuration:125,
 range:330,charge:7,cooldown:5,suppression:14,interruptDelay:3});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const num=(v,a=0,b=1e9)=>Number.isFinite(v)&&v>=a&&v<=b;
const enc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const createCommandState=()=>({version:1,nextObservation:0,cursor:0,serial:0,
 reports:[],nextOrders:{},completed:[],victoryAt:null});
const point=p=>p&&num(p.x,-1e9,1e9)&&num(p.y,-1e9,1e9);
export function commandStateValid(s,time){
 return s===undefined||!!s&&s.version===1&&num(s.nextObservation)&&
  Number.isSafeInteger(s.cursor)&&num(s.cursor)&&Number.isSafeInteger(s.serial)&&num(s.serial)&&
  s.nextOrders&&Object.keys(s.nextOrders).length<=4&&
  Object.entries(s.nextOrders).every(([k,t])=>FRONT_KEYS.includes(k)&&num(t))&&
  Array.isArray(s.completed)&&new Set(s.completed).size===s.completed.length&&
  s.completed.every(k=>FRONT_KEYS.includes(k))&&
  (s.victoryAt===null||num(s.victoryAt,0,time))&&
  Array.isArray(s.reports)&&s.reports.length<=12&&s.reports.every(r=>
   FRONT_KEYS.includes(r.front)&&typeof r.stationId==='string'&&r.stationId.length<100&&
   point(r)&&num(r.seenAt,0,time)&&num(r.receivedAt,r.seenAt,r.seenAt+20));
}
export function stationRaidValid(o,time){
 return o===undefined||o===null||!!o&&FRONT_KEYS.includes(o.front)&&
  typeof o.stationId==='string'&&o.stationId.length<100&&point(o)&&
  Number.isSafeInteger(o.id)&&num(o.id,1)&&num(o.issuedAt,0,time)&&
  num(o.expiresAt,o.issuedAt,o.issuedAt+STATION_INTERDICTION.missionDuration)&&
  num(o.nextPulse)&&num(o.interruptUntil)&&
  (o.chargeAt===null||num(o.chargeAt,0,time))&&typeof o.announced==='boolean';
}

function lineClear(world,a,b){
 const d=distance(a,b),rocks=world.nearbyRocks((a.x+b.x)/2,(a.y+b.y)/2,d/2+70);
 return !firstRockImpact(a.x,a.y,b.x,b.y,rocks,0,b);
}
function canObserveStation(game,e,b){
 const d=distance(e,b);if(d>290)return false;
 const speed=Math.hypot(e.vx||0,e.vy||0);
 if(d>88&&speed>24&&((b.x-e.x)*e.vx+(b.y-e.y)*e.vy)/(speed*Math.max(1,d))<-.2)return false;
 return lineClear(game.world,e,b);
}
export function updateStrategicCommand(game){
 const world=game.world,root=world?.regionalSupply;if(!root)return;
 const now=game.time,s=root.command??=createCommandState();
 let changed=false;
 for(const b of world.stations.values()){
  if(b.suppressed&&now>=b.suppressedUntil){
   b.suppressed=false;changed=true;
   if(b.discovered)game.notice?.((b.title||'Станция')+': связь восстановлена. Радиоперехват и маршруты снова доступны.',5);
  }
 }
 if(changed){game.defenseTopology=null;game.worldVisualLast=-Infinity;}
 const fronts=warFronts(world);
 const fresh=fronts.filter(f=>f.outcome&&f.known&&!s.completed.includes(f.key));
 for(const f of fresh)s.completed.push(f.key);
 if(fronts.length===4&&fronts.every(f=>f.outcome)&&s.victoryAt===null){
  s.victoryAt=now;
  game.notice?.('Цель прохождения достигнута: четыре промышленные сети больше не выпускают отряды. Закрепите результат стыковкой. Мир остаётся открыт для исследования.',9);
 }else if(fresh.some(f=>f.key!=='home'))game.notice?.('Промышленная сеть подавлена. Регион стал спокойнее; на карте можно выбрать следующую цель.',6);
 if(now<s.nextObservation)return;
 s.nextObservation=now+STATION_INTERDICTION.observationPeriod;
 s.reports=s.reports.filter(r=>now-r.seenAt<=STATION_INTERDICTION.memory);
 const receivers=fronts.filter(f=>f.depot?.enemy);
 const stations=[...world.stations.values()].filter(b=>b.active&&!b.enemy&&['lab','carrier'].includes(b.type));
 const enemies=game.enemies||[];
 if(!enemies.length||!stations.length)return;
 const count=Math.min(enemies.length,STATION_INTERDICTION.observersPerTick);
 for(let i=0;i<count;i++){
  const e=enemies[(s.cursor+i)%enemies.length];
  if(e.hp<=0||e.converted||e.regionalCargo||e.interceptCargo||now<(e.stasisUntil||0))continue;
  const receiver=receivers.map(f=>({f,d:Math.min(...[f.source,f.depot].filter(b=>b?.enemy).map(b=>distance(b,e)))}))
   .filter(x=>x.d<=x.f.radio).sort((a,b)=>a.d-b.d)[0];
  if(!receiver)continue;
  const b=stations.filter(b=>distance(e,b)<=290&&canObserveStation(game,e,b))
   .sort((a,b)=>(a.type==='lab'?0:1)-(b.type==='lab'?0:1)||distance(e,a)-distance(e,b))[0];
  if(!b)continue;
  const prior=s.reports.find(r=>r.stationId===b.id&&r.front===receiver.f.key);
  if(prior&&now-prior.seenAt<15)continue;
  if(prior)s.reports.splice(s.reports.indexOf(prior),1);
  s.reports.push({front:receiver.f.key,stationId:b.id,x:b.x,y:b.y,seenAt:now,
   receivedAt:now+STATION_INTERDICTION.reportDelay+receiver.d/STATION_INTERDICTION.radioSpeed});
  s.reports=s.reports.slice(-12);
 }
 s.cursor=(s.cursor+count)%Math.max(1,enemies.length);
}

// Only an already financed industrial ship can receive this order. A report
// must arrive through a real enemy transmitter; no location is read from the
// player's laboratory network or its passive listening footprint.
export function assignStationInterdiction(game,ship,key){
 const front=warFront(game.world,key),s=game.world.regionalSupply?.command,now=game.time;
 const scenarios={home:['central-funded'],north:['regional-heavy'],
  azure:['azure-funded','azure-last-reserve'],teal:['teal-funded','teal-last-reserve']};
 if(!front?.depot?.enemy||!s||!ship||ship.hp<=0||ship.converted||ship.stationRaid||
   !scenarios[key]?.includes(ship.scenario)||!game.enemies.includes(ship)||
   (s.nextOrders[key]||0)>now||
   !(front.pool?.intercepted>0||front.source?.captured))return false;
 const report=s.reports.filter(r=>r.front===key&&r.receivedAt<=now&&now-r.seenAt<=STATION_INTERDICTION.memory)
  .sort((a,b)=>b.seenAt-a.seenAt)[0];
 if(!report)return false;
 ship.stationRaid={id:++s.serial,front:key,stationId:report.stationId,x:report.x,y:report.y,
  issuedAt:now,expiresAt:now+STATION_INTERDICTION.missionDuration,
  chargeAt:null,nextPulse:now,interruptUntil:now+7,announced:false};
 ship._commsOrder=null;ship._commsIntent=null;ship._theaterOrder=null;ship._theaterIntent=null;
 s.nextOrders[key]=now+STATION_INTERDICTION.orderCooldown;
 const base=game.world.stations.get(report.stationId);
 game.notice?.('Ответ промышленной сети: оплаченный поставкой корабль направлен подавить связь станции «'+
  (base?.title||baseNames[base?.type]||'Узел')+'». Маршрут для защиты доступен на карте; прицельный рельс / ион сорвут подготовку.',8);
 return true;
}

export function interruptStationInterdiction(game,enemy,source){
 const o=enemy?.stationRaid;
 if(!o||enemy.hp<=0||o.chargeAt===null||!['precision','ion'].includes(source))return false;
 o.chargeAt=null;o.interruptUntil=game.time+STATION_INTERDICTION.interruptDelay;
 game.notice?.('Подготовка подавляющего импульса сорвана. Уничтожьте носитель, пока он восстанавливает наведение.',4);
 return true;
}
export function updateStationInterdiction(game,e,dt){
 const o=e.stationRaid;if(!o)return false;
 e._commsIntent=null;e._gunAiming=null;e._theaterIntent=null;
 if(e.hp<=0||e.converted||game.time>=o.expiresAt){e.stationRaid=null;return false;}
 const base=game.world.stations.get(o.stationId),d=distance(e,o);
 // The ship travels to the last reported position and checks ownership on
 // arrival. It cannot learn a remote capture or switch targets magically.
 if(d<110&&(!base?.active||base.enemy)){e.stationRaid=null;return false;}
 if(game.time<(e.stasisUntil||0)){
  o.chargeAt=null;e.vx=0;e.vy=0;return true;
 }
 const firing=d<=STATION_INTERDICTION.range&&lineClear(game.world,e,o);
 let tx=o.x,ty=o.y;
 if(d<STATION_INTERDICTION.range&&!firing){
  const a=Math.atan2(e.y-o.y,e.x-o.x)+.7;
  tx=o.x+Math.cos(a)*270;ty=o.y+Math.sin(a)*270;
 }
 // Tactical slowing also applies to an approaching station raider. Once it
 // starts its stationary charge, this field does not interrupt it. Precision
 // rail and ion shots keep their separate, documented interrupt role.
 const tacticalSlow=Math.max(.25,Math.min(1,e._tacticalSpeed??1));
 const n=Math.hypot(tx-e.x,ty-e.y)||1,speed=firing?0:155*tacticalSlow;
 const blend=1-Math.exp(-4*dt);
 e.vx=(e.vx||0)+((tx-e.x)/n*speed-(e.vx||0))*blend;
 e.vy=(e.vy||0)+((ty-e.y)/n*speed-(e.vy||0))*blend;
 e.x+=e.vx*dt;e.y+=e.vy*dt;
 if(speed)e.angle=Math.atan2(e.vy,e.vx)+Math.PI/2;
 if(!firing||!base?.active||base.enemy){o.chargeAt=null;return true;}
 if(game.time<Math.max(o.nextPulse,o.interruptUntil))return true;
 if(o.chargeAt===null){
  o.chargeAt=game.time;
  if(!o.announced){o.announced=true;game.notice?.('Носитель готовит подавление связи станции: 7 секунд. Прицельный рельс или ионный разряд прерывают подготовку; обычное оружие может уничтожить корабль.',7);}
 }
 if(game.time-o.chargeAt<STATION_INTERDICTION.charge)return true;
 o.chargeAt=null;o.nextPulse=game.time+STATION_INTERDICTION.cooldown;
 const topology=game.world.networkTopology(),linked=defenseLinked(base,topology);
 const defense=ensureStationDefense(base,linked,game.time);
 if(defense?.charges>0&&game.time>=defense.interceptAt){
  const full=defense.charges===(linked?2:1);
  defense.charges--;defense.interceptAt=game.time+.7;
  if(full)defense.rechargeAt=game.time+(linked?13:17);
  defense.visualAt=game.time;defense.visualKind='shot';
  game.notice?.('ПВО станции отбила подавляющий импульс. Запас защитных зарядов уменьшился.',4);
 }else{
  const first=!base.suppressed;
  base.suppressed=true;base.suppressedUntil=game.time+STATION_INTERDICTION.suppression;
  game.defenseTopology=null;game.worldVisualLast=-Infinity;
  if(first)game.notice?.('Связь станции подавлена на 14 секунд: радиоперехват и связь сети прерваны. Местный ремонт работает. Уничтожьте носитель, чтобы он не повторил импульс.',7);
 }
 game.flash?.(e.x,e.y,base.x,base.y,'#eb9dff');
 game.heritage?.vfx?.nova?.(base.x,base.y,95,'violet');
 return true;
}

export function stationInterdictionCue(game){
 const e=(game.enemies||[]).find(e=>e.hp>0&&!e.converted&&e.stationRaid&&e.stationRaid.chargeAt!==null&&
  distance(e,game.player)<1600);
 if(!e)return '';
 return 'ИМПУЛЬС ПОМЕХ · '+Math.max(0,Math.ceil(STATION_INTERDICTION.charge-(game.time-e.stationRaid.chargeAt)))+
  ' С · ПРИЦЕЛЬНЫЙ РЕЛЬС / ИОН';
}
export function threatenedStations(game){
 const ids=new Set((game.enemies||[]).filter(e=>e.hp>0&&!e.converted&&
  e.stationRaid&&e.stationRaid.expiresAt>game.time).map(e=>e.stationRaid.stationId));
 return [...ids].map(id=>game.world.stations.get(id)).filter(b=>b?.discovered&&b.active&&!b.enemy);
}
export function renderStationThreats(game){
 const targets=threatenedStations(game);if(!targets.length)return '';
 return '<section class="home-conflict" aria-label="Защита станций"><span class="base-kicker">ОТВЕТ ПРОТИВНИКА</span><h3>Угроза связи станций</h3>'+
  '<p>К замеченным станциям направлены оплаченные снабжением носители помех. Можно защитить узел, перехватить носитель или продолжить свой рейд, приняв временную потерю радиосвязи.</p>'+
  targets.slice(0,2).map(b=>'<button type="button" data-act="defendStation" data-role="'+enc(b.id)+'">Защитить: '+
   enc(b.title||baseNames[b.type])+(game.player?' · '+Math.round(distance(game.player,b))+' м':'')+'</button>').join('')+'</section>';
}
export function drawStationInterdiction(game,c,cam){
 for(const b of game.world.stations.values())if(b.discovered&&b.suppressed&&
  b.x>cam.x-150&&b.x<cam.x+cam.w+150&&b.y>cam.y-150&&b.y<cam.y+cam.h+150){
  c.save();c.strokeStyle='#e99dff';c.lineWidth=2;c.setLineDash([9,7]);
  c.beginPath();c.arc(b.x,b.y,135,0,Math.PI*2);c.stroke();
  c.fillStyle='#f3beff';c.font='13px sans-serif';c.textAlign='center';
  c.fillText('СВЯЗЬ ПОДАВЛЕНА · '+Math.ceil(b.suppressedUntil-game.time)+' с',b.x,b.y-155);c.restore();
 }
 for(const e of game.enemies||[]){
  const o=e.stationRaid;
  if(!o||e.hp<=0||o.chargeAt===null||distance(e,game.player)>1600||
    !game.playerCanInspectEnemyIntent?.(e))continue;
  const ratio=Math.max(0,Math.min(1,(game.time-o.chargeAt)/STATION_INTERDICTION.charge));
  c.save();c.strokeStyle='#f1a1ff';c.lineWidth=2;c.setLineDash([7,8]);
  c.beginPath();c.moveTo(e.x,e.y);c.lineTo(o.x,o.y);c.stroke();c.setLineDash([]);
  c.beginPath();c.arc(e.x,e.y,36,-Math.PI/2,-Math.PI/2+Math.PI*2*ratio);c.stroke();
  c.fillStyle='#ffd5ff';c.font='12px sans-serif';c.textAlign='center';
  c.fillText('ПОДГОТОВКА ИМПУЛЬСА · '+Math.ceil(STATION_INTERDICTION.charge*(1-ratio))+' с',e.x,e.y-49);c.restore();
 }
}
