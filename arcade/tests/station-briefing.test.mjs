import {RuntimeHarness} from './runtime-game.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderBasePanel} from '../base-panel.js';
import {renderStationRoutePreview,renderWorldMap} from '../map-panel.js';
import {readFileSync} from 'node:fs';
import {PROBE_OPERATION} from '../operations.js';
import {RELAY_DEFENSE} from '../relay-defense.js';
import {CARRIER_INTERCEPTION} from '../carrier-interception.js';

const home=()=>({id:'0:0',type:'dock',x:0,y:0,active:true,discovered:true});
const lab=()=>({id:'1:0',type:'lab',x:600,y:150,active:true,discovered:true});
const world=(bases)=>{
 const stations=new Map(bases.map(b=>[b.id,b]));
 return {
  home:bases[0],stations,
  networkTopology:()=>({count:bases.length,links:[],linked:new Set(stations.keys())}),
  nearbyRocks:()=>[],nearbyStations:()=>[],signals:()=>[]
 };
};
const stationState=(w,extra={})=>({
 world:w,ore:20,data:0,hp:110,maxHp:110,shield:0,time:0,
 civilianBases:1,activeBases:1,connectedBases:1,connected:true,
 allies:0,droneRoles:[],droneDamage:0,charges:0,doctrine:null,
 contract:null,operation:null,baseTab:'summary',transfers:[],network:{
  armor:0,engine:0,armament:0,strikePower:0
 },...extra
});

test('home station preview uses an actual operation position and discovered sector data',()=>{
 const b=home(),other=lab(),hidden={id:'2:0',type:'arsenal',x:350,y:400,active:false,discovered:false};
 const w=world([b,other,hidden]);
 const html=renderStationRoutePreview(b,stationState(w));
 assert.match(html,/ИСТОЧНИК ПОМЕХ/);
 assert.match(html,/Изучить карту/);
 assert.match(html,/Расположение станции, известных узлов и цели/);
 assert.doesNotMatch(html,/Арсенал/);
 const completed=renderStationRoutePreview({...b,corridorSecured:true},stationState(w));
 assert.match(completed,/КОРИДОР ОТКРЫТ/);
});

test('the full map previews a mission without accepting it and offers return to station',()=>{
 const b=home(),w=world([b]);
 const game={player:{x:0,y:0},world:w,docked:b,mapReturnToBase:true,
  enemyBasesUnlocked:()=>false,operation:null,contract:null,waypoint:null};
 const html=renderWorldMap(game);
 assert.match(html,/ПРЕДВАРИТЕЛЬНЫЙ МАРШРУТ/);
 assert.match(html,/Источник помех/);
 assert.match(html,/data-act="baseBack"/);
 assert.equal(game.operation,null,'preview must never accept the mission');
 const ordinary=renderWorldMap({...game,mapReturnToBase:false});
 assert.doesNotMatch(ordinary,/data-act="baseBack"/);
});

test('station operations expose risk, consequences, route and preparation without spoiling waves',()=>{
 const b=home(),w=world([b]);
 const h=renderBasePanel(b,stationState(w,{baseTab:'operations'}));
 assert.match(h,/Отключить глушитель и вернуться в док/);
 assert.match(h,/Подробности и опасности/);
 assert.match(h,/После выполнения:/);
 assert.match(h,/Посмотреть район/);
 assert.match(h,/Опыт <b>0<\/b>/);
 assert.match(h,/aria-controls="base-panel-hangar"/);
 const prep=renderBasePanel(b,stationState(w,{baseTab:'hangar',hp:30}));
 assert.match(prep,/ГОТОВНОСТЬ К ВЫЛЕТУ/);
 assert.match(prep,/Корпус сильно повреждён/);
 assert.match(prep,/после покупки останется 0 сплава/);
 assert.match(prep,/Вернуться к операциям/);
});

test('lab operation marks an uncertain search area and shows repair progress',()=>{
 const b=lab(),w=world([home(),b]);
 const preview=renderStationRoutePreview(b,stationState(w));
 assert.match(preview,/ПОИСК ЗОНДА/);
 assert.match(preview,/Предполагаемая область/);
 const operation={id:'last-signal',baseId:b.id,repair:45,x:800,y:300};
 const html=renderBasePanel(b,stationState(w,{operation,baseTab:'operations'}));
 assert.match(html,/<progress value="45" max="100"/);
 assert.match(html,/Возможны перехватчики/);
 assert.match(html,/покажет ещё один сигнал станции/);
});

