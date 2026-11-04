import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../world.js';
import {updateEnemy} from '../ai.js';
import {renderBasePanel} from '../base-panel.js';
import {renderWorldMap} from '../map-panel.js';
import {STATION_DEFENSE,ensureStationDefense,defenseStatus,
 updateStationDefense,threateningShot} from '../network-defense.js';

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
 const zone=()=>({x:player.x,y:player.y,r:66,fuse:.8,fuseStart:2,ttl:.3});
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
 g.zones=[{x:player.x,y:player.y,r:60,fuse:.6,ttl:.3}];
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
 assert.equal(home.defense,undefined,'no distant state is created');
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
 const solo30=bombard(30,false),solo60=bombard(60,false);
 const network30=bombard(30,true),network60=bombard(60,true);
 assert.ok(solo30.blocked>=8&&solo30.blocked<=13,JSON.stringify(solo30));
 assert.ok(solo30.hits>solo30.blocked*3,'a lone dock is not an invulnerable farm');
 assert.ok(network30.blocked>solo30.blocked,'linking has a tangible defense reward');
 assert.ok(network30.hits>network30.blocked,'even linked PVO has gaps');
 assert.ok(Math.abs(solo30.blocked-solo60.blocked)<=1);
 assert.ok(Math.abs(network30.blocked-network60.blocked)<=1);
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
 Object.assign(g,{enemyBasesUnlocked:()=>false,operation:null,contract:null,
  waypoint:null,mapView:'map',nearRocks:[],skillRanks:{radar:0}});
 const map=renderWorldMap(g);
 assert.match(map,/узел сети · ПВО и стазис/);
 assert.match(map,/stroke="#b790f0"/);
 assert.match(map,/бирюзовый круг — ПВО/);
 assert.equal((panelLinked.match(/role="tab"/g)||[]).length,4);
});

test('production update runs interception before shots and before orbital damage',()=>{
 const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const defense=source.indexOf('updateStationDefense(this);');
 const bullets=source.indexOf('for(const s of this.shots)',defense);
 const impacts=source.indexOf('for(const z of this.zones)',defense);
 assert.ok(defense>0&&bullets>defense&&impacts>bullets);
 assert.match(source,/if\(!s\.alive\)continue;/);
});
