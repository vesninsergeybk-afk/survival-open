/**
 * Canvas-only beam effects for the prologue. No texture swaps or new image
 * requests during rendering. Both beams have soft, tapered contact points.
 */
const TAU = Math.PI * 2;
const clamp01 = v => Math.max(0, Math.min(1, v));
const ease = v => { const q=clamp01(v); return q*q*(3-2*q); };

function bloom(ctx, x, y, radius, color, strength=1) {
    if (radius <= 0 || strength <= 0) return;
    const light = ctx.createRadialGradient(x,y,0,x,y,radius);
    light.addColorStop(0, color);
    light.addColorStop(.19, '#c8fff5');
    light.addColorStop(.45, 'rgba(100,244,242,.25)');
    light.addColorStop(1, 'rgba(100,244,242,0)');
    ctx.save();
    ctx.globalAlpha *= strength;
    ctx.fillStyle=light;
    ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fill();
    ctx.restore();
}

export function drawRepairBeam(ctx, beam, time, opacity=1) {
    const dx=beam.x2-beam.x, dy=beam.y2-beam.y;
    const length=Math.hypot(dx,dy);
    if (!Number.isFinite(length) || length<5 || opacity<=0) return;
    const phase=Number.isFinite(time)?time:0;
    const tip=Math.max(2,length-4);
    const pulse=.82+.18*Math.sin(phase*17);
    const bend=Math.min(3.6,length*.014)*Math.sin(phase*12);
    const accent=beam.color||'#57fca4', core=beam.coreColor||'#e6ffef';
    ctx.save();
    ctx.globalAlpha *= clamp01(opacity);
    ctx.translate(beam.x,beam.y);
    ctx.rotate(Math.atan2(dy,dx));
    ctx.lineCap='round';ctx.lineJoin='round';
    // The distant halo is broad but faint, with round ends rather than
    // the default squared canvas stroke.
    ctx.save();
    ctx.globalAlpha *= .17*pulse;
    ctx.strokeStyle=accent;ctx.lineWidth=23;ctx.shadowColor=accent;ctx.shadowBlur=ctx.__lowFx?0:(28);
    ctx.beginPath();ctx.moveTo(2,0);
    ctx.quadraticCurveTo(length*.52,bend*1.3,tip,0);ctx.stroke();
    ctx.restore();
    // Filled ribbons shrink to a point at the target: no saw-cut end.
    const ribbon=(half,color,alpha) => {
        ctx.save();ctx.globalAlpha*=alpha;ctx.fillStyle=color;
        ctx.beginPath();
        ctx.moveTo(2,-half*.7);
        ctx.bezierCurveTo(tip*.25,-half*1.2+bend*.2,tip*.66,-half*.5+bend*.6,tip-4,-.6);
        ctx.quadraticCurveTo(tip+1,0,tip-4,.6);
        ctx.bezierCurveTo(tip*.66,half*.5+bend*.6,tip*.25,half*1.2+bend*.2,2,half*.7);
        ctx.quadraticCurveTo(0,0,2,-half*.7);
        ctx.closePath();ctx.fill();ctx.restore();
    };
    ribbon(9,accent,.82*pulse);
    ribbon(3.2,core,.90);
    // A little current moving along the centre makes the sustained repair
    // readable without making the ship or the target jump.
    ctx.save();ctx.globalAlpha*=.65;
    ctx.strokeStyle='#ffffff';ctx.lineWidth=1.1;
    ctx.setLineDash([Math.max(4,length*.055),Math.max(8,length*.14)]);
    ctx.lineDashOffset=-phase*94;
    ctx.beginPath();ctx.moveTo(5,0);
    ctx.quadraticCurveTo(length*.53,bend*.6,tip-2,0);ctx.stroke();
    ctx.restore();
    bloom(ctx,1,0,14,core,.72);
    bloom(ctx,tip,0,18+2*Math.sin(phase*15),accent,.78*pulse);
    ctx.save();ctx.globalAlpha*=.84;
    ctx.fillStyle=core;ctx.beginPath();
    ctx.arc(tip,0,1.8+1.1*pulse,0,TAU);ctx.fill();
    ctx.restore();
    ctx.restore();
}

function powerCurve(a,b,u){
    const p0x=a.x+25,p0y=a.y+19;
    const p3x=b.x-8,p3y=b.y+15;
    const p1x=p0x+(p3x-p0x)*.30,p1y=p0y+12;
    const p2x=p3x-(p3x-p0x)*.24,p2y=p3y-35;
    const inv=1-u;
    return {
        x:inv*inv*inv*p0x+3*inv*inv*u*p1x+3*inv*u*u*p2x+u*u*u*p3x,
        y:inv*inv*inv*p0y+3*inv*inv*u*p1y+3*inv*u*u*p2y+u*u*u*p3y
    };
}

/** A live, flowing connection after the reactor has been repaired. */
export function drawPowerLink(ctx, reactor, distributor, time, age, gatePowered=false) {
    if (!reactor || !distributor) return;
    const reveal=ease(Math.max(0,age)/1.12);
    if (reveal<=0) return;
    const t=Number.isFinite(time)?time:0;
    const shimmer=.87+.13*Math.sin(t*4.2);
    const segments=Math.max(2,Math.ceil(38*reveal));
    const path=()=>{
        ctx.beginPath();
        let q=powerCurve(reactor,distributor,0);
        ctx.moveTo(q.x,q.y);
        for(let j=1;j<=segments;j++){
            q=powerCurve(reactor,distributor,reveal*j/segments);
            ctx.lineTo(q.x,q.y);
        }
    };
    ctx.save();
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.strokeStyle=gatePowered?'#5cf7d1':'#5ad9fa';
    ctx.shadowColor=gatePowered?'#8efbe2':'#59e6ff';
    ctx.shadowBlur=ctx.__lowFx?0:(21);
    ctx.globalAlpha=.17*shimmer;
    ctx.lineWidth=27;path();ctx.stroke();
    ctx.globalAlpha=.32*shimmer;ctx.lineWidth=13;path();ctx.stroke();
    ctx.shadowBlur=ctx.__lowFx?0:(0);ctx.lineWidth=4;ctx.globalAlpha=.78*shimmer;
    ctx.strokeStyle=gatePowered?'#79fbe0':'#62e9ff';
    path();ctx.stroke();
    ctx.globalAlpha=.78;ctx.lineWidth=1.35;ctx.strokeStyle='#edffff';
    path();ctx.stroke();
    // Small photons travel along the completed part of the connection.
    // At start-up they travel only inside the currently revealed section.
    for(let i=0;i<5;i++){
        const u=((t*.37+i/5)%1)*reveal;
        if(u>.995)continue;
        const pt=powerCurve(reactor,distributor,u);
        const r=2.4+1.3*Math.sin(t*7+i*1.4)**2;
        bloom(ctx,pt.x,pt.y,11,gatePowered?'#8ffff0':'#a3f8ff',.47);
        ctx.save();ctx.globalAlpha=.85;ctx.fillStyle='#eaffff';
        ctx.beginPath();ctx.arc(pt.x,pt.y,r,0,TAU);ctx.fill();ctx.restore();
    }
    const end=powerCurve(reactor,distributor,reveal);
    bloom(ctx,end.x,end.y,19+3*Math.sin(t*6),gatePowered?'#76ffcf':'#65e9ff',.66);
    const start=powerCurve(reactor,distributor,0);
    bloom(ctx,start.x,start.y,14,gatePowered?'#76ffcf':'#65e9ff',.42);
    ctx.restore();
}

