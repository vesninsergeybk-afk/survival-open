import test from 'node:test';
import assert from 'node:assert/strict';
import {Player,Enemy,Projectile,EnemyProjectile} from '../src/entities.js?v=design-127';
import {Weapon} from '../src/weapons.js?v=design-127';
import {Game} from '../src/main.js';
import {FriendlyBases} from '../src/friendly-bases.js?v=design-127';
import {SpatialHash} from '../src/spatial-hash.js';
import {PrologueMissionWorld} from '../src/prologue-mission.js?v=design-127';
import {TRAINING_PULSE,SIEGE_PLAN,COMMAND_GUARD} from '../src/prologue-design.js?v=design-127';
import {buildSkillTree,skillChoice} from '../src/skill-tree.js?v=design-127';
import {createMissionRules} from '../src/mission-progression.js?v=design-127';
import {WEAPONS,ENEMIES} from '../src/data.js?v=tactics-106';
import {GameState} from '../src/config.js?v=base-87';
const noop=()=>{};
function scene(){
 const game={player:new Player(10000,8000),friendlyBases:new FriendlyBases(),enemies:[],spatial:new SpatialHash(),
  gameTime:0,state:GameState.PLAYING,beams:[],projectiles:[],enemyProjectiles:[],save:{settings:{}},
  _announce:noop,createFloatingText:noop,createParticles:noop,worldObstacles:[],
  worldVfx:{nova:noop,hit:noop,muzzle:noop,boostCollect:noop,playerHurt:noop},
  audio:{playEvent:noop,shoot:noop,hit:noop},_computeDifficultyMults:()=>({hpMult:1,dmgMult:1})};
 const world=game.missionWorld=new PrologueMissionWorld(game);world._hud=noop;world.enter(game);return {game,world};
}
test('Replay unlocks cannot expand the tutorial loadout; exactly four choices remain',()=>{
 const rules=createMissionRules(0,{campaign:{completed:[0,1,2,3,4],blueprints:['magic_wand','knife','orbit']}});
 assert.deepEqual([...rules.allowedWeapons],['starter_pulse']);assert.equal(rules.rankCap,2);
 const p=new Player(0,0);p.weapons=[new Weapon(TRAINING_PULSE)];
 const tree=buildSkillTree(p,{getUpgradeCap:()=>5},rules);
 assert.equal(tree.branches.length,1);assert.equal(tree.available.length,4);
 assert.equal(skillChoice(p,null,'weapon','magic_wand',null,rules),null);
 p.weapons[0].level=2;
 assert.equal(skillChoice(p,null,'weapon','starter_pulse',null,rules),null);
 assert.equal(buildSkillTree(p,null,createMissionRules(1,{})).branches.length,3,'campaign keeps its tree');
});
test('A tutorial milestone grants one choice once; discovery and kills cannot queue XP interruptions',()=>{
 const {game,world}=scene();assert.deepEqual(game.player.gainExp(10000),[]);assert.equal(game.player.level,1);
 world.awardLesson(game,'workshop');world.awardLesson(game,'workshop');world.awardLesson(game,'not-a-lesson');
 assert.equal(game._pendingLevelUps,1);assert.equal(game.player.trainingEarned,1);
 const e=new Enemy(world.cx+2600,world.cy,ENEMIES.ZOMBIE,1,1);game.enemies.push(e);game.player.x=e.x;
 assert.equal(world.trainingSafe(game),false);e.hp=0;assert.equal(world.trainingSafe(game),true);
});
test('Only an earned, available tutorial choice can mutate the loadout',()=>{
 const {game}=scene();Object.assign(game,{activeMission:createMissionRules(0,{}),run:{},ui:{hideLevelUp:noop}});
 game.player.weapons=[new Weapon(TRAINING_PULSE)];game.player.trainingEarned=1;
 Game.prototype._applyUpgrade.call(game,{type:'weapon',data:WEAPONS.MAGIC_WAND});
 assert.equal(game.player.trainingSpent,0);
 Game.prototype._applyUpgrade.call(game,{type:'weapon',data:TRAINING_PULSE});
 assert.equal(game.player.trainingSpent,1);assert.equal(game.player.weapons[0].level,2);
 Game.prototype._applyUpgrade.call(game,{type:'weapon',data:TRAINING_PULSE});
 assert.equal(game.player.trainingSpent,1);assert.equal(game.player.weapons[0].level,2);
});
test('Pulse chooses a visible target instead of a closer target behind cover; range ends at 150/165',()=>{
 const {game}=scene();const p=game.player,w=new Weapon(TRAINING_PULSE);
 p.x=0;p.y=0;p.weapons=[w];
 const hidden=new Enemy(30,0,ENEMIES.ZOMBIE,1,1),visible=new Enemy(0,100,ENEMIES.ZOMBIE,1,1);
 game.spatial.insertEnemies([hidden,visible]);game.missionWorld.clearLineOfFire=(_x,_y,x)=>x===0;
 w._fireProjectile(p,game);assert.equal(game.projectiles.length,1);assert.ok(Math.abs(game.projectiles[0].angle-Math.PI/2)<1e-9);
 game.projectiles.length=0;game.spatial.insertEnemies([new Enemy(0,180,ENEMIES.ZOMBIE,1,1)]);
 w._fireProjectile(p,game);assert.equal(game.projectiles.length,0);
 for(const [rank,range] of [[1,150],[2,165]]){
  w.level=rank;assert.ok(Math.abs(w.getRange(p)-range)<1e-6);
  const bullet=new Projectile(0,0,0,TRAINING_PULSE,14,rank,p);bullet.update(1,game);
  assert.ok(Math.abs(bullet.x-range)<1e-6);assert.ok(bullet.rangeEnded);
 }
 const regular=new Player(0,0);assert.equal(new Weapon(WEAPONS.MAGIC_WAND).getRange(regular),320);
});
test('Station cover stops both friendly and hostile projectiles before damage',()=>{
 const {game}=scene();const w=game.missionWorld;
 const x=w.cx+1240,y=w.cy;const def={...TRAINING_PULSE,speed:1000,baseRange:400};
 game.player.x=w.cx+1600;game.player.y=y;
 const friendly=new Projectile(x,y,0,def,14,1,null);game.projectiles.push(friendly);
 game.damageTerrain=()=>{throw Error('wall-hit projectile reached damage pass');};
 Game.prototype._updateProjectiles.call(game,.3);assert.equal(game.projectiles.length,0);
 const hostile=new EnemyProjectile(x,y,0,1000,5);hostile.update(.3,game);assert.ok(hostile.shouldRemove);
});
test('The scanner reduces future reinforcement count and cooling disables real floor damage',()=>{
 const {game,world:w}=scene();w.enterPhase(game,1);
 assert.equal(w.reinforcementBudget(),6);w.device('helios').done=true;assert.equal(w.reinforcementBudget(),3);
 w.waves.reinforcement=4;assert.equal(w.reinforcementBudget(),4,'already committed attackers are retained');
 w.enterPhase(game,3);game.gameTime=w.forgeStartedAt+3.3;
 const lane=w.heatLanes()[0];game.player.x=lane.x;game.player.y=lane.y+100;
 assert.equal(w.heatState(game,0),'active');const hp=game.player.hp;w._updateHeat(game);assert.ok(game.player.hp<hp);
 w.device('coolant').done=true;assert.equal(w.heatState(game,0),'idle');
 w.device('coolant').done=false;w.device('relay-a').done=true;w.device('relay-b').done=true;assert.equal(w.heatState(game,0),'idle');
});
test('Closing both forge relays prevents future enemies while warning time remains real',()=>{
 const previous=globalThis.document;globalThis.document={getElementById:()=>null};
 try{
  const {game,world:w}=scene();w.enterPhase(game,3);w.device('relay-a').done=true;w.device('relay-b').done=true;
  w.update(game,.1);assert.ok(w.forgeClear);assert.equal(w.waves.forge,0);
  w.queueEnemy(game,'command',0,w.point(5500,-275),COMMAND_GUARD,96,52);
  game.gameTime=1.19;w._updateWarnings(game);assert.equal(game.enemies.length,0);
  game.gameTime=1.21;w._updateWarnings(game);assert.equal(game.enemies.length,1);assert.equal(game.enemies[0].shieldHp,28);
 }finally{globalThis.document=previous;}
});
test('Reading and exploring for fifteen minutes does not strengthen tutorial robots',()=>{
 const {game}=scene();const before=Game.prototype._computeDifficultyMults.call(game);game.gameTime=900;
 const after=Game.prototype._computeDifficultyMults.call(game);assert.equal(before.hpMult,after.hpMult);assert.equal(before.dmgMult,after.dmgMult);
 game.missionWorld=null;assert.ok(Game.prototype._computeDifficultyMults.call(game).hpMult>after.hpMult);
});
test('Core attackers move only in Enemy.update, attack after a windup, while hunters retain the hero target',()=>{
 const {game,world:w}=scene();const entry=SIEGE_PLAN[0];
 const e=w._spawnActive(game,'siege',0,w.point(6740,0),entry.type,90,70,false);e.prologueDuty='core';
 const before=e.x;w.siegeStarted=true;w._updateSiege(game,.5);assert.equal(e.x,before,'world does not move the same enemy twice');
 assert.notEqual(w.enemyTargetFor(e,game.player,game),game.player);
 e.x=w.cx+6690;w._updateSiege(game,.5);assert.equal(w.coreHp,200);
 w._updateSiege(game,.26);assert.equal(w.coreHp,194);w._updateSiege(game,.5);assert.equal(w.coreHp,194,'strike cooldown');
 e.prologueDuty='hunt';assert.equal(w.enemyTargetFor(e,game.player,game),game.player);
});
test('Turret profile controls real damage and cooldown; robots survive two sentry impacts',()=>{
 const {game,world:w}=scene();const b=w.base('sentry-a',game),t=b.turrets[0];
 const e=new Enemy(b.x,b.y-100,ENEMIES.ZOMBIE,1,1);e.hp=e.maxHp=72;game.enemies.push(e);
 t.aimAngle=-Math.PI/2;t.cooldown=0;game.friendlyBases.respondToTurret=noop;
 const random=Math.random;Math.random=()=>.9;
 try{game.friendlyBases.updateTurret(.1,b,t,game);assert.equal(e.hp,60);assert.equal(t.cooldown,1.45);
  t.cooldown=0;game.friendlyBases.updateTurret(.1,b,t,game);assert.equal(e.hp,48);
 }finally{Math.random=random;}
});

