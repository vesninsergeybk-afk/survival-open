/** Small, executable squad plans. They use delivered observations and real
 * member positions, never game.player. A plan changes destinations, not HP,
 * speed, fire rate or weapon accuracy. Planning is once per radio tick. */
export const ENEMY_SQUAD_PLANS=Object.freeze({
  horizon:18,phaseMinimums:Object.freeze([3.3,4.2,4.4]),
  phaseTimeout:8.5,maxLookAhead:.52,maxLead:88
});
const sequences=Object.freeze({
  press:Object.freeze(['press','pincer','intercept']),
  pincer:Object.freeze(['pincer','intercept','press']),
  intercept:Object.freeze(['intercept','pincer','press']),
  close:Object.freeze(['close','pincer','press']),
  scatter:Object.freeze(['scatter','pincer','intercept']),
  screen:Object.freeze(['screen','screen','screen'])
});
const counterSequences=Object.freeze({
  close:Object.freeze(['pincer','scatter','pincer']),
  area:Object.freeze(['scatter','pincer','scatter']),
  loss:Object.freeze(['scatter','pincer','scatter']),
  weak:Object.freeze(['press','intercept','press'])
});
const goals=Object.freeze({
  press:'сковать цель и перекрыть отход',
  pincer:'окружить цель',intercept:'отрезать путь отхода',
  close:'сократить дистанцию под прикрытием',
  scatter:'пережить обстрел и собраться вновь',
  screen:'сохранить ремонтное звено'
});
const roles=Object.freeze({
  anchor:'СКОВЫВАЕТ ЦЕЛЬ',left:'ЗАХОДИТ СЛЕВА',
  right:'ЗАХОДИТ СПРАВА',reserve:'ПРИКРЫВАЕТ ЗВЕНО'
});
const safe=(n,f=0)=>Number.isFinite(n)?n:f;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const basis=threat=>threat?.kind+'/' + (threat?.motion||threat?.site||'');

function assignRoles(members){
  const flying=members.filter(e=>e.hp>0&&!e.converted&&
    e.type!=='healer'&&!e.protect);
  const bySpeed=[...flying].sort((a,b)=>
    ({flanker:4,scout:3,fighter:2,berserker:1,gunship:0}[b.type]||0)-
    ({flanker:4,scout:3,fighter:2,berserker:1,gunship:0}[a.type]||0)||
    (a.serial||0)-(b.serial||0));
  const chosen=new Map();
  if(bySpeed.length>=3){
    const anchor=[...bySpeed].reverse().find(e=>e.type==='fighter'||e.type==='gunship')||bySpeed.at(-1);
    chosen.set(anchor,'anchor');
  }
  const others=bySpeed.filter(e=>!chosen.has(e));
  if(others[0])chosen.set(others[0],'left');
  if(others[1])chosen.set(others[1],'right');
  for(let i=2;i<others.length;i++)chosen.set(others[i],i%2?'right':'left');
  for(const member of members)if(!chosen.has(member))chosen.set(member,'reserve');
  return chosen;
}

export function createEnemySquadPlan(cell,mode,threat,now){
  if(!sequences[mode]||!cell?.intel||cell.intel.estimated||
     cell.members.filter(e=>e.hp>0&&!e.converted&&
       e.type!=='healer'&&!e.protect).length<2)return null;
  const modes=counterSequences[threat?.kind]||sequences[mode];
  return {id:(cell.planSerial=(cell.planSerial||0)+1),
    baseMode:modes[0],basis:basis(threat),
    observedAt:(threat?.mesh?threat.receivedAt:null)??threat?.lastAt??cell.intel.at,
    goal:goals[modes[0]],modes,
    phase:0,phaseAt:now,startedAt:now,
    until:now+ENEMY_SQUAD_PLANS.horizon,confirmed:false,
    roles:assignRoles(cell.members),
    origins:new Map(cell.members.map(e=>[e,{x:e.x,y:e.y}]))};
}

/** A new, independently corroborated danger can cancel an older plan. */
export function squadPlanObsolete(plan,threat,now,members=null,intel=null){
  if(!plan||now>=plan.until)return true;
  // A visible repaired hull is evidence *against* the old finishing push.
  // An obsolete weak-target report cannot sustain an 18-second attack bonus.
  if(plan.basis==='weak/'&&intel&&intel.at>plan.observedAt&&
     Number.isFinite(intel.hullRatio)&&intel.hullRatio>.43)return true;
  if(members)for(const [member,role] of plan.roles){
    if(role!=='reserve'&&(!members.includes(member)||member.hp<=0||
       member.converted))return true;
  }
  // A delayed radio report can be *new to this squad* even if the weapon
  // was seen earlier. Never change the original observation timestamp.
  const newest=(threat?.mesh?threat.receivedAt:null)??threat?.lastAt??-Infinity;
  return basis(threat)!==plan.basis&&newest>plan.observedAt+.15;
}

/** Roles must make measurable progress towards their assigned destinations.
 * Merely broadcasting a plan or waiting for a timer never completes a phase. */
