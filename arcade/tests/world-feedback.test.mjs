import test from 'node:test';
import assert from 'node:assert/strict';
import {game} from './weapons-scene.mjs';
import {World} from '../world.js';
import {FRONTIERS} from '../frontier-industry.js';
import {connectContour,contourFields,advanceContours} from '../territory-system.js';
import {CENTRAL_INDUSTRY} from '../central-industry.js';
import {announceIndustryEvent,updateRegionalWorld} from '../region-runtime.js';
import {renderWorldMap} from '../map-panel.js';
import {recordWorldFeedback,recordContourFeedback,advanceWorldFeedback,renderWorldFeedbackMap,
 drawWorldFeedback,drawImpactInvestigation} from '../world-feedback.js';

function canvas(){
 const calls=[],c={calls,measureText:s=>({width:s.length*6})};
 for(const fn of ['save','restore','beginPath','arc','fillRect','strokeRect',
  'stroke','setLineDash','fillText'])c[fn]=(...args)=>calls.push([fn,...args]);
 return c;
}

test('industrial notifications require a known source or depot, never publishing secret positions',()=>{
 const g=game(),source=g.world.stations.get(CENTRAL_INDUSTRY.sourceId),
  depot=g.world.stations.get(CENTRAL_INDUSTRY.depotId);
 assert.equal(announceIndustryEvent(g,{kind:'central-dispatch',time:10,central:true}),false);
 assert.equal(g.worldFeedback,undefined);
 source.discovered=true;
 assert.equal(announceIndustryEvent(g,{kind:'central-dispatch',time:10,central:true}),true);
 assert.deepEqual(g.worldFeedback.history[0].position,{x:source.x,y:source.y});
 assert.equal(announceIndustryEvent(g,{kind:'central-delivery',time:10,central:true}),true);
 assert.equal(g.worldFeedback.history[0].position,null,
  'knowing the mine does not reveal the assembly station position');
 assert.ok(!renderWorldFeedbackMap(g).includes(String(depot.x)),
  'the text log must never contain coordinates of unknown stations');
 assert.equal(announceIndustryEvent(g,{kind:'central-dispatch',time:10,central:true}),true);
 assert.equal(g.worldFeedback.history.filter(e=>e.cause==='Шахта отправила груз').length,1,
  'repeated simulation events in the same tick must be deduplicated');
});

test('other industrial regions require discovery before their news enters the feed',()=>{
 const g=game(),cfg=FRONTIERS.azure;
 assert.equal(announceIndustryEvent(g,{kind:'dispatch',network:'azure',time:10}),false);
 g.world.stations.get(cfg.depotId).discovered=true;
 assert.equal(announceIndustryEvent(g,{kind:'delivery',network:'azure',time:10}),true);
 const entry=g.worldFeedback.history[0];
 assert.deepEqual(entry.position,{x:cfg.depot.x,y:cfg.depot.y});
 assert.match(entry.effect,/ионный отряд/);
});

test('world messages wait for combat notices and never overwrite one in progress',()=>{
 const g=game();g.messageUntil=g.time+4;
 recordWorldFeedback(g,{key:'first',cause:'Добыча началась',effect:'Груз отправлен',notify:true});
 recordWorldFeedback(g,{key:'second',cause:'Груз прибыл',effect:'Сборка ускорилась',notify:true});
 assert.equal(advanceWorldFeedback(g),false);
 assert.equal(g.lastNotice,undefined);
 g.time+=4.1;
 assert.equal(advanceWorldFeedback(g),true);
 assert.equal(g.lastNotice,'Добыча началась → Груз отправлен');
 assert.equal(advanceWorldFeedback(g),true,
  'test harness does not automatically update messageUntil after a notice');
 assert.equal(g.lastNotice,'Груз прибыл → Сборка ускорилась');
 assert.equal(advanceWorldFeedback(g),false);
});

test('feedback queue stays finite, stale notices expire, and repeated keys do not flood the map',()=>{
 const g=game();for(let i=0;i<12;i++)recordWorldFeedback(g,{
  key:'k'+i,cause:'Изменение '+i,effect:'Последствие '+i,notify:true});
 assert.equal(g.worldFeedback.pending.length,4);
 assert.equal(g.worldFeedback.history.length,9);
 assert.match(renderWorldFeedbackMap(g),/Изменение 11/);
 assert.doesNotMatch(renderWorldFeedbackMap(g),/Изменение 0/);
 assert.equal(recordWorldFeedback(g,{key:'k11',cause:'Повтор',effect:'Повтор'}),false);
 g.time+=25;
 assert.equal(advanceWorldFeedback(g),false);
 assert.equal(g.worldFeedback.pending.length,0);
});

test('map log escapes all event text and does not modify industrial accounting',()=>{
 const g=game(),before=JSON.stringify(g.world.regionalSupply);
 recordWorldFeedback(g,{key:'html',cause:'<script>alert(1)</script>',effect:'<img src=x>',
  label:'anything',x:13,y:15,notify:true});
 const html=renderWorldFeedbackMap(g);
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/&lt;img src=x&gt;/);
 assert.doesNotMatch(html,/<script>|<img/);
 assert.equal(JSON.stringify(g.world.regionalSupply),before);
});

