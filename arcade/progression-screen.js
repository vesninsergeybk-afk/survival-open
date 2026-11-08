import {MODULES,FRAME_STEPS,SHIP_UPGRADES,createLoadout,moduleStats} from './ship-loadout.js';
import {WEAPON_SPECIALIZATIONS,quoteSpecialization} from './weapon-specializations.js';
import {TACTICAL_DEVICES,TACTICAL_BRANCHES,createTactical,tacticalQuote} from './tactical-fields.js';
import {developmentPointLedger} from './experience.js';
import {DEFAULT_CONTROLS,readableKey} from './control-layout.js';
import {heroMenuPortrait} from './hero-menu-portrait.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const art=(group,id)=>'./assets/progression/'+group+'/'+id+'.webp';
const domains=[
 {id:'pilot',title:'Пилот',subtitle:'Манёвры · добыча',theme:'amber'},
 {id:'weapons',title:'Оружие',subtitle:'Мощность · дальность',theme:'cyan'},
 {id:'ship',title:'Корабль',subtitle:'Корпус · узлы',theme:'ice'},
 {id:'tactics',title:'Тактика',subtitle:'Поля · приёмы',theme:'violet'},
 {id:'network',title:'Станции',subtitle:'Сеть · оборона',theme:'ice'}
];
const fieldSkills=new Set(['parasite','conduit','wreck','capture','signal','tactics']);
const icons={beam:'calibration',range:'range',double:'split',rocket:'rocket',hull:'hull',
 shield:'shield',engine:'engine',dodge:'dodge',magnet:'magnet',mining:'mining',
 extractor:'extractor',radar:'scanner',tactics:'doctrine',parasite:'energy_parasite',
 conduit:'dash_discharge',wreck:'wreck',capture:'capture',signal:'signal',
 cometRadius:'comet',mineArray:'mines',cometCore:'comet_core',cometCryo:'comet_cryo',
 minePierce:'mine_pierce',mineSnare:'mine_snare'};
