// A moving, finite meteor event. It uses the game's real warned orbital zones,
// so station PVO can spend ammunition, ships take contact damage and rocks
// fracture through the existing systems. New ore is persistent, not a loot
// payment for simply waiting out the storm.
import {hash,RULES} from './balance.js';

export const METEOR_FRONT=Object.freeze({firstAt:190,revisit:390,warning:12,
 duration:31,strikes:15,strikeGap:2,radius:74,depositCount:4,
 lead:-1110,step:155,spread:610});
const TAU=Math.PI*2;
export const createMeteorFront=()=>({version:1,nextAt:METEOR_FRONT.firstAt,
 serial:0,active:null});
export const frontPhase=(state,time)=>!state?.active?null:
 time<state.active.at+METEOR_FRONT.warning?'warning':
 time<state.active.at+METEOR_FRONT.warning+METEOR_FRONT.duration?'passing':'aftermath';
export function frontStrikePoint(active,index){
 const angle=active.angle,dx=Math.cos(angle),dy=Math.sin(angle);
 const side=(hash(index+11,active.serial,active.seed)-.5)*METEOR_FRONT.spread;
 const along=METEOR_FRONT.lead+index*METEOR_FRONT.step;
 return {x:active.x+dx*along-dy*side,y:active.y+dy*along+dx*side};
}
// A guaranteed enclosure of every impact circle. Use the same geometry for
// the flight display and the strategic map, even though individual hits wander
// sideways within the front.
export function frontCorridor(active){
 const dx=Math.cos(active.angle),dy=Math.sin(active.angle);
 const start=METEOR_FRONT.lead-METEOR_FRONT.radius;
 const end=METEOR_FRONT.lead+(METEOR_FRONT.strikes-1)*METEOR_FRONT.step+METEOR_FRONT.radius;
 return {start:{x:active.x+dx*start,y:active.y+dy*start},
  end:{x:active.x+dx*end,y:active.y+dy*end},
  halfWidth:METEOR_FRONT.spread/2+METEOR_FRONT.radius};
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

/** Draws only an incoming body; the existing zone still owns its collision and warning. */
function drawIncomingMeteor(c,game,active,index,age){
 const u=Math.min(1,Math.max(0,age/1.85));
 const side=(hash(index+11,active.serial,active.seed)-.5)*METEOR_FRONT.spread;
 const along=METEOR_FRONT.lead+index*METEOR_FRONT.step;
 const x=along-250*(1-u),y=side-170*(1-u);
 const detail=!game.visuals?.reducedMotion&&(game.fps??60)>=34;
 const size=20+17*u;
 c.save();c.translate(x,y);
 if(detail){
  c.globalCompositeOperation='lighter';
  const tail=c.createLinearGradient(-178,-125,12,6);
  tail.addColorStop(0,'rgba(255,128,45,0)');
  tail.addColorStop(.48,'rgba(252,122,58,.22)');
  tail.addColorStop(1,'rgba(255,229,156,.82)');
  c.strokeStyle=tail;c.lineWidth=7+u*3;c.lineCap='round';
  c.beginPath();c.moveTo(-178,-125);c.lineTo(0,0);c.stroke();
  c.globalCompositeOperation='source-over';
  const glow=c.createRadialGradient(0,0,0,0,0,54);
  glow.addColorStop(0,'rgba(255,242,204,.28)');
  glow.addColorStop(.34,'rgba(250,147,74,.16)');
  glow.addColorStop(1,'rgba(230,75,32,0)');
  c.fillStyle=glow;c.fillRect(-54,-54,108,108);
 }
 // Prefer the same real 3D-tumble frames used by ordinary asteroids.
 // This changes only the sprite; the existing strike zones still own all damage.
 if(game.visuals?.rotatingAsteroids?.drawIncoming(c,active,index,age,size)){
  c.restore();return;
 }
 const sprites=game.visuals?.legacyMeteors;
 const art=sprites?.[(active.serial+index)%sprites.length];
 if(art?.complete&&art.naturalWidth>0){
  c.rotate(active.angle*.12+age*.8);
  c.drawImage(art,-size/2,-size/2,size,size);
 }else{
  c.rotate(.38+index*.7);
  c.fillStyle='#7d5b52';c.strokeStyle='#ffd69b';c.lineWidth=1.3;
  c.beginPath();c.moveTo(-size*.48,-size*.22);c.lineTo(-size*.15,-size*.54);
  c.lineTo(size*.38,-size*.31);c.lineTo(size*.53,size*.17);
  c.lineTo(size*.05,size*.49);c.lineTo(-size*.49,size*.22);
  c.closePath();c.fill();c.stroke();
 }
 c.restore();
}

export function drawMeteorFront(game,c,cam){
 const a=game.meteorFront?.active;if(!a)return;
 const elapsed=game.time-a.at,remaining=Math.max(0,METEOR_FRONT.warning-elapsed);
 const corridor=frontCorridor(a);
 const start=METEOR_FRONT.lead-METEOR_FRONT.radius;
 const length=(METEOR_FRONT.strikes-1)*METEOR_FRONT.step+METEOR_FRONT.radius*2;
 // Bounds test avoids wide gradients when the front is in a remote sector.
 if(Math.abs(a.x-(cam.x+cam.w/2))>cam.w/2+1800||
  Math.abs(a.y-(cam.y+cam.h/2))>cam.h/2+1800)return;
 c.save();c.translate(a.x,a.y);c.rotate(a.angle);
 c.strokeStyle=remaining?'#ffca8ab5':'#ff8d62c8';c.fillStyle='#ff996a16';
 c.lineWidth=remaining?3:5;c.setLineDash(remaining?[18,10]:[9,6]);
 c.fillRect(start,-corridor.halfWidth,length,corridor.halfWidth*2);
 c.strokeRect(start,-corridor.halfWidth,length,corridor.halfWidth*2);c.setLineDash([]);
 if(elapsed>=METEOR_FRONT.warning){
  const head=METEOR_FRONT.lead+Math.min(METEOR_FRONT.strikes,a.strikes)*METEOR_FRONT.step;
  c.fillStyle='#ffd7a36c';
  for(let i=0;i<7;i++){
   const x=head-i*75,y=Math.sin(game.time*.9+i)*180;
   c.beginPath();c.arc(x,y,3+i%3*2,0,TAU);c.fill();
  }
  // Each falling stone follows a real strike's scheduled approach.
  // It ends at the existing orbital impact zone, without new damage.
  const max=Math.min(METEOR_FRONT.strikes,a.strikes);
  for(let i=Math.max(0,max-3);i<max;i++){
   const age=elapsed-METEOR_FRONT.warning-i*METEOR_FRONT.strikeGap;
   if(age>=0&&age<1.85)drawIncomingMeteor(c,game,a,i,age);
  }
 }
 c.rotate(-a.angle);c.fillStyle='#ffe7bd';c.textAlign='center';
 c.font='bold 16px system-ui';
 c.fillText(remaining?'МЕТЕОРИТНЫЙ ФРОНТ · '+Math.ceil(remaining)+' С':'МЕТЕОРИТНЫЙ ФРОНТ · УДАРЫ',0,-420,460);
 c.restore();
}
