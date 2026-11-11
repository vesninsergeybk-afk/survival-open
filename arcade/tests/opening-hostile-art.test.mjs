import test from 'node:test';
import assert from 'node:assert/strict';
import {openingHostileRole,drawOpeningHostile} from '../opening-hostile-art.js';

test('both opening missions have deliberate hostile ship silhouettes, while the tug keeps its own art',()=>{
 const leader={openingCommander:true,hp:100,type:'fighter'};
 const escort={scenario:'opening-escort',missionStructure:true,hp:38,type:'scout'};
 const sentry={openingRescueRole:'guard',hp:38,type:'scout'};
 const recovery={openingRescueRole:'escort',hp:38,type:'scout'};
 const pursuer={openingRescueRole:'pursuer',hp:58,type:'fighter'};
 assert.equal(openingHostileRole(leader),'commander');
 assert.equal(openingHostileRole(escort),'wing');
 assert.equal(openingHostileRole(sentry),'sentry');
 assert.equal(openingHostileRole(recovery),'wing');
 assert.equal(openingHostileRole(pursuer),'hunter');
 assert.equal(openingHostileRole({openingRescueRole:'tug',hp:95}),null);
 assert.equal(openingHostileRole({...escort,missionStructure:false}),null,
  'after the opening contract, survivors return to ordinary visuals');
 assert.equal(openingHostileRole({...sentry,hp:0}),null);
 assert.equal(openingHostileRole({...sentry,converted:true}),null);
});

test('mission ship paint is a complete, self-contained canvas silhouette without atlas dependencies',()=>{
 const calls=[],ctx={};
 for(const name of ['save','restore','translate','rotate','scale','beginPath',
  'moveTo','lineTo','closePath','fill','stroke','arc'])
  ctx[name]=(...args)=>calls.push({name,args});
 const ship={openingRescueRole:'guard',type:'fighter',hp:58,r:18,
  x:50,y:-80,vx:84,vy:0,angle:Math.PI/2,_gunAiming:{}};
 assert.equal(drawOpeningHostile(ctx,ship,20),true);
 assert.equal(calls.filter(c=>c.name==='save').length,
  calls.filter(c=>c.name==='restore').length);
 assert.ok(calls.some(c=>c.name==='scale'));
 assert.ok(calls.filter(c=>c.name==='lineTo').length>12);
 assert.ok(calls.some(c=>c.name==='arc'));
 calls.length=0;
 assert.equal(drawOpeningHostile(ctx,{openingRescueRole:'tug',hp:95},20),false);
 assert.equal(calls.length,0);
});
