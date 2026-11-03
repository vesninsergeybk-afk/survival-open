import {buildSkillTree,skillChoice} from './skill-tree.js?v=design-127';
import {skillChange} from './skill-presentation.js?v=ui-980';

/** Four legible choices, one confirmation. No campaign-map tabs in the tutorial. */
export function showPrologueSkills(ui,player,onPick,options={}){
    const preview=!!options.preview,game=ui.game,network=options.network??game.friendlyBases;
    const mission=options.missionRules??game.activeMission;
    const tree=buildSkillTree(player,network,mission),root=ui.els.upgradeOptions;
    const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;
        if(text!==undefined)e.textContent=text;return e;};
    ui._skillResizeObserver?.disconnect();ui._drawSkillLinks=null;
    ui._skillOriginalParent??=ui.els.levelUpMenu.parentElement;ui._rehomeSkillOverlay();
    ui.els.levelUpMenu.classList.remove('skill-tree-mode');
    ui.els.levelUpMenu.classList.add('prologue-skills-mode');root.replaceChildren();
    const title=document.getElementById('levelUpTitle');if(title)title.textContent='Оснащение инженерного корвета';
    const note=ui.els.levelUpTechNote;if(note){note.style.display='block';
        note.textContent=preview?'Пролог · четыре улучшения, три выбора за миссию':
            'Выберите одно улучшение · полёт на паузе · выбор '+Math.min(3,(player.trainingSpent||0)+1)+' из 3';}
    const grid=el('div','prologue-upgrade-grid'),detail=el('section','prologue-upgrade-detail');
    detail.setAttribute('aria-live','polite');
    const heading=el('h3'),body=el('p'),stats=el('p','prologue-upgrade-stats');
    const confirm=el('button','btn primary','Установить и продолжить');confirm.type='button';
    const buttons=[];let selected=null,picked=false;
    const select=(node,button)=>{
        selected=node;for(const b of buttons)b.setAttribute('aria-pressed',String(b===button));
        heading.textContent=node.def.icon+' '+node.def.name;body.textContent=node.def.description;
        stats.textContent=node.state==='available'?skillChange(node,player).map(c=>
            c.label+': '+c.before+' → '+c.after).join(' · '):node.reason;
        confirm.hidden=preview;confirm.disabled=node.state!=='available'||picked;
    };
    for(const node of tree.branches[0].tiers[0]){
        const b=el('button','prologue-upgrade-card '+node.state);b.type='button';
        b.dataset.skill=node.kind+':'+node.id;b.setAttribute('aria-pressed','false');
        b.append(el('span','prologue-upgrade-icon',node.def.icon),el('strong','',node.def.name),
            el('small','',node.state==='maxed'?'✓ Установлено':node.state==='locked'?node.reason:
                node.kind==='weapon'?'Двойной залп · ближний бой':node.id==='shield_core'?'+28 щита':
                    node.id==='movespeed'?'+10% скорости':'Дешевле и быстрее чинить орудия'));
        b.onclick=()=>select(node,b);buttons.push(b);grid.append(b);
    }
    confirm.onclick=()=>{
        if(picked||preview||!selected)return;
        const choice=skillChoice(player,network,selected.kind,selected.id,null,mission);
        if(!choice)return;picked=true;confirm.disabled=true;onPick(choice);
    };
    detail.append(heading,body,stats,confirm);root.append(grid,detail);
    if(preview){const close=el('button','btn',options.closeLabel||'← К паузе');close.onclick=()=>options.onClose?.();root.append(close);}
    ui.els.levelUpMenu.style.display='flex';
    const first=tree.branches[0].tiers[0].findIndex(n=>n.state==='available');
    const index=Math.max(0,first);select(tree.branches[0].tiers[0][index],buttons[index]);buttons[index].focus({preventScroll:true});
}
