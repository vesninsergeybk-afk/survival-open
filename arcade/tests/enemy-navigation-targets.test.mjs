import test from 'node:test';
import assert from 'node:assert/strict';
import {hitFriendlyShip} from '../enemy-shot-targets.js';
import {enemyRockDetour} from '../enemy-navigation.js';
import {scoutAttack,updateEnemy} from '../ai.js';
import {ArcadeGame} from './runtime-game.mjs';

test('a scout patrol can attack a directly visible allied drone, without player sight',()=>{
  const ally={x:0,y:0,r:15,hp:78,role:'fighter',vx:0,vy:0};
  const enemy={x:180,y:0,vx:0,vy:0,r:14,serial:3,type:'scout',
    hp:28,maxHp:28,damage:9,think:0,fire:0,state:'hunt',commitUntil:0};
  const fired=[];
  const game={time:1,player:{x:1200,y:900,r:19,hp:120,invul:999},
    allies:[ally],enemies:[enemy],missiles:[],shots:[],
    grid:{query:()=>[]},avoidance:()=>({x:0,y:0}),
    enemyCanSee:(_e,t)=>t===ally,
    enemyShot:(x,y,tx,ty,damage)=>{fired.push({tx,ty,damage});return true;},
    heritage:{play(){},vfx:{shipExplosion(){}}},hurt(){}};
  for(let i=0;i<420;i++){
    game.time+=1/60;updateEnemy(enemy,game,1/60);
  }
  assert.ok(fired.length>0,'the scout must not become harmless against an escort');
  assert.ok(fired.some(s=>Math.hypot(s.tx-ally.x,s.ty-ally.y)<55),
    'scout fire is directed at the drone rather than the hidden player');
});

test('a fighter can select a visible stocked flux warehouse as a destructible supply target',()=>{
 const depot={kind:'flux-depot',id:1,x:120,y:0,r:38,hp:100,stored:5,readyAt:0};
 const e={x:180,y:0,vx:0,vy:0,r:16,serial:4,type:'fighter',
  hp:58,maxHp:58,damage:12,think:0,fire:20,state:'hunt',commitUntil:0};
 const game={time:5,player:{x:1100,y:1000,r:19,hp:100},
  allies:[],enemies:[e],missiles:[],shots:[],
  world:{contours:{artillery:[],supportTurrets:[],fluxDepots:[depot]}},
  grid:{query:()=>[]},avoidance:()=>({x:0,y:0}),
  enemyCanSee:(_e,t)=>t===depot,
  enemyShot:()=>true,heritage:{play(){},vfx:{shipExplosion(){}}},hurt(){}};
 updateEnemy(e,game,.016);
 assert.equal(e.target,depot);
 depot.stored=0;e.think=0;game.time+=1;
 updateEnemy(e,game,.016);
 assert.equal(e.target,game.player,'an empty store should not lure combat ships');
});

test('a scout changing targets must start a new visible charge',()=>{
  const player={x:0,y:0,r:19,hp:100},ally={x:40,y:0,r:13,hp:50};
  const e={type:'scout',x:180,y:0,serial:1,hp:28,fire:0};
  let shots=0;
  const game={time:1,player,enemyCanSee:()=>true,
    enemyShot:()=>{shots++;return true;}};
  scoutAttack(e,game,player);
  game.time=1.3;
  scoutAttack(e,game,ally);
  assert.equal(shots,0);
  assert.equal(e._irisChargeStarted,1.3);
  game.time=1.68;
  assert.equal(scoutAttack(e,game,ally),true);
  assert.equal(shots,1);
});

test('hostile bolts hit hired drones, respect armor and cannot damage two ships',()=>{
  const ally={x:0,y:0,r:15,hp:78,hit:0};
  const craft={x:0,y:0,r:14,hp:50,hit:0};
  const impacts=[];
  const game={support:{missions:[{craft:[craft]}]},allies:[ally],
    network:{armor:2},heritage:{vfx:{shipExplosion(){},
      hullImpact:(...args)=>impacts.push(args)}},
    hitAlly:ArcadeGame.prototype.hitAlly,time:1};
  const first={x:0,y:0,r:4.5,damage:10,alive:true};
  assert.equal(hitFriendlyShip(game,first),true);
  assert.equal(first.alive,false);
  assert.equal(craft.hp,40);
  assert.equal(ally.hp,78,'one bolt cannot hit two ships');
  const next={...first,alive:true};craft.x=150;
  assert.equal(hitFriendlyShip(game,next),true);
  assert.equal(ally.hp,78-10*(1-2*.07));
  assert.equal(hitFriendlyShip(game,next),false,'consumed bolt never hits twice');
  assert.ok(impacts.length>=2);
});

