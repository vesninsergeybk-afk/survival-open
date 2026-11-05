/** Deterministic exploratory simulation, independent from game economy. */
export const STATIONS = Object.freeze([
  Object.freeze({id:'A', label:'Станция «Север»', x:.20, y:.30}),
  Object.freeze({id:'B', label:'Станция «Маяк»', x:.78, y:.23}),
  Object.freeze({id:'C', label:'Станция «Оплот»', x:.69, y:.81}),
]);
export const SOURCE = Object.freeze({x:.53, y:.49});
export const DEFAULTS = Object.freeze({count:3, speed:.115, capacity:38, rate:13, regeneration:40});

const transition = (unit, phase) => { unit.phase = phase; unit.phaseElapsed = 0; };
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

function move(unit, destination, speed, dt) {
  const dx=destination.x-unit.x, dy=destination.y-unit.y;
  const dist=Math.hypot(dx,dy);
  if(dist<1e-6) return true;
  const step=Math.min(dist,speed*dt);
  unit.x+=dx/dist*step; unit.y+=dy/dist*step;
  unit.angle=Math.atan2(dy,dx);
  return step>=dist-1e-6;
}

export function createWorld(count=DEFAULTS.count) {
  const n=Math.max(1,Math.min(24,Math.floor(Number(count)||1)));
  return {
    elapsed:0, reserve:560, reserveMax:750, delivered:0, harvested:0,
    trips:0, threatRemaining:0, threatened:false, notices:[],
    units:Array.from({length:n},(_,i)=>{
      const station=STATIONS[i%STATIONS.length];
      return {id:i+1, stationId:station.id, x:station.x, y:station.y,
        angle:Math.atan2(SOURCE.y-station.y,SOURCE.x-station.x),
        phase:'shelter', phaseElapsed:0, releaseDelay:i*.58, cargo:0,
        trips:0, energyTaken:0};
    })
  };
}

export function triggerThreat(world, seconds=8) {
  world.threatRemaining=Math.max(0,Number(seconds)||0);
  world.notices.unshift('Тревога: добытчики прекращают сбор и возвращаются к станциям.');
  world.notices=world.notices.slice(0,4);
}

export function updateWorld(world, dt, settings={}) {
  const config={...DEFAULTS,...settings};
  dt=Math.max(0,Math.min(.10,Number(dt)||0));
  if(!dt) return world;
  world.elapsed+=dt;
  world.reserve=Math.min(world.reserveMax,world.reserve+Math.max(0,config.regeneration)*dt);
  world.threatRemaining=Math.max(0,world.threatRemaining-dt);
  const threatened=world.threatRemaining>0;

  for(const unit of world.units) {
    unit.phaseElapsed+=dt;
    const station=STATIONS.find(s=>s.id===unit.stationId);
    if(threatened && ['to_source','deploy','harvest'].includes(unit.phase)) transition(unit,'evade');
    switch(unit.phase) {
      case 'shelter':
        if(!threatened && unit.phaseElapsed>=unit.releaseDelay) {
          unit.releaseDelay=0; transition(unit,'to_source');
        }
        break;
      case 'to_source':
        if(move(unit,SOURCE,config.speed,dt)) transition(unit,'deploy');
        break;
      case 'deploy':
        unit.angle=Math.atan2(SOURCE.y-unit.y,SOURCE.x-unit.x);
        if(unit.phaseElapsed>=.60) transition(unit,'harvest');
        break;
      case 'harvest': {
        const possible=Math.max(0,Math.min(config.rate*dt,config.capacity-unit.cargo,world.reserve));
        unit.cargo+=possible; unit.energyTaken+=possible;
        world.harvested+=possible; world.reserve-=possible;
        if(unit.cargo>=config.capacity-.001) transition(unit,'return');
        break;
      }
      case 'return':
      case 'evade':
        if(move(unit,station,config.speed*(unit.phase==='evade'?1.65:1),dt))
          transition(unit,unit.cargo>.001?'unload':'shelter');
        break;
      case 'unload':
        if(unit.phaseElapsed>=.8) {
          world.delivered+=unit.cargo; unit.cargo=0;
          world.trips++; unit.trips++;
          transition(unit,'shelter');
          unit.releaseDelay=.3;
        }
        break;
      default: throw new Error('Unknown harvester phase: '+unit.phase);
    }
  }
  world.threatened=threatened;
  return world;
}

export function phaseLabel(phase) {
  return ({shelter:'Ожидает',to_source:'К источнику',deploy:'Прикрепляется',
    harvest:'Добывает',return:'Возвращается',unload:'Разгружается',
    evade:'Отступает'})[phase]||phase;
}

export function isInsideTriangle(point, a=STATIONS[0], b=STATIONS[1], c=STATIONS[2]) {
  const signed=(p,q,r)=>(p.x-r.x)*(q.y-r.y)-(q.x-r.x)*(p.y-r.y);
  const d1=signed(point,a,b),d2=signed(point,b,c),d3=signed(point,c,a);
  return !((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0));
}
