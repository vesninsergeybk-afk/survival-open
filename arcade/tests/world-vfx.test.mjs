import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldVFX} from '../../src/world-vfx.js';

test('ordinary explosions leave bounded moving plates which expire',()=>{
 const vfx=new WorldVFX();
 vfx.shipExplosion(10,20,18,'#ff8594');
 assert.equal(vfx.shipDebris.length,3);
 const before=vfx.shipDebris.map(p=>({x:p.x,y:p.y}));
 vfx.update(.2);
 assert.ok(vfx.shipDebris.some((p,i)=>p.x!==before[i].x||p.y!==before[i].y));
 for(let i=0;i<30;i++)vfx.shipExplosion(i*7,0,18,'#ff8594');
 assert.ok(vfx.shipDebris.length<=30,'long battles cannot grow debris unbounded');
 vfx.update(4);
 assert.equal(vfx.shipDebris.length,0);
});

test('gunship destruction leaves larger separated sections',()=>{
 const vfx=new WorldVFX();
 vfx.shipExplosion(0,0,35,'#ff8594',true);
 assert.equal(vfx.bossWrecks.length,1);
 assert.equal(vfx.shipDebris.length,0);
 vfx.update(.1);
 assert.ok(vfx.bossWrecks[0].age>0);
});

test('low-effects configuration keeps one plate and reset clears it',()=>{
 const vfx=new WorldVFX({reducedMotion:true});
 vfx.shipExplosion(0,0,20,'#ff8594');
 assert.equal(vfx.shipDebris.length,1);
 vfx.reset();
 assert.equal(vfx.shipDebris.length,0);
 assert.equal(vfx.bossWrecks.length,0);
});

test('ship plasma follows faction tint and capital sections detonate in sequence',()=>{
 const red=new WorldVFX();
 red.shipExplosion(0,0,30,'#ff8594',true);
 assert.equal(red.explosions[0]?.tint,'red');
 assert.equal(red.explosions.length,3);
 assert.ok(red.explosions.slice(1).every(b=>b.age<0),'secondary bursts start later');
 assert.ok(red.particles.some(p=>p.kind==='glow'&&p.tint==='red'&&p.layer==='back'));
 red.update(.16);
 assert.ok(red.explosions.some(b=>b.age>0&&b.radius<30*8));
 const blue=new WorldVFX();
 blue.shipExplosion(0,0,18,'#7fdcff');
 assert.equal(blue.explosions[0]?.tint,'cyan');
});

test('rock fractures are dusty and do not trigger fuel-fire explosions',()=>{
 const vfx=new WorldVFX();
 vfx.asteroidBreak(0,0,24);
 assert.equal(vfx.explosions.length,0);
 assert.equal(vfx.rings.length,0);
 assert.ok(vfx.particles.some(p=>p.kind==='smoke'&&!p.additive));
 assert.ok(vfx.particles.some(p=>p.kind==='shard'));
 vfx.rocketImpact(0,0,20);
 assert.equal(vfx.explosions[0]?.tint,'orange');
 assert.ok(vfx.particles.some(p=>p.kind==='glow'&&p.layer==='back'));
});

test('low-motion mode omits large light and blast animations',()=>{
 const vfx=new WorldVFX({reducedMotion:true});
 vfx.rocketImpact(0,0,24);
 vfx.shipExplosion(0,0,18,'#ff8594',true);
 assert.equal(vfx.explosions.length,0);
 assert.ok(!vfx.particles.some(p=>p.kind==='glow'));
 assert.ok(vfx.particles.length<=vfx.maxParticles);
 vfx.update(5);
 assert.equal(vfx.particles.length,0);
});


test('rock contact stays mineral; only rich-ore extraction gets a faint electrical cue',()=>{
 const ordinary=new WorldVFX();
 ordinary.asteroidImpact(10,20,24);
 assert.ok(ordinary.particles.some(p=>p.kind==='shard'&&!p.additive));
 assert.ok(ordinary.particles.some(p=>p.kind==='scorch'&&!p.additive));
 assert.ok(!ordinary.particles.some(p=>p.kind==='lightning'));
 const extract=new WorldVFX();
 extract.asteroidImpact(10,20,24,true);
 assert.ok(extract.particles.some(p=>p.kind==='lightning'&&p.tint==='cyan'));
});

