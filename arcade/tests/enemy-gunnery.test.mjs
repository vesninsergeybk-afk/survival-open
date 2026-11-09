import test from 'node:test';
import assert from 'node:assert/strict';
import {ENEMY_GUNNERY,gunProfile,updateEnemyGunnery,drawEnemyGunWarnings,
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

test('fighter can shoot a visible allied drone without pretending to see the player',()=>{
  const e=ship('fighter',11,190),game=scene([e]);
  const ally={x:0,y:25,vx:50,vy:0,r:15,hp:78};
  game.allies=[ally];e._enemyLearningSaw=false;e._gunNextAt=0;
  game.enemyCanSee=(_pilot,target)=>target===ally;
  assert.equal(updateEnemyGunnery(e,game,ally),false);
  assert.equal(e._gunAiming?.target,ally);
  game.time=1.8;
  assert.equal(updateEnemyGunnery(e,game,ally),true);
  assert.equal(game.shots.length,1);
  assert.equal(game.shots[0].damage,ENEMY_GUNNERY.fighter.damage);
  e._gunNextAt=0;game.time=4;
  updateEnemyGunnery(e,game,ally);
  assert.ok(e._gunAiming);
  game.enemyCanSee=()=>false;game.time=4.2;
  updateEnemyGunnery(e,game,ally);
  assert.equal(e._gunAiming,null,'cover stops the ally shot as well');
});

test('switching to a new target cancels the old charge instead of firing at stale coordinates',()=>{
  const e=ship('flanker',12,190),game=scene([e]);
  const first={x:20,y:0,r:14,hp:50},second={x:30,y:95,r:14,hp:50};
  game.allies=[first,second];e._gunNextAt=0;
  updateEnemyGunnery(e,game,first);
  assert.ok(e._gunAiming);
  game.time=1.6;
  assert.equal(updateEnemyGunnery(e,game,second),false);
  assert.equal(game.shots.length,0);
  assert.equal(e._gunAiming,null);
  game.time=1.7;updateEnemyGunnery(e,game,second);
  assert.equal(e._gunAiming?.target,second);
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

test('later fighters fire two spaced bolts at an old warning point, never a tracking burst',()=>{
 const e=ship('fighter',3,250),game=scene([e]);
 game.time=155;e._enemyLearningSaw=true;e._gunNextAt=0;
 assert.equal(gunProfile(e.type,155).shots,2);
 updateEnemyGunnery(e,game,game.player);
 const locked={...e._gunAiming};
 game.time=155.8;updateEnemyGunnery(e,game,game.player);
 assert.equal(game.shots.length,1);
 assert.equal(game.shots[0].options.kind,'fighter-burst');
 assert.equal(game.shots[0].damage,6);
 game.player.x=300;game.player.y=300;
 game.time=155.9;updateEnemyGunnery(e,game,game.player);
 assert.equal(game.shots.length,1,'the second bolt obeys a real gap');
 game.time=156.2;updateEnemyGunnery(e,game,game.player);
 assert.equal(game.shots.length,2);
 assert.ok(Math.hypot(game.shots[1].tx-locked.x,game.shots[1].ty-locked.y)<20);
 assert.equal(e._gunBurst,null);
});

test('interceptors use a faster, clearly warned needle and heavy ships fire a fanned cannon',()=>{
 const flanker=ship('flanker',5,280),game=scene([flanker]);
 game.time=210;flanker._enemyLearningSaw=true;flanker._gunNextAt=0;
 updateEnemyGunnery(flanker,game,game.player);
 assert.ok(flanker._gunAiming.until-game.time>=.8);
 game.time=211;updateEnemyGunnery(flanker,game,game.player);
 assert.equal(game.shots[0].options.kind,'flanker-needle');
 assert.equal(game.shots[0].options.speed,510);
 const heavy=ship('gunship',7,360);heavy.state='standoff';
 game.enemies=[heavy];heavy._enemyLearningSaw=true;heavy._gunNextAt=0;
 game.time=215;updateEnemyGunnery(heavy,game,game.player);
 game.time=216.2;updateEnemyGunnery(heavy,game,game.player);
 assert.equal(game.shots.at(-1).options.kind,'gunship-cannon');
 game.time=216.6;updateEnemyGunnery(heavy,game,game.player);
 game.time=217;updateEnemyGunnery(heavy,game,game.player);
 assert.equal(game.shots.filter(s=>s.options.kind==='gunship-cannon').length,3);
 assert.ok(new Set(game.shots.slice(-3).map(s=>s.ty)).size>1,
  'the heavy cannon has a spread pattern');
});

test('a burst stops at cover or lost target; no stale shot leaks through it',()=>{
 const e=ship('fighter',3,240),game=scene([e]);
 game.time=155;e._enemyLearningSaw=true;e._gunNextAt=0;
 updateEnemyGunnery(e,game,game.player);
 game.time=155.8;updateEnemyGunnery(e,game,game.player);
 assert.ok(e._gunBurst);
 game.enemyCanSee=()=>false;
 game.time=156.2;updateEnemyGunnery(e,game,game.player);
 assert.equal(e._gunBurst,null);assert.equal(game.shots.length,1);
});

test('a heavy ship telegraphs an instantaneous lance which misses after a real dodge',()=>{
 const e=ship('gunship',12,280),game=scene([e]);
 e.state='standoff';e._enemyLearningSaw=true;e._gunCycle=1;e._gunNextAt=0;
 game.time=260;game.player.x=0;game.player.y=40;
 const strikes=[];game.hurt=damage=>strikes.push(damage);
 const flashes=[];game.flash=(...args)=>flashes.push(args);
 updateEnemyGunnery(e,game,game.player);
 assert.equal(e._gunAiming.profile.kind,'gunship-lance');
 assert.equal(e._gunAiming.until-game.time,ENEMY_GUNNERY.lance.charge);
 const warning={...e._gunAiming};
 game.player.x=0;game.player.y=180;
 game.time=261.3;assert.equal(updateEnemyGunnery(e,game,game.player),true);
 assert.equal(strikes.length,0,'the beam never snaps to a dodging player');
 assert.equal(game.shots.length,0,'instant beam is not a fast simulated bullet');
 assert.equal(flashes.length,1);
 assert.equal(flashes[0][2],warning.x);
 assert.equal(game._enemyLanceNextAt,game.time+4.8);
});

test('the warned lance can hit a stationary player but cannot begin offscreen',()=>{
 const e=ship('gunship',12,280),game=scene([e]);
 e.state='standoff';e._enemyLearningSaw=true;e._gunCycle=1;e._gunNextAt=0;
 game.time=260;const strikes=[];game.hurt=damage=>strikes.push(damage);
 updateEnemyGunnery(e,game,game.player);
 game.time=261.3;updateEnemyGunnery(e,game,game.player);
 assert.deepEqual(strikes,[ENEMY_GUNNERY.lance.damage]);
 const hidden=ship('gunship',15,280),far=scene([hidden]);
 hidden.state='standoff';hidden._enemyLearningSaw=true;hidden._gunCycle=1;hidden._gunNextAt=0;
 far.time=270;far.camera=()=>({x:-250,y:-150,w:400,h:300});
 updateEnemyGunnery(hidden,far,far.player);
 assert.notEqual(hidden._gunAiming.profile.kind,'gunship-lance');
});

test('a heavy lance cannot fire after leaving the viewport or moving away from its warning line',()=>{
 const e=ship('gunship',12,265),game=scene([e]),strikes=[];
 e.state='standoff';e._enemyLearningSaw=true;e._gunCycle=1;e._gunNextAt=0;
 game.camera=()=>({x:-300,y:-250,w:600,h:500});
 game.hurt=damage=>strikes.push(damage);
 game.time=260;updateEnemyGunnery(e,game,game.player);
 assert.equal(e._gunAiming.profile.kind,'gunship-lance');
 e.x=350;game.time=261.3;
 assert.equal(updateEnemyGunnery(e,game,game.player),false);
 assert.equal(strikes.length,0,'no invisible instant attack from beyond camera');
 assert.equal(e._gunAiming,null);
 e.x=265;e._gunNextAt=0;game.time=269;
 updateEnemyGunnery(e,game,game.player);
 assert.equal(e._gunAiming.profile.kind,'gunship-lance');
 e.y+=85;game.time=270.3;
 assert.equal(updateEnemyGunnery(e,game,game.player),false);
 assert.equal(strikes.length,0,'a moving gunship cannot sweep a previously warned ray');
});

test('only one instant lance can charge at a time, including under the reduced-FPS warning limit',()=>{
 const ships=Array.from({length:4},(_,index)=>ship('gunship',index+10,180+index*55));
 const game=scene(ships);game.time=270;
 for(const e of ships){e.state='standoff';e._enemyLearningSaw=true;
  e._gunCycle=1;e._gunNextAt=0;}
 for(const e of ships)updateEnemyGunnery(e,game,game.player);
 assert.equal(ships.filter(e=>e._gunAiming?.profile?.kind==='gunship-lance').length,1,
  'multiple instant beams could otherwise be hidden by the low-FPS drawing cap');
});

test('an instant-beam warning is never hidden behind the ordinary warning cap',()=>{
 const crowd=Array.from({length:7},(_,i)=>ship('fighter',i+1,130+i*9));
 const heavy=ship('gunship',19,390);heavy.state='standoff';
 const game=scene([...crowd,heavy]);game.time=260;
 for(const e of crowd)e._gunAiming={x:20,y:25,started:260,until:261,
  target:game.player};
 heavy._gunAiming={x:10,y:20,started:260,until:261.25,
  target:game.player,profile:ENEMY_GUNNERY.lance};
 const starts=[];
 const ctx={save(){},restore(){},setLineDash(){},beginPath(){},
  moveTo(x){starts.push(x);},lineTo(){},stroke(){},arc(){}};
 game.playerCanInspectEnemyIntent=()=>true;
 assert.equal(drawEnemyGunWarnings(ctx,game,{x:0,y:0,w:500,h:300},60),4);
 assert.equal(starts[0],heavy.x);
});

test('a charged shot keeps its visible marker while another volley delays firing',()=>{
 const e=ship('gunship',12,270),game=scene([e]);game.time=260;
 e.state='standoff';e._enemyLearningSaw=true;e._gunCycle=1;e._gunNextAt=0;
 updateEnemyGunnery(e,game,game.player);
 game.time=261.45;game._enemyRegularVolleyAt=261.8;
 assert.equal(updateEnemyGunnery(e,game,game.player),false);
 assert.ok(e._gunAiming,'the shot still has a pending charge');
 game.playerCanInspectEnemyIntent=()=>true;
 const ctx={save(){},restore(){},setLineDash(){},beginPath(){},moveTo(){},
  lineTo(){},stroke(){},arc(){}};
 assert.equal(drawEnemyGunWarnings(ctx,game,{x:-300,y:-250,w:600,h:500}),1,
  'a postponed instant shot may not become invisible after the nominal charge time');
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
