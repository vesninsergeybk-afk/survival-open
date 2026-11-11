/** Eight painted microdrone hulls sharing fallible, local squad intelligence.
 * Their own commander never reads a live player position without a sighting.
 * Patrols, station launches and reinforcements use one bounded population cap.
 */
import {RULES,clamp,spawnOutside,dist} from './balance.js';
import {MICRO_RADIO,microDroneTargets,microDroneTarget,microDroneObservation,
 microRadioInit,microRadioPublish,microRadioAdvance} from './microdrone-intelligence.js';

export const MICRODRONE_ROLES=Object.freeze({
 interceptor:Object.freeze({label:'Перехватчик',hull:'flanker',hp:29,speed:232,range:355,stand:174,damage:7,reload:1.55,shot:'micro-needle',projectile:430,color:'#81e8ff'}),
 assault:Object.freeze({label:'Штурмовик',hull:'fighter',hp:59,speed:138,range:365,stand:245,damage:7,reload:2.7,burst:3,shot:'micro-gatling',projectile:335,color:'#ffae6b'}),
 missile:Object.freeze({label:'Ракетоносец',hull:'fighter',hp:38,speed:151,range:470,stand:345,damage:10,reload:3.9,burst:2,shot:'micro-missile',projectile:270,color:'#ffcb80'}),
 stealth:Object.freeze({label:'Стелс',hull:'flanker',hp:28,speed:219,range:300,stand:142,damage:9,reload:2.6,shot:'micro-violet',projectile:465,color:'#b99dff'}),
 disruptor:Object.freeze({label:'РЭБ',hull:'scout',hp:35,speed:171,range:340,stand:260,damage:5,reload:3.4,shot:'micro-ion',projectile:305,color:'#75f7e0'}),
 blade:Object.freeze({label:'Ближний бой',hull:'berserker',hp:41,speed:194,range:135,stand:100,damage:10,reload:4.4,shot:'micro-blade',projectile:390,color:'#57ddff'}),
 guardian:Object.freeze({label:'Защитник',hull:'healer',hp:49,speed:143,range:300,stand:215,damage:5,reload:3.2,shot:'micro-guard',projectile:305,color:'#8ecbff'}),
 hunter:Object.freeze({label:'Охотник',hull:'flanker',hp:34,speed:209,range:390,stand:191,damage:8,reload:1.95,shot:'micro-hunter',projectile:385,color:'#ff7778'})
});
export const MICRODRONE_ORDER=Object.freeze([
 'interceptor','assault','missile','stealth','disruptor','blade','guardian','hunter'
]);
export const MICRODRONE_LIMITS=Object.freeze({minWing:6,maxWing:10,
 maxActive:26,maxWings:3,firstPatrolAt:165,baseCooldown:86,
 radioRange:MICRO_RADIO.range,sightRange:600,contactAge:6.8,lossRetreat:5.8,
 minShotSpacing:.27,reinforcementCooldown:75});

const point=p=>({x:p.x,y:p.y});
const good=e=>e&&e.hp>0&&!e.converted;
const wingSize=count=>clamp(Number.isFinite(count)?Math.floor(count):8,
 MICRODRONE_LIMITS.minWing,MICRODRONE_LIMITS.maxWing);
const active=game=>(game.enemies||[]).filter(e=>e.microDrone&&good(e));
const cameraVisible=(p,c,pad=0)=>!!c&&p.x>=c.x-pad&&p.x<=c.x+c.w+pad&&
 p.y>=c.y-pad&&p.y<=c.y+c.h+pad;

export function microDroneRoster(count=8,scenario='patrol'){
 count=wingSize(count);
 const core=scenario==='base'?['guardian','assault','missile','hunter','interceptor','disruptor']:
  scenario==='trial'?['blade','assault','missile','guardian','interceptor','disruptor']:
  scenario==='support'?['interceptor','hunter','blade','stealth','assault','guardian']:
  ['interceptor','stealth','hunter','disruptor','assault','missile'];
 const remaining=MICRODRONE_ORDER.filter(role=>!core.includes(role));
 return [...core,...remaining,'interceptor','hunter'].slice(0,count);
}

export function microDroneShieldFactor(enemy,enemies){
 if(!enemy?.microDrone||enemy.converted)return 1;
 return (enemies||[]).some(other=>other!==enemy&&good(other)&&
  other.microDrone==='guardian'&&other.microWingId===enemy.microWingId&&
  dist(enemy,other)<=155)?0.78:1;
}

/** A seeker turns slowly for a short time; it neither teleports nor bypasses
 * asteroid cover, hitboxes or the player's post-hit invulnerability. */
