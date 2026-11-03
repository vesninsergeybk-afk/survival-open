import test from 'node:test';
import assert from 'node:assert/strict';
import {
 capitalDamageTier,capitalContactAnchor,recordCapitalHit,drawCapitalDamage
} from '../capital-hit-wear.js';

function ship(angle=0){
 return {type:'gunship',serial:6,x:100,y:150,r:22,angle,
  hp:150,maxHp:150};
}
const from=(x,y)=>({x,y,directed:true});

test('damage tiers depend solely on health ratio and reject malformed data',()=>{
 assert.equal(capitalDamageTier(100,100),0);
 assert.equal(capitalDamageTier(93,100),0);
 assert.equal(capitalDamageTier(92,100),1);
 assert.equal(capitalDamageTier(55,100),1);
 assert.equal(capitalDamageTier(54,100),2);
 assert.equal(capitalDamageTier(28,100),2);
 assert.equal(capitalDamageTier(27,100),3);
 assert.equal(capitalDamageTier(NaN,100),0);
 assert.equal(capitalDamageTier(50,0),0);
});

test('directed world contacts rotate to bounded ship-local surface anchors',()=>{
 const normal=capitalContactAnchor(ship(0),from(122,150));
 assert.ok(normal.u>.70&&normal.v===.5);
 const rotated=capitalContactAnchor(ship(Math.PI/2),from(122,150));
 assert.ok(Math.abs(rotated.u-.5)<1e-8);
 assert.ok(rotated.v<.3);
 const other=capitalContactAnchor(ship(0),from(100,128));
 assert.ok(other.u===.5&&other.v<.3);
 for(const a of [0,Math.PI/4,Math.PI,Math.PI*1.5]){
  const point=capitalContactAnchor(ship(a),from(128,185));
  assert.ok(point.u>=.265&&point.u<=.735&&point.v>=.275&&point.v<=.725);
 }
 assert.equal(capitalContactAnchor(ship(0),null),null);
 assert.equal(capitalContactAnchor(ship(0),{x:150,y:150,directed:false}),null);
 assert.equal(capitalContactAnchor(ship(0),from(100,150)),null);
 assert.equal(capitalContactAnchor(ship(0),from(NaN,150)),null);
});

test('continuous beam coalesces; fresh impacts are bounded and preserve HP',()=>{
 const s=ship(0),contact=from(122,150);
 assert.ok(recordCapitalHit(s,contact,1));
 assert.equal(s.capitalDamageSites.length,1);
 const first=s.capitalDamageSites[0];
 for(let n=0;n<100;n++)assert.ok(recordCapitalHit(s,contact,1+n*.1));
 assert.equal(s.capitalDamageSites.length,1);
 assert.strictEqual(s.capitalDamageSites[0],first);
 assert.equal(s.capitalDamageVersion,1);
 assert.equal(s.hp,150);
 for(let i=0;i<16;i++){
  const theta=i*Math.PI/8;
  recordCapitalHit(s,from(100+22*Math.cos(theta),150+22*Math.sin(theta)),12+i);
 }
 assert.ok(s.capitalDamageSites.length<=4);
 assert.ok(s.capitalDamageVersion<=4);
 assert.equal(s.hp,150);
 assert.equal(s.maxHp,150);
 assert.equal(s.capitalDamageFlash.time,27);
});

test('unknown attacks and lethal strikes never invent a directed wound',()=>{
 const s=ship();
 assert.equal(recordCapitalHit(s,null,1),false);
 assert.equal(recordCapitalHit(s,from(122,150),NaN),false);
 assert.equal(s.capitalDamageSites,undefined);
 s.hp=0;
 assert.equal(recordCapitalHit(s,from(122,150),1),false);
 assert.equal(s.capitalDamageSites,undefined);
});

test('raster compositor fails safely outside browser or on bad dimensions',()=>{
 const s=ship();
 assert.equal(drawCapitalDamage({},s,'cruiser',{},56,84,3),false);
 assert.equal(drawCapitalDamage({},s,'cruiser',{},0,84,3),false);
});
