import {EnemyMesh} from './enemy-mesh.js?v=enemy-mesh-1-tactical-field-2-backbone-1';
import {tacticalRadioJammed,tacticalJammingConfirmed} from './tactical-fields.js?v=tactical-field-2';
import {EnemyTheaterStrategy} from './enemy-strategy.js?v=theater-1-campaign-1-theater-audit-1-repair-qa-1-mesh-1-backbone-1';
import {createEnemySquadPlan,squadPlanObsolete,advanceEnemySquadPlan,
  squadPhaseExpired,squadPlanMode,squadPlanPhaseMessage,
  squadRoleFor,squadRoleLabel} from './enemy-squad-plans.js?v=enemy-squad-plans-1';

/** Bounded enemy radio. Messages carry actual local observations, and
 * decisions use votes from several pilots. Visual pulses are message receipts,
 * never decorative lines drawn between arbitrary nearby sprites. */
export const ENEMY_COMMS=Object.freeze({
  range:510,cellSize:7,tick:.36,sightAge:2.6,
  breakSeconds:2.1,decisionSeconds:2.3,broadcastInterval:.85,
  pulseSeconds:.86,maxEvents:68,maxDrawn:16,
  attackMemory:13,attackFresh:7,maxAttackReports:12,
  interceptRange:560,estimatedIntelAge:6.4,
  witnessRange:190,lossMemory:8,maxLossReports:8,
  incidentMemory:6.2,motionMemory:6,maxMotionReports:10
});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const legal=e=>!!e&&e.hp>0&&!e.converted&&!e.boss&&
  !e.missionStructure&&!e.relayAssault&&!e.interceptCargo&&!e.stationRaid&&
  (!e.signalIntel||e.signalIntel.mode!=='withdraw');
const rank=e=>({gunship:7,fighter:6,flanker:5,scout:4,
  berserker:3,healer:2})[e.type]||1;
const isVisible=(a,cam,pad=20)=>a&&a.x>=cam.x-pad&&
  a.x<=cam.x+cam.w+pad&&a.y>=cam.y-pad&&a.y<=cam.y+cam.h+pad;
const color=kind=>kind==='contact'?'#b69aff':
  kind==='distress'||kind==='weapon'?'#ffc17b':'#80dcec';
const observationLabels=Object.freeze({
  contact:'ЦЕЛЬ ОБНАРУЖЕНА',weapon:'ОПОЗНАНО ОРУЖИЕ',
  loss:'ЗВЕНО НЕСЁТ ПОТЕРИ',incident:'ОБЪЕКТ ПОД ОГНЁМ'
});
function observedCue(e,kind,now){
  if(now<(e._commsNextCueAt??-Infinity)&&
     (kind==='contact'||e._commsObservationCue?.kind===kind))return;
  e._commsObservationCue={kind,at:now,until:now+1.7};
  e._commsNextCueAt=now+(kind==='contact'?3.6:2.6);
}
const modeLabel=Object.freeze({press:'НАЖИМ',pincer:'ОБХОД',
  intercept:'ПЕРЕХВАТ',screen:'ПРИКРЫТИЕ',
  close:'СБЛИЖЕНИЕ',scatter:'РАССЕЯТЬСЯ'});

/** These are orders produced by the selected maneuver. Explanations about
 * observed weapons only appear after delivered, repeated evidence. */
