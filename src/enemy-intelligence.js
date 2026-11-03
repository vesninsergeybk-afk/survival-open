/**
 * Lightweight tactical radio for non-scripted Survivor space enemies.
 * Messages have real senders, receivers, last-known coordinates and a TTL.
 * AI decisions run at 2 Hz; movement remains in Enemy.update().
 */
const TICK=.5;
const RANGE=540;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const active=e=>e&&e.hp>0&&!e.boss&&!e.missionStructure&&!e.siegeMite&&!e.raidRole;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export class EnemyIntelligence{
    constructor(){this.reset();}
    reset(){
        this.clock=0;this.nextContact=1;this.nextGuardian=0;
        this.messages=[];this.squads=new Map();this.nextSquad=1;
        this.profile='normal';this.motion=0;this.lastProfileReport=-20;
    }
    observe(game){
        const p=game.player;
        const speed=Math.hypot(p.vx||0,p.vy||0);
        this.motion=this.motion*.65+speed*.35;
        const weapons=new Set((p.weapons||[]).map(w=>w.id));
        const wide=weapons.has('garlic')||weapons.has('whip')||
            weapons.has('orbit')||weapons.has('frost_nova')||
            (p.passives?.emp_pulse?.count||0)>0;
        const mined=(game.mines||[]).some(m=>!m.shouldRemove&&m.arming<=0);
        const precision=weapons.has('magic_wand')||weapons.has('railgun')||
            weapons.has('knife');
        this.profile=wide||mined?'spread':
            this.motion>145?'intercept':
            precision?'evasive':'normal';
    }
    transmit(sender,game,code,text,point=null){
        if(!active(sender)||!game?.player||game.missionWorld?.index===0)return 0;
        const now=game.gameTime;
        const p=point||game.player;
        const signal={x:p.x,y:p.y,vx:p.vx||0,vy:p.vy||0,
            tactic:this.profile,until:now+5.5,code};
        const nearby=game.spatial?.queryRect?.(sender.x,sender.y,RANGE)||
            game.enemies||[];
        let recipients=0;
        const links=[];
        for(const other of nearby){
            if(!active(other)||other===sender||dist(sender,other)>RANGE)continue;
            other._radioOrder={...signal};
            recipients++;
            links.push({x:other.x,y:other.y,distance:dist(sender,other)});
            // Only pilots who actually use the tactical order get a search cue.
            if(other.flanker||other.ranged){
                const visual=other._signalVisual||(other._signalVisual={});
                visual.searchUntil=now+5.5;
                if((visual.directUntil||0)<=now&&now-(visual.radioAt??-100)>2.4)
                    visual.radioAt=now;
            }
        }
        if(recipients){
            this.messages.push({time:now,code,from:sender.id,
                text,receivers:recipients,x:sender.x,y:sender.y,
                links:links.sort((a,b)=>a.distance-b.distance)
                    .slice(0,2).map(({x,y})=>({x,y}))});
            if(this.messages.length>14)this.messages.shift();
        }
        return recipients;
    }
    formAmbush(ships,game){
        if(!game?.player||ships.length<3||game.missionWorld?.index===0)return;
        const id=this.nextSquad++;
        const squad={id,ships,phase:'lure',start:game.gameTime,
            anchorX:game.player.x,anchorY:game.player.y,lastOrder:game.gameTime};
        this.squads.set(id,squad);
        for(let i=0;i<ships.length;i++){
            ships[i]._squadId=id;
            ships[i]._squadRole=i===0?'decoy':i===1?'flank':'ambush';
            ships[i]._radioOrder={x:game.player.x,y:game.player.y,
                vx:game.player.vx||0,vy:game.player.vy||0,
                tactic:'intercept',until:game.gameTime+6,code:'FORMATION'};
            if(i>0){
                const visual=ships[i]._signalVisual||(ships[i]._signalVisual={});
                visual.searchUntil=game.gameTime+6;
                if((visual.directUntil||0)<=game.gameTime)
                    visual.radioAt=game.gameTime;
            }
        }
        this.messages.push({time:game.gameTime,code:'FORMATION',from:ships[0].id,
            text:'Приманка впереди. Остальным ждать сигнала на флангах.',
            receivers:ships.length-1,x:ships[0].x,y:ships[0].y,
            links:ships.slice(1).sort((a,b)=>dist(ships[0],a)-dist(ships[0],b))
                .slice(0,2).map(e=>({x:e.x,y:e.y}))});
        if(this.messages.length>14)this.messages.shift();
    }
    updateSquads(game){
        for(const [id,s] of this.squads){
            s.ships=s.ships.filter(active);
            if(s.ships.length<2){this.squads.delete(id);continue;}
            const p=game.player;
            const decoy=s.ships.find(e=>e._squadRole==='decoy')||s.ships[0];
            if(s.phase==='lure'&&
                (dist(decoy,p)<225||game.gameTime-s.start>8||
                 decoy.hp<decoy.maxHp*.6)){
                s.phase='attack';s.lastOrder=game.gameTime;
                this.transmit(decoy,game,'AMBUSH',
                    'Цель у приманки. Всем звеньям — перехват!');
                for(const e of s.ships)e._radioOrder={
                    x:p.x,y:p.y,vx:p.vx||0,vy:p.vy||0,
                    tactic:'intercept',until:game.gameTime+5.5,code:'AMBUSH'};
            }else if(s.phase==='attack'&&game.gameTime-s.lastOrder>4.5){
                s.lastOrder=game.gameTime;
                this.transmit(decoy,game,'TRACK','Передаю свежий вектор цели.');
            }
        }
    }
    update(dt,game){
        if(!game?.player||game.missionWorld?.index===0)return;
        this.clock+=dt;
        if(this.clock<TICK)return;
        this.clock%=TICK;
        const old=this.profile;
        this.observe(game);
        this.updateSquads(game);
        const now=game.gameTime;
        const p=game.player;
        const scout=(game.enemies||[]).find(e=>active(e)&&
            ['bat','stalker','ghost','commander','repairer'].includes(e.id)&&
            dist(e,p)<820);
        if(scout&&now>=this.nextContact){
            this.nextContact=now+3.5;
            this.transmit(scout,game,'CONTACT',
                'Цель: сектор '+Math.round(p.x/120)+','+Math.round(p.y/120)+
                '. Курс обновлён.');
        }
        if(scout&&old!==this.profile&&now-this.lastProfileReport>9){
            const labels={spread:'Обнаружено площадное оружие. Разомкнуть строй.',
                intercept:'Цель быстро меняет позицию. Рассчитать упреждение.',
                evasive:'Обнаружено самонаведение. Маневрировать.',
                normal:'Цель сменила тактику. Вернуться к стандартному строю.'};
            if(this.transmit(scout,game,'ADAPT',labels[this.profile]))
                this.lastProfileReport=now;
        }
        if(now>=this.nextGuardian){
            this.nextGuardian=now+1.2;
            for(const guardian of game.enemies||[]){
                if(!active(guardian)||guardian.id!=='golem'||
                    guardian.shieldHp<=0)continue;
                let covered=0;
                const neighbours=game.spatial?.queryRect?.(
                    guardian.x,guardian.y,155)||[];
                for(const ally of neighbours){
                    if(ally===guardian||!active(ally)||dist(guardian,ally)>145||
                        ally.reactiveShieldHp>0)continue;
                    ally.reactiveShieldHp=12;
                    ally.reactiveShieldUntil=now+2;
                    if(++covered>=2)break;
                }
            }
        }
    }
    notifyRepair(ship,game){
        this.transmit(ship,game,'REPAIR',
            'Повреждение критическое. Отхожу на аварийный ремонт.');
    }
    targetFor(enemy,target,game){
        // Only non-scripted advanced pilots benefit from shared sightings.
        // Station targets, bosses and basic chasers keep their original rules.
        if(!active(enemy)||game.missionWorld?.index===0||
            target!==game.player||!(enemy.flanker||enemy.ranged))return target;
        const now=game.gameTime,actual=game.player;
        if(dist(enemy,actual)<640){
            const visual=enemy._signalVisual||(enemy._signalVisual={});
            if(visual.contactAt===undefined||
                ((visual.directUntil||0)<now&&now-visual.contactAt>2.4))
                visual.contactAt=now;
            visual.directUntil=now+.65;
            visual.searchUntil=now+5;
            enemy._lastKnownTarget={x:actual.x,y:actual.y,
                vx:actual.vx||0,vy:actual.vy||0,until:now+5};
            return target;
        }
        const report=enemy._radioOrder;
        if(report?.until>now){
            const seen={x:report.x+report.vx*.22,y:report.y+report.vy*.22,
                vx:report.vx,vy:report.vy,until:report.until};
            enemy._lastKnownTarget=seen;
            return seen;
        }
        if(enemy._lastKnownTarget?.until>now)return enemy._lastKnownTarget;
        return target;
    }
    steering(enemy,game,vx,vy){
        if(!active(enemy)||game.missionWorld?.index===0||
           enemy.repairState==='repair')return {vx,vy};
        const squad=this.squads.get(enemy._squadId);
        let target=null,weight=0;
        const p=game.player;
        if(squad&&squad.phase==='lure'){
            const age=game.gameTime-squad.start;
            const dir=Math.atan2((p.vy||0)||1,(p.vx||0)||1);
            const side=enemy._squadRole==='flank'?-1:1;
            if(enemy._squadRole==='decoy'){
                const retreat=dist(enemy,p)<200;
                target=retreat?{x:p.x+Math.cos(dir)*270,y:p.y+Math.sin(dir)*270}:p;
                weight=retreat?.85:.25;
            }else{
                target={x:squad.anchorX+Math.cos(dir+side*1.35)*210,
                    y:squad.anchorY+Math.sin(dir+side*1.35)*210};
                weight=clamp(.8-age*.03,.5,.8);
            }
        }else if(squad&&squad.phase==='attack'&&enemy._squadRole==='flank'){
            target={x:p.x-(p.vy||0)*.65,y:p.y+(p.vx||0)*.65};
            weight=.55;
        }else if(enemy._radioOrder?.until>game.gameTime&&
            (enemy.flanker||enemy.ranged)){
            const m=enemy._radioOrder;
            if(m.tactic==='intercept'){
                target={x:m.x+m.vx*.45,y:m.y+m.vy*.45};weight=.32;
            }else if(m.tactic==='evasive'){
                const side=enemy.tacticSide||1;
                target={x:enemy.x-(p.y-enemy.y)*side*.45,
                    y:enemy.y+(p.x-enemy.x)*side*.45};
                weight=.27;
            }else if(m.tactic==='spread'&&dist(enemy,p)<230){
                target={x:enemy.x+(enemy.x-p.x),y:enemy.y+(enemy.y-p.y)};
                weight=.35;
            }
        }
        if(!target)return {vx,vy};
        const dx=target.x-enemy.x,dy=target.y-enemy.y,d=Math.hypot(dx,dy);
        if(d<7)return {vx:vx*.3,vy:vy*.3};
        const speed=enemy.speed||90;
        const blend=clamp(weight,0,.85);
        return {vx:vx*(1-blend)+dx/d*speed*blend,
            vy:vy*(1-blend)+dy/d*speed*blend};
    }
    renderIntercept(ctx,game){
        if(!game.player?.passives?.signal_decoder?.count)return;
        const recent=this.messages.filter(m=>game.gameTime-m.time<13).slice(-3);
        if(!recent.length)return;
        const x=810,y=130,w=372,h=24+recent.length*34;
        ctx.save();
        ctx.fillStyle='rgba(5,22,37,.82)';ctx.fillRect(x,y,w,h);
        ctx.strokeStyle='#4ad4e5';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);
        ctx.font='bold 13px monospace';ctx.fillStyle='#72ecff';
        ctx.fillText('◉ ПЕРЕХВАТ ПЕРЕГОВОРОВ',x+10,y+16);
        ctx.font='12px monospace';
        recent.forEach((m,i)=>{
            const names={bat:'РАЗВЕДЧИК',stalker:'ПЕРЕХВАТЧИК',
                commander:'КОМАНДИР',repairer:'РЕМОНТНЫЙ',golem:'БРОНЕНОСЕЦ'};
            ctx.fillStyle='#d4eef5';
            ctx.fillText((names[m.from]||m.from.toUpperCase())+' → '+m.receivers+' [ '+m.code+' ]',
                x+10,y+33+i*34);
            ctx.fillStyle='#a4c9d4';
            const t=m.text.length>53?m.text.slice(0,50)+'…':m.text;
            ctx.fillText(t,x+10,y+47+i*34);
        });
        ctx.restore();
    }
}
