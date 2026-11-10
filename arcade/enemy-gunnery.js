/** Deliberate fire support for ordinary fighters and flankers.
 * A pilot needs its own recent optical contact, commits to a visible aim
 * point, then fires one dodgeable bolt. Radio orders alter positioning, not
 * damage, accuracy or the projectile budget. */
import {sweptRamHit} from './enemy-last-stand.js?v=redteam-20261109-1';
export const ENEMY_GUNNERY=Object.freeze({
  fighter:Object.freeze({range:405,charge:.62,reload:2.7,speed:290,damage:10,
    upgradeAt:135,upgraded:Object.freeze({range:405,charge:.7,reload:3.1,
      speed:370,damage:6,shots:2,gap:.34,spread:.035,kind:'fighter-burst'})}),
  flanker:Object.freeze({range:395,charge:.55,reload:2.8,speed:305,damage:9,
    upgradeAt:155,upgraded:Object.freeze({range:445,charge:.82,reload:3.1,
      speed:510,damage:9,kind:'flanker-needle'})}),
  gunship:Object.freeze({range:535,charge:1.03,reload:4.1,speed:380,
    damage:8,shots:3,gap:.36,spread:.115,kind:'gunship-cannon'}),
  // Close-in broadside: short, warned shrapnel burst, not a tracking aura.
  // It replaces the next main-cannon cycle, so damage cannot stack freely.
  pointDefense:Object.freeze({range:235,charge:.58,reload:4.55,speed:315,
    damage:5,shots:3,gap:.19,spread:.15,kind:'gunship-flak'}),
  lance:Object.freeze({range:500,charge:1.25,reload:4.6,
    damage:13,kind:'gunship-lance'}),
  cellSpacing:.62,globalSpacing:.23,maxWarnings:4,
  // A crowded cell must not prepare more live shots than the low-FPS renderer
  // can telegraph. Queued pilots retain their normal reload and take turns.
  concurrentCharges:2,warningRange:555
});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const gunProfile=(type,time)=>{
 const base=ENEMY_GUNNERY[type];
 return base?.upgraded&&time>=base.upgradeAt?base.upgraded:base;
};
function lanceAvailable(e,game,target){
 if(e.type!=='gunship'||target!==game.player||game.time<245||
    (e._gunCycle||0)%2===0||game.time<(game._enemyLanceNextAt||0)||
    game.enemies?.some(other=>other!==e&&other.hp>0&&
      other._gunAiming?.profile?.kind==='gunship-lance'))return false;
 // A dangerous instantaneous attack must never originate offscreen without
 // its full charge line being visible to the player.
 const cam=game.camera?.();
 return !cam||e.x>=cam.x+15&&e.x<=cam.x+cam.w-15&&
   e.y>=cam.y+15&&e.y<=cam.y+cam.h-15;
}
function lanceWarningStillValid(e,game,aim){
 if(aim?.profile?.kind!=='gunship-lance')return true;
 // Recheck throughout the warning, not just when it begins. No offscreen
 // instant damage or a ray sweeping sideways away from its original marker.
 const cam=game.camera?.();
 return (!cam||e.x>=cam.x+15&&e.x<=cam.x+cam.w-15&&
   e.y>=cam.y+15&&e.y<=cam.y+cam.h-15)&&
   distance(e,{x:aim.originX,y:aim.originY})<=26;
}
function closeBatteryAvailable(e,game,target){
 if(e?.type!=='gunship'||!target||target.hp<=0||
    distance(e,target)>ENEMY_GUNNERY.pointDefense.range)return false;
 const cam=game?.camera?.();
 // At high zoom the corvette must be visible before its short charge begins.
 return !cam||e.x>=cam.x+12&&e.x<=cam.x+cam.w-12&&
   e.y>=cam.y+12&&e.y<=cam.y+cam.h-12;
}

