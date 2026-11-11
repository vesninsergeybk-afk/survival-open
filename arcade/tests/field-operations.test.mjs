import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {World} from '../world.js';
import {ENEMY_TYPES,updateEnemy} from '../ai.js';
import {renderBasePanel} from '../base-panel.js';
import {RuntimeHarness} from './runtime-game.mjs';
import {createCombatMastery,masteryGoal,masteryOperationReward} from '../combat-mastery.js';
import {packRun,unpackRun} from '../run-checkpoint.js';
import {createFieldOperation,fieldOperationIds,fieldOperationOffer,fieldOperationMining,
 advanceFieldOperation,validFieldOperation,fieldOperationCue,fieldOperationInteraction,fieldThreatTier,
 FIELD_TACTICS,fieldApproachDistance,convoyRaidPlan,drawFieldOperation} from '../field-operations.js';
import {twoFrontsWaveTargets,reverseHuntBand,reverseHuntInSector} from '../field-operations.js';

const world=new World(20261107);
const stations=world.nearbyStations(0,0,9000,false).filter(b=>!b.enemy);
const lab=stations.find(b=>b.type==='lab'),arsenal=stations.find(b=>b.type==='arsenal');
const dock=world.home,carrier=stations.find(b=>b.type==='carrier');
for(const base of [lab,arsenal,dock,carrier])base.active=true;

test('published module URLs expose the audited missions instead of cached station cards',()=>{
 const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(page,/src="\.\/game\.js\?v=[^"]*field-experience-1/);
 assert.match(page,/src="\.\/game\.js\?v=[^"]*mission-art-5/);
 assert.match(game,/from '\.\/base-panel\.js\?v=[^']*field-experience-1-portrait-1-menu-prof-1-mission-depth-1[^']*mission-integrity-2/);
 assert.match(game,/from '\.\/field-operations\.js\?v=[^']*field-experience-1-mission-art-5-mission-av-1-mission-pack-1-mission-depth-1-mission-integrity-2-mission-variety-1-mission-choices-1[^']*'/);
});

test('illustrated objective props are drawn from one compact transparent sprite atlas',()=>{
 const atlasFile=new URL('../assets/missions/field-props-v1.webp',import.meta.url);
 assert.ok(statSync(atlasFile).size<350_000,'the mission props cannot add a megabyte per sortie');
 const op=createFieldOperation('two-fronts',arsenal,world),game=fakeGame(op);
 game.images={fieldProps:{complete:true,naturalWidth:1278,naturalHeight:1230}};
 const drawn=[],noop=()=>{};
 const ctx={save:noop,restore:noop,translate:noop,rotate:noop,beginPath:noop,arc:noop,
  stroke:noop,fill:noop,fillText:noop,setLineDash:noop,fillRect:noop,
  drawImage:(...args)=>drawn.push(args)};
 drawFieldOperation(game,ctx,{x:op.x,y:op.y,w:4000,h:4000});
 assert.equal(drawn.length,2);
 assert.deepEqual(drawn.map(args=>args.slice(1,5)),[[95,0,410,600],[95,0,410,600]]);
});

const canvasRecorder=()=>{
 const calls=[];
 const ctx={};
 for(const m of ['save','restore','translate','rotate','beginPath','arc','stroke','fill',
  'fillText','setLineDash','fillRect','moveTo','lineTo','closePath','roundRect','strokeRect'])
  ctx[m]=(...args)=>calls.push([m,...args]);
 ctx.drawImage=(...args)=>calls.push(['drawImage',...args]);
 return {ctx,calls};
};

test('relay has three real poses and a damaged convoy leaves its own wreck',()=>{
 const relay=new URL('../assets/missions/relay-poses-v3.webp',import.meta.url);
 const ruined=new URL('../assets/missions/relay-ruined-v1.webp',import.meta.url);
 const repair=new URL('../assets/missions/repair-drone-v1.webp',import.meta.url);
 const freighter=new URL('../assets/missions/convoy-health-v2.webp',import.meta.url);
 const wreck=new URL('../assets/missions/convoy-wreck-v1.webp',import.meta.url);
 const debris=new URL('../assets/missions/convoy-debris-v1.webp',import.meta.url);
 const crate=new URL('../assets/missions/salvage-crate-v1.webp',import.meta.url);
 const gameSource=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.ok(statSync(relay).size<200_000);
 assert.ok(statSync(ruined).size<90_000);
 assert.ok(statSync(repair).size<80_000);
 assert.ok(statSync(freighter).size<130_000);
 assert.ok(statSync(wreck).size<70_000);
 assert.ok(statSync(debris).size<75_000,'four painted fragments should stay inexpensive on mobile');
 assert.ok(statSync(crate).size<35_000);
 assert.match(gameSource,/relayPoses:'\.\/assets\/missions\/relay-poses-v3\.webp'/);
 assert.match(gameSource,/relayRuined:'\.\/assets\/missions\/relay-ruined-v1\.webp'/);
 assert.match(gameSource,/convoyWreck:'\.\/assets\/missions\/convoy-wreck-v1\.webp'/);
 assert.match(gameSource,/convoyDebris:'\.\/assets\/missions\/convoy-debris-v1\.webp'/);
 assert.match(gameSource,/salvageCrate:'\.\/assets\/missions\/salvage-crate-v1\.webp'/);
 assert.match(gameSource,/repairDrone:'\.\/assets\/missions\/repair-drone-v1\.webp'/);
 assert.match(gameSource,/convoyHealth:'\.\/assets\/missions\/convoy-health-v2\.webp'/);
 const op=createFieldOperation('two-fronts',arsenal,world),game=fakeGame(op);
 const sprite={complete:true,naturalWidth:768,naturalHeight:256};
 game.images={relayPoses:sprite};
 const {ctx,calls}=canvasRecorder();
 const cam={x:op.x,y:op.y,w:5000,h:5000};
 drawFieldOperation(game,ctx,cam);
 assert.equal(calls.filter(c=>c[0]==='drawImage'&&c[1]===sprite).length,2);
 op.nodes[0].progress=1.4;
 op.nodes[1].stabilized=true;op.nodes[1].fieldShield=40;
 calls.length=0;drawFieldOperation(game,ctx,cam);
 assert.ok(calls.some(c=>c[0]==='drawImage'&&c[2]===256),
  'the halfway pose fills the mechanical transition');
 assert.ok(calls.some(c=>c[0]==='drawImage'&&c[2]===512),
  'powered nodes use the third sprite, not an enlarged glow');
 assert.ok(calls.some(c=>c[0]==='lineTo'),'the raised shield has a faceted silhouette');
 op.phase='failed';op.nodes.forEach(n=>n.hp=0);calls.length=0;
 drawFieldOperation(game,ctx,cam);
 assert.ok(calls.some(c=>c[0]==='drawImage'&&c[1]===sprite),
  'failed nodes persist in the world until the sortie is cleared');
 const ruinedSprite={complete:true,naturalWidth:256,naturalHeight:256};
 game.images.relayRuined=ruinedSprite;game.time=6;op.nodes[0].fieldHullHitAt=5.88;
 calls.length=0;drawFieldOperation(game,ctx,cam);
 assert.ok(calls.some(c=>c[0]==='drawImage'&&c[1]===ruinedSprite),
  'destroyed nodes crossfade to broken machinery');
 assert.ok(calls.some(c=>c[0]==='drawImage'&&c[1]===sprite),
  'the fatal transition keeps the old frame briefly');
 game.time=7;calls.length=0;drawFieldOperation(game,ctx,cam);
 assert.equal(calls.filter(c=>c[0]==='drawImage'&&c[1]===ruinedSprite).length,2,
  'both destroyed nodes retain their real ruined frames');
 assert.equal(calls.filter(c=>c[0]==='drawImage'&&c[1]===sprite).length,0,
  'the intact art does not bleed through ruined machinery');
});

