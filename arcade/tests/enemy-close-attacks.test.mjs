import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLOSE_ATTACK,advanceEnemyCloseAttack,drawEnemyCloseWarnings,
 cancelCloseAttack} from '../enemy-close-attacks.js';
import {ENEMY_GUNNERY,updateEnemyGunnery} from '../enemy-gunnery.js';

function setup(type='scout',x=175){
 const player={x:0,y:0,vx:0,vy:0,hp:100,shield:0,r:19,invul:0};
 const enemy={type,x,y:0,vx:0,vy:0,r:14,serial:7,hp:60,maxHp:60,
  state:type==='flanker'?'flank':'hunt',_enemyLearningSaw:true};
 const hits=[],shots=[];
 const game={time:10,player,enemies:[enemy],enemyCanSee:()=>true,
  camera:()=>({x:-330,y:-240,w:760,h:500}),heritage:{play(){}},
  hurt(damage){hits.push({damage,at:this.time});player.hp-=damage;player.invul=.55;},
  enemyShot(x,y,tx,ty,damage,options){shots.push({damage,options,at:this.time});return true;}};
 return {game,enemy,player,hits,shots};
}
function run(game,enemy,end,step=.05){
 for(let t=game.time+step;t<=end+1e-8;t+=step){
  game.time=t;game.player.invul=Math.max(0,game.player.invul-step);
  advanceEnemyCloseAttack(enemy,game,step,game.player);
 }
}

test('all three opening attackers have a warned, locked melee dash with one hit',()=>{
 for(const [type,x] of [['scout',175],['fighter',155],['flanker',195]]){
  const {game,enemy,hits}=setup(type,x);
  assert.equal(advanceEnemyCloseAttack(enemy,game,.05,game.player),true);
  assert.equal(enemy._closeAttack.stage,'windup');
  assert.equal(enemy._closeAttack.until,10+CLOSE_ATTACK.windup);
  run(game,enemy,11.5);
  assert.equal(hits.length,1,type+' should reach a stationary pilot once');
  assert.equal(hits[0].damage,CLOSE_ATTACK[type].damage);
  assert.ok(enemy.hp>0,'the ordinary close pass is not a suicide ram');
  assert.ok(enemy._closeAttackNextAt>game.time,'attacker must recover before another rush');
 }
});

test('moving after the warning genuinely dodges a committed attack',()=>{
 const {game,enemy,player,hits}=setup('scout',185);
 advanceEnemyCloseAttack(enemy,game,.05,player);
 const target={x:enemy._closeAttack.x,y:enemy._closeAttack.y};
 player.y=170;
 run(game,enemy,11.5);
 assert.equal(hits.length,0);
 assert.deepEqual(target,{x:0,y:0},'the dash never retargets to the new player position');
 assert.ok(enemy.x<185,'the real ship still travels along its committed path');
});

test('nearby enemies share a melee budget and never all dash on one frame',()=>{
 const {game,player}=setup();
 const enemies=Array.from({length:8},(_,i)=>({type:'scout',x:150+i*3,y:i*3,
  r:14,serial:i+1,hp:38,state:'hunt',_enemyLearningSaw:true}));
 game.enemies=enemies;
 const started=enemies.filter(e=>advanceEnemyCloseAttack(e,game,.05,player));
 assert.equal(started.length,1);
 assert.equal(enemies.filter(e=>!!e._closeAttack).length,1);
 game.time=10+CLOSE_ATTACK.globalSpacing-.01;
 assert.equal(advanceEnemyCloseAttack(enemies[1],game,.05,player),false);
 game.time=10+CLOSE_ATTACK.globalSpacing+.01;
 assert.equal(advanceEnemyCloseAttack(enemies[1],game,.05,player),true);
});

test('an active gun warning stays committed and the close attack waits',()=>{
 const {game,enemy,player}=setup('fighter',160);
 enemy._gunAiming={profile:ENEMY_GUNNERY.fighter,x:player.x,y:player.y};
 assert.equal(advanceEnemyCloseAttack(enemy,game,.05,player),false);
 assert.equal(enemy._closeAttack,undefined);
 enemy._gunAiming=null;
 assert.equal(advanceEnemyCloseAttack(enemy,game,.05,player),true);
});

test('the close attack cannot fire in the opening seconds',()=>{
 const {game,enemy,player}=setup();game.time=CLOSE_ATTACK.earliest-.1;
 assert.equal(advanceEnemyCloseAttack(enemy,game,.05,player),false);
 game.time=CLOSE_ATTACK.earliest;
 assert.equal(advanceEnemyCloseAttack(enemy,game,.05,player),true);
});

test('circling almost on top of a scout is not a guaranteed safe distance',()=>{
 const close=setup('scout',62);
 assert.equal(advanceEnemyCloseAttack(close.enemy,close.game,.05,close.player),true);
 run(close.game,close.enemy,11.5);
 assert.equal(close.hits.length,1);
 const overlapping=setup('scout',32);
 assert.equal(advanceEnemyCloseAttack(overlapping.enemy,overlapping.game,.05,overlapping.player),false,
  'already overlapping hulls must not trigger an unfair instant lunge');
});

