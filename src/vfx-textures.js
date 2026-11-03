/**
 * Kenney Particle Pack 1.1 (CC0) — locally bundled, no CDN or extra RAF.
 * Source: https://github.com/Calinou/kenney-particle-pack
 * Every texture below is used by WorldVFX. 128px tinted caches prevent
 * full-resolution image filters during a busy combat frame.
 */
export const FX_FILES = Object.freeze({
    glow:'circle_05', flame:'flame_04', flare:'flare_01',
    burst:'magic_03', scorch:'scorch_01', smoke:'smoke_05',
    lightning:'spark_04', star:'star_07', muzzle:'muzzle_02',
    slash:'slash_02'
});
export const FX_COLORS = Object.freeze({
    cyan:'#74eaff', orange:'#ffad65', red:'#ff557b',
    violet:'#b995ff', gold:'#ffe2a3', smoke:'#8292ad',
    blue:'#4c9dff', green:'#91ffbb', white:'#ffffff'
});
const loaded = new Map();
const tinted = new Map();
const SIZE = 128;

if (typeof Image !== 'undefined') {
    for (const [key, name] of Object.entries(FX_FILES)) {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
            if (img.naturalWidth) loaded.set(key, img);
        };
        img.onerror = () => { /* vector fallback stays playable */ };
        img.src = new URL('../assets/fx/' + name + '.png', import.meta.url).href;
    }
}

// Kenney's grayscale particle sheets here have a fully opaque, flat gray
// preview backing. Treat brightness above that backing as opacity. This mask
// is prepared once per cached sprite, never in the per-frame render loop.
export function particleMaskAlpha(luma,background,kind='glow') {
    const light=Math.max(0,luma-background-3);
    const shadow=kind==='scorch'?Math.max(0,background-luma-5)*.25:0;
    const contrast=Math.max(light,shadow);
    const scale=255/Math.max(18,255-background);
    return Math.max(0,Math.min(255,Math.round(contrast*scale*1.65)));
}
const luminance=(r,g,b)=>r*.2126+g*.7152+b*.0722;
const rgbTint=(tint)=>{
    const color=FX_COLORS[tint]||FX_COLORS.white;
    return [parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)];
};
export function getFXSprite(kind, tint='white') {
    const source = loaded.get(kind);
    if (!source) return null;
    const key = kind + ':' + tint;
    if (tinted.has(key)) return tinted.get(key);
    if (typeof document === 'undefined') return source;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    if (!ctx) return source;
    ctx.drawImage(source,0,0,SIZE,SIZE);
    try {
        const frame=ctx.getImageData(0,0,SIZE,SIZE),a=frame.data;
        const corners=[0,(SIZE-1)*4,(SIZE*(SIZE-1))*4,(SIZE*SIZE-1)*4];
        const back=corners.map(i=>luminance(a[i],a[i+1],a[i+2]));
        const baseline=back.reduce((x,y)=>x+y,0)/4;
        const opaque=corners.every(i=>a[i+3]>246);
        const uniform=Math.max(...back)-Math.min(...back)<8;
        const grayscale=corners.every(i=>Math.max(a[i],a[i+1],a[i+2])-Math.min(a[i],a[i+1],a[i+2])<12);
        if(opaque&&uniform&&grayscale){
            const [r,g,b]=rgbTint(tint);
            for(let i=0;i<a.length;i+=4){
                const lum=luminance(a[i],a[i+1],a[i+2]);
                a[i+3]=Math.round(particleMaskAlpha(lum,baseline,kind)*a[i+3]/255);
                a[i]=r;a[i+1]=g;a[i+2]=b;
            }
            ctx.putImageData(frame,0,0);
        }else if(tint!=='white'){
            ctx.globalCompositeOperation='source-in';
            ctx.fillStyle=FX_COLORS[tint]||FX_COLORS.white;
            ctx.fillRect(0,0,SIZE,SIZE);
        }
    }catch{
        // A browser that forbids pixel reads still gets the original sprite.
        if(tint!=='white'){
            ctx.globalCompositeOperation='source-in';
            ctx.fillStyle=FX_COLORS[tint]||FX_COLORS.white;
            ctx.fillRect(0,0,SIZE,SIZE);
        }
    }
    tinted.set(key,canvas);
    return canvas;
}

export function getFXLoadStatus() {
    return { ready: loaded.size, total: Object.keys(FX_FILES).length };
}
