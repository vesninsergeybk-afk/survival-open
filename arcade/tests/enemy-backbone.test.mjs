import test from 'node:test';
import assert from 'node:assert/strict';
import {EnemyMesh,ENEMY_MESH} from '../enemy-mesh.js';
import {BACKBONE,BACKBONE_LINKS,backboneActive,backboneDelay,
 archiveReport,archivedWeapon,threatArchive,visibleBackbone}
 from '../enemy-backbone.js';
import {planTheater,theaterDestination} from '../enemy-strategy.js';

const coords={
 'industry:depot':[7200,1600],
 'industry:source':[4400,2800],
 '28:5':[35000,7000],
 '4:-32':[6000,-40000],
 'frontier:azure:source':[5750,37000],
 'frontier:azure:depot':[11000,40500],
 'frontier:teal:source':[-35500,10500],
 'frontier:teal:depot':[-42000,9000]
};
const station=(id,discovered=true)=>{
 const [x,y]=coords[id];
 return {id,x,y,type:'carrier',title:id,
  strategicRole:id==='28:5'?'mine':'central-depot',
  hp:300,maxHp:300,enemy:true,captured:false,discovered};
};
const ship=(serial,x,y=0)=>({serial,x,y,hp:70,maxHp:70,type:'fighter',
 state:'hunt',r:14,damage:10});
const squad=(id,x,y=0)=>{
 const leader=ship(id*10+1,x,y),wing=ship(id*10+2,x+30,y);
 return {id,leader,members:[leader,wing],brokenUntil:0,mode:null,
  attackReports:[],motionReports:[],lossReports:[],proposals:new Map(),
  intel:null};
};
const game=(stations,cells=[])=>({
 time:2,world:{stations:new Map(stations.map(s=>[s.id,s])),
 regionalSupply:{convoys:[],central:{convoys:[]},
 frontier:{azure:{convoys:[]},teal:{convoys:[]}}}},
 enemies:cells.flatMap(c=>c.members),player:{x:0,y:0,hp:110,maxHp:110},
 tactical:{effects:[]},playerCanInterceptEnemyRadio:()=>false,
 playerCanInspectEnemyIntent:()=>false
});
const evidence=c=>{
 c.attackReports=[{kind:'long',at:.5},{kind:'long',at:1.7}];return c;
};
const tick=(mesh,g,cells,t)=>{g.time=t;mesh.update(g,cells,t)};

test('all interregional trunks terminate on existing, limited-range stations',()=>{
 const list=Object.values(coords).length;
 assert.ok(list>=8);
 assert.equal(BACKBONE_LINKS.length,8);
 const g=game(BACKBONE_LINKS.flat().filter((id,i,a)=>a.indexOf(id)===i)
  .map(id=>station(id)));
 for(const [a,b] of BACKBONE_LINKS){
  assert.ok(g.world.stations.has(a)&&g.world.stations.has(b));
  assert.ok(backboneActive(g.world.stations.get(a),g.world.stations.get(b),g));
  assert.ok(backboneDelay(g.world.stations.get(a),g.world.stations.get(b))>2);
 }
 assert.equal(backboneActive(station('4:-32'),station('frontier:teal:depot'),g),false);
});

test('a report needs two real long-range transmissions to reach military command',()=>{
 const center=station('industry:depot'),mine=station('28:5'),
  military=station('4:-32'),origin=evidence(squad(1,7240,1600));
 const m=new EnemyMesh(),g=game([center,mine,military],[origin]);
 tick(m,g,[origin],2);
 assert.equal(mine.meshArchive,undefined);
 tick(m,g,[origin],2.75);
 assert.equal(archivedWeapon(center,2.75)?.kind,'long');
 assert.equal(archivedWeapon(mine,2.75),null);
 tick(m,g,[origin],9.1);
 assert.equal(archivedWeapon(mine,9.1)?.kind,'long');
 assert.equal(archivedWeapon(military,9.1),null);
 tick(m,g,[origin],19.2);
 assert.equal(archivedWeapon(military,19.2)?.kind,'long');
});

test('capturing the dispatch station during flight destroys the packet route',()=>{
 const center=station('industry:depot'),mine=station('28:5'),
  origin=evidence(squad(1,7250,1600));
 const m=new EnemyMesh(),g=game([center,mine],[origin]);
 tick(m,g,[origin],2);tick(m,g,[origin],2.75);
 center.captured=true;center.enemy=false;
 tick(m,g,[origin],9);
 assert.equal(archivedWeapon(mine,9),null);
 assert.equal(m.nodes.has('s:industry:depot'),false);
});

