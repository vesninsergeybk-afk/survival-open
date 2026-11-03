// One contextual action across keyboard and touch. Selection is deterministic.
const within=(player,target,radius)=>
 !!target&&Math.hypot(player.x-target.x,player.y-target.y)<=radius;

export function chooseInteraction({player,probe=null,station=null,rock=null,
 probeRange=150,stationRange=165,rockRange=172}){
 if(probe&&within(player,probe,probeRange))
  return {kind:'repair',target:probe,label:'Ремонт',hold:true};
 if(station&&within(player,station,stationRange))
  return {kind:'station',target:station,label:'Станция',hold:false};
 if(rock?.alive&&within(player,rock,rockRange))
  return {kind:'mine',target:rock,label:'Добыча',hold:true};
 return null;
}

// The intent chosen on press remains stable until release. A mining intent
// may continue to the next nearby rock; it never opens a station on its own.
export function activeInteraction(held,kind,available){
 return !!held&&held.kind===kind&&!!available;
}

export function automaticFireAllowed(holdFire,mining,repairing){
 return !holdFire&&!mining&&!repairing;
}
