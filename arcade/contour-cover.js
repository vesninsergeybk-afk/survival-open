// Network territory is a place where already-paid carrier sorties can defend
// the pilot. A carrier must itself be a functioning vertex of that network.
import {contourFields,fieldAt} from './territory-system.js?v=contours-2-operational-reserve-1-flux-offense-1';
import {autonomousStrikeCarrier,AUTONOMOUS_STRIKE_RANGE} from './carrier-interception.js?v=carrier-intercept-2-campaign-1';
import {territoryTech} from './territory-tech.js?v=territory-war-1-territory-war-1';

export const CONTOUR_COVER=Object.freeze({range:590,shots:4,shotInterval:.98,
 entrySeconds:2.4,duration:8.8});
export function contourCargo(world){
 const s=world?.regionalSupply;
 return [...(s?.convoys||[]),...(s?.central?.convoys||[]),
  ...(s?.frontier?.azure?.convoys||[]),...(s?.frontier?.teal?.convoys||[])];
}
export function selectCoverTarget(world,player,enemies){
 const tech=territoryTech(world);
 const target=[...contourCargo(world),...enemies].filter(e=>e.hp>0&&!e.converted&&
  Math.hypot(e.x-player.x,e.y-player.y)<CONTOUR_COVER.range)
  .sort((a,b)=>(tech.north?(Number(!!b.regionalCargo)-Number(!!a.regionalCargo)):0)||
   Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0]||null;
 return {tech,target};
}
// Only carriers connected by live player-authored links to the field occupied
// by the pilot can launch a network sortie. Other disconnected fields must not
// borrow a carrier on the opposite side of the map.
function connectedFieldVertices(world,field){
 const reached=new Set(),pending=[...field.vertices];
 const links=world.contours?.links||[];
 while(pending.length){
  const id=pending.pop(),node=world.stations.get(id);
  if(reached.has(id)||!node?.active||node.enemy||node.suppressed)continue;
  reached.add(id);
  for(const [a,b] of links){
   if(a===id&&!reached.has(b))pending.push(b);
   else if(b===id&&!reached.has(a))pending.push(a);
  }
 }
 return reached;
}
export function contourCoverOffer(world,player,enemies,charges,cooldown){
 if(!charges)return {ok:false,reason:'Сначала снарядите авиаудар на авианосце'};
 if(cooldown>0)return {ok:false,reason:'Перезарядка связи: '+Math.ceil(cooldown)+' с'};
 const fields=contourFields(world),field=fieldAt(world,player.x,player.y,fields);
 if(!field)return {ok:false,reason:'Для прикрытия войдите в свою территорию'};
 const vertices=connectedFieldVertices(world,field);
 const fieldVertices=new Set(fields.flatMap(f=>f.vertices));
 const carriers=[...world.stations.values()].filter(b=>b.active&&!b.enemy&&!b.suppressed&&
  b.type==='carrier'&&((fieldVertices.has(b.id)&&vertices.has(b.id))||(autonomousStrikeCarrier(b)&&
   Math.hypot(b.x-player.x,b.y-player.y)<=AUTONOMOUS_STRIKE_RANGE)));
 if(!carriers.length)return {ok:false,reason:'Включите авианосец в контур или освободите соседний сборочный узел'};
 const first=selectCoverTarget(world,player,enemies).target;
 if(!first)return {ok:false,reason:'Для вызова прикрытия поблизости нужна угроза'};
 carriers.sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
 return {ok:true,carrier:carriers[0],field,firstTarget:first};
}