const activations={
 beam:'Автоматически усиливает установленное автооружие и ионную цепь.',
 range:'Работает автоматически: у плазменного луча увеличивается дальность.',
 double:'Автоматически распределяет плазменный залп между ближайшими целями.',
 rocket:'Сначала установите полученный ракетный модуль в узел корабля. Дальше он стреляет автоматически.',
 hull:'Постоянно действует после изучения. Дополнительно сразу восстанавливает часть прочности.',
 shield:'Автоматически поглощает часть входящего урона и восстанавливается.',
 engine:'Действует постоянно. Для рывка используйте Shift.',
 dodge:'При попадании корабль автоматически отскакивает от источника удара и получает краткую неуязвимость. Отдельная клавиша не нужна.',
 magnet:'Сбор сплава и данных происходит с увеличенной дистанции без дополнительной клавиши.',
 mining:'Используйте E у астероида: экстрактор добывает эффективнее.',
 extractor:'Удерживайте E рядом с астероидом: экстрактор действует дальше, расщепляет породу быстрее и приносит больше сплава.',
 radar:'Станции обнаруживаются раньше автоматически.',
 tactics:'Союзные дроны лучше выбирают опасные цели автоматически.',
 conduit:'Shift: пройдите рывком через противника. Метка держится 4 с; попадите по ней, чтобы обездвижить до трёх целей на 1,25 с.',
 parasite:'Автоматически после каждого третьего лично сбитого дрона появляется энергоядро. Заряды подбираются и могут поглотить сильный удар.',
 wreck:'После уничтожения тяжёлого противника появляются временные обломки-укрытия.',
 capture:'Отметьте противника приоритетной целью и уничтожьте его при наличии заряда: он временно перейдёт на вашу сторону.',
 signal:'Попадите по свежей приоритетной цели с зарядом: враг раскроет расположение патруля.',
 cometRadius:'Зажмите ЛКМ и наведите круг. Отпустите: комета взорвётся в выбранной точке.',
 mineArray:'Зажмите ПКМ и выберите место для веера. Отпустите: мины полетят туда и взведутся.',
 cometCore:'ЛКМ: усиление действует автоматически в центре каждого взрыва кометы.',
 cometCryo:'ЛКМ: пережившие взрыв кометы враги автоматически замедляются.',
 minePierce:'ПКМ: урон минами по тяжёлым противникам увеличивается автоматически.',
 mineSnare:'ПКМ: каждая сработавшая мина замедляет уцелевших противников.'
};
const iconFor=(id)=>{
 const key=icons[id]||id;
 const group=['energy_parasite','dash_discharge','radio_jam','capture','signal'].includes(key)?'tactics':
  ['rocket','comet','mines','comet_core','comet_cryo','mine_pierce','mine_snare'].includes(key)?'weapons':'upgrades';
 return art(group,key);
};
// Small, semantic path markers distinguish specializations that share a weapon/device
// silhouette. The actual equipment art stays stable when the player changes a path.
const branchMarks={
 furnace:'<path d="M8 20c-5-4 0-8 1-13 4 3 3 6 5 8 1-2 2-4 2-7 5 6 4 11-1 13"/>',
 focus:'<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
 breaker:'<path d="M4 7h16v10H4zM7 7v10m10-10v10M2 12h5m10 0h5"/>',
 penetrator:'<path d="M3 12h16m-6-5 6 5-6 5M8 4v16"/>',
 sweep:'<path d="M4 19 12 5l8 14M7 15l-4-2m14 2 4-2M12 11v10"/>',
 interceptor:'<path d="m4 12 5-5 4 4 7-7M15 4h5v5M4 18l5-5"/>',
 seeker:'<path d="M4 12a8 8 0 0 1 13-6M20 12a8 8 0 0 1-13 6m7-15 3 3-4 1m-3 14-3-3 4-1"/>',
 payload:'<path d="M12 3v12m-5-7 5-5 5 5M5 17h14v4H5z"/>',
 shell:'<path d="M12 2 4 6v6c0 5 3 8 8 10 5-2 8-5 8-10V6z"/>',
 burst:'<path d="M12 12V2m0 20V12M2 12h20M5 5l14 14M19 5 5 19"/>',
 lure:'<path d="M12 20V9m-4 0a4 4 0 0 1 8 0M5 6a9 9 0 0 1 14 0M3 2a14 14 0 0 1 18 0"/>',
 ghost:'<path d="M6 20V9a6 6 0 0 1 12 0v11l-3-2-3 2-3-2z"/>',
 sink:'<circle cx="12" cy="12" r="3"/><path d="M3 3l5 5m13-5-5 5M3 21l5-5m13 5-5-5"/>',
 snare:'<path d="M4 4v16h16V4zM4 12h16M12 4v16M7 7l10 10M17 7 7 17"/>',
 wide:'<path d="M12 20V8m-7 8a10 10 0 0 1 14 0M2 12a15 15 0 0 1 20 0"/>',
 deep:'<circle cx="12" cy="12" r="9"/><path d="M12 6v7l4 3"/>'
};
const branchMark=mark=>branchMarks[mark]?'<span class="prog-branch-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+branchMarks[mark]+'</svg></span>':'';
const pointsWord=n=>n%100>=11&&n%100<=14?'очков':n%10===1?'очко':n%10>=2&&n%10<=4?'очка':'очков';
const mastered=(rank,max)=>rank>=max;

function skillNode(skill,state,act='skill'){
 const ranks=state.skillRanks||{},rank=ranks[skill.id]||0,level=state.level||1,points=state.points||0;
 const complete=mastered(rank,skill.max),hasPrereq=!skill.requires||!!ranks[skill.requires];
 const exclusive=!!skill.exclusiveWith&&!!ranks[skill.exclusiveWith];
 const masteryLocked=!!skill.masteryLevel&&rank>0&&level<skill.masteryLevel;
 const reason=complete?'Максимальный ранг':exclusive?'Выбрана другая специализация':!hasPrereq?'Сначала изучите «'+
  (state.pilotSkills||[]).find(s=>s.id===skill.requires)?.title+'»':
  level<skill.from?'Нужен уровень '+skill.from:masteryLocked?'Второй ранг откроется на уровне '+skill.masteryLevel:
  points<1?'Нужно 1 очко развития':'';
 return {id:'skill-'+skill.id,kind:'skill',title:skill.title,icon:iconFor(skill.id),
  level:skill.from,rank,max:skill.max,requires:skill.requires?'skill-'+skill.requires:null,
  status:complete?'mastered':exclusive?'exclusive':!hasPrereq||level<skill.from||masteryLocked?'locked':points<1?'waiting':'ready',
  description:skill.desc,effect:complete?'Полностью изучено':(state.nextSkillEffect?.(skill.id,rank,ranks)||skill.desc),
  activation:activations[skill.id]||'Действует автоматически после изучения.',
  reason,action:act,actionId:skill.id,actionLabel:'Изучить · 1 очко',canAct:!reason,cost:'1 очко развития'};
}

