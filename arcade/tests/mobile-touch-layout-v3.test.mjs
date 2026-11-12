import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../mobile-touch-layout-v3.css',import.meta.url),'utf8');
test('touch has a manual shot and one expandable navigation menu',()=>{
 for(const id of ['mobileNavToggle','mobileNavPanel','mobilePauseBtn','mobileManualBtn','mobileManualSelectBtn','mobileTouchHelp'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/mobile-touch-layout-v3\.css\?v=mobile-hud-redesign-20261112-1/);
 assert.match(html,/id="mobileManualBtn"[^>]*aria-pressed="false"/);
 assert.match(game,/mobileManualArmed\?weapon:mobileAimKind/);
 assert.match(game,/mobileManualArmed=false;\s*this\.syncControlUI\(\)/);
 assert.match(game,/mobilePauseBtn'\)\?\.addEventListener\('click'/);
});
test('mobile layout moves desktop shortcuts away from the flight surface',()=>{
 assert.match(css,/#quickMenu\{display:none!important\}/);
 assert.match(css,/#hud\.cockpit-hud #weaponDeckSpaceQuick/);
 assert.match(css,/#hud\.cockpit-hud \.contract-objective/);
 assert.match(css,/#hud\.cockpit-hud \.radar-unit/);
 assert.match(css,/#actionBtn:disabled\{display:none!important\}/);
 assert.match(css,/\.mobile-abilities\[hidden\]\{display:none!important\}/);
 assert.match(css,/\.mobile-nav-panel\[hidden\]/);
 assert.match(html,/id="mobileZoomOut"/);
 assert.match(html,/id="tacticBtn"/);
 assert.match(html,/id="quietBtn"/);
});
