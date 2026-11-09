// Physical-key bindings: all checks use KeyboardEvent.code, so keyboard
// layout changes do not silently remap movement while the game is running.
export const CONTROL_STORAGE_KEY='survivor.control-layout.v1';
export const CONTROL_ACTIONS=Object.freeze([
 {id:'up',name:'Вверх',code:'KeyW'},
 {id:'left',name:'Влево',code:'KeyA'},
 {id:'down',name:'Вниз',code:'KeyS'},
 {id:'right',name:'Вправо',code:'KeyD'},
 {id:'dash',name:'Рывок',code:'ShiftLeft'},
 {id:'field',name:'Полевое устройство',code:'Space'},
 {id:'interact',name:'Действие / добыча',code:'KeyE'},
 {id:'cease',name:'Автоогонь',code:'KeyC'},
 {id:'hack',name:'Перепрограммирование',code:'KeyQ'},
 {id:'strike',name:'Авиаудар',code:'KeyB'},
 {id:'howitzer',name:'Гаубица (доп.)',code:'KeyF'},
 {id:'build',name:'Построить турель',code:'KeyT'},
 {id:'railMode',name:'Рельс: авто / вручную',code:'KeyR'},
 {id:'map',name:'Карта',code:'Tab'},
 {id:'skills',name:'Развитие',code:'KeyU'}
]);
export const DEFAULT_CONTROLS=Object.freeze(Object.fromEntries(CONTROL_ACTIONS.map(x=>[x.id,x.code])));
const RESERVED=new Set(['Escape','Enter','Backspace','Delete','CapsLock','NumLock',
 'ArrowUp','ArrowLeft','ArrowDown','ArrowRight','F1','F2','F3','F4','F5','F6',
 'F7','F8','F9','F10','F11','F12','MetaLeft','MetaRight','AltLeft','AltRight',
 'ControlLeft','ControlRight']);
export const readableKey=code=>code==='Space'?'Пробел':code==='Tab'?'Tab':
 code==='ShiftLeft'||code==='ShiftRight'?'Shift':
 code?.startsWith('Key')?code.slice(3):code?.startsWith('Digit')?code.slice(5):code||'?';
export const allowedCode=code=>typeof code==='string'&&!RESERVED.has(code)&&
 (/^Key[A-Z]$/.test(code)||/^Digit[0-9]$/.test(code)||
 ['Space','Tab','ShiftLeft','ShiftRight','Backquote','Minus','Equal','BracketLeft',
  'BracketRight','Semicolon','Quote','Comma','Period','Slash','Backslash'].includes(code));
export function validControls(candidate){
 if(!candidate||typeof candidate!=='object')return false;
 const expected=Object.keys(DEFAULT_CONTROLS);
 if(Object.keys(candidate).length!==expected.length)return false;
 const codes=expected.map(key=>candidate[key]);
 return codes.every(allowedCode)&&new Set(codes).size===codes.length;
}
export function readControls(storage){
 try{const saved=JSON.parse(storage?.getItem(CONTROL_STORAGE_KEY)||'null');
  if(validControls(saved))return saved;
  // Existing players may have remapped every key before construction existed.
  // Keep those choices; assign the new action the first unused suitable key.
  if(saved&&typeof saved==='object'&&!Array.isArray(saved)&&
    Object.keys(saved).length===CONTROL_ACTIONS.length-1&&
    Object.keys(saved).every(k=>k!=='build'&&Object.hasOwn(DEFAULT_CONTROLS,k))){
   const used=new Set(Object.values(saved));
   const free=['KeyT','KeyG','KeyY','KeyH','KeyV'].find(k=>!used.has(k));
   if(free){const migrated={...saved,build:free};
    if(validControls(migrated))return migrated;}
  }
 }catch{}
 return {...DEFAULT_CONTROLS};
}
export function changeControl(bindings,action,code){
 if(!Object.hasOwn(DEFAULT_CONTROLS,action))return {ok:false,reason:'Неизвестное действие'};
 if(!allowedCode(code))return {ok:false,reason:'Эту клавишу нельзя назначить'};
 const conflict=Object.keys(bindings).find(id=>id!==action&&bindings[id]===code);
 if(conflict)return {ok:false,reason:'Клавиша уже используется: '+CONTROL_ACTIONS.find(x=>x.id===conflict).name};
 return {ok:true,bindings:{...bindings,[action]:code}};
}
export const isPressed=(pressed,bindings,action)=>pressed.has((bindings||DEFAULT_CONTROLS)[action]);
// Both familiar map keys work without stealing a key the player has explicitly
// assigned to a different action in the control settings.
export function isMapShortcut(code,bindings=DEFAULT_CONTROLS){
 if(code===bindings.map)return true;
 if(code!=='Tab'&&code!=='KeyM')return false;
 return !Object.entries(bindings).some(([action,key])=>action!=='map'&&key===code);
}
// Tab is kept for keyboard focus navigation once the interactive map is open.
// M (or a remapped non-Tab map key) closes it without stealing another action.
export const isMapCloseShortcut=(code,bindings=DEFAULT_CONTROLS)=>
 code!=='Tab'&&isMapShortcut(code,bindings);

// UI copy inherited from mission descriptions uses E as its interaction token.
export function interactionCopy(text,controls=DEFAULT_CONTROLS){
 const code=controls?.interact;
 const key=readableKey(allowedCode(code)?code:DEFAULT_CONTROLS.interact);
 return String(text).replace(/\bE\b/g,key);
}
