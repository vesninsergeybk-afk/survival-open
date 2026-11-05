/** Deliberate fire support for ordinary fighters and flankers.
 * A pilot needs its own recent optical contact, commits to a visible aim
 * point, then fires one dodgeable bolt. Radio orders alter positioning, not
 * damage, accuracy or the projectile budget. */
export const ENEMY_GUNNERY=Object.freeze({
  fighter:Object.freeze({range:375,charge:.68,reload:3.2,speed:250,damage:7}),
  flanker:Object.freeze({range:345,charge:.57,reload:3.45,speed:265,damage:6}),
  cellSpacing:.88,globalSpacing:.32,maxWarnings:4,warningRange:510
});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export function updateEnemyGunnery(e,game,target){
  const profile=ENEMY_GUNNERY[e?.type],now=game?.time;
  if(!profile||!Number.isFinite(now))return false;
  // A hit or a message containing only a rough sector never grants the
  // perfect tracking required for a gun solution. Mission escorts may shoot
  // only once they themselves see the player.
  if(e.hp<=0||e.converted||e.boss||e.missionStructure||
     e.relayAssault||e.interceptCargo||
     typeof game.enemyShot!=='function'||
     e.signalIntel&&e.signalIntel.mode!=='engaged'||
     !e._enemyLearningSaw||target!==game.player||
     !['hunt','flank','intercept','guard','standoff'].includes(e.state)||
     distance(e,target)>profile.range){
    e._gunAiming=null;return false;
  }
  if(e._gunNextAt===undefined)
    e._gunNextAt=now+.36+(Math.abs(e.serial||0)%5)*.12;
  const aim=e._gunAiming;
  if(!aim){
    if(now<e._gunNextAt)return false;
    // Lock a bounded prediction. The marker does not follow a subsequent
    // dodge, so changing course during the warning really defeats the shot.
    const lead=clamp(distance(e,target)/profile.speed*.29,.08,.31);
    e._gunAiming={x:target.x+clamp((target.vx||0)*lead,-55,55),
      y:target.y+clamp((target.vy||0)*lead,-55,55),
      started:now,until:now+profile.charge};
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
  const fired=game.enemyShot?.(e.x,e.y,aim.x,aim.y,profile.damage,
    {kind:e.type==='fighter'?'fighter':'flanker',speed:profile.speed,
      r:4.5,learnToken:game.enemyLearning?.shotToken(e)})!==false;
  if(fired){
    game.enemyLearning?.fired(e);
    if(cell)cell.nextGunVolleyAt=now+ENEMY_GUNNERY.cellSpacing;
    game._enemyRegularVolleyAt=now+ENEMY_GUNNERY.globalSpacing;
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
  for(const e of game.enemies||[]){
    if(drawn>=limit)break;
    const aim=e._gunAiming;
    if(!aim||e.hp<=0||e.converted||game.time>aim.until||
       distance(e,game.player)>ENEMY_GUNNERY.warningRange||
       e.x<cam.x-30||e.x>cam.x+cam.w+30||
       e.y<cam.y-30||e.y>cam.y+cam.h+30||
       !game.playerCanInspectEnemyIntent(e))continue;
    const profile=ENEMY_GUNNERY[e.type];
    if(!profile)continue;
    const progress=clamp((game.time-aim.started)/profile.charge,0,1);
    const tint=e.type==='fighter'?'#ffab75':'#d0a1ff';
    ctx.save();ctx.strokeStyle=tint;ctx.lineWidth=1.15+progress*.85;
    ctx.globalAlpha=.32+progress*.47;
    ctx.setLineDash([4,7]);ctx.beginPath();ctx.moveTo(e.x,e.y);
    ctx.lineTo(aim.x,aim.y);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(aim.x,aim.y,7+progress*4,0,Math.PI*2);ctx.stroke();
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
      'СОПРОВОЖДАЕТ ГРУЗ';
    ctx.save();ctx.globalAlpha=.82;ctx.textAlign='center';
    ctx.font='bold 9px system-ui';ctx.fillStyle='#f9cc90';
    ctx.fillText(label,e.x,e.y-(e.r||14)-55,190);
    ctx.restore();marked.add(asset);drawn++;
  }
  return drawn;
}
