import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {World} from '../world.js';
import {ENEMY_TYPES,updateEnemy} from '../ai.js';
import {renderBasePanel} from '../base-panel.js';
import {RuntimeHarness} from './runtime-game.mjs';
import {packRun,unpackRun} from '../run-checkpoint.js';
import {createFieldOperation,fieldOperationIds,fieldOperationOffer,fieldOperationMining,
 advanceFieldOperation,validFieldOperation,fieldOperationCue,fieldOperationInteraction,fieldThreatTier,
 FIELD_TACTICS,drawFieldOperation} from '../field-operations.js';

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
 assert.match(game,/from '\.\/base-panel\.js\?v=[^']*field-experience-1-portrait-1-menu-prof-1'/);
 assert.match(game,/from '\.\/field-operations\.js\?v=[^']*field-experience-1-mission-art-5'/);
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
 const crate=new URL('../assets/missions/salvage-crate-v1.webp',import.meta.url);
 const gameSource=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.ok(statSync(relay).size<200_000);
 assert.ok(statSync(ruined).size<90_000);
 assert.ok(statSync(repair).size<80_000);
 assert.ok(statSync(freighter).size<130_000);
 assert.ok(statSync(wreck).size<70_000);
 assert.ok(statSync(crate).size<35_000);
 assert.match(gameSource,/relayPoses:'\.\/assets\/missions\/relay-poses-v3\.webp'/);
 assert.match(gameSource,/relayRuined:'\.\/assets\/missions\/relay-ruined-v1\.webp'/);
 assert.match(gameSource,/convoyWreck:'\.\/assets\/missions\/convoy-wreck-v1\.webp'/);
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
  salvageCrate:{complete:true,naturalWidth:128,naturalHeight:128}};
 op.phase='active';op.hp=0;game.time=9;
 advanceFieldOperation(game,.1);
 assert.equal(op.phase,'salvage');assert.equal(op.fieldDestroyedAt,9);
 assert.deepEqual(cue,['explosion'],'wreck entry has exactly one real sound cue');
 assert.ok(Math.abs(Math.hypot(op.crate.x-op.x,op.crate.y-op.y)-120)<.01);
 const {ctx,calls}=canvasRecorder(),cam={x:op.x,y:op.y,w:4000,h:4000};
 drawFieldOperation(game,ctx,cam);
 assert.ok(calls.some(c=>c[0]==='drawImage'&&c[1]===game.images.convoyWreck));
 assert.ok(calls.some(c=>c[0]==='drawImage'&&c[1]===game.images.salvageCrate),
  'the cargo is visibly detachable and no longer merely an objective ring');
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
 const actualDistance=Math.round(Math.hypot(op.x-ship.x,op.y-ship.y));
 assert.match(html,new RegExp('ДО ЦЕЛИ '+actualDistance+' М'));
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

test('two-front defense attacks separate assets and accepts one surviving node',()=>{
 const op=createFieldOperation('two-fronts',arsenal,world),game=fakeGame(op);
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

test('developed pilots face an additional, stronger defense wave',()=>{
 const op=createFieldOperation('two-fronts',arsenal,world,0,'safe',13),game=fakeGame(op);
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
 assert.equal(op.phase,'return');assert.equal(op.progress,2);
 assert.ok(validFieldOperation(op));
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
 advanceFieldOperation(game,.1);game.time=op.nextWaveAt;advanceFieldOperation(game,.1);
 const snapshot={operation:op,station:{fieldMission:op},enemies:game.enemies};
 const restored=unpackRun(packRun(snapshot));
 assert.equal(restored.operation,restored.station.fieldMission);
 assert.equal(restored.enemies[0].target,restored.operation.nodes[0]);
 assert.equal(restored.enemies[1].target,restored.operation.nodes[1]);
 assert.ok(validFieldOperation(restored.operation));
});
