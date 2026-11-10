import test from 'node:test';
import assert from 'node:assert/strict';
import {openingThreat,spawnOutside,outsideCamera} from '../balance.js';
import {availableEncounters,planEncounter,MOTE_ENCOUNTER,scheduledMoteSize} from '../encounters.js';
import {ENEMY_TYPES,updateEnemy} from '../ai.js';

const build=(t,roll=0,room=10,previous='')=>
  planEncounter(t,openingThreat(t,3),room,0,.5,roll,previous);
test('первый патруль выходит на девятой секунде и не окружает игрока',()=>{
  assert.equal(build(8.99).members.length,0);
  for(const t of [9,24,35.9]){
    const plan=build(t,.99);
    assert.equal(plan.pattern,'patrol');
    assert.ok(plan.members.every(m=>m.type==='scout'));
    assert.ok(plan.members.length<=openingThreat(t).cap);
    assert.equal(new Set(plan.members.map(m=>m.side)).size,1);
  }
});
test('сценарии открываются постепенно и только с доступными типами',()=>{
  assert.deepEqual(availableEncounters(70,openingThreat(70),2),['patrol','sweep']);
  assert.ok(!availableEncounters(117.9,openingThreat(117.9),3).includes('pincer'));
  assert.ok(availableEncounters(118,openingThreat(118),3).includes('pincer'));
  assert.ok(!availableEncounters(117.9,openingThreat(117.9),3).includes('ram'));
  assert.ok(!availableEncounters(174.9,openingThreat(174.9),3).includes('ram'));
  assert.ok(availableEncounters(175,openingThreat(175),3).includes('ram'));
  assert.ok(!availableEncounters(189.9,openingThreat(189.9),3).includes('medic'));
  assert.ok(availableEncounters(190,openingThreat(190),3).includes('medic'));
  assert.ok(!availableEncounters(229.9,openingThreat(229.9),3).includes('heavy'));
  assert.ok(availableEncounters(230,openingThreat(230),3).includes('heavy'));
  for(const t of [9,36,80,118,155,205,240,900]){
    const director=openingThreat(t,3);
    for(const roll of [0,.25,.5,.75,.999]){
      const plan=planEncounter(t,director,50,1,.43,roll);
      assert.ok(plan.pattern==='motes'?plan.members.length<=16:
       plan.members.length<=director.groupSize);
      assert.ok(plan.members.every(m=>director.types.includes(m.type)),
        'неразрешённый тип при t='+t);
    }
  }
});
test('малые рои доступны уже во второй минуте, если достаточно места',()=>{
  const director=openingThreat(110,3);
  assert.ok(availableEncounters(110,director,2,10).includes('motes'));
  assert.ok(!availableEncounters(MOTE_ENCOUNTER.firstAt-.1,director,2,10).includes('motes'));
  assert.ok(!availableEncounters(110,director,2,5).includes('motes'));
  assert.ok(!availableEncounters(110,{...director,allowMotes:false},2,10).includes('motes'));
  const options=availableEncounters(110,director,2,10);
  const index=options.indexOf('motes');
  const plan=planEncounter(110,director,10,1,.5,(index+.1)/options.length);
  assert.equal(plan.pattern,'motes');
  assert.equal(plan.members.length,6);
  assert.ok(plan.members.every(e=>e.type==='scout'));
  assert.equal(new Set(plan.members.map(e=>e.position)).size,6);
  const cramped=planEncounter(110,director,5,1,.5,(index+.1)/options.length);
  assert.notEqual(cramped.pattern,'motes');
});
test('рой получает приоритет, но не обходит фактический бюджет экрана',()=>{
 const d={...openingThreat(120),allowMotes:true};
 const base={time:120,nextAt:110,director:d,regularRoom:6,
  ambientRoom:16,globalRoom:165,activeMotes:0,maxMotes:40};
 assert.equal(scheduledMoteSize(base),6);
 const chosen=planEncounter(120,d,6,0,.5,0,'motes','motes');
 assert.equal(chosen.pattern,'motes','приоритет обходит случайный выбор и запрет повтора');
 assert.equal(chosen.members.length,6);
 assert.equal(scheduledMoteSize({...base,regularRoom:5}),0,
  'шесть реальных мест нужны для шести кораблей');
 assert.equal(scheduledMoteSize({...base,ambientRoom:5}),0,
  'дальние патрули не могут бесконечно накапливать дополнительные дроны');
 assert.equal(scheduledMoteSize({...base,globalRoom:5}),0);
 assert.equal(scheduledMoteSize({...base,activeMotes:27}),0,
  'для подкреплений оставляют свободный бюджет микродронов');
 assert.equal(scheduledMoteSize({...base,time:109.9}),0);
 assert.equal(scheduledMoteSize({...base,nextAt:215}),0);
 assert.equal(scheduledMoteSize({...base,director:{...d,allowMotes:false}}),0);
 const late={...base,time:260,nextAt:200,director:openingThreat(260),
  regularRoom:16,ambientRoom:24,globalRoom:80,ready:true};
 assert.equal(scheduledMoteSize(late),16);
 assert.equal(scheduledMoteSize({...late,regularRoom:15}),0);
 assert.equal(scheduledMoteSize({...late,activeMotes:17}),0);
 assert.equal(scheduledMoteSize({...late,ready:false,regularRoom:8}),8,
  'неподготовленный корабль не получает крупный поздний рой');
});
test('клещи действительно заходят с двух сторон и все корабли появляются за экраном',()=>{
  const d=openingThreat(120);
  const options=availableEncounters(120,d,6);
  const roll=(options.indexOf('pincer')+.1)/options.length;
  const plan=planEncounter(120,d,6,0,.5,roll);
  assert.equal(plan.pattern,'pincer');
  assert.deepEqual([...new Set(plan.members.map(m=>m.side))].sort(),[0,1]);
  const camera={x:-825,y:254,w:1200,h:750};
  for(let i=0;i<plan.members.length;i++){
    const m=plan.members[i],xy=spawnOutside(camera,m.side,m.position,170+i*12);
    assert.ok(outsideCamera(xy.x,xy.y,camera,22));
  }
});
test('ремонтник находится внутри защищаемой группы, охранники знают свою цель',()=>{
  const d=openingThreat(195);
  const opts=availableEncounters(195,d,3);
  const plan=planEncounter(195,d,3,2,.55,(opts.indexOf('medic')+.1)/opts.length);
  assert.equal(plan.pattern,'medic');
  assert.equal(plan.members[0].type,'healer');
  assert.deepEqual(plan.members.slice(1).map(m=>m.protectIndex),[0,0]);
  assert.ok(plan.pause>0);
});
test('тяжёлый корабль появляется один, с прикрытием',()=>{
  const d=openingThreat(260);
  const opts=availableEncounters(260,d,4);
  const plan=planEncounter(260,d,4,2,.5,(opts.indexOf('heavy')+.1)/opts.length);
  assert.equal(plan.pattern,'heavy');
  assert.equal(plan.members.filter(m=>m.type==='gunship').length,1);
  assert.ok(plan.members.some(m=>m.type==='fighter'));
});
test('повторяющийся сценарий сменяется другим при наличии выбора',()=>{
  const d=openingThreat(180);
  const a=planEncounter(180,d,3,1,.5,0);
  const b=planEncounter(180,d,3,1,.5,0,a.pattern);
  assert.notEqual(a.pattern,b.pattern);
});
const actor=(type,x,y,hp=ENEMY_TYPES[type].hp)=>({
  serial:2,type,x,y,vx:0,vy:0,r:14,hp,maxHp:ENEMY_TYPES[type].hp,
  state:'hunt',think:0,fire:1,commitUntil:0,angle:0});
