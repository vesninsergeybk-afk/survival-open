// Standalone mission simulator for Survivor: Protocol. No DOM or timers.
// A turn contains simultaneous movement, attacks and a hacking attempt.
export const FIELD=Object.freeze({width:1800,height:1060,turnSeconds:2.5,maxAllies:6,hackRange:225,relayRange:400,shotRange:365,boostStep:315,pulseRange:300,coverMultiplier:.48});
export const ROLES=Object.freeze({
 scout:{name:'Разведчик',hp:40,step:155,damage:8,range:270,hack:2},
 fighter:{name:'Истребитель',hp:74,step:112,damage:14,range:320,hack:3},
 medic:{name:'Ремонтник',hp:52,step:105,damage:5,range:260,hack:2},
 rocket:{name:'Ракетчик',hp:62,step:92,damage:19,range:375,hack:3},
 brawler:{name:'Перехватчик',hp:86,step:160,damage:17,range:160,hack:3},
 leader:{name:'Командир',hp:120,step:95,damage:16,range:340,hack:4},
 jammer:{name:'Глушитель',hp:56,step:98,damage:7,range:285,hack:3}
});
export const MISSIONS=Object.freeze([
 {id:'first-signal',name:'01 / Чужой сигнал',brief:'Соберите звено из двух кораблей. Взлом приносит союзника, выстрел снимает угрозу.',goal:'capture',required:2},
 {id:'broken-relay',name:'02 / Перехват ретранслятора',brief:'Захватите ретранслятор. Вражеский глушитель мешает удалённому взлому.',goal:'relay'},
 {id:'command-core',name:'03 / Обратный приказ',brief:'Подчините командный узел. Разведайте огневые линии и сохраните эскадрилью.',goal:'core'}
]);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const inside=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&p.x>=0&&p.x<=FIELD.width&&p.y>=0&&p.y<=FIELD.height;
const rnd=seed=>{let s=(seed>>>0)||1;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;}};
const makeShip=(id,role,x,y,side='enemy')=>({id,role,side,x,y,hp:ROLES[role].hp,maxHp:ROLES[role].hp,hack:0,suppressed:0,lastX:x,lastY:y});
const ARRANGEMENTS=[
 [['scout',750,375],['scout',820,610],['fighter',1040,510],['medic',1200,730]],
 [['scout',740,380],['fighter',920,520],['medic',1180,340],['rocket',1300,750],['fighter',1510,470],['jammer',1250,685]],
 [['fighter',700,325],['scout',810,730],['leader',1040,515],['medic',1300,760],['jammer',1320,710]]
];
export function createMission(index=0,seed=1729,retained=null){
 const mission=clamp(Math.trunc(index)||0,0,MISSIONS.length-1),random=rnd(seed+mission*311);
 const ships=ARRANGEMENTS[mission].map((a,i)=>makeShip('hostile-'+mission+'-'+i,a[0],clamp(a[1]+(random()-.5)*105,100,FIELD.width-80),clamp(a[2]+(random()-.5)*100,100,FIELD.height-80)));
 const carried=(retained?.ships||[]).filter(s=>s.side==='ally'&&s.hp>0).slice(0,FIELD.maxAllies);
 carried.forEach((s,i)=>ships.push({...makeShip('ally-'+mission+'-'+i,s.role,300+(i%3)*46,480+Math.floor(i/3)*65,'ally'),hp:clamp(s.hp+16,1,ROLES[s.role].hp)}));
 const stations=mission===0?[]:[{id:mission===1?'relay':'core',role:mission===1?'relay':'core',x:mission===1?1120:1250,y:510,side:'enemy',hp:mission===1?120:180,maxHp:mission===1?120:180,hack:0}];
 const asteroids=[{x:500,y:410,r:78},{x:915,y:740,r:68},...Array.from({length:7},()=>({x:clamp(320+random()*1180,170,1650),y:clamp(130+random()*770,130,920),r:24+random()*30}))];
 const startingHp=Number.isFinite(retained?.player?.hp)?clamp(retained.player.hp+24,40,110):110;
 const startingCharge=Number.isFinite(retained?.player?.charge)?clamp(retained.player.charge+1,0,2):2;
 const networkSlots=Math.max(0,Math.min(4,Math.trunc(retained?.networkSlots||0)));
 const entry=retained?{player:retained.player?{hp:retained.player.hp,charge:retained.player.charge??1}:null,ships:(retained.ships||[]).map(u=>({...u})),networkSlots}:null;
 return {version:2,mission,seed,turn:0,networkSlots,entry,player:{x:220,y:530,hp:startingHp,maxHp:110,charge:startingCharge,maxCharge:2},ships,stations,asteroids,phase:'planning',message:'Выберите действие, точку движения и приказ эскадрилье.',events:[],lastPlan:null};
}
export function getUnit(state,id){
 if(id==='player')return state.player;
 return state.ships.find(s=>s.id===id)||state.stations.find(s=>s.id===id)||null;
}
export const aliveEnemies=state=>state.ships.filter(s=>s.side==='enemy'&&s.hp>0);
export const aliveAllies=state=>state.ships.filter(s=>s.side==='ally'&&s.hp>0);
export function nearestEnemy(state,point){
 return aliveEnemies(state).slice().sort((a,b)=>distance(a,point)-distance(b,point))[0]||null;
}
export const isJammed=(state,target)=>aliveEnemies(state).some(u=>u.role==='jammer'&&u.id!==target.id&&(u.suppressed||0)===0&&distance(u,target)<280);
export function canRelay(state,target){
 if(distance(state.player,target)<=FIELD.hackRange)return {ok:true,via:null};
 if(isJammed(state,target))return {ok:false,via:null,jammed:true};
 const relay=aliveAllies(state).find(a=>distance(a,target)<=FIELD.hackRange&&distance(a,state.player)<=FIELD.relayRange);
 return relay?{ok:true,via:relay.id}:{ok:false,via:null};
}
export function hackNeed(state,target){
 const base=target.role==='core'?4:target.role==='relay'?3:
  Math.max(1,(ROLES[target.role]?.hack||3)-(state.stations.some(s=>s.role==='relay'&&s.side==='ally')?1:0));
 return base+(isJammed(state,target)?1:0);
}
export const tacticalCapacity=state=>Math.min(FIELD.maxAllies,2+Math.max(0,Math.min(4,state.networkSlots||0))+state.stations.filter(s=>s.role==='relay'&&s.side==='ally').length*2);
export function normalizePlan(state,plan={}){
 const destination=inside(plan.destination)?{x:plan.destination.x,y:plan.destination.y}:{x:state.player.x,y:state.player.y};
 const target=getUnit(state,plan.targetId);
 const action=['hack','shot','boost','pulse'].includes(plan.action)?plan.action:'hack';
 const formation=['escort','strike','relay'].includes(plan.formation)?plan.formation:'escort';
 return {destination,action,formation,targetId:target?.hp>0&&target.side==='enemy'?plan.targetId:null};
}
const move=(entity,destination,maxStep)=>{
 entity.lastX=entity.x;entity.lastY=entity.y;
 const dx=destination.x-entity.x,dy=destination.y-entity.y,d=Math.hypot(dx,dy)||1;
 const k=Math.min(1,maxStep/d);entity.x=clamp(entity.x+dx*k,35,FIELD.width-35);entity.y=clamp(entity.y+dy*k,35,FIELD.height-35);
};
const aimForEnemy=(state,enemy)=>{
 // After capture, the counterattack targets the relay rather than chasing only the pilot.
 const protectedNode=state.stations.find(n=>n.role==='relay'&&n.side==='ally');
 if(protectedNode&&Number.isInteger(state.securedAt)&&distance(enemy,protectedNode)<560)return protectedNode;
 const choices=[{...state.player,id:'player',side:'player'},...aliveAllies(state)];
 choices.sort((a,b)=>distance(a,enemy)-distance(b,enemy));
 return choices[0];
};

