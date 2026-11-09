import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../world.js';
import {FRONTIER,orderFrontierNetwork,advanceFrontierNetwork,
 frontierBarrierContact,frontierBuoysNear,damageFrontierBuoy,
 activeFrontierSegments} from '../enemy-frontier-network.js';
import {SALVAGE,ruinEnemyIndustry,salvageQuote,claimRuinedIndustry} from '../enemy-station-salvage.js';
import {drawPopulationWorld} from '../population-runtime.js';
import {drawIndustrialMiner} from '../enemy-frontier-render.js';
import {MUSIC_TRACKS,MUSIC_POOLS} from '../music-playlist.js';

const gameWorld=()=>new World(20261109);
test('fortresses and mature settlements begin with physical powered defense fences',()=>{
 const w=gameWorld(),fortresses=w.population.colonies.filter(c=>c.fortress);
 assert.equal(fortresses.length,4);
 for(const c of fortresses){
  assert.equal(c.fronts.length,1);
  assert.equal(c.fronts[0].nodes.length,FRONTIER.count);
  assert.equal(activeFrontierSegments(w,c,FRONTIER.radius+1500).filter(s=>s.colony===c).length,6);
 }
});

test('the alarm builds an anti-player front on the exposed vector and pays from finite warehouse stock',()=>{
 const w=gameWorld(),c=w.population.colonies.find(c=>c.tier===1&&c.fronts.length===0);
 const field={x:c.x+4300,y:c.y+200},original=c.pool;
 const front=orderFrontierNetwork(w,c,field,100);
 assert.ok(front);
 assert.equal(front.nodes.filter(n=>n.hp>0).length,0);
 assert.ok(front.x>c.x+1700);
 assert.equal(orderFrontierNetwork(w,c,field,101),null,'same vector must not create duplicate walls');
 assert.equal(advanceFrontierNetwork(w,c,106).length,0);
 assert.equal(advanceFrontierNetwork(w,c,107).length,1);
 assert.equal(c.pool,original-FRONTIER.nodeCost);
 assert.equal(front.nodes.filter(n=>n.hp>0).length,1);
 c.pool=0;
 assert.equal(advanceFrontierNetwork(w,c,150).length,0,'construction waits for actual industrial resources');
});

test('energy link is a true obstacle for fast ships; destroyed middle buoy opens a passage',()=>{
 const w=gameWorld(),c=w.population.colonies.find(c=>c.fortress);
 const front=c.fronts[0],a=front.nodes[2],b=front.nodes[3];
 const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
 const dx=b.x-a.x,dy=b.y-a.y,mag=Math.hypot(dx,dy);
 const nx=-dy/mag,ny=dx/mag;
 const before={x:mx+nx*400,y:my+ny*400},after={x:mx-nx*400,y:my-ny*400};
 assert.ok(frontierBarrierContact(w,after,before).impact,'dashing 800 units must not tunnel');
 assert.ok(frontierBuoysNear(w,b.x,b.y,60).includes(b));
 const hit=damageFrontierBuoy(w,b,FRONTIER.nodeHp,100);
 assert.ok(hit.destroyed);assert.equal(b.hp,0);
 assert.equal(frontierBuoysNear(w,b.x,b.y,20).includes(b),false);
 assert.ok(!activeFrontierSegments(w,c,FRONTIER.radius+1500).some(s=>s.a===b||s.b===b));
 assert.equal(advanceFrontierNetwork(w,c,100+FRONTIER.repairSeconds-1).length,0);
 c.pool=FRONTIER.nodeCost;
 assert.equal(advanceFrontierNetwork(w,c,100+FRONTIER.repairSeconds).length,1);
 assert.equal(c.pool,0);
});

test('an offscreen wall extension is never mistaken for a collision',()=>{
 const w=gameWorld(),c=w.population.colonies.find(c=>c.fortress);
 const a=c.fronts[0].nodes[0],b=c.fronts[0].nodes[1];
 const dx=b.x-a.x,dy=b.y-a.y,mag=Math.hypot(dx,dy);
 const beyond={x:a.x-dx/mag*650,y:a.y-dy/mag*650};
 const normal={x:-dy/mag,y:dx/mag};
 const before={x:beyond.x+normal.x*310,y:beyond.y+normal.y*310};
 const after={x:beyond.x-normal.x*310,y:beyond.y-normal.y*310};
 assert.equal(frontierBarrierContact(w,after,before).impact,null);
});

