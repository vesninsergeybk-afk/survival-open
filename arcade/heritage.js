import {WorldVFX} from '../src/world-vfx.js?v=explosion-grammar-01';
import {AudioEngine} from '../src/audio.js?v=audio-fidelity-01';
import {AdaptiveMusicDirector, MUSIC_SCENES, spatialCue} from './audio-director.js?v=audio-fidelity-01';
import {AmbientSoundClock,uiSoundPlan,worldSoundPlan,sceneSoundPlan,ambientSoundPlan} from './soundscape.js?v=audio-fidelity-01';

const STORAGE_KEY='survivor_arcade_audio_v2';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const LEVELS={dock:83,carrier:69,arsenal:96,lab:113,outpost:125};
const SOUND_IDS=Object.freeze({
 laser:'starter_soft',rocket:'knife',enemyShot:'magic_wand',
 hit:'hit',
 explosion:'explosion_small',rocketImpact:'explosion_small',largeExplosion:'explosion_big',
 armorHit:'armor_hit',
 pickup:'pickup',levelUp:'level_up',damage:'player_damage',
 death:'player_death',hack:'base_resonance_link',boss:'boss_spawn',
 boost:'engine',allyShot:'orbit',ramWarning:'boss_warning',
 strikeCall:'drone_swarm',orbitalWarning:'base_raid_warning',
 ionWarning:'boss_warning',criticalHull:'boss_warning',
 droneDestroyed:'explosion_small',capturedBase:'base_resonance_link',
 upgrade:'upgrade_standard',doctrine:'unlock_tech_tier'
});
function storedVolumes(){
 try{
  const values=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
  const saved=(name,fallback)=>{
   const n=Number(values[name]);
   return values[name]==null||!Number.isFinite(n)?fallback:clamp(n,0,1);
  };
  return {masterVolume:saved('masterVolume',.5),
   sfxVolume:saved('sfxVolume',.7),musicVolume:saved('musicVolume',.27)};
 }catch{return {masterVolume:.5,sfxVolume:.7,musicVolume:.27};}
}
export class ArcadeHeritage {
 constructor(){
  this.vfx=new WorldVFX();
  this.settings={...storedVolumes(),musicEnabled:false,muted:true};
  this.audio=new AudioEngine(this.settings);
  this.soundOn=false;this.lastSound=Object.create(null);
  this.autoFireRun=0;this.lastAutoShotAt=-Infinity;
  this.musicCheck=0;this.musicElapsed=0;this.music=new AdaptiveMusicDirector();
  this.listener=null;this.viewWidth=960;this.sceneVolume=1;
  this.modal=null;this.hidden=false;this.dead=false;this.sequence=0;
  this.soundscape=new AmbientSoundClock();
  this.lastUiAt=-Infinity;this.lastWorldAt=-Infinity;
 }
 setBudget(fps){this.vfx.setBudget(fps<26?.27:fps<40?.45:fps<53?.7:1);}
 setVolume(channel,value){
  if(!['masterVolume','sfxVolume','musicVolume'].includes(channel))return;
  this.settings[channel]=clamp(Number(value)||0,0,1);
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify({
   masterVolume:this.settings.masterVolume,
   sfxVolume:this.settings.sfxVolume,musicVolume:this.settings.musicVolume
  }));}catch{}
  this.syncVolume();
 }
 syncVolume(){
  this.audio.musicScale=this.sceneVolume;
  this.audio.applyVolumes?.();
 }
 toggleSound(){
  if(this.soundOn){
   this.audio.setExtractionActive?.(false);
   this.autoFireRun=0;this.lastAutoShotAt=-Infinity;
   this.soundOn=false;this.sequence++;this.audio.stopMusic();
   this.settings.musicEnabled=false;this.audio.setMuted(true);return false;
  }
  this.audio.init();if(!this.audio.enabled)return false;
  this.soundOn=true;this.settings.musicEnabled=true;
  this.audio.setMuted(false);this.audio.unlock();
  this.audio.startMusic();
  if(this.hidden||this.dead)this.audio.stopMusic();
  this.syncVolume();return true;
 }
 play(kind,minInterval=.16,position=null){
  if(!this.soundOn||this.hidden)return false;
  const now=this.vfx.clock;
  const key=SOUND_IDS[kind];
  if(!key&&kind!=='stone'&&kind!=='rockBreak')return false;
  const options=spatialCue(position,this.listener,this.viewWidth);
  if(options.intensity!==undefined&&options.intensity<.09)return false;
  const last=this.lastSound[kind];
  const priority=options.intensity??1;
  if(last&&now-last.at<minInterval){
   // A near impact should not disappear because a faint distant one played first.
   if(priority<last.intensity+.27)return false;
   options.force=true;
  }
  this.lastSound[kind]={at:now,intensity:priority};
  if(kind==='stone'||kind==='rockBreak'){
   return !!this.audio.rockImpact?.({heavy:kind==='rockBreak',...options});
  }
  if(kind==='droneDestroyed')options.intensity=(options.intensity??1)*.67;
  if(kind==='laser'){
   // The first shot after quiet is distinct. During sustained auto-fire,
   // successive pulses become quieter without suppressing visual gunfire.
   const gap=now-this.lastAutoShotAt;
   this.autoFireRun=gap<1.1?Math.min(6,this.autoFireRun+1):0;
   this.lastAutoShotAt=now;
   options.intensity=(options.intensity??1)*(1-this.autoFireRun*.065);
  }
  // The mixer accepts either licensed samples or purpose-built soft synthesis.
  if((kind==='laser'||kind==='rocket')&&!position){
   this.audio.shoot(key,options);
  }else this.audio.playEvent(key,options);
  return true;
 }
 emitNotes(plan){
  if(!this.soundOn||this.hidden||this.dead||!plan.length)return;
  const sequence=this.sequence;
  for(const {afterMs,...tone} of plan){
   if(afterMs)this.scheduled(()=>this.audio.tone(tone),afterMs,sequence);
   else this.audio.tone(tone);
  }
 }
 ui(kind){
  if(!this.soundOn||this.hidden||this.dead)return;
  const now=(globalThis.performance?.now?.()??Date.now())/1000;
  if(now-this.lastUiAt<.075)return;
  this.lastUiAt=now;
  this.emitNotes(uiSoundPlan(kind));
 }
 world(kind){
  if(!this.soundOn||this.hidden||this.dead)return;
  if(this.vfx.clock-this.lastWorldAt<.55)return;
  this.lastWorldAt=this.vfx.clock;
  this.emitNotes(worldSoundPlan(kind));
 }
 scheduled(callback,delay,sequence=this.sequence){
  globalThis.setTimeout(()=>{
   if(this.soundOn&&!this.hidden&&!this.dead&&this.sequence===sequence)callback();
  },delay);
 }
 startup(type){
  // The station is activated in game.js immediately. Its audible machinery
  // continues for roughly 3 seconds: ignition, rotating core, contact, lock.
  this.sequence++;
  const id=this.sequence,low=LEVELS[type]||LEVELS.outpost;
  this.audio.baseAction({action:'activate',type});
  this.audio.tone({freq:low,dur:2.38,type:'triangle',
   volume:.085,attack:.28,release:.52,sweep:low*.8});
  this.audio.tone({noise:true,noiseBand:490,dur:1.95,
   volume:.07,attack:.32,release:.48});
  this.scheduled(()=>{
   this.audio.tone({noise:true,noiseBand:890,dur:.14,
    volume:.088,attack:.008,release:.09});
  },650,id);
  this.scheduled(()=>{
   this.audio.tone({noise:true,noiseBand:660,dur:.21,
    volume:.11,attack:.012,release:.16});
   this.audio.tone({freq:112,dur:.22,type:'triangle',
    volume:.045,attack:.012,release:.2,sweep:-32});
  },1560,id);
  this.scheduled(()=>{
   this.audio.tone({noise:true,noiseBand:510,dur:.31,
    volume:.13,attack:.006,release:.22});
   this.audio.tone({freq:95,dur:.32,type:'triangle',
    volume:.07,attack:.012,release:.24,sweep:-18});
  },2690,id);
 }
 station(action,type,details={}){
  if(!this.soundOn||this.hidden)return;
  if(action==='activate'){this.startup(type);return;}
  const keys={
   hire:'base_escort_launch',repair:'base_repair_pulse',
   repairDrones:'base_repair_pulse',supply:'drone_swarm',
   transfer:'base_resonance_link',acceptContract:'upgrade_standard',
   claimContract:'achievement',respec:'unlock_tech_tier',
   service:type==='dock'?'base_repair_pulse':type==='arsenal'?'upgrade_weapon':'upgrade_research'
  };
  let key=keys[action];
  if(action==='upgrade'){
   key={armament:'upgrade_weapon',armor:'upgrade_armor',
    engine:'upgrade_standard',strikePower:'upgrade_drones',
    relay:'base_resonance_link',module:'base_section_construct'}[details.tech]||'upgrade_standard';
  }
  if(key)this.audio.playEvent(key);
 }
 extraction(active){
  this.audio.setExtractionActive?.(!!active&&this.soundOn&&!this.hidden&&!this.dead&&!this.modal);
 }
 pause(kind){
  this.audio.setExtractionActive?.(false);
  this.autoFireRun=0;this.lastAutoShotAt=-Infinity;
  this.modal=kind;
  this.sceneVolume=kind==='base'?.45:.37;
  this.syncVolume();
 }
 resume(){
  this.modal=null;
  this.sceneVolume=MUSIC_SCENES[this.music.scene].volume;
  this.syncVolume();
  if(this.soundOn&&!this.hidden&&!this.dead&&!this.audio.musicOn)this.audio.startMusic();
 }
 visibility(hidden){
  this.hidden=!!hidden;
  if(this.hidden){this.sequence++;this.audio.setExtractionActive?.(false);this.audio.stopMusic();return;}
  if(this.soundOn&&!this.dead){this.audio.unlock();this.audio.startMusic();this.syncVolume();}
 }
 onDeath(){
  this.dead=true;this.sequence++;this.audio.setExtractionActive?.(false);this.audio.stopMusic();
 }
 tick(dt,game){
  this.vfx.update(dt);
  if(!game||!game.player)return;
  this.listener=game.player;this.viewWidth=game.vw||960;
  if(!this.soundOn||this.hidden||this.dead)return;
  this.musicElapsed+=dt;
  const ambient=this.soundscape.tick(dt,{scene:this.music.scene,
   nearStation:!!game.nearDock||!!game.nearArsenalBonus||!!game.nearQuietLab,
   mining:!!game.mining?.active,paused:!!this.modal});
  if(ambient)this.emitNotes(ambientSoundPlan(ambient));
  if(this.vfx.clock<this.musicCheck)return;
  this.musicCheck=this.vfx.clock+.65;
  const p=game.player,nearby=(game.enemies||[]).filter(e=>
   e.hp>0&&!e.converted&&Math.hypot(e.x-p.x,e.y-p.y)<620);
  const heavy=nearby.some(e=>e.type==='gunship');
  const siege=!!game.enemyBasesUnlocked?.()&&!!game.nearbyEnemyBase?.(650);
  const warning=(game.zones||[]).some(z=>z.fuse>0&&
   Math.hypot(z.x-p.x,z.y-p.y)<z.r+135);
  const result=this.music.update(this.musicElapsed,{
   nearby:nearby.length,heavy,siege,warning,
   recentDamage:game.time-(game.lastDamageAt??-Infinity)<5,
   critical:p.hp/p.maxHp<.3
  });
  this.musicElapsed=0;
  if(result.changed){
   this.audio.setMusicState(result.track);
   if(!this.modal)this.emitNotes(sceneSoundPlan(result.scene));
  }
  this.sceneVolume=this.modal?(this.modal==='base'?.45:.37):result.volume;
  this.syncVolume();
  if(result.pulse&&!this.modal)
   this.audio.tone({noise:true,noiseBand:380,dur:.22,volume:.055,
    attack:.08,release:.24,bus:'music'});
 }
}
