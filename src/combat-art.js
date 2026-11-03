/**
 * Kenney Space Shooter Remastered (CC0) — local combat imagery.
 * https://kenney.nl/assets/space-shooter-remastered
 * Hitboxes and weapon physics do not depend on sprite availability.
 */
const FILES = Object.freeze({
    laserBlue01:'lasers/laserBlue01.png',
    laserBlue10:'lasers/laserBlue10.png',
    laserBlue16:'lasers/laserBlue16.png',
    laserGreen01:'lasers/laserGreen01.png',
    laserGreen10:'lasers/laserGreen10.png',
    laserRed01:'lasers/laserRed01.png',
    laserRed10:'lasers/laserRed10.png',
    laserRed16:'lasers/laserRed16.png',
    ...Object.fromEntries(Array.from({length:10},(_,i)=>{
        const key='fire'+String(i).padStart(2,'0');
        return [key,'explosions/'+key+'.png'];
    })),
    shield1:'shields/shield1.png',
    shield2:'shields/shield2.png',
    shield3:'shields/shield3.png'
});
const loaded=new Map();
if(typeof Image!=='undefined'){
    for(const [key,file] of Object.entries(FILES)){
        const image=new Image();
        image.decoding='async';
        image.onload=()=>{if(image.naturalWidth)loaded.set(key,image);};
        image.onerror=()=>{}; // Existing vector fallback stays playable.
        image.src=new URL('../assets/upgrade/'+file,import.meta.url).href;
    }
}
function drawLongAxis(ctx,img,length,width){
    if(!img?.naturalWidth)return false;
    ctx.save();
    const tall=img.naturalHeight>img.naturalWidth;
    if(tall)ctx.rotate(-Math.PI/2);
    const w=tall?width:length,h=tall?length:width;
    ctx.imageSmoothingEnabled=true;
    ctx.drawImage(img,-w/2,-h/2,w,h);
    ctx.restore();
    return true;
}
/** Called after the projectile's world-angle transform. */
export function drawWeaponBolt(ctx,id,level=1){
    let palette;
    switch(id){
        case 'starter_pulse':palette=['laserBlue01','laserBlue10','laserBlue16'];break;
        case 'magic_wand':palette=['laserGreen01','laserGreen10'];break;
        case 'fire_wand':palette=['laserRed01','laserRed16'];break;
        default:return false;
    }
    const tier=Math.min(palette.length-1,Math.floor(Math.max(0,level-1)/3));
    const length=id==='starter_pulse'?Math.min(39,24+level*2.1):Math.min(40,28+level*1.8);
    ctx.save();
    ctx.shadowColor=id==='fire_wand'?'#ff7d45':id==='magic_wand'?'#65ffca':'#6cdbff';
    ctx.shadowBlur=10;
    const ok=drawLongAxis(ctx,loaded.get(palette[tier]),length,11);
    ctx.restore();
    return ok;
}
export function drawEnemyBolt(ctx,kind){
    return drawLongAxis(ctx,loaded.get(kind==='laser'?'laserRed10':'laserRed01'),
        kind==='laser'?36:25,kind==='laser'?11:13);
}
/** Frames advance on WorldVFX's game clock, not on a separate timer. */
export function getExplosionFrame(progress){
    const index=Math.min(9,Math.max(0,Math.floor(progress*10)));
    return loaded.get('fire'+String(index).padStart(2,'0'))||null;
}
export function getShieldFrame(time=0){
    return loaded.get('shield'+(1+(Math.floor(time*5)%3+3)%3))||null;
}
export function getCombatArtStatus(){
    return {ready:loaded.size,total:Object.keys(FILES).length};
}
