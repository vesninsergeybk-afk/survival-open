/**
 * Campaign scenery renderer. Reuses the local CC0 Wenrexa modular station
 * atlas already shipped with Survivor; Canvas2D and gradients handle the
 * large-scale light, hangar scaffolding, and energized network connections.
 * Asset: https://opengameart.org/content/assets-free-space-modular-buildings-kit
 */
import { drawStationPart, STATION_PARTS } from './station-art.js?v=base-86';
import { getShieldFrame } from './combat-art.js?v=art-888';
const TAU=Math.PI*2;
function near(game,x,y,pad=1100) {
    const p=game.player;
    return p && Math.abs(p.x-x)<pad && Math.abs(p.y-y)<pad*.78;
}
const centerDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function glow(ctx,x,y,r,color) {
    const g=ctx.createRadialGradient(x,y,3,x,y,r);
    g.addColorStop(0,color+'72');g.addColorStop(.35,color+'24');
    g.addColorStop(1,color+'00');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
}
/** Distant backdrop architecture: atmospheric, dim and never targetable.
 * Foreground stations retain the crisp modular art and animated lights. */
function platform(ctx,x,y,length,width,angle,tint,time) {
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    const fog=ctx.createRadialGradient(0,0,width*.1,0,0,length*.75);
    fog.addColorStop(0,tint+'20');fog.addColorStop(1,tint+'00');
    ctx.fillStyle=fog;ctx.beginPath();
    ctx.ellipse(0,0,length*.85,width*1.9,0,0,TAU);ctx.fill();
    ctx.globalAlpha=.27;
    ctx.fillStyle='#0b1730';ctx.strokeStyle=tint;ctx.lineWidth=2;
    ctx.beginPath();ctx.roundRect(-length/2,-width/2,length,width,15);ctx.fill();ctx.stroke();
    ctx.fillStyle='#18304a';ctx.fillRect(-length/2+17,-width/2+18,length-34,width-36);
    ctx.fillStyle='#071524';ctx.fillRect(-length/2+24,-width/2+25,length-48,width-50);
    // Real station atlas is still visible as a remote silhouette; the
    // foreground-only signal lamps and combat flash are intentionally absent.
    for(let d=-length/2+48;d<length/2-16;d+=105){
        ctx.globalAlpha=.13;
        drawStationPart(ctx,STATION_PARTS.bridge,d,0,88,Math.PI/2,.95);
        ctx.globalAlpha=.22;
        ctx.strokeStyle=tint;ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(d,-width*.37);ctx.lineTo(d,width*.37);ctx.stroke();
    }
    ctx.restore();
}
/** Remote, non-interactive ruins: translucent silhouettes in a gas cloud.
 * No textured meteorites or brown mechanical panels in the background layer.
 * The crisp PNG rocks still render only in the collision layer. */
