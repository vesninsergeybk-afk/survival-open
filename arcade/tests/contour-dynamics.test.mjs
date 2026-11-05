import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContours,connectContour,disconnectContour,contourFields,contourArea,insidePolygon} from '../territory-system.js';
import {syncContourDynamics,activeContourTransition,fieldIsNew,enemyContourThreats} from '../contour-dynamics.js';
import {renderWorldMap} from '../map-panel.js';
import {drawContourWorld} from '../contour-visuals.js';
import {World} from '../world.js';

const gameWithNodes=()=>{
 const world=new World();world.stations=new Map([
  ['0:0',{id:'0:0',x:0,y:0,active:true,enemy:false,discovered:true,type:'dock',title:'Опорный док'}],
  ['B',{id:'B',x:1400,y:0,active:true,enemy:false,discovered:true,type:'dock',title:'Вторая опора'}],
  ['C',{id:'C',x:700,y:1100,active:true,enemy:false,discovered:true,type:'dock',title:'Третья опора'}],
  ['D',{id:'D',x:2000,y:1100,active:true,enemy:false,discovered:true,type:'dock',title:'Четвёртая опора'}]
 ]);world.contours=createContours();
 return {world,player:{x:200,y:100,shield:10},enemies:[],time:1,
  mapView:'territory',contourRegion:'amethyst',contourSelection:null,contourFirst:null};
};
const link=(game,a,b)=>assert.equal(connectContour(game.world,a,b).ok,true);

test('the opening sequence requires an actual new face, not just any line',()=>{
 const game=gameWithNodes();
 assert.equal(syncContourDynamics(game),null,'the first observation never generates a false claim');
 link(game,'0:0','B');
 assert.equal(syncContourDynamics(game)?.kind,'reconfigure');
 link(game,'B','C');
 assert.equal(syncContourDynamics(game)?.kind,'reconfigure');
 link(game,'C','0:0');
 const claim=syncContourDynamics(game);
 assert.equal(claim.kind,'claim');
 assert.equal(claim.area,770000);
 assert.equal(claim.current.length,1);
 assert.equal(claim.changedLinks.length,1);
 assert.equal(activeContourTransition(game),claim);
 const html=renderWorldMap(game);
 assert.match(html,/contour-claim-surges/);
 assert.match(html,/contour-forming/);
 assert.match(html,/contour-vortex-forming/);
 assert.match(html,/pathLength="100"/);
});

test('loss retracts only invalid faces; restoration and alternate paths redraw boundaries',()=>{
 const game=gameWithNodes();
 link(game,'0:0','B');link(game,'B','C');link(game,'C','0:0');
 link(game,'B','D');link(game,'D','C');
 const full=contourArea(contourFields(game.world));
 syncContourDynamics(game);
 const save=game.world.stations.get('D');save.suppressed=true;
 const lost=syncContourDynamics(game);
 assert.equal(lost.kind,'loss');
 assert.equal(contourFields(game.world).length,1,'unbroken triangle must continue working');
 assert.ok(lost.area>0&&lost.area<full);
 assert.match(renderWorldMap(game),/contour-retreat/);
 assert.match(renderWorldMap(game),/contourRetreatMask/);
 save.suppressed=false;
 assert.equal(syncContourDynamics(game).kind,'claim');
 assert.equal(contourArea(contourFields(game.world)),full);
 assert.equal(disconnectContour(game.world,'B','D'),true);
 assert.equal(syncContourDynamics(game).kind,'loss');
 assert.equal(contourFields(game.world).length,1);
});

test('redrawing a diagonal does not invent another capture',()=>{
 const game=gameWithNodes(),{world}=game;
 world.stations.get('D').x=0;world.stations.get('D').y=1100;
 world.stations.get('C').x=1400;world.stations.get('C').y=1100;
 link(game,'0:0','B');link(game,'B','C');link(game,'C','D');link(game,'D','0:0');
 syncContourDynamics(game);
 const area=contourArea(contourFields(world));
 link(game,'0:0','C');
 const transition=syncContourDynamics(game);
 assert.equal(transition.kind,'reconfigure');
 assert.equal(contourArea(contourFields(world)),area);
 assert.doesNotMatch(renderWorldMap(game),/class="contour-owned-field contour-forming"/);
});

