/** Distinct hostile patrol craft for the two opening choices. Their silhouettes
 * are drawn directly in world space and never depend on a downloaded atlas.
 * The IRIS eye animation belongs to free scouts, not the capsule security
 * detail or the commander's armed wing. */
export function openingHostileRole(enemy){
 if(!enemy||enemy.hp<=0||enemy.converted)return null;
 if(enemy.openingCommander)return 'commander';
 if(enemy.scenario==='opening-escort'&&enemy.missionStructure)return 'wing';
 if(enemy.openingRescueRole==='guard')return 'sentry';
 if(enemy.openingRescueRole==='escort')return 'wing';
 if(enemy.openingRescueRole==='pursuer')return 'hunter';
 return null; // the tug has its own painted, recognisable hull
}

const SHAPES=Object.freeze({
 small:[
  [0,-1.17],[.25,-.56],[.55,-.38],[.83,.51],[.25,.37],
  [0,.76],[-.25,.37],[-.83,.51],[-.55,-.38],[-.25,-.56]
 ],
 heavy:[
  [0,-1.18],[.27,-.64],[.7,-.52],[1.05,.18],[.91,.55],
  [.48,.43],[.36,.94],[0,.71],[-.36,.94],[-.48,.43],
  [-.91,.55],[-1.05,.18],[-.7,-.52],[-.27,-.64]
 ]
});
function polygon(ctx,points){
 ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
 for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
 ctx.closePath();
}

export function drawOpeningHostile(ctx,enemy,time=0,reducedMotion=false){
 const role=openingHostileRole(enemy);
 if(!role||!ctx)return false;
 const heavy=role==='commander'||enemy.type==='fighter';
 const scale=Math.max(12,Math.min(21,(enemy.r||14)*
  (role==='commander'?1.16:1.06)));
 const vx=enemy.vx||0,vy=enemy.vy||0;
 const thrust=Math.min(1,Math.hypot(vx,vy)/155);
 const charging=!!enemy._gunAiming||
  Number.isFinite(enemy._irisChargeStarted)&&
  time-enemy._irisChargeStarted>=0&&time-enemy._irisChargeStarted<.45;
 ctx.save();
 ctx.translate(enemy.x,enemy.y);
 ctx.rotate(Number.isFinite(enemy.visualAngle)?enemy.visualAngle:
  (enemy.angle||0));
 ctx.scale(scale,scale);
 ctx.lineJoin='round';ctx.lineCap='round';

 // Engine glow is tied to actual movement: stationary sentries keep their
 // engines dim instead of showing a permanent, misleading acceleration.
 if(thrust>.08){
  ctx.strokeStyle='#ff8e65';ctx.lineWidth=.17;
  ctx.globalAlpha=.28+.56*thrust;
  const length=.24+thrust*(reducedMotion?.27:.56);
  for(const x of [-.27,.27]){
   ctx.beginPath();ctx.moveTo(x,.71);ctx.lineTo(x,.71+length);ctx.stroke();
  }
  ctx.globalAlpha=1;
 }

 // A continuous dark hull, pale armour edges and two wing panels read as a
 // small attack ship even at 0.7× camera zoom. There are no floating eyes,
 // loose antennae or looping transformation sprites in these encounters.
 ctx.fillStyle=role==='commander'?'#35233a':'#301d2e';
 ctx.strokeStyle=role==='hunter'?'#ffbc81':'#ef897d';
 ctx.lineWidth=heavy?.115:.12;
 polygon(ctx,heavy?SHAPES.heavy:SHAPES.small);
 ctx.fill();ctx.stroke();

 ctx.fillStyle=role==='commander'?'#a85e70':'#8f465a';
 ctx.beginPath();
 ctx.moveTo(0,-.93);ctx.lineTo(.25,-.19);ctx.lineTo(.18,.53);
 ctx.lineTo(0,.29);ctx.lineTo(-.18,.53);ctx.lineTo(-.25,-.19);
 ctx.closePath();ctx.fill();

 ctx.strokeStyle='#ffbfaa';ctx.lineWidth=.09;ctx.globalAlpha=.9;
 for(const sign of [-1,1]){
  ctx.beginPath();ctx.moveTo(sign*.44,-.33);
  ctx.lineTo(sign*(heavy?.82:.69),.27);ctx.stroke();
  ctx.beginPath();ctx.moveTo(sign*.26,.44);
  ctx.lineTo(sign*.31,.73);ctx.stroke();
 }
 ctx.globalAlpha=1;

 if(role==='commander'){
  ctx.strokeStyle='#ffc7a8';ctx.lineWidth=.12;
  for(const sign of [-1,1]){
   ctx.beginPath();ctx.moveTo(sign*.62,-.48);
   ctx.lineTo(sign*.74,-.93);ctx.stroke();
  }
 }
 if(role==='hunter'){
  ctx.strokeStyle='#ffcc8b';ctx.lineWidth=.09;
  ctx.beginPath();ctx.moveTo(-.49,.35);ctx.lineTo(0,.58);
  ctx.lineTo(.49,.35);ctx.stroke();
 }
 // The lit gun port is an actual attack cue, not a perpetual scan animation.
 ctx.fillStyle=charging?'#fff0d0':'#f36e75';
 ctx.beginPath();ctx.arc(0,-.34,charging?.19:.13,0,Math.PI*2);ctx.fill();
 ctx.restore();
 return true;
}
