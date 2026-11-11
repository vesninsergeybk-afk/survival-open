import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {createMeteorFront,frontPhase,frontStrikePoint,frontCorridor,updateMeteorFront,validMeteorFront,METEOR_FRONT} from '../meteor-front.js';

const scene=()=>({
 seed:20261102,world:new World(20261102),player:{x:1950,y:2350},time:0,
 meteorFront:createMeteorFront(),zones:[],notices:[],
 notice(message){this.notices.push(message);}
});

test('meteor front announces its path, strikes through real orbital zones and leaves finite ore',()=>{
 const game=scene();
 game.time=METEOR_FRONT.firstAt;
 updateMeteorFront(game);
 const front=game.meteorFront.active;
 assert.ok(front);
 assert.equal(frontPhase(game.meteorFront,game.time),'warning');
 assert.equal(game.zones.length,0);
 assert.match(game.notices[0],/через 12 с/);
 const expected=frontStrikePoint(front,0);
 game.time=front.at+METEOR_FRONT.warning;
 updateMeteorFront(game);
 assert.equal(frontPhase(game.meteorFront,game.time),'passing');
 assert.equal(game.zones.length,1);
 assert.equal(game.zones[0].x,expected.x);
 assert.equal(game.zones[0].y,expected.y);
 assert.equal(game.zones[0].r,METEOR_FRONT.radius);
 assert.equal(game.zones[0].fuse,1.85);
 for(let t=front.at+METEOR_FRONT.warning+2;t<=front.at+METEOR_FRONT.warning+METEOR_FRONT.duration+1;t+=2){
  game.time=t;updateMeteorFront(game);
 }
 assert.equal(game.zones.length,METEOR_FRONT.strikes);
 assert.equal(game.meteorFront.active,null);
 assert.ok(game.meteorFront.nextAt>game.time);
 const ore=[...game.world.rocks.values()].flat().filter(r=>r.originKind==='event');
 assert.ok(ore.length>0&&ore.length<=METEOR_FRONT.depositCount);
 assert.ok(ore.every(r=>r.rich&&r.alive&&r.id.includes('meteor-front-1')));
 assert.equal(validMeteorFront(game.meteorFront,game.time),true);
});

test('meteor front holds off near the starting base and validates restored state',()=>{
 const game=scene();
 game.player.x=game.world.home.x;game.player.y=game.world.home.y;
 game.time=METEOR_FRONT.firstAt;updateMeteorFront(game);
 assert.equal(game.meteorFront.active,null);
 assert.equal(game.meteorFront.nextAt,game.time+24);
 game.player.x+=1600;game.time=game.meteorFront.nextAt;
 updateMeteorFront(game);
 assert.ok(game.meteorFront.active);
 const saved=structuredClone(game.meteorFront);
 assert.equal(validMeteorFront(saved,game.time),true);
 saved.active.strikes=METEOR_FRONT.strikes+1;
 assert.equal(validMeteorFront(saved,game.time),false);
 assert.equal(validMeteorFront(undefined,game.time),true,'old checkpoints are valid');
});

test('the displayed meteor corridor contains every physical impact including its full radius',()=>{
 for(let serial=1;serial<=100;serial++){
  const active={serial,seed:20261102,angle:serial*.31,x:1900,y:2400};
  const corridor=frontCorridor(active),ux=Math.cos(active.angle),uy=Math.sin(active.angle);
  for(let index=0;index<METEOR_FRONT.strikes;index++){
   const point=frontStrikePoint(active,index);
   const along=(point.x-active.x)*ux+(point.y-active.y)*uy;
   const sideways=Math.abs((point.y-active.y)*ux-(point.x-active.x)*uy);
   const begin=(corridor.start.x-active.x)*ux+(corridor.start.y-active.y)*uy;
   const end=(corridor.end.x-active.x)*ux+(corridor.end.y-active.y)*uy;
   assert.ok(along-METEOR_FRONT.radius>=begin-1e-6);
   assert.ok(along+METEOR_FRONT.radius<=end+1e-6);
   assert.ok(sideways+METEOR_FRONT.radius<=corridor.halfWidth+1e-6);
  }
 }
});
