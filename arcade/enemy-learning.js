/** Bounded, explainable online learning shared by enemy *archetypes*, not
 * one neural network per ship. The bandit selects only authored, legal styles;
 * damage, HP, cooldowns, visibility and mission objectives remain untouched. */
export const ENEMY_LEARNING_KEY='survivor.enemy-learning.v1';
export const ENEMY_STYLES=Object.freeze({
  scout:Object.freeze(['weave','diverge','cutoff']),
  fighter:Object.freeze(['sweep','intercept','pressure']),
  flanker:Object.freeze(['orbit','wide','cutoff']),
  healer:Object.freeze(['nearest','critical','screen']),
  berserker:Object.freeze(['direct','offset','intercept']),
  gunship:Object.freeze(['standoff','sideslip','intercept']),
  turret:Object.freeze(['direct','lead','counterturn'])
});
const contexts=['slow','straight','turning'];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
const blank=()=>Object.create(null);
const validType=type=>Object.prototype.hasOwnProperty.call(ENEMY_STYLES,type);
const validContext=context=>contexts.includes(context);

/** A capped, imperfect prediction; turrets retain their original fire rate. */
export function learnedTurretAim(target,style='direct',turnSign=0){
  const vx=finite(target?.vx),vy=finite(target?.vy),speed=Math.hypot(vx,vy);
  const lead=style==='lead'?0.2:style==='counterturn'?0.13:0;
  const turn=style==='counterturn'?clamp(finite(turnSign),-1,1):0;
  return {x:target.x+clamp(vx*lead,-40,40)-
    (speed>45?vy/speed*turn*30:0),
    y:target.y+clamp(vy*lead,-40,40)+
    (speed>45?vx/speed*turn*30:0)};
}

export class EnemyLearning {
  constructor(storage=null){
    this.storage=storage;this.models=blank();this.lastPlayer=null;
    this.turning=0;this.turnSign=0;this.context='slow';
    this.lastObservation=-Infinity;this.nextSave=15;this.dirty=false;
    try{
      const raw=JSON.parse(storage?.getItem(ENEMY_LEARNING_KEY)||'null');
      if(raw?.version!==1||!raw.models||typeof raw.models!=='object')return;
      for(const [type,actions] of Object.entries(ENEMY_STYLES)){
        for(const context of contexts){
          const key=`${type}/${context}`,saved=raw.models[key];
          if(!saved||typeof saved!=='object')continue;
          const model=blank();
          for(const action of actions){
            const entry=saved[action];
            if(!entry||typeof entry!=='object')continue;
            const count=clamp(Math.floor(finite(entry.n)),0,120);
            model[action]={n:count,sum:clamp(finite(entry.sum),0,count)};
          }
          this.models[key]=model;
        }
      }
    }catch{/* Storage can be disabled, corrupted or unavailable. */}
  }

  observePlayer(player,now){
    if(!player||now-this.lastObservation<.26)return this.context;
    const vx=finite(player.vx),vy=finite(player.vy),speed=Math.hypot(vx,vy);
    if(this.lastPlayer){
      const old=this.lastPlayer,oldSpeed=Math.hypot(old.vx,old.vy);
      if(oldSpeed>45&&speed>45){
        const dot=(old.vx*vx+old.vy*vy)/(oldSpeed*speed);
        const cross=(old.vx*vy-old.vy*vx)/(oldSpeed*speed);
        this.turning=this.turning*.8+Math.acos(clamp(dot,-1,1))*.2;
        this.turnSign=this.turnSign*.8+cross*.2;
      }else{this.turning*=.85;this.turnSign*=.85;}
    }
    this.context=speed<55?'slow':this.turning>.16?'turning':'straight';
    this.lastPlayer={vx,vy};this.lastObservation=now;
    if(this.dirty&&now>=this.nextSave)this.flush(now);
    return this.context;
  }

  /** Upper-confidence-bandit: try under-tested strategies, then prefer those
   * that worked in this observed player-movement context. No opaque model. */
  choose(type,context=this.context,serial=0){
    if(!validType(type))return null;
    if(!validContext(context))context='slow';
    const actions=ENEMY_STYLES[type],model=this.models[`${type}/${context}`]||blank();
    const n=actions.reduce((s,a)=>s+(model[a]?.n||0),0),offset=Math.abs(Math.trunc(finite(serial)))%actions.length;
    let best=actions[0],bestScore=-Infinity;
    for(let i=0;i<actions.length;i++){
      const action=actions[(i+offset)%actions.length],entry=model[action];
      const count=entry?.n||0,mean=count?entry.sum/count:.5;
      // Do not conclude an early lucky hit is proof before trying alternatives.
      if(!count)return action;
      const exploration=count?Math.sqrt(1.1*Math.log(n+2)/count):1.3;
      const score=mean+exploration-i*.0001;
      if(score>bestScore){best=action;bestScore=score;}
    }
    return best;
  }