test('enemy outlines require a real, still-live order and a discovered target',()=>{
 const game=gameWithNodes(),{world}=game;
 link(game,'0:0','B');link(game,'B','C');link(game,'C','0:0');
 const raider={hp:50,converted:false,x:350,y:100,
  stationRaid:{stationId:'B',issuedAt:1,expiresAt:70}};
 game.enemies=[raider];
 let threats=enemyContourThreats(game);
 assert.equal(threats.length,1);
 assert.equal(threats[0].target.id,'B');
 assert.equal(threats[0].area,770000);
 assert.deepEqual(threats[0].supports.map(b=>b.id).sort(),['0:0','C']);
 let html=renderWorldMap(game);
 assert.match(html,/ВРАЖЕСКОЕ НАСТУПЛЕНИЕ/);
 assert.match(html,/contour-threat-field/);
 assert.match(html,/contour-threat-route/);
 assert.match(html,/contour-threat-target/);
 assert.match(html,/contourThreatRisk0/);
 assert.match(html,/Отметить маршрут к станции/);
 assert.match(html,/не уже захваченная территория/);
 world.stations.get('B').discovered=false;
 assert.equal(enemyContourThreats(game).length,0);
 html=renderWorldMap(game);
 assert.doesNotMatch(html,/contour-threat-target/);
 world.stations.get('B').discovered=true;
 raider.hp=0;assert.equal(enemyContourThreats(game).length,0);
 raider.hp=5;raider.stationRaid.expiresAt=game.time;
 assert.equal(enemyContourThreats(game).length,0);
});

test('a threatened station does not claim that a surviving bypass field will fall',()=>{
 const game=gameWithNodes(),{world}=game;
 world.stations.get('C').x=1400;world.stations.get('C').y=1100;
 world.stations.get('D').x=0;world.stations.get('D').y=1100;
 link(game,'0:0','B');link(game,'B','C');link(game,'C','D');link(game,'D','0:0');link(game,'0:0','C');
 const whole=contourArea(contourFields(world));
 game.enemies=[{hp:10,x:240,y:110,stationRaid:{stationId:'B',expiresAt:90}}];
 const plan=enemyContourThreats(game)[0];
 assert.equal(plan.area,whole/2);
 assert.equal(plan.remaining.length,1);
 assert.ok(plan.fields.length>plan.remaining.length);
});

test('the reduced-motion version remains readable and old saves have no phantom transitions',()=>{
 const game=gameWithNodes();
 link(game,'0:0','B');link(game,'B','C');link(game,'C','0:0');
 assert.equal(syncContourDynamics(game),null);
 assert.doesNotMatch(renderWorldMap(game),/contour-vortex-forming/);
 const css=readFileSync(new URL('../menu-system.css',import.meta.url),'utf8');
 assert.match(css,/@keyframes contourEnergyRace/);
 assert.match(css,/@keyframes contourTerritoryFill/);
 assert.match(css,/@keyframes contourVortexBorn/);
 assert.match(css,/\.contour-retreat\{display:none\}/);
 assert.match(css,/\.contour-vortex-map\.contour-vortex-forming\{opacity:1;transform:none\}/);
});

test('outer capture still fills genuinely new land when its vortex centre sits in old land',()=>{
 const positions={A:[0,0],B:[900,0],C:[450,900],D:[-900,-600],E:[1900,-600],F:[500,1750]};
 const game=gameWithNodes(),world=game.world;
 world.stations=new Map(Object.entries(positions).map(([id,[x,y]])=>
  [id,{id,x,y,active:true,enemy:false,discovered:true,type:'dock'}]));
 link(game,'A','B');link(game,'B','C');link(game,'C','A');
 syncContourDynamics(game);
 const small=contourFields(world)[0];
 link(game,'D','E');link(game,'E','F');link(game,'F','D');
 const claim=syncContourDynamics(game),outer=contourFields(world)[0];
 assert.equal(claim.kind,'claim');
 assert.equal(claim.area,2885000);
 assert.equal(insidePolygon(outer.center,small.polygon),true,
  'this is precisely the case the former centroid heuristic missed');
 assert.equal(fieldIsNew(outer,claim.previous),true);
 const local=renderWorldMap(game);
 assert.match(local,/contourAddedLand/);
 assert.match(local,/contourOldLand/);
 assert.match(local,/contour-owned-field contour-forming/);
 assert.match(local,/contour-vortex-forming/);
 assert.match(local,/contour-claim-surges/);
 const clips=[];
 const ctx={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},
  stroke(){},fill(){},arc(){},clip(rule){clips.push(rule||'nonzero')},setLineDash(){}};
 game.fps=30;game.visuals={reducedMotion:false};game.contourVisualAt=-Infinity;
 drawContourWorld(game,ctx,{x:-1700,y:-1100,w:4300,h:3600});
 assert.ok(clips.includes('evenodd'),'world renderer must subtract the existing land');
});

test('five-region atlas displays the real polygons, links and vortex at global scale',()=>{
 const game=gameWithNodes();
 link(game,'0:0','B');link(game,'B','C');link(game,'C','0:0');
 syncContourDynamics(game);
 game.contourRegion='all';
 const html=renderWorldMap(game);
 assert.match(html,/contour-global-ownership/);
 assert.match(html,/class="contour-owned-field"/);
 assert.match(html,/contour-vortex-map/);
 assert.match(html,/contour-live-link/);
 assert.match(html,/contour-region-claims/);
 assert.match(html,/contour-global-station owned/);
});
