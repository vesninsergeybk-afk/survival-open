import test from 'node:test';
import assert from 'node:assert/strict';
import {createContours,autoConnectContours,contourFields} from '../territory-system.js';
import {registerContourTrials} from '../contour-trials.js';
import {updateContourTrials,activateContourVortex,activeTrialCore,siegeApproachPosition} from '../contour-trial-director.js';
import {ENEMY_AWARENESS,updateEnemyAwareness} from '../enemy-awareness.js';
import {ATTACK_ALARM,alertFleetUnderFire} from '../enemy-attack-alarm.js';
import {SpatialGrid} from '../balance.js';
import {game as fixture} from './weapons-scene.mjs';

const station=(id,x,y)=>({id,x,y,active:true,enemy:false,suppressed:false,type:'dock'});
function overlappingFields(){
 const points=[['A',0,0],['B',1400,0],['C',0,1400],['D',1400,1400]];
 const world={stations:new Map(points.map(([id,x,y])=>[id,station(id,x,y)])),contours:createContours()};
 autoConnectContours(world);
 const fields=contourFields(world);
 assert.equal(fields.length,2,'the fourth station simultaneously closes two fields');
 const entries=registerContourTrials(world,[],fields,1000000);
 assert.equal(entries.length,2);
 return {world,entries};
}
function stage(g,entry){
 g.player.x=entry.x;g.player.y=entry.y;
 updateContourTrials(g,.1);assert.equal(g.contourTrial.entry,entry);
 g.time+=6;updateContourTrials(g,.1);
 assert.equal(g.contourTrial.waveIndex,0);
 for(let wave=0;wave<3;wave++){
  const enemies=g.enemies.filter(e=>e.trialId===entry.id&&e.hp>0);
  assert.ok(enemies.length>=12,'the player must see an actual fleet');
  for(const e of enemies)e.hp=0;
  g.time+=8;updateContourTrials(g,.1);
  if(wave<2){g.time+=5;updateContourTrials(g,.1);}
 }
 assert.equal(g.contourTrial.quotaReached,true);
}

test('one station can create two cores, but each requires its own held E during a live final siege',()=>{
 const {world,entries}=overlappingFields();
 const g=fixture();Object.assign(g,{world,time:20,contourTrial:null,operation:null,zones:[],enemies:[]});
 g.camera=()=>({x:g.player.x-3000,y:g.player.y-3000,w:6000,h:6000});
 stage(g,entries[0]);
 assert.ok(activeTrialCore(g,entries[0]));
 assert.equal(activeTrialCore(g,entries[1]),false);
 assert.equal(activateContourVortex(g,entries[0]),false,'no automatic activation');
 g.actionHeld={kind:'vortex',target:entries[0],progress:10};
 assert.equal(activateContourVortex(g,entries[0]),false,'ten seconds are not enough');
 g.actionHeld.progress=17.99;
 assert.equal(activateContourVortex(g,entries[0]),false,'a rounded display cannot grant victory early');
 g.actionHeld.progress=18;
 assert.equal(activateContourVortex(g,entries[1]),false,'the neighbouring core cannot steal the charge');
 assert.equal(activateContourVortex(g,entries[0]),true);
 assert.equal(world.contours.trials.completed,1);
 assert.equal(entries[1].status,'pending');
 assert.equal(g.contourTrial,null);
 g.actionHeld=null;
 stage(g,entries[1]);
 assert.equal(activateContourVortex(g,entries[1]),false,'the second core needs another hold');
 g.actionHeld={kind:'vortex',target:entries[1],progress:18};
 assert.equal(activateContourVortex(g,entries[1]),true);
 assert.equal(world.contours.trials.completed,2);
 assert.equal(activateContourVortex(g,entries[1]),false,'payout cannot be repeated');
});

test('large flight zoom never pushes siege reinforcements to the remote camera edge',()=>{
 const core={x:1200,y:-2800};
 const approaches=[];
 for(let flank=0;flank<4;flank++)for(let group=0;group<5;group++)
  approaches.push(siegeApproachPosition(core,flank,.4,group,2));
 assert.ok(approaches.every(ship=>{
  const d=Math.hypot(ship.x-core.x,ship.y-core.y);
  return d>=620&&d<=1000;
 }),'all four flanks must arrive near the defended territory at every zoom');
});

test('the actual E interaction selects the active siege core before an overlapping asteroid',()=>{
 const {world,entries}=overlappingFields(),g=fixture(),entry=entries[0];
 g.world=world;g.player.x=entry.x;g.player.y=entry.y;
 g.mining.target={x:entry.x,y:entry.y,r:36,hp:90,alive:true};
 g.contourTrial={entry,phase:'wave',waveIndex:2,plan:{waves:[{},{},{}]}};
 const focus=g.currentInteraction();
 assert.equal(focus?.kind,'vortex');assert.equal(focus.target,entry);
 assert.equal(g.beginInteraction('keyboard'),true);
 assert.equal(g.actionHeld?.kind,'vortex');
 assert.equal(g.actionHeld?.target,entry);
});

test('a distant hit alerts visible wingmates with an uncertain sector and obeys radio blackout',()=>{
 const victim={serial:1,type:'fighter',x:450,y:20,hp:42,r:14};
 const wing={serial:2,type:'scout',x:520,y:30,hp:38,r:14};
 const isolated={serial:3,type:'fighter',x:1600,y:20,hp:80,r:14};
 const grid=new SpatialGrid(110);for(const ship of [victim,wing,isolated])grid.insert(ship);
 const game={time:4,grid,enemyCanSee:()=>false,enemyComms:{send:()=>true}};
 const estimate={x:70,y:-60,estimated:true};
 assert.equal(alertFleetUnderFire(game,victim,estimate),1);
 assert.deepEqual({x:wing._awarenessDispatch.x,y:wing._awarenessDispatch.y},{x:70,y:-60});
 assert.equal(wing._commsIncident.kind,'under-fire');
 assert.equal(isolated._awarenessDispatch,undefined);
 assert.equal(alertFleetUnderFire(game,victim,estimate),0,'per-burst radio alarms are throttled');
 game.time+=ATTACK_ALARM.repeatSeconds+.01;
 game.enemyComms.send=()=>false;
 assert.equal(alertFleetUnderFire(game,victim,estimate),0,'no witness and jammed radio give no telepathy');
 game.enemyCanSee=()=>true;
 assert.equal(alertFleetUnderFire(game,victim,estimate),1,'actual line of sight still warns a witness');
});

test('visibility at starting weapon range has a safety margin, with actual cover still decisive',()=>{
 const player={x:0,y:0,vx:0,vy:0,hp:110};
 const scout={serial:3,type:'scout',x:450,y:0,hp:38};
 const scene={time:1,player,enemyCanSee:()=>true};
 assert.ok(ENEMY_AWARENESS.directRange>365);
 updateEnemyAwareness(scout,scene);
 scene.time=1.2;
 updateEnemyAwareness(scout,scene);
 assert.equal(scout._awarenessLast?.x,0,'a patrol can notice the attacker before starter plasma reaches it');
 scene.enemyCanSee=()=>false;scene.time=5;
 updateEnemyAwareness(scout,scene);
 assert.ok(scout._awarenessLast.at<5,'asteroid occlusion does not create a new sighting');
});
