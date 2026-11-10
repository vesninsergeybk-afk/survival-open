import {baseNames} from './balance.js?v=station-contour-map-20261110';
import {contourFields} from './territory-system.js?v=station-contour-map-20261110';
import {productiveContourFields,hasPoweredContour} from './contour-trials.js?v=station-contour-map-20261110';
import {artilleryConnection} from './flux-artillery.js?v=station-contour-map-20261110';
import {TURRET_GROWTH,turretGrowthType,turretGrowthRows,turretBranchOffer,
 hiveArmor,hiveLimit} from './turret-growth.js?v=station-contour-map-20261110';

const edgeId=(a,b)=>a<b?a+'|'+b:b+'|'+a;
const esc=value=>String(value).replace(/[&<>"']/g,ch=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));
const fixed=value=>Number(value).toFixed(1);
const CARD_COLORS={artillery:'#f4b56f',arc:'#91e6f4',laser:'#bd9eff',hive:'#98e7b5'};

// A turret belongs to a physical contour edge. That edge may be shared by
// two faces, so neither a distance-only station list nor a one-face owner is
// correct. Recalculate the same nearest-edge attachment the weapons use.
export function stationContourDefenseModel(world,station){
 const fields=world?.contours?contourFields(world):[];
 const adjoining=fields.filter(field=>field.vertices.includes(station?.id));
 const activeIds=new Set(world&&world.contours?.territoryPowered!==false&&hasPoweredContour(world)?
  productiveContourFields(world,fields).map(field=>field.id):[]);
 const edgeMap=new Map();
 for(const field of fields)for(let i=0;i<field.vertices.length;i++){
  const aId=field.vertices[i],bId=field.vertices[(i+1)%field.vertices.length];
  const id=edgeId(aId,bId);
  if(!edgeMap.has(id)){
   const a=world.stations.get(aId),b=world.stations.get(bId);
   if(a&&b)edgeMap.set(id,{id,a,b});
  }
 }
 const edges=[...edgeMap.values()];
 const allTurrets=[
  ...(world?.contours?.artillery||[]).map(t=>({turret:t,target:'a:'+t.id})),
  ...(world?.contours?.supportTurrets||[]).map(t=>({turret:t,target:'s:'+t.id}))
 ].filter(item=>item.turret.hp>0).map(item=>({
  ...item,edgeId:artilleryConnection(item.turret,edges)?.edgeId||null,
  type:turretGrowthType(item.turret)
 }));
 const faces=adjoining.map((field,index)=>{
  const edgeIds=field.vertices.map((id,i)=>edgeId(id,field.vertices[(i+1)%field.vertices.length]));
  return {id:field.id,label:'Контур '+(index+1),field,edgeIds,
   active:activeIds.has(field.id),turrets:allTurrets.filter(item=>edgeIds.includes(item.edgeId))};
 });
 const referenced=new Set(faces.flatMap(face=>face.turrets.map(item=>item.target)));
 const turrets=allTurrets.filter(item=>referenced.has(item.target)).map((item,index)=>({
  ...item,label:index+1,
  faceLabels:faces.filter(face=>face.turrets.some(t=>t.target===item.target)).map(face=>face.label)
 }));
 const indexed=new Map(turrets.map(item=>[item.target,item]));
 for(const face of faces)face.turrets=face.turrets.map(item=>indexed.get(item.target));
 const stationIds=[...new Set(faces.flatMap(face=>face.field.vertices))];
 const stations=stationIds.map((id,index)=>({station:world.stations.get(id),label:'С'+(index+1),current:id===station.id}));
 return {faces,turrets,stations,edges:edges.filter(edge=>faces.some(face=>face.edgeIds.includes(edge.id)))};
}

function mapSvg(plan,selected){
 const points=plan.stations.map(({station})=>station);
 const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
 const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
 const width=680,height=355,padding=52;
 const scale=Math.min((width-padding*2)/Math.max(1,maxX-minX),
  (height-padding*2)/Math.max(1,maxY-minY));
 const centerX=(maxX+minX)/2,centerY=(maxY+minY)/2;
 const place=p=>({x:width/2+(p.x-centerX)*scale,y:height/2+(p.y-centerY)*scale});
 const stationGeometry=plan.stations.map(item=>({...item,...place(item.station)}));
 const edges=plan.edges.map(edge=>{
  const a=place(edge.a),b=place(edge.b);
  return '<line x1="'+fixed(a.x)+'" y1="'+fixed(a.y)+'" x2="'+fixed(b.x)+'" y2="'+fixed(b.y)+'"/>';
 }).join('');
 const polygons=plan.faces.map((face,index)=>{
  const active=face.id===selected.id,fill=active?'#207f91':'#28677b';
  const polygon=face.field.polygon.map(p=>{const c=place(p);return fixed(c.x)+','+fixed(c.y);}).join(' ');
  const center=place(face.field.center);
  return '<g class="base-contour-face'+(active?' is-selected':'')+'" data-act="selectTerritoryContour"'+
   ' data-target="'+esc(face.id)+'"><title>Выбрать контур К'+(index+1)+'</title>'+
   '<polygon points="'+polygon+'" fill="'+fill+'" fill-opacity="'+(active?'.37':'.16')+'"'+
   ' stroke="'+(active?'#bffaff':'#5a91a9')+'" stroke-width="'+(active?'2.8':'1.25')+'"/>'+
   '<text x="'+fixed(center.x)+'" y="'+fixed(center.y)+'" class="base-contour-face-label">К'+(index+1)+'</text></g>';
 }).join('');
 const turrets=plan.turrets.map(item=>{
  const p=place(item.turret),color=CARD_COLORS[item.type]||'#d3dfef';
  return '<g class="base-contour-turret"><circle cx="'+fixed(p.x)+'" cy="'+fixed(p.y)+
   '" r="11" fill="#11252d" stroke="'+color+'" stroke-width="2.2"/>'+
   '<text x="'+fixed(p.x)+'" y="'+fixed(p.y+3.6)+'" fill="'+color+'">'+item.label+'</text></g>';
 }).join('');
 const stations=stationGeometry.map(node=>
  '<g class="base-contour-node'+(node.current?' is-origin':'')+'"><circle cx="'+fixed(node.x)+
   '" cy="'+fixed(node.y)+'" r="'+(node.current?'10':'7')+'" fill="'+(node.current?'#f9c06d':'#76d8ea')+
   '" stroke="#102633" stroke-width="2"/><text x="'+fixed(node.x+13)+'" y="'+fixed(node.y-10)+
   '">'+esc(node.label)+'</text></g>').join('');
 return '<svg class="base-contour-scheme" viewBox="0 0 '+width+' '+height+'" role="img" '+
  'aria-label="Схема контуров вокруг выбранной станции. К — номер контура, С — станция, цифра в кружке — установка." '+
  'preserveAspectRatio="xMidYMid meet">'+
  '<g class="base-contour-edges">'+edges+'</g>'+polygons+turrets+stations+'</svg>';
}

export function renderStationContourDefense(base,state){
 const plan=stationContourDefenseModel(state.world,base);
 const selected=plan.faces.find(face=>face.id===state.territoryContourId)||plan.faces[0];
 if(!selected)return '<section class="base-station-development base-contour-defense" aria-label="Схема обороны территории">'+
  '<h3>Оборона территории · схема контуров</h3><p>Эта станция пока не входит в замкнутый контур. '+
  'Подключите соседние станции и замкните энергетические грани, чтобы здесь появилась схема обороны.</p></section>';
 const choiceButtons=plan.faces.map((face,index)=>'<button type="button" data-act="selectTerritoryContour"'+
  ' data-target="'+esc(face.id)+'" aria-pressed="'+(face.id===selected.id)+'"'+
  ' class="base-contour-choice'+(face.id===selected.id?' is-selected':'')+'">'+
  '<strong>К'+(index+1)+' · '+face.field.vertices.length+' станции</strong><small>'+face.turrets.length+
  ' установок · '+(face.active?'есть питание':'нет питания')+'</small></button>').join('');
 const stationKey=plan.stations.map(node=>'<span><b>'+node.label+'</b> — '+
  (node.current?'текущая станция, ':'')+esc(baseNames[node.station.type]||'Станция')+
  '</span>').join('');
 const turretList=selected.turrets.length?'<div class="base-contour-turret-list">'+
  selected.turrets.map(item=>{
   const t=item.turret,name=TURRET_GROWTH[item.type]?.name||'Установка';
   const shared=item.faceLabels.length>1?' · общая грань: '+item.faceLabels.join(', '):'';
   return '<details class="base-card base-turret-growth"'+
    (state.territoryOpenTurret===item.target?' open':'')+'><summary><span class="base-contour-turret-number"'+
    ' style="--turret-color:'+(CARD_COLORS[item.type]||'#d3dfef')+'">'+item.label+'</span> <strong>'+name+ ' №'+
    t.id+'</strong> · корпус '+Math.ceil(t.hp)+'/'+Math.ceil(t.maxHp||t.hp)+
    (t.type==='hive'?' · дроны '+(t.drones||[]).filter(d=>d.hp>0).length+'/'+hiveLimit(t)+
     ' · броня '+hiveArmor(t):'')+esc(shared)+'</summary><div class="base-grid">'+
    turretGrowthRows(t).map(row=>{
     const quote=turretBranchOffer(state.world,{ore:state.ore},t,row.key,state.time);
     return '<div class="base-card"><strong>'+esc(row.name)+' · '+row.rank+'/'+row.max+'</strong>'+
      '<small>'+esc(row.summary)+'</small>'+
      (row.next?'<button type="button" data-act="upgradeTerritoryTurret" data-role="'+esc(row.key)+
       '" data-target="'+esc(item.target)+'"'+(quote.ok?'':' disabled')+'>'+esc('Улучшить · '+row.next[1]+
       ' сплава + '+row.next[2]+' флюкса')+'</button>'+
       (quote.ok?'':'<small>'+esc(quote.reason)+'</small>'):
       '<span class="base-ready">Ветка завершена</span>')+'</div>';
    }).join('')+'</div></details>';
  }).join('')+'</div>':
  '<p class="base-contour-empty">На гранях выбранного контура пока нет установок. '+
  'Постройте турели на энергетических линиях, чтобы они появились здесь.</p>';
 const count=plan.faces.length;
 const countWord=count%10===1&&count%100!==11?'контур':
  count%10>=2&&count%10<=4&&(count%100<12||count%100>14)?'контура':'контуров';
 return '<section class="base-station-development base-contour-defense" aria-label="Схема обороны территории">'+
  '<h3>Оборона территории · схема контуров</h3><p>К этой станции '+(count===1?'примыкает ':'примыкают ')+count+
  ' '+countWord+'. На схеме указаны реальные грани и установки. Выберите контур на схеме или кнопкой ниже — появятся его турели. '+
  'Установка на общей грани видна в двух контурах, но улучшается один раз.</p>'+
  '<div class="base-contour-map">'+mapSvg(plan,selected)+
  '<div class="base-contour-key">'+stationKey+'</div></div>'+
  '<div class="base-contour-choices" role="group" aria-label="Выбор контура">'+choiceButtons+'</div>'+
  '<h4>К'+(plan.faces.indexOf(selected)+1)+' · установки выбранного контура</h4>'+turretList+'</section>';
}
