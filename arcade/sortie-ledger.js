// Complete-flight accounting. Keep this module independent of the game/DOM so
// saved records and rewards can be tested without rendering a combat scene.
export const DETAIL_KEYS=Object.freeze([
 'oreMining','oreSalvage','oreOperations','oreContracts',
 'dataCombat','dataOperations','dataContracts','dataOther',
 'damageTaken','shieldDamage','hullRepaired','dronesLost'
]);
export const emptySortieDetails=()=>Object.fromEntries(DETAIL_KEYS.map(key=>[key,0]));
export const EXPENSE_KEYS=Object.freeze(['weapons','drones','repairs','stations','services','travel']);
export const emptyEconomyExpenses=()=>Object.fromEntries(EXPENSE_KEYS.map(key=>[key,0]));
export function recordEconomyExpense(game,category,amount){
 if(game?.economyExpenses&&EXPENSE_KEYS.includes(category)&&
  Number.isFinite(amount)&&amount>0)game.economyExpenses[category]+=amount;
}
export function validEconomyExpenses(value){
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).length===EXPENSE_KEYS.length&&
  EXPENSE_KEYS.every(k=>Object.hasOwn(value,k)&&Number.isInteger(value[k])&&
   value[k]>=0&&value[k]<=1e9);
}
const incomeKeys={ore:{mining:'oreMining',salvage:'oreSalvage',operation:'oreOperations'},
 data:{combat:'dataCombat',operation:'dataOperations',other:'dataOther'}};

export function recordSortieIncome(game,resource,source,value){
 const key=incomeKeys[resource]?.[source];
 if(key&&game?.sortieStart?.details&&Number.isFinite(value)&&value>0)
  game.sortieStart.details[key]+=value;
}
export function recordSortieDamage(game,hull,shield=0){
 const d=game?.sortieStart?.details;if(!d)return;
 d.damageTaken+=Math.max(0,hull);d.shieldDamage+=Math.max(0,shield);
}
export function recordSortieRepair(game,amount){
 if(game?.sortieStart?.details)game.sortieStart.details.hullRepaired+=Math.max(0,amount);
}
export function recordSortieDroneLoss(game,count=1){
 if(game?.sortieStart?.details)game.sortieStart.details.dronesLost+=Math.max(0,count);
}
// A contract is paid after docking; credit the flight during which it was
// completed, not the player's next flight or a newly opened station menu.
export function creditContractReward(reports,contract,base){
 if(!Array.isArray(reports)||!contract||!base)return reports;
 const index=Number.isInteger(contract.completedSortieId)?
  reports.findLastIndex(r=>r.id===contract.completedSortieId&&r.outcome==='returned'):
  reports.findLastIndex(r=>r.baseId===base.id&&r.outcome!=='lost');
 if(index<0)return reports;
 return reports.map((r,i)=>i===index?{
  ...r,ore:r.ore+contract.ore,data:r.data+contract.data,
  ...(r.details?{details:{...r.details,oreContracts:r.details.oreContracts+contract.ore,
   dataContracts:r.details.dataContracts+contract.data}}:{})}:r);
}
export const detailsForSave=details=>Object.fromEntries(DETAIL_KEYS.map(k=>
 [k,Math.max(0,Math.round(details?.[k]||0))]));
export function validDetails(details){
 return !!details&&typeof details==='object'&&!Array.isArray(details)&&
  Object.keys(details).length===DETAIL_KEYS.length&&
  DETAIL_KEYS.every(k=>Object.hasOwn(details,k)&&Number.isInteger(details[k])&&
   details[k]>=0&&details[k]<=1e9);
}
