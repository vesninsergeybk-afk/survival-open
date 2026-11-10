import test from 'node:test';
import assert from 'node:assert/strict';
import {RELIC_SECONDS,createConvoyRelic,RELICS,validConvoyRelic,
 rewardConvoyRelic,updateConvoyRelic} from '../convoy-relic.js';

const scene=()=>{
 const notices=[],hits=[];
 const game={time:100,dead:false,player:{x:0,y:0},allies:[],
  convoyRelic:createConvoyRelic(),holdFire:false,enemies:[],
  notice:message=>notices.push(message),flash:()=>{},
  damageEnemy:(e,dmg,source)=>{hits.push({e,dmg,source});e.hp-=dmg;},
  heritage:{play:()=>{},vfx:{nova:()=>{}}}};
 return {game,notices,hits};
};

test('nearby personally intercepted convoy grants a 90-second automatic weapon',()=>{
 const {game}=scene(),cargo={x:160,y:0,cargoRole:'military'};
 const active=rewardConvoyRelic(game,cargo,'beam',()=>.99);
 assert.equal(active.id,'salvo');
 assert.equal(active.until-game.time,RELIC_SECONDS);
 assert.ok(validConvoyRelic(game.convoyRelic,game.time));
 game.time+=2;
 game.enemies=[{x:120,y:20,hp:150,type:'fighter'},{x:180,y:40,hp:100,type:'scout'}];
 assert.equal(updateConvoyRelic(game),true);
 assert.ok(game.enemies.every(e=>e.hp<150));
 assert.ok(game.convoyRelic.active.nextFireAt>game.time);
 game.time=active.until;
 assert.equal(updateConvoyRelic(game),false);
 assert.equal(game.convoyRelic.active,null);
});

test('reward cannot be farmed at a distance or by another attacker, pity resolves two misses',()=>{
 const {game}=scene();
 assert.equal(rewardConvoyRelic(game,{x:2000,y:0},'beam',()=>0),null);
 assert.equal(rewardConvoyRelic(game,{x:100,y:0},'other',()=>0),null);
 assert.equal(game.convoyRelic.misses,0);
 for(let i=0;i<2;i++)assert.equal(rewardConvoyRelic(game,{x:100,y:0,cargoRole:'ore'},'beam',()=>.99),null);
 assert.equal(game.convoyRelic.misses,2);
 assert.equal(rewardConvoyRelic(game,{x:100,y:0,cargoRole:'ore'},'beam',()=>.99).id,'storm');
 game.time+=10;
 assert.equal(rewardConvoyRelic(game,{x:100,y:0,cargoRole:'ore'},'beam',()=>0),null,'cooldown applies');
});

test('relic respects hold fire, targets enemies only and does not permanently stack',()=>{
 const {game,hits}=scene();
 rewardConvoyRelic(game,{x:100,y:0,cargoRole:'courier'},'beam',()=>0);
 game.enemies=[{x:200,y:0,hp:150,type:'fighter'},{x:225,y:0,hp:100,type:'scout'},
  {x:220,y:0,hp:100,type:'scout',converted:true},{x:250,y:0,hp:100,type:'fighter',regionalCargo:true}];
 game.time=101;game.holdFire=true;
 assert.equal(updateConvoyRelic(game),false);
 assert.equal(hits.length,0);
 game.holdFire=false;
 assert.equal(updateConvoyRelic(game),true);
 assert.deepEqual(new Set(hits.map(h=>h.source)),new Set(['trophy']));
 assert.equal(hits.length,2);
 assert.ok(Object.keys(RELICS).includes(game.convoyRelic.active.id));
});

test('trophy does not reveal distant investigating patrols or shoot through asteroids',()=>{
 const {game,hits}=scene();
 game.convoyRelic.active={id:'storm',until:190,nextFireAt:99};
 const patrol={x:260,y:0,hp:100,r:14,type:'scout',
  signalIntel:{mode:'investigate'}};
 game.enemies=[patrol];
 assert.equal(updateConvoyRelic(game),false);
 assert.equal(hits.length,0,'unconfirmed patrol must not receive automatic fire');
 patrol.signalIntel.mode='engaged';
 game.rockGrid={query:()=>[{x:115,y:0,r:48,alive:true}]};
 game.time+=2;
 assert.equal(updateConvoyRelic(game),false);
 assert.equal(hits.length,0,'solid cover must stop the temporary beam');
 game.rockGrid.query=()=>[];
 game.time+=2;
 assert.equal(updateConvoyRelic(game),true);
 assert.equal(hits.length,1);
});

test('plasma storm spreads limited damage into a nearby group',()=>{
 const {game,hits}=scene();
 game.convoyRelic.active={id:'storm',until:190,nextFireAt:99};
 game.enemies=[{x:180,y:0,hp:100,type:'fighter'},
  {x:212,y:24,hp:100,type:'scout'},{x:240,y:-15,hp:100,type:'fighter'}];
 assert.equal(updateConvoyRelic(game),true);
 assert.equal(hits.length,3);
 assert.equal(hits[0].dmg,RELICS.storm.damage);
 assert.ok(hits.slice(1).every(hit=>hit.dmg<hits[0].dmg));
});
