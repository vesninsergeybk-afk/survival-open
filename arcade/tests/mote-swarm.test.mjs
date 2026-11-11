import test from 'node:test';
import assert from 'node:assert/strict';
import {MOTE_SWARM,moteVolleyCooldown,updateMoteSwarmOrders,moveMote,drawMoteSwarms} from '../mote-swarm.js';
import {updateEnemy} from '../ai.js';
import {enemySalvage,enemyDataReward} from '../combat-rewards.js';
import {rewardEyeKill} from '../field-loot.js';
import {enemyFieldReward} from '../field-evolution.js';
import {game as actualGame} from './weapons-scene.mjs';
import {openingThreat} from '../balance.js';
import {availableEncounters} from '../encounters.js';

const drones=(count,pack=7)=>Array.from({length:count},(_,i)=>({
 type:'scout',serial:i+1,group:pack,motePack:pack,moteRoot:pack,moteSpawnedAt:95,
 microSwarm:true,x:290+i%5*6,y:20+Math.floor(i/5)*6,vx:0,vy:0,
 r:MOTE_SWARM.radius,hp:MOTE_SWARM.hp,maxHp:MOTE_SWARM.hp,
 damage:MOTE_SWARM.damage,stasisUntil:0,
 angle:0,fire:0,hit:0,moteApproach:{x:0,y:0}
}));
const scene=(enemies,time=100)=>({enemies,time,groupSerial:7,
 player:{x:0,y:0,hp:100,vx:0,vy:0},avoidance:()=>({x:0,y:0}),
 enemyCanSee:()=>true,shots:[],enemyShot(x,y,tx,ty,damage){
  this.shots.push({x,y,tx,ty,damage});return true;
 }});

test('единый рой расходится на два фланга и позже вновь собирается вместе',()=>{
 const game=scene(drones(10));
 updateMoteSwarmOrders(game);
 assert.equal(new Set(game.enemies.map(e=>e.motePack)).size,2);
 assert.ok(game.enemies.every(e=>Number.isFinite(e.moteOrder.x)));
 assert.ok(game.enemies.every(e=>e.motePackCount===5));
 const previous=game.enemies.map(e=>e.motePack);
 game.time=104;updateMoteSwarmOrders(game);
 assert.deepEqual(game.enemies.map(e=>e.motePack),previous,'no oscillating merge during flank manoeuvre');
 game.time=109;updateMoteSwarmOrders(game);
 assert.equal(new Set(game.enemies.map(e=>e.motePack)).size,1);
 assert.ok(game.enemies.every(e=>e.hp===MOTE_SWARM.hp),'split/merge never heals or duplicates a ship');
});

test('группа сохраняет общий приказ, даже если уцелели всего два дрона',()=>{
 const game=scene(drones(2),109);
 updateMoteSwarmOrders(game);
 assert.equal(new Set(game.enemies.map(e=>e.motePack)).size,1);
 for(const e of game.enemies){
  const before={x:e.x,y:e.y};
  updateEnemy(e,game,.1);
  assert.ok(Math.hypot(e.x-before.x,e.y-before.y)>0);
  assert.equal(e.moteLeader,e.serial===1);
 }
});

test('one group uses one warned volley rather than a bullet per drone',()=>{
 const game=scene(drones(7),101);
 updateMoteSwarmOrders(game);
 assert.equal(game.shots.length,0);
 game.time=103;updateMoteSwarmOrders(game);
 assert.equal(game.shots.length,0,'firing must display a warning first');
 game.time=103.6;updateMoteSwarmOrders(game);
 assert.equal(game.shots.length,1);
 game.time=103.95;updateMoteSwarmOrders(game);
 assert.equal(game.shots.length,1,'the whole pack shares one cooldown');
});

