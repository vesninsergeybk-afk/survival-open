import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mobileAimKind,touchStickVector} from '../mobile-input.js';

const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../mobile-controls-v2.css',import.meta.url),'utf8');

test('touch taps designate by default; manual splash attacks require an armed button',()=>{
 assert.equal(mobileAimKind(),null);
 assert.equal(mobileAimKind(true,false),'comet');
 assert.equal(mobileAimKind(false,true),'mines');
 assert.equal(mobileAimKind(true,true),'mines');
 assert.match(game,/e\.pointerType==='touch'\?[\s\S]*?mobileAimKind\(this\.mobileCometArmed,this\.mobileMineArmed\)/);
 assert.match(game,/this\.mobileCometArmed=false;this\.mobileMineArmed=false;|this\.mobileMineArmed=false;this\.mobileCometArmed=false;/);
 assert.match(game,/this\.canvas\?\.addEventListener\('lostpointercapture',cancelAim\)/);
});
test('joystick is radial, bounded and resists invalid pointers',()=>{
 assert.deepEqual(touchStickVector(0,0,40),{x:0,y:0});
 assert.deepEqual(touchStickVector(20,0,40),{x:.5,y:0});
 assert.deepEqual(touchStickVector(100,0,40),{x:1,y:0});
 const diagonal=touchStickVector(40,40,40);
 assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.y)-1)<1e-10);
 assert.deepEqual(touchStickVector(NaN,40,40),{x:0,y:0});
 assert.match(game,/pad\.addEventListener\('lostpointercapture',release\)/);
 assert.match(game,/if\(active!==null\)return;active=e\.pointerId/);
});
test('mobile combat, aim and zoom controls are discoverable without cluttering the flight view',()=>{
 for(const id of ['mobileAbilities','mobileAbilitiesToggle','cometBtn','minefieldBtn',
   'mobileZoomOut','mobileZoomIn','mobileZoomValue','tacticBtn']){
  assert.match(page,new RegExp('id="'+id+'"'));
 }
 assert.match(page,/id="mobileAbilities"[^>]*hidden>/);
 assert.match(page,/id="mobileAbilitiesToggle"[^>]*aria-expanded="false"/);
 assert.match(page,/mobile-controls-v2\.css\?v=mobile-flight-20261112-1/);
 assert.match(css,/@media \(pointer:coarse\)/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/\.mobile-abilities\[hidden\]/);
 assert.match(css,/#actionBtn\{min-height:46px/);
 assert.match(css,/body:has\(#overlay:not\(\[hidden\]\)\) \.mobile/);
 assert.doesNotMatch(css,/@media \(pointer:fine\)/);
});
