import test from 'node:test';
import assert from 'node:assert/strict';
import {ReactorLandmark, REACTOR_LANDMARK_ANCHOR, REACTOR_LANDMARK_SIZE, REACTOR_DEPTH_RATES, reactorParallaxAnchor, reactorSceneScale} from '../reactor-landmark.js';

function makeContext() {
 const events = [], drawCalls = [], fillCalls = [];
 const gradient = () => ({addColorStop() {}});
 const ctx = {
  events, drawCalls, fillCalls,
  save() { events.push('save'); },
  restore() { events.push('restore'); },
  translate() { events.push('translate'); },
  scale() { events.push('scale'); },
  moveTo() {},
  lineTo() {},
  transform() { events.push('transform'); },
  drawImage(source,...rect) { events.push('drawImage'); drawCalls.push({source,alpha:this.globalAlpha,rect}); },
  fillRect(...rect) { events.push('fillRect'); fillCalls.push({alpha:this.globalAlpha,rect}); },
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
  assert.ok(reactor.mote, 'mote glow must be pre-rendered before gameplay');
  assert.ok(reactor.vapour, 'first fog source should load');
  assert.ok(reactor.vapourSecondary, 'front fog source should load');
  assert.ok(reactor.vapourBackAlternate, 'back fog alternate should load');
  assert.ok(reactor.vapourFrontAlternate, 'front fog alternate should load');
  assert.equal(sources.length, 5);
  assert.match(sources[0], /reactor-ring-03\.png$/);
  assert.match(sources[1], /reactor-vapour-v6\.webp$/);
  assert.match(sources[2], /reactor-vapour-secondary-v7\.webp$/);
  assert.match(sources[3], /reactor-vapour-variant-c-v7\.webp$/);
  assert.match(sources[4], /reactor-vapour-variant-d-v7\.webp$/);
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
  assert.equal(sources.length, 6);
  assert.match(sources[5], /reactor-energy-milestones-v1\.png$/);
  const ctx = makeContext(), cam = {x: -470, y: -650, w: 1100, h: 650};
  for (let stage = 0; stage <= 4; stage++) reactor.draw(ctx, cam, stage, 60, false, stage, stage === 4 ? .25 : Infinity);
  assert.ok(ctx.events.filter(v => v === 'drawImage').length >= 15);
  assert.equal(ctx.events.filter(v => v === 'save').length, ctx.events.filter(v => v === 'restore').length);
 });
});


test('whole rigid reactor uses an intermediate parallax depth', () => {
 const cam={x:1080,y:690};
 const distant=reactorParallaxAnchor(cam,REACTOR_DEPTH_RATES.distant);
 const haze=reactorParallaxAnchor(cam,REACTOR_DEPTH_RATES.haze);
 const hull=reactorParallaxAnchor(cam,REACTOR_DEPTH_RATES.hull);
 const nearDust=reactorParallaxAnchor(cam,REACTOR_DEPTH_RATES.foregroundDust);
 assert.ok(distant.x>haze.x&&haze.x>hull.x&&hull.x>nearDust.x);
 assert.ok(distant.y>haze.y&&haze.y>hull.y&&hull.y>nearDust.y);
 assert.ok(REACTOR_DEPTH_RATES.hull>REACTOR_DEPTH_RATES.distant);
 assert.ok(REACTOR_DEPTH_RATES.haze<REACTOR_DEPTH_RATES.hazeSecondary);
 assert.ok(REACTOR_DEPTH_RATES.hazeSecondary<REACTOR_DEPTH_RATES.hull);
 assert.ok(REACTOR_DEPTH_RATES.hull<REACTOR_DEPTH_RATES.hazeFront);
 assert.ok(REACTOR_DEPTH_RATES.hazeFront<REACTOR_DEPTH_RATES.hazeFrontSecondary);
 assert.ok(REACTOR_DEPTH_RATES.hazeFrontSecondary<1);
 assert.ok(REACTOR_DEPTH_RATES.hull<1,'the reactor must move slower than ships');
 const cam2={x:cam.x+400,y:cam.y};
 const screen1=hull.x-cam.x;
 const screen2=reactorParallaxAnchor(cam2,REACTOR_DEPTH_RATES.hull).x-cam2.x;
 assert.ok(Math.abs((screen2-screen1)+400*REACTOR_DEPTH_RATES.hull)<1e-6);
});

test('visual reactor fits inside 80 percent of both desktop and mobile view width', () => {
 for(const width of [620,1100,1200]){
  const scale=reactorSceneScale({w:width,h:800});
  assert.ok(scale>0&&scale<=.58);
  assert.ok(scale*REACTOR_LANDMARK_SIZE.width<=width*.80+.0001);
 }
 assert.ok(reactorSceneScale({w:620})<reactorSceneScale({w:1200}));
 assert.equal(reactorSceneScale({w:1200},.6),.6,'workshop can inspect alternative scales');
});

