/**
 * Hostile rounds rendered from the real moving projectile, not a duplicated
 * stationary sprite. All silhouettes point along velocity and retain the
 * same collision radius, speed and lifetime as the simulation.
 *
 * The old laserRed10.png was a blunt red capsule with two round ends; the
 * silhouettes below make faction, speed and threat readable without an atlas.
 */
export const HOSTILE_SHOT_STYLES=Object.freeze({
 laser:{length:24,width:4,outer:'#f2586e',core:'#ffe8d8',shape:'dart'},
 fighter:{length:24,width:4.2,outer:'#ff9871',core:'#fff0c5',shape:'dart'},
 'fighter-burst':{length:27,width:3.1,outer:'#ffbb6a',core:'#ffefc6',shape:'fork'},
 flanker:{length:34,width:2.8,outer:'#b38bff',core:'#f8eaff',shape:'needle'},
 'flanker-needle':{length:39,width:2.4,outer:'#a88bff',core:'#eee4ff',shape:'needle'},
 gunship:{length:30,width:6,outer:'#ff784c',core:'#fff0d4',shape:'heavy'},
 'gunship-cannon':{length:34,width:6,outer:'#ef6845',core:'#fff1c9',shape:'heavy'},
 'gunship-flak':{length:19,width:5.3,outer:'#ffaf64',core:'#fff3bc',shape:'fork'},
 'base-turret':{length:38,width:6.5,outer:'#e94c6e',core:'#fff0d5',shape:'siege'},
 iris:{length:25,width:3,outer:'#b084ff',core:'#f2e1ff',shape:'needle'},
 mote:{length:23,width:2.9,outer:'#63c6ff',core:'#e3fcff',shape:'fork'}
});

const line=(c,x,y,tx,ty,width,color,alpha=1)=>{
 c.lineWidth=width;c.strokeStyle=color;c.globalAlpha=alpha;
 c.beginPath();c.moveTo(x,y);c.lineTo(tx,ty);c.stroke();
};

/** Returns false only for invalid bullets; canvas assets are not required. */
export function drawHostileProjectile(ctx,shot,high=true){
 if(!Number.isFinite(shot?.x)||!Number.isFinite(shot?.y)||
    !Number.isFinite(shot?.vx)||!Number.isFinite(shot?.vy))return false;
 const style=HOSTILE_SHOT_STYLES[shot.kind]||HOSTILE_SHOT_STYLES.laser;
 const angle=Math.atan2(shot.vy,shot.vx);
 const length=style.length,width=style.width;
 ctx.save();ctx.translate(shot.x,shot.y);ctx.rotate(angle);ctx.lineCap='round';
 // A directional plume always trails the projectile. No dumbbell ends.
 line(ctx,-length,0,-4,0,width*1.8,style.outer,.17);
 line(ctx,-length*.78,0,5,0,width,style.outer,.95);
 line(ctx,-length*.65,0,4,0,Math.max(1.2,width*.32),style.core,.97);
 if(style.shape==='needle'){
  // Slim piercing spear: opposed fins point backwards, distinct from bolts.
  for(const side of [-1,1]){
   line(ctx,-length*.46,0,-length*.74,side*5,1.5,style.outer,.86);
   if(high)line(ctx,-length*.13,0,2,side*2.4,.9,style.core,.7);
  }
 }else if(style.shape==='fork'){
  for(const side of [-1,1]){
   line(ctx,-length*.7,side*4,-length*.13,side*2,1.8,style.outer,.95);
   line(ctx,-length*.13,side*2,4,0,1.2,style.core,.85);
  }
 }else if(style.shape==='heavy'||style.shape==='siege'){
  for(const side of [-1,1]){
   // Heavy cannon shells have a faceted armoured tip and heat rails.
   line(ctx,-length*.55,side*(width*.86),-2,side*(width*.65),2.2,style.outer,.91);
   line(ctx,-2,side*(width*.65),7,0,1.5,style.core,.92);
   if(high)line(ctx,-length*.86,side*(width*.62),-length*.59,side*(width*1.1),1.6,style.outer,.8);
  }
  if(style.shape==='siege'){
   // The hostile base has a recognizable three-pronged crimson penetrator.
   line(ctx,-length*.3,-width*1.2,3,-width*.45,1.8,'#ff7799',.9);
   line(ctx,-length*.3,width*1.2,3,width*.45,1.8,'#ff7799',.9);
  }
 }else if(high){
  for(const side of [-1,1])
   line(ctx,-length*.65,side*3.3,-length*.18,side*1.6,1.2,style.outer,.76);
 }
 ctx.restore();return true;
}
