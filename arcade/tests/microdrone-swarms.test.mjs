import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {MICRODRONE_ORDER,MICRODRONE_LIMITS,microDroneRoster,
 spawnMicroDroneWing,updateMicroDroneDirector,updateMicroDrone,
 microDroneShieldFactor,steerMicroMissile,loadMicroDroneSprites,drawMicroDrone,
 microDroneReportHit,microDroneMissileTarget}
 from '../microdrone-swarms.js';
import {microDroneObservation,microDroneTargets} from '../microdrone-intelligence.js';
import {canAutoTarget} from '../signal-perception.js';

function scene(){
 const shots=[],alerts=[],p={x:0,y:0,vx:35,vy:0,r:19,hp:90,invul:0};
 const game={time:0,player:p,enemies:[],groupSerial:0,enemySerial:0,
  nextMicroDronePatrolAt:Infinity,enemyBasesUnlocked:()=>false,
  camera:()=>({x:-450,y:-350,w:900,h:700}),
  spawnEntryCamera:()=>({x:-450,y:-350,w:900,h:700}),
  avoidance:()=>({x:0,y:0}),enemyCanSee:()=>false,
  world:{nearbyStations:()=>[]},notice:s=>alerts.push(s),
  enemyShot:(x,y,tx,ty,damage,options)=>{
   shots.push({at:game.time,x,y,tx,ty,damage,...options});return true;
  },hurt:()=>{p.hp-=10;}};
 return {game,shots,alerts};
}

test('every painted hull has intact, damaged and idle textures and eight real combat roles',()=>{
 assert.equal(MICRODRONE_ORDER.length,8);
 assert.equal(new Set(MICRODRONE_ORDER).size,8);
 for(let i=0;i<8;i++)for(const state of ['intact','damaged','idle']){
  assert.equal(existsSync(fileURLToPath(new URL(
   `../../assets/space/microdrones/${state}-${i}.webp`,import.meta.url))),true);
 }
 assert.deepEqual(loadMicroDroneSprites(),{},'simulation can run without DOM image objects');
});

test('severe damage fully replaces the intact silhouette, revealing missing armor',()=>{
 const drawn=[];
 const canvas={globalAlpha:1,save(){},restore(){},translate(){},rotate(){},
  beginPath(){},ellipse(){},fill(){},arc(){},stroke(){},moveTo(){},lineTo(){},
  closePath(){},drawImage(img){drawn.push({name:img.name,alpha:this.globalAlpha});}};
 const hull={name:'intact',complete:true,naturalWidth:256};
 const destroyed={name:'damaged',complete:true,naturalWidth:256};
 const sprites={assault:{intact:hull,damaged:destroyed,idle:hull}};
 const enemy={microDrone:'assault',x:0,y:0,r:12,angle:0,
  vx:50,vy:0,serial:2,maxHp:100,hp:100};
 assert.equal(drawMicroDrone(canvas,enemy,0,sprites,true),true);
 assert.deepEqual(drawn.map(d=>d.name),['intact']);
 drawn.length=0;enemy.hp=40;
 drawMicroDrone(canvas,enemy,0,sprites,true);
 assert.deepEqual(drawn.map(d=>d.name),['damaged'],
  'destroyed silhouette must not reveal pristine wing beneath transparency');
 drawn.length=0;enemy.hp=70;
 drawMicroDrone(canvas,enemy,0,sprites,true);
 assert.deepEqual(drawn.map(d=>d.name),['intact','damaged']);
 assert.ok(drawn[0].alpha<1&&drawn[1].alpha>0);
});

test('6, 8 and 10 ship wings keep their roles and do not exceed enemy cap',()=>{
 assert.equal(microDroneRoster(6).length,6);
 assert.equal(microDroneRoster(NaN).length,8);
 assert.equal(new Set(microDroneRoster(8)).size,8);
 assert.equal(microDroneRoster(10).length,10);
 const {game}=scene();
 const a=spawnMicroDroneWing(game,{count:6});
 const b=spawnMicroDroneWing(game,{count:10});
 assert.equal(a.members.length,6);assert.equal(b.members.length,10);
 assert.equal(new Set(a.members.map(e=>e.serial)).size,6);
 assert.equal(game.enemies.length,16);
 assert.equal(spawnMicroDroneWing(game,{count:10}).members.length,10);
 assert.equal(spawnMicroDroneWing(game,{count:6}),null);
 assert.equal(game.enemies.length,MICRODRONE_LIMITS.maxActive);
});

test('an unseen player cannot be targeted and patrolling ships never read live coordinates',()=>{
 const {game,shots}=scene(),wing=spawnMicroDroneWing(game,{count:8});
 const original={...wing.patrol};
 for(let step=0;step<220;step++){
  game.time+=.016;game.player.x+=4;
  updateMicroDroneDirector(game);
  for(const e of game.enemies)updateMicroDrone(e,game,.016);
 }
 assert.equal(shots.length,0);
 assert.equal(wing.lastContact,null);
 assert.deepEqual(wing.patrol,original);
 assert.equal(wing.mode,'patrol');
});

