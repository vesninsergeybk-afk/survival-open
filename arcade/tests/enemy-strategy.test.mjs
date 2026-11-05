import test from 'node:test';
import assert from 'node:assert/strict';
import {EnemyComms} from '../enemy-comms.js';
import {updateEnemy} from '../ai.js';
import {EnemyTheaterStrategy,THEATER,planTheater,
  theaterAssets,theaterDestination} from '../enemy-strategy.js';

const ship=(serial,x=60,y=10,extra={})=>({
  serial,group:1,x,y,vx:0,vy:0,r:14,type:'fighter',
  hp:58,maxHp:58,state:'hunt',fire:9,think:9,
  damage:12,commitUntil:9,...extra
});
const cell=(id,...members)=>({
  id,leader:members[0],members,brokenUntil:0,intel:null,
  proposals:new Map(),mode:null
});
const world=(cargoes=[],stations=[])=>({
  regionalSupply:{convoys:cargoes,central:{convoys:[]},frontier:{
    azure:{convoys:[]},teal:{convoys:[]}}},
  stations:new Map(stations.map(s=>[s.id,s]))
});
const cargo=(id='cargo-a',x=130,y=0)=>({
  id,regionalCargo:true,x,y,hp:180,maxHp:180,alive:true
});
const game=(ships,w)=>({
  time:1,world:w,enemies:ships,player:{x:0,y:0,vx:0,vy:0,hp:110,r:19},
  grid:{query(x,y,r){return ships.filter(e=>e.hp>0&&
    Math.hypot(e.x-x,e.y-y)<=r);}},
  playerCanInterceptEnemyRadio:()=>false,
  playerCanInspectEnemyIntent:()=>false
});

test('real industrial stock chooses a limited escort, screen and guard',()=>{
  const c=cargo(),base={id:'base-a',strategicRole:'central-depot',
    type:'carrier',enemy:true,x:340,y:40,hp:500,rank:3};
  const w=world([c],[base]);
  assert.equal(theaterAssets(w).length,2);
  const cells=[cell(1,ship(1,40),ship(2,60)),
    cell(2,ship(3,80),ship(4,100)),
    cell(3,ship(5,110),ship(6,130))];
  const found=planTheater(cells,w,2);
  const selected=[...found.values()].filter(o=>o.assetId===c.id);
  assert.equal(selected.length,2,'a convoy never summons unlimited fighters');
  assert.deepEqual(selected.map(o=>o.role).sort(),['escort','screen']);
  assert.ok([...found.values()].every(o=>o.asset.hp>0));
  c.hp=0;
  assert.ok(![...planTheater(cells,w,4).values()].some(o=>o.assetId===c.id),
    'theater stops defending a destroyed shipment');
});

test('regional squads recognize a repair expedition as an industrial protection objective',()=>{
 const w=world(),repair={...cargo('frontier-repair-teal-3',135,0),frontierRepair:true};
 w.regionalSupply.frontier.teal.repairExpedition=repair;
 const assets=theaterAssets(w);
 assert.equal(assets.length,1);
 assert.equal(assets[0].asset,repair);
 assert.ok(assets[0].importance>80,'repair has strategic value');
 const orders=planTheater([cell(1,ship(1,50),ship(2,65))],w,1);
 assert.equal(orders.size,1);
 assert.match([...orders.values()][0].reason,/ремонтный корабль/);
 repair.hp=0;
 assert.equal(planTheater([cell(1,ship(3,50),ship(4,65))],w,3).size,0,
  'theater cannot keep assigning escorts to destroyed maintenance ships');
});

