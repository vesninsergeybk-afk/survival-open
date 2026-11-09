// Tiny drones share one tactical decision per pack. Members remain individual
// damageable ships; a split changes their formation, never their hit points.
export const MOTE_SWARM=Object.freeze({size:10,radius:6.5,hp:12,damage:3,
 speed:177,interval:.34,splitAt:480,splitCount:8,splitHold:7.4,
 mergeDistance:315,allianceDistance:710,maxAlliance:3,
 fireRange:310,fireWarning:.5,fireCooldown:2.4,globalVolley:.48,
 rushRange:225,rushWarning:.6,rushTime:1.3,rushCooldown:6.6,
 rushMultiplier:2.35,escapeAt:2,escapeDistance:1000,
 reinforcementDelay:3.6,maxMotes:40,searchRadius:560});

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const crossed=(x1,y1,x2,y2,p,r)=>{
 const dx=x2-x1,dy=y2-y1,dd=dx*dx+dy*dy;
 const f=dd?Math.max(0,Math.min(1,((p.x-x1)*dx+(p.y-y1)*dy)/dd)):0;
 return Math.hypot(p.x-x1-dx*f,p.y-y1-dy*f)<r;
};
const liveMotes=game=>game.enemies.filter(e=>e.microSwarm&&e.hp>0&&!e.converted);
const groupsOf=motes=>{
 const groups=new Map();
 for(const e of motes){
  const id=e.motePack??e.group;
  if(!groups.has(id))groups.set(id,[]);
  groups.get(id).push(e);
 }
 return groups;
};
const centroid=members=>({x:members.reduce((n,e)=>n+e.x,0)/members.length,
 y:members.reduce((n,e)=>n+e.y,0)/members.length});
