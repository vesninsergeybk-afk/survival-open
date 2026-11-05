import test from 'node:test';
import assert from 'node:assert/strict';
import {startSortie,finishSortie,appendSortieReport,nextEconomyChoices,
 validSortieReports,MAX_SORTIE_REPORTS} from '../sortie-economy.js';
import {recordSortieIncome,recordSortieDamage,recordSortieRepair,recordSortieDroneLoss,
 creditContractReward} from '../sortie-ledger.js';
import {enemySalvage,enemyDataReward} from '../combat-rewards.js';
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
 const report=finishSortie(baseline,game,home);
 assert.deepEqual(Object.fromEntries(Object.entries(report).filter(([key])=>
  !['id','outcome','details'].includes(key))),{
  seconds:195,ore:41,data:32,hull:-32,drones:1,levels:1,baseId:'0:0'});
 assert.equal(report.id,30000);assert.equal(report.outcome,'returned');
 assert.equal(validSortieReports([report]),true);
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
 for(const baseId of ['industry:source','industry:depot',
  'frontier:azure:source','frontier:azure:depot',
  'frontier:teal:source','frontier:teal:depot'])
  assert.equal(validSortieReports([{...report,baseId}]),true,baseId);
 for(const baseId of ['industry:unknown','frontier:amber:depot',
  'frontier:azure:unknown','../../../run'])
  assert.equal(validSortieReports([{...report,baseId}]),false,baseId);
});

test('the first return offers two affordable protection plans, network saving and a free experiment',()=>{
 const s=state({ore:20}),offer=baseOffer(home,s);
 const choices=nextEconomyChoices(home,s,offer);
 assert.deepEqual(choices.map(c=>[c.title,c.cost,c.act]),[
  ['Дрон сопровождения',20,'hire'],['Аварийный щит',16,'service'],
  ['Расширить сеть',24,'baseMap'],['Испытать полевое оружие',0,'showFieldTrial']]);
 assert.equal(choices.filter(c=>c.cost>0&&c.cost<=s.ore&&!c.reason).length,2);
 const unharmed=state({ore:20,hp:110});
 assert.ok(nextEconomyChoices(home,unharmed,baseOffer(home,unharmed))
  .some(c=>c.act==='service'&&c.cost===16),
  'a shield is preparation for risk, not a reward for already taking damage');
 const poor=state({ore:16}),limited=nextEconomyChoices(home,poor,baseOffer(home,poor));
 assert.ok(limited.some(c=>c.act==='service'&&c.cost===16));
 assert.ok(limited.some(c=>c.act==='baseMap'&&c.cost===24));
 assert.ok(limited.some(c=>c.act==='baseTab'&&c.role==='operations'),
  'if the player cannot afford a durable upgrade, show an actionable income route');
});

test('the offer adapts to a full drone slot, borrowed ion weapon and charged shield',()=>{
 const loadout=createLoadout();loadout.slots[1]='ion';
 const s=state({loadout,ore:50,shield:30,allies:1,droneRoles:['scout'],fieldTrialTaken:true});
 const choices=nextEconomyChoices(home,s,baseOffer(home,s));
 assert.ok(choices.some(c=>c.act==='baseMap'));
 assert.ok(choices.some(c=>c.act==='baseTab'&&c.role==='network'));
 assert.ok(choices.some(c=>c.act==='baseTab'&&c.role==='operations'));
});

test('a cash-poor pilot on contract cooldown can still depart to mine without a false job promise',()=>{
 const cooling={...home,contractRuns:1,contractCooldownUntil:210};
 const s=state({ore:0,time:100,sortieReports:[{seconds:50,ore:0,data:5,hull:0,
  drones:0,levels:0,baseId:home.id}]});
 const offer=baseOffer(cooling,s),choices=nextEconomyChoices(cooling,s,offer);
 assert.equal(offer.contract.status,'cooldown');
 assert.ok(choices.some(c=>c.act==='close'&&c.cost===null));
 assert.equal(choices.some(c=>c.act==='baseTab'&&c.role==='operations'),false);
 const panel=renderBasePanel(cooling,s);
 assert.match(panel,/Вылететь за рудой/);
 assert.match(panel,/Повторные заказы станут доступны здесь через 110 с/);
});

test('the dock shows the last completed result and honest, labelled purchase routes',()=>{
 const s=state({xp:20,nextXp:75,sortieReports:[{seconds:133,ore:31,data:28,hull:-15,drones:0,levels:0,baseId:'0:0'}]});
 const html=renderBasePanel(home,s);
 assert.match(html,/ПОСЛЕ ВЫЛЕТА/);
 assert.match(html,/2 мин 13 с/);
 assert.match(html,/Сплав <b>\+31<\/b>/);
 assert.match(html,/Данные <b>\+28<\/b>/);
 assert.match(html,/Корпус, итог <b>-15<\/b>/);
 assert.match(html,/Испытать полевое оружие/);
 assert.match(html,/data-act="showFieldTrial"/);
 assert.match(html,/История: 1 вылет и расходы/);
 assert.match(html,/Бесплатно · сплав не расходуется/);
 assert.match(html,/Данные дают опыт пилоту: до уровня 2 осталось 55/);
 assert.match(html,/data-act="baseTab" data-role="hangar"/);
 assert.match(html,/data-act="baseMap"/);
 assert.doesNotMatch(renderBasePanel(home,state()),/ПОСЛЕ ВЫЛЕТА/);
});

