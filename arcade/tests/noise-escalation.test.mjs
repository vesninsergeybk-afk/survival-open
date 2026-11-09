import test from 'node:test';
import assert from 'node:assert/strict';
import {NOISE_ESCALATION,noisePatrolDirector,armNoiseCourier,
 updateNoiseEscalation} from '../noise-escalation.js';
import {MINING_NOISE,drawMiningNoiseRings,updateRockMotion} from '../mining.js';
import {enemyPursuitTarget} from '../enemy-awareness.js';
import {game as fixture} from './weapons-scene.mjs';

const scout=()=>({serial:12,type:'scout',hp:30,x:45,y:12,vx:0,vy:0});
function chase(){
 const enemy=scout(),messages=[];
 const game={time:20,dead:false,paused:false,enemies:[enemy],player:{x:10,y:20},
  notice:s=>messages.push(s),sectorDirector:director=>director,
  spawnGroup(director,source){this.lastCall={director,source};
   this.enemies.push({serial:13,type:'fighter',hp:25});}};
 assert.equal(armNoiseCourier(game,[enemy],{x:0,y:0}),true);
 return {game,enemy,messages};
}

test('one mined ordinary rock can trigger visible escalating patrol pressure',()=>{
 assert.ok(MINING_NOISE.ordinary-MINING_NOISE.decay*2>MINING_NOISE.scout);
 assert.ok(MINING_NOISE.ordinary*.84-MINING_NOISE.decay*2<MINING_NOISE.scout,
  'the first geology rank can avoid a patrol when breaking one ordinary rock');
 const first=noisePatrolDirector({cap:4,groupSize:2,types:['scout']},2);
 assert.equal(first.groupSize,NOISE_ESCALATION.initialWing);
 assert.equal(first.cap,6);
 const next=noisePatrolDirector({cap:6,groupSize:2,types:['scout']},4,true);
 assert.equal(next.groupSize,7);
 assert.equal(next.cap,11);
});

test('scout must spot player and physically escape before another wing arrives',()=>{
 const {game,enemy,messages}=chase();
 updateNoiseEscalation(game);
 assert.equal(game.noiseEscalation.phase,'searching');
 enemy.signalIntel={mode:'engaged',combatFocus:game.player,
  lastSeenEstimated:false,lastSeenX:30,lastSeenY:40};
 updateNoiseEscalation(game);
 assert.equal(game.noiseEscalation.phase,'reporting');
 game.time+=NOISE_ESCALATION.reportDelay+.1;
 updateNoiseEscalation(game);
 assert.equal(game.noiseEscalation.phase,'escaping');
 assert.ok(enemy.missionFlight&&enemy.missionFlight.speed>0);
 const exit=game.noiseEscalation.exit;
 game.time+=3;enemy.x=exit.x;enemy.y=exit.y;
 updateNoiseEscalation(game);
 assert.equal(game.noiseEscalation.phase,'reinforcement');
 assert.equal(game.enemies.includes(enemy),false);
 game.time+=NOISE_ESCALATION.reinforcementDelay+.1;
 updateNoiseEscalation(game);
 assert.equal(game.noiseEscalation,null);
 assert.equal(game.lastCall.director.groupSize,7);
 assert.deepEqual(game.lastCall.source,{x:30,y:40},'reinforcements know only the reported sighting');
 assert.ok(messages.some(s=>s.includes('ПОДКРЕПЛЕНИЕ')));
});

test('destroying an observed courier prevents reinforcements',()=>{
 const {game,enemy,messages}=chase();
 enemy.signalIntel={mode:'engaged',combatFocus:game.player,
  lastSeenEstimated:false,lastSeenX:30,lastSeenY:40};
 updateNoiseEscalation(game);
 enemy.hp=0;game.time+=4;
 updateNoiseEscalation(game);
 assert.equal(game.noiseEscalation,null);
 assert.equal(game.lastCall,undefined);
 assert.ok(messages.some(s=>s.includes('не придёт')));
});

test('blind fire or a rough radio estimate cannot falsely call a scout reinforcement',()=>{
 const {game,enemy}=chase();
 enemy.signalIntel={mode:'engaged',combatFocus:null,lastSeenEstimated:true,
  lastSeenX:30,lastSeenY:40};
 updateNoiseEscalation(game);
 assert.equal(game.noiseEscalation.phase,'searching');
 enemy.signalIntel.combatFocus=game.player;
 enemy.signalIntel.lastSeenEstimated=false;
 updateNoiseEscalation(game);
 assert.equal(game.noiseEscalation.phase,'reporting');
});

test('contour fleet heads to a fixed core until it actually spots the pilot',()=>{
 const core={x:500,y:700},enemy={serial:11,x:0,y:0,trialId:3,
  trialObjective:core,_patrolRoute:null};
 const game={time:100,player:{x:3000,y:-3000},contourTrial:{entry:{id:3}}};
 assert.deepEqual({x:enemyPursuitTarget(enemy,game).x,
  y:enemyPursuitTarget(enemy,game).y},core);
 enemy._enemyLearningSaw=true;
 assert.equal(enemyPursuitTarget(enemy,game),game.player);
 enemy._enemyLearningSaw=false;game.contourTrial=null;
 assert.notDeepEqual({x:enemyPursuitTarget(enemy,game).x,
  y:enemyPursuitTarget(enemy,game).y},core,
 'the objective must not persist after its siege has ended');
});

test('core formation shoves nearby ore without destroying or moving it out of its cell',()=>{
 const g=fixture();
 const rock={x:22,y:15,r:30,originX:22,originY:15,hp:40,maxHp:40,
  alive:true,vx:0,vy:0,spinVelocity:0};
 g.world={nearbyRocks:()=>[rock]};
 g.clearContourCoreRocks({x:0,y:0});
 assert.ok(rock.vx>0&&rock.vy>0);
 for(let i=0;i<90;i++)updateRockMotion(rock,1/60);
 assert.equal(rock.alive,true);
 assert.equal(rock.hp,40);
 assert.ok(Math.hypot(rock.x-22,rock.y-15)<=86.001);
});

test('mining draws successive wavefronts even before a patrol alert',()=>{
 const radii=[];
 const ctx={save(){},restore(){},setLineDash(){},beginPath(){},stroke(){},
  arc(x,y,r){radii.push(r);}};
 drawMiningNoiseRings(ctx,{alive:true,x:0,y:0,r:25},1,false,false);
 assert.equal(radii.length,3);
 assert.ok(new Set(radii.map(Math.round)).size===3);
 const quiet=[];ctx.arc=(x,y,r)=>quiet.push(r);
 drawMiningNoiseRings(ctx,{alive:true,x:0,y:0,r:25},1,true,true);
 assert.equal(quiet.length,1,'reduced motion has one still readable ring');
});
