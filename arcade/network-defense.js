// Station defense is local, finite and independent of the player's weapons.
// It exists to make returning to a station a tactical choice, not to make
// the connected territory safe enough to farm indefinitely.
import {firstRockImpact} from './terrain.js?v=arcade-belt-26';
import {worldTextScale} from './camera-zoom.js?v=flight-zoom-2-text-scale-1';

export const STATION_DEFENSE=Object.freeze({
 soloRadius:270,linkedRadius:345,
 soloCharges:1,linkedCharges:2,
 soloRecharge:17,linkedRecharge:13,
 interceptGap:.7,meteorWindow:.45,shotHorizon:.85,
 stasisRadius:235,stasisDuration:2.6,stasisCooldown:26,
 stasisImmunity:16,stasisTargets:3,stasisPlayerRadius:185,
 threatTieWindow:.12
});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const defenseLinked=(base,topology)=>!!base?.active&&!base.enemy&&
  topology.count>=2&&topology.linked.has(base.id);
export const defenseRadius=linked=>linked?STATION_DEFENSE.linkedRadius:STATION_DEFENSE.soloRadius;
const defenseRank=base=>Math.max(0,Math.min(3,base?.fluxInfrastructure?.defense||0));
const capacity=(linked,base)=> (linked?STATION_DEFENSE.linkedCharges:STATION_DEFENSE.soloCharges)+defenseRank(base);
const recharge=(linked,base)=>Math.max(6,(linked?STATION_DEFENSE.linkedRecharge:STATION_DEFENSE.soloRecharge)-2*defenseRank(base));

