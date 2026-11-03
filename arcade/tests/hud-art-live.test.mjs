import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const base=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,base),'utf8');
test('live art HUD retains data IDs and maps to separate SVG graphic assets',()=>{
 const html=read('index.html'),js=read('hud.js'),css=read('hud-art.css');
 for(const id of ['hp','hpmeter','hpbar','xpmeter','xpbar','shield','shieldmeter','leftBurstMeter','leftBurstText','hudStrikeCount','hudDrone0','burst','burstbar','bursttext','hudHackSlot','hudStrikeSlot','radar','contractObjective','data','ore','wing']) {
  assert.match(html,new RegExp('id="'+id+'"'),'missing '+id);
 }
 assert.match(html,/hud-art\.css\?v=/);
 for(const asset of ['panel-left.svg','panel-right.svg','mission-ribbon.svg','radar-bezel.svg','ability-frame.svg','ship-outline.svg','weapon.svg','code.svg','burst.svg','strike.svg','segments-cyan.svg','segments-amber.svg','segments-muted.svg','hull.svg','shield.svg','support-ring.svg']) {
  assert.ok(existsSync(new URL('studio/hud-kit/'+asset,base)),asset+' missing');
  assert.ok(html.includes(asset)||css.includes(asset),asset+' not used in live art');
 }
 assert.match(js,/n\.hpmeter\.style\.setProperty\('--meter-fill'/);
 assert.match(js,/n\.xpmeter\.style\.setProperty\('--meter-fill'/);
 assert.match(js,/n\.hudHackSlot\.classList\.toggle\('available',hasCode\)/);
 assert.match(js,/n\.hudStrikeSlot\.classList\.toggle\('available',hasStrike\)/);
 assert.match(js,/n\.shieldmeter\.style\.setProperty\('--meter-fill'/);
 assert.match(js,/n\.leftBurstMeter\.style\.setProperty\('--meter-fill'/);
 assert.doesNotMatch(css,/animation:\s*infinite/);
});
