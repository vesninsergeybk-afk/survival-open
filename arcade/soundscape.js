/**
 * Quiet physical sound materials for the arcade. UI = tactile relay clicks,
 * world = filtered air and machinery, music = low atmospheric swells.
 * No pitched high-frequency chirps or repeated weapon-shot substitutes.
 */
const grit=(noiseBand,dur,volume,afterMs=0,bus='sfx',attack=.008,release=.12)=>
 Object.freeze({noise:true,noiseBand,dur,volume,afterMs,bus,attack,release});
const motor=(freq,dur,volume,afterMs=0,bus='sfx',sweep=0)=>
 Object.freeze({freq,dur,volume,afterMs,bus,sweep,type:'triangle',
  attack:.025,release:.15});

const UI=Object.freeze({
 open:[grit(1050,.046,.07),motor(170,.12,.038,48)],
 map:[grit(780,.075,.065),motor(125,.15,.05,70)],
 tab:[grit(1020,.04,.052),motor(145,.082,.028,36)],
 dock:[grit(470,.11,.085),motor(112,.14,.065,55)],
 close:[grit(1350,.052,.063)],
 select:[grit(1450,.038,.058)],
 confirm:[grit(730,.075,.074),motor(180,.10,.04,65)],
 deny:[grit(420,.095,.08),motor(118,.15,.05,50)],
 cancel:[grit(660,.072,.055)],
 slider:[grit(1650,.025,.035)],
 audioOn:[grit(890,.072,.07),motor(190,.115,.05,65)]
});
const WORLD=Object.freeze({
 discover:[grit(1120,.17,.075),motor(132,.28,.055,100)],
 amber:[grit(315,.33,.078),motor(76,.47,.06,130)],
 ion:[grit(1600,.28,.065),motor(102,.44,.05,180)],
 contract:[grit(690,.12,.075),motor(155,.2,.048,95)]
});
const SCENE=Object.freeze({
 drift:[],
 alert:[grit(315,.45,.075,0,'music',.12,.34),motor(91,.43,.055,240,'music')],
 battle:[grit(450,.31,.085,0,'music',.025,.31),motor(79,.58,.074,55,'music')],
 siege:[grit(215,.88,.11,0,'music',.18,.5),motor(62,1.1,.095,260,'music')],
 recovery:[grit(420,.53,.065,0,'music',.12,.38),motor(124,.36,.055,250,'music')]
});
const AMBIENT=Object.freeze({
 void:[grit(190,2.3,.075,0,'music',.55,.62),motor(65,1.9,.038,500,'music')],
 station:[motor(109,1.75,.057,0,'music'),grit(460,.63,.045,650,'music',.2,.42)],
 extraction:[], // continuous extractor contact voice already occupies this space
 alert:[grit(285,1.3,.075,0,'music',.4,.55)],
 battle:[grit(480,.65,.073,0,'music',.17,.39)],
 siege:[grit(180,1.65,.085,0,'music',.32,.48)]
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
