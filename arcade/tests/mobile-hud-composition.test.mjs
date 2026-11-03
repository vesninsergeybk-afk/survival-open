import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const touch=readFileSync(new URL('../mobile-hud.css',import.meta.url),'utf8');

test('landscape touch HUD stylesheet loads after the authored HUD',()=>{
 const artwork=page.indexOf('hud-art.css?v=');
 const responsive=page.indexOf('mobile-hud.css?v=landscape-rail-01');
 assert.ok(artwork>=0&&responsive>artwork,'touch rules must override the artwork rules');
 assert.match(touch,/@media \(pointer:coarse\) and \(orientation:landscape\)/);
 assert.doesNotMatch(touch,/@media \(pointer:fine\)/,'desktop controls must remain untouched');
});

test('compact mobile HUD reserves the piloting view and both thumb zones',()=>{
 assert.match(touch,/#hud\.cockpit-hud \.wing-right\s*\{[\s\S]*?left:calc\(/);
 assert.match(touch,/#hud\.cockpit-hud \.hud-ability-row\s*\{\s*display:none\s*\}/);
 assert.match(touch,/#hud\.cockpit-hud #message\s*\{[\s\S]*?top:auto;[\s\S]*?bottom:max\(/);
 assert.match(touch,/#hud\.cockpit-hud #message\s*\{[\s\S]*?max-width:min\(420px,calc\(100vw - 348px\)\)/);
 assert.match(touch,/#audioControls\s*\{\s*top:max\(54px/,'audio stays below navigation');
 assert.match(touch,/#burstBtn,#quietBtn\s*\{\s*min-height:44px/,'touch targets remain usable');
 assert.match(touch,/max-width:690px/,'narrow landscape prioritises the ship');
 assert.match(touch,/max-height:240px/,'short browser toolbars need a dedicated fallback');
});