export function steerMicroMissile(shot,target,dt){
 const age=Number.isFinite(shot?.microHomingAge)?shot.microHomingAge:0;
 if(!shot?.microHoming||age>=1.35||!(dt>0)||!target)return false;
 const speed=Math.hypot(shot.vx,shot.vy)||270;
 const desired=Math.atan2(target.y-shot.y,target.x-shot.x);
 const current=Math.atan2(shot.vy,shot.vx);
 const turn=Math.atan2(Math.sin(desired-current),Math.cos(desired-current));
 const angle=current+clamp(turn,-1.05*dt,1.05*dt);
 shot.vx=Math.cos(angle)*speed;shot.vy=Math.sin(angle)*speed;
 shot.microHomingAge=age+dt;
 return true;
}
export const microDroneMissileTarget=(game,shot)=>
 microDroneTarget(game,{key:shot?.microTargetKey})?.unit||null;

/** Only real incoming player hits count as evidence of a weapon style. */
export function microDroneReportHit(e,game,weapon){
 if(!e?.microDrone||game.time<(e.microNextThreatAt||0))return false;
 const kind=['ion','howitzer','tactical'].includes(weapon)?'area':
  ['rocket','rail'].includes(weapon)?'long':
  ['beam','flak'].includes(weapon)?'close':null;
 if(!kind)return false;
 const wing=game.microDroneWings?.get(e.microWingId);
 if(!wing)return false;
 e.microNextThreatAt=game.time+1.1;
 return microRadioPublish(wing,e,'threat',{kind,weapon},game.time);
}

/** This is a view-only sprite registry; simulation works without images. */
export function loadMicroDroneSprites(){
 if(typeof Image==='undefined')return {};
 const result={};
 MICRODRONE_ORDER.forEach((role,i)=>{
  result[role]={};
  for(const state of ['intact','damaged','idle']){
   const img=new Image();img.decoding='async';
   img.src=new URL(`../assets/space/microdrones/${state}-${i}.webp`,import.meta.url).href;
   result[role][state]=img;
  }
 });
 return result;
}

function ensure(game){
 game.microDroneWings??=new Map();
 game.microDroneBaseCooldowns??=new Map();
 game.nextMicroDronePatrolAt??=MICRODRONE_LIMITS.firstPatrolAt;
 game.nextMicroDroneSupportAt??=0;
 game.nextMicroDroneBaseCheckAt??=0;
 // Checkpoints store ships but intentionally do not serialize runtime Maps.
 // A resumed flight must recover its existing wings, not strand frozen drones.
 if(!game.microDroneWings.size){
  const groups=new Map();
  for(const e of game.enemies||[]){
   if(!good(e)||!e.microDrone||!Number.isInteger(e.microWingId))continue;
   if(!groups.has(e.microWingId))groups.set(e.microWingId,[]);
   groups.get(e.microWingId).push(e);
  }
  for(const [id,members] of groups){
   const leader=members[0],now=game.time||0;
   // Runtime packet IDs restart from zero after loading. Old acknowledgments
   // must not suppress every new radio message with the same numeric ID.
   for(const e of members){e._microSeenPackets=[];e.microOrder=null;}
   game.microDroneWings.set(id,{id,scenario:'patrol',members,leader,
    origin:point(leader),patrol:{x:leader.x+(leader.vx||1)*4+900,
     y:leader.y+(leader.vy||0)*4+200},startedAt:now,
    mode:'patrol',modeAt:now,lastContact:null,nextSenseAt:now,
    nextVolleyAt:now+.6,lastLossCount:0,retreatUntil:0,
    requestedSupport:false,calloutUntil:now+1.8});
  }
 }
 for(const wing of game.microDroneWings.values())microRadioInit(wing);
}

