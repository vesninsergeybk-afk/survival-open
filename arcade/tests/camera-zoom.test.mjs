import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ArcadeGame} from './runtime-game.mjs';
import {SpatialGrid,spawnOutside} from '../balance.js';
import {CAMERA_ZOOM,flightCamera,flightZoomKey,stepCameraZoom,
 wheelCameraZoom,pointerInFlightWorld,manualWheelDirection,worldTextScale} from '../camera-zoom.js';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);

test('camera keeps the ship in the centre while zoom changes only visible world area',()=>{
 const player={x:430,y:-165};
 for(const zoom of [CAMERA_ZOOM.min,.72,1,1.35,CAMERA_ZOOM.max]){
  const camera=flightCamera(player,1200,800,zoom);
  near(camera.x+camera.w/2,player.x);
  near(camera.y+camera.h/2,player.y);
  near(camera.w,1200/zoom);
  near(camera.h,800/zoom);
  const rect={left:50,top:80,width:600,height:400};
  assert.deepEqual(pointerInFlightWorld(rect,camera,350,280),player);
  const p=pointerInFlightWorld(rect,camera,500,180);
  near((p.x-camera.x)/camera.w*rect.width+rect.left,500);
  near((p.y-camera.y)/camera.h*rect.height+rect.top,180);
 }
 assert.equal(pointerInFlightWorld({width:0,height:800},flightCamera(player,1200,800),0,0),null);
});

test('plus, minus and both numeric keypad buttons work without hijacking remapped keys',()=>{
 assert.equal(flightZoomKey('Equal'),1);
 assert.equal(flightZoomKey('Minus'),-1);
 assert.equal(flightZoomKey('NumpadAdd'),1);
 assert.equal(flightZoomKey('NumpadSubtract'),-1);
 assert.equal(flightZoomKey('Equal',{fire:'Equal'}),0);
 assert.equal(flightZoomKey('KeyW'),0);
 near(stepCameraZoom(stepCameraZoom(1,1),-1),1);
 assert.equal(stepCameraZoom(CAMERA_ZOOM.max,1),CAMERA_ZOOM.max);
 assert.equal(stepCameraZoom(CAMERA_ZOOM.min,-1),CAMERA_ZOOM.min);
});

test('Ctrl+wheel changes view gradually with bounded deltas; ordinary wheel still selects guns',()=>{
 assert.ok(wheelCameraZoom(1,120)<1);
 assert.ok(wheelCameraZoom(1,-120)>1);
 assert.ok(wheelCameraZoom(1,1,1)<1);
 assert.equal(wheelCameraZoom(1,0),1);
 assert.equal(wheelCameraZoom(1,Infinity),1);
 assert.equal(manualWheelDirection(0),0);
 assert.equal(manualWheelDirection(NaN),0);
 assert.equal(manualWheelDirection(.001),0);
 assert.equal(manualWheelDirection(120),1);
 assert.equal(manualWheelDirection(-120),-1);
 assert.equal(wheelCameraZoom(1,100000),wheelCameraZoom(1,180));
 const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(source,/if\(e\.ctrlKey\)\{\s*e\.preventDefault\(\);\s*this\.setCameraZoom\(wheelCameraZoom/);
 assert.match(source,/const direction=manualWheelDirection\(e\.deltaY\)/);
 assert.match(source,/if\(!direction\)return;\s*e\.preventDefault\(\);this\.switchManualWeapon\(direction\)/);
});

test('world text remains readable without magnifying the physical world',()=>{
 assert.equal(worldTextScale(1),1);
 assert.equal(worldTextScale(1.5),1);
 near(worldTextScale(.55)*.55,1);
 near(worldTextScale(.8)*.8,1);
 assert.equal(worldTextScale(NaN),1);
});

test('asteroid spatial lookup preserves obstacle avoidance at both camera extremes',()=>{
 const game=Object.create(ArcadeGame.prototype);
 game.time=17;game.zones=[];
 game.nearRocks=Array.from({length:420},(_,i)=>({
  x:Math.sin(i*2.73)*1800,y:Math.cos(i*3.31)*1400,
  r:5+(i*17)%46,alive:i%19!==0
 }));
 game.avoidanceRockGrid=new SpatialGrid(200);
 for(const rock of game.nearRocks)if(rock.alive)game.avoidanceRockGrid.insert(rock);
 const indexedGrid=game.avoidanceRockGrid;
 for(const zoom of [.55,1,1.5]){
  game.cameraZoom=zoom;
  for(let i=0;i<90;i++){
   const x=Math.sin(i*.77)*1100,y=Math.cos(i*.39)*850;
   const indexed=game.avoidance(x,y,12+i%25);
   game.avoidanceRockGrid=null;
   const fullScan=game.avoidance(x,y,12+i%25);
   near(indexed.x,fullScan.x);near(indexed.y,fullScan.y);
   game.avoidanceRockGrid=indexedGrid;
  }
 }
});

test('wide camera entries stay offscreen while screen-range hacking keeps its old bounds',()=>{
 const game=Object.create(ArcadeGame.prototype);
 game.player={x:1234,y:5678};game.vw=1200;game.vh=800;game.cameraZoom=.55;
 const visual=game.camera(),spawn=game.spawnCamera();
 assert.ok(visual.w>spawn.w&&visual.h>spawn.h);
 assert.equal(spawn.w,1200);
 assert.equal(spawn.h,800);
 const arrival=game.spawnEntryCamera();
 assert.deepEqual(arrival,visual);
 for(const side of [0,1,2,3]){
  const point=spawnOutside(arrival,side,.5,125);
  assert.ok(point.x<visual.x||point.x>visual.x+visual.w||
   point.y<visual.y||point.y>visual.y+visual.h);
 }
 game.cameraZoom=1.5;
 assert.deepEqual(game.spawnEntryCamera(),game.spawnCamera());
 game.cameraZoom=.55;
 assert.deepEqual(game.player, {x:1234,y:5678});
 const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(source,/const charge=this\.hacks\.shift\(\),cam=this\.spawnCamera\(\)/);
 assert.match(source,/const group=\+\+this\.groupSerial,cam=this\.spawnEntryCamera\(\)/);
 assert.match(source,/c\.scale\(this\.cameraZoom,this\.cameraZoom\)/);
});

test('trackpad zoom cannot force a full world and station query on every wheel event',()=>{
 const game=Object.create(ArcadeGame.prototype);
 const oldDocument=globalThis.document;
 const label={hidden:true,textContent:''};
 globalThis.document={getElementById:()=>label};
 try{
  game.cameraZoom=1;game.worldQueryClock=.17;
  assert.equal(game.setCameraZoom(.8),true);
  near(game.worldQueryClock,.09);
  near(game.cameraZoom,.8);
  near(Number.parseInt(label.textContent.match(/\d+/)[0],10),80);
  game.worldQueryClock=.04;
  game.setCameraZoom(.65);
  near(game.worldQueryClock,.04,'an already scheduled refresh may not be postponed');
  game.setCameraZoom(.9);
  near(game.worldQueryClock,.04,'zooming in does not require new outer rock cells');
  assert.equal(game.setCameraZoom(.9),false);
  game.setCameraZoom(1);
  assert.equal(label.hidden,true);
 }finally{globalThis.document=oldDocument;}
});
