import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ION_CONDUCTOR,ionLoanOffer,createIonLoan,markIonCluster,planIonDischarge}
 from '../ion-conductor.js';

const home={id:'0:0',type:'dock',active:true};
const arsenal={id:'1:0',type:'arsenal',active:true};
const enemy=(x,y,hp=80)=>({x,y,hp,converted:false});

test('first home dock lends one free three-charge trial, then only an arsenal can rent',()=>{
 const offer=ionLoanOffer(home,{ore:0,ionTrialTaken:false,ionLoan:null});
 assert.equal(offer.mode,'trial');
 assert.equal(offer.cost,0);
 assert.equal(offer.charges,3);
 assert.equal(ionLoanOffer(home,{ore:0,ionTrialTaken:true,ionLoan:null}),null);
 const paid=ionLoanOffer(arsenal,{ore:40,ionTrialTaken:true,ionLoan:null});
 assert.equal(paid.mode,'rent');
 assert.equal(paid.cost,ION_CONDUCTOR.rentalCost);
 assert.equal(paid.reason,'');
 assert.match(ionLoanOffer(arsenal,{ore:0}).reason,/Не хватает/);
 assert.equal(ionLoanOffer({...arsenal,active:false},{ore:40}),null);
});

test('only one loan can be equipped; any active station accepts its return',()=>{
 const loan=createIonLoan(home.id,10);
 assert.equal(loan.sourceId,home.id);
 assert.equal(loan.charges,ION_CONDUCTOR.charges);
 assert.equal(loan.used,0);
 assert.equal(ionLoanOffer(arsenal,{ionLoan:loan,ore:999}).mode,'return');
 assert.equal(ionLoanOffer(home,{ionLoan:loan,ionTrialTaken:true}).mode,'return');
 assert.equal(ionLoanOffer({...home,active:false},{ionLoan:loan}),null);
});

test('automatic beam marks live nearby enemies, never cargo or captured allies',()=>{
 const a=enemy(100,0),b=enemy(210,0),far=enemy(600,0),
  converted={...enemy(200,0),converted:true},cargo={...enemy(140,0),interceptCargo:true};
 const list=[a,b,far,converted,cargo];
 assert.deepEqual(markIonCluster(list,a,10,null),[]);
 const loan=createIonLoan('0:0');
 const marked=markIonCluster(list,a,10,loan);
 assert.deepEqual(marked,[a,b]);
 assert.equal(a.ionMarkUntil,15);
 assert.equal(b.ionMarkUntil,15);
 assert.equal(far.ionMarkUntil,undefined);
 assert.equal(converted.ionMarkUntil,undefined);
 assert.equal(cargo.ionMarkUntil,undefined);
 loan.charges=0;
 assert.equal(markIonCluster(list,a,11,loan).length,0);
});

test('Space discharge chains to nearby marks, not enemies across the sector',()=>{
 const p={x:0,y:0};
 const a={...enemy(140,0),ionMarkUntil:10};
 const b={...enemy(325,0),ionMarkUntil:10};
 const c={...enemy(460,0),ionMarkUntil:10};
 const d={...enemy(0,480),ionMarkUntil:10};
 const loan=createIonLoan('0:0');
 const plan=planIonDischarge([d,c,b,a],p,5,loan);
 assert.equal(plan.ok,true);
 assert.deepEqual(plan.targets,[a,b,c]);
 assert.deepEqual(plan.damage,[24,18,14]);
 assert.equal(plan.chargesAfter,2);
 assert.equal(plan.cooldownUntil,9.5);
 assert.equal(loan.charges,3,'planning alone does not consume ammo');
});

test('discharge is predictable with one mark and never wastes a charge on no target',()=>{
 const p={x:0,y:0},loan=createIonLoan('0:0');
 assert.equal(planIonDischarge([],p,0,loan).ok,false);
 assert.equal(loan.charges,3);
 const solo={...enemy(120,0),ionMarkUntil:8};
 const r=planIonDischarge([solo],p,4,loan);
 assert.equal(r.ok,true);
 assert.deepEqual(r.targets,[solo]);
 assert.deepEqual(r.damage,[24]);
 assert.equal(r.chargesAfter,2);
 assert.equal(planIonDischarge([solo],p,9,loan).ok,false,'expired mark');
 loan.charges=0;
 assert.match(planIonDischarge([solo],p,4,loan).reason,/закончились/i);
 loan.charges=1;loan.cooldownUntil=7;
 assert.match(planIonDischarge([solo],p,5,loan).reason,/заряжается/i);
});

test('desktop and touch input share one manual action; repair and mining remain separate',()=>{
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const panel=readFileSync(new URL('../base-panel.js',import.meta.url),'utf8');
 assert.match(game,/if\(e\.code==='Space'\)this\.callIonDischarge\(\)/);
 assert.match(game,/ionButton\.onclick=\(\)=>this\.callIonDischarge\(\)/);
 assert.match(game,/this\.mining\.active\|\|this\.probeRepairing/);
 assert.match(game,/this\.ionLoan\?\.missionStarted/);
 assert.match(html,/id="ionBtn"/);
 assert.match(panel,/action\('loanIon'/);
 assert.match(panel,/action\('returnIon'/);
});