test('radio jamming disables trunks, and an unjammed surviving station can retransmit',()=>{
 const center=station('industry:depot'),mine=station('28:5'),
  origin=evidence(squad(1,7250,1600));
 const m=new EnemyMesh(),g=game([center,mine],[origin]);
 tick(m,g,[origin],2);tick(m,g,[origin],2.75);
 g.tactical.effects=[{kind:'jam',x:mine.x,y:mine.y,radius:600,until:14}];
 tick(m,g,[origin],9);
 assert.equal(archivedWeapon(mine,9),null);
 assert.equal(backboneActive(center,mine,g),false);
 tick(m,g,[origin],15);
 assert.equal(backboneActive(center,mine,g),true);
 tick(m,g,[origin],22);
 assert.equal(archivedWeapon(mine,22)?.kind,'long');
});

test('regional archive remembers evidence without keeping target coordinates',()=>{
 const s=station('industry:depot');
 assert.ok(archiveReport(s,{kind:'long',at:12,origin:'c:7',x:45,hp:10},14));
 assert.deepEqual(threatArchive(s,14),[
  {kind:'long',assetId:null,lastAt:12,reports:1}
 ]);
 assert.equal(s.meshArchive[0].x,undefined);
 assert.equal(s.meshArchive[0].hp,undefined);
 assert.equal(archivedWeapon(s,200),null);
 assert.equal(archiveReport(s,{kind:'bogus',at:14},14),false);
});

test('stored doctrine can be retransmitted to a newly arrived defender after raw reports expire',()=>{
 const center=station('industry:depot'),mine=station('28:5'),
  source=evidence(squad(1,7250,1600)),m=new EnemyMesh(),
  g=game([center,mine],[source]);
 for(const t of [2,2.75,9,35,60])tick(m,g,[source],t);
 assert.equal(archivedWeapon(mine,60)?.kind,'long');
 const receiver=squad(2,35030,7000);
 g.enemies.push(...receiver.members);
 tick(m,g,[source,receiver],65);
 tick(m,g,[source,receiver],65.8);
 const p=m.bestForCell(receiver,65.8);
 assert.equal(p?.kind,'long');
 assert.equal(p?.archived,true);
 assert.equal('x' in p,false);
 tick(m,g,[source,receiver],183);
 assert.equal(archivedWeapon(mine,183),null);
 assert.equal(m.bestForCell(receiver,183),null);
});

test('received archive summary widens existing convoy guards without free power',()=>{
 const c=squad(5,9000,1500);
 const cargo={id:'cargo-1',regionalCargo:true,x:9100,y:1500,
  hp:100,angle:Math.PI/2};
 const g=game([station('4:-32')],[c]);
 g.world.regionalSupply.convoys=[cargo];
 const base=[...planTheater([c],g.world,4).values()][0];
 const mesh={bestForCell:()=>({kind:'area',archived:true,at:3.7}),
  alarmFor:()=>null};
 const learned=[...planTheater([c],g.world,4,mesh).values()][0];
 assert.equal(base.role,'escort');assert.equal(learned.role,'screen');
 assert.equal(learned.spread,1.25);
 assert.match(learned.reason,/Архив/);
 const before=theaterDestination(c.members[1],{...learned,spread:1});
 const after=theaterDestination(c.members[1],learned);
 assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>10);
 assert.equal(c.members[1].hp,70);assert.equal(c.members[1].damage,10);
});

test('an unseen hostile station is absent from the player trunk map',()=>{
 const left=station('industry:depot'),right=station('28:5',false);
 const g=game([left,right]);
 assert.equal(visibleBackbone(g).length,0);
 right.discovered=true;
 assert.equal(visibleBackbone(g).length,1);
 assert.equal(visibleBackbone(g)[0].active,true);
 left.captured=true;left.enemy=false;
 assert.equal(visibleBackbone(g)[0].active,false);
});

test('bounded budgets keep reports finite with large raids near industrial radios',()=>{
 const hubs=[...new Set(BACKBONE_LINKS.flat())].map(id=>station(id));
 const cells=Array.from({length:100},(_,i)=>{
  const c=squad(i+1,7200+i%20*20,1600+Math.floor(i/20)*30);
  if(i%4===0)evidence(c);
  return c;
 });
 const m=new EnemyMesh(),g=game(hubs,cells);
 for(let k=0;k<20;k++)tick(m,g,cells,2+k*.75);
 assert.ok(m.pending.length<=ENEMY_MESH.maxPending);
 assert.ok(m.events.length<=ENEMY_MESH.maxEvents);
 assert.ok([...m.nodes.values()].every(n=>n.known.size<=ENEMY_MESH.maxPerNode));
 assert.ok(hubs.every(h=>threatArchive(h,16.5).length<=BACKBONE.maxArchive));
});