export function spawnMicroDroneWing(game,{scenario='patrol',count=8,base=null,
 origin=null,intel=null,patrolGoal=null}={}){
 ensure(game);
 count=wingSize(count);
 if(game.microDroneWings.size>=MICRODRONE_LIMITS.maxWings||
  active(game).length+count>MICRODRONE_LIMITS.maxActive||
  (game.enemies?.length||0)+count>RULES.maxEnemies)return null;
 const nearby=(game.enemies||[]).filter(e=>good(e)&&dist(e,game.player)<1100).length;
 if(scenario==='patrol'&&nearby>(game.player.level<6?12:20)||
  scenario==='support'&&nearby>30)return null;
 const cam=game.spawnEntryCamera?.()||game.camera?.()||
  {x:game.player.x-500,y:game.player.y-350,w:1000,h:700};
 const group=++game.groupSerial;
 const lane=.27+(group%4)*.15;
 const side=group%4;
 const entry=origin|| (base?{x:base.x,y:base.y}:spawnOutside(cam,side,lane,195));
 const patrol=patrolGoal|| (base?{x:base.x+Math.cos(group*1.6)*590,
  y:base.y+Math.sin(group*1.6)*590}:spawnOutside(cam,[1,0,3,2][side],lane,290));
 const start=game.time||0;
 const wing={id:group,scenario,baseId:base?.id||null,base,
  members:[],leader:null,origin:point(entry),patrol,startedAt:start,
  mode:'patrol',modeAt:start,lastContact:intel?{...intel,at:intel.at??start}:null,
  nextSenseAt:start,nextVolleyAt:start+1.2,reportedAt:-Infinity,
  requestedSupport:false,lastLossCount:0,retreatUntil:0,calloutUntil:start+3.2,
  nextOrderAt:start,knownLossCount:0};
 const roles=microDroneRoster(count,scenario);
 for(let i=0;i<roles.length;i++){
  const role=roles[i],spec=MICRODRONE_ROLES[role];
  const phi=i*Math.PI*2/roles.length;
  const x=entry.x+Math.cos(phi)*42,y=entry.y+Math.sin(phi)*42;
  const hp=spec.hp*(1+Math.min(.42,Math.max(0,(game.time||0)-120)/900));
  const e={serial:++game.enemySerial,group,type:spec.hull,
   microDrone:role,microWingId:group,microSlot:i,
   x,y,vx:0,vy:0,r:role==='assault'?16:role==='guardian'?15:12,
   hp,maxHp:hp,damage:spec.damage,think:.2,fire:1+(i%4)*.32,
   state:'hunt',commitUntil:0,target:game.player,angle:0,hit:0,
   expAwarded:false,scenario:'microdrone-'+scenario,
   microLastShot:-Infinity,microScanAt:start,entryPortalPending:false,
   microIntel:intel?{key:intel.key||'player',kind:intel.kind||'player',...intel}:null};
  wing.members.push(e);game.enemies.push(e);
 }
 wing.leader=wing.members[0];
 microRadioInit(wing);
 game.microDroneWings.set(group,wing);
 if(dist(entry,game.player)<1000)
  game.heritage?.play?.('swarmArrival',2,{x:entry.x,y:entry.y});
 return wing;
}

function baseCandidates(game){
 const nearby=game.world?.nearbyStations?.(game.player.x,game.player.y,1550)||[];
 return nearby.filter(b=>b.enemy&&!b.captured&&b.hp>0&&
  (!b.strategicRole||!/(source|mine)$/.test(b.strategicRole))&&
  (!!b.strategicRole||!!game.enemyBasesUnlocked?.()));
}

function baseReserve(game,base,now){
 const role=base.strategicRole||'';
 const supply=game.world?.regionalSupply;
 const pool=role==='military'?supply:
  role==='central-depot'?supply?.central:
  role==='frontier-azure-depot'?supply?.frontier?.azure:
  role==='frontier-teal-depot'?supply?.frontier?.teal:null;
 if(pool)return {available:pool.reserves>0,spend:()=>{pool.reserves--;}};
 // Local nonindustrial installations have a tiny, visible finite hangar.
 // They cannot materialize a new wing on every cooldown.
 base.microDroneStock??=2;
 base.microDroneRestockAt??=now+160;
 if(now>=base.microDroneRestockAt){
  base.microDroneStock=Math.min(2,base.microDroneStock+1);
  base.microDroneRestockAt=now+160;
 }
 return {available:base.microDroneStock>0,
  spend:()=>{base.microDroneStock--;}};
}

