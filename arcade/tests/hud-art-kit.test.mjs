import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {Script} from 'node:vm';

const preview=new URL('../studio/hud-preview.html',import.meta.url);
const kit=new URL('../studio/hud-kit/',import.meta.url);
const html=readFileSync(preview,'utf8');
const names=readdirSync(kit);

test('HUD art kit has independently loadable graphic assets',()=>{
 assert.equal(names.filter(n=>n.endsWith('.svg')).length,14);
 for(const name of names){
  assert.match(name,/\.svg$/);
  const content=readFileSync(new URL(name,kit),'utf8');
  assert.match(content,/^<svg\b[^>]*viewBox=/);
  assert.match(content,/<\/svg>$/);
  assert.doesNotMatch(content,/<script\b|<foreignObject\b|xlink:href="https?:/i);
 }
 const refs=[...html.matchAll(/hud-kit\/([^"']+\.svg)/g)].map(x=>x[1]);
 assert.ok(refs.length>=14,'preview must use the graphic files');
 for(const name of refs)assert.ok(existsSync(new URL(name,kit)),name);
});

test('HUD preview has three real layouts and three demo states',()=>{
 for(const type of ['desktop','phone-landscape','phone-portrait']){
  assert.match(html,new RegExp('data-screen="'+type+'"'));
  if(type!=='desktop')assert.match(html,new RegExp('stage\\.'+type));
 }
 for(const state of ['cruise','combat','critical']){
  assert.match(html,new RegExp('data-state="'+state+'"'));
 }
 assert.match(html,/ДАННЫЕ УСЛОВНЫЕ/);
 assert.match(html,/отдельный графический стенд/);
 const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js,'standalone demo script');
 assert.doesNotThrow(()=>new Script(js));
});

test('HUD spec does not mistake illustrative data for live game state',()=>{
 const spec=readFileSync(new URL('../studio/HUD-ART-DIRECTION-2026-11-03.md',import.meta.url),'utf8');
 assert.match(spec,/Это ещё не действующий HUD игры/);
 assert.match(spec,/Боезапаса пока нет/);
 assert.match(spec,/Перегрева пока нет/);
 assert.match(spec,/Только затем менять/);
});
