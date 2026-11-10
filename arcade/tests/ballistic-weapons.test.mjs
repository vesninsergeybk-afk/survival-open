import test from 'node:test';
import assert from 'node:assert/strict';
import {game} from './weapons-scene.mjs';
import {segmentCircle,FLAK_PELLETS_PER_TARGET,FLAK_POOL_CAP,FLAK_SPEED,
 HEAVY_SHELL_SPEED,updateFlakPellets,updateHeavyShells,drawBallisticWeapons} from '../ballistic-weapons.js';
import {updateHowitzer,planHowitzer,drawHowitzerAim} from '../ship-weapons.js';

const enemy=(x,y=0,hp=500)=>({x,y,vx:0,vy:0,r:15,hp,maxHp:hp,type:'fighter',converted:false});
const rock=(x,y=0,r=40)=>({x,y,r,hp:700,maxHp:700,alive:true});
const near=(actual,expected,tolerance=.01)=>assert.ok(Math.abs(actual-expected)<=tolerance,
 `${actual} differs from ${expected} by more than ${tolerance}`);
const flak=()=>game(['flak',null,null,null,null,null]);
const heavy=()=>{const g=game();g.weaponProfile.howitzer=true;return g;};
function strike(g,seconds,dt=1/60){
 for(let time=0;time<seconds-1e-8;time+=dt){
  updateFlakPellets(g,Math.min(dt,seconds-time));
  updateHowitzer(g,Math.min(dt,seconds-time));
 }
}

test('segment-circle finds a first swept surface at both low and high speeds',()=>{
 near(segmentCircle({x:0,y:0},{x:300,y:0},{x:150,y:0},20),130/300);
 assert.equal(segmentCircle({x:0,y:35},{x:300,y:35},{x:150,y:0},20),null);
 assert.equal(segmentCircle({x:145,y:0},{x:300,y:0},{x:150,y:0},20),0);
 assert.ok(FLAK_SPEED>HEAVY_SHELL_SPEED);
 assert.equal(FLAK_PELLETS_PER_TARGET,3);
});

test('flak deals no hit at launch, then three real pellets resolve at the hull',()=>{
 const g=flak(),t=enemy(180);g.grid.insert(t);
 g.updateShipWeapons(.01);
 assert.equal(t.hp,500,'automatic flak must not hit before projectiles arrive');
 assert.equal(g.flakPellets.length,3);
 assert.equal(g.weaponFx[0].impact,false);
 strike(g,.05);assert.equal(t.hp,500);
 strike(g,.12);near(t.hp,486);
 assert.equal(g.flakPellets.length,0);
});

test('swept flak pellets collide with the same rock at 15, 30 and 60 FPS',()=>{
 for(const hz of [15,30,60]){
  const g=flak(),t=enemy(185),r=rock(100,0,42);g.grid.insert(t);g.rockGrid.insert(r);
  let hits=0;g.damageRock=(item,damage)=>{hits++;item.hp-=damage;};
  g.updateShipWeapons(.01);strike(g,.4,1/hz);
  assert.equal(t.hp,500,`cover leaked damage at ${hz} FPS`);
  assert.equal(hits,3,`each real pellet should strike cover at ${hz} FPS`);
 }
});

test('one scatter mount covers a sector, not enemies anywhere around the ship',()=>{
 const g=flak(),front=enemy(170),side=enemy(0,180);
 g.grid.insert(front);g.grid.insert(side);
 g.updateShipWeapons(.01);strike(g,.3);
 assert.ok(front.hp<500);
 assert.equal(side.hp,500,'a target at ninety degrees cannot receive a guided pellet');
});

test('leading a moving transport preserves an intercept without steering fired pellets',()=>{
 const g=flak(),t=enemy(180);t.vy=350;g.grid.insert(t);
 g.updateShipWeapons(.01);
 const headings=g.flakPellets.map(p=>[p.vx,p.vy]);
 t.y+=17.5;updateFlakPellets(g,.05);
 assert.deepEqual(g.flakPellets.map(p=>[p.vx,p.vy]),headings,'pellets cannot steer after launch');
 t.y+=17.5;strike(g,.09);
 assert.ok(t.hp<500,'an unchanged bearing would miss a target moving 35 m sideways');
});

test('flak does not damage a vessel that becomes friendly before the pellets arrive',()=>{
 const g=flak(),t=enemy(180);g.grid.insert(t);
 g.updateShipWeapons(.01);t.converted=true;strike(g,.2);
 assert.equal(t.hp,500);
});

test('a closer hostile hull physically intercepts pellets aimed at a designated rear target',()=>{
 const g=flak(),rear=enemy(190),front=enemy(105);
 g.grid.insert(front);g.grid.insert(rear);
 g.designatedTarget={target:rear,expiresAt:g.time+30};
 g.updateShipWeapons(.01);strike(g,.25,1/15);
 assert.ok(front.hp<500,'the intervening hull should intercept real pellets');
 assert.equal(rear.hp,500,'the rear hull should not receive damage through its escort');
});

