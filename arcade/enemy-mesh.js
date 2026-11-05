/**
 * Enemy threat mesh: small, delayed, store-and-forward intelligence packets.
 *
 * Local perception is the ONLY source. A relayed warning describes an observed
 * weapon or attacked asset, never the player's live location or health.
 * Ships and surviving enemy stations are physical radio nodes; destroying or
 * suppressing a relay breaks the route. No neural nets, spawned units or stat
 * modifiers are involved.
 */
export const ENEMY_MESH=Object.freeze({
  tick:.72,flight:.66,shipLink:510,stationLink:1050,backboneLink:1450,
  bucket:1550,maxHops:12,maxTransfers:36,maxPending:112,
  maxPerNode:12,maxEvents:28,maxDrawn:5,
  weaponLife:48,contactLife:15,incidentLife:36,tacticalAge:20,
  stationMemory:6
});
const weaponKinds=new Set(['area','long','close']);
const allowedKinds=new Set([...weaponKinds,'contact','sabotage']);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const valid=(p,now)=>!!p&&typeof p.id==='string'&&p.id.length<=192&&
  allowedKinds.has(p.kind)&&finite(p.at)&&finite(p.until)&&
  p.at<=now&&p.until>now&&p.until-p.at<=ENEMY_MESH.weaponLife+1&&
  Number.isInteger(p.hops)&&p.hops>=0&&p.hops<=ENEMY_MESH.maxHops&&
  (p.assetId==null||typeof p.assetId==='string'&&p.assetId.length<=100);
const nodeAlive=(n,now)=>n.kind==='station'?
  !!n.ref?.enemy&&!n.ref.captured&&!n.ref.suppressed&&n.ref.hp>0:
  !!n.ref?.leader&&n.ref.leader.hp>0&&!n.ref.brokenUntil;
const linkLimit=(a,b)=>a.kind==='station'&&b.kind==='station'?
  ENEMY_MESH.backboneLink:
  a.kind==='station'||b.kind==='station'?
    ENEMY_MESH.stationLink:ENEMY_MESH.shipLink;
const nodePoint=node=>node.kind==='station'?node.ref:node.ref.leader;
const keyFor=(x,y)=>Math.floor(x/ENEMY_MESH.bucket)+':'+
  Math.floor(y/ENEMY_MESH.bucket);
const stationEligible=a=>a?.enemy&&!a.captured&&!a.suppressed&&a.hp>0&&
  (a.strategicRole||a.type==='carrier')&&finite(a.x)&&finite(a.y);
const cellEligible=c=>c?.leader?.hp>0&&!c.brokenUntil&&
  finite(c.leader.x)&&finite(c.leader.y);
const reportLabel=kind=>({
  long:'дальнобойное оружие',
  area:'площадное оружие',
  close:'оружие ближнего боя',
  sabotage:'нападение на объект',
  contact:'обнаруженный корабль'
})[kind]||'новая угроза';

