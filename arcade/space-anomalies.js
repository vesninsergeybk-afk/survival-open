import {hash} from './balance.js';
import {REGIONS} from './regions.js';
import {POPULATION} from './world-population.js?v=sector-density-2-frontier-siege-1';
import {drawAnomalyWrecks} from './enemy-frontier-render.js?v=frontier-art-1';

const TAU=Math.PI*2;
const types=['gravity','ion','wrecks','pulsar','meteor'];
const labels={gravity:'ГРАВИТАЦИОННАЯ ВОРОНКА',ion:'ИОННЫЙ ФРОНТ',
 wrecks:'КЛАДБИЩЕ КОРАБЛЕЙ',pulsar:'ПУЛЬСАР',meteor:'МЕТЕОРИТНЫЙ РОЙ'};
const colors={gravity:'#c0a8ff',ion:'#76d9ff',wrecks:'#9edbbd',
 pulsar:'#ffb5e9',meteor:'#ffb477'};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const view=(f,cam)=>f.x+f.r>cam.x&&f.x-f.r<cam.x+cam.w&&
 f.y+f.r>cam.y&&f.y-f.r<cam.y+cam.h;
export function createSpaceAnomalies(seed=20261102){
 const anomalies=[];
 for(const region of REGIONS)for(let i=0;i<50;i++){
  const kind=i%types.length;
  let x,y;
  if(region.id==='amethyst'){
   const fraction=(i+.55)/50;
   const radius=Math.sqrt(6200**2+fraction*(22400**2-6200**2));
   const angle=i*2.399963229728653+(hash(i,region.number,seed)-.5)*.38;
   x=Math.cos(angle)*radius;y=Math.sin(angle)*radius;
  }else{
   const lane=i%10,belt=Math.floor(i/10);
   const angle=Math.atan2(region.y,region.x)+
    ((lane+.5+(belt%2)*.37)/10-.5)*1.5;
   const radius=28000+(belt+.3+hash(i,region.number,seed)*.36)*4900;
   x=Math.cos(angle)*radius;y=Math.sin(angle)*radius;
  }
  anomalies.push({id:region.id+':'+types[kind]+':'+Math.floor(i/5),
   region:region.id,type:types[kind],
   x,y,r:types[kind]==='gravity'?820:types[kind]==='wrecks'?1050:1250,
   phase:hash(i+39,region.number,seed)*TAU});
 }
 return anomalies;
}
const cycle=(field,time)=>((time+field.phase*3)%26+26)%26;
const recentHit=(actor,token)=>{
 actor.anomalyHits??=[];
 if(actor.anomalyHits.includes(token))return true;
 actor.anomalyHits.push(token);actor.anomalyHits=actor.anomalyHits.slice(-10);
 return false;
};
export function updateSpaceAnomalies(game,dt){
 const fields=game.world.anomalies||[];
 const p=game.player;
 for(const f of fields){
  const d=distance(f,p);
  if(d>f.r+320)continue;
  if(game.time>(f.nextNoticeAt||0)&&d<f.r+100){
   f.nextNoticeAt=game.time+38;
   const hints={gravity:'Воронка притягивает корпус. Держитесь дальше от ядра.',
    ion:'Импульс через 26 секунд: выходите за границу светящегося облака.',
    wrecks:'В поле обломков можно найти сплав. Обломки замедляют манёвры.',
    pulsar:'Следите за вспышками: перед разрядом пульсар набирает яркость.',
    meteor:'Перед метеоритным потоком появляется оранжевое предупреждение.'};
   game.notice(labels[f.type]+'. '+hints[f.type],5);
  }
  if(f.type==='gravity'&&d<f.r){
   const scale=1-d/f.r,force=Math.min(240,30+230*scale*scale);
   const dx=(f.x-p.x)/Math.max(1,d),dy=(f.y-p.y)/Math.max(1,d);
   p.vx+=dx*force*dt;p.vy+=dy*force*dt;
   p.x+=dx*force*dt*dt*8;p.y+=dy*force*dt*dt*8;
   if(d<135&&Math.floor(game.time/3)!==Math.floor((game.time-dt)/3))
    game.hurt(12,f);
   // Massive ships near the singularity are pushed out of formation, too.
   for(const e of game.enemies){
    if(e.hp<=0||distance(e,f)>f.r)continue;
    const mag=Math.max(1,distance(e,f)),factor=(1-mag/f.r)*force*dt;
    e.vx+=(f.x-e.x)/mag*factor;e.vy+=(f.y-e.y)/mag*factor;
   }
  }
  if(f.type==='wrecks'&&d<f.r){
   p.vx*=Math.max(.94,1-dt*.25);p.vy*=Math.max(.94,1-dt*.25);
   const token=Math.floor(game.time/135);
   if(d<f.r*.55&&!recentHit(p,f.id+':salvage:'+token)){
    game.addDrop('ore',p.x+85,p.y+30,4,{source:'salvage',life:90});
    game.notice('В обломках найден пригодный сплав. Патрули могут заметить сбор.',3);
   }
  }
  if(['ion','pulsar','meteor'].includes(f.type)){
   const t=cycle(f,game.time);
   const warning=t>=17&&t<22,discharge=t>=22&&t<25;
   if(warning&&d<f.r&&game.time>(f.warnAt||0)){
    f.warnAt=game.time+20;
    game.notice('ОПАСНОСТЬ: '+labels[f.type]+'. Разряд через '+Math.ceil(22-t)+' с.',4);
   }
   if(!discharge||d>=f.r)continue;
   const token=f.id+':'+Math.floor((game.time+f.phase*3)/26);
   if(!recentHit(p,token))game.hurt(f.type==='pulsar'?26:f.type==='meteor'?22:18,f);
   for(const e of game.enemies){
    if(e.hp>0&&distance(e,f)<f.r&&!recentHit(e,token))
     game.damageEnemy(e,f.type==='pulsar'?29:21,'storm');
   }
  }
 }
}
// Slow, coherent plasma ribbons. No allocations and no additional hitboxes.
function drawIonFilaments(c,f,time,charging,active){
 const r=f.r,TA=TAU/6;
 c.save();c.globalCompositeOperation='lighter';c.lineCap='round';
 for(let i=0;i<6;i++){
  const a=f.phase+i*TA+time*(i%2?-.009:.012);
  const twist=Math.sin(time*.2+i*1.5)*.18;
  const ax=Math.cos(a),ay=Math.sin(a);
  const b=a+.65+twist,cc=a+1.35+twist;
  const x0=ax*r*.13,y0=ay*r*.13;
  const x1=Math.cos(b)*r*.48,y1=Math.sin(b)*r*.48;
  const x2=Math.cos(cc)*r*.88,y2=Math.sin(cc)*r*.88;
  c.beginPath();c.moveTo(x0,y0);
  c.bezierCurveTo(x0+ax*r*.23,y0+ay*r*.23,
   x1+Math.cos(cc)*r*.14,y1+Math.sin(cc)*r*.14,x2,y2);
  c.globalAlpha=active?.23:charging?.13:.038;
  c.strokeStyle='#66d9ee';c.lineWidth=active?60:charging?45:29;c.stroke();
  c.globalAlpha=active?.56:charging?.32:.09;
  c.strokeStyle='#e1fcff';c.lineWidth=active?3.7:2.2;c.stroke();
 }
 c.restore();
}

