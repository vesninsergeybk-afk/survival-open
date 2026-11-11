import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {impactRock,rockYield,MINING_NOISE,extractionNoiseDelta} from '../mining.js';
import {contactOnCircle} from '../impact-geometry.js';
import {firstRichAsteroidExperience} from '../experience.js';
import {claimGeologicalSurvey,createStrategicExperience,STRATEGIC_XP} from '../strategic-experience.js';
import {prospectNoiseMultiplier,prospectMineCompleted,doctrineRank} from '../pilot-doctrines.js';
import {masteryBonus,masteryPerkTier,masteryProgress} from '../combat-mastery.js';

const gameSource=readFileSync(new URL('../game.js',import.meta.url),'utf8');
const start=gameSource.indexOf(' damageRock(');
const end=gameSource.indexOf('\n addDrop(',start);
assert.ok(start>0&&end>start,'asteroid damage method must remain available');
const Harness=new Function('impactRock','rockYield','MINING_NOISE','extractionNoiseDelta',
 'contactOnCircle','firstRichAsteroidExperience','claimGeologicalSurvey',
 'prospectNoiseMultiplier','prospectMineCompleted','doctrineRank',
 'masteryBonus','masteryPerkTier','masteryProgress',
 'return class CoverHarness {'+gameSource.slice(start,end)+'}')(
 impactRock,rockYield,MINING_NOISE,extractionNoiseDelta,contactOnCircle,firstRichAsteroidExperience,
 claimGeologicalSurvey,prospectNoiseMultiplier,prospectMineCompleted,doctrineRank,
 masteryBonus,masteryPerkTier,masteryProgress);

test('repeated enemy impacts destroy finite asteroid cover without giving free ore',()=>{
 const broken=[],drops=[],sounds=[];
 const game=new Harness();
 Object.assign(game,{time:0,skillRanks:{mining:0},doctrine:null,nearQuietLab:false,
  player:{x:0,y:0},heritage:{
   vfx:{asteroidBreak:(...args)=>broken.push(args),asteroidImpact:()=>{}},
   play:(...args)=>sounds.push(args)},
  addDrop:(...args)=>drops.push(args)});
 const rock={x:100,y:0,r:35,rich:true,hp:58,maxHp:58,alive:true,
  vx:0,vy:0,spinVelocity:0,flash:0};
 for(let hit=0;hit<12&&rock.alive;hit++){
  game.damageRock(rock,8,70,0,'cover',false);
 }
 assert.equal(rock.alive,false,'cover must eventually break under sustained fire');
 assert.equal(rock.hp,0);
 assert.equal(broken.length,1,'a destroyed rock breaks visually only once');
 assert.equal(drops.length,0,'enemy shots must not generate mineable alloy');
 const soundCount=sounds.length;
 game.damageRock(rock,8,70,0,'cover',false);
 assert.equal(sounds.length,soundCount,'dead cover cannot replay break audio');
});
test('hostile projectiles really drive cover wear, but only at their collision point',()=>{
 assert.match(gameSource,/this\.damageRock\(rock,Math\.min\(12,Math\.max\(1,s\.damage\*\.5\)\),s\.x,s\.y,'cover',false\)/);
 assert.match(gameSource,/firstRockImpact\(s\.x,s\.y,nextX,nextY,candidates,s\.r,p\)/);
});

test('partial extraction creates live noise without premature ore or duplicated rewards',()=>{
 const drops=[],contract=[],experience=[];const game=new Harness();
 Object.assign(game,{time:30,miningNoise:0,skillRanks:{mining:0},nearQuietLab:false,
  doctrine:null,advanceContract:(...args)=>contract.push(args),
  player:{level:1,firstRichRockStudied:false},awardExperience:xp=>experience.push(xp),
  notice:()=>{},rewardNotice:()=>{},
  heritage:{vfx:{asteroidBreak:()=>{},asteroidImpact:()=>{}},play:()=>{}},
  addDrop:(...args)=>drops.push(args)});
 const rock={x:120,y:0,r:30,rich:true,hp:100,maxHp:100,alive:true,vx:0,vy:0};
 for(const expected of [10.5,21,31.5]){
  game.damageRock(rock,25,0,0,'extract',false);
  assert.ok(Math.abs(game.miningNoise-expected)<1e-9);
  assert.equal(drops.length,0,'unbroken rock gives no alloy');
 }
 game.damageRock(rock,25,0,0,'extract',false);
 assert.ok(Math.abs(game.miningNoise-42)<1e-9);
 assert.equal(rock.alive,false);
 assert.equal(contract.length,1);
 assert.deepEqual(experience,[18],'first rich extraction awards XP exactly once');
 assert.equal(drops.reduce((sum,drop)=>sum+drop[3],0),rockYield(rock,'extract'));
 game.damageRock(rock,50,0,0,'extract',false);
 assert.deepEqual(experience,[18],'broken rock cannot award more XP');
 assert.equal(game.miningNoise,42,'dead rock cannot emit noise twice');
});
test('real extraction differentiates a fresh first-rich bonus from a migrated pilot survey',()=>{
 for(const alreadyStudied of [false,true]){
  const xp=[],pilot={level:3,firstRichRockStudied:alreadyStudied,
   strategicXp:createStrategicExperience()},game=new Harness();
  Object.assign(game,{time:30,miningNoise:0,skillRanks:{mining:2},nearQuietLab:false,
   doctrine:null,player:pilot,advanceContract:()=>{},awardExperience:n=>xp.push(n),
   rewardNotice:()=>{},heritage:{vfx:{asteroidBreak:()=>{},asteroidImpact:()=>{}},play:()=>{}},
   addDrop:()=>{}});
  const rock={id:'4:0/1',x:4000,y:100,r:30,originX:4000,originY:100,
   rich:true,hp:50,maxHp:50,alive:true,vx:0,vy:0};
  game.damageRock(rock,50,3900,100,'extract',false);
  assert.deepEqual(xp,[alreadyStudied?STRATEGIC_XP.survey+4:18],
   alreadyStudied?'the old save earns its first new geological bonus':
    'a new pilot earns the original first-rich bonus without stacking survey XP');
  assert.equal(pilot.strategicXp.surveys.length,1);
  game.damageRock(rock,50,3900,100,'extract',false);
  assert.equal(xp.length,1,'the same depleted rock cannot grant another reward');
 }
});
test('previous beam damage cannot turn full-yield extraction into near-silent farming',()=>{
 const game=new Harness();
 Object.assign(game,{time:30,miningNoise:0,skillRanks:{mining:1},nearQuietLab:false,
  doctrine:null,advanceContract:()=>{},
  heritage:{vfx:{asteroidBreak:()=>{},asteroidImpact:()=>{}},play:()=>{}},
  addDrop:()=>{}});
 const rock={x:120,y:0,r:30,rich:true,hp:100,maxHp:100,alive:true,vx:0,vy:0};
 game.damageRock(rock,70,0,0,'auto',false);
 assert.equal(game.miningNoise,0);
 game.damageRock(rock,10,0,0,'extract',false);
 assert.ok(Math.abs(game.miningNoise-42*.84*.8)<1e-9,
  'first F contact accounts for damage already dealt to this rock');
 game.damageRock(rock,20,0,0,'extract',false);
 assert.ok(Math.abs(game.miningNoise-42*.84)<1e-9);
});
