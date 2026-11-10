import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoadout,cloneLoadout,moduleStats,HangarSession} from '../ship-loadout.js';
import {WEAPON_SPECIALIZATIONS,quoteSpecialization,applySpecialization,
 plasmaDamageFactor,weaponDamageFactor,penetrationFactor,rocketFlight,
 specializationRequirements,howitzerProfile}
 from '../weapon-specializations.js';

const context=(extra={})=>({baseActive:true,level:14,activeBases:3,points:6,ore:180,...extra});

test('automatic families and the heavy howitzer each have two exclusive branches',()=>{
 assert.deepEqual(Object.keys(WEAPON_SPECIALIZATIONS),['plasma','rail','flak','rocket','howitzer']);
 for(const alternatives of Object.values(WEAPON_SPECIALIZATIONS))
  assert.equal(Object.keys(alternatives).length,2);
});

test('late howitzer branches require their own levels and stations, without changing early weapon gates',()=>{
 const ship=createLoadout();ship.slots[5]='howitzer';
 assert.deepEqual(specializationRequirements('plasma',1),{level:7,bases:2});
 assert.deepEqual(specializationRequirements('howitzer',1),{level:14,bases:3});
 assert.deepEqual(specializationRequirements('howitzer',2),{level:18,bases:4});
 assert.match(quoteSpecialization(ship,'howitzer','cluster',context({level:13})).reason,/уровень 14/);
 assert.match(quoteSpecialization(ship,'howitzer','cluster',context({activeBases:2})).reason,/3 станции/);
 const chosen=applySpecialization(ship,'howitzer','cluster',context());
 assert.equal(chosen.ok,true);
 assert.match(quoteSpecialization(chosen.loadout,'howitzer','piercing',context()).reason,/уже выбрана/);
 assert.match(quoteSpecialization(chosen.loadout,'howitzer','cluster',context({level:17,activeBases:4})).reason,/уровень 18/);
 assert.match(quoteSpecialization(chosen.loadout,'howitzer','cluster',context({level:18,activeBases:3})).reason,/4 станции/);
 const mastered=applySpecialization(chosen.loadout,'howitzer','cluster',context({level:18,activeBases:4}));
 assert.equal(mastered.ok,true);
 assert.deepEqual(mastered.loadout.specializations.howitzer,{path:'cluster',rank:2});
 assert.equal(moduleStats('howitzer',{},mastered.loadout.specializations.howitzer).targets,'радиус 180 м');
 assert.equal(howitzerProfile(mastered.loadout).charge,1.65);
});

test('specialization requires equipped weapon, stations, level and one development point',()=>{
 const ship=createLoadout();
 const baseline=context();
 assert.match(quoteSpecialization(ship,'rail','breaker',baseline).reason,/установите/);
 assert.match(quoteSpecialization(ship,'plasma','furnace',context({baseActive:false})).reason,/станция/);
 assert.match(quoteSpecialization(ship,'plasma','furnace',context({level:6})).reason,/уровень 7/);
 assert.match(quoteSpecialization(ship,'plasma','furnace',context({activeBases:1})).reason,/2 станции/);
 assert.match(quoteSpecialization(ship,'plasma','furnace',context({points:0})).reason,/очко/);
 assert.equal(quoteSpecialization(ship,'plasma','invalid',baseline).ok,false);
});

