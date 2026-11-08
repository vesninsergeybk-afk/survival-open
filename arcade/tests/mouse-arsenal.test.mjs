import test from 'node:test';
import assert from 'node:assert/strict';
import {createMouseArsenal,cometSpec,minesSpec,planMouseWeapon,fireMouseWeapon,
 updateMouseArsenal} from '../mouse-arsenal.js';

function scene(){
 const enemies=[];
 const game={time:0,player:{x:0,y:0,hp:100},skillRanks:{},
  overlay:{hidden:true},dead:false,paused:false,
  enemies,mouseArsenal:createMouseArsenal(),
  world:{regionalSupply:{convoys:[]},nearbyStations:()=>[],stations:new Map()},
  grid:{query(x,y,r){return enemies.filter(e=>e.hp>0&&Math.hypot(e.x-x,e.y-y)<=r);}},
  rockGrid:{query:()=>[]},enemyBasesUnlocked:()=>true,
  damageEnemy(e,damage){e.hp-=damage;},weaponHit(){},
  heritage:{play(){},vfx:{nova(){}}}
 };
 return game;
}
const scout=(x,y,hp=28)=>({x,y,hp,maxHp:hp,r:14,type:'scout'});

test('comet uses a real moving projectile and damages multiple ships at arrival, not at click',()=>{
 const g=scene(),center=scout(300,0),edge=scout(375,0),outside=scout(480,0);
 g.enemies.push(center,edge,outside);
 assert.equal(planMouseWeapon(g,'comet',{x:671,y:0}).ok,false);
 assert.equal(fireMouseWeapon(g,'comet',{x:300,y:0}).ok,true);
 assert.equal(center.hp,28,'selecting a circle must not deal immediate damage');
 assert.equal(g.mouseArsenal.projectiles.length,1);
 g.time=.24;updateMouseArsenal(g,.24);
 assert.equal(center.hp,28,'the cyan projectile must still be in flight');
 g.time=.6;updateMouseArsenal(g,.36);
 assert.ok(center.hp<=0,'the center of the blast destroys a scout');
 assert.ok(edge.hp<28&&edge.hp>center.hp,'damage falls off toward the outer edge');
 assert.equal(outside.hp,28,'the blast does not damage ships outside the radius');
 assert.equal(fireMouseWeapon(g,'comet',{x:300,y:0}).ok,false,'cooldown stops instant repeat fire');
});
test('comet is useful against micro-drone formations without farming parasite capture',()=>{
 const g=scene();g.skillRanks.capture=1;
 for(let i=0;i<10;i++){
  const e=scout(300+(i%5-2)*17,(Math.floor(i/5)-.5)*20,12);
  e.r=6.5;e.microSwarm=true;g.enemies.push(e);
 }
 assert.equal(fireMouseWeapon(g,'comet',{x:300,y:0}).ok,true);
 g.time=.6;updateMouseArsenal(g,.6);
 assert.ok(g.enemies.every(e=>e.hp<=0),'one well-placed blast clears a packed swarm');
 assert.equal(g.designatedTarget,undefined,'micro drones cannot become parasite captives');
});

test('radius and mine count upgrades have a bounded, observable effect',()=>{
 assert.equal(cometSpec({}).radius,90);
 assert.equal(cometSpec({cometRadius:1}).radius,107);
 assert.equal(cometSpec({cometRadius:2}).radius,124);
 assert.equal(cometSpec({cometRadius:200}).radius,124,'the splash cannot grow forever');
 assert.equal(minesSpec({}).count,4);
 assert.equal(minesSpec({mineArray:2}).count,6);
 assert.equal(minesSpec({mineArray:100}).count,6);
});

test('mine pods fly into a real fan, arm before triggering and cannot fill the map indefinitely',()=>{
 const g=scene();g.skillRanks.mineArray=2;
 assert.equal(fireMouseWeapon(g,'mines',{x:300,y:0}).count,6);
 assert.equal(g.mouseArsenal.mines.length,0,'pods have not arrived yet');
 g.time=1;updateMouseArsenal(g,1);
 assert.equal(g.mouseArsenal.mines.length,6);
 const mine=g.mouseArsenal.mines[0];
 const enemy=scout(mine.x,mine.y,70);g.enemies.push(enemy);
 assert.equal(enemy.hp,70,'a fresh mine does not explode until it arms');
 g.time=1.4;updateMouseArsenal(g,.4);
 assert.equal(enemy.hp,70,'mine arming delay prevents accidental instant traps');
 g.time=1.8;updateMouseArsenal(g,.4);
 assert.ok(enemy.hp<70,'a ship crossing an armed mine receives damage');
 assert.ok(g.mouseArsenal.mines.length<6,'a triggered mine disappears');
 g.time=18;
 assert.equal(fireMouseWeapon(g,'mines',{x:330,y:0}).ok,true);
 assert.equal(g.mouseArsenal.mines.length,0,'the next volley replaces the previous field');
});

test('comet tags only a legitimate enemy for the parasite, never nearby workers or friendly ships',()=>{
 const g=scene();g.skillRanks.capture=1;
 const worker=scout(310,0,80);worker.centralWorker=true;
 const foe=scout(300,0,60);
 const friendly=scout(305,4,40);friendly.converted=true;
 g.enemies.push(worker,foe,friendly);
 g.world.regionalSupply.central={worker};
 g.world.stations.set('industry:source',{enemy:true});
 assert.equal(fireMouseWeapon(g,'comet',{x:300,y:0}).ok,true);
 g.time=.6;updateMouseArsenal(g,.6);
 assert.equal(g.designatedTarget?.target,foe,'the blast primes the eligible nearby hostile');
 assert.equal(worker.hp,80,'an area attack cannot silently strike industrial workers');
 assert.equal(friendly.hp,40,'a converted ally is immune to area damage');
});

test('manually aimed explosions can hit an unconfirmed patrol without targeting friendly workers',()=>{
 const g=scene(),investigating=scout(300,0,75);
 investigating.signalIntel={mode:'investigate'};
 g.enemies.push(investigating);
 assert.equal(fireMouseWeapon(g,'comet',{x:300,y:0}).ok,true);
 g.time=.6;updateMouseArsenal(g,.6);
 assert.ok(investigating.hp<75,'physical area damage must not inherit auto-target sensor restrictions');
});

test('a rock intercepts the projectile, and solid cover protects enemies from the blast',()=>{
 const g=scene(),behind=scout(300,0,60);
 g.enemies.push(behind);
 const cover={x:160,y:0,r:38,alive:true};g.rockGrid.query=()=>[cover];
 assert.equal(fireMouseWeapon(g,'comet',{x:300,y:0}).ok,true);
 g.time=.65;updateMouseArsenal(g,.65);
 assert.equal(behind.hp,60,'the impact explodes at the rock, not through it');
 assert.equal(g.mouseArsenal.projectiles.length,0);
});

test('a paused game cannot aim or fire mouse weapons, and mines still have independent cooldowns',()=>{
 const g=scene();g.paused=true;
 assert.equal(planMouseWeapon(g,'comet',{x:250,y:0}).ok,false);
 g.paused=false;
 assert.equal(fireMouseWeapon(g,'comet',{x:250,y:0}).ok,true);
 assert.equal(fireMouseWeapon(g,'mines',{x:250,y:0}).ok,true,
  'the two active weapon slots have separate cooldowns');
 assert.equal(fireMouseWeapon(g,'mines',{x:250,y:0}).ok,false);
});