test('convoy only runs the engine while moving and shows a physical repair drone',()=>{
 const op=createFieldOperation('broken-convoy',carrier,world,0,'safe'),game=fakeGame(op);
 op.phase='active';op.nextRaidAt=1000;op.hp=62;
 const sprite={complete:true,naturalWidth:240,naturalHeight:256};
 const hull={complete:true,naturalWidth:512,naturalHeight:157};
 game.images={repairDrone:sprite,convoyHealth:hull};
 const {ctx,calls}=canvasRecorder();
 const cam={x:op.x,y:op.y,w:5000,h:5000};
 advanceFieldOperation(game,.25);
 assert.equal(op.artMoving,true);
 drawFieldOperation(game,ctx,cam);
 const enginePaint=calls.filter(c=>c[0]==='fill'&&c.length===1).length;
 assert.equal(calls.filter(c=>c[0]==='drawImage'&&c[1]===hull).length,2,
  'at 62% hull integrity the clean and damaged ship frames blend');
 op.fieldRepair.progress=1;game.actionHeld={kind:'field-work',target:op.fieldRepair};
 calls.length=0;advanceFieldOperation(game,.25);
 assert.equal(op.artMoving,false);
 drawFieldOperation(game,ctx,cam);
 assert.ok(calls.some(c=>c[0]==='drawImage'&&c[1]===sprite),
  'the actual drone appears during held repair');
 assert.ok(enginePaint>=2,'the moving ship leaves two engine wakes');
 op.hp=90;calls.length=0;
 drawFieldOperation(game,ctx,cam);
 assert.equal(calls.filter(c=>c[0]==='drawImage'&&c[1]===hull).length,1,
  'after a successful repair the ship no longer shows painted holes');
 game.images.fieldProps={complete:true,naturalWidth:1278,naturalHeight:1230};
 game.fps=20;game.visuals={reducedMotion:true};op.artMoving=true;
 calls.length=0;drawFieldOperation(game,ctx,cam);
 assert.equal(calls.filter(c=>c[0]==='drawImage'&&c[1]===game.images.fieldProps).length,2,
  'low FPS preserves two textured engine jets while the convoy moves');
 game.player.x=op.x+400;game.player.y=op.y;
 calls.length=0;drawFieldOperation(game,ctx,cam);
 assert.ok(!calls.some(c=>c[0]==='drawImage'&&c[1]===sprite),
  'the repair drone leaves when the pilot is outside the action radius');
});

test('destroyed convoy stays as a wreck with recoverable cargo instead of disappearing',()=>{
 const op=createFieldOperation('broken-convoy',carrier,world),game=fakeGame(op);
 const cue=[];game.heritage.play=kind=>cue.push(kind);
 game.images={convoyWreck:{complete:true,naturalWidth:320,naturalHeight:160},
  convoyDebris:{complete:true,naturalWidth:512,naturalHeight:512},
  salvageCrate:{complete:true,naturalWidth:128,naturalHeight:128}};
 op.phase='active';op.hp=0;game.time=9;
 advanceFieldOperation(game,.1);
 assert.equal(op.phase,'salvage');assert.equal(op.fieldDestroyedAt,9);
 assert.deepEqual(cue,['largeExplosion'],'wreck entry has exactly one heavy recorded sound cue');
 assert.ok(Math.abs(Math.hypot(op.crate.x-op.x,op.crate.y-op.y)-120)<.01);
 const {ctx,calls}=canvasRecorder(),cam={x:op.x,y:op.y,w:4000,h:4000};
 drawFieldOperation(game,ctx,cam);
 assert.ok(calls.some(c=>c[0]==='drawImage'&&c[1]===game.images.convoyWreck));
 assert.equal(calls.filter(c=>c[0]==='drawImage'&&c[1]===game.images.convoyDebris).length,4,
  'fatal wreck ejects four matching painted hull fragments');
 assert.ok(calls.some(c=>c[0]==='drawImage'&&c[1]===game.images.salvageCrate),
  'the cargo is visibly detachable and no longer merely an objective ring');
 game.time=11.2;calls.length=0;drawFieldOperation(game,ctx,cam);
 assert.ok(!calls.some(c=>c[0]==='drawImage'&&c[1]===game.images.convoyDebris),
  'debris finishes its burst and does not persist as an infinite animated loop');
 op.crate.progress=1.6;calls.length=0;drawFieldOperation(game,ctx,cam);
 assert.match(fieldOperationCue(op,game),/ИЗВЛЕЧЕНИЕ 50%/);
 assert.ok(calls.some(c=>c[0]==='arc'&&Math.abs(c[3]-37)<.01),
  'halfway rescue fills half the progress circle around the visible crate');
 op.phase='return';op.crate.done=true;calls.length=0;
 drawFieldOperation(game,ctx,cam);
 assert.ok(calls.some(c=>c[0]==='drawImage'&&c[1]===game.images.convoyWreck),
  'salvaged wreck persists while the player returns to the base');
 assert.ok(!calls.some(c=>c[0]==='drawImage'&&c[1]===game.images.salvageCrate),
  'the recovered crate disappears after the action completes');
});

test('a slow device retains the wreck but skips short-lived debris animation',()=>{
 const op=createFieldOperation('broken-convoy',carrier,world),game=fakeGame(op);
 op.phase='salvage';op.hp=0;op.fieldDestroyedAt=8;game.time=8.3;
 game.fps=22;game.images={convoyWreck:{complete:true,naturalWidth:320,naturalHeight:160},
  convoyDebris:{complete:true,naturalWidth:512,naturalHeight:512}};
 const {ctx,calls}=canvasRecorder();
 drawFieldOperation(game,ctx,{x:op.x,y:op.y,w:3000,h:3000});
 assert.ok(calls.some(c=>c[0]==='drawImage'&&c[1]===game.images.convoyWreck));
 assert.ok(!calls.some(c=>c[0]==='drawImage'&&c[1]===game.images.convoyDebris));
});

test('checkpoint preserves convoy wreck, salvage crate, and last heading without corrupting old saves',()=>{
 const op=createFieldOperation('broken-convoy',carrier,world),game=fakeGame(op);
 op.phase='active';op.hp=0;game.time=27;advanceFieldOperation(game,.1);
 const saved=unpackRun(packRun({operation:op,station:{fieldMission:op},enemies:[]}));
 assert.ok(validFieldOperation(saved.operation));
 assert.equal(saved.operation.artHeading,op.artHeading);
 assert.equal(saved.operation.fieldDestroyedAt,27);
 assert.deepEqual(saved.operation.crate,op.crate);
 const legacy={...saved.operation};delete legacy.artHeading;delete legacy.fieldDestroyedAt;
 assert.ok(validFieldOperation(legacy),'older saves need no new art metadata');
 assert.ok(!validFieldOperation({...legacy,crate:{...legacy.crate,x:Infinity}}),
  'malformed salvage positions cannot be loaded');
});

test('convoy turns gradually and preserves its bearing when it reaches the station',()=>{
 const op=createFieldOperation('broken-convoy',carrier,world),game=fakeGame(op);
 op.phase='active';op.nextRaidAt=1000;
 op.routeIndex=1;op.x=op.route[1].x;op.y=op.route[1].y;
 game.player.x=op.x;game.player.y=op.y;
 const oldHeading=op.artHeading;
 advanceFieldOperation(game,.1);
 const diff=Math.atan2(Math.sin(op.artHeading-oldHeading),Math.cos(op.artHeading-oldHeading));
 assert.ok(Math.abs(diff)<=.18001,'the ship cannot instantly rotate at a waypoint');
 op.phase='return';op.artMoving=true;
 const {ctx,calls}=canvasRecorder();game.images={convoyHealth:{complete:true,naturalWidth:512,naturalHeight:157}};
 drawFieldOperation(game,ctx,{x:op.x,y:op.y,w:4000,h:4000});
 assert.ok(calls.some(c=>c[0]==='rotate'&&Math.abs(c[1]-op.artHeading)<.001));
 assert.equal(calls.filter(c=>c[0]==='drawImage'&&c[1]===game.images.convoyHealth).length,1);
});

function fakeGame(op){
 return {operation:op,player:{x:op.x,y:op.y},enemies:[],enemySerial:0,groupSerial:0,
  time:0,mining:{active:false},miningNoise:0,dead:false,world,
  heritage:{vfx:{nova(){}},play(){}},notice(){},hurt(){this.hits=(this.hits||0)+1;},
  prepareMissionStrike(enemy,target,spec){enemy.missionStrike={...spec};enemy.target=target;
   enemy.missionFlight={x:target.x+spec.range,y:target.y,speed:ENEMY_TYPES[enemy.type].speed};},
  updateMissionStrike(enemy,target){target.hp=Math.max(0,target.hp-1);}};
}

test('station role offers distinct finite scenarios and repeat cooldown',()=>{
 assert.deepEqual(fieldOperationIds('lab'),['deep-resonance','reverse-hunt','false-call']);
 assert.deepEqual(fieldOperationIds('arsenal'),['two-fronts','sleeping-reactor']);
 assert.deepEqual(fieldOperationIds('dock'),['line-break']);
 assert.deepEqual(fieldOperationIds('carrier'),['broken-convoy']);
 const offer=fieldOperationOffer(lab,null,50,'deep-resonance');
 assert.equal(offer.status,'available');
 assert.equal(fieldOperationOffer({...lab,fieldOperationCooldowns:{'deep-resonance':90}},null,50,'deep-resonance').remaining,40);
 const html=renderBasePanel(lab,{ore:80,hp:110,maxHp:110,shield:0,activeBases:2,connectedBases:2,
  connected:true,allies:0,droneRoles:[],droneDamage:0,charges:0,transfers:[],contract:null,
  network:{armor:0,armament:0,engine:0,strikePower:0},baseTab:'operations',world,time:50});
 assert.match(html,/Глубинный резонанс/);
 assert.match(html,/Обратная охота/);
 assert.match(html,/Чужой позывной/);
 assert.match(html,/data-act="acceptFieldOperation" data-role="deep-resonance"/);
 assert.equal(fieldThreatTier(1,0),0);
 assert.equal(fieldThreatTier(13,0),2);
 assert.equal(fieldThreatTier(1,9),3);
});

