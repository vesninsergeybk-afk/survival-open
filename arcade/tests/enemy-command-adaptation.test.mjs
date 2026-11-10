import test from 'node:test';
import assert from 'node:assert/strict';
import {EnemyComms} from '../enemy-comms.js';
import {updateEnemy} from '../ai.js';
import {chooseSquadRecovery,createEnemySquadPlan,squadRoleDestination}
  from '../enemy-squad-plans.js';
import {planTheater} from '../enemy-strategy.js';

const ship=(serial,type='fighter',x=100,y=0)=>({serial,group:1,type,x,y,
  vx:0,vy:0,r:14,hp:70,maxHp:70,damage:9,fire:9,think:9,
  state:type==='flanker'?'flank':'hunt',commitUntil:20});

test('a commander values failed formations without ignoring urgent countermeasures',()=>{
  const votes={pincer:15,intercept:4,press:2,close:0,scatter:0,screen:0};
  const failed=new Map([['pincer',{at:10,basis:'close/'}]]);
  assert.equal(chooseSquadRecovery(votes,{kind:'close'},failed,12,'pincer'),'scatter',
    'after a failed approach, spread out instead of repeating it unchanged');
  assert.equal(chooseSquadRecovery(votes,{kind:'close'},failed,40,'pincer'),'pincer',
    'old failures must not permanently forbid a tactic');
  assert.equal(chooseSquadRecovery(votes,{kind:'area'},failed,12,'scatter'),'scatter',
    'area fire cannot be answered by an unsafe rush merely to vary tactics');
  assert.equal(chooseSquadRecovery(votes,{kind:'weak'},failed,12,'press'),'press',
    'a failure under different evidence must not masquerade as current learning');
});

test('retrying a confirmed plan reverses a real wingman waypoint',()=>{
  const a=ship(1,'flanker',220,-50),b=ship(2,'fighter',235,35);
  const cell={members:[a,b],intel:{x:0,y:0,vx:110,vy:0,at:1}};
  const prior=createEnemySquadPlan(cell,'pincer',null,1);
  const retry=createEnemySquadPlan(cell,'pincer',null,10,{recoverFrom:prior});
  const target=cell.intel;
  const first=squadRoleDestination(a,{mode:'pincer',role:'left',
    planId:prior.id,flankSign:prior.flankSign,intel:target},target);
  const second=squadRoleDestination(a,{mode:'pincer',role:'left',
    planId:retry.id,flankSign:retry.flankSign,intel:target},target);
  assert.equal(retry.recovery,true);
  assert.equal(retry.flankSign,-1);
  assert.ok(first.y*second.y<0,'the new flank must be on the other side');
  assert.equal(a.hp,70);assert.equal(b.damage,9);
});

test('a commander alone cannot report a tactic as executed by the squad',()=>{
  const leader=ship(1),wing=ship(2,'flanker',125,15);
  const net=new EnemyComms(),cell={id:1,leader,members:[leader,wing],
    brokenUntil:0,mode:'pincer',intel:{x:0,y:0,at:2}};
  const plan=cell.plan=createEnemySquadPlan(cell,'pincer',null,2);
  net.cells=[cell];
  leader._commsIntent={planId:plan.id,planPhase:0,mode:'pincer',at:2};
  net.confirmExecution({time:2,playerCanInterceptEnemyRadio:()=>false});
  assert.equal(plan.confirmed,false);
  wing._commsIntent={planId:plan.id,planPhase:0,mode:'pincer',at:2};
  net.confirmExecution({time:2,playerCanInterceptEnemyRadio:()=>false});
  assert.equal(plan.confirmed,true);
  assert.equal(plan.lastExecutedAt,2);
});

test('radio orders and actual flight adopt a recovered plan only after a failed sortie',()=>{
  const leader=ship(1,'fighter',140,5),wing=ship(2,'flanker',175,35);
  const enemies=[leader,wing],notices=[];
  const game={time:0,enemies,allies:[],missiles:[],shots:[],
    player:{x:0,y:0,vx:0,vy:0,r:19,hp:120,maxHp:120,invul:999},
    grid:{query:()=>enemies.filter(e=>e.hp>0)},
    avoidance:()=>({x:0,y:0}),enemyCanSee:()=>false,
    enemyShot:()=>false,hurt(){},notice:m=>notices.push(m),
    playerCanInterceptEnemyRadio:()=>true,
    playerCanInspectEnemyIntent:()=>true,
    heritage:{play(){},vfx:{shipExplosion(){}}}};
  const net=game.enemyComms=new EnemyComms();
  net.update(game);
  net.reportSight(leader,game.player,.1);
  game.time=.4;net.update(game);
  const cell=net.cells[0],first=cell.plan;
  assert.ok(first&&first.baseMode==='pincer');
  first.confirmed=true; // The wing kept trying but could not make progress.
  first.lastExecutedAt=9.7;
  game.time=10;
  net.reportSight(leader,game.player,game.time);
  net.update(game);
  const next=cell.plan;
  assert.ok(next&&next.id>first.id&&next.recovery);
  assert.equal(next.flankSign,-1);
  assert.notEqual(next.baseMode,first.baseMode,
    'a failed pincer needs a different first decision');
  const order=net.directiveFor(wing,game.time);
  assert.equal(order?.planId,next.id);
  assert.equal(order?.flankSign,-1,'the transmitted order must reach the wingman');
  updateEnemy(wing,game,1/60);
  assert.equal(wing._commsIntent?.planId,next.id,
    'a received order must alter real flight, not only radio text');
  net.confirmExecution(game);
  assert.ok(notices.some(s=>s.includes('Прежний манёвр сорвался')),
    'a visible interception follows confirmed movement only');
});

test('a damaged shipment draws local protection without revealing its attacker',()=>{
  const near={id:'cargo-healthy',x:130,y:0,hp:180,maxHp:180},
    far={id:'cargo-damaged',x:235,y:0,hp:180,maxHp:180};
  const world={regionalSupply:{convoys:[near,far]},stations:new Map()};
  const leader=ship(1),wing=ship(2,'fighter',115,10);
  const cell={id:1,leader,members:[leader,wing],brokenUntil:0,intel:null};
  assert.equal(planTheater([cell],world,1).get(cell)?.assetId,near.id);
  far.hp=48;
  const changed=planTheater([cell],world,2).get(cell);
  assert.equal(changed?.assetId,far.id);
  assert.equal(changed?.role,'screen');
  assert.equal(changed?.contact,undefined,
    'a cargo damage report must never contain a hidden player position');
  assert.match(changed?.reason||'',/повреждён/);
  far.hp=0;
  assert.equal(planTheater([cell],world,3).get(cell)?.assetId,near.id);
});
