import test from 'node:test';
import assert from 'node:assert/strict';
import {EnemyMesh,ENEMY_MESH} from '../enemy-mesh.js';
import {EnemyComms} from '../enemy-comms.js';
import {planTheater} from '../enemy-strategy.js';

const ship=(serial,x,y=0)=>({
  serial,group:Math.floor(serial/10),x,y,vx:0,vy:0,r:14,
  type:'fighter',state:'hunt',hp:70,maxHp:70,damage:12,
  think:10,fire:10,commitUntil:10
});
const group=(id,x)=>{
  const leader=ship(id*10+1,x),wing=ship(id*10+2,x+18,15);
  return {id,leader,members:[leader,wing],
    brokenUntil:0,mode:null,intel:null,proposals:new Map(),
    attackReports:[],lossReports:[],motionReports:[]};
};
const station=(id,x,y=0)=>({
  id,x,y,hp:250,maxHp:250,enemy:true,captured:false,
  strategicRole:'central-depot',type:'carrier',rank:2
});
const world=(stations=[])=>({
  stations:new Map(stations.map(s=>[s.id,s])),
  regionalSupply:{convoys:[],central:{convoys:[]},
    frontier:{azure:{convoys:[]},teal:{convoys:[]}}}
});
const game=(stations=[],cells=[])=>({
  time:2,world:world(stations),enemies:cells.flatMap(c=>c.members),
  player:{x:1500,y:0,vx:240,vy:0,hp:110,maxHp:110,r:19},
  grid:{query(x,y,r){return cells.flatMap(c=>c.members).filter(e=>
    e.hp>0&&Math.hypot(e.x-x,e.y-y)<=r);}},
  playerCanInspectEnemyIntent:()=>false,
  playerCanInterceptEnemyRadio:()=>false
});
const attack=(cell,kind='long')=>{
  cell.attackReports=[{kind,at:.5},{kind,at:1.7}];return cell;
};

test('multi-hop mesh requires two real timed transfers, not global teleport',()=>{
  const a=attack(group(1,0)),b=group(2,1450),relay=station('relay',720);
  const m=new EnemyMesh(),g=game([relay],[a,b]);
  m.update(g,[a,b],2);
  assert.equal(m.bestForCell(b,2),null);
  assert.equal(m.pending.length>0,true);
  m.update(g,[a,b],2.75);
  assert.equal(m.bestForCell(b,2.75),null,'one hop cannot reach second squad');
  assert.ok(relay.meshIntel?.some(p=>p.kind==='long'));
  m.update(g,[a,b],3.5);
  assert.equal(m.bestForCell(b,3.5)?.kind,'long');
  assert.ok(m.deliveries>=2);
  assert.ok(m.messages>=2);
});

test('no station means disconnected squadrons have no shared threat knowledge',()=>{
  const a=attack(group(1,0)),b=group(2,1450),m=new EnemyMesh(),g=game([],[a,b]);
  for(const time of [2,2.9,3.8,4.7])m.update(g,[a,b],time);
  assert.equal(m.bestForCell(b,4.7),null);
});

test('a suppressed, destroyed or captured relay drops in-flight packets',()=>{
  for(const change of [
    s=>{s.suppressed=true;},
    s=>{s.enemy=false;s.captured=true;},
    s=>{s.hp=0;}
  ]){
    const a=attack(group(1,0)),b=group(2,1450),s=station('relay',720);
    const m=new EnemyMesh(),g=game([s],[a,b]);
    m.update(g,[a,b],2);
    change(s);
    for(const time of [2.75,3.5,4.3])m.update(g,[a,b],time);
    assert.equal(m.bestForCell(b,4.3),null);
    assert.equal(m.deliveries,0);
  }
});

test('verified information survives the scout loss only if the relay received it',()=>{
  const a=attack(group(1,0)),b=group(2,1450),s=station('relay',720);
  const m=new EnemyMesh(),g=game([s],[a,b]);
  m.update(g,[a,b],2);
  m.update(g,[a,b],2.75);
  a.leader.hp=0;
  m.update(g,[a,b],3.5);
  assert.equal(m.bestForCell(b,3.5)?.kind,'long');
  assert.ok(s.meshIntel?.some(p=>p.kind==='long'));
});

test('station remembers bounded reports across checkpoint reconstruction',()=>{
  const a=attack(group(1,0)),b=group(2,1450),s=station('relay',720);
  const old=new EnemyMesh(),g=game([s],[a,b]);
  old.update(g,[a,b],2);old.update(g,[a,b],2.75);
  const saved=JSON.parse(JSON.stringify(s));
  assert.ok(Array.isArray(saved.meshIntel));
  const restored=new EnemyMesh(),newGame=game([saved],[b]);
  restored.update(newGame,[b],3);
  assert.equal(restored.bestForCell(b,3),null);
  restored.update(newGame,[b],3.8);
  assert.equal(restored.bestForCell(b,3.8)?.kind,'long');
  restored.update(newGame,[b],52);
  assert.equal(restored.bestForCell(b,52),null,
    'historical threat cannot cause indefinite combat adaptation');
});