const formationPoint=(player,index)=>{
 const angle=2.25+(index%4)*.40,radius=98+Math.floor(index/4)*65;
 return {x:player.x+Math.cos(angle)*radius,y:player.y+Math.sin(angle)*radius};
};
function advanceFormation(state,plan){
 move(state.player,plan.destination,plan.action==='boost'?FIELD.boostStep:190);
 const marked=plan.targetId?getUnit(state,plan.targetId):null;
 aliveAllies(state).forEach((ally,i)=>{
  const nearby=nearestEnemy(state,ally);
  const objective=plan.formation==='relay'&&marked?marked:
   plan.formation==='strike'?(nearby||marked):null;
  const follow=formationPoint(state.player,i);
  const destination=objective&&distance(ally,objective)>115?objective:follow;
  move(ally,destination,ROLES[ally.role].step);
 });
 for(const enemy of aliveEnemies(state)){
  const goal=aimForEnemy(state,enemy),role=ROLES[enemy.role],d=distance(enemy,goal);
  if(d>role.range*.70)move(enemy,goal,role.step);
  else {enemy.lastX=enemy.x;enemy.lastY=enemy.y;}
 }
}
export function coverBetween(state,from,to){
 if(!state.asteroids?.length)return false;
 const dx=to.x-from.x,dy=to.y-from.y,len=dx*dx+dy*dy;
 if(len<1)return false;
 return state.asteroids.some(rock=>{
  const t=clamp(((rock.x-from.x)*dx+(rock.y-from.y)*dy)/len,.03,.97);
  const x=from.x+t*dx,y=from.y+t*dy;
  return Math.hypot(rock.x-x,rock.y-y)<rock.r*.90&&
   distance(rock,from)>rock.r*.8&&distance(rock,to)>rock.r*.8;
 });
}
const WAVES=Object.freeze([
 [{turn:6,role:'fighter',y:190}],
 [{turn:6,role:'rocket',y:810},{turn:10,role:'scout',y:210}],
 [{turn:6,role:'fighter',y:200},{turn:10,role:'rocket',y:835}]
]);
export function nextReinforcement(state){
 return (WAVES[state.mission]||[]).find(w=>w.turn>state.turn)||null;
}
function enemyVolley(state,plan,pulseActive=false){
 const shots=[];
 for(const enemy of aliveEnemies(state)){
  if(enemy.suppressed>0||pulseActive&&distance(state.player,enemy)<=FIELD.pulseRange)continue;
  if((state.turn+(Number(enemy.id.slice(-1))||0))%2===0)continue;
  const intended=aimForEnemy(state,enemy);
  if(distance(enemy,intended)>ROLES[enemy.role].range)continue;
  const cover=coverBetween(state,enemy,intended);
  const evasive=plan.action==='boost'&&intended.id==='player';
  const factor=(cover?FIELD.coverMultiplier:1)*(evasive?.50:1);
  shots.push({from:{id:enemy.id,x:enemy.x,y:enemy.y},
   to:{id:intended.id||'player',x:intended.x,y:intended.y},
   amount:Math.max(1,Math.round(ROLES[enemy.role].damage*factor)),cover,evasive,role:enemy.role});
 }
 return shots;
}
// Exactly the same movement and hostile-fire calculations drive the tactical preview.
export function forecastTurn(input,requested={}){
 if(input.phase!=='planning')return {shots:[],incoming:0,position:{...input.player},pulseActive:false,canHack:false};
 const state=structuredClone(input),plan=normalizePlan(state,requested);
 state.turn++;
 const pulseActive=plan.action==='pulse'&&(state.player.charge||0)>0;
 advanceFormation(state,plan);
 const shots=enemyVolley(state,plan,pulseActive),target=plan.targetId?getUnit(state,plan.targetId):null;
 return {shots,incoming:shots.filter(s=>s.to.id==='player').reduce((sum,s)=>sum+s.amount,0),
  position:{...state.player},target:target?{...target}:null,
  canHack:!!target&&canRelay(state,target).ok,pulseActive,
  hasCover:shots.some(s=>s.to.id==='player'&&s.cover),
  nextWave:nextReinforcement(input)};
}
function spawnWave(state,events){
 for(const [i,wave] of (WAVES[state.mission]||[]).entries()){
  if(wave.turn!==state.turn)continue;
  const u=makeShip('reserve-'+state.mission+'-'+i,wave.role,1640,wave.y,'enemy');
  state.ships.push(u);
  events.push({kind:'reserve',target:u.id,role:u.role,text:'Противник ввёл резерв: '+ROLES[u.role].name.toLowerCase()+'.'});
 }
}
export function resolveTurn(input,requested){
 if(input.phase!=='planning')return input;
 const state=structuredClone(input),plan=normalizePlan(state,requested),events=[];
 state.turn++;state.lastPlan=plan;
 const pulseActive=plan.action==='pulse'&&(state.player.charge||0)>0;
 advanceFormation(state,plan);
 if(pulseActive){
  state.player.charge--;
  events.push({kind:'pulse',text:'Импульс подавления: противники рядом пропускают залп.'});
 }else if(plan.action==='pulse'){
  events.push({kind:'message',text:'Зарядов импульса нет. Выберите другой приказ.'});
 }
 const target=plan.targetId?getUnit(state,plan.targetId):null;
 const damage=new Map();
 const hit=(who,amount,from,kind)=>{
  if(!who||who.hp<=0)return;
  damage.set(who.id||'player',(damage.get(who.id||'player')||0)+amount);
  events.push({kind:'shot',from:from.id||'player',to:who.id||'player',amount,weapon:kind});
 };
 let capture=null,staggered=null;
 if(target&&target.hp>0&&target.side==='enemy'){
  if(plan.action==='shot'){
   if(distance(state.player,target)<=FIELD.shotRange){
    const covered=coverBetween(state,state.player,target);
    hit(target,Math.round(28*(covered?FIELD.coverMultiplier:1)),state.player,'manual');
    if(state.ships.includes(target))staggered=target;
    events.push({kind:'message',text:covered?'Выстрел через укрытие: урон снижен.':'Попадание! Цель будет подавлена на следующий ход.'});
   }else events.push({kind:'message',text:'Цель вне дальности ручной пушки.'});
  }else if(plan.action==='hack'){
   const route=canRelay(state,target);
   if(route.ok){
    const assisting=plan.formation==='relay'&&aliveAllies(state).some(a=>
     distance(a,target)<=FIELD.hackRange&&distance(a,state.player)<=FIELD.relayRange);
    target.hack=(target.hack||0)+(assisting?2:1);
    const need=hackNeed(state,target);
    events.push({kind:'hack',target:target.id,progress:target.hack,need,via:route.via,assisting});
    if(target.hack>=need)capture=target;
   }else events.push({kind:'message',text:route.jammed?'Глушитель перекрыл передачу. Приблизьтесь или подавите помеху.':'Для взлома приблизьтесь сами или подведите союзника-передатчика.'});
  }
 }
 // A threatened target is deliberately spared. The relay directive sacrifices firepower for hacking speed.
 for(const ally of aliveAllies(state)){
  if(ally.role==='medic'){
   const injured=[state.player,...aliveAllies(state),...state.stations.filter(x=>x.side==='ally')].filter(x=>x.hp<x.maxHp&&distance(x,ally)<275).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
   if(injured){injured.hp=Math.min(injured.maxHp,injured.hp+12);events.push({kind:'heal',from:ally.id,to:injured.id||'player'});}
   continue;
  }
  if(plan.formation==='relay')continue;
  const foes=aliveEnemies(state).filter(e=>!(plan.action==='hack'&&target?.id===e.id));
  foes.sort((a,b)=>distance(a,ally)-distance(b,ally));
  const victim=foes.find(e=>distance(e,ally)<=ROLES[ally.role].range);
  if(victim){
   const power=ROLES[ally.role].damage*(plan.formation==='strike'?1.35:1)*(coverBetween(state,ally,victim)?FIELD.coverMultiplier:1);
   hit(victim,Math.max(1,Math.round(power)),ally,'ally');
  }
 }
 // Simultaneous return fire: a ship hit this turn still completes its scheduled shot.
 const volleys=enemyVolley(state,plan,pulseActive);
 for(const shot of volleys)hit(getUnit(state,shot.to.id),shot.amount,getUnit(state,shot.from.id),'enemy');
 for(const enemy of aliveEnemies(state)){
  if(enemy.suppressed>0)enemy.suppressed--;
  if(pulseActive&&distance(state.player,enemy)<=FIELD.pulseRange)enemy.suppressed=Math.max(enemy.suppressed,1);
 }
 if(staggered)staggered.suppressed=Math.max(staggered.suppressed,1);
 for(const [id,total] of damage){
  const victim=getUnit(state,id);
  if(victim){
   // Mission nodes are objectives, never destructible dead ends. Weapons can
   // suppress their hull to a critical state, but only hacking claims them.
   const missionNode=state.stations.some(st=>st.id===id&&st.side==='enemy');
   victim.hp=Math.max(missionNode?1:0,victim.hp-total);
  }
 }
 for(const ship of state.ships)if(ship.hp<=0)events.push({kind:'lost',target:ship.id,side:ship.side});
 if(capture&&capture.hp>0){
  if(capture.role==='relay'||capture.role==='core'){
   capture.side='ally';capture.hack=0;
   events.push({kind:'captured',target:capture.id,role:capture.role,station:true});
   if(capture.role==='relay'&&state.mission===1){
    state.securedAt=state.turn;
    state.ships.push(makeShip('raid-relay-fighter','fighter',1470,360,'enemy'));
    state.ships.push(makeShip('raid-relay-rocket','rocket',1500,670,'enemy'));
    events.push({kind:'raid',text:'Ретранслятор захвачен! Враг начинает контратаку: удерживайте узел ещё три хода.'});
   }
  }else if(aliveAllies(state).length<tacticalCapacity(state)){
   capture.side='ally';capture.hack=0;capture.suppressed=0;
   state.player.charge=Math.min(state.player.maxCharge||2,(state.player.charge||0)+1);
   events.push({kind:'captured',target:capture.id,role:capture.role,station:false});
  }else{
   capture.hack=0;capture.suppressed=2;
   events.push({kind:'overload',target:capture.id,text:'Канал управления заполнен: цель обезоружена на два хода.'});
  }
 }
 // Losing contact for one turn is tolerable; idle progress then decays.
 for(const entity of [...state.ships,...state.stations]){
  if(entity.id!==plan.targetId&&entity.hack>0)entity.hack=Math.max(0,entity.hack-1);
 }
 state.ships=state.ships.filter(s=>s.hp>0);
 state.events=events;
 const mission=MISSIONS[state.mission];
 const defendedRelay=state.stations.find(n=>n.role==='relay'&&n.side==='ally');
 if(state.player.hp<=0){state.phase='lost';state.message='Корабль уничтожен. Повторите миссию.';}
 else if(defendedRelay&&defendedRelay.hp<=0){state.phase='lost';state.message='Ретранслятор уничтожен. Операция провалена.';}
 else if((mission.goal==='capture'&&aliveAllies(state).length>=mission.required)||
   (mission.goal==='relay'&&defendedRelay&&state.turn-state.securedAt>=3)||
   (mission.goal==='core'&&state.stations.some(s=>s.role==='core'&&s.side==='ally'))){
  state.phase='won';state.message=state.mission===MISSIONS.length-1?'Командный узел захвачен. Кампания завершена!':'Задача выполнена. Можно перейти к следующей миссии.';
 }else if(mission.goal==='capture'&&aliveEnemies(state).length+aliveAllies(state).length<mission.required&&
  !(WAVES[state.mission]||[]).some(w=>w.turn>state.turn)){
  state.phase='lost';state.message='Недостаточно целей для перепрограммирования. Попробуйте ещё раз.';
 }else{
  spawnWave(state,events);
  const last=events.findLast(e=>e.kind==='captured'||e.kind==='overload'||e.kind==='message'||e.kind==='hack'||e.kind==='reserve'||e.kind==='pulse');
  state.message=mission.goal==='relay'&&defendedRelay?
   'Оборона ретранслятора: осталось '+(3-(state.turn-state.securedAt))+' хода. Целостность '+Math.ceil(defendedRelay.hp)+'/'+defendedRelay.maxHp+'.':
   last?.kind==='captured'?'Захват успешен! '+(ROLES[last.role]?.name||'Узел')+' теперь на вашей стороне.':
   last?.kind==='hack'?'Загрузка управляющего кода: '+last.progress+'/'+last.need+'.':
   last?.text||'Приказы выполнены. Спланируйте следующий ход.';
 }
 return state;
}
export function nextMission(state){
 return state.phase==='won'&&state.mission<MISSIONS.length-1?createMission(state.mission+1,state.seed,{player:state.player,ships:aliveAllies(state),
  // A captured relay grants permanent command bandwidth across later missions.
  networkSlots:Math.min(4,(state.networkSlots||0)+
   (state.stations.some(s=>s.role==='relay'&&s.side==='ally')?2:0))}):state;
}
