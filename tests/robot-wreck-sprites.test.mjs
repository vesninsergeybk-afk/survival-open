import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WRECK_ATLAS_CELL, WRECK_DEATH_FRAMES, WRECK_POSE_FRAMES,
    WRECK_DEATH_SECONDS, WRECK_SHEET_FILES, ROBOT_WRECK_MANIFEST,
    wreckDirection, wreckDeathFrame, wreckIdleFrame
} from '../src/robot-wreck-sprites.js';

assert.equal(ROBOT_WRECK_MANIFEST.total,144);
assert.equal(ROBOT_WRECK_MANIFEST.death,64);
assert.equal(ROBOT_WRECK_MANIFEST.static,80);
assert.equal(WRECK_DEATH_FRAMES,16);
assert.equal(WRECK_POSE_FRAMES,5);
assert.equal(WRECK_ATLAS_CELL,152);
assert.deepEqual([0,Math.PI/2,Math.PI,-Math.PI/2].map(wreckDirection),
    ['up','right','down','left']);
assert.equal(wreckDirection(2*Math.PI),'up');
for(let i=0;i<16;i++){
    const age=(i+.01)*WRECK_DEATH_SECONDS/16;
    assert.equal(wreckDeathFrame(age),i);
}
assert.equal(wreckDeathFrame(WRECK_DEATH_SECONDS),15);
assert.equal(wreckDeathFrame(1e6),15);
assert.equal(wreckDeathFrame(-1),0);
for(let seed=0;seed<30;seed++){
    for(let t=0;t<30;t+=.031){
        const frame=wreckIdleFrame(t,seed);
        assert.ok(Number.isInteger(frame)&&frame>=0&&frame<5);
    }
}
const root=join(dirname(fileURLToPath(import.meta.url)),
    '../assets/prologue/spac1/wreck-v1');
assert.equal(Object.keys(WRECK_SHEET_FILES).length,8);
for(const name of Object.values(WRECK_SHEET_FILES)){
    const bytes=readFileSync(join(root,name));
    assert.ok(bytes.byteLength>8000,name+' nonempty');
    assert.equal(bytes.subarray(0,4).toString('ascii'),'RIFF',name);
    assert.equal(bytes.subarray(8,12).toString('ascii'),'WEBP',name);
    assert.ok(bytes.byteLength<400000,name+' reasonable size');
}
console.log('SPAC-1 wrecks: 144 cells, four headings, eight valid atlases OK.');
