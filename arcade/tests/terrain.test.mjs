import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {SpatialGrid} from '../balance.js';
import {amberBeltDensity,inAmberCorridor,nearAmberBelt,firstRockImpact} from '../terrain.js';

test('amber belt has two dense flanks and an open, navigable corridor',()=>{
 assert.ok(nearAmberBelt(7200,1450));
 assert.ok(inAmberCorridor(7200,1450));
 assert.equal(amberBeltDensity(7200,1450),0);
 assert.ok(amberBeltDensity(7200,1900)>.9);
 assert.ok(amberBeltDensity(7200,1000)>.9);
 assert.equal(amberBeltDensity(0,0),0);
 const world=new World();
 let beltRocks=0;
 for(let cy=0;cy<=7;cy++)for(let cx=12;cx<=19;cx++)
  for(const rock of world.rockCell(cx,cy)){
   assert.equal(inAmberCorridor(rock.x,rock.y),false,'rock blocks corridor');
   if(amberBeltDensity(rock.x,rock.y)>.25)beltRocks++;
  }
 assert.ok(beltRocks>=12,'belt contains enough tactical obstacles');
 const second=new World();
 assert.deepEqual(world.rockCell(16,3),second.rockCell(16,3));
});

test('large rock intercepts a hostile shot even during a long frame',()=>{
 const rock={x:50,y:0,r:40,alive:true};
 const hit=firstRockImpact(0,0,100,0,[rock],6);
 assert.equal(hit?.rock,rock);
 assert.ok(hit.x>0&&hit.x<50);
 assert.equal(firstRockImpact(0,90,100,90,[rock],6),null);
 assert.equal(firstRockImpact(0,0,100,0,[{...rock,r:25}],6),null);
 assert.equal(firstRockImpact(0,0,100,0,[{...rock,alive:false}],6),null);
});

test('earliest impact wins, overlap with player does not grant stone immunity',()=>{
 const rocks=[{x:80,y:0,r:35,alive:true},{x:40,y:0,r:36,alive:true}];
 const first=firstRockImpact(0,0,120,0,rocks,6);
 assert.equal(first?.rock,rocks[1]);
 assert.equal(firstRockImpact(0,0,120,0,[rocks[1]],6,{x:40,y:0,r:19}),null);
 assert.equal(firstRockImpact(-100,0,-100,0,[rocks[1]],6),null);
});

test('spatial cover lookup agrees with brute force on long projectile motion',()=>{
 const grid=new SpatialGrid(140);
 const rocks=[];
 for(let i=0;i<70;i++){
  const rock={x:-210+i*17,y:(i%9-4)*45,r:34+i%20,alive:true};
  rocks.push(rock);grid.insert(rock);
 }
 for(let y=-150;y<=150;y+=50){
  const x0=-350,x1=350;
  const candidates=grid.query((x0+x1)/2,y,65+Math.abs(x1-x0)/2);
  const direct=firstRockImpact(x0,y,x1,y,rocks,6);
  const reduced=firstRockImpact(x0,y,x1,y,candidates,6);
  assert.equal(reduced?.rock??null,direct?.rock??null);
 }
});
