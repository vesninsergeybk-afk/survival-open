import test from 'node:test';
import assert from 'node:assert/strict';

// Mimic a slow mobile decoder: the walk atlas is requested but not yet ready.
// The scout must retain its own idle drawing until the walk sheet is decoded.
test('SPAC-1 never swaps to another robot during atlas decode',async()=>{
    const oldImage=globalThis.Image;
    const requested=[];
    class StubImage {
        constructor(){this.naturalWidth=1280;}
        set src(value){this._src=value;requested.push(value);this.onload?.();}
        get src(){return this._src;}
        decode(){
            return this._src.endsWith('/walk.webp')
                ?new Promise(()=>{}):Promise.resolve();
        }
    }
    globalThis.Image=StubImage;
    try {
        const {warmSpac1,drawSpac1Robot}=await import('../src/spac1-sprites.js?decode-test=1');
        warmSpac1();
        await Promise.resolve();
        assert.ok(requested.some(u=>u.endsWith('/idle.webp')));
        assert.ok(requested.some(u=>u.endsWith('/walk.webp')));
        assert.ok(requested.some(u=>u.endsWith('/attack.webp')),
            'combat sheet is prefetched, not decoded during the first shot');
        const calls=[];
        const ctx={
            globalAlpha:1,save(){},restore(){},translate(){},beginPath(){},
            ellipse(){},fill(){},fillRect(){},
            drawImage(image){calls.push(image.src.split('/').pop());}
        };
        const enemy={x:0,y:0,hp:70,maxHp:70,prologueGroup:'security',
            visualAngle:0,ranged:true,aimTimer:0,fireTimer:0};
        assert.equal(drawSpac1Robot(ctx,enemy,0),true);
        enemy.prologueTravel=20;
        assert.equal(drawSpac1Robot(ctx,enemy,.1),true,
            'while walking, the decoder delay must not expose the Kenney fallback');
        enemy.aimTimer=.4;enemy.aimTotal=.4;
        assert.equal(drawSpac1Robot(ctx,enemy,.2),true);
        assert.deepEqual(calls,['idle.webp','idle.webp','idle.webp'],
            'aiming during movement cannot interrupt the walk (idle is used only until atlas decode)');
        // When movement really ceases, the unmodified attack atlas takes over.
        enemy.prologueTravel=0;
        assert.equal(drawSpac1Robot(ctx,enemy,.5),true);
        assert.deepEqual(calls,['idle.webp','idle.webp','idle.webp','attack.webp'],
            'the approved original attack art is used once the robot stops');
    } finally {
        if(oldImage===undefined)delete globalThis.Image;
        else globalThis.Image=oldImage;
    }
});