test('a powered frontier is painted even when colony center is outside the viewport',()=>{
 const w=gameWorld(),colony=w.population.colonies.find(c=>c.id==='colony:amethyst:44');
 const buoy=colony.fronts[0].nodes.reduce((best,n)=>
  Math.max(Math.abs(n.x-colony.x),Math.abs(n.y-colony.y))>
   Math.max(Math.abs(best.x-colony.x),Math.abs(best.y-colony.y))?n:best);
 const cam={x:buoy.x-180,y:buoy.y-180,w:360,h:360};
 assert.ok(colony.x<cam.x-1900||colony.x>cam.x+cam.w+1900||
  colony.y<cam.y-1900||colony.y>cam.y+cam.h+1900);
 const strokes=[];
 const c={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},arc(){},rect(){},
  closePath(){},fill(){},stroke(){strokes.push(this.strokeStyle)},translate(){},rotate(){},
  fillText(){},fillRect(){},setLineDash(){},createRadialGradient(){return {addColorStop(){}}}};
 drawPopulationWorld({world:w,time:10,fps:60,visuals:{reducedMotion:true},cameraZoom:1},c,cam);
 assert.ok(strokes.includes('#e07bff'),'active energy core should still be drawn');
});

test('real miner sprite follows the tangential direction of its smooth orbital path',()=>{
 let heading=null;
 const ctx={save(){},restore(){},translate(){},rotate(a){heading=a},
  beginPath(){},moveTo(){},lineTo(){},arc(){},closePath(){},fill(){},stroke(){},
  createRadialGradient(){return {addColorStop(){}}}};
 const miner={x:100,y:200,slot:0,hit:0};
 drawIndustrialMiner(ctx,miner,2,{x:100,y:100});
 assert.ok(Math.abs(heading-(Math.PI/2+Math.PI))<1e-8);
});

test('destroying the relay safely drops the field and prevents repairs until industry recovers',()=>{
 const w=gameWorld(),c=w.population.colonies.find(c=>c.fortress),b=c.fronts[0].nodes[0];
 damageFrontierBuoy(w,b,FRONTIER.nodeHp,100);
 const relay=w.stations.get(c.id+':relay');relay.enemy=false;
 assert.equal(activeFrontierSegments(w,c,FRONTIER.radius+1500).length,0);
 assert.equal(advanceFrontierNetwork(w,c,100+FRONTIER.repairSeconds+60).length,0);
});

test('ruined enemy industry is neutral, not a free active station or a free new triangle',()=>{
 const w=gameWorld(),c=w.population.colonies.find(c=>c.tier===1),base=w.stations.get(c.id+':factory');
 const p={x:base.x,y:base.y,ore:22};
 assert.ok(ruinEnemyIndustry(base,30));
 assert.equal(base.hp,0);assert.equal(base.active,false);
 assert.equal(base.enemy,false);assert.equal(base.captured,false);assert.equal(base.ruined,true);
 assert.ok(salvageQuote(w,p,base).ok);
 assert.equal(salvageQuote(w,{...p,ore:0},base).ok,false);
 const price=salvageQuote(w,p,base).cost;
 const outcome=claimRuinedIndustry(w,p,base,55);
 assert.ok(outcome.ok);assert.equal(p.ore,22-price);
 assert.equal(base.captured,true);assert.equal(base.active,true);
 assert.equal(base.hp,Math.round(base.maxHp*.3));
 assert.equal(base.ruined,false);
});

test('taking higher tier ruins requires friendly industrial support; repairing is never free',()=>{
 const w=gameWorld(),c=w.population.colonies.find(c=>c.tier>=3),base=w.stations.get(c.id+':factory');
 const p={x:base.x,y:base.y,ore:99};
 ruinEnemyIndustry(base,20);
 assert.match(salvageQuote(w,p,base).reason,/контур/);
 const ally=w.stations.get(c.id+':support');ally.enemy=false;ally.active=true;
 assert.ok(salvageQuote(w,p,base).ok);
 p.x+=SALVAGE.range+1;
 assert.equal(salvageQuote(w,p,base).ok,false);
});

test('the real flight loop requires a separate hold action before rewarding an enemy station',()=>{
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(game,/ruinEnemyIndustry\(base,this\.time\)/);
 assert.match(game,/kind:'ruin-claim'/);
 assert.match(game,/claimRuinedIndustry\(this\.world,p,base,this\.time\)/);
 assert.match(game,/finishEnemyBaseCapture\(base,true,firstUnlocks\)/);
 assert.match(game,/const firstUnlocks=\{precision:base\.type==='arsenal'/);
 assert.match(game,/if\(this\.actionHeld\?\.kind==='ruin-claim'\)/);
});

test('actual transparent sprites and all licensed tracks exist, with wider music rotation',()=>{
 for(const filename of ['defense-buoy-v1.webp','ore-miner-v1.webp']){
  const bytes=readFileSync(new URL('../assets/enemy-frontier/'+filename,import.meta.url));
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.ok(bytes.length>5000&&bytes.length<250000);
 }
 assert.ok(MUSIC_POOLS.tension.length>=4);
 assert.ok(MUSIC_POOLS.combat.length>=4);
 assert.ok(MUSIC_POOLS.boss.length>=4);
 for(const ids of Object.values(MUSIC_POOLS))for(const id of ids)
  assert.ok(MUSIC_TRACKS[id]?.file,'every rotation entry must be a credited recording');
});
