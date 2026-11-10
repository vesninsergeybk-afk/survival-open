/**
 * The machine economy assigns jobs to existing nearby flights.
 *
 * Only real stations, shipments, production and *delivered* sightings matter.
 * No live player state, hidden attacker location, extra enemies or combat
 * multipliers are consulted. Local flights receive orders over real radio.
 */
export const THEATER=Object.freeze({
  tick:1.05,link:510,orderAge:2.3,maxCargoCells:2,maxSiteCells:2,
  maxLines:3,noticeGap:6,contactAge:2.6,threatRadius:430,
  meshResponseRange:920,commitSeconds:9
});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Own logistics can report damage to their hulls, but cannot report the
// attacker's present location. Damage raises the value of saving a shipment;
// it never creates a contact or teleports reinforcements across the map.
const damagePressure=a=>Number.isFinite(a?.hp)&&
  Number.isFinite(a?.maxHp)&&a.maxHp>0?
    Math.round(clamp(1-a.hp/a.maxHp,0,1)*27):0;
const eligible=e=>!!e&&e.hp>0&&!e.converted&&!e.boss&&
  !e.missionStructure&&!e.relayAssault&&!e.interceptCargo&&!e.stationRaid&&
  !e.openingCommander&&!e.protect&&
  (!e.signalIntel||e.signalIntel.mode==='engaged')&&
  e.type!=='healer'&&['scout','fighter','flanker','gunship','berserker'].includes(e.type)&&
  ['hunt','flank','standoff'].includes(e.state);
const active=a=>a&&Number.isFinite(a.x)&&Number.isFinite(a.y)&&
  (a.hp==null||a.hp>0)&&!a.captured;
const cargoes=s=>[
  ...(s?.convoys||[]),...(s?.central?.convoys||[]),
  ...(s?.frontier?.azure?.convoys||[]),
  ...(s?.frontier?.teal?.convoys||[]),
  s?.frontier?.azure?.repairExpedition,s?.frontier?.teal?.repairExpedition
].filter(Boolean);
const label=role=>({
  escort:'СОПРОВОЖДЕНИЕ',screen:'ЗАСЛОН У ТРАНСПОРТА',
  defend:'ОХРАНА УЗЛА',reinforce:'УСИЛИТЬ ОБОРОНУ',
  repel:'ОТТЕСНИТЬ НАПАДАВШЕГО'
})[role]||'ОХРАНА';
function reason(role,item){
  const repair=!!item.asset?.frontierRepair;
  if(role==='escort')return repair?
    'Сопровождать ремонтный корабль. Обеспечить его прибытие!':
    'Сопровождать груз. Сохранить доставку!';
  if(role==='screen')return item.fundedScreen?
    (repair?'Ремонтному кораблю выделено прикрытие. Защитить маршрут!':
     'Защитный конвой подготовлен. Прикрыть груз с флангов!'):
    (repair?'Ремонтный корабль под угрозой. Выставить передний заслон!':
     'Транспорт под угрозой. Выставить передний заслон!');
  if(role==='repel')return 'Контакт подтверждён. Оттеснить от объекта!';
  if(role==='reinforce')return 'Промышленный узел под угрозой. Усилить оборону!';
  return item.reserves>0?
    'На складе есть резервы. Защищать сборочный пост!':
    'Приоритет — сохранить производственный узел. Держать периметр!';
}
const destinationId=c=>c.centralCargo?'industry:depot':
  c.frontierRepair&&['azure','teal'].includes(c.frontierNetwork)?
    'frontier:'+c.frontierNetwork+':'+(c.targetKind==='source'?'source':'depot'):
  c.frontierCargo&&['azure','teal'].includes(c.frontierNetwork)?
    'frontier:'+c.frontierNetwork+':depot':
    c.regionalCargo?'4:-32':null;
function cargoUseful(world,c){
  const id=destinationId(c);
  if(!id)return true;
  const depot=world.stations?.get?.(id);
  // An omitted installation in a small test world is not proof of capture.
  // In the actual game these industrial stations are always instantiated.
  return !depot||!!depot.enemy&&!depot.captured&&depot.hp>0;
}
function paidScreen(world,c,now){
  const s=world.regionalSupply;
  if(c.frontierRepair)return c.screened===true;
  if(c.centralCargo)return s?.central?.strategy?.screened===true;
  if(c.frontierCargo){
    const node=s?.frontier?.[c.frontierNetwork];
    return (node?.strategy?.screenUntil||0)>now;
  }
  return false;
}
function stationReserves(s,role){
  if(role==='military')return s?.reserves||0;
  if(role==='central-depot')return s?.central?.reserves||0;
  if(role==='frontier-azure-depot')return s?.frontier?.azure?.reserves||0;
  if(role==='frontier-teal-depot')return s?.frontier?.teal?.reserves||0;
  return 0;
}

