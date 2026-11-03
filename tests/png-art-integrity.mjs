import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

// Unlike the abandoned pipe-generated WebP files, PNG is complete,
// seek-free and browser-compatible. Verify the exact game asset set.
const root=join(dirname(fileURLToPath(import.meta.url)),'..','assets','space');
const files=[
    ['asteroid-realistic.png',510,500],
    ['asteroid-ore.png',510,500],
    ['boss-capital-dreadnought.png',1024,1536],
    ['boss-capital-carrier.png',1024,1536],
    ['boss-capital-cruiser.png',1024,1536]
];
for(const [name,w,h] of files){
    const data=readFileSync(join(root,name));
    assert(data.length>10000,name+' is suspiciously short');
    assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a',name+' PNG signature');
    assert.equal(data.toString('ascii',12,16),'IHDR',name+' header');
    assert.equal(data.readUInt32BE(16),w,name+' width');
    assert.equal(data.readUInt32BE(20),h,name+' height');
    assert.equal(data[24],8,name+' bit depth');
    assert.equal(data[25],6,name+' must have RGBA, including transparency');
}
console.log('Survivor 9.5.2: five complete RGBA PNG assets found');