export function updateMicroDroneDirector(game){
 ensure(game);
 const now=game.time||0;
 if(game.microDroneQA&&!game._microDroneQAStarted){
  game._microDroneQAStarted=true;
  spawnMicroDroneWing(game,{scenario:'support',count:8,
   origin:{x:game.player.x+290,y:game.player.y-145},
   intel:{x:game.player.x,y:game.player.y,vx:0,vy:0,at:now}});
 }
 const wings=game.microDroneWings;
 const present=new Set(game.enemies||[]);
 // Snapshot the membership: a support wing created during this tick is
 // processed next tick, when its new ships also belong to `present`.
 for(const wing of [...wings.values()]){
  const survivors=wing.members.filter(e=>good(e)&&present.has(e));
  if(!survivors.length){wings.delete(wing.id);continue;}
  wing.leader=survivors[0];
  microRadioAdvance(wing,now);
  if(now>=wing.nextSenseAt){
   wing.nextSenseAt=now+.33;
   const candidates=microDroneTargets(game);
   for(const e of survivors){
    const seen=microDroneObservation(e,game,candidates,MICRODRONE_LIMITS.sightRange);
    if(!seen)continue;
    e.microIntel=seen;
    if(now>=(e.microNextRadioAt||0)){
     microRadioPublish(wing,e,'contact',seen,now);
     e.microNextRadioAt=now+MICRO_RADIO.repeat;
    }
   }
  }
  // A surviving neighbor must actually witness a loss before reporting it.
  // Removed offscreen ships are deliberately excluded from these reports.
  for(const dead of wing.members){
   if((dead.hp>0&&!dead.converted)||dead._microLossReported||!present.has(dead))continue;
   const observer=survivors.find(e=>dist(e,dead)<185||
    (dist(e,dead)<340&&game.enemyCanSee?.(e,dead)));
   if(!observer)continue;
   dead._microLossReported=true;
   microRadioPublish(wing,observer,'loss',{serial:dead.serial},now);
  }
  const leader=wing.leader;
  if(leader.microIntel&&(!wing.lastContact||
     leader.microIntel.at>=wing.lastContact.at))wing.lastContact={...leader.microIntel};
  const relay=survivors.some(e=>e.microDrone==='disruptor'&&
   dist(e,leader)<=MICRO_RADIO.range);
  const contactAge=MICRODRONE_LIMITS.contactAge+(relay?2:0);
  const contacted=leader.microIntel&&now-leader.microIntel.at<contactAge;
  // Despawned offscreen ships are not battle casualties and cannot trigger
  // an artificial distress call or a free reinforcement wing.
  const losses=leader.microKnownLosses?.length||0;
  if(losses>=2&&losses>wing.lastLossCount&&contacted){
   const away=direction(leader.x-wing.lastContact.x,leader.y-wing.lastContact.y);
   wing.rally={x:leader.x+away.x*190,y:leader.y+away.y*190};
   wing.retreatUntil=now+MICRODRONE_LIMITS.lossRetreat;
   wing.mode='regroup';wing.modeAt=now;wing.calloutUntil=now+3.5;
  }
  wing.lastLossCount=losses;
  const previousMode=wing.mode;
  if(now<wing.retreatUntil)wing.mode='regroup';
  else if(contacted){
   const recent=(leader.microThreatReports||[]).filter(t=>now-t.at<12);
   const count=kind=>recent.filter(t=>t.kind===kind).length;
   if(count('area')>=2)wing.mode='scatter';
   else if(count('close')>=2)wing.mode='kite';
   else if(count('long')>=2)wing.mode='press';
   else{
    const phase=Math.floor((now-wing.modeAt)/6.8)%2;
    wing.mode=phase?'strike':'encircle';
   }
  }else if(wing.lastContact&&now-wing.lastContact.at<13)wing.mode='search';
  else wing.mode='patrol';
  if(wing.mode!==previousMode){
   if(wing.mode==='encircle'||wing.mode==='scatter'||wing.mode==='kite'||wing.mode==='press')
    wing.calloutUntil=now+2.7;
  }
  if(wing.mode!==wing.lastRadioMode||now>=(wing.nextOrderAt||0)){
   microRadioPublish(wing,leader,'order',{mode:wing.mode,at:now},now);
   wing.lastRadioMode=wing.mode;wing.nextOrderAt=now+2.5;
  }
  if(!wing.requestedSupport&&contacted&&losses>=Math.ceil(wing.members.length*.4)&&
   now>=game.nextMicroDroneSupportAt&&wings.size<MICRODRONE_LIMITS.maxWings){
   const base=baseCandidates(game).sort((a,b)=>dist(a,wing.leader)-dist(b,wing.leader))[0];
   const support=spawnMicroDroneWing(game,{scenario:'support',count:6,
    base, intel:wing.lastContact});
   if(support){
    wing.requestedSupport=true;game.nextMicroDroneSupportAt=now+MICRODRONE_LIMITS.reinforcementCooldown;
    wing.calloutUntil=now+4;wing.supportCalledAt=now;
    if(dist(wing.leader,game.player)<800)game.notice?.('РАДИОПЕРЕХВАТ · рой запросил подкрепление!',3.3);
   }
  }
  // Patrols depart beyond the camera after crossing the sector. Neither
  // disappearing nor leaving the active population awards the player XP.
  if(wing.mode==='patrol'&&now-wing.startedAt>75&&
   survivors.every(e=>!cameraVisible(e,game.camera?.(),160))){
   for(const e of survivors){e.hp=0;e.expAwarded=true;e.visualDeath=true;}
   wings.delete(wing.id);
  }
 }
 if(game.contourTrial){
  // A charged territorial core emits a real fixed-position distress beacon.
  // One compact response wing investigates that known structure; it does not
  // receive the pilot's live coordinates or add another ambient wave.
  const entry=game.contourTrial.entry;
  game.microDroneTrialSent??=new Set();
  if(entry&&game.player.level>=5&&now>=(game.nextMicroDroneTrialAt||0)&&
     !game.microDroneTrialSent.has(entry.id)&&
     (game.enemies||[]).filter(e=>good(e)&&dist(e,game.player)<950).length<20){
   game.nextMicroDroneTrialAt=now+12;
   const wing=spawnMicroDroneWing(game,{scenario:'trial',count:6,
    patrolGoal:{x:entry.x,y:entry.y}});
   if(wing){game.microDroneTrialSent.add(entry.id);
    if(game.notice)game.notice('РАДИОПЕРЕХВАТ · рой направлен к активному ядру!',3.5);}
  }
  return;
 }
 if(game.operation?.strikerSerial||
  game.openingArc?.status==='active'||
  game.visuals?.capitalDamageQA||game.firstLoopsQA)return;
 const have=active(game).length;
 if(have>=MICRODRONE_LIMITS.maxActive||wings.size>=MICRODRONE_LIMITS.maxWings)return;
 if(now>=game.nextMicroDronePatrolAt&&game.player.level>=3){
  const count=game.player.level<5?6:game.player.level<9?8:10;
  if(spawnMicroDroneWing(game,{scenario:'patrol',count})){
   game.nextMicroDronePatrolAt=now+58+(game.groupSerial%3)*11;
  }else game.nextMicroDronePatrolAt=now+12;
 }
 if(game.player.level<5)return;
 if(now<game.nextMicroDroneBaseCheckAt)return;
 game.nextMicroDroneBaseCheckAt=now+2.8;
 const bases=baseCandidates(game).sort((a,b)=>dist(a,game.player)-dist(b,game.player));
 for(const base of bases){
  if(now<(game.microDroneBaseCooldowns.get(base.id)||0)||
   (game.enemies||[]).filter(e=>good(e)&&dist(e,game.player)<1100).length>30)continue;
  const reserve=baseReserve(game,base,now);
  if(!reserve.available)continue;
  const count=base.rank>=4?10:base.rank>=2?8:6;
  const wing=spawnMicroDroneWing(game,{scenario:'base',count,base});
  if(wing){
   reserve.spend();
   game.microDroneBaseCooldowns.set(base.id,now+MICRODRONE_LIMITS.baseCooldown);
   if(dist(base,game.player)<840)game.notice?.('ВРАЖЕСКАЯ БАЗА · запуск боевого роя!',3.4);
  }
  break;
 }
}

