/**
 * CC0 Kenney fighters and original detailed capital hulls, cached for swarms.
 * Enemy IDs stay unchanged so replays, achievements and saves remain valid.
 */
import { atlas, onAtlasChange } from './asset-art.js?v=art-888';
import { drawEvolvedHero, heroStageFromProgress, heroMotionPose } from './hero-evolution.js?v=runtime-124';
export { heroStageFromProgress };
const CACHE = new Map();
// Lightweight WebP capital hulls; loaded only when the boss appears.
const BOSS_TYPES=Object.freeze({
    carrier:'carrier',necromancer:'carrier',chrono_lich:'carrier',
    hunter:'cruiser',reaper:'cruiser',ice_queen:'cruiser',
    void_lord:'dreadnought'
});
const capitalArt=Object.create(null);
const requestedCapitalArt=new Set();
function requestCapitalArt(enemyType) {
    const key=BOSS_TYPES[enemyType];
    if(!key||requestedCapitalArt.has(key)||typeof Image==='undefined')return;
    requestedCapitalArt.add(key);
    const img=new Image();img.decoding='async';
    img.onload=()=>{if(img.naturalWidth){capitalArt[key]=img;CACHE.clear();}};
    img.onerror=()=>{ /* Original Kenney hull remains visible. */ };
    img.src=new URL('../assets/space/boss-capital-'+key+'.webp?v=fleet-104',import.meta.url).href;
}
const LIMIT = 70;
const KEYS = Object.freeze({
    bat:'drone',zombie:'fighter',skeleton:'interceptor',stalker:'interceptor',
    wolf:'bomber',golem:'shield',ghost:'ufoBlue',mage:'ufoGreen',
    slime:'swarm',slimeling:'drone',bomber:'bomber',illusionist:'ufoRed',
    sniper:'caster',gunship:'shield',minelayer:'bomber',
    rammer:'interceptor',carrier:'bossCarrier',hunter:'bossCruiser',
    reaper:'bossCruiser',necromancer:'bossCarrier',
    void_lord:'bossDreadnought',chrono_lich:'bossCarrier',ice_queen:'bossCruiser'
});
onAtlasChange(() => CACHE.clear());
function fallback(c,color,boss=false) {
    const r = boss ? 1.25 : 1;
    c.scale(r,r);
    c.beginPath();
    c.moveTo(0,-18);c.lineTo(8,-6);c.lineTo(19,7);
    c.lineTo(13,12);c.lineTo(6,7);c.lineTo(0,14);
    c.lineTo(-6,7);c.lineTo(-13,12);c.lineTo(-19,7);
    c.lineTo(-8,-6);c.closePath();
    c.fillStyle=color;c.fill();c.strokeStyle='#a0dcff';c.lineWidth=1.5;c.stroke();
    c.fillStyle='#102846';c.fillRect(-4,-8,8,11);
    c.fillStyle='#b8eaff';c.fillRect(-2,-7,4,5);
    c.fillStyle='#ff916d';c.fillRect(-9,12,5,4);c.fillRect(4,12,5,4);
}
export function getEnemySprite(def,size) {
    if(def.boss)requestCapitalArt(def.id);
    const key=def.id+'@'+size;
    if(CACHE.has(key))return CACHE.get(key);
    if(typeof document==='undefined')return null;
    const pad=Math.max(10,size*.65),display=Math.max(27,size*2.25);
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=Math.ceil(display+pad*2);
    const c=canvas.getContext('2d');
    if(!c)return null;
    const img=(def.boss&&capitalArt[BOSS_TYPES[def.id]]) || atlas[KEYS[def.id]||'drone'];
    c.translate(canvas.width/2,canvas.height/2);
    c.shadowColor=def.boss?'rgba(255,135,143,.35)':'rgba(93,179,255,.38)';
    c.shadowBlur=def.boss?9:8;
    if(img?.naturalWidth){
        c.imageSmoothingEnabled=true;
        const ratio=img.naturalHeight/img.naturalWidth;
        // Portrait capital ships are fitted inside the existing collision
        // silhouette; their artwork never changes physics or targeting.
        const width=def.boss&&capitalArt[BOSS_TYPES[def.id]]?
            Math.min(display,size*1.9):display;
        const height=width*ratio;
        c.drawImage(img,-width/2,-height/2,width,height);
    }else{
        c.scale(display/43,display/43);
        fallback(c,def.color||'#8ad6e8',def.boss);
    }
    CACHE.set(key,canvas);
    if(CACHE.size>LIMIT)CACHE.delete(CACHE.keys().next().value);
    return canvas;
}
export function drawHero(ctx,x,y,size,stride=0,facing=1,angle=0,variant='fighter',stage=0,healthRatio=1,enginePower=0) {
    const key=variant==='mage'?'shipMage':variant==='scout'?'shipScout':'shipFighter';
    const img=atlas[key];
    const power=Math.max(0,Math.min(1,Number(enginePower)||0));
    const motion = heroMotionPose(size, power);
    ctx.save();ctx.translate(x + motion.x, y + motion.y);
    ctx.rotate(angle + motion.angle);
    // The original ten-stage sprites own their engine state. This also avoids
    // painting bright fixed-size thruster halos over a parked craft.
    if(!drawEvolvedHero(ctx,size,stage,healthRatio,power)){
        if(power>.01){
            const t=typeof performance!=='undefined'?performance.now()*.001:0;
            const thrust=.7+.3*Math.sin(t*25+stride);
            ctx.save();ctx.globalCompositeOperation='lighter';
            for(const dx of [-size*.36,size*.36]){
                const g=ctx.createRadialGradient(dx,size*.63,0,dx,size*.89,size*.9);
                g.addColorStop(0,'rgba(223,252,255,'+(.83*power)+')');
                g.addColorStop(.26,'rgba(34,177,255,'+(.55*power)+')');
                g.addColorStop(1,'rgba(33,115,255,0)');
                ctx.fillStyle=g;ctx.beginPath();
                ctx.ellipse(dx,size*.84,size*.37,size*thrust*power,0,0,Math.PI*2);
                ctx.fill();
            }
            ctx.restore();
        }
        const width=size*2.7;
        if(img?.naturalWidth){
            ctx.shadowColor=variant==='mage'?'#44ffda':variant==='scout'?'#ffbc60':'#42bfff';
            ctx.shadowBlur=15;
            const height=width*img.naturalHeight/img.naturalWidth;
            ctx.drawImage(img,-width/2,-height/2,width,height);
        }else{
            ctx.scale(size/21,size/21);
            fallback(ctx,variant==='mage'?'#3ce0b0':variant==='scout'?'#ffad59':'#54b8ff');
        }
    }
    ctx.restore();
}

