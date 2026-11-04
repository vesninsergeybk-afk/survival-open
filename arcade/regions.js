// Natural geography is independent from station ownership and military supply.
export const REGION_LIMIT=70000;
export const REGIONS=Object.freeze([
 {id:'amethyst',number:1,theme:0,name:'Аметистовая туманность',color:'#caa0ff',x:0,y:0,
  entry:{x:360,y:-85},cue:'Опорные станции и первые поручения. Следите за подкреплениями с севера.'},
 {id:'amber',number:2,theme:2,name:'Янтарные облака',color:'#ffbd79',x:35000,y:7000,
  entry:{x:26500,y:4000},cue:'Добывайте руду за крупными астероидами. Шум экстрактора привлекает патрули.'},
 {id:'azure',number:3,theme:1,name:'Лазурный разлом',color:'#8be9ff',x:6000,y:40000,
  entry:{x:4000,y:26500},cue:'Выходите из колец перед электрическим разрядом. Заряженные перехватчики стреляют чаще; ионный проводник снимает заряд.'},
 {id:'lilac',number:4,theme:3,name:'Сиреневый предел',color:'#eea2de',x:6000,y:-40000,
  entry:{x:4000,y:-26500},cue:'Военный узел получает руду с востока. Перехватите груз или захватите его источник.'},
 {id:'teal',number:5,theme:4,name:'Бирюзовая бездна',color:'#8be5cf',x:-40000,y:7000,
  entry:{x:-26500,y:4000},cue:'Обломки крейсера служат ориентиром. Разведывайте станции и берегите путь к доку.'}
].map(r=>Object.freeze({...r,entry:Object.freeze(r.entry)})));
export function centralBoundary(angle){return 24000+1200*Math.sin(angle*3)+800*Math.sin(angle*5+.6);}
export function regionAt(x,y){
 const r=Math.hypot(x,y);
 if(r<=centralBoundary(Math.atan2(y,x)))return REGIONS[0];
 if(r<=REGION_LIMIT){
  return Math.abs(x)>=Math.abs(y)?REGIONS[x>=0?1:4]:REGIONS[y>=0?2:3];
 }
 // Beyond the first charted area, retain an unbounded deterministic world.
 const sx=Math.floor(x/5600),sy=Math.floor(y/5600),theme=((sx*7+sy*11)%5+5)%5;
 return REGIONS.find(r=>r.theme===theme);
}
export function amberRegion(x,y){return Math.hypot(x,y)<=REGION_LIMIT&&regionAt(x,y).id==='amber';}
export const centralOutline=()=>Array.from({length:97},(_,i)=>{
 const angle=i*Math.PI*2/96,r=centralBoundary(angle);
 return {x:Math.cos(angle)*r,y:Math.sin(angle)*r};
});
