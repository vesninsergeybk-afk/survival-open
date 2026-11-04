import {updateEnemy} from '../ai.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeHarness} from './runtime-game.mjs';
import {World} from '../world.js';
import {openingThreat} from '../balance.js';
import {REGIONS,centralBoundary,regionAt} from '../regions.js';
import {SUPPLY,advanceRegionalSupply,interceptSupply,strategicCapture,regionalSupplyValid} from '../regional-supply.js';
import {updateRegionalWorld,spawnRegionalRaid,hitRegionalCargo} from '../region-runtime.js';
import {combatTargets,damageTarget} from '../combat-targets.js';
import {stormFields,stormPhase,stormContact,stormWeaponDamage,stormSeek,drawRegionalStorms,updateRegionalStorms} from '../regional-storms.js';
import {renderWorldMap} from '../map-panel.js';
const noop=()=>{};
function game(){
 const g=new RuntimeHarness();
 Object.assign(g,{world:new World(),player:{x:0,y:0,r:19,hp:110,level:1},time:0,
  enemies:[],allies:[],enemySerial:0,groupSerial:0,activeBases:0,hacks:[],drops:[],
  avoidance:()=>({x:0,y:0}),vw:1200,vh:800,skillRanks:{radar:0},notice:noop,heritage:{play:noop,vfx:{hullImpact:noop,shipExplosion:noop,nova:noop}},
  addDrop:(...drop)=>g.drops.push(drop),grid:{query:()=>[]}});
 return g;
}
test('a large central region surrounds the start and all four directions remain open',()=>{
 for(let i=0;i<16;i++){
  const a=i*Math.PI/8,r=centralBoundary(a);
  assert.ok(r/272>75,'straight travel is measured in minutes rather than ten seconds');
  assert.equal(regionAt(Math.cos(a)*(r-10),Math.sin(a)*(r-10)).id,'amethyst');
  assert.notEqual(regionAt(Math.cos(a)*(r+10),Math.sin(a)*(r+10)).id,'amethyst');
 }
 for(const r of REGIONS)assert.equal(regionAt(r.x,r.y).id,r.id);
 assert.equal(regionAt(1e7,-2e7).id,regionAt(1e7,-2e7).id);
});
test('the industrial corridor is navigable and the amber region contains denser, richer rock fields',()=>{
 const w=new World();
 const sample=(x,y)=>w.nearbyRocks(x,y,1400);
 const center=sample(16000,4000),amber=sample(35000,10000);
 assert.ok(amber.length>center.length*1.25);
 assert.ok(amber.filter(r=>r.rich).length/amber.length>center.filter(r=>r.rich).length/center.length);
 const road=sample(32000,6400).filter(r=>Math.abs(r.y-r.x*.2)<175);
 assert.equal(road.length,0);
});
test('off-screen production is bounded and a cargo travels through actual world positions',()=>{
 const w=new World();advanceRegionalSupply(w,61);
 const s=w.regionalSupply,c=s.convoys[0];assert.ok(c);
 assert.ok(c.x>34000&&c.y>6000);
 advanceRegionalSupply(w,111.5);assert.ok(c.y<6000);
 assert.ok(regionalSupplyValid(s,111.5));
 advanceRegionalSupply(w,1200);
 assert.ok(s.delivered>0&&s.pendingRaid);assert.ok(s.reserves<=2&&s.ore<=SUPPLY.capacity&&s.convoys.length<=2);
 const before=JSON.stringify(s);advanceRegionalSupply(w,1200);assert.equal(JSON.stringify(s),before);
});
function simulate(intercept){
 const g=game();let raiders=0;
 for(let t=1;t<=900;t++){
  g.time=t;updateRegionalWorld(g,1);
  if(intercept)for(const c of [...g.world.regionalSupply.convoys]){c.hp=0;assert.ok(interceptSupply(g.world,c,t));}
  if(spawnRegionalRaid(g,{...openingThreat(t,5),cap:30}))raiders++;
  g.enemies=[];
 }
 return {raiders,s:g.world.regionalSupply};
}
test('two fifteen-minute runs have different enemy arrivals after interception, not just different counters',()=>{
 const normal=simulate(false),blocked=simulate(true);
 assert.ok(normal.raiders>=2);assert.ok(normal.s.delivered>0);
 assert.equal(blocked.raiders,0);assert.equal(blocked.s.delivered,0);assert.ok(blocked.s.intercepted>=3);
});
test('capture stops new shipping without erasing cargo in flight; capturing the destination spends no hidden stock',()=>{
 const w=new World();advanceRegionalSupply(w,70);
 const mine=w.stations.get(SUPPLY.mineId),c=w.regionalSupply.convoys[0];
 mine.enemy=false;mine.captured=true;strategicCapture(w,mine,70);
 advanceRegionalSupply(w,100);assert.equal(w.regionalSupply.serial,1);assert.ok(w.regionalSupply.convoys.includes(c));
 advanceRegionalSupply(w,1000);assert.equal(w.regionalSupply.delivered,1);
 const war=w.stations.get(SUPPLY.militaryId);war.enemy=false;war.captured=true;strategicCapture(w,war,1000);
 assert.equal(w.regionalSupply.reserves,0);assert.equal(w.regionalSupply.pendingRaid,null);
 advanceRegionalSupply(w,10000);assert.equal(w.regionalSupply.serial,1);
});
test('strategic structures and cargo are ordinary weapon targets even before old base level gates',()=>{
 const g=game(),mine=g.world.stations.get(SUPPLY.mineId);g.player.x=mine.x;g.player.y=mine.y;
 const targets=combatTargets(g,500);assert.equal(targets.filter(t=>t.kind==='turret').length,2);
 assert.equal(targets.filter(t=>t.kind==='base').length,0);
 for(const t of mine.turrets)t.hp=0;
 const core=combatTargets(g,500).find(t=>t.target===mine);assert.ok(core);
 damageTarget(g,core,1000,'beam');assert.ok(mine.captured);assert.equal(mine.enemy,false);
 const other=game();advanceRegionalSupply(other.world,61);const cargo=other.world.regionalSupply.convoys[0];
 other.player.x=cargo.x;other.player.y=cargo.y;
 const target=combatTargets(other,500).find(t=>t.target===cargo);assert.ok(target);
 damageTarget(other,target,200,'rail');assert.equal(other.world.regionalSupply.convoys.length,0);
 assert.equal(other.drops.length,2);hitRegionalCargo(other,cargo,200);assert.equal(other.drops.length,2);
});
test('a heavy reinforcement always warns, adds a ship to a patrol and waits for cap space',()=>{
 const g=game(),s=g.world.regionalSupply;s.reserves=1;s.assemblyUntil=1;
 g.time=10;updateRegionalWorld(g,1);assert.ok(s.pendingRaid.announced);
 const director={...openingThreat(500,5),cap:30};
 assert.equal(spawnRegionalRaid(g,director),false);
 g.time=21;assert.equal(spawnRegionalRaid(g,{...director,cap:2}),false);
 assert.ok(spawnRegionalRaid(g,director));
 assert.equal(g.enemies.filter(e=>e.type==='gunship').length,1);
 assert.equal(g.enemies.length,director.groupSize+1);
 assert.equal(spawnRegionalRaid(g,director),false);
});
test('the map explains long-distance choices without revealing unseen industrial bases',()=>{
 const g=game(),html=renderWorldMap(g);
 for(const r of REGIONS)assert.ok(html.includes(r.name));
 assert.ok(html.includes('Контуры условны'));
 assert.ok(!html.includes('Добывающий комплекс</strong>'));
 const mine=g.world.stations.get(SUPPLY.mineId);mine.discovered=true;
 assert.ok(renderWorldMap(g).includes('Добывающий комплекс</strong>'));
});
test('storm warnings and contact share exact geometry; each discharge hits only once',()=>{
 const field=stormFields(6000,40000,3000)[0];assert.ok(field);
 const now=34-field.offset+48,phase=stormPhase(field,now);
 assert.equal(phase.state,'discharge');assert.equal(stormPhase(field,now-2).state,'warning');
 const player={x:field.x,y:field.y,r:19};
 assert.equal(stormContact(player,field,phase,now),'damage');
 assert.equal(stormContact(player,field,phase,now+.01),'none');
 assert.equal(stormContact({x:field.x+field.r+25,y:field.y,r:19},field,phase,now),'none');
 const adapted={...player,regionalStormHits:[],stormAdapted:true};
 assert.equal(stormContact(adapted,field,phase,now),'charge');assert.ok(adapted.stormChargedUntil>now);
 assert.equal(stormWeaponDamage(adapted,20,'rail',now),20);
 assert.equal(stormWeaponDamage(adapted,20,'ion',now),30);assert.equal(adapted.stormChargedUntil,0);
 assert.ok(adapted.chargeDisabledUntil>now);
 const g=game();g.time=now-2;g.regionalStormFields=[field];
 const e={x:field.x-800,y:field.y,vx:0,vy:0,stormAdapted:true};
 assert.ok(stormSeek(e,g,.1));assert.ok(e.vx>0);
 g.time=now;const disabled={...adapted,regionalStormHits:[]};
 stormContact(disabled,field,phase,now);assert.equal(disabled.stormChargedUntil,0);
});


