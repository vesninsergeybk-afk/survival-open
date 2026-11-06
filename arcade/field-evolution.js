// Field evolution is earned with the pilot's existing level points. The cores
// dropped by ordinary kills are expendable combat resources, not experience.
export const FIELD_EVOLUTION_SKILLS=[
 {id:'parasite',branch:'Технологии',title:'Энергетический паразит',max:1,from:2,
  desc:'Каждый третий лично побеждённый дрон оставляет энергетическое ядро. Два заряда можно сохранить для захвата или защитного импульса.'},
 {id:'conduit',branch:'Корабль',title:'Разрядный проход',max:1,from:2,
  desc:'Рывок прошивает врагов электрическими метками. Попадите по помеченному кораблю — разряд на миг обездвижит его соседей.'},
 {id:'wreck',branch:'Технологии',title:'Обломки-укрытия',max:1,from:2,
  desc:'После победы над тяжёлыми дронами остаются дрейфующие обломки. Они на время перекрывают вражеский огонь, но разрушаются от попаданий.'},
 {id:'capture',branch:'Технологии',title:'Паразитный захват',max:1,from:3,requires:'parasite',
  desc:'Отметьте врага приоритетной целью и добейте с запасом ядра: он на 16 секунд перейдёт на вашу сторону, сохранив роль разведчика, ремонтника или бойца.'},
 {id:'signal',branch:'Технологии',title:'Паразит-передатчик',max:1,from:4,requires:'parasite',
  desc:'Попадание по свежей приоритетной цели внедряет накопленный заряд. В течение 16 секунд враг невольно раскрывает расположение ближайшего звена патруля.'}
];

export function createFieldEvolution(){
 return {pending:0,offers:[],crystals:[],charge:0,kills:0,captureReadyAt:0,
  activeCapture:null,wrecks:[],reveals:[],spySerial:null,spyUntil:0,
  nextWreckAt:0,nextScanAt:0,levelAt:-10,pulseAt:-10};
}
const eligible=(skill,level,ranks)=>level>=skill.from&&
 (!skill.requires||ranks[skill.requires]>0)&&(ranks[skill.id]||0)<skill.max;

export function chooseEvolutionOffers(level,ranks,skills){
 const field=skills.filter(s=>FIELD_EVOLUTION_SKILLS.some(f=>f.id===s.id)&&eligible(s,level,ranks));
 // Fallback choices are ordinary pilot skills. Hangar hardware cannot be
 // mounted in flight, so it is never offered in a floating crystal.
 const other=skills.filter(s=>['magnet','mining','extractor','radar','tactics'].includes(s.id)&&
  eligible(s,level,ranks));
 const list=[...field,...other];
 if(list.length<=3)return list.map(s=>s.id);
 // The first field choices remain legible; later levels rotate alternatives.
 const rotation=Math.max(0,level-2)%list.length;
 return [...list.slice(rotation),...list.slice(0,rotation)].slice(0,3).map(s=>s.id);
}

export function offerLevelCrystals(game,gained,skills){
 const s=game.fieldEvolution;if(!s||gained<=0)return;
 s.pending=Math.min(100,s.pending+gained);
 if(!s.offers.length)refreshEvolutionOffers(game,skills);
}

export function refreshEvolutionOffers(game,skills){
 const s=game.fieldEvolution;if(!s)return [];
 if(s.pending<=0||game.player.points<=0){s.offers=[];s.crystals=[];return [];}
 s.offers=chooseEvolutionOffers(game.player.level,game.skillRanks,skills);
 const angle=game.time*.37;
 s.crystals=s.offers.map((id,index)=>({id,x:game.player.x+Math.cos(angle+index*Math.PI*2/Math.max(1,s.offers.length))*118,
  y:game.player.y+Math.sin(angle+index*Math.PI*2/Math.max(1,s.offers.length))*118,
  born:game.time}));
 return s.offers;
}