  styleFor(actor,now,type=actor?.type){
    if(!actor||!validType(type))return null;
    const active=actor._enemyLearning;
    if(active&&active.type===type&&now<active.until)return active.style;
    if(active)this.finish(actor,now);
    const serial=actor.serial??Math.round(finite(actor.x)*.31+finite(actor.y)*.73);
    const context=this.context,style=this.choose(type,context,serial);
    actor._enemyLearning={type,context,style,start:now,until:now+9.6,
      dealt:0,lost:0,support:0,shots:0,close:0,
      maxHp:Math.max(1,finite(actor.maxHp,100))};
    return style;
  }

  /** A shot holds its original trial, even if the shooter changed tactics. */
  shotToken(actor){return actor?._enemyLearning||null;}
  fired(actor){if(actor?._enemyLearning)actor._enemyLearning.shots++;}
  close(actor,dt){
    if(actor?._enemyLearning&&dt>0)
      actor._enemyLearning.close+=clamp(finite(dt),0,.1);
  }
  dealt(token,amount){
    if(!token||!Number.isFinite(amount)||amount<=0)return;
    token.dealt+=clamp(amount,0,100);
    // A projectile can land after its author was destroyed or switched plans.
    // Keep the original action credit, even after the trial has been closed.
    if(token.recorded){
      const row=this.models[`${token.type}/${token.context}`]?.[token.style];
      if(row){
        const next=this.score(token);
        row.sum=clamp(row.sum+next-token.reward,0,row.n);
        token.reward=next;this.dirty=true;
      }
    }
  }
  damaged(actor,amount){
    if(actor?._enemyLearning&&amount>0)
      actor._enemyLearning.lost+=clamp(finite(amount),0,200);
  }
  supported(actor,amount){
    if(actor?._enemyLearning&&amount>0)
      actor._enemyLearning.support+=clamp(finite(amount),0,200);
  }

  score(trial){
    const offensive=clamp(trial.dealt/8,0,1);
    const support=clamp(trial.support/16,0,1);
    const losses=clamp(trial.lost/trial.maxHp,0,1);
    const pressure=clamp(trial.close/6,0,1);
    return clamp(.2+.58*offensive+.42*support+
      .1*pressure-.23*losses,0,1);
  }

  finish(actor,now){
    const trial=actor?._enemyLearning;
    if(!trial)return null;
    actor._enemyLearning=null;
    // A ship that has seen no combat must not teach the AI that inactivity wins.
    if(!trial.dealt&&!trial.lost&&!trial.support&&!trial.shots&&
       trial.close<.4)return null;
    const reward=this.score(trial);
    if(this.record(trial.type,trial.context,trial.style,reward)){
      trial.recorded=true;trial.reward=reward;
    }
    return reward;
  }

  record(type,context,style,reward){
    if(!validType(type)||!validContext(context)||
       !ENEMY_STYLES[type].includes(style)||!Number.isFinite(reward))return false;
    const key=`${type}/${context}`,model=this.models[key]||(this.models[key]=blank());
    const item=model[style]||(model[style]={n:0,sum:0});
    // Exponential forgetting also bounds persistent data and lets the enemy
    // unlearn a once-successful counter when a player changes their habits.
    if(item.n>=120){
      for(const value of Object.values(model)){
        value.n=Math.max(1,Math.floor(value.n*.5));value.sum*=.5;
      }
    }
    item.n++;item.sum+=clamp(reward,0,1);this.dirty=true;
    return true;
  }

  summary(type,context=this.context){
    if(!validType(type))return [];
    const model=this.models[`${type}/${validContext(context)?context:'slow'}`]||{};
    return ENEMY_STYLES[type].map(style=>({style,
      samples:model[style]?.n||0,
      average:model[style]?.n?model[style].sum/model[style].n:null}));
  }

  flush(now=0){
    if(!this.dirty)return false;
    try{
      this.storage?.setItem(ENEMY_LEARNING_KEY,JSON.stringify({version:1,models:this.models}));
      if(!this.storage)return false;
      this.dirty=false;this.nextSave=now+15;return true;
    }catch{return false;}
  }
}
