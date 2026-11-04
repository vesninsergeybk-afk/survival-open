/**
 * Ten approved ship stages. Original art is never regenerated.
 * Each idle frame removes only the baked-in exhaust in a one-time cached canvas.
 * Transitioning to the original sprite reveals the engines as thrust increases.
 */
export const HERO_STAGE_COUNT = 10;
const art = new Array(HERO_STAGE_COUNT);
const damagedArt = new Array(HERO_STAGE_COUNT);
const idleArt = [new Array(HERO_STAGE_COUNT), new Array(HERO_STAGE_COUNT)];
const compactArt=new WeakMap();
function compact(source){
    if(!source?.complete||!source.naturalWidth||typeof document==='undefined')return source;
    if(compactArt.has(source))return compactArt.get(source);
    const canvas=document.createElement('canvas');
    const ratio=Math.min(1,256/Math.max(source.naturalWidth,source.naturalHeight));
    canvas.width=Math.max(1,Math.round(source.naturalWidth*ratio));
    canvas.height=Math.max(1,Math.round(source.naturalHeight*ratio));
    const c=canvas.getContext('2d');if(!c)return source;
    c.drawImage(source,0,0,canvas.width,canvas.height);compactArt.set(source,canvas);
    return canvas;
}
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

// Exhaust masks: [centre X, start Y, half-width, end Y], fractions of source
// dimensions. Each of the ten stages has separate intact/damaged coordinates.
// Masks start below the metallic nozzle lip; all other hull pixels are retained.
const INTACT_EXHAUSTS = [
    [[.562,.839,.048,1]],
    [[.445,.831,.049,1]],
    [[.563,.824,.048,1]],
    [[.445,.826,.050,1]],
    [[.563,.824,.052,1]],
    [[.445,.824,.050,1],[.176,.490,.022,.585],[.713,.490,.022,.585]],
    [[.563,.854,.047,1]],
    [[.445,.858,.050,1]],
    [[.410,.783,.044,.96],[.487,.783,.044,.96],[.563,.772,.047,.97],
        [.638,.783,.044,.96],[.715,.783,.044,.96],[.563,0,.035,.12]],
    [[.280,.751,.044,.929],[.356,.752,.044,.956],[.445,.748,.048,.96],
        [.528,.752,.044,.956],[.613,.751,.044,.929],[.138,.445,.030,.555],
        [.748,.445,.030,.555],[.445,0,.035,.12]]
];
const DAMAGED_EXHAUSTS = [
    [[.541,.817,.067,.995]],
    [[.486,.817,.067,.995]],
    [[.563,.813,.067,.995]],
    [[.498,.813,.073,.995]],
    [[.562,.817,.069,.995]],
    [[.460,.816,.069,.995],[.185,.48,.041,.60],[.732,.48,.041,.60]],
    [[.540,.827,.067,.995]],
    [[.500,.831,.067,.995]],
    [[.356,.738,.058,.985],[.454,.768,.057,.985],[.535,.749,.064,.995],
        [.623,.768,.057,.985],[.705,.738,.058,.985]],
    [[.277,.728,.056,.94],[.370,.775,.059,.99],[.471,.739,.066,.995],
        [.580,.775,.059,.99],[.670,.728,.056,.94],
        [.114,.398,.044,.482],[.839,.398,.044,.482]]
];

function request(stage, damaged = false) {
    if (typeof Image === 'undefined') return null;
    const index = clamp(Math.floor(stage) || 0, 0, HERO_STAGE_COUNT - 1);
    const target = damaged ? damagedArt : art;
    if (target[index]) return target[index];
    const image = new Image();
    image.decoding = 'async';
    const filename = 'ship_' + String(index + 1).padStart(2, '0') +
        (damaged ? '_damaged.webp' : '.webp');
    image.src = new URL('../assets/space/hero-evolution/' + filename, import.meta.url).href;
    target[index] = image;
    return image;
}
request(0);

/**
 * Create exactly one zero-thrust sprite per artwork, lazily. No extra network
 * requests and no image processing in the frame loop.
 */
export function getIdleHeroSprite(stage = 0, damaged = false) {
    const index = clamp(Math.floor(stage) || 0, 0, HERO_STAGE_COUNT - 1);
    const source = request(index, damaged);
    // Width/height may arrive before image decoding finishes: drawing too
    // early caches a permanently transparent idle frame in some browsers.
    if (!source?.complete || !source.naturalWidth || !source.naturalHeight ||
        typeof document === 'undefined') return null;
    const target = idleArt[damaged ? 1 : 0];
    if (target[index]) return target[index];
    const canvas = document.createElement('canvas');
    const small=compact(source);
    canvas.width = small.width;
    canvas.height = small.height;
    const c = canvas.getContext('2d');
    if (!c) return null;
    c.drawImage(small, 0, 0);
    c.globalCompositeOperation = 'destination-out';
    const zones = (damaged ? DAMAGED_EXHAUSTS : INTACT_EXHAUSTS)[index];
    for (const [cx, from, half, to] of zones) {
        const x = cx * canvas.width;
        const y = from * canvas.height;
        const w = half * canvas.width;
        const h = Math.max(1, (to - from) * canvas.height);
        // Feather the nozzle edge; remove the entire outer flame below it.
        const gradient = c.createLinearGradient(0, y, 0, y + Math.min(9, h * .14));
        gradient.addColorStop(0, 'rgba(255,255,255,0)');
        gradient.addColorStop(1, 'rgba(255,255,255,1)');
        c.fillStyle = gradient;
        c.fillRect(x - w, y, w * 2, h);
    }
    c.globalCompositeOperation = 'source-over';
    target[index] = canvas;
    return canvas;
}

