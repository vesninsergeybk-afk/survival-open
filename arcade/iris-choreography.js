import {irisFreeHunter} from './iris-swarm.js?v=iris-swarm-2';

/** A cheap combat director, deliberately unlike one-brain-per-drone flocking.
 * It assigns a few attackers and many visible staging positions once per
 * cycle, then lets each drone fly there under the ordinary physics solver.
 * No spawn changes, perfect player prediction, invulnerability or new damage. */
export const IRIS_PACK=Object.freeze({
  minimum:4,range:560,cycle:5.2,shapeUntil:1.45,
  strikeUntil:3.55,checkInterval:.52,openAngle:1.12,
  reservePerRing:12,separationRadius:69
});
const TAU=Math.PI*2;
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const normAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const gap=(a,b)=>Math.abs(normAngle(a-b));
const eligible=(e,g,p)=>irisFreeHunter(e,p)&&
  (!e.signalIntel||e.signalIntel.mode==='engaged')&&d(e,p)<=IRIS_PACK.range;
const choose=(pool,angle,player)=>{
  let pick=null,best=Infinity;
  for(const e of pool){
    const angleTo=Math.atan2(e.y-player.y,e.x-player.x);
    const score=d(e,player)+gap(angleTo,angle)*68+
      (Math.abs(e.serial||0)%11)*.005;
    if(score<best){best=score;pick=e;}
  }
  if(pick)pool.splice(pool.indexOf(pick),1);
  return pick;
};

function build(game,previous=null){
  const p=game.player,all=(game.grid?.query(p.x,p.y,IRIS_PACK.range)||[])
    .filter(e=>eligible(e,game,p))
    .sort((a,b)=>d(a,p)-d(b,p)||(a.serial||0)-(b.serial||0));
  if(all.length<IRIS_PACK.minimum)return null;
  const count=all.length;
  // The pack attacks from its own observed side of the player. This baseline
  // remains fixed during the cycle; world positions themselves are not fixed.
  let mx=0,my=0;
  for(const e of all){mx+=(e.x-p.x)/Math.max(50,d(e,p));my+=(e.y-p.y)/Math.max(50,d(e,p));}
  const centerAngle=Math.atan2(my,mx);
  const gapAngle=normAngle(centerAngle+Math.PI);
  const velocity=Math.hypot(p.vx||0,p.vy||0);
  let interceptAngle=velocity>75?Math.atan2(p.vy,p.vx):centerAngle+2.02;
  // Even a very fast player keeps an intentional escape corridor: the pack
  // may contest its edges, but never plugs the whole opening at once.
  if(gap(interceptAngle,gapAngle)<IRIS_PACK.openAngle*.75)
    interceptAngle=gapAngle+(normAngle(interceptAngle-gapAngle)<0?-1:1)*.94;
  const pool=[...all],roles=new Map();
  const put=(role,angle)=>{
    const e=choose(pool,angle,p);
    if(e)roles.set(e,{role,angle});
  };
  put('vanguard',centerAngle);
  put('left',centerAngle+1.34);
  put('right',centerAngle-1.34);
  if(count>=8)put('intercept',interceptAngle);
  if(count>=16)put('sweeper',centerAngle+.72);
  if(count>=28)put('sweeper2',centerAngle-.72);
  // Two distant screeners keep intermittent crossfire during the approach
  // and the regroup. Their positions stay outside the escape corridor.
  if(count>=10){put('sentryL',centerAngle+1.9);put('sentryR',centerAngle-1.9);}
  const frontCount=roles.size;
  const reserveCount=pool.length;
  for(let index=0;index<reserveCount;index++){
    const e=pool[index],ring=Math.floor(index/IRIS_PACK.reservePerRing);
    const slot=index%IRIS_PACK.reservePerRing;
    const ringCount=Math.min(IRIS_PACK.reservePerRing,
      reserveCount-ring*IRIS_PACK.reservePerRing);
    const arc=TAU-IRIS_PACK.openAngle;
    const angle=gapAngle+IRIS_PACK.openAngle/2+
      (slot+.5)*arc/ringCount;
    roles.set(e,{role:'reserve',angle,ring,index});
  }
  return {
    start:game.time,until:game.time+IRIS_PACK.cycle,
    nextCheck:game.time+IRIS_PACK.checkInterval,
    roles,vanguard:all.find(e=>roles.get(e)?.role==='vanguard'),
    frontCount,reserveList:[...pool],count,centerAngle,gapAngle,
    cycle:(previous?.cycle||0)+1
  };
}

function current(game){
  const now=game.time,p=game.player;
  let plan=game._irisPackPlan;
  if(!plan&&now<(game._irisPackRetryAt||0))return null;
  if(!plan||now>=plan.until){
    plan=build(game,plan);game._irisPackPlan=plan;
    if(!plan)game._irisPackRetryAt=now+.65;
    return plan;
  }
  if(now<plan.nextCheck)return plan;
  plan.nextCheck=now+IRIS_PACK.checkInterval;
  let surviving=0;
  for(const [e] of plan.roles)if(eligible(e,game,p))surviving++;
  if(surviving<IRIS_PACK.minimum){
    plan=build(game,plan);game._irisPackPlan=plan;
    if(!plan)game._irisPackRetryAt=now+.65;
  }else if(plan.vanguard?.hp<=0){
    // A dead caller creates a short, readable break in pressure. Promote a
    // survivor without resetting the cycle and perpetually postponing attack.
    const replacement=[...plan.roles].filter(([e,a])=>
      a.role==='reserve'&&eligible(e,game,p))
      .sort(([a],[b])=>d(a,p)-d(b,p))[0];
    if(replacement){
      replacement[1].role='vanguard';replacement[1].angle=plan.centerAngle;
      plan.vanguard=replacement[0];plan.brokenUntil=now+.65;
    }
  }
  return plan;
}