const direction=(x,y)=>{const n=Math.hypot(x,y)||1;return {x:x/n,y:y/n};};
function squadDestination(e,wing,now){
 const target=e.microIntel&&now-e.microIntel.at<13?e.microIntel:null;
 const mode=e.microMode||'patrol';
 const slot=e.microSlot,side=slot%2?1:-1;
 if(!target||mode==='patrol'){
  if(wing.base&&dist(e,wing.patrol)<80&&now-wing.modeAt>8){
   const a=now*.15+wing.id;
   wing.patrol={x:wing.base.x+Math.cos(a)*510,y:wing.base.y+Math.sin(a)*510};
  }
  return {x:wing.patrol.x+Math.cos(slot*2.4)*50,
   y:wing.patrol.y+Math.sin(slot*2.4)*50};
 }
 const center=target,perp=direction(-(center.y-wing.origin.y),center.x-wing.origin.x);
 const normal=direction(wing.origin.x-center.x,wing.origin.y-center.y);
 if(mode==='regroup'){
  const rally=wing.rally||wing.origin;
  return {x:rally.x+normal.x*(85+slot*8)+perp.x*side*62,
   y:rally.y+normal.y*(85+slot*8)+perp.y*side*62};
 }
 if(mode==='search')return {x:center.x+Math.cos(slot*2.399+now*.45)*140,
  y:center.y+Math.sin(slot*2.399+now*.45)*140};
 const spec=MICRODRONE_ROLES[e.microDrone];
 const flank=mode==='scatter'?270:mode==='strike'||mode==='press'?120:183;
 const radius=spec.stand+(mode==='strike'?-26:
  mode==='press'?-75:mode==='kite'?105:24);
 const roleOffset=e.microDrone==='missile'||e.microDrone==='guardian'?-.5:
  e.microDrone==='blade'?.65:0;
 if(e.microDrone==='guardian'){
  const wounded=wing.members.filter(other=>other!==e&&good(other)&&
   other.hp/other.maxHp<.68&&dist(other,e)<480)
   .sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
  if(wounded){const away=direction(wounded.x-center.x,wounded.y-center.y);
   return {x:wounded.x-away.x*75,y:wounded.y-away.y*75};}
 }
 return {x:center.x+normal.x*(radius+roleOffset*30)+perp.x*side*flank,
  y:center.y+normal.y*(radius+roleOffset*30)+perp.y*side*flank};
}

function squadAvoidance(e,wing,game){
 let sx=0,sy=0;
 for(const friend of wing.members){
  if(friend===e||!good(friend))continue;
  const dx=e.x-friend.x,dy=e.y-friend.y,d=Math.hypot(dx,dy)||1;
  const spacing=e.microMode==='scatter'?105:57;
  if(d<spacing){const force=(spacing-d)/spacing;sx+=dx/d*force;sy+=dy/d*force;}
 }
 const avoid=game.avoidance?.(e.x,e.y,34)||{x:0,y:0};
 return {x:clamp(sx,-1,1)+avoid.x*.75,y:clamp(sy,-1,1)+avoid.y*.75};
}

