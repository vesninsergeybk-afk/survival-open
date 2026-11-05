// Run the actual game methods without starting an animation loop or a renderer.
// The module's imports and game class are unchanged; only auto-start is omitted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../world.js';
import {SpatialGrid} from '../balance.js';
import {createLoadout,HangarSession,loadoutProfile,createThermal,coolWeapons} from '../ship-loadout.js';
import {updateFlakPellets} from '../ship-weapons.js';

const entry=new URL('../game.js',import.meta.url);
const source=readFileSync(entry,'utf8').replace(/\nnew ArcadeGame\(\);\s*$/,'\n')
 .replace(/from '(\.[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,entry).href));
const {ArcadeGame}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const noOp=()=>{};
function game(){
 const g=Object.create(ArcadeGame.prototype),loadout=createLoadout();
 Object.assign(g,{
  player:{x:0,y:0,vx:0,vy:0,level:14,points:20,ore:400,data:0,xp:0,hp:110,maxHp:110,shield:0,r:19,angle:0},
  skillRanks:{beam:0,double:0,range:0,rocket:0,hull:0,engine:0,shield:0,dodge:0,mining:0,extractor:0,radar:0,tactics:0,magnet:0},
  shipLoadout:loadout,hangarSession:new HangarSession(),weaponThermal:createThermal(),
  moduleClocks:{rail:0,flak:0},beamClock:0,rocketClock:0,heavyCooldown:0,heavyCharge:null,
  world:new World(20261102),activeBases:1,allies:[],support:{charges:0,missions:[]},
  network:{armor:0,armament:0,engine:0,strikePower:0},doctrine:null,
  fieldLoan:null,fieldTrialTaken:false,fieldReturnAt:-Infinity,ionMasteryAwarded:false,
  operation:null,contract:null,time:0,geoScanUntil:0,overchargeUntil:0,
  holdFire:false,mining:{active:false},probeRepairing:false,actionHeld:null,
  dead:false,paused:true,baseTab:'hangar',isTouchLayout:false,
  overlay:{hidden:false,dataset:{mode:'base'},querySelector:()=>null},
  heritage:{ui:noOp,station:noOp,play:noOp,vfx:{muzzle:noOp,rocketImpact:noOp,nova:noOp}},
  grid:new SpatialGrid(110),rockGrid:new SpatialGrid(140),enemies:[],missiles:[],flashes:[],hits:[],
  nearArsenalBonus:false,renderDock:noOp,hud:noOp,
  notice(text){this.lastNotice=text;},
  damageEnemy(target,damage,kind){this.hits.push({damage,kind});target.hp-=damage;},
  nearbyEnemyBase:()=>null
 });
 g.docked=g.world.home;g.docked.active=true;
 g.hangarSession.begin(loadout);g.syncShipLoadout();return g;
}
const target=(x=100,y=0)=>({x,y,hp:1e8,maxHp:1e8,r:14,type:'fighter',converted:false});
function battle(g,seconds,dt=1/60){
 g.paused=false;g.overlay.hidden=true;
 for(let i=0;i<Math.ceil(seconds/dt);i++){
  g.time+=dt;coolWeapons(g.weaponThermal,dt,g.holdFire);
  g.updateShipWeapons(dt);g.updateMissiles(dt);updateFlakPellets(g,dt);
 }
}
function equip(g,slots){
 g.shipLoadout.frame=4;g.shipLoadout.slots=[...slots];g.syncShipLoadout();g.hangarSession.begin(g.shipLoadout);
}

test('taking an ion loan on a rail-only ship does not install an unusable manual weapon',()=>{
 const g=game();equip(g,['rail',null,null,null,null,null]);g.shipLoadout.owned.rail=1;
 g.baseAction('loanIon','');
 assert.ok(g.fieldLoan);assert.equal(g.weaponProfile.ion,false);
 assert.ok(!g.hangarSession.draft.slots.includes('ion'),'no plasma means no valid automatic suggestion');
});
test('a loan immediately fills a free node without spending extra resources',()=>{
 const g=game();g.baseAction('loanIon','');
 assert.equal(g.weaponProfile.ion,true,'a free node is fitted without another confirmation');
 assert.equal(g.hangarSession.draft.slots[1],'ion');
 g.hangarAction({act:'hgApply'});assert.equal(g.weaponProfile.ion,true);
 assert.equal(g.player.ore,400,'the first trial remains free');
});
test('the rocket unlock gives one owned module and requires confirming its installation',()=>{
 const g=game();g.buySkill('rocket');
 assert.equal(g.skillRanks.rocket,1);assert.equal(g.player.points,19);
 assert.equal(g.shipLoadout.owned.rocket,1);assert.equal(g.weaponProfile.rocket,0);
 assert.equal(g.hangarSession.draft.slots[1],'rocket');
 g.hangarAction({act:'hgApply'});assert.equal(g.weaponProfile.rocket,1);
 assert.equal(g.player.ore,400);
});
test('getting a new module never erases an unfinished weapon replacement',()=>{
 const g=game();g.hangarSession.draft.slots[1]='rail';const before=[...g.hangarSession.draft.slots];
 g.baseAction('loanIon','');assert.deepEqual(g.hangarSession.draft.slots,before);
 g.buySkill('rocket');assert.deepEqual(g.hangarSession.draft.slots,before);
 assert.equal(g.shipLoadout.owned.rocket,1);assert.equal(g.weaponProfile.ion,false);
});
test('rental return and repeated docking clean live and staged ion modules without consuming another trial',()=>{
 const g=game();g.baseAction('loanIon','');g.hangarAction({act:'hgApply'});
 assert.ok(g.weaponProfile.ion);g.baseAction('returnIon','');
 assert.equal(g.weaponProfile.ion,false);
 assert.ok(!g.player.weaponSlots.includes('ion'),'the rendered ship must update immediately');assert.ok(!g.hangarSession.draft.slots.includes('ion'));
 g.baseAction('loanIon','');assert.equal(g.fieldLoan,null,'the home trial cannot be farmed');
});
test('returning an ion loan preserves unrelated unfinished edits in the hangar',()=>{
 const g=game();g.baseAction('loanIon','');g.hangarAction({act:'hgApply'});
 g.hangarSession.draft.slots[0]='rail';
 g.baseAction('returnIon','');
 assert.equal(g.weaponProfile.ion,false);
 assert.equal(g.hangarSession.draft.slots[0],'rail','unapplied plan is still available');
 assert.equal(g.hangarSession.draft.slots[1],null);
 assert.equal(g.shipLoadout.slots[0],'plasma','live loadout is unchanged');
});
test('an invalid draft cannot spend alloy or replace live weapons through the actual game adapter',()=>{
 const g=game();g.hangarSession.draft.slots[5]='howitzer';
 g.hangarAction({act:'hgApply'});assert.equal(g.player.ore,400);assert.equal(g.weaponProfile.howitzer,false);
 g.hangarSession.draft.slots[5]=null;g.hangarSession.draft.slots[1]='rail';g.player.ore=35;
 g.hangarAction({act:'hgApply'});assert.equal(g.player.ore,35);assert.equal(g.weaponProfile.rail,0);
});
test('beginning mining or probe repair cancels howitzer preparation immediately',()=>{
 for(const kind of ['mine','repair']){
  const g=game();g.paused=false;g.overlay.hidden=true;g.heavyCharge={remaining:.01};
  g.currentInteraction=()=>({kind,target:{x:0,y:0}});
  assert.equal(g.beginInteraction('keyboard'),true);assert.equal(g.heavyCharge,null);
 }
});
test('the real starter weapon can fire for five minutes without overheating; C, mining and repair stop it',()=>{
 const g=game(),e=target();g.grid.insert(e);battle(g,300);
 assert.ok(g.hits.length>=450&&g.hits.length<=477);assert.ok(g.hits.every(x=>x.damage===18));
 assert.equal(g.weaponThermal.locked,false);assert.equal(g.missiles.length,0);
 for(const mode of ['holdFire','mining','repair']){
  const before=g.hits.length;
  g.holdFire=mode==='holdFire';g.mining.active=mode==='mining';g.probeRepairing=mode==='repair';
  battle(g,5);assert.equal(g.hits.length,before,mode+' must suppress automatic fire');
 }
});
test('a long mixed battle exercises every installed automatic family and remains bounded',()=>{
 const g=game(),e=target();g.skillRanks.rocket=1;
 equip(g,['plasma','rail','flak','rocket','plasma',null]);g.grid.insert(e);
 battle(g,300);const kinds=new Set(g.hits.map(x=>x.kind));
 for(const kind of ['beam','rail','flak','rocket'])assert.ok(kinds.has(kind),kind+' must actually fire');
 assert.ok(g.weaponThermal.current>=0&&g.weaponThermal.current<=100);
 assert.ok(g.flashes.length<=90);assert.ok(g.missiles.length<=14);
});
test('idle guns hold their first shot until a target arrives, then fire without a phantom reload',()=>{
 const beam=game();battle(beam,6);
 assert.equal(beam.hits.length,0);assert.ok(beam.beamClock<=0);
 assert.equal(beam.weaponThermal.current,0);
 beam.grid.insert(target(100));battle(beam,1/60);
 assert.equal(beam.hits.length,1,'a nearby scout should be hit on its first frame');

 const missiles=game();missiles.skillRanks.rocket=1;
 equip(missiles,['rocket',null,null,null,null,null]);battle(missiles,6);
 assert.equal(missiles.missiles.length,0);assert.ok(missiles.rocketClock<=0);
 assert.equal(missiles.weaponThermal.current,0);
 missiles.grid.insert(target(350));battle(missiles,1/60);
 assert.equal(missiles.missiles.length,1,'an equipped rocket should launch immediately');
 assert.ok(missiles.rocketClock>0);
});
test('choosing and mastering a plasma branch in the real hangar changes real beam damage',()=>{
 const g=game();g.activeBases=2;
 g.hangarAction({act:'hgSpec',id:'plasma:furnace'});
 assert.deepEqual(g.shipLoadout.specializations.plasma,{path:'furnace',rank:1});
 assert.equal(g.player.points,19);assert.equal(g.player.ore,400);
 g.hangarAction({act:'hgSpec',id:'plasma:focus'});
 assert.deepEqual(g.shipLoadout.specializations.plasma,{path:'furnace',rank:1});
 assert.equal(g.player.points,19,'choosing the other branch must not spend points');
 g.grid.insert(target(100));battle(g,1/60);
 assert.equal(g.hits.length,1);assert.equal(g.hits[0].damage,22.5);

 g.activeBases=3;g.paused=true;g.overlay.hidden=false;
 g.hangarAction({act:'hgSpec',id:'plasma:furnace'});
 assert.deepEqual(g.shipLoadout.specializations.plasma,{path:'furnace',rank:2});
 assert.equal(g.player.points,18);
});
test('switching to rail removes plasma and rockets from actual combat even with learned rocket ranks',()=>{
 const g=game();g.skillRanks.rocket=3;equip(g,['rail',null,null,null,null,null]);g.grid.insert(target(500));
 battle(g,30);assert.ok(g.hits.length>10);assert.ok(g.hits.every(x=>x.kind==='rail'));
 assert.equal(g.missiles.length,0);
});
test('five plasma modules trigger real thermal blocking and deliver less than five times sustained damage',()=>{
 const single=game(),bank=game();single.grid.insert(target());bank.grid.insert(target());
 equip(bank,['plasma','plasma','plasma','plasma','plasma',null]);
 battle(single,120);battle(bank,120);
 const one=single.hits.reduce((sum,x)=>sum+x.damage,0),five=bank.hits.reduce((sum,x)=>sum+x.damage,0);
 assert.ok(five>one);assert.ok(five<one*3,'shared heat must prevent simple fivefold sustained DPS');
});
