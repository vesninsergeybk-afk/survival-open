import test from 'node:test';
import assert from 'node:assert/strict';
import {createContours,autoConnectContours,contourFields,advanceContours,validContours} from '../territory-system.js';
import {registerContourTrials,pendingContourTrials,productiveContourFields,
 completeContourTrial,planContourTrial,TRIAL_VARIANTS,contourChargeGoal} from '../contour-trials.js';
import {updateContourTrials} from '../contour-trial-director.js';
import {game} from './weapons-scene.mjs';

const station=(id,x,y)=>({id,x,y,active:true,enemy:false,suppressed:false,type:'dock'});
const territory=()=>({stations:new Map([
 ['A',station('A',0,0)],['B',station('B',1400,0)],['C',station('C',700,1100)]
 ]),contours:createContours()});
const claim=w=>{
 const before=contourFields(w);
 autoConnectContours(w);
 return registerContourTrials(w,before,contourFields(w),770000);
};
const ignite=(g,entry)=>{
 g.actionHeld={kind:'contour',target:entry};
 updateContourTrials(g,.6);
 assert.equal(g.contourTrial?.phase,'warning','the first beam pulse triggers the counterattack');
 updateContourTrials(g,.6);
 g.actionHeld=null;
 assert.equal(g.contourTrial?.phase,'warning');
 assert.equal(g.contourTrial?.charge,.6);
};
const charge=(g,entry,seconds)=>{
 g.actionHeld={kind:'contour',target:entry};updateContourTrials(g,seconds);g.actionHeld=null;
};

test('a new triangle queues one trial and pays no flux before victory',()=>{
 const world=territory(),created=claim(world);
 assert.equal(created.length,1);
 assert.equal(created[0].tier,1);
 assert.equal(productiveContourFields(world,contourFields(world)).length,0);
 for(let t=1;t<=100;t++)advanceContours(world,t,1,[],{x:0,y:0});
 assert.equal(world.contours.flux,0);
 assert.equal(world.contours.harvesters.length,0);
 assert.equal(completeContourTrial(world,created[0].id),true);
 assert.equal(completeContourTrial(world,created[0].id),false,'a second claim cannot pay out');
 assert.equal(productiveContourFields(world,contourFields(world)).length,1);
 advanceContours(world,101,1,[],{x:0,y:0});
 assert.ok(world.contours.harvesters.length>0);
 assert.equal(validContours(world.contours,[...world.stations]),true);
});

test('a subdivision of the same land never adds a trial; a new neighbouring face does',()=>{
 const world=territory(),first=claim(world);
 const old=contourFields(world);
 world.stations.set('D',station('D',700,350));
 autoConnectContours(world);
 assert.equal(registerContourTrials(world,old,contourFields(world),0).length,0);
 assert.equal(pendingContourTrials(world).length,1);
 const previous=contourFields(world);
 // A fourth *outside* station expands the outer boundary.
 world.stations.set('E',station('E',2000,900));
 autoConnectContours(world);
 const expanded=contourFields(world);
 const gain=expanded.reduce((sum,f)=>sum+f.area,0)-previous.reduce((sum,f)=>sum+f.area,0);
 if(gain>1)assert.ok(registerContourTrials(world,previous,expanded,gain).length>=1);
 assert.equal(pendingContourTrials(world)[0].id,first[0].id);
 assert.equal(validContours(world.contours,[...world.stations]),true);
});

test('first three stages contain the promised scout and fighter waves',()=>{
 const [a,b,c]=[1,2,3].map(tier=>planContourTrial(tier,tier));
 assert.deepEqual(a.waves,[{scout:2},{scout:2},{scout:3}]);
 assert.equal(b.waves.length,2);
 assert.ok(b.waves.every(w=>Object.keys(w).every(type=>type==='scout')));
 assert.equal(c.waves.length,2);
 assert.ok(c.waves[0].scout>0&&c.waves[1].fighter>0);
 assert.equal(planContourTrial(999,100).tier,12);
 assert.equal(contourChargeGoal(1),24,'the first core cannot charge entirely in the three safe windows');
 assert.ok(contourChargeGoal(12)>contourChargeGoal(1));
});

