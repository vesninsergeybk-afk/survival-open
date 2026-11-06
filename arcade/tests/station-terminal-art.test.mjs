import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {menuIcon} from '../menu-icons.js';

const arcade=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(arcade,path),'utf8');

test('the four actual station types have small, accessible decorative artwork',()=>{
 const css=read('station-terminal-art.css');
 for(const type of ['dock','lab','arsenal','carrier']){
  const filename='studio/menu-kit/art/stations/'+type+'.webp';
  const size=statSync(resolve(arcade,filename)).size;
  assert.ok(size>10000&&size<250000,filename+' should remain an optimised image');
  assert.match(css,new RegExp('station-'+type+' \\.base-head::before'));
  assert.ok(css.includes(type+'.webp'));
 }
 assert.match(css,/@media \(min-width:701px\) and \(min-height:581px\)/);
 assert.match(css,/@media \(max-width:700px\),\(max-height:580px\)/);
});

test('station art is CSS-only and loads after existing interface styles',()=>{
 const html=read('index.html');
 assert.match(html,/station-terminal-art\.css\?v=station-terminal-art-1/);
 assert.ok(html.indexOf('all-menus.css')<html.indexOf('station-terminal-art.css'));
 const css=read('station-terminal-art.css');
 for(const file of ['terminal-frame.svg','panel-hatch.svg','icons.svg']){
  assert.ok(statSync(resolve(arcade,'studio/menu-kit/art/ui/'+file)).size>200);
 }
 for(const icon of ['nav-summary','nav-missions','nav-ship','nav-station','nav-map','act-repair','act-hire','act-launch']){
  assert.ok(statSync(resolve(arcade,'studio/menu-kit/art/ui/'+icon+'.svg')).size>100);
  assert.ok(css.includes(icon+'.svg'));
 }
 assert.ok(!/pointer-events\s*:\s*auto/.test(css));
});

test('equipment art changes only visible module glyphs, not inline blueprint geometry',()=>{
 const sprite=read('studio/menu-kit/art/ui/icons.svg');
 for(const id of ['plasma','rail','flak','rocket','resonator','ion','howitzer']){
  assert.ok(sprite.includes('id="weapon-'+id+'"'));
  assert.match(menuIcon(id,'hg-module-icon'),new RegExp('icons\\.svg#weapon-'+id));
  assert.doesNotMatch(menuIcon(id,'hg-module-icon-inline'),/<use /);
  assert.match(menuIcon(id,'hg-module-icon-inline'),/<path d=/);
 }
 assert.match(read('hangar-panel.js'),/icon\(id,true\)\.replace/);
});
