import {emitWeaponFx,updateWeaponFx,drawWeaponFx} from '../weapon-fx.js?v=plasma-taper-1';
import {moduleStats} from '../ship-loadout.js?v=plasma-taper-1';
import {plasmaBeamPower,plasmaFarRetention} from '../weapon-specializations.js?v=weapons-cycle-2-weapon-mechanics-2-plasma-taper-1';
import {launchFlakVolley,updateFlakPellets,launchHeavyShell,updateHeavyShells,drawBallisticWeapons} from '../ballistic-weapons.js';
import {drawSeekingMissile} from '../combat-feedback.js';
import {drawFieldEffects} from '../field-weapons.js';
import {WorldVFX} from '../../src/world-vfx.js';
import {AudioLabEngine} from '../../audio-lab/audio-mixer.js';
import {SOUND_CATALOG} from '../../audio-lab/sound-map.js';

const W=1060,H=560;
const $=id=>document.getElementById(id);
const canvas=$('battle'),ctx=canvas.getContext('2d',{alpha:false});
const start={x:208,y:285};
const DATA=[
 {id:'plasma',name:'Плазменный излучатель',short:'Плазма',role:'Ближний бой · затухающий луч',
  desc:'У ствола луч широкий и плотный. С расстоянием его сердечник истончается, часть энергии уходит в боковые разряды. Фокусировка и «Дальний фокус» продлевают плотный участок и повышают фактический урон вдали; на стенде цель всегда находится в пределах реальной дальности оружия.',
  sound:'starter_soft',points:[{x:480,y:265}]},
 {id:'rail',name:'Рельсотрон',short:'Рельсотрон',role:'Дальний бой · прямой удар',
  desc:'Узкий ослепительно-светлый след, две параллельные кромки, парные скобы у ствола и резкая четырёхлучевая отметка попадания. При промахе конечной вспышки нет. Ручной выстрел использует тот же рисунок.',
  sound:'railgun',points:[{x:915,y:212}]},
 {id:'flak',name:'Осколочное орудие',short:'Осколочное',role:'Группа целей · рваная очередь',
  desc:'Из ствола вылетают девять настоящих осколков — по три на каждую цель в выбранном секторе. Они движутся по прямым, могут попасть в другой корпус или остановиться в астероиде. Широкий веер увеличивает охват, но уменьшает урон каждой тройки.',
  sound:'retro_blaster',points:[{x:415,y:224},{x:424,y:286},{x:411,y:347}]},
 {id:'rocket',name:'Ракетная установка',short:'Ракеты',role:'Преследование · запуск и полёт',
  desc:'У ствола короткий реактивный выхлоп; затем летит уже существующий в игре ракетный снаряд с хвостом. Линии до выбранной цели нет — ракета может изменить курс.',
  sound:'knife',points:[{x:860,y:245}]},
 {id:'ion',name:'Ионный проводник',short:'Ион',role:'Цепь · изломанный электрический путь',
  desc:'Неровная электрическая дуга проходит по реальным звеньям между поражёнными целями. Светлое ядро и яркие узлы отмечают связанный разряд. На стенде цепь показана без расхода боеприпасов.',
  sound:'lightning',points:[{x:620,y:205},{x:760,y:330},{x:915,y:225}]},
 {id:'resonator',name:'Резонатор',short:'Резонатор',role:'Связь · короткая передача урона',
  desc:'Помеченные цели соединены тонкой пунктирной сетью. Когда по одной проходит реальное попадание, фиолетовый импульс обозначает перенесённый урон по соседней. Сама связь не наносит постоянного урона.',
  sound:'magic_wand',points:[{x:665,y:190},{x:805,y:300},{x:920,y:190}]},
 {id:'howitzer',name:'Тяжёлая гаубица',short:'Гаубица',role:'Осадное орудие · подготовленный залп',
  desc:'После подготовки снаряд летит к отмеченной точке. Противник может сменить позицию; астероид или корабль на пути вызовет ранний взрыв. На цели остаётся видимый круг поражения, а взрыв использует общий игровой пул эффектов.',
  sound:'explosion_big',points:[{x:800,y:267}]}
];
const fxGame={time:0,weaponFx:[],flakPellets:[],heavyShells:[],player:start,
 shipLoadout:{specializations:{}},allies:[],grid:{query:()=>targets},rockGrid:{query:()=>[]},
 damageEnemy(t,amount){t.hp=Math.max(0,t.hp-amount);},damageRock(){},
 heritage:{play(){}}},vfx=new WorldVFX();
