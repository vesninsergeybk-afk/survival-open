import {createLoadout,HangarSession,PREVIEW_BLUEPRINT_KEY} from './ship-loadout.js?v=hangar-2';
import {captureHangarView,restoreHangarView} from './hangar-view.js?v=hangar-2';
import {renderShipHangar} from './hangar-panel.js?v=menus-gameplay-first-1';

let context,session;
function setup(advanced){
 const loadout=createLoadout();
 if(advanced){loadout.frame=4;loadout.slots=['plasma','rail','flak','rocket','ion','howitzer'];
  loadout.owned={plasma:2,rail:1,flak:1,rocket:1,howitzer:1};}
 context={loadout,baseActive:true,level:advanced?14:1,ore:advanced?400:60,
  points:advanced?20:0,activeBases:advanced?3:0,
  skillRanks:advanced?{beam:2,double:1,range:1,rocket:1}:{},
  ionLoan:advanced?{charges:3}:null};
 // Deliberately isolated: the visual test does not modify saved game blueprints.
 let storage=null;try{storage=window.localStorage;}catch{}
 session=new HangarSession(storage,PREVIEW_BLUEPRINT_KEY);session.begin(loadout);render();
}
function render(){
 const root=document.getElementById('hangar'),view=captureHangarView(root);
 root.innerHTML=renderShipHangar(context,session);restoreHangarView(root,view);
}
document.addEventListener('click',e=>{
 const mode=e.target.closest('[data-preview]');if(mode){setup(mode.dataset.preview==='advanced');return;}
 const b=e.target.closest('button[data-act]');if(!b||b.disabled)return;
 const result=session.dispatch(b.dataset,{...context,ranks:context.skillRanks});
 if(result?.ok){context.loadout=result.loadout;context.ore=result.ore;
  if(result.type==='specialization')context.points=result.points;}
 render();
 if(matchMedia('(max-width:700px)').matches&&['hgSlot','hgShip','hgInstall','hgSelect','hgCatalog'].includes(b.dataset.act))
  window.scrollTo({top:0,behavior:'instant'});
});
setup(true);
