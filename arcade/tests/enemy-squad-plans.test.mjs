import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EnemyComms,ENEMY_COMMS} from '../enemy-comms.js';
import {updateEnemy} from '../ai.js';
import {createEnemySquadPlan,advanceEnemySquadPlan,squadPhaseExpired,
  squadPlanObsolete,squadPlanMode,squadRoleFor,
  squadRoleDestination,ENEMY_SQUAD_PLANS} from '../enemy-squad-plans.js';

const ship=(serial,type,x,y)=>({serial,type,x,y,group:1,
  vx:0,vy:0,r:14,hp:70,maxHp:70,damage:9,fire:3,think:0,
  state:type==='flanker'?'flank':'hunt'});
const scene=enemies=>{
  const game={time:0,enemies,allies:[],missiles:[],shots:[],
    player:{x:0,y:0,vx:0,vy:0,r:19,hp:120,shield:0,invul:999},
    grid:{query(x,y,range){return enemies.filter(e=>e.hp>0&&
      Math.hypot(e.x-x,e.y-y)<=range);}},
    avoidance:()=>({x:0,y:0}),enemyCanSee:()=>true,
    enemyShot:()=>true,hurt(){},heritage:{play(){},
      vfx:{shipExplosion(){}}},playerCanInterceptEnemyRadio:()=>true,
    playerCanInspectEnemyIntent:()=>true,notice(){}};
  game.enemyComms=new EnemyComms();return game;
};

test('the longer, faster radio still requires an eyewitness and a delivered order',()=>{
  assert.ok(ENEMY_COMMS.range>450);
  assert.ok(ENEMY_COMMS.tick<.5);
  assert.ok(ENEMY_COMMS.broadcastInterval<1);
  const scout=ship(1,'scout',100,0),fighter=ship(2,'fighter',565,0);
  const game=scene([scout,fighter]);const net=game.enemyComms;
  net.update(game);
  assert.equal(net.directiveFor(scout,0),null);
  net.reportSight(scout,game.player,.1);
  game.time=.4;net.update(game);
  assert.equal(net.directiveFor(fighter,.4)?.intel.x,0,
    'a report may travel 465 units within one shortened decision cycle');
  assert.ok(net.events.some(e=>e.kind==='contact'));
  assert.ok(net.events.some(e=>e.kind==='order'));
  const hidden=scene([ship(3,'scout',100,0),ship(4,'fighter',565,0)]);
  hidden.player.x=1500;hidden.player.y=1800;
  hidden.enemyComms.update(hidden);hidden.time=.4;
  hidden.enemyComms.update(hidden);
  assert.equal(hidden.enemyComms.directiveFor(hidden.enemies[1],.4),null);
});

test('a 18-second plan assigns complementary roles and respects uncertain intelligence',()=>{
  const members=[ship(1,'flanker',200,10),ship(2,'fighter',225,40),
    ship(3,'scout',240,-25),ship(4,'healer',230,80)];
  const cell={members,intel:{x:0,y:0,vx:160,vy:0,at:2}};
  const plan=createEnemySquadPlan(cell,'pincer',
    {kind:'maneuver',motion:'straight',lastAt:2},2.1);
  assert.ok(plan);
  assert.equal(plan.until-plan.startedAt,ENEMY_SQUAD_PLANS.horizon);
  assert.deepEqual(plan.modes,['pincer','intercept','press']);
  const assigned=members.map(e=>squadRoleFor(plan,e));
  assert.ok(assigned.includes('left')&&assigned.includes('right'));
  assert.ok(assigned.includes('anchor')&&assigned.includes('reserve'));
  assert.equal(createEnemySquadPlan({...cell,intel:{...cell.intel,
    estimated:true}},'intercept',null,2.1),null,
  'damage bearing alone must never start a predictive hunting plan');
  assert.equal(squadPlanObsolete(plan,
    {kind:'maneuver',motion:'turning',lastAt:2.8},2.9),true);
  assert.equal(squadPlanObsolete(plan,
    {kind:'maneuver',motion:'straight',lastAt:2.8},2.9),false);
  const wounded=createEnemySquadPlan(cell,'press',
    {kind:'weak',lastAt:2},2.1);
  assert.equal(squadPlanObsolete(wounded,null,3.5,members,
    {x:0,y:0,vx:0,vy:0,at:3.2,hullRatio:.9}),true,
    'an eyewitness seeing a repaired hull cancels the old finishing scheme');
  assert.deepEqual(createEnemySquadPlan(cell,'pincer',
    {kind:'close',lastAt:2},2.1).modes,['pincer','scatter','pincer'],
    'a close-range beam must never provoke a planned suicidal rush');
  assert.deepEqual(createEnemySquadPlan(cell,'scatter',
    {kind:'area',lastAt:2},2.1).modes,['scatter','pincer','scatter'],
    'an area-weapon counter must keep a final escape phase');
});

