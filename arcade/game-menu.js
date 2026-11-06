import {DEFAULT_CONTROLS,readableKey} from './control-layout.js?v=unified-controls-1-first-loops-1';
const states=new WeakMap();
export function restoreSystemMenu(game,doc=globalThis.document){
 const prior=states.get(game);if(!prior)return false;
 states.delete(game);game.bindingCapture=null;
 const keys=doc?.getElementById('controlSettings');if(keys)keys.open=false;
 game.paused=game.dead||prior.paused||!game.overlay.hidden;
 game.pausedRenderPending=true;
 if(game.paused)game.heritage.pause(prior.modal||'map');else game.heritage.resume();
 const focus=prior.focus?.isConnected?prior.focus:doc?.getElementById('menuBtn');
 focus?.focus?.({preventScroll:true});return true;
}
export function openSystemMenu(game,doc=globalThis.document){
 const dialog=doc?.getElementById('gameMenuDialog');if(!dialog||dialog.open)return false;
 states.set(game,{paused:game.paused,modal:game.heritage.modal,focus:doc.activeElement});
 game.endInteraction();game.keys.clear();game.paused=true;game.pausedRenderPending=true;
 game.heritage.pause('menu');
 const restricted=game.dead||['run-start','opening-choice','opening-reward'].includes(game.overlay.dataset.mode);
 for(const id of ['systemMap','systemSkills']){const button=doc.getElementById(id);if(button)button.disabled=restricted;}
 const resume=doc.getElementById('systemResume');if(resume)resume.textContent=game.overlay.hidden?'Продолжить полёт':'Вернуться к экрану';
 const keyPanel=doc.getElementById('controlSettings');
 if(keyPanel)keyPanel.open=!!doc.querySelector('[data-settings-tab="keys"][aria-selected="true"]');
 const controls=game.controls||DEFAULT_CONTROLS;
 for(const node of doc.querySelectorAll('[data-control-help]'))node.textContent=node.dataset.controlHelp==='flight'?
  ['up','left','down','right'].map(id=>readableKey(controls[id])).join(' / '):readableKey(controls[node.dataset.controlHelp]);
 dialog.showModal();doc.getElementById('systemResume')?.focus({preventScroll:true});return true;
}
export function closeSystemMenu(game,doc=globalThis.document){
 const dialog=doc?.getElementById('gameMenuDialog');if(!dialog?.open)return false;
 dialog.close();restoreSystemMenu(game,doc);return true;
}
export function mountSystemMenu(game,doc=globalThis.document){
 const dialog=doc?.getElementById('gameMenuDialog');if(!dialog?.addEventListener)return;
 doc.getElementById('menuBtn')?.addEventListener('click',()=>openSystemMenu(game,doc));
 for(const id of ['systemResume','systemClose'])doc.getElementById(id)?.addEventListener('click',()=>closeSystemMenu(game,doc));
 dialog.addEventListener('cancel',e=>{e.preventDefault();closeSystemMenu(game,doc);});
 dialog.addEventListener('close',()=>restoreSystemMenu(game,doc));
 dialog.addEventListener('keydown',e=>e.stopPropagation());
 const tabs=[...doc.querySelectorAll('[data-settings-tab]')];
 const select=button=>{
  for(const b of tabs){b.setAttribute('aria-selected',String(b===button));b.tabIndex=b===button?0:-1;}
  for(const panel of doc.querySelectorAll('[data-settings-pane]'))panel.hidden=panel.dataset.settingsPane!==button.dataset.settingsTab;
  game.bindingCapture=null;
  const keys=doc.getElementById('controlSettings');if(keys)keys.open=button.dataset.settingsTab==='keys';
 };
 for(const button of tabs){
  button.tabIndex=button.getAttribute('aria-selected')==='true'?0:-1;
  button.addEventListener('click',()=>select(button));
  button.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
   e.preventDefault();const i=tabs.indexOf(button),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:
    (i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length;
   select(tabs[next]);tabs[next].focus();
  });
 }
 for(const [id,method] of [['systemMap','openMap'],['systemSkills','skills']])doc.getElementById(id)?.addEventListener('click',()=>{
  if(doc.getElementById(id).disabled)return;closeSystemMenu(game,doc);
  if(game.overlay.dataset.mode===(method==='openMap'?'map':'skills')&&!game.overlay.hidden)return;
  game[method]();
 });
}
export function attachMenuAccess(root){
 const dialog=root?.querySelector?.('.dialog');
 if(!dialog?.ownerDocument?.createElement||dialog.querySelector('[data-act="systemMenu"]'))return;
 const button=dialog.ownerDocument.createElement('button');button.type='button';button.dataset.act='systemMenu';
 button.className='menu-access';button.textContent='Меню';button.setAttribute('aria-haspopup','dialog');
 (dialog.querySelector('.base-footer-actions,.map-heading-actions,.screen-secondary')||dialog).append(button);
}
