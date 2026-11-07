import {RuntimeHarness} from './runtime-game.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../world.js';
import {ENEMY_TYPES} from '../ai.js';
import {baseNames} from '../balance.js';
import {RELAY_DEFENSE,isRelayArsenal,createRelayDefense,relayOffer,relayDefenseCue} from '../relay-defense.js';
import {chooseOperationLead} from '../operations.js';
import {renderBasePanel} from '../base-panel.js';
import {renderWorldMap} from '../map-panel.js';
import {missionHudText} from '../mission-feedback.js';

const world=new World(20261102);
const arsenal=world.nearbyStations(0,0,10000,false).find(b=>b.type==='arsenal'&&!b.captured);
assert.ok(arsenal,'the procedural world needs an allied arsenal');
arsenal.active=true;arsenal.discovered=true;world.discovered.add(arsenal.id);

test('arsenal offers a one-time, recoverable three-wave defense, with a clear location',()=>{
 assert.equal(isRelayArsenal(arsenal),true);
 assert.equal(relayOffer({...arsenal,active:false},null,0).status,'locked');
 assert.equal(relayOffer(arsenal,null,0).status,'available');
 const op=createRelayDefense(arsenal,world);
 assert.ok(Math.hypot(op.x-arsenal.x,op.y-arsenal.y)>250);
 assert.equal(relayOffer(arsenal,op,0).status,'active');
 assert.equal(op.hp,RELAY_DEFENSE.maxHp);
 assert.equal(op.phase,'approach');
 assert.equal(RELAY_DEFENSE.waves.length,3);
 assert.match(relayDefenseCue(op,0),/НАЙДИТЕ/);
 assert.equal(relayOffer({...arsenal,relayRetryAt:80},null,20).remaining,60);
 assert.equal(relayOffer({...arsenal,relayDefenseDone:true},null,20).status,'complete');
});

const gameSource=readFileSync(new URL('../game.js',import.meta.url),'utf8');
const start=gameSource.indexOf(' spawnRelayWave(op,index){');
const end=gameSource.indexOf(' // A tangible, single-use operation',start);
assert.ok(start>0&&end>start,'relay operation methods should remain a cohesive block');
const Ops=RuntimeHarness;
const scenario=()=>{
 const base={...arsenal,relayDefenseDone:false,relayRetryAt:0};
 const scene={stations:new Map([[base.id,base]]),discovered:new Set(),
  nearbyStations:()=>[],nearbyRocks:()=>[]};
 const op=createRelayDefense(base,scene),game=new Ops(),messages=[],effects=[];
 Object.assign(game,{world:scene,operation:op,player:{x:op.x+20,y:op.y,ore:0},
  enemies:[],enemySerial:0,groupSerial:0,time:0,dead:false,waypoint:{id:op.id},
  heritage:{vfx:{nova(){effects.push('nova');},shipExplosion(){effects.push('explosion');}},play(){},station(){},ui(){}},
  overlay:{dataset:{}},cockpit:{resourceGain(){}},
  flash(){},notice:m=>messages.push(m),collect(item){this.data=(this.data||0)+item.value;}});
 return {game,base,op,messages,effects};
};

test('waves arrive after warning, charge their attacks, and give no restartable kill farm',()=>{
 const {game,op}=scenario();
 game.updateRelayDefense(.1);
 assert.equal(op.phase,'warning');
 assert.match(relayDefenseCue(op,3),/^АТАКА ЧЕРЕЗ 2 С [↘↓↙←↖↑↗→]$/);
 game.time=op.nextAt+.01;game.updateRelayDefense(.1);
 assert.equal(op.wave,1);assert.equal(op.phase,'wave');
 assert.equal(op.enemySerials.length,2);
 assert.ok(game.enemies.every(e=>e.relayAssault===op.baseId&&e.expAwarded));
 for(const e of game.enemies){e.x=op.x+180;e.y=op.y;e.relayCooldownUntil=0;}
 game.time+=.1;game.updateRelayDefense(.1);
 const striker=game.enemies.find(e=>e.missionStrike);
 assert.ok(striker.relayChargeUntil>game.time);
 assert.ok(game.enemies.find(e=>e.relayScreen).relayChargeUntil===0);
 game.time=striker.relayChargeUntil+.01;game.updateRelayDefense(.01);
 assert.ok(op.hp<op.maxHp,'an uninterrupted charged salvo must damage the relay');
 for(const e of game.enemies)e.hp=0;
 game.updateRelayDefense(.1);
 assert.equal(op.phase,'intermission');
 game.time=op.nextAt+.1;game.updateRelayDefense(.1);
 assert.equal(op.wave,2);assert.equal(game.enemies.filter(e=>e.hp>0).length,2);
});

