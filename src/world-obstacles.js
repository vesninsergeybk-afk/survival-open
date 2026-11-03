/**
 * Large, real obstacles (CC0 Kenney art). Every sprite is composed of exact
 * source cells; only its small ground footprint blocks walking.
 *
 * Background shrubs, stones and ferns remain decorative and passable.
 * No combat RNG, save data, or enemy AI is modified by these objects.
 */
import { atlas } from './asset-art.js?v=art-888';
import { CONFIG } from './config.js?v=base-84';
import { drawStationPart } from './station-art.js?v=base-86';
import { getFXSprite } from './vfx-textures.js?v=space-4';

// CC0 rock atlases by badmug (OpenGameArt), served as compact WebP. Original
// Kenney sprites remain the fallback and the sole collision authority.
const texturedRocks = { stone: null, ore: null };
// Prepare both CC0 source atlases once on load. Filtering every visible
// obstacle every frame proved needlessly costly on mid-range mobile GPUs.
function gradeRockAtlas(img,kind) {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return img;
    const graded=document.createElement('canvas');
    graded.width=img.naturalWidth; graded.height=img.naturalHeight;
    const painter=graded.getContext?.('2d');
    if (!painter || !('filter' in painter)) return img;
    // Keep a readable, solid silhouette while the brightest ice/ore
    // highlights no longer compete with the player's ship and mission HUD.
    painter.filter=kind==='ore'
        ? 'brightness(.79) contrast(1.08) saturate(.82)'
        : 'brightness(.72) contrast(1.13) saturate(.68)';
    painter.drawImage(img,0,0);
    painter.filter='none';
    return graded;
}
if (typeof Image !== 'undefined') {
    for (const [kind, filename] of Object.entries({
        stone: 'asteroid-realistic.webp', ore: 'asteroid-ore.webp'
    })) {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => { if (img.naturalWidth) texturedRocks[kind] = gradeRockAtlas(img,kind); };
        img.onerror = () => { /* Kenney sprite fallback. */ };
        img.src = new URL('../assets/space/' + filename + '?v=webp-106', import.meta.url).href;
    }
}
const ROCK_FRAMES = 30;
function drawRock(ctx, o, fallback, side, time) {
    if (o.missionHull && drawStationPart(ctx,o.missionHullPart,0,0,side*1.42,0,.96)) return;
    const sheet=(o.missionSeal || o.missionVolatile || o.missionRoadblock)
        ? texturedRocks.ore : texturedRocks.stone;
    if (sheet?.naturalWidth || sheet?.width) {
        // 510 × 500: six columns × five rows; slow, smooth rotation.
        const phase=Math.abs((o.x*.011 + o.y*.017) | 0);
        const frame=(Math.floor(time*10 + phase) % ROCK_FRAMES + ROCK_FRAMES) % ROCK_FRAMES;
        const cellX=(frame%6)*85, cellY=Math.floor(frame/6)*100;
        ctx.drawImage(sheet,cellX,cellY,85,100,-side*.55,-side*.57,side*1.1,side*1.14);
    } else if (fallback?.naturalWidth) ctx.drawImage(fallback,-side/2,-side/2,side,side);
}


const NEARBY = Object.freeze([
    [300, -90], [-190, -250], [640, 210],
    [-440, 360], [120, 530], [950, -260]
]);
const ART = Object.freeze({
    forest: [
        { sheet:'meteorBrown1', scale:.75, radius:20 },
        { sheet:'meteorGrey2', scale:.65, radius:17 },
        { sheet:'meteorBrown3', scale:.74, radius:21 }
    ],
    crypt: [
        { sheet:'meteorGrey1', scale:.85, radius:23 },
        { sheet:'meteorBrown4', scale:.58, radius:15 },
        { sheet:'meteorGrey3', scale:.75, radius:20 }
    ],
    tundra: [
        { sheet:'meteorGrey4', scale:.84, radius:24 },
        { sheet:'meteorBrown2', scale:.66, radius:19 },
        { sheet:'meteorGrey2', scale:.72, radius:22 }
    ]
});

