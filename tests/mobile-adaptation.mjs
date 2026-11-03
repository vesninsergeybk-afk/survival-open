import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const strip=s=>s.replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'')
    .replace(/^(\s*)export\s+/gm,'$1')
    .replaceAll('import.meta.url',"'https://game.invalid/src/module.js'");
const layout=read('src/mobile-layout.js');
const input=read('src/input.js');
const ui=read('src/ui.js');
const main=read('src/main.js');
const mission=read('src/mission-world.js');
const css=read('styles.css');
const html=read('index.html');
const sw=read('service-worker.js');
const galaxy=read('src/galaxy-map.js');

for(const [name,src] of [['viewport',layout],['input',input],
    ['main',main],['mission',mission],['ui',ui],['galaxy',galaxy]])
    assert.doesNotThrow(()=>new Function(strip(src)),name+' syntax');

// A phone fills its viewport, with a bounded render buffer for mobile GPUs.
// A desktop retains its established 1200×800 world coordinate system.
const plan=new Function(strip(layout)+'\nreturn planSurvivorViewport;')();
const portrait=plan({width:390,height:844,coarsePointer:true,devicePixelRatio:3});
assert.deepEqual([portrait.cssWidth,portrait.cssHeight],[390,844]);
assert.deepEqual([portrait.logicalWidth,portrait.logicalHeight],[557,1206]);
assert.deepEqual([portrait.backingWidth,portrait.backingHeight],[585,1266]);
const landscape=plan({width:844,height:390,coarsePointer:true,devicePixelRatio:3});
assert.deepEqual([landscape.cssWidth,landscape.cssHeight],[844,390]);
assert.equal(landscape.logicalHeight,500);
const tablet=plan({width:1200,height:800,coarsePointer:true,devicePixelRatio:2});
assert.equal(tablet.mobile,true,'wide touch tablets retain the touch cockpit');
for(const [width,height] of [[960,540],[1080,480],[640,360]]) {
    const viewport=plan({width,height,coarsePointer:true,devicePixelRatio:3});
    assert.equal(viewport.mobile,true,`${width}x${height} uses touch controls`);
    assert.deepEqual([viewport.cssWidth,viewport.cssHeight],[width,height]);
    assert.ok(viewport.backingWidth<=Math.round(width*1.5));
}
assert.equal(plan({width:1440,height:900,coarsePointer:true}).mobile,false);
const desktop=plan({width:1440,height:900,coarsePointer:false,devicePixelRatio:1});
assert.deepEqual([desktop.logicalWidth,desktop.logicalHeight],[1200,800]);
assert.deepEqual([desktop.backingWidth,desktop.backingHeight],[1200,800]);

// Check the resize actually configures camera dimensions AND canvas transform.
const resizeBody=main.match(/    _resize\(\) \{([\s\S]*?)\n    \}\n\n    \/\*\* Docking/)?.[1];
assert.ok(resizeBody,'resize method found');
const transforms=[];
const fakeWindow={innerWidth:390,innerHeight:844,devicePixelRatio:3,
    matchMedia(){return {matches:true};}};
const cfg={CANVAS_WIDTH:1200,CANVAS_HEIGHT:800};
const canvas={width:1200,height:800};
const container={style:{}};
const layoutFlags=new Map();
const notice={attributes:{},focused:0,
    setAttribute(key,val){this.attributes[key]=val;},
    focus(){this.focused++;}};
const fakeDoc={getElementById(id){return id==='gameContainer'?container:
        id==='landscapeNotice'?notice:null;},
    body:{classList:{toggle(key,val){layoutFlags.set(key,val);}}}};
const resize=new Function('CONFIG','planSurvivorViewport','window','document','navigator','GameState',
    'return function(){'+resizeBody+'}')(cfg,plan,fakeWindow,fakeDoc,{maxTouchPoints:5},
    {PLAYING:'playing'});
let autoPauses=0;
let journalCloses=0;
const game={canvas,ctx:{setTransform(...v){transforms.push(v);}},_updateCamera(){},
    state:'playing',missionLog:{isOpen(){return true;},close(){journalCloses++;}},
    togglePause(){autoPauses++;this.state='paused';}};
resize.call(game);
assert.deepEqual([cfg.CANVAS_WIDTH,cfg.CANVAS_HEIGHT],[557,1206]);
assert.equal(container.style.height,'844px');
assert.equal(transforms.length,1);
assert.equal(autoPauses,1,'rotating into portrait pauses a live run once');
assert.equal(journalCloses,1,'mission journal does not swallow automatic pause');
assert.equal(notice.attributes['aria-hidden'],'false');
assert.equal(layoutFlags.get('survivor-needs-landscape'),true);
assert.equal(notice.focused,1);
resize.call(game);
assert.equal(autoPauses,1,'duplicate resize does not pause twice');
fakeWindow.innerWidth=960;fakeWindow.innerHeight=540;
resize.call(game);
assert.equal(layoutFlags.get('survivor-needs-landscape'),false);
assert.equal(notice.attributes['aria-hidden'],'true');
assert.equal(game.state,'paused','rotating back never resumes combat unexpectedly');

