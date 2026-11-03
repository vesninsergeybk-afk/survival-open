import test from 'node:test';
import assert from 'node:assert/strict';
import {extractorStats,rockYield,MINING_NOISE,miningSignal,extractionNoise,extractionNoiseDelta} from '../mining.js';
import {World} from '../world.js';
import {contractFor} from '../base-panel.js';
test('incidental beams and meteor blasts cannot earn mining bonuses',()=>{
 assert.equal(rockYield({rich:false},'auto',{mining:4,extractor:3}),1);
 assert.equal(rockYield({rich:true},'auto',{mining:4,extractor:3}),2);
 assert.equal(rockYield({rich:false},'strike'),2);
});
test('deliberate F extraction has a measurable duration and bounded growth',()=>{
 const early=extractorStats(0,0),late=extractorStats(3,4);
 const hp=30+34*.65;
 assert.ok(hp/early.damagePerSecond>1.8);
 assert.ok(hp*1.35/early.damagePerSecond>2.5);
 assert.ok(late.damagePerSecond<early.damagePerSecond*2.2);
 assert.equal(rockYield({rich:false},'extract'),4);
 assert.equal(rockYield({rich:true},'extract'),9);
 assert.equal(rockYield({rich:false},'extract',{mining:4,extractor:3,doctrine:'prospect'}),9);
});
test('mineral-rich asteroids are more durable',()=>{
 const rocks=new World(20261102).nearbyRocks(250,300,1800);
 assert.ok(rocks.length>8);
 assert.ok(rocks.some(r=>r.rich));
 for(const r of rocks)assert.ok(Math.abs(r.hp/(30+r.r*.65)-(r.rich?1.35:1))<1e-9);
});
test('station contracts have unique objectives and bounded payouts',()=>{
 assert.equal(contractFor('dock').goal,4);
 assert.equal(contractFor('lab').kind,'rich');
 assert.equal(contractFor('lab').goal,2);
 assert.equal(contractFor('arsenal').kind,'defend');
 assert.equal(contractFor('carrier').kind,'intercept');
 assert.equal(contractFor('carrier').goal,5);
 assert.ok(contractFor('carrier').ore<80);
});

test('extraction noise is legible, bounded and louder for rich ore',()=>{
 assert.ok(MINING_NOISE.rich>MINING_NOISE.ordinary*1.4);
 assert.equal(miningSignal(0),0);
 assert.equal(miningSignal(MINING_NOISE.patrol),100);
 assert.equal(miningSignal(MINING_NOISE.patrol*2),100);
 assert.equal(miningSignal(-100),0);
 assert.ok(MINING_NOISE.warn<MINING_NOISE.patrol);
 assert.ok(MINING_NOISE.firstPatrolAt>9);
 // Two rich stones make a near-alert, the next mining decision matters.
 const afterTwo=MINING_NOISE.rich*2-MINING_NOISE.decay*5;
 assert.ok(afterTwo>=MINING_NOISE.warn&&afterTwo<MINING_NOISE.patrol);
 assert.ok(afterTwo+MINING_NOISE.ordinary>=MINING_NOISE.patrol);
});

test('one geology rank enables a quieter early mining decision without granting extra ore',()=>{
 const ordinary={rich:false},rich={rich:true};
 assert.equal(extractionNoise(ordinary),27);
 assert.equal(extractionNoise(rich),42);
 assert.equal(extractionNoise(rich,1),42*.84);
 assert.equal(extractionNoise(rich,4),42*.84,
  'higher geology ranks do not silently add a second noise bonus');
 assert.ok(extractionNoise(rich,1)*2<MINING_NOISE.patrol,
  'two rich rocks now stay below the full-alert threshold before natural decay');
 assert.ok(extractionNoise(rich,1)*3>=MINING_NOISE.patrol,
  'quieter extraction is not an unlimited stealth exploit');
 assert.equal(extractionNoise(rich,1,true),42*.84*.68);
 assert.equal(rockYield(rich,'extract',{mining:0}),
  rockYield(rich,'extract',{mining:1}),
  'the first geology rank must not grant a yield increase');
});

test('mining noise climbs smoothly with damage and charges only once per rock',()=>{
 const rock={rich:true,maxHp:100,hp:100};
 rock.hp=75;assert.ok(Math.abs(extractionNoiseDelta(rock)-10.5)<1e-9);
 rock.hp=50;assert.ok(Math.abs(extractionNoiseDelta(rock)-10.5)<1e-9);
 assert.equal(extractionNoiseDelta(rock),0,'pausing cannot charge noise twice');
 rock.hp=0;assert.ok(Math.abs(extractionNoiseDelta(rock)-21)<1e-9);
 assert.equal(extractionNoiseDelta(rock),0);
 const quiet={rich:true,maxHp:100,hp:50};
 assert.ok(Math.abs(extractionNoiseDelta(quiet,1,true)-42*.84*.68*.5)<1e-9);
});
