import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {updateRegionalWorld} from '../region-runtime.js';
import {fortificationShield} from '../enemy-fortifications.js';

test('the live regional update funds and completes real enemy defenses',()=>{
 const world=new World(20261108),depot=world.stations.get('industry:depot');
 const game={world,time:284.5,player:{x:0,y:0,hp:110,maxHp:110},
  enemies:[],groupSerial:0,waypoint:null,notice(){},flash(){},
  worldFeedback:{history:[],pending:[],serial:0}};
 world.regionalSupply.central.ore=16;
 const stock=world.regionalSupply.central.ore;
 updateRegionalWorld(game,.1);
 assert.equal(depot.fortification?.stage||0,0,'the first defense is not free or early');
 game.time=285.5;
 updateRegionalWorld(game,.1);
 assert.equal(world.regionalSupply.central.ore,stock-4,
  'the real world loop pays for the first construction from existing inventory');
 const site=depot.turrets.find(t=>t.kind==='construction');
 assert.ok(site,'the funded project creates a physical, damageable target');
 game.time=323.5;
 updateRegionalWorld(game,.1);
 const turret=depot.turrets.find(t=>t.kind==='turret'&&t.fortificationOf===depot.id);
 assert.ok(turret&&turret.hp>0,'the world loop finishes the same paid project');
 assert.equal(depot.turrets.some(t=>t.kind==='construction'),false);
 assert.equal(fortificationShield(world,turret),1,'an unshielded build has no free shield');
 const source=world.stations.get('industry:source');
 source.enemy=false;source.captured=true;
 game.time=573.5;
 const stockWithoutSource=world.regionalSupply.central.ore;
 updateRegionalWorld(game,.1);
 assert.equal(depot.fortification.stage,1,
  'losing the industrial source stops the next autonomous build');
 assert.equal(world.regionalSupply.central.ore,stockWithoutSource,
  'a blocked construction must not consume ore');
 source.enemy=true;source.captured=false;
 world.regionalSupply.central.ore=16;
 game.time=574.5;
 updateRegionalWorld(game,.1);
 assert.equal(depot.turrets.at(-1).kind,'construction',
  'a restored supply chain can resume autonomous development');
 assert.equal(depot.turrets.at(-1).buildKind,'shield');
});
