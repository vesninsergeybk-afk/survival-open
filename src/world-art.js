import { CONFIG } from './config.js?v=cc0-6';
import { atlas, onAtlasChange } from './asset-art.js?v=cc0-4';

/**
 * Decorative, deterministic arena art. No network assets, collisions, or RNG
 * mutations: visuals cannot influence a run, a speedrun seed, or a replay.
 * Tiles are rasterised once and recycled as the camera moves.
 */
const TILE = 256;
const CACHE_LIMIT = 68;

const THEMES = {
    forest: { floor: '#203a36', fleck: '#79a58a', shadow: '#102624', glow: '#a9eeb2' },
    crypt:  { floor: '#242635', fleck: '#8894ac', shadow: '#111321', glow: '#94cbf2' },
    tundra: { floor: '#45677a', fleck: '#e1f2ff', shadow: '#1a364b', glow: '#c3efff' }
};

function randomSeed(x, y, stage) {
    let h = (Math.imul(x + 91, 374761393) ^ Math.imul(y + 157, 668265263) ^
        Math.imul(stage === 'crypt' ? 73 : stage === 'tundra' ? 151 : 37, 2246822519)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
}
function generator(seed) {
    let s = seed || 1;
    return () => {
        s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
        return (s >>> 0) / 4294967296;
    };
}
function ellipse(c, x, y, rx, ry, fill, rotate = 0) {
    c.beginPath();
    c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rotate, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
}
function stroke(c, points, color, width) {
    c.beginPath();
    c.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.stroke();
}
function fern(c, x, y, r, rng) {
    const a = rng() * Math.PI * 2;
    c.save();
    c.translate(x, y);
    c.rotate(a);
    stroke(c, [[0, 0], [r * 0.15, -r * 0.55], [0, -r]], '#759f69', 1.4);
    for (let j = 1; j < 6; j++) {
        const t = j / 6;
        const yy = -r * t;
        const w = r * (0.55 - t * 0.35);
        stroke(c, [[0, yy], [-w, yy - w * 0.35]], j % 2 ? '#568b62' : '#9ac784', 2.4);
        stroke(c, [[0, yy], [w, yy - w * 0.35]], '#578f69', 2.2);
    }
    c.restore();
}
function toadstool(c, x, y, scale, rng) {
    ellipse(c, x + 2, y + 5, 10 * scale, 4 * scale, 'rgba(5,15,12,.25)');
    c.fillStyle = '#dac9a9';
    c.fillRect(x - 2 * scale, y - 7 * scale, 4 * scale, 11 * scale);
    ellipse(c, x, y - 8 * scale, 9 * scale, 5 * scale, rng() > 0.55 ? '#c17160' : '#d8ac6d');
    ellipse(c, x - 3 * scale, y - 10 * scale, 1.5 * scale, 1.2 * scale, '#f8dfb2');
    ellipse(c, x + 3 * scale, y - 7 * scale, 1.3 * scale, 1.1 * scale, '#f8dfb2');
}
function treeStump(c, x, y, r) {
    ellipse(c, x + 3, y + r * .55, r * 1.3, r * .7, 'rgba(4,19,17,.4)');
    ellipse(c, x, y, r * .9, r * .65, '#382e2a', -.2);
    ellipse(c, x - 2, y - 2, r * .63, r * .43, '#987957', -.2);
    ellipse(c, x - 2, y - 2, r * .34, r * .23, '#c0a47c', -.2);
    stroke(c, [[x-r*.75,y+r*.15],[x-r*.25,y+r*.32],[x+r*.22,y+r*.3]], '#554331', 2);
}
function grave(c, x, y, rng) {
    const w = 15 + rng() * 8, h = 20 + rng() * 9;
    ellipse(c, x + 5, y + 8, w, h * .44, 'rgba(3,5,13,.38)', -.25);
    c.fillStyle = '#49516a';
    c.beginPath();
    c.moveTo(x-w*.5,y+7); c.lineTo(x-w*.5,y-h*.55);
    c.quadraticCurveTo(x,y-h*1.15,x+w*.5,y-h*.55);
    c.lineTo(x+w*.5,y+7); c.closePath(); c.fill();
    stroke(c, [[x-w*.39,y-h*.4],[x,y-h*.65],[x+w*.34,y-h*.4]], '#7e899c', 1.5);
    stroke(c, [[x,y-h*.4],[x,y-h*.05]], '#222a3c', 2);
    stroke(c, [[x-4,y-h*.23],[x+4,y-h*.23]], '#222a3c', 2);
}
function lantern(c, x, y) {
    const g = c.createRadialGradient(x,y,2,x,y,38);
    g.addColorStop(0,'rgba(125,211,244,.32)');
    g.addColorStop(1,'rgba(125,211,244,0)');
    ellipse(c,x,y,38,38,g);
    stroke(c,[[x,y+15],[x,y-12]],'#425269',3);
    c.fillStyle='#b9eefa'; c.fillRect(x-4,y-11,8,11);
    c.fillStyle='#334357'; c.fillRect(x-6,y-14,12,3);
}
function snowPine(c, x, y, r) {
    ellipse(c,x+4,y+r*.6,r*.9,r*.48,'rgba(10,35,52,.38)');
    stroke(c,[[x,y+12],[x,y-r*.8]],'#314c55',4);
    for(let i=0;i<3;i++){
        const yy=y-r*(.72-i*.37), w=r*(.46+i*.24);
        c.beginPath();c.moveTo(x,yy-r*.52);
        c.lineTo(x-w,yy+r*.36);c.quadraticCurveTo(x,yy+r*.20,x+w,yy+r*.36);
        c.closePath();c.fillStyle=i%2?'#567e83':'#315b67';c.fill();
        stroke(c,[[x-w*.8,yy+r*.22],[x,yy-r*.43],[x+w*.8,yy+r*.22]],'#d2eaf0',2.1);
    }
}
function crystal(c, x, y, r) {
    ellipse(c,x+3,y+r*.55,r*.75,r*.32,'rgba(8,42,67,.35)');
    c.beginPath();c.moveTo(x,y-r);c.lineTo(x+r*.43,y);c.lineTo(x,y+r*.65);
    c.lineTo(x-r*.38,y);c.closePath();c.fillStyle='#7fcbdf';c.fill();
    stroke(c,[[x,y-r],[x,y+r*.6]],'#e8ffff',1.3);
    stroke(c,[[x-r*.33,y],[x,y-r*.15],[x+r*.32,y]],'#b5ebf6',1.4);
}
// All three Kenney Tiny sheets use a 16px grid with 1px gutters.
// Copy complete grid cells; never guess a rectangle around a composite object.
function drawTownObject(ctx, sheet, col, row, cols, rows, x, y, scale) {
    for (let iy = 0; iy < rows; iy++) {
        for (let ix = 0; ix < cols; ix++) {
            const sx = (col + ix) * 17, sy = (row + iy) * 17;
            ctx.drawImage(sheet, sx, sy, 16, 16,
                x + ix * 16 * scale, y + iy * 16 * scale,
                16 * scale, 16 * scale);
        }
    }
}

function makeTile(stage, tx, ty) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TILE;
    const c = canvas.getContext('2d');
    if (!c) return null;
    const theme = THEMES[stage] || THEMES.forest;
    const rng = generator(randomSeed(tx, ty, stage));
    c.fillStyle = theme.floor;
    c.fillRect(0, 0, TILE, TILE);

    if (stage === 'crypt') {
        // Uneven flagstones: seams, highlights, moss in the joints.
        for (let row = -1; row < 10; row++) {
            for (let col = -1; col < 8; col++) {
                const x = col * 43 + (row % 2) * 21, y = row * 33;
                c.fillStyle = rng() > .55 ? '#2b3040' : '#303342';
                c.fillRect(x+2,y+2,40,29);
                stroke(c,[[x+4,y+4],[x+36,y+4]],'rgba(149,163,183,.12)',1);
            }
        }
    } else if (stage === 'tundra') {
        for (let i=0;i<20;i++) {
            const x=rng()*TILE,y=rng()*TILE;
            ellipse(c,x,y,13+rng()*35,4+rng()*13,rng()>.5?'rgba(212,241,249,.13)':'rgba(12,48,65,.18)',rng()*3);
        }
    } else {
        for (let i=0;i<18;i++) {
            const x=rng()*TILE,y=rng()*TILE;
            ellipse(c,x,y,8+rng()*36,5+rng()*20,rng()>.5?'rgba(65,99,67,.22)':'rgba(9,35,32,.25)',rng()*3);
        }
    }
    // Fine-grained texture is baked: no per-frame noise and no flicker.
    for (let i=0;i<630;i++) {
        const x=rng()*TILE,y=rng()*TILE,r=.5+rng()*2.1;
        c.globalAlpha=.035+rng()*.2;
        c.fillStyle=rng()>.44?theme.fleck:theme.shadow;
        c.fillRect(x,y,r*(1+rng()*2),r);
    }
    c.globalAlpha=1;
    for(let i=0;i<19;i++){
        const x=rng()*TILE,y=rng()*TILE;
        if(stage==='forest') {
            if(rng()<.62) fern(c,x,y,7+rng()*15,rng);
            else stroke(c,[[x-5,y],[x,y+3],[x+7,y-2]],'#537362',1.2);
        } else if(stage==='crypt') {
            if(rng()<.6) stroke(c,[[x-8,y-3],[x,y],[x+3,y+5],[x+10,y+3]],'rgba(8,10,20,.45)',1.4);
            else ellipse(c,x,y,2+rng()*4,1+rng()*2,'#3c4c52');
        } else {
            if(rng()<.55) stroke(c,[[x-8,y],[x,y-2],[x+6,y+2]],'rgba(220,248,255,.28)',1.6);
            else ellipse(c,x,y,1.4,1.4,'rgba(235,251,255,.45)');
        }
    }
    // Landmarks: distinctly shaped props, kept beneath actors and pickups.
    const n = stage==='crypt'?(atlas.dungeon?2:5):stage==='tundra'?(atlas.farm?3:7):9;
    for(let i=0;i<n;i++){
        const x=18+rng()*(TILE-36),y=18+rng()*(TILE-36),choice=rng();
        if(stage==='forest') {
            if(choice<.4) fern(c,x,y,16+rng()*18,rng);
            else if(choice<.7) treeStump(c,x,y,9+rng()*9);
            else toadstool(c,x,y,.65+rng()*.75,rng);
        } else if(stage==='crypt') {
            if(choice<.52) grave(c,x,y,rng);
            else if(choice<.69) lantern(c,x,y);
            else {
                ellipse(c,x+2,y+6,16,7,'rgba(2,4,10,.26)');
                stroke(c,[[x-12,y],[x-4,y-7],[x+5,y+3],[x+14,y-3]],'#697083',3);
            }
        } else {
            if(choice<.42) snowPine(c,x,y,16+rng()*11);
            else if(choice<.68) crystal(c,x,y,8+rng()*12);
            else ellipse(c,x,y,5+rng()*10,2+rng()*5,'rgba(220,245,252,.6)',rng()*3);
        }
    }
    // Verified complete CC0 prefabs; keep every sprite inside its cached tile.
    // Decorative objects have no gameplay hitboxes until an object-layer is added.
    if (atlas.town || atlas.dungeon || atlas.farm || atlas.grass || atlas.fog) {
        c.save();
        c.imageSmoothingEnabled = false;
        if (stage === 'forest') {
            if (atlas.grass) {
                c.globalAlpha = .86;
                for (let i = 0; i < 12; i++) {
                    const size = 17 + rng() * 13;
                    c.drawImage(atlas.grass,
                        rng() * (TILE - size), rng() * (TILE - size), size, size);
                }
            }
            if (atlas.town) {
                for (let i = 0; i < 3; i++) {
                    const choice = rng();
                    const tall = choice >= .78;
                    const autumn = choice >= .61 && choice < .78;
                    const col = tall ? (rng() < .24 ? 3 : 4) : autumn ? 9 : 6;
                    const cols = tall ? 1 : 3, rows = tall ? 2 : 3;
                    const scale = tall ? 1.55 + rng() * .4 : .94 + rng() * .32;
                    const width = cols * 16 * scale, height = rows * 16 * scale;
                    const x = 12 + rng() * (TILE - width - 24);
                    const y = 10 + rng() * (TILE - height - 22);
                    ellipse(c,x + width * .5,y + height * .88,
                        width * .29,height * .095,'rgba(5,22,15,.23)');
                    c.globalAlpha = .98;
                    drawTownObject(c,atlas.town,col,0,cols,rows,x,y,scale);
                }
            }
        } else if (stage === 'crypt' && atlas.dungeon) {
            // Isolated complete tombstones: one source cell per object.
            for (let i = 0; i < 3; i++) {
                const col = rng() < .64 ? 6 : 5, row = 5;
                const scale = 1.45 + rng() * .55;
                const width = 16 * scale;
                const x = 10 + rng() * (TILE - width - 20);
                const y = 10 + rng() * (TILE - width - 20);
                c.globalAlpha = .95;
                drawTownObject(c, atlas.dungeon, col, row, 1, 1, x, y, scale);
            }
        } else if (stage === 'tundra') {
            if (atlas.farm) {
                // Each Tiny Farm tree is a complete 16px tile, not a vertical strip.
                for (let i = 0; i < 5; i++) {
                    const col = rng() < .65 ? 3 : 2;
                    const row = rng() < .78 ? 0 : 1;
                    const scale = 1.8 + rng() * .75;
                    const width = 16 * scale;
                    const x = 10 + rng() * (TILE - width - 20);
                    const y = 10 + rng() * (TILE - width - 20);
                    c.globalAlpha = .87;
                    drawTownObject(c, atlas.farm, col, row, 1, 1, x, y, scale);
                }
            }
            if (atlas.fog) {
                c.globalAlpha=.045;
                c.drawImage(atlas.fog,20,45,190,102);
            }
        }
        c.restore();
    }
    return canvas;
}