test('swarm arrival, splitting, regrouping and attack warning have distinct one-off cues',()=>{
 const game=scene(drones(10)),sounds=[];
 game.heritage={play(kind){sounds.push(kind);}};
 game.camera=()=>({x:100,y:-100,w:500,h:400});
 updateMoteSwarmOrders(game);
 assert.equal(sounds.filter(x=>x==='swarmArrival').length,1);
 assert.equal(sounds.filter(x=>x==='swarmSplit').length,1);
 assert.equal(game.moteFormationFx?.[0]?.kind,'split');
 game.time=104;updateMoteSwarmOrders(game);
 assert.equal(sounds.filter(x=>x==='swarmArrival').length,1,'split packs are not announced twice');
 game.time=109;updateMoteSwarmOrders(game);
 assert.equal(sounds.filter(x=>x==='swarmMerge').length,1);
 assert.ok(game.moteFormationFx.some(f=>f.kind==='merge'));
 const warningGame=scene(drones(3),101),warnings=[];
 warningGame.heritage={play(kind){warnings.push(kind);}};
 updateMoteSwarmOrders(warningGame);
 warningGame.time=103;updateMoteSwarmOrders(warningGame);
 warningGame.time=103.2;updateMoteSwarmOrders(warningGame);
 assert.equal(warnings.filter(x=>x==='swarmWarning').length,1,
  'the warning is attached to the shared volley, not to each member or update');
 const words=[];
 const c=new Proxy({fillText(label){words.push(label);}},
  {get(target,key){return target[key]??(()=>{});}});
 drawMoteSwarms(c,game.enemies,game.camera(),109.3,true,[{x:310,y:23,kind:'merge',bornAt:109}]);
 assert.ok(words.includes('РОЙ ОБЪЕДИНЯЕТСЯ'));
});

test('swarm formation events outside the camera do not make distracting sounds',()=>{
 const game=scene(drones(10)),sounds=[];
 game.heritage={play(kind){sounds.push(kind);}};
 game.camera=()=>({x:1900,y:1900,w:500,h:400});
 updateMoteSwarmOrders(game);
 assert.equal(sounds.length,0);
 assert.equal(game.moteFormationFx.length,0);
});

test('first visible micro-drone pack shows its area-weapon hint once, even if the leader is offscreen',()=>{
 const group=drones(4),leader=group[0];
 leader.encounterLabel='РОЙ МИКРОДРОНОВ · используйте комету или мины';
 const words=[];
 const c=new Proxy({fillText(value){words.push(value);}},
  {get(target,key){return target[key]??(()=>{});}});
 const distant={x:-500,y:-500,w:100,h:100};
 drawMoteSwarms(c,group,distant,99,true);
 assert.equal(leader.encounterLabelStart,undefined,'offscreen encounter does not waste hint time');
 // The leader stays outside but its group enters the viewport.
 leader.x=500;
 const visible={x:200,y:-10,w:150,h:100};
 drawMoteSwarms(c,group,visible,100,true);
 assert.equal(leader.encounterLabelStart,100);
 assert.ok(words.includes(leader.encounterLabel),'the swarm must actually paint its tactical hint');
 words.length=0;
 drawMoteSwarms(c,group,visible,104,true);
 assert.ok(!words.includes(leader.encounterLabel),'the cue must not obscure the fight indefinitely');
});

test('no firing through blocked sight, and frozen members respect stasis',()=>{
 const game=scene(drones(3),102);
 game.enemyCanSee=()=>false;
 updateMoteSwarmOrders(game);
 game.time=109;updateMoteSwarmOrders(game);
 assert.equal(game.shots.length,0);
 const e=game.enemies[0];e.stasisUntil=115;
 e.moteOrder={x:120,y:40};const x=e.x;
 updateEnemy(e,game,.1);
 assert.equal(e.x,x,'motes respect the same station stasis as other enemies');
});

test('micro drones yield two XP but no scrap or parasite/buff farming',()=>{
 const e=drones(1)[0];e.hp=0;
 assert.equal(enemyDataReward(e),2);
 assert.equal(enemySalvage(e),0);
 const game={time:100,fieldLoot:{kills:0},fieldEvolution:{charge:0,kills:0},
  skillRanks:{parasite:1},enemies:[e],player:{x:0,y:0},addDrop(){throw Error('unexpected reward');}};
 assert.equal(rewardEyeKill(game,e,true),null);
 assert.equal(enemyFieldReward(game,e,true).core,false);
});

test('movement remains bounded under low FPS and does not teleport between formations',()=>{
 const game=scene(drones(1),109),e=game.enemies[0];
 e.moteOrder={x:0,y:0};moveMote(e,game,.05);
 assert.ok(Math.hypot(e.vx,e.vy)<=MOTE_SWARM.speed);
 assert.ok(Math.hypot(e.x-290,e.y-20)<12);
});

