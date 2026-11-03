/**
 * A small, full-resolution transparent canvas for the protagonist.
 * Only the ship hull/glow is painted here. The world keeps its adaptive
 * backing resolution, so raising ship fidelity does not restore the cost of
 * rasterising the entire station at native resolution.
 */
export class HeroSharpLayer {
    constructor(sourceCanvas) {
        this.canvas=null;
        this.ctx=null;
        if(typeof document==='undefined'||!sourceCanvas?.parentElement)return;
        const canvas=document.createElement('canvas');
        canvas.className='survivor-hero-layer';
        canvas.setAttribute('aria-hidden','true');
        // The UI remains above this layer; WebGL scenery remains below it.
        // Crucially, do not inherit the global pixel-art canvas interpolation.
        canvas.style.cssText='position:absolute;left:0;top:0;width:1px;height:1px;'+
            'display:none;border:0;background:transparent;image-rendering:auto;'+
            'pointer-events:none;z-index:1;will-change:transform;';
        const ctx=canvas.getContext('2d',{alpha:true});
        if(!ctx)return;
        sourceCanvas.parentElement.appendChild(canvas);
        this.canvas=canvas;
        this.ctx=ctx;
        this.cssWidth=0;
        this.cssHeight=0;
    }

    get available(){return !!this.ctx;}

    hide(){
        if(this.canvas&&this.canvas.style.display!=='none')
            this.canvas.style.display='none';
    }

    draw({player,camera,logicalWidth,logicalHeight,cssWidth,cssHeight,devicePixelRatio=1,paint}={}){
        if(!this.ctx||!player||!camera||typeof paint!=='function'||
            !(logicalWidth>0&&logicalHeight>0&&cssWidth>0&&cssHeight>0)){
            this.hide();
            return false;
        }
        const logicalSize=Math.ceil(Math.max(128,(player.size||20)*6.3));
        const scaleX=cssWidth/logicalWidth,scaleY=cssHeight/logicalHeight;
        const width=logicalSize*scaleX,height=logicalSize*scaleY;
        // The ship alone is typically less than 160 × 160 world units.
        // Cap its backing density; a high-DPI monitor must not grow this
        // into another full-viewport render target.
        const density=Math.min(1.5,Math.max(1,devicePixelRatio||1));
        const pixelsX=Math.max(1,Math.min(512,Math.ceil(width*density)));
        const pixelsY=Math.max(1,Math.min(512,Math.ceil(height*density)));
        const canvas=this.canvas,ctx=this.ctx;
        if(canvas.width!==pixelsX)canvas.width=pixelsX;
        if(canvas.height!==pixelsY)canvas.height=pixelsY;
        if(this.cssWidth!==width||this.cssHeight!==height){
            canvas.style.width=width+'px';
            canvas.style.height=height+'px';
            this.cssWidth=width;this.cssHeight=height;
        }
        const screenX=(player.x-camera.worldX+camera.x)*scaleX;
        const screenY=(player.y-camera.worldY+camera.y)*scaleY;
        canvas.style.transform='translate3d('+(screenX-width/2)+'px,'+
            (screenY-height/2)+'px,0)';
        try {
            ctx.setTransform(1,0,0,1,0,0);
            ctx.clearRect(0,0,pixelsX,pixelsY);
            ctx.setTransform(pixelsX/logicalSize,0,0,pixelsY/logicalSize,0,0);
            ctx.translate(logicalSize/2-player.x,logicalSize/2-player.y);
            paint(ctx);
            ctx.setTransform(1,0,0,1,0,0);
            canvas.style.display='block';
            return true;
        }catch(error){
            ctx.setTransform(1,0,0,1,0,0);
            this.hide();
            return false;
        }
    }
}
