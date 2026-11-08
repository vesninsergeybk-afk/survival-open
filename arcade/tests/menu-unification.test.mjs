import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(fileURLToPath(new URL('../index.html',import.meta.url)));
const read=name=>readFileSync(join(root,name),'utf8');

test('new readability layer follows both station and progression styles',()=>{
 const html=read('index.html');
 const names=['progression-art.css','station-menu-v2.css','menu-consistency.css','menu-refinement.css'];
 let previous=-1;
 for(const name of names){
  const index=html.indexOf('./'+name+'?v=');
  assert.ok(index>previous,'stylesheet missing or loaded in wrong order: '+name);
  previous=index;
 }
});

test('the menu uses the current coherent vector and sprite assets',()=>{
 const required=[
  'studio/menu-kit/art/ui/nav-summary.svg',
  'studio/menu-kit/art/ui/nav-missions.svg',
  'studio/menu-kit/art/ui/nav-ship.svg',
  'studio/menu-kit/art/ui/nav-development.svg',
  'studio/menu-kit/art/ui/nav-station.svg',
  'studio/menu-kit/art/ui/progression-grid.svg',
  'studio/menu-kit/art/ui/panel-hatch.svg',
  'studio/menu-kit/art/ui/terminal-frame.svg',
  'assets/station-menu/icons-v2.webp',
  'assets/progression/frames/node_selected.webp',
  'assets/progression/frames/node_ready.webp',
  'assets/progression/frames/node_locked.webp'
 ];
 for(const path of required)assert.ok(existsSync(join(root,path)),'missing '+path);
});

test('portrait menu labels use accessible rows rather than 9px five-column captions',()=>{
 const css=read('menu-refinement.css');
 assert.match(css,/@media \(max-width:520px\)/);
 assert.match(css,/\.base-dialog \.base-tabs\s*\{[\s\S]*?grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(css,/\.progression-ui \.prog-orbit\s*\{[\s\S]*?grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(css,/\.base-tabs button:nth-last-child\(-n\+2\) \{grid-column:span 3\}/);
 assert.match(css,/\.prog-domain:nth-last-child\(-n\+2\) \{grid-column:span 3\}/);
 assert.match(css,/\.progression-ui \.prog-domain strong \{font-size:12px/);
 assert.match(css,/\.progression-ui \.prog-tier h3 \{font-size:12px/);
 assert.match(css,/\.base-dialog \.base-tabs button \{[\s\S]*?font-size:12px!important/);
});

test('menu refinement does not inject gameplay handlers or duplicate skill prerequisites',()=>{
 const css=read('menu-refinement.css');
 assert.doesNotMatch(css,/data-act\s*=|data-requires\s*=|addEventListener|onclick|setInterval/);
 assert.match(css,/\.prog-tier-nodes:has\(>\.prog-node:only-child\)/);
});

test('short landscape screens keep ship caption readable despite earlier 9px styles',()=>{
 const css=read('menu-refinement.css');
 const needle='@media (min-width:521px) and (max-height:540px)';
 const start=css.indexOf(needle);
 assert.ok(start>=0);
 const section=css.slice(start,css.indexOf('@media (prefers-reduced-motion',start));
 assert.match(section,/\.prog-ship-caption span \{font-size:11px;line-height:1\.25\}/);
 assert.match(section,/\.prog-domain strong \{font-size:12px\}/);
});

test('intermediate tablet widths and subgroup labels are not 9px',()=>{
 const css=read('menu-refinement.css');
 assert.match(css,/\.progression-ui \.prog-subtab-label \{font-size:12px/);
 const start=css.indexOf('@media (min-width:521px) and (max-width:800px) and (min-height:541px)');
 assert.ok(start>=0,'missing tablet rule');
 const section=css.slice(start,css.indexOf('@media (prefers-reduced-motion',start));
 assert.match(section,/\.prog-ship-caption span \{font-size:12px;line-height:1\.25\}/);
 assert.match(section,/\.prog-domain strong \{font-size:12px\}/);
});

test('published HTML refreshes the stylesheet version for landscape readability fix',()=>{
 const html=read('index.html');
 assert.match(html,/menu-refinement\.css\?v=menu-unification-20261108-1-landscape-1-midwidth-1/);
});


test('hangar explanatory text is legible while ship hardpoint geometry stays unchanged',()=>{
 const css=read('menu-refinement.css');
 const html=read('index.html');
 const block=css.slice(css.indexOf('/* Hangar readability.'));
 assert.ok(block.startsWith('/* Hangar readability.'));
 for(const selector of ['.hg-weapon small','.hg-weapon em','.hg-fit-note',
   '.hg-control-note','.hg-thermal-plan span','.hg-upgrade-grid article>small',
   '.hg-stats caption','.hg-stage']){
   assert.ok(block.includes(selector),selector+' must be covered by the readable type scale');
 }
 assert.match(block,/font-size:12px/);
 assert.match(block,/\.hg-filters button \{font-size:12px;min-height:44px\}/);
 assert.doesNotMatch(block,/\.hg-node\s+span\s*\{/,
   'Ship hardpoint label geometry should not be resized without visual QA');
 assert.match(html,/menu-refinement\.css\?v=[^"\n]*hangar-legibility-1/);
});
