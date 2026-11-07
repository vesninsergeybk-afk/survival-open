// World-space mission art. All movement and damage cues are derived from actual
// operation state; no independent animation clock is allowed to suggest progress.
const TAU=Math.PI*2;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ready=image=>image?.complete&&image.naturalWidth>0&&image.naturalHeight>0;
const quiet=game=>game.visuals?.reducedMotion||game.fps>0&&game.fps<30;

export function drawRelayArt(game,c,node,{fallback,shieldMax=40}={}){
 const art=game.images?.relayStates;
 const powered=!!(node.done||node.stabilized);
 const charging=!powered&&node.hp>0?clamp((node.progress||0)/(node.goal||1)):0;
 const open=powered?1:charging*.82;
 const time=game.time||0;
 if(ready(art)){
  c.save();c.translate(node.x,node.y);
  // Two images of precisely the same machine and silhouette, not a generic glow.
  c.globalAlpha=node.hp<=0?.5:1;
  c.drawImage(art,0,0,256,256,-45,-45,90,90);
  if(open>0){c.globalAlpha=(node.hp<=0?.5:1)*open;
   c.drawImage(art,256,0,256,256,-45,-45,90,90);}
  c.restore();
 }else fallback?.();
 if(node.hp<=0){
  c.save();c.strokeStyle='#ff896e';c.lineWidth=1.8;c.globalAlpha=.6;
  c.beginPath();c.moveTo(node.x-18,node.y-15);c.lineTo(node.x+13,node.y+18);
  c.moveTo(node.x+10,node.y-23);c.lineTo(node.x-8,node.y+17);c.stroke();c.restore();
 }
 if(charging>0){
  c.save();c.lineWidth=3.2;c.strokeStyle='#9cfff0';c.globalAlpha=.72;
  const offset=-Math.PI/2;
  for(let i=0;i<3;i++){
   const a=offset+i*TAU/3+.11;
   c.beginPath();c.arc(node.x,node.y,51,a,a+(TAU/3-.22)*clamp(charging*3-i));c.stroke();
  }
  c.restore();
 }
 const shield=clamp((node.fieldShield||0)/shieldMax);
 if(shield>0)drawShield(game,c,node,shield,time);
 const hitElapsed=time-(node.fieldShieldHitAt??-10);
 if(hitElapsed>=0&&hitElapsed<.8&&node.fieldShieldHitAngle!==undefined){
  const a=node.fieldShieldHitAngle,rad=72,progress=hitElapsed/.8;
  c.save();c.strokeStyle='#d8ffff';c.lineWidth=3.5*(1-progress)+.6;
  c.globalAlpha=(1-progress)*.95;c.beginPath();
  c.arc(node.x,node.y,rad+progress*14,a-.2-progress*.45,a+.2+progress*.45);c.stroke();
  c.restore();
 }
 const breakElapsed=time-(node.fieldShieldBreakAt??-10);
 if(shield===0&&breakElapsed>=0&&breakElapsed<.65&&!quiet(game)){
  const fade=1-breakElapsed/.65;
  c.save();c.strokeStyle='#7ceee9';c.lineWidth=2;c.globalAlpha=fade*.72;
  for(let i=0;i<7;i++){
   const a=i*TAU/7+breakElapsed*.5,r=68+breakElapsed*40;
   c.beginPath();c.moveTo(node.x+Math.cos(a)*r,node.y+Math.sin(a)*r);
   c.lineTo(node.x+Math.cos(a+.14)*(r+10),node.y+Math.sin(a+.14)*(r+10));c.stroke();
  }
  c.restore();
 }
 const hullElapsed=time-(node.fieldHullHitAt??-10);
 if(hullElapsed>=0&&hullElapsed<.35){
  const fade=1-hullElapsed/.35;
  c.save();c.globalAlpha=fade;c.strokeStyle='#ffc5a0';c.lineWidth=2.2;
  c.beginPath();c.arc(node.x,node.y,38+hullElapsed*20,0,TAU);c.stroke();c.restore();
 }
}

function drawShield(game,c,node,strength,time){
 const r=72,segments=12,alpha=.14+.15*strength;
 c.save();c.strokeStyle='#81f9eb';c.lineWidth=1.5;c.globalAlpha=alpha;
 c.fillStyle='#66eede';
 c.beginPath();
 for(let i=0;i<=segments;i++){
  const a=-Math.PI/2+i*TAU/segments;
  const x=node.x+Math.cos(a)*r,y=node.y+Math.sin(a)*r;
  if(!i)c.moveTo(x,y);else c.lineTo(x,y);
 }
 c.closePath();c.fill();c.stroke();
 c.globalAlpha=.32+.22*strength;
 for(let i=0;i<segments;i++){
  const a=-Math.PI/2+i*TAU/segments;
  c.beginPath();c.arc(node.x,node.y,r+1,a+.055,a+TAU/segments-.055);c.stroke();
 }
 if(!quiet(game)){
  c.globalAlpha=.13+.08*Math.sin(time*1.8);
  c.strokeStyle='#e5ffff';c.lineWidth=1;c.beginPath();
  c.arc(node.x,node.y,r-6,-Math.PI*.45,Math.PI*.35);c.stroke();
 }
 c.restore();
}

