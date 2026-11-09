import {theaterDestination} from './enemy-strategy.js?v=theater-1-campaign-1-theater-audit-1-repair-qa-1-mesh-1-backbone-2-mesh-strategy-v2-1';
import {updateParasitizedEnemy} from './field-evolution.js?v=parasite-clarity-1';
import {stormSeek} from './regional-storms.js?v=regions-1';
import {RULES, dist, clamp, length, outsideCamera} from './balance.js?v=arcade-network-20';
import {updateSignalIntent,canAutoTarget} from './signal-perception.js?v=arcade-perception-61-enemy-world-response-2-first-loops-1';
import {updateIrisPerception,irisSearchGoal,irisBurstThrust,irisBurstJink} from './iris-scanning.js?v=iris-inertial-scan-2';
import {irisCanSense,updateIrisSwarm,IRIS_SWARM} from './iris-swarm.js?v=iris-swarm-2';
import {irisPackDirective,irisPackMayFire,irisPackSeparation} from './iris-choreography.js?v=iris-pack-1-enemy-learning-1-enemy-comms-1-enemy-audit-3';
import {contourIrisDirective,contourIrisRushContacts} from './contour-trial-iris.js?v=contour-counterattack-1-pressure-1';
import {updateEnemyAwareness,enemyPursuitTarget,unalertedPatrolRoute} from './enemy-awareness.js?v=living-world-roaming-patrol-2-trial-focus-1';
import {radioOrderCapable} from './enemy-comms.js?v=enemy-comms-1-enemy-world-response-1-enemy-audit-5-enemy-gunnery-1-enemy-plans-1-theater-1-campaign-1-theater-audit-1-repair-qa-1-mesh-1-tactical-field-2-backbone-2-world-feedback-1-enemy-fixes-1-mesh-strategy-v2-1-mesh-response-v2-1-radio-retry-1-flux-offense-1';
import {squadRoleDestination} from './enemy-squad-plans.js?v=enemy-squad-plans-1-enemy-fixes-1-mesh-response-v2-1';
import {updateEnemyGunnery} from './enemy-gunnery.js?v=enemy-gunnery-1-opening-arc-1-enemy-fixes-1';
import {enemyRockDetour} from './enemy-navigation.js?v=enemy-nav-1';
import {tacticalDecoy} from './tactical-fields.js?v=tactical-field-2';
import {moveMote} from './mote-swarm.js?v=swarm-controls-1';
import {turretBranchRank} from './turret-growth.js';
const norm = (dx,dy) => {const m=Math.hypot(dx,dy)||1;return {x:dx/m,y:dy/m};};
const steer=(body,tx,ty,speed,dt,extra={x:0,y:0})=>{
  if(body._tacticalRepel?.until>body._tacticalNow){
    tx=body.x+body._tacticalRepel.x*240;
    ty=body.y+body._tacticalRepel.y*240;
    speed=Math.max(speed,215);extra={x:0,y:0};
  }else if(body._tacticalPull){
    tx=body._tacticalPull.x;ty=body._tacticalPull.y;extra={x:0,y:0};
  }
  const slowing=body._tacticalSpeed??1;
  speed*=slowing;extra={x:extra.x*slowing,y:extra.y*slowing};
  const dir=norm(tx-body.x,ty-body.y);
  const vx=dir.x*speed+extra.x,vy=dir.y*speed+extra.y;
  const blend=1-Math.exp(-3.8*dt);
  body.vx+=(vx-body.vx)*blend; body.vy+=(vy-body.vy)*blend;
  const m=length(body.vx,body.vy),max=speed*1.35;
  if(m>max){body.vx=body.vx/m*max;body.vy=body.vy/m*max;}
  body.x+=body.vx*dt;body.y+=body.vy*dt;
  if(m>12)body.angle=Math.atan2(body.vy,body.vx)+Math.PI/2;
};
/** Small scouts weave on approach and briefly side-slip under fire.
 * There are no dodge i-frames: player beams hit instantly and rockets home.
 * A jink changes the flight path, not the hitbox or the damage calculation.
 * Per-drone serials stagger the course changes without consuming game RNG. */
