import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
const ambush=await import('data:text/javascript,'+
    encodeURIComponent(read('mission-ambush.js')));
const sceneCode=read('mission-layouts.js').replace(/\bexport /g,'');
const sceneFactory=new Function(sceneCode+'\nreturn {getMissionScene,makeMissionAsteroids}');
const scenes=sceneFactory();
const source=read('mission-world.js').replace(/^import .*?;\n/gm,'')
    .replace(/\bexport /g,'');
const nop=()=>{};
class Enemy {
    constructor(x,y){this.x=x;this.y=y;this.hp=100;this.maxHp=100;this.attackClock=0;}
}
class MissionLog {
    constructor(game){this.game=game;this.entries=[];}
    reset(world){this.world=world;}
    note(title,description,objective,show){
        this.entries.push({title,description,objective,show});}
    open(){}
}
globalThis.document={getElementById:()=>null};
const factory=new Function('GameState','damageWorldObstacles','BOSSES',
    'ENEMIES','Enemy','MISSION_PROFILES','isMissionUnlocked',
    'readCampaign','getMissionScene','makeMissionAsteroids',
    'drawMissionBackdrop','drawMissionForeground','MissionLog',
    'createConvoyTrap','advanceConvoyTrap','progressCaption','CONVOY_TRAP',
    source+'\nreturn MissionWorld');
const MissionWorld=factory({PLAYING:'playing'},nop,{HUNTER:{}},
    {STALKER:{},GUNSHIP:{},MAGE:{}},Enemy,[],nop,nop,
    scenes.getMissionScene,()=>[],nop,nop,MissionLog,
    ambush.createConvoyTrap,ambush.advanceConvoyTrap,
    ambush.progressCaption,ambush.CONVOY_TRAP);
const events=[];
const game={
    player:{x:12000,y:8000,level:6,hp:110,gained:0,
        gainExp(n){this.gained+=n;},takeDamage(n){this.hp-=n;}},
    state:'playing',gameTime:1,worldObstacles:[],enemies:[],
    friendlyBases:{bases:[{id:'home',type:'dock',x:12000,y:8000,
        turrets:[],development:{}}],credits:90,
        addCredits(n){this.credits+=n;}},
    worldVfx:{nova:nop,boostCollect:nop},createParticles:nop,
    createFloatingText:nop,_announce:m=>events.push(m),
    gameOver:()=>{throw Error('Unexpected game over');}
};
const world=new MissionWorld(game,4);world.enter(game);
game.friendlyBases.bases.forEach(b=>b.activated=true);
const p=world.route[2];
game.player.x=p.x;game.player.y=p.y;
world.convoy.x=p.x-2;world.convoy.y=p.y-2;
world.convoy.leg=2;world.convoy.phase='moving';
world._updateConvoy(game,.04);
assert.equal(world.convoy.leg,3);
assert.equal(world.trap.phase,'impact');
assert.equal(world.canInteract(game),null,'Gate stays closed by the trap');
world._updateConvoyAmbush(game,6.3);
assert.equal(world.trap.phase,'salvage');
assert.ok(world.log.entries.some(e=>e.show),'The change is acknowledged');
for(let i=0;i<1680;i++){
    game.gameTime+=.05;world._updateConvoyAmbush(game,.05);
}
assert.equal(world.trap.cleared,true);
assert.equal(world.convoy.phase,'exit');
assert.ok(game.player.gained>=95);
assert.equal(world.canInteract(game)?.type,'gate');
assert.equal(world.interact(game),true);
assert.equal(world.exitOnline,true);
assert.ok(game.friendlyBases.credits>90);
// Check every scripted roadblock is on its actual stage's route segment.
const scene4=scenes.getMissionScene(4),rocks=scenes.makeMissionAsteroids(4,0,0);
const points=[scene4.convoyStart,...scene4.route];
for(let stage=1;stage<=3;stage++){
    const blocks=rocks.filter(r=>r.missionRoadblock===stage);
    assert.equal(blocks.length,2);
    const a=points[stage-1],b=points[stage];
    for(const rock of blocks){
        const dx=b.dx-a.dx,dy=b.dy-a.dy;
        const t=Math.max(0,Math.min(1,((rock.x-a.dx)*dx+
            (rock.y-a.dy)*dy)/(dx*dx+dy*dy)));
        const distance=Math.hypot(rock.x-a.dx-t*dx,rock.y-a.dy-t*dy);
        assert.ok(distance<95,'The roadblock must be on the caravan route');
    }
}
console.log('Campaign: convoy ambush, gate, objectives and route geometry passed');
