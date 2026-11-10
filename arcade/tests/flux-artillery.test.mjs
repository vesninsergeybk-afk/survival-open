import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createContours,connectContour,contourFields} from '../territory-system.js';
import {FLUX_ARTILLERY,ARTILLERY_MODES,artilleryOffer,maxArtilleryPreload,artilleryConnection,closeDefenseTarget,
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
function advanceUntilFirstShell(game,step=.05){
 for(let i=0;i<120;i++){
  game.time+=step;advanceFluxArtillery(game,step);
  if(game.world.contours.artilleryShells.length)return game.world.contours.artilleryShells[0];
 }
 assert.fail('battery did not complete its turn, aim and first launch');
}

test('the builder is locked until the pilot personally clears the first contour',()=>{
 const {world,player,point}=fixture();world.contours.flux=20;
 assert.match(artilleryOffer(world,player,point).reason,/Сначала самостоятельно/);
 assert.equal(deployArtillery(world,player,point,0).ok,false);
 assert.equal(world.contours.artillery.length,0);
 world.contours.trials.completed=1;
 assert.equal(artilleryOffer(world,player,point).ok,true);
});

test('the published artillery laboratory has a genuinely productive playable triangle',()=>{
 const lab=readFileSync(new URL('../studio/flux-artillery-lab.html',import.meta.url),'utf8');
 const stations=[...lab.matchAll(/\['([ABC])',(-?\d+),(-?\d+)\]/g)].slice(0,3);
 assert.equal(stations.length,3,'laboratory fixture must expose three actual station coordinates');
 const world={stations:new Map(stations.map(([,id,x,y])=>[id,{id,x:+x,y:+y,
  active:true,enemy:false,suppressed:false,turrets:[]}])),contours:createContours()};
 for(const [a,b] of [['A','B'],['B','C'],['C','A']])assert.ok(connectContour(world,a,b).ok);
 assert.ok(contourFields(world).length,'a visible triangle below the minimum area cannot power a turret');
 world.contours.trials.completed=1;world.contours.flux=250;
 assert.equal(deployArtillery(world,{x:320,y:340,ore:999},{x:485,y:316},0).ok,true);
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

test('player can buy zero, four or every affordable shell upfront without double spending flux',()=>{
 const first=fixture();first.world.contours.trials.completed=1;first.world.contours.flux=3;
 assert.equal(maxArtilleryPreload(first.world),8);
 assert.equal(artilleryOffer(first.world,first.player,first.point,9).ok,false);
 const loaded=deployArtillery(first.world,first.player,first.point,0,4);
 assert.equal(loaded.ok,true);assert.equal(loaded.preload,4);
 assert.equal(loaded.turret.ammo,4);assert.equal(loaded.turret.stockpile,0);
 assert.equal(first.world.contours.flux,1);
 assert.equal(validFluxArtillery(first.world.contours),true);
 const second=fixture();second.world.contours.trials.completed=1;second.world.contours.flux=9;
 const all=maxArtilleryPreload(second.world);
 assert.equal(all,32);
 const built=deployArtillery(second.world,second.player,second.point,0,all);
 assert.equal(built.turret.ammo,15);assert.equal(built.turret.stockpile,17);
 assert.equal(second.world.contours.flux,0);
 assert.equal(validFluxArtillery(second.world.contours),true);
 built.turret.readyAt=0;built.turret.ammo=0;
 second.world.stations.get('B').suppressed=true;
 second.game.time=1;advanceFluxArtillery(second.game,.05);
 assert.equal(built.turret.ammo,15,'local paid reserve works without an active supply cable');
 assert.equal(built.turret.stockpile,2);
 const third=fixture();third.world.contours.trials.completed=1;third.world.contours.flux=1;
 assert.equal(deployArtillery(third.world,third.player,third.point,0,0).turret.ammo,0);
 assert.equal(third.world.contours.flux,0);
});

test('tracking refreshes a moving target before release instead of firing at its old position',()=>{
 const {world,player,point,game}=fixture();world.contours.trials.completed=1;
 world.contours.flux=2;
 const turret=deployArtillery(world,player,point,0,4).turret;
 turret.readyAt=0;
 const enemy={x:1050,y:300,vx:0,vy:0,hp:1000,maxHp:1000,r:15};
 game.enemies=[enemy];game.time=.05;advanceFluxArtillery(game,.05);
 const original=turret.aimX;
 enemy.x+=80;enemy.vx=65;
 for(let i=0;i<5;i++){game.time+=.05;advanceFluxArtillery(game,.05);}
 assert.ok(turret.aimX>original+80,'moving target and shell flight affect the current aim');
 assert.equal(validFluxArtillery(world.contours),true);
});

test('one stock barrel fires three low-power paid shells at different locations',()=>{
 const {world,player,point,game}=fixture();world.contours.trials.completed=1;
 world.contours.flux=1.75;
 const t=deployArtillery(world,player,point,0,3).turret;
 assert.equal(t.ammo,3);assert.equal(world.contours.flux,0);
 t.readyAt=0;game.enemies=[{x:1030,y:300,vx:0,vy:0,hp:1000,maxHp:1000,r:18}];
 advanceUntilFirstShell(game);
 for(let i=0;i<30&&t.salvoLeft;i++){
  game.time+=.05;advanceFluxArtillery(game,.05);
 }
 const shells=world.contours.artilleryShells;
 assert.equal(shells.length,3);assert.equal(t.ammo,0);
 assert.equal(new Set(shells.map(s=>`${Math.round(s.targetX)},${Math.round(s.targetY)}`)).size,3,
  JSON.stringify(shells.map(s=>({index:s.salvoIndex,x:s.targetX,y:s.targetY}))));
 assert.ok(shells.every(s=>s.barrelIndex===0),'all three shells leave one real barrel');
 assert.equal(validFluxArtillery(world.contours),true);
});

test('sustained fire uses complete three-shell salvos and recharges within an eight-second cycle near the edge',()=>{
 const {world,player,point,game}=fixture();world.contours.trials.completed=1;
 world.contours.flux=100;
 const t=deployArtillery(world,player,point,0,4).turret;
 game.enemies=[{x:1100,y:300,vx:0,vy:0,r:15,hp:1e7,maxHp:1e7}];
 const launches=[];let last=-1;
 for(let i=1;i<=1200;i++){
  game.time=i*.05;advanceFluxArtillery(game,.05);
  if(t.lastShotAt>=0&&t.lastShotAt!==last){last=t.lastShotAt;launches.push(game.time);}
 }
 const salvos=[];
 for(const time of launches){
  if(!salvos.length||time-salvos.at(-1).at(-1)>1)salvos.push([time]);
  else salvos.at(-1).push(time);
 }
 assert.ok(salvos.length>=5,'one uncongested nearby battery needs several real salvos each minute');
 assert.ok(salvos.every(x=>x.length===3),
  'every reload must produce the complete three-projectile area salvo: '+JSON.stringify(salvos));
 assert.ok(salvos.slice(1).every((s,i)=>s[0]-salvos[i][0]<11),
  'delivery at 300m cable distance must not make an eight-second gun wait tens of seconds');
 assert.equal(validFluxArtillery(world.contours),true);
});

test('built-in close-range gun protects against rammers without spending flux or artillery rounds',()=>{
 const {world,player,point,game}=fixture();world.contours.trials.completed=1;
 world.contours.flux=1;
 const turret=deployArtillery(world,player,point,0,0).turret;
 turret.readyAt=0;turret.nextShotAt=999;
 const target={type:'berserker',x:point.x+130,y:point.y,vx:0,vy:0,hp:100,maxHp:100,r:15};
 game.enemies=[target];game.time=.1;advanceFluxArtillery(game,.1);
 assert.equal(game.damaged.length,1,'a built turret fires without paid ammo');
 assert.equal(turret.ammo,0);
 assert.equal(world.contours.flux,0);
 turret.ammo=3;game.time=.31;advanceFluxArtillery(game,.21);
 assert.equal(game.damaged.length,2);
 assert.equal(turret.ammo,3,'the point-defence gun never consumes reserved artillery rounds');
 world.stations.get('B').suppressed=true;
 assert.equal(artilleryLinks(world).length,0);
 game.time=.52;advanceFluxArtillery(game,.21);
 assert.equal(game.damaged.length,3,'local point defence still works when its flux cable is broken');
 assert.equal(turret.ammo,3);assert.equal(world.contours.flux,0);
});

test('free point defence cannot mow down ranged patrols and obeys its target priority',()=>{
 const {world,player,point,game}=fixture();world.contours.trials.completed=1;
 world.contours.flux=1;
 const turret=deployArtillery(world,player,point,0,0).turret;
 turret.readyAt=0;turret.nextShotAt=999;
 const ranged={type:'fighter',x:point.x+40,y:point.y,hp:100,maxHp:100,r:16};
 game.enemies=[ranged];game.time=.1;advanceFluxArtillery(game,.1);
 assert.equal(game.damaged.length,0,'a normal fighter at point-blank range is still a ranged threat');
 assert.equal(closeDefenseTarget(game,turret),null);
 const charging={...ranged,x:point.x+175,state:'charge'};
 const ordered={...ranged,x:point.x+140,ramOrder:{target:turret}};
 game.enemies=[ranged,charging,ordered];
 assert.equal(closeDefenseTarget(game,turret),ordered,'a ramming squad aimed at this battery takes priority');
 game.time=.31;advanceFluxArtillery(game,.21);
 assert.equal(game.damaged[0].e,ordered);
 assert.equal(turret.ammo,0,'free close defence needs no manufactured ammunition');
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
 turret.readyAt=0;turret.ammo=3;
 const enemy={x:1030,y:300,hp:120,maxHp:120,r:20};game.enemies=[enemy];
 game.time=1;advanceFluxArtillery(game,.1);
 assert.ok(turret.aimingUntil>game.time);
 advanceUntilFirstShell(game);
 assert.equal(world.contours.artilleryShells.length,1);
 const shell=world.contours.artilleryShells[0];
 assert.ok(shell.arriveAt>shell.launchedAt);
 assert.equal(shell.powerRank,0,'starting shell has the small unupgraded visual core');
 shell.powerRank=5;
 assert.equal(validFluxArtillery(world.contours),false,'invalid visual tier cannot enter a checkpoint');
 shell.powerRank=0;
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
 assert.equal(world.contours.artillery.length,1,'wreck keeps its slot for the pilot to repair');
 assert.equal(world.contours.artillery[0].hp,0);
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
 turret.readyAt=0;turret.ammo=3;
 game.enemies=[{x:850,y:300,hp:100,maxHp:100,r:18}];
 game.time=1;advanceFluxArtillery(game,sixty);
 const before=turret.gunAngle;
 game.time+=sixty;advanceFluxArtillery(game,sixty);
 assert.ok(Math.abs(turret.gunAngle-before)<=.06,'first tracking frame respects angular speed');
 for(let i=0;i<155&&world.contours.artilleryShells.length===0;i++){
  game.time+=sixty;advanceFluxArtillery(game,sixty);
 }
 assert.ok(world.contours.artilleryShells.length>0);
 const shell=world.contours.artilleryShells[0];
 assert.ok(Math.abs(Math.hypot(shell.startX-turret.x,shell.startY-turret.y)-
  FLUX_ARTILLERY.muzzleOffset)<1e-5,'projectile starts at the muzzle');
 assert.ok(shell.startX>turret.x+40,'a gun aimed right must fire from its rightmost tip');
 assert.equal(validFluxArtillery(world.contours),true);
});

test('the servo speaks only when a fresh target requires a substantial turn',()=>{
 const {world,game,player,point}=fixture();world.contours.trials.completed=1;
 world.contours.flux=10;
 const turret=deployArtillery(world,player,point,0).turret;
 turret.readyAt=0;turret.ammo=3;
 game.enemies=[{x:950,y:300,hp:200,maxHp:200,r:18}];
 const heard=[];game.heritage={play:kind=>heard.push(kind)};
 game.time=1;advanceFluxArtillery(game,1/60);
 assert.deepEqual(heard.filter(x=>x==='artilleryServo'),['artilleryServo']);
 assert.ok(heard.includes('artilleryAcquire'));
 for(let i=0;i<30;i++){game.time+=1/60;advanceFluxArtillery(game,1/60);}
 assert.equal(heard.filter(x=>x==='artilleryServo').length,1,
  'one motor cue per target acquisition, not one per animation frame');
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

test('selected artillery shows its actual targeting and blast radii on the battlefield',()=>{
 const {world,game,player,point}=fixture();world.contours.trials.completed=1;
 world.contours.flux=30;
 const turret=deployArtillery(world,player,point,0).turret;
 game.artilleryMenuTarget=turret;
 const radii=[];
 const ctx=new Proxy({}, {get:(obj,key)=>key in obj?obj[key]:
  key==='createRadialGradient'?()=>({addColorStop(){}}):
  key==='arc'?(_x,_y,r)=>radii.push(r):()=>{},
  set:(obj,key,value)=>(obj[key]=value,true)});
 drawFluxArtillery(ctx,game,{x:0,y:0,w:1500,h:1100});
 assert.ok(radii.includes(740));assert.ok(radii.includes(110));
});

test('the chassis and rotating head keep identical pixel anchors through recoil, damage and wreckage',async()=>{
 const previous=globalThis.Image;
 class LoadedSprite {complete=true;naturalWidth=320;set src(value){this.url=value;}}
 globalThis.Image=LoadedSprite;
 let drawSprites;
 try{({drawFluxArtillery:drawSprites}=await import('../flux-artillery.js?pixel-anchor-regression=1'));}
 finally{if(previous===undefined)delete globalThis.Image;else globalThis.Image=previous;}
 const {world,game,player,point}=fixture();world.contours.trials.completed=1;
 world.contours.flux=10;
 const turret=deployArtillery(world,player,point,0).turret;
 turret.readyAt=0;turret.ammo=5;
 const anchors=()=>{
  const calls=[];
  const ctx=new Proxy({},{get:(obj,key)=>key in obj?obj[key]:
   key==='createRadialGradient'?()=>({addColorStop(){}}):
   (...args)=>{if(key==='drawImage')calls.push(args.slice(1));},
   set:(obj,key,value)=>(obj[key]=value,true)});
  drawSprites(ctx,game,{x:-100,y:-100,w:1200,h:850});
  assert.equal(calls.length,2,'one fixed chassis and one independently rotating head');
  return calls;
 };
 game.time=4;const intact=anchors();
 turret.lastShotAt=4;turret.gunAngle=.9;game.time=4.065;
 assert.deepEqual(anchors(),intact,'the visible barrel must not jump on firing');
 turret.hp=28;game.time=4.1;
 assert.deepEqual(anchors(),intact,'damaged state must retain the same alignment');
 turret.hp=0;turret.lastDestroyedAt=4.1;game.time=4.15;
 assert.deepEqual(anchors(),intact,'wreck must use the original image dimensions and pivot');
 assert.deepEqual(intact,[[ -41,-41,82,82 ],[ -51,-67,102,102 ]]);
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
 const legacy={...DEFAULT_CONTROLS};delete legacy.build;delete legacy.fieldWeapon;
 legacy.skills='KeyT';
 const result=readControls({getItem:()=>JSON.stringify(legacy)});
 assert.equal(result.skills,'KeyT');
 assert.equal(result.build,'KeyG');
 assert.equal(result.fieldWeapon,'KeyH');
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
