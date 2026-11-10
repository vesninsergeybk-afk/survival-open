import test from 'node:test';
import assert from 'node:assert/strict';
import {createContours,connectContour,disconnectContour,contourLinkOffer,contourFields,contourArea,
 contourProduction,advanceContours,fieldAt,validContours,CONTOURS,contourReserveEligible,
 armContourReserve,consumeContourReserve} from '../territory-system.js';

const make=(locations={
 '0:0':[0,0],B:[1600,0],C:[900,1200],D:[2300,1250]
})=>({stations:new Map(Object.entries(locations).map(([id,[x,y]])=>[id,
 {id,x,y,active:true,enemy:false,suppressed:false,type:'dock',turrets:[]}])),contours:createContours()});
const link=(w,a,b)=>assert.equal(connectContour(w,a,b).ok,true,a+'—'+b);
const triangle=()=>{
 const w=make();link(w,'0:0','B');link(w,'B','C');link(w,'C','0:0');return w;
};

test('a triangle requires all three links; a field has real area, centre, and production',()=>{
 const w=make();link(w,'0:0','B');link(w,'B','C');
 assert.equal(contourFields(w).length,0);
 link(w,'C','0:0');const fields=contourFields(w);
 assert.equal(fields.length,1);assert.equal(fields[0].area,960000);
 assert.equal(fieldAt(w,900,400)?.id,fields[0].id);
 assert.equal(fieldAt(w,3000,3000),null);
 assert.ok(contourProduction(fields)>0);
});

test('adding a neighbour enlarges the actual union, not the old triangle',()=>{
 const w=triangle(),original=contourArea(contourFields(w));
 link(w,'B','D');link(w,'D','C');
 const fields=contourFields(w);
 assert.equal(fields.length,2);
 assert.ok(contourArea(fields)>original);
 assert.ok(contourProduction(fields)>contourProduction([fields[0]]));
});

test('a quadrilateral closes without a diagonal and drawing a diagonal creates no new land',()=>{
 const w=make({'0:0':[0,0],B:[1200,0],C:[1200,1200],D:[0,1200]});
 link(w,'0:0','B');link(w,'B','C');link(w,'C','D');link(w,'D','0:0');
 assert.equal(contourFields(w).length,1);assert.equal(contourArea(contourFields(w)),1440000);
 link(w,'0:0','C');
 assert.equal(contourFields(w).length,2);assert.equal(contourArea(contourFields(w)),1440000);
});

test('a line cannot cross, duplicate, or use an enemy or suppressed station',()=>{
 const w=make({'0:0':[0,0],B:[1200,1200],C:[0,1200],D:[1200,0]});
 link(w,'0:0','B');
 assert.match(contourLinkOffer(w,'C','D').reason,/пересекает/);
 assert.match(contourLinkOffer(w,'B','0:0').reason,/уже соединены/);
 w.stations.get('B').suppressed=true;
 assert.match(contourLinkOffer(w,'B','D').reason,/подавлены/);
 w.stations.get('B').suppressed=false;w.stations.get('B').enemy=true;
 assert.match(contourLinkOffer(w,'B','D').reason,/включены/);
});

test('collinear overlapping links are rejected even when they share a station',()=>{
 const w=make({'0:0':[0,0],B:[2000,0]});
 link(w,'0:0','B');
 w.stations.set('C',{id:'C',x:1000,y:0,active:true,enemy:false,suppressed:false,type:'dock',turrets:[]});
 assert.match(contourLinkOffer(w,'0:0','C').reason,/накладывается/);
});

test('suppression removes a field immediately, restoration recreates it without duplicating flux',()=>{
 const w=triangle(),before=contourArea(contourFields(w));
 w.stations.get('B').suppressed=true;
 assert.equal(contourFields(w).length,0);
 w.stations.get('B').suppressed=false;
 assert.equal(contourArea(contourFields(w)),before);
});

test('a mistaken link can be removed and rebuilt; only affected faces disappear',()=>{
 const w=triangle();link(w,'B','D');link(w,'D','C');
 assert.equal(contourFields(w).length,2);
 assert.equal(disconnectContour(w,'B','D'),true);
 assert.equal(contourFields(w).length,1);
 assert.equal(disconnectContour(w,'B','D'),false);
 link(w,'D','B');assert.equal(contourFields(w).length,2);
});

test('redrawing a contour cannot restart the resource shipment clock',()=>{
 const w=make({'0:0':[0,0],B:[1200,0],C:[1200,1200],D:[0,1200]});
 link(w,'0:0','B');link(w,'B','C');link(w,'C','D');link(w,'D','0:0');
 advanceContours(w,10,1);
 const due=w.contours.nextLaunchAt;
 assert.ok(w.contours.harvesters.length>0);
 link(w,'0:0','C');
 advanceContours(w,11,1);
 assert.equal(w.contours.nextLaunchAt,due);
 assert.equal(w.contours.harvesters.length,0);
 advanceContours(w,due,.5);
 assert.equal(w.contours.harvesters.length,2);
});

