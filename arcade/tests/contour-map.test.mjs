import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {renderWorldMap} from '../map-panel.js';
import {connectContour,armContourReserve,CONTOURS} from '../territory-system.js';
import {previewContourConnection,contourConnectionChoices} from '../contour-preview.js';
import {drawContourWorld} from '../contour-visuals.js';
import {recordWorldFeedback} from '../world-feedback.js';
import {FLUX_SORTIE,launchFluxSortie} from '../flux-offense.js';
import {atlasPoint,atlasGeography,atlasNebulae,atlasStars,atlasLiveObjects,atlasNavigation} from '../contour-cartography.js';
import {readFileSync} from 'node:fs';

const harness=()=>({world:new World(),player:{x:0,y:0,shield:0},
 mapView:'territory',contourRegion:'all',contourFirst:null,contourSelection:null,
 contourError:'',mapReturnToBase:false,time:0});

test('the strategic map starts with five accessible regions and no hidden navigation gate',()=>{
 const game=harness(),html=renderWorldMap(game);
 assert.match(html,/Вся карта/);
 assert.equal((html.match(/data-act="contourRegion"/g)||[]).length,12,
  'the atlas includes a direct first-contour shortcut alongside the region controls');
 assert.match(html,/Показать первые станции/);
 assert.equal((html.match(/class="contour-region"/g)||[]).length,5);
 assert.equal((html.match(/data-act="contourNode"/g)||[]).length,0);
 assert.match(html,/КАРТА ПЯТИ РЕГИОНОВ/);
 assert.match(html,/Контуры территорий/);
 assert.match(html,/contour-global-constellations/);
 assert.ok((html.match(/class="contour-global-station unknown"/g)||[]).length>80,
  'the global atlas should display surveyed station positions from all regions');
 assert.match(html,/Не разведана/,'the grey stations need a visible legend');
 assert.match(html,/<rect x="27" y="-12" width="58" height="22"/,
  'the northern count must sit beside its node cluster, away from the home label');
 assert.doesNotMatch(html,/contour-region[^>]*>[\s\S]*?<circle r="30" fill="#0b2333"/,
  'opaque counters must not cover the live station constellations');
 game.contourRegion='amethyst';
 const focused=renderWorldMap(game);
 assert.ok((focused.match(/data-act="contourNode"/g)||[]).length>10);
 assert.match(focused,/data-act="mapView" data-id="targets"/);
 assert.match(html,/text y="70" text-anchor="middle"[^>]+>Лазурный разлом<\/text>/,
  'the southern label must not cover the home-region halo');
});

test('the global atlas keeps exact positions but does not disclose unknown station factions',()=>{
 const game=harness(),world=game.world,html=renderWorldMap(game);
 const marker=[...world.stations.values()].find(s=>s.enemy&&!s.discovered&&!s.strategicRole&&
  Math.abs(s.x)*.0035<330&&Math.abs(s.y)*.0035<230&&
  Math.hypot(s.x,s.y)<5500);
 assert.ok(marker,'an uncharted hostile station is needed for the visibility check');
 const p=atlasPoint(marker,{x:0,y:0},.0035),num=n=>n.toFixed(1);
 assert.ok(html.includes(`class="contour-global-station unknown" cx="${num(p.x)}" cy="${num(p.y)}"`),
  'even hidden hostile sites appear only as anonymous surveyed points');
 const distant={id:'secret:factory',x:65000,y:50000,enemy:true,active:false,
  discovered:false,suppressed:false,type:'factory',hp:100};
 world.stations.set(distant.id,distant);
 const remote=atlasPoint(distant,{x:0,y:0},.0035);
 const xy=`cx="${num(remote.x)}" cy="${num(remote.y)}"`;
 assert.ok(!renderWorldMap(game).includes(`class="contour-global-station unknown" ${xy}`),
  'a remote machine site outside the surveyed five regions must stay hidden');
 distant.discovered=true;
 assert.ok(renderWorldMap(game).includes(`class="contour-global-station hostile" ${xy}`),
  'the same remote site appears at its true position after discovery');
 assert.match(html,/contour-region-halo/);
 assert.match(html,/0 \/ [0-9]+/,'region counters are placed outside the node clusters');
});

