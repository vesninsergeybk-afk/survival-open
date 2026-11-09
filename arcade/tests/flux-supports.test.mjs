import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createContours,connectContour} from '../territory-system.js';
import {artilleryOffer,deployArtillery,advanceFluxArtillery} from '../flux-artillery.js';
import {SUPPORT_TYPES,supportOffer,deploySupport,advanceFluxSupports,
 supportUpgradeOffer,upgradeSupport,setSupportMode,validFluxSupports,
 drawFluxSupports} from '../flux-supports.js';
import {hitFriendlyShip} from '../enemy-shot-targets.js';

function fixture(){
 const stations=new Map([['A',0,0],['B',1600,0],['C',600,1400]]
  .map(([id,x,y])=>[id,{id,x,y,active:true,enemy:false,suppressed:false,turrets:[]}]));
 const world={stations,contours:createContours(),
  nearbyStations(x,y,r){return [...stations.values()].filter(s=>Math.hypot(s.x-x,s.y-y)<r);}};
 for(const [a,b]of [['A','B'],['B','C'],['C','A']])assert.ok(connectContour(world,a,b).ok);
 const player={x:500,y:300,ore:1000},point={x:700,y:300};
 world.contours.trials.completed=1;world.contours.flux=200;
 world.contours.turretSlotRank=2; // Independent weapon tests predate the new one-slot starting limit.
 const game={world,player,enemies:[],time:0,vw:1200,visuals:{reducedMotion:true},
  heritage:{play(){},vfx:{hullImpact(){},shipExplosion(){}}},damageEnemy(e,amount,source){
   e.hp=Math.max(0,e.hp-amount);this.hits.push({e,amount,source});},
  hitTurret(t,amount){t.hp=Math.max(0,t.hp-amount);},
  hitEnemyBase(b,amount){b.hp=Math.max(b.maxHp*.2,b.hp-amount);},hits:[]};
 return {world,player,point,game};
}
function tick(game,from,to,step=1){for(let t=from;t<=to+1e-8;t+=step){
 game.time=t;advanceFluxSupports(game,step);
}}
test('all three structures require a real contour, pilot range and both currencies',()=>{
 const {world,player,point}=fixture();
 for(const [type,cfg]of Object.entries(SUPPORT_TYPES)){
  const stock=world.contours.flux,ore=player.ore;
  const result=deploySupport(world,player,point,10,type);
  assert.ok(result.ok,type+': '+result.reason);
  assert.equal(ore-player.ore,cfg.oreCost);
  assert.ok(Math.abs(stock-world.contours.flux-cfg.fluxCost)<1e-8);
  assert.equal(result.turret.ammo,0);
  assert.equal(result.turret.readyAt,10+cfg.buildSeconds);
  assert.equal(validFluxSupports(world.contours),true);
  assert.equal(supportOffer(world,player,point,type).ok,false,'overlap rejected');
  // Destroyed nests persist and reserve their edge slot for repair.
  result.turret.hp=0;
 }
 world.contours.trials.completed=0;
 assert.equal(supportOffer(world,player,point,'arc').ok,false);
 world.contours.trials.completed=1;
 assert.equal(supportOffer(world,player,{x:3000,y:3300},'arc').ok,false);
 world.contours.supportTurrets=[]; // Isolate the resource check from the full edge.
 world.contours.flux=0;
 assert.match(supportOffer(world,player,point,'arc').reason,/флюкса/);
});

test('artillery and auxiliary towers reserve shared footprint in both directions',()=>{
 const {world,player,point}=fixture();
 assert.ok(deploySupport(world,player,point,0,'arc').ok);
 assert.match(artilleryOffer(world,player,point).reason,/Слишком близко/);
 const next={x:900,y:300};
 assert.ok(deployArtillery(world,player,next,0).ok);
 assert.match(supportOffer(world,player,next,'hive').reason,/Слишком близко/);
});

