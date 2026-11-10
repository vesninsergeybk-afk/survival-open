import test from 'node:test';
import assert from 'node:assert/strict';
import {game} from './weapons-scene.mjs';
import {updateFlakPellets,threateningFlakShots} from '../ballistic-weapons.js';
import {disruptHeavyAim,rocketFlight,rocketPayload,seekerRetargetRange} from '../weapon-specializations.js';
import {reacquireMissile,applyRocketSplash} from '../rocket-branches.js';

const enemy=(x,y=0,type='fighter',hp=400)=>({
 x,y,vx:0,vy:0,r:16,hp,maxHp:hp,type,state:'charge',converted:false
});
const spec=(g,id,path,rank=1)=>{g.shipLoadout.specializations[id]={path,rank};};

test('rail breaker cancels an active gunship warning, with one cooldown per enemy',()=>{
 const g=game(['rail',null,null,null,null,null]);
 spec(g,'rail','breaker');
 const heavy=enemy(95,0,'gunship');heavy._gunAiming={until:11,profile:{kind:'gunship-lance'}};
 g.grid.insert(heavy);
 g.updateShipWeapons(.01);
 assert.equal(heavy._gunAiming,null);
 assert.equal(heavy._railDisruptReadyAt,18);
 assert.ok(heavy._gunNextAt>=11.5);
 assert.match(g.lastNotice,/сорвал/);
 heavy._gunAiming={until:12};
 assert.equal(disruptHeavyAim(g.shipLoadout,heavy,17),false);
 assert.ok(heavy._gunAiming,'the breaker cannot repeatedly suppress every gunship shot');
 assert.equal(disruptHeavyAim(g.shipLoadout,heavy,18),true);
 assert.equal(heavy._railDisruptReadyAt,26);
 spec(g,'rail','breaker',2);
 heavy._gunAiming={until:30};
 assert.equal(disruptHeavyAim(g.shipLoadout,heavy,26),true);
 assert.equal(heavy._railDisruptReadyAt,32);
});

test('non-breaker rail shots never silently cancel an enemy aim',()=>{
 const g=game(['rail',null,null,null,null,null]);
 spec(g,'rail','penetrator');
 const heavy=enemy(95,0,'gunship');heavy._gunAiming={until:11};g.grid.insert(heavy);
 g.updateShipWeapons(.01);
 assert.deepEqual(heavy._gunAiming,{until:11});
 assert.equal(heavy._railDisruptReadyAt,undefined);
});

test('flak interceptor sacrifices its offensive volley and shoots down a real incoming bullet',()=>{
 const g=game(['flak',null,null,null,null,null]);spec(g,'flak','interceptor');
 const incoming={x:135,y:0,vx:-270,vy:0,r:6,damage:12,alive:true};
 g.shots.push(incoming);
 assert.equal(threateningFlakShots(g,g.player,245).length,1);
 g.updateShipWeapons(.01);
 assert.equal(g.flakPellets.length,1,'one projectile per interception, without fake instant destruction');
 assert.equal(g.flakPellets[0].interceptShot,incoming);
 assert.equal(incoming.alive,true);
 updateFlakPellets(g,.1);
 assert.equal(incoming.alive,false);
 assert.equal(g.flakPellets.length,0);
 assert.ok(g.moduleClocks.flak>0,'the defense spends the usual weapon cooldown');
 assert.ok(g.weaponThermal.current>0,'the defense also spends heat');
});

test('flak interceptor ignores harmless shots; mastery can track two real threats',()=>{
 const g=game(['flak',null,null,null,null,null]);spec(g,'flak','interceptor',2);
 const away={x:140,y:0,vx:180,vy:0,alive:true,r:5};
 const one={x:150,y:15,vx:-250,vy:0,alive:true,r:6};
 const two={x:155,y:-15,vx:-250,vy:0,alive:true,r:6};
 g.shots.push(away,one,two);
 assert.deepEqual(threateningFlakShots(g,g.player,245).length,2);
 g.updateShipWeapons(.01);
 assert.equal(g.flakPellets.length,2);
 updateFlakPellets(g,.11);
 assert.equal(one.alive,false);
 assert.equal(two.alive,false);
 assert.equal(away.alive,true);
});

test('a rock physically blocks flak defense; the incoming shot is not deleted',()=>{
 const g=game(['flak',null,null,null,null,null]);spec(g,'flak','interceptor');
 const shot={x:150,y:0,vx:-240,vy:0,alive:true,r:6};
 g.shots.push(shot);g.rockGrid.insert({x:70,y:0,r:38,hp:400,alive:true});
 g.updateShipWeapons(.01);assert.equal(g.flakPellets.length,1);
 updateFlakPellets(g,.1);
 assert.equal(shot.alive,true);
 assert.equal(g.flakPellets.length,0);
});

