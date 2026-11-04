// One-time entry choice for a mobile browser session. The game itself remains
// usable if the browser refuses fullscreen or orientation locking.
export function mobileLaunchCopy(portrait) {
  return portrait
    ? {title:'Поверните телефон горизонтально',hint:'Так удобнее управлять кораблём и видеть происходящее.'}
    : {title:'Играть на весь экран',hint:'Браузер скроет свои панели — для игры останется больше места.'};
}

export async function requestMobileFullscreen(root,orientation) {
  if(typeof root?.requestFullscreen!=='function')return {entered:false,reason:'unsupported'};
  try {
    // Must run directly after a click: browsers require a user gesture.
    await root.requestFullscreen();
  }catch {
    return {entered:false,reason:'blocked'};
  }
  try {
    if(typeof orientation?.lock==='function')await orientation.lock('landscape');
  }catch {
    // A disabled auto-rotate setting must not block play.
  }
  return {entered:true};
}

export function mountMobileLaunch(doc=globalThis.document,win=globalThis.window) {
  if(!doc||!win||!win.matchMedia('(pointer: coarse)').matches)return;
  const prompt=doc.getElementById('mobileLaunch');
  const title=doc.getElementById('mobileLaunchTitle');
  const hint=doc.getElementById('mobileLaunchHint');
  const enter=doc.getElementById('mobileFullscreenBtn');
  const skip=doc.getElementById('mobileContinueBtn');
  const error=doc.getElementById('mobileLaunchError');
  const exit=doc.getElementById('exitFullscreenBtn');
  if(!prompt||!title||!hint||!enter||!skip||!error||!exit)return;

  const installed=win.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches
    || win.navigator?.standalone===true;
  const portrait=()=>win.matchMedia('(orientation: portrait)').matches;
  const close=()=>{prompt.hidden=true;doc.body.classList.remove('mobile-launch-open');};
  const sync=()=>{
    const copy=mobileLaunchCopy(portrait());
    title.textContent=copy.title;
    hint.textContent=copy.hint;
    exit.hidden=!Boolean(doc.fullscreenElement);
    if(doc.fullscreenElement&&!portrait())close();
  };

  if(!installed){
    prompt.hidden=false;
    doc.body.classList.add('mobile-launch-open');
    if(typeof doc.documentElement.requestFullscreen!=='function'){
      enter.disabled=true;
      error.hidden=false;
      error.textContent='Этот браузер не поддерживает полноэкранный режим. Можно продолжить обычным способом.';
    }
  }
  sync();

  skip.addEventListener('click',close);
  enter.addEventListener('click',async()=>{
    enter.disabled=true;
    error.hidden=true;
    const result=await requestMobileFullscreen(doc.documentElement,win.screen?.orientation);
    if(!result.entered){
      enter.disabled=false;
      error.hidden=false;
      error.textContent='Браузер не разрешил развернуть игру. Откройте ссылку в Chrome или выберите «Играть в браузере».';
      return;
    }
    sync();
    if(!portrait())close();
    else enter.disabled=false;
  });
  exit.addEventListener('click',()=>{
    if(doc.fullscreenElement&&typeof doc.exitFullscreen==='function'){
      doc.exitFullscreen().catch(()=>{});
    }
  });
  doc.addEventListener('fullscreenchange',()=>{
    sync();
    // The simulation already resizes on window.resize. This also covers
    // browsers that dispatch fullscreenchange but delay the resize event.
    win.requestAnimationFrame(()=>win.dispatchEvent(new Event('resize')));
  });
  win.addEventListener('resize',sync);
}

if(typeof document!=='undefined'&&typeof window!=='undefined')mountMobileLaunch();
