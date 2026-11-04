// The reactor is scenic background: no colliders or interactive core yet.
// Connected metal and the glow use the same parallax anchor and scale;
// detached structures, suspended fog and motes occupy other depth planes.
const ANCHOR = Object.freeze({x: 80, y: -310});
const WORLD_WIDTH = 1900;
const WORLD_HEIGHT = 1190;
const TEXTURE_WIDTH = 1500;
const TEXTURE_HEIGHT = 940;
const TAU = Math.PI * 2;

// The square source already has front/back depth. Apply only a modest,
// precomputed oblique projection; never stretch it anew each frame.
const SOURCE_SIZE = 1200;
const PROJECTION = Object.freeze({a: 1.02, b: -.04, c: .075, d: .73});
const ENERGY_ASSET = './studio/assets/reactor-energy-milestones-v1.png';


// At 0 the image barely follows the camera (distant stars), at 1 it moves
// like ships. The connected station is between the starfield and gameplay.
export const REACTOR_DEPTH_RATES = Object.freeze({
 distant:.52, haze:.68, hazeSecondary:.73, hull:.80,
 hazeFront:.93, hazeFrontSecondary:.965, foregroundDust:.985
});
const VIEWPORT_FRACTION = .80;
const MAX_SCENE_SCALE = .58;
export function reactorSceneScale(cam, override = null) {
 if(Number.isFinite(override))return Math.max(.18,Math.min(.8,override));
 const w=Number.isFinite(cam?.w)&&cam.w>0?cam.w:1200;
 return Math.max(.18,Math.min(MAX_SCENE_SCALE,w*VIEWPORT_FRACTION/WORLD_WIDTH));
}
const SCENIC_WIDTH = 2900;
const SCENIC_HEIGHT = 1600;
export function reactorParallaxAnchor(cam, rate) {
 const k = Math.max(0, Math.min(1, Number(rate) || 0));
 return {x: ANCHOR.x + (cam.x - ANCHOR.x) * (1 - k),
  y: ANCHOR.y + (cam.y - ANCHOR.y) * (1 - k)};
}
function point(cx,cy,rx,ry,angle,rotation) {
 const x=rx*Math.cos(angle),y=ry*Math.sin(angle);
 return {x:cx+x*Math.cos(rotation)-y*Math.sin(rotation),
  y:cy+x*Math.sin(rotation)+y*Math.cos(rotation)};
}

function texture(width, height) {
 const canvas = document.createElement('canvas');
 canvas.width = width;
 canvas.height = height;
 return canvas;
}

export class ReactorLandmark {
 constructor(options = {}) {
  this.hull = null;
  this.glow = this.makeGlow();
  this.distant = this.makeDistant();
  this.mist = this.makeMist();
  this.vapour = null;
  this.vapourSecondary = null;
  this.vapourBackAlternate = null;
  this.vapourFrontAlternate = null;
  this.mote = this.makeMote();
  this.nearHull = null;
  this.layers = {distant:true,mist:true,backMist:true,frontMist:true,near:true,particles:true,farParticles:true,frontParticles:true};
  this.hullRate = Number.isFinite(options.hullRate)?
   Math.max(.5,Math.min(1,options.hullRate)):REACTOR_DEPTH_RATES.hull;
  this.scaleOverride = Number.isFinite(options.scale)?options.scale:null;
  // Fixed particle seeds: no random placement and no array allocations per frame.
  this.particles=Array.from({length:108},(_,i)=>({
   x:((i*397+113)%1880)-940,
   y:((i*227+41)%940)-470,
   speed:.55+(i%7)*.31,
   size:i%11===0?2.8:i%4===0?2.1:1.45,
   near:i%3===0,
   phase:i*.73
  }));
  this.failed = false;
  this.energyAtlas = null;
  this.energyFailed = false;
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
   if (image.naturalWidth) {
    this.hull = this.makeHull(image);
    this.nearHull = this.makeNearHull(image);
   }
   this.source = null;
  };
  image.onerror = () => { this.failed = true; };
  image.src = new URL('./studio/assets/reactor-ring-03.png', import.meta.url).href;
  this.source = image;
  const vapour=new Image();
  vapour.decoding='async';
  vapour.onload=()=>{if(vapour.naturalWidth)this.vapour=vapour;};
  vapour.onerror=()=>{this.vapour=null;};
  vapour.src=new URL('./studio/assets/reactor-vapour-v6.webp',import.meta.url).href;
  const secondary=new Image();
  secondary.decoding='async';
  secondary.onload=()=>{if(secondary.naturalWidth)this.vapourSecondary=secondary;};
  secondary.onerror=()=>{this.vapourSecondary=null;};
  secondary.src=new URL('./studio/assets/reactor-vapour-secondary-v7.webp',import.meta.url).href;
  const backAlternate=new Image();
  backAlternate.decoding='async';
  backAlternate.onload=()=>{if(backAlternate.naturalWidth)this.vapourBackAlternate=backAlternate;};
  backAlternate.onerror=()=>{this.vapourBackAlternate=null;};
  backAlternate.src=new URL('./studio/assets/reactor-vapour-variant-c-v7.webp',import.meta.url).href;
  const frontAlternate=new Image();
  frontAlternate.decoding='async';
  frontAlternate.onload=()=>{if(frontAlternate.naturalWidth)this.vapourFrontAlternate=frontAlternate;};
  frontAlternate.onerror=()=>{this.vapourFrontAlternate=null;};
  frontAlternate.src=new URL('./studio/assets/reactor-vapour-variant-d-v7.webp',import.meta.url).href;

