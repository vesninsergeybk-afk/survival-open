import test from 'node:test';
import assert from 'node:assert/strict';
import {FIELD_EVOLUTION_SKILLS,createFieldEvolution,chooseEvolutionOffers,
 offerLevelCrystals,enemyFieldReward,rewardFieldEvolutionOnce,collectParasiteCore,absorbParasiteImpact,
 markDashPass,fieldWeaponImpact,updateFieldEvolution,updateParasitizedEnemy,
 validFieldEvolution,parasiteTargetMode,setParasiteTargetMode} from '../field-evolution.js';
import {renderEvolutionMenu} from '../evolution-menu.js';
import {makeRoomForDrop} from '../drop-capacity.js';

const skills=[...FIELD_EVOLUTION_SKILLS,
 {id:'magnet',from:2,max:3},{id:'radar',from:3,max:2}];
function makeGame(){
 const events=[],drops=[];
 return {time:10,player:{x:0,y:0,hp:80,maxHp:100,points:1,level:2,
   burstRemaining:.25},skillRanks:{parasite:0,conduit:0,wreck:0,capture:0,signal:0},
  fieldEvolution:createFieldEvolution(),enemies:[],allies:[],designatedTarget:null,
  addDrop(type,x,y){drops.push({type,x,y});return true;},
  flash(...args){events.push(['flash',...args]);},
  heritage:{vfx:{nova(...args){events.push(['nova',...args]);}},play(){}},
  notice(msg){events.push(['notice',msg]);},events,drops};
}
const enemy=(serial,type='fighter',x=40,y=0)=>({serial,type,x,y,vx:0,vy:0,
 r:19,hp:0,maxHp:80,damage:15});

test('level 2 presents three distinct permanent choices for the existing point',()=>{
 const g=makeGame();
 offerLevelCrystals(g,1,skills);
 assert.equal(g.fieldEvolution.pending,1);
 assert.deepEqual(g.fieldEvolution.offers,['parasite','conduit','wreck']);
 assert.equal(g.fieldEvolution.crystals.length,0,'movement must never spend a level point');
 assert.equal(g.player.points,1);
 assert.equal(new Set(g.fieldEvolution.offers).size,3);
 assert.ok(chooseEvolutionOffers(3,{parasite:1,conduit:1,wreck:1},skills).includes('capture'));
});

test('combat-only energy progression drops one physical core per third qualifying kill',()=>{
 const g=makeGame();g.skillRanks.parasite=1;
 for(let i=1;i<=5;i++)enemyFieldReward(g,enemy(i),true);
 assert.equal(g.drops.filter(d=>d.type==='parasiteCore').length,1);
 assert.equal(g.fieldEvolution.kills,5);
 enemyFieldReward(g,enemy(20),false);
 enemyFieldReward(g,{...enemy(21),missionStructure:true},true);
 assert.equal(g.fieldEvolution.kills,5);
 enemyFieldReward(g,enemy(6),true);
 assert.equal(g.drops.length,2);
});

test('trial and ordinary death processing cannot award parasite mastery twice for one enemy',()=>{
 const g=makeGame();g.skillRanks.parasite=1;
 const victim=enemy(28);
 assert.equal(rewardFieldEvolutionOnce(g,victim,true).core,false);
 assert.equal(g.fieldEvolution.kills,1);
 assert.deepEqual(rewardFieldEvolutionOnce(g,victim,true),{core:false,captured:false,wreck:false});
 assert.equal(g.fieldEvolution.kills,1);
 assert.equal(victim.fieldRewarded,true);
});

test('energy cores have a two-charge cap and do not change experience or resources',()=>{
 const g=makeGame();g.skillRanks.parasite=1;
 assert.equal(collectParasiteCore(g),true);
 assert.equal(collectParasiteCore(g),true);
 assert.equal(collectParasiteCore(g),false);
 assert.equal(g.fieldEvolution.charge,2);
 assert.equal(g.player.points,1);
});

test('parasite captures just one personally defeated marked ordinary drone, retaining its role',()=>{
 const g=makeGame();g.skillRanks.parasite=1;g.skillRanks.capture=1;
 g.fieldEvolution.charge=2;
 const healer=enemy(10,'healer');g.enemies=[healer];
 g.designatedTarget={target:healer,expiresAt:g.time+7};
 assert.equal(enemyFieldReward(g,healer,true).captured,true);
 assert.equal(healer.converted,true);
 assert.equal(healer.parasiteRole,'healer');
 assert.equal(healer.convertedTime,16);
 assert.equal(g.fieldEvolution.charge,1);
 const fighter=enemy(11);g.enemies.push(fighter);
 g.designatedTarget={target:fighter,expiresAt:g.time+8};
 assert.equal(enemyFieldReward(g,fighter,true).captured,false);
 assert.equal(g.fieldEvolution.charge,1);
 g.time+=23;healer.hp=0;
 assert.equal(enemyFieldReward(g,{...enemy(12),boss:true},true).captured,false);
});