/** The strategy cannot defend an already captured depot's useless cargo or
 * an imaginary station. It evaluates economic value, not just sprite count. */
export function theaterAssets(world,now=0){
  if(!world)return [];
  const state=world.regionalSupply,items=[];
  for(const a of cargoes(state))if(active(a)&&a.id&&cargoUseful(world,a)){
    const fundedScreen=paidScreen(world,a,now);
    items.push({asset:a,id:String(a.id),kind:'cargo',
      fundedScreen,damaged:damagePressure(a)>=12,
      importance:(a.frontierRepair?92:80)+(fundedScreen?9:0)+damagePressure(a),
      max:THEATER.maxCargoCells});
  }
  for(const a of world.stations?.values?.()||[]){
    // Generic high-level stations have no explicit logistics dependency:
    // they already have local turrets and should not steal the theater budget.
    if(!active(a)||!a.enemy||!a.id||a.hp<=0||!a.strategicRole)continue;
    const role=String(a.strategicRole);
    const depot=/military|depot/.test(role);
    const reserves=stationReserves(state,role);
    items.push({asset:a,id:String(a.id),kind:'station',reserves,
      importance:(depot?52:39)+Math.min(2,reserves)*6+damagePressure(a),
      max:THEATER.maxSiteCells});
  }
  return items;
}
const freshContact=(cell,asset,now)=>{
  const intel=cell.intel;
  return intel&&!intel.estimated&&Number.isFinite(intel.at)&&
    now-intel.at>=0&&now-intel.at<=THEATER.contactAge&&
    Number.isFinite(intel.x)&&Number.isFinite(intel.y)&&
    distance(intel,asset)<=THEATER.threatRadius?intel:null;
};

/** A bounded theater auction assigns complementary jobs to local flights.
 * The second flight can repel a *confirmed* attacker while the first guards.
 * An unobserved player cannot be pursued from the economic state alone. */
export function planTheater(cells,world,now,mesh=null){
  const assets=theaterAssets(world,now),candidates=[];
  for(const cell of cells||[]){
    if(!cell||cell.brokenUntil||cell.leader?.hp<=0||
       !Array.isArray(cell.members)||!cell.members.includes(cell.leader))continue;
    const free=cell.members.filter(eligible);
    if(!free.includes(cell.leader)||free.length<2)continue;
    for(const item of assets){
      const d=distance(cell.leader,item.asset);
      // Distant reinforcements need a delivered, asset-specific alarm. A
      // global list of factories alone cannot authorize a remote sortie.
      const networkAlarm=mesh?.alarmFor?.(cell,item.id,now)||null;
      if(d>THEATER.link&&
         (!networkAlarm||d>THEATER.meshResponseRange))continue;
      const incident=cell.incident;
      const witnessed=!!(incident&&now-incident.at>=0&&
        now-incident.at<=6.2&&
        (incident.assetId===item.id||
         (item.kind==='station'&&incident.kind!=='convoy'&&
          distance(incident,item.asset)<230)));
      const contact=freshContact(cell,item.asset,now);
      // An alarm received through the mesh protects an asset, but never
      // grants the defender a live target position.
      const warning=mesh?.bestForCell?.(cell,now)||null;
      const alarm=witnessed||!!contact||!!networkAlarm;
      // Do not pull a squad away from an actual nearby engagement simply to
      // patrol a peaceful factory at the other edge of its radio cell.
      if(!alarm&&cell.intel&&!cell.intel.estimated&&
         now-cell.intel.at>=0&&now-cell.intel.at<=THEATER.contactAge)continue;
      const prior=cell.theaterAssignment;
      const continuing=prior?.assetId===item.id;
      const commitment=continuing&&now-(prior.startedAt??prior.at)<
        THEATER.commitSeconds;
      const previous=continuing?11+(commitment?24:0):0;
      // A genuine new alarm can interrupt routine escort duty.
      const emergency=networkAlarm&&!continuing?27:0;
      candidates.push({cell,item,score:item.importance-d/24+
        (alarm?36:0)+previous+emergency,alarm,contact,warning,networkAlarm});
    }
  }
  candidates.sort((a,b)=>b.score-a.score||
    (a.cell.id||0)-(b.cell.id||0));
  const usedCells=new Set(),counts=new Map(),result=new Map();
  for(const c of candidates){
    if(usedCells.has(c.cell))continue;
    const n=counts.get(c.item.id)||0;
    const max=c.item.kind==='station'&&!c.alarm?1:c.item.max;
    if(n>=max)continue;
    let role;
    if(c.item.kind==='cargo')
      role=n===0?(c.alarm||c.item.fundedScreen||c.item.damaged||
        ['long','area'].includes(c.warning?.kind)?'screen':'escort'):
        (c.contact?'repel':'screen');
    else
      role=c.alarm?(n>0&&c.contact?'repel':'reinforce'):'defend';
    // Archive summaries can alter a formation, never weapons, hulls or
    // production. A delivered warning is required; remote station state
    // is not read as global knowledge by a disconnected squad.
    const wide=c.warning?.kind==='area';
    const prior=c.cell.theaterAssignment;
    const entry={asset:c.item.asset,assetId:c.item.id,
      role,kind:c.item.kind,at:now,
      startedAt:prior?.assetId===c.item.id?(prior.startedAt??prior.at):now,
      spread:wide?1.25:1,
      ...(c.contact?{
        contact:{x:c.contact.x,y:c.contact.y,at:c.contact.at}}:{}),
      reason:c.networkAlarm?'Сеть сообщает о нападении на объект. Усилить охрану!':
        c.item.damaged&&role==='screen'&&!c.alarm?
          (c.item.asset.frontierRepair?
            'Ремонтный корабль повреждён. Закрыть его от нового удара!':
            'Грузовой корабль повреждён. Уплотнить защитный заслон!'):
        c.warning?.archived&&role==='screen'?
          'Архив машин: повторные атаки. Перестроить охрану по данным сети!':
        role==='screen'&&c.warning?.kind==='long'?
          'Сеть предупреждает о дальнобойном оружии. Занять заслон!':
        role==='screen'&&c.warning?.kind==='area'?
          'Сеть предупреждает о площадном оружии. Рассредоточить охрану!':
        reason(role,c.item)};
    result.set(c.cell,entry);
    counts.set(c.item.id,n+1);usedCells.add(c.cell);
  }
  return result;
}

