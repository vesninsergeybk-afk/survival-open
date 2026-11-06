import {pendingContourTrials,trialBlockingField} from './contour-trials.js';

// The unstable core is visible in the physical world before the real
// vortex can start producing flux. Follows the field across camera movement.
export function drawUnstableContour(c,game,field,now){
 const pending=trialBlockingField(game.world,field);
 if(!pending)return false;
 const pulse=game.visuals?.reducedMotion?0:.5+.5*Math.sin(now*3.2+pending.id);
 const x=pending.x,y=pending.y,r=43+pulse*13;
 c.save();c.translate(x,y);
 c.globalCompositeOperation='lighter';
 const glow=c.createRadialGradient(0,0,7,0,0,r*2.6);
 glow.addColorStop(0,'rgba(244,80,43,.23)');
 glow.addColorStop(.45,'rgba(250,150,65,.10)');
 glow.addColorStop(1,'rgba(255,170,90,0)');
 c.fillStyle=glow;c.beginPath();c.arc(0,0,r*2.6,0,Math.PI*2);c.fill();
 c.globalCompositeOperation='source-over';
 c.strokeStyle='rgba(255,175,106,.75)';c.lineWidth=2.5;
 c.setLineDash([11,10]);c.lineDashOffset=-now*18;
 c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();
 c.setLineDash([]);c.fillStyle='rgba(32,11,28,.88)';
 c.beginPath();c.arc(0,0,12,0,Math.PI*2);c.fill();
 c.fillStyle='#ffd69d';c.font='bold 17px system-ui';c.textAlign='center';
 c.textBaseline='middle';c.fillText('!',0,1);
 c.font='bold 10px system-ui';
 c.fillText('ИСПЫТАНИЕ '+pending.tier+'/12',0,-r-14);
 c.restore();return true;
}

// Independent screen-space banner: no modal window or button can interrupt
// dodging. Keeps the wave count visible even when ordinary notices expire.
export function drawContourTrialHUD(c,game){
 const event=game.contourTrial;
 if(!event||game.dead)return;
 const vw=game.vw||1200,w=Math.min(356,vw-26),x=(vw-w)/2,y=20;
 const phase=event.phase;
 const remaining=phase==='wave'?game.enemies.filter(e=>
  e.trialId===event.entry.id&&e.hp>0&&!e.converted).length:0;
 const subtitle=phase==='warning'?'АТАКА ЧЕРЕЗ '+Math.max(0,Math.ceil(event.nextWaveAt-game.time))+' С':
  phase==='rest'?'ПОДКРЕПЛЕНИЕ ЧЕРЕЗ '+Math.max(0,Math.ceil(event.nextWaveAt-game.time))+' С':
  'ВОЛНА '+(event.waveIndex+1)+'/'+event.plan.waves.length+' · ЦЕЛЕЙ '+remaining;
 c.save();
 c.fillStyle='rgba(8,20,33,.91)';c.strokeStyle='rgba(255,182,115,.72)';
 c.lineWidth=1.4;c.beginPath();c.roundRect(x,y,w,60,10);c.fill();c.stroke();
 c.fillStyle='#ffe7c2';c.font='bold 12px system-ui';c.textAlign='center';
 c.fillText('СТАБИЛИЗАЦИЯ КОНТУРА · УГРОЗА '+event.plan.tier+'/12',vw/2,y+21,w-12);
 c.fillStyle='#ffbe8b';c.font='bold 11px system-ui';
 c.fillText(subtitle,vw/2,y+39,w-12);
 const fraction=phase==='wave'?(event.waveIndex+1)/event.plan.waves.length:
  phase==='rest'?(event.waveIndex+1)/event.plan.waves.length:0;
 c.fillStyle='rgba(255,190,126,.15)';c.fillRect(x+12,y+49,w-24,3);
 c.fillStyle='#ffa66d';c.fillRect(x+12,y+49,(w-24)*fraction,3);
 c.restore();
}

export function pendingTrialMapArtwork(world,center,scale,atlasPoint){
 return pendingContourTrials(world).map(e=>{
  const p=atlasPoint(e,center,scale);
  if(p.x<12||p.x>668||p.y<12||p.y>468)return '';
  return `<g class="contour-pending-trial" role="img" aria-label="Нестабильный контур. Испытание ${e.tier} из 12" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})">
   <circle r="17" fill="#321c24ee" stroke="#ffba74" stroke-width="2" stroke-dasharray="5 4"/>
   <text text-anchor="middle" y="5" fill="#ffe8cc" font-size="14" font-weight="900">!</text>
   <title>Испытание ${e.tier}/12. Подлетите к области: контур уже замкнут, добыча начнётся после победы.</title></g>`;
 }).join('');
}
