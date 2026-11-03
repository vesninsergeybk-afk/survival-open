import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {SCENARIOS,EFFECTS,CONCEPTS} from '../studio/concepts.js';

const read=relative=>readFileSync(new URL(relative,import.meta.url),'utf8');
const exists=relative=>existsSync(new URL(relative,import.meta.url));

test('concept studio has four distinct station operations and meaningful phases',()=>{
 assert.deepEqual(Object.keys(SCENARIOS).sort(),['arsenal','carrier','dock','lab']);
 for(const [id,scenario] of Object.entries(SCENARIOS)){
  assert.equal(scenario.id,id);
  for(const field of ['title','base','premise','risk','reward','time','state'])
   assert.ok(scenario[field]?.trim(),id+': '+field);
  assert.ok(scenario.phases.length>=4,id+': too few situations');
  assert.equal(new Set(scenario.phases.map(p=>p.id)).size,scenario.phases.length);
  for(const phase of scenario.phases){
   for(const field of ['id','title','action','world','choice'])
    assert.ok(phase[field]?.trim(),id+'/'+phase.id+': '+field);
   assert.ok(phase.x>=0&&phase.x<=1&&phase.y>=0&&phase.y<=1,'map coordinates');
   assert.ok(Number.isInteger(phase.enemy)&&phase.enemy>=0&&phase.enemy<=4,'enemies are symbolic');
  }
  assert.equal(scenario.phases.at(-1).id,'result');
 }
});

test('effects describe cause, game meaning, sound and acceptance',()=>{
 assert.deepEqual(Object.keys(EFFECTS).sort(),['beacon','emp','hit','mining','noise']);
 for(const [id,effect] of Object.entries(EFFECTS)){
  assert.equal(effect.id,id);
  for(const field of ['name','intent','trigger','sound','rules','test','color'])
   assert.ok(effect[field]?.trim(),id+': '+field);
  assert.match(effect.color,/^#[\da-fA-F]{6}$/);
 }
});

test('concept quality requirements are expressed as observable criteria',()=>{
 assert.equal(CONCEPTS.length,4);
 assert.equal(new Set(CONCEPTS.map(c=>c.id)).size,CONCEPTS.length);
 for(const c of CONCEPTS){
  for(const field of ['id','name','status','goal','criterion','next'])
   assert.ok(c[field]?.trim(),c.id+': '+field);
 }
});

test('studio page includes its real controls and accessible panels',()=>{
 const html=read('../studio/index.html');
 for(const id of ['scenario-picker','scenario-canvas','scenario-next','scenario-reset',
  'scenario-steps','effect-picker','effect-canvas','effect-small','effect-power',
  'effect-pause','effect-replay','concept-grid','concept-notes','copy-notes','notes-status']){
  assert.match(html,new RegExp('id="'+id+'"'),'missing '+id);
 }
 for(const name of ['scenario','effects','concepts','tools']){
  assert.match(html,new RegExp('id="panel-'+name+'"'));
  assert.match(html,new RegExp('data-tab="'+name+'"'));
 }
 assert.match(html,/aria-label="Условная карта миссии/);
 assert.match(html,/НЕ ВЛИЯНИЯ НА ИГРУ|БЕЗ ВЛИЯНИЯ НА ИГРУ/);
 assert.ok(exists('../studio/style.css'));
 assert.ok(exists('../studio/app.js'));
});

test('studio scripts are valid JavaScript and old published preview assets remain intact',()=>{
 for(const file of ['../studio/app.js','../studio/concepts.js']){
  execFileSync(process.execPath,['--check',fileURLToPath(new URL(file,import.meta.url))],{stdio:'pipe'});
 }
 for(const file of ['../repair-dock-preview.html','../capital-preview.html','../station-silhouette-board.html','../../asset-gallery.html'])
  assert.ok(exists(file),file+' missing');
 assert.match(read('../studio/style.css'),/@media\(max-width:480px\)/);
});

test('Pages publication includes the original asset gallery without exposing audio source directory',()=>{
 const yaml=read('../../.github/workflows/publish-pages.yml');
 assert.match(yaml,/cp asset-gallery\.html _site\//);
 assert.doesNotMatch(yaml,/cp -R audio-lab _site/);
});

test('one concept workshop embeds detailed VFX comparison while preserving old URL',()=>{
 const studio=read('../studio/index.html');
 const script=read('../studio/app.js');
 const legacy=read('../../visual-lab/index.html');
 const styling=read('../studio/style.css');
 assert.match(studio,/id="vfx-compare-frame"/);
 assert.match(studio,/src="\.\.\/\.\.\/visual-lab\/\?embed=1"/);
 assert.match(script,/function selectStudioTab\(/);
 assert.match(script,/location\.hash/);
 assert.match(script,/function sizeComparisonFrame\(/);
 assert.match(styling,/#vfx-compare-frame/);
 assert.match(legacy,/location\.replace\('\.\.\/arcade\/studio\/#effects'\)/);
 assert.match(legacy,/get\('embed'\)==='1'/);
 assert.match(legacy,/\.embedded header/);
 assert.match(legacy,/Добыча руды лучом/);
 assert.match(legacy,/Гибель крупного корабля/);
 assert.ok(exists('../../visual-lab/README.md'));
});