test('chain lightning damages up to three nearby enemies, slows them and costs a real charge',()=>{
 const {world,player,point,game}=fixture();
 const t=deploySupport(world,player,point,0,'arc').turret;
 t.readyAt=0;t.ammo=1;
 game.enemies=[{x:850,y:300,hp:100,maxHp:100,r:16},
  {x:890,y:318,hp:100,maxHp:100,r:16},
  {x:921,y:290,hp:100,maxHp:100,r:16},
  {x:1240,y:300,hp:100,maxHp:100,r:16}];
 tick(game,.1,2,.05);
 assert.equal(game.hits.length,3);
 assert.ok(game.enemies.slice(0,3).every(e=>e.hp<100&&e.tacticalSlowFactor===.55),
  JSON.stringify(game.enemies.map(e=>({x:e.x,hp:e.hp,slow:e.tacticalSlowFactor}))));
 assert.ok(game.enemies.slice(0,3).every(e=>e.tacticalSlowUntil>2));
 assert.equal(game.enemies[3].hp,100);
 assert.equal(t.ammo,0);
 assert.equal(t.mode,'smart');
 assert.ok(setSupportMode(t,'weak'));assert.equal(t.mode,'weak');
 assert.equal(setSupportMode(t,'imaginary'),false);
});

test('laser burst is pulsed, weakens with distance and can be upgraded to twin emitters',()=>{
 const near=fixture(),far=fixture(),both=[near,far];
 for(const pack of both){
  const t=deploySupport(pack.world,pack.player,pack.point,0,'laser').turret;
  t.readyAt=0;t.ammo=2;
  pack.game.enemies=[{x:pack.point.x+(pack===near?120:420),y:300,hp:500,maxHp:500,r:16}];
  tick(pack.game,.1,2,.05);
  assert.equal(t.burstLeft,0);
  assert.equal(t.ammo,1);
  assert.equal(pack.game.hits.length,8);
 }
 assert.ok(near.game.enemies[0].hp<far.game.enemies[0].hp);
 const {world,player,game}=fixture();
 const t=deploySupport(world,player,{x:700,y:300},0,'laser').turret;
 assert.equal(supportUpgradeOffer(world,player,t,0).ok,false,'cannot upgrade during construction');
 assert.ok(upgradeSupport(world,player,t,5).ok);
 assert.equal(t.level,2);
 assert.equal(supportUpgradeOffer(world,player,t,6).ok,false,'one laser upgrade only');
 t.readyAt=0;t.ammo=2;
 game.enemies=[{x:820,y:300,hp:500,maxHp:500,r:16}];
 tick(game,.1,2,.05);
 assert.equal(t.ammo,0,'twin laser spends two charges per burst');
 assert.equal(game.hits.length,8);
 assert.equal(validFluxSupports(world.contours),true);
});

test('nearby laser receives a genuinely usable first volley within the first ten seconds',()=>{
 const {world,player,point,game}=fixture();
 const t=deploySupport(world,player,point,0,'laser').turret;
 tick(game,.25,10,.25);
 assert.ok(t.ammo>=1,'a rapid-fire defense should not idle for most of a skirmish');
 assert.ok(world.contours.flux<200-SUPPORT_TYPES.laser.fluxCost,
  'the first charge must actually deduct operating flux');
 assert.equal(validFluxSupports(world.contours),true);
});

test('mothership launches one prepaid drone, makes replacements for flux and drones can be destroyed',()=>{
 const {world,player,point,game}=fixture();
 const hive=deploySupport(world,player,point,0,'hive').turret;
 game.time=5;advanceFluxSupports(game,1);
 assert.equal(hive.drones.filter(d=>d.hp>0).length,1);
 const initialFlux=world.contours.flux;
 tick(game,6,145);
 assert.ok(hive.drones.filter(d=>d.hp>0).length>=2,'a paid reinforcement arrived');
 assert.ok(world.contours.flux<initialFlux-2,'additional drones spend flux');
 const old=hive.drones.find(d=>d.hp>0);
 const shot={x:old.x,y:old.y,r:5,damage:30,alive:true};
 assert.ok(hitFriendlyShip(game,shot));
 assert.equal(old.hp,0);assert.equal(shot.alive,false);
 assert.equal(validFluxSupports(world.contours),true);
 tick(game,146,265);
 assert.ok(hive.drones.filter(d=>d.hp>0).length>=2,'destroyed drone replaced');
 const level=upgradeSupport(world,player,hive,game.time);
 assert.equal(level.level,2);
 assert.equal(upgradeSupport(world,player,hive,game.time).level,3);
 assert.equal(upgradeSupport(world,player,hive,game.time).ok,false);
 assert.equal(validFluxSupports(world.contours),true);
});