// Multi-finger movement: releasing the ability-button finger must not
// stop the joystick finger, regardless of touches[] order.
class Bus {
    constructor(){this.map=new Map();}
    addEventListener(name,fn){this.map.set(name,[...(this.map.get(name)||[]),fn]);}
    removeEventListener(name,fn){this.map.set(name,(this.map.get(name)||[]).filter(x=>x!==fn));}
    emit(name,e){for(const fn of this.map.get(name)||[])fn(e);}
}
const win=new Bus(),doc=new Bus(),field={};
doc.getElementById=id=>id==='gameCanvas'?field:null;
const InputManager=new Function('window','document','DEFAULT_KEYMAP','cloneKeymap',
    strip(input)+'\nreturn InputManager;')(win,doc,{},x=>x);
const manager=new InputManager();
const base=new Bus();
base.getBoundingClientRect=()=>({left:0,top:0,width:140,height:140});
const knob={offsetWidth:58,style:{}};
manager.attachJoystick(base,knob);
const finger=(identifier,clientX,clientY)=>({identifier,clientX,clientY});
const event=(changedTouches,touches)=>({changedTouches,touches,preventDefault(){}});
base.emit('touchstart',event([finger(7,70,70)],[finger(7,70,70)]));
win.emit('touchmove',event([finger(9,245,102)],[finger(9,245,102),finger(7,104,70)]));
const vx=manager.touchVec.x;
assert.ok(vx>.4);
win.emit('touchend',event([finger(9,245,102)],[finger(7,104,70)]));
assert.equal(manager.touchVec.x,vx);
win.emit('touchend',event([finger(7,104,70)],[]));
assert.equal(manager.touchVec.x,0);
base.emit('touchstart',event([finger(4,75,70)],[finger(4,75,70)]));
win.emit('touchcancel',event([finger(4,75,70)],[]));
assert.equal(manager.touchVec.x,0);
manager.detach();

