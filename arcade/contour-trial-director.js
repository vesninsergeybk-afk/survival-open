import {recordSortieIncome} from './sortie-ledger.js';
import {CONTOUR_TRIALS,ensureTrialLedger,pendingContourTrials,readyContourTrials,prepareContourVortex,completeContourTrial,
 planContourTrial,trialQuota,trialRandom} from './contour-trials.js?v=swarm-siege-1';
import {TERRITORY_BENEFITS,updateTerritoryBenefits} from './territory-benefits.js?v=first-loops-1-triangle-defense-1';
import {contourFields,fieldAt} from './territory-system.js';
import {spawnOutside,dist,RULES} from './balance.js';
import {ENEMY_TYPES} from './ai.js?v=first-loops-1-triangle-defense-1';
import {recordWorldFeedback} from './world-feedback.js';

const nearby=(a,b,r)=>dist(a,b)<r;
function available(game,entry){
 if(game.paused||game.dead||!nearby(game.player,entry,CONTOUR_TRIALS.engageRadius))return false;
 if((game.contourTrialRetryAt||0)>game.time)return false;
 if(game.operation?.id==='relay-defense'&&game.operation.phase!=='complete')return false;
 if(game.operation?.id==='carrier-interception'&&game.operation.phase!=='complete')return false;
 return !!fieldAt(game.world,entry.x,entry.y);
}

function spawnTrialWave(game,event){
 const wave=event.plan.waves[event.waveIndex+1];
 if(!wave)return false;
 const total=Object.values(wave).reduce((n,value)=>n+value,0);
 // Remote enemies elsewhere in the sector must not block a local scripted
 // wave forever. Preserve a stricter budget in the player's visible battle.
 const nearbyEnemies=game.enemies.filter(e=>e.hp>0&&dist(e,game.player)<1550).length;
 if(nearbyEnemies>48||game.enemies.length+total>RULES.maxEnemies){
  event.blockedSince??=game.time;
  event.waitingForSpace=true;return false;
 }
 delete event.blockedSince;
 event.waitingForSpace=false;
 event.waveIndex++;
 const cam=game.spawnCamera?.()||game.camera(),random=trialRandom(event.plan.tier,event.entry.id,event.waveIndex+1);
 const roster=Object.entries(wave).flatMap(([type,count])=>Array(count).fill(type));
 // A fixed seed keeps a retried defence honest and gives each triangle a
 // different mix of flanking groups. Six ships coordinate as one IRIS wing.
 for(let i=roster.length-1;i>0;i--){const j=Math.floor(random()*(i+1));
  [roster[i],roster[j]]=[roster[j],roster[i]];}
 const formation=event.plan.formations?.[event.waveIndex+1]||'рой';
 const angle=game.player.angle||0;
 const rearSide=Math.abs(Math.cos(angle))>Math.abs(Math.sin(angle))?
  (Math.cos(angle)>0?0:1):(Math.sin(angle)>0?2:3);
 const seedSide=Math.floor(random()*4);
 const groupIds=[];let scoutCount=0;
 event.waveIds=[];event.waveTemplates=new Map();event.defeatedIds??=new Set();
 event.required=trialQuota(total,event.plan.tier);
 event.waveStartedAt=game.time;
 for(let i=0;i<roster.length;i++){
  const type=roster[i];
  const def=ENEMY_TYPES[type];if(!def)continue;
  // A small subset of IRIS scouts answer the new field's EM pulse with
  // panicked high-speed dives; ordinary patrol scouts never inherit it.
  const dive=type==='scout'&&scoutCount++<Math.min(8,3+Math.floor(event.plan.tier/2));
  const squad=Math.floor(i/6),member=i%6;
  if(groupIds[squad]===undefined)groupIds[squad]=++game.groupSerial;
  const side=formation==='окружение'?(seedSide+squad)%4:
   formation==='клещи'?(seedSide+(squad%2)*2)%4:
   formation==='авангард'?(squad===0?rearSide:(rearSide+squad%3)%4):
   (seedSide+Math.floor(squad/2))%4;
  const position=Math.max(.09,Math.min(.91,.24+(squad%3)*.23+(random()-.5)*.18));
  const xy=spawnOutside(cam,side,position,155+(squad%3)*34+member*7);
  const tier=event.plan.tier,hp=def.hp*(1+.085*(tier-1));
  const enemy={serial:++game.enemySerial,group:groupIds[squad],type,x:xy.x,y:xy.y,vx:0,vy:0,
   r:type==='gunship'?22:14,hp,maxHp:hp,damage:def.dmg*(1+.035*(tier-1)),
   think:.15+(i%5)*.05,fire:.8+(i%4)*.17,state:'hunt',
   commitUntil:0,target:game.player,angle:0,hit:0,
   // Trial rewards are paid once on victory. Retreating and restarting waves
   // must not become an infinite source of combat XP or free alloy.
   expAwarded:true,trialId:event.entry.id,scenario:'contour-trial',protect:null,
   _trialDiveEnabled:dive,_trialDiveTier:tier,
   entryPortalPending:type==='gunship'&&!game.heavyPortalShown,
   _patrolRoute:null};
  game.enemies.push(enemy);
  event.waveIds.push(enemy.serial);
  event.waveTemplates.set(enemy.serial,{...enemy});
 }
 event.phase='wave';
 event.nextStrikeAt=game.time+3.6;
 game.notice?.('ОБОРОНА ТРЕУГОЛЬНИКА · волна '+
  (event.waveIndex+1)+' из '+event.plan.waves.length+' · подавите '+event.required+' из '+total+' кораблей.'+
  ' Построение: '+formation+'. Орбитальные залпы уже наведены!',4.5);
 game.heritage?.play?.('orbitalWarning',.9,game.player);
 return true;
}

