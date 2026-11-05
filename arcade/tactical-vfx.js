/** Visual language for the four non-damaging tactical devices.
 * The effect radius and expiry come from live gameplay state. Drawing is pure:
 * no timers, random state, physics changes or generated textures per frame.
 */
const TAU=Math.PI*2;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const palette=Object.freeze({pulse:'#a4f0ff',shell:'#86eafb',
 decoy:'#ffd28c',trap:'#bc9bff',jam:'#8af9d2'});

function arc(c,x,y,r,start,end,color,alpha=.6,width=2){
 if(r<=0)return;
 c.strokeStyle=color;c.globalAlpha=clamp(alpha);c.lineWidth=width;
 c.beginPath();c.arc(x,y,r,start,end);c.stroke();
}
function ray(c,x,y,r0,r1,angle,color,alpha=.6,width=1){
 c.strokeStyle=color;c.globalAlpha=clamp(alpha);c.lineWidth=width;
 c.beginPath();c.moveTo(x+Math.cos(angle)*r0,y+Math.sin(angle)*r0);
 c.lineTo(x+Math.cos(angle)*r1,y+Math.sin(angle)*r1);c.stroke();
}
function dot(c,x,y,r,color,alpha=.75){
 c.fillStyle=color;c.globalAlpha=clamp(alpha);
 c.beginPath();c.arc(x,y,r,0,TAU);c.fill();
}
function visible(p,r,cam){
 return !cam||p.x+r>=cam.x&&p.x-r<=cam.x+cam.w&&
  p.y+r>=cam.y&&p.y-r<=cam.y+cam.h;
}

function pulseVfx(c,game,now,low,still,cam){
 const state=game.tactical,age=now-(state.pulseAt??-Infinity),duration=.48;
 if(age<0||age>duration)return;
 const r=state.pulseRadius||165,p={x:state.pulseX,y:state.pulseY};
 if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!visible(p,r,cam))return;
 const branch=state.branches?.pulse?.path,burst=branch==='burst';
 const intensity=(1-age/duration),travel=still?1:clamp(age/.32),
  wake=still?1:clamp((age-.055)/.36);
 // Two causal wavefronts, both confined to the true radius of influence.
 arc(c,p.x,p.y,r*travel,0,TAU,burst?'#ffdfb4':palette.pulse,
  intensity*.58,burst?5:3.4);
 if(!low)arc(c,p.x,p.y,r*wake,0,TAU,burst?'#f6aaff':'#5bc6e9',
  intensity*.34,1.7);
 dot(c,p.x,p.y,3+7*intensity,burst?'#ffddaa':palette.pulse,
  intensity*.23);
 const segments=low?4:10;
 for(let i=0;i<segments;i++){
  const angle=i*TAU/segments+(burst?.15:0),outer=r*travel;
  ray(c,p.x,p.y,Math.max(0,outer-(burst?34:23)*intensity),
   outer,angle,burst?'#ffb3ab':'#a2f1ff',intensity*.72,burst?2.6:1.5);
 }
}

function shellVfx(c,p,r,t,fade,low){
 // Rotating petals ride with the ship. The solid border is drawn by the base
 // field renderer; these inner arcs are movement and charge, not extra range.
 const count=low?2:4;
 for(let i=0;i<count;i++){
  const angle=i*TAU/count+t*.46;
  arc(c,p.x,p.y,r*.83,angle,angle+.48,palette.shell,fade*.62,2.5);
  arc(c,p.x,p.y,r*.57,-angle,-angle+.68,'#b8faff',fade*.27,1.3);
 }
 const heading=Math.atan2(p.vy||0,p.vx||0),moving=Math.hypot(p.vx||0,p.vy||0)>15;
 if(moving)for(let i=-1;i<=1;i++){
  const a=heading+Math.PI+i*.38;
  ray(c,p.x,p.y,r*.52,r*.78,a,'#8deafb',fade*.26,2);
 }
 dot(c,p.x,p.y,5,'#d8ffff',fade*.34);
}

