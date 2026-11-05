import test from 'node:test';
import assert from 'node:assert/strict';
import {game} from './weapons-scene.mjs';
import {World} from '../world.js';
import {openingThreat} from '../balance.js';
import {warFronts} from '../war-fronts.js';
import {campaignProgress,regionalCampaignPressure,renderCampaignProgress,campaignDestination} from '../regional-campaign.js';
import {homeIndustryState} from '../home-conflict.js';
import {strategicCapture,advanceRegionalSupply,regionalSupplyValid} from '../regional-supply.js';
import {FRONTIERS} from '../frontier-industry.js';
import {labLogisticsIntel} from '../station-progression.js';
import {CENTRAL_INDUSTRY} from '../central-industry.js';
import {autonomousStrikeCarrier} from '../carrier-interception.js';
import {renderBasePanel} from '../base-panel.js';

test('the campaign derives four fronts from ownership and actual remaining deliveries',()=>{
 const w=new World();assert.equal(campaignProgress(w).secured,0);
 for(const f of warFronts(w)){
  f.depot.enemy=false;f.depot.captured=true;f.depot.active=true;
  strategicCapture(w,f.depot,0);
 }
 assert.equal(campaignProgress(w).secured,4);assert.ok(campaignProgress(w).complete);
 assert.ok(w.stations.get('industry:source').enemy,'capturing a factory need not also capture its mine');
});
test('time cannot restore an industrial swarm in a subdued charted region; uncharted space retains its rules',()=>{
 const w=new World(),locations=[{x:35000,y:7000},{x:6000,y:-40000},
  {x:6000,y:40000},{x:-40000,y:7000}];
 const late=openingThreat(20000,25);
 for(const p of locations){
  const live=regionalCampaignPressure(late,w,p);
  assert.ok(live.cap<=28);assert.ok(live.interval>=4.8);
 }
 for(const f of warFronts(w)){f.depot.enemy=false;f.depot.captured=true;strategicCapture(w,f.depot,0);}
 for(const p of locations){
  const quiet=regionalCampaignPressure(late,w,p);
  assert.ok(quiet.cap<=14);assert.ok(quiet.interval>=8.6);
 }
 assert.deepEqual(regionalCampaignPressure(late,w,{x:80000,y:0}),late);
 assert.equal(regionalCampaignPressure(openingThreat(0),w,locations[0]).cap,0);
});
test('a stopped worker with a dispatchable stockpile has not yet secured the home region',()=>{
 const w=new World(),s=w.regionalSupply.central;
 s.worker.hp=0;s.worker.phase='disabled';s.ore=8;
 assert.equal(homeIndustryState(w).outcome,null);
 assert.equal(warFronts(w).find(f=>f.key==='home').outcome,null);
 advanceRegionalSupply(w,61);assert.equal(s.convoys.length,1);
 assert.equal(homeIndustryState(w).outcome,null);
 s.convoys=[];s.reserves=0;s.pendingRaid=null;s.ore=0;
 assert.equal(homeIndustryState(w).outcome,'starved');
});
test('source capture leaves previously paid reserves, whereas factory capture cancels them',()=>{
 const w=new World(),s=w.regionalSupply.frontier.azure;
 s.reserves=1;s.assemblyUntil=1;
 const src=w.stations.get(FRONTIERS.azure.sourceId);src.enemy=false;src.captured=true;
 strategicCapture(w,src,0);
 assert.equal(warFronts(w).find(f=>f.key==='azure').outcome,null);
 const depot=w.stations.get(FRONTIERS.azure.depotId);depot.enemy=false;depot.captured=true;
 strategicCapture(w,depot,0);
 assert.equal(warFronts(w).find(f=>f.key==='azure').outcome,'captured');
 assert.ok(regionalSupplyValid(w.regionalSupply,0));
});
test('forward labs reveal approximate real sources in each region and expand cargo coverage',()=>{
 for(const key of ['north','azure','teal']){
  const g=game(),front=warFronts(g.world).find(f=>f.key===key),source=front.source;
  const lab={id:'1:1',type:'lab',active:true,enemy:false,discovered:true,
   x:source.x-700,y:source.y+50,turrets:[],hp:800,maxHp:800};
  g.world.stations.set(lab.id,lab);
  const lead=labLogisticsIntel(g.world,g.player).contacts.find(c=>c.id==='intel:'+key+'-source');
  assert.ok(lead,key);assert.notEqual(lead.x,source.x);assert.equal(source.discovered,false);
  lab.suppressed=true;
  assert.equal(labLogisticsIntel(g.world,g.player).contacts.some(c=>c.id===lead.id),false);
  assert.match(labLogisticsIntel(g.world,g.player).status,/подавлена/);
 }
});
test('campaign navigation exposes regional survey points and never hidden station coordinates',()=>{
 const g=game();g.world.regionalSupply.central.conflict={version:1,offeredAt:5,plan:null,outcome:null};
 const html=renderCampaignProgress(g,{compact:true});
 assert.match(html,/четыре промышленные сети/);assert.match(html,/0\/4/);
 assert.match(html,/data-act="campaignFront"/);
 assert.doesNotMatch(html,/data-x=|data-y=|industry:depot/);
 const p=campaignProgress(g.world);assert.equal(p.complete,false);
 assert.ok(g.world.stations.get(CENTRAL_INDUSTRY.depotId).enemy);
});
test('after a northern mine capture, the next plan leads to the military frontier, with no unknown exact coordinates',()=>{
 const g=game(),front=warFronts(g.world).find(f=>f.key==='north');
 assert.equal(campaignDestination(g,'north').id,'region-amber');
 front.source.enemy=false;front.source.captured=true;front.pool.pendingRaid={readyAt:20};
 assert.equal(campaignDestination(g,'north').id,'region-lilac');
 front.depot.discovered=true;
 assert.equal(campaignDestination(g,'north').id,front.depotId);
 assert.equal(campaignDestination(g,'unknown'),null);
});
test('funded repair capacity and an expedition in flight prevent premature regional victory',()=>{
 const w=new World(),s=w.regionalSupply.frontier.teal;
 s.worker.hp=0;s.worker.phase='disabled';s.wrecks.forEach(r=>{r.hp=0;r.stock=0;});
 s.resource=4;
 const depot=w.stations.get(FRONTIERS.teal.depotId);depot.hp=depot.maxHp*.5;
 assert.equal(warFronts(w).find(f=>f.key==='teal').outcome,null);
 advanceRegionalSupply(w,141);assert.ok(s.repairExpedition);
 assert.equal(warFronts(w).find(f=>f.key==='teal').outcome,null);
 advanceRegionalSupply(w,210);assert.equal(s.repairsCompleted,1);
 assert.equal(warFronts(w).find(f=>f.key==='teal').outcome,'starved');
});
test('a temporarily exhausted repair dispatch window does not declare a funded enemy network defeated',()=>{
 const w=new World(),s=w.regionalSupply.frontier.teal;
 s.worker.hp=0;s.worker.phase='disabled';s.wrecks.forEach(r=>{r.hp=0;r.stock=0;});
 s.resource=4;s.repairsLaunched=2;s.repairsCompleted=2;
 s.repairDispatchTimes=[300,500];s.nextRepairAt=740;
 const depot=w.stations.get(FRONTIERS.teal.depotId);
 depot.hp=depot.maxHp*.3;
 assert.equal(warFronts(w).find(f=>f.key==='teal').outcome,null,
  'the stock can finance a later expedition once the rolling cooldown expires');
 s.resource=0;
 assert.equal(warFronts(w).find(f=>f.key==='teal').outcome,'starved',
  'without production, reserves or funded repairs the network is genuinely exhausted');
});
test('a captured assembly station opens paid local air support without pretending it has a home radio link',()=>{
 const g=game(),post=g.world.stations.get(CENTRAL_INDUSTRY.depotId);
 post.enemy=false;post.captured=true;post.active=true;post.discovered=true;
 g.docked=post;g.player.x=post.x;g.player.y=post.y;g.player.ore=100;
 assert.ok(autonomousStrikeCarrier(post));assert.equal(g.world.networkTopology().linked.has(post.id),false);
 assert.match(renderBasePanel(post,g.baseState()),/трофейная авиагруппа/);
 g.baseAction('supply');assert.equal(g.support.charges,1);assert.equal(g.player.ore,60);
 const target=g.world.stations.get(CENTRAL_INDUSTRY.sourceId);g.nearbyEnemyBase=()=>target;
 assert.ok(g.callStrike());assert.equal(g.support.charges,0);assert.equal(g.support.missions.length,1);
 const cost=g.player.ore;post.suppressed=true;
 g.baseAction('supply');assert.equal(g.player.ore,cost,'jammed disconnected carrier cannot load a sortie');
});
test('autonomous support has a real range and cannot be called from an unrelated captured procedural carrier',()=>{
 const g=game(),post=g.world.stations.get(CENTRAL_INDUSTRY.depotId);
 post.enemy=false;post.captured=true;post.active=true;
 g.support.charges=1;g.nearbyEnemyBase=()=>({x:35000,y:7000,hp:500,turrets:[]});
 assert.equal(g.callStrike(),false);assert.equal(g.support.charges,1);
 assert.equal(autonomousStrikeCarrier({...post,strategicRole:undefined}),false);
});
