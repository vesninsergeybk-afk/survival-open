// Run from project root: node site/games/survivor/prologue/smoke.test.cjs
// Deterministic browser-free logic checks. The rendering path still needs device QA.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');

function harness() {
  // Injection belongs solely to the test runner and is never written into game.js.
  const code = source
    .replace("reset();$('intro').style.display",
      "window.__stationDebug.devTeleport=(x,y)=>{hero.x=x;hero.y=y;hero.vx=hero.vy=0;};window.__stationDebug.testDetour=()=>{const e=enemy(1625,0,50);for(let i=0;i<420;i++){now+=1/60;moveEnemy(e,1190,0,1/60);}return {x:e.x,y:e.y};};reset();$('intro').style.display")
    .replace(' drawWorld();\n}', ' void 0;\n}');
  const handlers = {}, els = new Map();
  const graphics = new Proxy({}, {
    get:(target,key)=>key in target ? target[key] : ()=>({ addColorStop(){} }),
    set:(target,key,val)=>(target[key]=val,true)
  });
  function element(id) {
    if(!els.has(id)) els.set(id, {
      style:{}, classList:{add(){},remove(){},toggle(){}}, textContent:'', innerHTML:'',
      addEventListener(type, fn){this['on_'+type]=fn;},
      querySelector(){return {textContent:''};},
      getContext(){return graphics;},
      getBoundingClientRect(){return {left:0,top:0,width:140,height:140};},
      setPointerCapture(){}
    });
    return els.get(id);
  }
  const doc={getElementById:element,createElement:name=>element('element-'+name),addEventListener(){}};
  const win={innerWidth:1280,innerHeight:800,devicePixelRatio:1,addEventListener(type,fn){handlers[type]=fn;}};
  let frame;
  function ImageMock(){
    this.complete=false;this.naturalWidth=1280;
    Object.defineProperty(this,'src',{set:()=>{this.complete=true;this.onload?.();}});
  }
  new Function('window','document','Image','requestAnimationFrame',code)(win,doc,ImageMock,fn=>frame=fn);
  const debug=win.__stationDebug;
  let ms=0;
  function tick(seconds){for(let n=0;n<Math.ceil(seconds*60);n++){ms+=1000/60;frame(ms);}}
  function hold(seconds){
    handlers.keydown({code:'Space',preventDefault(){}});
    tick(seconds);handlers.keyup({code:'Space'});
  }
  return {debug,element,tick,hold,key:(code,pressed)=>handlers[pressed?'keydown':'keyup']({code,preventDefault(){}}),start:()=>element('startBtn').on_click()};
}

function runScenario(position) {
  const h=harness(),d=h.debug;
  assert.equal(d.getState().started,false,'intro must block gameplay');
  assert.deepEqual(d.testGeometry(),{dock:true,hall:true,outside:false,cover:true});
  h.start();assert.equal(d.getState().started,true);
  d.devTeleport(-65,-105);h.hold(2.2);
  assert.equal(d.getState().generator,true,'generator must respond to engineering beam');
  assert.equal(d.getState().door[0].open,0,'gate must not open automatically');
  d.devTeleport(380,0);h.hold(.9);h.tick(2);
  assert.equal(d.getState().door[0].open,1,'gate must open after beam command');
  d.devTeleport(1080,250);h.hold(1.7);h.tick(4);
  assert.equal(d.getState().turrets[0].state,'online','turret A should boot');
  assert.equal(d.getState().turrets[1].state,'offline','turret B must remain separate');
  d.devTeleport(1670,-95);h.hold(1.7);h.tick(4);
  assert.equal(d.getState().turrets[1].state,'online','turret B should boot');
  d.devTeleport(...position);h.tick(65);
  const state=d.getState();
  assert.equal(state.wave,3,'reinforcement wave must complete');
  assert.equal(state.alive,0,'no stranded enemy may block progress');
  assert.equal(state.securityUnlocked,true,'exit unlocks after victory');
  assert.equal(state.door[1].open,1,'exit shutter must animate open');
  d.devTeleport(2690,0);h.hold(2);h.tick(4);
  assert.equal(d.getState().workshop.installed,true,'module installation must complete');
  h.tick(22);
  assert.equal(d.getState().workshop.botsSpawned,2,'two repair bots arrive after installation');
  assert.equal(d.getState().workshop.clear,true,'first weak weapon defeats local bots');
  assert.equal(d.getState().door[2].open,1,'arena access should open');
  const workshopState=d.getState();
  assert.equal(workshopState.hero.hp>0,true,'player survived first weapon trial');
  d.devTeleport(3240,0);h.tick(.1);
  assert.equal(d.getState().ended,false,'workshop must lead to the next room, not finish the whole prologue');
  assert.equal(d.getState().arena.entered,false,'arena begins only after crossing its threshold');
  return {position,securityHp:state.hero.hp,workshopHp:workshopState.hero.hp,turrets:state.turrets.map(t=>t.hp),installed:workshopState.workshop.installed,finished:true};
}

