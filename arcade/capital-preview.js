import {stripCapitalMatte,CAPITAL_PAINTINGS} from './capital-art.js?v=arcade-capital-mask-56';
import {drawHullDamage} from './combat-feedback.js?v=arcade-vfx-viewport-44';
import {capitalWearStage,createCapitalWearFrame,drawCapitalWearVent,drawCapitalWearTrail,drawCapitalWearTrailTextured} from './capital-wear.js?v=arcade-capital-wear-preview-5';

const files=CAPITAL_PAINTINGS;
const get=id=>document.getElementById(id);
const kind=get('kind'),scale=get('scale'),hp=get('hp'),hitbox=get('hitbox'),damageMode=get('damageMode');
const raw=get('raw'),clean=get('clean'),battle=get('battle');
const status=get('status');
const radius=22,zoom=5;
let prepared=null,sequence=0,frames=Object.create(null);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

function checker(ctx,width,height,step=16){
 ctx.fillStyle='#b6c2c9';ctx.fillRect(0,0,width,height);
 ctx.fillStyle='#657480';
 for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step)
  if(((x+y)/step)%2===0)ctx.fillRect(x,y,step,step);
}
function drawCanvasImage(canvas,image,checked=false){
 const c=canvas.getContext('2d');
 c.clearRect(0,0,canvas.width,canvas.height);
 if(checked)checker(c,canvas.width,canvas.height);
 if(image)c.drawImage(image,0,0,canvas.width,canvas.height);
}
function render(){
 const multiplier=Number(scale.value),health=Number(hp.value);
 get('scaleValue').textContent=multiplier.toFixed(2).replace('.',',');
 get('hpValue').textContent=health+'%';
 const c=battle.getContext('2d'),w=battle.width,h=battle.height;
 const gradient=c.createLinearGradient(0,0,w,h);
 gradient.addColorStop(0,'#090d22');gradient.addColorStop(1,'#273352');
 c.fillStyle=gradient;c.fillRect(0,0,w,h);
 c.save();c.translate(w/2,h/2);c.scale(zoom,zoom);
 c.strokeStyle='#405679';c.lineWidth=.2;
 for(let p=-48;p<=48;p+=12){
  c.beginPath();c.moveTo(p,-52);c.lineTo(p,52);c.stroke();
  c.beginPath();c.moveTo(-52,p);c.lineTo(52,p);c.stroke();
 }
 if(prepared){
  const height=radius*multiplier,width=height*2/3;
  c.imageSmoothingEnabled=true;
  let artwork=prepared;
  if(['contrast','soft','breach','rupture','textured'].includes(damageMode.value)){
   const stage=capitalWearStage(health,100),variant=damageMode.value;
   if(stage>0){
    const key=variant+'-'+stage;
    if(!frames[key])frames[key]=createCapitalWearFrame(prepared,kind.value,stage,variant);
    artwork=frames[key]||prepared;
   }
  }
  c.drawImage(artwork,-width/2,-height/2,width,height);
  if(['breach','rupture','textured'].includes(damageMode.value)){
   const stage=capitalWearStage(health,100);
   const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
   (damageMode.value==='textured'?drawCapitalWearTrailTextured:damageMode.value==='rupture'?drawCapitalWearTrail:drawCapitalWearVent)(c,kind.value,stage,width,height,performance.now()/1000,reduced);
  }
  if(damageMode.value==='legacy')
   drawHullDamage(c,{x:0,y:0,r:radius,serial:0,angle:0,hp:health,maxHp:100},0,60,false);
 }else{
  c.fillStyle='#b74c6b';c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.fill();
 }
 if(hitbox.checked){
  c.strokeStyle='#76f4ff';c.lineWidth=.65;c.setLineDash([2,1]);
  c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.stroke();c.setLineDash([]);
  c.fillStyle='#fff';c.fillRect(-.5,-.5,1,1);
 }
 c.restore();
}
async function load(){
 const ticket=++sequence,variant=kind.value,ext=files[variant];
 if(!ext)return;
 prepared=null;frames=Object.create(null);
 status.textContent='Загрузка: '+variant+'…';
 drawCanvasImage(raw,null);drawCanvasImage(clean,null,true);render();
 const image=new Image();image.decoding='async';
 const url=new URL('../assets/space/boss-capital-'+variant+'.'+ext,import.meta.url);
 try{
  await new Promise((resolve,reject)=>{
   image.onload=resolve;image.onerror=()=>reject(new Error('Файл не загрузился'));
   image.src=url.href;
  });
  if(ticket!==sequence)return;
  drawCanvasImage(raw,image);
  const processed=document.createElement('canvas');
  processed.width=512;processed.height=768;
  const c=processed.getContext('2d',{willReadFrequently:true});
  if(!c)throw new Error('Не удалось получить Canvas 2D');
  c.drawImage(image,0,0,processed.width,processed.height);
  const pixels=c.getImageData(0,0,processed.width,processed.height);
  const result=stripCapitalMatte(pixels.data,processed.width,processed.height);
  if(result.usable){
   c.putImageData(pixels,0,0);
   prepared=processed;
  }
  drawCanvasImage(clean,prepared,true);
  const total=processed.width*processed.height;
  const percent=(((result.remaining||0)/total)*100).toFixed(1);
  status.textContent='Маска: '+(result.usable?'принята':'отклонена')+
   ' · причина: '+result.reason+' · заполнение: '+percent+'%'+
   ' · убрано пикселей: '+(result.removed||0).toLocaleString('ru-RU')+
   ' · файл: '+image.naturalWidth+' × '+image.naturalHeight;
  render();
 }catch(error){
  if(ticket!==sequence)return;
  status.textContent='Ошибка проверки: '+error.message;
  render();
 }
}
kind.addEventListener('change',load);
scale.addEventListener('input',render);
hp.addEventListener('input',render);
hitbox.addEventListener('change',render);
damageMode.addEventListener('change',render);
let lastFrame=0;
function previewAnimation(now){
 if(['breach','rupture','textured'].includes(damageMode.value)&&prepared&&now-lastFrame>76){
  render();lastFrame=now;
 }
 requestAnimationFrame(previewAnimation);
}
requestAnimationFrame(previewAnimation);
load();
