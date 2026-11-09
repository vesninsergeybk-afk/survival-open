import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContours,connectContour} from '../territory-system.js';
import {deployArtillery,advanceFluxArtillery,chooseArtilleryAim,barrelMount,validFluxArtillery} from '../flux-artillery.js';
import {deploySupport,advanceFluxSupports,validFluxSupports} from '../flux-supports.js';
import {TURRET_GROWTH,turretGrowthRows,turretBranchOffer,buyTurretBranch,
 artilleryBarrels,artilleryBlast,artilleryRange,arcRange,artilleryShotUnits,artilleryShotFlux,
 artilleryShellDamage,artilleryMagazine,artillerySalvoSize,artilleryReadyShells,
 artilleryCooldown,artillerySupply,arcChainCount,supportSupply,
 laserEmitters,laserBurst,hiveLimit,hiveArmor,hiveRange} from '../turret-growth.js';
import {hitFriendlyShip} from '../enemy-shot-targets.js';
import {turretDistractionTarget} from '../ai.js';
import {packRun,unpackRun} from '../run-checkpoint.js';

function fixture(){
 const stations=new Map([['A',0,0],['B',1600,0],['C',600,1400]]
  .map(([id,x,y])=>[id,{id,x,y,active:true,enemy:false,suppressed:false,turrets:[]}]));
 const world={stations,contours:createContours(),nearbyStations(x,y,r){
  return [...stations.values()].filter(s=>Math.hypot(s.x-x,s.y-y)<r);}};
 for(const [a,b] of [['A','B'],['B','C'],['C','A']])assert.ok(connectContour(world,a,b).ok);
 world.contours.trials.completed=1;world.contours.flux=1200;world.contours.turretSlotRank=2;
 const player={x:500,y:300,ore:3000};
 const events=[];
 const game={world,player,enemies:[],time:0,vw:1200,allies:[],hits:[],
  heritage:{play(type){events.push(type);},vfx:{rocketImpact(){},shipExplosion(){},hullImpact(){}}},
  damageEnemy(e,amount,source){this.hits.push({e,amount,source});e.hp=Math.max(0,e.hp-amount);},
  hitTurret(t,amount){t.hp=Math.max(0,t.hp-amount);},
  hitEnemyBase(b,amount){b.hp=Math.max(b.maxHp*.2,b.hp-amount);}};
 return {world,player,game,events,point:{x:700,y:300}};
}
function buyAll(pack,t,key){
 const rows=turretGrowthRows(t),max=rows.find(b=>b.key===key).max;
 for(let i=0;i<max;i++)assert.ok(buyTurretBranch(pack.world,pack.player,t,key,5).ok);
}

test('all four structures have real, separately purchasable paths including range',()=>{
 for(const type of Object.keys(TURRET_GROWTH)){
  const pack=fixture(),t=type==='artillery'?
   deployArtillery(pack.world,pack.player,pack.point,0).turret:
   deploySupport(pack.world,pack.player,pack.point,0,type).turret;
  const branches=turretGrowthRows(t);
  assert.equal(branches.length,type==='artillery'?6:type==='arc'?5:4,type);
  const first=branches[0],ore=pack.player.ore,flux=pack.world.contours.flux;
  assert.match(turretBranchOffer(pack.world,pack.player,t,first.key,0).reason,/строительства/);
  const paid=buyTurretBranch(pack.world,pack.player,t,first.key,5);
  assert.equal(paid.ok,true);assert.equal(pack.player.ore,ore-paid.ore);
  assert.ok(Math.abs(pack.world.contours.flux-(flux-paid.flux))<1e-8);
  assert.equal(turretGrowthRows(t)[1].rank,0,'other branches remain available');
  assert.equal(type==='artillery'?validFluxArtillery(pack.world.contours):
   validFluxSupports(pack.world.contours),true);
  pack.player.ore=0;
  assert.match(turretBranchOffer(pack.world,pack.player,t,first.key,5).reason,/сплава/);
  pack.player.ore=3000;pack.world.contours.flux=0;
  assert.match(turretBranchOffer(pack.world,pack.player,t,first.key,5).reason,/флюкса/);
 }
});