test('off-screen activity cannot consume on-screen VFX pools or displace nearby explosions',()=>{
 const vfx=new WorldVFX();
 vfx.setViewport({x:0,y:0,w:800,h:600});
 for(let i=0;i<50;i++){
  vfx.shipExplosion(9000+i,9000,22,'#ff8594');
  vfx.asteroidBreak(-8000-i,-5000,28);
  vfx.rocketImpact(10000,10000,24);
 }
 assert.equal(vfx.particles.length,0);
 assert.equal(vfx.explosions.length,0);
 assert.equal(vfx.rings.length,0);
 assert.equal(vfx.shipDebris.length,0);
 vfx.shipExplosion(400,300,22,'#ff8594');
 assert.ok(vfx.particles.length>0&&vfx.explosions.length>0);
 const count=vfx.particles.length;
 vfx.asteroidImpact(810,300,20);
 assert.ok(vfx.particles.length>count,'effects near a screen edge remain visible');
 vfx.setViewport(null);
 vfx.rocketImpact(9000,9000,24);
 assert.ok(vfx.explosions.length>=2,'non-arcade callers keep uncropped VFX');
});

test('combat feedback replaces expendable engine smoke at the particle cap',()=>{
 const vfx=new WorldVFX({reducedMotion:true});
 for(let i=0;i<vfx.maxParticles;i++)vfx._emit('smoke',i,0,{life:2});
 assert.equal(vfx.particles.length,vfx.maxParticles);
 vfx.shieldImpact(0,0,32);
 assert.ok(vfx.particles.some(p=>p.kind==='lightning'&&p.priority===2),
     'shield response remains visible under load');
 vfx.hullImpact(0,0,true);
 assert.ok(vfx.particles.some(p=>p.kind==='star'&&p.priority===2),
     'heavy damage keeps an immediate impact spark');
 assert.equal(vfx.particles.length,vfx.maxParticles,'critical effects recycle slots');
});

test('decorative exhaust cannot evict combat cues and a reduced budget keeps priorities',()=>{
 const vfx=new WorldVFX();
 for(let i=0;i<400;i++)vfx._emit('smoke',i,0,{life:2});
 for(let i=0;i<20;i++)vfx._emit('flare',i,0,{life:2,priority:2});
 vfx.setBudget(.25);
 assert.equal(vfx.particles.length,vfx.maxParticles);
 assert.equal(vfx.particles.filter(p=>p.priority===2).length,20);
 vfx.setBudget(1);
 // Fill with protected impacts; low-priority ambience must then be rejected.
 vfx.reset();
 for(let i=0;i<vfx.maxParticles;i++)vfx._emit('flare',i,0,{life:2,priority:2});
 const before=vfx.particles.map(p=>p.x);
 vfx.engineTrail(0,0,0,'fighter',true,.1);
 assert.deepEqual(vfx.particles.map(p=>p.x),before);
 assert.ok(vfx.particles.every(p=>p.priority===2));
});

test('even when all slots are critical a new player-damage cue can replace an older one',()=>{
 const vfx=new WorldVFX({reducedMotion:true});
 for(let i=0;i<vfx.maxParticles;i++)vfx._emit('flare',i,0,{life:2,priority:2});
 vfx.update(1);
 vfx.arcadePlayerHurt(999,777,false);
 assert.equal(vfx.particles.length,vfx.maxParticles);
 assert.ok(vfx.particles.some(p=>p.x===999&&p.y===777&&p.priority===2));
});

test('shield keeps its circular outline at ship center but flashes at contact',()=>{
 const vfx=new WorldVFX();
 const point={x:19,y:0,nx:1,ny:0,directed:true};
 vfx.shieldImpact(0,0,19,point);
 assert.equal(vfx.rings[0].x,0);
 assert.equal(vfx.rings[0].y,0);
 assert.ok(vfx.particles.some(p=>p.kind==='lightning'&&p.x===19&&p.y===0));
 assert.ok(vfx.particles.filter(p=>p.kind==='star')
  .every(p=>p.vx>0),'shield sparks leave the contacted side');
});

test('small hull leakage through the shield has a modest glint, not a heavy breach',()=>{
 const point={x:19,y:0,nx:1,ny:0,directed:true};
 const minor=new WorldVFX();
 minor.arcadePlayerHurt(0,0,true,true,point,3);
 assert.ok(minor.rings.some(r=>r.tint==='cyan'&&r.x===0));
 assert.ok(!minor.rings.some(r=>r.tint==='red'));
 assert.ok(!minor.particles.some(p=>p.kind==='shard'));
 assert.ok(minor.particles.some(p=>p.kind==='star'&&p.tint==='orange'&&p.x===19));
 const major=new WorldVFX();
 major.arcadePlayerHurt(0,0,true,true,point,8);
 assert.ok(major.rings.some(r=>r.tint==='red'));
 assert.ok(major.particles.some(p=>p.kind==='shard'));
 const bare=new WorldVFX();
 bare.arcadePlayerHurt(0,0,false,true,point,3);
 assert.ok(bare.rings.some(r=>r.tint==='red'),
  'попадание прямо в корпус по-прежнему заметно');
});

