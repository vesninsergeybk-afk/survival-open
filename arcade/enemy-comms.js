/** Short-range enemy radio. Messages carry actual local observations, and
 * decisions use votes from several pilots. Visual pulses are message receipts,
 * never decorative lines drawn between arbitrary nearby sprites. */
export const ENEMY_COMMS=Object.freeze({
  range:285,cellSize:7,tick:.62,sightAge:2.6,
  breakSeconds:.78,decisionSeconds:2.9,broadcastInterval:1.55,
  pulseSeconds:.76,maxEvents:68,maxDrawn:16,
  attackMemory:13,attackFresh:7,maxAttackReports:12
});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const legal=e=>!!e&&e.hp>0&&!e.converted&&!e.boss&&
  !e.missionStructure&&!e.relayAssault&&!e.interceptCargo&&
  (!e.signalIntel||e.signalIntel.mode!=='withdraw');
const rank=e=>({gunship:7,fighter:6,flanker:5,scout:4,
  berserker:3,healer:2})[e.type]||1;
const isVisible=(a,cam,pad=20)=>a&&a.x>=cam.x-pad&&
  a.x<=cam.x+cam.w+pad&&a.y>=cam.y-pad&&a.y<=cam.y+cam.h+pad;
const color=kind=>kind==='contact'?'#b69aff':
  kind==='distress'||kind==='weapon'?'#ffc17b':'#80dcec';
const modeLabel=Object.freeze({press:'НАЖИМ',pincer:'ОБХОД',
  intercept:'ПЕРЕХВАТ',screen:'ПРИКРЫТИЕ',
  close:'СБЛИЖЕНИЕ',scatter:'РАССЕЯТЬСЯ'});

/** These are orders produced by the selected maneuver. Explanations about
 * observed weapons only appear after delivered, repeated evidence. */
export function enemyOrderMessage(mode,threat=null){
  if(mode==='close'&&threat?.kind==='long')
    return 'Он бьёт издалека. Всем на сближение!';
  if(mode==='scatter'&&threat?.kind==='area')
    return 'У него площадное оружие. Рассредоточиться!';
  return ({press:'Контакт подтверждён. Держать давление!',
    pincer:'Два звена — обойти цель с флангов.',
    intercept:'Цель маневрирует. Перехватить курс!',
    screen:'Ремонтник под угрозой. Прикрыть!',
    close:'Сократить дистанцию. Держать строй!',
    scatter:'Разомкнуть строй! Увеличить интервалы.'})[mode]||null;
}

/** A ship can recognize the weapon that actually struck it and approximate
 * firing distance. These are observations, not privileged loadout queries. */
export function classifyEnemyAttack(weapon,range){
  if(!Number.isFinite(range)||range<0)return null;
  if(weapon==='ion'||weapon==='howitzer')return 'area';
  if(!['beam','rail','rocket','flak'].includes(weapon))return null;
  if(range>=270)return 'long';
  if(range<=155)return 'close';
  return null;
}

/** Require repeat evidence separated in time: one lucky hit cannot change
 * a whole flight's doctrine. Classification expires without new reports. */
export function assessEnemyThreat(reports,now){
  const recent=(reports||[]).filter(r=>r&&Number.isFinite(r.at)&&
    now-r.at>=0&&now-r.at<=ENEMY_COMMS.attackMemory);
  for(const kind of ['area','long','close']){
    const items=recent.filter(r=>r.kind===kind).sort((a,b)=>a.at-b.at);
    if(items.length<2||now-items[items.length-1].at>ENEMY_COMMS.attackFresh||
       items[items.length-1].at-items[0].at<.9)continue;
    return {kind,samples:items.length,lastAt:items[items.length-1].at};
  }
  return null;
}

/** A vote depends on the pilot's learned behavior, its equipment and damage.
 * Nothing here can alter an authored mission target or the projectile budget. */
