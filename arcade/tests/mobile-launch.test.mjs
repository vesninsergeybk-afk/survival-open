import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mobileLaunchCopy,requestMobileFullscreen,mountMobileLaunch} from '../mobile-launch.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../mobile-launch.css',import.meta.url),'utf8');
const hud=readFileSync(new URL('../mobile-hud.css',import.meta.url),'utf8');

test('mobile entry is accessible, explicitly opt-in and loaded before gameplay',()=>{
  for(const id of ['mobileLaunch','mobileLaunchTitle','mobileLaunchHint','mobileFullscreenBtn',
    'mobileContinueBtn','mobileLaunchError','exitFullscreenBtn']){
    assert.match(html,new RegExp(`id="${id}"`),`${id} missing`);
  }
  assert.match(html,/id="mobileLaunch"[^>]+aria-modal="true"/);
  assert.match(html,/mobile-launch\.css\?v=/);
  assert.ok(html.indexOf('mobile-launch.js?v=')<html.indexOf('game.js?v='));
  assert.match(css,/@media \(pointer:coarse\)/);
  assert.match(css,/@media \(pointer:coarse\) and \(orientation:landscape\)/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(hud,/#audioCredits::before/,'compact mobile credits are reachable');
});

test('screen copy describes phone rotation in natural Russian',()=>{
  assert.match(mobileLaunchCopy(true).title,/Поверните телефон горизонтально/);
  assert.match(mobileLaunchCopy(false).title,/Играть на весь экран/);
});

test('fullscreen always requests user activation first; orientation failure is nonfatal',async()=>{
  const calls=[];
  const root={async requestFullscreen(){calls.push('screen')}};
  const orientation={async lock(value){calls.push(value);throw Error('rotation disabled')}};
  assert.deepEqual(await requestMobileFullscreen(root,orientation),{entered:true});
  assert.deepEqual(calls,['screen','landscape']);
  assert.deepEqual(await requestMobileFullscreen({},orientation),{entered:false,reason:'unsupported'});
  assert.deepEqual(await requestMobileFullscreen({requestFullscreen:async()=>{throw Error('denied')}},orientation),
    {entered:false,reason:'blocked'});
});

test('touch entry offers a browser fallback and exits without trapping the player',async()=>{
  const nodes=new Map();
  function node(id){
    if(!nodes.has(id))nodes.set(id,{
      id,hidden:true,disabled:false,textContent:'',listeners:{},
      addEventListener(type,callback){this.listeners[type]=callback},
      click(){return this.listeners.click?.()}
    });
    return nodes.get(id);
  }
  const classes=new Set();
  let landscape=false;
  const doc={
    body:{classList:{add:key=>classes.add(key),remove:key=>classes.delete(key)}},
    documentElement:{requestFullscreen:async()=>{doc.fullscreenElement=doc.documentElement}},
    fullscreenElement:null,
    listeners:{},getElementById:node,
    addEventListener(type,callback){this.listeners[type]=callback},
    exitFullscreen:async()=>{doc.fullscreenElement=null}
  };
  const win={
    navigator:{},screen:{orientation:{lock:async()=>{}}},listeners:{},
    matchMedia(query){return {matches:query.includes('pointer: coarse') ||
      (query.includes('orientation: portrait')&&!landscape)}},
    addEventListener(type,callback){this.listeners[type]=callback},
    requestAnimationFrame:callback=>callback(),dispatchEvent:()=>{}
  };
  mountMobileLaunch(doc,win);
  assert.equal(node('mobileLaunch').hidden,false);
  assert.equal(classes.has('mobile-launch-open'),true);
  assert.match(node('mobileLaunchTitle').textContent,/Поверните телефон/);
  landscape=true;win.listeners.resize();
  assert.equal(node('mobileLaunchTitle').textContent,'Играть на весь экран');
  await node('mobileFullscreenBtn').click();
  assert.equal(node('mobileLaunch').hidden,true);
  assert.equal(node('exitFullscreenBtn').hidden,false);
  await node('exitFullscreenBtn').click();
  doc.listeners.fullscreenchange();
  assert.equal(node('exitFullscreenBtn').hidden,true);
  // The player may always opt out of the prompt before entering fullscreen.
  doc.fullscreenElement=null;node('mobileLaunch').hidden=false;
  node('mobileContinueBtn').click();
  assert.equal(node('mobileLaunch').hidden,true);
});
