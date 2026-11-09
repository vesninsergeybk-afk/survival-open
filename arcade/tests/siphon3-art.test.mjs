import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
 drawSiphon3,siphon3Frame,siphon3AtlasUrl,siphon3RigUrl,siphon3Pose,SIPHON3_FRAME_COUNT,
 siphon3EnergyState,SIPHON3_FRAME_RATE,SIPHON3_TILE,SIPHON3_WORLD_SIZE,
} from '../siphon3-art.js';

const relative=p=>fileURLToPath(new URL(p,import.meta.url));

test('80 distinct time positions form a seamless four-second loop',()=>{
 assert.equal(SIPHON3_FRAME_COUNT,80);
 assert.equal(SIPHON3_FRAME_RATE,20);
 assert.equal(siphon3Frame(0),0);
 assert.equal(siphon3Frame(.05),1);
 assert.equal(siphon3Frame(3.95),79);
 assert.equal(siphon3Frame(4),0);
 assert.equal(siphon3Frame(0,1),17);
 assert.equal(siphon3Frame(1,1),37);
 assert.equal(siphon3Frame(1,1,true),0);
});

function fakeContext(){
 const calls=[];
 const c={calls};
 for(const name of ['save','restore','translate','rotate','drawImage','beginPath','arc','fill','stroke']){
  c[name]=(...args)=>calls.push({name,args});
 }
 return c;
}
const sheet={complete:true,naturalWidth:1280,naturalHeight:1024};

test('sprite animation changes atlas cell while a harvester flies',()=>{
 const c=fakeContext();
 assert.equal(drawSiphon3(c,{x:10,y:20,angle:.4,phase:'out',time:0,size:80,sheet}),true);
 assert.equal(drawSiphon3(c,{x:12,y:20,angle:.4,phase:'out',time:.05,size:80,sheet}),true);
 const draws=c.calls.filter(x=>x.name==='drawImage');
 assert.equal(draws.length,2);
 assert.equal(draws[0].args[1],0);
 assert.equal(draws[1].args[1],SIPHON3_TILE);
 assert.deepEqual(draws[0].args.slice(5),[-40,-40,80,80]);
 assert.equal(c.calls.filter(x=>x.name==='save').length,2);
 assert.equal(c.calls.filter(x=>x.name==='restore').length,2);
 assert.equal(SIPHON3_WORLD_SIZE,42,'mine workers are half their old world size');
});

test('returning and extracting harvester have different readable cues',()=>{
 const c=fakeContext();
 drawSiphon3(c,{x:2,y:3,angle:Math.PI,phase:'back',time:.3,sheet});
 const returning=c.calls.filter(x=>x.name==='arc').length;
 const angles=c.calls.filter(x=>x.name==='rotate');
 assert.equal(angles[0].args[0],Math.PI);
 const g=fakeContext();
 drawSiphon3(g,{x:2,y:3,phase:'gather',time:.3,sheet});
 assert.ok(returning>=2);
 assert.ok(g.calls.some(x=>x.name==='stroke'));
 assert.equal(drawSiphon3(fakeContext(),{x:0,y:0,sheet:{complete:false}}),false);
});

test('hinged claws have phase-specific, deterministic poses with smooth boundaries',()=>{
 const out=siphon3Pose('out',1,0,0,true),gather=siphon3Pose('gather',0,0,0,true);
 const gatherEnd=siphon3Pose('gather',.24,0,0,true),back=siphon3Pose('back',0,0,0,true);
 assert.ok(Math.abs(out.spread-gather.spread)<1e-9);
 assert.ok(Math.abs(gatherEnd.spread-back.spread)<1e-9);
 assert.ok(Math.abs(siphon3Pose('back',1,0,0,true).spread-
  siphon3Pose('out',0,0,0,true).spread)<1e-9,'docked worker must not snap its claws');
 assert.ok(siphon3Pose('back',.9,0,0,true).spread>
  siphon3Pose('back',.7,0,0,true).spread+.2,'worker must open to unload at dock');
 const clamp=siphon3Pose('gather',.24*.25,0,0,true);
 assert.ok(clamp.spread<.15,'claws must close visibly during suction');
 assert.ok(out.angles.dorsal-clamp.angles.dorsal>25,'dorsal limb should sweep over 25 degrees');
 const returnCruise=siphon3Pose('back',.40,1,1,true);
 assert.ok(returnCruise.spread<.25,'cargo is carried with folded limbs');
 assert.deepEqual(siphon3Pose('gather',.14,3,2,true),siphon3Pose('gather',.14,9,2,true));
 for(const phase of ['out','gather','back']){
  for(const progress of [0,.15,.5,1]){
   for(const angle of Object.values(siphon3Pose(phase,progress,4,1).angles)){
    assert.ok(Number.isFinite(angle));assert.ok(Math.abs(angle)<25);
   }
  }
 }
});

