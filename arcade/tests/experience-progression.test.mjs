import test from 'node:test';
import assert from 'node:assert/strict';
import {expForNext,previousExpForNext,legacyExpForNext} from '../balance.js';
import {experienceDifference} from '../hud.js';
import {enemyDataReward} from '../combat-rewards.js';
import {contractChoices} from '../base-panel.js';
import {RuntimeHarness} from './runtime-game.mjs';
import {OPENING_ARC} from '../opening-arc.js';
import {XP_CURVE_VERSION,FIRST_RICH_ASTEROID_XP,experienceFromPickup,
 grantExperience,firstRichAsteroidExperience,qualifiesForDirectCombatXp,migrateLegacyPlayerExperience} from '../experience.js';

const pilot=(level=1,xp=0,points=0)=>({level,xp,points});
const total=(level,xp,formula)=>Array.from({length:level-1},(_,i)=>formula(i+1))
 .reduce((sum,step)=>sum+step,xp);

test('the early levels stay accessible and midgame costs rise steadily',()=>{
 assert.deepEqual(Array.from({length:8},(_,i)=>expForNext(i+1)),
  [42,68,105,155,205,265,345,430]);
 for(const level of [8,9,10,15,25,40]){
  assert.ok(expForNext(level)<previousExpForNext(level));
  if(level>=9)assert.ok(expForNext(level)/expForNext(level-1)<1.15);
 }
});

test('the opening combat contract now grants a meaningful first level',()=>{
 const p=pilot(),contract=contractChoices('dock',0)[0];
 assert.equal(contract.goal,4);
 assert.equal(contract.data,15);
 for(let i=0;i<contract.goal;i++)grantExperience(p,enemyDataReward({type:'scout',maxHp:28}));
 grantExperience(p,contract.data);
 assert.deepEqual({level:p.level,xp:p.xp,points:p.points},{level:2,xp:1,points:1});
});

test('combat XP arrives on destruction; looted data cannot award it twice',()=>{
 const p=pilot(),xp=enemyDataReward({type:'scout',maxHp:28});
 grantExperience(p,xp);
 const drop={type:'data',source:'combat',value:xp,xpGranted:true};
 assert.equal(experienceFromPickup(drop),0);
 assert.equal(experienceFromPickup({type:'data',source:'combat',value:xp}),0,
  'even an unmarked combat drop cannot turn automated station kills into XP');
 grantExperience(p,experienceFromPickup(drop));
 assert.equal(p.xp,xp);
 assert.equal(experienceFromPickup({type:'data',source:'operation',value:27}),27);
 assert.equal(experienceFromPickup({type:'ore',source:'mining',value:20}),0);
});

test('direct XP requires recent player participation, preventing AFK station farming',()=>{
 assert.equal(qualifiesForDirectCombatXp({},100),false);
 assert.equal(qualifiesForDirectCombatXp({lastPlayerHitAt:99},100),true);
 assert.equal(qualifiesForDirectCombatXp({lastPlayerHitAt:80},100),true);
 assert.equal(qualifiesForDirectCombatXp({lastPlayerHitAt:79},100),false);
 assert.equal(qualifiesForDirectCombatXp({lastPlayerHitAt:101},100),false);
});

test('field contracts reject enemy crossfire but count a wingmate finish after the pilot hits',()=>{
 const game=new RuntimeHarness(),station={id:'0:0',type:'dock'};
 game.time=100;game.world={stations:new Map([[station.id,station]])};
 game.contract={baseId:station.id,kind:'kill',goal:2,progress:0};
 const notices=[];game.notice=text=>notices.push(text);
 game.advanceContract('kill',{type:'scout',lastPlayerHitAt:79});
 game.advanceContract('kill',{type:'scout'});
 assert.equal(game.contract.progress,0,'unattended kills must not complete a pilot contract');
 game.advanceContract('kill',{type:'scout',lastPlayerHitAt:80});
 assert.equal(game.contract.progress,1,'an assist in the last 20 seconds counts');
 game.advanceContract('kill',{type:'scout',lastPlayerHitAt:99});
 assert.equal(game.contract.progress,2);
 assert.equal(notices.length,1,'completion is announced exactly once');
 game.advanceContract('kill',{type:'scout',lastPlayerHitAt:100});
 assert.equal(game.contract.progress,2,'completed contracts cannot grow');
});

