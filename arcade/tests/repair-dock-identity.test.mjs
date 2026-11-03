import test from 'node:test';
import assert from 'node:assert/strict';
import {RULES} from '../balance.js';
import {
 REPAIR_DOCK_SPEC,dockVariant,dockSerial,dockVisualState,
 markDockEvent,dockEventPhase,drawRepairDock
} from '../repair-dock-art.js';

function dock(id='0:0',extra={}){
 return {id,type:'dock',x:100,y:-200,active:false,captured:false,
  usedUpgrade:false,hp:760,maxHp:760,...extra};
}
function canvasStub(){
 let saves=0,restores=0,draws=0;
 const ctx={
  save(){saves++;},restore(){restores++;},beginPath(){},
  moveTo(){},lineTo(){},closePath(){},fill(){draws++;},stroke(){draws++;},
  translate(){},scale(){},rotate(){},arc(){},ellipse(){},fillRect(){draws++;},
  setLineDash(){},fillText(){}
 };
 return {ctx,stats:()=>({saves,restores,draws})};
}

test('a new dock uses the documented world geometry and interaction radius',()=>{
 assert.equal(REPAIR_DOCK_SPEC.interactionRadius,RULES.baseInteract);
 assert.equal(REPAIR_DOCK_SPEC.frame,224);
 assert.deepEqual(REPAIR_DOCK_SPEC.armPivots,[{x:-50,y:-19},{x:50,y:-19}]);
 const h=REPAIR_DOCK_SPEC.hullBounds;
 assert.ok(h.left>=-90&&h.right<=90&&h.top>=-90&&h.bottom<=90);
});

test('individual variations and serials are stable and never use random',()=>{
 const ids=['0:0','3:5','-1:2'];
 assert.deepEqual(ids.map(id=>dockVariant(dock(id))),[0,2,1]);
 const serials=ids.map(id=>dockSerial(dock(id)));
 assert.equal(new Set(serials).size,3);
 assert.equal(dockSerial(dock('0:0')),dockSerial(dock('0:0')));
 assert.ok(serials.every(x=>/^RD-\d{3}$/.test(x)));
});

test('power, network and purchased module are separate visual facts',()=>{
 const b=dock();
 assert.deepEqual(dockVisualState(b,true),{
  active:false,connected:false,variant:0,upgraded:false,damage:0
 });
 b.active=true;
 assert.equal(dockVisualState(b,false).connected,false);
 assert.equal(dockVisualState(b,true).connected,true);
 b.usedUpgrade=true;
 assert.equal(dockVisualState(b,true).upgraded,true);
 b.hp=370;
 assert.equal(dockVisualState(b,true).damage,1);
 b.hp=100;
 assert.equal(dockVisualState(b,true).damage,2);
 b.hp=760;
 assert.equal(dockVisualState(b,true).damage,0);
});

test('a rejected or expired station event does not create animation',()=>{
 const b=dock();
 assert.equal(markDockEvent(b,'repair',3),true);
 assert.deepEqual(dockEventPhase(b,3),{kind:'repair',progress:0});
 assert.equal(dockEventPhase(b,3+REPAIR_DOCK_SPEC.eventSeconds.repair),null);
 assert.equal(dockEventPhase(b,2),null);
 assert.equal(markDockEvent(b,'unapprovedTurret',5),false);
 assert.equal(markDockEvent(b,'repair',NaN),false);
 assert.equal(dockEventPhase(b,3.5)?.kind,'repair');
});

test('drawing a powered or unpowered dock never modifies the base',()=>{
 for(const active of [false,true]){
  const b=dock('3:5',{active,usedUpgrade:active,hp:180});
  markDockEvent(b,'repair',10);
  const snapshot=JSON.stringify(b);
  const {ctx,stats}=canvasStub();
  assert.equal(drawRepairDock(ctx,b,10.3,{connected:true}),true);
  const {saves,restores,draws}=stats();
  assert.equal(saves,restores,'Canvas state must be restored');
  assert.ok(draws>0,'fallback must draw a clear U-shaped hull');
  assert.equal(JSON.stringify(b),snapshot,'renderer must not mutate station state');
 }
});

test('same event works in static reduced motion state',()=>{
 const b=dock('2:4',{active:true});
 markDockEvent(b,'activate',4);
 const {ctx,stats}=canvasStub();
 drawRepairDock(ctx,b,4.5,{connected:false,reducedMotion:true});
 assert.equal(stats().saves,stats().restores);
 assert.equal(b.active,true);
});

test('the complete station render path never writes activation data',async()=>{
 const {ArcadeVisuals}=await import('../visuals.js');
 const prior=globalThis.document;
 const sky=()=>({style:{setProperty(){}},classList:{add(){},remove(){}}});
 globalThis.document={getElementById:id=>id==='sector'?{textContent:''}:sky()};
 try{
  const view=new ArcadeVisuals();
  const ctx=new Proxy({},{
   get(target,key){return key in target?target[key]:()=>{};},
   set(target,key,value){target[key]=value;return true;}
  });
  for(const base of [
   dock('0:0',{active:true}),
   dock('4:0',{active:true,captured:true,enemy:false,hp:0}),
   {...dock('1:2',{active:true}),type:'lab'},
   {...dock('1:3',{active:true}),type:'arsenal'},
   {...dock('1:4',{active:true}),type:'carrier'}
  ]){
   const before=JSON.stringify(base);
   view.drawBase(ctx,base,5,0,0,{},true);
   assert.equal(JSON.stringify(base),before,base.type);
   assert.equal(base.activationTime,undefined,base.type);
   assert.equal(base.activated,undefined,base.type);
  }
 }finally{globalThis.document=prior;}
});
