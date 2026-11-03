/**
 * Mission 00 robot tactics. Contact reports are local, expire, and are
 * only shared with nearby robots in the same patrol. No pathfinding,
 * global omniscience or additional per-frame enemy searches.
 */
const TICK=.2;
const RADIO_RANGE=490;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const live=e=>e&&e.hp>0&&e.prologueAI;

const ROLES={
    security:['observer','guard','flank'],
    observatory:['observer','flank','guard'],
    reinforcement:['decoy','flank','guard','flank','guard','observer'],
    workshop:['guard','flank'],
    maintenance:['guard','decoy','flank','guard'],
    forge:['guard','flank','decoy','guard','flank','observer'],
    command:['guard','observer','flank'],
    siege:['breaker','breaker','observer','breaker','flank','breaker']
};

export class PrologueTactics {
    constructor(world) {
        this.world=world;
        this.clock=.1;
        this.lastReport=new Map();
        this.noticed=new Set();
    }

    onSpawn(enemy,group,index,game) {
        const roles=ROLES[group]||['guard'];
        enemy.prologueAI={
            group,role:roles[index%roles.length],index,
            homeX:enemy.x,homeY:enemy.y,
            directUntil:0,alertUntil:group==='siege'?Infinity:0,
            known:null,hitHp:enemy.hp,
            retreatUntil:0,contactAt:-100,radioAt:-100
        };
        // Patrols do not all fire on the same simulation frame.
        if(group==='security'&&enemy.ranged)
            enemy.fireTimer=Math.max(enemy.fireTimer||0,2.2);
    }

    update(dt,game) {
        this.clock+=dt;
        if(this.clock<TICK)return;
        this.clock%=TICK;
        const now=game.gameTime||0,p=game.player;
        if(!p)return;
        const patrols=new Map();
        for(const e of game.enemies||[]) {
            if(!live(e))continue;
            const group=e.prologueAI.group;
            if(!patrols.has(group))patrols.set(group,[]);
            patrols.get(group).push(e);
        }
        for(const [group,members] of patrols) {
            for(const scout of members) {
                const state=scout.prologueAI;
                state.structure=null;
                if(!scout.ranged&&state.role==='guard'&&state.alertUntil>now){
                    for(const base of game.friendlyBases?.bases||[]){
                        if(!base.activated||base.hp<=0||!base.id?.startsWith('prologue-')||
                            !base.turrets?.some(t=>!t.disabled&&(t.integrity??100)>0)||dist(scout,base)>285)continue;
                        if(!this.world.clearLineOfFire(scout.x,scout.y,base.x,base.y))continue;
                        state.structure=base;
                        if(dist(scout,base)<115&&now>=(state.strikeAt||0)){
                            const turret=base.turrets.find(t=>!t.disabled&&(t.integrity??100)>0);
                            turret.integrity=Math.max(0,(turret.integrity??100)-12);
                            turret.disabled=turret.integrity<=0;
                            state.strikeAt=now+1.1;scout.attackCooldown=.3;
                            game.worldVfx?.hit?.(base.x,base.y,false,false);
                        }
                        break;
                    }
                }
                if(state.hitHp>scout.hp+.5) {
                    state.alertUntil=Math.max(state.alertUntil,now+2);
                    if(scout.hp<scout.maxHp*.3&&group!=='siege'&&
                        group!=='security'&&state.retreatUntil<now)
                        state.retreatUntil=now+2;
                }
                state.hitHp=scout.hp;
                if(group==='siege')continue; // Core assault obeys its scripted objective.
                const rooms=[...(this.world.rooms||[]),...(this.world.wings||[])];
                const room=rooms.find(r=>scout.x>=r.x&&scout.x<=r.x+r.w&&
                    scout.y>=r.y&&scout.y<=r.y+r.h&&p.x>=r.x&&p.x<=r.x+r.w&&
                    p.y>=r.y&&p.y<=r.y+r.h);
                // Entering a lit room is visible across its whole floor.
                // Real bulkheads and cover still block every contact.
                const sightRange=room?Math.hypot(room.w,room.h):
                    group==='security'?460:group==='command'?480:420;
                if(dist(scout,p)>sightRange||
                    !this.world.clearLineOfFire(scout.x,scout.y,p.x,p.y))
                    continue;
                if(state.directUntil<=now&&now-state.contactAt>2.3)
                    state.contactAt=now;
                state.directUntil=now+.82;
                state.alertUntil=now+4.2;
                const report={x:p.x,y:p.y,vx:p.vx||0,vy:p.vy||0,until:now+4.2};
                state.known=report;
                let receivers=0;
                const links=[];
                for(const friend of game.enemies||[]) {
                    if(!live(friend))continue;
                    if(friend===scout||dist(friend,scout)>RADIO_RANGE)continue;
                    if(!this.world.clearLineOfFire(scout.x,scout.y,friend.x,friend.y))continue;
                    const peer=friend.prologueAI;
                    peer.known={...report};
                    peer.alertUntil=now+3.6;
                    if(peer.directUntil<=now&&now-peer.radioAt>2.3)
                        peer.radioAt=now;
                    receivers++;
                    links.push({x:friend.x,y:friend.y,
                        distance:dist(friend,scout)});
                }
                // This entry is also used by the existing decoder. A visible
                // transmission means a real robot actually received a report.
                if(receivers && now-(this.lastReport.get(group)||-100)>6){
                    this.lastReport.set(group,now);
                    const message={
                        time:now,code:'PATROL',from:'spac1',
                        text:'Цель обнаружена. Сектор '+
                            Math.round(p.x/120)+','+Math.round(p.y/120)+'.',
                        receivers,x:scout.x,y:scout.y,
                        // Actual recipients at transmission time; draw at most
                        // two links even when the whole patrol receives it.
                        links:links.sort((a,b)=>a.distance-b.distance)
                            .slice(0,2).map(({x,y})=>({x,y}))
                    };
                    const inbox=game.enemyIntelligence?.messages;
                    if(inbox){inbox.push(message);if(inbox.length>14)inbox.shift();}
                    if(group==='reinforcement'&&!this.noticed.has(group)){
                        this.noticed.add(group);
                        game._announce?.('РОБОТЫ ОБМЕНИВАЮТСЯ СИГНАЛАМИ · один отвлекает, остальные обходят.');
                    }
                }
            }
        }
    }