export function irisPackPhase(plan,now){
  if(!plan)return 'single';
  if(now<(plan.brokenUntil||0))return 'regroup';
  const age=now-plan.start;
  return age<IRIS_PACK.shapeUntil?'form':
    age<IRIS_PACK.strikeUntil?'strike':'regroup';
}

export function irisPackMayFire(e,game){
  if(!irisFreeHunter(e,game.player))return true;
  const plan=game._irisPackPlan;
  if(!plan||game.time>=plan.until)return true;
  const assignment=plan.roles.get(e);
  if(!assignment)return true;
  if(game.time<(plan.brokenUntil||0))return false;
  const phase=irisPackPhase(plan,game.time);
  if(assignment.role==='reserve'){
    // Two rotating pickets provide sparse, directional suppressive fire.
    // Nobody else in the outer ring opens up at once; the existing global
    // projectile-spacing gate remains the ultimate wall-of-bullets limit.
    const count=plan.reserveList.length;
    const start=(Math.floor((game.time-plan.start)/1.25)*2)%count;
    return count>0&&(assignment.index===start||
      (count>1&&assignment.index===(start+1)%count));
  }
  return assignment.role==='vanguard'||
    (phase==='form'&&assignment.role==='left')||
    (phase==='strike'&&assignment.role!=='reserve')||
    (phase==='regroup'&&plan.count>=12&&assignment.role==='right')||
    assignment.role==='sentryL'||assignment.role==='sentryR';
}

/** Direction of the dancer's world-space tactical point. Called every frame,
 * but the expensive group composition is revisited only at phase boundaries.
 */
export function irisPackDirective(e,game){
  if(!irisFreeHunter(e,game.player)||
     e.signalIntel&&e.signalIntel.mode!=='engaged')return null;
  const plan=current(game);
  let role=plan?.roles.get(e);
  if(plan&&!role&&eligible(e,game,game.player)){
    // Newly arriving ships join a reserve ring without restarting an assault.
    const index=plan.reserveList.length;
    const ring=Math.floor(index/IRIS_PACK.reservePerRing);
    const slot=index%IRIS_PACK.reservePerRing;
    const arc=TAU-IRIS_PACK.openAngle;
    const angle=plan.gapAngle+IRIS_PACK.openAngle/2+
      (slot+.5)*arc/IRIS_PACK.reservePerRing;
    role={role:'reserve',angle,ring,index};plan.roles.set(e,role);
    plan.reserveList.push(e);
  }
  if(!role)return null;
  const phase=irisPackPhase(plan,game.time),p=game.player;
  let radius=0,speed=1;
  if(role.role==='vanguard'){
    radius=phase==='form'?220:phase==='strike'?155:275;
    speed=phase==='strike'?1.38:phase==='regroup'?1.14:1.03;
  }else if(role.role==='left'||role.role==='right'){
    radius=phase==='form'?310:phase==='strike'?208:320;
    speed=phase==='strike'?1.48:1.1;
  }else if(role.role==='intercept'){
    radius=phase==='form'?340:phase==='strike'?220:350;
    speed=phase==='strike'?1.5:1.1;
  }else if(role.role==='sweeper'||role.role==='sweeper2'){
    radius=phase==='form'?315:phase==='strike'?190:345;
    speed=phase==='strike'?1.39:1.08;
  }else if(role.role==='sentryL'||role.role==='sentryR'){
    radius=phase==='regroup'?342:318;
    speed=1.02;
  }else{
    radius=345+(role.ring||0)*39;
    speed=.88;
  }
  // A single controlled direction change announces the strike. No projectiles
  // or teleports are spawned; the existing steering blend does the turning.
  const x=p.x+Math.cos(role.angle)*radius;
  const y=p.y+Math.sin(role.angle)*radius;
  e._irisPackRole=role.role;e._irisPackPhase=phase;
  e._irisPackCueUntil=game.time+.17;
  if(role.role==='reserve'||phase!=='strike'){
    // A non-attacker must not wear the wingman's acceleration cue. An actual
    // retreat still takes priority over any assigned formation point.
    e._irisWingUntil=0;
  }
  return {mode:role.role,x,y,speed,phase};
}

/** Close-range separation, sampled only 4-6 times/s per drone. */
export function irisPackSeparation(e,game){
  if(game.time<(e._irisSepNext||0))return e._irisSep||{x:0,y:0};
  e._irisSepNext=game.time+.17+(Math.abs(e.serial||0)%4)*.018;
  let x=0,y=0;
  for(const other of game.grid?.query(e.x,e.y,IRIS_PACK.separationRadius)||[]){
    if(other===e||other.type!=='scout'||other.hp<=0)continue;
    const dx=e.x-other.x,dy=e.y-other.y,range=Math.hypot(dx,dy);
    if(range<.001||range>IRIS_PACK.separationRadius)continue;
    const force=(IRIS_PACK.separationRadius-range)/IRIS_PACK.separationRadius;
    x+=dx/range*force;y+=dy/range*force;
  }
  const length=Math.hypot(x,y),scale=length>1?1/length:1;
  e._irisSep={x:x*scale,y:y*scale};return e._irisSep;
}