function fireBolt(e,game,profile,aim,index=0){
 const offset=(index-(profile.shots||1)/2+.5)*(profile.spread||0);
 const angle=Math.atan2(aim.y-e.y,aim.x-e.x)+offset;
 const d=Math.hypot(aim.x-e.x,aim.y-e.y)||1;
 const tx=offset?e.x+Math.cos(angle)*d:aim.x;
 const ty=offset?e.y+Math.sin(angle)*d:aim.y;
 const fired=game.enemyShot(e.x,e.y,tx,ty,profile.damage,
  {kind:profile.kind||(e.type==='gunship'?'gunship-cannon':e.type),
    speed:profile.speed,r:e.type==='gunship'?5:4.5,
    learnToken:game.enemyLearning?.shotToken(e)})!==false;
 if(fired){
  game.enemyLearning?.fired(e);
  if(e._commsCell)e._commsCell.nextGunVolleyAt=game.time+ENEMY_GUNNERY.cellSpacing;
  game._enemyRegularVolleyAt=game.time+ENEMY_GUNNERY.globalSpacing;
 }
 return fired;
}
function fireLance(e,game,profile,aim,target){
 if(game.time<(game._enemyLanceNextAt||0))return false;
 const before=target.hp+(target.shield||0);
 const hit=sweptRamHit(e.x,e.y,aim.x,aim.y,target,(target.r||19)+7);
 if(hit)game.hurt?.(profile.damage,{x:e.x,y:e.y});
 game.enemyLearning?.fired(e);
 if(hit)game.enemyLearning?.dealt?.(game.enemyLearning?.shotToken?.(e),
   Math.max(0,before-target.hp-(target.shield||0)));
 game.flash?.(e.x,e.y,aim.x,aim.y,'#ff6e52');
 game.heritage?.play?.('enemyShot',.65,{x:e.x,y:e.y});
 game._enemyLanceNextAt=game.time+4.8;
 game._enemyRegularVolleyAt=game.time+.55;
 if(e._commsCell)e._commsCell.nextGunVolleyAt=game.time+.8;
 return true;
}