    targetFor(enemy,player,game) {
        const state=enemy.prologueAI;
        if(!state)return player;
        const now=game.gameTime||0;
        if(state.group==='siege'){
            if(enemy.prologueDuty==='core')return this.world.point(6540+(enemy.x<this.world.cx+6540?-145:145),0);
            return player;
        }
        if(state.structure)return state.structure;
        if(state.directUntil>now)return player;
        if(state.known?.until>now)return state.known;
        // Local patrol around a spawn anchor while the sector is quiet.
        const sway=(game.gameTime||0)*.48+state.index*1.7;
        return {x:state.homeX+Math.cos(sway)*46,
            y:state.homeY+Math.sin(sway)*34,vx:0,vy:0};
    }

    canFire(enemy,game) {
        const state=enemy.prologueAI;
        if(!state)return true;
        const player=game.player;
        if(!player)return false;
        const range=enemy.type?.firingRange||340;
        if(dist(enemy,player)>range+12)return false;
        // Gunships in the late assault may shoot only with a clear sightline.
        if(state.group!=='siege'&&state.directUntil<=(game.gameTime||0))return false;
        return this.world.clearLineOfFire(enemy.x,enemy.y,player.x,player.y);
    }

    steering(enemy,game,vx,vy) {
        const state=enemy.prologueAI;
        if(!state)return {vx,vy};
        if(state.group==='siege'){
            if(enemy.prologueDuty==='core'){
                const target=this.targetFor(enemy,game.player,game),dx=target.x-enemy.x,dy=target.y-enemy.y,d=Math.hypot(dx,dy);
                return d<18?{vx:0,vy:0}:this.navigate(enemy,game,dx/d*enemy.speed,dy/d*enemy.speed);
            }
            return this.navigate(enemy,game,vx,vy);
        }
        if(state.structure){
            const dx=state.structure.x-enemy.x,dy=state.structure.y-enemy.y,d=Math.hypot(dx,dy);
            return d<95?{vx:0,vy:0}:this.navigate(enemy,game,dx/d*enemy.speed,dy/d*enemy.speed);
        }
        const now=game.gameTime||0;
        // Manoeuvres use a recent sighting or a real received report.
        // An isolated patrol cannot predict the player's hidden position.
        const p=state.directUntil>now?game.player:
            state.known?.until>now?state.known:null;
        if(!p)return this.navigate(enemy,game,vx,vy);
        let target=null,weight=0;
        const distance=dist(enemy,p);
        if(state.retreatUntil>now){
            target={x:state.homeX,y:state.homeY};weight=.65;
        }else if(state.alertUntil>now){
            if(state.role==='flank'&&distance<465){
                const sign=state.index%2?-1:1;
                const dx=p.x-enemy.x,dy=p.y-enemy.y;
                const magnitude=Math.hypot(dx,dy)||1;
                target={x:p.x-dy/magnitude*125*sign,
                    y:p.y+dx/magnitude*125*sign};
                weight=.42;
            }else if(state.role==='decoy'&&distance<215){
                const dx=enemy.x-p.x,dy=enemy.y-p.y;
                const m=Math.hypot(dx,dy)||1;
                target={x:enemy.x+dx/m*105,y:enemy.y+dy/m*105};
                weight=.55;
            }else if(state.role==='guard'&&
                Math.hypot(enemy.x-state.homeX,enemy.y-state.homeY)>285&&
                distance>210){
                target={x:state.homeX,y:state.homeY};weight=.3;
            }
        }
        if(!target)return this.navigate(enemy,game,vx,vy);
        const dx=target.x-enemy.x,dy=target.y-enemy.y,m=Math.hypot(dx,dy);
        if(m<8)return this.navigate(enemy,game,vx,vy);
        const s=enemy.speed||85;
        return this.navigate(enemy,game,vx*(1-weight)+dx/m*s*weight,
            vy*(1-weight)+dy/m*s*weight);
    }