const world=player=>({
  time:160,player,allies:[],grid:{query:()=>[]},heritage:{play:()=>{}},
  avoidance:()=>({x:0,y:0}),enemyCanSee:()=>true,enemyShot:()=>{},hurt:()=>{}
});
test('охранник сначала держится у ремонтника, при сближении перехватывает игрока',()=>{
  const medic=actor('healer',400,0),guard=actor('fighter',350,0);
  guard.protect=medic;
  guard._awarenessDispatch={x:0,y:0,at:160};
  const game=world({x:0,y:0,hp:110,r:19});
  updateEnemy(guard,game,.05);
  assert.equal(guard.state,'guard');
  assert.ok(guard.x<350);
  game.player.x=300;game.time=164;guard.think=0;
  guard._awarenessNextAt=game.time;
  updateEnemy(guard,game,.05);
  assert.equal(guard.state,'intercept');
});
test('критически повреждённый таранщик сначала предупреждает, затем ускоряется',()=>{
  const ram=actor('berserker',350,0,20),game=world({x:0,y:0,hp:110,r:19});
  updateEnemy(ram,game,.05);
  assert.equal(ram.state,'windup');
  assert.ok(ram.chargeReadyAt>game.time);
  game.time=161;ram.think=0;
  updateEnemy(ram,game,.05);
  assert.equal(ram.state,'charge');
});

test('состав первых волн меняется в момент открытия новых типов',()=>{
  assert.deepEqual(availableEncounters(35.9,openingThreat(35.9),2),['patrol']);
  assert.deepEqual(availableEncounters(36,openingThreat(36),2),['patrol','sweep']);
  assert.equal(build(36,0).members[0].type,'fighter');
  const d=openingThreat(90);
  const opts=availableEncounters(90,d,2);
  const sweep=planEncounter(90,d,2,0,.5,(opts.indexOf('sweep')+.1)/opts.length);
  assert.equal(sweep.pattern,'sweep');
  assert.equal(sweep.members[0].type,'flanker');
  assert.equal(sweep.members[0].weaponVariant,'impulse');
  assert.equal(sweep.members.filter(e=>e.weaponVariant==='impulse').length,1);
});
test('рост напряжения после трёх минут ограничен числом кораблей',()=>{
  let previous=openingThreat(205,1);
  for(const t of [206,300,600,900,1200,1800]){
    const next=openingThreat(t,12);
    assert.ok(next.cap<=70,'слишком много врагов: t='+t);
    assert.ok(next.interval>=1.6,'слишком частые группы: t='+t);
    assert.ok(next.groupSize<=8,'слишком плотные группы: t='+t);
    assert.ok(next.cap>=previous.cap);
    previous=next;
  }
  assert.ok(openingThreat(600,9).cap<=60);
});
