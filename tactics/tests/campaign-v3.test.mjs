import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FIELD,MISSIONS,REWARDS,createMission,resolveTurn,nextMission,normalizePlan,aliveEnemies,aliveAllies,getUnit,forecastTurn,canRelay,inside,distance} from '../rules.js';

const plan=(s,action='shot',targetId=null,formation='strike',destination=s.player)=>
 ({action,targetId,formation,destination:{x:destination.x,y:destination.y}});

test('new operation is a bounded autonomous evacuation with a vulnerable transport',()=>{
 assert.equal(MISSIONS.length,4);
 const state=createMission(3,1729);
 assert.equal(MISSIONS[3].goal,'escort');
 assert.ok(inside(state.convoy));
 assert.equal(getUnit(state,'convoy'),state.convoy);
 assert.ok(state.convoy.x<state.convoy.goalX);
 assert.ok(aliveAllies(state).length>=2,'mission provides minimal rescue backup');
 assert.ok(aliveEnemies(state).some(u=>u.role==='brawler'));
});
test('convoy advances toward the gate and slows if enemy interceptors are nearby',()=>{
 const open=createMission(3,1729);open.ships=open.ships.filter(u=>u.side==='ally');
 const first=resolveTurn(open,plan(open,'boost'));
 assert.equal(first.convoy.x-open.convoy.x,138);
 const blocked=createMission(3,1729);
 blocked.ships=[...blocked.ships.filter(u=>u.side==='ally'),
  {id:'interceptor-0',role:'scout',side:'enemy',x:blocked.convoy.x+100,y:blocked.convoy.y,hp:40,maxHp:40,suppressed:0,hack:0}];
 const slowdown=resolveTurn(blocked,plan(blocked,'boost'));
 assert.equal(slowdown.convoy.x-blocked.convoy.x,68);
});
test('enemy attacks the convoy when close, and forecast exactly matches resulting hull damage',()=>{
 const s=createMission(3,1729);
 s.ships=[{id:'raider-0',role:'rocket',side:'enemy',x:550,y:530,hp:62,maxHp:62,hack:0,suppressed:0}];
 s.asteroids=[];
 const expected=forecastTurn(s,plan(s,'boost'));
 const incoming=expected.shots.filter(x=>x.to.id==='convoy').reduce((a,x)=>a+x.amount,0);
 assert.ok(incoming>0);
 const actual=resolveTurn(s,plan(s,'boost'));
 assert.equal(s.convoy.hp-actual.convoy.hp,incoming);
 assert.ok(actual.events.some(x=>x.kind==='shot'&&x.to==='convoy'));
});
test('convoy destruction loses the mission independently of pilot hull',()=>{
 const s=createMission(3,1729);s.player.hp=110;s.convoy.hp=1;
 s.ships=[{id:'raider-0',role:'rocket',side:'enemy',x:550,y:530,hp:62,maxHp:62,hack:0,suppressed:0}];s.asteroids=[];
 const after=resolveTurn(s,plan(s,'hack'));
 assert.equal(after.phase,'lost');
 assert.equal(after.player.hp,110);
 assert.equal(after.convoy.hp,0);
});
test('convoy can complete extraction once threats are removed',()=>{
 let s=createMission(3,1729);s.ships=[];
 for(let i=0;i<16&&s.phase==='planning';i++)s=resolveTurn(s,plan(s,'boost'));
 assert.equal(s.phase,'won');
 assert.ok(s.convoy.x>=s.convoy.goalX-2);
 assert.ok(s.convoy.hp>0);
});
test('individual waypoints control only allied units, leaving unselected aircraft automatic',()=>{
 const s=createMission(3,1729);s.ships=s.ships.filter(u=>u.side==='ally');
 const assigned=s.ships[0],unassigned=s.ships[1];
 const target={x:1700,y:820},playerDestination={x:200,y:530};
 const p={action:'boost',formation:'escort',destination:playerDestination,
  allyOrders:{[assigned.id]:target,[unassigned.id]:{x:-50,y:10},'hostile-3-0':{x:200,y:200}}};
 const norm=normalizePlan(s,p);
 assert.deepEqual(Object.keys(norm.allyOrders),[assigned.id]);
 const after=resolveTurn(s,p);
 assert.ok(distance(getUnit(after,assigned.id),target)<distance(assigned,target));
 assert.ok(distance(getUnit(after,unassigned.id),target)>distance(getUnit(after,assigned.id),target));
 assert.deepEqual(s.ships[0],assigned,'forecast/turn may not mutate pre-turn position');
});
test('reward choice affects later missions and is preserved when restarting a checkpoint',()=>{
 const s=createMission(0,1729);s.phase='won';s.player.hp=61;
 s.ships=s.ships.slice(0,2).map(u=>({...u,side:'ally'}));
 assert.equal(REWARDS[0].length,2);
 const armor=nextMission(s,'plating'),signal=nextMission(s,'signal');
 assert.equal(armor.mission,1);
 assert.equal(armor.player.maxHp,130);
 assert.ok(armor.player.hp>signal.player.hp);
 assert.ok(signal.player.upgrades.includes('signal'));
 assert.equal(signal.player.maxHp,110);
 assert.deepEqual(createMission(signal.mission,signal.seed,signal.entry),signal);
 const a=nextMission({...armor,phase:'won'},'overcharge');
 assert.equal(a.player.maxCharge,3);
 assert.ok(a.player.upgrades.includes('overcharge'));
});
test('signal upgrades extend direct hacking range and guns improve direct shots',()=>{
 const base=createMission(1,1729),extended=createMission(1,1729,{player:{hp:100,charge:2,upgrades:['signal']},ships:[]});
 for(const s of [base,extended]){s.ships=[];s.player.x=s.stations[0].x-270;s.player.y=s.stations[0].y;}
 assert.equal(canRelay(base,base.stations[0]).ok,false);
 assert.equal(canRelay(extended,extended.stations[0]).ok,true);
 const noGun=createMission(0,1729),gun=createMission(0,1729,{player:{hp:110,charge:2,upgrades:['weapon']},ships:[]});
 for(const s of [noGun,gun]){
  s.ships=[s.ships[0]];s.ships[0].hp=100;s.ships[0].maxHp=100;
  s.player.x=s.ships[0].x-65;s.player.y=s.ships[0].y;s.asteroids=[];
 }
 const a=resolveTurn(noGun,plan(noGun,'shot',noGun.ships[0].id));
 const b=resolveTurn(gun,plan(gun,'shot',gun.ships[0].id));
 assert.equal(a.ships[0].hp-b.ships[0].hp,9);
});
test('playable convoy strategy wins across several layouts while unattended transport is lost',()=>{
 for(const seed of [1700,1701,1713,1734,1749]){
  let s=createMission(3,seed,{player:{hp:90,charge:1,upgrades:['weapon','plating']},ships:[],networkSlots:2});
  for(let k=0;k<24&&s.phase==='planning';k++){
   const enemy=aliveEnemies(s).slice().sort((a,b)=>distance(a,s.convoy)-distance(b,s.convoy))[0];
   let command={action:'shot',formation:'strike',targetId:enemy?.id,
    destination:{x:s.convoy.x+110,y:s.convoy.y}};
   const forecast=forecastTurn(s,command),damage=forecast.shots.filter(x=>x.to.id==='convoy').reduce((a,x)=>a+x.amount,0);
   if(damage>=12&&s.player.charge>0)command.action='pulse';
   s=resolveTurn(s,command);
  }
  assert.equal(s.phase,'won','escort should be winnable on seed '+seed);
 }
 const idle=createMission(3,1700,{player:{hp:90,charge:1},ships:[],networkSlots:2});
 let s=idle;
 for(let i=0;i<24&&s.phase==='planning';i++)s=resolveTurn(s,plan(s,'hack'));
 assert.equal(s.phase,'lost','doing nothing must not be a dominant escort strategy');
});
test('updated HUD shows campaign, ally controls, upgrade choices and old-arcade link',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 for(const id of ['convoy-status','convoy-progress','convoy-health','focus-player','active-unit','salvage-panel','upgrade-0','upgrade-1','ally-orders-summary'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(js,/PRIOR_STORE/);
 assert.match(js,/nextMission\(world,selectedUpgrade\)/);
 assert.match(html,/href="\.\.\/arcade\/"/);
});
