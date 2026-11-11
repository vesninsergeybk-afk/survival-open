// Scripted rescue ships retain their mission orders. The armed escorts and
// guards still use the normal, visible combat and ship-art systems; the tug
// itself must keep concentrating on taking the capsule.
export const rescueArmedDrone=enemy=>{
 const role=enemy?.openingRescueRole;
 return role==='guard'||role==='escort'||role==='pursuer';
};

const direction=(dx,dy)=>{
 const distance=Math.hypot(dx,dy);
 return distance>1?{x:dx/distance,y:dy/distance}:{x:1,y:0};
};

/** A sentry keeps its assigned post. An escort forms up off the tug's flank.
 * Neither circles a moving guess about the player's whereabouts. */
export function rescueGuardDestination(enemy,time=0){
 if(enemy?.openingRescueRole==='guard'){
  // Old checkpoints have neither the assigned slot nor the fixed post.
  // Their saved positions still reveal which side of the capsule they guard.
  const side=enemy.rescueSlot===0?-1:enemy.rescueSlot===1?1:
   enemy.x<(enemy.protect?.x??enemy.x)?-1:1;
  const post=enemy.guardPost|| (enemy.protect?.hp>0?{
   x:enemy.protect.x+(side<0?-165:135),
   y:enemy.protect.y+(side<0?85:-100)}:null);
  if(!post)return null;
  return {x:post.x+Math.sin(time*.34+enemy.serial)*12,
   y:post.y+Math.cos(time*.28+enemy.serial)*9};
 }
 if(enemy?.openingRescueRole==='escort'&&enemy.protect?.hp>0){
  const tug=enemy.protect;
  const destination=tug.missionFlight;
  const vector=destination?
   direction(destination.x-tug.x,destination.y-tug.y):
   direction(tug.vx||0,tug.vy||0);
  const side=enemy.rescueSlot===0?-1:1;
  return {x:tug.x-vector.x*75-vector.y*side*62,
   y:tug.y-vector.y*75+vector.x*side*62};
 }
 return null;
}

/** Pursuers know the capsule's route, but receive no magical target lock on
 * the pilot. They intercept the escorted cargo until they see the player. */
export function rescuePursuitDestination(enemy,arc,home,time=0){
 if(enemy?.openingRescueRole!=='pursuer'||arc?.status!=='active'||
    arc.kind!=='rescue'||arc.rescueStage!=='return'||!home||
    enemy._enemyLearningSaw||
    time-(enemy._awarenessLast?.at??-Infinity)<5)return null;
 if(!Number.isFinite(arc.rescueCargoX)||!Number.isFinite(arc.rescueCargoY))return null;
 const ahead=direction(home.x-arc.rescueCargoX,home.y-arc.rescueCargoY);
 const offset=(enemy.x-arc.rescueCargoX)*(-ahead.y)+
  (enemy.y-arc.rescueCargoY)*ahead.x;
 const side=enemy.rescueSlot===0?-1:enemy.rescueSlot===1?1:
  offset<0?-1:1;
 return {x:arc.rescueCargoX+ahead.x*140-ahead.y*side*90,
  y:arc.rescueCargoY+ahead.y*140+ahead.x*side*90,
  hp:1,r:19,remembered:true};
}
