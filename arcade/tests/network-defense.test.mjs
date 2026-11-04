import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../world.js';
import {updateEnemy} from '../ai.js';
import {renderBasePanel} from '../base-panel.js';
import {renderWorldMap} from '../map-panel.js';
import {RuntimeHarness} from './runtime-game.mjs';
import {STATION_DEFENSE,ensureStationDefense,defenseStatus,
 updateStationDefense,threateningShot,shotThreat,drawStationDefense,
 synchronizeStationDefenses} from '../network-defense.js';

function scene(){
 const world=new World(),home=world.home;
 home.active=true;home.discovered=true;world.discovered.add(home.id);
 const player={x:home.x+90,y:home.y,r:19,hp:110,vx:0,vy:0};
 const events=[],g={world,player,dead:false,time:100,zones:[],shots:[],enemies:[],
  rockGrid:null,events,flash(...p){events.push(['flash',...p]);},
  notice(m){events.push(['notice',m]);},
  heritage:{play(){},vfx:{nova(){}}}};
 return {g,home,world,player};
}
const shot=(x,y,vx=-230,vy=0)=>({x,y,vx,vy,r:6,life:3,damage:12,alive:true});
const enemy=(x,y,props={})=>({type:'fighter',x,y,vx:100,vy:0,r:14,
 hp:50,maxHp:50,fire:0,think:0,...props});

test('a solitary station intercepts one warned strike, but has no infinite immunity',()=>{
 const {g,home,player}=scene();
 const zone=()=>({x:player.x,y:player.y,r:66,fuse:.3,fuseStart:2,ttl:.3});
 const first=zone();g.zones.push(first);
 updateStationDefense(g);
 assert.equal(g.zones.length,0,'warned meteor is disarmed before impact');
 assert.equal(home.defense.charges,0);
 assert.ok(g.events.some(e=>e[1]?.includes?.('ПВО станции')));
 g.time+=1;g.zones.push(zone());updateStationDefense(g);
 assert.equal(g.zones.length,1,'second nearby impact is not cancelled for free');
 g.time=116.99;g.zones=[zone()];updateStationDefense(g);
 assert.equal(g.zones.length,1,'recharge is not premature');
 g.time=117.10;updateStationDefense(g);
 assert.equal(g.zones.length,0,'replenished local PVO catches a new impact');
 assert.equal(home.defense.charges,0);
 assert.ok(!('ore' in g)&&!('data' in g),'defense never mints rewards');
});

test('PVO only spends ammunition on a real incoming shot in its coverage',()=>{
 const {g,home,player}=scene();
 const leaving=shot(player.x+80,player.y,230);
 const missing=shot(player.x+180,player.y+95);
 const approaching=shot(player.x+150,player.y);
 g.shots=[leaving,missing,approaching];updateStationDefense(g);
 assert.equal(leaving.alive,true);
 assert.equal(missing.alive,true);
 assert.equal(approaching.alive,false);
 assert.equal(home.defense.charges,0);
 assert.equal(threateningShot(shot(0,200,230,0),player),false);
});

test('PVO saves its single charge for a bullet arriving before the warned meteor',()=>{
 const {g,home,player}=scene();
 const meteor={x:player.x,y:player.y,r:65,fuse:.37,ttl:.3};
 const imminent=shot(player.x+39,player.y,-230);
 g.zones=[meteor];g.shots=[imminent];updateStationDefense(g);
 assert.equal(imminent.alive,false,'the imminent high-priority shot is intercepted');
 assert.equal(g.zones[0],meteor,'the later orbital blast is left in the world');
 assert.equal(home.defense.charges,0);
});

test('PVO chooses the earliest strike rather than the earliest array entry',()=>{
 const {g,player}=scene();
 const later={x:player.x,y:player.y,r:65,fuse:.4,ttl:.3};
 const sooner={x:player.x,y:player.y,r:65,fuse:.13,ttl:.3};
 g.zones=[later,sooner];updateStationDefense(g);
 assert.deepEqual(g.zones,[later]);
});

