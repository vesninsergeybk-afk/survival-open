import {warFronts} from './war-fronts.js?v=territory-war-1';

// Three distinct, destructible investments at the four genuine industrial
// depots. The same stock pays for convoys, territory links and these modules.
export const FORTIFICATIONS=Object.freeze({firstAt:285,buildSeconds:38,
 gapSeconds:250,retrySeconds:135,maxFailures:3,repairInterval:58});
export const FORT_STAGES=Object.freeze([
 {kind:'turret',label:'Перехватчик',cost:4,hp:125},
 {kind:'shield',label:'Генератор помех',cost:5,hp:140},
 {kind:'repair',label:'Ремонтный блок',cost:5,hp:125}
]);
export const FORT_PLANS=Object.freeze({
 home:['turret','shield','repair'],
 north:['turret','turret','shield'],
 azure:['shield','turret','repair'],
 teal:['repair','turret','shield']
});
const stageFor=(front,stage)=>FORT_STAGES.find(x=>x.kind===FORT_PLANS[front]?.[stage]);
const resource=front=>['home','north'].includes(front.key)?'ore':'resource';
const hostile=b=>!!b?.enemy&&!b.captured&&b.hp>0&&!b.suppressed;
const activeStock=front=>front?.pool?.[resource(front)];
const enough=(front,cost)=>front.working&&hostile(front.source)&&hostile(front.depot)&&
 Number.isFinite(activeStock(front))&&activeStock(front)>=cost+
 front.cost+(['home','north'].includes(front.key)?2:1);
const turretPlacement=(base,stage)=>{
 const angle=(stage*2.3+.7);
 return {x:base.x+Math.cos(angle)*162,y:base.y+Math.sin(angle)*162};
};
const initial=()=>({version:1,stage:0,failures:0,nextAt:FORTIFICATIONS.firstAt,
 repairAt:0,spent:0});
export function fortificationShield(world,t){
 if(!t||t.kind==='shield')return 1;
 const base=t.fortificationOf?world?.stations?.get(t.fortificationOf):
  warFronts(world).find(front=>front.depot?.turrets.includes(t))?.depot;
 return base?.turrets.some(v=>v.kind==='shield'&&v.hp>0)?.76:1;
}
export function advanceEnemyFortifications(world,time){
 if(!world||!Number.isFinite(time))return [];
 if(time<(world._fortificationTickAt||0))return [];
 world._fortificationTickAt=time+1;
 const events=[];
 for(const front of warFronts(world)){
  const base=front.depot;
  if(!base||!hostile(base))continue;
  const s=base.fortification??=initial();
  // Committed construction is not retroactively refunded when a mine falls.
  // Once finished, its hardware remains until attacked and destroyed.
  const construction=base.turrets.find(t=>t.kind==='construction'&&t.fortificationOf===base.id);
  if(construction){
   if(construction.hp<=0){
    base.turrets=base.turrets.filter(t=>t!==construction);
    s.failures++;s.nextAt=time+FORTIFICATIONS.retrySeconds;
    events.push({kind:'interrupted',front:front.key,base,module:construction.buildKind,cost:0,time});
   }else if(time>=construction.finishAt){
    const spec=stageFor(front.key,s.stage);
    if(spec&&spec.kind===construction.buildKind){
     Object.assign(construction,{kind:spec.kind,hp:spec.hp,maxHp:spec.hp,
      shot:1.1,flash:0,finishAt:undefined,buildKind:undefined});
     s.stage++;s.nextAt=time+FORTIFICATIONS.gapSeconds;
     events.push({kind:'completed',front:front.key,base,module:spec.kind,cost:0,time});
    }
   }
   continue;
  }
  // Repair is a vulnerable physical module. It spends normal stock on each
  // pulse and never resurrects a destroyed turret or heals above 70%.
  const repair=base.turrets.find(t=>t.kind==='repair'&&t.hp>0);
  if(repair&&time>=s.repairAt){
   s.repairAt=time+FORTIFICATIONS.repairInterval;
   const target=base.turrets.find(t=>t!==repair&&t.hp>0&&t.hp<t.maxHp*.7);
   if(target&&enough(front,1)){
    front.pool[resource(front)]--;
    target.hp=Math.min(target.maxHp*.7,target.hp+32);
    s.spent++;
    events.push({kind:'repair',front:front.key,base,module:'repair',cost:1,time,
     x:target.x,y:target.y});
   }
  }
  if(s.stage>=FORT_STAGES.length||s.failures>=FORTIFICATIONS.maxFailures||time<s.nextAt)continue;
  const spec=stageFor(front.key,s.stage);
  if(!enough(front,spec.cost))continue;
  front.pool[resource(front)]-=spec.cost;s.spent+=spec.cost;
  const point=turretPlacement(base,s.stage);
  base.turrets.push({...point,hp:75,maxHp:75,kind:'construction',
   fortificationOf:base.id,buildKind:spec.kind,finishAt:time+FORTIFICATIONS.buildSeconds,
   startedAt:time,shot:0,flash:0});
  events.push({kind:'started',front:front.key,base,module:spec.kind,cost:spec.cost,time});
 }
 return events;
}
export function validFortification(base,time){
 const s=base.fortification;
 if(s===undefined)return true;
 if(!s||s.version!==1||!Number.isInteger(s.stage)||s.stage<0||s.stage>FORT_STAGES.length||
  !Number.isInteger(s.failures)||s.failures<0||s.failures>FORTIFICATIONS.maxFailures||
  !Number.isFinite(s.nextAt)||s.nextAt<0||s.nextAt>Math.max(FORTIFICATIONS.firstAt,time+FORTIFICATIONS.gapSeconds+30)||
  !Number.isFinite(s.repairAt)||s.repairAt<0||s.repairAt>time+FORTIFICATIONS.repairInterval+1||
  !Number.isFinite(s.spent)||s.spent<0||s.spent>200)return false;
 const modules=base.turrets.filter(t=>t.fortificationOf===base.id);
 if(modules.length>FORT_STAGES.length||modules.filter(t=>t.kind==='construction').length>1)return false;
 return modules.every(t=>Number.isFinite(t.x)&&Number.isFinite(t.y)&&
  Math.hypot(t.x-base.x,t.y-base.y)<205&&
  ['construction','turret','shield','repair'].includes(t.kind)&&
  Number.isFinite(t.hp)&&t.hp>=-1e5&&t.hp<=200&&
  Number.isFinite(t.maxHp)&&t.maxHp>=1&&t.maxHp<=200&&
  (t.kind!=='construction'||FORT_STAGES.some(spec=>spec.kind===t.buildKind)&&
   Number.isFinite(t.finishAt)&&t.finishAt>=0&&t.finishAt<=time+FORTIFICATIONS.buildSeconds+1&&
   Number.isFinite(t.startedAt)&&t.startedAt>=0&&t.startedAt<=time));
}
