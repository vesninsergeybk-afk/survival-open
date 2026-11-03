import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLoadout,cloneLoadout,FRAME_STEPS,SHIP_ART,MODULES,slotOpen,quoteLoadout,
 applyLoadout,upgradeFrame,loadoutProfile,moduleStats,createThermal,coolWeapons,
 heatWeapons,HangarSession,BLUEPRINT_KEY,mountPosition} from '../ship-loadout.js';
import {renderShipHangar} from '../hangar-panel.js';
import {shipTargets,updateAuxiliaryWeapons,planHowitzer,updateHowitzer} from '../ship-weapons.js';
import {CORRIDOR_OPERATION} from '../operations.js';

const context=(extra={})=>({baseActive:true,level:14,ore:400,ranks:{rocket:1},ionLoan:null,...extra});
const full=()=>({...createLoadout(),frame:4});
const enemy=(x,y=0)=>({x,y,hp:300,r:15,converted:false});
const combat=(enemies=[])=>({player:{x:0,y:0,level:7,angle:0},skillRanks:{},
 shipLoadout:{...createLoadout(),slots:['rail',null,null,null,null,null]},
 weaponProfile:{rail:1,flak:0,howitzer:false},weaponThermal:createThermal(),
 moduleClocks:{rail:0,flak:0},grid:{query:()=>enemies},rockGrid:{query:()=>[]},
 nearbyEnemyBase:()=>null,operation:null,heavyCooldown:0,heavyCharge:null,
 hits:[],flashes:[],damageEnemy(e,d){this.hits.push(d);e.hp-=d;},
 damageRock(){},flash(...args){this.flashes.push(args);},
 heritage:{vfx:{muzzle(){},nova(){}},play(){}}});

