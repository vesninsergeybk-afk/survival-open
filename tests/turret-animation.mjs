import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../src/turret-motion.js',import.meta.url),'utf8');
const {turretAngleDelta,turnTurretTowards,turretMuzzle}=
    await import('data:text/javascript,'+encodeURIComponent(source));

const pi=Math.PI;
assert.ok(Math.abs(turretAngleDelta(pi-.05,-pi+.05)-.1)<1e-8,
    'Aiming crosses the +/- PI seam by the shortest route');
assert.ok(Math.abs(turretAngleDelta(-pi+.05,pi-.05)+.1)<1e-8);
let angle=0;
for(let frame=0;frame<10;frame++)angle=turnTurretTowards(angle,pi/2,1/60,7.4);
assert.ok(angle>1.1 && angle<pi/2,'The barrel turns smoothly over multiple frames');
for(let frame=0;frame<10;frame++)angle=turnTurretTowards(angle,pi/2,1/60,7.4);
assert.ok(Math.abs(angle-pi/2)<1e-8,'The barrel reaches its target without overshoot');
assert.equal(turnTurretTowards(0,3,0),0,'Pausing never changes the angle');
assert.ok(Number.isFinite(turnTurretTowards(0,3,4)),'Resume frames are clamped');
const right=turretMuzzle(100,200,0,0,0);
assert.deepEqual(right,{x:203,y:200});
const recoil=turretMuzzle(100,200,0,0,9);
assert.deepEqual(recoil,{x:194,y:200});
const up=turretMuzzle(100,200,pi/2,pi/2,0);
assert.ok(Math.abs(up.x-100)<1e-8 && Math.abs(up.y-303)<1e-8);
console.log('Turret motion: angle wrap, slew, pause and muzzle/recoil passed');
