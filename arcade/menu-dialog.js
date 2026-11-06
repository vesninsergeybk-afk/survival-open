// Shared keyboard behavior for the game's custom modal panels. The flight UI
// stays out of keyboard navigation while a station, map or skill panel is open.
const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
const inertBackground=new WeakMap();

const visible=element=>{
 if(!element||element.disabled||element.closest?.('[hidden],[inert]'))return false;
 // Chromium can still return layout rectangles for descendants of a closed
 // details element. Only its own summary belongs to the live menu.
 for(let parent=element.parentElement;parent;parent=parent.parentElement){
  if(parent.tagName==='DETAILS'&&!parent.open){
   const summary=[...parent.children].find(child=>child.tagName==='SUMMARY');
   if(!summary||(summary!==element&&!summary.contains?.(element)))return false;
  }
 }
 return typeof element.getClientRects!=='function'||element.getClientRects().length>0;
};

export function activeMenuDialog(overlay){
 return overlay?.querySelector?.('.run-confirm')||overlay?.querySelector?.('.departure-confirm')||
  overlay?.querySelector?.('.base-module-confirm')||overlay?.querySelector?.('.dialog')||null;
}

export function menuFocusables(dialog){
 return dialog?[...dialog.querySelectorAll(FOCUSABLE)].filter(element=>
  visible(element)&&!(Number(element.getAttribute?.('tabindex'))<0)):[];
}

export function focusMenu(overlay,selector=''){
 const dialog=activeMenuDialog(overlay);
 if(!dialog)return null;
 const preferred=selector?dialog.querySelector(selector):null;
 const target=(visible(preferred)?preferred:null)||menuFocusables(dialog)[0]||dialog;
 if(target===dialog&&!dialog.hasAttribute?.('tabindex'))dialog.setAttribute?.('tabindex','-1');
 target.focus?.({preventScroll:true});
 return target;
}

export function keepTabInMenu(event,overlay){
 if(event.key!=='Tab'&&event.code!=='Tab')return false;
 const dialog=activeMenuDialog(overlay);
 if(!dialog)return false;
 const items=menuFocusables(dialog),current=dialog.ownerDocument?.activeElement;
 event.preventDefault();
 if(!items.length){dialog.focus?.({preventScroll:true});return true;}
 const index=items.indexOf(current);
 const next=index<0?(event.shiftKey?items.length-1:0):
  (index+(event.shiftKey?-1:1)+items.length)%items.length;
 items[next].focus?.({preventScroll:true});
 items[next].scrollIntoView?.({block:'nearest',inline:'nearest'});
 return true;
}

export function captureMenuControl(overlay){
 const element=overlay?.ownerDocument?.activeElement;
 if(!element||!overlay.contains?.(element)||!element.dataset?.act)return null;
 return {act:element.dataset.act,id:element.dataset.id||'',role:element.dataset.role||''};
}

export function restoreMenuControl(overlay,identity,fallback=''){
 if(identity){
  const found=[...overlay.querySelectorAll('[data-act]')].find(element=>
   element.dataset.act===identity.act&&(element.dataset.id||'')===identity.id&&
   (element.dataset.role||'')===identity.role&&visible(element));
  if(found){found.focus({preventScroll:true});return found;}
 }
 return focusMenu(overlay,fallback);
}

export function setMenuBackgroundInert(overlay,on){
 const body=overlay?.ownerDocument?.body;
 if(!body)return;
 if(on){
  if(inertBackground.has(overlay))return;
  const marked=[];
  for(const child of body.children){
   // The orientation/fullscreen prompt and native credits dialog have their
   // own modality and can appear independently of the game panel.
   if(child===overlay||child.id==='mobileLaunch'||child.id==='creditsDialog'||child.id==='gameMenuDialog'||child.inert)continue;
   child.inert=true;marked.push(child);
  }
  inertBackground.set(overlay,marked);
 }else{
  for(const child of inertBackground.get(overlay)||[])child.inert=false;
  inertBackground.delete(overlay);
 }
}
