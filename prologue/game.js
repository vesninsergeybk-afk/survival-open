/* Survivor: Station Zero — self-contained playable first slice.
 * Original industrial floor art + existing Wenrexa CC0 station sprite atlas.
 * No writes to the campaign save, weapons or mission selection.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id), canvas=$('world'),ctx=canvas.getContext('2d',{alpha:false});
// An optional real 3D visual layer; collision and level mechanics stay 2D.
let hybrid3d=null;
import('../src/hybrid-3d.js?v=hybrid-20261029').then(({Hybrid3D})=>{
    hybrid3d=new Hybrid3D(canvas,{mode:'prologue'});
}).catch(error=>console.warn('Prologue Canvas2D fallback',error));
const fogCanvas=document.createElement('canvas'),fogCtx=fogCanvas.getContext('2d');
const skyCanvas=document.createElement('canvas'),skyCtx=skyCanvas.getContext('2d');skyCanvas.width=720;skyCanvas.height=360;
const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),hypot=Math.hypot,lerp=(a,b,t)=>a+(b-a)*t,dist=(a,b)=>hypot(a.x-b.x,a.y-b.y);
const ROOMS=[{id:'dock',name:'Ремонтный док',x:-560,y:-410,w:1120,h:820},{id:'security',name:'Охранный зал',x:860,y:-420,w:1080,h:840},{id:'workshop',name:'Монтажная мастерская',x:2240,y:-345,w:900,h:690},{id:'arena',name:'Литейная арена',x:3350,y:-430,w:1030,h:860},{id:'command',name:'Командный центр',x:4700,y:-375,w:930,h:750},{id:'defense',name:'Оборонное ядро',x:5910,y:-465,w:1200,h:930},{id:'evac',name:'Эвакуационный шлюз',x:7410,y:-360,w:900,h:720}];
const HALLS=[{x:440,y:-140,w:520,h:280},{x:1855,y:-130,w:520,h:260},{x:2940,y:-110,w:460,h:220},{x:4280,y:-130,w:520,h:260},{x:5540,y:-125,w:480,h:250},{x:7000,y:-125,w:520,h:250}];
const COVERS=[{x:1410,y:0,w:185,h:210},{x:1545,y:310,w:115,h:100},{x:3840,y:0,w:190,h:185},{x:5070,y:250,w:145,h:95},{x:6540,y:0,w:170,h:170}];
const NAV_ANCHORS=[{x:645,y:0},{x:925,y:0},{x:1905,y:0},{x:2100,y:0},{x:2295,y:0},{x:3260,y:0},{x:4330,y:0},{x:4750,y:0},{x:5570,y:0},{x:6010,y:0},{x:7080,y:0},{x:7440,y:0},...COVERS.flatMap(o=>[-1,1].flatMap(sx=>[-1,1].map(sy=>({x:o.x+sx*(o.w/2+34),y:o.y+sy*(o.h/2+34)}))))];
const STATIONS=[{id:'generator',x:-165,y:-195,label:'Резервный генератор',seconds:2,kind:'generator'},{id:'a',x:1160,y:245,label:'Турель «Север»',seconds:1.5,kind:'turret'},{id:'b',x:1720,y:-245,label:'Турель «Юг»',seconds:1.5,kind:'turret'},{id:'weapon',x:2690,y:0,label:'Монтажный комплекс',seconds:1.8,kind:'armament'},{id:'relay-a',x:3585,y:-250,label:'Литейный стабилизатор А',seconds:1.5,kind:'relay'},{id:'relay-b',x:4190,y:250,label:'Литейный стабилизатор Б',seconds:1.5,kind:'relay'},{id:'bridge',x:5160,y:-60,label:'Командный терминал',seconds:2.2,kind:'terminal'},{id:'heavy-a',x:6230,y:-275,label:'Тяжёлая турель А',seconds:1.7,kind:'heavy'},{id:'heavy-b',x:6820,y:270,label:'Тяжёлая турель Б',seconds:1.7,kind:'heavy'},{id:'escape',x:8030,y:0,label:'Эвакуационный передатчик',seconds:2.5,kind:'evac'}];
const doors=[{id:'dock',x:535,y:0,width:240,seconds:1.8},{id:'exit',x:1930,y:0,width:220,seconds:1.3},{id:'arena',x:3128,y:0,width:200,seconds:1.4},{id:'command',x:4350,y:0,width:220,seconds:1.5},{id:'defense',x:5580,y:0,width:220,seconds:1.6},{id:'evac',x:7100,y:0,width:220,seconds:1.8}];
const atlas=new Image(),floor=new Image();
let ready=0,failed=false,started=false,ended=false,paused=false,last=0,now=0,w=0,h=0,dpr=1,scale=1;
const keys=new Set(),pointer={x:0,y:0,id:null},input={beam:false,interact:false},camera={x:0,y:0};
let hero,generator,turrets,enemies,projectiles,particles,doorState,wave,alarm,progress,toastTimer,toastText,visibleCells,exploredCells,seenSecurity,entryTimer,hitFlash,zoneName,audioCtx,lastFootnote,elapsed,securityUnlocked,queuedSpawn,workshop,arena,command,defense,evac,stageProgress;
const CELL=160,COLS=8,art={generator:0,turret:18,turretFiring:19,ship:27,enemy:36,reactor:9};
const colors={mint:'#58f3c3',amber:'#f6c078',red:'#ff6b85',cyan:'#95daff'};
function loadImg(img,src){img.onload=()=>{ready++;if(ready===2){$('startBtn').disabled=false;$('startBtn').textContent='НАЧАТЬ ПОБЕГ';}};img.onerror=()=>{failed=true;$('startBtn').disabled=true;$('startBtn').textContent='НЕ УДАЛОСЬ ЗАГРУЗИТЬ ГРАФИКУ';$('intro').querySelector('.warning').textContent='Не загрузился обязательный графический файл '+src+'. Обновите страницу или проверьте наличие ассетов.';};img.src=src;}
$('startBtn').disabled=true;$('startBtn').textContent='ЗАГРУЗКА ОФОРМЛЕНИЯ…';
loadImg(atlas,'../assets/space/station-atlas.webp');loadImg(floor,'./assets/station-floor.webp');
function reset(){
 now=0;elapsed=0;hero={x:0,y:95,vx:0,vy:0,angle:0,hp:100,max:100,r:20,inv:0};
 generator={online:false};turrets=STATIONS.filter(s=>s.kind==='turret').map(s=>({...s,state:'offline',progress:0,boot:0,hp:160,angle:s.id==='b'?1.5:0,recoil:0,flash:0,shotCd:0,disabledFor:0}));
 enemies=[[1785,245],[1850,210],[1740,165]].map((p,i)=>enemy(p[0],p[1],i,true));
 projectiles=[];particles=[];doorState=doors.map(d=>({...d,open:0,target:0,progress:0}));
 wave={phase:0,at:0,spawned:0,remaining:0};workshop={progress:0,mountTimer:0,installed:false,botsQueued:0,botsSpawned:0,nextBotAt:0,clear:false,gunCooldown:0};arena={entered:false,relays:{'relay-a':false,'relay-b':false},waveSpawned:0,waveAt:0,clear:false};command={entered:false,hacked:false,spawned:0,clear:false};defense={entered:false,coreHp:200,waveStarted:false,spawned:0,nextAt:0,clear:false,heavy:STATIONS.filter(s=>s.kind==='heavy').map(s=>({...s,state:'offline',boot:0,angle:0,recoil:0,flash:0,shotCd:0}))};evac={entered:false,countdown:0,launched:false};stageProgress={};alarm=false;progress={generator:0,door:0};toastTimer=0;toastText='';visibleCells=new Set();exploredCells=new Set();
 seenSecurity=false;entryTimer=0;hitFlash=0;zoneName='';camera.x=hero.x;camera.y=hero.y;securityUnlocked=false;queuedSpawn=[];lastFootnote='';ended=false;
 $('ending').style.display='none';$('intro').style.display='none';$('hpFill').style.width='100%';$('hpValue').textContent='100%';
 $('zoneTitle').textContent='Ремонтный док';$('toast').classList.remove('visible');$('prompt').classList.remove('visible');
 if(audioCtx?.state==='suspended')audioCtx.resume().catch(()=>{});
 message('ОБЪЕКТ: СТАНЦИЯ «НУЛЬ» · НИ ОДНОГО СИГНАЛА ЭКИПАЖА',3.4);updateUI();
}
function enemy(x,y,id,patrol=false){return {x,y,id,spawnX:x,spawnY:y,hp:30,max:30,r:21,speed:164,state:patrol?'patrol':'investigate',wp:id%3,angle:Math.PI,detect:0,lastSeen:0,attackCd:0,attackFlash:0,stun:0,patrol,investigated:false,vx:0,vy:0};}
function start(){if(ready!==2||failed)return;reset();started=true;paused=false;initAudio();}
$('startBtn').addEventListener('click',start);$('againBtn').addEventListener('click',start);
$('restart').addEventListener('click',()=>{if(ready===2){start();}});
window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='KeyE')input.interact=true;if((e.code==='Enter'||e.code==='Space')&&!started&&ready===2)start();});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyE')input.interact=false;});
function releaseControls(){keys.clear();input.beam=false;input.interact=false;pointer.id=null;pointer.x=pointer.y=0;const s=$('stick');if(s)s.style.transform='';for(const id of ['beamBtn','interactBtn'])$(id)?.classList.remove('active');}
window.addEventListener('blur',releaseControls);
document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseControls();last=0;}});
const pad=$('joystickPad'),stick=$('stick'),beamBtn=$('beamBtn'),interactBtn=$('interactBtn');
function onPad(e){e.preventDefault();if(pointer.id!==null&&pointer.id!==e.pointerId)return;pointer.id=e.pointerId;pad.setPointerCapture(e.pointerId);movePad(e);}
function movePad(e){if(pointer.id!==e.pointerId)return;const r=pad.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,len=hypot(dx,dy),lim=r.width*.32;pointer.x=clamp(dx/lim,-1,1);pointer.y=clamp(dy/lim,-1,1);if(len>lim){pointer.x=dx/len;pointer.y=dy/len;}stick.style.transform='translate('+(pointer.x*lim)+'px,'+(pointer.y*lim)+'px)';}
function endPad(e){if(pointer.id!==e.pointerId)return;pointer.id=null;pointer.x=pointer.y=0;stick.style.transform='';}
pad.addEventListener('pointerdown',onPad);pad.addEventListener('pointermove',movePad);pad.addEventListener('pointerup',endPad);pad.addEventListener('pointercancel',endPad);pad.addEventListener('lostpointercapture',endPad);
for(const [el,key] of [[beamBtn,'beam'],[interactBtn,'interact']]){el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);input[key]=true;el.classList.add('active');initAudio();});for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>{input[key]=false;el.classList.remove('active');});}
function message(t,seconds=2.4){toastText=t;toastTimer=seconds;$('toast').textContent=t;$('toast').classList.add('visible');}
function initAudio(){try{if(!audioCtx){const AC=window.AudioContext||window.webkitAudioContext;if(AC)audioCtx=new AC();}if(audioCtx?.state==='suspended')audioCtx.resume().catch(()=>{});}catch{}}
function tone(freq=440,dur=.12,type='sine',gain=.035){if(!audioCtx||audioCtx.state!=='running')return;const t=audioCtx.currentTime,o=audioCtx.createOscillator(),g=audioCtx.createGain(),f=audioCtx.createBiquadFilter();f.type='lowpass';f.frequency.value=1400;o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*.65),t+dur);g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(f);f.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+dur+.01);}
function rectContains(x,y,r){return x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;}
function withinWorld(x,y,r=20){return [...ROOMS,...HALLS].some(o=>x>=o.x+r&&x<=o.x+o.w-r&&y>=o.y+r&&y<=o.y+o.h-r);}
function circleRect(x,y,r,o){const dx=x-clamp(x,o.x-o.w/2,o.x+o.w/2),dy=y-clamp(y,o.y-o.h/2,o.y+o.h/2);return dx*dx+dy*dy<r*r;}
function collides(x,y,r){if(!withinWorld(x,y,r))return true;
 for(const o of COVERS)if(circleRect(x,y,r,o))return true;
 for(const d of doorState)if(d.open<.85&&Math.abs(x-d.x)<(21+r)&&Math.abs(y-d.y)<d.width/2+r)return true;
 for(const s of STATIONS)if(s.kind!=='armament'&&hypot(x-s.x,y-s.y)<r+(s.kind==='generator'?39:29))return true;
 return false;
}
function moveActor(a,dx,dy,r){if(!collides(a.x+dx,a.y,r))a.x+=dx;else if(a===hero)a.vx=0;if(!collides(a.x,a.y+dy,r))a.y+=dy;else if(a===hero)a.vy=0;}
function pointInSolid(x,y){if(COVERS.some(o=>rectContains(x,y,{x:o.x-o.w/2,y:o.y-o.h/2,w:o.w,h:o.h})))return true;
 for(const d of doorState)if(d.open<.85&&Math.abs(x-d.x)<20&&Math.abs(y-d.y)<d.width/2)return true;
 return !([...ROOMS,...HALLS].some(r=>rectContains(x,y,r)));
}
function clearLOS(ax,ay,bx,by){const l=hypot(bx-ax,by-ay),steps=Math.ceil(l/22);for(let i=1;i<steps;i++){const f=i/steps;if(pointInSolid(lerp(ax,bx,f),lerp(ay,by,f)))return false;}return true;}
function closestDevice(){
 const items=[];
 if(!generator.online)items.push({...STATIONS[0],kind:'generator'});
 else if(doorState[0].target===0)items.push({id:'door',x:535,y:0,label:'Силовой шлюз',seconds:.7,kind:'door'});
 for(const s of turrets)if(s.state==='offline'||s.state==='disabled'||s.hp<125)items.push(s);
 if(securityUnlocked&&!workshop.installed&&!workshop.mountTimer)items.push(STATIONS[3]);
 if(arena.entered&&!arena.clear)for(const s of STATIONS)if(s.kind==='relay'&&!arena.relays[s.id])items.push(s);
 if(command.entered&&!command.hacked)items.push(STATIONS.find(s=>s.kind==='terminal'));
 if(defense.entered&&!defense.clear)for(const t of defense.heavy)if(t.state==='offline')items.push(t);
 if(evac.entered&&!evac.launched)items.push(STATIONS.find(s=>s.kind==='evac'));
 return items.filter(s=>dist(hero,s)<=(s.kind==='armament'?75:180)&&(s.kind==='door'?clearLOS(hero.x,hero.y,s.x-35,s.y):clearLOS(hero.x,hero.y,s.x,s.y))).sort((a,b)=>dist(hero,a)-dist(hero,b))[0]||null;
}
function beamTargetDone(device){
 if(device.kind==='generator'){generator.online=true;tone(320,.35,'triangle',.07);tone(610,.24,'sine',.04);message('ПИТАНИЕ ВОССТАНОВЛЕНО · ШЛЮЗ ГОТОВ К ЗАПУСКУ',3.3);}
 else if(device.kind==='door'){doorState[0].target=1;tone(200,.45,'sawtooth',.06);message('ГЕРМОЗАТВОР РАЗБЛОКИРОВАН',2.3);}
 else if(device.kind==='armament'){workshop.mountTimer=3.4;workshop.progress=0;hero.vx=hero.vy=0;tone(460,.5,'triangle',.055);message('МОНТАЖ НАЧАТ · ЗАФИКСИРУЙТЕ КОРАБЛЬ В ПЛАТФОРМЕ',3.2);}
 else if(device.kind==='relay'){arena.relays[device.id]=true;stageProgress[device.id]=0;tone(570,.35,'triangle',.045);emit(device.x,device.y,colors.mint,22,2);message('ЛИТЕЙНЫЙ СТАБИЛИЗАТОР ОТКЛЮЧЁН',3);}
 else if(device.kind==='terminal'){command.hacked=true;stageProgress[device.id]=0;tone(760,.6,'triangle',.06);message('ПРОТОКОЛ «ОПЛОТ» РАСШИФРОВАН · ПОДНИМАЕТСЯ ОХРАНА',3.6);}
 else if(device.kind==='heavy'){const t=defense.heavy.find(s=>s.id===device.id);t.state='charging';t.boot=2.3;stageProgress[device.id]=0;tone(440,.5,'triangle',.05);message(t.label.toUpperCase()+' · ЗАПУСК ТЯЖЁЛОГО ОРУДИЯ',3);}
 else if(device.kind==='evac'){evac.launched=true;evac.countdown=4.2;stageProgress[device.id]=0;tone(960,.5,'triangle',.06);message('СИГНАЛ ПЕРЕДАН · ЗАПУСК ЭВАКУАЦИОННОГО КАНАЛА',4);}
 else {const t=turrets.find(x=>x.id===device.id);if(!t)return;if(t.state==='disabled'){t.hp=Math.max(t.hp,65);}
 if(t.state==='offline'||t.state==='disabled'){t.state='charging';t.boot=3.6;t.progress=0;if(!alarm){alarm=true;for(const en of enemies)if(en.hp>0)en.state='investigate';message('ТРЕВОГА · ПАТРУЛЬ ПРОВЕРЯЕТ СИГНАЛ ТУРЕЛИ',3.6);tone(170,.8,'sawtooth',.09);}tone(540,.32,'triangle',.04);message('ТУРЕЛЬ '+(t.id==='a'?'«СЕВЕР»':'«ЮГ»')+' · ЗАПУСК ПИТАНИЯ',2.4);}
 else if(t.hp<125){t.hp=Math.min(160,t.hp+50);tone(680,.2);}
 }
}
function updateHero(dt){
 if(workshop.mountTimer>0){hero.vx=hero.vy=0;hero.inv=Math.max(0,hero.inv-dt);return;}
 const vx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+pointer.x;
 const vy=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+pointer.y;
 const l=hypot(vx,vy),speed=240,tx=(l? vx/l:0)*speed,ty=(l?vy/l:0)*speed,acc=clamp(dt*6.8,0,1);
 hero.vx=lerp(hero.vx,tx,acc);hero.vy=lerp(hero.vy,ty,acc);
 moveActor(hero,hero.vx*dt,hero.vy*dt,hero.r);
 if(hypot(hero.vx,hero.vy)>18)hero.angle=Math.atan2(hero.vy,hero.vx);
 hero.inv=Math.max(0,hero.inv-dt);hitFlash=Math.max(0,hitFlash-dt*2.8);
 const device=closestDevice(),hold=(keys.has('Space')||input.beam||input.interact);
 if(device&&hold){
 const id=device.id,rate=dt/device.seconds;
 if(id==='generator')progress.generator=clamp(progress.generator+rate,0,1);
 else if(id==='door')progress.door=clamp(progress.door+rate,0,1);
 else if(id==='weapon')workshop.progress=clamp(workshop.progress+rate,0,1);
  else if(['relay','terminal','heavy','evac'].includes(device.kind))stageProgress[id]=clamp((stageProgress[id]||0)+rate,0,1);
 else {const t=turrets.find(x=>x.id===id);if(t&&t.state!=='charging'&&t.state!=='online')t.progress=clamp(t.progress+rate,0,1);else if(t&&t.state==='online'&&t.hp<125)t.hp=Math.min(160,t.hp+24*dt);}
 if(id==='generator'&&progress.generator>=1||id==='door'&&progress.door>=1||device.kind==='turret'&&turrets.find(x=>x.id===id)?.progress>=1||id==='weapon'&&workshop.progress>=1||['relay','terminal','heavy','evac'].includes(device.kind)&&stageProgress[id]>=1)beamTargetDone(device);
 if(Math.random()<dt*12)emit(hero.x+(device.x-hero.x)*Math.random(),hero.y+(device.y-hero.y)*Math.random(),colors.mint,1.8,1);
 } else {
 progress.generator=Math.max(0,progress.generator-dt*.3);progress.door=Math.max(0,progress.door-dt*.3);workshop.progress=Math.max(0,workshop.progress-dt*.22);
  for(const id of Object.keys(stageProgress))stageProgress[id]=Math.max(0,stageProgress[id]-dt*.3);
 for(const t of turrets)if(t.state==='offline'||t.state==='disabled')t.progress=Math.max(0,t.progress-dt*.25);
 }
 // Keep the player from entering a wall or gate while their movement is accelerating.
 const dockToSecurity=hero.x>905&&!seenSecurity;
 if(dockToSecurity){seenSecurity=true;entryTimer=2.8;message('ОХРАННЫЙ ЗАЛ · ПАТРУЛЬНЫЕ ДРОНЫ ВПЕРЕДИ',3.2);}
 if(entryTimer>0)entryTimer=Math.max(0,entryTimer-dt);
 if(evac.launched&&evac.countdown<=0){win();return;}
}
function hurtHero(amount){if(hero.inv>0)return;hero.hp=Math.max(0,hero.hp-amount);hero.inv=.72;hitFlash=.7;tone(112,.36,'sawtooth',.09);emit(hero.x,hero.y,colors.red,16,3.8);if(hero.hp<=0)lose();}
// Shortest unobstructed routes between cover corners and corridor centers.
function freeSegment(a,b,r=24){const steps=Math.ceil(dist(a,b)/33);for(let i=1;i<=steps;i++){const t=i/steps;if(collides(lerp(a.x,b.x,t),lerp(a.y,b.y,t),r))return false;}return true;}
function chooseWaypoint(e,goal){
 const start={x:e.x,y:e.y};if(freeSegment(start,goal,e.r))return goal;
 const nodes=[start,...NAV_ANCHORS.filter(p=>p.x>Math.min(e.x,goal.x)-300&&p.x<Math.max(e.x,goal.x)+300&&!collides(p.x,p.y,e.r)),goal],n=nodes.length;
 const costs=Array(n).fill(Infinity),previous=Array(n).fill(-1),visited=Array(n).fill(false);costs[0]=0;
 for(let k=0;k<n;k++){let u=-1;for(let i=0;i<n;i++)if(!visited[i]&&(u<0||costs[i]<costs[u]))u=i;
  if(u<0||!Number.isFinite(costs[u])||u===n-1)break;visited[u]=true;
  for(let v=1;v<n;v++){if(v===u||visited[v])continue;const d=dist(nodes[u],nodes[v]);
   if(costs[u]+d>=costs[v]||!freeSegment(nodes[u],nodes[v],e.r))continue;
   costs[v]=costs[u]+d;previous[v]=u;
  }
 }
 if(!Number.isFinite(costs[n-1]))return null;
 let index=n-1;while(previous[index]>0)index=previous[index];
 return nodes[index];
}
function moveEnemy(e,toX,toY,dt){
 const goal={x:toX,y:toY};
 if(e.navAt===undefined||now>=e.navAt||dist(goal,e.navGoal||goal)>90||e.navPoint&&dist(e,e.navPoint)<30){
  e.navPoint=chooseWaypoint(e,goal);e.navGoal=goal;e.navAt=now+.45+(e.id%4)*.08;
 }
 if(e.navPoint===null)return;
 const to=e.navPoint||goal,dx=to.x-e.x,dy=to.y-e.y,l=hypot(dx,dy)||1;
 e.angle=Math.atan2(dy,dx);
 const v=Math.min(e.speed*dt,Math.max(0,l-14));moveActor(e,dx/l*v,dy/l*v,e.r);
}
function updateEnemies(dt){
 const patrolPoints=[[1760,260],[1830,230],[1740,170]];
 for(const e of enemies){if(e.hp<=0)continue;
 e.attackCd=Math.max(0,e.attackCd-dt);e.attackFlash=Math.max(0,e.attackFlash-dt*4);
  if(e.kind==='siege'){
   const tx=6540+(e.x>=6540?154:-154),ty=e.y>=0?108:-108;
   if(hypot(e.x-6540,e.y)>235)moveEnemy(e,tx,ty,dt);
   if(hypot(e.x-6540,e.y)<246&&e.attackCd<=0){e.attackCd=1.6;e.attackFlash=.55;defense.coreHp=Math.max(0,defense.coreHp-10);emit(6540,0,colors.red,7,2);tone(132,.25,'sawtooth',.035);if(defense.coreHp<=0){lose();return;}}
   continue;
  }
 const d=dist(e,hero),toHero=Math.atan2(hero.y-e.y,hero.x-e.x),inView=d<310&&Math.abs(Math.atan2(Math.sin(toHero-e.angle),Math.cos(toHero-e.angle)))<.9&&clearLOS(e.x,e.y,hero.x,hero.y);
 if(inView)e.detect+=dt;else e.detect=Math.max(0,e.detect-dt*.6);
 if(e.detect>.35){if(!alarm){alarm=true;message('ВНИМАНИЕ · ПАТРУЛЬ ОБНАРУЖИЛ КОРАБЛЬ',2.7);tone(155,.6,'sawtooth',.08);}e.state='pursue';e.lastSeen=now;}
 else if(e.state==='pursue'&&now-e.lastSeen>1.3)e.state='search';
 if(e.state==='patrol'){
 const p=patrolPoints[e.wp%patrolPoints.length];if(hypot(e.x-p[0],e.y-p[1])<30)e.wp++;
 moveEnemy(e,p[0],p[1],dt);
 }else if(e.state==='investigate'){
 const waypoints=[[1665,185],[1515,177],[1220,245]];if(e.leg==null)e.leg=0;
 const p=waypoints[e.leg],lane=(e.id%3-1)*17;moveEnemy(e,p[0],p[1]+lane,dt);
 if(hypot(e.x-p[0],e.y-(p[1]+lane))<30){e.leg++;if(e.leg>=waypoints.length){e.leg=0;e.state='search';}}
 }
 else if(e.state==='pursue'){moveEnemy(e,hero.x,hero.y,dt);}
 else if(e.state==='search'){
 const pt=[Math.max(1230,hero.x-130),clamp(hero.y+(e.id%2?80:-80),-340,340)];moveEnemy(e,pt[0],pt[1],dt);
 if(d<145&&clearLOS(e.x,e.y,hero.x,hero.y)){e.state='pursue';e.lastSeen=now;}
 }
 if(d<102&&clearLOS(e.x,e.y,hero.x,hero.y)&&e.attackCd<=0){e.attackCd=1.5;e.attackFlash=.5;hurtHero(e.kind==='repair'?12:8);}
 for(const t of turrets)if(t.state==='online'&&dist(t,e)<60&&e.attackCd<=0){t.hp=Math.max(0,t.hp-8);e.attackCd=1.5;if(t.hp===0){t.state='disabled';t.disabledFor=0;emit(t.x,t.y,colors.red,22,3.5);tone(80,.7,'sawtooth',.08);message('ТУРЕЛЬ ПОВРЕЖДЕНА · ИНЖЕНЕРНЫЙ ЛУЧ ВОССТАНОВИТ ЕЁ',2.5);}}
 }
}
function turretAim(t,e,dt){const a=Math.atan2(e.y-t.y,e.x-t.x),diff=Math.atan2(Math.sin(a-t.angle),Math.cos(a-t.angle));t.angle+=clamp(diff,-3.2*dt,3.2*dt);return Math.abs(diff)<.14;}
function updateTurrets(dt){
 for(const t of turrets){
 t.flash=Math.max(0,t.flash-dt*7);t.recoil=Math.max(0,t.recoil-dt*38);t.shotCd=Math.max(0,t.shotCd-dt);
 if(t.state==='charging'){t.boot-=dt;if(t.boot<=0){t.state='online';t.hp=Math.max(60,t.hp);tone(810,.42,'triangle',.06);message('ТУРЕЛЬ '+(t.id==='a'?'«СЕВЕР»':'«ЮГ»')+' ОНЛАЙН',2.1);}}
 if(t.state==='disabled'){t.disabledFor+=dt;if(t.disabledFor>12&&turrets.every(x=>x.state==='disabled')){t.hp=80;t.state='online';t.disabledFor=0;message('АВАРИЙНОЕ ПИТАНИЕ · ТУРЕЛЬ ВОССТАНОВЛЕНА',2.4);}continue;}
 if(!['online','charging'].includes(t.state))continue;
 const targets=enemies.filter(e=>e.hp>0&&dist(e,t)<360&&clearLOS(t.x,t.y,e.x,e.y));
 targets.sort((a,b)=>(dist(a,hero)-dist(b,hero))*.3+dist(a,t)-dist(b,t));
 if(targets.length){const target=targets[0],aimed=turretAim(t,target,dt);if(t.state==='online'&&aimed&&t.shotCd<=0){t.shotCd=.35;t.flash=.18;t.recoil=8;const a=t.angle;projectiles.push({x:t.x+Math.cos(a)*35,y:t.y+Math.sin(a)*35,vx:Math.cos(a)*750,vy:Math.sin(a)*750,life:.8,damage:9,target:target.id});emit(t.x+Math.cos(a)*36,t.y+Math.sin(a)*36,colors.amber,5,2.4);tone(130,.09,'sawtooth',.024);}}
 }
 if(turrets.every(t=>t.state==='online')&&wave.phase===0){wave.phase=1;wave.at=now+2.5;message('ПРОТОКОЛ ОБОРОНЫ · ЗАЩИТИТЕ СЕКТОР ОТ ПОДКРЕПЛЕНИЯ',3.1);}
 if(wave.phase===1&&now>=wave.at){wave.phase=2;wave.spawned=0;wave.remaining=6;wave.at=now+.15;message('ОТКРЫЛИСЬ СЕРВИСНЫЕ ЛЮКИ · ПОДКРЕПЛЕНИЕ В ПУТИ',2.4);}
 if(wave.phase===2&&now>=wave.at&&wave.spawned<6){
 const i=wave.spawned,p=[[1850,315],[1810,-295],[1880,60],[1690,345],[1770,-330],[1840,225]][i];
 // Spawn only outside immediate ship collision range and from clearly indicated eastern hatches.
 let sp={x:p[0],y:p[1]};if(dist(hero,sp)<240)sp={x:1880,y:i%2?335:-335};
 enemies.push({...enemy(sp.x,sp.y,3+i,false),state:'investigate'});emit(sp.x,sp.y,colors.red,20,3);wave.spawned++;wave.at=now+1.1;
 }
 if(wave.phase===2&&wave.spawned===6&&enemies.every(e=>e.hp<=0)){
 wave.phase=3;securityUnlocked=true;doorState[1].target=1;message('ОХРАННЫЙ СЕКТОР ОЧИЩЕН · ПРОХОД В МАСТЕРСКУЮ ОТКРЫТ',3.6);tone(680,.55,'triangle',.045);
 }
}
function updateWorkshop(dt){
 if(workshop.mountTimer>0){
  workshop.mountTimer=Math.max(0,workshop.mountTimer-dt);
  if(Math.random()<dt*22)emit(hero.x+Math.cos(now*9)*29,hero.y+Math.sin(now*9)*29,colors.mint,2,1.6);
  if(workshop.mountTimer===0){
   workshop.installed=true;workshop.botsQueued=2;workshop.nextBotAt=now+2.5;
   tone(890,.45,'triangle',.06);message('ИМПУЛЬСНЫЙ РАЗРЯДНИК УСТАНОВЛЕН · АВТОМАТИЧЕСКОЕ НАВЕДЕНИЕ',3.7);
  }
 }
 if(workshop.installed&&workshop.botsQueued>0&&now>=workshop.nextBotAt){
  const id=10+workshop.botsSpawned;
  const p=workshop.botsSpawned===0?[2970,175]:[2980,-175];
  const e=enemy(p[0],p[1],id,false);e.kind='repair';e.speed=188;e.r=18;e.state='pursue';e.lastSeen=now;
  enemies.push(e);workshop.botsQueued--;workshop.botsSpawned++;workshop.nextBotAt=now+1.6;
  emit(e.x,e.y,colors.red,26,3);tone(190,.4,'sawtooth',.045);
  if(workshop.botsSpawned===1)message('СЕРВИСНЫЕ РОБОТЫ ПЕРЕШЛИ ПОД КОНТРОЛЬ ЗАХВАТЧИКОВ',3);
 }
 if(workshop.installed){
  workshop.gunCooldown=Math.max(0,workshop.gunCooldown-dt);
  if(workshop.gunCooldown<=0){
   const list=enemies.filter(e=>e.hp>0&&dist(hero,e)<160&&clearLOS(hero.x,hero.y,e.x,e.y)).sort((a,b)=>dist(hero,a)-dist(hero,b));
   if(list.length){
    const e=list[0],a=Math.atan2(e.y-hero.y,e.x-hero.x);
    const launch=Math.min(31,Math.max(0,dist(hero,e)-e.r-8));
    projectiles.push({x:hero.x+Math.cos(a)*launch,y:hero.y+Math.sin(a)*launch,vx:Math.cos(a)*660,vy:Math.sin(a)*660,life:.3,damage:9,source:'player'});
    workshop.gunCooldown=.4;emit(hero.x+Math.cos(a)*33,hero.y+Math.sin(a)*33,colors.mint,6,1.8);tone(740,.09,'triangle',.024);
   }
  }
  if(workshop.botsSpawned===2&&workshop.botsQueued===0&&!enemies.some(e=>e.hp>0&&e.kind==='repair')&&!workshop.clear){
   workshop.clear=true;doorState[2].target=1;message('ОХРАННЫЕ РОБОТЫ УНИЧТОЖЕНЫ · ПУТЬ К ПРОИЗВОДСТВЕННОМУ ОТСЕКУ ОТКРЫТ',4);tone(740,.35,'triangle',.05);
  }
 }
}

function stageSpawn(x,y,id,kind,hp=30,speed=152){
 const e=enemy(x,y,id,false);e.kind=kind;e.hp=e.max=hp;e.speed=speed;e.r=kind==='siege'?27:kind==='sentinel'?24:20;e.state='pursue';e.lastSeen=now;enemies.push(e);emit(x,y,colors.red,16,2.2);return e;
}
function enterRoom(state,caption,heal=25){
 if(state.entered)return;state.entered=true;hero.hp=Math.min(100,hero.hp+heal);message(caption+' · АВАРИЙНЫЙ РЕМОНТ +'+heal,4);tone(530,.38,'triangle',.04);
}
function updateLastRooms(dt){
 if(!arena.entered&&hero.x>3410&&workshop.clear)enterRoom(arena,'ЛИТЕЙНАЯ АРЕНА · ОСТАНОВИТЕ ПРОИЗВОДСТВО',36);
 if(arena.entered&&!arena.clear){
  if(arena.waveSpawned<6&&now>=arena.waveAt){const i=arena.waveSpawned,p=[[4175,-294],[4140,295],[4020,-315],[4200,80],[4070,315],[4260,-200]][i];stageSpawn(p[0],p[1],20+i,'scrap',27,155);arena.waveSpawned++;arena.waveAt=now+1.25;}
  if(arena.waveSpawned===6&&arena.relays['relay-a']&&arena.relays['relay-b']&&!enemies.some(e=>e.hp>0&&e.kind==='scrap')){
   arena.clear=true;doorState[3].target=1;message('ПРОИЗВОДСТВО ОСТАНОВЛЕНО · ДОСТУП К КОМАНДНОМУ ЦЕНТРУ',4);tone(720,.5,'triangle',.06);
  }
 }
 if(!command.entered&&hero.x>4740&&arena.clear)enterRoom(command,'КОМАНДНЫЙ ЦЕНТР · НАЙДИТЕ ПЕРВОИСТОЧНИК СИГНАЛА',26);
 if(command.hacked&&!command.clear){
  if(command.spawned===0){for(const [i,p] of [[5500,-275],[5440,225],[5350,310]].entries())stageSpawn(p[0],p[1],30+i,'sentinel',36,175);command.spawned=3;}
  if(command.spawned===3&&!enemies.some(e=>e.hp>0&&e.kind==='sentinel')){command.clear=true;doorState[4].target=1;message('ПРОТОКОЛ «ОПЛОТ» В ПАМЯТИ · ОТКРЫТ ОБОРОННЫЙ СЕКТОР',4);tone(850,.5,'triangle',.05);}
 }
 if(!defense.entered&&hero.x>5940&&command.clear)enterRoom(defense,'ОБОРОННОЕ ЯДРО · ЗАЩИТИТЕ ЭНЕРГОБЛОК',30);
 for(const t of defense.heavy){
  if(t.state==='charging'){t.boot-=dt;if(t.boot<=0){t.state='online';tone(650,.3,'triangle',.05);message(t.label.toUpperCase()+' · БОЕВОЙ РЕЖИМ',2.6);}}
  t.shotCd=Math.max(0,t.shotCd-dt);t.flash=Math.max(0,t.flash-dt*7);
  if(t.state!=='online')continue;
  const list=enemies.filter(e=>e.hp>0&&e.kind==='siege'&&dist(e,t)<540&&clearLOS(t.x,t.y,e.x,e.y)).sort((a,b)=>dist(a,t)-dist(b,t));
  if(list.length&&turretAim(t,list[0],dt)&&t.shotCd<=0){
   t.shotCd=.43;t.flash=.2;const a=t.angle;projectiles.push({x:t.x+Math.cos(a)*45,y:t.y+Math.sin(a)*45,vx:Math.cos(a)*890,vy:Math.sin(a)*890,life:.8,damage:19,source:'heavy'});emit(t.x,t.y,colors.amber,8,2.3);tone(160,.12,'sawtooth',.04);
  }
 }
 if(defense.entered&&!defense.clear&&defense.heavy.every(t=>t.state==='online')){
  if(!defense.waveStarted){defense.waveStarted=true;defense.nextAt=now+2.5;message('ОСАДА · ОСТАНОВИТЕ МАШИНЫ, ИДУЩИЕ К ЯДРУ',4);}
  if(defense.spawned<12&&now>=defense.nextAt){const i=defense.spawned,p=[[6970,-330],[6050,335],[6940,340],[6015,-300],[6980,-130],[6070,165],[6910,165],[6025,-145],[6930,-260],[6060,290],[7000,275],[6000,-250]][i];stageSpawn(p[0],p[1],40+i,'siege',48,150);defense.spawned++;defense.nextAt=now+1.04;}
  if(defense.spawned===12&&!enemies.some(e=>e.hp>0&&e.kind==='siege')){defense.clear=true;doorState[5].target=1;message('ЯДРО УДЕРЖАНО · ЭВАКУАЦИОННЫЙ ШЛЮЗ РАЗБЛОКИРОВАН',4.2);tone(870,.6,'triangle',.07);}
 }
 if(!evac.entered&&hero.x>7430&&defense.clear)enterRoom(evac,'ЭВАКУАЦИОННЫЙ ШЛЮЗ · ПЕРЕДАЙТЕ ПОСЛЕДНИЙ СИГНАЛ',25);
 if(evac.launched&&evac.countdown>0){evac.countdown=Math.max(0,evac.countdown-dt);if(Math.random()<dt*28)emit(8030,0,colors.mint,3,3);if(evac.countdown===0)win();}
}
function updateProjectiles(dt){for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0||pointInSolid(p.x,p.y)){emit(p.x,p.y,colors.amber,3,1.5);projectiles.splice(i,1);continue;}
 let hit=false;for(const e of enemies){if(e.hp<=0)continue;if(hypot(e.x-p.x,e.y-p.y)<e.r+4){e.hp=Math.max(0,e.hp-p.damage);e.attackFlash=.38;emit(p.x,p.y,e.hp<=0?colors.amber:colors.red,e.hp<=0?26:7,e.hp<=0?4:2);if(e.hp<=0)tone(260,.22,'triangle',.028);hit=true;break;}}if(hit)projectiles.splice(i,1);}}
function emit(x,y,color,n=6,power=1){for(let i=0;i<n&&particles.length<220;i++){const a=Math.random()*TAU,v=(30+Math.random()*85)*power;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.25+Math.random()*.6,max:.8,color,size:1+Math.random()*3.4});}}
function updateParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.18,dt);p.vy*=Math.pow(.18,dt);p.life-=dt;if(p.life<=0)particles.splice(i,1);}}
function updateDoors(dt){for(const d of doorState){if(d.target>d.open){d.open=Math.min(1,d.open+dt/d.seconds);if(d.open===1&&!d.done){d.done=true;tone(460,.25,'triangle',.05);emit(d.x,d.y,colors.mint,18,2);}}}}
function updateFog(dt){const cell=76,rad=470,xx=Math.floor(hero.x/cell),yy=Math.floor(hero.y/cell),rr=Math.ceil(rad/cell);visibleCells.clear();
 for(let j=yy-rr;j<=yy+rr;j++)for(let i=xx-rr;i<=xx+rr;i++){const x=i*cell+cell/2,y=j*cell+cell/2;if(hypot(x-hero.x,y-hero.y)<rad&&clearLOS(hero.x,hero.y,x,y)){const id=i+':'+j;visibleCells.add(id);exploredCells.add(id);}}}
function update(dt){if(!started||ended||paused)return;now+=dt;elapsed+=dt;toastTimer=Math.max(0,toastTimer-dt);if(toastTimer<=0)$('toast').classList.remove('visible');
 updateHero(dt);updateDoors(dt);updateEnemies(dt);updateTurrets(dt);updateWorkshop(dt);updateLastRooms(dt);updateProjectiles(dt);updateParticles(dt);
 if(Math.floor(now*10)!==Math.floor((now-dt)*10))updateFog(dt);
 updateUI();
}
function updateUI(){
 if(!hero)return;
 const hp=Math.round(hero.hp);
 $('hpValue').textContent=hp+'%';$('hpFill').style.width=hp+'%';$('hpFill').style.background=hp<30?'linear-gradient(90deg,#bb4252,#ffb482)':'linear-gradient(90deg,#51bcad,#b7ffe2)';
 let title,hint;
 if(!generator.online){title='Восстановить питание ремонтного дока';hint='Наведите инженерный луч на резервный генератор. Удерживайте пробел или кнопку «ЛУЧ».';
 }else if(doorState[0].target===0){title='Открыть силовой шлюз';hint='Подлетите к створкам и удерживайте луч для разблокировки.';
 }else if(hero.x<940){title='Найти защитные турели охранного зала';hint='Патруль за шлюзом. Проберитесь вдоль нижнего борта.';
 }else if(turrets.some(t=>t.state==='offline')){title='Активировать обе защитные турели';hint='Пока турель загружается, двигайтесь к следующей. Следите за патрулём.';
 }else if(wave.phase!==3){title='Удержать охранный зал';hint='Маневрируйте возле турелей, избегайте дронов. Луч восстанавливает повреждённые установки.';
 }else if(hero.x<2250){title='Добраться до монтажной мастерской';hint='Восточный шлюз открыт. Через обзорный переход вы попадёте в монтажную мастерскую.';
 }else if(workshop.mountTimer>0){title='Дождаться установки разрядника';hint='Монтажные манипуляторы закрепляют модуль на корпусе. Двигатели временно заблокированы.';
 }else if(!workshop.installed){title='Запустить монтаж первого оружия';hint='Влетите в центр монтажного кольца и удерживайте инженерный луч 1,8 секунды.';
 }else if(!workshop.clear){title='Испытать импульсный разрядник';hint='Оружие стреляет автоматически на расстояние 160. Не подпускайте ремонтных роботов ближе 112.';
 }else if(hero.x<3370){title='Войти в литейную арену';hint='Через производственный шлюз вы попадёте в активный машинный цех.';
 }else if(!arena.clear){title=arena.relays['relay-a']&&arena.relays['relay-b']?'Очистить литейную от машин':'Отключить два литейных стабилизатора';hint='Подлетите к светящимся контурам по краям цеха. Разрядник защитит корабль от роботов.';
 }else if(hero.x<4710){title='Добраться до командного центра';hint='Производственные линии остановлены. Следуйте на восток.';
 }else if(!command.hacked){title='Вскрыть командный терминал';hint='Удерживайте инженерный луч на центральном пульте и получите маршрут «Оплота».';
 }else if(!command.clear){title='Очистить командный центр';hint='Охранные машины пытаются закрыть доступ к расшифрованным данным.';
 }else if(hero.x<5930){title='Перейти в оборонный сектор';hint='Впереди энергетическое ядро. Оно понадобится для передачи сигнала.';
 }else if(!defense.clear){title=defense.heavy.some(t=>t.state==='offline')?'Запустить две тяжёлые турели':'Оборонять энергетическое ядро';hint='Прочность ядра: '+Math.ceil(defense.coreHp)+'/200. Противники бьют по нему — защищайте подходы.';
 }else if(hero.x<7430){title='Добраться до эвакуационного шлюза';hint='Защита выдержала. Восточный проход открылся.';
 }else if(!evac.launched){title='Передать последний сигнал';hint='Активируйте аварийный передатчик инженерным лучом.';
 }else{title='Дождаться эвакуационного канала';hint='Передатчик работает. Дождитесь завершения выхода из станции.';}
 $('objectiveText').textContent=title;$('objectiveHint').textContent=hint;
 const st='СЕТЬ: '+(generator.online?'ПИТАНИЕ В НОРМЕ':'НЕТ ПИТАНИЯ')+'<br>ТУРЕЛИ: '+turrets.filter(t=>t.state==='online').length+'/2'+(alarm?'<br><span style="color:#ff8e99">● ТРЕВОГА</span>':'')+(defense.entered?'<br>ЯДРО: '+Math.ceil(defense.coreHp)+'/200':'');
 if(st!==lastFootnote){$('status').innerHTML=st;lastFootnote=st;}
 const zone=hero.x<700?'Ремонтный док':hero.x<970?'Соединительный шлюз':hero.x<1970?'Охранный зал':hero.x<2250?'Обзорный переход':hero.x<3130?'Монтажная мастерская':hero.x<3400?'Производственный шлюз':hero.x<4380?'Литейная арена':hero.x<4700?'Межцеховой переход':hero.x<5630?'Командный центр':hero.x<5910?'Энергетический коридор':hero.x<7110?'Оборонное ядро':hero.x<7410?'Аварийный тоннель':'Эвакуационный шлюз';
 if(zone!==zoneName){zoneName=zone;$('zoneTitle').textContent=zone;}
 const s=closestDevice();let prompt='';
 if(s){if(['relay','terminal','heavy','evac'].includes(s.kind))prompt='УДЕРЖИВАЙТЕ ЛУЧ · '+s.label.toUpperCase()+' '+Math.round((stageProgress[s.id]||0)*100)+'%';
  else if(s.kind==='armament')prompt='УДЕРЖИВАЙТЕ ЛУЧ · УСТАНОВКА РАЗРЯДНИКА '+Math.round(workshop.progress*100)+'%';
 else if(s.kind==='generator')prompt='УДЕРЖИВАЙТЕ ЛУЧ · ГЕНЕРАТОР '+Math.round(progress.generator*100)+'%';
 else if(s.kind==='door')prompt='УДЕРЖИВАЙТЕ ЛУЧ · ОТКРЫТЬ ШЛЮЗ';
 else if(s.state==='disabled')prompt='УДЕРЖИВАЙТЕ ЛУЧ · ВОССТАНОВИТЬ ТУРЕЛЬ';
 else if(s.state==='offline')prompt='УДЕРЖИВАЙТЕ ЛУЧ · '+s.label.toUpperCase()+' '+Math.round(s.progress*100)+'%';
 else if(s.hp<125)prompt='УДЕРЖИВАЙТЕ ЛУЧ · РЕМОНТ';}
 $('prompt').textContent=prompt;$('prompt').classList.toggle('visible',!!prompt);
}
function win(){ended=true;started=false;$('endingKicker').textContent='Пролог · миссия 00 завершена';$('endingTitle').textContent='Последний сигнал передан';$('endingDescription').textContent='Станция «Нуль» ожила на несколько минут. Вы восстановили её питание, развернули защитные турели, установили первый разрядник, остановили литейную, расшифровали протокол «Оплот», удержали энергетическое ядро и передали координаты выхода. Впереди — первая миссия кампании.';$('ending').style.display='flex';tone(660,.45,'sine',.06);}
function lose(){ended=true;started=false;$('endingKicker').textContent=defense.coreHp<=0?'Энергетическое ядро потеряно':'Корпус разрушен';$('endingTitle').textContent='Попытка не удалась';$('endingDescription').textContent=defense.coreHp<=0?'Осада прорвала защиту ядра. Восстановите тяжёлые турели и перехватывайте машины на подходе к энергоблоку.':'Попробуйте заранее включать защитные установки, двигаться вдоль укрытий и держать ремонтных роботов за пределами радиуса их удара. Пролог можно повторить без потери прогресса основной кампании.';$('ending').style.display='flex';}
function resize(){w=Math.max(1,window.innerWidth);h=Math.max(1,window.innerHeight);dpr=Math.min(window.devicePixelRatio||1,w<780?1.45:1.7);canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);scale=w<700?.78:w<1050?.88:1;fogCanvas.width=Math.min(1450,Math.ceil(w));fogCanvas.height=Math.min(900,Math.ceil(h));}
window.addEventListener('resize',resize);resize();
function atlasSprite(index,x,y,width,height,angle=0,alpha=1){if(!atlas.complete||!atlas.naturalWidth)return;
 const sx=(index%COLS)*CELL,sy=Math.floor(index/COLS)*CELL;
 ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(atlas,sx,sy,CELL,CELL,-width/2,-height/2,width,height);ctx.restore();}
function rect(x,y,w0,h0,color){ctx.fillStyle=color;ctx.fillRect(x,y,w0,h0);}
function line(x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function ring(x,y,r,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();}
function light(x,y,r,color,opacity=.4){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,hexRGBA(color,opacity));g.addColorStop(1,hexRGBA(color,0));ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
function hexRGBA(hex,a){const n=parseInt(hex.slice(1),16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';}
function roundedBox(x,y,w0,h0,r0=10){ctx.beginPath();ctx.roundRect(x,y,w0,h0,r0);}
function visibleBox(x,y,ww,hh,pad=155){const vx=w/(2*scale)+pad,vy=h/(2*scale)+pad;return x<=camera.x+vx&&x+ww>=camera.x-vx&&y<=camera.y+vy&&y+hh>=camera.y-vy;}
function drawRoom(room){const{x,y,w:rw,h:rh}=room;
 ctx.save();ctx.shadowColor='#000';ctx.shadowBlur=60;rect(x-18,y-18,rw+36,rh+36,'#020912');ctx.restore();
 rect(x,y,rw,rh,'#233744');
 ctx.save();ctx.beginPath();ctx.rect(x,y,rw,rh);ctx.clip();ctx.globalAlpha=.84;ctx.drawImage(floor,x,y,rw,rh);ctx.globalAlpha=1;
 // Frosted light pools and service tracks are baked-feeling, restrained geometry.
 const l=ctx.createLinearGradient(x,y,x,y+rh);l.addColorStop(0,'#06121ca8');l.addColorStop(.45,'#395a6528');l.addColorStop(1,'#020c16b8');rect(x,y,rw,rh,l);
 for(let n=0;n<3;n++){const yy=y+62+n*(rh-124)/2;rect(x+18,yy,rw-36,4,'#8ca6b51b');rect(x+18,yy+6,rw-36,1,'#010910ad');}
 for(let xx=x+95;xx<x+rw-20;xx+=185){rect(xx,y+18,3,rh-36,'#08142155');rect(xx+4,y+18,1,rh-36,'#aad1e21a');}
 ctx.restore();
 const rail=22;for(const side of ['top','bottom']){
 const yy=side==='top'?y-rail:y+rh;
 rect(x-22,yy,rw+44,rail,'#172936');rect(x-15,yy+5,rw+30,5,'#587c8980');rect(x-12,yy+13,rw+24,3,'#0a141fe0');
 for(let xx=x+36;xx<x+rw;xx+=118){rect(xx,yy+2,50,4,'#425b6cb0');rect(xx+9,yy+9,6,6,'#a9cad338');}
 }
 for(const side of ['left','right']){const xx=side==='left'?x-22:x+rw;rect(xx,y-24,22,rh+48,'#142631');rect(xx+4,y+10,5,rh-20,'#5778877d');for(let yy=y+50;yy<y+rh-35;yy+=130){rect(xx+4,yy,15,14,'#536c7791');}}
 for(let xx=x+52;xx<x+rw-45;xx+=166){light(xx,y+27,92,room.id==='dock'?colors.cyan:colors.mint,.1);rect(xx-23,y+5,46,7,'#24414e');rect(xx-14,y+7,28,3,room.id==='dock'?'#8aceef':'#76e2b7');}
 for(let yy=y+52;yy<y+rh-20;yy+=140){rect(x+4,yy,7,33,'#ecc97a95');rect(x+rw-12,yy,7,33,room.id==='security'?'#ea977caa':'#a1d8e4a5');}
}
function drawHall(r){rect(r.x-20,r.y-20,r.w+40,r.h+40,'#050e17');
 ctx.save();ctx.beginPath();ctx.rect(r.x,r.y,r.w,r.h);ctx.clip();ctx.globalAlpha=.85;ctx.drawImage(floor,r.x,r.y,r.w,r.h);ctx.globalAlpha=1;rect(r.x,r.y,r.w,r.h,'#10273644');ctx.restore();
 for(const yy of [r.y-20,r.y+r.h]){rect(r.x-6,yy,r.w+12,20,'#152a35');rect(r.x,yy+5,r.w,4,'#5b778287');for(let xx=r.x+32;xx<r.x+r.w-20;xx+=105){rect(xx,yy+9,30,3,'#b4cbd342');}}
 for(let xx=r.x+45;xx<r.x+r.w;xx+=145){rect(xx,r.y+r.h/2-2,14,4,'#bad5d330');}
}

function bakeSky(){
 const c=skyCtx,W=720,H=360;
 const bg=c.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#08152c');bg.addColorStop(.5,'#38224e');bg.addColorStop(1,'#101c3a');c.fillStyle=bg;c.fillRect(0,0,W,H);
 for(const [x,y,r,color,a] of [[110,215,210,'#9656b4',.48],[340,120,230,'#d47b9d',.3],[610,270,230,'#375bac',.38]]){
 const g=c.createRadialGradient(x,y,1,x,y,r);g.addColorStop(0,hexRGBA(color,a));g.addColorStop(.6,hexRGBA(color,a*.32));g.addColorStop(1,hexRGBA(color,0));c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
 let seed=27419;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 for(let i=0;i<170;i++){c.globalAlpha=.2+rnd()*.75;c.fillStyle=i%8?'#d4e6ff':'#ffd8e0';const x=rnd()*W,y=rnd()*H,s=rnd()>.94?1.8:.75;c.fillRect(x,y,s,s);}c.globalAlpha=1;
}
function drawStellarWindow(){
 const x=1926,y=-320,W=300,H=182;
 if(!visibleBox(x-70,y-70,W+140,H+320))return;
 // The panoramic glass is outside navigable space. Sunlight and window-frame shadows fall onto the corridor floor.
 ctx.save();
 const lightGrad=ctx.createLinearGradient(0,y+H,0,110);lightGrad.addColorStop(0,'#ffd28c50');lightGrad.addColorStop(.5,'#f3a36319');lightGrad.addColorStop(1,'#ffb97d00');
 ctx.beginPath();ctx.moveTo(x+24,y+H);ctx.lineTo(x+W-6,y+H);ctx.lineTo(x+W+64,110);ctx.lineTo(x+110,110);ctx.closePath();ctx.fillStyle=lightGrad;ctx.fill();
 for(const bx of [x+74,x+W-61]){const shadow=ctx.createLinearGradient(0,y+H,0,110);shadow.addColorStop(0,'#090e1999');shadow.addColorStop(1,'#090e1900');ctx.fillStyle=shadow;
  ctx.beginPath();ctx.moveTo(bx-7,y+H);ctx.lineTo(bx+7,y+H);ctx.lineTo(bx+75,110);ctx.lineTo(bx+45,110);ctx.closePath();ctx.fill();}
 ctx.restore();
 ctx.save();ctx.shadowColor='#000e';ctx.shadowBlur=28;roundedBox(x-21,y-21,W+42,H+42,25);ctx.fillStyle='#091824';ctx.fill();ctx.restore();
 ctx.save();roundedBox(x,y,W,H,15);ctx.clip();ctx.drawImage(skyCanvas,0,0,720,360,x,y,W,H);
 const cx=x+210,cy=y+90,r=54*(1+.025*Math.sin(now*1.2));
 const glow=ctx.createRadialGradient(cx,cy,12,cx,cy,120);glow.addColorStop(0,'#fffad6ef');glow.addColorStop(.45,'#ffca72cc');glow.addColorStop(.75,'#fa965a78');glow.addColorStop(1,'#fd742b00');ctx.fillStyle=glow;ctx.fillRect(cx-120,cy-120,240,240);
 const core=ctx.createRadialGradient(cx-12,cy-14,1,cx,cy,r);core.addColorStop(0,'#fffce8');core.addColorStop(.4,'#fff1a5');core.addColorStop(.8,'#ffad55');core.addColorStop(1,'#c95837');
 ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);ctx.clip();ctx.fillStyle=core;ctx.fillRect(cx-60,cy-60,120,120);
 ctx.translate(cx,cy);ctx.rotate(now*.046);
 for(const [sx,sy,rx,ry] of [[-16,-20,7,4],[23,7,12,6],[-4,25,5,3],[5,-6,6,4]]){ctx.save();ctx.translate(sx,sy);ctx.rotate(.3);ctx.fillStyle='#b06248b8';ctx.beginPath();ctx.ellipse(0,0,rx+3,ry+2,0,0,TAU);ctx.fill();ctx.fillStyle='#6a342eaa';ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,TAU);ctx.fill();ctx.restore();}
 ctx.restore();ctx.restore();
 ctx.save();roundedBox(x-13,y-13,W+26,H+26,20);ctx.strokeStyle='#7896a4';ctx.lineWidth=15;ctx.stroke();roundedBox(x-5,y-5,W+10,H+10,16);ctx.strokeStyle='#c6d9de99';ctx.lineWidth=2;ctx.stroke();
 for(const bx of [x+74,x+W-61]){rect(bx-7,y-4,14,H+8,'#1c303d');rect(bx-4,y,3,H,'#b1c3c68c');}
 for(let i=0;i<11;i++)rect(x+12+i*27,y+H+13,8,3,'#b4beb888');
 ctx.textAlign='left';ctx.font='600 10px system-ui';ctx.fillStyle='#cedbe1';ctx.fillText('ОБЗОРНЫЙ МОДУЛЬ · ЗВЁЗДНЫЙ СЕКТОР',x+1,y-30);ctx.restore();
 light(x+W*.65,y+H,165,'#ffba70',.14+.025*Math.sin(now*2));
}
function drawFloor(){const grad=ctx.createRadialGradient(1100,0,400,1100,0,2800);grad.addColorStop(0,'#102236');grad.addColorStop(1,'#020710');rect(-1000,-1500,10400,3000,grad);
 for(const r of HALLS)if(visibleBox(r.x,r.y,r.w,r.h))drawHall(r);
 for(const r of ROOMS)if(visibleBox(r.x,r.y,r.w,r.h))drawRoom(r);
 drawStellarWindow();
 // Dock-only physical set dressing; keep free flight lanes clear.
 for(const x of [-465,348]){ctx.save();ctx.shadowColor='#000e';ctx.shadowBlur=21;rect(x,-335,130,60,'#203641');ctx.restore();rect(x+7,-321,116,21,'#395362');rect(x+20,-315,37,10,'#6f8b98');rect(x+76,-315,22,10,'#d1ae6580');}
 for(const x of [-410,350]){line(x,315,x+115,315,'#6b97a68a',4);line(x,327,x+115,327,'#11222e',8);for(let k=0;k<3;k++)rect(x+k*42,303,17,9,'#7499a747');}
 // Repair cradle and hollow machinery silhouettes.
 ring(0,95,108,'#8ca8b84c',10);ring(0,95,87,'#2b5265',5);for(let a=0;a<TAU;a+=Math.PI/3){const x=Math.cos(a)*111,y=95+Math.sin(a)*111;rect(x-10,y-14,20,28,'#65859296');}
 for(const cover of COVERS)if(visibleBox(cover.x-cover.w/2,cover.y-cover.h/2,cover.w,cover.h))drawCover(cover);
 if(visibleBox(2240,-345,900,690))drawWorkshop();
 drawAdvancedRooms();
 for(const x of [1030,1860]){for(const yy of [-365,325]){rect(x,yy,65,35,'#253945');rect(x+6,yy+5,53,6,'#63889d');rect(x+17,yy+18,30,5,'#c2b08f66');}}
 // Directional wear marks and soft electrical signage.
 light(-165,-195,240,generator.online?colors.mint:colors.cyan,generator.online?.18:.06);
}
function drawWorkshop(){
 const x=2690,y=0;
 // Fixed heavy installation bay: diamond-cut rails, hydraulic power bars, diagnostic rings.
 ctx.save();ctx.shadowColor='#03070b';ctx.shadowBlur=30;ring(x,y,160,'#091823',24);ctx.restore();
 ring(x,y,152,'#5b8590',10);ring(x,y,125,'#a1bac056',4);ring(x,y,104,'#182f3c',15);
 for(let a=0;a<TAU;a+=Math.PI/8){const ca=Math.cos(a),sa=Math.sin(a);line(x+ca*132,y+sa*132,x+ca*154,y+sa*154,'#cad8cc80',4);}
 for(const edge of [-1,1]){
  const xx=x+edge*330;atlasSprite(art.reactor,xx,y-230,130,130,edge<0?0:Math.PI,.85);
  light(xx,y-230,160,colors.cyan,.12);
  for(const yy of [-200,180]){ctx.save();ctx.shadowColor='#000';ctx.shadowBlur=18;roundedBox(xx-37,yy,74,28,5);ctx.fillStyle='#2a4450';ctx.fill();ctx.restore();rect(xx-27,yy+7,54,5,'#93baca70');rect(xx-20,yy+17,40,2,'#03121c');}
 }
 for(const yy of [-315,306]){rect(2400,yy,580,9,'#365765');rect(2412,yy+3,556,2,'#e0c68e57');
  for(let xx=2450;xx<3000;xx+=80){rect(xx,yy+1,30,6,workshop.installed?'#5be8b77a':'#6f8f9d7b');}}
 for(const xx of [2400,3040])for(const yy of [-250,215]){rect(xx-25,yy-22,50,44,'#172b3a');rect(xx-17,yy-15,34,29,'#2d5363');rect(xx-12,yy-8,24,5,workshop.mountTimer>0?colors.amber:'#8eb2ba9c');}
 drawWorkshopArms(false);
}
function drawWorkshopArms(foreground){
 if(!visibleBox(2470,-220,440,440))return;
 const x=2690,y=0,engaged=workshop.mountTimer>0;
 const reach=engaged?clamp(1-workshop.mountTimer/3.4,0,1):workshop.installed?.13:0;
 if(foreground!==engaged)return;
 for(let k=0;k<3;k++){
  const a=-Math.PI/2+k*TAU/3,ca=Math.cos(a),sa=Math.sin(a),px=-sa,py=ca;
  const base={x:x+ca*164,y:y+sa*164};
  const elbow={x:x+ca*(114-8*reach)+px*(10*Math.sin(now*1.7+k)),y:y+sa*(114-8*reach)+py*(10*Math.sin(now*1.7+k))};
  const tip={x:x+ca*(80-57*reach)+px*(3*Math.sin(now*3+k)),y:y+sa*(80-57*reach)+py*(3*Math.sin(now*3+k))};
  ctx.save();ctx.shadowColor='#000';ctx.shadowBlur=15;
  line(base.x,base.y,elbow.x,elbow.y,'#111f2b',23);line(elbow.x,elbow.y,tip.x,tip.y,'#111f2b',16);
  ctx.restore();
  line(base.x,base.y,elbow.x,elbow.y,'#647f8f',14);line(elbow.x,elbow.y,tip.x,tip.y,'#b7c7c2',9);
  line(base.x+px*3,base.y+py*3,elbow.x+px*3,elbow.y+py*3,'#bed8d2b0',3);
  ring(base.x,base.y,17,'#7898a5',6);ring(elbow.x,elbow.y,13,engaged?colors.amber:'#506d7a',5);
  ring(tip.x,tip.y,8,engaged?colors.mint:'#84a3a6',4);
  if(engaged&&Math.random()<.12){light(tip.x,tip.y,42,colors.mint,.3);emit(tip.x,tip.y,colors.amber,1,1.6);}
 }
}

function drawAdvancedRooms(){
 if(visibleBox(3350,-430,1030,860)){
  // Conveyor plinths, forged ribs and heat bloom: the furnace is a solid central obstruction.
  for(const y of [-302,302]){rect(3435,y,855,38,'#11212a');rect(3435,y+4,855,3,'#819cab88');
   for(let x=3460;x<4260;x+=62){const off=(now*21)%62;rect(x+off-54,y+10,34,16,'#405362');rect(x+off-48,y+14,18,3,'#9cb7c477');}}
  for(const xx of [3450,4280])for(const yy of [-350,330]){atlasSprite(art.reactor,xx,yy,112,112,now*.09,.65);light(xx,yy,120,colors.amber,.12);}
  const active=!(arena.relays['relay-a']&&arena.relays['relay-b']),heat=active?(.15+.05*Math.sin(now*3)):.03;
  light(3840,0,245,'#ff8444',heat);ring(3840,0,128,'#8c6752a0',10);ring(3840,0,107,'#e49a617a',4);
  ctx.save();ctx.translate(3840,0);ctx.rotate(now*(active?.24:.035));for(let a=0;a<TAU;a+=Math.PI/4){line(Math.cos(a)*91,Math.sin(a)*91,Math.cos(a)*122,Math.sin(a)*122,'#e5aa7f88',7);}ctx.restore();
  for(const xx of [3490,4300]){rect(xx,-180,7,360,'#4d74817b');rect(xx+4,-130,2,260,'#d7a86a55');}
  ctx.save();ctx.font='700 18px system-ui';ctx.textAlign='center';ctx.fillStyle='#f7c98e';ctx.fillText('ЛИТЕЙНЫЙ КОНТУР · 04',3850,-372);ctx.restore();
 }
 if(visibleBox(4700,-375,930,750)){
  for(const yy of [-290,285]){rect(4790,yy,750,10,'#365360');for(let xx=4815;xx<5485;xx+=85){rect(xx,yy+2,47,4,'#82c3c47a');}}
  for(const xx of [4800,5540])for(const yy of [-265,230]){atlasSprite(art.reactor,xx,yy,90,90,now*.12,.48);light(xx,yy,85,colors.cyan,.11);}
  const x=5160,y=-60,r=185;light(x,y,240,colors.cyan,.12);
  ring(x,y,r,'#47798a87',6);ring(x,y,r-25,'#78bed07b',3);ring(x,y,r-57,'#47798a65',2);
  ctx.save();ctx.translate(x,y);ctx.rotate(now*.08);
  for(let i=0;i<13;i++){const a=i*TAU/13,rr=85+(i%3)*25,b=i*TAU/13+1.1;line(Math.cos(a)*rr,Math.sin(a)*rr,Math.cos(b)*(rr+36),Math.sin(b)*(rr+36),'#6bcfdb5e',1.7);}
  for(const a of [0,.9,2.2,3.9,5.1]){const xx=Math.cos(a)*145,yy=Math.sin(a)*145;ring(xx,yy,5,colors.cyan,2);light(xx,yy,26,colors.cyan,.32);}
  ctx.restore();
  const sweep=now*.7%TAU;line(x,y,x+Math.cos(sweep)*170,y+Math.sin(sweep)*170,command.hacked?'#60f3b099':'#72dce99a',2);
  ctx.font='700 15px system-ui';ctx.textAlign='center';ctx.fillStyle='#bfe6eb';ctx.fillText('СЕТЬ «ОПЛОТ» · ЦЕНТР УПРАВЛЕНИЯ',5160,-330);
 }
 if(visibleBox(5910,-465,1200,930)){
  for(const yy of [-380,380]){rect(6000,yy,1020,14,'#355361');rect(6020,yy+4,980,3,'#d6c69766');
   for(let xx=6025;xx<6950;xx+=80){rect(xx,yy+6,37,5,defense.entered?'#81ffb9a3':'#65879c65');}}
  const x=6540,y=0,p=clamp(defense.coreHp/200,0,1),phase=now*(defense.clear?.3:1.4);
  light(x,y,240,p>.33?colors.cyan:colors.red,.18);ring(x,y,157,'#5b899b91',13);ring(x,y,132,'#9fd6dc79',5);ring(x,y,105,'#193443',12);
  atlasSprite(art.reactor,x,y,190,190,now*.14,.98);
  ctx.save();ctx.translate(x,y);ctx.rotate(phase);for(let i=0;i<12;i++){const a=i*TAU/12;line(Math.cos(a)*117,Math.sin(a)*117,Math.cos(a)*148,Math.sin(a)*148,p>.3?colors.mint:colors.red,5);}
  ctx.restore();ctx.beginPath();ctx.strokeStyle=p>.33?colors.mint:colors.red;ctx.lineWidth=9;ctx.arc(x,y,170,-Math.PI/2,-Math.PI/2+TAU*p);ctx.stroke();
  for(const xx of [6090,7000]){rect(xx-20,-230,40,470,'#203a48');rect(xx-11,-220,22,450,'#50788660');}
  ctx.textAlign='center';ctx.font='700 17px system-ui';ctx.fillStyle='#b7e5ef';ctx.fillText('ОРБИТАЛЬНОЕ ЭНЕРГОЯДРО',6540,-407);
 }
 if(visibleBox(7410,-360,900,720)){
  const x=8030,y=0,open=evac.launched,pulse=.5+.5*Math.sin(now*2.6);
  for(const yy of [-280,270]){rect(7550,yy,605,13,'#345564');rect(7570,yy+3,560,3,'#87dfc480');}
  light(x,y,240,open?'#b9a2ff':colors.cyan,open?.28:.12);
  ring(x,y,148,'#476e82aa',15);ring(x,y,126,open?'#b1bfff':colors.cyan,6);ring(x,y,96,'#5b849882',12);
  ctx.save();ctx.translate(x,y);ctx.rotate(now*(open?1.2:.16));
  for(let i=0;i<10;i++){const a=i*TAU/10;line(Math.cos(a)*112,Math.sin(a)*112,Math.cos(a+.19)*136,Math.sin(a+.19)*136,open?'#d8c5ff':'#5ce3d1',5);}
  ctx.restore();
  const disk=ctx.createRadialGradient(x,y,4,x,y,87);disk.addColorStop(0,open?'#fff9e7':'#68c7d566');disk.addColorStop(.6,open?'#aab1ffd8':'#27465db3');disk.addColorStop(1,'#0b1a2c00');ctx.fillStyle=disk;ctx.beginPath();ctx.arc(x,y,87+pulse*2,0,TAU);ctx.fill();
  for(const xx of [7560,8280])for(const yy of [-260,235]){rect(xx-26,yy,52,27,'#172a38');rect(xx-18,yy+7,36,5,open?colors.mint:'#648a9b');}
  ctx.textAlign='center';ctx.font='700 18px system-ui';ctx.fillStyle='#c6f8e9';ctx.fillText('АВАРИЙНЫЙ КАНАЛ ЭВАКУАЦИИ',8000,-307);
 }
}
function drawStageDevices(){
 for(const s of STATIONS){if(!['relay','terminal','evac'].includes(s.kind)||!visibleBox(s.x-100,s.y-100,200,200))continue;
  const active=s.kind==='relay'?arena.relays[s.id]:s.kind==='terminal'?command.hacked:evac.launched;
  const p=stageProgress[s.id]||0,col=active?colors.mint:s.kind==='relay'?colors.amber:colors.cyan;
  ctx.save();ctx.shadowColor='#000a';ctx.shadowBlur=24;ring(s.x,s.y,59,'#101c28',16);ctx.restore();
  atlasSprite(art.reactor,s.x,s.y,s.kind==='terminal'?95:79,s.kind==='terminal'?95:79,now*.08,.86);
  light(s.x,s.y,90,col,active?.21:.11);ring(s.x,s.y,52,col,3);
  if(p>0){ctx.beginPath();ctx.strokeStyle=colors.mint;ctx.lineWidth=6;ctx.arc(s.x,s.y,66,-Math.PI/2,-Math.PI/2+TAU*p);ctx.stroke();}
 }
 for(const t of defense.heavy){if(!visibleBox(t.x-100,t.y-100,200,200))continue;
  ctx.save();ctx.shadowColor='#07101b';ctx.shadowBlur=28;ring(t.x,t.y,66,'#132a3b',20);ctx.restore();
  ring(t.x,t.y,56,t.state==='online'?colors.mint:colors.amber,5);
  atlasSprite(t.flash>0?art.turretFiring:art.turret,t.x,t.y,119,119,t.angle,t.state==='online'?1:.66);
  if(t.flash>0){const fx=t.x+Math.cos(t.angle)*54,fy=t.y+Math.sin(t.angle)*54;light(fx,fy,95,colors.amber,.31);}
  if((stageProgress[t.id]||0)>0){ctx.beginPath();ctx.strokeStyle=colors.mint;ctx.lineWidth=5;ctx.arc(t.x,t.y,73,-Math.PI/2,-Math.PI/2+TAU*stageProgress[t.id]);ctx.stroke();}
 }
}
function drawCover(o){
 const x=o.x-o.w/2,y=o.y-o.h/2;
 ctx.save();ctx.shadowColor='#000';ctx.shadowBlur=28;ctx.shadowOffsetY=14;roundedBox(x,y,o.w,o.h,13);ctx.fillStyle='#081622';ctx.fill();ctx.restore();
 const g=ctx.createLinearGradient(x,y,x+o.w,y+o.h);g.addColorStop(0,'#7895a1');g.addColorStop(.12,'#294450');g.addColorStop(.8,'#182e3b');g.addColorStop(1,'#4f7482');roundedBox(x,y,o.w,o.h,12);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#9fb5b64c';ctx.lineWidth=3;ctx.stroke();
 roundedBox(x+17,y+17,o.w-34,o.h-34,7);ctx.fillStyle='#142a36';ctx.fill();ctx.strokeStyle='#446576';ctx.stroke();
 for(let a=23;a<o.w-25;a+=28){line(x+a,y+27,x+a,y+o.h-28,'#4b6a76',3);line(x+a+3,y+27,x+a+3,y+o.h-28,'#08131d',2);}
 for(const ox of [16,o.w-16])for(const oy of [15,o.h-15]){ring(x+ox,y+oy,5,'#a0b4b9',2);rect(x+ox-2,y+oy-2,4,4,'#152732');}
 rect(x+o.w/2-21,y+8,42,5,'#ffbb7288');
}
function drawDoor(d){
 if(!visibleBox(d.x-85,d.y-d.width/2-60,170,d.width+120))return;
 const open=d.open,span=d.width,px=d.x,py=d.y,half=(span/2)*(1-open);
 ctx.save();ctx.translate(px,py);
 rect(-32,-span/2-26,64,span+52,'#102433');rect(-23,-span/2-20,46,span+40,'#587689a1');
 const halo=open>.7?colors.mint:generator.online&&d.id==='dock'?colors.amber:colors.red;
 light(0,0,span*.9,halo,.12);
 for(const side of [-1,1]){const top=side<0?-span/2:span/2-half;
 const grad=ctx.createLinearGradient(-16,0,22,0);grad.addColorStop(0,'#101d29');grad.addColorStop(.3,'#618295');grad.addColorStop(.52,'#263f50');grad.addColorStop(1,'#0c1c2a');
 const yy=side<0?top:top;
 if(half>0.1){ctx.save();ctx.shadowColor='#000';ctx.shadowBlur=17;rect(-22,yy,44,half,grad);ctx.restore();rect(-15,yy+5,30,Math.max(0,half-10),'#3e627766');for(let m=12;m<half-8;m+=24)rect(-12,yy+m,24,3,'#99b6c36c');}
 }
 for(const yy of [-span/2-36,span/2+24]){rect(-24,yy,48,12,'#152c3a');rect(-13,yy+3,26,5,halo);}
 ctx.restore();
}
function drawDevice(s,kind,progressValue,online){
 if(!visibleBox(s.x-85,s.y-85,170,170))return;
 const pulse=.5+.5*Math.sin(now*4+s.x*.02),color=online?colors.mint:colors.amber;
 ctx.save();ctx.shadowBlur=22;ctx.shadowColor='#000';ring(s.x,s.y,kind==='generator'?53:39,'#04131f',15);ctx.restore();
 ring(s.x,s.y,kind==='generator'?50:37,'#425d67',4);
 if(kind==='generator'){
 atlasSprite(art.generator,s.x,s.y,107,107,Math.PI*.5,.96);
 ctx.save();ctx.translate(s.x,s.y);ctx.rotate(now*(online?.55:.12));for(let a=0;a<TAU;a+=Math.PI/3){line(Math.cos(a)*37,Math.sin(a)*37,Math.cos(a+.18)*42,Math.sin(a+.18)*42,'#8eb3b8',4);}ctx.restore();
 light(s.x,s.y,105,online?colors.mint:colors.cyan,online?.26:.1);ring(s.x,s.y,24,online?colors.mint:'#b4d4ec',3);
 }else if(kind==='armament'){
 light(s.x,s.y,95,workshop.installed?colors.mint:colors.cyan,workshop.installed?.22:.09);
 ring(s.x,s.y,52,workshop.installed?colors.mint:'#78a6b5',3);
 ctx.save();ctx.translate(s.x,s.y);ctx.rotate(now*(workshop.mountTimer>0?1.4:.18));for(let a=0;a<TAU;a+=Math.PI/2){rect(Math.cos(a)*47-7,Math.sin(a)*47-4,14,8,workshop.mountTimer>0?colors.amber:'#688997');}ctx.restore();
 }else{
 const t=turrets.find(t=>t.id===s.id);if(!t)return;
 atlasSprite(t.flash>0?art.turretFiring:art.turret,t.x,t.y,87,87,t.angle,t.state==='disabled'?.45:1);
 if(t.state==='charging'){light(s.x,s.y,105,colors.amber,.17);ring(s.x,s.y,44,colors.amber,2);const arc=1-Math.max(0,t.boot/3.6);ctx.beginPath();ctx.strokeStyle=colors.mint;ctx.lineWidth=5;ctx.arc(s.x,s.y,45,-Math.PI/2,-Math.PI/2+TAU*arc);ctx.stroke();}
 if(t.flash>0){const x=s.x+Math.cos(t.angle)*42,y=s.y+Math.sin(t.angle)*42;light(x,y,85,colors.amber,.3);ring(x,y,10+10*t.flash,colors.amber,3);}
 if(t.state==='online'){light(s.x,s.y,94,colors.mint,.11);ring(s.x,s.y,40,colors.mint,1.2);}
 if(t.state==='disabled')ring(s.x,s.y,49,colors.red,3);
 }
 if(!online&&progressValue>0){ctx.beginPath();ctx.arc(s.x,s.y,kind==='generator'?64:48,-Math.PI/2,-Math.PI/2+TAU*progressValue);ctx.strokeStyle=colors.mint;ctx.lineWidth=5;ctx.stroke();}
 const r=kind==='generator'?55:43;ctx.globalAlpha=.95;rect(s.x-r/2,s.y+r+4,r,3,online?'#4ee6b5':'#536775');
 ctx.restore();
}
function drawHatch(x,y,n){if(!visibleBox(x-70,y-50,140,100))return;const glow=.5+.5*Math.sin(now*3+n);rect(x-38,y-17,75,34,'#172934');rect(x-31,y-10,62,20,'#080e18');rect(x-26,y-14,52,3,glow>.7?'#ff748e':'#87515d');for(let k=0;k<4;k++)rect(x-24+k*15,y-5,10,5,'#40515e');}
function drawEnemy(e){
 if(e.hp<=0||!visibleBox(e.x-60,e.y-60,120,120))return;ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle);
 if(e.kind==='repair'){ctx.save();ctx.shadowColor=colors.amber;ctx.shadowBlur=13;ring(0,0,29,'#567f86',3);for(let k=0;k<4;k++){const a=now*3+k*Math.PI/2;line(Math.cos(a)*20,Math.sin(a)*20,Math.cos(a)*37,Math.sin(a)*37,'#e6b17e',4);}ctx.restore();}
 const wobble=Math.sin(now*4+e.id)*2;ctx.save();ctx.shadowColor='#fb5f74';ctx.shadowBlur=e.attackFlash>0?18:3;atlasSprite(art.enemy,0,wobble,e.kind==='siege'?85:65,e.kind==='siege'?85:65,0,e.attackFlash>0?.95:1);ctx.restore();
 if(e.kind==='scrap'){ctx.save();ctx.rotate(now*2.5+e.id);for(let a=0;a<TAU;a+=TAU/4){line(Math.cos(a)*25,Math.sin(a)*25,Math.cos(a)*37,Math.sin(a)*37,'#e7b084',6);ring(Math.cos(a)*37,Math.sin(a)*37,5,colors.amber,2);}ctx.restore();}
 if(e.kind==='sentinel'){ring(0,0,36,'#8a8ff4c0',4);for(let a=0;a<TAU;a+=TAU/6)line(Math.cos(a)*35,Math.sin(a)*35,Math.cos(a+.3)*42,Math.sin(a+.3)*42,'#bfbcff',3);}
 if(e.kind==='siege'){ring(0,0,42,'#a7686ea9',7);for(const side of [-1,1]){rect(-28,side*20-9,56,12,'#6c7586');rect(-20,side*20-5,40,3,'#e69b8b');}ring(0,0,15,colors.red,4);}
 if(e.state==='pursue'){ring(0,0,31,colors.red,1.5);}else if(e.state==='investigate'){ring(0,0,33,'#dfa05d',1);}
 ctx.restore();if(e.kind==='siege'&&e.attackFlash>0){ctx.save();ctx.shadowColor=colors.red;ctx.shadowBlur=19;line(e.x,e.y,6540,0,'#ff8d9eaa',4);ctx.restore();}light(e.x,e.y,65,e.state==='pursue'?colors.red:colors.amber,.10);
 if(e.hp<e.max){rect(e.x-21,e.y-38,42,4,'#101720');rect(e.x-21,e.y-38,42*(e.hp/e.max),4,colors.red);}
}
function drawShip(){
 const r=hero.inv>0?.7+.3*Math.sin(now*55):1;
 ctx.save();ctx.translate(hero.x,hero.y);ctx.rotate(hero.angle+Math.PI*.5);
 ctx.save();ctx.shadowColor='#000';ctx.shadowBlur=20;ctx.shadowOffsetY=13;ring(0,0,29,'#01101b',8);ctx.restore();
 light(0,18,59,colors.cyan,.23);
 if(hypot(hero.vx,hero.vy)>15){ctx.globalAlpha=.2+.2*Math.random();ctx.fillStyle=colors.mint;ctx.beginPath();ctx.moveTo(-12,26);ctx.lineTo(0,34+Math.random()*18);ctx.lineTo(12,26);ctx.fill();}
 if(!hybrid3d?.ready){ctx.globalAlpha=r;atlasSprite(art.ship,0,0,88,88,0);ctx.globalAlpha=1;}
 if(workshop.installed&&!hybrid3d?.ready){ctx.save();ctx.shadowColor=colors.mint;ctx.shadowBlur=11;atlasSprite(art.turret,0,-21,34,34,0,.88);rect(-3,-33,6,13,'#97ffe1');ctx.restore();}
 ring(0,0,42,colors.mint,1);ctx.restore();
 if(hitFlash>0)light(hero.x,hero.y,90,colors.red,hitFlash*.15);
}
function drawBeam(){const hold=keys.has('Space')||input.beam||input.interact,s=closestDevice();if(!hold||!s||!started)return;
 ctx.save();ctx.lineCap='round';ctx.shadowColor=colors.mint;ctx.shadowBlur=24;const a=Math.sin(now*80)*2;
 line(hero.x,hero.y,s.x,s.y,'#56ebad55',12);line(hero.x,hero.y,s.x,s.y,'#c9ffe4',3+a*.12);
 for(let k=0;k<3;k++){const t=(now*1.6+k/3)%1;ring(lerp(hero.x,s.x,t),lerp(hero.y,s.y,t),2.2,colors.mint,2);}ctx.restore();
}
function drawShots(){for(const b of projectiles){ctx.save();ctx.shadowColor=b.source==='player'?colors.mint:colors.amber;ctx.shadowBlur=13;line(b.x-b.vx*.015,b.y-b.vy*.015,b.x,b.y,b.source==='player'?'#b7ffe5':'#ffe1ad',4);ctx.restore();}for(const p of particles){ctx.save();ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.shadowColor=p.color;ctx.shadowBlur=8;rect(p.x-p.size/2,p.y-p.size/2,p.size,p.size,p.color);ctx.restore();}}
function drawPatrolCones(){for(const e of enemies){if(e.hp<=0||e.id>=10||e.state==='pursue')continue;ctx.save();ctx.fillStyle=e.state==='investigate'?'#efba7522':'#d86b6b15';ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.arc(e.x,e.y,310,e.angle-.85,e.angle+.85);ctx.closePath();ctx.fill();ctx.restore();}}
function drawFog(){
 const fw=fogCanvas.width,fh=fogCanvas.height,rx=fw/w,ry=fh/h,px=fw/2,py=fh/2;
 fogCtx.clearRect(0,0,fw,fh);fogCtx.fillStyle='rgba(1,7,14,.93)';fogCtx.fillRect(0,0,fw,fh);
 // Discovered but presently invisible tiles retain very faint remembered outlines.
 fogCtx.save();fogCtx.globalCompositeOperation='destination-out';fogCtx.fillStyle='rgba(0,0,0,.13)';
 const cell=76,minX=Math.floor((camera.x-w/(2*scale))/cell)-1,maxX=Math.ceil((camera.x+w/(2*scale))/cell)+1,minY=Math.floor((camera.y-h/(2*scale))/cell)-1,maxY=Math.ceil((camera.y+h/(2*scale))/cell)+1;
 for(let j=minY;j<=maxY;j++)for(let i=minX;i<=maxX;i++){const k=i+':'+j;if(exploredCells.has(k)){const sx=(i*cell-camera.x)*scale+w/2,sy=(j*cell-camera.y)*scale+h/2;fogCtx.fillRect(sx*rx,sy*ry,cell*scale*rx+1,cell*scale*ry+1);}}
 // Soft visibility gradient; occluding structures restore darkness below.
 const rad=470*scale*rx,g=fogCtx.createRadialGradient(px,py,rad*.18,px,py,rad);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.74,'rgba(0,0,0,.98)');g.addColorStop(1,'rgba(0,0,0,0)');fogCtx.fillStyle=g;fogCtx.beginPath();fogCtx.arc(px,py,rad,0,TAU);fogCtx.fill();fogCtx.restore();
 // Cast broad shadows from metal columns away from the player, matching collision and sight occlusion.
 fogCtx.save();fogCtx.fillStyle='rgba(2,8,17,.76)';
 for(const o of COVERS){const cx=o.x,cy=o.y;if(hypot(cx-hero.x,cy-hero.y)>650)continue;
 const points=[{x:cx-o.w/2,y:cy-o.h/2},{x:cx+o.w/2,y:cy-o.h/2},{x:cx+o.w/2,y:cy+o.h/2},{x:cx-o.w/2,y:cy+o.h/2}];
 const angles=points.map(p=>Math.atan2(p.y-hero.y,p.x-hero.x));let best=[0,1],mx=-1;
 for(let a=0;a<4;a++)for(let b=a+1;b<4;b++){let dif=Math.abs(Math.atan2(Math.sin(angles[a]-angles[b]),Math.cos(angles[a]-angles[b])));if(dif>mx){mx=dif;best=[a,b];}}
 const a=points[best[0]],b=points[best[1]],extend=p=>({x:p.x+(p.x-hero.x)*6,y:p.y+(p.y-hero.y)*6}),ea=extend(a),eb=extend(b);
 const screen=p=>[(p.x-camera.x)*scale*rx+px,(p.y-camera.y)*scale*ry+py];
 const pa=screen(a),pb=screen(b),pea=screen(ea),peb=screen(eb);fogCtx.beginPath();fogCtx.moveTo(...pa);fogCtx.lineTo(...pea);fogCtx.lineTo(...peb);fogCtx.lineTo(...pb);fogCtx.closePath();fogCtx.fill();
 }fogCtx.restore();
 // Unopened pressure doors hide everything beyond their bulkhead; fog and collision agree.
 fogCtx.save();fogCtx.fillStyle='rgba(2,8,17,.94)';
 for(const door of doorState){if(door.open>=.85)continue;const sx=(door.x-camera.x)*scale*rx+px;
 if(door.x>hero.x)fogCtx.fillRect(Math.max(0,sx),0,Math.max(0,fw-sx),fh);
 else fogCtx.fillRect(0,0,Math.min(fw,Math.max(0,sx)),fh);
 }fogCtx.restore();
 ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.drawImage(fogCanvas,0,0,w,h);ctx.restore();
}
function drawWorld(){
 ctx.setTransform(dpr,0,0,dpr,0,0);rect(0,0,w,h,'#060e18');
 const zoom=scale;ctx.translate(w/2-camera.x*zoom,h/2-camera.y*zoom);ctx.scale(zoom,zoom);
 drawFloor();drawPatrolCones();for(const d of doorState)drawDoor(d);
 drawHatch(1875,326,1);drawHatch(1868,-330,2);drawHatch(2970,175,3);drawHatch(2980,-175,4);
 drawHatch(4230,-325,5);drawHatch(4230,310,6);drawHatch(5490,-300,7);drawHatch(5490,290,8);drawHatch(6960,-345,9);drawHatch(6970,345,10);
 drawDevice(STATIONS[0],'generator',progress.generator,generator.online);
 for(const t of turrets)drawDevice(t,'turret',t.progress,t.state==='online');
 drawDevice(STATIONS[3],'armament',workshop.progress,workshop.installed);
 drawStageDevices();
 for(const e of enemies)drawEnemy(e);
 drawShots();drawShip();if(workshop.mountTimer>0)drawWorkshopArms(true);drawBeam();
 // World-space guidance only near the currently relevant gates.
 if(securityUnlocked){ctx.save();ctx.font='700 18px system-ui';ctx.fillStyle='#99ffde';ctx.textAlign='center';ctx.shadowColor=colors.mint;ctx.shadowBlur=12;ctx.fillText('→ МОНТАЖНАЯ МАСТЕРСКАЯ',2075,-67);ctx.restore();}
 if(workshop.clear&&visibleBox(3160,-100,250,100)){ctx.save();ctx.font='700 18px system-ui';ctx.fillStyle='#99ffde';ctx.textAlign='center';ctx.shadowColor=colors.mint;ctx.shadowBlur=12;ctx.fillText('→ ЛИТЕЙНАЯ АРЕНА',3270,-58);ctx.restore();}
 for(const [open,x,label] of [[arena.clear,4520,'→ КОМАНДНЫЙ ЦЕНТР'],[command.clear,5750,'→ ОБОРОННОЕ ЯДРО'],[defense.clear,7250,'→ ЭВАКУАЦИОННЫЙ ШЛЮЗ']])if(open&&visibleBox(x-160,-100,320,100)){ctx.save();ctx.textAlign='center';ctx.font='700 17px system-ui';ctx.fillStyle='#a6ffe6';ctx.shadowColor=colors.mint;ctx.shadowBlur=11;ctx.fillText(label,x,-64);ctx.restore();}
 drawFog();
 if(hitFlash>0){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='rgba(243,63,82,'+(hitFlash*.13)+')';ctx.fillRect(0,0,w,h);}
}
function frame(ts){requestAnimationFrame(frame);if(!last)last=ts;const dt=Math.min(.035,(ts-last)/1000);last=ts;if(!hero||ready<2||failed){ctx.setTransform(dpr,0,0,dpr,0,0);rect(0,0,w,h,'#0a1825');return;}
 if(started&&!ended)update(dt);
 // Keep the camera with modest inertia; near the patrol it briefly glances east.
 const aimX=hero.x+(entryTimer>0?Math.min(150,entryTimer*58):Math.min(125,Math.max(0,hero.vx)*.38));
 const aimY=hero.y+hero.vy*.12;
 camera.x=lerp(camera.x,aimX,Math.min(1,dt*3.3));camera.y=lerp(camera.y,aimY,Math.min(1,dt*3.3));
 drawWorld();
 if(hybrid3d && !hybrid3d.disposed){
     try{
         const nearTurrets=[...turrets,...defense.heavy].filter(t=>t.state!=='offline'&&
             Math.hypot(t.x-camera.x,t.y-camera.y)<490).map(t=>({
                 key:'station-'+t.id,x:t.x,y:t.y,angle:t.angle,
                 level:t.level||1,flash:t.flash,disabled:t.state==='disabled',span:70
             }));
         hybrid3d.render({
             player:{...hero,visualAngle:hero.angle+Math.PI/2,
                 shipVariant:'fighter',level:workshop.installed?7:1},
             workshop:workshop.installed,
             centerX:camera.x,centerY:camera.y,
             logicalWidth:w/scale,logicalHeight:h/scale,time:now,
             turrets:nearTurrets,active:started||ended
         });
     }catch(error){hybrid3d.disable(error);}
 }
}
window.__stationDebug={getState:()=>({ready,started,ended,hero:hero?{x:hero.x,y:hero.y,hp:hero.hp}:null,generator:generator?.online,door:doorState?.map(d=>({id:d.id,open:d.open})),turrets:turrets?.map(t=>({id:t.id,state:t.state,hp:t.hp})),alive:enemies?.filter(e=>e.hp>0).length,wave:wave?.phase,securityUnlocked,workshop:workshop?{installed:workshop.installed,mountTimer:workshop.mountTimer,botsSpawned:workshop.botsSpawned,clear:workshop.clear}:null,arena:arena?{entered:arena.entered,relays:arena.relays,spawned:arena.waveSpawned,clear:arena.clear}:null,command:command?{entered:command.entered,hacked:command.hacked,clear:command.clear}:null,defense:defense?{entered:defense.entered,coreHp:defense.coreHp,spawned:defense.spawned,clear:defense.clear,heavy:defense.heavy.map(t=>({id:t.id,state:t.state}))}:null,evac:evac?{entered:evac.entered,launched:evac.launched,countdown:evac.countdown}:null}),testGeometry:()=>({dock:withinWorld(0,0),hall:withinWorld(700,0),outside:withinWorld(700,350),cover:circleRect(1410,0,20,COVERS[0])})};
bakeSky();reset();$('intro').style.display='flex';started=false;requestAnimationFrame(frame);
})();