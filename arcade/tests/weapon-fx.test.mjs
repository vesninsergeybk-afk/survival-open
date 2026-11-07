import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {WEAPON_FX_KINDS,WEAPON_FX_CAP,emitWeaponFx,updateWeaponFx,drawWeaponFx,plasmaVisualStrength} from '../weapon-fx.js';
import {ArcadeHeritage} from '../heritage.js';
import {updateHowitzer,updateFlakPellets,fireAimedRail} from '../ship-weapons.js';
import {createFieldLoan} from '../field-weapons.js';
import {damageTarget} from '../combat-targets.js';
import {loadoutProfile} from '../ship-loadout.js';
import {SOUND_CATALOG} from '../../audio-lab/sound-map.js';
import {game} from './weapons-scene.mjs';

const A={x:21,y:-19},B={x:281,y:57};
function canvas(){
 const strokes=[],arcs=[],fills=[];let path=[];
 const c={strokeStyle:null,lineWidth:0,globalAlpha:1,
  save(){},restore(){},setLineDash(){},closePath(){},
  beginPath(){path=[];},moveTo(x,y){path.push({x,y});},lineTo(x,y){path.push({x,y});},
  arc(x,y,r){arcs.push({x,y,r});},
  fill(){fills.push({color:this.fillStyle,alpha:this.globalAlpha,path:[...path]});},
  stroke(){strokes.push({color:this.strokeStyle,width:this.lineWidth,alpha:this.globalAlpha,path:[...path]});}};
 return {c,strokes,arcs,fills};
}
const enemy=(x,y=0)=>({x,y,r:15,hp:500,maxHp:500,type:'fighter',converted:false});
const install=(g,id)=>{
 g.shipLoadout.slots[0]=id;g.weaponProfile=loadoutProfile(g.shipLoadout);
};

test('all seven signatures accept only finite actual endpoints and keep a strict bound',()=>{
 const g={time:5,weaponFx:[]};
 assert.equal(WEAPON_FX_KINDS.length,7);
 assert.equal(new Set(WEAPON_FX_KINDS).size,7);
 for(const kind of WEAPON_FX_KINDS){
  assert.equal(emitWeaponFx(g,kind,A,B),true);
  const event=g.weaponFx.at(-1);
  assert.equal(event.kind,kind);assert.equal(event.x,A.x);assert.equal(event.y,A.y);
  assert.equal(event.x2,B.x);assert.equal(event.y2,B.y);
  assert.ok(event.life>=.20,'must survive more than one 15 FPS frame');
 }
 assert.equal(emitWeaponFx(g,'unknown',A,B),false);
 assert.equal(emitWeaponFx(g,'rail',A,{x:NaN,y:3}),false);
 assert.equal(emitWeaponFx(g,'rail',A,A),false);
 for(let i=0;i<1000;i++)emitWeaponFx(g,'plasma',{x:i,y:0},B);
 assert.equal(g.weaponFx.length,WEAPON_FX_CAP);
 assert.equal(g.weaponFx.at(-1).x,999);
 updateWeaponFx(g,.18);assert.ok(g.weaponFx.every(e=>e.age>.17));
 updateWeaponFx(g,.8);assert.deepEqual(g.weaponFx,[]);
});

test('seven distinct silhouettes remain drawn at 15 FPS and under reduced motion',()=>{
 const colors=[];
 for(const kind of WEAPON_FX_KINDS){
  const g={time:3};emitWeaponFx(g,kind,A,B);
  const low=canvas(),high=canvas();
  drawWeaponFx(low.c,g.weaponFx,15,true,{x:-30,y:-50,w:420,h:180});
  drawWeaponFx(high.c,g.weaponFx,60,false);
  assert.ok(low.strokes.length>=3,`${kind} disappears at 15 FPS`);
  assert.ok(high.strokes.length>=low.strokes.length,`${kind} gets less legible at 60 FPS`);
  colors.push(low.strokes.map(s=>s.color).join('|'));
 }
 assert.equal(new Set(colors).size,7,'each weapon must have its own color and structural fingerprint');
});