test('shot priority stays the same after threats are reordered',()=>{
 for(const order of [[0,1,2],[2,1,0],[1,2,0]]){
  const {g,player}=scene();
  const shots=[.02,.1,.2].map((t,i)=>({
   ...shot(player.x+27+t*200,player.y,-200),damage:[10,50,100][i]
  }));
  g.shots=order.map(i=>shots[i]);updateStationDefense(g);
  assert.equal(shots[1].alive,false,'more dangerous shot inside the earliest interval');
  assert.equal(shots[0].alive,true);
  assert.equal(shots[2].alive,true);
 }
});

test('a stationary near miss does not consume ammunition',()=>{
 const {g,home,player}=scene();
 const passing=shot(player.x+120,player.y+32,-230);
 g.shots=[passing];updateStationDefense(g);
 assert.equal(threateningShot(passing,player),false);
 assert.equal(passing.alive,true);
 assert.equal(home.defense.charges,1);
});

test('PVO does not waste its last charge on an impact while the ship is invulnerable',()=>{
 const {g,home,player}=scene();
 player.invul=.65;
 const danger=shot(player.x+45,player.y,-230);
 const meteor={x:player.x,y:player.y,r:60,fuse:.32,ttl:.3};
 g.shots=[danger];g.zones=[meteor];updateStationDefense(g);
 assert.equal(danger.alive,true);
 assert.deepEqual(g.zones,[meteor]);
 assert.equal(home.defense.charges,1);
});

test('a crossing player and projectile are checked by their relative velocity',()=>{
 const {g,home,player}=scene();
 player.x=home.x;player.y=home.y;player.vy=300;
 const crossing=shot(home.x+100,home.y+150,-200);
 g.shots=[crossing];
 const threat=shotThreat(crossing,player);
 assert.ok(threat&&threat.eta>.3&&threat.eta<.6,JSON.stringify(threat));
 updateStationDefense(g);
 assert.equal(crossing.alive,false,'future trajectory is a collision');
});

test('a rock in the trajectory saves PVO ammunition for an uncovered danger',()=>{
 const {g,home,player}=scene();
 const incoming=shot(player.x+130,player.y);
 g.shots=[incoming];
 g.rockGrid={query:()=>[{x:player.x+65,y:player.y,r:35,alive:true}]};
 updateStationDefense(g);
 assert.equal(incoming.alive,true);
 assert.equal(home.defense.charges,1);
});

test('routine PVO announcements never replace an active mission or enemy warning',()=>{
 const {g,player}=scene();
 g.messageUntil=110;
 g.zones=[{x:player.x,y:player.y,r:60,fuse:.3,ttl:.3}];
 updateStationDefense(g);
 assert.equal(g.zones.length,0,'the defense still resolves the physical danger');
 assert.ok(g.events.some(event=>event[0]==='flash'));
 assert.ok(!g.events.some(event=>event[0]==='notice'));
});

test('protection ends at its marked boundary, including disconnected bases',()=>{
 const {g,home,player,world}=scene();
 player.x=home.x+STATION_DEFENSE.soloRadius+1;
 g.zones=[{x:player.x,y:player.y,r:60,fuse:.3,ttl:.3}];
 updateStationDefense(g);
 assert.equal(g.zones.length,1);
 assert.equal(home.defense.charges,1,'remote defenses stay synchronized even outside their ring');
 world.nearbyStations(home.x,home.y,1450,false);
 const second=world.stations.get('1:0');second.active=true;
 assert.equal(world.networkTopology().count,2);
 const linked=defenseStatus(home,true,g.time);
 assert.equal(linked.capacity,2);
 assert.equal(linked.radius,STATION_DEFENSE.linkedRadius);
 second.active=false;
 assert.equal(world.networkTopology().count,1);
 assert.equal(defenseStatus(home,false,g.time).capacity,1);
});

