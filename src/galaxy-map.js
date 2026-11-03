/**
 * Paused galactic chart. All markers are derived from existing run state:
 * no unseen stations or hypothetical enemies are revealed.
 */
import { CONFIG } from './config.js?v=base-87';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const escapeHtml=value=>String(value).replace(/[&<>"]/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'
}[c]));

/** Keep the map's drawing buffer proportional to its actual, possibly short viewport. */
export function planMapCanvas(width, height, devicePixelRatio = 1) {
    const cssWidth = Math.max(1, Math.round(Number(width) || 1));
    const cssHeight = Math.max(1, Math.round(Number(height) || 1));
    const pixelRatio = Math.min(1.5, Math.max(1, Number(devicePixelRatio) || 1));
    return {
        cssWidth, cssHeight, pixelRatio,
        backingWidth: Math.round(cssWidth * pixelRatio),
        backingHeight: Math.round(cssHeight * pixelRatio)
    };
}

export class GalaxyMap {
    constructor() {
        this.root=document.getElementById('galaxyMap');
        this.canvas=document.getElementById('galaxyMapCanvas');
        this.ctx=this.canvas?.getContext('2d')||null;
        this.list=document.getElementById('galaxyBaseList');
        this.status=document.getElementById('galaxyMapStatus');
        this.info=document.getElementById('galaxyMapInfo');
        this.zoom=1;
        this.centerX=CONFIG.ARENA_WIDTH/2;
        this.centerY=CONFIG.ARENA_HEIGHT/2;
        this.selectedId=null;
        this.game=null;
        this.onClose=()=>{};
        this.drag=null;
        this.animationTimer=null;
        this.mapSize=null;
        if (typeof ResizeObserver !== 'undefined' && this.canvas) {
            this.sizeObserver=new ResizeObserver(()=>{if(this.game)this.draw();});
            this.sizeObserver.observe(this.canvas);
        }
        if (typeof window !== 'undefined')
            window.addEventListener('resize',()=>{if(this.game)this.draw();});
        this.root?.querySelector('#btnMapClose')?.addEventListener('click',()=>this.onClose());
        this.root?.querySelector('#btnMapZoomIn')?.addEventListener('click',()=>this.changeZoom(1.45));
        this.root?.querySelector('#btnMapZoomOut')?.addEventListener('click',()=>this.changeZoom(1/1.45));
        this.root?.querySelector('#btnMapCenter')?.addEventListener('click',()=>{
            if(!this.game?.player)return;
            this.centerX=this.game.player.x;this.centerY=this.game.player.y;
            this.zoom=Math.max(this.zoom,2.5);this.draw();
        });
        this.root?.querySelector('#btnMapFull')?.addEventListener('click',()=>{
            this.zoom=1;this.centerX=CONFIG.ARENA_WIDTH/2;
            this.centerY=CONFIG.ARENA_HEIGHT/2;this.draw();
        });
        this.root?.querySelector('#btnMapRoute')?.addEventListener('click',()=>{
            const id=this.selectedId;
            if(!id||!this.game?.friendlyBases?.setNavigationTarget(id))return;
            this.renderList();this.draw();
            this.game._announce?.('Маршрут к новой станции проложен.');
        });
        this.list?.addEventListener('click',e=>{
            const button=e.target.closest?.('[data-base-id]');
            if(!button)return;
            this.focusOnBase(button.dataset.baseId);
        });
        this.canvas?.addEventListener('wheel',e=>{
            e.preventDefault();
            this.changeZoom(e.deltaY<0?1.2:1/1.2);
        },{passive:false});
        this.canvas?.addEventListener('pointerdown',e=>{
            this.canvas.setPointerCapture?.(e.pointerId);
            this.drag={x:e.clientX,y:e.clientY,
                cx:this.centerX,cy:this.centerY,moved:false};
        });
        this.canvas?.addEventListener('pointermove',e=>{
            if(!this.drag)return;
            const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;
            if(Math.hypot(dx,dy)>4)this.drag.moved=true;
            if(!this.drag.moved)return;
            const rect=this.canvas.getBoundingClientRect();
            const scale=this.transform().scale;
            const cssWidth=this.mapSize?.cssWidth||rect.width;
            const cssHeight=this.mapSize?.cssHeight||rect.height;
            this.centerX=this.drag.cx-dx*cssWidth/rect.width/scale;
            this.centerY=this.drag.cy-dy*cssHeight/rect.height/scale;
            this.draw();
        });
        this.canvas?.addEventListener('pointerup',e=>{
            const drag=this.drag;this.drag=null;
            if(!drag || drag.moved)return;
            const box=this.canvas.getBoundingClientRect();
            const x=(e.clientX-box.left)*(this.mapSize?.cssWidth||box.width)/box.width;
            const y=(e.clientY-box.top)*(this.mapSize?.cssHeight||box.height)/box.height;
            const transform=this.transform();
            const bases=this.visibleBases();
            let picked=null,best=20;
            for(const base of bases) {
                const d=Math.hypot(x-transform.x(base.x),y-transform.y(base.y));
                if(d<best){best=d;picked=base;}
            }
            if(picked)this.focusOnBase(picked.id);
        });
        this.canvas?.addEventListener('pointercancel',()=>{this.drag=null;});
    }

