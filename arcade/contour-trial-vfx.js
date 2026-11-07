import {CONTOUR_TRIALS,pendingContourTrials,trialBlockingField,planContourTrial,trialQuota} from './contour-trials.js?v=clarity-pass-1-first-loops-1-pressure-1';

// An actual short-range interaction beam, not a decorative blue extraction
// ray. Forks are deterministic, so reduced motion and low FPS stay readable.
function drawCoreIgnition(c,source,now,calm){
 const dx=-source.x,dy=-source.y,d=Math.hypot(dx,dy)||1;
 const nx=-dy/d,ny=dx/d;
 const path=()=>{
  c.beginPath();
  for(let i=0;i<=12;i++){
   const t=i/12,wobble=(calm?0:Math.sin(i*2.8+now*19)*4.5)*Math.sin(Math.PI*t);
   const x=source.x+dx*t+nx*wobble,y=source.y+dy*t+ny*wobble;
   if(i)c.lineTo(x,y);else c.moveTo(x,y);
  }
 };
 c.save();c.lineCap='round';c.globalCompositeOperation='lighter';
 path();c.strokeStyle='rgba(255,60,72,.24)';c.lineWidth=12;c.stroke();
 path();c.strokeStyle='#ff465d';c.lineWidth=4;c.stroke();
 path();c.strokeStyle='#ffe0c6';c.lineWidth=1.5;c.stroke();
 for(const [t,side] of [[.23,1],[.46,-1],[.69,1],[.81,-1]]){
  const x=source.x+dx*t,y=source.y+dy*t;
  const spread=14+22*(1-t),forward=dx/d*spread*.55,advance=dy/d*spread*.55;
  c.beginPath();c.moveTo(x,y);
  c.lineTo(x+nx*spread*.55*side+forward*.5,y+ny*spread*.55*side+advance*.5);
  c.lineTo(x+nx*spread*side+forward,y+ny*spread*side+advance);
  c.strokeStyle='rgba(255,103,82,.94)';c.lineWidth=2.1;c.stroke();
 }
 c.restore();
}

// The unstable core is visible in the physical world before the real
// vortex can start producing flux. Follows the field across camera movement.
export function drawUnstableContour(c,game,field,now){
 const pending=trialBlockingField(game.world,field);
 if(!pending)return false;
 const event=game.contourTrial?.entry?.id===pending.id?game.contourTrial:null;
 const charge=event?Math.min(1,event.charge/event.chargeGoal):0;
 const channeling=!!event&&game.actionHeld?.kind==='contour'&&
  game.actionHeld.target?.id===pending.id&&
  Math.hypot(game.player.x-pending.x,game.player.y-pending.y)<=CONTOUR_TRIALS.activationRadius;
 const pulse=game.visuals?.reducedMotion?0:.5+.5*Math.sin(now*3.2+pending.id);
 const x=pending.x,y=pending.y,r=43+pulse*13;
 c.save();c.translate(x,y);
 if(channeling)drawCoreIgnition(c,{x:game.player.x-x,y:game.player.y-y},now,
  !!game.visuals?.reducedMotion);
 c.globalCompositeOperation='lighter';
 const glow=c.createRadialGradient(0,0,7,0,0,r*2.6);
 glow.addColorStop(0,event?'rgba(248,66,119,.30)':'rgba(240,158,75,.19)');
 glow.addColorStop(.45,event?'rgba(207,89,236,.13)':'rgba(250,150,65,.10)');
 glow.addColorStop(1,'rgba(255,170,90,0)');
 c.fillStyle=glow;c.beginPath();c.arc(0,0,r*2.6,0,Math.PI*2);c.fill();
 c.globalCompositeOperation='source-over';
 c.strokeStyle=event?'rgba(255,113,160,.9)':'rgba(255,175,106,.75)';c.lineWidth=2.5;
 c.setLineDash([11,10]);c.lineDashOffset=-now*18;
 c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();
 c.setLineDash([]);c.fillStyle='rgba(32,11,28,.88)';
 c.beginPath();c.arc(0,0,12,0,Math.PI*2);c.fill();
 c.fillStyle=event?'#ffe1ec':'#ffd69d';c.font='bold 17px system-ui';c.textAlign='center';
 c.textBaseline='middle';c.fillText('!',0,1);
 if(event){
  c.strokeStyle='rgba(255,85,97,.22)';c.lineWidth=6;c.beginPath();
  c.arc(0,0,r+8,0,Math.PI*2);c.stroke();
  c.strokeStyle=channeling?'#ffe0b9':'#ff5b67';c.beginPath();
  c.arc(0,0,r+8,-Math.PI/2,-Math.PI/2+Math.PI*2*charge);c.stroke();
 }
 c.font='bold 10px system-ui';
 c.fillText(event?'ЗАРЯД ЯДРА · '+Math.round(charge*100)+'%':
  'ЯДРО ОЖИДАЕТ ЗАПУСКА',0,-r-14);
 c.restore();
 if(event){
  // Illuminate up to three ACTUAL supporting stations: the event belongs
  // to newly enclosed territory, not to an incidental enemy patrol.
  c.save();c.lineWidth=3.1;c.setLineDash([13,11]);
  c.lineDashOffset=game.visuals?.reducedMotion?0:-now*19;
  let count=0;
  for(const id of field.vertices||[]){
   const station=game.world.stations.get(id);
   if(!station)continue;
   c.strokeStyle=count%2?'rgba(255,125,96,.70)':'rgba(255,70,93,.76)';
   c.beginPath();c.moveTo(station.x,station.y);c.lineTo(x,y);c.stroke();
   if(++count>=3)break;
  }
  c.strokeStyle=event.outsideFor?'rgba(255,106,122,.6)':'rgba(255,183,113,.28)';
  c.lineWidth=3;c.setLineDash([24,18]);
  c.beginPath();c.arc(x,y,CONTOUR_TRIALS.retreatRadius,0,Math.PI*2);c.stroke();
  c.restore();
 }
 return true;
}