test('the station protects a ship inside its ring from an overlapping blast outside it',()=>{
 const {g,home,player}=scene();
 player.x=home.x+STATION_DEFENSE.soloRadius-10;
 g.zones=[{x:home.x+STATION_DEFENSE.soloRadius+50,y:home.y,r:80,fuse:.3,ttl:.3}];
 updateStationDefense(g);
 assert.equal(g.zones.length,0,'the blast footprint crosses the protection perimeter');
});
test('an imminent bullet hits a ship inside the ring even if the bullet never enters the ring',()=>{
 const {g,home,player}=scene();
 player.x=home.x+STATION_DEFENSE.soloRadius-10;
 const danger=shot(home.x+300,home.y,-230);
 g.shots=[danger];
 for(let step=0;step<10&&danger.alive;step++){
  g.time=100+step*.03;
  updateStationDefense(g);
  if(!danger.alive)break;
  danger.x+=danger.vx*.03;
  assert.ok(danger.x-player.x>(player.r+danger.r),
   'the projectile must be destroyed before the real shot loop reaches the hero');
 }
 assert.equal(danger.alive,false);
 assert.equal(home.defense.charges,0);
});
test('a bullet absorbed by a moving strike escort does not waste the hero PVO charge',()=>{
 const {g,home,player}=scene();
 const danger=shot(player.x+160,player.y,-230);
 const escort={x:player.x+85,y:player.y,r:17,hp:70,vx:0,vy:0};
 g.shots=[danger];g.support={missions:[{craft:[escort]}]};
 updateStationDefense(g);
 assert.equal(danger.alive,true);
 assert.equal(home.defense.charges,1);
 // Once the craft moves out of the trajectory, the same bullet threatens us.
 escort.vy=150;
 g.time+=.2;updateStationDefense(g);
 assert.equal(danger.alive,false);
});
test('the last-step warning is still preventable at 10, 30 and 60 simulation Hz',()=>{
 for(const hz of [10,30,60]){
  const {g,home,player}=scene();
  const impact={x:player.x+100,y:player.y,r:60,fuse:.04,ttl:.3};
  g.zones=[impact];
  // In the real game fuse is decremented on one frame, then resolved in the next.
  g.time=100;updateStationDefense(g);
  assert.equal(g.zones.length,1,'moving ship starts outside the strike');
  player.x=impact.x;
  for(let step=1;step<=5&&g.zones.length;step++){
   g.time=100+step/hz;
   updateStationDefense(g);
   // Actual updateStrikes: the frame which crosses zero only decrements.
   if(impact.fuse>0)impact.fuse-=1/hz;
  }
  assert.equal(g.zones.length,0,'PVO must run before the pending impact at '+hz+'Hz');
  assert.equal(home.defense.charges,0);
 }
});

test('an imminent meteor is ignored when the moving ship is leaving its blast and PVO range',()=>{
 const {g,home,player}=scene();
 player.x=home.x+245;player.vx=240;
 g.zones=[{x:home.x+285,y:home.y,r:70,fuse:.4,ttl:.3}];
 updateStationDefense(g);
 assert.equal(g.zones.length,1);
 assert.equal(home.defense.charges,1);
});

