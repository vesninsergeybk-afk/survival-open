import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {contourFields,validContours} from '../territory-system.js';
import {FLUX_SORTIE,fluxSortieOffer,launchFluxSortie,advanceFluxSortie} from '../flux-offense.js';
import {warFronts} from '../war-fronts.js';
import {backboneActive} from '../enemy-backbone.js';
import {EnemyMesh} from '../enemy-mesh.js';
import {spawnCentralRaid} from '../region-runtime.js';
import {captureCheckpoint,restoreCheckpoint,packRun,unpackRun,validateCheckpoint} from '../run-checkpoint.js';
import {game} from './weapons-scene.mjs';

function addLaunchContour(world){
 const depot=world.stations.get('industry:depot');depot.discovered=true;
 const nodes=[[5100,800],[5500,2300],[6300,1000]].map(([x,y],i)=>({
  ...world.home,id:`100:${i}`,x,y,type:'dock',turrets:[],active:true,
  enemy:false,captured:true,suppressed:false,discovered:true
 }));
 for(const node of nodes)world.stations.set(node.id,node);
 world.contours.links=[[nodes[0].id,nodes[1].id],[nodes[1].id,nodes[2].id],
  [nodes[2].id,nodes[0].id]];
 world.contours.flux=FLUX_SORTIE.cost+4;
 assert.equal(contourFields(world).length,1);
 return {depot,nodes};
}

test('an offensive sortie has a strategic origin, an actual cost, a real target and limited range',()=>{
 const world=new World(),target=world.stations.get('industry:depot');
 assert.equal(fluxSortieOffer(world,target.id,100).ok,false,'no secret depot is revealed');
 target.discovered=true;
 assert.match(fluxSortieOffer(world,target.id,100).reason,/контур/);
 const {nodes}=addLaunchContour(world);
 const offer=fluxSortieOffer(world,target.id,100);
 assert.ok(offer.ok);assert.ok(offer.distance<FLUX_SORTIE.maxRange);
 assert.ok(nodes.some(b=>b.id===offer.source.id));
 assert.equal(fluxSortieOffer(world,'industry:source',100).ok,false,
  'a random enemy site is not a valid industrial dispatch target');
 const before=world.contours.flux;
 const sent=launchFluxSortie(world,target.id,100);
 assert.ok(sent.ok);assert.equal(world.contours.flux,before-FLUX_SORTIE.cost);
 assert.deepEqual(world.contours.sortie.originId,offer.source.id);
 assert.equal(launchFluxSortie(world,target.id,101).ok,false,'no duplicate launch');
 const next=world.contours.nextSortieAt;
 assert.equal(next,100+FLUX_SORTIE.cooldown);
 world.contours.sortie=null;
 assert.match(fluxSortieOffer(world,target.id,115).reason,/через/);
 world.contours.nextSortieAt=0;
 world.contours.flux=3;
 assert.equal(fluxSortieOffer(world,target.id,221).ok,false,'flux cannot be overdrafted');
 for(const b of nodes){b.x-=9000;b.y-=9000;}
 world.contours.flux=FLUX_SORTIE.cost;
 assert.match(fluxSortieOffer(world,target.id,221).reason,/вне досягаемости/);
});

test('the paid courier crosses real space, jams only the depot radio and leaves the industry intact',()=>{
 const world=new World(),{depot}=addLaunchContour(world),front=warFronts(world).find(f=>f.key==='home');
 const before=JSON.stringify(world.regionalSupply.central),hp=depot.hp;
 const sent=launchFluxSortie(world,depot.id,100);
 assert.ok(sent.ok);
 const origin={...world.contours.sortie};
 assert.equal(backboneActive(front.source,depot,{time:100}),true);
 let events=[];
 for(let t=101;t<155;t++){
  events=advanceFluxSortie(world,t,1,[],{x:-20000,y:-20000});
  if(events.length)break;
 }
 assert.deepEqual(events.map(e=>e.kind),['sortieArrived']);
 assert.equal(world.contours.sortie,null);
 assert.ok((depot.fluxJamUntil||0)>100);
 assert.ok(depot.fluxJamUntil<=156+FLUX_SORTIE.duration);
 assert.equal(depot.hp,hp);assert.equal(depot.enemy,true);
 assert.equal(JSON.stringify(world.regionalSupply.central),before,
  'the sortie never deletes stock, a cargo or an already funded raid');
 assert.equal(backboneActive(front.source,depot,{time:depot.fluxJamUntil-1}),false);
 assert.equal(backboneActive(front.source,depot,{time:depot.fluxJamUntil}),true);
 assert.ok(Math.hypot(origin.x-depot.x,origin.y-depot.y)>0);
});