test('collectors physically travel and deliver uncapped flux; a nearby raid can destroy them',()=>{
 const w=triangle(),player={x:0,y:0};
 let deliveries=0;
 for(let t=1;t<=75;t++)deliveries+=advanceContours(w,t,1,[],player)
  .filter(e=>e.kind==='delivered').length;
 assert.ok(deliveries>0);
 assert.ok(w.contours.flux>0);
 const fields=contourFields(w),field=fields[0];
 w.contours.harvesters=[];w.contours.launches={};
 advanceContours(w,100,1,[],player);
 const enemy={x:field.anchor.x,y:field.anchor.y,hp:100,converted:false};
 const loss=[];
 for(let t=101;t<=105;t+=.5){
  const h=w.contours.harvesters[0];if(!h)break;
  const fraction=h.phase==='out'?Math.min(1,h.progress):h.phase==='back'?1-Math.min(1,h.progress):1;
  enemy.x=field.anchor.x+(field.center.x-field.anchor.x)*fraction;
  enemy.y=field.anchor.y+(field.center.y-field.anchor.y)*fraction;
  loss.push(...advanceContours(w,t,.5,[enemy],player));
 }
 assert.ok(loss.some(e=>e.kind==='lost'));
 assert.ok(loss.filter(e=>e.kind==='lost').every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)),
  'a witnessed collector loss must preserve its exact physical location for feedback');
 assert.ok(w.contours.lost>=1);
});

test('frequent miniature collectors form a visible convoy without multiplying production',()=>{
 const w=triangle(),fields=contourFields(w),expected=contourProduction(fields);
 let simultaneously=0,shipments=0;
 for(let time=1;time<=180;time++){
  shipments+=advanceContours(w,time,1).filter(e=>e.kind==='delivered').length;
  simultaneously=Math.max(simultaneously,w.contours.harvesters.length);
 }
 assert.ok(simultaneously>=2,'two or more little ships should overlap on a normal route');
 assert.ok(shipments>=20,'flux reaches the station in repeated small deliveries');
 assert.ok(Math.abs(w.contours.delivered-expected)/expected<.1,
  'shortening the departure interval must not fabricate more total flux');
 const local=[...w.stations.values()].reduce((sum,s)=>sum+(s.fluxStored||0),0);
 assert.ok(Math.abs(w.contours.delivered-w.contours.flux-local-.24*180/60)<1e-5,
  'the visible convoy credits physical station tanks plus treasury, with no invented flux');
});

test('the field state is saveable and rejects forged resources and broken links',()=>{
 const w=triangle(),rows=[...w.stations];
 assert.equal(validContours(w.contours,rows),true);
 assert.equal(validContours({...w.contours,flux:30000},rows),true,
  'a large, finite stock is legal; the 30-unit gameplay cap is removed');
 assert.equal(validContours({...w.contours,flux:Infinity},rows),false);
 assert.equal(validContours({...w.contours,links:[['missing','B']]},rows),false);
 assert.equal(validContours({...w.contours,links:[['B','C'],['C','B']]},rows),false);
});

test('flux buys one deliberate jamming decoy on a critical contour node, not passive invulnerability',()=>{
 const w=triangle();w.stations.get('B').type='lab';
 w.contours.flux=11;
 assert.equal(contourReserveEligible(w,'B'),true);
 assert.equal(contourReserveEligible(w,'C'),false,'ordinary nodes cannot advertise a useless jamming decoy');
 assert.equal(armContourReserve(w,'C',100).ok,false);
 assert.equal(w.contours.flux,11,'a rejected order cannot consume resources');
 assert.equal(armContourReserve(w,'B',100).ok,true);
 assert.equal(w.contours.flux,11-CONTOURS.reserveCost);
 assert.equal(armContourReserve(w,'B',100).ok,false,'one network holds exactly one decoy');
 assert.equal(consumeContourReserve(w,'B',111.99),false,'a last-second map click cannot defeat an already charged jammer');
 assert.equal(consumeContourReserve(w,'C',112),false,'a decoy cannot protect a different station');
 assert.equal(consumeContourReserve(w,'B',112),true);
 assert.equal(consumeContourReserve(w,'B',114),false,'a reserve is spent exactly once');
 assert.equal(w.contours.flux,5);
 assert.equal(validContours(w.contours,[...w.stations]),true);
});

test('a destroyed reserved station loses its decoy; malformed and forged reserves fail save validation',()=>{
 const w=triangle();w.stations.get('B').type='carrier';w.contours.flux=6;
 assert.equal(armContourReserve(w,'B',3).ok,true);
 const rows=[...w.stations];
 assert.equal(validContours(w.contours,rows),true);
 assert.equal(validContours({...w.contours,reserve:{stationId:'missing',readyAt:15}},rows),false);
 assert.equal(validContours({...w.contours,reserve:{stationId:'B',readyAt:-2}},rows),false);
 assert.equal(validContours({...w.contours,reserve:{stationId:'B',readyAt:NaN}},rows),false);
 assert.equal(validContours({...w.contours,reserve:[]},rows),false);
 w.stations.get('B').enemy=true;
 const events=advanceContours(w,10,1);
 assert.equal(events.filter(e=>e.kind==='reserveLost').length,1);
 assert.equal(w.contours.reserve,null);
 assert.equal(w.contours.flux,0,'losing a station does not mint a refund');
 assert.equal(advanceContours(w,11,1).filter(e=>e.kind==='reserveLost').length,0);
});