function pilotNodes(state){
 const branch=state.skillBranch||'Корабль';
 const skills=(state.pilotSkills||[]).filter(s=>s.branch===branch&&!SHIP_UPGRADES.has(s.id)&&!fieldSkills.has(s.id));
 const nodes=skills.map(s=>skillNode(s,state));
 if(branch==='Корабль'){
  for(const d of state.pilotDoctrines||[]){
   const selected=state.doctrine===d.id,chosen=!!state.doctrine,level=state.level||1;
   const reason=selected?'Доктрина выбрана':chosen?'Другая доктрина уже выбрана':
    level<4?'Нужен уровень 4':!(state.points>0)?'Нужно 1 очко развития':'';
   nodes.push({id:'doctrine-'+d.id,title:d.title,icon:art('upgrades','doctrine'),level:4,
    rank:selected?1:0,max:1,status:selected?'mastered':chosen?'exclusive':
     level<4?'locked':state.points>0?'ready':'waiting',
    description:d.desc,effect:d.desc,activation:'Постоянная специализация пилота. Можно выбрать только одну; смена на станции стоит сплав.',
    reason,action:'doctrine',actionId:d.id,actionLabel:'Выбрать доктрину · 1 очко',canAct:!reason,cost:'1 очко развития'});
  }
 }
 return nodes;
}

function weaponNodes(state){
 const loadout=state.loadout||createLoadout(),id=state.developmentWeapon||state.hangarSession?.focusWeapon||'plasma';
 if(id==='comet'||id==='mines'){
  const comet=id==='comet',base=comet?'cometRadius':'mineArray';
  const paths=comet?['cometCore','cometCryo']:['minePierce','mineSnare'];
  const nodes=(state.pilotSkills||[]).filter(skill=>skill.id===base||paths.includes(skill.id))
   .map(skill=>skillNode(skill,state));
  const ranks=state.skillRanks||{},rank=ranks[base]||0;
  return {nodes,family:{id,name:comet?'Голубая комета':'Минный веер',
   role:comet?'Дистанционный взрыв по площади':'Дистанционная минная завеса',kind:'manual'},
   installed:true,manual:true,stats:{range:comet?670:520,
    summary:comet?'Радиус '+(90+rank*17)+' м · перезарядка 5,5 с':
     (4+rank)+' мины · перезарядка 17 с'},
   control:comet?'ЛКМ':'ПКМ'};
 }
 const family=MODULES[id]||MODULES.plasma,installed=loadout.slots.includes(family.id);
 const relevant={plasma:['beam','range','double'],rail:['beam'],flak:['beam'],rocket:['beam','rocket'],
  ion:['beam'],resonator:[],howitzer:[]}[family.id]||[];
 const nodes=(state.hangarUpgrades||[]).filter(s=>relevant.includes(s.id)).map(s=>skillNode(s,state,'hgUpgrade'));
 // The first rocket technology grants the launcher, even before it is fitted.
 if(family.id==='rocket'&&!nodes.some(n=>n.id==='skill-rocket')){
  const rocket=(state.hangarUpgrades||[]).find(s=>s.id==='rocket');if(rocket)nodes.push(skillNode(rocket,state,'hgUpgrade'));
 }
 const paths=WEAPON_SPECIALIZATIONS[family.id]||{};
 for(const [path,branch] of Object.entries(paths)){
  const current=loadout.specializations?.[family.id],rank=current?.path===path?current.rank:0;
  const exclusive=!!current&&current.path!==path;
  const quote=quoteSpecialization(loadout,family.id,path,{baseActive:!!state.baseActive,
   level:state.level||1,activeBases:state.activeBases||0,points:state.points||0});
  const complete=rank>=2,reason=complete?'Мастерство изучено':exclusive?'Другая специализация уже выбрана':quote.reason||'';
  nodes.push({id:'spec-'+family.id+'-'+path,title:branch.name,
   icon:art('weapons',family.id),mark:path,level:7,masteryAt:11,rank,max:2,
   status:complete?'mastered':exclusive?'exclusive':quote.ok?'ready':reason.startsWith('Нужно 1 очко')?'waiting':'locked',
   description:branch.desc,effect:branch.desc,
   activation:'Пассивная специализация установленного оружия. Действует во время стрельбы.',
   reason,action:'hgSpec',actionId:family.id+':'+path,actionLabel:rank?'Изучить мастерство · 1 очко':'Выбрать путь · 1 очко',
   canAct:!!quote.ok,cost:'1 очко развития'});
 }
 if(!nodes.length){
  nodes.push({id:'equipment-'+family.id,kind:'equipment',title:family.name,
   icon:art('weapons',family.id),level:family.level,rank:installed?1:0,max:1,
   status:'info',description:family.desc,effect:family.role,
   activation:'Это отдельный модуль. Доступность, прокат и стоимость установки проверяются в схеме корабля.',
   reason:'',action:'fitWeapon',actionId:family.id,actionLabel:'Открыть схему установки',
   canAct:true,cost:'По условиям оснащения'});
 }
 return {nodes,family,installed,stats:moduleStats(family.id,state.skillRanks||{},loadout.specializations?.[family.id])};
}

