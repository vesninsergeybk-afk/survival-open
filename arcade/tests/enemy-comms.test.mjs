import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EnemyComms,ENEMY_COMMS,collectiveDecision,enemyOrderMessage,
 classifyEnemyAttack,assessEnemyThreat,incomingFireEstimate,
 estimatedWeaponRange} from '../enemy-comms.js';
import {updateEnemy} from '../ai.js';
import {RuntimeHarness} from './runtime-game.mjs';
import {contactOnCircle} from '../impact-geometry.js';

const ship=(serial,type='scout',x=serial*34,y=60)=>({
 serial,type,group:1,x,y,vx:0,vy:0,r:14,hp:70,maxHp:70,
 damage:10,think:12,fire:12,commitUntil:8,state:'hunt',
 _enemyLearning:{style:type==='fighter'?'pressure':
  type==='flanker'?'wide':type==='healer'?'critical':'cutoff'}
});
function scene(enemies){
 const player={x:0,y:0,vx:175,vy:0,hp:110,maxHp:110,r:19,invul:99};
 const game={time:0,player,enemies,allies:[],missiles:[],shots:[],
  grid:{query(x,y,r){return enemies.filter(e=>e.hp>0&&Math.hypot(e.x-x,e.y-y)<=r);}},
  avoidance:()=>({x:0,y:0}),enemyCanSee:()=>true,
  heritage:{play(){},vfx:{shipExplosion(){}}},hurt(){},enemyShot(){return true;}};
 game.enemyComms=new EnemyComms();return game;
}
function execute(game){
 for(const e of game.enemies)updateEnemy(e,game,.016);
 game.enemyComms.confirmExecution(game);
}

test('a verified scout report travels to a caller and the shared order travels back',()=>{
 const scout=ship(1,'scout',90),fighter=ship(2,'fighter',160);
 const game=scene([scout,fighter]),net=game.enemyComms;
 net.update(game);
 assert.equal(net.directiveFor(scout,game.time),null);
 net.reportSight(scout,game.player,.1);
 game.time=.7;net.update(game);
 const inbound=net.events.find(e=>e.from===scout&&e.to===fighter&&e.kind==='contact');
 const outbound=net.events.find(e=>e.from===fighter&&e.to===scout&&e.kind==='order');
 assert.ok(inbound&&outbound,'both directions must be actual sent messages');
 assert.ok(net.events.some(e=>e.from===scout&&e.to===fighter&&e.kind==='vote'),
  'the scout must send its own proposal, not be read by a central oracle');
 assert.equal(net.directiveFor(scout,game.time).leader,fighter);
 assert.equal(net.directiveFor(scout,game.time).intel.x,game.player.x);
 assert.equal(net.directiveFor(scout,game.time).mode,'intercept');
});

test('witnessed industrial sabotage creates a real local response without a player coordinate',()=>{
 const scout=ship(1,'scout',115,75),fighter=ship(2,'fighter',180,75);
 const game=scene([scout,fighter]),net=game.enemyComms;
 game.player.x=1700;game.player.y=1700;
 const asset={x:120,y:105,hp:0,centralWorker:true};
 net.update(game);
 game.time=.2;
 assert.equal(net.reportIncident(asset,game,'mining'),2);
 game.time=.75;net.update(game);
 const order=net.directiveFor(scout,game.time);
 assert.equal(order?.mode,'intercept');
 assert.equal(order.intel.estimated,true);
 assert.equal(order.intel.incident,true);
 assert.deepEqual([order.intel.x,order.intel.y],[asset.x,asset.y]);
 assert.ok(net.events.some(event=>event.kind==='distress'));
 game.playerCanInspectEnemyIntent=()=>true;
 game.time=.8;execute(game);
 assert.equal(scout._commsIntent?.mode,'intercept');
 assert.ok(Math.hypot(scout._commsIntent.x-asset.x,
  scout._commsIntent.y-asset.y)<1,'the wingman steers to the damaged facility');
 assert.equal(enemyOrderMessage('intercept',{kind:'sabotage'}),
  'Наш промышленный узел атакован. Проверить район!');
});