// No false "skill" button. The mobile action rail is composed of real actions.
assert.doesNotMatch(html,/id="specialSkillBtn"/);
assert.match(css,/\.mission-stasis \{ bottom: calc\(56px/);
assert.match(css,/\.mission-repair \{ bottom: calc\(109px/);
assert.match(css,/\.dock-action \{ bottom: calc\(162px/);
assert.match(css,/\.mission-action \{ bottom: calc\(215px/);
assert.match(css,/safe-area-inset-bottom/);
assert.match(mission,/mobileControls\?'':' · E'/);
assert.match(mission,/message\.replace\(\/ · E/);
assert.match(html,/touch-control-tip/);
assert.match(css,/\.desktop-control-tip \{ display: none/);
assert.match(html,/id="landscapeNotice"/);
assert.match(html,/id="landscapeFullscreen"/);
assert.match(html,/sw-reloaded-perf-981/);
assert.match(main,/survivor-needs-landscape/);
assert.match(css,/body\.survivor-needs-landscape \.landscape-notice/);
assert.match(css,/touch-action: pan-y/);
assert.match(css,/max-height: 620px/);
assert.match(sw,/vesnin-survivor-ru-performance-981/);
assert.match(html,/Космический выпуск 9\.8\.1/);
assert.match(css,/9\.7\.1 · Navigation map for short landscape touch screens/);
const mapMobile=css.slice(css.indexOf('/* 9.7.1 · Navigation map'));
assert.match(mapMobile,/grid-template-columns: minmax\(0, 1fr\) minmax\(120px, 20vw\)/);
assert.match(mapMobile,/\.galaxy-map-controls button, \.galaxy-map-close \{[^}]*min-height: 44px/s);
assert.match(mapMobile,/\.galaxy-map-aside \{[^}]*overflow-y: auto/s);
assert.match(html,/styles\.css\?v=mobile-974/);
assert.match(sw,/vesnin-survivor-ru-performance-981/);

// The tutorial's skip action must be tappable, remain stable across frames,
// persist its dismissal, and describe the actual phone controls.
const tutorialBody=main.match(/    _renderTutorialBanner\(\) \{([\s\S]*?)\n    \}\n\n    \/\*\*\n     \* iter-15: open/)?.[1];
assert.ok(tutorialBody,'tutorial rendering method found');
let renderCount=0, saved=0, skipAction;
const tutorialBanner={
    style:{display:'none'},setAttribute(){},
    set innerHTML(html){this._html=html;renderCount++;},
    get innerHTML(){return this._html;},
    querySelector(){return {addEventListener(_event,handler){skipAction=handler;}};}
};
const touchDocument={
    createElement(){return tutorialBanner;},
    getElementById(){return {appendChild(){}};}
};
const tutorialRun={
    active:true,completed:false,step:'move',
    currentPrompt(){return this.active?{
        id:this.step,title:'Шаг обучения',body:'Нажмите Esc',
    }:null;},
    skip(){this.active=false;}
};
const renderTutorial=new Function('document','window','saveSave','_t',
    'return function(){'+tutorialBody+'}')(touchDocument,
    {matchMedia(){return {matches:true};},removeEventListener(){}},
    ()=>{saved++;},()=>'' );
const tutorialGame={
    tutorial:tutorialRun,save:{flags:{}},_tutorialKeyHandler:null,
    _renderTutorialBanner(){renderTutorial.call(this);}
};
renderTutorial.call(tutorialGame);
renderTutorial.call(tutorialGame);
assert.equal(renderCount,1,'the same skip button survives repeated game frames');
assert.match(tutorialBanner.innerHTML,/джойстиком внизу слева/);
assert.doesNotMatch(tutorialBanner.innerHTML,/Нажмите Esc/);
tutorialRun.step='pause';
renderTutorial.call(tutorialGame);
assert.equal(renderCount,2);
assert.match(tutorialBanner.innerHTML,/пауз.*правом верхнем углу/);
skipAction();
assert.equal(tutorialRun.active,false);
assert.equal(tutorialBanner.style.display,'none');
assert.equal(tutorialGame.save.flags.tutorialDone,true);
assert.equal(saved,1);
assert.match(css,/\.tutorial-banner \.tutorial-skip-button \{[^}]*min-height: 44px/s);
assert.match(html,/src\/main\.js\?v=perf-981/);

// How-to and keymap help must switch to actual phone controls.
const howtoBody=ui.match(/    showHowToPlay\(onClose\) \{([\s\S]*?)\n    \}\n\n    hideHowToPlay/)?.[1];
const helpBody=ui.match(/    showHelp\(onClose\) \{([\s\S]*?)\n    \}\n\n    hideHelp/)?.[1];
assert.ok(howtoBody);
assert.ok(helpBody);
const touchWindow={matchMedia(){return {matches:true};}};
const menuNode={
    innerHTML:'',style:{},
    querySelector(){return {addEventListener(){}};}
};
const howto=new Function('window','t','return function(onClose){'+howtoBody+'}')(
    touchWindow, key=>'desktop '+key);
howto.call({els:{howToPlayScreen:menuNode}});
assert.match(menuNode.innerHTML,/джойстиком внизу слева/);
assert.match(menuNode.innerHTML,/экранными кнопками справа вверху/);
assert.doesNotMatch(menuNode.innerHTML,/WASD|Esc/);
const help=new Function('window','t','return function(onClose){'+helpBody+'}')(
    touchWindow, key=>'desktop '+key);
help.call({els:{helpScreen:menuNode}});
assert.match(menuNode.innerHTML,/Карта мира/);
assert.match(menuNode.innerHTML,/Действие миссии/);
assert.doesNotMatch(menuNode.innerHTML,/WASD|Esc/);
assert.match(main,/from '\.\/ui\.js\?v=perf-981'/);
assert.match(sw,/\.\/src\/ui\.js\?v=perf-981/);
// 9.7.4: fullscreen is reachable from HUD, menu, chart and rotation cue.
for (const id of ['btnFullscreen','btnMenuFullscreen','btnMapFullscreen','landscapeFullscreen'])
    assert.match(html,new RegExp('id="'+id+'"'));
assert.match(html,/document\.addEventListener\('fullscreenchange', syncFullscreen\)/);
assert.match(html,/gameRoot\.requestFullscreen\(\)/);
assert.match(html,/document\.exitFullscreen\(\)/);
assert.match(html,/orientation\?\.lock\?\.\('landscape'\)/);
assert.match(html,/id="mainMenuGuide" class="main-menu-details"/);
assert.match(html,/id="mainMenuCredits" class="main-menu-details credits-details"/);
assert.match(css,/9\.7\.4 · Compact landscape cockpit, map and fullscreen controls/);
assert.match(css,/\.galaxy-map-header \{ display: flex; flex-wrap: nowrap/);
assert.match(css,/\.skill-path \{\s*min-width: 0;\s*grid-template-columns: repeat\(3,/s);
assert.match(ui,/_rehomeSkillOverlay\(\)/);
assert.match(ui,/full\.contains\?\.\(this\._skillOriginalParent\)/);
assert.match(main,/from '\.\/galaxy-map\.js\?v=mobile-974'/);
// 800×200 CSS pixels must not retain the previous 960×600 backing ratio.
const planMap=new Function(strip(galaxy)+'\nreturn planMapCanvas;')();
assert.deepEqual(planMap(800,200,3),{
    cssWidth:800,cssHeight:200,pixelRatio:1.5,
    backingWidth:1200,backingHeight:300
});
assert.deepEqual(planMap(480,250,1),{
    cssWidth:480,cssHeight:250,pixelRatio:1,
    backingWidth:480,backingHeight:250
});
assert.match(galaxy,/resizeCanvas\(\)/);
assert.match(galaxy,/this\.mapSize\?\.cssWidth\|\|this\.canvas\.width/);
assert.match(galaxy,/ctx\.setTransform\?\.\(this\.canvas\.width\/w/);
assert.match(sw,/src\/galaxy-map\.js\?v=mobile-974/);
console.log('Survivor landscape 9.8: full screen, compact menus, dynamic map backing, skill top layer, touch OK');