test('published entrypoint refreshes the complete map import chain',()=>{
 const entry=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const panel=readFileSync(new URL('../map-panel.js',import.meta.url),'utf8');
 for(const [file,source] of [['entrypoint',entry],['game',game],['map panel',panel]])
  assert.match(source,/global-constellations-1-spacing-1/,
   `${file} must use the new module URL so cached browsers do not show the old atlas`);
});

test('machine radio trunks are a separate opt-in map layer with earned knowledge',()=>{
 const game=harness(),world=game.world;
 const a=world.stations.get('industry:depot'),b=world.stations.get('28:5');
 a.discovered=true;b.discovered=true;
 game.enemyBackboneMap=true;
 assert.doesNotMatch(renderWorldMap(game),/contour-hostile-trunk/,
  'discovering stations alone does not unlock radio intelligence');
 world.home.type='lab';world.home.active=true;
 game.enemyBackboneMap=false;
 let html=renderWorldMap(game);
 assert.match(html,/Радиосеть машин/);
 assert.match(html,/Показать радиолинии на всей карте/);
 assert.doesNotMatch(html,/class="contour-hostile-trunk"/);
 game.enemyBackboneMap=true;
 html=renderWorldMap(game);
 assert.match(html,/class="contour-hostile-trunk"/);
 assert.match(html,/Сборочный пост/);
 b.captured=true;b.enemy=false;
 html=renderWorldMap(game);
 assert.match(html,/class="contour-hostile-broken"/);
 assert.match(html,/Оборвана/);
});

test('the atlas shows automatic links, selected route and territory income without manual connection controls',()=>{
 const game=harness(),world=game.world;
 game.contourRegion='amethyst';
 const stations=world.nearbyStations(0,0,2200,false).slice(0,3);
 for(const s of stations)s.active=true;
 game.contourSelection=stations[0]?.id;
 const html=renderWorldMap(game);
 assert.match(html,/Отметить маршрут к станции/);
 assert.match(html,/Как устроена сеть/);
 assert.match(html,/СЕТЬ РАБОТАЕТ САМА/);
 assert.doesNotMatch(html,/data-act="contourConnect"|data-act="contourUnlink"|data-act="contourPlanLink"/);
 assert.match(html,/contour-map-caption/);
 game.mapReturnToBase=true;game.docked=world.home;
 assert.match(renderWorldMap(game),/data-act="baseBack"/);
});

test('the territory atlas offers an actual funded reserve on a selected critical node, then shows readiness and location',()=>{
 const g=harness(),w=g.world,base=w.home;
 base.type='lab';base.active=true;base.discovered=true;
 const a={id:'test:west',x:1200,y:-500,active:true,enemy:false,suppressed:false,
  discovered:true,type:'dock'};
 const b={...a,id:'test:east',x:1200,y:600};
 w.stations.set(a.id,a);w.stations.set(b.id,b);
 w.contours.links=[[base.id,a.id],[a.id,b.id],[b.id,base.id]];
 w.contours.flux=CONTOURS.reserveCost;
 g.contourRegion='amethyst';g.contourSelection=base.id;
 let html=renderWorldMap(g);
 assert.match(html,/Опора для вылазки/);
 assert.match(html,/data-act="contourReserve"/);
 assert.match(html,new RegExp('Установить ложный маяк · '+CONTOURS.reserveCost+' флюкса'));
 assert.equal(armContourReserve(w,base.id,g.time).ok,true);
 html=renderWorldMap(g);
 assert.match(html,/Ложный маяк:/);
 assert.match(html,/готов через 12 с/);
 assert.match(html,/contour-reserve-pin/);
 assert.doesNotMatch(html,/data-act="contourReserve"/,'a purchased one-use order is not duplicated by opening the map');
});

