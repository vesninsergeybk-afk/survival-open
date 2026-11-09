import {GUIDE_LESSONS,GUIDE_BY_ID,GUIDE_STORAGE_KEY,
 normalizeGuideState,recommendGuide,masteryFromSnapshot} from './contextual-guide.js';

const asset=id=>'./assets/learning/'+(GUIDE_BY_ID[id]?.icon||'flight')+'.svg';
const isTouch=()=>globalThis.matchMedia?.('(pointer: coarse)')?.matches||false;

export function guideSnapshot(game,origin){
 const p=game.player||{},trials=game.world?.contours?.trials?.entries||[];
 let enemyNearby=false,heavyNearby=false,swarmCount=0;
 for(const enemy of game.enemies||[]){
  if(enemy.hp<=0||enemy.converted)continue;
  const distance=Math.hypot(enemy.x-p.x,enemy.y-p.y);
  if(distance<520)enemyNearby=true;
  if(distance<720&&enemy.type==='gunship')heavyNearby=true;
  if(distance<650&&enemy.microSwarm)swarmCount++;
 }
 const stationCount=[...(game.world?.stations?.values?.()||[])].filter(b=>b.active).length;
 return {
  blocked:!!game.dead||!!game.paused||game.overlay?.hidden===false||
   !!globalThis.document?.getElementById('gameMenuDialog')?.open||
   globalThis.document?.getElementById('mobileLaunch')?.hidden===false,
  flightTime:game.time||0,distanceMoved:Math.hypot((p.x||0)-origin.x,(p.y||0)-origin.y),
  mined:!!game.miningIntroShown,mining:!!game.mining?.active,
  battle:!!game.contourTrial,threatNearby:enemyNearby,
  heavyNearby,swarmNearby:swarmCount>=3,
  stationCount,points:p.points||0,
  upgraded:Object.values(game.skillRanks||{}).some(rank=>rank>0),
  hasTerritory:trials.length>0,
  pendingContour:trials.some(e=>e.status==='pending'),
  readyCore:trials.some(e=>e.status==='ready'),
  contourCompleted:trials.some(e=>e.status==='complete')
 };
}

function readState(storage){
 try{return normalizeGuideState(JSON.parse(storage?.getItem(GUIDE_STORAGE_KEY)||'{}'));}
 catch{return normalizeGuideState();}
}