test('unwitnessed infrastructure damage never broadcasts an omniscient alarm',()=>{
 const scout=ship(1,'scout',115,75),fighter=ship(2,'fighter',180,75);
 const game=scene([scout,fighter]),net=game.enemyComms;
 game.enemyCanSee=()=>false;
 net.update(game);game.time=.2;
 assert.equal(net.reportIncident({x:120,y:105,hp:0},game),0);
 game.time=.75;net.update(game);
 assert.equal(net.directiveFor(scout,game.time),null);
 assert.ok(!net.events.some(event=>event.kind==='distress'));
});

test('a fresh visual contact supersedes an older industrial alarm',()=>{
 const scout=ship(1,'scout',115,75),fighter=ship(2,'fighter',180,75);
 const game=scene([scout,fighter]),net=game.enemyComms;
 net.update(game);game.time=.2;
 net.reportIncident({x:120,y:105,hp:0},game,'mining');
 game.time=.75;net.update(game);
 assert.equal(net.cells[0].threat.kind,'sabotage');
 net.reportSight(fighter,game.player,1.0);
 game.time=1.5;net.update(game);
 assert.equal(net.cells[0].intel.estimated,undefined);
 assert.notEqual(net.cells[0].threat?.kind,'sabotage',
  'seeing the player is more important than investigating a dead worker');
});

test('a reinforcement cannot obey a group decision before receiving its message',()=>{
 const scout=ship(1,'scout',90),leader=ship(2,'fighter',145);
 const game=scene([scout,leader]),net=game.enemyComms;
 net.update(game);net.reportSight(scout,game.player,.1);
 game.time=.7;net.update(game);
 const reinforcement=ship(3,'flanker',170);game.enemies.push(reinforcement);
 game.time=1.4;net.update(game);
 assert.ok(net.cells[0].members.includes(reinforcement));
 assert.equal(net.directiveFor(reinforcement,game.time),null,
  'being close to an informed squad cannot grant instantaneous knowledge');
 game.time=2.3;net.update(game);
 assert.ok(net.directiveFor(reinforcement,game.time),
  'the new pilot may act after a real broadcast');
});

test('unseen player coordinates cannot leak into radio through the global game object',()=>{
 const a=ship(1),b=ship(2),game=scene([a,b]);
 game.player.x=980;game.player.y=-740;
 game.enemyComms.update(game);
 game.time=.8;game.enemyComms.update(game);
 assert.equal(game.enemyComms.directiveFor(a,game.time),null);
 assert.equal(game.enemyComms.events.length,0);
});

test('no transmission, shared target or collective attack passes beyond radio range',()=>{
 const scout=ship(1,'scout',0),fighter=ship(2,'fighter',430);
 const game=scene([scout,fighter]),net=game.enemyComms;
 net.update(game);net.reportSight(scout,game.player,.1);
 game.time=.7;net.update(game);
 assert.equal(net.send(scout,fighter,'contact',game.time),false);
 assert.equal(net.directiveFor(fighter,game.time),null);
 assert.equal(net.messages,0);
});

test('radio memory expires and a departing wingman loses the joint directive',()=>{
 const a=ship(1,'scout',90),b=ship(2,'fighter',145);
 const game=scene([a,b]),net=game.enemyComms;
 net.update(game);net.reportSight(a,game.player,.1);
 game.time=.7;net.update(game);
 assert.ok(net.directiveFor(a,game.time));
 b.x=900;game.time=1.4;net.update(game);
 assert.equal(net.directiveFor(b,game.time),null);
 assert.equal(net.render({save(){},restore(){},setLineDash(){},
  beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},fillText(){}},
  {x:0,y:0,w:1000,h:400},1.4),0,
  'a severed radio beam must not remain visible');
 game.time=4.2;net.update(game);
 assert.equal(net.directiveFor(a,game.time),null);
});

test('votes genuinely depend on several distinct pilots and their learned styles',()=>{
 const f1=ship(1,'fighter'),f2=ship(2,'fighter'),f3=ship(3,'fighter');
 const flank1=ship(4,'flanker'),flank2=ship(5,'flanker');
 const intel={vx:0,vy:0};
 const majority=collectiveDecision([f1,f2,f3,flank1,flank2],intel);
 const changed=collectiveDecision([f1,flank1,flank2],intel);
 assert.equal(majority.mode,'press');
 assert.equal(changed.mode,'pincer');
 assert.equal(majority.contributors,5);
 assert.equal(changed.contributors,3);
});