function distantScaffold(ctx,p,time,tint){
    ctx.save();
    ctx.translate(p.x,p.y);ctx.rotate(p.angle);
    const length=p.length,width=p.width;
    const haze=ctx.createRadialGradient(0,0,width*.08,0,0,length*.85);
    haze.addColorStop(0,'#2b6d9160');
    haze.addColorStop(.46,'#3247a526');
    haze.addColorStop(1,'#182d5700');
    ctx.fillStyle=haze;ctx.beginPath();
    ctx.ellipse(0,0,length*.88,width*2.1,0,0,TAU);ctx.fill();
    ctx.globalAlpha=.22;
    ctx.strokeStyle=tint;ctx.lineWidth=6;
    ctx.shadowColor=tint;ctx.shadowBlur=22;
    ctx.beginPath();
    ctx.moveTo(-length*.51,-width*.24);
    ctx.lineTo(-length*.37,-width*.47);
    ctx.lineTo(length*.35,-width*.47);
    ctx.lineTo(length*.53,-width*.09);
    ctx.moveTo(-length*.42,width*.42);
    ctx.lineTo(length*.34,width*.42);
    ctx.lineTo(length*.49,width*.14);
    ctx.stroke();
    ctx.shadowBlur=0;ctx.lineWidth=2;
    ctx.setLineDash([24,36]);ctx.lineDashOffset=-time*1.8;
    ctx.beginPath();ctx.moveTo(-length*.35,0);ctx.lineTo(length*.36,0);
    ctx.stroke();ctx.setLineDash([]);
    ctx.restore();
}
// Subsector structures use different silhouettes. The former universal
// flat rectangular pad made every mission resemble the same warehouse.
function drawSectorPlatform(ctx,p,time,tint,index){
    const length=p.length,width=p.width;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);
    const shadow=ctx.createRadialGradient(0,0,0,0,0,length*.8);
    shadow.addColorStop(0,tint+'26');shadow.addColorStop(1,tint+'00');
    ctx.fillStyle=shadow;ctx.beginPath();
    ctx.ellipse(0,0,length*.78,width*1.75,0,0,TAU);ctx.fill();
    ctx.strokeStyle=tint;ctx.lineCap='round';ctx.lineJoin='round';
    if(index===2){
        // Open ore bridge: rail geometry and cylinders show the quarry's age.
        ctx.globalAlpha=.36;ctx.lineWidth=10;
        ctx.beginPath();ctx.moveTo(-length*.52,-width*.46);
        ctx.lineTo(length*.47,-width*.46);
        ctx.lineTo(length*.55,width*.38);
        ctx.moveTo(-length*.45,width*.46);ctx.lineTo(length*.55,width*.38);
        ctx.stroke();ctx.lineWidth=4;ctx.globalAlpha=.26;
        for(let i=0;i<6;i++){
            const x=-length*.41+i*length*.17;
            ctx.beginPath();ctx.moveTo(x,-width*.43);
            ctx.lineTo(x+length*.07,width*.38);ctx.stroke();
        }
    }else if(index===3){
        // Fractured signal disk, no misleading solid collision rectangle.
        ctx.globalAlpha=.26;ctx.lineWidth=14;
        ctx.beginPath();ctx.ellipse(0,0,length*.47,width*.66,0,.1,2.55);ctx.stroke();
        ctx.beginPath();ctx.ellipse(0,0,length*.47,width*.66,0,3.42,5.76);ctx.stroke();
        ctx.lineWidth=5;ctx.beginPath();
        ctx.moveTo(-length*.44,0);ctx.lineTo(length*.44,0);
        ctx.moveTo(0,-width*.56);ctx.lineTo(0,width*.56);ctx.stroke();
        ctx.globalAlpha=.13;ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(0,0,width*.34,time*.06,time*.06+Math.PI);ctx.stroke();
    }else{
        // Evacuation docks are a spine with curved magnetic braces.
        ctx.globalAlpha=.35;ctx.lineWidth=10;
        ctx.beginPath();ctx.moveTo(-length*.53,0);
        ctx.lineTo(length*.48,0);ctx.stroke();
        ctx.lineWidth=6;
        for(let k=0;k<4;k++){
            const x=-length*.36+k*length*.24;
            ctx.beginPath();
            ctx.ellipse(x,0,length*.095,width*.58,0,-1.15,1.15);ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(x,0,length*.095,width*.58,0,2.0,4.35);ctx.stroke();
        }
    }
    ctx.restore();
}
function ring(ctx,x,y,r,clr,phase,alpha=.7) {
    ctx.save();ctx.strokeStyle=clr;ctx.globalAlpha=alpha;ctx.lineWidth=2.4;
    ctx.setLineDash([22,13]);ctx.lineDashOffset=phase;
    ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();ctx.setLineDash([]);
    ctx.restore();
}
function machine(ctx,p,time,tint,online,locked=false,status=null) {
    const r=p.type==='gate'?112:p.type==='jammer'?84:p.type==='beacon'?69:
        p.type==='rig'?70:p.type==='decoy'?65:
        p.type==='route-choice'?57:44;
    glow(ctx,p.x,p.y,r*1.9,p.type==='cache'?'#c59a5a':online?tint:'#b6498e');
    ctx.save();ctx.translate(p.x,p.y);
    // Light shell marks an operational station; it never alters collision.
    if(online && p.type!=='cache'){
        const shield=getShieldFrame(time);
        if(shield){
            ctx.save();ctx.globalAlpha=.24;
            ctx.drawImage(shield,-r*.78,-r*.78,r*1.56,r*1.56);
            ctx.restore();
        }
    }
    if(p.type==='gate'){
        drawStationPart(ctx,STATION_PARTS.large,0,0,204,0,.85);
        drawStationPart(ctx,STATION_PARTS.arc,0,0,238,-time*.2,.91);
        drawStationPart(ctx,STATION_PARTS.arc,0,0,178,time*.25,.82);
        ring(ctx,0,0,130,online?'#79ffe9':'#e5acff',-time*24,.74);
        if(online){ctx.fillStyle='#7affdb';ctx.shadowColor='#58ffe4';ctx.shadowBlur=34;
            ctx.beginPath();ctx.arc(0,0,34+Math.sin(time*4)*3,0,TAU);ctx.fill();}
    }else if(p.type==='jammer'){
        ctx.rotate(time*.15);
        drawStationPart(ctx,STATION_PARTS.large,0,0,170,0,.94);
        drawStationPart(ctx,STATION_PARTS.arc,0,0,116,time*.42,.86);
        ring(ctx,0,0,110,online?'#5ee7b9':'#f36e9d',-time*22,.62);
    }else if(p.type==='beacon'){
        drawStationPart(ctx,STATION_PARTS.outpost,0,0,144,0,.92);
        drawStationPart(ctx,STATION_PARTS.arc,0,0,68,time*.28,.82);
        ring(ctx,0,0,85,online?'#80fff0':'#f8b77a',-time*15,.75);
    }else if(p.type==='route-choice'){
        // Fork terminals have two large arrow wings and a navigational
        // hologram. They cannot be confused with salvage crates.
        const clr=p.route==='direct'?'#ffc17b':'#8eeed7';
        drawStationPart(ctx,STATION_PARTS.outpost,0,0,107,0,.85);
        drawStationPart(ctx,STATION_PARTS.arc,0,0,75,time*.2,.7);
        ring(ctx,0,0,72,online?'#c2ffef':clr,-time*13,.74);
        ctx.strokeStyle=clr;ctx.lineWidth=8;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(-21,7);ctx.lineTo(9,7);
        ctx.moveTo(-3,-15);ctx.lineTo(18,7);ctx.lineTo(-3,29);ctx.stroke();
    }else if(p.type==='rig'){
        // Mechanical chassis and independently rotating excavator rings.
        drawStationPart(ctx,STATION_PARTS.bridge,0,0,155,Math.PI*.12,.96);
        drawStationPart(ctx,STATION_PARTS.outpost,0,0,118,0,.93);
        drawStationPart(ctx,STATION_PARTS.arc,0,0,108,online?time*.85:0,.9);
        drawStationPart(ctx,STATION_PARTS.arc,0,0,67,online?-time*1.2:0,.85);
        ring(ctx,0,0,92,online?'#6dfbe3':'#f1bf81',-time*(online?26:5),.69);
        if(online){
            ctx.fillStyle='#baffed';ctx.shadowColor='#64fbe2';ctx.shadowBlur=20;
            ctx.beginPath();ctx.arc(-72,0,10+Math.sin(time*9)*4,0,TAU);ctx.fill();
        }
        const hp=Math.max(0,Math.min(1,(p.hp||0)/(p.maxHp||1)));
        ctx.strokeStyle=hp>.45?'#90ffe5':'#ffad7b';ctx.lineWidth=7;
        ctx.beginPath();ctx.arc(0,0,102,-Math.PI/2,-Math.PI/2+TAU*hp);ctx.stroke();
    }else if(p.type==='decoy'){
        drawStationPart(ctx,STATION_PARTS.outpost,0,0,116,.38,.92);
        drawStationPart(ctx,STATION_PARTS.arc,0,0,94,-time*.35,.85);
        ring(ctx,0,0,83,p.used?'#ff845f':'#e694c7',time*22,.77);
        ring(ctx,0,0,112,'#f272ad',-time*17,.35);
        if(!p.used){
            ctx.strokeStyle='#ff9ad4';ctx.lineWidth=6;
            ctx.beginPath();ctx.moveTo(-13,-15);ctx.lineTo(0,0);
            ctx.lineTo(13,-15);ctx.stroke();
            ctx.fillStyle='#fbc2dd';ctx.beginPath();ctx.arc(0,21,5,0,TAU);ctx.fill();
        }
    }else{
        // Salvage has its own physical language: a muted, static container,
        // not an illuminated reactor with a moving activation ring.
        ctx.globalAlpha=p.used?.27:.94;
        drawStationPart(ctx,STATION_PARTS.depot,0,0,90,.12,.9);
        if(!p.used){
            ctx.fillStyle='#ffdfa6';ctx.shadowColor='#e5b86c';ctx.shadowBlur=9;
            ctx.fillRect(-12,-8,24,3);ctx.shadowBlur=0;
        }
    }
    ctx.restore();
    // Labels exist in world space, so they move naturally with the camera.
    ctx.save();ctx.textAlign='center';ctx.font='600 15px system-ui,sans-serif';
    ctx.shadowColor='#071521';ctx.shadowBlur=7;ctx.fillStyle='#f2f5ff';
    ctx.fillText(p.name,p.x,p.y-r-30);
    if(p.type==='cache')ctx.fillStyle=p.used?'#90b4ba':'#ffd49b';
    else ctx.fillStyle=online?'#89ffe0':'#ffaf98';
    ctx.font='11px system-ui,sans-serif';
    ctx.fillText(status||(p.type==='cache'?(p.used?'СОБРАНО':'СОБРАТЬ ДЕТАЛИ'):
        p.used?'АКТИВИРОВАНО':
        locked?'ЗАБЛОКИРОВАНО':online?'РАБОТАЕТ':'ДОСТУПНО ДЛЯ ВЗАИМОДЕЙСТВИЯ'),
        p.x,p.y-r-13);
    ctx.restore();
}
function hostileStation(ctx,site,game,time){
    const live=!site.destroyed&&site.core.hp>0;
    const hp=Math.max(0,site.core.hp/site.core.maxHp);
    ctx.save();ctx.translate(site.x,site.y);
    if(live){
        glow(ctx,0,0,210,'#e45e4c');
        ring(ctx,0,0,105+site.tier*8,'#ff976b',-time*18,.58);
        ctx.strokeStyle='rgba(255,98,63,.21)';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(0,0,site.range,0,TAU);ctx.stroke();
    }
    ctx.globalAlpha=live?1:.3;
    const ok=drawStationPart(ctx,STATION_PARTS.large,0,0,186,-.12,.95);
    if(!ok){
        ctx.fillStyle=live?'#573544':'#273341';ctx.strokeStyle='#bb856f';ctx.lineWidth=5;
        ctx.beginPath();ctx.moveTo(-96,0);ctx.lineTo(-50,-62);ctx.lineTo(52,-62);
        ctx.lineTo(98,0);ctx.lineTo(52,62);ctx.lineTo(-50,62);ctx.closePath();ctx.fill();ctx.stroke();
    }
    drawStationPart(ctx,STATION_PARTS.arc,0,0,137,live?time*.16:0,.9);
    const nodes=site.tier+1;
    for(let i=0;i<nodes;i++){
        const a=i*TAU/nodes+Math.PI*.18;
        const x=Math.cos(a)*78,y=Math.sin(a)*78;
        drawStationPart(ctx,i%2?STATION_PARTS.missile:STATION_PARTS.turretIdle,
            x,y,68,a+Math.PI/2,.97);
        if(live){ctx.fillStyle='#ff8255';ctx.shadowColor='#ff7153';ctx.shadowBlur=15;
            ctx.beginPath();ctx.arc(x,y,5,0,TAU);ctx.fill();ctx.shadowBlur=0;}
    }
    if(live){
        ctx.fillStyle='#ffb679';ctx.shadowColor='#f97551';ctx.shadowBlur=23;
        ctx.beginPath();ctx.arc(0,0,18+Math.sin(time*3)*2,0,TAU);ctx.fill();
    }
    ctx.restore();
    ctx.save();ctx.textAlign='center';ctx.shadowColor='#180b1d';ctx.shadowBlur=8;
    ctx.font='700 14px system-ui,sans-serif';ctx.fillStyle=live?'#ffd2b0':'#9da5b4';
    ctx.fillText(live?'⚠ '+site.name:'РУИНЫ · '+site.name,site.x,site.y-133);
    if(live){
        ctx.fillStyle='#1e172a';ctx.fillRect(site.x-76,site.y-119,152,9);
        ctx.fillStyle=hp>.5?'#fb9567':'#e8585d';
        ctx.fillRect(site.x-75,site.y-118,150*hp,7);
        ctx.fillStyle='#ffdbca';ctx.font='11px system-ui,sans-serif';
        ctx.fillText('ОБОРОНА '+site.tier+'/3',site.x,site.y-98);
    }
    ctx.restore();
}
function convoyEscortArt(ctx,game,world,time,angle){
    const c=world.convoy,trap=world.trap;
    if(!c)return;
    if(!trap){
        // Two genuinely visible ships escort the central transport before
        // the scripted attack; their relative positions follow the route.
        for(const side of [-1,1]){
            const x=c.x+Math.cos(angle)*side*224;
            const y=c.y+Math.sin(angle)*side*224;
            if(!near(game,x,y,940))continue;
            ctx.save();ctx.translate(x,y);ctx.rotate(angle);
            drawStationPart(ctx,STATION_PARTS.carrier,0,0,157,Math.PI/2,.85);
            ctx.fillStyle='#87f6ed';ctx.shadowColor='#77eeff';ctx.shadowBlur=16;
            ctx.beginPath();ctx.ellipse(-79,0,19,7,0,0,TAU);ctx.fill();
            ctx.restore();
        }
        return;
    }
    for(const [index,wreck] of trap.wrecks.entries()){
        const alpha=Math.max(0,1-trap.progress);
        if(!near(game,wreck.x,wreck.y,940)||alpha<=0)continue;
        const outward=index===0?1:-1;
        const drift=trap.progress*75*outward;
        ctx.save();ctx.translate(wreck.x+trap.dx*drift,wreck.y+trap.dy*drift);
        ctx.rotate(trap.angle+outward*.19+trap.progress*outward*.48);
        ctx.globalAlpha=.85*alpha;ctx.filter='grayscale(.75) brightness(.67)';
        drawStationPart(ctx,STATION_PARTS.carrier,0,0,165,Math.PI/2);
        ctx.filter='none';
        // Outer armour comes off in visible pieces as work progresses.
        drawStationPart(ctx,STATION_PARTS.bridge,17+outward*trap.progress*34,
            47+trap.progress*35,66,trap.progress*.8,.9);
        drawStationPart(ctx,STATION_PARTS.wing,-26-outward*trap.progress*30,
            -40-trap.progress*34,71,-trap.progress*.9,.7);
        ctx.strokeStyle='#ff9d6f';ctx.shadowColor='#ff813d';ctx.shadowBlur=16;
        ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-52,-32);
        ctx.lineTo(4,10);ctx.lineTo(46,43);ctx.stroke();
        ctx.restore();
        if(trap.phase==='impact'||Math.sin(time*9+index)>0.65){
            ctx.save();ctx.globalAlpha=alpha*.63;
            glow(ctx,wreck.x,wreck.y,110,'#f17841');
            ctx.restore();
        }
    }
    if(trap.phase==='salvage'){
        for(let n=0;n<4;n++){
            const wreck=trap.wrecks[n%2];
            const phase=(game.save?.settings?.reducedMotion?0:time*.54)+n*1.57;
            const x=wreck.x+Math.cos(phase)*66;
            const y=wreck.y+Math.sin(phase)*58;
            if(!near(game,x,y,700))continue;
            ctx.save();
            ctx.strokeStyle='#b7effc';ctx.shadowColor='#6ce3ff';
            ctx.shadowBlur=9;ctx.lineWidth=2;
            ctx.beginPath();ctx.moveTo(x,y);
            ctx.lineTo(wreck.x+Math.cos(phase+1)*21,
                wreck.y+Math.sin(phase+1)*19);ctx.stroke();
            ctx.restore();
            drawStationPart(ctx,STATION_PARTS.scoutStart+
                (Math.floor((game.save?.settings?.reducedMotion?0:time)*10+n*2)%9),x,y,36,phase);
        }
    }
    for(const shot of trap.shots){
        if(!near(game,shot.x,shot.y,540))continue;
        const urgency=1-shot.ttl/shot.total;
        ctx.save();ctx.strokeStyle='#ff8c6f';ctx.fillStyle='#ff6a3920';
        ctx.shadowColor='#ff633f';ctx.shadowBlur=18;
        ctx.lineWidth=3+urgency*3;
        ctx.beginPath();ctx.arc(shot.x,shot.y,shot.radius,0,TAU);
        ctx.fill();ctx.stroke();
        ctx.beginPath();ctx.moveTo(shot.x-shot.radius*1.24,shot.y);
        ctx.lineTo(shot.x+shot.radius*1.24,shot.y);
        ctx.moveTo(shot.x,shot.y-shot.radius*1.24);
        ctx.lineTo(shot.x,shot.y+shot.radius*1.24);
        ctx.stroke();ctx.restore();
    }
}
function convoyArt(ctx,game,world,time){
    const c=world.convoy;
    if(!c||!near(game,c.x,c.y,1150))return;
    const goal=world.route[Math.min(c.leg,world.route.length-1)];
    const angle=world.trap?.angle??(goal?Math.atan2(goal.y-c.y,goal.x-c.x):0);
    convoyEscortArt(ctx,game,world,time,angle);
    glow(ctx,c.x,c.y,225,'#43c6c6');
    ctx.save();ctx.translate(c.x,c.y);ctx.rotate(angle);
    // Engine light remains visible when the textured atlas has not loaded.
    const moving=c.phase==='moving';
    const pushing=world.trap?.phase==='impact';
    if(moving||pushing){
        ctx.save();ctx.globalAlpha=.48+.3*Math.sin(time*14);
        ctx.fillStyle='#54ffe9';ctx.shadowColor='#60fbff';ctx.shadowBlur=28;
        ctx.beginPath();ctx.ellipse(-113,0,(pushing?88:45)+Math.sin(time*9)*13,
            pushing?26:17,0,0,TAU);ctx.fill();
        ctx.restore();
    }
    if(!drawStationPart(ctx,STATION_PARTS.carrier,0,0,242,Math.PI/2,.99)){
        ctx.fillStyle='#20354c';ctx.strokeStyle='#8ff7ef';ctx.lineWidth=5;
        ctx.beginPath();ctx.moveTo(116,0);ctx.lineTo(30,-59);ctx.lineTo(-96,-43);
        ctx.lineTo(-110,0);ctx.lineTo(-96,43);ctx.lineTo(30,59);ctx.closePath();ctx.fill();ctx.stroke();
    }
    drawStationPart(ctx,STATION_PARTS.hanger,-22,0,129,Math.PI/2,.88);
    drawStationPart(ctx,STATION_PARTS.bridge,57,0,96,Math.PI/2,.96);
    for(const side of [-1,1]){
        drawStationPart(ctx,STATION_PARTS.wing,-26,side*68,102,side*.24,.91);
        ctx.fillStyle='#8dfdee';ctx.shadowColor='#74fff0';ctx.shadowBlur=11;
        ctx.fillRect(-73,side*63-3,8,7);
    }
    ctx.restore();
    const hp=Math.max(0,c.hp/c.maxHp);
    ctx.save();ctx.textAlign='center';ctx.shadowColor='#07182a';ctx.shadowBlur=8;
    ctx.font='700 15px system-ui,sans-serif';ctx.fillStyle='#e5fffa';
    ctx.fillText('◈ КАРАВАН «ПИЛИГРИМ»',c.x,c.y-125);
    ctx.fillStyle='#12283a';ctx.fillRect(c.x-91,c.y-114,182,10);
    ctx.fillStyle=hp>.6?'#6fffe7':hp>.3?'#f7c26e':'#ff7779';
    ctx.fillRect(c.x-90,c.y-113,180*hp,8);
    ctx.font='11px system-ui,sans-serif';ctx.fillStyle='#b6f7eb';
    ctx.fillText(Math.round(hp*100)+'% · '+(c.phase==='trapped'?'ЗАЖАТ ОБЛОМКАМИ':
        c.phase==='salvaging'?'ДРОНЫ ОСВОБОЖДАЮТ ПРОХОД':
        c.phase==='moving'?'В ПУТИ':
        c.phase==='charging'?'ЗАРЯДКА':c.phase==='blocked'?'ПУТЬ ПЕРЕКРЫТ':
        c.phase==='waiting'?'ОЖИДАЕТ ПИЛОТА':c.phase==='docking'?'ОЖИДАЕТ РЕЛЕ':
        c.phase==='launch'?'ОЖИДАЕТ ЗАПУСКА':'У ВРАТ'),c.x,c.y-89);
    ctx.restore();
}

