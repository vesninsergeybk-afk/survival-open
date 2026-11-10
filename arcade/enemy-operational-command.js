/**
 * Operational priorities for the enemy's existing industrial networks.
 *
 * Headquarters sees its own stock, actual shipments and station damage. It
 * never reads the player position, guesses the attacker, spawns a ship or
 * moves a unit directly. Nearby radio cells may act on these priorities via
 * the ordinary theater auction and its real, acknowledged radio orders.
 */
const ratio=asset=>Number.isFinite(asset?.hp)&&
  Number.isFinite(asset?.maxHp)&&asset.maxHp>0?
    Math.max(0,Math.min(1,asset.hp/asset.maxHp)):1;

export function operationalFront(asset){
 if(asset?.centralCargo)return 'home';
 if(asset?.frontierCargo||asset?.frontierRepair)
   return ['azure','teal'].includes(asset.frontierNetwork)?asset.frontierNetwork:null;
 if(asset?.regionalCargo)return 'north';
 const role=asset?.strategicRole;
 if(role==='mine'||role==='military')return 'north';
 if(role==='central-source'||role==='central-depot')return 'home';
 const match=/^frontier-(azure|teal)-(source|depot)$/.exec(role||'');
 return match?.[1]||null;
}

export function operationalAssetRole(asset){
 if(!asset?.strategicRole)return 'cargo';
 const role=asset.strategicRole;
 if(role==='mine'||role.endsWith('-source'))return 'source';
 if(role==='military'||role.endsWith('-depot'))return 'depot';
 return null;
}

const budget=(s,front)=>front==='home'?s?.central:
 front==='north'?s:s?.frontier?.[front];
const stock=s=>Number.isFinite(s?.ore)?s.ore:s?.resource;
const cost=front=>({home:8,north:12,azure:6,teal:8})[front];
const canProduce=(s,front)=>{
 if(front==='home')return !!s?.worker&&s.worker.hp>0&&
   !['disabled','evacuated'].includes(s.worker.phase)&&
   (s.worker.rockDepleted!==true||s.worker.carry>0);
 if(front==='teal')return s?.worker?.hp>0&&
   (s.worker.carry>0||s.wrecks?.some(w=>w.stock>0));
 return true;
};

/** One strategic objective per surviving front, chosen from actual assets.
 * The output is just a scoring preference: execution still needs local ships,
 * proximity, working radio and an unexpired order. */
export function operationalPriorities(assets,world){
 const grouped=new Map(),result=new Map();
 for(const item of assets||[]){
  const front=operationalFront(item.asset),role=operationalAssetRole(item.asset);
  if(!front||!role)continue;
  if(!grouped.has(front))grouped.set(front,{cargo:[],source:[],depot:[]});
  grouped.get(front)[role].push(item);
 }
 for(const [front,group] of grouped){
  const source=group.source[0],depot=group.depot[0];
  const worstCargo=[...group.cargo].sort((a,b)=>ratio(a.asset)-ratio(b.asset))[0];
  const s=budget(world?.regionalSupply,front);
  let focus=null,code=null,title=null,reason=null,bonus=0;
  if(depot&&ratio(depot.asset)<.67){
   focus=depot;code='hold';title='ЗАЩИТА УЗЛА';
   reason='Сборочный узел повреждён. Перебросить свободные звенья к обороне!';
   bonus=85;
  }else if(worstCargo&&ratio(worstCargo.asset)<.62){
   focus=worstCargo;code='rescue';title='СПАСТИ ГРУЗ';
   reason=worstCargo.asset.frontierRepair?
    'Ремонтный корабль повреждён. Подтянуть охранение к нему!':
    'Груз под огнём. Перебросить свободные звенья в сопровождение!';
   bonus=72;
  }else if(source&&ratio(source.asset)<.67){
   focus=source;code='source';title='ЗАЩИТА ДОБЫЧИ';
   reason='Добывающий узел повреждён. Удерживать источник снабжения!';
   bonus=66;
  }else if(source&&depot&&s&&canProduce(s,front)&&group.cargo.length===0&&
   Number.isFinite(stock(s))&&
   stock(s)<cost(front)*.6&&
   (s.reserves||0)===0){
   focus=source;code='supply';title='СОХРАНИТЬ ДОБЫЧУ';
   reason='На складах мало сырья. Прикрыть добывающий узел!';
   bonus=33;
  }
  if(focus)result.set(front,{front,assetId:focus.id,code,title,reason,bonus});
 }
 return result;
}