    navigate(enemy,game,vx,vy){
        if(!this.world.walkable)return {vx,vy};
        const speed=Math.hypot(vx,vy);if(speed<1)return {vx:0,vy:0};
        const state=enemy.prologueAI,now=game.gameTime||0;
        const angle=Math.atan2(vy,vx),radius=enemy.size||18;
        const clear=a=>[1,3,8,16,38,60].every(d=>this.world.walkable(
            enemy.x+Math.cos(a)*d,enemy.y+Math.sin(a)*d,radius));
        let wanted=angle;
        if(!clear(wanted)){
            // Hold the chosen side of a pillar until it clears the shoulder;
            // changing the side every frame made walkers shake at its edge.
            const sign=state.detourUntil>now?state.detourSide:
                state.index%2?1:-1;
            let found=false;
            for(const turn of [Math.PI/4,Math.PI/2,Math.PI*.75,Math.PI]){
                for(const side of [sign,-sign])if(clear(angle+turn*side)){
                    wanted=angle+turn*side;state.detourSide=side;
                    state.detourUntil=now+.8;found=true;break;
                }
                if(found)break;
            }
            if(!found)return {vx:0,vy:0};
        }
        if(state.moveAngle===undefined)state.moveAngle=wanted;
        // A bounded angular change between simulation steps, independent of
        // render rate. Never blend through the face of the obstruction.
        const delta=Math.atan2(Math.sin(wanted-state.moveAngle),Math.cos(wanted-state.moveAngle));
        const elapsed=Math.min(.1,Math.max(0,now-(state.moveAt??now)));
        const next=state.moveAngle+Math.max(-elapsed*7,Math.min(elapsed*7,delta));
        state.moveAngle=clear(next)?next:wanted;state.moveAt=now;
        return {vx:Math.cos(state.moveAngle)*speed,vy:Math.sin(state.moveAngle)*speed};
    }
}