test('deflected hits are visible at contact without a ship-wide damage pulse',()=>{
 const vfx=new WorldVFX({reducedMotion:true});
 vfx.arcadePlayerDeflect(0,0,{x:19,y:0,nx:1,ny:0,directed:true});
 assert.deepEqual(vfx.rings.map(r=>[r.x,r.y,r.radius,r.tint]),[[19,0,19,'violet']]);
 assert.ok(vfx.particles.some(p=>p.kind==='star'&&p.tint==='violet'&&p.priority===2));
 assert.ok(!vfx.particles.some(p=>p.kind==='shard'||p.kind==='lightning'));
 assert.ok(vfx.particles.length<=vfx.maxParticles);
});

test('directed hull and mineral impacts eject fragments outward',()=>{
 const point={x:50,y:0,nx:1,ny:0,directed:true};
 const hull=new WorldVFX();
 hull.hullImpact(50,0,true,point);
 const hot=hull.particles.filter(p=>p.kind==='shard');
 assert.ok(hot.length>=2);
 assert.ok(hot.every(p=>p.vx>0));
 const mineral=new WorldVFX();
 mineral.asteroidImpact(50,0,20,false,point);
 const chips=mineral.particles.filter(p=>p.kind==='shard');
 assert.ok(chips.length>=2);
 assert.ok(chips.every(p=>p.vx>0));
 assert.ok(!mineral.particles.some(p=>p.kind==='lightning'));
});


test('concept explosion profiles match their event materials and impact direction',()=>{
  const vfx=new WorldVFX();
  vfx.rocketImpact(30,40,22,{directed:true,nx:0,ny:1});
  assert.equal(vfx.explosions[0]?.profile,'rocket');
  assert.ok(Math.abs(vfx.explosions[0]?.angle-Math.PI/2)<1e-6);
  assert.equal(vfx.explosions[0]?.tint,'orange');
  const rocketRadius=vfx.explosions[0].radius;
  vfx.shipExplosion(0,0,18,'#ff8594');
  assert.equal(vfx.explosions.at(-1)?.profile,'ship');
  assert.ok(vfx.explosions.at(-1)?.radius>rocketRadius);
  vfx.shipExplosion(0,0,38,'#ff8594',true);
  assert.ok(vfx.explosions.slice(-3).every(b=>b.profile==='capital'));
  vfx.meteorStrike(0,0,70,true);
  assert.equal(vfx.explosions.at(-1)?.profile,'ion');
  assert.equal(vfx.explosions.at(-1)?.tint,'red');
  const existing=vfx.explosions.length;
  vfx.asteroidBreak(0,0,30);
  assert.equal(vfx.explosions.length,existing,'stone break has no plasma atlas');
});

test('reflections are short, directional and capped per rendered scene',()=>{
  const vfx=new WorldVFX();
  vfx.rocketImpact(100,0,22);
  assert.ok(vfx.lightBursts.length>0);
  const calls={strokes:0,angles:[]};
  const ctx={save(){},restore(){},beginPath(){},arc(_x,_y,_r,a){calls.angles.push(a);},
    stroke(){calls.strokes++;},set globalCompositeOperation(v){this.op=v;},
    set strokeStyle(v){this.color=v;},set lineWidth(v){this.width=v;},
    set lineCap(v){this.cap=v;}};
  vfx.beginSurfaceLights();
  for(let i=0;i<12;i++)vfx.renderSurfaceLight(ctx,60+i,0,20);
  assert.equal(vfx.lightPainted,4,'at most four illuminated hull silhouettes');
  assert.equal(calls.strokes,8,'two light-catching edges per affected hull');
  assert.ok(calls.angles.every(a=>a<.9&&a>-.9),'highlight faces flash source');
  vfx.update(.4);
  vfx.beginSurfaceLights();
  assert.equal(vfx.lightBursts.length,0);
  assert.equal(vfx.renderSurfaceLight(ctx,20,0,20),false);
  const quiet=new WorldVFX({reducedMotion:true});
  quiet.rocketImpact(100,0,22);
  assert.equal(quiet.lightBursts.length,0);
});

test('saturated particle budgets cannot grow temporary illumination indefinitely',()=>{
  const vfx=new WorldVFX();
  for(let i=0;i<35;i++)vfx.rocketImpact(i*7,0,22);
  assert.ok(vfx.lightBursts.length<=vfx.maxLightBursts);
  assert.ok(vfx.explosions.length<=vfx.maxExplosions);
  assert.ok(vfx.particles.length<=vfx.maxParticles);
  vfx.reset();
  assert.equal(vfx.lightBursts.length,0);
});
