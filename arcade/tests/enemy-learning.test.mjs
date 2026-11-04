import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EnemyLearning,ENEMY_STYLES,ENEMY_LEARNING_KEY,learnedTurretAim}
  from '../enemy-learning.js';
import {updateEnemy,scoutSteering,ENEMY_TYPES} from '../ai.js';

const store=()=>{
  const data=new Map();return {data,
    getItem:key=>data.get(key)||null,
    setItem:(key,value)=>data.set(key,value)};
};
const actor=(type,serial=1)=>({type,serial,x:260,y:110,vx:0,vy:0,
  r:14,hp:ENEMY_TYPES[type]?.hp||70,maxHp:ENEMY_TYPES[type]?.hp||70,
  state:'hunt',think:10,fire:10,damage:10,commitUntil:0});
const player=()=>({x:0,y:0,vx:180,vy:30,r:19,hp:100,shield:0,invul:100});
function flight(type,style,options={}){
 const e=actor(type),p=player();e.state=options.state||'hunt';
 Object.assign(e,options.flags||{});
 const learner=new EnemyLearning();learner.choose=()=>style;
 const others=options.others||[];
 const game={time:1,player:p,allies:[],missiles:[],operation:null,
   enemyLearning:learner,grid:{query:()=>others},rockGrid:{query:()=>[]},
   avoidance:()=>({x:0,y:0}),enemyCanSee:()=>false,
   heritage:{play(){},vfx:{shipExplosion(){}}},enemyShot:()=>true,hurt(){}};
 updateEnemy(e,game,.2);
 return {e,p,game};
}

test('every autonomous enemy archetype and turret has multiple legal learnable styles',()=>{
 assert.deepEqual(Object.keys(ENEMY_STYLES).sort(),
  ['berserker','fighter','flanker','gunship','healer','scout','turret']);
 for(const styles of Object.values(ENEMY_STYLES))assert.ok(styles.length>=3);
 assert.equal(new EnemyLearning().choose('unknown'),null);
});