test('losing sight during wind-up cancels the strike without hidden homing',()=>{
 const {game,enemy,player,hits}=setup();
 advanceEnemyCloseAttack(enemy,game,.05,player);
 game.enemyCanSee=()=>false;game.time=10.2;
 assert.equal(advanceEnemyCloseAttack(enemy,game,.05,player),true);
 assert.equal(enemy._closeAttack,null);
 run(game,enemy,11.5);
 assert.equal(hits.length,0);
});

test('asteroid cover stops a melee dash across the actual swept path',()=>{
 const {game,enemy,player,hits}=setup('scout',185);
 game.rockGrid={query:()=>[{x:105,y:0,r:34,alive:true}]};
 advanceEnemyCloseAttack(enemy,game,.05,player);
 run(game,enemy,11.5);
 assert.equal(hits.length,0);
 assert.ok(enemy.x>120,'the ship must be stopped before passing through a rock');
});

test('scripted enemies, hidden pilots and offscreen ships cannot start surprise passes',()=>{
 for(const field of ['missionStructure','boss','openingCommander','converted','interceptCargo']){
  const {game,enemy}=setup();enemy[field]=true;
  assert.equal(advanceEnemyCloseAttack(enemy,game,.05,game.player),false,field);
 }
 const hidden=setup();hidden.game.enemyCanSee=()=>false;
 assert.equal(advanceEnemyCloseAttack(hidden.enemy,hidden.game,.05,hidden.player),false);
 const offscreen=setup();offscreen.game.camera=()=>({x:-250,y:-150,w:300,h:300});
 assert.equal(advanceEnemyCloseAttack(offscreen.enemy,offscreen.game,.05,offscreen.player),false);
 assert.equal(cancelCloseAttack(hidden.enemy),undefined);
});

test('melee warning paints the locked target and the player receives readable intent',()=>{
 const {game,enemy,player}=setup();advanceEnemyCloseAttack(enemy,game,.05,player);
 const calls=[],ctx={save(){},restore(){},setLineDash(){},beginPath(){},
  moveTo(x,y){calls.push(['start',x,y]);},lineTo(x,y){calls.push(['target',x,y]);},
  stroke(){},arc(){},fillText(t){calls.push(['label',t]);}};
 assert.equal(drawEnemyCloseWarnings(ctx,game,game.camera()),1);
 assert.ok(calls.some(x=>x[0]==='target'&&x[1]===0&&x[2]===0));
 assert.ok(calls.some(x=>x[0]==='label'&&x[1]==='БЛИЖНИЙ РЫВОК'));
 const entry=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(entry,/drawEnemyCloseWarnings\(c,this,cam,this\.fps\)/);
 const ai=readFileSync(new URL('../ai.js',import.meta.url),'utf8');
 assert.match(ai,/advanceEnemyCloseAttack\(e,game,dt,selected\)/);
});

test('quick shots remain single warned shots; early travel speeds improve without stacking bursts',()=>{
 for(const type of ['fighter','flanker']){
  const {game,enemy,shots}=setup(type,190);
  enemy._gunNextAt=0;
  assert.equal(updateEnemyGunnery(enemy,game,game.player),false);
  assert.equal(enemy._gunAiming.profile.kind,type+'-close');
  const locked={x:enemy._gunAiming.x,y:enemy._gunAiming.y};
  game.player.y=110;game.time=10.8;
  assert.equal(updateEnemyGunnery(enemy,game,game.player),true);
  assert.equal(shots.length,1);
  assert.ok(shots[0].options.speed>=465);
  assert.equal(shots[0].damage,ENEMY_GUNNERY[type].damage);
  assert.ok(!enemy._gunBurst);
  assert.deepEqual(locked,{x:0,y:0});
 }
});

test('close bolts never override late upgrades or start unseen, and cancel if attacker leaves view',()=>{
 for(const [type,late] of [['fighter',135],['flanker',155]]){
  const later=setup(type,190);later.game.time=late;later.enemy._gunNextAt=0;
  updateEnemyGunnery(later.enemy,later.game,later.player);
  assert.notEqual(later.enemy._gunAiming.profile.kind,type+'-close');
  const hidden=setup(type,190);
  hidden.enemy._gunNextAt=0;
  hidden.game.camera=()=>({x:-140,y:-140,w:280,h:280});
  updateEnemyGunnery(hidden.enemy,hidden.game,hidden.player);
  assert.notEqual(hidden.enemy._gunAiming.profile.kind,type+'-close');
  const visible=setup(type,190);
  visible.enemy._gunNextAt=0;
  updateEnemyGunnery(visible.enemy,visible.game,visible.player);
  assert.equal(visible.enemy._gunAiming.profile.kind,type+'-close');
  visible.enemy.x=450;visible.game.time+=.8;
  assert.equal(updateEnemyGunnery(visible.enemy,visible.game,visible.player),false);
  assert.equal(visible.enemy._gunAiming,null);
  assert.equal(visible.shots.length,0);
 }
});