export function drawConvoyEngineArt(game,c,op,heading){
 if(!op.artMoving||quiet(game))return;
 c.save();c.translate(op.x,op.y);c.rotate(heading);
 const pulse=.85+.15*Math.sin((game.time||0)*17);
 for(const y of [-27,27]){
  c.globalAlpha=.24;c.fillStyle='#42b9ed';
  c.beginPath();c.moveTo(-75,y-12);c.lineTo(-109-pulse*30,y);c.lineTo(-75,y+12);c.closePath();c.fill();
  c.globalAlpha=.5;c.fillStyle='#3de6ff';
  c.beginPath();c.moveTo(-78,y-6);c.lineTo(-98-pulse*17,y);c.lineTo(-78,y+6);c.closePath();c.fill();
  c.globalAlpha=.85;c.fillStyle='#d3fcff';c.fillRect(-84,y-2.2,8,4.4);
 }
 c.restore();
}

export function drawConvoyHullArt(game,c,op,heading,fallback){
 const art=game.images?.convoyHealth;
 if(!ready(art)){fallback?.();return;}
 // These two frames have the same hull geometry. Repairs visibly remove scars.
 const damaged=clamp((75-op.hp)/30);
 c.save();c.translate(op.x,op.y);c.rotate(heading);
 c.drawImage(art,0,0,256,157,-86,-51.5,172,103);
 if(damaged>0){c.globalAlpha=damaged;
  c.drawImage(art,256,0,256,157,-86,-51.5,172,103);}
 c.restore();
}

export function drawConvoySurfaceArt(game,c,op,heading){
 const time=game.time||0;
 c.save();c.translate(op.x,op.y);c.rotate(heading);
 if(op.hp<65){
  const severity=clamp((65-op.hp)/45);
  // Fixed damage location on the hull; severity changes smoke and sparks.
  c.strokeStyle='#ff8b4e';c.lineWidth=1.8;c.globalAlpha=.54+.37*severity;
  c.beginPath();c.moveTo(43,-11);c.lineTo(54,-4);c.lineTo(47,5);c.lineTo(59,12);c.stroke();
  if(!quiet(game)){
   for(let i=0;i<(severity>.65?5:3);i++){
    const age=(time*.8+i*.31)%1;
    c.globalAlpha=(1-age)*severity*.27;c.fillStyle='#b9b3a9';
    c.beginPath();c.arc(50-age*(33+i*7),-8-age*(16+i*4),3+age*(5+i%2),0,TAU);c.fill();
   }
   if(severity>.35){
    const spark=Math.sin(time*10)>0?.7:0;
    c.globalAlpha=severity*spark;c.fillStyle='#ffbd7f';
    c.fillRect(48+Math.sin(time*13)*7,-6,2.4,2.4);
   }
  }
 }
 const repairing=game.actionHeld?.kind==='field-work'&&
  game.actionHeld.target===op.fieldRepair&&!op.fieldRepair?.used;
 if(repairing){
  const bot=game.images?.repairDrone;
  const y=-67+Math.sin(time*4)*4,x=16+Math.sin(time*2.7)*7;
  c.strokeStyle='#8bf5e9';c.globalAlpha=.75;c.lineWidth=1.5;c.beginPath();
  c.moveTo(x,y+10);c.lineTo(45,-14);c.stroke();
  if(ready(bot)){
   c.globalAlpha=1;c.drawImage(bot,x-20,y-20,40,40);
  }else{
   c.globalAlpha=.9;c.fillStyle='#d8f5ed';c.beginPath();c.arc(x,y,9,0,TAU);c.fill();
  }
  const progress=clamp((op.fieldRepair?.progress||0)/(op.fieldRepair?.goal||4));
  c.globalAlpha=.55+.4*Math.sin(time*15)**2;c.fillStyle='#d5fffb';
  c.beginPath();c.arc(45,-14,2.8+3*progress,0,TAU);c.fill();
  if(!quiet(game))for(let i=0;i<3;i++){
   const a=time*9+i*TAU/3;
   c.globalAlpha=.6;c.fillStyle='#78f6e4';
   c.fillRect(45+Math.cos(a)*(5+i*2),-14+Math.sin(a)*(5+i*2),2,2);
  }
 }
 const repairedElapsed=time-(op.fieldRepairedAt??-10);
 if(repairedElapsed>=0&&repairedElapsed<1){
  c.globalAlpha=(1-repairedElapsed)*.8;c.strokeStyle='#98ffea';c.lineWidth=2;
  c.beginPath();c.arc(45,-14,20+repairedElapsed*26,-.7,Math.PI*.9);c.stroke();
 }
 c.restore();
 const hullElapsed=time-(op.fieldHullHitAt??-10);
 if(hullElapsed>=0&&hullElapsed<.4){
  c.save();c.globalAlpha=(1-hullElapsed/.4)*.9;c.strokeStyle='#ffb089';c.lineWidth=2.3;
  c.beginPath();c.arc(op.x,op.y,44+hullElapsed*30,0,TAU);c.stroke();c.restore();
 }
}
