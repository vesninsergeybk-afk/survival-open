/**
 * Opt-in capital-ship damage experiment for the live arcade battle.
 *
 * Uses existing directed hit contacts to select local hull sites. The contact
 * circle is a gameplay proxy, not the painting outline, so decals are placed
 * inside the hull and alpha-masked to the actual prepared sprite.
 * Nothing here changes HP, collisions, attacks, random state or AI.
 */
import {CAPITAL_WEAR_ANCHORS} from './capital-wear.js?v=arcade-capital-wear-58';

const MAX_CONTACTS=4;
const TIERS=[.93,.55,.28];

export function capitalDamageTier(hp,maxHp){
 if(!Number.isFinite(hp)||!Number.isFinite(maxHp)||maxHp<=0)return 0;
 const ratio=Math.max(0,Math.min(1,hp/maxHp));
 return ratio<TIERS[2]?3:ratio<TIERS[1]?2:ratio<TIERS[0]?1:0;
}

/** Contact direction becomes a repeatable hull-local anchor, unaffected by camera. */
export function capitalContactAnchor(enemy,contact){
 if(!enemy||!(enemy.r>0)||!contact?.directed||
    !Number.isFinite(enemy.x)||!Number.isFinite(enemy.y)||
    !Number.isFinite(contact.x)||!Number.isFinite(contact.y))return null;
 const angle=Number.isFinite(enemy.angle)?enemy.angle:0;
 const dx=contact.x-enemy.x,dy=contact.y-enemy.y;
 const cs=Math.cos(angle),sn=Math.sin(angle);
 const lx=dx*cs+dy*sn,ly=-dx*sn+dy*cs;
 const length=Math.hypot(lx,ly);
 if(length<1e-4)return null;
 const nx=lx/length,ny=ly/length;
 // The circular hit proxy is larger laterally than some ship silhouettes.
 // Keep the directional clue, but place the wound on interior armour.
 return {u:.5+.235*nx,v:.5+.225*ny,nx,ny};
}

/** Record at most four local sites; continuous beam hits coalesce. */
export function recordCapitalHit(enemy,contact,time){
 if(!Number.isFinite(time)||!enemy||enemy.hp<=0)return false;
 const point=capitalContactAnchor(enemy,contact);
 if(!point)return false;
 const spots=enemy.capitalDamageSites||(enemy.capitalDamageSites=[]);
 let nearest=null,nearDist=Infinity;
 for(const spot of spots){
  const d=Math.hypot(spot.u-point.u,spot.v-point.v);
  if(d<nearDist){nearDist=d;nearest=spot;}
 }
 if(nearest&&nearDist<.115){
  nearest.last=time;nearest.count=Math.min(30,nearest.count+1);
 }else if(spots.length<MAX_CONTACTS){
  spots.push({...point,first:time,last:time,count:1});
  enemy.capitalDamageVersion=(enemy.capitalDamageVersion||0)+1;
 }else if(nearest){
  // A fifth impact still flashes in its own location; earlier scars do not
  // disappear just because the player has continued firing.
  nearest.last=time;
 }
 enemy.capitalDamageFlash={...point,time};
 return true;
}

function fallbackSites(kind){
 return (CAPITAL_WEAR_ANCHORS[kind]||CAPITAL_WEAR_ANCHORS.cruiser)
  .map(([x,y],i)=>({u:x/512,v:y/768,nx:(x-256)/256,
   ny:(y-384)/384,first:-i*5,count:1}));
}
function visibleSites(enemy,kind,tier){
 const contacts=enemy.capitalDamageSites||[];
 const result=contacts.slice(0,tier);
 if(result.length<tier){
  const defaults=fallbackSites(kind);
  for(const point of defaults){
   if(result.length===tier)break;
   if(!result.some(s=>Math.hypot(s.u-point.u,s.v-point.v)<.16))
    result.push(point);
  }
 }
 return result;
}