test('live cables stop supplying charges when a contour is disconnected',()=>{
 const {world,player,point,game}=fixture();
 const t=deploySupport(world,player,point,0,'arc').turret;
 tick(game,1,85);
 assert.ok(t.ammo>0);
 world.stations.get('B').suppressed=true;
 const before=t.ammo;
 tick(game,86,120);
 assert.equal(t.ammo,before);
 assert.equal(world.contours.supportPackets.length,0);
});

test('save validator rejects invented flux, drones and invalid packet routes',()=>{
 const {world,player,point}=fixture();
 const t=deploySupport(world,player,point,0,'hive').turret;
 assert.equal(validFluxSupports(world.contours),true);
 t.drones=[{slot:1,x:720,y:300,hp:28,maxHp:28,r:10,nextShotAt:5,lastShotAt:-1,angle:0}];
 assert.equal(validFluxSupports(world.contours),true);
 t.drones[0].hp=Infinity;
 assert.equal(validFluxSupports(world.contours),false);
 t.drones[0].hp=28;t.drones[0].angle=Infinity;
 assert.equal(validFluxSupports(world.contours),false);
 t.drones=[];
 world.contours.supportPackets.push({kind:'drone',turretId:t.id,edgeId:'A|B',charges:1,
  amount:2.5,launchedAt:2,arriveAt:3,path:[{x:1,y:2},{x:3,y:4},{x:5,y:6}]});
 assert.equal(validFluxSupports(world.contours),true);
 world.contours.supportPackets[0].arriveAt=Infinity;
 assert.equal(validFluxSupports(world.contours),false);
});

test('stable centered sprites, interaction, saves, hostile fire and recorded effects are wired into game',()=>{
 for(const type of ['arc','laser','hive','drone','laserBase','laserSingle','laserTwin']){
  const file=new URL('../assets/artillery/flux-'+
   ({arc:'arc-node',laser:'laser-battery',hive:'drone-hive',drone:'hive-drone',
    laserBase:'laser-base',laserSingle:'laser-single',laserTwin:'laser-twin'}[type])+'.svg',import.meta.url);
  assert.equal(existsSync(file),true);
  const svg=readFileSync(file,'utf8');
  assert.match(svg,/viewBox="0 0 128 128"/);
  assert.match(svg,/<svg/);
 }
 const supportModule=readFileSync(new URL('../flux-supports.js',import.meta.url),'utf8');
 assert.match(supportModule,/imageAt\(ctx,'laserBase',83\)/);
 assert.match(supportModule,/t\.level>=2\?'laserTwin':'laserSingle'/);
 const entry=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(entry,/advanceFluxSupports\(this,dt\)/);
 assert.match(entry,/drawFluxSupports\(c,this,cam/);
 assert.match(entry,/deploySupport\(this.world,this.player/);
 const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 for(const id of ['buildArc','buildLaser','buildHive','supportUpgrade'])
  assert.match(page,new RegExp('id="'+id+'"'));
 const soundMap=readFileSync(new URL('../../audio-lab/sound-map.js',import.meta.url),'utf8');
 for(const key of ['support_arc','support_laser','support_drone_shot','support_drone_lost'])
  assert.ok(soundMap.includes(key));
 const {game}=fixture();
 const ctx=new Proxy({}, {get(_,key){if(key==='canvas')return {width:1200,height:900};
  return ()=>{};},set(){return true;}});
 assert.doesNotThrow(()=>drawFluxSupports(ctx,game,{x:0,y:0,w:1200,h:900}));
});