test('the actual spawn path creates small scout ships with one shared pack',()=>{
 const g=actualGame();g.vw=1200;g.vh=800;g.time=110;g.lastEncounter='';
 const director=openingThreat(110,3);
 const index=availableEncounters(110,director,2,11).indexOf('motes');
 const choice=(index+.25)/availableEncounters(110,director,2,11).length;
 const rng=Math.random;let calls=0;
 Math.random=()=>[.2,.5,choice][calls++]??.3;
 try{g.spawnGroup(director);}finally{Math.random=rng;}
 assert.equal(g.enemies.length,6);
 assert.ok(g.enemies.every(e=>e.microSwarm&&e.r===MOTE_SWARM.radius&&e.hp<20));
 assert.equal(new Set(g.enemies.map(e=>e.motePack)).size,1);
 assert.ok(g.enemies.every(e=>e._patrolRoute&&e.moteApproach===e._patrolRoute),
  'a routine swarm must have a traffic route, not omniscient player tracking');
});

test('a kill contract credits only a fully defeated collective, exactly once',()=>{
 const g=actualGame(),swarm=drones(4);
 g.enemies=swarm;let credited=0;g.advanceContract=()=>{credited++;};
 swarm[0].hp=0;
 assert.equal(g.creditContractKill(swarm[0]),false);
 for(const e of swarm)e.hp=0;
 for(const e of swarm)g.creditContractKill(e);
 assert.equal(credited,1);
});

test('two full packs coordinate flanks without merging or doubling hull health',()=>{
 const a=drones(10,7),b=drones(10,8);
 for(const e of a){e.moteOriginCount=10;e.moteReformUntil=200;}
 for(const e of b){e.serial+=10;e.x+=115;e.moteOriginCount=10;e.moteReformUntil=200;}
 const game=scene([...a,...b]);
 updateMoteSwarmOrders(game);
 assert.equal(new Set(game.enemies.map(e=>e.motePack)).size,2);
 assert.ok(game.enemies.every(e=>e.moteAllianceSize===2));
 assert.equal(new Set(game.enemies.map(e=>e.moteAllianceKey)).size,1);
 assert.ok(game.enemies.every(e=>e.hp===MOTE_SWARM.hp));
 assert.equal(new Set(game.enemies.map(e=>e.moteRoot)).size,2);
});

test('the flank radio call matches the wing’s actual left or right manoeuvre',()=>{
 const a=drones(8,7),b=drones(8,8);
 for(const e of a){e.moteFlank=-1;e.moteReformUntil=200;}
 for(const e of b){e.serial+=8;e.x+=115;e.moteFlank=1;e.moteReformUntil=200;}
 const game=scene([...a,...b]);updateMoteSwarmOrders(game);
 game.time=104;updateMoteSwarmOrders(game);
 assert.ok(a.every(e=>e.moteStatusCue==='ОБХОД СЛЕВА'));
 assert.ok(b.every(e=>e.moteStatusCue==='ОБХОД СПРАВА'));
});

test('two intact ten-drone wings physically combine into one twenty-drone wing',()=>{
 const a=drones(10,7),b=drones(10,8);
 for(const e of a)e.x=790+e.serial*2;
 for(const e of b){e.serial+=10;e.x=880+e.serial*2;}
 const game=scene([...a,...b]);game.groupSerial=20;
 game.enemyCanSee=()=>false;
 updateMoteSwarmOrders(game);
 assert.equal(new Set(game.enemies.map(e=>e.motePack)).size,1,
  'the former ten-member merger ceiling must be removed');
 assert.ok(game.enemies.every(e=>e.motePackCount===20));
 assert.equal(new Set(game.enemies.map(e=>e.moteRoot)).size,2,
  'physical fusion must preserve each original group for contracts and couriers');
 assert.ok(game.enemies.every(e=>e.hp===MOTE_SWARM.hp));
});

test('three adjacent wings can grow into a thirty-member formation over successive regroupings',()=>{
 const sets=[7,8,9].map((id,slot)=>drones(10,id).map(e=>({
  ...e,serial:e.serial+slot*10,x:760+slot*95+e.serial,y:15
 })));
 const game=scene(sets.flat());game.groupSerial=30;game.enemyCanSee=()=>false;
 updateMoteSwarmOrders(game);
 game.time=105;updateMoteSwarmOrders(game);
 assert.equal(new Set(game.enemies.map(e=>e.motePack)).size,1);
 assert.ok(game.enemies.every(e=>e.motePackCount===30));
 const xs=game.enemies.map(e=>e.moteOrder.x),ys=game.enemies.map(e=>e.moteOrder.y);
 assert.ok(Math.max(...xs)-Math.min(...xs)<180&&Math.max(...ys)-Math.min(...ys)<180,
  'large units require a compact lattice, not an endlessly growing three-column tail');
});

