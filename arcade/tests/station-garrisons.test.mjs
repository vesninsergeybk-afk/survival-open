import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {connectContour,createContours,contourFields} from '../territory-system.js';
import {stationTrialField,stationGarrisonOffer,commissionStationGarrison,
 advanceStationGarrisons,activeStationGarrisons,damageStationGarrison,
 validStationGarrison,STATION_GARRISONS} from '../station-garrisons.js';
import {TURRET_DEFENSE,advanceTurretDefenses,damageFriendlyTurret,
 turretShieldCapacity} from '../turret-defense.js';
import {TURRET_SCREEN,turretBranchOffer,buyTurretBranch,hiveLimit,hiveArmor,
 turretGrowthRows} from '../turret-growth.js';
import {hitFriendlyShip} from '../enemy-shot-targets.js';
import {renderBasePanel} from '../base-panel.js';
import {game as testGame} from './weapons-scene.mjs';

function setup(){
 const stations=new Map([['A',0,0,'dock'],['B',1200,0,'arsenal'],
  ['C',350,1100,'carrier']].map(([id,x,y,type])=>[id,
  {id,x,y,type,active:true,enemy:false,hp:800,maxHp:800,turrets:[]}]));
 const world={stations,contours:createContours(),nearbyStations(x,y,r){return [...stations.values()]
  .filter(s=>Math.hypot(s.x-x,s.y-y)<r);}};
 for(const [a,b] of [['A','B'],['B','C'],['C','A']])
  assert.equal(connectContour(world,a,b).ok,true);
 const field=contourFields(world)[0];
 assert.ok(field);
 world.contours.trials.entries=[{id:1,x:field.center.x,y:field.center.y,
  tier:1,status:'pending',charge:0,activated:false}];
 const player={x:350,y:500,ore:100,hp:90};
 const game={world,player,enemies:[],time:1,enemyCanSee:()=>true,
  flash(){this.flashes=(this.flashes||0)+1;},heritage:{play(){}}};
 return {stations,world,player,game,entry:world.contours.trials.entries[0]};
}

test('stations cannot commission early or at a disconnected node',()=>{
 const {stations,world,player,entry}=setup(),dock=stations.get('A');
 assert.equal(stationTrialField(world,dock),null);
 assert.match(stationGarrisonOffer(world,player,dock).reason,/Начните заряжать/);
 entry.charge=.3;
 assert.ok(stationTrialField(world,dock));
 const paid=commissionStationGarrison(world,player,dock,1);
 assert.equal(paid.ok,true);
 assert.equal(player.ore,88);
 assert.equal(dock.garrison.hp,STATION_GARRISONS.dock.hp);
 assert.equal(commissionStationGarrison(world,player,dock,1).ok,false);
 assert.ok(validStationGarrison(dock,1));
 dock.active=false;
 assert.equal(stationGarrisonOffer(world,player,dock).ok,false);
});

test('local gun fires within its small real radius and holds against sustained shots',()=>{
 const {stations,world,player,game,entry}=setup();entry.charge=1;
 const dock=stations.get('A'),g=commissionStationGarrison(world,player,dock,1).garrison;
 const enemy={x:g.x+180,y:g.y,hp:100,maxHp:100,r:14,type:'fighter'};
 game.enemies=[enemy];game.time=4;
 advanceStationGarrisons(game,.1);
 assert.equal(enemy.hp,87);
 assert.equal(game.flashes,1);
 assert.equal(advanceStationGarrisons(game,.1),undefined);
 assert.equal(enemy.hp,87,'cooldown prevents extra free damage');
 const far={...enemy,x:g.x+430,hp:100};game.enemies=[far];game.time=7;
 advanceStationGarrisons(game,.1);
 assert.equal(far.hp,100,'the short-range installation cannot cover a whole triangle');
 for(let i=0;i<8;i++){
  game.time=8+i*.2;
  damageStationGarrison(game,dock,g,12);
 }
 assert.ok(g.hp>0,'the station screen prevents a five-second collapse');
 assert.ok(g.shield<STATION_GARRISONS.dock.shield);
 game.time=game.time+12;advanceStationGarrisons(game,1);
 assert.ok(g.shield>0,'the station recovers during quiet periods');
 assert.ok(validStationGarrison(dock,game.time));
});

test('carrier starts with eight destructible drones and replaces actual losses',()=>{
 const {stations,world,player,game,entry}=setup();entry.charge=1;
 const carrier=stations.get('C');
 const g=commissionStationGarrison(world,player,carrier,1).garrison;
 assert.equal(g.drones.length,8);
 assert.equal(g.drones.every(d=>d.hp===20&&d.r===6),true);
 game.time=4;game.enemies=[{x:g.x+120,y:g.y,hp:100,maxHp:100,r:14,type:'scout'}];
 advanceStationGarrisons(game,.1);
 assert.ok(game.enemies[0].hp<100,'the squad actively defends the station');
 const dr=g.drones[0];
 game.time=4.2;damageStationGarrison(game,carrier,dr,20);
 assert.equal(dr.hp,0);
 game.time=9.5;advanceStationGarrisons(game,.1);
 assert.equal(g.drones.filter(d=>d.hp>0).length,7);
 game.time=9.8;advanceStationGarrisons(game,.1);
 assert.equal(g.drones.filter(d=>d.hp>0).length,8);
 assert.ok(validStationGarrison(carrier,9.8));
 assert.equal(activeStationGarrisons(game).some(v=>v.station===carrier),true);
});

