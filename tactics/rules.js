// Standalone mission simulator for Survivor: Protocol. No DOM or timers.
// A turn contains simultaneous movement, attacks and a hacking attempt.
export const FIELD=Object.freeze({width:1800,height:1060,turnSeconds:2.5,maxAllies:6,hackRange:225,relayRange:400,shotRange:365});
export const ROLES=Object.freeze({
 scout:{name:'Разведчик',hp:40,step:155,damage:8,range:270,hack:2},
 fighter:{name:'Истребитель',hp:74,step:112,damage:14,range:320,hack:3},
 medic:{name:'Ремонтник',hp:52,step:105,damage:5,range:260,hack:2},
 rocket:{name:'Ракетчик',hp:62,step:92,damage:19,range:375,hack:3},
 brawler:{name:'Перехватчик',hp:86,step:160,damage:17,range:160,hack:3},
 leader:{name:'Командир',hp:120,step:95,damage:16,range:340,hack:4}
});
export const MISSIONS=Object.freeze([
 {id:'first-signal',name:'01 / Чужой сигнал',brief:'Перехватите два корабля. Каждый противник — возможный союзник.',goal:'capture',required:2},
 {id:'broken-relay',name:'02 / Перехват ретранслятора',brief:'Захватите ретранслятор. Ваши корабли могут служить передатчиками сигнала.',goal:'relay'},
 {id:'command-core',name:'03 / Обратный приказ',brief:'Подчините командный узел, пока противник удерживает оборону.',goal:'core'}
]);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const inside=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&p.x>=0&&p.x<=FIELD.width&&p.y>=0&&p.y<=FIELD.height;
const rnd=seed=>{let s=(seed>>>0)||1;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;}};
const makeShip=(id,role,x,y,side='enemy')=>({id,role,side,x,y,hp:ROLES[role].hp,maxHp:ROLES[role].hp,hack:0,suppressed:0,lastX:x,lastY:y});
const ARRANGEMENTS=[
 [['scout',750,375],['scout',820,610],['fighter',1040,510],['medic',1200,730]],
 [['scout',740,380],['fighter',920,520],['medic',1180,340],['rocket',1300,750],['fighter',1510,470]],
 [['fighter',700,325],['scout',810,730],['leader',1040,515],['medic',1300,760]]
];
export function createMission(index=0,seed=1729,retained=null){
 const mission=clamp(Math.trunc(index)||0,0,MISSIONS.length-1),random=rnd(seed+mission*311);
 const ships=ARRANGEMENTS[mission].map((a,i)=>makeShip('hostile-'+mission+'-'+i,a[0],clamp(a[1]+(random()-.5)*105,100,FIELD.width-80),clamp(a[2]+(random()-.5)*100,100,FIELD.height-80)));
 const carried=(retained?.ships||[]).filter(s=>s.side==='ally'&&s.hp>0).slice(0,FIELD.maxAllies);
 carried.forEach((s,i)=>ships.push({...makeShip('ally-'+mission+'-'+i,s.role,300+(i%3)*46,480+Math.floor(i/3)*65,'ally'),hp:clamp(s.hp+16,1,ROLES[s.role].hp)}));
 const stations=mission===0?[]:[{id:mission===1?'relay':'core',role:mission===1?'relay':'core',x:mission===1?1120:1250,y:510,side:'enemy',hp:180,hack:0}];
 const asteroids=Array.from({length:9},(_,i)=>({x:clamp(300+random()*1200,170,1650),y:clamp(150+random()*760,130,920),r:19+random()*27}));
 return {version:1,mission,seed,turn:0,networkSlots:Math.max(0,Math.min(4,Math.trunc(retained?.networkSlots||0))),player:{x:220,y:530,hp:110,maxHp:110},ships,stations,asteroids,phase:'planning',message:'Выберите цель и направление, затем выполните ход.',events:[],lastPlan:null};
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
export function canRelay(state,target){
 // One captured vessel can forward the player's own hacking signal.
 if(distance(state.player,target)<=FIELD.hackRange)return {ok:true,via:null};
 const relay=aliveAllies(state).find(a=>distance(a,target)<=FIELD.hackRange&&distance(a,state.player)<=FIELD.relayRange);
 return relay?{ok:true,via:relay.id}:{ok:false,via:null};
}
export function hackNeed(state,target){
 if(target.role==='core')return 4;
 if(target.role==='relay')return 3;
 return Math.max(1,(ROLES[target.role]?.hack||3)-(state.stations.some(s=>s.role==='relay'&&s.side==='ally')?1:0));
}
export const tacticalCapacity=state=>Math.min(FIELD.maxAllies,2+Math.max(0,Math.min(4,state.networkSlots||0))+state.stations.filter(s=>s.role==='relay'&&s.side==='ally').length*2);
export function normalizePlan(state,plan={}){
 const destination=inside(plan.destination)?{x:plan.destination.x,y:plan.destination.y}:{x:state.player.x,y:state.player.y};
 const target=getUnit(state,plan.targetId);
 return {destination,action:plan.action==='shot'?'shot':'hack',targetId:target?.hp>0&&target.side==='enemy'?plan.targetId:null};
}
const move=(entity,destination,maxStep)=>{
 entity.lastX=entity.x;entity.lastY=entity.y;
 const dx=destination.x-entity.x,dy=destination.y-entity.y,d=Math.hypot(dx,dy)||1;
 const k=Math.min(1,maxStep/d);entity.x=clamp(entity.x+dx*k,35,FIELD.width-35);entity.y=clamp(entity.y+dy*k,35,FIELD.height-35);
};
const aimForEnemy=(state,enemy)=>{
 const choices=[{...state.player,id:'player',side:'player'},...aliveAllies(state)];
 choices.sort((a,b)=>distance(a,enemy)-distance(b,enemy));
 return choices[0];
};
export function resolveTurn(input,requested){
 if(input.phase!=='planning')return input;
 const state=structuredClone(input),plan=normalizePlan(state,requested),events=[];
 state.turn++;state.lastPlan=plan;
 move(state.player,plan.destination,190);
 const marked=plan.targetId?getUnit(state,plan.targetId):null;
 for(const ally of aliveAllies(state)){
  const guard=marked&&marked.side==='enemy'?marked:null;
  const follow={x:state.player.x+Math.cos(ally.id.length*2.2)*92,y:state.player.y+Math.sin(ally.id.length*2.2)*92};
  const destination=guard&&distance(ally,guard)>ROLES[ally.role].range*.8?guard:follow;
  move(ally,destination,ROLES[ally.role].step);
 }
 for(const enemy of aliveEnemies(state)){
  const goal=aimForEnemy(state,enemy),role=ROLES[enemy.role],d=distance(enemy,goal);
  if(d>role.range*.70)move(enemy,goal,role.step);
  else {enemy.lastX=enemy.x;enemy.lastY=enemy.y;}
 }
 const target=plan.targetId?getUnit(state,plan.targetId):null;
 const damage=new Map();
 const hit=(who,amount,from,kind)=>{
  if(!who||who.hp<=0)return;
  damage.set(who.id||'player',(damage.get(who.id||'player')||0)+amount);
  events.push({kind:'shot',from:from.id||'player',to:who.id||'player',amount,weapon:kind});
 };
 let capture=null;
 if(target&&target.hp>0&&target.side==='enemy'){
  if(plan.action==='shot'){
   if(distance(state.player,target)<=FIELD.shotRange){hit(target,28,state.player,'manual');events.push({kind:'message',text:'Ручной выстрел по цели.'});}
   else events.push({kind:'message',text:'Цель вне дальности ручной пушки.'});
  }else{
   const route=canRelay(state,target);
   if(route.ok){
    // Station links are useful but an enemy guard can still fight during hacking.
    target.hack=(target.hack||0)+1;
    const need=hackNeed(state,target);
    events.push({kind:'hack',target:target.id,progress:target.hack,need,via:route.via});
    if(target.hack>=need)capture=target;
   }else events.push({kind:'message',text:'Для взлома приблизьтесь сами или подведите союзника-передатчика.'});
  }
 }
 // A threatened target is deliberately spared by automatic escorts.
 for(const ally of aliveAllies(state)){
  if(ally.role==='medic'){
   const injured=[state.player,...aliveAllies(state)].filter(x=>x.hp<x.maxHp&&distance(x,ally)<275).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
   if(injured){injured.hp=Math.min(injured.maxHp,injured.hp+12);events.push({kind:'heal',from:ally.id,to:injured.id||'player'});}
   continue;
  }
  const foes=aliveEnemies(state).filter(e=>!(plan.action==='hack'&&target?.id===e.id));
  foes.sort((a,b)=>distance(a,ally)-distance(b,ally));
  const victim=foes.find(e=>distance(e,ally)<=ROLES[ally.role].range);
  if(victim)hit(victim,ROLES[ally.role].damage,ally,'ally');
 }
 // All enemy shots are scheduled before damage or capture takes effect.
 for(const enemy of aliveEnemies(state)){
  if(enemy.suppressed>0){enemy.suppressed--;continue;}
  const intended=aimForEnemy(state,enemy);
  // Enemy weapons reload every other turn. Different units alternate shots,
  // preventing a synchronized opening volley from deciding the entire mission.
  if((state.turn+(Number(enemy.id.slice(-1))||0))%2===0)continue;
  if(distance(enemy,intended)<=ROLES[enemy.role].range)
   hit(intended,ROLES[enemy.role].damage,enemy,'enemy');
 }
 for(const [id,total] of damage){
  const victim=getUnit(state,id);
  if(victim){
   // Mission nodes are objectives, never destructible dead ends. Weapons can
   // suppress their hull to a critical state, but only hacking claims them.
   const missionNode=state.stations.some(st=>st.id===id);
   victim.hp=Math.max(missionNode?1:0,victim.hp-total);
  }
 }
 for(const ship of state.ships)if(ship.hp<=0)events.push({kind:'lost',target:ship.id,side:ship.side});
 if(capture&&capture.hp>0){
  if(capture.role==='relay'||capture.role==='core'){
   capture.side='ally';capture.hack=0;
   events.push({kind:'captured',target:capture.id,role:capture.role,station:true});
  }else if(aliveAllies(state).length<tacticalCapacity(state)){
   capture.side='ally';capture.hack=0;
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
 if(state.player.hp<=0){state.phase='lost';state.message='Корабль уничтожен. Повторите миссию.';}
 else if((mission.goal==='capture'&&aliveAllies(state).length>=mission.required)||
   (mission.goal!=='capture'&&state.stations.some(s=>s.role===mission.goal&&s.side==='ally'))){
  state.phase='won';state.message=state.mission===MISSIONS.length-1?'Командный узел захвачен. Кампания завершена!':'Задача выполнена. Можно перейти к следующей миссии.';
 }else if(mission.goal==='capture'&&aliveEnemies(state).length+aliveAllies(state).length<mission.required){
  state.phase='lost';state.message='Недостаточно целей для перепрограммирования. Попробуйте ещё раз.';
 }else{
  const last=events.findLast(e=>e.kind==='captured'||e.kind==='overload'||e.kind==='message'||e.kind==='hack');
  state.message=last?.kind==='captured'?'Захват успешен! '+(ROLES[last.role]?.name||'Узел')+' теперь на вашей стороне.':
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