export function createWorldObstacles(stage) {
    const defs = ART[stage] || ART.forest;
    const cx = CONFIG.ARENA_WIDTH / 2, cy = CONFIG.ARENA_HEIGHT / 2;
    const points = NEARBY.map(([x, y]) => [cx + x, cy + y]);
    for (let gy = 1; gy <= 8; gy++) {
        for (let gx = 1; gx <= 12; gx++) {
            const phase = gx * 71 + gy * 103;
            const x = gx * 1800 + Math.sin(phase * .4) * 310;
            const y = gy * 1650 + Math.cos(phase * .6) * 330;
            if (Math.hypot(x - cx, y - cy) > 450) points.push([x, y]);
        }
    }
    // A denser ring of breakable debris near the starting sector offers
    // immediate cover, routes and rewards without blocking the spawn itself.
    for (let i = 0; i < 16; i++) {
        const angle = i * 2.3999632297;
        const r = 240 + (i % 6) * 91;
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
    }
    return points.map(([x, y], index) => {
        const art = defs[(index + (index % 3 === 0 ? 0 : 1)) % defs.length];
        const hp = Math.round(32 + art.radius * 2.5);
        const mass=220+art.radius*art.radius*2.2;
        return { id: stage + ':obstacle:' + index, x, y, ...art,
            hp, maxHp: hp, destroyed: false, mass,
            vx:0,vy:0,spin:0,rotation:(x*.07+y*.013)%(Math.PI*2) };
    });
}

function obstacleImage(obstacle) {
    // A slow or missing optional sprite must not remove a gameplay obstacle.
    // The old art remains a visible fallback before the compact WebP atlases load.
    return atlas[obstacle.sheet]?.naturalWidth ? atlas[obstacle.sheet] :
        atlas.meteor1?.naturalWidth ? atlas.meteor1 :
        atlas.meteor2?.naturalWidth ? atlas.meteor2 : atlas.meteor3;
}
function active(obstacle) {
    return !obstacle.destroyed && Boolean(obstacleImage(obstacle)?.naturalWidth);
}

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
/** Newtonian-looking kicks, limited to prevent pinball behaviour. */
function kickAsteroid(o,dx,dy,momentum) {
    const distance=Math.hypot(dx,dy);
    if(!o || o.destroyed || distance<.0001 || momentum<=0)return;
    const mass=o.mass||220+(o.radius||20)**2*2.2;
    const dv=Math.min(95,momentum/mass);
    o.vx=(o.vx||0)+dx/distance*dv;
    o.vy=(o.vy||0)+dy/distance*dv;
    const speed=Math.hypot(o.vx,o.vy);
    if(speed>92){o.vx=o.vx/speed*92;o.vy=o.vy/speed*92;}
    const torque=Math.sin((o.x+o.y)*.09);
    o.spin=clamp((o.spin||0)+dv*.009*torque,-.36,.36);
}

/** Slow, massive motion integrated only for visible/recently moving rocks. */
export function updateWorldObstacles(game,dt){
    const rocks=game.worldObstacles||[];
    const px=game.player?.x??CONFIG.ARENA_WIDTH/2;
    const py=game.player?.y??CONFIG.ARENA_HEIGHT/2;
    const drag=Math.exp(-1.35*dt),spinDrag=Math.exp(-1.8*dt);
    const movers=[];
    for(const o of rocks){
        if(o.destroyed || !active(o))continue;
        if(Math.abs(o.x-px)>1650 || Math.abs(o.y-py)>1350){
            // Let old impulses fade while far away, without simulating
            // distant collisions or keeping a rock eternally charged.
            o.vx=(o.vx||0)*drag;o.vy=(o.vy||0)*drag;
            o.spin=(o.spin||0)*spinDrag;
            continue;
        }
        if(Math.abs(o.vx||0)+Math.abs(o.vy||0)<.06){
            o.vx=0;o.vy=0;continue;
        }
        o.x=clamp(o.x+o.vx*dt,o.radius,CONFIG.ARENA_WIDTH-o.radius);
        o.y=clamp(o.y+o.vy*dt,o.radius,CONFIG.ARENA_HEIGHT-o.radius);
        o.rotation=(o.rotation||0)+(o.spin||0)*dt;
        o.vx*=drag;o.vy*=drag;o.spin=(o.spin||0)*spinDrag;
        movers.push(o);
    }
    // Momentum transfers when two moving rocks meet. No explosive
    // positional correction: overlaps resolve over several frames.
    for(const o of movers)for(const other of rocks){
        if(o===other || other.destroyed || !active(other))continue;
        const dx=other.x-o.x,dy=other.y-o.y;
        const limit=o.radius+other.radius,dist=Math.hypot(dx,dy);
        if(dist>=limit || dist<.01)continue;
        const approach=(o.vx-other.vx)*dx/dist+(o.vy-other.vy)*dy/dist;
        if(approach>0){
            kickAsteroid(other,dx,dy,approach*(o.mass||900)*.27);
            o.vx*=.78;o.vy*=.78;
        }
        const separate=Math.min(1.1,(limit-dist)*.1);
        other.x+=dx/dist*separate;
        other.y+=dy/dist*separate;
    }
}

