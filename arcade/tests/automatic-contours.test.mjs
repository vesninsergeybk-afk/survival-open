import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContours,autoConnectContours,contourFields,contourArea,validContours,CONTOURS} from '../territory-system.js';
import {syncContourDynamics,activeContourTransition,resumeContourTransition} from '../contour-dynamics.js';
import {renderWorldMap} from '../map-panel.js';
import {game} from './weapons-scene.mjs';
import {createStrategicExperience} from '../strategic-experience.js';

const node=(id,x,y,active=false)=>({id,x,y,active,enemy:false,suppressed:false,discovered:true,type:'dock'});
const network=()=>{
 const sites=[node('A',0,0,true),node('B',1400,0),node('C',700,1100)];
 return {stations:new Map(sites.map(s=>[s.id,s])),contours:createContours()};
};

test('activating the third suitable station closes the triangle without a map action',()=>{
 const world=network(),a=world.stations.get('A'),b=world.stations.get('B'),c=world.stations.get('C');
 assert.deepEqual(autoConnectContours(world),[]);
 b.active=true;
 assert.deepEqual(autoConnectContours(world),[['A','B']]);
 assert.equal(contourFields(world).length,0);
 c.active=true;
 assert.equal(autoConnectContours(world).length,2);
 assert.equal(world.contours.links.length,3);
 assert.equal(contourFields(world).length,1);
 assert.equal(contourArea(contourFields(world)),770000);
 assert.deepEqual(autoConnectContours(world),[],'repeat updates must not create duplicate links');
 assert.equal(world.contours.flux,0,'closing a triangle never invents a resource payment or free flux');
 assert.equal(validContours(world.contours,[...world.stations]),true);
});

test('powering a fourth station inside a valid triangle cannot erase the existing territory',()=>{
 const stations=[node('A',0,0,true),node('B',1000,0,true),
  node('C',500,1000,true),node('D',500,333,false)];
 const world={stations:new Map(stations.map(s=>[s.id,s])),contours:createContours()};
 autoConnectContours(world);
 assert.equal(contourFields(world).length,1);
 assert.equal(contourArea(contourFields(world)),500000);
 world.stations.get('D').active=true;
 assert.equal(autoConnectContours(world).length,3);
 assert.equal(contourFields(world).length,3);
 assert.equal(contourArea(contourFields(world)),500000,
  'subdividing existing land must not destroy its production or claim area');
 assert.equal(validContours(world.contours,[...world.stations]),true);
});

test('separate undersized loops cannot pool their land to unlock flux',()=>{
 const sites=[node('A',0,0,true),node('B',600,0,true),node('C',300,400,true),
  node('D',5000,0,true),node('E',5600,0,true),node('F',5300,400,true)];
 const world={stations:new Map(sites.map(s=>[s.id,s])),contours:createContours()};
 autoConnectContours(world);
 assert.equal(world.contours.links.length,6);
 assert.equal(contourFields(world).length,0,
  'two unrelated 120000 m² triangles each remain below the minimum area');
});

test('automatic connections prefer a viable triangle over competing short dead-end links',()=>{
 const stations=[node('A',2576,261,true),node('B',3866,815,true),
  node('C',4594,3346,true),node('D',4384,2207,true),node('E',4464,2873,true)];
 const world={stations:new Map(stations.map(s=>[s.id,s])),contours:createContours()};
 const links=autoConnectContours(world);
 assert.ok(links.length>=3);
 assert.ok(contourArea(contourFields(world))>=CONTOURS.minFaceArea,
  'three mutually reachable stations must not be defeated by shorter unusable loops');
 assert.deepEqual(autoConnectContours(world),[]);
 assert.equal(validContours(world.contours,[...world.stations]),true);
});

test('a tiny interior subface is not discarded as a nested overlapping territory',()=>{
 const sites=[node('A',807,3144,true),node('B',1086,3440,true),
  node('C',4738,310,true),node('D',230,804,true),node('E',947,3128,true)];
 const world={stations:new Map(sites.map(s=>[s.id,s])),contours:createContours()};
 autoConnectContours(world);
 assert.equal(contourArea(contourFields(world)),241034,
  'adjacent 191368 m² and 49666 m² faces together retain the outer triangle');
 assert.ok(contourFields(world).some(f=>f.vertices.includes('E')));
});

