import {RULES, dist, clamp, length, outsideCamera} from './balance.js?v=arcade-network-20';
import {updateSignalIntent,canAutoTarget} from './signal-perception.js?v=arcade-perception-61';
import {updateIrisPerception,irisSearchGoal} from './iris-scanning.js?v=iris-predator-scan-1';
const norm = (dx,dy) => {const m=Math.hypot(dx,dy)||1;return {x:dx/m,y:dy/m};};
const steer=(body,tx,ty,speed,dt,extra={x:0,y:0})=>{
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
const pickTarget=(e,game)=>{
  if(e.relayAssault&&game.operation?.id==='relay-defense'&&
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
        if(d<270&&(e.type==='flanker'||e.type==='gunship'||e.type==='fighter')){
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
      if(z<290&&z*priority<d){d=z*priority;target=ally;}
    }
  }
  return target;
};
export function updateEnemy(e,game,dt){
  if(e.hp<=0)return;
  if(e.converted){updateConverted(e,game,dt);return;}
  e.think=(e.think??0)-dt;
  e.fire=(e.fire??1)-dt;
  const signalOrder=updateSignalIntent(e,game,dt);
  if(updateIrisPerception(e,game,dt))return;
  if(signalOrder){
    const avoid=game.avoidance(e.x,e.y,38);
    const speed=ENEMY_TYPES[e.type].speed*signalOrder.speed;
    steer(e,signalOrder.x,signalOrder.y,speed,dt,
      {x:avoid.x*speed*1.25,y:avoid.y*speed*1.25});
    if(signalOrder.retreat&&game.camera&&
       outsideCamera(e.x,e.y,game.camera(),e.r+30)){
      // A patrol that found nobody leaves without yielding combat experience.
      e.hp=0;e.expAwarded=true;
    }
    return;
  }
  if(e.think<=0){
    e.think=RULES.tacticalInterval+(e.serial%5)*.065;
    e.target=pickTarget(e,game);
    const t=game.time;
    // Tactical modes persist long enough to read as intentional behavior.
    if(t >= (e.commitUntil||0) || e.hp<e.maxHp*.28 ||
      (e.state==='windup'&&t>=e.chargeReadyAt)){
      let state='hunt';
      if(e.type==='healer')state='heal';
      else if(e.type==='berserker'&&e.hp/e.maxHp<.31){
        // A visible wind-up gives the player time to respond to the ram.
        if(!e.chargeReadyAt)e.chargeReadyAt=t+.65;
        state=t<e.chargeReadyAt?'windup':'charge';
      }
      else if(e.hp/e.maxHp<.36&&findHealer(e,game))state='repair';
      else if(e.protect?.hp>0&&!e.protect.converted){
        const nearMedic=Math.min(dist(game.player,e.protect),
          dist(e.target,e.protect));
        state=nearMedic<(e.state==='intercept'?275:215)?'intercept':'guard';
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
  const p=e.target?.hp>0?e.target:game.player;
  let goalX=p.x,goalY=p.y;
  let speed=ENEMY_TYPES[e.type].speed*(1+Math.min(.42,game.time/1300));
  if(e.state==='flank'){
    const a=game.time*.24+(e.group||0)*1.45+(e.serial%3)*.6;
    goalX=p.x+Math.cos(a)*118;goalY=p.y+Math.sin(a)*118;
  }else if(e.state==='standoff'){
    const d=dist(e,p),v=norm(e.x-p.x,e.y-p.y);
    // Continuous orbital steering avoids the old 260-unit approach/retreat flip.
    const correction=clamp((d-290)/90,-1,1);
    const direction=e.serial%2===0?1:-1;
    goalX=e.x-v.x*correction*125-v.y*55*direction;
    goalY=e.y-v.y*correction*125+v.x*55*direction;
  }else if(e.state==='guard'&&e.protect?.hp>0){
    // Guardians remain between their medic and the incoming player.
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
       const d=dist(e,other);
       if(d<bestDistance){patient=other;bestDistance=d;}
      }
      e.healTarget=patient;e.healSearch=.45;
    }
    if(patient){
      goalX=patient.x+55;goalY=patient.y+28;
      if(dist(e,patient)<175 && (e.healReserve??110)>0){
        const amount=Math.min((e.healReserve??110),13*dt,patient.maxHp-patient.hp);
        patient.hp+=amount;e.healReserve=(e.healReserve??110)-amount;
        if(amount>0) e.healFlash=.15;
      }
    }else{goalX=p.x+260;goalY=p.y+240;}
  }
  const search=e.type==='scout'&&e.state==='hunt'?irisSearchGoal(e,game):null;
  if(search){goalX=search.x;goalY=search.y;speed*=.78;}
  const avoid=game.avoidance(e.x,e.y,e.type==='healer'?70:38);
  let extraX=avoid.x*speed*1.3,extraY=avoid.y*speed*1.3;
  if(e.state==='hunt'&&!e.boss&&!e.missionStructure&&!search){
    if(e.type==='scout'){
      const jink=scoutSteering(e,game,p,speed);
      extraX+=jink.x;extraY+=jink.y;
    }else if(e.type==='fighter'){
      // Heavier fighters make long, slow sweeps, unlike nervous scouts.
      const heading=norm(p.x-e.x,p.y-e.y);
      const sweep=Math.sin(game.time*.81+(e.group||0)*.73+(e.serial%5)*.39);
      extraX-=heading.y*speed*.17*sweep;
      extraY+=heading.x*speed*.17*sweep;
    }
  }
  steer(e,goalX,goalY,speed,dt,{x:extraX,y:extraY});
  e.healFlash=Math.max(0,(e.healFlash||0)-dt);
  if(e.type==='gunship'&&!e.relayAssault&&e.fire<=0&&dist(e,p)<535){
    e.fire=1.65;
    game.enemyShot(e.x,e.y,p.x,p.y,15);
  }
  if(p!==game.player&&p.hp>0&&dist(e,p)<e.r+p.r){
    p.hp-=e.damage*dt*1.4;
    if(p.hp<=0)game.heritage.vfx.shipExplosion(p.x,p.y,24,'#9aefff');
  }
  if(dist(e,game.player)<e.r+game.player.r&&game.player.invul<=0){
    game.hurt(e.type==='berserker'&&e.state==='charge'?29:e.damage,{x:e.x,y:e.y});
    if(e.type==='berserker'&&e.state==='charge')e.hp=0;
  }
}
export function updateConverted(e,game,dt){
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
       game.doctrine==='command'&&dist(a,p)<240?1.25:1));
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