export function validFieldEvolution(s,time){
 if(!s||typeof s!=='object'||Array.isArray(s))return false;
 const bounded=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 if(!Number.isInteger(s.pending)||s.pending<0||s.pending>100||
  !Number.isInteger(s.charge)||s.charge<0||s.charge>2||
  !Number.isInteger(s.kills)||s.kills<0||s.kills>1e8||
  !Array.isArray(s.offers)||s.offers.length>3||
  s.offers.some(id=>!FIELD_EVOLUTION_SKILLS.some(k=>k.id===id)&&
   !['magnet','mining','extractor','radar','tactics'].includes(id))||
  !Array.isArray(s.crystals)||s.crystals.length>3||
  s.crystals.some(o=>!o||!bounded(o.x,-1e9,1e9)||!bounded(o.y,-1e9,1e9)||
   !bounded(o.born,0,time+1)||!s.offers.includes(o.id))||
  !Array.isArray(s.wrecks)||s.wrecks.length>3||
  s.wrecks.some(w=>!w||!bounded(w.x,-1e9,1e9)||!bounded(w.y,-1e9,1e9)||
   !bounded(w.hp,0,1000)||!bounded(w.until,0,time+90))||
  !Array.isArray(s.reveals)||s.reveals.length>8||
  s.reveals.some(r=>!r||!bounded(r.x,-1e9,1e9)||!bounded(r.y,-1e9,1e9)||
   !bounded(r.until,0,time+40)))return false;
 return bounded(s.captureReadyAt,0,time+120)&&bounded(s.spyUntil,0,time+60)&&
  bounded(s.nextWreckAt,0,time+45)&&bounded(s.nextScanAt,0,time+3)&&
  bounded(s.levelAt,-10,time+1)&&bounded(s.pulseAt,-10,time+2)&&
  (s.activeCapture===null||Number.isInteger(s.activeCapture)&&s.activeCapture>=0)&&
  (s.spySerial===null||Number.isInteger(s.spySerial)&&s.spySerial>=0);
}

const eligibleVictim=e=>e&&e.hp<=0&&!e.converted&&!e.boss&&!e.missionStructure&&
 !e.interceptCargo&&!e.regionalCargo&&!e.centralWorker&&!e.frontierWorker&&
 !e.openingCommander&&!e.relayAssault&&['scout','fighter','flanker','healer','berserker','gunship'].includes(e.type);

export function enemyFieldReward(game,e,participated){
 const s=game.fieldEvolution;
 if(!s||!participated||!eligibleVictim(e))return {core:false,captured:false,wreck:false};
 let core=false,captured=false,wreck=false;
 if((game.skillRanks.parasite||0)>0){
  s.kills++;
  if(s.kills%3===0&&s.charge<2){
   core=game.addDrop('parasiteCore',e.x,e.y,1,{life:42,vx:0,vy:0})!==false;
  }
 }
 const designation=game.designatedTarget;
 const marked=designation?.target===e&&designation.expiresAt>game.time;
 const active=game.enemies.some(other=>other.parasiteCapture&&other.hp>0&&other!==e);
 if(marked&&(game.skillRanks.capture||0)>0&&s.charge>0&&!active&&
  game.time>=s.captureReadyAt&&e.type!=='gunship'){
  s.charge--;captured=true;s.captureReadyAt=game.time+22;
  e.converted=true;e.parasiteCapture=true;e.parasiteRole=e.type;
  e.convertedTime=16;e.hp=Math.max(20,Math.min(72,Math.round(e.maxHp*.43)));
  e.maxHp=Math.max(e.maxHp,e.hp);e.fire=.35;e.state='converted';
  e.stasisUntil=0;e.stasisImmuneUntil=0;e.expAwarded=true;
  s.activeCapture=e.serial??null;
  game.designatedTarget=null;
  game.heritage?.vfx?.nova?.(e.x,e.y,64,'green');
  game.heritage?.play?.('hack',.45,{x:e.x,y:e.y});
  game.notice?.('ПАРАЗИТНЫЙ ЗАХВАТ · '+roleLabel(e.type)+' на вашей стороне (16 с)',3.5);
 }
 if(!captured&&(game.skillRanks.wreck||0)>0&&game.time>=s.nextWreckAt&&
  ['fighter','flanker','berserker','gunship'].includes(e.type)){
  // Large pieces are meaningful projectile cover; small scouts never flood it.
  s.wrecks=s.wrecks.filter(w=>w.alive&&w.until>game.time);
  if(s.wrecks.length<3){
   const radius=e.type==='gunship'?49:36;
   s.wrecks.push({x:e.x,y:e.y,vx:(e.vx||0)*.21,vy:(e.vy||0)*.21,
    r:radius,hp:48,maxHp:48,alive:true,until:game.time+19,
    evolutionWreck:true,phase:e.serial||0});
   wreck=true;s.nextWreckAt=game.time+6;
  }
 }
 return {core,captured,wreck};
}

