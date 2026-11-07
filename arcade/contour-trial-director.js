import {recordSortieIncome} from './sortie-ledger.js';
import {CONTOUR_TRIALS,ensureTrialLedger,pendingContourTrials,completeContourTrial,
 planContourTrial,trialQuota} from './contour-trials.js?v=clarity-pass-1-first-loops-1';
import {TERRITORY_BENEFITS,updateTerritoryBenefits} from './territory-benefits.js?v=first-loops-1';
import {contourFields,fieldAt} from './territory-system.js';
import {spawnOutside,dist,RULES} from './balance.js';
import {ENEMY_TYPES} from './ai.js?v=first-loops-1';
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
 const group=++game.groupSerial,cam=game.camera();let i=0,scoutCount=0;
 event.waveIds=[];event.waveTemplates=new Map();event.defeatedIds??=new Set();
 event.required=trialQuota(total,event.plan.tier);
 event.waveStartedAt=game.time;
 const pincer=event.plan.variants.some(v=>v.id==='pincer');
 const rear=event.plan.variants.some(v=>v.id==='elite');
 const angle=game.player.angle||0;
 const rearSide=Math.abs(Math.cos(angle))>Math.abs(Math.sin(angle))?
  (Math.cos(angle)>0?0:1):(Math.sin(angle)>0?2:3);
 for(const [type,count] of Object.entries(wave))for(let j=0;j<count;j++){
  const def=ENEMY_TYPES[type];if(!def)continue;
  // A small subset of IRIS scouts answer the new field's EM pulse with
  // panicked high-speed dives; ordinary patrol scouts never inherit it.
  const dive=type==='scout'&&scoutCount++<Math.min(3,
   (event.plan.tier===1?event.waveIndex:1+Math.floor((event.plan.tier-1)/5)));
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
  event.waveTemplates.set(enemy.serial,{...enemy});
 }
 event.phase='wave';
 if(!Number.isFinite(event.nextStrikeAt))
  event.nextStrikeAt=game.time+3.6;
 game.notice?.('ОБОРОНА ТРЕУГОЛЬНИКА · волна '+
  (event.waveIndex+1)+' из '+event.plan.waves.length+' · подавите '+event.required+' из '+total+' кораблей.'+
  (scoutCount?' Зрачки готовят резкие таранные рывки!':' Уклоняйтесь от орбитального огня!'),4.5);
 game.heritage?.vfx?.nova?.(event.entry.x,event.entry.y,125,'red');
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

function finishTrial(game,event){
 if(!completeContourTrial(game.world,event.entry.id)){
  game.contourTrial=null;return;
 }
 // Nothing hostile should explode AFTER the victory banner and the
 // reopening of the vortex; the current encounter has actually ended.
 game.zones=game.zones.filter(zone=>zone.trialId!==event.entry.id);
 const previousLevel=game.player.level;
 const gained=14+event.plan.tier*7;
 const alloy=20+event.plan.tier*4;
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
  // Forming the triangle prepares a dormant core. The player deliberately
  // ignites it with the same held interaction used for extraction; merely
  // passing through the territory never starts an encounter.
  const held=game.actionHeld;
  const entry=held?.kind==='contour'&&pendingContourTrials(game.world)
   .find(e=>e.id===held.target?.id&&available(game,e)&&
    nearby(game.player,e,CONTOUR_TRIALS.activationRadius));
  if(!entry){game.contourCharge=null;return;}
  if(game.contourCharge?.entryId!==entry.id)
   game.contourCharge={entryId:entry.id,elapsed:0};
  game.contourCharge.elapsed+=Math.max(0,dt);
  if(game.contourCharge.elapsed<CONTOUR_TRIALS.activationSeconds)return;
  game.contourCharge=null;
  game.actionHeld=null;
  event={entry,plan:planContourTrial(entry.tier,entry.id),phase:'warning',
   startedAt:game.time,
   waveIndex:-1,nextWaveAt:game.time+CONTOUR_TRIALS.warningSeconds,
   nextStrikeAt:Infinity,outsideFor:0};
  game.contourTrial=event;
  game.notice?.('ЯДРО АКТИВИРОВАНО · красный импульс выдал вашу позицию! '+
   'Впереди '+event.plan.waves.length+' волны атаки. Рекомендован уровень '+
   event.plan.recommendedLevel+'+. Отразите нападение!',5);
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
 for(const serial of event.waveIds||[]){
  if(event.defeatedIds.has(serial))continue;
  const enemy=game.enemies.find(e=>e.serial===serial&&e.trialId===event.entry.id);
  if(!enemy){
   const original=event.waveTemplates?.get(serial);
   if(!original)continue;
   const cam=game.camera(),side=(serial+event.entry.id)%4;
   const pos=spawnOutside(cam,side,.2+((serial*7)%11)/18,125);
   game.enemies.push({...original,...pos,vx:0,vy:0,hp:original.maxHp,
    think:.15,fire:.65,state:'hunt',entryPortalPending:false});
   continue;
  }
  if(enemy.hp<=0||enemy.converted)event.defeatedIds.add(serial);
 }
 const waveIds=event.waveIds||[],defeated=waveIds.filter(id=>event.defeatedIds.has(id)).length;
 const enough=defeated>=(event.required??trialQuota(waveIds.length,event.plan.tier));
 const timeout=game.time-event.waveStartedAt>=CONTOUR_TRIALS.maxWaveSeconds;
 if(!enough&&!timeout)return;
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
 if(event.waveIndex+1>=event.plan.waves.length){finishTrial(game,event);return;}
 event.phase='rest';event.nextWaveAt=game.time+event.plan.intermission;
 game.notice?.('Волна '+(event.waveIndex+1)+' из '+event.plan.waves.length+
  ' отражена! Оставшиеся противники отступили. Следующее нападение через '+
  Math.ceil(event.plan.intermission)+' с.',event.plan.intermission);
}