// Scenic stones wrap beyond the visible hazard boundary, never through its center.
export function meteorSceneryPosition(field,index,time,reduced=false){
 const width=field.r*2.28;
 const mx=(hash(index,17,field.id.length)-.5)*width;
 const my=(hash(index,23,field.id.length)-.5)*width;
 const drift=reduced?0:time*(10+(index%4)*5);
 const x=((mx+drift+width*1.5)%width+width)%width-width*.5;
 const y=((my+drift*.65+width*1.5)%width+width)%width-width*.5;
 const fade=Math.max(0,Math.min(1,(field.r-Math.hypot(x,y))/140));
 return {x,y,fade};
}
export function drawSpaceAnomalies(game,c,cam){
 const time=game.time;
 const reduced=game.visuals?.reducedMotion||game.fps<34;
 for(const f of game.world.anomalies||[]){
  if(!view(f,cam))continue;
  const color=colors[f.type],t=cycle(f,time);
  c.save();
  c.strokeStyle=color;c.fillStyle=color;
  c.translate(f.x,f.y);
  const glow=.12+.1*Math.sin(time*.8+f.phase);
  const atmosphere=typeof c.createRadialGradient==='function'?
   c.createRadialGradient(0,0,12,0,0,f.r):null;
  if(atmosphere?.addColorStop){
   atmosphere.addColorStop(0,color+'56');
   atmosphere.addColorStop(.55,color+'20');
   atmosphere.addColorStop(1,color+'00');
   c.globalAlpha=.42;c.fillStyle=atmosphere;
  }else c.globalAlpha=glow;
  c.beginPath();c.arc(0,0,f.r,0,TAU);c.fill();
  c.globalAlpha=.58;
  if(f.type==='gravity'){
   c.globalCompositeOperation='lighter';
   const disk=typeof c.createRadialGradient==='function'?
    c.createRadialGradient(0,0,78,0,0,420):null;
   if(disk?.addColorStop){
    disk.addColorStop(0,'#050516');disk.addColorStop(.23,'#5d309f');
    disk.addColorStop(.36,'#ffc1a5');disk.addColorStop(.46,'#8850d8');
    disk.addColorStop(1,'#3b278000');
    c.globalAlpha=.48;c.fillStyle=disk;c.beginPath();c.ellipse(0,0,500,310,time*.13,0,TAU);c.fill();
   }
   c.globalAlpha=.63;
   for(let i=0;i<6;i++){
    const r=95+i*120+Math.sin(time*.55+i)*14;
    c.lineWidth=2+i*.7;c.beginPath();
    c.ellipse(0,0,r,r*(.67+i*.034),time*.11+i*.27,0,TAU);c.stroke();
   }
   c.globalCompositeOperation='source-over';c.fillStyle='#060816';c.globalAlpha=.93;
   c.beginPath();c.arc(0,0,92,0,TAU);c.fill();
   c.strokeStyle='#e5b7ff';c.lineWidth=6;c.beginPath();c.arc(0,0,100,0,TAU);c.stroke();
  }else if(f.type==='wrecks'){
   drawAnomalyWrecks(c,f,time,reduced);
  }else{
   const charging=t>=17&&t<22,active=t>=22&&t<25;
   c.globalAlpha=active?.84:charging?.52:.13;
   c.lineWidth=active?7:charging?4:1.5;
   for(let i=0;i<4;i++){
    const r=f.r*(.24+i*.24)+Math.sin(time*1.2+i)*14;
    c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();
   }
   if(f.type==='pulsar'){
    c.rotate(time*.21);c.globalCompositeOperation='lighter';
    c.strokeStyle='#c25cff';c.lineWidth=58;c.globalAlpha=active?.22:.09;
    c.beginPath();c.moveTo(-f.r*.94,0);c.lineTo(f.r*.94,0);c.stroke();
    c.strokeStyle='#ffe2fb';c.lineWidth=active?15:6;c.globalAlpha=active?.9:.43;
    c.beginPath();c.moveTo(-f.r*.9,0);c.lineTo(f.r*.9,0);c.stroke();
    c.globalAlpha=1;c.fillStyle='#ffeffc';c.beginPath();c.arc(0,0,45,0,TAU);c.fill();
   }
   if(f.type==='ion'&&!reduced&&game.fps>=44)
    drawIonFilaments(c,f,time,charging,active);
   if(f.type==='ion'&&!reduced&&(charging||active)){
    c.globalCompositeOperation='lighter';c.strokeStyle='#cff9ff';
    c.globalAlpha=active?.8:.48;c.lineWidth=active?5:2.4;
    for(let bolt=0;bolt<6;bolt++){
     const a=bolt*TAU/6+f.phase+time*.12;
     c.beginPath();
     for(let j=0;j<14;j++){
      const r=f.r*(.16+j*.057);
      const jitter=Math.sin(j*2.8+bolt*5+Math.floor(time*10))*(12+j*.8);
      const x=Math.cos(a)*r-Math.sin(a)*jitter,y=Math.sin(a)*r+Math.cos(a)*jitter;
      if(j===0)c.moveTo(x,y);else c.lineTo(x,y);
     }
     c.stroke();
    }
   }
   if(f.type==='meteor'){
    for(let i=0;i<12;i++){
     const {x,y,fade}=meteorSceneryPosition(f,i,time,reduced);
     if(!fade)continue;
     // Share the licensed animation atlas with ordinary rocks; no second download.
     const rotator=game.visuals?.rotatingAsteroids;
     let painted=false;
     if(rotator?.image){
      c.save();c.translate(x,y);c.globalAlpha=.55*fade;
      painted=rotator.drawIncoming(c,{serial:Math.floor(f.phase*1000)},i,time*.1+i*.37,30+(i%4)*9);
      c.restore();
     }
     const rock=game.images?.rock;
     if(!painted&&rock?.complete&&rock.naturalWidth){
      c.globalAlpha=.55*fade;c.drawImage(rock,x-15,y-15,30+(i%4)*9,30+(i%4)*9);
     }
     if(!reduced){
      c.strokeStyle=active?'#ffe9be':'#fcb579';c.globalAlpha=(active?.9:.32)*fade;
      c.lineWidth=3+(i%3);c.beginPath();c.moveTo(x-90,y-65);c.lineTo(x+12,y+8);c.stroke();
     }
    }
   }
  }
  c.restore();
  if(distance(f,game.player)<f.r+900){
   c.save();c.textAlign='center';c.font='bold 12px system-ui';
   c.fillStyle=color;c.fillText(labels[f.type],f.x,f.y-f.r-35);c.restore();
  }
 }
 // The playable sector has a real edge, visible well before collision.
 const radius=POPULATION.radius;
 if(Math.abs(distance(game.player,{x:0,y:0})-radius)<Math.max(cam.w,cam.h)*1.8){
  c.save();c.strokeStyle='#93bafa66';c.lineWidth=11;
  c.setLineDash([130,65]);c.beginPath();c.arc(0,0,radius,0,TAU);c.stroke();
  c.setLineDash([]);c.restore();
 }
}
