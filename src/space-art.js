/**
 * Космические арены «Выжившего». Все эффекты декоративные, не используют
 * генератор случайных чисел боя и не влияют на сохранения или попадания.
 * Фотографии туманностей и спрайты кораблей — CC0; см. SPACE-ASSETS.md.
 */
import { atlas } from './asset-art.js?v=space-1';

const PALETTES = {
    forest: { base: '#07071b', haze: '#7737c8', secondary: '#253b9d', star: '#d9c8ff' },
    crypt: { base: '#03131e', haze: '#126f9c', secondary: '#12a69d', star: '#b5faff' },
    tundra: { base: '#170b13', haze: '#cc5529', secondary: '#824b9c', star: '#ffe6c7' }
};
// Authored campaign identity: each sector must remain recognisable even
// if only its deep-space photographic background is visible.
const MISSION_PALETTES = {
    0: {base:'#100b19',haze:'#d36e2f',secondary:'#95603c',star:'#fff0d4'},
    1: {base:'#061320',haze:'#246ab2',secondary:'#168d9a',star:'#cceffe'},
    2: {base:'#1b0d13',haze:'#b14c2d',secondary:'#79536b',star:'#ffd7aa'},
    3: {base:'#100d29',haze:'#6c3bba',secondary:'#b14689',star:'#e0d7ff'},
    4: {base:'#041a25',haze:'#207fa0',secondary:'#784bba',star:'#c1fff4'}
};
const TWO_PI = Math.PI * 2;
function mod(n, m) { return ((n % m) + m) % m; }
function hash(i) {
    let n = Math.imul(i + 17, 0x45d9f3b) >>> 0;
    n ^= n >>> 16;
    n = Math.imul(n, 0x45d9f3b) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function cover(ctx, img, w, h) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const ratio = Math.max(w / iw, h / ih);
    const dw = iw * ratio, dh = ih * ratio;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}
