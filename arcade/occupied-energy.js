// First, deliberately local energy-theatre experiment: the three inhabited
// opening districts. Existing 297 colonies and the classic arcade do not inherit
// energy limits until fleet and world-scale balance have been playtested.
export const OPENING_ENERGY=Object.freeze({
  sources:3,sourcePower:12,batterySeconds:80,rechargePerSecond:2,
  gridReserveCap:24,batteryReserveCap:18
});
export const isOpeningDistrict=(world,colony)=>!!world?.occupied&&
  colony?.region==='amethyst'&&Number.isInteger(colony.index)&&
  colony.index>=0&&colony.index<OPENING_ENERGY.sources;
const liveEnemy=station=>!!station?.enemy&&!station.captured&&!station.ruined&&
  !station.suppressed&&station.hp>0;
const livePlayer=station=>!!station?.captured&&station.active&&!station.enemy&&
  !station.ruined&&!station.suppressed&&station.hp>0;
const sourceId=colony=>colony.id+':extractor';
const factoryId=colony=>colony.id+':factory';

// The same physical links define power routes; a connection crossing an enemy
// or ruined node cannot magically transfer electricity to a friendly factory.
export function openingPowerRoute(world,colony,owner='enemy'){
 if(!isOpeningDistrict(world,colony))return false;
 const valid=owner==='player'?livePlayer:liveEnemy;
 const source=sourceId(colony),destination=factoryId(colony);
 if(!valid(world.stations.get(source))||!valid(world.stations.get(destination)))
  return false;
 const graph=new Map();
 for(const [a,b] of world.enemyExpansion?.links||[]){
  if(!a.startsWith(colony.id+':')||!b.startsWith(colony.id+':'))continue;
  if(!valid(world.stations.get(a))||!valid(world.stations.get(b)))continue;
  if(!graph.has(a))graph.set(a,[]);
  if(!graph.has(b))graph.set(b,[]);
  graph.get(a).push(b);graph.get(b).push(a);
 }
 const found=new Set([source]),queue=[source];
 while(queue.length){
  const node=queue.shift();
  if(node===destination)return true;
  for(const next of graph.get(node)||[])if(!found.has(next)){
   found.add(next);queue.push(next);
  }
 }
 return false;
}

// Reserve power supports existing industry briefly after sabotage. It is a
// saved local stock, not energy conjured each time the map is opened.
export function openingFactoryStatus(world,colony){
 if(!isOpeningDistrict(world,colony))
  return {enabled:true,grid:true,reserve:0,shipCap:36};
 const grid=openingPowerRoute(world,colony);
 const reserve=Number.isInteger(colony.powerReserve)?
  Math.max(0,Math.min(OPENING_ENERGY.batterySeconds,colony.powerReserve)):
  OPENING_ENERGY.batterySeconds;
 return {enabled:grid||reserve>0,grid,reserve,
  shipCap:grid?OPENING_ENERGY.gridReserveCap:
   reserve>0?OPENING_ENERGY.batteryReserveCap:0};
}

// Pure snapshot: no mutation, no hidden information leaked through a map of
// the world. The HUD identifies only the finite experimental opening theatre.
export function openingSectorEnergy(world){
 if(!world?.occupied||!world.population?.colonies)return null;
 const opening=world.population.colonies.filter(c=>isOpeningDistrict(world,c));
 const total=opening.length*OPENING_ENERGY.sourcePower;
 let player=0,enemy=0;
 const districts=[];
 for(const c of opening){
  const source=world.stations.get(sourceId(c));
  const owner=liveEnemy(source)?'enemy':livePlayer(source)?'player':'neutral';
  const amount=OPENING_ENERGY.sourcePower;
  if(owner==='enemy')enemy+=amount;
  if(owner==='player')player+=amount;
  districts.push({id:c.id,owner,power:amount,
   grid:openingPowerRoute(world,c),reserve:openingFactoryStatus(world,c).reserve});
 }
 return {total,enemy,player,neutral:total-player-enemy,
  enemyPercent:total?Math.round(enemy/total*100):0,
  playerPercent:total?Math.round(player/total*100):0,districts};
}

// Each generator physically connected to the pilot's existing station network
// adds one command/charging slot. An isolated captured generator still counts
// as owned energy, but cannot support remote escorts.
export function connectedPlayerEnergySlots(world,linked){
 if(!world?.occupied||!linked?.has)return 0;
 let count=0;
 for(const c of world.population?.colonies||[]){
  if(!isOpeningDistrict(world,c))continue;
  const id=sourceId(c),station=world.stations.get(id);
  if(livePlayer(station)&&linked.has(id))count++;
 }
 return count;
}

// Only the optional occupied campaign enforces this dynamically. No bought
// escort is deleted when the grid is severed: excess units follow the pilot
// in standby, without weapons or healing, and resume on reconnection.
export function synchronizeEscortPower(allies,capacity,time=0){
 if(!Array.isArray(allies))return 0;
 const allowed=Math.max(0,Math.min(allies.length,
  Number.isFinite(capacity)?Math.floor(capacity):allies.length));
 let standby=0;
 for(let i=0;i<allies.length;i++){
  const a=allies[i],inactive=i>=allowed;
  if(!a)continue;
  if(!!a.powerStandby!==inactive){
   a.message=inactive?'Недостаточно энергии':'Питание восстановлено';
   a.messageUntil=time+3;
   a.state='follow';a.target=null;a.commitUntil=0;
  }
  a.powerStandby=inactive;
  if(inactive)standby++;
 }
 return standby;
}