// Times are game-clock deadlines. Persisting them on each station means
// visiting another region, saving or changing radio links cannot refill PVO.
export function ensureStationDefense(base,linked,now){
 if(!base.active||base.enemy)return null;
 const cap=capacity(linked,base);
 if(!base.defense){
  base.defense={charges:1,rechargeAt:now+recharge(linked,base),interceptAt:now,
   stasisAt:now+8,visualAt:-1e6,visualKind:'',lastLinked:linked,
   meteorEnabled:true};
 }
 const state=base.defense;
 // Creating a radio link is not an instant reload. In particular, a solitary
 // station's long-expired recharge deadline must not create a second charge.
 // Legacy saves lack lastLinked: keep their existing cooldown on first load.
 if(typeof state.lastLinked!=='boolean')state.lastLinked=linked;
 if(typeof state.meteorEnabled!=='boolean')state.meteorEnabled=true;
 if(state.lastLinked!==linked){
  // Settle the *old* magazine before changing its capacity. A solo station
  // returning after a long absence may recover one old charge, never two.
  const oldCap=capacity(state.lastLinked,base);
  state.charges=Math.max(0,Math.min(oldCap,Math.trunc(state.charges)||0));
  if(state.charges<oldCap&&Number.isFinite(state.rechargeAt)&&now>=state.rechargeAt)
   state.charges=oldCap;
  if(linked){
   state.stasisAt=Math.max(state.stasisAt||0,now+8);
   if(state.charges>=STATION_DEFENSE.soloCharges)
    state.rechargeAt=now+recharge(true,base);
  }
  state.lastLinked=linked;
 }
 state.charges=Math.max(0,Math.min(cap,Math.trunc(state.charges)||0));
 if(!Number.isFinite(state.rechargeAt))state.rechargeAt=now+recharge(linked,base);
 if(!Number.isFinite(state.interceptAt))state.interceptAt=now;
 if(!Number.isFinite(state.stasisAt))state.stasisAt=now+8;
 if(state.charges<cap&&now>=state.rechargeAt){
  // One recharge per elapsed interval. Long returns do not add bonus charges.
  const gained=1+Math.floor((now-state.rechargeAt)/recharge(linked,base));
  state.charges=Math.min(cap,state.charges+gained);
  state.rechargeAt=state.charges===cap?now+recharge(linked,base):
   state.rechargeAt+gained*recharge(linked,base);
 }
 return state;
}
// Changing a remote relay affects several stations immediately, not the next
// time the player happens to fly past each one.
export function synchronizeStationDefenses(world,now,topology=world.networkTopology()){
 for(const base of world.stations.values()){
  if(base.active&&!base.enemy)
   ensureStationDefense(base,defenseLinked(base,topology),now);
 }
 return topology;
}
export function defenseStatus(base,linked,now){
 const cap=capacity(linked,base),state=base.defense;
 const charges=state?Math.max(0,Math.min(cap,Math.trunc(state.charges)||0)):1;
 return {radius:defenseRadius(linked),charges,capacity:cap,
  rechargeIn:charges>=cap?0:Math.max(0,Math.ceil((state?.rechargeAt??now)-now)),
  meteorEnabled:state?.meteorEnabled!==false,
  stasis:linked,stasisIn:!linked?null:Math.max(0,Math.ceil((state?.stasisAt??now+8)-now))};
}
const spend=(state,linked,now,base)=>{
 const full=state.charges===capacity(linked,base);
 state.charges--;
 if(full)state.rechargeAt=now+recharge(linked,base);
 state.interceptAt=now+STATION_DEFENSE.interceptGap;
};
// Check where the projectile is going, not merely whether it is near a base.
// A bullet already travelling away, or about to hit a rock, does not waste PVO.
function collisionEta(a,b,radius){
 const dx=a.x-b.x,dy=a.y-b.y;
 const vx=(a.vx||0)-(b.vx||0),vy=(a.vy||0)-(b.vy||0);
 const c=dx*dx+dy*dy-radius*radius;
 if(c<=0)return 0;
 const speed=vx*vx+vy*vy,approach=2*(dx*vx+dy*vy);
 if(speed<1||approach>=0)return null;
 const discriminant=approach*approach-4*speed*c;
 if(discriminant<0)return null;
 const t=(-approach-Math.sqrt(discriminant))/(2*speed);
 return t>=0?t:null;
}
export function shotThreat(shot,player,rockGrid,escortCraft=[]){
 if(!shot.alive||shot.life<=0)return null;
 // Solve contact against the ship's current velocity, not a projectile's
 // closest approach to where the ship happened to be one frame ago.
 const radius=(player.r||19)+(shot.r||6)+2;
 const t=collisionEta(shot,player,radius);
 if(t===null||t>STATION_DEFENSE.shotHorizon||t>shot.life)return null;
 if((player.invul||0)>t+.03)return null;
 // The normal projectile loop hits a strike-support craft before the hero.
 // Keep the player's scarce PVO charge if that craft would take the hit.
 if(escortCraft.some(c=>{
  if(c.hp<=0)return false;
  const first=collisionEta(shot,c,(shot.r||6)+(c.r||17));
  return first!==null&&first<=t;
 }))return null;
 const endX=shot.x+shot.vx*t,endY=shot.y+shot.vy*t;
 if(rockGrid){
  const travel=Math.hypot(endX-shot.x,endY-shot.y);
  const cover=firstRockImpact(shot.x,shot.y,endX,endY,
   rockGrid.query((shot.x+endX)*.5,(shot.y+endY)*.5,65+travel*.5),shot.r||6,player);
  if(cover)return null;
 }
 return {eta:t,damage:Math.max(0,shot.damage||0),kind:'shot',object:shot,
  targetX:player.x+(player.vx||0)*t,targetY:player.y+(player.vy||0)*t};
}
export const threateningShot=(shot,player,rockGrid)=>!!shotThreat(shot,player,rockGrid);

function meteorThreat(zone,base,player,radius){
 if(zone.done||zone.fuse>STATION_DEFENSE.meteorWindow)return null;
 // After the timer crosses zero, the real game resolves the strike on its
 // following simulation step. That still counts as a preventable impact.
 const eta=Math.max(0,zone.fuse);
 if((player.invul||0)>eta+.03)return null;
 // The visible ring describes where the ship can receive protection. An
 // impact whose centre is outside it may still reach the ship inside it.
 if(distance(zone,base)>radius+zone.r+(player.r||19))return null;
 const projected={x:player.x+(player.vx||0)*eta,
  y:player.y+(player.vy||0)*eta};
 if(distance(projected,base)>radius||
    distance(projected,zone)>zone.r+(player.r||19)+2)return null;
 return {eta,damage:27,kind:'meteor',object:zone};
}

