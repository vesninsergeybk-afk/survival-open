import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createContours,connectContour} from '../territory-system.js';
import {FLUX_ARTILLERY,ARTILLERY_MODES,artilleryOffer,artilleryConnection,
 artilleryLinks,deployArtillery,advanceFluxArtillery,chooseArtilleryAim,
 setArtilleryMode,validFluxArtillery,drawFluxArtillery,turnArtilleryGun} from '../flux-artillery.js';
import {readControls,DEFAULT_CONTROLS} from '../control-layout.js';

const gameEntry=new URL('../game.js',import.meta.url);
const gameSource=readFileSync(gameEntry,'utf8').replace(/\nnew ArcadeGame\(\);\s*$/,'\n')
 .replace(/from '(\.[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,gameEntry).href));
const {ArcadeGame}=await import('data:text/javascript;base64,'+Buffer.from(gameSource).toString('base64'));

const fixture=()=>{
 const stations=new Map([['A',{id:'A',x:0,y:0}],['B',{id:'B',x:1600,y:0}],
  ['C',{id:'C',x:600,y:1400}]].map(([id,p])=>[id,{...p,active:true,
   enemy:false,suppressed:false,type:'dock',turrets:[]}]));
 const contours=createContours(),world={stations,contours,
  nearbyStations(x,y,r){return [...stations.values()].filter(s=>Math.hypot(s.x-x,s.y-y)<r);}};
 for(const [a,b] of [['A','B'],['B','C'],['C','A']])assert.ok(connectContour(world,a,b).ok);
 const player={x:500,y:300,ore:200},point={x:700,y:300};
 const game={world,player,enemies:[],time:0,vw:1200,
  damaged:[],damageEnemy(e,value,source){this.damaged.push({e,value,source});e.hp=Math.max(0,e.hp-value);},
  hitTurret(t,value){t.hp=Math.max(0,t.hp-value);},
  hitEnemyBase(b,value){b.hp=Math.max(b.maxHp*.2,b.hp-value);}};
 return {world,player,point,game};
};

test('the builder is locked until the pilot personally clears the first contour',()=>{
 const {world,player,point}=fixture();world.contours.flux=20;
 assert.match(artilleryOffer(world,player,point).reason,/Сначала самостоятельно/);
 assert.equal(deployArtillery(world,player,point,0).ok,false);
 assert.equal(world.contours.artillery.length,0);
 world.contours.trials.completed=1;
 assert.equal(artilleryOffer(world,player,point).ok,true);
});

test('building consumes alloy and flux once, starts uncharged and observes placement rules',()=>{
 const {world,player,point}=fixture();world.contours.trials.completed=1;
 world.contours.flux=5;
 const built=deployArtillery(world,player,point,10);
 assert.equal(built.ok,true);
 assert.equal(world.contours.flux,5-FLUX_ARTILLERY.fluxCost);
 assert.equal(player.ore,200-FLUX_ARTILLERY.oreCost);
 assert.equal(built.turret.ammo,0);
 assert.equal(built.turret.readyAt,10+FLUX_ARTILLERY.buildSeconds);
 assert.equal(validFluxArtillery(world.contours),true);
 assert.match(artilleryOffer(world,player,point).reason,/Слишком близко к другому/);
 assert.match(artilleryOffer(world,player,{x:2000,y:2000}).reason,/далеко от корабля/);
});

test('cable anchors to a productive triangle edge, and broken links stop resupply',()=>{
 const {world,player,point,game}=fixture();world.contours.trials.completed=1;
 const edges=artilleryLinks(world);
 assert.equal(edges.length,3);
 assert.ok(artilleryConnection(point,edges).cable>0);
 world.contours.flux=12;
 deployArtillery(world,player,point,0);
 for(let t=1;t<=40;t++){game.time=t;advanceFluxArtillery(game,1);}
 const ammo=world.contours.artillery[0].ammo;
 assert.ok(ammo>0&&ammo<=FLUX_ARTILLERY.magazine);
 world.stations.get('B').suppressed=true;
 assert.equal(artilleryLinks(world).length,0);
 for(let t=41;t<=100;t++){game.time=t;advanceFluxArtillery(game,1);}
 assert.equal(world.contours.artillery[0].ammo,ammo);
 assert.equal(world.contours.artilleryPackets.length,0);
});

test('nearby emplacements replenish faster than remote ones without a hard cable cutoff',()=>{
 const near=fixture(),far=fixture();
 for(const pack of [near,far]){pack.world.contours.trials.completed=1;pack.world.contours.flux=100;}
 const distant={x:650,y:3600},farPilot={x:620,y:3400,ore:200};
 assert.equal(deployArtillery(near.world,near.player,{x:600,y:100},0).ok,true);
 assert.equal(deployArtillery(far.world,farPilot,distant,0).ok,true);
 for(let t=1;t<=90;t++){
  near.game.time=t;far.game.time=t;
  advanceFluxArtillery(near.game,1);advanceFluxArtillery(far.game,1);
 }
 assert.ok(near.world.contours.artillery[0].ammo>far.world.contours.artillery[0].ammo,
  'distance limits sustained supply, even with the same large global stock');
 assert.equal(validFluxArtillery(far.world.contours),true);
});

test('artillery predicts a fallible lead, fires an area shell and spends a prepaid charge',()=>{
 const {world,game,player,point}=fixture();world.contours.trials.completed=1;
 world.contours.flux=20;
 const turret=deployArtillery(world,player,point,0).turret;
 const enemy={x:760,y:300,vx:20,vy:0,hp:120,maxHp:120,r:18};
 const wing={x:790,y:320,vx:0,vy:0,hp:70,maxHp:70,r:18};
 game.enemies=[enemy,wing];
 const prediction=chooseArtilleryAim(game,turret);
 assert.ok(prediction&&prediction.x>enemy.x);
 for(let t=1;t<=150;t++){
  game.time=t;advanceFluxArtillery(game,1);
 }
 assert.ok(game.damaged.length>0);
 assert.ok(turret.lastShotAt>0);
 assert.ok(game.damaged.every(hit=>hit.source===turret),
  'autonomous damage must not masquerade as a player hit');
 assert.ok(game.damaged.some(hit=>hit.e===enemy));
 assert.ok(game.damaged.some(hit=>hit.e===wing));
 assert.equal(validFluxArtillery(world.contours),true);
});

test('shell flies visibly before its real area hit, even if the gun is destroyed midflight',()=>{
 const {world,game,player,point}=fixture();world.contours.trials.completed=1;
 world.contours.flux=10;
 const turret=deployArtillery(world,player,point,0).turret;
 turret.readyAt=0;turret.ammo=1;
 const enemy={x:790,y:300,hp:120,maxHp:120,r:20};game.enemies=[enemy];
 game.time=1;advanceFluxArtillery(game,.1);
 assert.ok(turret.aimingUntil>game.time);
 game.time=turret.aimingUntil+.01;advanceFluxArtillery(game,.1);
 assert.equal(world.contours.artilleryShells.length,1);
 const shell=world.contours.artilleryShells[0];
 assert.ok(shell.arriveAt>shell.launchedAt);
 assert.equal(enemy.hp,120,'the aiming phase never causes an invisible instantaneous hit');
 turret.hp=0;
 game.time=(shell.launchedAt+shell.arriveAt)/2;advanceFluxArtillery(game,.1);
 assert.equal(enemy.hp,120,'the midair shell has not exploded');
 assert.equal(world.contours.artilleryShells.length,1);
 game.time=shell.arriveAt+.01;advanceFluxArtillery(game,.1);
 assert.ok(enemy.hp<120,'a committed shell still strikes after its cannon is destroyed');
 assert.equal(world.contours.artilleryShells.length,0);
 assert.equal(game.fluxArtilleryFx.length,1);
 assert.equal(validFluxArtillery(world.contours),true);
 game.time+=FLUX_ARTILLERY.wreckLifetime+.2;advanceFluxArtillery(game,.1);
 assert.equal(world.contours.artillery.length,0,'wrecks are removed after their fade');
});

test('artillery rotation is bounded, takes the shortest arc, and shells leave the muzzle',()=>{
 const sixty=1/60,start=-Math.PI/2;
 const first=turnArtilleryGun(start,Math.PI/2,sixty);
 assert.ok(Math.abs(first-start)<.06,'the barrel must not snap through 180 degrees');
 assert.ok(Math.abs(first-start)>.01,'the barrel must actually rotate');
 const wrapped=turnArtilleryGun(3.1,-3.1,.05);
 assert.ok(Math.abs(Math.atan2(Math.sin(wrapped-3.1),Math.cos(wrapped-3.1)))<.2,
  'turning past the -pi/pi boundary must not spin backward');
 const {world,game,player,point}=fixture();world.contours.trials.completed=1;
 world.contours.flux=10;
 const turret=deployArtillery(world,player,point,0).turret;
 turret.readyAt=0;turret.ammo=1;
 game.enemies=[{x:850,y:300,hp:100,maxHp:100,r:18}];
 game.time=1;advanceFluxArtillery(game,sixty);
 const before=turret.gunAngle;
 game.time+=sixty;advanceFluxArtillery(game,sixty);
 assert.ok(Math.abs(turret.gunAngle-before)<=.06,'first tracking frame respects angular speed');
 for(let i=0;i<95;i++){game.time+=sixty;advanceFluxArtillery(game,sixty);}
 assert.ok(world.contours.artilleryShells.length>0);
 const shell=world.contours.artilleryShells[0];
 assert.ok(Math.abs(Math.hypot(shell.startX-turret.x,shell.startY-turret.y)-
  FLUX_ARTILLERY.muzzleOffset)<1e-5,'projectile starts at the muzzle');
 assert.ok(shell.startX>turret.x+40,'a gun aimed right must fire from its rightmost tip');
 assert.equal(validFluxArtillery(world.contours),true);
});

test('fired shells cannot invent out-of-range positions or infinite flight times in saves',()=>{
 const {world,player,point}=fixture();world.contours.trials.completed=1;
 world.contours.flux=3;const turret=deployArtillery(world,player,point,0).turret;
 world.contours.artilleryShells=[{turretId:turret.id,startX:point.x,startY:point.y,
  targetX:point.x+100,targetY:point.y,launchedAt:10,arriveAt:10.4}];
 assert.equal(validFluxArtillery(world.contours),true);
 world.contours.artilleryShells[0].arriveAt=100;
 assert.equal(validFluxArtillery(world.contours),false);
});

test('the asset and all live VFX phases render safely through the canvas API',()=>{
 const sprite=new URL('../assets/artillery/flux-howitzer-base-v1.svg',import.meta.url);
 assert.equal(existsSync(sprite),true);
 const embedded=readFileSync(sprite,'utf8').match(/href="data:image\/webp;base64,([^"]+)"/);
 assert.ok(embedded,'sprite wraps the real transparent raster in a portable SVG');
 const bytes=Buffer.from(embedded[1],'base64');
 assert.equal(bytes.subarray(0,4).toString(),'RIFF');
 assert.equal(bytes.subarray(8,12).toString(),'WEBP');
 const head=new URL('../assets/artillery/flux-howitzer-head-v2.svg',import.meta.url);
 assert.equal(existsSync(head),true);
 const headEmbed=readFileSync(head,'utf8').match(/href="data:image\/webp;base64,([^"]+)"/);
 assert.ok(headEmbed,'the independent rotating gun is a real game-ready sprite');
 assert.equal(Buffer.from(headEmbed[1],'base64').subarray(8,12).toString(),'WEBP');
 const {world,game,player,point}=fixture();world.contours.trials.completed=1;
 world.contours.flux=10;const turret=deployArtillery(world,player,point,0).turret;
 turret.readyAt=0;turret.ammo=7;turret.lastChargeAt=9.8;
 turret.lastShotAt=9.8;turret.aimingUntil=11;turret.aimX=850;
 turret.aimY=350;game.time=10;
 world.contours.artilleryPackets=[{turretId:turret.id,edgeId:'A|B',charges:1,amount:.25,
  launchedAt:9.5,arriveAt:10.5,path:[{x:0,y:0},{x:700,y:0},point]}];
 world.contours.artilleryShells=[{turretId:turret.id,startX:point.x,startY:point.y,
  targetX:850,targetY:350,launchedAt:9.5,arriveAt:10.5}];
 game.fluxArtilleryFx=[{x:800,y:370,at:9.7,id:1}];
 const calls=[];
 const ctx=new Proxy({}, {get:(obj,key)=>key in obj?obj[key]:
  key==='createRadialGradient'?()=>({addColorStop(){}}):
  (...args)=>calls.push({key,args}),set:(obj,key,value)=>(obj[key]=value,true)});
 assert.doesNotThrow(()=>drawFluxArtillery(ctx,game,{x:-100,y:-100,w:1200,h:850},
  {point:{x:700,y:520},player}));
 assert.ok(calls.some(call=>call.key==='ellipse'),'flight shadows and muzzle flare are drawn');
 assert.ok(calls.some(call=>call.key==='setLineDash'),'telegraphed AoE is drawn');
 assert.ok(calls.filter(call=>call.key==='arc').length>15,
  'shell, energy packets, charge pulse, warning and explosion all draw');
});

