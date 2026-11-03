import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {simulationSlices} from '../src/frame-clock.js';
import {PrologueTactics} from '../src/prologue-tactics.js';
import {PrologueMissionWorld} from '../src/prologue-mission.js';
import {ENEMIES} from '../src/data.js';
import {RenderBudget} from '../src/render-budget.js';
import {GameState} from '../src/config.js';

test('8, 10, 20 and 60 FPS retain elapsed simulation time; resume is bounded',()=>{
 for(const fps of [8,10,20,60]){
  let elapsed=0;for(let f=0;f<fps;f++){
   const s=simulationSlices(1000/fps);assert.ok(s.dt<=1/30+1e-10);elapsed+=s.dt*s.count;
  }
  assert.ok(Math.abs(elapsed-1)<1e-10);
 }
 assert.equal(simulationSlices(30000).elapsed,.15);
});

function scene(){
 const game={player:{x:10000,y:8000,heal(){}},friendlyBases:{bases:[]},enemies:[],
  gameTime:100,_announce(){},worldVfx:{nova(){},hit(){}},_computeDifficultyMults:()=>({hpMult:1,dmgMult:1})};
 return {game,world:new PrologueMissionWorld(game)};
}
test('The room wakes three scouts once and they survive two sentry hits',()=>{
 const {game,world}=scene();world.enterPhase(game,1);
 assert.equal(game.enemies.length,0);
 game.gameTime+=.97;world._updateSpac1Wake(game);assert.equal(game.enemies.length,1);
 game.gameTime+=.45;world._updateSpac1Wake(game);assert.equal(game.enemies.length,2);
 game.gameTime+=.45;world._updateSpac1Wake(game);assert.equal(game.enemies.length,3);
 world._updateSpac1Wake(game);assert.equal(game.enemies.length,3);
 for(const e of game.enemies){e.takeDamage(14);e.takeDamage(14);assert.ok(e.hp>0);}
});
test('Same-room sight reacts at the entrance, cover and closed doors block shots',()=>{
 const {game,world}=scene();game.player.x=world.cx+960;game.player.y=world.cy+160;
 world._spawnActive(game,'security',0,world.point(1785,245),ENEMIES.SNIPER,72,80,false);
 const e=game.enemies[0];world.tactics.update(.21,game);
 assert.equal(e.prologueAI.known.x,game.player.x,'825-unit sighting in the same room');
 assert.equal(world.clearLineOfFire(world.cx+1240,world.cy,world.cx+1610,world.cy),false,'pillar blocks fire');
 assert.equal(world.clearLineOfFire(world.cx+450,world.cy,world.cx+650,world.cy),false,'closed gate blocks fire');
});
test('A walker passes a pillar without entering it or stopping at its edge',()=>{
 const world={clearLineOfFire:()=>true,walkable(x,y,r){return !(x>100-r&&x<240+r&&y>-90-r&&y<90+r);}};
 const t=new PrologueTactics(world),e={x:0,y:0,hp:72,speed:90,size:14},game={gameTime:0,player:{x:400,y:0}};
 t.onSpawn(e,'security',1,game);
 for(let i=0;i<600;i++){
  game.gameTime+=1/60;const dx=400-e.x,dy=-e.y,d=Math.hypot(dx,dy);
  const v=t.navigate(e,game,dx/d*90,dy/d*90);e.x+=v.vx/60;e.y+=v.vy/60;
  assert.ok(world.walkable(e.x,e.y,e.size),'no wall penetration');
 }
 assert.ok(e.x>350,'walked around the cover');
});
test('A nearby alerted guard damages a real turret, preserving repairable integrity',()=>{
 const {game,world}=scene();game.player.x=world.cx+1160;game.player.y=world.cy+160;
 const p=world.point(1200,210);world._spawnActive(game,'security',1,p,ENEMIES.BAT,72,95,false);
 const e=game.enemies[0];e.prologueAI.alertUntil=game.gameTime+5;
 const turret={integrity:100,disabled:false};
 const base={id:'prologue-sentry-a',...world.point(1160,245),hp:180,activated:true,turrets:[turret]};game.friendlyBases.bases=[base];
 world.tactics.update(.21,game);assert.equal(turret.integrity,88);
 assert.equal(world.tactics.targetFor(e,game.player,game),base);
 game.gameTime+=.2;world.tactics.update(.21,game);assert.equal(turret.integrity,88,'cooldown prevents repeated per-frame damage');
});
test('Prepared sprite atlases are bounded, have 176+96 cells and no runtime pixel reads',()=>{
 const base=new URL('../assets/prologue/spac1/runtime-v2/',import.meta.url);
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',base)));
 let bytes=0,cells=0;for(const s of Object.values(manifest.sheets)){
  const file=new URL(s.file,base);bytes+=statSync(file).size;cells+=s.cols*s.rows;
  assert.equal(readFileSync(file).toString('ascii',0,4),'RIFF');
 }
 assert.equal(cells,272);assert.ok(bytes<1400000);
 const source=readFileSync(new URL('../src/spac1-sprites.js',import.meta.url),'utf8');
 assert.ok(!source.includes('getImageData'));
});

