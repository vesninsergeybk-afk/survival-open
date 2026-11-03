import {SCENARIOS,EFFECTS,CONCEPTS} from './concepts.js?v=studio-design-2';
import {VISUAL_AUDIT,VISUAL_STATUS} from './visual-audit.js?v=visual-audit-1';
import {initExplosionLab} from './explosion-lab.js?v=explosions-1';
import {SCENARIO_BASELINES,TACTICAL_EXPERIMENTS,BASE_ROLES,PLAYTEST_CHECKS} from './design-brief.js?v=studio-design-2';

const $=id=>document.getElementById(id);
const make=(tag,klass,text)=>{const el=document.createElement(tag);if(klass)el.className=klass;if(text!==undefined)el.textContent=text;return el;};
let activeTab='scenario',activeScenario='dock',scenarioMode='current',phaseIndex=0,selectedExperiment=0,activeEffect='hit',power=3,paused=false,animationStart=performance.now(),lastFrame=0;
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

function scenarioPhases(){
 return scenarioMode==='current' ? SCENARIO_BASELINES[activeScenario].phases : SCENARIOS[activeScenario].phases;
}
function initScenario(){
 const scenario=SCENARIOS[activeScenario],baseline=SCENARIO_BASELINES[activeScenario];
 if(scenarioMode==='current'&&!baseline.phases.length)scenarioMode='proposal';
 const phases=scenarioPhases();
 phaseIndex=Math.min(phaseIndex,phases.length-1);
 const phase=phases[phaseIndex];
 addSelector($('scenario-picker'),Object.values(SCENARIOS).map(s=>({key:s.id,label:s.base,description:s.title})),activeScenario,choice=>{
  activeScenario=choice;phaseIndex=0;selectedExperiment=0;initScenario();
 });
 document.querySelectorAll('[data-scenario-mode]').forEach(btn=>{
  const isCurrent=btn.dataset.scenarioMode==='current';
  btn.disabled=isCurrent&&!baseline.phases.length;
  btn.setAttribute('aria-pressed',String(btn.dataset.scenarioMode===scenarioMode));
 });
 $('scenario-status').textContent=scenarioMode==='current'?baseline.status:'КОНЦЕПТ · ПРЕДЛАГАЕМАЯ ВЕРСИЯ';
 $('scenario-name').textContent=scenario.title;
 $('scenario-time').textContent=scenarioMode==='current'?baseline.time:scenario.time+' · гипотеза';
 $('phase-title').textContent=phase.title;
 $('phase-action').textContent=phase.action;
 $('phase-world').textContent=phase.world;
 $('phase-choice').textContent=phase.choice;
 $('scenario-reward').textContent=scenarioMode==='current'?baseline.reward:scenario.reward;
 $('scenario-gap').textContent=baseline.gap;
 $('scenario-source').textContent=scenarioMode==='current'?'Подтверждено кодом: '+baseline.source:'Предложение для испытания. Не включено автоматически в игру.';
 $('scenario-step').textContent='Сцена '+(phaseIndex+1)+' из '+phases.length;
 $('scenario-next').disabled=phaseIndex===phases.length-1;
 $('scenario-next').textContent=phaseIndex===phases.length-1?'Все этапы просмотрены':'Следующее событие →';
 $('scenario-steps').replaceChildren();
 phases.forEach((p,index)=>{
  const item=make('li',index===phaseIndex?'current':index<phaseIndex?'done':'');
  const button=make('button',null,p.title);
  button.type='button';button.style.cssText='background:none;border:0;text-align:left;width:100%;padding:0;font-size:inherit;font-weight:600;color:inherit';
  button.setAttribute('aria-current',index===phaseIndex?'step':'false');
  button.prepend(make('b',null,String(index+1).padStart(2,'0')));
  button.addEventListener('click',()=>{phaseIndex=index;selectedExperiment=0;initScenario();});
  item.append(button);$('scenario-steps').append(item);
 });
 const experiments=scenarioMode==='proposal'?TACTICAL_EXPERIMENTS[activeScenario]?.[phase.id]:null;
 const experiment=$('scenario-experiment');
 experiment.hidden=!experiments;
 if(experiments){
  const picker=$('experiment-picker');picker.replaceChildren();
  experiments.forEach((option,index)=>{
   const button=make('button',null,option.name);
   button.type='button';button.setAttribute('aria-pressed',String(index===selectedExperiment));
   button.addEventListener('click',()=>{selectedExperiment=index;initScenario();});
   picker.append(button);
  });
  const choice=experiments[Math.min(selectedExperiment,experiments.length-1)];
  $('experiment-result').textContent=choice.result;
  $('experiment-risk').textContent=choice.risk;
 }
 drawScenario();
}
document.querySelectorAll('[data-scenario-mode]').forEach(btn=>btn.addEventListener('click',()=>{
 if(btn.disabled)return;
 scenarioMode=btn.dataset.scenarioMode;phaseIndex=0;selectedExperiment=0;initScenario();
}));
$('scenario-next').addEventListener('click',()=>{
 if(phaseIndex<scenarioPhases().length-1){phaseIndex++;selectedExperiment=0;initScenario();}
});
$('scenario-reset').addEventListener('click',()=>{phaseIndex=0;selectedExperiment=0;initScenario();});

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
 const scenario=SCENARIOS[activeScenario],phase=scenarioPhases()[phaseIndex];
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

