import test from 'node:test';
import assert from 'node:assert/strict';
import {stripCapitalMatte,CAPITAL_PAINTINGS} from '../capital-art.js';

function tile(w,h,color=[230,230,230,255]){
 const data=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<w*h;i++)data.set(color,i*4);
 return data;
}
function paint(data,w,x,y,color){
 data.set(color,(y*w+x)*4);
}
function pixel(data,w,x,y){
 return Array.from(data.slice((y*w+x)*4,(y*w+x)*4+4));
}

test('opaque gray studio rectangle is never used as an enemy sprite',()=>{
 const data=tile(12,12);
 const result=stripCapitalMatte(data,12,12);
 assert.equal(result.usable,false);
 assert.equal(result.remaining,0);
 assert.equal(data[3],0);
});

test('edge-connected matte disappears but pale enclosed armour stays',()=>{
 const w=12,h=12,data=tile(w,h);
 for(let y=3;y<=8;y++)for(let x=3;x<=8;x++)
  paint(data,w,x,y,[30,39,51,255]);
 paint(data,w,5,5,[230,230,230,255]);
 const result=stripCapitalMatte(data,w,h);
 assert.equal(result.usable,true);
 assert.deepEqual(pixel(data,w,0,0),[230,230,230,0]);
 assert.deepEqual(pixel(data,w,6,4),[30,39,51,255]);
 assert.deepEqual(pixel(data,w,5,5),[230,230,230,255],
  'light interior plating must not be removed');
});

test('subtle compression noise at the border is removed',()=>{
 const w=10,h=10,data=tile(w,h,[224,225,223,255]);
 for(let x=3;x<=6;x++)for(let y=2;y<=7;y++)
  paint(data,w,x,y,[55,65,73,255]);
 paint(data,w,1,1,[231,231,230,255]);
 const result=stripCapitalMatte(data,w,h);
 assert.equal(result.usable,true);
 assert.equal(pixel(data,w,1,1)[3],0);
 assert.equal(pixel(data,w,5,5)[3],255);
});

test('inconsistent or dark backgrounds are never destructively guessed',()=>{
 const irregular=tile(8,8,[14,18,25,255]);
 const copy=irregular.slice();
 assert.equal(stripCapitalMatte(irregular,8,8).usable,false);
 assert.deepEqual(irregular,copy);
 const mixed=tile(8,8);
 paint(mixed,8,7,7,[30,45,60,255]);
 const prior=mixed.slice();
 assert.equal(stripCapitalMatte(mixed,8,8).usable,false);
 assert.deepEqual(mixed,prior);
});

test('already transparent artwork remains usable without losing its colours',()=>{
 const w=10,h=10,data=tile(w,h,[0,0,0,0]);
 for(let y=3;y<=6;y++)for(let x=3;x<=6;x++)
  paint(data,w,x,y,[122,70,35,255]);
 const before=data.slice();
 const result=stripCapitalMatte(data,w,h);
 assert.equal(result.usable,true);
 assert.deepEqual(data,before);
});

test('invalid dimensions or buffers are rejected without side effects',()=>{
 const data=tile(10,10);
 assert.deepEqual(stripCapitalMatte(data,0,10).usable,false);
 assert.deepEqual(stripCapitalMatte(data,10,9).usable,false);
 assert.deepEqual(stripCapitalMatte(null,10,10).usable,false);
});

test('three actual capital paintings use PNG originals, not broken WebP exports',()=>{
 assert.deepEqual(Object.keys(CAPITAL_PAINTINGS).sort(),['carrier','cruiser','dreadnought']);
 for(const extension of Object.values(CAPITAL_PAINTINGS))assert.equal(extension,'png');
 assert.equal(Object.isFrozen(CAPITAL_PAINTINGS),true);
});
