/** Radio-directed movement intentions, as opposed to arbitrary decoration.
 * Only a currently acknowledged order that actually changed steering may
 * produce a line. The short segment is a heading, not a guaranteed path. */
export const ENEMY_INTENT_VIEW=Object.freeze({
  radius:440, maxWorld:4, maxMap:3, maxHeading:195, maxAge:.28
});

const colors=Object.freeze({
  press:'#fa907d',pincer:'#f3c17a',intercept:'#d7a2f4',screen:'#80d9c4',
  close:'#ff9c7b',scatter:'#e2c477'
});
const labels=Object.freeze({
  press:'нажим',pincer:'обход',intercept:'перехват',screen:'прикрытие',
  close:'сближение',scatter:'рассредоточение'
});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);

/** Used by both the world renderer and the navigation map. No order = no line.
 * Reading this collection cannot affect the choices made by an enemy. */
export function collectEnemyIntents(game,options={}){
  const now=game?.time;
  if(!Number.isFinite(now)||!finitePoint(game.player)||
     !game.enemyComms?.directiveFor)return [];
  const radius=options.radius??ENEMY_INTENT_VIEW.radius;
  const limit=Math.max(0,Math.min(8,options.max??ENEMY_INTENT_VIEW.maxWorld));
  const eligible=[];
  for(const e of game.enemies||[]){
    const intent=e._commsIntent;
    if(!e.hp||e.hp<=0||e.converted||!intent||
       !finitePoint(e)||!finitePoint(intent)||
       now-intent.at<0||now-intent.at>ENEMY_INTENT_VIEW.maxAge||
       distance(e,game.player)>radius||
       options.visibleOnly&&!game.playerCanInspectEnemyIntent?.(e))continue;
    // An intercepted or expired transmission invalidates the drawing even
    // if the old movement target remains on the ship for one more frame.
    const order=game.enemyComms.directiveFor(e,now);
    if(!order||order.mode!==intent.mode||order.leader!==intent.leader)continue;
    const dx=intent.x-e.x,dy=intent.y-e.y,length=Math.hypot(dx,dy);
    if(length<22)continue;
    const ratio=Math.min(1,ENEMY_INTENT_VIEW.maxHeading/length);
    eligible.push({ship:e,mode:intent.mode,color:colors[intent.mode],
      label:labels[intent.mode],x:e.x,y:e.y,
      toX:e.x+dx*ratio,toY:e.y+dy*ratio,
      group:e._commsCell?.id??-1,
      distance:distance(e,game.player)});
  }
  eligible.sort((a,b)=>a.distance-b.distance);
  // One sector cannot fill the screen with 7 identical parallel arrows.
  const perGroup=new Map(),result=[];
  for(const e of eligible){
    if(result.length>=limit)break;
    const used=perGroup.get(e.group)||0;
    if(used>=2)continue;
    perGroup.set(e.group,used+1);result.push(e);
  }
  return result;
}

export function drawEnemyIntentions(ctx,cam,game,reducedMotion=false,fps=60){
  const paths=collectEnemyIntents(game,{max:fps<28?2:ENEMY_INTENT_VIEW.maxWorld,
    visibleOnly:true});
  let drawn=0;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  for(const path of paths){
    if(!(path.x>=cam.x-30&&path.x<=cam.x+cam.w+30&&
         path.y>=cam.y-30&&path.y<=cam.y+cam.h+30))continue;
    const dx=path.toX-path.x,dy=path.toY-path.y;
    const length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length;
    ctx.globalAlpha=fps<28?.42:.59;
    ctx.strokeStyle=path.color;ctx.lineWidth=1.7;
    ctx.setLineDash(reducedMotion?[5,8]:[6,6]);
    ctx.beginPath();ctx.moveTo(path.x+ux*19,path.y+uy*19);
    ctx.lineTo(path.toX,path.toY);ctx.stroke();ctx.setLineDash([]);
    ctx.globalAlpha=fps<28?.55:.76;ctx.fillStyle=path.color;
    ctx.beginPath();ctx.moveTo(path.toX,path.toY);
    ctx.lineTo(path.toX-ux*9-uy*4,path.toY-uy*9+ux*4);
    ctx.lineTo(path.toX-ux*9+uy*4,path.toY-uy*9-ux*4);
    ctx.closePath();ctx.fill();drawn++;
  }
  ctx.restore();return drawn;
}

/** SVG fragments share exact sources with the world-space visualization. */
export function enemyIntentMapPaths(game,project,visible){
  // The map may show a nearby, visually confirmed patrol. It must not become
  // a free detector of enemies hiding behind cover or outside optical range.
  return collectEnemyIntents(game,{max:8,radius:290,visibleOnly:true})
    .slice(0,ENEMY_INTENT_VIEW.maxMap)
    .map(path=>{
      const a=project(path.x,path.y),b=project(path.toX,path.toY);
      if(!visible(a))return '';
      const fmt=n=>Number(n).toFixed(1);
      return '<g class="enemy-map-intent"><title>Радиоприказ: '+path.label+
        '</title><path d="M '+fmt(a.x)+' '+fmt(a.y)+' L '+fmt(b.x)+' '+fmt(b.y)+
        '" fill="none" stroke="'+path.color+'" stroke-width="2.2"'+
        ' stroke-dasharray="4 3" opacity=".88"/>'+
        '<circle cx="'+fmt(a.x)+'" cy="'+fmt(a.y)+'" r="3.5" fill="'+path.color+'"/>'+
        '<circle cx="'+fmt(b.x)+'" cy="'+fmt(b.y)+'" r="3" fill="none" stroke="'+path.color+'"/></g>';
    }).join('');
}
