/**
 * A slow GPU/software Canvas2D must reduce only decorative work.
 * Run: node --test site/games/survivor/tests/adaptive-ambient.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
const bare=src=>src.replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;\s*/gm,'')
    .replace(/^\s*export\s+/gm,'');

const {RenderBudget}=new Function(bare(read('render-budget.js'))+';return {RenderBudget};')();
const {SpaceArt}=new Function('atlas',bare(read('space-art.js'))+
    ';return {SpaceArt};')({nebula:null});
function fakeCanvas(){
    const counts={stars:0,clouds:0,motes:0}, ctx={
        save(){},restore(){},translate(){},drawImage(){},beginPath(){},
        arc(){counts.stars++},fill(){},stroke(){},moveTo(){},lineTo(){},
        ellipse(){},fillRect(){counts.motes++},
        createRadialGradient(){counts.clouds++;return {addColorStop(){}}}
    };
    return {counts,ctx};
}

test('severe early stalls promote quality within the first dozen frames',()=>{
    const budget=new RenderBudget({mode:'2d'});
    for(let i=0;i<11;i++)budget.sample(180,90);
    assert.ok(budget.level>=1,'early sustained 2fps must trigger adaptation');
    const initial=budget.level;
    for(let i=0;i<50;i++)budget.sample(180,90);
    assert.ok(budget.level>initial,'the severe-path cooldown must allow recovery');
    assert.ok(budget.plan(0).vfxScale<1);
});

test('distant star sprites and nebular haze scale down without changing physics',()=>{
    const art=new SpaceArt();
    const key='forest||640|480|0';
    art._backdrop={key,layer:{}};
    const full=fakeCanvas(),low=fakeCanvas();
    art.draw(full.ctx,'forest',0,0,640,480,null,1);
    art.draw(low.ctx,'forest',0,0,640,480,null,.35);
    assert.equal(full.counts.stars,170);
    assert.ok(low.counts.stars<=58);
    const atmosphereFull=fakeCanvas(),atmosphereLow=fakeCanvas();
    art.drawAtmosphere(atmosphereFull.ctx,'forest',0,0,640,480,2,null,1);
    art.drawAtmosphere(atmosphereLow.ctx,'forest',0,0,640,480,2,null,.35);
    assert.equal(atmosphereFull.counts.clouds,7);
    assert.equal(atmosphereLow.counts.clouds,2);
    assert.equal(atmosphereFull.counts.motes,20);
    assert.equal(atmosphereLow.counts.motes,6);
});

test('low quality removes decorative rock blur, leaving its sprite unchanged',()=>{
    const src=read('world-obstacles.js');
    const part=src.slice(src.indexOf('function sprite('),
        src.indexOf('export function renderWorldObstacles('));
    const blurs=[];
    const sprite=new Function('drawRock','getFXSprite',part+';return sprite;')(
        (ctx)=>blurs.push(ctx.shadowBlur),()=>null);
    const ctx={save(){},restore(){},translate(){},rotate(){},
        fillRect(){},drawImage(){}};
    const rock={x:10,y:10,scale:1,hp:100,maxHp:100};
    sprite(ctx,rock,null,0,null,1);
    sprite(ctx,rock,null,0,null,.35);
    assert.deepEqual(blurs,[7,0]);
});
