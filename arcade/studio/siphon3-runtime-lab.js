import {
  CONTOURS,LAB_NODES,createLabWorld,harvesterPosition,forceLaunch,
  startIntercept,stepLab,
} from './siphon3-runtime-core.js';
import {drawSiphon3,siphon3RigReady} from '../siphon3-art.js?v=siphon3-rig-3';

const byId=id=>document.getElementById(id);
const canvas=byId('scene');
const ctx=canvas.getContext('2d',{alpha:false});
const W=canvas.width,H=canvas.height;
const atlas=new Image();
const ATLAS_SIZE=128,ATLAS_COLUMNS=10;
const stars=Array.from({length:125},(_,i)=>({
  x:((i*1873+113)%10007)/10007*W,
  y:((i*761+173)%9901)/9901*H,
  r:(i%11===0?1.9:i%4===0?1.15:.58),
  phase:i*.83,
}));
let lab=createLabWorld();
let running=true,lastFrame=0,assetReady=false;
let speed=2,workerSize=window.matchMedia('(max-width:560px)').matches?110:96,backdrop='dark',labels=true;
let lastLaunchClock=-1;
byId('sprite-size').value=String(workerSize);

function project(p){return {x:W/2+p.x*.266,y:H/2+p.y*.266};}
function logEvent(text){
  const list=byId('event-log');
  if(list.firstElementChild?.dataset.placeholder)list.innerHTML='';
  const li=document.createElement('li');li.textContent=text;
  list.prepend(li);
  while(list.children.length>7)list.lastElementChild.remove();
}
function formatTime(t){const m=Math.floor(t/60),s=Math.floor(t%60);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
function formatValue(n){return n.toLocaleString('ru-RU',{maximumFractionDigits:1,minimumFractionDigits:1});}

function roundedRect(x,y,w,h,r,fill){
  ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
}
function label(text,x,y,color='#deedf4'){
  ctx.save();ctx.font='bold 13px system-ui,sans-serif';
  const width=ctx.measureText(text).width+19;
  roundedRect(x-width/2,y-15,width,24,6,'#071b2bec');
  ctx.fillStyle=color;ctx.textAlign='center';ctx.fillText(text,x,y+2);ctx.restore();
}

function background(){
  const bright=backdrop==='bright',tactical=backdrop==='tactical';
  ctx.fillStyle=bright?'#241b36':tactical?'#102334':'#061420';ctx.fillRect(0,0,W,H);
  if(!tactical){
    const glow=ctx.createRadialGradient(bright?690:640,bright?310:245,15,570,305,560);
    glow.addColorStop(0,bright?'#985c857c':'#28607f5b');
    glow.addColorStop(.5,bright?'#60416d58':'#173b5951');
    glow.addColorStop(1,'#00000000');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
    for(const s of stars){
      const lum=.4+.35*(1+Math.sin(lab.clock*.55+s.phase))/2;
      ctx.globalAlpha=lum;ctx.fillStyle='#d1ecff';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
  }else{
    ctx.strokeStyle='#42617a29';ctx.lineWidth=1;
    for(let x=0;x<W;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  }
  const vignette=ctx.createRadialGradient(W/2,H/2,95,W/2,H/2,650);
  vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#020914b0');
  ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
}

function fieldBackground(){
  const field=lab.fields[0],vertices=field.polygon.map(project);
  const t=lab.clock;
  ctx.save();ctx.beginPath();vertices.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
  ctx.fillStyle=backdrop==='bright'?'#e89b4b19':'#55cbbf0e';ctx.fill();
  ctx.clip();
  const c=project(field.center);
  const radial=ctx.createRadialGradient(c.x,c.y,25,c.x,c.y,320);
  radial.addColorStop(0,'#ffb54f25');radial.addColorStop(1,'#47bfb200');
  ctx.fillStyle=radial;ctx.fillRect(0,0,W,H);
  // Energy drifting inward is clipped to the claimed polygon.
  for(let i=0;i<24;i++){
    const a=i*2.399+t*.24,rad=28+((i*37+t*18)%210);
    const x=c.x+Math.cos(a)*rad,y=c.y+Math.sin(a)*rad;
    ctx.fillStyle=`rgba(251,175,86,${.13+.12*(1-rad/240)})`;
    ctx.beginPath();ctx.arc(x,y,1.5+(i%3),0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth=3;ctx.strokeStyle='#61d2c767';
  ctx.setLineDash([13,7]);ctx.lineDashOffset=-t*22;
  ctx.beginPath();vertices.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth=1;ctx.strokeStyle='#90fff46a';ctx.beginPath();
  vertices.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();
}

function vortex(){
  const c=project(lab.fields[0].center),t=lab.clock;
  ctx.save();ctx.translate(c.x,c.y);
  let glow=ctx.createRadialGradient(0,0,3,0,0,100);
  glow.addColorStop(0,'#09090d');glow.addColorStop(.18,'#3d1014');glow.addColorStop(.42,'#fc7a2170');glow.addColorStop(.75,'#c34b251a');glow.addColorStop(1,'#00000000');
  ctx.fillStyle=glow;ctx.fillRect(-110,-110,220,220);
  for(let k=0;k<3;k++){
    ctx.beginPath();ctx.rotate((k===0?1:-.25)*.001);
    for(let i=0;i<=100;i++){
      const a=i/100*2.3*Math.PI+t*.85+k*2*Math.PI/3;
      const r=9+57*i/100+4*Math.sin(a*3+t);
      const x=r*Math.cos(a),y=r*.72*Math.sin(a);
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.strokeStyle=['#ffb653','#f36f30','#ffe2aa'][k];ctx.globalAlpha=.65;
    ctx.lineWidth=6-k;ctx.shadowBlur=12;ctx.shadowColor='#fa6f24';ctx.stroke();
  }
  ctx.globalAlpha=1;ctx.shadowBlur=0;
  ctx.fillStyle='#100909';ctx.beginPath();ctx.ellipse(0,0,13,10,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#f8b04e';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,20,15,0,0,Math.PI*2);ctx.stroke();
  ctx.restore();
  label('ЭНЕРГЕТИЧЕСКАЯ ВОРОНКА',c.x,c.y-91,'#ffd994');
}

function stations(){
  const field=lab.fields[0];
  for(const s of LAB_NODES){
    const p=project(s),isAnchor=s.id===field.anchor.id;
    ctx.save();ctx.translate(p.x,p.y);
    const radius=isAnchor?26:19;
    ctx.fillStyle=isAnchor?'#31585b':'#1a4553';ctx.strokeStyle=isAnchor?'#fdd589':'#72ddde';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(0,0,radius+6,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.rotate(Math.PI/4);ctx.fillStyle='#163142';ctx.fillRect(-radius/1.5,-radius/1.5,radius*1.4,radius*1.4);
    ctx.strokeStyle='#baf8f0';ctx.lineWidth=2;ctx.strokeRect(-radius/1.5,-radius/1.5,radius*1.4,radius*1.4);ctx.restore();
    label(s.label,p.x,p.y+52,isAnchor?'#ffe1a1':'#c2eced');
    if(isAnchor){
      ctx.beginPath();ctx.arc(p.x,p.y,40+3*Math.sin(lab.clock*2),0,Math.PI*2);
      ctx.strokeStyle='#f7c37356';ctx.lineWidth=1.5;ctx.stroke();
    }
  }
}

function route(){
  const field=lab.fields[0],start=project(field.anchor),end=project(field.center);
  ctx.save();ctx.lineWidth=1.5;ctx.strokeStyle='#ffdf906c';ctx.setLineDash([6,9]);
  ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.setLineDash([]);
  ctx.restore();
}

function drawWorker(worker,index){
  const field=lab.fields[0],p=harvesterPosition(field,worker),base=project(p);
  const routeDx=field.center.x-field.anchor.x,routeDy=field.center.y-field.anchor.y;
  const distance=Math.hypot(routeDx,routeDy),side=index%2?9:-9;
  const x=base.x-routeDy/distance*side,y=base.y+routeDx/distance*side;
  const ret=worker.phase==='back';
  const angle=Math.atan2(routeDy,routeDx)+(ret?Math.PI:0);
  const gathering=worker.phase==='gather';
  const pulse=.8+.12*Math.sin(lab.clock*8+index);
  if(gathering){
    ctx.strokeStyle='#6df1e2a6';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(x,y,workerSize*.50+10*Math.sin(lab.clock*4),0,Math.PI*2);ctx.stroke();
  }
  if(ret){
    ctx.fillStyle='#ffcc7b9a';ctx.shadowColor='#ff9e44';ctx.shadowBlur=10;
    ctx.beginPath();ctx.arc(x+18,y-18,5+Math.sin(lab.clock*8)*1.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  }
  const size=workerSize*(gathering?pulse:1);
  const rendered=drawSiphon3(ctx,{x,y:y+2*Math.sin(lab.clock*3+index),
    angle,phase:worker.phase,progress:worker.progress,time:lab.clock,
    seed:index,size,reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    sheet:assetReady?atlas:null});
  if(!rendered){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    ctx.strokeStyle='#ec8595';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(0,0,workerSize*.32,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }

  // Damage shown only after actual proximity damage from the live module.
  if(worker.hp<1.99){
    const w=Math.max(33,workerSize*.8);
    roundedRect(x-w/2,y-workerSize*.43-16,w,5,2,'#6f3438');
    roundedRect(x-w/2,y-workerSize*.43-16,w*Math.max(0,worker.hp/2),5,2,'#ff8b80');
  }
  if(labels){
    const phase=gathering?'ДОБЫВАЕТ':ret?'ВОЗВРАЩАЕТСЯ':'ЛЕТИТ К ВОРОНКЕ';
    label(phase,x,y-workerSize*.56-24,worker.hp<1.8?'#ffbab2':'#b4fcf3');
  }
}

function attacker(){
  if(!lab.attackPosition)return;
  const p=project(lab.attackPosition),t=lab.clock;
  ctx.save();ctx.translate(p.x,p.y);
  ctx.fillStyle='#d25165';ctx.strokeStyle='#ffa9b7';ctx.lineWidth=2;
  ctx.rotate(t*2);ctx.beginPath();for(let i=0;i<4;i++){
    const a=i*Math.PI/2,x=Math.cos(a)*13,y=Math.sin(a)*13;
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  }ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  ctx.beginPath();ctx.arc(p.x,p.y,28+3*Math.sin(t*10),0,Math.PI*2);
  ctx.strokeStyle='#ff7e8e7c';ctx.lineWidth=1.5;ctx.stroke();
  label('ПЕРЕХВАТ',p.x,p.y-41,'#ffc1c6');
}

function drawHud(){
  roundedRect(18,18,246,57,11,'#061724da');
  ctx.textAlign='left';ctx.font='bold 12px system-ui,sans-serif';ctx.fillStyle='#8ecbd3';
  ctx.fillText('КОНТУР ЗАМКНУТ · 3 СТАНЦИИ',32,39);
  ctx.fillStyle='#fbd78c';ctx.font='bold 17px system-ui,sans-serif';
  ctx.fillText('ПОТОК '+formatValue(lab.world.contours.flux)+' / '+CONTOURS.fluxCap,32,62);
  roundedRect(W-213,19,196,56,10,'#061724d6');
  ctx.fillStyle='#99bdd2';ctx.font='bold 12px system-ui,sans-serif';
  ctx.fillText('ДОБЫТЧИКОВ',W-199,40);
  ctx.font='bold 19px system-ui,sans-serif';ctx.fillStyle='#aef7e7';
  ctx.fillText(`${lab.world.contours.harvesters.length} / 2`,W-199,63);
}

function updateUi(){
  const state=lab.world.contours,workers=state.harvesters;
  byId('sim-status').textContent=running?'ИДЁТ':'ПАУЗА';
  byId('sim-clock').textContent=formatTime(lab.clock)+' игрового времени';
  byId('flux').innerHTML=formatValue(state.flux)+' <i>/ '+CONTOURS.fluxCap+'</i>';
  byId('delivered').textContent=formatValue(state.delivered);
  byId('workers').textContent=workers.length+' / 2';
  byId('lost').textContent=state.lost;
  byId('spawn').disabled=!running||workers.length>=2;
  byId('intercept').disabled=!running||workers.length===0||Boolean(lab.attackPosition);
  byId('pause').textContent=running?'Пауза':'Продолжить';
  const leader=workers[0];
  const states={out:['К источнику','Летит от станции по маршруту к центру поля.'],
    gather:['Сбор энергии','Принимает энергию из воронки. После этого вернётся на станцию.'],
    back:['Возвращение с грузом','Энергия поступит в сеть только после прибытия.']};
  const info=leader?states[leader.phase]:['Ожидаем рейса','Через 45 игровых секунд наступит очередной вылет; можно выпустить жука вручную.'];
  byId('phase').textContent=lab.attackPosition?'Перехват добытчика':info[0];
  byId('phase-detail').textContent=lab.attackPosition?'Сборщик получает урон по правилам игры. Сумеет ли доставить груз?':info[1];
  byId('scene-caption').textContent=lab.attackPosition?
    'Красный ромб — испытательный противник. Полоса над жуком показывает реальную потерю прочности.':
    workers.length?'Маршрут: станция → воронка → станция. Цветная частица у возвращающегося жука обозначает груз.':
    'Треугольник контролируется игроком. Выпустите сборщика и проследите его путь.';
  const actual=Math.round(workerSize*(canvas.getBoundingClientRect().width/W));
  byId('sprite-value').textContent=actual+' пикс. на экране';
  if(siphon3RigReady())byId('asset-status').textContent='Шарнирная модель Сифона‑3 загружена · три независимые клешни';
}

function frame(now){
  const elapsed=lastFrame?Math.min(.05,(now-lastFrame)/1000):.016;lastFrame=now;
  if(running){
    const before=lab.world.contours.harvesters.length;
    const events=stepLab(lab,elapsed*speed);
    const after=lab.world.contours.harvesters.length;
    if(after>before&&lab.clock-lastLaunchClock>.05){
      logEvent(`${formatTime(lab.clock)} · Новый Сифон вышел со станции.`);
      lastLaunchClock=lab.clock;
    }
    for(const e of events){
      if(e.kind==='delivered')logEvent(`${formatTime(lab.clock)} · Доставлено ${formatValue(e.amount)} энергии.`);
      if(e.kind==='lost')logEvent(`${formatTime(lab.clock)} · Добытчик уничтожен. Груз потерян.`);
    }
  }
  background();fieldBackground();route();vortex();stations();
  lab.world.contours.harvesters.forEach(drawWorker);
  attacker();drawHud();updateUi();
  requestAnimationFrame(frame);
}

function restart(){
  lab=createLabWorld();lastLaunchClock=-1;running=true;
  byId('event-log').innerHTML='';logEvent('Испытание начато. Контур из трёх станций активен.');
  updateUi();
}

byId('spawn').addEventListener('click',()=>{
  const before=lab.world.contours.harvesters.length;
  if(before>=2)return;
  forceLaunch(lab);
  if(lab.world.contours.harvesters.length>before){
    logEvent(`${formatTime(lab.clock)} · Принудительный запуск для испытания.`);
    lastLaunchClock=lab.clock;
  }
});
byId('intercept').addEventListener('click',()=>{
  if(startIntercept(lab))logEvent(`${formatTime(lab.clock)} · Перехватчик вышел на Сифона.`);
});
byId('pause').addEventListener('click',()=>{running=!running;lastFrame=0;updateUi();});
byId('restart').addEventListener('click',restart);
byId('scale').addEventListener('change',e=>{speed=Number(e.target.value);byId('scale-value').textContent='×'+speed;});
byId('sprite-size').addEventListener('input',e=>{workerSize=Number(e.target.value);updateUi();});
byId('backdrop').addEventListener('change',e=>{backdrop=e.target.value;});
byId('labels').addEventListener('change',e=>{labels=e.target.checked;});
window.addEventListener('resize',updateUi);

atlas.onload=()=>{assetReady=true;byId('asset-status').textContent='Атлас Сифона‑3 загружен · 80 кадров';};
atlas.onerror=()=>{byId('asset-status').textContent='Ошибка: атлас не загрузился';logEvent('Не удалось загрузить изображение. Это ошибка стенда, не игровой вид.');};
atlas.src='./assets/siphon3/siphon3-atlas.webp';
restart();requestAnimationFrame(frame);

