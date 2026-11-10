import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {ESCORTS,escortPortrait} from '../escort-squad.js';
import {COMPACT_ESCORT_SPECS,SPECIAL_ESCORT_SPECS} from '../visuals.js';

const asset=path=>new URL('../'+path,import.meta.url);
const roles=Object.keys(ESCORTS);

test('every hireable escort has an optimized transparent-capable WebP portrait',()=>{
 assert.deepEqual(roles,['scout','fighter','brawler','rocket','medic']);
 for(const role of roles){
  const relative=escortPortrait(role);
  assert.equal(relative,'./assets/escort/'+role+'-v2.webp');
  const bytes=readFileSync(asset(relative.replace(/^\.\//,'')));
  assert.equal(bytes.toString('ascii',0,4),'RIFF',role);
  assert.equal(bytes.toString('ascii',8,12),'WEBP',role);
  assert.ok(bytes.length>1000&&bytes.length<120000,role+' should load quickly');
  assert.ok(statSync(asset(relative.replace(/^\.\//,''))).isFile());
 }
 assert.equal(escortPortrait('unknown'),'');
});

test('battle rendering uses distinctive silhouettes for all five escort roles',()=>{
 assert.deepEqual(Object.keys(COMPACT_ESCORT_SPECS),['scout','fighter']);
 assert.deepEqual(Object.keys(SPECIAL_ESCORT_SPECS),['brawler','rocket','medic']);
 for(const [role,spec] of Object.entries({...COMPACT_ESCORT_SPECS,...SPECIAL_ESCORT_SPECS})){
  assert.equal(spec.asset,'./assets/escort/'+role+'-v2.webp');
  assert.ok(spec.width>15&&spec.height>15);
 }
 assert.ok(SPECIAL_ESCORT_SPECS.rocket.height>SPECIAL_ESCORT_SPECS.rocket.width,
  'missile ship keeps its slender launch-rail profile');
});

test('temporary relics, achievements and drone perks have distinct SVG art',()=>{
 const names=[...['storm','salvo','arc'].map(x=>'relic-'+x),
  ...['ace','comet','wing','evasive','survivor'].map(x=>'mastery-'+x),
  ...['armor','speed','targeting','assault','ram','medic'].map(x=>'wing-'+x)];
 for(const name of names){
  const svg=readFileSync(new URL('../studio/hud-kit/'+name+'.svg',import.meta.url),'utf8');
  assert.match(svg,/<svg[^>]+viewBox="0 0 64 64"/,name);
  assert.match(svg,/<\/svg>/,name);
  assert.ok(svg.length>340,name+' must have more than a placeholder path');
 }
});