test('theater guards the actual paid repair destination and does not defend a captured one',()=>{
 const repair={...cargo('frontier-repair-teal-4',135,0),frontierRepair:true,
  frontierNetwork:'teal',targetKind:'source',screened:true};
 const source={id:'frontier:teal:source',enemy:true,captured:false,hp:90,x:180,y:0};
 const depot={id:'frontier:teal:depot',enemy:false,captured:true,hp:0,x:250,y:0};
 const w=world([], [source,depot]);w.regionalSupply.frontier.teal.repairExpedition=repair;
 assert.equal(theaterAssets(w,5).length,1,
  'a captured depot must not invalidate a reverse repair traveling to the enemy source');
 assert.equal(theaterAssets(w,5)[0].fundedScreen,true,
  'a ship with a paid escort should carry that decision into strategic planning');
 const orders=planTheater([cell(7,ship(1,60),ship(2,78))],w,5);
 assert.equal([...orders.values()][0]?.role,'screen');
 assert.match([...orders.values()][0]?.reason||'',/ремонтному кораблю/i);
 source.enemy=false;source.captured=true;
 assert.equal(theaterAssets(w,6).length,0,
  'theater must stop protecting a repair expedition whose real target was captured');
});

test('no omniscient remote orders and no stolen scripted missions',()=>{
  const w=world([cargo('c',10000,0)]);
  const remote=cell(1,ship(1,0),ship(2,30));
  assert.equal(planTheater([remote],w,2).size,0);
  const withCargo=world([cargo('near',100,0)]);
  const escort=ship(1,0,0,{protect:withCargo.regionalSupply.convoys[0]});
  const guard=cell(1,escort,ship(2,35));
  assert.equal(planTheater([guard],withCargo,2).size,0,
    'authored escorts retain their existing mission');
  assert.equal(planTheater([cell(2,ship(3),ship(4,10))],
    withCargo,2).size,1);
});

test('orders reach wingmen through bounded radio and respond to broken links',()=>{
  const c=cargo(),w=world([c]),leader=ship(1,50),wing=ship(2,110);
  const ships=[leader,wing],g=game(ships,w),net=new EnemyComms();
  net.update(g);
  const o=net.strategicDirectiveFor(wing,1);
  assert.ok(o&&o.role==='escort');
  assert.ok(net.events.some(e=>e.from===leader&&e.to===wing&&
    e.kind==='strategy'));
  assert.equal(net.theater.directiveFor(leader,1)?.assetId,c.id);
  wing.x=700;
  assert.equal(net.strategicDirectiveFor(wing,1),null);
  assert.equal(net.theater.directiveFor(leader,1)?.role,'escort');
  c.hp=0;g.time=3;net.update(g);
  assert.equal(net.strategicDirectiveFor(leader,3),null);
});

test('following the cargo changes the real waypoint, not player health or weapon stats',()=>{
  const c=cargo(),e=ship(9,20),order={
    asset:c,assetId:c.id,role:'escort'
  };
  const first=theaterDestination(e,order);
  c.x+=120;c.y+=20;
  const second=theaterDestination(e,order);
  assert.ok(Math.hypot(second.x-first.x,second.y-first.y)>20);
  assert.equal(e.hp,58);assert.equal(e.damage,12);
  assert.equal(theaterDestination({...e,protect:c},order),null);
  c.hp=0;assert.equal(theaterDestination(e,order),null);
});

test('intercept requires actual execution and an observable commander',()=>{
  const leader=ship(1,30),wing=ship(2,90);
  const c=cargo(),g=game([leader,wing],world([c]));
  const net=new EnemyComms(),seen=[];
  g.notice=m=>seen.push(m);
  net.update(g);
  assert.equal(net.intercepted(g.time).length,0,
    'a transmitted command is not proof of compliance');
  g.playerCanInspectEnemyIntent=()=>true;
  wing._theaterIntent={at:g.time,assetId:c.id,mode:'escort'};
  net.confirmExecution(g);
  assert.equal(net.intercepted(g.time).length,1);
  assert.match(seen.join(' '),/Сопровождать груз/);
  net.confirmExecution(g);
  assert.equal(net.intercepted(g.time).length,1,'one decision, one notice');
});

test('no visual line to a concealed strategic asset',()=>{
  const c=cargo(),leader=ship(1,40),wing=ship(2,90);
  const g=game([leader,wing],world([c])),net=new EnemyComms();
  net.update(g);
  wing._theaterIntent={at:g.time,assetId:c.id,mode:'escort'};
  let strokes=0;
  const ctx={save(){},restore(){},setLineDash(){},beginPath(){},
    moveTo(){},lineTo(){},stroke(){strokes++;},fillText(){}};
  net.theater.render(ctx,{x:0,y:0,w:400,h:250},1,g);
  assert.equal(strokes,0,'hidden assets have no marker or radio trail');
  g.playerCanInspectEnemyIntent=()=>true;
  net.theater.render(ctx,{x:0,y:0,w:400,h:250},1,g);
  assert.equal(strokes,1);
});

