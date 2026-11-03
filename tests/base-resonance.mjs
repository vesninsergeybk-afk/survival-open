import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/base-resonance.js',import.meta.url),'utf8');
const {resonanceStep,resonanceQuote,resonanceLinks,RESONANCE_RATES}=
    await import('data:text/javascript,'+encodeURIComponent(source));

const base=(id,type='outpost',x=0,activated=true)=>({
    id,type,x,y:0,hp:180,activated,activationTime:x,
    turrets:[],sockets:1,hangarTier:0,hangarCapacity:1,
    defense:{level:0,mode:null},escortUpgrades:{hull:0,engine:0,gun:0}
});
const donor=base('a','outpost',0);
const clone=base('b','outpost',4500);
const alien=base('c','lab',10);
const known=new Set();
const quote=(target,item,option='',cost=35,all=[donor,clone,alien])=>
    resonanceQuote(target,all,known,item,option,cost);
const turret=(level=1,path=null,mount=2)=>({level,path,mount});
assert.equal(RESONANCE_RATES.firstTurret,.1);
assert.equal(quote(clone,'turret').cost,35,'Unmastered step costs full price');
known.add(resonanceStep(donor,'turret').key);
assert.equal(quote(clone,'turret').cost,35,'Blueprint alone is insufficient');
donor.turrets.push(turret());
let result=quote(clone,'turret');
assert.equal(result.cost,4,'First cloned turret costs ~10% (rounded up)');
assert.equal(result.saved,31);
assert.equal(result.source.id,'a');
clone.turrets.push(turret());
assert.equal(quote(clone,'turret').cost,35,'Second turret requires its own prototype');
known.add(resonanceStep(clone,'turret').key);
donor.turrets.push(turret(1,null,4));
assert.equal(quote(clone,'turret').cost,9,'Second turret costs 25% rounded up');
const originalThird=base('d','outpost',8000);
originalThird.turrets.push(turret());
known.add(resonanceStep(originalThird,'turret').key);
assert.equal(quote(originalThird,'turret', '',35,[donor,clone,originalThird]).cost,9,
    'The discount applies to any same-type target when prototype is live');
assert.equal(quote(alien,'turret').discounted,false,'Different station types never link');
const dead=base('dead','outpost',150);
dead.turrets.push(turret());dead.activated=false;
assert.equal(quote(base('e','outpost',700),'turret','',35,[dead]).discounted,false,
    'Unactivated or missing donor cannot provide a discount');
const nextUpgrade=resonanceStep(clone,'upgradeTurret',2);
assert.equal(nextUpgrade.key,'outpost/turret/1/level/2');
known.add(nextUpgrade.key);
assert.equal(quote(clone,'upgradeTurret',2,52).cost,52,
    'Blueprint must exist physically on another working base');
donor.turrets[0].level=2;
assert.equal(quote(clone,'upgradeTurret',2,52).cost,19,
    'An exact mastered turret level receives a 35% price');
const specialization=resonanceStep(clone,'specialize','2:rail');
known.add(specialization.key);
donor.turrets[0].path='missile';
assert.equal(quote(clone,'specialize','2:rail',85).cost,85,
    'Different specialization never licenses the target');
donor.turrets[0].path='rail';donor.turrets[0].level=3;
assert.equal(quote(clone,'specialize','2:rail',85).cost,43,
    'Matching specialization receives a 50% price');
donor.sockets=2;
known.add(resonanceStep(clone,'extension').key);
assert.equal(quote(clone,'extension','',40).cost,16);
donor.defense.level=1;
known.add(resonanceStep(clone,'stasisUpgrade').key);
assert.equal(quote(clone,'stasisUpgrade','',80).cost,40);
donor.hp=0;
assert.equal(quote(clone,'turret').discounted,false,
    'Without a live donor the player pays full price');
donor.hp=180;
assert.equal(quote(clone,'turret').discounted,true,
    'The known blueprint can reconnect when a live donor returns');
assert.equal(resonanceStep(clone,'activate'),null);
assert.equal(quote(clone,'activate','',20).cost,20);
assert.equal(quote(clone,'baseDevelopment','research',40).cost,40);
assert.equal(quote(clone,'shipUpgrade','damage',60).cost,60);
assert.equal(quote(clone,'repair','',8).cost,8);

const all=[base('1','dock',0),base('2','dock',60000),
    base('3','dock',100000),base('4','lab',50000),base('5','lab',90000),
    base('6','dock',20000,false)];
const edges=resonanceLinks(all);
assert.equal(edges.length,3,'Every type forms a tree with no link spam');
assert.ok(edges.every(e=>e.from.type===e.to.type));
assert.ok(edges.some(e=>Math.abs(e.from.x-e.to.x)>2900),
    'Resonance works across the entire galaxy');
assert.equal(resonanceLinks([base('z')]).length,0);
assert.equal(resonanceQuote(base('reset'),all,new Set(),'turret','',35).cost,35,
    'New sortie starts with no remembered mastered prototypes');
console.log('Base resonance: cloning, costs, types, paths, donors, resets and links passed');
