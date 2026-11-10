import test from 'node:test';
import assert from 'node:assert/strict';
import {ESCORTS,escortCapacity,escortHireOffer,escortTrainingOffer,
 createEscort,escortRetirementRefund} from '../escort-squad.js';
import {updateAlly} from '../ai.js';
import {renderBasePanel} from '../base-panel.js';
import {game as testGame} from './weapons-scene.mjs';

const station=type=>({id:'station',type,active:true,enemy:false,ruined:false});
const options=(overrides={})=>({ore:200,allies:0,connectedBases:4,
 network:{armor:0,engine:0,armament:0},...overrides});

test('five distinct escort models have the same non-replacement price at every station',()=>{
 assert.deepEqual(Object.keys(ESCORTS),['scout','fighter','brawler','rocket','medic']);
 for(const role of Object.keys(ESCORTS)){
  const quotes=['dock','lab','arsenal','carrier'].map(type=>
   escortHireOffer(station(type),options(),role));
  assert.ok(quotes.every(quote=>quote.ok&&quote.price===ESCORTS[role].cost));
 }
 assert.equal(escortCapacity(5),5);
 assert.equal(escortCapacity(12),6);
 assert.match(escortHireOffer(station('dock'),options({allies:4}), 'rocket').reason,/4\/4/);
 assert.equal(escortRetirementRefund(createEscort('fighter',3,0,0)),16);
});

test('drones tab shows roster, five models and durable squad research',()=>{
 const g=testGame();g.baseTab='drones';g.player.ore=300;
 const html=renderBasePanel(g.docked,g.baseState());
 for(const role of Object.keys(ESCORTS))
  assert.match(html,new RegExp('data-act="hireDrone" data-role="'+role+'"'));
 for(const key of ['armor','engine','armament'])
  assert.match(html,new RegExp('data-act="trainEscort" data-role="'+key+'"'));
 assert.match(html,/Пять специализаций · единые цены/);
 assert.equal(escortTrainingOffer(station('dock'),options(),'engine').price,36);
 assert.equal(escortTrainingOffer(station('dock'),options({network:{engine:2}}),'engine').price,92);
 assert.equal(escortTrainingOffer(station('dock'),options({network:{engine:6}}),'engine').ok,false);
});

function battle(role,target={x:30,y:0,r:14,hp:300,type:'fighter',converted:false}){
 const drone=createEscort(role,1,0,40,1);
 drone.think=0;drone.fire=0;
 const hits=[];
 const g={time:20,player:{x:0,y:0,r:19,shield:0},allies:[drone],
  network:{armor:0,armament:0,engine:0},skillRanks:{tactics:0,shield:0},
  holdFire:false,mining:{active:false},doctrine:null,
  nearbyEnemyBase:()=>null,grid:{query:()=>[target]},
  avoidance:()=>({x:0,y:0}),shotsNear:()=>[],
  missiles:[],lastDamageAt:-Infinity,
  damageEnemy:(enemy,damage,source)=>{enemy.hp-=damage;hits.push({enemy,damage,source});},
  flash:()=>{},heritage:{play:()=>{}}};
 return {g,drone,target,hits};
}

test('brawler makes a distinct short-range strike but will not hit beyond reach',()=>{
 const near=battle('brawler',{x:20,y:18,r:14,hp:300,type:'fighter'});
 updateAlly(near.drone,near.g,.08);
 assert.equal(near.hits.length,1);
 assert.equal(near.hits[0].source,near.drone);
 assert.ok(near.hits[0].damage>=35);
 assert.ok(near.drone.retreatUntil-near.g.time>1.7,
  'rammer must withdraw until nearly reloaded');
 const distant=battle('brawler');updateAlly(distant.drone,distant.g,.08);
 assert.equal(distant.hits.length,0,'52-unit melee reach must not bypass hull contact');
 const far=battle('brawler',{x:180,y:0,r:14,hp:300,type:'fighter'});
 updateAlly(far.drone,far.g,.08);
 assert.equal(far.hits.length,0,'contact strike cannot hit a distant target');
});