test('a twenty-drone group divides into two stable attack flanks without recursive fragmentation',()=>{
 const a=drones(10,7),b=drones(10,8);
 for(const e of a)e.x=785+e.serial;
 for(const e of b){e.serial+=10;e.x=875+e.serial;}
 const game=scene([...a,...b]);game.groupSerial=20;
 game.enemyCanSee=()=>false;updateMoteSwarmOrders(game);
 assert.equal(new Set(game.enemies.map(e=>e.motePack)).size,1);
 game.enemyCanSee=()=>true;game.player.x=830;game.time=105;
 updateMoteSwarmOrders(game);
 assert.equal(new Set(game.enemies.map(e=>e.motePack)).size,2);
 const sides=new Set(game.enemies.map(e=>e.moteFlank));
 assert.deepEqual(sides,new Set([-1,1]));
 const [left,right]=[-1,1].map(flank=>game.enemies.filter(e=>e.moteFlank===flank));
 const axis=left[0].moteFlankAxis;
 assert.deepEqual(axis,right[0].moteFlankAxis,'both wings need one common approach axis');
 const lateral=members=>members.reduce((n,e)=>n+
  (-axis.y*e.moteOrder.x+axis.x*e.moteOrder.y),0)/members.length;
 assert.ok(Math.abs(lateral(left)-lateral(right))>150,
  'opposite attack flanks must actually diverge on a shared lateral axis');
 for(const e of game.enemies)e.x+=e.moteFlank*300;
 game.time=114;updateMoteSwarmOrders(game);
 assert.equal(new Set(game.enemies.map(e=>e.motePack)).size,2,
  'existing attack wings must not divide into ever smaller groups every cooldown');
});

test('reinforcement wings can divide for a real attack after their initial entrance manoeuvre',()=>{
 const members=drones(8,7);
 for(const e of members){
  e.moteFlank=1;e.moteReformUntil=101;e.moteSpawnedAt=95;
  e.moteCallUsed=true;e.moteOriginCount=8;
 }
 const game=scene(members,102);game.groupSerial=20;
 updateMoteSwarmOrders(game);
 assert.equal(new Set(members.map(e=>e.motePack)).size,2,
  'an inherited entrance flank cannot permanently disable future attack formations');
});

test('a combined wing disperses against observed missiles without learning a hidden player position',()=>{
 const a=drones(10,7),b=drones(10,8);
 for(const e of a)e.x=775+e.serial;
 for(const e of b){e.serial+=10;e.x=875+e.serial;}
 const game=scene([...a,...b]);game.groupSerial=20;
 game.enemyCanSee=()=>false;updateMoteSwarmOrders(game);
 game.missiles=[a[0],b[0]].map(e=>({target:e,x:e.x+12,y:e.y,life:2}));
 game.player.x=9000;game.time=105;updateMoteSwarmOrders(game);
 assert.equal(new Set(game.enemies.map(e=>e.motePack)).size,2);
 assert.ok(game.enemies.every(e=>e.moteStatus==='evade'));
 assert.ok(game.enemies.every(e=>e.moteOrder.x<2000),
  'a defensive split may react to observed missiles but cannot use the unseen pilot position');
});

test('combined fire remains bounded but no longer weakens simply because wings merged',()=>{
 assert.ok(moteVolleyCooldown(10)>moteVolleyCooldown(20));
 assert.ok(moteVolleyCooldown(20)>moteVolleyCooldown(40));
 assert.ok(moteVolleyCooldown(40)>=MOTE_SWARM.globalVolley,
  'the whole formation still respects the shared bullet budget');
});

test('a forty-drone wing stays compact without duplicating ships or allowing forty simultaneous rams',()=>{
 const sets=[7,8,9,10].map((id,slot)=>drones(10,id).map(e=>({
  ...e,serial:e.serial+slot*10,x:700+slot*65+e.serial,y:15
 })));
 const game=scene(sets.flat());game.groupSerial=30;game.enemyCanSee=()=>false;
 for(const time of [100,105,110]){game.time=time;updateMoteSwarmOrders(game);}
 assert.equal(new Set(game.enemies.map(e=>e.motePack)).size,1);
 assert.ok(game.enemies.every(e=>e.motePackCount===40));
 assert.equal(game.enemies.length,40);
 assert.equal(new Set(game.enemies.map(e=>e.moteRoot)).size,4);
 const state=game._moteSquadStates.values().next().value;
 state.rushUntil=113;game.time=111;updateMoteSwarmOrders(game);
 assert.equal(game.enemies.filter(e=>e.moteBoosting).length,5,
  'even a mega-formation must not trigger forty simultaneous contact explosions');
});

