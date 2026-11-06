import test from 'node:test';
import assert from 'node:assert/strict';
import {keepTabInMenu,setMenuBackgroundInert,restoreMenuControl} from '../menu-dialog.js';
import {RuntimeHarness} from './runtime-game.mjs';
import {createLoadout} from '../ship-loadout.js';

function fakeButton(doc,act){
 return {dataset:{act,id:'',role:''},disabled:false,
  closest(){return null;},getClientRects(){return [{}];},
  focus(){doc.activeElement=this;}};
}

test('Tab and Shift+Tab cycle inside a modal without reaching the background',()=>{
 const doc={activeElement:null},buttons=['summary','hangar','close'].map(act=>fakeButton(doc,act));
 const dialog={ownerDocument:doc,querySelectorAll(){return buttons;}};
 const overlay={querySelector(selector){return selector==='.dialog'?dialog:null;}};
 const key=(shiftKey=false)=>{
  let prevented=false;
  assert.equal(keepTabInMenu({key:'Tab',shiftKey,preventDefault(){prevented=true;}},overlay),true);
  assert.equal(prevented,true);
 };
 buttons[2].focus();key();assert.equal(doc.activeElement,buttons[0]);
 key(true);assert.equal(doc.activeElement,buttons[2]);
 doc.activeElement={outside:true};key();assert.equal(doc.activeElement,buttons[0]);
});

test('panel background is inert only while the overlay is open',()=>{
 const overlay={},outside={id:'back',inert:false},launch={id:'mobileLaunch',inert:false},
  credits={id:'creditsDialog',inert:false},already={id:'other',inert:true};
 overlay.ownerDocument={body:{children:[outside,overlay,launch,credits,already]}};
 setMenuBackgroundInert(overlay,true);
 assert.equal(outside.inert,true);
 assert.equal(launch.inert,false);assert.equal(credits.inert,false);
 setMenuBackgroundInert(overlay,false);
 assert.equal(outside.inert,false);assert.equal(already.inert,true);
});

test('a rerender restores the selected live control or falls back safely',()=>{
 const doc={activeElement:null},old=fakeButton(doc,'baseTab'),fallback=fakeButton(doc,'close');
 old.dataset.role='hangar';
 const dialog={ownerDocument:doc,querySelector(selector){return selector==='[data-act="close"]'?fallback:null;},
  querySelectorAll(){return [old,fallback];}};
 const overlay={querySelector(selector){return selector==='.dialog'?dialog:null;},
  querySelectorAll(){return [old,fallback];}};
 restoreMenuControl(overlay,{act:'baseTab',id:'',role:'hangar'});
 assert.equal(doc.activeElement,old);
 restoreMenuControl(overlay,{act:'baseTab',id:'',role:'network'},'[data-act="close"]');
 assert.equal(doc.activeElement,fallback);
});

function stagedExit(mode='base'){
 const loadout=createLoadout(),draft={...loadout,slots:[...loadout.slots]};draft.slots[0]=null;
 const dialog={inert:false,focus(){},querySelector(){return null;},querySelectorAll(){return [];},hasAttribute(){return true;}};
 let confirmation=null,saveCount=0,discardCount=0;
 const overlay={hidden:false,dataset:{mode},querySelector(selector){
   if(selector==='.departure-confirm')return confirmation;
   if(selector==='.dialog')return dialog;
   return null;
  },insertAdjacentHTML(_position,html){
   confirmation={html,focus(){},querySelector(){return null;},querySelectorAll(){return [];},
    hasAttribute(){return true;},remove(){confirmation=null;}};
  }};
 const game=Object.create(RuntimeHarness.prototype);
 Object.assign(game,{overlay,shipLoadout:loadout,docked:{id:'home'},stationExitArmed:true,
  hangarSession:{dirty:()=>draft.slots.some((id,i)=>id!==loadout.slots[i]),begin(){
   draft.slots=[...loadout.slots];discardCount++;
  }},player:{ore:27,data:1,hp:110,level:2},allies:[],time:30,
  heritage:{ui(){},resume(){},pause(){}},saveAtStation(){saveCount++;},
  endInteraction(){},releaseMenu(){},renderDock(){}
 });
 return {game,overlay,dialog,loadout,get confirmation(){return confirmation;},
  get saveCount(){return saveCount;},get discardCount(){return discardCount;}};
}

test('station and map exits protect an unapplied hangar draft, including Escape path',()=>{
 for(const mode of ['base','map','skills']){
  const s=stagedExit(mode);
  assert.equal(s.game.dismiss(),false,'the first exit must ask the pilot');
  assert.equal(s.overlay.hidden,false);
  assert.equal(s.saveCount,0);
  assert.equal(s.dialog.inert,true);
  assert.match(s.confirmation.html,/Вылететь без изменений/);
  s.game.cancelDeparture();
  assert.equal(s.confirmation,null);
  assert.equal(s.dialog.inert,false);
  assert.equal(s.discardCount,0);
  assert.equal(s.game.dismiss(),false,'a second exit still requires confirmation');
  assert.equal(s.game.dismiss(true),true,'only explicit discard allows departure');
  assert.equal(s.overlay.hidden,true);
  assert.equal(s.discardCount,1);
  assert.equal(s.saveCount,1);
  assert.equal(s.game.stationExitArmed,false);
 }
});

test('pilot can return from the map confirmation to the same staged loadout',()=>{
 const s=stagedExit('map');
 s.game.hangarView='services';
 s.game.dismiss();s.game.returnToHangar();
 assert.equal(s.game.baseTab,'hangar');
 assert.equal(s.game.hangarView,'weapons','return to the page that contains the pending design');
 assert.equal(s.overlay.dataset.mode,'base');
 assert.equal(s.overlay.hidden,false);
 assert.equal(s.discardCount,0);
 assert.equal(s.saveCount,0);
});

test('map destination is committed only after accepting departure from a dirty hangar',()=>{
 const s=stagedExit('map');
 const previous={id:'home',x:0,y:0,label:'Док'};
 const next={id:'lab',x:320,y:40,label:'Лаборатория'};
 let notification='';
 s.game.waypoint=previous;s.game.notice=message=>{notification=message;};
 s.game.heritage.world=()=>{};
 s.game.requestWaypointDeparture(next,'Курс на лабораторию');
 assert.equal(s.game.waypoint,previous,'the route cannot change behind the confirmation');
 s.game.cancelDeparture();
 assert.equal(s.game.waypoint,previous,'cancelling the exit cancels its pending route');
 s.game.requestWaypointDeparture(next,'Курс на лабораторию');
 assert.equal(s.game.confirmDeparture(),true);
 assert.equal(s.game.waypoint,next);
 assert.equal(notification,'Курс на лабораторию');
 assert.equal(s.overlay.hidden,true);
});

test('the fatal screen and checkpoint choice cannot be dismissed into live gameplay',()=>{
 for(const mode of ['run-start','death']){
  const s=stagedExit(mode);
  assert.equal(s.game.dismiss(),false);
  assert.equal(s.overlay.hidden,false);
  assert.equal(s.confirmation,null);
  assert.equal(s.saveCount,0);
 }
});

test('a stale departure action cannot silently discard an unconfirmed build',()=>{
 const s=stagedExit('base');
 assert.equal(s.game.confirmDeparture(),false);
 assert.equal(s.overlay.hidden,false);
 assert.equal(s.discardCount,0);
 assert.equal(s.saveCount,0);
});
