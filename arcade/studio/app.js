import {SCENARIOS,EFFECTS,CONCEPTS} from './concepts.js';

const $=id=>document.getElementById(id);
const make=(tag,klass,text)=>{const el=document.createElement(tag);if(klass)el.className=klass;if(text!==undefined)el.textContent=text;return el;};
let activeTab='scenario',activeScenario='dock',phaseIndex=0,activeEffect='hit',power=3,paused=false,animationStart=performance.now(),lastFrame=0;
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
const stars=Array.from({length:60},(_,i)=>({x:((i*167+43)%797)/800,y:((i*109+61)%353)/358,r:i%7===0?1.4:.8}));

function addSelector(container,items,current,onSelect){
 container.replaceChildren();
 for(const item of items){
  const btn=make('button');
  const name=make('strong',null,item.label);
  const desc=make('small',null,item.description||'');
  btn.type='button';btn.setAttribute('aria-pressed',String(item.key===current));btn.append(name,desc);
  btn.addEventListener('click',()=>onSelect(item.key));container.append(btn);
 }
}

function initScenario(){
 addSelector($('scenario-picker'),Object.values(SCENARIOS).map(s=>({key:s.id,label:s.base,description:s.title})),activeScenario,choice=>{activeScenario=choice;phaseIndex=0;initScenario();});
 const scenario=SCENARIOS[activeScenario],phase=scenario.phases[phaseIndex];
 $('scenario-status').textContent=scenario.state;
 $('scenario-name').textContent=scenario.title;
 $('scenario-time').textContent=scenario.time;
 $('phase-title').textContent=phase.title;
 $('phase-action').textContent=phase.action;
 $('phase-world').textContent=phase.world;
 $('phase-choice').textContent=phase.choice;
 $('scenario-reward').textContent=scenario.reward;
 $('scenario-step').textContent='Сцена '+(phaseIndex+1)+' из '+scenario.phases.length;
 $('scenario-next').disabled=phaseIndex===scenario.phases.length-1;
 $('scenario-next').textContent=phaseIndex===scenario.phases.length-1?'Все этапы просмотрены':'Следующее событие →';
 $('scenario-steps').replaceChildren();
 scenario.phases.forEach((p,index)=>{
  const item=make('li',index===phaseIndex?'current':index<phaseIndex?'done':'');
  const button=make('button',null,p.title);
  button.type='button';button.style.cssText='background:none;border:0;text-align:left;width:100%;padding:0;font-size:inherit;font-weight:600;color:inherit';
  button.setAttribute('aria-current',index===phaseIndex?'step':'false');
  button.prepend(make('b',null,'0'+(index+1)));
  button.addEventListener('click',()=>{phaseIndex=index;initScenario();});
  item.append(button);$('scenario-steps').append(item);
 });
 drawScenario();
}
$('scenario-next').addEventListener('click',()=>{if(phaseIndex<SCENARIOS[activeScenario].phases.length-1){phaseIndex++;initScenario();}});
$('scenario-reset').addEventListener('click',()=>{phaseIndex=0;initScenario();});

