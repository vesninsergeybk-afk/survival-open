import {RELAY_DEFENSE,relayDefenseCue} from './relay-defense.js?v=relay-def-1';
// Pure state-derived cues shared by the world renderer and tactical map.
// Rendering never advances mission progress or changes rewards.
export function contractReturnStation(contract, world) {
  if (!contract || !Number.isFinite(contract.goal) || contract.goal <= 0 ||
      !Number.isFinite(contract.progress) || contract.progress < contract.goal) return null;
  const station = world?.stations?.get?.(contract.baseId);
  return station?.active && !station.enemy ? station : null;
}

export function corridorCue(operation, now, distance) {
  if (!operation || operation.id !== 'silent-corridor' || operation.hp <= 0) return null;
  const range = operation.pulseRange || 315;
  const period = operation.pulsePeriod || 4.2;
  if (now < (operation.pulseFlashUntil || 0)) {
    return {key:'discharge', label:'ЭМ-РАЗРЯД', hint:'ОПАСНАЯ ЗОНА · '+range+' М', color:'#ff907e'};
  }
  if (now < (operation.overheatedUntil || 0)) {
    return {key:'overheat', label:'ПЕРЕГРЕВ · УЯЗВИМ', hint:'ЗАЩИТА ОСЛАБЛЕНА · АТАКУЙТЕ', color:'#8bf3cf'};
  }
  const charge = Math.max(0,Math.min(period,operation.pulseCharge || 0));
  if (charge >= period * .78) {
    return {key:'danger', label:'ОПАСНОСТЬ · ИМПУЛЬС',
      hint:'РАЗРЯД ЧЕРЕЗ '+Math.max(.1,period-charge).toFixed(1)+' С · ОТОЙДИТЕ ЗА '+range+' М',
      color:'#ffd083'};
  }
  if (charge > .2) {
    return {key:'charging', label:'ЗАРЯДКА ЭМ-ИМПУЛЬСА',
      hint:(operation.pulseLocked?'РАЗРЯД НЕИЗБЕЖЕН · ':'УСПЕЙТЕ ВЫЙТИ · ')+
       'ОТОЙДИТЕ ЗА '+range+' М', color:'#e6a8ff'};
  }
  return {key:'vulnerable', label:'УЯЗВИМ · МОЖНО АТАКОВАТЬ',
    hint:distance <= (operation.focusRange || 255) ? 'ЛУЧ НАВЕДЁН НА ГЛУШИТЕЛЬ' :
      'ПОДЛЕТИТЕ БЛИЖЕ ДЛЯ АТАКИ', color:'#9de7f5'};
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
   const phase=corridorCue(op,game.time,d)?.label||'СИГНАЛ ПОТЕРЯН';
   return '◈ ГЛУШИТЕЛЬ · '+Math.ceil(op.hp/op.maxHp*100)+'% · '+phase;
  }
  if(op.id==='last-signal')
   return '◈ АВАРИЙНЫЙ ЗОНД · РЕМОНТ '+Math.round(op.repair||0)+'% · '+d+' М';
  if(op.id===RELAY_DEFENSE.id)
   return '◈ РЕТРАНСЛЯТОР · '+Math.ceil(op.hp/op.maxHp*100)+'% · '+relayDefenseCue(op,game.time);
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
