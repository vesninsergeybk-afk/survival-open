import {CONTOUR_TRIALS,ensureTrialLedger,pendingContourTrials,completeContourTrial,
 planContourTrial} from './contour-trials.js';
import {contourFields,fieldAt} from './territory-system.js';
import {spawnOutside,dist,RULES} from './balance.js';
import {ENEMY_TYPES} from './ai.js';
import {recordWorldFeedback} from './world-feedback.js';

const nearby=(a,b,r)=>dist(a,b)<r;
function available(game,entry){
 if(game.paused||game.dead||!nearby(game.player,entry,CONTOUR_TRIALS.engageRadius))return false;
 if(game.operation?.id==='relay-defense'&&game.operation.phase!=='complete')return false;
 if(game.operation?.id==='carrier-interception'&&game.operation.phase!=='complete')return false;
 return !!fieldAt(game.world,entry.x,entry.y);
}

function spawnTrialWave(game,event){
 const wave=event.plan.waves[event.waveIndex+1];
 if(!wave)return false;
 // An already crowded battlefield postpones the next wave. Do not bypass
 // the overall enemy budget or bury a low-end mobile GPU under extra ships.
 if(game.enemies.filter(e=>e.hp>0).length>Math.min(46,RULES.maxEnemies-18))return false;
 event.waveIndex++;
 const total=Object.values(wave).reduce((n,value)=>n+value,0);
 const group=++game.groupSerial,cam=game.camera();let i=0,scoutCount=0;
 event.waveIds=[];event.defeatedIds??=new Set();
 const pincer=event.plan.variants.some(v=>v.id==='pincer');
 const rear=event.plan.variants.some(v=>v.id==='elite');
 const angle=game.player.angle||0;
 const rearSide=Math.abs(Math.cos(angle))>Math.abs(Math.sin(angle))?
  (Math.cos(angle)>0?0:1):(Math.sin(angle)>0?2:3);
 for(const [type,count] of Object.entries(wave))for(let j=0;j<count;j++){
  const def=ENEMY_TYPES[type];if(!def)continue;
  // A small subset of IRIS scouts answer the new field's EM pulse with
  // panicked high-speed dives; ordinary patrol scouts never inherit it.
  const dive=type==='scout'&&scoutCount++<Math.min(3,1+Math.floor((event.plan.tier-1)/5));
  const side=rear?rearSide:pincer?(i%2===0?0:1):
   (event.waveIndex+i+event.entry.id)%4;
  const xy=spawnOutside(cam,side,.18+((i*7+event.entry.id)%13)/20,150+i*8);
  const tier=event.plan.tier,hp=def.hp*(1+.085*(tier-1));
  const enemy={serial:++game.enemySerial,group,type,x:xy.x,y:xy.y,vx:0,vy:0,
   r:type==='gunship'?22:14,hp,maxHp:hp,damage:def.dmg*(1+.035*(tier-1)),
   think:.15+(i%5)*.05,fire:.8+(i%4)*.17,state:'hunt',
   commitUntil:0,target:game.player,angle:0,hit:0,
   // Trial rewards are paid once on victory. Retreating and restarting waves
   // must not become an infinite source of combat XP or free alloy.
   expAwarded:true,trialId:event.entry.id,scenario:'contour-trial',protect:null,
   _trialDiveEnabled:dive,_trialDiveTier:tier,
   entryPortalPending:type==='gunship'&&!game.heavyPortalShown,
   _patrolRoute:null};
  game.enemies.push(enemy);i++;
  event.waveIds.push(enemy.serial);
 }
 event.phase='wave';
 if(!Number.isFinite(event.nextStrikeAt))
  event.nextStrikeAt=game.time+3.6;
 game.notice?.('КОНТРАТАКА НА НОВЫЙ ТРЕУГОЛЬНИК · волна '+
  (event.waveIndex+1)+'/'+event.plan.waves.length+' · '+total+' целей.'+
  (scoutCount?' Зрачки готовят резкие таранные рывки!':' Уклоняйтесь от орбитального огня!'),4.5);
 game.heritage?.play?.('orbitalWarning',.9,game.player);
 return true;
}

function scheduleTrialStrike(game,event){
 if(event.phase!=='wave')return;
 const plan=event.plan,p=game.player;
 const aim=Math.atan2(p.vy||0,p.vx||0)+.55;
 for(let i=0;i<plan.strikeCount;i++){
  const offset=plan.strikeCount===2?(i===0?-115:115):45;
  const x=p.x+(p.vx||0)*.7+Math.cos(aim)*offset;
  const y=p.y+(p.vy||0)*.7+Math.sin(aim)*offset;
  const zone={x,y,r:plan.tier>=9?78:66,fuse:plan.tier>=9?2:2.5,
   fuseStart:plan.tier>=9?2:2.5,ttl:.3,trialId:event.entry.id};
  game.zones.push(zone);
  game.heritage?.play?.('orbitalWarning',.95,zone);
 }
 event.nextStrikeAt=game.time+plan.strikeInterval;
}

function disengage(game,event,reason){
 game.enemies=game.enemies.filter(e=>e.trialId!==event.entry.id);
 game.zones=game.zones.filter(z=>z.trialId!==event.entry.id);
 game.zoneClock=Math.max(game.zoneClock||0,5);
 game.contourTrial=null;
 game.notice?.(reason,4.5);
}

