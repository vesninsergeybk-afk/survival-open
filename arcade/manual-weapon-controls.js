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
 (weapon==='rail'&&railEnabled?'rail':'designate'):
 weapon==='rail'?'rail':weapon==='howitzer'?'howitzer':'designate';
