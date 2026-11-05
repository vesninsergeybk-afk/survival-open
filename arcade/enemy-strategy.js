/**
 * Local theater strategy for the hostile machine economy.
 *
 * The industrial network owns installations and moving shipments. Nearby
 * radio cells get finite jobs protecting those assets; autonomous pilots
 * execute the jobs with ordinary steering and remain vulnerable to damage.
 * No player position, HP, weapon or RNG is read here. Enemy sightings remain
 * exclusively in the verified squad-radio channel.
 */
export const THEATER=Object.freeze({
  tick:1.05,link:510,orderAge:2.3,maxCargoCells:2,maxSiteCells:1,
  maxLines:3,noticeGap:6
});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const eligible=e=>!!e&&e.hp>0&&!e.converted&&!e.boss&&
  !e.missionStructure&&!e.relayAssault&&!e.interceptCargo&&!e.stationRaid&&
  !e.openingCommander&&!e.protect&&
  (!e.signalIntel||e.signalIntel.mode==='engaged')&&
  e.type!=='healer'&&['scout','fighter','flanker','gunship','berserker'].includes(e.type);
const active=a=>a&&Number.isFinite(a.x)&&Number.isFinite(a.y)&&
  (a.hp==null||a.hp>0)&&!a.captured;
const cargoes=s=>[
  ...(s?.convoys||[]),...(s?.central?.convoys||[]),
  ...(s?.frontier?.azure?.convoys||[]),
  ...(s?.frontier?.teal?.convoys||[])
];
const label=role=>({
  escort:'СОПРОВОЖДЕНИЕ',screen:'ПРИКРЫТЬ ТРАНСПОРТ',
  defend:'ОХРАНА УЗЛА',reinforce:'УСИЛИТЬ ОБОРОНУ'
})[role]||'ОХРАНА';
const reason=(role,asset)=>role==='escort'?
  'Сопровождать груз. Не дать сорвать доставку!':
  role==='screen'?'Транспорт под угрозой. Занять передний заслон!':
  role==='reinforce'?'Промышленный узел под угрозой. Усилить оборону!':
  'Приоритет — сохранить производственный узел. Держать периметр!';

/** Only existing, living industrial objects can become strategic assets.
 * World state is consulted as the object's own inventory, not player intel. */
export function theaterAssets(world){
  if(!world)return [];
  const state=world.regionalSupply,items=[];
  for(const a of cargoes(state))if(active(a)&&a.id){
    items.push({asset:a,id:String(a.id),kind:'cargo',importance:80,max:THEATER.maxCargoCells});
  }
  for(const a of world.stations?.values?.()||[]){
    if(!active(a)||!a.enemy||!a.id||a.hp<=0||
       !(a.strategicRole||a.rank>=2))continue;
    const role=String(a.strategicRole||'');
    const depot=/military|depot/.test(role)||a.type==='carrier';
    const reserves=role==='military'?state?.reserves:
      role==='central-depot'?state?.central?.reserves:
      role==='frontier-azure-depot'?state?.frontier?.azure?.reserves:
      role==='frontier-teal-depot'?state?.frontier?.teal?.reserves:0;
    items.push({asset:a,id:String(a.id),kind:'station',
      importance:(depot?52:37)+(reserves>0?10:0),
      max:THEATER.maxSiteCells});
  }
  return items;
}

/** Select complementary jobs for different nearby squads. Local command range
 * is a hard gate: a remote cell does not know about a distant shipment.
 * An escort is never reclassified as a raider simply because it sees a player.
 */
export function planTheater(cells,world,now){
  const assets=theaterAssets(world),candidates=[];
  for(const cell of cells||[]){
    if(!cell||cell.brokenUntil||cell.leader?.hp<=0||
       !Array.isArray(cell.members)||!cell.members.includes(cell.leader))continue;
    const free=cell.members.filter(eligible);
    if(!free.includes(cell.leader)||free.length<2)continue;
    for(const item of assets){
      const d=distance(cell.leader,item.asset);
      if(d>THEATER.link)continue;
      const incident=cell.incident;
      const witnessed=incident&&now-incident.at<=6.2&&
        (incident.assetId===item.id||
         (item.kind==='station'&&incident.kind!=='convoy'&&
          distance(incident,item.asset)<230));
      const previous=cell.theaterAssignment?.assetId===item.id?11:0;
      candidates.push({cell,item,score:item.importance-d/24+
        (witnessed?32:0)+previous,alarm:!!witnessed});
    }
  }
  candidates.sort((a,b)=>b.score-a.score||
    (a.cell.id||0)-(b.cell.id||0));
  const usedCells=new Set(),counts=new Map(),result=new Map();
  for(const c of candidates){
    if(usedCells.has(c.cell))continue;
    const n=counts.get(c.item.id)||0;
    if(n>=c.item.max)continue;
    const role=c.item.kind==='cargo'?(n===0?'escort':'screen'):
      c.alarm?'reinforce':'defend';
    const entry={asset:c.item.asset,assetId:c.item.id,
      role,kind:c.item.kind,at:now,reason:reason(role,c.item.asset)};
    result.set(c.cell,entry);
    counts.set(c.item.id,n+1);usedCells.add(c.cell);
  }
  return result;
}