test('frame progression opens exactly 2, 3, 4, 5 and then a separate H node',()=>{
 assert.deepEqual(FRAME_STEPS.map(x=>x.nodes),[2,3,4,5,5]);
 const loadout=createLoadout();
 assert.equal(slotOpen(loadout,0),true);assert.equal(slotOpen(loadout,2),false);
 assert.equal(slotOpen({...loadout,frame:3},5),false);assert.equal(slotOpen(full(),5),true);
 assert.equal(upgradeFrame(loadout,context({level:3})).ok,false);
 assert.equal(upgradeFrame(loadout,context({ore:47})).ok,false);
 const result=upgradeFrame(loadout,context({level:4,ore:48}));
 assert.equal(result.loadout.frame,1);assert.equal(result.ore,0);
 assert.equal(loadout.frame,0,'planning never modifies the live ship');
});
test('manufacturing is atomic, respects stock, and never charges for reinstalling a module',()=>{
 const current=createLoadout(),draft=cloneLoadout(current);draft.slots[1]='rail';
 const refused=applyLoadout(current,draft,context({ore:35}));assert.equal(refused.ok,false);
 assert.deepEqual(current,createLoadout());
 const built=applyLoadout(current,draft,context({ore:36}));
 assert.equal(built.ore,0);assert.equal(built.loadout.owned.rail,1);
 const stored=cloneLoadout(built.loadout);stored.slots[1]=null;
 const removed=applyLoadout(built.loadout,stored,context({ore:0}));
 assert.equal(removed.loadout.owned.rail,1);assert.equal(removed.cost,0);
 const reinstalled=applyLoadout(removed.loadout,draft,context({ore:0}));
 assert.equal(reinstalled.ok,true);assert.equal(reinstalled.cost,0);
 const duplicate=cloneLoadout(reinstalled.loadout);duplicate.slots=['rail','rail',null,null,null,null];
 assert.equal(quoteLoadout(reinstalled.loadout,duplicate,context()).cost,36);
});
test('unknown, closed and incompatible nodes cannot change the live loadout',()=>{
 const current=createLoadout();
 for(const [index,id] of [[2,'plasma'],[0,'howitzer'],[0,'unlisted']]){
  const draft=cloneLoadout(current);draft.slots[index]=id;
  assert.equal(applyLoadout(current,draft,context()).ok,false);
 }
 const heavy=full(),draft=cloneLoadout(heavy);draft.slots[5]='rail';
 assert.equal(quoteLoadout(heavy,draft,context()).ok,false);
 assert.equal(quoteLoadout(current,current,context({baseActive:false})).ok,false);
 assert.equal(quoteLoadout(current,{...current,slots:Array(6).fill(null)},context()).ok,false);
});
test('technology, level and finite trial restrictions are enforced at confirmation',()=>{
 const current=full(),draft=cloneLoadout(current);draft.slots[1]='rocket';
 assert.equal(quoteLoadout(current,draft,context({ranks:{}})).ok,false);
 draft.slots[1]='rail';assert.equal(quoteLoadout(current,draft,context({level:2})).ok,false);
 draft.slots[1]='ion';assert.equal(quoteLoadout(current,draft,context()).ok,false);
 const loan=context({ionLoan:{charges:3}});assert.equal(quoteLoadout(current,draft,loan).ok,true);
 draft.slots[2]='ion';assert.equal(quoteLoadout(current,draft,loan).ok,false);
 draft.slots[2]=null;draft.slots[0]='rail';
 assert.equal(quoteLoadout(current,draft,loan).ok,false,'ion needs plasma marks');
});
test('draft edits remain separate, reset is free, and application spends resources once',()=>{
 const loadout=createLoadout(),session=new HangarSession();session.begin(loadout);
 const ctx=context({loadout,ore:50});
 session.dispatch({act:'hgSlot',id:'1'},ctx);session.dispatch({act:'hgSelect',id:'rail'},ctx);
 session.dispatch({act:'hgInstall'},ctx);assert.equal(loadout.slots[1],null);
 assert.equal(session.dirty(loadout),true);assert.equal(ctx.ore,50);
 session.dispatch({act:'hgReset'},ctx);assert.equal(session.dirty(loadout),false);
 session.dispatch({act:'hgSlot',id:'1'},ctx);session.dispatch({act:'hgSelect',id:'rail'},ctx);
 session.dispatch({act:'hgInstall'},ctx);const result=session.dispatch({act:'hgApply'},ctx);
 assert.equal(result.ore,14);assert.equal(result.loadout.slots[1],'rail');
 assert.equal(session.dispatch({act:'hgApply'},{...ctx,loadout:result.loadout,ore:14}).cost,0);
});
test('blueprints persist only module choices and cannot grant unavailable hardware',()=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 const loadout=full(),session=new HangarSession(storage);session.begin(loadout);
 session.draft.slots[5]='howitzer';session.dispatch({act:'hgSave',id:'0'},context({loadout}));
 const saved=JSON.parse(memory.get(BLUEPRINT_KEY));
 assert.deepEqual(Object.keys(saved.items[0]),['slots']);
 const next=new HangarSession(storage),starter=createLoadout();next.begin(starter);
 next.dispatch({act:'hgLoad',id:'0'},context({loadout:starter,level:1,ore:0}));
 assert.equal(quoteLoadout(starter,next.draft,context({level:1,ore:0})).ok,false);
 assert.equal(starter.slots[5],null);assert.equal(starter.frame,0);
 assert.doesNotThrow(()=>new HangarSession({getItem:()=>'{bad json'}));
 assert.doesNotThrow(()=>new HangarSession({getItem:()=>{throw Error('blocked');}}));
});
test('a blueprint with foreign module ids is ignored and text remains escaped',()=>{
 const bad={version:1,items:[{slots:['<img onerror=alert(1)>',null,null,null,null,null]}]};
 const session=new HangarSession({getItem:()=>JSON.stringify(bad)});
 assert.equal(session.blueprints[0],null);
 const html=renderShipHangar({level:1,ore:0,loadout:createLoadout()});
 assert.match(html,/Конструктор корабля/);assert.match(html,/hgApply/);
 assert.match(html,/Узел 1/);assert.match(html,/ship_01.webp/);
 assert.doesNotMatch(html,/<canvas|<iframe/);
});
test('the starter plasma stays below the cooling budget, while five beams force a cooldown',()=>{
 const early=createThermal();for(let i=0;i<120;i++){coolWeapons(early,.63);heatWeapons(early,6);}
 assert.equal(early.locked,false);assert.ok(early.current<7);
 const bank=createThermal();for(let i=0;i<6;i++){coolWeapons(bank,.63);if(!bank.locked)heatWeapons(bank,30);}
 assert.equal(bank.locked,true);coolWeapons(bank,1);assert.equal(bank.locked,true);
 coolWeapons(bank,5);assert.equal(bank.locked,false);assert.ok(bank.current<=35);
 const quiet=createThermal();quiet.current=80;coolWeapons(quiet,1,true);assert.equal(quiet.current,55);
});
test('all ten hull stages have separate anchors with finite in-bounds mount positions',()=>{
 assert.equal(SHIP_ART.length,10);
 for(let i=0;i<10;i++){
  assert.equal(SHIP_ART[i].length,8);
  for(const p of SHIP_ART[i].slice(2))assert.ok(p.every(x=>x>0&&x<1));
  for(let slot=0;slot<6;slot++){
   const point=mountPosition({x:11,y:15,level:1+i*3,angle:Math.PI*.7},slot);
   assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));
  }
 }
});
test('an auxiliary gun fires only when mounted, has a target, and automatic fire is allowed',()=>{
 const e=enemy(300),game=combat([e]);
 updateAuxiliaryWeapons(game,.1,false);assert.equal(game.hits.length,0);
 updateAuxiliaryWeapons(game,.1,true);assert.deepEqual(game.hits,[38]);
 assert.equal(game.weaponThermal.current,18);assert.equal(game.flashes.length,1);
 updateAuxiliaryWeapons(game,.1,true);assert.equal(game.hits.length,1,'cooldown prevents a second immediate hit');
 game.moduleClocks.rail=0;game.weaponThermal.locked=true;updateAuxiliaryWeapons(game,.1,true);
 assert.equal(game.hits.length,1,'overheat suppresses auxiliary guns');
 game.weaponThermal.locked=false;game.weaponProfile.rail=0;updateAuxiliaryWeapons(game,5,true);
 assert.equal(game.hits.length,1,'removing the module removes its attack');
 const empty=combat();updateAuxiliaryWeapons(empty,1,true);assert.equal(empty.weaponThermal.current,0);
});
test('auxiliary weapons preserve concealment, actual range, and terrain interception',()=>{
 const hidden={...enemy(90),signalIntel:{mode:'investigate'}},far=enemy(1000),e=enemy(300);
 const game=combat([hidden,far,e]);
 const filtered=shipTargets(game,700,5);assert.ok(!filtered.some(x=>x.target===far));
 assert.ok(!filtered.some(x=>x.target===hidden),'unconfirmed patrol remains hidden');
 const rock={x:150,y:0,r:50,hp:100,alive:true};game.rockGrid.query=()=>[rock];
 let coverHits=0;game.damageRock=()=>coverHits++;
 game.grid.query=()=>[e];updateAuxiliaryWeapons(game,1,true);
 assert.equal(game.hits.length,0);assert.equal(coverHits,1);
});
test('auxiliary weapons use the actual corridor mission id and can damage the jammer',()=>{
 const game=combat();game.operation={id:CORRIDOR_OPERATION.id,x:150,y:0,hp:150,phase:'attack'};
 assert.equal(shipTargets(game,700)[0].kind,'jammer');
 updateAuxiliaryWeapons(game,1,true);assert.equal(game.operation.hp,112);
});
test('howitzer requires H and a real target, telegraphs a fixed point and waits before damage',()=>{
 const e={...enemy(500),type:'gunship'},game=combat([e]);
 assert.equal(planHowitzer(game).ok,false);
 game.weaponProfile.howitzer=true;const plan=planHowitzer(game);assert.equal(plan.ok,true);
 game.heavyCharge=plan.charge;assert.equal(game.heavyCharge.x,500);
 updateHowitzer(game,1);assert.equal(game.hits.length,0);
 updateHowitzer(game,.26);assert.deepEqual(game.hits,[180]);
 assert.equal(game.heavyCooldown,12);assert.equal(game.weaponThermal.current,70);
 assert.equal(planHowitzer(game).ok,false);
 game.heavyCooldown=0;game.weaponThermal.locked=true;assert.equal(planHowitzer(game).ok,false);
 const moving=combat([enemy(400)]);moving.weaponProfile.howitzer=true;moving.heavyCharge=planHowitzer(moving).charge;
 moving.grid.query()[0].x=650;updateHowitzer(moving,1.26);assert.equal(moving.hits.length,0,'a moving target can leave the fixed blast area');
});
test('the station adapter, heat gates and both manual inputs are wired into the actual game',()=>{
 const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(source,/KeyF'\)this.callHowitzer\(\)/);
 assert.match(source,/heavyButton.onclick=\(\)=>this.callHowitzer\(\)/);
 assert.match(source,/weaponProfile.rocket&&!this.weaponThermal.locked/);
 assert.match(source,/plasmaPower&&!this.weaponThermal.locked/);
 assert.match(source,/if\(SHIP_UPGRADES.has\(id\)&&\(!this.docked\?\.active/);
 assert.match(source,/weaponProfile.ion\)markIonCluster/);
 assert.match(source,/this.shipLoadout=result.loadout;this.player.ore=result.ore/);
 const profile=loadoutProfile(full());assert.equal(profile.plasma,1);
 assert.equal(moduleStats('plasma').damage,14);assert.equal(MODULES.plasma.heat,6);
});
