// A distant, world-anchored reactor monument. This is scenery, not cover or an interactable target.
// The background sky has parallax; hull and core must share one world position.
const ANCHOR = Object.freeze({x: 80, y: -195});
const WORLD_WIDTH = 2140;
const WORLD_HEIGHT = 1341;
const TEXTURE_WIDTH = 1500;
const TEXTURE_HEIGHT = 940;
const TAU = Math.PI * 2;

function texture(width, height) {
 const canvas = document.createElement('canvas');
 canvas.width = width;
 canvas.height = height;
 return canvas;
}

export class ReactorLandmark {
 constructor() {
  this.hull = null;
  this.glow = this.makeGlow();
  this.failed = false;
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
   if (image.naturalWidth) this.hull = this.makeHull(image);
  };
  image.onerror = () => { this.failed = true; };
  image.src = new URL('./studio/assets/reactor-ring-03.png', import.meta.url).href;
  // Retain the image only until it has been rasterized into one oblique layer.
  this.source = image;
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
   // A single perspective-like oblique projection, baked once on image load.
   // Its shear makes the far rim recede to the left and the near rim advance.
   c.transform(1, -.085, .14, .565, 0, 0);
   if (underside) {
    c.globalAlpha = .67;
    c.filter = 'brightness(0.26) saturate(0.65)';
   } else {
    c.globalAlpha = .92;
   }
   c.drawImage(image, -625, -625, 1250, 1250);
   c.restore();
  };
  // The darker, lowered copy suggests the immense depth of the metal rim.
  paint(25, true);
  paint(0, false);
  this.source = null;
  return canvas;
 }
 draw(ctx, cam, time = 0, fps = 60, reducedMotion = false) {
  if (!this.hull) return;
  const x = ANCHOR.x, y = ANCHOR.y;
  if (x + WORLD_WIDTH / 2 < cam.x || x - WORLD_WIDTH / 2 > cam.x + cam.w ||
      y + WORLD_HEIGHT / 2 < cam.y || y - WORLD_HEIGHT / 2 > cam.y + cam.h) return;

  // One image of the whole reactor per frame. No per-frame perspective filters.
  ctx.save();
  ctx.translate(x, y);
  const animate = !reducedMotion && fps >= 34;
  const pulse = animate ? Math.sin(time * 1.25) * .055 : 0;
  if (this.glow) {
   ctx.globalAlpha = .27 + pulse;
   ctx.drawImage(this.glow, -315, -315, 630, 630);
  }
  ctx.globalAlpha = .9;
  ctx.drawImage(this.hull, -WORLD_WIDTH / 2, -WORLD_HEIGHT / 2,
   WORLD_WIDTH, WORLD_HEIGHT);
  // The energy is in the central opening, at exactly the hull's world anchor.
  if (this.glow) {
   ctx.globalAlpha = .73 + pulse;
   ctx.drawImage(this.glow, -122, -122, 244, 244);
  }
  ctx.strokeStyle = 'rgba(104,207,247,.32)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 108, 61, -.085, 0, TAU);
  ctx.stroke();
  if (animate) {
   ctx.strokeStyle = 'rgba(160,229,255,' + (.17 + pulse).toFixed(3) + ')';
   ctx.beginPath();
   ctx.ellipse(0, 0, 139, 78, -.085, -.7, 1.35);
   ctx.stroke();
  }
  ctx.restore();
 }
}

export const REACTOR_LANDMARK_ANCHOR = ANCHOR;
