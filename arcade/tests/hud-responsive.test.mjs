import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CockpitDisplay,hullCondition,radarPoint,experienceDifference} from '../hud.js';

const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../hud.css',import.meta.url),'utf8');
const ids=[...source.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);

test('HUD contract: unique live element IDs, cache versions and mobile layout',()=>{
 assert.equal(new Set(ids).size,ids.length,'duplicate element IDs');
 for(const id of ['hud','cockpitFrame','radar','hp','hpbar','hpmeter','shield','xpbar',
   'xpmeter','level','burst','burstbar','bursttext','burstBtn','ore','oreResource',
   'data','bases','flux','hack','interactionCue','contractObjective','message',
   'miningStatus','stateText','flightDistance','flightMode','wingStatus',
   'hudThermal','hudThermalLabel','hudThermalText','hudThermalMeter']){
  assert.ok(ids.includes(id),id+' is missing from the page');
 }
 assert.match(source,/hud\.css\?v=hud-responsive-v16/);
 assert.match(source,/game\.js\?v=[a-z0-9-]+/);
 assert.match(source,/game\.js\?v=[^"\n]*radar-lethal-1/,
  'published entry must invalidate the old game module');
 assert.match(readFileSync(new URL('../game.js',import.meta.url),'utf8'),
  /hud\.js\?v=[^'\n]*radar-clarity-1/,
  'the game must load the clarified radar readout');
 assert.match(css,/@media\(pointer:coarse\) and \(orientation:portrait\)/);
 assert.match(css,/@media\(pointer:coarse\) and \(orientation:landscape\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.cockpit-hud \[hidden\]\{display:none!important\}/);
});

test('HUD status boundaries and local radar contacts',()=>{
 assert.equal(hullCondition(30,100),'critical');
 assert.equal(hullCondition(31,100),'wounded');
 assert.equal(hullCondition(65,100),'wounded');
 assert.equal(hullCondition(66,100),'normal');
 assert.equal(radarPoint(1101,0,{x:0,y:0}),null);
 assert.deepEqual(radarPoint(0,0,{x:0,y:0}),{x:72,y:72,distance:0});
});

test('experience gained across one or several level-ups is never lost in a rollover',()=>{
 assert.equal(experienceDifference({xp:20,level:1},{xp:29,level:1}),9);
 assert.equal(experienceDifference({xp:37,level:1},{xp:5,level:2}),10);
 assert.equal(experienceDifference({xp:37,level:1},{xp:8,level:3}),
  5+68+8);
 assert.equal(experienceDifference({xp:5,level:3},{xp:0,level:1}),null,
  'restarting a run must not be reported as newly earned XP');
});

test('HUD reads game state and changes contextual prompts without changing simulation',()=>{
 const originalDocument=globalThis.document,originalWindow=globalThis.window;
 const elements=new Map();
 const ctx={
  clearRect(){},save(){},translate(){},stroke(){},beginPath(){},arc(){},moveTo(){},
  lineTo(){},restore(){},rotate(){},fill(){},fillRect(){},closePath(){},setLineDash(){}
 };
 function node(id){
  if(!elements.has(id)){
   const classes=new Set();
   elements.set(id,{
    textContent:'',style:{width:'',setProperty(){}},hidden:false,disabled:false,
    classList:{
     add(...names){for(const name of names)classes.add(name)},
     remove(...names){for(const name of names)classes.delete(name)},
     toggle(name,force){if(force===undefined)force=!classes.has(name);
      if(force)classes.add(name);else classes.delete(name);return force},
     contains(name){return classes.has(name)}
    },
    setAttribute(name,value){this[name]=value},
    getContext(){return ctx},get offsetWidth(){return 20}
   });
  }
  return elements.get(id);
 }
 globalThis.document={getElementById:node};
 globalThis.window={matchMedia:()=>({matches:true})};
 try{
  const hud=new CockpitDisplay();
  hud.lastRadar=Infinity; // The test targets DOM state; radar geometry has a separate test.
  const game={
   player:{hp:28,maxHp:100,xp:20,level:2,points:1,shield:0,ore:12,data:4,
    burstCooldown:0,burstRemaining:0,vx:0,vy:0,x:0,y:0,angle:0},
   activeBases:1,allies:[],hacks:[],fps:60,enemies:[],support:null,
   operation:null,contract:null,mining:{active:false},miningNoise:0,
   probeRepairing:false,time:2,messageUntil:0,holdFire:false,paused:false,
   dead:false,overlay:{hidden:true},
   interactionFocus:{kind:'station'},
   nearbyEnemyBase:()=>null,world:{nearbyStations:()=>[],contours:{flux:9.25}},zones:[]
  };
  hud.update(game,100,5);
  assert.equal(node('hp').textContent,'28 / 100');
  assert.equal(node('data').textContent,'4');
  assert.equal(node('ore').textContent,'12');
  assert.equal(node('flux').textContent,'9,3','the flight HUD shows spendable flux');
  assert.equal(node('xpValue').textContent,'20 / 100');
  assert.equal(node('xpmeter')['aria-valuenow'],'20');
  assert.equal(node('xpmeter')['aria-valuemax'],'100');
  assert.equal(node('rewardFeed').hidden,true,'initial totals are not loot');
  assert.equal(node('interactionCue').textContent,'E · Открыть станцию');
  assert.equal(node('interactionCue').hidden,false);
  assert.equal(node('hpmeter')['aria-valuenow'],'28');
  assert.equal(node('hud').classList.contains('is-critical'),true);
  assert.equal(node('burstBtn').disabled,false);
  assert.equal(node('flightMode').textContent,'АВТООГОНЬ',
   'touch HUD uses a short, complete weapon state');
  assert.equal(node('flightMode')['aria-label'],'АВТООГОНЬ · АКТИВЕН',
   'the original detailed state remains accessible');
  // The active dock is next to the pilot. Navigation deliberately targets an
  // inactive station; its distance must not be labelled ambiguously.
  game.world.nearbyStations=()=>[
   {x:5,y:0,enemy:false,active:true},
   {x:925,y:0,enemy:false,active:false}
  ];
  hud.drawRadar(game);
  assert.equal(node('radarDistance').textContent,'НЕАКТ. СТАНЦИЯ · 925 М');
  assert.equal(node('radarDistance').title,
   'До ближайшей неактивной станции в радиусе радара');
  game.world.nearbyStations=()=>[{x:5,y:0,enemy:false,active:true}];
  hud.drawRadar(game);
  assert.equal(node('radarDistance').textContent,'БЛИЖНИЙ СЕКТОР');
  // HUD compares actual inventory states, including rewards and purchases
  // which do not call the old ore-only pulse function.
  game.player.ore=18;game.player.data=9;game.player.xp=25;game.time=2.1;
  hud.update(game,100,5);
  assert.equal(node('rewardOre').textContent,'СПЛАВ 12 → 18 (+6)');
  assert.equal(node('rewardData').textContent,'ДАННЫЕ 4 → 9 (+5)');
  assert.equal(node('rewardXp').textContent,'ОПЫТ 20 → 25 (+5)');
  assert.equal(node('dataGain').textContent,'+5');
  assert.equal(node('rewardFeed').hidden,false);
  game.player.level=3;game.player.xp=6;game.player.points=2;game.time=2.2;
  hud.update(game,105,5);
  assert.equal(node('xpValue').textContent,'6 / 105');
  assert.equal(node('rewardLevel').textContent,'УРОВЕНЬ 3!');
  assert.equal(node('rewardXp').textContent,'ОПЫТ +54',
   'total reflects the level-2 threshold, not the wrapped XP counter');
  game.time=5.3;hud.update(game,105,5);
  assert.equal(node('rewardFeed').hidden,true,'feedback should not obscure combat indefinitely');
  game.player.ore=15;game.time=5.4;hud.update(game,105,5);
  assert.equal(node('rewardOre').textContent,'СПЛАВ 18 → 15 (−3)');
  assert.equal(node('rewardOre').classList.contains('spent'),true);
  game.player.level=1;game.player.ore=0;game.player.xp=0;game.time=0;
  hud.update(game,42,5);
  assert.equal(node('rewardFeed').hidden,true,'restored or restarted runs do not invent pickups');
  game.holdFire=true;
  hud.update(game,100,5);
  assert.equal(node('flightMode').textContent,'ТИХИЙ РЕЖИМ');
  game.holdFire=false;
  game.mining.active=true;
  hud.update(game,100,5);
  assert.equal(node('flightMode').textContent,'ДОБЫЧА');
  game.mining.active=false;
  hud.compactHud=false;
  hud.update(game,100,5);
  assert.equal(node('flightMode').textContent,'АВТООГОНЬ · АКТИВЕН',
   'desktop retains the complete original instrument text');
  hud.compactHud=true;

  // Damage feedback must only respond to real combat hits, with no effect on
  // health, inventory or flight controls.
  hud.reducedMotion=false;
  hud.impact(.05);
  assert.equal(node('hud').classList.contains('is-hit'),false,'minor hit stays calm');
  hud.impact(.20);
  assert.equal(node('hud').classList.contains('is-hit'),true);
  assert.equal(node('hud').classList.contains('is-hit-heavy'),true);
  hud.impact(.09,true);
  assert.equal(node('hud').classList.contains('is-hit-heavy'),false);
  assert.equal(node('hud').classList.contains('is-hit-shield'),true);
  hud.reducedMotion=true;
  hud.impact(.20);
  assert.equal(node('hud').classList.contains('is-hit-static'),true);
  assert.equal(node('hud').classList.contains('is-hit'),false);

  assert.equal(node('hudThermal').hidden,true,'no fake heat reading before mechanics exist');
  assert.equal(node('hud').classList.contains('thermal-enabled'),false);
  // Hypothetical future model: HUD must opt in and render real values accurately.
  game.weaponThermal={enabled:true,current:80,limit:100,cooling:false,locked:false};
  hud.update(game,100,5);
  assert.equal(node('hudThermal').hidden,false);
  assert.equal(node('hudThermalText').textContent,'80%');
  assert.equal(node('hudThermalLabel').textContent,'НАГРЕВ');
  assert.equal(node('hudThermalMeter')['aria-valuenow'],'80');
  assert.equal(node('hudThermal').classList.contains('warning'),true);
  game.weaponThermal.current=100;
  game.weaponThermal.locked=true;
  hud.update(game,100,5);
  assert.equal(node('hudThermalLabel').textContent,'ПЕРЕГРЕВ');
  assert.equal(node('flightMode').textContent,'ПЕРЕГРЕВ');
  assert.equal(node('flightMode')['aria-label'],'ОГОНЬ ЗАБЛОКИРОВАН · ПЕРЕГРЕВ');
  game.weaponThermal.locked=false;game.weaponThermal.cooling=true;game.weaponThermal.current=45;
  hud.update(game,100,5);
  assert.equal(node('hudThermalLabel').textContent,'ОСТЫВАНИЕ');
  game.weaponThermal.enabled=false;
  hud.update(game,100,5);
  assert.equal(node('hudThermal').hidden,true);

  game.interactionFocus=null;game.player.hp=100;game.player.burstCooldown=3;
  hud.update(game,100,5);
  assert.equal(node('interactionCue').hidden,true);
  assert.equal(node('hud').classList.contains('is-critical'),false);
  assert.equal(node('burstBtn').disabled,true);
  game.waypoint={x:1500,y:0,label:'Домашний док'};
  hud.update(game,100,5);
  assert.equal(node('flightDistance').textContent,'1.5 КМ');
  assert.equal(node('stateText').textContent,'ДОМАШНИЙ ДОК');
  assert.equal(node('flightDistance').hidden,false);
  game.waypoint=null;
  hud.update(game,100,5);
  assert.equal(node('flightDistance').hidden,true);
  game.firstHardwareReward='pending';
  game.openingArc={status:'skipped',kind:null};
  hud.update(game,100,5);
  assert.match(node('contractObjective').textContent,/БЕСПЛАТНОЕ ОРУЖИЕ/,
   'reward from a normal contract remains visible even after skipping the opening');
  game.contract={kind:'kill',name:'Зачистить патрули',baseId:'0:0',progress:0,goal:3};
  hud.update(game,100,5);
  assert.match(node('contractObjective').textContent,/Зачистить патрули/);
  game.openingArc={status:'active',kind:'rescue',expiresAt:155,repair:1};
  hud.update(game,100,5);
  assert.match(node('contractObjective').textContent,/ЭВАКУАЦИЯ/,
   'the urgent assignment remains on top despite a second station contract');
  game.openingArc={status:'failed',kind:'rescue'};
  game.contract=null;
  hud.update(game,100,5);
  assert.match(node('contractObjective').textContent,/БЕСПЛАТНОЕ ОРУЖИЕ/);
 }finally{
  if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
  if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;
 }
});