test('one family cannot freely switch branches; mastery requires later progression',()=>{
 const ship=createLoadout(),initial=applySpecialization(ship,'plasma','furnace',context());
 assert.equal(initial.ok,true);
 assert.equal(initial.points,5);
 assert.equal(initial.ore,180);
 assert.equal(ship.specializations.plasma,undefined,'base value is immutable');
 assert.deepEqual(initial.loadout.specializations.plasma,{path:'furnace',rank:1});
 assert.equal(quoteSpecialization(initial.loadout,'plasma','focus',context()).ok,false);
 assert.match(quoteSpecialization(initial.loadout,'plasma','furnace',context({level:10})).reason,/уровень 11/);
 assert.match(quoteSpecialization(initial.loadout,'plasma','furnace',context({activeBases:2})).reason,/3 станции/);
 const mastered=applySpecialization(initial.loadout,'plasma','furnace',context());
 assert.deepEqual(mastered.loadout.specializations.plasma,{path:'furnace',rank:2});
 assert.equal(quoteSpecialization(mastered.loadout,'plasma','furnace',context()).ok,false);
 assert.deepEqual(cloneLoadout(mastered.loadout).specializations,mastered.loadout.specializations);
});

test('near and far plasma paths have distinct distance profiles',()=>{
 const furnace={path:'furnace',rank:1},focus={path:'focus',rank:1};
 assert.equal(plasmaDamageFactor(furnace,100,435),1.25);
 assert.equal(plasmaDamageFactor(furnace,300,435),1);
 assert.equal(plasmaDamageFactor(focus,100,435),1);
 assert.ok(Math.abs(plasmaDamageFactor(focus,435,435)*.28-.48)<1e-9);
 assert.equal(plasmaDamageFactor({...furnace,rank:2},100,435),1.45);
 assert.ok(Math.abs(plasmaDamageFactor({...focus,rank:2},435,435)*.28-.60)<1e-9);
});

test('flak chooses between wider weaker bursts and extra anti-scout damage',()=>{
 assert.deepEqual([moduleStats('flak').damage,moduleStats('flak').targets],[14,3]);
 assert.deepEqual([moduleStats('flak',{}, {path:'sweep',rank:1}).damage,
  moduleStats('flak',{}, {path:'sweep',rank:1}).targets],[11,4]);
 assert.equal(moduleStats('flak',{}, {path:'sweep',rank:2}).targets,5);
 const interceptor={specializations:{flak:{path:'interceptor',rank:2}}};
 assert.equal(weaponDamageFactor(interceptor,'flak',{type:'flanker'}),1.5);
 assert.equal(weaponDamageFactor(interceptor,'flak',{type:'gunship'}),1);
});

test('rail and rocket branches each create different tactical strengths',()=>{
 const railBreak={specializations:{rail:{path:'breaker',rank:1}}};
 const railPen={specializations:{rail:{path:'penetrator',rank:1}}};
 assert.equal(weaponDamageFactor(railBreak,'rail',{type:'gunship'}),1.25);
 assert.equal(weaponDamageFactor(railBreak,'rail',{type:'scout'}),1);
 assert.equal(penetrationFactor(railBreak),0);
 assert.equal(penetrationFactor(railPen),.65);
 assert.equal(penetrationFactor({specializations:{rail:{path:'penetrator',rank:2}}}),.85);
 assert.deepEqual(rocketFlight(createLoadout()),{speed:540,life:2.3});
 assert.deepEqual(rocketFlight({specializations:{rocket:{path:'seeker',rank:1}}}),{speed:620,life:2.65});
 assert.deepEqual(rocketFlight({specializations:{rocket:{path:'seeker',rank:2}}}),{speed:720,life:3});
 assert.equal(weaponDamageFactor({specializations:{rocket:{path:'payload',rank:1}}},
  'rocket',{type:'gunship'}),1.25);
});

test('hangar applies specialization without discarding an unrelated unfinished fitting draft',()=>{
 const ship=createLoadout(),session=new HangarSession();session.begin(ship);
 session.draft.slots[1]='rail';
 const result=session.dispatch({act:'hgSpec',id:'plasma:furnace'},{...context(),loadout:ship});
 assert.equal(result.ok,true);assert.equal(result.type,'specialization');
 assert.equal(result.points,5);
 assert.equal(session.draft.slots[1],'rail');
 assert.equal(ship.specializations.plasma,undefined);
 assert.equal(result.loadout.slots[1],null);
});
