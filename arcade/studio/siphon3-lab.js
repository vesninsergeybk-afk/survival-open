import {STATIONS,SOURCE,DEFAULTS,createWorld,updateWorld,triggerThreat,phaseLabel} from './siphon3-sim.mjs';

const $=id=>document.getElementById(id);
const canvas=$('scene');
const ctx=canvas.getContext('2d',{alpha:false});
const W=canvas.width,H=canvas.height;
const position=point=>({x:point.x*W,y:point.y*H});
const SP=128,COLS=10;
const SHEETS={idle:{file:'idle_sheet_128.webp',frames:32},deploy:{file:'activate_sheet_128.webp',frames:12},harvest:{file:'mining_sheet_128.webp',frames:80},unload:{file:'deactivate_sheet_128.webp',frames:12}};
const IMAGES={};
const stars=Array.from({length:170},(_,i)=>({x:((i*7919+97)%99991)/99991*W,y:((i*4271+31)%99971)/99971*H,r:i%13===0?1.65:.62,twinkle:i*.47}));
let world=createWorld(3),selected=1,paused=false,last=performance.now(),fps=0,frames=0,fpsStart=last;
const settings={...DEFAULTS,count:3,capacity:40};
let spriteOk=false;

function loadSheets(){
 const loads=Object.entries(SHEETS).map(([name,entry])=>new Promise(resolve=>{
  const image=new Image();IMAGES[name]=image;
  image.onload=()=>resolve(true);image.onerror=()=>resolve(false);
  image.src='./assets/siphon3/'+entry.file;
 }));
 Promise.all(loads).then(results=>{
  spriteOk=results.every(Boolean);
  if(!spriteOk)$('event').textContent='Не все атласы загрузились. Проверьте ресурсы стенда.';
  draw();
 });
}

function drawBackground(time){
 const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#050b17');bg.addColorStop(.58,'#0b1b2e');bg.addColorStop(1,'#06111b');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 for(const s of stars){
  const a=.24+.42*(.5+.5*Math.sin(time*.6+s.twinkle));
  ctx.fillStyle=`rgba(190,221,255,${a})`;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
 }
 // Nebular glow stays behind the triangle, never attached to the HUD.
 const halo=ctx.createRadialGradient(W*.49,H*.49,40,W*.49,H*.49,W*.54);
 halo.addColorStop(0,'#172e4650');halo.addColorStop(.6,'#0c20352b');halo.addColorStop(1,'#07132300');
 ctx.fillStyle=halo;ctx.fillRect(0,0,W,H);
}

function drawNetwork(time){
 const p=STATIONS.map(position);
 ctx.save();ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);p.slice(1).forEach(x=>ctx.lineTo(x.x,x.y));ctx.closePath();
 ctx.fillStyle='rgba(35,161,183,.065)';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#57d1d47d';ctx.stroke();
 ctx.setLineDash([4,10]);ctx.lineDashOffset=-time*15;ctx.lineWidth=1;ctx.strokeStyle='#8cf8ee8f';ctx.stroke();ctx.setLineDash([]);
 // The thin lines are station links, not harvester flight paths.
 for(let k=0;k<3;k++){
  const a=p[k],b=p[(k+1)%3];
  for(let j=0;j<4;j++){
   const t=(time*.12+j/4+k/9)%1;
   const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
   ctx.fillStyle='rgba(125,238,224,.8)';ctx.beginPath();ctx.arc(x,y,1.7,0,Math.PI*2);ctx.fill();
  }
 }
 ctx.restore();
}

function drawStation(station,index,time){
 const {x,y}=position(station);
 ctx.save();ctx.translate(x,y);const beat=1+0.04*Math.sin(time*2+index*2);
 const grad=ctx.createRadialGradient(0,0,6,0,0,49);grad.addColorStop(0,'#7de3e354');grad.addColorStop(1,'#3eabc700');
 ctx.fillStyle=grad;ctx.beginPath();ctx.arc(0,0,50*beat,0,Math.PI*2);ctx.fill();
 ctx.rotate(Math.PI/4);ctx.fillStyle='#162c40';ctx.strokeStyle='#80c9d6';ctx.lineWidth=3;ctx.fillRect(-20,-20,40,40);ctx.strokeRect(-20,-20,40,40);
 ctx.fillStyle='#0a1d2c';ctx.fillRect(-10,-10,20,20);ctx.strokeStyle='#84f2e4';ctx.strokeRect(-10,-10,20,20);
 ctx.restore();
 ctx.save();ctx.textAlign='center';ctx.font='700 15px system-ui';ctx.fillStyle='#c6edf5';ctx.fillText(station.label,x,y+54);
 ctx.font='12px system-ui';ctx.fillStyle='#87bac9';ctx.fillText('Узел '+station.id,x,y+73);ctx.restore();
}

