import {renderProgressionScreen} from './progression-screen.js?v=progression-art-4-menu-consistency-2-ui-v3';

export const developmentTab=id=>['weapons','ship','tactics','pilot','network'].includes(id)?id:'pilot';

// No "best build" is imposed: these are three different intentions, each
// pointing to an upgrade whose actual level and prerequisite gates are met.
export function availableDevelopmentChoices(state){
 const upgrades=state.hangarUpgrades||[],ranks=state.skillRanks||{},level=state.level||1;
 const choose=(ids,source)=>ids.map(id=>source.find(s=>s.id===id)).find(Boolean);
 const slots=state.loadout?.slots||[];
 // Range and split beams only affect plasma; otherwise a shortcut could
 // propose a rank that changes nothing on the current ship.
 const weapon=choose(['beam','range','double','rocket'],upgrades.filter(s=>s.canBuy&&
  (!['range','double'].includes(s.id)||slots.includes('plasma'))));
 const ship=choose(['hull','shield','engine'],upgrades.filter(s=>s.canBuy));
 const pilot=choose(['magnet','mining','extractor','radar'],(state.pilotSkills||[]).filter(s=>
  (ranks[s.id]||0)<s.max&&level>=s.from&&(!s.requires||ranks[s.requires])));
 const mounted=slots.find(id=>['plasma','rail','flak','rocket'].includes(id))||'plasma';
 return [
  weapon&&{intent:'Сильнее атаковать',category:'weapons',focus:weapon.id==='rocket'?'rocket':
   ['range','double'].includes(weapon.id)?'plasma':mounted,
   upgrade:weapon.id,skill:weapon.title,effect:weapon.effect},
  ship&&{intent:'Дольше выживать',category:'ship',focus:ship.id,upgrade:ship.id,skill:ship.title,effect:ship.effect},
  pilot&&{intent:'Быстрее добывать',category:'pilot',focus:pilot.id,upgrade:pilot.id,skill:pilot.title,
   effect:state.nextSkillEffect?.(pilot.id,ranks[pilot.id]||0,ranks)||pilot.desc}
 ].filter(Boolean);
}

// Every shortcut opens the same cards and transactions as this page. The
// navigation never grants an unlock, spends currency or resets a loadout draft.
export const renderDevelopmentPanel=renderProgressionScreen;