export function collectiveVote(e,hasMedic=false){
  const result={press:0,pincer:0,intercept:0,screen:0,close:0,scatter:0};
  const style=e._enemyLearning?.style;
  if(hasMedic&&e.hp/e.maxHp<.52){result.screen+=3;return result;}
  switch(e.type){
   case 'scout':
    if(style==='cutoff')result.intercept+=2;
    else result.pincer+=style==='diverge'?2:1;
    break;
   case 'fighter':
    if(style==='intercept')result.intercept+=2;
    else if(style==='pressure')result.press+=2;
    else result.pincer++;
    break;
   case 'flanker':
    if(style==='cutoff')result.intercept+=2;
    else result.pincer+=2;
    break;
   case 'healer':
    result.screen+=hasMedic?1.1:.5;break;
   case 'berserker':
    if(style==='offset')result.pincer+=2;
    else if(style==='intercept')result.intercept+=2;
    else result.press+=2;
    break;
   case 'gunship':
    if(style==='sideslip')result.pincer+=2;
    else if(style==='intercept')result.intercept+=2;
    else result.press+=1.4;
  }
  return result;
}

export function collectiveDecision(members,intel,threat=null){
  const hasMedic=members.some(e=>e.type==='healer'&&(e.healReserve??110)>0);
  return tallyVotes(members.map(e=>collectiveVote(e,hasMedic)),intel,hasMedic,threat);
}

function tallyVotes(proposals,intel,hasMedic,threat=null){
  const votes={press:0,pincer:0,intercept:0,screen:0,close:0,scatter:0};
  for(const choice of proposals)
    for(const key of Object.keys(votes))votes[key]+=choice[key]||0;
  if(!hasMedic)votes.screen=0;
  if(intel&&Math.hypot(intel.vx||0,intel.vy||0)>130)
    votes.intercept+=1.2;
  // Strong counterplay comes from positioning, never free speed or damage.
  // The finite bias can still lose to several pilots protecting a medic.
  if(threat?.kind==='long')votes.close+=13;
  if(threat?.kind==='area')votes.scatter+=13;
  if(threat?.kind==='close')votes.pincer+=3;
  // A wounded flight changes its priorities only when there is somebody to
  // protect; it cannot obtain free repairs by voting for the screen maneuver.
  const mode=Object.keys(votes).reduce((best,key)=>
    votes[key]>votes[best]+.0001?key:best,'pincer');
  return {mode,votes,contributors:proposals.length};
}

const elect=members=>[...members].sort((a,b)=>rank(b)-rank(a)||
  (a.serial||0)-(b.serial||0))[0];

export class EnemyComms {
  constructor(){
    this.cells=[];this.events=[];this.nextTick=0;
    this.serial=0;this.messages=0;this.decisions=0;
    this.intercepts=[];
  }

  reportSight(e,player,now){
    if(!legal(e)||!player||now<(e._commsNextSight??0))return false;
    e._commsNextSight=now+1.05+(Math.abs(e.serial||0)%4)*.11;
    e._commsSight={x:player.x,y:player.y,vx:player.vx||0,
      vy:player.vy||0,at:now};return true;
  }

  reportHit(e,damage,now){
    if(!legal(e)||!Number.isFinite(damage)||damage<=0)return false;
    e._commsHit={at:now,damage:Math.min(100,damage)};return true;
  }

  reportAttack(e,weapon,range,now){
    const kind=classifyEnemyAttack(weapon,range);
    if(!legal(e)||!kind||now<(e._commsNextAttackAt??0))return false;
    e._commsNextAttackAt=now+1.0;
    e._commsAttack={at:now,kind,weapon};return true;
  }

  send(from,to,kind,now){
    if(from===to||!legal(from)||!legal(to)||
       distance(from,to)>ENEMY_COMMS.range)return false;
    this.events.push({from,to,kind,start:now,until:now+ENEMY_COMMS.pulseSeconds});
    if(this.events.length>ENEMY_COMMS.maxEvents)
      this.events.splice(0,this.events.length-ENEMY_COMMS.maxEvents);
    this.messages++;return true;
  }

