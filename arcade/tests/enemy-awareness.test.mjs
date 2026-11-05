import test from 'node:test';
import assert from 'node:assert/strict';
import {updateEnemyAwareness,enemyPursuitTarget,ambientPatrolRoute,
 patrolCanLeave,unalertedPatrolRoute,ENEMY_AWARENESS}
  from '../enemy-awareness.js';
import {ENEMY_TYPES,updateEnemy} from '../ai.js';
import {openingThreat} from '../balance.js';
import {game as fixtureGame} from './weapons-scene.mjs';

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

test('ambient patrols cross authored traffic lanes and cannot know a moving pilot',()=>{
 const cam={x:1000,y:-650,w:1200,h:720};
 for(let side=0;side<4;side++){
  const destination=ambientPatrolRoute(cam,side,.45,3);
  assert.ok(destination&&Number.isFinite(destination.x)&&Number.isFinite(destination.y));
  assert.ok(side===0?destination.x>cam.x+cam.w:side===1?destination.x<cam.x:
   side===2?destination.y>cam.y+cam.h:destination.y<cam.y);
  const e={...enemy(),_patrolRoute:destination},g=game();
  assert.deepEqual({x:enemyPursuitTarget(e,g).x,y:enemyPursuitTarget(e,g).y},destination);
  g.player.x=50000;g.player.y=-50000;g.time=3;
  assert.deepEqual({x:enemyPursuitTarget(e,g).x,y:enemyPursuitTarget(e,g).y},destination,
   'unobserved patrols cannot acquire live player position after spawning');
 }
});

test('patrol exits only after crossing the screen without recent sight or radio pursuit',()=>{
 const g=game();g.camera=()=>({x:-500,y:-300,w:1000,h:600});g.time=12;
 const e={...enemy(),x:790,y:25,_patrolRoute:{x:810,y:25}};
 assert.equal(patrolCanLeave(e,g),true);
 e._awarenessLast={at:10,x:0,y:0};
 assert.equal(patrolCanLeave(e,g),false);
 g.time=18;g.enemyComms={directiveFor:()=>({intel:{x:100,y:10,at:17}})};
 assert.equal(patrolCanLeave(e,g),false);
 g.enemyComms={directiveFor:()=>null};
 assert.equal(patrolCanLeave(e,g),true);
 e.x=400;
 assert.equal(patrolCanLeave(e,g),false,'an enemy still on screen must not vanish');
});

test('real encounter spawner routes routine ships, but noise responders have a reported incident',()=>{
 const g=fixtureGame();g.time=100;g.vw=1200;g.vh=800;
 g.lastEncounterLabelAt=-100;
 const generated=g.spawnGroup(openingThreat(g.time,3));
 assert.ok(generated>=0&&g.enemies.length>0);
 assert.ok(g.enemies.every(e=>e._patrolRoute&&!e._awarenessDispatch),
  'normal encounters must never inherit the moving pilot position');
 const initial=g.enemies.length;
 g.spawnGroup({...openingThreat(g.time,3),cap:30}, {x:140,y:-35});
 const noise=g.enemies.slice(initial);
 assert.ok(noise.length>0&&noise.every(e=>e.signalIntel&&!e._patrolRoute),
  'real drilling noise still gives a specific, investigateable sector');
});

test('every routine ship type actually crosses the screen and leaves without granting XP',()=>{
 for(const type of Object.keys(ENEMY_TYPES)){
  const p={x:0,y:0,vx:0,vy:0,r:19,hp:5000,invul:100};
  const g={time:100,player:p,allies:[],enemies:[],missiles:[],shots:[],
   support:{missions:[]},grid:{query:()=>[]},camera:()=>({x:-500,y:-300,w:1000,h:600}),
   avoidance:()=>({x:0,y:0}),enemyCanSee:()=>false,enemyShot:()=>false,
   heritage:{play(){},vfx:{shipExplosion(){}}},hurt(){},
   enemyComms:{directiveFor:()=>null,strategicDirectiveFor:()=>null}};
  const e={serial:3,type,x:-700,y:80,vx:0,vy:0,r:14,
   hp:ENEMY_TYPES[type].hp,maxHp:ENEMY_TYPES[type].hp,
   damage:ENEMY_TYPES[type].dmg,think:0,fire:5,
   state:'hunt',target:p,commitUntil:0,
   _patrolRoute:{x:810,y:80}};
  g.enemies=[e];
  assert.equal(unalertedPatrolRoute(e,g,e._radio,null),e._patrolRoute);
  for(let frame=0;frame<1800;frame++){
   g.time+=1/60;updateEnemy(e,g,1/60);
   if(patrolCanLeave(e,g))break;
  }
  assert.equal(patrolCanLeave(e,g),true,
   `${type} should complete its lane rather than orbit in combat formation`);
  assert.equal(e.expAwarded,undefined,'a peaceful departure is not a kill');
 }
});

test('a protected wingman and a ship with delivered intelligence do not abandon their mission',()=>{
 const g=game();g.time=20;
 const e={...enemy(),_patrolRoute:{x:800,y:0}};
 e.protect={hp:50,x:250,y:10};
 assert.equal(unalertedPatrolRoute(e,g),null);
 e.protect=null;
 assert.equal(unalertedPatrolRoute(e,g,{intel:{x:10,y:0,at:20}}),null);
 assert.equal(unalertedPatrolRoute(e,g,null,{role:'escort'}),null);
 assert.equal(unalertedPatrolRoute(e,g),e._patrolRoute);
});

test('an unseen rail hit makes a pilot investigate the coarse impact bearing, not track the gunner',()=>{
 const g=fixtureGame(),e={serial:3,type:'fighter',x:560,y:0,vx:0,vy:0,
  hp:58,maxHp:58,r:14,_patrolRoute:{x:900,y:50}};
 g.time=50;g.player.x=0;g.player.y=0;g.enemyCanSee=()=>false;
 const contact={directed:true,nx:-1,ny:0,x:546,y:0};
 g.damageEnemy(e,12,'rail',contact);
 assert.ok(e._awarenessImpact,'local damage is remembered as an approximate sector');
 assert.equal(unalertedPatrolRoute(e,g),null,'the victim must react to an attack');
 const target=enemyPursuitTarget(e,g);
 assert.ok(Math.abs(target.x-0)>50,'the estimate is not the hidden player coordinate');
 assert.notEqual(target,g.player);
 g.player.x=1300;g.player.y=780;g.time=51;
 const stale=enemyPursuitTarget(e,g);
 assert.equal(stale.x,target.x,'an impact cannot continually track the moving attacker');
 g.time=55;
 assert.equal(enemyPursuitTarget(e,g).x,e._patrolRoute.x);
 assert.equal(unalertedPatrolRoute(e,g),e._patrolRoute);
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