function moreUrgent(next,best){
 if(!best)return true;
 // Fixed urgency bands give a transitive order, independent of array order:
 // imminent threats first; within the same brief interval, higher damage.
 const band=t=>Math.floor(Math.max(0,t.eta)/STATION_DEFENSE.threatTieWindow);
 const n=band(next),b=band(best);
 if(n!==b)return n<b;
 if(next.damage!==best.damage)return next.damage>best.damage;
 return next.eta<best.eta;
}
const effect=(game,base,at,kind)=>{
 const state=base.defense;
 state.visualAt=game.time;state.visualKind=kind;
 game.flash?.(base.x,base.y,at.x,at.y,kind==='stasis'?'#c49cff':'#84f9e5');
 game.heritage?.vfx?.nova?.(at.x,at.y,kind==='meteor'?39:kind==='stasis'?62:21,
  kind==='stasis'?'violet':'cyan');
 game.heritage?.play?.(kind==='stasis'?'hack':'hit',.4,{x:at.x,y:at.y});
 // Mission warnings and enemy counter-tactic messages have precedence over
 // routine station status; the ring and impact remain visible regardless.
 if((game.lastDefenseNoticeAt??-Infinity)<game.time-6&&
    (game.messageUntil??-Infinity)<=game.time){
  game.lastDefenseNoticeAt=game.time;
  game.notice?.(kind==='stasis'?'Сеть: стазисный импульс остановил группу врагов.':
   'ПВО станции перехватила '+(kind==='meteor'?'орбитальный удар.':'вражеский снаряд.'),2.7);
 }
};
function stasisTargets(enemies,base,player,now){
 return enemies.filter(e=>e.hp>0&&!e.converted&&!e.boss&&
  !e.missionStructure&&!e.relayAssault&&!e.interceptCargo&&!e.regionalCargo&&
  now>=(e.stasisImmuneUntil||0)&&distance(e,base)<STATION_DEFENSE.stasisRadius&&
  distance(e,player)<STATION_DEFENSE.stasisPlayerRadius);
}

export function updateStationDefense(game){
 const player=game.player,now=game.time;
 if(!player||player.hp<=0||game.dead)return;
 // A zone with a spent fuse is resolved later this same frame; it must not
 // wait for the regular ~0.1s scan. Imminent shots are checked on each frame
 // only if their next-step contact would otherwise be missed.
 const pendingImpact=game.zones.some(z=>!z.done&&z.fuse<=0);
 const urgentShot=game.shots.some(s=>s.alive&&s.life>0&&
  Math.hypot(s.x-player.x,s.y-player.y)<(player.r||19)+(s.r||6)+
   Math.hypot(s.vx||0,s.vy||0)*.065);
 if(!pendingImpact&&!urgentShot&&now<(game.nextDefenseCheckAt||0))return;
 game.nextDefenseCheckAt=now+.095;
 // Local lookups have bounded cost even when the long game has many stations.
 const bases=game.world.nearbyStations(player.x,player.y,
  STATION_DEFENSE.linkedRadius+90,false).filter(b=>b.active&&!b.enemy);
 if(!bases.length)return;
 if(!game.defenseTopology||now>=(game.defenseTopologyAt||0)){
  game.defenseTopology=game.world.networkTopology();
  game.defenseTopologyAt=now+.55;
  synchronizeStationDefenses(game.world,now,game.defenseTopology);
 }
 const topology=game.defenseTopology;
 const escortCraft=(game.support?.missions||[]).flatMap(m=>m.craft||[]).filter(c=>c.hp>0);
 for(const base of bases){
  const linked=defenseLinked(base,topology),radius=defenseRadius(linked);
  if(distance(base,player)>radius)continue;
  const state=ensureStationDefense(base,linked,now);
  if(state.charges>0&&now>=state.interceptAt){
   let best=null;
   if(state.meteorEnabled){
    for(const zone of game.zones){
     const threat=meteorThreat(zone,base,player,radius);
     if(threat&&moreUrgent(threat,best))best=threat;
    }
   }
   for(const shot of game.shots){
    if(!shot.alive)continue;
    const threat=shotThreat(shot,player,game.rockGrid,escortCraft);
    if(threat&&Math.hypot(threat.targetX-base.x,threat.targetY-base.y)>radius)continue;
    if(threat&&moreUrgent(threat,best))best=threat;
   }
   if(best){
    if(best.kind==='meteor')game.zones.splice(game.zones.indexOf(best.object),1);
    else best.object.alive=false;
    spend(state,linked,now,base);effect(game,base,best.object,best.kind);
   }
  }
  if(!linked||now<state.stasisAt)continue;
  const eligible=stasisTargets(game.enemies,base,player,now);
  if(eligible.length<2)continue;
  eligible.sort((a,b)=>distance(a,player)-distance(b,player));
  const stopped=eligible.slice(0,STATION_DEFENSE.stasisTargets);
  for(const [index,e] of stopped.entries()){
   e.stasisUntil=now+STATION_DEFENSE.stasisDuration;
   e.stasisImmuneUntil=e.stasisUntil+STATION_DEFENSE.stasisImmunity;
   e.stasisLabelUntil=index===0?now+1.5:0;
   e._irisChargeStarted=null;
  }
  state.stasisAt=now+STATION_DEFENSE.stasisCooldown;
  effect(game,base,base,'stasis');
 }
}