function decoyVfx(c,e,t,fade,low,game,cam){
 const x=e.x,y=e.y,r=e.radius,period=2.5;
 for(let j=0;j<(low?1:2);j++){
  const phase=((t/period+j/(low?1:2))%1+1)%1;
  arc(c,x,y,r*(.1+phase*.9),0,TAU,palette.decoy,
   fade*(1-phase)*.24,1.8);
 }
 const theta=t*.36;
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2+theta;
  arc(c,x,y,28,a-.24,a+.24,'#ffe9b2',fade*.78,2.8);
 }
 dot(c,x,y,5,'#ffe4a4',fade*.9);
 c.strokeStyle='#ffe2a1';c.lineWidth=1.5;c.globalAlpha=fade*.72;
 c.beginPath();c.moveTo(x-12,y);c.lineTo(x-5,y);
 c.moveTo(x+5,y);c.lineTo(x+12,y);
 c.moveTo(x,y-12);c.lineTo(x,y-5);
 c.moveTo(x,y+5);c.lineTo(x,y+12);c.stroke();
 // Only a player-observable, actually diverted pilot gets a course line.
 let links=0;
 for(const enemy of game.enemies||[]){
  if(links>=(low?1:3)||enemy.hp<=0||
    enemy._tacticalDecoyUntil<=game.time||
    !game.playerCanInspectEnemyIntent?.(enemy)||
    Math.hypot(enemy.x-x,enemy.y-y)>Math.min(r,390)||
    !visible(enemy,16,cam))continue;
  c.globalAlpha=fade*.35;c.strokeStyle=palette.decoy;c.lineWidth=1.4;
  c.setLineDash([3,9]);c.beginPath();c.moveTo(enemy.x,enemy.y);
  c.lineTo(x,y);c.stroke();c.setLineDash([]);
  links++;
 }
}

function trapVfx(c,e,t,fade,low,branch){
 const {x,y,radius:r}=e,sink=branch==='sink',snare=branch==='snare';
 const levels=low?2:3;
 for(let i=0;i<levels;i++){
  const size=r*(.28+i*.23),angle=t*(i%2?-.31:.31)+i*.96;
  arc(c,x,y,size,angle,angle+1.72,palette.trap,fade*(.42-i*.06),2.2);
  arc(c,x,y,size,angle+Math.PI,angle+Math.PI+1.16,'#dac8ff',fade*.24,1.3);
 }
 if(sink){
  // Inward streamlines advertise the actual pull-to-center branch.
  for(let i=0;i<(low?4:8);i++){
   const a=i*TAU/(low?4:8)+t*.23;
   ray(c,x,y,r*.7,r*.36,a,'#dfc7ff',fade*.58,1.6);
   const tip=r*.35,dx=Math.cos(a)*tip,dy=Math.sin(a)*tip;
   ray(c,x+dx,y+dy,0,10,a+2.62,'#dfc7ff',fade*.58,1.6);
   ray(c,x+dx,y+dy,0,10,a-2.62,'#dfc7ff',fade*.58,1.6);
  }
 }else if(snare){
  // Heavy radial bars are a visual cue for stronger resistance, not damage.
  for(let i=0;i<(low?6:12);i++){
   const a=i*TAU/(low?6:12)+t*.06;
   arc(c,x,y,r*.71,a,a+.12,'#f2d4ff',fade*.72,4);
  }
 }else{
  for(let i=0;i<(low?3:6);i++){
   const a=i*TAU/(low?3:6)-t*.17;
   ray(c,x,y,r*.76,r*.88,a,'#bdadff',fade*.42,1.4);
  }
 }
 dot(c,x,y,6,'#e0c7ff',fade*.56);
 arc(c,x,y,13,0,TAU,'#e6d6ff',fade*.56,1.3);
}

