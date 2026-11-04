import test from 'node:test';
import assert from 'node:assert/strict';
import {game} from './weapons-scene.mjs';

// Register the production listeners. Only browser surfaces are replaced; clicks
// must traverse the real menu dispatcher and the real rental/loadout methods.
function withControls(g,work){
 const originalDocument=globalThis.document,originalWindow=globalThis.window;
 const listeners=new Map(),element={addEventListener(){},style:{},hidden:true};
 globalThis.document={addEventListener(){},querySelectorAll:()=>[],
  getElementById:id=>id==='creditsDialog'?null:element};
 globalThis.window={addEventListener(){}};
 g.overlay.addEventListener=(kind,listener)=>listeners.set(kind,listener);
 try{
  g.bind();assert.ok(listeners.has('click'));
  work((act,role='',disabled=false)=>{
   const button={dataset:{act,role},disabled,closest:()=>null};
   listeners.get('click')({target:{closest:()=>button}});
  });
 }finally{
  if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
  if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;
 }
}
function docked(){
 const g=game();g.shipLoadout.frame=0;g.shipLoadout.owned={plasma:1};
 g.paused=true;g.overlay.hidden=false;g.baseTab='hangar';return g;
}
for(const id of ['ion','resonator'])test(id+': visible station buttons borrow, apply, refill and return the actual module',()=>{
 const g=docked(),before=g.player.ore;
 withControls(g,click=>{
  click('loanField',id);
  assert.equal(g.fieldLoan?.moduleId,id,'the real click must reach rental logic');
  assert.ok(g.fieldTrialTaken);assert.equal(g.player.ore,before);
  assert.equal(g.weaponProfile[id],false,'borrowing still requires Apply');
  click('hgApply');assert.equal(g.weaponProfile[id],true);
  g.fieldLoan.charges=1;g.fieldLoan.cooldownUntil=22;
  click('fieldCharge');assert.equal(g.fieldLoan.charges,2);assert.equal(g.player.ore,before-8);
  assert.equal(g.fieldLoan.cooldownUntil,22,'a menu click cannot skip the reload');
  click('returnField');assert.equal(g.fieldLoan,null);assert.equal(g.weaponProfile[id],false);
  assert.ok(!g.hangarSession.draft.slots.includes(id));
 });
});
test('disabled controls cannot spend the trial and the existing ion actions remain functional',()=>{
 const g=docked();withControls(g,click=>{
  click('loanField','resonator',true);assert.equal(g.fieldLoan,null);assert.equal(g.fieldTrialTaken,false);
  click('loanIon');assert.equal(g.fieldLoan.moduleId,'ion');
  click('returnIon');assert.equal(g.fieldLoan,null);
 });
});
