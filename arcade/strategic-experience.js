import {contourFields} from './territory-system.js?v=contours-1-world-feedback-1-triangle-defense-1';
import {validStationId} from './station-ids.js?v=living-world-checkpoint-1';

// Finite additions to the existing combat/contract XP economy. The third
// progression pass will simulate level pacing before changing the XP curve.
export const STRATEGIC_XP=Object.freeze({
 activation:12,capture:24,strategicCapture:34,exploration:6,radarBonus:2,
 firstContour:24,contourStation:10,firstDelivery:12,survey:9,miningBonus:2,sabotage:14,
 maxActivations:16,maxCaptures:16,maxExploration:18,maxContourStations:18,
 maxSurveys:6,maxSabotages:12,minSurveyDistance:900
});

const distinct=(values,limit)=>[...new Set(values)].slice(0,limit);
export const createStrategicExperience=()=>({version:1,activations:[],captures:[],
 exploration:[],contourStations:[],surveys:[],sabotages:[],
 firstContour:false,firstDelivery:false});

// A checkpoint created before this feature has already paid for some of its
// achievements through other mechanisms. Preserve its level and mark every
// observable past milestone as spent; never grant historical XP on load.
export function inheritStrategicExperience(player,world){
 if(player.strategicXp!==undefined){
  // The first published ledger could contain the free starting dock when
  // importing an old run. Repair those saves without changing earned XP.
  const ledger=player.strategicXp;
  ledger.activations=ledger.activations.filter(id=>id!=='0:0');
  ledger.exploration=ledger.exploration.filter(id=>id!=='0:0');
  return ledger;
 }
 const ledger=createStrategicExperience();
 const bases=[...world.stations.values()];
 // Home is active from the start and never earns activation or discovery XP.
 // Counting it here would silently consume a paid slot in legacy saves.
 ledger.activations=distinct(bases.filter(b=>b.id!=='0:0'&&b.active&&!b.enemy)
  .map(b=>b.id),STRATEGIC_XP.maxActivations);
 ledger.captures=distinct(bases.filter(b=>b.captured).map(b=>b.id),STRATEGIC_XP.maxCaptures);
 ledger.exploration=distinct([...world.discovered].filter(id=>id!=='0:0'),STRATEGIC_XP.maxExploration);
 const fields=contourFields(world);
 ledger.contourStations=distinct(fields.flatMap(f=>f.vertices),STRATEGIC_XP.maxContourStations);
 ledger.firstContour=fields.length>0||world.contours.delivered>0||
  Object.keys(world.contours.launches||{}).length>0;
 ledger.firstDelivery=world.contours.delivered>0;
 for(const base of bases){
  if(base.corridorSecured)ledger.sabotages.push('corridor:'+base.id);
  if(base.supplyIntercepted)ledger.sabotages.push('carrier:'+base.id);
 }
 ledger.sabotages=distinct(ledger.sabotages,STRATEGIC_XP.maxSabotages);
 player.strategicXp=ledger;return ledger;
}

const claimId=(ledger,field,id,cap,value)=>{
 if(!validStationId(id)||ledger[field].length>=cap||ledger[field].includes(id))return 0;
 ledger[field].push(id);return value;
};

