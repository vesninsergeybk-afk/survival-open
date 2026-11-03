/**
 * SPAC-1 station scout: eight camera directions and 176 animation frames.
 * Original and supplemental sheets are kept separately to preserve artwork.
 * No 3D models or per-enemy canvases; scouts share seven prepared WebP atlases.
 */
const TAU = Math.PI * 2;
export const SPAC1_DIRECTIONS = Object.freeze(['S','SW','W','NW','N','NE','E','SE']);
export const SPAC1_COUNTS = Object.freeze({idle:6,walk:8,attack:8});
export const SPAC1_WAKE_FRAMES = 24;
export const SPAC1_WAKE_SECONDS = .96;
const ROOT = new URL('../assets/prologue/spac1/', import.meta.url);
const RUNTIME = Object.freeze({
    idle:{file:'idle.webp',cols:6,rows:8},walk:{file:'walk.webp',cols:8,rows:8},
    attack:{file:'attack.webp',cols:8,rows:8},
    wakeFront:{file:'wake-front.webp',cols:24,rows:1},
    wakeLeft:{file:'wake-left.webp',cols:24,rows:1},
    wakeBack:{file:'wake-back.webp',cols:24,rows:1},
    wakeRight:{file:'wake-right.webp',cols:24,rows:1}
});
const RUNTIME_ROOT = new URL('runtime-v2/',ROOT);
const RUNTIME_CELL=160,RUNTIME_FEET=128;
const SHEETS = Object.create(null);
const ACTORS = new WeakMap();
const SCOUT_GROUPS = new Set(['security','observatory','reinforcement']);
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const WAKE_VIEWS=['Front','Left','Back','Right'];

