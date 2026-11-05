import test from 'node:test';
import assert from 'node:assert/strict';
import {createStrategicExperience,inheritStrategicExperience,STRATEGIC_XP,
 claimStationActivation,claimStationCapture,claimExploration,claimContourExpansion,
 claimFirstFluxDelivery,claimGeologicalSurvey,claimStrategicSabotage,
 validStrategicExperience} from '../strategic-experience.js';
import {createContours,connectContour,disconnectContour,contourFields,contourArea,advanceContours} from '../territory-system.js';

const pilot=()=>({level:1,xp:0,points:0,strategicXp:createStrategicExperience()});
const base=(id,extra={})=>({id,active:true,enemy:false,discovered:true,captured:false,...extra});

test('station XP is paid once, with an extra strategic-capture premium and fixed caps',()=>{
 const p=pilot(),station=base('1:0');
 assert.equal(claimStationActivation(p,base('0:0')),0,'the free home dock is not an activation milestone');
 assert.equal(claimStationActivation(p,station),STRATEGIC_XP.activation);
 assert.equal(claimStationActivation(p,station),0);
 station.active=false;assert.equal(claimStationActivation(p,station),0);
 const enemy=base('2:0',{captured:true,strategicRole:'mine'});
 assert.equal(claimStationCapture(p,enemy),STRATEGIC_XP.strategicCapture);
 assert.equal(claimStationCapture(p,enemy),0);
 assert.equal(claimStationCapture(p,base('3:0')),0);
 assert.equal(claimStationCapture(p,base('3:0',{captured:true})),STRATEGIC_XP.capture);
 for(let i=0;i<30;i++)claimStationActivation(p,base((i+10)+':0'));
 assert.equal(p.strategicXp.activations.length,STRATEGIC_XP.maxActivations);
 assert.equal(claimStationActivation(p,base('500:0')),0);
});

test('exploration is finite, excludes home and cannot pay twice for a discovered site',()=>{
 const p=pilot();
 assert.equal(claimExploration(p,base('0:0')),0);
 assert.equal(claimExploration(p,base('1:0',{discovered:false})),0);
 assert.equal(claimExploration(p,base('1:0')),STRATEGIC_XP.exploration);
 assert.equal(claimExploration(p,base('1:0')),0);
 assert.equal(claimExploration(p,base('2:0'),1),STRATEGIC_XP.exploration+STRATEGIC_XP.radarBonus);
 assert.equal(claimExploration(p,base('3:0'),2),STRATEGIC_XP.exploration+2*STRATEGIC_XP.radarBonus);
 for(let i=2;i<80;i++)claimExploration(p,base(i+':0'));
 assert.equal(p.strategicXp.exploration.length,STRATEGIC_XP.maxExploration);
 assert.equal(claimExploration(p,base('100:0')),0);
});

test('a triangle and new participating stations earn XP once; redrawing lines yields none',()=>{
 const p=pilot(),triangle=[{vertices:['0:0','1:0','0:1']}];
 const first=STRATEGIC_XP.firstContour+STRATEGIC_XP.contourStation*3;
 assert.equal(claimContourExpansion(p,triangle,250000),first);
 assert.equal(claimContourExpansion(p,triangle,250000),0);
 assert.equal(claimContourExpansion(p,[{vertices:['0:0','1:0','0:1','1:1']}],0),0);
 assert.equal(claimContourExpansion(p,[{vertices:['0:0','1:0','0:1','1:1']}],100000),
  STRATEGIC_XP.contourStation);
 assert.equal(claimContourExpansion(p,[{vertices:['0:0','1:0','0:1','1:1']}],100000),0);
 assert.equal(claimContourExpansion(p,triangle,-1000),0);
});