export function enemyOrderMessage(mode,threat=null){
  if(threat?.mesh&&mode==='close'&&threat.kind==='long')
    return 'Из общей сети: противник использует дальнобойное оружие. Сблизиться!';
  if(threat?.mesh&&mode==='scatter'&&threat.kind==='area')
    return 'Из общей сети: обнаружено площадное оружие. Увеличить интервалы!';
  if(threat?.mesh&&mode==='pincer'&&threat.kind==='close')
    return 'Из общей сети: опасен ближний бой. Обойти с флангов!';
  if(mode==='close'&&threat?.kind==='long')
    return 'Он бьёт издалека. Всем на сближение!';
  if(mode==='pincer'&&threat?.kind==='close')
    return 'Его оружие опасно вблизи. Держать дистанцию, обойти!';
  if(mode==='scatter'&&threat?.kind==='area')
    return 'У него площадное оружие. Рассредоточиться!';
  if(mode==='scatter'&&threat?.kind==='loss')
    return 'Звено несёт потери. Разомкнуть строй!';
  if(mode==='intercept'&&threat?.kind==='sabotage')
    return threat.site==='convoy'?
      (threat.escort?'Охрана транспорта, перекрыть подступы!':
        'Транспорт под огнём. К месту атаки!'):
      'Наш промышленный узел атакован. Проверить район!';
  if(mode==='intercept'&&threat?.kind==='maneuver'&&threat.motion==='straight')
    return 'Он держит прямой курс. Зайти наперерез!';
  if(mode==='pincer'&&threat?.kind==='maneuver'&&threat.motion==='turning')
    return 'Он постоянно меняет курс. Охватить с двух сторон!';
  if(mode==='press'&&threat?.kind==='weak')
    return 'У него повреждён корпус. Не дать уйти!';
  return ({press:'Не дать цели выйти из боя. Держать давление!',
    pincer:'Сковать цель огнём. Обойти с двух сторон!',
    intercept:'Перекрыть путь отхода. Перехватить курс!',
    screen:'Сохранить ремонтника. Перехватить угрозу!',
    close:'Сократить дистанцию. Держать строй!',
    scatter:'Разомкнуть строй! Увеличить интервалы.'})[mode]||null;
}

/** A ship can recognize the weapon that actually struck it and approximate
 * firing distance. These are observations, not privileged loadout queries. */
export function classifyEnemyAttack(weapon,range){
  if(!Number.isFinite(range)||range<0)return null;
  if(weapon==='ion'||weapon==='howitzer')return 'area';
  // Weapon signatures, not arbitrary firing distance, determine the counter.
  // Plasma loses damage with range; calling it "long" lures pilots into its
  // strongest point-blank damage. Rail and rockets work at long distances.
  if(weapon==='beam'||weapon==='flak')return 'close';
  if(weapon==='rail'||weapon==='rocket')return 'long';
  return null;
}

/** A victim outside visual contact can gauge the direction of impact but
 * cannot measure the hidden attacker's exact distance using the game state. */
export function estimatedWeaponRange(weapon){
  return ({beam:200,flak:180,rail:390,rocket:390,
    ion:300,howitzer:520})[weapon]??260;
}

/** Require repeat evidence separated in time: one lucky hit cannot change
 * a whole flight's doctrine. Classification expires without new reports. */
export function assessEnemyThreat(reports,now){
  const recent=(reports||[]).filter(r=>r&&Number.isFinite(r.at)&&
    now-r.at>=0&&now-r.at<=ENEMY_COMMS.attackMemory);
  let best=null;
  for(const kind of ['area','long','close']){
    const items=recent.filter(r=>r.kind===kind).sort((a,b)=>a.at-b.at);
    if(items.length<2||now-items[items.length-1].at>ENEMY_COMMS.attackFresh||
       items[items.length-1].at-items[0].at<.9)continue;
    const candidate={kind,samples:items.length,lastAt:items[items.length-1].at,
      source:items[items.length-1]};
    // The newest corroborated threat wins; an obsolete area weapon cannot
    // indefinitely suppress fresh reports of long-range fire.
    if(!best||candidate.lastAt>best.lastAt)best=candidate;
  }
  return best;
}

/** Counter-manoeuvres need two *delivered* sightings separated in time.
 * A fresh contrary observation cancels the old inference immediately. */
export function assessEnemyMotion(reports,now){
  const recent=(reports||[]).filter(r=>r&&Number.isFinite(r.at)&&
    now-r.at>=0&&now-r.at<=ENEMY_COMMS.motionMemory&&
    ['slow','straight','turning'].includes(r.motion))
    .sort((a,b)=>a.at-b.at);
  const latest=recent.at(-1);
  if(!latest||latest.motion==='slow'||now-latest.at>3.2)return null;
  // Earlier sightings cannot corroborate a resumed course if a more recent
  // report saw the player change tactics in between.
  let supported=false;
  for(let i=recent.length-2;i>=0;i--){
    const r=recent[i];
    if(r.motion!==latest.motion)break;
    if(latest.at-r.at>4.2)break;
    if(latest.at-r.at>=1.05){supported=true;break;}
  }
  return supported?{kind:'maneuver',motion:latest.motion,
    lastAt:latest.at}:null;
}

