import test from 'node:test';
import assert from 'node:assert/strict';
import {game} from './weapons-scene.mjs';
import {createLoadout,equipModule,HangarSession} from '../ship-loadout.js';
import {borrowAndFit} from '../direct-fitting.js';
import {renderBasePanel} from '../base-panel.js';
const context=(extra={})=>({loadout:createLoadout(),baseActive:true,level:5,ore:100,ranks:{},...extra});
const dock={id:'0:0',active:true,enemy:false,type:'dock'};

test('two choices install a purchased gun in the real runtime, with no unapplied draft or repeated spending',()=>{
 const g=game();g.shipLoadout=createLoadout();g.player.level=3;g.player.ore=40;
 g.hangarSession.begin(g.shipLoadout);g.syncShipLoadout();
 g.paused=true;g.baseTab='hangar';g.overlay.hidden=false;
 g.hangarAction({act:'hgSlot',id:'1'});g.hangarAction({act:'hgEquip',id:'rail'});
 assert.equal(g.weaponProfile.rail,1);assert.equal(g.player.ore,4);
 assert.equal(g.hangarSession.dirty(g.shipLoadout),false);
 g.hangarAction({act:'hgEquip',id:'rail'});assert.equal(g.player.ore,4);
});
for(const id of ['ion','resonator'])test(id+': one choice borrows and equips without Apply',()=>{
 const g=game();g.shipLoadout=createLoadout();g.hangarSession.begin(g.shipLoadout);
 g.paused=true;g.baseTab='hangar';g.overlay.hidden=false;
 g.hangarAction({act:'hgSlot',id:'1'});g.hangarAction({act:'hgBorrow',id});
 assert.equal(g.shipLoadout.slots[1],id);assert.equal(g.weaponProfile[id],true);
 assert.equal(g.player.ore,400);assert.equal(g.fieldTrialTaken,true);
 assert.equal(g.fieldLoan.charges,3);assert.equal(g.hangarSession.dirty(g.shipLoadout),false);
 g.hangarAction({act:'hgBorrow',id});assert.equal(g.fieldLoan.charges,3);
});

test('failed manual fits never consume a trial or rental fee',()=>{
 for(const base of [dock,{...dock,id:'arsenal',type:'arsenal'}]){
  const current=createLoadout(),snapshot=structuredClone(current),ctx=context();
  const result=borrowAndFit(base,current,0,'ion',ctx);
  assert.equal(result.ok,false);assert.deepEqual(current,snapshot);assert.equal(ctx.fieldLoan,undefined);
  const good=borrowAndFit(base,current,1,'ion',ctx);
  assert.equal(good.ok,true);assert.equal(good.ore,base.type==='arsenal'?74:100);
 }
});
test('unaffordable rental, invalid module and closed node fail without changing inventory',()=>{
 const current=createLoadout();
 for(const [slot,id,extra] of [[1,'ion',{ore:10}],[2,'resonator',{}],[1,'unknown',{}]]){
  const r=borrowAndFit({...dock,id:'arsenal',type:'arsenal'},current,slot,id,context(extra));
  assert.equal(r.ok,false);assert.deepEqual(current,createLoadout());
 }
 assert.equal(equipModule(current,0,null,context()).ok,false,'the last automatic gun must remain');
});

test('direct changes preserve a loaded blueprint until the player applies or cancels it',()=>{
 const current=createLoadout(),session=new HangarSession();session.begin(current);
 session.draft.slots[1]='rail';const before=structuredClone(session.draft);
 assert.equal(session.dispatch({act:'hgEquip',id:'plasma'},context({loadout:current})),undefined);
 assert.deepEqual(session.draft,before);assert.match(session.message,/загруженную схему/);
});

test('the ordinary slot catalog includes free trial weapons beside owned and purchasable guns',()=>{
 const g=game();g.shipLoadout=createLoadout();g.hangarSession.begin(g.shipLoadout);
 g.hangarSession.dispatch({act:'hgSlot',id:'1'},context({loadout:g.shipLoadout}));
 const html=renderBasePanel(g.docked,{...g.baseState(),baseTab:'hangar'});
 assert.match(html,/data-act="hgFocusWeapon" data-id="ion"/);
 assert.match(html,/data-act="hgFocusWeapon" data-id="resonator"/);
 assert.match(html,/Бесплатная проба · 3 заряда/);assert.match(html,/data-help-only/);
 for(const id of ['ion','resonator']){
  g.hangarSession.dispatch({act:'hgFocusWeapon',id},{loadout:g.shipLoadout});
  const focused=renderBasePanel(g.docked,{...g.baseState(),baseTab:'hangar'});
  assert.match(focused,new RegExp('data-act="hgBorrow" data-id="'+id+'"'));
 }
 assert.doesNotMatch(html,/data-act="hgInstall"|class="hg-inspector"/);
 assert.doesNotMatch(html,/data-act="hgApply"/);
});

 test('locked future weapons never advertise free installation',()=>{
 const g=game();g.player.level=1;g.shipLoadout=createLoadout();g.hangarSession.begin(g.shipLoadout);
 g.hangarSession.dispatch({act:'hgSlot',id:'1'},context({loadout:g.shipLoadout}));
 g.hangarSession.dispatch({act:'hgFocusWeapon',id:'rail'},{loadout:g.shipLoadout});
 const html=renderBasePanel(g.docked,{...g.baseState(),baseTab:'hangar'});
 const rail=html.split('data-act="hgEquip" data-id="rail"')[1].split('</button>')[0];
 assert.match(rail,/disabled>Закрыто/);assert.doesNotMatch(rail,/Установить · бесплатно/);
});
