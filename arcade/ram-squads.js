// A short, readable telegraph precedes a coordinated attack on an emplacement.
// Orders change actual steering: the visual warning is not a scripted decoration.
export const RAM_SQUAD=Object.freeze({minMembers:3,searchRadius:670,rallySeconds:2.3,
 chargeSeconds:4.2,repeatSeconds:14,stagingRadius:310});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const live=t=>t&&t.hp>0;

export function updateRamSquads(game){
 const now=game.time;
 game.ramSquads??=[];game.ramSquadCooldowns??=new Map();
 game.ramSquads=game.ramSquads.filter(s=>{
  s.members=s.members.filter(e=>live(e)&&!e.converted);
  const active=live(s.target)&&now<s.until&&s.members.length>0;
  if(!active)for(const e of s.members)if(e.ramOrder?.squad===s)e.ramOrder=null;
  return active;
 });
 const occupied=new Set(game.ramSquads.flatMap(s=>s.members));
 const emplacements=[...(game.world?.contours?.artillery||[]),
  ...(game.world?.contours?.supportTurrets||[])].filter(live);
 for(const turret of emplacements){
  if(now<(game.ramSquadCooldowns.get(turret)??0))continue;
  if(game.ramSquads.some(s=>s.target===turret))continue;
  const members=game.enemies.filter(e=>e.type==='berserker'&&live(e)&&
   !e.converted&&!e.relayAssault&&!e.missionFlight&&!e.trialRetreatUntil&&
   !occupied.has(e)&&distance(e,turret)<RAM_SQUAD.searchRadius)
   .sort((a,b)=>distance(a,turret)-distance(b,turret)).slice(0,5);
  if(members.length<RAM_SQUAD.minMembers)continue;
  const squad={target:turret,members,startedAt:now,
   chargeAt:now+RAM_SQUAD.rallySeconds,
   until:now+RAM_SQUAD.rallySeconds+RAM_SQUAD.chargeSeconds};
  for(let i=0;i<members.length;i++){
   const e=members[i],angle=Math.atan2(e.y-turret.y,e.x-turret.x);
   const offset=(i-(members.length-1)/2)*.24;
   e.ramOrder={squad,target:turret,x:turret.x+Math.cos(angle+offset)*RAM_SQUAD.stagingRadius,
    y:turret.y+Math.sin(angle+offset)*RAM_SQUAD.stagingRadius};
   occupied.add(e);
  }
  game.ramSquads.push(squad);
  game.ramSquadCooldowns.set(turret,squad.until+RAM_SQUAD.repeatSeconds);
  if(distance(game.player||turret,turret)<1000){
   game.notice?.('УГРОЗА ТАРАНА · '+members.length+' корабля готовят совместный удар по турели',3);
   game.heritage?.play?.('ramWarning',1.3,{x:turret.x,y:turret.y});
  }
 }
}

export function drawRamSquads(ctx,game){
 if(!game.ramSquads?.length)return;
 ctx.save();
 for(const squad of game.ramSquads){
  const charge=game.time>=squad.chargeAt;
  const pulse=game.visuals?.reducedMotion?1:.6+.4*Math.sin(game.time*13);
  const target=squad.target;
  ctx.lineWidth=charge?2.4:1.8;
  ctx.setLineDash(charge?[9,4]:[4,9]);
  ctx.strokeStyle=charge?'rgba(255,67,52,.9)':'rgba(255,120,51,.66)';
  for(const e of squad.members){
   if(!live(e))continue;
   ctx.globalAlpha=pulse;
   ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(target.x,target.y);ctx.stroke();
   ctx.setLineDash([]);
   ctx.shadowColor=charge?'#ff4336':'#ff9b38';
   ctx.shadowBlur=game.visuals?.reducedMotion?0:13;
   ctx.strokeStyle=charge?'#ff6647':'#ffaa48';ctx.lineWidth=2.2;
   ctx.beginPath();ctx.arc(e.x,e.y,(e.r||18)+7,0,Math.PI*2);ctx.stroke();
   ctx.setLineDash(charge?[9,4]:[4,9]);
   ctx.strokeStyle=charge?'rgba(255,67,52,.9)':'rgba(255,120,51,.66)';
   ctx.shadowBlur=0;ctx.lineWidth=charge?2.4:1.8;
  }
  ctx.setLineDash([]);ctx.globalAlpha=.9;
  ctx.strokeStyle='#ff633a';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(target.x,target.y,62+(!game.visuals?.reducedMotion?pulse*6:0),0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#ffdfb0';ctx.textAlign='center';ctx.font='bold 12px system-ui';
  ctx.fillText(charge?'ТАРАН!':'СБОР ТАРАНЩИКОВ',target.x,target.y-75);
 }
 ctx.restore();
}