test('the actual sector map contains a folded cause-and-effect log, not another menu page',()=>{
 const g=game();
 assert.doesNotMatch(renderWorldMap(g),/Что произошло в мире/);
 recordWorldFeedback(g,{key:'actual',cause:'Вы перехватили рудный груз',
  effect:'Один будущий патруль без тяжёлого корабля'});
 const page=renderWorldMap(g);
 assert.match(page,/<details class="map-objective world-feedback-log"/);
 assert.match(page,/Что произошло в мире · 1/);
 assert.match(page,/Один будущий патруль без тяжёлого корабля/);
 assert.match(page,/aria-label="Изменения мира"/);
});

test('world markers are local, fade, stay bounded and respect performance limits',()=>{
 const g=game(),cam={x:0,y:0,w:800,h:600};
 recordWorldFeedback(g,{key:'1',cause:'Груз',effect:'Рейд сорван',label:'СНАБЖЕНИЕ ПЕРЕХВАЧЕНО',x:300,y:200});
 recordWorldFeedback(g,{key:'2',cause:'Ремонт',effect:'Станция уцелела',label:'РЕМОНТ ЗАВЕРШЁН',x:310,y:210});
 recordWorldFeedback(g,{key:'3',cause:'За пределами поля',effect:'Невозможно увидеть',label:'СКРЫТЫЙ ПУТЬ',x:90000,y:90000});
 const c=canvas();assert.equal(drawWorldFeedback(c,cam,g,true,60),1);
 assert.equal(c.calls.filter(x=>x[0]==='fillText').length,1);
 assert.equal(drawWorldFeedback(canvas(),cam,g,false,20),0);
 g.time+=5;assert.equal(drawWorldFeedback(canvas(),cam,g,false,60),0);
});

test('investigating a hit is drawn only on a pilot without a newer sighting or order',()=>{
 const g=game(),cam={x:0,y:0,w:600,h:400},e={x:150,y:100,r:16,hp:40,
  _awarenessImpact:{x:360,y:130,at:g.time-.5}};
 g.enemies=[e];g.fps=60;
 const c=canvas();assert.equal(drawImpactInvestigation(c,cam,g),true);
 assert.ok(c.calls.some(x=>x[0]==='fillText'&&x[1]==='ИЩЕТ ИСТОЧНИК ОГНЯ'));
 e._awarenessLast={x:160,y:100,at:g.time};
 assert.equal(drawImpactInvestigation(canvas(),cam,g),false);
 delete e._awarenessLast;
 g.enemyComms={directiveFor:()=>({intel:true})};
 assert.equal(drawImpactInvestigation(canvas(),cam,g),false);
 g.enemyComms=null;e.signalIntel={lastSeenEstimated:true,lastSeenAt:g.time};
 assert.equal(drawImpactInvestigation(canvas(),cam,g),false);
 delete e.signalIntel;
 g.enemyComms=null;g.fps=15;
 assert.equal(drawImpactInvestigation(canvas(),cam,g),false);
});

test('industrial simulation still produces events from actual goods instead of notifications inventing them',()=>{
 const g=game(),s=g.world.regionalSupply,source=g.world.stations.get('industry:source');
 source.discovered=true;s.central.clock=59;s.central.ore=20;s.central.nextDispatch=60;
 g.time=60;
 // The world system determines whether a shipment is physically launched.
 updateRegionalWorld(g,.016);
 const launched=s.central.convoys.length;
 assert.ok(launched>0,'industrial stock should create a real convoy');
 assert.ok(g.worldFeedback?.history.some(e=>e.cause==='Шахта отправила груз'));
 assert.equal(s.central.convoys.length,launched,'feedback cannot invent an extra convoy');
});

test('real contour collectors explain deliveries and losses; untouched simulation produces no news',()=>{
 const w=new World(),home=w.home;home.active=true;home.enemy=false;home.suppressed=false;
 const other=(id,x,y)=>({id,x,y,type:'dock',active:true,discovered:true,
  enemy:false,suppressed:false,turrets:[]});
 w.stations.set('test:blue',other('test:blue',1400,0));
 w.stations.set('test:green',other('test:green',700,1250));
 for(const [a,b] of [[home.id,'test:blue'],['test:blue','test:green'],['test:green',home.id]])
  assert.ok(connectContour(w,a,b).ok);
 const g={world:w,time:0};
 assert.equal(recordContourFeedback(g,[]),0);
 assert.equal(g.worldFeedback,undefined);
 let delivered=false;
 for(let second=1;second<90;second++){
  const events=advanceContours(w,second,1,[],{x:0,y:0});
  g.time=second;
  recordContourFeedback(g,events);
  if(events.some(e=>e.kind==='delivered')&&g.worldFeedback?.history?.length){delivered=true;break;}
 }
 assert.equal(delivered,true);
 assert.ok(w.contours.flux>0);
 assert.match(g.worldFeedback.history[0].effect,/Добыто .* флюкса: .* в местных хранилищах и .* в казне/);
 const field=contourFields(w)[0];
 g.time+=1;
 const before=JSON.stringify(w.contours);
 assert.equal(recordContourFeedback(g,[{kind:'lost',fieldId:field.id,x:311,y:412}]),1);
 assert.match(g.worldFeedback.history[0].cause,/перехватил плазмофага/);
 assert.deepEqual(g.worldFeedback.history[0].position,{x:311,y:412},
  'the loss marker follows the intercepted collector, not an unrelated vortex');
 assert.equal(JSON.stringify(w.contours),before,
  'the presentation cannot create extra flux or destroy another collector');
});