/**
 * Silhouettes for the first mission. These deliberately differ in scale and
 * profile: a shattered dock, a broken transmission arch, a relay forest and
 * the Gamma fortress. They are visual scenery, never loot or collisions.
 */
function drawFirstMissionLandmark(ctx,game,world,mark,t){
    const x=world.cx+mark.dx,y=world.cy+mark.dy,r=mark.span;
    if(!near(game,x,y,r+600))return;
    const online=mark.onAt===0?
        !!game.friendlyBases.bases[0]?.activated:
        (world.first?.beacons||0)>=mark.onAt;
    const metal=online?'#719fb2':'#536b82';
    const power=online?'#72f6dd':'#6f7c9b';
    ctx.save();ctx.translate(x,y);ctx.rotate(mark.angle||0);
    const shadow=ctx.createRadialGradient(0,0,r*.12,0,0,r);
    shadow.addColorStop(0,'#06111edb');shadow.addColorStop(.68,'#06152357');
    shadow.addColorStop(1,'#07162700');
    ctx.fillStyle=shadow;ctx.beginPath();
    ctx.ellipse(0,0,r,r*.72,0,0,TAU);ctx.fill();
    ctx.strokeStyle=metal;ctx.fillStyle='#10253799';
    ctx.lineCap='round';ctx.lineJoin='round';
    if(mark.kind==='dockyard'){
        // A damaged ship cradle: asymmetric long rails and ribs, visible
        // even when the decorative 3D GLB is disabled.
        for(const sign of [-1,1]){
            ctx.lineWidth=13;ctx.globalAlpha=.62;
            ctx.beginPath();ctx.moveTo(-r*.77,sign*r*.25);
            ctx.lineTo(-r*.43,sign*r*.36);
            ctx.lineTo(r*.50,sign*r*.36);
            ctx.lineTo(r*.76,sign*r*.17);ctx.stroke();
            for(let k=0;k<4;k++){
                const dx=-r*.42+k*r*.27;
                ctx.lineWidth=5;ctx.beginPath();
                ctx.moveTo(dx,sign*r*.36);
                ctx.lineTo(dx+r*.08,sign*r*.20);ctx.stroke();
            }
        }
        ctx.globalAlpha=.34;
        drawStationPart(ctx,STATION_PARTS.carrier,r*.04,0,r*.68,-.12,.88);
        ctx.globalAlpha=.6;
        drawStationPart(ctx,STATION_PARTS.bridge,-r*.6,0,r*.3,Math.PI/2,.84);
    }else if(mark.kind==='arch'){
        // Broken ring with a large missing span: recognisable from afar.
        ctx.lineWidth=21;ctx.globalAlpha=.53;
        ctx.beginPath();ctx.ellipse(0,0,r*.66,r*.45,0,.24,2.20);ctx.stroke();
        ctx.beginPath();ctx.ellipse(0,0,r*.66,r*.45,0,3.22,5.55);ctx.stroke();
        ctx.globalAlpha=.44;ctx.lineWidth=6;
        ctx.beginPath();ctx.moveTo(-r*.50,-r*.34);
        ctx.lineTo(-r*.74,-r*.55);ctx.moveTo(r*.45,r*.38);
        ctx.lineTo(r*.72,r*.56);ctx.stroke();
        for(const sign of [-1,1])
            drawStationPart(ctx,STATION_PARTS.bridge,sign*r*.54,
                sign*r*.18,r*.29,sign*.3,.8);
    }else if(mark.kind==='relay'){
        // Antenna forest rises over a broad triangular skeleton.
        ctx.globalAlpha=.58;ctx.lineWidth=11;
        const corners=[[-r*.55,r*.38],[r*.55,r*.38],[0,-r*.56]];
        ctx.beginPath();ctx.moveTo(...corners[0]);
        ctx.lineTo(...corners[1]);ctx.lineTo(...corners[2]);ctx.closePath();ctx.stroke();
        for(let k=0;k<3;k++){
            const [px,py]=corners[k];
            drawStationPart(ctx,STATION_PARTS.outpost,px,py,r*.36,k*2.1,.77);
            ctx.strokeStyle=power;ctx.lineWidth=2;ctx.globalAlpha=online ? .52 : .15;
            ctx.beginPath();ctx.arc(px,py,r*.23,-2.5,-.7);ctx.stroke();
        }
        ctx.globalAlpha=.68;
        drawStationPart(ctx,STATION_PARTS.arc,0,0,r*.26,online?t*.17:0,.84);
    }else if(mark.kind==='bastion'){
        // The final fortress becomes a bright crown when Gamma wakes.
        for(let k=0;k<8;k++){
            const a=k*TAU/8;
            ctx.save();ctx.rotate(a);
            ctx.globalAlpha=.68;ctx.strokeStyle=metal;ctx.lineWidth=20;
            ctx.beginPath();ctx.arc(0,0,r*.71,-.24,.24);ctx.stroke();
            ctx.lineWidth=6;ctx.beginPath();
            ctx.moveTo(r*.54,-r*.13);ctx.lineTo(r*.78,-r*.13);
            ctx.moveTo(r*.54,r*.13);ctx.lineTo(r*.78,r*.13);ctx.stroke();
            if(k%2===0){
                ctx.globalAlpha=.7;
                drawStationPart(ctx,STATION_PARTS.outpost,r*.75,0,r*.20,0,.82);
            }
            ctx.restore();
        }
        ctx.globalAlpha=.48;
        drawStationPart(ctx,STATION_PARTS.large,0,0,r*.62,0,.86);
    }
    if(online){
        // Electrical awakening is a visible consequence of player actions.
        ctx.globalAlpha=.56+.10*Math.sin(t*2.4);
        ctx.strokeStyle=power;ctx.shadowColor=power;ctx.shadowBlur=20;
        ctx.lineWidth=3;ctx.setLineDash([22,30]);ctx.lineDashOffset=-t*23;
        ctx.beginPath();ctx.ellipse(0,0,r*.76,r*.51,0,0,TAU);ctx.stroke();
        ctx.setLineDash([]);ctx.shadowBlur=0;
        for(let k=0;k<4;k++){
            const a=t*.4+k*TAU/4;
            ctx.fillStyle=power;ctx.beginPath();
            ctx.arc(Math.cos(a)*r*.72,Math.sin(a)*r*.48,4.5,0,TAU);
            ctx.fill();
        }
    }
    ctx.restore();
}