  // The larger energy atlas is opt-in for the visual workshop only.
  // Current gameplay has no three-jammer reactor state to drive it.
  if (options.loadEnergyAtlas) {
   const energy = new Image();
   energy.decoding = 'async';
   energy.onload = () => { if (energy.naturalWidth) this.energyAtlas = energy; };
   energy.onerror = () => { this.energyFailed = true; };
   energy.src = new URL(ENERGY_ASSET, import.meta.url).href;
  }
 }
 makeGlow() {
  const canvas = texture(320, 320);
  const c = canvas.getContext('2d');
  if (!c) return null;
  const glow = c.createRadialGradient(160, 160, 2, 160, 160, 158);
  glow.addColorStop(0, 'rgba(221,251,255,1)');
  glow.addColorStop(.045, 'rgba(136,231,253,.93)');
  glow.addColorStop(.15, 'rgba(64,174,226,.75)');
  glow.addColorStop(.36, 'rgba(29,114,180,.42)');
  glow.addColorStop(.7, 'rgba(15,69,135,.12)');
  glow.addColorStop(1, 'rgba(15,69,135,0)');
  c.fillStyle = glow;
  c.fillRect(0, 0, 320, 320);
  return canvas;
 }
 makeHull(image) {
  const canvas = texture(TEXTURE_WIDTH, TEXTURE_HEIGHT);
  const c = canvas.getContext('2d');
  if (!c) return null;
  const paint = (drop, underside) => {
   c.save();
   c.translate(TEXTURE_WIDTH / 2, TEXTURE_HEIGHT / 2 + drop);
   c.transform(PROJECTION.a, PROJECTION.b, PROJECTION.c, PROJECTION.d, 0, 0);
   if (underside) {
    c.globalAlpha = .42;
    c.filter = 'brightness(0.22) saturate(0.60)';
   } else {
    c.globalAlpha = .96;
   }
   c.drawImage(image, -SOURCE_SIZE / 2, -SOURCE_SIZE / 2, SOURCE_SIZE, SOURCE_SIZE);
   c.restore();
  };
  // A single source for every section prevents mismatched trusses and seams.
  paint(22, true);
  paint(0, false);

  // Atmospheric perspective belongs to distant metal, not to the voids
  // between rings. Bake the tint into metal once using source-atop.
  c.save();
  c.globalCompositeOperation = 'source-atop';
  const distance = c.createLinearGradient(0, 0, 0, TEXTURE_HEIGHT);
  distance.addColorStop(0, 'rgba(8,24,47,.34)');
  distance.addColorStop(.40, 'rgba(11,27,48,.18)');
  distance.addColorStop(.77, 'rgba(8,18,34,.03)');
  distance.addColorStop(1, 'rgba(8,18,34,0)');
  c.fillStyle = distance;
  c.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  c.restore();
  return canvas;
 }

 // Detached distant bridgework is intentionally not joined to the principal
 // ring. Its parallax cannot pull real metal or gameplay markers apart.
 makeDistant() {
  const canvas=texture(1400,680),c=canvas.getContext('2d');
  if(!c)return null;
  const arches=[
   {cx:160,cy:290,rx:590,ry:225,rot:-.14,start:-2.2,end:.65},
   {cx:1320,cy:380,rx:640,ry:255,rot:.10,start:2.50,end:5.90},
   {cx:750,cy:160,rx:490,ry:140,rot:-.06,start:3.05,end:6.15}
  ];
  for(let j=0;j<arches.length;j++){
   const a=arches[j];
   c.save();
   c.strokeStyle=j===2?'rgba(49,75,99,.38)':'rgba(64,92,112,.58)';
   c.lineWidth=j===2?24:39;
   c.beginPath();c.ellipse(a.cx,a.cy,a.rx,a.ry,a.rot,a.start,a.end);c.stroke();
   c.strokeStyle='rgba(141,172,187,.18)';c.lineWidth=2;
   c.beginPath();c.ellipse(a.cx,a.cy,a.rx-13,a.ry-9,a.rot,a.start,a.end);c.stroke();
   for(let i=0;i<=14;i++){
    const angle=a.start+(a.end-a.start)*i/14;
    const outer=point(a.cx,a.cy,a.rx+11,a.ry+9,angle,a.rot);
    const inner=point(a.cx,a.cy,a.rx-38,a.ry-19,angle,a.rot);
    c.strokeStyle='rgba(11,28,47,.62)';c.lineWidth=6;
    c.beginPath();c.moveTo(outer.x,outer.y);c.lineTo(inner.x,inner.y);c.stroke();
    if(i<14&&i%2===0){
     const next=point(a.cx,a.cy,a.rx+11,a.ry+9,
      a.start+(a.end-a.start)*(i+1)/14,a.rot);
     c.strokeStyle='rgba(100,133,151,.17)';c.lineWidth=2;
     c.beginPath();c.moveTo(inner.x,inner.y);c.lineTo(next.x,next.y);c.stroke();
    }
    if(i%3===0){
     c.fillStyle='rgba(91,185,222,.22)';
     c.fillRect(inner.x-1.5,inner.y-1.5,3,3);
    }
   }
   c.restore();
  }
  // Fade the artificial edges into actual space; preserve transparent holes.
  c.save();c.globalCompositeOperation='destination-in';
  const fade=c.createLinearGradient(0,0,1400,0);
  fade.addColorStop(0,'rgba(0,0,0,0)');
  fade.addColorStop(.14,'rgba(0,0,0,.8)');
  fade.addColorStop(.50,'rgba(0,0,0,1)');
  fade.addColorStop(.86,'rgba(0,0,0,.8)');
  fade.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=fade;c.fillRect(0,0,1400,680);c.restore();
  return canvas;
 }
 // Soft translucent haze, baked once; no CPU blur/filter or texture upload
 // during a frame. The same small texture can be reused at different depths.
 // Two translucent vapour sheets share one pre-rendered texture; their
 // independent camera rates, not a screen-space animation, create depth.
 makeMist() {
  const canvas=texture(640,280),c=canvas.getContext('2d');
  if(!c)return null;
  for(let i=0;i<32;i++){
   const x=30+((i*193+51)%580),y=28+((i*73+23)%225);
   const r=46+(i*37)%98,stretch=1.25+(i%5)*.48;
   c.save();c.translate(x,y);c.scale(stretch,.37+(i%4)*.13);
   const grad=c.createRadialGradient(0,0,3,0,0,r);
   const a=.21+(i%5)*.032;
   const tint=i%7===0?['128,124,190','83,79,145']:
              i%3===0?['91,190,192','40,111,146']:
                       ['92,163,204','42,89,144'];
   grad.addColorStop(0,'rgba('+tint[0]+','+a.toFixed(3)+')');
   grad.addColorStop(.37,'rgba('+tint[1]+','+(a*.58).toFixed(3)+')');
   grad.addColorStop(1,'rgba(22,62,111,0)');
   c.fillStyle=grad;c.fillRect(-r,-r,r*2,r*2);c.restore();
  }
  // Feather both ends so no rectangular sheet edge appears on screen.
  c.save();c.globalCompositeOperation='destination-in';
  const edge=c.createLinearGradient(0,0,640,0);
  edge.addColorStop(0,'rgba(0,0,0,0)');
  edge.addColorStop(.12,'rgba(0,0,0,.75)');
  edge.addColorStop(.27,'rgba(0,0,0,1)');
  edge.addColorStop(.76,'rgba(0,0,0,1)');
  edge.addColorStop(.91,'rgba(0,0,0,.7)');
  edge.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=edge;c.fillRect(0,0,640,280);c.restore();
  return canvas;
 }
 // Reused for every mote. Glow is baked once so the frame never builds
 // gradients or allocates dozens of small canvases.
 makeMote() {
  const canvas=texture(48,48),c=canvas.getContext('2d');
  if(!c)return null;
  const halo=c.createRadialGradient(24,24,0,24,24,23.5);
  halo.addColorStop(0,'rgba(230,251,255,1)');
  halo.addColorStop(.09,'rgba(171,226,250,.88)');
  halo.addColorStop(.27,'rgba(96,187,228,.46)');
  halo.addColorStop(.62,'rgba(58,134,187,.12)');
  halo.addColorStop(1,'rgba(42,92,151,0)');
  c.fillStyle=halo;c.fillRect(0,0,48,48);
  return canvas;
 }
 // This near-metal highlight comes from exactly the same projected source
 // as the principal hull. It cannot acquire a different perspective.
 makeNearHull(image) {
  const canvas=texture(TEXTURE_WIDTH,TEXTURE_HEIGHT),c=canvas.getContext('2d');
  if(!c)return null;
  c.save();
  c.translate(TEXTURE_WIDTH/2,TEXTURE_HEIGHT/2);
  c.transform(PROJECTION.a,PROJECTION.b,PROJECTION.c,PROJECTION.d,0,0);
  c.drawImage(image,-SOURCE_SIZE/2,-SOURCE_SIZE/2,SOURCE_SIZE,SOURCE_SIZE);
  c.restore();
  c.save();c.globalCompositeOperation='destination-in';
  const near=c.createLinearGradient(0,0,0,TEXTURE_HEIGHT);
  near.addColorStop(0,'rgba(0,0,0,0)');
  near.addColorStop(.42,'rgba(0,0,0,0)');
  near.addColorStop(.61,'rgba(0,0,0,.32)');
  near.addColorStop(.82,'rgba(0,0,0,.85)');
  near.addColorStop(1,'rgba(0,0,0,1)');
  c.fillStyle=near;c.fillRect(0,0,TEXTURE_WIDTH,TEXTURE_HEIGHT);
  c.restore();
  return canvas;
 }
 drawDistant(ctx,cam,scale) {
  if(!this.distant || !this.layers.distant)return;
  const pos=reactorParallaxAnchor(cam,REACTOR_DEPTH_RATES.distant);
  ctx.save();ctx.translate(pos.x,pos.y);ctx.scale(scale*.93,scale*.93);
  ctx.globalAlpha=.36;
  ctx.drawImage(this.distant,-1440,-730,2880,1390);
  ctx.restore();
 }
 drawMist(ctx,cam,time,fps,reducedMotion,inFront=false,scale=1) {
  const primary=inFront?(this.vapourSecondary||this.vapour):this.vapour;
  const alternate=inFront?this.vapourFrontAlternate:this.vapourBackAlternate;
  if(!this.layers.mist || (inFront?this.layers.frontMist===false:this.layers.backMist===false) ||
    (!this.mist&&!primary&&!alternate))return;
  // Autonomous motion uses elapsed game time. Changing the camera adds
  // parallax, but a stationary camera still sees distinct fog currents.
  const elapsed=reducedMotion?0:Math.max(0,Number(time)||0);
  const blend=.5+.5*Math.sin(elapsed*(inFront?.18:.13)-.65);
  const rate=inFront?REACTOR_DEPTH_RATES.hazeFront:REACTOR_DEPTH_RATES.haze;
  const pos=reactorParallaxAnchor(cam,rate);
  ctx.save();ctx.translate(pos.x,pos.y);ctx.scale(scale,scale);
  // The broad procedural sheet is kept behind the hull. In front of the
  // hull it looked like a fixed translucent HUD veil even while parallax moved.
  if(this.mist&&!inFront){
   ctx.globalAlpha=.26;
   ctx.drawImage(this.mist,-790,-290,1570,650);
  }
  if(primary){
   const x=(inFront?-620:-865)+
    Math.sin(elapsed*(inFront?.145:.065)+.4)*(inFront?160:125);
   const y=(inFront?20:-390)+
    Math.cos(elapsed*(inFront?.084:.051))*(inFront?44:35);
   ctx.globalCompositeOperation=inFront?'screen':'source-over';
   ctx.globalAlpha=alternate?
    (inFront?.23+.18*(1-blend):.46+.34*(1-blend)):
    (inFront?.35:.78);
   ctx.drawImage(primary,x,y,inFront?1040:1810,inFront?395:775);
  }
  ctx.restore();
  if(alternate){
   // Another organic silhouette emerges gradually, moving in a slightly
   // different depth plane and at a different velocity.
   const alternateRate=inFront?REACTOR_DEPTH_RATES.hazeFrontSecondary:
    REACTOR_DEPTH_RATES.hazeSecondary;
   const alternatePos=reactorParallaxAnchor(cam,alternateRate);
   const x=(inFront?-180:-810)+
    Math.sin(elapsed*(inFront?.12:.083)+2.0)*(inFront?175:145);
   const y=(inFront?-280:-250)+
    Math.cos(elapsed*(inFront?.07:.044)+1.2)*(inFront?55:39);
   ctx.save();ctx.translate(alternatePos.x,alternatePos.y);
   ctx.scale(scale,scale);
   ctx.globalCompositeOperation=inFront?'screen':'source-over';
   ctx.globalAlpha=inFront?.04+.27*blend:.04+.42*blend;
   ctx.drawImage(alternate,x,y,inFront?990:1650,inFront?390:690);
   ctx.restore();
  }
 }

 drawParticles(ctx,cam,time,fps,reducedMotion,front,scale) {
  if(!this.layers.particles || (front?this.layers.frontParticles===false:this.layers.farParticles===false))return;
  // Dust behind the hull stays ahead of distant stars; the foreground
  // motes drift between reactor and the player ship in screen depth.
  const rate=front?REACTOR_DEPTH_RATES.foregroundDust:.61;
  const pos=reactorParallaxAnchor(cam,rate);
  const count=fps<34?54:fps<50?78:this.particles.length;
  const elapsed=(!reducedMotion&&fps>=34)?time:0;
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  for(let i=0;i<count;i++){
   const p=this.particles[i];
   if(p.near!==front)continue;
   const drift=elapsed*p.speed*(front?11:5);
   const x=((p.x+drift+940)%1880+1880)%1880-940;
   const y=p.y+Math.sin(elapsed*.19+p.phase)*(reducedMotion?0:11);
   // The rectangular field fades gently at the edges; central particles
   // remain readable against both the station and the dark background.
   const fade=Math.max(0,Math.min(1,(940-Math.abs(x))/170))*
              Math.max(0,Math.min(1,(470-Math.abs(y))/105));
   if(fade<.06)continue;
   const px=pos.x+x*scale,py=pos.y+y*scale;
   const haloSize=Math.max(front?15:10,p.size*scale*(front?13:10));
   const alpha=fade*(front?.79:.53);
   if(this.mote) {
    ctx.globalAlpha=alpha;
    ctx.drawImage(this.mote,px-haloSize/2,py-haloSize/2,haloSize,haloSize);
   }
   ctx.globalAlpha=alpha*(front?.92:.72);
   ctx.fillStyle=front?'#c0f3fc':'#8cc2d6';
   const dot=Math.max(front?1.5:1.1,p.size*scale*(front?1.8:1.45));
   ctx.fillRect(px-dot/2,py-dot/2,dot,dot);
  }
  ctx.restore();
 }

 drawCore(ctx, time, fps, reducedMotion, stage, activationAge) {
  const step = Math.max(0, Math.min(4, Math.trunc(Number(stage) || 0)));
  const animate = !reducedMotion && fps >= 34;
  const pulse = animate && step < 3 ? Math.sin(time * 1.3) * .045 : 0;
  const power = [.24, .39, .54, .64, .76][step];

  if (this.glow) {
   ctx.globalAlpha = power * .85 + pulse;
   ctx.drawImage(this.glow, -155, -155, 310, 310);
  }

  // Atlas quadrants are independent visual milestones on RGB/black.
  // 'lighter' makes black neutral; using source-over would hide the hull.
  if (this.energyAtlas) {
   const tileW = Math.floor(this.energyAtlas.naturalWidth / 2);
   const tileH = Math.floor(this.energyAtlas.naturalHeight / 2);
   const firing = step === 4 && activationAge >= 0 && activationAge < 1;
   const tile = firing ? 3 : Math.min(step, 2);
   const size = firing ? 320 : [130, 185, 240, 260, 270][step];
   ctx.save();
   ctx.globalCompositeOperation = 'lighter';
   ctx.globalAlpha = firing ? .78 * (1 - activationAge * .6) : [.35, .38, .45, .42, .48][step];
   ctx.drawImage(
    this.energyAtlas, (tile % 2) * tileW, Math.floor(tile / 2) * tileH,
    tileW, tileH, -size / 2, -size / 2, size, size
   );
   ctx.restore();
  }

  // Retain stable, inexpensive stage indicators even with reduced motion.
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(104,207,247,' + (.23 + step * .09).toFixed(3) + ')';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 108, 61, -.04, 0, TAU);
  ctx.stroke();
  if (step >= 2) {
   ctx.strokeStyle = 'rgba(130,222,255,' + (step === 4 ? .59 : .33).toFixed(3) + ')';
   ctx.beginPath();
   ctx.ellipse(0, 0, 139, 78, -.04, 0, TAU);
   ctx.stroke();
  }
  if (animate && step >= 1 && step <= 2) {
   ctx.strokeStyle = 'rgba(160,229,255,' + (.13 + pulse).toFixed(3) + ')';
   ctx.beginPath();
   ctx.ellipse(0, 0, 125, 70, -.04, time * .09, time * .09 + 1.3);
   ctx.stroke();
  }
 }
 draw(ctx, cam, time = 0, fps = 60, reducedMotion = false, stage = 0, activationAge = Infinity) {
  if(!this.hull)return;
  const scale=reactorSceneScale(cam,this.scaleOverride);
  const center=reactorParallaxAnchor(cam,this.hullRate);
  const reachX=SCENIC_WIDTH*scale*.7,reachY=SCENIC_HEIGHT*scale*.7;
  if(center.x+reachX<cam.x||center.x-reachX>cam.x+cam.w||
     center.y+reachY<cam.y||center.y-reachY>cam.y+cam.h)return;

  // Depth order: detached trusses, far motes, haze, full connected hull,
  // interstitial fog, near metal, core, and foreground drifting motes.
  this.drawDistant(ctx,cam,scale);
  this.drawParticles(ctx,cam,time,fps,reducedMotion,false,scale);
  this.drawMist(ctx,cam,time,fps,reducedMotion,false,scale);
  ctx.save();ctx.translate(center.x,center.y);ctx.scale(scale,scale);
  if(this.glow){
   ctx.globalAlpha=.15;ctx.drawImage(this.glow,-330,-330,660,660);
  }
  ctx.globalAlpha=.88;
  ctx.drawImage(this.hull,-WORLD_WIDTH/2,-WORLD_HEIGHT/2,WORLD_WIDTH,WORLD_HEIGHT);
  ctx.restore();
  this.drawMist(ctx,cam,time,fps,reducedMotion,true,scale);
  ctx.save();ctx.translate(center.x,center.y);ctx.scale(scale,scale);
  if(this.nearHull&&this.layers.near){
   ctx.globalAlpha=.32;
   ctx.drawImage(this.nearHull,-WORLD_WIDTH/2,-WORLD_HEIGHT/2,WORLD_WIDTH,WORLD_HEIGHT);
  }
  this.drawCore(ctx,time,fps,reducedMotion,stage,activationAge);
  ctx.restore();
  this.drawParticles(ctx,cam,time,fps,reducedMotion,true,scale);
 }
}

export const REACTOR_LANDMARK_ANCHOR = ANCHOR;
export const REACTOR_LANDMARK_SIZE = Object.freeze({width: WORLD_WIDTH, height: WORLD_HEIGHT});