function shipNodes(state){
 const nodes=(state.hangarUpgrades||[]).filter(s=>['hull','shield','engine'].includes(s.id))
  .map(s=>skillNode(s,state,'hgUpgrade'));
 const frame=state.loadout?.frame||0;
 const pendingAssembly=!!state.hangarSession?.dirty?.(state.loadout);
 for(let i=1;i<FRAME_STEPS.length;i++){
  const step=FRAME_STEPS[i],complete=frame>=i,next=frame+1===i;
  const reason=complete?'Узел открыт':!next?'Сначала откройте предыдущий узел':
   (state.level||1)<step.level?'Нужен уровень '+step.level:
   (state.ore||0)<step.cost?'Нужно '+step.cost+' сплава':
   pendingAssembly?'Сначала примените или отмените предварительную сборку':'';
  nodes.push({id:'frame-'+i,title:step.name,icon:art('upgrades','weapon_slot'),level:step.level,
   rank:complete?1:0,max:1,requires:i>1?'frame-'+(i-1):null,
   status:complete?'mastered':!next||(state.level||1)<step.level?'locked':reason?'waiting':'ready',
   description:'Расширяет схему оснащения: '+step.nodes+' обычных оружейных узлов'+(step.heavy?' и сверхтяжёлый узел H':'')+'.',
   effect:'После открытия нового узла оружие нужно приобрести или установить отдельно.',
   activation:'После покупки узел появится на схеме корабля в разделе «Оснащение».',
   reason,action:'hgFrame',actionId:'',actionLabel:'Открыть · '+step.cost+' сплава',canAct:next&&!reason,cost:step.cost+' сплава'});
 }
 return nodes;
}

function tacticalNodes(state){
 const focus=state.developmentTactic||'pulse';
 if(focus==='abilities')return (state.pilotSkills||[]).filter(s=>fieldSkills.has(s.id)).map(s=>skillNode(s,state));
 const id=TACTICAL_DEVICES[focus]?focus:'pulse',device=TACTICAL_DEVICES[id];
 const tactical=state.tactical||createTactical(),owned=tactical.owned.includes(id),equipped=tactical.equipped===id;
 const context={baseActive:!!state.baseActive,activeBases:state.activeBases||0,level:state.level||1,
  ore:state.ore||0,points:state.points||0};
 const baseQuote=owned?tacticalQuote(tactical,'equip',id,context):tacticalQuote(tactical,'unlock',id,context);
 const baseReason=equipped?'Уже используется':baseQuote.reason||'';
 const nodes=[{id:'tactic-'+id,title:device.name,icon:art('tactics',
  ({pulse:'impulse',decoy:'decoy',trap:'gravity_trap',jam:'radio_jam'})[id]),
  level:1,rank:owned?1:0,max:1,status:equipped?'mastered':baseQuote.ok?'ready':owned?'waiting':'locked',
  description:device.desc,effect:device.role,activation:'Для запуска нажмите %FIELD%.',
  reason:baseReason,action:owned?'hgTacticEquip':'hgTacticUnlock',actionId:id,
  actionLabel:owned?'Установить':'Получить · '+device.cost+' сплава',canAct:!!baseQuote.ok,
  cost:owned?'Бесплатная установка':device.cost+' сплава'}];
 for(const [path,branch] of Object.entries(TACTICAL_BRANCHES[id]||{})){
  const current=tactical.branches[id],rank=current?.path===path?current.rank:0;
  const exclusive=!!current&&current.path!==path,quote=tacticalQuote(tactical,'upgrade',id,{...context,path});
  const complete=rank>=2,reason=complete?'Мастерство изучено':exclusive?'Другая ветка уже выбрана':quote.reason||'';
  nodes.push({id:'tactic-'+id+'-'+path,title:branch.name,icon:nodes[0].icon,mark:path,level:3,masteryAt:7,
   rank,max:2,requires:'tactic-'+id,status:complete?'mastered':exclusive?'exclusive':quote.ok?'ready':
    reason.startsWith('Нужно 1 очко')?'waiting':'locked',
   description:branch.desc,effect:branch.desc,
   activation:'Меняет действие выбранного полевого устройства. Для применения нажмите %FIELD%.',
   reason,action:'hgTacticUpgrade',actionId:id+':'+path,
   actionLabel:rank?'Мастерство · 1 очко':'Выбрать путь · 1 очко',canAct:!!quote.ok,cost:'1 очко развития'});
 }
 return nodes;
}

