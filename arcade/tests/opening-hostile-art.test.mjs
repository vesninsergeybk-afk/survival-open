import test from 'node:test';
import assert from 'node:assert/strict';
import {openingHostileRole,drawOpeningHostile} from '../opening-hostile-art.js';
import {usesRegularEnemyShipArt} from '../../src/disruptor-ship-sprites.js';

test('ordinary guards and commanders use the normal enemy fleet art',()=>{
 const leader={openingCommander:true,hp:100,type:'fighter'};
 const escort={scenario:'opening-escort',missionStructure:true,hp:50,type:'flanker'};
 const sentry={openingRescueRole:'guard',hp:58,type:'fighter'};
 const recovery={openingRescueRole:'escort',hp:38,type:'scout'};
 const pursuer={openingRescueRole:'pursuer',hp:58,type:'fighter'};
 for(const ordinary of [leader,escort,sentry,recovery,pursuer]){
  assert.equal(openingHostileRole(ordinary),null);
  assert.equal(usesRegularEnemyShipArt(ordinary),true);
 }
 assert.equal(usesRegularEnemyShipArt({openingRescueRole:'tug',hp:95}),false);
 assert.equal(usesRegularEnemyShipArt({missionStructure:true,scenario:'other'}),false,
  'unrelated scripted objective art must not change');
 const triangle={openingBlueTriangle:true,hp:26,type:'scout'};
 assert.equal(openingHostileRole(triangle),'blue-triangle');
 assert.equal(openingHostileRole({...triangle,hp:0}),null);
 assert.equal(openingHostileRole({...triangle,converted:true}),null);
 assert.equal(openingHostileRole({...triangle,openingBlueTriangle:false}),null);
});

test('blue triangular interceptors have a real, self-contained drawing',()=>{
 const calls=[],ctx={};
 for(const name of ['save','restore','translate','rotate','scale','beginPath',
  'moveTo','lineTo','closePath','fill','stroke','arc'])
  ctx[name]=(...args)=>calls.push({name,args});
 const ship={openingBlueTriangle:true,type:'scout',hp:26,r:12,
  x:50,y:-80,vx:84,vy:0,angle:Math.PI/2,fire:-1,_irisChargeStarted:19.8};
 assert.equal(drawOpeningHostile(ctx,ship,20),true);
 assert.equal(calls.filter(c=>c.name==='save').length,
  calls.filter(c=>c.name==='restore').length);
 assert.ok(calls.filter(c=>c.name==='lineTo').length>=9);
 assert.ok(calls.some(c=>c.name==='arc'));
 calls.length=0;
 assert.equal(drawOpeningHostile(ctx,{openingCommander:true,hp:100},20),false);
 assert.equal(calls.length,0);
});
