/**
 * Mission 4 scripted trap: frame-rate-independent timings and two hulls.
 * Pure model for determinism, combat and rendering are owned by MissionWorld.
 */
export const CONVOY_TRAP = Object.freeze({
    engineFailureAt:6.2,
    salvageSeconds:84,
    orbitalCadence:13.5,
    boardingCadence:16,
    warningSeconds:2.4,
    orbitalRadius:104,
    orbitalDamage:15
});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export function createConvoyTrap(convoy,route){
    const prev=route?.[route.length-2]||{x:convoy.x-1,y:convoy.y};
    const last=route?.[route.length-1]||convoy;
    const angle=Math.atan2(last.y-prev.y,last.x-prev.x);
    const dx=Math.cos(angle),dy=Math.sin(angle);
    return {
        phase:'impact',age:0,salvageTime:0,progress:0,
        angle,dx,dy,orbitalClock:12,boardingClock:9,
        engineFailed:false,cleared:false,shots:[],
        wrecks:[
            {id:'vanguard',x:convoy.x+dx*208,y:convoy.y+dy*208,integrity:1},
            {id:'rearguard',x:convoy.x-dx*208,y:convoy.y-dy*208,integrity:1}
        ]
    };
}

/** Advance cutscene and salvage while preserving per-frame event boundaries. */
export function advanceConvoyTrap(trap,dt){
    const events={engineFailure:false,orbital:false,boarders:false,cleared:false};
    if(!trap||trap.cleared||dt<=0)return events;
    const wasImpact=trap.phase==='impact';
    trap.age+=dt;
    let salvageDt=dt;
    if(wasImpact && trap.age>=CONVOY_TRAP.engineFailureAt){
        // A long frame must not credit time spent pushing the wreck as repair.
        salvageDt=Math.max(0,trap.age-CONVOY_TRAP.engineFailureAt);
        trap.phase='salvage';trap.engineFailed=true;events.engineFailure=true;
    }
    if(trap.phase!=='salvage')return events;
    trap.salvageTime+=salvageDt;
    trap.progress=clamp(trap.salvageTime/CONVOY_TRAP.salvageSeconds,0,1);
    for(const wreck of trap.wrecks)wreck.integrity=1-trap.progress;
    trap.orbitalClock-=salvageDt;
    trap.boardingClock-=salvageDt;
    if(trap.orbitalClock<=0){
        trap.orbitalClock+=CONVOY_TRAP.orbitalCadence;
        events.orbital=true;
    }
    if(trap.boardingClock<=0){
        trap.boardingClock+=CONVOY_TRAP.boardingCadence;
        events.boarders=true;
    }
    if(trap.progress>=1){
        trap.phase='cleared';trap.cleared=true;events.cleared=true;
    }
    return events;
}

export function progressCaption(trap){
    if(!trap)return '';
    if(trap.phase==='impact')return 'Двигатели пытаются сдвинуть передний транспорт';
    if(trap.phase==='salvage')return 'Дроны разбирают завал: '+Math.round(trap.progress*100)+'%';
    return 'Проход освобождён';
}
