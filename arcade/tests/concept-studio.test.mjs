import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {SCENARIOS,EFFECTS,CONCEPTS} from '../studio/concepts.js';
import {VISUAL_AUDIT,VISUAL_STATUS} from '../studio/visual-audit.js';
import {EXPLOSION_TYPES,EXPLOSION_ASSETS,EXPLOSION_BUDGET} from '../studio/explosion-design.js';
import {SCENARIO_BASELINES,TACTICAL_EXPERIMENTS,BASE_ROLES,PLAYTEST_CHECKS} from '../studio/design-brief.js';
import {CORRIDOR_OPERATION,PROBE_OPERATION} from '../operations.js';
import {RELAY_DEFENSE} from '../relay-defense.js';

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
 for(const name of ['scenario','loop','effects','concepts','tools']){
  assert.match(html,new RegExp('id="panel-'+name+'"'));
  assert.match(html,new RegExp('data-tab="'+name+'"'));
 }
 assert.match(html,/aria-label="Условная карта миссии/);
 assert.match(html,/НЕ ВЛИЯНИЯ НА ИГРУ|БЕЗ ВЛИЯНИЯ НА ИГРУ/);
 assert.ok(exists('../studio/style.css'));
 assert.ok(exists('../studio/app.js'));
});

test('studio scripts are valid JavaScript and old published preview assets remain intact',()=>{
 for(const file of ['../studio/app.js','../studio/concepts.js','../studio/design-brief.js']){
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

test('current game snapshots are distinct from concepts and reflect verified operation rewards',()=>{
 assert.deepEqual(Object.keys(SCENARIO_BASELINES).sort(),Object.keys(SCENARIOS).sort());
 for(const id of ['dock','lab','arsenal']){
  const baseline=SCENARIO_BASELINES[id];
  assert.ok(baseline.source&&baseline.reward&&baseline.gap);
  assert.ok(baseline.phases.length>=4);
  assert.ok(baseline.phases.every(p=>p.action&&p.world&&p.choice));
 }
 assert.equal(SCENARIO_BASELINES.carrier.phases.length,0,'a planned chase cannot appear as a shipped operation');
 assert.match(SCENARIO_BASELINES.dock.reward,new RegExp(String(CORRIDOR_OPERATION.rewardOre)));
 assert.match(SCENARIO_BASELINES.dock.reward,new RegExp(String(CORRIDOR_OPERATION.rewardData)));
 assert.match(SCENARIO_BASELINES.lab.reward,new RegExp(String(PROBE_OPERATION.rewardOre)));
 assert.match(SCENARIO_BASELINES.lab.reward,new RegExp(String(PROBE_OPERATION.rewardData)));
 assert.match(SCENARIO_BASELINES.arsenal.reward,new RegExp(String(RELAY_DEFENSE.rewardOre)));
 assert.match(SCENARIO_BASELINES.arsenal.reward,new RegExp(String(RELAY_DEFENSE.rewardData)));
 assert.equal(RELAY_DEFENSE.waves.length,3);
 assert.equal(RELAY_DEFENSE.preparation,8);
 assert.equal(RELAY_DEFENSE.intermission,6);
 assert.match(SCENARIO_BASELINES.arsenal.gap,/чертежа оружия/);
});

test('one workshop has explicit proposal/baseline comparison, tactical experiments and local QA',()=>{
 const html=read('../studio/index.html'),script=read('../studio/app.js');
 for(const id of ['scenario-gap','scenario-source','scenario-experiment','experiment-picker',
  'experiment-result','experiment-risk','panel-loop','base-roles','design-checks','checks-count','clear-checks'])
  assert.match(html,new RegExp('id="'+id+'"'),'missing '+id);
 assert.match(html,/data-scenario-mode="current"/);
 assert.match(html,/data-scenario-mode="proposal"/);
 assert.match(script,/function scenarioPhases\(/);
 assert.match(script,/function initBrief\(/);
 assert.match(script,/survivor-studio-playtest-v1/);
 assert.equal(BASE_ROLES.length,4);
 assert.equal(new Set(PLAYTEST_CHECKS.map(c=>c.id)).size,PLAYTEST_CHECKS.length);
 assert.ok(PLAYTEST_CHECKS.length>=8);
 for(const [id,phases] of Object.entries(TACTICAL_EXPERIMENTS)){
  assert.ok(SCENARIOS[id],id);
  for(const [phaseId,choices] of Object.entries(phases)){
   assert.ok(SCENARIOS[id].phases.some(p=>p.id===phaseId),id+' / '+phaseId);
   assert.equal(choices.length,2);
   assert.ok(choices.every(c=>c.name&&c.result&&c.risk));
  }
 }
});

test('visual revision reports implementation separately from artistic approval',()=>{
 assert.ok(VISUAL_AUDIT.length>=12);
 assert.equal(new Set(VISUAL_AUDIT.map(e=>e.id)).size,VISUAL_AUDIT.length);
 assert.deepEqual(Object.keys(VISUAL_STATUS).sort(),['game','gap','partial','trial']);
 for(const entry of VISUAL_AUDIT){
  assert.ok(VISUAL_STATUS[entry.status],entry.id+': unknown state');
  assert.ok(Number.isInteger(entry.priority)&&entry.priority>=0&&entry.priority<=2);
  for(const field of ['title','fact','limit','next','criterion','source'])
   assert.ok(entry[field]?.trim(),entry.id+': '+field);
  assert.ok(exists('../../'+entry.source),entry.id+': source not found '+entry.source);
 }
 assert.equal(VISUAL_AUDIT.find(e=>e.id==='capital-wear').status,'trial');
 assert.equal(VISUAL_AUDIT.find(e=>e.id==='scene-light').status,'gap');
 const html=read('../studio/index.html'),js=read('../studio/app.js');
 for(const id of ['audit-title','audit-summary','audit-filters','audit-list'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/initVisualAudit\(\)/);
 assert.match(js,/visualAudit:VISUAL_AUDIT/);
 execFileSync(process.execPath,['--check',fileURLToPath(new URL('../studio/visual-audit.js',import.meta.url))]);
});

test('the embedded A/B comparison uses working images and crops the asteroid atlas',()=>{
 const html=read('../../visual-lab/index.html');
 assert.match(html,/rock:'\.\.\/assets\/space\/asteroid-ore\.png'/);
 assert.match(html,/capital:'\.\.\/assets\/space\/boss-capital-cruiser\.png'/);
 assert.match(html,/function prepareRockTile\(/);
 assert.match(html,/id="asset-status"/);
 assert.doesNotMatch(html,/boss-capital-cruiser\.webp/);
 for(const path of ['../../assets/space/asteroid-ore.png','../../assets/space/boss-capital-cruiser.png'])
  assert.ok(exists(path),path+' missing');
});


test('explosion concepts are five material-specific causal sequences with budgets',()=>{
 assert.deepEqual(Object.keys(EXPLOSION_TYPES).sort(),['asteroid','capital','fighter','orbital','rocket']);
 for(const [id,spec] of Object.entries(EXPLOSION_TYPES)){
  assert.equal(spec.id,id);
  for(const key of ['name','trigger','truth','material','warning','check'])assert.ok(spec[key]?.trim(),id+': '+key);
  assert.ok(spec.duration>.4&&spec.duration<3,id+': proposed duration');
  assert.equal(spec.stages.length,4);
  assert.equal(spec.stages[0].at,0);
  for(let i=1;i<4;i++)assert.ok(spec.stages[i].at>spec.stages[i-1].at,id+': timeline order');
  for(const kind of ['sparks','smoke','shards'])assert.ok(spec.max[kind]>=0&&spec.max[kind]<45);
  for(const pulse of spec.pulseTimes)assert.ok(pulse>=0&&pulse<1);
 }
 assert.ok(EXPLOSION_TYPES.capital.pulseTimes.length>=3,'capital needs separated ruptures');
 assert.equal(EXPLOSION_TYPES.asteroid.palette,'dust');
 assert.equal(EXPLOSION_TYPES.orbital.stages[1].at,.33,'warning comes before orbital strike');
 assert.deepEqual(Object.keys(EXPLOSION_BUDGET.modes).sort(),['balanced','eco','rich']);
 for(const [name,item] of Object.entries(EXPLOSION_ASSETS))assert.ok(exists('../../'+item.path.replace('../../','')),name+': missing asset');
});
test('one existing workshop hosts playable explosion study without touching combat',()=>{
 const page=read('../studio/index.html'),app=read('../studio/app.js'),style=read('../studio/style.css');
 for(const id of ['explosion-workbench','explosion-canvas','explosion-small','explosion-types','explosion-light',
  'explosion-scrub','explosion-timeline','explosion-parallel','explosion-quality','explosion-budget','explosion-assets'])
  assert.match(page,new RegExp('id="'+id+'"'),id);
 assert.match(app,/initExplosionLab\(\)/);
 assert.match(page,/studio-explosions-2/);
 assert.match(app,/explosion-lab\.js\?v=explosions-2/);
 assert.match(read('../studio/explosion-lab.js'),/explosion-design\.js\?v=explosions-2/);
 assert.match(style,/\.explosion-timeline/);
 assert.ok(exists('../studio/explosion-lab.js'));
 assert.ok(exists('../studio/explosion-design.js'));
 assert.ok(exists('../EXPLOSION-VFX-CONCEPT-2026-11-03.md'));
 for(const file of ['../studio/explosion-lab.js','../studio/explosion-design.js'])
  execFileSync(process.execPath,['--check',fileURLToPath(new URL(file,import.meta.url))],{stdio:'pipe'});
 assert.match(read('../studio/explosion-lab.js'),/prefers-reduced-motion/);
 assert.match(read('../studio/explosion-lab.js'),/asset\.path/);
 assert.match(read('../studio/explosion-lab.js'),/prepareRockTile/);
 assert.match(read('../studio/explosion-lab.js'),/makeBlastStamp/);
 assert.match(read('../studio/explosion-lab.js'),/EXPLOSION_BUDGET\.prototypeFps/);
});