const onScreen=(game,point)=>{
 const cam=game.camera?.();
 return !cam||point.x>=cam.x-35&&point.y>=cam.y-35&&
  point.x<=cam.x+cam.w+35&&point.y<=cam.y+cam.h+35;
};
const cueText=(phase,id)=>({
  found:['ЦЕЛЬ ОБНАРУЖЕНА · СХОЖУСЬ','КОНТАКТ ПОДТВЕРЖДЁН · ПРЕСЛЕДУЮ',
    'ВИЖУ ЦЕЛЬ · НАЧИНАЮ ОХОТУ'][id%3],
  flank:['ОБХОД СЛЕВА','ОБХОД СПРАВА','ЗАЖИМАЕМ ЦЕЛЬ'][id%3],
  windup:'ФОРСАЖ · ГОТОВЛЮ РЫВОК',rush:'ФОРСАЖ · АТАКУЮ',
  search:'КОНТАКТ ПОТЕРЯН · ПРОВЕРЯЮ СЕКТОР',
  escape:'ЗВЕНО ПОТЕРЯНО · УХОЖУ ЗА ПОДМОГОЙ',
  return:'ПОДМОГА ПРИБЫЛА · ВОЗОБНОВЛЯЮ ОХОТУ'
})[phase]||'';
function statusCue(state,phase,id,now){
 if(state.phase===phase)return;
 state.phase=phase;state.cue=cueText(phase,Math.abs(id));
 state.cueUntil=now+2.9;
}
function escapePoint(game,e){
 const p=game.player,cam=game.camera?.();
 const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy)||1;
 const side=(e.serial%2===0?1:-1);
 const reach=Math.max(MOTE_SWARM.escapeDistance,
  cam?Math.hypot(cam.w,cam.h)*.67+300:1000);
 return {x:e.x+dx/d*reach-dy/d*side*180,
  y:e.y+dy/d*reach+dx/d*side*180};
}
function markEscape(game,motes,t){
 const byRoot=new Map();
 for(const e of motes){
  const root=e.moteRoot??e.group;
  if(!byRoot.has(root))byRoot.set(root,[]);
  byRoot.get(root).push(e);
 }
 for(const members of byRoot.values()){
  const oldSize=Math.max(...members.map(e=>e.moteOriginCount||0));
  if(oldSize<8||members.length>MOTE_SWARM.escapeAt||
     !members.some(e=>e.moteSawPlayer)||members.some(e=>e.moteCallUsed)||
     game._moteReinforcementQueue?.length)continue;
  const leader=[...members].sort((a,b)=>a.serial-b.serial)[0];
  const goal=escapePoint(game,leader);
  for(const e of members){
   e.moteCallUsed=true;e.moteEscape=true;e.moteEscapeGoal=goal;
   e.moteOrder=goal;e.moteWarning=false;e.moteBoosting=false;
   e.moteAllianceSize=0;
   e.moteStatus='escape';e.moteStatusCue=cueText('escape',e.serial);
   e.moteStatusUntil=t+3.4;
  }
  leader.moteCourier=true;
  game.notice?.('Радиоперехват: уцелевший микродрон уходит за подкреплением. Перехватите его!',4.2);
  game.heritage?.play?.('swarmSplit',.75,leader);
 }
}
function updateCouriers(game,motes,t){
 const queue=game._moteReinforcementQueue??(game._moteReinforcementQueue=[]);
 const escaped=new Map();
 for(const e of motes){
  if(!e.moteEscape)continue;
  const root=e.moteRoot??e.group;
  if(!escaped.has(root))escaped.set(root,[]);
  escaped.get(root).push(e);
 }
 for(const members of escaped.values()){
  if(!members.some(e=>e.moteCourier)){
   members.sort((a,b)=>a.serial-b.serial);
   members[0].moteCourier=true;
  }
 }
 for(const e of motes){
  if(!e.moteEscape)continue;
  e.moteOrder=e.moteEscapeGoal;
  e.moteStatusUntil=t+1;
  if(e.moteCourier&&(!onScreen(game,e)||distance(e,e.moteEscapeGoal)<75)&&
     !e.moteCourierReturning){
   e.moteEscape=false;e.moteCourierReturning=true;
   queue.push({courier:e,at:t+MOTE_SWARM.reinforcementDelay,
     waypoint:e.moteLastSeen||e.moteApproach||{x:e.x,y:e.y}});
  }
 }
 for(let i=queue.length-1;i>=0;i--){
  const job=queue[i];
  if(job.courier.hp<=0){queue.splice(i,1);continue;}
  if(t<job.at)continue;
  const count=game.enemies.filter(e=>e.microSwarm&&e.hp>0).length;
  if(count>MOTE_SWARM.maxMotes-16){job.at=t+2;continue;}
  const created=game.spawnMoteReinforcements?.(job.courier,job.waypoint,16)||0;
  if(created>0){
   for(const e of motes){
    if(e.moteRoot!==job.courier.moteRoot)continue;
    e.moteEscape=false;e.moteCourierReturning=false;e.moteCourier=false;
    e.moteApproach=job.waypoint;e.moteOrder=job.waypoint;
    e.moteReturnUntil=t+3.2;
   }
   game.notice?.('Радиоперехват: микродроны получили подкрепление. Две группы входят в сектор.',4.2);
   queue.splice(i,1);
  }else{job.at=t+3;}
 }
}
function formationCue(game,kind,point,t){
 if(!onScreen(game,point))return;
 const fx=game.moteFormationFx??(game.moteFormationFx=[]);
 fx.push({kind,x:point.x,y:point.y,bornAt:t});
 if(fx.length>8)fx.shift();
 game.heritage?.play?.(kind==='split'?'swarmSplit':'swarmMerge',1.1,point);
}

