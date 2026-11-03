import test from 'node:test';
import assert from 'node:assert/strict';
import {ArcadeVisuals} from '../visuals.js';
import {WorldVFX} from '../../src/world-vfx.js';

test('each sector uses its own artwork and a distant planet tracks world coordinates',()=>{
 const previous=globalThis.document;
 const sky=()=>{
  const props={};
  return {props,style:{setProperty:(key,value)=>{props[key]=value;}},
   classList:{add(){},remove(){}}};
 };
 const skies=[sky(),sky()],sector={textContent:''};
 globalThis.document={getElementById:id=>
  id==='sky0'?skies[0]:id==='sky1'?skies[1]:id==='sector'?sector:null};
 try{
  const visuals=new ArcadeVisuals();
  assert.match(skies[0].props['--sector-image'],/nebula_main\.jpg/);
  visuals.updateSky(0,6000);
  const azure=skies[visuals.layer];
  assert.match(azure.props['--sector-image'],/nebula_azure_v1\.png/);
  assert.match(azure.props['--planet-image'],/planet_ice_v1\.png/);
  const before=azure.props['--planet-x'];
  visuals.updateSky(400,6100);
  assert.notEqual(azure.props['--planet-x'],before);
  visuals.updateSky(0,12000);
  const amber=skies[visuals.layer];
  assert.match(amber.props['--sector-image'],/nebula_amber_v1\.png/);
  assert.equal(amber.props['--planet-opacity'],'0');
  assert.equal(sector.textContent,'Янтарные облака');
 }finally{globalThis.document=previous;}
});

test('explosion atlas is prepared once and preserves existing impact particles',()=>{
 const previous=globalThis.document;
 let gradients=0;
 const paint={save(){},restore(){},translate(){},fillRect(){},
  createRadialGradient(){gradients++;return {addColorStop(){}};}};
 globalThis.document={createElement:()=>({
  width:0,height:0,getContext:()=>paint
 })};
 try{
  const effects=new WorldVFX();
  assert.ok(gradients>=100);
  const prepared=gradients;
  new WorldVFX();
  assert.equal(gradients,prepared,'the same texture atlas must be reused');
  effects.shipExplosion(20,30,18,'#ff8866');
  assert.equal(effects.explosions.length,1);
  assert.ok(effects.particles.length>0);
  assert.ok(effects.rings.length>0);
 }finally{globalThis.document=previous;}
});
