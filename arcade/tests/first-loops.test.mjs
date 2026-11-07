import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {game} from './weapons-scene.mjs';
import {createContours,autoConnectContours,contourFields} from '../territory-system.js';
import {registerContourTrials,completeContourTrial,trialQuota} from '../contour-trials.js';
import {updateContourTrials} from '../contour-trial-director.js';
import {territoryBenefits,updateTerritoryBenefits,territoryNextStep} from '../territory-benefits.js';
import {createFieldEvolution,offerLevelCrystals,refreshEvolutionOffers,FIELD_EVOLUTION_SKILLS,absorbParasiteImpact,enemyFieldReward} from '../field-evolution.js';
import {renderEvolutionMenu,installedEvolution} from '../evolution-menu.js';
import {renderBasePanel} from '../base-panel.js';
import {renderWorldMap} from '../map-panel.js';
import {DEFAULT_CONTROLS} from '../control-layout.js';
import {createProbeOperation} from '../operations.js';
import {updateEnemy} from '../ai.js';
import {canAutoTarget} from '../signal-perception.js';
import {drawContourTrialHUD} from '../contour-trial-vfx.js';
import {RULES} from '../balance.js';

function trial(tier=1){
 const node=(id,x,y)=>({id,x,y,active:true,enemy:false,suppressed:false,type:'dock'});
 const world={stations:new Map([['A',node('A',0,0)],['B',node('B',1400,0)],['C',node('C',700,1100)]]),contours:createContours()};
 autoConnectContours(world);
 const entry=registerContourTrials(world,[],contourFields(world),770000)[0];entry.tier=tier;
 const g=game();Object.assign(g,{world,contourTrial:null,operation:null,time:20,enemies:[],zones:[],shots:[]});
 Object.assign(g.player,{x:entry.x,y:entry.y,shield:0});
 g.camera=()=>({x:g.player.x-300,y:g.player.y-250,w:600,h:500});
 return {g,world,entry};
}
function start(g){updateContourTrials(g,.1);g.time+=6;updateContourTrials(g,.1);}

test('the first three territorial rewards have real effects only inside a stable powered field',()=>{
 const {g,world,entry}=trial();
 assert.equal(territoryBenefits(world,g.player).inside,false);
 completeContourTrial(world,entry.id);g.lastDamageAt=0;
 updateTerritoryBenefits(g,1);assert.equal(g.player.shield,3);
 for(let i=0;i<10;i++)updateTerritoryBenefits(g,1);
 assert.equal(g.player.shield,18);assert.equal(g.territorySupport.dashRate,1);
 world.contours.trials.completed=2;assert.equal(territoryBenefits(world,g.player).dashRate,1.3);
 world.contours.trials.completed=3;assert.equal(territoryBenefits(world,g.player).magnetBonus,60);
 const oldShield=g.player.shield;g.player.x=5000;updateTerritoryBenefits(g,1);
 assert.equal(g.territorySupport.inside,false);assert.equal(g.territorySupport.dashRate,1);
 assert.equal(g.territorySupport.magnetBonus,0);assert.equal(g.player.shield,oldShield);
 g.player.x=entry.x;world.stations.get('A').suppressed=true;
 assert.equal(territoryBenefits(world,g.player).inside,false);
});

test('territorial recharge pauses under damage and during a menu, and is independent of FPS',()=>{
 const {g,world,entry}=trial();completeContourTrial(world,entry.id);
 g.lastDamageAt=g.time-2;updateTerritoryBenefits(g,1);assert.equal(g.player.shield,0);
 g.lastDamageAt=0;g.paused=true;updateTerritoryBenefits(g,1);assert.equal(g.player.shield,0);
 g.paused=false;for(let i=0;i<25;i++)updateTerritoryBenefits(g,1/25);
 assert.ok(Math.abs(g.player.shield-3)<1e-8);
 g.player.shield=0;for(let i=0;i<60;i++)updateTerritoryBenefits(g,1/60);
 assert.ok(Math.abs(g.player.shield-3)<1e-8);
});

test('a completed defence pays alloy once and immediately demonstrates its shield',()=>{
 const {g,world,entry}=trial();const before=g.player.ore;
 start(g);g.shots=[{trialId:entry.id,alive:true},{alive:true}];
 for(const enemy of g.enemies)enemy.hp=0;
 updateContourTrials(g,.1);
 assert.equal(world.contours.trials.completed,1);assert.equal(g.player.ore,before+24);
 assert.equal(g.player.shield,18);assert.equal(g.shots.length,1);
 assert.equal(g.contourFeedback.unlocked,'Контурный щит');
 assert.equal(completeContourTrial(world,entry.id),false);
 updateContourTrials(g,.1);assert.equal(g.player.ore,before+24);
});

