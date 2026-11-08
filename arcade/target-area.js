import {combatTargets,targetDistance,targetRadius,clearLine} from './combat-targets.js?v=mouse-area-1';
import {TARGET_DESIGNATION} from './target-designation.js?v=mouse-area-1';

// A mouse click marks a patch of space, not a tiny moving sprite. Automatic
// weapons retain their existing range, heat, obstruction and damage rules.
export const TARGET_AREA=Object.freeze({radius:165,duration:TARGET_DESIGNATION.duration,maxDistance:TARGET_DESIGNATION.maxDistance});

export function planTargetArea(game,point,radius=TARGET_AREA.radius){
 if(!game?.player||!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||
  !Number.isFinite(radius)||radius<50||radius>250)return {ok:false,reason:'Не удалось выбрать область'};
 if(targetDistance(game.player,point)>TARGET_AREA.maxDistance)
  return {ok:false,reason:'Укажите область не дальше 900 м от корабля'};
 const hits=combatTargets(game,radius+100,point)
  .filter(item=>targetDistance(game.player,item.target)<=TARGET_AREA.maxDistance&&
   targetDistance(point,item.target)<=radius+targetRadius(item)&&
   clearLine(game,game.player,item.target))
  .sort((a,b)=>targetDistance(point,a.target)-targetDistance(point,b.target));
 return {ok:true,area:{x:point.x,y:point.y,radius,expiresAt:game.time+TARGET_AREA.duration},
  focus:hits[0]||null,count:hits.length};
}

