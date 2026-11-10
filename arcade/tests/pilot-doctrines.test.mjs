import test from 'node:test';
import assert from 'node:assert/strict';
import {game} from './weapons-scene.mjs';
import {developmentPointLedger} from '../experience.js';
import {doctrineRank,doctrineBuyReason,doctrineSpent,normalizedDoctrineRanks,
 assaultPlasmaBonus,assaultShockwave,commandMarkHit,transferCommandMark,
 commandAllyBonus,prospectMineCompleted,prospectNoiseMultiplier,doctrineEngineSurge,
 doctrinePlasmaSurge,consumeProspectCharge} from '../pilot-doctrines.js';

test('all four branches unlock independently and deeper ranks consume 1, 2, then 3 points',()=>{
 const g=game();g.player.level=4;g.player.points=4;
 for(const id of ['assault','command','prospect','countermaneuver'])assert.equal(g.buyDoctrine(id),true);
 assert.equal(g.player.points,0);assert.equal(Object.keys(g.doctrineRanks).length,4);
 assert.equal(g.buyDoctrine('assault'),false,'rank 2 is not accessible before level 7');
 g.player.level=7;g.player.points=2;
 assert.equal(g.buyDoctrine('command'),true);assert.equal(g.doctrineRanks.command,2);
 assert.equal(g.player.points,0);
 g.player.level=11;g.player.points=3;
 assert.equal(g.buyDoctrine('command'),true);assert.equal(g.player.points,0);
 assert.equal(g.buyDoctrine('command'),false,'rank cap is strict');
 assert.equal(doctrineSpent(g.doctrineRanks),9);
 assert.equal(developmentPointLedger({level:16,points:6,doctrineRanks:g.doctrineRanks,skillRanks:{}}).unaccounted,0);
});

test('an old doctrine is migrated to rank one, but other paths remain affordable',()=>{
 assert.equal(doctrineRank({doctrine:'assault'},'assault'),1);
 assert.deepEqual(normalizedDoctrineRanks({doctrine:'assault'}),{assault:1});
 assert.equal(doctrineBuyReason({doctrine:'assault',level:7,points:1},'assault'),'Нужно 2 очка развития');
 assert.equal(doctrineBuyReason({doctrine:'assault',level:7,points:1},'prospect'),'');
 assert.equal(doctrineSpent({assault:3,prospect:2}),9);
});

test('assault burst boosts close plasma only and rank 3 shockwave hits nearby enemies on cooldown',()=>{
 const g=game();g.doctrineRanks={assault:3};g.time=10;g.assaultBurstUntil=12.5;
 assert.equal(assaultPlasmaBonus(g,120),1.4);
 assert.equal(assaultPlasmaBonus(g,120,'rail'),1.3);
 assert.equal(assaultPlasmaBonus(g,220),1);
 g.time=13;assert.equal(assaultPlasmaBonus(g,120),1.22);
 assert.equal(assaultPlasmaBonus(g,120,'rocket'),1.12);
 const target={x:110,y:0,hp:50},near={x:150,y:30,hp:50},far={x:300,y:0,hp:50};
 g.enemies=[target,near,far];let pulseDamage=0;
 g.damageEnemy=(enemy,damage)=>{assert.equal(enemy,near);pulseDamage+=damage;};
 assert.equal(assaultShockwave(g,target,100),1);
 assert.equal(pulseDamage,28);
 assert.equal(assaultShockwave(g,target,100),0);
 g.time+=3.5;assert.equal(assaultShockwave(g,target,16),1);
 assert.equal(pulseDamage,39,'low-damage weapons still trigger a meaningful shockwave');
});

test('command rank 1 is useful without companions, rank 3 transfers the mark on a real kill',()=>{
 const g=game();g.doctrineRanks={command:1};g.allies=[];g.time=10;
 const first={x:100,y:0,hp:20},second={x:160,y:0,hp:20};
 const cues=[];g.heritage.vfx={nova:(x,y,radius,tone)=>cues.push({x,y,radius,tone})};
 assert.equal(commandMarkHit(g,first),1.1);
 assert.deepEqual(cues[0],{x:100,y:0,radius:23,tone:'cyan'});
 assert.equal(commandMarkHit(g,first),1.35);
 assert.equal(commandMarkHit(g,second),1,'the pilot cannot mark the entire enemy wave at once');
 assert.equal(commandAllyBonus(g,{x:100,y:0}),1.25);
 g.doctrineRanks.command=2;g.time+=1.2;
 assert.equal(commandMarkHit(g,second),1.1,'rank 2 can switch to a new target after idle');
 assert.equal(commandMarkHit(g,second),1.5);
 g.doctrineRanks.command=3;g.enemies=[first,second];second.hp=0;
 assert.equal(transferCommandMark(g,second),true);
 assert.equal(g.commandMark.target,first);
 assert.deepEqual(cues.at(-1),{x:100,y:0,radius:29,tone:'cyan'});
 assert.equal(commandMarkHit(g,first),1.65);
 assert.equal(commandAllyBonus(g,{x:340,y:0}),1.45);
});

test('command first rank earns its point against an ordinary scout without wingmen',()=>{
 const g=game();g.doctrineRanks={command:1};g.time=10;
 const scout={x:80,y:0,hp:38};
 const first=16*commandMarkHit(g,scout),second=16*commandMarkHit(g,scout);
 assert.ok(first+second>=scout.hp,'two close plasma hits should finish a basic scout');
 assert.ok(16+16*1.1<scout.hp,'the prior mark bonus could not do this');
});

test('prospector restores defense and banks six enhanced plasma hits after mining',()=>{
 const g=game();g.doctrineRanks={prospect:3};g.player.hp=80;g.player.shield=0;g.time=10;
 assert.equal(prospectNoiseMultiplier(g),.8);
 assert.equal(prospectMineCompleted(g),true);
 assert.equal(g.player.hp,84);
 assert.equal(doctrineEngineSurge(g),1.12);
 assert.equal(doctrinePlasmaSurge(g),1.45);
 assert.equal(g.prospectCharges,6);
 g.time=28;
 assert.equal(doctrineEngineSurge(g),1);
 assert.equal(doctrinePlasmaSurge(g),1.45,'combat charges outlive movement surge');
 for(let i=0;i<6;i++)assert.equal(consumeProspectCharge(g),true);
 assert.equal(g.prospectCharges,0);assert.equal(doctrinePlasmaSurge(g),1);
 prospectMineCompleted(g);assert.equal(g.prospectCharges,6,'new ore refreshes the six-charge limit');
 g.time=119;assert.equal(doctrinePlasmaSurge(g),1,'charges expire after ninety seconds');
 g.doctrineRanks.prospect=2;g.player.shield=10;g.player.hp=80;
 prospectMineCompleted(g);assert.equal(g.player.shield,16);assert.equal(g.player.hp,80);
});
