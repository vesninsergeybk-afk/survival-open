import test from 'node:test';
import assert from 'node:assert/strict';
import {AREA_DENIAL,createAreaDenial,trackAreaDenial,mineDamageAgainstTurret}
 from '../area-denial.js';
import {splitPlayerDamage} from '../balance.js';

function scenario(){
 return {time:55,player:{x:0,y:0,r:19},areaDenial:createAreaDenial(),
  enemies:[{x:130,y:0,hp:20},{x:-130,y:0,hp:20}],zones:[],
  contourTrial:null,nearDockField:false,nearArsenalDefense:false};
}
function simulate(game,path,duration=12){
 const result=[];
 for(let t=0;t<=duration+.001;t+=.35){
  game.time=55+t;
  const [x,y]=path(t);game.player.x=x;game.player.y=y;
  for(const [i,e] of game.enemies.entries()){
   e.x=x+(i? -130:130);e.y=y;
  }
  const zone=trackAreaDenial(game);
  if(zone)result.push({time:game.time,zone,x,y});
 }
 return result;
}

test('orbiting within a local patch draws one mine, even at high angular speed',()=>{
 const game=scenario();
 const launches=simulate(game,t=>[145*Math.cos(t*1.65),145*Math.sin(t*1.65)]);
 assert.equal(launches.length,1);
 const {zone,x,y}=launches[0];
 assert.equal(zone.kind,'displacement-mine');
 assert.ok(Math.hypot(zone.x-x,zone.y-y)+game.player.r<zone.r,
  'the marked blast must cover the orbit, not just the last heading');
 assert.equal(zone.fuse,AREA_DENIAL.fuse);
 assert.ok(zone.damage>27);
});

test('crossing the combat area, rather than orbiting it, cannot trigger a mine',()=>{
 const game=scenario();
 assert.equal(simulate(game,t=>[210*t,100*Math.sin(t*.9)]).length,0);
});

test('no mine is thrown during quiet exploration or contour trials',()=>{
 for(const block of ['peace','trial']){
  const game=scenario();
  if(block==='peace')game.enemies=[];
  if(block==='trial')game.contourTrial={};
  assert.equal(simulate(game,()=>[0,0]).length,0,block);
 }
});

test('a station defence field does not grant immunity to hostile area denial',()=>{
 const game=scenario();game.nearDockField=true;game.nearArsenalDefense=true;
 assert.equal(simulate(game,()=>[0,0]).length,1);
});

test('a victorious but immobile ship can still be bombed from a recent enemy radio report',()=>{
 const game=scenario();game.enemies=[];
 game.combatTempo={lastContactAt:55};
 assert.equal(simulate(game,()=>[0,0]).length,1);
});

test('stale reports cannot summon explosives into an empty sector',()=>{
 const game=scenario();game.enemies=[];
 game.combatTempo={lastContactAt:22};
 assert.equal(simulate(game,()=>[0,0]).length,0);
});

test('a recent incoming hit also marks a position even if enemies were just destroyed',()=>{
 const game=scenario();game.enemies=[];game.lastDamageAt=55;
 assert.equal(simulate(game,()=>[0,0]).length,1);
});

test('warning circles cannot pile onto the player while another charge is armed',()=>{
 const game=scenario();
 game.zones=[{x:0,y:0,r:80,fuse:20}];
 assert.equal(simulate(game,()=>[0,0]).length,0);
});

test('a marked mine hurts the hull even through a strong shield, while fortifications resist splash',()=>{
 const hit=splitPlayerDamage(AREA_DENIAL.blastDamage,500,AREA_DENIAL.hullTransfer);
 assert.ok(hit.hullDamage>=17);
 assert.ok(hit.absorbed>=34);
 assert.ok(mineDamageAgainstTurret({damage:AREA_DENIAL.blastDamage})<
  AREA_DENIAL.blastDamage*.5);
});

test('the starter craft can clear the entire blast circle before the timer expires',()=>{
 for(const speed of [248,188]){
  let x=0,v=0;
  for(let t=0;t<AREA_DENIAL.fuse-.001;t+=1/60){
   v+=(speed-v)*(1-Math.exp(-5.6/60));x+=v/60;
  }
  assert.ok(x>AREA_DENIAL.blastRadius+19,
   `a craft moving at ${speed} units/s must be able to escape from the centre`);
 }
});