test('a dash tags actually intersected enemies; a later weapon hit disables the nearby group',()=>{
 const g=makeGame();g.skillRanks.conduit=1;
 const a={...enemy(1,'fighter',24,0),hp:50};
 const b={...enemy(2,'scout',75,38),hp:30};
 const far={...enemy(3,'healer',600,0),hp:80};
 g.enemies=[a,b,far];g.player.x=50;
 assert.equal(markDashPass(g,0,0),1);
 assert.equal(a.fieldMarkUntil,g.time+4);
 assert.equal(far.fieldMarkUntil,undefined);
 fieldWeaponImpact(g,a);
 assert.ok(a.stasisUntil>g.time);
 assert.ok(b.stasisUntil>g.time);
 assert.equal(far.stasisUntil,undefined);
 assert.equal(a.fieldMarkUntil,0);
});

test('implanting a spy costs a stored core, requires deliberate priority and exposes only local enemies',()=>{
 const g=makeGame();g.skillRanks.parasite=1;g.skillRanks.signal=1;
 g.fieldEvolution.charge=1;
 const target={...enemy(1,'fighter',200,0),hp:78};
 const near={...enemy(2,'scout',450,0),hp:50};
 const far={...enemy(3,'healer',2000,0),hp:80};
 g.enemies=[target,near,far];
 fieldWeaponImpact(g,target);assert.equal(g.fieldEvolution.charge,1);
 g.designatedTarget={target,expiresAt:g.time+4};
 fieldWeaponImpact(g,target);
 assert.equal(g.fieldEvolution.charge,0);
 assert.equal(g.fieldEvolution.spySerial,target.serial);
 updateFieldEvolution(g,.5);
 assert.deepEqual(g.fieldEvolution.reveals.map(r=>r.serial).sort(),[1,2]);
 assert.ok(target.parasiteSpyUntil>g.time);
 g.time+=.1;
 updateFieldEvolution(g,.1);
 assert.equal(g.fieldEvolution.spySerial,target.serial,
  'spy implant must persist between successive scan ticks');
 g.time+=.41;
 updateFieldEvolution(g,.41);
 assert.deepEqual(g.fieldEvolution.reveals.map(r=>r.serial).sort(),[1,2]);
 g.time=target.parasiteSpyUntil;
 updateFieldEvolution(g,.1);
 assert.equal(g.fieldEvolution.spySerial,null);
});

test('with both parasite upgrades, shooting a marked enemy preserves the capture core by default',()=>{
 const g=makeGame();g.skillRanks.parasite=1;g.skillRanks.capture=1;g.skillRanks.signal=1;
 g.fieldEvolution.charge=1;
 const target={...enemy(31,'fighter'),hp:75};
 g.enemies=[target];g.designatedTarget={target,expiresAt:g.time+14};
 assert.equal(parasiteTargetMode(g),'capture');
 fieldWeaponImpact(g,target);
 assert.equal(g.fieldEvolution.charge,1,'the spy implant must not steal the only capture charge');
 assert.equal(g.fieldEvolution.spySerial,null);
 target.hp=0;
 assert.equal(enemyFieldReward(g,target,true).captured,true);
 assert.equal(g.fieldEvolution.charge,0);
});

test('selecting scout mode spends one core on a fresh marked enemy and does not capture on kill',()=>{
 const g=makeGame();g.skillRanks.parasite=1;g.skillRanks.capture=1;g.skillRanks.signal=1;
 g.fieldEvolution.charge=1;
 const target={...enemy(32,'scout'),hp:72};
 g.enemies=[target];g.designatedTarget={target,expiresAt:g.time+14};
 assert.equal(setParasiteTargetMode(g,'signal'),true);
 assert.equal(parasiteTargetMode(g),'signal');
 fieldWeaponImpact(g,target);
 assert.equal(g.fieldEvolution.charge,0);
 assert.equal(g.fieldEvolution.spySerial,32);
 g.fieldEvolution.charge=1;target.hp=0;
 assert.equal(enemyFieldReward(g,target,true).captured,false,
  'a spy assignment should not turn into an unexpected capture');
 assert.equal(g.fieldEvolution.charge,1);
 assert.equal(setParasiteTargetMode(g,'capture'),true);
 assert.equal(parasiteTargetMode(g),'capture');
 assert.equal(setParasiteTargetMode(g,'nonexistent'),false);
});