function space(ctx,w,h){
 const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#081827');g.addColorStop(1,'#0d263d');
 ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 for(const star of stars){ctx.globalAlpha=.35+(star.r/3);ctx.fillStyle='#c7e6ff';ctx.fillRect(star.x*w,star.y*h,star.r,star.r);}
 ctx.globalAlpha=1;
 ctx.strokeStyle='#25465d';ctx.lineWidth=1;
 for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(i*w/8,0);ctx.lineTo(i*w/8,h);ctx.stroke();}
 for(let i=1;i<5;i++){ctx.beginPath();ctx.moveTo(0,i*h/5);ctx.lineTo(w,i*h/5);ctx.stroke();}
}
function circle(ctx,x,y,r,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();}
function polygon(ctx,x,y,r,n,color,rotation=0){ctx.beginPath();for(let i=0;i<n;i++){const a=rotation+i*Math.PI*2/n,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();}
function label(ctx,value,x,y,color='#c7e6f4',size=12){ctx.fillStyle=color;ctx.font='600 '+size+'px system-ui, sans-serif';ctx.fillText(value,x,y);}
function drawShip(ctx,x,y,size,angle=0,color='#9ceeff'){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);
 ctx.beginPath();ctx.moveTo(size,0);ctx.lineTo(-size*.75,-size*.7);ctx.lineTo(-size*.3,0);ctx.lineTo(-size*.75,size*.7);ctx.closePath();ctx.fillStyle='#183b53';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=color;ctx.stroke();
 ctx.restore();
}
function drawScenario(){
 const cv=$('scenario-canvas'),ctx=cv.getContext('2d'),w=cv.width,h=cv.height;
 const scenario=SCENARIOS[activeScenario],phase=scenario.phases[phaseIndex];
 space(ctx,w,h);
 const bx=w*.14,by=h*.52,tx=w*.78,ty=h*.43,sx=w*phase.x,sy=h*phase.y;
 // Actual screen topology is intentionally schematic.
 ctx.setLineDash([8,10]);ctx.strokeStyle='#538a9a';ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(tx,ty);ctx.stroke();ctx.setLineDash([]);
 circle(ctx,bx,by,29,'#6bb8dd',2);circle(ctx,bx,by,18,'#80c6ea',2);polygon(ctx,bx,by,14,4,'#a4e5f2',Math.PI/4);
 label(ctx,scenario.base,bx-40,by+48);
 let targetLabel='ЦЕЛЬ',targetColor='#f6cc85';
 if(activeScenario==='lab'){targetLabel='ЗОНД';targetColor='#7edfc9';}
 if(activeScenario==='arsenal'){targetLabel='РЕТРАНСЛЯТОР';targetColor='#a5daeb';}
 if(activeScenario==='carrier'){targetLabel='ТРАНСПОРТ';targetColor='#ffe09c';}
 if(activeScenario==='carrier'){
  ctx.save();ctx.translate(tx,ty);ctx.rotate(-.28);ctx.fillStyle='#3f4c5f';ctx.fillRect(-29,-11,58,22);ctx.strokeStyle=targetColor;ctx.strokeRect(-29,-11,58,22);ctx.restore();
 }else{polygon(ctx,tx,ty,24,activeScenario==='arsenal'?6:4,targetColor,Math.PI/4);}
 label(ctx,targetLabel,tx-43,ty+49,targetColor,11);
 if(activeScenario==='dock'&&(phase.id==='jammer'||phase.id==='response')){
  circle(ctx,tx,ty,83,'#ad9cfc',3);label(ctx,'ЭМ-ЗАРЯД',tx-38,ty-94,'#c6b8ff',11);
 }
 if(activeScenario==='lab'&&(phase.id==='repair'||phase.id==='scout'||phase.id==='second')){
  ctx.strokeStyle='#75e1ca';ctx.lineWidth=5;ctx.beginPath();ctx.arc(tx,ty,35,-Math.PI/2,Math.PI*.55);ctx.stroke();
  label(ctx,'ВОССТАНОВЛЕНИЕ',tx-74,ty-55,'#8deacb',10);
 }
 if(activeScenario==='arsenal'&&(phase.id!=='brief'&&phase.id!=='result')){
  ctx.fillStyle='#214257';ctx.fillRect(tx-45,ty-53,90,6);ctx.fillStyle='#73ddb9';ctx.fillRect(tx-45,ty-53,(phase.id==='pause'?70:phase.id==='final'?55:82),6);
 }
 if(phase.id==='result'){circle(ctx,tx,ty,40,'#82e6b8',3);label(ctx,'ОПЕРАЦИЯ ЗАВЕРШЕНА',w*.4,h*.15,'#99f2cc',16);}
 const ang=Math.atan2(ty-sy,tx-sx);
 drawShip(ctx,sx,sy,19,ang);
 circle(ctx,sx,sy,28,'#6fa6c383',1);
 label(ctx,'ВЫ',sx-13,sy-34,'#9ceeff',12);
 for(let i=0;i<phase.enemy;i++){
  const a=(i*Math.PI*2/Math.max(phase.enemy,1))+.6;
  const ex=Math.min(w-32,tx+Math.cos(a)*Math.min(125,w*.14));
  const ey=Math.max(27,Math.min(h-27,ty+Math.sin(a)*78));
  polygon(ctx,ex,ey,11,3,'#f48b87',Math.PI/2);
  if(i===0)label(ctx,'ПАТРУЛЬ',ex-24,ey-19,'#f7b0a3',10);
 }
 label(ctx,'КОНЦЕПТ · КООРДИНАТЫ УСЛОВНЫ',18,25,'#8aafc4',10);
}