function networkNodes(state){
 const base=state.station||{},linked=state.connectedBases||0;
 return [
  {id:'network-tech',title:'Технологии станций',icon:art('tactics','flux_capacitor'),level:1,
   description:'Каждая станция может один раз вложить сплав в общую технологию флота.',
   effect:'Улучшения оплачиваются сплавом, очки развития пилота не расходуются.',
   activation:base.usedUpgrade?'Вклад этой станции уже использован. Можно продолжать развитие на других станциях.':'Откройте раздел «Станция» и посмотрите стоимость и условия следующего улучшения.'},
  {id:'network-defense',title:'Оборона станций',icon:art('tactics','station_triangle'),level:1,
   description:'Защитные заряды, стазис и выбор перехвата орбитальных ударов.',
   effect:'Оборона работает по действующим правилам станции.',
   activation:'Откройте раздел «Станция», чтобы увидеть заряды, условия и варианты обороны.'},
  {id:'network-links',title:'Связь и маршруты',icon:art('tactics','station_triangle'),level:1,
   description:'Связь с домашним доком, перелёты и сеть станций.',
   effect:'В радиосети дока сейчас '+linked+' станц.',
   activation:'Откройте раздел «Станция»: там указаны реальные маршруты и условия связи.'}
 ].map(n=>({...n,kind:'navigation',rank:0,max:1,status:'ready',reason:'',action:'baseTab',actionId:'network',
  actionLabel:'Открыть раздел станции',canAct:true,cost:'По условиям станции'}));
}

function branchButtons(domain,state){
 if(domain==='pilot')return [['Корабль','Пилотирование'],['Технологии','Технологии'],['Добыча','Добыча']]
  .map(([id,name])=>'<button type="button" class="prog-subtab" data-act="devPilotBranch" data-id="'+id+'" aria-pressed="'+((state.skillBranch||'Корабль')===id)+'">'+name+'</button>').join('');
 if(domain==='weapons'){
  const current=state.developmentWeapon||state.hangarSession?.focusWeapon||'plasma';
  const tab=(id,name,manual=false)=>'<button type="button" class="prog-subtab'+(manual?' is-manual':'')+'" data-act="devWeapon" data-id="'+id+'" aria-pressed="'+(current===id)+'">'+
   '<img src="'+art('weapons',id)+'" alt=""><span>'+esc(name)+'</span></button>';
  return '<span class="prog-subtab-label">РУЧНОЕ</span>'+tab('comet','Комета · ЛКМ',true)+tab('mines','Мины · ПКМ',true)+
   '<span class="prog-subtab-label">АВТО</span>'+Object.values(MODULES).map(m=>tab(m.id,m.short)).join('');
 }
 if(domain==='tactics')return [...Object.entries(TACTICAL_DEVICES).map(([id,d])=>[id,d.short]),['abilities','Способности']]
  .map(([id,name])=>'<button type="button" class="prog-subtab" data-act="devTactic" data-id="'+id+'" aria-pressed="'+((state.developmentTactic||'pulse')===id)+'">'+esc(name)+'</button>').join('');
 return '';
}

export function progressionModel(state){
 const domain=domains.some(d=>d.id===state.developmentDomain)?state.developmentDomain:'pilot';
 const weapon=domain==='weapons'?weaponNodes(state):null;
 const nodes=domain==='pilot'?pilotNodes(state):domain==='weapons'?weapon.nodes:
  domain==='ship'?shipNodes(state):domain==='tactics'?tacticalNodes(state):networkNodes(state);
 const selected=nodes.find(n=>n.id===state.developmentFocus)||nodes.find(n=>n.status==='ready')||nodes[0]||null;
 return {domain,nodes,selected,weapon};
}

