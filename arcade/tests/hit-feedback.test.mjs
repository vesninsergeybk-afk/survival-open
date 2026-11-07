import test from 'node:test';
import assert from 'node:assert/strict';
import {recordHitFeedback,updateHitFeedback,drawHitFeedback,HIT_FEEDBACK_CAP}
 from '../hit-feedback.js';
import {damageTarget} from '../combat-targets.js';
import {contactOnCircle} from '../impact-geometry.js';
import {game} from './weapons-scene.mjs';

const families=['beam','rail','flak','rocket','ion','resonance','howitzer'];
const target=(hp=90)=>({x:180,y:90,r:22,hp,maxHp:100,type:'fighter',serial:11});
const contact=()=>contactOnCircle(180,90,22,0,90);
function canvas(){
 const marks=[],c={
  globalAlpha:1,lineWidth:1,strokeStyle:'',fillStyle:'',
  save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},
  arc(x,y,r){marks.push(['arc',this.strokeStyle,r,this.globalAlpha]);},
  stroke(){marks.push(['stroke',this.strokeStyle,this.lineWidth,this.globalAlpha]);},
  fill(){marks.push(['fill',this.fillStyle,this.globalAlpha]);}};
 return {c,marks};
}

test('all seven weapon families have distinct contact silhouettes, even at 15 FPS',()=>{
 const signatures=[];
 for(const source of families){
  const g={},t=target();
  assert.equal(recordHitFeedback(g,{kind:'enemy',target:t},22,source,contact(),100),true);
  const high=canvas(),low=canvas();
  drawHitFeedback(high.c,g.combatHitFx,60,false);
  drawHitFeedback(low.c,g.combatHitFx,15,true);
  assert.ok(high.marks.length>low.marks.length||high.marks.length>=3);
  assert.ok(low.marks.length>=2,source+' disappears at low FPS');
  signatures.push(high.marks.map(m=>m.slice(0,3).join(':')).join('|'));
 }
 assert.equal(new Set(signatures).size,families.length);
});

test('real applied damage, not weapon name, controls impact size',()=>{
 const close={},far={};
 recordHitFeedback(close,{kind:'enemy',target:target(70)},30,'beam',contact(),100);
 recordHitFeedback(far,{kind:'enemy',target:target(95)},5,'beam',contact(),100);
 assert.ok(close.combatHitFx[0].power>far.combatHitFx[0].power*2);
 const a=canvas(),b=canvas();
 drawHitFeedback(a.c,close.combatHitFx,60);
 drawHitFeedback(b.c,far.combatHitFx,60);
 assert.ok(Math.max(...a.marks.filter(m=>m[0]==='arc').map(m=>m[2]))>
  Math.max(...b.marks.filter(m=>m[0]==='arc').map(m=>m[2])));
});

test('damageTarget alone creates a contact marker at a real hull surface',()=>{
 const g=game(),enemy=target();
 g.grid.insert(enemy);
 const point=contactOnCircle(enemy.x,enemy.y,enemy.r,g.player.x,g.player.y);
 assert.equal(damageTarget(g,{kind:'enemy',target:enemy},12,'beam',point),12);
 assert.equal(g.combatHitFx.length,1);
 const hit=g.combatHitFx[0];
 assert.equal(hit.kind,'impact');assert.equal(hit.family,'plasma');
 assert.equal(hit.x,point.x);assert.equal(hit.y,point.y);
 assert.equal(hit.directed,true);
 assert.ok(enemy.hp<90);
});

test('damage threshold and death have separate truthful signatures',()=>{
 const g={},t=target(30);
 recordHitFeedback(g,{kind:'enemy',target:t},15,'rail',contact(),45);
 assert.deepEqual(g.combatHitFx.map(e=>e.kind),['impact','fracture']);
 updateHitFeedback(g,.5);
 t.hp=31;recordHitFeedback(g,{kind:'enemy',target:t},8,'rail',contact(),39);
 assert.deepEqual(g.combatHitFx.map(e=>e.kind),['impact'],
  'the same hull should not show a second critical crack after healing');
 const normal={};recordHitFeedback(normal,{kind:'enemy',target:target(80)},
  10,'rail',contact(),90);
 assert.deepEqual(normal.combatHitFx.map(e=>e.kind),['impact']);
 const finish={};recordHitFeedback(finish,{kind:'enemy',target:target(0)},
  45,'rail',contact(),45);
 assert.deepEqual(finish.combatHitFx.map(e=>e.kind),['impact','finish']);
 const captured={};recordHitFeedback(captured,{kind:'base',target:{
  ...target(30),captured:true}},70,'rail',contact(),100);
 assert.deepEqual(captured.combatHitFx.map(e=>e.kind),['impact']);
});

test('invalid or zero damage creates no invented impact; repeated hits stay bounded',()=>{
 const g={};
 assert.equal(recordHitFeedback(g,{kind:'enemy',target:target()},0,'beam',contact(),100),false);
 assert.equal(recordHitFeedback(g,{kind:'enemy',target:target()},NaN,'beam',contact(),100),false);
 assert.equal(recordHitFeedback(g,{kind:'enemy',target:target()},12,'other',contact(),100),false);
 assert.equal(g.combatHitFx,undefined);
 for(let i=0;i<100;i++){
  const t={...target(60),x:180+i};
  recordHitFeedback(g,{kind:'enemy',target:t},10,'ion',
   {x:t.x-22,y:t.y,nx:-1,ny:0,directed:true},70);
 }
 assert.equal(g.combatHitFx.length,HIT_FEEDBACK_CAP);
 const view=canvas();
 drawHitFeedback(view.c,g.combatHitFx,60,false,{x:-100,y:-100,w:10,h:10});
 assert.equal(view.marks.length,0,'off-screen impacts should not consume drawing time');
 updateHitFeedback(g,.5);
 assert.deepEqual(g.combatHitFx,[]);
});

test('closely repeated automatic hits coalesce without losing the stronger one',()=>{
 const g={},t=target(95);
 recordHitFeedback(g,{kind:'enemy',target:t},5,'beam',contact(),100);
 t.hp=75;recordHitFeedback(g,{kind:'enemy',target:t},20,'beam',contact(),95);
 assert.equal(g.combatHitFx.length,1);
 assert.ok(g.combatHitFx[0].power>.75);
 updateHitFeedback(g,.1);
 t.hp=65;recordHitFeedback(g,{kind:'enemy',target:t},10,'beam',contact(),75);
 assert.equal(g.combatHitFx.length,2);
});