function planet(ctx, x, y, radius, color) {
    const g = ctx.createRadialGradient(x-radius*.38,y-radius*.42,4,x,y,radius);
    g.addColorStop(0,'rgba(192,227,255,.27)');
    g.addColorStop(.28,color);
    g.addColorStop(.78,'rgba(16,20,54,.55)');
    g.addColorStop(1,'rgba(3,5,18,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,radius,0,TWO_PI);ctx.fill();
    ctx.strokeStyle='rgba(166,198,255,.17)';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(x,y,radius*.86,-1.45,1.27);ctx.stroke();
}
export class SpaceArt {
    constructor() {
        this.stars = Array.from({length: 170}, (_, i) => ({
            x: hash(i*3+5), y: hash(i*3+7),
            size: i % 13 === 0 ? 2.3 : i % 3 === 0 ? 1.35 : .75,
            depth: .035 + (i % 5) * .035,
            phase: hash(i*11+19) * TWO_PI
        }));
    }
    draw(ctx, stage, cameraX, cameraY, w, h, missionIndex=null, quality=1) {
        const p=MISSION_PALETTES[missionIndex] || PALETTES[stage] || PALETTES.forest;
        // Photograph, colour grade, bloom and planet do not change between
        // frames. Bake them once per viewport and sector; only stars parallax.
        const key=[stage,missionIndex,w,h,atlas.nebula?.naturalWidth||0].join('|');
        if(this._backdrop?.key!==key){
            const layer=document.createElement('canvas');
            layer.width=Math.max(1,Math.round(w));
            layer.height=Math.max(1,Math.round(h));
            const backdropCtx=layer.getContext('2d',{alpha:false});
            if(backdropCtx){
                backdropCtx.fillStyle=p.base;backdropCtx.fillRect(0,0,w,h);
                // Real CC0 astronomical photography stays behind a soft colour grade.
                if (atlas.nebula) {
                    backdropCtx.save();
                    backdropCtx.globalAlpha=.9;
                    cover(backdropCtx,atlas.nebula,w,h);
                    backdropCtx.restore();
                }
                const veil=backdropCtx.createLinearGradient(0,0,w,h);
                // Lighter grade exposes the photographed nebula but preserves
                // dark room for readable shots, indicators and mission objectives.
                veil.addColorStop(0,p.base+'c0');
                veil.addColorStop(.45,p.base+'68');
                veil.addColorStop(1,p.base+'b8');
                backdropCtx.fillStyle=veil;backdropCtx.fillRect(0,0,w,h);
                const bloom=backdropCtx.createRadialGradient(w*.7,h*.27,0,w*.7,h*.27,w*.6);
                bloom.addColorStop(0,p.haze+'63');
                bloom.addColorStop(.46,p.secondary+'32');
                bloom.addColorStop(1,p.base+'00');
                backdropCtx.fillStyle=bloom;backdropCtx.fillRect(0,0,w,h);
                // The prologue's nearby sun belongs to the physical window.
                // A second disk on the screen-space backdrop duplicated it.
                if(missionIndex===1)planet(backdropCtx,w*.10,h*.05,95,'rgba(48,162,202,.24)');
                else if(missionIndex===2)planet(backdropCtx,w*.88,h*.08,132,'rgba(232,114,61,.34)');
                else if(missionIndex===3)planet(backdropCtx,w*.15,h*.04,118,'rgba(151,91,208,.24)');
                else if(missionIndex===4)planet(backdropCtx,w*.87,h*.09,148,'rgba(61,180,194,.26)');
                else if(stage==='tundra')planet(backdropCtx,w*.88,h*.06,125,'rgba(232,114,61,.37)');
                else if(stage==='crypt')planet(backdropCtx,w*.13,h*.07,95,'rgba(33,155,181,.33)');
                this._backdrop={key,layer};
            }
        }
        ctx.save();
        ctx.translate(cameraX,cameraY);
        if(this._backdrop)ctx.drawImage(this._backdrop.layer,0,0,w,h);
        else {ctx.fillStyle=p.base;ctx.fillRect(0,0,w,h);}
        // Multi-depth star field. Coordinates depend only on camera position.
        // Low-FPS mode keeps the deep-space photograph while drawing fewer
        // individual parallax dots; the subset is stable, so no flickering.
        const stride=quality<.5?3:quality<.75?2:1;
        for(let i=0;i<this.stars.length;i+=stride){
            const s=this.stars[i];
            const sx=mod(s.x*w-cameraX*s.depth,w);
            const sy=mod(s.y*h-cameraY*s.depth,h);
            ctx.globalAlpha=.48+s.depth*2;
            ctx.fillStyle=p.star;
            ctx.beginPath();ctx.arc(sx,sy,s.size,0,TWO_PI);ctx.fill();
            if(s.size>2){
                ctx.strokeStyle=p.star;ctx.lineWidth=.6;
                ctx.beginPath();ctx.moveTo(sx-6,sy);ctx.lineTo(sx+6,sy);
                ctx.moveTo(sx,sy-6);ctx.lineTo(sx,sy+6);ctx.stroke();
            }
        }
        ctx.globalAlpha=1;
        ctx.restore();
    }

    drawAtmosphere(ctx, stage, cameraX, cameraY, w, h, seconds=0, missionIndex=null, quality=1) {
        const p=MISSION_PALETTES[missionIndex] || PALETTES[stage] || PALETTES.forest;
        ctx.save();ctx.translate(cameraX,cameraY);
        // Wisps, pulsating ion dust and gentle light shafts.
        // Radial gradients and ellipse fills are costly in software Canvas2D.
        // Retain the full atmosphere on fast machines, degrade gracefully
        // when the shared frame budget signals sustained slowness.
        const cloudCount=quality<.5?2:quality<.75?4:7;
        for(let i=0;i<cloudCount;i++){
            const a=hash(i*13+4)*TWO_PI;
            const cx=mod(hash(i*9+10)*w-cameraX*(.018+i*.004)+Math.sin(seconds*.11+i)*19,w);
            const cy=mod(hash(i*7+6)*h-cameraY*(.015+i*.003)+Math.cos(seconds*.09+i)*17,h);
            const r=66+hash(i*17+21)*130;
            const gr=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
            gr.addColorStop(0,p.haze+'1f');
            gr.addColorStop(.6,p.secondary+'0c');
            gr.addColorStop(1,p.base+'00');
            ctx.fillStyle=gr;
            ctx.beginPath();ctx.ellipse(cx,cy,r,r*.52,a,0,TWO_PI);ctx.fill();
        }
        // Sparse moving particles distinguish the near parallax plane.
        ctx.fillStyle=p.star;
        const moteCount=quality<.5?6:quality<.75?12:20;
        for(let i=0;i<moteCount;i++){
            const px=mod(hash(i*5+82)*w-cameraX*.19+seconds*(2+i%4),w);
            const py=mod(hash(i*5+87)*h-cameraY*.19+seconds*(1+i%3),h);
            ctx.globalAlpha=.22+hash(i*19+3)*.35;
            ctx.fillRect(px,py,1.4,1.4);
        }
        ctx.globalAlpha=1;ctx.restore();
    }
}