test('connected nodes suppress a real hostile group briefly, not authored objectives',()=>{
 const {g,home,world}=scene();
 world.nearbyStations(home.x,home.y,1450,false);
 world.stations.get('1:0').active=true;
 const a=enemy(home.x+40,home.y),b=enemy(home.x+65,home.y+20);
 const scripted=enemy(home.x+80,home.y,{relayAssault:true});
 const converted=enemy(home.x+100,home.y,{converted:true});
 g.enemies=[a,b,scripted,converted];
 updateStationDefense(g);
 assert.equal(a.stasisUntil,undefined,'newly linked station needs an arming interval');
 g.time=108.1;updateStationDefense(g);
 assert.ok(a.stasisUntil>g.time&&b.stasisUntil>g.time);
 assert.equal(scripted.stasisUntil,undefined);
 assert.equal(converted.stasisUntil,undefined);
 const oldX=a.x,oldFire=a.fire;
 g.time+=.1;updateEnemy(a,g,.1);
 assert.ok(a.x-oldX<10,'real AI steering is interrupted');
 assert.equal(a.fire,oldFire,'stasis prevents the next shot');
 assert.equal(home.defense.stasisAt,134.1);
 const firstPulse=a.stasisUntil;
 g.time=125;updateStationDefense(g);
 assert.equal(a.stasisUntil,firstPulse,'cooldown and immunity prevent a repeated lock');
 g.time=135;updateStationDefense(g);
 assert.ok(a.stasisUntil>firstPulse,'the station can help again after recovery');
});
test('hacking a stunned enemy immediately frees it to act as an ally',()=>{
 const {g,player}=scene();
 Object.setPrototypeOf(g,RuntimeHarness.prototype);
 Object.assign(g,{hacks:['area'],flashes:[],allies:[],holdFire:true,
  grid:{query:()=>[]},avoidance:()=>({x:0,y:0})});
 const frozen=enemy(player.x+60,player.y,{stasisUntil:130,stasisLabelUntil:130,
  stasisImmuneUntil:150});
 g.enemies=[frozen];
 g.hack();
 assert.equal(frozen.converted,true);
 assert.equal(frozen.stasisUntil,0);
 assert.equal(frozen.stasisLabelUntil,0);
 assert.equal(frozen.stasisImmuneUntil,0);
 updateEnemy(frozen,g,.1);
 assert.ok(frozen.convertedTime<19,'the actual converted AI begins on the first frame');
});

test('stasis does not fire at two distant ships while the player is elsewhere in the ring',()=>{
 const {g,home,world,player}=scene();
 world.nearbyStations(home.x,home.y,1450,false);
 world.stations.get('1:0').active=true;
 player.x=home.x+335;
 const a=enemy(home.x-195,home.y),b=enemy(home.x-172,home.y);
 g.enemies=[a,b];updateStationDefense(g);
 g.time=108.2;updateStationDefense(g);
 assert.equal(a.stasisUntil,undefined);
 assert.equal(b.stasisUntil,undefined);
 assert.equal(home.defense.stasisAt,108,'a remote patrol does not consume cooldown');
});

test('charges and cooldown survive a network outage without instant refills',()=>{
 const {g,home,world}=scene();
 world.nearbyStations(home.x,home.y,1450,false);
 const second=world.stations.get('1:0');second.active=true;
 let state=ensureStationDefense(home,true,g.time);
 assert.equal(state.charges,1);
 g.time=113;state=ensureStationDefense(home,true,g.time);
 assert.equal(state.charges,2);
 state.charges=0;state.rechargeAt=126;
 second.active=false;state=ensureStationDefense(home,false,114);
 assert.equal(state.charges,0);
 second.active=true;state=ensureStationDefense(home,true,115);
 assert.equal(state.charges,0);
 state=ensureStationDefense(home,true,126.1);
 assert.equal(state.charges,1,'link flapping does not instantly refill PVO');
});

test('an old fully charged solo station does not instantly gain ammo or stasis on linking',()=>{
 const {g,home,world}=scene();
 let state=ensureStationDefense(home,false,g.time);
 assert.equal(state.charges,1);
 world.nearbyStations(home.x,home.y,1450,false);
 world.stations.get('1:0').active=true;
 g.time=200;state=ensureStationDefense(home,true,g.time);
 assert.equal(state.charges,1);
 assert.equal(state.rechargeAt,213);
 assert.equal(state.stasisAt,208);
 state=ensureStationDefense(home,true,212.9);
 assert.equal(state.charges,1);
 state=ensureStationDefense(home,true,213.1);
 assert.equal(state.charges,2);
});
test('remote link creation starts both timers immediately and the terminal agrees on return',()=>{
 const {g,home,world}=scene();
 ensureStationDefense(home,false,100);
 world.nearbyStations(home.x,home.y,1450,false);
 const second=world.stations.get('1:0');
 second.active=true;
 synchronizeStationDefenses(world,200);
 assert.equal(defenseStatus(home,true,200).stasisIn,8);
 assert.equal(defenseStatus(home,true,200).rechargeIn,13);
 assert.equal(home.defense.charges,1);
 assert.equal(ensureStationDefense(home,true,230).stasisAt,208);
 assert.equal(defenseStatus(home,true,230).charges,2);
 assert.equal(defenseStatus(home,true,230).stasisIn,0);
});
test('a depleted solo magazine cannot jump to two full charges on late linking',()=>{
 const {home,world}=scene();
 const state=ensureStationDefense(home,false,100);
 state.charges=0;state.rechargeAt=117;
 world.nearbyStations(home.x,home.y,1450,false);
 world.stations.get('1:0').active=true;
 synchronizeStationDefenses(world,200);
 assert.equal(state.charges,1,'only the old solo charge is restored');
 assert.equal(state.rechargeAt,213);
});