test('five scatter mounts stay within the fixed physical pool and finish their flights',()=>{
 const g=game(['flak','flak','flak','flak','flak',null]);
 for(const y of [-70,0,70])g.grid.insert(enemy(170,y));
 g.updateShipWeapons(.01);
 assert.ok(g.flakPellets.length<=FLAK_POOL_CAP);
 assert.ok(g.flakPellets.length>=15);
 strike(g,.35);assert.equal(g.flakPellets.length,0);
});

test('howitzer telegraphs, launches a moving shell, and damages only on arrival',()=>{
 const g=heavy(),t=enemy(350);g.grid.insert(t);
 const plan=planHowitzer(g);assert.ok(plan.ok);
 g.heavyCharge=plan.charge;
 updateHowitzer(g,1.24);assert.equal(g.heavyShells?.length||0,0);
 assert.equal(t.hp,500);
 updateHowitzer(g,.02);assert.equal(g.heavyShells.length,1);
 assert.equal(g.weaponFx[0].impact,false,'launch trail must not assert an impact');
 assert.equal(t.hp,500);
 strike(g,.6);assert.equal(g.heavyShells.length,0);
 assert.equal(t.hp,320);
 strike(g,.3);assert.equal(t.hp,320,'a finished explosion must not repeat');
});

test('cluster howitzer actually reaches a wider formation at the cost of time and heat',()=>{
 const g=heavy(),center=enemy(350),edge=enemy(350,138);
 g.shipLoadout.specializations.howitzer={path:'cluster',rank:1};
 g.grid.insert(center);g.grid.insert(edge);
 const plan=planHowitzer(g);assert.ok(plan.ok);
 assert.equal(plan.charge.total,1.5);
 assert.equal(plan.charge.profile.radius,150);
 g.heavyCharge=plan.charge;updateHowitzer(g,1.51);
 assert.equal(g.heavyCooldown,14);
 assert.equal(g.weaponThermal.current,78);
 assert.equal(g.heavyShells[0].profile.path,'cluster');
 strike(g,.8);
 assert.equal(center.hp,350);
 assert.equal(edge.hp,350,'the edge of the formation takes real splash damage');
});

test('piercing howitzer rewards an actual direct hull hit, but not a nearby splash victim',()=>{
 const g=heavy(),center=enemy(350),neighbor=enemy(365,75);
 g.shipLoadout.specializations.howitzer={path:'piercing',rank:1};
 g.grid.insert(center);g.grid.insert(neighbor);
 const plan=planHowitzer(g);assert.equal(plan.charge.profile.radius,85);
 g.heavyCharge=plan.charge;updateHowitzer(g,1.36);
 assert.equal(g.weaponThermal.current,76);
 strike(g,.8);
 assert.equal(center.hp,235,'direct impact receives 130+135 damage');
 assert.equal(neighbor.hp,370,'secondary target receives only 130 damage');
});

test('howitzer aim indicator uses the exact purchased radius',()=>{
 const g=heavy();g.shipLoadout.specializations.howitzer={path:'cluster',rank:2};
 const plan=planHowitzer(g,{x:300,y:0});assert.ok(plan.ok);
 const circles=[];
 const ctx={save(){},restore(){},setLineDash(){},beginPath(){},stroke(){},
  arc(x,y,r){circles.push(r);}};
 drawHowitzerAim(ctx,plan.charge);
 assert.equal(circles[0],180);
 assert.equal(plan.charge.total,1.65);
});

test('a piercing shell cannot damage the protected station core when it breaks the last turret',()=>{
 const g=heavy(),turret={x:350,y:0,r:22,hp:80,maxHp:80};
 const base={id:'heavy-guard-test',x:350,y:0,r:60,hp:500,enemy:true,
  captured:false,strategicRole:'military',turrets:[turret]};
 g.world.nearbyStations=()=>[base];
 g.hitTurret=(t,damage)=>{t.hp=Math.max(0,t.hp-damage);};
 g.hitEnemyBase=(b,damage)=>{b.hp=Math.max(0,b.hp-damage);};
 g.shipLoadout.specializations.howitzer={path:'piercing',rank:2};
 const plan=planHowitzer(g,{x:350,y:0});assert.ok(plan.ok);
 g.heavyCharge=plan.charge;updateHowitzer(g,1.36);strike(g,.8);
 assert.equal(turret.hp,0);
 assert.equal(base.hp,500,'a turret cannot expose the core during the same explosion');
});

test('a moving target can escape the old marked point during heavy-shell flight',()=>{
 const g=heavy(),t=enemy(360);g.grid.insert(t);
 g.heavyCharge=planHowitzer(g).charge;updateHowitzer(g,1.26);
 t.x=620;strike(g,.9);
 assert.equal(t.hp,500);
 assert.equal(g.heavyShells.length,0);
});