test('reduced motion fixes animated anchors while normal mode advances them',()=>{
 for(const kind of ['plasma','resonator','howitzer']){
  const g={time:1};emitWeaponFx(g,kind,A,B);
  const event=g.weaponFx[0],first=canvas(),second=canvas(),moving=canvas();
  event.age=.01;drawWeaponFx(first.c,g.weaponFx,60,true);
  event.age=.12;drawWeaponFx(second.c,g.weaponFx,60,true);
  drawWeaponFx(moving.c,g.weaponFx,60,false);
  assert.deepEqual(first.arcs,second.arcs,`${kind} motion setting changed the geometry`);
  assert.notDeepEqual(moving.arcs,second.arcs,`${kind} lost its non-reduced pulse`);
 }
});

test('plasma thins toward the real impact and each upgrade preserves more width',()=>{
 const create=(rangeRank,spec=null)=>{
  const g={time:3};
  emitWeaponFx(g,'plasma',{x:0,y:0},{x:275,y:0},
   {profile:{distance:300,range:300,rangeRank,spec,gain:1}});
  const drawing=canvas();drawWeaponFx(drawing.c,g.weaponFx,60,true);
  return {beam:g.weaponFx[0],drawing};
 };
 const basic=create(0),upgraded=create(3),focused=create(3,{path:'focus',rank:2});
 assert.equal(plasmaVisualStrength(basic.beam,0),1);
 assert.equal(plasmaVisualStrength(basic.beam,1),.28);
 assert.equal(plasmaVisualStrength(upgraded.beam,1),.64);
 assert.equal(plasmaVisualStrength(focused.beam,1),.90);
 const ribbonWidths=value=>{
  const path=value.drawing.fills[0].path,steps=(path.length-2)/2;
  return {start:Math.abs(path[0].y-path.at(-1).y),
   end:Math.abs(path[steps].y-path[steps+1].y)};
 };
 const a=ribbonWidths(basic),b=ribbonWidths(upgraded),c=ribbonWidths(focused);
 assert.ok(a.start>a.end*2,'the first meter must look dramatically stronger than the tip');
 assert.ok(a.end<b.end&&b.end<c.end,'the last meters remain visibly denser after upgrades');
 const forks=result=>result.drawing.strokes.filter(stroke=>stroke.color==='#c8f6ff').length;
 assert.ok(forks(basic)>forks(upgraded));
 assert.ok(forks(upgraded)>forks(focused));
});

test('real plasma shots attach a frozen damage profile to their visual trace',()=>{
 const g=game(),target=enemy(290);g.grid.insert(target);
 g.skillRanks.range=2;
 g.updateShipWeapons(.01);
 const trace=g.weaponFx[0];
 assert.equal(trace.kind,'plasma');
 assert.equal(trace.profile.range,440);
 assert.equal(trace.profile.rangeRank,2);
 assert.ok(trace.profile.distance>275);
 const actual=plasmaVisualStrength(trace,1);
 const expected=(target.maxHp-target.hp)/(18*(g.skillRanks.beam*.2+1));
 assert.ok(Math.abs(actual-expected)<1e-9,
  'the far-end light density must match the actual applied falloff');
});

test('a stationary close target suffers more plasma damage than a distant one',()=>{
 const fireAt=distance=>{
  const g=game(),target=enemy(distance);g.grid.insert(target);
  g.updateShipWeapons(.02);
  return {damage:target.maxHp-target.hp,trace:g.weaponFx[0]};
 };
 const near=fireAt(85),far=fireAt(285);
 assert.ok(near.damage>far.damage*2,'plasma must reward fighting close to the target');
 assert.ok(near.trace.profile.distance<115);
 assert.ok(far.trace.profile.distance>250);
 assert.ok(plasmaVisualStrength(near.trace,1)>plasmaVisualStrength(far.trace,1));
});

