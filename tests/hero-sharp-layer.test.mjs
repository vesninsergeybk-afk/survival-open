import test from 'node:test';
import assert from 'node:assert/strict';
import {HeroSharpLayer} from '../src/hero-sharp-layer.js';

function fakeLayer() {
    const calls=[];
    const ctx={
        setTransform(...args){calls.push(['transform',...args]);},
        clearRect(...args){calls.push(['clear',...args]);},
        translate(...args){calls.push(['translate',...args]);}
    };
    const canvas={width:1,height:1,style:{},setAttribute(){},
        getContext(type,options){
            assert.equal(type,'2d');
            assert.equal(options.alpha,true);
            return ctx;
        }};
    const root={appendChild(value){assert.equal(value,canvas);}};
    return {calls,canvas,ctx,root};
}

test('ship alone retains a small native-resolution target during world downscaling',()=>{
    const oldDocument=globalThis.document;
    const fake=fakeLayer();
    globalThis.document={createElement(tag){
        assert.equal(tag,'canvas');return fake.canvas;
    }};
    try {
        const layer=new HeroSharpLayer({parentElement:fake.root});
        assert.ok(layer.available);
        const player={x:1200,y:300,size:22};
        const camera={worldX:1000,worldY:100,x:2,y:-3};
        let renders=0;
        const options={player,camera,logicalWidth:1200,logicalHeight:800,
            cssWidth:1200,cssHeight:800,devicePixelRatio:2,
            paint(ctx){assert.equal(ctx,fake.ctx);renders++;}};
        assert.equal(layer.draw(options),true);
        assert.equal(renders,1);
        assert.equal(fake.canvas.width,209);
        assert.equal(fake.canvas.height,209);
        assert.equal(fake.canvas.style.width,'139px');
        assert.equal(fake.canvas.style.height,'139px');
        assert.equal(fake.canvas.style.transform,'translate3d(132.5px,127.5px,0)');
        assert.match(fake.canvas.style.cssText,/image-rendering:auto/);
        assert.match(fake.canvas.style.cssText,/pointer-events:none/);
        assert.ok(fake.calls.some(x=>x[0]==='clear'&&x[3]===209),
            'transparent ship backing must be cleared every animation frame');
        // Moving the ship should not reallocate its backing bitmap.
        const width=fake.canvas.width;
        assert.equal(layer.draw({...options,player:{...player,x:1300}}),true);
        assert.equal(fake.canvas.width,width);
        assert.equal(renders,2);
        assert.equal(fake.canvas.style.transform,'translate3d(232.5px,127.5px,0)');
        layer.hide();
        assert.equal(fake.canvas.style.display,'none');
    } finally {
        if(oldDocument===undefined)delete globalThis.document;
        else globalThis.document=oldDocument;
    }
});

test('ship rendering failure falls back to ordinary canvas drawing',()=>{
    const oldDocument=globalThis.document;
    const fake=fakeLayer();
    globalThis.document={createElement:()=>fake.canvas};
    try {
        const layer=new HeroSharpLayer({parentElement:fake.root});
        assert.equal(layer.draw({player:{x:100,y:100,size:22},
            camera:{worldX:0,worldY:0,x:0,y:0},
            logicalWidth:1200,logicalHeight:800,cssWidth:1200,cssHeight:800,
            paint(){throw new Error('art unavailable');}}),false);
        assert.equal(fake.canvas.style.display,'none');
        assert.equal(layer.available,true);
    } finally {
        if(oldDocument===undefined)delete globalThis.document;
        else globalThis.document=oldDocument;
    }
});

test('headless execution does not create an extra canvas',()=>{
    const oldDocument=globalThis.document;
    delete globalThis.document;
    try {
        const layer=new HeroSharpLayer({parentElement:{}});
        assert.equal(layer.available,false);
        assert.equal(layer.draw({}),false);
    } finally {
        if(oldDocument!==undefined)globalThis.document=oldDocument;
    }
});
