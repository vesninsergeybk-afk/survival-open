import {warFronts} from './war-fronts.js?v=campaign-1-repair-qa-1';
import {regionAt,REGIONS,REGION_LIMIT} from './regions.js?v=regions-audit-1';

const enc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function campaignProgress(world){
 const fronts=warFronts(world),secured=fronts.filter(f=>f.outcome);
 return {fronts,secured:secured.length,total:fronts.length,
  complete:fronts.length===4&&secured.length===4};
}
export function campaignDestination(game,key){
 const front=warFronts(game.world).find(f=>f.key===key);
 if(!front||front.outcome)return null;
 const desired=!front.working?front.depot:front.source;
 const station=desired?.discovered?desired:front.depot?.discovered?front.depot:null;
 if(station)return {id:station.id,x:station.x,y:station.y,label:station.title||front.name};
 const region=REGIONS.find(r=>r.id===(key==='north'&&!front.working?'lilac':front.regions[0]));
 return {id:'region-'+region.id,...region.survey,label:region.name};
}

// Time unlocks formations, but cannot erase the military effect of a blockade.
// Geography retains different baseline danger; funded ships and retaliation
// are added by the existing, resource-backed industrial systems.
export function regionalCampaignPressure(director,world,player){
 if(!world?.regionalSupply||!director.types?.length||Math.hypot(player.x,player.y)>REGION_LIMIT)return director;
 const region=regionAt(player.x,player.y).id;
 // The first theatre keeps its more detailed home-conflict director.
 if(region==='amethyst'&&world.home&&Math.hypot(player.x-world.home.x,player.y-world.home.y)<=10500)return director;
 const front=warFronts(world).find(f=>f.regions.includes(region));if(!front)return director;
 const base=region==='amethyst'?{cap:18,interval:6.2}:region==='lilac'?{cap:28,interval:4.8}:{cap:23,interval:5.4};
 const effect=front.outcome==='captured'?{cap:Math.ceil(base.cap*.5),interval:base.interval*1.8}:
  front.outcome==='starved'?{cap:Math.ceil(base.cap*.65),interval:base.interval*1.5}:
  !front.working?{cap:base.cap-3,interval:base.interval*1.15}:base;
 return {...director,cap:Math.min(director.cap,effect.cap),
  interval:Math.max(director.interval,effect.interval),groupSize:Math.min(3,director.groupSize)};
}

export function campaignVisible(game){
 const s=game.world?.regionalSupply;
 return !!s&&(s.central?.conflict?.offeredAt!=null||warFronts(game.world).some(f=>f.known));
}
export function campaignCue(game){
 if(!campaignVisible(game))return '';
 const p=campaignProgress(game.world);
 if(p.complete)return 'ЦЕЛЬ ДОСТИГНУТА · четыре промышленные сети подавлены';
 const current=regionAt(game.player.x,game.player.y).id;
 const front=p.fronts.find(f=>f.regions.includes(current));
 if(front?.known)return (front.outcome?'РЕГИОН ОСЛАБЛЕН':'ЦЕЛЬ РЕГИОНА')+' · '+
  (front.outcome?'новые промышленные отряды остановлены':front.working?'остановите снабжение или захватите сборку':'исчерпайте оставшиеся грузы и резервы');
 return 'ЦЕЛЬ ПРОХОЖДЕНИЯ · подавить промышленные сети · '+p.secured+'/4';
}

/** Show only events the pilot caused or stations they have already surveyed.
 * Internal enemy production and unknown cargo locations are not telemetry. */
export function campaignConsequences(world){
 return warFronts(world).filter(f=>f.known).map(f=>{
  const actions=[];
  if((f.pool?.intercepted||0)>0)
   actions.push('перехвачено грузов: '+f.pool.intercepted);
  if((f.pool?.repairsIntercepted||0)>0)
   actions.push('сорвано ремонтных рейсов: '+f.pool.repairsIntercepted);
  if(f.outcome==='captured')
   actions.push('сборочный узел захвачен; выпуск новых промышленных отрядов остановлен');
  else if(f.outcome==='starved')
   actions.push('сырьё и готовые резервы исчерпаны; новые отряды не выпускаются');
  else if(f.source?.captured)
   actions.push('добыча остановлена, но ранее доставленные материалы ещё опасны');
  if(!actions.length)return null;
  return {key:f.key,name:f.name,actions};
 }).filter(Boolean);
}

export function renderCampaignProgress(game,{compact=false}={}){
 if(!campaignVisible(game))return '';
 const p=campaignProgress(game.world),current=regionAt(game.player.x,game.player.y).id;
 const local=p.fronts.find(f=>f.regions.includes(current));
 const status=f=>!f.known?'источник и сборка не разведаны':f.outcome==='captured'?'сборочный узел захвачен':
  f.outcome==='starved'?'снабжение исчерпано':!f.working?'добыча остановлена, запасы ещё опасны':
  'производство действует';
 const rows=p.fronts.map(f=>{
  const target=campaignDestination(game,f.key);
  // A regional survey point is public geography, never a hidden station.
  return '<article class="campaign-front"><div><strong>'+enc(f.name)+'</strong><small>'+enc(status(f))+'</small></div>'+
   (f.outcome?'<span>✓</span>':'<button type="button" data-act="campaignFront" data-role="'+f.key+'">'+
    (target?.id.startsWith('region-')?'Разведать регион':target?.id===f.depotId?'К сборочному узлу':'К источнику снабжения')+'</button>')+'</article>';
 }).join('');
 const localStatus=local?.known&&!local.outcome?'<p>'+enc(local.name)+': '+enc(status(local))+'. '+
  (local.depot?.discovered?'Оставшихся партий: '+local.pool.reserves+'. ':'')+
  'Перехват отменяет усиление из одной поставки; захват сборочного узла прекращает все его будущие вылеты.</p>':'';
 const title=p.complete?'Промышленный натиск подавлен':'Подавить четыре промышленные сети';
 const consequences=campaignConsequences(game.world);
 const evidence=consequences.length?'<details class="campaign-consequences"><summary>Что изменили Ваши действия · '+
  consequences.length+'</summary><ul>'+consequences.map(c=>'<li><strong>'+enc(c.name)+
  '</strong>: '+enc(c.actions.join('; '))+'.</li>').join('')+'</ul></details>':'';
 const text='<p>'+(p.complete?'Все четыре сети лишились возможности создавать новые отряды. Уже выпущенные корабли и фоновые патрули остаются в мире. Можно продолжать исследование.':
   'Лишите четыре промышленные сети возможности выпускать отряды. Подавленный регион станет спокойнее и даст опору для следующей вылазки.')+'</p>'+localStatus;
 const tip='<p>Вы сами выбираете порядок. В новом регионе лаборатория поможет найти производство, арсенал даст прицельный огонь, авианосец — ударную поддержку. Стыковка закрепляет результат.</p>';
 if(compact)return '<details class="campaign-progress" aria-label="Цель прохождения"><summary>'+enc(title)+' · '+p.secured+'/4</summary>'+text+evidence+rows+tip+'</details>';
 return '<section class="campaign-progress" aria-label="Цель прохождения"><div class="campaign-heading"><span class="base-kicker">'+
  (p.complete?'ПРОМЫШЛЕННЫЙ НАТИСК ПОДАВЛЕН':'ЦЕЛЬ ПРОХОЖДЕНИЯ')+'</span><strong>'+p.secured+'/4</strong></div>'+
  text+evidence+
  '<details'+(!compact&&local?.outcome?' open':'')+'><summary>Выбрать следующую цель</summary>'+rows+
  tip+'</details></section>';
}
