/**
 * Short, world-space proof of actual damage. No new damage, particles,
 * knockback, random numbers or invented shield absorption.
 *
 * An impact happens only after damageTarget confirms lost HP. A rupture is
 * shown only on the first crossing of the surviving hull's critical threshold;
 * a finishing mark accompanies the existing destruction animation.
 */
export const HIT_FEEDBACK_CAP=40;
const TAU=Math.PI*2;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const PALETTE=Object.freeze({
 plasma:'#7beaff',rail:'#b8c7ff',flak:'#ffc17e',rocket:'#ffb17e',
 ion:'#94f0ff',resonance:'#e3b3ff',howitzer:'#ffceea'
});
const SOURCE=Object.freeze({beam:'plasma',plasma:'plasma',rail:'rail',
 flak:'flak',rocket:'rocket',ion:'ion',resonance:'resonance',
 resonator:'resonance',howitzer:'howitzer'});
const finite=n=>Number.isFinite(n);
const push=(events,event)=>{
 if(events.length>=HIT_FEEDBACK_CAP){
  const weaker=events.findIndex(x=>x.kind==='impact');
  events.splice(weaker<0?0:weaker,1);
 }
 events.push(event);
};

/** Receives actual HP lost, after resistance and target-specific rules. */
export function recordHitFeedback(game,item,dealt,source,point,before){
 const family=SOURCE[source],target=item?.target;
 if(!family||!target||!(dealt>0)||!finite(target.x)||!finite(target.y))
  return false;
 const events=game.combatHitFx??(game.combatHitFx=[]);
 const maxHp=Math.max(1,Number(target.maxHp)||before||dealt);
 const power=clamp(Math.sqrt(dealt/(maxHp*.32)),.16,1);
 const r=clamp(Number(target.r)||({base:60,turret:22,jammer:30}[item.kind])||18,9,90);
 const directed=!!point?.directed&&finite(point.x)&&finite(point.y)&&
  finite(point.nx)&&finite(point.ny);
 const x=finite(point?.x)?point.x:target.x;
 const y=finite(point?.y)?point.y:target.y;
 let last=null;
 for(let i=events.length-1;i>=0;i--)
  if(events[i].kind==='impact'&&events[i].target===target&&
   events[i].family===family&&events[i].age<.065){last=events[i];break;}
 if(last){
  last.power=Math.max(last.power,power);
  last.age=0;
  last.x=x;last.y=y;
 }else{
  push(events,{kind:'impact',target,family,power,x,y,r,
   nx:directed?point.nx:0,ny:directed?point.ny:0,
   directed,age:0,life:.23});
 }
 const after=Math.max(0,Number(target.hp)||0);
 if(!target.captured&&after===0){
  // The ordinary ship explosion still handles destruction and debris.
  push(events,{kind:'finish',target,family,power:1,x:target.x,y:target.y,
   r,age:0,life:.37});
 }else if(!target.captured&&!target._criticalFractureFx&&
  before/maxHp>.35&&after/maxHp<=.35&&after>0){
  target._criticalFractureFx=true;
  push(events,{kind:'fracture',target,family,power,x,y,r,
   tx:target.x,ty:target.y,age:0,life:.43});
 }
 return true;
}

export function updateHitFeedback(game,dt){
 const events=game.combatHitFx;
 if(!events?.length||!finite(dt)||dt<=0)return;
 for(const event of events)event.age+=dt;
 game.combatHitFx=events.filter(event=>event.age<event.life);
}

function stroke(c,x,y,x2,y2,color,width,alpha){
 c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;
 c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();
}
function ring(c,x,y,r,color,width,alpha,start=0,end=TAU){
 if(!(r>0))return;
 c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;
 c.beginPath();c.arc(x,y,r,start,end);c.stroke();
}
function spot(c,x,y,r,color,alpha){
 c.globalAlpha=alpha;c.fillStyle=color;
 c.beginPath();c.arc(x,y,r,0,TAU);c.fill();
}