test('The complete defense respects its population budget and needs functioning batteries',()=>{
 const random=Math.random;Math.random=()=>.9;
 const run=(powered,reserve)=>{
  const {game,world:w}=scene();game.mines=[];game.gameOver=noop;
  w.enterPhase(game,5);game.player.x=w.cx+6540;game.player.y=w.cy-230;
  for(const id of ['heavy-a','heavy-b']){w.device(id).done=true;w.base(id,game).activated=true;}
  w.device('capacitor').done=reserve;w.siegeStarted=true;w.siegeStartAt=0;
  let peak=0;
  for(let i=0;i<55*60;i++){
   const dt=1/60;game.gameTime+=dt;game.spatial.insertEnemies(game.enemies);
   for(const e of game.enemies){if(e.hp<=0)continue;const x=e.x,y=e.y;e.update(dt,game);w.constrainEntity(e,x,y);}
   if(powered)for(const id of ['heavy-a','heavy-b']){const b=w.base(id,game);for(const t of b.turrets)if(!t.disabled)game.friendlyBases.updateTurret(dt,b,t,game);}
   w.update(game,dt);peak=Math.max(peak,game.enemies.filter(e=>e.hp>0).length+w.spawnWarnings.length);
   game.enemies=game.enemies.filter(e=>e.hp>0);
  }
  return {core:w.coreHp,won:w.defenseClear,peak,count:w.waves.siege};
 };
 try{
  const unpowered=run(false,false),ordinary=run(true,false),prepared=run(true,true);
  assert.equal(unpowered.core,0);assert.equal(unpowered.won,false);
  assert.ok(ordinary.won&&ordinary.core>0,'working batteries can cover a stationary, non-firing hero');
  assert.ok(prepared.core>ordinary.core,'preparing reserve power changes the actual outcome');
  for(const r of [ordinary,prepared]){assert.ok(r.peak<=6);assert.equal(r.count,15);}
 }finally{Math.random=random;}
});
