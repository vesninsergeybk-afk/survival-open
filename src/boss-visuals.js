/**
 * Capital-ship visual rig. Project-original hulls plus existing Wenrexa
 * and turret-visuals CC0 parts. Drawn AFTER Enemy.render; fully decorative.
 * No updates to hitboxes, projectiles, HP, AI or mission state.
 */
import {drawStationPart,STATION_PARTS} from './station-art.js?v=base-86';
import {drawTurretMount,drawTurretHead} from './turret-visuals.js?v=turret-visuals-1';
import {getFXSprite} from './vfx-textures.js?v=space-4';
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const HULLS=Object.freeze({
    carrier:'carrier',necromancer:'carrier',chrono_lich:'carrier',
    hunter:'cruiser',reaper:'cruiser',ice_queen:'cruiser',
    void_lord:'dreadnought'
});
const GUNS=Object.freeze({
    dreadnought:[[-.52,-.24],[.52,-.24],[-.47,.35],[.47,.35]],
    carrier:[[-.57,-.06],[.57,-.06]],
    cruiser:[[-.4,-.08],[.4,-.08]]
});
const PALETTES=Object.freeze({
    dreadnought:{metal:'#ad555b',core:'#ff7268',path:'missile'},
    carrier:{metal:'#8cb6ef',core:'#85bbff',path:'basic'},
    cruiser:{metal:'#75e4eb',core:'#81f7ff',path:'rail'}
});
export function drawBossDetails(ctx,enemy,time=0,target=null,reducedMotion=false) {
    if(!enemy?.boss||enemy.hp<=0)return;
    const hull=HULLS[enemy.type?.id]||'cruiser';
    const p=PALETTES[hull],size=Math.max(14,enemy.size||32);
    const hp=clamp(enemy.hp/Math.max(1,enemy.maxHp||1),0,1);
    const heading=enemy.visualAngle||0;
    const aim=target?
        Math.atan2(target.y-enemy.y,target.x-enemy.x)-heading:
        -Math.PI/2;
    const t=reducedMotion?0:time;
    ctx.save();ctx.translate(enemy.x,enemy.y);ctx.rotate(heading);
    // The luminous reactor is part of the existing hull, with a slow power
    // pulse that remains readable on tiny mobile screens.
    const pulse=.55+.45*Math.sin(t*3+enemy.x*.005)**2;
    ctx.save();ctx.globalCompositeOperation='lighter';
    ctx.globalAlpha=.17+.22*pulse;
    ctx.fillStyle=p.core;ctx.shadowColor=p.core;ctx.shadowBlur=11;
    ctx.beginPath();ctx.arc(0,size*.12,size*.18,0,TAU);ctx.fill();
    ctx.restore();
    const gunScale=size/62;
    const mounts=GUNS[hull];
    for(let i=0;i<mounts.length;i++){
        const [ux,uy]=mounts[i];
        const x=ux*size,y=uy*size;
        ctx.save();ctx.translate(x,y);ctx.scale(gunScale,gunScale);
        // Every gun head tracks the player independently of the body.
        const turret={level:hull==='dreadnought'?4:3,path:p.path,
            mount:i+2,overheat:0,cooldown:0,tracked:true,aimAngle:aim};
        drawStationPart(ctx,STATION_PARTS.turretIdle,0,0,37,aim+Math.PI/2,.78);
        drawTurretMount(ctx,turret,0,0,t);
        drawTurretHead(ctx,turret,0,0,aim,t);
        ctx.restore();
    }
    // Core and hull damage become visibly progressive. Existing smoke art
    // is reused; there is no extra particle system or collision surface.
    if(hp<.67){
        const smoke=getFXSprite('smoke','smoke');
        const severity=1-hp;
        ctx.save();
        ctx.globalAlpha=.18+.33*severity;
        ctx.globalCompositeOperation='source-over';
        const shift=reducedMotion?0:Math.sin(t*1.8+size)*size*.045;
        for(const dir of [-1,1]){
            const x=dir*size*.29,y=size*(dir<0?.04:-.22)+shift;
            if(smoke)ctx.drawImage(smoke,x-size*.32,y-size*.32,
                size*.64,size*.64);
            else {
                ctx.fillStyle='#70869b';ctx.beginPath();
                ctx.arc(x,y,size*.19,0,TAU);ctx.fill();
            }
        }
        ctx.restore();
        if(hp<.3){
            ctx.save();ctx.globalCompositeOperation='lighter';
            ctx.globalAlpha=.48+.3*Math.sin(t*14)**2;
            ctx.strokeStyle='#ff9756';ctx.shadowColor='#ff7436';
            ctx.lineWidth=2;
            ctx.beginPath();ctx.moveTo(-size*.32,size*.13);
            ctx.lineTo(-size*.08,size*.25);
            ctx.lineTo(size*.14,size*.14);ctx.stroke();ctx.restore();
        }
    }
    // When the boss aims a charged shot, gun capacitors illuminate with
    // the same warning palette as the existing attack indicator.
    if(enemy.aimTimer>0){
        ctx.save();ctx.globalAlpha=.55+.3*Math.sin(t*11)**2;
        ctx.strokeStyle=p.core;ctx.shadowColor=p.core;ctx.shadowBlur=12;
        ctx.lineWidth=2.4;ctx.beginPath();
        ctx.arc(0,0,size*.84,aim-.15,aim+.15);ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}