/**
 * Mission-specific silhouettes are diffuse, low-contrast landmarks.
 * The sharp station UI and native asteroids remain the only interactive
 * objects; these paths are entirely decorative and have no hitboxes.
 */
function drawRegionLandmark(ctx,game,world,mark,t){
    const x=world.cx+mark.dx,y=world.cy+mark.dy,r=mark.span;
    if(!near(game,x,y,r+650))return;
    const powered=world.sceneryPowered?.(mark)??false;
    const warm=world.index===2, cold=world.index===3;
    const steel=warm?'#a18473':cold?'#777fba':'#6f9eaf';
    const edge=warm?'#e6ae77':cold?'#b1abf4':'#9debe2';
    ctx.save();ctx.translate(x,y);ctx.rotate(mark.angle||0);
    const shade=ctx.createRadialGradient(0,0,r*.1,0,0,r*1.13);
    shade.addColorStop(0,warm?'#261516ad':cold?'#12142aab':'#101a32ac');
    shade.addColorStop(.67,'#14152b42');shade.addColorStop(1,'#10152600');
    ctx.fillStyle=shade;ctx.beginPath();ctx.ellipse(0,0,r*1.13,r*.83,0,0,TAU);ctx.fill();
    ctx.strokeStyle=steel;ctx.fillStyle=steel;ctx.lineCap='round';
    ctx.lineJoin='round';ctx.globalAlpha=.45;
    if(mark.kind==='cliff'){
        // Two opposing broken asteroid plates: the player sees an entire
        // canyon wall instead of another row of identical floating rocks.
        for(const side of [-1,1]){
            ctx.save();ctx.scale(1,side);
            ctx.fillStyle='#362a358a';ctx.beginPath();
            ctx.moveTo(-r*.85,r*.36);ctx.lineTo(-r*.66,r*.04);
            ctx.lineTo(-r*.40,r*.12);ctx.lineTo(-r*.20,-r*.23);
            ctx.lineTo(r*.08,-r*.13);ctx.lineTo(r*.40,-r*.39);
            ctx.lineTo(r*.72,-r*.11);ctx.lineTo(r*.92,r*.30);
            ctx.closePath();ctx.fill();
            ctx.strokeStyle=edge;ctx.lineWidth=7;ctx.beginPath();
            ctx.moveTo(-r*.75,r*.22);ctx.lineTo(-r*.41,r*.02);
            ctx.lineTo(-r*.20,-r*.23);ctx.lineTo(r*.07,-r*.14);
            ctx.lineTo(r*.39,-r*.39);ctx.stroke();
            ctx.restore();
        }
    }else if(mark.kind==='mine'){
        // Enormous half-open ore excavator with stepped conveyors.
        ctx.lineWidth=17;ctx.beginPath();ctx.moveTo(-r*.82,r*.3);
        ctx.lineTo(-r*.49,-r*.25);ctx.lineTo(r*.05,-r*.38);
        ctx.lineTo(r*.65,-r*.07);ctx.lineTo(r*.83,r*.33);ctx.stroke();
        ctx.lineWidth=7;
        for(let k=0;k<6;k++){
            const a=-r*.55+k*r*.2;
            ctx.beginPath();ctx.moveTo(a,-r*.28);ctx.lineTo(a+r*.24,r*.27);ctx.stroke();
        }
        ctx.globalAlpha=.32;
        drawStationPart(ctx,STATION_PARTS.carrier,r*.28,r*.14,r*.55,-.2,.7);
        ctx.globalAlpha=.55;ctx.strokeStyle=edge;ctx.lineWidth=3;
        for(let k=0;k<5;k++){
            const px=-r*.5+k*r*.2;
            ctx.beginPath();ctx.moveTo(px,r*.27);ctx.lineTo(px+r*.09,r*.27);ctx.stroke();
        }
    }else if(mark.kind==='refinery'){
        for(let k=0;k<4;k++){
            const px=(k-1.5)*r*.37,rr=r*(k%2?.12:.16);
            ctx.strokeStyle=steel;ctx.lineWidth=12;
            ctx.beginPath();ctx.ellipse(px,0,rr,r*.47,0,0,TAU);ctx.stroke();
            ctx.lineWidth=5;ctx.beginPath();
            ctx.moveTo(px-rr,r*.22);ctx.lineTo(px+rr,r*.22);ctx.stroke();
        }
        ctx.strokeStyle=edge;ctx.globalAlpha=.28;ctx.lineWidth=8;
        ctx.beginPath();ctx.moveTo(-r*.8,r*.4);ctx.lineTo(r*.76,r*.4);
        ctx.lineTo(r*.76,-r*.28);ctx.stroke();
    }else if(mark.kind==='gateyard'||mark.kind==='evac'){
        const arcR=mark.kind==='gateyard'?.59:.75;
        ctx.strokeStyle=steel;ctx.lineWidth=26;ctx.globalAlpha=.46;
        ctx.beginPath();ctx.ellipse(0,0,r*arcR,r*.52,0,.3,2.52);ctx.stroke();
        ctx.beginPath();ctx.ellipse(0,0,r*arcR,r*.52,0,3.36,5.88);ctx.stroke();
        for(const side of [-1,1]){
            ctx.strokeStyle=edge;ctx.globalAlpha=.3;ctx.lineWidth=11;
            ctx.beginPath();ctx.moveTo(side*r*.53,-r*.43);
            ctx.lineTo(side*r*.86,-r*.61);ctx.stroke();
        }
        if(mark.kind==='evac'){
            ctx.strokeStyle=edge;ctx.globalAlpha=powered?.27:.09;
            ctx.lineWidth=4;ctx.setLineDash([27,42]);ctx.lineDashOffset=-t*12;
            ctx.beginPath();ctx.ellipse(0,0,r*.52,r*.39,0,0,TAU);ctx.stroke();
            ctx.setLineDash([]);
        }
    }else if(mark.kind==='graveyard'||mark.kind==='wreck'||mark.kind==='cargo'){
        // Split vessel hulls, bent antenna masts and scattering fragments.
        for(let k=0;k<3;k++){
            const px=(k-1)*r*.43,py=Math.sin(k*2.3)*r*.23;
            ctx.save();ctx.translate(px,py);ctx.rotate((k-1)*.37);
            ctx.strokeStyle=steel;ctx.lineWidth=12;ctx.beginPath();
            ctx.moveTo(-r*.21,-r*.13);ctx.lineTo(-r*.3,r*.03);
            ctx.lineTo(-r*.11,r*.24);ctx.lineTo(r*.20,r*.10);
            ctx.lineTo(r*.23,-r*.20);ctx.stroke();
            ctx.lineWidth=3;ctx.strokeStyle=edge;
            ctx.beginPath();ctx.moveTo(-r*.2,-r*.1);ctx.lineTo(r*.12,-r*.04);ctx.stroke();
            ctx.restore();
        }
        if(mark.kind==='cargo'){
            ctx.globalAlpha=.33;
            drawStationPart(ctx,STATION_PARTS.carrier,0,0,r*.55,.12,.74);
        }
    }else if(mark.kind==='antenna'){
        for(let k=0;k<5;k++){
            const px=(k-2)*r*.28;
            ctx.strokeStyle=steel;ctx.lineWidth=8;ctx.beginPath();
            ctx.moveTo(px,r*.4);ctx.lineTo(px,-r*(k%2?.53:.72));ctx.stroke();
            ctx.lineWidth=3;ctx.beginPath();
            ctx.moveTo(px-r*.1,-r*.28);ctx.lineTo(px+r*.1,-r*.28);ctx.stroke();
            ctx.strokeStyle=edge;ctx.globalAlpha=powered?.4:.1;
            ctx.beginPath();ctx.arc(px,-r*(k%2?.53:.72),r*.08,0,TAU);ctx.stroke();
        }
    }else if(mark.kind==='lab'){
        ctx.strokeStyle=steel;ctx.lineWidth=19;
        for(let k=0;k<6;k++){
            const a=k*TAU/6;
            ctx.beginPath();ctx.arc(0,0,r*.54,a+.1,a+.91);ctx.stroke();
        }
        drawStationPart(ctx,STATION_PARTS.large,0,0,r*.44,.2,.65);
    }else if(mark.kind==='citadel'){
        ctx.strokeStyle=steel;ctx.lineWidth=15;
        for(let k=0;k<8;k++){
            const a=k*TAU/8;
            ctx.save();ctx.rotate(a);ctx.beginPath();
            ctx.moveTo(r*.26,-r*.07);ctx.lineTo(r*.73,-r*.19);
            ctx.lineTo(r*.77,r*.19);ctx.lineTo(r*.26,r*.07);ctx.stroke();
            ctx.restore();
        }
        drawStationPart(ctx,STATION_PARTS.outpost,0,0,r*.58,.3,.74);
    }else if(mark.kind==='storm'){
        // Wide wispy boundaries suggest a dangerous nebula without drawing a
        // fake collision wall or masking live projectiles.
        ctx.strokeStyle=edge;ctx.globalAlpha=.12;ctx.lineWidth=50;
        for(let k=0;k<4;k++){
            ctx.beginPath();
            ctx.ellipse(k*r*.12-r*.18,k*r*.07-r*.10,r*(.55-k*.05),
                r*(.19+k*.035),k*.3,-.75,2.3);ctx.stroke();
        }
        ctx.globalAlpha=.17;ctx.lineWidth=3;
        for(let k=0;k<7;k++){
            const px=Math.sin(k*2.7)*r*.63,py=Math.cos(k*1.3)*r*.42;
            ctx.beginPath();ctx.moveTo(px-r*.06,py-r*.04);
            ctx.lineTo(px+r*.05,py+r*.06);ctx.stroke();
        }
    }
    if(powered && mark.kind!=='storm' && mark.kind!=='cliff'){
        // One restrained, persistent response to game progress.
        ctx.globalAlpha=.34+.05*Math.sin(t*1.4);
        ctx.strokeStyle=edge;ctx.lineWidth=3;
        ctx.setLineDash([18,40]);ctx.lineDashOffset=-t*10;
        ctx.beginPath();ctx.ellipse(0,0,r*.8,r*.61,0,0,TAU);ctx.stroke();
        ctx.setLineDash([]);
    }
    ctx.restore();
}
export function drawMissionBackdrop(ctx,game,world) {
    const {scene,cx,cy}=world,time=game.gameTime||0;
    ctx.save();
    // Each scene has a distinct light composition, not a global colour swap.
    for(const [dx,dy,r,color] of scene.lights){
        const x=cx+dx,y=cy+dy;
        if(near(game,x,y,r+500))glow(ctx,x,y,r,color);
    }
    if(world.index===1){
        // A connected ion river ties the three beacons to the final bastions.
        // It is atmosphere only; asteroids and station hitboxes stay sharp.
        const cloudlets=[
            [-560,-360,540,'#236b9d'],[360,-160,580,'#1d91a2'],
            [1070,-470,680,'#5351ad'],[1580,270,690,'#326d9f'],
            [2180,-180,750,'#6b60ad'],[2830,180,830,'#207d9f'],
            [3400,-420,580,'#445ca2']
        ];
        for(const [dx,dy,r,color] of cloudlets)
            if(near(game,cx+dx,cy+dy,r+320))glow(ctx,cx+dx,cy+dy,r,color);
        // A continuous, diffuse ion current replaces the old 190px dashed
        // stroke: each dash used to look like a solid, interactive rectangle.
        ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
        ctx.beginPath();ctx.moveTo(cx-440,cy-130);
        ctx.bezierCurveTo(cx+700,cy-700,cx+1150,cy+390,cx+1790,cy+110);
        ctx.bezierCurveTo(cx+2370,cy-280,cx+2700,cy+110,cx+3180,cy-90);
        ctx.strokeStyle='#418dc219';ctx.lineWidth=112;ctx.stroke();
        ctx.strokeStyle='#8ddcfe0c';ctx.lineWidth=28;ctx.stroke();
        ctx.restore();
        ring(ctx,cx+15,cy-170,610,scene.tint,-time*1.3,.10);
    }else if(world.index===2){
        // Rifts in the asteroid belt: false-depth shadows behind collision rocks.
        ctx.strokeStyle='#ba7b4b1d';ctx.lineWidth=110;
        for(const side of [-1,1]){
            ctx.beginPath();
            for(let i=0;i<=50;i++){
                const x=-1200+i*48,y=side*(305+55*Math.sin(x*.006));
                if(!i)ctx.moveTo(cx+x,cy+y);else ctx.lineTo(cx+x,cy+y);
            }
            ctx.stroke();
        }
        for(const [dx,dy,r,color] of [[260,460,480,'#8f4a2c'],
            [1650,-430,520,'#287b94'],[2250,980,690,'#ad6530'],
            [3190,320,670,'#7a4e8a'],[4030,430,760,'#d66b43'],
            [5000,150,700,'#744d97'],[5640,-760,700,'#29849d']]){
            if(near(game,cx+dx,cy+dy,r+350))glow(ctx,cx+dx,cy+dy,r,color);
        }
        // Two readable survey tracks actually match the selectable routes.
        const quarry=world.quarry,rig=quarry?.rig;
        if(rig&&quarry.started&&!quarry.completed){
            const fork={x:cx+world.scene.quarryFork.dx,
                y:cy+world.scene.quarryFork.dy};
            ctx.save();ctx.lineWidth=quarry.routeChoice?7:5;
            ctx.setLineDash([24,19]);ctx.lineDashOffset=-time*19;
            if(!quarry.forkReached){
                ctx.strokeStyle='#f7d28b95';
                ctx.beginPath();ctx.moveTo(rig.x,rig.y);
                ctx.lineTo(fork.x,fork.y);ctx.stroke();
            }
            for(const [key,route] of Object.entries(world.scene.quarryRoutes)){
                const chosen=quarry.routeChoice===key;
                ctx.strokeStyle=quarry.routeChoice?
                    (chosen?'#88f6dbb0':'#a2b0c322'):
                    key==='direct'?'#f8ae7580':'#86f3d985';
                ctx.beginPath();ctx.moveTo(fork.x,fork.y);
                for(const point of route)ctx.lineTo(cx+point.dx,cy+point.dy);
                ctx.stroke();
                if(chosen){
                    const point=route[Math.min(quarry.routeLeg,route.length-1)];
                    ring(ctx,cx+point.dx,cy+point.dy,100,
                        '#8ff8d8',-time*16,.36);
                }
            }
            ctx.restore();
        }
    }else if(world.index===3){
        // A giant network of separate signal islands in the purple graveyard.
        for(const [dx,dy,r,color] of [[-560,-150,540,'#375fbb'],
            [660,-920,720,'#37518b'],[1510,-1230,650,'#238d95'],
            [2210,520,860,'#5543bd'],[2700,1310,760,'#8351ba'],
            [3480,-480,760,'#ba438a'],[3920,-1070,590,'#237c97'],
            [4720,700,760,'#7e336d']]){
            if(near(game,cx+dx,cy+dy,r+350))glow(ctx,cx+dx,cy+dy,r,color);
        }
        // Live links make restoration visible across the ruined network.
        const bases=game.friendlyBases.bases;
        const links=[[0,1],[0,2],[1,3],[2,3]];
        ctx.save();ctx.lineCap='round';
        for(const [from,to] of links){
            const a=bases[from],b=bases[to];
            if(!a||!b)continue;
            const linked=a.activated&&b.activated&&a.hp>0&&b.hp>0;
            ctx.strokeStyle=linked?'#7dfce374':'#696b9652';
            ctx.lineWidth=linked?11:3;
            ctx.setLineDash(linked?[28,16]:[12,27]);
            ctx.lineDashOffset=linked?-time*26:0;
            ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
            if(linked){
                const phase=(time*.15+to*.19)%1;
                const x=a.x+(b.x-a.x)*phase,y=a.y+(b.y-a.y)*phase;
                glow(ctx,x,y,64,'#71eacb');
            }
        }
        ctx.restore();
        const decoy=world.props.find(p=>p.id==='decoy');
        if(decoy&&!world.network?.decoyChecked&&near(game,decoy.x,decoy.y,850)){
            ring(ctx,decoy.x,decoy.y,250,'#ff72ad',-time*24,.32);
            ring(ctx,decoy.x,decoy.y,340,'#b26dbf',time*13,.18);
        }
    }else if(world.index===4){
        // Layered ion clouds and a bright, readable convoy lane. All movement
        // obstacles remain the actual native collision rocks.
        for(const [dx,dy,r,color] of [[-280,-650,650,'#2d90a8'],
            [430,490,720,'#5935a8'],[1070,-500,720,'#276bb8'],
            [1600,590,710,'#7351be'],[2190,-460,700,'#20999d']]){
            if(near(game,cx+dx,cy+dy,r+350))glow(ctx,cx+dx,cy+dy,r,color);
        }
        const points=[{x:world.cx+world.scene.convoyStart.dx,
            y:world.cy+world.scene.convoyStart.dy},...world.route];
        ctx.save();ctx.strokeStyle='#71fbdf59';ctx.lineWidth=14;
        ctx.shadowColor='#6beedf';ctx.shadowBlur=26;
        ctx.setLineDash([32,30]);ctx.lineDashOffset=-time*23;
        ctx.beginPath();points.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));
        ctx.stroke();ctx.setLineDash([]);ctx.restore();
        for(let i=0;i<world.route.length;i++){
            const p=world.route[i];if(!near(game,p.x,p.y,850))continue;
            ring(ctx,p.x,p.y,205,'#86ffe4',-time*11,.23);
        }
    }else{
        ring(ctx,cx+140,cy,660,scene.tint,-time*1.8,.19);
        ring(ctx,cx+140,cy,740,'#ef7aaf',time*1.3,.11);
    }
    for(const mark of scene.landmarks||[]){
        if(world.index===1)drawFirstMissionLandmark(ctx,game,world,mark,time);
        else drawRegionLandmark(ctx,game,world,mark,time);
    }
    for(const p of world.platforms){
        if(!near(game,p.x,p.y,1050))continue;
        if(world.index===1)distantScaffold(ctx,p,time,scene.tint);
        else drawSectorPlatform(ctx,p,time,scene.tint,world.index);
    }
    // Scattered beacons in perspective; sprite atlas can be replaced without
    // rebuilding gameplay collision layouts.
    if(world.index===1){
        // Dim navigation arcs and diffuse wreckage, not a second set of
        // brown rocks that looks clickable.
        for(const [dx,dy,r] of [[-1020,-570,280],[1250,-540,360],
            [2120,610,400],[3350,-510,310]]){
            if(!near(game,cx+dx,cy+dy,r+300))continue;
            ring(ctx,cx+dx,cy+dy,r,'#6c8fbf',-time*.7,.09);
        }
    }
    ctx.restore();
}
export function drawMissionForeground(ctx,game,world) {
    const {scene,index}=world;
    const t=game.gameTime||0;
    ctx.save();
    // Working stations connect into a visible grid; the hostile jammer
    // interrupts the rays until disabled.
    if(index===3){
        const online=world.jammerOffline;
        const bases=game.friendlyBases.bases;
        // A connected tree remains legible on a huge map. Segment-distance
        // culling keeps lines visible at either endpoint, unlike midpoint culling.
        for(const [i,j] of [[0,1],[0,2],[1,3],[2,3]]){
            const a=bases[i],b=bases[j];if(!a||!b)continue;
            const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
            const fraction=Math.max(0,Math.min(1,
                ((game.player.x-a.x)*dx+(game.player.y-a.y)*dy)/l2));
            const distance=Math.hypot(game.player.x-a.x-dx*fraction,
                game.player.y-a.y-dy*fraction);
            if(distance>920)continue;
            const linked=a.activated&&b.activated&&a.hp>0&&b.hp>0&&world.jammerOffline;
            ctx.save();ctx.strokeStyle=linked?'#63fce2aa':'#d2619a46';
            ctx.lineWidth=linked?7:2;
            if(linked){ctx.shadowColor='#73fff0';ctx.shadowBlur=18;}
            else ctx.setLineDash([16,25]);
            ctx.lineDashOffset=-t*26;ctx.beginPath();ctx.moveTo(a.x,a.y);
            ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
            if(linked){
                ctx.save();ctx.fillStyle='#e5fff5';ctx.shadowColor='#63ffe9';
                ctx.shadowBlur=14;
                for(let k=0;k<3;k++){
                    const phase=(t*.16+k/3+i*.11+j*.07)%1;
                    const x=a.x+dx*phase,y=a.y+dy*phase;
                    ctx.beginPath();ctx.arc(x,y,3.5,0,TAU);ctx.fill();
                }
                ctx.restore();
            }
        }
    }
    // Mission 1: physical, readable links from the Gamma beacon to each
    // activated defense. The light is not decoration alone: working
    // turret nodes recharge the shared shield after bombardment.
    if(index===1 && world.first?.beacons===3){
        const gamma=world.props.find(p=>p.id==='beacon-3');
        const bases=game.friendlyBases.bases.slice(1);
        if(gamma)for(const base of bases){
            const live=base.activated&&base.hp>0&&
                base.turrets.some(turret=>(turret.integrity??100)>0&&!turret.disabled);
            if(!near(game,(base.x+gamma.x)/2,(base.y+gamma.y)/2,1300))continue;
            ctx.save();
            ctx.globalAlpha=live?.82:.27;
            ctx.strokeStyle=live?'#69eccc':'#d59c78';
            ctx.lineWidth=live?5:2;
            if(live){ctx.shadowColor='#68fff0';ctx.shadowBlur=15;}
            else ctx.setLineDash([12,18]);
            ctx.beginPath();ctx.moveTo(gamma.x,gamma.y);
            ctx.lineTo(base.x,base.y);ctx.stroke();
            if(live){
                const phase=(t*.18+bases.indexOf(base)*.25)%1;
                const px=gamma.x+(base.x-gamma.x)*phase;
                const py=gamma.y+(base.y-gamma.y)*phase;
                ctx.fillStyle='#f0fff7';ctx.beginPath();
                ctx.arc(px,py,4,0,TAU);ctx.fill();
            }
            ctx.restore();
        }
        if(near(game,gamma.x,gamma.y,850)){
            const integrity=Math.max(0,world.first.coreHp/world.first.maxCoreHp);
            ring(ctx,gamma.x,gamma.y,163,'#5effe4',-t*12,.12+.5*integrity);
        }
    }
    // These highlighted physical obstacles are intentionally different
    // from ordinary meteorites: amber ore seals and unstable reactor cores.
    for(const rock of game.worldObstacles||[]){
        if(rock.destroyed || (!rock.missionSeal && !rock.missionVolatile && !rock.missionRoadblock) ||
            !near(game,rock.x,rock.y,760))continue;
        const rr=rock.radius||26;
        if(rock.missionRoadblock){
            glow(ctx,rock.x,rock.y,rr*3.4,'#9e62e6');
            ring(ctx,rock.x,rock.y,rr+12,'#d7aaff',-t*18,.86);
            if(centerDistance(rock,game.player)<370){
                ctx.save();ctx.textAlign='center';ctx.font='700 11px system-ui,sans-serif';
                ctx.shadowColor='#1e0939';ctx.shadowBlur=9;ctx.fillStyle='#f5ceff';
                ctx.fillText('⚠ ЗАВАЛ · РАЗРУШИТЬ',rock.x,rock.y-rr-26);ctx.restore();
            }
        }else if(rock.missionSeal){
            glow(ctx,rock.x,rock.y,rr*2.4,'#d78c38');
            ring(ctx,rock.x,rock.y,rr+9,'#ffd28b',-t*11,.66);
            ctx.save();ctx.strokeStyle='#ffcc78';ctx.lineWidth=2;ctx.shadowColor='#ffba65';ctx.shadowBlur=12;
            for(let v=0;v<3;v++){
                const a=v*TAU/3+t*.03;
                ctx.beginPath();ctx.moveTo(rock.x+Math.cos(a)*rr*.22,
                    rock.y+Math.sin(a)*rr*.22);
                ctx.lineTo(rock.x+Math.cos(a+.26)*rr*.95,
                    rock.y+Math.sin(a+.26)*rr*.95);ctx.stroke();
            }
            ctx.restore();
        }else{
            glow(ctx,rock.x,rock.y,rr*3.2,'#ff7048');
            drawStationPart(ctx,STATION_PARTS.arc,rock.x,rock.y,rr*3.1,
                t*.22,.75);
            ring(ctx,rock.x,rock.y,rr+15,'#ff8e67',-t*25,.8);
            const flicker=.55+.35*Math.sin(t*5+rock.x*.1);
            ctx.save();ctx.globalAlpha=flicker;ctx.fillStyle='#ffe9a9';
            ctx.beginPath();ctx.arc(rock.x,rock.y,5,0,TAU);ctx.fill();ctx.restore();
            if(Math.hypot(game.player.x-rock.x,game.player.y-rock.y)<400){
                ctx.save();ctx.textAlign='center';ctx.font='700 10px system-ui,sans-serif';
                ctx.fillStyle='#ffdeaf';ctx.shadowColor='#2b1010';ctx.shadowBlur=8;
                ctx.fillText('⚠ НЕСТАБИЛЬНЫЙ РЕАКТОР',rock.x,rock.y-rr-27);
                ctx.restore();
            }
        }
    }
    if(index===2 && world.quarry?.shots){
        for(const shot of world.quarry.shots){
            if(!near(game,shot.x,shot.y,480))continue;
            const fraction=Math.max(0,Math.min(1,shot.ttl/shot.total));
            glow(ctx,shot.x,shot.y,shot.radius*1.5,'#e66d3c');
            ring(ctx,shot.x,shot.y,shot.radius,'#ffa45e',-t*80,.65);
            ctx.save();ctx.strokeStyle='#ffb46b';ctx.lineWidth=5;
            ctx.beginPath();ctx.arc(shot.x,shot.y,shot.radius*.45,
                -Math.PI/2,-Math.PI/2+TAU*(1-fraction));ctx.stroke();ctx.restore();
        }
    }
    if(index===4)convoyArt(ctx,game,world,t);
    if(world.enemySite && near(game,world.enemySite.x,world.enemySite.y,1160))
        hostileStation(ctx,world.enemySite,game,t);
    for(const p of world.props){
        if(!near(game,p.x,p.y,760))continue;
        const online=p.type==='route-choice'?
            world.quarry?.routeChoice===p.route:
            p.type==='beacon'||p.type==='rig'||p.type==='decoy'?p.used:
            p.type==='jammer'?world.jammerOffline:
            p.type==='gate'?world.exitOnline:p.type==='cache'?false:!p.used;
        const locked=p.type==='jammer'&&(world.enemySiteAlive(game)||
                !world.allBasesActive(game)||(index===3&&!world.network?.decoyCleared))||
            p.type==='gate'&&(index===2?
                !(world.quarry?.overload&&world.bossStarted&&world.boss&&
                    !game.enemies.includes(world.boss)&&world.allBasesActive(game)):
                world.convoy?.leg!==3||!world.trap?.cleared||
                !game.friendlyBases.bases.slice(1).every(b=>b.activated&&b.hp>0))||
            p.type==='rig'&&!game.friendlyBases.bases[1]?.activated||
            p.type==='route-choice'&&(!world.quarry?.started||
                !world.quarry?.forkReached||
                world.quarry?.routeChoice&&world.quarry.routeChoice!==p.route)||
            p.type==='decoy'&&!world.allBasesActive(game)||
            p.type==='beacon'&&index===1&&!world.beaconUnlocked(game,p);
        const status=p.type==='rig'&&world.quarry?.started?
            (world.quarry.completed?'ДОБЫЧА ЗАВЕРШЕНА':'КОРПУС '+Math.ceil(p.hp/p.maxHp*100)+'%'):
            p.type==='route-choice'?(world.quarry?.routeChoice===p.route?
                'ВЫБРАН · КРОТ В ПУТИ':world.quarry?.routeChoice?
                'МАРШРУТ ОТКЛОНЁН':!world.quarry?.forkReached?
                'ДОЖДИТЕСЬ БУРОВОЙ':
                p.route==='direct'?'БЫСТРО · ЗАСАДА':'МЕДЛЕННЕЕ · РЕМОНТ'):
            p.type==='decoy'&&p.used?'СИГНАЛ РАСКРЫТ':null;
        machine(ctx,p,t,scene.tint,online,locked,status);
    }
    // Small directional hash marks around priority machinery.
    const target=world.target(game);
    if(target && near(game,target.x,target.y,1050)){
        ring(ctx,target.x,target.y,120,scene.secondary,-t*34,.6);
    }
    ctx.restore();
}