export function isSpac1Scout(enemy) {
    return !!enemy && SCOUT_GROUPS.has(enemy.prologueGroup);
}
export function spac1Direction(angle) {
    const heading = Number.isFinite(angle) ? angle : 0;
    // 0 points north; increasing angles turn clockwise.
    // Atlas rows start at south and continue clockwise.
    return ((Math.round(heading / (Math.PI / 4)) + 4) % 8 + 8) % 8;
}
export function spac1FrameRef(state,direction,frame) {
    const dir = ((Math.floor(direction) % 8) + 8) % 8;
    const count = SPAC1_COUNTS[state] || SPAC1_COUNTS.idle;
    const index = ((Math.floor(frame) % count) + count) % count;
    if(state === 'idle') {
        if(index === 0) return {key:'idleOriginal',col:dir%4,row:Math.floor(dir/4)};
        return {key:'idleExtra',col:index-1,row:dir};
    }
    const prefix = state === 'attack' ? 'attack' : 'walk';
    const original = index % 2 === 0;
    const artRow=state==='walk' ? (dir===2?6:dir===5?3:dir) : dir;
    const mirrored=state==='walk' && (dir===2 || dir===5);
    return {key:prefix+(original?'Original':'Extra'),
        col:Math.floor(index/2),row:artRow,...(mirrored?{mirrored:true}:{})};
}
/** Four fixed cardinal wake-up views, sampled from the existing eight-view scout. */
export function spac1WakeFrameRef(direction,frame) {
    const dir=((Math.floor(Number.isFinite(direction)?direction:0)%8)+8)%8;
    const cardinal=(Math.round(dir/2)%4+4)%4;
    const index=clamp(Math.floor(Number.isFinite(frame)?frame:0),0,SPAC1_WAKE_FRAMES-1);
    const cell=index%12;
    return {key:'wake'+WAKE_VIEWS[cardinal]+(index<12?'A':'B'),
        col:cell%4,row:Math.floor(cell/4)};
}
function requestSheet(key) {
    let result = SHEETS[key];
    if(result) return result;
    result = {image:null,ready:false,failed:false};
    SHEETS[key] = result;
    if(typeof Image === 'undefined') return result;
    const image = new Image();
    image.decoding = 'async';
    // Force asynchronous decode during the quiet generator/gate sequence.
    // The first drawImage call must not decode a multi-megabyte PNG while
    // robots are moving on screen.
    // The sprite sheet is rebuilt OFFLINE. Decoding only: no canvas,
    // pixel warps, draw-time flips or per-actor textures.
    image.onload = () => {
        const finish = () => { result.ready = !!image.naturalWidth; };
        if(typeof image.decode === 'function') image.decode().then(finish, finish);
        else finish();
    };
    image.onerror = () => {result.failed=true;};
    result.image=image;
    image.src = new URL(RUNTIME[key].file,RUNTIME_ROOT).href;
    return result;
}
let warming=false;
export function warmSpac1() {
    if(typeof Image === 'undefined'||warming) return;
    warming=true;
    // Decode all combat poses while the player is still in the dock.
    // Deferring attack.webp until an idle callback can stall the first shot
    // on a busy mobile browser and briefly swap the scout for Kenney art.
    for(const key of ['idle','walk','attack'])requestSheet(key);
}
/** Decode just four small sheets first; the second halves load after repair. */
export function warmSpac1Wake(complete=false) {
    if(typeof Image==='undefined')return;
    for(const view of WAKE_VIEWS)requestSheet('wake'+view);
    
}
function drawRuntimeCell(ctx,key,col,row,cx,cy,height) {
    const sheet=requestSheet(key);if(!sheet.ready)return false;
    const scale=height/96;
    // Every prepared pose has an identical cell and feet origin. No pixel
    // reads, cropping, source-dependent scale or frame canvases during play.
    ctx.drawImage(sheet.image,col*RUNTIME_CELL,row*RUNTIME_CELL,RUNTIME_CELL,RUNTIME_CELL,
        cx-RUNTIME_CELL/2*scale,cy+(height*.12-RUNTIME_FEET*scale),
        RUNTIME_CELL*scale,RUNTIME_CELL*scale);
    return true;
}
function drawCell(ctx,state,dir,frame,cx,cy,height) {
    const key=SPAC1_COUNTS[state]?state:'idle';
    return drawRuntimeCell(ctx,key,((Math.floor(frame)%SPAC1_COUNTS[key])+SPAC1_COUNTS[key])%SPAC1_COUNTS[key],dir,cx,cy,height);
}
function drawWakeCell(ctx,direction,frame,cx,cy,height) {
    const cardinal=((Math.round(direction/2)%4)+4)%4;
    const drawn=drawRuntimeCell(ctx,'wake'+WAKE_VIEWS[cardinal],
        clamp(Math.floor(frame),0,23),0,cx,cy,height);
    return drawn||drawCell(ctx,'idle',direction,0,cx,cy,height);
}
/** One sprite per render frame: no alpha blending or double-limbed ghosting. */
export function drawSpac1Wake(ctx,spot,time,height=96) {
    if(!spot||spot.active)return false;
    const age=Number.isFinite(spot.wakeAt)?Math.max(0,time-spot.wakeAt):0;
    const frame=clamp(Math.floor(age/SPAC1_WAKE_SECONDS*SPAC1_WAKE_FRAMES),
        0,SPAC1_WAKE_FRAMES-1);
    ctx.save();ctx.translate(spot.x,spot.y);
    ctx.fillStyle='rgba(2,9,19,.38)';
    ctx.beginPath();ctx.ellipse(2,15,26,8,0,0,TAU);ctx.fill();
    const drawn=drawWakeCell(ctx,spot.direction,frame,0,0,height);
    ctx.restore();return drawn;
}
export function drawSpac1WakePreviewFrame(ctx,direction,frame,x,y,height=100) {
    return drawWakeCell(ctx,direction,frame,x,y,height);
}
export function spac1PoseFrames(state,phase) {
    const count=SPAC1_COUNTS[state]||SPAC1_COUNTS.idle;
    const value=Number.isFinite(phase)?phase:0;
    const position=((value%count)+count)%count;
    const frame=Math.floor(position);
    const t=position-frame;
    // Each rendered image moves continuously toward the next pose.
    const mix=t*t*(3-2*t);
    return {frame,next:(frame+1)%count,mix};
}
export function spac1StrideAdvance(distance) {
    // About one eight-pose cycle per 64 units travelled (12 poses/s at speed 96).
    return Math.max(0,Number.isFinite(distance)?distance:0)*8/64;
}
// No more than one pose and a quarter per *draw*. At a temporary 10–15 FPS
// the simulation still moves correctly, but skipping three sprite cells makes
// the legs appear to snap back and forth.
export function spac1GaitStep(distance) {
    return Math.min(1.25,spac1StrideAdvance(distance));
}
// Turn by one atlas view at a time. Fast AI reversals should show a turn,
// not teleport between front and rear character drawings.
export function spac1TurnStep(current,requested) {
    const delta=((requested-current+12)%8)-4;
    return (current+Math.sign(delta)+8)%8;
}
export function spac1TravelSample(enemy,previousX,previousY) {
    const accumulated=enemy.prologueTravel;
    if(Number.isFinite(accumulated))enemy.prologueTravel=0;
    return Number.isFinite(accumulated)
        ?Math.max(0,accumulated):Math.hypot(enemy.x-previousX,enemy.y-previousY);
}
function drawSmoothCell(ctx,state,direction,phase,x,y,height) {
    const {frame}=spac1PoseFrames(state,phase);
    // The old smoothstep dissolve showed two sets of arms and legs at once.
    // Pick the closest pose; movement of the actual actor remains continuous.
    // A sheet can still be decoding on a slow device. Keep the same
    // character silhouette instead of flashing the older Kenney robot.
    return drawCell(ctx,state,direction,frame,x,y,height) ||
        (state!=='idle' && drawCell(ctx,'idle',direction,0,x,y,height));
}
export function drawSpac1PreviewFrame(ctx,state,direction,phase,x,y,height=100) {
    return drawSmoothCell(ctx,state,direction,phase,x,y,height);
}
function actorState(enemy,time) {
    let a=ACTORS.get(enemy);
    if(!a) {
        a={x:enemy.x,y:enemy.y,time,velocity:0,walkPhase:0,direction:null,
            lastTurnAt:-Infinity,motionUntil:time,lastPose:null,
            lastAim:0,lastFire:0,shotAt:-Infinity};
        ACTORS.set(enemy,a);
    }
    const dt=time-a.time;
    // Enemy movement is integrated in several simulation slices at low FPS.
    // Use their *total travelled path*, not the straight-line displacement
    // between render frames (which cancels out when a patrol turns around).
    const travelled=spac1TravelSample(enemy,a.x,a.y);
    if(dt>.001 && dt<.6) {
        const raw=Math.min(220,travelled/dt);
        // Exponential smoothing is invariant to the number of render frames.
        const blend=1-Math.exp(-13*dt);
        a.velocity+=(raw-a.velocity)*blend;
        if(raw>7 && travelled>.05){
            a.walkPhase=(a.walkPhase+spac1GaitStep(travelled))%8;
            a.motionUntil=time+.16;
        }else if(time<a.motionUntil){
            // Finish the current footstep after a brief AI steering pause.
            a.walkPhase=(a.walkPhase+Math.min(.3,dt*2.5))%8;
        }
    } else if(dt>=.6) {
        // A suspended tab must never play a long backlog of old footfalls.
        a.velocity=0;
        a.motionUntil=time;
    }
    if(dt>0){a.x=enemy.x;a.y=enemy.y;a.time=time;}
    const aim=Math.max(0,enemy.aimTimer||0);
    const fire=Math.max(0,enemy.fireTimer||0);
    const firedFromAim=a.lastAim>0&&aim===0;
    const resetWithoutAim=!!enemy.ranged&&a.lastFire>0&&fire>a.lastFire+.65;
    if(firedFromAim||resetWithoutAim)a.shotAt=time;
    a.lastAim=aim;a.lastFire=fire;

    let pose;
    if(a.velocity>10 || time<a.motionUntil) {
        // A walking scout must complete its gait even while aiming or
        // immediately after firing. The projectile and aim cue still work.
        pose={state:'walk',phase:a.walkPhase};
    } else if(aim>0) {
        const total=Math.max(aim,enemy.aimTotal||1);
        pose={state:'attack',phase:clamp((1-aim/total)*4,0,3.999)};
    } else {
        const after=time-a.shotAt;
        if(after>=0&&after<.36)
            pose={state:'attack',phase:4+clamp(after/.09,0,3.999)};
        else if(a.velocity>9 || time<a.motionUntil)
            pose={state:'walk',phase:a.walkPhase};
        else
            pose={state:'idle',phase:((time+enemy.y*.0009)*3.2)%6};
    }
    a.lastPose=pose;
    return {actor:a,...pose};
}
export function drawSpac1Robot(ctx,enemy,time) {
    if(!isSpac1Scout(enemy)||enemy.hp<=0)return false;
    const pose=actorState(enemy,time);
    const actor=pose.actor;
    // Keep locomotion facing tied to the physical walk direction. An
    // independently aimed projectile must not spin the feet mid-stride.
    const facing=pose.state!=='walk'&&enemy.aimTimer>0&&Number.isFinite(enemy.aimAngle)
        ? enemy.aimAngle+Math.PI/2:enemy.visualAngle;
    const requested=spac1Direction(facing);
    if(actor.direction===null)actor.direction=requested;
    else if(requested!==actor.direction && time-actor.lastTurnAt>=.075) {
        const oldFacing=(actor.direction-4)*Math.PI/4;
        const delta=Math.atan2(Math.sin(facing-oldFacing),Math.cos(facing-oldFacing));
        if(Math.abs(delta)>Math.PI/8+.10) {
            actor.direction=spac1TurnStep(actor.direction,requested);
            actor.lastTurnAt=time;
        }
    }
    const height=96;
    ctx.save();
    ctx.translate(enemy.x,enemy.y);
    ctx.fillStyle='rgba(2,9,19,0.42)';
    ctx.beginPath();ctx.ellipse(2,15,26,8,0,0,TAU);ctx.fill();
    
    const lift=0; // The authored foot contact already includes the gait.
    const paint=(state,dir,phase,alpha)=>{
        ctx.save();ctx.globalAlpha*=alpha;
        const ok=drawSmoothCell(ctx,state,dir,phase,0,lift,height);
        ctx.restore();return ok;
    };
    // Only one orientation and one locomotion pose per frame. The previous
    // state/turn dissolves multiplied texture samples and obscured each step.
    const drawn=paint(pose.state,actor.direction,pose.phase,1);
    ctx.restore();
    if(!drawn)return false;
    if(enemy.hp<enemy.maxHp) {
        const ratio=clamp(enemy.hp/Math.max(1,enemy.maxHp),0,1);
        ctx.fillStyle='#071522';ctx.fillRect(enemy.x-23,enemy.y-53,46,4);
        ctx.fillStyle=ratio<.35?'#ff826d':'#79e3dc';
        ctx.fillRect(enemy.x-23,enemy.y-53,46*ratio,4);
    }
    return true;
}
export function drawSpac1Death(ctx,death) {
    if(death?.kind!=='spac1'||death.ttl<=0)return false;
    const progress=clamp(1-death.ttl/Math.max(.01,death.duration),0,1);
    const direction=spac1Direction(death.angle);
    ctx.save();
    ctx.globalAlpha=1-progress;
    ctx.translate(death.x,death.y);
    ctx.rotate(progress*.95);
    ctx.filter='brightness('+(1+progress*.8)+')';
    const ready=drawCell(ctx,'idle',direction,0,0,progress*11,88);
    ctx.restore();
    return ready;
}
export const SPAC1_MANIFEST=Object.freeze({
    name:'SPAC-1', directions:SPAC1_DIRECTIONS, frames:SPAC1_COUNTS,
    total:8*(6+8+8), awakening:4*SPAC1_WAKE_FRAMES,
    renderedWith:'Canvas2D',interpolated:false
});

