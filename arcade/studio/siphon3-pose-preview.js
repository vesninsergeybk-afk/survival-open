import {drawSiphon3,siphon3RigReady} from '../siphon3-art.js?v=siphon3-rig-2';

const $=id=>document.getElementById(id);
const canvas=$('pose-scene'),c=canvas?.getContext('2d');
if(canvas&&c){
 const W=canvas.width,H=canvas.height;
 const buttons=[...document.querySelectorAll('[data-pose]')];
 const modes={
  cycle:{label:'Полный цикл',explain:'Полёт → раскрытие → две фазы всасывания → возвращение с грузом.'},
  fly:{label:'Полёт',explain:'Клешни сложены; небольшие движения помогают удерживать курс.'},
  approach:{label:'Раскрытие',explain:'Перед воронкой три клешни раздвигаются для захвата энергии.'},
  gather:{label:'Добыча',explain:'Два согласованных сжатия клешней сопровождают всасывание энергии.'},
  back:{label:'С грузом',explain:'Клешни складываются вокруг накопителя, затем раскрываются при стыковке.'},
 };
 let mode='cycle',clock=0,last=0,paused=false;
 const ease=t=>Math.min(1,Math.max(0,t));

 function poseAt(t){
  if(mode==='fly')return {phase:'out',progress:.5*(1-Math.cos(t*Math.PI*2/3))/2,desc:'МАЛЫЕ ДВИЖЕНИЯ В ПОЛЁТЕ'};
  if(mode==='approach')return {phase:'out',progress:.68+.32*(1-Math.cos(t*Math.PI*2/2.8))/2,desc:'РАСКРЫВАЕТ КЛЕШНИ'};
  if(mode==='gather')return {phase:'gather',progress:.24*((t%3)/3),desc:'ВСАСЫВАЕТ ЭНЕРГИЮ'};
  if(mode==='back')return {phase:'back',progress:(1-Math.cos(t*Math.PI*2/4))/2,desc:'НЕСЁТ ГРУЗ'};
  const k=t%13;
  if(k<3)return {phase:'out',progress:.68*ease(k/3),desc:'ЛЕТИТ К ВОРОНКЕ'};
  if(k<5)return {phase:'out',progress:.68+.32*ease((k-3)/2),desc:'РАСКРЫВАЕТ КЛЕШНИ'};
  if(k<8)return {phase:'gather',progress:.24*ease((k-5)/3),desc:'ДВА СЖАТИЯ · ВСАСЫВАНИЕ'};
  if(k<12)return {phase:'back',progress:ease((k-8)/4),desc:'ВОЗВРАЩАЕТСЯ С ГРУЗОМ'};
  return {phase:'back',progress:1,opacity:k<12.5?1-(k-12)*2:(k-12.5)*2,
   desc:k<12.5?'РАЗГРУЗКА':'НОВЫЙ РЕЙС'};
 }

 function paint(){
  c.fillStyle='#071522';c.fillRect(0,0,W,H);
  const flare=c.createRadialGradient(W/2,H/2,12,W/2,H/2,220);
  flare.addColorStop(0,'rgba(35,91,102,.38)');flare.addColorStop(1,'rgba(35,91,102,0)');
  c.fillStyle=flare;c.fillRect(0,0,W,H);
  c.strokeStyle='rgba(90,178,184,.16)';c.lineWidth=1;c.setLineDash([3,12]);
  c.beginPath();c.moveTo(W*.11,H*.5);c.lineTo(W*.89,H*.5);c.stroke();c.setLineDash([]);
  const pose=poseAt(clock),reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  c.save();c.globalAlpha=pose.opacity??1;
  const drawn=drawSiphon3(c,{x:W/2,y:H/2,size:278,phase:pose.phase,progress:pose.progress,
   time:clock,reducedMotion:reduced});
  c.restore();
  c.font='bold 15px system-ui';c.textAlign='center';c.fillStyle='#b7f9ed';
  c.fillText(drawn?pose.desc:'ЗАГРУЖАЕМ МОДЕЛЬ…',W/2,H-22);
  $('pose-rig-status').textContent=siphon3RigReady()?
   'Шарнирная модель загружена · один исходный рисунок':'Загружается шарнирная модель…';
 }

 function setMode(next){
  if(!modes[next])return;
  mode=next;clock=0;
  buttons.forEach(b=>{const selected=b.dataset.pose===mode;
   b.setAttribute('aria-pressed',String(selected));b.classList.toggle('active',selected);
  });
  $('pose-description').textContent=modes[mode].explain;
  paint();
 }
 buttons.forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.pose)));
 $('pose-pause').addEventListener('click',()=>{
  paused=!paused;last=0;$('pose-pause').textContent=paused?'Продолжить':'Пауза';
 });
 function frame(now){
  const dt=last?Math.min(.055,(now-last)/1000):0;last=now;
  if(!paused)clock+=dt;
  paint();requestAnimationFrame(frame);
 }
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  paused=true;$('pose-pause').textContent='Продолжить';
 }
 setMode(mode);requestAnimationFrame(frame);
}
