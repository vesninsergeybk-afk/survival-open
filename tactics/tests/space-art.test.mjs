import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSpaceScene,drawSpaceBackdrop,loadSpaceClouds,SPACE_PALETTES} from '../space-art.js';

function fakeCanvas(){
 const calls=[];
 const gradient=()=>({addColorStop(offset,color){
  assert.ok(offset>=0&&offset<=1);
  assert.equal(typeof color,'string');
 }});
 const ctx={
  fillStyle:'#fff',strokeStyle:'#fff',globalAlpha:1,lineWidth:1,
  save(){calls.push(['save'])},restore(){calls.push(['restore'])},
  fillRect(...a){assert.ok(a.every(Number.isFinite));calls.push(['rect',...a,this.globalAlpha])},
  beginPath(){},arc(...a){assert.ok(a.every(Number.isFinite));calls.push(['arc',...a])},
  ellipse(...a){assert.ok(a.every(Number.isFinite));calls.push(['ellipse',...a])},
  fill(){},stroke(){},translate(){},rotate(){},moveTo(){},lineTo(){},
  drawImage(...a){calls.push(['image',...a.slice(1)])},
  createLinearGradient(...a){assert.ok(a.every(Number.isFinite));return gradient()},
  createRadialGradient(...a){assert.ok(a.every(Number.isFinite));return gradient()}
 };
 return {ctx,calls};
}
const cam={x:900,y:530,s:.8};
const view={w:1152,h:680,dpr:1};

test('all mission skies are deterministically generated without touching gameplay RNG',()=>{
 for(let mission=0;mission<4;mission++){
  const a=createSpaceScene(1729,mission),b=createSpaceScene(1729,mission);
  assert.deepEqual(a,b);
  assert.equal(a.mission,mission);
  assert.equal(a.layers.length,3);
  assert.equal(a.layers.reduce((n,x)=>n+x.stars.length,0),241);
  for(const layer of a.layers)for(const star of layer.stars)
   assert.ok(star.x>=0&&star.x<1&&star.y>=0&&star.y<1);
  assert.ok(SPACE_PALETTES[mission].glow.startsWith('#'));
 }
 assert.notDeepEqual(createSpaceScene(1729,0),createSpaceScene(1730,0));
 assert.notEqual(createSpaceScene(1729,0).palette,createSpaceScene(1729,1).palette);
});

test('full parallax renders safely on desktop and mobile when images are unavailable',()=>{
 const s=createSpaceScene(8025,2);
 for(const screen of [view,{w:360,h:275,dpr:2}]){
  const {ctx,calls}=fakeCanvas();
  drawSpaceBackdrop(ctx,s,[],screen,cam,120000);
  assert.ok(calls.filter(x=>x[0]==='rect').length>120);
  assert.equal(calls.filter(x=>x[0]==='save').length,calls.filter(x=>x[0]==='restore').length);
 }
});

test('parallax actually responds to camera pan but remains still with reduced motion',()=>{
 const scene=createSpaceScene(4500,3),a=fakeCanvas(),b=fakeCanvas(),c=fakeCanvas();
 drawSpaceBackdrop(a.ctx,scene,[],view,cam,1000,{reducedMotion:true});
 drawSpaceBackdrop(b.ctx,scene,[],view,cam,49000,{reducedMotion:true});
 assert.deepEqual(a.calls,b.calls,'reduced-motion scene is identical at different timestamps');
 drawSpaceBackdrop(c.ctx,scene,[],view,{x:1100,y:660,s:cam.s},1000,{reducedMotion:true});
 assert.notDeepEqual(a.calls,c.calls,'camera motion moves star layers and nebulae');
});

test('fallback mode is simpler and does not render planet or nebula cloud images',()=>{
 const scene=createSpaceScene(1741,0),a=fakeCanvas(),b=fakeCanvas();
 const fakeImages=Array.from({length:5},()=>({complete:true,naturalWidth:512}));
 drawSpaceBackdrop(a.ctx,scene,fakeImages,view,cam,0);
 drawSpaceBackdrop(b.ctx,scene,fakeImages,view,cam,0,{simple:true});
 assert.ok(a.calls.filter(x=>x[0]==='image').length>0);
 assert.equal(b.calls.filter(x=>x[0]==='image').length,0);
 assert.ok(a.calls.length>b.calls.length);
 assert.deepEqual(loadSpaceClouds(()=>{},null),[]);
});

test('the art toggle and loading paths only affect tactics, not rules or the classic arcade',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 for(const token of ['id="cosmos-toggle"','protocol-cosmos-1','../arcade/'])assert.ok(html.includes(token),token);
 assert.match(js,/drawSpaceBackdrop\(/);
 assert.match(js,/seedStars\(\)/);
 assert.match(js,/backgroundSimple=!backgroundSimple/);
 assert.match(css,/#cosmos-toggle/);
});
