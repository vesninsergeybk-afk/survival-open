import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {renderWorldMap} from '../map-panel.js';
import {connectContour} from '../territory-system.js';
import {previewContourConnection,contourConnectionChoices} from '../contour-preview.js';
import {drawContourWorld} from '../contour-visuals.js';
import {readFileSync} from 'node:fs';

const harness=()=>({world:new World(),player:{x:0,y:0,shield:0},
 mapView:'territory',contourRegion:'all',contourFirst:null,contourSelection:null,
 contourError:'',mapReturnToBase:false,time:0});

test('the strategic map starts with five accessible regions and no hidden navigation gate',()=>{
 const game=harness(),html=renderWorldMap(game);
 assert.match(html,/Вся карта/);
 assert.equal((html.match(/data-act="contourRegion"/g)||[]).length,11);
 assert.equal((html.match(/class="contour-region"/g)||[]).length,5);
 assert.equal((html.match(/data-act="contourNode"/g)||[]).length,0);
 assert.match(html,/КАРТА ПЯТИ РЕГИОНОВ/);
 assert.match(html,/Контуры территорий/);
 game.contourRegion='amethyst';
 const focused=renderWorldMap(game);
 assert.ok((focused.match(/data-act="contourNode"/g)||[]).length>10);
 assert.match(focused,/data-act="mapView" data-id="targets"/);
});

test('the atlas shows next actions, selected route, links, income and reversible controls',()=>{
 const game=harness(),world=game.world;
 game.contourRegion='amethyst';
 const stations=world.nearbyStations(0,0,2200,false).slice(0,3);
 for(const s of stations)s.active=true;
 game.contourSelection=stations[0]?.id;
 const html=renderWorldMap(game);
 assert.match(html,/Отметить маршрут к станции/);
 assert.match(html,/Как устроена сеть/);
 assert.match(html,/СЛЕДУЮЩЕЕ ДЕЙСТВИЕ/);
 assert.match(html,/contour-map-caption/);
 game.mapReturnToBase=true;game.docked=world.home;
 assert.match(renderWorldMap(game),/data-act="baseBack"/);
});

test('a planned final line previews real area and production without touching live territory',()=>{
 const game=harness(),world=game.world;
 const stations=[
  ['0:0',0,0],['B',1600,0],['C',900,1200]
 ].map(([id,x,y])=>({id,x,y,active:true,enemy:false,suppressed:false,discovered:true,type:'dock'}));
 world.stations=new Map(stations.map(s=>[s.id,s]));
 assert.equal(connectContour(world,'0:0','B').ok,true);
 assert.equal(connectContour(world,'B','C').ok,true);
 const original=JSON.stringify(world.contours);
 const preview=previewContourConnection(world,'C','0:0');
 assert.equal(preview.ok,true);
 assert.equal(preview.areaGain,960000);
 assert.ok(preview.productionGain>0);
 assert.equal(preview.newFields.length,1);
 assert.equal(JSON.stringify(world.contours),original);
 const choices=contourConnectionChoices(world,'C',stations);
 assert.equal(choices.ready[0].node.id,'0:0');
 game.contourRegion='amethyst';game.contourFirst='C';game.contourSelection='C';
 const view=renderWorldMap(game);
 assert.match(view,/contour-future-field/);
 assert.match(view,/Замкнёт поле/);
 assert.match(view,/data-act="contourConnect"/);
});

test('a player with one working station sees a specific next exploration target',()=>{
 const game=harness(),world=game.world;
 world.home.active=true;
 game.contourRegion='amethyst';game.contourFirst=world.home.id;
 game.contourSelection=world.home.id;
 const html=renderWorldMap(game);
 assert.match(html,/Нужна ещё одна станция/);
 assert.match(html,/contour-goal-link/);
 assert.match(html,/Отметить маршрут к станции/);
 assert.doesNotMatch(html,/aria-label="Неизвестный узел, вражеская станция"/);
});

test('world view renders unfinished links and clearly distinguishes interrupted power',()=>{
 const game=harness(),world=game.world;
 const a=world.home,b={id:'B',x:1300,y:0,active:true,enemy:false,suppressed:false};
 a.active=true;world.stations.set('B',b);
 assert.equal(connectContour(world,a.id,'B').ok,true);
 const strokes=[];
 const ctx={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){strokes.push(this.strokeStyle)},setLineDash(){}};
 game.visuals={reducedMotion:true};game.fps=60;
 const camera={x:-100,y:-100,w:1600,h:900};
 drawContourWorld(game,ctx,camera);
 assert.ok(strokes.some(s=>s?.includes('98,244,218')));
 b.suppressed=true;strokes.length=0;game.contourVisualAt=-Infinity;
 drawContourWorld(game,ctx,camera);
 assert.ok(strokes.some(s=>s?.includes('255,115,129')));
});

test('station labels and ship marker cannot swallow a station click',()=>{
 const game=harness();game.world.home.active=true;game.contourRegion='amethyst';
 const html=renderWorldMap(game);
 assert.match(html,/<\/g><text[^>]+class="contour-map-label">Ремонтный док<\/text>/);
 const css=readFileSync(new URL('../menu-system.css',import.meta.url),'utf8');
 assert.match(css,/\.contour-player-pin\{pointer-events:none\}/);
 assert.match(css,/\.contour-map-label\{[^}]*pointer-events:none/);
});