function drawVortex(time){
 const {x,y}=position(SOURCE);ctx.save();ctx.translate(x,y);
 const scale=1+0.05*Math.sin(time*2.5);ctx.scale(scale,scale);
 const halo=ctx.createRadialGradient(0,0,10,0,0,96);
 halo.addColorStop(0,'#ffbc7350');halo.addColorStop(.43,'#ff6c3c36');halo.addColorStop(1,'#db482000');
 ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,0,96,0,Math.PI*2);ctx.fill();
 for(let i=0;i<14;i++){
  const theta=i*Math.PI*2/14+time*.8;
  const len=48+11*Math.sin(time*1.7+i);
  const px=Math.cos(theta)*24,py=Math.sin(theta)*24;
  const ox=Math.cos(theta+.58)*len,oy=Math.sin(theta+.58)*len;
  ctx.beginPath();ctx.moveTo(px,py);
  ctx.quadraticCurveTo(Math.cos(theta+.2)*43,Math.sin(theta+.2)*43,ox,oy);
  ctx.lineWidth=i%3===0?5:2.5;ctx.strokeStyle=`rgba(255,${110+i%4*25},${44+i%3*9},${.37+.27*Math.sin(time*2+i)**2})`;ctx.stroke();
 }
 const core=ctx.createRadialGradient(0,0,3,0,0,39);
 core.addColorStop(0,'#010813');core.addColorStop(.48,'#080b17');core.addColorStop(.67,'#d6512e');core.addColorStop(.83,'#ffb45a');core.addColorStop(1,'#fd7b2d00');
 ctx.fillStyle=core;ctx.beginPath();ctx.arc(0,0,39,0,Math.PI*2);ctx.fill();
 for(let i=0;i<3;i++){
  const t=time*.55+i*Math.PI*2/3;ctx.strokeStyle=['#f4a552','#d95b3c','#f1cd82'][i];ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(0,0,25+i*4,t,t+1.85);ctx.stroke();
 }
 ctx.restore();
 ctx.font='700 14px system-ui';ctx.fillStyle='#ffd5ae';ctx.textAlign='center';
 ctx.fillText('Энергетическая воронка',x,y+92);
}

function animatedFrame(unit){
 let key='idle',frame=0;
 if(unit.phase==='deploy'){
  key='deploy';frame=Math.min(11,Math.floor(unit.phaseElapsed/.6*12));
 } else if(unit.phase==='harvest'){
  key='harvest';frame=Math.floor(unit.phaseElapsed*20)%80;
 } else if(unit.phase==='unload'){
  key='unload';frame=Math.min(11,Math.floor(unit.phaseElapsed/.8*12));
 } else {
  key='idle';frame=Math.floor(world.elapsed*20+unit.id*7)%32;
 }
 return {key,frame};
}

