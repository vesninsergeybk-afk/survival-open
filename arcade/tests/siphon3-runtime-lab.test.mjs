import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CONTOURS,createLabWorld,harvesterPosition,forceLaunch,startIntercept,stepLab} from '../studio/siphon3-runtime-core.js';

const relative=p=>fileURLToPath(new URL(p,import.meta.url));

test('Siphon-3 workshop uses a valid triangle and the live game territory rules',()=>{
 const lab=createLabWorld();
 assert.equal(lab.world.contours.links.length,3);
 assert.equal(lab.fields.length,1);
 assert.ok(lab.fields[0].area>CONTOURS.minFaceArea);
 assert.equal(lab.world.contours.flux,0);
 assert.equal(CONTOURS.launchInterval,5);
});

test('Siphon-3 returns from a real-game collection cycle and deposits flux',()=>{
 const lab=createLabWorld();
 forceLaunch(lab);
 assert.equal(lab.world.contours.harvesters.length,1);
 const worker=lab.world.contours.harvesters[0];
 assert.equal(worker.phase,'out');
 const start=harvesterPosition(lab.fields[0],worker);
 assert.ok(Math.hypot(start.x-lab.fields[0].anchor.x,start.y-lab.fields[0].anchor.y)<2);
 let delivered=false;
 for(let i=0;i<350;i++){
  const events=stepLab(lab,.08);
  if(events.some(e=>e.kind==='delivered')){delivered=true;break;}
 }
 assert.equal(delivered,true);
 assert.ok(lab.world.contours.flux>0);
 assert.ok(lab.world.contours.delivered>0);
 assert.equal(lab.world.contours.lost,0);
});

test('test interceptor destroys an exposed harvester without a fictional reward',()=>{
 const lab=createLabWorld();forceLaunch(lab);
 assert.equal(startIntercept(lab),true);
 let destroyed=false;
 for(let i=0;i<90;i++){
  if(stepLab(lab,.07).some(e=>e.kind==='lost')){destroyed=true;break;}
 }
 assert.equal(destroyed,true);
 assert.equal(lab.world.contours.lost,1);
 assert.equal(lab.world.contours.delivered,0);
 assert.equal(lab.world.contours.harvesters.length,0);
});

test('manual playtest launches never exceed the six-worker live-game limit',()=>{
 const lab=createLabWorld();
 for(let i=0;i<12;i++)forceLaunch(lab);
 assert.equal(lab.world.contours.harvesters.length,6);
});

test('workshop loads the authored sprite atlas and is linked from concept studio',()=>{
 const html=readFileSync(relative('../studio/siphon3-runtime-lab.html'),'utf8');
 const script=readFileSync(relative('../studio/siphon3-runtime-lab.js'),'utf8');
 const studio=readFileSync(relative('../studio/siphon3-lab.html'),'utf8');
 const asset=relative('../studio/assets/siphon3/siphon3-atlas.webp');
 assert.ok(existsSync(asset),'Siphon spritesheet must ship with the lab');
 const header=readFileSync(asset).subarray(0,12);
 assert.equal(header.toString('ascii',0,4),'RIFF');
 assert.equal(header.toString('ascii',8,12),'WEBP');
 assert.match(html,/siphon3-runtime-lab\.js\?v=\d+/);
 assert.match(html,/siphon3-pose-preview\.js\?v=\d+/);
 assert.match(html,/id="pose-scene"/);
 assert.match(script,/siphon3-runtime-core\.js/);
 assert.match(script,/siphon3-atlas\.webp/);
 assert.match(studio,/href="\.\/siphon3-runtime-lab\.html"/);
});