/** Stable, different formation lanes. A fast convoy is intercepted *ahead*
 * along its current route, rather than chased forever by slower fighters.
 * A counterattack remains near the defended site, using a delivered snapshot. */
export function theaterDestination(e,order){
  if(!eligible(e)||!order||!active(order.asset)||
     String(order.asset.id)!==order.assetId)return null;
  const a=order.asset,s=Math.abs(Math.trunc(e.serial||0)),side=s%2?1:-1;
  if(order.role==='repel'){
    if(!order.contact)return null;
    const dx=order.contact.x-a.x,dy=order.contact.y-a.y;
    const d=Math.hypot(dx,dy)||1,limited=Math.min(340,d);
    const x=a.x+dx/d*limited,y=a.y+dy/d*limited;
    return {x:x-dy/d*side*48,y:y+dx/d*side*48,
      mode:order.role,asset:a};
  }
  if(order.kind==='cargo'&&Number.isFinite(a.angle)){
    const heading=a.angle-Math.PI/2;
    const ux=Math.cos(heading),uy=Math.sin(heading);
    const lead=order.role==='screen'?165:82;
    const offset=(order.role==='screen'?120:83)*(order.spread||1);
    return {x:a.x+ux*lead-uy*side*offset,
      y:a.y+uy*lead+ux*side*offset,
      mode:order.role,asset:a};
  }
  if(order.kind==='station'){
    let angle=(s%6)*Math.PI/3-Math.PI/2;
    if(order.role==='reinforce'&&order.contact){
      angle=Math.atan2(order.contact.y-a.y,order.contact.x-a.x)+side*.29;
    }
    const radius=(order.role==='reinforce'?145:180)*(order.spread||1);
    return {x:a.x+Math.cos(angle)*radius,y:a.y+Math.sin(angle)*radius,
      mode:order.role,asset:a};
  }
  // Legacy shipments without a route angle retain a bounded escort position.
  const dx=a.x-e.x,dy=a.y-e.y,d=Math.hypot(dx,dy)||1;
  const ux=dx/d,uy=dy/d;
  return {x:a.x-ux*115-uy*side*68,y:a.y-uy*115+ux*side*68,
    mode:order.role,asset:a};
}