test('real contour geometry, reconnection and collector deliveries cannot multiply level rewards',()=>{
 const world={stations:new Map([['0:0',[0,0]],['1:0',[1500,0]],['0:1',[850,1100]]]
  .map(([id,[x,y]])=>[id,{id,x,y,active:true,enemy:false,suppressed:false}])),contours:createContours()};
 const p=pilot();
 assert.ok(connectContour(world,'0:0','1:0').ok);
 assert.ok(connectContour(world,'1:0','0:1').ok);
 assert.equal(claimContourExpansion(p,contourFields(world),0),0);
 assert.ok(connectContour(world,'0:1','0:0').ok);
 const fields=contourFields(world),area=contourArea(fields);
 assert.ok(area>0);
 assert.equal(claimContourExpansion(p,fields,area),
  STRATEGIC_XP.firstContour+3*STRATEGIC_XP.contourStation);
 let firstDelivery=0,delivered=0;
 for(let t=1;t<100;t++)for(const event of advanceContours(world,t,1,[],{x:0,y:0}))
  if(event.kind==='delivered'){
   delivered++;
   firstDelivery+=claimFirstFluxDelivery(p,event.amount);
  }
 assert.ok(delivered>=1);assert.equal(firstDelivery,STRATEGIC_XP.firstDelivery);
 assert.ok(disconnectContour(world,'1:0','0:1'));
 assert.ok(connectContour(world,'1:0','0:1').ok);
 assert.equal(claimContourExpansion(p,contourFields(world),area),0);
 assert.equal(claimFirstFluxDelivery(p,1),0);
});

test('only a real first flux delivery produces a one-time XP bonus',()=>{
 const p=pilot();
 assert.equal(claimFirstFluxDelivery(p,0),0);
 assert.equal(claimFirstFluxDelivery(p,Infinity),0);
 assert.equal(claimFirstFluxDelivery(p,1.8),STRATEGIC_XP.firstDelivery);
 assert.equal(claimFirstFluxDelivery(p,1.9),0);
});

test('geological surveys need rare rocks and different distant sites; automatic destruction never counts',()=>{
 const p=pilot(),rock=(id,x)=>({id,rich:true,originX:x,originY:0,x,y:0});
 assert.equal(claimGeologicalSurvey(p,rock('0:0/1',0),'auto'),0);
 assert.equal(claimGeologicalSurvey(p,{...rock('0:0/1',0),rich:false},'extract'),0);
 assert.equal(claimGeologicalSurvey(p,rock('0:0/1',0),'extract'),0,'first sample already pays 18 via geology discovery');
 assert.equal(claimGeologicalSurvey(p,rock('0:0/1',0),'extract'),0);
 assert.equal(claimGeologicalSurvey(p,rock('0:0/2',600),'extract'),0,'same area cannot be farmed');
 assert.equal(claimGeologicalSurvey(p,rock('2:0/0',930),'extract'),STRATEGIC_XP.survey);
 assert.equal(claimGeologicalSurvey(p,rock('5:0/0',2000),'extract',2),
  STRATEGIC_XP.survey+2*STRATEGIC_XP.miningBonus);
 for(let i=2;i<12;i++)claimGeologicalSurvey(p,rock((i*3)+':0/0',i*1100),'extract');
 assert.equal(p.strategicXp.surveys.length,STRATEGIC_XP.maxSurveys);
 assert.equal(claimGeologicalSurvey(p,rock('100:0/0',30000),'extract'),0);
});

test('a legacy pilot who already found the first rich rock earns XP for the next new survey',()=>{
 const p={...pilot(),firstRichRockStudied:true},rock={id:'4:0/1',rich:true,
  originX:4000,originY:0,x:4000,y:0};
 assert.equal(claimGeologicalSurvey(p,rock,'extract',2),
  STRATEGIC_XP.survey+2*STRATEGIC_XP.miningBonus);
 assert.equal(claimGeologicalSurvey(p,rock,'extract',2),0);
 assert.equal(claimGeologicalSurvey(p,{...rock,id:'4:0/2',originX:4200},'extract',2),0);
});

test('strategic sabotage counts completed distinct routes, not repeated operations',()=>{
 const p=pilot();
 assert.equal(claimStrategicSabotage(p,'hack','0:0'),0);
 assert.equal(claimStrategicSabotage(p,'corridor','0:0'),STRATEGIC_XP.sabotage);
 assert.equal(claimStrategicSabotage(p,'corridor','0:0'),0);
 assert.equal(claimStrategicSabotage(p,'carrier','0:0'),STRATEGIC_XP.sabotage);
 assert.equal(claimStrategicSabotage(p,'carrier','0:0'),0);
});

