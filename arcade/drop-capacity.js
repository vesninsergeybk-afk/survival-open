// Keep pickup rewards physical even when a busy battle fills the loot pool.
// Expiring ordinary loot makes room first; mission charges are protected.
// Awarding remote pickups on overflow would give AFK players free combat XP.
export function makeRoomForDrop(drops,limit){
 if(!Array.isArray(drops)||!Number.isInteger(limit)||limit<1)return false;
 if(drops.length<limit)return true;
 let candidate=-1,shortestLife=Infinity;
 for(let i=0;i<drops.length;i++){
  const drop=drops[i];
  if(!drop||['fieldCell','parasiteCore','fieldBoost','fieldRepair'].includes(drop.type))continue;
  const remaining=Number.isFinite(drop.life)?drop.life:0;
  if(candidate===-1||remaining<shortestLife){
   candidate=i;shortestLife=remaining;
  }
 }
 if(candidate<0)return false;
 drops.splice(candidate,1);
 return drops.length<limit;
}