function finishTrial(game,event){
 if(!completeContourTrial(game.world,event.entry.id)){
  game.contourTrial=null;return;
 }
 // Nothing hostile should explode AFTER the victory banner and the
 // reopening of the vortex; the current encounter has actually ended.
 game.zones=game.zones.filter(zone=>zone.trialId!==event.entry.id);
 const previousLevel=game.player.level;
 const gained=14+event.plan.tier*7;
 game.awardExperience?.(gained);
 game.contourFeedback={title:'Территория стабилизирована',
  text:'Испытание '+event.plan.tier+'/12 пройдено. Воронка и доставка флюкса запущены.',
  at:game.time};
 game.rewardNotice?.('КОНТУР СТАБИЛИЗИРОВАН · +'+gained+
  ' опыта. Воронка открыта, добыча флюкса начинается!',previousLevel,6);
 const field=fieldAt(game.world,event.entry.x,event.entry.y),core=field?.center||event.entry;
 if(field){
  game.contourBirths=[...(game.contourBirths||[]).filter(b=>b.id!==field.id),
   {id:field.id,x:core.x,y:core.y,at:game.time}];
  for(const id of field.vertices.slice(0,3)){
   const station=game.world.stations.get(id);
   if(station)game.flash?.(station.x,station.y,core.x,core.y,'#a6ffeb');
  }
 }
 if(dist(core,event.entry)>65)game.flash?.(event.entry.x,event.entry.y,core.x,core.y,'#a6ffeb');
 game.heritage?.vfx?.nova?.(core.x,core.y,175,'cyan');
 game.heritage?.play?.('upgrade',.8,event.entry);
 recordWorldFeedback(game,{key:'trial-victory:'+event.entry.id,kind:'industry',
  label:'КОНТУР ЗАЩИЩЁН',cause:'Пилот отразил нападение на новую территорию',
  effect:'Энергетическая воронка стабилизировалась; сборщики могут доставлять флюкс',
  x:event.entry.x,y:event.entry.y});
 game.contourVisualAt=-Infinity;
 game.zoneClock=Math.max(game.zoneClock||0,5);
 game.contourTrial=null;
}

/** Advance one local encounter. Remote fields wait without taking damage;
 * another territory never starts until the first battle is resolved. */
export function updateContourTrials(game,dt){
 const ledger=ensureTrialLedger(game.world);
 if(!ledger||game.dead||game.paused)return;
 let event=game.contourTrial;
 if(!event){
  const entry=pendingContourTrials(game.world).find(e=>available(game,e));
  if(!entry)return;
  event={entry,plan:planContourTrial(entry.tier,entry.id),phase:'warning',
   startedAt:game.time,
   waveIndex:-1,nextWaveAt:game.time+CONTOUR_TRIALS.warningSeconds,
   nextStrikeAt:Infinity,outsideFor:0};
  game.contourTrial=event;
  game.notice?.('КОНТУР ЗАМКНУТ · вражеская сеть засекла энергетический всплеск! '+
   'Контратака '+entry.tier+'/12 · рекомендован уровень '+
   event.plan.recommendedLevel+'+. Защитите новую территорию!',5);
  game.heritage?.vfx?.nova?.(entry.x,entry.y,120,'red');
  game.heritage?.play?.('orbitalWarning',1.2,entry);
  return;
 }
 if(!ledger.entries.includes(event.entry)||!fieldAt(game.world,event.entry.x,event.entry.y)){
  disengage(game,event,'Опорная сеть разорвана. Испытание возобновится после восстановления связи.');return;
 }
 event.outsideFor=nearby(game.player,event.entry,CONTOUR_TRIALS.retreatRadius)?0:
  event.outsideFor+dt;
 if(event.outsideFor>=CONTOUR_TRIALS.retreatSeconds){
  disengage(game,event,'Вы отошли от контура. Станции сохранены; испытание можно повторить позже.');return;
 }
 if(event.phase==='warning'||event.phase==='rest'){
  if(game.time>=event.nextWaveAt&&!spawnTrialWave(game,event))
   event.nextWaveAt=game.time+1.2;
  return;
 }
 if(event.phase!=='wave')return;
 if(game.time>=event.nextStrikeAt)scheduleTrialStrike(game,event);
 // Never count a ship that vanished past the camera as a kill. The ordinary
 // enemy culler may remove it during retreat; only an actual death or a
 // successful conversion clears a wave target.
 for(const serial of event.waveIds||[]){
  if(event.defeatedIds.has(serial))continue;
  const enemy=game.enemies.find(e=>e.serial===serial&&e.trialId===event.entry.id);
  if(!enemy){
   disengage(game,event,'Противник вышел из боя. Контур остался нестабильным — вернитесь для новой попытки.');
   return;
  }
  if(enemy.hp<=0||enemy.converted)event.defeatedIds.add(serial);
 }
 if((event.waveIds||[]).some(serial=>!event.defeatedIds.has(serial)))return;
 if(event.waveIndex+1>=event.plan.waves.length){finishTrial(game,event);return;}
 event.phase='rest';event.nextWaveAt=game.time+event.plan.intermission;
 game.notice?.('Волна отражена! Следующее нападение через '+
  Math.ceil(event.plan.intermission)+' с.',event.plan.intermission);
}