test('heavy rounds consume prepaid quarter-flux units and reach five flux per shell',()=>{
 const pack=fixture(),{world,player,game,point}=pack;
 const t=deployArtillery(world,player,point,0).turret;
 buyAll(pack,t,'power');
 assert.equal(artilleryShotUnits(t),20);
 assert.equal(artilleryShotFlux(t),5);
 assert.equal(artilleryShellDamage(t),480);
 assert.equal(artilleryMagazine(t),60);
 t.readyAt=0;t.ammo=19;world.contours.flux=0;
 assert.equal(artilleryReadyShells(t),0,'19 quarter-flux units are not 19 heavy shells');
 t.ammo=20;
 game.enemies=[{x:850,y:300,hp:1000,maxHp:1000,r:18,vx:0,vy:0}];
 assert.equal(artilleryReadyShells(t),1,'the magazine counts whole expensive shells');
 assert.equal(artillerySalvoSize(t),3);
 for(let i=0;i<60;i++){game.time+=.05;advanceFluxArtillery(game,.05);}
 assert.equal(world.contours.artilleryShells.length,0,
  'one heavy round must wait until a whole three-round salvo can be afforded');
 t.ammo=60;assert.equal(artilleryReadyShells(t),3);
 for(let i=0;i<120&&world.contours.artilleryShells.length===0;i++){
  game.time+=.05;advanceFluxArtillery(game,.05);
 }
 const shell=world.contours.artilleryShells[0];
 assert.equal(shell.damage,480);
 for(let i=0;i<8&&t.salvoLeft>0;i++){game.time+=.05;advanceFluxArtillery(game,.05);}
 assert.equal(t.salvoLeft,0);assert.equal(t.ammo,0);
 assert.equal(world.contours.flux,0,'firing spends the already delivered charge, never charges global flux twice');
 assert.equal(validFluxArtillery(world.contours),true);
 shell.damage=Infinity;assert.equal(validFluxArtillery(world.contours),false);
});

test('buying range upgrades truly expands targeting of artillery and chain nodes',()=>{
 const pack=fixture(),{world,player,point,game}=pack;
 const battery=deployArtillery(world,player,point,0).turret;
 const farEnemy={x:point.x+800,y:point.y,hp:100,maxHp:100,r:12};
 game.enemies=[farEnemy];
 assert.equal(artilleryRange(battery),740);
 assert.equal(chooseArtilleryAim(game,battery),null);
 assert.equal(buyTurretBranch(world,player,battery,'reach',5).ok,true);
 assert.equal(artilleryRange(battery),850);
 assert.ok(chooseArtilleryAim(game,battery),'far enemy is now targetable');
 const arc=deploySupport(world,player,{x:960,y:300},0,'arc').turret;
 arc.readyAt=0;arc.ammo=1;arc.gunAngle=0;
 assert.equal(arcRange(arc),440);
 const arcEnemy={x:arc.x+480,y:arc.y,hp:100,maxHp:100,r:12};
 game.enemies=[arcEnemy];game.time=.1;advanceFluxSupports(game,.1);
 assert.equal(game.hits.length,0);
 assert.equal(buyTurretBranch(world,player,arc,'reach',5).ok,true);
 assert.equal(arcRange(arc),520);
 game.time=.2;advanceFluxSupports(game,.1);
 assert.equal(game.hits.length,1);
});

test('ten-barrel battery fires ten paid individual shells in a staggered salvo',()=>{
 const pack=fixture(),{world,player,game,point}=pack;
 const t=deployArtillery(world,player,point,0).turret;
 buyAll(pack,t,'salvo');buyAll(pack,t,'tempo');buyAll(pack,t,'radius');
 assert.equal(artilleryBarrels(t),10);
 assert.equal(artilleryBlast(t),185);assert.equal(artilleryCooldown(t),4);
 assert.ok(artillerySupply(t)>7,'fast salvos also feed the magazine faster');
 assert.notDeepEqual(barrelMount(t,0),barrelMount(t,9),'real heads occupy two rows');
 const mounts=Array.from({length:10},(_,index)=>barrelMount(t,index));
 assert.equal(new Set(mounts.map(m=>`${m.side}:${m.back}`)).size,10,
  'the salvo has ten distinct muzzle positions');
 assert.ok(mounts[4].side-mounts[0].side>=100,
  'large batteries spread their barrels into a readable gun deck');
 t.readyAt=0;t.ammo=10;world.contours.flux=0;
 game.enemies=[{x:900,y:310,hp:10000,maxHp:10000,r:19,vx:0,vy:0}];
 game.time=.1;advanceFluxArtillery(game,.1);
 assert.ok(t.aimingUntil>.1);
 for(let i=0;i<80&&t.salvoFired===0;i++){
  game.time+=.05;advanceFluxArtillery(game,.05);
 }
 assert.equal(t.salvoFired,1);assert.equal(t.ammo,9);
 for(let i=0;i<15;i++){game.time+=.1;advanceFluxArtillery(game,.1);}
 assert.equal(t.salvoFired,10);assert.equal(t.salvoLeft,0);
 assert.equal(t.ammo,0,'one charge per barrel');
 assert.equal(t.barrelLastShots.length,10);
 assert.equal(validFluxArtillery(world.contours),true);
 assert.ok(pack.events.filter(e=>e==='artilleryLaunch').length>=10);
 assert.ok(game.hits.length>0,'fired shells really damage a target');
});

