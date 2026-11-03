import test from 'node:test';
import assert from 'node:assert/strict';
import {MUSIC_SCENES,spatialCue,assessMusicThreat,AdaptiveMusicDirector} from '../audio-director.js';

test('positional cues follow the source and attenuate faraway effects',()=>{
 const listener={x:0,y:0};
 const left=spatialCue({x:-400,y:0},listener,900);
 const right=spatialCue({x:400,y:0},listener,900);
 const far=spatialCue({x:1800,y:0},listener,900);
 assert.ok(left.pan<0);
 assert.ok(right.pan>0);
 assert.ok(far.intensity<right.intensity);
 assert.deepEqual(spatialCue(null,listener),{});
});
test('score responds to nearby danger, hull damage, and an actual siege',()=>{
 assert.equal(assessMusicThreat({nearby:0}),'drift');
 assert.equal(assessMusicThreat({nearby:1}),'alert');
 assert.equal(assessMusicThreat({nearby:3}),'battle');
 assert.equal(assessMusicThreat({nearby:1,recentDamage:true}),'battle');
 assert.equal(assessMusicThreat({nearby:0,critical:true}),'alert');
 assert.equal(assessMusicThreat({nearby:0,siege:true}),'siege');
 assert.equal(MUSIC_SCENES.siege.track,'boss');
});
test('music enters danger promptly but waits before calming down',()=>{
 const score=new AdaptiveMusicDirector();
 assert.equal(score.update(.65,{nearby:4}).scene,'battle');
 for(let i=0;i<8;i++)assert.equal(score.update(.65,{nearby:0}).scene,'battle');
 assert.equal(score.update(.65,{nearby:0}).scene,'recovery');
 for(let i=0;i<14;i++)score.update(.65,{nearby:0});
 assert.equal(score.scene,'drift');
 assert.equal(score.update(.65,{heavy:true}).scene,'siege');
 assert.equal(score.update(.65,{warning:true}).scene,'siege');
});
test('score never pulses its alert motif every frame',()=>{
 const score=new AdaptiveMusicDirector();
 assert.equal(score.update(.65,{nearby:1}).scene,'alert');
 let pulses=0;
 for(let i=0;i<40;i++){
  if(score.update(.65,{nearby:1}).pulse)pulses++;
 }
 assert.ok(pulses>=2&&pulses<=3);
});