test('old-save backfill protects already owned stations, old contours and past diversions',()=>{
 const home=base('0:0',{corridorSecured:true}),st=base('1:0',{captured:true,supplyIntercepted:true});
 const world={stations:new Map([[home.id,home],[st.id,st]]),discovered:new Set([home.id,st.id]),
  contours:{links:[],delivered:3,launches:{old:25}}};
 const p={level:4,xp:51,points:2};
 inheritStrategicExperience(p,world);
 assert.equal(p.level,4);assert.equal(p.xp,51);assert.equal(p.points,2);
 assert.equal(claimStationActivation(p,st),0);
 assert.equal(claimStationCapture(p,st),0);
 assert.equal(claimExploration(p,st),0);
 assert.equal(claimFirstFluxDelivery(p,5),0);
 assert.equal(claimStrategicSabotage(p,'carrier',st.id),0);
 assert.equal(claimStrategicSabotage(p,'corridor',home.id),0);
 assert.equal(p.strategicXp.firstContour,true);
 assert.equal(validStrategicExperience(p.strategicXp,[...world.stations]),true);
 assert.strictEqual(inheritStrategicExperience(p,world),p.strategicXp);
});

test('legacy home station never consumes the finite exploration and activation XP budgets',()=>{
 const home=base('0:0'),sites=Array.from({length:19},(_,i)=>
  base((i+1)+':0',{active:i<15,discovered:i<17}));
 const world={stations:new Map([home,...sites].map(site=>[site.id,site])),
  discovered:new Set([home.id,...sites.slice(0,17).map(site=>site.id)]),
  contours:createContours()};
 const p={level:3,xp:17,points:2};
 inheritStrategicExperience(p,world);
 assert.equal(p.strategicXp.activations.length,15);
 assert.equal(p.strategicXp.exploration.length,17);
 assert.equal(p.strategicXp.activations.includes(home.id),false);
 assert.equal(p.strategicXp.exploration.includes(home.id),false);
 sites[17].active=true;sites[17].discovered=true;
 assert.equal(claimStationActivation(p,sites[17]),STRATEGIC_XP.activation);
 assert.equal(claimExploration(p,sites[17]),STRATEGIC_XP.exploration);
 sites[18].active=true;sites[18].discovered=true;
 assert.equal(claimStationActivation(p,sites[18]),0);
 assert.equal(claimExploration(p,sites[18]),0);
 assert.equal(validStrategicExperience(p.strategicXp,[...world.stations]),true);
 assert.equal(p.level,3);assert.equal(p.xp,17);assert.equal(p.points,2);
});

test('already migrated saves with a home dock in the paid arrays recover one slot',()=>{
 const p=pilot(),home=base('0:0'),next=base('19:0');
 p.level=4;p.xp=33;
 p.strategicXp.activations=[home.id,...Array.from({length:15},(_,i)=>(i+1)+':0')];
 p.strategicXp.exploration=[home.id,...Array.from({length:17},(_,i)=>(i+1)+':0')];
 const ledger=inheritStrategicExperience(p,{stations:new Map(),discovered:new Set(),contours:createContours()});
 assert.equal(ledger.activations.length,15);
 assert.equal(ledger.exploration.length,17);
 assert.equal(claimStationActivation(p,base('16:0')),STRATEGIC_XP.activation);
 assert.equal(claimExploration(p,base('18:0')),STRATEGIC_XP.exploration);
 assert.equal(claimStationActivation(p,next),0);
 assert.equal(claimExploration(p,next),0);
 assert.equal(p.level,4);assert.equal(p.xp,33);
});

test('tampered, duplicate or oversized strategic XP ledgers are invalid',()=>{
 const p=pilot(),stations=[['0:0',base('0:0')],['1:0',base('1:0')]];
 assert.equal(validStrategicExperience(p.strategicXp,stations),true);
 p.strategicXp.activations=['1:0','1:0'];
 assert.equal(validStrategicExperience(p.strategicXp,stations),false);
 p.strategicXp.activations=['fake'];
 assert.equal(validStrategicExperience(p.strategicXp,stations),false);
 p.strategicXp.activations=[];p.strategicXp.surveys=[{id:'rock',x:Infinity,y:5}];
 assert.equal(validStrategicExperience(p.strategicXp,stations),false);
 p.strategicXp.surveys=[];p.strategicXp.sabotages=['corridor:absent'];
 assert.equal(validStrategicExperience(p.strategicXp,stations),false);
});