/** Specializations attack using the existing real projectile and hit systems. */
export function updateMicroDrone(e,game,dt){
 if(!good(e))return;
 const spec=MICRODRONE_ROLES[e.microDrone],wing=game.microDroneWings?.get(e.microWingId);
 if(!spec||!wing)return;
 e.microShielded=microDroneShieldFactor(e,game.enemies)<1;
 const now=game.time;
 e.fire=Math.max(-.3,(e.fire||0)-dt);
 const target=e.microIntel,actual=microDroneTarget(game,target)?.unit;
 const range=actual?dist(e,actual):Infinity;
 const live=!!target&&now-target.at<=1.4&&actual&&
  range<=MICRODRONE_LIMITS.sightRange&&!!game.enemyCanSee?.(e,actual);
 const fresh=target&&now-target.at<=MICRODRONE_LIMITS.contactAge+
  (e.microDrone==='hunter'?2.8:0);
 const ordered=e===wing.leader?wing.mode:
  e.microOrder&&now-e.microOrder.at<5.5?e.microOrder.mode:null;
 e.microMode=fresh?(ordered&&ordered!=='patrol'&&ordered!=='search'?ordered:'encircle'):
  target&&now-target.at<13?'search':'patrol';
 if(ordered==='regroup'&&target&&now-target.at<13)e.microMode='regroup';
 const early=e.microMode==='patrol'&&wing.scenario==='base'&&now-wing.startedAt<1.3;
 e.microCloakActive=e.microDrone==='stealth'&&now>=(e.microRevealedUntil||0)&&!e.hit;
 const charge=e.microCharge;
 if(e.microDrone==='blade'&&charge&&now<charge.until){
  if(now>=charge.dashAt){
   const n=direction(charge.x-e.x,charge.y-e.y);
   e.vx=n.x*365;e.vy=n.y*365;
   if(!charge.hit&&live&&range<e.r+(actual.r||19)+8){
    if(target.kind==='player'&&game.player.invul<=0){
     charge.hit=true;game.hurt?.(12,{x:e.x,y:e.y});
    }else if(target.kind==='ally'){
     charge.hit=true;game.hitAlly?.(actual,12,'contact');
    }
   }
  }else{e.vx*=Math.exp(-5*dt);e.vy*=Math.exp(-5*dt);}
  e.x+=e.vx*dt;e.y+=e.vy*dt;
  if(Math.hypot(e.vx,e.vy)>14)e.angle=Math.atan2(e.vy,e.vx)+Math.PI/2;
  return;
 }
 if(e.microCharge&&now>=e.microCharge.until)e.microCharge=null;
 const goal=squadDestination(e,wing,now),repel=squadAvoidance(e,wing,game);
 const dir=direction(goal.x-e.x,goal.y-e.y);
 const speed=spec.speed*(e.microMode==='regroup'?1.23:
  e.microMode==='strike'||e.microMode==='press'?1.12:1);
 const vx=dir.x*speed+repel.x*speed*.44,vy=dir.y*speed+repel.y*speed*.44;
 const smoothing=1-Math.exp(-5.5*dt);
 e.vx+=(vx-e.vx)*smoothing;e.vy+=(vy-e.vy)*smoothing;
 const limit=speed*1.28,actualSpeed=Math.hypot(e.vx,e.vy);
 if(actualSpeed>limit){e.vx=e.vx/actualSpeed*limit;e.vy=e.vy/actualSpeed*limit;}
 e.x+=e.vx*dt;e.y+=e.vy*dt;
 if(actualSpeed>12)e.angle=Math.atan2(e.vy,e.vx)+Math.PI/2;
 if(e.microBurstLeft&&now>=e.microBurstAt){
  if(live&&e.microMode!=='regroup')updateMicroDroneBurst(e,game);
  else e.microBurstLeft=0;
 }
 if(early||e.microMode==='regroup'||e.microMode==='search'||!live)return;
 if(e.microDrone==='blade'&&range<195&&e.fire<=0){
  e.microCharge={x:actual.x+clamp((actual.vx||0)*.18,-45,45),
   y:actual.y+clamp((actual.vy||0)*.18,-45,45),
   dashAt:now+.48,until:now+1.09,hit:false};
  e.fire=spec.reload;return;
 }
 if(range>spec.range||e.fire>0||now<wing.nextVolleyAt||
  (e.microDrone==='blade'&&range<190))return;
 // Only a ship with a direct, unobstructed sighting can launch a projectile.
 const predicted=range/spec.projectile*.26;
 const aimX=actual.x+clamp((actual.vx||0)*predicted,-70,70);
 const aimY=actual.y+clamp((actual.vy||0)*predicted,-70,70);
 const fired=game.enemyShot?.(e.x,e.y,aimX,aimY,spec.damage,
  {kind:spec.shot,speed:spec.projectile,r:spec.shot==='micro-missile'?5.2:3.6,
   microHoming:spec.shot==='micro-missile',microTargetKey:target.key});
 if(fired===false)return;
 e.microLastShot=now;
 if(e.microDrone==='stealth')e.microRevealedUntil=now+2.8;
 e.fire=spec.reload+(e.serial%3)*.17;
 wing.nextVolleyAt=now+MICRODRONE_LIMITS.minShotSpacing;
 const rounds=spec.burst||1;
 if(rounds>1){e.microBurstLeft=rounds-1;e.microBurstAt=now+.18;}
}

