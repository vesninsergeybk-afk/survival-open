import test from 'node:test';
import assert from 'node:assert/strict';
import {AREA_DENIAL,createAreaDenial,trackAreaDenial,advanceMineVolley,
 insideMineBlasts,mineVolleyDamage,minePosition} from '../area-denial.js';
import {splitPlayerDamage} from '../balance.js';

function scenario(){
 return {time:55,player:{x:0,y:0,r:19},areaDenial:createAreaDenial(),
  enemies:[{serial:4,type:'fighter',r:18,x:130,y:0,hp:58},
   {serial:6,type:'scout',r:14,x:-130,y:0,hp:38}],zones:[],
  contourTrial:null,nearDockField:false,nearArsenalDefense:false,
  heritage:{vfx:{nova(){}},play(){}}};
}
function simulate(game,path,duration=12){
 const result=[];
 for(let t=0;t<=duration+.001;t+=.35){
  game.time=55+t;
  const [x,y]=path(t);game.player.x=x;game.player.y=y;
  for(const [i,e] of game.enemies.entries()){
   e.x=x+(i?-130:130);e.y=y;
  }
  const zone=trackAreaDenial(game);
  if(zone)result.push({time:game.time,zone,x,y});
 }
 return result;
}
function detonate(game,zone,turrets=[]){
 let blasts=[];
 while(!zone.done){
  game.time+=1/60;
  blasts=advanceMineVolley(game,zone,1/60,turrets);
 }
 return blasts;
}

test('a genuine enemy ship launches three flying mines into a small combat orbit',()=>{
 const game=scenario();
 const launches=simulate(game,t=>[145*Math.cos(t*1.65),145*Math.sin(t*1.65)]);
 assert.equal(launches.length,1);
 const {zone,x,y}=launches[0];
 assert.equal(zone.kind,'enemy-mine-volley');
 assert.equal(zone.mines.length,3);
 assert.ok([4,6].includes(zone.launcherId));
 assert.equal(zone.fuse,AREA_DENIAL.flightSeconds+AREA_DENIAL.armingSeconds+AREA_DENIAL.armedFuse);
 assert.ok(insideMineBlasts({x,y},zone.mines.map(m=>({x:m.tx,y:m.ty,r:m.r})),19),
  'circling the old position must not automatically escape the volley');
 assert.ok(zone.mines.every(m=>Math.hypot(m.sx-zone.launcherX,m.sy-zone.launcherY)<42));
 assert.ok(zone.damage>27);
});

test('mines travel on separate curved tracks, land and arm before detonating',()=>{
 const game=scenario(),zone=simulate(game,()=>[0,0])[0].zone;
 const probe=zone.mines[0];
 const halfway=minePosition(probe,AREA_DENIAL.flightSeconds*.5);
 assert.ok(Math.hypot(halfway.x-probe.sx,halfway.y-probe.sy)>15);
 assert.ok(Math.hypot(halfway.x-probe.tx,halfway.y-probe.ty)>15);
 const before=advanceMineVolley(game,zone,.4);
 assert.equal(before.length,0);
 assert.equal(zone.done,undefined);
 const blasts=detonate(game,zone);
 assert.equal(blasts.length,3);
 assert.ok(zone.mines.every(m=>Math.hypot(m.x-m.tx,m.y-m.ty)<.001));
});

test('overlapping mines make camping dangerous but resolve as a single capped hit',()=>{
 const game=scenario(),zone=simulate(game,()=>[0,0])[0].zone;
 const blasts=detonate(game,zone);
 assert.equal(blasts.length,3);
 assert.equal(insideMineBlasts(game.player,blasts,game.player.r),true);
 const damage=mineVolleyDamage(game.player,blasts,game.player.r);
 assert.equal(damage,AREA_DENIAL.blastDamage*1.6);
 const hit=splitPlayerDamage(damage,500,AREA_DENIAL.hullTransfer);
 assert.ok(hit.hullDamage>=27&&hit.absorbed>=55);
 assert.ok(damage<90,'an isolated full volley must not one-shot an unshielded starter');
 assert.equal(mineVolleyDamage({x:500,y:500},blasts),0);
 assert.equal(advanceMineVolley(game,zone,.5).length,0,
  'a spent volley cannot produce another set of explosions');
});

