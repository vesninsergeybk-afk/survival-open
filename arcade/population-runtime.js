import {RULES,hash} from './balance.js';
import {ENEMY_TYPES} from './ai.js?v=corvette-20261110-1-trial-station-defense-20261110';
import {contourFields} from './territory-system.js';
import {POPULATION,advancePopulation,populationAlarm,
 updatePopulationMiners} from './world-population.js?v=sector-density-2-frontier-siege-1-convoy-variety-20261110';
import {FRONTIER,orderFrontierNetwork} from './enemy-frontier-network.js?v=frontier-fence-1';
import {drawIndustrialMiner,drawIndustrialConvoy,drawFrontierNetwork} from './enemy-frontier-render.js?v=frontier-art-1-convoy-variety-20261110';
import {populationConvoyTitle} from './convoy-profiles.js?v=convoy-variety-20261110';

const TAU=Math.PI*2;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const inView=(x,y,cam,pad=150)=>x>=cam.x-pad&&x<=cam.x+cam.w+pad&&
 y>=cam.y-pad&&y<=cam.y+cam.h+pad;
// Industrial patrols have their own contact budget. Ease this as well as the
// regular encounter director so early colony traffic cannot restore the crowd.
export function populationCombatLimit(time,level=1){
 const stage=Math.max(1,Number(level)||1);
 const full=Math.min(RULES.maxEnemies,POPULATION.activeLimit,18+8*(stage-1));
 const recovery=Math.max(0,Math.min(1,(time-155)/50));
 return Math.max(1,Math.round(full*(.9+.1*recovery)));
}
const hostile=(world,id)=>{const s=world.stations.get(id);
 return !!s?.enemy&&!s.captured&&!s.suppressed&&s.hp>0;};
