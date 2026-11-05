/** Short, witnessed cause-and-effect records. The industrial and radio systems
 * remain the source of truth; these entries never change enemy resources.
 * Undiscovered stations and invisible radio traffic must not reach this API. */
import {contourFields} from './territory-system.js?v=contours-1-world-feedback-1';
const html=s=>String(s).replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const visible=(p,cam,margin=90)=>p&&p.x>=cam.x-margin&&p.x<=cam.x+cam.w+margin&&
 p.y>=cam.y-margin&&p.y<=cam.y+cam.h+margin;
const bounded=s=>String(s||'').slice(0,160);

export function recordWorldFeedback(game,data){
 if(!game||!data?.cause||!data?.effect)return false;
 const now=Number(game.time)||0;
 const feed=game.worldFeedback??={history:[],pending:[],serial:0};
 const key=bounded(data.key||data.cause);
 if(feed.history.some(e=>e.key===key&&now-e.at>=0&&now-e.at<3))return false;
 const location=Number.isFinite(data.x)&&Number.isFinite(data.y)?
  {x:data.x,y:data.y}:null;
 const event={id:++feed.serial,key,at:now,kind:data.kind||'industry',
  label:bounded(data.label||'ИЗМЕНЕНИЕ В МИРЕ'),cause:bounded(data.cause),
  effect:bounded(data.effect),position:location};
 feed.history.unshift(event);
 if(feed.history.length>9)feed.history.length=9;
 if(data.notify){
  feed.pending.push(event);
  if(feed.pending.length>4)feed.pending.shift();
 }
 return true;
}

/** Summarize *actual* collector outcomes from advanceContours. No event means
 * no message, and a remote field never gets a world marker near the player. */
export function recordContourFeedback(game,events){
 if(!events?.length)return 0;
 const fields=new Map(contourFields(game.world).map(f=>[f.id,f]));
 let recorded=0;
 const lost=events.filter(e=>e.kind==='lost');
 if(lost.length){
  const field=fields.get(lost[0].fieldId);
  recorded+=Number(recordWorldFeedback(game,{key:'contour-collector-lost:'+Math.floor(game.time),
   kind:'loss',label:'СБОРЩИК УНИЧТОЖЕН',
   cause:'Противник перехватил '+(lost.length>1?'нескольких плазмофагов':'плазмофага'),
   effect:'Эти рейсы не принесли флюкс; новый сбор начнётся автоматически',
   x:Number.isFinite(lost[0].x)?lost[0].x:field?.center.x,
   y:Number.isFinite(lost[0].y)?lost[0].y:field?.center.y}));
 }
 const deliveries=events.filter(e=>e.kind==='delivered'&&e.amount>0);
 const total=deliveries.reduce((sum,e)=>sum+e.amount,0);
 if(total>.05){
  const field=fields.get(deliveries[0].fieldId);
  recorded+=Number(recordWorldFeedback(game,{key:'contour-flux:'+Math.floor(game.time),
   label:'ФЛЮКС ДОСТАВЛЕН',kind:'industry',
   cause:'Плазмофаги вернулись с флюксом',
   effect:'Запас вырос на '+total.toFixed(1)+'; в своём поле его можно обменять на щит',
   x:field?.anchor.x,y:field?.anchor.y}));
 }
 return recorded;
}

/** The only speaker for these notices is the existing cockpit message.
 * Wait for mission and combat warnings; don't overwrite them mid-sentence. */
export function advanceWorldFeedback(game){
 const feed=game?.worldFeedback;
 if(!feed?.pending.length||game.dead||game.paused||
    game.messageUntil>game.time+.06||typeof game.notice!=='function')return false;
 while(feed.pending.length&&game.time-feed.pending[0].at>24)feed.pending.shift();
 const event=feed.pending.shift();if(!event)return false;
 game.notice(event.cause+' → '+event.effect,4.2);
 return true;
}

