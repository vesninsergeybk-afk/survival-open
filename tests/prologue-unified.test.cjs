// Run: node site/games/survivor/tests/prologue-unified.test.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),source=n=>fs.readFileSync(path.join(root,n),'utf8');
const script=source('src/prologue-mission.js').replace(/^import [^\n]+\n/gm,'').replace('export class PrologueMissionWorld','class PrologueMissionWorld');
class Enemy{constructor(x,y,t){this.x=x;this.y=y;this.hp=t.hp;this.maxHp=t.hp;this.speed=t.speed;this.size=t.size;this.vx=0;this.vy=0;}}
class Weapon{constructor(t){this.id=t.id;this.def=t;}}
const ENEMIES=Object.fromEntries(['BAT','ZOMBIE','STALKER','GOLEM','GUNSHIP'].map(n=>[n,{id:n.toLowerCase(),hp:35,speed:100,size:19}]));
const ui=new Map();
const document={getElementById(id){if(!ui.has(id))ui.set(id,{textContent:'',style:{},setAttribute(){}});return ui.get(id);}};
const window={matchMedia:()=>({matches:false})};
let reward=null;
const Mission=new Function('Enemy','ENEMIES','WEAPONS','Weapon','GameState','drawStationPart','STATION_PARTS','drawTurretMount','drawTurretHead','showMissionVictory','document','window',script+';return PrologueMissionWorld;')(
 Enemy,ENEMIES,{STARTER_PULSE:{id:'starter_pulse'},MAGIC_WAND:{id:'magic_wand'}},Weapon,{MENU:'MENU',PLAYING:'PLAYING'},()=>true,{basic:0},()=>{},()=>{},
 (g,w,result)=>{reward={index:w.index,ok:result.ok}},document,window
);
const player={x:12000,y:8000,size:20,maxHp:110,hp:60,weapons:[new Weapon({id:'starter_pulse'})],
 heal(n){this.hp=Math.min(this.maxHp,this.hp+n);}};
const fb={bases:[{id:'home',hp:180}],credits:0,nextRaidAt:0,
 buy(g,b,item){if(item!=='activate'||!b||b.activated)return{ok:false,message:'unavailable'};b.activated=true;return{ok:true};}};
const game={player,friendlyBases:fb,enemies:[],beams:[],worldVfx:{nova(){},boostCollect(){}},
 audio:{playEvent(){},stopMusic(){}},createFloatingText(){},_announce(){},
 gameTime:0,state:'PLAYING',completeMission(){return{ok:true,firstClear:true,blueprints:[]}},gameOver(){this.state='GAMEOVER';}};
const w=new Mission(game);w.enter(game);
function tick(t=2){game.gameTime+=t;w.update(game,Math.min(.04,t));}
function advance(sec){for(let a=0;a<sec;a+=.1){
 game.gameTime+=.1;w.update(game,.1);kill('siege');
}}
function fly(x,y){player.x=w.cx+x;player.y=w.cy+y;}
function action(id){const d=w.device(id);player.x=d.x;player.y=d.y;
 assert.equal(w.canInteract(game)?.device?.id,id,'device '+id);
 assert.equal(w.interact(game),true,'interact '+id);}