test('station mission guidance uses actual ship position, not the docking anchor',()=>{
 const op=createFieldOperation('deep-resonance',lab,world);
 const ship={x:lab.x+275,y:lab.y-170};
 const state={ore:80,hp:110,maxHp:110,shield:0,activeBases:2,connectedBases:2,
  connected:true,allies:0,droneRoles:[],droneDamage:0,charges:0,transfers:[],contract:null,
  network:{armor:0,armament:0,engine:0,strikePower:0},baseTab:'operations',world,time:50,
  operation:op,position:ship};
 const html=renderBasePanel(lab,state);
 const actualDistance=Math.round(fieldApproachDistance(op,ship));
 assert.match(html,new RegExp('ДО ЦЕЛИ '+actualDistance+' М'));
});

test('approaching the second node or beacon first starts the operation without a hidden first-site gate',()=>{
 const clearWorld={nearbyRocks:()=>[],nearbyStations:()=>[]};
 for(const [id,base,key] of [['line-break',dock,'nodes'],['false-call',lab,'beacons']]){
  const op=createFieldOperation(id,base,clearWorld),game=fakeGame(op);
  game.player.x=op[key][1].x;game.player.y=op[key][1].y;
  assert.ok(Math.hypot(op.x-game.player.x,op.y-game.player.y)>420,
   'the regression must begin outside the old invisible first-site trigger');
  assert.equal(fieldApproachDistance(op,game.player),0);
  advanceFieldOperation(game,.1);
  assert.equal(op.phase,'active',id+' should accept either marked starting point');
  assert.ok(fieldOperationInteraction(op,game.player),id+' should expose the nearby action');
 }
});

test('a real pilot can reach every convoy ambush before delivery on either route',()=>{
 for(const routeChoice of ['safe','fast']){
  const op=createFieldOperation('broken-convoy',carrier,world,0,routeChoice),game=fakeGame(op);
  game.updateMissionStrike=()=>{};
  const plan=convoyRaidPlan(op);
  const expected=routeChoice==='fast'?3:2;
  assert.equal(plan.marks.length,expected);
  for(let step=0;step<500&&op.phase!=='return';step++){
   game.time+=.1;game.player.x=op.x;game.player.y=op.y;
   advanceFieldOperation(game,.1);
  }
  assert.equal(op.phase,'return',routeChoice+' must finish');
  assert.equal(op.escortSerials.length,expected,
   routeChoice+' must receive every planned interceptor while the cargo is still moving');
 }
});

test('an undefended convoy suffers enough pressure to lose its full reward',()=>{
 const op=createFieldOperation('broken-convoy',carrier,world,0,'safe'),game=fakeGame(op);
 game.updateMissionStrike=(enemy,target)=>{
  // Isolate the escort's combat rules from world obstacles and steering:
  // each living raider remains in range and obeys its charged-shot cadence.
  if(game.time<(enemy.relayCooldownUntil||0))return;
  if(!enemy.relayChargeUntil){enemy.relayChargeUntil=game.time+enemy.missionStrike.charge;return;}
  if(game.time>=enemy.relayChargeUntil){
   target.hp=Math.max(0,target.hp-enemy.missionStrike.damage);
   enemy.relayChargeUntil=0;enemy.relayCooldownUntil=game.time+2.1;
  }
 };
 for(let step=0;step<500&&op.phase!=='return'&&op.phase!=='salvage';step++){
  game.time+=.1;game.player.x=op.x;game.player.y=op.y;
  advanceFieldOperation(game,.1);
 }
 assert.ok(op.phase==='salvage'||op.partial,
  'doing nothing while raiders shoot must not produce a fully rewarded delivery');
});

test('surviving scripted attackers turn into actual pursuers on the return trip',()=>{
 const op=createFieldOperation('broken-convoy',carrier,world),game=fakeGame(op);
 op.phase='active';op.nextRaidAt=0;
 advanceFieldOperation(game,.1);
 const raider=game.enemies.find(e=>e.missionFlight);
 assert.ok(raider);
 op.phase='return';game.time=8;advanceFieldOperation(game,.1);
 assert.equal(raider.missionFlight,undefined);
 assert.equal(raider.missionStrike,undefined);
 assert.equal(raider.target,game.player);
 assert.equal(raider.state,'hunt');
 assert.equal(op.returnThreatsReleased,true);
});

test('the second scanner warning uses the actual narrower safety band',()=>{
 const op=createFieldOperation('reverse-hunt',lab,world),game=fakeGame(op),notices=[];
 game.notice=message=>notices.push(message);
 game.time=1;advanceFieldOperation(game,.1);
 op.scans=1;op.scanAt=1.1;op.scanUntil=0;
 game.time=1.2;advanceFieldOperation(game,.1);
 assert.ok(notices.some(message=>message.includes('170–270 м')));
 assert.ok(!notices.at(-1).includes('130–310 м'));
});

test('resonance requires actual marked mineral extraction, enables partial return, no double credit',()=>{
 const op=createFieldOperation('deep-resonance',lab,world);
 assert.ok(op&&validFieldOperation(op));
 assert.equal(op.samples.length,2);
 assert.equal(fieldOperationMining(op,{id:'unrelated',rich:true},'extract'),false);
 assert.equal(fieldOperationMining(op,{id:op.samples[0].id},'auto'),false);
 op.phase='active';
 assert.equal(fieldOperationMining(op,{id:op.samples[0].id},'extract'),true);
 assert.equal(op.progress,1);
 assert.ok(op.resonance>=58,'fast extraction still alerts the patrol');
 assert.equal(fieldOperationMining(op,{id:op.samples[0].id},'extract'),false);
 const other=op.samples[1].id;
 assert.equal(fieldOperationMining(op,{id:other},'strike'),false,
  'the destructive beam yields ore but cannot preserve a lab sample');
 assert.equal(op.progress,1);
 assert.equal(fieldOperationMining(op,{id:other},'extract'),true);
 assert.equal(op.phase,'return');
 assert.equal(op.progress,2);
 assert.ok(validFieldOperation(op));
});

test('an explosive strike contaminates the selected laboratory sample without awarding mission progress',()=>{
 const op=createFieldOperation('deep-resonance',lab,world),game=fakeGame(op);
 op.phase='active';op.nextGeologyCheck=500;
 RuntimeHarness.prototype.handleFieldMining.call(game,{id:op.samples[0].id},'strike');
 assert.equal(op.progress,0);
 assert.equal(op.resonance,55);
 assert.equal(op.nextGeologyCheck,0);
});

test('resonance changes danger only after risky mining; pulse is telegraphed and avoidable',()=>{
 const op=createFieldOperation('deep-resonance',lab,world),game=fakeGame(op);
 advanceFieldOperation(game,.1);assert.equal(op.phase,'active');
 game.player.x=op.samples[0].x;game.player.y=op.samples[0].y;
 game.mining.active=true;game.mining.target={id:op.samples[0].id};
 for(let i=0;i<80;i++){game.time+=.1;advanceFieldOperation(game,.1);}
 assert.ok(op.resonance>=90||op.alerted,'active mining creates meaningful pressure');
 assert.ok(op.alerted,'a visible guard responds to pressure');
 if(op.pulseUntil){game.player.x+=600;game.time=op.pulseUntil;advanceFieldOperation(game,.1);}
 assert.equal(game.hits||0,0,'leaving the hazard circle avoids damage');
});

test('second noisy extraction calls a bounded interceptor, while quiet mining can avoid it',()=>{
 const op=createFieldOperation('deep-resonance',lab,world),game=fakeGame(op);
 op.phase='active';op.nextGeologyCheck=Infinity;op.progress=1;op.resonance=77;op.alerted=true;
 op.samples[0].done=true;
 game.mining={active:true,target:{id:op.samples[1].id}};
 advanceFieldOperation(game,.1);
 assert.equal(op.secondRaidSent,true);
 assert.equal(game.enemies.length,1);
 advanceFieldOperation(game,.1);
 assert.equal(game.enemies.length,1,'a noisy second deposit must not create infinite escorts');
 const saved=unpackRun(packRun({operation:op})).operation;
 assert.equal(saved.secondRaidSent,true);
 assert.ok(validFieldOperation(saved));
 const quiet=createFieldOperation('deep-resonance',lab,world,1),quietGame=fakeGame(quiet);
 quiet.phase='active';quiet.nextGeologyCheck=Infinity;quiet.progress=1;quiet.alerted=true;
 quiet.samples[0].done=true;quiet.resonance=30;
 quietGame.mining={active:true,target:{id:quiet.samples[1].id}};
 advanceFieldOperation(quietGame,.1);
 assert.equal(quiet.secondRaidSent,false);
 assert.equal(quietGame.enemies.length,0);
});

