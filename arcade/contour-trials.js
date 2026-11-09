import {insidePolygon} from './territory-system.js';

// One completed territorial expansion earns one trial. A change to the
// triangulation of land already owned never creates another challenge.
export const CONTOUR_TRIALS=Object.freeze({maxTier:12,maxEntries:256,engageRadius:990,
 retreatRadius:1650,warningSeconds:6,retreatSeconds:7,maxWaveSeconds:100,maxWaitSeconds:12,
 activationRadius:145,activationSeconds:2.2,minWaveSeconds:7});

// Most of the fleet must be defeated; isolated survivors break away instead
// of turning a large battle into a frustrating search for one last scout.
export const trialQuota=count=>Math.max(1,Math.ceil(count*.76));

export const TRIAL_VARIANTS=Object.freeze([
 {id:'orbital',name:'Орбитальная наводка',minTier:1},
 {id:'swarm',name:'Разведывательный рой',minTier:2},
 {id:'pincer',name:'Охват с флангов',minTier:3},
 {id:'interceptors',name:'Группа перехвата',minTier:4},
 {id:'rammers',name:'Таранный налёт',minTier:5},
 {id:'repair',name:'Ремонтное прикрытие',minTier:6},
 {id:'gunship',name:'Тяжёлый корвет',minTier:7},
 {id:'crossfire',name:'Перекрёстный обстрел',minTier:8},
 {id:'reinforcements',name:'Ускоренное подкрепление',minTier:9},
 {id:'elite',name:'Ударный авангард',minTier:10}
]);

export const newTrialLedger=()=>({version:1,serial:0,completed:0,entries:[]});

export function ensureTrialLedger(world){
 const state=world?.contours;
 if(!state)return null;
 if(!state.trials)state.trials=newTrialLedger();
 return state.trials;
}

const within=(point,field)=>insidePolygon(point,field.polygon);

// A newly expanded face can keep its old centroid. Find a sample of the
// actual *new land*, never mistake a changed face ID for a new territory.
function newLandPoint(field,oldFields){
 const center=field.center;
 const probes=[center];
 for(let i=0;i<field.polygon.length;i++){
  const a=field.polygon[i],b=field.polygon[(i+1)%field.polygon.length];
  probes.push({x:center.x*.34+a.x*.66,y:center.y*.34+a.y*.66});
  probes.push({x:center.x*.34+(a.x+b.x)*.33,y:center.y*.34+(a.y+b.y)*.33});
  probes.push({x:center.x*.72+(a.x+b.x)*.14,y:center.y*.72+(a.y+b.y)*.14});
 }
 return probes.find(p=>within(p,field)&&!oldFields.some(old=>within(p,old)))||null;
}

export function registerContourTrials(world,oldFields,newFields,gainedArea){
 if(!(gainedArea>1))return [];
 const ledger=ensureTrialLedger(world),created=[];
 for(const field of newFields){
  if(ledger.entries.length>=CONTOUR_TRIALS.maxEntries)break;
  const point=newLandPoint(field,oldFields);
  if(!point)continue;
  if(ledger.entries.some(e=>Math.hypot(e.x-point.x,e.y-point.y)<10))continue;
  const serial=++ledger.serial;
  const entry={id:serial,x:Math.round(point.x),y:Math.round(point.y),
   // Count every newly claimed area, including a defended core still awaiting
   // the pilot's E. Otherwise that ready core makes the next siege tier 1 again.
   tier:Math.min(CONTOUR_TRIALS.maxTier,serial),status:'pending'};
  ledger.entries.push(entry);created.push(entry);
 }
 return created;
}

export function pendingContourTrials(world){
 return world?.contours?.trials?.entries.filter(e=>e.status==='pending')||[];
}
export function readyContourTrials(world){
 return world?.contours?.trials?.entries.filter(e=>e.status==='ready')||[];
}
export function unresolvedContourTrials(world){
 return world?.contours?.trials?.entries.filter(e=>e.status!=='complete')||[];
}

export function trialBlockingField(world,field){
 return unresolvedContourTrials(world).find(e=>within(e,field))||null;
}

export function productiveContourFields(world,fields){
 return fields.filter(f=>!trialBlockingField(world,f));
}

export function completeContourTrial(world,id){
 const ledger=ensureTrialLedger(world),entry=ledger?.entries.find(e=>e.id===id);
 if(!entry||entry.status!=='ready')return false;
 entry.status='complete';ledger.completed++;return true;
}
export function prepareContourVortex(world,id){
 const entry=ensureTrialLedger(world)?.entries.find(e=>e.id===id);
 if(!entry||entry.status!=='pending')return false;
 entry.status='ready';return true;
}

