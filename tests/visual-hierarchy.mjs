import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const strip=s=>s.replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'')
    .replace(/^(\s*)export\s+/gm,'$1')
    .replaceAll('import.meta.url',"'https://game.invalid/src/module.js'");
const rock=read('src/world-obstacles.js');
const scenery=read('src/mission-scenery.js');
const main=read('src/main.js');
const mission=read('src/mission-world.js');
const css=read('styles.css');
const html=read('index.html');
const sw=read('service-worker.js');

for(const [name,src] of [['rocks',rock],['scenery',scenery],
    ['main',main],['mission',mission]])
    assert.doesNotThrow(()=>new Function(strip(src)),name+' syntax');

// Rendering the original 30-frame atlas must remain the only frame source.
// Its color grade is computed once on Image.onload, with alpha preserved.
assert.match(rock,/texturedRocks\[kind\] = gradeRockAtlas\(img,kind\)/);
assert.match(rock,/sheet\?\.naturalWidth \|\| sheet\?\.width/);
assert.doesNotMatch(rock.slice(rock.indexOf('function sprite(')),/ctx\.filter/);
const filters=[];
const painter={
    _filter:'none',
    set filter(v){this._filter=v;filters.push(v);},
    get filter(){return this._filter;},
    drawImage(){},
};
const fakeDoc={createElement(tag){
    assert.equal(tag,'canvas');
    return {width:0,height:0,getContext(){return painter;}};
}};
const grade=new Function('document',strip(rock)+'\nreturn gradeRockAtlas;')(fakeDoc);
for(const kind of ['stone','ore']) {
    const graded=grade({naturalWidth:510,naturalHeight:500},kind);
    assert.equal(graded.width,510);
    assert.equal(graded.height,500);
}
assert.deepEqual(filters,[
    'brightness(.72) contrast(1.13) saturate(.68)','none',
    'brightness(.79) contrast(1.08) saturate(.82)','none'
]);

// Background outlines are continuous haze, not the old massive rectangular dashes.
assert.doesNotMatch(scenery,/setLineDash\(\[110,90\]\)/);
assert.match(scenery,/ctx\.strokeStyle='#418dc219';ctx\.lineWidth=112/);
// The cinematic scene never adds collision geometry.
assert.doesNotMatch(scenery,/worldObstacles\.push\(/);

// 9.6.0 keeps the 9.5.3 visuals while giving all mobile entrypoints new URLs.
for(const s of [main,mission])assert.match(s,/polish-953/);
for(const s of [main,html,sw])assert.match(s,/mobile-960/);
assert.match(html,/Космический выпуск 9\.6\.0/);
assert.match(sw,/vesnin-survivor-ru-mobile-960/);
// The goal indicator must appear below the back button on all viewports.
assert.match(css,/\.base-bearing\{position:absolute;left:50%;top:56px;/);
assert.match(css,/\.base-bearing\{top:57px;max-width:90%/);
assert.match(css,/top:125px;max-width:92%;width:92%/);

console.log('Visual hierarchy 9.5.3: syntax, atlas grade, background, HUD, cache OK');