// Independent screen-space banner: no modal window or button can interrupt
// dodging. Keeps the wave count visible even when ordinary notices expire.
export function drawContourTrialHUD(c,game){
 const event=game.contourTrial;
 if(game.dead)return;
 const virtualWidth=game.vw||1200,vw=game.canvas?.clientWidth||virtualWidth;
 const uiScale=virtualWidth/vw,w=Math.min(470,vw-26),x=(vw-w)/2;
 const y=game.isTouchLayout?76:20;
 if(!event){
  const result=game.contourFeedback;
  if(!result?.victory||game.time-result.at>7)return;
  c.save();c.scale(uiScale,uiScale);c.fillStyle='rgba(9,42,39,.94)';c.strokeStyle='#8ef0d4';c.lineWidth=1.6;
  c.beginPath();c.roundRect(x,y,w,79,10);c.fill();c.stroke();
  c.textAlign='center';c.fillStyle='#c6ffe6';c.font='bold 14px system-ui';
  c.fillText('ТРЕУГОЛЬНИК ЗАЩИЩЁН',vw/2,y+23,w-18);
  c.font='bold 12px system-ui';c.fillText('+'+result.alloy+' сплава · +'+result.xp+' опыта',vw/2,y+44,w-18);
  c.fillText(result.unlocked?'Открыто: '+result.unlocked:'Территория сетевых способностей расширена',vw/2,y+64,w-18);
  c.restore();return;
 }
 const phase=event.phase;
 const irisRush=phase==='wave'&&game.enemies.some(e=>e.trialId===event.entry.id&&e.hp>0&&e._trialDive?.phase==='rush');
 const defeated=event.waveIds?.filter(id=>event.defeatedIds?.has(id)).length||0;
 const total=event.waveIds?.length||0;
 const quota=event.required??trialQuota(total,event.plan.tier);
 const seconds=Math.max(0,Math.ceil(CONTOUR_TRIALS.maxWaveSeconds-(game.time-(event.waveStartedAt??game.time))));
 const waveName=event.plan.tier===1?['РАЗВЕДКА','ТАРАННЫЙ НАЛЁТ','ПОСЛЕДНИЙ ШТУРМ'][event.waveIndex]:null;
 const channeling=game.actionHeld?.kind==='contour'&&
  game.actionHeld.target?.id===event.entry.id&&
  Math.hypot(game.player.x-event.entry.x,game.player.y-event.entry.y)<=CONTOUR_TRIALS.activationRadius;
 const beamOutOfRange=game.actionHeld?.kind==='contour'&&!channeling;
 const input=game.isTouchLayout?'«Действие»':(game.controlLabel?.('interact')||'E');
 const fraction=Math.min(1,event.charge/event.chargeGoal);
 const subtitle=event.outsideFor>0?'ВЕРНИТЕСЬ В ЗОНУ · '+Math.max(0,Math.ceil(CONTOUR_TRIALS.retreatSeconds-event.outsideFor))+' С':
  event.waitingForSpace?'ДРУГОЙ БОЙ ЗАНИМАЕТ СЕКТОР · НАПАДЕНИЕ ОЖИДАЕТ':
  phase==='stabilize'?'УДАР ЧЕРЕЗ '+Math.max(0,Math.ceil(event.nextStrikeAt-game.time))+' С · ЗАВЕРШИТЕ ЗАРЯДКУ':
  phase==='warning'?'АТАКА ЧЕРЕЗ '+Math.max(0,Math.ceil(event.nextWaveAt-game.time))+' С · ВСЕГО ВОЛН: '+event.plan.waves.length:
  phase==='rest'?'ВОЛНА ОТРАЖЕНА · СЛЕДУЮЩАЯ ЧЕРЕЗ '+Math.max(0,Math.ceil(event.nextWaveAt-game.time))+' С':
  (waveName?waveName+' · ':'')+'ПОБЕДИТЬ '+Math.min(defeated,quota)+' / '+quota+' · '+seconds+' С';
 const markedZone=game.zones?.some(z=>z.antiCamp&&z.trialId===event.entry.id&&z.fuse>0);
 const hint=markedZone?'ВАС ЗАСЕКЛИ НА МЕСТЕ · УЙДИТЕ ИЗ КРУГА':
  fraction>=1?'Заряд готов · осталось отразить нападения':
  channeling?'ЛУЧ РАБОТАЕТ · стрельба корабля остановлена':
  beamOutOfRange?'ЛУЧ ПРЕРВАН · подлетите ближе или отпустите действие':
  phase==='wave'&&irisRush?'Зрачок готовит рывок · уклонитесь и вернитесь к ядру':
  phase==='rest'?'Передышка короткая · подлетите и удерживайте '+input:
  'Удерживайте '+input+' у ядра · отпустите для стрельбы, заряд сохранится';
 c.save();c.scale(uiScale,uiScale);c.fillStyle='rgba(8,20,33,.94)';c.strokeStyle=event.outsideFor?'#ff7e85':'#ffb673';
 c.lineWidth=1.4;c.beginPath();c.roundRect(x,y,w,113,10);c.fill();c.stroke();
 c.fillStyle='#ffe7c2';c.font='bold 14px system-ui';c.textAlign='center';
 c.fillText('ОБОРОНА КОНТУРА · '+(phase==='stabilize'?'ЗАРЯДКА':phase==='rest'?'ПЕРЕДЫШКА':event.waveIndex<0?'ПОДГОТОВКА':
  'ВОЛНА '+(event.waveIndex+1)+'/'+event.plan.waves.length),vw/2,y+19,w-16);
 c.fillStyle='#ffbe8b';c.font='bold 12px system-ui';c.fillText(subtitle,vw/2,y+39,w-16);
 c.fillStyle='#cee0e5';c.font='11px system-ui';c.fillText(hint,vw/2,y+58,w-16);
 c.fillStyle='#ffc4b6';c.font='bold 11px system-ui';
 c.fillText('ЗАРЯД '+Math.round(fraction*100)+'% · '+event.charge.toFixed(1).replace('.',',')+
  ' / '+event.chargeGoal.toFixed(1).replace('.',',')+' с',vw/2,y+76,w-20);
 c.fillStyle='#ff72752d';c.fillRect(x+12,y+82,w-24,5);
 c.fillStyle=channeling?'#ffe2b4':'#ff7377';c.fillRect(x+12,y+82,(w-24)*fraction,5);
 const waveFraction=phase==='stabilize'?1:
  phase==='wave'?(event.waveIndex+Math.min(1,defeated/Math.max(1,quota)))/event.plan.waves.length:
  phase==='rest'?(event.waveIndex+1)/event.plan.waves.length:0;
 c.fillStyle='#e8d3b3';c.font='10px system-ui';
 c.fillText('ОТРАЖЕНО ВОЛН: '+(phase==='stabilize'?event.plan.waves.length:
  Math.max(0,event.waveIndex+(phase==='rest'?1:0)))+
  ' / '+event.plan.waves.length,vw/2,y+100,w-20);
 c.fillStyle='#ffbe7e26';c.fillRect(x+12,y+105,w-24,3);
 c.fillStyle='#ffa66d';c.fillRect(x+12,y+105,(w-24)*waveFraction,3);c.restore();
}

export function pendingTrialMapArtwork(world,center,scale,atlasPoint){
 return pendingContourTrials(world).map(e=>{
  const p=atlasPoint(e,center,scale);
  if(p.x<12||p.x>668||p.y<12||p.y>468)return '';
  const count=planContourTrial(e.tier,e.id).waves.length;
  const wording=count===1?'одну волну':count===2?'две волны':'три волны';
  return `<g class="contour-pending-trial" role="img" aria-label="Нестабильный контур. Запустите сердцевину и отразите ${wording}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})">
   <circle r="17" fill="#321c24ee" stroke="#ffba74" stroke-width="2" stroke-dasharray="5 4"/>
   <text text-anchor="middle" y="5" fill="#ffe8cc" font-size="14" font-weight="900">!</text>
   <title>Новая сердцевина ожидает зарядки. Подлетите к знаку, удерживайте луч несколько раз и отразите ${wording}, чтобы начать добычу.</title></g>`;
 }).join('');
}