fxGame.heritage.vfx=vfx;
let selected=0,targets=[],missiles=[],sequence=false,sequenceNext=0,sequenceIndex=0;
let fps=60,reducedMotion=false,last=0,accum=0,shotDelay=0,backgroundTime=0;
let audio=null,audioEnabled=false,audioLoading=false;
const TAU=Math.PI*2;
const plasmaSetup=()=>{
 const rangeRank=Number($('plasmaRank').value)||0,selection=$('plasmaSpec').value;
 const spec=selection==='none'?null:{path:selection.startsWith('focus')?'focus':'furnace',
  rank:selection.endsWith('2')?2:1};
 return {rangeRank,range:moduleStats('plasma',{range:rangeRank}).range,spec};
};
const starPoints=Array.from({length:155},(_,i)=>{
 const hash=n=>(Math.sin(n*79.71+19.3)*43758.5453)%1;
 return {x:(hash(i*5)+1)%1*W,y:(hash(i*5+1)+1)%1*H,r:i%7?1:1.65};
});

const families=$('families');
for(let i=0;i<DATA.length;i++){
 const d=DATA[i],button=document.createElement('button');
 button.className='family';button.type='button';button.dataset.index=i;
 button.innerHTML=`<span>${String(i+1).padStart(2,'0')}</span>${d.short}<span>↗</span>`;
 button.addEventListener('click',()=>{sequence=false;selected=i;show(true);});
 families.append(button);
}

function show(fireNow){
 const d=DATA[selected];
 for(const button of families.querySelectorAll('button'))
  button.setAttribute('aria-pressed',String(Number(button.dataset.index)===selected));
 $('stageTitle').textContent=d.short+' / '+d.role.split(' · ')[0].toLowerCase();
 $('role').textContent=d.role;
 $('name').textContent=d.name;
 $('desc').textContent=d.desc;
 $('frameInfo').textContent=fps+' FPS · '+(reducedMotion?'движение отключено':'обычная анимация');
 $('plasmaControls').hidden=d.id!=='plasma';
 if(fireNow)fire();
}

const unit=(x,y)=>{const len=Math.hypot(x,y)||1;return {x:x/len,y:y/len};};
const surface=(from,target,r=21)=>{
 const u=unit(target.x-from.x,target.y-from.y);
 return {x:target.x-u.x*r,y:target.y-u.y*r};
};
function cueSound(key){if(audioEnabled&&audio)audio.play(key,{intensity:.8,force:true});}
function muzzle(origin,target,style){
 vfx.muzzle(origin.x,origin.y,Math.atan2(target.y-origin.y,target.x-origin.x),style);
}
function fire(){
 const d=DATA[selected];
 fxGame.weaponFx.length=0;fxGame.flakPellets=[];fxGame.heavyShells=[];vfx.reset();missiles=[];
 const setup=d.id==='plasma'?plasmaSetup():null;
 const points=setup?[{x:start.x+setup.range*.92,y:start.y-18}]:d.points;
 targets=points.map((p,i)=>({x:p.x,y:p.y,r:i===0&&d.id==='howitzer'?27:21,
  hp:100,maxHp:100,type:'fighter'}));
 shotDelay=0;
 if(['plasma','rail'].includes(d.id)){
  for(const target of targets){
   const impact=surface(start,target,target.r);
   emitWeaponFx(fxGame,d.id,start,impact,setup?{profile:{...setup,
    distance:Math.hypot(impact.x-start.x,impact.y-start.y),gain:1}}:{});
  }
  if(setup){
   const power=plasmaFarRetention(setup.rangeRank,setup.spec);
   const near=plasmaBeamPower(80,setup.range,setup.rangeRank,setup.spec);
   $('plasmaSummary').textContent='Дальность: '+setup.range+' м · мощность вблизи: '+
    Math.round(near*100)+'% · на пределе: '+Math.round(power*100)+
    '% · изменение толщины и ветвления соответствует урону';
  }
  muzzle(start,targets[0],d.id==='rail'?'railgun':'starter_pulse');
 }else if(d.id==='flak'){
  const items=targets.map(target=>({kind:'enemy',target}));
  launchFlakVolley(fxGame,start,items,items[0],{damage:14,range:245});
 }else if(d.id==='rocket'){
  emitWeaponFx(fxGame,'rocket',start,targets[0],{impact:false});
  muzzle(start,targets[0],'knife');
  missiles=[newMissile()];
 }else if(d.id==='ion'){
  let from=start;
  for(const target of targets){emitWeaponFx(fxGame,'ion',from,surface(from,target));from=target;}
  vfx.nova(targets[0].x,targets[0].y,35,'cyan');
 }else if(d.id==='resonator'){
  emitWeaponFx(fxGame,'resonator',targets[0],targets[1]);
  emitWeaponFx(fxGame,'resonator',targets[0],targets[2]);
  vfx.nova(targets[0].x,targets[0].y,40,'violet');
 }else{
  launchHeavyShell(fxGame,start,targets[0]);
 }
 cueSound(d.sound);
}

