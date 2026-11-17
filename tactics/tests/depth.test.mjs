import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FIELD,ROLES,createMission,resolveTurn,nextMission,aliveAllies,aliveEnemies,forecastTurn,canRelay,coverBetween,hackNeed,nextReinforcement} from '../rules.js';

const order=(s,action='hack',targetId=null,formation='escort',destination=s.player)=>
 ({action,targetId,formation,destination:{x:destination.x,y:destination.y}});
const singleScout=()=>{
 const s=createMission(0,1729),enemy=s.ships.find(u=>u.role==='scout');
 s.ships=[enemy];s.player.x=enemy.x-155;s.player.y=enemy.y;s.asteroids=[];
 return {s,enemy};
};
test('forecast uses actual post-movement enemy positions and accurately predicts incoming damage',()=>{
 const {s}=singleScout();
 const expected=forecastTurn(s,order(s,'hack'));
 const actual=resolveTurn(s,order(s,'hack'));
 assert.ok(expected.shots.length>0,'initial enemy volley must be predictable');
 assert.equal(s.player.hp-actual.player.hp,expected.incoming);
 assert.ok(expected.shots.every(x=>x.amount>0));
});
test('a real asteroid between ships provides cover and reduces damage',()=>{
 const {s,enemy}=singleScout();
 const open=resolveTurn(s,order(s));
 const covered=structuredClone(s);
 covered.asteroids=[{x:(covered.player.x+enemy.x)/2,y:enemy.y,r:55}];
 assert.equal(coverBetween(covered,covered.player,enemy),true);
 assert.ok(forecastTurn(covered,order(covered)).hasCover);
 const after=resolveTurn(covered,order(covered));
 assert.ok(after.player.hp>open.player.hp);
});
test('boost moves farther and mitigates incoming shots at the cost of combat action',()=>{
 const {s,enemy}=singleScout();
 s.player.x=enemy.x-260;
 const to={x:enemy.x+240,y:enemy.y};
 const slow=forecastTurn(s,order(s,'hack',null,'escort',to));
 const fast=forecastTurn(s,order(s,'boost',null,'escort',to));
 assert.ok(fast.position.x>slow.position.x);
 assert.ok(fast.position.x-s.player.x<=FIELD.boostStep);
 const a=resolveTurn(s,order(s,'boost',null,'escort',to));
 assert.equal(a.player.x,fast.position.x);
 assert.equal(a.lastPlan.action,'boost');
});
test('pulse consumes scarce energy, cancels current volley and suppresses the next one',()=>{
 const {s}=singleScout();s.player.charge=1;
 const before=forecastTurn(s,order(s,'hack'));
 const preview=forecastTurn(s,order(s,'pulse'));
 assert.ok(before.incoming>0);
 assert.equal(preview.incoming,0);
 const after=resolveTurn(s,order(s,'pulse'));
 assert.equal(after.player.charge,0);
 assert.equal(after.player.hp,s.player.hp);
 assert.ok(after.ships[0].suppressed>0);
});
test('relay doctrine accelerates hacking but sacrifices automatic allied gunfire',()=>{
 const {s,enemy}=singleScout();
 s.player.x=enemy.x-100;
 s.ships.push({id:'captured-scout',role:'scout',side:'ally',x:enemy.x-70,y:enemy.y+20,hp:40,maxHp:40,hack:0,suppressed:0});
 const escort=resolveTurn(s,order(s,'hack',enemy.id,'escort'));
 const relay=resolveTurn(s,order(s,'hack',enemy.id,'relay'));
 assert.equal(escort.ships.find(u=>u.id===enemy.id).hack,1);
 assert.equal(aliveAllies(relay).length,2,'relay-assisted scout should be captured in one turn');
 assert.equal(relay.events.filter(x=>x.kind==='shot'&&x.weapon==='ally').length,0);
});
test('several allies keep distinct tactical positions',()=>{
 const s=createMission(1,1729,{player:{hp:75,charge:1},ships:[
  {id:'a',role:'scout',side:'ally',x:20,y:20,hp:40},
  {id:'b',role:'fighter',side:'ally',x:30,y:30,hp:60}
 ],networkSlots:0});
 const moved=resolveTurn(s,order(s));
 const allies=aliveAllies(moved);
 assert.equal(allies.length,2);
 assert.ok(Math.hypot(allies[0].x-allies[1].x,allies[0].y-allies[1].y)>10);
});
test('enemy jammer blocks remote relay and increases hack burden while active',()=>{
 const s=createMission(1,1729),station=s.stations[0],jammer=s.ships.find(u=>u.role==='jammer');
 s.player.x=station.x-350;s.player.y=station.y;
 s.ships=[jammer,{id:'friendly',role:'scout',side:'ally',x:station.x-100,y:station.y,hp:40,maxHp:40,hack:0}];
 assert.equal(canRelay(s,station).jammed,true);
 assert.equal(hackNeed(s,station),4);
 jammer.suppressed=1;
 assert.equal(canRelay(s,station).ok,true);
 assert.equal(hackNeed(s,station),3);
});
test('finite reinforcements are announced, generated only on schedule and never duplicate',()=>{
 let s=createMission(1,1729);s.ships=[];s.player.hp=10000;s.player.maxHp=10000;
 assert.equal(nextReinforcement(s).turn,6);
 for(let i=0;i<12;i++)s=resolveTurn(s,order(s));
 assert.equal(s.turn,12);
 assert.equal(s.ships.filter(u=>u.id.startsWith('reserve-')).length,2);
 assert.equal(nextReinforcement(s),null);
});
test('mission transition retains damaged hull and checkpoint restores initial resources',()=>{
 const s=createMission(0,1729);s.player.hp=19;s.player.charge=0;s.phase='won';
 s.ships=s.ships.slice(0,2).map(u=>({...u,side:'ally'}));
 const n=nextMission(s);
 assert.equal(n.player.hp,43);
 assert.equal(n.player.charge,1);
 assert.equal(aliveAllies(n).length,2);
 assert.deepEqual(createMission(n.mission,n.seed,n.entry),n);
});
test('UI offers all actions and a readable risk forecast on phones and computers',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 for(const id of ['order-hack','order-shot','order-boost','order-pulse','formation-escort','formation-strike','formation-relay','forecast-damage','reserve-warning','pulse-charge'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(js.includes('forecastTurn'));
 assert.ok(html.includes('href="../arcade/"'));
});
