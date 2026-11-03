import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {ModelInstances,disposeSources} from '../src/model-instances.js';
import {RenderBudget,inCamera} from '../src/render-budget.js';
import {Hybrid3D} from '../src/hybrid-3d.js';
import {UI} from '../src/ui.js';
import {Player} from '../src/entities.js';
import {simulationSlices} from '../src/frame-clock.js';

const source=()=>{
 const scene=new THREE.Group(),geometry=new THREE.BoxGeometry(10,8,30),material=new THREE.MeshStandardMaterial({color:'#aaccee'});
 const mesh=new THREE.Mesh(geometry,material);mesh.position.set(12,0,4);scene.add(mesh);
 return {scene,geometry,material};
};

test('300 spawns share one material copy and geometry, without changing the source asset',()=>{
 const gltf=source(),pool=new ModelInstances(),initial=gltf.material.color.clone();
 const instances=Array.from({length:300},()=>pool.acquire(gltf,31,'#d67877'));
 const materials=new Set(),geometry=new Set();
 for(const root of instances)root.traverse(n=>{if(n.isMesh){materials.add(n.material);geometry.add(n.geometry);}});
 assert.equal(materials.size,1);assert.equal(geometry.size,1);
 assert.ok(gltf.material.color.equals(initial));assert.equal(pool.materials.size,1);
 const box=new THREE.Box3().setFromObject(instances[0]);
 assert.ok(Math.abs(box.getSize(new THREE.Vector3()).z-31)<1e-6);
 assert.ok(box.getCenter(new THREE.Vector3()).length()<1e-6);
 pool.dispose();disposeSources([gltf]);
});

test('pool reuses actors with reset transforms and never retains more than its cap',()=>{
 const gltf=source(),pool=new ModelInstances(12);
 const roots=Array.from({length:30},()=>pool.acquire(gltf,31,'#d67877'));
 for(const root of roots){root.position.set(900,4,200);root.scale.setScalar(3);pool.release(root);}
 assert.equal(pool.freeCount,12);
 const reused=pool.acquire(gltf,31,'#d67877');
 assert.equal(pool.reused,1);assert.equal(pool.freeCount,11);
 assert.equal(reused.position.length(),0);assert.equal(reused.scale.x,1);assert.equal(reused.visible,true);
 pool.release(reused);pool.release(reused);assert.equal(pool.freeCount,12);
 pool.dispose();disposeSources([gltf]);
});

test('disposing pooled assets releases shared GPU resources exactly once',()=>{
 const gltf=source(),pool=new ModelInstances();
 const root=pool.acquire(gltf,31,'#d67877');let tinted=0,geometry=0,original=0;
 root.traverse(n=>{if(n.isMesh)n.material.addEventListener('dispose',()=>tinted++);});
 gltf.geometry.addEventListener('dispose',()=>geometry++);gltf.material.addEventListener('dispose',()=>original++);
 pool.release(root);pool.dispose();pool.dispose();disposeSources([gltf,gltf]);
 assert.deepEqual([tinted,geometry,original],[1,1,1]);
});

test('auto budgets visuals without changing the 300-enemy simulation',()=>{
 const budget=new RenderBudget({mobile:true,devicePixelRatio:3});
 const enemies=Array.from({length:300},(_,i)=>({hp:10,x:i,y:0}));
 const before=structuredClone(enemies);
 assert.equal(budget.plan(10).enemyModels,2);
 const plan=budget.plan(enemies.length);
 assert.equal(plan.enemyModels,0);assert.equal(plan.bossModels,1);
 assert.ok(plan.pixelRatio<=1);assert.equal(plan.enemyGlow,false);
 assert.deepEqual(enemies,before);
});

test('crowd thresholds have hysteresis and full 3D is an explicit opt-in',()=>{
 const budget=new RenderBudget();
 assert.equal(budget.plan(47).enemyModels,8);
 assert.equal(budget.plan(48).enemyModels,4);
 assert.equal(budget.plan(45).enemyModels,4);
 assert.equal(budget.plan(31).enemyModels,8);
 assert.equal(budget.plan(100).enemyModels,0);
 assert.equal(budget.plan(90).enemyModels,0);
 assert.equal(budget.plan(74).enemyModels,4);
 budget.setMode('3d');assert.equal(budget.plan(300).enemyModels,32);
 budget.setMode('2d');assert.equal(budget.plan(300).bossModels,0);assert.equal(budget.plan(300).enemyGlow,false);
});

test('sustained slow frames lower quality; a one-off pause does not; recovery is delayed',()=>{
 const budget=new RenderBudget();budget.sample(1500,5);assert.equal(budget.level,0);
 budget.sample(80,40);assert.equal(budget.level,0);
 for(let i=0;i<240;i++)budget.sample(40,24);
 const low=budget.level;assert.ok(low>0);
 for(let i=0;i<60;i++)budget.sample(16.7,3);
 assert.equal(budget.level,low);
 for(let i=0;i<1100;i++)budget.sample(16.7,3);
 assert.ok(budget.level<low);
});

test('repeated GPU stalls lower quality even with cheap CPU submission',()=>{
 const budget=new RenderBudget();
 for(let i=0;i<30;i++)budget.sample(1200,3);
 assert.ok(budget.level>0);
});

