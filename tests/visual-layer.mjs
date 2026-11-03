import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL('../'+file, import.meta.url),'utf8');
const rock = read('src/world-obstacles.js');
const scenery = read('src/mission-scenery.js');
const space = read('src/space-art.js');
const main = read('src/main.js');
const sw = read('service-worker.js');
for(const file of ['src/world-obstacles.js','src/mission-scenery.js',
    'src/space-art.js','src/mission-world.js','src/main.js']) {
    const js=read(file)
        .replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'')
        .replace(/^\s*export\s+(?=(?:async |default |class|function|const|let|var))/gm,'')
        .replaceAll('import.meta.url',"'http://example.invalid/game.js'");
    assert.doesNotThrow(()=>new Function(js),file+' syntax');
}
const start=rock.indexOf('const ROCK_FRAMES = 30;');
const end=rock.indexOf('const NEARBY = Object.freeze');
assert.ok(start>=0&&end>start);
const create=new Function('texturedRocks','drawStationPart',
    rock.slice(start,end)+'\nreturn drawRock;');
const stone={naturalWidth:510},ore={naturalWidth:510},fallback={naturalWidth:64};
const calls=[],ctx={drawImage:(...args)=>calls.push(args)};
const drawRock=create({stone,ore},()=>false);
for(let i=0;i<30;i++)drawRock(ctx,{x:0,y:0},fallback,72,i/10);
assert.equal(new Set(calls.map(c=>c[1]+':'+c[2])).size,30);
assert.ok(calls.every(c=>c[3]===85&&c[4]===100&&c[1]<510&&c[2]<500));
calls.length=0;
drawRock(ctx,{x:1,y:1,missionSeal:true},fallback,72,0);
assert.equal(calls[0][0],ore);
const fallbackRock=create({stone:null,ore:null},()=>false);
calls.length=0;
fallbackRock(ctx,{x:0,y:0},fallback,72,0);
assert.equal(calls[0][0],fallback);
assert.ok(scenery.includes('ctx.globalAlpha=.13'));
assert.ok(!scenery.includes("Math.sin(time*1.6+d)>.1?'#4eeffb'"));
assert.ok(space.includes("veil.addColorStop(.45,p.base+'68')"));
assert.ok(main.includes('drawEnemyThrusters(ctx,e,this.gameTime)'));
for(const name of ['asteroid-realistic.webp','asteroid-ore.webp'])
    assert.ok(sw.includes(name),name+' offline cache');
console.log('Survivor visual 9.4: syntax, atlas 30 frames, fallbacks and layers OK');