test('a wounded squad with a working medic can collectively choose a screen',()=>{
 const medic=ship(1,'healer'),a=ship(2,'fighter'),b=ship(3,'flanker');
 a.hp=17;b.hp=23;
 const decision=collectiveDecision([medic,a,b],{vx:80,vy:0});
 assert.equal(decision.mode,'screen');
 const without=collectiveDecision([a,b],{vx:80,vy:0});
 assert.notEqual(without.mode,'screen');
});

test('real weapon hits are classified without reading private player equipment',()=>{
 assert.equal(classifyEnemyAttack('rail',345),'long');
 assert.equal(classifyEnemyAttack('beam',290),'close');
 assert.equal(classifyEnemyAttack('beam',430),'close',
  'a long plasma shot is still a dangerous close-range beam');
 assert.equal(classifyEnemyAttack('flak',245),'close');
 assert.equal(classifyEnemyAttack('howitzer',450),'area');
 assert.equal(classifyEnemyAttack('ion',90),'area');
 assert.equal(classifyEnemyAttack('beam',130),'close');
 assert.equal(estimatedWeaponRange('rail'),390);
 assert.equal(classifyEnemyAttack('storm',380),null);
 assert.equal(classifyEnemyAttack('rocket',NaN),null);
 assert.equal(assessEnemyThreat([{kind:'long',at:1}],2),null);
 assert.equal(assessEnemyThreat([{kind:'long',at:1},{kind:'long',at:1.2}],2),null);
 assert.equal(assessEnemyThreat([{kind:'long',at:1},{kind:'long',at:2.3}],3).kind,'long');
 assert.equal(assessEnemyThreat([{kind:'long',at:1},{kind:'long',at:2.3}],10),null);
 assert.equal(assessEnemyThreat([{kind:'area',at:.1},{kind:'area',at:1.2},
   {kind:'long',at:3.1},{kind:'long',at:4.3}],4.4).kind,'long',
  'obsolete area attacks must not override a newer corroborated threat');
 assert.equal(incomingFireEstimate({x:410,y:50},400,
   {directed:true,nx:-1,ny:0}).estimated,true);
 assert.equal(incomingFireEstimate({x:410,y:50},400,{directed:false}),null);
});

test('two communicated long-range hits change a real collective order to closing',()=>{
 const scout=ship(1,'scout',90),fighter=ship(2,'fighter',150);
 const game=scene([scout,fighter]),net=game.enemyComms;
 net.update(game);net.reportSight(scout,game.player,.1);
 game.time=.7;net.update(game);
 const original=net.directiveFor(scout,.7).mode;
 net.reportAttack(scout,'rail',340,1.5);
 game.time=1.6;net.update(game);
 assert.notEqual(net.cells[0].mode,'close');
 assert.ok(net.events.some(event=>event.kind==='weapon'&&event.from===scout),
  'a subordinate must transmit its observation');
 net.reportAttack(fighter,'rocket',330,2.8);
 net.reportSight(scout,game.player,2.8);
 game.time=2.9;net.update(game);
 assert.equal(net.cells[0].attackReports.length,2);
 game.time=3.7;net.update(game);
 assert.notEqual(original,'close');
 assert.equal(net.directiveFor(scout,3.7)?.mode,'close');
 assert.equal(net.cells[0].threat.kind,'long');
});

test('confirmed area attacks trigger dispersal, but isolated hits do not',()=>{
 const members=[ship(1,'fighter'),ship(2,'fighter'),ship(3,'flanker')];
 assert.notEqual(collectiveDecision(members,{vx:0,vy:0}).mode,'scatter');
 const long=collectiveDecision(members,{vx:0,vy:0},{kind:'long'});
 const area=collectiveDecision(members,{vx:0,vy:0},{kind:'area'});
 assert.equal(long.mode,'close');
 assert.equal(area.mode,'scatter');
});

