import {equipModule} from './ship-loadout.js?v=direct-fit-1';
import {fieldLoanOffer,createFieldLoan,missionAssignment} from './field-weapons.js?v=living-world-2-weapon-feel-1-expedition-1-campaign-1';

// Quote borrowing and installation together. A failed fit consumes no trial or alloy.
export function borrowAndFit(base,current,slot,id,context){
 const offer=fieldLoanOffer(base,context,id);
 if(!offer||offer.mode==='return'||offer.reason)return {ok:false,
  reason:offer?.reason||'Прокат доступен в домашнем доке и арсенале'};
 const fieldLoan=createFieldLoan(id,base.id,context.time||0,missionAssignment(context.operation,context.contract));
 const fit=equipModule(current,slot,id,{...context,fieldLoan,ore:context.ore-offer.cost});
 if(!fit.ok)return fit;
 return {...fit,fieldLoan,loanCost:offer.cost,trial:offer.mode==='trial'};
}
