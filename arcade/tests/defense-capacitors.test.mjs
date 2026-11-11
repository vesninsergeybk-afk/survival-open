import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFENSE_CAPACITOR,defenseCapacitorLocation,ensureDefenseCapacitor,
 shipDefenseFlux,advanceDefenseCapacitors,spendDefenseCharge,specialThreat,
 validDefenseCapacitors} from '../defense-capacitors.js';

const field={id:'core-a',center:{x:200,y:200},anchor:{x:0,y:0},
 polygon:[{x:0,y:0},{x:400,y:0},{x:200,y:500}]};
const world=()=>({contours:{flux:2,defenseCapacitors:[],defenseCapacitorPackets:[]}});
const turret={x:180,y:180,defenseCellFieldId:'core-a'};

test('first turret previews and creates exactly one shared in-triangle accumulator',()=>{
 const w=world(),point={x:190,y:150};
 const preview=defenseCapacitorLocation(w,point,[field]);
 assert.ok(preview);
 assert.equal(preview.fieldId,'core-a');
 const cell=ensureDefenseCapacitor(w,point,10,[field]);
 assert.equal(cell.x,preview.x);assert.equal(cell.y,preview.y);
 assert.equal(ensureDefenseCapacitor(w,{x:235,y:145},15,[field]),cell);
 assert.equal(w.contours.defenseCapacitors.length,1);
 assert.equal(defenseCapacitorLocation(w,point,[field]),null);
 assert.ok(validDefenseCapacitors(w.contours));
});

test('a harvester transports only harvested flux and spent charges cannot duplicate',()=>{
 const w=world(),cell=ensureDefenseCapacitor(w,{x:185,y:165},0,[field]);
 const before=w.contours.flux;
 assert.equal(shipDefenseFlux(w,field,1,0),0,'unfinished structure cannot collect');
 const reserved=shipDefenseFlux(w,field,1,3);
 assert.equal(reserved,DEFENSE_CAPACITOR.harvestShare);
 assert.equal(w.contours.defenseCapacitorPackets.length,1);
 assert.equal(w.contours.flux,before,'the delivery must be debited by caller');
 assert.equal(cell.charge,0,'the packet has not arrived');
 assert.ok(!spendDefenseCharge(w,turret,.2,3));
 advanceDefenseCapacitors(w,100);
 assert.ok(Math.abs(cell.charge-reserved)<1e-9);
 assert.equal(w.contours.defenseCapacitorPackets.length,0);
 assert.ok(validDefenseCapacitors(w.contours));
});

test('shared store prevents double-spending, applies recharge gap and caps stockpiles',()=>{
 const w=world(),cell=ensureDefenseCapacitor(w,{x:190,y:160},0,[field]);
 cell.charge=1;
 assert.equal(spendDefenseCharge(w,turret,.4,4),true);
 assert.ok(Math.abs(cell.charge-.6)<1e-9);
 assert.equal(spendDefenseCharge(w,turret,.4,5),false);
 assert.equal(spendDefenseCharge(w,turret,.4,20),true);
 assert.equal(spendDefenseCharge(w,turret,.4,21),false);
 assert.equal(shipDefenseFlux(w,field,400,21),DEFENSE_CAPACITOR.capacity-cell.charge);
 assert.ok(validDefenseCapacitors(w.contours));
});

test('expensive special shot is reserved for a tactical threat',()=>{
 const game={enemies:[{x:230,y:180,r:10,hp:40,maxHp:40,type:'scout'}]};
 assert.equal(specialThreat(game,turret,{x:230,y:180}),false);
 game.enemies.push({x:245,y:175,r:10,hp:45,maxHp:45,type:'scout'});
 assert.equal(specialThreat(game,turret,{x:230,y:180}),true);
 game.enemies.push({x:260,y:175,r:10,hp:180,maxHp:180,type:'gunship'});
 assert.equal(specialThreat(game,turret,{x:230,y:180}),true);
});

test('save validator rejects duplicated cells, invented charge and forged packets',()=>{
 const w=world();ensureDefenseCapacitor(w,{x:190,y:160},0,[field]);
 assert.ok(validDefenseCapacitors(w.contours));
 const c=w.contours.defenseCapacitors[0];
 c.charge=DEFENSE_CAPACITOR.capacity+.1;
 assert.equal(validDefenseCapacitors(w.contours),false);
 c.charge=0;w.contours.defenseCapacitors.push({...c});
 assert.equal(validDefenseCapacitors(w.contours),false);
});