test('a turret intercepts real nearby charges without taking damage itself',()=>{
 const game=scenario(),zone=simulate(game,()=>[0,0])[0].zone;
 const turret={x:0,y:0,r:38,hp:110,maxHp:110,readyAt:0};
 const blasts=detonate(game,zone,[turret]);
 assert.ok(zone.mines.some(m=>m.intercepted),'point defence must visibly remove a mine');
 assert.ok(zone.mines.some(m=>!m.intercepted),'one turret must not cancel all three at once');
 assert.ok(blasts.length>0&&blasts.length<3);
 assert.equal(turret.hp,110,'enemy anti-ship mines never damage emplacements');
 assert.ok(turret.nextMineInterceptAt>0);
 const intercepted=zone.mines.find(m=>m.intercepted);
 assert.equal(intercepted.interceptX,turret.x);
 assert.equal(intercepted.interceptY,turret.y);
});

test('destroying the launcher after launch does not erase mines already in flight',()=>{
 const game=scenario(),zone=simulate(game,()=>[0,0])[0].zone;
 for(const e of game.enemies)e.hp=0;
 assert.equal(detonate(game,zone).length,3);
});

test('normal travel does not trigger mines, and quiet regions cannot invent a launcher',()=>{
 assert.equal(simulate(scenario(),t=>[210*t,100*Math.sin(t*.9)]).length,0);
 const peaceful=scenario();peaceful.enemies=[];
 assert.equal(simulate(peaceful,()=>[0,0]).length,0);
 const oldReport=scenario();oldReport.enemies=[];
 oldReport.combatTempo={lastContactAt:55};
 assert.equal(simulate(oldReport,()=>[0,0]).length,0,
  'a radio report without a live launching ship must not spawn physical mines');
});

test('an arriving ship can launch at an already entrenched pilot',()=>{
 const game=scenario();game.enemies=[];
 for(let t=0;t<7;t+=.35){game.time=55+t;trackAreaDenial(game);}
 game.enemies=[{serial:12,type:'fighter',x:200,y:0,hp:58,r:18}];
 game.time=62.4;
 const volley=trackAreaDenial(game);
 assert.ok(volley);
 assert.equal(volley.launcherId,12);
});

test('non-combat, retreating and converted ships cannot lay mines',()=>{
 for(const enemy of [
  {serial:1,type:'healer',hp:55,x:100,y:0},
  {serial:2,type:'fighter',hp:55,x:100,y:0,converted:true},
  {serial:3,type:'scout',hp:55,x:100,y:0,microDrone:true},
  {serial:4,type:'scout',hp:55,x:100,y:0,trialRetreatUntil:80}
 ]){
  const game=scenario();game.enemies=[enemy];
  assert.equal(simulate(game,()=>[0,0]).length,0);
 }
});

test('the active trial and an existing warning prevent mine spam',()=>{
 const trial=scenario();trial.contourTrial={};
 assert.equal(simulate(trial,()=>[0,0]).length,0);
 const overlap=scenario();overlap.zones=[{x:0,y:0,r:80,fuse:20}];
 assert.equal(simulate(overlap,()=>[0,0]).length,0);
 const dock=scenario();dock.nearDockField=true;
 assert.equal(simulate(dock,()=>[0,0]).length,1);
});

test('even a slowed starter craft can escape the entire mine pattern in time',()=>{
 for(const speed of [248,188]){
  let x=0,v=0;
  const seconds=AREA_DENIAL.flightSeconds+AREA_DENIAL.armingSeconds+AREA_DENIAL.armedFuse;
  for(let t=0;t<seconds-.001;t+=1/60){
   v+=(speed-v)*(1-Math.exp(-5.6/60));x+=v/60;
  }
  assert.ok(x>AREA_DENIAL.mineSpread+AREA_DENIAL.mineRadius+19,
   `a craft at ${speed} units/s must be able to escape from the centre`);
 }
});