function scheduleTrialStrike(game,event){
 if(event.phase!=='wave')return;
 const plan=event.plan,p=game.player;
 const aim=Math.atan2(p.vy||0,p.vx||0)+.55;
 for(let i=0;i<plan.strikeCount;i++){
  const offset=plan.strikeCount===3?(i-1)*135:
   plan.strikeCount===2?(i===0?-115:115):45;
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
 game.enemies=game.enemies.filter(e=>{
  if(e.trialId!==event.entry.id)return true;
  if(e.converted){delete e.trialId;return true;}
  return false;
 });
 if(game.shots)game.shots=game.shots.filter(s=>s.trialId!==event.entry.id);
 game.zones=game.zones.filter(z=>z.trialId!==event.entry.id);
 game.zoneClock=Math.max(game.zoneClock||0,5);
 game.contourTrial=null;
 game.contourTrialRetryAt=game.time+18;
 game.notice?.(reason,4.5);
}

function finishTrial(game,entry){
 if(!completeContourTrial(game.world,entry.id))return false;
 // Nothing hostile should explode AFTER the victory banner and the
 // reopening of the vortex; the current encounter has actually ended.
 game.zones=game.zones.filter(zone=>zone.trialId!==entry.id);
 const previousLevel=game.player.level;
 const gained=14+entry.tier*7;
 const alloy=20+entry.tier*4;
 game.player.ore=(game.player.ore||0)+alloy;
 recordSortieIncome(game,'ore','operation',alloy);
 game.cockpit?.resourceGain?.(alloy,game.time);
 game.awardExperience?.(gained);
 const unlocked=TERRITORY_BENEFITS[game.world.contours.trials.completed-1];
 updateTerritoryBenefits(game,0);
 // The first field immediately demonstrates its new defensive ability.
 if(game.territorySupport.inside)
  game.player.shield=Math.max(game.player.shield||0,18);
 game.contourFeedback={title:'Территория стабилизирована',
  victory:true,alloy,xp:gained,unlocked:unlocked?.name||'',text:'+'+alloy+' сплава · +'+gained+' опыта. '+
   (unlocked?'Открыто: '+unlocked.name+'. '+unlocked.effect:'Защищённая территория расширена. Воронка и доставка флюкса запущены.'),
  at:game.time};
 game.rewardNotice?.('КОНТУР ЗАЩИЩЁН · +'+alloy+' сплава · +'+gained+
  ' опыта. '+(unlocked?unlocked.name+' теперь действует в своей территории. ':'')+
  'Воронка открыта, добыча флюкса начинается!',previousLevel,7);
 const field=fieldAt(game.world,entry.x,entry.y),core=field?.center||entry;
 if(field){
  game.contourBirths=[...(game.contourBirths||[]).filter(b=>b.id!==field.id),
   {id:field.id,x:core.x,y:core.y,at:game.time}];
  for(const id of field.vertices.slice(0,3)){
   const station=game.world.stations.get(id);
   if(station)game.flash?.(station.x,station.y,core.x,core.y,'#a6ffeb');
  }
 }
 if(dist(core,entry)>65)game.flash?.(entry.x,entry.y,core.x,core.y,'#a6ffeb');
 game.heritage?.vfx?.nova?.(core.x,core.y,175,'cyan');
 game.heritage?.play?.('upgrade',.8,entry);
 recordWorldFeedback(game,{key:'trial-victory:'+entry.id,kind:'industry',
  label:'ВОРОНКА ЗАПУЩЕНА',cause:'Пилот отразил три волны и сам запустил воронку',
  effect:'Энергетическая воронка стабилизировалась; сборщики могут доставлять флюкс',
  x:entry.x,y:entry.y});
 game.contourVisualAt=-Infinity;
 game.zoneClock=Math.max(game.zoneClock||0,5);
 game.contourTrial=null;
 return true;
}

// The last kill only opens the socket. Player input must start harvesting.
export function activateContourVortex(game,entry){
 if(!entry||entry.status!=='ready'||game.dead||game.paused||
  !fieldAt(game.world,entry.x,entry.y)||
  dist(game.player,entry)>CONTOUR_TRIALS.activationRadius)return false;
 return finishTrial(game,entry);
}

function defendContour(game,event){
 if(!prepareContourVortex(game.world,event.entry.id))return;
 game.zones=game.zones.filter(zone=>zone.trialId!==event.entry.id);
 game.contourTrial=null;
 game.contourTrialRetryAt=game.time+1;
 game.notice?.('ТРИ ВОЛНЫ ОТРАЖЕНЫ · подлетите к красному ядру и удерживайте E, чтобы запустить воронку.',7);
 game.heritage?.play?.('upgrade',.55,event.entry);
}

/** Advance one local encounter. Remote fields wait without taking damage;
 * another territory never starts until the first battle is resolved. */
export function updateContourTrials(game,dt){
 const ledger=ensureTrialLedger(game.world);
 if(!ledger||game.dead||game.paused)return;
 let event=game.contourTrial;
 if(!event){
  if(readyContourTrials(game.world).length)return; // Await the pilot's E before issuing another defence.
  const entry=pendingContourTrials(game.world).find(e=>available(game,e));
  if(!entry)return;
  event={entry,plan:planContourTrial(entry.tier,entry.id),phase:'warning',
   startedAt:game.time,
   waveIndex:-1,nextWaveAt:game.time+CONTOUR_TRIALS.warningSeconds,
   nextStrikeAt:Infinity,outsideFor:0};
  game.contourTrial=event;
  game.notice?.('КОНТУР ЗАМКНУТ · противник обнаружил новый треугольник! '+
   'Оборона: '+event.plan.waves.length+' '+(event.plan.waves.length===1?'волна':'волны')+
   ' · рекомендован уровень '+event.plan.recommendedLevel+'+. Отразите нападение!',5);
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
  if(game.time>=event.nextWaveAt&&!spawnTrialWave(game,event)){
   if(game.time-(event.blockedSince??game.time)>=CONTOUR_TRIALS.maxWaitSeconds){
    disengage(game,event,'Нападение отложено: сектор занят другим боем. Станции сохранены; вернитесь позже.');return;
   }
   event.nextWaveAt=game.time+1.2;
   if(!event.lastCrowdNotice||game.time-event.lastCrowdNotice>15){
    event.lastCrowdNotice=game.time;
    game.notice?.('Оборона треугольника: слишком много врагов рядом. Расчистите подходы — новая волна уже готова.',4);
   }
  }
  return;
 }
 if(event.phase!=='wave')return;
 if(game.time>=event.nextStrikeAt)scheduleTrialStrike(game,event);
 // Never count a ship culled beyond the camera as a kill. Restore a lost
 // participant to the approach instead of silently restarting the *entire*
 // defence and throwing away the previous completed waves.
 const liveWave=new Map(game.enemies.filter(e=>e.trialId===event.entry.id)
  .map(e=>[e.serial,e]));
 for(const serial of event.waveIds||[]){
  if(event.defeatedIds.has(serial))continue;
  const enemy=liveWave.get(serial);
  if(!enemy){
   const original=event.waveTemplates?.get(serial);
   if(!original)continue;
   if(game.enemies.length>=RULES.maxEnemies)continue;
   const cam=game.spawnCamera?.()||game.camera(),side=(serial+event.entry.id)%4;
   const pos=spawnOutside(cam,side,.2+((serial*7)%11)/18,125);
   game.enemies.push({...original,...pos,vx:0,vy:0,hp:original.maxHp,
    think:.15,fire:.65,state:'hunt',entryPortalPending:false});
   continue;
  }
  if(enemy.hp<=0||enemy.converted)event.defeatedIds.add(serial);
 }
 const waveIds=event.waveIds||[],defeated=waveIds.filter(id=>event.defeatedIds.has(id)).length;
 const enough=defeated>=(event.required??trialQuota(waveIds.length,event.plan.tier));
 const timeout=game.time-event.waveStartedAt>=(event.plan.waveSeconds||CONTOUR_TRIALS.maxWaveSeconds);
 if(!enough&&!timeout||enough&&!timeout&&
  game.time-event.waveStartedAt<CONTOUR_TRIALS.minWaveSeconds)return;
 if(timeout&&!enough){
  disengage(game,event,'Противник удержал контур. Оборона завершилась неудачей — новая попытка через 18 секунд.');
  return;
 }
 // Remaining ships disengage after heavy losses or a bounded battle. They
 // never award unearned combat resources or experience.
 if(game.shots)game.shots=game.shots.filter(s=>s.trialId!==event.entry.id);
 for(const enemy of game.enemies.filter(e=>e.trialId===event.entry.id)){
  if(enemy.converted){delete enemy.trialId;continue;}
  if(enemy.hp<=0)continue;
  enemy.trialRetreatUntil=game.time+3;
  enemy.trialRetreatFrom={x:event.entry.x,y:event.entry.y};
  enemy._trialDiveEnabled=false;enemy.expAwarded=true;
  enemy.damage=0;enemy.fire=999;
 }
 if(event.waveIndex+1>=event.plan.waves.length){defendContour(game,event);return;}
 event.phase='rest';event.nextWaveAt=game.time+event.plan.intermission;
 game.notice?.('Волна '+(event.waveIndex+1)+' из '+event.plan.waves.length+
  ' отражена! Оставшиеся противники отступили. Следующее нападение через '+
  Math.ceil(event.plan.intermission)+' с.',event.plan.intermission);
}