export function collectParasiteCore(game){
 const s=game.fieldEvolution;if(!s||!game.skillRanks.parasite||s.charge>=2)return false;
 s.charge++;
 game.heritage?.play?.('pickup',.35);
 game.heritage?.vfx?.nova?.(game.player.x,game.player.y,39,'cyan');
 game.notice?.('ЭНЕРГОЯДРО · '+s.charge+'/2 · захват отмеченной цели или аварийный барьер',3);
 return true;
}

export function absorbParasiteImpact(game,damage){
 const s=game.fieldEvolution;if(!s||s.charge<=0||!(game.skillRanks.parasite||0))return damage;
 // Do not burn a precious capture charge on a glancing scratch.
 if(damage<18&&game.player.hp>game.player.maxHp*.35)return damage;
 s.charge--;
 const blocked=Math.min(25,damage);
 s.pulseAt=game.time;
 game.heritage?.vfx?.nova?.(game.player.x,game.player.y,70,'cyan');
 for(const e of game.enemies){
  if(e.hp>0&&!e.converted&&!e.boss&&!e.missionStructure&&
   Math.hypot(e.x-game.player.x,e.y-game.player.y)<125)
   e.stasisUntil=Math.max(e.stasisUntil||0,game.time+.55);
 }
 game.notice?.('Паразитное ядро поглотило '+Math.round(blocked)+' ед. удара',2.1);
 return damage-blocked;
}

const distanceToSegment=(x,y,ax,ay,bx,by)=>{
 const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
 const t=den>0?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/den)):0;
 return Math.hypot(x-ax-dx*t,y-ay-dy*t);
};

export function markDashPass(game,previousX,previousY){
 if(!game.skillRanks.conduit||!game.player.burstRemaining)return 0;
 const p=game.player,s=game.fieldEvolution;
 let marked=0;
 for(const e of game.enemies){
  if(e.hp<=0||e.converted||e.boss||e.missionStructure||e.fieldMarkUntil>game.time)continue;
  if(distanceToSegment(e.x,e.y,previousX,previousY,p.x,p.y)<(e.r||18)+21){
   e.fieldMarkUntil=game.time+4;marked++;
   game.flash?.(previousX,previousY,e.x,e.y,'#78ffe0');
  }
 }
 if(marked)s.pulseAt=game.time;
 return marked;
}

export function fieldWeaponImpact(game,e){
 const s=game.fieldEvolution;
 if(!s||!e||e.hp<=0||e.converted)return;
 if(game.skillRanks.conduit&&e.fieldMarkUntil>game.time){
  e.fieldMarkUntil=0;e.fieldDischargeUntil=game.time+.65;
  const nearby=game.enemies.filter(o=>o.hp>0&&!o.converted&&!o.boss&&!o.missionStructure&&
   Math.hypot(o.x-e.x,o.y-e.y)<155).slice(0,3);
  for(const target of nearby){
   target.stasisUntil=Math.max(target.stasisUntil||0,game.time+1.25);
   game.flash?.(e.x,e.y,target.x,target.y,'#7affec');
  }
  s.pulseAt=game.time;
  game.heritage?.vfx?.nova?.(e.x,e.y,64,'cyan');
 }
 const marked=game.designatedTarget?.target===e&&game.designatedTarget.expiresAt>game.time;
 if(game.skillRanks.signal&&game.skillRanks.parasite&&marked&&s.charge>0&&
  e.hp>e.maxHp*.48&&!(e.parasiteSpyUntil>game.time)&&e.type!=='gunship'&&
  !e.boss&&!e.missionStructure&&(!s.spySerial||s.spyUntil<=game.time)){
  s.charge--;s.spySerial=e.serial;s.spyUntil=game.time+16;
  e.parasiteSpyUntil=s.spyUntil;
  game.heritage?.vfx?.nova?.(e.x,e.y,44,'green');
  game.notice?.('ПАРАЗИТ-ПЕРЕДАТЧИК · вражеское звено раскрывает себя на карте',3.5);
 }
}