function jamVfx(c,e,t,fade,low){
 const {x,y,radius:r}=e,inner=Math.min(74,r*.17),count=low?4:8;
 // Broken arcs depict interrupted radio paths. They cannot be mistaken for
 // projectiles, and they do not disclose the location of hidden mesh nodes.
 for(let i=0;i<count;i++){
  const a=i*TAU/count+t*.19,span=TAU/count*.63;
  arc(c,x,y,inner,a,a+span,palette.jam,
   fade*(e.confirmed?.72:.38),e.confirmed?2.9:1.5);
 }
 arc(c,x,y,inner*.62,t*.45,t*.45+Math.PI*.83,
  '#c4ffee',fade*.46,2);
 const outer=Math.min(140,r*.32);
 for(let i=0;i<(low?3:6);i++){
  const a=i*TAU/(low?3:6)-t*.14;
  ray(c,x,y,outer*.74,outer,a,'#a0f2d9',fade*.22,1.2);
 }
 // A received attempt makes the center visibly break, with no false
 // "blocked link" effect when no transmission was actually attempted.
 if(e.confirmed){
  c.strokeStyle='#e0fff0';c.lineWidth=2.5;c.globalAlpha=fade*.9;
  c.beginPath();c.moveTo(x-19,y-13);c.lineTo(x-4,y-2);
  c.moveTo(x+4,y+2);c.lineTo(x+19,y+13);
  c.moveTo(x-3,y+12);c.lineTo(x+4,y-12);c.stroke();
  dot(c,x,y,3,'#fff',fade*.72);
 }else dot(c,x,y,4,palette.jam,fade*.52);
}

function affectedEnemyVfx(c,game,now,low,cam){
 let rendered=0;
 for(const e of game.enemies||[]){
  if(rendered>=(low?3:7))break;
  if(e.hp<=0||e.converted||!visible(e,26,cam)||
    !game.playerCanInspectEnemyIntent?.(e))continue;
  const slowed=e.tacticalSlowUntil>now,repelled=e._tacticalRepel?.until>now;
  if(!slowed&&!repelled)continue;
  const radius=(e.r||14)+6;
  arc(c,e.x,e.y,radius,-Math.PI*.75,Math.PI*.1,
   repelled?'#ffbdab':palette.pulse,.58,2);
  if(!low)arc(c,e.x,e.y,radius,Math.PI*.25,Math.PI*.65,
   repelled?'#ffecbe':'#9adeef',.42,2);
  if(repelled){
   const a=Math.atan2(e._tacticalRepel.y,e._tacticalRepel.x);
   ray(c,e.x,e.y,radius+2,radius+17,a,'#ffd2a4',.72,2);
  }
  rendered++;
 }
}

/** Called inside the world's camera transform, directly before drawTactical.
 * With reduced motion the patterns stop rotating; at low FPS details drop.
 */
export function drawTacticalVfx(ctx,game,cam=null){
 const state=game?.tactical,now=game?.time;
 if(!state||!Number.isFinite(now))return;
 const low=(game.fps||60)<28,still=!!game.visuals?.reducedMotion;
 const t=still?0:now;
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 for(const e of state.effects||[]){
  if(e.until<=now||!Number.isFinite(e.radius)||e.radius<=0)continue;
  const p=e.kind==='shell'?game.player:e;
  if(!p||!visible(p,e.radius,cam))continue;
  const fade=clamp((e.until-now)/.6);
  if(e.kind==='shell')shellVfx(ctx,p,e.radius,t,fade,low);
  else if(e.kind==='decoy')decoyVfx(ctx,e,t,fade,low,game,cam);
  else if(e.kind==='trap')trapVfx(ctx,e,t,fade,low,
   state.branches?.trap?.path);
  else if(e.kind==='jam')jamVfx(ctx,e,t,fade,low);
 }
 pulseVfx(ctx,game,now,low,still,cam);
 affectedEnemyVfx(ctx,game,now,low,cam);
 ctx.restore();
}
