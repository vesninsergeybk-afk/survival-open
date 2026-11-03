/**
 * Lightweight procedural armor layered over Wenrexa's CC0 turret sprites.
 * Coordinates are local to a 66px turret head; the barrel points along +X.
 * No external textures, allocations in the update loop, or WebGL required.
 */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const TURRET_PALETTE=Object.freeze({
    basic:{edge:'#76ddf2',light:'#c6f5ff',metal:'#34556d',dark:'#0c293b'},
    arc:{edge:'#65f6e3',light:'#dcfff5',metal:'#216963',dark:'#0b353c'},
    missile:{edge:'#ffb675',light:'#ffe4ad',metal:'#765044',dark:'#392936'},
    rail:{edge:'#8ac7ff',light:'#e5f7ff',metal:'#416587',dark:'#172e4b'}
});
export function turretPalette(path) {
    return TURRET_PALETTE[path]||TURRET_PALETTE.basic;
}
function polygon(ctx,pts,fill,stroke,width=1.4) {
    ctx.beginPath();ctx.moveTo(pts[0],pts[1]);
    for(let i=2;i<pts.length;i+=2)ctx.lineTo(pts[i],pts[i+1]);
    ctx.closePath();
    ctx.fillStyle=fill;ctx.fill();
    if(stroke){ctx.lineWidth=width;ctx.strokeStyle=stroke;ctx.stroke();}
}
/** Fixed mounting yoke: grows visibly with rank, never rotates with the gun. */
export function drawTurretMount(ctx,turret,x,y,time=0) {
    const level=clamp(turret.level||1,1,5),colors=turretPalette(turret.path);
    const radius=18+level*1.1;
    ctx.save();ctx.translate(x,y);
    ctx.fillStyle='#061525';ctx.strokeStyle='#45718b';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(0,0,radius+3,0,TAU);ctx.fill();ctx.stroke();
    // Eight facets read as an engineered mounting ring at mobile scale.
    const vertices=[];
    for(let i=0;i<8;i++) {
        const a=(i+.5)*TAU/8;
        vertices.push(Math.cos(a)*radius,Math.sin(a)*radius);
    }
    polygon(ctx,vertices,'#163449','#6b91aa',1.7);
    ctx.strokeStyle='#071b29';ctx.lineWidth=5;
    ctx.beginPath();ctx.arc(0,0,Math.max(8,radius-6),0,TAU);ctx.stroke();
    ctx.strokeStyle=colors.edge;ctx.globalAlpha=.26;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(0,0,radius-2,0,TAU);ctx.stroke();
    ctx.globalAlpha=1;
    for(let i=0;i<4;i++){
        const a=(i+.5)*TAU/4;
        const bx=Math.cos(a)*(radius-1),by=Math.sin(a)*(radius-1);
        ctx.fillStyle='#06111e';ctx.beginPath();ctx.arc(bx,by,2.5,0,TAU);ctx.fill();
        ctx.fillStyle='#90adbe';ctx.fillRect(bx-.7,by-.7,1.4,1.4);
    }
    // Each upgraded rank adds a visible powered segment on the outer ring.
    for(let i=0;i<level;i++){
        const a=-Math.PI*.75+i*.37;
        ctx.strokeStyle=colors.edge;ctx.globalAlpha=.65+.25*Math.sin(time*2+i);
        ctx.lineWidth=level>=4?3:2;
        ctx.beginPath();ctx.arc(0,0,radius+4,a,a+.27);ctx.stroke();
    }
    ctx.globalAlpha=1;
    if(level>=4){
        const spin=time*(level===5?.65:.33);
        ctx.strokeStyle=colors.edge;ctx.globalAlpha=.32;
        ctx.lineWidth=1.5;
        ctx.beginPath();ctx.arc(0,0,radius+7,spin,spin+.72);
        ctx.arc(0,0,radius+7,spin+Math.PI,spin+Math.PI+.72);
        ctx.stroke();
    }
    if(turret.tracked&&turret.overheat<=0){
        const a=turret.aimAngle||0;
        ctx.strokeStyle=colors.light;ctx.globalAlpha=.53;ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(0,0,radius+5,a-.4,a+.4);ctx.stroke();
    }
    ctx.restore();
}
/** Directional gun armor: a different silhouette for every turret weapon. */
export function drawTurretHead(ctx,turret,x,y,aim,time=0) {
    const level=clamp(turret.level||1,1,5);
    const path=turret.path||'basic',c=turretPalette(path);
    const ready=turret.overheat>0 ? .15 : 1;
    const charge=1-clamp((turret.cooldown||0)/(path==='rail'?2.65:
        path==='missile'?2.1:1.5),0,1);
    const pulse=.75+.25*Math.sin(time*5+turret.mount*.8);
    ctx.save();ctx.translate(x,y);ctx.rotate(aim);
    // Deep inset / hub makes the gun head look mechanically separate.
    polygon(ctx,[-16,-8,-9,-13,7,-12,14,-6,14,6,7,12,-9,13,-16,8],
        '#132b3d','#5f8195',1.5);
    ctx.fillStyle='#061726';ctx.beginPath();ctx.arc(-4,0,8.5,0,TAU);ctx.fill();
    ctx.fillStyle=c.metal;ctx.beginPath();ctx.arc(-4,0,5.6,0,TAU);ctx.fill();
    ctx.fillStyle=c.edge;ctx.globalAlpha=ready*pulse;
    ctx.beginPath();ctx.arc(-4,0,2.8,0,TAU);ctx.fill();
    ctx.globalAlpha=1;
    // Reinforced armor cheeks, cooling fins and yellow warning stripes.
    if(level>=2){
        for(const side of [-1,1]){
            polygon(ctx,[-12,side*12,-5,side*18,10+level,side*18,
                16+level,side*12,8,side*9,-8,side*9],
                '#243c4f',c.edge,1.5);
            ctx.strokeStyle=c.light;ctx.globalAlpha=.47;ctx.lineWidth=1.3;
            ctx.beginPath();ctx.moveTo(-5,side*15);
            ctx.lineTo(7+level,side*15);ctx.stroke();ctx.globalAlpha=1;
        }
    }
    if(path==='missile'){
        // Twin angular rocket pods and four distinct nozzle apertures.
        for(const side of [-1,1]){
            polygon(ctx,[0,side*5,8,side*14,27,side*14,33,side*9,
                28,side*3,7,side*3],c.dark,c.metal,1.9);
            ctx.strokeStyle=c.edge;ctx.lineWidth=1.7;
            ctx.beginPath();ctx.moveTo(9,side*11);ctx.lineTo(26,side*11);ctx.stroke();
            for(const tip of [18,28]){
                ctx.fillStyle='#071929';ctx.beginPath();
                ctx.arc(tip,side*8,3.3,0,TAU);ctx.fill();
                ctx.fillStyle=c.edge;ctx.globalAlpha=ready*(.3+.6*charge);
                ctx.beginPath();ctx.arc(tip,side*8,1.4,0,TAU);ctx.fill();
            }
            ctx.globalAlpha=1;
        }
    }else if(path==='rail'){
        // Railguns get two long rails, a central magnetic channel and coils.
        for(const side of [-1,1]){
            polygon(ctx,[1,side*5,10,side*9,34,side*9,39,side*6,
                39,side*4,9,side*3],c.dark,c.edge,1.6);
            ctx.strokeStyle=c.light;ctx.globalAlpha=.57;ctx.lineWidth=1.2;
            ctx.beginPath();ctx.moveTo(12,side*7);ctx.lineTo(35,side*7);ctx.stroke();
            ctx.globalAlpha=1;
        }
        ctx.fillStyle='#081d31';ctx.fillRect(9,-2.5,30,5);
        ctx.strokeStyle=c.light;ctx.lineWidth=1.3;
        for(let k=0;k<4;k++){
            const bx=13+k*6;
            ctx.globalAlpha=ready*(.35+.5*charge)*(.65+.35*Math.sin(time*8+k));
            ctx.beginPath();ctx.moveTo(bx,-5);ctx.lineTo(bx,5);ctx.stroke();
        }
        ctx.globalAlpha=1;
    }else if(path==='arc'){
        // Forked emitter jaws, with restrained electricity between the tips.
        for(const side of [-1,1]){
            polygon(ctx,[5,side*7,17,side*11,27,side*13,
                32,side*9,28,side*5,13,side*4],c.dark,c.edge,1.9);
            ctx.fillStyle=c.light;ctx.globalAlpha=ready*pulse;
            ctx.beginPath();ctx.arc(30,side*9,3.3,0,TAU);ctx.fill();
        }
        ctx.globalAlpha=ready*(.3+.25*Math.sin(time*13));
        ctx.strokeStyle=c.light;ctx.lineWidth=1.2;
        ctx.beginPath();ctx.moveTo(29,-9);ctx.lineTo(23,-3);
        ctx.lineTo(31,1);ctx.lineTo(26,9);ctx.stroke();
        ctx.globalAlpha=1;
    }else{
        // The stock pulse turret keeps a compact single-cannon silhouette.
        polygon(ctx,[7,-4,29,-5,34,-2,34,2,29,5,7,4],
            c.dark,c.edge,1.8);
        ctx.strokeStyle=c.light;ctx.lineWidth=1.6;
        ctx.beginPath();ctx.moveTo(11,0);ctx.lineTo(32,0);ctx.stroke();
    }
    // High tiers visibly grow extra heat sinks and powered fins.
    if(level>=4){
        for(const side of [-1,1]){
            polygon(ctx,[-12,side*19,-6,side*(23+level),8,side*(23+level),
                16,side*19,8,side*16,-7,side*16],
                c.dark,c.edge,1.6);
            ctx.strokeStyle=c.light;ctx.lineWidth=1.2;ctx.globalAlpha=.4;
            ctx.beginPath();ctx.moveTo(-4,side*(20+level));
            ctx.lineTo(6,side*(20+level));ctx.stroke();ctx.globalAlpha=1;
        }
    }
    if(level===5){
        // Elite units have an independently pulsing forward energy collar.
        ctx.strokeStyle=c.edge;ctx.lineWidth=2;ctx.globalAlpha=.65*pulse;
        ctx.beginPath();ctx.ellipse(17,0,4,15,0,-1.2,1.2);ctx.stroke();
        ctx.globalAlpha=1;
    }
    if(turret.overheat>0){
        ctx.fillStyle='#ff4c57';ctx.globalAlpha=.4+.4*Math.sin(time*12)**2;
        ctx.fillRect(-11,-3,7,6);ctx.globalAlpha=1;
    }
    ctx.restore();
}