export function updateMoteSwarmOrders(game){
 const t=game.time||0;
 if(t<(game._nextMoteSwarmAt??-Infinity))return;
 game._nextMoteSwarmAt=t+MOTE_SWARM.interval;
 const motes=liveMotes(game);
 game.moteFormationFx=(game.moteFormationFx||[]).filter(fx=>t-fx.bornAt<1.05);
 if(!motes.length){
  game._moteSquadStates?.clear();game._moteReinforcementQueue=[];return;
 }
 updateCouriers(game,motes,t);
 const seenRoots=game._moteSeenRoots??(game._moteSeenRoots=new Set());
 const liveRoots=new Set(motes.map(e=>e.moteRoot??e.motePack??e.group));
 for(const root of seenRoots)if(!liveRoots.has(root))seenRoots.delete(root);
 let packs=groupsOf(motes.filter(e=>!e.moteEscape&&!e.moteCourierReturning));
 // Close to the player a full swarm breaks into two coordinated flanks.
 for(const [id,members] of packs){
  if(members.length<MOTE_SWARM.splitCount||members.some(e=>t<(e.moteReformUntil||0)))continue;
  if(t<(members[0].moteSpawnedAt??0)+2.2||
     distance(centroid(members),game.player)>MOTE_SWARM.splitAt)continue;
  formationCue(game,'split',centroid(members),t);
  const secondId=++game.groupSerial;
  const sorted=[...members].sort((a,b)=>a.serial-b.serial);
  for(let i=0;i<sorted.length;i++){
   const e=sorted[i];
   e.motePack=i>=Math.ceil(sorted.length/2)?secondId:id;
   e.moteFlank=i>=Math.ceil(sorted.length/2)?1:-1;
   e.moteReformUntil=t+MOTE_SWARM.splitHold;
  }
 }
 packs=groupsOf(motes);
 // Sibling packs rejoin only after their split commitment expires. A surviving
 // pair of motes is still a pack; there is no minimum group size for AI.
 const entries=[...packs];
 for(let i=0;i<entries.length;i++){
  const [id,a]=entries[i];if(!a?.length)continue;
  for(let j=i+1;j<entries.length;j++){
   const [otherId,b]=entries[j];if(!b?.length||
      a.length+b.length>MOTE_SWARM.size||
      [...a,...b].some(e=>t<(e.moteReformUntil||0))||
      distance(centroid(a),centroid(b))>MOTE_SWARM.mergeDistance)continue;
   formationCue(game,'merge',centroid([...a,...b]),t);
   for(const e of b){e.motePack=id;
    e.moteFlank=0;e.moteReformUntil=t+4.2;}
   a.push(...b);entries[j][1]=[];
  }
 }
 // A full pack cannot physically merge with another full pack. It can share
 // orders, however: the alliance is a bounded command network, not a new unit.
 packs=groupsOf(motes.filter(e=>!e.moteEscape&&!e.moteCourierReturning));
 const linked=new Map([...packs.keys()].map(id=>[id,new Set([id])]));
 const positions=new Map([...packs].map(([id,members])=>[id,centroid(members)]));
 const ids=[...packs.keys()].sort((a,b)=>a-b);
 for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
  const a=ids[i],b=ids[j];
  if(distance(positions.get(a),positions.get(b))>MOTE_SWARM.allianceDistance||
     ![...packs.get(a),...packs.get(b)].some(e=>e.moteSawPlayer||
       (distance(e,game.player)<950&&
        (!game.enemyCanSee||game.enemyCanSee(e,game.player)))))continue;
  if(linked.get(a).size>=MOTE_SWARM.maxAlliance||
     linked.get(b).size>=MOTE_SWARM.maxAlliance)continue;
  const combined=new Set([...linked.get(a),...linked.get(b)]);
  if(combined.size>MOTE_SWARM.maxAlliance)continue;
  for(const member of combined)linked.set(member,combined);
 }
 const states=game._moteSquadStates??(game._moteSquadStates=new Map());
 for(const id of states.keys())if(!packs.has(id))states.delete(id);
 for(const [id,members] of packs){
  members.sort((a,b)=>a.serial-b.serial);
  const center=centroid(members),p=game.player;
  const root=members[0].moteRoot??id;
  if(onScreen(game,center)&&!seenRoots.has(root)){
   seenRoots.add(root);
   game.heritage?.play?.('swarmArrival',2.1,center);
  }
  const within=distance(center,p);
  const canSee=within<950&&members.some(e=>
   !game.enemyCanSee||game.enemyCanSee(e,p));
  const allies=[...linked.get(id)].sort((a,b)=>a-b);
  const state=states.get(id)||{nextShotAt:t+1.8,nextRushAt:t+2.1,
   warningAt:null,lastKnown:members[0].moteLastSeen||null};
  if(canSee){
   state.lastKnown={x:p.x,y:p.y,vx:p.vx||0,vy:p.vy||0,at:t};
   for(const e of members){e.moteSawPlayer=true;e.moteLastSeen=state.lastKnown;}
  }else{
   // Wingmen share real, time-stamped sightings over the local pack network.
   const report=allies.map(key=>states.get(key)?.lastKnown)
    .filter(memory=>memory&&t-memory.at<4).sort((a,b)=>b.at-a.at)[0];
   if(report&&(!state.lastKnown||report.at>state.lastKnown.at))
    state.lastKnown={...report};
  }
  const age=t-(state.lastKnown?.at??-Infinity);
  // A confirmed hunter keeps searching until destroyed or contact is renewed.
  // Its search is restricted to the LAST observed sector: it cannot use the
  // player's current coordinates after losing optical contact.
  const recent=age<4.5,pursuing=!!state.lastKnown;
  const radius=Math.min(MOTE_SWARM.searchRadius,48+Math.max(0,age-4.5)*10);
  const searchAngle=t*.31+id*1.7;
  const waypoint=recent?state.lastKnown:pursuing?
   {x:state.lastKnown.x+Math.cos(searchAngle)*radius,
    y:state.lastKnown.y+Math.sin(searchAngle)*radius}:
   members[0].moteApproach||center;
  const dx=waypoint.x-center.x,dy=waypoint.y-center.y;
  const d=Math.hypot(dx,dy)||1,nx=dx/d,ny=dy/d;
  // At close range the pack orbits instead of crashing into the player.
  const close=recent&&d<190;
  const slot=allies.indexOf(id),alliedFlank=allies.length>1?(slot%2===0?-1:1):0;
  const flank=t<(members[0].moteReformUntil||0)?(members[0].moteFlank||0):alliedFlank;
  const forward=close?22:Math.min(165,Math.max(35,d-135));
  const anchor={x:center.x+nx*forward-ny*(close?85:flank*135),
   y:center.y+ny*forward+nx*(close?85:flank*135)};
  if(canSee&&!state.lastCueContact)statusCue(state,'found',id,t);
  if(!canSee&&state.lastCueContact&&pursuing)statusCue(state,'search',id,t);
  state.lastCueContact=!!canSee;
  if(allies.length>1&&canSee&&t>=(state.rushUntil||0)&&t>=(state.cueUntil||0))
   statusCue(state,'flank',id,t);
  if(t<(members[0].moteReturnUntil||0))statusCue(state,'return',id,t);
  else if(state.phase==='return')statusCue(state,'found',id,t);
  if((!recent||within>MOTE_SWARM.rushRange+80)&&state.rushChargeAt){
   state.rushChargeAt=0;statusCue(state,'found',id,t);
  }
  const preparingRush=recent&&within<MOTE_SWARM.rushRange&&
   t>=(state.nextRushAt??Infinity)&&t>=(game._moteGlobalRushAt||0);
  if(preparingRush&&!state.rushChargeAt){
   state.rushChargeAt=t+MOTE_SWARM.rushWarning;
   statusCue(state,'windup',id,t);
  }
  if(state.rushChargeAt&&t>=state.rushChargeAt){
   state.rushChargeAt=0;state.rushUntil=t+MOTE_SWARM.rushTime;
   state.nextRushAt=t+MOTE_SWARM.rushCooldown;
   game._moteGlobalRushAt=t+2.0;
   statusCue(state,'rush',id,t);
   game.heritage?.play?.('swarmWarning',.85,center);
  }
  if(t>=(state.rushUntil||0)&&state.phase==='rush')statusCue(state,'found',id,t);
  members.forEach((e,index)=>{
   const row=Math.floor(index/3),column=index%3-1;
   const jitter=Math.sin(t*1.55+e.serial*.81)*2.5;
   const lateral=column*22+(row%2)*11+jitter;
   const depth=(row-1)*23;
   const rush=t<(state.rushUntil||0)&&index%3===0;
   e.moteBoosting=rush;
   e.moteOrder=rush?
    {x:waypoint.x+Math.max(-35,Math.min(35,(waypoint.vx||0)*.10)),
     y:waypoint.y+Math.max(-35,Math.min(35,(waypoint.vy||0)*.10))}:
    {x:anchor.x-ny*lateral-nx*depth,y:anchor.y+nx*lateral-ny*depth};
   e.moteLeader=index===0;
   e.motePackCount=members.length;
   e.moteAllianceSize=allies.length;
   e.moteAllianceKey=allies[0];
   e.moteStatus=state.phase;e.moteStatusCue=state.cue;
   e.moteStatusUntil=state.cueUntil;
  });
  // One telegraphed projectile per pack. Ten motes never fire ten shots at once.
  const shooter=members.find(e=>t>=(e.stasisUntil||0)&&distance(e,p)<MOTE_SWARM.fireRange&&
   (!game.enemyCanSee||game.enemyCanSee(e,p)));
  if(shooter&&canSee&&t>=state.nextShotAt){
   if(state.warningAt==null){
    state.warningAt=t;
    game.heritage?.play?.('swarmWarning',1.6,shooter);
   }
   if(t-state.warningAt>=MOTE_SWARM.fireWarning&&
      t>=(game._moteGlobalVolleyAt||0)&&game.enemyShot){
    const lead=.16;
    const fired=game.enemyShot(shooter.x,shooter.y,p.x+(p.vx||0)*lead,
     p.y+(p.vy||0)*lead,4,{kind:'mote',speed:315,r:3.5});
    if(fired!==false){state.nextShotAt=t+MOTE_SWARM.fireCooldown;
     game._moteGlobalVolleyAt=t+MOTE_SWARM.globalVolley;
     state.warningAt=null;}
   }
  }else if(!shooter||!canSee)state.warningAt=null;
  for(const e of members)e.moteWarning=state.warningAt!=null;
  states.set(id,state);
 }
 markEscape(game,motes,t);
}

