/**
 * Fleet pacing, scripted mission rosters and bounded carrier support.
 * Run: node --test site/games/survivor/tests/fleet-gameplay.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
const bare=src=>src.replace(/^\s*import\s+[\s\S]*?\s+from\s+['"][^'"]+['"]\s*;\s*/gm,'')
    .replace(/^\s*export\s+/gm,'');
const { ENEMIES,BOSSES }=new Function(bare(read('data.js'))+';return {ENEMIES,BOSSES};')();
const { FLEET_GATES,eligibleEnemyPool,missionAmbientPool,NORMAL_BOSS_RECOVERY_SECONDS }=
    new Function(bare(read('enemy-fleet.js'))+
        ';return {FLEET_GATES,eligibleEnemyPool,missionAmbientPool,NORMAL_BOSS_RECOVERY_SECONDS};')();
const { WaveDirector }=new Function(bare(read('wave-director.js'))+
    ';return {WaveDirector};')();
const CONFIG={ MAX_ENEMIES:300,SPAWN_RADIUS:900,DESPAWN_RADIUS:1200 };
const findEnemyDef=id=>Object.values(ENEMIES).find(x=>x.id===id)||null;
const enemySrc=read('entities.js'),mainSrc=read('main.js');
const enemySegment=enemySrc.slice(enemySrc.indexOf('export class Enemy {'),
    enemySrc.indexOf('export class EnemyProjectile')).replace(/^export /gm,'');
const Enemy=new Function('CONFIG','findEnemyDef','EnemyProjectile',
    enemySegment+';return Enemy;')(CONFIG,findEnemyDef,class {});
const method=(name,next,dependencies)=>{
    const start=mainSrc.indexOf('    '+name+'(');
    const end=mainSrc.indexOf('    '+next+'(',start);
    assert.ok(start>=0 && end>start,name+' is present');
    return new Function(...Object.keys(dependencies),
        'return ({'+mainSrc.slice(start,end)+'}).'+name+';')(
        ...Object.values(dependencies));
};
const pickWeighted=pool=>pool[0];
const spawnOne=method('_spawnOne','_spawnBoss',
    {CONFIG,ENEMIES,Enemy,findEnemyDef,pickWeighted,eligibleEnemyPool});
const spawnLogic=method('_spawnLogic','_spawnOne',
    {BOSSES,NORMAL_BOSS_RECOVERY_SECONDS});
const updateEnemies=method('_updateEnemies','_onEnemyKilled',
    {CONFIG,nudgeWorldObstaclesFromShip:()=>{}});