test('the published browser module graph invalidates cached pre-learning tactics',()=>{
 const ai=readFileSync(new URL('../ai.js',import.meta.url),'utf8');
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/game\.js\?v=[^"']*enemy-learning-1/);
 assert.match(game,/ai\.js\?v=enemy-learning-1/);
 assert.match(game,/enemy-learning\.js\?v=enemy-learning-1/);
 assert.match(ai,/iris-choreography\.js\?v=iris-pack-1-enemy-learning-1/);
});

test('the learner tries untested alternatives before exploiting a lucky early hit',()=>{
 const model=new EnemyLearning();
 const first=model.choose('scout','slow',1);
 model.record('scout','slow',first,1);
 const second=model.choose('scout','slow',1);
 assert.notEqual(first,second);
});

test('online outcome feedback changes the next tactical choice in the same context',()=>{
 const model=new EnemyLearning();
 for(let i=0;i<25;i++){
   model.record('scout','slow','weave',.08);
   model.record('scout','slow','diverge',.94);
   model.record('scout','slow','cutoff',.1);
 }
 assert.equal(model.choose('scout','slow',1),'diverge');
 assert.ok(model.summary('scout','slow').find(x=>x.style==='diverge').average>.9);
 assert.equal(model.summary('scout','turning')[1].samples,0,
  'learning does not assume the same counter works against a turning player');
});

test('combat results, healing, shots and deaths are credited to the selected trial',()=>{
 const model=new EnemyLearning(),ship=actor('fighter');
 const chosen=model.styleFor(ship,0);
 const original=model.shotToken(ship);
 model.fired(ship);model.dealt(original,9);model.damaged(ship,10);
 const reward=model.finish(ship,4);
 assert.ok(reward>.45&&reward<1);
 assert.equal(model.summary('fighter','slow').find(x=>x.style===chosen).samples,1);
 assert.equal(model.finish(ship,5),null,'a finished outcome cannot train twice');
 const healer=actor('healer');model.styleFor(healer,5);
 model.supported(healer,16);model.finish(healer,8);
 assert.ok(model.summary('healer','slow').some(x=>x.average>.5));
});

test('the system never rewards idle enemies for surviving outside combat',()=>{
 const model=new EnemyLearning(),ship=actor('fighter');
 model.styleFor(ship,0);model.finish(ship,20);
 assert.ok(model.summary('fighter','slow').every(x=>x.samples===0));
});

test('a projectile landing after the shooter dies still trains its original tactic',()=>{
 const model=new EnemyLearning(),ship=actor('scout');
 model.styleFor(ship,1);
 const chosen=ship._enemyLearning.style,token=model.shotToken(ship);
 model.fired(ship);
 model.finish(ship,1.5);
 const before=model.summary('scout','slow').find(x=>x.style===chosen).average;
 model.dealt(token,8);
 const row=model.summary('scout','slow').find(x=>x.style===chosen);
 assert.equal(row.samples,1);
 assert.ok(row.average>before+.5);
 assert.equal(model.finish(ship,3),null);
});

test('persistent memory round-trips, validates inputs and allows recent experience to supersede old',()=>{
 const storage=store(),model=new EnemyLearning(storage);
 model.record('turret','straight','lead',.9);
 assert.ok(model.flush(18));
 assert.ok(storage.data.has(ENEMY_LEARNING_KEY));
 const loaded=new EnemyLearning(storage);
 assert.equal(loaded.summary('turret','straight')[1].samples,1);
 for(let i=0;i<180;i++)loaded.record('turret','straight','lead',.25);
 assert.ok(loaded.summary('turret','straight')[1].samples<=120);
 const bad=store();bad.setItem(ENEMY_LEARNING_KEY,'{invalid');
 assert.equal(new EnemyLearning(bad).summary('turret','slow')[0].samples,0);
 const hostile=store();hostile.setItem(ENEMY_LEARNING_KEY,
  JSON.stringify({version:1,models:{'turret/slow':{direct:{n:999999,sum:99999}}}}));
 assert.ok(new EnemyLearning(hostile).summary('turret','slow')[0].samples<=120);
 const restricted={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 const guarded=new EnemyLearning(restricted);
 assert.ok(guarded.choose('scout'));
 guarded.record('scout','slow','weave',.7);
 assert.equal(guarded.flush(),false);
});

test('player movement model distinguishes steady flight from repeated turns',()=>{
 const model=new EnemyLearning();
 assert.equal(model.observePlayer({vx:100,vy:0},0),'straight');
 model.observePlayer({vx:100,vy:0},.3);
 assert.equal(model.context,'straight');
 for(let i=1;i<=6;i++){
  const a=i*1.2;model.observePlayer({vx:120*Math.cos(a),vy:120*Math.sin(a)},.3+i*.3);
 }
 assert.equal(model.context,'turning');
 assert.ok(model.turning>.16);
 assert.equal(model.observePlayer({vx:0,vy:0},2.5),'slow');
});

test('moving turrets use capped, imperfect predictions and never change damage or fire rate',()=>{
 const p={x:10,y:20,vx:300,vy:160};
 const direct=learnedTurretAim(p,'direct');
 const lead=learnedTurretAim(p,'lead');
 const turn=learnedTurretAim(p,'counterturn',.8);
 assert.deepEqual(direct,{x:10,y:20});
 assert.ok(lead.x>direct.x&&lead.x<=50);
 assert.notDeepEqual(turn,lead);
 assert.ok(Math.abs(turn.x-p.x)<75&&Math.abs(turn.y-p.y)<75);
 assert.ok(Object.values(ENEMY_TYPES).every(x=>x.hp>0&&x.dmg>0));
});

test('each mobile enemy actually executes different flight or support decisions',()=>{
 for(const [type,state,left,right] of [
   ['fighter','hunt','sweep','intercept'],
   ['flanker','flank','orbit','wide'],
   ['berserker','hunt','direct','offset'],
   ['gunship','standoff','standoff','sideslip']
 ]){
  const a=flight(type,left,{state}).e,b=flight(type,right,{state}).e;
  assert.notDeepEqual([a.x,a.y,a.vx,a.vy],[b.x,b.y,b.vx,b.vy],
   `${type}: two learned styles must produce different real steering`);
 }
 const a=actor('scout'),g={time:1,missiles:[]},p=player();
 a._enemyLearning={style:'weave'};
 const straight=scoutSteering(a,g,p,120);
 a._enemyLearning.style='diverge';
 assert.notDeepEqual(scoutSteering(a,g,p,120),straight);
 const first=actor('healer');first.x=210;first.y=105;
 const second=actor('fighter');second.x=130;second.y=110;
 first.hp=70;first.maxHp=100;second.hp=10;second.maxHp=100;
 const near=flight('healer','nearest',{state:'heal',others:[first,second]}).e;
 const urgent=flight('healer','critical',{state:'heal',others:[first,second]}).e;
 assert.equal(near.healTarget,first);
 assert.equal(urgent.healTarget,second);
});

test('boss scripts, objective attackers and converted ships retain their non-learning orders',()=>{
 for(const flags of [{boss:true},{missionStructure:true},{relayAssault:'outpost'},
   {interceptCargo:true}]){
  const {e}=flight('fighter','pressure',{flags});
  assert.equal(e._enemyLearning,undefined,
   'an authored mission may not be redirected by adaptive tactics');
 }
 const {e}=flight('fighter','intercept',{flags:{converted:true,convertedTime:10}});
 assert.equal(e._enemyLearning,undefined);
});

test('200 newly observed opponents stagger expensive line-of-sight checks',()=>{
 const model=new EnemyLearning(),p=player(),enemies=Array.from({length:200},(_,i)=>
  actor('fighter',i+1));
 let samples=0;
 const game={time:1,player:p,allies:[],missiles:[],operation:null,
  enemyLearning:model,grid:{query:()=>[]},rockGrid:{query:()=>[]},
  avoidance:()=>({x:0,y:0}),enemyCanSee:()=>{samples++;return true;},
  heritage:{play(){}},enemyShot:()=>true,hurt(){}};
 for(const e of enemies)updateEnemy(e,game,.016);
 assert.ok(samples<=33,`first tick traced ${samples} rays for 200 opponents`);
 game.time=1.25;
 for(const e of enemies)updateEnemy(e,game,.016);
 assert.equal(samples,200,'all enemy squads eventually sample the visible player');
});

test('thousands of role decisions remain bounded with many enemies and no neural runtime',()=>{
 const model=new EnemyLearning();
 const start=performance.now();
 for(let i=0;i<8000;i++){
  const type=Object.keys(ENEMY_STYLES)[i%7];
  const ship=actor(type==='turret'?'scout':type,i);
  model.styleFor(ship,1,type);model.damaged(ship,2);model.finish(ship,2);
 }
 assert.ok(performance.now()-start<1400,
  'the director must not do a large inference pass per drone');
});
