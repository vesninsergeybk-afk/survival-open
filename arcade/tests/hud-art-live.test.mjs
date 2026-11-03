import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const base=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,base),'utf8');
test('live art HUD retains data IDs and maps to separate SVG graphic assets',()=>{
 const html=read('index.html'),js=read('hud.js'),css=read('hud-art.css');
 for(const id of ['hp','hpmeter','hpbar','xpmeter','xpbar','shield','shieldmeter','flightDistance','leftBurstMeter','leftBurstText','hudStrikeCount','hudDrone0','hudDrone1','burst','burstbar','bursttext','hudHackSlot','hudStrikeSlot','hudThermal','hudThermalLabel','hudThermalText','hudThermalMeter','radar','contractObjective','data','ore','wing']) {
  assert.match(html,new RegExp('id="'+id+'"'),'missing '+id);
 }
 assert.match(html,/hud-art\.css\?v=/);
 assert.doesNotMatch(html,/id="hudDrone2"/,'art must reflect two gameplay drone slots');
 for(const asset of ['panel-left.svg','panel-right.svg','mission-ribbon.svg','radar-bezel.svg','ability-frame.svg','ship-outline.svg','weapon.svg','code.svg','burst.svg','strike.svg','segments-cyan.svg','segments-amber.svg','segments-red.svg','segments-muted.svg','hull.svg','shield.svg','support-ring.svg','mobile-frame.svg','mobile-frame-amber.svg','mobile-stick.svg','interact.svg','ion.svg']) {
  assert.ok(existsSync(new URL('studio/hud-kit/'+asset,base)),asset+' missing');
  assert.ok(html.includes(asset)||css.includes(asset),asset+' not used in live art');
 }
 assert.match(js,/n\.hpmeter\.style\.setProperty\('--meter-fill'/);
 assert.match(js,/n\.xpmeter\.style\.setProperty\('--meter-fill'/);
 assert.match(js,/n\.hudHackSlot\.classList\.toggle\('available',hasCode\)/);
 assert.match(js,/n\.hudStrikeSlot\.classList\.toggle\('available',hasStrike\)/);
 assert.match(js,/n\.shieldmeter\.style\.setProperty\('--meter-fill'/);
 assert.match(js,/n\.leftBurstMeter\.style\.setProperty\('--meter-fill'/);
 assert.match(js,/game\.weaponThermal/,'heat gauge must require real weapon state');
 assert.match(js,/n\.hudThermal\.hidden=!thermalEnabled/,'heat gauge hidden if unimplemented');
 assert.match(css,/\.hud-thermal\.locked/,'overheat has its own visual state');
 assert.match(read('studio/hud-preview.html'),/data-thermal="locked"/,'workbench must show experimental heat states');
 assert.doesNotMatch(css,/animation:\s*infinite/);
 assert.match(css,/mobile-frame\.svg/,'touch controls share graphical chrome with cockpit');
 assert.match(js,/routeDistance/,'top ribbon must display a real route distance');
 const game=read('game.js');
 assert.match(game,/this\.cockpit\.impact\(damage\/Math\.max\(1,p\.maxHp\),absorbed>0&&remaining===0\)/,
  'real damage should carry its shield-only outcome to the HUD');
 assert.match(js,/is-hit-heavy/,'strong-hit state must be explicit');
 assert.match(css,/hud-signal-impact-heavy/,'heavy impacts should get a larger instrument jolt');
 assert.match(css,/prefers-reduced-motion:reduce/,'respect reduced-motion preference');
 assert.match(css,/impact-interference\.svg/,'electronic noise should be an authored graphic asset');
 assert.match(read('studio/hud-preview.html'),/data-impact="heavy"/,'workbench should preview the impact state');
 assert.ok(existsSync(new URL('studio/hud-kit/impact-interference.svg',base)),
  'electronic interference asset missing');

});
