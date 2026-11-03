import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  SPAC1_WAKE_FRAMES,SPAC1_WAKE_SECONDS,SPAC1_MANIFEST,
  spac1WakeFrameRef
} from '../src/spac1-sprites.js';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
assert.equal(SPAC1_WAKE_FRAMES,24);
assert.equal(SPAC1_WAKE_SECONDS,.96);
assert.equal(SPAC1_MANIFEST.awakening,96);
const named=new Map([[0,'Front'],[2,'Left'],[4,'Back'],[6,'Right']]);
for(const [dir,view] of named){
  const seen=new Set();
  for(let i=0;i<SPAC1_WAKE_FRAMES;i++){
    const ref=spac1WakeFrameRef(dir,i);
    assert.equal(ref.key,`wake${view}${i<12?'A':'B'}`);
    assert.ok(ref.col>=0&&ref.col<4&&ref.row>=0&&ref.row<3);
    const label=`${ref.key}:${ref.col}:${ref.row}`;
    assert.ok(!seen.has(label),'duplicate frame '+label);
    seen.add(label);
  }
  assert.equal(seen.size,24);
  for(const suffix of ['a','b']){
    const file=join(root,'assets/prologue/spac1',`spac1_wake_${view.toLowerCase()}_${suffix}.webp`);
    const bytes=readFileSync(file);
    assert.equal(bytes.toString('ascii',0,4),'RIFF',file);
    assert.equal(bytes.toString('ascii',8,12),'WEBP',file);
    assert.ok(statSync(file).size<600000,file+' must be optimized');
  }
}
assert.equal(spac1WakeFrameRef(7,23).key,'wakeFrontB');
assert.equal(spac1WakeFrameRef(0,999).col,3);
assert.equal(spac1WakeFrameRef(0,999).row,2);

const {PrologueMissionWorld:Mission}=await import('../src/prologue-mission.js');
const enemyTypes=Object.fromEntries(['SNIPER','BAT','STALKER','ZOMBIE','GOLEM','GUNSHIP']
 .map(id=>[id,{id,hp:30,speed:90,size:14}]));
const game={player:{x:0,y:0,heal(){}},friendlyBases:{bases:[]},enemies:[],
  gameTime:100,_announce(){},worldVfx:{nova(){}},_computeDifficultyMults(){return {hpMult:1,dmgMult:1};}};
const world=new Mission(game);
assert.equal(world.spac1Spots.length,12,'three initial, six reinforcements, three observatory robots');
assert.equal(world.spac1Spots.every(s=>!s.queued&&!s.active),true);
world.enterPhase(game,1);
assert.equal(world.waves.security,3,'three robots scheduled');
assert.equal(game.enemies.length,0,'none immediately alive');
assert.equal(world.alive(game,'security'),true,'waking robots prevent premature clearance');
const security=world.spac1Spots.filter(s=>s.group==='security');
assert.deepEqual(security.map(s=>Number((s.wakeAt-100).toFixed(2))),[0,.45,.9]);
game.gameTime=100.95;world._updateSpac1Wake(game);
assert.equal(game.enemies.length,0,'first activation not finished');
game.gameTime=100.96;world._updateSpac1Wake(game);
assert.equal(game.enemies.length,1,'first robot activates');
game.gameTime=101.40;world._updateSpac1Wake(game);
assert.equal(game.enemies.length,1,'second robot waits');
game.gameTime=101.42;world._updateSpac1Wake(game);
assert.equal(game.enemies.length,2,'second robot activates');
game.gameTime=101.87;world._updateSpac1Wake(game);
assert.equal(game.enemies.length,3,'third robot activates');
assert.equal(game.enemies[0].visualAngle,-Math.PI/2,'first active pose keeps the left view');
world._updateSpac1Wake(game);
assert.equal(game.enemies.length,3,'no duplicate spawn on another frame');
assert.equal(security.every(s=>s.active&&s.spawnDef===null),true);
game.enemies.forEach(e=>e.hp=0);
assert.equal(world.alive(game,'security'),false);
const later=enemyTypes.STALKER;
for(let i=0;i<6;i++)world.spawn(game,'reinforcement',[[1800,0]],i,6,later,26,95);
assert.equal(world.waves.reinforcement,6);
assert.equal(world.alive(game,'reinforcement'),true);
assert.equal(game.enemies.length,3,'scheduled reinforcements are not visible enemies');
game.gameTime=107.42;world._updateSpac1Wake(game);
assert.equal(game.enemies.filter(e=>e.prologueGroup==='reinforcement').length,6);
world._updateSpac1Wake(game);
assert.equal(game.enemies.filter(e=>e.prologueGroup==='reinforcement').length,6,
  'reinforcements must spawn exactly once');
for(let i=0;i<3;i++)world.spawn(game,'observatory',[[1800,0]],i,3,later,28,94);
assert.equal(world.waves.observatory,3);
game.gameTime=113.50;world._updateSpac1Wake(game);
assert.equal(game.enemies.filter(e=>e.prologueGroup==='observatory').length,3);
console.log('PASS: 96 frames mapped, WebP headers valid, three dormant robots wake once in order.');

