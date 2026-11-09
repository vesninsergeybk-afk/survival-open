import test from 'node:test';
import assert from 'node:assert/strict';
import {createContours,autoConnectContours,contourFields,advanceContours,validContours} from '../territory-system.js';
import {registerContourTrials,pendingContourTrials,productiveContourFields,
 prepareContourVortex,readyContourTrials,completeContourTrial,planContourTrial,TRIAL_VARIANTS} from '../contour-trials.js';
import {updateContourTrials,activateContourVortex} from '../contour-trial-director.js';
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
function clearWaves(g,entry){
 for(let index=0;index<3;index++){
  for(const enemy of g.enemies.filter(e=>e.trialId===entry.id))enemy.hp=0;
  g.time+=8;updateContourTrials(g,.1);
  if(index<2){
   assert.equal(g.contourTrial?.phase,'rest');
   g.time+=5;updateContourTrials(g,.1);
   assert.equal(g.contourTrial?.phase,'wave');
   assert.equal(g.contourTrial.waveIndex,index+1);
  }
 }
 assert.equal(g.contourTrial.phase,'wave');
 assert.equal(g.contourTrial.quotaReached,true);
 assert.equal(entry.status,'pending');
}
function chargeCore(g,entry){
 g.actionHeld={kind:'vortex',target:entry,source:'keyboard',progress:18};
 assert.equal(activateContourVortex(g,entry),true);
 g.actionHeld=null;
}

