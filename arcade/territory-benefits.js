import {contourFields,fieldAt} from './territory-system.js';
import {trialBlockingField,pendingContourTrials,readyContourTrials,planContourTrial} from './contour-trials.js?v=swarm-siege-1';
import {firstContourPlan} from './contour-plan.js';

export const TERRITORY_BENEFITS=Object.freeze([
 {id:'shield',name:'Контурный щит',effect:'В своей защищённой территории щит восстанавливается на 18 ед. сверх обычного предела, после 4 с без попаданий.'},
 {id:'dash',name:'Контурный форсаж',effect:'В своей защищённой территории рывок перезаряжается на 30% быстрее.'},
 {id:'salvage',name:'Энергосбор',effect:'В своей защищённой территории радиус притяжения добычи увеличен на 60 м.'}
]);

export function territoryBenefits(world,player){
 const completed=world?.contours?.trials?.completed||0;
 const field=world?.contours&&player?fieldAt(world,player.x,player.y):null;
 const inside=!!field&&!trialBlockingField(world,field)&&completed>0;
 return {completed,inside,field:inside?field:null,
  shieldBonus:inside?18:0,dashRate:inside&&completed>=2?1.3:1,
  magnetBonus:inside&&completed>=3?60:0,
  unlocked:TERRITORY_BENEFITS.slice(0,Math.min(3,completed))};
}

export function updateTerritoryBenefits(game,dt){
 const benefit=territoryBenefits(game.world,game.player);
 game.territorySupport=benefit;
 if(game.dead||game.paused||!(dt>0)||!benefit.inside||
  game.time-(game.lastDamageAt??-Infinity)<4)return benefit;
 const ordinary=game.skillRanks?.shield?16+game.skillRanks.shield*24:0;
 const cap=ordinary+benefit.shieldBonus;
 if(game.player.shield<cap)game.player.shield=Math.min(cap,game.player.shield+3*dt);
 return benefit;
}

export function territoryNextStep(world,player={x:0,y:0}){
 const fields=world?.contours?contourFields(world):[];
 const ready=readyContourTrials(world).filter(e=>fieldAt(world,e.x,e.y,fields))
  .sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0];
 if(ready)return {pending:ready,title:'Запустите защищённую воронку',
  description:'Все три волны отражены. Подлетите к красному ядру и удерживайте E около 2 секунд. Только после этого сборщики начнут доставлять флюкс.'};
 const waiting=pendingContourTrials(world);
 const pending=waiting.filter(e=>fieldAt(world,e.x,e.y,fields)).sort((a,b)=>
  Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0];
 const completed=world?.contours?.trials?.completed||0;
 const next=TERRITORY_BENEFITS[Math.min(completed,2)];
 if(pending){
  const waves=planContourTrial(pending.tier,pending.id).waves.length;
  return {pending,title:'Защитите новый треугольник',
   description:'Подлетите к оранжевому знаку !. Нападение начнётся автоматически: '+waves+
    (waves===1?' волна. ':' волны. ')+(completed<3?'Новая возможность: '+next.name+'. ':'Расширится территория действия ваших сетевых способностей. ')+
    'После трёх волн удерживайте E у ядра, чтобы запустить добычу.'};
 }
 if(waiting.length)return {pending:null,blocked:true,title:'Восстановите опорные станции',
  description:'Новое поле потеряло питание. На карте контуров найдите отключённые или подавленные станции и восстановите их. Пока связи не работают, оборона не начнётся.'};
 const plan=!fields.length&&world?.stations?firstContourPlan(world,[...world.stations.values()],world.home?.id,player):null;
 return {pending:null,title:fields.length?'Расширяйте защищённую территорию':'Соберите первый треугольник',
  description:fields.length?'Включайте соседние станции. Новая область потребует обороны и расширит зону действия сетевых способностей.':
   (plan?'В ближайшем плане работают '+plan.active+' из 3 станций. ':'')+
   'Включите или захватите три соседние станции. Допустимые связи замкнутся сами. Затем отразите нападение и получите контурный щит.'};
}

export function renderTerritoryProgress(world,player,{map=false}={}){
 const step=territoryNextStep(world,player),benefit=territoryBenefits(world,player);
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return '<section class="territory-progress" aria-label="Следующий шаг захвата территории"><span class="base-kicker">ТЕРРИТОРИЯ · ЗАЩИЩЕНО '+benefit.completed+'</span><h3>'+step.title+'</h3><p>'+step.description+'</p>'+
  (step.pending?'<button type="button" data-act="'+(map?'trialWaypoint':'trialRoute')+'" data-id="'+step.pending.id+'">'+(step.pending.status==='ready'?'Проложить курс к запуску':map?'Проложить курс к обороне':'Показать место обороны')+'</button>':
   '<button type="button" '+(map?'data-act="mapView" data-id="'+(step.blocked?'territory':'map')+'"':'data-act="baseContours"')+'>'+(step.blocked?'Открыть контуры':'Посмотреть соседние станции')+'</button>')+
  (benefit.unlocked.length?'<details class="territory-unlocked"><summary>Сетевые способности · '+benefit.unlocked.length+'</summary>'+benefit.unlocked.map(b=>'<p><b>'+esc(b.name)+'</b> · '+esc(b.effect)+'</p>').join('')+'</details>':'')+'</section>';
}
