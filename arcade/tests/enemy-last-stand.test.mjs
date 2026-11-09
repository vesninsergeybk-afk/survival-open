import test from 'node:test';
import assert from 'node:assert/strict';
import {LAST_STAND,armLastStand,updateLastStand,sweptRamHit} from '../enemy-last-stand.js';

const ship=(serial=3)=>({type:'fighter',serial,x:-230,y:0,vx:0,vy:0,
 r:14,hp:17,maxHp:58,state:'hunt'});
const scene=(enemy)=>({time:120,enemies:[enemy],player:{x:0,y:0,r:19,hp:90,invul:0},
 enemyCanSee:()=>true,heritage:{play(){},vfx:{shipExplosion(){}}},
 hurt(damage){this.damage=(this.damage||0)+damage;}});

test('critical hull triggers a limited, visible last stand without restoring health',()=>{
 const e=ship(),game=scene(e);
 assert.equal(armLastStand(e,game,37,true),true);
 assert.equal(e.hp,17);
 assert.equal(e._lastStand.chargeAt,120+LAST_STAND.windup);
 assert.equal(armLastStand(e,game,37,true),false);
 game.time=120.2;
 assert.equal(updateLastStand(e,game,.1),true);
 assert.equal(e.state,'last-stand-windup');
 assert.equal(e.hp,17);
 game.time=121;
 updateLastStand(e,game,.1);
 assert.equal(e.state,'last-stand-charge');
 assert.ok(e.vx>0);
 assert.equal(e.hp,17);
});

test('no magic charging from blind damage, special missions or crowded attack lanes',()=>{
 const e=ship(),game=scene(e);
 assert.equal(armLastStand(e,game,37,false),false);
 e.protect={hp:100};assert.equal(armLastStand(e,game,37,true),false);
 e.protect=null;e.serial=2;assert.equal(armLastStand(e,game,37,true),false);
 e.serial=3;game.time=20;assert.equal(armLastStand(e,game,37,true),false);
 game.time=120;
 game.enemies.push(...[6,9].map(serial=>({...ship(serial),_lastStand:{}})));
 assert.equal(armLastStand(e,game,37,true),false);
});

test('a critical ram never starts beyond the visible edge of the player camera',()=>{
 const e=ship(),game=scene(e);
 game.camera=()=>({x:-100,y:-100,w:200,h:200});
 assert.equal(armLastStand(e,game,37,true),false,
  'damage by long-range weapons must not arm an unseen unavoidable charge');
 assert.equal(e._lastStand,undefined);
});

test('high speed impact uses a swept hitbox; avoidance and destruction still work',()=>{
 assert.equal(sweptRamHit(-90,0,90,0,{x:0,y:0},25),true);
 assert.equal(sweptRamHit(-90,40,90,40,{x:0,y:0},25),false);
 const e=ship(),game=scene(e);armLastStand(e,game,37,true);
 game.time=121;e.x=-27;e.vx=430;
 updateLastStand(e,game,.15);
 assert.equal(e.hp,0);assert.equal(game.damage,LAST_STAND.damage);
 const other=ship(),dodge=scene(other);armLastStand(other,dodge,37,true);
 dodge.player.y=140;dodge.time=121;other.x=-27;other.vx=430;
 updateLastStand(other,dodge,.15);
 assert.ok(other.hp>0);assert.equal(dodge.damage,undefined);
 other.hp=0;
 assert.equal(updateLastStand(other,dodge,.1),false);
});

test('without another real sighting the chase expires instead of tracking through cover',()=>{
 const e=ship(),game=scene(e);armLastStand(e,game,37,true);
 game.enemyCanSee=()=>false;game.player.x=3000;
 game.time=122.6;
 assert.equal(updateLastStand(e,game,.05),false);
 assert.equal(e._lastStand,null);
 assert.equal(e.hp,17);
});

test('a suicidal fighter hits an asteroid before the pilot and does not play two explosions',()=>{
 const e=ship(),game=scene(e);let explosions=0;
 game.heritage.vfx.shipExplosion=()=>{explosions++;};
 game.rockGrid={query:()=>[{x:-92,y:0,r:36,hp:300,alive:true}]};
 assert.equal(armLastStand(e,game,37,true),true);
 game.time=121;e.x=-170;e.vx=465;
 updateLastStand(e,game,.38);
 assert.equal(e.hp,0,'solid cover must intercept a high-speed charge');
 assert.ok(e.x<-40,'the craft must stop at the rock rather than passing through it');
 assert.equal(game.damage,undefined,'the player remains safe on the far side of cover');
 assert.equal(explosions,0,'the normal death processor owns the only explosion');
});

test('a pilot hit before an asteroid still takes damage from the physical charge',()=>{
 const e=ship(),game=scene(e);
 game.rockGrid={query:()=>[{x:105,y:0,r:36,alive:true}]};
 assert.equal(armLastStand(e,game,37,true),true);
 game.time=121;e.x=-45;e.vx=520;
 updateLastStand(e,game,.52);
 assert.equal(e.hp,0);
 assert.equal(game.damage,LAST_STAND.damage,
  'cover behind the pilot must not erase a collision which happened first');
});

test('a charge cannot slip through a rock during its visible windup',()=>{
 const e=ship(),game=scene(e);
 game.rockGrid={query:()=>[{x:-105,y:0,r:36,alive:true}]};
 assert.equal(armLastStand(e,game,37,true),true);
 game.time=120.2;e.x=-190;e.vx=390;
 updateLastStand(e,game,.52);
 assert.ok(e.x<=-155,'the hull stops at the obstacle before charging');
 assert.ok(e.hp>0,'the windup itself does not explode the fighter');
});