test('the atlas offers a visible, range-checked offensive sortie only for a charted enemy depot',()=>{
 const g=harness(),w=g.world,target=w.stations.get('industry:depot');
 g.contourRegion='amethyst';g.contourSelection=target.id;
 assert.doesNotMatch(renderWorldMap(g),/data-act="contourSortie"/,
  'unknown machine bases are not actionable');
 target.discovered=true;w.discovered.add(target.id);
 let html=renderWorldMap(g);
 assert.match(html,/Нарушить снабжение противника/);
 assert.doesNotMatch(html,/data-act="contourSortie"/);
 const nodes=[[5100,800],[5500,2300],[6300,1000]].map(([x,y],i)=>({
  id:'101:'+i,x,y,type:'dock',turrets:[],active:true,enemy:false,
  suppressed:false,discovered:true
 }));
 for(const n of nodes)w.stations.set(n.id,n);
 w.contours.links=[[nodes[0].id,nodes[1].id],[nodes[1].id,nodes[2].id],
  [nodes[2].id,nodes[0].id]];
 w.contours.flux=FLUX_SORTIE.cost;
 html=renderWorldMap(g);
 assert.match(html,/data-act="contourSortie" data-id="industry:depot"/);
 assert.match(html,/Из контура до цели/);
 w.home.type='lab';w.home.active=true;
 w.regionalSupply.central.pendingRaid={announced:true,readyAt:2};
 html=renderWorldMap(g);
 assert.match(html,/может не успеть остановить этот вылет/,
  'known raid timing should warn before spending flux on a late arrival');
 w.regionalSupply.central.pendingRaid.readyAt=40;
 assert.match(renderWorldMap(g),/может успеть перерезать связь/);
 assert.equal(launchFluxSortie(w,target.id,g.time).ok,true);
 html=renderWorldMap(g);
 assert.match(html,/Постановщик помех в пути/);
 assert.match(html,/contour-sortie-pin/);
 assert.doesNotMatch(html,/data-act="contourSortie"/);
 w.contours.sortie=null;
 target.fluxJamUntil=25;
 g.player.x=target.x;g.player.y=target.y;
 g.mapViewports={'region:amethyst':{center:{x:target.x,y:target.y},scale:.055}};
 html=renderWorldMap(g);
 assert.match(html,/радиопомехи ещё 25 с/);
 assert.match(html,/contour-jam-pin/);
 assert.match(html,/data-act="contourTarget" data-id="industry:depot"/,
  'a known industrial post can be selected even outside the original map viewport');
 assert.doesNotMatch(html,/data-act="contourSortie"/);
});

test('a possible final link remains an internal forecast; map does not ask players to build it',()=>{
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
 assert.match(view,/Новые линии появятся сами/);
 assert.doesNotMatch(view,/data-act="contourConnect"|data-act="contourUnlink"/);
});