test('the orbital-strike switch leaves shots protected but lets meteor resources exist',()=>{
 const {g,home,player}=scene();
 const state=ensureStationDefense(home,false,g.time);state.meteorEnabled=false;
 const meteor={x:player.x,y:player.y,r:80,fuse:.2,ttl:.3};
 g.zones=[meteor];updateStationDefense(g);
 assert.deepEqual(g.zones,[meteor]);
 assert.equal(state.charges,1);
 const danger=shot(player.x+50,player.y,-230);
 g.time+=.2;g.shots=[danger];updateStationDefense(g);
 assert.equal(danger.alive,false);
 assert.deepEqual(g.zones,[meteor]);
 assert.equal(defenseStatus(home,false,g.time).meteorEnabled,false);
});

test('repeated meteor attacks penetrate finite defenses at both simulation rates',()=>{
 function bombard(hz,connected){
  const {g,home,world,player}=scene();
  if(connected){
   world.nearbyStations(home.x,home.y,1450,false);
   world.stations.get('1:0').active=true;
  }
  let hits=0,blocked=0,nextImpact=100;
  for(let i=0;i<=180*hz;i++){
   g.time=100+i/hz;
   if(g.time+1e-8>=nextImpact){
    g.zones.push({x:player.x,y:player.y,r:60,fuse:1,ttl:.3});
    nextImpact+=3;
   }
   const count=g.zones.length;
   updateStationDefense(g);
   blocked+=Math.max(0,count-g.zones.length);
   for(const z of g.zones)z.fuse-=1/hz;
   hits+=g.zones.filter(z=>z.fuse<=0).length;
   g.zones=g.zones.filter(z=>z.fuse>0);
  }
  return {hits,blocked};
 }
 const solo10=bombard(10,false),solo30=bombard(30,false),solo60=bombard(60,false);
 const network10=bombard(10,true),network30=bombard(30,true),network60=bombard(60,true);
 assert.ok(solo30.blocked>=8&&solo30.blocked<=13,JSON.stringify(solo30));
 assert.ok(solo30.hits>solo30.blocked*3,'a lone dock is not an invulnerable farm');
 assert.ok(network30.blocked>solo30.blocked,'linking has a tangible defense reward');
 assert.ok(network30.hits>network30.blocked,'even linked PVO has gaps');
 assert.ok(Math.abs(solo30.blocked-solo60.blocked)<=1);
 assert.ok(Math.abs(network30.blocked-network60.blocked)<=1);
 assert.ok(Math.abs(solo10.blocked-solo60.blocked)<=1,JSON.stringify({solo10,solo60}));
 assert.ok(Math.abs(network10.blocked-network60.blocked)<=1,JSON.stringify({network10,network60}));
});

