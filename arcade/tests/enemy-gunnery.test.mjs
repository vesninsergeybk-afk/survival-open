import test from 'node:test';
import assert from 'node:assert/strict';
import {ENEMY_GUNNERY,updateEnemyGunnery,drawEnemyGunWarnings,
 drawEnemyDefenseGoals}
 from '../enemy-gunnery.js';
import {updateEnemy} from '../ai.js';
import {EnemyComms} from '../enemy-comms.js';

const ship=(type,serial,x=245)=>({type,serial,group:1,x,y:40,vx:0,vy:0,
  r:14,hp:60,maxHp:60,damage:10,think:0,fire:1.5,
  state:type==='flanker'?'flank':'hunt',commitUntil:0});
const scene=(enemies)=>{
  const player={x:0,y:0,vx:150,vy:0,hp:110,maxHp:110,r:19,invul:99};
  const shots=[];
  const game={time:1,player,enemies,shots,allies:[],missiles:[],
    grid:{query(x,y,r){return enemies.filter(e=>e.hp>0&&
      Math.hypot(e.x-x,e.y-y)<=r);}},
    avoidance:()=>({x:0,y:0}),enemyCanSee:()=>true,
    enemyShot(x,y,tx,ty,damage,options){
      shots.push({x,y,tx,ty,damage,options,at:game.time});return true;
    },heritage:{play(){},vfx:{shipExplosion(){}}},hurt(){}};
  game.enemyComms=new EnemyComms();return game;
};

test('a fighter commits to a warning point; a dodge does not retarget its shot',()=>{
  const e=ship('fighter',1),game=scene([e]);
  e._enemyLearningSaw=true;e._gunNextAt=0;
  assert.equal(updateEnemyGunnery(e,game,game.player),false);
  const locked={...e._gunAiming};
  assert.ok(locked.x>0,'the sighting permits only a bounded lead');
  game.player.x=210;game.player.y=180;game.player.vx=-150;
  game.time=1.4;
  assert.equal(updateEnemyGunnery(e,game,game.player),false);
  game.time=1.7;
  assert.equal(updateEnemyGunnery(e,game,game.player),true);
  assert.equal(game.shots.length,1);
  assert.equal(game.shots[0].tx,locked.x);
  assert.equal(game.shots[0].ty,locked.y);
  assert.equal(game.shots[0].damage,ENEMY_GUNNERY.fighter.damage);
  assert.equal(e._gunAiming,null);
  game.time=1.75;
  assert.equal(updateEnemyGunnery(e,game,game.player),false,
    'no burst can bypass the individual reload');
});

test('opening commander uses the same visible charging shot; other mission structures still cannot fire',()=>{
 const commander=ship('fighter',9,210),game=scene([commander]);
 commander.missionStructure=true;commander.openingCommander=true;
 commander.state='standoff';commander._enemyLearningSaw=true;commander._gunNextAt=0;
 assert.equal(updateEnemyGunnery(commander,game,game.player),false);
 assert.ok(commander._gunAiming,'the commander telegraphs the shot');
 game.time=1.8;
 assert.equal(updateEnemyGunnery(commander,game,game.player),true);
 assert.equal(game.shots.length,1);
 const excluded=ship('fighter',10,220);
 excluded.missionStructure=true;excluded._enemyLearningSaw=true;excluded._gunNextAt=0;
 assert.equal(updateEnemyGunnery(excluded,game,game.player),false);
 assert.equal(excluded._gunAiming,null);
});

test('gunner cannot aim from radio, noise, cover, or a dead target',()=>{
  const e=ship('flanker',1),game=scene([e]);e._gunNextAt=0;
  assert.equal(updateEnemyGunnery(e,game,game.player),false);
  assert.equal(e._gunAiming,null,'even an exact radio point is not sight');
  e._enemyLearningSaw=true;
  updateEnemyGunnery(e,game,game.player);
  assert.ok(e._gunAiming);
  e._enemyLearningSaw=false;game.time=1.2;
  updateEnemyGunnery(e,game,game.player);
  assert.equal(e._gunAiming,null,'losing contact cancels the charge');
  assert.equal(game.shots.length,0);
  e._enemyLearningSaw=true;e.signalIntel={mode:'search'};
  game.time=2;updateEnemyGunnery(e,game,game.player);
  assert.equal(e._gunAiming,null,'search-only patrol cannot shoot');
  e.signalIntel=null;e.hp=0;
  game.time=2.3;updateEnemyGunnery(e,game,game.player);
  assert.equal(e._gunAiming,null);
});

test('an asteroid interrupting line of fire cancels the charged shot',()=>{
  const e=ship('fighter',2),game=scene([e]);
  e._enemyLearningSaw=true;e._gunNextAt=0;
  updateEnemyGunnery(e,game,game.player);
  assert.ok(e._gunAiming);
  game.time=1.8;game.enemyCanSee=()=>false;
  assert.equal(updateEnemyGunnery(e,game,game.player),false);
  assert.equal(game.shots.length,0);
  assert.equal(e._gunAiming,null);
});