test('seeker keeps finite fuel while reacquiring only another living hostile',()=>{
 const g=game(),dead=enemy(80),next=enemy(110,10),friendly=enemy(90,0);
 dead.hp=0;friendly.converted=true;
 g.grid.insert(dead);g.grid.insert(friendly);g.grid.insert(next);
 const missile={x:10,y:0,tx:80,ty:0,target:dead,targetKind:'enemy',
  seekerRange:160,damage:35,speed:400,life:.65};
 assert.equal(reacquireMissile(g,missile),true);
 assert.equal(missile.target,next);
 assert.equal(missile.life,.65,'reacquisition must not reset flight time');
 g.missiles=[missile];g.updateMissiles(.05);
 assert.equal(missile.target,next);
 assert.equal(missile.life,.6);
 assert.equal(seekerRetargetRange({specializations:{rocket:{path:'seeker',rank:2}}}),260);
 assert.equal(seekerRetargetRange({specializations:{rocket:{path:'payload',rank:2}}}),0);
});

test('heavy rocket trades speed and heat for modest real splash, without friendly fire',()=>{
 const g=game(['rocket',null,null,null,null,null]);spec(g,'rocket','payload');
 const primary=enemy(150,0),neighbor=enemy(160,48),friendly=enemy(155,-35);
 friendly.converted=true;
 g.grid.insert(primary);g.grid.insert(neighbor);g.grid.insert(friendly);
 assert.deepEqual(rocketFlight(g.shipLoadout),{speed:470,life:2.55});
 assert.deepEqual(rocketPayload(g.shipLoadout),{radius:65,fraction:.30,heatMultiplier:1.25});
 g.updateShipWeapons(.01);
 assert.equal(g.missiles.length,1);
 assert.equal(g.missiles[0].splashRadius,65);
 assert.equal(g.missiles[0].splashDamageBase,67,'the area hit uses the unboosted rocket damage');
 assert.ok(g.weaponThermal.current>0);
 for(let i=0;i<30&&g.missiles.length;i++)g.updateMissiles(.02);
 assert.ok(primary.hp<400,'primary receives the main rocket hit');
 assert.ok(neighbor.hp<400,'nearby hostile receives a weaker real splash hit');
 assert.equal(friendly.hp,400,'a converted ship is excluded from the blast');
});

test('payload mastery extends the damage radius but does not multiply splash by heavy-target bonus',()=>{
 const g=game(),heavy=enemy(50,0,'gunship'),near=enemy(50,100),friendly=enemy(50,-30);
 friendly.converted=true;g.grid.insert(heavy);g.grid.insert(near);g.grid.insert(friendly);
 const point={x:50,y:0};
 const rank1={splashRadius:65,splashFactor:.30,splashDamageBase:67,damage:67*1.25};
 assert.equal(applyRocketSplash(g,rank1,point,heavy),0,'a target just outside rank-one range survives');
 const rank2={splashRadius:85,splashFactor:.42,splashDamageBase:67,damage:67*1.45};
 assert.equal(applyRocketSplash(g,rank2,point,heavy),1);
 assert.ok(near.hp<400&&near.hp>370,'a large direct anti-heavy bonus must not leak into area damage');
 assert.equal(heavy.hp,400);
 assert.equal(friendly.hp,400);
});

test('plasma focus increases the visible long-range energy, while the cutter widens close shots',()=>{
 const far=enemy(315),close=enemy(80);
 const baseline=game();baseline.grid.insert(far);baseline.updateShipWeapons(.01);
 const standard=baseline.weaponFx.find(e=>e.kind==='plasma');
 const focused=game();spec(focused,'plasma','focus',2);focused.grid.insert(enemy(315));
 focused.updateShipWeapons(.01);
 const focusFx=focused.weaponFx.find(e=>e.kind==='plasma');
 assert.ok(focusFx.falloff>standard.falloff,'distant focus should be visibly stronger');
 assert.equal(focusFx.specialization,'focus');
 assert.equal(focusFx.specializationRank,2);
 const cutter=game();spec(cutter,'plasma','furnace',2);cutter.grid.insert(close);
 cutter.updateShipWeapons(.01);
 const cutFx=cutter.weaponFx.find(e=>e.kind==='plasma');
 assert.equal(cutFx.specialization,'furnace');
 assert.equal(cutFx.specializationRank,2);
 assert.equal(cutFx.falloff,1);
});

test('splash does not hit a protected base core in the same blast that destroys its turret',()=>{
 const g=game(),turret={x:135,y:0,r:18,hp:10,maxHp:10},base={x:150,y:0,r:60,hp:200,enemy:true,captured:false,strategicRole:'industry'};
 base.turrets=[turret];
 g.world.nearbyStations=()=>[base];
 g.hitTurret=(t,d)=>{t.hp=Math.max(0,t.hp-d);};
 g.hitEnemyBase=(b,d)=>{b.hp-=d;};
 const hits=applyRocketSplash(g,{splashRadius:85,splashFactor:.42,damage:75},
  {x:134,y:0});
 assert.equal(hits,1);
 assert.equal(turret.hp,0);
 assert.equal(base.hp,200,'protected cores must not take damage from a turret-breaking explosion');
});
