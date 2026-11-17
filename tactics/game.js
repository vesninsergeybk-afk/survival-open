import {FIELD,ROLES,MISSIONS,createMission,resolveTurn,nextMission,getUnit,aliveEnemies,aliveAllies,nearestEnemy,canRelay,hackNeed,tacticalCapacity,normalizePlan,distance,forecastTurn,nextReinforcement,isJammed} from './rules.js?v=protocol-2';
import {ESCORTS} from '../arcade/escort-squad.js';
const $=id=>document.getElementById(id),canvas=$('field'),ctx=canvas.getContext('2d',{alpha:true});
const STORE='survivor.protocol.missions.v2';
const LEGACY_STORE='survivor.protocol.missions.v1';
const params=new URLSearchParams(location.search);
const fixedSeed=Number(params.get('seed'));
const SEED=Number.isInteger(fixedSeed)&&fixedSeed>0&&fixedSeed<1e9?fixedSeed:1729;
let world=load()||createMission(0,SEED),plan={action:'hack',formation:'escort',targetId:null,destination:{x:world.player.x,y:world.player.y}};
let outlook=null;
let manualWaypoint=false,zoomFactor=1,drag=null,pan={x:0,y:0},view={w:1,h:1,dpr:1};
let transition=null,lastFrame=performance.now(),sparkles=[];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const colors={ally:'#5ef3c7',enemy:'#ee848a',player:'#80dffc',relay:'#e0a46d',core:'#ee8f9c'};
const sprites={};
const assetPaths={
 hero:'../assets/space/hero-evolution/ship_01.webp',
 scout:'../assets/space/enemy_interceptor.png',
 fighter:'../assets/space/enemy_fighter.png',
 medic:'../assets/space/enemy_shield.png',
 rocket:'../assets/space/enemy_bomber.png',
 brawler:'../assets/space/enemy_drone.png',
 leader:'../assets/space/boss_cruiser.png',
 jammer:'../assets/space/enemy_shield.png',
 allyScout:'../arcade/assets/escort/scout-v2.webp',
 allyFighter:'../arcade/assets/escort/fighter-v2.webp',
 allyMedic:'../arcade/assets/escort/medic-v2.webp',
 allyRocket:'../arcade/assets/escort/rocket-v2.webp',
 allyBrawler:'../arcade/assets/escort/brawler-v2.webp',
 rock:'../assets/space/asteroid-realistic.webp',
 station:'../assets/space/station-dock-v1.svg'
};
for(const [key,path] of Object.entries(assetPaths)){
 const img=new Image();img.decoding='async';img.src=path;img.addEventListener('load',()=>{if(world)draw(performance.now());});sprites[key]=img;
}
function save(){try{localStorage.setItem(STORE,JSON.stringify(world));}catch{}}
function load(){
 try{
  const raw=localStorage.getItem(STORE)||localStorage.getItem(LEGACY_STORE);if(!raw)return null;
  const w=JSON.parse(raw);
  if(![1,2].includes(w.version)||!Number.isInteger(w.mission)||w.mission<0||w.mission>=MISSIONS.length||
    !w.player||!Array.isArray(w.ships)||!Array.isArray(w.stations)||!Array.isArray(w.asteroids)||
    !['planning','won','lost'].includes(w.phase))return null;
  if(w.version===1){w.version=2;w.entry=null;}
  w.player.charge=Number.isFinite(w.player.charge)?Math.max(0,Math.min(2,w.player.charge)):2;
  w.player.maxCharge=2;
  return w;
 }catch{return null;}
}
function resize(){
 const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
 if(r.width<1||r.height<1)return;
 view={w:r.width,h:r.height,dpr};
 canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);
 draw(performance.now());
}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function scale(){return Math.min(view.w/(FIELD.width/1.8),view.h/(FIELD.height/1.8))*zoomFactor;}
function pose(state,id){
 if(id==='player')return state.player;
 return getUnit(state,id);
}
function position(id,alpha=1){
 if(!transition)return pose(world,id);
 const before=pose(transition.before,id),after=pose(transition.after,id);
 if(!before&&!after)return null;
 if(!before)return after;
 if(!after)return before;
 return { ...after,x:before.x+(after.x-before.x)*alpha,y:before.y+(after.y-before.y)*alpha};
}
function camera(alpha=1){
 const p=position('player',alpha)||world.player,s=scale();
 const halfW=view.w/s/2,halfH=view.h/s/2;
 const x=halfW*2>=FIELD.width?FIELD.width/2:clamp(p.x+pan.x,halfW,FIELD.width-halfW);
 const y=halfH*2>=FIELD.height?FIELD.height/2:clamp(p.y+pan.y,halfH,FIELD.height-halfH);
 return {x,y,s};
}
function toScreen(p,cam){return {x:view.w/2+(p.x-cam.x)*cam.s,y:view.h/2+(p.y-cam.y)*cam.s};}
function toWorld(sx,sy){
 const cam=camera(1);
 return {x:clamp(cam.x+(sx-view.w/2)/cam.s,0,FIELD.width),y:clamp(cam.y+(sy-view.h/2)/cam.s,0,FIELD.height)};
}
function imageAt(name,x,y,size,angle=0,opacity=1){
 const im=sprites[name];
 if(!im?.complete||!im.naturalWidth)return false;
 ctx.save();ctx.globalAlpha=opacity;ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(im,-size/2,-size/2,size,size);ctx.restore();return true;
}
function drawShip(unit,cam,alpha=1,animatedSide=null){
 const p=position(unit.id,alpha)||unit,s=toScreen(p,cam);
 const friendly=animatedSide??(unit.side==='ally'),active=unit.id===plan.targetId;
 const c=friendly?colors.ally:colors.enemy,size=Math.max(23,(unit.role==='leader'?78:unit.role==='rocket'?51:49)*cam.s);
 const heading=friendly?-Math.PI/2:Math.PI/2;
 const imageName=friendly?({scout:'allyScout',fighter:'allyFighter',medic:'allyMedic',rocket:'allyRocket',brawler:'allyBrawler'}[unit.role]||'allyFighter'):unit.role;
 if(!imageAt(imageName,s.x,s.y,size,0)){
  ctx.save();ctx.translate(s.x,s.y);ctx.rotate(heading);ctx.fillStyle=c;
  ctx.beginPath();ctx.moveTo(0,-size*.48);ctx.lineTo(size*.35,size*.38);ctx.lineTo(0,size*.16);ctx.lineTo(-size*.35,size*.38);ctx.closePath();ctx.fill();ctx.restore();
 }
 ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.globalAlpha=.75;
 ctx.beginPath();ctx.arc(s.x,s.y,size*.45,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
 if(active){
  ctx.strokeStyle='#ffd875';ctx.lineWidth=2;ctx.setLineDash([6,4]);
  ctx.beginPath();ctx.arc(s.x,s.y,size*.70,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
 }
 const width=Math.max(30,size*1.10),hp=clamp(unit.hp/unit.maxHp,0,1);
 ctx.fillStyle='#213346';ctx.fillRect(s.x-width/2,s.y+size*.54,width,4);
 ctx.fillStyle=hp<.35?'#f5aa63':c;ctx.fillRect(s.x-width/2,s.y+size*.54,width*hp,4);
 const prog=unit.hack||0;
 if(prog>0&&unit.side==='enemy'){
  const need=hackNeed(world,unit);
  ctx.strokeStyle='#67f4d7';ctx.lineWidth=4;
  ctx.beginPath();ctx.arc(s.x,s.y,size*.62,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(prog/need,0,1));ctx.stroke();
 }
 if(unit.role==='leader'||unit.role==='jammer'){
  ctx.font='700 10px system-ui';ctx.textAlign='center';
  ctx.fillStyle=unit.role==='jammer'?'#e9bdff':'#ffdca7';
  ctx.fillText(unit.role==='jammer'?'ГЛУШИТЕЛЬ':'КОМАНДИР',s.x,s.y-size*.68);
 }
}
function drawStation(st,cam){
 const p=toScreen(st,cam),size=Math.max(38,110*cam.s),friendly=st.side==='ally';
 ctx.strokeStyle=friendly?'#58edc8':'#f0998f';ctx.lineWidth=2;
 ctx.beginPath();ctx.arc(p.x,p.y,size*.70,0,Math.PI*2);ctx.stroke();
 imageAt('station',p.x,p.y,size)||(()=>{ctx.fillStyle='#27394f';ctx.fillRect(p.x-size/3,p.y-size/3,size*.66,size*.66);})();
 ctx.font='800 '+Math.max(11,12*cam.s)+'px system-ui';ctx.textAlign='center';ctx.fillStyle='#dfeffc';
 ctx.fillText(st.role==='relay'?'РЕТРАНСЛЯТОР':'ЦЕНТР ИИ',p.x,p.y+size*.77);
 if(st.id===plan.targetId){ctx.strokeStyle='#ffe28f';ctx.setLineDash([4,6]);ctx.beginPath();ctx.arc(p.x,p.y,size*.92,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
 if(st.hack>0){ctx.strokeStyle='#62edc8';ctx.lineWidth=5;ctx.beginPath();ctx.arc(p.x,p.y,size*.77,-Math.PI/2,-Math.PI/2+Math.PI*2*st.hack/hackNeed(world,st));ctx.stroke();}
}
function draw(now){
 if(!view.w||!ctx)return;
 const t=transition?clamp((now-transition.start)/(reduced?160:850),0,1):1;
 const cam=camera(t);
 ctx.setTransform(view.dpr,0,0,view.dpr,0,0);
 ctx.clearRect(0,0,view.w,view.h);
 ctx.fillStyle='#091423';ctx.globalAlpha=.28;ctx.fillRect(0,0,view.w,view.h);ctx.globalAlpha=1;
 // The bounded arena is deliberately legible at the farthest zoom.
 const a=toScreen({x:0,y:0},cam),b=toScreen({x:FIELD.width,y:FIELD.height},cam);
 ctx.save();ctx.strokeStyle='#3b6984';ctx.lineWidth=2;ctx.setLineDash([10,9]);
 ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.setLineDash([]);
 ctx.beginPath();
 for(let x=0;x<=FIELD.width;x+=200){const sx=toScreen({x,y:0},cam).x;ctx.moveTo(sx,a.y);ctx.lineTo(sx,b.y);}
 for(let y=0;y<=FIELD.height;y+=200){const sy=toScreen({x:0,y},cam).y;ctx.moveTo(a.x,sy);ctx.lineTo(b.x,sy);}
 ctx.strokeStyle='#467088';ctx.globalAlpha=.15;ctx.lineWidth=.8;ctx.stroke();ctx.globalAlpha=1;
 ctx.restore();
 for(const star of sparkles){
  const p=toScreen(star,cam);if(p.x<0||p.x>view.w||p.y<0||p.y>view.h)continue;
  ctx.fillStyle=star.b>0.8?'#c0e4ff':'#7b9eb7';ctx.globalAlpha=star.b*.65;ctx.fillRect(p.x,p.y,star.r,star.r);
 }
 ctx.globalAlpha=1;
 for(const r of world.asteroids){
  const p=toScreen(r,cam),size=Math.max(14,r.r*2.2*cam.s);
  if(!imageAt('rock',p.x,p.y,size,r.x*.005,.82)){
   ctx.fillStyle='#596b7d';ctx.beginPath();ctx.arc(p.x,p.y,size*.47,0,Math.PI*2);ctx.fill();
  }
  ctx.strokeStyle='#8aa7b9';ctx.globalAlpha=.28;ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(p.x,p.y,r.r*.9*cam.s,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
 }
 if(!transition&&world.phase==='planning'){
  for(const jammer of aliveEnemies(world).filter(x=>x.role==='jammer'&&!x.suppressed)){
   const p=toScreen(jammer,cam);
   ctx.strokeStyle='#d9a5ff';ctx.lineWidth=1.3;ctx.setLineDash([5,9]);ctx.globalAlpha=.35;
   ctx.beginPath();ctx.arc(p.x,p.y,280*cam.s,0,2*Math.PI);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
  }
  if(outlook){
   for(const threat of outlook.shots){
    const from=toScreen(threat.from,cam),to=toScreen(threat.to,cam);
    ctx.strokeStyle=threat.to.id==='player'?'#ff8f72':'#ffa69f';
    ctx.lineWidth=threat.to.id==='player'?2.5:1.3;
    ctx.globalAlpha=threat.cover?.28:.52;ctx.setLineDash([7,7]);ctx.beginPath();
    ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(to.x,to.y,threat.to.id==='player'?15:9,0,2*Math.PI);ctx.stroke();
   }
   ctx.globalAlpha=1;
   const ghost=toScreen(outlook.position,cam);
   ctx.strokeStyle='#81ecff';ctx.globalAlpha=.6;ctx.setLineDash([4,4]);
   ctx.beginPath();ctx.arc(ghost.x,ghost.y,12,0,2*Math.PI);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
  }
 }
 const playerPos=position('player',t),hero=toScreen(playerPos,cam);
 if(!transition){
  const dest=toScreen(plan.destination,cam);
  ctx.strokeStyle='#68cde4';ctx.lineWidth=2;ctx.setLineDash([7,6]);ctx.beginPath();ctx.moveTo(hero.x,hero.y);ctx.lineTo(dest.x,dest.y);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle='#74dbea';ctx.beginPath();ctx.arc(dest.x,dest.y,8,0,Math.PI*2);ctx.stroke();
  if(plan.action==='hack'&&plan.targetId){
   const selected=getUnit(world,plan.targetId);
   if(selected){
    const a=toScreen(selected,cam),from=toScreen(plan.destination,cam);
    ctx.strokeStyle='#6ef3d0';ctx.globalAlpha=.48;ctx.beginPath();ctx.arc(from.x,from.y,FIELD.hackRange*cam.s,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(a.x,a.y);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
   }
  }
 }
 for(const st of world.stations)drawStation(st,cam);
 const all=transition?[...transition.before.ships,...transition.after.ships.filter(s=>!transition.before.ships.some(p=>p.id===s.id))]:world.ships;
 for(const unit of all){
  const newest=getUnit(world,unit.id),isLost=!newest;
  if(isLost&&t>.8)continue;
  const p=position(unit.id,t);
  if(!p)continue;
  const viewUnit={...unit,...newest,...p};
  const friendly=transition&&t<.74?unit.side==='ally':viewUnit.side==='ally';
  drawShip(viewUnit,cam,t,friendly);
 }
 const heroSize=Math.max(28,55*cam.s);
 imageAt('hero',hero.x,hero.y,heroSize)||(()=>{
  ctx.fillStyle=colors.player;ctx.beginPath();ctx.moveTo(hero.x,hero.y-heroSize*.5);ctx.lineTo(hero.x+heroSize*.3,hero.y+heroSize*.4);ctx.lineTo(hero.x-heroSize*.3,hero.y+heroSize*.4);ctx.fill();
 })();
 ctx.strokeStyle='#82dffc';ctx.lineWidth=2;ctx.beginPath();ctx.arc(hero.x,hero.y,heroSize*.49,0,Math.PI*2);ctx.stroke();
 ctx.fillStyle='#c9f1ff';ctx.textAlign='center';ctx.font='700 10px system-ui';ctx.fillText('ВЫ',hero.x,hero.y+heroSize*.7);
 if(transition){
  for(const ev of transition.after.events||[]){
   if(ev.kind==='shot'&&t>.31&&t<.72){
    const s=position(ev.from,t)||position(ev.from,0),d=position(ev.to,t)||position(ev.to,0);
    if(!s||!d)continue;const a=toScreen(s,cam),b=toScreen(d,cam);
    ctx.strokeStyle=ev.weapon==='enemy'?'#f69a83':ev.weapon==='manual'?'#a3e7ff':'#77ecd0';
    ctx.lineWidth=ev.weapon==='manual'?3:2;ctx.globalAlpha=.85;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.globalAlpha=1;
   }
   if(ev.kind==='captured'&&t>.69&&t<.97){
    const p=position(ev.target,t);if(!p)continue;const a=toScreen(p,cam);
    ctx.strokeStyle='#7effd4';ctx.lineWidth=3;ctx.globalAlpha=(.97-t)*3;ctx.beginPath();ctx.arc(a.x,a.y,20+48*(t-.69)/.28,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
   }
  }
 }
}
function seedStars(){
 let value=world.seed>>>0||1729;const random=()=>{value=(Math.imul(1664525,value)+1013904223)>>>0;return value/4294967296;};
 sparkles=Array.from({length:125},()=>({x:random()*FIELD.width,y:random()*FIELD.height,r:random()>0.92?2:1,b:.3+random()*.7}));
}
function renderUI(){
 const mission=MISSIONS[world.mission],allies=aliveAllies(world),capacity=tacticalCapacity(world),hp=world.player.hp;
 outlook=world.phase==='planning'?forecastTurn(world,plan):null;
 $('mission-n').textContent=String(world.mission+1).padStart(2,'0')+' / '+String(MISSIONS.length).padStart(2,'0');
 $('mission-name').textContent=mission.name.replace(/^\d+ \/ /,'');
 $('mission-desc').textContent=mission.brief;
 $('player-health').textContent=Math.ceil(hp)+' / '+world.player.maxHp;
 $('health-bar').style.width=(100*hp/world.player.maxHp)+'%';
 $('squad-size').textContent=allies.length+' / '+capacity;
 $('squad-bar').style.width=(100*allies.length/capacity)+'%';
 $('pulse-charge').textContent=(world.player.charge||0)+' / '+(world.player.maxCharge||2);
 $('pulse-bar').style.width=(100*(world.player.charge||0)/(world.player.maxCharge||2))+'%';
 $('sector-chip').textContent='СЕКТОР '+String(world.mission+1).padStart(2,'0');
 $('turn-chip').textContent='ХОД '+String(world.turn+1).padStart(2,'0');
 $('phase-chip').textContent=transition?'ИСПОЛНЕНИЕ':world.phase==='planning'?'ПЛАНИРОВАНИЕ':world.phase==='won'?'ПОБЕДА':'ПОРАЖЕНИЕ';
 $('order-hack').classList.toggle('selected',plan.action==='hack');
 $('order-shot').classList.toggle('selected',plan.action==='shot');
 $('order-hack').setAttribute('aria-pressed',String(plan.action==='hack'));
 $('order-shot').setAttribute('aria-pressed',String(plan.action==='shot'));
 for(const action of ['boost','pulse']){
  $('order-'+action).classList.toggle('selected',plan.action===action);
  $('order-'+action).setAttribute('aria-pressed',String(plan.action===action));
 }
 $('order-pulse').disabled=(world.player.charge||0)<1;
 for(const mode of ['escort','strike','relay']){
  $('formation-'+mode).classList.toggle('selected',plan.formation===mode);
  $('formation-'+mode).setAttribute('aria-pressed',String(plan.formation===mode));
 }
 $('formation-help').textContent=({
  escort:'Прикрытие: союзники держатся у героя и атакуют ближайших противников.',
  strike:'Штурм: союзники сближаются с врагом и наносят на 35% больше урона.',
  relay:'Реле: союзники передают сигнал и ускоряют взлом, но не стреляют.'
 })[plan.formation];
 const target=plan.targetId?getUnit(world,plan.targetId):null;
 $('target-name').textContent=target?(ROLES[target.role]?.name|| (target.role==='relay'?'Ретранслятор':'Центр ИИ')):'Нет цели';
 let status='Нажмите на красный корабль или вражескую станцию.';
 if(target){
  status=plan.action==='hack'?'Взлом: '+(target.hack||0)+' / '+hackNeed(world,target)+' · '+(outlook?.canHack?'связь после перемещения доступна':isJammed(world,target)?'помехи глушителя или дистанция':'сначала приблизьтесь'):
   plan.action==='shot'?'Выстрел: '+(outlook?.target&&distance(outlook.position,outlook.target)<=FIELD.shotRange?'цель в пределах дальности':'цель слишком далеко'):
   'Это действие не требует выбранной цели.';
 }
 $('target-status').textContent=status;
 $('destination-name').textContent=distance(plan.destination,world.player)<6?'Удерживать позицию':'Курс: '+Math.round(plan.destination.x)+' × '+Math.round(plan.destination.y);
 if(outlook){
  $('forecast-damage').textContent=outlook.incoming>0?
   'По вам: ≈ '+outlook.incoming+' ед. урона':'По вам: прямых попаданий не ожидается';
  const shots=outlook.shots.length,cover=outlook.shots.filter(x=>x.cover).length;
  $('forecast-detail').textContent='Прогноз залпов: '+shots+'; через укрытие: '+cover+'. '+
   (plan.action==='pulse'?(outlook.pulseActive?'Импульс подавит противников в радиусе.':'Нет заряда для импульса.'):
   plan.action==='boost'?'Рывок снижает урон по герою.':plan.action==='hack'&&outlook.canHack?'Канал взлома после движения открыт.':'');
  const wave=outlook.nextWave;
  $('reserve-warning').textContent=wave&&wave.turn-world.turn<=3?
   '⚠ Резерв врага через '+(wave.turn-world.turn)+' ход(а): '+ROLES[wave.role].name.toLowerCase(): '';
 }else{
  $('forecast-damage').textContent=world.phase==='won'?'Операция выполнена':'Операция завершилась';
  $('forecast-detail').textContent=world.message;
  $('reserve-warning').textContent='';
 }
 $('execute').hidden=world.phase!=='planning';
 $('execute').disabled=!!transition;
 $('next').hidden=world.phase!=='won'||world.mission===MISSIONS.length-1;
 $('status').textContent=world.message;
 $('zoom-value').textContent=Math.round(zoomFactor*100)+'%';
 $('replay').textContent=world.phase==='won'&&world.mission===MISSIONS.length-1?'↻ Новая кампания':'↻ Начать миссию заново';
}
function selectAt(point){
 if(transition||world.phase!=='planning')return;
 const s=scale(),eligible=[...aliveEnemies(world),...world.stations.filter(u=>u.side==='enemy')];
 eligible.sort((a,b)=>distance(a,point)-distance(b,point));
 const found=eligible.find(u=>distance(u,point)<Math.max(58,26/s));
 if(found){
  plan.targetId=found.id;
  if(!manualWaypoint){
   // Default to a point near the selected target so one tap is sufficient.
   const dx=world.player.x-found.x,dy=world.player.y-found.y,len=Math.hypot(dx,dy)||1;
   plan.destination={x:clamp(found.x+dx/len*180,40,FIELD.width-40),y:clamp(found.y+dy/len*180,40,FIELD.height-40)};
  }
  world.message='Цель выбрана. При необходимости измените точку движения.';
 }else{
  plan.destination=point;manualWaypoint=true;
  world.message='Маршрут указан. Выполните ход, когда будете готовы.';
 }
 renderUI();draw(performance.now());
}
function execute(){
 if(transition||world.phase!=='planning')return;
 const before=world,after=resolveTurn(before,plan);
 transition={before,after,start:performance.now()};
 world=after;save();
 plan={...plan,targetId:getUnit(world,plan.targetId)?.side==='enemy'?plan.targetId:null,destination:{x:world.player.x,y:world.player.y}};
 manualWaypoint=false;
 $('execute').disabled=true;renderUI();
}
function next(){if(transition||world.phase!=='won')return;world=nextMission(world);plan={action:'hack',formation:'escort',targetId:null,destination:{x:world.player.x,y:world.player.y}};manualWaypoint=false;pan={x:0,y:0};seedStars();save();renderUI();}
function restart(){
 if(transition)return;
 const full=world.phase==='won'&&world.mission===MISSIONS.length-1;
 world=createMission(full?0:world.mission,world.seed,full?null:world.entry);
 plan={action:'hack',formation:'escort',targetId:null,destination:{x:world.player.x,y:world.player.y}};manualWaypoint=false;pan={x:0,y:0};seedStars();save();renderUI();
}
function animate(now){
 const elapsed=clamp((now-lastFrame)/1000,0,.15);lastFrame=now;
 if(transition&&now-transition.start>=(reduced?160:850)){
  transition=null;renderUI();
 }
 draw(now);
 requestAnimationFrame(animate);
}
canvas.addEventListener('pointerdown',e=>{
 if(transition)return;
 canvas.setPointerCapture?.(e.pointerId);
 drag={id:e.pointerId,x:e.clientX,y:e.clientY,pan:{...pan},moved:false};
});
canvas.addEventListener('pointermove',e=>{
 if(!drag||drag.id!==e.pointerId)return;
 const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(Math.hypot(dx,dy)>11)drag.moved=true;
 if(drag.moved){const s=scale();pan={x:drag.pan.x-dx/s,y:drag.pan.y-dy/s};}
});
canvas.addEventListener('pointerup',e=>{
 if(!drag||drag.id!==e.pointerId)return;
 const moved=drag.moved;drag=null;
 if(!moved){const r=canvas.getBoundingClientRect();selectAt(toWorld(e.clientX-r.left,e.clientY-r.top));}
});
canvas.addEventListener('pointercancel',()=>drag=null);
for(const action of ['hack','shot','boost','pulse']){
 $('order-'+action).addEventListener('click',()=>{if(action==='pulse'&&!world.player.charge)return;plan.action=action;renderUI();});
}
for(const mode of ['escort','strike','relay'])
 $('formation-'+mode).addEventListener('click',()=>{plan.formation=mode;renderUI();});
$('execute').addEventListener('click',execute);
$('next').addEventListener('click',next);
$('replay').addEventListener('click',restart);
$('zoom-in').addEventListener('click',()=>{zoomFactor=clamp(zoomFactor+.2,1,2.2);renderUI();});
$('zoom-out').addEventListener('click',()=>{zoomFactor=clamp(zoomFactor-.2,1,2.2);renderUI();});
$('help').addEventListener('click',()=>$('help-dialog').showModal());
$('help-close').addEventListener('click',()=>$('help-dialog').close());
$('help-ready').addEventListener('click',()=>$('help-dialog').close());
window.addEventListener('keydown',e=>{
 if($('help-dialog').open||e.target?.matches('input,textarea,select'))return;
 if(e.code==='Space'||e.code==='Enter'){e.preventDefault();execute();}
 if(e.code==='KeyQ'){plan.action='hack';renderUI();}
 if(e.code==='KeyF'){plan.action='shot';renderUI();}
 if(e.code==='KeyB'){plan.action='boost';renderUI();}
 if(e.code==='KeyE'&&world.player.charge){plan.action='pulse';renderUI();}
});
window.addEventListener('resize',resize);
if('ResizeObserver' in window)new ResizeObserver(resize).observe(canvas);
seedStars();resize();renderUI();requestAnimationFrame(animate);
