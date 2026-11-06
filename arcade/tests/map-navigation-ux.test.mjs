import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {renderWorldMap} from '../map-panel.js';
import {firstContourPlan} from '../contour-plan.js';
import {connectContour,contourFields,createContours} from '../territory-system.js';
import {mapViewport,mapViewSpec,zoomMap,panMap,pointerOnMap,worldAtMapPoint} from '../map-navigation.js';
import {ArcadeGame} from './runtime-game.mjs';

const game=()=>({world:new World(),player:{x:0,y:0,shield:0},time:0,
 mapView:'territory',contourRegion:'amethyst',contourSelection:null,contourFirst:null,
 contourError:'',contourInfo:'',mapViewports:{},waypoint:null,enemyBasesUnlocked:()=>false});

test('wheel zoom stays under the cursor, panning is reversible, and limits hold',()=>{
 const g=game(),old=mapViewport(g),pixel={x:493,y:112};
 assert.equal(mapViewSpec(g).key,'region:amethyst');
 const target=worldAtMapPoint(old,pixel);
 const enlarged=zoomMap(old,pixel,1.5,mapViewSpec(g).limits);
 assert.deepEqual(worldAtMapPoint(enlarged,pixel),target);
 const shifted=panMap(enlarged,{x:75,y:-48});
 const undone=panMap(shifted,{x:-75,y:48});
 assert.ok(Math.abs(undone.center.x-enlarged.center.x)<1e-9);
 assert.ok(Math.abs(undone.center.y-enlarged.center.y)<1e-9);
 assert.equal(zoomMap(old,pixel,1000,mapViewSpec(g).limits).scale,.24);
 assert.equal(zoomMap(old,pixel,.00001,mapViewSpec(g).limits).scale,.018);
 assert.deepEqual(pointerOnMap({getBoundingClientRect:()=>({left:10,top:20,width:680,height:480})},350,260),{x:340,y:240});
});

test('right-click and touch placement use the same marker without deleting an objective',()=>{
 const g=game();g.renderMap=()=>{g.renders=(g.renders||0)+1;};g.heritage={ui:()=>{}};
 g.waypoint={id:'operation:probe',x:1200,y:500,label:'Вернуться с данными'};
 g.mapMarkMode=true;
 const pixel={x:390,y:204},view=mapViewport(g),world=worldAtMapPoint(view,pixel);
 assert.equal(ArcadeGame.prototype.setMapWaypoint.call(g,pixel),true);
 assert.equal(g.manualWaypoint.id,'map:manual');
 assert.equal(g.manualWaypoint.x,Math.round(world.x));
 assert.equal(g.manualWaypoint.y,Math.round(world.y));
 assert.equal(g.waypoint.id,'operation:probe');
 assert.equal(g.mapMarkMode,false);
 assert.equal(g.renders,1);
 const html=renderWorldMap(g);
 assert.match(html,/data-act="mapClearWaypoint"/);
 assert.match(html,/data-act="mapMarkMode"/);
 assert.equal(ArcadeGame.prototype.setMapWaypoint.call(g,{x:690,y:240}),false);
 assert.equal(g.renders,1);
});

test('wheel transitions between regional and world view and preserves the focus',()=>{
 const g=game();g.renderMap=()=>{};
 g.mapViewports['region:amethyst']={center:{x:300,y:-200},scale:.018};
 const pixel={x:400,y:210},anchor=worldAtMapPoint(mapViewport(g),pixel);
 ArcadeGame.prototype.zoomMapAt.call(g,.8,pixel);
 assert.equal(g.contourRegion,'all');
 assert.ok(Math.abs(worldAtMapPoint(mapViewport(g),pixel).x-anchor.x)<.001);
 assert.ok(Math.abs(worldAtMapPoint(mapViewport(g),pixel).y-anchor.y)<.001);
 g.mapViewports.overview={center:{x:0,y:0},scale:.014};
 ArcadeGame.prototype.zoomMapAt.call(g,1.2,{x:340,y:240});
 assert.equal(g.contourRegion,'amethyst');
});

test('the live startup constellation has a safe suggested first contour',()=>{
 const g=game(),w=g.world;w.home.active=true;
 const p=firstContourPlan(w,w.nearbyStations(360,-85,5300,true),'0:0',g.player);
 assert.deepEqual(p.stations.map(s=>s.id),['0:0','1:0','0:-1']);
 assert.equal(p.active,1);
 assert.ok(p.area>200000);
 assert.equal(p.edges.filter(x=>x.ready).length,0);
 g.contourFirst='0:0';g.contourSelection='0:0';
 const html=renderWorldMap(g);
 assert.match(html,/data-map-world="true"/);
 assert.match(html,/map-nav-tools/);
 assert.match(html,/ПКМ — маршрут/);
 assert.match(html,/ПЕРВЫЙ ЭНЕРГЕТИЧЕСКИЙ КОНТУР/);
 assert.match(html,/Работают 1 из 3 станций/);
 assert.match(html,/contour-plan-area/);
 assert.match(html,/contour-reach-ring/);
});

test('three powered but mismatched stations get a practical fourth-site option',()=>{
 const g=game(),w=g.world;
 w.contours=createContours();
 const stations=[['home',0,0,true],['B',1500,-100,true],['C',-1500,-100,true],['D',0,1300,false]]
  .map(([id,x,y,active])=>({id,x,y,active,discovered:true,enemy:false,suppressed:false,type:'dock'}));
 w.stations=new Map(stations.map(s=>[s.id,s]));
 assert.ok(Math.hypot(3000,0)>2800);
 const plan=firstContourPlan(w,stations,'home',{x:0,y:0});
 assert.ok(plan,'the adviser must not dead-end with three incompatible active nodes');
 assert.ok(plan.stations.some(s=>s.id==='D'));
 assert.ok(plan.stations.some(s=>s.active));
 assert.ok(plan.next);
 plan.next.active=true;
 for(const edge of plan.edges){
  const result=connectContour(w,edge.a.id,edge.b.id);
  assert.equal(result.ok,true,result.reason);
 }
 assert.equal(contourFields(w).length,1);
});

test('candidate planning does not disclose unknown allegiance or mutate state',()=>{
 const g=game(),w=g.world;w.home.active=true;
 const hidden=w.station(1,0);hidden.enemy=true;hidden.discovered=false;hidden.active=false;
 const before=JSON.stringify(w.contours);
 const plan=firstContourPlan(w,w.nearbyStations(360,-85,5300,true),'0:0',g.player);
 assert.ok(plan);
 assert.equal(JSON.stringify(w.contours),before);
 if(plan.stations.includes(hidden))assert.equal(plan.uncertain,true);
 const html=renderWorldMap(g);
 assert.doesNotMatch(html,/Неизвестный узел, вражеская станция/);
});

test('panned local navigation projects player and route in the same coordinates',()=>{
 const g=game();g.mapView='map';g.mapViewports.local={center:{x:1000,y:0},scale:.1};
 g.waypoint={id:'mission:relay',x:-1500,y:0,label:'Задание'};
 g.manualWaypoint={id:'map:manual',x:1500,y:0,label:'Моя метка'};
 const html=renderWorldMap(g);
 assert.match(html,/class="local-chart" data-map-world="true"/);
 assert.match(html,/M 240\.0 240\.0 L 390\.0 240\.0/);
 assert.match(html,/class="chart-pilot" transform="translate\(240\.0 240\.0\)"/);
 assert.match(html,/Моя метка/);
 assert.match(html,/data-act="mapClearWaypoint"/);
});