test('the timeout never silently reduces the displayed kill requirement',()=>{
 const {g,world}=trial();const before=g.player.ore;start(g);
 assert.equal(g.contourTrial.required,2);g.enemies[0].hp=0;
 g.time+=71;updateContourTrials(g,.1);
 assert.equal(g.contourTrial,null);assert.equal(world.contours.trials.completed,0);
 assert.equal(g.player.ore,before);assert.match(g.lastNotice,/неудачей/);
 for(const tier of [1,2,3])assert.equal(trialQuota(4,tier),4);
 assert.equal(trialQuota(4,4),3);
});

test('crowding postpones an attack within a bounded time without awarding a victory',()=>{
 const {g,world}=trial();updateContourTrials(g,.1);
 g.enemies=Array.from({length:RULES.maxEnemies},(_,serial)=>({serial:1000+serial,x:20000,y:20000,hp:10,stationRaid:'remote'}));
 g.time+=6;updateContourTrials(g,.1);assert.equal(g.contourTrial.waitingForSpace,true);
 g.time+=13;updateContourTrials(g,.1);
 assert.equal(g.contourTrial,null);assert.equal(world.contours.trials.completed,0);
 assert.match(g.lastNotice,/Нападение отложено/);
 assert.ok([...world.stations.values()].every(s=>s.active));
});

test('survivors visibly retreat, cease fire and disappear without an explosion or loot',()=>{
 const {g}=trial(4);start(g);assert.equal(g.enemies.length,4);
 for(const enemy of g.enemies.slice(0,3))enemy.hp=0;
 const survivor=g.enemies[3],x=survivor.x,y=survivor.y;
 updateContourTrials(g,.1);
 assert.equal(g.contourTrial.phase,'rest');assert.ok(survivor.hp>0);
 assert.equal(canAutoTarget(survivor),false);assert.equal(survivor.damage,0);
 updateEnemy(survivor,g,.1);assert.ok(Math.hypot(survivor.x-x,survivor.y-y)>0);
 g.time+=4;updateEnemy(survivor,g,.1);
 assert.equal(survivor.hp,0);assert.equal(survivor.visualDeath,true);assert.equal(survivor.expAwarded,true);
});

test('a friendly converted trial participant is not erased with retreating enemies',()=>{
 const {g}=trial(4);start(g);
 for(const enemy of g.enemies.slice(0,2))enemy.hp=0;
 const converted=g.enemies[2];converted.converted=true;
 updateContourTrials(g,.1);
 assert.equal(g.contourTrial.phase,'rest');assert.ok(g.enemies.includes(converted));
 assert.equal(converted.trialId,undefined);assert.equal(converted.trialRetreatUntil,undefined);
});

test('old floating offers are replaced with deliberate choices, without spending points',()=>{
 const g=game();g.player.level=2;g.player.points=1;g.fieldEvolution=createFieldEvolution();
 g.fieldEvolution.crystals=[{id:'parasite',x:0,y:0,born:0}];
 offerLevelCrystals(g,1,FIELD_EVOLUTION_SKILLS);
 assert.equal(g.player.points,1);assert.equal(g.fieldEvolution.crystals.length,0);
 assert.deepEqual(g.fieldEvolution.offers,['parasite','conduit','wreck']);
 assert.equal(g.chooseEvolution('parasite'),false,'a caller cannot purchase outside the choice menu');
 assert.equal(g.player.points,1);
});

test('two successive choices add permanent abilities; using a charge does not unlearn either',()=>{
 const previous=globalThis.document;
 globalThis.document={getElementById:()=>null};
 try{
  const g=game();g.player.level=2;g.player.points=1;g.fieldEvolution=createFieldEvolution();
  g.endInteraction=()=>{};g.presentMenu=()=>{};g.stationExitArmed=false;
  offerLevelCrystals(g,1,FIELD_EVOLUTION_SKILLS);g.openEvolution();
  assert.equal(g.paused,true);assert.equal(g.chooseEvolution('parasite'),true);
  assert.equal(g.skillRanks.parasite,1);assert.equal(g.fieldEvolution.charge,1);
  assert.equal(g.player.points,0);
  g.player.level=3;g.player.points=1;g.fieldEvolution.pending=1;
  refreshEvolutionOffers(g,FIELD_EVOLUTION_SKILLS);g.openEvolution();
  assert.ok(g.fieldEvolution.offers.includes('wreck'));assert.equal(g.chooseEvolution('wreck'),true);
  assert.equal(g.skillRanks.parasite,1);assert.equal(g.skillRanks.wreck,1);
  assert.equal(installedEvolution(g.skillRanks).length,2);
  assert.equal(absorbParasiteImpact(g,30),5);
  assert.equal(g.fieldEvolution.charge,0);assert.equal(installedEvolution(g.skillRanks).length,2);
  const html=renderEvolutionMenu(g,FIELD_EVOLUTION_SKILLS);
  assert.match(html,/Уже действуют · 2/);assert.match(html,/Энергоядра · 0\/2/);
  assert.match(html,/Ранее изученные навыки продолжают действовать/);
 }finally{globalThis.document=previous;}
});