test('experimental shell slows, stuns ordinary combatants and makes a shootable decoy',()=>{
 const pack=fixture(),{world,player,game,point}=pack;
 const t=deployArtillery(world,player,point,0).turret;
 buyAll(pack,t,'anomaly');
 t.readyAt=0;t.ammo=3;
 const e={x:880,y:300,hp:900,maxHp:900,r:20,type:'flanker'};game.enemies=[e];
 game.time=.1;advanceFluxArtillery(game,.1);
 for(let i=0;i<80&&world.contours.artilleryShells.length===0;i++){
  game.time+=.05;advanceFluxArtillery(game,.05);
 }
 const shell=world.contours.artilleryShells[0];
 game.time=shell.arriveAt+.01;advanceFluxArtillery(game,.1);
 assert.ok(e.tacticalSlowUntil>game.time);
 assert.ok(e.stasisUntil>game.time);
 assert.equal(game.artilleryDecoys.length,1);
 const decoy=game.artilleryDecoys[0];
 assert.equal(hitFriendlyShip(game,{x:decoy.x,y:decoy.y,r:3,damage:30,alive:true}),true);
 assert.equal(decoy.hp,0,'the enemy can shoot down the false target');
 game.time+=1;advanceFluxArtillery(game,.1);
 assert.equal(game.artilleryDecoys.length,0);
});

test('enemy fighters visibly redirect toward decoys and upgraded drone distractions',()=>{
 const pack=fixture(),{game,world,player,point}=pack;
 const flanker={x:700,y:300,type:'flanker',hp:50};
 const falseSignal={x:755,y:300,hp:28,until:8};
 game.artilleryDecoys=[falseSignal];game.time=1;
 assert.equal(turretDistractionTarget(flanker,game),falseSignal);
 assert.equal(turretDistractionTarget({...flanker,stationRaid:'A'},game),null,
  'scripted missions keep their original orders');
 assert.equal(turretDistractionTarget({...flanker,type:'berserker'},game),null,
  'suicide enemy never breaks a scripted rush');
 falseSignal.hp=0;
 const hive=deploySupport(world,player,point,0,'hive').turret;
 assert.equal(turretDistractionTarget(flanker,game),null,
  'ordinary drones have no irresistible taunt by default');
 game.time=hive.readyAt+1;
 assert.ok(buyTurretBranch(world,player,hive,'anomaly',game.time).ok);
 const drone={x:730,y:300,hp:20};hive.drones=[drone];
 game.enemyCanSee=()=>true;
 assert.equal(turretDistractionTarget(flanker,game),drone);
 drone.hp=0;assert.equal(turretDistractionTarget(flanker,game),null);
 falseSignal.hp=28;falseSignal.until=0;
 assert.equal(turretDistractionTarget(flanker,game),null,'expired decoys are ignored');
});

test('arc chain can lock seven enemies and bought effects remain in the checkpoint',()=>{
 const pack=fixture(),{world,player,game,point}=pack;
 const t=deploySupport(world,player,point,0,'arc').turret;
 for(const key of ['chain','hold','anomaly'])buyAll(pack,t,key);
 assert.equal(arcChainCount(t),7);
 t.readyAt=0;t.ammo=1;world.contours.flux=0;
 game.enemies=Array.from({length:7},(_,i)=>({x:835+i*19,y:300,
  hp:100,maxHp:100,r:14,type:'scout'}));
 game.time=.1;t.gunAngle=0;advanceFluxSupports(game,.1);
 assert.equal(game.hits.filter(x=>x.e.hp<100).length>=7,true);
 assert.ok(game.enemies.every(e=>e.tacticalSlowUntil>game.time));
 assert.ok(game.enemies.every(e=>e.stasisUntil>game.time));
 assert.equal(validFluxSupports(world.contours),true);
});

test('high firing-speed ranks increase logistics but cannot bypass a broken contour',()=>{
 const fast=fixture(),slow=fixture();
 const a=deploySupport(fast.world,fast.player,fast.point,0,'arc').turret;
 const b=deploySupport(slow.world,slow.player,slow.point,0,'arc').turret;
 buyAll(fast,a,'tempo');
 assert.ok(supportSupply(a,3.4)>supportSupply(b,3.4));
 a.readyAt=b.readyAt=0;
 for(let time=1;time<=95;time++){
  fast.game.time=slow.game.time=time;
  advanceFluxSupports(fast.game,1);advanceFluxSupports(slow.game,1);
 }
 assert.ok(a.ammo>b.ammo,'supplied rapid-firing node builds more real prepaid charges');
 fast.world.stations.get('B').suppressed=true;
 const ammo=a.ammo;
 for(let time=96;time<=112;time++){fast.game.time=time;advanceFluxSupports(fast.game,1);}
 assert.equal(a.ammo,ammo,'even full upgrades cannot conjure ammo without a live cable');
});

