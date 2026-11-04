import test from 'node:test';
import assert from 'node:assert/strict';
import {scoutSteering,updateEnemy} from '../ai.js';

function simulation(type='scout',serial=1){
  const player={x:0,y:0,r:19,hp:1000,invul:100};
  const game={time:0,player,allies:[],missiles:[],shots:[],
    grid:{query:()=>[]},support:{missions:[]},
    avoidance:()=>({x:0,y:0}),heritage:{play(){},vfx:{shipExplosion(){}}},
    hurt(){throw Error('unexpected player collision');}};
  const e={type,serial,x:420,y:0,vx:0,vy:0,r:14,hp:100,maxHp:100,
    damage:9,think:10,fire:10,state:'hunt',target:player};
  return {game,e};
}
function advance(game,e,seconds,dt=1/60){
  const steps=Math.round(seconds/dt);
  for(let i=0;i<steps;i++){game.time+=dt;updateEnemy(e,game,dt);}
}

test('scouts use alternating lateral passes, fighters make slower broad sweeps',()=>{
  const scout=simulation('scout',1),fighter=simulation('fighter',1);
  const scout2=simulation('scout',3);
  advance(scout.game,scout.e,1);
  advance(fighter.game,fighter.e,1);
  advance(scout2.game,scout2.e,1);
  assert.ok(Math.abs(scout.e.y)>8,'a scout must visibly leave the direct line');
  assert.ok(Math.abs(scout.e.y)>Math.abs(fighter.e.y)*1.3,
    'a nimble scout should sidestep more than a heavier fighter');
  assert.notEqual(scout.e.y,scout2.e.y,'scouts do not fly in synchronized rows');
  assert.ok(scout.e.x<420&&fighter.e.x<420,'both still approach the player');
});

test('a hit triggers one readable dash and then a cooldown, without immunity',()=>{
  const {game,e}=simulation();
  game.time=.2;e.hit=.12;
  updateEnemy(e,game,1/60);
  assert.equal(e._scoutDodgeStarted,.2);
  assert.ok(e._scoutDodgeUntil>game.time);
  const cooldown=e._scoutDodgeCooldown;
  e.hit=0;
  advance(game,e,1);
  e.hit=.12;
  updateEnemy(e,game,1/60);
  assert.equal(e._scoutDodgeStarted,.2,'subsequent hits do not spam dashes');
  assert.equal(e._scoutDodgeCooldown,cooldown);
  assert.equal(e.hp,100,'evasion does not change health or hit rules');
});

test('a nearby player missile is treated as a threat, not hostile projectiles',()=>{
  const {game,e}=simulation();
  game.time=.5;
  game.shots.push({x:e.x-10,y:e.y,target:e,life:1});
  assert.ok(!e._scoutDodgeUntil);
  updateEnemy(e,game,1/60);
  assert.ok(!e._scoutDodgeUntil,'enemy shots cannot trigger scout evasion');
  game.missiles.push({x:e.x-90,y:e.y,target:e,life:2});
  game.time=.55;
  updateEnemy(e,game,1/60);
  assert.equal(e._scoutDodgeStarted,.55);
});

test('scouts remain stable in a 200-drone simulation',()=>{
  const {game}=simulation();
  const drones=Array.from({length:200},(_,i)=>({
    type:'scout',serial:i+1,x:350+i%20*12,y:-600+Math.floor(i/20)*120,
    vx:0,vy:0,r:14,hp:100,maxHp:100,damage:9,think:10,fire:5,
    state:'hunt',target:game.player
  }));
  for(let frame=0;frame<90;frame++){
    game.time+=1/60;
    for(const drone of drones)updateEnemy(drone,game,1/60);
  }
  for(const e of drones){
    assert.ok(Number.isFinite(e.x)&&Number.isFinite(e.y));
    assert.ok(Math.hypot(e.vx,e.vy)<300,'velocity stays bounded');
  }
});

test('the steering signal is finite even at the target point',()=>{
  const {game,e}=simulation();
  e.x=game.player.x;e.y=game.player.y;
  const extra=scoutSteering(e,game,game.player,158);
  assert.ok(Number.isFinite(extra.x)&&Number.isFinite(extra.y));
});