test('long-range extraction still raises resonance, and breaking a sample requires another deposit',()=>{
 const op=createFieldOperation('deep-resonance',lab,world),game=fakeGame(op);
 advanceFieldOperation(game,.1);
 const rock=op.samples[0];
 game.player.x=rock.x+400;game.player.y=rock.y;
 game.mining={active:true,target:{id:rock.id}};
 for(let i=0;i<20;i++){game.time+=.1;advanceFieldOperation(game,.1);}
 assert.ok(op.resonance>20,'a long-range beam must be just as loud as a short one');
 assert.equal(fieldOperationMining(op,{id:rock.id},'strike'),false);
 assert.equal(op.progress,0);
});

test('reverse hunt rewards surviving scan cycles and gives a partial outcome for an early kill',()=>{
 const op=createFieldOperation('reverse-hunt',lab,world),game=fakeGame(op);
 assert.ok(validFieldOperation(op));
 advanceFieldOperation(game,.1);
 assert.equal(op.phase,'active');
 const enemy=game.enemies.find(e=>e.serial===op.enemySerial);
 assert.ok(enemy&&enemy.hp>100);
 for(let i=0;i<2;i++){
  game.time=op.scanAt;advanceFieldOperation(game,.1);
  game.player.x=enemy.x+200;game.player.y=enemy.y;
  game.time=op.scanUntil;advanceFieldOperation(game,.1);
  assert.equal(op.scans,i+1);
 }
 assert.equal(op.phase,'return');assert.equal(op.partial,false);
 const other=createFieldOperation('reverse-hunt',lab,world,1),early=fakeGame(other);
 advanceFieldOperation(early,.1);
 early.enemies[0].hp=0;early.time=1;advanceFieldOperation(early,.1);
 assert.equal(other.phase,'return');assert.equal(other.partial,true);
 assert.match(fieldOperationCue(other,early),/ВЕРНИТЕСЬ/);
});

test('second IRIS observation needs a closer band and high tiers get one escort',()=>{
 const op=createFieldOperation('reverse-hunt',lab,world,0,'safe',13),game=fakeGame(op);
 advanceFieldOperation(game,.1);
 const iris=game.enemies.find(e=>e.serial===op.enemySerial);
 game.time=op.scanAt;advanceFieldOperation(game,.1);
 game.player.x=iris.x+200;game.player.y=iris.y;
 game.time=op.scanUntil;advanceFieldOperation(game,.1);
 assert.equal(op.scans,1);assert.equal(op.coverSent,true);
 assert.equal(game.enemies.length,2);
 game.time=op.scanAt;advanceFieldOperation(game,.1);
 game.player.x=iris.x+295;
 game.time=op.scanUntil;advanceFieldOperation(game,.1);
 assert.equal(op.scans,1,'the old outer edge is too far away on the second pass');
 game.time=op.scanAt;advanceFieldOperation(game,.1);
 game.player.x=iris.x+215;
 game.time=op.scanUntil;advanceFieldOperation(game,.1);
 assert.equal(op.scans,2);assert.equal(op.phase,'return');
 assert.equal(game.enemies.length,2,'high-tier cover spawns once');
});

test('repeat reverse-hunts telegraph a real directional capture sector',()=>{
 const op=createFieldOperation('reverse-hunt',lab,world,2),game=fakeGame(op),sounds=[];
 game.heritage.play=kind=>sounds.push(kind);
 assert.equal(op.scanStyle,2);
 assert.deepEqual(reverseHuntBand({...op,scans:1}),[190,275]);
 advanceFieldOperation(game,.1);
 const iris=game.enemies.find(e=>e.serial===op.enemySerial);
 op.scans=1;op.scanAt=2;op.scanUntil=0;game.time=2;
 game.player.x=iris.x+220;game.player.y=iris.y;
 advanceFieldOperation(game,.1);
 assert.ok(op.scanHeading>1,'the frozen capture sector points away from the starting pilot');
 const outside={x:iris.x-220,y:iris.y};
 assert.equal(reverseHuntInSector(op,iris,outside),false);
 game.player.x=outside.x;game.player.y=outside.y;
 game.time=op.scanUntil;advanceFieldOperation(game,.1);
 assert.equal(op.scans,1);
 assert.ok(sounds.includes('fieldScanMiss'));
 assert.equal(op.lastScanDirectional,true);
 const persisted=unpackRun(packRun({operation:op})).operation;
 assert.ok(validFieldOperation(persisted));
 assert.equal(persisted.scanHeading,op.scanHeading);
 game.images={missionImpacts:{complete:true,naturalWidth:1024,naturalHeight:1024}};
 const {ctx,calls}=canvasRecorder();
 drawFieldOperation(game,ctx,{x:iris.x,y:iris.y,w:4000,h:4000});
 assert.ok(calls.some(c=>c[0]==='arc'&&c[6]===true),
  'the already-fired sector must be visible without painting a false full-ring discharge');
 game.time=op.scanAt;game.player.x=iris.x+230;game.player.y=iris.y;
 advanceFieldOperation(game,.1);
 game.player.x=iris.x+Math.cos(op.scanHeading)*220;
 game.player.y=iris.y+Math.sin(op.scanHeading)*220;
 assert.equal(reverseHuntInSector(op,iris,game.player),true);
 game.time=op.scanUntil;advanceFieldOperation(game,.1);
 assert.equal(op.scans,2);assert.equal(op.phase,'return');
});

test('discharged scan flash remains at the firing position after the scout moves',()=>{
 const op=createFieldOperation('reverse-hunt',lab,world),game=fakeGame(op);
 advanceFieldOperation(game,.1);
 const enemy=game.enemies.find(e=>e.serial===op.enemySerial);
 game.time=op.scanAt;advanceFieldOperation(game,.1);
 game.player.x=enemy.x+200;game.player.y=enemy.y;
 game.time=op.scanUntil;advanceFieldOperation(game,.1);
 const point={x:enemy.x,y:enemy.y};
 assert.deepEqual({x:op.lastScanX,y:op.lastScanY},point);
 const resumed=unpackRun(packRun({operation:op})).operation;
 assert.deepEqual({x:resumed.lastScanX,y:resumed.lastScanY},point,
  'a saved scan keeps its world-space origin');
 enemy.x+=100;enemy.y-=50;
 game.time+=.1;advanceFieldOperation(game,.1);
 assert.notEqual(op.x,point.x,'the live target has flown away');
 game.images={missionImpacts:{complete:true,naturalWidth:1024,naturalHeight:1024}};
 const {ctx,calls}=canvasRecorder();ctx.globalAlpha=1;
 drawFieldOperation(game,ctx,{x:op.x-1000,y:op.y-1000,w:2000,h:2000});
 const paint=calls.find(c=>c[0]==='drawImage'&&c[1]===game.images.missionImpacts);
 assert.ok(paint,'the captured discharge is drawn');
 assert.equal(paint[6]+paint[8]/2,point.x);
 assert.equal(paint[7]+paint[9]/2,point.y);
});

test('ore discharge keeps its original deposit even when the sample advances',()=>{
 const op=createFieldOperation('deep-resonance',lab,world),game=fakeGame(op);
 op.phase='active';op.nextPulse=100;op.pulseUntil=4;
 game.time=4;advanceFieldOperation(game,.1);
 const point={x:op.samples[0].x,y:op.samples[0].y};
 assert.deepEqual({x:op.lastPulseX,y:op.lastPulseY},point);
 const resumed=unpackRun(packRun({operation:op})).operation;
 assert.deepEqual({x:resumed.lastPulseX,y:resumed.lastPulseY},point,
  'a saved ore pulse keeps its world-space origin');
 op.samples[0].done=true;
 game.time+=.1;
 game.images={missionImpacts:{complete:true,naturalWidth:1024,naturalHeight:1024}};
 const {ctx,calls}=canvasRecorder();ctx.globalAlpha=1;
 drawFieldOperation(game,ctx,{x:point.x-1000,y:point.y-1000,w:2000,h:2000});
 const paint=calls.find(c=>c[0]==='drawImage'&&c[1]===game.images.missionImpacts);
 assert.ok(paint,'the discharge is drawn after the objective switches');
 assert.equal(paint[6]+paint[8]/2,point.x);
 assert.equal(paint[7]+paint[9]/2,point.y);
});