test('merging preserves the newest genuine sighting and the more restrictive weapon cooldown',()=>{
 const a=drones(10,7),b=drones(10,8);
 for(const e of a){e.x+=500;e.moteReformUntil=0;}
 for(const e of b){e.x+=530;e.moteReformUntil=0;}
 const game=scene([...a,...b]);game.groupSerial=20;game.enemyCanSee=()=>false;
 game._moteSquadStates=new Map([
  [7,{lastKnown:{x:400,y:1,at:90},nextShotAt:108,nextRushAt:109}],
  [8,{lastKnown:{x:475,y:2,at:94},nextShotAt:112,nextRushAt:114}]
 ]);
 updateMoteSwarmOrders(game);
 assert.equal(game._moteSquadStates.size,1);
 const state=game._moteSquadStates.values().next().value;
 assert.equal(state.lastKnown.x,475);
 assert.equal(state.nextShotAt,112);
 assert.equal(state.nextRushAt,114);
 assert.ok(game.enemies.every(e=>e.moteOrder.x<1200),
  'regrouping cannot magically acquire the pilot location behind cover');
});

test('newly merged wings retain sightings from any surviving member after tactical state was rebuilt',()=>{
 const a=drones(10,7),b=drones(10,8);
 for(const e of a)e.x+=420;
 for(const e of b){
  e.serial+=10;e.x+=510;
  e.moteSawPlayer=true;e.moteLastSeen={x:330,y:40,at:98};
 }
 const game=scene([...a,...b]);game.groupSerial=20;
 game.enemyCanSee=()=>false;game._moteSquadStates=new Map();
 updateMoteSwarmOrders(game);
 assert.equal(new Set(game.enemies.map(e=>e.motePack)).size,1);
 const state=game._moteSquadStates.values().next().value;
 assert.equal(state.lastKnown?.x,330,
  'a restored or regrouped formation must not forget the other wing’s valid report');
});

test('hidden pilot movements cannot trigger or cancel a warned swarm rush',()=>{
 const observeThenHide=x=>{
  const members=drones(6),game=scene(members);
  for(const e of members){e.x=150+e.serial;e.moteReformUntil=200;}
  updateMoteSwarmOrders(game);
  game.enemyCanSee=()=>false;game.player.x=x;game.time=103;
  updateMoteSwarmOrders(game);
  return {phase:members[0].moteStatus,charge:game._moteSquadStates.get(7).rushChargeAt||0};
 };
 const near=observeThenHide(0),far=observeThenHide(9000);
 assert.equal(near.phase,far.phase,
  'the attacker can only react to the last observed position, not the invisible ship');
 assert.equal(near.charge,far.charge);
});

test('a courier escaping after lost contact does not know where the hidden pilot moved',()=>{
 const leave=x=>{
  const members=drones(10),game=scene(members);
  for(const e of members)e.moteOriginCount=10;
  updateMoteSwarmOrders(game);
  for(const e of members.slice(0,8))e.hp=0;
  game.enemyCanSee=()=>false;game.player.x=x;game.time=101;
  updateMoteSwarmOrders(game);
  assert.ok(members[8].moteEscape);
  return members[8].moteEscapeGoal;
 };
 assert.deepEqual(leave(0),leave(9000));
});

test('defensive split beyond sighting range does not orient toward an unobserved pilot',()=>{
 const members=drones(10),game=scene(members);
 game.groupSerial=20;game.player.x=5000;
 game.missiles=[members[0],members[1]].map(e=>({target:e,life:2,x:e.x+10,y:e.y}));
 // This geometry predicate intentionally reports a clear ray at any distance.
 // Local detection still has a finite 950-unit range.
 game.enemyCanSee=()=>true;
 updateMoteSwarmOrders(game);
 assert.equal(new Set(members.map(e=>e.motePack)).size,2);
 assert.ok(members[0].moteFlankAxis.x<0,
  'at long range the formation axis must be based on its patrol route, not player coordinates');
});