test('a player with one working station sees a route to the next site, not a line-building task',()=>{
 const game=harness(),world=game.world;
 world.home.active=true;
 game.contourRegion='amethyst';game.contourFirst=world.home.id;
 game.contourSelection=world.home.id;
 const html=renderWorldMap(game);
 assert.match(html,/Пока рядом нет подходящей работающей опоры/);
 assert.match(html,/Новые линии появятся сами/);
 assert.equal((html.match(/class="contour-goal-link"/g)||[]).length,1);
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

test('the default territory map explains real industrial consequences without forcing the pilot into another tab',()=>{
 const game=harness();
 recordWorldFeedback(game,{key:'live',cause:'Враг перехватил сборщика',
  effect:'Этот рейс не принёс флюкс'});
 game.contourInfo='Связь проведена. Замкните область для добычи.';
 const html=renderWorldMap(game);
 assert.match(html,/Что произошло в мире · 1/);
 assert.match(html,/Враг перехватил сборщика/);
 assert.match(html,/Этот рейс не принёс флюкс/);
 assert.match(html,/contour-info/);
 assert.match(html,/Замкните область для добычи/);
 assert.match(html,/Контуры территорий/);
});

test('regional and world atlases pin only witnessed events at verified positions',()=>{
 const game=harness();game.contourRegion='amethyst';game.time=20;
 recordWorldFeedback(game,{key:'located',cause:'Груз перехвачен',effect:'Поставка сорвана',
  kind:'loss',label:'СНАБЖЕНИЕ ПЕРЕХВАЧЕНО',x:0,y:0});
 recordWorldFeedback(game,{key:'secret',cause:'Радиоперехват',effect:'Враг меняет тактику',
  label:'ТАКТИКА',x:undefined,y:undefined});
 const html=renderWorldMap(game);
 assert.equal((html.match(/class="contour-incident-pin /g)||[]).length,1);
 assert.match(html,/aria-label="Груз перехвачен → Поставка сорвана"/);
 assert.match(html,/Замеченное событие/);
 for(let i=0;i<5;i++)recordWorldFeedback(game,{key:'extra-'+i,
  cause:'Доставка '+i,effect:'Потери',label:'ОТМЕТКА',kind:'loss',
  x:(i-2)*1350,y:(i%2?1:-1)*900});
 assert.equal((renderWorldMap(game).match(/class="contour-incident-pin /g)||[]).length,3);
 game.contourRegion='all';
 const overview=renderWorldMap(game);
 assert.ok((overview.match(/class="contour-incident-pin /g)||[]).length<=4);
 assert.match(overview,/Доставка \d → Потери/);
 assert.doesNotMatch(overview,/Радиоперехват → Враг меняет тактику/,
  'the world atlas must not invent positions for unlocated news');
 game.contourRegion='amethyst';game.time=201;
 assert.doesNotMatch(renderWorldMap(game),/class="contour-incident-pin /);
});

test('the new atlas uses one measured projection for every layer and shows the actual regional boundary',()=>{
 const local=atlasPoint({x:360,y:-85},{x:360,y:-85},.055);
 const far=atlasPoint({x:1000,y:1000},{x:0,y:0},.0035);
 assert.deepEqual(local,{x:340,y:240});
 assert.equal(far.x,343.5);assert.equal(far.y,243.5);
 const geography=atlasGeography({x:0,y:0},.0035);
 assert.match(geography,/contour-world-geography/);
 assert.match(geography,/r="245\.0"/);
 assert.match(geography,/fill="#ffbd79"/);
 assert.match(geography,/fill="#caa0ff"/);
 const world=new World();
 const stars=atlasStars(world.seed,{x:0,y:0},.0035,true);
 assert.equal(stars,atlasStars(world.seed,{x:0,y:0},.0035,true));
 assert.ok((stars.match(/<circle/g)||[]).length<250,'world star map should stay sparse');
 const nebulae=atlasNebulae(world.seed,{x:0,y:0},.0035,true);
 assert.equal(nebulae,atlasNebulae(world.seed,{x:0,y:0},.0035,true));
 assert.match(nebulae,/contour-nebula-amethyst/);
});

test('physical atlas shows nearby generated rocks and radar contacts but no distant enemy omniscience',()=>{
 const game=harness(),world=game.world;
 game.enemies=[{x:200,y:250,hp:8},{x:2500,y:0,hp:9}];
 world.rocks.set('0:0',[{x:330,y:120,r:44,alive:true},{x:1000,y:0,r:23,alive:false}]);
 const before=world.rocks.size;
 const scene=atlasLiveObjects(game,{x:0,y:0},.055,false);
 assert.equal((scene.signals.match(/class="contour-radar-contact"/g)||[]).length,1);
 assert.equal((scene.backdrop.match(/<circle/g)||[]).length,1);
 assert.equal(world.rocks.size,before,'opening a map should not generate new rock cells');
 assert.match(scene.signals,/contour-flight-window/);
 const global=atlasLiveObjects(game,{x:0,y:0},.0035,true);
 assert.doesNotMatch(global.signals,/class="contour-radar-contact"/);
});

test('the atlas flight outline follows the actual camera at both zoom extremes',()=>{
 const game=harness();game.vw=1200;game.vh=800;
 const rectangle=zoom=>{
  game.camera=()=>({x:-600/zoom,y:-400/zoom,w:1200/zoom,h:800/zoom});
  const {signals}=atlasLiveObjects(game,{x:0,y:0},.055,false);
  const match=signals.match(/<rect class="contour-flight-window"[^>]*width="([\d.]+)" height="([\d.]+)"/);
  assert.ok(match,'the regional atlas displays its flight-window outline');
  return {width:Number(match[1]),height:Number(match[2])};
 };
 assert.deepEqual(rectangle(1),{width:66,height:44});
 assert.deepEqual(rectangle(.55),{width:120,height:80});
 assert.deepEqual(rectangle(1.5),{width:44,height:29.3});
 delete game.camera;
 assert.match(atlasLiveObjects(game,{x:0,y:0},.055,false).signals,/width="66\.0" height="44\.0"/,
  'map test fixtures without a flight camera continue to use logical viewport dimensions');
});

test('a distant once-seen cargo is not magically tracked without a live signal',()=>{
 const game=harness(),world=game.world;
 world.regionalSupply.convoys=[{id:'known',x:30000,y:11000,seen:true,hp:3},
  {id:'secret',x:31000,y:11500,seen:false,hp:3}];
 let state=atlasLiveObjects(game,{x:31000,y:11500},.049,false);
 assert.equal(state.visibleCargo,0);
 game.waypoint={id:'known',x:30000,y:11000,signalLive:true};
 state=atlasLiveObjects(game,{x:31000,y:11500},.049,false);
 assert.equal(state.visibleCargo,1);
 game.waypoint.signalLive=false;
 game.waypoint.radioContact=true;
 assert.equal(atlasLiveObjects(game,{x:31000,y:11500},.049,false).visibleCargo,0);
});

test('regional storms and navigation are spatial overlays rather than decorative map fiction',()=>{
 const game=harness(),azure={x:7500,y:35700};
 const scene=atlasLiveObjects(game,azure,.049,false);
 assert.ok(scene.visibleStorms>0);
 assert.match(scene.backdrop,/contour-storm/);
 game.waypoint={x:azure.x+1000,y:azure.y,label:'Цель'};
 const route=atlasNavigation(game,{x:0,y:0},.0035,true);
 assert.match(route,/contour-navigation-path/);
 assert.match(route,/20 км/);
 const close=atlasNavigation(game,{x:0,y:0},.055,false);
 assert.match(close,/1 км/);
 const css=readFileSync(new URL('../menu-system.css',import.meta.url),'utf8');
 assert.match(css,/\.contour-world-geography,[^}]*pointer-events:none/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('station labels and ship marker cannot swallow a station click',()=>{
 const game=harness();game.world.home.active=true;game.contourRegion='amethyst';
 const html=renderWorldMap(game);
 assert.match(html,/<\/g><text[^>]+class="contour-map-label">Ремонтный док<\/text>/);
 const css=readFileSync(new URL('../menu-system.css',import.meta.url),'utf8');
 assert.match(css,/\.contour-player-pin\{pointer-events:none\}/);
 assert.match(css,/\.contour-map-label\{[^}]*pointer-events:none/);
 game.waypoint={x:game.world.home.x+1400,y:game.world.home.y-300};
 assert.match(renderWorldMap(game),/class="contour-map-label" text-anchor="end">Ремонтный док<\/text>/,
  'a nearby navigation marker must not cover the station title');
});