test('independent hinges and the whole body remain animated without new painted frames',()=>{
 const a=siphon3Pose('out',.35,.1,3),b=siphon3Pose('out',.35,.49,3);
 assert.notDeepEqual(a.angles,b.angles);
 assert.notEqual(a.angles.dorsal-a.angles.ventralLeft,
  b.angles.dorsal-b.angles.ventralLeft,'claws must not flap as one rigid ornament');
 assert.notEqual(a.bob,b.bob);
 assert.notEqual(a.tilt,b.tilt);
 const still=siphon3Pose('out',.35,.1,3,true);
 assert.equal(still.bob,0);assert.equal(still.tilt,0);
 assert.deepEqual(still,siphon3Pose('out',.35,3,3,true));
});

test('energy appears during gathering and remains clearly loaded until delivery',()=>{
 const empty=siphon3EnergyState('out',1,2,4);
 const gathering=siphon3EnergyState('gather',.15,2,4);
 const full=siphon3EnergyState('gather',.24,2,4);
 const returning=siphon3EnergyState('back',.97,3,4);
 assert.equal(empty.load,0);assert.equal(empty.carrying,false);
 assert.ok(gathering.load>.1&&gathering.load<1);
 assert.equal(full.load,1);assert.equal(returning.load,1);
 assert.equal(returning.carrying,true);
 assert.deepEqual(siphon3EnergyState('back',.5,2,4,true),
  siphon3EnergyState('back',.5,100,4,true));
 const loaded=fakeContext(),unloaded=fakeContext();
 drawSiphon3(loaded,{x:3,y:3,phase:'back',time:.3,sheet});
 drawSiphon3(unloaded,{x:3,y:3,phase:'out',time:.3,sheet});
 assert.ok(loaded.calls.filter(call=>call.name==='arc').length>=7,
  'three cargo sparks, orbit and trailing particles should be visible');
 assert.ok(loaded.calls.filter(call=>call.name==='stroke').length>=2);
 assert.equal(unloaded.calls.filter(call=>call.name==='arc').length,0);
});

test('playable drawing and laboratory share a real shipped texture',()=>{
 const path=relative('../studio/assets/siphon3/siphon3-atlas.webp');
 assert.ok(existsSync(path));
 assert.equal(readFileSync(path).toString('ascii',0,4),'RIFF');
 assert.equal(readFileSync(path).toString('ascii',8,12),'WEBP');
 assert.match(siphon3AtlasUrl(),/studio\/assets\/siphon3\/siphon3-atlas\.webp$/);
 assert.match(siphon3RigUrl(),/studio\/assets\/siphon3\/siphon3-rig-master\.webp$/);
 const rig=relative('../studio/assets/siphon3/siphon3-rig-master.webp');
 assert.ok(existsSync(rig));
 assert.equal(readFileSync(rig).toString('ascii',0,4),'RIFF');
 const visualPath=relative('../contour-visuals.js');
 if(existsSync(visualPath)){
  const visual=readFileSync(visualPath,'utf8');
  assert.match(visual,/import \{drawSiphon3/);
  assert.match(visual,/if\(!drawSiphon3\(/);
 }
});

test('the large-scale pose inspector calls the same game renderer',()=>{
 const preview=relative('../studio/siphon3-pose-preview.js');
 assert.ok(existsSync(preview));
 const source=readFileSync(preview,'utf8');
 assert.match(source,/import \{drawSiphon3,siphon3RigReady\} from '\.\.\/siphon3-art\.js/);
 for(const mode of ['cycle','fly','approach','gather','back']){
  assert.match(source,new RegExp(mode+':\\{label:'));
 }
 assert.match(source,/requestAnimationFrame\(frame\)/);
});