export class WorldArt {
    constructor() {
        this.cache = new Map();
        onAtlasChange(() => this.cache.clear());
    }
    _tile(stage, tx, ty) {
        const key = stage + ':' + tx + ':' + ty;
        if (this.cache.has(key)) return this.cache.get(key);
        const tile = makeTile(stage,tx,ty);
        this.cache.set(key,tile);
        if (this.cache.size>CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value);
        return tile;
    }
    draw(ctx, stage, x, y, w, h) {
        const id = THEMES[stage] ? stage : 'forest';
        const x0=Math.floor(x/TILE),y0=Math.floor(y/TILE);
        const x1=Math.ceil((x+w)/TILE),y1=Math.ceil((y+h)/TILE);
        for(let ty=y0;ty<=y1;ty++){
            for(let tx=x0;tx<=x1;tx++){
                const tile=this._tile(id,tx,ty);
                if(tile) ctx.drawImage(tile,tx*TILE,ty*TILE);
            }
        }
        // Draw the real arena edge only when it is actually in view.
        if (x < 20 || y < 20 || x + w > CONFIG.ARENA_WIDTH - 20 ||
            y + h > CONFIG.ARENA_HEIGHT - 20) {
            ctx.strokeStyle=id==='tundra'?'rgba(200,236,247,.25)':'rgba(182,218,180,.16)';
            ctx.lineWidth=5;
            ctx.strokeRect(10, 10, CONFIG.ARENA_WIDTH - 20, CONFIG.ARENA_HEIGHT - 20);
        }
    }
    drawAtmosphere(ctx, stage, x, y, w, h, seconds) {
        const id=THEMES[stage] ? stage : 'forest';
        // Anchor particles to visible world cells. Their density stays stable
        // even thousands of pixels from the starting location.
        const color=id==='forest'?'155,240,153':id==='crypt'?'148,176,255':'231,250,255';
        const spacing = 340;
        const firstX = Math.floor(x / spacing) - 1;
        const firstY = Math.floor(y / spacing) - 1;
        const lastX = Math.ceil((x + w) / spacing) + 1;
        const lastY = Math.ceil((y + h) / spacing) + 1;
        for (let cy = firstY; cy <= lastY; cy++) {
            for (let cx = firstX; cx <= lastX; cx++) {
                const rng = generator(randomSeed(cx, cy, id));
                const count = id === 'tundra' ? 2 : 1;
                for (let p = 0; p < count; p++) {
                    const seedX = cx * spacing + rng() * spacing;
                    const seedY = cy * spacing + rng() * spacing;
                    const sx = seedX + Math.sin(seconds * .24 + p + cx) * 9;
                    const sy = seedY + Math.sin(seconds * (id === 'tundra' ? .6 : .25) + p + cy) * 15;
                    if (sx < x || sx > x + w || sy < y || sy > y + h) continue;
                    ctx.fillStyle = 'rgba(' + color + ',' + (id === 'tundra' ? .35 : .23) + ')';
                    ctx.beginPath();
                    ctx.arc(sx, sy, id === 'tundra' ? 1.8 : 1.4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        if (atlas.raylight && id === 'forest') {
            ctx.save();
            ctx.globalCompositeOperation='screen';
            ctx.globalAlpha=.06+.017*Math.sin(seconds*.35);
            ctx.drawImage(atlas.raylight,x+75,y+35,330,156);
            ctx.restore();
        }
        if (atlas.fog && id === 'crypt') {
            ctx.save();
            ctx.globalAlpha=.044+.012*Math.sin(seconds*.22);
            ctx.drawImage(atlas.fog,x+100+Math.sin(seconds*.1)*45,y+180,610,290);
            ctx.restore();
        }
    }
}