export function updateFieldEvolution(game,dt){
 const s=game.fieldEvolution;if(!s)return;
 for(const w of s.wrecks){
  if(!w.alive)continue;
  w.x+=w.vx*dt;w.y+=w.vy*dt;
  const damp=Math.exp(-.8*dt);w.vx*=damp;w.vy*=damp;
  if(game.time>=w.until)w.alive=false;
 }
 s.wrecks=s.wrecks.filter(w=>w.alive);
 s.reveals=s.reveals.filter(r=>r.until>game.time);
 const spy=game.enemies.find(e=>e.serial===s.spySerial&&e.hp>0&&!e.converted);
 if(spy&&game.time<s.spyUntil&&game.time>=s.nextScanAt){
  s.nextScanAt=game.time+.4;
  const nearby=game.enemies.filter(e=>e.hp>0&&!e.converted&&e!==spy&&
   Math.hypot(e.x-spy.x,e.y-spy.y)<650).slice(0,6);
  s.reveals=[{x:spy.x,y:spy.y,serial:spy.serial,until:game.time+1.2},
   ...nearby.map(e=>({x:e.x,y:e.y,serial:e.serial,until:game.time+1.2}))];
 }else if(s.spySerial!==null){s.spySerial=null;s.spyUntil=0;}
}

export function updateParasitizedEnemy(e,game,dt){
 e.convertedTime-=dt;
 if(e.convertedTime<=0){
  e.hp=0;e.expAwarded=true;e.parasiteCapture=false;
  game.heritage?.vfx?.nova?.(e.x,e.y,27,'green');
  return;
 }
 const p=game.player;
 const foes=game.enemies.filter(o=>o.hp>0&&!o.converted&&!o.missionStructure&&
  Math.hypot(o.x-e.x,o.y-e.y)<420);
 foes.sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y));
 const target=foes[0],role=e.parasiteRole;
 const follow=role==='healer'?{x:p.x+40,y:p.y+54}:
  target||{x:p.x-65,y:p.y+68};
 const dx=follow.x-e.x,dy=follow.y-e.y,d=Math.hypot(dx,dy)||1;
 const speed=role==='scout'?255:role==='berserker'?270:role==='healer'?185:205;
 const acceleration=Math.min(1,dt*6);
 e.vx+=(dx/d*speed-e.vx)*acceleration;
 e.vy+=(dy/d*speed-e.vy)*acceleration;
 e.x+=e.vx*dt;e.y+=e.vy*dt;
 e.angle=Math.atan2(e.vy,e.vx)+Math.PI/2;
 e.fire=(e.fire??0)-dt;
 if(role==='healer'){
  if(e.fire<=0&&Math.hypot(e.x-p.x,e.y-p.y)<290){
   const patient=game.allies.filter(a=>a.hp>0&&a.hp<a.maxHp&&Math.hypot(a.x-e.x,a.y-e.y)<240)
    .sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
   const healed=patient||p;
   if(healed.hp<healed.maxHp){healed.hp=Math.min(healed.maxHp,healed.hp+6);
    e.fire=2.8;game.flash?.(e.x,e.y,healed.x,healed.y,'#9dffb6');}
  }
  return;
 }
 if(!target||game.holdFire)return;
 if(role==='scout'){
  if(e.fire<=0){e.fire=3.6;
   const near=foes.slice(0,3);
   for(const f of near){f.stasisUntil=Math.max(f.stasisUntil||0,game.time+.55);
    game.flash?.(e.x,e.y,f.x,f.y,'#8cf3ff');}
   if(!game.fieldEvolution.spySerial)
    game.fieldEvolution.reveals=foes.slice(0,6).map(f=>({x:f.x,y:f.y,
     serial:f.serial,until:game.time+3.6}));
  }
  return;
 }
 if(role==='berserker'){
  if(d<(e.r||19)+(target.r||19)+22){
   game.damageEnemy(target,24,e);
   game.heritage?.vfx?.nova?.(target.x,target.y,42,'cyan');
   e.hp=0;e.expAwarded=true;e.parasiteCapture=false;
  }
  return;
 }
 if(e.fire<=0&&d<340){
  e.fire=role==='gunship'?1.8:role==='flanker'?1.6:1.25;
  game.damageEnemy(target,role==='gunship'?15:role==='flanker'?8:10,e);
  if(role==='flanker')target.stasisUntil=Math.max(target.stasisUntil||0,game.time+.3);
  game.flash?.(e.x,e.y,target.x,target.y,'#6fffe4');
 }
}

const roleLabel=role=>({scout:'разведчик',healer:'ремонтник',fighter:'истребитель',
 flanker:'перехватчик',berserker:'таран',gunship:'артиллерист'})[role]||'дрон';