  update(game){
    const now=game.time;
    if(now<this.nextTick)return;
    this.nextTick=now+ENEMY_COMMS.tick;
    const living=(game.enemies||[]).filter(legal);
    const eligible=new Set(living),claimed=new Set(),next=[];

    // Existing cells retain their membership and caller. Killing a caller
    // breaks the net briefly before survivors can elect a replacement.
    for(const cell of this.cells){
      const wasLeader=cell.leader;
      cell.members=cell.members.filter(e=>eligible.has(e)&&
        distance(e,wasLeader)<=ENEMY_COMMS.range);
      if(!cell.members.length)continue;
      if(!eligible.has(wasLeader)){
        if(!cell.brokenUntil){
          cell.brokenUntil=now+ENEMY_COMMS.breakSeconds;
          cell.mode=null;cell.intel=null;cell.proposals=new Map();
          cell.attackReports=[];cell.threat=null;
          for(const e of cell.members)e._commsOrder=null;
        }
        if(now>=cell.brokenUntil){
          cell.leader=elect(cell.members);cell.brokenUntil=0;
          cell.holdUntil=0;cell.mode=null;
        }
      }
      for(const e of cell.members)claimed.add(e);
      next.push(cell);
    }

    // Recruit neighbours using the *existing* spatial grid. No all-pairs
    // scan or per-drone neural inference is needed, even for 200 enemies.
    for(const cell of next){
      if(cell.brokenUntil||cell.members.length>=ENEMY_COMMS.cellSize)continue;
      const leader=cell.leader;
      const nearby=(game.grid?.query(leader.x,leader.y,ENEMY_COMMS.range)||[])
        .filter(e=>eligible.has(e)&&!claimed.has(e)&&
          distance(e,leader)<=ENEMY_COMMS.range)
        .sort((a,b)=>(a.group===leader.group?-1:0)-
          (b.group===leader.group?-1:0)||distance(a,leader)-distance(b,leader));
      for(const e of nearby){
        if(cell.members.length>=ENEMY_COMMS.cellSize)break;
        cell.members.push(e);claimed.add(e);
      }
    }
    for(const seed of living){
      if(claimed.has(seed))continue;
      const nearby=(game.grid?.query(seed.x,seed.y,ENEMY_COMMS.range)||[])
        .filter(e=>eligible.has(e)&&!claimed.has(e)&&
          distance(e,seed)<=ENEMY_COMMS.range)
        .sort((a,b)=>distance(a,seed)-distance(b,seed))
        .slice(0,ENEMY_COMMS.cellSize);
      if(!nearby.includes(seed))nearby.unshift(seed);
      const leader=elect(nearby);
      const members=nearby.filter(e=>distance(e,leader)<=ENEMY_COMMS.range)
        .slice(0,ENEMY_COMMS.cellSize);
      if(!members.includes(leader))members.unshift(leader);
      for(const e of members)claimed.add(e);
      next.push({id:++this.serial,leader,members,mode:null,intel:null,
        holdUntil:0,brokenUntil:0,nextBroadcast:0,lastDecisionAt:-Infinity,
        votes:null,proposals:new Map(),attackReports:[],threat:null});
    }
    this.cells=next;
    this.intercepts=this.intercepts.filter(e=>now-e.at<=30);
    this.events=this.events.filter(e=>e.until>now&&legal(e.from)&&legal(e.to)&&
      distance(e.from,e.to)<=ENEMY_COMMS.range*1.12);

    for(const cell of this.cells){
      for(const e of cell.members)e._commsCell=cell;
      if(cell.members.length<2||cell.brokenUntil)continue;
      const leader=cell.leader;
      if(!cell.proposals)cell.proposals=new Map();
      cell.attackReports??=[];
      cell.attackReports=cell.attackReports.filter(report=>
        now-report.at<=ENEMY_COMMS.attackMemory);
      for(const e of cell.proposals.keys())
        if(!cell.members.includes(e))cell.proposals.delete(e);
      const hasMedic=cell.members.some(e=>
        e.type==='healer'&&(e.healReserve??110)>0);
      let contact=false,distress=false;
      for(const e of cell.members){
        if(e!==leader&&distance(e,leader)>ENEMY_COMMS.range)continue;
        const signature=`${e._enemyLearning?.style||''}/${e.hp/e.maxHp<.52}/${hasMedic}`;
        const old=cell.proposals.get(e);
        if(!old||old.signature!==signature||now-old.at>3.2){
          if(e===leader||this.send(e,leader,'vote',now))
            cell.proposals.set(e,{signature,choice:collectiveVote(e,hasMedic),at:now});
        }
        const sight=e._commsSight;
        if(sight&&sight.at>(e._commsDeliveredSightAt??-Infinity)&&
          now-sight.at<ENEMY_COMMS.sightAge){
          e._commsDeliveredSightAt=sight.at;
          if(e===leader||this.send(e,leader,'contact',now)){
            if(!cell.intel||sight.at>=cell.intel.at)cell.intel={...sight};
            contact=true;
          }
        }
        const hit=e._commsHit;
        if(hit&&hit.at>(e._commsDeliveredHitAt??-Infinity)&&now-hit.at<1.4){
          e._commsDeliveredHitAt=hit.at;
          if(e===leader||this.send(e,leader,'distress',now))distress=true;
        }
        const attack=e._commsAttack;
        if(attack&&attack.at>(e._commsDeliveredAttackAt??-Infinity)&&
          now-attack.at<2.2){
          e._commsDeliveredAttackAt=attack.at;
          if(e===leader||this.send(e,leader,'weapon',now)){
            cell.attackReports.push({...attack,reporter:e.serial});
            if(cell.attackReports.length>ENEMY_COMMS.maxAttackReports)
              cell.attackReports.shift();
          }
        }
      }
      if(!cell.intel||now-cell.intel.at>ENEMY_COMMS.sightAge){
        cell.intel=null;cell.mode=null;continue;
      }
      // Only proposals actually transmitted to this caller can influence the
      // result; a disconnected ship's private state never enters the ballot.
      const accepted=[...cell.proposals.values()]
        .filter(v=>now-v.at<4.0).map(v=>v.choice);
      if(accepted.length<2){cell.mode=null;continue;}
      cell.threat=assessEnemyThreat(cell.attackReports,now);
      const outcome=tallyVotes(accepted,cell.intel,hasMedic,cell.threat);
      const urgent=!!(distress&&cell.mode&&
        outcome.votes.screen>outcome.votes[cell.mode]);
      const canChange=now>=cell.holdUntil||urgent;
      const changed=canChange&&cell.mode!==outcome.mode;
      if(canChange){
        cell.votes=outcome.votes;
        cell.mode=outcome.mode;
        cell.holdUntil=now+ENEMY_COMMS.decisionSeconds;
        if(changed){cell.lastDecisionAt=now;this.decisions++;}
      }
      if((contact||changed||distress||now>=cell.nextBroadcast)&&cell.mode){
        cell.nextBroadcast=now+ENEMY_COMMS.broadcastInterval;
        let delivered=false;
        for(const e of cell.members)if(e!==leader&&
          this.send(leader,e,changed?'order':'relay',now)){
          e._commsOrder={cellId:cell.id,mode:cell.mode,
            intel:{...cell.intel},at:now};
          delivered=true;
        }
        // Only a physically sent command that the player could intercept is
        // eligible for subtitles or the tactical map's radio transcript.
        if(changed&&delivered&&game.playerCanInspectEnemyIntent?.(leader)){
          const message=enemyOrderMessage(cell.mode,cell.threat);
          if(message){
            const item={at:now,until:now+3.4,mode:cell.mode,
              message,leader,cellId:cell.id};
            cell.lastIntercept=item;
            this.intercepts.push(item);
            if(this.intercepts.length>8)this.intercepts.shift();
          }
        }
      }
    }
  }

