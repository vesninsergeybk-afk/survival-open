import {contourFields} from './territory-system.js?v=contours-1-world-feedback-1';
import {activeContourTransition,fieldWasOwned} from './contour-dynamics.js?v=contour-dynamics-1';

const visible=(p,cam,r=200)=>p.x>=cam.x-r&&p.x<=cam.x+cam.w+r&&
 p.y>=cam.y-r&&p.y<=cam.y+cam.h+r;

// Canvas world-space artwork; no large sprites, network loads or particle arrays.
export function drawContourWorld(game,c,cam){
 const now=game.time;
 if(now-(game.contourVisualAt||-Infinity)>.4||!game.contourVisualFields){
  game.contourVisualFields=contourFields(game.world);game.contourVisualAt=now;
 }
 const fields=game.contourVisualFields;
 const links=game.world.contours?.links||[];
 const transition=activeContourTransition(game);
 if(!fields.length&&!links.length&&!transition)return;
 const calm=!!game.visuals?.reducedMotion,lowFps=game.fps<34;
 const elapsed=transition?Math.max(0,now-transition.at):Infinity;
 c.save();
 // Links are real structures even before a field closes. Render them in the
 // physical world so the action on the atlas has an immediate visible result.
 for(const [from,to] of links){
  const a=game.world.stations.get(from),b=game.world.stations.get(to);
  if(!a||!b)continue;
  if(Math.max(a.x,b.x)<cam.x-140||Math.min(a.x,b.x)>cam.x+cam.w+140||
   Math.max(a.y,b.y)<cam.y-140||Math.min(a.y,b.y)>cam.y+cam.h+140)continue;
  const healthy=a.active&&b.active&&!a.enemy&&!b.enemy&&!a.suppressed&&!b.suppressed;
  c.save();c.lineCap='round';
  c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);
  c.strokeStyle=healthy?'rgba(33,211,196,.09)':'rgba(250,91,104,.11)';
  c.lineWidth=15;c.stroke();
  c.strokeStyle=healthy?'rgba(98,244,218,.56)':'rgba(255,115,129,.56)';
  c.lineWidth=2.8;c.setLineDash(healthy?[23,12]:[9,16]);
  if(!calm)c.lineDashOffset=-(now*35)%35;
  c.stroke();c.setLineDash([]);
  if(transition?.kind==='claim'&&elapsed<1.1&&transition.changedLinks.some(([x,y,ok])=>ok&&
   ((x===from&&y===to)||(x===to&&y===from)))){
   const progress=calm?1:Math.min(1,elapsed/1.1);
   c.beginPath();c.moveTo(a.x,a.y);c.lineTo(a.x+(b.x-a.x)*progress,a.y+(b.y-a.y)*progress);
   c.strokeStyle='rgba(255,229,171,.92)';c.lineWidth=5;c.shadowColor='#ffb866';c.shadowBlur=20;
   c.stroke();c.shadowBlur=0;
  }
  if(healthy&&!calm&&!lowFps){
   const t=((now*.1+(a.x+b.y)*.000013)%1+1)%1;
   const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
   if(visible({x,y},cam,25)){
    c.shadowColor='#7dffe5';c.shadowBlur=13;c.fillStyle='#dafff0';
    c.beginPath();c.arc(x,y,3.6,0,Math.PI*2);c.fill();
   }
  }
  c.restore();
 }
 for(const field of fields){
  if(!visible(field.center,cam,950))continue;
  c.save();
  const forming=transition?.kind==='claim'&&!fieldWasOwned(field.center,transition.previous);
  if(forming&&!calm&&elapsed<2.5){
   // The field first receives power along its links, then fills radially.
   const radius=Math.max(...field.polygon.map(p=>Math.hypot(p.x-field.center.x,p.y-field.center.y)));
   const fill=Math.min(1,Math.max(0,(elapsed-1)/1.5));
   c.beginPath();c.arc(field.center.x,field.center.y,radius*fill,0,Math.PI*2);c.clip();
  }
  c.beginPath();field.polygon.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();
  c.fillStyle='rgba(40,224,195,.035)';c.fill();
  c.strokeStyle='rgba(79,235,198,.22)';c.lineWidth=4;c.setLineDash([34,28]);c.stroke();c.setLineDash([]);
  c.restore();
  if(forming&&elapsed<2.5&&!calm)continue;
  c.save();
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
  const born=game.contourBirths?.find(item=>item.id===field.id);
  if(born){
   const age=now-born.at;
   if(age>=0&&age<8){
    const fade=1-age/8;
    c.save();c.translate(x,y);c.lineWidth=2.5;
    c.strokeStyle='rgba(255,191,92,'+(fade*.7).toFixed(3)+')';
    c.beginPath();c.arc(0,0,94+(calm?0:age*45),0,Math.PI*2);c.stroke();
    if(age<4){
     c.font='bold 13px system-ui';c.textAlign='center';c.fillStyle='rgba(255,229,165,'+
      (1-age/4).toFixed(3)+')';c.fillText('НОВЫЙ КОНТУР',0,-116);
    }
    c.restore();
   }
  }
 }
 if(transition?.kind==='loss'&&elapsed<2.4){
  c.save();c.globalAlpha=(1-elapsed/2.4)*.52;
  for(const old of transition.previous){
   if(!visible(old.center,cam,950))continue;
   c.save();c.beginPath();old.polygon.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();
   for(const live of fields){
    live.polygon.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();
   }
   c.clip('evenodd');c.fillStyle='rgba(255,88,111,.18)';c.fillRect(cam.x,cam.y,cam.w,cam.h);
   c.strokeStyle='#ff909b';c.lineWidth=3;c.setLineDash([10,12]);
   c.beginPath();old.polygon.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.stroke();c.restore();
  }
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
  c.shadowBlur=10;c.shadowColor=h.phase==='back'?'#ffb553':'#93eede';
  c.fillStyle=h.phase==='back'?'#ffca74':'#bfffee';
  c.beginPath();c.ellipse(0,0,3.2,6.5,0,0,Math.PI*2);c.fill();
  c.fillStyle=h.phase==='back'?'rgba(255,179,90,.85)':'rgba(144,245,231,.83)';
  const flap=3+(calm?0:Math.sin(now*16+h.progress*6)*2);
  c.beginPath();c.ellipse(-5,-1,flap,5,-.45,0,Math.PI*2);
  c.ellipse(5,-1,flap,5,.45,0,Math.PI*2);c.fill();c.restore();
 }
 c.restore();
}
