// Physical long-range machine radio trunks. Every endpoint already exists.
import {tacticalRadioJammed} from './tactical-fields.js?v=tactical-field-1';
export const BACKBONE=Object.freeze({maxDistance:59000,speed:8000,delay:1.8,
  maxTransfers:6,archiveAge:180,doctrineAge:100,doctrineInterval:28,maxArchive:5});
export const BACKBONE_LINKS=Object.freeze([
 ['industry:source','industry:depot'],
 ['industry:depot','28:5'],['28:5','4:-32'],
 ['industry:depot','frontier:azure:source'],
 ['frontier:azure:source','frontier:azure:depot'],
 ['28:5','frontier:azure:depot'],
 ['industry:depot','frontier:teal:source'],
 ['frontier:teal:source','frontier:teal:depot']
].map(pair=>Object.freeze(pair)));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const kinds=new Set(['long','area','close','sabotage']);
const weapons=new Set(['long','area','close']);
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export const backbonePair=(a,b)=>BACKBONE_LINKS.some(([x,y])=>
 a===x&&b===y||a===y&&b===x);
export const backbonePeers=id=>BACKBONE_LINKS.flatMap(([a,b])=>
 a===id?[b]:b===id?[a]:[]);
const live=(s,game)=>s?.enemy&&!s.captured&&!s.suppressed&&s.hp>0&&
 finite(s.x)&&finite(s.y)&&Math.max(s.fluxJamUntil||0,s.fluxBreachUntil||0)<=(game?.time??0)&&
 !tacticalRadioJammed(game,s);
export const backboneActive=(a,b,game)=>!!a&&!!b&&
 backbonePair(a.id,b.id)&&distance(a,b)<=BACKBONE.maxDistance&&
 live(a,game)&&live(b,game);
export const backboneDelay=(a,b)=>BACKBONE.delay+
 distance(a,b)/BACKBONE.speed;
export function threatArchive(station,now){
 return (Array.isArray(station?.meshArchive)?station.meshArchive:[])
 .slice(0,BACKBONE.maxArchive)
 .filter(a=>a&&kinds.has(a.kind)&&finite(a.lastAt)&&a.lastAt>=0&&
   a.lastAt<=now&&now-a.lastAt<=BACKBONE.archiveAge&&
   Number.isInteger(a.reports)&&a.reports>=1&&a.reports<=3&&
   (a.assetId==null||typeof a.assetId==='string'&&a.assetId.length<=100))
 .map(a=>({kind:a.kind,assetId:a.assetId||null,
   lastAt:a.lastAt,reports:a.reports}));
}
export function archiveReport(station,packet,now){
 const doctrine=packet?.kind==='doctrine';
 const kind=doctrine?packet.weaponKind:packet?.kind;
 const observedAt=doctrine?packet.sourceAt:packet?.at;
 // A relayed archive is evidence of an earlier sighting, not a new sighting.
 // Preserve the original time and never count its echoes as corroboration.
 if(!live(station,{time:now})||!kinds.has(kind)||
    (doctrine&&!weapons.has(kind))||!finite(observedAt)||
    observedAt>now||observedAt<0||now-observedAt>BACKBONE.archiveAge||
    (doctrine&&(!finite(packet.at)||packet.at<observedAt||
      packet.at>now||packet.at-observedAt>BACKBONE.archiveAge)))
   return false;
 const records=threatArchive(station,now);
 const assetId=kind==='sabotage'?packet.assetId||null:null;
 const existing=records.find(a=>a.kind===kind&&a.assetId===assetId);
 if(existing){
   existing.lastAt=Math.max(existing.lastAt,observedAt);
   if(!doctrine)existing.reports=Math.min(3,existing.reports+1);
 }else records.push({kind,assetId,lastAt:observedAt,reports:1});
 records.sort((a,b)=>b.lastAt-a.lastAt||b.reports-a.reports);
 station.meshArchive=records.slice(0,BACKBONE.maxArchive);
 return true;
}
export function archivedWeapon(station,now,age=BACKBONE.archiveAge){
 return threatArchive(station,now)
  .filter(a=>weapons.has(a.kind)&&now-a.lastAt<=age)
  .sort((a,b)=>b.lastAt-a.lastAt||b.reports-a.reports)[0]||null;
}
export function archivedIncident(station,assetId,now){
 return threatArchive(station,now).find(a=>a.kind==='sabotage'&&
  a.assetId===String(assetId))||null;
}
export function visibleBackbone(game){
 const stations=game?.world?.stations;
 if(!stations?.get)return [];
 return BACKBONE_LINKS.flatMap(([a,b])=>{
  const left=stations.get(a),right=stations.get(b);
  if(!left?.discovered||!right?.discovered)return [];
  return [{a,b,titleA:left.title||'Узел связи',
    titleB:right.title||'Узел связи',
    active:backboneActive(left,right,game)}];
 });
}
