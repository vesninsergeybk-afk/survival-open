import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {advanceRegionalSupply,interceptSupply,regionalSupplyValid,cargoLastContact} from '../regional-supply.js';
import {updateRegionalWorld,rememberCargoEscort} from '../region-runtime.js';
import {warFronts} from '../war-fronts.js';
import {homeIndustryState} from '../home-conflict.js';
import {advanceEnemyExpansion,expansionReserve} from '../enemy-expansion.js';
import {regionalMapOverlay,renderRegionAtlas} from '../regional-map.js';
import {packRun,unpackRun} from '../run-checkpoint.js';

const noop=()=>{};
function encounter(){
 const world=new World();advanceRegionalSupply(world,80);
 const cargo=world.regionalSupply.convoys[0];assert.ok(cargo);
 return {cargo,game:{world,time:80.5,player:{x:cargo.x,y:cargo.y},
  enemies:[],enemySerial:0,groupSerial:0,notice:noop,waypoint:null}};
}

test('paid cargo escort returns after distance culling with the same damage, but dead escorts do not resurrect',()=>{
 const {cargo,game}=encounter();
 updateRegionalWorld(game,.1);
 const escorts=game.enemies.filter(e=>e.protect===cargo);
 assert.equal(escorts.length,2);
 escorts[0].hp-=17;rememberCargoEscort(escorts[0]);
 rememberCargoEscort(escorts[1]);game.enemies=[]; // The main loop culled distant ships.
 game.time=81.5;updateRegionalWorld(game,.1);
 let restored=game.enemies.filter(e=>e.protect===cargo);
 assert.equal(restored.length,2);
 assert.equal(restored.find(e=>e.escortSlot===0).hp,escorts[0].hp);
 const lost=restored.find(e=>e.escortSlot===0);
 lost.hp=0;rememberCargoEscort(lost);
 game.enemies=[];game.time=82.5;updateRegionalWorld(game,.1);
 restored=game.enemies.filter(e=>e.protect===cargo);
 assert.equal(restored.length,1,'destroyed protection cannot respawn at no cost');
 assert.equal(restored[0].escortSlot,1);
 assert.ok(regionalSupplyValid(game.world.regionalSupply,game.time));
});

test('a converted escort is no longer cloned into a hostile escort on return',()=>{
 const {cargo,game}=encounter();updateRegionalWorld(game,.1);
 const escort=game.enemies.find(e=>e.protect===cargo&&e.escortSlot===0);
 escort.converted=true;rememberCargoEscort(escort);
 game.enemies=[];game.time=81.5;updateRegionalWorld(game,.1);
 assert.deepEqual(game.enemies.filter(e=>e.protect===cargo).map(e=>e.escortSlot),[1]);
});

test('checkpoint graph preserves the paid escort manifest without a phantom replacement',()=>{
 const {cargo,game}=encounter();updateRegionalWorld(game,.1);
 const first=game.enemies.find(e=>e.protect===cargo&&e.escortSlot===0);
 first.hp-=23;rememberCargoEscort(first);
 game.enemies=[]; // Player left the encounter, so the live ships were culled.
 const saved=unpackRun(packRun({supply:game.world.regionalSupply,enemies:game.enemies}));
 const next=saved.supply.convoys.find(c=>c.id===cargo.id);
 assert.equal(next.escortManifest[0].hp,first.hp);
 assert.equal(next.escortManifest[1].hp,next.escortManifest[1].maxHp);
 assert.equal(saved.enemies.length,0);
 assert.ok(regionalSupplyValid(saved.supply,game.time));
});

test('visual contact is a last observed point, never remote live tracking',()=>{
 const {cargo,game}=encounter();updateRegionalWorld(game,.1);
 const position={x:cargo.x,y:cargo.y};
 game.player={x:0,y:0};game.waypoint={id:cargo.id,x:position.x,y:position.y,label:'Рудный транспорт'};
 advanceRegionalSupply(game.world,140);game.time=140.5;updateRegionalWorld(game,.1);
 assert.ok(Math.hypot(cargo.x-position.x,cargo.y-position.y)>1000);
 assert.deepEqual({x:game.waypoint.x,y:game.waypoint.y},position);
 assert.equal(cargoLastContact(cargo,game.time).live,false);
 const overlay=regionalMapOverlay(game,p=>p,()=>true);
 assert.match(overlay,/ПОСЛЕДНЯЯ ОТМЕТКА/);
 assert.ok(overlay.includes('x="'+(position.x-5)+'"'));
 assert.match(renderRegionAtlas(game),/Последняя отметка:/);
 game.time=190;advanceRegionalSupply(game.world,190);updateRegionalWorld(game,.1);
 assert.equal(cargoLastContact(cargo,game.time),null);
 assert.doesNotMatch(regionalMapOverlay(game,p=>p,()=>true),/РУДНЫЙ ТРАНСПОРТ/);
 assert.deepEqual({x:game.waypoint.x,y:game.waypoint.y},position);
});

test('depleted rocks and stores really starve the home network without disabling a healthy miner',()=>{
 const world=new World(),s=world.regionalSupply.central;
 for(const rock of world.nearbyRocks(4400,2800,2400)){rock.hp=0;rock.alive=false;}
 s.ore=0;s.worker.phase='seek';s.worker.carry=0;
 advanceRegionalSupply(world,1);
 assert.equal(s.worker.rockDepleted,true);
 assert.equal(s.worker.hp,70);
 assert.equal(homeIndustryState(world).outcome,'starved');
 assert.equal(warFronts(world).find(f=>f.key==='home').outcome,'starved');
 s.ore=8;
 assert.equal(warFronts(world).find(f=>f.key==='home').outcome,null,
  'a funded final delivery is still possible');
 assert.ok(regionalSupplyValid(world.regionalSupply,1));
});

test('territorial spending preserves logistics reserves during a 30-minute cargo blockade',()=>{
 const world=new World();
 let destroyed=0,investments=0;
 for(let t=1;t<=1800;t++){
  advanceRegionalSupply(world,t);
  const fronts=warFronts(world),spentBefore=world.enemyExpansion.spent;
  const invested=advanceEnemyExpansion(world,t);
  assert.equal(world.enemyExpansion.spent-spentBefore,invested.length*2,
   'each new territory link is purchased exactly once');
  for(const event of invested){
   if(event.paidBy==='colony'){
    const colony=world.population.colonies.find(c=>c.id===event.colonyId);
    assert.ok(colony&&colony.pool>=0,
     'local territorial expansion must spend its own industrial stock');
    investments++;continue;
   }
   const front=fronts.find(f=>f.key===event.front);
   const stock=front.key==='home'||front.key==='north'?'ore':'resource';
   assert.ok(front.pool[stock]>=expansionReserve(front)-1e-7,
    `${event.front}: an optional link spent the industry's emergency cargo reserve`);
   investments++;
  }
  const s=world.regionalSupply;
  const networks=[s.central,s,s.frontier.azure,s.frontier.teal];
  for(const net of networks)for(const cargo of [...net.convoys]){
   cargo.hp=0;if(interceptSupply(world,cargo,t))destroyed++;
  }
 }
 assert.ok(investments>=1);
 assert.ok(destroyed>=50,'all four networks remain capable of dispatching during a hard blockade');
 for(const f of warFronts(world))assert.equal(f.pool.delivered,0);
 assert.ok(regionalSupplyValid(world.regionalSupply,1800));
});