test('enemy interception is local and visible, while destroyed targets cannot consume a delivered effect',()=>{
 const w=new World(),{depot}=addLaunchContour(w);
 assert.ok(launchFluxSortie(w,depot.id,100).ok);
 const courier=w.contours.sortie,assailant={x:courier.x,y:courier.y,hp:10};
 assert.deepEqual(advanceFluxSortie(w,101,1,[assailant],{x:-10000,y:0}),[],
  'an off-screen encounter cannot steal an unseen paid delivery');
 assert.equal(courier.hp,FLUX_SORTIE.hp);
 const witnessAtNextStep=()=>{
  const dx=depot.x-courier.x,dy=depot.y-courier.y,range=Math.hypot(dx,dy);
  assailant.x=courier.x+dx/range*FLUX_SORTIE.speed;
  assailant.y=courier.y+dy/range*FLUX_SORTIE.speed;
  return {x:assailant.x,y:assailant.y};
 };
 assert.deepEqual(advanceFluxSortie(w,102,1,[assailant],witnessAtNextStep()),[]);
 assert.equal(courier.hp,.5);
 assert.deepEqual(advanceFluxSortie(w,103,1,[assailant],witnessAtNextStep())
  .map(e=>e.kind),['sortieLost']);
 assert.equal(depot.fluxJamUntil,undefined);
 assert.equal(w.contours.flux,4,'a lost craft does not refund its fuel');
 w.contours.nextSortieAt=0;w.contours.flux=FLUX_SORTIE.cost;
 assert.ok(launchFluxSortie(w,depot.id,130).ok);
 depot.enemy=false;
 assert.deepEqual(advanceFluxSortie(w,131,1).map(e=>e.kind),['sortieAborted']);
 assert.equal(depot.fluxJamUntil,undefined);
});

test('physical mesh and funded raid dispatch really wait while the industrial transmitter is jammed',()=>{
 const g=game(),w=g.world,{depot}=addLaunchContour(w);
 const mesh=new EnemyMesh();
 const stationId='s:'+depot.id;
 mesh.update(g,[],200);
 assert.ok(mesh.nodes.has(stationId));
 depot.fluxJamUntil=242;
 mesh.update(g,[],201);
 assert.ok(!mesh.nodes.has(stationId));
 mesh.update(g,[],243);
 assert.ok(mesh.nodes.has(stationId));
 depot.fluxBreachUntil=300;
 mesh.update(g,[],244);
 assert.ok(!mesh.nodes.has(stationId),'a destroyed industrial transmitter remains offline after the jammer leaves');
 assert.equal(backboneActive(frontSource(w),depot,{time:244}),false);
 mesh.update(g,[],301);
 assert.ok(mesh.nodes.has(stationId),'the same transmitter returns after recovery');
 depot.fluxBreachUntil=0;
 const pool=w.regionalSupply.central;
 pool.pendingRaid={announced:true,readyAt:201};
 g.camera=()=>({x:g.player.x-600,y:g.player.y-400,w:1200,h:800});
 g.player.x=depot.x;g.player.y=depot.y;
 g.spawnGroup=d=>{for(let i=0;i<d.groupSize;i++)g.enemies.push({hp:20,scenario:'ambient'});return 0;};
 const director={cap:30,groupSize:2,types:['fighter']};
 g.time=205;
 assert.equal(spawnCentralRaid(g,director),false);
 assert.equal(pool.pendingRaid.readyAt,201,'the funded order must remain queued');
 assert.equal(pool.raids,0);assert.equal(g.enemies.length,0);
 g.time=243;
 assert.ok(spawnCentralRaid(g,director));
 assert.equal(pool.pendingRaid,null);
 assert.equal(pool.raids,1);
 assert.equal(g.enemies.length,5);
 assert.equal(spawnCentralRaid(g,director),false,'no double arrival');
});

function frontSource(world){return warFronts(world).find(f=>f.key==='home').source;}

test('sortie and radio-jam expiry survive saving; invalid or forged state is rejected',()=>{
 const g=game(),{depot}=addLaunchContour(g.world);
 g.time=200;g.paused=true;g.player.x=g.docked.x;g.player.y=g.docked.y;
 assert.ok(launchFluxSortie(g.world,depot.id,g.time).ok);
 let data=unpackRun(packRun(captureCheckpoint(g,g.docked)));
 assert.equal(validateCheckpoint(data),true);
 const restored=game();restoreCheckpoint(restored,data);
 assert.deepEqual(restored.world.contours.sortie,g.world.contours.sortie);
 assert.equal(restored.world.contours.nextSortieAt,200+FLUX_SORTIE.cooldown);
 const bad=unpackRun(packRun(data));bad.world.contours.sortie.targetId='fake:base';
 assert.equal(validateCheckpoint(bad),false);
 assert.equal(validContours(bad.world.contours,bad.world.stations),false);
 const completed=game();const {depot:post}=addLaunchContour(completed.world);
 completed.time=225;completed.paused=true;
 completed.player.x=completed.docked.x;completed.player.y=completed.docked.y;
 post.fluxJamUntil=260;
 data=unpackRun(packRun(captureCheckpoint(completed,completed.docked)));
 assert.ok(validateCheckpoint(data));
 const after=game();restoreCheckpoint(after,data);
 assert.equal(after.world.stations.get(post.id).fluxJamUntil,260);
 const forged=unpackRun(packRun(data));
 forged.world.stations.find(([id])=>id===post.id)[1].fluxJamUntil=1000;
 assert.equal(validateCheckpoint(forged),false);
 const legacy=unpackRun(packRun(data));
 delete legacy.world.contours.sortie;delete legacy.world.contours.nextSortieAt;
 assert.equal(validateCheckpoint(legacy),true);
});