/** Ships transfer momentum on contact, including when the pilot slides
 * along an obstacle and the collision resolver blocks their movement. */
export function nudgeWorldObstaclesFromShip(ship,rocks,oldX,oldY,dt,proposed=null){
    if(!ship || !rocks?.length || dt<=0)return;
    const tx=proposed?.x??ship.x,ty=proposed?.y??ship.y;
    const vx=(tx-oldX)/dt,vy=(ty-oldY)/dt;
    const speed=Math.hypot(vx,vy);
    if(speed<12)return;
    const mag=Math.min(speed,450);
    for(const o of rocks){
        if(!active(o) || Math.abs(o.x-tx)>90 || Math.abs(o.y-ty)>90)continue;
        const radius=o.radius+Math.max(7,(ship.size||17)*.68)+4;
        if(Math.hypot(o.x-tx,o.y-ty)>radius)continue;
        kickAsteroid(o,vx,vy,mag*95*dt);
    }
}

/** Damage nearby asteroids. Optional hitSet prevents penetrating shots from
 * dealing damage every animation frame. Enemy fire does not award salvage. */
export function damageWorldObstacles(game, x, y, radius, damage, hitSet = null, reward = true, impact = null) {
    if (!game?.worldObstacles || damage <= 0) return 0;
    let hits = 0;
    for (const o of game.worldObstacles) {
        if (!active(o) || hitSet?.has(o)) continue;
        if (Math.abs(o.x - x) > radius + o.radius ||
            Math.abs(o.y - y) > radius + o.radius) continue;
        const d = Math.hypot(o.x - x, o.y - y);
        if (d > radius + o.radius) continue;
        hitSet?.add(o);
        hits++;
        // Shot direction wins over radial push, so close-range gunfire
        // moves rock away from the muzzle rather than at random.
        let nx=o.x-x,ny=o.y-y;
        if(impact && Math.hypot(impact.vx||0,impact.vy||0)>1){
            nx=impact.vx;ny=impact.vy;
        }
        if(Math.hypot(nx,ny)<.01){
            const a=o.x*.031+o.y*.019;
            nx=Math.cos(a);ny=Math.sin(a);
        }
        kickAsteroid(o,nx,ny,damage*1100*(radius>o.radius*2?1.25:1));
        o.hp -= damage;
        o.hitUntil = (game.gameTime || 0) + .18;
        if (o.hp <= 0) {
            o.destroyed = true;
            game.worldVfx?.asteroidBreak(o.x, o.y, o.radius);
            game.createParticles?.(o.x, o.y, '#a8dcfa', 6);
            game.createParticles?.(o.x, o.y, '#ffb56c', 9);
            if (reward) {
                const salvage = game.player?._passiveSum?.('salvageMult') || 0;
                const bonus = Math.round((14 + o.radius * .4) * (1 + salvage));
                game.dropExp?.(o.x, o.y, bonus);
                game.friendlyBases?.addCredits(3, game, o.x, o.y);
                game.spawnTemporaryBoost?.(o.x, o.y);
                if (o.id.endsWith(':0') || o.id.endsWith(':6')) game.player?.heal?.(4);
                game.createFloatingText?.('УТИЛЬ · +' + bonus + ' энергии',
                    o.x, o.y - 25, '#a4fff3');
                if (!game._firstRockBroken) {
                    game._firstRockBroken = true;
                    game._announce?.('Разрушайте астероиды: внутри энергия и временные усилители');
                }
            }
        } else {
            game.worldVfx?.asteroidImpact(o.x, o.y, o.radius);
            game.createParticles?.(o.x, o.y, '#a5c7e6', 2);
        }
    }
    return hits;
}

function clearAt(x, y, radius, obstacles) {
    for (const o of obstacles) {
        if (!active(o)) continue; // Never create an invisible wall.
        const dx = x - o.x, dy = y - o.y;
        const limit = radius + o.radius;
        if (dx * dx + dy * dy < limit * limit) return false;
    }
    return true;
}

