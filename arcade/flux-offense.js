// A paid, physical sortie launched from an owned territorial contour.
// It jams one KNOWN industrial dispatch station for a short window; it never
// removes an already launched ship, consumes enemy stock, or deals damage.
import {contourFields} from './territory-system.js?v=contours-2-operational-reserve-1-flux-offense-1';
import {warFronts} from './war-fronts.js?v=campaign-1-repair-qa-1-enemy-balance-2';

export const FLUX_SORTIE=Object.freeze({cost:8,maxRange:3600,speed:210,
 duration:42,cooldown:120,expiry:55,hp:2,interceptRadius:72,witnessRange:1700});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export function fluxSortieOffer(world,targetId,now=0){
 const state=world?.contours,target=world?.stations?.get(targetId);
 if(!state||!Number.isFinite(now)||now<0)return {ok:false,reason:'Нет действующей сети'};
 const front=warFronts(world).find(f=>f.depotId===targetId);
 if(!front||!target?.enemy||target.hp<=0)return {ok:false,reason:'Нужен действующий промышленный пост противника'};
 if(!target.discovered)return {ok:false,reason:'Сначала разведайте вражеский пост'};
 if(state.sortie)return {ok:false,reason:'Постановщик помех уже в пути'};
 if((target.fluxJamUntil||0)>now)return {ok:false,reason:'Радиосвязь этого поста уже нарушена'};
 if(now<(state.nextSortieAt||0))return {ok:false,reason:'Новый рейс через '+Math.ceil(state.nextSortieAt-now)+' с'};
 const ids=new Set(contourFields(world).flatMap(f=>f.vertices));
 const sources=[...ids].map(id=>world.stations.get(id)).filter(b=>b?.active&&!b.enemy&&!b.suppressed)
  .sort((a,b)=>dist(a,target)-dist(b,target));
 const source=sources[0];
 if(!source)return {ok:false,reason:'Сначала замкните хотя бы один работающий контур'};
 const distance=dist(source,target);
 if(distance>FLUX_SORTIE.maxRange)return {ok:false,
  reason:'Промышленный пост вне досягаемости: '+Math.ceil(distance-FLUX_SORTIE.maxRange)+
   ' м до рубежа. Расширьте территорию в его сторону.',distance};
 if(state.flux<FLUX_SORTIE.cost)return {ok:false,reason:'Нужно '+FLUX_SORTIE.cost+' флюкса',source,distance};
 return {ok:true,front:front.key,target,source,distance};
}

export function launchFluxSortie(world,targetId,now){
 const offer=fluxSortieOffer(world,targetId,now);
 if(!offer.ok)return offer;
 const {front,source,target}=offer;
 world.contours.flux-=FLUX_SORTIE.cost;
 world.contours.sortie={front,originId:source.id,targetId:target.id,
  x:source.x,y:source.y,hp:FLUX_SORTIE.hp,launchedAt:now,
  expiresAt:now+FLUX_SORTIE.expiry};
 world.contours.nextSortieAt=now+FLUX_SORTIE.cooldown;
 return {ok:true,front,source,target,distance:offer.distance};
}

export function advanceFluxSortie(world,now,dt,enemies=[],player=null){
 const s=world?.contours?.sortie;
 if(!s||!Number.isFinite(dt)||dt<=0)return [];
 const target=world.stations.get(s.targetId),events=[];
 const end=(kind)=>{world.contours.sortie=null;events.push({kind,
  front:s.front,originId:s.originId,targetId:s.targetId,x:s.x,y:s.y});return events;};
 if(!target?.enemy||target.hp<=0)return end('sortieAborted');
 if(now>=s.expiresAt)return end('sortieExpired');
 const delta=dist(s,target),step=Math.min(FLUX_SORTIE.speed*dt,delta);
 if(delta>0){s.x+=(target.x-s.x)/delta*step;s.y+=(target.y-s.y)/delta*step;}
 if(player&&dist(player,s)<FLUX_SORTIE.witnessRange&&enemies.some(e=>e.hp>0&&
   !e.converted&&dist(e,s)<FLUX_SORTIE.interceptRadius)){
  s.hp=Math.max(0,s.hp-dt*1.5);
  if(s.hp<=0)return end('sortieLost');
 }
 if(dist(s,target)<=18){
  target.fluxJamUntil=now+FLUX_SORTIE.duration;
  return end('sortieArrived');
 }
 return events;
}
