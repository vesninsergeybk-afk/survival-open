// Keep the activation socket clear without deleting ore. The procedural rock
// belongs to its original cell, but its *resting* position may be rebased once
// when a new core displaces it. This avoids the ordinary 86-unit impact leash.
export const CORE_ROCK_CLEARANCE=78;
export const CORE_ROCK_PADDING=9;

export function coreRockDestination(rock,core){
 if(!rock?.alive||!core)return null;
 const dx=rock.x-core.x,dy=rock.y-core.y,d=Math.hypot(dx,dy);
 const needed=(rock.r||0)+CORE_ROCK_CLEARANCE;
 if(d>=needed)return null;
 const angle=d>1?Math.atan2(dy,dx):
  (rock.originX||0)*.071+(rock.originY||0)*.047;
 const radius=needed+CORE_ROCK_PADDING;
 return {x:core.x+Math.cos(angle)*radius,
  y:core.y+Math.sin(angle)*radius};
}

export function moveRockOutOfCore(rock,core,animate=true){
 const target=coreRockDestination(rock,core);
 if(!target)return false;
 if(animate){
  rock.coreRepulsion={fromX:rock.x,fromY:rock.y,toX:target.x,toY:target.y,
   duration:.68,elapsed:0};
 }else{
  rock.x=target.x;rock.y=target.y;
  rock.originX=target.x;rock.originY=target.y;
  delete rock.coreRepulsion;
 }
 rock.vx=0;rock.vy=0;
 rock.spinVelocity=(rock.spinVelocity||0)+.7;
 return true;
}

export function advanceCoreRepulsion(rock,dt){
 const motion=rock.coreRepulsion;
 if(!motion)return false;
 motion.elapsed=Math.min(motion.duration,motion.elapsed+Math.max(0,dt));
 const t=motion.elapsed/motion.duration;
 const eased=1-Math.pow(1-t,3);
 rock.x=motion.fromX+(motion.toX-motion.fromX)*eased;
 rock.y=motion.fromY+(motion.toY-motion.fromY)*eased;
 if(t>=1){
  rock.originX=motion.toX;rock.originY=motion.toY;
  delete rock.coreRepulsion;
 }
 return true;
}

export function clearCoreRocks(world,entry,animate=true){
 if(!world?.nearbyRocks||!entry)return 0;
 let moved=0;
 for(const rock of world.nearbyRocks(entry.x,entry.y,165)){
  if(moveRockOutOfCore(rock,entry,animate))moved++;
 }
 return moved;
}