test('two freshly hit micro-drones can trigger evasive division without visible missiles',()=>{
 const group=drones(12),game=scene(group);
 game.enemyCanSee=()=>false;game.player.x=4500;
 group[0].hit=.3;group[3].hit=.28;
 updateMoteSwarmOrders(game);
 assert.equal(new Set(group.map(e=>e.motePack)).size,2);
 assert.ok(group.every(e=>e.moteStatus==='evade'));
});

test('swarms track last seen positions, not live player coordinates behind cover',()=>{
 const game=scene(drones(5,7));
 updateMoteSwarmOrders(game);
 game.player.x=6000;game.enemyCanSee=()=>false;
 game.time=101;updateMoteSwarmOrders(game);
 assert.ok(game.enemies.every(e=>e.moteOrder.x<500));
 game.time=122;updateMoteSwarmOrders(game);
 assert.ok(game.enemies.every(e=>e.moteStatus==='search'));
 assert.ok(game.enemies.every(e=>Math.abs(e.moteOrder.x)<600));
 game.time=160;updateMoteSwarmOrders(game);
 assert.ok(game.enemies.every(e=>e.moteStatus==='search'),
  'hunters must not silently return to routine patrol after 45 seconds');
 assert.ok(game.enemies.every(e=>Math.abs(e.moteOrder.x)<900),
  'persistent pursuit must still be bounded by the last real sighting');
});

test('a swarm does not announce a new visual contact while a lost target remains hidden',()=>{
 const motes=drones(9),game=scene(motes,100);
 for(const e of motes){e.x=135;e.moteReformUntil=200;}
 updateMoteSwarmOrders(game);
 game.time=102.5;updateMoteSwarmOrders(game);
 assert.ok(motes.some(e=>e.moteStatus==='windup'));
 game.enemyCanSee=()=>false;game.time=108;
 updateMoteSwarmOrders(game);
 assert.ok(motes.every(e=>e.moteStatus==='search'),
  'expired dash warning must return to searching, not claim contact');
});

test('returning reinforcements do not claim they rediscovered a hidden player',()=>{
 const motes=drones(3),game=scene(motes,101);
 for(const e of motes){e.moteReturnUntil=102;e.moteLastSeen={x:0,y:0,at:99};}
 game.enemyCanSee=()=>false;
 updateMoteSwarmOrders(game);
 assert.equal(motes[0].moteStatus,'return');
 game.time=103;updateMoteSwarmOrders(game);
 assert.equal(motes[0].moteStatus,'search');
});

test('a fleeing courier never joins an active pack merely because they pass nearby',()=>{
 const escape=drones(2,7),hunters=drones(5,8);
 for(const e of escape){e.moteEscape=true;e.moteEscapeGoal={x:2000,y:2000};}
 for(const e of hunters){e.serial+=10;e.x+=30;e.moteReformUntil=0;}
 const game=scene([...escape,...hunters]);
 updateMoteSwarmOrders(game);
 assert.ok(escape.every(e=>e.motePack===7));
 assert.ok(hunters.every(e=>e.motePack===8));
});

test('a rushing micro-drone hits solid asteroid cover rather than passing through it',()=>{
 const [e]=drones(1),game=scene([e],150);
 e.x=20;e.y=0;e.vx=400;e.vy=0;e.moteBoosting=true;
 e.moteOrder={x:300,y:0};game.player.x=260;
 game.rockGrid={query:()=>[{x:105,y:0,r:36,hp:300,alive:true}]};
 moveMote(e,game,.32);
 assert.equal(e.hp,0,'a physical charge cannot tunnel through an asteroid');
 assert.ok(e.x<105);
});

test('a charging drone hits the pilot before cover behind them, including low-FPS jumps',()=>{
 const [e]=drones(1),game=scene([e],150);
 e.x=-40;e.y=0;e.vx=650;e.vy=0;e.moteBoosting=true;
 e.moteOrder={x:300,y:0};game.player.r=19;game.player.invul=0;
 game.hurt=damage=>{game.received=damage;};
 game.rockGrid={query:()=>[{x:125,y:0,r:36,alive:true}]};
 moveMote(e,game,.62);
 assert.equal(game.received,MOTE_SWARM.damage);
 assert.equal(e.hp,0);
});

test('an asteroid remains solid cover even when the pilot is standing close to it',()=>{
 const [e]=drones(1),game=scene([e],150);
 e.x=-100;e.y=0;e.vx=650;e.vy=0;e.moteBoosting=true;
 e.moteOrder={x:300,y:0};game.player.x=55;game.player.r=19;
 game.hurt=damage=>{game.received=damage;};
 game.rockGrid={query:()=>[{x:20,y:0,r:36,alive:true}]};
 moveMote(e,game,.62);
 assert.equal(game.received,undefined,'cover near the pilot must not be skipped');
 assert.equal(e.hp,0);
 assert.ok(e.x<0);
});

