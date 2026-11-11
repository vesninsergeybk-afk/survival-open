/** Opening guards and commanders use ordinary enemy-ship art. Only their
 * school of small blue triangular interceptors needs a distinct silhouette.
 * This paint changes no collision, targeting, or damage rules. */
export function openingHostileRole(enemy){
 if(!enemy||enemy.hp<=0||enemy.converted)return null;
 return enemy.openingBlueTriangle?'blue-triangle':null;
}

export function drawOpeningHostile(ctx,enemy,time=0,reducedMotion=false){
 if(openingHostileRole(enemy)!=='blue-triangle'||!ctx)return false;
 const scale=Math.max(10,Math.min(16,(enemy.r||12)*1.12));
 const speed=Math.hypot(enemy.vx||0,enemy.vy||0);
 const thrust=Math.min(1,speed/160);
 const charging=enemy.fire<=0&&Number.isFinite(enemy._irisChargeStarted)&&
  time-enemy._irisChargeStarted<.4;
 ctx.save();ctx.translate(enemy.x,enemy.y);
 ctx.rotate(Number.isFinite(enemy.visualAngle)?enemy.visualAngle:(enemy.angle||0));
 ctx.scale(scale,scale);ctx.lineJoin='round';
 // One readable nose and two fins: a small attack ship, not a UI marker.
 if(thrust>.1){
  ctx.strokeStyle='#41baff';ctx.lineWidth=.15;
  ctx.globalAlpha=.35+.45*thrust;
  for(const side of [-.31,.31]){
   ctx.beginPath();ctx.moveTo(side,.58);
   ctx.lineTo(side,.58+thrust*(reducedMotion?.22:.55));ctx.stroke();
  }
  ctx.globalAlpha=1;
 }
 ctx.fillStyle='#12385e';ctx.strokeStyle='#5fc9ff';ctx.lineWidth=.13;
 ctx.beginPath();ctx.moveTo(0,-1.08);
 ctx.lineTo(.86,.72);ctx.lineTo(.17,.43);ctx.lineTo(0,.59);
 ctx.lineTo(-.17,.43);ctx.lineTo(-.86,.72);ctx.closePath();
 ctx.fill();ctx.stroke();
 ctx.fillStyle='#247cae';
 ctx.beginPath();ctx.moveTo(0,-.79);ctx.lineTo(.25,.26);
 ctx.lineTo(0,.13);ctx.lineTo(-.25,.26);ctx.closePath();ctx.fill();
 ctx.fillStyle=charging?'#f7ffff':'#b2f2ff';
 ctx.beginPath();ctx.arc(0,-.24,.15,0,Math.PI*2);ctx.fill();
 ctx.restore();return true;
}