const all = [[1670,-95],[1100,-100],[1850,-245],[950,0],[1440,-210]].map(runScenario);
process.stdout.write(JSON.stringify({result:'PASS',scenarios:all.length,all},null,2)+'\n');


function runPilotJourney(){
 const h=harness(),d=h.debug;h.start();
 function flyTo(x,y){
  let reached=false;
  for(let i=0;i<26*60;i++){
   const s=d.getState();if(s.ended)break;
   const dx=x-s.hero.x,dy=y-s.hero.y;
   if(Math.hypot(dx,dy)<31){reached=true;break;}
   for(const [key,on] of [['KeyD',dx>19],['KeyA',dx< -19],['KeyS',dy>19],['KeyW',dy< -19]])h.key(key,on);
   h.tick(1/60);
  }
  for(const k of ['KeyD','KeyA','KeyS','KeyW'])h.key(k,false);
  assert.equal(reached,true,'manual flight cannot reach '+x+','+y+' (at '+JSON.stringify(d.getState().hero)+')');
 }
 flyTo(-65,-105);h.hold(2.2);assert.equal(d.getState().generator,true);
 flyTo(380,0);h.hold(.95);h.tick(2);
 for(const p of [[695,0],[950,0],[1080,245]])flyTo(...p);
 h.hold(1.7);h.tick(4);assert.equal(d.getState().turrets[0].state,'online');
 for(const p of [[1215,-230],[1640,-230]])flyTo(...p);
 h.hold(1.8);h.tick(4);h.tick(65);assert.equal(d.getState().wave,3);
 for(const p of [[1840,-20],[2080,0],[2395,0],[2690,0]])flyTo(...p);
 h.hold(2.05);h.tick(26);assert.equal(d.getState().workshop.clear,true);
 for(const p of [[3240,0],[3460,0],[3545,-175]])flyTo(...p);
 h.hold(1.65);for(const p of [[3670,-215],[4010,-230],[4150,165]])flyTo(...p);
 h.hold(1.65);flyTo(4050,-205);h.tick(53);
 assert.equal(d.getState().arena.clear,true,'arena exits only with both relays off and bots cleared');
 for(const p of [[4385,0],[4740,0],[5060,-60]])flyTo(...p);
 h.hold(2.35);flyTo(5020,-60);h.tick(38);assert.equal(d.getState().command.clear,true);
 for(const p of [[5600,0],[5990,0],[6150,-185]])flyTo(...p);
 h.hold(1.85);h.tick(3);
 for(const p of [[6140,-115],[6330,-125],[6740,-215],[6740,170]])flyTo(...p);
 h.hold(1.85);h.tick(3);
 for(const p of [[6780,-220],[6530,-240]])flyTo(...p);
 h.tick(95);
 const sector=d.getState();assert.equal(sector.defense.clear,true,'heavy turrets must defeat full two-sided siege');
 assert.ok(sector.defense.coreHp>0&&sector.defense.coreHp<200,'siege threatens but does not auto-destroy the core');
 for(const p of [[7120,0],[7460,0],[7930,0]])flyTo(...p);
 h.hold(2.6);h.tick(5);
 assert.equal(d.getState().ended,true,'mission must end at evacuation gate');
 assert.equal(h.element('endingTitle').textContent,'Последний сигнал передан');
 const hp=d.getState().hero.hp;assert.ok(hp>0,'pilot survived full mission');
 const route=d.testDetour();assert.ok(Math.hypot(route.x-1190,route.y)<85,'bots route around solid cover');
 return {allSevenRooms:true,remainingHp:hp,coreHp:sector.defense.coreHp,enemyDetour:route};
}
const pilot=runPilotJourney();
process.stdout.write(JSON.stringify({pilot},null,2)+'\n');
