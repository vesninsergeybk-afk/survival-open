import {menuHints} from './menu-hints.js?v=direct-fit-2-menu-focus-1';
import {createLoadout,HangarSession,PREVIEW_BLUEPRINT_KEY} from './ship-loadout.js?v=weapons-cycle-2-campaign-1-direct-fit-2-menu-flow-2-menu-focus-1-tactical-slot-20261110-manual-hardpoints-20261111';
import {captureHangarView,restoreHangarView} from './hangar-view.js?v=hangar-2-menu-rebuild-1-menu-audit-1-semantic-1-devscroll-1';
import {renderShipHangar} from './hangar-panel.js?v=menu-exit-1-campaign-1-tactical-field-1-direct-fit-2-orbital-terminal-1-menu-flow-2-menu-focus-1-menu-reaudit-1-menu-rebuild-1-development-tree-1-devux-3-menu-audit-1-semantic-1-tactical-slot-20261110-space-impact-20261110-manual-hardpoints-20261111';
import {createTactical,applyTacticalChoice} from './tactical-fields.js?v=tactical-field-3-space-impact-20261110';

let context,session;
function setup(advanced){
 const loadout=createLoadout();
 if(advanced){loadout.frame=4;loadout.slots=['plasma','rail','flak','rocket',null,'howitzer'];loadout.manualSlots=['ion',null];
  loadout.owned={plasma:2,rail:1,flak:1,rocket:1,howitzer:1};}
 context={loadout,baseActive:true,level:advanced?14:1,ore:advanced?400:60,
  hangarView:'weapons',tactical:createTactical(),
  points:advanced?20:0,activeBases:advanced?3:0,
  skillRanks:advanced?{beam:2,double:1,range:1,rocket:1}:{},
  fieldLoan:advanced?{moduleId:'ion',charges:3,used:0,cooldownUntil:0}:null};
 // Deliberately isolated: the visual test does not modify saved game blueprints.
 let storage=null;try{storage=window.localStorage;}catch{}
 session=new HangarSession(storage,PREVIEW_BLUEPRINT_KEY);session.begin(loadout);render();
}
function render(){
 const root=document.getElementById('hangar'),view=captureHangarView(root);
 root.innerHTML=(context.developmentMode?'<button type="button" data-act="previewFitting">← К оснащению</button>':'')+renderShipHangar(context,session)+
  (context.hangarView==='services'?'<p class="hg-view-note">Это стенд оснащения. Ремонт, дроны и услуги доступны на действующей станции в игре.</p>':'')+
  (context.hangarView==='upgrades'?'<p class="hg-view-note">Здесь можно испытать расширение корпуса. Остальные навыки развития зависят от уровня пилота в игре.</p>':'');
 restoreHangarView(root,view);menuHints(root);
}
document.addEventListener('click',e=>{
 const mode=e.target.closest('[data-preview]');if(mode){setup(mode.dataset.preview==='advanced');return;}
 const b=e.target.closest('button[data-act]');if(!b||b.disabled)return;
 if(b.dataset.act==='openDevelopment'){context.developmentMode=true;context.developmentCategory=b.dataset.id;render();return;}
 if(b.dataset.act==='previewFitting'||b.dataset.act==='fitWeapon'){context.developmentMode=false;render();return;}
 if(b.dataset.act==='hgView'){
  if(['weapons','tactics','upgrades','services'].includes(b.dataset.id)){
   context.hangarView=b.dataset.id;render();
   document.querySelector('.hg-view-nav [aria-pressed="true"]')?.focus({preventScroll:true});
  }
  return;
 }
 if(['hgTacticEquip','hgTacticUnlock','hgTacticUpgrade'].includes(b.dataset.act)){
  const action={hgTacticEquip:'equip',hgTacticUnlock:'unlock',hgTacticUpgrade:'upgrade'}[b.dataset.act];
  const [id,path]=String(b.dataset.id||'').split(':');
  const choice=applyTacticalChoice(context.tactical,action,id,{path,baseActive:true,
   level:context.level,activeBases:context.activeBases,ore:context.ore,points:context.points});
  if(choice.ok){context.tactical=choice.state;context.ore=choice.ore;context.points=choice.points;}
  session.message=choice.ok?'Устройство обновлено в стенде':choice.reason;
  render();return;
 }
 const result=session.dispatch(b.dataset,{...context,ranks:context.skillRanks});
 if(b.dataset.act==='hgSlot'&&(session.slot>=6?session.draft.manualSlots[session.slot-6]:session.draft.slots[session.slot]))session.catalog=false;
 if(result?.ok){context.loadout=result.loadout;context.ore=result.ore;
  if(result.type==='specialization')context.points=result.points;}
 render();
 if(matchMedia('(max-width:700px)').matches&&['hgSlot','hgShip','hgInstall','hgSelect','hgCatalog'].includes(b.dataset.act))
  window.scrollTo({top:0,behavior:'instant'});
 if(b.dataset.act==='hgCatalog'){
  document.querySelector('.hg-arsenal [data-act="hgFocusWeapon"][aria-pressed="true"]')?.focus({preventScroll:true});
  document.querySelector('.hg-arsenal')?.scrollIntoView({block:'start'});
 }
});
setup(true);