function kill(group){for(const e of game.enemies)if(e.prologueGroup===group)e.hp=0;}
function next(phase,x){tick();fly(x,0);tick();assert.equal(w.phase,phase,'room '+phase);}
assert.equal(player.weapons.length,0,'mission 00 must start without a gun');
assert.equal(w.rooms.length,7);assert.equal(w.wings.length,3);
assert.equal(w.target(game).id,'generator');
action('log-dock');assert.equal(w.logsCollected,1,'crew history is discoverable');
assert.equal(w.target(game).id,'generator','optional lore never locks main quest');
assert.equal(w.doors.length,6);
assert.equal(w.get3DProps().length,51,'51 authored 3D station prop placements');
assert.equal(w.get3DProps().filter(p=>String(p.model).startsWith('q-')).length,22,'Quaternius geometry across all zones');
assert.equal(w.insideWorld(w.cx+1540,w.cy-900,20),true,'observatory is reachable');
assert.equal(w.insideWorld(w.cx+2800,w.cy+1000,20),true,'coolant room is reachable');
assert.equal(w.insideWorld(w.cx+6620,w.cy+1100,20),true,'reactor underworks reachable');
const locked=new Mission({player:{x:12000,y:8000}});
const obj={x:locked.cx+540,y:locked.cy,size:20};locked.constrainEntity(obj,locked.cx+490,locked.cy);
assert.equal(obj.x,locked.cx+490,'closed shutter collision');
fly(-165,-195);
assert.equal(w.canInteract(game),null,'generator must require green repair beam');
assert.equal(w.useRepairBeam(game),true,'repair beam begins a held action');
game.gameTime+=.5;w.updateRepairBeam(game,.5);
assert.equal(w.done('generator'),false,'short press cannot start generator');
w.endRepairBeam();
assert.equal(w.done('generator'),false,'releasing early cancels repair');
assert.equal(w.useRepairBeam(game),true,'hold can restart');
for(let i=0;i<24;i++){game.gameTime+=.1;w.updateRepairBeam(game,.1);}
assert.equal(w.done('generator'),true,'sustained contact starts generator');
action('dock-gate');tick();next(1,940);
action('sentry-a');action('sentry-b');
assert.equal(w.gate(1).target,0,'observation is mandatory');
action('helios');kill('observatory');
for(let i=0;i<7;i++){tick(2);kill('security');kill('reinforcement');}
tick();assert.equal(w.gate(1).target,1,'security complete');
next(2,2340);action('weapon');
assert.equal(player.weapons.some(v=>v.id==='starter_pulse'),true,'first gun is workshop weak pulse');
assert.equal(w.gate(2).target,0,'coolant activation required');
action('coolant');
kill('maintenance');kill('workshop');tick();assert.equal(w.gate(2).target,1,'workshop complete');
next(3,3450);action('relay-a');action('relay-b');
for(let i=0;i<7;i++){tick(2);kill('forge');}
tick();assert.equal(w.gate(3).target,1,'forge complete');
next(4,4790);
fly(5160,-60);assert.equal(w.canInteract(game),null,'damaged computer must be repaired with beam');
assert.equal(w.useRepairBeam(game),true,'terminal beam starts');
assert.equal(w.done('terminal'),false,'terminal never repairs on tap');
for(let i=0;i<28;i++){game.gameTime+=.1;w.updateRepairBeam(game,.1);}
assert.equal(w.done('terminal'),true,'terminal repairs after held contact');
kill('command');tick();
assert.equal(w.gate(4).target,1,'command complete');
next(5,6000);action('heavy-a');action('heavy-b');
assert.equal(w.siegeStarted,false,'defense capacitor is mandatory');
action('capacitor');
assert.equal(w.siegeStarted,false);
tick();assert.equal(w.siegeStarted,true,'backup upload begins');
assert.equal(w.gate(5).target,0,'shutter stays closed during upload');
advance(60);tick(4);
assert.equal(w.uploadProgress,100,'backup reached 100%');
assert.equal(w.heavyTowersOnline,true,'heavy batteries deployed at 100%');
assert.equal(w.gate(5).target,1,'core defended and evac opened');
next(6,7490);action('transmitter');tick(5);
assert.equal(w.victory,true);assert.deepEqual(reward,{index:0,ok:true});
const main=source('src/main.js'),progress=source('src/mission-progression.js'),world=source('src/mission-world.js');
assert.ok(main.includes('new PrologueMissionWorld(this)'),'main must use shared-game director');
assert.ok(main.includes('Number.isInteger(missionIndex)'),'index zero must not be discarded');
assert.ok(main.includes("scenery:this.missionWorld?.index===0?[]:"),'mission 00 keeps light 2D station scenery');
assert.ok(main.includes("this.missionWorld.beginRepairBeam(this)"),'mission 00 has a held keyboard repair input');
assert.ok(main.includes("if(this.missionWorld?.index!==0)updateFieldFinds(this, dt);"),'no random field pickups in prologue');
assert.ok(main.includes("this.missionWorld.done('weapon')))this.dropExp"),'no early XP before first gun');
assert.ok(world.includes('index===0'),'mission zero must be designed');
assert.ok(progress.includes("[0, 'Последний сигнал'"),'mission zero catalog entry required');
assert.ok(main.includes("get('mission')==='0'"),'direct mission 00 entry required');
assert.ok(source('prologue/index.html').includes("location.replace('../?mission=0')"),'legacy URL must redirect into main game');
const engineURL=source('index.html').match(/import \{ boot \} from '(\.\/src\/main\.js\?v=[^']+)'/);
assert.ok(engineURL,'main page must load a versioned shared engine');
assert.ok(source('service-worker.js').includes(engineURL[1]),'offline install must include the same shared engine');

const lab=source('../../lab/index.html');
assert.ok(lab.includes('href="/games/survivor/?mission=0"'),'laboratory launches unified prologue');
assert.ok(!lab.includes('/games/survivor/?v=space-1'),'laboratory has no obsolete build query');
const repairUI=source('src/mission-world.js');
assert.ok(repairUI.includes("addEventListener('pointerdown'"),'mobile repair uses press-and-hold');
assert.ok(repairUI.includes('repairPointer'),'repair tracks its own pointer separately from movement');
console.log('PASS: Mission 00 story, initial repair-only ship, first workshop weapon, upload, 10 areas, 51 props, victory');