export function validContourTrials(trials){
 if(trials===undefined)return true; // Saves from before the trials update.
 if(!trials||trials.version!==1||!Number.isInteger(trials.serial)||trials.serial<0||
  trials.serial>1000000||!Number.isInteger(trials.completed)||trials.completed<0||
  trials.completed>1000000||!Array.isArray(trials.entries)||
  trials.entries.length>CONTOUR_TRIALS.maxEntries)return false;
 const unique=new Set();
 for(const e of trials.entries){
  if(!e||!Number.isInteger(e.id)||e.id<1||e.id>trials.serial||unique.has(e.id)||
   !Number.isFinite(e.x)||!Number.isFinite(e.y)||
   Math.abs(e.x)>1e9||Math.abs(e.y)>1e9||
   !Number.isInteger(e.tier)||e.tier<1||e.tier>CONTOUR_TRIALS.maxTier||
   !['pending','ready','complete'].includes(e.status))return false;
  unique.add(e.id);
 }
 return trials.completed>=trials.entries.filter(e=>e.status==='complete').length;
}

// Seeded wave compositions and approach patterns: a failed assault can be
// retried fairly, but a different triangle will not repeat the same attack.
export function trialRandom(tier,serial,wave=0){
 let state=(Math.imul(tier,0x9e3779b1)^Math.imul(serial,0x85ebca6b)^
  Math.imul(wave+1,0xc2b2ae35))>>>0;
 return ()=>{
  state^=state<<13;state^=state>>>17;state^=state<<5;
  return (state>>>0)/4294967296;
 };
}

export const TRIAL_FORMATIONS=Object.freeze(['рой','клещи','окружение','авангард']);

function planWave(tier,serial,index){
 const random=trialRandom(tier,serial,index);
 const total=Math.min(64,Math.round([14,20,27][index]+(tier-1)*[2,2.5,3][index]+(random()-.5)*4));
 const gunship=index===2?1+Math.floor((tier-1)/5):tier>=5&&index===1?1:0;
 const healer=tier>=4&&index>=1?1+Math.floor((tier-4)/6):0;
 const berserker=index===0?(tier>=4?1+Math.floor(tier/6):0):
  1+index+Math.floor((tier-1)/4)+(random()>.64?1:0);
 const flanker=tier>=3?(index+1)*Math.floor(tier/4)+(random()>.5?1:0):index===2?1:0;
 const fighter=Math.max(2,Math.round(total*(.22+index*.035)+(random()-.5)*3));
 const wave={scout:total-gunship-healer-berserker-flanker-fighter,
  fighter,berserker,flanker,healer,gunship};
 // Every wave contains a real IRIS pack, including late assaults with armor.
 if(wave.scout<10){wave.fighter-=10-wave.scout;wave.scout=10;}
 for(const type of Object.keys(wave))if(!wave[type])delete wave[type];
 return {wave,formation:TRIAL_FORMATIONS[Math.floor(random()*TRIAL_FORMATIONS.length)]};
}

export function planContourTrial(tier,serial=1){
 const t=Math.max(1,Math.min(CONTOUR_TRIALS.maxTier,Math.floor(tier)||1));
 const seed=Math.max(1,Math.floor(serial)||1);
 const available=TRIAL_VARIANTS.filter(v=>v.minTier<=t);
 const first=available[(seed+t-2)%available.length];
 const variants=[first];
 if(t>=7){const second=available[(seed+t+2)%available.length];if(second!==first)variants.push(second);}
 if(t>=11){const third=available[(seed+t+6)%available.length];if(!variants.includes(third))variants.push(third);}
 const encounters=[0,1,2].map(index=>planWave(t,seed,index));
 const waveSets=encounters.map(({wave})=>wave);
 const formations=encounters.map(({formation})=>formation);
 if(variants.some(v=>v.id==='pincer'))formations[1]='клещи';
 if(variants.some(v=>v.id==='swarm'))formations[2]='рой';
 if(variants.some(v=>v.id==='elite'))formations[2]='авангард';
 const last=waveSets[waveSets.length-1];
 for(const v of variants){
  if(v.id==='swarm')last.scout=(last.scout||0)+Math.min(4,1+Math.floor(t/4));
  if(v.id==='interceptors')last.fighter=(last.fighter||0)+1;
  if(v.id==='rammers')last.berserker=(last.berserker||0)+1;
  if(v.id==='repair')last.healer=(last.healer||0)+1;
  if(v.id==='gunship')last.gunship=(last.gunship||0)+1;
  if(v.id==='elite')last.flanker=(last.flanker||0)+2;
  if(v.id==='reinforcements')waveSets[0].scout=(waveSets[0].scout||0)+2;
 }
 // Tactical variants may add ships, but can never overrun the encounter
 // cap on lower-end devices. Keep at least one genuine IRIS pack.
 for(const wave of waveSets){
  const excess=Math.max(0,Object.values(wave).reduce((sum,n)=>sum+n,0)-64);
  if(excess)wave.scout-=excess;
 }
 return {tier:t,serial:seed,variants,waves:waveSets,
  formations,
  recommendedLevel:[2,3,5,6,8,10,12,14,16,18,20,22][t-1],
  waveSeconds:CONTOUR_TRIALS.maxWaveSeconds+Math.min(20,(t-1)*2),
  // Orbital fire must remain an active movement test throughout all three
  // waves, even on the first field; telegraphs still give 2+ s to evade.
  strikeInterval:Math.max(7.2,10.5-(t-1)*.32)-
   (variants.some(v=>v.id==='orbital')?1.1:0),
  strikeCount:t>=6?3:2,
  intermission:variants.some(v=>v.id==='reinforcements')?2.5:4.5};
}
