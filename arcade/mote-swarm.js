// Tiny drones share one tactical decision per pack. Members remain individual
// damageable ships; a split changes their formation, never their hit points.
export const MOTE_SWARM=Object.freeze({size:10,radius:6.5,hp:12,damage:3,
 speed:177,interval:.34,splitAt:480,splitCount:8,splitHold:7.4,
 mergeDistance:315,fireRange:310,fireWarning:.5,fireCooldown:2.4});

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
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
 if(!motes.length){game._moteSquadStates?.clear();return;}
 const seenRoots=game._moteSeenRoots??(game._moteSeenRoots=new Set());
 const liveRoots=new Set(motes.map(e=>e.moteRoot??e.motePack??e.group));
 for(const root of seenRoots)if(!liveRoots.has(root))seenRoots.delete(root);
 let packs=groupsOf(motes);
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
   for(const e of b){e.motePack=id;e.moteRoot=a[0].moteRoot;
    e.moteFlank=0;e.moteReformUntil=t+4.2;}
   a.push(...b);entries[j][1]=[];
  }
 }
 packs=groupsOf(motes);
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
  const state=states.get(id)||{nextShotAt:t+1.8,warningAt:null,lastKnown:null};
  if(canSee)state.lastKnown={x:p.x,y:p.y,at:t};
  const recent=state.lastKnown&&t-state.lastKnown.at<4.5;
  const waypoint=recent?state.lastKnown:members[0].moteApproach||center;
  const dx=waypoint.x-center.x,dy=waypoint.y-center.y;
  const d=Math.hypot(dx,dy)||1,nx=dx/d,ny=dy/d;
  // At close range the pack orbits instead of crashing into the player.
  const close=recent&&d<190;
  const flank=t<(members[0].moteReformUntil||0)?(members[0].moteFlank||0):0;
  const forward=close?22:Math.min(165,Math.max(35,d-135));
  const anchor={x:center.x+nx*forward-ny*(close?85:flank*95),
   y:center.y+ny*forward+nx*(close?85:flank*95)};
  members.forEach((e,index)=>{
   const row=Math.floor(index/3),column=index%3-1;
   const jitter=Math.sin(t*1.55+e.serial*.81)*2.5;
   const lateral=column*22+(row%2)*11+jitter;
   const depth=(row-1)*23;
   e.moteOrder={x:anchor.x-ny*lateral-nx*depth,
    y:anchor.y+nx*lateral-ny*depth};
   e.moteLeader=index===0;
   e.motePackCount=members.length;
  });
  // One telegraphed projectile per pack. Ten motes never fire ten shots at once.
  const shooter=members.find(e=>t>=(e.stasisUntil||0)&&distance(e,p)<MOTE_SWARM.fireRange&&
   (!game.enemyCanSee||game.enemyCanSee(e,p)));
  if(shooter&&canSee&&t>=state.nextShotAt){
   if(state.warningAt==null){
    state.warningAt=t;
    game.heritage?.play?.('swarmWarning',1.6,shooter);
   }
   if(t-state.warningAt>=MOTE_SWARM.fireWarning&&game.enemyShot){
    const lead=.16;
    const fired=game.enemyShot(shooter.x,shooter.y,p.x+(p.vx||0)*lead,
     p.y+(p.vy||0)*lead,4,{kind:'iris',speed:245,r:3.5});
    if(fired!==false){state.nextShotAt=t+MOTE_SWARM.fireCooldown;
     state.warningAt=null;}
   }
  }else if(!shooter||!canSee)state.warningAt=null;
  for(const e of members)e.moteWarning=state.warningAt!=null;
  states.set(id,state);
 }
}

export function moveMote(e,game,dt){
 const target=e.moteOrder||e.moteApproach;
 if(!target)return;
 const dx=target.x-e.x,dy=target.y-e.y,d=Math.hypot(dx,dy)||1;
 const speed=MOTE_SWARM.speed*(e._tacticalSpeed??1);
 const avoid=game.avoidance?.(e.x,e.y,17)||{x:0,y:0};
 const aimX=dx/d*speed+avoid.x*speed*.65;
 const aimY=dy/d*speed+avoid.y*speed*.65;
 const blend=1-Math.exp(-5*Math.min(dt,.06));
 e.vx+=(aimX-e.vx)*blend;e.vy+=(aimY-e.vy)*blend;
 e.x+=e.vx*dt;e.y+=e.vy*dt;
 if(Math.hypot(e.vx,e.vy)>10)e.angle=Math.atan2(e.vy,e.vx)+Math.PI/2;
}

export function drawMoteSwarms(c,enemies,cam,t,reducedMotion=false,formations=[]){
 const packs=groupsOf(enemies.filter(e=>e.microSwarm&&e.hp>0));
 c.save();
 for(const members of packs.values()){
  const visible=members.filter(e=>e.x>cam.x-20&&e.y>cam.y-20&&
   e.x<cam.x+cam.w+20&&e.y<cam.y+cam.h+20);
  if(!visible.length)continue;
  const center=centroid(visible);
  c.strokeStyle='#69bdff';c.lineWidth=.8;c.globalAlpha=.28;
  for(const e of visible){c.beginPath();c.moveTo(center.x,center.y);
   c.lineTo(e.x,e.y);c.stroke();}
  if(visible.length>=3){
   c.globalAlpha=.76;c.fillStyle='#8dd8ff';c.font='bold 10px system-ui';
   c.textAlign='center';c.fillText('РОЙ ×'+members.length,center.x,center.y-46);
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
  c.restore();
 }
}