test('flight history labels use correct Russian forms',()=>{
 const report={seconds:40,ore:0,data:0,hull:0,drones:0,levels:0,baseId:'0:0'};
 for(const [count,word] of [[1,'вылет'],[2,'вылета'],[3,'вылета'],
  [4,'вылета'],[5,'вылетов']]){
  const html=renderBasePanel(home,state({sortieReports:Array.from({length:count},()=>report)}));
  assert.match(html,new RegExp('История: '+count+' '+word+' и расходы'));
  assert.match(html,new RegExp('вылетов учтено: '+count));
 }
});

test('the first-operation reward offers a distinct range choice and never proposes an ordinary gun for H',()=>{
 const loadout={frame:4,slots:['plasma',null,null,null,null,null],owned:{plasma:1}};
 const offer={reasons:{hire:'Лимит',service:'Недоступно',upgrade:'Нет связи'},relayCost:48};
 const choices=nextEconomyChoices({active:true},{loadout,earlyRail:true,civilianBases:2,
  fieldTrialTaken:true,maxHp:110,hp:110},offer);
 assert.ok(choices.some(c=>c.title==='Рельсовое орудие'&&c.cost===36));
 assert.ok(choices.some(c=>c.title==='Дополнительный плазменный луч'));
 loadout.slots=['plasma','rail','flak','rocket','plasma',null];
 assert.deepEqual(nextEconomyChoices({active:true},{loadout,civilianBases:2,
  maxHp:110,hp:110},offer).map(c=>c.act),['baseMap','close']);
});

test('income and combat risk remain visible even when repairs hide net hull loss',()=>{
 const g={time:60,player:{ore:0,data:0,hp:110,level:1},allies:[]};
 g.sortieStart=startSortie(g);
 recordSortieIncome(g,'ore','mining',9);recordSortieIncome(g,'ore','salvage',2);
 recordSortieIncome(g,'data','combat',25);recordSortieDamage(g,64,15);
 recordSortieRepair(g,52);recordSortieDroneLoss(g);
 g.player.ore=11;g.player.data=25;g.player.hp=98;g.time+=85;
 const report=finishSortie(g.sortieStart,g,home);
 assert.equal(report.hull,-12);assert.equal(report.details.damageTaken,64);
 assert.equal(report.details.hullRepaired,52);assert.equal(report.details.shieldDamage,15);
 assert.equal(report.details.dronesLost,1);
 assert.equal(report.details.oreMining,9);assert.equal(report.details.oreSalvage,2);
 assert.equal(report.details.dataCombat,25);
 const html=renderBasePanel(home,state({sortieReports:[report]}));
 assert.ok(html.indexOf('ЧТО СЕЙЧАС ВАЖНО')<html.indexOf('ПОСЛЕ ВЫЛЕТА'));
 assert.match(html,/<details class="base-secondary-info base-report-details"><summary>Итоги последнего вылета/);
 assert.match(html,/трофеи \+2/);assert.match(html,/Получено повреждений <b>64<\/b>/);
 assert.match(html,/Потеряно дронов <b>1<\/b>/);
});

test('claiming a contract updates the flight that completed it, once, even after a later dock',()=>{
 const g={time:10,player:{ore:0,data:0,hp:110,level:1},allies:[]};
 let first=startSortie(g);g.time=95;g.player.data=25;
 const earlier=finishSortie(first,g,home);
 g.time=110;g.player.ore=1;
 const later=finishSortie(startSortie(g),{...g,time:160,player:{...g.player,ore:2}},home);
 const contract={ore:16,data:15,completedSortieId:earlier.id};
 const reports=creditContractReward([earlier,later],contract,home);
 assert.equal(reports[0].ore,16);assert.equal(reports[0].data,40);
 assert.equal(reports[0].details.oreContracts,16);
 assert.equal(reports[1].ore,1);assert.equal(reports[1].details.oreContracts,0);
 assert.equal(validSortieReports(reports),true);
 assert.equal(creditContractReward([],contract,home).length,0);
});

test('failed sorties are recorded; old 7-field reports still load but malformed new data does not',()=>{
 const g={time:0,player:{ore:0,data:0,hp:110,level:1},allies:[]};
 const start=startSortie(g);g.time=3;g.player.hp=0;
 const lost=finishSortie(start,g,home,'lost');
 assert.equal(lost.outcome,'lost');assert.equal(lost.seconds,3);
 assert.equal(validSortieReports([lost]),true);
 assert.equal(validSortieReports([{...lost,details:{...lost.details,oreSalvage:-1}}]),false);
 assert.equal(validSortieReports([{...lost,outcome:'aborted'}]),false);
 assert.equal(validSortieReports([{...lost,id:NaN}]),false);
});

test('combat gives bounded alloy salvage and data reflects greater enemy durability',()=>{
 const scout={type:'scout',serial:4,maxHp:28};
 assert.equal(enemySalvage(scout),1);
 assert.equal(enemySalvage({...scout,serial:5}),0);
 assert.equal(enemySalvage({type:'gunship',serial:11}),2);
 assert.equal(enemyDataReward(scout),7);
 assert.equal(enemyDataReward({...scout,maxHp:112}),13);
 assert.equal(enemyDataReward({...scout,maxHp:1e7}),13);
 // Combat cannot outperform one rich rock merely by destroying four scouts.
 assert.equal([1,2,3,4].reduce((n,serial)=>n+enemySalvage({...scout,serial}),0),1);
});
