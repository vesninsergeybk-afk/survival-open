import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLoadout,cloneLoadout,FRAME_STEPS,SHIP_ART,MODULES,slotOpen,quoteLoadout,
 applyLoadout,upgradeFrame,loadoutProfile,moduleStats,createThermal,coolWeapons,
 heatWeapons,HangarSession,BLUEPRINT_KEY,PREVIEW_BLUEPRINT_KEY,mountPosition} from '../ship-loadout.js';
import {renderShipHangar} from '../hangar-panel.js';
import {shipTargets,updateAuxiliaryWeapons,updateFlakPellets,planHowitzer,updateHowitzer} from '../ship-weapons.js';
import {CORRIDOR_OPERATION} from '../operations.js';
import {drawEvolvedHero} from '../../src/hero-evolution.js';

const context=(extra={})=>({baseActive:true,level:14,ore:400,ranks:{rocket:1},fieldLoan:null,...extra});
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
test('the hangar exposes an actual, gated specialization choice without adding combat buttons',()=>{
 const current=createLoadout(),session=new HangarSession();session.begin(current);
 session.dispatch({act:'hgSlot',id:'0'},context({loadout:current,activeBases:3,points:3}));
 session.dispatch({act:'hgSelect',id:'plasma'},context({loadout:current,activeBases:3,points:3}));
 const view=renderShipHangar({...context({loadout:current,activeBases:3,points:3}),skillRanks:{},developmentMode:true,developmentCategory:'weapons'},session);
 assert.match(view,/Специализация · два пути/);
 assert.match(view,/dev-branch-pair/);
 assert.match(view,/data-act="hgSpec"/);
 assert.match(view,/plasma:furnace/);
 assert.match(view,/plasma:focus/);
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
 const loan=context({fieldLoan:{charges:3}});assert.equal(quoteLoadout(current,draft,loan).ok,true);
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
test('an unaffordable design can be recorded without manufacturing or spending anything',()=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 const current=createLoadout(),session=new HangarSession(storage);session.begin(current);
 session.draft.slots[1]='rail';const ctx=context({loadout:current,ore:0});
 session.dispatch({act:'hgSave',id:'0'},ctx);
 assert.equal(JSON.parse(memory.get(BLUEPRINT_KEY)).items[0].slots[1],'rail');
 assert.equal(current.owned.rail,undefined);assert.equal(ctx.ore,0);
 assert.equal(session.dispatch({act:'hgApply'},ctx),undefined,'recording a plan never bypasses manufacturing cost');
 assert.equal(current.slots[1],null);
});
test('showroom blueprints use a separate durable key and cannot overwrite game blueprints',()=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 const current=createLoadout(),ctx=context({loadout:current});
 const real=new HangarSession(storage);real.begin(current);real.dispatch({act:'hgSave',id:'0'},ctx);
 const before=memory.get(BLUEPRINT_KEY),preview=new HangarSession(storage,PREVIEW_BLUEPRINT_KEY);
 preview.begin(current);preview.draft.slots[1]='rail';preview.dispatch({act:'hgSave',id:'0'},ctx);
 assert.equal(memory.get(BLUEPRINT_KEY),before);
 assert.equal(new HangarSession(storage,PREVIEW_BLUEPRINT_KEY).blueprints[0].slots[1],'rail');
});
test('changing from a filtered ordinary node to H resets the incompatible filter',()=>{
 const current=full(),session=new HangarSession();session.begin(current);const ctx=context({loadout:current});
 session.dispatch({act:'hgFilter',id:'manual'},ctx);session.dispatch({act:'hgSlot',id:'5'},ctx);
 assert.equal(session.filter,'all');
 const html=renderShipHangar({...ctx,level:14},session);
 assert.match(html,/data-act="hgEquip" data-id="howitzer"/);
});
test('a blueprint with foreign module ids is ignored and text remains escaped',()=>{
 const bad={version:1,items:[{slots:['<img onerror=alert(1)>',null,null,null,null,null]}]};
 const session=new HangarSession({getItem:()=>JSON.stringify(bad)});
 assert.equal(session.blueprints[0],null);
 const html=renderShipHangar({level:1,ore:0,loadout:createLoadout()});
 assert.match(html,/Конструктор корабля/);
 assert.doesNotMatch(html,/data-act="hgApply"/,'no disabled confirmation before any change');
 assert.match(html,/data-act="hgSlot"/,'the fitting action is available from the ship');
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
test('equipment uses the framing of the painted damaged hull and ignores stale stage geometry',()=>{
 const player={x:0,y:0,level:1,angle:0};const intact=mountPosition(player,0);
 player.weaponGeometry={stage:0,damaged:true,width:79.95,height:79.95*944/1666};
 const damaged=mountPosition(player,0);assert.ok(damaged.x<intact.x);
 assert.ok(Math.abs(damaged.y-(.57-.5)*player.weaponGeometry.height)<1e-9);
 player.weaponGeometry.stage=9;assert.deepEqual(mountPosition(player,0),intact);
});
test('equipment framing switches only after the damaged artwork has actually loaded',()=>{
 const originalImage=globalThis.Image;
 let decodedDamage=false;
 class ImageStub {
  constructor(){this.complete=true;}
  set src(value){const damaged=value.includes('_damaged');
   this.naturalWidth=damaged?1666:512;
   this.naturalHeight=damaged?944:290;
   this.complete=!damaged||decodedDamage;
   if(damaged)this.damageImage=true;
  }
 }
 const noOp=()=>{},draws=[];
 const ctx={save:noOp,restore:noOp,beginPath:noOp,arc:noOp,fill:noOp,
  drawImage:(image,...bounds)=>draws.push({image,bounds})};
 globalThis.Image=ImageStub;
 try{
  const geometry={};assert.equal(drawEvolvedHero(ctx,19.5,0,.2,0,geometry),true);
  assert.equal(geometry.damaged,false);assert.ok(Math.abs(geometry.height-79.95*290/512)<1e-9);
  // Decode the same requested image; the renderer must keep using intact
  // geometry until those bytes become usable.
  decodedDamage=true;
  const freshGeometry={};assert.equal(drawEvolvedHero(ctx,19.5,1,.2,0,freshGeometry),true);
  assert.equal(freshGeometry.damaged,true);assert.ok(Math.abs(freshGeometry.height-79.95*944/1666)<1e-9);
  assert.equal(draws.at(-1).image.damageImage,true);
 }finally{if(originalImage===undefined)delete globalThis.Image;else globalThis.Image=originalImage;}
});
test('an auxiliary gun fires only when mounted, has a target, and automatic fire is allowed',()=>{
 const e=enemy(300),game=combat([e]);
 updateAuxiliaryWeapons(game,.1,false);assert.equal(game.hits.length,0);
 updateAuxiliaryWeapons(game,.1,true);assert.deepEqual(game.hits,[38]);
 assert.equal(game.weaponThermal.current,18);assert.equal(game.weaponFx.length,1);
 assert.equal(game.weaponFx[0].kind,'rail');
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
test('anti-swarm targeting picks nearby enemies ahead of a more distant base turret',()=>{
 const a=enemy(70),b=enemy(90),c=enemy(110),turret={x:220,y:0,hp:100};
 const game=combat([a,b,c]);game.nearbyEnemyBase=()=>({x:230,y:0,turrets:[turret]});
 assert.equal(shipTargets(game,245,1)[0].target,turret,'rail retains deliberate objective priority');
 assert.deepEqual(shipTargets(game,245,3,true).map(x=>x.target),[a,b,c]);
});
test('precision rail selects a capital threat while anti-swarm still favors close enemies',()=>{
 const scout={...enemy(100),type:'scout'},gunship={...enemy(550),type:'gunship'};
 const game=combat([scout,gunship]);
 assert.equal(shipTargets(game,700,1,false,'precision')[0].target,gunship);
 assert.equal(shipTargets(game,700,1,true,'precision')[0].target,scout);
 updateAuxiliaryWeapons(game,1,true);
 assert.equal(gunship.hp,262,'rail fires at the armored target');
 assert.equal(scout.hp,300,'the nearby scout is available for short-range weapons');
});
test('penetrating rail damages its target beyond a rock, while ordinary rail stops at cover',()=>{
 const e=enemy(320),game=combat([e]),rock={x:160,y:0,r:45,hp:200,alive:true};
 game.rockGrid.query=()=>[rock];
 let rockHits=0;game.damageRock=()=>rockHits++;
 updateAuxiliaryWeapons(game,1,true);
 assert.equal(e.hp,300);assert.equal(rockHits,1);
 game.shipLoadout.specializations={rail:{path:'penetrator',rank:1}};
 game.moduleClocks.rail=0;
 updateAuxiliaryWeapons(game,1,true);
 assert.ok(Math.abs(e.hp-(300-38*.65))<1e-9);
 assert.equal(rockHits,2);
});
test('wide flak branch hits four enemies instead of three at lower per-target damage',()=>{
 const enemies=[-55,-20,20,55,100].map(y=>enemy(y===100?190:180,y));
 const game=combat(enemies);game.weaponProfile={rail:0,flak:1};
 game.shipLoadout.slots=['flak',null,null,null,null,null];
 game.shipLoadout.specializations={flak:{path:'sweep',rank:1}};
 updateAuxiliaryWeapons(game,1,true);
 assert.equal(game.hits.length,0,'pellets must not damage instantly at launch');
 assert.equal(game.flakPellets.length,12);
 updateFlakPellets(game,.2);
 for(const e of enemies.slice(0,4))assert.ok(Math.abs(e.hp-289)<1e-6,
  'all four separated targets should receive their own three pellets');
 assert.equal(enemies[4].hp,300,'the fifth target remains outside the burst budget');
});
test('duplicate auxiliary modules emit visible shots from both mounted positions',()=>{
 const e=enemy(300),game=combat([e]);game.shipLoadout.slots[1]='rail';game.weaponProfile.rail=2;
 updateAuxiliaryWeapons(game,1,true);assert.deepEqual(game.hits,[38,38]);
 assert.equal(game.weaponFx.length,2);
 assert.notEqual(game.weaponFx[0].x,game.weaponFx[1].x);
});
test('howitzer requires H and a real target, telegraphs a fixed point and waits before damage',()=>{
 const e={...enemy(500),type:'gunship'},game=combat([e]);
 assert.equal(planHowitzer(game).ok,false);
 game.weaponProfile.howitzer=true;const plan=planHowitzer(game);assert.equal(plan.ok,true);
 game.heavyCharge=plan.charge;assert.equal(game.heavyCharge.x,500);
 updateHowitzer(game,1);assert.equal(game.hits.length,0);
 updateHowitzer(game,.26);assert.deepEqual(game.hits,[]);
 assert.equal(game.heavyShells.length,1,'the shell must travel after charging');
 updateHowitzer(game,.8);assert.deepEqual(game.hits,[180]);
 assert.ok(game.heavyCooldown<=12&&game.heavyCooldown>11,'cooldown continues during shell travel');
 assert.equal(game.weaponThermal.current,70);
 assert.equal(planHowitzer(game).ok,false);
 game.heavyCooldown=0;game.weaponThermal.locked=true;assert.equal(planHowitzer(game).ok,false);
 const moving=combat([enemy(400)]);moving.weaponProfile.howitzer=true;moving.heavyCharge=planHowitzer(moving).charge;
 moving.grid.query()[0].x=650;updateHowitzer(moving,1.26);assert.equal(moving.hits.length,0,'a moving target can leave the fixed blast area');
});
test('howitzer cancels cleanly on repair, removal or moving beyond its advertised firing range',()=>{
 for(const mode of ['repair','removed','range']){
  const game=combat([enemy(500)]);game.weaponProfile.howitzer=true;game.heavyCharge=planHowitzer(game).charge;
  if(mode==='repair')game.probeRepairing=true;
  if(mode==='removed')game.weaponProfile.howitzer=false;
  if(mode==='range')game.player.x=-500;
  updateHowitzer(game,1.3);assert.equal(game.heavyCharge,null);assert.equal(game.hits.length,0);
  assert.equal(game.weaponThermal.current,0);assert.equal(game.heavyCooldown,0);
 }
});
test('the station adapter, heat gates and both manual inputs are wired into the actual game',()=>{
 const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(source,/e\.code===this\.controls\.howitzer\)this\.callHowitzer\(\)/);
 assert.match(source,/heavyButton.onclick=\(\)=>this.callHowitzer\(\)/);
 assert.match(source,/updateAutomaticWeapons\(this,dt,!this.heavyCharge&&automaticFireAllowed/);
 assert.match(source,/if\(SHIP_UPGRADES.has\(id\)&&\(!this.docked\?\.active/);
 assert.match(source,/markIonCluster\(targets,item.target/);
 assert.match(source,/this.shipLoadout=result.loadout;this.player.ore=result.ore/);
 const profile=loadoutProfile(full());assert.equal(profile.plasma,1);
 assert.equal(moduleStats('plasma').damage,18);assert.equal(MODULES.plasma.heat,6);
});
