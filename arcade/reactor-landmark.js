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
  this.failed = false;
  this.energyAtlas = null;
  this.energyFailed = false;
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
   if (image.naturalWidth) this.hull = this.makeHull(image);
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
  const x = ANCHOR.x, y = ANCHOR.y;
  if (x + WORLD_WIDTH / 2 < cam.x || x - WORLD_WIDTH / 2 > cam.x + cam.w ||
      y + WORLD_HEIGHT / 2 < cam.y || y - WORLD_HEIGHT / 2 > cam.y + cam.h) return;

  ctx.save();
  ctx.translate(x, y);
  // World-anchored halo is drawn behind the same metal sprite.
  if (this.glow) {
   ctx.globalAlpha = .15;
   ctx.drawImage(this.glow, -330, -330, 660, 660);
  }
  ctx.globalAlpha = .88;
  ctx.drawImage(this.hull, -WORLD_WIDTH / 2, -WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT);
  this.drawCore(ctx, time, fps, reducedMotion, stage, activationAge);
  ctx.restore();
 }
}

export const REACTOR_LANDMARK_ANCHOR = ANCHOR;
export const REACTOR_LANDMARK_SIZE = Object.freeze({width: WORLD_WIDTH, height: WORLD_HEIGHT});