    open(game){
        if(!this.root||!this.ctx)return false;
        this.game=game;
        const prologue=game.missionWorld?.index===0;
        const title=this.root.querySelector('#galaxyMapTitle');
        if(title)title.textContent=prologue?'План станции «Гелиос»':'🗺️ Навигационная карта';
        const intro=this.root.querySelector('.galaxy-map-header p');
        if(intro)intro.textContent=prologue?
            'Исследованные отсеки и обнаруженные системы станции':
            'Открытые станции, положение корабля и обнаруженные крупные угрозы';
        // Start at the player's sector. A whole-world view made a nearby
        // expedition target a single invisible pixel on a phone.
        this.zoom=3.1;this.centerX=game.player.x;
        this.centerY=game.player.y;
        this.selectedId=game.friendlyBases?.expeditionTarget(game)?.id||null;
        this.root.style.display='flex';
        this.root.querySelector('#btnMapClose')?.focus();
        this.renderList();
        this.draw();
        // A fresh fullscreen/rotation layout can settle on the next frame.
        if(typeof requestAnimationFrame==='function')
            requestAnimationFrame(()=>{if(this.game===game)this.draw();});
        if(this.animationTimer)clearInterval(this.animationTimer);
        if(!game.save?.settings?.reducedMotion)
            this.animationTimer=setInterval(()=>this.draw(),65);
        return true;
    }
    close(){
        if(this.root)this.root.style.display='none';
        if(this.animationTimer)clearInterval(this.animationTimer);
        this.animationTimer=null;
        this.drag=null;this.game=null;
    }
    visibleBases(){
        return (this.game?.friendlyBases?.bases||[])
            .filter(b=>b.discovered);
    }
    threats(){
        if(!this.game?.player)return [];
        return (this.game.enemies||[])
            .filter(e=>e.hp>0&&(e.boss||
                (e.maxHp>=120&&distance(e,this.game.player)<1550)))
            .sort((a,b)=>(b.boss?1:0)-(a.boss?1:0))
            .slice(0,22);
    }
    focusOnBase(id){
        const base=this.visibleBases().find(b=>b.id===id);
        if(!base)return;
        this.selectedId=id;
        this.centerX=base.x;this.centerY=base.y;
        this.zoom=Math.max(2.6,this.zoom);
        this.draw();
        this.renderList();
    }
    changeZoom(factor){
        this.zoom=clamp(this.zoom*factor,1,6);
        this.draw();
    }
    resizeCanvas(){
        if(!this.canvas?.getBoundingClientRect)return;
        const rect=this.canvas.getBoundingClientRect();
        if(rect.width<1||rect.height<1)return;
        const size=planMapCanvas(rect.width,rect.height,
            typeof window==='undefined'?1:window.devicePixelRatio);
        this.mapSize=size;
        if(this.canvas.width!==size.backingWidth)this.canvas.width=size.backingWidth;
        if(this.canvas.height!==size.backingHeight)this.canvas.height=size.backingHeight;
    }
    transform(){
        const w=this.mapSize?.cssWidth||this.canvas.width;
        const h=this.mapSize?.cssHeight||this.canvas.height;
        const scale=Math.min((w-64)*this.zoom/CONFIG.ARENA_WIDTH,
            (h-56)*this.zoom/CONFIG.ARENA_HEIGHT);
        const halfW=w/(2*scale),halfH=h/(2*scale);
        this.centerX=clamp(this.centerX,
            Math.min(halfW,CONFIG.ARENA_WIDTH/2),
            Math.max(CONFIG.ARENA_WIDTH-halfW,CONFIG.ARENA_WIDTH/2));
        this.centerY=clamp(this.centerY,
            Math.min(halfH,CONFIG.ARENA_HEIGHT/2),
            Math.max(CONFIG.ARENA_HEIGHT-halfH,CONFIG.ARENA_HEIGHT/2));
        return {scale,
            x:worldX=>w/2+(worldX-this.centerX)*scale,
            y:worldY=>h/2+(worldY-this.centerY)*scale};
    }
    renderList(){
        if(!this.game || !this.list)return;
        const p=this.game.player;
        const bases=this.visibleBases().sort((a,b)=>distance(a,p)-distance(b,p));
        if(!bases.length){
            this.list.innerHTML='<p class="galaxy-empty">Откройте первую станцию, подлетев к ней в игре.</p>';
            return;
        }
        this.list.innerHTML=bases.map(base=>{
            const def=this.game.friendlyBases.typeInfo(base);
            const lost=base.hp<=0;
            const online=base.activated&&!lost;
            const tracked=base.id===this.game.friendlyBases.navigationTargetId;
            const state=lost?' · УТЕРЯНА':online?' · 🟢 РАБОТАЕТ':
                base.visited?' · ⚫ БЕЗ ПИТАНИЯ':' · 📡 СИГНАЛ';
            return '<button type="button" data-base-id="'+escapeHtml(base.id)+
                '" class="galaxy-base-item'+(this.selectedId===base.id?' selected':'')+
                (tracked?' tracked':'')+'"><span>'+def.icon+' '+escapeHtml(def.name)+
                state+(tracked?' · 🧭 ЦЕЛЬ':'')+'</span><small>'+
                Math.round(distance(base,p))+' ед. · '+Math.ceil(base.hp)+'/'+base.maxHp+
                ' HP'+(online&&this.game.friendlyBases.resonanceLinks().some(link=>
                    link.from.id===base.id||link.to.id===base.id)?' · 🔗 СОПРЯЖЕНА':'')+
                '</small></button>';
        }).join('');
        const route=this.root?.querySelector('#btnMapRoute');
        const selected=bases.find(b=>b.id===this.selectedId);
        if(route)route.disabled=!selected||selected.hp<=0||selected.activated;
    }
    draw(){
        if(!this.ctx||!this.game)return;
        this.resizeCanvas();
        const ctx=this.ctx;
        const w=this.mapSize?.cssWidth||this.canvas.width;
        const h=this.mapSize?.cssHeight||this.canvas.height;
        ctx.setTransform?.(this.canvas.width/w,0,0,this.canvas.height/h,0,0);
        const t=this.transform(),p=this.game.player;
        ctx.clearRect(0,0,w,h);
        const bg=ctx.createLinearGradient(0,0,w,h);
        bg.addColorStop(0,'#0b2541');bg.addColorStop(1,'#071020');
        ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
        // Stable procedurally placed stars, not a mutable gameplay RNG.
        for(let i=0;i<340;i++){
            const wx=((Math.sin(i*127.13)*43758.5453)%1+1)%1*CONFIG.ARENA_WIDTH;
            const wy=((Math.sin(i*67.29)*12467.1357)%1+1)%1*CONFIG.ARENA_HEIGHT;
            const x=t.x(wx),y=t.y(wy);
            if(x<0||x>w||y<0||y>h)continue;
            ctx.fillStyle=i%7===0?'#78c7fa99':'#ffffff66';
            ctx.fillRect(x,y,i%11===0?2:1,i%11===0?2:1);
        }
        ctx.strokeStyle='#6cbde822';ctx.lineWidth=1;
        for(let x=0;x<=CONFIG.ARENA_WIDTH;x+=2000){
            ctx.beginPath();ctx.moveTo(t.x(x),t.y(0));
            ctx.lineTo(t.x(x),t.y(CONFIG.ARENA_HEIGHT));ctx.stroke();
        }
        for(let y=0;y<=CONFIG.ARENA_HEIGHT;y+=2000){
            ctx.beginPath();ctx.moveTo(t.x(0),t.y(y));
            ctx.lineTo(t.x(CONFIG.ARENA_WIDTH),t.y(y));ctx.stroke();
        }
        ctx.strokeStyle='#53a6e999';ctx.lineWidth=2;
        ctx.strokeRect(t.x(0),t.y(0),
            CONFIG.ARENA_WIDTH*t.scale,CONFIG.ARENA_HEIGHT*t.scale);
        const bases=this.visibleBases();
        const destination=this.game.friendlyBases?.expeditionTarget(this.game);
        if(destination) {
            ctx.save();
            ctx.strokeStyle='#71ffe0cc';ctx.lineWidth=2.4;
            ctx.setLineDash([10,7]);
            ctx.beginPath();ctx.moveTo(t.x(p.x),t.y(p.y));
            ctx.lineTo(t.x(destination.x),t.y(destination.y));ctx.stroke();
            ctx.setLineDash([]);ctx.restore();
        }
        // The earlier local technology network stays faint; resonance is a
        // separate full-distance link, joining only equal station types.
        const online=bases.filter(base=>base.activated&&base.hp>0);
        ctx.save();ctx.strokeStyle='#57e1d133';ctx.lineWidth=1.2;
        ctx.setLineDash([5,8]);
        for(let i=0;i<online.length;i++){
            for(let j=i+1;j<online.length;j++){
                if(distance(online[i],online[j])>2900)continue;
                ctx.beginPath();ctx.moveTo(t.x(online[i].x),t.y(online[i].y));
                ctx.lineTo(t.x(online[j].x),t.y(online[j].y));ctx.stroke();
            }
        }
        ctx.restore();
        const shown=new Set(bases.map(base=>base.id));
        const links=(this.game.friendlyBases?.resonanceLinks()||[])
            .filter(link=>shown.has(link.from.id)&&shown.has(link.to.id));
        const animated=!this.game.save?.settings?.reducedMotion;
        const tick=animated?performance.now()/1000:0;
        for(const link of links){
            const x1=t.x(link.from.x),y1=t.y(link.from.y);
            const x2=t.x(link.to.x),y2=t.y(link.to.y);
            const color=this.game.friendlyBases.typeInfo(link.from).color;
            ctx.save();ctx.strokeStyle=color;ctx.shadowColor=color;
            ctx.shadowBlur=12;ctx.lineWidth=2.6;ctx.globalAlpha=.9;
            ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
            if(animated){
                const phase=((tick*.35)%1+1)%1;
                ctx.fillStyle='#eafffc';ctx.shadowBlur=20;
                ctx.beginPath();ctx.arc(x1+(x2-x1)*phase,
                    y1+(y2-y1)*phase,4.5,0,Math.PI*2);ctx.fill();
            }
            ctx.restore();
        }
        for(const base of bases){
            const x=t.x(base.x),y=t.y(base.y);
            if(x<-15||x>w+15||y<-15||y>h+15)continue;
            const def=this.game.friendlyBases.typeInfo(base);
            const selected=this.selectedId===base.id;
            const lost=base.hp<=0;
            const online=base.activated&&!lost;
            ctx.save();ctx.translate(x,y);
            ctx.strokeStyle=lost?'#ff7b80':online?def.color:'#8194a7';
            ctx.fillStyle=lost?'#502331':online?(selected?'#e0fbff':'#0b5660'):'#152535';
            ctx.lineWidth=selected?3.5:2;
            if(!online&&!base.visited)ctx.setLineDash([3,3]);
            ctx.shadowColor=online?def.color:'#546779';ctx.shadowBlur=online?(selected?20:12):2;
            ctx.beginPath();ctx.arc(0,0,selected?10:7,0,Math.PI*2);
            ctx.fill();ctx.stroke();
            if(online){
                ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.stroke();
                ctx.fillStyle='#9effd4';ctx.beginPath();ctx.arc(0,0,2.5,0,Math.PI*2);ctx.fill();
            }
            ctx.setLineDash([]);
            if(destination?.id===base.id) {
                ctx.strokeStyle='#b9ffe3';ctx.lineWidth=2;
                ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.stroke();
            }
            if(selected){ctx.beginPath();ctx.arc(0,0,21,0,Math.PI*2);ctx.stroke();}
            ctx.restore();
            if((this.zoom>=2.3||selected)&&!lost){
                ctx.fillStyle='#d9faff';ctx.font='11px system-ui';
                ctx.fillText(def.name,x+12,y-10);
            }
        }
        // Only discovered, unopened research capsules appear on the map;
        // their one-time rewards make a detour worthwhile.
        const signals=(this.game.worldCaches||[]).filter(c =>
            c.kind==='signal' && c.discovered && !c.opened);
        for (const cache of signals) {
            const x=t.x(cache.x),y=t.y(cache.y);
            if(x<0||x>w||y<0||y>h)continue;
            ctx.save();ctx.translate(x,y);
            ctx.fillStyle='#ffd37a';ctx.strokeStyle='#fff0bd';ctx.lineWidth=1.5;
            ctx.shadowColor='#ffc44a';ctx.shadowBlur=12;
            ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(8,0);
            ctx.lineTo(0,8);ctx.lineTo(-8,0);ctx.closePath();
            ctx.fill();ctx.stroke();ctx.restore();
            if(this.zoom>=2){
                ctx.fillStyle='#ffe5a5';ctx.font='11px system-ui';
                ctx.fillText('Данные',x+12,y-8);
            }
        }
        const threats=this.threats();
        for(const enemy of threats){
            const x=t.x(enemy.x),y=t.y(enemy.y);
            if(x<0||x>w||y<0||y>h)continue;
            const radius=enemy.boss?11:6;
            ctx.save();ctx.translate(x,y);
            ctx.fillStyle=enemy.boss?'#ff4c71':'#ffb266';
            ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=14;
            ctx.beginPath();ctx.moveTo(0,-radius);
            ctx.lineTo(radius,radius*.8);ctx.lineTo(-radius,radius*.8);
            ctx.closePath();ctx.fill();
            ctx.restore();
            if(enemy.boss){
                ctx.fillStyle='#ffd1de';ctx.font='bold 12px system-ui';
                ctx.fillText(enemy.type?.name||'БОСС',x+15,y-13);
            }
        }
        const px=t.x(p.x),py=t.y(p.y);
        ctx.save();ctx.translate(px,py);
        ctx.rotate((p.visualAngle||0));
        ctx.strokeStyle='#a6fdff';ctx.fillStyle='#4ff5fa';
        ctx.lineWidth=2;ctx.shadowColor='#37f3fb';ctx.shadowBlur=18;
        ctx.beginPath();ctx.moveTo(0,-13);
        ctx.lineTo(9,9);ctx.lineTo(0,5);ctx.lineTo(-9,9);
        ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
        ctx.textAlign='left';ctx.font='12px system-ui';ctx.fillStyle='#b9deec';
        ctx.fillText('МАСШТАБ ×'+this.zoom.toFixed(1),16,h-16);
        if(this.status)this.status.textContent=this.game.missionWorld?.index===0?
            'Сектор '+String(this.game.missionWorld.phase+1).padStart(2,'0')+
            ' · Обнаружено систем: '+bases.filter(b=>b.hp>0).length+
            ' · Запущено: '+bases.filter(b=>b.activated&&b.hp>0).length:
            'Обнаружено: '+bases.filter(b=>b.hp>0).length+
            ' · Активно: '+bases.filter(b=>b.activated&&b.hp>0).length+
            ' · Технологии: '+(this.game.friendlyBases?.technologyTier||0)+'/3'+
            ' · Сопряжений: '+links.length+
            ' · Капсул с данными: '+signals.length+
            ' · Крупных угроз: '+threats.length+
            ' · Координаты: '+Math.round(p.x)+', '+Math.round(p.y);
        if(this.info){
            const selected=bases.find(b=>b.id===this.selectedId);
            this.info.textContent=selected
                ?this.game.friendlyBases.typeInfo(selected).name+
                    ' · '+Math.round(distance(selected,p))+
                    ' ед. от вас · '+(selected.hp<=0?'утеряна':selected.activated?'реактор запущен':'без питания')+' · корпус '+Math.ceil(selected.hp)+'/'+selected.maxHp
                :'Выберите станцию и нажмите «Маршрут». Золотые ромбы — обнаруженные капсулы с данными: они дают опыт и ресурсы за исследование.';
        }
    }
}
