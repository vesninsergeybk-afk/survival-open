import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EnemyComms,ENEMY_COMMS,collectiveDecision,enemyOrderMessage,
 classifyEnemyAttack,assessEnemyThreat} from '../enemy-comms.js';
import {updateEnemy} from '../ai.js';

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
 assert.equal(classifyEnemyAttack('beam',290),'long');
 assert.equal(classifyEnemyAttack('howitzer',450),'area');
 assert.equal(classifyEnemyAttack('ion',90),'area');
 assert.equal(classifyEnemyAttack('beam',130),'close');
 assert.equal(classifyEnemyAttack('storm',380),null);
 assert.equal(classifyEnemyAttack('rocket',NaN),null);
 assert.equal(assessEnemyThreat([{kind:'long',at:1}],2),null);
 assert.equal(assessEnemyThreat([{kind:'long',at:1},{kind:'long',at:1.2}],2),null);
 assert.equal(assessEnemyThreat([{kind:'long',at:1},{kind:'long',at:2.3}],3).kind,'long');
 assert.equal(assessEnemyThreat([{kind:'long',at:1},{kind:'long',at:2.3}],10),null);
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
 net.reportAttack(fighter,'beam',330,2.8);
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

test('only an acknowledged, visible radio order enters the intercepted log',()=>{
 const scout=ship(1,'scout',90),fighter=ship(2,'fighter',150);
 const game=scene([scout,fighter]),net=game.enemyComms;
 game.playerCanInspectEnemyIntent=()=>false;
 net.update(game);net.reportSight(scout,game.player,.1);
 game.time=.7;net.update(game);
 assert.equal(net.intercepted(game.time).length,0,
  'a hidden enemy cannot be eavesdropped from the map');
 const visible=scene([ship(1,'scout',90),ship(2,'fighter',150)]);
 visible.playerCanInspectEnemyIntent=()=>true;
 const radio=visible.enemyComms;
 radio.update(visible);radio.reportSight(visible.enemies[0],visible.player,.1);
 visible.time=.7;radio.update(visible);
 const capture=radio.intercepted(.7);
 assert.equal(capture.length,1);
 assert.equal(capture[0].mode,radio.cells[0].mode);
 assert.equal(capture[0].message,enemyOrderMessage(capture[0].mode));
 const labels=[];
 const ctx={save(){},restore(){},setLineDash(){},beginPath(){},
  moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},
  fillRect(){},strokeRect(){},fillText(s){labels.push(s);}};
 radio.render(ctx,{x:0,y:0,w:400,h:260},.9);
 assert.ok(labels.some(line=>line.includes('ПЕРЕХВАЧЕН ПРИКАЗ')));
 assert.ok(labels.some(line=>capture[0].message.includes(line)),
  'world-space subtitle must be derived from the captured message');
 assert.equal(radio.intercepted(31).length,0,'old intercepts leave the map');
});

test('a long-distance counter-order is visible only after two real transmitted hits',()=>{
 const scout=ship(1,'scout',90),fighter=ship(2,'fighter',160);
 const game=scene([scout,fighter]),net=game.enemyComms;
 game.playerCanInspectEnemyIntent=()=>true;
 net.update(game);net.reportSight(scout,game.player,.1);
 game.time=.7;net.update(game);
 net.reportAttack(scout,'rail',345,1.5);
 game.time=1.6;net.update(game);
 assert.equal(net.intercepted(1.6).length,1);
 net.reportAttack(fighter,'beam',330,2.8);
 net.reportSight(scout,game.player,2.8);
 game.time=2.9;net.update(game);
 game.time=3.7;net.update(game);
 assert.equal(net.intercepted(3.7)[0].mode,'close');
 assert.match(net.intercepted(3.7)[0].message,/бьёт издалека/);
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
 net.reportSight(other,game.player,2.1);
 game.time=2.3;net.update(game);
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
 const scout=ship(1,'scout',90),fighter=ship(2,'fighter',160);
 const game=scene([scout,fighter]),net=game.enemyComms;
 net.update(game);net.reportSight(scout,game.player,.1);
 game.time=.7;net.update(game);
 const labels=[];
 const ctx={save(){},restore(){},setLineDash(){},beginPath(){},
  moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},
  fillText(...args){labels.push(args);}};
 net.render(ctx,{x:0,y:0,w:300,h:200},.8,false,60);
 assert.ok(labels.some(([message,x,y])=>message==='ПЕРЕХВАТ'&&
  x===fighter.x&&y<fighter.y));
 net.render(ctx,{x:0,y:0,w:300,h:200},3.2,false,60);
 assert.equal(labels.length,1,'a decision caption must disappear promptly');
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
