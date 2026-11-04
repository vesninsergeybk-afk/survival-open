import test from 'node:test';
import assert from 'node:assert/strict';
import {game} from './weapons-scene.mjs';
import {fireAimedRail} from '../ship-weapons.js';
import {precisionRailUnlocked,arsenalDiscoveryPromise} from '../station-progression.js';
import {renderBasePanel} from '../base-panel.js';
import {renderWorldMap} from '../map-panel.js';
import {captureCheckpoint,restoreCheckpoint} from '../run-checkpoint.js';

const enemy=(x,y=0)=>({x,y,r:18,hp:300,maxHp:300,type:'fighter',converted:false});
const rock=(x,y=0)=>({x,y,r:42,hp:250,maxHp:250,alive:true});
const arsenal=(active=false)=>({id:'1:0',type:'arsenal',x:900,y:0,enemy:false,
 active,discovered:true,rank:1,turrets:[],hp:800,maxHp:800});
const arm=g=>{const base=arsenal(true);g.world.stations.set(base.id,base);g.precisionRailAvailable=true;return base;};

test('the first active civilian arsenal grants a single save-derived technique',()=>{
 const g=game(['rail',null,null,null,null,null]),b=arsenal(false);
 g.world.stations.set(b.id,b);
 assert.equal(precisionRailUnlocked(g.world),false);
 assert.match(arsenalDiscoveryPromise(b,g.world),/первый включённый арсенал/i);
 assert.equal(g.toggleManualRail(),false);
 assert.match(g.lastNotice,/арсенала/);
 b.active=true;
 assert.equal(precisionRailUnlocked(g.world),true);
 assert.match(arsenalDiscoveryPromise(b,g.world),/открыт/);
 assert.equal(g.toggleManualRail(),true);
 assert.equal(g.manualRailMode,true);
 assert.equal(g.toggleManualRail(),true);
 assert.equal(g.manualRailMode,false);
 b.active=false;b.enemy=true;
 assert.equal(precisionRailUnlocked(g.world),false,'an enemy arsenal is not a friendly unlock');
});

test('arsenal discovery reward appears on station summary without a new purchase control',()=>{
 const g=game(),b=arsenal(false);g.world.stations.set(b.id,b);g.docked=b;
 const state={...g.baseState(),baseTab:'summary',firstHardwareReward:'rail'};
 const html=renderBasePanel(b,state);
 assert.match(html,/Первый включённый арсенал откроет прицельный режим/);
 assert.doesNotMatch(html,/data-act="buyPrecision"/);
 b.active=true;
 assert.match(renderBasePanel(b,{...state,world:g.world}),/Прицельный режим рельса открыт/);
});

test('the actual map promises a discovery before activation, then removes the unearned promise',()=>{
 const g=game(),b=arsenal(false);g.world.stations.set(b.id,b);
 assert.match(renderWorldMap(g),/ОТКРЫТИЕ: ручной прицел/);
 b.active=true;
 assert.doesNotMatch(renderWorldMap(g),/ОТКРЫТИЕ: ручной прицел/);
});

test('a real activation awards the technique once, and the unlock survives a checkpoint',()=>{
 const g=game(['rail',null,null,null,null,null]),b=arsenal(false);
 g.world.stations.set(b.id,b);g.world.discovered.add(b.id);g.docked=b;g.paused=true;
 g.player.x=b.x;g.player.y=b.y;
 const oreBefore=g.player.ore;
 g.baseAction('activate');
 assert.equal(b.active,true);
 assert.equal(g.player.ore,oreBefore-24);
 assert.equal(g.precisionRailAvailable,true);
 assert.match(g.lastNotice,/ОТКРЫТО: Прицельный режим рельса/);
 const checkpoint=captureCheckpoint(g,b);
 assert.ok(checkpoint,'the normal station checkpoint must still work');
 const restored=game(['rail',null,null,null,null,null]);
 restoreCheckpoint(restored,checkpoint);
 assert.equal(precisionRailUnlocked(restored.world),true);
 assert.equal(restored.manualRailMode,undefined,'the temporary input mode is not persisted as a new run currency');
});

test('manual rail stops only automatic rail; ordinary automatic weapons remain active',()=>{
 const g=game(['rail','plasma',null,null,null,null]);arm(g);g.manualRailMode=true;
 const target=enemy(150);g.grid.insert(target);g.updateShipWeapons(.02);
 assert.equal(g.moduleClocks.rail,-.02,'rail reload still counts down');
 assert.ok(target.hp<300&&target.hp>280,'automatic plasma keeps protecting the ship');
 const result=fireAimedRail(g,{x:target.x,y:target.y});
 assert.equal(result.ok,true);assert.equal(result.hits,1);
 assert.ok(target.hp<230,'the aimed rail uses its own real mount');
 assert.equal(g.moduleClocks.rail,1.65*1.3);
 assert.equal(g.weaponThermal.current,24,'both families share the same heat budget');
 g.manualRailMode=false;g.moduleClocks.rail=0;g.updateShipWeapons(.02);
 assert.ok(g.moduleClocks.rail>0,'turning the mode off restores automatic rail');
});

test('a precise shot hits the first hostile on the ray, not a friendly ship behind it',()=>{
 const g=game(['rail',null,null,null,null,null]);arm(g);g.manualRailMode=true;
 const front=enemy(190),back=enemy(330);g.grid.insert(front);g.grid.insert(back);
 const friend=enemy(110);g.allies=[friend];g.grid.insert(friend);
 const result=fireAimedRail(g,{x:350,y:0});
 assert.equal(result.ok,true);
 assert.equal(front.hp,243);assert.equal(back.hp,300);assert.equal(friend.hp,300);
});

test('aimed rail respects asteroid cover; penetration still obeys its selected branch',()=>{
 for(const penetrate of [false,true]){
  const g=game(['rail',null,null,null,null,null]);arm(g);g.manualRailMode=true;
  const target=enemy(270),cover=rock(130);g.grid.insert(target);g.rockGrid.insert(cover);
  g.damageRock=(r,damage)=>{r.hp-=damage;};
  if(penetrate)g.shipLoadout.specializations.rail={path:'penetrator',rank:1};
  const result=fireAimedRail(g,{x:target.x,y:target.y});
  assert.equal(result.ok,true);assert.equal(result.rocksHit,1);
  assert.ok(cover.hp<250);assert.equal(target.hp,penetrate?300-57*.65:300);
 }
});

test('misses cost a real cooldown and heat; blocked controls spend nothing',()=>{
 const g=game(['rail',null,null,null,null,null]);arm(g);g.manualRailMode=true;
 g.holdFire=true;
 assert.equal(fireAimedRail(g,{x:300,y:0}).ok,false);
 assert.equal(g.weaponThermal.current,0);
 g.holdFire=false;
 assert.equal(fireAimedRail(g,{x:300,y:0}).ok,true);
 assert.equal(g.weaponThermal.current,18);
 assert.equal(g.moduleClocks.rail,1.65*1.3);
 assert.equal(fireAimedRail(g,{x:300,y:0}).ok,false);
 assert.equal(g.weaponThermal.current,18);
});
