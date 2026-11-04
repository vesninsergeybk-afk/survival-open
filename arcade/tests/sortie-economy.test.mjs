import test from 'node:test';
import assert from 'node:assert/strict';
import {startSortie,finishSortie,appendSortieReport,nextEconomyChoices,
 validSortieReports,MAX_SORTIE_REPORTS} from '../sortie-economy.js';
import {createLoadout} from '../ship-loadout.js';
import {baseOffer,renderBasePanel} from '../base-panel.js';

const home={id:'0:0',type:'dock',x:0,y:0,active:true};
const state=(extra={})=>({ore:30,data:24,time:100,hp:95,maxHp:110,level:1,
 loadout:createLoadout(),civilianBases:1,activeBases:1,connectedBases:1,
 connected:true,shield:0,allies:0,droneRoles:[],droneDamage:0,
 network:{armor:0,armament:0,engine:0,strikePower:0},
 contract:null,operation:null,baseTab:'summary',...extra});

test('a sortie measures net changes and includes rewards delivered at docking',()=>{
 const game={time:30,player:{ore:0,data:0,hp:110,level:1},allies:[]};
 const baseline=startSortie(game);
 game.time=225;game.player.ore=41;game.player.data=32;game.player.hp=78;
 game.player.level=2;game.allies.push({});
 assert.deepEqual(finishSortie(baseline,game,home),{
  seconds:195,ore:41,data:32,hull:-32,drones:1,levels:1,baseId:'0:0'});
});

test('a tiny station reopening does not overwrite the last useful result',()=>{
 const game={time:100,player:{ore:20,data:10,hp:110,level:1},allies:[]};
 const baseline=startSortie(game);game.time=103;
 assert.equal(finishSortie(baseline,game,home),null);
 const existing=[{seconds:80,ore:12,data:10,hull:-3,drones:0,levels:0,baseId:'0:0'}];
 assert.equal(appendSortieReport(existing,null),existing);
 game.player.ore+=4;
 assert.equal(finishSortie(baseline,game,home).ore,4);
});

test('bounded flight history is safe for checkpoints and rejects malformed records',()=>{
 const report={seconds:40,ore:9,data:3,hull:-7,drones:0,levels:0,baseId:'0:0'};
 let history=[];for(let i=0;i<45;i++)history=appendSortieReport(history,{...report,ore:i});
 assert.equal(history.length,MAX_SORTIE_REPORTS);
 assert.equal(history[0].ore,21);assert.equal(history.at(-1).ore,44);
 assert.equal(validSortieReports(history),true);
 assert.equal(validSortieReports([...history,report]),false);
 assert.equal(validSortieReports([{...report,seconds:-1}]),false);
 assert.equal(validSortieReports([{...report,extra:'unexpected'}]),false);
 assert.equal(validSortieReports([{...report,ore:NaN}]),false);
});

test('the first return presents real alternatives without bypassing budget limits',()=>{
 const s=state(),offer=baseOffer(home,s);
 const choices=nextEconomyChoices(home,s,offer);
 assert.deepEqual(choices.map(c=>[c.title,c.cost,c.act]),[
  ['Дрон сопровождения',20,'hire'],['Аварийный щит',24,'service'],
  ['Второй плазменный луч',24,'baseTab'],['Следующий узел сети',24,'baseMap']]);
 const poor=state({ore:16}),limited=nextEconomyChoices(home,poor,baseOffer(home,poor));
 assert.match(limited.find(c=>c.act==='hire').reason,/Не хватает 4/);
 assert.match(limited.find(c=>c.act==='service').reason,/Не хватает 8/);
});

test('the offer adapts to a full drone slot, borrowed ion weapon and charged shield',()=>{
 const loadout=createLoadout();loadout.slots[1]='ion';
 const s=state({loadout,ore:50,shield:30,allies:1,droneRoles:['scout']});
 const choices=nextEconomyChoices(home,s,baseOffer(home,s));
 assert.deepEqual(choices.map(c=>c.act),['baseMap']);
});

test('the dock shows the last completed result and honest, labelled purchase routes',()=>{
 const s=state({sortieReports:[{seconds:133,ore:31,data:28,hull:-15,drones:0,levels:0,baseId:'0:0'}]});
 const html=renderBasePanel(home,s);
 assert.match(html,/ПОСЛЕ ВЫЛЕТА/);
 assert.match(html,/2 мин 13 с/);
 assert.match(html,/Сплав <b>\+31<\/b>/);
 assert.match(html,/Данные <b>\+28<\/b>/);
 assert.match(html,/Корпус <b>-15<\/b>/);
 assert.match(html,/Второй плазменный луч/);
 assert.match(html,/data-act="baseTab" data-role="hangar"/);
 assert.match(html,/data-act="baseMap"/);
 assert.doesNotMatch(renderBasePanel(home,state()),/ПОСЛЕ ВЫЛЕТА/);
});