test('the pending territorial goal is directly navigable on station and both map layers',()=>{
 const g=game(),w=g.world;
 const home=w.home;
 for(const [id,x,y] of [['loop-B',home.x+1400,home.y],['loop-C',home.x+700,home.y+1100]])
  w.stations.set(id,{id,x,y,type:'dock',active:true,enemy:false,discovered:true});
 w.contours=createContours();autoConnectContours(w);
 const entry=registerContourTrials(w,[],contourFields(w),770000)[0];
 assert.ok(entry);
 g.baseTab='summary';
 assert.equal(territoryNextStep(w,g.player).pending.id,1);
 const homeHtml=renderBasePanel(g.docked,g.baseState());assert.match(homeHtml,/data-act="trialRoute" data-id="1"/);
 g.mapView='map';const local=renderWorldMap(g);assert.match(local,/data-act="trialWaypoint" data-id="1"/);
 assert.match(local,/contour-pending-trial/);
 g.mapView='territory';g.contourRegion='all';const atlas=renderWorldMap(g);
 assert.match(atlas,/data-act="trialWaypoint" data-id="1"/);
});

test('the completed contract button focuses its station even with a different active operation',()=>{
 const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const marker="this.overlay.addEventListener('click',e=>{";
 const start=source.indexOf(marker)+marker.length,end=source.indexOf("\n  });\n  this.overlay.addEventListener('wheel'",start);
 assert.ok(start>marker.length&&end>start);
 const handler=new Function('e',source.slice(start,end));
 const g=game();g.baseTab='summary';
 const target={id:'elsewhere',type:'lab',x:12000,y:0,active:true,discovered:true};g.world.stations.set(target.id,target);
 g.contract={baseId:target.id,name:'Геология',kind:'rich',progress:1,goal:1,ore:10,data:24};
 g.operation={id:'silent-corridor',name:'Глухой коридор',baseId:g.docked.id,x:1500,y:-500,hp:150,maxHp:150};
 const html=renderBasePanel(g.docked,g.baseState());assert.match(html,/data-act="baseMap" data-target="contract">Показать станцию на карте/);
 g.openMap=focus=>g.capturedFocus=focus;
 handler.call(g,{target:{closest:s=>s==='[data-act]'?{dataset:{act:'baseMap',target:'contract'}}:null}});
 assert.equal(g.capturedFocus,target);
});

test('all visible station and map repair instructions follow the assigned interaction key',()=>{
 const g=game();const lab={id:'test-lab',type:'lab',x:1200,y:0,active:true,discovered:true};
 g.world.stations.set(lab.id,lab);g.docked=lab;g.baseTab='operations';
 g.controls={...DEFAULT_CONTROLS,interact:'KeyG'};g.operation=createProbeOperation(lab,g.world);
 g.operation.located=true;
 const html=renderBasePanel(lab,g.baseState());
 assert.match(html,/Удерживайте G/);assert.doesNotMatch(html,/удерживайте E|Удерживайте E|Отпустите E/);
 g.mapView='map';const map=renderWorldMap(g);assert.match(map,/удерживайте G/);assert.doesNotMatch(map,/удерживайте E/);
});

test('a generic contour notification is never drawn as a defence victory',()=>{
 const drawn=[];const ctx=new Proxy({},{get:(o,k)=>o[k]??((...a)=>drawn.push([k,...a])),set:(o,k,v)=>(o[k]=v,true)});
 drawContourTrialHUD(ctx,{time:10,contourFeedback:{at:10,title:'Ложный маяк установлен'},vw:1200});
 assert.equal(drawn.length,0);
});

test('a lost power connection never sends a beginner into a battle that cannot start',()=>{
 const {g,world}=trial();world.stations.get('A').suppressed=true;
 const step=territoryNextStep(world,g.player);
 assert.equal(step.pending,null);assert.equal(step.blocked,true);
 assert.match(step.description,/оборона не начнётся/);
});

test('retreating trial enemies do not yield parasite charges as if personally killed',()=>{
 const {g}=trial(4);g.fieldEvolution=createFieldEvolution();g.skillRanks.parasite=1;
 g.fieldEvolution.kills=2;
 const retreating={serial:91,type:'scout',hp:0,maxHp:28,trialId:1,trialRetreatUntil:g.time-1,lastPlayerHitAt:g.time-2};
 const result=enemyFieldReward(g,retreating,true);
 assert.equal(result.core,false);assert.equal(g.fieldEvolution.kills,2);
});
