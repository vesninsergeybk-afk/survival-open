import test from 'node:test';
import assert from 'node:assert/strict';
import {drawHostileProjectile,HOSTILE_SHOT_STYLES} from '../hostile-projectiles.js';
import {advanceBaseTurretGun,drawBaseTurretWarnings,BASE_TURRET_GUN} from '../base-turret-gunnery.js';
import {packRun,unpackRun} from '../run-checkpoint.js';
import {readFileSync} from 'node:fs';

function drawing(){
 const strokes=[],arcs=[];let current=[];
 const c={save(){},restore(){},translate(){},rotate(){},setLineDash(){},
  beginPath(){current=[];},moveTo(x,y){current.push([x,y]);},lineTo(x,y){current.push([x,y]);},
  arc(x,y,r){arcs.push({x,y,r});},stroke(){strokes.push({color:this.strokeStyle,width:this.lineWidth,
   path:current.slice()});}};
 return {c,strokes,arcs};
}

test('hostile weapon families have distinct directed vector silhouettes, including base turret',()=>{
 const fingerprints=[];
 for(const [kind,style] of Object.entries(HOSTILE_SHOT_STYLES)){
  const d=drawing();
  assert.equal(drawHostileProjectile(d.c,{x:10,y:3,vx:320,vy:70,kind},false),true);
  assert.ok(d.strokes.length>=3,kind);
  assert.equal(d.strokes[0].color,style.outer);
  fingerprints.push(JSON.stringify(d.strokes));
 }
 assert.equal(new Set(fingerprints).size,fingerprints.length);
 assert.notEqual(HOSTILE_SHOT_STYLES['base-turret'].shape,
  HOSTILE_SHOT_STYLES.laser.shape);
 assert.equal(drawHostileProjectile(drawing().c,{x:NaN,y:0,vx:1,vy:0}),false);
 const production=readFileSync(new URL('../visuals.js',import.meta.url),'utf8');
 assert.doesNotMatch(production,/drawEnemyBolt/,'old red dumbbell asset is still used');
});

const fixture=()=>{
 const player={x:0,y:0,vx:0,vy:0,hp:90,r:19};
 const turret={x:280,y:50,hp:120,shot:0,id:2};
 const shots=[];
 const base={enemy:true,captured:false,turrets:[turret]};
 const game={time:2,player,enemyCanSee:()=>true,
  world:{nearbyStations:()=>[base]},
  enemyShot(x,y,tx,ty,damage,options){shots.push({x,y,tx,ty,damage,options});return true;}};
 return {game,player,turret,shots};
};

test('base guns lock for over a second and never retarget a dodging pilot',()=>{
 const {game,player,turret,shots}=fixture();
 assert.equal(advanceBaseTurretGun(game,turret,2,player,.05),false);
 const locked={...turret._baseAim};
 assert.equal(locked.until-locked.started,BASE_TURRET_GUN.charge);
 player.x=170;player.y=210;
 game.time=2.8;
 assert.equal(advanceBaseTurretGun(game,turret,2,player,.75),false);
 assert.equal(shots.length,0);
 game.time=3.16;
 assert.equal(advanceBaseTurretGun(game,turret,2,player,.36),true);
 assert.equal(shots.length,1);
 assert.deepEqual([shots[0].tx,shots[0].ty],[locked.x,locked.y]);
 assert.equal(shots[0].options.kind,'base-turret');
 assert.equal(shots[0].damage,20);
 assert.equal(turret._baseAim,null);
});

test('station warning is the real locked line; cover cancels rather than silently releasing',()=>{
 const {game,player,turret,shots}=fixture();
 advanceBaseTurretGun(game,turret,1,player,.01);
 const locked={...turret._baseAim};
 const d=drawing(),cam={x:-80,y:-100,w:500,h:400};
 assert.equal(drawBaseTurretWarnings(d.c,game,cam,true),1);
 assert.ok(d.strokes.some(s=>s.path.some(([x,y])=>x===locked.x&&y===locked.y)));
 game.enemyCanSee=()=>false;game.time+=1.3;
 assert.equal(advanceBaseTurretGun(game,turret,1,player,1.3),false);
 assert.equal(shots.length,0);
 assert.equal(turret._baseAim,null);
 assert.equal(drawBaseTurretWarnings(d.c,game,cam,true),0);
});

test('rate-limited guns cannot initiate an invisible unannounced round',()=>{
 const {game,player,turret,shots}=fixture();
 assert.equal(advanceBaseTurretGun(game,turret,0,player,.1,false),false);
 assert.equal(turret._baseAim,undefined);
 game.time+=4;
 assert.equal(shots.length,0);
 assert.equal(advanceBaseTurretGun(game,turret,0,player,.1,true),false);
 assert.ok(turret._baseAim);
});

test('a charging turret preserves its target identity through graph checkpoint encoding',()=>{
 const {game,player,turret}=fixture();
 advanceBaseTurretGun(game,turret,0,player,.01);
 const restored=unpackRun(packRun({player,turret}));
 assert.equal(restored.turret._baseAim.target,restored.player);
 assert.ok(restored.turret._baseAim.until>restored.turret._baseAim.started);
});