test('missed rail does not invent a hit sparkle, rocket launch does not draw to target',()=>{
 const miss={time:1},hit={time:1},rocket={time:1};
 emitWeaponFx(miss,'rail',A,B,{impact:false});
 emitWeaponFx(hit,'rail',A,B,{impact:true});
 emitWeaponFx(rocket,'rocket',A,B,{impact:true});
 const a=canvas(),b=canvas(),c=canvas();
 drawWeaponFx(a.c,miss.weaponFx);drawWeaponFx(b.c,hit.weaponFx);
 drawWeaponFx(c.c,rocket.weaponFx);
 assert.equal(a.arcs.length,0);assert.ok(b.arcs.length>0);
 assert.equal(rocket.weaponFx[0].impact,false);
 for(const stroke of c.strokes)for(const point of stroke.path)
  assert.ok(Math.hypot(point.x-A.x,point.y-A.y)<42,'rocket plume extends to a fictitious impact');
});

test('actual plasma, rail, flak fire records differentiated paths, without the old generic flashes',()=>{
 for(const kind of ['plasma','rail','flak']){
  const g=game();install(g,kind);const t=enemy(150,10);g.grid.insert(t);
  g.updateShipWeapons(.02);
  if(kind==='flak')updateFlakPellets(g,.2);
  assert.ok(t.hp<500,`${kind} did no damage`);
  assert.equal(g.weaponFx[0].kind,kind);
  assert.equal(g.flashes.length,0,'the old generic beam was double-rendered');
  assert.ok(g.weaponFx[0].x2<t.x,'the trace never extends beyond the target');
  if(kind==='flak')assert.equal(g.weaponFx[0].impact,false,'muzzle does not fake an instant hit');
 }
});

test('cover ends a shot on rock and an already killed target produces no second mount muzzle',()=>{
 const blocked=game(),t=enemy(220);
 blocked.grid.insert(t);
 blocked.rockGrid.insert({x:110,y:0,r:34,hp:1000,maxHp:1000,alive:true});
 blocked.damageRock=()=>{};
 blocked.updateShipWeapons(.02);
 const mark=blocked.weaponFx[0];
 assert.equal(mark.kind,'plasma');assert.equal(mark.blocked,true);
 assert.ok(mark.x2<190,'cover flash goes beyond the first rock');
 assert.ok(Math.abs(mark.profile.distance-
  Math.hypot(mark.x2-blocked.player.x,mark.y2-blocked.player.y))<1e-7,
  'a shot stopped by an asteroid must use the asteroid distance for damage and light');
 assert.equal(t.hp,500,'the visible cover cannot be bypassed');

 const multi=game(['rail','rail',null,null,null,null]);
 const fragile={...enemy(150),hp:10};multi.grid.insert(fragile);
 const muzzles=[];multi.heritage.vfx=new Proxy({},
  {get:(_,key)=>key==='muzzle'?(...args)=>muzzles.push(args):()=>{}});
 multi.updateShipWeapons(.02);
 assert.ok(fragile.hp<=0);
 assert.equal(multi.weaponFx.length,1,'second mount never fired');
 assert.equal(muzzles.length,1,'no flash should announce a nonexistent second shot');
});

test('second flak mount aims its muzzle at the surviving target, not the first dead one',()=>{
 const g=game(['flak','flak',null,null,null,null]);
 const a={...enemy(145,-75),hp:5},b=enemy(185,80);
 g.grid.insert(a);g.grid.insert(b);
 const muzzles=[];g.heritage.vfx=new Proxy({},
  {get:(_,key)=>key==='muzzle'?(...args)=>muzzles.push(args):()=>{}});
 g.updateShipWeapons(.02);
 updateFlakPellets(g,.2);
 assert.ok(a.hp<=0);assert.ok(b.hp<500);
 assert.equal(muzzles.length,2);
 const [x,y,angle]=muzzles[1];
 assert.ok(Math.abs(angle-Math.atan2(b.y-y,b.x-x))<.001,
  'second mount visually points to a destroyed target');
});