test('two-front defense attacks separate assets and accepts one surviving node',()=>{
 const op=createFieldOperation('two-fronts',arsenal,world),game=fakeGame(op);
 game.player.x=op.nodes[0].x;game.player.y=op.nodes[0].y;
 assert.ok(validFieldOperation(op));
 assert.ok(Math.hypot(op.nodes[0].x-op.nodes[1].x,op.nodes[0].y-op.nodes[1].y)>180);
 advanceFieldOperation(game,.1);assert.equal(op.phase,'active');
 game.time=op.nextWaveAt;advanceFieldOperation(game,.1);
 assert.equal(op.wave,1);assert.equal(game.enemies.filter(e=>e.fieldOperation===op.id).length,2);
 assert.notEqual(game.enemies[0].target,game.enemies[1].target);
 for(const enemy of game.enemies)enemy.hp=0;
 game.time+=1;advanceFieldOperation(game,.1);
 assert.ok(op.nextWaveAt>game.time);
 op.nodes[0].hp=0;
 game.time=op.nextWaveAt;advanceFieldOperation(game,.1);
 assert.equal(op.wave,2);
 for(const enemy of game.enemies)enemy.hp=0;
 game.time+=1;advanceFieldOperation(game,.1);
 assert.equal(op.phase,'return');assert.equal(op.partial,true);
 assert.ok(validFieldOperation(op));
});

test('later defense sorties vary attack concentration and preview the threatened node',()=>{
 const first=createFieldOperation('two-fronts',arsenal,world,1),game=fakeGame(first);
 assert.deepEqual(twoFrontsWaveTargets(first,0),[0,0]);
 assert.deepEqual(twoFrontsWaveTargets(first,1),[1,0]);
 assert.match(fieldOperationCue({...first,phase:'active',nextWaveAt:8},game),/ДВА КОРАБЛЯ → УЗЕЛ 1/);
 game.player.x=first.nodes[0].x;game.player.y=first.nodes[0].y;
 advanceFieldOperation(game,.1);assert.equal(first.phase,'active');
 game.time=first.nextWaveAt;advanceFieldOperation(game,.1);
 assert.equal(game.enemies[0].target,first.nodes[0]);
 assert.equal(game.enemies[1].target,first.nodes[0]);
 const second=createFieldOperation('two-fronts',arsenal,world,2);
 assert.deepEqual(twoFrontsWaveTargets(second,0),[1,1]);
 assert.ok(validFieldOperation(unpackRun(packRun({operation:second})).operation));
});

test('intermission transfers only the surviving shield charge and spends ore once',()=>{
 const op=createFieldOperation('two-fronts',arsenal,world),game=fakeGame(op);
 op.phase='active';op.wave=1;op.nextWaveAt=12;op.intermissionActive=true;
 op.shieldChargeUsed=true;op.nodes[0].fieldShield=23;op.nodes[0].stabilized=true;
 game.time=4;game.player.ore=10;
 game.player.x=op.nodes[1].x;game.player.y=op.nodes[1].y;
 const action=fieldOperationInteraction(op,game.player);
 assert.equal(action?.label,'Перенести щит · 4 сплава');
 game.actionHeld={kind:'field-work',target:action.target};
 advanceFieldOperation(game,FIELD_TACTICS.shieldTransferHold+.1);
 assert.equal(op.shieldTransferUsed,true);
 assert.equal(op.nodes[0].fieldShield,0);
 assert.equal(op.nodes[1].fieldShield,23,'transfer must not regenerate armor');
 assert.equal(game.player.ore,6);
 assert.equal(game.actionHeld,null);
 assert.equal(fieldOperationInteraction(op,game.player),null);
 assert.ok(validFieldOperation(op));
 assert.equal(unpackRun(packRun({operation:op})).operation.nodes[1].fieldShield,23);
});

test('developed pilots face an additional, stronger defense wave',()=>{
 const op=createFieldOperation('two-fronts',arsenal,world,0,'safe',13),game=fakeGame(op);
 game.player.x=op.nodes[0].x;game.player.y=op.nodes[0].y;
 assert.equal(op.wavesTotal,3);assert.equal(op.threatTier,2);
 advanceFieldOperation(game,.1);
 for(let wave=1;wave<=3;wave++){
  game.time=op.nextWaveAt;advanceFieldOperation(game,.1);
  assert.equal(op.wave,wave);
  for(const enemy of game.enemies)enemy.hp=0;
  game.time+=1;advanceFieldOperation(game,.1);
  assert.equal(op.phase,wave===3?'return':'active');
 }
 assert.ok(validFieldOperation(op));
 const offer=fieldOperationOffer(arsenal,null,0,'two-fronts',13);
 assert.equal(offer.rewardOre,45);
 assert.equal(offer.rewardPartialOre,24);
});

test('one risky shield charge protects exactly one of two threatened nodes',()=>{
 const op=createFieldOperation('two-fronts',arsenal,world),game=fakeGame(op);
 op.phase='active';op.nextWaveAt=100;
 const node=op.nodes[0];game.player.x=node.x;game.player.y=node.y;
 const interaction=fieldOperationInteraction(op,game.player);
 assert.equal(interaction?.label,'Зарядить щит');
 game.actionHeld={kind:'field-work',target:interaction.target};game.time=3;
 advanceFieldOperation(game,FIELD_TACTICS.shieldHold+.1);
 assert.equal(op.shieldChargeUsed,true);
 assert.equal(node.fieldShield,FIELD_TACTICS.shieldStrength);
 assert.equal(op.nodes[1].fieldShield,0);
 game.player.x=op.nodes[1].x;game.player.y=op.nodes[1].y;
 assert.equal(fieldOperationInteraction(op,game.player),null,'the reserve cannot be spent twice');
 const enemy={x:node.x+110,y:node.y,relayChargeUntil:2,
  missionStrike:{range:200,charge:1,damage:17}};
 game.world={nearbyRocks:()=>[]};game.flash=()=>{};game.time=4;
 RuntimeHarness.prototype.updateMissionStrike.call(game,enemy,node);
 assert.equal(node.hp,100,'the reserved barrier absorbs damage before the structure');
 assert.equal(node.fieldShield,FIELD_TACTICS.shieldStrength-17);
 assert.equal(node.fieldShieldHitAt,4);
 assert.equal(node.fieldShieldHitAngle,0);
 assert.ok(validFieldOperation(op));
 const copy=unpackRun(packRun({operation:op,station:{fieldMission:op},enemies:[]}));
 assert.equal(copy.operation.nodes[0].fieldShield,FIELD_TACTICS.shieldStrength-17);
});

test('mission strike plays shield, metal, and fatal impact recordings for the actual target',()=>{
 const op=createFieldOperation('two-fronts',arsenal,world),game=fakeGame(op);
 const target=op.nodes[0],sounds=[],effects=[];
 game.heritage.play=kind=>sounds.push(kind);
 game.heritage.vfx.nova=(...args)=>effects.push(args);
 game.world={nearbyRocks:()=>[]};game.flash=()=>{};
 const strike=(time)=>{
  game.time=time;
  const enemy={x:target.x+110,y:target.y,relayChargeUntil:time-1,
   missionStrike:{range:200,charge:1,damage:17}};
  RuntimeHarness.prototype.updateMissionStrike.call(game,enemy,target);
 };
 target.fieldShield=40;strike(2);
 assert.equal(target.hp,100);assert.equal(sounds.at(-1),'shieldHit');
 target.fieldShield=17;strike(4);
 assert.equal(target.hp,100);assert.equal(sounds.at(-1),'shieldBreak');
 strike(6);
 assert.equal(target.hp,83);assert.equal(sounds.at(-1),'armorHit');
 target.hp=10;strike(8);
 assert.equal(target.hp,0);assert.equal(sounds.at(-1),'largeExplosion');
 assert.ok(effects.some(e=>e[3]==='red'),'fatal relay hit visibly breaks the machinery');
 assert.ok(!sounds.includes('damage'),'the player damage cue never fires on relay targets');
});

test('successful field actions trigger recorded cues and a short success flash',()=>{
 const op=createFieldOperation('line-break',dock,world),game=fakeGame(op);
 const sounds=[],effects=[];
 game.heritage.play=kind=>sounds.push(kind);
 game.heritage.vfx.nova=(...args)=>effects.push(args);
 advanceFieldOperation(game,.1);
 game.player.x=op.nodes[0].x;game.player.y=op.nodes[0].y;
 game.actionHeld={kind:'field-work',target:op.nodes[0]};game.time=5.2;
 advanceFieldOperation(game,5.2);
 assert.ok(sounds.includes('fieldWork'));
 assert.ok(sounds.includes('fieldRelayRepair'));
 assert.ok(effects.some(e=>e[3]==='cyan'));
 const beacon=createFieldOperation('false-call',lab,world),check=fakeGame(beacon);
 const beaconCues=[];check.heritage.play=kind=>beaconCues.push(kind);
 advanceFieldOperation(check,.1);
 const wrong=beacon.beacons.find((b,i)=>i!==beacon.correct);
 check.player.x=wrong.x;check.player.y=wrong.y;
 check.actionHeld={kind:'field-work',target:wrong};check.time=2;
 advanceFieldOperation(check,2);
 assert.ok(beaconCues.includes('fieldBeaconAlarm'));
 const right=beacon.beacons[beacon.correct];
 check.player.x=right.x;check.player.y=right.y;
 check.actionHeld={kind:'field-work',target:right};check.time=4;
 advanceFieldOperation(check,2);
 assert.ok(beaconCues.includes('fieldBeaconOk'));
});

