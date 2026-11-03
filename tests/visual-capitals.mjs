import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const strip=source=>source
    .replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'')
    .replace(/^\s*export\s+(?=(?:async |default |class|function|const|let|var))/gm,'')
    .replaceAll('import.meta.url',"'http://game.invalid/src/module.js'");
for(const path of ['src/main.js','src/entities.js','src/sprite-art.js',
    'src/boss-visuals.js','src/station-mechanics.js','src/world-vfx.js',
    'src/world-obstacles.js','src/mission-world.js','src/friendly-bases.js'])
    assert.doesNotThrow(()=>new Function(strip(read(path))),path+' syntax');
// The project-original boss hull must win over the old optional Kenney art.
let createdBossImages=0;
class FakeImage {
    constructor(){createdBossImages++;this.naturalWidth=512;this.naturalHeight=768;}
    set src(v){this._src=v;this.onload?.();}
    get src(){return this._src;}
}
class FakeURL {constructor(src){this.href=src;}}
let drawn=null;
const context={translate(){},scale(){},drawImage(im){drawn=im;},
    beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},
    stroke(){},fillRect(){},strokeRect(){}};
const getSprite=new Function('Image','document','atlas','onAtlasChange',
    'URL',strip(read('src/sprite-art.js'))+'\nreturn getEnemySprite;')(
    FakeImage,{createElement:()=>({width:0,height:0,getContext:()=>context})},
    {bossDreadnought:{naturalWidth:128,naturalHeight:128}},()=>{},FakeURL);
assert.equal(createdBossImages,0,'boss art is not fetched at game startup');
getSprite({id:'void_lord',boss:true},48);
assert.equal(createdBossImages,1,'only the needed boss art is requested');
assert.ok(drawn?.src?.includes('boss-capital-dreadnought.webp?v=fleet-104'));
getSprite({id:'void_lord',boss:true},48);
assert.equal(createdBossImages,1,'same boss uses the cached image');
// Modular turrets track player, but never alter the game state.
let gunCount=0;
const bossRig=new Function('drawStationPart','STATION_PARTS',
    'drawTurretMount','drawTurretHead','getFXSprite',
    strip(read('src/boss-visuals.js'))+'\nreturn drawBossDetails;')(
    ()=>true,{turretIdle:18},()=>{},()=>{gunCount++;},()=>null);
const ctx={save(){},restore(){},translate(){},rotate(){},scale(){},
    beginPath(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){},
    drawImage(){},setLineDash(){}};
for(const [id,n] of [['void_lord',4],['carrier',2],['hunter',2]]){
    const start=gunCount;
    bossRig(ctx,{boss:true,hp:10,maxHp:100,size:45,x:0,y:0,
        type:{id}},1,{x:100,y:100},false);
    assert.equal(gunCount-start,n,id+' gun mounts');
}
// Expired boss wreckage vanishes; at most three groups are active.
const VFX=new Function('getFXSprite','FX_COLORS','getFXLoadStatus',
    'getExplosionFrame','getCombatArtStatus','drawStationPart','STATION_PARTS',
    strip(read('src/world-vfx.js'))+'\nreturn WorldVFX;')(
    ()=>null,{cyan:'#fff',red:'#f00',smoke:'#999',orange:'#f60'},
    ()=>({}),()=>null,()=>({}),()=>false,
    {wing:10,bridge:8,large:2,cross:9});
const world=new VFX({reducedMotion:true});
for(let i=0;i<5;i++)world.shipExplosion(i,0,40,'#ff6a77',true);
assert.equal(world.bossWrecks.length,3);
world.update(9);
assert.equal(world.bossWrecks.length,0);
const sw=read('service-worker.js');
for(const key of ['asteroid-realistic.png?v=png-952','asteroid-ore.png?v=png-952'])
    assert.ok(sw.includes(key),key+' in offline cache');
assert.ok(!sw.includes('boss-capital-dreadnought.png'),
    'large PNG boss art should not be eagerly prefetched');
const mechanisms=read('src/station-mechanics.js');
assert.ok(mechanisms.includes("base.hangarTier||0"));
assert.ok(mechanisms.includes("base.development||{}"));
console.log('Survivor visual 9.5.2: boss hulls, guns, bases and wreckage OK');