test('actual map buttons select canonical region entries and track only discovered cargo',()=>{
 const g=game();g.overlay={dataset:{mode:'map'}};
 g.requestWaypointDeparture=waypoint=>{g.selected=waypoint;};
 g.selectWaypoint({id:'region-amber',x:'1',y:'1',label:'arbitrary'});
 assert.deepEqual(g.selected,{id:'region-amber',...REGIONS[1].survey,label:REGIONS[1].name});
 advanceRegionalSupply(g.world,61);const c=g.world.regionalSupply.convoys[0];g.selected=null;
 g.selectWaypoint({id:c.id,x:'1',y:'1'});assert.equal(g.selected,null);
 c.seen=true;g.selectWaypoint({id:c.id,x:'1',y:'1'});assert.equal(g.selected.x,c.x);
});


test('storm charge accelerates the real firing clock and ion removes the acceleration',()=>{
 const g=game();g.time=100;g.regionalStormFields=[];
 const e={type:'flanker',serial:1,group:1,x:-200,y:0,vx:0,vy:0,r:14,
  hp:50,maxHp:50,damage:13,think:1,fire:10,state:'flank',commitUntil:200,
  target:g.player,stormAdapted:true,stormChargedUntil:118};
 g.enemies=[e];updateRegionalStorms(g,.1);updateEnemy(e,g,.1);
 assert.ok(Math.abs(e.fire-9.85)<1e-8);
 stormWeaponDamage(e,20,'ion',100);updateRegionalStorms(g,.1);updateEnemy(e,g,.1);
 assert.ok(Math.abs(e.fire-9.75)<1e-8);
});
test('a large storm keeps its countdown inside the viewport at low visual quality',()=>{
 const labels=[],field={id:'test',x:300,y:200,r:550,offset:0};
 const g={regionalStormFields:[field],time:30,fps:18,visuals:{reducedMotion:true}};
 const c=new Proxy({fillText:(...args)=>labels.push(args)},
  {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 drawRegionalStorms(g,c,{x:0,y:0,w:620,h:400});
 const cue=labels.find(l=>l[0].startsWith('БУРЯ'));
 assert.ok(cue);assert.ok(cue[1]>=145&&cue[1]<=475);assert.ok(cue[2]>=115&&cue[2]<280);
});
