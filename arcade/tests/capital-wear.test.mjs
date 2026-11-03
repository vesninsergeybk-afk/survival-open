import test from 'node:test';
import assert from 'node:assert/strict';
import {CAPITAL_WEAR_ANCHORS,capitalWearStage,createCapitalWearFrame,drawCapitalWearVent,drawCapitalWearTrail,drawCapitalWearTrailTextured} from '../capital-wear.js';

test('capital damage stage matches current HP thresholds without changing HP',()=>{
 const values=[100,68,67,43,42,22,21,1,0,-1,NaN];
 const expected=[0,0,1,1,2,2,3,3,0,0,0];
 const original=values.slice();
 for(let i=0;i<values.length;i++)
  assert.equal(capitalWearStage(values[i],100),expected[i],String(values[i]));
 assert.deepEqual(values,original);
 assert.equal(capitalWearStage(40,0),0);
});

test('all three distinct capital types define three bounded wear anchors',()=>{
 assert.deepEqual(Object.keys(CAPITAL_WEAR_ANCHORS).sort(),
  ['carrier','cruiser','dreadnought']);
 for(const [name,points] of Object.entries(CAPITAL_WEAR_ANCHORS)){
  assert.equal(points.length,3,name);
  for(const [x,y,angle] of points){
   assert.ok(x>50&&x<462&&y>50&&y<718,name);
   assert.ok(Number.isFinite(angle),name);
  }
 }
});

test('preview compositor refuses unavailable DOM or malformed art',()=>{
 assert.equal(createCapitalWearFrame(null,'cruiser',1),null);
 assert.equal(createCapitalWearFrame({width:512,height:768},'unknown',1),null);
 assert.equal(createCapitalWearFrame({width:512,height:768},'cruiser',1,'unknown'),null);
});

test('bounded vent preview yields no work for malformed calls and fixed socket counts',()=>{
 assert.equal(drawCapitalWearVent(null,'cruiser',2,40,60,0),0);
 assert.equal(drawCapitalWearVent({},'invalid',2,40,60,0),0);
 const events=[];
 const c={save(){events.push('save')},restore(){events.push('restore')},
  beginPath(){},arc(){},fill(){}};
 assert.equal(drawCapitalWearVent(c,'carrier',1,40,60,0,true),1);
 assert.equal(drawCapitalWearVent(c,'carrier',2,40,60,1,true),2);
 assert.equal(drawCapitalWearVent(c,'carrier',3,40,60,2,true),2);
 assert.equal(events.filter(x=>x==='save').length,3);
 assert.equal(events.filter(x=>x==='restore').length,3);
});

test('v4 smoke refuses invalid input and avoids canvas allocation without a browser',()=>{
 assert.equal(drawCapitalWearTrail(null,'carrier',2,40,60,0),0);
 assert.equal(drawCapitalWearTrail({},'invalid',2,40,60,0),0);
 assert.equal(drawCapitalWearTrail({},'carrier',1,40,60,Number.NaN),0);
 assert.equal(drawCapitalWearTrail({},'carrier',3,40,60,1),0);
});

test('texture experiment refuses malformed calls and stays safe in Node',()=>{
 assert.equal(drawCapitalWearTrailTextured(null,'carrier',2,40,60,0),0);
 assert.equal(drawCapitalWearTrailTextured({},'invalid',2,40,60,0),0);
 assert.equal(drawCapitalWearTrailTextured({},'carrier',3,40,60,1),0);
});