function jaggedOval(ctx,rx,ry,seed){
 ctx.beginPath();
 for(let i=0;i<=18;i++){
  const t=i*Math.PI*2/18;
  const rough=.87+.12*Math.sin((i+seed)*2.71)+.08*Math.cos(i*5.31+seed);
  const x=Math.cos(t)*rx*rough,y=Math.sin(t)*ry*rough;
  if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);
 }
 ctx.closePath();
}

function drawScar(ctx,x,y,site,tier,index){
 const angle=Math.atan2(site.ny,site.nx)+Math.PI*.55;
 const heavy=tier===3,seed=index*7+Math.round(site.u*29);
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);
 const stretch=tier===1?.80:tier===2?.97:1.10;
 ctx.scale(stretch,stretch);
 // Wide scorched plate makes damage legible when the ship is only 60 px wide.
 const g=ctx.createRadialGradient(0,0,2,0,0,42);
 g.addColorStop(0,'rgba(4,10,15,.98)');
 g.addColorStop(.38,'rgba(12,20,26,.94)');
 g.addColorStop(.65,'rgba(69,62,58,.74)');
 g.addColorStop(1,'rgba(150,124,105,0)');
 ctx.save();ctx.scale(1,.67);
 ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,44,0,Math.PI*2);ctx.fill();ctx.restore();
 // The rupture has a torn silhouette, not a circular crater.
 ctx.globalAlpha=.97;ctx.fillStyle='#080e14';
 jaggedOval(ctx,27,11,seed);ctx.fill();
 // Exposed asymmetric edge plates carry the light that tiny dark marks lack.
 ctx.lineCap='round';ctx.lineJoin='round';
 ctx.strokeStyle='#9ca8a8';ctx.globalAlpha=.88;ctx.lineWidth=5;
 ctx.beginPath();ctx.moveTo(-29,-13);ctx.lineTo(-10,-17);
 ctx.lineTo(5,-11);ctx.lineTo(23,-15);ctx.stroke();
 ctx.strokeStyle='#6b7479';ctx.globalAlpha=.77;ctx.lineWidth=4;
 ctx.beginPath();ctx.moveTo(-26,12);ctx.lineTo(-6,16);
 ctx.lineTo(11,10);ctx.lineTo(26,13);ctx.stroke();
 ctx.strokeStyle='#0a1118';ctx.globalAlpha=1;ctx.lineWidth=8;
 ctx.beginPath();ctx.moveTo(-25,-4);ctx.lineTo(-8,-2);
 ctx.lineTo(5,3);ctx.lineTo(24,5);ctx.stroke();
 // A few hot cavities, bounded by burnt armour.
 if(tier>=2){
  ctx.strokeStyle=heavy?'#eaa66c':'#bb724a';ctx.globalAlpha=heavy?.78:.49;
  ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle=heavy?'#ffd29d':'#e49d65';ctx.globalAlpha=heavy?.80:.48;
  ctx.beginPath();ctx.arc(7,3,heavy?3.5:2.4,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}

function createPaintedDamage(sprite,sites,tier){
 const canvas=document.createElement('canvas');
 canvas.width=256;canvas.height=384;
 const c=canvas.getContext('2d');
 if(!c)return sprite;
 c.drawImage(sprite,0,0,256,384);
 c.globalCompositeOperation='source-atop';
 for(let i=0;i<sites.length;i++)
  drawScar(c,sites[i].u*256,sites[i].v*384,sites[i],tier,i);
 c.globalCompositeOperation='source-over';
 return canvas;
}

const smooth=(x)=>x*x*(3-2*x);
function drawPlume(ctx,site,w,h,time,tier,reducedMotion,index){
 const startX=(site.u-.5)*w,startY=(site.v-.5)*h;
 let dx=site.nx,dy=site.ny,len=Math.hypot(dx,dy);
 if(len<.1){dx=startX;dy=startY;len=Math.hypot(dx,dy)||1;}
 dx/=len;dy/=len;
 const strength=tier===3?1:.78;
 const drift=reducedMotion?0:time*(tier===3?1.15:.83);
 ctx.save();
 ctx.globalCompositeOperation='screen';
 // Constant bright vent core: a static reference point even between puffs.
 ctx.strokeStyle=tier===3?'rgba(255,172,94,.8)':'rgba(151,205,219,.72)';
 ctx.lineWidth=2.2*strength;ctx.lineCap='round';
 ctx.beginPath();ctx.moveTo(startX,startY);
 ctx.lineTo(startX+dx*6,startY+dy*6);ctx.stroke();
 for(let i=0;i<4;i++){
  const phase=reducedMotion?(i+.3)/4:((drift/1.4+i/4)%1+1)%1;
  const distance=5+phase*(tier===3?32:24);
  const wiggle=Math.sin(index*3.1+phase*8.1+time*.7)*2.5;
  const x=startX+dx*distance-dy*wiggle;
  const y=startY+dy*distance+dx*wiggle;
  const radius=(2.8+phase*5.4)*strength;
  const fade=(1-smooth(phase))*(tier===3?.61:.47);
  ctx.globalAlpha=fade;
  ctx.fillStyle=i%2?'#8b99a0':'#c0b1a4';
  ctx.beginPath();ctx.ellipse(x,y,radius,radius*.73,phase+i,0,Math.PI*2);
  ctx.fill();
  // Distinct narrow embers prevent a grey plume vanishing into dark space.
  if(tier===3&&phase<.62&&i%2===0){
   ctx.globalAlpha=.47*(1-phase);
   ctx.fillStyle='#e7a274';ctx.beginPath();
   ctx.arc(x-dx*2,y-dy*2,Math.max(1.2,radius*.28),0,Math.PI*2);ctx.fill();
  }
 }
 ctx.restore();
}
function drawImpactFlash(ctx,flash,w,h,time,reducedMotion){
 if(!flash)return;
 const age=time-flash.time;
 if(age<0||age>.30)return;
 const p=age/.30,alpha=1-smooth(p);
 const x=(flash.u-.5)*w,y=(flash.v-.5)*h;
 ctx.save();ctx.globalCompositeOperation='screen';
 ctx.globalAlpha=alpha*.95;
 ctx.fillStyle='#fff0c4';ctx.beginPath();
 ctx.arc(x,y,1.6+2.1*p,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#ffb97b';ctx.lineWidth=1.5;
 ctx.beginPath();ctx.arc(x,y,3+5*p,0,Math.PI*2);ctx.stroke();
 if(!reducedMotion){
  const rot=Math.atan2(flash.ny,flash.nx);
  for(let j=0;j<4;j++){
   const a=rot+j*Math.PI*.5+.27;
   const near=4+3*p,far=8+11*p;
   ctx.beginPath();ctx.moveTo(x+Math.cos(a)*near,y+Math.sin(a)*near);
   ctx.lineTo(x+Math.cos(a)*far,y+Math.sin(a)*far);
   ctx.stroke();
  }
 }
 ctx.restore();
}

/**
 * Called in the painting's already translated/rotated frame. The composite
 * updates only at damage thresholds/new sites; smoke and brief flash animate.
 */
export function drawCapitalDamage(ctx,enemy,kind,sprite,w,h,time,reducedMotion=false){
 if(typeof document==='undefined'||!enemy||!(w>0)||!(h>0))return false;
 const tier=capitalDamageTier(enemy.hp,enemy.maxHp);
 const sites=visibleSites(enemy,kind,tier);
 const key=kind+':'+tier+':'+(enemy.capitalDamageVersion||0);
 if(!enemy.capitalPaintCache||enemy.capitalPaintCache.key!==key){
  enemy.capitalPaintCache={key,canvas:tier?
   createPaintedDamage(sprite,sites,tier):sprite};
 }
 ctx.drawImage(enemy.capitalPaintCache.canvas,-w/2,-h/2,w,h);
 if(tier>=2){
  const ventCount=tier>=3?Math.min(2,sites.length):1;
  for(let i=0;i<ventCount;i++)
   drawPlume(ctx,sites[i],w,h,time,tier,reducedMotion,i);
 }
 drawImpactFlash(ctx,enemy.capitalDamageFlash,w,h,time,reducedMotion);
 return true;
}
