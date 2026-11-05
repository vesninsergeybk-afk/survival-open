import {CENTRAL_INDUSTRY,centralExtractionAvailable} from './central-industry.js?v=home-conflict-1-enemy-balance-2';
import {SUPPLY} from './regional-supply.js?v=living-world-3-radio-shadow-1-home-conflict-1-campaign-1-repair-qa-1-enemy-economy-1-enemy-balance-2';
import {FRONTIERS,FRONTIER_REPAIR} from './frontier-industry.js?v=living-world-3-radio-shadow-1-expedition-1-repair-qa-1';

export const FRONT_KEYS=Object.freeze(['home','north','azure','teal']);
// Read existing production state. No second economy or duplicate ownership.
export function warFronts(world){
 const root=world?.regionalSupply;if(!root)return [];
 const specs=[
  {key:'home',name:'Домашняя промышленная сеть',regions:['amethyst'],
   sourceId:CENTRAL_INDUSTRY.sourceId,depotId:CENTRAL_INDUSTRY.depotId,
   pool:root.central,cost:CENTRAL_INDUSTRY.cargoCost,radio:4800},
  {key:'north',name:'Рудный пояс и военный узел',regions:['amber','lilac'],
   sourceId:SUPPLY.mineId,depotId:SUPPLY.militaryId,pool:root,cost:SUPPLY.cargoCost,radio:4800},
  ...['azure','teal'].map(key=>({key,name:key==='azure'?'Энергосеть разлома':'Ремонтная сеть обломков',
   regions:[key],sourceId:FRONTIERS[key].sourceId,depotId:FRONTIERS[key].depotId,
   pool:root.frontier?.[key],cost:FRONTIERS[key].cost,radio:2600}))
 ];
 return specs.map(f=>{
  const source=world.stations.get(f.sourceId),depot=world.stations.get(f.depotId),s=f.pool;
  const stock=f.key==='home'||f.key==='north'?s?.ore:s?.resource;
  const worker=s?.worker;
  const sourceAlive=!!source?.enemy;
  const raw=sourceAlive&&(stock||0)>=f.cost+(f.key==='home'&&s?.strategy?.screened?2:0);
  const extraction=sourceAlive&&(f.key==='home'?centralExtractionAvailable(s):
   f.key==='teal'?worker?.hp>0&&(worker.carry>0||s.wrecks.some(w=>w.stock>0)):
   true);
  const working=!!(raw||extraction);
  const repairBudget=['azure','teal'].includes(f.key)&&s&&sourceAlive&&depot?.enemy&&
   s.resource>=FRONTIER_REPAIR.cost&&
   (depot.hp<depot.maxHp*FRONTIER_REPAIR.threshold||depot.turrets.some(t=>t.hp>0&&t.hp<t.maxHp*.7));
  const payload=!!s&&(s.convoys.some(c=>c.hp>0)||s.reserves>0||!!s.pendingRaid||
   !!s.strategy?.emergency||s.repairExpedition?.hp>0||repairBudget);
  const outcome=!s||!source||!depot?null:!depot.enemy?'captured':!working&&!payload?'starved':null;
  return {...f,source,depot,working,payload,outcome,
   known:!!source?.discovered||!!depot?.discovered,
   reportAt:s?.history?.at(-1)?.time??0};
 });
}
export const warFront=(world,key)=>warFronts(world).find(f=>f.key===key)||null;
