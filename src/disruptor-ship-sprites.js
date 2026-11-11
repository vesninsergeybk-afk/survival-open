/**
 * Animated enemy ships extracted from the Tiny Spaceships GIF preview
 * by Disruptor Art, CC BY 4.0 (see assets/disruptor-ships/CREDITS.md).
 * One atlas: 20 rows × 8 frames, 64-pixel transparent cells.
 */
const CELL=64, FRAMES=8, INTERVAL=.14;
const ROWS=Object.freeze({
    bat:[0,6,11], zombie:[1], skeleton:[10], stalker:[2,8],
    wolf:[5], golem:[18], ghost:[4], mage:[3], slime:[15],
    slimeling:[9], bomber:[14], sniper:[12], gunship:[13],
    minelayer:[7], rammer:[19], carrier:[13], illusionist:[4],
    repairer:[16], commander:[17]
});
let atlas=null;
if(typeof Image!=='undefined'){
    const image=new Image();
    image.decoding='async';
    image.onload=()=>{
        if(image.naturalWidth===CELL*FRAMES &&
           image.naturalHeight===CELL*20)atlas=image;
    };
    image.onerror=()=>{atlas=null;};
    image.src=new URL('../assets/disruptor-ships/atlas_20_ships_8_frames.png',
        import.meta.url).href;
}
export const isAnimatedShipAtlasReady=()=>atlas!==null;
export const usesRegularEnemyShipArt=enemy=>!!enemy&&!enemy.boss&&
    enemy.openingRescueRole!=='tug'&&(!enemy.missionStructure||
    ['guard','escort','pursuer'].includes(enemy.openingRescueRole)||
    enemy.openingCommander||enemy.scenario==='opening-escort');

/** Returns true if an animated sprite replaced the fallback artwork. */
export function drawAnimatedEnemyShip(ctx,enemy){
    // Both opening missions use the same approved fleet atlas as the rest
    // of the game. Only the rescue tug retains its mission-objective art.
    if(!atlas||!usesRegularEnemyShipArt(enemy))return false;
    const choices=ROWS[enemy.id||enemy.type?.id];
    if(!choices)return false;
    if(!Number.isInteger(enemy._disruptorRow)){
        // Choose cosmetic variants once without consuming gameplay RNG.
        const hx=(Math.floor(enemy.x)*73856093)|0;
        const hy=(Math.floor(enemy.y)*19349663)|0;
        enemy._disruptorRow=choices[((hx^hy)>>>0)%choices.length];
    }
    const row=enemy._disruptorRow;
    const now=typeof performance!=='undefined'?performance.now():0;
    const frame=Math.floor((now/1000+row*.027)/INTERVAL)%FRAMES;
    const side=Math.max(42,Math.min(116,(enemy.size||14)*3.2));
    ctx.save();
    ctx.translate(enemy.x,enemy.y);
    ctx.rotate(Number.isFinite(enemy.visualAngle)?enemy.visualAngle:0);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(atlas,frame*CELL,row*CELL,CELL,CELL,
        -side/2,-side/2,side,side);
    ctx.restore();
    return true;
}
