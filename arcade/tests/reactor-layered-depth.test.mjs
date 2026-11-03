import test from 'node:test';
import assert from 'node:assert/strict';
import {ReactorLandmark, REACTOR_LANDMARK_ANCHOR, REACTOR_LANDMARK_SIZE, REACTOR_DEPTH_RATES, reactorParallaxAnchor} from '../reactor-landmark.js';

function makeContext() {
 const events = [];
 const gradient = () => ({addColorStop() {}});
 const ctx = {
  events,
  save() { events.push('save'); },
  restore() { events.push('restore'); },
  translate() { events.push('translate'); },
  scale() { events.push('scale'); },
  moveTo() {},
  lineTo() {},
  transform() { events.push('transform'); },
  drawImage() { events.push('drawImage'); },
  fillRect() { events.push('fillRect'); },
  createRadialGradient: gradient,
  createLinearGradient: gradient,
  beginPath() {},
  ellipse() { events.push('ellipse'); },
  stroke() {}
 };
 return ctx;
}

function withCanvasMocks(run) {
 const previousImage = globalThis.Image;
 const previousDocument = globalThis.document;
 const sources = [];
 let canvasCreations = 0;
 globalThis.document = {
  createElement(type) {
   assert.equal(type, 'canvas');
   canvasCreations++;
   return {width: 0, height: 0, getContext: () => makeContext()};
  }
 };
 globalThis.Image = class {
  naturalWidth = 1280;
  naturalHeight = 1280;
  set src(value) {
   sources.push(String(value));
   this.onload?.();
  }
 };
 try { run({sources, canvasCreations: () => canvasCreations}); }
 finally {
  if (previousImage === undefined) delete globalThis.Image;
  else globalThis.Image = previousImage;
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
 }
}

test('reactor geometry keeps its world anchor and a single source sprite', () => {
 withCanvasMocks(({sources}) => {
  const reactor = new ReactorLandmark();
  assert.deepEqual(REACTOR_LANDMARK_ANCHOR, {x: 80, y: -310});
  assert.deepEqual(REACTOR_LANDMARK_SIZE, {width: 1900, height: 1190});
  assert.ok(reactor.hull);
  assert.ok(reactor.nearHull);
  assert.ok(reactor.distant);
  assert.ok(reactor.mist);
  assert.equal(sources.length, 1);
  assert.match(sources[0], /reactor-ring-03\.png$/);
  assert.equal(reactor.energyAtlas, null, 'live game must not load stage atlas before a real stage exists');
 });
});

test('reactor culls off-screen drawings and makes no frame-time canvases', () => {
 withCanvasMocks(({canvasCreations}) => {
  const reactor = new ReactorLandmark();
  const ctx = makeContext();
  const pre = canvasCreations();
  reactor.draw(ctx, {x: 5000, y: 5000, w: 1100, h: 650}, 0, 60, false);
  assert.equal(ctx.events.length, 0);
  const visible = {x: -470, y: -650, w: 1100, h: 650};
  for (let i = 0; i < 12; i++) reactor.draw(ctx, visible, i / 12, 25, true);
  assert.ok(ctx.events.includes('drawImage'));
  assert.equal(canvasCreations(), pre, 'the frame renderer must only use cached bitmaps');
 });
});

test('workshop can use four energy tiles without changing gameplay contracts', () => {
 withCanvasMocks(({sources}) => {
  const reactor = new ReactorLandmark({loadEnergyAtlas: true});
  assert.equal(sources.length, 2);
  assert.match(sources[1], /reactor-energy-milestones-v1\.png$/);
  const ctx = makeContext(), cam = {x: -470, y: -650, w: 1100, h: 650};
  for (let stage = 0; stage <= 4; stage++) reactor.draw(ctx, cam, stage, 60, false, stage, stage === 4 ? .25 : Infinity);
  assert.ok(ctx.events.filter(v => v === 'drawImage').length >= 15);
  assert.equal(ctx.events.filter(v => v === 'save').length, ctx.events.filter(v => v === 'restore').length);
 });
});


test('only detached infrastructure and haze have parallax; hull stays locked to the core', () => {
 const cam={x:1080,y:690};
 assert.deepEqual(reactorParallaxAnchor({x:80,y:-310},REACTOR_DEPTH_RATES.distant),
  REACTOR_LANDMARK_ANCHOR);
 const distant=reactorParallaxAnchor(cam,REACTOR_DEPTH_RATES.distant);
 const haze=reactorParallaxAnchor(cam,REACTOR_DEPTH_RATES.haze);
 const hull=reactorParallaxAnchor(cam,REACTOR_DEPTH_RATES.hull);
 assert.ok(distant.x>haze.x&&haze.x>hull.x);
 assert.ok(distant.y>haze.y&&haze.y>hull.y);
 assert.deepEqual(hull,REACTOR_LANDMARK_ANCHOR);
});

test('depth planes can be disabled independently without hiding the reactor core', () => {
 withCanvasMocks(() => {
  const reactor=new ReactorLandmark();
  const cam={x:-470,y:-650,w:1100,h:650};
  const all=makeContext();
  reactor.draw(all,cam,0,60,false);
  reactor.layers={distant:false,mist:false,near:false};
  const minimal=makeContext();
  reactor.draw(minimal,cam,0,60,false);
  assert.ok(all.events.filter(x=>x==='drawImage').length>
   minimal.events.filter(x=>x==='drawImage').length);
  assert.ok(minimal.events.filter(x=>x==='drawImage').length>=2,
   'main metal and energy core remain visible without scenic layers');
 });
});
