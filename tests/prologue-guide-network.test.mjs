/**
 * Mission 00 luminous guidance: walkable, connected and objective-driven.
 * Run: node --test site/games/survivor/tests/prologue-guide-network.test.mjs
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'src/prologue-mission.js'),'utf8')
 .replace(/^import[\s\S]*?from\s*['"][^'"]+['"];\s*$/gm,'')
 .replace(/\bexport (?=(class|function|const)\b)/g,'');
const World=new Function('ENEMIES','PrologueTactics',source+
 '\nreturn PrologueMissionWorld;')({SNIPER:{id:'sniper'}},class{constructor(){}});
const game={player:{x:0,y:0},gameTime:0,camera:{worldX:0,worldY:0},
 canvas:{width:980,height:650}};
const world=new World(game);
const done=id=>{world.device(id).done=true;};
const goal=()=>world._guideTarget(game);
const route=()=>world._guideRoute(game);

test('every inlaid circuit is connected, walkable and avoids solid cover',()=>{
 const {nodes,edges}=world.guideGraph;
 assert.equal(nodes.length,62);
 assert.equal(edges.length,61);
 const reached=new Set([0]),stack=[0];
 while(stack.length){
  const current=stack.pop();
  for(const link of nodes[current].links)if(!reached.has(link.to)){
   reached.add(link.to);stack.push(link.to);
  }
 }
 assert.equal(reached.size,nodes.length,'no chopped-off or disconnected wires');
 for(const edge of edges){
  const a=nodes[edge.a],b=nodes[edge.b];
  for(let t=0;t<=1;t+=.025){
   const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
   assert.ok(world.insideWorld(x,y,5),'strip must stay on station floor');
   assert.equal(world.solid(x,y,5),false,'strip must not cross cover');
  }
 }
});
test('light packets lead to each reachable active device and side room',()=>{
 for(const id of ['generator','dock-gate','sentry-a','sentry-b','helios',
  'weapon','coolant','relay-a','relay-b','terminal',
  'heavy-a','heavy-b','capacitor','transmitter']){
  const d=world.device(id);
  world.phase=d.phase;
  game.player.x=world.cx+(world.phase===0?0:
   world.phase===1?1050:world.phase===2?2300:
   world.phase===3?3410:world.phase===4?4820:
   world.phase===5?5980:7500);
  game.player.y=world.cy;
  world.guideRouteCache=null;
  const original=world._guideTarget;
  world._guideTarget=()=>d;
  const path=route();
  world._guideTarget=original;
  assert.ok(path.points.length>1,id+' should have a route');
  assert.deepEqual(
   [path.points.at(-1).x,path.points.at(-1).y],[d.x,d.y],
   id+' should finish at equipment, not in the middle of the room');
 }
});
test('objective cues retarget and do not prematurely lead to locked exits',()=>{
 world.phase=1;game.player.x=world.cx+1180;game.player.y=world.cy;
 assert.equal(goal().id,'sentry-a');
 done('sentry-a');assert.equal(goal().id,'sentry-b');
 done('sentry-b');assert.equal(goal().id,'helios');
 done('helios');assert.equal(goal().guideRole,'defend');
 world.securityClear=true;assert.equal(goal().id,1,'exit opens after security clear');
 world.phase=2;assert.equal(goal().id,'weapon');
 done('weapon');assert.equal(goal().id,'coolant');
 done('coolant');assert.equal(goal().guideRole,'defend');
 world.workshopClear=true;assert.equal(goal().id,2);
 world.phase=3;assert.equal(goal().id,'relay-a');
 done('relay-a');assert.equal(goal().id,'relay-b');
 done('relay-b');assert.equal(goal().guideRole,'defend');
 world.forgeClear=true;assert.equal(goal().id,3);
 world.phase=5;assert.equal(goal().id,'heavy-a');
 done('heavy-a');done('heavy-b');assert.equal(goal().id,'capacitor');
 done('capacitor');assert.equal(goal().guideRole,'defend');
 world.defenseClear=true;assert.equal(goal().id,5);
 world.phase=6;assert.equal(goal().id,'transmitter');
 done('transmitter');assert.equal(goal().guideRole,'hold');
});
test('animated guidance renders with bounded canvas calls and restores state',()=>{
 world.phase=5;game.player.x=world.cx+6650;game.player.y=world.cy-190;
 game.camera.worldX=game.player.x-480;game.camera.worldY=game.player.y-320;
 const calls={stroke:0,saves:0,restores:0,dashes:0};
 const ctx={save(){calls.saves++},restore(){calls.restores++},
  beginPath(){},moveTo(){},lineTo(){},stroke(){calls.stroke++},
  setLineDash(v){if(v.length)calls.dashes++},arc(){},fillRect(){},
  strokeRect(){},fillText(){},measureText(t){return {width:t.length*8}}};
 world._drawGuideNetwork(ctx,game,17.5);
 assert.equal(calls.saves,calls.restores);
 assert.ok(calls.stroke<15,'combine all visible edges in batched strokes');
 assert.equal(calls.dashes,1,'one moving light current, no duplicated frame overlays');
});
