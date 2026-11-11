import {contourFields,fieldAt} from './territory-system.js?v=contours-1-world-feedback-1-flux-offense-1-contour-trials-1-triangle-defense-1';
import {activeContourTransition,fieldIsNew} from './contour-dynamics.js?v=contour-dynamics-2-auto-1';
import {enemyTerritoryFields} from './enemy-expansion.js?v=enemy-expansion-1-enemy-balance-2-living-world-population-1-sector-density-2';
import {drawContourVortexArt} from './contour-vortex-art.js?v=contour-vortex-80frames-1';
import {drawUnstableContour} from './contour-trial-vfx.js?v=swarm-siege-1-corecharge-20261110-core-pressure-20261110';
import {trialBlockingField} from './contour-trials.js?v=swarm-siege-1-corecharge-20261110-core-pressure-20261110';
import {drawSiphon3,SIPHON3_WORLD_SIZE} from './siphon3-art.js?v=siphon3-rig-3-flux-build-1';

const visible=(p,cam,r=200)=>p.x>=cam.x-r&&p.x<=cam.x+cam.w+r&&
 p.y>=cam.y-r&&p.y<=cam.y+cam.h+r;
const polygonPath=(ctx,polygon)=>polygon.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
const intersectsCamera=(polygon,cam,pad=120)=>polygon.some(p=>visible(p,cam,pad))||
 (Math.min(...polygon.map(p=>p.x))<cam.x+cam.w+pad&&
  Math.max(...polygon.map(p=>p.x))>cam.x-pad&&
  Math.min(...polygon.map(p=>p.y))<cam.y+cam.h+pad&&
  Math.max(...polygon.map(p=>p.y))>cam.y-pad);

