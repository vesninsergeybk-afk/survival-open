import test from 'node:test';
import assert from 'node:assert/strict';
import {ArcadeVisuals} from '../visuals.js';
import {WorldVFX} from '../../src/world-vfx.js';
import {getExplosionAtlas,BLAST_FRAMES} from '../../src/explosion-art.js';

test('regional paintings and world-anchored planet avoid duplicate CSS art',()=>{
 const previous=globalThis.document,previousLocation=globalThis.location;
 const sky=()=>{
  const props={};
  return {props,style:{setProperty:(key,value)=>{props[key]=value;}},
   classList:{add(){},remove(){}}};
 };
 const skies=[sky(),sky()],sector={textContent:''};
 globalThis.document={getElementById:id=>
  id==='sky0'?skies[0]:id==='sky1'?skies[1]:id==='sector'?sector:null};
 try{
  globalThis.location={search:''};
  const visuals=new ArcadeVisuals();
  assert.match(skies[0].props['--sector-image'],/nebula_main\.jpg/);
  visuals.updateSky(6000,40000);
  const azure=skies[visuals.layer];
  assert.match(azure.props['--sector-image'],/nebula_azure_v1\.png/);
  assert.equal(azure.props['--planet-opacity'],'0',
   'the old CSS planet is hidden while the world-anchored canvas planet draws');
  assert.equal(visuals.cinematicScenery.enabled,true);
  assert.ok(visuals.cinematicScenery._tile('planet')===null,
   'non-browser tests do not allocate a graphics context');
  visuals.updateSky(35000,7000);
  const amber=skies[visuals.layer];
  assert.match(amber.props['--sector-image'],/nebula_amber_v1\.png/);
  assert.equal(amber.props['--planet-opacity'],'0');
  assert.equal(sector.textContent,'Янтарные облака');

  globalThis.location={search:'?cinematic=off'};
  const fallback=new ArcadeVisuals();
  fallback.updateSky(6000,40000);
  const oldAzure=skies[fallback.layer];
  assert.match(oldAzure.props['--planet-image'],/planet_ice_v1\.png/,
   'optional mode restores the original CSS planet');
  const before=oldAzure.props['--planet-x'];
  fallback.updateSky(6400,40100);
  assert.notEqual(oldAzure.props['--planet-x'],before);
 }finally{globalThis.document=previous;globalThis.location=previousLocation;}
});

test('explosion atlas is prepared once and preserves existing impact particles',()=>{
 const previous=globalThis.document;
 let gradients=0;
 const paint={save(){},restore(){},translate(){},scale(){},
  fillRect(){},fill(){},stroke(){},beginPath(){},moveTo(){},lineTo(){},
  closePath(){},quadraticCurveTo(){},arc(){},
  createRadialGradient(){gradients++;return {addColorStop(){}};}};
 globalThis.document={createElement:()=>({
  width:0,height:0,getContext:()=>paint
 })};
 try{
  const effects=new WorldVFX();
  assert.equal(gradients,BLAST_FRAMES*2,'one core and one irregular front per baked frame');
  const prepared=gradients;
  new WorldVFX();
  assert.equal(gradients,prepared,'the same texture atlas must be reused');
  const rocket=getExplosionAtlas('orange','rocket');
  assert.ok(rocket,'rocket uses a dedicated cached silhouette');
  assert.equal(gradients,prepared+BLAST_FRAMES*2);
  getExplosionAtlas('orange','rocket');
  assert.equal(gradients,prepared+BLAST_FRAMES*2,'rocket frames are not repainted');
  effects.shipExplosion(20,30,18,'#ff8866');
  assert.equal(effects.explosions.length,1);
  assert.ok(effects.particles.length>0);
  assert.ok(effects.rings.length>0);
 }finally{globalThis.document=previous;}
});