function nodeHtml(node,selected){
 const labels={ready:'Доступно',mastered:'Изучено',waiting:'Не выполнены условия',locked:'Закрыто',
  exclusive:'Другой путь',info:'Оснащение'};
 const progress=node.kind==='navigation'?'Раздел станции':node.kind==='equipment'?(node.rank?'Установлено':'Оснащение'):
  node.rank+'/'+node.max+' · '+(labels[node.status]||'Сведения');
 return '<button type="button" class="prog-node" data-act="devFocus" data-id="'+esc(node.id)+'" data-node="'+esc(node.id)+'"'+
  (node.requires?' data-requires="'+esc(node.requires)+'"':'')+' data-status="'+esc(node.status)+'" aria-pressed="'+(selected?.id===node.id)+'"'+
  ' aria-label="'+esc(node.title)+', '+esc(node.status==='mastered'?'изучено':node.reason||'доступно')+'">'+
  '<span class="prog-node-art"><img src="'+art('frames','node_'+(selected?.id===node.id?'selected':node.status==='mastered'?'mastered':node.status==='ready'||node.status==='info'?'ready':'locked'))+'" alt="" class="prog-node-frame">'+
  '<img src="'+esc(node.icon)+'" alt="" class="prog-node-glyph">'+branchMark(node.mark)+'</span>'+
  '<strong>'+esc(node.title)+'</strong><small>'+esc(progress)+'</small></button>';
}

function treeHtml(nodes,selected){
 const groups=new Map();for(const node of nodes){const level=node.level||1;if(!groups.has(level))groups.set(level,[]);groups.get(level).push(node);}
 return '<div class="prog-graph"><div class="prog-graph-head"><span>СХЕМА РАЗВИТИЯ</span><small>Выберите узел, чтобы увидеть эффект и условия.</small></div>'+
  '<div class="prog-tree" aria-label="Навыки по уровням и реальные связи между ними"><svg class="prog-tree-links" aria-hidden="true"></svg>'+
  [...groups].sort(([a],[b])=>a-b).map(([level,entries])=>{
   const station=entries.every(n=>n.kind==='navigation');
   return '<section class="prog-tier" aria-label="'+(station?'Системы станции':'Уровень '+level)+'">'+
    '<div class="prog-tier-track"><span class="prog-tier-index">'+(station?'●':String(level).padStart(2,'0'))+'</span><h3>'+
    (station?'Системы станции':'Уровень '+level)+'</h3></div><div class="prog-tier-nodes">'+
    entries.map(n=>nodeHtml(n,selected)).join('')+'</div></section>';
  }).join('')+'</div><div class="prog-graph-key" aria-label="Обозначения"><span class="is-ready">Доступно</span><span class="is-mastered">Изучено</span><span class="is-locked">Закрыто или требует ресурсов</span></div></div>';
}