// Canvas world-space artwork with two small, shared vortex atlas textures.
export function drawContourWorld(game,c,cam){
 const now=game.time;
 if(now-(game.contourVisualAt||-Infinity)>.4||!game.contourVisualFields){
  game.contourVisualFields=contourFields(game.world);game.contourVisualAt=now;
 }
 const fields=game.contourVisualFields;
 const links=game.world.contours?.links||[];
 if(now-(game.enemyContourVisualAt||-Infinity)>.4||!game.enemyContourVisualFields){
  game.enemyContourVisualFields=enemyTerritoryFields(game.world);
  game.enemyContourVisualAt=now;
 }
 const enemyFields=game.enemyContourVisualFields;
 const enemyLinks=game.world.enemyExpansion?.links||[];
 const transition=activeContourTransition(game);
 const fluxSortie=game.world.contours?.sortie;
 const liveJammers=[],liveBreaches=[];
 for(const b of game.world.stations.values()){
  if((b.fluxJamUntil||0)>now)liveJammers.push(b);
  if(b.enemy&&(b.fluxBreachUntil||0)>now)liveBreaches.push(b);
 }
 if(!fields.length&&!links.length&&!transition&&!enemyFields.length&&!enemyLinks.length&&
  !fluxSortie&&!liveJammers.length&&!liveBreaches.length)return;
 const calm=!!game.visuals?.reducedMotion,lowFps=game.fps<34;
 const elapsed=transition?Math.max(0,now-transition.at):Infinity;
 const energyEdges=new Set(transition?.kind==='claim'?transition.current
  .filter(f=>fieldIsNew(f,transition.previous))
  .flatMap(f=>f.vertices.map((id,i)=>[id,f.vertices[(i+1)%f.vertices.length]].sort().join('|'))):[]);
 c.save();
 // The hostile field is a physical structure too. Its lines and reactor
 // occupy the same world coordinates as the atlas, and disappear if a station
 // is captured or its transmitter goes dark.
 for(const [from,to] of enemyLinks){
  const a=game.world.stations.get(from),b=game.world.stations.get(to);
  if(!a?.enemy||!b?.enemy||a.suppressed||b.suppressed||a.hp<=0||b.hp<=0)continue;
  if(!intersectsCamera([a,b],cam))continue;
  c.save();c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);
  c.strokeStyle='rgba(255,105,107,.3)';c.lineWidth=3;c.setLineDash([16,14]);
  if(!calm)c.lineDashOffset=now*22%30;
  c.stroke();c.restore();
 }
 const enemyBirth=game.world.enemyExpansion?.events?.find(e=>e.kind==='claim'&&now-e.at>=0&&now-e.at<3);
 for(const f of enemyFields){
  if(!intersectsCamera(f.polygon,cam))continue;
  c.save();
  if(enemyBirth&&f.vertices.includes(enemyBirth.a)&&f.vertices.includes(enemyBirth.b)&&!calm){
   const r=Math.max(...f.polygon.map(p=>Math.hypot(p.x-f.center.x,p.y-f.center.y)));
   const fraction=Math.min(1,Math.max(0,(now-enemyBirth.at-.6)/1.8));
   c.beginPath();c.arc(f.center.x,f.center.y,r*fraction,0,Math.PI*2);c.clip();
  }
  c.beginPath();polygonPath(c,f.polygon);c.closePath();
  c.fillStyle='rgba(246,68,79,.045)';c.fill();
  c.strokeStyle='rgba(255,117,125,.28)';c.lineWidth=3;c.setLineDash([17,24]);c.stroke();
  c.setLineDash([]);c.restore();
  const angle=now*.75+f.area*.00001;
  c.save();c.translate(f.center.x,f.center.y);
  c.fillStyle='rgba(252,94,61,.3)';c.beginPath();c.arc(0,0,35+5*Math.sin(angle),0,Math.PI*2);c.fill();
  c.strokeStyle='rgba(255,180,98,.7)';c.lineWidth=3;
  c.beginPath();c.arc(0,0,19,angle,angle+Math.PI*1.35);c.stroke();
  c.fillStyle='#371a25';c.beginPath();c.arc(0,0,8,0,Math.PI*2);c.fill();c.restore();
 }
 // Links are real structures even before a field closes. Render them in the
 // physical world so the action on the atlas has an immediate visible result.
 for(const [from,to] of links){
  const a=game.world.stations.get(from),b=game.world.stations.get(to);
  if(!a||!b)continue;
  if(Math.max(a.x,b.x)<cam.x-140||Math.min(a.x,b.x)>cam.x+cam.w+140||
   Math.max(a.y,b.y)<cam.y-140||Math.min(a.y,b.y)>cam.y+cam.h+140)continue;
  const healthy=a.active&&b.active&&!a.enemy&&!b.enemy&&!a.suppressed&&!b.suppressed;
  c.save();c.lineCap='round';
  c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);
  c.strokeStyle=healthy?'rgba(33,211,196,.09)':'rgba(250,91,104,.11)';
  c.lineWidth=15;c.stroke();
  c.strokeStyle=healthy?'rgba(98,244,218,.56)':'rgba(255,115,129,.56)';
  c.lineWidth=2.8;c.setLineDash(healthy?[23,12]:[9,16]);
  if(!calm)c.lineDashOffset=-(now*35)%35;
  c.stroke();c.setLineDash([]);
  if(transition?.kind==='claim'&&elapsed<1.1&&energyEdges.has([from,to].sort().join('|'))){
   const progress=calm?1:Math.min(1,elapsed/1.1);
   c.beginPath();c.moveTo(a.x,a.y);c.lineTo(a.x+(b.x-a.x)*progress,a.y+(b.y-a.y)*progress);
   c.strokeStyle='rgba(255,229,171,.92)';c.lineWidth=5;c.shadowColor='#ffb866';c.shadowBlur=20;
   c.stroke();c.shadowBlur=0;
  }
  if(healthy&&!calm&&!lowFps){
   const t=((now*.1+(a.x+b.y)*.000013)%1+1)%1;
   const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
   if(visible({x,y},cam,25)){
    c.shadowColor='#7dffe5';c.shadowBlur=13;c.fillStyle='#dafff0';
    c.beginPath();c.arc(x,y,3.6,0,Math.PI*2);c.fill();
   }
  }
  c.restore();
 }
 for(const field of fields){
  const unstable=trialBlockingField(game.world,field);
  if(!visible(field.center,cam,950)&&!(unstable&&visible(unstable,cam,180)))continue;
  const animating=transition?.kind==='claim'&&!calm&&elapsed<2.5;
  if(animating){
   // The old/new intersection must stay visible throughout the fill.
   c.save();c.beginPath();polygonPath(c,field.polygon);c.closePath();c.clip();
   c.fillStyle='rgba(40,224,195,.035)';
   for(const old of transition.previous){
    c.beginPath();polygonPath(c,old.polygon);c.closePath();c.fill();
   }
   c.restore();
  }
  c.save();
  const forming=transition?.kind==='claim'&&fieldIsNew(field,transition.previous);
  if(animating){
   // First limit to the current face. Then subtract the precise old union
   // using the even-odd winding rule; the centroid may still be old land.
   c.beginPath();polygonPath(c,field.polygon);c.closePath();c.clip();
   c.beginPath();polygonPath(c,field.polygon);c.closePath();
   for(const old of transition.previous){polygonPath(c,old.polygon);c.closePath();}
   c.clip('evenodd');
   const radius=Math.max(...field.polygon.map(p=>Math.hypot(p.x-field.center.x,p.y-field.center.y)));
   const fill=Math.min(1,Math.max(0,(elapsed-1)/1.5));
   c.beginPath();c.arc(field.center.x,field.center.y,radius*fill,0,Math.PI*2);c.clip();
  }
  c.beginPath();polygonPath(c,field.polygon);c.closePath();
  c.fillStyle='rgba(40,224,195,.035)';c.fill();
  c.strokeStyle='rgba(79,235,198,.22)';c.lineWidth=4;c.setLineDash([34,28]);c.stroke();c.setLineDash([]);
  c.restore();
  if(forming&&elapsed<2.5&&!calm)continue;
  if(drawUnstableContour(c,game,field,now))continue;
  c.save();
  const {x,y}=field.center,phase=now*.72+field.area*.000001;
  const pulse=1+.085*Math.sin(now*1.55+field.area*.00001),r=64*pulse;
  const born=game.contourBirths?.find(item=>item.id===field.id);
  const age=born?now-born.at:Infinity;
  const rise=Math.max(0,Math.min(1,age/1.2));
  const arrival=born&&!calm?(age<0?0:age<1.2?rise*rise*(3-2*rise):1):1;
  c.translate(x,y);c.globalCompositeOperation='lighter';
  const glow=c.createRadialGradient(0,0,2,0,0,r*1.8);
  glow.addColorStop(0,'rgba(3,4,13,.75)');glow.addColorStop(.23,'rgba(255,118,25,.44)');
  glow.addColorStop(.48,'rgba(245,87,9,.23)');glow.addColorStop(1,'rgba(245,80,5,0)');
  c.globalAlpha=arrival;
  c.fillStyle=glow;c.beginPath();c.arc(0,0,r*1.8,0,Math.PI*2);c.fill();
  c.globalAlpha=1;
  if(!drawContourVortexArt(c,now,field,pulse,{reducedMotion:calm,birth:arrival})){
   // Keep the previous lightweight renderer if the atlas has not loaded,
   // the browser lacks Image support, or an individual sheet fails.
   c.globalAlpha=arrival;
  for(let arm=0;arm<7;arm++){
   c.beginPath();
   for(let step=0;step<=14;step++){
    const t=step/14,rad=13+t*r*(.86+.14*Math.sin(arm*7+phase));
    const angle=phase+arm*Math.PI*2/7+t*2.3;
    const px=Math.cos(angle)*rad,py=Math.sin(angle)*rad*.77;
    if(step)c.lineTo(px,py);else c.moveTo(px,py);
   }
   c.strokeStyle=arm%2?'rgba(255,113,24,.67)':'rgba(255,196,84,.85)';
   c.lineWidth=2.7+1.3*Math.sin(phase*2+arm);c.stroke();
  }
  c.strokeStyle='rgba(255,160,50,.68)';c.lineWidth=2.5;
  c.beginPath();c.ellipse(0,0,r*.8,r*.57,-phase*.22,.2,Math.PI*1.66);c.stroke();
  for(let k=0;k<11;k++){
   const angle=k*Math.PI*2/11+phase*.48;
   const radius=r*(.74+.15*Math.sin(k*11.7+phase*2));
   const leap=7+13*Math.pow(Math.max(0,Math.sin(phase*2.2+k*3.3)),3);
   c.strokeStyle='rgba(255,'+(116+k%3*28)+',44,.55)';c.lineWidth=1.2;
   c.beginPath();c.moveTo(Math.cos(angle)*radius,Math.sin(angle)*radius*.75);
   c.quadraticCurveTo(Math.cos(angle+.25)*(radius+leap),Math.sin(angle+.25)*(radius+leap),
    Math.cos(angle+.4)*(radius+leap*1.5),Math.sin(angle+.4)*(radius+leap*1.5)*.8);c.stroke();
  }
  c.globalCompositeOperation='source-over';
  c.fillStyle='#090b18';c.beginPath();c.ellipse(0,0,13,9,phase*.12,0,Math.PI*2);c.fill();
  c.strokeStyle='#ffe4a5';c.lineWidth=2;c.stroke();
  }
  c.restore();
  if(born){
   if(age>=0&&age<8){
    const fade=1-age/8;
    c.save();c.translate(x,y);c.lineWidth=2.5;
    c.strokeStyle='rgba(255,191,92,'+(fade*.7).toFixed(3)+')';
    c.beginPath();c.arc(0,0,94+(calm?0:age*45),0,Math.PI*2);c.stroke();
    if(age<4){
     c.font='bold 13px system-ui';c.textAlign='center';c.fillStyle='rgba(255,229,165,'+
      (1-age/4).toFixed(3)+')';c.fillText('НОВЫЙ КОНТУР',0,-116);
    }
    c.restore();
   }
  }
 }
 if(transition?.kind==='loss'&&elapsed<2.4){
  c.save();c.globalAlpha=(1-elapsed/2.4)*.52;
  for(const old of transition.previous){
   if(!visible(old.center,cam,950))continue;
   c.save();c.beginPath();old.polygon.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();
   for(const live of fields){
    live.polygon.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();
   }
   c.clip('evenodd');c.fillStyle='rgba(255,88,111,.18)';c.fillRect(cam.x,cam.y,cam.w,cam.h);
   c.strokeStyle='#ff909b';c.lineWidth=3;c.setLineDash([10,12]);
   c.beginPath();old.polygon.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.stroke();c.restore();
  }
  c.restore();
 }
 const byId=new Map(fields.map(f=>[f.id,f]));
 const activeRoutes=new Set();
 for(const h of game.world.contours.harvesters){
  const field=byId.get(h.fieldId);if(!field)continue;
  if(!activeRoutes.has(field.id)){
   activeRoutes.add(field.id);
   if(intersectsCamera([field.anchor,field.center],cam,45)){
    c.save();c.lineWidth=1.6;c.strokeStyle='rgba(132,251,219,.25)';
    c.setLineDash([8,14]);if(!calm)c.lineDashOffset=-now*12%22;
    c.beginPath();c.moveTo(field.anchor.x,field.anchor.y);
    c.lineTo(field.center.x,field.center.y);c.stroke();c.restore();
   }
  }
  const t=h.phase==='out'?Math.min(1,h.progress):h.phase==='back'?1-Math.min(1,h.progress):1;
  // A ten-ship flotilla occupies parallel lanes, not ten overlapping sprites.
  const fx=field.center.x-field.anchor.x,fy=field.center.y-field.anchor.y;
  const length=Math.hypot(fx,fy)||1;
  const lane=((h.workerIndex??0)%5-2)*13,spread=Math.sin(t*Math.PI)*lane;
  const x=field.anchor.x+fx*t-fy/length*spread;
  const y=field.anchor.y+fy*t+fx/length*spread;
  if(!visible({x,y},cam,Math.ceil(SIPHON3_WORLD_SIZE*1.08)))continue;
  if(h.phase==='gather'){
   c.save();c.strokeStyle='rgba(255,221,138,.8)';c.lineWidth=2;
   c.beginPath();c.arc(x,y,11+(calm?0:3*Math.sin(now*8)),0,Math.PI*2);c.stroke();c.restore();
  }
  // The live unit shares the same hinged, energy-reactive model as the QA lab.
  // Keep the former low-cost icon only if the texture is still loading.
  const direction=Math.atan2(field.center.y-field.anchor.y,field.center.x-field.anchor.x)+
   (h.phase==='back'?Math.PI:0);
  const seed=[...field.id].reduce((sum,ch)=>sum+ch.charCodeAt(0),0)+
   (h.launchedAt||0)*.67+(h.workerIndex||0)*19.73;
  if(!drawSiphon3(c,{x,y,angle:direction,phase:h.phase,progress:h.progress,
   time:now,seed,size:SIPHON3_WORLD_SIZE,reducedMotion:calm})){
   c.save();c.translate(x,y);c.rotate(direction+Math.PI/2);
   c.shadowBlur=10;c.shadowColor=h.phase==='back'?'#ffb553':'#93eede';
   c.fillStyle=h.phase==='back'?'#ffca74':'#bfffee';
   c.beginPath();c.ellipse(0,0,3.2,6.5,0,0,Math.PI*2);c.fill();
   c.fillStyle=h.phase==='back'?'rgba(255,179,90,.85)':'rgba(144,245,231,.83)';
   const flap=3+(calm?0:Math.sin(now*16+h.progress*6)*2);
   c.beginPath();c.ellipse(-5,-1,flap,5,-.45,0,Math.PI*2);
   c.ellipse(5,-1,flap,5,.45,0,Math.PI*2);c.fill();
   if(h.phase==='back'){
    c.shadowColor='#ffd88b';c.shadowBlur=14;c.fillStyle='#ffe9b4';
    c.beginPath();c.arc(0,9,3.4,0,Math.PI*2);c.fill();
   }
   c.restore();
  }
 }
 // An offensive siphon has a real world position. Its dotted approach line is
 // visible only locally, while its target remains a normal hostile station.
 if(fluxSortie){
  const target=game.world.stations.get(fluxSortie.targetId);
  if(target&&intersectsCamera([fluxSortie,target],cam,100)){
   c.save();c.beginPath();c.moveTo(fluxSortie.x,fluxSortie.y);c.lineTo(target.x,target.y);
   c.strokeStyle='rgba(142,250,228,.52)';c.lineWidth=2;c.setLineDash([8,12]);
   if(!calm)c.lineDashOffset=-now*30%20;c.stroke();c.setLineDash([]);c.restore();
  }
  if(target&&visible(fluxSortie,cam,70)){
   const angle=Math.atan2(target.y-fluxSortie.y,target.x-fluxSortie.x);
   c.save();c.shadowColor='#b4fff0';c.shadowBlur=16;
   c.strokeStyle='#a4ffef';c.lineWidth=2;
   c.beginPath();c.arc(fluxSortie.x,fluxSortie.y,26+(calm?0:Math.sin(now*6)*3),0,Math.PI*2);c.stroke();c.restore();
   if(!drawSiphon3(c,{x:fluxSortie.x,y:fluxSortie.y,angle,
    phase:'out',progress:Math.min(1,(now-fluxSortie.launchedAt)/18),time:now,
    seed:27,size:84*1.18,reducedMotion:calm})){
    c.save();c.translate(fluxSortie.x,fluxSortie.y);c.rotate(angle);
    c.fillStyle='#aefff1';c.beginPath();c.ellipse(0,0,10,6,0,0,Math.PI*2);c.fill();c.restore();
   }
   c.save();c.font='bold 12px system-ui';c.textAlign='center';c.fillStyle='#ddfff8';
   c.fillText('ПОСТАНОВЩИК ПОМЕХ',fluxSortie.x,fluxSortie.y-39);c.restore();
  }
 }
 for(const b of liveJammers){
  if(!visible(b,cam,125))continue;
  c.save();c.strokeStyle='#94f5ea';c.lineWidth=3;c.setLineDash([7,8]);
  c.beginPath();c.arc(b.x,b.y,135,0,Math.PI*2);c.stroke();c.setLineDash([]);
  if((b.fluxBreachProgress||0)>0&&!(b.fluxBreachUntil>now)){
   c.strokeStyle='#ffd08b';c.lineWidth=7;c.lineCap='round';
   c.beginPath();c.arc(b.x,b.y,135,-Math.PI/2,
    -Math.PI/2+Math.PI*2*Math.min(1,b.fluxBreachProgress/110));c.stroke();
   c.fillStyle='#ffe2a7';c.textAlign='center';c.font='bold 11px system-ui';
   c.fillText('ПРОРЫВ '+Math.round(b.fluxBreachProgress)+'/110',b.x,b.y-171);
  }
  c.textAlign='center';c.fillStyle='#bafff4';c.font='bold 12px system-ui';
  c.fillText('РАДИОПОМЕХИ · '+Math.ceil(b.fluxJamUntil-now)+' с',b.x,b.y-155);c.restore();
 }
 // The second act of the assault is deliberately a different visual state:
 // broken amber circuitry, stationary cargo docks and energy escaping through
 // gaps. The ring exists at the real depot, never as a screen-space HUD cue.
 for(const b of liveBreaches){
  if(!visible(b,cam,230))continue;
  c.save();c.translate(b.x,b.y);c.lineWidth=4.5;c.strokeStyle='#ffc16c';
  if(!calm&&!lowFps){c.shadowColor='#ff9d45';c.shadowBlur=15;}
  const angle=calm?0:now*.55;
  for(let i=0;i<4;i++){
   const a=angle+i*Math.PI/2;
   c.beginPath();c.arc(0,0,145,a,a+.84);c.stroke();
  }
  c.shadowBlur=0;c.strokeStyle='rgba(245,116,87,.82)';c.lineWidth=2;
  for(let i=0;i<3;i++){
   const a=i*Math.PI*2/3+(calm?0:now*.18),r=109+(calm?0:6*Math.sin(now*3+i));
   c.beginPath();c.moveTo(Math.cos(a)*r,Math.sin(a)*r);
   c.lineTo(Math.cos(a+.26)*(r+16),Math.sin(a+.26)*(r+16));c.stroke();
  }
  c.fillStyle='#ffe4bb';c.textAlign='center';c.font='bold 12px system-ui';
  c.fillText('СНАБЖЕНИЕ ОСТАНОВЛЕНО',0,-165);
  c.font='11px system-ui';c.fillText('РЕМОНТ ИЛИ '+Math.ceil(b.fluxBreachUntil-now)+' С',0,-149);
  c.restore();
 }
 const cover=game.support?.missions?.find(m=>m.mode==='cover'&&m.craft?.some(c=>c.hp>0));
 if(cover&&fieldAt(game.world,game.player.x,game.player.y,fields)&&visible(game.player,cam,160)){
  const p=game.player;
  c.save();c.translate(p.x,p.y);
  const strength=calm? .36 : .62+Math.sin(now*8)*.14;
  c.strokeStyle=`rgba(139,250,243,${strength})`;c.lineWidth=2.5;
  c.setLineDash([23,12]);if(!calm)c.lineDashOffset=-now*27%35;
  c.beginPath();c.arc(0,0,160,0,Math.PI*2);c.stroke();c.setLineDash([]);
  if(!lowFps&&!calm)for(let i=0;i<3;i++){
   const a=now*.85+i*Math.PI*2/3;
   c.fillStyle='#c0fff3';c.beginPath();c.arc(Math.cos(a)*160,Math.sin(a)*160,3.5,0,Math.PI*2);c.fill();
  }
  c.font='bold 11px system-ui';c.textAlign='center';c.fillStyle='#c8fff8';
  c.fillText('АВИАКРЫЛО СЕТИ',0,-177);
  c.restore();
 }
 // A delivery is acknowledged at the actual receiving station, not at an
 // arbitrary world-space point. The player's common flux purse is unchanged.
 for(const fx of game.contourDeliveryFX||[]){
  const field=byId.get(fx.fieldId),age=now-fx.at;
  if(!field||age<0||age>1.5||!visible(field.anchor,cam,70))continue;
  const p=age/1.5,fade=1-p;
  c.save();c.strokeStyle=`rgba(255,208,114,${(fade*.85).toFixed(3)})`;
  c.lineWidth=2.4;c.beginPath();c.arc(field.anchor.x,field.anchor.y,9+34*p,0,Math.PI*2);c.stroke();
  c.textAlign='center';c.font='bold 12px system-ui';
  c.fillStyle=`rgba(255,231,171,${fade.toFixed(3)})`;
  c.fillText(`+${fx.amount.toFixed(1)} ФЛЮКС`,field.anchor.x,field.anchor.y-20-18*p);
  c.restore();
 }
 c.restore();
}
