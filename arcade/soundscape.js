/**
 * Recorded sound cues for the arcade. Names match SOUND_CATALOG.
 * All actual audio comes from verified OGG samples in the shared mixer.
 * These scene cues are sparse; they do not compete with the licensed score.
 */
const plan = (key,intensity=1) => Object.freeze([{key,intensity}]);
const UI = Object.freeze({
 open:plan('ui_open'),map:plan('ui_map'),tab:plan('ui_tab'),
 dock:plan('ui_dock'),close:plan('ui_close'),select:plan('ui_select'),
 confirm:plan('ui_confirm'),deny:plan('ui_deny'),cancel:plan('ui_cancel'),
 slider:plan('ui_slider'),audioOn:plan('ui_audio_on')
});
const WORLD = Object.freeze({
 discover:plan('world_discover'),amber:plan('world_amber'),
 ion:plan('world_ion'),contract:plan('world_contract')
});
const SCENE = Object.freeze({
 drift:[],alert:plan('scene_alert'),battle:plan('scene_battle'),
 siege:plan('scene_siege'),recovery:plan('scene_recovery')
});
const AMBIENT = Object.freeze({
 void:plan('ambient_void'),station:plan('ambient_station'),
 extraction:[],alert:plan('ambient_alert'),battle:plan('ambient_battle'),
 siege:plan('ambient_siege')
});
export const uiSoundPlan=kind=>UI[kind]||[];
export const worldSoundPlan=kind=>WORLD[kind]||[];
export const sceneSoundPlan=scene=>SCENE[scene]||[];
export const ambientSoundPlan=kind=>AMBIENT[kind]||[];
export class AmbientSoundClock {
 constructor(){this.elapsed=0;this.nextAt=13;this.number=0;}
 tick(dt,{scene='drift',nearStation=false,mining=false,paused=false}={}){
  if(paused)return null;
  this.elapsed+=Math.max(0,Math.min(4,Number(dt)||0));
  if(this.elapsed<this.nextAt)return null;
  this.number++;
  this.nextAt=this.elapsed+13+(this.number%3)*2.5;
  return scene==='siege'?'siege':scene==='battle'?'battle':
   scene==='alert'?'alert':mining?'extraction':
   nearStation?'station':'void';
 }
}
