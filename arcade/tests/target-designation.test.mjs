import test from 'node:test';
import assert from 'node:assert/strict';
import {pickDesignatedTarget,activeDesignatedTarget} from '../target-designation.js';
import {selectTargets} from '../combat-targets.js';
import {planTargetArea,TARGET_AREA} from '../target-area.js';

function scene(){
 const closer={x:80,y:0,hp:40,r:14,type:'scout'};
 const farther={x:200,y:45,hp:70,r:14,type:'fighter'};
 const enemies=[closer,farther];
 const game={time:1,player:{x:0,y:0},enemies,
   grid:{query(x,y,r){return enemies.filter(e=>Math.hypot(e.x-x,e.y-y)<=r);}},
   rockGrid:{query:()=>[]},world:{regionalSupply:{convoys:[]},nearbyStations:()=>[]},
   enemyBasesUnlocked:()=>true};
 return {game,closer,farther};
}

test('a click on a confirmed enemy changes auto-aim preference without boosting range',()=>{
 const {game,closer,farther}=scene();
 assert.equal(selectTargets(game,260)[0].target,closer);
 const chosen=pickDesignatedTarget(game,{x:farther.x+8,y:farther.y-4});
 assert.equal(chosen.target,farther);
 game.designatedTarget={target:chosen.target,expiresAt:game.time+14};
 assert.equal(selectTargets(game,260)[0].target,farther);
 assert.equal(selectTargets(game,100)[0].target,closer,
  'a target marker must not extend a short-range weapon');
 game.time=16;
 assert.equal(selectTargets(game,260)[0].target,closer);
 assert.equal(activeDesignatedTarget(game),null);
});

test('hidden patrols, solid rocks and distant offscreen ships cannot be marked',()=>{
 const {game,farther}=scene();
 farther.signalIntel={mode:'investigate'};
 assert.equal(pickDesignatedTarget(game,{x:farther.x,y:farther.y}),null);
 farther.signalIntel=null;
 game.rockGrid.query=()=>[{x:100,y:22,r:42,alive:true}];
 assert.equal(pickDesignatedTarget(game,{x:farther.x,y:farther.y}),null);
 game.rockGrid.query=()=>[];
 farther.x=1200;
 assert.equal(pickDesignatedTarget(game,{x:farther.x,y:farther.y}),null);
});

test('a dead or converted marked enemy immediately loses priority',()=>{
 const {game,closer,farther}=scene();
 game.designatedTarget={target:farther,expiresAt:100};
 farther.converted=true;
 assert.equal(activeDesignatedTarget(game),null);
 assert.equal(selectTargets(game,260)[0].target,closer);
 farther.converted=false;farther.hp=0;
 assert.equal(activeDesignatedTarget(game),null);
});

test('a click near a moving pack marks a wide sector without needing to hit a tiny hull',()=>{
 const {game,closer,farther}=scene();
 const point={x:280,y:60};
 assert.equal(pickDesignatedTarget(game,point),null,'the old pinpoint click would miss');
 const plan=planTargetArea(game,point);
 assert.equal(plan.ok,true);
 assert.equal(plan.focus.target,farther);
 assert.equal(plan.area.radius,TARGET_AREA.radius);
 game.targetField=plan.area;
 assert.equal(selectTargets(game,260)[0].target,farther,
  'automatic guns should prefer enemies inside the painted sector');
 assert.equal(selectTargets(game,100)[0].target,closer,
  'painting a sector must never give short-range guns extra reach');
 game.time=plan.area.expiresAt+1;
 assert.equal(selectTargets(game,260)[0].target,closer,
  'the temporary sector must expire rather than permanently controlling fire');
});

test('painted sector automatically changes targets after its first enemy dies',()=>{
 const {game,closer,farther}=scene();
 const zone=planTargetArea(game,{x:260,y:35});game.targetField=zone.area;
 game.designatedTarget={target:farther,expiresAt:game.time+14};
 assert.equal(selectTargets(game,300)[0].target,farther);
 const next={x:235,y:95,hp:60,r:14,type:'scout'};
 game.enemies.push(next);farther.hp=0;
 assert.equal(selectTargets(game,300)[0].target,next,
  'the area should not become useless when the initially designated ship dies');
});

test('area designation obeys maximum distance, sensors, cover and worker protections',()=>{
 const {game,farther}=scene();
 assert.equal(planTargetArea(game,{x:950,y:0}).ok,false);
 farther.signalIntel={mode:'investigate'};
 const hidden=planTargetArea(game,{x:farther.x,y:farther.y});
 assert.equal(hidden.focus?.target===farther,false);
 farther.signalIntel=null;
 game.rockGrid.query=()=>[{x:100,y:22,r:42,alive:true}];
 assert.equal(planTargetArea(game,{x:farther.x,y:farther.y}).focus?.target===farther,false);
 game.rockGrid.query=()=>[];
 const worker={x:320,y:0,hp:80,r:16,centralWorker:true,type:'scout'};
 game.world.regionalSupply.central={worker};
 game.world.stations=new Map([['industry:source',{enemy:true}]]);
 assert.equal(planTargetArea(game,{x:worker.x,y:worker.y}).focus?.target===worker,false,
  'an area click must not silently authorize attacks on protected industrial workers');
});
