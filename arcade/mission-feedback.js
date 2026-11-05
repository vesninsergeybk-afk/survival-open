import {MODULES,moduleStats} from './ship-loadout.js?v=weapons-cycle-2-campaign-1-menu-focus-1';
import {RELAY_DEFENSE,relayDefenseCue} from './relay-defense.js?v=relay-def-1';
import {CARRIER_INTERCEPTION,carrierDistanceRemaining,carrierTacticalCue,carrierPulseState} from './carrier-interception.js?v=carrier-intercept-2-campaign-1';
// Pure state-derived cues shared by the world renderer and tactical map.
// Rendering never advances mission progress or changes rewards.
export function contractReturnStation(contract, world) {
  if (!contract || !Number.isFinite(contract.goal) || contract.goal <= 0 ||
      !Number.isFinite(contract.progress) || contract.progress < contract.goal) return null;
  const station = world?.stations?.get?.(contract.baseId);
  return station?.active && !station.enemy ? station : null;
}

export function automaticRange(game){
 const slots=game.shipLoadout?.slots||['plasma'];
 return Math.max(0,...slots.filter(id=>MODULES[id]?.kind==='auto').map(id=>
  moduleStats(id,game.skillRanks||{},game.shipLoadout?.specializations?.[id]).range));
}

export function corridorCue(operation, now, distance, attackRange=435) {
  if (!operation || operation.id !== 'silent-corridor' || operation.hp <= 0) return null;
  const range = operation.pulseRange || 315;
  const period = operation.pulsePeriod || 4.2;
  const inPulseZone = Number.isFinite(distance) && distance <= range;
  // A pulse hits once at discharge, not throughout the post-pulse visual flash.
  if (now < (operation.pulseFlashUntil || 0)) {
    return {key:'discharge', label:'ЭМ-РАЗРЯД ПРОШЁЛ',
      hint:'ИМПУЛЬС СРАБОТАЛ · '+(distance<=attackRange?'АТАКУЙТЕ':'ЦЕЛЬ ВНЕ ДАЛЬНОСТИ'), color:'#ffb69a'};
  }
  // Only actual overheat applies the 35% damage bonus.
  if (now < (operation.overheatedUntil || 0)) {
    return {key:'overheat', label:'ПЕРЕГРЕВ · УЯЗВИМ',
      hint:'ОРУЖИЕ +35% УРОНА · '+(distance<=attackRange?'АТАКУЙТЕ':'СБЛИЗЬТЕСЬ ДО '+attackRange+' М'), color:'#8bf3cf'};
  }
  const charge = Math.max(0,Math.min(period,operation.pulseCharge || 0));
  if (charge >= period * .78) {
    const remaining = Math.max(.1,period-charge).toFixed(1);
    return {key:'danger', label:'СКОРО ЭМ-РАЗРЯД',
      hint:inPulseZone?'ЧЕРЕЗ '+remaining+' С · ВЫЙДИТЕ ЗА '+range+' М':
        'ВНЕ ЗОНЫ УДАРА · ДО РАЗРЯДА '+remaining+' С',
      color:'#ffd083'};
  }
  if (charge > .2) {
    return {key:'charging', label:'ЗАРЯДКА ЭМ-ИМПУЛЬСА',
      hint:inPulseZone?
        (operation.pulseLocked?'РАЗРЯД БУДЕТ · ':'ЗАРЯДКА ИДЁТ · ')+'ВЫЙДИТЕ ЗА '+range+' М':
        (operation.pulseLocked?'ВНЕ ЗОНЫ УДАРА · ЗАРЯДКА ИДЁТ':'ВНЕ ЗОНЫ УДАРА · ЗАРЯД СНИЖАЕТСЯ'),
      color:'#e6a8ff'};
  }
  const focusRange = attackRange;
  if (distance > focusRange) return {key:'approach', label:'ЦЕЛЬ ВНЕ ДАЛЬНОСТИ',
    hint:'ДО ЦЕЛИ '+Math.round(distance)+' М · АВТООРУДИЯ ДО '+focusRange+' М', color:'#9de7f5'};
  // Distance permits an attack; an asteroid may still obstruct the actual shot.
  return {key:'ready', label:'АТАКА ДОСТУПНА',
    hint:'АВТООРУДИЯ ДО '+focusRange+' М · ПРОВЕРЬТЕ ПРЕГРАДЫ', color:'#9de7f5'};
}

