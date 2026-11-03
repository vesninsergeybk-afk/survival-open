// Run: node site/games/survivor/tests/stellar-window-art.test.cjs
// Mission 00 art regression: 3D window, same campaign entry, honest fallback.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const star=read('src/stellar-window-3d.js');
const hybrid=read('src/hybrid-3d.js');
const mission=read('src/prologue-mission.js');
const main=read('src/main.js');
const html=read('index.html');
const doc=read('docs/PROLOGUE-ART-V2.md');

assert.match(star,/sdo-sun-304\.webp/, 'Real NASA surface asset');
assert.match(star,/uSolar[\s\S]*uNebula/, 'SDO disk and actual nebula asset');
assert.match(star,/vec3 n=vec3/, 'Ray-mapped 3D photosphere');
assert.match(star,/coronaMotion/, 'Turbulent corona');
assert.match(star,/prominenceDistance/, 'Animated solar prominences');
assert.match(star,/frameBar\(17,h\+7/, '3D structural mullions');
assert.match(star,/new THREE\.PointLight/, 'Actual local 3D light');
assert.match(star,/spec\.powered/, 'Window trim responds to station power');
assert.match(star,/rig\.revealAt=time/, 'First-view star reveal');
assert.match(star,/if\(!visible\)continue/, 'Offscreen animation culling');
assert.match(hybrid,/import \{ StellarWindows3D \}/);
assert.match(hybrid,/this\.stellarWindows\?\.update/);
assert.match(hybrid,/src\.powered/, '3D equipment reacts to repaired power');
assert.match(mission,/getSolarWindows\(\)/);
assert.match(mission,/id:'helios'/);
assert.match(mission,/id:'command'/);
assert.match(mission,/_roomArchitecture/);
assert.match(mission,/_sectorAtmosphere/);
assert.match(mission,/solarDisk[\s\S]*drawImage\(solarDisk/, 'Canvas fallback remains');
assert.match(mission,/Solar shafts project/, 'Long, beam-shaped light and shadows');
assert.match(main,/stellarWindows:this\.missionWorld\?\.getSolarWindows/);
assert.match(main,/new PrologueMissionWorld\(this\)/);
assert.equal((html.match(/href="\.\/\?mission=0"/g)||[]).length,2,
    'Both start-prologue buttons enter the unified Mission 00');
assert.doesNotMatch(html,/href="\.\/prologue\/"/,
    'Old standalone demo no longer linked from campaign');
assert.match(doc,/Artistic pass 3/);
for(const [name,src] of [['3D solar shader module',star],
    ['3D shared renderer',hybrid],['Mission 00',mission],['Game runtime',main]]){
    const script=src
        .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];[ \t]*$/gm,'')
        .replace(/^\s*export (class|function|const|let|var) /gm,'$1 ')
        .replace(/^\s*export \{[^\n]+\};?\s*$/gm,'')
        .replaceAll('import.meta.url','"https://example.invalid/"');
    assert.doesNotThrow(()=>new Function(script),name+' should parse');
}
console.log('Mission 00 cinematic solar windows, game links, fallback, renderer syntax OK');
