/**
 * Visual-content release guard for the prologue and missions 01–04.
 * Syntax/logic checks cannot replace screenshots or GPU frame timings.
 * Run: node --test site/games/survivor/tests/scene-art-direction.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=path=>readFileSync(resolve(root,path),'utf8');
const layoutSource=source('src/mission-layouts.js');
const main=source('src/main.js');
const prologue=source('src/prologue-mission.js');
const world=source('src/mission-world.js');
const scenery=source('src/mission-scenery.js');
const index=source('index.html');
const sw=source('service-worker.js');
const layouts=new Function(layoutSource.replace(/\bexport (?=(function|const)\b)/g,'')+
    '\nreturn {getMissionScene,makeMissionAsteroids};')();

test('prologue and authored missions can send real setpieces to 3D',()=>{
    assert.match(main,/scenery:this\.missionWorld\?\.get3DProps\?\.\(/);
    assert.doesNotMatch(main,/scenery:this\.missionWorld\?\.index===0\?\[\]:/);
    assert.match(prologue,/PROLOGUE_SCENERY_DESKTOP/);
    assert.match(prologue,/PROLOGUE_SCENERY_MOBILE/);
    assert.match(prologue,/return this\.scenery\.filter\(item=>allowed\.has\(item\.id\)\)/);
    assert.match(world,/get3DProps\(profile='desktop'\)/);
});
test('the visual district map is authored, varied and does not block objectives',()=>{
    const scene=layouts.getMissionScene(1);
    assert.ok(scene.landmarks.length>=5);
    assert.ok(new Set(scene.landmarks.map(x=>x.kind)).size>=4);
    assert.ok(scene.scenery3d.length>=10);
    assert.ok(scene.scenery3d.filter(x=>x.mobile).length<=6);
    const interactables=[...scene.stations,...scene.props.filter(x=>x.type!=='cache')];
    for(const p of scene.scenery3d){
        assert.ok(p.span<=245);
        assert.ok(Number.isFinite(p.dx)&&Number.isFinite(p.dy));
        assert.ok(interactables.every(v=>Math.hypot(p.dx-v.dx,p.dy-v.dy)>200),
            '3D environment model too close to a mandatory interaction: '+p.id);
        assert.ok(existsSync(resolve(root,'assets/3d/'+p.model+'.glb')),
            'missing locally bundled GLB: '+p.model);
    }
});
test('beacons visibly power on nearby hardware, with lower mobile cost',()=>{
    const compiled=world.replace(/^import[\s\S]*?from\s*['"][^'"]+['"];?\s*$/gm,'')
        .replace(/\bexport (?=(class|function|const)\b)/g,'');
    const World=new Function('getMissionScene',compiled+'\nreturn MissionWorld;')(layouts.getMissionScene);
    const instance=new World({player:{x:0,y:0}},1);
    const desktop=instance.get3DProps('desktop');
    const mobile=instance.get3DProps('mobile');
    assert.equal(desktop.length,layouts.getMissionScene(1).scenery3d.length);
    assert.ok(mobile.length<desktop.length);
    assert.ok(desktop.every(x=>!x.powered));
    instance.first.beacons=2;
    assert.ok(instance.get3DProps('desktop').some(x=>x.powered));
    assert.ok(instance.get3DProps('desktop').some(x=>!x.powered));
});
test('three later missions have contrasting readable districts and light budgets',()=>{
    const expected={2:4,3:4,4:4};
    for(const [raw,n] of Object.entries(expected)){
        const index=Number(raw),scene=layouts.getMissionScene(index);
        assert.ok(scene.landmarks.length>=5,'missing large landmarks in '+index);
        assert.ok(new Set(scene.landmarks.map(p=>p.kind)).size>=n,
            'repeating landmark silhouettes in '+index);
        assert.ok(scene.scenery3d.length>=9,'too few models in '+index);
        assert.ok(scene.scenery3d.filter(p=>p.mobile).length<=5,
            'mobile asset budget exceeded in '+index);
        const mandatory=[...scene.stations,...scene.props.filter(p=>p.type!=='cache'),
            ...(scene.enemySites||[])];
        for(const prop of scene.scenery3d){
            assert.ok(prop.span<=270);
            assert.ok(mandatory.every(v=>Math.hypot(prop.dx-v.dx,prop.dy-v.dy)>245),
                'model blocks an objective: '+prop.id);
            assert.ok(existsSync(resolve(root,'assets/3d/'+prop.model+'.glb')),
                'missing real model: '+prop.model);
        }
    }
});
test('escort models are offset from the entire convoy trajectory',()=>{
    const scene=layouts.getMissionScene(4);
    const points=[[scene.convoyStart.dx,scene.convoyStart.dy],
        ...scene.route.map(p=>[p.dx,p.dy])];
    for(const p of scene.scenery3d){
        const closest=Math.min(...points.slice(1).map((end,i)=>{
            const start=points[i],dx=end[0]-start[0],dy=end[1]-start[1];
            const projection=Math.max(0,Math.min(1,
                ((p.dx-start[0])*dx+(p.dy-start[1])*dy)/(dx*dx+dy*dy)));
            return Math.hypot(p.dx-start[0]-projection*dx,
                p.dy-start[1]-projection*dy);
        }));
        assert.ok(closest>420,'convoy silhouette is occluded by '+p.id);
    }
});
test('sector progress visibly powers up mission hardware',()=>{
    const compiled=world.replace(/^import[\s\S]*?from\s*['"][^'"]+['"];?\s*$/gm,'')
        .replace(/\bexport (?=(class|function|const)\b)/g,'');
    const World=new Function('getMissionScene',compiled+'\nreturn MissionWorld;')(
        layouts.getMissionScene);
    const make=index=>new World({player:{x:0,y:0}},index);
    const q=make(2);
    assert.ok(q.get3DProps().every(p=>!p.powered));
    q.quarry.started=true;
    assert.ok(q.get3DProps().some(p=>p.powered));
    q.quarry.completed=true;
    assert.ok(q.get3DProps().filter(p=>p.powered).length>=4);
    const n=make(3);n.network.decoyCleared=true;
    assert.ok(n.get3DProps().some(p=>p.powered));
    n.jammerOffline=true;n.defenses=2;
    assert.ok(n.get3DProps().filter(p=>p.powered).length>=4);
    const c=make(4);c.convoy.leg=2;c.exitOnline=true;
    assert.ok(c.get3DProps().filter(p=>p.powered).length>=5);
});
test('large decorations cannot cover the ship in 3D and backgrounds vary per mission',()=>{
    const hybrid=source('src/hybrid-3d.js');
    const atmosphere=source('src/space-art.js');
    assert.match(hybrid,/Math\.hypot\(src\.x-player\.x,src\.y-player\.y\)/);
    assert.match(hybrid,/this\.syncScenery\(scenery,centerX,centerY,logicalWidth,logicalHeight,time,player\)/);
    assert.match(atmosphere,/MISSION_PALETTES/);
    for(let i=0;i<=4;i++)assert.match(atmosphere,
        new RegExp('\\b'+i+': \\{base:'));
    assert.match(main,/this\.missionWorld\?\.index\?\?null/);
    assert.match(scenery,/drawRegionLandmark\(ctx,game,world,mark,time\)/);
    assert.match(scenery,/drawSectorPlatform\(ctx,p,time,scene\.tint,world\.index\)/);
});
test('salvage and locked gates have accurate visual states',()=>{
    assert.match(scenery,/p\.type==='cache'\?false:!p\.used/);
    assert.match(scenery,/p\.used\?'СОБРАНО':'СОБРАТЬ ДЕТАЛИ'/);
    assert.match(scenery,/!game\.friendlyBases\.bases\.slice\(1\)\.every\(b=>b\.activated&&b\.hp>0\)/);
    assert.match(scenery,/drawFirstMissionLandmark\(ctx,game,world,mark,time\)/);
});
test('new artistic modules have a fresh offline-cache boundary',()=>{
    for(const file of ['main','mission-world','mission-layouts','mission-scenery',
        'space-art','hybrid-3d'])
        assert.match(sw,new RegExp(file+'\\.js\\?v=art-direction-987'));
    assert.match(sw,/prologue-mission\.js\?v=art-direction-986/);
    assert.match(index,/main\.js\?v=routes-102/);
});
