import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {createFieldLoot,rewardEyeKill,collectFieldLoot,updateFieldLoot,
 fieldLootDamage,fieldLootArmor,chainFieldLoot,validFieldLoot} from '../field-loot.js';
import {createCombatTempo,recordCombatContact,ambientTempoPlan,validCombatTempo} from '../combat-tempo.js';
import {advanceEnemyFortifications,FORT_STAGES,FORT_PLANS,fortificationShield,validFortification}
 from '../enemy-fortifications.js';
import {advanceRegionalSupply} from '../regional-supply.js';
import {advanceEnemyExpansion} from '../enemy-expansion.js';

const eye=(serial=1)=>({serial,type:'scout',x:150,y:30,hp:0,converted:false});
function arena(){
 const drops=[],notices=[];
 const game={time:200,fieldLoot:createFieldLoot(),player:{x:0,y:0,hp:110,maxHp:110,shield:0},
  enemies:[],world:{nearbyStations:()=>[]},addDrop:(...args)=>{drops.push(args);return true;},
  notice:msg=>notices.push(msg),heritage:{play(){},vfx:{nova(){}}},
  flash(){},damageEnemy(e,dmg){e.hp-=dmg;}};
 return {game,drops,notices};
}
test('eye kills award a physical, personal, limited buff, not automatic XP or a permanent stack',()=>{
 const {game,drops}=arena();
 assert.equal(rewardEyeKill(game,eye(),false,()=>0),null);
 assert.equal(game.fieldLoot.kills,0);
 assert.equal(rewardEyeKill(game,eye(),true,()=>0),'surge');
 assert.deepEqual(drops.map(d=>d[0]),['fieldBoost']);
 assert.equal(game.fieldLoot.misses,0);
 assert.equal(rewardEyeKill(game,eye(2),true,()=>0),null,'a new boost cannot stack immediately');
 assert.ok(collectFieldLoot(game,{type:'fieldBoost',value:'surge'}));
 assert.equal(game.fieldLoot.reserve.id,'surge');
 assert.equal(game.fieldLoot.active,null,'the charge waits for an actual strong opponent');
 updateFieldLoot(game);
 assert.ok(game.fieldLoot.reserve);
 game.enemies=[{type:'fighter',x:250,y:20,hp:100}];
 game.time+=1;updateFieldLoot(game);
 assert.equal(game.fieldLoot.active.id,'surge');
 assert.equal(fieldLootDamage(game,100,'beam'),128);
 assert.equal(fieldLootDamage(game,100,'other'),100);
 assert.equal(validFieldLoot(game.fieldLoot,game.time),true);
 game.time+=25;updateFieldLoot(game);
 assert.equal(fieldLootDamage(game,100,'beam'),100);
});
test('rare rewards have a hard pity, healing is bounded, and charged arcs cannot recursively duplicate',()=>{
 const {game,drops}=arena();
 for(let i=0;i<14;i++){
  game.time++;assert.equal(rewardEyeKill(game,eye(i),true,()=>.99),null);
 }
 game.time++;assert.equal(rewardEyeKill(game,eye(15),true,()=>.99),'aegis');
 assert.equal(drops.length,1);
 game.player.hp=40;collectFieldLoot(game,{type:'fieldRepair'});
 assert.ok(game.player.hp>40&&game.player.hp<=110);
 game.fieldLoot.active={id:'aegis',until:game.time+20};
 assert.equal(fieldLootArmor(game,100),74);
 game.fieldLoot.active={id:'arc',until:game.time+20};
 const near={x:60,y:10,hp:40},far={x:900,y:0,hp:40};
 game.enemies=[near,far];
 assert.ok(chainFieldLoot(game,{x:0,y:0},40,'beam'));
 assert.ok(near.hp<40);assert.equal(far.hp,40);
 assert.equal(chainFieldLoot(game,{x:0,y:0},40,'beam'),false,'global chain cooldown');
});
test('ordinary fighting earns a quiet period but scouts return, and story assaults remain exempt',()=>{
 const game={time:190,player:{x:0,y:0},enemies:[{x:110,y:0,hp:20}],
  combatTempo:createCombatTempo()};
 const director={cap:50,interval:2,groupSize:5,types:['scout','fighter','gunship']};
 recordCombatContact(game);
 assert.equal(ambientTempoPlan(game,director,()=>0).mode,'wait');
 game.enemies=[];game.time=192;
 assert.equal(ambientTempoPlan(game,director,()=>0).mode,'wait');
 assert.equal(game.combatTempo.quietUntil,204);
 game.time=204;
 const flock=ambientTempoPlan(game,director,()=>0);
 assert.equal(flock.mode,'flock');assert.deepEqual(flock.director.types,['scout']);
 assert.ok(flock.director.groupSize>=4);
 assert.equal(ambientTempoPlan(game,director,()=>0).mode,'normal');
 assert.equal(validCombatTempo(game.combatTempo,game.time),true);
});
test('late patrol tempo preserves rising danger instead of imposing the old fixed caps',()=>{
 const game={time:1500,player:{x:0,y:0},enemies:[],combatTempo:createCombatTempo()};
 const director={cap:70,interval:2,groupSize:8,types:['scout','fighter','gunship']};
 const flock=ambientTempoPlan(game,director,()=>0);
 const normal=ambientTempoPlan(game,director,()=>0);
 assert.equal(flock.mode,'flock');
 assert.ok(flock.director.cap>28&&flock.director.cap<=director.cap);
 assert.ok(flock.director.groupSize>=6);
 assert.equal(normal.mode,'normal');
 assert.ok(normal.director.cap>34&&normal.director.cap<=director.cap);
 assert.equal(normal.director.groupSize,7);
});
test('an enemy depot builds visible intercept, shield and repair modules only with paid stock',()=>{
 const w=new World();const depot=w.stations.get('industry:depot');
 w.regionalSupply.central.ore=16;
 assert.equal(advanceEnemyFortifications(w,284).some(e=>e.front==='home'),false);
 const stock=w.regionalSupply.central.ore;
 const started=advanceEnemyFortifications(w,285).find(e=>e.front==='home');
 assert.equal(started.kind,'started');assert.equal(started.cost,4);
 assert.equal(w.regionalSupply.central.ore,stock-4);
 assert.equal(depot.turrets.at(-1).kind,'construction');
 assert.equal(advanceEnemyFortifications(w,286).some(e=>e.front==='home'),false,'same work not funded twice');
 const first=advanceEnemyFortifications(w,323).find(e=>e.front==='home');
 assert.equal(first.kind,'completed');
 assert.equal(depot.turrets.at(-1).kind,'turret');
 w.regionalSupply.central.ore=16;
 assert.equal(advanceEnemyFortifications(w,573).find(e=>e.front==='home').module,'shield');
 advanceEnemyFortifications(w,612);
 assert.equal(depot.turrets.at(-1).kind,'shield');
 const turret=depot.turrets.find(t=>t.kind==='turret'&&t.fortificationOf===depot.id);
 assert.equal(fortificationShield(w,turret),.76);
 assert.equal(fortificationShield(w,depot.turrets[0]),.76,
  'a funded shield must defend the original base weapons too');
 depot.turrets.find(t=>t.kind==='shield').hp=0;
 assert.equal(fortificationShield(w,turret),1);
 w.regionalSupply.central.ore=16;
 assert.equal(advanceEnemyFortifications(w,862).find(e=>e.front==='home').module,'repair');
 advanceEnemyFortifications(w,901);
 assert.equal(depot.turrets.at(-1).kind,'repair');
 assert.equal(validFortification(depot,901),true);
});
test('destroying an unfinished module loses the payment, and cutting supply halts rebuilding',()=>{
 const w=new World(),depot=w.stations.get('industry:depot'),source=w.stations.get('industry:source');
 w.regionalSupply.central.ore=16;
 advanceEnemyFortifications(w,285);
 const before=w.regionalSupply.central.ore;
 depot.turrets.at(-1).hp=0;
 const stopped=advanceEnemyFortifications(w,287).find(e=>e.front==='home');
 assert.equal(stopped.kind,'interrupted');
 assert.equal(w.regionalSupply.central.ore,before,'no refund for destruction');
 source.enemy=false;source.captured=true;
 assert.equal(advanceEnemyFortifications(w,500).some(e=>e.front==='home'),false);
 assert.equal(depot.fortification.stage,0);
 assert.equal(validFortification(depot,500),true);
});
test('a living 30-minute industrial economy funds physical growth without injecting free ore',()=>{
 const world=new World(),events=[];
 for(let t=0;t<=1800;t++){
  advanceRegionalSupply(world,t);advanceEnemyExpansion(world,t);
  events.push(...advanceEnemyFortifications(world,t));
 }
 for(const key of ['home','north','azure','teal']){
  const completed=events.filter(e=>e.front===key&&e.kind==='completed');
  assert.deepEqual(completed.map(e=>e.module),FORT_PLANS[key]);
  assert.equal(completed.length,3);
 }
 assert.equal(events.some(e=>e.kind==='started'&&e.cost<=0),false);
});
