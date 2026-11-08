// Exactly one manually aimed weapon uses LMB. RMB never changes purpose.
export const manualWeapons=(profile,railUnlocked)=>[
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
 (weapon==='comet'?'comet':weapon==='rail'&&railEnabled?'rail':'designate'):
 weapon==='comet'?'comet':weapon==='rail'?'rail':weapon==='howitzer'?'howitzer':'designate';
// Optional precision marking must not consume either mouse weapon's shot.
export function pointerWeaponAction(event,weapon,mobileMineArmed=false){
 const mark=event.button===0&&event.pointerType==='mouse'&&event.ctrlKey&&
  !event.altKey&&!event.metaKey;
 if(mark)return {kind:null,mark:true};
 if(event.button===2||event.pointerType==='touch'&&mobileMineArmed)
  return {kind:'mines',mark:false};
 return {kind:weapon==='comet'?'comet':null,mark:false};
}
