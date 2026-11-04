import test from 'node:test';
import assert from 'node:assert/strict';
import {ArcadeVisuals,enemySkin,allySkin,sectorAt,sectorName,COMPACT_ESCORT_SPECS} from '../visuals.js';

test('all six enemy roles keep multiple deterministic animated hull identities',()=>{
 for(const role of ['scout','fighter','flanker','healer','berserker','gunship']){
  const values=Array.from({length:40},(_,i)=>enemySkin(role,i+1));
  assert.ok(new Set(values).size>=(role==='scout'||role==='fighter'||role==='flanker'?4:2),role);
  assert.deepEqual(values,Array.from({length:40},(_,i)=>enemySkin(role,i+1)));
 }
});
test('allied roles also preserve variation without touching combat RNG',()=>{
 for(const role of ['scout','fighter','bomber']){
  const values=Array.from({length:24},(_,i)=>allySkin(role,i+1));
  assert.ok(new Set(values).size>=2,role);
 }
});
test('world positions reach five named colour sectors, including negative coordinates',()=>{
 const ids=new Set();
 for(let x=-55000;x<=55000;x+=9000)for(let y=-50000;y<=50000;y+=12000){
  const n=sectorAt(x,y);
  assert.ok(Number.isInteger(n)&&n>=0&&n<5);
  assert.ok(sectorName(n).length>6);
  ids.add(n);
 }
 assert.equal(ids.size,5);
});
test('station art renders a complete fallback shape even without downloaded sprites',()=>{
 const originalDocument=globalThis.document;
 const sky=()=>({style:{setProperty(){}},classList:{add(){},remove(){}}});
 const elements={sky0:sky(),sky1:sky(),sector:{textContent:''}};
 globalThis.document={getElementById:id=>elements[id]};
 try{
  const visuals=new ArcadeVisuals(),ops={polygons:0};
  const ctx=new Proxy({},{
   get(target,name){
    if(name==='fill')return ()=>{ops.polygons++;};
    return name in target?target[name]:()=>{};
   },set(target,key,value){target[key]=value;return true;}
  });
  for(const type of ['dock','arsenal','carrier','lab']){
   visuals.drawBase(ctx,{x:100,y:100,type,active:false,captured:false,
    enemy:false,hp:120,maxHp:120,turrets:[]},0,0,0);
  }
  assert.ok(ops.polygons>=8);
 }finally{globalThis.document=originalDocument;}
});

test('over-masked asteroid atlas falls back to visible cached rocks',()=>{
 const originalDocument=globalThis.document;
 let baked=0,painted=0;
 const sky=()=>({style:{setProperty(){}},classList:{add(){},remove(){}}});
 const screen={save(){},restore(){},translate(){},rotate(){},drawImage(){painted++;}};
 globalThis.document={
  getElementById:id=>id==='sector'?{textContent:''}:sky(),
  createElement:()=>{
   const tile={width:0,height:0,getContext:()=>({
    drawImage(){},
    beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},
    save(){},restore(){},clip(){},ellipse(){},stroke(){},
    createRadialGradient(){return {addColorStop(){}};},
    getImageData(x,y,w,h){
     const p=new Uint8ClampedArray(w*h*4);
     for(let i=0;i<p.length;i+=4){p[i]=230;p[i+1]=230;p[i+2]=230;p[i+3]=255;}
     const center=((h>>1)*w+(w>>1))*4;
     p[center]=70;p[center+1]=65;p[center+2]=58;
     return {data:p};
    },
    putImageData(image){baked++;assert.equal(image.data[3],0);
      const center=((100>>1)*85+(85>>1))*4;
      assert.equal(image.data[center+3],255);}
   })};return tile;
  }
 };
 try{
  const view=new ArcadeVisuals();
  const originalAtlas={complete:true,naturalWidth:510,naturalHeight:500};
  assert.equal(view.drawRock(screen,{x:5,y:7,r:35},originalAtlas,true),true);
  assert.equal(baked,0); // Blank frames must never be accepted as sprites.
  assert.ok(view.rockAtlases.ore.every(frame=>frame===null));
  assert.equal(view.drawRock(screen,{x:16,y:-9,r:42},originalAtlas,true),true);
  assert.equal(baked,0);assert.equal(painted,2);
 }finally{globalThis.document=originalDocument;}
});

test('escort drones have consistent compact world-space silhouettes and preserve bomber scale',()=>{
 const guardian=COMPACT_ESCORT_SPECS.scout,blade=COMPACT_ESCORT_SPECS.fighter;
 assert.deepEqual([guardian.width,guardian.height],[24,22]);
 assert.deepEqual([blade.width,blade.height],[28,24]);
 assert.ok(guardian.width<39&&blade.width<39);
 assert.notEqual(guardian.asset,blade.asset);
 const previous=globalThis.document;
 const sky=()=>({style:{setProperty(){}},classList:{add(){},remove(){}}});
 globalThis.document={getElementById:id=>id==='sector'?{textContent:''}:sky()};
 try{
  const visuals=new ArcadeVisuals(),draws=[];
  // A loaded tile is rendered exactly once per escort at its canonical size.
  visuals.compactEscortSprites.scout={width:96,height:88};
  visuals.compactEscortSprites.fighter={width:112,height:96};
  const ctx=new Proxy({},{
   get(target,key){
    if(key==='drawImage')return (...args)=>draws.push(args);
    return key in target?target[key]:()=>{};
   },
   set(target,key,value){target[key]=value;return true;}
  });
  for(const role of ['scout','fighter']){
   assert.equal(visuals.drawAlly(ctx,{role,x:20,y:30,r:role==='scout'?13:15,
    angle:0,vx:60,vy:0,serial:5,hit:0},2,null),true);
  }
  assert.deepEqual(draws.map(args=>args.slice(1)),[
   [-12,-11,24,22],[-14,-12,28,24]
  ]);
  // These scouts can still be drawn before their images finish loading.
  delete visuals.compactEscortSprites.scout;
  assert.equal(visuals.drawAlly(ctx,{role:'scout',x:0,y:0,r:13,angle:0,hit:0},0,null),true);
  // The separately summoned bomber remains on its original rendering path.
  assert.equal(visuals.drawAlly(ctx,{role:'bomber',x:0,y:0,r:22,angle:0,hit:0},0,null),true);
  assert.equal(draws.length,2);
 }finally{globalThis.document=previous;}
});

test('cruiser landmark paints a stable salvage field only near the camera',()=>{
 const prior=globalThis.document;
 const sky=()=>({style:{setProperty(){}},classList:{add(){},remove(){}}});
 globalThis.document={getElementById:id=>id==='sector'?{textContent:''}:sky()};
 try{
  const visuals=new ArcadeVisuals(),counts={plates:0,images:0};
  visuals.derelictImage={naturalWidth:512};
  const ctx=new Proxy({},{
   get(target,name){
    if(name==='fill')return ()=>{counts.plates++;};
    if(name==='drawImage')return ()=>{counts.images++;};
    return name in target?target[name]:()=>{};
   },set(target,name,value){target[name]=value;return true;}
  });
  visuals.drawDerelict(ctx,{x:0,y:0,w:400,h:300},0,60);
  assert.deepEqual(counts,{plates:0,images:0});
  const cam={x:-40200,y:6750,w:400,h:350};
  visuals.drawDerelict(ctx,cam,0,60);
  assert.equal(counts.plates,13); // Twelve plates plus the transponder light.
  assert.equal(counts.images,1);
 }finally{globalThis.document=prior;}
});
