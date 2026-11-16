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
    description:'Станция становится дружественным авианосным узлом с доступными ему услугами.'
  }),
  'population-hangar':Object.freeze({
    title:'Ангар патрулей',
    description:'Захваченный ангар становится местом найма и обслуживания ведомых.'
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
  return spec?'Новая возможность: '+spec.title+'. '+spec.description:'';
}
export function capturedFacilityEffect(world,position){
  const result={miningMultiplier:1,discoveryBonus:0};
  if(!world?.occupied||!world.stations||!position)return result;
  for(const b of world.stations.values()){
    if(!operating(b)||distance(b,position)>CAPTURED_FACILITY_RADIUS)continue;
    if(b.strategicRole==='population-extractor')result.miningMultiplier=1.2;
    if(b.strategicRole==='population-relay')result.discoveryBonus=220;
    if(result.miningMultiplier>1&&result.discoveryBonus>0)break;
  }
  return result;
}