/** Subpixel hover, shared by the game and the live gallery preview. */
export function heroMotionPose(size, thrust = 0, seconds = null) {
    const t = Number.isFinite(seconds) ? seconds :
        (typeof performance !== 'undefined' ? performance.now() * .001 : 0);
    const idle = 1 - clamp(Number(thrust) || 0, 0, 1);
    return {
        x: size * (.010 + .008 * idle) * Math.sin(t * 1.37),
        y: size * (.027 + .014 * idle) * Math.sin(t * 2.23),
        angle: .008 * idle * Math.sin(t * 1.12)
    };
}

export function heroStageFromProgress(player, campaign = null, workshop = false) {
    const completed = campaign?.completed;
    const finished = Array.isArray(completed) ? completed.length :
        completed && typeof completed === 'object' ?
            Object.values(completed).filter(Boolean).length : 0;
    const level = Math.max(1, Number(player?.level) || 1);
    const weaponCount = player?.weapons?.length || 0;
    return clamp(Math.max(
        Math.floor((level - 1) / 3),
        Math.floor(finished * 1.2),
        Math.max(0, weaponCount - 1),
        workshop ? 2 : 0
    ), 0, HERO_STAGE_COUNT - 1);
}

export function drawEvolvedHero(ctx, size, stage = 0, healthRatio = 1, thrust = 0, geometry = null) {
    const index = clamp(Math.floor(stage) || 0, 0, HERO_STAGE_COUNT - 1);
    const intact = request(index);
    request(Math.min(index + 1, HERO_STAGE_COUNT - 1));
    const hp = Number.isFinite(healthRatio) ? healthRatio : 1;
    const damaged = hp < .65 ? request(index, true) : null;
    const showDamage = hp < .4 && !!damaged?.complete && !!damaged.naturalWidth && !!damaged.naturalHeight;
    const image = showDamage ? damaged : intact;
    if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return false;
    const idle = getIdleHeroSprite(index, showDamage);
    const power = clamp(Number(thrust) || 0, 0, 1);
    const t = typeof performance !== 'undefined' ? performance.now() * .001 : 0;
    const width = size * 4.1;
    const height = width * image.naturalHeight / image.naturalWidth;
    // Optional output lets separate equipment layers follow the artwork that
    // actually decoded, including the delayed switch to damaged imagery.
    if (geometry) Object.assign(geometry, {stage:index,damaged:showDamage,width,height});
    ctx.save();
    ctx.shadowColor = '#51d9fa';
    ctx.shadowBlur = 0;
    ctx.drawImage(idle || compact(image), -width / 2, -height / 2, width, height);
    // The hull remains fully opaque; only its baked exhaust is crossfaded.
    if (idle && power > .005) {
        ctx.shadowBlur = 0;
        // The baked flame breathes even at constant speed; the hull does not.
        ctx.globalAlpha = power * (.94 + .06 * Math.sin(t * 22 + index));
        ctx.drawImage(compact(image), -width / 2, -height / 2, width, height);
        ctx.globalAlpha = 1;
    }

    // Low-power navigation lights trade places with the moving indicators.
    // Tiny highlights are anchored to the hull and never need extra sprites.
    const bodyX = showDamage ? .50 : (index % 2 === 0 ? .56 : .445);
    const ledY = index >= 8 && !showDamage ? .57 : .60;
    const pulse = .74 + .26 * Math.sin(t * 2.7);
    ctx.globalCompositeOperation = 'lighter';
    for (const direction of [-1, 1]) {
        const idleLight = 1 - power;
        const fx = (bodyX - .5 + direction * .086) * width;
        const fy = (ledY - .5) * height;
        ctx.fillStyle = 'rgba(104,244,245,' + (.25 * idleLight * pulse) + ')';
        ctx.beginPath();
        ctx.arc(fx, fy, Math.max(.65, size * .085), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,183,76,' + (.24 * power) + ')';
        ctx.beginPath();
        ctx.arc(fx + direction * size * .2, fy + size * .36,
            Math.max(.55, size * .07), 0, Math.PI * 2);
        ctx.fill();
    }
    // Severe damage adds a small warning beacon to the existing cracked art.
    // Keep it steady enough to read without flashing the whole ship.
    if (showDamage && hp < .35) {
        const urgency = clamp((.35 - hp) / .27, 0, 1);
        const signal = .18 + .20 * (.5 + .5 * Math.sin(t * 3.6));
        ctx.fillStyle = 'rgba(255,107,53,' + (urgency * signal) + ')';
        ctx.beginPath();
        ctx.arc((bodyX - .5 + .10) * width, (.55 - .5) * height,
            Math.max(.55, size * .11), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
    return true;
}