function detailHtml(node,domain,weapon,state){
 if(!node)return '<aside class="prog-detail">Пока нет навыков в выбранном направлении.</aside>';
 const bindings={...DEFAULT_CONTROLS,...state.controls};
 const key=action=>readableKey(bindings[action]);
 const activation=String(node.activation||'').replace(/\bShift\b/g,key('dash')).replace(/\bE\b/g,key('interact'))
  .replace(/%FIELD%/g,key('field'));
 const fieldMounted=state.fieldLoan&&state.loadout?.slots?.includes(state.fieldLoan.moduleId||'ion');
 const fieldCollision=domain==='tactics'&&node.id.startsWith('tactic-')&&fieldMounted?
  'Сейчас клавиша '+key('field')+' занята установленным полевым оружием. Пока оно установлено, полевое устройство не запускается.':null;
 const status=node.kind==='navigation'?'Раздел станции':node.status==='info'?'Оборудование':node.status==='mastered'?'Изучено':node.status==='ready'?'Доступно':
  node.status==='exclusive'?'Другая ветка выбрана':node.status==='waiting'?'Ждёт ресурса':'Закрыто';
 const cta='<button type="button" class="prog-action" data-act="'+esc(node.action)+'"'+
  (node.actionId?' data-id="'+esc(node.actionId)+'"':'')+(node.action==='baseTab'?' data-role="network"':'')+
  (node.canAct?'':' disabled')+'>'+esc(node.actionLabel)+'</button>';
 return '<aside class="prog-detail" aria-label="Выбранное улучшение"><div class="prog-detail-main">'+
  '<span class="prog-detail-illustration"><img src="'+esc(node.icon)+'" alt="" class="prog-detail-icon">'+branchMark(node.mark)+'</span><div class="prog-detail-copy"><span class="prog-detail-status" data-status="'+esc(node.status)+'">'+status+'</span><h3>'+esc(node.title)+'</h3>'+
  '<p>'+esc(node.description)+'</p>'+(node.masteryAt?'<p class="prog-mastery-hint">Два ранга: выбор ветки с уровня '+node.level+', мастерство с уровня '+node.masteryAt+'.</p>':'')+'</div></div><div class="prog-detail-facts">'+
  '<div><b>Что изменится</b><p>'+esc(node.effect)+'</p></div><div><b>Как применять</b><p>'+esc(activation)+'</p>'+
  (fieldCollision?'<p class="prog-control-warning">'+esc(fieldCollision)+'</p>':'')+'</div></div>'+
  '<div class="prog-detail-actions"><span class="prog-cost">Стоимость: '+esc(node.cost)+'</span>'+cta+
  (domain==='weapons'&&!weapon.manual&&node.kind!=='equipment'?'<button type="button" class="prog-secondary" data-act="fitWeapon" data-id="'+esc(weapon.family.id)+'">Оснастить корабль</button>':
   domain==='ship'?'<button type="button" class="prog-secondary" data-act="baseTab" data-role="hangar">Схема корабля</button>':'')+'</div>'+
  (node.reason?'<p class="prog-detail-reason">'+esc(node.reason)+'</p>':'')+'</aside>';
}

function spentPointsHtml(state,ledger){
 const skills=[...(state.pilotSkills||[]),...(state.hangarUpgrades||[])];
 const labels=new Map(skills.map(s=>[s.id,s.title]));
 const choices=[];
 for(const [id,rank] of Object.entries(state.skillRanks||{})){
  if(rank>0)choices.push([labels.get(id)||id,rank]);
 }
 if(state.doctrine){
  const title=(state.pilotDoctrines||[]).find(d=>d.id===state.doctrine)?.title||state.doctrine;
  choices.push(['Доктрина: '+title,1]);
 }
 for(const [id,path] of Object.entries(state.loadout?.specializations||{})){
  const name=WEAPON_SPECIALIZATIONS[id]?.[path.path]?.name;
  if(path.rank>0)choices.push(['Оружие: '+(name||id),path.rank]);
 }
 for(const [id,path] of Object.entries(state.tactical?.branches||{})){
  const name=TACTICAL_BRANCHES[id]?.[path.path]?.name;
  if(path.rank>0)choices.push(['Тактика: '+(name||id),path.rank]);
 }
 const note=ledger.unaccounted>0?'Часть расходов в сохранении не удалось восстановить: '+ledger.unaccounted+
  '. Сохранение и очки не изменены.':ledger.unaccounted<0?'В сохранении больше приобретённых рангов, чем допускает текущий уровень. Данные не изменены.':'';
 return '<details class="prog-ledger"><summary>Куда потрачены '+ledger.spent+' '+pointsWord(ledger.spent)+'</summary><div class="prog-ledger-body">'+
  (choices.length?'<ul>'+choices.map(([name,count])=>'<li>'+esc(name)+' · '+count+' '+pointsWord(count)+'</li>').join('')+'</ul>':
   '<p>Пока нет изученных навыков и специализаций.</p>')+(note?'<p class="prog-ledger-note">'+esc(note)+'</p>':'')+'</div></details>';
}

