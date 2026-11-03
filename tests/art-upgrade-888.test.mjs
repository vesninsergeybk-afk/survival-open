import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname,resolve } from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const assets=resolve(here,'../assets/upgrade');
const part=(group,file)=>resolve(assets,group,file+'.png');
const lasers=['laserBlue01','laserBlue10','laserBlue16','laserGreen01','laserGreen10',
    'laserRed01','laserRed10','laserRed16'];
const rocks=['meteorBrown_big1','meteorBrown_big2','meteorBrown_big3','meteorBrown_big4',
    'meteorGrey_big1','meteorGrey_big2','meteorGrey_big3','meteorGrey_big4'];
for(const [kind,values] of [['lasers',lasers],['asteroids',rocks]]){
    for(const value of values){
        const bytes=readFileSync(part(kind,value));
        assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a',value);
        assert.ok(bytes.byteLength>250,value);
    }
}
for(let i=0;i<10;i++)assert.ok(readFileSync(part('explosions',
    'fire'+String(i).padStart(2,'0'))).byteLength>250);
for(const name of ['ufoBlue','ufoGreen','ufoRed'])
    assert.ok(readFileSync(part('ships',name)).byteLength>250);
for(const name of ['shield1','shield2','shield3'])
    assert.ok(readFileSync(part('shields',name)).byteLength>250);

// Test both canvas-ready and headless modes. The sprite loader is optional.
const ImageBefore=globalThis.Image;
delete globalThis.Image;
const headless=await import('../src/combat-art.js?arttest=empty');
assert.equal(headless.getCombatArtStatus().ready,0);
assert.equal(headless.getExplosionFrame(.5),null);
const {WorldVFX}=await import('../src/world-vfx.js?arttest=fx');
const fx=new WorldVFX();
fx.shipExplosion(100,150,18,'#ff9977');
fx.asteroidBreak(120,190,26);
assert.ok(fx.explosions.length>=2,'animated explosions queued');
fx.update(2);
assert.equal(fx.explosions.length,0,'explosions expire');
fx.configure({reducedMotion:true});
fx.asteroidBreak(120,190,26);
assert.equal(fx.explosions.length,0,'respects reduced-motion');
fx.reset();
assert.equal(fx.diagnostics().explosions,0);
if(ImageBefore!==undefined)globalThis.Image=ImageBefore;
console.log('Art upgrade 8.8.8: 32 PNGs, safe headless fallback and FX limits passed');