/** Second and third shots still share the squad volley gate. */
export function updateMicroDroneBurst(e,game){
 const wing=game.microDroneWings?.get(e.microWingId);
 if(!wing||!good(e)||!e.microBurstLeft||game.time<e.microBurstAt||
  game.time<wing.nextVolleyAt)return false;
 const spec=MICRODRONE_ROLES[e.microDrone];
 const target=e.microIntel,actual=microDroneTarget(game,target)?.unit;
 if(!spec||!target||!actual||dist(e,actual)>spec.range||
  !game.enemyCanSee?.(e,actual)){
  e.microBurstLeft=0;return false;
 }
 const fired=game.enemyShot?.(e.x,e.y,actual.x,actual.y,spec.damage,
  {kind:spec.shot,speed:spec.projectile,r:spec.shot==='micro-missile'?5.2:3.6,
   microHoming:spec.shot==='micro-missile',microTargetKey:target.key});
 if(fired===false)return false;
 e.microLastShot=game.time;
 e.microBurstLeft--;e.microBurstAt=game.time+.2;
 wing.nextVolleyAt=game.time+MICRODRONE_LIMITS.minShotSpacing;
 return true;
}

const imageReady=img=>!!img?.complete&&img.naturalWidth>0;
// Positions of exposed circuitry in the severely damaged painted hulls.
const microDroneRuptures=Object.freeze({
 interceptor:[-.28,.13],assault:[.26,.04],missile:[.28,.08],
 stealth:[.29,.13],disruptor:[-.29,-.17],blade:[.29,.18],
 guardian:[.27,-.19],hunter:[.28,.23]
});
/** Engines, cloaking, damage, shields, antenna sweeps and muzzle flashes are
 * independent animated layers over two high-resolution painted hull states. */
export function drawMicroDrone(c,e,time,sprites={},reduced=false){
 const spec=MICRODRONE_ROLES[e.microDrone];if(!spec)return false;
 const assets=sprites[e.microDrone]||{};
 const idle=time<(e.stasisUntil||0)||Math.hypot(e.vx||0,e.vy||0)<25;
 const hull=imageReady(idle?assets.idle:assets.intact)?
  (idle?assets.idle:assets.intact):imageReady(assets.intact)?assets.intact:null;
 const damage=imageReady(assets.damaged)?assets.damaged:null;
 const pulse=reduced?1:.84+.16*Math.sin(time*19+e.serial*1.7);
 const size=e.r*(e.microDrone==='guardian'?3.85:3.55);
 // Hull ruptures become legible at the first substantial hit; at half health
 // the destroyed plating already dominates the sprite rather than faintly
 // tinting the pristine hull underneath.
 const wear=clamp((.9-e.hp/e.maxHp)/.45,0,1);
 c.save();c.translate(e.x,e.y);c.rotate(e.angle||0);
 if(e.microCloakActive)c.globalAlpha=.38+.12*Math.sin(time*3.6+e.serial);
 c.globalCompositeOperation='screen';
 if(!idle){
  c.fillStyle=spec.color;c.globalAlpha*=.25*pulse;
  c.beginPath();c.ellipse(0,size*.44,5,size*.18,0,0,Math.PI*2);c.fill();
 }
 c.globalCompositeOperation='source-over';
 const cloak=e.microCloakActive?
  .38+.12*Math.sin(time*3.6+e.serial):1;
 c.globalAlpha=cloak;
 if(hull){
  // Crossfade the actual silhouettes. Drawing wreckage over an opaque intact
  // hull would leave the supposedly missing wings visible underneath.
  c.globalAlpha=cloak*(damage?1-wear:1);
  if(c.globalAlpha>0)c.drawImage(hull,-size/2,-size/2,size,size);
  if(damage&&wear){c.globalAlpha=cloak*wear;c.drawImage(damage,-size/2,-size/2,size,size);}
  c.globalAlpha=cloak;
 }else{
  c.fillStyle='#263343';c.strokeStyle=spec.color;c.lineWidth=1.6;
  c.beginPath();c.moveTo(0,-size*.39);c.lineTo(size*.34,size*.27);
  c.lineTo(0,size*.13);c.lineTo(-size*.34,size*.27);c.closePath();c.fill();c.stroke();
 }
 if(damage&&wear>.2&&!reduced){
  const flash=Math.sin(time*28+(e.serial||0)*2.1);
  if(flash>.22){
   const [rx,ry]=microDroneRuptures[e.microDrone];
   const sx=rx*size,sy=ry*size;
   c.globalCompositeOperation='screen';
   c.globalAlpha=cloak*wear*(.4+.4*flash);
   c.strokeStyle=flash>.7?'#c9f3ff':'#ff8d43';
   c.lineWidth=1.5;
   c.beginPath();c.moveTo(sx-size*.055,sy+size*.025);
   c.lineTo(sx+size*.01,sy-size*.035);
   c.lineTo(sx+size*.05,sy+size*.025);c.stroke();
   c.globalCompositeOperation='source-over';c.globalAlpha=cloak;
  }
 }
 if(e.microDrone==='guardian'){
  c.strokeStyle=spec.color;c.globalAlpha=.28+.15*pulse;c.lineWidth=2.4;
  c.beginPath();c.arc(0,0,size*.46,time*.25,time*.25+Math.PI*1.55);c.stroke();c.globalAlpha=1;
 }else if(e.microShielded){
  c.strokeStyle='#82d7ff';c.globalAlpha=.37;c.lineWidth=1.45;
  c.beginPath();c.arc(0,0,size*.48,time*.4,time*.4+Math.PI*1.2);c.stroke();c.globalAlpha=cloak;
 }
 if(e.microDrone==='disruptor'){
  c.strokeStyle='#7cf7e6';c.globalAlpha=.67;c.lineWidth=1.5;
  c.beginPath();c.arc(-size*.21,-size*.13,size*.14,0,Math.PI*2);c.stroke();
  const a=reduced?0:time*2.8;
  c.beginPath();c.moveTo(-size*.21,-size*.13);
  c.lineTo(-size*.21+Math.cos(a)*size*.14,-size*.13+Math.sin(a)*size*.14);c.stroke();
  c.globalAlpha=1;
 }
 if(e.microCharge&&time<e.microCharge.dashAt){
  c.strokeStyle='#ffb26e';c.lineWidth=2.7;c.globalAlpha=.85;
  c.beginPath();c.arc(0,0,size*.54,-Math.PI*.75,Math.PI*.1);c.stroke();c.globalAlpha=1;
 }
 if(time-(e.microLastShot||-Infinity)<.15){
  c.globalCompositeOperation='screen';c.fillStyle=spec.color;
  c.beginPath();c.moveTo(0,-size*.5);c.lineTo(-3,-size*.3);c.lineTo(3,-size*.3);c.fill();
 }
 c.restore();return true;
}

