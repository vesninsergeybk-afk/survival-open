import test from 'node:test';
import assert from 'node:assert/strict';
import {drawOrbitalWarning,drawOrbitalAfterglow,drawEnergyFlash,drawSeekingMissile,drawHullDamage} from '../combat-feedback.js';

function context(){
 const calls=[],ctx={calls};
 for(const name of ['save','restore','beginPath','arc','fill','stroke',
  'moveTo','lineTo','fillText','translate','rotate','fillRect','closePath'])
  ctx[name]=(...args)=>calls.push([name,...args]);
 return ctx;
}

test('orbital marker matches physical strike radius and true remaining time',()=>{
 const ctx=context(),zone={x:12,y:15,r:64,fuse:1.2,fuseStart:2.4};
 drawOrbitalWarning(ctx,zone,3,true);
 const circles=ctx.calls.filter(call=>call[0]==='arc');
 assert.equal(circles[0][3],64);
 assert.equal(circles[1][3],64);
 assert.equal(circles[2][3],64);
 assert.ok(Math.abs(circles[2][5]-(-Math.PI/2+Math.PI))<1e-9);
 assert.ok(ctx.calls.some(c=>c[0]==='fillText'&&c[1]==='1.2 с'));
 assert.equal(zone.fuse,1.2,'render never alters game fuse');
});

test('a thrown charge has a distinct device icon and an explicit escape timer',()=>{
 const ctx=context();
 drawOrbitalWarning(ctx,{kind:'displacement-mine',x:12,y:15,r:215,
  fuse:2.05,fuseStart:2.05},3,true);
 assert.ok(ctx.calls.some(c=>c[0]==='fillText'&&c[1]==='МИНА · 2.0 с'));
 assert.ok(ctx.calls.some(c=>c[0]==='closePath'),
  'the charge icon must remain visible without colour or animation');
});

test('low-fps beams use a single stroke; high-fps beams add two layers',()=>{
 const flash={x:0,y:0,x2:80,y2:5,ttl:.08,color:'#87eeff'};
 const slow=context(),fast=context();
 drawEnergyFlash(slow,flash,20);
 drawEnergyFlash(fast,flash,60);
 assert.equal(slow.calls.filter(c=>c[0]==='stroke').length,1);
 assert.equal(fast.calls.filter(c=>c[0]==='stroke').length,3);
 const gone=context();drawEnergyFlash(gone,{...flash,ttl:0},60);
 assert.equal(gone.calls.length,0);
});

test('homing missile trail uses retained points and handles zero trail',()=>{
 const m={x:20,y:40,tx:200,ty:45,trail:[{x:0,y:38},{x:9,y:39}]};
 const ctx=context();drawSeekingMissile(ctx,m,60);
 assert.ok(ctx.calls.filter(c=>c[0]==='stroke').length>=2);
 assert.ok(ctx.calls.some(c=>c[0]==='translate'&&c[1]===20));
 assert.doesNotThrow(()=>drawSeekingMissile(context(),{...m,trail:[]},24));
 const boosted=context();drawSeekingMissile(boosted,{...m,fxRank:4},60);
 assert.ok(boosted.calls.filter(c=>c[0]==='stroke').length>
  ctx.calls.filter(c=>c[0]==='stroke').length,'upgraded missile changes its in-flight art');
});

test('hull scarring follows actual health, not shield or unrelated state',()=>{
 const intact=context();
 assert.equal(drawHullDamage(intact,{x:4,y:8,r:18,hp:80,maxHp:100,serial:2}),false);
 assert.equal(intact.calls.length,0);
 const chipped=context(),broken=context();
 assert.equal(drawHullDamage(chipped,{x:4,y:8,r:18,hp:60,maxHp:100,serial:2},2,60),true);
 assert.equal(drawHullDamage(broken,{x:4,y:8,r:18,hp:18,maxHp:100,serial:2},2,60),true);
 assert.equal(chipped.calls.filter(c=>c[0]==='arc').length,1);
 assert.ok(broken.calls.filter(c=>c[0]==='arc').length>=3);
 assert.equal(drawHullDamage(context(),{x:4,y:8,r:18,hp:0,maxHp:100}),false);
});

test('reduced-motion and low-fps hull feedback never adds flickering embers',()=>{
 const damaged={x:0,y:0,r:21,hp:32,maxHp:100,serial:7};
 const slow=context(),reduced=context(),fast=context();
 drawHullDamage(slow,damaged,1,22,false);
 drawHullDamage(reduced,damaged,1,60,true);
 drawHullDamage(fast,damaged,1,60,false);
 assert.equal(slow.calls.filter(c=>c[0]==='arc').length,2);
 assert.equal(reduced.calls.filter(c=>c[0]==='arc').length,2);
 assert.equal(fast.calls.filter(c=>c[0]==='arc').length,3);
});


test('orbital afterglow retains the strike ring without creating gradients each frame',()=>{
 const zone={x:100,y:130,r:60,ttl:.31};
 const ctx=context();
 ctx.createRadialGradient=()=>{throw Error('per-frame gradient allocation');};
 drawOrbitalAfterglow(ctx,zone);
 assert.ok(ctx.calls.some(call=>call[0]==='arc'));
 const radius=ctx.calls.find(call=>call[0]==='arc')[3];
 assert.ok(radius>zone.r*.45&&radius<zone.r*1.75);
 const expired=context();
 drawOrbitalAfterglow(expired,{...zone,ttl:0});
 assert.equal(expired.calls.length,0);
});
