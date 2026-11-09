import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {GUIDE_LESSONS,normalizeGuideState,recommendGuide,masteryFromSnapshot}
 from '../contextual-guide.js';
import {guideSnapshot} from '../contextual-guide-ui.js';

const base=()=>({blocked:false,flightTime:4,distanceMoved:0,mined:false,mining:false,
 battle:false,threatNearby:false,stationCount:1,points:0,upgraded:false,
 hasTerritory:false,pendingContour:false,readyCore:false,contourCompleted:false});
const ready=()=>({enabled:true,seen:[],mastered:[]});

test('first flight points to movement before it suggests extracting ore',()=>{
 const s=base(),progress=ready();
 assert.equal(recommendGuide(s,progress),'flight');
 s.distanceMoved=75;progress.mastered.push('flight');
 assert.equal(recommendGuide(s,progress),'ore');
 s.mined=true;progress.mastered.push('ore');
 assert.equal(recommendGuide(s,progress),'noise');
});

test('a closed or mastered hint does not reappear automatically',()=>{
 const s=base(),progress=ready();
 progress.seen.push('flight');
 assert.equal(recommendGuide(s,progress),null);
 progress.seen.push('ore');s.mined=true;
 assert.equal(recommendGuide(s,progress),'noise');
 progress.mastered.push('noise');
 assert.equal(recommendGuide(s,progress),null);
});

test('hazards prevent calm hints, but allow terse tips for first heavy or swarm encounter',()=>{
 const s=base(),progress=ready();
 s.battle=true;s.threatNearby=true;
 assert.equal(recommendGuide(s,progress),null);
 assert.equal(recommendGuide(s,progress,['heavy']),'heavy');
 assert.equal(recommendGuide(s,progress,['swarm']),'swarm');
 progress.seen.push('heavy');
 assert.equal(recommendGuide(s,progress,['heavy','swarm']),'swarm');
 s.blocked=true;
 assert.equal(recommendGuide(s,progress,['heavy','swarm']),null);
});

test('preparation is advice before the first contour; vortex requires its own step',()=>{
 const s=base(),progress=ready();
 progress.seen.push('flight','ore','noise','upgrade');
 s.stationCount=2;s.flightTime=200;
 assert.equal(recommendGuide(s,progress),'prepare');
 s.hasTerritory=true;s.pendingContour=true;progress.mastered.push('prepare');
 assert.equal(recommendGuide(s,progress),'contour');
 s.readyCore=true;progress.mastered.push('contour');
 assert.equal(recommendGuide(s,progress),'core');
 s.contourCompleted=true;
 assert.equal(masteryFromSnapshot(s).core,true);
});

test('dismissed lessons, bad storage and disabled tutorial fail safely',()=>{
 const s=base(),progress=normalizeGuideState({enabled:false,seen:['flight','nonsense','flight'],
  mastered:'bad'});
 assert.deepEqual(progress,{enabled:false,seen:['flight'],mastered:[]});
 assert.equal(recommendGuide(s,progress),null);
});

test('combat lessons wait until the enemy comes within the pilot encounter range',()=>{
 const game={time:180,player:{x:0,y:0,points:0},enemies:[
  {x:1600,y:0,hp:100,type:'gunship'},
  ...[1,2,3].map(i=>({x:1550+i*10,y:0,hp:10,microSwarm:true}))],
  world:{stations:new Map(),contours:{trials:{entries:[]}}},mining:{active:false}};
 const snapshot=()=>guideSnapshot(game,{x:0,y:0});
 assert.equal(snapshot().heavyNearby,false);
 assert.equal(snapshot().swarmNearby,false);
 game.enemies[0].x=700;
 for(let i=1;i<=3;i++)game.enemies[i].x=610;
 assert.equal(snapshot().heavyNearby,true);
 assert.equal(snapshot().swarmNearby,true);
 game.enemies[0].hp=0;
 game.enemies[2].converted=true;
 assert.equal(snapshot().heavyNearby,false);
 assert.equal(snapshot().swarmNearby,false);
});

test('training labels, menus and vector assets are present without a second game',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/id="settings-tab-learning"/);
 assert.match(html,/id="learningTip"/);
 assert.match(html,/contextual-guide\.css/);
 assert.equal(GUIDE_LESSONS.length,9);
 for(const item of GUIDE_LESSONS){
  assert.ok(existsSync(new URL(`../assets/learning/${item.icon}.svg`,import.meta.url)));
  assert.ok(item.body.length>45);
 }
});
