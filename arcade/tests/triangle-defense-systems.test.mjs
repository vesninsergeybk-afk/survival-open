import test from 'node:test';
import assert from 'node:assert/strict';
import {game} from './weapons-scene.mjs';
import {connectContour,createContours} from '../territory-system.js';
import {deployArtillery,artilleryOffer,upgradeEdgeTurretCapacity,
 artilleryUpgradeOffer,upgradeArtillery,advanceFluxArtillery,validFluxArtillery} from '../flux-artillery.js';
import {repairableTurret,turretRepairQuote,repairTurret} from '../turret-repair.js';
import {updateRamSquads,RAM_SQUAD} from '../ram-squads.js';
import {updateEnemy} from '../ai.js';
import {immediateContactThreat,selectTargets} from '../combat-targets.js';
import {startRailSweep,updateRailSweep,RAIL_SWEEP} from '../ship-weapons.js';
import {createMouseArsenal,fireMouseWeapon} from '../mouse-arsenal.js';

function setup(){
 const stations=new Map([['A',0,0],['B',1600,0],['C',600,1400]]
  .map(([id,x,y])=>[id,{id,x,y,active:true,enemy:false,suppressed:false,turrets:[]}]));
 const world={stations,contours:createContours(),nearbyStations(x,y,r){return [...stations.values()]
  .filter(s=>Math.hypot(s.x-x,s.y-y)<r);}};
 for(const [a,b]of [['A','B'],['B','C'],['C','A']])assert.equal(connectContour(world,a,b).ok,true);
 world.contours.trials.completed=1;world.contours.flux=80;
 const pilot={x:500,y:300,ore:200};
 return {world,pilot,point:{x:700,y:300}};
}

test('one edge begins with one slot, flux upgrades it, and wrecks reserve a repairable place',()=>{
 const {world,pilot,point}=setup();
 const first=deployArtillery(world,pilot,point,0);
 assert.equal(first.ok,true);
 assert.match(artilleryOffer(world,pilot,{x:950,y:300}).reason,/Грань занята/);
 const priceFlux=world.contours.flux;
 const increased=upgradeEdgeTurretCapacity(world,pilot);
 assert.equal(increased.limit,2);
 assert.equal(priceFlux-world.contours.flux,4);
 assert.equal(deployArtillery(world,pilot,{x:950,y:300},0).ok,true);
 first.turret.hp=0;
 assert.equal(repairableTurret(world,{x:700,y:320}),first.turret);
 assert.equal(turretRepairQuote(world,pilot,first.turret).ok,true);
 assert.equal(repairTurret(world,pilot,first.turret,15).ok,true);
 assert.equal(first.turret.hp,66);
 assert.equal(first.turret.readyAt,16.8);
 assert.equal(validFluxArtillery(world.contours),true);
});

test('right-click artillery upgrade consumes flux and improves real close-range shots',()=>{
 const {world,pilot,point}=setup();
 const turret=deployArtillery(world,pilot,point,0,4).turret;
 assert.equal(artilleryUpgradeOffer(world,pilot,turret,1).ok,false);
 const prevFlux=world.contours.flux;
 assert.equal(upgradeArtillery(world,pilot,turret,5).level,2);
 assert.equal(prevFlux-world.contours.flux,2);
 turret.readyAt=0;
 const enemy={x:point.x+248,y:point.y,hp:100,maxHp:100,r:18,type:'berserker'};
 const g={world,player:pilot,enemies:[enemy],time:6,
  damageEnemy(e,d){e.hp=Math.max(0,e.hp-d);},
  heritage:{play(){},vfx:{shipExplosion(){}}}};
 advanceFluxArtillery(g,.1);
 assert.equal(enemy.hp,84,'upgraded close gun reaches 260 m and inflicts 16 damage');
 assert.equal(turret.ammo,3,'the close shot uses one paid charge');
});

test('rammer squad warns for more than two seconds before an actual coordinated charge',()=>{
 const t={x:500,y:0,hp:100,r:38,readyAt:0},
  enemies=[0,1,2].map(i=>({x:120+i*55,y:50+i*30,vx:0,vy:0,type:'berserker',r:14,
   hp:70,maxHp:70,damage:18,serial:i+1,think:1,fire:1,commitUntil:0}));
 const g={time:10,player:{x:300,y:0,hp:100,r:19},enemies,
  world:{contours:{artillery:[t],supportTurrets:[]}},
  notice(text){this.message=text;},heritage:{play(){},vfx:{shipExplosion(){}}},
  avoidance(){return {x:0,y:0};}};
 updateRamSquads(g);
 assert.equal(g.ramSquads.length,1);
 assert.equal(g.ramSquads[0].members.length,3);
 assert.ok(Math.abs(g.ramSquads[0].chargeAt-g.time-RAM_SQUAD.rallySeconds)<1e-8);
 assert.match(g.message,/УГРОЗА ТАРАНА/);
 const first=enemies[0],before=Math.hypot(first.x-t.x,first.y-t.y);
 updateEnemy(first,g,.1);
 assert.equal(first._commsIntent.mode,'ram-rally');
 g.time+=RAM_SQUAD.rallySeconds+.1;
 updateEnemy(first,g,.1);
 assert.equal(first._commsIntent.mode,'ram-charge');
 for(let i=0;i<22&&first.hp>0;i++){g.time+=.1;updateEnemy(first,g,.1);}
 assert.ok(Math.hypot(first.x-t.x,first.y-t.y)<before,
  'charge really steers toward the target '+JSON.stringify({before,x:first.x,y:first.y,hp:first.hp,at:g.time}));
});

test('automatic batteries can pick a nearby charging rammer without detecting distant patrols',()=>{
 const g=game();const enemy={x:130,y:0,hp:70,maxHp:70,r:18,type:'berserker',
  signalIntel:{mode:'investigate'},converted:false};
 g.enemies=[enemy];g.grid.insert(enemy);
 assert.equal(immediateContactThreat(g,{kind:'enemy',target:enemy}),true);
 assert.equal(selectTargets(g,350,1)[0]?.target,enemy);
 enemy.x=700;
 assert.equal(immediateContactThreat(g,{kind:'enemy',target:enemy}),false);
});

test('rail sweep runs five seconds and mouse weapons retain separate reloads',()=>{
 const g=game(['rail',null,null,null,null,null]);
 g.mouseArsenal=createMouseArsenal();g.manualRailMode=true;
 const started=startRailSweep(g,{x:340,y:0});
 assert.equal(started.ok,true);
 assert.equal(started.duration,RAIL_SWEEP.duration);
 assert.equal(startRailSweep(g,{x:340,y:0}).ok,false);
 g.time+=.5;updateRailSweep(g);
 assert.ok(g.railSweep?.pulses>0);
 g.time+=5;updateRailSweep(g);
 assert.equal(g.railSweep,null);
 assert.equal(fireMouseWeapon(g,'mines',{x:300,y:0}).ok,true);
 assert.equal(fireMouseWeapon(g,'comet',{x:320,y:0}).ok,true);
 assert.ok(g.mouseArsenal.minesReadyAt>g.time);
 assert.ok(g.mouseArsenal.cometReadyAt>g.time);
 assert.notEqual(g.mouseArsenal.minesReadyAt,g.mouseArsenal.cometReadyAt);
});