test('a radio cell spaces its bolts and losing the caller interrupts the volley',()=>{
  const a=ship('fighter',1,220),b=ship('flanker',2,260),game=scene([a,b]);
  const cell={nextGunVolleyAt:0,brokenUntil:0};
  for(const e of [a,b]){
    e._commsCell=cell;e._enemyLearningSaw=true;e._gunNextAt=0;
    updateEnemyGunnery(e,game,game.player);
  }
  game.time=1.8;
  assert.equal(updateEnemyGunnery(a,game,game.player),true);
  assert.equal(updateEnemyGunnery(b,game,game.player),false);
  assert.equal(game.shots.length,1);
  cell.brokenUntil=2.8;game.time=2.1;
  assert.equal(updateEnemyGunnery(b,game,game.player),false);
  assert.equal(b._gunAiming,null);
  assert.ok(b._gunNextAt>=3,'the surviving wingman waits for reconnection');
});

test('independent cells also share a small global cap on hostile salvos',()=>{
  const a=ship('fighter',1,220),b=ship('fighter',2,260),game=scene([a,b]);
  for(const e of [a,b]){
    e._enemyLearningSaw=true;e._gunNextAt=0;
    updateEnemyGunnery(e,game,game.player);
  }
  game.time=1.8;
  assert.equal(updateEnemyGunnery(a,game,game.player),true);
  assert.equal(updateEnemyGunnery(b,game,game.player),false);
  game.time=2.15;
  assert.equal(updateEnemyGunnery(b,game,game.player),true);
  assert.equal(game.shots.length,2);
});

test('a visible aim draws a warning; hidden pilots and low FPS stay bounded',()=>{
  const pilots=Array.from({length:7},(_,i)=>ship('fighter',i+1,150+i*8));
  const game=scene(pilots);
  for(const e of pilots)e._gunAiming={x:20,y:10,started:1,until:2};
  const draws=[];
  const ctx={save(){},restore(){},setLineDash(){},beginPath(){},
    moveTo(x,y){draws.push([x,y]);},lineTo(){},stroke(){},arc(){}};
  game.playerCanInspectEnemyIntent=e=>e.serial!==1;
  assert.equal(drawEnemyGunWarnings(ctx,game,{x:0,y:0,w:400,h:300},60),4);
  assert.ok(draws.every(([x])=>x!==pilots[0].x));
  assert.equal(drawEnemyGunWarnings(ctx,game,{x:0,y:0,w:400,h:300},18),2);
  game.playerCanInspectEnemyIntent=()=>false;
  assert.equal(drawEnemyGunWarnings(ctx,game,{x:0,y:0,w:400,h:300}),0);
});

test('combat movement and shots coexist without adding enemy damage or speed',()=>{
  const a=ship('fighter',1,210),b=ship('flanker',2,260);
  const game=scene([a,b]);
  const original=[a.damage,b.damage];
  for(let step=0;step<55;step++){
    game.time=1+step*.1;
    game.enemyComms.update(game);
    for(const e of game.enemies)updateEnemy(e,game,.1);
    game.enemyComms.confirmExecution(game);
  }
  assert.ok(game.shots.length>=2,'both roles can exert ranged pressure');
  assert.ok(game.shots.every(s=>s.options.kind==='fighter'||s.options.kind==='flanker'));
  assert.ok(game.shots.every((s,i)=>i===0||
    s.at-game.shots[i-1].at>=.87),
    'one radio cell never fires an unfair simultaneous wall');
  assert.deepEqual([a.damage,b.damage],original);
});

test('an unseen player cannot lure a protecting escort away from its asset',()=>{
  function run(playerX){
    const guard=ship('fighter',3,260),game=scene([guard]);
    guard.protect={x:310,y:80,hp:400,maxHp:400};
    game.player.x=playerX;game.player.y=-1900;
    game.enemyCanSee=()=>false;
    game.time=2;updateEnemy(guard,game,.2);
    return {state:guard.state,x:guard.x,y:guard.y,aim:guard._gunAiming};
  }
  const left=run(-2000),right=run(2000);
  assert.equal(left.state,'guard');
  assert.deepEqual(left,right,'guarding is anchored to known asset coordinates');
  assert.equal(left.aim,null);
});

test('defense labels identify the guarded asset only while the pilot is visible',()=>{
  const mine={x:270,y:80,hp:400},cargo={x:320,y:90,hp:60};
  const a=ship('fighter',1,245),b=ship('scout',2,290);
  a.state='guard';b.state='guard';a.protect=mine;b.protect=cargo;
  a.scenario='mine-guard';b.scenario='regional-escort';
  const game=scene([a,b]),labels=[];
  const ctx={save(){},restore(){},fillText:s=>labels.push(s)};
  game.playerCanInspectEnemyIntent=e=>e===a;
  assert.equal(drawEnemyDefenseGoals(ctx,game,{x:0,y:0,w:600,h:360}),1);
  assert.deepEqual(labels,['ОХРАНЯЕТ КОМПЛЕКС']);
  game.playerCanInspectEnemyIntent=()=>true;
  assert.equal(drawEnemyDefenseGoals(ctx,game,{x:0,y:0,w:600,h:360}),2);
  assert.ok(labels.includes('СОПРОВОЖДАЕТ ГРУЗ'));
  mine.captured=true;labels.length=0;
  assert.equal(drawEnemyDefenseGoals(ctx,game,{x:0,y:0,w:600,h:360}),1);
  assert.deepEqual(labels,['СОПРОВОЖДАЕТ ГРУЗ']);
});