function impact(c,e,fade,high,medium){
 const {x,y,power,family}=e,color=PALETTE[family];
 const r=(3+11*power)*(high?1:.86);
 const nx=e.directed?e.nx:0,ny=e.directed?e.ny:0;
 const tx=-ny,ty=nx;
 // All seven signatures share an honest contact point, but not a silhouette.
 spot(c,x,y,1.2+2.2*power,'#fff9de',fade*.86);
 if(!medium){
  ring(c,x,y,r*.64,color,1.5,fade*.85);
  return;
 }
 if(high&&power>.72&&family!=='rocket')
  ring(c,x,y,r*1.5,color,1.25,fade*.24);
 switch(family){
  case 'plasma':{
   ring(c,x,y,r*.9,color,1.4,fade*.58,Math.PI*.18,Math.PI*1.46);
   if(e.directed){
    stroke(c,x-nx*r*.24,y-ny*r*.24,
     x+nx*r*.9+tx*r*.65,y+ny*r*.9+ty*r*.65,color,1.6,fade*.85);
    if(high)stroke(c,x+nx*r*.35,y+ny*r*.35,
     x+nx*r*1.35-tx*r*.55,y+ny*r*1.35-ty*r*.55,'#b7f7ff',1.1,fade*.67);
   }
   break;
  }
  case 'rail':{
   const ax=e.directed?nx:1,ay=e.directed?ny:0;
   const bx=-ay,by=ax;
   for(const sign of [-1,1])
    stroke(c,x-bx*r*sign*.57,y-by*r*sign*.57,
     x+ax*r*1.45-bx*r*sign*.3,y+ay*r*1.45-by*r*sign*.3,
     color,high?2.2:1.6,fade*.93);
   if(high)stroke(c,x-ax*r*.8,y-ay*r*.8,
    x+ax*r*1.7,y+ay*r*1.7,'#fff8f4',1.3,fade*.88);
   break;
  }
  case 'flak':{
   for(let i=0;i<(high?4:3);i++){
    const angle=TAU*i/4+.35,dx=Math.cos(angle),dy=Math.sin(angle);
    stroke(c,x+dx*r*.4,y+dy*r*.4,
     x+dx*r*(1.05+power*.4),y+dy*r*(1.05+power*.4),
     i%2?'#ffe6b4':color,high?2.1:1.6,fade*.85);
   }
   break;
  }
  case 'rocket':{
   // The real rocket explosion owns the large orange fireball; only the
   // pressure edge is added here, preventing a second false detonation.
   ring(c,x,y,r*1.05,color,2.2,fade*.65,Math.PI*.15,Math.PI*1.6);
   break;
  }
  case 'ion':{
   for(const sign of [-1,1]){
    const side=sign*r*.65,xx=x+tx*side,yy=y+ty*side;
    stroke(c,x,y,xx+nx*r*.6,yy+ny*r*.6,color,1.8,fade*.9);
    if(high)stroke(c,xx+nx*r*.6,yy+ny*r*.6,
     xx+nx*r*1.25+tx*side*.6,yy+ny*r*1.25+ty*side*.6,
     '#e4fdff',1.2,fade*.8);
   }
   break;
  }
  case 'resonance':{
   ring(c,x,y,r*.68,color,2,fade*.85);
   if(high)ring(c,x,y,r*1.3,'#f5deff',1.3,fade*.5);
   break;
  }
  case 'howitzer':{
   ring(c,x,y,r*1.25,color,high?3:2,fade*.7);
   for(let i=0;i<(high?4:2);i++){
    const a=TAU*i/4+Math.PI*.25,dx=Math.cos(a),dy=Math.sin(a);
    stroke(c,x+dx*r*.65,y+dy*r*.65,x+dx*r*1.7,y+dy*r*1.7,
     '#fff2d8',high?2.7:2,fade*.86);
   }
   break;
  }
 }
}

function fracture(c,e,fade,high){
 const dx=e.tx-e.x,dy=e.ty-e.y,len=Math.hypot(dx,dy)||1;
 const ux=dx/len,uy=dy/len,nx=-uy,ny=ux;
 const reach=Math.min(e.r*.85,24),x=e.x,y=e.y;
 ring(c,x,y,reach*.35,'#ffc489',1.8,fade*.46,Math.PI*.15,Math.PI*1.4);
 stroke(c,x,y,x+ux*reach*.52+nx*reach*.25,
  y+uy*reach*.52+ny*reach*.25,'#fff1c5',2.8,fade*.9);
 stroke(c,x+ux*reach*.52+nx*reach*.25,y+uy*reach*.52+ny*reach*.25,
  x+ux*reach,y+uy*reach,'#ff8e72',2.2,fade*.85);
 if(high)stroke(c,x+ux*reach*.52+nx*reach*.25,
  y+uy*reach*.52+ny*reach*.25,
  x+ux*reach*.74+nx*reach*.65,y+uy*reach*.74+ny*reach*.65,
  '#ffc08a',1.6,fade*.72);
}

function finish(c,e,fade,high,reducedMotion){
 const t=reducedMotion ? .4 : clamp(e.age/e.life,0,1);
 const radius=clamp(e.r*.85,12,65)*(0.65+.75*t);
 ring(c,e.x,e.y,radius,'#fff0af',high?2.9:2.1,fade*.9);
 if(high){
  for(let i=0;i<4;i++){
   const a=TAU*i/4+Math.PI*.25,dx=Math.cos(a),dy=Math.sin(a);
   stroke(c,e.x+dx*radius*.72,e.y+dy*radius*.72,
    e.x+dx*radius*1.24,e.y+dy*radius*1.24,
    '#ffd3ab',2.1,fade*.63);
  }
 }
}

/** Called after ships and shot traces, before the existing explosion layer. */
export function drawHitFeedback(ctx,events,fps=60,reducedMotion=false,camera=null){
 if(!events?.length)return;
 const high=fps>=42,medium=fps>=26;
 for(const event of events){
  if(event.age>=event.life)continue;
  if(camera&&(event.x<camera.x-120||event.y<camera.y-120||
   event.x>camera.x+camera.w+120||event.y>camera.y+camera.h+120))continue;
  const fade=clamp((event.life-event.age)/Math.min(.18,event.life),0,1);
  if(fade<=0)continue;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  if(event.kind==='impact')impact(ctx,event,fade,high,medium);
  else if(event.kind==='fracture')fracture(ctx,event,fade,high);
  else if(event.kind==='finish')finish(ctx,event,fade,high,reducedMotion);
  ctx.restore();
 }
}
