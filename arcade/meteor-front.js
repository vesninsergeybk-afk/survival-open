// A moving, finite meteor event. It uses the game's real warned orbital zones,
// so station PVO can spend ammunition, ships take contact damage and rocks
// fracture through the existing systems. New ore is persistent, not a loot
// payment for simply waiting out the storm.
import {hash,RULES} from './balance.js';

export const METEOR_FRONT=Object.freeze({firstAt:190,revisit:390,warning:12,
 duration:31,strikes:15,strikeGap:2,radius:74,depositCount:4});
const TAU=Math.PI*2;
export const createMeteorFront=()=>({version:1,nextAt:METEOR_FRONT.firstAt,
 serial:0,active:null});
export const frontPhase=(state,time)=>!state?.active?null:
 time<state.active.at+METEOR_FRONT.warning?'warning':
 time<state.active.at+METEOR_FRONT.warning+METEOR_FRONT.duration?'passing':'aftermath';
export function frontStrikePoint(active,index){
 const angle=active.angle,dx=Math.cos(angle),dy=Math.sin(angle);
 const side=(hash(index+11,active.serial,active.seed)-.5)*610;
 const along=-1110+index*155;
 return {x:active.x+dx*along-dy*side,y:active.y+dy*along+dx*side};
}
export function frontDistance(active,x,y){
 const nx=-Math.sin(active.angle),ny=Math.cos(active.angle);
 return Math.abs((x-active.x)*nx+(y-active.y)*ny);
}
export function validMeteorFront(state,time=0){
 if(state===undefined)return true;
 if(!state||state.version!==1||!Number.isInteger(state.serial)||state.serial<0||
  state.serial>100000||!Number.isFinite(state.nextAt)||state.nextAt<0||state.nextAt>1e9)return false;
 const a=state.active;
 return a===null||!!a&&Number.isInteger(a.serial)&&a.serial>=1&&a.serial<=state.serial&&
  Number.isInteger(a.seed)&&Number.isFinite(a.at)&&a.at>=0&&a.at<=time&&
  Number.isFinite(a.x)&&Number.isFinite(a.y)&&Number.isFinite(a.angle)&&
  a.angle>=0&&a.angle<=TAU&&Number.isInteger(a.strikes)&&a.strikes>=0&&
  a.strikes<=METEOR_FRONT.strikes&&typeof a.depositsMade==='boolean';
}
function createOreRock(game,point,index){
 const world=game.world,cell=RULES.rockCell;
 if(Math.hypot(point.x,point.y)>50000||
  Math.hypot(point.x-world.home.x,point.y-world.home.y)<1050||
  world.nearbyStations(point.x,point.y,165,true).some(b=>
   Math.hypot(point.x-b.x,point.y-b.y)<160)||
  world.nearbyRocks(point.x,point.y,95).some(r=>
   Math.hypot(point.x-r.x,point.y-r.y)<r.r+36))return false;
 const cx=Math.floor(point.x/cell),cy=Math.floor(point.y/cell),key=cx+':'+cy;
 const list=world.rockCell(cx,cy),active=game.meteorFront.active;
 const id=key+'/meteor-front-'+active.serial+'-'+index;
 if(list.some(r=>r.id===id))return false;
 const r=26+Math.floor(hash(index,active.serial,active.seed)*13),hp=(30+r*.65)*1.35;
 list.push({id,originKind:'event',x:point.x,y:point.y,originX:point.x,originY:point.y,
  r,vx:0,vy:0,spin:0,spinVelocity:0,flash:0,heat:0,
  rich:true,hp,maxHp:hp,alive:true});
 return true;
}
export function updateMeteorFront(game){
 const state=game.meteorFront;if(!state||!game.player||!game.world)return;
 const time=game.time,p=game.player;
 if(!state.active){
  if(time<state.nextAt||game.contourTrial||game.dead)return;
  // No unavoidable barrage right outside the starting dock.
  if(Math.hypot(p.x-game.world.home.x,p.y-game.world.home.y)<950){
   state.nextAt=time+24;return;
  }
  const serial=++state.serial,angle=hash(serial,31,game.seed)*TAU;
  const nx=-Math.sin(angle),ny=Math.cos(angle);
  state.active={serial,seed:game.seed,x:p.x+nx*260,y:p.y+ny*260,
   at:time,angle,strikes:0,depositsMade:false};
  game.notice('РАДАР: МЕТЕОРИТНЫЙ ФРОНТ · через 12 с. Полоса удара отмечена на карте; можно обойти её или использовать против врага.',6);
  game.heritage?.play?.('orbitalWarning',.6,{x:p.x,y:p.y});
 }
 const a=state.active;
 const began=a.at+METEOR_FRONT.warning;
 while(a.strikes<METEOR_FRONT.strikes&&time>=began+a.strikes*METEOR_FRONT.strikeGap){
  const spot=frontStrikePoint(a,a.strikes);
  game.zones.push({...spot,r:METEOR_FRONT.radius,fuse:1.85,fuseStart:1.85,
   ttl:.62,meteorFrontSerial:a.serial});
  a.strikes++;
 }
 if(time<began+METEOR_FRONT.duration||a.depositsMade)return;
 a.depositsMade=true;
 let count=0;
 for(let i=0;i<METEOR_FRONT.depositCount;i++){
  const point=frontStrikePoint(a,2+i*4);
  if(createOreRock(game,point,i))count++;
 }
 if(count)game.notice('МЕТЕОРИТНЫЙ ФРОНТ ПРОШЁЛ · появились '+count+
  ' богатые жилы. Они останутся в секторе и отмечены на карте.',5);
 else game.notice('Метеоритный фронт прошёл. Сканер не обнаружил новых доступных жил.',4);
 state.nextAt=time+METEOR_FRONT.revisit;
 state.active=null;
}
export function drawMeteorFront(game,c,cam){
 const a=game.meteorFront?.active;if(!a)return;
 const elapsed=game.time-a.at,remaining=Math.max(0,METEOR_FRONT.warning-elapsed);
 const dx=Math.cos(a.angle),dy=Math.sin(a.angle),nx=-dy,ny=dx;
 // Bounds test avoids wide gradients when the front is in a remote sector.
 if(Math.abs(a.x-(cam.x+cam.w/2))>cam.w/2+1800||
  Math.abs(a.y-(cam.y+cam.h/2))>cam.h/2+1800)return;
 c.save();c.translate(a.x,a.y);c.rotate(a.angle);
 c.strokeStyle=remaining?'#ffca8ab5':'#ff8d62c8';c.fillStyle='#ff996a16';
 c.lineWidth=remaining?3:5;c.setLineDash(remaining?[18,10]:[9,6]);
 c.fillRect(-1200,-380,2400,760);
 c.strokeRect(-1200,-380,2400,760);c.setLineDash([]);
 if(elapsed>=METEOR_FRONT.warning){
  const head=-1110+Math.min(METEOR_FRONT.strikes,a.strikes)*155;
  c.fillStyle='#ffd7a3a8';
  for(let i=0;i<7;i++){
   const x=head-i*75,y=Math.sin(game.time*.9+i)*180;
   c.beginPath();c.arc(x,y,5+i%3*4,0,TAU);c.fill();
  }
 }
 c.rotate(-a.angle);c.fillStyle='#ffe7bd';c.textAlign='center';
 c.font='bold 16px system-ui';
 c.fillText(remaining?'МЕТЕОРИТНЫЙ ФРОНТ · '+Math.ceil(remaining)+' С':'МЕТЕОРИТНЫЙ ФРОНТ · УДАРЫ',0,-420,460);
 c.restore();
}
