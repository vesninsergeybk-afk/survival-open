// A small, readable investigation state machine for patrols drawn by extraction.
// Ordinary arcade encounters retain their existing tactics and tempo.
export const SIGNAL_AI=Object.freeze({
  detectRadius:290,closeRadius:88,arrivalRadius:78,
  investigateLimit:18,searchSeconds:5.5,loseSeconds:3.4
});
// Automatic weapons ignore a patrol still investigating an unconfirmed signal.
// This rule is shared by the player's beam, missiles and autonomous escorts.
export function canAutoTarget(enemy){
  return !enemy?.signalIntel||enemy.signalIntel.mode==='engaged';
}
export function createSignalIntel(x,y,time){
  return {mode:'investigate',sourceX:x,sourceY:y,
    searchX:x,searchY:y,searchStarted:0,searchUntil:0,
    lastSeenX:x,lastSeenY:y,lastSeenAt:-Infinity,combatFocus:null,
    investigateUntil:time+SIGNAL_AI.investigateLimit,
    cueUntil:time+2.3};
}
export function alertSignalIntel(intel,player,time){
  if(!intel)return false;
  const changed=intel.mode!=='engaged';
  intel.mode='engaged';
  intel.lastSeenX=player.x;intel.lastSeenY=player.y;intel.lastSeenAt=time;
  intel.combatFocus=player;
  if(changed)intel.cueUntil=time+2.3;
  return changed;
}
export function updateSignalIntent(enemy,game,dt){
  const intel=enemy.signalIntel;
  if(!intel)return null;
  const now=game.time,p=game.player;
  // The investigating patrol has independent memory per ship. A wingman
  // joins combat only after a real, acknowledged radio report reaches it.
  const radio=game.enemyComms?.directiveFor?.(enemy,now);
  if(radio?.intel&&radio.intel.at>(intel._receivedSightAt??-Infinity)&&
     now-radio.intel.at<=2.6){
    intel._receivedSightAt=radio.intel.at;
    const changed=intel.mode!=='engaged';
    intel.mode='engaged';intel.combatFocus=p;
    intel.lastSeenX=radio.intel.x;intel.lastSeenY=radio.intel.y;
    intel.lastSeenAt=radio.intel.at;
    if(changed)intel.cueUntil=now+2.3;
  }
  const distance=Math.hypot(enemy.x-p.x,enemy.y-p.y);
  enemy.sensorTimer=(enemy.sensorTimer??0)-dt;
  if(enemy.sensorTimer<=0){
    enemy.sensorTimer=.24+(enemy.serial%3)*.055;
    const nearby=distance<=SIGNAL_AI.closeRadius;
    const sees=nearby||(distance<=SIGNAL_AI.detectRadius&&
      (game.enemyCanSee?.(enemy,p)??true));
    if(sees)alertSignalIntel(intel,p,now);
    else if(intel.combatFocus&&intel.combatFocus!==p&&intel.combatFocus.hp>0){
      const focus=intel.combatFocus;
      const range=Math.hypot(enemy.x-focus.x,enemy.y-focus.y);
      if(range<=SIGNAL_AI.closeRadius||
        (range<=SIGNAL_AI.detectRadius&&(game.enemyCanSee?.(enemy,focus)??true))){
        alertSignalIntel(intel,focus,now);
      }
    }
  }
  if(intel.mode==='engaged'){
    // Memory is deliberately short at long range; proximity prevents cheap
    // instant hiding behind a single asteroid during close combat.
    if(distance>SIGNAL_AI.closeRadius&&now-intel.lastSeenAt>SIGNAL_AI.loseSeconds){
      intel.mode='search';intel.searchX=intel.lastSeenX;intel.searchY=intel.lastSeenY;
      intel.searchStarted=now;intel.searchUntil=now+SIGNAL_AI.searchSeconds;
      intel.cueUntil=now+1.5;
    }else return null;
  }
  const slot=enemy.signalSlot||0;
  const angle=slot*2.45;
  if(intel.mode==='investigate'){
    const radius=slot?65:0;
    const x=intel.sourceX+Math.cos(angle)*radius;
    const y=intel.sourceY+Math.sin(angle)*radius;
    if(Math.hypot(enemy.x-x,enemy.y-y)>SIGNAL_AI.arrivalRadius&&
       now<intel.investigateUntil)return {x,y,speed:1};
    intel.mode='search';intel.searchX=intel.sourceX;intel.searchY=intel.sourceY;
    intel.searchStarted=now;intel.searchUntil=now+SIGNAL_AI.searchSeconds;
    intel.cueUntil=now+1.4;
  }
  if(intel.mode==='search'){
    if(now<intel.searchUntil){
      const orbit=(now-intel.searchStarted)*.7+angle;
      return {x:intel.searchX+Math.cos(orbit)*72,
        y:intel.searchY+Math.sin(orbit)*72,speed:.72};
    }
    intel.mode='withdraw';intel.cueUntil=now+1.2;
  }
  if(intel.mode==='withdraw'){
    return {x:enemy.signalExitX,y:enemy.signalExitY,speed:1.2,retreat:true};
  }
  return null;
}