export function drawMicroDroneLinks(c,game,cam,reduced=false){
 const now=game.time;
 for(const wing of game.microDroneWings?.values()||[]){
  const leader=wing.leader;
  if(!leader)continue;
  c.save();
  // Each pulse marks an actual packet delivery, not an imaginary always-on
  // connection between two ships outside each other's radio range.
  for(const ev of wing.radioEvents||[]){
   if(!cameraVisible(ev.from,cam,80)&&!cameraVisible(ev.to,cam,80))continue;
   const age=now-ev.at;
   const color=ev.kind==='loss'?'#ff997b':ev.kind==='threat'?'#ffd16f':
    ev.kind==='order'?'#ba9bff':'#7ddfff';
   c.strokeStyle=color;c.globalAlpha=(reduced?.32:.85)*
    Math.max(0,1-age/MICRO_RADIO.visual);
   c.lineWidth=ev.kind==='order'?2:1.6;
   c.setLineDash(ev.kind==='contact'?[3,5]:[]);
   c.beginPath();c.moveTo(ev.from.x,ev.from.y);
   c.lineTo(ev.to.x,ev.to.y);c.stroke();
  }
  c.setLineDash([]);c.globalAlpha=1;
  if(wing.scenario==='base'&&now-wing.startedAt<1.5){
   const progress=(now-wing.startedAt)/1.5;
   c.strokeStyle='#ffab74';c.globalAlpha=1-progress;c.lineWidth=2.4;
   c.beginPath();c.arc(wing.origin.x,wing.origin.y,35+progress*84,0,Math.PI*2);
   c.stroke();c.globalAlpha=1;
  }
  if(now<wing.calloutUntil&&cameraVisible(leader,cam,100)){
   const label=wing.scenario==='base'&&now-wing.startedAt<2.4?'БАЗА · ЗАПУСК РОЯ':
    now-(wing.supportCalledAt??-Infinity)<4?'ЗАПРОС ПОДКРЕПЛЕНИЯ':
    ({patrol:'ПАТРУЛЬ',encircle:'РОЙ · ОБХОД',strike:'РОЙ · ЗАЛП',
     regroup:'РОЙ · ПЕРЕСТРОЕНИЕ',search:'ПОИСК ЦЕЛИ',
     scatter:'РОЙ · РАССЕЯТЬСЯ',kite:'РОЙ · ДИСТАНЦИЯ',
     press:'РОЙ · СБЛИЗИТЬСЯ'})[wing.mode]||'РОЙ';
   c.textAlign='center';c.fillStyle='#b1eaff';c.font='bold 10px system-ui';
   c.fillText(label,leader.x,leader.y-leader.r-27,190);
  }
  c.restore();
 }
}
