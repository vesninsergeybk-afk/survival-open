import test from 'node:test';
import assert from 'node:assert/strict';
import {EnemyComms} from '../enemy-comms.js';
import {updateEnemy} from '../ai.js';
import {ENEMY_MESH} from '../enemy-mesh.js';

const fighter=(serial,group,x,y=0)=>({serial,group,type:'fighter',
  x,y,r:14,vx:0,vy:0,hp:58,maxHp:58,damage:12,
  think:0,fire:6,commitUntil:0,state:'hunt'});

const simulate=dt=>{
  const site={id:'industry:depot',type:'carrier',strategicRole:'central-depot',
    x:870,y:0,hp:300,maxHp:300,enemy:true,captured:false};
  const fleet=[fighter(1,1,5),fighter(2,1,32),
    fighter(11,2,820),fighter(12,2,842)];
  const game={time:0,player:{x:-1300,y:-900,r:19,hp:120,shield:0,invul:999},
    world:{stations:new Map([[site.id,site]]),
      regionalSupply:{convoys:[],central:{convoys:[]},
        frontier:{azure:{convoys:[]},teal:{convoys:[]}}}},
    enemies:fleet,allies:[],missiles:[],shots:[],support:{missions:[]},
    grid:{query(x,y,r){return fleet.filter(e=>e.hp>0&&
      Math.hypot(x-e.x,y-e.y)<=r);}},
    avoidance:()=>({x:0,y:0}),enemyCanSee:(_e,target)=>target===site,
    enemyShot:()=>false,hurt(){},heritage:{play(){},vfx:{shipExplosion(){}}},
    playerCanInspectEnemyIntent:()=>false,
    playerCanInterceptEnemyRadio:()=>false};
  const net=new EnemyComms();game.enemyComms=net;
  let alarmAt=null,dispatchAt=null,arrivalAt=null,afterCaptureOrders=0;
  const reserve=fleet[0],start=reserve.x;
  let peakBeforeCapture=start;
  for(let tick=0;tick<75/dt;tick++){
    game.time=tick*dt;
    if(tick===Math.round(2/dt))
      assert.ok(net.reportIncident(site,game,'industry')>=1);
    if(tick===Math.round(45/dt)){site.captured=true;site.enemy=false;}
    net.update(game);
    const group=net.cells.find(c=>c.members.includes(reserve));
    if(group&&alarmAt==null&&net.mesh.alarmFor(group,site.id,game.time))
      alarmAt=game.time;
    for(const e of fleet)updateEnemy(e,game,dt);
    net.confirmExecution(game);
    if(dispatchAt==null&&reserve._theaterIntent?.assetId===site.id)
      dispatchAt=game.time;
    if(arrivalAt==null&&reserve.x>600)arrivalAt=game.time;
    if(!site.captured)peakBeforeCapture=Math.max(peakBeforeCapture,reserve.x);
    if(site.captured&&net.strategicDirectiveFor(reserve,game.time))
      afterCaptureOrders++;
    assert.ok(net.mesh.pending.length<=ENEMY_MESH.maxPending);
  }
  assert.ok(alarmAt!=null&&alarmAt>=2.5,`alarm at ${alarmAt}`);
  assert.ok(dispatchAt!=null&&dispatchAt>=alarmAt,`dispatch at ${dispatchAt}`);
  assert.ok(arrivalAt!=null&&arrivalAt<45,`arrived at ${arrivalAt}`);
  assert.ok(peakBeforeCapture>start+600,
    'reserves physically travel across the sector before the objective is captured');
  assert.equal(afterCaptureOrders,0,'captured asset never retains an enemy order');
  assert.ok(fleet.every(e=>e.maxHp===58&&e.damage===12),
    'shared intelligence cannot improve hull strength or damage');
  return {alarmAt,dispatchAt,arrivalAt};
};

test('two flights make the same strategic response at 30 and 60 simulation FPS',()=>{
  const slow=simulate(1/30),fast=simulate(1/60);
  for(const field of ['alarmAt','dispatchAt','arrivalAt']){
    assert.ok(Math.abs(slow[field]-fast[field])<1.3,
      `${field}: 30 FPS ${slow[field]}, 60 FPS ${fast[field]}`);
  }
});