export function claimStationActivation(player,base){
 const ledger=player?.strategicXp;
 if(!ledger||!base?.active||base.enemy||base.id==='0:0')return 0;
 return claimId(ledger,'activations',base.id,STRATEGIC_XP.maxActivations,STRATEGIC_XP.activation);
}
export function claimStationCapture(player,base){
 const ledger=player?.strategicXp;
 if(!ledger||!base?.captured||base.enemy)return 0;
 return claimId(ledger,'captures',base.id,STRATEGIC_XP.maxCaptures,
  base.strategicRole?STRATEGIC_XP.strategicCapture:STRATEGIC_XP.capture);
}
export function claimExploration(player,base,radarRank=0){
 const ledger=player?.strategicXp;
 if(!ledger||!base?.discovered||base.id==='0:0')return 0;
 return claimId(ledger,'exploration',base.id,STRATEGIC_XP.maxExploration,
  STRATEGIC_XP.exploration+STRATEGIC_XP.radarBonus*Math.min(2,Math.max(0,radarRank|0)));
}
export function claimContourExpansion(player,fields,gainedArea){
 const ledger=player?.strategicXp;
 if(!ledger||!Array.isArray(fields)||!Number.isFinite(gainedArea)||gainedArea<=1||!fields.length)return 0;
 let amount=0;
 if(!ledger.firstContour){ledger.firstContour=true;amount+=STRATEGIC_XP.firstContour;}
 const stations=new Set(fields.flatMap(f=>f.vertices));
 for(const id of stations)amount+=claimId(ledger,'contourStations',id,
  STRATEGIC_XP.maxContourStations,STRATEGIC_XP.contourStation);
 return amount;
}
export function claimFirstFluxDelivery(player,delivered){
 const ledger=player?.strategicXp;
 if(!ledger||ledger.firstDelivery||!Number.isFinite(delivered)||delivered<=.01)return 0;
 ledger.firstDelivery=true;return STRATEGIC_XP.firstDelivery;
}
export function claimGeologicalSurvey(player,rock,kind,miningRank=0){
 const ledger=player?.strategicXp;
 if(!ledger||kind!=='extract'||!rock?.rich||typeof rock.id!=='string'||rock.id.length>100||
  ledger.surveys.length>=STRATEGIC_XP.maxSurveys)return 0;
 const x=rock.originX??rock.x,y=rock.originY??rock.y;
 if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1e9||Math.abs(y)>1e9||
  ledger.surveys.some(s=>s.id===rock.id||Math.hypot(s.x-x,s.y-y)<STRATEGIC_XP.minSurveyDistance))return 0;
 const first=ledger.surveys.length===0;
 ledger.surveys.push({id:rock.id,x,y});
 // A fresh pilot receives the separate first-rich-rock bonus for this sample.
 // For a migrated pilot who already received it before this ledger existed,
 // the first *new* survey is eligible for the ordinary geological bonus.
 return first&&!player.firstRichRockStudied?0:STRATEGIC_XP.survey+
  STRATEGIC_XP.miningBonus*Math.min(4,Math.max(0,miningRank|0));
}
export function claimStrategicSabotage(player,kind,baseId){
 const ledger=player?.strategicXp;
 if(!ledger||!['corridor','carrier'].includes(kind)||!validStationId(baseId))return 0;
 const key=kind+':'+baseId;
 if(ledger.sabotages.length>=STRATEGIC_XP.maxSabotages||ledger.sabotages.includes(key))return 0;
 ledger.sabotages.push(key);return STRATEGIC_XP.sabotage;
}

export function validStrategicExperience(ledger,stations){
 if(!ledger||typeof ledger!=='object'||Array.isArray(ledger)||ledger.version!==1||
  typeof ledger.firstContour!=='boolean'||typeof ledger.firstDelivery!=='boolean')return false;
 const ids=new Set(stations.map(([id])=>id));
 for(const [field,limit] of [['activations',STRATEGIC_XP.maxActivations],['captures',STRATEGIC_XP.maxCaptures],
  ['exploration',STRATEGIC_XP.maxExploration],['contourStations',STRATEGIC_XP.maxContourStations]]){
  const a=ledger[field];
  if(!Array.isArray(a)||a.length>limit||new Set(a).size!==a.length||
   a.some(id=>!validStationId(id)||!ids.has(id)))return false;
 }
 const surveys=ledger.surveys,sabotages=ledger.sabotages;
 if(!Array.isArray(surveys)||surveys.length>STRATEGIC_XP.maxSurveys||
  surveys.some(s=>!s||typeof s.id!=='string'||s.id.length>100||
   !Number.isFinite(s.x)||Math.abs(s.x)>1e9||!Number.isFinite(s.y)||Math.abs(s.y)>1e9)||
  new Set(surveys.map(s=>s.id)).size!==surveys.length)return false;
 if(!Array.isArray(sabotages)||sabotages.length>STRATEGIC_XP.maxSabotages||
  new Set(sabotages).size!==sabotages.length||sabotages.some(key=>{
   if(typeof key!=='string')return true;
   const match=/^(corridor|carrier):(.+)$/.exec(key);
   return !match||!validStationId(match[2])||!ids.has(match[2]);
  }))return false;
 return true;
}
