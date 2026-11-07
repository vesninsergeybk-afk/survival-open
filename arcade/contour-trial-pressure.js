/** The trial answers prolonged immobility with one readable orbital marker.
 * Speed is measured from the ship's actual travel, not displacement from an
 * old anchor: circling the core is legitimate maneuvering. No new enemies are
 * spawned and warning circles never stack on the same position. */
export const CONTOUR_PRESSURE=Object.freeze({
 stillSpeed:55,escapeSpeed:95,lockSeconds:5.2,rearmSeconds:9.5,
 warningSeconds:2.5,radius:78
});

export function updateContourTrialPressure(game,event,dt){
 const p=game.player,now=game.time;
 const state=event.pressure??={x:p.x,y:p.y,stillFor:0,nextAt:now};
 const travelled=Math.hypot(p.x-state.x,p.y-state.y);
 const speed=Math.max(travelled/Math.max(.016,dt),
  Math.hypot(p.vx||0,p.vy||0));
 state.x=p.x;state.y=p.y;
 // Scouting and between-wave breaths must remain genuine chances to charge.
 if(event.phase!=='wave'&&event.phase!=='stabilize'){
  state.stillFor=0;return false;
 }
 if(speed>=CONTOUR_PRESSURE.escapeSpeed)state.stillFor=0;
 else if(speed<CONTOUR_PRESSURE.stillSpeed)
  state.stillFor+=Math.max(0,dt);
 else state.stillFor=Math.max(0,state.stillFor-Math.max(0,dt));
 if(state.stillFor<CONTOUR_PRESSURE.lockSeconds||now<state.nextAt)return false;
 // A second simultaneous red circle is unreadable and may be impossible to
 // dodge; retry once the existing shell has fallen instead.
 if((game.zones||[]).some(z=>z.fuse>0&&
   Math.hypot(z.x-p.x,z.y-p.y)<z.r+CONTOUR_PRESSURE.radius+25))return false;
 const zone={x:p.x,y:p.y,r:CONTOUR_PRESSURE.radius,
  fuse:CONTOUR_PRESSURE.warningSeconds,
  fuseStart:CONTOUR_PRESSURE.warningSeconds,ttl:.3,
  trialId:event.entry.id,antiCamp:true};
 game.zones.push(zone);
 state.stillFor=0;
 state.nextAt=now+CONTOUR_PRESSURE.rearmSeconds;
 game.heritage?.play?.('orbitalWarning',1.1,zone);
 game.notice?.('ОРБИТАЛЬНАЯ НАВОДКА · неподвижная цель! Выйдите из отмеченного круга.',2.7);
 return true;
}
