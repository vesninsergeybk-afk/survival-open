import test from 'node:test';
import assert from 'node:assert/strict';
import {EnemyComms} from '../enemy-comms.js';
import {THEATER,EnemyTheaterStrategy,theaterAssets,planTheater,theaterDestination}
  from '../enemy-strategy.js';

const ship=(serial,x=serial*25,y=0,extra={})=>({
  serial,group:1,type:'fighter',state:'hunt',x,y,vx:0,vy:0,r:14,
  hp:70,maxHp:70,damage:12,think:10,fire:10,commitUntil:5,...extra
});
const cell=(id,x,y=0)=>{
  const leader=ship(id*10+1,x,y),wing=ship(id*10+2,x+22,y+25);
  return {id,leader,members:[leader,wing],brokenUntil:0,
    proposals:new Map(),intel:null,mode:null};
};
const cargo=(id='cargo-a',x=190,y=0,kind='regionalCargo')=>({
  id,[kind]:true,x,y,angle:Math.PI/2,hp:180,maxHp:180,r:43
});
const station=(id,x=220,y=0,role='central-depot')=>({
  id,x,y,hp:300,maxHp:300,enemy:true,captured:false,
  strategicRole:role,type:'carrier',rank:3
});
const supply=(cargoes=[],rest={})=>({
  convoys:cargoes,central:{convoys:[],reserves:0},
  frontier:{azure:{convoys:[]},teal:{convoys:[]}},...rest
});
const world=(s,stations=[])=>({
  regionalSupply:s,stations:new Map(stations.map(a=>[a.id,a]))
});
const game=(s,ships,w)=>({
  time:1,world:w,enemies:ships,player:{x:500,y:0,hp:100},
  grid:{query(x,y,r){return ships.filter(e=>e.hp>0&&
    Math.hypot(e.x-x,e.y-y)<=r);}},
  playerCanInspectEnemyIntent:()=>false,
  playerCanInterceptEnemyRadio:()=>false
});

test('strategic asset loses military value after the destination is captured',()=>{
  const c=cargo('regional-cargo-1');
  const depot=station('4:-32',250,0,'military');
  const w=world(supply([c]),[depot]);
  assert.ok(theaterAssets(w,1).some(x=>x.id===c.id));
  depot.enemy=false;depot.captured=true;
  assert.ok(!theaterAssets(w,2).some(x=>x.id===c.id),
    'destroyed enemy supply is not guarded as though it could still fund a raid');
  assert.equal(planTheater([cell(1,25)],w,2).size,0);
});

test('industry paid for escort screens; that really changes the strategic role',()=>{
  const c=cargo('central-cargo-1',160,0,'centralCargo');
  const w=world(supply([],{
    central:{convoys:[c],reserves:0,strategy:{screened:true}}
  }),[]);
  const calls=[cell(1,20),cell(2,50)];
  const options=[...planTheater(calls,w,3).values()];
  assert.equal(options.length,2);
  assert.equal(options[0].role,'screen',
    'paid screen replaces plain escort without generating extra enemies');
  assert.match(options[0].reason,/подготовлен/);
  w.regionalSupply.central.strategy.screened=false;
  const again=[...planTheater(calls,w,4).values()];
  assert.equal(again[0].role,'escort');
});

test('attacked depot splits two cells into defense and bounded counterattack',()=>{
  const depot=station('industry:depot',180);
  const cells=[cell(1,20),cell(2,50)];
  for(const c of cells)c.intel={
    x:300,y:20,vx:240,vy:0,at:5,estimated:false
  }; // This is the squad's delivered sighting, never a live player pointer.
  const chosen=[...planTheater(cells,world(supply([]),[depot]),5).values()];
  assert.deepEqual(chosen.map(x=>x.role).sort(),['reinforce','repel']);
  const pursuit=chosen.find(x=>x.role==='repel');
  const pos=theaterDestination(cells[1].members[1],pursuit);
  assert.ok(pos);
  assert.ok(Math.hypot(pos.x-depot.x,pos.y-depot.y)<430,
    'counterattack stays inside a defensive perimeter');
  assert.equal(pursuit.contact.x,300);
  assert.notEqual(pos.x,500,'no magic chase after the player moves elsewhere');
});

test('without a delivered and fresh sighting there is no speculative pursuit',()=>{
  const depot=station('industry:depot',180),w=world(supply([]),[depot]);
  const cells=[cell(1,20),cell(2,50)];
  for(const c of cells)c.intel={x:210,y:0,at:0,estimated:false};
  assert.deepEqual([...planTheater(cells,w,7).values()].map(o=>o.role),
    ['defend']);
  for(const c of cells)c.intel={x:210,y:0,at:7,estimated:true};
  assert.deepEqual([...planTheater(cells,w,7).values()].map(o=>o.role),
    ['defend'],'an impact bearing is not an eyewitness account');
});

test('a single commander executing its private order cannot generate an intercept',()=>{
  const c=cargo(),leader=ship(1,30),wing=ship(2,55),ships=[leader,wing];
  const g=game(null,ships,world(supply([c])));
  const net=new EnemyComms(),notices=[];
  g.notice=m=>notices.push(m);
  net.update(g);
  const order=net.strategicDirectiveFor(leader,g.time);
  assert.ok(order);
  g.playerCanInspectEnemyIntent=()=>true;
  leader._theaterIntent={at:g.time,assetId:c.id,mode:order.role};
  net.confirmExecution(g);
  assert.equal(net.intercepted(g.time).length,0);
  wing._theaterIntent={at:g.time,assetId:c.id,mode:order.role};
  net.confirmExecution(g);
  assert.equal(net.intercepted(g.time).length,1);
  assert.equal(notices.length,1);
});