  directiveFor(e,now){
    const cell=e?._commsCell;
    if(!cell||cell.members.length<2||cell.brokenUntil||
       cell.leader.hp<=0||!cell.mode||!cell.intel||
       now-cell.intel.at>ENEMY_COMMS.sightAge||
       !cell.members.includes(e)||distance(e,cell.leader)>ENEMY_COMMS.range)
      return null;
    const received=e===cell.leader?null:e._commsOrder;
    if(e!==cell.leader&&(!received||received.cellId!==cell.id||
       received.mode!==cell.mode||now-received.at>2.5||
       now-received.intel.at>ENEMY_COMMS.sightAge))return null;
    const position=cell.members.indexOf(e);
    return {mode:cell.mode,side:position%2?1:-1,
      leader:cell.leader,intel:received?.intel||cell.intel,
      medic:cell.members.find(a=>a.type==='healer'&&a.hp>0)||null,
      threat:cell.threat};
  }

  intercepted(now){
    return this.intercepts.filter(item=>now-item.at<=30&&now-item.at>=0)
      .slice(-4).reverse();
  }

  render(ctx,cam,now,reducedMotion=false,fps=60){
    let drawn=0;
    ctx.save();ctx.lineCap='round';
    // A very faint topology shows *active, acknowledged orders*. Uninformed
    // newcomers and disconnected pilots get no persistent link.
    let topology=0;
    for(const cell of this.cells){
      if(topology>=(fps<28?5:11))break;
      for(const member of cell.members){
        if(topology>=(fps<28?5:11))break;
        const leader=cell.leader;
        if(member===leader||!this.directiveFor(member,now)||
          (!isVisible(member,cam,15)&&!isVisible(leader,cam,15)))continue;
        ctx.globalAlpha=fps<28?.075:.11;
        ctx.strokeStyle='#b69aff';ctx.lineWidth=.8;
        if(fps>=28)ctx.setLineDash([2,12]);
        ctx.beginPath();ctx.moveTo(leader.x,leader.y);
        ctx.lineTo(member.x,member.y);ctx.stroke();
        if(fps>=28)ctx.setLineDash([]);
        topology++;
      }
    }
    for(let index=this.events.length-1;index>=0;index--){
      const msg=this.events[index],a=msg.from,b=msg.to;
      if(msg.until<=now||!legal(a)||!legal(b)||
        distance(a,b)>ENEMY_COMMS.range*1.12||
        (!isVisible(a,cam,25)&&!isVisible(b,cam,25)))continue;
      if(drawn>=ENEMY_COMMS.maxDrawn)break;
      const t=clamp((now-msg.start)/ENEMY_COMMS.pulseSeconds,0,1);
      ctx.globalAlpha=(1-t)*(fps<28?.21:.34);
      ctx.strokeStyle=color(msg.kind);ctx.lineWidth=msg.kind==='order'?1.5:1.1;
      if(fps>=28)ctx.setLineDash([4,7]);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      if(fps>=28)ctx.setLineDash([]);
      if(!reducedMotion&&fps>=28){
        const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
        ctx.globalAlpha=(1-t)*.82;
        ctx.fillStyle=color(msg.kind);
        ctx.beginPath();ctx.arc(x,y,2.6,0,Math.PI*2);ctx.fill();
      }
      drawn++;
    }
    // The actual transmitted command becomes a brief, world-anchored speech
    // bubble; the old compact mode label remains when interception failed.
    let cues=0;const labelCenters=[];
    for(const cell of this.cells){
      if(cues>=3)break;
      const e=cell.leader,age=now-cell.lastDecisionAt;
      if(!modeLabel[cell.mode]||age<0||age>3.4||
         !legal(e)||!isVisible(e,cam,30))continue;
      if(labelCenters.some(other=>distance(other,e)<235))continue;
      const heard=cell.lastIntercept?.cellId===cell.id&&
        cell.lastIntercept.at===cell.lastDecisionAt&&
        now<=cell.lastIntercept.until;
      if(!heard&&age>1.65)continue;
      ctx.globalAlpha=clamp((heard?3.4:1.65)-age,0,.88);
      if(heard){
        const y=e.y-(e.r||14)-95;
        ctx.fillStyle='#09182ce8';ctx.fillRect?.(e.x-158,y-13,316,57);
        ctx.strokeStyle='#b69aff';ctx.strokeRect?.(e.x-158,y-13,316,57);
        ctx.fillStyle='#d4b9ff';ctx.font='bold 10px system-ui';
        ctx.textAlign='center';ctx.fillText('ПЕРЕХВАЧЕН ПРИКАЗ · '+modeLabel[cell.mode],e.x,y,300);
        ctx.fillStyle='#f4eaff';ctx.font='11px system-ui';
        const words=cell.lastIntercept.message.split(' '),lines=[''];
        for(const word of words){
          const last=lines.length-1;
          if((lines[last]+' '+word).trim().length>40&&lines.length<2)lines.push(word);
          else lines[last]+=(lines[last]?' ':'')+word;
        }
        for(let i=0;i<lines.length;i++)ctx.fillText(lines[i],e.x,y+17+i*15,300);
      }else{
      ctx.fillStyle='#d9c6ff';ctx.font='bold 11px system-ui';
      ctx.textAlign='center';
      ctx.fillText(modeLabel[cell.mode],e.x,e.y-(e.r||14)-46);
      }
      labelCenters.push(e);cues++;
    }
    ctx.restore();return drawn;
  }
}
