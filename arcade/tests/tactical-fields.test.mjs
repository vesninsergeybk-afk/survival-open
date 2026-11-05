import test from 'node:test';
import assert from 'node:assert/strict';
import {createTactical,validTactical,tacticalQuote,applyTacticalChoice,
 tacticalAim,tacticalSpec,activateTactical,updateTactical,tacticalDecoy,
 tacticalRadioJammed,decoyResponse} from '../tactical-fields.js';
import {EnemyMesh} from '../enemy-mesh.js';
import {EnemyComms} from '../enemy-comms.js';
import {renderShipHangar} from '../hangar-panel.js';
import {createLoadout,HangarSession} from '../ship-loadout.js';
import {updateEnemy} from '../ai.js';
import {updateStationInterdiction} from '../strategic-command.js';

const pilot=(x=0,y=0)=>({x,y,hp:100,angle:Math.PI/2});
const enemy=(x=100,y=0,other={})=>({x,y,serial:18,type:'fighter',hp:50,maxHp:50,
 r:16,vx:0,vy:0,state:'hunt',...other});
const game=(enemies=[enemy()])=>({time:20,player:pilot(),enemies,
 tactical:createTactical()});
const station={baseActive:true,activeBases:4,level:8,ore:150,points:3};

test('starter has one reliable Space device and no consumable shots',()=>{
 const g=game(),first=activateTactical(g);
 assert.equal(first.ok,true);assert.equal(first.kind,'pulse');
 assert.equal(g.enemies[0].hp,50,'the ability does not cause hidden damage');
 assert.equal(g.enemies[0].tacticalSlowFactor,.6);
 assert.equal(g.tactical.readyAt,34);
 assert.equal(activateTactical(g).ok,false);
 g.time=34;assert.equal(activateTactical(g).ok,true,'the device recharges without spending ore');
 assert.equal(g.tactical.uses,2);
});
test('pulse helps against nearby attackers without freezing the whole world',()=>{
 const near=enemy(100),far=enemy(500),boss=enemy(60,0,{boss:true});
 const g=game([near,far,boss]);activateTactical(g);updateTactical(g);
 assert.equal(near._tacticalSpeed,.6);assert.equal(far._tacticalSpeed,1);
 assert.equal(boss._tacticalSpeed,1);
 g.time+=2.21;updateTactical(g);assert.equal(near._tacticalSpeed,1);
});
test('all four devices unlock by station progress and have one shared slot',()=>{
 let state=createTactical();
 assert.equal(tacticalQuote(state,'unlock','decoy',{...station,activeBases:1}).ok,false);
 assert.equal(tacticalQuote(state,'unlock','trap',{...station,ore:47}).ok,false);
 assert.equal(tacticalQuote(state,'unlock','jam',{...station,activeBases:3}).ok,false);
 for(const id of ['decoy','trap','jam']){
  const result=applyTacticalChoice(state,'unlock',id,station);
  assert.equal(result.ok,true);state=result.state;
 }
 assert.equal(state.owned.length,4);
 const chosen=applyTacticalChoice(state,'equip','trap',station);
 assert.equal(chosen.state.equipped,'trap');assert.equal(chosen.ore,station.ore);
 assert.equal(state.equipped,'pulse','quote and equip do not modify the source');
 assert.equal(validTactical(chosen.state,20),true);
});
test('exclusive branches consume one point and unlock a different behavior',()=>{
 const state=createTactical();
 assert.equal(tacticalQuote(state,'upgrade','pulse',{...station,level:2,path:'shell'}).ok,false);
 const first=applyTacticalChoice(state,'upgrade','pulse',{...station,path:'shell'});
 assert.equal(first.ok,true);assert.equal(first.points,2);
 assert.equal(tacticalSpec(first.state).branch.path,'shell');
 assert.equal(tacticalQuote(first.state,'upgrade','pulse',{...station,path:'burst'}).ok,false);
 const next=applyTacticalChoice(first.state,'upgrade','pulse',{...station,path:'shell'});
 assert.equal(next.state.branches.pulse.rank,2);
 assert.equal(tacticalSpec(next.state).duration,3.6);
 assert.equal(validTactical(next.state,20),true);
});
test('protective shell follows the player and affects new arrivals',()=>{
 const g=game([enemy(700)]);g.tactical.branches.pulse={path:'shell',rank:1};
 assert.equal(activateTactical(g).affected,0);
 g.player.x=600;updateTactical(g);
 assert.equal(g.enemies[0]._tacticalSpeed,.68);
 assert.equal(g.tactical.effects[0].kind,'shell');
});
test('vector burst interrupts an actual ram, but does not erase the enemy',()=>{
 const ramming=enemy(80,0,{type:'berserker',state:'charge',chargeReadyAt:20});
 const g=game([ramming]);g.tactical.branches.pulse={path:'burst',rank:1};
 const out=activateTactical(g);updateTactical(g);
 assert.equal(out.affected,1);assert.equal(ramming.state,'hunt');
 assert.ok(ramming._tacticalRepel.until>g.time);
 assert.equal(ramming.hp,50);
});
test('vector burst creates real escape distance from a charging ship at 30 and 60 fps',()=>{
 const simulate=(burst,fps)=>{
  const charger=enemy(110,0,{serial:18,type:'berserker',state:'charge',
   think:10,fire:10,damage:8});
  const g=game([charger]);g.allies=[];g.missiles=[];g.shots=[];
  g.grid={query:()=>[]};g.enemyCanSee=()=>false;
  g.avoidance=()=>({x:0,y:0});g.hurt=()=>{};
  g.heritage={play(){},vfx:{shipExplosion(){}}};
  if(burst){g.tactical.branches.pulse={path:'burst',rank:1};activateTactical(g);}
  for(let i=0;i<Math.round(fps*.45);i++){
   g.time+=1/fps;updateTactical(g);updateEnemy(charger,g,1/fps);
  }
  return charger.x;
 };
 for(const fps of [30,60]){
  const normal=simulate(false,fps),burst=simulate(true,fps);
  assert.ok(burst>normal+25,
   'the discharge must open a meaningful gap before its brief effect expires');
 }
});
test('cursor-placed gravity trap controls a location, not the whole screen',()=>{
 const g=game([enemy(200),enemy(900)]),state=g.tactical;
 state.owned.push('trap');state.equipped='trap';
 const target=tacticalAim(g.player,{x:300,y:0});
 assert.deepEqual(target,{x:300,y:0});
 activateTactical(g,target);updateTactical(g);
 assert.equal(g.enemies[0]._tacticalSpeed,.53);
 assert.equal(g.enemies[1]._tacticalSpeed,1);
 assert.equal(state.effects[0].x,300);
});
test('trap branches meaningfully choose pulling over stronger viscosity',()=>{
 const g=game([enemy(200)]);g.tactical.owned.push('trap');g.tactical.equipped='trap';
 g.tactical.branches.trap={path:'sink',rank:1};
 activateTactical(g,{x:300,y:0});updateTactical(g);
 assert.equal(g.enemies[0]._tacticalPull.x,300);
 assert.equal(g.enemies[0]._tacticalSpeed,.73);
 const stronger={...g.tactical,branches:{trap:{path:'snare',rank:2}}};
 assert.ok(tacticalSpec(stronger).slow<.73);
});
test('one-slot branches offer different tactical tradeoffs instead of a universal upgrade',()=>{
 const spec=(id,path,rank)=>tacticalSpec({equipped:id,
  branches:path?{[id]:{path,rank}}:{}});
 const pulse=spec('pulse'),shell=spec('pulse','shell',2),burst=spec('pulse','burst',2);
 assert.ok(shell.duration>pulse.duration&&shell.slow>pulse.slow);
 assert.ok(burst.radius>pulse.radius&&burst.duration<pulse.duration);
 const lure=spec('decoy','lure',2),ghost=spec('decoy','ghost',2);
 assert.ok(lure.radius>ghost.radius&&ghost.duration>lure.duration);
 assert.ok(lure.decoyChance>ghost.decoyChance);
 const sink=spec('trap','sink',2),snare=spec('trap','snare',2);
 assert.ok(sink.slow>snare.slow&&sink.duration>snare.duration);
 const wide=spec('jam','wide',2),deep=spec('jam','deep',2);
 assert.ok(wide.radius>deep.radius&&wide.duration<deep.duration);
 for(const id of Object.keys({pulse:1,decoy:1,trap:1,jam:1})){
  assert.ok(spec(id).cooldown>spec(id).duration,'a tactical tool must have a real downtime');
 }
});
test('beacon outcomes are spread across the first wave and vary by activation',()=>{
 for(const cast of [1,2,3]){
  const chance=.66;
  const outcomes=Array.from({length:30},(_,i)=>decoyResponse(i+1,cast)<chance);
  assert.ok(outcomes.filter(Boolean).length>=18&&outcomes.filter(Boolean).length<=22,
   'the first thirty ships should not all follow the same decoy');
 }
 assert.ok(Array.from({length:30},(_,i)=>(decoyResponse(i+1,1)<.66)!==
  (decoyResponse(i+1,2)<.66)).filter(Boolean).length>=8,
  'separate activations must redistribute the fooled patrol rather than fixing it forever');
 const g=game([enemy(200,0,{serial:2})]);
 g.tactical.owned.push('decoy');g.tactical.equipped='decoy';
 activateTactical(g,{x:300,y:0});
 assert.equal(g.tactical.effects[0].confirmed,undefined);
 assert.equal(tacticalDecoy(g,g.enemies[0]),null,'a suspicious ship ignores the beacon');
 g.enemies[0].serial=1;
 assert.equal(tacticalDecoy(g,g.enemies[0])?.kind,'decoy');
 assert.equal(g.tactical.effects[0].confirmed,true,'actual diversion is marked');
});
test('decoy attracts a bounded subset, but not a witness or a protected escort',()=>{
 const g=game([enemy(200)]);g.tactical.owned.push('decoy');g.tactical.equipped='decoy';
 activateTactical(g,{x:300,y:0});
 assert.equal(tacticalDecoy(g,g.enemies[0])?.kind,'decoy');
 g.enemies[0]._enemyLearningSaw=true;
 assert.equal(tacticalDecoy(g,g.enemies[0]),null);
 g.enemies[0]._enemyLearningSaw=false;g.enemies[0].protect={hp:20};
 assert.equal(tacticalDecoy(g,g.enemies[0]),null);
});
test('a distracted fighter genuinely changes course; slowing reduces actual displacement',()=>{
 const simulate=(withDecoy=false,withSlow=false)=>{
  const target=enemy(400,0,{think:10,fire:10,damage:9,serial:18});
  const g=game([target]);g.player=pilot(0,0);
  g.allies=[];g.missiles=[];g.shots=[];g.grid={query:()=>[]};
  g.avoidance=()=>({x:0,y:0});g.enemyCanSee=()=>false;
  g.heritage={play(){},vfx:{shipExplosion(){}}};g.hurt=()=>{};
  if(withDecoy){g.tactical.owned.push('decoy');g.tactical.equipped='decoy';
   activateTactical(g,{x:350,y:280});}
  if(withSlow){target.tacticalSlowUntil=30;target.tacticalSlowFactor=.6;}
  for(let i=0;i<55;i++){g.time+=1/60;updateTactical(g);updateEnemy(target,g,1/60);}
  return target;
 };
 const normal=simulate(),distracted=simulate(true),slowed=simulate(false,true);
 assert.ok(distracted.y>normal.y+20,'decoy redirects real steering toward its location');
 const normalDistance=Math.hypot(normal.x-400,normal.y),
  slowedDistance=Math.hypot(slowed.x-400,slowed.y);
 assert.ok(slowedDistance<normalDistance*.75,'slow field reduces real movement through both axes');
});
test('a beacon really diverts a searching patrol despite stale squad orders, at 30 and 60 fps',()=>{
 const simulate=(withBeacon,fps)=>{
  const target=enemy(400,0,{serial:18,think:10,fire:10});
  const g=game([target]);g.allies=[];g.missiles=[];g.shots=[];
  g.grid={query:()=>[]};g.enemyCanSee=()=>false;
  g.avoidance=()=>({x:0,y:0});g.hurt=()=>{};
  g.heritage={play(){},vfx:{shipExplosion(){}}};
  g.enemyComms={directiveFor:()=>({mode:'close',
   intel:{x:-300,y:-200,vx:0,vy:0,at:g.time-.2,estimated:false},side:1}),
   strategicDirectiveFor:()=>null};
  if(withBeacon){g.tactical.owned.push('decoy');g.tactical.equipped='decoy';
   activateTactical(g,{x:350,y:280});}
  for(let i=0;i<fps;i++){
   g.time+=1/fps;updateTactical(g);updateEnemy(target,g,1/fps);
  }
  return {target,confirmed:g.tactical.effects[0]?.confirmed};
 };
 for(const fps of [30,60]){
  const ordered=simulate(false,fps),distracted=simulate(true,fps);
  assert.ok(distracted.target.y>ordered.target.y+35,
   'a decoy must override old radio/search steering at '+fps+' fps');
  assert.equal(distracted.target._commsIntent,null,
   'the HUD must not depict obedience to a superseded squad order');
  assert.equal(distracted.confirmed,true);
 }
});
test('jammer suppresses local transmission, not enemy movement or existing intent',()=>{
 const g=game([enemy(200)]);g.tactical.owned.push('jam');g.tactical.equipped='jam';
 activateTactical(g);
 assert.equal(g.tactical.effects[0].confirmed,undefined);
 assert.equal(tacticalRadioJammed(g,{x:300,y:0}),true);
 assert.equal(tacticalRadioJammed(g,{x:900,y:0}),false);
 updateTactical(g);assert.equal(g.enemies[0]._tacticalSpeed,1);
 assert.equal(g.tactical.effects[0].confirmed,undefined,
  'proximity to a ship is not proof that a message was blocked');
 g.time+=7;assert.equal(tacticalRadioJammed(g,{x:300,y:0}),false);
});
test('a field victim can report a witnessed threat; jammer blocks actual squad radio',()=>{
 const comms=new EnemyComms(),a=enemy(100),b=enemy(175),g=game([a,b]);
 assert.equal(comms.reportField(a,20),true);
 assert.equal(a._commsAttack.kind,'area');
 assert.equal(comms.reportField(a,20.4),false);
 assert.equal(comms.reportField(a,21.2),true,
  'repeated physical observations can corroborate the control threat');
 assert.equal(comms.send(a,b,'weapon',21.2),true);
 g.tactical.owned.push('jam');g.tactical.equipped='jam';activateTactical(g);
 comms._tacticalGame=g;
 assert.equal(comms.send(a,b,'weapon',21.5),false);
 assert.equal(g.tactical.effects[0].confirmed,true,
  'jam feedback is earned only by an attempted radio transmission');
 g.time=28;
 assert.equal(comms.send(a,b,'weapon',28),true,'radio recovers when the field ends');
});
test('trap slows an advancing station raider without cancelling its charged attack',()=>{
 const travel=slow=>{
  const raider=enemy(0,0,{stationRaid:{stationId:'s',x:900,y:0,
   expiresAt:99,chargeAt:null,nextPulse:0,interruptUntil:0}});
  const g=game([raider]);g.world={stations:new Map([['s',{active:true,enemy:false}]])};
  if(slow){g.tactical.owned.push('trap');g.tactical.equipped='trap';
   g.tactical.effects.push({kind:'trap',x:0,y:0,radius:178,until:26});}
  for(let i=0;i<30;i++){
   g.time+=1/60;updateTactical(g);
   assert.equal(updateStationInterdiction(g,raider,1/60),true);
  }
  return {distance:raider.x,charge:raider.stationRaid.chargeAt,
   confirmed:g.tactical.effects[0]?.confirmed};
 };
 const normal=travel(false),delayed=travel(true);
 assert.ok(delayed.distance<normal.distance*.7,
  'the station raider must actually arrive later inside a gravity field');
 assert.equal(delayed.charge,null,'the trap does not fabricate a charge interruption');
 assert.equal(delayed.confirmed,true);
});
test('mesh radio messages cannot cross an active local jammer',()=>{
 const simulate=withJam=>{
  const a={id:1,leader:enemy(0),members:[enemy(0)],brokenUntil:0,
   attackReports:[{kind:'long',at:.5},{kind:'long',at:1.7}]};
  const b={id:2,leader:enemy(380),members:[enemy(380)],brokenUntil:0,
   attackReports:[]};
  const g={...game([]),time:2,world:{stations:new Map()},
   player:pilot(0,0)};
  if(withJam){g.tactical.owned.push('jam');g.tactical.equipped='jam';
   activateTactical(g);}
  const mesh=new EnemyMesh();
  for(const t of [2,2.8,3.6,4.4]){g.time=t;mesh.update(g,[a,b],t);}
  return {mesh,b};
 };
 const baseline=simulate(false),jammed=simulate(true);
 assert.ok(baseline.mesh.deliveries>0,'the reference mesh really transfers observed intel');
 assert.equal(jammed.mesh.deliveries,0,'the same intel is blocked when jammed');
 assert.equal(jammed.mesh.bestForCell(jammed.b,4.4),null);
});
test('hangar teaches tactical effects without a second combat hotkey',()=>{
 const loadout=createLoadout(),session=new HangarSession();session.begin(loadout);
 const ui=renderShipHangar({loadout,hangarSession:session,tactical:createTactical(),hangarView:'tactics',
  ...station,skillRanks:{},ranks:{}},session);
 assert.match(ui,/Сейчас установлено:[\s\S]*Импульс[\s\S]*Пробел/);
 assert.match(ui,/Инерционный импульс/);
 assert.match(ui,/data-act="hgFocusTactic" data-id="decoy"/);
 assert.match(ui,/data-act="hgFocusTactic" data-id="jam"/);
 assert.match(ui,/hgTacticUpgrade/);
});
test('invalid tactical upgrades, fabricated equipment and impossible durations cannot be saved',()=>{
 const state=createTactical();assert.equal(validTactical(state,20),true);
 assert.equal(validTactical({...state,equipped:'jam'},20),false);
 assert.equal(validTactical({...state,branches:{pulse:{path:'other',rank:1}}},20),false);
 assert.equal(validTactical({...state,effects:[{kind:'jam',x:0,y:0,radius:200,until:900}]},20),false);
 assert.equal(validTactical({...state,effects:[{kind:'decoy',x:0,y:0,
  radius:590,until:25,decoyChance:Infinity}]},20),false);
});
