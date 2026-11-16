// Capabilities belong to actual captured, powered industrial stations.
// These bonuses are deliberately local: a remote outpost is valuable without
// a radio path to home, and capturing ten identical stations never stacks an
// unlimited global multiplier.
export const CAPTURED_FACILITY_RADIUS=3200;
export const CAPTURED_FACILITY_EFFECTS=Object.freeze({
  'population-extractor':Object.freeze({
    title:'Трофейная добыча',
    description:'Вблизи захваченного рудного терминала добыча астероидов ускоряется на 20%.'
  }),
  'population-relay':Object.freeze({
    title:'Трофейная разведка',
    description:'Вблизи захваченного ретранслятора радиус обнаружения станций увеличивается на 220 м.'
  }),
  'population-factory':Object.freeze({
    title:'Сборочная верфь',
    description:'Захваченная верфь открывает автономную ударную авиагруппу без обязательной связи с домашней сетью. Вылет требует ресурсов.'
  }),
  'population-hangar':Object.freeze({
    title:'Ангар патрулей',
    description:'Здесь можно нанимать и обслуживать ведомых, как и на других действующих дружественных станциях.'
  }),
  'population-support':Object.freeze({
    title:'Ремонтная платформа',
    description:'Захваченная платформа позволяет ремонтировать корабль и ведомых рядом со станцией.'
  })
});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const operating=b=>b?.captured&&b.active&&!b.enemy&&!b.ruined&&!b.suppressed&&b.hp>0;
export function capturedFacilityDescription(base){
  const spec=CAPTURED_FACILITY_EFFECTS[base?.strategicRole];
  if(!spec)return '';
  const source=base?.strategicRole==='population-extractor'&&
   /^colony:amethyst:[0-2]$/.test(base.colonyId||'');
  return 'Трофей: '+spec.title+'. '+spec.description+
   (source?' Захвачено 12 единиц энергетической мощности района.'+
    ' Вражеский завод лишится сетевого питания и перейдёт на конечный резерв.':'');
}
export function capturedFacilityEffect(world,position){
  const result={miningMultiplier:1,discoveryBonus:0};
  if(!world?.occupied||!world.stations||!position)return result;
  // Use the existing 2,500-unit population index; this runs during combat.
  // Never sweep the entire world (1,500+ stations) on every rendered frame.
  const grid=world.populationStationCells;
  const nearby=[];
  if(grid){
    const cell=2500,r=CAPTURED_FACILITY_RADIUS;
    for(let cy=Math.floor((position.y-r)/cell);cy<=Math.floor((position.y+r)/cell);cy++)
      for(let cx=Math.floor((position.x-r)/cell);cx<=Math.floor((position.x+r)/cell);cx++)
        for(const id of grid.get(cx+':'+cy)||[]){
          const station=world.stations.get(id);
          if(station)nearby.push(station);
        }
  }else nearby.push(...world.stations.values());
  for(const b of nearby){
    if(!operating(b)||distance(b,position)>CAPTURED_FACILITY_RADIUS)continue;
    if(b.strategicRole==='population-extractor')result.miningMultiplier=1.2;
    if(b.strategicRole==='population-relay')result.discoveryBonus=220;
    if(result.miningMultiplier>1&&result.discoveryBonus>0)break;
  }
  return result;
}