test('particles occupy two passes without allocating canvases during motion', () => {
 withCanvasMocks(({canvasCreations}) => {
  const reactor=new ReactorLandmark(),cam={x:-470,y:-650,w:1100,h:650};
  assert.equal(reactor.particles.length,108);
  const frame=makeContext(),pre=canvasCreations();
  reactor.draw(frame,cam,10,60,false);
  const withDust=frame.events.filter(x=>x==='fillRect').length;
  reactor.layers.particles=false;
  const noDust=makeContext();
  reactor.draw(noDust,cam,10,60,false);
  assert.ok(withDust>noDust.events.filter(x=>x==='fillRect').length);
  assert.equal(canvasCreations(),pre);
 });
});

test('four fog textures form two independent animated depth planes without frame allocations', () => {
 withCanvasMocks(({canvasCreations}) => {
  const reactor=new ReactorLandmark(),cam={x:-470,y:-650,w:1100,h:650};
  const prepared=canvasCreations();
  const fogSources=[reactor.vapour,reactor.vapourBackAlternate,
   reactor.vapourSecondary,reactor.vapourFrontAlternate];
  const render=(time,fps,reducedMotion)=>{
   const ctx=makeContext();
   reactor.drawMist(ctx,cam,time,fps,reducedMotion,false,.45);
   reactor.drawMist(ctx,cam,time,fps,reducedMotion,true,.45);
   return ctx.drawCalls.filter(v=>fogSources.includes(v.source));
  };
  const first=render(0,25,false),moving=render(18,25,false);
  assert.equal(first.length,4);
  assert.equal(moving.length,4,'all variants remain active even at low FPS');
  assert.ok(first.every(v=>v.alpha>0));
  assert.ok(first.some((v,i)=>Math.abs(v.rect[0]-moving[i].rect[0])>20),
   'fog needs to move with a stationary camera');
  assert.ok(first.some((v,i)=>Math.abs(v.alpha-moving[i].alpha)>.10),
   'cloud silhouettes should crossfade rather than remain unchanged');
  const frozen=render(18,25,true);
  for(let i=0;i<4;i++){
   assert.equal(frozen[i].rect[0],first[i].rect[0]);
   assert.equal(frozen[i].alpha,first[i].alpha);
  }
  assert.equal(canvasCreations(),prepared,'fog must use cached images every frame');
  reactor.layers.mist=false;
  const disabled=makeContext();
  reactor.drawMist(disabled,cam,2,60,false,false,.45);
  reactor.drawMist(disabled,cam,2,60,false,true,.45);
  assert.equal(disabled.drawCalls.filter(v=>fogSources.includes(v.source)).length,0);
 });
});


test('far and near particles are visible at both 60 and 25 fps, with cached glows', () => {
 withCanvasMocks(({canvasCreations}) => {
  const reactor=new ReactorLandmark(),cam={x:-470,y:-650,w:1100,h:650};
  const cached=canvasCreations();
  for (const fps of [60,25]) {
   for (const front of [false,true]) {
    const ctx=makeContext();
    reactor.drawParticles(ctx,cam,2,fps,false,front,.45);
    const glows=ctx.drawCalls.filter(v=>v.source===reactor.mote);
    const motes=ctx.fillCalls;
    assert.ok(glows.length>=10, `missing ${front?'front':'back'} dust at ${fps} fps`);
    assert.equal(glows.length,motes.length);
    assert.ok(glows.some(v=>v.alpha>=.48),
      `no visually legible glow in the ${front?'front':'back'} pass`);
    assert.ok(motes.every(v=>v.rect[2]>=(front?1.5:1.1)));
   }
  }
  assert.equal(canvasCreations(),cached);
 });
});


test('workshop can isolate far and front dust without disabling the hull', () => {
 withCanvasMocks(() => {
  const reactor=new ReactorLandmark(),cam={x:-470,y:-650,w:1100,h:650};
  const far=makeContext(),near=makeContext();
  reactor.layers.frontParticles=false;
  reactor.draw(far,cam,0,60,false);
  assert.ok(far.drawCalls.some(call=>call.source===reactor.mote));
  reactor.layers.farParticles=false;
  reactor.layers.frontParticles=true;
  reactor.draw(near,cam,0,60,false);
  assert.ok(near.drawCalls.some(call=>call.source===reactor.mote));
  reactor.layers.frontParticles=false;
  const noDust=makeContext();
  reactor.draw(noDust,cam,0,60,false);
  assert.equal(noDust.drawCalls.filter(call=>call.source===reactor.mote).length,0);
  assert.ok(noDust.drawCalls.some(call=>call.source===reactor.hull));
 });
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
