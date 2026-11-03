/**
 * Kenney Space Shooter Extension (CC0) — compact local atlas.
 * 5 columns x 4 rows, 128px cells; nine ships, four missiles, four effects.
 * The game works with its existing vector art if the image is unavailable.
 */
const CELL=128,COLS=5;
let image=null,ready=false;
if(typeof Image!=='undefined') {
    image=new Image();
    image.decoding='async';
    image.onload=()=>{ready=true;};
    image.onerror=()=>{ready=false;};
    image.src=new URL('../assets/space/kenney-ship-atlas.webp',import.meta.url).href;
}
const SHIPS={
    bat:0,zombie:6,skeleton:1,stalker:4,wolf:7,
    golem:8,ghost:5,mage:3,slime:2,slimeling:1,
    bomber:3,sniper:2,illusionist:5,
    raid_bomber:5,raid_escort:4,siege_mite:2
};
const HUES={
    bat:213,zombie:94,skeleton:187,stalker:287,wolf:8,
    golem:35,ghost:165,mage:305,slime:114,slimeling:92,
    bomber:0,sniper:201,illusionist:259,
    raid_bomber:0,raid_escort:17,siege_mite:44
};
function drawCell(ctx,index,x,y,w,h){
    if(!ready || !image?.naturalWidth)return false;
    ctx.drawImage(image,(index%COLS)*CELL,Math.floor(index/COLS)*CELL,
        CELL,CELL,x,y,w,h);
    return true;
}
export function drawCombatShip(ctx,id,x,y,size,angle=0){
    if(!ready || !Object.prototype.hasOwnProperty.call(SHIPS,id))return false;
    const scale=id==='raid_bomber'?2.72:id==='raid_escort'?2.45:2.42;
    const w=size*scale;
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(angle);
    const inherited=ctx.filter && ctx.filter!=='none'?ctx.filter+' ':'';
    ctx.filter=inherited+'hue-rotate('+HUES[id]+'deg) saturate(1.12)';
    if(id.startsWith('raid_')){ctx.shadowColor='#ff6a4e';ctx.shadowBlur=9;}
    drawCell(ctx,SHIPS[id],-w/2,-w/2,w,w);
    ctx.restore();
    return true;
}
export function drawCombatMissile(ctx,level=1) {
    if(!ready)return false;
    const index=9+(level>=5?3:level>=3?2:level>=2?1:0);
    ctx.save();
    ctx.rotate(Math.PI/2);
    ctx.shadowColor='#ffae69';ctx.shadowBlur=8;
    drawCell(ctx,index,-17,-20,34,40);
    ctx.restore();
    return true;
}
export function drawCombatImpact(ctx,x,y,size=55,opacity=1,kind=0) {
    if(!ready)return false;
    ctx.save();
    ctx.globalAlpha=Math.max(0,Math.min(1,opacity));
    ctx.globalCompositeOperation='lighter';
    ctx.filter='sepia(1) saturate(6) hue-rotate(330deg) brightness(1.5)';
    const d=size*(1.08+(1-opacity)*.35);
    drawCell(ctx,13+(kind%4),x-d/2,y-d/2,d,d);
    ctx.restore();
    return true;
}