test('flanking lanes are distinct, bounded and based exclusively on reported positions',()=>{
  const e=ship(1,'flanker',250,75),intel={x:20,y:15,vx:500,vy:0,at:2};
  const base={mode:'intercept',planId:4,intel};
  const left=squadRoleDestination(e,{...base,role:'left'},intel);
  const right=squadRoleDestination(e,{...base,role:'right'},intel);
  assert.ok(left.y<0&&right.y>0);
  assert.ok(Math.abs(left.x-intel.x)<=180,
    'a rapid player does not grant unlimited knowledge of their future');
  assert.equal(squadRoleDestination(e,{...base,intel:{...intel,estimated:true},
    role:'left'},intel),null);
  assert.equal(squadRoleDestination(e,{...base,role:'right',planId:null},intel),null);
});

test('a phase cannot advance on a timer without actual coordinated flight',()=>{
  const a=ship(1,'flanker',200,75),b=ship(2,'fighter',250,75);
  const cell={members:[a,b],intel:{x:0,y:0,vx:160,vy:0,at:0}};
  const plan=createEnemySquadPlan(cell,'pincer',null,0);
  assert.equal(squadPlanMode(plan),'pincer');
  assert.equal(advanceEnemySquadPlan(plan,cell,4.5),false,
    'a plan without acknowledgement cannot succeed');
  plan.confirmed=true;
  assert.equal(advanceEnemySquadPlan(plan,cell,4.5),false,
    'acknowledgement alone is not movement');
  for(const e of cell.members){
    const role=squadRoleFor(plan,e);
    const goal=squadRoleDestination(e,{mode:'pincer',planId:plan.id,
      role,intel:cell.intel},cell.intel);
    const origin={x:e.x,y:e.y};
    e.x=origin.x+(goal.x-origin.x)*.48;
    e.y=origin.y+(goal.y-origin.y)*.48;
    e._commsIntent={x:goal.x,y:goal.y,mode:'pincer',role,
      at:4.5,planId:plan.id,planPhase:0};
  }
  assert.equal(advanceEnemySquadPlan(plan,cell,4.5),true);
  assert.equal(squadPlanMode(plan),'intercept');
  assert.equal(plan.confirmed,false);
  assert.equal(advanceEnemySquadPlan(plan,cell,9),false);
  assert.equal(squadPhaseExpired(plan,cell,13.1),true,
    'an unexecuted subsequent phase must eventually be abandoned');
});

test('the loss of a designated wing invalidates the old trap immediately',()=>{
  const a=ship(1,'flanker',140,-80),b=ship(2,'fighter',210,20),
    c=ship(3,'scout',180,80),members=[a,b,c];
  const cell={members,intel:{x:0,y:0,vx:130,vy:0,at:0}};
  const plan=createEnemySquadPlan(cell,'pincer',null,0);
  const wing=[...plan.roles].find(([e,role])=>role==='left')[0];
  wing.hp=0;
  const survivors=members.filter(e=>e.hp>0);
  assert.equal(squadPlanObsolete(plan,null,.5,survivors),true);
  const renewed=createEnemySquadPlan({...cell,members:survivors},'press',null,.5);
  assert.ok(renewed&&renewed.roles.size===2,
    'two surviving pilots can choose achievable new roles');
});

test('the whole game loop can execute a multi-step squad plan without changing ship stats',()=>{
  const members=[ship(1,'flanker',175,-100),ship(2,'fighter',240,35),
    ship(3,'scout',190,110)];
  const game=scene(members);const snapshots=members.map(e=>
    [e.hp,e.maxHp,e.damage]);
  const executed=new Set(),phases=new Set();let messages=0;
  game.notice=()=>{messages++;};
  for(let frame=0;frame<660;frame++){
    game.time=frame/60;
    game.enemyComms.update(game);
    for(const e of members)updateEnemy(e,game,1/60);
    game.enemyComms.confirmExecution(game);
    for(const e of members)if(e._commsIntent?.planId){
      executed.add(e._commsIntent.role);
      phases.add(e._commsIntent.planPhase);
    }
  }
  assert.ok(executed.has('left')&&executed.has('right'),
    'opposite assigned wings should visibly take different routes');
  assert.ok(phases.has(1),'genuine movement must trigger the second planned action');
  assert.ok(messages>0,'an executed response should become visible to the player');
  assert.deepEqual(members.map(e=>[e.hp,e.maxHp,e.damage]),snapshots);
});

test('every arcade import path is versioned to load the new planning code',()=>{
  const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
  assert.match(read('index.html'),/game\.js\?v=[^"']*enemy-plans-1/);
  for(const file of ['game.js','region-runtime.js','combat-rewards.js'])
    assert.match(read(file),/ai\.js\?v=[^"']*enemy-plans-1/);
  assert.match(read('ai.js'),/enemy-comms\.js\?v=[^"']*enemy-plans-1/);
  assert.match(read('game.js'),/enemy-comms\.js\?v=[^"']*enemy-plans-1/);
});