test('claiming a field operation pays once, reduces repeats, and keeps station identity',()=>{
 const op=createFieldOperation('deep-resonance',lab,world),game=fakeGame(op);
 op.phase='return';op.progress=2;
 game.docked=lab;game.player={ore:0,data:0,level:1};
 game.cockpit={resourceGain(){}};game.heritage.station=()=>{};
 game.collect=function(item){this.player.data+=item.value;};
 game.rewardNotice=()=>{};game.waypoint={id:op.id};
 lab.fieldMission=op;lab.fieldOperationRuns={};
 game.fieldLoan=null;
 assert.equal(RuntimeHarness.prototype.finishFieldOperation.call(game),true);
 assert.equal(game.player.ore,26);assert.equal(game.player.data,25);
 assert.equal(lab.fieldOperationRuns[op.id],1);
 assert.equal(RuntimeHarness.prototype.finishFieldOperation.call(game),false);
 assert.equal(game.player.ore,26);
 assert.equal(fieldOperationOffer(lab,null,game.time,op.id).status,'cooldown');
});

test('a full field operation grants the displayed mastery bonus and preserves its rank notice',()=>{
 const base={...lab,fieldOperationRuns:{},fieldOperationFullRuns:{},fieldOperationCooldowns:{}};
 const op=createFieldOperation('deep-resonance',base,world),game=fakeGame(op),messages=[];
 op.phase='return';op.progress=2;
 game.time=55;game.docked=base;game.player={x:base.x,y:base.y,ore:0,data:0,level:1};
 game.combatMastery=createCombatMastery();
 game.combatMastery.tracks.operations={rank:3,progress:masteryGoal('operations',3)-1};
 game.announceMastery=RuntimeHarness.prototype.announceMastery;
 game.cockpit={resourceGain(){}};game.heritage.station=()=>{};
 game.collect=function(item){this.player.data+=item.value;};
 game.rewardNotice=message=>messages.push(message);game.fieldLoan=null;
 const expected=masteryOperationReward(game.combatMastery,25);
 assert.equal(RuntimeHarness.prototype.finishFieldOperation.call(game),true);
 assert.equal(game.player.data,expected);
 assert.match(messages[0],new RegExp('\\+'+expected+' опыта'));
 assert.match(messages[0],/МАСТЕРСТВО · Полевой опыт · ступень 4/);
});

test('developed pilot payout exactly matches the station reward preview',()=>{
 const base={...lab,fieldOperationRuns:{},fieldOperationCooldowns:{}};
 const op=createFieldOperation('deep-resonance',base,world,0,'safe',13),game=fakeGame(op);
 const offer=fieldOperationOffer(base,op,0,op.id,13);
 op.phase='return';op.progress=2;
 game.docked=base;game.player={ore:0,data:0,level:13};
 game.cockpit={resourceGain(){}};game.heritage.station=()=>{};
 game.collect=function(item){this.player.data+=item.value;};
 game.rewardNotice=()=>{};game.waypoint={id:op.id};game.fieldLoan=null;
 assert.equal(RuntimeHarness.prototype.finishFieldOperation.call(game),true);
 assert.equal(game.player.ore,offer.rewardOre);
 assert.equal(game.player.data,offer.rewardData);
});

test('a partial extraction counts as a result but does not make the next sortie harder',()=>{
 const base={...lab,fieldOperationRuns:{},fieldOperationFullRuns:{},fieldOperationCooldowns:{}};
 const op=createFieldOperation('deep-resonance',base,world),game=fakeGame(op);
 op.phase='return';op.startedAt=10;op.progress=1;op.partial=true;
 game.time=48;game.docked=base;game.player={ore:0,data:0,level:1};
 game.cockpit={resourceGain(){}};game.heritage.station=()=>{};
 game.collect=function(item){this.player.data+=item.value;};
 game.rewardNotice=()=>{};game.fieldLoan=null;
 assert.equal(RuntimeHarness.prototype.finishFieldOperation.call(game),true);
 assert.equal(base.fieldOperationRuns[op.id],1);
 assert.equal(base.fieldOperationFullRuns[op.id],0);
 assert.deepEqual(base.fieldOperationHistory.at(-1),{
  id:op.id,full:false,seconds:38,tier:0,convoyHp:null});
 const resumed=createFieldOperation('deep-resonance',base,world,1,'safe',1,
  base.fieldOperationFullRuns[op.id]);
 assert.equal(resumed.threatTier,0);
});

test('a previously XP-rewarded field guard counts once for a directly assisted kill contract',()=>{
 const game=new RuntimeHarness(),base={id:'0:0',type:'dock',x:0,y:0};
 game.time=100;game.world={stations:new Map([[base.id,base]])};
 game.contract={baseId:base.id,kind:'kill',goal:2,progress:0};
 game.notice=()=>{};
 const enemy={type:'fighter',expAwarded:true,lastPlayerHitAt:98};
 assert.equal(game.creditContractKill(enemy),true);
 assert.equal(game.contract.progress,1);
 assert.equal(game.creditContractKill(enemy),false);
 assert.equal(game.contract.progress,1);
 assert.equal(game.creditContractKill({type:'fighter',expAwarded:true}),true);
 assert.equal(game.contract.progress,1,'an unattended field kill must not count');
});

test('line repair needs sustained interaction, then changes to a guarded second node',()=>{
 const op=createFieldOperation('line-break',dock,world),game=fakeGame(op);
 advanceFieldOperation(game,.1);
 assert.equal(op.phase,'active');
 assert.ok(validFieldOperation(op));
 const first=op.nodes[0];
 game.player.x=first.x;game.player.y=first.y;
 assert.equal(fieldOperationInteraction(op,game.player)?.label,'Ремонт узла');
 game.actionHeld={kind:'field-work',target:first};game.time+=5.1;advanceFieldOperation(game,5.1);
 assert.equal(op.progress,1);assert.equal(op.nodes[0].done,true);
 assert.ok(game.enemies.length>=2,'second repair is contested');
 assert.ok(game.enemies.some(e=>e.missionStrike&&e.target===op.nodes[1]),
  'a raider is actually aimed at destructible equipment');
 const second=op.nodes[1];game.player.x=second.x;game.player.y=second.y;
 game.actionHeld={kind:'field-work',target:second};game.time+=6.1;advanceFieldOperation(game,6.1);
 assert.equal(op.phase,'active');assert.equal(op.progress,2);
 assert.equal(op.stage,'sync');assert.ok(op.link,'a third, defendable location must exist');
 assert.equal(fieldOperationInteraction(op,game.player),null,'synchronization is not done remotely');
 game.player.x=op.link.x;game.player.y=op.link.y;
 assert.equal(fieldOperationInteraction(op,game.player)?.label,'Синхронизировать узлы');
 game.time+=.1;advanceFieldOperation(game,.1);
 assert.ok(op.linkThreatSent,'the final sync brings its own interceptor when approached');
 game.enemies.forEach(e=>{if(e.target===op.link)e.hp=0;});
 game.actionHeld={kind:'field-work',target:op.link};game.time+=7;advanceFieldOperation(game,7);
 assert.equal(op.phase,'return');assert.equal(op.link.done,true);
 assert.ok(validFieldOperation(op));
});

test('an interrupted network sync preserves two repaired nodes but pays only partial',()=>{
 const op=createFieldOperation('line-break',dock,world),game=fakeGame(op);
 op.phase='active';op.stage='sync';op.progress=2;
 op.nodes.forEach(n=>{n.done=true;n.progress=n.goal;});
 op.link={x:op.x,y:op.y,goal:FIELD_TACTICS.relaySyncSeconds,progress:2,
  hp:0,done:false};
 advanceFieldOperation(game,.1);
 assert.equal(op.phase,'return');assert.equal(op.partial,true);
 assert.equal(op.progress,2);
 assert.ok(validFieldOperation(unpackRun(packRun({operation:op})).operation));
});