test('only actual sighting coordinates a flanking attack, with bounded shared volleys',()=>{
 const {game,shots}=scene();
 game.player.vx=0;
 const wing=spawnMicroDroneWing(game,{count:8});
 for(let i=0;i<wing.members.length;i++){
  wing.members[i].x=220+(i%3)*25;wing.members[i].y=(i-4)*23;
 }
 game.enemyCanSee=(e,p)=>Math.hypot(e.x-p.x,e.y-p.y)<600;
 for(let step=0;step<450;step++){
  game.time+=.016;updateMicroDroneDirector(game);
  for(const e of [...game.enemies])updateMicroDrone(e,game,.016);
 }
 assert.ok(wing.lastContact);
 assert.ok(['encircle','strike','regroup'].includes(wing.mode));
 assert.ok(shots.length>=3,'ships should actually open fire');
 assert.ok(shots.length<32,'eight drones must not create an unavoidable projectile wall');
 for(let i=1;i<shots.length;i++)assert.ok(shots[i].at-shots[i-1].at>=
  MICRODRONE_LIMITS.minShotSpacing-.02,'squad shares a real firing gate');
 assert.ok(shots.some(s=>s.kind==='micro-needle'||s.kind==='micro-hunter'));
});

test('guardian shield helps living wingmates only; shooting guardian removes protection',()=>{
 const {game}=scene(),wing=spawnMicroDroneWing(game,{count:8});
 const guardian=wing.members.find(e=>e.microDrone==='guardian');
 const hunter=wing.members.find(e=>e.microDrone==='hunter');
 hunter.x=guardian.x+40;hunter.y=guardian.y;
 assert.equal(microDroneShieldFactor(hunter,game.enemies),.78);
 guardian.hp=0;
 assert.equal(microDroneShieldFactor(hunter,game.enemies),1);
 const another=spawnMicroDroneWing(game,{count:8});
 const remote=another.members.find(e=>e.microDrone==='guardian');
 remote.x=hunter.x;remote.y=hunter.y;
 assert.equal(microDroneShieldFactor(hunter,game.enemies),1,'wings never share free protection');
});

test('micro missiles curve slowly and stop tracking after a short seeker window',()=>{
 const shot={x:0,y:0,vx:250,vy:0,microHoming:true,microHomingAge:0};
 assert.equal(steerMicroMissile(shot,{x:0,y:200},.1),true);
 const turn=Math.atan2(shot.vy,shot.vx);
 assert.ok(turn>0&&turn<=.105001,'turn rate remains dodgeable');
 assert.ok(Math.abs(Math.hypot(shot.vx,shot.vy)-250)<.001);
 shot.microHomingAge=1.35;
 const vx=shot.vx,vy=shot.vy;
 assert.equal(steerMicroMissile(shot,{x:-200,y:0},.1),false);
 assert.equal(shot.vx,vx);assert.equal(shot.vy,vy);
});

test('survivors call one six-drone reinforcement using a witnessed old position',()=>{
 const {game,alerts}=scene(),wing=spawnMicroDroneWing(game,{count:10});
 game.player.x=125;game.time=15;
 wing.lastContact={x:125,y:60,vx:12,vy:0,at:15};
 for(const e of wing.members.slice(0,4))e.hp=0;
 wing.members[4].microIntel={key:'player',kind:'player',...wing.lastContact};
 updateMicroDroneDirector(game);
 assert.equal(game.microDroneWings.size,2);
 assert.equal(wing.requestedSupport,true);
 const support=[...game.microDroneWings.values()].find(w=>w!==wing);
 assert.equal(support.members.length,6);
 assert.deepEqual(support.lastContact,wing.lastContact);
 game.time+=1;updateMicroDroneDirector(game);
 assert.equal(game.microDroneWings.size,2);
 assert.equal(alerts.length,1,'a nearby intercepted distress call is announced once');
});

test('offscreen desimulation never counts as casualties or earns a distress wing',()=>{
 const {game}=scene(),wing=spawnMicroDroneWing(game,{count:8});
 game.time=22;wing.lastContact={x:10,y:20,at:22};
 const departed=new Set(wing.members.slice(0,4));
 game.enemies=game.enemies.filter(e=>!departed.has(e));
 updateMicroDroneDirector(game);
 assert.equal(wing.lastLossCount,0);
 assert.equal(game.microDroneWings.size,1);
 assert.equal(wing.requestedSupport,false);
});

test('an operating hostile base launches one wing and obeys its cooldown',()=>{
 const {game}=scene();
 const base={id:'fort-1',x:210,y:10,rank:4,hp:400,enemy:true,
  captured:false,strategicRole:'frontier'};
 game.player.level=8;game.time=220;
 game.world.nearbyStations=()=>[base];
 updateMicroDroneDirector(game);
 assert.equal(game.microDroneWings.size,1);
 const wing=[...game.microDroneWings.values()][0];
 assert.equal(wing.scenario,'base');assert.equal(wing.members.length,10);
 game.time+=5;updateMicroDroneDirector(game);
 assert.equal(game.microDroneWings.size,1);
 base.captured=true;game.time+=100;updateMicroDroneDirector(game);
 assert.equal(game.microDroneWings.size,1,'captured base never launches more ships');
});

