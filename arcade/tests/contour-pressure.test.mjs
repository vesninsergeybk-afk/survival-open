import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTOUR_PRESSURE,updateContourTrialPressure} from '../contour-trial-pressure.js';

function scene(){
 const sounds=[];
 const game={time:10,player:{x:0,y:0,vx:0,vy:0,r:19},zones:[],
  heritage:{play:name=>sounds.push(name)},notice(message){this.message=message;}};
 const event={entry:{id:7},phase:'wave'};
 const tick=(dt=.1)=>{game.time+=dt;return updateContourTrialPressure(game,event,dt);};
 return {game,event,sounds,tick};
}

test('remaining still during a wave brings one exact, dodgeable warning to the ship',()=>{
 const {game,event,sounds,tick}=scene();
 for(let i=0;i<53;i++)tick();
 assert.equal(game.zones.length,1);
 const warning=game.zones[0];
 assert.equal(warning.antiCamp,true);
 assert.equal(warning.trialId,event.entry.id);
 assert.deepEqual([warning.x,warning.y],[0,0]);
 assert.equal(warning.fuse,CONTOUR_PRESSURE.warningSeconds);
 assert.ok(sounds.includes('orbitalWarning'));
 assert.match(game.message,/Выйдите из отмеченного круга/);
 // Its radius and 2.5 s timer let a ship moving at 272 units/s escape.
 game.player.x=180;tick(.7);
 assert.ok(Math.hypot(game.player.x-warning.x,game.player.y-warning.y)>warning.r+game.player.r);
 for(let i=0;i<110;i++)tick();
 assert.equal(game.zones.length,1,'an unresolved warning is never stacked with another');
});

test('continuous circling and short tactical pauses do not count as camping',()=>{
 const {game,tick}=scene();
 for(let i=0;i<200;i++){
  // Staying near the core still involves real travel and changing bearing.
  const angle=i*.14;game.player.x=95*Math.cos(angle);game.player.y=95*Math.sin(angle);
  tick();
 }
 assert.equal(game.zones.length,0);
 assert.equal(game.player.vx,0,'actual displacement, not only velocity, proves movement');
 // A pause shorter than the lock threshold must be safe.
 for(let i=0;i<35;i++)tick();
 assert.equal(game.zones.length,0);
 game.player.x+=120;tick(.4);
 for(let i=0;i<35;i++)tick();
 assert.equal(game.zones.length,0);
});

test('warnings are disabled during preparation and short charging breaks',()=>{
 const {game,event,tick}=scene();
 for(const phase of ['warning','rest']){
  event.phase=phase;
  for(let i=0;i<90;i++)tick();
 }
 assert.equal(game.zones.length,0);
 event.phase='stabilize';
 for(let i=0;i<53;i++)tick();
 assert.equal(game.zones.length,1,'remaining near the core after victory over the waves is not free');
});

test('the warning can repeat after rearming, but only after the previous shell expires',()=>{
 const {game,tick}=scene();
 for(let i=0;i<55;i++)tick();
 assert.equal(game.zones.length,1);
 game.zones=[]; // The main game expires and removes the spent orbital shell.
 for(let i=0;i<95;i++)tick();
 assert.equal(game.zones.length,1);
});