test('a confirmed plasma beam provokes a cautious orbit, not suicidal closing',()=>{
 const fighter=ship(1,'fighter',240,70),flanker=ship(2,'flanker',280,80);
 const decision=collectiveDecision([fighter,flanker],{vx:0,vy:0},
  {kind:'close'});
 assert.equal(decision.mode,'pincer');
 assert.match(enemyOrderMessage(decision.mode,{kind:'close'}),/Держать дистанцию/);
 const game=scene([fighter,flanker]);game.time=1;
 game.enemyComms.directiveFor=()=>({mode:'pincer',side:1,leader:flanker,
  intel:{x:0,y:0,vx:0,vy:0,at:1},threat:{kind:'close'}});
 updateEnemy(fighter,game,.016);
 assert.equal(fighter._commsIntent?.mode,'pincer');
 assert.ok(Math.hypot(fighter._commsIntent.x,fighter._commsIntent.y)>=300,
  'the wingman aims for the safer ring instead of the strongest plasma zone');
});

test('a quoted change of strategy has the same cause as the real tactical vote',()=>{
 assert.equal(enemyOrderMessage('close',{kind:'long'}),
  'Он бьёт издалека. Всем на сближение!');
 assert.equal(enemyOrderMessage('scatter',{kind:'area'}),
  'У него площадное оружие. Рассредоточиться!');
 assert.notEqual(enemyOrderMessage('close'),enemyOrderMessage('close',{kind:'long'}),
  'a generic advance must never claim it observed a long-range weapon');
 const fighter=ship(2,'fighter',220,60),positions=[];
 for(const mode of ['close','scatter']){
  const e={...fighter},game=scene([e]);game.time=1;
  game.enemyComms.directiveFor=()=>({mode,side:1,leader:e,
    intel:{x:0,y:0,vx:0,vy:0,at:1}});
  updateEnemy(e,game,.25);
  positions.push([e.x,e.y]);
 }
 assert.notDeepEqual(positions[0],positions[1],
  'the subtitles refer to distinct physical maneuvers');
});

test('only an executed, intercepted radio order enters the transcript',()=>{
 const scout=ship(1,'flanker',90),fighter=ship(2,'fighter',150);
 const game=scene([scout,fighter]),net=game.enemyComms;
 game.playerCanInspectEnemyIntent=()=>false;
 net.update(game);net.reportSight(scout,game.player,.1);
 game.time=.7;net.update(game);execute(game);
 assert.equal(net.intercepted(game.time).length,0,
  'a hidden enemy cannot be eavesdropped from the map');
 const visible=scene([ship(1,'flanker',90),ship(2,'fighter',150)]);
 visible.playerCanInspectEnemyIntent=()=>true;
 const radio=visible.enemyComms;
 radio.update(visible);radio.reportSight(visible.enemies[0],visible.player,.1);
 visible.time=.7;radio.update(visible);
 assert.equal(radio.intercepted(.7).length,0,
  'transmission alone cannot be presented as an executed maneuver');
 execute(visible);
 const capture=radio.intercepted(.7);
 assert.equal(capture.length,1);
 assert.equal(capture[0].mode,radio.cells[0].mode);
 assert.equal(capture[0].message,enemyOrderMessage(capture[0].mode));
 const labels=[];
 const ctx={save(){},restore(){},setLineDash(){},beginPath(){},
  moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},
  fillRect(){},strokeRect(){},fillText(s){labels.push(s);}};
 radio.render(ctx,{x:0,y:0,w:400,h:260},.9,false,60,visible);
 assert.ok(labels.some(line=>line.includes('ПЕРЕХВАЧЕН ПРИКАЗ')));
 assert.ok(labels.some(line=>capture[0].message.includes(line)),
  'world-space subtitle must be derived from the captured message');
 assert.equal(radio.intercepted(31).length,0,'old intercepts leave the map');
});

test('a delayed executed order still creates a visible speech bubble and HUD notice',()=>{
 const leader=ship(2,'fighter',150),wing=ship(1,'flanker',100);
 const net=new EnemyComms(),intel={x:0,y:0,vx:0,vy:0,at:1.5};
 const cell={id:1,leader,members:[leader,wing],mode:'close',intel,
  threat:{kind:'long'},lastDecisionAt:1,pendingDecision:{at:1,mode:'close'}};
 net.cells=[cell];wing._commsCell=cell;
 wing._commsOrder={cellId:1,mode:'close',intel,at:1};
 wing._commsIntent={x:10,y:20,mode:'close',leader,at:1.5};
 const notices=[],game={time:1.5,playerCanInspectEnemyIntent:()=>true,
  playerCanInterceptEnemyRadio:()=>true,notice:text=>notices.push(text)};
 net.confirmExecution(game);
 const labels=[],ctx={save(){},restore(){},setLineDash(){},beginPath(){},
  moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},
  fillRect(){},strokeRect(){},fillText:text=>labels.push(text)};
 net.render(ctx,{x:0,y:0,w:500,h:320},1.5,false,60,game);
 assert.ok(labels.some(line=>line.includes('ПЕРЕХВАЧЕН ПРИКАЗ')));
 assert.ok(notices.some(line=>line.includes('бьёт издалека')));
});