test('new concluding stages paint dedicated world objects rather than only HUD text',()=>{
 const hw={complete:true,naturalWidth:1024,naturalHeight:1024};
 const beacon={complete:true,naturalWidth:1278,naturalHeight:1230};
 const {ctx,calls}=canvasRecorder();ctx.globalAlpha=1;
 const op=createFieldOperation('line-break',dock,world),game=fakeGame(op);
 op.phase='active';op.stage='sync';op.link={x:op.x,y:op.y,progress:2,
  goal:FIELD_TACTICS.relaySyncSeconds,hp:80,done:false};
 game.images={missionHardware:hw};
 drawFieldOperation(game,ctx,{x:op.x,y:op.y,w:5000,h:5000});
 assert.ok(calls.some(call=>call[0]==='drawImage'&&call[1]===hw&&call[2]===0&&call[3]===512),
  'link stage reuses the actual antenna sprite');
 calls.length=0;
 const other=createFieldOperation('false-call',lab,world),check=fakeGame(other);
 other.signalStage='uplink';other.phase='active';other.uplink={x:other.x,y:other.y,
  progress:1,goal:FIELD_TACTICS.beaconUplinkSeconds,hp:80,done:false};
 check.images={fieldProps:beacon};
 drawFieldOperation(check,ctx,{x:other.x,y:other.y,w:5000,h:5000});
 assert.ok(calls.some(call=>call[0]==='drawImage'&&call[1]===beacon),
  'second stage uses the painted signal beacon');
});

test('the second communication node can actually be destroyed, forcing a partial return',()=>{
 const op=createFieldOperation('line-break',dock,world),game=fakeGame(op);
 advanceFieldOperation(game,.1);
 const first=op.nodes[0];game.player.x=first.x;game.player.y=first.y;
 game.actionHeld={kind:'field-work',target:first};game.time=5.1;advanceFieldOperation(game,5.1);
 const second=op.nodes[1];assert.ok(second.hp<=100&&second.hp>0);
 const assassin=game.enemies.find(e=>e.missionStrike&&e.target===second);
 assert.ok(assassin);
 game.updateMissionStrike(assassin,second);assert.ok(second.hp<100);
 second.hp=0;game.time+=1;advanceFieldOperation(game,.1);
 assert.equal(op.phase,'return');assert.equal(op.partial,true);
 assert.equal(fieldOperationInteraction(op,game.player),null);
});

test('repairing node two first does not redirect guards to an already finished node',()=>{
 const op=createFieldOperation('line-break',dock,world),game=fakeGame(op);
 advanceFieldOperation(game,.1);
 const second=op.nodes[1];game.player.x=second.x;game.player.y=second.y;
 game.actionHeld={kind:'field-work',target:second};game.time=6.2;
 advanceFieldOperation(game,6.2);
 assert.equal(second.done,true);assert.equal(op.progress,1);
 const first=op.nodes[0];
 assert.ok(game.enemies.some(e=>e.missionStrike&&e.target===first),
  'guards must attack whichever repair remains unfinished');
 game.updateMissionStrike=(_enemy,target)=>{target.hp=0;};
 game.time+=.1;advanceFieldOperation(game,.1);
 game.time+=.1;advanceFieldOperation(game,.1);
 assert.equal(op.phase,'return');assert.equal(op.partial,true,
  'losing the exposed node cannot award full mission payout');
});

test('false beacon gives an observable clue and punishes a rushed wrong choice',()=>{
 const op=createFieldOperation('false-call',lab,world),game=fakeGame(op);
 advanceFieldOperation(game,.1);
 const wrong=op.beacons.find((b,i)=>i!==op.correct);
 game.player.x=wrong.x;game.player.y=wrong.y;
 game.actionHeld={kind:'field-work',target:wrong};game.time=2;advanceFieldOperation(game,2);
 assert.equal(op.checks,1);assert.equal(op.phase,'active');
 assert.ok(game.enemies.some(e=>e.fieldOperation===op.id));
 const correct=op.beacons[op.correct];game.player.x=correct.x;game.player.y=correct.y;
 game.actionHeld={kind:'field-work',target:correct};game.time=4;advanceFieldOperation(game,2);
 assert.equal(op.phase,'active');assert.equal(op.decoding,true);
 assert.match(fieldOperationCue(op,game),/ПЕРЕХВАТ СИГНАЛА/);
 assert.equal(fieldOperationInteraction(op,game.player),null,
  'the beacon cannot be examined a second time while decoding');
 game.player.x=correct.x+400;game.time=5;const before=op.decodeProgress;
 advanceFieldOperation(game,1);
 assert.equal(op.decodeProgress,before,'signal capture must pause outside the actual area');
 game.player.x=correct.x;game.time=6;advanceFieldOperation(game,3);
 assert.equal(op.phase,'active');assert.equal(op.signalStage,'uplink');
 assert.equal(op.partial,true);
 assert.match(fieldOperationCue(op,game),/ОТВЕТНЫЙ УЗЕЛ/);
 assert.notDeepEqual([op.uplink.x,op.uplink.y],[correct.x,correct.y]);
 game.player.x=op.uplink.x;game.player.y=op.uplink.y;
 advanceFieldOperation(game,.1);
 assert.ok(op.uplinkThreatSent,'the uplink is defended after the player can reach it');
 game.enemies.forEach(e=>{if(e.target===op.uplink)e.hp=0;});
 game.actionHeld={kind:'field-work',target:op.uplink};game.time+=6;
 advanceFieldOperation(game,6);
 assert.equal(op.phase,'return');assert.equal(op.uplink.done,true);
 assert.ok(validFieldOperation(op));
});

test('correct beacon produces a short defendable signal capture and persists through checkpoint',()=>{
 const op=createFieldOperation('false-call',lab,world,2),game=fakeGame(op);
 advanceFieldOperation(game,.1);
 const right=op.beacons[op.correct];game.player.x=right.x;game.player.y=right.y;
 game.actionHeld={kind:'field-work',target:right};game.time=2;
 advanceFieldOperation(game,1.6);
 assert.equal(op.phase,'active');assert.equal(op.decoding,true);
 assert.ok(game.enemies.some(e=>e.fieldOperation==='false-call'));
 const saved=unpackRun(packRun({operation:op,enemies:game.enemies})).operation;
 assert.equal(saved.decoding,true);assert.ok(validFieldOperation(saved));
 game.enemies.forEach(e=>e.hp=0);
 game.time=4;advanceFieldOperation(game,.3);
 assert.equal(op.signalStage,'uplink','defeating the interceptor reveals another objective');
 assert.equal(op.phase,'active');
 assert.equal(fieldOperationInteraction(op,game.player),null,'uplink must be approached');
 game.player.x=op.uplink.x;game.player.y=op.uplink.y;
 game.time=5;advanceFieldOperation(game,.1);
 game.enemies.forEach(e=>e.hp=0);
 game.actionHeld={kind:'field-work',target:op.uplink};game.time=11;
 advanceFieldOperation(game,6);
 assert.equal(op.phase,'return');
 assert.equal(op.partial,false);
 const result=unpackRun(packRun({operation:op})).operation;
 assert.equal(result.uplink.done,true);assert.ok(validFieldOperation(result));
});

test('defending the wrong-beacon followup matters; destroying the uplink forces partial result',()=>{
 const op=createFieldOperation('false-call',lab,world),game=fakeGame(op);
 op.phase='active';op.signalStage='uplink';op.uplink={x:op.x+200,y:op.y,
  goal:FIELD_TACTICS.beaconUplinkSeconds,progress:3,hp:0,done:false};
 advanceFieldOperation(game,.1);
 assert.equal(op.phase,'return');assert.equal(op.partial,true);
 assert.ok(validFieldOperation(op));
});

test('reactor outer cassette is safe, inner cassette requires avoiding warned pulses',()=>{
 const op=createFieldOperation('sleeping-reactor',arsenal,world),game=fakeGame(op);
 advanceFieldOperation(game,.1);
 const outer=op.nodes[0];game.player.x=outer.x;game.player.y=outer.y;
 game.actionHeld={kind:'field-work',target:outer};game.time=3.4;advanceFieldOperation(game,3.4);
 assert.equal(op.progress,1);
 game.time=op.pulseAt;advanceFieldOperation(game,.1);
 assert.ok(op.pulseUntil>game.time,'pulse has advance warning');
 game.player.x=op.x+350;game.player.y=op.y;
 game.time=op.pulseUntil;advanceFieldOperation(game,.1);
 assert.equal(game.hits||0,0);
 const inner=op.nodes[1];game.player.x=inner.x;game.player.y=inner.y;
 game.actionHeld={kind:'field-work',target:inner};game.time+=5;advanceFieldOperation(game,5);
 assert.equal(op.phase,'return');assert.equal(op.progress,2);
});

