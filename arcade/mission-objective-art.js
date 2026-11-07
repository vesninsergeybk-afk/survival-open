// Recorded mission state is the sole animation clock. All four atlases are
// painted transparent sprites; Canvas draws them only when decoding succeeded.
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
export const missionImageReady=image=>!!(image?.complete&&image.naturalWidth>0&&image.naturalHeight>0);

/** A 2-column sheet: square cells for apparatus and effects, wide for ships. */
export function paintMissionCell(c,image,frame,x,y,width,height,{rows=2,alpha=1}={}){
 if(!missionImageReady(image)||!Number.isInteger(frame)||frame<0||frame>=rows*2)return false;
 const sw=image.naturalWidth/2,sh=image.naturalHeight/rows;
 c.save();c.globalAlpha*=clamp(alpha);
 c.drawImage(image,(frame%2)*sw,Math.floor(frame/2)*sh,sw,sh,
  x-width/2,y-height/2,width,height);
 c.restore();return true;
}

/** Physical repair stages blend existing painted poses instead of jumping. */
export function paintMissionMorph(c,image,from,to,x,y,width,height,progress,options={}){
 const t=clamp(progress),smooth=t*t*(3-2*t);
 if(t===0)return paintMissionCell(c,image,from,x,y,width,height,options);
 if(t===1)return paintMissionCell(c,image,to,x,y,width,height,options);
 if(!paintMissionCell(c,image,from,x,y,width,height,{...options,alpha:1-smooth}))return false;
 if(smooth>0)paintMissionCell(c,image,to,x,y,width,height,{...options,alpha:smooth});
 return true;
}

const IMPACT_FRAMES=Object.freeze({metal:0,shield:1,emp:2,repair:3});
/** A single short decal over ordinary VFX; no perpetual particle allocation. */
export function paintMissionImpact(game,c,kind,x,y,at,size=95,duration=.48){
 const frame=IMPACT_FRAMES[kind];
 if(frame===undefined||!Number.isFinite(at)||!Number.isFinite(game.time))return false;
 const elapsed=game.time-at;
 if(elapsed<0||elapsed>=duration)return false;
 const fade=1-elapsed/duration,spread=size*(.68+.45*elapsed/duration);
 return paintMissionCell(c,game.images?.missionImpacts,frame,x,y,spread,spread,
  {alpha:fade*.86});
}