test('laser keeps visible gradient and burns through six real charges per expanded burst',()=>{
 const pack=fixture(),{world,player,game,point}=pack;
 const t=deploySupport(world,player,point,0,'laser').turret;
 for(const key of ['emitters','tempo','reach','anomaly'])buyAll(pack,t,key);
 assert.equal(laserEmitters(t),6);assert.equal(laserBurst(t),16);
 t.readyAt=0;t.ammo=6;t.gunAngle=0;world.contours.flux=0;
 game.enemies=[{x:830,y:300,hp:10000,maxHp:10000,r:14}];
 game.time=.1;advanceFluxSupports(game,.1);
 assert.equal(t.ammo,0);assert.ok(t.burstLeft>0);
 for(let i=1;i<=35;i++){game.time=.1+i*.14;advanceFluxSupports(game,.14);}
 assert.equal(t.burstLeft,0);assert.ok(game.hits.length>16,'heat anomaly creates extra real hits');
 assert.equal(validFluxSupports(world.contours),true);
});

test('mothership grows a six-drone, armored, long-range squad supplied with flux',()=>{
 const pack=fixture(),{world,player,game,point}=pack;
 const t=deploySupport(world,player,point,0,'hive').turret;
 for(const key of ['squad','reach','hull','anomaly'])buyAll(pack,t,key);
 assert.equal(hiveLimit(t),6);assert.equal(hiveArmor(t),70);
 assert.equal(hiveRange(t),480);
 t.readyAt=0;
 for(let time=1;time<=600;time++){
  game.time=time;advanceFluxSupports(game,1);
 }
 assert.equal(t.drones.filter(x=>x.hp>0).length,6);
 assert.ok(t.drones.every(x=>x.maxHp===70));
 assert.equal(validFluxSupports(world.contours),true);
});

test('old saves remain valid but forged branch ranks and projectile fields are rejected',()=>{
 const pack=fixture(),t=deployArtillery(pack.world,pack.player,pack.point,0).turret;
 delete t.branches;delete t.salvoLeft;delete t.salvoFired;delete t.barrelLastShots;
 assert.equal(validFluxArtillery(pack.world.contours),true);
 t.branches={salvo:6};assert.equal(validFluxArtillery(pack.world.contours),false);
 t.branches={salvo:5};assert.equal(validFluxArtillery(pack.world.contours),true);
 t.barrelLastShots=Array(14).fill(0);
 assert.equal(validFluxArtillery(pack.world.contours),false);
});

test('new growth ranks, paid salvos and upgraded drones round-trip through checkpoint graph',()=>{
 const pack=fixture(),{world,player,point}=pack;
 const battery=deployArtillery(world,player,point,0).turret;
 buyAll(pack,battery,'salvo');
 const hive=deploySupport(world,player,{x:970,y:380},0,'hive').turret;
 buyAll(pack,hive,'hull');
 battery.salvoLeft=6;battery.salvoFired=4;battery.barrelLastShots=[10,10.1,10.2,10.3];
 const copy=unpackRun(packRun({world:{contours:world.contours}})).world.contours;
 assert.equal(copy.artillery[0].branches.salvo,5);
 assert.equal(copy.artillery[0].salvoLeft,6);
 assert.equal(copy.supportTurrets[0].branches.hull,3);
 assert.equal(validFluxArtillery(copy),true);
 assert.equal(validFluxSupports(copy),true);
});

test('growth is reachable from the contextual menu, with a laboratory demonstration',()=>{
 const root=new URL('../',import.meta.url);
 const html=readFileSync(new URL('index.html',root),'utf8');
 const game=readFileSync(new URL('game.js',root),'utf8');
 const css=readFileSync(new URL('flux-artillery.css',root),'utf8');
 assert.match(html,/id="turretGrowthList"/);
 assert.match(html,/Громовая батарея/);
 assert.match(game,/buyTurretBranch\(this\.world,this\.player/);
 assert.match(css,/\.turret-growth-list/);
 for(const lab of ['flux-artillery-lab.html','flux-supports-lab.html'])
  assert.match(readFileSync(new URL('studio/'+lab,root),'utf8'),/id="maxGrowth"/);
});