test('manual rail penetration shows its real second segment; a dead hull is no longer marked hit',()=>{
 const g=game(['rail',null,null,null,null,null]),t=enemy(220);
 g.manualRailMode=true;g.shipLoadout.specializations.rail={path:'penetrator',rank:1};
 g.grid.insert(t);g.rockGrid.insert({x:105,y:0,r:34,hp:500,maxHp:500,alive:true});
 g.damageRock=()=>{};
 const fired=fireAimedRail(g,{x:220,y:0});
 assert.equal(fired.ok,true);assert.equal(fired.hits,1);
 assert.equal(g.weaponFx.length,2);
 assert.ok(g.weaponFx[0].blocked);
 assert.equal(g.weaponFx[1].secondary,true);
 assert.ok(g.weaponFx[1].x<g.weaponFx[1].x2);
 assert.ok(g.weaponFx[1].x2<t.x,'secondary effect ends at the hull surface');

 const multi=game(['rail','rail',null,null,null,null]),fragile={...enemy(150),hp:2};
 multi.manualRailMode=true;multi.grid.insert(fragile);
 assert.equal(fireAimedRail(multi,{x:150,y:0}).ok,true);
 assert.equal(multi.weaponFx.length,2,'manual mode consumes both installed mounts');
 assert.equal(multi.weaponFx.filter(e=>e.impact).length,1,
  'the second mount invents a hull impact after the first killed the target');
});

test('real rocket, manual rail and heavy artillery display only an executed shot',()=>{
 const rocket=game();install(rocket,'rocket');rocket.grid.insert(enemy(180));
 rocket.updateShipWeapons(.03);
 assert.equal(rocket.missiles.length,1);
 assert.equal(rocket.weaponFx[0].kind,'rocket');
 assert.equal(rocket.weaponFx[0].impact,false);
 const rail=game();install(rail,'rail');rail.manualRailMode=true;
 const target=enemy(200,0);rail.grid.insert(target);
 const fired=fireAimedRail(rail,{x:200,y:0});
 assert.ok(fired.ok);assert.ok(fired.hits>0);
 assert.ok(rail.weaponFx.every(e=>e.kind==='rail'&&e.impact));
 const miss=game();install(miss,'rail');miss.manualRailMode=true;
 const empty=fireAimedRail(miss,{x:500,y:100});
 assert.ok(empty.ok);assert.equal(empty.hits,0);
 assert.ok(miss.weaponFx.every(e=>!e.impact));
 const heavy=game();heavy.weaponProfile.howitzer=1;
 heavy.heavyCharge={x:270,y:0,total:1.25,remaining:.01};
 updateHowitzer(heavy,.02);
 assert.equal(heavy.weaponFx[0].kind,'howitzer');
 assert.ok(heavy.weaponFx[0].x2<100,'the launch does not draw a fictitious hit 270 m away');
 assert.equal(heavy.weaponFx[0].impact,false);
 assert.equal(heavy.heavyShells.length,1);
});

test('real ion chain and real resonance transfer use their own signatures',()=>{
 const ion=game();ion.fieldLoan=createFieldLoan('ion',ion.docked.id,ion.time);
 ion.shipLoadout.slots[1]='ion';ion.syncShipLoadout();
 const a={...enemy(150),ionMarkUntil:100},b={...enemy(220),ionMarkUntil:100};
 ion.grid.insert(a);ion.grid.insert(b);
 assert.equal(ion.callIonDischarge(),true);
 assert.equal(ion.weaponFx.length,2);
 assert.ok(ion.weaponFx.every(e=>e.kind==='ion'));
 assert.ok(ion.weaponFx[0].x2<a.x,'first ion leg must end on the hull surface');
 const resonator=game();resonator.fieldLoan=createFieldLoan('resonator',resonator.docked.id,resonator.time);
 resonator.shipLoadout.slots[1]='resonator';resonator.syncShipLoadout();
 const c=enemy(150),d=enemy(220);resonator.grid.insert(c);resonator.grid.insert(d);
 assert.ok(resonator.callFieldWeapon());
 assert.equal(resonator.weaponFx?.length||0,0,'creating a passive link is not a hit');
 damageTarget(resonator,{kind:'enemy',target:c},10,'rail');
 assert.ok(resonator.weaponFx.some(e=>e.kind==='resonator'));
 assert.ok(resonator.weaponFx.every(e=>e.x2<d.x),
  'resonance transfer must end at the contact surface, not the target centre');
});