test('disconnected or unfit wingmen cannot confirm a strategic command',()=>{
  const c=cargo(),leader=ship(1,30),wing=ship(2,55),ships=[leader,wing];
  const g=game(null,ships,world(supply([c]))),net=new EnemyComms();
  net.update(g);g.playerCanInspectEnemyIntent=()=>true;
  const role=net.strategicDirectiveFor(leader,1).role;
  wing.x=900;wing._theaterIntent={at:1,assetId:c.id,mode:role};
  net.confirmExecution(g);
  assert.equal(net.intercepted(1).length,0,'out-of-radio wingman is not compliant');
  wing.x=55;wing.state='charge';
  net.confirmExecution(g);
  assert.equal(net.intercepted(1).length,0,
    'a charging rammer cannot also comply with an escort order');
});

test('real cargo movement changes fixed forward screening lanes',()=>{
  const c=cargo(),pilot=ship(7,65);
  const order={asset:c,assetId:c.id,role:'screen',kind:'cargo'};
  const first=theaterDestination(pilot,order);
  assert.ok(first.x>c.x+120,'screen anticipates the moving cargo, not trails it');
  c.angle=Math.PI; // New route turns north while the pilot remains still.
  const second=theaterDestination(pilot,order);
  assert.ok(Math.hypot(second.x-first.x,second.y-first.y)>100,
    'the screen changes position as the convoy turns');
  assert.equal(pilot.hp,70);assert.equal(pilot.damage,12);
});

test('ordinary high-rank procedural stations cannot take industrial assets budget',()=>{
  const generic={...station('proc:depot',90),strategicRole:undefined,rank:5};
  const valuable=station('industry:depot',170,0,'central-depot');
  const selected=theaterAssets(world(supply([]),[generic,valuable]));
  assert.deepEqual(selected.map(x=>x.id),[valuable.id]);
});

test('theater keeps at most two cells per threatened asset under crowd pressure',()=>{
  const depot=station('industry:depot',220),cells=[];
  for(let i=0;i<80;i++){
    const c=cell(i+1,10+(i%8)*10);
    c.intel={x:260,y:0,at:10,estimated:false};cells.push(c);
  }
  const found=planTheater(cells,world(supply([]),[depot]),10);
  assert.equal(found.size,THEATER.maxSiteCells);
  assert.ok([...found.values()].every(o=>o.assetId===depot.id));
});

test('asset capture invalidates delivered theater orders at the next decision',()=>{
  const c=cargo(),leader=ship(1,30),wing=ship(2,55),ships=[leader,wing];
  const depot=station('4:-32',400,0,'military');
  const g=game(null,ships,world(supply([c]),[depot])),net=new EnemyComms();
  net.update(g);
  assert.equal(net.strategicDirectiveFor(wing,1).assetId,c.id);
  depot.enemy=false;depot.captured=true;
  g.time=3;net.update(g);
  assert.equal(net.strategicDirectiveFor(wing,3),null);
});


test('existing pursuit does not silently become peaceful station guard duty',()=>{
  const depot=station('industry:depot',180,0),c=cell(1,20);
  c.intel={x:880,y:0,at:5,estimated:false};
  assert.equal(planTheater([c],world(supply([]),[depot]),5).size,0,
    'a verified remote encounter is not abandoned for an unthreatened site');
});

test('defenders face the confirmed approach and never use a live player pointer',()=>{
  const depot=station('industry:depot',180),w=world(supply([]),[depot]);
  const c=cell(1,20),pilot=c.members[1];
  c.intel={x:300,y:0,at:5,estimated:false};
  const right=[...planTheater([c],w,5).values()][0];
  assert.equal(right.role,'reinforce');
  const first=theaterDestination(pilot,right);
  c.intel={x:60,y:0,at:5,estimated:false};
  const left=[...planTheater([c],w,5).values()][0];
  const second=theaterDestination(pilot,left);
  assert.ok(Math.hypot(first.x-second.x,first.y-second.y)>150,
    'real delivered threat bearing changes the guarded perimeter');
});

test('repelling a witnessed attack is displayed as an intercept, not generic cover',()=>{
  const depot=station('industry:depot',180),calls=[cell(1,20),cell(2,50)];
  const ships=calls.flatMap(c=>c.members),g=game(null,ships,world(supply([]),[depot]));
  g.time=5;g.playerCanInspectEnemyIntent=()=>true;
  for(const c of calls){
    c.intel={x:300,y:0,at:5,estimated:false};
    for(const e of c.members)e._commsCell=c;
  }
  const net={cells:calls,send:()=>true,intercepts:[]};
  const strategy=new EnemyTheaterStrategy();
  strategy.update(g,net);
  const repelling=calls.find(c=>c.theaterAssignment?.role==='repel');
  assert.ok(repelling);
  const wing=repelling.members[1];
  const order=strategy.directiveFor(wing,5);
  assert.equal(order.role,'repel');
  wing._theaterIntent={at:5,assetId:order.assetId,mode:'repel'};
  strategy.confirmExecution(g,net);
  assert.equal(net.intercepts.length,1);
  assert.equal(net.intercepts[0].mode,'intercept');
  assert.match(net.intercepts[0].message,/Оттеснить/);
});