/** A command gives a waypoint around a real asset. It never teleports units,
 * raises stats, predicts the player's unseen position or changes shot rules. */
export function theaterDestination(e,order){
  if(!eligible(e)||!order||!active(order.asset)||
     String(order.asset.id)!==order.assetId)return null;
  const a=order.asset,s=e.serial||0,side=s%2?1:-1;
  const dx=a.x-e.x,dy=a.y-e.y,d=Math.hypot(dx,dy)||1;
  const ux=dx/d,uy=dy/d;
  const distToAsset=order.role==='screen'?164:
    order.role==='escort'?115:
    order.role==='reinforce'?155:185;
  const lateral=side*(order.role==='screen'?100:68);
  // Moving cargo does not need hidden player coordinates. The orbit is
  // bounded and its center follows only the visible, known transport.
  return {x:a.x-ux*distToAsset-uy*lateral,
    y:a.y-uy*distToAsset+ux*lateral,
    mode:order.role,asset:a};
}

export class EnemyTheaterStrategy{
  constructor(){this.nextTick=0;this.lastMessageAt=-Infinity;this.assignments=new Map();}
  update(game,net){
    const now=game.time;
    if(now<this.nextTick)return;
    this.nextTick=now+THEATER.tick;
    const choices=planTheater(net.cells,game.world,now);
    this.assignments=choices;
    for(const cell of net.cells){
      const chosen=choices.get(cell),prior=cell.theaterAssignment;
      cell.theaterAssignment=chosen||null;
      if(!chosen){for(const e of cell.members)e._theaterOrder=null;continue;}
      const changed=!prior||prior.assetId!==chosen.assetId||
        prior.role!==chosen.role;
      for(const e of cell.members){
        if(!eligible(e)){e._theaterOrder=null;continue;}
        const delivered=e===cell.leader||
          net.send(cell.leader,e,changed?'strategy':'relay',now);
        if(delivered)e._theaterOrder={...chosen,cellId:cell.id,
          leader:cell.leader,receivedAt:now};
      }
      if(changed)cell.pendingTheater={...chosen,at:now};
    }
  }
  directiveFor(e,now){
    const order=e?._theaterOrder,cell=e?._commsCell;
    if(!eligible(e)||!order||!cell||
       !cell.theaterAssignment||cell.theaterAssignment.assetId!==order.assetId||
       cell.theaterAssignment.role!==order.role||
       cell.brokenUntil||cell.leader?.hp<=0||
       !cell.members.includes(e)||now-order.receivedAt>THEATER.orderAge||
       distance(e,cell.leader)>THEATER.link||
       !active(order.asset))return null;
    return order;
  }
  confirmExecution(game,net){
    const now=game.time;
    for(const cell of net.cells){
      const pending=cell.pendingTheater;
      if(!pending||now-pending.at>2.4){cell.pendingTheater=null;continue;}
      if(!cell.theaterAssignment||
         pending.assetId!==cell.theaterAssignment.assetId||
         pending.role!==cell.theaterAssignment.role){
        cell.pendingTheater=null;continue;
      }
      const pilot=cell.members.find(e=>e._theaterIntent?.at===now&&
        e._theaterIntent.assetId===pending.assetId&&
        e._theaterIntent.mode===pending.role);
      if(!pilot)continue;
      cell.pendingTheater=null;
      if(!game.playerCanInterceptEnemyRadio?.(cell.leader)&&
         !game.playerCanInspectEnemyIntent?.(cell.leader))continue;
      const item={at:now,until:now+3.2,mode:'screen',
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
      const a=cell.theaterAssignment?.asset;
      const pilot=cell.members.find(e=>e._theaterIntent?.at===now&&
        e._theaterIntent.assetId===cell.theaterAssignment?.assetId&&
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
      ctx.fillText(label(cell.theaterAssignment.role),pilot.x,
        pilot.y-(pilot.r||14)-40,152);
      drawn++;
    }
  }
}