test('Sustained slow frames reduce the actual Canvas2D pixel count',()=>{
 const budget=new RenderBudget();assert.equal(budget.plan().canvasRatio,1);
 for(let i=0;i<100;i++)budget.sample(100,35);
 assert.ok(budget.plan().canvasRatio<=.72);
 assert.ok((1200*800*budget.plan().canvasRatio**2)<1200*800*.55);
});

test('The complete prologue still opens every gate and records victory',()=>{
 globalThis.document={getElementById:()=>null};
 try{
  const {game,world:w}=scene();
  Object.assign(game.player,{hp:110,maxHp:110,weapons:[]});
  Object.assign(game,{state:GameState.PLAYING,beams:[],audio:{playEvent(){},stopMusic(){}},
   createFloatingText(){},completeMission(){return {ok:true,blueprints:[]};},gameOver(){throw Error('core lost');}});
  game.friendlyBases.buy=(_g,b)=>{b.activated=true;return {ok:true};};w.enter(game);
  const tick=(seconds=1)=>{for(let t=0;t<seconds-1e-8;t+=.1){
   game.gameTime+=.1;w.update(game,.1);for(const e of game.enemies)e.hp=0;
  }};
  const move=(x,y=0)=>{game.player.x=w.cx+x;game.player.y=w.cy+y;};
  const repair=id=>{
   const d=w.device(id);game.player.x=d.x;game.player.y=d.y;tick(3);
   assert.ok(w.beginRepairBeam(game),'begin '+id);tick(w.repairHold.duration+.2);
   assert.ok(w.done(id),'finished '+id);
  };
  const interact=id=>{
   const d=w.device(id);game.player.x=d.x;game.player.y=d.y;
   assert.equal(w.canInteract(game)?.device.id,id);assert.ok(w.interact(game));tick(.2);
  };
  const next=(phase,x)=>{tick(3);move(x);tick(.2);assert.equal(w.phase,phase);};
  repair('generator');interact('dock-gate');next(1,940);
  repair('sentry-a');repair('sentry-b');tick(23);
  assert.equal(w.gate(1).target,1);next(2,2340);
  interact('weapon');tick(2);assert.equal(w.gate(2).target,1);
  next(3,3450);interact('relay-a');interact('relay-b');tick(18);assert.equal(w.gate(3).target,1);
  next(4,4790);repair('terminal');tick(2);assert.equal(w.gate(4).target,1);
  next(5,6000);repair('heavy-a');repair('heavy-b');assert.equal(w.siegeStarted,false,'player explicitly chooses readiness');interact('core-start');tick(65);
  assert.equal(w.uploadProgress,100);assert.equal(w.gate(5).target,1);
  assert.equal(game.player.trainingEarned,3);
  assert.ok(!w.done('helios')&&!w.done('coolant')&&!w.done('capacitor'),'all side wings are optional');
  next(6,7490);interact('transmitter');tick(5);assert.equal(w.victory,true);
 }finally{delete globalThis.document;}
});

test('Each displayed pose uses exactly one equal-sized source cell and destination',async()=>{
 const previous=globalThis.Image,idle=globalThis.requestIdleCallback;
 globalThis.Image=class{naturalWidth=1280;decode(){return Promise.resolve();}set src(v){queueMicrotask(()=>this.onload?.());}};
 globalThis.requestIdleCallback=fn=>fn();
 try{
  const sprites=await import('../src/spac1-sprites.js?render-test');
  sprites.warmSpac1();sprites.warmSpac1Wake(true);await new Promise(resolve=>setImmediate(resolve));
  const calls=[],ctx={drawImage(...args){calls.push(args);}};
  for(const state of ['idle','walk','attack'])for(let direction=0;direction<8;direction++){
   for(let frame=0;frame<sprites.SPAC1_COUNTS[state];frame++){
    const before=calls.length;assert.ok(sprites.drawSpac1PreviewFrame(ctx,state,direction,frame,300,200,96));
    assert.equal(calls.length-before,1,'one opaque pose, no crossfade');
    assert.deepEqual(calls.at(-1).slice(3,5),[160,160]);
    assert.deepEqual(calls.at(-1).slice(5),[220,83.52,160,160]);
   }
  }
 }finally{globalThis.Image=previous;globalThis.requestIdleCallback=idle;}
});
