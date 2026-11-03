/**
 * World-space VFX, driven by the game's own dt and camera transform.
 * Kenney CC0 textured particles + bounded pooling, no independent canvas,
 * no network dependencies after the game's first offline cache.
 */
import { getFXSprite, FX_COLORS, getFXLoadStatus } from './vfx-textures.js?v=arcade-vfx-mask-19';
import { getCombatArtStatus } from './combat-art.js?v=art-888';
import {drawStationPart,STATION_PARTS} from './station-art.js?v=base-86';

const TAU = Math.PI * 2;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// A compact radial sprite atlas, prepared once. The old fire00..fire09 files
// are narrow engine flames and cannot serve as explosion frames.
const BLAST_CELL=128, BLAST_FRAMES=8;
// Prepared only on demand; every material reuses the same shape and frame timing.
// These four small, cached palettes cost no gradients or pixel filters at render time.
const BLAST_PALETTES=Object.freeze({
    orange:['255,244,192','255,177,60','245,74,21','106,19,28','255,255,244','255,232,139','255,126,45','255,62,31'],
    red:['255,230,220','255,122,114','224,43,76','91,13,52','255,249,241','255,188,166','244,73,91','180,29,67'],
    cyan:['226,255,255','101,226,255','45,123,230','23,45,118','250,255,255','154,247,255','63,174,244','34,74,192'],
    violet:['248,231,255','191,121,255','124,67,228','44,28,114','255,249,255','220,174,255','165,95,244','96,45,187']
});
const blastAtlases=new Map();
function getBlastAtlas(tint='orange'){
    const kind=BLAST_PALETTES[tint]?tint:'orange';
    if(blastAtlases.has(kind))return blastAtlases.get(kind);
    if(typeof document==='undefined')return null;
    const palette=BLAST_PALETTES[kind];
    try{
        const atlas=document.createElement('canvas');
        atlas.width=BLAST_CELL*BLAST_FRAMES;atlas.height=BLAST_CELL;
        const c=atlas.getContext('2d');
        if(!c)return null;
        for(let frame=0;frame<BLAST_FRAMES;frame++){
            const t=frame/(BLAST_FRAMES-1), fade=Math.pow(1-t,.78);
            const size=16+42*Math.sin(Math.PI*(.12+.7*t));
            c.save();c.translate(frame*BLAST_CELL+64,64);
            c.globalCompositeOperation='lighter';
            // Fireball fragments stay radially consistent across all frames.
            for(let i=0;i<13;i++){
                const a=i*TAU/13+Math.sin(i*27.1)*.13;
                const reach=(9+t*25)*(0.76+.24*Math.sin(i*9.3+1));
                const px=Math.cos(a)*reach,py=Math.sin(a)*reach;
                const rr=size*(.48+.12*Math.sin(i*7.3))*(.8+.2*t);
                const g=c.createRadialGradient(px,py,1,px,py,rr);
                g.addColorStop(0,'rgba('+palette[0]+','+(.69*fade)+')');
                g.addColorStop(.24,'rgba('+palette[1]+','+(.66*fade)+')');
                g.addColorStop(.65,'rgba('+palette[2]+','+(.46*fade)+')');
                g.addColorStop(1,'rgba('+palette[3]+',0)');
                c.fillStyle=g;c.fillRect(px-rr,py-rr,rr*2,rr*2);
            }
            const core=Math.max(4,(18+18*Math.sin(Math.PI*t))*(1-.7*t));
            const g=c.createRadialGradient(0,0,0,0,0,core);
            g.addColorStop(0,'rgba('+palette[4]+','+(.98*fade)+')');
            g.addColorStop(.32,'rgba('+palette[5]+','+(.92*fade)+')');
            g.addColorStop(.68,'rgba('+palette[6]+','+(.62*fade)+')');
            g.addColorStop(1,'rgba('+palette[7]+',0)');
            c.fillStyle=g;c.fillRect(-core,-core,core*2,core*2);
            c.restore();
        }
        blastAtlases.set(kind,atlas);
        return atlas;
    }catch{return null;}
}

export class WorldVFX {
    constructor(settings={}) {
        this.pool = [];
        this.particles = [];
        this.rings = [];
        this.explosions = [];
        this.bossWrecks = [];
        this.shipDebris = [];
        this.clock = 0;
        this.seed = 0x1b69ef74;
        this.thrusterClock = 0;
        this.viewport = null;
        this.configure(settings);
        if(this.maxExplosions)getBlastAtlas('orange');
    }