test('every random enemy has a defined entry gate; support drones are excluded',()=>{
    assert.deepEqual(Object.keys(FLEET_GATES).sort(),
        Object.values(ENEMIES).map(x=>x.id).sort());
    assert.equal(FLEET_GATES.slimeling.seconds,Infinity);
    for(const [id,g] of Object.entries(FLEET_GATES)){
        assert.ok(g.seconds>=0,id+' time');
        assert.ok(g.level>=1,id+' pilot level');
    }
});
test('boss wave list is chronological, with a single 10-minute tundra flagship',()=>{
    const getBossesFor=new Function('BOSSES','WAVES',
        bare(read('stages.js'))+';return getBossesFor;')(BOSSES,[]);
    const base=getBossesFor('forest'),cold=getBossesFor('tundra'),
        crypt=getBossesFor('crypt');
    assert.deepEqual(base.map(x=>x.spawnAt),
        [...base.map(x=>x.spawnAt)].sort((a,b)=>a-b));
    assert.ok(crypt.find(x=>x.id==='reaper').spawnAt<
        base.find(x=>x.id==='reaper').spawnAt);
    assert.ok(cold.some(x=>x.id==='ice_queen'&&x.spawnAt===600));
    assert.ok(!cold.some(x=>x.id==='void_lord'));
    assert.ok(base.some(x=>x.id==='void_lord'));
});
test('starter, orbit, elite and crypt-only early ranged introduction',()=>{
    const opening=eligibleEnemyPool(['carrier','golem'],12,1,'forest');
    assert.deepEqual(opening,['bat','bat','bat','zombie']);
    assert.ok(!eligibleEnemyPool(['gunship','sniper'],160,3).includes('gunship'));
    assert.deepEqual(eligibleEnemyPool(['carrier'],300,3),['bat','zombie','skeleton']);
    assert.deepEqual(eligibleEnemyPool(['carrier'],300,6),['carrier']);
    assert.ok(eligibleEnemyPool(['mage'],35,1,'crypt').includes('mage'));
    assert.ok(!eligibleEnemyPool(['mage'],35,1,'forest').includes('mage'));
    assert.ok(eligibleEnemyPool(['stalker'],80,2,'forest').includes('stalker'));
    assert.ok(!eligibleEnemyPool(['stalker'],80,1,'forest').includes('stalker'));
});
test('campaign ambient contacts begin simply, authored ambushes stay separate',()=>{
    assert.deepEqual(missionAmbientPool(2,1),['zombie','stalker']);
    assert.deepEqual(missionAmbientPool(3,1),['stalker','mage']);
    assert.deepEqual(missionAmbientPool(4,1),['stalker','mage']);
    assert.ok(missionAmbientPool(2,5).includes('golem'));
    assert.ok(missionAmbientPool(3,3).includes('gunship'));
    assert.ok(missionAmbientPool(4,3).includes('gunship'));
    assert.ok(read('mission-world.js').includes('missionAmbientPool(this.index'));
});
test('mission enemy pool is authored; free-roam levels filter heavy hulls',()=>{
    const make=(mission,level)=>({gameTime:320,stageId:'forest',
        missionWorld:mission?{}:null,player:{x:0,y:0,level},
        enemies:[],speedrunMode:false,dailyMode:false,replayActive:false});
    const authored=make(true,1);
    spawnOne.call(authored,['golem'],1,1,0);
    assert.equal(authored.enemies[0].id,'golem');
    const explorer=make(false,1);
    spawnOne.call(explorer,['golem'],1,1,0);
    assert.notEqual(explorer.enemies[0].id,'golem');
    const equipped=make(false,5);
    spawnOne.call(equipped,['golem'],1,1,0);
    assert.equal(equipped.enemies[0].id,'golem');
});
test('two overdue bosses cannot arrive together; recovery window is respected',()=>{
    assert.ok(NORMAL_BOSS_RECOVERY_SECONDS>=60);
    const game={gameTime:450,player:{level:1},enemies:[],
        currentWave:{pool:['bat'],spawnMult:1},
        waveDirector:{step:()=>({spawn:false,cap:5,angle:0}),inRespite:false},
        friendlyBases:{enabled:true,technologyTier:0},
        _nextAmbush:Infinity,stageBosses:[BOSSES.HUNTER,BOSSES.REAPER],
        _bossReadyAt:new Map(),_bossWarnedAt:new Set(),_bossesSpawned:new Set(),
        speedrunMode:false,dailyMode:false,replayActive:false,
        audio:{bossWarn(){},setMusicState(){}},_announce(){},
        _spawnBoss(b){this.enemies.push({id:b.id,boss:true,hp:b.hp});}
    };
    spawnLogic.call(game,.016,1,1,1);
    assert.equal(game.enemies.length,1);
    assert.equal(game.enemies[0].id,'hunter');
    game.gameTime=460;
    spawnLogic.call(game,.016,1,1,1);
    assert.equal(game.enemies.length,1);
    game.enemies[0].hp=0;
    game.gameTime=500;
    spawnLogic.call(game,.016,1,1,1);
    assert.equal(game.enemies.length,1,'pilot receives recovery time');
    game.gameTime=450+NORMAL_BOSS_RECOVERY_SECONDS+1;
    spawnLogic.call(game,.016,1,1,1);
    assert.equal(game.enemies.length,2);
    assert.equal(game.enemies[1].id,'reaper');
});
test('carrier children use scout HP and cannot exceed available encounter slots',()=>{
    const carrier=new Enemy(0,0,ENEMIES.CARRIER,1,1);
    carrier.cloneTimer=0;
    const game={gameTime:280,player:{x:900,y:900,vx:0,vy:0},
        enemies:[carrier,...Array.from({length:5},()=>({hp:1}))],
        waveDirector:{maxEnemies:5},enemyDmgMult:1,mines:[],
        createParticles(){},enemyProjectiles:[]};
    carrier.update(.1,game);
    assert.equal(game.enemies.length,7,'one free slot beyond the safe cap');
    const scout=game.enemies.at(-1);
    assert.equal(scout.id,'bat');
    assert.ok(scout.hp>=8&&scout.hp<30,'scout HP does not inherit carrier armor');
    assert.equal(scout.color,'#93d8ff','carrier scouts read as blue wingmen');
});
test('bomber detonation gives no second collision or kill reward',()=>{
    const bomber=new Enemy(0,0,ENEMIES.BOMBER,1,1);
    const hits=[];
    const game={player:{x:0,y:0,size:20,invincible:false,
        takeDamage:amount=>hits.push(amount)},enemies:[bomber],worldObstacles:[],
        friendlyBases:null,missionWorld:null,gameTime:150,
        createFloatingText(){},createParticles(){},shake(){},audio:{explosion(){}},
        _onEnemyKilled(){throw new Error('self-destruction is not a player kill');}};
    bomber.fuseArmed=true;
    bomber.fuseTimer=1.4;
    updateEnemies.call(game,.016,1,1);
    assert.equal(bomber.selfDestructed,true);
    assert.equal(hits.length,1);
    assert.equal(game.enemies.length,0);
});
test('wave director counts living ships without allocating a filtered copy',()=>{
    const director=new WaveDirector();
    const ctx={gameTime:48,kills:0,player:{level:2,hp:100,maxHp:100},
        enemies:[{hp:10},{hp:0}],battleDirector:{zones:[]}};
    const v=director.step(3,ctx);
    assert.ok(v.cap<=9);
    assert.equal(director.maxEnemies,v.cap);
});
