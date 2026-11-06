import test from 'node:test';
import assert from 'node:assert/strict';
import {menuFocusables,keepTabInMenu} from '../menu-dialog.js';
import {renderShipHangar} from '../hangar-panel.js';
import {renderBasePanel} from '../base-panel.js';
import {renderWorldMap} from '../map-panel.js';
import {createLoadout,HangarSession} from '../ship-loadout.js';
import {createTactical} from '../tactical-fields.js';
import {DEFAULT_CONTROLS} from '../control-layout.js';
import {game} from './weapons-scene.mjs';

const context=(extra={})=>({loadout:createLoadout(),baseActive:true,level:1,ore:20,
 points:0,activeBases:1,tactical:createTactical(),...extra});

test('keyboard navigation skips closed disclosures and nonselected tab stops',()=>{
 const doc={activeElement:null},make=(name,tabindex=null)=>({name,disabled:false,tagName:'BUTTON',
  closest:()=>null,getClientRects:()=>[{}],getAttribute:key=>key==='tabindex'?tabindex:null,
  focus(){doc.activeElement=this;}});
 const current=make('current','0'),otherTab=make('other tab','-1'),summary=make('summary'),hidden=make('hidden purchase'),
  nested=make('nested summary'),last=make('close');
 summary.tagName='SUMMARY';nested.tagName='SUMMARY';
 const disclosure={tagName:'DETAILS',open:false,children:[summary,hidden]};
 summary.parentElement=hidden.parentElement=disclosure;
 nested.parentElement={tagName:'DETAILS',open:false,children:[nested],parentElement:disclosure};
 const dialog={ownerDocument:doc,querySelectorAll:()=>[current,otherTab,summary,hidden,nested,last]};
 assert.deepEqual(menuFocusables(dialog).map(n=>n.name),['current','summary','close']);
 const overlay={querySelector:s=>s==='.dialog'?dialog:null};
 current.focus();keepTabInMenu({key:'Tab',preventDefault(){}},overlay);assert.equal(doc.activeElement,summary);
 keepTabInMenu({key:'Tab',preventDefault(){}},overlay);assert.equal(doc.activeElement,last);
 disclosure.open=true;assert.ok(menuFocusables(dialog).includes(hidden));
});

test('an unavailable loaded blueprint cannot advertise a free replacement',()=>{
 const state=context(),session=new HangarSession();session.begin(state.loadout);
 session.draft.slots[1]='rail';const before=JSON.stringify(session.draft);
 const html=renderShipHangar(state,session),bar=html.split('aria-label="Подтверждение оснащения"')[1].split('class="hg-layout')[0];
 assert.match(bar,/Нужен уровень 3/);assert.doesNotMatch(bar,/замена бесплатна/);
 assert.equal(JSON.stringify(session.draft),before);assert.equal(state.ore,20);
 assert.match(bar,/data-act="hgApply"[^>]* disabled/);
});

test('a priced blueprint reports a shortfall, then uses exactly that alloy when applied',()=>{
 const state=context({level:3,ore:5}),session=new HangarSession();session.begin(state.loadout);
 session.draft.slots[1]='rail';
 const html=renderShipHangar(state,session),bar=html.split('aria-label="Подтверждение оснащения"')[1].split('class="hg-layout')[0];
 assert.match(bar,/Изготовление: 36 сплава/);assert.match(bar,/Не хватает 31/);
 assert.doesNotMatch(bar,/останется 0/,'an impossible purchase should show its shortage, not a fictitious resulting balance');
 assert.equal(session.dispatch({act:'hgApply'},state),undefined);assert.equal(state.ore,5);
 const applied=session.dispatch({act:'hgApply'},{...state,ore:40});
 assert.equal(applied.ore,4);assert.equal(applied.loadout.slots[1],'rail');
});

test('hangar instructions use the actual control assignments and the correct lifetime of upgrades',()=>{
 const controls={...DEFAULT_CONTROLS,field:'KeyG',cease:'KeyH',railMode:'KeyJ',howitzer:'KeyK'};
 const state=context({level:14,ore:400,controls}),session=new HangarSession();session.begin(state.loadout);
 let html=renderShipHangar(state,session);
 assert.match(html,/H отключает автоогонь/);assert.match(renderShipHangar({...state,developmentMode:true,developmentCategory:'weapons'},session),/до конца прохождения/);
 assert.doesNotMatch(html,/до конца вылета|новом вылете|C отключает/);
 for(const [id,label] of [['ion','G'],['resonator','G'],['rail','J'],['howitzer','K']]){
  session.dispatch({act:'hgFocusWeapon',id},state);html=renderShipHangar(state,session);
  const description=html.split('class="hg-weapon-description">')[1].split('</p>')[0];
  assert.match(description,new RegExp('(^|[^A-Z])'+label+'([^A-Z]|$)'));
  assert.doesNotMatch(description,/Space|по умолчанию/);
 }
 const tactical=renderShipHangar({...state,developmentMode:true,developmentCategory:'tactics'},session);
 assert.match(tactical,/до конца прохождения/);
});

test('returning to the fitting list preserves the selected module and pending design',()=>{
 const state=context({level:3,ore:100}),session=new HangarSession();session.begin(state.loadout);
 session.dispatch({act:'hgSlot',id:'1'},state);session.dispatch({act:'hgFocusWeapon',id:'rail'},state);
 session.draft.slots[1]='rail';const before=JSON.stringify(session.draft);
 const html=renderShipHangar(state,session);
 assert.match(html,/data-act="hgCatalog"[^>]*>← К списку оружия/);
 session.dispatch({act:'hgCatalog'},state);
 assert.equal(session.focusWeapon,'rail');assert.equal(JSON.stringify(session.draft),before);assert.equal(state.ore,100);
});

for(const [label,extra,expected] of [
 ['hostile',{enemy:true,discovered:true},/Захватите/],
 ['suppressed',{active:true,enemy:false,discovered:true,suppressed:true},/Дождитесь восстановления/],
 ['inactive friendly',{enemy:false,discovered:true},/Включите/],
 ['unknown',{enemy:true,discovered:false},/Разведайте/]
])test('station and map explain the action for a '+label+' candidate without exposing hidden ownership',()=>{
 const g=game(),home=g.docked;
 const candidate={id:'audit:next',type:'arsenal',x:home.x+400,y:home.y+300,active:false,suppressed:false,...extra};
 g.world.stations.set(candidate.id,candidate);g.world.nearbyStations=()=>[home,candidate];
 const station=renderBasePanel(home,{...g.baseState(),baseTab:'network'}).split('aria-label="Связь и территория"')[1].split('<details')[0];
 assert.match(station,expected);
 g.mapView='territory';g.contourRegion='amethyst';g.contourFirst=g.contourSelection=home.id;
 const map=renderWorldMap(g).split('СЛЕДУЮЩЕЕ ДЕЙСТВИЕ')[1];
 assert.match(map,expected);
 if(!extra.discovered){
  assert.doesNotMatch(station,/Захватите|вражеск/i);assert.doesNotMatch(map,/Захватите|вражеск/i);
 }
});
