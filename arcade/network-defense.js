// Station defense is local, finite and independent of the player's weapons.
// It exists to make returning to a station a tactical choice, not to make
// the connected territory safe enough to farm indefinitely.
import {firstRockImpact} from './terrain.js?v=arcade-belt-26';

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
const capacity=linked=>linked?STATION_DEFENSE.linkedCharges:STATION_DEFENSE.soloCharges;
const recharge=linked=>linked?STATION_DEFENSE.linkedRecharge:STATION_DEFENSE.soloRecharge;

// Times are game-clock deadlines. Persisting them on each station means
// visiting another region, saving or changing radio links cannot refill PVO.
export function ensureStationDefense(base,linked,now){
 if(!base.active||base.enemy)return null;
 const cap=capacity(linked);
 if(!base.defense){
  base.defense={charges:1,rechargeAt:now+recharge(linked),interceptAt:now,
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
  if(linked){
   state.stasisAt=Math.max(state.stasisAt||0,now+8);
   if(state.charges>=STATION_DEFENSE.soloCharges)
    state.rechargeAt=Math.max(now+recharge(true),state.rechargeAt||0);
  }
  state.lastLinked=linked;
 }
 state.charges=Math.max(0,Math.min(cap,Math.trunc(state.charges)||0));
 if(!Number.isFinite(state.rechargeAt))state.rechargeAt=now+recharge(linked);
 if(!Number.isFinite(state.interceptAt))state.interceptAt=now;
 if(!Number.isFinite(state.stasisAt))state.stasisAt=now+8;
 if(state.charges<cap&&now>=state.rechargeAt){
  // One recharge per elapsed interval. Long returns do not add bonus charges.
  const gained=1+Math.floor((now-state.rechargeAt)/recharge(linked));
  state.charges=Math.min(cap,state.charges+gained);
  state.rechargeAt=state.charges===cap?now+recharge(linked):
   state.rechargeAt+gained*recharge(linked);
 }
 return state;
}
export function defenseStatus(base,linked,now){
 const cap=capacity(linked),state=base.defense;
 const charges=state?Math.max(0,Math.min(cap,Math.trunc(state.charges)||0)):1;
 return {radius:defenseRadius(linked),charges,capacity:cap,
  rechargeIn:charges>=cap?0:Math.max(0,Math.ceil((state?.rechargeAt??now)-now)),
  meteorEnabled:state?.meteorEnabled!==false,
  stasis:linked,stasisIn:!linked?null:Math.max(0,Math.ceil((state?.stasisAt??now+8)-now))};
}
const spend=(state,linked,now)=>{
 const full=state.charges===capacity(linked);
 state.charges--;
 if(full)state.rechargeAt=now+recharge(linked);
 state.interceptAt=now+STATION_DEFENSE.interceptGap;
};
// Check where the projectile is going, not merely whether it is near a base.
// A bullet already travelling away, or about to hit a rock, does not waste PVO.
export function shotThreat(shot,player,rockGrid){
 if(!shot.alive||shot.life<=0)return null;
 // Solve contact against the ship's current velocity, not a projectile's
 // closest approach to where the ship happened to be one frame ago.
 const dx=shot.x-player.x,dy=shot.y-player.y;
 const vx=shot.vx-(player.vx||0),vy=shot.vy-(player.vy||0);
 const radius=(player.r||19)+(shot.r||6)+2;
 const c=dx*dx+dy*dy-radius*radius;
 let t=0;
 if(c>0){
  const a=vx*vx+vy*vy,b=2*(dx*vx+dy*vy);
  if(a<1||b>=0)return null;
  const discriminant=b*b-4*a*c;
  if(discriminant<0)return null;
  t=(-b-Math.sqrt(discriminant))/(2*a);
  if(t<0)return null;
 }
 if(t>STATION_DEFENSE.shotHorizon||t>shot.life)return null;
 if((player.invul||0)>t+.03)return null;
 const endX=shot.x+shot.vx*t,endY=shot.y+shot.vy*t;
 if(rockGrid){
  const travel=Math.hypot(endX-shot.x,endY-shot.y);
  const cover=firstRockImpact(shot.x,shot.y,endX,endY,
   rockGrid.query((shot.x+endX)*.5,(shot.y+endY)*.5,65+travel*.5),shot.r||6,player);
  if(cover)return null;
 }
 return {eta:t,damage:Math.max(0,shot.damage||0),kind:'shot',object:shot};
}
export const threateningShot=(shot,player,rockGrid)=>!!shotThreat(shot,player,rockGrid);

function meteorThreat(zone,base,player,radius){
 if(zone.done||zone.fuse<=0||zone.fuse>STATION_DEFENSE.meteorWindow)return null;
 if((player.invul||0)>zone.fuse+.03)return null;
 // The visible ring describes where the ship can receive protection. An
 // impact whose centre is outside it may still reach the ship inside it.
 if(distance(zone,base)>radius+zone.r+(player.r||19))return null;
 const projected={x:player.x+(player.vx||0)*zone.fuse,
  y:player.y+(player.vy||0)*zone.fuse};
 if(distance(projected,base)>radius||
    distance(projected,zone)>zone.r+(player.r||19)+2)return null;
 return {eta:zone.fuse,damage:27,kind:'meteor',object:zone};
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

export function updateStationDefense(game){
 const player=game.player,now=game.time;
 if(!player||player.hp<=0||game.dead||now<(game.nextDefenseCheckAt||0))return;
 game.nextDefenseCheckAt=now+.095;
 // Local lookups have bounded cost even when the long game has many stations.
 const bases=game.world.nearbyStations(player.x,player.y,
  STATION_DEFENSE.linkedRadius+90,false).filter(b=>b.active&&!b.enemy);
 if(!bases.length)return;
 if(!game.defenseTopology||now>=(game.defenseTopologyAt||0)){
  game.defenseTopology=game.world.networkTopology();
  game.defenseTopologyAt=now+.55;
 }
 const topology=game.defenseTopology;
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
    if(!shot.alive||distance(shot,base)>radius)continue;
    const threat=shotThreat(shot,player,game.rockGrid);
    if(threat&&moreUrgent(threat,best))best=threat;
   }
   if(best){
    if(best.kind==='meteor')game.zones.splice(game.zones.indexOf(best.object),1);
    else best.object.alive=false;
    spend(state,linked,now);effect(game,base,best.object,best.kind);
   }
  }
  if(!linked||now<state.stasisAt)continue;
  const eligible=game.enemies.filter(e=>e.hp>0&&!e.converted&&!e.boss&&
   !e.missionStructure&&!e.relayAssault&&!e.interceptCargo&&!e.regionalCargo&&
   now>=(e.stasisImmuneUntil||0)&&distance(e,base)<STATION_DEFENSE.stasisRadius&&
   distance(e,player)<STATION_DEFENSE.stasisPlayerRadius);
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

export function drawStationDefense(c,base,linked,now,player,lowMotion=false){
 if(!base.active||base.enemy||distance(base,player)>defenseRadius(linked)+55)return;
 const status=defenseStatus(base,linked,now),state=base.defense;
 const meteorDisabled=!status.meteorEnabled;
 const recent=state&&now-state.visualAt<1.25;
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
 c.fillStyle='rgba(5,22,34,.82)';
 c.fillRect(readoutX-59,readoutY-14,118,linked?(meteorDisabled?53:38):meteorDisabled?37:22);
 c.strokeStyle='rgba(135,243,222,.52)';c.lineWidth=.85;
 c.strokeRect(readoutX-59,readoutY-14,118,linked?(meteorDisabled?53:38):meteorDisabled?37:22);
 c.fillStyle=status.charges?'#a7f6e8':'#bbcbd2';c.textAlign='center';
 c.font='bold 11px system-ui';
 c.fillText('ПВО '+status.charges+'/'+status.capacity,readoutX,readoutY+1,108);
 if(linked){
  c.fillStyle=status.stasisIn?'#c1aacd':'#d9b5ff';
  c.fillText(status.stasisIn?'СТАЗИС · '+status.stasisIn+' С':'СТАЗИС ГОТОВ',
   readoutX,readoutY+17,108);
 }
 if(meteorDisabled){
  c.fillStyle='#f6cca2';c.font='bold 9px system-ui';
  c.fillText('ОРБ. УДАРЫ: ПРОПУСК',readoutX,readoutY+(linked?33:17),108);
 }
 c.restore();
}