// Only the issuing friendly station defines an active defense contract perimeter.
export function contractDefenseZone(contract, world) {
  if (contract?.kind !== 'defend' || !Number.isFinite(contract.goal) || contract.goal <= 0 ||
      !Number.isFinite(contract.progress) || contract.progress >= contract.goal) return null;
  const station = world?.stations?.get?.(contract.baseId);
  return station?.active && !station.enemy ? {station, radius:650} : null;
}

// Compact, literal mission status for the cockpit. Uses the same real state as map/world.
export function missionHudText(game) {
 const p=game?.player,op=game?.operation,c=game?.contract;
 if(!p||(!op&&!c))return '';
 if(op){
  const d=Math.round(Math.hypot(op.x-p.x,op.y-p.y));
  if(op.id==='silent-corridor'){
   if(op.phase==='return'){
    const base=game.world?.stations?.get?.(op.baseId);
    const homeDistance=base?Math.round(Math.hypot(base.x-p.x,base.y-p.y)):d;
    return '✓ ГЛУШИТЕЛЬ ОТКЛЮЧЁН · ВЕРНИТЕСЬ В ДОК · '+homeDistance+' М';
   }
   const phase=corridorCue(op,game.time,d,automaticRange(game))?.label||'СИГНАЛ ПОТЕРЯН';
   return '◈ ГЛУШИТЕЛЬ · '+Math.ceil(op.hp/op.maxHp*100)+'% · '+phase;
  }
  if(op.id==='last-signal')
   return '◈ АВАРИЙНЫЙ ЗОНД · РЕМОНТ '+Math.round(op.repair||0)+'% · '+d+' М';
  if(op.id===RELAY_DEFENSE.id)
   return '◈ РЕТРАНСЛЯТОР · '+Math.ceil(op.hp/op.maxHp*100)+'% · '+relayDefenseCue(op,game.time);
  if(op.id===CARRIER_INTERCEPTION.id){
   if(op.phase==='return'){
    const base=game.world?.stations?.get?.(op.baseId);
    return '✓ ГРУЗ ПЕРЕХВАЧЕН · ВЕРНИТЕСЬ НА АВИАНОСЕЦ · '+
     (base?Math.round(Math.hypot(base.x-p.x,base.y-p.y)):d)+' М';
   }
   if(op.phase==='approach')return '◈ ПЕРЕХВАТ · НАЙДИТЕ РАЙОН ВСТРЕЧИ · '+d+' М';
   const urgent=carrierPulseState(op).key!=='cruise'||
    op.flightTime<(op.engineDisabledUntil||0)||(op.boostWarned&&!op.boosted);
   return '◈ ПЕРЕХВАТ · ГРУЗ '+Math.ceil(op.hp/op.maxHp*100)+'% · '+
    (urgent?carrierTacticalCue(op,p):'ДО ВЫХОДА '+Math.ceil(carrierDistanceRemaining(op))+' М');
  }
  return '◈ ОПЕРАЦИЯ · '+d+' М';
 }
 const station=game.world?.stations?.get?.(c.baseId);
 const d=station?Math.round(Math.hypot(station.x-p.x,station.y-p.y)):0;
 if(c.progress>=c.goal)
  return '✓ '+c.name+' · ВЕРНИТЕСЬ НА БАЗУ · '+d+' М';
 const zone=contractDefenseZone(c,game.world);
 if(zone){
  const radiusDistance=Math.hypot(zone.station.x-p.x,zone.station.y-p.y)-zone.radius;
  return c.name+' · '+c.progress+'/'+c.goal+' · '+
   (radiusDistance<=0?'В ЗОНЕ ЗАЩИТЫ':'ДО ЗОНЫ '+Math.ceil(radiusDistance)+' М');
 }
 return c.name+' · '+c.progress+'/'+c.goal+' · ПОЛЕВОЙ ЗАКАЗ';
}