export function updateEnemyGunnery(e,game,target){
  // At maximum zoom a very close corvette could sit entirely offscreen.
  // Neither its broadside nor its more damaging main cannon may fire there.
  if(e?.type==='gunship'&&target?.hp>0&&
     distance(e,target)<=ENEMY_GUNNERY.pointDefense.range&&
     !closeBatteryAvailable(e,game,target)){
    e._gunAiming=null;e._gunBurst=null;return false;
  }
  const now=game?.time,profile=e?._gunAiming?.profile||
   (closeBatteryAvailable(e,game,target)?
    ENEMY_GUNNERY.pointDefense:
    e&&game&&lanceAvailable(e,game,target)?ENEMY_GUNNERY.lance:
    gunProfile(e?.type,now));
  if(!profile||!Number.isFinite(now))return false;
  // A hit or a message containing only a rough sector never grants the
  // perfect tracking required for a gun solution. A friendly craft is a
  // legitimate target only when this pilot sees it directly.
  const attackingPlayer=target===game.player;
  const directContact=target?.hp>0&&
    (attackingPlayer?!!e._enemyLearningSaw:
      typeof game.enemyCanSee==='function'&&game.enemyCanSee(e,target));
  if(e.hp<=0||e.converted||e._lastStand||e.boss||(e.missionStructure&&!e.openingCommander)||
     e.relayAssault||e.interceptCargo||
     typeof game.enemyShot!=='function'||
     e.signalIntel&&e.signalIntel.mode!=='engaged'||
     !directContact||
     !['hunt','flank','intercept','guard','standoff'].includes(e.state)||
     distance(e,target)>profile.range){
    e._gunAiming=null;e._gunBurst=null;return false;
  }
  const burst=e._gunBurst;
  if(burst){
    if(burst.target!==target||now>burst.expires||
       (game.enemyCanSee&&!game.enemyCanSee(e,target))||
       (e._commsCell?.brokenUntil||0)>now){
      e._gunBurst=null;return false;
    }
    if(now<burst.nextAt||now<(game._enemyRegularVolleyAt||0))return false;
    const fired=fireBolt(e,game,burst.profile,burst.aim,burst.index);
    if(fired){
      burst.index++;burst.remaining--;
      burst.nextAt=now+burst.profile.gap;
    }
    if(burst.remaining<=0)e._gunBurst=null;
    return fired;
  }
  if(e._gunNextAt===undefined)
    e._gunNextAt=now+.36+(Math.abs(e.serial||0)%5)*.12;
  const aim=e._gunAiming;
  if(aim&&aim.target!==target){
    e._gunAiming=null;e._gunNextAt=Math.max(now,e._gunNextAt||0);
    return false;
  }
  if(aim&&game.enemyCanSee&&!game.enemyCanSee(e,target)){
    e._gunAiming=null;e._gunNextAt=now+.55;return false;
  }
  if(aim&&!lanceWarningStillValid(e,game,aim)){
    e._gunAiming=null;e._gunNextAt=now+.8;return false;
  }
  if(aim?.profile?.kind==='gunship-flak'&&
     !closeBatteryAvailable(e,game,target)){
    e._gunAiming=null;e._gunNextAt=now+.55;return false;
  }
  if(!aim){
    if(now<e._gunNextAt)return false;
    // At low frame rates only two aiming rays are painted. Charging seven
    // weapons at once would produce five genuinely unannounced attacks.
    // Count ALL live aimers, including those targeting allies and the lance,
    // because they compete for the same visible warning slots.
    const activeCharges=(game.enemies||[]).reduce((count,pilot)=>count+
      Number(pilot!==e&&pilot.hp>0&&!pilot.converted&&!!pilot._gunAiming),0);
    if(activeCharges>=ENEMY_GUNNERY.concurrentCharges)return false;
    // Lock a bounded prediction. The marker does not follow a subsequent
    // dodge, so changing course during the warning really defeats the shot.
    const lead=profile.kind==='gunship-lance'?0:
      clamp(distance(e,target)/profile.speed*.29,.08,.31);
    e._gunAiming={x:target.x+clamp((target.vx||0)*lead,-55,55),
      y:target.y+clamp((target.vy||0)*lead,-55,55),
      started:now,until:now+profile.charge,target,profile,
      ...(profile.kind==='gunship-lance'?{originX:e.x,originY:e.y}:{})};
    if(profile.kind==='gunship-lance')game.heritage?.play?.('ramWarning',.65,e);
    return false;
  }
  if(now<aim.until)return false;
  if(game.enemyCanSee&&!game.enemyCanSee(e,target)){
    e._gunAiming=null;e._gunNextAt=now+.7;return false;
  }
  const cell=e._commsCell;
  if(cell?.brokenUntil&&now<cell.brokenUntil){
    // Losing the caller disrupts synchronized volleys for a short interval.
    e._gunAiming=null;e._gunNextAt=cell.brokenUntil+.2;return false;
  }
  if(cell&&now<(cell.nextGunVolleyAt||0)){
    // A member waits for another gap instead of dumping an entire squad's
    // projectiles in one simulation tick. The stale aim must be reacquired.
    if(now-aim.until>.35){
      e._gunAiming=null;e._gunNextAt=cell.nextGunVolleyAt;
    }
    return false;
  }
  if(now<(game._enemyRegularVolleyAt||0))return false;
  const fired=profile.kind==='gunship-lance'?
    fireLance(e,game,profile,aim,target):fireBolt(e,game,profile,aim,0);
  // Only main-gun cycles advance the alternation with the heavy lance.
  if(fired&&e.type==='gunship'&&profile.kind!=='gunship-flak')
    e._gunCycle=(e._gunCycle||0)+1;
  if(fired&&(profile.shots||1)>1){
    e._gunBurst={target,profile,aim,index:1,remaining:profile.shots-1,
      nextAt:now+profile.gap,expires:now+1.8};
  }
  e._gunAiming=null;
  e._gunNextAt=now+(fired?profile.reload:.55)+
    (Math.abs(e.serial||0)%4)*.17;
  return fired;
}

