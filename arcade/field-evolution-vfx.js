// Lightweight native Canvas effects: no sprite sheets, DOM measurements or
// per-frame particle allocations. Everything follows world coordinates.
const TAU=Math.PI*2;
const inView=(x,y,cam,r=80)=>x+r>cam.x&&x-r<cam.x+cam.w&&y+r>cam.y&&y-r<cam.y+cam.h;

function diamond(c,x,y,size,angle,fill,stroke){
 c.save();c.translate(x,y);c.rotate(angle);
 c.fillStyle=fill;c.strokeStyle=stroke;c.lineWidth=1.5;
 c.beginPath();c.moveTo(0,-size);c.lineTo(size*.75,-size*.13);
 c.lineTo(0,size);c.lineTo(-size*.75,-size*.13);c.closePath();c.fill();c.stroke();
 c.strokeStyle='#edffff9a';c.lineWidth=.8;
 c.beginPath();c.moveTo(0,-size);c.lineTo(0,size);
 c.moveTo(-size*.75,-size*.13);c.lineTo(size*.75,-size*.13);c.stroke();c.restore();
}

export function drawEvolutionEnvironment(c,game,cam){
 const s=game.fieldEvolution;if(!s)return;
 const t=game.time,reduced=!!game.visuals.reducedMotion;
 for(const w of s.wrecks){
  if(!w.alive||!inView(w.x,w.y,cam,w.r+15))continue;
  const fade=Math.min(1,(w.until-t)/2.5),a=reduced?0:t*.19+(w.phase||0);
  c.save();c.globalAlpha=Math.max(0,fade);c.translate(w.x,w.y);c.rotate(a);
  c.shadowColor='#6dfff1';c.shadowBlur=game.fps>=35?11:0;
  c.fillStyle='#152d3b';c.strokeStyle='#8fd7d7';c.lineWidth=2.4;
  c.beginPath();c.moveTo(-w.r*.96,-w.r*.3);c.lineTo(-w.r*.46,-w.r*.78);
  c.lineTo(-w.r*.12,-w.r*.47);c.lineTo(w.r*.52,-w.r*.78);
  c.lineTo(w.r*.96,-w.r*.14);c.lineTo(w.r*.43,w.r*.22);
  c.lineTo(w.r*.77,w.r*.68);c.lineTo(-w.r*.38,w.r*.53);
  c.lineTo(-w.r*.72,w.r*.12);c.closePath();c.fill();c.stroke();
  c.shadowBlur=0;c.strokeStyle='#4ef5d9';c.lineWidth=1.8;
  c.beginPath();c.moveTo(-w.r*.3,-w.r*.1);c.lineTo(0,w.r*.13);
  c.lineTo(w.r*.35,-w.r*.25);c.stroke();
  c.fillStyle='#bdfdf3';c.fillRect(-3,-3,6,6);c.restore();
 }
 for(let i=0;i<s.crystals.length;i++){
  const o=s.crystals[i];if(!inView(o.x,o.y,cam,80))continue;
  const phase=reduced?0:t*2.4+i*2.1,glow=.5+.5*Math.sin(phase*1.7);
  const y=o.y+(reduced?0:Math.sin(phase)*7);
  c.save();c.shadowColor=i===1?'#ffe09d':i===2?'#ba95ff':'#81fff3';
  c.shadowBlur=game.fps>=35?17+glow*10:0;
  c.strokeStyle=i===1?'#ffe1a3':i===2?'#d2b6ff':'#7efbe8';c.lineWidth=2;
  c.setLineDash([9,7]);c.beginPath();c.arc(o.x,y,24+glow*3,0,TAU);c.stroke();c.setLineDash([]);
  diamond(c,o.x,y,15,phase*.42,i===1?'#c39150':i===2?'#7957aa':'#348d98',c.strokeStyle);
  c.shadowBlur=0;c.fillStyle='#f1ffff';c.textAlign='center';c.font='bold 11px system-ui';
  c.fillText(String(i+1),o.x,y-24);c.restore();
 }
}

export function drawParasiteCore(c,item,t,fps=60){
 const phase=t*3.1,shade=.6+.4*Math.sin(phase);
 c.save();c.shadowColor='#47ffe2';c.shadowBlur=fps>=35?14:0;
 c.lineWidth=2;c.strokeStyle='#6effe2';
 c.beginPath();c.arc(item.x,item.y,15,phase,phase+Math.PI*1.2);c.stroke();
 diamond(c,item.x,item.y+Math.sin(phase)*2.5,11,phase*.31,'#21b7a8','#b9ffed');
 c.fillStyle='rgba(74,247,219,'+(shade*.3)+')';c.beginPath();c.arc(item.x,item.y,19,0,TAU);c.fill();
 c.font='bold 10px system-ui';c.textAlign='center';c.fillStyle='#b7fff0';
 c.fillText('ЯДРО',item.x,item.y-22);c.restore();
}

