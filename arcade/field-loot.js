// Physical rewards from personally defeated eye drones. A pity counter gives
// packs a purpose, while a one-charge cache prevents permanent buff farming.
export const EYE_LOOT=Object.freeze({firstAt:45,boostCooldown:16,repairCooldown:12,
 reserveSeconds:105,activeSeconds:24,maxMisses:15});
export const BOOSTS=Object.freeze({
 surge:{label:'Форсаж вооружения',color:'#ffcd75'},
 arc:{label:'Цепной разряд',color:'#86dfff'},
 aegis:{label:'Фазовая броня',color:'#97f9ca'}
});
export const createFieldLoot=()=>({version:1,kills:0,misses:0,lastBoostAt:-1000,
 lastRepairAt:-1000,lastArcAt:-1000,reserve:null,active:null});
const close=(a,b,r)=>Math.hypot(a.x-b.x,a.y-b.y)<r;
export function rewardEyeKill(game,eye,personal,random=Math.random){
 const state=game.fieldLoot;
 if(!state||!personal||eye.type!=='scout'||eye.converted||game.time<EYE_LOOT.firstAt||
  eye.trialId!==undefined)return null;
 state.kills++;
 // The free-repair dock must not become an invulnerable trophy farm.
 if(game.nearDock&&close(game.nearDock,game.player,180))return null;
 if(game.player.hp<game.player.maxHp*.72&&game.time-state.lastRepairAt>EYE_LOOT.repairCooldown&&
  random()<.14){
  if(game.addDrop('fieldRepair',eye.x,eye.y,1,{life:48})!==false){
   state.lastRepairAt=game.time;return 'repair';
  }
 }
 if(state.active||state.reserve||game.time-state.lastBoostAt<EYE_LOOT.boostCooldown)return null;
 state.misses=Math.min(EYE_LOOT.maxMisses,state.misses+1);
 if(state.misses<EYE_LOOT.maxMisses&&random()>=.07+state.misses*.035)return null;
 const ids=Object.keys(BOOSTS),id=ids[Math.floor(random()*ids.length)]||'surge';
 if(game.addDrop('fieldBoost',eye.x,eye.y,id,{life:55})===false)return null;
 state.misses=0;state.lastBoostAt=game.time;
 return id;
}
export function collectFieldLoot(game,item){
 const state=game.fieldLoot,p=game.player;
 if(item.type==='fieldRepair'){
  const before=p.hp;
  p.hp=Math.min(p.maxHp,p.hp+Math.max(12,p.maxHp*.18));
  if(p.hp===before)p.shield=Math.min(p.maxHp*.55,p.shield+12);
  game.heritage?.play?.('pickup',.24);
  game.heritage?.vfx?.nova?.(p.x,p.y,50,'green');
  game.notice?.('Ремонтная капсула: корпус восстановлен',2.8);
  return true;
 }
 if(item.type!=='fieldBoost'||!Object.hasOwn(BOOSTS,item.value))return false;
 if(state.active||state.reserve){
  p.shield=Math.min(p.maxHp*.55,p.shield+10);
  game.notice?.('Запас усиления занят: +10 к щиту',2.6);
 }else{
  state.reserve={id:item.value,until:game.time+EYE_LOOT.reserveSeconds};
  game.notice?.('Получено: '+BOOSTS[item.value].label+'. Включится при встрече с сильным врагом.',4);
 }
 game.heritage?.play?.('pickup',.24);
 game.heritage?.vfx?.nova?.(p.x,p.y,55,'cyan');
 return true;
}
export function updateFieldLoot(game){
 const s=game.fieldLoot;if(!s)return;
 if(s.active&&s.active.until<=game.time)s.active=null;
 if(!s.reserve)return;
 if(game.time<(game._nextFieldLootCheckAt||0))return;
 game._nextFieldLootCheckAt=game.time+.38;
 const threat=game.enemies.some(e=>e.hp>0&&!e.converted&&
  e.type!=='scout'&&!e.regionalCargo&&close(e,game.player,680));
 const stronghold=game.world.nearbyStations(game.player.x,game.player.y,660)
  .some(b=>b.enemy&&!b.captured&&b.turrets.some(t=>t.hp>0));
 if(!threat&&!stronghold&&s.reserve.until>game.time)return;
 if(!threat&&!stronghold){
  game.player.shield=Math.min(game.player.maxHp*.55,game.player.shield+12);
  game.notice?.('Заряд рассеялся: энергия перешла в щит',3);
  s.reserve=null;return;
 }
 const id=s.reserve.id;s.reserve=null;
 s.active={id,until:game.time+EYE_LOOT.activeSeconds};
 if(id==='aegis')game.player.shield=Math.min(game.player.maxHp*.55,game.player.shield+15);
 game.notice?.(BOOSTS[id].label+' · '+EYE_LOOT.activeSeconds+' с',3);
 game.heritage?.vfx?.nova?.(game.player.x,game.player.y,110,'cyan');
}
export function fieldLootDamage(game,damage,source){
 return game.fieldLoot?.active?.id==='surge'&&
  ['beam','rocket','ion','rail','flak','howitzer'].includes(source)?damage*1.28:damage;
}
export function fieldLootArmor(game,damage){
 return game.fieldLoot?.active?.id==='aegis'?damage*.74:damage;
}
export function chainFieldLoot(game,primary,damage,source){
 const state=game.fieldLoot;
 if(state?.active?.id!=='arc'||!['beam','rocket','ion','rail','flak','howitzer'].includes(source)||
  state.chainBusy||game.time-state.lastArcAt<.55||damage<=0)return false;
 const nearby=game.enemies.find(e=>e!==primary&&e.hp>0&&!e.converted&&
  !e.regionalCargo&&close(e,primary,175));
 if(!nearby)return false;
 state.lastArcAt=game.time;state.chainBusy=true;
 try{
  game.flash(primary.x,primary.y,nearby.x,nearby.y,'#8ceeff');
  game.damageEnemy(nearby,Math.min(22,damage*.38),'ion');
 }finally{state.chainBusy=false;}
 return true;
}
export function validFieldLoot(s,time){
 if(s===undefined)return true;
 if(!s||s.version!==1||!Number.isInteger(s.kills)||s.kills<0||s.kills>1e8||
  !Number.isInteger(s.misses)||s.misses<0||s.misses>EYE_LOOT.maxMisses||
  !['lastBoostAt','lastRepairAt','lastArcAt'].every(k=>Number.isFinite(s[k])&&s[k]>=-1000&&s[k]<=time))return false;
 const charge=(c,limit)=>c===null||!!c&&Object.hasOwn(BOOSTS,c.id)&&
  Number.isFinite(c.until)&&c.until>=0&&c.until<=time+limit;
 return charge(s.reserve,EYE_LOOT.reserveSeconds)&&charge(s.active,EYE_LOOT.activeSeconds);
}
export function drawFieldLootAura(ctx,game){
 const s=game.fieldLoot;if(!s?.active&&!s?.reserve)return;
 const p=game.player,a=s.active||s.reserve,spec=BOOSTS[a.id];
 if(!spec)return;
 const active=!!s.active,remaining=Math.max(0,Math.ceil(a.until-game.time));
 ctx.save();ctx.strokeStyle=spec.color;ctx.fillStyle=spec.color;
 ctx.globalAlpha=active?.72:.38;ctx.lineWidth=active?3:1.6;
 if(!active)ctx.setLineDash([5,7]);
 ctx.beginPath();ctx.arc(p.x,p.y,active?46:42,0,Math.PI*2);ctx.stroke();
 ctx.setLineDash([]);ctx.globalAlpha=1;
 ctx.font='bold 10px system-ui';ctx.textAlign='center';
 ctx.fillText((active?'АКТИВНО · ':'ЗАПАС · ')+remaining+' с',p.x,p.y+66,140);
 ctx.restore();
}