/** Axis-separated substeps give natural sliding and avoid tunnelling at speed. */
export function resolveWorldObstacles(player, obstacles, previousX, previousY) {
    if (!player || !Array.isArray(obstacles) || !obstacles.length) return;
    if (!Number.isFinite(previousX) || !Number.isFinite(previousY)) return;
    if (!Number.isFinite(player.x) || !Number.isFinite(player.y)) return;
    const goalX = player.x, goalY = player.y;
    const dx = goalX - previousX, dy = goalY - previousY;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
    const sx = dx / steps, sy = dy / steps;
    const radius = Math.max(10, Math.min(14, (player.size || 20) * .65));
    let x = previousX, y = previousY;
    for (let i = 0; i < steps; i++) {
        if (clearAt(x + sx, y, radius, obstacles)) x += sx;
        if (clearAt(x, y + sy, radius, obstacles)) y += sy;
    }
    player.x = x;
    player.y = y;
}

function sprite(ctx, o, sheet, gameTime=0, player=null, quality=1) {
    const side = 70 * o.scale;
    ctx.save();
    ctx.translate(o.x,o.y);
    ctx.rotate(o.rotation??(o.x*0.07+o.y*0.013)%(Math.PI*2));
    const hitPulse = Math.max(0, (o.hitUntil || 0) - gameTime) / .18;
    // The visible rock briefly shudders after impact; its collision body
    // stays fixed and the underlying mass/impulse simulation is untouched.
    if(hitPulse>0)ctx.translate(Math.sin(gameTime*105+o.x*.17)*hitPulse*1.8,
        Math.cos(gameTime*97+o.y*.13)*hitPulse*1.8);
    ctx.shadowColor='rgba(89,193,255,.2)';
    ctx.shadowBlur=quality<.75?0:7;
    drawRock(ctx,o,sheet,side,gameTime);
    if (hitPulse > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(.9, hitPulse*.85);
        ctx.shadowColor = '#8be7ff'; ctx.shadowBlur = 15;
        drawRock(ctx,o,sheet,side,gameTime);
        ctx.restore();
    }
    // Short segmented rim signals a nearby solid, destructible object.
    // Distant debris has no interactive outline and remains visually quiet.
    if (player && Math.hypot(o.x-player.x,o.y-player.y) < 245) {
        ctx.save();ctx.shadowBlur=0;
        ctx.globalAlpha=.22 + .06*Math.sin(gameTime*3+(o.x+o.y)*.002);
        ctx.strokeStyle='#8ae6ee';ctx.lineWidth=1.4;
        ctx.setLineDash([7,11]);ctx.lineDashOffset=-gameTime*4;
        ctx.beginPath();ctx.arc(0,0,side*.47,0,Math.PI*2);ctx.stroke();
        ctx.restore();
    }
    if (o.hp < o.maxHp * .68) {
        const scorch=getFXSprite('scorch','orange');
        if(scorch){
            ctx.save();ctx.shadowBlur=0;
            ctx.globalAlpha=.15+.34*(1-o.hp/Math.max(1,o.maxHp));
            ctx.drawImage(scorch,-side*.35,-side*.28,side*.7,side*.58);
            ctx.restore();
        }
        ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,190,135,.83)';
        ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(-side*.2,-side*.25); ctx.lineTo(0,-side*.04);
        ctx.lineTo(-side*.09,side*.18);
        ctx.moveTo(0,-side*.04); ctx.lineTo(side*.23,-side*.14); ctx.stroke();
        ctx.fillStyle = 'rgba(7,15,32,.7)';
        ctx.fillRect(-side*.36,side*.41,side*.72,4);
        ctx.fillStyle = '#fbc28e';
        ctx.fillRect(-side*.36,side*.41,side*.72*Math.max(0,o.hp/o.maxHp),4);
    }
    ctx.restore();
}

/** Split behind/in-front of the player according to each object's ground y. */
export function renderWorldObstacles(ctx, obstacles, player, foreground = false, gameTime=0, quality=1) {
    if (!Array.isArray(obstacles)) return;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    for (const o of obstacles) {
        if (!active(o)) continue;
        if (player && (Math.abs(o.x - player.x) > 1100 || Math.abs(o.y - player.y) > 900)) continue;
        const inFront = Boolean(player && o.y > player.y + 2);
        if (inFront !== foreground) continue;
        sprite(ctx, o, obstacleImage(o), gameTime, player, quality);
    }
    ctx.restore();
}
