// Station defense is local, finite and independent of the player's weapons.
// It exists to make returning to a station a tactical choice, not to make
// the connected territory safe enough to farm indefinitely.
import {firstRockImpact} from './terrain.js?v=arcade-belt-26';

export const STATION_DEFENSE=Object.freeze({
 soloRadius:270,linkedRadius:345,
 soloCharges:1,linkedCharges:2,
 soloRecharge:17,linkedRecharge:13,
 interceptGap:.7,meteorWindow:1.15,shotHorizon:.85,
 stasisRadius:235,stasisDuration:2.6,stasisCooldown:26,
 stasisImmunity:16,stasisTargets:3
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
   stasisAt:now+8,visualAt:-1e6,visualKind:''};
 }
 const state=base.defense;
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
export function threateningShot(shot,player,rockGrid){
 if(!shot.alive||shot.life<=0)return false;
 const speed2=shot.vx*shot.vx+shot.vy*shot.vy;
 if(speed2<1)return false;
 const t=((player.x-shot.x)*shot.vx+(player.y-shot.y)*shot.vy)/speed2;
 if(t<0||t>STATION_DEFENSE.shotHorizon||t>shot.life)return false;
 const futureX=player.x+(player.vx||0)*t*.35;
 const futureY=player.y+(player.vy||0)*t*.35;
 const miss=Math.hypot(shot.x+shot.vx*t-futureX,shot.y+shot.vy*t-futureY);
 if(miss>(player.r||19)+(shot.r||6)+12)return false;
 if(rockGrid){
  const travel=Math.hypot(player.x-shot.x,player.y-shot.y);
  const cover=firstRockImpact(shot.x,shot.y,futureX,futureY,
   rockGrid.query((shot.x+futureX)*.5,(shot.y+futureY)*.5,65+travel*.5),shot.r||6,player);
  if(cover)return false;
 }
 return true;
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
   const meteor=game.zones.find(z=>z.fuse>0&&z.fuse<=STATION_DEFENSE.meteorWindow&&
    distance(z,base)<radius&&distance(z,player)<z.r+(player.r||19)+14);
   if(meteor){
    game.zones.splice(game.zones.indexOf(meteor),1);
    spend(state,linked,now);effect(game,base,meteor,'meteor');
   }else{
    const shot=game.shots.find(s=>s.alive&&distance(s,base)<radius&&
     threateningShot(s,player,game.rockGrid));
    if(shot){
     shot.alive=false;spend(state,linked,now);effect(game,base,shot,'shot');
    }
   }
  }
  if(!linked||now<state.stasisAt)continue;
  const eligible=game.enemies.filter(e=>e.hp>0&&!e.converted&&!e.boss&&
   !e.missionStructure&&!e.relayAssault&&!e.interceptCargo&&!e.regionalCargo&&
   now>=(e.stasisImmuneUntil||0)&&distance(e,base)<STATION_DEFENSE.stasisRadius);
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
 c.fillStyle=status.charges?'#a7f6e8':'#9eb2bb';c.textAlign='center';
 c.font='bold 10px system-ui';
 c.fillText('ПВО '+status.charges+'/'+status.capacity,base.x,base.y-status.radius-9,100);
 if(linked){
  c.fillStyle=status.stasisIn?'#c1aacd':'#d9b5ff';
  c.fillText(status.stasisIn?'СТАЗИС · '+status.stasisIn+' С':'СТАЗИС ГОТОВ',
   base.x,base.y-status.radius-24,130);
 }
 c.restore();
}