export function drawStationDefense(c,base,linked,now,player,lowMotion=false,enemies=[],zoom=1){
 if(!base.active||base.enemy||distance(base,player)>defenseRadius(linked)+55)return;
 const status=defenseStatus(base,linked,now),state=base.defense;
 const meteorDisabled=!status.meteorEnabled;
 const recent=state&&now-state.visualAt<1.25;
 const lines=['ПВО '+status.charges+'/'+status.capacity];
 if(status.charges<status.capacity)lines.push('ЗАРЯД ЧЕРЕЗ '+status.rechargeIn+' С');
 if(linked){
  const targets=Math.min(2,stasisTargets(enemies,base,player,now).length);
  lines.push(status.stasisIn?'СТАЗИС ЧЕРЕЗ '+status.stasisIn+' С':
   targets<2?'СТАЗИС · ЦЕЛИ '+targets+'/2':'СТАЗИС · 2/2 ЦЕЛИ');
 }
 if(meteorDisabled)lines.push('ОРБ. УДАРЫ: ПРОПУСК');
 const lineHeight=15;
 const panelHeight=9+lineHeight*lines.length;
 c.save();c.lineWidth=recent?2.2:1.3;
 c.strokeStyle=status.charges?'rgba(115,235,218,'+(recent?.8:.38)+')':'rgba(125,157,168,.34)';
 c.setLineDash([8,12]);c.beginPath();c.arc(base.x,base.y,status.radius,0,Math.PI*2);c.stroke();
 c.setLineDash([]);
 if(linked&&recent&&state.visualKind==='stasis'){
  const spread=lowMotion?0:Math.min(1,(now-state.visualAt)/1.25)*26;
  c.strokeStyle='rgba(202,147,255,.7)';c.lineWidth=2;
  c.beginPath();c.arc(base.x,base.y,STATION_DEFENSE.stasisRadius+spread,0,Math.PI*2);c.stroke();
 }
 // Place the readout on the lower-right arc: the top edge is occupied by
 // mission banners and the station itself already has a title and E prompt.
 const readoutX=base.x+status.radius*.72;
 const readoutY=base.y+status.radius*.66;
 c.translate(readoutX,readoutY);
 c.scale(worldTextScale(zoom),worldTextScale(zoom));
 c.fillStyle='rgba(5,22,34,.82)';
 c.fillRect(-70,-14,140,panelHeight);
 c.strokeStyle='rgba(135,243,222,.52)';c.lineWidth=.85;
 c.strokeRect(-70,-14,140,panelHeight);
 c.fillStyle=status.charges?'#a7f6e8':'#bbcbd2';c.textAlign='center';
 c.font='bold 10px system-ui';
 lines.forEach((line,i)=>{
  c.fillStyle=line.startsWith('СТАЗИС')?'#d9b5ff':line.startsWith('ОРБ.')?'#f6cca2':
   i===0?'#a7f6e8':'#b8dce3';
  c.fillText(line,0,1+i*lineHeight,132);
 });
 c.restore();
}
