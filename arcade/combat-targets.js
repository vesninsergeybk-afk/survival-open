import {firstRockImpact} from './terrain.js?v=arcade-belt-26';
import {contactOnCircle,contactAtPoint} from './impact-geometry.js?v=arcade-impact-51';
import {canAutoTarget} from './signal-perception.js?v=arcade-perception-61';

export const targetDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const targetRadius=item=>item.target.r||({jammer:30,turret:22,base:60}[item.kind])||18;
export function targetAlive(game,item,manual=false){
 const t=item?.target;if(!t||!(t.hp>0)||t.converted||t===game.player||game.allies?.includes(t))return false;
 if(t.interceptCargo&&t.phase==='approach')return false;
 if(item.kind==='base')return t.enemy!==false&&!t.captured&&!t.turrets?.some(x=>x.hp>0);
 if(item.kind==='turret')return item.base?.enemy!==false&&!item.base?.captured;
 if(item.kind==='jammer')return t.id==='silent-corridor'&&t.phase!=='return';
 if(t===game.operation&&!t.interceptCargo)return false;
 // Deliberate physical aim can strike an unconfirmed investigating patrol.
 // Auto weapons and escorts still obey sensor/engagement restrictions.
 return manual||canAutoTarget(t);
}
// A single catalog includes world objectives, never friendly repair/defense nodes.
// Object identity deduplicates the cargo which is also present in the AI grid.
export function combatTargets(game,range,origin=game.player,manual=false){
 const result=[],seen=new Set(),op=game.operation;
 const add=item=>{
  if(!seen.has(item.target)&&targetAlive(game,item,manual)&&targetDistance(origin,item.target)<=range){
   seen.add(item.target);result.push(item);
  }
 };
 if(op?.id==='silent-corridor')add({kind:'jammer',target:op,goal:true});
 if(op?.interceptCargo)add({kind:'enemy',target:op,goal:true});
 for(const target of [...(game.world?.regionalSupply?.convoys||[]),
  ...(game.world?.regionalSupply?.central?.convoys||[]),
  ...(game.world?.regionalSupply?.frontier?.azure?.convoys||[]),
  ...(game.world?.regionalSupply?.frontier?.teal?.convoys||[])])
  add({kind:'enemy',target,goal:true});
 // A mining worker is not an automatic target. The player must first
 // explicitly designate this industrial unit on the canvas.
 const worker=game.world?.regionalSupply?.central?.worker;
 if(worker?.hp>0&&game.world?.stations?.get('industry:source')?.enemy&&
  (manual||(game.designatedTarget?.target===worker&&game.time<=game.designatedTarget.expiresAt)))
  add({kind:'enemy',target:worker,goal:true});
 const salvage=game.world?.regionalSupply?.frontier?.teal;
 if(game.world?.stations?.get('frontier:teal:source')?.enemy){
  if(manual){
   if(salvage?.worker)add({kind:'enemy',target:salvage.worker,goal:true});
   for(const wreck of salvage?.wrecks||[])add({kind:'enemy',target:wreck,goal:true});
  }else if(game.time<=game.designatedTarget?.expiresAt){
   const target=game.designatedTarget.target;
   if(target===salvage?.worker||salvage?.wrecks.includes(target))
    add({kind:'enemy',target,goal:true});
  }
 }
 const bases=game.world?.nearbyStations?game.world.nearbyStations(origin.x,origin.y,range+150,true)
  .filter(b=>b.enemy&&!b.captured&&(b.strategicRole||game.enemyBasesUnlocked?.()!==false)):
   [game.nearbyEnemyBase?.(range+150)].filter(Boolean);
 for(const base of bases){
  for(const target of base.turrets||[])add({kind:'turret',target,base});
  add({kind:'base',target:base});
 }
 for(const target of game.grid?.query(origin.x,origin.y,range)||[])
  add({kind:'enemy',target,goal:target===op||
   (op?.id==='relay-defense'&&target.relayAssault===op.baseId)});
 return result;
}
const precisionRank=item=>{
 const rank=item.kind==='base'?0:item.kind==='turret'?1:
  ({gunship:2,healer:3,berserker:4,fighter:5,flanker:5,scout:6})[item.target.type]??5;
 return item.goal?(item.target.interceptCargo||item.kind==='jammer'?-20:rank-10):rank;
};
export function selectTargets(game,range,limit=1,precision=false){
 const designated=game.designatedTarget;
 const focus=designated&&game.time<=designated.expiresAt&&
  designated.target?.hp>0&&!designated.target.converted&&
  !designated.target.captured?designated.target:null;
 return combatTargets(game,range).sort((a,b)=>
  (focus?(a.target===focus?-1:b.target===focus?1:0):0)||
  (precision?precisionRank(a)-precisionRank(b):0)||
  targetDistance(game.player,a.target)-targetDistance(game.player,b.target)).slice(0,limit);
}
export function rockOnLine(game,from,to,padding=2,ignoreOrigin=true){
 const d=targetDistance(from,to);
 return firstRockImpact(from.x,from.y,to.x,to.y,
  game.rockGrid?.query((from.x+to.x)*.5,(from.y+to.y)*.5,d*.5+60)||[],padding,ignoreOrigin?from:null);
}
export const clearLine=(game,from,to,ignoreOrigin=true)=>!rockOnLine(game,from,to,2,ignoreOrigin);
export function lineContact(game,from,item){
 const cover=rockOnLine(game,from,item.target);
 return {cover,point:cover?contactAtPoint(cover.rock.x,cover.rock.y,cover.x,cover.y):
  contactOnCircle(item.target.x,item.target.y,targetRadius(item),from.x,from.y)};
}
export function damageTarget(game,item,damage,source='beam',point=null,secondary=false,manual=false){
 if(!targetAlive(game,item,manual)||!Number.isFinite(damage)||damage<=0)return 0;
 const t=item.target,before=t.hp;
 if(item.kind==='jammer'){
  if(game.time<(t.overheatedUntil||0))damage*=1.35;
  t.hp=Math.max(0,t.hp-damage);t.hit=.15;
  if(t.hp<=0)game.completeCorridor();
 }else if(item.kind==='turret')game.hitTurret(t,damage,point);
 else if(item.kind==='base')game.hitEnemyBase(t,damage);
 else game.damageEnemy(t,damage,source,point);
 const dealt=t.captured?Math.min(before,damage):Math.max(0,before-Math.max(0,t.hp));
 if(dealt>0&&!secondary)game.weaponHit?.(item,dealt,source);
 return dealt;
}
