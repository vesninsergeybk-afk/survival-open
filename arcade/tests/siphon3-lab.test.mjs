import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createWorld,updateWorld,triggerThreat,STATIONS,SOURCE,isInsideTriangle,harvestSlot} from '../studio/siphon3-sim.mjs';

const fromStudio=path=>new URL('../studio/'+path,import.meta.url);

test('source is really enclosed by the three linked stations',()=>{
 assert.equal(STATIONS.length,3);
 assert.equal(new Set(STATIONS.map(s=>s.id)).size,3);
 assert.ok(isInsideTriangle(SOURCE));
});

test('24 harvesters have distinct docking spots inside territory',()=>{
 const spots=Array.from({length:24},(_,i)=>harvestSlot(i+1));
 assert.equal(new Set(spots.map(p=>p.x.toFixed(4)+','+p.y.toFixed(4))).size,24);
 assert.ok(spots.every(p=>isInsideTriangle(p)));
});

test('harvesters travel, extract from common reserve and unload cargo at station',()=>{
 const w=createWorld(3);const config={speed:.30,capacity:20,rate:60,regeneration:30};
 for(let i=0;i<1000;i++)updateWorld(w,.05,config);
 assert.ok(w.harvested>0,'no energy extracted');
 assert.ok(w.delivered>0,'no energy delivered');
 assert.ok(w.trips>0,'no finished trips');
 assert.ok(w.delivered<=w.harvested+1e-8,'created cargo from nowhere');
 assert.ok(w.reserve>=0 && w.reserve<=w.reserveMax);
 for(const u of w.units){assert.ok(u.cargo>=0&&u.cargo<=config.capacity+1e-6);}
});

test('threat redirects ships and does not erase extracted energy',()=>{
 const w=createWorld(1);const config={speed:.35,capacity:100,rate:15,regeneration:20};
 for(let i=0;i<120;i++)updateWorld(w,.05,config);
 const before=w.units[0].cargo;
 assert.ok(before>0,'test must encounter mining');
 triggerThreat(w,8);updateWorld(w,.05,config);
 assert.equal(w.units[0].phase,'evade');
 assert.ok(w.units[0].cargo>=before);
 for(let i=0;i<150;i++)updateWorld(w,.05,config);
 assert.ok(w.delivered>=before-1e-6,'cargo lost during retreat');
});

test('24 concurrent harvesters cannot make source energy negative',()=>{
 const w=createWorld(24);const config={speed:.4,capacity:100,rate:90,regeneration:0};
 for(let i=0;i<800;i++)updateWorld(w,.05,config);
 assert.ok(w.reserve>=-1e-8);
 assert.ok(w.harvested<=560+1e-8);
 assert.equal(w.units.length,24);
});

test('simulation is stable with large or invalid time increments',()=>{
 const w=createWorld(1);updateWorld(w,30);updateWorld(w,-4);
 assert.ok(w.elapsed<=.101);
 assert.ok(Number.isFinite(w.units[0].x));
});

test('standalone studio has controls, labels and real atlases',()=>{
 const html=readFileSync(fromStudio('siphon3-lab.html'),'utf8');
 const workshop=readFileSync(fromStudio('index.html'),'utf8');
 assert.match(workshop,/href="\.\/siphon3-lab\.html"/);
 assert.match(workshop,/Сифон-3: добыча в энергетическом треугольнике/);
 for(const id of ['scene','count','size','speed','capacity','pause','step','reset','threat','selected','fps'])
   assert.match(html,new RegExp('id="'+id+'"'));
 for(const file of ['siphon3-lab.js','siphon3-sim.mjs'])assert.ok(existsSync(fromStudio(file)));
 for(const name of ['idle','activate','mining','deactivate']){
   const data=readFileSync(fromStudio('assets/siphon3/'+name+'_sheet_128.webp'));
   assert.equal(data.subarray(0,4).toString(),'RIFF');
   assert.equal(data.subarray(8,12).toString(),'WEBP');
   assert.ok(data.length>1024);
 }
});
