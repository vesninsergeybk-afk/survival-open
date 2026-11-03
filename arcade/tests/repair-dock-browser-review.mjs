/**
 * Real Chromium smoke review of the U-shaped repair dock in an isolated preview
 * and in the running Survivor arcade. No production changes or gameplay inputs.
 *
 * Requires Playwright at PUBLIC_REVIEW_DEPS, invoked from workflow container.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {get} from 'node:http';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const project=resolve(new URL('../../../../../',import.meta.url).pathname);
const site=resolve(project,'site');
const folder=resolve(project,'quality/survivor-dock-review');
const require=createRequire((process.env.PUBLIC_REVIEW_DEPS||'/tmp/survivor-dock-review')+'/package.json');
const {chromium}=require('playwright');
const base='http://127.0.0.1:45917';
const server=spawn('python3',['-m','http.server','45917','--bind','127.0.0.1','--directory',site],{stdio:'ignore'});
const report={source:process.env.GITHUB_SHA||'local',checks:[],warnings:[],screenshots:[]};
let browser;
async function check(name,fn){
 try{await fn();report.checks.push({name,ok:true});console.log('PASS',name);}
 catch(e){report.checks.push({name,ok:false,error:String(e.stack||e)});console.error('FAIL',name,e);}
}
try{
 await mkdir(folder,{recursive:true});
 let started=false;
 for(let i=0;i<80;i++){
  const ok=await new Promise(resolve=>{
   const req=get(base+'/',res=>{const success=res.statusCode===200;
    res.resume();res.on('end',()=>resolve(success));});
   req.on('error',()=>resolve(false));req.setTimeout(1000,()=>{req.destroy();resolve(false);});
  });
  if(ok){started=true;break;}
  await new Promise(r=>setTimeout(r,100));
 }
 assert.ok(started,'Local static site server did not start');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await check('actual SVG loads and three real-size preview canvases exist',async()=>{
  const res=await page.goto(base+'/games/survivor/arcade/repair-dock-preview.html',{waitUntil:'domcontentloaded',timeout:25000});
  assert.equal(res.status(),200);
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Основной SVG загружен'),null,{timeout:15000});
  assert.equal(await page.locator('.card canvas').count(),3);
  assert.equal(await page.locator('.card canvas').first().getAttribute('width'),'224');
 });
 await check('U-shape is opaque on both arms but transparent in its upper mouth',async()=>{
  const sample=await page.locator('.card canvas').first().evaluate(c=>{
   const ctx=c.getContext('2d');
   const a=(x,y)=>ctx.getImageData(x,y,1,1).data[3];
   return {left:a(50,45),mouth:a(112,45),right:a(174,45)};
  });
  assert.ok(sample.left>80&&sample.right>80,'U arms are invisible: '+JSON.stringify(sample));
  assert.ok(sample.mouth<50,'Dock entrance is blocked/closed: '+JSON.stringify(sample));
 });
 await check('power, link and damage remain independently controllable',async()=>{
  await page.locator('[data-action="power"]').click();
  await page.waitForFunction(()=>document.querySelector('.card small')?.textContent?.includes('АВТОНОМНО'),null,{timeout:3000});
  await page.locator('[data-action="link"]').click();
  await page.waitForFunction(()=>document.querySelector('.card small')?.textContent==='СЕТЬ',null,{timeout:3000});
  await page.locator('[data-action="damage"]').click();
  await page.locator('[data-action="repair"]').click();
  await page.waitForTimeout(350);
  await page.locator('[data-action="service"]').click();
 });

 await check('repair claws move and the finished event leaves no ghost pixels',async()=>{
  const result=await page.evaluate(async()=>{
   const {drawRepairDock,markDockEvent}=await import('/games/survivor/arcade/repair-dock-art.js?v=dock-identity-1');
   const base={id:'0:0',type:'dock',x:0,y:0,active:true,
    captured:false,usedUpgrade:false,hp:760,maxHp:760};
   const frame=()=>{
    const canvas=document.createElement('canvas');
    canvas.width=224;canvas.height=224;
    const c=canvas.getContext('2d');c.translate(112,112);
    drawRepairDock(c,base,7,{connected:false,reducedMotion:false});
    return new Uint8ClampedArray(c.getImageData(0,0,224,224).data);
   };
   const first=frame();
   markDockEvent(base,'repair',7-0.775);
   const moving=frame();
   // The event has ended; the exact same physical scene must reappear.
   base.stationVisualEvent.at=7-2;
   const ended=frame();
   let changed=0,leftover=0;
   for(let i=0;i<first.length;i+=4){
    if(first[i]!==moving[i]||first[i+1]!==moving[i+1]||
       first[i+2]!==moving[i+2]||first[i+3]!==moving[i+3])changed++;
    if(first[i]!==ended[i]||first[i+1]!==ended[i+1]||
       first[i+2]!==ended[i+2]||first[i+3]!==ended[i+3])leftover++;
   }
   return {changed,leftover};
  });
  assert.ok(result.changed>45,'Maintenance motion not visible: '+JSON.stringify(result));
  assert.equal(result.leftover,0,'Expired effect leaves visible ghosts');
 });
 await page.screenshot({path:resolve(folder,'dock-gallery.png'),fullPage:true});
 report.screenshots.push('dock-gallery.png');
 await check('three stations draw on the comparison board without script errors',async()=>{
  const res=await page.goto(base+'/games/survivor/arcade/station-silhouette-board.html',{waitUntil:'domcontentloaded',timeout:20000});
  assert.equal(res.status(),200);
  assert.equal(await page.locator('canvas').count(),4);
  await page.locator('#names').click();
  assert.equal(await page.locator('.card h2:visible').count(),0);
 });
 await page.screenshot({path:resolve(folder,'station-silhouettes.png'),fullPage:true});
 report.screenshots.push('station-silhouettes.png');
 await check('arcade runs and shows new station without a JavaScript exception',async()=>{
  const res=await page.goto(base+'/games/survivor/arcade/',{waitUntil:'domcontentloaded',timeout:25000});
  assert.equal(res.status(),200);
  await page.locator('#game').waitFor({state:'visible',timeout:15000});
  await page.waitForTimeout(1500);
  const dim=await page.locator('#game').evaluate(c=>({width:c.width,height:c.height}));
  assert.ok(dim.width>=300&&dim.height>=200,'Invalid playable canvas: '+JSON.stringify(dim));
 });
 await page.screenshot({path:resolve(folder,'dock-in-game.png')});
 report.screenshots.push('dock-in-game.png');
 await check('no uncaught errors on the reviewed pages',async()=>assert.deepEqual(errors,[]));
 await page.close();
}finally{
 if(browser)await browser.close();
 server.kill();
 await writeFile(resolve(folder,'review.json'),JSON.stringify(report,null,2)+'\n');
}
if(report.checks.some(x=>!x.ok))process.exitCode=1;
