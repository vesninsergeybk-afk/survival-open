import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const moduleText=readFileSync(new URL('../src/turret-visuals.js',import.meta.url),'utf8');
const {turretPalette,drawTurretMount,drawTurretHead}=
    await import('data:text/javascript,'+encodeURIComponent(moduleText));

function mockCanvas() {
    const tally=Object.create(null);
    let depth=0;
    const canvas=new Proxy({},{
        get(_obj,key) {
            return (...args)=>{
                for(const value of args)
                    assert.ok(Number.isFinite(value),
                        'Canvas '+String(key)+' received non-finite coordinate');
                tally[key]=(tally[key]||0)+1;
                if(key==='save')depth++;
                if(key==='restore'){
                    depth--;
                    assert.ok(depth>=0,'No unmatched Canvas restore');
                }
            };
        },
        set(){return true;}
    });
    return {canvas,tally,balanced:()=>depth===0};
}
const variants=['basic','arc','missile','rail'];
assert.equal(turretPalette('unexpected'),turretPalette('basic'));
for(const path of variants){
    for(let level=1;level<=5;level++){
        const {canvas,tally,balanced}=mockCanvas();
        const turret={path:path==='basic'?null:path,level,mount:3,
            cooldown:.4,aimAngle:Math.PI-.02,tracked:{hp:50},
            overheat:0,heat:20};
        drawTurretMount(canvas,turret,105,75,.75);
        drawTurretHead(canvas,turret,104,75,Math.PI-.02,.75);
        assert.ok(balanced(),path+' level '+level+' balances save/restore');
        assert.ok(tally.fill>2 && tally.stroke>3,'Visible layered geometry exists');
        if(level===5)assert.ok(tally.ellipse>=1,'Elite collar is visible');
        turret.overheat=3;
        const overheat=mockCanvas();
        drawTurretHead(overheat.canvas,turret,104,75,-Math.PI+.02,1.2);
        assert.ok(overheat.balanced(),'Overheat render keeps Canvas state balanced');
    }
}
const base=mockCanvas(),missile=mockCanvas(),rail=mockCanvas(),arc=mockCanvas();
for(const [ctx,path] of [[base,'basic'],[missile,'missile'],[rail,'rail'],[arc,'arc']])
    drawTurretHead(ctx.canvas,{level:3,path,mount:2,cooldown:.6,overheat:0},
        0,0,0,2);
assert.ok(missile.tally.arc>base.tally.arc,'Missile pods have extra nozzle geometry');
assert.ok(rail.tally.lineTo>base.tally.lineTo,'Railgun has magnetic guide geometry');
assert.ok(arc.tally.arc>base.tally.arc,'Electric turret has emitter orbs');
console.log('Turret visuals: all 4 types x 5 ranks, overheat, geometry and Canvas state passed');
