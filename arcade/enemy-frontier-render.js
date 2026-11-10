import {FRONTIER} from './enemy-frontier-network.js?v=frontier-fence-1';
import {POPULATION_CONVOY_PROFILES} from './convoy-profiles.js?v=convoy-variety-20261110';

// Fixed-size transparent production sprites. No per-frame image allocation.
const artwork={};
function sprite(key,path){
 if(!Object.hasOwn(artwork,key)){
  if(typeof Image==='undefined'){artwork[key]=null;return null;}
  const img=new Image();img.decoding='async';img.src=new URL(path,import.meta.url).href;
  artwork[key]=img;
 }
 const img=artwork[key];return img?.complete&&img.naturalWidth>0?img:null;
}
const visible=(p,cam,pad=160)=>p.x>cam.x-pad&&p.x<cam.x+cam.w+pad&&
 p.y>cam.y-pad&&p.y<cam.y+cam.h+pad;
const TAU=Math.PI*2;
const light=(c,x,y,size,color,alpha)=>{
 if(typeof c.createRadialGradient!=='function')return;
 const g=c.createRadialGradient(x,y,0,x,y,size);
 if(!g||typeof g.addColorStop!=='function')return;
 g.addColorStop(0,color);g.addColorStop(1,'#00000000');
 c.globalAlpha=alpha;c.fillStyle=g;c.beginPath();c.arc(x,y,size,0,TAU);c.fill();
};

export function drawIndustrialMiner(c,miner,time,extractor=null){
 const art=sprite('miner','./assets/enemy-frontier/ore-miner-v1.webp');
 // The painted craft points tangentially to its real mining orbit. A sprite
 // drawn nose-up needs +PI relative to its radial angle for this direction.
 const heading=extractor?
  Math.atan2(miner.y-extractor.y,miner.x-extractor.x)+Math.PI:
  time*.47+miner.slot*Math.PI;
 c.save();c.translate(miner.x,miner.y);c.rotate(heading);
 if(art)c.drawImage(art,-44,-44,88,88);
 else{
  c.fillStyle='#323743';c.strokeStyle='#e4a952';c.lineWidth=3;
  c.beginPath();c.moveTo(0,-27);c.lineTo(22,19);c.lineTo(-22,19);c.closePath();c.fill();c.stroke();
 }
 if(miner.hit>0){c.globalCompositeOperation='lighter';light(c,0,0,42,'#ffdb9a',.7);}
 c.globalCompositeOperation='lighter';light(c,-13,33,13,'#63d8ff',.17+.11*Math.sin(time*8));
 light(c,13,33,13,'#63d8ff',.17+.11*Math.sin(time*8+.6));
 c.restore();
}

export function drawIndustrialConvoy(c,cargo,time){
 const atlas=sprite('freighter','./assets/missions/hostile-freighter-v1.webp');
 const role=cargo.cargoRole,spec=POPULATION_CONVOY_PROFILES[role];
 const color=spec?.color||'#5ee2ff',scale=role==='courier'?.8:role==='ore'?1.12:1;
 c.save();c.translate(cargo.x,cargo.y);c.rotate(cargo.angle);
 // Reuse the freighter atlas, but make the cargo modules and armor silhouette
 // distinguish its actual shipment role before the pilot enters weapon range.
 if(role==='ore'||role==='military'||role==='technical'){
  const wide=role==='ore'?30:role==='military'?19:17;
  const height=role==='ore'?66:role==='military'?54:41;
  c.lineWidth=2.6;c.strokeStyle=color;c.fillStyle=role==='ore'?'#584b36':
   role==='military'?'#4d323f':'#314d46';
  for(const side of [-1,1]){
   const x=side*(role==='ore'?52:48)-wide/2;
   c.fillRect(x,-height*.44,wide,height);
   c.strokeRect(x,-height*.44,wide,height);
   c.globalAlpha=.7;c.fillStyle=color;
   c.fillRect(x+4,-height*.32,wide-8,4);
   c.globalAlpha=1;c.fillStyle=role==='ore'?'#584b36':
    role==='military'?'#4d323f':'#314d46';
  }
 }
 if(atlas){
  // The left half is an undamaged top-down freighter. Right half is damaged.
  const damaged=cargo.hp/cargo.maxHp<.45;
  c.drawImage(atlas,damaged?512:0,0,512,512,-60*scale,-60*scale,120*scale,120*scale);
 }else{
  c.fillStyle='#39313a';c.strokeStyle='#ffba7b';c.lineWidth=3;
  c.beginPath();c.moveTo(0,-42);c.lineTo(31,-11);
  c.lineTo(28,35);c.lineTo(-28,35);c.lineTo(-31,-11);c.closePath();c.fill();c.stroke();
 }
 if(spec){
  c.globalCompositeOperation='lighter';
  if(role==='courier'){
   const sprint=Number.isFinite(cargo.firstHitAt)&&time-cargo.firstHitAt<7;
   light(c,-11,43,sprint?38:25,color,sprint?.45:.28);
   light(c,11,43,sprint?38:25,color,sprint?.45:.28);
  }else if(role==='military'){
   light(c,-30,-8,15,color,.42);light(c,30,-8,15,color,.42);
  }else if(role==='technical'){
   light(c,0,-31,26,color,.38);
  }else{
   light(c,-47,0,18,color,.30);light(c,47,0,18,color,.30);
  }
 }
 c.globalCompositeOperation='lighter';
 light(c,-16,49*scale,20,color,.21+.13*Math.sin(time*9));
 light(c,16,49*scale,20,color,.21+.13*Math.sin(time*9+.6));
 if(cargo.hit>0)light(c,0,0,56,'#ffb2aa',.56);
 c.restore();
}

