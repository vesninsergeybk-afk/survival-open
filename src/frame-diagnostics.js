/** Opt-in, bounded local timings. No telemetry or network requests. */
export class FrameDiagnostics {
    constructor(enabled=false){this.enabled=enabled;this.values=new Map();this.frames=[];this.last=0;}
    measure(name,fn){
        if(!this.enabled)return fn();
        const start=performance.now();try{return fn();}finally{
            let v=this.values.get(name);if(!v)this.values.set(name,v={sum:0,max:0,n:0});
            const ms=performance.now()-start;v.sum+=ms;v.max=Math.max(v.max,ms);v.n++;
        }
    }
    frame(ms,game){
        if(!this.enabled)return;
        this.frames.push(ms);if(this.frames.length>180)this.frames.shift();
        const now=performance.now();if(now-this.last<1000)return;this.last=now;
        if(!this.panel){
            this.panel=document.createElement('pre');this.panel.id='survivorFrameProfile';
            this.panel.style.cssText='position:fixed;left:8px;bottom:8px;z-index:99;pointer-events:none;white-space:pre-wrap;background:#03101fe8;color:#b6ffe3;padding:8px;font:11px monospace;max-width:95vw';
            document.body.append(this.panel);
        }
        const sorted=[...this.frames].sort((a,b)=>a-b),mean=this.frames.reduce((a,b)=>a+b,0)/this.frames.length;
        const lines=['design-127 | '+(1000/mean).toFixed(1)+' FPS | p95 '+sorted[Math.floor((sorted.length-1)*.95)].toFixed(1)+' ms',
            'Canvas '+game.canvas.width+'×'+game.canvas.height+' | robots '+game.enemies.length+' | quality '+game._renderPlan?.level];
        const roomCache=game.missionWorld?.roomCacheStats;
        if(roomCache){
            const previous=this.lastRoomCache||{paints:0,evictions:0};
            lines.push('Room cache '+(game.missionWorld.roomLayers?.size||0)+
                ' | paints/s '+Math.max(0,roomCache.paints-previous.paints)+
                ' | evictions/s '+Math.max(0,roomCache.evictions-previous.evictions));
            this.lastRoomCache={paints:roomCache.paints,evictions:roomCache.evictions};
        }else this.lastRoomCache=null;
        for(const [name,v] of this.values)lines.push(name+': '+(v.sum/v.n).toFixed(2)+' ms avg / '+v.max.toFixed(1)+' max');
        this.panel.textContent=lines.join('\n');this.values.clear();
    }
}