test('theater work is bounded by order age and network range',()=>{
  assert.ok(THEATER.link<=510);
  const c=cargo(),leader=ship(1,35),wing=ship(2,60);
  const g=game([leader,wing],world([c])),net=new EnemyComms();
  net.update(g);
  assert.ok(net.strategicDirectiveFor(wing,1));
  assert.equal(net.strategicDirectiveFor(wing,1+THEATER.orderAge+.01),null);
});

test('only a delivered, asset-specific mesh alarm mobilizes distant reserves',()=>{
  const base={id:'industry:depot',x:870,y:0,hp:300,enemy:true,
    strategicRole:'central-depot'},w=world([],[base]);
  const c=cell(1,ship(1,0),ship(2,25));
  assert.equal(planTheater([c],w,3).size,0,
    'normal patrols cannot learn about a distant alarm from the world map');
  const mesh={alarmFor:(_cell,id)=>id===base.id?
    {kind:'sabotage',assetId:id,at:2}:null,bestForCell:()=>null};
  const chosen=planTheater([c],w,3,mesh).get(c);
  assert.equal(chosen?.role,'reinforce');
  assert.equal(chosen.contact,undefined,'the alert cannot reveal an attacker');
  base.x=THEATER.meshResponseRange+50;
  assert.equal(planTheater([c],w,3,mesh).size,0,
    'even network dispatch has a physical flight range');
});

test('a strategic squad keeps a viable assignment, but eventually reconsiders it',()=>{
  const first=cargo('first',100,0),w=world([first]);
  const c=cell(1,ship(1,0),ship(2,25));
  const original=planTheater([c],w,1).get(c);
  assert.equal(original?.assetId,first.id);
  c.theaterAssignment=original;
  const urgent={...cargo('new-repair',0,0),frontierRepair:true,screened:true};
  w.regionalSupply.convoys.push(urgent);
  const retained=planTheater([c],w,3).get(c);
  assert.equal(retained.assetId,first.id,'routine traffic cannot cause course flips every second');
  assert.equal(retained.startedAt,1,'repeated orders retain their original start');
  c.theaterAssignment=retained;
  const reconsidered=planTheater([c],w,THEATER.commitSeconds+2).get(c);
  assert.equal(reconsidered.assetId,urgent.id,
    'after the commitment, a more valuable nearby repair ship wins');
  first.hp=0;
  assert.equal(planTheater([c],w,4).get(c)?.assetId,urgent.id,
    'destroyed objectives cancel commitment immediately');
});

test('a real pilot steers to its economic objective and then transmits a witnessed decision',()=>{
  const c=cargo('ship-x',0,0),leader=ship(1,180,0),wing=ship(2,212,25);
  const g=game([leader,wing],world([c])),net=new EnemyComms();
  g.enemyComms=net;g.allies=[];g.missiles=[];g.shots=[];
  g.support={missions:[]};g.avoidance=()=>({x:0,y:0});
  g.enemyCanSee=()=>true;g.enemyShot=()=>true;
  g.heritage={play(){},vfx:{shipExplosion(){}}};g.hurt=()=>{};
  g.player.x=450;g.player.y=0;g.player.invul=99;
  net.update(g);
  const before=wing.x;
  updateEnemy(leader,g,.25);updateEnemy(wing,g,.25);
  assert.ok(wing._theaterIntent,'free wingman must execute an assigned economic course');
  assert.equal(wing._theaterIntent.assetId,c.id);
  assert.ok(wing.x<before,'the wingman genuinely flies toward cargo, away from the player');
  assert.equal(wing._commsIntent,null,'the overridden pursuit is not advertised as still being flown');
  assert.equal(net.intercepted(g.time).length,0);
  g.playerCanInspectEnemyIntent=()=>true;
  net.confirmExecution(g);
  assert.ok(net.intercepted(g.time).some(x=>x.message.includes('груз')));
});