test('a red beam charges cumulatively, pauses on release, and stops outside its short range',()=>{
 const g=game(),world=territory(),entry=claim(world)[0];
 g.world=world;g.player.x=entry.x;g.player.y=entry.y;
 g.time=30;g.contourTrial=null;
 g.actionHeld={kind:'contour',target:entry};updateContourTrials(g,.01);
 assert.equal(g.contourTrial?.charge,0);
 updateContourTrials(g,3.5);
 assert.equal(g.contourTrial.charge,3.5);
 assert.equal(world.contours.trials.completed,0);
 g.actionHeld=null;updateContourTrials(g,4);
 assert.equal(g.contourTrial.charge,3.5,'releasing action preserves but never raises charge');
 g.actionHeld={kind:'contour',target:entry};g.player.x+=190;
 updateContourTrials(g,2);
 assert.equal(g.contourTrial.charge,3.5,'moving beyond the beam radius stops charging');
 g.player.x=entry.x;g.paused=true;updateContourTrials(g,3);
 assert.equal(g.contourTrial.charge,3.5,'menus cannot silently charge the core');
 g.paused=false;updateContourTrials(g,2.5);
 assert.equal(g.contourTrial.charge,6);
 g.actionHeld=null;
 g.actionHeld={kind:'contour',target:{id:-999}};updateContourTrials(g,1);
 assert.equal(g.contourTrial.charge,6,'another contextual action cannot charge this core');
 assert.equal(world.contours.trials.completed,0);
});

test('a full charge before the assault ends does not prematurely complete the triangle',()=>{
 const g=game(),world=territory(),entry=claim(world)[0];
 g.world=world;g.player.x=entry.x;g.player.y=entry.y;g.time=30;
 g.actionHeld={kind:'contour',target:entry};updateContourTrials(g,.01);
 updateContourTrials(g,g.contourTrial.chargeGoal);
 assert.equal(g.contourTrial.charge,g.contourTrial.chargeGoal);
 assert.equal(g.contourTrial.phase,'warning');
 assert.equal(world.contours.trials.completed,0);
 assert.equal(g.player.ore,400);
 g.actionHeld=null;g.time=g.contourTrial.nextWaveAt+.1;updateContourTrials(g,.1);
 assert.equal(g.contourTrial.phase,'wave');
 assert.equal(world.contours.trials.completed,0);
});

test('all ten tactical variants occur, higher tiers remain bounded',()=>{
 const kinds=new Set();
 for(let tier=1;tier<=12;tier++)for(let serial=1;serial<=100;serial++){
  const plan=planContourTrial(tier,serial);
  for(const v of plan.variants)kinds.add(v.id);
  assert.ok(plan.waves.length<=3);
  assert.ok(plan.waves.every(w=>Object.values(w).reduce((s,n)=>s+n,0)<=15));
  assert.ok(plan.strikeInterval>=5);
 }
 assert.deepEqual(kinds,new Set(TRIAL_VARIANTS.map(v=>v.id)));
});

test('an existing checkpoint shape stays valid; malformed trial records fail safely',()=>{
 const world=territory();claim(world);
 const valid=world.contours.trials;
 assert.equal(validContours({...world.contours,trials:undefined},[...world.stations]),true);
 assert.equal(validContours({...world.contours,trials:{...valid,completed:-1}},[...world.stations]),false);
 assert.equal(validContours({...world.contours,trials:{...valid,entries:[{...valid.entries[0],x:Infinity}]}},[...world.stations]),false);
 assert.equal(validContours({...world.contours,trials:{...valid,entries:[valid.entries[0],valid.entries[0]]}},[...world.stations]),false);
});