test('lost or inactive WebGL clears visibility flags for the current 2D fallback',()=>{
 const renderer=Object.create(Hybrid3D.prototype);
 const actors=Array.from({length:4},()=>({_hybrid3dVisible:true}));
 Object.assign(renderer,{player:actors[0],bosses:new Map([[actors[1],{}]]),
  enemies3d:new Map([[actors[2],{}]]),enemyMissiles:new Map([[actors[3],{}]]),
  contextLost:true,renderer:{clear(){}}});
 renderer.render();assert.ok(actors.every(a=>a._hybrid3dVisible===false));
 actors.forEach(a=>a._hybrid3dVisible=true);renderer.contextLost=false;
 renderer.render({active:false});assert.ok(actors.every(a=>a._hybrid3dVisible===false));
});

test('actual renderer recycles the same 3D graph across changing enemies and clears 2D flags',()=>{
 const renderer=Object.create(Hybrid3D.prototype),gltf=source();
 Object.assign(renderer,{scene:new THREE.Scene(),rigs:new ModelInstances(48),
     models:new Map([[19212,gltf]]),enemies3d:new Map(),quality:new RenderBudget({mode:'3d'}).plan()});
 let enemies;
 for(let cycle=0;cycle<20;cycle++){
  if(enemies)renderer.syncEnemies([],0,0,1200,800,{x:0,y:0},cycle);
  enemies=Array.from({length:300},(_,i)=>({id:'bat',x:i%12,y:i%9,size:14,hp:10,visualAngle:0}));
  renderer.syncEnemies(enemies,0,0,1200,800,{x:0,y:0},cycle);
  assert.equal(renderer.enemies3d.size,32);
 }
 assert.equal(renderer.rigs.created,32);assert.ok(renderer.rigs.reused>500);
 renderer.quality=new RenderBudget().plan(300);
 renderer.syncEnemies(enemies,0,0,1200,800,{x:0,y:0},21);
 assert.equal(renderer.enemies3d.size,0);assert.ok(enemies.every(e=>!e._hybrid3dVisible));
 renderer.rigs.dispose();disposeSources([gltf]);
});

test('offscreen bodies are culled while long aiming telegraphs can still intersect the camera',()=>{
 const camera={worldX:1000,worldY:2000};
 assert.equal(inCamera({x:1200,y:2200,size:20},camera,800,400),true);
 assert.equal(inCamera({x:5000,y:2200,size:20},camera,800,400),false);
 assert.equal(inCamera({x:700,y:2200,size:20},camera,800,400,800),true);
});

test('600 unchanged HUD frames do not rebuild equipment; a rank change redraws once',()=>{
 const previous=globalThis.document;let created=0,clears=0;
 const container={set innerHTML(_value){clears++;},appendChild(){}};
 globalThis.document={createElement(){created++;return {classList:{add(){}},appendChild(){}};}};
 try{
  const ui=Object.create(UI.prototype),items=[{icon:'🔹',level:1,max:5}];
  for(let frame=0;frame<600;frame++)ui._renderChips(container,items);
  assert.equal(clears,1);assert.equal(created,2);
  items[0].level=2;ui._renderChips(container,items);assert.equal(clears,2);assert.equal(created,4);
 }finally{globalThis.document=previous;}
});

test('HUD throttling never delays health or level changes',()=>{
 const ui=Object.create(UI.prototype),player=new Player(0,0),slot=()=>({style:{},textContent:''});
 ui.els=Object.fromEntries(['hp','maxHp','hpBar','level','expBar','time','kills'].map(id=>[id,slot()]));
 ui._renderChips=()=>{};
 const game={player,gameTime:0,kills:0};
 ui.updateHud(game);player.hp=42;ui.updateHud(game);
 assert.equal(ui.els.hp.textContent,42);
 player.level=2;ui.updateHud(game);assert.equal(ui.els.level.textContent,2);
});

test('level-up and docking keep controls active without redrawing 300 frozen ships each frame',async()=>{
 const {readFileSync}=await import('node:fs');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const body=main.match(/    _frame\(now\) \{([\s\S]*?)\n    \}\n\n    update\(dt\)/)?.[1];
 assert.ok(body);
 const frame=new Function('GameState','CONFIG','performance','simulationSlices','return function(now){'+body+'}')(
  {PLAYING:'playing',LEVEL_UP:'levelup',DOCK:'dock'},
  {DT_CLAMP:.05,CANVAS_WIDTH:1200,CANVAS_HEIGHT:800},{now:()=>0},simulationSlices);
 for(const state of ['levelup','dock']){
  let draws=0,inputs=0,schedules=0;
  const game={state,gameTime:10,lastTime:0,input:{pollGamepad(){inputs++;}},
   effects:{update(){}},render(){draws++;},fpsMeter:{tick(){}},
   diagnostics:{measure(_name,fn){return fn();},frame(){}},
   ui:{setFps(){}},save:{settings:{}},_scheduleFrame(){schedules++;}};
  frame.call(game,16);frame.call(game,32);
  assert.deepEqual([draws,inputs,schedules],[1,2,2]);
  game._worldDirty=true;frame.call(game,48);assert.equal(draws,2);
 }
});

