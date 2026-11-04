import test from 'node:test';
import assert from 'node:assert/strict';
import {pickDesignatedTarget,activeDesignatedTarget} from '../target-designation.js';
import {selectTargets} from '../combat-targets.js';

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
