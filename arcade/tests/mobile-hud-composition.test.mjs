import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const touch=readFileSync(new URL('../mobile-hud.css',import.meta.url),'utf8');

test('landscape touch HUD stylesheet loads after the authored HUD',()=>{
 const artwork=page.indexOf('hud-art.css?v=');
 const responsive=page.indexOf('mobile-hud.css?v=landscape-rail-03');
 assert.ok(artwork>=0&&responsive>artwork,'touch rules must override the artwork rules');
 assert.match(touch,/@media \(pointer:coarse\) and \(orientation:landscape\)/);
 assert.doesNotMatch(touch,/@media \(pointer:fine\)/,'desktop controls must remain untouched');
});

test('compact mobile HUD reserves the piloting view and both thumb zones',()=>{
 assert.match(touch,/#hud\.cockpit-hud \.wing-right\s*\{[\s\S]*?left:calc\(/);
 assert.match(touch,/#hud\.cockpit-hud \.hud-ability-row\s*\{\s*display:none\s*\}/);
 assert.match(touch,/#hud\.cockpit-hud #message\s*\{[\s\S]*?top:auto;[\s\S]*?bottom:max\(/);
 assert.match(touch,/#hud\.cockpit-hud #message\s*\{[\s\S]*?max-width:min\(290px,calc\(100vw - 348px\)\)/);
 assert.match(touch,/#audioControls\s*\{\s*top:max\(52px/,'audio stays below navigation');
 assert.match(touch,/#burstBtn,#quietBtn\s*\{\s*min-height:44px/,'touch targets remain usable');
 assert.match(touch,/body:has\(#tacticBtn:not\(\[hidden\]\)\):has\(#hackBtn:not\(\[hidden\]\)\):has\(#strikeBtn:not\(\[hidden\]\)\)/,'all three abilities have priority over the radar');
 assert.match(touch,/body:has\(#ionBtn:not\(\[hidden\]\)\):has\(#hackBtn:not\(\[hidden\]\)\)/,'rental plus other combat buttons yields radar space');
 assert.match(touch,/max-width:690px/,'narrow landscape prioritises the ship');
 assert.match(touch,/\.hud-support-ring:not\(\.available\) \{ display:none \}/,
  'empty special-attack badge must not crowd the mobile panel');
 assert.match(touch,/\.hud-drone-band::before/,
  'compact drone count has an identifying icon');
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(game,/Подлетите к доку и нажмите «Действие»\./,
  'first mobile instruction is concise and uses the touch action');
 assert.match(game,/Добыча: удерживайте «Действие»\./,
  'mining does not refer to keyboard E on touch');
 assert.match(touch,/max-height:240px/,'short browser toolbars need a dedicated fallback');
});