test('howitzer shell passes over intervening rock and detonates on the selected target',()=>{
 const g=heavy(),t=enemy(350),r=rock(135,0,42);g.grid.insert(t);g.rockGrid.insert(r);
 let rocksHit=0;g.damageRock=()=>rocksHit++;
 g.heavyCharge=planHowitzer(g).charge;updateHowitzer(g,1.26);strike(g,.9);
 assert.equal(t.hp,320);
 assert.equal(rocksHit,0,'a high-arcing shell must not strike intervening stone');
 assert.equal(g.heavyShells.length,0);
});

test('howitzer refuses an asteroid-occupied landing before charge or cooldown',()=>{
 const g=heavy(),r=rock(300,0,44);g.rockGrid.insert(r);
 const aimed=planHowitzer(g,{x:300,y:0});
 assert.equal(aimed.ok,false);
 assert.match(aimed.reason,/астероидом/);
 assert.equal(g.heavyCooldown,0);
 assert.equal(planHowitzer(g,{x:400,y:0}).ok,true);
});

test('howitzer cancels without heat or cooldown when a rock drifts into the marked landing',()=>{
 const g=heavy(),plan=planHowitzer(g,{x:300,y:0});
 assert.equal(plan.ok,true);
 g.heavyCharge=plan.charge;
 g.rockGrid.insert(rock(300,0,45));
 updateHowitzer(g,1.26);
 assert.equal(g.heavyCharge,null);
 assert.equal(g.heavyCooldown,0);
 assert.equal(g.heavyShells?.length||0,0);
});

test('howitzer splash is reduced but still reaches a target behind asteroid cover',()=>{
 const g=heavy(),center=enemy(350),behind=enemy(445),r=rock(400,0,34);
 g.grid.insert(center);g.grid.insert(behind);g.rockGrid.insert(r);
 const plan=planHowitzer(g);assert.equal(plan.ok,true);
 g.heavyCharge=plan.charge;updateHowitzer(g,1.26);strike(g,.9);
 assert.equal(center.hp,320);
 assert.equal(behind.hp,392,'cover absorbs forty percent of the blast damage');
});

test('a moving heavy shell detonates at the first intervening enemy, not the memorized aim point',()=>{
 const g=heavy(),rear=enemy(580),front=enemy(190,0,500);
 g.grid.insert(rear);g.grid.insert(front);
 g.designatedTarget={target:rear,expiresAt:g.time+10};
 g.heavyCharge=planHowitzer(g).charge;updateHowitzer(g,1.26);
 strike(g,.45,1/15);
 assert.equal(g.heavyShells.length,0);
 assert.equal(front.hp,320);
 assert.equal(rear.hp,500);
});

test('a formerly hostile vessel receives no howitzer splash after becoming friendly in flight',()=>{
 const g=heavy(),t=enemy(350),nearby=enemy(350,75);
 g.grid.insert(t);g.grid.insert(nearby);
 g.heavyCharge=planHowitzer(g).charge;updateHowitzer(g,1.26);
 nearby.converted=true;
 strike(g,.8);
 assert.equal(t.hp,320);
 assert.equal(nearby.hp,500);
});

test('shell contact remains within one tick at 30 and 60 FPS',()=>{
 const simulated=[];
 for(const hz of [30,60]){
  const g=heavy(),t=enemy(550);g.grid.insert(t);
  g.heavyCharge=planHowitzer(g).charge;
  let time=0;
  while(t.hp===500&&time<4){updateHowitzer(g,1/hz);time+=1/hz;}
  assert.equal(t.hp,320);simulated.push(time);
 }
 near(simulated[0],simulated[1],1/30+.00001);
});

test('ballistic renderer retains both moving shells at low FPS without world-sized beams',()=>{
 const g=flak(),t=enemy(180);g.grid.insert(t);g.updateShipWeapons(.01);
 const calls=[];
 const ctx={save(){},restore(){},setLineDash(){},beginPath(){},moveTo(x,y){calls.push(['move',x,y]);},
  lineTo(x,y){calls.push(['line',x,y]);},arc(x,y,r){calls.push(['arc',x,y,r]);},stroke(){},fill(){}};
 drawBallisticWeapons(ctx,g,15,true,{x:-20,y:-90,w:320,h:200});
 assert.ok(calls.length>=6,'actual pellets need readable 15 FPS traces');
 const heavyGame=heavy();heavyGame.heavyShells=[{x:50,y:0,vx:1,vy:0,tx:280,ty:0}];
 calls.length=0;drawBallisticWeapons(ctx,heavyGame,15,true,{x:-20,y:-90,w:320,h:200});
 assert.ok(calls.some(c=>c[0]==='arc'&&c[3]===110),'the landing circle remains visible');
});
