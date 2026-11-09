import test from 'node:test';
import assert from 'node:assert/strict';
import {createMouseArsenal,cometSpec,minesSpec,planMouseWeapon,fireMouseWeapon,
 updateMouseArsenal,drawMouseArsenal} from '../mouse-arsenal.js';

function scene(){
 const enemies=[];
 const game={time:0,player:{x:0,y:0,hp:100},skillRanks:{},
  overlay:{hidden:true},dead:false,paused:false,
  enemies,mouseArsenal:createMouseArsenal(),
  world:{regionalSupply:{convoys:[]},nearbyStations:()=>[],stations:new Map()},
  grid:{query(x,y,r){return enemies.filter(e=>e.hp>0&&Math.hypot(e.x-x,e.y-y)<=r);}},
  rockGrid:{query:()=>[]},enemyBasesUnlocked:()=>true,
  damageEnemy(e,damage){e.hp-=damage;},weaponHit(){},
  playedSounds:[],heritage:{play(kind){game.playedSounds.push(kind);},vfx:{nova(){}}}
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

test('comet core path increases central damage but preserves the weaker edge and nearby allies',()=>{
 const run=rank=>{
  const g=scene(),center=scout(300,0,200),edge=scout(404,0,200),friend=scout(305,0,200);
  friend.converted=true;g.enemies.push(center,edge,friend);g.skillRanks.cometCore=rank;
  fireMouseWeapon(g,'comet',{x:300,y:0});g.time=.6;updateMouseArsenal(g,.6);
  return {center:200-center.hp,edge:200-edge.hp,friend:friend.hp,modifier:g.mouseArsenal.bursts[0].modifier};
 };
 const base=run(0),focused=run(2);
 assert.ok(focused.center>base.center*1.4,'the center becomes a useful anti-heavy strike');
 assert.equal(focused.edge,base.edge,'the outer rim keeps the baseline damage');
 assert.equal(focused.friend,200,'a manual specialization cannot damage converted allies');
 assert.equal(focused.modifier,'core','the active branch is visible in the blast');
});

test('cryo comet slows only surviving enemies and shows a distinct effect',()=>{
 const g=scene(),foe=scout(300,0,200),ally=scout(311,0,200);
 ally.converted=true;g.enemies.push(foe,ally);g.skillRanks.cometCryo=2;
 fireMouseWeapon(g,'comet',{x:300,y:0});g.time=.6;updateMouseArsenal(g,.6);
 assert.equal(foe.tacticalSlowFactor,.52);
 assert.ok(Math.abs(foe.tacticalSlowUntil-3.8)<.01);
 assert.equal(ally.tacticalSlowUntil,undefined);
 assert.equal(g.mouseArsenal.bursts[0].modifier,'cryo');
});

test('mine specializations separately reward heavy-target damage or controlling live enemies',()=>{
 const fire=rank=>{
  const g=scene(),heavy={...scout(300,0,400),type:'gunship'},ordinary=scout(300,0,400);
  g.skillRanks=rank;g.enemies.push(heavy,ordinary);
  fireMouseWeapon(g,'mines',{x:300,y:0});g.time=1;updateMouseArsenal(g,1);
  g.time=1.8;updateMouseArsenal(g,.05);
  return {heavy,ordinary,bursts:g.mouseArsenal.bursts};
 };
 const standard=fire({}),pierce=fire({minePierce:2}),snare=fire({mineSnare:2});
 assert.ok(400-pierce.heavy.hp>(400-standard.heavy.hp)*1.45);
 assert.ok(Math.abs((400-pierce.ordinary.hp)-(400-standard.ordinary.hp))<.01,
  'armor bonus must not increase damage against ordinary scouts');
 assert.equal(snare.ordinary.tacticalSlowFactor,.42);
 assert.ok(snare.ordinary.tacticalSlowUntil>3);
 assert.ok(snare.bursts.some(b=>b.modifier==='snare'));
 assert.ok(pierce.bursts.some(b=>b.modifier==='pierce'));
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

test('a rock between ship and target does not prematurely detonate the arcing comet',()=>{
 const g=scene(),behind=scout(300,0,60);
 g.enemies.push(behind);
 const cover={x:160,y:0,r:38,alive:true};g.rockGrid.query=()=>[cover];
 assert.equal(fireMouseWeapon(g,'comet',{x:300,y:0}).ok,true);
 g.time=.65;updateMouseArsenal(g,.65);
 assert.equal(behind.hp,25,'the blast arrives at the selected point beyond the rock');
 assert.equal(g.mouseArsenal.projectiles.length,0);
});

test('comet warns before a landing inside an asteroid without consuming cooldown',()=>{
 const g=scene(),rock={x:300,y:0,r:40,alive:true};g.rockGrid.query=()=>[rock];
 assert.match(planMouseWeapon(g,'comet',{x:300,y:0}).reason,/астероидом/);
 assert.equal(fireMouseWeapon(g,'comet',{x:300,y:0}).ok,false);
 assert.equal(g.mouseArsenal.cometReadyAt,0);
 assert.equal(fireMouseWeapon(g,'comet',{x:400,y:0}).ok,true);
});

test('a rock partly shields a target from a comet blast instead of cancelling all damage',()=>{
 const fire=withRock=>{
  const g=scene(),foe=scout(350,0,200);
  g.enemies.push(foe);
  g.rockGrid.query=()=>withRock?[{x:310,y:0,r:34,alive:true}]:[];
  assert.equal(fireMouseWeapon(g,'comet',{x:260,y:0}).ok,true);
  g.time=.6;updateMouseArsenal(g,.6);
  return 200-foe.hp;
 };
 const open=fire(false),sheltered=fire(true);
 assert.ok(sheltered>0&&sheltered<open);
 assert.ok(Math.abs(sheltered/open-.6)<.01);
});

test('mine pods cross rocks and occupy only clear landing sites',()=>{
 const g=scene(),travelRock={x:145,y:0,r:38,alive:true};
 g.rockGrid.query=()=>[travelRock];
 const plan=planMouseWeapon(g,'mines',{x:300,y:0});
 assert.equal(plan.ok,true);
 fireMouseWeapon(g,'mines',{x:300,y:0});
 g.time=1;updateMouseArsenal(g,1);
 assert.equal(g.mouseArsenal.mines.length,4,'intermediate rocks do not destroy pods');
 for(let i=0;i<plan.sites.length;i++){
  assert.ok(Math.hypot(g.mouseArsenal.mines[i].x-plan.sites[i].x,
   g.mouseArsenal.mines[i].y-plan.sites[i].y)<.001);
 }
});

test('mine aiming relocates pods around a landing rock and rejects an impassable area',()=>{
 const g=scene(),rock={x:300,y:0,r:43,alive:true};
 g.rockGrid.query=()=>[rock];
 const plan=planMouseWeapon(g,'mines',{x:300,y:0});
 assert.equal(plan.ok,true);
 assert.ok(plan.sites.every(s=>Math.hypot(s.x-rock.x,s.y-rock.y)>=rock.r+12));
 fireMouseWeapon(g,'mines',{x:300,y:0});g.time=1;updateMouseArsenal(g,1);
 assert.equal(g.mouseArsenal.mines.length,4);
 assert.ok(g.mouseArsenal.mines.every(s=>Math.hypot(s.x-rock.x,s.y-rock.y)>=rock.r+12));
 const blocked=scene(),giant={x:300,y:0,r:240,alive:true};
 blocked.rockGrid.query=()=>[giant];
 assert.equal(fireMouseWeapon(blocked,'mines',{x:300,y:0}).ok,false);
 assert.equal(blocked.mouseArsenal.minesReadyAt,0);
});

test('pods adjust if an asteroid drifts into their landing sites during flight',()=>{
 const g=scene(),drifter={x:700,y:700,r:35,alive:true};
 g.rockGrid.query=()=>[drifter];
 const plan=planMouseWeapon(g,'mines',{x:300,y:0});
 fireMouseWeapon(g,'mines',{x:300,y:0});
 drifter.x=plan.sites[0].x;drifter.y=plan.sites[0].y;
 g.time=1;updateMouseArsenal(g,1);
 assert.equal(g.mouseArsenal.mines.length,4);
 assert.ok(g.mouseArsenal.mines.every(s=>Math.hypot(s.x-drifter.x,s.y-drifter.y)>=drifter.r+12));
});

test('aim preview marks blocked rail fire and asteroid-occupied landing points',()=>{
 const g=scene(),labels=[],arcs=[];
 const ctx=new Proxy({fillText(label){labels.push(label);},arc(x,y,r){arcs.push([x,y,r]);}},
  {get(target,key){return target[key]??(()=>{});}});
 g.rockGrid.query=()=>[{x:160,y:0,r:40,alive:true}];
 g.mouseAim={kind:'rail',point:{x:500,y:0}};
 drawMouseArsenal(ctx,g);
 assert.ok(labels.some(text=>text.includes('ЛУЧ ПЕРЕКРЫТ')));
 assert.ok(arcs.some(([x])=>x<200),'the impact marker must be on the rock, not the cursor');
 labels.length=0;
 g.mouseAim={kind:'comet',point:{x:160,y:0}};
 drawMouseArsenal(ctx,g);
 assert.ok(labels.some(text=>text.includes('МЕШАЮТ АСТЕРОИДЫ')));
 labels.length=0;
 g.mouseAim={kind:'howitzer',point:{x:160,y:0}};
 drawMouseArsenal(ctx,g);
 assert.ok(labels.some(text=>text.includes('ТОЧКА ЗАНЯТА')));
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

test('manual weapons play individual recorded cues for launch, impact and one mine arming',()=>{
 const g=scene();
 fireMouseWeapon(g,'comet',{x:300,y:0});
 assert.deepEqual(g.playedSounds,['cometLaunch']);
 g.time=.6;updateMouseArsenal(g,.6);
 assert.deepEqual(g.playedSounds,['cometLaunch','cometBurst']);
 fireMouseWeapon(g,'mines',{x:350,y:0});
 assert.equal(g.playedSounds.at(-1),'mineLaunch');
 g.time=1.3;updateMouseArsenal(g,.7);
 assert.equal(g.playedSounds.filter(s=>s==='mineArm').length,0);
 g.time=2.1;updateMouseArsenal(g,.8);
 assert.equal(g.playedSounds.filter(s=>s==='mineArm').length,1,
  'the entire array must arm as one salvo instead of playing four ticks');
 g.time=2.5;updateMouseArsenal(g,.4);
 assert.equal(g.playedSounds.filter(s=>s==='mineArm').length,1);
 const mine=g.mouseArsenal.mines[0];g.enemies.push(scout(mine.x,mine.y,95));
 g.time=2.7;updateMouseArsenal(g,.2);
 assert.ok(g.playedSounds.includes('mineBurst'),'the first triggered mine needs its own impact');
});

test('specialization accents sound only when their combat effect actually hits',()=>{
 const comet=(rank,hit=true)=>{
  const g=scene();g.skillRanks=rank;
  if(hit)g.enemies.push(scout(300,0,200));
  fireMouseWeapon(g,'comet',{x:300,y:0});g.time=.6;updateMouseArsenal(g,.6);
  return g.playedSounds;
 };
 assert.ok(comet({cometCore:1}).includes('cometCoreAccent'));
 assert.ok(!comet({cometCore:1},false).includes('cometCoreAccent'));
 assert.ok(comet({cometCryo:1}).includes('cometCryoAccent'));
 assert.ok(!comet({cometCryo:1},false).includes('cometCryoAccent'));
 const mine=(rank,type)=>{
  const g=scene();g.skillRanks=rank;
  if(type)g.enemies.push({...scout(300,0,400),type});
  fireMouseWeapon(g,'mines',{x:300,y:0});g.time=1;updateMouseArsenal(g,1);
  g.time=1.8;updateMouseArsenal(g,.8);
  return g.playedSounds;
 };
 assert.ok(mine({minePierce:1},'gunship').includes('minePierceAccent'));
 assert.ok(!mine({minePierce:1},'scout').includes('minePierceAccent'));
 assert.ok(mine({mineSnare:1},'scout').includes('mineSnareAccent'));
 assert.ok(!mine({mineSnare:1},null).includes('mineSnareAccent'));
});

test('comet and mine explosions expose distinct visual phases without relying on audio',()=>{
 const g=scene(),circles=[],lines=[];
 const c=new Proxy({arc(x,y,r){circles.push(r);},stroke(){lines.push(1);}},
  {get(target,key){return target[key]??(()=>{});}});
 fireMouseWeapon(g,'comet',{x:100,y:0});g.time=.2;updateMouseArsenal(g,.2);
 drawMouseArsenal(c,g);
 assert.ok(lines.length>=2,'flying comet has a layered visible trail');
 g.time=.4;updateMouseArsenal(g,.2);drawMouseArsenal(c,g);
 assert.ok(circles.some(r=>r>12),'the blast has rings beyond the projectile core');
});

test('comet blast retains shards at 18 FPS without expensive shadows',()=>{
 const g=scene(),strokes=[],lines=[];
 g.fps=18;g.visuals={reducedMotion:false};
 const ctx=new Proxy({stroke(){strokes.push(1);},lineTo(x,y){lines.push([x,y]);}},
  {get(target,key){return target[key]??(()=>{});}});
 g.mouseArsenal.bursts.push({x:0,y:0,kind:'comet',radius:90,age:.12});
 drawMouseArsenal(ctx,g);
 assert(strokes.length>=5,'low FPS should retain shock rings and three fragments');
 assert(lines.length>=3,'explosion fragments must not disappear at 18 FPS');
});
