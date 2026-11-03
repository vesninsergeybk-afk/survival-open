import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/mission-ambush.js',import.meta.url),'utf8');
const {createConvoyTrap,advanceConvoyTrap,CONVOY_TRAP,progressCaption}=
    await import('data:text/javascript,'+encodeURIComponent(source));
const c={x:2000,y:500};
const route=[{x:1000,y:0},{x:2000,y:500}];
const trap=createConvoyTrap(c,route);
assert.equal(trap.phase,'impact');
assert.equal(trap.wrecks.length,2);
assert.ok(trap.wrecks[0].x>c.x && trap.wrecks[1].x<c.x);
assert.equal(advanceConvoyTrap(trap,3).engineFailure,false);
assert.equal(advanceConvoyTrap(trap,3.25).engineFailure,true);
assert.equal(trap.phase,'salvage');
let elapsed=0,orbitals=0,boarders=0;
while(!trap.cleared&&elapsed<150){
    const ev=advanceConvoyTrap(trap,.05);
    if(ev.orbital)orbitals++;
    if(ev.boarders)boarders++;
    elapsed+=.05;
}
assert.equal(trap.cleared,true,'Salvage always finishes on timer');
assert.ok(elapsed>=CONVOY_TRAP.salvageSeconds-.01);
assert.ok(orbitals>=5 && orbitals<=8,'Orbital cadence has several fair warnings');
assert.ok(boarders>=4 && boarders<=7,'Boarding waves are limited');
assert.equal(trap.wrecks[0].integrity,0);
assert.match(progressCaption(trap),/Проход освобождён/);
assert.equal(advanceConvoyTrap(trap,1).cleared,false,
    'The completion event fires exactly once');
assert.equal(createConvoyTrap(c,route).progress,0,
    'A new sortie has no previous wreckage');
console.log('Mission 4: impact, engine failure, drones, strike timing and recovery passed');