test('guard slows charging enemies while blade deals additional kinetic damage to capitals',()=>{
 const guard=battle('scout',{x:70,y:0,r:14,hp:300,type:'berserker',converted:false});
 updateAlly(guard.drone,guard.g,.08);
 assert.equal(guard.hits.length,1);
 assert.equal(guard.target.tacticalSlowFactor,.82);
 assert.ok(guard.target.tacticalSlowUntil>guard.g.time);
 const blade=battle('fighter',{x:70,y:0,r:22,hp:500,type:'gunship',converted:false});
 updateAlly(blade.drone,blade.g,.08);
 assert.equal(blade.hits.length,1);
 assert.ok(blade.hits[0].damage>ESCORTS.fighter.damage);
 assert.equal(blade.target.tacticalSlowUntil,undefined);
});

test('ramming drone takes reduced collision damage during a strike and retreats afterward',()=>{
 const g=testGame(),a=createEscort('brawler',1,0,40,0);
 g.time=20;g.allies=[a];
 a.guardUntil=20.62;a.retreatUntil=21.03;
 const start=a.hp;
 g.hitAlly(a,24,'contact');
 assert.ok(a.hp>start-15,'screen dampens an impact but never grants invulnerability');
 const beforeShot=a.hp;
 g.hitAlly(a,24,'projectile');
 assert.ok(a.hp<=beforeShot-23.9,'contact shield must not protect against bullets');
 g.time=22;const afterScreen=a.hp;
 g.hitAlly(a,24,'contact');
 assert.ok(a.hp<=afterScreen-23.9,'outside a strike the same impact hits normally');
});

test('targeting skill reduces commitment to an obsolete escort target',()=>{
 const baseline=battle('fighter'),trained=battle('fighter');
 trained.g.skillRanks.wingTargeting=3;
 updateAlly(baseline.drone,baseline.g,.08);
 updateAlly(trained.drone,trained.g,.08);
 assert.ok(trained.drone.commitUntil<trained.g.time+1.3);
 assert.ok(baseline.drone.commitUntil-trained.drone.commitUntil>.5);
});

test('rocket escort launches a physical homing projectile with splash instead of instant damage',()=>{
 const {g,drone,target,hits}=battle('rocket',{x:250,y:0,r:14,hp:300,type:'fighter'});
 updateAlly(drone,g,.08);
 assert.equal(hits.length,0);
 assert.equal(g.missiles.length,1);
 assert.equal(g.missiles[0].escortSource,drone);
 assert.equal(g.missiles[0].target,target);
 assert.ok(g.missiles[0].splashRadius>0);
});

test('medic repairs the most damaged nearby escort and only then recharges shield in quiet',()=>{
 const {g,drone}=battle('medic',{x:900,y:900,r:14,hp:300,type:'fighter'});
 const wounded=createEscort('fighter',2,20,40,1),healthy=createEscort('scout',3,10,60,1);
 wounded.hp=20;healthy.hp=healthy.maxHp-3;
 g.allies=[drone,wounded,healthy];
 updateAlly(drone,g,.08);
 assert.ok(wounded.hp>20);
 assert.equal(healthy.hp,healthy.maxHp-3);
 assert.equal(g.player.shield,0);
 wounded.hp=wounded.maxHp;healthy.hp=healthy.maxHp;
 drone.serviceAt=g.time;
 updateAlly(drone,g,.08);
 assert.equal(g.player.shield,4);
 g.lastDamageAt=g.time;drone.serviceAt=g.time;
 updateAlly(drone,g,.08);
 assert.equal(g.player.shield,4,'a medic cannot replenish pilot shield during incoming fire');
});

test('more than two escorts retain distinct formation positions',()=>{
 const {g,drone}=battle('scout',{x:900,y:900,r:14,hp:300,type:'fighter'});
 g.allies=[drone,...Array.from({length:4},(_,i)=>createEscort('fighter',i+2,0,40,1))];
 for(const ally of g.allies)updateAlly(ally,g,.04);
 const locations=g.allies.map(ally=>[ally.x.toFixed(2),ally.y.toFixed(2)].join(':'));
 assert.equal(new Set(locations).size,5);
});

test('escort armor also works against collisions and storms, with mitigation applied once',()=>{
 const g=testGame(),ally=createEscort('brawler',1,0,0,g.time);
 g.network.armor=3;g.hitAlly(ally,20);
 assert.ok(Math.abs(ally.hp-(ESCORTS.brawler.maxHp-20*(1-3*.07)))<1e-8);
});
