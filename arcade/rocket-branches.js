import {combatTargets,targetAlive,targetDistance,targetRadius,damageTarget} from './combat-targets.js';
import {blastCoverFactor} from './aimed-terrain.js';
import {contactOnCircle} from './impact-geometry.js';

// A seeker inherits the launcher’s finite lifetime; changing targets never
// restores fuel or grants another missile. Reacquisition uses only live hostile
// contacts already in the combat catalogue.
export function reacquireMissile(game,missile){
 if(!(missile?.seekerRange>0))return false;
 const nearby=combatTargets(game,missile.seekerRange,missile).filter(item=>
  targetAlive(game,item)&&item.target!==missile.target);
 nearby.sort((a,b)=>targetDistance(missile,a.target)-targetDistance(missile,b.target));
 if(!nearby.length)return false;
 const next=nearby[0];
 missile.target=next.target;missile.targetKind=next.kind;missile.targetBase=next.base||null;
 missile.tx=next.target.x;missile.ty=next.target.y;
 return true;
}

// Snapshot valid targets BEFORE the direct hit: a destroyed turret must not
// expose its protected station core to the same explosion. Cover still reduces
// the blast; friendlies, captured stations and the original victim are excluded.
export function applyRocketSplash(game,missile,point,primary=null){
 const radius=missile?.splashRadius||0,fraction=missile?.splashFactor||0;
 if(!(radius>0&&fraction>0))return 0;
 const candidates=combatTargets(game,radius+90,point,true).filter(item=>
  item.target!==primary&&targetAlive(game,item,true)&&
  targetDistance(point,item.target)<=radius+targetRadius(item));
 let hits=0;
 for(const item of candidates){
  const d=Math.max(0,targetDistance(point,item.target)-targetRadius(item));
  const taper=1-.5*Math.min(1,d/radius);
  const contact=contactOnCircle(item.target.x,item.target.y,targetRadius(item),point.x,point.y);
  if(damageTarget(game,item,(missile.splashDamageBase??missile.damage)*fraction*taper*
   blastCoverFactor(game,point,item.target),'rocket',contact)>0)hits++;
 }
 return hits;
}