test('a visible wingman cannot expose an unseen commander through radio lines',()=>{
 const leader=ship(2,'fighter',150),wing=ship(1,'flanker',100);
 const net=new EnemyComms(),intel={x:0,y:0,vx:0,vy:0,at:1};
 const cell={id:1,leader,members:[leader,wing],mode:'pincer',intel};
 net.cells=[cell];wing._commsCell=cell;
 wing._commsOrder={cellId:1,mode:'pincer',intel,at:1};
 net.events=[{from:leader,to:wing,kind:'order',start:.9,until:1.66}];
 const strokes=[],ctx={save(){},restore(){},setLineDash(){},beginPath(){},
  moveTo(x,y){strokes.push([x,y]);},lineTo(){},stroke(){},
  arc(){},fill(){},fillText(){}};
 const hidden={playerCanInspectEnemyIntent:e=>e===wing};
 net.render(ctx,{x:0,y:0,w:500,h:320},1,false,60,hidden);
 assert.deepEqual(strokes,[],'a one-sided visual trace reveals the hidden endpoint');
 net.render(ctx,{x:0,y:0,w:500,h:320},1,false,60,
  {playerCanInspectEnemyIntent:()=>true});
 assert.ok(strokes.length>0,'acknowledged, visible peers still show real traffic');
});

test('living witnesses learn signatures from lethal strikes; isolated deaths teach nothing',()=>{
 const witness=ship(1,'fighter',150,70),victimA=ship(2,'scout',130,90),
  victimB=ship(3,'scout',175,90),survivor=ship(4,'flanker',165,72);
 victimA.hp=victimA.maxHp=28;victimB.hp=victimB.maxHp=28;
 const game=scene([witness,victimA,victimB,survivor]),net=game.enemyComms;
 const harness=new RuntimeHarness();
 Object.assign(harness,{player:game.player,enemyComms:net,
  enemyLearning:{damaged(){}},heritage:{play(){},vfx:{hullImpact(){}}},
  visuals:{},grid:game.grid,enemyCanSee:game.enemyCanSee,time:0});
 net.update(game);
 for(const [victim,at] of [[victimA,1],[victimB,2.4]]){
  game.time=harness.time=at;
  harness.damageEnemy(victim,38,'rail',
   contactOnCircle(victim.x,victim.y,victim.r,game.player.x,game.player.y));
  assert.ok(victim.hp<=0);
  net.update(game);
 }
 assert.ok(net.cells[0].attackReports.length>=2);
 assert.equal(net.cells[0].threat?.kind,'long');
 const lone=ship(4,'scout',130,90),isolated=scene([witness,lone]);
 lone.hp=lone.maxHp=28;isolated.enemyCanSee=()=>false;
 Object.assign(harness,{player:isolated.player,enemyComms:isolated.enemyComms,
  grid:isolated.grid,enemyCanSee:isolated.enemyCanSee,time:4});
 isolated.time=4;isolated.enemyComms.update(isolated);
 harness.damageEnemy(lone,38,'rail',
  contactOnCircle(lone.x,lone.y,lone.r,isolated.player.x,isolated.player.y));
 assert.equal(witness._commsAttack.at,2.4,
  'an unseen later destruction must not upgrade the witness observation');
});