function drawHarvester(unit){
 const {x,y}=position(unit);const selectedNow=selected===unit.id;
 const size=Number($('size').value),height=size;
 ctx.save();ctx.translate(x,y);
 if(selectedNow){
  ctx.strokeStyle='#e8f1a1bb';ctx.setLineDash([5,5]);ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(0,0,size*.56,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
 }
 if(unit.cargo>0){
  const r=size*.39+3;ctx.strokeStyle=`rgba(84,250,231,${.22+.45*unit.cargo/settings.capacity})`;
  ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r,-Math.PI/2,-Math.PI/2+2*Math.PI*unit.cargo/settings.capacity);ctx.stroke();
 }
 ctx.rotate(unit.angle);
 const {key,frame}=animatedFrame(unit),image=IMAGES[key];
 if(image?.complete&&image.naturalWidth){
  const sx=(frame%COLS)*SP,sy=Math.floor(frame/COLS)*SP;
  ctx.drawImage(image,sx,sy,SP,SP,-size/2,-height/2,size,height);
 } else {
  ctx.fillStyle='#713a78';ctx.beginPath();ctx.ellipse(0,0,size*.43,size*.28,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#4bdacb';ctx.beginPath();ctx.ellipse(-size*.15,0,size*.21,size*.19,0,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
 if(selectedNow){
  ctx.font='12px system-ui';ctx.fillStyle='#e7ffe2';ctx.textAlign='center';
  ctx.fillText('#'+unit.id+' · '+phaseLabel(unit.phase),x,y-size*.55-13);
 }
}

function draw(){
 const time=world.elapsed;drawBackground(time);drawNetwork(time);drawVortex(time);
 STATIONS.forEach((station,i)=>drawStation(station,i,time));
 world.units.forEach(drawHarvester);
 if(world.threatened){
  ctx.save();ctx.fillStyle='rgba(129,26,39,.11)';ctx.fillRect(0,0,W,H);
  ctx.font='800 23px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffc2a6';
  ctx.fillText('ТРЕВОГА · ДОБЫТЧИКИ ОТХОДЯТ К СТАНЦИЯМ',W/2,40);ctx.restore();
 }
}

function updateHud(){
 const fmt=n=>Math.floor(n).toLocaleString('ru-RU');
 $('delivered').textContent=fmt(world.delivered);
 $('harvested').textContent=fmt(world.harvested);
 $('trips').textContent=world.trips;
 $('inTransit').textContent=fmt(world.units.reduce((a,u)=>a+u.cargo,0));
 $('sourceFill').style.width=(100*world.reserve/world.reserveMax).toFixed(1)+'%';
 $('sourceText').textContent=fmt(world.reserve)+' / '+fmt(world.reserveMax);
 $('fps').textContent='FPS: '+(fps?fps.toFixed(0):'—');
 $('activeCount').textContent='Добывают: '+world.units.filter(u=>u.phase==='harvest').length+' / '+world.units.length;
 $('shipScale').textContent='Размер: '+$('size').value+' px';
 $('sceneState').textContent=world.threatened?'Условный налёт · '+Math.ceil(world.threatRemaining)+' с':'Добыча и доставка · '+Math.floor(world.elapsed)+' с';
 const unit=world.units.find(u=>u.id===selected);
 if(unit){
  $('selected').innerHTML='<b>Сифон-3 №'+unit.id+'</b> · '+phaseLabel(unit.phase)+'<br>'+
    STATIONS.find(s=>s.id===unit.stationId).label+'<br>'+
    'Груз: <span class="cargo">'+unit.cargo.toFixed(1)+' / '+settings.capacity+'</span><br>'+
    'Рейсов завершено: '+unit.trips+'<br>'+
    'Всего добыто: '+unit.energyTaken.toFixed(1);
 }
}

function reset(){world=createWorld(settings.count);selected=1;updateHud();draw();}
function syncControl(id,output,formatter,callback){
 const el=$(id);const run=()=>{const value=Number(el.value);$(output).textContent=formatter(value);callback(value);};
 el.addEventListener('input',run);run();
}

syncControl('count','countValue',String,n=>{settings.count=n;reset();});
syncControl('size','sizeValue',n=>n+' px',()=>{draw();});
syncControl('speed','speedValue',n=>(n/100).toFixed(1)+'×',n=>{settings.speed=DEFAULTS.speed*n/100;});
syncControl('capacity','capacityValue',String,n=>{settings.capacity=n;});
$('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'Продолжить':'Пауза';});
$('step').addEventListener('click',()=>{for(let i=0;i<20;i++)updateWorld(world,.05,settings);updateHud();draw();});
$('reset').addEventListener('click',reset);
$('threat').addEventListener('click',()=>{triggerThreat(world,8);$('event').textContent='Вражеская активность: добытчики прерывают работу и отходят с грузом.';updateHud();});
canvas.addEventListener('click',event=>{
 const bounds=canvas.getBoundingClientRect();
 const x=(event.clientX-bounds.left)*W/bounds.width;
 const y=(event.clientY-bounds.top)*H/bounds.height;
 let best=null,bestDistance=Infinity;
 for(const unit of world.units){const p=position(unit);const d=Math.hypot(x-p.x,y-p.y);
  if(d<bestDistance){best=unit;bestDistance=d;}}
 if(best&&bestDistance<Math.max(24,Number($('size').value)*.65)){selected=best.id;updateHud();draw();}
});

function frame(now){
 const dt=Math.min((now-last)/1000,.05);last=now;
 if(!paused)updateWorld(world,dt,settings);
 frames++;if(now-fpsStart>=700){fps=frames*1000/(now-fpsStart);fpsStart=now;frames=0;updateHud();}
 draw();requestAnimationFrame(frame);
}
if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){paused=true;$('pause').textContent='Продолжить';}
loadSheets();updateHud();requestAnimationFrame(frame);