function initEffects(){
 addSelector($('effect-picker'),Object.values(EFFECTS).map(e=>({key:e.id,label:e.name,description:''})),activeEffect,choice=>{activeEffect=choice;initEffects();restartEffect();});
 const e=EFFECTS[activeEffect];
 $('effect-name').textContent=e.name;$('effect-intent').textContent=e.intent;
 $('effect-trigger').textContent=e.trigger;$('effect-sound').textContent=e.sound;
 $('effect-rules').textContent=e.rules;$('effect-test').textContent=e.test;
 drawEffect($('effect-canvas'),.45);
 drawEffect($('effect-small'),.45);
}
function restartEffect(){animationStart=performance.now();if(paused){paused=false;$('effect-pause').textContent='Пауза';}}
$('effect-replay').addEventListener('click',restartEffect);
$('effect-pause').addEventListener('click',()=>{paused=!paused;$('effect-pause').textContent=paused?'Продолжить':'Пауза';if(!paused)restartEffect();});
$('effect-power').addEventListener('input',e=>{power=Number(e.target.value);$('power-label').textContent=power+' / 5';restartEffect();});

function renderParticle(ctx,x,y,r,color,alpha=1){ctx.globalAlpha=Math.max(0,Math.min(1,alpha));ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
function drawEffect(cv,progress){
 const ctx=cv.getContext('2d'),w=cv.width,h=cv.height;
 const scale=Math.min(w/800,h/358),x=v=>v*scale,y=v=>v*scale;
 const small=w<400;
 ctx.save();ctx.scale(scale,scale);space(ctx,800,358);
 const ship={x:310,y:183},rock={x:553,y:183},station={x:545,y:177},p=Math.max(.04,Math.min(1,progress));
 const color=EFFECTS[activeEffect].color;
 if(activeEffect==='beacon'){
  polygon(ctx,station.x,station.y,45,6,'#8ac7dc',Math.PI/6);
  circle(ctx,station.x,station.y,58+14*p,color,2+power*.3);
  circle(ctx,station.x,station.y,74+9*p,'#ffd77966',1);
  label(ctx,'НАГРАДА ГОТОВА',station.x-80,station.y+111,'#ffe5a2',small?10:13);
  drawShip(ctx,ship.x,ship.y,17,0);
 }else{
  drawShip(ctx,ship.x,ship.y,18,0);
  if(activeEffect==='mining'){
   polygon(ctx,rock.x,rock.y,64,9,'#8292a2',.2);
   ctx.save();ctx.setLineDash([9,7]);ctx.strokeStyle=color;ctx.lineWidth=3+power*.4;
   ctx.beginPath();ctx.moveTo(ship.x+21,ship.y);ctx.lineTo(rock.x-64,rock.y);ctx.stroke();ctx.restore();
   for(let i=0;i<power*3;i++){const a=i*2.4,push=12+80*p*(.45+i%4*.15);renderParticle(ctx,rock.x-64+Math.cos(a)*push*.75,rock.y+Math.sin(a)*push*.68,1.8+i%3,'#b8a790',1-p*.65);}
   label(ctx,'ЭКСТРАКТОР',420,128,'#a0e8ff',small?11:14);
  }
  if(activeEffect==='hit'){
   polygon(ctx,rock.x,rock.y,55,6,'#8998ad',.1);
   ctx.strokeStyle='#6ab2ef';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(ship.x+20,ship.y);ctx.lineTo(rock.x-56,rock.y);ctx.stroke();
   renderParticle(ctx,rock.x-55,rock.y,8+power*2,color,1-p*.7);
   for(let i=0;i<power*4;i++){const a=Math.PI+(i/(power*4)-.5)*2.3;renderParticle(ctx,rock.x-55+Math.cos(a)*p*75,rock.y+Math.sin(a)*p*65,1.5+i%3,i%2?'#ffcc76':'#cbd7e0',1-p);}
   label(ctx,'ТОЧКА КОНТАКТА',450,105,'#ffd9ae',small?11:14);
  }
  if(activeEffect==='emp'){
   polygon(ctx,rock.x,rock.y,41,6,'#9182c5',.1);
   circle(ctx,rock.x,rock.y,38+100*p,color,2+power*.6);
   circle(ctx,rock.x,rock.y,27+65*p,'#a49aff88',1.5);
   label(ctx,'ЗАРЯД → РАЗРЯД',414,104,'#d6c7ff',small?11:14);
  }
  if(activeEffect==='noise'){
   polygon(ctx,rock.x,rock.y,47,9,'#738a9c',.2);
   for(let i=0;i<3;i++)circle(ctx,rock.x,rock.y,52+i*32*p,'#efcf8a'+(i===2?'44':'99'),1.5);
   polygon(ctx,665,89,14,3,'#f6aa74',Math.PI/2);
   if(p>.35){circle(ctx,665,89,24,'#f2c46f',2);label(ctx,'ПРОВЕРЯЕТ СИГНАЛ',495,55,'#ffdda2',small?11:14);}
   label(ctx,'ИСТОЧНИК ШУМА',465,267,'#ffdca2',small?11:14);
  }
 }
 ctx.restore();
 if(small){ctx.strokeStyle='#375c71';ctx.strokeRect(.5,.5,w-1,h-1);}
}
function animate(now){
 if(!document.hidden&&activeTab==='effects'){
  if(reduceMotion.matches){drawEffect($('effect-canvas'),.5);drawEffect($('effect-small'),.5);}
  else if(!paused&&now-lastFrame>33){const p=((now-animationStart)%2200)/2200;drawEffect($('effect-canvas'),p);drawEffect($('effect-small'),p);lastFrame=now;}
 }
 requestAnimationFrame(animate);
}

function initConcepts(){
 const root=$('concept-grid');root.replaceChildren();
 for(const c of CONCEPTS){
  const card=make('article','concept');card.append(make('span','tag',c.status),make('h3',null,c.name));
  for(const [key,labelText] of [['goal','Цель'],['criterion','Наблюдаемый критерий'],['next','Следующий шаг']]){
   const p=make('p');p.append(make('b',null,labelText+': '),document.createTextNode(c[key]));card.append(p);
  }
  root.append(card);
 }
}
const noteKey='survivor-concept-studio-notes-v1';
try{$('concept-notes').value=localStorage.getItem(noteKey)||'';}catch{}
$('concept-notes').addEventListener('input',e=>{try{localStorage.setItem(noteKey,e.target.value);}catch{}$('notes-status').textContent='Сохранено в этом браузере';});
$('clear-notes').addEventListener('click',()=>{$('concept-notes').value='';try{localStorage.removeItem(noteKey);}catch{}$('notes-status').textContent='Заметки очищены';});
$('copy-notes').addEventListener('click',async()=>{
 const data={title:'Мастерская концепций «Выжившего»',type:'design-prototype',scenarios:SCENARIOS,effects:EFFECTS,concepts:CONCEPTS,notes:$('concept-notes').value};
 try{await navigator.clipboard.writeText(JSON.stringify(data,null,2));$('notes-status').textContent='Концепции и заметки скопированы';}
 catch{$('notes-status').textContent='Буфер недоступен: скопируйте заметки из поля вручную';}
});
document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{
 activeTab=btn.dataset.tab;
 document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
 for(const panel of ['scenario','effects','concepts','tools'])$('panel-'+panel).hidden=panel!==activeTab;
 if(activeTab==='effects')restartEffect();
}));
initScenario();initEffects();initConcepts();requestAnimationFrame(animate);