test('one unconfirmed impact is not enough for network-wide weapon doctrine',()=>{
  const a=group(1,0),b=group(2,1450),s=station('relay',720);
  a.attackReports=[{kind:'area',at:1.7}];
  const m=new EnemyMesh(),g=game([s],[a,b]);
  for(const time of [2,2.75,3.5])m.update(g,[a,b],time);
  assert.equal(m.bestForCell(b,3.5),null);
});

test('relay never transmits exact player position or current hull strength',()=>{
  const a=attack(group(1,0)),b=group(2,1450),s=station('relay',720);
  a.intel={x:0,y:0,vx:240,vy:0,at:1.7,estimated:false,
    hullRatio:.14};
  const m=new EnemyMesh(),g=game([s],[a,b]);
  m.update(g,[a,b],2);m.update(g,[a,b],2.75);m.update(g,[a,b],3.5);
  const packet=m.bestForCell(b,3.5);
  assert.ok(packet);
  assert.equal(Object.hasOwn(packet,'x'),false);
  assert.equal(Object.hasOwn(packet,'vx'),false);
  assert.equal(Object.hasOwn(packet,'hp'),false);
  assert.equal(Object.hasOwn(packet,'hullRatio'),false);
});

test('repeated sightings are rate-limited and links are visually witnessed',()=>{
  const a=group(1,0),b=group(2,1450),s=station('relay',720);
  const m=new EnemyMesh(),g=game([s],[a,b]);
  a.intel={x:0,y:0,at:1.8,estimated:false};
  m.update(g,[a,b],2);
  const first=m.nodes.get('c:1').known.size;
  for(const [time,at] of [[2.75,2.6],[3.5,3.3],[4.25,4.0]]){
    a.intel.at=at;m.update(g,[a,b],time);
  }
  assert.equal(m.nodes.get('c:1').known.size,first,
    'continuous sight does not saturate the mesh with copies');
  let strokes=0;
  const ctx={save(){},restore(){},setLineDash(){},beginPath(){},
    moveTo(){},lineTo(){},stroke(){strokes++;}};
  m.render(ctx,{x:-20,y:-50,w:1600,h:200},4.25,g,60);
  assert.equal(strokes,0);
  g.playerCanInspectEnemyIntent=()=>true;
  m.render(ctx,{x:-20,y:-50,w:1600,h:200},4.25,g,60);
  assert.ok(strokes>0,'the drawn line corresponds to an actual receipt');
});

test('mesh transmission and memory stay bounded with 200 drones and many relays',()=>{
  const cells=Array.from({length:30},(_,i)=>{
    const c=group(i+1,i*100);c.attackReports=[
      {kind:'long',at:.5},{kind:'long',at:1.7}];return c;
  });
  const relays=Array.from({length:80},(_,i)=>station('s'+i,i*120));
  const m=new EnemyMesh(),g=game(relays,cells);
  for(const t of [2,2.75,3.5,4.25,5,5.75])m.update(g,cells,t);
  assert.ok(m.pending.length<=ENEMY_MESH.maxPending);
  assert.ok(m.events.length<=ENEMY_MESH.maxEvents);
  assert.ok([...m.nodes.values()].every(n=>n.known.size<=ENEMY_MESH.maxPerNode));
});

test('delivered attack alarm changes local defense without imaginary gun positions',()=>{
  const c=group(2,1450),d=station('industry:depot',1500);
  const mesh={alarmFor:()=>({kind:'sabotage',assetId:d.id,at:3}),
    bestForCell:()=>null};
  const orders=planTheater([c],world([d]),3.5,mesh);
  assert.equal(orders.size,1);
  const order=[...orders.values()][0];
  assert.equal(order.role,'reinforce');
  assert.match(order.reason,/Сеть сообщает о нападении/);
  assert.equal(order.contact,undefined,'no fake shooter coordinates');
});

test('recipient does not change tactics until it itself sees the player',()=>{
  const a=attack(group(1,0)),b=group(2,1450),relay=station('relay',720);
  const g=game([relay],[a,b]),net=new EnemyComms();
  g.time=0;net.update(g);
  const source=net.cells.find(c=>c.members.some(e=>e.serial===a.leader.serial));
  const remote=net.cells.find(c=>c.members.some(e=>e.serial===b.leader.serial));
  assert.ok(source&&remote&&source!==remote);
  source.attackReports=[{kind:'long',at:.5},{kind:'long',at:1.7}];
  for(const t of [2,2.75,3.5]){
    g.time=t;net.update(g);
  }
  assert.equal(remote.threat?.mesh,undefined,
    'remote observation alone cannot be promoted to local target knowledge');
  assert.equal(net.mesh.bestForCell(remote,3.5)?.kind,'long');
  // Only after this particular squad spots the target can it use the
  // learned weapon category to choose a combat manoeuvre.
  g.time=4.25;
  net.reportSight(remote.leader,g.player,4.1);
  net.update(g);
  assert.equal(remote.threat?.mesh,true);
  assert.equal(remote.threat.kind,'long');
  assert.equal(remote.mode,'close');
  assert.equal(Object.hasOwn(remote.threat,'x'),false);
});
