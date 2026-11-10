// A reward for actively intercepting a supply convoy. It does not occupy a
// ship slot or consume ammunition. One independent 90-second clock is shown.
import {targetAlive,clearLine} from './combat-targets.js?v=mouse-arms-1-triangle-defense-1-living-world-population-1-sector-density-2-frontier-siege-1';
export const RELIC_SECONDS=90;
export const RELICS=Object.freeze({
 storm:{name:'Плазменный шторм',color:'#94f7ff',interval:1.05,damage:24,range:460,
  desc:'Частые плазменные залпы, которые цепляют соседние корабли'},
 salvo:{name:'Штурмовой каскад',color:'#ffb678',interval:2.1,damage:45,range:435,
  desc:'Мощный залп по цели и двум соседним кораблям'},
 arc:{name:'Ионная гроза',color:'#c5b6ff',interval:1.65,damage:31,range:445,
  desc:'Разряд по цели и ближайшему второму врагу'}
});
export const createConvoyRelic=()=>({active:null,misses:0,lastGrantedAt:-1000});
export function relicTypeForCargo(cargo){
 return cargo?.cargoRole==='military'||cargo?.centralCargo?'salvo':
  cargo?.cargoRole==='courier'||cargo?.cargoRole==='technical'||cargo?.frontierRepair?'arc':'storm';
}
export function rewardConvoyRelic(game,cargo,source,random=Math.random){
 const state=game.convoyRelic;
 if(!state||game.dead||!game.player||!cargo)return null;
 const friendly=typeof source==='string'&&['beam','rocket','rail','flak','howitzer','comet','mine','ion','trophy'].includes(source)||
  source===game.player||game.allies?.includes(source);
 if(!friendly||Math.hypot(game.player.x-cargo.x,game.player.y-cargo.y)>950)return null;
 if(game.time-state.lastGrantedAt<35)return null;
 const certain=cargo.cargoRole==='military'||cargo.centralCargo||state.misses>=2;
 if(!certain&&random()>=.58){state.misses++;return null;}
 const id=relicTypeForCargo(cargo),old=state.active;
 // A second find extends the current module instead of producing two guns.
 const until=Math.min(game.time+RELIC_SECONDS*1.5,
  Math.max(game.time,old?.until||game.time)+RELIC_SECONDS);
 state.active={id,until,nextFireAt:game.time+.7};
 state.lastGrantedAt=game.time;state.misses=0;
 game.notice?.('ТРОФЕЙ · '+RELICS[id].name+' · '+Math.ceil(until-game.time)+' с. Автоматический огонь!',5);
 game.heritage?.vfx?.nova?.(game.player.x,game.player.y,92,'cyan');
 return state.active;
}
export function updateConvoyRelic(game){
 const a=game.convoyRelic?.active;if(!a)return false;
 if(game.time>=a.until){game.convoyRelic.active=null;game.notice?.('Заряд трофейного оружия исчерпан',2.5);return false;}
 if(game.holdFire||game.dead||game.time<a.nextFireAt)return false;
 const spec=RELICS[a.id];if(!spec)return false;
 a.nextFireAt=game.time+spec.interval;
 const p=game.player;
 const visible=(game.enemies||[]).filter(e=>!e.regionalCargo&&
  !e.interceptCargo&&!e.populationWorker&&e.type&&
  targetAlive(game,{kind:'enemy',target:e})&&
  Math.hypot(e.x-p.x,e.y-p.y)<=spec.range&&clearLine(game,p,e));
 if(!visible.length)return false;
 visible.sort((x,y)=>Math.hypot(x.x-p.x,x.y-p.y)-Math.hypot(y.x-p.x,y.y-p.y));
 const primary=visible[0];
 const targets=[primary];
 for(const e of visible.slice(1)){
  const chainRange=a.id==='arc'?180:a.id==='storm'?110:120;
  if(Math.hypot(e.x-primary.x,e.y-primary.y)<chainRange&&clearLine(game,targets.at(-1),e))
   targets.push(e);
  if(targets.length===(a.id==='arc'?2:3))break;
 }
 for(let i=0;i<targets.length;i++){
  const e=targets[i],from=i?targets[i-1]:p;
  game.flash?.(from.x,from.y,e.x,e.y,spec.color);
  game.damageEnemy?.(e,spec.damage*(i?(a.id==='storm'?.4:.53):1),'trophy');
  if(a.id==='salvo')game.heritage?.vfx?.nova?.(e.x,e.y,36,'red');
  else if(a.id==='arc'&&i)game.heritage?.vfx?.nova?.(e.x,e.y,27,'cyan');
 }
 game.heritage?.play?.('allyShot',.25,{x:p.x,y:p.y});
 return true;
}
export function drawConvoyRelic(ctx,game){
 const a=game.convoyRelic?.active;if(!a||a.until<=game.time)return;
 const spec=RELICS[a.id],p=game.player;if(!spec||!p)return;
 const t=game.time*1.3,r=33,remaining=(a.until-game.time)/RELIC_SECONDS;
 ctx.save();ctx.strokeStyle=spec.color;ctx.fillStyle=spec.color;
 ctx.lineWidth=1.8;ctx.globalAlpha=.27+.13*Math.sin(t*3);
 ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.stroke();
 for(let i=0;i<3;i++){
  const angle=t+i*Math.PI*2/3,x=p.x+Math.cos(angle)*r,y=p.y+Math.sin(angle)*r;
  ctx.globalAlpha=.5+.25*Math.sin(t*4+i);ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();
 }
 ctx.globalAlpha=Math.max(.15,Math.min(.75,remaining));ctx.lineWidth=2;
 ctx.beginPath();ctx.arc(p.x,p.y,r+5,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,remaining));ctx.stroke();
 ctx.restore();
}
export const validConvoyRelic=(s,time)=>s===undefined||!!s&&
 Number.isInteger(s.misses)&&s.misses>=0&&s.misses<=2&&
 Number.isFinite(s.lastGrantedAt)&&s.lastGrantedAt>=-1000&&s.lastGrantedAt<=time&&
 (s.active===null||!!s.active&&Object.hasOwn(RELICS,s.active.id)&&
 Number.isFinite(s.active.until)&&s.active.until>=0&&s.active.until<=time+RELIC_SECONDS*1.5&&
 Number.isFinite(s.active.nextFireAt)&&s.active.nextFireAt>=0&&s.active.nextFireAt<=time+RELIC_SECONDS*1.5);
