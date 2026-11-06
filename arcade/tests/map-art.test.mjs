import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chartBackdrop,chartFrame,stationGlyph,pilotGlyph} from '../map-art.js';
import {World} from '../world.js';
import {renderWorldMap} from '../map-panel.js';

test('map artwork is deterministic and bounded at both overview and tactical zoom',()=>{
 for(const [scale,overview] of [[.0035,true],[.055,false],[.24,false]]){
  const center={x:360,y:-85},before=structuredClone(center);
  const html=chartBackdrop(20261102,center,scale,{overview});
  assert.equal(html,chartBackdrop(20261102,center,scale,{overview}));
  assert.deepEqual(center,before);assert.doesNotMatch(html,/NaN|Infinity|<filter|<image|https:/);
  assert.ok((html.match(/<ellipse/g)||[]).length<=45);
  assert.ok(html.length<18000,'static art must not flood a phone with thousands of shapes');
 }
 assert.doesNotMatch(chartBackdrop(undefined,{x:0,y:0},.05),/NaN|Infinity/);
});

test('unknown station symbols never reveal function, ownership or suppression through their artwork',()=>{
 const unseen=stationGlyph('lab',{known:false});
 assert.equal(unseen,stationGlyph('carrier',{known:false,color:'#ff0000',hostile:true,active:true}));
 assert.equal(unseen,stationGlyph('arsenal',{known:false}));
 assert.doesNotMatch(unseen,/hostile|active|--pin-color/);
 assert.notEqual(stationGlyph('lab'),stationGlyph('dock'),'known station functions remain distinguishable');
});

test('decorative instruments do not intercept map gestures and represent the real camera and scale',()=>{
 const html=chartFrame({x:1200,y:-600},.1,{local:true});
 assert.match(html,/pointer-events="none"/);assert.match(html,/X 1[\s\S]*200 · Y -600 м/);
 assert.match(html,/v6h50\.0v-6/,'500 real metres are 50 map units at this zoom');
 assert.match(pilotGlyph(240,190),/translate\(240\.0 190\.0\)/);
});

test('the same world still produces exact route and station positions after the art pass',()=>{
 const world=new World(20261102);world.home.active=true;world.home.discovered=true;
 const g={world,player:{x:0,y:0,shield:0},time:0,mapView:'territory',contourRegion:'amethyst',
  contourFirst:world.home.id,contourSelection:world.home.id};
 const before=JSON.stringify(world.contours),html=renderWorldMap(g);
 assert.equal(JSON.stringify(world.contours),before);
 assert.match(html,/data-act="contourNode" data-id="0:0"/);
 assert.match(html,/transform="translate\(320\.2 244\.7\)"/);
 assert.match(html,/План первого энергетического контура/);
 assert.match(html,/Неизвестный узел, не исследована/);
 assert.doesNotMatch(html,/Неизвестный узел, вражеская станция/);
 const unknown=[...html.matchAll(/<g class="contour-node[^\"]*"[^>]*aria-label="Неизвестный узел, не исследована">([\s\S]*?)<title>/g)];
 assert.ok(unknown.length>5);
 for(const [,symbol] of unknown){assert.match(symbol,/chart-station-unknown/);assert.doesNotMatch(symbol,/chart-station-symbol/);}
});

test('published entry refreshes art dependencies and preserves a reduced-motion alternative',()=>{
 for(const file of ['index.html','game.js','map-panel.js','contour-atlas.js']){
  const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');assert.match(source,/map-art-1/,file);
 }
 const css=readFileSync(new URL('../map-art.css',import.meta.url),'utf8');
 assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/\.chart-surface,\.chart-instruments,\.chart-pilot\{pointer-events:none/);
});
