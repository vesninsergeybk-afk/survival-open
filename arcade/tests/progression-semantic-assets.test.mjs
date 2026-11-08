import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {progressionModel,renderProgressionScreen} from '../progression-screen.js';
import {createLoadout} from '../ship-loadout.js';
import {createTactical} from '../tactical-fields.js';

const root=dirname(fileURLToPath(new URL('../index.html',import.meta.url)));
const semantic=['dodge','extractor','wreck','capture','signal'];
const weaponFamilies=['plasma','rail','flak','rocket'];
const tactics=['pulse','decoy','trap','jam'];
const state=()=>({
 developmentDomain:'pilot',level:7,points:3,ore:200,
 baseActive:true,activeBases:3,skillBranch:'Корабль',
 skillRanks:{},pilotDoctrines:[],pilotSkills:[],
 hangarUpgrades:[],loadout:createLoadout(),
 hangarSession:{focusWeapon:'plasma'},developmentTactic:'pulse',
 tactical:createTactical(),controls:{},station:{}
});

test('five field skills reuse rendered 3D artwork and add five distinct semantic markers',()=>{
 const g=state();
 g.pilotSkills=semantic.map(id=>({id,from:1,max:1,title:id,desc:id,branch:'Корабль'}));
 const pilot=progressionModel(g).nodes;
 g.developmentDomain='tactics';g.developmentTactic='abilities';
 const tactical=progressionModel(g).nodes;
 const expected={
  dodge:'tactics/dash_discharge.webp',
  extractor:'upgrades/mining.webp',
  wreck:'upgrades/hull.webp',
  capture:'weapons/allied_drone.webp',
  signal:'upgrades/scanner.webp'
 };
 const sprite=readFileSync(join(root,'assets/progression/semantics/branch-variants.svg'),'utf8');
 for(const id of semantic){
  const node=[...pilot,...tactical].find(n=>n.id==='skill-'+id);
  assert.ok(node,id+' absent');
  assert.equal(node.icon,'./assets/progression/'+expected[id]);
  assert.equal(node.variant,'semantic-'+id);
  assert.ok(existsSync(join(root,node.icon)),node.icon);
  assert.ok(sprite.includes('<symbol id="semantic-'+id+'"'),id+' missing badge');
  assert.equal(existsSync(join(root,'assets/progression/semantics/'+id+'.svg')),false,
   'Flat full-size icons must not replace existing rendered artwork');
 }
 assert.equal(semantic.length,5);
});

test('all real weapon specializations have visually unique, matching symbols',()=>{
 const g=state(),sprite=readFileSync(join(root,'assets/progression/semantics/branch-variants.svg'),'utf8');
 const seen=new Set();
 for(const family of weaponFamilies){
  g.hangarSession.focusWeapon=family;g.developmentDomain='weapons';
  const nodes=progressionModel(g).nodes.filter(n=>n.id.startsWith('spec-'+family+'-'));
  assert.equal(nodes.length,2,family+' paths');
  const html=renderProgressionScreen(g);
  for(const node of nodes){
   assert.equal(node.variant,node.id);
   assert.ok(!seen.has(node.variant));seen.add(node.variant);
   assert.ok(sprite.includes('<symbol id="'+node.variant+'"'),node.id+' missing symbol');
   assert.ok(html.includes('branch-variants.svg#'+node.variant),node.id+' not rendered');
   assert.ok(html.includes('data-act="devFocus" data-id="'+node.id+'"'));
  }
 }
});

test('tactical variants show individual semantic marks without changing their actions',()=>{
 const g=state(),sprite=readFileSync(join(root,'assets/progression/semantics/branch-variants.svg'),'utf8');
 for(const id of tactics){
  g.developmentTactic=id;g.developmentDomain='tactics';
  const nodes=progressionModel(g).nodes.filter(n=>n.id.startsWith('tactic-'+id+'-'));
  assert.equal(nodes.length,2,id+' paths');
  const html=renderProgressionScreen(g);
  for(const node of nodes){
   assert.equal(node.variant,node.id);
   assert.match(sprite,new RegExp('<symbol id="'+node.variant+'"'));
   assert.ok(html.includes('branch-variants.svg#'+node.variant));
   assert.equal(node.action,'hgTacticUpgrade');
  }
 }
});

test('path badges are decorative and state, cost, and access remain live text/buttons',()=>{
 const g=state();g.developmentDomain='weapons';
 const html=renderProgressionScreen(g);
 assert.match(html,/prog-node-variant[^>]+aria-hidden="true"/);
 assert.match(html,/prog-detail-variant[^>]+aria-hidden="true"/);
 assert.match(html,/data-status="locked"|data-status="ready"/);
 assert.match(html,/Стоимость:/);
 assert.match(html,/data-act="hgSpec"/);
 const css=readFileSync(join(root,'menu-refinement.css'),'utf8');
 assert.match(css,/\.prog-node-variant/);
 assert.match(css,/\.prog-detail-icon-wrap/);
});