export function drawAnomalyWrecks(c,field,time,reduced=false){
 const art=sprite('wreck','./assets/missions/convoy-wreck-v1.webp');
 const freighter=sprite('freighter','./assets/missions/hostile-freighter-v1.webp');
 for(let i=0;i<9;i++){
  const angle=i*2.39996323+field.phase,r=160+((i*239)%730);
  const x=Math.cos(angle)*r,y=Math.sin(angle)*r;
  c.save();c.translate(x,y);c.rotate(angle+Math.PI*.25+Math.sin(time*.02+i)*.03);
  c.globalAlpha=.54+(i%4)*.1;
  const length=95+(i%4)*29;
  if(i%4===0&&freighter)c.drawImage(freighter,512,0,512,512,
   -length*.38,-length*.48,length*.76,length*.96);
  else if(art)c.drawImage(art,-length*.55,-length*.26,length*1.1,length*.52);
  else{
   c.strokeStyle='#b7afaf';c.lineWidth=3;c.beginPath();
   c.moveTo(-length*.4,-length*.19);c.lineTo(length*.42,-length*.11);
   c.lineTo(length*.2,length*.24);c.lineTo(-length*.33,length*.18);
   c.closePath();c.stroke();
  }
  c.restore();
 }
 if(reduced)return;
 for(let i=0;i<27;i++){
  const angle=i*2.39996323+field.phase*.4,r=95+(i*143)%920;
  const x=Math.cos(angle)*r,y=Math.sin(angle)*r;
  c.fillStyle=i%4===0?'#c5b19a':'#6d8895';
  c.globalAlpha=.29+(i%3)*.08;c.fillRect(x,y,2+(i%3)*2,3+(i%2)*2);
 }
 c.globalAlpha=1;
}

export function drawFrontierNetwork(game,c,cam,colony){
 if(!colony.fronts?.length)return;
 const time=game.time,reduced=game.visuals?.reducedMotion||game.fps<32;
 const art=sprite('buoy','./assets/enemy-frontier/defense-buoy-v1.webp');
 const relay=game.world.stations.get(colony.id+':relay');
 const powered=relay?.enemy&&relay.hp>0&&!relay.suppressed;
 for(const front of colony.fronts){
  for(let i=1;i<front.nodes.length;i++){
   const a=front.nodes[i-1],b=front.nodes[i];
   if(!visible(a,cam,520)&&!visible(b,cam,520))continue;
   if(a.hp<=0||b.hp<=0||!powered)continue;
   c.save();
   const pulse=reduced?1:.86+.14*Math.sin(time*6+front.bearing*3+i);
   c.lineCap='round';
   c.strokeStyle='#28163e';c.globalAlpha=.78;c.lineWidth=56;
   c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();
   c.globalCompositeOperation='lighter';
   c.strokeStyle='#772bd0';c.globalAlpha=.21*pulse;c.lineWidth=44;
   c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();
   c.strokeStyle='#e07bff';c.globalAlpha=.65*pulse;c.lineWidth=7;
   c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();
   c.strokeStyle='#fff0ff';c.globalAlpha=.78*pulse;c.lineWidth=1.8;
   c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();
   if(!reduced){
    const dx=b.x-a.x,dy=b.y-a.y;
    for(let spark=0;spark<3;spark++){
     const u=((time*.38+spark/3+i*.17)%1+1)%1;
     const sway=Math.sin(time*11+i*4+spark*7)*11;
     const px=a.x+dx*u-dy/FRONTIER.spacing*sway;
     const py=a.y+dy*u+dx/FRONTIER.spacing*sway;
     light(c,px,py,18,spark===1?'#f9dbff':'#a46cff',.23);
    }
   }
   c.restore();
  }
  for(const node of front.nodes){
   if(!visible(node,cam,110))continue;
   c.save();c.translate(node.x,node.y);
   if(node.hp>0){
    if(powered){c.globalCompositeOperation='lighter';
     light(c,0,0,95,'#c684ff',.22+.05*Math.sin(time*3+node.slot));
     if(node.fireGlowUntil>time)light(c,0,0,110,'#ffdc99',.57);
     c.globalCompositeOperation='source-over';}
    c.rotate(front.bearing+Math.PI/2);
    if(art)c.drawImage(art,-65,-65,130,130);
    else{
     c.fillStyle='#292638';c.strokeStyle='#ffb56b';c.lineWidth=3;
     c.beginPath();c.moveTo(0,-46);c.lineTo(41,0);c.lineTo(0,46);
     c.lineTo(-41,0);c.closePath();c.fill();c.stroke();
    }
    if(node.hit>0){c.globalCompositeOperation='lighter';light(c,0,0,68,'#ff9c87',.48);}
    if(node.hp<node.maxHp*.6){
     c.strokeStyle='#f2a7ff';c.globalAlpha=.8;c.lineWidth=4;
     c.beginPath();c.arc(0,0,68,-Math.PI/2,-Math.PI/2+TAU*node.hp/node.maxHp);c.stroke();
    }
   }else if(node.buildAt>time){
    // A construction site has a persistent physical foundation, but no shield.
    c.strokeStyle='#b38b69';c.lineWidth=3;c.globalAlpha=.56;
    c.beginPath();c.rect(-21,-21,42,42);c.stroke();
    c.strokeStyle='#dfad72';c.lineWidth=2;c.beginPath();
    c.moveTo(-35,-35);c.lineTo(35,35);c.moveTo(35,-35);c.lineTo(-35,35);c.stroke();
   }else if(node.repairAt>time){
    c.strokeStyle='#a04f76';c.lineWidth=2.5;c.beginPath();
    c.moveTo(-21,-12);c.lineTo(11,15);c.lineTo(23,-8);c.stroke();
   }
   c.restore();
  }
 }
}