/** A visible hull breach is a short-lived opportunity, not permanent
 * knowledge of the player's health. Healing seen by a pilot cancels it. */
export function assessEnemyOpportunity(reports,now){
  const recent=(reports||[]).filter(r=>r&&Number.isFinite(r.at)&&
    now-r.at>=0&&now-r.at<=ENEMY_COMMS.motionMemory)
    .sort((a,b)=>a.at-b.at);
  const latest=recent.at(-1);
  if(!latest||!Number.isFinite(latest.hullRatio)||
    latest.hullRatio>.43||now-latest.at>ENEMY_COMMS.sightAge)return null;
  for(let i=recent.length-2;i>=0;i--){
    const previous=recent[i],age=latest.at-previous.at;
    if(!Number.isFinite(previous.hullRatio)||previous.hullRatio>.43||age>4.2)
      break;
    if(age>=1.05)return {kind:'weak',lastAt:latest.at};
  }
  return null;
}

/** A hit can reveal the direction of incoming fire but cannot give its victim
 * a live player position. Coarse sectors deliberately lack velocity. */
export function incomingFireEstimate(e,range,contact){
  if(!e||!contact?.directed||!Number.isFinite(range)||range<0)return null;
  const length=clamp(range,85,750),step=120;
  return {x:Math.round((e.x+contact.nx*length)/step)*step,
    y:Math.round((e.y+contact.ny*length)/step)*step,
    vx:0,vy:0,estimated:true};
}
const intelFresh=(intel,now)=>!!intel&&now-intel.at>=0&&
  now-intel.at<=(intel.estimated?ENEMY_COMMS.estimatedIntelAge:ENEMY_COMMS.sightAge);
