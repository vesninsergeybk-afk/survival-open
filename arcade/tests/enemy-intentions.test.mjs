import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {updateEnemy} from '../ai.js';
import {collectEnemyIntents,drawEnemyIntentions,
  enemyIntentMapPaths,ENEMY_INTENT_VIEW} from '../enemy-intentions.js';

const ship=(serial,x=180,y=90)=>({
  serial,type:'fighter',group:1,x,y,vx:0,vy:0,r:14,hp:70,maxHp:70,
  damage:10,think:12,fire:12,commitUntil:8,state:'hunt'
});
function scene(enemies){
  const player={x:0,y:0,vx:140,vy:0,hp:100,maxHp:100,r:20,invul:99};
  const game={time:1,player,enemies,allies:[],missiles:[],shots:[],
    avoidance:()=>({x:0,y:0}),enemyCanSee:()=>true,
    playerCanInspectEnemyIntent:()=>true,
    grid:{query:()=>enemies},
    heritage:{play(){},vfx:{shipExplosion(){}}},hurt(){},enemyShot(){return true;}};
  const leader=enemies[0],intel={x:0,y:0,vx:140,vy:0,at:game.time};
  let connected=true;
  game.enemyComms={directiveFor:e=>connected?{
    mode:'pincer',side:e.serial%2?1:-1,intel,leader
  }:null};
  return {game,disconnect(){connected=false;}};
}

test('only a radio order actually applied to steering creates a visual intention',()=>{
  const fighter=ship(1),{game}=scene([fighter]);
  assert.equal(collectEnemyIntents(game).length,0);
  updateEnemy(fighter,game,.016);
  const path=collectEnemyIntents(game);
  assert.equal(path.length,1);
  assert.equal(path[0].mode,'pincer');
  assert.ok(Math.abs(fighter._commsIntent.x)>30);
  assert.ok(Math.abs(fighter._commsIntent.y)>30,
    'the projected maneuver uses the actual flanking steering target');
  assert.ok(Math.hypot(path[0].toX-path[0].x,path[0].toY-path[0].y)
    <=ENEMY_INTENT_VIEW.maxHeading+1e-6);
});

test('silence, converted craft, timeouts and distant ships reveal no false plans',()=>{
  const fighter=ship(1),{game,disconnect}=scene([fighter]);
  updateEnemy(fighter,game,.016);
  disconnect();
  assert.deepEqual(collectEnemyIntents(game),[],
    'a remembered target cannot survive an interrupted radio network');
  const connected=scene([fighter]).game;
  updateEnemy(fighter,connected,.016);
  connected.time+=.3;
  assert.deepEqual(collectEnemyIntents(connected),[],
    'stale steering snapshots must not look like current plans');
  connected.time=1;fighter.converted=true;
  assert.deepEqual(collectEnemyIntents(connected),[]);
  fighter.converted=false;fighter.x=1000;
  assert.deepEqual(collectEnemyIntents(connected),[]);
});

test('scripted escorts and healers do not falsely advertise tactical paths',()=>{
  const fighter=ship(1),{game}=scene([fighter]);
  fighter.protect={x:100,y:90,hp:100};
  updateEnemy(fighter,game,.016);
  assert.equal(fighter._commsIntent,null);
  assert.deepEqual(collectEnemyIntents(game),[]);
});

test('dense groups display only two plans per cell and at most four total',()=>{
  const many=Array.from({length:38},(_,i)=>ship(i+1,80+(i%8)*15,50+Math.floor(i/8)*15));
  const {game}=scene(many);
  for(const e of many){
    e._commsCell={id:Math.floor(e.serial/7)};
    e._commsIntent={x:e.x+150,y:e.y-60,mode:'pincer',
      leader:many[0],at:1};
  }
  const rendered=collectEnemyIntents(game);
  assert.equal(rendered.length,4);
  assert.ok(rendered.every(p=>rendered.filter(q=>q.group===p.group).length<=2));
});

test('world and map use the same actual heading and the map draws no remote network',()=>{
  const fighter=ship(1),{game,disconnect}=scene([fighter]);
  updateEnemy(fighter,game,.016);
  const positions=[];
  const ctx={save(){},restore(){},setLineDash(){},beginPath(){},
    moveTo(x,y){positions.push(['from',x,y]);},
    lineTo(x,y){positions.push(['to',x,y]);},
    stroke(){},closePath(){},fill(){}};
  assert.equal(drawEnemyIntentions(ctx,{x:0,y:0,w:600,h:400},game),1);
  assert.equal(positions[0][1],fighter.x+19*(positions[1][1]-fighter.x)/
    Math.hypot(positions[1][1]-fighter.x,positions[1][2]-fighter.y));
  const map=enemyIntentMapPaths(game,(x,y)=>({x,y}),()=>true);
  assert.match(map,/Радиоприказ: обход/);
  assert.match(map,/enemy-map-intent/);
  game.playerCanInspectEnemyIntent=()=>false;
  assert.equal(enemyIntentMapPaths(game,(x,y)=>({x,y}),()=>true),'',
    'the map must not reveal a group hidden behind solid cover');
  game.playerCanInspectEnemyIntent=()=>true;
  disconnect();
  assert.equal(enemyIntentMapPaths(game,(x,y)=>({x,y}),()=>true),'');
  assert.equal(drawEnemyIntentions(ctx,{x:0,y:0,w:600,h:400},game),0);
});

test('game asset chain makes both map and tactical preview accessible to players',()=>{
  const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
  assert.match(read('index.html'),/game\.js\?v=[^"']*enemy-intents-2/);
  assert.match(read('game.js'),/enemy-intentions\.js\?v=enemy-intents-2/);
  assert.match(read('game.js'),/map-panel\.js\?v=menu-exit-1-enemy-intents-2/);
  assert.match(read('map-panel.js'),/enemyIntentMapPaths\(game/);
  assert.match(read('ai.js'),/e\._commsIntent=\{x:goalX,y:goalY/);
});
