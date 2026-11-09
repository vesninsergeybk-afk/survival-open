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