test('seven separate verified catalog events drive the existing mixer',()=>{
 const h=new ArcadeHeritage(),events=[];
 const manifest=JSON.parse(readFileSync(new URL('../../audio-lab/assets/sfx/kenney/manifest.json',import.meta.url),'utf8'));
 h.soundOn=true;h.audio={playEvent:key=>events.push(key)};
 h.vfx.clock=10;
 for(const kind of ['plasmaShot','railShot','flakShot','rocketShot','ionShot','resonatorShot','howitzerShot'])
  assert.equal(h.play(kind,.01,{x:0,y:0}),true);
 assert.deepEqual(events,[
  'starter_soft','railgun','retro_blaster','knife','lightning','magic_wand','explosion_big'
 ]);
 for(const key of events){
  const def=SOUND_CATALOG[key];
  assert.ok(def,`missing mixer entry for ${key}`);
  assert.ok(def.sampleUrls?.length||def.sampleUrl,`no actual recording for ${key}`);
  const file=def.sampleUrls?.[0]||def.sampleUrl;
  if(file.includes('/kenney/')){
   // Production downloads these CC0 binaries from a pinned mirror and checks
   // their SHA before Pages deployment. They are absent from Git by design.
   const source=manifest.files.find(item=>item.file===file.split('/').at(-1));
   assert.ok(source?.size>0&&/^[a-f0-9]{40}$/.test(source.blobSha),
    `recording lacks a pinned, verified source: ${key}`);
  }else assert.ok(existsSync(new URL(file,new URL('../../audio-lab/',import.meta.url))),
   `recording missing from repository: ${key}`);
 }
});

test('production muzzle palette matches rail, flak, rocket and plasma silhouettes',()=>{
 const vfx=new ArcadeHeritage().vfx,emitted=[];
 vfx._emit=(kind,x,y,options)=>emitted.push({kind,...options});
 vfx._scatter=()=>{};vfx._flash=()=>{};
 for(const kind of ['railgun','flak','knife','starter_pulse'])vfx.muzzle(0,0,0,kind);
 assert.deepEqual(emitted.filter(e=>e.kind==='muzzle').map(e=>e.tint),
  ['blue','orange','orange','cyan']);
});

test('visual laboratory is discoverable and uses production effects, not its own drawn beams',()=>{
 const html=readFileSync(new URL('../studio/weapon-fx-lab.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../studio/weapon-fx-lab.js',import.meta.url),'utf8');
 const hub=readFileSync(new URL('../studio/index.html',import.meta.url),'utf8');
 assert.match(hub,/href="\.\/weapon-fx-lab\.html"/);
 for(const key of ['battle','families','fps','motion','sound','sequence','plasmaRank','plasmaSpec','plasmaSummary'])
  assert.match(html,new RegExp('id="'+key+'"'));
 assert.match(js,/import \{emitWeaponFx,updateWeaponFx,drawWeaponFx\} from '\.\.\/weapon-fx\.js\?v=plasma-taper-1'/);
 assert.match(js,/plasmaFarRetention/);
 assert.match(js,/import \{drawSeekingMissile\} from '\.\.\/combat-feedback\.js'/);
 assert.match(js,/import \{launchFlakVolley,updateFlakPellets,launchHeavyShell,updateHeavyShells,drawBallisticWeapons\} from '\.\.\/ballistic-weapons\.js'/);
 assert.match(js,/import \{drawFieldEffects\} from '\.\.\/field-weapons\.js'/);
 assert.match(js,/import \{WorldVFX\} from '\.\.\/\.\.\/src\/world-vfx\.js'/);
 for(const id of WEAPON_FX_KINDS)assert.match(js,new RegExp("id:'"+id+"'"));
});