test('micro-drones sidestep a tracked incoming missile without changing hitboxes or gaining speed',()=>{
 const [e]=drones(1),game=scene([e],112);
 e.moteOrder={x:0,y:0};e.hit=0;
 game.missiles=[{target:e,x:e.x+60,y:e.y,life:2}];
 moveMote(e,game,.04);
 assert.ok(e.moteDodging,'an approaching homing missile should trigger evasive steering');
 assert.ok(Number.isFinite(e.vx)&&Number.isFinite(e.vy));
 assert.ok(Math.hypot(e.vx,e.vy)<MOTE_SWARM.speed*1.4,
  'dodging must alter the course, not give an unrestricted speed bonus');
 const y=e.y;
 game.missiles=[];game.time=112.1;moveMote(e,game,.04);
 assert.notEqual(e.y,y,'a dodge must cause real lateral displacement');
 assert.equal(e.r,MOTE_SWARM.radius);
 assert.equal(e.hp,MOTE_SWARM.hp);
});

test('a wing can receive another pack’s recent real sighting, not future player motion',()=>{
 const a=drones(8,7),b=drones(8,8);
 for(const e of a){e.moteReformUntil=200;e.moteOriginCount=8;}
 for(const e of b){e.serial+=10;e.x+=120;e.moteOriginCount=8;e.moteReformUntil=200;}
 const game=scene([...a,...b]);
 game.enemyCanSee=e=>e.moteRoot===7;
 updateMoteSwarmOrders(game);
 assert.ok(b.every(e=>e.moteAllianceSize===2));
 assert.ok(b.every(e=>e.moteOrder.x<600));
 game.player.x=9000;game.time=101;updateMoteSwarmOrders(game);
 assert.ok(b.every(e=>e.moteOrder.x<650));
});

test('a surviving courier physically leaves the screen and requests support once',()=>{
 const members=drones(10);for(const e of members)e.moteOriginCount=10;
 const game=scene(members),requests=[];
 game.camera=()=>({x:-400,y:-400,w:800,h:800});
 game.spawnMoteReinforcements=(courier,waypoint,count)=>{
  requests.push({courier,waypoint,count});return count;
 };
 updateMoteSwarmOrders(game);
 for(const e of members.slice(0,8))e.hp=0;
 game.time=101;updateMoteSwarmOrders(game);
 const surviving=members.slice(8),courier=surviving.find(e=>e.moteCourier);
 assert.ok(courier&&surviving.every(e=>e.moteEscape));
 assert.ok(surviving.every(e=>e.moteStatusCue.includes('ЗА ПОДМОГОЙ')));
 courier.x=-990;game.time=102;updateMoteSwarmOrders(game);
 assert.equal(requests.length,0,'no reinforcement appears at the start of escape');
 assert.equal(game._moteReinforcementQueue.length,1);
 game.time=106;updateMoteSwarmOrders(game);
 assert.equal(requests.length,1);
 assert.equal(requests[0].count,16);
 assert.ok(surviving.every(e=>!e.moteEscape));
 game.time=120;updateMoteSwarmOrders(game);
 assert.equal(requests.length,1,'no infinite reinforcement loop');
});

test('the actual support factory enters from offscreen with two capped squads',()=>{
 const g=actualGame();g.time=300;g.player.level=5;g.skillRanks.beam=1;g.vw=800;g.vh=600;
 g.camera=()=>({x:-400,y:-300,w:800,h:600});
 const courier={x:1300,y:1000,hp:1,r:6.5};
 const count=g.spawnMoteReinforcements(courier,{x:25,y:15,at:200},16);
 assert.equal(count,16);
 assert.equal(new Set(g.enemies.map(e=>e.motePack)).size,2);
 assert.ok(g.enemies.every(e=>e.moteCallUsed&&e.moteOriginCount===8));
 assert.ok(g.enemies.every(e=>e.moteApproach.x===25));
 assert.equal(g.spawnMoteReinforcements({...courier,x:0,y:0},{x:25,y:15},16),0,
  'reinforcement cannot materialize on camera');
});