export function scoutSteering(e,game,target,speed){
  const dx=target.x-e.x,dy=target.y-e.y;
  const distance=Math.hypot(dx,dy)||1;
  const serial=Math.abs(Math.trunc(e.serial||0));
  const legSeconds=1.02+(serial%4)*.17;
  const leg=Math.floor((game.time+serial*.29)/legSeconds);
  const side=(leg+serial)%2===0?1:-1;
  // Distant patrols approach fairly directly; closer scouts make uneven,
  // alternating lateral passes. They still close in and remain hittable.
  const rangeFactor=clamp((distance-60)/165,0,1);
  let lateral=side*speed*(.12+(.30+(serial%5)*.035)*rangeFactor);
  const style=e._enemyLearning?.style;
  if(style==='diverge')lateral*=1.27;
  else if(style==='cutoff')lateral*=.69;
  const underFire=(e.hit||0)>.025;
  let missileNearby=false;
  if(distance>85&&game.missiles?.length){
    for(const missile of game.missiles){
      if(missile.target===e&&missile.life>0&&
          Math.hypot(missile.x-e.x,missile.y-e.y)<155){
        missileNearby=true;break;
      }
    }
  }
  if(distance>85&&(underFire||missileNearby)&&
      game.time>=(e._scoutDodgeCooldown??0)){
    e._scoutDodgeSide=side;
    e._scoutDodgeStarted=game.time;
    e._scoutDodgeUntil=game.time+.49;
    e._scoutDodgeCooldown=game.time+2.45+(serial%5)*.19;
  }
  if(game.time<(e._scoutDodgeUntil??0)){
    const progress=clamp((game.time-e._scoutDodgeStarted)/.49,0,1);
    lateral=e._scoutDodgeSide*speed*(.70+.34*Math.sin(Math.PI*progress));
  }
  // Perpendicular movement is blended by steer(), so there is no teleport
  // or instantaneous direction flip when a new leg starts.
  return {x:-dy/distance*lateral,y:dx/distance*lateral};
}
// Small scouts threaten through readable, dodgeable pulses. Their first shot
// follows the visible purple scan, while later shots need a short charge.
// A shared volley gate prevents a large swarm from producing an unavoidable
// projectile wall. Neither health nor projectile collision rules change.
export const IRIS_COMBAT=Object.freeze({
  range:IRIS_SWARM.fireRange,scanShotAt:.59,charge:.36,volleySpacing:.43,
  projectileSpeed:275,damage:6
});
export function scoutAttack(e,game,target,scanning=false){
  if(e.type!=='scout'||e.converted||e.boss||e.missionStructure||
     e.interceptCargo||!game.enemyShot)return false;
  if(!irisPackMayFire(e,game)){
    e._irisChargeStarted=null;return false;
  }
  const now=game.time;
  const engaged=!e.signalIntel||e.signalIntel.mode==='engaged';
  const distance=target?.hp>0?dist(e,target):Infinity;
  const seen=engaged&&distance<=IRIS_COMBAT.range&&
    irisCanSense(e,game,target,IRIS_COMBAT.range);
  if(!seen){e._irisChargeStarted=null;e._irisChargeTarget=null;return false;}
  if(e._irisChargeTarget!==target){
    e._irisChargeStarted=null;e._irisChargeTarget=target;
  }
  if(scanning){
    e._irisChargeStarted=null;
    if(e._irisScanMode!=='acquire'||
       now-e._irisScanStarted<IRIS_COMBAT.scanShotAt)return false;
  }else{
    // Ordinary scouts cannot shoot at a remembered, currently unseen player.
    if(target===game.player&&!e.signalIntel&&!e._irisHasSight&&
       Number.isFinite(e._irisLastSeenAt))return false;
    if(e.fire<=0&&e._irisChargeStarted==null)
      e._irisChargeStarted=now;
    if(now-e._irisChargeStarted>1.05){
      // A queued scout must warn again instead of shooting after its visible
      // charge has expired while other members of the swarm used the slot.
      e._irisChargeStarted=now;return false;
    }
    if(now-(e._irisChargeStarted??now)<IRIS_COMBAT.charge)return false;
  }
  if(e.fire>0){e._irisChargeStarted=null;return false;}
  if(now<(game._irisNextVolleyAt??0))return false;
  // Partial lead rewards evasive flying without perfectly tracking the player.
  const flight=distance/IRIS_COMBAT.projectileSpeed;
  const lead=clamp(flight*.38,0,.3);
  const tx=target.x+clamp((target.vx||0)*lead,-45,45);
  const ty=target.y+clamp((target.vy||0)*lead,-45,45);
  const accepted=game.enemyShot(e.x,e.y,tx,ty,IRIS_COMBAT.damage,
    {kind:'iris',speed:IRIS_COMBAT.projectileSpeed,r:4.5,
     learnToken:game.enemyLearning?.shotToken(e)});
  if(accepted===false)return false;
  game.enemyLearning?.fired(e);
  e._irisHasFired=true;
  e.fire=2.0+(Math.abs(Math.trunc(e.serial||0))%4)*.23;
  e._irisChargeStarted=null;
  game._irisNextVolleyAt=now+IRIS_COMBAT.volleySpacing;
  return true;
}
/** At close range scouts circle the player instead of continuously missing
 * contact on wide zigzags. They remain vulnerable to the player's beam. */
export function scoutAttackGoal(e,target){
  const dx=e.x-target.x,dy=e.y-target.y;
  const distance=Math.hypot(dx,dy);
  if(distance>=315)return null;
  const serial=Math.abs(Math.trunc(e.serial||0));
  const rx=distance>1?dx/distance:Math.cos(serial*2.39);
  const ry=distance>1?dy/distance:Math.sin(serial*2.39);
  const side=serial%2?1:-1;
  const radius=178+(serial%3)*20;
  const correction=clamp((radius-distance)*1.25,-140,140);
  return {x:e.x-ry*side*140+rx*correction,
    y:e.y+rx*side*140+ry*correction};
}
export const ENEMY_TYPES = Object.freeze({
  scout:{name:'Разведчик',hp:28,speed:158,dmg:9,score:7},
  fighter:{name:'Штурмовик',hp:58,speed:120,dmg:12,score:10},
  flanker:{name:'Перехватчик',hp:50,speed:178,dmg:13,score:13},
  healer:{name:'Ремонтник',hp:75,speed:118,dmg:5,score:22},
  berserker:{name:'Таранщик',hp:70,speed:135,dmg:18,score:16},
  gunship:{name:'Корвет',hp:120,speed:95,dmg:13,score:25}
});
const findHealer=(enemy,game)=>{
  let best=null,min=Infinity;
  for(const e of game.grid.query(enemy.x,enemy.y,680)){
    if(e===enemy||e.type!=='healer'||e.hp<=0||e.converted||
      (e.healReserve??110)<=0)continue;
    const d=dist(e,enemy);
    if(d<min){best=e;min=d;}
  }
  return best;
};
/** Pick a nearby destructible false signature before an ordinary enemy
 * resumes pursuing the player. Scripted orders and bosses are unaffected. */