function newMissile(){
 const target=targets[0];
 return {x:start.x,y:start.y,prevX:start.x,prevY:start.y,
  tx:target.x,ty:target.y,trail:[{x:start.x,y:start.y}],speed:460};
}
function advance(dt){
 backgroundTime+=dt;fxGame.time+=dt;
 updateWeaponFx(fxGame,dt);vfx.update(dt);
 updateFlakPellets(fxGame,dt);updateHeavyShells(fxGame,dt);
 for(let i=missiles.length-1;i>=0;i--){
  const m=missiles[i],u=unit(m.tx-m.x,m.ty-m.y);
  m.prevX=m.x;m.prevY=m.y;m.x+=u.x*m.speed*dt;m.y+=u.y*m.speed*dt;
  m.trail.push({x:m.x,y:m.y});if(m.trail.length>10)m.trail.shift();
  if(Math.hypot(m.tx-m.x,m.ty-m.y)<=Math.max(17,m.speed*dt)){
   vfx.rocketImpact(m.tx,m.ty,26);missiles.splice(i,1);
  }
 }
 if(sequence&&fxGame.time>=sequenceNext){
  selected=sequenceIndex%DATA.length;sequenceIndex++;
  show(true);
  if(sequenceIndex>=DATA.length)sequence=false;
  else sequenceNext=fxGame.time+2.4;
 }
 if(!sequence){
  shotDelay+=dt;
  // Automatic, leisurely replay helps compare short effects without having to
  // click once per 200 ms shot. It does not affect the game's cooldowns.
  if(shotDelay>=3.6)fire();
 }
}

