// Desktop: wheel selects the mount, RMB holds a preview and releases to fire.
// LMB remains a non-consuming designation action for the automatic batteries.
export const manualWeapons=(profile,railUnlocked)=>[
 'comet','mines',
 ...(profile?.rail&&railUnlocked?['rail']:[]),
 ...(profile?.howitzer?['howitzer']:[])
];
export const selectedManual=(current,available)=>available.includes(current)?current:available[0]||null;
export function cycleManual(current,available,step=1){
 if(!available.length)return null;
 const index=Math.max(0,available.indexOf(current));
 return available[(index+(step<0?-1:1)+available.length)%available.length];
}
export const manualClick=(weapon,railEnabled,touch=false)=>touch?
 (weapon==='comet'?'comet':weapon==='mines'?'mines':weapon==='rail'&&railEnabled?'rail':'designate'):
 ['comet','mines','rail','howitzer'].includes(weapon)?weapon:'designate';
// Optional precision marking must not consume either mouse weapon's shot.
export function pointerWeaponAction(event,weapon,mobileMineArmed=false){
 const mark=event.button===0&&event.pointerType==='mouse'&&event.ctrlKey&&
  !event.altKey&&!event.metaKey;
 if(mark)return {kind:null,mark:true};
 if(event.pointerType==='touch')return {kind:mobileMineArmed?'mines':
   weapon==='comet'?'comet':null,mark:false};
 if(event.button===2)return {kind:['comet','mines','rail','howitzer'].includes(weapon)?weapon:'comet',mark:false};
 return {kind:null,mark:false};
}
