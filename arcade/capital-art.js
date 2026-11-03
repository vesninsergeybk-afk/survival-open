/**
 * Strip only a flat, edge-connected studio backdrop from capital paintings.
 * Visual-only: neither this image mask nor its dimensions alter game hitboxes.
 *
 * The original 1024×1536 PNGs are reduced once to a 512×768 canvas before
 * this routine runs. RGB and internal bright armour are kept unchanged.
 */
export const CAPITAL_PAINTINGS=Object.freeze({
 cruiser:'png',carrier:'png',dreadnought:'png'
});

const MATTE_TOLERANCE=38;
const MIN_FOREGROUND=.025;
const MAX_FOREGROUND=.83;

const near=(a,b)=>Math.abs(a-b)<=MATTE_TOLERANCE;
const isNeutral=(r,g,b)=>Math.max(r,g,b)-Math.min(r,g,b)<=34;

/**
 * Changes only alpha in an RGBA pixel buffer. Returns usable=false when the
 * image is blank, its background cannot be identified safely or the remaining
 * object is too large to distinguish from a rectangular matte.
 */
export function stripCapitalMatte(data,width,height){
 const count=width*height;
 if(!Number.isInteger(width)||!Number.isInteger(height)||
    width<3||height<3||!data||data.length!==count*4)
  return {usable:false,reason:'dimensions'};
 const corners=[0,width-1,(height-1)*width,count-1];
 const sample=corners.map(i=>Array.from(data.slice(i*4,i*4+4)));
 const visible=sample.filter(p=>p[3]>20);
 if(!visible.length){
  let remaining=0;
  for(let i=0;i<count;i++)if(data[i*4+3]>24)remaining++;
  const fraction=remaining/count;
  return {usable:fraction>=MIN_FOREGROUND&&fraction<=MAX_FOREGROUND,
   reason:'transparent',remaining,removed:0};
 }
 if(visible.length!==4)return {usable:false,reason:'mixed-border'};
 const bg=[0,1,2].map(k=>Math.round(visible.reduce((n,p)=>n+p[k],0)/4));
 if(Math.min(...bg)<184||!isNeutral(...bg)||
    !visible.every(p=>near(p[0],bg[0])&&near(p[1],bg[1])&&near(p[2],bg[2])))
  return {usable:false,reason:'non-flat-border'};
 const seen=new Uint8Array(count),queue=new Int32Array(count);
 let read=0,write=0,removed=0;
 const matches=i=>{
  const k=i*4,a=data[k+3];
  if(a<=20)return true;
  return isNeutral(data[k],data[k+1],data[k+2])&&
   near(data[k],bg[0])&&near(data[k+1],bg[1])&&near(data[k+2],bg[2]);
 };
 const add=i=>{
  if(i<0||i>=count||seen[i]||!matches(i))return;
  seen[i]=1;queue[write++]=i;
 };
 for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}
 for(let y=0;y<height;y++){add(y*width);add(y*width+width-1);}
 while(read<write){
  const i=queue[read++],k=i*4;
  if(data[k+3]>0)removed++;
  data[k+3]=0;
  const x=i%width,y=Math.floor(i/width);
  if(x>0)add(i-1);
  if(x<width-1)add(i+1);
  if(y>0)add(i-width);
  if(y<height-1)add(i+width);
 }
 let remaining=0;
 for(let i=0;i<count;i++)if(data[i*4+3]>24)remaining++;
 const fraction=remaining/count;
 return {usable:removed>0&&fraction>=MIN_FOREGROUND&&fraction<=MAX_FOREGROUND,
  reason:'flat-matte',removed,remaining};
}
