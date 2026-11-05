import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {renderWorldMap} from '../map-panel.js';
import {connectContour} from '../territory-system.js';

const harness=()=>({world:new World(),player:{x:0,y:0,shield:0},
 mapView:'territory',contourRegion:'all',contourFirst:null,contourSelection:null,
 contourError:'',mapReturnToBase:false,time:0});

test('the strategic map starts with five accessible regions and no hidden navigation gate',()=>{
 const game=harness(),html=renderWorldMap(game);
 assert.match(html,/Вся карта/);
 assert.equal((html.match(/data-act="contourRegion"/g)||[]).length,6);
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
 assert.match(html,/Проложить маршрут/);
 assert.match(html,/Защитный импульс/);
 assert.match(html,/data-act="contourPulse" disabled/);
 assert.match(html,/ПРАВИЛА/);
 game.mapReturnToBase=true;game.docked=world.home;
 assert.match(renderWorldMap(game),/data-act="baseBack"/);
});
