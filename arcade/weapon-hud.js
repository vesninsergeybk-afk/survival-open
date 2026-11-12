// Read-only weapon telemetry. The combat simulation owns all timers and stats;
// the cockpit never invents ammunition, cooldowns or a weapon's availability.
import {MODULES,moduleStats,fittedModules} from './ship-loadout.js?v=manual-hardpoints-20261111';
import {FIELD_WEAPONS} from './field-weapons.js';
import {cometSpec,minesSpec} from './mouse-arsenal.js';
import {TACTICAL_DEVICES,tacticalSpec} from './tactical-fields.js?v=tactical-field-3-space-impact-20261110';
import {manualWeapons,selectedManual} from './manual-weapon-controls.js';
import {plasmaDamageFactor} from './weapon-specializations.js';
import {RULES} from './balance.js';

const round=value=>Number(value).toLocaleString('ru-RU',{maximumFractionDigits:1});
const remaining=(until,now)=>Math.max(0,Number(until||0)-Number(now||0));
const readyText=seconds=>seconds>.05?round(Math.ceil(seconds*10)/10)+' с':'ГОТОВО';
const automaticClock=(game,id)=>id==='plasma'?game.beamClock:
 id==='rocket'?game.rocketClock:game.moduleClocks?.[id];
const blocked=game=>!!(game.dead||game.paused||game.overlay?.hidden===false||
 game.actionHeld||game.mining?.active||game.probeRepairing||game.openingRepairing);
const row=(id,kind,name,detail,seconds,blockedReason='',color='#76dfea',options={})=>({
 id,kind,name,detail,seconds:Math.max(0,seconds),status:blockedReason||readyText(seconds),
 state:blockedReason?'blocked':seconds>.05?'cooldown':'ready',color,
 key:options.key||'',icon:options.icon||id,cycle:options.cycle||0,
 chargePercent:options.cycle>0?Math.round(100*(1-Math.min(1,Math.max(0,seconds)/options.cycle))):100
});