const centerAt=(sortie,time)=>{
 const progress=Math.max(0,Math.min(1,(time-sortie.launchedAt)/Math.max(1,sortie.returnAt-sortie.launchedAt)));
 const out=progress<=.5?progress*2:(1-progress)*2;
 return {x:sortie.x+(sortie.toX-sortie.x)*out,y:sortie.y+(sortie.toY-sortie.y)*out};
};
export function rememberPopulationShip(enemy){
 if(!enemy?.populationSortieId||!Number.isInteger(enemy.populationSlot))return false;
 const manifest=enemy.populationManifest;
 if(!manifest?.[enemy.populationSlot])return false;
 const slot=manifest[enemy.populationSlot];
 slot.hp=enemy.converted?0:Math.max(0,Math.min(slot.maxHp,enemy.hp));
 enemy.populationManifest=null;
 return true;
}
function planSortie(world,c,time,alarm=false){
 const needed=alarm?Math.min(14,c.ready):Math.min(c.fortress?16:10,c.ready);
 if(needed<5||!hostile(world,c.id+':hangar'))return null;
 const serial=++world.population.serial,seed=world.population.seed;
 const neighbor=world.population.colonies.find(q=>q.region===c.region&&
  q.index===(c.index+2)%POPULATION.coloniesPerRegion);
 const angle=hash(serial,c.index,seed)*TAU;
 const target=alarm?{x:c.reportedX,y:c.reportedY}:
  {x:c.x+Math.cos(angle)*1300+(neighbor.x-c.x)*.32,
   y:c.y+Math.sin(angle)*1300+(neighbor.y-c.y)*.32};
 const ships=Array.from({length:needed},(_,i)=>{
  const type=i%7===0&&c.tier>=3?'gunship':i%6===3&&c.tier>=3?'healer':
   i%3===1?'flanker':i%4===0?'scout':'fighter';
  const hp=ENEMY_TYPES[type].hp*(1+.12*(c.tier-1));
  return {type,hp,maxHp:hp};
 });
 c.ready-=needed;c.patrols++;
 const sortie={id:c.id+':sortie:'+serial,serial,kind:alarm?'alarm':'patrol',
  x:c.x,y:c.y,toX:target.x,toY:target.y,launchedAt:time,
  returnAt:time+(alarm?72:90),ships};
 c.sorties.push(sortie);
 c.patrolCooldown=time+(alarm?19:POPULATION.patrolCooldown);
 return sortie;
}
function createShip(game,c,sortie,slot,position){
 const stored=sortie.ships[slot],def=ENEMY_TYPES[stored.type];
 const offset=slot*2.3999632297,radius=35+Math.floor(slot/5)*46;
 const ship={serial:++game.enemySerial,group:game.groupSerial,type:stored.type,
  x:position.x+Math.cos(offset)*radius,y:position.y+Math.sin(offset)*radius,
  vx:0,vy:0,r:stored.type==='gunship'?22:14,hp:stored.hp,maxHp:stored.maxHp,
  damage:def.dmg,think:.1,fire:1.8,state:'hunt',commitUntil:0,
  target:game.player,angle:0,hit:0,expAwarded:false,
  scenario:sortie.kind==='alarm'?'population-intercept':'population-patrol',
  populationSortieId:sortie.id,populationSlot:slot,
  populationColonyId:c.id,populationManifest:sortie.ships,
  _patrolRoute:{x:sortie.toX,y:sortie.toY},
  protect:null,entryPortalPending:false};
 if(sortie.kind==='alarm')ship._awarenessDispatch={x:sortie.toX,y:sortie.toY,at:game.time};
 return ship;
}
/** The economy advances everywhere. Full ship AI exists only near the pilot. */
export function updatePopulationWorld(game,dt){
 const world=game.world,state=world.population;
 if(!state)return;
 const events=advancePopulation(world,game.time);
 const clock=Math.floor(game.time),fresh=clock>Math.floor(game.time-dt);
 if(fresh){
  for(const event of events){
   const c=state.colonies.find(q=>q.id===event.colonyId);
   if(!c||distance(c,game.player)>2200)continue;
   const nearby=world.stations.get(c.id+':'+(event.kind==='build'?'factory':'relay'));
   if(!nearby?.discovered)continue;
   if(event.kind==='alarm')game.notice('Ретранслятор передал координаты: из ангара поднимается перехват.',4);
   else if(event.kind==='build')game.notice('На вражеской верфи собраны три новых корабля.',3);
  }
  for(const c of state.colonies){
   for(const sortie of c.sorties){
    if(game.time<sortie.returnAt||distance(centerAt(sortie,game.time),game.player)<1850)continue;
    const active=game.enemies.some(e=>e.populationSortieId===sortie.id&&e.hp>0);
    if(active){sortie.returnAt=game.time+15;continue;}
    c.ready=Math.min(POPULATION.maxReserve,c.ready+sortie.ships.filter(s=>s.hp>0).length);
    sortie.completed=true;
   }
   c.sorties=c.sorties.filter(s=>!s.completed);
   if(c.alarmUntil>game.time&&game.time>=(c.patrolCooldown||0))
    planSortie(world,c,game.time,true);
   else if(game.time>=(c.patrolCooldown||0)&&c.sorties.length<3)
    planSortie(world,c,game.time,false);
  }
  if(clock%7===0){
   const newFields=contourFields(world);
   for(const c of state.colonies){
    if(!hostile(world,c.id+':relay'))continue;
    for(const field of newFields){
     if(distance(c,field.center)>POPULATION.radioRadius)continue;
     const wall=orderFrontierNetwork(world,c,field.center,game.time);
     if(wall&&distance(c,game.player)<4600){
      game.notice('ВРАГ УКРЕПЛЯЕТ ГРАНИЦУ! Отмечено строительство энергетических буёв напротив вашего контура.',6);
      game.heritage?.play?.('orbitalWarning',.6,c);
     }
     if(c.respondedToFields.includes(field.id))continue;
     c.respondedToFields.push(field.id);
     if(c.respondedToFields.length>32)c.respondedToFields.shift();
     populationAlarm(world,field.center.x,field.center.y,game.time,'contour-expansion');
    }
   }
  }
 }
 // Pure-economy and world-map callers have no camera or active combat loop.
 // They still advance production and alarms, but never materialize ships.
 if(typeof game.camera!=='function'||!Array.isArray(game.enemies))return;
 // Leave tactical headroom for paid authored raids, especially in a level-1
 // run. Higher-level pilots can face the full 160-ship hostile contact bubble.
 const cam=game.camera(),limit=populationCombatLimit(game.time,game.player?.level);
 if(game.enemies.length<limit){
  const candidates=[];
  for(const c of state.colonies)for(const sortie of c.sorties){
   const pos=centerAt(sortie,game.time),d=distance(pos,game.player);
   if(d<Math.max(cam.w,cam.h)*.78+800)candidates.push({c,sortie,pos,d});
  }
  candidates.sort((a,b)=>a.d-b.d);
  for(const {c,sortie,pos} of candidates){
   if(game.enemies.length>=limit)break;
   const present=new Set(game.enemies.filter(e=>e.populationSortieId===sortie.id&&
    e.hp>0).map(e=>e.populationSlot));
   ++game.groupSerial;
   for(let i=0;i<sortie.ships.length&&game.enemies.length<limit;i++){
    if(present.has(i)||sortie.ships[i].hp<=0)continue;
    game.enemies.push(createShip(game,c,sortie,i,pos));
   }
  }
 }
 if(fresh){
  const noisy=game.miningNoise>25;
  for(const c of state.colonies){
   const d=distance(c,game.player);
   if(d>POPULATION.alarmRadius+(noisy?950:0)||
    game.time-c.lastAlarmSent<16)continue;
   c.lastAlarmSent=game.time;
   populationAlarm(world,game.player.x,game.player.y,game.time,noisy?'mining':'sighting');
  }
 }
  // Orbital batteries are fixed to the actually powered buoys. They do not
  // invent an offscreen fleet, and their shots remain dodgeable projectiles.
  for(const c of state.colonies){
   if(!c.fronts?.length||distance(c,game.player)>3600)continue;
   const relay=world.stations.get(c.id+':relay');
   if(!relay?.enemy||relay.hp<=0||relay.suppressed)continue;
   for(const front of c.fronts)for(const buoy of front.nodes){
    buoy.hit=Math.max(0,(buoy.hit||0)-dt);
    if(buoy.hp<=0||buoy.slot%2!==0||distance(buoy,game.player)>1080)continue;
    if(!Number.isFinite(buoy.nextShotAt))buoy.nextShotAt=game.time+1.2+buoy.slot*.31;
    if(game.time<buoy.nextShotAt)continue;
    buoy.nextShotAt=game.time+4.2+buoy.slot*.19;
    if(game.enemyShot&&game.enemyShot(buoy.x,buoy.y,game.player.x+game.player.vx*.34,
      game.player.y+game.player.vy*.34,16+c.tier*2,{speed:385,r:7})!==false){
     buoy.fireGlowUntil=game.time+.38;
     if(game.time>(c.lastFrontierAlarmAt||0)){
      c.lastFrontierAlarmAt=game.time+32;
      populationAlarm(world,game.player.x,game.player.y,game.time,'frontier-contact');
     }
    }
   }
  }
 for(const c of state.colonies){
  if(distance(c,game.player)>3500)continue;
  for(const miner of c.miners)miner.hit=Math.max(0,(miner.hit||0)-dt);
 }
 for(const cargo of state.convoys){
  if(distance(cargo,game.player)<3500)cargo.hit=Math.max(0,(cargo.hit||0)-dt);
 }
}
export function drawPopulationWorld(game,ctx,cam){
 const state=game.world.population;
 if(!state)return;
 const time=game.time,zoom=Math.max(.62,Math.min(1.45,1/(game.cameraZoom||1)));
 for(const colony of state.colonies){
  // Outlying fence sections can be visible even when the industrial center
  // is three thousand units outside the viewport.
  if(colony.fronts?.length&&inView(colony.x,colony.y,cam,
   FRONTIER.radius+FRONTIER.spacing*(FRONTIER.count-1)/2+200))
   drawFrontierNetwork(game,ctx,cam,colony);
  if(!inView(colony.x,colony.y,cam,1900))continue;
  const stations=colony.buildings.map(b=>game.world.stations.get(b.id));
  const alive=stations.filter(s=>s?.enemy&&s.hp>0);
  if(!alive.length)continue;
  ctx.save();ctx.globalAlpha=.52;ctx.lineWidth=2;
  ctx.strokeStyle=colony.fortress?'#ff657e':'#dd9869';
  for(let i=0;i<stations.length;i++){
   const a=stations[i],b=stations[(i+1)%stations.length];
   if(!a?.enemy||!b?.enemy)continue;
   ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  ctx.globalAlpha=.9;
  for(const station of alive){
   const role=station.strategicRole,phase=time*.7+(station.x+station.y)*.001;
   ctx.strokeStyle=role==='population-extractor'?'#ffca73':
    role==='population-factory'?'#c99aff':
    role==='population-relay'?'#9ee8ff':'#ff947b';
   ctx.lineWidth=2.2;ctx.beginPath();ctx.arc(station.x,station.y,
    role==='population-extractor'?115+Math.sin(phase)*13:125,phase,phase+Math.PI*1.28);
   ctx.stroke();
   if(role==='population-extractor'){
    ctx.globalAlpha=.24+.18*Math.abs(Math.sin(time*1.5));
    for(let j=0;j<3;j++){
     ctx.beginPath();ctx.arc(station.x,station.y,160+j*55+(time*40)%55,0,TAU);ctx.stroke();
    }
    ctx.globalAlpha=.9;
   }
   if(role==='population-factory'&&colony.buildQueued){
    const progress=Math.max(0,Math.min(1,1-(colony.buildUntil-time)/POPULATION.buildSeconds));
    ctx.strokeStyle='#ffc3f1';ctx.lineWidth=7;
    ctx.beginPath();ctx.arc(station.x,station.y,151,-Math.PI/2,-Math.PI/2+TAU*progress);ctx.stroke();
   }
  }
  const extractor=stations.find(s=>s?.strategicRole==='population-extractor');
  // A single continuous render-time update prevents one-second orbital jumps.
  if(extractor?.enemy)updatePopulationMiners(game.world,colony,time);
  if(extractor?.enemy)for(const miner of colony.miners||[]){
   if(miner.hp<=0||!inView(miner.x,miner.y,cam,100))continue;
   ctx.save();ctx.strokeStyle='#ffc17b';ctx.globalAlpha=.22+.19*Math.abs(Math.sin(time*2+miner.slot));
   ctx.lineWidth=2.5;ctx.setLineDash([8,12]);ctx.beginPath();
   ctx.moveTo(extractor.x,extractor.y);ctx.lineTo(miner.x,miner.y);ctx.stroke();ctx.restore();
   drawIndustrialMiner(ctx,miner,time,extractor);
  }
  if(colony.fortress&&colony.shield){
   const shield=colony.shield,breached=shield.breachUntil>time;
   for(const seg of shield.segments){
    if(seg.hp<=0||breached)continue;
    ctx.strokeStyle='#f678ef';ctx.globalAlpha=.24+seg.hp/seg.maxHp*.44;
    ctx.lineWidth=11;ctx.beginPath();ctx.arc(colony.x,colony.y,1430,
     seg.angle-Math.PI/3,seg.angle+Math.PI/3);ctx.stroke();
   }
   ctx.globalAlpha=1;
  }
  ctx.restore();
  if(alive.some(s=>s.discovered)&&inView(colony.x,colony.y,cam,250)){
   ctx.save();ctx.font='bold '+Math.round(13*zoom)+'px system-ui';
   ctx.textAlign='center';ctx.fillStyle='#ffe6d2';
   ctx.fillText(colony.fortress?'ВОЕННАЯ ЦИТАДЕЛЬ · ЩИТ':
    'ВРАЖЕСКАЯ КОЛОНИЯ · '+colony.ready+' В РЕЗЕРВЕ',colony.x,colony.y-1700);
   ctx.restore();
  }
 }
 for(const cargo of state.convoys){
  if(!inView(cargo.x,cargo.y,cam,110))continue;
  drawIndustrialConvoy(ctx,cargo,time);
  ctx.save();ctx.textAlign='center';ctx.fillStyle='#ffe5bc';
  ctx.font='bold '+Math.round(11*zoom)+'px system-ui';
  const labelY=cargo.y-Math.max(70,cargo.r*1.85);
  ctx.fillText(populationConvoyTitle(cargo).toUpperCase(),cargo.x,labelY);
  ctx.fillStyle='#ffb886';ctx.fillRect(cargo.x-35,labelY+8,70*cargo.hp/cargo.maxHp,4);
  ctx.restore();
 }
}