test('a long-distance counter-order is visible only after two real transmitted hits',()=>{
 const scout=ship(1,'flanker',90),fighter=ship(2,'fighter',160);
 const game=scene([scout,fighter]),net=game.enemyComms;
 game.playerCanInspectEnemyIntent=()=>true;
 net.update(game);net.reportSight(scout,game.player,.1);
 game.time=.7;net.update(game);execute(game);
 net.reportAttack(scout,'rail',345,1.5);
 game.time=1.6;net.update(game);execute(game);
 assert.equal(net.intercepted(1.6).length,1);
 net.reportAttack(fighter,'rocket',330,2.8);
 net.reportSight(scout,game.player,2.8);
 game.time=2.9;net.update(game);execute(game);
 game.time=3.7;net.update(game);execute(game);
 assert.equal(net.intercepted(3.7)[0].mode,'close');
 assert.match(net.intercepted(3.7)[0].message,/бьёт издалека/);
});

test('real player damage beyond sight becomes an uncertain, executed radio response',()=>{
 const wing=ship(1,'flanker',390,30),leader=ship(2,'fighter',455,30);
 const game=scene([wing,leader]),net=game.enemyComms;
 game.enemyCanSee=()=>false;
 game.playerCanInspectEnemyIntent=()=>false;
 game.playerCanInterceptEnemyRadio=()=>true;
 const notices=[];game.notice=(message)=>notices.push(message);
 const harness=new RuntimeHarness();
 Object.assign(harness,{player:game.player,enemyComms:net,
  enemyLearning:{damaged(){}},heritage:{play(){},vfx:{hullImpact(){}}},
  visuals:{},time:0});
 net.update(game);
 for(const [e,now,weapon] of [[wing,1.0,'rail'],[leader,2.4,'rocket']]){
  game.time=harness.time=now;
  const hit=contactOnCircle(e.x,e.y,e.r,game.player.x,game.player.y);
  harness.damageEnemy(e,5,weapon,hit);
  net.update(game);execute(game);
  if(now===1.0){
   assert.equal(net.cells[0].mode,null,'a single hit is not a combat strategy');
   assert.equal(notices.length,0);
  }
 }
 const directive=net.directiveFor(wing,game.time);
 assert.equal(directive?.mode,'close');
 assert.equal(directive.intel.estimated,true);
 assert.equal(directive.intel.vx,0,'an unseen target has no live motion track');
 assert.equal(wing._commsIntent?.mode,'close','the wingman actually obeys');
 assert.equal(net.intercepted(game.time)[0].mode,'close');
 assert.ok(notices.some(text=>text.includes('бьёт издалека')));
 game.time=10;net.update(game);
 assert.equal(net.directiveFor(wing,10),null,'a firing sector must expire');
});

test('no tactical label or radio transcript leaks from an unheard conversation',()=>{
 const wing=ship(1,'flanker',90),leader=ship(2,'fighter',150);
 const game=scene([wing,leader]),net=game.enemyComms;
 game.playerCanInspectEnemyIntent=()=>false;
 game.playerCanInterceptEnemyRadio=()=>false;
 net.update(game);net.reportSight(wing,game.player,.1);
 game.time=.7;net.update(game);execute(game);
 assert.ok(wing._commsIntent,'the maneuver may still happen offscreen');
 assert.equal(net.intercepted(.7).length,0);
 const labels=[];
 const ctx={save(){},restore(){},setLineDash(){},beginPath(){},
  moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},
  fillText(v){labels.push(v);}};
 net.render(ctx,{x:0,y:0,w:500,h:250},.8,false,60,game);
 assert.deepEqual(labels,[]);
});

test('a healing pair does not broadcast maneuvers that neither ship can execute',()=>{
 const medic=ship(1,'healer',100),guard=ship(2,'fighter',145);
 guard.protect=medic;guard.state='guard';guard.hp=24;
 const game=scene([medic,guard]),net=game.enemyComms;
 game.playerCanInspectEnemyIntent=()=>true;
 net.update(game);net.reportSight(guard,game.player,.1);
 game.time=.7;net.update(game);execute(game);
 assert.equal(net.cells[0].mode,null);
 assert.equal(net.intercepted(.7).length,0);
 assert.equal(medic._commsIntent,null);
 assert.equal(guard._commsIntent,null);
});

