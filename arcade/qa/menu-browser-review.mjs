/**
 * Chromium layout review of the actual station renderer and game styles.
 * The scenario is explicit, so no saved player data or server changes are used.
 * Invoke from repository root: node arcade/qa/menu-browser-review.mjs
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {get} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

const dependencyRoot=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const require=createRequire((dependencyRoot||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules')+'/package.json');
const {chromium}=require('playwright');

const root=resolve(new URL('../../',import.meta.url).pathname);
const folder=process.env.MENU_QA_OUT_DIR||'/tmp/survivor-menu-review';
const base='http://127.0.0.1:48220';
const server=spawn('python3',['-m','http.server','48220','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
const report={screens:[],checks:[],errors:[]};
let browser;
try{
 await mkdir(folder,{recursive:true});
 let ready=false;
 for(let i=0;i<60&&!ready;i++){
  ready=await new Promise(done=>{
   const request=get(base+'/arcade/',response=>{response.resume();done(response.statusCode===200);});
   request.on('error',()=>done(false));request.setTimeout(500,()=>{request.destroy();done(false);});
  });
  if(!ready)await new Promise(done=>setTimeout(done,100));
 }
 assert.ok(ready,'Static review server did not become ready');
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(base+'/arcade/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForSelector('#overlay',{timeout:10000});
 const init=await page.evaluate(async()=>{
  const {renderBasePanel}=await import('/arcade/base-panel.js');
  const {createLoadout,HangarSession}=await import('/arcade/ship-loadout.js');
  const {createTactical}=await import('/arcade/tactical-fields.js');
  const loadout=createLoadout();loadout.slots[1]='ion';loadout.owned.ion=1;
  const session=new HangarSession();session.begin(loadout);
  const dock={id:'0:0',type:'dock',active:true,discovered:true,x:0,y:0};
  const state={ore:20,data:140,hp:38,maxHp:110,shield:0,allies:0,activeBases:2,
   connectedBases:1,connected:true,droneRoles:[],droneDamage:0,charges:0,
   network:{armor:0,engine:0,armament:0,strikePower:0},transfers:[],
   loadout,hangarSession:session,tactical:createTactical(),skillRanks:{beam:2},
   level:4,points:2,xp:15,nextXp:120,time:100,contract:null,operation:null,
   baseTab:'summary',hangarView:'weapons',developmentDomain:'weapons',
   developmentWeapon:'plasma',developmentFocus:'skill-beam',baseActive:true,
   hangarUpgrades:[{id:'beam',title:'Калибровка орудий',rank:2,max:5,from:1,
    effect:'Урон +20%, скорость +8%',desc:'Общая технология автоматического оружия',canBuy:true}],
   pilotSkills:[],pilotDoctrines:[],stationMenuContext:null};
  window.__menuReview={dock,state,renderBasePanel};
  window.__renderMenuReview=tab=>{
   state.baseTab=tab;const overlay=document.getElementById('overlay');
   overlay.hidden=false;overlay.dataset.mode='base';
   overlay.innerHTML=renderBasePanel(dock,state);
   document.getElementById('mobileLaunch')?.setAttribute('hidden','');
  };
  window.__renderMenuReview('summary');
  return {parts:document.querySelectorAll('.base-tabs [role="tab"]').length};
 });
 assert.equal(init.parts,5);
 const snapshot=async(name,tab,viewport)=>{
  await page.setViewportSize(viewport);
  await page.evaluate(tab=>window.__renderMenuReview(tab),tab);
  await page.waitForTimeout(180);
  const metrics=await page.evaluate(()=>{
   const dialog=document.querySelector('.base-dialog');
   const missing=[...dialog.querySelectorAll('img')].filter(img=>img.complete&&img.naturalWidth===0)
    .map(img=>img.getAttribute('src'));
   return {width:dialog.clientWidth,scrollWidth:dialog.scrollWidth,height:dialog.clientHeight,
    scrollHeight:dialog.scrollHeight,visible:!document.getElementById('overlay').hidden,
    tabs:dialog.querySelectorAll('.base-tabs [role="tab"]').length,missing};
  });
  const file=resolve(folder,name+'.png');await page.screenshot({path:file});
  report.screens.push({name,tab,viewport,file,metrics});
  assert.ok(metrics.visible,name+' hides the station dialog');
  assert.ok(metrics.scrollWidth<=metrics.width+8,name+' has horizontal overflow: '+JSON.stringify(metrics));
  assert.equal(metrics.tabs,5);
  return metrics;
 };
 report.checks.push({name:'overview-desktop',...(await snapshot('overview-desktop','summary',{width:1366,height:768}))});
 report.checks.push({name:'weapons-tree-desktop',...(await snapshot('weapons-tree-desktop','development',{width:1366,height:768}))});
 report.checks.push({name:'fitting-desktop',...(await snapshot('fitting-desktop','hangar',{width:1366,height:768}))});
 report.checks.push({name:'overview-mobile',...(await snapshot('overview-mobile','summary',{width:412,height:915}))});
 report.checks.push({name:'fitting-landscape',...(await snapshot('fitting-landscape','hangar',{width:915,height:412}))});
 await page.close();
}finally{
 if(browser)await browser.close();
 server.kill();
 await writeFile(resolve(folder,'report.json'),JSON.stringify(report,null,2)+'\n');
}
if(report.errors.length){console.error('Page errors:',report.errors.join('\n'));process.exitCode=1;}
console.log(JSON.stringify({screens:report.screens,errors:report.errors},null,2));