export function moveMote(e,game,dt){
 const target=e.moteOrder||e.moteApproach;
 if(!target)return;
 const oldX=e.x,oldY=e.y;
 const dx=target.x-e.x,dy=target.y-e.y,d=Math.hypot(dx,dy)||1;
 const speed=MOTE_SWARM.speed*(e._tacticalSpeed??1)*
  (e.moteBoosting?MOTE_SWARM.rushMultiplier:e.moteEscape?1.5:1);
 const avoid=game.avoidance?.(e.x,e.y,17)||{x:0,y:0};
 // Individual drones make short lateral corrections under fire. These alter
 // only their velocity: neither projectile tracking nor their hitbox changes.
 let incoming=false;
 if(!e.moteEscape&&!e.moteCourierReturning&&!e.moteBoosting){
  for(const missile of game.missiles||[]){
   if(missile.life>0&&missile.target===e&&distance(missile,e)<180){
    incoming=true;break;
   }
  }
 }
 if((incoming||(e.hit||0)>.02)&&game.time>=(e._moteDodgeCooldown||0)&&
    !e.moteEscape&&!e.moteCourierReturning&&!e.moteBoosting){
  e._moteDodgeUntil=game.time+.55;
  e._moteDodgeCooldown=game.time+2.2+(Math.abs(e.serial)%4)*.24;
  e._moteDodgeSide=(Math.floor(game.time*2)+e.serial)%2?1:-1;
 }
 e.moteDodging=game.time<(e._moteDodgeUntil||0)&&
   !e.moteEscape&&!e.moteBoosting;
 const sway=e.moteEscape||e.moteBoosting?0:
  Math.sin(game.time*2.4+e.serial*1.73)*speed*.22;
 const lateral=sway+(e.moteDodging?e._moteDodgeSide*speed*.65:0);
 const aimX=dx/d*speed+avoid.x*speed*.65-dy/d*lateral;
 const aimY=dy/d*speed+avoid.y*speed*.65+dx/d*lateral;
 const blend=1-Math.exp(-5*Math.min(dt,.06));
 e.vx+=(aimX-e.vx)*blend;e.vy+=(aimY-e.vy)*blend;
 e.x+=e.vx*dt;e.y+=e.vy*dt;
 if(Math.hypot(e.vx,e.vy)>10)e.angle=Math.atan2(e.vy,e.vx)+Math.PI/2;
 // Normal micro-drones can be dangerous at contact. A dash sacrifices the
 // attacker, so immunity frames still prevent a whole swarm from one-shotting.
 const p=game.player;
 if(!e.moteEscape&&!e.moteCourierReturning&&p?.hp>0&&e.moteBoosting&&
    crossed(oldX,oldY,e.x,e.y,p,e.r+(p.r||0))){
  if(p.invul<=0)game.hurt?.(e.damage??MOTE_SWARM.damage,{x:e.x,y:e.y});
  e.hp=0;
 }
}