test('winning leaves a working site, pays once and has a different effect from defeat',()=>{
 const {game,op,base,effects,messages}=scenario();
 game.updateRelayDefense(.1);
 game.time=op.nextAt+.1;game.updateRelayDefense(.1);
 for(let wave=1;wave<=3;wave++){
  for(const e of game.enemies)e.hp=0;
  game.updateRelayDefense(.1);
  if(wave<3){game.time=op.nextAt+.1;game.updateRelayDefense(.1);}
 }
 assert.equal(base.relayDefenseDone,true);
 assert.equal(game.operation,null);
 assert.equal(base.relaySite.hp,op.hp);
 assert.equal(base.relaySite.antenna.hp,RELAY_DEFENSE.antennaHp);
 assert.deepEqual(effects,[],'success uses the persisted online render, no flash or explosion');
 assert.match(messages.at(-1),/Связь восстановлена/);
 assert.equal(game.player.ore,RELAY_DEFENSE.rewardOre+RELAY_DEFENSE.bonusOre);
 assert.equal(game.data,RELAY_DEFENSE.rewardData+RELAY_DEFENSE.bonusData);
 game.completeRelayDefense(op);
 assert.equal(game.player.ore,RELAY_DEFENSE.rewardOre+RELAY_DEFENSE.bonusOre);
 const failed=scenario();failed.op.hp=0;
 failed.game.failRelayDefense(failed.op);
 assert.equal(failed.base.relayDefenseDone,false);
 assert.equal(failed.base.active,true);
 assert.ok(failed.base.relayRetryAt>failed.game.time);
 assert.equal(failed.game.operation,null);
 assert.deepEqual(failed.effects,['explosion']);
});

test('a lost antenna costs the bonus, and retreat cannot restart a live wave immediately',()=>{
 const {game,op,base}=scenario();op.antenna.hp=0;game.completeRelayDefense(op);
 assert.equal(game.player.ore,RELAY_DEFENSE.rewardOre);
 assert.equal(base.relaySite.antenna.hp,0);
 const fight=scenario();fight.game.abandonOperation();assert.equal(fight.base.relayRetryAt,0);
 fight.game.operation=fight.op;fight.game.updateRelayDefense(.1);
 fight.game.abandonOperation();assert.equal(relayOffer(fight.base,null,fight.game.time).remaining,45);
 assert.notEqual(createRelayDefense(fight.base,fight.game.world).bearing,fight.op.bearing);
});

test('station UI, map and cockpit describe the actual relay-defense mission',()=>{
 const state={ore:70,hp:110,maxHp:110,shield:0,activeBases:2,connectedBases:2,
  connected:true,allies:0,droneRoles:[],droneDamage:0,charges:0,transfers:[],
  contract:null,network:{armor:0,armament:0,engine:0,strikePower:0},
  baseTab:'operations',time:10,world};
 const html=renderBasePanel(arsenal,state);
 assert.match(html,/Оборона ретранслятора/);
 assert.match(html,/Три|три/);
 assert.match(html,/data-act="acceptOperation"/);
 const op=createRelayDefense(arsenal,world);
 op.phase='warning';op.nextAt=20;
 const active=renderBasePanel(arsenal,{...state,operation:op});
 assert.match(active,/АТАКА ЧЕРЕЗ 10 С/);
 const game={player:{x:arsenal.x,y:arsenal.y},world,operation:op,contract:null,
  enemyBasesUnlocked:()=>false,waypoint:{id:op.id,x:op.x,y:op.y,label:'Ретранслятор'},
  mapReturnToBase:false,docked:null,time:10};
 assert.match(renderWorldMap(game),/Оборона ретранслятора/);
 assert.match(renderWorldMap(game),/Ретранслятор/);
 assert.match(missionHudText(game),/АТАКА ЧЕРЕЗ 10 С/);
});

test('relay success reveals the now-playable carrier operation before another laboratory',()=>{
 const {game,base,op}=scenario();
 const carrier={id:'carrier',x:op.x+850,y:op.y,type:'carrier',active:false,discovered:false,enemy:false};
 const lab={id:'lab',x:op.x+1070,y:op.y,type:'lab',active:false,discovered:false,enemy:false};
 game.world.nearbyStations=()=>[carrier,lab];
 game.completeRelayDefense(op);
 assert.equal(game.waypoint?.id,carrier.id);
 assert.equal(carrier.discovered,true);
 assert.equal(lab.discovered,false);
});