test('witnessed losses make surviving pilots disperse without a global kill oracle',()=>{
 const wing=ship(1,'flanker',100),leader=ship(2,'fighter',155),
  victim1=ship(3,'scout',115),victim2=ship(4,'scout',140);
 const game=scene([wing,leader,victim1,victim2]),net=game.enemyComms;
 game.playerCanInspectEnemyIntent=()=>true;
 const harness=new RuntimeHarness();
 Object.assign(harness,{player:game.player,enemyComms:net,
  enemyLearning:{damaged(){}},heritage:{play(){},vfx:{hullImpact(){}}},
  visuals:{},grid:game.grid,time:0,enemyCanSee:game.enemyCanSee});
 net.update(game);net.reportSight(wing,game.player,.1);
 game.time=.7;net.update(game);execute(game);
 const before=net.cells[0].mode;
 game.time=harness.time=1.4;
 harness.damageEnemy(victim1,100,'other');
 net.update(game);execute(game);
 assert.notEqual(net.cells[0].mode,'scatter',
  'one observed loss does not trigger fleet-wide panic');
 game.time=harness.time=2.6;
 harness.damageEnemy(victim2,100,'other');
 net.reportSight(wing,game.player,2.6);
 net.update(game);execute(game);
 assert.notEqual(before,'scatter');
 assert.equal(net.cells[0].threat?.kind,'loss');
 assert.equal(net.cells[0].mode,'scatter');
 assert.equal(wing._commsIntent?.mode,'scatter');
 assert.match(net.intercepted(game.time)[0].message,/несёт потери/);
 const stranger=ship(9,'scout',5000);
 game.grid.query=()=>[stranger];game.enemyCanSee=()=>false;
 assert.equal(net.reportLoss({serial:20,x:5000,y:60,hp:0},game),0);
 assert.equal(stranger._commsLoss,undefined);
});

test('destroying a caller breaks the net before a survivor can be elected',()=>{
 const leader=ship(1,'fighter'),other=ship(2,'scout'),third=ship(3,'flanker');
 const game=scene([leader,other,third]),net=game.enemyComms;
 net.update(game);net.reportSight(other,game.player,.1);
 game.time=.7;net.update(game);
 assert.ok(net.directiveFor(other,game.time));
 leader.hp=0;game.time=1.4;net.update(game);
 assert.ok(net.cells[0].brokenUntil>game.time);
 assert.equal(net.directiveFor(other,game.time),null);
 assert.ok(net.events.every(ev=>ev.from.hp>0&&ev.to.hp>0),
  'no ghost links remain attached to a dead commander');
 net.reportSight(other,game.player,3.4);
 game.time=3.6;net.update(game);
 assert.equal(net.cells[0].leader,third);
 assert.ok(net.directiveFor(other,game.time),'a survivor restores coordination');
});

test('received interception orders alter actual fighter steering without new damage or HP',()=>{
 const original=ship(2,'fighter',220,60),linked=ship(2,'fighter',220,60);
 const a=scene([original]),b=scene([linked]);a.time=b.time=1;
 const intel={x:0,y:0,vx:180,vy:30,at:1};
 b.enemyComms.directiveFor=()=>({mode:'intercept',side:1,intel,leader:linked});
 updateEnemy(original,a,.25);updateEnemy(linked,b,.25);
 assert.notDeepEqual([original.vx,original.vy],[linked.vx,linked.vy]);
 assert.equal(original.hp,linked.hp);
 assert.equal(original.damage,linked.damage);
});

test('intercept, pincer, press and screen yield different physical flight paths',()=>{
 const positions=[];
 for(const mode of ['intercept','pincer','press','screen']){
  const fighter=ship(2,'fighter',220,60),medic=ship(3,'healer',100,140);
  const game=scene([fighter,medic]);game.time=1;
  const intel={x:0,y:0,vx:180,vy:30,at:1};
  game.enemyComms.directiveFor=()=>({mode,side:1,intel,
    leader:fighter,medic});
  updateEnemy(fighter,game,.25);
  positions.push([fighter.vx.toFixed(4),fighter.vy.toFixed(4)]);
 }
 assert.equal(new Set(positions.map(x=>x.join(','))).size,4);
});