export function weaponDeckState(game){
 const profile=game.weaponProfile||{},ranks=game.skillRanks||{},time=game.time||0;
 const inactive=blocked(game),heat=game.weaponThermal||{},rows=[];
 const heatPercent=heat.enabled&&heat.limit>0?Math.round(100*heat.current/heat.limit):null;
 for(const id of ['plasma','rail','flak','rocket']){
  const mounts=Number(profile[id])||0;
  if(!mounts)continue;
  const spec=moduleStats(id,ranks,game.shipLoadout?.specializations?.[id]);
  const manual=id==='rail'&&!!game.manualRailMode;
  const reason=heat.locked?'ПЕРЕГРЕВ':manual?'РУЧНОЙ':game.holdFire?'ОГОНЬ ВЫКЛ.':
   inactive?'НЕДОСТУПНО':'';
  const damage=id==='plasma'?'Урон вблизи':id==='flak'?'Урон осколка':'Урон/ствол';
  const realDamage=id==='plasma'?spec.damage*plasmaDamageFactor(
   game.shipLoadout?.specializations?.plasma,RULES.nearBeam,spec.range):spec.damage;
  const detail=damage+' '+round(realDamage)+' · '+round(spec.range)+' м · '+round(spec.interval)+' с/залп';
  rows.push(row(id,'auto',MODULES[id].short.toUpperCase()+' ×'+mounts,
   detail,remaining(automaticClock(game,id),0),reason,MODULES[id].color,
   {icon:id,cycle:spec.interval}));
 }
 const available=typeof game.manualWeaponsHere==='function'?game.manualWeaponsHere():
  manualWeapons(profile,game.precisionRailAvailable??false);
 const manual=selectedManual(game.selectedManualWeapon,available);
 if(manual){
  let name='',detail='',seconds=0,cycle=0;
  if(manual==='comet'){
   const spec=cometSpec(ranks);name='ГОЛУБАЯ КОМЕТА';
   detail='Урон '+round(spec.damage)+' · радиус '+spec.radius+' м · '+spec.range+' м · '+round(spec.cooldown)+' с/выстрел';
   seconds=remaining(game.mouseArsenal?.cometReadyAt,time);cycle=spec.cooldown;
  }else if(manual==='mines'){
   const spec=minesSpec(ranks);name='МИННЫЙ ВЕЕР';
   detail=spec.count+' мин · урон '+round(spec.damage)+'/мина · '+spec.range+' м · '+round(spec.cooldown)+' с';
   seconds=remaining(game.mouseArsenal?.minesReadyAt,time);cycle=spec.cooldown;
  }else if(manual==='rail'){
   const spec=moduleStats('rail',ranks,game.shipLoadout?.specializations?.rail);
   name='РЕЛЬС · ПРИЦЕЛ';detail='Урон '+round(spec.damage)+' · '+spec.range+' м · '+round(spec.interval)+' с/залп';
   seconds=remaining(game.moduleClocks?.rail,0);cycle=spec.interval;
  }else if(manual==='howitzer'){
   const spec=moduleStats('howitzer',ranks,game.shipLoadout?.specializations?.howitzer);
   name='ОСАДНАЯ ГАУБИЦА';detail='Урон '+round(spec.damage)+' · '+spec.range+' м · '+round(spec.interval)+' с/выстрел';
   seconds=remaining(game.heavyCooldown,0);cycle=spec.interval;
  }
  rows.push(row('manual','manual',name,detail,seconds,
   inactive?'НЕДОСТУПНО':heat.locked&&['rail','howitzer'].includes(manual)?'ПЕРЕГРЕВ':
   game.heavyCharge&&manual==='howitzer'?'ПОДГОТОВКА':'','#fbcf9a',
   {key:'ПКМ',icon:manual,cycle}));
 }
 if(profile.howitzer&&manual!=='howitzer'){
  const spec=moduleStats('howitzer',ranks,game.shipLoadout?.specializations?.howitzer);
  rows.push(row('howitzer','manual','ГАУБИЦА · В РЕЗЕРВЕ',
   'Урон '+round(spec.damage)+' · '+spec.range+' м · колесо — выбор',
   remaining(game.heavyCooldown,0),'НЕ ВЫБРАНА',MODULES.howitzer.color,
   {icon:'howitzer',cycle:spec.interval}));
 }
 const tactical=game.tactical||{equipped:'pulse',readyAt:0,branches:{}};
 const tactic=TACTICAL_DEVICES[tactical.equipped]||TACTICAL_DEVICES.pulse;
 const tacticStats=tacticalSpec(tactical);
 const tacticKey=game.controlLabel?.('field')||'Пробел';
 const fieldKind=tacticStats.id==='trap'?'trap':
  tacticStats.id==='pulse'&&tacticStats.branch?.path==='shell'?'shell':null;
 const liveField=fieldKind?(tactical.effects||[]).findLast(effect=>
  effect.kind===fieldKind&&effect.until>time):null;
 const liveCenter=liveField?.kind==='shell'?game.player:liveField;
 const caught=liveField&&liveCenter?(game.enemies||[]).filter(enemy=>enemy.hp>0&&
  !enemy.converted&&!enemy.boss&&Math.hypot(enemy.x-liveCenter.x,enemy.y-liveCenter.y)<=
  liveField.radius+(enemy.r||0)).length:0;
 const effectDetail='Радиус '+round(tacticStats.radius)+' м · '+
  'действует '+round(tacticStats.duration)+' с · '+
  (tacticStats.pulseEvery?(tacticStats.initialDamage?
   'первый удар '+round(tacticStats.initialDamage)+' · ':'')+
   'урон '+round(tacticStats.damage)+' / '+round(tacticStats.pulseEvery)+' с':
   Number.isFinite(tacticStats.damage)?
   'урон '+round(tacticStats.damage):tacticStats.id==='jam'?
   'подавление связи':'отвлечение патруля')+
  (liveField?' · в поле '+caught:'');
 rows.push(row('tactical','manual',tactic.short.toUpperCase(),
  effectDetail+' · перезарядка '+round(tacticStats.cooldown)+' с',
  remaining(tactical.readyAt,time),inactive?'НЕДОСТУПНО':'','#c6b5ff',
  {key:tacticKey.toUpperCase(),icon:tacticStats.id,cycle:tacticStats.cooldown}));
 const loan=game.fieldLoan,spec=loan&&FIELD_WEAPONS[loan.moduleId||'ion'];
 if(spec){
  const fitted=!!profile[spec.id],stats=moduleStats(spec.id,ranks);
  const fieldKey=game.controlLabel?.('fieldWeapon')||'G';
  rows.push(row('field','manual',spec.short.toUpperCase()+' · ∞',
   spec.id==='ion'?'По меткам · урон '+stats.damage+' · '+stats.range+' м · '+round(spec.cooldown)+' с':
    'Передача 35% · 2–3 цели · '+stats.range+' м · связь 4 с · '+round(spec.cooldown)+' с',
   remaining(loan.cooldownUntil,time),!fitted?'НЕ УСТАНОВЛЕНО':
    inactive?'НЕДОСТУПНО':heat.locked?'ПЕРЕГРЕВ':
    game.heavyCharge?'ЗАНЯТА ГАУБИЦА':'',MODULES[spec.id].color,
   {key:fieldKey.toUpperCase(),icon:spec.id,cycle:spec.cooldown}));
 }
 const autoCount=rows.filter(item=>item.kind==='auto').reduce((sum,item)=>
  sum+Number(profile[item.id]||0),0);
 const installedCount=Array.isArray(game.shipLoadout?.slots)?
  fittedModules(game.shipLoadout).filter(Boolean).length:autoCount+
  Number(!!profile.ion)+Number(!!profile.resonator)+Number(!!profile.howitzer);
 const automatic=rows.filter(item=>item.kind==='auto');
 const direct=rows.find(item=>item.id==='manual')||null;
 // This summary is visible *without* opening the deck. Show what is really
 // fitted, not just a count or the tactical key. Statuses use live timers.
 const automaticLabels=automatic.map(item=>item.name);
 const autoName=automaticLabels.length?automaticLabels.join(' · '):'ОРУЖИЕ НЕ УСТАНОВЛЕНО';
 const activeBlocks=automatic.filter(item=>item.state==='blocked');
 const nextCooldown=automatic.filter(item=>item.state==='cooldown');
 const autoStatus=activeBlocks.length?activeBlocks[0].status:
  nextCooldown.length?nextCooldown.map(item=>item.name.split(' ×')[0]+': '+item.status).join(' · '):
  automatic.length?'АВТООГОНЬ · ГОТОВО':'ОТКРОЙТЕ ОСНАЩЕНИЕ НА СТАНЦИИ';
 const quick={
  auto:{id:'auto',key:'АВТО',name:autoName,status:autoStatus,
   state:activeBlocks.length?'blocked':nextCooldown.length?'cooldown':'ready'},
  manual:direct,
  tactical:rows.find(item=>item.id==='tactical'),
  field:rows.find(item=>item.id==='field')||null
 };
 const compact=[quick.auto,quick.manual,quick.tactical,quick.field].filter(Boolean)
  .map(item=>item.key+' · '+item.name+' · '+item.status).join('; ');
 return {rows,autoCount,installedCount,heatPercent,heatLocked:!!heat.locked,compact,quick};
}