    configure(settings={}) {
        const reduce = !!settings.reducedMotion ||
            (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
        const compact = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
        const weakMemory = typeof navigator !== 'undefined' && navigator.deviceMemory &&
            navigator.deviceMemory <= 4;
        this.quality = reduce ? .27 : (compact || weakMemory ? .68 : 1);
        this.maxParticles = reduce ? 85 : (compact || weakMemory ? 260 : 520);
        this.maxRings = reduce ? 8 : 30;
        this.maxExplosions = reduce ? 0 : (compact || weakMemory ? 5 : 12);
        this.baseQuality=this.quality;this.baseMaxParticles=this.maxParticles;
        this.baseMaxExplosions=this.maxExplosions;this.budgetScale=1;
    }

    setBudget(scale=1) {
        const value=clamp(scale,.25,1);
        if(value===this.budgetScale)return;
        this.budgetScale=value;
        this.quality=this.baseQuality*value;
        this.maxParticles=Math.round(this.baseMaxParticles*value);
        this.maxExplosions=this.baseMaxExplosions?Math.max(1,Math.round(this.baseMaxExplosions*value)):0;
        // Retire expendable particles first when a weaker device forces a lower cap.
        // This happens at budget changes, not on each animation frame.
        while(this.particles.length>this.maxParticles){
            let idx=0,lowest=Infinity;
            for(let i=0;i<this.particles.length;i++){
                const p=this.particles[i];
                const score=(p.priority||0)*2+(1-p.age/p.life);
                if(score<lowest){lowest=score;idx=i;}
            }
            this.pool.push(this.particles[idx]);
            this.particles.splice(idx,1);
        }
    }

    /** The arcade supplies its current world-space camera before producing effects. */
    setViewport(camera=null) {
        if(!camera){this.viewport=null;return;}
        const worldX=camera.worldX??camera.x,worldY=camera.worldY??camera.y;
        const width=camera.width??camera.w,height=camera.height??camera.h;
        this.viewport=[worldX,worldY,width,height].every(Number.isFinite)&&width>0&&height>0
            ? {worldX,worldY,width,height} : null;
    }

    reset() {
        while (this.particles.length) this.pool.push(this.particles.pop());
        this.rings.length = 0;
        this.explosions.length = 0;
        this.bossWrecks.length = 0;
        this.shipDebris.length = 0;
        this.clock = 0;
        this.thrusterClock = 0;
        this.viewport = null;
        this.seed = 0x1b69ef74;
    }

    _rand() {
        let x = this.seed | 0;
        x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
        this.seed = x;
        return (x >>> 0) / 4294967296;
    }

    _emit(kind, x, y, options={}) {
        const pad=Math.max(170,(options.size??30)*.75)+
            Math.hypot(options.vx||0,options.vy||0)*(options.life||.5);
        if(!this._visible(x,y,this.viewport,pad))return;
        // 0: ambience/engine trails; 1: routine combat feedback; 2: player
        // damage and decisive explosions. Critical feedback displaces ambience.
        const priority=clamp(Math.trunc(options.priority??0),0,2);
        if(this.particles.length>=this.maxParticles){
            if(!priority)return;
            let displaced=-1,weakest=priority;
            for(let i=0;i<this.particles.length;i++){
                const current=this.particles[i].priority||0;
                if(current<weakest){weakest=current;displaced=i;if(!weakest)break;}
            }
            // During a fully saturated critical burst keep the newest cue:
            // recycle the critical particle closest to expiry, never grow the pool.
            if(displaced<0&&priority===2){
                let oldest=-1;
                for(let i=0;i<this.particles.length;i++){
                    const p=this.particles[i];
                    const progress=p.age/p.life;
                    if((p.priority||0)===2&&progress>oldest){oldest=progress;displaced=i;}
                }
            }
            if(displaced<0)return;
            this.pool.push(this.particles[displaced]);
            this.particles[displaced]=this.particles[this.particles.length-1];
            this.particles.pop();
        }
        const p = this.pool.pop() || {};
        p.kind = kind;
        p.priority=priority;
        p.x = x; p.y = y;
        p.vx = options.vx || 0; p.vy = options.vy || 0;
        p.size = options.size ?? 30;
        p.life = Math.max(.04, options.life || .5);
        p.age = 0;
        p.angle = options.angle ?? this._rand() * TAU;
        p.spin = options.spin || 0;
        p.drag = options.drag ?? 1.2;
        p.gravity = options.gravity || 0;
        p.grow = options.grow || 0;
        p.tint = options.tint || 'cyan';
        p.alpha = options.alpha ?? 1;
        p.layer = options.layer || 'front';
        p.additive = options.additive !== false;
        this.particles.push(p);
    }

    _scatter(kind, x, y, count, options={}) {
        const reach=Math.max(170,options.size||20)+(options.originRadius||0)+
            (options.maxSpeed||140)*(options.life||.6);
        if(!this._visible(x,y,this.viewport,reach))return;
        // Do not loop through particles that cannot be admitted.
        if(this.particles.length>=this.maxParticles && !(options.priority>0))return;
        const n = Math.max(1, Math.round(count * this.quality));
        const inner = options.minSpeed || 25, outer = options.maxSpeed || 140;
        // Directional debris is sampled in a cone about the outward contact
        // normal. Ordinary explosions retain their radial distribution.
        const nx=options.nx,ny=options.ny;
        const directed=Number.isFinite(nx)&&Number.isFinite(ny)&&Math.hypot(nx,ny)>1e-6;
        const heading=directed?Math.atan2(ny,nx):0;
        const spread=clamp(options.spread??Math.PI*.9,0,TAU);
        for (let i=0; i<n; i++) {
            const a = directed?heading+(this._rand()-.5)*spread:this._rand()*TAU;
            const speed = inner + (outer-inner)*this._rand();
            const scale = .65 + .8*this._rand();
            const radius = (options.originRadius || 0)*this._rand();
            this._emit(kind, x+Math.cos(a)*radius, y+Math.sin(a)*radius, {
                ...options,
                vx: Math.cos(a)*speed+(options.windX || 0),
                vy: Math.sin(a)*speed+(options.windY || 0),
                size: (options.size || 20)*scale,
                life: (options.life || .6)*(.7+.6*this._rand()),
                spin: (this._rand()-.5)*(options.spinMax || 4)
            });
        }
    }

    _ring(x,y,radius,tint='cyan',life=.52,layer='front') {
        if(!this._visible(x,y,this.viewport,radius+180))return;
        if (this.rings.length >= this.maxRings) this.rings.shift();
        this.rings.push({x,y,radius,life,age:0,tint,layer});
    }

    /** A soft local flash sits behind ships and terrain; no dynamic gradients. */
    _flash(x,y,size,tint='orange',life=.22) {
        if(this.quality<.35||this.particles.length>this.maxParticles*.9)return;
        this._emit('glow',x,y,{size,life,tint,alpha:.58,
            layer:'back',grow:1.1,additive:true});
    }

    /** Timed atlas frames, bounded independently of particles and light. */
    _explosion(x,y,radius,life=.48,layer='front',tint='orange',delay=0) {
        if(!this._visible(x,y,this.viewport,radius*1.3+170))return;
        if (!this.maxExplosions) return;
        if (this.explosions.length >= this.maxExplosions) this.explosions.shift();
        this.explosions.push({x,y,radius,life,age:-Math.max(0,delay),layer,tint});
    }

    /** Spacecraft destruction: expanding plasma, sparks, hull fragments, smoke. */
    shipExplosion(x,y,size=18,color='#7fdcff',boss=false) {
        // Far-away battles cannot evict the nearby explosions or hull debris.
        if(!this._visible(x,y,this.viewport,size*(boss?12:9)+180))return;
        const scale = boss ? 2.2 : 1;
        const tint = this._tint(color);
        if(boss){
            // Temporary silhouettes of separated hull sections after a capital
            // ship explodes. Visual only: never enters collision arrays.
            if(this.bossWrecks.length>=3)this.bossWrecks.shift();
            this.bossWrecks.push({x,y,size:Math.max(18,size),age:0,
                life:this.quality<.3?3.2:7.2,angle:this._rand()*TAU,
                seed:this._rand()*TAU,spin:this.quality<.3?0:.13});
        }
        const plasma=tint==='red'?'red':tint==='violet'?'violet':'cyan';
        this._explosion(x,y,size*(boss?8:5),boss?.68:.43,'front',plasma);
        this._flash(x,y,size*(boss?14:8),plasma,boss?.39:.22);
        this._emit('scorch',x,y,{size:size*5*scale,life:.36,tint:'orange',alpha:.78,priority:1});
        this._emit('flare',x,y,{size:size*6*scale,life:.20,tint:plasma,alpha:.95,priority:2});
        // Capital ships fail in separated sections, rather than one enlarged puff.
        if(boss&&this.quality>=.55)for(let i=0;i<2;i++){
            const a=this._rand()*TAU,offset=size*(.65+.4*this._rand());
            this._explosion(x+Math.cos(a)*offset,y+Math.sin(a)*offset,
                size*2.3,.34,'front',plasma,.15+i*.13);
        }
        this._scatter('flame',x,y,boss?16:7,{size:23*scale,life:.58,tint:'orange',minSpeed:20,maxSpeed:115*scale,grow:.15});
        this._scatter('smoke',x,y,boss?13:5,{size:38*scale,life:1.45,tint:'smoke',minSpeed:12,maxSpeed:70*scale,drag:1.8,grow:.4,layer:'back',additive:false,alpha:.55});
        this._scatter('star',x,y,boss?27:12,{size:13*scale,life:.6,tint,minSpeed:65,maxSpeed:265*scale,priority:1});
        this._scatter('shard',x,y,boss?24:9,{size:11*scale,life:1.05,tint,additive:false,minSpeed:55,maxSpeed:235*scale,drag:.9,priority:1});
        this._ring(x,y,size*(boss?9:5.5),tint,boss?.85:.56);
        // Recognizable torn hull plates remain briefly after the flash.
        // Capped separately from sparks; visual only, never collision geometry.
        if (!boss && this.quality>=.25) {
            const count=this.quality<.55?1:3;
            for(let i=0;i<count;i++){
                const a=(i+this._rand()*.35)*TAU/count;
                const speed=18+this._rand()*55;
                if(this.shipDebris.length>=30)this.shipDebris.shift();
                this.shipDebris.push({
                    x:x+Math.cos(a)*size*.22,y:y+Math.sin(a)*size*.22,
                    vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,
                    size:clamp(size*(.25+this._rand()*.16),6,26),
                    angle:this._rand()*TAU,spin:(this._rand()-.5)*3.2,
                    age:0,life:2.1+this._rand()*1.25,tint
                });
            }
        }
    }

    /** Hull impacts shed hot metal; no energy-shield ring is implied. */
    hullImpact(x,y,heavy=false,contact=null) {
        this.hit(x,y,heavy,false,contact);
        if(heavy)this._flash(x,y,65,'orange',.13);
        const direction=contact?.directed?{nx:contact.nx,ny:contact.ny,spread:Math.PI*.88}:{};
        this._scatter('shard',x,y,heavy?5:2,{
            size:heavy?14:8,life:.38,tint:'smoke',
            minSpeed:25,maxSpeed:100,additive:false,gravity:0,priority:1,
            ...direction
        });
    }

    /** A deflecting shield has a cool arc, distinct from red metal sparks. */
    shieldImpact(x,y,radius=44,contact=null) {
        // The whole shield pulse stays centered on the ship; only the contact
        // arc and sparks move to the side that actually absorbed the shot.
        const px=contact?.directed?contact.x:x,py=contact?.directed?contact.y:y;
        const direction=contact?.directed?{nx:contact.nx,ny:contact.ny,spread:Math.PI*.85}:{};
        this._ring(x,y,radius,'cyan',.34);
        this._flash(px,py,radius*2.4,'cyan',.15);
        this._emit('lightning',px,py,{
            size:radius*1.3,life:.17,tint:'cyan',alpha:.65,priority:2
        });
        this._scatter('star',px,py,2,{
            size:8,life:.2,tint:'cyan',minSpeed:15,maxSpeed:55,priority:1,
            ...direction
        });
    }

    /** A rock is porous matter, never a cyan shield. */
    coverImpact(x,y,radius=20,contact=null) {
        const direction=contact?.directed?{nx:contact.nx,ny:contact.ny,spread:Math.PI*.88}:{};
        this._emit('scorch',x,y,{
            size:Math.min(38,radius*.8),life:.22,tint:'smoke',
            alpha:.58,additive:false,priority:1
        });
        this._scatter('shard',x,y,3,{
            size:10,life:.33,tint:'smoke',minSpeed:28,
            maxSpeed:100,additive:false,priority:1,...direction
        });
        this._scatter('star',x,y,2,{
            size:7,life:.17,tint:'orange',minSpeed:20,maxSpeed:65,priority:1,...direction
        });
    }

    /** A compact missile detonation is visibly different from a laser hit. */
    rocketImpact(x,y,radius=24) {
        this._explosion(x,y,radius*2.1,.35,'front','orange');
        this._flash(x,y,radius*4.5,'orange',.19);
        this._ring(x,y,radius*1.2,'orange',.3);
        this._scatter('star',x,y,radius>15?6:3,{
            size:11,life:.32,tint:'orange',minSpeed:25,maxSpeed:120,priority:1
        });
        this._emit('smoke',x,y,{
            size:radius*1.8,life:.48,tint:'smoke',alpha:.55,
            layer:'back',additive:false,grow:.35
        });
    }

    /** Rock contacts throw dust and chips; rich-ore extraction may spark cyan. */
    asteroidImpact(x,y,radius=20,energetic=false,contact=null) {
        const direction=contact?.directed?{nx:contact.nx,ny:contact.ny,spread:Math.PI*.92}:{};
        this._emit('scorch',x,y,{size:radius*1.5,life:.2,tint:'smoke',alpha:.5,additive:false,priority:1});
        this._scatter('shard',x,y,4,{size:Math.min(13,radius*.32),life:.35,
            tint:'smoke',minSpeed:22,maxSpeed:95,additive:false,priority:1,...direction});
        this._scatter('star',x,y,energetic?3:1,{size:energetic?9:6,
            life:.2,tint:energetic?'cyan':'gold',minSpeed:20,maxSpeed:80,priority:1,
            ...direction});
        if(energetic)this._emit('lightning',x,y,{size:radius*1.5,life:.13,tint:'cyan',alpha:.45,priority:1});
    }
    asteroidBreak(x,y,radius=20) {
        // Broken mineral stays dusty: an orange fuel fireball makes rock look
        // combustible and incorrectly gives mining the weight of ship combat.
        this._emit('scorch',x,y,{size:radius*3.6,life:.29,tint:'smoke',alpha:.62,additive:false,priority:1});
        this._emit('burst',x,y,{size:radius*2.9,life:.22,tint:'smoke',alpha:.28,priority:1});
        this._scatter('shard',x,y,20,{size:radius*.52,life:1.2,tint:'smoke',minSpeed:50,maxSpeed:235,gravity:30,additive:false,priority:1});
        this._scatter('smoke',x,y,9,{size:radius*2.2,life:1.35,tint:'smoke',minSpeed:8,maxSpeed:85,layer:'back',grow:.55,additive:false,alpha:.68});
        this._scatter('star',x,y,6,{size:9,life:.35,tint:'gold',minSpeed:45,maxSpeed:150});
    }

    /** Directed weapon contact (cheap enough for frequent small hits). */
    hit(x,y,critical=false,shield=false,contact=null) {
        const tint = shield ? 'cyan' : critical ? 'gold' : 'red';
        const direction=contact?.directed?{nx:contact.nx,ny:contact.ny,spread:Math.PI*.92}:{};
        this._emit('star',x,y,{size:critical?46:22,life:critical?.3:.17,tint,priority:critical?2:1});
        if (critical) this._emit('lightning',x,y,{size:75,life:.3,tint:'gold',alpha:.8,priority:2});
        this._scatter('star',x,y,critical?10:3,{
            size:critical?16:9,life:.29,tint,minSpeed:35,maxSpeed:140,priority:1,
            ...direction
        });
    }

    /** Heavy orbital and meteor strike: fireball, expanding shock and dusty tail. */
    meteorStrike(x,y,radius=70,locked=false) {
        const tint = locked ? 'red' : 'orange';
        this._explosion(x,y,radius*2.1,.6,'front',locked?'red':'orange');
        this._flash(x,y,radius*4.2,tint,.31);
        this._emit('scorch',x,y,{size:radius*2.5,life:.56,tint,alpha:.95,priority:1});
        this._emit('flare',x,y,{size:radius*3.2,life:.21,tint:'gold',priority:2});
        this._scatter('flame',x,y,14,{size:radius*.78,life:.65,tint,minSpeed:30,maxSpeed:240,originRadius:radius*.3});
        this._scatter('smoke',x,y,13,{size:radius*.9,life:1.55,tint:'smoke',minSpeed:12,maxSpeed:165,layer:'back',grow:.6,additive:false,alpha:.65});
        this._scatter('shard',x,y,18,{size:14,life:.9,tint:'orange',minSpeed:80,maxSpeed:310,additive:false,priority:1});
        this._ring(x,y,radius*1.6,tint,.67);
    }

    /** Visible propulsion that respects the ship's facing and game-time. */
    engineTrail(x,y,angle,ship='fighter',boosted=false,dt=.016) {
        this.thrusterClock += dt;
        const interval = boosted ? .036 : .075;
        if (this.thrusterClock < interval) return;
        this.thrusterClock %= interval;
        const tint = boosted?'gold':ship==='scout'?'orange':ship==='mage'?'green':'cyan';
        // Ship sprite nose is local up, angle is atan2(vy,vx)+PI/2.
        // Exhaust sits behind the nose, along the opposite travel vector.
        const a = angle + Math.PI/2;
        const bx = x + Math.cos(a)*20, by = y + Math.sin(a)*20;
        const side = (this._rand()-.5)*12;
        this._emit('flame',bx+Math.sin(a)*side,by-Math.cos(a)*side,{
            size:boosted?29:20,life:boosted?.41:.27,tint,
            vx:Math.cos(a)*(75+this._rand()*35),vy:Math.sin(a)*(75+this._rand()*35),
            angle:a+Math.PI/2,spin:1,drag:1.4,layer:'back'
        });
        if(this._rand()<.48) this._emit('glow',bx,by,{
            size:boosted?19:11,life:.3,tint,layer:'back',alpha:.65});
    }

    muzzle(x,y,angle,weapon='starter_pulse') {
        const heavy=['knife','railgun','drone_swarm'].includes(weapon);
        const tint=weapon==='knife'?'orange':weapon==='railgun'?'gold':'cyan';
        const fx=x+Math.cos(angle)*22, fy=y+Math.sin(angle)*22;
        this._emit('muzzle',fx,fy,{
            size:heavy?38:23,life:.16,tint,
            angle:angle+Math.PI/2,alpha:.8,priority:1
        });
        if(heavy)this._flash(fx,fy,46,tint,.10);
        this._scatter('star',fx,fy,heavy?4:2,{size:7,life:.2,tint,minSpeed:12,maxSpeed:75});
    }

    meleeSweep(x,y,angle=0,range=95) {
        this._emit('slash',x+Math.cos(angle)*range*.3,y+Math.sin(angle)*range*.3,{
            size:range*2.1,life:.24,tint:'cyan',angle:angle-.5,alpha:.7
        });
        this._ring(x,y,range*.9,'cyan',.28);
    }

    nova(x,y,range=180,tint='cyan') {
        this._emit('burst',x,y,{size:range*.9,life:.5,tint,alpha:.65});
        this._flash(x,y,range*2.8,tint,.27);
        this._ring(x,y,range,tint,.65);
        this._scatter('star',x,y,16,{size:13,life:.5,tint,minSpeed:range*.5,maxSpeed:range*1.6});
    }

    bossPortal(x,y,scale=30) {
        this._emit('burst',x,y,{size:scale*6.2,life:.85,tint:'violet',alpha:.85,layer:'back',spin:3});
        this._flash(x,y,scale*6,'violet',.45);
        this._emit('flare',x,y,{size:scale*4.1,life:.48,tint:'red'});
        this._scatter('star',x,y,22,{size:14,life:.9,tint:'violet',minSpeed:50,maxSpeed:210});
        this._ring(x,y,scale*4,'violet',1.0,'back');
    }

    boostDrop(x,y,tint='cyan') {
        this._emit('burst',x,y,{size:88,life:.7,tint,alpha:.8,layer:'back'});
        this._scatter('star',x,y,11,{size:13,life:.7,tint,minSpeed:30,maxSpeed:130});
        this._ring(x,y,64,tint,.65);
    }

    boostCollect(x,y,tint='cyan') {
        this._emit('flare',x,y,{size:100,life:.3,tint,priority:2});
        this._scatter('star',x,y,17,{size:17,life:.65,tint,minSpeed:50,maxSpeed:185});
        this._ring(x,y,120,tint,.67);
    }

    playerHurt(x,y,shield=false) {
        this.hit(x,y,true,shield);
        this._ring(x,y,shield?67:86,shield?'cyan':'red',.48);
    }

    arcadePlayerHurt(x,y,shield=false,hullAlso=false,contact=null) {
        if(shield)this.shieldImpact(x,y,67,contact);
        if(!shield||hullAlso){
            const px=contact?.directed?contact.x:x,py=contact?.directed?contact.y:y;
            this.hullImpact(px,py,true,contact);
            this._ring(x,y,86,'red',.48);
        }
    }

    _tint(hex) {
        if (!hex || hex[0] !== '#' || hex.length < 7) return 'cyan';
        const r=parseInt(hex.slice(1,3),16)||0;
        const g=parseInt(hex.slice(3,5),16)||0;
        const b=parseInt(hex.slice(5,7),16)||0;
        if (r>g*1.3&&r>b*1.2) return 'red';
        if (g>r*1.22&&g>b*.75) return 'green';
        if (r>b*.7&&b>g*1.25) return 'violet';
        return 'cyan';
    }

    update(dt) {
        this.clock += dt;
        for(let i=this.particles.length-1;i>=0;i--) {
            const p=this.particles[i];
            p.age+=dt;
            if(p.age>=p.life) {
                this.pool.push(p);
                this.particles.splice(i,1);
                continue;
            }
            p.x+=p.vx*dt; p.y+=p.vy*dt;
            p.vx*=Math.exp(-p.drag*dt); p.vy*=Math.exp(-p.drag*dt);
            p.vy+=p.gravity*dt;
            p.angle+=p.spin*dt;
        }
        for(let i=this.explosions.length-1;i>=0;i--) {
            this.explosions[i].age+=dt;
            if(this.explosions[i].age>=this.explosions[i].life) this.explosions.splice(i,1);
        }
        for(let i=this.bossWrecks.length-1;i>=0;i--){
            const w=this.bossWrecks[i];w.age+=dt;
            if(w.age>=w.life)this.bossWrecks.splice(i,1);
        }
        for(let i=this.shipDebris.length-1;i>=0;i--){
            const part=this.shipDebris[i];part.age+=dt;
            if(part.age>=part.life){this.shipDebris.splice(i,1);continue;}
            part.x+=part.vx*dt;part.y+=part.vy*dt;
            const drag=Math.exp(-1.05*dt);
            part.vx*=drag;part.vy*=drag;part.angle+=part.spin*dt;
        }
        for(let i=this.rings.length-1;i>=0;i--) {
            this.rings[i].age+=dt;
            if(this.rings[i].age>=this.rings[i].life) this.rings.splice(i,1);
        }
    }

    _visible(x,y,camera,pad=170) {
        if(!camera) return true;
        return x>=camera.worldX-pad&&x<=camera.worldX+camera.width+pad &&
            y>=camera.worldY-pad&&y<=camera.worldY+camera.height+pad;
    }

    render(ctx,layer='front',camera=null) {
        if(!ctx) return;
        ctx.save();
        if(layer==='back')for(const part of this.shipDebris){
            if(!this._visible(part.x,part.y,camera,part.size*2))continue;
            const fade=clamp((part.life-part.age)/.8,0,1);
            const r=part.size;
            ctx.save();ctx.translate(part.x,part.y);ctx.rotate(part.angle);
            ctx.globalAlpha=.83*fade;
            ctx.fillStyle='#25303d';
            ctx.strokeStyle=part.tint==='red'?'#bc7165':'#78a9b4';
            ctx.lineWidth=Math.max(.8,r*.075);
            ctx.beginPath();ctx.moveTo(-r*.63,-r*.28);
            ctx.lineTo(r*.4,-r*.48);ctx.lineTo(r*.66,r*.2);
            ctx.lineTo(-r*.25,r*.51);ctx.closePath();ctx.fill();ctx.stroke();
            ctx.strokeStyle='#7c8690';ctx.lineWidth=.8;
            ctx.beginPath();ctx.moveTo(-r*.25,-r*.2);
            ctx.lineTo(r*.08,r*.05);ctx.lineTo(-r*.04,r*.32);ctx.stroke();
            if(part.age<.7){
                ctx.globalAlpha=(1-part.age/.7)*.76;
                ctx.fillStyle='#ffaf68';ctx.fillRect(-r*.1,-r*.12,r*.24,r*.2);
            }
            ctx.restore();
        }
        if(layer==='back')for(const w of this.bossWrecks){
            if(!this._visible(w.x,w.y,camera,w.size*5))continue;
            const life=clamp(1-w.age/w.life,0,1);
            const scale=Math.max(24,w.size*2.1);
            ctx.save();
            ctx.globalAlpha=Math.min(.57,life*.57);
            for(let i=0;i<4;i++){
                const a=w.angle+i*TAU/4;
                const travel=Math.min(w.age,4)*w.size*.37;
                const x=w.x+Math.cos(a)*(w.size*.5+travel);
                const y=w.y+Math.sin(a)*(w.size*.5+travel);
                ctx.save();ctx.translate(x,y);
                ctx.rotate(a+w.age*(i%2?-w.spin:w.spin));
                const part=[STATION_PARTS.wing,STATION_PARTS.bridge,
                    STATION_PARTS.large,STATION_PARTS.cross][i];
                if(!drawStationPart(ctx,part,0,0,scale*(i<2?.8:.62),0,1)){
                    ctx.fillStyle='#52667b';ctx.strokeStyle='#95b0c5';
                    ctx.lineWidth=2;ctx.beginPath();
                    ctx.moveTo(-scale*.26,0);ctx.lineTo(scale*.2,-scale*.2);
                    ctx.lineTo(scale*.23,scale*.18);ctx.closePath();
                    ctx.fill();ctx.stroke();
                }
                ctx.restore();
            }
            ctx.restore();
        }
        // Blend in groups, never leave canvas state changed for game sprites.
        for(const additive of [false,true]) {
            ctx.globalCompositeOperation=additive?'lighter':'source-over';
            for(const p of this.particles) {
                if(p.layer!==layer||p.additive!==additive||!this._visible(p.x,p.y,camera))continue;
                const left=clamp(1-p.age/p.life,0,1);
                const size=p.size*(1+p.grow*p.age);
                ctx.save();
                ctx.globalAlpha=clamp(p.alpha*left*(p.kind==='smoke'?.9:1),0,1);
                ctx.translate(p.x,p.y);
                ctx.rotate(p.angle);
                if(p.kind==='shard') {
                    ctx.fillStyle=FX_COLORS[p.tint]||FX_COLORS.smoke;
                    ctx.beginPath();ctx.moveTo(size*.5,0);ctx.lineTo(-size*.4,-size*.28);
                    ctx.lineTo(-size*.25,size*.38);ctx.closePath();ctx.fill();
                    ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=.8;ctx.stroke();
                } else {
                    const sprite=getFXSprite(p.kind,p.tint);
                    if(sprite) ctx.drawImage(sprite,-size/2,-size/2,size,size);
                    else {
                        // Offline/slow-image fallback with identical timing.
                        ctx.fillStyle=FX_COLORS[p.tint]||FX_COLORS.cyan;
                        ctx.beginPath();ctx.arc(0,0,size*(p.kind==='smoke'?.22:.14),0,TAU);ctx.fill();
                    }
                }
                ctx.restore();
            }
        }
        ctx.globalCompositeOperation='lighter';
        for(const ring of this.rings) {
            if(ring.layer!==layer||!this._visible(ring.x,ring.y,camera,250)) continue;
            const progress=clamp(ring.age/ring.life,0,1);
            const radius=8+ring.radius*(1-Math.pow(1-progress,2));
            ctx.save();ctx.translate(ring.x,ring.y);
            ctx.globalAlpha=(1-progress)*.7;
            const sprite=getFXSprite('burst',ring.tint);
            if(sprite) ctx.drawImage(sprite,-radius,-radius,radius*2,radius*2);
            ctx.strokeStyle=FX_COLORS[ring.tint]||FX_COLORS.cyan;
            ctx.lineWidth=2.8*(1-progress)+.6;
            ctx.beginPath();ctx.arc(0,0,radius,0,TAU);ctx.stroke();
            ctx.restore();
        }
        // Animated impact core complements the existing procedural shockwave.
        // If frames are missing, normal particles and rings remain visible.
        ctx.globalCompositeOperation='lighter';
        for(const blast of this.explosions){
            if(blast.layer!==layer||!this._visible(blast.x,blast.y,camera,blast.radius))continue;
            if(blast.age<0)continue;
            const progress=clamp(blast.age/blast.life,0,1);
            const atlas=getBlastAtlas(blast.tint);
            if(!atlas)continue;
            const frame=Math.min(BLAST_FRAMES-1,Math.floor(progress*BLAST_FRAMES));
            const radius=blast.radius*(.65+.52*progress);
            ctx.save();
            ctx.globalAlpha=.9;
            ctx.drawImage(atlas,frame*BLAST_CELL,0,BLAST_CELL,BLAST_CELL,
                blast.x-radius,blast.y-radius,radius*2,radius*2);
            ctx.restore();
        }
        ctx.restore();
    }

    diagnostics() {
        return {particles:this.particles.length,max:this.maxParticles,
            rings:this.rings.length,explosions:this.explosions.length,
            debris:this.shipDebris.length,capitalWrecks:this.bossWrecks.length,
            critical:this.particles.filter(p=>p.priority===2).length,
            combat:this.particles.filter(p=>p.priority===1).length,
            quality:this.quality,assets:getFXLoadStatus(),combatArt:getCombatArtStatus()};
    }
}
