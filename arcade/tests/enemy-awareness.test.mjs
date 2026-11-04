import test from 'node:test';
import assert from 'node:assert/strict';
import {updateEnemyAwareness,enemyPursuitTarget,ENEMY_AWARENESS}
  from '../enemy-awareness.js';

const enemy=()=>({x:100,y:0,serial:0,vx:0,vy:0});
const game=()=>({time:0,player:{x:0,y:0,vx:150,vy:0},
  enemyCanSee:()=>false});

test('without visual contact, enemies never acquire exact live player coordinates',()=>{
  const e=enemy(),g=game();
  updateEnemyAwareness(e,g);
  assert.notEqual(enemyPursuitTarget(e,g),g.player);
  const first=enemyPursuitTarget(e,g);
  g.player.x=960;g.player.y=-700;g.time=1;
  updateEnemyAwareness(e,g);
  const second=enemyPursuitTarget(e,g);
  assert.ok(Math.hypot(second.x-g.player.x,second.y-g.player.y)>500);
  assert.equal(first.remembered,true);
});

test('a real sighting is remembered briefly, then the search does not track the player',()=>{
  const e=enemy(),g=game();let visible=true,sightReports=0;
  g.enemyCanSee=()=>visible;
  g.enemyComms={reportSight(){sightReports++;}};
  updateEnemyAwareness(e,g);
  assert.equal(enemyPursuitTarget(e,g),g.player);
  visible=false;g.time=.7;g.player.x=800;g.player.y=800;
  updateEnemyAwareness(e,g);
  assert.equal(enemyPursuitTarget(e,g).remembered,true);
  assert.ok(enemyPursuitTarget(e,g).x<70);
  assert.equal(sightReports,1);
  g.time=ENEMY_AWARENESS.personalMemory+1;
  updateEnemyAwareness(e,g);
  assert.notEqual(enemyPursuitTarget(e,g),g.player);
});

test('a received radio report guides pursuit, but expires before remote omniscience',()=>{
  const e=enemy(),g=game();
  g.enemyComms={directiveFor(ship,now){return now<2.6?{
    intel:{x:450,y:12,vx:120,vy:0,at:0}}:null;}};
  updateEnemyAwareness(e,g);
  let aim=enemyPursuitTarget(e,g);
  assert.equal(aim.x,450);
  g.time=1;aim=enemyPursuitTarget(e,g);
  assert.ok(aim.x>450&&aim.x<=476);
  g.time=3.2;
  assert.notEqual(enemyPursuitTarget(e,g).x,aim.x);
});

test('sensor checks are staggered across 200 pilots',()=>{
 const ships=Array.from({length:200},(_,i)=>({...enemy(),serial:i+1}));
 const g=game();let rays=0;g.enemyCanSee=()=>{rays++;return true;};
 for(const e of ships)updateEnemyAwareness(e,g);
 assert.ok(rays<=33);
 g.time=.31;
 for(const e of ships)updateEnemyAwareness(e,g);
 assert.equal(rays,200);
});