export function drawEvolutionEnemy(c,e,t,fps=60,reduced=false){
 if(e.parasiteCapture&&e.hp>0){
  c.save();c.strokeStyle='#68ffda';c.lineWidth=2;
  const phase=reduced?0:t*2.2;
  for(let i=0;i<3;i++){
   const a=phase+i*TAU/3,inner=e.r+5,outer=e.r+14;
   c.beginPath();c.moveTo(e.x+Math.cos(a)*inner,e.y+Math.sin(a)*inner);
   c.lineTo(e.x+Math.cos(a+.35)*outer,e.y+Math.sin(a+.35)*outer);c.stroke();
   diamond(c,e.x+Math.cos(a)*outer,e.y+Math.sin(a)*outer,4,a,'#2fae9d','#c0ffec');
  }
  c.fillStyle='#a5ffdb';c.font='bold 10px system-ui';c.textAlign='center';
  c.fillText((e.parasiteRole==='healer'?'РЕМОНТ':e.parasiteRole==='scout'?'РАЗВЕДКА':
   e.parasiteRole==='berserker'?'ТАРАН':'ЗАХВАЧЕН')+' · '+Math.ceil(e.convertedTime)+' c',e.x,e.y-e.r-22);
  c.restore();
 }
 if(e.fieldMarkUntil>t){
  c.save();c.strokeStyle='#83ffdc';c.lineWidth=2.1;c.setLineDash([6,5]);
  c.beginPath();c.arc(e.x,e.y,e.r+12+(reduced?0:Math.sin(t*16)*3),0,TAU);c.stroke();
  c.setLineDash([]);c.restore();
 }
 if(e.parasiteSpyUntil>t){
  c.save();c.strokeStyle='#a6ffe8';c.lineWidth=1.6;c.setLineDash([4,5]);
  c.beginPath();c.arc(e.x,e.y,e.r+17,0,TAU);c.stroke();
  c.fillStyle='#a9fff0';c.textAlign='center';c.font='bold 10px system-ui';
  c.fillText('ПЕРЕДАТЧИК',e.x,e.y-e.r-27);c.restore();
 }
}

export function drawEvolutionConnections(c,game,cam){
 const s=game.fieldEvolution;if(!s)return;
 const spy=game.enemies.find(e=>e.serial===s.spySerial&&e.hp>0&&!e.converted);
 if(spy&&inView(spy.x,spy.y,cam,720)){
  c.save();c.setLineDash([5,9]);c.strokeStyle='#80fbe08d';c.lineWidth=1.7;
  for(const echo of s.reveals){
   if(echo.serial===spy.serial||!inView(echo.x,echo.y,cam,50))continue;
   c.beginPath();c.moveTo(spy.x,spy.y);c.lineTo(echo.x,echo.y);c.stroke();
  }
  c.setLineDash([]);c.restore();
 }
 for(const echo of s.reveals){
  if(!inView(echo.x,echo.y,cam,50))continue;
  c.save();c.strokeStyle='#7ef5d7';c.lineWidth=1.4;c.setLineDash([5,6]);
  c.beginPath();c.arc(echo.x,echo.y,32,0,TAU);c.stroke();c.setLineDash([]);c.restore();
 }
}

export function drawEvolutionPlayer(c,game){
 const s=game.fieldEvolution,p=game.player;if(!s)return;
 const t=game.time,reduced=game.visuals.reducedMotion;
 if(s.charge){
  c.save();c.strokeStyle='#63ffe1a9';c.lineWidth=1.4;
  for(let i=0;i<s.charge;i++){
   const a=(reduced?0:t*1.7)+i*Math.PI;
   const x=p.x+Math.cos(a)*43,y=p.y+Math.sin(a)*43;
   c.fillStyle='#b7fff2';c.shadowColor='#62ffe2';c.shadowBlur=9;
   c.beginPath();c.arc(x,y,6,0,TAU);c.fill();c.shadowBlur=0;
   c.strokeStyle='#1b6f78';c.beginPath();c.moveTo(x+1,y-4);c.lineTo(x-2,y);c.lineTo(x+2,y);c.lineTo(x-1,y+4);c.stroke();
  }
  c.font='bold 10px system-ui';c.textAlign='center';c.fillStyle='#b7fff2';
  c.fillText('ЯДРА '+s.charge+'/2',p.x,p.y+64);
  c.restore();
 }
 if(t-s.levelAt<2.5&&t>=s.levelAt){
  const age=t-s.levelAt,alpha=Math.max(0,1-age/2.5);
  c.save();c.globalAlpha=alpha;c.strokeStyle='#b1fff5';c.lineWidth=2;
  c.beginPath();c.arc(p.x,p.y,39+age*63,0,TAU);c.stroke();
  c.strokeStyle='#d9beff';c.beginPath();c.arc(p.x,p.y,46+age*41,0,TAU);c.stroke();
  c.font='bold 15px system-ui';c.textAlign='center';c.fillStyle='#e6fff7';
  c.fillText('УРОВЕНЬ '+p.level,p.x,p.y-75-age*19);c.restore();
 }
 if(t-s.pulseAt<.64&&t>=s.pulseAt){
  c.save();c.globalAlpha=Math.max(0,1-(t-s.pulseAt)/.64);
  c.strokeStyle='#76ffe1';c.lineWidth=2.5;
  c.beginPath();c.arc(p.x,p.y,36+(t-s.pulseAt)*85,0,TAU);c.stroke();c.restore();
 }
}