test('rendered world-space pulses correspond to messages and have a hard density cap',()=>{
 const a=ship(1,'scout',90,70),b=ship(2,'fighter',160,70);
 const net=new EnemyComms();net.send(a,b,'contact',1);
 let lines=0,dots=0,move=null,to=null;
 const ctx={save(){},restore(){},setLineDash(){},beginPath(){},
  moveTo(x,y){move=[x,y];},lineTo(x,y){to=[x,y];},stroke(){lines++;},
  arc(){dots++;},fill(){}};
 const cam={x:60,y:40,w:500,h:300};
 assert.equal(net.render(ctx,cam,1.23,false,60),1);
 assert.deepEqual(move,[a.x,a.y]);assert.deepEqual(to,[b.x,b.y]);
 assert.equal(lines,1);assert.equal(dots,1);
 dots=0;net.render(ctx,cam,1.23,true,60);
 assert.equal(dots,0,'reduced-motion preference removes moving dots');
 for(let i=0;i<150;i++)net.send(a,b,'relay',1.3);
 assert.ok(net.events.length<=ENEMY_COMMS.maxEvents);
 assert.ok(net.render(ctx,cam,1.5,false,60)<=ENEMY_COMMS.maxDrawn);
 assert.equal(net.render(ctx,{x:600,y:400,w:100,h:100},1.5),0);
});

test('visible captions identify actual majority decisions at elected callers',()=>{
 const scout=ship(1,'flanker',90),fighter=ship(2,'fighter',160);
 const game=scene([scout,fighter]),net=game.enemyComms;
 net.update(game);net.reportSight(scout,game.player,.1);
 game.playerCanInspectEnemyIntent=()=>true;
 game.time=.7;net.update(game);execute(game);
 const labels=[];
 const ctx={save(){},restore(){},setLineDash(){},beginPath(){},
  moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},fillRect(){},strokeRect(){},
  fillText(...args){labels.push(args);}};
 net.render(ctx,{x:0,y:0,w:300,h:200},.8,false,60,game);
 assert.ok(labels.some(([message,x,y])=>message==='ПЕРЕХВАЧЕН ПРИКАЗ · ОБХОД'&&
  x===fighter.x&&y<fighter.y));
 const count=labels.length;
 net.render(ctx,{x:0,y:0,w:300,h:200},4.4,false,60,game);
 assert.equal(labels.length,count,'a decision caption must disappear promptly');
});

test('a subtle persistent line exists only while an acknowledged order is active',()=>{
 const a=ship(1,'scout',90),b=ship(2,'fighter',160);
 const game=scene([a,b]),net=game.enemyComms;
 net.update(game);net.reportSight(a,game.player,.1);
 game.time=.7;net.update(game);
 let strokes=0;
 const ctx={save(){},restore(){},setLineDash(){},beginPath(){},
  moveTo(){},lineTo(){},stroke(){strokes++;},arc(){},fill(){},fillText(){}};
 net.render(ctx,{x:0,y:0,w:300,h:200},1.65,false,60);
 assert.ok(strokes>=1,'the network remains visible after the brief message fades');
 b.x=850;strokes=0;
 net.render(ctx,{x:0,y:0,w:900,h:200},1.66,false,60);
 assert.equal(strokes,0,'the persistent line disappears if range is broken');
});

test('a dense 200-ship formation uses bounded cells and keeps all commanders alive',()=>{
 const ships=Array.from({length:200},(_,i)=>
  ship(i+1,i%7===0?'fighter':'scout',200+(i%20)*8,120+Math.floor(i/20)*8));
 const game=scene(ships),net=game.enemyComms;
 const start=performance.now();
 for(let step=0;step<16;step++){
  game.time=step*.7;
  for(const e of ships)net.reportSight(e,game.player,game.time);
  net.update(game);
  assert.ok(net.cells.every(c=>c.members.length<=ENEMY_COMMS.cellSize));
  assert.ok(net.events.length<=ENEMY_COMMS.maxEvents);
 }
 assert.ok(performance.now()-start<1300,'bounded group planning must be mobile-safe');
 assert.ok(net.cells.length>=25&&net.cells.length<=200);
 assert.ok(net.decisions>0&&net.messages>0);
});

test('the public module chain loads the new tactical network instead of cached code',()=>{
 const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
 assert.match(read('index.html'),/game\.js\?v=[^"']*enemy-comms-1/);
 assert.match(read('game.js'),/ai\.js\?v=enemy-learning-1-enemy-comms-1/);
 assert.match(read('game.js'),/enemy-comms\.js\?v=enemy-comms-1/);
 assert.match(read('ai.js'),/iris-choreography\.js\?v=[^"']*enemy-comms-1/);
});