/** Every node has a private cache; no magic faction-wide shared map. */
export class EnemyMesh{
  constructor(){
    this.nodes=new Map();this.pending=[];this.events=[];
    this.nextTick=0;this.lastNow=0;this.nextNoticeAt=-Infinity;
    this.messages=0;this.deliveries=0;
  }
  update(game,cells,now=game?.time??0,net=null){
    if(!finite(now))return;
    if(now<this.lastNow-.01){
      // Checkpoint rollbacks must not retain information from the lost sortie.
      this.nodes.clear();this.pending=[];this.events=[];this.nextTick=0;
    }
    this.lastNow=now;
    if(now<this.nextTick)return;
    this.nextTick=now+ENEMY_MESH.tick;
    const next=new Map(),add=(id,kind,ref)=>{
      const old=this.nodes.get(id);
      const node={id,kind,ref,known:old?.ref===ref?old.known:new Map()};
      if(kind==='station'&&node.known.size===0&&
         Array.isArray(ref.meshIntel)){
        for(const p of ref.meshIntel.slice(-ENEMY_MESH.stationMemory))
          if(valid(p,now))node.known.set(p.id,{...p});
      }
      for(const [id,p] of node.known)
        if(!valid(p,now))node.known.delete(id);
      next.set(id,node);
    };
    for(const c of cells||[])if(cellEligible(c))add('c:'+c.id,'cell',c);
    for(const s of game?.world?.stations?.values?.()||[])
      if(stationEligible(s))add('s:'+s.id,'station',s);
    this.nodes=next;
    this.events=this.events.filter(x=>now-x.at<1.1);
    // One hop must finish before the next begins. A lost transmitter, captured
    // base or broken radio during the flight drops the packet.
    const nextPending=[];
    for(const item of this.pending){
      if(item.arrives>now){nextPending.push(item);continue;}
      const from=next.get(item.from),to=next.get(item.to);
      if(!from||!to||!nodeAlive(from,now)||!nodeAlive(to,now)||
         distance(nodePoint(from),nodePoint(to))>linkLimit(from,to)||
         !valid(item.packet,now)||to.known.has(item.packet.id))continue;
      const received={...item.packet,hops:item.packet.hops+1};
      if(received.hops>ENEMY_MESH.maxHops)continue;
      to.known.set(received.id,received);
      this.prune(to,now);
      this.deliveries++;
      this.events.push({from:nodePoint(from),to:nodePoint(to),
        kind:received.kind,at:now});
      if(to.kind==='station')this.rememberStation(to,now);
      if(to.kind==='cell'&&received.kind!=='contact'&&
         now>=this.nextNoticeAt&&
         game.playerCanInterceptEnemyRadio?.(to.ref.leader)){
        const message='Сеть передала: '+reportLabel(received.kind)+
          '. Звено получило предупреждение.';
        game.notice?.('Радиоперехват: '+message,3.2);
        if(net?.intercepts){
          net.intercepts.push({at:now,until:now+3.2,
            mode:'network',message,leader:to.ref.leader,cellId:to.ref.id});
          if(net.intercepts.length>8)net.intercepts.shift();
        }
        this.nextNoticeAt=now+7;
      }
    }
    this.pending=nextPending;
    if(this.events.length>ENEMY_MESH.maxEvents)
      this.events.splice(0,this.events.length-ENEMY_MESH.maxEvents);
    // Only corroborated local reports enter the shared mesh. Receiving a
    // remote report never generates a new "observation".
    for(const cell of cells||[]){
      const node=next.get('c:'+cell.id);if(!node)continue;
      const recent=(cell.attackReports||[]).filter(r=>r&&finite(r.at)&&
        now-r.at>=0&&now-r.at<=7&&weaponKinds.has(r.kind))
        .sort((a,b)=>a.at-b.at);
      const latest=recent.at(-1);
      if(latest&&recent.some(r=>r!==latest&&r.kind===latest.kind&&
         latest.at-r.at>=.9)){
        this.publish(node,{kind:latest.kind,at:latest.at},now);
      }
      const incident=cell.incident;
      if(incident&&finite(incident.at)&&now-incident.at<=3.2)
        this.publish(node,{kind:'sabotage',at:incident.at,
          assetId:incident.assetId??null},now);
      // A lone surviving scout cannot command a tactical cell, but its own
      // direct sight or witnessed sabotage can still enter the mesh.
      const lone=cell.members?.length===1?cell.members[0]:null;
      const aloneIncident=lone?._commsIncident;
      if(aloneIncident&&finite(aloneIncident.at)&&
         now-aloneIncident.at<=3.2)
        this.publish(node,{kind:'sabotage',at:aloneIncident.at,
          assetId:aloneIncident.assetId??null},now);
      const sight=cell.intel||lone?._commsSight;
      if(sight&&!sight.estimated&&finite(sight.at)&&now-sight.at<=1.2)
        this.publish(node,{kind:'contact',at:sight.at},now);
    }
    // Spatial hash avoids an all-pairs mesh graph with large enemy counts.
    const buckets=new Map();
    for(const node of next.values()){
      const p=nodePoint(node),key=keyFor(p.x,p.y);
      if(!buckets.has(key))buckets.set(key,[]);
      buckets.get(key).push(node);
    }
    const queued=new Set(this.pending.map(t=>t.to+'|'+t.packet.id));
    let scheduled=0;
    for(const node of next.values()){
      if(scheduled>=ENEMY_MESH.maxTransfers||
         this.pending.length>=ENEMY_MESH.maxPending)break;
      const p=nodePoint(node),cx=Math.floor(p.x/ENEMY_MESH.bucket),
        cy=Math.floor(p.y/ENEMY_MESH.bucket);
      const neighbours=[];
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)
        for(const other of buckets.get((cx+dx)+':'+(cy+dy))||[])
          if(other!==node&&distance(p,nodePoint(other))<=linkLimit(node,other))
            neighbours.push(other);
      neighbours.sort((a,b)=>distance(p,nodePoint(a))-
        distance(p,nodePoint(b))||a.id.localeCompare(b.id));
      const reports=[...node.known.values()].filter(x=>valid(x,now)&&
        x.hops<ENEMY_MESH.maxHops).sort((a,b)=>b.at-a.at);
      let sent=0;
      for(const other of neighbours){
        if(sent>=3||scheduled>=ENEMY_MESH.maxTransfers||
           this.pending.length>=ENEMY_MESH.maxPending)break;
        for(const packet of reports){
          const key=other.id+'|'+packet.id;
          if(other.known.has(packet.id)||queued.has(key))continue;
          this.pending.push({from:node.id,to:other.id,packet,
            arrives:now+ENEMY_MESH.flight});
          queued.add(key);scheduled++;sent++;this.messages++;
          break;
        }
      }
    }
  }
  publish(node,report,now){
    const life=report.kind==='contact'?ENEMY_MESH.contactLife:
      report.kind==='sabotage'?ENEMY_MESH.incidentLife:
      ENEMY_MESH.weaponLife;
    // Continuous visual contact is one ongoing observation, not a new
    // packet every frame. Preserve bandwidth for actual changed threats.
    if(report.kind==='contact'&&[...node.known.values()].some(p=>
       p.kind==='contact'&&p.origin===node.id&&now-p.at<7))return false;
    const id=node.id+':'+report.kind+':'+Math.floor(report.at*2)+
      (report.assetId?':'+report.assetId:'');
    if(node.known.has(id))return false;
    const packet={id,kind:report.kind,at:report.at,until:report.at+life,
      hops:0,origin:node.id,assetId:report.assetId||null};
    if(!valid(packet,now))return false;
    node.known.set(id,packet);this.prune(node,now);return true;
  }
  prune(node,now){
    for(const [id,p] of node.known)if(!valid(p,now))node.known.delete(id);
    if(node.known.size>ENEMY_MESH.maxPerNode){
      const oldest=[...node.known.values()].sort((a,b)=>a.at-b.at);
      for(const p of oldest.slice(0,node.known.size-ENEMY_MESH.maxPerNode))
        node.known.delete(p.id);
    }
  }
  rememberStation(node,now){
    if(!node.ref.strategicRole)return;
    node.ref.meshIntel=[...node.known.values()].filter(p=>valid(p,now))
      .sort((a,b)=>b.at-a.at)
      .slice(0,ENEMY_MESH.stationMemory).map(p=>({...p}));
  }
  bestForCell(cell,now){
    const node=this.nodes.get('c:'+cell?.id);
    if(!node)return null;
    return [...node.known.values()].filter(p=>weaponKinds.has(p.kind)&&
      p.origin!==node.id&&now-p.at>=0&&
      now-p.at<=ENEMY_MESH.tacticalAge)
      .sort((a,b)=>b.at-a.at)[0]||null;
  }
  alarmFor(cell,assetId,now){
    if(!assetId)return null;
    const node=this.nodes.get('c:'+cell?.id);
    if(!node)return null;
    return [...node.known.values()].filter(p=>p.kind==='sabotage'&&
      p.origin!==node.id&&p.assetId===String(assetId)&&
      now-p.at>=0&&now-p.at<=ENEMY_MESH.tacticalAge)
      .sort((a,b)=>b.at-a.at)[0]||null;
  }
  render(ctx,cam,now,game,fps=60){
    if(!game?.playerCanInspectEnemyIntent)return 0;
    let drawn=0;ctx.save();
    for(let i=this.events.length-1;i>=0&&drawn<
      (fps<28?2:ENEMY_MESH.maxDrawn);i--){
      const event=this.events[i],a=event.from,b=event.to;
      if(!a||!b||now-event.at>1.1||
         !game.playerCanInspectEnemyIntent(a)||
         !game.playerCanInspectEnemyIntent(b)||
         (a.x<cam.x&&b.x<cam.x)||(a.x>cam.x+cam.w&&b.x>cam.x+cam.w)||
         (a.y<cam.y&&b.y<cam.y)||(a.y>cam.y+cam.h&&b.y>cam.y+cam.h))
        continue;
      ctx.globalAlpha=(1-(now-event.at)/1.1)*(fps<28?.35:.75);
      ctx.strokeStyle=event.kind==='sabotage'?'#ffbe82':'#71e7d6';
      ctx.lineWidth=1.6;
      if(fps>=28)ctx.setLineDash([6,7]);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      ctx.setLineDash([]);drawn++;
    }
    ctx.restore();return drawn;
  }
}