export class EnemyTheaterStrategy{
  constructor(){this.nextTick=0;this.lastMessageAt=-Infinity;this.assignments=new Map();}
  update(game,net){
    const now=game.time;
    if(now<this.nextTick)return;
    this.nextTick=now+THEATER.tick;
    const choices=planTheater(net.cells,game.world,now,net.mesh);
    this.assignments=choices;
    for(const cell of net.cells){
      const chosen=choices.get(cell),prior=cell.theaterAssignment;
      cell.theaterAssignment=chosen||null;
      if(!chosen){
        cell.pendingTheater=null;
        for(const e of cell.members)e._theaterOrder=null;
        continue;
      }
      const changed=!prior||prior.assetId!==chosen.assetId||
        prior.role!==chosen.role||prior.spread!==chosen.spread;
      let recipients=0;
      for(const e of cell.members){
        if(!eligible(e)){e._theaterOrder=null;continue;}
        const delivered=e===cell.leader||
          net.send(cell.leader,e,changed?'strategy':'relay',now);
        if(delivered){
          e._theaterOrder={...chosen,cellId:cell.id,
            leader:cell.leader,receivedAt:now};
          if(e!==cell.leader)recipients++;
        }else e._theaterOrder=null;
      }
      if(!recipients){
        // A commander's private waypoint is not a collective operation.
        cell.theaterAssignment=null;
        this.assignments.delete(cell);
        cell.pendingTheater=null;
        for(const e of cell.members)e._theaterOrder=null;
        continue;
      }
      if(changed)cell.pendingTheater={...chosen,at:now};
    }
  }
  directiveFor(e,now){
    const order=e?._theaterOrder,cell=e?._commsCell;
    if(!eligible(e)||!order||!cell||
       !cell.theaterAssignment||cell.theaterAssignment.assetId!==order.assetId||
       cell.theaterAssignment.role!==order.role||
       cell.theaterAssignment.spread!==order.spread||
       cell.brokenUntil||cell.leader?.hp<=0||
       !cell.members.includes(e)||now-order.receivedAt>THEATER.orderAge||
       distance(e,cell.leader)>THEATER.link||
       !active(order.asset)||
       (order.role==='repel'&&
        (!order.contact||now-order.contact.at>THEATER.contactAge)))return null;
    return order;
  }
  confirmExecution(game,net){
    const now=game.time;
    for(const cell of net.cells){
      const pending=cell.pendingTheater;
      if(!pending||now-pending.at>2.4){cell.pendingTheater=null;continue;}
      if(!cell.theaterAssignment||
         pending.assetId!==cell.theaterAssignment.assetId||
         pending.role!==cell.theaterAssignment.role||
         pending.spread!==cell.theaterAssignment.spread){
        cell.pendingTheater=null;continue;
      }
      // A spoken squad order requires a *recipient* flying it, never the
      // commander's own movement or a stale intent from an earlier order.
      const pilot=cell.members.find(e=>e!==cell.leader&&
        this.directiveFor(e,now)&&e._theaterIntent?.at===now&&
        e._theaterIntent.assetId===pending.assetId&&
        e._theaterIntent.mode===pending.role);
      if(!pilot)continue;
      cell.pendingTheater=null;
      if(!game.playerCanInterceptEnemyRadio?.(cell.leader)&&
         !game.playerCanInspectEnemyIntent?.(cell.leader))continue;
      const item={at:now,until:now+3.2,
        mode:pending.role==='repel'?'intercept':'screen',
        message:pending.reason,leader:cell.leader,cellId:cell.id};
      net.intercepts.push(item);
      if(net.intercepts.length>8)net.intercepts.shift();
      cell.lastTheaterIntercept=item;
      if(now-this.lastMessageAt>=THEATER.noticeGap){
        game.notice?.('Радиоперехват: '+pending.reason,3.4);
        this.lastMessageAt=now;
      }
    }
  }
  render(ctx,cam,now,game,fps=60){
    if(!game?.playerCanInspectEnemyIntent)return;
    let drawn=0;
    for(const cell of this.assignments.keys()){
      if(drawn>=THEATER.maxLines)return;
      const order=cell.theaterAssignment,a=order?.asset;
      const pilot=cell.members.find(e=>e!==cell.leader&&
        this.directiveFor(e,now)&&e._theaterIntent?.at===now&&
        e._theaterIntent.assetId===order.assetId&&
        game.playerCanInspectEnemyIntent(e));
      if(!pilot||!a||!game.playerCanInspectEnemyIntent(a)||
         pilot.x<cam.x-30||pilot.x>cam.x+cam.w+30||
         pilot.y<cam.y-30||pilot.y>cam.y+cam.h+30)continue;
      ctx.globalAlpha=fps<28?.3:.53;
      ctx.strokeStyle='#8ee0b5';ctx.lineWidth=1.4;
      if(fps>=28)ctx.setLineDash([5,9]);
      ctx.beginPath();ctx.moveTo(pilot.x,pilot.y);
      ctx.lineTo(a.x,a.y);ctx.stroke();
      ctx.setLineDash([]);
      ctx.font='bold 9px system-ui';ctx.fillStyle='#a8f2ce';
      ctx.textAlign='center';
      ctx.fillText(label(order.role),pilot.x,
        pilot.y-(pilot.r||14)-40,152);
      drawn++;
    }
  }
}
