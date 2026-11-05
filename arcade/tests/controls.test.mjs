import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chooseInteraction,activeInteraction,automaticFireAllowed}
 from '../controls.js';

const player={x:0,y:0};
const probe={x:100,y:0,id:'probe'};
const station={x:120,y:0,id:'station'};
const rock={x:140,y:0,alive:true,id:'rock'};
const action=(items={})=>chooseInteraction({player,...items});

test('the mission probe wins over a station and overlapping ore',()=>{
 const target=action({probe,station,rock});
 assert.equal(target.kind,'repair');
 assert.equal(target.target,probe);
 assert.equal(target.hold,true);
});

test('station interaction wins over ore only while in docking range',()=>{
 assert.equal(action({station,rock}).kind,'station');
 assert.equal(action({station:{x:180,y:0},rock}).kind,'mine');
});

test('ore is holdable and an exhausted or remote target is ignored',()=>{
 assert.equal(action({rock}).kind,'mine');
 assert.equal(action({rock:{...rock,alive:false}}),null);
 assert.equal(action({rock:{...rock,x:250}}),null);
});

test('out-of-range probe does not shadow ordinary extraction',()=>{
 assert.equal(action({probe:{x:230,y:0},rock}).kind,'mine');
});

test('action kind is locked during hold and releases cleanly',()=>{
 const held={kind:'mine',target:rock};
 assert.equal(activeInteraction(held,'mine',true),true);
 assert.equal(activeInteraction(held,'station',true),false);
 assert.equal(activeInteraction(held,'repair',true),false);
 assert.equal(activeInteraction(held,'mine',false),false);
 assert.equal(activeInteraction(null,'mine',true),false);
});

test('hold-fire suppresses automatic weapons even when mining ends',()=>{
 assert.equal(automaticFireAllowed(false,false,false),true);
 assert.equal(automaticFireAllowed(true,false,false),false);
 assert.equal(automaticFireAllowed(false,true,false),false);
 assert.equal(automaticFireAllowed(false,false,true),false);
});

test('keyboard, touch and autonomous units share the cease-fire contract',()=>{
 const script=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const ai=readFileSync(new URL('../ai.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(script,/e\.code===this\.controls\.interact\)this\.beginInteraction/);
 assert.match(script,/e\.code===this\.controls\.cease\)this\.toggleHoldFire/);
 assert.match(script,/automaticFireAllowed\(this\.holdFire/);
 assert.match(script,/activeInteraction\(this\.actionHeld,'mine'/);
 assert.match(ai,/const holdingFire=!!game\.holdFire/);
 assert.match(ai,/if\(!game\.holdFire\)for\(const other/);
 assert.match(html,/id="actionBtn"/);
 assert.match(html,/id="quietBtn"/);
 assert.doesNotMatch(html,/id="mineBtn"|id="dockBtn"/);
 assert.doesNotMatch(script,/mineTouch/);
});

test('upgrades no longer interrupt every interval of flight',()=>{
 const script=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.doesNotMatch(script,/nextSkillPrompt|this\.skills\(\);\s*\}\s*drawSprite/);
});
