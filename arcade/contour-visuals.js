import {contourFields} from './territory-system.js?v=contours-1';

const visible=(p,cam,r=200)=>p.x>=cam.x-r&&p.x<=cam.x+cam.w+r&&
 p.y>=cam.y-r&&p.y<=cam.y+cam.h+r;

// Canvas world-space artwork; no large sprites, network loads or particle arrays.
export function drawContourWorld(game,c,cam){
 const now=game.time;
 if(now-(game.contourVisualAt||-Infinity)>.4||!game.contourVisualFields){
  game.contourVisualFields=contourFields(game.world);game.contourVisualAt=now;
 }
 const fields=game.contourVisualFields;
 if(!fields.length)return;
 c.save();
 for(const field of fields){
  if(!visible(field.center,cam,950))continue;
  c.save();
  c.beginPath();field.polygon.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();
  c.fillStyle='rgba(40,224,195,.035)';c.fill();
  c.strokeStyle='rgba(79,235,198,.22)';c.lineWidth=4;c.setLineDash([34,28]);c.stroke();c.setLineDash([]);
  const {x,y}=field.center,phase=now*.72+field.area*.000001;
  const pulse=1+.085*Math.sin(now*1.55+field.area*.00001),r=64*pulse;
  c.translate(x,y);c.globalCompositeOperation='lighter';
  const glow=c.createRadialGradient(0,0,2,0,0,r*1.8);
  glow.addColorStop(0,'rgba(3,4,13,.75)');glow.addColorStop(.23,'rgba(255,118,25,.44)');
  glow.addColorStop(.48,'rgba(245,87,9,.23)');glow.addColorStop(1,'rgba(245,80,5,0)');
  c.fillStyle=glow;c.beginPath();c.arc(0,0,r*1.8,0,Math.PI*2);c.fill();
  for(let arm=0;arm<7;arm++){
   c.beginPath();
   for(let step=0;step<=14;step++){
    const t=step/14,rad=13+t*r*(.86+.14*Math.sin(arm*7+phase));
    const angle=phase+arm*Math.PI*2/7+t*2.3;
    const px=Math.cos(angle)*rad,py=Math.sin(angle)*rad*.77;
    if(step)c.lineTo(px,py);else c.moveTo(px,py);
   }
   c.strokeStyle=arm%2?'rgba(255,113,24,.67)':'rgba(255,196,84,.85)';
   c.lineWidth=2.7+1.3*Math.sin(phase*2+arm);c.stroke();
  }
  c.strokeStyle='rgba(255,160,50,.68)';c.lineWidth=2.5;
  c.beginPath();c.ellipse(0,0,r*.8,r*.57,-phase*.22,.2,Math.PI*1.66);c.stroke();
  for(let k=0;k<11;k++){
   const angle=k*Math.PI*2/11+phase*.48;
   const radius=r*(.74+.15*Math.sin(k*11.7+phase*2));
   const leap=7+13*Math.pow(Math.max(0,Math.sin(phase*2.2+k*3.3)),3);
   c.strokeStyle='rgba(255,'+(116+k%3*28)+',44,.55)';c.lineWidth=1.2;
   c.beginPath();c.moveTo(Math.cos(angle)*radius,Math.sin(angle)*radius*.75);
   c.quadraticCurveTo(Math.cos(angle+.25)*(radius+leap),Math.sin(angle+.25)*(radius+leap),
    Math.cos(angle+.4)*(radius+leap*1.5),Math.sin(angle+.4)*(radius+leap*1.5)*.8);c.stroke();
  }
  c.globalCompositeOperation='source-over';
  c.fillStyle='#090b18';c.beginPath();c.ellipse(0,0,13,9,phase*.12,0,Math.PI*2);c.fill();
  c.strokeStyle='#ffe4a5';c.lineWidth=2;c.stroke();
  c.restore();
 }
 const byId=new Map(fields.map(f=>[f.id,f]));
 for(const h of game.world.contours.harvesters){
  const field=byId.get(h.fieldId);if(!field)continue;
  const t=h.phase==='out'?Math.min(1,h.progress):h.phase==='back'?1-Math.min(1,h.progress):1;
  const x=field.anchor.x+(field.center.x-field.anchor.x)*t;
  const y=field.anchor.y+(field.center.y-field.anchor.y)*t;
  if(!visible({x,y},cam,30))continue;
  c.save();c.translate(x,y);c.rotate(Math.atan2(field.center.y-field.anchor.y,field.center.x-field.anchor.x)+Math.PI/2);
  c.shadowBlur=10;c.shadowColor='#fdbd6a';c.fillStyle='#ffd78a';
  c.beginPath();c.ellipse(0,0,3.2,6.5,0,0,Math.PI*2);c.fill();
  c.fillStyle='rgba(144,245,231,.83)';
  const flap=3+Math.sin(now*16+h.progress*6)*2;
  c.beginPath();c.ellipse(-5,-1,flap,5,-.45,0,Math.PI*2);
  c.ellipse(5,-1,flap,5,.45,0,Math.PI*2);c.fill();c.restore();
 }
 c.restore();
}