test('the parasite mode is disabled until both abilities exist and older save fields stay compatible',()=>{
 const g=makeGame();g.skillRanks.parasite=1;g.skillRanks.signal=1;
 assert.equal(parasiteTargetMode(g),'signal');
 assert.equal(setParasiteTargetMode(g,'capture'),false);
 assert.equal(parasiteTargetMode(g),'signal');
 const legacy=createFieldEvolution();delete legacy.targetMode;
 assert.equal(validFieldEvolution(legacy,10),true);
 legacy.targetMode='unknown';assert.equal(validFieldEvolution(legacy,10),false);
});

test('the ability screen explains passive defense and exposes an actionable, pressed parasite mode',()=>{
 const g=makeGame();g.skillRanks.parasite=1;g.skillRanks.capture=1;g.skillRanks.signal=1;
 g.fieldEvolution.charge=2;g.fieldEvolution.targetMode='signal';
 g.menuBackLabel=()=>'';
 const html=renderEvolutionMenu(g,FIELD_EVOLUTION_SKILLS);
 assert.match(html,/Как пользоваться паразитом/);
 assert.match(html,/Защита не требует кнопки/);
 assert.match(html,/data-act="parasiteMode" data-mode="signal" aria-pressed="true"/);
 assert.match(html,/data-act="parasiteMode" data-mode="capture" aria-pressed="false"/);
 assert.match(html,/2\/2 ядра/);
});

test('an emergency core only intercepts serious hits, and stasis is local',()=>{
 const g=makeGame();g.skillRanks.parasite=1;g.fieldEvolution.charge=1;
 const close={...enemy(1,'fighter',35,0),hp:80};
 const distant={...enemy(2,'fighter',600,0),hp:80};
 g.enemies=[close,distant];
 assert.equal(absorbParasiteImpact(g,8),8);
 assert.equal(g.fieldEvolution.charge,1);
 assert.equal(absorbParasiteImpact(g,34),9);
 assert.equal(g.fieldEvolution.charge,0);
 assert.ok(close.stasisUntil>g.time);
 assert.equal(distant.stasisUntil,undefined);
});

test('wreck cover is bounded, moves, and never spawns from remote or mission kills',()=>{
 const g=makeGame();g.skillRanks.wreck=1;
 assert.equal(enemyFieldReward(g,enemy(1),true).wreck,true);
 assert.equal(enemyFieldReward(g,enemy(2),true).wreck,false);
 assert.equal(g.fieldEvolution.wrecks.length,1);
 g.time+=6.1;
 assert.equal(enemyFieldReward(g,enemy(3),true).wreck,true);
 enemyFieldReward(g,enemy(4),false);
 assert.equal(g.fieldEvolution.wrecks.length,2);
 g.time+=20;updateFieldEvolution(g,.2);
 assert.equal(g.fieldEvolution.wrecks.length,0);
});

test('captured medics heal instead of firing; their expiry cannot award XP again',()=>{
 const g=makeGame();g.player.hp=45;
 const medic={...enemy(5,'healer',20,0),hp:32,parasiteCapture:true,
  converted:true,parasiteRole:'healer',convertedTime:5,fire:0};
 g.enemies=[medic];
 updateParasitizedEnemy(medic,g,.2);
 assert.equal(g.player.hp,51);
 assert.equal(medic.hp,32);
 updateParasitizedEnemy(medic,g,6);
 assert.equal(medic.hp,0);
 assert.equal(medic.expAwarded,true);
});

test('checkpoint validator accepts bounded evolution state and rejects forged charges or unbounded debris',()=>{
 const s=createFieldEvolution();
 assert.equal(validFieldEvolution(s,10),true);
 s.charge=900;assert.equal(validFieldEvolution(s,10),false);s.charge=0;
 s.wrecks=Array.from({length:4},()=>({x:0,y:0,hp:10,until:12}));
 assert.equal(validFieldEvolution(s,10),false);
});

test('drop overflow never deletes parasite cores or mission charges',()=>{
 const drops=[{type:'parasiteCore',life:2},{type:'fieldCell',life:1},{type:'ore',life:4}];
 assert.equal(makeRoomForDrop(drops,3),true);
 assert.deepEqual(drops.map(d=>d.type),['parasiteCore','fieldCell']);
 assert.equal(makeRoomForDrop(drops,2),false);
});