test('map and station terminal show actual protection, without adding a menu',()=>{
 const {g,home,world,player}=scene();
 const state={ore:80,data:30,hp:110,maxHp:110,shield:0,
  connected:true,connectedBases:1,activeBases:1,allies:0,droneRoles:[],
  network:{armor:0,engine:0,armament:0,strikePower:0},baseTab:'network',time:100};
 const panel=renderBasePanel(home,state);
 assert.match(panel,/ПВО 1\/1 · радиус 270 м/);
 assert.match(panel,/стазис доступен при связи двух узлов/);
 world.nearbyStations(home.x,home.y,1450,false);
 const second=world.stations.get('1:0');second.active=true;second.discovered=true;
 world.discovered.add(second.id);
 const panelLinked=renderBasePanel(home,{...state,connectedBases:2});
 assert.match(panelLinked,/ПВО 1\/2 · радиус 345 м/);
 assert.match(panelLinked,/стазис по группе/);
 assert.match(panelLinked,/ПВО действует автоматически/);
 assert.match(panelLinked,/Стазис тоже автоматический/);
 assert.match(panelLinked,/Кнопки запуска нет/);
 assert.match(panelLinked,/<details class="base-secondary-info base-defense-rules">/);
 assert.match(panelLinked,/не дальше 235 м от станции и 185 м от вас/);
 assert.match(panelLinked,/орбитальные удары: перехват/);
 assert.match(renderBasePanel(home,{...state,connectedBases:2}),/data-act="toggleMeteorDefense"/);
 ensureStationDefense(home,true,g.time).meteorEnabled=false;
 assert.match(renderBasePanel(home,{...state,connectedBases:2}),/орбитальные удары: пропуск/);
 Object.assign(g,{enemyBasesUnlocked:()=>false,operation:null,contract:null,
  waypoint:null,mapView:'map',nearRocks:[],skillRanks:{radar:0}});
 const map=renderWorldMap(g);
 assert.match(map,/узел сети · ПВО и стазис/);
 assert.match(map,/stroke="#b790f0"/);
 assert.match(map,/бирюзовый круг — ПВО/);
 assert.equal((panelLinked.match(/role="tab"/g)||[]).length,4);
});

test('flight readout stays beside the protection ring, clear of the top mission bar',()=>{
 const {home,player}=scene();
 const text=[],backdrops=[];
 const c={save(){},restore(){},setLineDash(){},beginPath(){},arc(){},stroke(){},
  fillRect(...values){backdrops.push(values);},strokeRect(){},
  fillText(label,x,y){text.push({label,x,y});}};
 drawStationDefense(c,home,false,100,player);
 const pvo=text.find(t=>t.label==='ПВО 1/1');
 assert.ok(pvo&&pvo.x>home.x+STATION_DEFENSE.soloRadius*.6);
 assert.ok(pvo.y>home.y+STATION_DEFENSE.soloRadius*.5,
  'PVO label is positioned in the lower-right, away from the mission banner');
 assert.equal(backdrops.length,1,'readout has a contrasting background');
});
test('in-flight readout tells the player recharge time and missing stasis targets',()=>{
 const {home,world,player}=scene();
 world.nearbyStations(home.x,home.y,1450,false);
 world.stations.get('1:0').active=true;
 const state=ensureStationDefense(home,true,100);
 state.charges=0;state.rechargeAt=108;state.stasisAt=90;
 const labels=[];
 const c={save(){},restore(){},setLineDash(){},beginPath(){},arc(){},stroke(){},
  fillRect(){},strokeRect(){},fillText(value){labels.push(value);}};
 drawStationDefense(c,home,true,100,player,false,[enemy(home.x+50,home.y)]);
 assert.ok(labels.includes('ЗАРЯД ЧЕРЕЗ 8 С'));
 assert.ok(labels.includes('СТАЗИС · ЦЕЛИ 1/2'));
});

test('production update runs interception before shots and before orbital damage',()=>{
 const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const defense=source.indexOf('updateStationDefense(this);');
 const bullets=source.indexOf('for(const s of this.shots)',defense);
 const impacts=source.indexOf('for(const z of this.zones)',defense);
 assert.ok(defense>0&&bullets>defense&&impacts>bullets);
 assert.match(source,/if\(!s\.alive\)continue;/);
});