test('enemy projectiles collide with a station gun and remove its actual shield',()=>{
 const {stations,world,player,game,entry}=setup();entry.charge=1;
 const dock=stations.get('A'),g=commissionStationGarrison(world,player,dock,1).garrison;
 game.allies=[];game.support={missions:[]};game.artilleryDecoys=[];
 game.heritage={vfx:{hullImpact(){},shipExplosion(){}},play(){}};
 game.time=4;
 const shot={x:g.x,y:g.y,r:6,damage:20,alive:true};
 assert.equal(hitFriendlyShip(game,shot),true);
 assert.equal(shot.alive,false);
 assert.equal(g.shield,STATION_GARRISONS.dock.shield-20);
 assert.equal(g.hp,g.maxHp);
});

test('turret screens are materially stronger and old turret charge is migrated by fraction',()=>{
 const {stations,world,player,game,entry}=setup();entry.charge=18;entry.activated=true;
 const t={id:1,kind:'flux-artillery',x:580,y:100,r:38,
  hp:110,maxHp:110,readyAt:0,branches:{},shield:37};
 world.contours.artillery=[t];world.contours.flux=80;
 game.time=20;
 advanceTurretDefenses(game,.1);
 assert.equal(t.defenseSchema,2);
 assert.equal(turretShieldCapacity(t),Math.round(t.maxHp*TURRET_SCREEN.base));
 assert.ok(Math.abs(t.shield-turretShieldCapacity(t))<2);
 for(let i=0;i<15;i++){
  game.time=20+i*.25;
  damageFriendlyTurret(game,t,{damage:12,kind:'fighter',x:t.x+10,y:t.y});
 }
 assert.ok(t.hp>40,'a built emplacement survives several ordinary ships firing for five seconds');
 assert.ok(TURRET_DEFENSE.armor>.3);
});

test('existing hive has five genuine upgrade paths and purchases increase drone abilities',()=>{
 const {world,player}=setup();world.contours.flux=100;
 const hive={kind:'flux-support',type:'hive',hp:125,maxHp:125,readyAt:0,
  level:1,branches:{},drones:[{slot:0,hp:12,maxHp:12,r:6}]};
 assert.deepEqual(turretGrowthRows(hive).map(row=>row.key).sort(),
  ['anomaly','fortify','hull','reach','squad']);
 assert.equal(hiveLimit(hive),12);
 assert.equal(turretBranchOffer(world,player,hive,'squad',3).ok,true);
 assert.equal(buyTurretBranch(world,player,hive,'squad',3).ok,true);
 assert.equal(hiveLimit(hive),14);
 assert.equal(buyTurretBranch(world,player,hive,'hull',3).ok,true);
 assert.equal(hiveArmor(hive),16);
 assert.equal(hive.drones[0].maxHp,16);
});

test('station panel exposes defense and upgrades for every territorial turret family',()=>{
 const basePanel=readFileSync(new URL('../base-panel.js',import.meta.url),'utf8');
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(basePanel,/commissionGarrison/);
 assert.match(basePanel,/Развивайте ближайшие подключённые орудия/);
 assert.match(game,/commissionStationGarrison\(this.world,this.player,this.docked,this.time\)/);
 assert.match(game,/advanceStationGarrisons\(this,dt\)/);
 assert.match(game,/drawStationGarrisons\(c,this,cam\)/);
 const g=testGame();g.baseTab='network';
 const spec=STATION_GARRISONS.dock;
 g.docked.garrison={hp:spec.hp,maxHp:spec.hp,shield:spec.shield,drones:[]};
 g.world.contours.supportTurrets.push({id:1,kind:'flux-support',type:'hive',
  x:g.docked.x+300,y:g.docked.y+60,hp:125,readyAt:0,level:1,
  branches:{},drones:[]});
 g.world.contours.supportTurrets.push({id:2,kind:'flux-support',type:'arc',
  x:g.docked.x+450,y:g.docked.y+60,hp:125,maxHp:125,readyAt:0,branches:{}});
 g.world.contours.supportTurrets.push({id:3,kind:'flux-support',type:'laser',
  x:g.docked.x+540,y:g.docked.y+60,hp:125,maxHp:125,readyAt:0,branches:{}});
 g.world.contours.artillery.push({id:4,kind:'flux-artillery',
  x:g.docked.x+640,y:g.docked.y+60,hp:155,maxHp:155,readyAt:0,branches:{}});
 g.world.contours.flux=100;
 const html=renderBasePanel(g.docked,g.baseState());
 assert.match(html,/Сторожевая турель/);
 assert.match(html,/Оборона территории · все виды установок/);
 assert.match(html,/Дроновая матка №1/);
 assert.match(html,/Цепной разрядник №2/);
 assert.match(html,/Лазерное гнездо №3/);
 assert.match(html,/Громовая батарея №4/);
 assert.match(html,/data-act="upgradeTerritoryTurret"[^>]*data-role="squad"[^>]*data-target="s:1"/);
 assert.match(html,/data-act="upgradeTerritoryTurret"[^>]*data-role="salvo"[^>]*data-target="a:4"/);
 assert.match(html,/В СТРОЮ · корпус/);
});