test('a new triangle queues one trial and pays no flux before victory',()=>{
 const world=territory(),created=claim(world);
 assert.equal(created.length,1);
 assert.equal(created[0].tier,1);
 assert.equal(productiveContourFields(world,contourFields(world)).length,0);
 for(let t=1;t<=100;t++)advanceContours(world,t,1,[],{x:0,y:0});
 assert.equal(world.contours.flux,0);
 assert.equal(world.contours.harvesters.length,0);
 assert.equal(completeContourTrial(world,created[0].id),false,'closing the triangle does not activate its core');
 assert.equal(prepareContourVortex(world,created[0].id),true);
 assert.equal(productiveContourFields(world,contourFields(world)).length,0,'three waves alone do not start mining');
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

test('a defended but not yet activated vortex still advances the next territory tier',()=>{
 const field=(id,x)=>({id,center:{x:x+60,y:60},
  polygon:[{x,y:0},{x:x+120,y:0},{x:x+60,y:120}]});
 const [first,second,third]=[field('a',0),field('b',200),field('c',400)];
 const world={contours:createContours()};
 const [a]=registerContourTrials(world,[],[first],100);
 assert.equal(a.tier,1);
 assert.equal(prepareContourVortex(world,a.id),true);
 const [b]=registerContourTrials(world,[first],[first,second],100);
 assert.equal(b.tier,2,'a ready core cannot restart the campaign at tier 1');
 assert.equal(prepareContourVortex(world,b.id),true);
 const [c]=registerContourTrials(world,[first,second],[first,second,third],100);
 assert.equal(c.tier,3,'several unactivated cores still advance the defence');
 assert.equal(world.contours.trials.serial,3);
 assert.equal(world.contours.trials.completed,0);
});

test('three growing siege waves bring real IRIS packs and heavy support',()=>{
 const [a,b,c]=[1,2,3].map(tier=>planContourTrial(tier,tier));
 assert.equal(a.waves.length,3);
 assert.ok(a.waves.every(w=>w.scout>=10));
 assert.ok(a.waves[0].fighter>=2&&a.waves[1].berserker>0&&a.waves[2].gunship>0);
 const count=w=>Object.values(w).reduce((sum,n)=>sum+n,0);
 assert.ok(count(a.waves[0])>=12&&count(a.waves[1])>=18&&count(a.waves[2])>=24);
 assert.ok(count(a.waves[0])<count(a.waves[1])&&count(a.waves[1])<count(a.waves[2]));
 assert.equal(b.waves.length,3);
 assert.equal(c.waves.length,3);
 assert.ok(c.waves[0].scout>0&&c.waves[1].fighter>0);
 assert.equal(planContourTrial(999,100).tier,12);
});

test('procedural sieges stay deterministic, varied and capped as they escalate',()=>{
 const kinds=new Set();
 const firstWaveVariants=new Set(),lastWaveVariants=new Set(),formations=new Set();
 for(let tier=1;tier<=12;tier++)for(let serial=1;serial<=100;serial++){
  const plan=planContourTrial(tier,serial);
  for(const v of plan.variants)kinds.add(v.id);
  assert.deepEqual(plan,planContourTrial(tier,serial),'a failed attempt must not reroll');
  formations.add(plan.formations.join('/'));
  if(tier===1)firstWaveVariants.add(JSON.stringify(plan.waves));
  if(tier===10)lastWaveVariants.add(JSON.stringify(plan.waves));
  assert.ok(plan.waves.length<=3);
  assert.ok(plan.waves.every(w=>Object.values(w).reduce((s,n)=>s+n,0)<=66));
  assert.ok(plan.waves.every(w=>w.scout>=10));
  assert.ok(plan.strikeInterval>=5);
 }
 assert.deepEqual(kinds,new Set(TRIAL_VARIANTS.map(v=>v.id)));
 assert.ok(firstWaveVariants.size>5&&lastWaveVariants.size>5&&formations.size>20);
 const first=planContourTrial(1,1),tenth=planContourTrial(10,10);
 assert.ok(tenth.waves.every((w,i)=>Object.values(w).reduce((s,n)=>s+n,0)>
  Object.values(first.waves[i]).reduce((s,n)=>s+n,0)*1.7));
 assert.ok(tenth.recommendedLevel>=17&&tenth.strikeCount===3);
});

test('an existing checkpoint shape stays valid; malformed trial records fail safely',()=>{
 const world=territory();claim(world);
 const valid=world.contours.trials;
 assert.equal(validContours({...world.contours,trials:undefined},[...world.stations]),true);
 assert.equal(validContours({...world.contours,trials:{...valid,completed:-1}},[...world.stations]),false);
 assert.equal(validContours({...world.contours,trials:{...valid,entries:[{...valid.entries[0],x:Infinity}]}},[...world.stations]),false);
 assert.equal(validContours({...world.contours,trials:{...valid,entries:[valid.entries[0],valid.entries[0]]}},[...world.stations]),false);
});

test('a local trial spawns three waves, then requires a manual vortex activation',()=>{
 const g=game(),w=territory(),entries=claim(w);
 g.world=w;g.contourTrial=null;g.operation=null;g.heavyPortalShown=false;
 g.player.x=entries[0].x;g.player.y=entries[0].y;
 g.camera=()=>({x:g.player.x-300,y:g.player.y-250,w:600,h:500});
 g.zones=[];g.enemies=[];g.time=20;
 g.rewardNotice=(text)=>{g.lastReward=text;};
 updateContourTrials(g,.1);
 assert.equal(g.contourTrial.phase,'warning');
 assert.equal(g.enemies.length,0);
 g.time+=6;updateContourTrials(g,.1);
 assert.equal(g.contourTrial.phase,'wave');
 assert.ok(g.enemies.length>=12);
 assert.ok(g.enemies.every(e=>e.trialId===entries[0].id&&e.expAwarded));
 assert.ok(g.enemies.every(e=>e.trialObjective?.x===entries[0].x&&
  e.trialObjective?.y===entries[0].y),
 'every attacking ship must receive the fixed core destination');
 assert.equal(g.contourTrial.plan.strikeCount,2,'even the first siege has crossfire');
 assert.equal(g.enemies.filter(e=>e._trialDiveEnabled).length,3,
  'several IRIS scouts can coordinate telegraphed dives, with a separate rush cap');
 const packs=new Map();for(const e of g.enemies)packs.set(e.group,(packs.get(e.group)||0)+1);
 assert.ok([...packs.values()].every(count=>count<=6),'the IRIS network needs bounded wings');
 assert.ok(packs.size>=2,'the fleet must arrive in multiple coordinated groups');
 g.zones.push({x:g.player.x,y:g.player.y,r:66,fuse:2,trialId:entries[0].id});
 clearWaves(g,entries[0]);
 assert.equal(g.contourTrial.phase,'wave');
 assert.ok(g.zones.some(z=>z.trialId===entries[0].id),
  'orbital warnings remain active while the pilot must charge the core');
 assert.equal(w.contours.trials.completed,0);
 assert.equal(readyContourTrials(w).length,0);
 assert.equal(activateContourVortex(g,entries[0]),false,
  'defeating every ship is insufficient without a held core charge');
 chargeCore(g,entries[0]);
 assert.equal(g.zones.filter(z=>z.trialId===entries[0].id).length,0,
  'orbital shells cannot land after the actual activation');
 assert.equal(w.contours.trials.completed,1);
 assert.match(g.lastReward,/Воронка открыта/);
 assert.equal(pendingContourTrials(w).length,0);
 assert.equal(completeContourTrial(w,entries[0].id),false);
});

test('each actually spawned formation matches the planned wave and visible warning',()=>{
 const g=game(),w=territory(),entry=claim(w)[0];
 entry.tier=2;entry.id=2;g.world=w;g.contourTrial=null;g.operation=null;
 g.player.x=entry.x;g.player.y=entry.y;g.enemies=[];g.zones=[];g.time=20;
 g.camera=()=>({x:g.player.x-300,y:g.player.y-250,w:600,h:500});
 const announced=[];
 g.notice=message=>{const match=message.match(/Построение: ([^.]+)\./);
  if(match)announced.push(match[1]);};
 updateContourTrials(g,.1);g.time+=6;updateContourTrials(g,.1);
 const formations=g.contourTrial.plan.formations;
 assert.deepEqual(formations,['клещи','рой','окружение'],
  'exercise three distinct approaches, including a non-swarm final wave');
 for(let wave=0;wave<3;wave++){
  assert.equal(g.contourTrial?.waveIndex,wave);
  for(const enemy of g.enemies.filter(e=>e.trialId===entry.id))enemy.hp=0;
  g.time+=8;updateContourTrials(g,.1);
  if(wave<2){g.time+=5;updateContourTrials(g,.1);}
 }
 assert.deepEqual(announced,formations,
  'the last wave must not silently fall back to a swarm');
 assert.equal(entry.status,'pending');
 assert.equal(g.contourTrial.quotaReached,true);
});

test('retreat resets only this encounter and preserves every station',()=>{
 const g=game(),w=territory(),entry=claim(w)[0];
 g.world=w;g.contourTrial=null;g.operation=null;g.heavyPortalShown=false;
 g.player.x=entry.x;g.player.y=entry.y;
 g.camera=()=>({x:g.player.x-300,y:g.player.y-250,w:600,h:500});
 g.zones=[];g.enemies=[];g.time=20;
 updateContourTrials(g,.1);g.time+=6;updateContourTrials(g,.1);
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
 updateContourTrials(g,.1);g.time+=6;updateContourTrials(g,.1);
 const originalCount=g.enemies.length;assert.ok(originalCount>=12);
 // The game's normal distance culler may remove live ships mid-flight.
 g.enemies=[];g.time+=1;updateContourTrials(g,.1);
 assert.equal(g.contourTrial.phase,'wave');
 assert.equal(g.enemies.length,originalCount,'lost attackers rejoin this wave, not restart the entire trial');
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
  updateContourTrials(g,.1);g.time+=6;updateContourTrials(g,.1);
  return {g,w,entry};
 };
 const defended=setup();clearWaves(defended.g,defended.entry);
 assert.equal(defended.w.contours.trials.completed,0);
 chargeCore(defended.g,defended.entry);
 assert.equal(defended.w.contours.trials.completed,1);
 assert.equal(defended.g.contourTrial,null);
 const inactive=setup();inactive.g.time+=inactive.g.contourTrial.plan.waveSeconds+1;
 updateContourTrials(inactive.g,.1);
 assert.equal(inactive.g.contourTrial,null);
 assert.equal(inactive.w.contours.trials.completed,0);
 inactive.g.time+=1;updateContourTrials(inactive.g,.1);
 assert.equal(inactive.g.contourTrial,null,'failure has a short retry pause');
});

test('three-wave defence warns before the stronger stages and strikes are telegraphed',()=>{
 const g=game(),w=territory(),entry=claim(w)[0];entry.tier=3;
 g.world=w;g.contourTrial=null;g.operation=null;g.heavyPortalShown=false;
 g.player.x=entry.x;g.player.y=entry.y;
 g.camera=()=>({x:g.player.x-300,y:g.player.y-250,w:600,h:500});
 g.zones=[];g.enemies=[];g.time=20;
 updateContourTrials(g,.1);g.time+=6;updateContourTrials(g,.1);
 assert.ok(g.enemies.some(e=>e.type==='scout'));
 g.time+=4;updateContourTrials(g,.1);
 assert.ok(g.zones.some(z=>z.trialId===entry.id&&z.fuse>=2));
 for(const e of g.enemies)e.hp=0;
 g.time+=4;
 updateContourTrials(g,.1);
 assert.equal(g.contourTrial.phase,'rest');
 g.time+=5;updateContourTrials(g,.1);
 assert.ok(g.enemies.some(e=>e.type==='fighter'&&e.hp>0));
 for(const e of g.enemies)e.hp=0;
 g.time+=8;updateContourTrials(g,.1);
 assert.equal(g.contourTrial.phase,'rest');
 g.time+=5;updateContourTrials(g,.1);
 assert.ok(g.enemies.some(e=>e.hp>0));
 for(const e of g.enemies)e.hp=0;
 g.time+=8;
 updateContourTrials(g,.1);
 assert.equal(entry.status,'pending');
 assert.equal(g.contourTrial.quotaReached,true);
 assert.equal(w.contours.trials.completed,0);
 chargeCore(g,entry);
 assert.equal(w.contours.trials.completed,1);
});

test('tenth triangle starts an actual multi-wing assault under triple orbital fire',()=>{
 const g=game(),w=territory(),entry=claim(w)[0];entry.tier=10;
 g.world=w;g.contourTrial=null;g.operation=null;g.enemies=[];g.zones=[];g.time=20;
 g.player.x=entry.x;g.player.y=entry.y;
 g.camera=()=>({x:g.player.x-350,y:g.player.y-270,w:700,h:540});
 updateContourTrials(g,.1);g.time+=7;updateContourTrials(g,.1);
 const event=g.contourTrial;
 assert.equal(event.phase,'wave');assert.ok(g.enemies.length>=30);
 assert.ok(g.enemies.filter(e=>e.type==='scout').length>=10);
 assert.ok(g.enemies.some(e=>e.type==='fighter'));
 const sizes=new Map();for(const e of g.enemies)sizes.set(e.group,(sizes.get(e.group)||0)+1);
 assert.ok(sizes.size>=5&&[...sizes.values()].every(n=>n<=6));
 assert.equal(event.required,Math.ceil(g.enemies.length*.76));
 g.time+=4;updateContourTrials(g,.1);
 const strikes=g.zones.filter(z=>z.trialId===entry.id);
 assert.equal(strikes.length,3,'endgame uses three announced, dodgeable target areas');
 assert.ok(strikes.every(z=>z.fuse>=2));
 assert.ok(new Set(strikes.map(z=>Math.round(z.x))).size>1);
 assert.equal(w.contours.trials.completed,0);
 assert.equal(entry.status,'pending');
});

test('destroying less than the announced quota cannot complete a mass assault',()=>{
 const g=game(),w=territory(),entry=claim(w)[0];
 g.world=w;g.contourTrial=null;g.operation=null;g.enemies=[];g.zones=[];g.time=20;
 g.player.x=entry.x;g.player.y=entry.y;
 g.camera=()=>({x:g.player.x-300,y:g.player.y-250,w:600,h:500});
 updateContourTrials(g,.1);g.time+=7;updateContourTrials(g,.1);
 const quota=g.contourTrial.required;
 for(const e of g.enemies.slice(0,quota-1))e.hp=0;
 g.time+=9;updateContourTrials(g,.1);
 assert.equal(g.contourTrial.phase,'wave');
 assert.equal(entry.status,'pending');
 g.enemies[quota-1].hp=0;g.time+=.2;updateContourTrials(g,.1);
 assert.equal(g.contourTrial.phase,'rest');
 assert.equal(entry.status,'pending');
});
