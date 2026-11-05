const controllers=new WeakMap();
// One floating, non-modal explanation for mouse, keyboard and touch.
export function menuHints(root){
 if(!root?.addEventListener||typeof document==='undefined')return;
 if(controllers.has(root)){controllers.get(root)();return;}
 let target=null,popup=null,timer=null;
 const hide=()=>{
  clearTimeout(timer);target?.removeAttribute('aria-describedby');
  popup?.remove();popup=null;target=null;
 };
 const defer=()=>{clearTimeout(timer);timer=setTimeout(hide,180);};
 const show=node=>{
  if(!node?.dataset.help)return;
  clearTimeout(timer);if(node===target&&popup?.isConnected)return;
  hide();target=node;popup=document.createElement('div');
  popup.id='station-help-popup';popup.className='menu-hint-popup';popup.setAttribute('role','tooltip');
  popup.textContent=node.dataset.help;root.append(popup);node.setAttribute('aria-describedby',popup.id);
  const r=node.getBoundingClientRect(),box=popup.getBoundingClientRect();
  const width=document.documentElement.clientWidth,height=document.documentElement.clientHeight;
  popup.style.left=Math.max(8,Math.min(r.left,width-box.width-8))+'px';
  popup.style.top=Math.max(8,r.bottom+8+box.height<=height?r.bottom+8:r.top-box.height-8)+'px';
  popup.addEventListener('pointerenter',()=>clearTimeout(timer));popup.addEventListener('pointerleave',defer);
 };
 root.addEventListener('pointerover',e=>{const node=e.target.closest?.('[data-help]');if(node)show(node);});
 root.addEventListener('pointerout',e=>{if(e.target.closest?.('[data-help]'))defer();});
 root.addEventListener('focusin',e=>{const node=e.target.closest?.('[data-help]');if(node)show(node);else hide();});
 root.addEventListener('focusout',defer);
 root.addEventListener('click',e=>{
  const node=e.target.closest?.('[data-help-only]');
  if(node){e.preventDefault();e.stopPropagation();show(node);}
  else if(!e.target.closest?.('.menu-hint-popup'))hide();
 },true);
 root.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&popup){e.preventDefault();e.stopPropagation();hide();}
 },true);
 root.addEventListener('scroll',e=>{if(!e.target.closest?.('.menu-hint-popup'))hide();},true);
 controllers.set(root,hide);
}
