import test from 'node:test';
import assert from 'node:assert/strict';
import {rescueArmedDrone,rescueGuardDestination,rescuePursuitDestination}
 from '../rescue-formation.js';
import {scoutAttack,updateEnemy} from '../ai.js';
import {updateEnemyGunnery} from '../enemy-gunnery.js';

test('the two sentries stay at their assigned posts instead of circling the capsule',()=>{
 const capsule={x:500,y:700,hp:100};
 const guards=[
  {serial:1,openingRescueRole:'guard',rescueSlot:0,x:335,y:785,protect:capsule,
   guardPost:{x:335,y:785}},
  {serial:2,openingRescueRole:'guard',rescueSlot:1,x:635,y:600,protect:capsule,
   guardPost:{x:635,y:600}}
 ];
 for(const guard of guards)for(const time of [0,30,100,300]){
  const post=rescueGuardDestination(guard,time);
  assert.ok(Math.hypot(post.x-guard.guardPost.x,post.y-guard.guardPost.y)<16);
  assert.ok(Math.hypot(post.x-capsule.x,post.y-capsule.y)>105);
 }
 assert.equal(rescueArmedDrone(guards[0]),true);
 assert.equal(rescueArmedDrone({openingRescueRole:'tug'}),false);
 const legacy=guards.map(({guardPost,rescueSlot,...other})=>other);
 assert.ok(rescueGuardDestination(legacy[0],0).x<capsule.x);
 assert.ok(rescueGuardDestination(legacy[1],0).x>capsule.x);
});

test('the tug escort holds a moving flank and the pursuers intercept the cargo route',()=>{
 const tug={hp:95,x:350,y:500,vx:95,vy:0,
  missionFlight:{x:850,y:500,speed:94}};
 const escort={openingRescueRole:'escort',rescueSlot:1,protect:tug};
 const first=rescueGuardDestination(escort,30);
 assert.ok(first.x<tug.x&&first.y>tug.y);
 tug.x+=100;
 const next=rescueGuardDestination(escort,31);
 assert.equal(next.x-first.x,100);
 assert.equal(next.y,first.y);
 const arc={status:'active',kind:'rescue',rescueStage:'return',
  rescueCargoX:700,rescueCargoY:1000};
 const pursuer={openingRescueRole:'pursuer',rescueSlot:0};
 const target=rescuePursuitDestination(pursuer,arc,{x:1200,y:1000},40);
 assert.ok(target.x>arc.rescueCargoX&&target.y<arc.rescueCargoY);
 assert.equal(rescuePursuitDestination({...pursuer,_enemyLearningSaw:true},arc,
  {x:1200,y:1000},40),null);
 assert.equal(rescuePursuitDestination({...pursuer,_awarenessLast:{at:39}},arc,
  {x:1200,y:1000},40),null);
 assert.equal(rescuePursuitDestination(pursuer,{...arc,rescueStage:'extract'},
  {x:1200,y:1000},40),null);
});

test('armed rescue fighters warn and fire, while the tug cannot abandon capture to shoot',()=>{
 const shots=[],player={x:0,y:0,vx:0,vy:0,hp:110};
 const game={time:10,player,enemyCanSee:()=>true,
  enemyShot:(...args)=>{shots.push(args);return true;}};
 const fighter={type:'fighter',openingRescueRole:'guard',missionStructure:true,
  serial:10,x:205,y:0,hp:58,state:'guard',_enemyLearningSaw:true,
  _gunNextAt:0};
 updateEnemyGunnery(fighter,game,player);
 assert.ok(fighter._gunAiming,'the player sees a real warning');
 game.time=10.8;
 assert.equal(updateEnemyGunnery(fighter,game,player),true);
 assert.equal(shots.length,1);
 const tug={...fighter,openingRescueRole:'tug',_gunAiming:null,_gunNextAt:0};
 game.time=11.3;
 assert.equal(updateEnemyGunnery(tug,game,player),false);
 assert.equal(tug._gunAiming,null);
});

test('rescue scouts use normal visible, paced shots',()=>{
 const shots=[],player={x:0,y:0,hp:110};
 const scout={type:'scout',openingRescueRole:'escort',missionStructure:true,
  serial:4,x:220,y:0,hp:38,fire:-.1};
 const game={time:10,player,enemyCanSee:()=>true,
  enemyShot:(...args)=>{shots.push(args);return true;}};
 assert.equal(scoutAttack(scout,game,player),false);
 game.time=10.4;
 assert.equal(scoutAttack(scout,game,player),true);
 assert.equal(shots.length,1);
 assert.equal(scoutAttack(scout,game,player),false,'the same shot is not repeated');
});

test('actual rescue sentry AI holds its position, then fights a detected pilot',()=>{
 const anchor={x:400,y:500,hp:100},shots=[];
 const guard={serial:3,group:1,type:'fighter',x:235,y:585,
  vx:0,vy:0,r:18,hp:58,maxHp:58,damage:12,think:.2,fire:1.2,
  state:'guard',commitUntil:0,missionStructure:true,
  openingRescueRole:'guard',rescueSlot:0,guardPost:{x:235,y:585},
  protect:anchor};
 const player={x:1300,y:800,vx:0,vy:0,hp:100,r:19,invul:99};
 const game={time:1,player,enemies:[guard],allies:[],missiles:[],shots:[],
  avoidance:()=>({x:0,y:0}),enemyCanSee:()=>false,
  grid:{query:()=>[guard]},heritage:{play(){},vfx:{shipExplosion(){}}},
  enemyShot:(...args)=>{shots.push(args);return true;},hurt(){}};
 for(let i=0;i<40;i++){game.time+=.1;updateEnemy(guard,game,.1);}
 assert.ok(Math.hypot(guard.x-guard.guardPost.x,guard.y-guard.guardPost.y)<30);
 assert.equal(shots.length,0,'the sentry does not fire at an unseen pilot');
 player.x=400;player.y=480;game.enemyCanSee=()=>true;
 for(let i=0;i<50;i++){game.time+=.1;updateEnemy(guard,game,.1);}
 assert.ok(shots.length>=1,'the same sentry actively fights on visual contact');
});