test('rock detour is local, finite and does not reveal the hidden player',()=>{
  const e={x:-350,y:0,r:14,serial:2},rock={x:0,y:0,r:110,alive:true};
  const game={nearRocks:[rock],rockGrid:{query:()=>[rock]}};
  assert.deepEqual(enemyRockDetour(e,game,-420,0),{x:0,y:0});
  const bend=enemyRockDetour(e,game,350,0);
  assert.ok(bend.y>.8&&Math.abs(bend.x)<.001);
});

test('200 moving pilots reuse local obstacle queries between simulation ticks',()=>{
  let queries=0;
  const rock={x:0,y:0,r:95,alive:true};
  const game={time:1,rockGrid:{query(){queries++;return [rock];}}};
  const pilots=Array.from({length:200},(_,i)=>({
    x:-240-i*.05,y:0,r:14,serial:i,vx:0,vy:0}));
  for(let tick=0;tick<120;tick++){
    game.time+=1/60;
    for(const e of pilots)enemyRockDetour(e,game,360,0);
  }
  assert.ok(queries<5500,`unnecessarily repeated ${queries} rock queries`);
});

test('an unalerted fighter can fly around a large asteroid to a known patrol exit',()=>{
  const e={x:-365,y:0,vx:0,vy:0,r:14,serial:2,type:'fighter',
    hp:58,maxHp:58,damage:12,think:0,fire:4,state:'hunt',commitUntil:0,
    _patrolRoute:{x:380,y:0}};
  const rock={x:0,y:0,r:110,alive:true};
  const game={time:100,player:{x:1400,y:1400,r:19,hp:100,invul:999},
    zones:[],nearRocks:[rock],rockGrid:{query:()=>[rock]},
    allies:[],enemies:[e],missiles:[],shots:[],
    grid:{query:()=>[]},enemyCanSee:()=>false,enemyShot:()=>false,
    avoidance:ArcadeGame.prototype.avoidance,
    heritage:{play(){},vfx:{shipExplosion(){}}},hurt(){}};
  let minimumSeparation=Infinity;
  for(let i=0;i<2400;i++){
    game.time+=1/60;updateEnemy(e,game,1/60);
    minimumSeparation=Math.min(minimumSeparation,
      Math.hypot(e.x-rock.x,e.y-rock.y));
    if(e.x>310)break;
  }
  assert.ok(e.x>310,`pilot remained stuck at ${e.x.toFixed(1)}, ${e.y.toFixed(1)}`);
  assert.ok(minimumSeparation>rock.r+e.r-5,
    `pilot clipped the rock at separation ${minimumSeparation.toFixed(1)}`);
});

test('siege fighters actually close on the fixed triangle core without knowing player position',()=>{
 const e={x:-780,y:0,vx:0,vy:0,r:14,serial:24,type:'fighter',
  hp:58,maxHp:58,damage:12,think:0,fire:5,state:'hunt',commitUntil:0,
  trialId:9,trialObjective:{x:0,y:0}};
 const game={time:100,player:{x:3400,y:2400,r:19,hp:100,invul:999},
  contourTrial:{entry:{id:9}},zones:[],nearRocks:[],
  rockGrid:{query:()=>[]},allies:[],enemies:[e],missiles:[],shots:[],
  grid:{query:()=>[]},enemyCanSee:()=>false,enemyShot:()=>false,
  avoidance:()=>({x:0,y:0}),
  heritage:{play(){},vfx:{shipExplosion(){}}},hurt(){}};
 for(let i=0;i<720;i++){game.time+=1/60;updateEnemy(e,game,1/60);}
 assert.ok(Math.hypot(e.x,e.y)<230,
  `a siege fleet must reach its visible objective, not circle the entry point: ${e.x.toFixed(0)}`);
 assert.ok(Math.hypot(e.x-game.player.x,e.y-game.player.y)>3000,
  'the AI must not magically pursue a pilot whom nobody has spotted');
});
