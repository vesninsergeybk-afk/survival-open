/**
 * Physical station machinery, animated on top of the existing CC0 hull atlas.
 * Canvas-only, ~constant work per visible station; no collision changes.
 */
import {drawStationPart,STATION_PARTS} from './station-art.js?v=base-86';
import {getFXSprite} from './vfx-textures.js?v=space-4';
const TAU=Math.PI*2;
const smooth=t=>t*t*(3-2*t);

export function drawStationMechanisms(ctx,base,size,time,reducedMotion=false){
    // Pure presentation: use the actual power state, not a flag initialized
    // by the previous frame. Captured installations may operate while scarred.
    if((!base.active&&!base.captured)||(base.hp<=0&&!base.captured))return;
    const t=reducedMotion?0:time;
    const wave=reducedMotion?.5:Math.sin(t*1.35+base.x*.001);
    const amt=(wave+1)/2;
    ctx.save();
    ctx.scale(size/160,size/160);
    ctx.strokeStyle='#9deaff';
    ctx.fillStyle='#243a54';
    ctx.lineWidth=2.6;
    ctx.shadowColor='#5ce9ff';
    ctx.shadowBlur=5;
    if(base.type==='dock'){
        // Two real docking arms, slowly opening and closing over the hull.
        for(const side of [-1,1]){
            ctx.save();
            ctx.translate(side*32,12);
            ctx.rotate(side*(.12+.24*amt));
            ctx.strokeStyle='#79dff2';ctx.lineWidth=6;
            ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(side*17,-22);
            ctx.lineTo(side*22,-39);ctx.stroke();
            ctx.strokeStyle='#d5faff';ctx.lineWidth=3;
            ctx.beginPath();ctx.moveTo(side*16,-25);ctx.lineTo(side*27,-26);
            ctx.stroke();
            drawStationPart(ctx,STATION_PARTS.wing,side*19,-25,39,
                side*(.1+.07*amt),.68);
            ctx.restore();
        }
    }else if(base.type==='outpost'){
        // A directional radar assembly: rotating head, sweep and antenna.
        ctx.save();ctx.translate(0,-13);
        ctx.rotate(t*.42);
        ctx.strokeStyle='#7bffdc';ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(33,0);ctx.stroke();
        ctx.strokeStyle='#d6fff1';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(0,0,25,-.58,.58);ctx.stroke();
        ctx.beginPath();ctx.arc(0,0,4,0,TAU);ctx.stroke();
        drawStationPart(ctx,STATION_PARTS.cross,0,0,32,t*.13,.75);
        ctx.restore();
    }else if(base.type==='carrier'){
        // Moving modular flight-deck wings and launch-bay doors.
        for(const side of [-1,1]){
            const offset=side*(47+6*amt);
            drawStationPart(ctx,STATION_PARTS.wing,offset,8,67,
                side*(.03+.07*amt),.9);
            ctx.fillStyle='#152e46';ctx.fillRect(side*21-(side<0?13:0),-9,13,35);
            ctx.strokeStyle='#9eb7ff';ctx.lineWidth=2;
            ctx.strokeRect(side*21-(side<0?13:0),-9,13,35);
        }
        // Hangar expansion becomes visible: parked scout craft on the decks.
        for(let i=0;i<Math.min(4,base.hangarTier||0);i++){
            const side=i%2?-1:1,deckY=(i<2?-15:27);
            drawStationPart(ctx,STATION_PARTS.scoutStart,side*34,deckY,23,
                Math.PI, .8);
        }
    }else if(base.type==='arsenal'){
        // Armour shutters reciprocate around the central gun magazine.
        for(const side of [-1,1]){
            const x=side*(15+8*amt);
            ctx.save();ctx.translate(x,-2);
            ctx.fillStyle='#344356';ctx.strokeStyle='#ffcd86';
            ctx.lineWidth=2.4;
            ctx.beginPath();ctx.moveTo(-9,-26);ctx.lineTo(9,-26);
            ctx.lineTo(12,25);ctx.lineTo(-12,25);ctx.closePath();
            ctx.fill();ctx.stroke();
            drawStationPart(ctx,STATION_PARTS.wing,0,0,31,
                side*(.08+.06*amt),.65);
            ctx.restore();
        }
        ctx.fillStyle='#ffcb83';
        for(let i=0;i<3;i++)ctx.fillRect(-3,-17+i*15,6,7);
    }else if(base.type==='lab'){
        // A moving scanning gimbal with two antenna arms.
        ctx.save();ctx.translate(0,-7);ctx.rotate(t*.32);
        ctx.strokeStyle='#c1a4ff';ctx.lineWidth=5;
        ctx.beginPath();ctx.ellipse(0,0,35,19,0,0,TAU);ctx.stroke();
        ctx.strokeStyle='#f5e7ff';ctx.lineWidth=2.6;
        ctx.beginPath();ctx.moveTo(-46,0);ctx.lineTo(-27,0);
        ctx.moveTo(27,0);ctx.lineTo(46,0);ctx.stroke();
        ctx.fillStyle='#e5d5ff';
        ctx.beginPath();ctx.arc(0,0,4,0,TAU);ctx.fill();
        drawStationPart(ctx,STATION_PARTS.cross,0,0,38,t*.07,.67);
        ctx.restore();
    }
    // Visible service modules reflect actual station development, without
    // pretending that an unpurchased combat turret has been installed.
    const development=base.development||{};
    for(const [key,x,y,part,tint] of [
        ['defense',-39,36,STATION_PARTS.wing,'#6ef0ff'],
        ['research',39,36,STATION_PARTS.lab,'#d4a9ff'],
        ['logistics',0,48,STATION_PARTS.depot,'#ffd59c']
    ]){
        const rank=development[key]||0;
        if(rank<=0)continue;
        drawStationPart(ctx,part,x,y,23+Math.min(3,rank)*3,0,.85);
        ctx.save();ctx.globalAlpha=.28+.14*Math.sin(t*2+rank);
        ctx.fillStyle=tint;ctx.shadowColor=tint;ctx.shadowBlur=9;
        ctx.beginPath();ctx.arc(x,y,4,0,TAU);ctx.fill();ctx.restore();
    }
    // Heavy damage is readable even while the base is still operational.
    const hp=base.hp/Math.max(1,base.maxHp||1);
    if(hp<.55){
        const smoke=getFXSprite('smoke','smoke');
        const level=1-hp;
        ctx.save();ctx.globalAlpha=.18+.24*level;
        if(smoke)ctx.drawImage(smoke,-48,-41,73,73);
        else {
            ctx.fillStyle='#8597a7';ctx.beginPath();
            ctx.arc(-13,-12,16,0,TAU);ctx.fill();
        }
        ctx.restore();
        ctx.save();ctx.strokeStyle='#ff8666';
        ctx.globalAlpha=.28+.38*level;ctx.lineWidth=1.8;
        ctx.beginPath();ctx.moveTo(-32,-19);ctx.lineTo(-10,-5);
        ctx.lineTo(-18,14);ctx.stroke();ctx.restore();
    }
    // Shared newly powered servo indicator and startup calibration sweep.
    const elapsed=Math.max(0,time-(base.activationTime||0));
    if(!reducedMotion&&elapsed<2.5){
        ctx.save();ctx.globalAlpha=1-smooth(elapsed/2.5);
        ctx.strokeStyle='#cafff3';ctx.lineWidth=2.5;
        ctx.rotate(-.5+elapsed*1.5);
        ctx.beginPath();ctx.arc(0,0,48,-.4,.6);ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}
