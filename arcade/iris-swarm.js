import {firstRockImpact} from './terrain.js?v=arcade-belt-26';

/** I.R.I.S. pressure comes from position and turn-taking, not extra hull HP.
 * A hit is a signal to nearby members of the SAME encounter: one ship breaks
 * contact while the others close. The computation uses the existing grid and
 * bounded timers; there is no shared global target lock or invulnerability. */
export const IRIS_SWARM=Object.freeze({
  sensorRange:385,fireRange:365,wingRadius:330,
  retreatSeconds:1.35,retreatCooldown:4.6,wingSeconds:1.65,
  coverRadius:240
});

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const direction=(from,to)=>{
  const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy)||1;
  return {x:dx/d,y:dy/d};
};
const active=e=>e?.type==='scout'&&e.hp>0&&!e.converted&&
  !e.boss&&!e.missionStructure&&!e.interceptCargo;
const freeHunter=(e,player)=>active(e)&&
  (!e.state||e.state==='hunt')&&!(e.protect?.hp>0)&&
  (!e.target||e.target===player||e.target.hp<=0);

/** Long-range violet scanner checks actual asteroid occlusion. Ordinary
 * forward-cone vision is retained at short range; long-range acquisition
 * requires an unobstructed ray and an actual world rock grid. */
export function irisCanSense(e,game,target,range=IRIS_SWARM.sensorRange){
  if(!target||!(target.hp>0)||distance(e,target)>range)return false;
  if(distance(e,target)<=290)return game.enemyCanSee?.(e,target)??true;
  if(!game.rockGrid?.query)return game.enemyCanSee?.(e,target)??false;
  const d=distance(e,target);
  const rocks=game.rockGrid.query((e.x+target.x)*.5,(e.y+target.y)*.5,d*.5+80);
  return !firstRockImpact(e.x,e.y,target.x,target.y,rocks,0,target);
}

function coverDestination(e,game,player){
  if(!game.rockGrid?.query)return null;
  let best=null,bestScore=Infinity;
  for(const rock of game.rockGrid.query(e.x,e.y,IRIS_SWARM.coverRadius)||[]){
    if(!rock.alive||rock.r<34)continue;
    const playerRange=distance(player,rock);
    if(playerRange<rock.r+(player.r||0)+22)continue;
    const outward=direction(player,rock);
    const spot={x:rock.x+outward.x*(rock.r+32),
      y:rock.y+outward.y*(rock.r+32)};
    const reach=distance(e,spot);
    if(reach>IRIS_SWARM.coverRadius+45)continue;
    const rocks=game.rockGrid.query((player.x+spot.x)*.5,
      (player.y+spot.y)*.5,distance(player,spot)*.5+80);
    if(firstRockImpact(player.x,player.y,spot.x,spot.y,rocks,2,player)?.rock!==rock)
      continue;
    const score=reach+Math.max(0,playerRange-235)*.24;
    if(score<bestScore){bestScore=score;best={...spot,rock};}
  }
  return best;
}

/** Call once per physics tick before scan/flight. Uses a rising hit signal,
 * so a single damage flash cannot reissue the same order every frame. */
export function updateIrisSwarm(e,game,player){
  if(!freeHunter(e,player)||
     e.signalIntel?.mode&&e.signalIntel.mode!=='engaged')return null;
  const now=game.time,d=distance(e,player);
  // The shell's EM sensors catch a REAL plasma emission in sight. A brief
  // pursuit burst then uses its aftermath, never a guessed future beam tick.
  const beamAt=game._irisLastPlasmaAt;
  if(Number.isFinite(beamAt)&&beamAt>(e._irisObservedBeamAt??-Infinity)&&
     now-beamAt>=0&&now-beamAt<.18){
    e._irisObservedBeamAt=beamAt;
    if(d<410&&irisCanSense(e,game,player,410))
      e._irisPulseSurgeUntil=now+.33;
  }
  const hit=(e.hit||0)>.025;
  if(!hit)e._irisHitResponded=false;
  if(hit&&!e._irisHitResponded){
    e._irisHitResponded=true;
    // A damaged scout broadcasts an actual observation, not the player's
    // weapon cooldown. Only close members of this encounter react.
    if(game.grid?.query)for(const wing of game.grid.query(e.x,e.y,IRIS_SWARM.wingRadius)){
      if(wing===e||!freeHunter(wing,player)||!Number.isFinite(e.group)||
         wing.group!==e.group||
         wing.signalIntel?.mode&&wing.signalIntel.mode!=='engaged'||
         distance(wing,e)>IRIS_SWARM.wingRadius)continue;
      wing._irisWingUntil=Math.max(wing._irisWingUntil||0,
        now+IRIS_SWARM.wingSeconds);
      wing._irisWingSide=(wing.serial+e.serial)%2===0?1:-1;
    }
    // At the edge of beam range, closing quickly is more interesting than
    // fleeing forever. A wounded scout withdraws only after real contact.
    if(d<=IRIS_SWARM.fireRange&&e._irisHasFired&&
       now>=(e._irisRetreatCooldown||0)){
      e._irisRetreatAt=now;
      e._irisRetreatUntil=now+IRIS_SWARM.retreatSeconds;
      e._irisRetreatCooldown=now+IRIS_SWARM.retreatCooldown+
        (Math.abs(e.serial||0)%3)*.28;
      e._irisCover=coverDestination(e,game,player);
    }else{
      e._irisWingUntil=now+.9;
      e._irisWingSide=e.serial%2===0?1:-1;
    }
  }
  if(now<(e._irisRetreatUntil||0)){
    if(e._irisCover?.rock?.alive)return {
      mode:'cover',x:e._irisCover.x,y:e._irisCover.y,speed:1.75
    };
    const away=direction(player,e),side=e.serial%2===0?1:-1;
    // A short, visible burn; no displacement, collision bypass or immunity.
    return {mode:'break',x:e.x+away.x*260-away.y*side*45,
      y:e.y+away.y*260+away.x*side*45,speed:1.67};
  }
  if(now<(e._irisWingUntil||0)&&d>100){
    const toward=direction(e,player),side=e._irisWingSide||1;
    return {mode:'wing',x:player.x-toward.x*112-toward.y*side*75,
      y:player.y-toward.y*112+toward.x*side*75,
      speed:now<(e._irisPulseSurgeUntil||0)?1.58:1.38};
  }
  return null;
}
