// Lightweight, testable encounter plans. The world owns the spawning positions;
// the enemy AI owns moment-to-moment movement after entering the camera.
const clamp01=value=>Math.max(0,Math.min(.999999,Number.isFinite(value)?value:0));
export function availableEncounters(time,director,count,room=count){
  if(time<9||count<=0||!director.types?.length)return [];
  const options=['patrol'];
  if(time>=36&&count>=2)options.push('sweep');
  if(time>=95&&count>=2&&room>=8&&director.types.includes('scout')&&
    director.allowMotes!==false)options.push('motes');
  if(time>=118&&count>=3)options.push('pincer');
  if(time>=118&&count>=2&&director.types.includes('berserker'))options.push('ram');
  if(time>=155&&count>=3&&director.types.includes('healer'))options.push('medic');
  if(time>=205&&count>=2&&director.types.includes('gunship'))options.push('heavy');
  return options;
}
export function planEncounter(time,director,room,side,middle,roll=0,previous=''){
  const count=Math.max(0,Math.min(
    Math.floor(director.groupSize||0),Math.floor(room||0)));
  const options=availableEncounters(time,director,count,room);
  if(!options.length)return {pattern:'none',members:[],pause:0,label:''};
  let index=Math.floor(clamp01(roll)*options.length);
  let pattern=options[index];
  // Consecutive encounters should not look identical when alternatives exist.
  if(pattern===previous&&options.length>1)pattern=options[(index+1)%options.length];
  // Early eye swarms should feel like a formation rather than a screen-filling
  // cloud. Larger late-game packs keep their existing tactical role.
  const actualCount=pattern==='motes'?
    Math.min(time<205?9:time>=205&&room>=16?16:10,Math.floor(room)):count;
  const combat=director.types.filter(t=>t==='scout'||t==='fighter'||t==='flanker');
  const weak=combat.includes('scout')?'scout':combat[0];
  const fighter=combat.includes('fighter')?'fighter':weak;
  const fast=combat.includes('flanker')?'flanker':fighter;
  const members=[];
  const primarySide=((Math.floor(side)%4)+4)%4;
  const entryMiddle=Math.max(.2,Math.min(.8,middle));
  for(let i=0;i<actualCount;i++){
    let type=weak,entrySide=primarySide;
    let offset=(i-(actualCount-1)/2)*.085,protectIndex=-1;
    if(pattern==='motes'){
      type='scout';offset=(i-(actualCount-1)/2)*.020;
    }else if(pattern==='patrol'){
      type=i===0&&time>=36?fighter:weak;
    }else if(pattern==='sweep'){
      type=i===0&&time>=75?fast:i%2===0?weak:fighter;
      offset=(i-(count-1)/2)*.19;
    }else if(pattern==='pincer'){
      const firstHalf=Math.ceil(count/2);
      entrySide=i<firstHalf?primarySide:(primarySide^1);
      offset=(i<firstHalf?i-(firstHalf-1)/2:i-firstHalf-(count-firstHalf-1)/2)*.09;
      type=i>=firstHalf?fast:weak;
    }else if(pattern==='ram'){
      type=i===0?'berserker':weak;
      offset=(i-(count-1)/2)*.105;
    }else if(pattern==='medic'){
      type=i===0?'healer':fighter;
      if(i>0)protectIndex=0;
      offset=(i-(count-1)/2)*.11;
    }else if(pattern==='heavy'){
      type=i===0?'gunship':i===1?fighter:weak;
      offset=(i-(count-1)/2)*.12;
    }
    members.push({type,side:entrySide,
      position:Math.max(.08,Math.min(.92,entryMiddle+offset)),
      protectIndex});
  }
  const labels={motes:'РОЙ МИКРОДРОНОВ · используйте комету или мины',pincer:'Фланговая атака',medic:'Группа ремонта',
    ram:'Таранная группа',heavy:'Тяжёлый корабль'};
  const pauses={motes:3,pincer:1.1,medic:1.5,ram:.8,heavy:2.4};
  return {pattern,members,label:labels[pattern]||'',pause:pauses[pattern]||0};
}