function initBrief(){
 const root=$('base-roles');root.replaceChildren();
 for(const b of BASE_ROLES){
  const card=make('article','concept');
  card.append(make('span','tag',b.name),make('h3',null,b.role));
  for(const [key,labelText] of [['active','Уже есть'],['potential','Предлагаем'],['return','Причина вернуться']]){
   const p=make('p');p.append(make('b',null,labelText+': '),document.createTextNode(b[key]));card.append(p);
  }
  root.append(card);
 }
 const checks=$('design-checks'),checkKey='survivor-studio-playtest-v1';
 let checked={};try{checked=JSON.parse(localStorage.getItem(checkKey)||'{}');}catch{}
 function count(){const n=PLAYTEST_CHECKS.filter(c=>checked[c.id]).length;$('checks-count').textContent=n+' из '+PLAYTEST_CHECKS.length+' отмечено после проверки';}
 for(const test of PLAYTEST_CHECKS){
  const label=make('label','check-row'),input=document.createElement('input');
  input.type='checkbox';input.checked=!!checked[test.id];input.setAttribute('aria-label',test.label);
  const body=make('span'),name=make('strong',null,test.label),detail=make('small',null,test.detail);
  body.append(name,detail);label.append(input,body);checks.append(label);
  input.addEventListener('change',()=>{
   checked[test.id]=input.checked;count();
   try{localStorage.setItem(checkKey,JSON.stringify(checked));}catch{}
  });
 }
 count();
 $('clear-checks').addEventListener('click',()=>{
  checked={};checks.querySelectorAll('input').forEach(input=>input.checked=false);count();
  try{localStorage.removeItem(checkKey);}catch{}
 });
}

