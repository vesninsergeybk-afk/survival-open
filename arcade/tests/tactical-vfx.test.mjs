import test from 'node:test';
import assert from 'node:assert/strict';
import {drawTacticalVfx} from '../tactical-vfx.js';

function canvas(){
 const ops=[],ctx={ops};
 for(const method of ['save','restore','beginPath','arc','moveTo','lineTo',
  'stroke','fill','setLineDash'])ctx[method]=(...args)=>{
   for(const value of args.flat())if(typeof value==='number')
    assert.ok(Number.isFinite(value),`${method}: drawing received a non-finite coordinate`);
   ops.push([method,...args]);
  };
 return ctx;
}
const player=()=>({x:430,y:270,vx:70,vy:5,r:17});
const enemy=(x,y,id=1)=>({x,y,serial:id,hp:100,r:15,
 tacticalSlowUntil:40});
const field=(kind,other={})=>({kind,x:490,y:260,radius:180,
 until:40,confirmed:true,...other});
const game=(kind='trap',other={})=>({time:20,fps:60,
 player:player(),enemies:[enemy(500,280)],
 tactical:{equipped:kind,branches:{},effects:[field(kind)]},
 visuals:{reducedMotion:false},playerCanInspectEnemyIntent:()=>true,...other});
const camera={x:0,y:0,w:960,h:540};
const drawn=ctx=>ctx.ops.filter(x=>x[0]==='stroke'||x[0]==='fill').length;

test('all four tools have distinct, bounded visual geometry',()=>{
 const counts={};
 for(const kind of ['shell','decoy','trap','jam']){
  const g=game(kind),ctx=canvas();
  drawTacticalVfx(ctx,g,camera);
  assert.ok(drawn(ctx)>3,`${kind} must have a visible effect, not only a caption`);
  assert.ok(drawn(ctx)<100,`${kind} must not flood the canvas with strokes`);
  counts[kind]=drawn(ctx);
 }
 assert.ok(new Set(Object.values(counts)).size>=3,
  'each device needs its own recognizable outline and rhythm');
});

test('branches of gravity control are visibly different without changing game state',()=>{
 const patterns={};
 for(const branch of ['sink','snare']){
  const g=game('trap');g.tactical.branches.trap={path:branch,rank:2};
  const before=JSON.stringify(g.tactical),ctx=canvas();
  drawTacticalVfx(ctx,g,camera);
  assert.equal(JSON.stringify(g.tactical),before,'rendering must never change the save');
  patterns[branch]=ctx.ops;
 }
 assert.notDeepEqual(patterns.sink,patterns.snare);
});

test('the initial wave is tied to actual firing time and never painted forever',()=>{
 const g=game('pulse',{enemies:[]});g.tactical.effects=[];
 g.tactical.pulseAt=20;g.tactical.pulseX=430;
 g.tactical.pulseY=270;g.tactical.pulseRadius=165;
 const cast=canvas();drawTacticalVfx(cast,g,camera);
 assert.ok(drawn(cast)>4);
 g.time=20.55;
 const after=canvas();drawTacticalVfx(after,g,camera);
 assert.equal(drawn(after),0,'the shockwave must finish once its short effect ends');
});

test('quality settings reduce draw work without changing gameplay data',()=>{
 const high=game('trap'),low=game('trap',{fps:18});
 const a=canvas(),b=canvas(),before=JSON.stringify(low.tactical);
 drawTacticalVfx(a,high,camera);drawTacticalVfx(b,low,camera);
 assert.ok(drawn(b)<drawn(a));
 assert.equal(JSON.stringify(low.tactical),before);
});

test('reduced-motion drawings do not rotate or flicker with world time',()=>{
 const a=game('jam',{time:10,visuals:{reducedMotion:true}}),
  b=game('jam',{time:12,visuals:{reducedMotion:true}});
 const x=canvas(),y=canvas();drawTacticalVfx(x,a,camera);drawTacticalVfx(y,b,camera);
 assert.deepEqual(x.ops,y.ops);
});

test('field visuals are culled off-screen and cannot expose hidden decoy targets',()=>{
 const far=game('trap'),off=canvas();
 far.tactical.effects[0].x=4000;far.tactical.effects[0].y=5000;
 far.enemies=[];drawTacticalVfx(off,far,camera);
 assert.equal(drawn(off),0);
 const decoy=game('decoy');decoy.enemies=[{...enemy(550,260),
  _tacticalDecoyUntil:30}];
 decoy.playerCanInspectEnemyIntent=()=>false;
 const hidden=canvas();drawTacticalVfx(hidden,decoy,camera);
 const exposed=canvas();decoy.playerCanInspectEnemyIntent=()=>true;
 drawTacticalVfx(exposed,decoy,camera);
 assert.ok(drawn(exposed)>drawn(hidden),
  'a course line is allowed only for an inspectable, actually diverted enemy');
});

test('confirmed signal interruption has extra feedback; silent devices do not claim success',()=>{
 const g=game('jam');g.enemies=[];g.tactical.effects[0].confirmed=false;
 const silent=canvas();drawTacticalVfx(silent,g,camera);
 g.tactical.effects[0].confirmed=true;
 const hit=canvas();drawTacticalVfx(hit,g,camera);
 assert.ok(drawn(hit)>drawn(silent));
});
