// Pure input mapping shared by the live touch handler and regression tests.
// Ordinary field taps mark a target; a special shot requires deliberate arming.
export function mobileAimKind(cometArmed=false,mineArmed=false){
 return mineArmed?'mines':cometArmed?'comet':null;
}
export function touchStickVector(dx,dy,radius){
 if(!Number.isFinite(dx)||!Number.isFinite(dy)||!(radius>0))return {x:0,y:0};
 const length=Math.hypot(dx,dy);
 if(length===0)return {x:0,y:0};
 const factor=Math.min(1,length/radius)/length;
 return {x:dx*factor,y:dy*factor};
}