export function mountContextualGuide(game,doc=globalThis.document,storage=game.recordStorage){
 if(!game?.player||!doc?.getElementById)return null;
 const card=doc.getElementById('learningTip'),img=doc.getElementById('learningTipImage');
 const title=doc.getElementById('learningTipTitle'),body=doc.getElementById('learningTipBody');
 const progress=doc.getElementById('learningTipProgress'),toggle=doc.getElementById('learningEnabled');
 const list=doc.getElementById('learningArticleList'),article=doc.getElementById('learningArticle');
 const search=doc.getElementById('learningSearch'),reset=doc.getElementById('learningReset');
 if(!card||!list||!article||!toggle||typeof doc.createElement!=='function'||
  typeof list.replaceChildren!=='function'||typeof article.replaceChildren!=='function'||
  typeof toggle.addEventListener!=='function')return null;
 const state=readState(storage),query=globalThis.location?.search||'';
 let hasPreference=false;
 try{hasPreference=storage?.getItem(GUIDE_STORAGE_KEY)!=null;}catch{}
 if(!hasPreference&&new URLSearchParams(query).get('tutorial')==='1')state.enabled=true;
 const origin={x:game.player.x,y:game.player.y},triggered=new Set();
 let active='',activeReplay=false,selected='flight',resetArmed=false,manualReplay='';
 const save=()=>{try{storage?.setItem(GUIDE_STORAGE_KEY,JSON.stringify(state));}catch{}};
 const clearTip=()=>{active='';activeReplay=false;card.hidden=true;};
 const viewArticle=id=>{
  const lesson=GUIDE_BY_ID[id];if(!lesson)return;
  selected=id;
  for(const button of list.querySelectorAll('[data-guide-id]')){
   const current=button.dataset.guideId===id;
   button.setAttribute('aria-current',current?'true':'false');
  }
  article.replaceChildren();
  const head=doc.createElement('div');head.className='learning-article-head';
  const picture=doc.createElement('img');picture.src=asset(id);picture.alt='';
  const words=doc.createElement('div'),overline=doc.createElement('span');
  overline.className='learning-eyebrow';overline.textContent=lesson.group;
  const h=doc.createElement('h3');h.textContent=lesson.title;
  words.append(overline,h);head.append(picture,words);
  const summary=doc.createElement('p');summary.className='learning-article-summary';summary.textContent=lesson.body;
  const detail=doc.createElement('p');detail.textContent=lesson.detail;
  const foot=doc.createElement('div');foot.className='learning-article-foot';
  const replay=doc.createElement('button');replay.type='button';replay.dataset.guideReplay=id;
  replay.textContent='Повторить подсказку';
  const tag=doc.createElement('span');tag.textContent=state.mastered.includes(id)?
   'Действие выполнено':state.seen.includes(id)?'Подсказка просмотрена':'Можно изучить';
  foot.append(replay,tag);article.append(head,summary,detail,foot);
 };
 const renderList=()=>{
  const value=(search?.value||'').trim().toLocaleLowerCase('ru');list.replaceChildren();
  for(const lesson of GUIDE_LESSONS){
   if(value&&!`${lesson.title} ${lesson.body} ${lesson.group}`.toLocaleLowerCase('ru').includes(value))continue;
   const button=doc.createElement('button');button.type='button';button.dataset.guideId=lesson.id;
   const picture=doc.createElement('img');picture.src=asset(lesson.id);picture.alt='';
   const words=doc.createElement('span'),name=doc.createElement('strong');name.textContent=lesson.title;
   const group=doc.createElement('small');group.textContent=lesson.group;
   words.append(name,group);button.append(picture,words);list.append(button);
  }
  viewArticle(list.querySelector(`[data-guide-id="${selected}"]`)?.dataset.guideId||
   list.querySelector('[data-guide-id]')?.dataset.guideId||selected);
 };
 const enable=value=>{
  state.enabled=!!value;toggle.checked=state.enabled;
  toggle.setAttribute('aria-checked',String(state.enabled));
  if(!state.enabled)clearTip();save();
 };
 const show=(id,forced=false)=>{
  const lesson=GUIDE_BY_ID[id];if(!lesson)return;
  active=id;activeReplay=forced;card.dataset.mode=lesson.mode;
  img.src=asset(id);img.alt='';title.textContent=lesson.title;body.textContent=lesson.body;
  progress.textContent=lesson.group;
  card.hidden=false;
  if(!state.seen.includes(id))state.seen.push(id);
  triggered.delete(id);save();
 };
 const dismiss=()=>{
  clearTip();renderList();
  if(!doc.getElementById('gameMenuDialog')?.open)game.canvas?.focus?.({preventScroll:true});
 };
 doc.getElementById('learningTipClose')?.addEventListener('click',dismiss);
 doc.getElementById('learningTipMore')?.addEventListener('click',()=>{
  const target=active;dismiss();
  // The existing pause dialog owns focus, keyboard handling and game pause.
  if(!game.openLearningJournal)return;
  game.openLearningJournal(target);
 });
 list.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-guide-id]');if(button)viewArticle(button.dataset.guideId);
 });
 article.addEventListener('click',event=>{
  const id=event.target.closest?.('[data-guide-replay]')?.dataset.guideReplay;
  if(!id)return;
  manualReplay=id;save();viewArticle(id);
 });
 search?.addEventListener('input',renderList);
 toggle.addEventListener('change',()=>enable(toggle.checked));
 reset?.addEventListener('click',()=>{
  if(!resetArmed){resetArmed=true;reset.textContent='Подтвердить повтор обучения';return;}
  state.seen=[];state.mastered=[];triggered.clear();clearTip();
  resetArmed=false;reset.textContent='Начать обучение заново';save();renderList();
 });
 game.openLearningJournal=(id='flight')=>{
  const dialog=doc.getElementById('gameMenuDialog');
  if(!dialog?.open)doc.getElementById('menuBtn')?.click();
  const details=dialog?.querySelector('.system-settings');if(details)details.open=true;
  doc.getElementById('settings-tab-learning')?.click();
  viewArticle(GUIDE_BY_ID[id]?id:'flight');
  doc.getElementById('settings-tab-learning')?.focus({preventScroll:true});
 };
 toggle.checked=state.enabled;toggle.setAttribute('aria-checked',String(state.enabled));renderList();
 return {
  state,
  trigger:id=>{if(GUIDE_BY_ID[id]&&!state.seen.includes(id)&&!state.mastered.includes(id))triggered.add(id);},
  update(){
   const snapshot=guideSnapshot(game,origin);
   const mastery=masteryFromSnapshot(snapshot);
   for(const [id,done] of Object.entries(mastery))if(done&&!state.mastered.includes(id))state.mastered.push(id);
   // A squad spawned off-screen is not yet an encounter. Introduce its
   // special tactic only after the enemy actually reaches the pilot.
   if(snapshot.heavyNearby)this.trigger('heavy');
   if(snapshot.swarmNearby)this.trigger('swarm');
   if(snapshot.blocked||!state.enabled){clearTip();return;}
   if(active){
    // Calm advice yields to real combat; warnings are never hidden by a lesson.
    if((state.mastered.includes(active)&&!activeReplay)||(GUIDE_BY_ID[active].mode==='calm'&&
     (snapshot.battle||snapshot.threatNearby||snapshot.mining)))clearTip();
    else return;
   }
   const replaySafe=manualReplay&&(!snapshot.battle||GUIDE_BY_ID[manualReplay]?.mode==='combat')&&
    (!snapshot.threatNearby||GUIDE_BY_ID[manualReplay]?.mode==='combat')&&!snapshot.mining;
   const id=replaySafe?manualReplay:recommendGuide(snapshot,state,[...triggered]);
   if(replaySafe)manualReplay='';
   if(id)show(id,!!replaySafe);
  },
  dispose:clearTip
 };
}