/** Only drawing: no tactical reads, hidden positions or collision changes. */
export function drawEnemyGunWarnings(ctx,game,cam,fps=60){
  if(!game?.playerCanInspectEnemyIntent)return 0;
  const limit=fps<28?2:ENEMY_GUNNERY.maxWarnings;
  let drawn=0;
  const aiming=(game.enemies||[]).filter(e=>e._gunAiming&&e.hp>0);
  aiming.sort((a,b)=>Number(b._gunAiming?.profile?.kind==='gunship-lance')-
   Number(a._gunAiming?.profile?.kind==='gunship-lance')||
   distance(a,game.player)-distance(b,game.player));
  for(const e of aiming){
    if(drawn>=limit)break;
    const aim=e._gunAiming;
    // Keep the warning visible if another cell's volley postpones the shot.
    // It is removed only once the fire command actually succeeds or cancels.
    if(!aim||e.hp<=0||e.converted||
       distance(e,game.player)>ENEMY_GUNNERY.warningRange||
       e.x<cam.x-30||e.x>cam.x+cam.w+30||
       e.y<cam.y-30||e.y>cam.y+cam.h+30||
       !game.playerCanInspectEnemyIntent(e))continue;
    const profile=aim.profile||gunProfile(e.type,game.time);
    if(!profile)continue;
    const progress=clamp((game.time-aim.started)/profile.charge,0,1);
    const close=profile.kind==='gunship-flak';
    const tint=close?'#ffc271':e.type==='fighter'?'#ffab75':
      e.type==='gunship'?'#ff6554':'#d0a1ff';
    const beam=profile.kind==='gunship-lance';
    ctx.save();ctx.strokeStyle=tint;ctx.lineWidth=beam?2.5+progress*3.2:1.15+progress*.85;
    ctx.globalAlpha=.32+progress*.47;
    ctx.setLineDash(beam?[10,6]:[4,7]);ctx.beginPath();ctx.moveTo(e.x,e.y);
    ctx.lineTo(aim.x,aim.y);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(aim.x,aim.y,7+progress*4,0,Math.PI*2);ctx.stroke();
    if(close){
      // Two visible flank guns spool up before the shot. No extra entities.
      ctx.beginPath();ctx.arc(e.x,e.y,e.r+5+progress*4,
        -Math.PI*.28,Math.PI*.28);ctx.stroke();
      ctx.beginPath();ctx.arc(e.x,e.y,e.r+5+progress*4,
        Math.PI*.72,Math.PI*1.28);ctx.stroke();
    }
    ctx.restore();drawn++;
  }
  return drawn;
}

/** A guard's label describes the *actual* asset it is staying near.
 * It is not a radio interception or a new command, and cannot reveal a
 * defender behind an asteroid. One label per defended asset is sufficient. */
export function drawEnemyDefenseGoals(ctx,game,cam,fps=60){
  if(!game?.playerCanInspectEnemyIntent)return 0;
  const marked=new Set();let drawn=0;
  for(const e of game.enemies||[]){
    if(drawn>=(fps<28?1:2))break;
    const asset=e.protect;
    if(!asset||asset.hp<=0||asset.captured||marked.has(asset)||
       e.hp<=0||e.converted||
       !['guard','intercept'].includes(e.state)||
       distance(e,asset)>320||
       distance(e,game.player)>390||
       e.x<cam.x-30||e.x>cam.x+cam.w+30||
       e.y<cam.y-30||e.y>cam.y+cam.h+30||
       !game.playerCanInspectEnemyIntent(e))continue;
    const label=asset.type==='healer'?'ПРИКРЫВАЕТ РЕМОНТНИКА':
      e.scenario==='mine-guard'?'ОХРАНЯЕТ КОМПЛЕКС':
      e.scenario==='opening-escort'?'ПРИКРЫВАЕТ НАВОДЧИКА':
      'СОПРОВОЖДАЕТ ГРУЗ';
    ctx.save();ctx.globalAlpha=.82;ctx.textAlign='center';
    ctx.font='bold 9px system-ui';ctx.fillStyle='#f9cc90';
    ctx.fillText(label,e.x,e.y-(e.r||14)-55,190);
    ctx.restore();marked.add(asset);drawn++;
  }
  return drawn;
}