export function turretDistractionTarget(e,game){
  if(e.openingCommander||e.relayAssault||e.stationRaid||e.boss||
     !['scout','flanker','fighter','gunship'].includes(e.type))return null;
  let nearest=null,closest=Infinity;
  for(const decoy of game.artilleryDecoys||[]){
    if(decoy.hp<=0||decoy.until<=game.time)continue;
    const range=dist(e,decoy);
    if(range<340&&range<closest){nearest=decoy;closest=range;}
  }
  for(const hive of game.world?.contours?.supportTurrets||[]){
    const lure=turretBranchRank(hive,'anomaly');
    if(hive.type!=='hive'||hive.hp<=0||lure<1||game.time<hive.readyAt)continue;
    for(const drone of hive.drones||[]){
      if(drone.hp<=0)continue;
      const range=dist(e,drone);
      if(range<310+lure*40&&range<closest&&game.enemyCanSee?.(e,drone)){
        nearest=drone;closest=range;
      }
    }
  }
  return nearest;
}
const pickTarget=(e,game)=>{
  if(e.ramOrder?.squad&&e.ramOrder.target?.hp>0&&game.time<e.ramOrder.squad.until)
    return e.ramOrder.target;
  if(e.relayAssault&&!e.relayScreen&&game.operation?.id==='relay-defense'&&
     game.operation.baseId===e.relayAssault&&game.operation.hp>0)return game.operation;
  const focus=e.signalIntel?.combatFocus;
  if(e.signalIntel?.mode==='engaged'&&focus&&focus!==game.player&&focus.hp>0&&
     dist(e,focus)<470)return focus;
  let target=game.player;
  if(e.type!=='healer'&&e.type!=='berserker'){
    // A called-in bomber is a valuable temporary target, not an immortal VFX.
    // Interceptors will contest the airstrike while the player can cover it.
    for(const mission of game.support?.missions||[]){
      for(const craft of mission.craft){
        if(craft.hp<=0)continue;
        const d=dist(e,craft);
        if(d<270&&game.enemyCanSee?.(e,craft)&&
           (e.type==='flanker'||e.type==='gunship'||e.type==='fighter')){
          target=craft;break;
        }
      }
      if(target!==game.player)break;
    }
  }
  if(target===game.player&&e.type!=='healer' && e.type!=='berserker' && game.allies.length){
    let d=Infinity;
    for(const ally of game.allies){
      if(ally.hp<=0)continue;
      const z=dist(e,ally);
      const priority=ally.role==='bomber'?.62:1;
      if(z<290&&game.enemyCanSee?.(e,ally)&&z*priority<d){d=z*priority;target=ally;}
    }
  }
  // Experimental shells and hive drones draw ordinary fighters away. The
  // chosen target remains a real, destructible world object.
  if(target===game.player)target=turretDistractionTarget(e,game)||target;
  // A firing field artillery platform is a local, observable threat. Keep
  // scripted rescue/escort orders and actual sightings ahead of this choice.
  if(target===game.player&&e.type!=='healer'&&!e.relayAssault&&!e.stationRaid){
    let nearest=null,closest=Infinity;
    for(const tower of game.world?.contours?.artillery||[]){
      if(tower.hp<=0||game.time<tower.readyAt||
        game.time-Math.max(tower.lastShotAt??-Infinity,tower.lastCloseAt??-Infinity)>10)continue;
      const d=dist(e,tower);
      if(d<420&&d<closest&&game.enemyCanSee?.(e,tower)){
        nearest=tower;closest=d;
      }
    }
    if(nearest)target=nearest;
  }
  if(target===game.player&&e.type!=='healer'&&!e.relayAssault&&!e.stationRaid){
    let closest=Infinity,nearest=null;
    for(const platform of game.world?.contours?.supportTurrets||[]){
      if(platform.hp<=0||game.time<platform.readyAt)continue;
      const active=platform.type==='hive'&&platform.drones?.some(dr=>dr.hp>0)||
        game.time-platform.lastShotAt<9;
      if(!active)continue;
      for(const unit of [platform,...(platform.type==='hive'?(platform.drones||[]):[])]){
        if(unit.hp<=0)continue;
        const distance=dist(e,unit);
        if(distance<420&&distance<closest&&game.enemyCanSee?.(e,unit)){
          nearest=unit;closest=distance;
        }
      }
    }
    if(nearest)target=nearest;
  }
  return target;
};
export function updateEnemy(e,game,dt){
  if(e.hp<=0)return;
  if(e.trialRetreatUntil){
    e._gunAiming=null;e._irisChargeStarted=null;e._commsIntent=null;
    if(game.time>=e.trialRetreatUntil){e.hp=0;e.expAwarded=true;e.visualDeath=true;return;}
    const from=e.trialRetreatFrom||game.player;
    const dx=e.x-from.x,dy=e.y-from.y;
    const dir=norm(dx||1,dy);
    steer(e,e.x+dir.x*900,e.y+dir.y*900,330,dt);return;
  }
  // A successfully hacked craft is friendly immediately, even if an earlier
  // hostile stasis pulse has not expired yet.
  if(e.converted){e._commsIntent=null;e._gunAiming=null;updateConverted(e,game,dt);return;}
  // A connected station briefly locks ordinary hostile craft in place.
  // Authored mission targets, bosses and cargo never receive this status.
  if(game.time<(e.stasisUntil||0)){
    e._commsIntent=null;
    e._gunAiming=null;
    e._irisChargeStarted=null;
    e.vx*=Math.exp(-8*dt);e.vy*=Math.exp(-8*dt);
    e.x+=e.vx*dt;e.y+=e.vy*dt;
    return;
  }
  if(e.microSwarm){moveMote(e,game,dt);return;}
  // Every visible intent must be renewed by real steering this frame.
  e._commsIntent=null;e._theaterIntent=null;
  if(e.missionFlight){
    const goal=e.missionFlight,remaining=dist(e,goal);
    const speed=Math.min(goal.speed,remaining*3);
    const detour=enemyRockDetour(e,game,goal.x,goal.y);
    steer(e,goal.x,goal.y,speed,dt,{x:detour.x*speed,y:detour.y*speed});
    e._gunAiming=null;
    return;
  }
  if(stormSeek(e,game,dt)){e._gunAiming=null;return;}
  e.think=(e.think??0)-dt;
  e.fire=(e.fire??1)-dt;
  const ram=e.ramOrder,squad=ram?.squad;
  if(e.type==='berserker'&&squad&&game.time<squad.until&&ram.target?.hp>0){
    const charge=game.time>=squad.chargeAt,target=ram.target;
    const goal=charge?target:ram;
    const speed=charge?238:118;
    const avoid=game.avoidance(e.x,e.y,38);
    steer(e,goal.x,goal.y,speed,dt,
      {x:avoid.x*speed*(charge?.14:.6),y:avoid.y*speed*(charge?.14:.6)});
    e._commsIntent={x:target.x,y:target.y,mode:charge?'ram-charge':'ram-rally',at:game.time};
    if(charge&&dist(e,target)<e.r+(target.r||30)+4){
      target.hp=Math.max(0,target.hp-e.damage*1.4);
      e.hp=0;e.expAwarded=true;
      game.heritage?.vfx?.shipExplosion?.(e.x,e.y,18,'#ff8759');
      if(target.hp<=0)game.heritage?.vfx?.shipExplosion?.(target.x,target.y,25,'#9aefff');
    }
    return;
  }
  const signalOrder=updateSignalIntent(e,game,dt);
  updateEnemyAwareness(e,game);
  const localContact=e._enemyLearningSaw||
    (e.type==='scout'&&e._irisHasSight&&
     game.time-(e._irisLastSeenAt??-Infinity)<.58);
  const irisTactic=e.type==='scout'&&localContact?
    updateIrisSwarm(e,game,game.player):null;
  const packTactic=e.type==='scout'&&localContact?
    irisPackDirective(e,game):null;
  if(updateIrisPerception(e,game,dt)){
    e._gunAiming=null;
    if(e.type==='scout')scoutAttack(e,game,
      e.signalIntel?.combatFocus||game.player,true);
    return;
  }
  if(signalOrder){
    e._gunAiming=null;
    const avoid=game.avoidance(e.x,e.y,38);
    const speed=ENEMY_TYPES[e.type].speed*signalOrder.speed*
      (e.type==='scout'?irisBurstThrust(e,game.time):1);
    const burst=e.type==='scout'?irisBurstJink(e,game.time):0;
    const heading=norm(signalOrder.x-e.x,signalOrder.y-e.y);
    const detour=enemyRockDetour(e,game,signalOrder.x,signalOrder.y);
    steer(e,signalOrder.x,signalOrder.y,speed,dt,
      {x:avoid.x*speed*1.25-heading.y*speed*burst+detour.x*speed,
       y:avoid.y*speed*1.25+heading.x*speed*burst+detour.y*speed});
    if(signalOrder.retreat&&game.camera&&
       outsideCamera(e.x,e.y,game.camera(),e.r+30)){
      // A patrol that found nobody leaves without yielding combat experience.
      e.hp=0;e.expAwarded=true;
    }
    return;
  }
  // Only ordinary engaged enemy pilots learn manoeuvres. Mission scripts,
  // signal searches, converted allies and cargo keep their authored orders.
  const learningStyle=!e.boss&&!e.missionStructure&&!e.relayAssault&&
    !e.interceptCargo?game.enemyLearning?.styleFor(e,game.time):null;
  if(e._enemyLearningSaw&&dist(e,game.player)<205)
    game.enemyLearning?.close(e,dt);
  if(e.think<=0){
    e.think=RULES.tacticalInterval+(e.serial%5)*.065;
    e.target=pickTarget(e,game);
    const t=game.time;
    // Tactical modes persist long enough to read as intentional behavior.
    if(t >= (e.commitUntil||0) || e.hp<e.maxHp*.28 ||
      (e.state==='windup'&&t>=e.chargeReadyAt)){
      let state='hunt';
      if(e.openingCommander)state='standoff';
      else if(e.type==='healer')state='heal';
      else if(e.type==='berserker'&&e.hp/e.maxHp<.31){
        // A visible wind-up gives the player time to respond to the ram.
        if(!e.chargeReadyAt)e.chargeReadyAt=t+.65;
        state=t<e.chargeReadyAt?'windup':'charge';
      }
      else if(e.hp/e.maxHp<.36&&findHealer(e,game))state='repair';
      else if(e.protect?.hp>0&&!e.protect.converted&&!e.protect.captured){
        // A defender owns a location, not a magical live target coordinate.
        // It intercepts only a recently witnessed or delivered threat to
        // that location; otherwise it stays with its patient or cargo.
        const memory=e._awarenessLast;
        const order=game.enemyComms?.directiveFor?.(e,t);
        const hasThreat=e._enemyLearningSaw||
          !!memory&&t-memory.at<=4.8||
          !!order?.intel&&t-order.intel.at<=2.6||
          !!e.signalIntel&&t-(e.signalIntel.lastSeenAt??-Infinity)<=3.4;
        const nearThreat=hasThreat&&
          dist(enemyPursuitTarget(e,game),e.protect)<
            (e.state==='intercept'?275:225);
        state=nearThreat?'intercept':'guard';
      }
      else if(e.type==='flanker')state='flank';
      else if(e.type==='gunship')state='standoff';
      if(state!==e.state){
       if(state==='windup'&&dist(e,game.player)<620)
        game.heritage.play('ramWarning',2.7,{x:e.x,y:e.y});
       e.state=state;e.commitUntil=t+RULES.squadCommitSeconds;
      }
      else e.commitUntil=Math.max(e.commitUntil||0,t+.5);
    }
  }
  const selected=e.target?.hp>0?e.target:game.player;
  const targetingPlayer=selected===game.player;
  const decoy=targetingPlayer?tacticalDecoy(game,e):null;
  const p=decoy|| (targetingPlayer?enemyPursuitTarget(e,game):selected);
  if(decoy){
    e._tacticalDecoyUntil=Math.min(decoy.until,game.time+.35);
    e._commsIntent=null;e._theaterIntent=null;
  }
  let goalX=p.x,goalY=p.y;
  let speed=ENEMY_TYPES[e.type].speed*(1+Math.min(.42,game.time/1300))*
    (e.type==='scout'?irisBurstThrust(e,game.time):1);
  if(e.state==='flank'){
    const a=game.time*.24+(e.group||0)*1.45+(e.serial%3)*.6;
    const radius=learningStyle==='wide'?176:118;
    const lead=learningStyle==='cutoff'?.22:0;
    goalX=p.x+Math.cos(a)*radius+clamp((p.vx||0)*lead,-40,40);
    goalY=p.y+Math.sin(a)*radius+clamp((p.vy||0)*lead,-40,40);
  }else if(e.state==='standoff'){
    const d=dist(e,p),v=norm(e.x-p.x,e.y-p.y);
    // Continuous orbital steering avoids the old 260-unit approach/retreat flip.
    const ideal=e.openingCommander?495:learningStyle==='sideslip'?340:
      learningStyle==='intercept'?255:290;
    const correction=clamp((d-ideal)/90,-1,1);
    const direction=e.serial%2===0?1:-1;
    const lateral=learningStyle==='sideslip'?84:55;
    goalX=e.x-v.x*correction*125-v.y*lateral*direction;
    goalY=e.y-v.y*correction*125+v.x*lateral*direction;
  }else if(e.state==='guard'&&e.protect?.hp>0){
    // If no one has seen the player, this is just a fixed guard formation.
    // The remembered threat point, if any, determines the facing.
    const v=norm(p.x-e.protect.x,p.y-e.protect.y);
    const side=(e.serial%2===0?1:-1)*48;
    goalX=e.protect.x+v.x*103-v.y*side;
    goalY=e.protect.y+v.y*103+v.x*side;
  }else if(e.state==='intercept'){
    goalX=p.x;goalY=p.y;
  }else if(e.state==='repair'){
    const medic=findHealer(e,game);
    if(medic){
      const v=norm(medic.x-p.x,medic.y-p.y);
      goalX=medic.x+v.x*36;goalY=medic.y+v.y*36;
      if(e.hp/e.maxHp>.77) e.commitUntil=0;
    }else e.commitUntil=0;
  }else if(e.state==='windup'){
    speed*=.28;
  }else if(e.state==='charge'){
    speed*=2.15;
  }else if(e.state==='heal'){
    const reserve=e.healReserve??110;
    e.healSearch=(e.healSearch??0)-dt;
    let patient=e.healTarget;
    if(e.healSearch<=0||!patient||patient.hp<=0||patient.converted||
      patient.hp>=patient.maxHp*.9||dist(e,patient)>410||reserve<=0){
      patient=null;let bestDistance=Infinity;
      if(reserve>0)for(const other of game.grid.query(e.x,e.y,410)){
       if(other===e||other.hp<=0||other.converted||other.hp>=other.maxHp*.88)continue;
       const d=dist(e,other)+(learningStyle==='critical'?other.hp/other.maxHp*140:0);
       if(d<bestDistance){patient=other;bestDistance=d;}
      }
      e.healTarget=patient;e.healSearch=.45;
    }
    if(patient){
      if(learningStyle==='screen'){
        const away=norm(patient.x-p.x,patient.y-p.y);
        goalX=patient.x+away.x*72;goalY=patient.y+away.y*72;
      }else{goalX=patient.x+55;goalY=patient.y+28;}
      if(dist(e,patient)<175 && (e.healReserve??110)>0){
        const amount=Math.min((e.healReserve??110),13*dt,patient.maxHp-patient.hp);
        patient.hp+=amount;e.healReserve=(e.healReserve??110)-amount;
        if(amount>0)game.enemyLearning?.supported(e,amount);
        if(amount>0) e.healFlash=.15;
      }
    }else{goalX=p.x+260;goalY=p.y+240;}
  }
  if(targetingPlayer&&e.state==='hunt'){
    if(e.type==='fighter'&&learningStyle==='intercept'){
      goalX+=clamp((p.vx||0)*.24,-48,48);
      goalY+=clamp((p.vy||0)*.24,-48,48);
    }else if(e.type==='fighter'&&learningStyle==='pressure'){
      goalX=p.x;goalY=p.y;
    }else if(e.type==='berserker'&&learningStyle==='intercept'){
      goalX+=clamp((p.vx||0)*.22,-45,45);
      goalY+=clamp((p.vy||0)*.22,-45,45);
    }else if(e.type==='berserker'&&learningStyle==='offset'){
      const heading=norm(p.x-e.x,p.y-e.y);
      goalX-=heading.y*48;goalY+=heading.x*48;
    }
  }
  // A pilot that believes the beacon's signal must actually investigate it;
  // old search waypoints and delayed radio orders cannot silently overwrite it.
  const search=!decoy&&e.type==='scout'&&e.state==='hunt'?irisSearchGoal(e,game):null;
  if(search){goalX=search.x;goalY=search.y;speed*=.78;}
  const orbit=e.type==='scout'&&e.state==='hunt'&&!search?
    scoutAttackGoal(e,p):null;
  if(orbit){goalX=orbit.x;goalY=orbit.y;}
  const tactical=(irisTactic&&(irisTactic.mode==='cover'||irisTactic.mode==='break'))?
    irisTactic:(packTactic||irisTactic);
  if(tactical&&!decoy&&e.state==='hunt'&&targetingPlayer){
    goalX=tactical.x;goalY=tactical.y;
    speed*=tactical.speed;
  }
  // A received order adjusts destinations but cannot override an escort's
  // guard, a medic's treatment or IRIS's authored pack choreography.
  const radio=game.enemyComms?.directiveFor(e,game.time);
  if(radio&&!decoy&&targetingPlayer&&radioOrderCapable(e,game.time,radio.threat)&&
    !(e.type==='scout'&&tactical)){
    const intel=radio.intel;
    const reported={x:intel.x+clamp(intel.vx*.12,-26,26),
      y:intel.y+clamp(intel.vy*.12,-26,26)};
    if(intel.estimated&&!e._enemyLearningSaw){
      // When radio traffic contains only a damaged facility or an impact
      // sector, even flankers and gunships investigate that reported place.
      // They cannot silently switch back to the player's real coordinates.
      goalX=reported.x;goalY=reported.y;
    }else if(e.state==='hunt'&&!e._enemyLearningSaw){
      goalX=reported.x;goalY=reported.y;
    }
    const heading=norm(reported.x-e.x,reported.y-e.y);
    if(radio.mode==='pincer'){
      if(radio.threat?.kind==='close'){
        // Plasma is strongest close up. Circling outside its high-damage
        // zone is a fallible counter: the player can pursue or change guns.
        const away=norm(e.x-reported.x,e.y-reported.y);
        const ring=e.type==='gunship'?340:300;
        const flankSide=radio.role==='left'?-1:
          radio.role==='right'?1:radio.side;
        goalX=reported.x+away.x*ring-away.y*flankSide*105;
        goalY=reported.y+away.y*ring+away.x*flankSide*105;
      }else{
        const flank=radio.threat?.kind==='maneuver'&&
          radio.threat.motion==='turning'?112:76;
        goalX-=heading.y*radio.side*flank;
        goalY+=heading.x*radio.side*flank;
      }
    }else if(radio.mode==='intercept'){
      if(radio.threat?.kind==='sabotage'&&
         radio.threat.site==='convoy'&&e.protect?.hp>0&&
         e.protect.regionalCargo){
        // The attacker is unknown when only damage to the transport was
        // witnessed. Escorts form a screen around their *moving* asset,
        // instead of chasing a magically revealed player coordinate.
        const outward=norm(e.x-e.protect.x,e.y-e.protect.y);
        goalX=e.protect.x+outward.x*132-outward.y*radio.side*68;
        goalY=e.protect.y+outward.y*132+outward.x*radio.side*68;
      }else{
        // A straight-moving player can be intercepted ahead of the last
        // witnessed course. Turning away defeats this fallible extrapolation.
        const straight=radio.threat?.kind==='maneuver'&&
          radio.threat.motion==='straight';
        goalX+=clamp(intel.vx*(straight?.43:.22),straight?-82:-52,straight?82:52);
        goalY+=clamp(intel.vy*(straight?.43:.22),straight?-82:-52,straight?82:52);
      }
    }else if(radio.mode==='press'){
      const finish=radio.threat?.kind==='weak';
      const flankSide=radio.role==='left'?-1:
        radio.role==='right'?1:radio.side;
      goalX+=heading.x*(finish?79:34)-heading.y*flankSide*(finish?43:22);
      goalY+=heading.y*(finish?79:34)+heading.x*flankSide*(finish?43:22);
    }else if(radio.mode==='close'){
      // Real short-distance advance; the existing speed limit still applies.
      const margin=e.type==='gunship'?210:145;
      goalX=reported.x-heading.x*margin-heading.y*radio.side*25;
      goalY=reported.y-heading.y*margin+heading.x*radio.side*25;
    }else if(radio.mode==='scatter'){
      // Opposite lateral exits against an observed area weapon.
      const away=norm(e.x-reported.x,e.y-reported.y);
      goalX=e.x+away.x*110-away.y*radio.side*185;
      goalY=e.y+away.y*110+away.x*radio.side*185;
    }else if(radio.mode==='screen'&&radio.medic&&radio.medic!==e){
      const toward=norm(reported.x-radio.medic.x,reported.y-radio.medic.y);
      goalX=radio.medic.x+toward.x*105-toward.y*radio.side*35;
      goalY=radio.medic.y+toward.y*105+toward.x*radio.side*35;
    }
    // Once the commander has assigned complementary roles, a wingman aims
    // for its own bounded lane. Unseen players and rough incident sectors
    // never become live coordinates through this formation logic.
    if(!intel.estimated&&!['close','weak'].includes(radio.threat?.kind)){
      const destination=squadRoleDestination(e,radio,reported);
      if(destination){goalX=destination.x;goalY=destination.y;}
    }
    e._commsIntent={x:goalX,y:goalY,mode:radio.mode,
      leader:radio.leader,at:game.time,
      planId:radio.planId??null,planPhase:radio.planPhase??null,
      role:radio.role||null};
  }else if(radio&&!decoy&&targetingPlayer&&radioOrderCapable(e,game.time,radio.threat)&&
    e.type==='scout'&&tactical===packTactic&&
    packTactic.radioApplied&&packTactic.radioMode===radio.mode){
    // The established IRIS formation has altered its actual flight radius
    // or lead in response to this message. Do not claim obedience for scouts
    // whose cover/break animation took priority instead.
    e._commsIntent={x:goalX,y:goalY,mode:radio.mode,
      leader:radio.leader,at:game.time,
      planId:radio.planId??null,planPhase:radio.planPhase??null,
      role:radio.role||null};
  }
  // Strategy changes the actual waypoint of a free pilot. Escort, rescue,
  // repair and scripted combat objectives remain in charge of their ships.
  // No location for the player is inferred here from the world economy.
  const strategic=game.enemyComms?.strategicDirectiveFor?.(e,game.time);
  if(targetingPlayer&&!decoy&&strategic&&
     ['hunt','flank','standoff'].includes(e.state)){
    const dest=theaterDestination(e,strategic);
    if(dest){
      goalX=dest.x;goalY=dest.y;
      e._commsIntent=null; // Do not display a tactical vector we overrode.
      e._theaterIntent={at:game.time,assetId:strategic.assetId,
        mode:strategic.role,x:goalX,y:goalY};
    }
  }
  // Unalerted traffic must actually traverse the map. In particular, a
  // gunship's standoff orbit and a healer's offset formation otherwise keep
  // it circling an imaginary enemy forever and exhaust the global ship cap.
  const transit=targetingPlayer&&!decoy&&
    unalertedPatrolRoute(e,game,radio,strategic);
  if(transit){
    goalX=transit.x;goalY=transit.y;
    speed=ENEMY_TYPES[e.type].speed;
  }
  // Counterattack scouts briefly abandon their normal pack orbit for a
  // visibly warned dive. The ordinary physics solver and hitboxes remain.
  const trialDive=e.type==='scout'?contourIrisDirective(e,game):null;
  if(trialDive){
    goalX=trialDive.x;goalY=trialDive.y;speed=trialDive.speed;
    e._commsIntent=null;e._theaterIntent=null;
  }
  const avoid=game.avoidance(e.x,e.y,e.type==='healer'?70:38);
  const detour=enemyRockDetour(e,game,goalX,goalY);
  let extraX=(avoid.x*1.3+detour.x)*speed,
    extraY=(avoid.y*1.3+detour.y)*speed;
  if(e.type==='scout'){
    const burst=trialDive?0:irisBurstJink(e,game.time),heading=norm(goalX-e.x,goalY-e.y);
    extraX-=heading.y*speed*burst;
    extraY+=heading.x*speed*burst;
    if(packTactic&&!trialDive){
      const separate=irisPackSeparation(e,game);
      extraX+=separate.x*speed*.56;extraY+=separate.y*speed*.56;
    }
  }
  if(e.state==='hunt'&&!e.boss&&!e.missionStructure&&!search&&!trialDive){
    if(e.type==='scout'){
      const jink=scoutSteering(e,game,p,speed);
      const sway=packTactic?.26:(orbit?.42:1);
      extraX+=jink.x*sway;extraY+=jink.y*sway;
    }else if(e.type==='fighter'&&learningStyle!=='pressure'){
      // Heavier fighters make long, slow sweeps, unlike nervous scouts.
      const heading=norm(p.x-e.x,p.y-e.y);
      const sweep=Math.sin(game.time*.81+(e.group||0)*.73+(e.serial%5)*.39);
      extraX-=heading.y*speed*.17*sweep;
      extraY+=heading.x*speed*.17*sweep;
    }
  }
  const beforeX=e.x,beforeY=e.y;
  steer(e,goalX,goalY,speed,dt,{x:extraX,y:extraY});
  e.healFlash=Math.max(0,(e.healFlash||0)-dt);
  updateEnemyGunnery(e,game,selected);
  if(e.type==='scout'&&!search&&trialDive?.phase!=='rush'&&
     (localContact||(selected!==game.player&&game.enemyCanSee?.(e,selected))))
    scoutAttack(e,game,selected,
    e._irisScanMode==='acquire'&&game.time<(e._irisScanUntil||0));
  if(e.type==='gunship'&&!e.relayAssault&&e.fire<=0&&
     (!targetingPlayer||e._enemyLearningSaw)&&dist(e,p)<535){
    e.fire=1.65;
    if(game.enemyShot(e.x,e.y,p.x,p.y,15,
      {learnToken:game.enemyLearning?.shotToken(e)})!==false)
      game.enemyLearning?.fired(e);
  }
  if(!targetingPlayer&&p.hp>0&&dist(e,p)<e.r+p.r){
    p.hp=Math.max(0,p.hp-e.damage*dt*1.4);
    if(p.hp<=0)game.heritage.vfx.shipExplosion(p.x,p.y,24,'#9aefff');
  }
  const playerContact=trialDive?.phase==='rush'?
    contourIrisRushContacts(beforeX,beforeY,e,game.player):
    dist(e,game.player)<e.r+game.player.r;
  if(playerContact&&e.type==='scout'&&
     e._trialDive?.phase==='rush'){
    // A real, dodgeable ram ends the dive. Brief invulnerability protects
    // the player as usual, but the scout still breaks apart on contact.
    if(game.player.invul<=0)game.hurt(Math.min(23,13+(e._trialDiveTier||1)),
      {x:e.x,y:e.y});
    e.hp=0;
  }else if(playerContact&&game.player.invul<=0){
    const prior=game.player.hp+game.player.shield;
    game.hurt(e.type==='berserker'&&e.state==='charge'?29:e.damage,{x:e.x,y:e.y});
    game.enemyLearning?.dealt(game.enemyLearning.shotToken(e),
      Math.max(0,prior-game.player.hp-game.player.shield));
    if(e.type==='berserker'&&e.state==='charge')e.hp=0;
  }
}
export function updateConverted(e,game,dt){
  if(e.parasiteCapture){updateParasitizedEnemy(e,game,dt);return;}
  e.convertedTime-=dt;if(e.convertedTime<=0){e.hp=0;e.expAwarded=true;return;}
  e.fire=(e.fire??0)-dt;
  let best=null,dmin=Infinity;
  if(!game.holdFire)for(const other of game.grid.query(e.x,e.y,500)){
    if(other===e||other.hp<=0||other.converted||!canAutoTarget(other))continue;
    const d=dist(e,other);if(d<dmin){best=other;dmin=d;}
  }
  const dest=best||{x:game.player.x+95,y:game.player.y+80};
  const avoid=game.avoidance(e.x,e.y,30);
  steer(e,dest.x,dest.y,150,dt,{x:avoid.x*180,y:avoid.y*180});
  if(best&&dmin<380&&e.fire<=0){
    e.fire=.8;game.damageEnemy(best,12,e);game.flash(e.x,e.y,best.x,best.y,'#65f5df');
  }
}
// An escort is a bodyguard, not an autonomous hunter. Targeting is anchored
// to the PLAYER so an ally cannot chase an incidental target across the map.
export function updateAlly(a,game,dt){
  if(a.hp<=0)return;
  const p=game.player;
  a.think=(a.think||0)-dt;a.fire=(a.fire||0)-dt;
  const farFromPlayer=dist(a,p)>235;
  const holdingFire=!!game.holdFire;
  const guardingExtraction=!!game.mining?.active&&!holdingFire;
  if(holdingFire&&(a.state!=='follow'||a.target)){
   a.state='follow';a.target=null;a.commitUntil=game.time;
   a.message='Прекратил огонь';a.messageUntil=game.time+2.4;
  }
  if(a.think<=0){
    a.think=(.34+(a.serial%4)*.06)/(1+(game.skillRanks.tactics||0)*.2);
    let state='follow',target=null,priority=-Infinity;
    const enemyBase=game.nearbyEnemyBase(650);
    if(holdingFire){
      state='follow';
    }else if(guardingExtraction){
      // The player's gun is offline during extraction: escorts close ranks and intercept.
      for(const e of game.grid.query(p.x,p.y,560)){
        if(e.hp<=0||e.converted||!canAutoTarget(e))continue;
        const playerDistance=dist(p,e);
        if(playerDistance>510)continue;
        const score=670-playerDistance+
          (e.type==='berserker'?140:e.type==='gunship'?100:0);
        if(score>priority){priority=score;target=e;}
      }
      state=target?'cover':'guard';
    }else if(a.role==='bomber'&&enemyBase&&game.assaulting(enemyBase)&&
     !enemyBase.coreExposed){
      state='bomb';target=enemyBase;
    }else if(!farFromPlayer){
      for(const e of game.grid.query(p.x,p.y,520)){
        if(e.hp<=0||e.converted||!canAutoTarget(e))continue;
        const playerDistance=dist(p,e);
        const radius=e.type==='gunship'?510:390;
        if(playerDistance>radius)continue;
        const allyDistance=dist(a,e);
        const threat=a.role==='scout'?(e.type==='berserker'?115:e.type==='flanker'?95:0):
         a.role==='fighter'?(e.type==='gunship'?120:e.type==='healer'?100:0):
         (e.type==='flanker'?65:e.type==='berserker'?65:0);
        const score=560-playerDistance*.85-allyDistance*.18+threat;
        if(score>priority){priority=score;target=e;}
      }
      if(target)state='cover';
    }
    const invalid=a.target?.hp<=0||!a.target;
    const urgentGuard=guardingExtraction && a.state!=='cover'&&a.state!=='guard';
    const guardOver=!guardingExtraction&&a.state==='guard';
    if(urgentGuard||guardOver||farFromPlayer||game.time>=(a.commitUntil||0)||invalid){
      if(a.state!==state){
        a.state=state;
        a.message=state==='follow'?(farFromPlayer?'Возвращаюсь':'Держу строй'):
          state==='bomb'?'Атакую базу':guardingExtraction?'Прикрываю добычу':'Прикрываю';
        a.messageUntil=game.time+2.4;
      }
      a.commitUntil=game.time+(guardingExtraction?1.15:farFromPlayer?.65:
       1.75/(1+(game.skillRanks.tactics||0)*.18));
      a.target=target;
    }
  }
  const slot=(a.serial-1)%2,angle=slot*Math.PI+.7;
  const formationRadius=guardingExtraction?62:82;
  let x=p.x+Math.cos(angle)*formationRadius;
  let y=p.y+Math.sin(angle)*formationRadius;
  let speed=(a.role==='scout'?365:a.role==='bomber'?235:335)*
    (1+game.network.engine*.075);
  if(!holdingFire&&a.state==='bomb'&&a.target?.hp>0){
    const target=a.target.turrets?.find(t=>t.hp>0)||a.target;
    x=target.x+Math.cos(angle)*165;y=target.y+Math.sin(angle)*165;
    if(a.fire<=0&&dist(a,target)<335){
      a.fire=2.25;
      if(target===a.target)game.hitEnemyBase(a.target,(37+game.network.armament*6)*(
       game.doctrine==='command'&&dist(a,p)<240?1.25:1),'bomber');
      else game.hitTurret(target,(37+game.network.armament*6)*(
       game.doctrine==='command'&&dist(a,p)<240?1.25:1),null,'ally');
      game.flash(a.x,a.y,target.x,target.y,'#ffcf72');
      game.heritage.play('rocket',.48,{x:a.x,y:a.y});
    }
  }else if(!holdingFire&&a.state==='cover'&&a.target?.hp>0&&canAutoTarget(a.target)){
    const target=a.target;
    x=target.x+Math.cos(angle)*100;y=target.y+Math.sin(angle)*100;
    // Intercept toward the threat, but keep the escort within support range.
    const dx=x-p.x,dy=y-p.y,d=length(dx,dy),tether=a.role==='bomber'?170:155;
    if(d>tether){x=p.x+dx/d*tether;y=p.y+dy/d*tether;}
    if(a.fire<=0&&dist(a,target)<360){
      a.fire=a.role==='scout'?.98:a.role==='bomber'?1.85:.85;
      const weapon=a.role==='scout'?12:a.role==='bomber'?5:18;
      const command=game.doctrine==='command'&&dist(a,p)<240?1.25:1;
      game.damageEnemy(target,(weapon+game.network.armament*(a.role==='bomber'?1.5:3))*command,a);
      game.flash(a.x,a.y,target.x,target.y,'#8adfff');
      game.heritage.play('allyShot',.42,{x:a.x,y:a.y});
    }
  }
  const avoid=game.avoidance(a.x,a.y,a.r+35);
  // Catch the player early. 600 units meant the escort was off-screen too long.
  if(dist(a,p)>235 && a.state!=='bomb'){
    x=p.x+Math.cos(angle)*85;y=p.y+Math.sin(angle)*85;
    speed*=1.9;
  }
  steer(a,x,y,speed,dt,{x:avoid.x*speed*1.5,y:avoid.y*speed*1.5});
  for(const shot of game.shotsNear(a.x,a.y,50)){
    if(shot.alive&&dist(a,shot)<a.r+shot.r){
      shot.alive=false;game.hitAlly(a,shot.damage*(1-game.network.armor*.07));
      break;
    }
  }
}

