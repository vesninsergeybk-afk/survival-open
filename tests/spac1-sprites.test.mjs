import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {SPAC1_COUNTS,SPAC1_MANIFEST,spac1Direction,spac1FrameRef,spac1PoseFrames,spac1StrideAdvance,spac1GaitStep,spac1TurnStep,spac1TravelSample} from '../src/spac1-sprites.js';

assert.equal(SPAC1_MANIFEST.total,176);
assert.deepEqual({...SPAC1_COUNTS},{idle:6,walk:8,attack:8});
assert.deepEqual([0,Math.PI/2,Math.PI,Math.PI*1.5].map(spac1Direction),[4,6,0,2]);
assert.equal(spac1Direction(-Math.PI/2),2);
const root=join(dirname(fileURLToPath(import.meta.url)),'../assets/prologue/spac1');
const expected={
  idleOriginal:['idle-original.png',4,2],
  idleExtra:['idle-extra.png',5,8],
  walkOriginal:['walk-original.png',4,8],
  walkExtra:['walk-extra.png',4,8],
  attackOriginal:['attack-original.png',4,8],
  attackExtra:['attack-extra.png',4,8]
};
for(const [key,[file,cols,rows]] of Object.entries(expected)){
  const bytes=readFileSync(join(root,file));
  assert.equal(bytes.subarray(1,4).toString('ascii'),'PNG',file);
  assert.ok(bytes.readUInt32BE(16)>=cols*90,file+' width');
  assert.ok(bytes.readUInt32BE(20)>=rows*90,file+' height');
}
for(let direction=0;direction<8;direction++)for(const state of ['idle','walk','attack']){
 const seen=new Set();
 for(let frame=0;frame<SPAC1_COUNTS[state];frame++){
  const ref=spac1FrameRef(state,direction,frame);
  const [,cols,rows]=expected[ref.key];
  assert.ok(ref.col>=0&&ref.col<cols&&ref.row>=0&&ref.row<rows);
  const identity=ref.key+':'+ref.row+':'+ref.col;
  assert.ok(!seen.has(identity),state+' '+direction+' duplicate frame '+identity);
  seen.add(identity);
 }
}
for(const state of ['idle','walk','attack']) {
 const count=SPAC1_COUNTS[state];
 for(let phase=-count;phase<=count*2;phase+=.125){
  const p=spac1PoseFrames(state,phase);
  assert.ok(p.frame>=0&&p.frame<count);
  assert.equal(p.next,(p.frame+1)%count);
  assert.ok(p.mix>=0&&p.mix<=1);
 }
}
assert.equal(spac1StrideAdvance(0),0);
assert.equal(spac1StrideAdvance(64),8);
assert.equal(spac1StrideAdvance(-5),0);
assert.equal(spac1StrideAdvance(NaN),0);
assert.equal(spac1GaitStep(3),.375);
assert.equal(spac1GaitStep(80),1.25,'low FPS does not skip the whole cycle');
assert.equal(spac1TurnStep(4,0),3,'reverse turn advances one view');
assert.equal(spac1TurnStep(7,0),0,'direction wrap is continuous');
assert.equal(spac1TurnStep(0,7),7,'reverse direction wrap is continuous');
const reversingScout={x:0,y:0,prologueTravel:20};
assert.equal(spac1TravelSample(reversingScout,0,0),20,
    'a patrol that returns to its start still completed a stride');
assert.equal(reversingScout.prologueTravel,0,'render consumes accumulated movement');
const fallbackScout={x:3,y:4};
assert.equal(spac1TravelSample(fallbackScout,0,0),5,
    'preview actors without physics samples still animate');
assert.equal(SPAC1_MANIFEST.interpolated,false);
console.log('SPAC-1 mapping and continuous gait OK: 176 cells, 8 directions.');