test('distant stations do not mint a field; a fourth nearby station completes one',()=>{
 const world=network();world.stations.get('B').active=true;
 const c=world.stations.get('C');c.active=true;c.y=3700;
 autoConnectContours(world);
 assert.equal(contourFields(world).length,0);
 const d=node('D',700,1100,true);world.stations.set(d.id,d);
 const added=autoConnectContours(world);
 assert.ok(added.length>0);
 assert.equal(contourFields(world).length,1);
 assert.ok(contourFields(world)[0].vertices.includes('D'));
 assert.ok(!contourFields(world)[0].vertices.includes('C'));
});

test('temporary suppression interrupts production but retains the automatic layout',()=>{
 const world=network();world.stations.get('B').active=true;world.stations.get('C').active=true;
 autoConnectContours(world);const saved=JSON.stringify(world.contours.links);
 const g={world,time:2};syncContourDynamics(g);
 world.stations.get('B').suppressed=true;
 assert.equal(contourFields(world).length,0);
 assert.equal(syncContourDynamics(g).kind,'loss');
 assert.deepEqual(autoConnectContours(world),[]);
 world.stations.get('B').suppressed=false;
 assert.deepEqual(autoConnectContours(world),[]);
 assert.equal(syncContourDynamics(g).kind,'claim');
 assert.equal(contourFields(world).length,1);
 assert.equal(JSON.stringify(world.contours.links),saved);
});

test('the live game emits a single territory event and grants XP only on first closure',()=>{
 const g=game(),w=g.world;
 g.player.strategicXp=createStrategicExperience();
 w.stations=new Map([...network().stations]);w.contours=createContours();
 const a=w.stations.get('A'),b=w.stations.get('B'),c=w.stations.get('C');
 a.active=true;b.active=true;
 syncContourDynamics(g);
 assert.equal(g.refreshAutomaticContours(),true);
 assert.equal(contourFields(w).length,0);
 const xp=g.player.xp;
 c.active=true;
 assert.equal(g.refreshAutomaticContours(),true);
 assert.equal(contourFields(w).length,1);
 assert.match(g.lastNotice,/Территория создана автоматически/);
 assert.equal(g.contourDynamics.transition.kind,'claim');
 assert.equal(g.contourBirths.length,1);
 assert.ok(g.player.xp>xp);
 assert.equal(g.worldFeedback.history[0].label,'КОНТУР ЗАМКНУЛСЯ');
 const after=g.player.xp;
 assert.equal(g.refreshAutomaticContours(),false);
 assert.equal(g.player.xp,after);
});

test('territorial map is observational: no buttons build or cut automatic links',()=>{
 const g=game(),w=g.world;
 w.home.active=true;g.mapView='territory';g.contourRegion='amethyst';
 g.contourSelection=w.home.id;
 const view=renderWorldMap(g);
 assert.match(view,/Связи появятся автоматически|Новые линии появятся сами/);
 assert.doesNotMatch(view,/data-act="contourConnect"|data-act="contourPlanLink"|data-act="contourUnlink"/);
 const code=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.doesNotMatch(code,/act==='contourConnect'|act==='contourUnlink'|act==='contourPlanLink'/);
});

test('a triangle formed in a paused station menu animates after leaving that menu',()=>{
 const g=game(),w=g.world;
 w.stations=network().stations;w.contours=createContours();
 for(const node of w.stations.values())node.active=true;
 g.paused=true;g.player.strategicXp=createStrategicExperience();
 syncContourDynamics(g);
 assert.equal(g.refreshAutomaticContours(),true);
 const transition=g.contourDynamics.transition;
 assert.equal(transition.pendingResume,true);
 transition.realAt=-Infinity; // Simulate spending a long time in the station menu.
 assert.equal(activeContourTransition(g),transition);
 assert.equal(resumeContourTransition(g),true);
 g.paused=false;
 assert.equal(transition.pendingResume,false);
 assert.equal(activeContourTransition(g),transition);
 assert.equal(resumeContourTransition(g),false);
});