export function squadPhaseProgress(plan,cell,now){
  if(!plan?.confirmed||!cell)return false;
  const progressed=new Set();
  for(const e of cell.members){
    const intent=e._commsIntent,origin=plan.origins.get(e);
    if(!origin||e.hp<=0||!intent||intent.planId!==plan.id||
       intent.planPhase!==plan.phase||now-intent.at>.8)continue;
    const moved=distance(e,origin),initial=distance(origin,intent),
      remaining=distance(e,intent);
    // Crossing a few pixels at the start of a 1,000-unit approach is not
    // executing a trap. Require meaningful relative progress as well as
    // displacement; short flanking lanes still use their absolute minimum.
    if(moved>=Math.max(52,Math.min(145,initial*.36))&&
       initial-remaining>=Math.max(27,initial*.30)&&
       remaining<=Math.max(90,initial*.62))
      progressed.add(squadRoleFor(plan,e));
  }
  const mode=squadPlanMode(plan);
  if(mode==='pincer')return progressed.has('left')&&progressed.has('right');
  if(mode==='scatter')return progressed.size>=2;
  return progressed.size>=1;
}

/** Advance only after real flight progress. An impossible phase times out and
 * is abandoned; the commander then chooses a new, imperfect plan. */
export function advanceEnemySquadPlan(plan,cell,now){
  if(!plan||!plan.confirmed)return false;
  const elapsed=now-plan.phaseAt;
  if(elapsed<ENEMY_SQUAD_PLANS.phaseMinimums[plan.phase])return false;
  if(plan.phase>=2)return false;
  if(!squadPhaseProgress(plan,cell,now))return false;
  plan.phase++;plan.phaseAt=now;plan.confirmed=false;
  plan.origins=new Map(cell.members.map(e=>[e,{x:e.x,y:e.y}]));
  return true;
}

export function squadPhaseExpired(plan,cell,now){
  return !!plan&&now-plan.phaseAt>ENEMY_SQUAD_PLANS.phaseTimeout&&
    !squadPhaseProgress(plan,cell,now);
}

export function squadRoleFor(plan,member){return plan?.roles?.get(member)||'reserve';}
export function squadPlanMode(plan){return plan?.modes[plan.phase]||null;}
export function squadPlanPhaseMessage(plan){
  if(!plan||plan.phase===0)return null;
  if(plan.baseMode==='screen')return 'Охранение перестроено. Ремонтника не бросать!';
  const mode=squadPlanMode(plan);
  if(mode==='scatter')return 'Отменить сближение. Разомкнуть строй!';
  if(mode==='pincer')return 'Сменить фланги. Держать обход!';
  if(mode==='intercept')return 'Перекрыть отход. Держать позиции!';
  if(mode==='close')return 'Сократить дистанцию под прикрытием!';
  return 'Продолжать давление. Не дать цели оторваться!';
}

export function squadRoleLabel(role,mode){
  if(mode==='screen')return 'ПРИКРЫВАЕТ РЕМОНТНИКА';
  if(mode==='scatter')return 'РАЗМЫКАЕТ СТРОЙ';
  if(mode==='close')return 'ИДЁТ НА СБЛИЖЕНИЕ';
  return roles[role]||null;
}

/** Position each role differently around the last *reported* point. Velocity
 * lead is intentionally small, fallible, and disabled for rough estimates. */
export function squadRoleDestination(member,order,point){
  const mode=order?.mode,role=order?.role;
  if(!order?.planId||!role||!point||point.remembered)return null;
  if(order.intel?.estimated)return null;
  if(!['pincer','intercept','press','close'].includes(mode))return null;
  const vX=safe(order.intel?.vx),vY=safe(order.intel?.vy);
  const velocity=Math.hypot(vX,vY);
  const dx=point.x-member.x,dy=point.y-member.y,d=Math.hypot(dx,dy)||1;
  const axisX=velocity>55?vX/velocity:dx/d;
  const axisY=velocity>55?vY/velocity:dy/d;
  const perpX=-axisY,perpY=axisX;
  const side=role==='left'?-1:role==='right'?1:0;
  const lead=mode==='intercept'&&velocity>55?
    clamp(velocity*ENEMY_SQUAD_PLANS.maxLookAhead,0,ENEMY_SQUAD_PLANS.maxLead):0;
  let ahead=0,lateral=0;
  if(mode==='pincer'){
    ahead=role==='anchor'?-145:role==='reserve'?-190:34;
    lateral=side*165;
  }else if(mode==='intercept'){
    ahead=(role==='anchor'?15:role==='reserve'?-120:82)+lead;
    lateral=side*103;
  }else if(mode==='press'){
    ahead=role==='anchor'?-165:role==='reserve'?-205:-105;
    lateral=side*95;
  }else if(mode==='close'){
    ahead=role==='anchor'?-195:role==='reserve'?-215:-145;
    lateral=side*70;
  }
  return {x:point.x+axisX*ahead+perpX*lateral,
    y:point.y+axisY*ahead+perpY*lateral};
}
