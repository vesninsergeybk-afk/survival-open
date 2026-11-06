import {insidePolygon} from './territory-system.js';

// One completed territorial expansion earns one trial. A change to the
// triangulation of land already owned never creates another challenge.
export const CONTOUR_TRIALS=Object.freeze({maxTier:12,maxEntries:256,engageRadius:990,
 retreatRadius:1650,warningSeconds:5,retreatSeconds:7,maxWaveSeconds:70});

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
   tier:Math.min(CONTOUR_TRIALS.maxTier,ledger.completed+
    ledger.entries.filter(e=>e.status==='pending').length+1),status:'pending'};
  ledger.entries.push(entry);created.push(entry);
 }
 return created;
}

export function pendingContourTrials(world){
 return world?.contours?.trials?.entries.filter(e=>e.status==='pending')||[];
}

export function trialBlockingField(world,field){
 return world?.contours?.trials?.entries.find(e=>e.status==='pending'&&within(e,field))||null;
}

export function productiveContourFields(world,fields){
 return fields.filter(f=>!trialBlockingField(world,f));
}

export function completeContourTrial(world,id){
 const ledger=ensureTrialLedger(world),entry=ledger?.entries.find(e=>e.id===id);
 if(!entry||entry.status!=='pending')return false;
 entry.status='complete';ledger.completed++;return true;
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
   !['pending','complete'].includes(e.status))return false;
  unique.add(e.id);
 }
 return trials.completed>=trials.entries.filter(e=>e.status==='complete').length;
}

// The first three steps introduce threats in the agreed order. Higher steps
// use a bounded mix of the ten encounter variants, never infinite enemy growth.
const STAGES=[
 [{scout:2}],
 [{scout:2},{scout:3}],
 [{scout:3},{fighter:2}],
 [{scout:2,fighter:2},{flanker:2,scout:2}],
 [{fighter:3},{berserker:2,scout:2}],
 [{scout:3,flanker:2},{fighter:3,healer:1}],
 [{fighter:3,berserker:2},{gunship:1,scout:3}],
 [{flanker:3,scout:3},{fighter:3,healer:1,berserker:2}],
 [{scout:4,berserker:2},{gunship:1,fighter:3},{flanker:3,healer:1}],
 [{gunship:1,scout:4},{fighter:4,flanker:2},{berserker:3,healer:1}],
 [{flanker:3,fighter:3},{gunship:1,healer:1,berserker:2},{gunship:1,scout:4}],
 [{gunship:1,flanker:3},{gunship:1,healer:1,fighter:4},{gunship:2,berserker:3,flanker:2}]
];

export function planContourTrial(tier,serial=1){
 const t=Math.max(1,Math.min(CONTOUR_TRIALS.maxTier,Math.floor(tier)||1));
 const available=TRIAL_VARIANTS.filter(v=>v.minTier<=t);
 const first=available[(serial+t-2)%available.length];
 const variants=[first];
 if(t>=7){const second=available[(serial+t+2)%available.length];if(second!==first)variants.push(second);}
 if(t>=11){const third=available[(serial+t+6)%available.length];if(!variants.includes(third))variants.push(third);}
 const waveSets=STAGES[t-1].map(wave=>({...wave}));
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
 return {tier:t,serial,variants,waves:waveSets,
  recommendedLevel:[2,3,4,5,6,7,8,9,10,11,12,14][t-1],
  strikeInterval:Math.max(7.5,20-(t-1)*1.03)-
   (variants.some(v=>v.id==='orbital')?2.2:0),
  strikeCount:variants.some(v=>v.id==='crossfire')?2:1,
  intermission:variants.some(v=>v.id==='reinforcements')?2.5:4.5};
}