export const radioOrderCapable=(e,now=0,threat=null)=>legal(e)&&
  e.type!=='healer'&&now>=(e.stasisUntil||0)&&
  (((!e.protect||e.protect.hp<=0||e.protect.converted)&&
    (e.state==='hunt'||e.state==='flank'||
    e.state==='standoff'))||
   // Escorts can execute a defensive alarm around their *own* convoy. A
   // normal attack order cannot pull them away from their assigned cargo.
   (e.protect?.hp>0&&e.protect.regionalCargo===true&&
    threat?.kind==='sabotage'&&threat.site==='convoy'&&
    threat.assetId===e.protect.id&&
    (e.state==='guard'||e.state==='intercept')));

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
  if(threat?.kind==='loss')votes.scatter+=12;
  if(threat?.kind==='close')votes.pincer+=13;
  if(threat?.kind==='sabotage')votes.intercept+=13;
  if(threat?.kind==='maneuver'&&threat.motion==='straight')
    votes.intercept+=Math.min(12,5+proposals.length*2);
  if(threat?.kind==='maneuver'&&threat.motion==='turning')
    votes.pincer+=Math.min(12,5+proposals.length*2);
  if(threat?.kind==='weak')votes.press+=10;
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
    this.theater=new EnemyTheaterStrategy();
    this.mesh=new EnemyMesh();
  }

  reportSight(e,player,now){
    if(!legal(e)||!player||now<(e._commsNextSight??0))return false;
    e._commsNextSight=now+1.05+(Math.abs(e.serial||0)%4)*.11;
    const hullRatio=Number.isFinite(player.hp)&&
      Number.isFinite(player.maxHp)&&player.maxHp>0?
        clamp(player.hp/player.maxHp,0,1):null;
    e._commsSight={x:player.x,y:player.y,vx:player.vx||0,
      vy:player.vy||0,motion:e._learningObservation?.context||'slow',
      hullRatio,at:now};return true;
  }

  reportHit(e,damage,now){
    if(!legal(e)||!Number.isFinite(damage)||damage<=0)return false;
    e._commsHit={at:now,damage:Math.min(100,damage)};return true;
  }

  reportIncident(asset,game,kind='industry'){
    // A sabotage alert exists only if a living patrol witnessed damage at
    // the installation. Its location is public; the saboteur's is not.
    if(!asset||!game?.grid||!Number.isFinite(game.time))return 0;
    let witnesses=0;
    for(const e of game.grid.query(asset.x,asset.y,ENEMY_COMMS.witnessRange)){
      if(e===asset||!legal(e)||
        distance(e,asset)>ENEMY_COMMS.witnessRange||
        !game.enemyCanSee?.(e,asset))continue;
      e._commsIncident={at:game.time,x:asset.x,y:asset.y,kind,
        assetId:typeof asset.id==='string'?asset.id:null};
      witnesses++;
    }
    return witnesses;
  }

  reportLoss(victim,game,attack=null){
    // Witnessed destruction, not a global kill counter. Observers must be
    // alive, close enough and genuinely able to see the loss.
    if(!victim||victim.hp>0||!game?.grid)return 0;
    const kind=attack?classifyEnemyAttack(attack.weapon,attack.range):null;
    const estimate=kind?incomingFireEstimate(victim,attack.range,attack.contact):null;
    let witnesses=0;
    for(const e of game.grid.query(victim.x,victim.y,ENEMY_COMMS.witnessRange)){
      if(e===victim||!legal(e)||
        distance(e,victim)>ENEMY_COMMS.witnessRange||
        !game.enemyCanSee?.(e,victim))continue;
      e._commsLoss={at:game.time,victim:victim.serial};witnesses++;
      // The dead pilot cannot report. A living witness may recognize a beam,
      // rocket or blast, but receives only the same coarse impact bearing.
      // Two deaths at one instant still fail the time-separated corroboration.
      if(kind&&game.time>=(e._commsNextAttackAt??0)){
        e._commsNextAttackAt=game.time+1;
        e._commsAttack={at:game.time,kind,weapon:attack.weapon,
          estimate:estimate?{...estimate}:null};
      }
    }
    return witnesses;
  }

  reportAttack(e,weapon,range,now,contact=null){
    const kind=classifyEnemyAttack(weapon,range);
    if(!legal(e)||!kind||now<(e._commsNextAttackAt??0))return false;
    e._commsNextAttackAt=now+1.0;
    e._commsAttack={at:now,kind,weapon,
      estimate:incomingFireEstimate(e,range,contact)};return true;
  }

  /** A pilot physically caught in a control field can report its effect.
   * A second separated observation is still required for squad/mesh doctrine;
   * simply looking at the player's equipment does not reveal anything. */
  reportField(e,now){
    if(!legal(e)||now<(e._commsNextFieldAt??0))return false;
    e._commsNextFieldAt=now+1.08;
    e._commsAttack={at:now,kind:'area',weapon:'control-field',estimate:null};
    return true;
  }

  send(from,to,kind,now){
    if(from===to||!legal(from)||!legal(to)||
       distance(from,to)>ENEMY_COMMS.range)return false;
    if(tacticalRadioJammed(this._tacticalGame,from)||
       tacticalRadioJammed(this._tacticalGame,to)){
      tacticalJammingConfirmed(this._tacticalGame,from,to);
      return false;
    }
    this.events.push({from,to,kind,start:now,until:now+ENEMY_COMMS.pulseSeconds});
    if(this.events.length>ENEMY_COMMS.maxEvents)
      this.events.splice(0,this.events.length-ENEMY_COMMS.maxEvents);
    this.messages++;return true;
  }

  update(game){
    this._tacticalGame=game;
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
          cell.plan=null;
          cell.attackReports=[];cell.lossReports=[];cell.threat=null;
          cell.incident=null;cell.motionReports=[];
          cell.pendingDecision=null;cell.lastReportedTactic=null;
          for(const e of cell.members)e._commsOrder=null;
          // This is a real, temporary advantage earned by choosing a
          // commander as the target, not a decorative 'network down' badge.
          if(cell.members.length>=2&&
             (game.playerCanInterceptEnemyRadio?.(wasLeader)||
              game.playerCanInspectEnemyIntent?.(wasLeader)))
            game.notice?.('Командир звена уничтожен. Связь нарушена — строй временно распался.',3.4);
        }
        if(now>=cell.brokenUntil){
          cell.leader=elect(cell.members);cell.brokenUntil=0;
          cell.holdUntil=0;cell.mode=null;cell.plan=null;
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
        votes:null,proposals:new Map(),attackReports:[],lossReports:[],
        threat:null,incident:null,motionReports:[],lastReportedTactic:null});
    }
    this.cells=next;
    this.intercepts=this.intercepts.filter(e=>now-e.at<=30);
    this.events=this.events.filter(e=>e.until>now&&legal(e.from)&&legal(e.to)&&
      distance(e.from,e.to)<=ENEMY_COMMS.range*1.12);

    for(const cell of this.cells){
      for(const e of cell.members)e._commsCell=cell;
      if(cell.members.length<2){cell.mode=null;cell.plan=null;continue;}
      if(cell.brokenUntil)continue;
      const leader=cell.leader;
      if(!cell.proposals)cell.proposals=new Map();
      cell.attackReports??=[];
      cell.attackReports=cell.attackReports.filter(report=>
        now-report.at<=ENEMY_COMMS.attackMemory);
      cell.lossReports??=[];
      cell.lossReports=cell.lossReports.filter(report=>
        now-report.at<=ENEMY_COMMS.lossMemory);
      cell.motionReports??=[];
      cell.motionReports=cell.motionReports.filter(report=>
        now-report.at<=ENEMY_COMMS.motionMemory);
      if(cell.incident&&now-cell.incident.at>ENEMY_COMMS.incidentMemory)
        cell.incident=null;
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
            cell.motionReports.push({at:sight.at,motion:sight.motion,
              hullRatio:sight.hullRatio});
            if(cell.motionReports.length>ENEMY_COMMS.maxMotionReports)
              cell.motionReports.shift();
            observedCue(e,'contact',now);
            contact=true;
          }
        }
        const hit=e._commsHit;
        if(hit&&hit.at>(e._commsDeliveredHitAt??-Infinity)&&now-hit.at<1.4){
          e._commsDeliveredHitAt=hit.at;
          if(e===leader||this.send(e,leader,'distress',now))distress=true;
        }
        const loss=e._commsLoss;
        if(loss&&loss.at>(e._commsDeliveredLossAt??-Infinity)&&
          now-loss.at<1.8){
          e._commsDeliveredLossAt=loss.at;
          if((e===leader||this.send(e,leader,'distress',now))&&
            !cell.lossReports.some(report=>report.victim===loss.victim)){
            cell.lossReports.push({...loss});
            if(cell.lossReports.length>ENEMY_COMMS.maxLossReports)
              cell.lossReports.shift();
            observedCue(e,'loss',now);
            distress=true;
          }
        }
        const attack=e._commsAttack;
        if(attack&&attack.at>(e._commsDeliveredAttackAt??-Infinity)&&
          now-attack.at<2.2){
          e._commsDeliveredAttackAt=attack.at;
          if(e===leader||this.send(e,leader,'weapon',now)){
            cell.attackReports.push({...attack,reporter:e.serial});
            if(cell.attackReports.length>ENEMY_COMMS.maxAttackReports)
              cell.attackReports.shift();
            observedCue(e,'weapon',now);
          }
        }
        const incident=e._commsIncident;
        if(incident&&incident.at>(e._commsDeliveredIncidentAt??-Infinity)&&
          now-incident.at<1.8){
          e._commsDeliveredIncidentAt=incident.at;
          if(e===leader||this.send(e,leader,'distress',now)){
            if(!cell.incident||incident.at>=cell.incident.at)
              cell.incident={...incident};
            observedCue(e,'incident',now);
            distress=true;
          }
        }
      }
      cell.threat=assessEnemyThreat(cell.attackReports,now);
      const lossCount=cell.lossReports.length;
      if(!cell.threat&&lossCount>=2)
        cell.threat={kind:'loss',samples:lossCount,
          lastAt:cell.lossReports[cell.lossReports.length-1].at};
      if(!cell.threat&&cell.incident&&
        !(cell.intel&&!cell.intel.estimated&&intelFresh(cell.intel,now)))
        cell.threat={kind:'sabotage',site:cell.incident.kind,
          assetId:cell.incident.assetId,
          escort:cell.incident.kind==='convoy'&&cell.members.some(e=>
            e.protect?.hp>0&&e.protect.regionalCargo===true&&
            cell.incident.assetId===e.protect.id),
          lastAt:cell.incident.at};
      if(!cell.threat&&cell.intel&&!cell.intel.estimated&&
        intelFresh(cell.intel,now))
        cell.threat=assessEnemyOpportunity(cell.motionReports,now)||
          assessEnemyMotion(cell.motionReports,now);
      // A mesh warning changes doctrine only after the receiver actually
      // sees the player. It cannot grant a remote cell target coordinates.
      if(!cell.threat&&cell.intel&&!cell.intel.estimated&&
         intelFresh(cell.intel,now)){
        const warning=this.mesh.bestForCell(cell,now);
        if(warning)cell.threat={kind:warning.kind,lastAt:warning.at,mesh:true};
      }
      if(!cell.intel||cell.intel.estimated||!intelFresh(cell.intel,now)){
        // Two coherent impacts can locate a rough firing *sector* beyond
        // optical range. It is never promoted to an exact target track.
        const source=cell.threat?.source;
        cell.intel=source?.estimate?{...source.estimate,at:source.at}:
          cell.incident?{x:cell.incident.x,y:cell.incident.y,vx:0,vy:0,
            at:cell.incident.at,estimated:true,incident:true}:null;
      }
      if(!intelFresh(cell.intel,now)){
        cell.intel=null;cell.mode=null;cell.plan=null;continue;
      }
      // Only proposals actually transmitted to this caller can influence the
      // result; a disconnected ship's private state never enters the ballot.
      const accepted=[...cell.proposals.values()]
        .filter(v=>now-v.at<4.0).map(v=>v.choice);
      if(accepted.length<2){cell.mode=null;cell.plan=null;continue;}
      // A group's voters can include repair units, but an announced combat
      // order requires a real recipient able to alter its course.
      if(!cell.members.some(e=>e!==leader&&radioOrderCapable(e,now,cell.threat))){
        cell.mode=null;cell.plan=null;continue;
      }
      const outcome=tallyVotes(accepted,cell.intel,hasMedic,cell.threat);
      const previousPlan=cell.plan;
      const failedPlan=squadPhaseExpired(previousPlan,cell,now);
      const stalePlan=squadPlanObsolete(previousPlan,cell.threat,now,
        cell.members,cell.intel)||
        failedPlan;
      const fallback=failedPlan&&!cell.threat&&
        ['pincer','intercept'].includes(outcome.mode)?'press':outcome.mode;
      if(stalePlan)cell.plan=createEnemySquadPlan(cell,fallback,
        cell.threat,now);
      const phaseChanged=!stalePlan&&
        advanceEnemySquadPlan(cell.plan,cell,now);
      const desiredMode=squadPlanMode(cell.plan)||outcome.mode;
      const urgent=!!(distress&&cell.mode&&
        ((outcome.mode==='screen'&&outcome.votes.screen>outcome.votes[cell.mode])||
         (cell.threat?.kind==='loss'&&outcome.mode==='scatter')));
      const canChange=now>=cell.holdUntil||urgent||phaseChanged||stalePlan;
      const changed=canChange&&cell.mode!==desiredMode;
      // A pilot may already be intercepting when the group learns that the
      // player holds a straight course. The stronger lead is still a *new*
      // tactical decision worth explaining once it is really flown.
      const tactic=cell.threat?.mesh?'mesh:'+cell.threat.kind:
        cell.threat?.kind==='maneuver'?cell.threat.motion:
        cell.threat?.kind==='weak'?'weak':null;
      const newTactic=canChange&&cell.mode===outcome.mode&&tactic&&
        cell.lastReportedTactic!==tactic;
      if(canChange){
        cell.votes=outcome.votes;
        cell.mode=desiredMode;
        cell.holdUntil=now+ENEMY_COMMS.decisionSeconds;
        if(changed||phaseChanged){cell.lastDecisionAt=now;this.decisions++;}
      }
      if((contact||changed||phaseChanged||distress||
        now>=cell.nextBroadcast)&&cell.mode){
        cell.nextBroadcast=now+ENEMY_COMMS.broadcastInterval;
        let delivered=false;
        for(const e of cell.members)if(e!==leader&&
          this.send(leader,e,changed?'order':'relay',now)){
          e._commsOrder={cellId:cell.id,mode:cell.mode,
            intel:{...cell.intel},threat:cell.threat?{...cell.threat}:null,
            at:now,
            planId:cell.plan?.id??null,planPhase:cell.plan?.phase??null,
            role:squadRoleFor(cell.plan,e)};
          if(radioOrderCapable(e,now,cell.threat))delivered=true;
        }
        // A sent order is only a *proposal* for a subtitle. We confirm actual
        // steering after the AI loop before declaring it a tactical reaction.
        if((changed||phaseChanged||newTactic)&&delivered)
          cell.pendingDecision={at:now,mode:cell.mode,
            threat:cell.threat?{...cell.threat}:null,
            planId:cell.plan?.id??null,planPhase:cell.plan?.phase??null};
      }
    }
    this.mesh.update(game,this.cells,now,this);
    this.theater.update(game,this);
  }

  confirmExecution(game){
    this.theater.confirmExecution(game,this);
    const now=game.time;
    for(const cell of this.cells){
      if(cell.plan&&!cell.brokenUntil&&cell.members.some(e=>
        e._commsIntent?.planId===cell.plan.id&&
        e._commsIntent?.planPhase===cell.plan.phase&&
        e._commsIntent?.at===now))cell.plan.confirmed=true;
      const pending=cell.pendingDecision;
      if(!pending||now-pending.at>1.1){cell.pendingDecision=null;continue;}
      if(pending.mode!==cell.mode){cell.pendingDecision=null;continue;}
      const executed=cell.members.some(e=>e!==cell.leader&&
        e._commsIntent?.mode===pending.mode&&e._commsIntent.at===now&&
        (pending.planId==null||
          e._commsIntent.planId===pending.planId&&
          e._commsIntent.planPhase===pending.planPhase));
      if(!executed)continue;
      cell.pendingDecision=null;
      if(pending.threat?.kind==='maneuver')
        cell.lastReportedTactic=pending.threat.motion;
      if(pending.threat?.kind==='weak')cell.lastReportedTactic='weak';
      if(pending.threat?.mesh)cell.lastReportedTactic='mesh:'+pending.threat.kind;
      if(!game.playerCanInterceptEnemyRadio?.(cell.leader)&&
        !game.playerCanInspectEnemyIntent?.(cell.leader))continue;
      const message=pending.planPhase>0&&cell.plan?.id===pending.planId?
        squadPlanPhaseMessage(cell.plan):
        enemyOrderMessage(cell.mode,pending.threat??cell.threat);
      if(!message)continue;
      const item={at:now,until:now+3.4,mode:cell.mode,message,
        leader:cell.leader,cellId:cell.id};
      cell.lastIntercept=item;this.intercepts.push(item);
      if(this.intercepts.length>8)this.intercepts.shift();
      // A newly understood course is more useful than the generic first
      // contact notice. Give it a separate, still bounded notification slot.
      const maneuverNotice=['maneuver','weak'].includes(pending.threat?.kind);
      if(now>=(this.nextNoticeAt||0)||
        (maneuverNotice&&now>=(this.nextManeuverNoticeAt||0))){
        game.notice?.('Радиоперехват: '+message,3.8);
        this.nextNoticeAt=now+5;
        if(maneuverNotice)this.nextManeuverNoticeAt=now+5;
      }
    }
  }

  strategicDirectiveFor(e,now){return this.theater.directiveFor(e,now);}

  directiveFor(e,now){
    const cell=e?._commsCell;
    if(!cell||cell.members.length<2||cell.brokenUntil||
       cell.leader.hp<=0||!cell.mode||!cell.intel||
       !intelFresh(cell.intel,now)||
       !cell.members.includes(e)||distance(e,cell.leader)>ENEMY_COMMS.range)
      return null;
    const received=e===cell.leader?null:e._commsOrder;
    if(e!==cell.leader&&(!received||received.cellId!==cell.id||
       received.mode!==cell.mode||now-received.at>2.5||
       !intelFresh(received.intel,now)||
       cell.plan&&(received.planId!==cell.plan.id||
         received.planPhase!==cell.plan.phase)))return null;
    const position=cell.members.indexOf(e);
    return {mode:cell.mode,side:position%2?1:-1,
      leader:cell.leader,intel:received?.intel||cell.intel,
      medic:cell.members.find(a=>a.type==='healer'&&a.hp>0)||null,
      // Recipients act on their own delivered threat snapshot. New reports
      // cannot retroactively alter a wingman's last message.
      threat:e===cell.leader?cell.threat:received.threat??null,
      planId:cell.plan?.id??null,
      planPhase:cell.plan?.phase??null,
      role:received?.role||squadRoleFor(cell.plan,e),
      objective:cell.plan?.goal||null};
  }

  intercepted(now){
    return this.intercepts.filter(item=>now-item.at<=30&&now-item.at>=0)
      .slice(-4).reverse();
  }

  render(ctx,cam,now,reducedMotion=false,fps=60,game=null){
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
        // Both endpoints must be optically confirmed: drawing a line from a
        // visible wingman to a concealed caller reveals the caller's position.
        if(game&&(!game.playerCanInspectEnemyIntent?.(member)||
          !game.playerCanInspectEnemyIntent?.(leader)))continue;
        ctx.globalAlpha=fps<28?.20:.26;
        ctx.strokeStyle='#c2a7ff';ctx.lineWidth=1.25;
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
      if(game&&(!game.playerCanInspectEnemyIntent?.(a)||
        !game.playerCanInspectEnemyIntent?.(b)))continue;
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
    // These labels say what a pilot *actually reported*, before its flight
    // chooses a response. Two small labels are enough to show perception
    // without concealing the player or turning hidden contacts into markers.
    let observations=0;const observationPoints=[];
    if(game?.playerCanInspectEnemyIntent)for(const cell of this.cells){
      if(observations>=2)break;
      for(const e of cell.members){
        if(observations>=2)break;
        const cue=e._commsObservationCue;
        if(!cue||now<cue.at||now>cue.until||!legal(e)||
           !isVisible(e,cam,20)||
           !game.playerCanInspectEnemyIntent(e)||
           observationPoints.some(p=>distance(p,e)<160))continue;
        const label=observationLabels[cue.kind];
        if(!label)continue;
        ctx.globalAlpha=clamp((cue.until-now)*1.4,0,.9);
        ctx.textAlign='center';ctx.font='bold 9px system-ui';
        ctx.fillStyle=cue.kind==='contact'?'#d1b7ff':'#ffe0a3';
        ctx.fillText(label,e.x,e.y-(e.r||14)-38,175);
        observationPoints.push(e);observations++;
      }
    }
    // A squad's longer plan is readable only through roles that its pilots
    // really execute, and only for individually visible ships. Cap text and
    // avoid repeating a role beside clustered craft on narrow screens.
    let roleCues=0;const rolePoints=[];
    if(game?.playerCanInspectEnemyIntent)for(const cell of this.cells){
      if(roleCues>=(fps<28?1:2))break;
      if(!cell.plan?.confirmed||!cell.mode||cell.brokenUntil)continue;
      for(const e of cell.members){
        if(roleCues>=(fps<28?1:2))break;
        const intent=e._commsIntent;
        if(!intent||intent.at!==now||intent.planId!==cell.plan.id||
           intent.planPhase!==cell.plan.phase||!legal(e)||
           !isVisible(e,cam,20)||!game.playerCanInspectEnemyIntent(e)||
           rolePoints.some(p=>distance(p,e)<140))continue;
        const label=squadRoleLabel(intent.role,intent.mode);
        if(!label||intent.role==='reserve')continue;
        ctx.globalAlpha=.78;ctx.fillStyle='#dac4ff';
        ctx.font='bold 9px system-ui';ctx.textAlign='center';
        ctx.fillText(label,e.x,e.y-(e.r||14)-55,150);
        rolePoints.push(e);roleCues++;
      }
    }
    // The actual transmitted command becomes a brief, world-anchored speech
    // bubble; the old compact mode label remains when interception failed.
    let cues=0;const labelCenters=[];
    for(const cell of this.cells){
      if(cues>=3)break;
      const e=cell.leader,age=now-(cell.lastIntercept?.at??-Infinity);
      if(!modeLabel[cell.mode]||age<0||age>3.4||
         !legal(e)||!isVisible(e,cam,30))continue;
      if(!game?.playerCanInspectEnemyIntent?.(e))continue;
      if(labelCenters.some(other=>distance(other,e)<235))continue;
      const heard=cell.lastIntercept?.cellId===cell.id&&
        cell.lastIntercept.mode===cell.mode&&
        cell.lastIntercept.at>=cell.lastDecisionAt&&
        now<=cell.lastIntercept.until;
      if(!heard)continue;
      ctx.globalAlpha=clamp(3.4-(now-cell.lastIntercept.at),0,.95);
      {
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
      }
      labelCenters.push(e);cues++;
    }
    this.mesh.render(ctx,cam,now,game,fps);
    this.theater.render(ctx,cam,now,game,fps);
    ctx.restore();return drawn;
  }
}
