// The reactor is an enormous distant landmark, not a collision object.
// All rigid metalwork and the core stay at one fixed world anchor.
// Only the existing sky/independent dust may use camera parallax.
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


// Only detached background structures and suspended haze move at different
// apparent depths. The connected hull, inner ring, and energy core stay 1:1.
export const REACTOR_DEPTH_RATES = Object.freeze({distant: .66, haze: .84, hull: 1});
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
  this.nearHull = null;
  this.layers = {distant:true,mist:true,near:true};
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
 makeMist() {
  const canvas=texture(640,280),c=canvas.getContext('2d');
  if(!c)return null;
  for(let i=0;i<22;i++){
   const x=60+((i*193+51)%540),y=45+((i*73+23)%190);
   const r=42+(i*37)%105,stretch=1.4+(i%5)*.44;
   c.save();c.translate(x,y);c.scale(stretch,.42+(i%4)*.1);
   const grad=c.createRadialGradient(0,0,3,0,0,r);
   const a=.065+(i%4)*.015;
   grad.addColorStop(0,'rgba(80,156,187,'+a.toFixed(3)+')');
   grad.addColorStop(.46,'rgba(48,98,143,'+(a*.62).toFixed(3)+')');
   grad.addColorStop(1,'rgba(22,62,111,0)');
   c.fillStyle=grad;c.fillRect(-r,-r,r*2,r*2);c.restore();
  }
  c.save();c.globalCompositeOperation='destination-in';
  const edge=c.createLinearGradient(0,0,640,0);
  edge.addColorStop(0,'rgba(0,0,0,0)');
  edge.addColorStop(.15,'rgba(0,0,0,1)');
  edge.addColorStop(.85,'rgba(0,0,0,1)');
  edge.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=edge;c.fillRect(0,0,640,280);c.restore();
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
 drawDistant(ctx,cam) {
  if(!this.distant || !this.layers.distant)return;
  const pos=reactorParallaxAnchor(cam,REACTOR_DEPTH_RATES.distant);
  ctx.save();ctx.globalAlpha=.42;
  ctx.drawImage(this.distant,pos.x-1440,pos.y-730,2880,1390);
  ctx.restore();
 }
 drawMist(ctx,cam,time,fps,reducedMotion,inFront=false) {
  if(!this.mist || !this.layers.mist)return;
  const pos=reactorParallaxAnchor(cam,REACTOR_DEPTH_RATES.haze);
  const drift=(!reducedMotion&&fps>=34)?Math.sin(time*.12)*11:0;
  ctx.save();
  ctx.globalAlpha=inFront?.52:.28;
  const x=pos.x+(inFront?-535:-790)+drift;
  const y=pos.y+(inFront?-60:-290);
  ctx.drawImage(this.mist,x,y,inFront?1120:1530,inFront?410:650);
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
  if (!this.hull) return;
  const x=ANCHOR.x,y=ANCHOR.y;
  if(x+SCENIC_WIDTH/2<cam.x||x-SCENIC_WIDTH/2>cam.x+cam.w||
     y+SCENIC_HEIGHT/2<cam.y||y-SCENIC_HEIGHT/2>cam.y+cam.h)return;

  // Detached silhouettes respond to the camera; real structure never does.
  this.drawDistant(ctx,cam);
  this.drawMist(ctx,cam,time,fps,reducedMotion,false);
  ctx.save();ctx.translate(x,y);
  if(this.glow){
   ctx.globalAlpha=.15;
   ctx.drawImage(this.glow,-330,-330,660,660);
  }
  ctx.globalAlpha=.88;
  ctx.drawImage(this.hull,-WORLD_WIDTH/2,-WORLD_HEIGHT/2,WORLD_WIDTH,WORLD_HEIGHT);
  ctx.restore();
  // Suspended atmospheric material lies between depth planes.
  this.drawMist(ctx,cam,time,fps,reducedMotion,true);
  ctx.save();ctx.translate(x,y);
  if(this.nearHull&&this.layers.near){
   ctx.globalAlpha=.32;
   ctx.drawImage(this.nearHull,-WORLD_WIDTH/2,-WORLD_HEIGHT/2,WORLD_WIDTH,WORLD_HEIGHT);
  }
  this.drawCore(ctx,time,fps,reducedMotion,stage,activationAge);
  ctx.restore();
 }
}

export const REACTOR_LANDMARK_ANCHOR = ANCHOR;
export const REACTOR_LANDMARK_SIZE = Object.freeze({width: WORLD_WIDTH, height: WORLD_HEIGHT});
