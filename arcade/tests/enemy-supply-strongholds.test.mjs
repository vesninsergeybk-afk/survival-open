import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {advanceRegionalSupply,regionalSupplyValid} from '../regional-supply.js';
import {CENTRAL_INDUSTRY,centralExtractionAvailable} from '../central-industry.js';
import {FRONTIERS,frontierIndustryValid} from '../frontier-industry.js';
import {warFronts} from '../war-fronts.js';
import {labLogisticsIntel} from '../station-progression.js';
import {strongholdThreat,regionalCampaignPressure} from '../regional-campaign.js';

test('deep hostile strongholds are dangerous independently of player level',()=>{
 const w=new World(),home=strongholdThreat(w,{x:360,y:-85});
 const outer=strongholdThreat(w,{x:-26500,y:4000});
 const fortress=strongholdThreat(w,{...FRONTIERS.teal.depot});
 assert.equal(home.tier,1);
 assert.ok(outer.tier>=2);
 assert.ok(fortress.tier>outer.tier);
 assert.equal(fortress.tier,5);
 assert.equal(fortress.recommendedLevel,9);
 const director={cap:21,interval:4,groupSize:3,types:['scout','fighter']};
 const promoted=regionalCampaignPressure(director,w,FRONTIERS.teal.depot);
 assert.equal(promoted.strongholdTier,5);
 assert.ok(promoted.types.includes('berserker'));
 assert.ok(!promoted.types.includes('gunship'),
  'even a fortress cannot build ambient heavy ships without deliveries');
 assert.ok(promoted.groupSize>=3);
 assert.ok(promoted.cap<=28,'strongholds may be tougher but must respect regional density caps');
 const depot=w.stations.get(FRONTIERS.teal.depotId);
 depot.enemy=false;depot.captured=true;
 const suppressed=regionalCampaignPressure(director,w,FRONTIERS.teal.depot);
 assert.equal(strongholdThreat(w,FRONTIERS.teal.depot).tier,1);
 assert.ok(!suppressed.types.includes('gunship'));
});

test('enemy military technology grows only with delivered supplies, not arbitrary time or player levels',()=>{
 const w=new World(),location=FRONTIERS.teal.depot;
 const pool=w.regionalSupply.frontier.teal;
 const base={cap:22,interval:4,groupSize:3,types:['scout','fighter','healer','gunship']};
 let threat=strongholdThreat(w,location),patrol=regionalCampaignPressure(base,w,location);
 assert.equal(threat.industrialTech,0);
 assert.ok(!patrol.types.includes('healer'));
 assert.ok(!patrol.types.includes('gunship'));
 const level=threat.recommendedLevel;
 pool.delivered=2;
 threat=strongholdThreat(w,location);patrol=regionalCampaignPressure(base,w,location);
 assert.equal(threat.industrialTech,1);
 assert.ok(threat.recommendedLevel>level);
 assert.ok(patrol.types.includes('healer'));
 assert.ok(!patrol.types.includes('gunship'));
 pool.delivered=5;
 threat=strongholdThreat(w,location);patrol=regionalCampaignPressure(base,w,location);
 assert.equal(threat.industrialTech,2);
 assert.ok(patrol.types.includes('gunship'));
 assert.equal(patrol.industrialTech,2);
 assert.ok(patrol.interval>=4,'economic growth must not accelerate ambient spawns');
 const depot=w.stations.get(FRONTIERS.teal.depotId);
 depot.enemy=false;depot.captured=true;
 threat=strongholdThreat(w,location);patrol=regionalCampaignPressure(base,w,location);
 assert.equal(threat.industrialTech,0);
 assert.equal(threat.tier,1);
 assert.ok(!patrol.types.includes('gunship'));
});

test('home miners seek a second real asteroid belt before declaring starvation',()=>{
 const w=new World(),s=w.regionalSupply.central;
 for(const r of w.nearbyRocks(CENTRAL_INDUSTRY.sourceX,CENTRAL_INDUSTRY.sourceY,850)){
  r.hp=0;r.alive=false;
 }
 advanceRegionalSupply(w,1);
 assert.equal(centralExtractionAvailable(s),true);
 assert.equal(s.worker.phase,'outbound');
 assert.ok(Math.hypot(s.worker.to.x-CENTRAL_INDUSTRY.sourceX,
  s.worker.to.y-CENTRAL_INDUSTRY.sourceY)>850);
});

test('drifting debris feeds only intact collection sites and is hauled by a living worker',()=>{
 const w=new World(),s=w.regionalSupply.frontier.teal;
 for(const wreck of s.wrecks)wreck.stock=0;
 advanceRegionalSupply(w,48);
 assert.ok(s.wrecks.some(wreck=>wreck.stock>0),'new visible scrap reaches a surviving wreck');
 assert.equal(s.lastDriftAt,48);
 assert.ok(frontierIndustryValid(w.regionalSupply.frontier,48));
 const stopped=new World(),dead=stopped.regionalSupply.frontier.teal;
 for(const wreck of dead.wrecks){wreck.hp=0;wreck.stock=0;}
 advanceRegionalSupply(stopped,120);
 assert.equal(dead.wrecks.reduce((sum,wreck)=>sum+wreck.stock,0),0);
 assert.equal(dead.lastDriftAt,-1);
});

test('teal economy sustains an active war without player sabotage for two hours',()=>{
 const w=new World(),s=w.regionalSupply.frontier.teal;
 for(let t=1;t<=7200;t++){
  advanceRegionalSupply(w,t);
  if(s.pendingRaid&&t>=s.pendingRaid.readyAt){
   s.pendingRaid=null;s.raids++;s.nextRaid=t+FRONTIERS.teal.raidInterval;
  }
 }
 assert.ok(s.delivered>=25,'new scrap must support repeated paid sorties');
 assert.ok(s.raids>=23,'the enemy should not passively run out of combat material');
 assert.equal(warFronts(w).find(f=>f.key==='teal').outcome,null);
 assert.ok(regionalSupplyValid(w.regionalSupply,7200));
});

test('laboratory does not announce working extraction when all reachable rocks are gone',()=>{
 const w=new World(),s=w.regionalSupply.central;
 for(const r of w.nearbyRocks(CENTRAL_INDUSTRY.sourceX,CENTRAL_INDUSTRY.sourceY,2400)){
  r.hp=0;r.alive=false;
 }
 advanceRegionalSupply(w,1);
 const lab=w.home;lab.type='lab';lab.enemy=false;lab.active=true;
 assert.equal(centralExtractionAvailable(s),false);
 assert.match(labLogisticsIntel(w,{x:0,y:0}).status,/Добыча остановлена/);
});
