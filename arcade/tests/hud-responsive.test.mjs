import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CockpitDisplay,hullCondition,radarPoint} from '../hud.js';

const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../hud.css',import.meta.url),'utf8');
const ids=[...source.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);

test('HUD contract: unique live element IDs, cache versions and mobile layout',()=>{
 assert.equal(new Set(ids).size,ids.length,'duplicate element IDs');
 for(const id of ['hud','cockpitFrame','radar','hp','hpbar','hpmeter','shield','xpbar',
   'xpmeter','level','burst','burstbar','bursttext','burstBtn','ore','oreResource',
   'data','bases','wing','hack','interactionCue','contractObjective','message',
   'miningStatus','stateText','flightDistance','flightMode','wingStatus',
   'hudThermal','hudThermalLabel','hudThermalText','hudThermalMeter']){
  assert.ok(ids.includes(id),id+' is missing from the page');
 }
 assert.match(source,/hud\.css\?v=hud-responsive-v16/);
 assert.match(source,/game\.js\?v=[a-z0-9-]+/);
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
     add(name){classes.add(name)},remove(name){classes.delete(name)},
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
   nearbyEnemyBase:()=>null,world:{nearbyStations:()=>[]},zones:[]
  };
  hud.update(game,100,5);
  assert.equal(node('hp').textContent,'28 / 100');
  assert.equal(node('data').textContent,'4');
  assert.equal(node('ore').textContent,'12');
  assert.equal(node('interactionCue').textContent,'E · Открыть станцию');
  assert.equal(node('interactionCue').hidden,false);
  assert.equal(node('hpmeter')['aria-valuenow'],'28');
  assert.equal(node('hud').classList.contains('is-critical'),true);
  assert.equal(node('burstBtn').disabled,false);
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
  assert.equal(node('flightMode').textContent,'ОГОНЬ ЗАБЛОКИРОВАН · ПЕРЕГРЕВ');
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
 }finally{
  if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
  if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;
 }
});