test('taking the inner cassette first starts a telegraphed faster hazard cycle',()=>{
 const op=createFieldOperation('sleeping-reactor',arsenal,world),game=fakeGame(op);
 advanceFieldOperation(game,.1);
 const inner=op.nodes[1];game.player.x=inner.x;game.player.y=inner.y;
 game.actionHeld={kind:'field-work',target:inner};game.time=5;
 advanceFieldOperation(game,5);
 assert.equal(op.innerFirst,true);
 assert.ok(op.pulseAt<=game.time+.25);
 assert.match(fieldOperationCue(op,game),/УСКОРЕННЫЙ ЦИКЛ/);
 game.time=op.pulseAt;advanceFieldOperation(game,.1);
 assert.ok(op.pulseUntil>game.time,'the shortcut must still warn before damage');
 assert.ok(op.pulseAt-game.time<8.4,'the unsafe route has a faster pulse cycle');
 assert.ok(validFieldOperation(unpackRun(packRun({operation:op})).operation));
});

test('an optional coolant detour visibly lengthens the reactor hazard interval',()=>{
 const op=createFieldOperation('sleeping-reactor',arsenal,world),game=fakeGame(op);
 advanceFieldOperation(game,.1);
 const outer=op.nodes[0];game.player.x=outer.x;game.player.y=outer.y;
 game.actionHeld={kind:'field-work',target:outer};game.time=4;
 advanceFieldOperation(game,4);
 assert.equal(op.progress,1);assert.equal(op.cooled,false);
 assert.match(fieldOperationCue(op,game),/КЛАПАН ДОСТУПЕН/);
 const valve=op.coolant;game.player.x=valve.x;game.player.y=valve.y;
 assert.equal(fieldOperationInteraction(op,game.player)?.label,'Охладить реактор');
 game.actionHeld={kind:'field-work',target:valve};game.time=8.1;
 advanceFieldOperation(game,4.1);
 assert.equal(op.cooled,true);assert.equal(valve.done,true);
 assert.equal(fieldOperationInteraction(op,game.player),null,'coolant cannot be purchased twice');
 assert.ok(validFieldOperation(unpackRun(packRun({operation:op})).operation));
 game.time=op.pulseAt;
 advanceFieldOperation(game,.01);
 assert.ok(op.pulseAt-game.time>10,'the new pulse interval is longer than the normal 8.4 seconds');
});

test('convoy route choice changes path and risk; destroyed cargo can still be recovered',()=>{
 const safe=createFieldOperation('broken-convoy',carrier,world,0,'safe');
 const fast=createFieldOperation('broken-convoy',carrier,world,0,'fast');
 const routeLength=op=>Math.hypot(op.route[0].x-op.route[1].x,op.route[0].y-op.route[1].y)+
  Math.hypot(op.route[1].x-op.route[2].x,op.route[1].y-op.route[2].y);
 assert.ok(routeLength(safe)>routeLength(fast));
 assert.ok(validFieldOperation(safe)&&validFieldOperation(fast));
 const game=fakeGame(fast);advanceFieldOperation(game,.1);
 const initialX=fast.x,initialY=fast.y;
 game.time+=1;advanceFieldOperation(game,1);
 assert.ok(Math.hypot(fast.x-initialX,fast.y-initialY)>0);
 fast.hp=0;game.time+=1;advanceFieldOperation(game,.1);
 assert.equal(fast.phase,'salvage');
 const crate=fast.crate;game.player.x=crate.x;game.player.y=crate.y;
 game.actionHeld={kind:'field-work',target:crate};game.time+=3.3;advanceFieldOperation(game,3.3);
 assert.equal(fast.phase,'return');assert.equal(fast.partial,true);
 assert.ok(validFieldOperation(fast));
});

test('convoy field repair trades six ore and four seconds of exposure for one hull recovery',()=>{
 const op=createFieldOperation('broken-convoy',carrier,world,0,'safe'),game=fakeGame(op);
 op.phase='active';op.hp=53;op.nextRaidAt=1000;game.player.ore=10;
 game.player.x=op.x;game.player.y=op.y;
 const repair=fieldOperationInteraction(op,game.player);
 assert.match(repair?.label||'',/6 сплава/);
 game.actionHeld={kind:'field-work',target:repair.target};
 const old={x:op.x,y:op.y};game.time=2;
 game.economyExpenses={repairs:0};
 advanceFieldOperation(game,2);
 assert.deepEqual({x:op.x,y:op.y},old,'cargo stops while the player repairs it');
 assert.equal(op.hp,53);
 game.time=4.1;advanceFieldOperation(game,2.1);
 assert.equal(op.hp,53+FIELD_TACTICS.convoyRepairStrength);
 assert.equal(game.player.ore,4);
 assert.equal(game.economyExpenses.repairs,FIELD_TACTICS.convoyRepairCost);
 assert.equal(op.fieldRepair.used,true);
 assert.equal(fieldOperationInteraction(op,game.player),null);
 assert.ok(validFieldOperation(op));
});

test('failed sorties stay saveable and expose a truthful return-or-abandon instruction',()=>{
 const op=createFieldOperation('two-fronts',arsenal,world),game=fakeGame(op);
 op.phase='failed';op.nodes[0].hp=0;op.nodes[1].hp=0;
 assert.ok(validFieldOperation(op));
 assert.match(fieldOperationCue(op,game),/ВЫЛАЗКА СОРВАНА/);
 advanceFieldOperation(game,5);
 assert.equal(op.phase,'failed');
 assert.ok(validFieldOperation(unpackRun(packRun({operation:op,station:{fieldMission:op},enemies:[]})).operation));
});

test('a convoy raider follows the moving transport instead of aiming at an obsolete coordinate',()=>{
 const op=createFieldOperation('broken-convoy',carrier,world,0,'fast'),game=fakeGame(op);
 advanceFieldOperation(game,.1);
 game.time=op.nextRaidAt;advanceFieldOperation(game,.1);
 const raider=game.enemies[0];assert.ok(raider?.missionFlight);
 const start={...raider.missionFlight};
 for(let i=0;i<75;i++){
  game.player.x=op.x;game.player.y=op.y;game.time+=.1;
  advanceFieldOperation(game,.1);
 }
 assert.ok(Math.hypot(raider.missionFlight.x-start.x,raider.missionFlight.y-start.y)>150);
 assert.ok(Math.hypot(raider.missionFlight.x-op.x,raider.missionFlight.y-op.y)<300);
});

test('stationary cargo cannot exhaust later ambushes before reaching their route sections',()=>{
 const op=createFieldOperation('broken-convoy',carrier,world,0,'fast'),game=fakeGame(op);
 advanceFieldOperation(game,.1);
 game.player.x=op.x+800;game.player.y=op.y;
 const start={x:op.x,y:op.y};
 game.time=op.nextRaidAt;advanceFieldOperation(game,.1);
 assert.equal(op.escortSerials.length,1,'the opening patrol is still time-triggered');
 game.updateMissionStrike=()=>{};
 for(let i=0;i<10;i++){game.time+=10;advanceFieldOperation(game,10);}
 assert.equal(op.escortSerials.length,1,'waiting and defeating raiders cannot prepay every ambush');
 assert.deepEqual({x:op.x,y:op.y},start,'cargo waits when the pilot is away');
 for(let i=0;i<25&&op.phase==='active';i++){
  game.player.x=op.x;game.player.y=op.y;game.time+=1;advanceFieldOperation(game,1);
 }
 assert.ok(op.escortSerials.length>=2,'later attackers appear when the convoy advances');
});

test('real steering and charged strikes can damage an undefended moving convoy',()=>{
 const op=createFieldOperation('broken-convoy',carrier,world,0,'fast'),game=fakeGame(op);
 game.world={nearbyRocks:()=>[]};game.nearRocks=[];game.flash=()=>{};
 game.updateMissionStrike=RuntimeHarness.prototype.updateMissionStrike;
 for(let i=0;i<200&&['approach','active'].includes(op.phase);i++){
  game.player.x=op.x;game.player.y=op.y;game.time+=.1;
  advanceFieldOperation(game,.1);
  for(const enemy of game.enemies)updateEnemy(enemy,game,.1);
 }
 assert.ok(op.escortSerials.length>=1);
 assert.ok(op.hp<100,'actual enemies must eventually fire on the moving transport');
});

test('checkpoint graph preserves the exact mission and attacker target after docking',()=>{
 const op=createFieldOperation('two-fronts',arsenal,world),game=fakeGame(op);
 game.player.x=op.nodes[0].x;game.player.y=op.nodes[0].y;
 advanceFieldOperation(game,.1);game.time=op.nextWaveAt;advanceFieldOperation(game,.1);
 const snapshot={operation:op,station:{fieldMission:op},enemies:game.enemies};
 const restored=unpackRun(packRun(snapshot));
 assert.equal(restored.operation,restored.station.fieldMission);
 assert.equal(restored.enemies[0].target,restored.operation.nodes[0]);
 assert.equal(restored.enemies[1].target,restored.operation.nodes[1]);
 assert.ok(validFieldOperation(restored.operation));
});