test('the player ignites a local core, then completes three distinct waves before flux starts',()=>{
 const g=game(),w=territory(),entries=claim(w);
 g.world=w;g.contourTrial=null;g.operation=null;g.heavyPortalShown=false;
 g.player.x=entries[0].x;g.player.y=entries[0].y;
 g.camera=()=>({x:g.player.x-300,y:g.player.y-250,w:600,h:500});
 g.zones=[];g.enemies=[];g.time=20;
 g.rewardNotice=(text)=>{g.lastReward=text;};
 updateContourTrials(g,.1);
 assert.equal(g.contourTrial,null,'arriving at the core is not an activation');
 ignite(g,entries[0]);
 assert.equal(g.enemies.length,0);
 g.time+=6;updateContourTrials(g,.1);
 assert.equal(g.contourTrial.phase,'wave');
 assert.equal(g.enemies.length,2);
 assert.ok(g.enemies.every(e=>e.trialId===entries[0].id&&e.expAwarded));
 assert.equal(g.enemies.filter(e=>e._trialDiveEnabled).length,0,'the scouting wave has no dive');
 g.zones.push({x:g.player.x,y:g.player.y,r:66,fuse:2,trialId:entries[0].id});
 for(let wave=0;wave<3;wave++){
  assert.equal(g.contourTrial.waveIndex,wave);
  const alive=g.enemies.filter(e=>e.trialId===entries[0].id&&e.hp>0);
  assert.equal(alive.filter(e=>e._trialDiveEnabled).length,wave,
   'each successive wave contains more kamikaze scouts');
  for(const e of alive)e.hp=0;
  updateContourTrials(g,.1);
  if(wave<2){
   assert.equal(g.contourTrial.phase,'rest');
   g.time=g.contourTrial.nextWaveAt+.1;updateContourTrials(g,.1);
  }
 }
 assert.equal(g.contourTrial?.phase,'stabilize',
  'defeating every wave without charging the core must not pay a reward');
 assert.equal(w.contours.trials.completed,0);
 const oldCharge=g.contourTrial.charge;
 updateContourTrials(g,3);assert.equal(g.contourTrial.charge,oldCharge,
  'letting go of the beam freezes the percentage');
 g.time=g.contourTrial.nextStrikeAt+.1;updateContourTrials(g,.1);
 assert.ok(g.zones.some(z=>z.trialId===entries[0].id),
  'finishing the wave defence without finishing charge leaves an avoidable orbital threat');
 charge(g,entries[0],g.contourTrial.chargeGoal-oldCharge);
 assert.equal(g.contourTrial,null);
 assert.equal(g.zones.filter(z=>z.trialId===entries[0].id).length,0,
  'orbital shells cannot fall after the victory announcement');
 assert.equal(w.contours.trials.completed,1);
 assert.match(g.lastReward,/Воронка открыта/);
 assert.equal(pendingContourTrials(w).length,0);
 assert.equal(completeContourTrial(w,entries[0].id),false);
});

test('retreat resets only this encounter and preserves every station',()=>{
 const g=game(),w=territory(),entry=claim(w)[0];
 g.world=w;g.contourTrial=null;g.operation=null;g.heavyPortalShown=false;
 g.player.x=entry.x;g.player.y=entry.y;
 g.camera=()=>({x:g.player.x-300,y:g.player.y-250,w:600,h:500});
 g.zones=[];g.enemies=[];g.time=20;
 ignite(g,entry);g.time+=6;updateContourTrials(g,.1);
 assert.equal(g.contourTrial.phase,'wave');
 g.player.x+=2500;g.time+=8;updateContourTrials(g,8);
 assert.equal(g.contourTrial,null);
 assert.equal(g.enemies.some(e=>e.trialId===entry.id),false);
 assert.equal(pendingContourTrials(w).length,1);
 assert.equal(w.contours.trials.completed,0);
 assert.ok([...w.stations.values()].every(s=>s.active));
});