test('a saved microdrone group reconnects after loading instead of freezing',()=>{
 const {game}=scene(),wing=spawnMicroDroneWing(game,{count:6});
 const survivors=wing.members;
 game.microDroneWings=new Map();game.time=30;
 updateMicroDroneDirector(game);
 assert.equal(game.microDroneWings.size,1);
 assert.equal(game.microDroneWings.get(wing.id).members.length,6);
 const x=survivors[0].x;
 updateMicroDrone(survivors[0],game,.12);
 assert.notEqual(survivors[0].x,x);
});

test('isolated drones never learn an unseen target through an out-of-range squadmate',()=>{
 const {game}=scene();
 game.player.level=8;
 const wing=spawnMicroDroneWing(game,{count:8,origin:{x:220,y:0}});
 const isolated=wing.members[7];isolated.x=5000;isolated.y=0;
 game.enemyCanSee=(e,p)=>e!==isolated&&Math.hypot(e.x-p.x,e.y-p.y)<600;
 for(let i=0;i<36;i++){
  game.time+=.1;updateMicroDroneDirector(game);
  updateMicroDrone(isolated,game,.1);
 }
 assert.ok(wing.leader.microIntel,'a nearby witness observed the player');
 assert.equal(isolated.microIntel,null,'out-of-range receiver gets no shared coordinates');
 assert.equal(isolated.microMode,'patrol');
 isolated.x=490;isolated.y=0;
 for(let i=0;i<15;i++){game.time+=.1;updateMicroDroneDirector(game);}
 assert.ok(isolated.microIntel,'a real radio contact delivers an observation');
 assert.equal(isolated.microIntel.key,'player');
});

test('missile wings deliberately suppress a visible turret instead of always chasing the pilot',()=>{
 const {game}=scene(),turret={id:'battery-1',x:210,y:0,r:26,
  readyAt:0,hp:200,maxHp:200};
 game.world.contours={artillery:[turret],supportTurrets:[]};
 game.enemyCanSee=()=>true;
 const wing=spawnMicroDroneWing(game,{count:8,origin:{x:145,y:0}});
 const missile=wing.members.find(e=>e.microDrone==='missile');
 missile.x=145;missile.y=0;
 const observation=microDroneObservation(missile,game,microDroneTargets(game));
 assert.equal(observation.key,'artillery:battery-1');
 assert.equal(microDroneMissileTarget(game,{microTargetKey:observation.key}),turret);
});

test('two witnessed area hits trigger a broadcast dispersal order',()=>{
 const {game}=scene();
 const wing=spawnMicroDroneWing(game,{count:8,origin:{x:190,y:0}});
 game.time=20;
 wing.leader.microIntel={key:'player',kind:'player',x:0,y:0,vx:0,vy:0,at:20};
 assert.equal(microDroneReportHit(wing.leader,game,'ion'),true);
 game.time=21.2;
 assert.equal(microDroneReportHit(wing.leader,game,'ion'),true);
 updateMicroDroneDirector(game);
 assert.equal(wing.mode,'scatter');
 const companion=wing.members[1];
 assert.notEqual(companion.microOrder?.mode,'scatter',
  'a radio command must not arrive on the sending frame');
 game.time+=.4;updateMicroDroneDirector(game);
 assert.equal(companion.microOrder.mode,'scatter');
});

test('cloaking breaks automatic targeting but not deliberate manual aiming',()=>{
 const stealth={microDrone:'stealth',microCloakActive:true};
 assert.equal(canAutoTarget(stealth),false);
 stealth.microCloakActive=false;
 assert.equal(canAutoTarget(stealth),true);
});

test('real industrial reserves pay for new drone wings',()=>{
 const {game}=scene();
 const base={id:'industry:depot',x:250,y:30,rank:2,hp:300,
  enemy:true,captured:false,strategicRole:'central-depot'};
 game.player.level=8;game.time=220;
 game.world.regionalSupply={central:{reserves:1}};
 game.world.nearbyStations=()=>[base];
 updateMicroDroneDirector(game);
 assert.equal(game.microDroneWings.size,1);
 assert.equal(game.world.regionalSupply.central.reserves,0);
 game.time+=90;updateMicroDroneDirector(game);
 assert.equal(game.microDroneWings.size,1,'the hangar cannot spend nonexistent reserves');
});

test('a territory activation can call one bounded six-drone response wing',()=>{
 const {game}=scene();
 game.player.level=8;game.time=210;
 game.contourTrial={entry:{id:'field-17',x:1100,y:550}};
 updateMicroDroneDirector(game);
 const wing=[...game.microDroneWings.values()][0];
 assert.equal(wing.scenario,'trial');
 assert.equal(wing.members.length,6);
 assert.deepEqual(wing.patrol,{x:1100,y:550});
 game.time+=4;updateMicroDroneDirector(game);
 assert.equal(game.microDroneWings.size,1);
});
