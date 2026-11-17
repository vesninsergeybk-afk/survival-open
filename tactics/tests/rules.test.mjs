import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FIELD,MISSIONS,createMission,resolveTurn,nextMission,aliveAllies,aliveEnemies,canRelay,tacticalCapacity,inside} from '../rules.js';
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

test('a mission station cannot be destroyed into an unwinnable objective',()=>{
 let s=createMission(1,1842);const relay=s.stations[0];
 s.ships=[];s.player.x=relay.x-70;s.player.y=relay.y;
 for(let i=0;i<8;i++)s=resolveTurn(s,hold(s,relay.id,'shot'));
 assert.ok(s.stations[0].hp>=1);
 assert.equal(s.phase,'planning');
 for(let i=0;i<3;i++)s=resolveTurn(s,hold(s,relay.id,'hack'));
 assert.equal(s.phase,'won');
});

test('captured relay bandwidth persists with the allied squad into the final mission',()=>{
 const s=createMission(1,1842);
 s.stations[0].side='ally';s.phase='won';
 s.ships=s.ships.slice(0,3).map((u,i)=>({...u,side:'ally',id:'carry-'+i}));
 assert.equal(tacticalCapacity(s),4);
 const final=nextMission(s);
 assert.equal(final.mission,2);
 assert.equal(final.networkSlots,2);
 assert.equal(tacticalCapacity(final),4);
 assert.equal(aliveAllies(final).length,3);
});

test('all three missions have an achievable hacking-first route under live enemy fire',()=>{
 let state=createMission(0,1729);
 for(let mission=0;mission<MISSIONS.length;mission++){
  for(let k=0;k<24&&state.phase==='planning';k++){
   const target=mission===0?
    aliveEnemies(state).sort((a,b)=>Math.hypot(a.x-state.player.x,a.y-state.player.y)-
      Math.hypot(b.x-state.player.x,b.y-state.player.y))[0]:
    state.stations[0];
   assert.ok(target,'there must be an accessible objective');
   const dx=state.player.x-target.x,dy=state.player.y-target.y;
   const distance=Math.hypot(dx,dy)||1;
   const destination=distance>140?
    {x:target.x+dx/distance*105,y:target.y+dy/distance*105}:
    {x:state.player.x,y:state.player.y};
   state=resolveTurn(state,{targetId:target.id,action:'hack',destination});
  }
  assert.equal(state.phase,'won','mission '+(mission+1)+' must be winnable with the basic controls');
  if(mission<MISSIONS.length-1)state=nextMission(state);
 }
});
