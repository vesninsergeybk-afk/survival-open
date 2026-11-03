/**
 * Lightweight diegetic cues for actual enemy awareness and radio events.
 * The AI owns contact memory and message recipients; this module only draws.
 * No new sprites, timers, searches, or off-screen effects are allocated.
 */
const CONTACT_FLASH=.95;
const RADIO_FLASH=1.05;
const LINK_LIFETIME=.58;
const MAX_BADGES=8;
const MAX_LINKS=2;
const TAU=Math.PI*2;

function inside(x,y,camera,width,height,pad=55){
    return x>=camera.worldX-pad&&x<=camera.worldX+width+pad&&
        y>=camera.worldY-pad&&y<=camera.worldY+height+pad;
}

export function combatSignalState(enemy,now){
    if(!enemy||enemy.hp<=0||enemy.boss)return null;
    const station=enemy.prologueAI;
    if(station?.group==='siege')return null; // Siege robots attack the core.
    const memory=station||enemy._signalVisual;
    if(!memory)return null;
    const directUntil=memory.directUntil||0;
    const contactAt=memory.contactAt??-100;
    if(directUntil>now&&now-contactAt<CONTACT_FLASH)
        return {kind:'contact',priority:4,radio:false};
    if(directUntil>now)return null; // Already fighting: no permanent icon.
    const searchUntil=station?
        Math.max(memory.known?.until||0,memory.alertUntil||0):
        memory.searchUntil||0;
    if(searchUntil<=now)return null;
    const radio=now-(memory.radioAt??-100)<RADIO_FLASH;
    return {kind:'search',priority:radio?3:1,radio,
        opacity:Math.max(.5,Math.min(1,(searchUntil-now)/1.2))};
}

function drawEye(ctx){
    ctx.lineWidth=1.65;
    ctx.beginPath();
    ctx.moveTo(-6.8,0);
    ctx.quadraticCurveTo(0,-6.1,6.8,0);
    ctx.quadraticCurveTo(0,6.1,-6.8,0);
    ctx.stroke();
    ctx.beginPath();ctx.arc(0,0,2.45,0,TAU);ctx.fill();
}
function drawRadio(ctx){
    ctx.lineWidth=1.25;
    ctx.beginPath();
    ctx.arc(4.2,-5.5,3.4,-1.25,-.08);
    ctx.moveTo(4.2+5.5*Math.cos(-1.25),-5.5+5.5*Math.sin(-1.25));
    ctx.arc(4.2,-5.5,5.5,-1.25,-.08);
    ctx.stroke();
}
function drawBadge(ctx,x,y,state,time,reduced){
    const contact=state.kind==='contact';
    const alpha=contact?Math.min(1,Math.max(0,(CONTACT_FLASH-
        (time-(state.contactAt??time)))/.24)):state.opacity??1;
    ctx.save();
    ctx.translate(x,y);
    ctx.globalAlpha=alpha;
    const color=contact?'#ff927e':'#ffd078';
    ctx.fillStyle='rgba(5,20,29,.88)';
    ctx.strokeStyle=color;
    ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(0,0,10.7,0,TAU);ctx.fill();ctx.stroke();
    ctx.fillStyle=color;
    if(contact){
        ctx.font='800 15px system-ui,sans-serif';
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('!',0,1);
    }else{
        drawEye(ctx);
        if(state.radio){
            ctx.strokeStyle='#80e8ff';
            drawRadio(ctx);
        }
    }
    if(!reduced&&contact){
        const flash=Math.max(0,1-(time-state.contactAt)/CONTACT_FLASH);
        ctx.globalAlpha=flash*.3;
        ctx.strokeStyle=color;
        ctx.beginPath();ctx.arc(0,0,11+(1-flash)*6,0,TAU);ctx.stroke();
    }
    ctx.restore();
}
function drawLinks(ctx,m,time,camera,width,height,reduced,max){
    if(!Array.isArray(m.links)||!m.links.length)return 0;
    const age=time-m.time;
    if(age<0||age>LINK_LIFETIME)return 0;
    const alpha=Math.max(0,1-age/LINK_LIFETIME);
    const sx=m.x,sy=m.y;
    if(!Number.isFinite(sx)||!Number.isFinite(sy))return 0;
    let drawn=0;
    for(const peer of m.links){
        if(drawn>=max)break;
        const ex=peer.x,ey=peer.y;
        if(!Number.isFinite(ex)||!Number.isFinite(ey))continue;
        if(!inside(sx,sy,camera,width,height,80)&&
           !inside(ex,ey,camera,width,height,80))continue;
        const dx=ex-sx,dy=ey-sy,d=Math.hypot(dx,dy);
        if(d<12||d>740)continue;
        const bend=Math.min(20,d*.07),mx=(sx+ex)/2-dy/d*bend;
        const my=(sy+ey)/2+dx/d*bend;
        ctx.save();ctx.globalAlpha=alpha*.69;
        ctx.strokeStyle='#7bdcf2';ctx.lineWidth=1.35;
        ctx.setLineDash([4.5,6]);
        if(!reduced)ctx.lineDashOffset=-(age*58);
        ctx.beginPath();ctx.moveTo(sx,sy);
        ctx.quadraticCurveTo(mx,my,ex,ey);ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle='#baf8ff';
        ctx.beginPath();ctx.arc(ex,ey,2.9,0,TAU);ctx.fill();
        ctx.restore();
        drawn++;
    }
    if(drawn&&inside(sx,sy,camera,width,height,40)){
        ctx.save();ctx.strokeStyle='#76dff4';
        ctx.globalAlpha=alpha*.52;ctx.lineWidth=1.5;
        ctx.beginPath();ctx.arc(sx,sy,13+(reduced?0:age*30),0,TAU);ctx.stroke();
        ctx.restore();
    }
    return drawn;
}

export function renderCombatSignals(ctx,game,width=1200,height=800){
    const time=game.gameTime||0;
    const camera=game.camera;
    if(!camera)return;
    const reduced=!!game.save?.settings?.reducedMotion;
    // Render only real messages with actual recipient coordinates, at most
    // two connections total. No simulated or permanently glowing network.
    const messages=game.enemyIntelligence?.messages||[];
    let links=0;
    for(let i=messages.length-1;i>=0&&links<MAX_LINKS;i--){
        const m=messages[i];
        if(time-m.time>LINK_LIFETIME)break;
        links+=drawLinks(ctx,m,time,camera,width,height,reduced,MAX_LINKS-links);
    }

    const choices=[];
    const px=game.player?.x||0,py=game.player?.y||0;
    for(const enemy of game.enemies||[]){
        if(!inside(enemy.x,enemy.y,camera,width,height))continue;
        const state=combatSignalState(enemy,time);
        if(!state)continue;
        state.contactAt=(enemy.prologueAI||enemy._signalVisual)?.contactAt??-100;
        choices.push({enemy,state,distance:Math.hypot(enemy.x-px,enemy.y-py)});
    }
    if(!choices.length)return;
    choices.sort((a,b)=>b.state.priority-a.state.priority||a.distance-b.distance);
    for(const {enemy,state} of choices.slice(0,MAX_BADGES)){
        const robot=!!enemy.prologueAI;
        const y=enemy.y-(robot?61:(enemy.size||18)+26);
        drawBadge(ctx,enemy.x,y,state,time,reduced);
    }
}
