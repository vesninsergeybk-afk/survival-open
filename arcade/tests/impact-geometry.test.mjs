import {RuntimeHarness} from './runtime-game.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contactOnCircle,contactAtPoint} from '../impact-geometry.js';
import {drawExtraction} from '../mining.js';
import {firstRockImpact} from '../terrain.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('surface contact projects toward the shooter and returns a unit normal',()=>{
 const west=contactOnCircle(100,80,20,0,80);
 assert.deepEqual(west,{x:80,y:80,nx:-1,ny:0,directed:true});
 const diagonal=contactOnCircle(0,0,10,10,10);
 near(diagonal.x,Math.SQRT1_2*10);
 near(diagonal.y,Math.SQRT1_2*10);
 near(Math.hypot(diagonal.nx,diagonal.ny),1);
});

test('ambiguous source retains a neutral center cue; malformed targets are rejected',()=>{
 assert.deepEqual(contactOnCircle(5,7,15,5,7),
  {x:5,y:7,nx:0,ny:0,directed:false});
 assert.deepEqual(contactOnCircle(5,7,15,undefined,8),
  {x:5,y:7,nx:0,ny:0,directed:false});
 assert.deepEqual(contactOnCircle(5,7,-9,15,7),
  {x:5,y:7,nx:1,ny:0,directed:true});
 assert.equal(contactOnCircle(NaN,7,10,0,0),null);
});

test('a genuine segment intersection remains at that exact point',()=>{
 const hit=contactAtPoint(100,100,118,124);
 assert.equal(hit.x,118);
 assert.equal(hit.y,124);
 near(Math.hypot(hit.nx,hit.ny),1);
 assert.deepEqual(contactAtPoint(0,0,0,0),
  {x:0,y:0,nx:0,ny:0,directed:false});
});

test('extraction beam finishes at the rock surface, without final jitter',()=>{
 const paths=[];let current=[];
 const ctx={
  save(){},restore(){},beginPath(){current=[];paths.push(current);},
  moveTo(x,y){current.push([x,y]);},lineTo(x,y){current.push([x,y]);},
  arc(){},stroke(){},fillText(){}
 };
 drawExtraction(ctx,{x:0,y:0},{x:100,y:0,r:20,hp:15,maxHp:30,alive:true},.5,1,true);
 const beams=paths.filter(p=>p.length===7);
 assert.equal(beams.length,2,'both plasma layers are tracked');
 for(const p of beams){near(p[0][0],0);near(p[6][0],80);near(p[6][1],0);}
});

const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
function method(name,next,...deps){
 const from=source.indexOf('\n '+name),to=source.indexOf('\n '+next,from+1);
 assert.ok(from>=0&&to>from,`${name} should be extractable from real game source`);
 return RuntimeHarness;
}

test('damage events do not change balance while contacting the enemy hull',()=>{
 const C=method("damageEnemy(e,damage,source='other',contact=null){","flash(");
 const recorded=[];
 const game={time:1,overchargeUntil:0,heritage:{
  vfx:{hullImpact:(...args)=>recorded.push(args)},play(){}}
 };
 const target={x:100,y:0,r:20,hp:80,hit:0};
 const pt=contactOnCircle(target.x,target.y,target.r,0,0);
 C.prototype.damageEnemy.call(game,target,12,'beam',pt);
 assert.equal(target.hp,68);
 assert.equal(recorded.length,1);
 assert.equal(recorded[0][0],80);
 assert.equal(recorded[0][1],0);
 assert.equal(recorded[0][3],pt);
});

test('rock hit graphics use the segment contact but preserve its damage path',()=>{
 const C=method("damageRock(rock,damage,sourceX,sourceY,kind='auto',showImpact=true,contact=null){","addDrop(");
 const recorded=[];
 const game={heritage:{
  vfx:{asteroidImpact:(...args)=>recorded.push(args)},play(){}}
 };
 const rock={alive:true,x:100,y:0,r:30,rich:false};
 const point=contactAtPoint(100,0,70,0);
 C.prototype.damageRock.call(game,rock,10,0,0,'auto',true,point);
 assert.equal(recorded.length,1);
 assert.deepEqual(recorded[0].slice(0,3),[70,0,30]);
 assert.equal(recorded[0][4],point);
 assert.equal(rock.alive,true);
});

test('shield ring stays centered while damage contact faces the real source',()=>{
 const C=method("hurt(damage,source=null,options={}){","die()");
 const recorded=[];
 const game={time:1,nearDockField:false,nearArsenalDefense:false,
  player:{x:100,y:100,r:19,hp:110,maxHp:110,shield:25,invul:0,vx:0,vy:0,angle:0},
  skillRanks:{dodge:0},heritage:{
   vfx:{arcadePlayerHurt:(...args)=>recorded.push(args)},play(){}
  },cockpit:{impact(){}}
 };
 C.prototype.hurt.call(game,10,{x:0,y:100});
 assert.equal(game.player.hp,108.5);
 assert.equal(game.player.shield,16.5);
 assert.deepEqual(recorded[0].slice(0,4),[100,100,true,true]);
 const point=recorded[0][4];
 near(point.x,81);near(point.y,100);
 assert.equal(point.nx,-1);
});

test('homing missile retains the approach direction when arriving at target center',()=>{
 const C=method("updateMissiles(dt){","hitAlly(");
 const enemy={x:100,y:0,r:20,hp:80,converted:false};
 const impacts=[],blasts=[],sound=[];
 const game={
  rockGrid:{query:()=>[]},player:{x:0,y:0,r:19},
  missiles:[{x:0,y:0,tx:100,ty:0,target:enemy,damage:27,speed:200,life:2}],
  damageEnemy:(e,d,kind,contact)=>impacts.push({e,d,kind,contact}),
  heritage:{vfx:{rocketImpact:(...args)=>blasts.push(args) },
    play:(...args)=>sound.push(args)}
 };
 C.prototype.updateMissiles.call(game,.5);
 assert.equal(impacts.length,1);
 assert.equal(impacts[0].d,27);
 assert.equal(impacts[0].kind,'rocket');
 near(impacts[0].contact.x,80);
 near(impacts[0].contact.y,0);
 assert.deepEqual(blasts[0].slice(0,2),[80,0],
  'rocket blast and hull damage share a surface point');
 assert.deepEqual(sound,[['rocketImpact',.2,{x:80,y:0}]],
   'detonation sound must share the hull contact point');
  assert.equal(game.missiles.length,0);
});
