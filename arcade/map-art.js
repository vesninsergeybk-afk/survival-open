import {hash} from './balance.js?v=arcade-network-20';
import {REGIONS} from './regions.js?v=regions-1';

const n=value=>Number(value).toFixed(1);
const at=(p,center,scale)=>({x:340+(p.x-center.x)*scale,y:240+(p.y-center.y)*scale});
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// All decorative geography is attached to world coordinates. It never reads
// ownership, generates stations, or places an apparent travel connection.
export function chartBackdrop(seed=0,center,scale,{overview=false}={}){
 const clouds=REGIONS.map((region,index)=>{
  const origin=at(region.survey,center,scale),radius=(overview?23000:13000)*scale;
  if(origin.x+radius<0||origin.x-radius>680||origin.y+radius<0||origin.y-radius>480)return '';
  const lobes=Array.from({length:9},(_,i)=>{
   const angle=hash(index,i,seed+701)*Math.PI*2;
   const spread=radius*(.1+.52*hash(i,index,seed+709));
   const x=origin.x+Math.cos(angle)*spread,y=origin.y+Math.sin(angle)*spread*.6;
   const r=radius*(.28+.32*hash(index,i,seed+719));
   return `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(r)}" ry="${n(r*.48)}" transform="rotate(${n(index*37-32)} ${n(x)} ${n(y)})" fill="url(#chart-cloud-${region.id})"/>`;
  }).join('');
  const filaments=Array.from({length:overview?3:0},(_,i)=>{
   const shift=(i-1)*.14;
   return `<path d="M-1.1 ${n(.3+shift)}C-.6 ${n(-.5+shift)} -.1 ${n(.7+shift)} .4 ${n(-.2+shift)}S.8 -.2 1.15 -.5" fill="none" stroke="${region.color}" stroke-width="${.055-i*.015}" stroke-opacity="${.03+i*.01}"/>`;
  }).join('');
  return `<g class="chart-nebula-cloud" data-cloud="${region.id}">${lobes}<g transform="translate(${n(origin.x)} ${n(origin.y)}) rotate(${index*37-32}) scale(${n(radius)})">${filaments}</g></g>`;
 }).join('');
 return `<g class="chart-surface" aria-hidden="true" pointer-events="none">
  <defs>
   <radialGradient id="chart-depth" cx="48%" cy="40%" r="75%"><stop stop-color="#102630"/><stop offset=".55" stop-color="#0a1621"/><stop offset="1" stop-color="#040a12"/></radialGradient>
   ${REGIONS.map(r=>`<radialGradient id="chart-cloud-${r.id}"><stop stop-color="${r.color}" stop-opacity=".13"/><stop offset=".38" stop-color="${r.color}" stop-opacity=".055"/><stop offset="1" stop-color="${r.color}" stop-opacity="0"/></radialGradient>`).join('')}
  </defs><rect width="680" height="480" fill="url(#chart-depth)"/>${clouds}
 </g>`;
}

// Screen-space engraving. Coordinate values describe the current camera,
// while the scale bar uses the same transform as every interactive marker.
export function chartFrame(center,scale,{overview=false,local=false}={}){
 const ticks=[];
 for(let x=20;x<=660;x+=20)ticks.push(`M${x} 0v${x%100===0?9:4}M${x} 480v-${x%100===0?9:4}`);
 for(let y=20;y<=460;y+=20)ticks.push(`M0 ${y}h${y%100===0?9:4}M680 ${y}h-${y%100===0?9:4}`);
 const steps=overview?[10000,20000,40000]:[500,1000,2000];
 const step=steps.find(value=>value*scale>=45)||steps.at(-1),width=step*scale;
 return `<g class="chart-instruments" aria-hidden="true" pointer-events="none">
  <path class="chart-edge-ticks" d="${ticks.join('')}"/>
  <path class="chart-corners" d="M12 33V12H33M647 12h21v21M668 447v21h-21M33 468H12v-21"/>
  <text class="chart-coordinate" x="25" y="28">X ${Math.round(center.x).toLocaleString('ru-RU')} · Y ${Math.round(center.y).toLocaleString('ru-RU')} м</text>
  <g class="chart-north" transform="translate(647 36)"><path d="M0 -12V12M-4 -5l4 -7 4 7"/><text y="25" text-anchor="middle">С</text></g>
  ${local?`<g class="chart-distance"><path d="M25 445v6h${n(width)}v-6M25 448h${n(width)}"/><text x="25" y="437">${step>=1000?step/1000+' км':step+' м'}</text></g>`:''}
 </g>`;
}

// The silhouette gives station function; color and the outer frame give its
// state. Unknown sites intentionally share one symbol, regardless of type.
export function stationGlyph(type,{known=true,color='#a6bacb',hostile=false,active=false}={}){
 if(!known)return '<g class="chart-station-unknown"><circle r="5.5"/><path d="M-9 0h2M7 0h2M0 -9v2M0 7v2"/></g>';
 const shapes={
  dock:'M-5 -5h10v10H-5ZM-8 -2h3M5 -2h3M-8 2h3M5 2h3',
  lab:'M-3 -6h6M-1 -6v5L-5 5q5 3 10 0L1 -1v-5M-3 2h6',
  arsenal:'M-5 6V-3h3V-6h4v3h3v9M-2 1h4M-2 4h4',
  carrier:'M0 -7l6 10-6 4-6-4ZM-3 1h6M0 -3v7',
  factory:'M-6 6V-2l4 2v-3l4 3v-6h3V6ZM-3 3h1M1 3h1',
  mine:'M-6 -3l6-3 6 3-6 9ZM-3 -2l3 4 3-4',
  relay:'M0 -5V6M-4 6h8M-4 -3q-4 3 0 6M4 -3q4 3 0 6M-2 -1q-2 1 0 2M2 -1q2 1 0 2'
 };
 const shape=shapes[type]||shapes.relay;
 return `<g class="chart-station-symbol${hostile?' hostile':active?' active':''}" style="--pin-color:${esc(color)}">
  ${active?'<circle class="chart-station-aura" r="14"/>':''}
  <path class="chart-station-frame" d="${hostile?'M0 -13L13 0 0 13-13 0Z':'M-7 -11H7L12 -6V6L7 11H-7L-12 6V-6Z'}"/>
  <path class="chart-station-glyph" d="${shape}"/>
 </g>`;
}

export function pilotGlyph(x,y){
 return `<g class="chart-pilot" transform="translate(${n(x)} ${n(y)})" aria-hidden="true" pointer-events="none"><circle r="19"/><path class="chart-pilot-halo" d="M0 -12L8 8 0 4-8 8Z"/><path d="M0 -9L6 7 0 3-6 7Z"/></g>`;
}
