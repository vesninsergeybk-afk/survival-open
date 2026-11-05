import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
 drawSiphon3,siphon3Frame,siphon3AtlasUrl,SIPHON3_FRAME_COUNT,
 SIPHON3_FRAME_RATE,SIPHON3_TILE,SIPHON3_WORLD_SIZE,
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
 assert.ok(SIPHON3_WORLD_SIZE>=70);
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

test('playable drawing and laboratory share a real shipped texture',()=>{
 const path=relative('../studio/assets/siphon3/siphon3-atlas.webp');
 assert.ok(existsSync(path));
 assert.equal(readFileSync(path).toString('ascii',0,4),'RIFF');
 assert.equal(readFileSync(path).toString('ascii',8,12),'WEBP');
 assert.match(siphon3AtlasUrl(),/studio\/assets\/siphon3\/siphon3-atlas\.webp$/);
 const visualPath=relative('../contour-visuals.js');
 if(existsSync(visualPath)){
  const visual=readFileSync(visualPath,'utf8');
  assert.match(visual,/import \{drawSiphon3/);
  assert.match(visual,/if\(!drawSiphon3\(/);
 }
});