function initVisualAudit(){
 const filters=$('audit-filters'),list=$('audit-list'),summary=$('audit-summary');
 const states=[['all','Все'],...Object.entries(VISUAL_STATUS).map(([key,value])=>[key,value.label])];
 let selected='all';
 const items=[...VISUAL_AUDIT].sort((a,b)=>a.priority-b.priority);
 const counts=Object.fromEntries(Object.keys(VISUAL_STATUS).map(key=>[key,items.filter(item=>item.status===key).length]));
 summary.textContent=items.length+' тем: '+Object.entries(VISUAL_STATUS).map(([key,value])=>value.label.toLowerCase()+' — '+counts[key]).join('; ')+'.';
 const buttons=new Map();
 function render(){
  for(const [key,button] of buttons)button.setAttribute('aria-pressed',String(key===selected));
  list.replaceChildren();
  for(const item of items){
   if(selected!=='all'&&item.status!==selected)continue;
   const details=make('details','audit-item audit-'+item.status);
   const head=make('summary'),titles=make('span','audit-item-title');
   titles.append(make('strong',null,item.title),make('small',null,['Проверить сначала','Следующая очередь','После основных задач'][item.priority]));
   const badge=make('span','audit-state',VISUAL_STATUS[item.status].label);
   head.append(titles,badge);
   const body=make('div','audit-item-body');
   for(const [field,labelText] of [['fact','В исходниках'],['limit','Что не доказано или не готово'],['next','Следующий шаг'],['criterion','Как принять результат']]){
    const paragraph=make('p');paragraph.append(make('b',null,labelText+': '),document.createTextNode(item[field]));body.append(paragraph);
   }
   const source=make('a','audit-source','Исходный файл в GitHub');
   source.href='https://github.com/vesninsergeybk-afk/survival-open/blob/main/'+item.source;
   source.target='_blank';source.rel='noopener noreferrer';
   body.append(source);details.append(head,body);list.append(details);
  }
 }
 for(const [key,labelText] of states){
  const button=make('button','audit-filter',labelText+(key==='all'?' · '+items.length:' · '+counts[key]));
  button.type='button';button.setAttribute('aria-pressed',String(key===selected));
  button.addEventListener('click',()=>{selected=key;render();});
  buttons.set(key,button);filters.append(button);
 }
 render();
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
 const data={title:'Мастерская концепций «Выжившего»',type:'design-prototype',scenarios:SCENARIOS,baselines:SCENARIO_BASELINES,experiments:TACTICAL_EXPERIMENTS,baseRoles:BASE_ROLES,playtest:PLAYTEST_CHECKS,effects:EFFECTS,visualAudit:VISUAL_AUDIT,concepts:CONCEPTS,notes:$('concept-notes').value};
 try{await navigator.clipboard.writeText(JSON.stringify(data,null,2));$('notes-status').textContent='Концепции и заметки скопированы';}
 catch{$('notes-status').textContent='Буфер недоступен: скопируйте заметки из поля вручную';}
});
const studioTabs=['scenario','systems','loop','effects','concepts','tools'];
function sizeComparisonFrame(){
 const frame=$('vfx-compare-frame');
 if(!frame)return;
 try{
  const content=frame.contentDocument;
  if(!content||!content.body)return;
  const height=Math.max(520,Math.ceil(content.documentElement.scrollHeight)+8);
  if(frame.style.height!==height+'px')frame.style.height=height+'px';
 }catch{/* Standalone preview keeps its own scroll if embedding is blocked. */}
}
const comparisonFrame=$('vfx-compare-frame');
comparisonFrame.addEventListener('load',()=>{
 sizeComparisonFrame();
 try{
  if(window.ResizeObserver&&comparisonFrame.contentDocument?.body)
   new ResizeObserver(sizeComparisonFrame).observe(comparisonFrame.contentDocument.body);
 }catch{}
});
window.addEventListener('resize',sizeComparisonFrame);
function selectStudioTab(name,updateUrl=false){
 activeTab=studioTabs.includes(name)?name:'scenario';
 document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===activeTab)));
 for(const panel of studioTabs)$('panel-'+panel).hidden=panel!==activeTab;
 if(updateUrl&&location.hash!=='#'+activeTab)history.replaceState(null,'','#'+activeTab);
 if(activeTab==='effects'){restartEffect();requestAnimationFrame(sizeComparisonFrame);}
}
document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>selectStudioTab(btn.dataset.tab,true)));
window.addEventListener('hashchange',()=>selectStudioTab(location.hash.slice(1)));
initScenario();initEffects();initBrief();initConcepts();initVisualAudit();initExplosionLab();
selectStudioTab(location.hash.slice(1));
requestAnimationFrame(animate);
