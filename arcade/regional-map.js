import {REGIONS,regionAt} from './regions.js?v=regions-1';
import {SUPPLY,SUPPLY_ROUTE,supplyStatus} from './regional-supply.js?v=regions-1';
const enc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titles={dispatch:'Груз вышел из комплекса',delivery:'Руда доставлена военному узлу',
 'raid-warning':'Тяжёлый отряд подготовлен',raid:'Тяжёлый отряд прибыл',intercept:'Груз перехвачен',
 'mine-captured':'Источник руды захвачен','military-captured':'Военный узел захвачен',diverted:'Груз лишился военной базы назначения'};
export function renderRegionAtlas(game){
 const world=game.world,s=world.regionalSupply;if(!s)return '';
 const current=regionAt(game.player.x,game.player.y),mine=world.stations.get(SUPPLY.mineId);
 const q=p=>({x:150+p.x*.0022,y:120+p.y*.0022});
 const labels=REGIONS.map(r=>{const p=q(r);return '<text x="'+p.x+'" y="'+p.y+'" text-anchor="middle" fill="'+r.color+'" font-size="12">'+r.number+' · '+(r.id==='amethyst'?'Старт':r.id==='amber'?'Рудный пояс':r.id==='azure'?'Разлом':r.id==='lilac'?'Военный рубеж':'Обломки')+'</text>';}).join('');
 const player=q(game.player),buttons=REGIONS.map(r=>'<button type="button" data-act="waypoint" data-id="region-'+r.id+'" data-x="'+r.entry.x+'" data-y="'+r.entry.y+'" data-label="'+enc(r.name)+'">'+r.number+' · '+enc(r.name)+'</button>').join('');
 const cargo=s.convoys.filter(c=>c.seen).map(c=>'<button type="button" data-act="waypoint" data-id="'+c.id+'" data-x="'+c.x+'" data-y="'+c.y+'" data-label="Рудный транспорт">Перехватить обнаруженный транспорт</button>').join('');
 const history=mine?.discovered?s.history.slice(-2).reverse().map(e=>'<small>'+Math.floor(e.time/60)+':'+String(Math.floor(e.time%60)).padStart(2,'0')+' · '+titles[e.kind]+'</small>').join(''):'';
 return '<div class="map-objective region-status"><span>РЕГИОН '+current.number+' · '+enc(current.name)+'</span><p>'+enc(current.cue)+'</p>'+
  '<details class="region-atlas"><summary>Обзор регионов и выбор направления</summary><svg viewBox="0 0 300 240" role="img" aria-label="Старт в центре, рудный пояс на востоке, разлом на юге, военный рубеж на севере, обломки на западе">'+
  '<rect width="300" height="240" rx="12" fill="#08182b"/><path d="M 150 120 L 300 0 V 240 Z" fill="#ffbb7015"/>'+
  '<path d="M 150 120 L 0 0 H 300 Z" fill="#dfa1e315"/><path d="M 150 120 L 0 240 H 300 Z" fill="#82e8ff15"/>'+
  '<path d="M 150 120 L 0 0 V 240 Z" fill="#88e6c815"/><circle cx="150" cy="120" r="53" fill="#24233c" stroke="#caa0ff"/>'+labels+
  '<circle cx="'+Math.max(5,Math.min(295,player.x))+'" cy="'+Math.max(5,Math.min(235,player.y))+'" r="4" fill="#ffffff"/></svg><p>Контуры условны. Маршрут ведёт к границе выбранного региона. Станции открываются при разведке.</p><div class="region-directions">'+buttons+'</div></details>'+
  (mine?.discovered?'<p>'+enc(supplyStatus(world))+'</p>'+history:cargo?'':'<p>На востоке — богатый рудный пояс. Выберите направление в обзоре регионов.</p>')+cargo+'</div>';
}
export function regionalMapOverlay(game,point,visible){
 const s=game.world.regionalSupply;if(!s)return '';
 const mine=game.world.stations.get(SUPPLY.mineId);
 let out='';
 if(mine?.discovered){
  out+='<path d="M '+SUPPLY_ROUTE.map(p=>{const q=point(p);return q.x.toFixed(1)+' '+q.y.toFixed(1);}).join(' L ')+'" stroke="'+(mine.enemy?'#ffbc78':'#a4d8b1')+'" opacity=".7" stroke-width="2" stroke-dasharray="9 6" fill="none"/>';
 }
 for(const c of s.convoys.filter(c=>c.seen)){
  const q=point(c);if(!visible(q))continue;
  out+='<g><rect x="'+(q.x-5)+'" y="'+(q.y-5)+'" width="10" height="10" fill="#ffc481"/><text x="'+(q.x+9)+'" y="'+(q.y-9)+'" fill="#ffdbad" font-size="11">РУДНЫЙ ТРАНСПОРТ</text></g>';
 }
 return out;
}
