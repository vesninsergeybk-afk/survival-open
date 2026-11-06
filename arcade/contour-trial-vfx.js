import {CONTOUR_TRIALS,pendingContourTrials,trialBlockingField,planContourTrial} from './contour-trials.js?v=clarity-pass-1';

// The unstable core is visible in the physical world before the real
// vortex can start producing flux. Follows the field across camera movement.
export function drawUnstableContour(c,game,field,now){
 const pending=trialBlockingField(game.world,field);
 if(!pending)return false;
 const event=game.contourTrial?.entry?.id===pending.id?game.contourTrial:null;
 const pulse=game.visuals?.reducedMotion?0:.5+.5*Math.sin(now*3.2+pending.id);
 const x=pending.x,y=pending.y,r=43+pulse*13;
 c.save();c.translate(x,y);
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
 c.font='bold 10px system-ui';
 c.fillText(event?'ОБОРОНА КОНТУРА':'ТРЕУГОЛЬНИК НЕСТАБИЛЕН',0,-r-14);
 c.restore();
 if(event){
  // Illuminate up to three ACTUAL supporting stations: the event belongs
  // to newly enclosed territory, not to an incidental enemy patrol.
  c.save();c.lineWidth=1.8;c.setLineDash([13,11]);
  c.lineDashOffset=game.visuals?.reducedMotion?0:-now*19;
  let count=0;
  for(const id of field.vertices||[]){
   const station=game.world.stations.get(id);
   if(!station)continue;
   c.strokeStyle=count%2?'rgba(116,243,223,.36)':'rgba(248,126,182,.45)';
   c.beginPath();c.moveTo(station.x,station.y);c.lineTo(x,y);c.stroke();
   if(++count>=3)break;
  }
  c.restore();
 }
 return true;
}

// Independent screen-space banner: no modal window or button can interrupt
// dodging. Keeps the wave count visible even when ordinary notices expire.
export function drawContourTrialHUD(c,game){
 const event=game.contourTrial;
 if(game.dead)return;
 if(!event){
  const result=game.contourFeedback;
  if(!result||game.time-result.at>5)return;
  const vw=game.vw||1200,w=Math.min(356,vw-26),x=(vw-w)/2,y=20;
  c.save();c.fillStyle='rgba(9,42,39,.94)';c.strokeStyle='#8ef0d4';c.lineWidth=1.6;
  c.beginPath();c.roundRect(x,y,w,62,10);c.fill();c.stroke();
  c.textAlign='center';c.fillStyle='#c6ffe6';c.font='bold 14px system-ui';
  c.fillText('КОНТУР ЗАЩИЩЁН · ПОБЕДА',vw/2,y+25,w-18);
  c.font='bold 11px system-ui';c.fillText('Воронка запущена · флюкс поступает в сеть',vw/2,y+45,w-18);
  c.restore();return;
 }
 const vw=game.vw||1200,w=Math.min(356,vw-26),x=(vw-w)/2,y=20;
 const phase=event.phase;
 const irisRush=phase==='wave'&&game.enemies.some(e=>e.trialId===event.entry.id&&
  e.hp>0&&e._trialDive?.phase==='rush');
 const defeatedInWave=event.waveIds?.filter(id=>event.defeatedIds?.has(id)).length||0;
 const waveTotal=event.waveIds?.length||0;
 const secondsLeft=Math.max(0,Math.ceil(CONTOUR_TRIALS.maxWaveSeconds-(game.time-(event.waveStartedAt||game.time))));
 const subtitle=event.waitingForSpace?'ВОЛНА ГОТОВА · СНАЧАЛА РАСЧИСТИТЕ ПОДХОДЫ':
  phase==='warning'?'ВСЕГО '+event.plan.waves.length+' ВОЛН · АТАКА ЧЕРЕЗ '+Math.max(0,Math.ceil(event.nextWaveAt-game.time))+' С':
  phase==='rest'?'ВОЛНА '+(event.waveIndex+1)+' ИЗ '+event.plan.waves.length+' ОТРАЖЕНА · ПАУЗА '+Math.max(0,Math.ceil(event.nextWaveAt-game.time))+' С':
  'ВОЛНА '+(event.waveIndex+1)+' ИЗ '+event.plan.waves.length+' · ПОДАВЛЕНО '+defeatedInWave+'/'+waveTotal+' · '+secondsLeft+' С'+
  (irisRush?' · РЫВОК!':'');
 c.save();
 c.fillStyle='rgba(8,20,33,.91)';c.strokeStyle='rgba(255,182,115,.72)';
 c.lineWidth=1.4;c.beginPath();c.roundRect(x,y,w,60,10);c.fill();c.stroke();
 c.fillStyle='#ffe7c2';c.font='bold 12px system-ui';c.textAlign='center';
 c.fillText('ОБОРОНА НОВОГО ТРЕУГОЛЬНИКА',vw/2,y+21,w-12);
 c.fillStyle='#ffbe8b';c.font='bold 11px system-ui';
 c.fillText(subtitle,vw/2,y+39,w-12);
 const fraction=phase==='wave'?(event.waveIndex+
   defeatedInWave/Math.max(1,event.waveIds?.length||1))/event.plan.waves.length:
  phase==='rest'?(event.waveIndex+1)/event.plan.waves.length:0;
 c.fillStyle='rgba(255,190,126,.15)';c.fillRect(x+12,y+49,w-24,3);
 c.fillStyle='#ffa66d';c.fillRect(x+12,y+49,(w-24)*fraction,3);
 c.restore();
}

export function pendingTrialMapArtwork(world,center,scale,atlasPoint){
 return pendingContourTrials(world).map(e=>{
  const p=atlasPoint(e,center,scale);
  if(p.x<12||p.x>668||p.y<12||p.y>468)return '';
  const count=planContourTrial(e.tier,e.id).waves.length;
  const wording=count===1?'одну волну':count===2?'две волны':'три волны';
  return `<g class="contour-pending-trial" role="img" aria-label="Нестабильный контур. Отразите ${wording}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})">
   <circle r="17" fill="#321c24ee" stroke="#ffba74" stroke-width="2" stroke-dasharray="5 4"/>
   <text text-anchor="middle" y="5" fill="#ffe8cc" font-size="14" font-weight="900">!</text>
   <title>Враг обнаружил новый треугольник. Подлетите к полю и отразите ${wording}, чтобы запустить добычу.</title></g>`;
 }).join('');
}
