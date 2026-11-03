/** Visual quality only. Enemy population, damage, timings and AI stay unchanged. */
const MODES = new Set(['auto', '3d', '2d']);
export class RenderBudget {
    constructor({mode='auto',mobile=false,devicePixelRatio=1}={}) {
        this.mobile=!!mobile;
        this.devicePixelRatio=Math.max(1,Number(devicePixelRatio)||1);
        this.mode=MODES.has(mode)?mode:'auto';
        this.reset();
    }
    reset() {
        this.level=0;this.crowd=0;this.slowMs=0;this.fastMs=0;this.cooldownMs=0;
        this.frameMs=16.7;this.workMs=0;this.samples=0;this._key='';
    }
    setMode(mode) {this.mode=MODES.has(mode)?mode:'auto';this.reset();}
    setDevice(mobile,ratio=this.devicePixelRatio) {
        if(this.mobile!==!!mobile||this.devicePixelRatio!==ratio)this._key='';
        this.mobile=!!mobile;this.devicePixelRatio=Math.max(1,Number(ratio)||1);
    }
    sample(frameMs,workMs=0) {
        if(!Number.isFinite(frameMs)||frameMs<=0)return;
        // Cap isolated resume gaps, but still detect repeated GPU stalls even
        // when submitting commands on the CPU takes little time.
        const dt=Math.min(100,frameMs),work=Math.max(0,Math.min(200,workMs||0));
        this.samples++;
        this.frameMs+=(dt-this.frameMs)*.08;
        this.workMs+=(work-this.workMs)*.08;
        this.cooldownMs=Math.max(0,this.cooldownMs-dt);
        // CPU submission time also catches slow canvases on 120 Hz screens.
        const slow=this.frameMs>25||this.workMs>17;
        const fast=this.frameMs<19&&this.workMs<12;
        this.slowMs=slow?this.slowMs+dt:Math.max(0,this.slowMs-dt*2);
        this.fastMs=fast?this.fastMs+dt:0;
        // A sustained 120ms+ frame is already visibly broken. Begin
        // adapting after a handful of samples instead of waiting for twenty
        // frames (which can take ten real seconds on a software renderer).
        const severe=frameMs>110||workMs>65;
        if(this.cooldownMs>0||this.samples<(severe?6:20))return;
        if(this.slowMs>700&&this.level<3){
            this.level++;this.slowMs=0;this.fastMs=0;
            this.cooldownMs=severe?900:2500;this._key='';
        }else if(this.fastMs>10000&&this.level>0){
            this.level--;this.fastMs=0;this.slowMs=0;this.cooldownMs=7000;this._key='';
        }
    }
    plan(population=0) {
        // Hysteresis prevents models flickering when a wave crosses a boundary.
        const count=Math.max(0,Number(population)||0);
        if(count>=100)this.crowd=2;
        else if(this.crowd===2&&count<75)this.crowd=count>=40?1:0;
        else if(this.crowd===0&&count>=48)this.crowd=1;
        else if(this.crowd===1&&count<32)this.crowd=0;
        const level=Math.max(this.level,this.crowd);
        const key=[this.mode,this.mobile,level,this.devicePixelRatio].join('|');
        if(key===this._key)return this._plan;
        this._key=key;
        // "3d" selects the renderer; it must not disable performance protection.
        // At 1080p an antialiased 1.6x transparent WebGL overlay occupied more
        // than five million pixels before the first enemy even appeared.
        const prefer3D=this.mode==='3d',flat=this.mode==='2d';
        const maxPixel=this.mobile?[1,.9,.8,.7][level]:[1.1,.95,.85,.75][level];
        const enemyModels=flat?0:prefer3D?
            (this.mobile?[4,3,2,1]:[12,8,5,3])[level]:
            (this.mobile?[2,1,1,1]:[8,5,3,2])[level];
        this._plan=Object.freeze({mode:this.mode,level,mobile:this.mobile,
            pixelRatio:Math.min(this.devicePixelRatio,maxPixel),
            // Most prologue art is Canvas2D. Budgeting only WebGL left the
            // actual sprite layer at full resolution throughout a stall.
            canvasRatio:[1,.85,.72,.60][level],
            enemyModels,
            bossModels:flat?0:(this.mobile?[1,1,1,1]:[2,2,1,1])[level],
            missileModels:flat?0:prefer3D?(this.mobile?[4,3,2,0]:[6,4,2,0])[level]:0,
            turretModels:flat?0:(this.mobile?[5,4,3,2]:[8,6,4,2])[level],
            sceneryModels:flat?0:(this.mobile?[5,3,2,1]:[8,6,4,2])[level],
            enemyGlow:prefer3D&&level===0,
            vfxScale:[1,.75,.5,.35][level]
        });
        return this._plan;
    }
    status() {return {mode:this.mode,level:this.level,crowd:this.crowd,frameMs:+this.frameMs.toFixed(1),workMs:+this.workMs.toFixed(1)};}
}

export function inCamera(entity,camera,width,height,padding=60) {
    const size=Math.max(0,Number(entity.size)||0)+padding;
    return entity.x+size>=camera.worldX && entity.x-size<=camera.worldX+width &&
        entity.y+size>=camera.worldY && entity.y-size<=camera.worldY+height;
}

