import test from 'node:test';
import assert from 'node:assert/strict';
import {createContours,connectContour,contourFields,advanceContours,validContours}
 from '../territory-system.js';
import {deployArtillery,advanceFluxArtillery} from '../flux-artillery.js';
import {deploySupport,advanceFluxSupports} from '../flux-supports.js';
import {DEFENSE_CAPACITOR,defenseCapacitorLocation,spendDefenseCharge,
 validDefenseCapacitors,advanceDefenseCapacitors} from '../defense-capacitors.js';

function fixture(){
 const stations=new Map([['A',0,0],['B',1600,0],['C',600,1400]]
  .map(([id,x,y])=>[id,{id,x,y,active:true,enemy:false,suppressed:false,type:'dock',turrets:[]}]));
 const contours=createContours(),world={stations,contours,
  nearbyStations(x,y,r){return [...stations.values()].filter(s=>Math.hypot(x-s.x,y-s.y)<=r);}};
 for(const [a,b] of [['A','B'],['B','C'],['C','A']])assert.ok(connectContour(world,a,b).ok);
 contours.trials.completed=1;contours.flux=80;contours.turretSlotRank=2;
 const player={x:500,y:300,ore:500},point={x:700,y:300};
 const game={world,player,enemies:[],time:0,vw:1200,visuals:{reducedMotion:true},
  heritage:{play(){},vfx:{nova(){},shipExplosion(){},rocketImpact(){}}},
  damageEnemy(e,amount){e.hp=Math.max(0,e.hp-amount);this.hits.push(amount);},
  hitEnemyBase(b,amount){b.hp-=amount;},hitTurret(t,amount){t.hp-=amount;},hits:[]};
 return {world,player,point,game};
}
test('first turret produces exactly one previewable physical capacitor inside its triangle',()=>{
 const {world,player,point}=fixture();
 const preview=defenseCapacitorLocation(world,point,contourFields(world));
 assert.ok(preview);
 const first=deployArtillery(world,player,point,0);
 assert.ok(first.ok,first.reason);
 const cell=world.contours.defenseCapacitors[0];
 assert.equal(world.contours.defenseCapacitors.length,1);
 assert.equal(first.turret.defenseCellFieldId,cell.fieldId);
 assert.equal(cell.x,preview.x);assert.equal(cell.y,preview.y);
 assert.ok(Math.hypot(point.x-cell.x,point.y-cell.y)>50);
 assert.equal(defenseCapacitorLocation(world,point,contourFields(world)),null);
 assert.equal(validDefenseCapacitors(world.contours),true);
});
test('ten independent visible siphons do not create ten times more flux',()=>{
 const {world}=fixture();world.contours.flux=0;
 advanceContours(world,1,1);
 const fields=contourFields(world);
 assert.equal(world.contours.harvesters.length,fields.length*10);
 assert.equal(new Set(world.contours.harvesters.map(h=>h.workerIndex)).size,10);
 for(let t=2;t<=180;t++)advanceContours(world,t,1);
 const delivered=world.contours.delivered;
 assert.ok(delivered>0);
 // One triangular face earns 8*sqrt(area/1e6) per 180 seconds, independent
 // of how many carriers are drawn. Allow a modest discretization margin.
 const area=fields.reduce((sum,f)=>sum+f.area,0);
 const theoretical=8*Math.sqrt(area/1e6);
 assert.ok(delivered<theoretical*1.7,
  'siphon count cannot multiply production by ten: '+delivered+' vs '+theoretical);
 assert.equal(validContours(world.contours,[...world.stations]),true);
});
test('real carrier deliveries feed a capped special reserve without draining the treasury',()=>{
 const {world,player,point}=fixture();
 const built=deployArtillery(world,player,point,0);
 assert.ok(built.ok);
 const afterBuild=world.contours.flux;
 for(let t=1;t<=180;t++)advanceContours(world,t,1);
 const cell=world.contours.defenseCapacitors[0];
 assert.ok(cell.charge>0,'the visible capacitor actually receives incoming siphon packets');
 assert.ok(cell.charge<=DEFENSE_CAPACITOR.capacity);
 assert.ok(world.contours.flux>afterBuild,'the strategic treasury still grows while recharging specials');
 assert.equal(validDefenseCapacitors(world.contours),true);
});
test('a defended face has one shared spendable special reserve with anti-duplicate salvo gap',()=>{
 const {world,player,point}=fixture();
 const first=deployArtillery(world,player,point,0);
 assert.ok(first.ok);
 const cell=world.contours.defenseCapacitors[0];
 cell.charge=1.5;cell.readyAt=0;
 assert.ok(spendDefenseCharge(world,first.turret,.48,35));
 assert.ok(!spendDefenseCharge(world,first.turret,.48,35),'same-frame duplicate refused');
 assert.ok(spendDefenseCharge(world,first.turret,.48,55));
 assert.ok(cell.charge>0&&cell.charge<1);
 assert.equal(validDefenseCapacitors(world.contours),true);
});
test('connected basic artillery replenishes and fires when treasury contains no flux',()=>{
 const {world,player,point,game}=fixture();
 const t=deployArtillery(world,player,point,0).turret;t.readyAt=0;
 world.contours.flux=0;
 game.enemies=[{x:1050,y:310,vx:0,vy:0,r:15,hp:50000,maxHp:50000}];
 for(let i=1;i<=480;i++){game.time=i/20;advanceFluxArtillery(game,1/20);}
 assert.ok(game.hits.length>0,'normal fire does not require harvested flux');
 assert.equal(world.contours.flux,0);
});
test('connected support weapons use free basic charges while specials remain autonomous',()=>{
 const {world,player,point,game}=fixture();
 const t=deploySupport(world,player,point,0,'arc').turret;t.readyAt=0;
 world.contours.flux=0;
 game.enemies=[{x:point.x+125,y:point.y,r:15,hp:5000,maxHp:5000}];
 for(let i=1;i<=360;i++){game.time=i/20;advanceFluxSupports(game,1/20);}
 assert.ok(game.hits.length>0);
 assert.equal(world.contours.flux,0);
});