test('reinforcements wait until the entire formation can enter offscreen',()=>{
 const g=actualGame();g.time=300;g.player.level=5;g.skillRanks.beam=1;g.vw=800;g.vh=600;
 g.camera=()=>({x:0,y:0,w:800,h:600});
 const courier={x:-121,y:270,hp:1,r:6.5};
 const sighting={x:-101,y:800,at:210};
 assert.equal(g.spawnMoteReinforcements(courier,sighting,16),0,
  'a courier just beyond the edge must not materialize companions in view');
 courier.x=-410;
 assert.equal(g.spawnMoteReinforcements(courier,sighting,16),16);
 assert.ok(g.enemies.every(e=>e.x<0||e.x>800||e.y<0||e.y>600));
});

test('real reinforcements unite as sixteen drones and can later divide for a visible attack',()=>{
 const g=actualGame();g.time=300;g.player.level=5;g.skillRanks.beam=1;g.vw=800;g.vh=600;
 g.camera=()=>({x:-400,y:-300,w:800,h:600});
 g.enemyCanSee=()=>false;
 const courier={x:1300,y:1000,hp:1,r:6.5};
 assert.equal(g.spawnMoteReinforcements(courier,{x:25,y:15,at:210}),16);
 const originalRoots=new Set(g.enemies.map(e=>e.moteRoot));
 assert.equal(originalRoots.size,2);
 g.time=305;updateMoteSwarmOrders(g);
 assert.equal(new Set(g.enemies.map(e=>e.motePack)).size,1,
  'entrance wings from the actual spawn method must really fuse');
 assert.ok(g.enemies.every(e=>e.motePackCount===16));
 g.time=311;g.player.x=1300;g.player.y=1000;g.enemyCanSee=()=>true;
 updateMoteSwarmOrders(g);
 assert.equal(new Set(g.enemies.map(e=>e.motePack)).size,2,
  'the fused reinforcement must also be able to mount a new two-flank attack');
 assert.deepEqual(new Set(g.enemies.map(e=>e.moteFlank)),new Set([-1,1]));
 assert.deepEqual(new Set(g.enemies.map(e=>e.moteRoot)),originalRoots,
  'physical manoeuvres may not erase the identity of the original groups');
});

test('late micro-drone encounters contain two real eight-member packs',()=>{
 const g=actualGame();g.vw=1200;g.vh=800;g.time=230;g.player.level=5;g.skillRanks.beam=1;
 g.lastEncounter='';
 const director={...openingThreat(230,4),cap:70,groupSize:16};
 const available=availableEncounters(230,director,16,70);
 const choice=(available.indexOf('motes')+.25)/available.length;
 assert.ok(available.includes('motes'));
 const rng=Math.random;let calls=0;
 Math.random=()=>[.2,.5,choice][calls++]??.3;
 try{g.spawnGroup(director);}finally{Math.random=rng;}
 assert.equal(g.enemies.filter(e=>e.microSwarm).length,16);
 assert.equal(new Set(g.enemies.map(e=>e.motePack)).size,2);
});

test('staggered boosts have warnings, genuine velocity and vulnerable contact',()=>{
 const members=drones(9),game=scene(members);
 const rushSounds=[];game.heritage={play(name){rushSounds.push(name);}};
 for(const e of members){e.x=145+e.serial;e.moteReformUntil=200;}
 game.player.r=19;game.player.invul=0;game.hurt=damage=>{game.received=damage;};
 updateMoteSwarmOrders(game);
 game.time=102.5;updateMoteSwarmOrders(game);
 assert.ok(members.every(e=>e.moteStatus==='windup'));
 assert.ok(members.every(e=>!e.moteBoosting));
 const warnedPacks=rushSounds.filter(name=>name==='swarmWarning').length;
 assert.ok(warnedPacks>=1&&warnedPacks<=2,
  'each attacking pack must warn before its acceleration begins');
 game.time=103.2;updateMoteSwarmOrders(game);
 assert.equal(rushSounds.filter(name=>name==='swarmWarning').length,warnedPacks,
  'the impact phase must not repeat the already delivered warning');
 const boosted=members.filter(e=>e.moteBoosting);
 assert.ok(boosted.length>=2&&boosted.length<members.length);
 const e=boosted[0];e.x=-30;e.y=0;e.vx=240;e.vy=0;
 e.moteOrder={x:100,y:0};
 moveMote(e,game,.16);
 assert.equal(e.hp,0);
 assert.equal(game.received,MOTE_SWARM.damage);
});