export function renderWorldFeedbackMap(game){
 const entries=game?.worldFeedback?.history||[];
 if(!entries.length)return '';
 const latest=entries.slice(0,5);
 return '<details class="map-objective world-feedback-log" aria-label="Изменения мира">'+
  '<summary>Что произошло в мире · '+latest.length+'</summary>'+
  '<p>Здесь показаны только замеченные события и их последствия. Радиоперехваты доступны на ближней карте.</p>'+
  '<ol>'+latest.map(e=>'<li><strong>'+html(e.cause)+'</strong><span>→ '+
   html(e.effect)+'</span></li>').join('')+'</ol></details>';
}

/** Only physically local events receive a marker. Remote news stays in the
 * cockpit log; a marker at a concealed factory would reveal its coordinates. */
export function drawWorldFeedback(c,cam,game,reducedMotion=false,fps=60){
 if(!game?.worldFeedback?.history||fps<24)return 0;
 let drawn=0;const points=[];
 for(const e of game.worldFeedback.history){
  const p=e.position,age=game.time-e.at;
  if(drawn>=2||!p||age<0||age>4.5||!visible(p,cam)||
     points.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<165))continue;
  const a=Math.max(.12,1-age/4.5),r=44+(reducedMotion?0:age*8);
  c.save();c.globalAlpha=a;c.lineWidth=1.7;
  c.strokeStyle=e.kind==='loss'?'#ffca89':'#96e5f2';
  c.setLineDash([5,8]);c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.stroke();c.setLineDash([]);
  c.font='bold 10px system-ui';c.textAlign='center';
  const width=Math.min(238,Math.max(115,c.measureText(e.label).width+22));
  c.fillStyle='#092334e9';c.fillRect(p.x-width/2,p.y-82,width,22);
  c.strokeStyle=e.kind==='loss'?'#ffcc8d':'#a4e8f2';
  c.strokeRect(p.x-width/2,p.y-82,width,22);
  c.fillStyle=e.kind==='loss'?'#ffe0af':'#e2feff';
  c.fillText(e.label,p.x,p.y-67,width-12);
  c.restore();points.push(p);drawn++;
 }
 return drawn;
}

/** Victim investigates a *coarse* projectile bearing only while it has no
 * fresher visual sighting or delivered order. Its estimated point is secret. */
export function drawImpactInvestigation(c,cam,game){
 if(!game?.enemies||game.fps<24)return false;
 for(const e of game.enemies){
  const impact=e._awarenessImpact,age=game.time-(impact?.at??-Infinity);
  if(!impact||age<0||age>2.2||e.hp<=0||e.converted||
     !visible(e,cam,35)||e._enemyLearningSaw||
     (game.playerCanInspectEnemyIntent&&!game.playerCanInspectEnemyIntent(e))||
     game.time-(e._awarenessLast?.at??-Infinity)<4.8||
     game.time-(e._awarenessDispatch?.at??-Infinity)<9||
     game.enemyComms?.directiveFor?.(e,game.time)||
     game.enemyComms?.strategicDirectiveFor?.(e,game.time)||
     e.signalIntel?.combatFocus||
     (e.signalIntel?.lastSeenEstimated&&game.time-e.signalIntel.lastSeenAt<=4.8)||
     (e.encounterLabel&&game.time-(e.encounterLabelStart??game.time)<2.3)||
     e._commsObservationCue?.until>game.time)continue;
  // The marker is anchored to the ship, never to its invisible hypothesis.
  c.save();c.globalAlpha=Math.max(.18,1-age/2.2);
  c.textAlign='center';c.font='bold 10px system-ui';
  const w=179,y=e.y-e.r-42;
  c.fillStyle='#142533eb';c.fillRect(e.x-w/2,y-14,w,21);
  c.strokeStyle='#eac582';c.strokeRect(e.x-w/2,y-14,w,21);
  c.fillStyle='#ffe2a6';c.fillText('ИЩЕТ ИСТОЧНИК ОГНЯ',e.x,y,w-10);
  c.restore();return true;
 }
 return false;
}