test('target preferences are explicit and invalid modes cannot silently alter the AI',()=>{
 const {world,game,point}=fixture();world.contours.trials.completed=1;
 const t={x:point.x,y:point.y,mode:'smart'};
 game.enemies=[{x:850,y:300,hp:15,maxHp:40,r:14},
  {x:900,y:310,hp:100,maxHp:120,r:26}];
 const smart=chooseArtilleryAim(game,t);
 assert.ok(smart);
 assert.equal(setArtilleryMode(t,'weak'),true);
 assert.equal(chooseArtilleryAim(game,t).target.object.hp,15);
 assert.equal(setArtilleryMode(t,'unknown'),false);
 assert.ok(ARTILLERY_MODES.includes(t.mode));
});

test('legacy custom controls retain their mappings when the builder key is introduced',()=>{
 const legacy={...DEFAULT_CONTROLS};delete legacy.build;
 legacy.skills='KeyT';
 const result=readControls({getItem:()=>JSON.stringify(legacy)});
 assert.equal(result.skills,'KeyT');
 assert.equal(result.build,'KeyG');
});

test('the actual paused builder chooses a reachable point and returns to flight on construction',()=>{
 const {world,player}=fixture(),g=Object.create(ArcadeGame.prototype),oldDocument=globalThis.document;
 const ids=new Map(['buildPlanning','buildRing','buildPlacement','buildArtillery',
  'buildPlaceHint','artilleryModeMenu'].map(id=>[id,{hidden:true,textContent:'',focus(){},
   querySelectorAll(){return [];}}]));
 globalThis.document={getElementById:id=>ids.get(id)||null};
 try{
  world.contours.trials.completed=1;world.contours.flux=8;
  Object.assign(g,{world,player,time:12,vw:1200,paused:false,dead:false,
   buildPlanning:null,overlay:{hidden:true},keys:new Set(['KeyW']),
   canvas:{focus(){}},endInteraction(){},notice(){}});
  assert.equal(g.openBuildPlanner(),true);
  assert.equal(g.paused,true);
  assert.equal(g.keys.size,0);
  assert.equal(ids.get('buildPlanning').hidden,false);
  g.selectBuildArtillery();
  assert.equal(g.buildPlanning.stage,'place');
  assert.match(ids.get('buildPlaceHint').textContent,/ЛКМ: построить/);
  assert.equal(g.placeBuildArtillery(g.buildPlanning.point),true);
  assert.equal(g.paused,false);
  assert.equal(g.buildPlanning,null);
  assert.equal(world.contours.artillery.length,1);
  assert.equal(ids.get('buildPlanning').hidden,true);
 }finally{globalThis.document=oldDocument;}
});

test('gameplay wiring keeps planning, save validation and contextual modes in the live entrypoint',()=>{
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const saves=readFileSync(new URL('../run-checkpoint.js',import.meta.url),'utf8');
 assert.match(game,/this\.openBuildPlanner\(\)/);
 assert.match(game,/this\.placeBuildArtillery\(point\)/);
 assert.match(game,/advanceFluxArtillery\(this,dt\)/);
 assert.match(game,/drawFluxArtillery\(c,this,cam/);
 assert.match(html,/id="buildPlanning"/);
 assert.match(html,/id="artilleryModeMenu"/);
 assert.match(saves,/validFluxArtillery\(w\.contours\)/);
});