test('unavailable special operations state their actual blocking condition',()=>{
 const b=home(),w=world([b]);
 const foreign={id:'last-signal',baseId:'1:0',repair:15};
 const html=renderBasePanel(b,stationState(w,{operation:foreign,baseTab:'operations'}));
 assert.match(html,/Сначала завершите или отложите текущую особую операцию/);
 assert.doesNotMatch(html,/data-act="acceptOperation"/,
  'a blocked mission must not offer a misleading start button');
});


test('antenna preview names real outcomes, hides unknown stations, and uses optional map detail',()=>{
 const b=home(),neighbor={...lab(),x:1850,y:20};
 const hidden={id:'2:0',type:'arsenal',x:1500,y:100,active:true,discovered:false};
 const w=world([b,neighbor,hidden]);
 w.networkTopology=boost=>{
  const linked=new Set(boost?[b.id,neighbor.id]:[b.id]);
  return {count:linked.size,linked,links:[]};
 };
 const html=renderBasePanel(b,stationState(w,{baseTab:'network',relayGain:1}));
 assert.match(html,/Радиус антенны: 1450 → 1950 м/);
 assert.match(html,/После усиления в сети будет 2 узла \(сейчас 1\)/);
 assert.match(html,/Подключатся: Лаборатория/);
 assert.match(html,/Посмотреть действие антенны на карте/);
 assert.match(html,/Показаны только известные включённые станции/);
 assert.doesNotMatch(html,/<title>Арсенал/,'hidden locations must not appear on the preview');
});

test('preparation follows the actual active mission, even when visiting another station',()=>{
 const b=home(),w=world([b]);
 const operation={id:PROBE_OPERATION.id,name:PROBE_OPERATION.name,
  baseId:'1:0',repair:25,x:700,y:200};
 const html=renderBasePanel(b,stationState(w,{baseTab:'hangar',operation}));
 const hangar=html.slice(html.indexOf('ГОТОВНОСТЬ К ВЫЛЕТУ'));
 assert.match(hangar,/Операция «Последний сигнал»: при ремонте зонда/);
 assert.doesNotMatch(hangar,/Операция «Глухой коридор»: у глушителя/);
});

test('the map uses the unified E repair control, not an obsolete F instruction',()=>{
 const b=home(),w=world([b]);
 const operation={id:PROBE_OPERATION.id,baseId:b.id,
  x:350,y:0,repair:28,maxRepair:100};
 const html=renderWorldMap({world:w,player:{x:0,y:0},
  enemyBasesUnlocked:()=>false,operation,contract:null,waypoint:null});
 assert.match(html,/удерживайте E в 150 м от зонда/);
 assert.doesNotMatch(html,/удерживайте F/);
});

test('completed probe summary promises a new station only when actually found',()=>{
 const b={...lab(),probeRecovered:true},w=world([home(),b]);
 const html=renderBasePanel(b,stationState(w));
 assert.match(html,/Если поблизости найден ещё один узел/);
 assert.doesNotMatch(html,/Данные открывают следующий маршрут/);
});

test('postponing a probe retains the correct completion message',()=>{
 const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const start=source.indexOf(' abandonOperation(){');
 const end=source.indexOf('  abandonContract(){',start);
 assert.ok(start>0&&end>start,'abandon operation handler must exist');
 const Harness=RuntimeHarness;
 const messages=[],game=new Harness();
 Object.assign(game,{dead:false,probeRepairing:true,
  operation:{id:PROBE_OPERATION.id,name:PROBE_OPERATION.name},
  waypoint:{id:PROBE_OPERATION.id},heritage:{ui:()=>{}},notice:(s)=>messages.push(s),
  overlay:{dataset:{mode:'base'}},renderDock:()=>{}});
 game.abandonOperation();
 assert.equal(game.operation,null);
 assert.equal(game.waypoint,null,'postponed probe route must not linger as an active mission');
 assert.equal(game.probeRepairing,false);
 assert.match(messages[0],/Прогресс ремонта сохранён/);
 assert.doesNotMatch(messages[0],/передатчика/);
});
