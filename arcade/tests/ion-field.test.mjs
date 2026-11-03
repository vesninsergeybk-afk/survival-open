import test from 'node:test';
import assert from 'node:assert/strict';
import {ION_FIELD,ION_PERIOD,ionPhase,inIonField,ionApproach,drawIonField} from '../ion-field.js';
import {sectorAt} from '../visuals.js';

function context(){
 const calls=[],ctx={calls};
 for(const name of ['save','restore','setLineDash','beginPath','arc','stroke','fill',
   'fillText','moveTo','lineTo'])ctx[name]=(...args)=>calls.push([name,...args]);
 return ctx;
}

test('one Azure test field has deterministic warning and recovery intervals',()=>{
 assert.equal(sectorAt(ION_FIELD.x,ION_FIELD.y),1);
 assert.equal(ION_PERIOD,9);
 assert.equal(ionPhase(3.99).state,'idle');
 assert.equal(ionPhase(4).state,'warning');
 assert.equal(ionPhase(6.49).state,'warning');
 assert.equal(ionPhase(6.5).state,'discharge');
 assert.equal(ionPhase(7.1).state,'recovery');
 assert.equal(ionPhase(9).cycle,1);
 assert.equal(ionPhase(13).state,'warning');
 assert.ok(ionPhase(6.4).remaining<.11);
});

test('visible hazard and damage check use the same world-space radius',()=>{
 const r=ION_FIELD.r;
 assert.equal(inIonField({x:ION_FIELD.x+r+18,y:ION_FIELD.y,r:19}),true);
 assert.equal(inIonField({x:ION_FIELD.x+r+20,y:ION_FIELD.y,r:19}),false);
 assert.equal(ionApproach({x:ION_FIELD.x+r+640,y:ION_FIELD.y},ION_FIELD,650),true);
 const ctx=context();
 drawIonField(ctx,ION_FIELD,ionPhase(6.4),6.4,20,true);
 assert.equal(ctx.calls.find(c=>c[0]==='arc')[3],r);
 assert.ok(ctx.calls.some(c=>c[0]==='fillText'&&c[1].startsWith('РАЗРЯД')));
});

test('danger warning remains visible when optional graphics are disabled',()=>{
 const low=context(),high=context();
 drawIonField(low,ION_FIELD,ionPhase(6.7),6.7,18,true);
 drawIonField(high,ION_FIELD,ionPhase(6.7),6.7,60,false);
 assert.ok(low.calls.some(c=>c[0]==='stroke'));
 assert.ok(low.calls.filter(c=>c[0]==='arc').length>=1);
 assert.equal(low.calls.filter(c=>c[0]==='fill').length,0);
 assert.equal(high.calls.filter(c=>c[0]==='fill').length,1);
});
