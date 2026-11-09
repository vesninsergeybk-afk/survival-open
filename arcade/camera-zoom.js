// Zoom affects the view only; weapon range and spawning remain in world units.
export const CAMERA_ZOOM=Object.freeze({min:.55,max:1.5,keyStep:1.16});

export const clampCameraZoom=value=>Number.isFinite(value)?
 Math.max(CAMERA_ZOOM.min,Math.min(CAMERA_ZOOM.max,value)):1;

export function flightCamera(player,width,height,zoom=1){
 const factor=clampCameraZoom(zoom),w=width/factor,h=height/factor;
 return {x:player.x-w/2,y:player.y-h/2,w,h};
}

// Do not steal a key that the player assigned to another game action.
export function flightZoomKey(code,bindings={}){
 if(Object.values(bindings).includes(code))return 0;
 if(code==='Equal'||code==='NumpadAdd')return 1;
 if(code==='Minus'||code==='NumpadSubtract')return -1;
 return 0;
}

export const stepCameraZoom=(current,direction)=>
 clampCameraZoom(current*CAMERA_ZOOM.keyStep**direction);

// Wheel units vary between mice and touchpads; cap one large wheel event.
export function wheelCameraZoom(current,deltaY,deltaMode=0,pageHeight=800){
 if(!Number.isFinite(deltaY))return clampCameraZoom(current);
 const pixels=deltaY*(deltaMode===1?16:deltaMode===2?pageHeight:1);
 const bounded=Math.max(-180,Math.min(180,pixels));
 return clampCameraZoom(current*Math.exp(-bounded*.0015));
}

export function pointerInFlightWorld(rect,camera,clientX,clientY){
 if(!rect||!(rect.width>0)||!(rect.height>0))return null;
 return {x:camera.x+(clientX-rect.left)/rect.width*camera.w,
  y:camera.y+(clientY-rect.top)/rect.height*camera.h};
}
