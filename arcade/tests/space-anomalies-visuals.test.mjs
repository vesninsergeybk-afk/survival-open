import test from 'node:test';
import assert from 'node:assert/strict';
import {drawSpaceAnomalies} from '../space-anomalies.js';

const mock=()=>{
 const stats={filaments:0,images:0};
 const gradient=()=>({addColorStop(){}});
 const ctx=new Proxy({
  createRadialGradient:gradient,
  createLinearGradient:gradient,
  bezierCurveTo(){stats.filaments++;},
  drawImage(){stats.images++;}
 },{get(target,key){return key in target?target[key]:()=>{};},
    set(target,key,value){target[key]=value;return true;}});
 const fields=[
  {id:'test-ion',type:'ion',x:500,y:400,r:1250,phase:1},
  {id:'test-meteor',type:'meteor',x:650,y:350,r:1250,phase:.1}
 ];
 const game={time:45,fps:60,visuals:{reducedMotion:false},world:{anomalies:fields},
  player:{x:0,y:0},images:{rock:{complete:true,naturalWidth:64}}};
 const cam={x:0,y:0,w:1200,h:800};
 return {game,ctx,cam,stats};
};
test('space anomaly visuals add ribbons without modifying the world or actor',()=>{
 const {game,ctx,cam,stats}=mock(),player=structuredClone(game.player);
 const anomalies=structuredClone(game.world.anomalies);
 drawSpaceAnomalies(game,ctx,cam);
 assert.equal(stats.filaments,6,'ion anomaly paints six coherent plasma filaments');
 assert.ok(stats.images>0,'existing meteor imagery remains visible');
 assert.deepEqual(game.player,player);
 assert.deepEqual(game.world.anomalies,anomalies);
});
test('plasma filaments are omitted on weak devices and with reduced motion',()=>{
 const {game,ctx,cam,stats}=mock();
 game.fps=30;drawSpaceAnomalies(game,ctx,cam);
 assert.equal(stats.filaments,0);
 game.fps=60;game.visuals.reducedMotion=true;
 drawSpaceAnomalies(game,ctx,cam);
 assert.equal(stats.filaments,0);
});