export function renderProgressionScreen(state){
 const {domain,nodes,selected,weapon}=progressionModel(state),points=state.points||0;
 const ledger=developmentPointLedger(state),meta=domains.find(d=>d.id===domain);
 const top='<header class="prog-header"><div><span>ТЕРМИНАЛ / ДЕРЕВО РАЗВИТИЯ</span><h2>Развитие</h2></div>'+
  '<div class="prog-resource-bar"><span class="prog-chip points">Очки <b>'+points+'</b></span><span class="prog-chip alloy">Сплав <b>'+(state.ore||0)+'</b></span><span class="prog-chip level">Пилот · ур. <b>'+(state.level||1)+'</b></span></div></header>';
 const damaged=Number(state.maxHp)>0&&Number(state.hp)/Number(state.maxHp)<.4;
 const orbit='<aside class="prog-domains" aria-label="Направления развития"><div class="prog-orbit">'+
  '<div class="prog-orbit-center"><img src="'+heroMenuPortrait(state.level,state.hp,state.maxHp)+'" alt="Ваш корабль" loading="lazy">'+
  '<div class="prog-ship-caption"><span>ВАШ КОРАБЛЬ</span><strong>Уровень '+(state.level||1)+'</strong>'+
  '<small>'+(damaged?'Корпус серьёзно повреждён':'Текущая модель корпуса')+'</small></div></div>'+
  domains.map((d,index)=>'<button type="button" class="prog-domain domain-'+d.id+'" data-act="devDomain" data-id="'+d.id+'" aria-pressed="'+(domain===d.id)+'"'+
   ' title="'+esc(d.subtitle)+'"><img src="'+art('domains',d.id==='network'?'stations':d.id)+'" alt=""><strong>'+d.title+'</strong></button>').join('')+
  '</div></aside>';
 const weaponHead=weapon?'<div class="prog-weapon-summary"><img src="'+art('weapons',weapon.family.id)+'" alt=""><div><strong>'+esc(weapon.family.name)+'</strong><span>'+
  (weapon.manual?'Доступно сразу · '+weapon.control:weapon.installed?'Установлено':'Не установлено')+
  ' · '+esc(weapon.family.role)+' · дальность '+esc(weapon.stats?.range)+' м'+
  (weapon.manual?' · '+esc(weapon.stats?.summary):'')+'</span></div></div>':'';
 const branch=branchButtons(domain,state);
 return '<section class="progression-ui" data-domain="'+domain+'">'+top+'<div class="prog-main">'+orbit+
  '<div class="prog-workspace"><div class="prog-workspace-head"><div><span>НАПРАВЛЕНИЕ</span><h2>'+meta.title+'</h2></div>'+
  '<div class="prog-points-hint">'+ledger.spent+' потрачено · '+ledger.free+' '+pointsWord(ledger.free)+' свободно</div></div>'+
  (branch?'<nav class="prog-subtabs" aria-label="Ветки направления">'+branch+'</nav>':'')+weaponHead+
  treeHtml(nodes,selected)+detailHtml(selected,domain,weapon,state)+spentPointsHtml(state,ledger)+'</div></div></section>';
}

// Decoration is computed from actual prerequisites, not an artist's hard-coded diagram.
// The tree stays a real, extendable graph when designers add a skill or level.
export function paintProgressionLinks(root){
 if(!root)return;
 const svg=root.querySelector('.prog-tree-links');if(!svg)return;
 // An absolute SVG sized to scrollWidth/scrollHeight would enlarge those very
 // dimensions and create scrollbars even when the whole tree fits on screen.
 const rect=root.getBoundingClientRect(),style=getComputedStyle(root);
 const rightPadding=Number.parseFloat(style.paddingRight)||0;
 const bottomPadding=Number.parseFloat(style.paddingBottom)||0;
 const width=Math.max(1,root.clientWidth-rightPadding);
 const contentBottom=Math.max(0,...[...root.querySelectorAll('.prog-tier')]
  .map(tier=>tier.offsetTop+tier.offsetHeight));
 const height=Math.max(1,Math.ceil(root.clientHeight-bottomPadding),Math.ceil(contentBottom));
 svg.setAttribute('viewBox','0 0 '+Math.max(1,width)+' '+Math.max(1,height));
 svg.setAttribute('width',width);svg.setAttribute('height',height);
 const map=new Map([...root.querySelectorAll('.prog-node[data-node]')].map(el=>[el.dataset.node,el]));
 svg.replaceChildren();
 for(const element of map.values()){
  const parent=map.get(element.dataset.requires);if(!parent)continue;
  const p=parent.getBoundingClientRect(),c=element.getBoundingClientRect();
  const x1=p.left-rect.left+p.width/2+root.scrollLeft,y1=p.bottom-rect.top+root.scrollTop;
  const x2=c.left-rect.left+c.width/2+root.scrollLeft,y2=c.top-rect.top+root.scrollTop;
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  const dy=Math.max(14,Math.abs(y2-y1)*.45);
  path.setAttribute('d',`M${x1},${y1} C${x1},${y1+dy} ${x2},${y2-dy} ${x2},${y2}`);
  path.setAttribute('class',element.dataset.status==='mastered'?'mastered':'');svg.append(path);
 }
}
