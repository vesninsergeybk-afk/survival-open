import test from 'node:test';
import assert from 'node:assert/strict';
import {EnemyComms} from '../enemy-comms.js';
import {updateEnemy} from '../ai.js';
import {operationalFront,operationalPriorities} from '../enemy-operational-command.js';
import {planTheater,theaterAssets,theaterMapPaths} from '../enemy-strategy.js';

const ship=(serial,x=20,y=0)=>({serial,x,y,group:1,vx:0,vy:0,
  type:'fighter',hp:70,maxHp:70,r:14,state:'hunt'});
const cell=(leader,wing)=>({id:4,leader,members:[leader,wing],
  brokenUntil:0,intel:null});
const cargo=(hp=180)=>({id:'delivery',centralCargo:true,x:140,y:0,
  hp,maxHp:180,angle:Math.PI/2});
const station=(id,role,x,hp,maxHp=300)=>({id,strategicRole:role,
  enemy:true,captured:false,x,y:0,hp,maxHp});
const world=(ships=[],stations=[])=>({regionalSupply:{
  central:{ore:0,reserves:0,convoys:ships},
  frontier:{azure:{convoys:[]},teal:{convoys:[]}}},
  stations:new Map(stations.map(s=>[s.id,s]))});

test('operational intelligence relies only on owned industrial assets',()=>{
 const freight=cargo(175),depot=station('industry:depot','central-depot',170,110);
 const source=station('industry:source','central-source',100,280);
 const w=world([freight],[depot,source]);
 w.regionalSupply.central.worker={hp:70,phase:'seek',rockDepleted:false,carry:0};
 const assets=theaterAssets(w),plan=operationalPriorities(assets,w).get('home');
 assert.equal(plan?.code,'hold');
 assert.equal(plan?.assetId,depot.id);
 const leader=ship(1),wing=ship(2,40);
 const chosen=planTheater([cell(leader,wing)],w,5).values().next().value;
 assert.equal(chosen.assetId,depot.id,'nearby flights defend damaged industry before intact freight');
 assert.equal(chosen.role,'reinforce');
 assert.equal(chosen.contact,undefined,'damage cannot reveal the attacker position');
 assert.match(chosen.reason,/повреждён/);
 assert.equal(operationalFront({frontierCargo:true,frontierNetwork:'azure'}),'azure');
 assert.equal(operationalFront({strategicRole:'military'}),'north');
});

test('headquarters switches to convoy rescue then source security as conditions change',()=>{
 const freight=cargo(40),depot=station('industry:depot','central-depot',200,300);
 const source=station('industry:source','central-source',80,280);
 const w=world([freight],[depot,source]);
 w.regionalSupply.central.worker={hp:70,phase:'seek',rockDepleted:false,carry:0};
 let o=operationalPriorities(theaterAssets(w),w).get('home');
 assert.equal(o?.code,'rescue');
 assert.equal(o?.assetId,freight.id);
 freight.hp=180;source.hp=130;
 o=operationalPriorities(theaterAssets(w),w).get('home');
 assert.equal(o?.code,'source');
 source.hp=300;
 w.regionalSupply.central.convoys=[];
 o=operationalPriorities(theaterAssets(w),w).get('home');
 assert.equal(o?.code,'supply');
 w.regionalSupply.central.ore=8;
 assert.equal(operationalPriorities(theaterAssets(w),w).has('home'),false);
 source.enemy=false;source.captured=true;
 assert.equal(operationalPriorities(theaterAssets(w),w).has('home'),false,
   'a captured source cannot remain an operational objective');
});

test('an operational interception follows an executed received order, never planning alone',()=>{
 const leader=ship(1),wing=ship(2,55),target=station('industry:depot','central-depot',135,95);
 const w=world([cargo(180)],[target]);
 const g={time:1,world:w,enemies:[leader,wing],
  playerCanInspectEnemyIntent:()=>true,playerCanInterceptEnemyRadio:()=>true,
  notice:()=>{},grid:{query:()=>[leader,wing]},player:{x:300,y:0,hp:100,maxHp:100}};
 const net=g.enemyComms=new EnemyComms();
 net.update(g);
 assert.equal(net.intercepted(1).length,0);
 assert.equal(theaterMapPaths(g,(x,y)=>({x,y}),()=>true),'',
   'a tactical arrow must not be drawn before a wingman steers');
 const order=net.strategicDirectiveFor(wing,1);
 assert.equal(order?.operation?.code,'hold');
 wing._theaterIntent={at:1,assetId:target.id,mode:order.role};
 net.confirmExecution(g);
 const intercepted=net.intercepted(1);
 assert.equal(intercepted.length,1);
 assert.equal(intercepted[0].mode,'operation');
 assert.match(intercepted[0].message,/Оперативный штаб/);
 assert.match(theaterMapPaths(g,(x,y)=>({x,y}),()=>true),/enemy-map-operation/);
 net.confirmExecution(g);
 assert.equal(net.intercepted(1).length,1);
 g.playerCanInspectEnemyIntent=ref=>ref!==target;
 assert.equal(theaterMapPaths(g,(x,y)=>({x,y}),()=>true),'',
   'radio text must not disclose a concealed industrial site');
});

test('a distant wing cannot receive the new headquarters priority by magic',()=>{
 const target=station('industry:depot','central-depot',1000,100);
 const w=world([],[target]),c=cell(ship(1,0),ship(2,25));
 assert.equal(planTheater([c],w,1).size,0);
 assert.equal(planTheater([c],w,1,{
  alarmFor:()=>null,bestForCell:()=>null}).size,0);
 const mesh={alarmFor:(_c,id)=>id===target.id?{at:1,kind:'sabotage',assetId:id}:null,
  bestForCell:()=>null};
 assert.equal(planTheater([c],w,1,mesh).size,0,
   'even a true mesh alarm cannot bypass the physical response radius');
 target.x=750;
 assert.equal(planTheater([c],w,1,mesh).size,1);
});

test('damage-triggered operational defense genuinely steers a wing toward its station',()=>{
 const target=station('industry:depot','central-depot',0,90);
 const leader=ship(1,210),wing=ship(2,245),ships=[leader,wing];
 const g={time:4,world:world([],[target]),enemies:ships,allies:[],
  shots:[],missiles:[],player:{x:560,y:20,vx:0,vy:0,hp:110,maxHp:110,r:19,invul:90},
  grid:{query:()=>ships},avoidance:()=>({x:0,y:0}),
  enemyCanSee:()=>false,enemyShot:()=>false,notice:()=>{},hurt:()=>{},
  playerCanInspectEnemyIntent:()=>true,playerCanInterceptEnemyRadio:()=>true,
  support:{missions:[]},heritage:{play(){},vfx:{shipExplosion(){}}}};
 g.enemyComms=new EnemyComms();g.enemyComms.update(g);
 const directive=g.enemyComms.strategicDirectiveFor(wing,g.time);
 assert.equal(directive?.operation?.code,'hold');
 const before=Math.hypot(wing.x-target.x,wing.y-target.y);
 updateEnemy(wing,g,.25);
 assert.equal(wing._theaterIntent?.assetId,target.id);
 assert.equal(wing._theaterIntent?.mode,'reinforce');
 assert.ok(Math.hypot(wing.x-target.x,wing.y-target.y)<before,
  'the wing must change its real position, not just its displayed order');
});
