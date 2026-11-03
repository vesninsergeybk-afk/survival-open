import test from 'node:test';
import assert from 'node:assert/strict';
import { PrologueTactics } from '../src/prologue-tactics.js';

const robot=(x,y,id='bat')=>({
    x,y,id,hp:30,maxHp:30,speed:85,
    type:{firingRange:300},ranged:id==='sniper'
});

function scene(){
    const world={
        visible:true,
        clearLineOfFire(){return this.visible;}
    };
    const tactics=new PrologueTactics(world);
    const scout=robot(0,0,'sniper'),mate=robot(140,0),
        distant=robot(1100,0);
    const game={
        gameTime:1,
        player:{x:90,y:0,vx:15,vy:0},
        enemies:[scout,mate,distant],
        enemyIntelligence:{messages:[]},
        _announce(){}
    };
    tactics.onSpawn(scout,'security',0,game);
    tactics.onSpawn(mate,'security',1,game);
    tactics.onSpawn(distant,'security',2,game);
    return {world,tactics,game,scout,mate,distant};
}

test('Only nearby robots receive real contact reports',()=>{
    const {tactics,game,scout,mate,distant}=scene();
    tactics.update(.42,game);
    assert.equal(mate.prologueAI.known.x,90);
    assert.equal(distant.prologueAI.known,null);
    assert.equal(game.enemyIntelligence.messages.length,1);
    assert.equal(game.enemyIntelligence.messages[0].receivers,1);
    assert.ok(tactics.canFire(scout,game));
});

test('Patrols cannot shoot through doors and forget stale reports',()=>{
    const {world,tactics,game,scout,mate}=scene();
    tactics.update(.42,game);
    world.visible=false;
    game.gameTime+=1;
    assert.equal(tactics.canFire(scout,game),false);
    assert.notEqual(tactics.targetFor(mate,game.player,game),game.player);
    game.gameTime+=6;
    tactics.update(.42,game);
    assert.notEqual(tactics.targetFor(mate,game.player,game).x,90);
});

test('Role steering is bounded and leaves the scripted siege intact',()=>{
    const {tactics,game,mate}=scene();
    tactics.update(.42,game);
    const vector=tactics.steering(mate,game,75,0);
    assert.ok(Number.isFinite(vector.vx));
    assert.ok(Number.isFinite(vector.vy));
    const siege=robot(500,300,'gunship');
    tactics.onSpawn(siege,'siege',0,game);
    assert.equal(tactics.targetFor(siege,game.player,game),game.player);
    assert.deepEqual(tactics.steering(siege,game,55,-20),{vx:55,vy:-20});
});
