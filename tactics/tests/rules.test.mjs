import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FIELD,MISSIONS,createMission,resolveTurn,nextMission,aliveAllies,canRelay,tacticalCapacity,inside} from '../rules.js';
const hold=(s,targetId,action='hack')=>({targetId,action,destination:{x:s.player.x,y:s.player.y}});
test('three finite missions remain bounded and independently generated',()=>{
 assert.equal(MISSIONS.length,3);
 for(let i=0;i<MISSIONS.length;i++){
  const s=createMission(i,1842);assert.equal(s.phase,'planning');
  assert.ok(s.ships.length>=4);assert.ok(s.ships.every(inside));
  assert.ok(s.stations.every(inside));assert.ok(s.asteroids.every(inside));
  assert.deepEqual(createMission(i,1842),s);
 }
});
test('two consecutive turns can permanently convert a living scout',()=>{
 let s=createMission(0,1842);const target=s.ships.find(x=>x.role==='scout');
 s.player.x=target.x-70;s.player.y=target.y;
 s.ships=s.ships.filter(x=>x===target||x.role==='fighter');
 s=resolveTurn(s,hold(s,target.id));
 assert.equal(s.phase,'planning');assert.equal(s.ships[0].side,'enemy');
 s=resolveTurn(s,hold(s,target.id));
 assert.equal(s.ships[0].side,'ally');assert.equal(aliveAllies(s).length,1);
 assert.ok(s.events.some(x=>x.kind==='captured'));
});
test('hacking can use one friendly ship as signal relay',()=>{
 const s=createMission(0,1842);const target=s.ships[0];
 s.player.x=target.x-380;s.player.y=target.y;
 s.ships.push({id:'test-ally',role:'scout',side:'ally',x:target.x-90,y:target.y,hp:30,maxHp:40,hack:0});
 assert.equal(canRelay(s,target).ok,true);
 s.ships.at(-1).x=target.x-500;
 assert.equal(canRelay(s,target).ok,false);
});
test('a full squad suppresses a hacked enemy without creating surplus permanent allies',()=>{
 let s=createMission(0,1842);const target=s.ships[0];
 s.player.x=target.x-80;s.player.y=target.y;
 target.hack=1;
 s.ships=[target,...['scout','fighter'].map((role,i)=>({id:'friend-'+i,role,side:'ally',x:target.x-90,y:target.y+40+i*20,hp:50,maxHp:60,hack:0}))];
 assert.equal(tacticalCapacity(s),2);
 s=resolveTurn(s,hold(s,target.id));
 assert.equal(aliveAllies(s).length,2);
 assert.equal(s.ships.find(x=>x.id===target.id).side,'enemy');
 assert.ok(s.events.some(x=>x.kind==='overload'));
});
test('manual fire and enemy counterfire resolve in the same simultaneous turn',()=>{
 let s=createMission(0,1842);const target=s.ships.find(x=>x.role==='scout');
 s.player.x=target.x-80;s.player.y=target.y;
 s.ships=[target];target.hp=15;
 const hp=s.player.hp;s=resolveTurn(s,hold(s,target.id,'shot'));
 assert.equal(s.ships.some(x=>x.id===target.id),false);
 assert.ok(s.player.hp<hp,'a doomed foe should still be able to fire this turn');
});
test('mission victory transfers surviving captured allies into the next sector',()=>{
 let s=createMission(0,1842);
 s.ships=s.ships.slice(0,2).map((x,i)=>({...x,side:'ally',id:'saved-'+i}));
 s=resolveTurn(s,{destination:{x:s.player.x,y:s.player.y}});
 assert.equal(s.phase,'won');
 const next=nextMission(s);
 assert.equal(next.mission,1);assert.equal(aliveAllies(next).length,2);assert.equal(next.phase,'planning');
 assert.ok(next.player.hp>=s.player.hp);
});
test('station capture changes tactical capacity and completes its mission',()=>{
 let s=createMission(1,1842);const relay=s.stations[0];
 s.ships=[];s.player.x=relay.x-100;s.player.y=relay.y;
 for(let i=0;i<3;i++)s=resolveTurn(s,hold(s,relay.id));
 assert.equal(s.phase,'won');
 assert.equal(s.stations[0].side,'ally');assert.equal(tacticalCapacity(s),4);
});
test('mission shell exposes separate controls and retains the original arcade link',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 for(const id of ['field','order-hack','order-shot','execute','next','replay','help-dialog'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/href="\.\.\/arcade\/"/);
});