test('enemies disappearing outside the camera cannot grant an automatic victory',()=>{
 const g=game(),w=territory(),entry=claim(w)[0];
 g.world=w;g.contourTrial=null;g.operation=null;g.heavyPortalShown=false;
 g.player.x=entry.x;g.player.y=entry.y;
 g.camera=()=>({x:g.player.x-300,y:g.player.y-250,w:600,h:500});
 g.zones=[];g.enemies=[];g.time=20;
 ignite(g,entry);g.time+=6;updateContourTrials(g,.1);
 assert.equal(g.enemies.length,2);
 // The game's normal distance culler may remove live ships mid-flight.
 g.enemies=[];g.time+=1;updateContourTrials(g,.1);
 assert.equal(g.contourTrial.phase,'wave');
 assert.equal(g.enemies.length,2,'lost attackers rejoin this wave, not restart the entire trial');
 assert.equal(w.contours.trials.completed,0);
 assert.equal(pendingContourTrials(w).length,1);
});

test('each wave has a finite resolution: battered enemies retreat; inaction fails, never autowins',()=>{
 const setup=()=>{
  const g=game(),w=territory(),entry=claim(w)[0];
  g.world=w;g.contourTrial=null;g.operation=null;g.heavyPortalShown=false;
  g.player.x=entry.x;g.player.y=entry.y;
  g.camera=()=>({x:g.player.x-300,y:g.player.y-250,w:600,h:500});
  g.zones=[];g.enemies=[];g.time=20;
  ignite(g,entry);g.time+=6;updateContourTrials(g,.1);
  return {g,w,entry};
 };
 const defended=setup();for(const enemy of defended.g.enemies)enemy.hp=0;
 for(let wave=0;wave<3;wave++){
  for(const enemy of defended.g.enemies)if(enemy.trialId===defended.entry.id)enemy.hp=0;
  updateContourTrials(defended.g,.1);
  if(defended.g.contourTrial){
   defended.g.time=defended.g.contourTrial.nextWaveAt+.1;
   updateContourTrials(defended.g,.1);
  }
 }
 assert.equal(defended.g.contourTrial?.phase,'stabilize');
 charge(defended.g,defended.entry,defended.g.contourTrial.chargeGoal);
 assert.equal(defended.w.contours.trials.completed,1);
 assert.equal(defended.g.contourTrial,null);
 const inactive=setup();inactive.g.time+=71;updateContourTrials(inactive.g,.1);
 assert.equal(inactive.g.contourTrial,null);
 assert.equal(inactive.w.contours.trials.completed,0);
 inactive.g.time+=1;updateContourTrials(inactive.g,.1);
 assert.equal(inactive.g.contourTrial,null,'failure has a short retry pause');
});

test('two-wave defence warns before the stronger second wave and strikes are telegraphed',()=>{
 const g=game(),w=territory(),entry=claim(w)[0];entry.tier=3;
 g.world=w;g.contourTrial=null;g.operation=null;g.heavyPortalShown=false;
 g.player.x=entry.x;g.player.y=entry.y;
 g.camera=()=>({x:g.player.x-300,y:g.player.y-250,w:600,h:500});
 g.zones=[];g.enemies=[];g.time=20;
 ignite(g,entry);g.time+=6;updateContourTrials(g,.1);
 assert.ok(g.enemies.some(e=>e.type==='scout'));
 g.time+=4;updateContourTrials(g,.1);
 assert.ok(g.zones.some(z=>z.trialId===entry.id&&z.fuse>=2));
 for(const e of g.enemies)e.hp=0;
 updateContourTrials(g,.1);
 assert.equal(g.contourTrial.phase,'rest');
 g.time+=5;updateContourTrials(g,.1);
 assert.ok(g.enemies.some(e=>e.type==='fighter'&&e.hp>0));
 for(const e of g.enemies)e.hp=0;
 updateContourTrials(g,.1);
 assert.equal(g.contourTrial?.phase,'stabilize');
 charge(g,entry,g.contourTrial.chargeGoal);
 assert.equal(w.contours.trials.completed,1);
});
