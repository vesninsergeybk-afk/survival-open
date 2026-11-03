/**
 * Shared production explosion grammar.
 * All costly gradients and irregular geometry are baked into eight small atlas
 * frames on first use. Rendering only selects a cached frame.
 *
 * Source of design decisions: arcade/EXPLOSION-VFX-CONCEPT-2026-11-03.md
 */
export const BLAST_CELL = 128;
export const BLAST_FRAMES = 8;
const TAU = Math.PI * 2;
const palettes = Object.freeze({
  orange: ['255,250,221','255,179,77','243,86,39','112,31,38'],
  red: ['255,242,237','255,137,126','223,59,83','93,27,58'],
  cyan: ['245,255,255','126,234,255','49,139,228','31,51,116'],
  violet: ['255,246,255','214,155,255','127,82,218','55,35,118']
});
const profiles = Object.freeze({
  rocket: {spread:.23, streak:1.24, core:.95, petals:5},
  ship: {spread:.29, streak:1.06, core:1, petals:8},
  capital: {spread:.36, streak:1.19, core:.83, petals:11},
  ion: {spread:.16, streak:.99, core:.69, petals:6}
});
const cached = new Map();
const rgba = (rgb,a) => 'rgba(' + rgb + ',' + Math.max(0,Math.min(1,a)).toFixed(3) + ')';

/** No random calls: a silhouette remains recognizable between adjacent frames. */
function jaggedPath(ctx,radius,time,style,profile) {
  const points=36;
  ctx.beginPath();
  for(let i=0;i<=points;i++){
    const angle=(i%points)*TAU/points;
    const waves=.62*Math.sin(angle*7+style*1.3+time*.3)+
      .29*Math.sin(angle*13-style*.7-time*.2)+
      .18*Math.sin(angle*19+style*2.1);
    const forward=profile==='rocket'?.19*Math.cos(angle):0;
    const r=radius*(1+waves*.25+forward);
    const x=Math.cos(angle)*r,y=Math.sin(angle)*r;
    if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.closePath();
}

export function getExplosionAtlas(tint='orange',profile='ship') {
  const kind=palettes[tint]?tint:'orange';
  const type=profiles[profile]?profile:'ship';
  const key=kind+':'+type;
  if(cached.has(key))return cached.get(key);
  if(typeof document==='undefined')return null;
  try{
    const atlas=document.createElement('canvas');
    atlas.width=BLAST_CELL*BLAST_FRAMES;
    atlas.height=BLAST_CELL;
    const ctx=atlas.getContext('2d');
    if(!ctx)return null;
    const colors=palettes[kind],style=profiles[type];
    const phase={rocket:.6,ship:1.45,capital:2.4,ion:3.1}[type];
    for(let frame=0;frame<BLAST_FRAMES;frame++){
      const t=frame/(BLAST_FRAMES-1);
      const fade=Math.pow(1-t,.94);
      // Rapid ignition, irregular outward break-up, then a dark center.
      const reach=(14+43*(1-Math.exp(-5.2*t)))*(1-.12*t);
      const core=(22+9*Math.sin(Math.PI*t))*(1-.77*t)*style.core;
      ctx.save();
      ctx.translate(frame*BLAST_CELL+BLAST_CELL/2,BLAST_CELL/2);
      if(type==='rocket')ctx.scale(1.15,.88);
      ctx.globalCompositeOperation='lighter';
      const outer=ctx.createRadialGradient(0,0,0,0,0,reach*1.1);
      outer.addColorStop(0,rgba(colors[1],.86*fade));
      outer.addColorStop(.27,rgba(colors[1],.72*fade));
      outer.addColorStop(.55,rgba(colors[2],.62*fade));
      outer.addColorStop(.85,rgba(colors[3],.37*fade));
      outer.addColorStop(1,rgba(colors[3],0));
      jaggedPath(ctx,reach,t,phase,type);
      ctx.fillStyle=outer;
      ctx.fill();
      // Detached, asymmetric tongues are baked into the atlas, never simulated
      // as new full-screen gradients or separately animated Canvas objects.
      for(let p=0;p<style.petals;p++){
        const a=p*TAU/style.petals+phase+.21*Math.sin(p*3.7);
        const radial=reach*(.79+.27*Math.sin(p*5.1+phase));
        const tip=radial*(1.16+.14*Math.sin(p*9.1));
        const w=reach*(.085+.025*Math.sin(p*4.2));
        ctx.beginPath();
        ctx.moveTo(Math.cos(a-.25)*radial*.42,Math.sin(a-.25)*radial*.42);
        ctx.quadraticCurveTo(Math.cos(a-.16)*radial,Math.sin(a-.16)*radial,
          Math.cos(a)*tip,Math.sin(a)*tip);
        ctx.quadraticCurveTo(Math.cos(a+.14)*radial,Math.sin(a+.14)*radial,
          Math.cos(a+.25)*radial*.43,Math.sin(a+.25)*radial*.43);
        ctx.closePath();
        ctx.fillStyle=rgba(colors[p%3===0?1:2],(.24+.07*Math.sin(p))*fade*(1-.3*t));
        ctx.fill();
        if(t<.7){
          ctx.strokeStyle=rgba(colors[0],.23*fade);
          ctx.lineWidth=Math.max(.7,w*.09);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a)*radial*.75,Math.sin(a)*radial*.75);
          ctx.lineTo(Math.cos(a)*tip,Math.sin(a)*tip);
          ctx.stroke();
        }
      }
      const inner=ctx.createRadialGradient(0,0,0,0,0,core);
      inner.addColorStop(0,rgba(colors[0],.98*fade));
      inner.addColorStop(.22,rgba(colors[0],.90*fade));
      inner.addColorStop(.52,rgba(colors[1],.75*fade));
      inner.addColorStop(1,rgba(colors[2],0));
      ctx.fillStyle=inner;
      ctx.fillRect(-core,-core,core*2,core*2);
      if(type==='ion'&&t>.12&&t<.88){
        ctx.strokeStyle=rgba(colors[0],.44*fade);
        ctx.lineWidth=2.7*(1-t)+.5;
        ctx.beginPath();
        ctx.arc(0,0,reach*(.67+.25*t),-.5,TAU-.7);
        ctx.stroke();
      }
      ctx.restore();
    }
    cached.set(key,atlas);
    return atlas;
  }catch{return null;}
}

export function explosionAtlasDiagnostics(){
  return {cached:cached.size,frames:BLAST_FRAMES,cell:BLAST_CELL,
    estimatedRGBABytes:cached.size*BLAST_CELL*BLAST_CELL*BLAST_FRAMES*4};
}