function background(){
 ctx.fillStyle='#061323';ctx.fillRect(0,0,W,H);
 const fill=ctx.createLinearGradient(0,0,W,H);
 fill.addColorStop(0,'#0a1d30');fill.addColorStop(.6,'#061422');fill.addColorStop(1,'#122238');
 ctx.fillStyle=fill;ctx.fillRect(0,0,W,H);
 ctx.lineWidth=1;ctx.strokeStyle='#8eb3d40b';
 for(let x=0;x<W;x+=70){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
 for(let y=0;y<H;y+=70){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
 for(const s of starPoints){ctx.fillStyle=s.r>1?'#7ba8c4':'#436985';ctx.fillRect(s.x,s.y,s.r,s.r);}
 ctx.strokeStyle='#2b5d7377';ctx.lineWidth=1.6;
 ctx.beginPath();ctx.ellipse(start.x,start.y,87,87,0,0,TAU);ctx.stroke();
}
function drawTarget(t,i){
 ctx.save();ctx.translate(t.x,t.y);ctx.rotate(.35+i*.68);
 ctx.fillStyle='#1d3c55';ctx.strokeStyle='#72bcd7';ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(0,-22);ctx.lineTo(20,9);ctx.lineTo(0,18);
 ctx.lineTo(-20,9);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.fillStyle='#8adee9';ctx.fillRect(-3,-5,6,10);
 ctx.restore();
 ctx.strokeStyle='#7bb4ca77';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(t.x,t.y,t.r+8,0,TAU);ctx.stroke();
 ctx.font='12px ui-monospace,monospace';ctx.fillStyle='#8caac4';
 ctx.fillText('ЦЕЛЬ '+String(i+1).padStart(2,'0'),t.x-26,t.y+46);
}
function drawHero(){
 ctx.save();ctx.translate(start.x,start.y);ctx.rotate(Math.PI/2);
 ctx.fillStyle='#15314a';ctx.strokeStyle='#9cddef';ctx.lineWidth=2.5;
 ctx.beginPath();ctx.moveTo(0,-29);ctx.lineTo(18,-3);ctx.lineTo(18,18);ctx.lineTo(0,10);
 ctx.lineTo(-18,18);ctx.lineTo(-18,-3);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.fillStyle='#55c4e7';ctx.fillRect(-4,-11,8,15);
 ctx.fillStyle='#ffbd78';ctx.fillRect(-12,17,5,10);ctx.fillRect(7,17,5,10);
 ctx.restore();
 ctx.fillStyle='#a3c5dc';ctx.font='bold 12px ui-monospace,monospace';
 ctx.fillText('ВАШ КОРАБЛЬ',start.x-49,start.y+64);
}
function draw(){
 background();
 for(let i=0;i<targets.length;i++)drawTarget(targets[i],i);
 if(DATA[selected].id==='howitzer'){
  ctx.save();ctx.strokeStyle='#c58bff59';ctx.setLineDash([9,8]);ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(targets[0].x,targets[0].y,110,0,TAU);ctx.stroke();ctx.restore();
 }
 if(DATA[selected].id==='resonator'){
  drawFieldEffects(ctx,{time:fxGame.time,fieldEffects:[{until:fxGame.time+1,targets:targets.map(t=>({kind:'enemy',target:t}))}],
   fps,rockGrid:{query:()=>[]},allies:[],player:start});
 }
 drawHero();
 for(const m of missiles)drawSeekingMissile(ctx,m,fps);
 drawBallisticWeapons(ctx,fxGame,fps,reducedMotion);
 drawWeaponFx(ctx,fxGame.weaponFx,fps,reducedMotion,{x:0,y:0,w:W,h:H});
 vfx.render(ctx,'front',{worldX:0,worldY:0,width:W,height:H});
 ctx.fillStyle='#8eb2c0';ctx.font='11px ui-monospace,monospace';
 ctx.fillText('СРАВНЕНИЕ ОРУЖИЯ · ДЛЯ ПЛАЗМЫ ПОКАЗАН РЕАЛЬНЫЙ СПАД СИЛЫ',19,30);
}
function frame(timestamp){
 const elapsed=Math.min(.14,(timestamp-last)/1000||.016);last=timestamp;
 accum+=elapsed;
 const targetInterval=1/fps;
 if(accum>=targetInterval){const delta=accum;accum=0;advance(delta);draw();}
 requestAnimationFrame(frame);
}

$('fire').addEventListener('click',()=>{sequence=false;fire();});
$('sequence').addEventListener('click',()=>{
 sequence=true;sequenceIndex=0;sequenceNext=fxGame.time;
});
$('fps').addEventListener('change',e=>{fps=Number(e.target.value);vfx.setBudget(fps<26?.27:fps<40?.45:fps<53?.7:1);show(false);});
$('motion').addEventListener('change',e=>{reducedMotion=e.target.checked;show(false);});
for(const id of ['plasmaRank','plasmaSpec'])
 $(id).addEventListener('change',()=>{sequence=false;show(true);});
document.addEventListener('keydown',e=>{
 if(e.target instanceof HTMLSelectElement||e.target instanceof HTMLInputElement)return;
 if(e.key>='1'&&e.key<='7'){selected=Number(e.key)-1;sequence=false;show(true);}
 else if(e.code==='Space'){e.preventDefault();sequence=false;fire();}
});

$('sound').addEventListener('click',async()=>{
 const button=$('sound');
 if(audioEnabled){audioEnabled=false;button.textContent='Звук выключен';button.setAttribute('aria-pressed','false');return;}
 if(audioLoading)return;
 if(!audio){
  audioLoading=true;button.textContent='Загружаю записи…';button.disabled=true;
  try{
   audio=new AudioLabEngine();await audio.unlock();
   const root=new URL('../../audio-lab/',import.meta.url);
   await Promise.all(DATA.map(async d=>{
    const def=SOUND_CATALOG[d.sound];
    const recording=def.sampleUrls?.[0]||def.sampleUrl;
    await audio.loadSampleFromUrl(d.sound,new URL(recording,root).href,{append:true,index:0});
    if(def.sampleLayerUrls?.[0])await audio.loadSampleFromUrl(d.sound,
     new URL(def.sampleLayerUrls[0],root).href,{append:true,layer:true,index:0});
   }));
  }catch(error){
   audio=null;button.textContent='Звук недоступен';button.title=String(error);
  }finally{audioLoading=false;button.disabled=false;}
 }
 if(audio){audioEnabled=true;button.textContent='Звук включён';button.setAttribute('aria-pressed','true');
  cueSound(DATA[selected].sound);}
});

show(true);requestAnimationFrame(frame);