test('operation notices retain earned level and the correct skills shortcut',()=>{
 const game=new RuntimeHarness(),seen=[];
 game.player={level:3};game.isTouchLayout=false;
 game.controlLabel=()=> 'U';game.notice=(message,seconds)=>seen.push({message,seconds});
 game.rewardNotice('Ретранслятор защищён: +26 данных и опыта.',2,5.5);
 assert.match(seen[0].message,/Ретранслятор защищён: \+26 данных и опыта/);
 assert.match(seen[0].message,/Новый уровень: 3! Навыки пилота — U/);
 assert.equal(seen[0].seconds,5.5);
 game.isTouchLayout=true;game.rewardNotice('Сигнал восстановлен.',2,6);
 assert.match(seen[1].message,/Новый уровень: 3! Откройте «Развитие» в меню/);
 game.rewardNotice('Обычная награда.',3,4);
 assert.equal(seen[2].message,'Обычная награда.');
});

test('a first rich asteroid plus the first geology contract grant level two',()=>{
 const p=pilot(),contract=contractChoices('dock',0)[1];
 assert.equal(contract.kind,'rich');
 assert.equal(firstRichAsteroidExperience(p,{rich:false},'extract'),0);
 assert.equal(firstRichAsteroidExperience(p,{rich:true},'auto'),0);
 assert.equal(firstRichAsteroidExperience(p,{rich:true},'extract'),FIRST_RICH_ASTEROID_XP);
 assert.equal(firstRichAsteroidExperience(p,{rich:true},'extract'),0);
 grantExperience(p,FIRST_RICH_ASTEROID_XP);
 grantExperience(p,contract.data);
 assert.equal(p.level,2);
 assert.equal(p.xp,0);
 assert.equal(firstRichAsteroidExperience(p,{rich:true},'extract'),0);
});

test('opening rescue gives a smaller but real XP reward',()=>{
 const p=pilot();
 assert.equal(OPENING_ARC.rescueRewardXp,18);
 assert.ok(OPENING_ARC.interceptRewardData>OPENING_ARC.rescueRewardXp);
 grantExperience(p,OPENING_ARC.rescueRewardXp);
 assert.equal(p.xp,18);
});

test('legacy checkpoint conversion preserves total XP and spent skill points',()=>{
 const examples=[pilot(1,70,0),pilot(2,80,0),pilot(6,300,2),
  pilot(7,0,0),pilot(8,600,3),pilot(20,123,15)];
 for(const p of examples){
  const before=total(p.level,p.xp,legacyExpForNext),originalLevel=p.level,points=p.points;
  const gained=migrateLegacyPlayerExperience(p);
  assert.equal(p.xpCurveVersion,XP_CURVE_VERSION);
  assert.equal(total(p.level,p.xp,expForNext),before);
  assert.ok(p.level>=originalLevel,'old saves must never lose a level');
  assert.equal(p.points,points+gained,'existing spent points must remain spent');
  const after={...p};
  assert.equal(migrateLegacyPlayerExperience(p),0,'migration must run only once');
  assert.deepEqual(p,after,'second restore cannot award extra XP');
 }
});

test('version two checkpoints keep lifetime XP when migrated to the new curve',()=>{
 for(const [level,xp] of [[1,57],[4,100],[8,340],[12,1270],[23,3000]]){
  const p={...pilot(level,xp,2),xpCurveVersion:2};
  const before=total(level,xp,previousExpForNext);
  const gained=migrateLegacyPlayerExperience(p);
  assert.equal(total(p.level,p.xp,expForNext),before);
  assert.ok(p.level>=level);
  assert.equal(p.points,2+gained);
  assert.equal(migrateLegacyPlayerExperience(p),0);
 }
});

test('late-level progress cannot be increased by repeating early discoveries',()=>{
 const p=pilot(7,0,0),reward=firstRichAsteroidExperience(p,{rich:true},'extract');
 assert.equal(reward,FIRST_RICH_ASTEROID_XP);
 for(let i=0;i<50;i++)
  assert.equal(firstRichAsteroidExperience(p,{rich:true},'extract'),0);
 assert.equal(grantExperience(p,reward),0);
 assert.equal(p.level,7);
});

test('HUD reports actual XP over the new early-level thresholds',()=>{
 assert.equal(experienceDifference({level:1,xp:35},{level:2,xp:0}),7);
 assert.equal(experienceDifference({level:1,xp:35},{level:3,xp:25}),100);
 assert.equal(experienceDifference({level:2,xp:40},{level:2,xp:65}),25);
 assert.equal(experienceDifference({level:2,xp:40},{level:1,xp:0}),null);
});