export function drawMoteSwarms(c,enemies,cam,t,reducedMotion=false,formations=[]){
 const packs=groupsOf(enemies.filter(e=>e.microSwarm&&e.hp>0));
 c.save();
 const allianceCentres=new Map();
 for(const members of packs.values()){
  const visible=members.filter(e=>e.x>cam.x-20&&e.y>cam.y-20&&
   e.x<cam.x+cam.w+20&&e.y<cam.y+cam.h+20);
  if(!visible.length)continue;
  const center=centroid(visible);
  if(members[0].moteAllianceSize>1){
   const key=members[0].moteAllianceKey;
   if(!allianceCentres.has(key))allianceCentres.set(key,[]);
   allianceCentres.get(key).push(center);
  }
  c.strokeStyle='#69bdff';c.lineWidth=.8;c.globalAlpha=.28;
  for(const e of visible){c.beginPath();c.moveTo(center.x,center.y);
   c.lineTo(e.x,e.y);c.stroke();}
  if(visible.length>=3){
   c.globalAlpha=.76;c.fillStyle='#8dd8ff';c.font='bold 10px system-ui';
   c.textAlign='center';c.fillText('РОЙ ×'+members.length,center.x,center.y-46);
  }
  const call=members.find(e=>e.moteStatusCue&&t<(e.moteStatusUntil||0));
  if(call){
   c.globalAlpha=.93;c.fillStyle=call.moteEscape?'#ffb27e':'#c6eaff';
   c.font='bold 9px system-ui';c.textAlign='center';
   c.fillText(call.moteStatusCue,center.x,center.y-64,300);
  }
  if(visible.some(e=>e.moteWarning)){
   const r=32+(reducedMotion?0:4*Math.sin(t*8));
   c.strokeStyle='#ffb67d';c.lineWidth=1.7;c.globalAlpha=.72;
   c.beginPath();c.arc(center.x,center.y,r,-Math.PI*.83,-Math.PI*.17);c.stroke();
   c.beginPath();c.arc(center.x,center.y,r,Math.PI*.17,Math.PI*.83);c.stroke();
  }
  // The ordinary enemy renderer skips micro-drones, so their encounter cue
  // must be painted here. Its timer starts only when the pack is visible.
  const cue=members.find(e=>e.encounterLabel);
  if(cue){
   if(cue.encounterLabelStart===undefined)cue.encounterLabelStart=t;
   if(t-cue.encounterLabelStart<3){
    c.globalAlpha=.95;c.fillStyle='#ffe0b1';c.font='bold 11px system-ui';
    c.textAlign='center';c.shadowColor='#071322';c.shadowBlur=7;
    c.fillText(cue.encounterLabel,center.x,center.y-70,350);c.shadowBlur=0;
   }
  }
 }
 for(const centres of allianceCentres.values()){
  if(centres.length<2)continue;
  c.globalAlpha=.27;c.strokeStyle='#80d5ff';c.lineWidth=1.4;
  c.setLineDash([5,9]);c.beginPath();
  centres.forEach((point,i)=>i?c.lineTo(point.x,point.y):c.moveTo(point.x,point.y));
  c.stroke();c.setLineDash([]);
 }
 c.restore();
 c.save();
 for(const fx of formations){
  const k=Math.max(0,Math.min(1,(t-fx.bornAt)/1.05));
  if(k>=1||fx.x<cam.x-100||fx.y<cam.y-100||fx.x>cam.x+cam.w+100||fx.y>cam.y+cam.h+100)continue;
  const split=fx.kind==='split',r=split?21+58*k:72-47*k;
  c.strokeStyle=split?'#77d9ff':'#d2adff';c.lineWidth=2.3*(1-k)+.6;c.globalAlpha=(1-k)*.7;
  c.beginPath();c.arc(fx.x,fx.y,r,0,Math.PI*2);c.stroke();
  c.lineWidth=1.2;
  for(const sign of [-1,1]){
   const x=fx.x+sign*(split?38*k:38*(1-k));
   c.beginPath();c.arc(x,fx.y,split?12+7*k:12+7*(1-k),0,Math.PI*2);c.stroke();
  }
  if(k<.65){
   c.globalAlpha=(1-k/.65)*.8;c.fillStyle=split?'#b0eaff':'#e5d3ff';
   c.font='bold 10px system-ui';c.textAlign='center';
   c.fillText(split?'РОЙ РАЗДЕЛЯЕТСЯ':'РОЙ ОБЪЕДИНЯЕТСЯ',fx.x,fx.y-r-14);
  }
 }
 c.restore();
 for(const e of enemies){
  if(!e.microSwarm||e.hp<=0||e.x<cam.x-25||e.y<cam.y-25||
    e.x>cam.x+cam.w+25||e.y>cam.y+cam.h+25)continue;
  c.save();c.translate(e.x,e.y);c.rotate(e.angle||0);
  const pulse=reducedMotion?1:1+.12*Math.sin(t*8+e.serial);
  c.fillStyle=e.hit>0?'#ffffff':'#6ac9ff';c.globalAlpha=.32;
  c.beginPath();c.arc(0,0,10*pulse,0,Math.PI*2);c.fill();
  c.globalAlpha=1;c.fillStyle='#2e5b85';c.strokeStyle='#a7e7ff';c.lineWidth=1.2;
  c.beginPath();c.moveTo(0,-7);c.lineTo(5,4);c.lineTo(0,2);
  c.lineTo(-5,4);c.closePath();c.fill();c.stroke();
  c.fillStyle=e.moteWarning?'#ffcb92':'#b9f5ff';
  c.beginPath();c.arc(0,-1,2.3,0,Math.PI*2);c.fill();
  if(e.moteBoosting){
   c.strokeStyle='#77edff';c.lineWidth=3;c.globalAlpha=.8;
   c.beginPath();c.moveTo(-2,5);c.lineTo(0,17+(reducedMotion?0:4*Math.sin(t*19+e.serial)));
   c.lineTo(2,5);c.stroke();
  }else if(e.moteStatus==='windup'){
   c.strokeStyle='#ffa567';c.lineWidth=1.6;c.globalAlpha=.8;
   c.beginPath();c.arc(0,0,11,0,Math.PI*2);c.stroke();
  }else if(e.moteDodging){
   c.strokeStyle='#b7efff';c.lineWidth=1.4;c.globalAlpha=.72;
   c.beginPath();c.moveTo(-10,-3);c.lineTo(-17,1);
   c.moveTo(10,-3);c.lineTo(17,1);c.stroke();
  }
  c.restore();
 }
}
