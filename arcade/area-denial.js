// Ships, not invisible off-screen artillery, launch delayed mines at a pilot
// who keeps fighting inside a small patch. Circling that patch is not an escape.
export const AREA_DENIAL=Object.freeze({
 warmup:55,sampleEvery:.35,history:5.7,exposure:5.1,
 maximumOrbitRadius:185,hostileRange:900,cooldown:14,
 mineCount:3,mineSpread:100,mineRadius:155,
 flightSeconds:.68,armingSeconds:.32,armedFuse:1.2,
 blastDamage:52,hullTransfer:.33,
 interceptRange:165,interceptCooldown:1.35
});

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const LAUNCHER_TYPES=new Set(['scout','fighter','flanker','gunship']);

export function createAreaDenial(){
 return {samples:[],nextSampleAt:0,nextChargeAt:0};
}

function launchersNear(game,point){
 return (game.enemies||[]).filter(e=>e.hp>0&&!e.converted&&
  !e.trialRetreatUntil&&!e.microDrone&&LAUNCHER_TYPES.has(e.type)&&
  distance(e,point)<=AREA_DENIAL.hostileRange);
}

function makeVolley(source,point,now){
 const spec=AREA_DENIAL,span=spec.mineSpread,angle=
  Math.atan2(point.y-source.y,point.x-source.x)+Math.PI*.5;
 const mines=Array.from({length:spec.mineCount},(_,i)=>{
  const a=angle+i*Math.PI*2/spec.mineCount;
  const targetX=point.x+Math.cos(a)*span,targetY=point.y+Math.sin(a)*span;
  const direction=Math.atan2(targetY-source.y,targetX-source.x);
  const side=(i-1)*12;
  const sx=source.x+Math.cos(direction)*Math.max(15,source.r||16)-
   Math.sin(direction)*side;
  const sy=source.y+Math.sin(direction)*Math.max(15,source.r||16)+
   Math.cos(direction)*side;
  return {x:sx,y:sy,sx,sy,tx:targetX,ty:targetY,r:spec.mineRadius,
   arc:(i-1)*85,intercepted:false};
 });
 const fuse=spec.flightSeconds+spec.armingSeconds+spec.armedFuse;
 return {kind:'enemy-mine-volley',x:point.x,y:point.y,
  r:spec.mineSpread+spec.mineRadius,fuse,fuseStart:fuse,age:0,
  ttl:.62,damage:spec.blastDamage,launcherId:source.serial,launcherType:source.type,
  launcherX:source.x,launcherY:source.y,startedAt:now,mines};
}

export function trackAreaDenial(game){
 const state=game.areaDenial,p=game.player,now=game.time;
 if(!state||!p||now<AREA_DENIAL.warmup||game.contourTrial){
  if(state){state.samples.length=0;state.nextSampleAt=now;}
  return null;
 }
 if(now<state.nextSampleAt)return null;
 state.nextSampleAt=now+AREA_DENIAL.sampleEvery;
 state.samples.push({x:p.x,y:p.y,t:now});
 state.samples=state.samples.filter(s=>now-s.t<=AREA_DENIAL.history);
 if(now<state.nextChargeAt||state.samples.length<3||
    now-state.samples[0].t<AREA_DENIAL.exposure)return null;
 const x=state.samples.reduce((sum,s)=>sum+s.x,0)/state.samples.length;
 const y=state.samples.reduce((sum,s)=>sum+s.y,0)/state.samples.length;
 if(state.samples.some(s=>Math.hypot(s.x-x,s.y-y)>AREA_DENIAL.maximumOrbitRadius))return null;
 // No surviving launcher means no mines. Keep the positioning history so a
 // newly arrived ship can respond immediately to an already entrenched pilot.
 const enemies=launchersNear(game,{x,y});
 if(!enemies.length)return null;
 if((game.zones||[]).some(z=>z.fuse>0&&
   distance(z,p)<z.r+AREA_DENIAL.mineRadius))return null;
 const source=enemies.sort((a,b)=>distance(a,{x,y})-distance(b,{x,y}))[0];
 state.samples.length=0;
 state.nextChargeAt=now+AREA_DENIAL.cooldown;
 return makeVolley(source,{x,y},now);
}

export function minePosition(mine,age,flight=AREA_DENIAL.flightSeconds){
 const u=clamp(age/flight,0,1);
 const dx=mine.tx-mine.sx,dy=mine.ty-mine.sy,length=Math.hypot(dx,dy)||1;
 const curve=Math.sin(Math.PI*u)*(mine.arc||0);
 return {x:mine.sx+dx*u-dy/length*curve,
  y:mine.sy+dy*u+dx/length*curve};
}

/** Interception uses actual turret positions and a real reload, never a
 * stat-based immunity roll. All three mines can be shot down, but one nearby
 * emplacement cannot erase the entire volley in the same frame. */
export function advanceMineVolley(game,zone,dt,turrets=[]){
 if(zone.done||!(dt>0))return [];
 zone.fuse=Math.max(0,zone.fuse-dt);
 zone.age=zone.fuseStart-zone.fuse;
 for(const mine of zone.mines){
  if(mine.intercepted)continue;
  const position=minePosition(mine,zone.age);
  mine.x=position.x;mine.y=position.y;
  for(const turret of turrets){
   if(!(turret.hp>0)||game.time<(turret.readyAt||0)||
      game.time<(turret.nextMineInterceptAt||0)||
      Math.hypot(turret.x-mine.x,turret.y-mine.y)>AREA_DENIAL.interceptRange)continue;
   mine.intercepted=true;
   mine.interceptAge=zone.age;
   mine.interceptX=turret.x;mine.interceptY=turret.y;
   turret.nextMineInterceptAt=game.time+AREA_DENIAL.interceptCooldown;
   game.heritage?.vfx?.nova?.(mine.x,mine.y,24,'cyan');
   game.heritage?.play?.('shieldHit',.3,{x:mine.x,y:mine.y});
   break;
  }
 }
 if(zone.fuse>0)return [];
 zone.done=true;zone.ttl=.62;
 return zone.mines.filter(m=>!m.intercepted)
  .map(m=>({x:m.tx,y:m.ty,r:m.r}));
}

export function insideMineBlasts(point,blasts,extraRadius=0){
 return blasts.some(b=>distance(point,b)<b.r+extraRadius);
}

// Two or three overlapping explosions punish ignoring the warning, but the
// volley is resolved as ONE hull hit. An unshielded starter hull survives a
// full three-mine overlap in isolation; enemy fire can still finish it off.
export function mineVolleyDamage(point,blasts,extraRadius=0,
 base=AREA_DENIAL.blastDamage){
 const overlap=blasts.reduce((count,b)=>
  count+(distance(point,b)<b.r+extraRadius?1:0),0);
 return overlap?base*(1+.3*Math.min(2,overlap-1)):0;
}
