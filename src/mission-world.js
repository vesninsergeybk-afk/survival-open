/**
 * Objective-driven campaign missions (1–4). Endless, Daily, Speedrun and
 * replay never instantiate this director. Combat, docking, asteroid damage,
 * raids and station upgrades reuse the actual arcade subsystems.
 */
import { GameState } from './config.js?v=base-87';
import { damageWorldObstacles } from './world-obstacles.js?v=polish-953';
import { BOSSES, ENEMIES } from './data.js?v=base-87';
import { Enemy } from './entities.js?v=design-127';
import { missionAmbientPool } from './enemy-fleet.js?v=fleet-104';
import { MISSION_PROFILES, isMissionUnlocked, readCampaign } from './mission-progression.js?v=design-127';
import { getMissionScene, makeMissionAsteroids } from './mission-layouts.js?v=routes-102';
import { drawMissionBackdrop, drawMissionForeground } from './mission-scenery.js?v=routes-102';
import {MissionLog} from './mission-log.js?v=design-127';
import {createConvoyTrap,advanceConvoyTrap,progressCaption,CONVOY_TRAP} from './mission-ambush.js?v=campaign-92';

const center=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function clock(t){return Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');}
const missionStage={0:'crypt',1:'forest',2:'tundra',3:'crypt',4:'forest'};
export function stageForMission(index){return missionStage[index]||'forest';}
export function hasDesignedMission(index){return index===0||(index>=1&&index<=4);}

export class MissionWorld {
    constructor(game,index){
        this.index=index;this.scene=getMissionScene(index);
        this.cx=game.player.x;this.cy=game.player.y;
        this.platforms=this.scene.platforms.map(v=>({...v,x:this.cx+v.dx,y:this.cy+v.dy}));
        this.props=this.scene.props.map(v=>({...v,x:this.cx+v.dx,y:this.cy+v.dy,used:false}));
        this.beaconOnline=false;this.jammerOffline=false;
        this.first=index===1?{
            beacons:0,alpha:0,beta:0,nextWave:Infinity,
            betaHp:140,betaMaxHp:140,
            coreHp:360,maxCoreHp:360,
            siegeElapsed:0,finalStart:null,nextSiege:42,siegeWaves:0,
            warnedSiegeWave:0,lastCoreHitAt:-Infinity,
            repairCooldown:0,stasisCooldown:0,ambientAt:10,
            warningAt:0
        }:null;
        this.defenses=0;this.spawnClock=13;this.boss=null;this.bossStarted=false;
        this.victory=false;this.failed=false;this.introShown=false;this.oldObjective='';
        this.sealBriefed=false;this.jammerBriefed=false;
        this.blastsTriggered=0;this.enemySite=null;this.exitOnline=false;
        this.trap=null;this.log=null;
        // Evacuation is an event-driven finale, never a global stopwatch gate.
        this.evacuation=index===4?{bossCueAt:null,rescueAt:null}:null;
        this.quarry=index===2?{
            rig:this.props.find(p=>p.id==='rig'),started:false,completed:false,
            escorts:0,nextEscort:Infinity,overload:false,overloadAt:Infinity,
            nextShock:Infinity,shots:[],forkReached:false,
            routeChoice:null,routeLeg:0,ambushTriggered:false,
            awaitingClear:false,serviceUsed:false
        }:null;
        if(this.quarry?.rig){
            this.quarry.rig.hp=340;this.quarry.rig.maxHp=340;
            this.quarry.rig.repairAt=0;
        }
        this.network=index===3?{
            decoyChecked:false,decoyCleared:false,sabotaged:false,
            defenseReady:false,lastDownId:null,reboots:0,
            reserveAnnounced:false
        }:null;
        this.convoy=this.scene.convoyStart?{
            x:this.cx+this.scene.convoyStart.dx,y:this.cy+this.scene.convoyStart.dy,
            hp:760,maxHp:760,speed:46,leg:0,phase:'launch',
            hold:0,chargeStarted:false,launched:false,repairAt:0,
            combatCharge:0,overchargedLegs:new Set(),raidClock:28,
            raids:0,lastDamageAt:0
        }:null;
        this.route=(this.scene.route||[]).map(v=>({...v,x:this.cx+v.dx,y:this.cy+v.dy}));
    }
    enter(game){
        game.worldObstacles=makeMissionAsteroids(this.index,this.cx,this.cy);
        // An authored battlefield must not contain dozens of unrelated,
        // randomly generated bases that bypass its intended objectives.
        const old=game.friendlyBases.bases[0];
        game.friendlyBases.bases=this.scene.stations.map((s,i)=>({
            ...old,id:'mission-'+this.index+'-station-'+i,
            x:this.cx+s.dx,y:this.cy+s.dy,anchorX:this.cx+s.dx,anchorY:this.cy+s.dy,
            type:s.type,displayName:s.name,missionOptional:!!s.optional,vx:0,vy:0,
            hp:this.index===1?(i===0?240:190):180,
            maxHp:this.index===1?(i===0?240:190):180,
            discovered:true,scanned:true,visited:false,
            activated:false,activationTime:0,turrets:[],sockets:1,
            hangarCapacity:1,hangarTier:0,
            escortUpgrades:{hull:0,engine:0,gun:0},
            development:{defense:0,research:0,logistics:0},
            turretBeam:null,defense:{level:0,mode:null,active:0,cooldown:0,
                reserve:0,recent:0,recentTime:0,visual:0}
        }));
        game.friendlyBases.credits=[0,82,35,68,82][this.index];
        game.friendlyBases.nextRaidAt=Infinity;
        game.friendlyBases.raid=null;
        game.worldCaches=[]; // campaign supplies positioned salvage instead
        // Siege stations are genuine damageable combat entities. Their location
        // is authored; they cannot drift, despawn or trigger boss music.
        const siteDef=this.scene.enemySites?.[0];
        if(siteDef){
            const type={id:'enemy_site_'+this.index,name:siteDef.name,
                hp:siteDef.hp,speed:0,damage:0,exp:160,size:62,
                color:'#f28a62',archetype:'ranged',ranged:true,keepDistance:1,
                firingRange:siteDef.range,projectileSpeed:245,
                projectileDamage:this.index===2?12:15,fireCooldown:3.3};
            const core=new Enemy(this.cx+siteDef.dx,this.cy+siteDef.dy,type,1,1);
            core.missionStructure=true;
            core.update=(dt,g)=>{
                core.flashTimer=Math.max(0,core.flashTimer-dt);
                core.fireTimer-=dt;
                const dx=g.player.x-core.x,dy=g.player.y-core.y;
                if(core.fireTimer<=0&&Math.hypot(dx,dy)<type.firingRange){
                    core._shoot(g,Math.atan2(dy,dx));
                    core.fireTimer=type.fireCooldown;
                }
            };
            this.enemySite={...siteDef,core,x:core.x,y:core.y,tier:1,
                destroyed:false,spawnClock:20,spawned:0};
            game.enemies.push(core);
        }
        game.missionLog??=new MissionLog(game);
        this.log=game.missionLog;this.log.reset(this);
        this._announce(game,'Операция «'+this.scene.name+'». '+this.scene.sub+'.');
        this._updateHud(game);
    }
    _announce(game,msg){
        game._announce?.(msg);
        if(this.log&&msg!==this.message)
            this.log.note('Сообщение командования',msg,this.objective(game));
        this.message=msg;
    }
    _briefing(){
        return {
            1:'Восстановите маяки по очереди, подготовьте три бастиона и защитите «Гамму». Строительство станций даст новые возможности обороны.',
            2:'Пробейте проход, восстановите арсенал и запустите «Крота». На развилке выберите быстрый опасный путь или более долгий маршрут через укрытия, где можно восстановить корпус. Защищайте буровую и откройте аварийный шлюз.',
            3:'Восстановите три обязательные станции на разных концах сектора. Резервный «Край» можно включить для дополнительной обороны. Проверьте тревожный сигнал, найдите источник помех, восстановите повреждённый реактор и защитите сеть.',
            4:'Три транспорта идут к вратам эвакуации. Защищайте главный грузовой корабль. На каждой стоянке можно форсировать зарядку реле за 20 деталей, сократив ожидание на 25 секунд; энергетический выброс привлечёт перехватчиков.'
        }[this.index]||this.scene.sub;
    }
    // Curated environmental GLBs. Collisions and interactions remain entirely
    // in 2D; the camera budget decides how many nearby props are displayed.
    sceneryPowered(item){
        const stage=item.onAt||0;
        if(stage<=0)return false;
        if(this.index===1)return (this.first?.beacons||0)>=stage;
        if(this.index===2)return stage===1?!!this.quarry?.started:
            stage===2?!!this.quarry?.completed:!!this.exitOnline;
        if(this.index===3)return stage===1?!!this.network?.decoyCleared:
            stage===2?!!this.jammerOffline:this.defenses>=2;
        if(this.index===4)return stage===1?(this.convoy?.leg||0)>=1:
            stage===2?(this.convoy?.leg||0)>=2:!!this.exitOnline;
        return false;
    }
    get3DProps(profile='desktop'){
        return (this.scene.scenery3d||[])
            .filter(item=>profile!=='mobile'||item.mobile)
            .map(item=>({
                id:'mission-'+this.index+'-'+item.id,model:item.model,
                x:this.cx+item.dx,y:this.cy+item.dy,
                span:item.span,yaw:item.yaw,tint:item.tint,
                powered:this.sceneryPowered(item)
            }));
    }
    getBase(game,i){return game.friendlyBases.bases[i];}
    allBasesActive(game){return game.friendlyBases.bases
        .filter(b=>this.index!==3||!b.missionOptional)
        .every(b=>b.activated&&b.hp>0);}
    sealRemaining(game){
        return game.worldObstacles.filter(r=>r.missionSeal&&!r.destroyed).length;
    }
    enemySiteAlive(game){
        const site=this.enemySite;
        return !!site&&!site.destroyed&&site.core.hp>0&&game.enemies.includes(site.core);
    }
    _updateEnemySite(game,dt){
        const site=this.enemySite;
        if(!site||site.destroyed)return;
        if(!this.enemySiteAlive(game)){
            site.destroyed=true;
            game.worldVfx?.nova(site.x,site.y,220,'orange');
            game.createParticles?.(site.x,site.y,'#ffa76c',36);
            game.friendlyBases.addCredits(45,game,site.x,site.y);
            game.createFloatingText?.('ФОРПОСТ УНИЧТОЖЕН · +45 ⚙',site.x,site.y-90,'#ffd7a6');
            this._announce(game,site.name+' уничтожен. Подкрепления противника прекращены.');
            return;
        }
        const tier=game.gameTime>=320?3:game.gameTime>=155?2:1;
        if(tier>site.tier){
            site.tier=tier;
            this._announce(game,site.name+' усиливает гарнизон — уровень '+tier+'.');
        }
        const nearPlayer=center(game.player,site)<850;
        site.spawnClock-=dt;
        if(!nearPlayer||site.spawnClock>0)return;
        const guardCount=game.enemies.filter(e=>e.missionGarrison===site.id&&e.hp>0).length;
        const guardCap=site.tier+2;
        if(guardCount<guardCap&&game.enemies.length<55){
            const a=site.spawned*2.399963+site.tier*.42;
            const radius=105+(site.spawned%3)*31;
            const x=site.x+Math.cos(a)*radius,y=site.y+Math.sin(a)*radius;
            const def=site.tier===1||site.spawned%3!==0?ENEMIES.STALKER:ENEMIES.MAGE;
            const enemy=new Enemy(x,y,def,1+site.tier*.13,1);
            enemy.missionGarrison=site.id;
            game.enemies.push(enemy);
            site.spawned++;
            game.worldVfx?.nova(x,y,36,'orange');
        }
        site.spawnClock=[0,22,17,13][site.tier];
    }
    /** Sequentially activated mission-1 relays, gated by actual wave clears. */
    beaconUnlocked(game,p){
        const dock=this.getBase(game,0);
        if(!dock?.activated)return false;
        if(this.index!==1)return true;
        if(!p || p.type!=='beacon')return false;
        const f=this.first;
        if(p.id==='beacon-1')return f.beacons===0;
        if(p.id==='beacon-2')return f.beacons===1 && f.alpha>=2 &&
            !game.enemies.some(e=>e.missionBeaconWave==='alpha'&&e.hp>0);
        if(p.id==='beacon-3')return f.beacons===2 && f.beta>=2 &&
            !game.enemies.some(e=>e.missionBeaconWave==='beta'&&e.hp>0);
        return false;
    }
    missionXP(player){
        if(!player)return 0;
        let earned=0,cost=50;
        for(let level=1;level<player.level;level++){
            earned+=cost;cost=Math.floor(cost*1.2);
        }
        return earned+(player.exp||0);
    }
    canInteract(game){
        if(game.state!==GameState.PLAYING)return null;
        const prop=this.props.find(p=>!p.used && center(game.player,p)<138 &&
            (p.type==='cache' ||
             (p.type==='beacon' && this.beaconUnlocked(game,p)) ||
             (p.type==='rig' && this.index===2 && this.getBase(game,1)?.activated) ||
             (p.type==='route-choice' && this.index===2 &&
                 this.quarry.started && this.quarry.forkReached &&
                 !this.quarry.routeChoice) ||
             (p.type==='decoy' && this.index===3 && this.allBasesActive(game)) ||
             (p.type==='jammer' && this.allBasesActive(game) &&
                 (this.index!==3||this.network?.decoyCleared) && !this.enemySiteAlive(game)) ||
             (p.type==='gate' && (
                 (this.index===2 && this.quarry?.overload &&
                     this.bossStarted && this.boss && !game.enemies.includes(this.boss) &&
                     this.allBasesActive(game)) ||
                 (this.index===4 && this.convoy?.leg===3 && this.trap?.cleared &&
                     game.friendlyBases.bases.slice(1).every(b=>b.activated&&b.hp>0))
             ))));
        if(prop)return prop;
        // Optional tactical choice: spend salvage to shorten a live relay charge,
        // accepting an earlier interceptor wave. One overcharge per relay.
        if(this.index===4 && this.convoy?.phase==='charging' &&
            this.convoy.leg<2 && this.convoy.hold>25 &&
            !this.convoy.overchargedLegs.has(this.convoy.leg)){
            const relay=this.getBase(game,this.convoy.leg+1);
            if(relay?.activated&&relay.hp>0&&center(game.player,relay)<165)
                return {type:'relay-overcharge',name:relay.displayName,
                    x:relay.x,y:relay.y,leg:this.convoy.leg};
        }
        if(this.index===2 && this.quarry?.started && !this.quarry.completed &&
            this.quarry.rig.hp<this.quarry.rig.maxHp-70 &&
            game.gameTime>=this.quarry.rig.repairAt &&
            center(game.player,this.quarry.rig)<145)
            return {type:'rig-repair',x:this.quarry.rig.x,y:this.quarry.rig.y};
        if(this.index===3){
            const base=game.friendlyBases.bases.find(b=>!b.missionOptional && b.hp<=0 &&
                center(b,game.player)<145);
            if(base)return {type:'reboot',base,x:base.x,y:base.y};
        }
        // Actual station health matters in mission 3. A nearby pilot can
        // spend salvage on field repairs; standard Dock remains available
        // through its separate touch button.
        if(this.index===3 && this.jammerOffline){
            const base=game.friendlyBases.bases.find(b=>b.activated && b.hp>0 &&
                b.hp<b.maxHp-28 && game.gameTime>=(b.missionRepairAt||0) &&
                center(b,game.player)<135);
            if(base)return {type:'repair',base,x:base.x,y:base.y};
        }
        if(this.index===4 && this.convoy && this.convoy.hp<this.convoy.maxHp-55 &&
            game.gameTime>=this.convoy.repairAt && center(game.player,this.convoy)<150)
            return {type:'convoy-repair',x:this.convoy.x,y:this.convoy.y};
        // Expose the existing docking interaction as a visible contextual
        // action: the keyboard and touch controls now offer the same action.
        const base=game.friendlyBases.dockable?.(game);
        if(base)return {type:'station-panel',name:base.displayName||'Станция',
            x:base.x,y:base.y,activated:!!base.activated};
        return null;
    }
    interact(game){
        const p=this.canInteract(game);
        if(!p)return false;
        if(p.type==='station-panel'){
            if(typeof game.openBaseDock!=='function')return false;
            game.openBaseDock();
            return game.state===GameState.DOCK;
        }
        if(p.type==='relay-overcharge'){
            if(game.friendlyBases.credits<20){
                game.createFloatingText?.('НУЖНО 20 ДЕТАЛЕЙ',p.x,p.y-76,'#ffbd90');
                return false;
            }
            const c=this.convoy;
            if(c.phase!=='charging'||c.leg!==p.leg||
                c.overchargedLegs.has(p.leg))return false;
            game.friendlyBases.credits-=20;
            c.overchargedLegs.add(p.leg);
            c.hold=Math.max(0,c.hold-25);
            c.raidClock=Math.min(c.raidClock,4);
            game.worldVfx?.nova(p.x,p.y,155,'cyan');
            game.createFloatingText?.('ЗАРЯДКА −25 С · ТРЕВОГА',p.x,p.y-90,'#9df5e9');
            this._announce(game,'Реле форсировано: зарядка ускорена на 25 секунд. '+
                'Перехватчики заметили энергетический выброс — защищайте транспорт.');
            this._updateHud(game);return true;
        }
        if(p.type==='route-choice'){
            const q=this.quarry;
            if(!q.started||!q.forkReached||q.routeChoice)return false;
            q.routeChoice=p.route;
            q.routeLeg=0;
            q.nextEscort=game.gameTime+(p.route==='direct'?5:12);
            p.used=true;
            game.worldVfx?.nova(p.x,p.y,150,'cyan');
            this.log?.note('МАРШРУТ «КРОТА» ВЫБРАН',
                p.route==='direct'?
                'Быстрый проход сокращает время бурения. На подходе к рудному хребту разведчики устроили засаду: придётся расчистить путь от перехватчиков.':
                'Тропа через укрытия длиннее. На первой стоянке работает ремонтный дрон, который укрепит корпус «Крота»; перехватчики появляются реже.',
                'Сопровождайте буровую к месторождению.',true);
            this._updateHud(game);return true;
        }
        if(p.type==='rig-repair'){
            if(game.friendlyBases.credits<14){
                game.createFloatingText?.('НУЖНО 14 ДЕТАЛЕЙ',p.x,p.y-70,'#ffbd90');return false;
            }
            game.friendlyBases.credits-=14;
            const rig=this.quarry.rig;rig.hp=Math.min(rig.maxHp,rig.hp+125);
            rig.repairAt=game.gameTime+18;
            game.worldVfx?.nova(rig.x,rig.y,110,'cyan');
            this._announce(game,'Буровая восстановлена. Продолжайте сопровождение.');
            this._updateHud(game);return true;
        }
        if(p.type==='reboot'){
            // A destroyed relay can be recovered, even with no spare parts.
            const price=game.friendlyBases.credits>=18?18:0;
            game.friendlyBases.credits-=price;
            p.base.hp=92;p.base.activated=true;
            p.base.missionRepairAt=game.gameTime+18;
            this.network.reboots++;
            this.network.lastDownId=null;
            game.worldVfx?.nova(p.x,p.y,160,'cyan');
            this.log?.note('СВЯЗЬ ВОССТАНОВЛЕНА',
                'Вы перезапустили повреждённый реактор. Реле снова принимает команды. Защищайте станцию — противник может повторить налёт.',
                'Отразите оставшиеся атаки.',true);
            if(this.network.defenseReady && this.defenses<2)
                game.friendlyBases.nextRaidAt=game.gameTime+24;
            this._updateHud(game);return true;
        }
        if(p.type==='convoy-repair'){
            if(game.friendlyBases.credits<24){
                game.createFloatingText?.('НУЖНО 24 ДЕТАЛИ',p.x,p.y-65,'#ffc596');
                return false;
            }
            game.friendlyBases.credits-=24;
            this.convoy.hp=Math.min(this.convoy.maxHp,this.convoy.hp+160);
            this.convoy.repairAt=game.gameTime+26;
            game.worldVfx?.nova(p.x,p.y,135,'cyan');
            game.createFloatingText?.('КАРАВАН ОТРЕМОНТИРОВАН · +160',p.x,p.y-95,'#a4ffdf');
            this._announce(game,'Обшивка каравана восстановлена. Продолжайте сопровождение.');
            this._updateHud(game);
            return true;
        }
        if(p.type==='repair'){
            const price=18;
            if(game.friendlyBases.credits<price){
                game.createFloatingText?.('НУЖНО 18 ДЕТАЛЕЙ',p.x,p.y-70,'#ffba90');
                return false;
            }
            game.friendlyBases.credits-=price;
            p.base.hp=Math.min(p.base.maxHp,p.base.hp+60);
            p.base.missionRepairAt=game.gameTime+16;
            game.worldVfx?.nova(p.x,p.y,125,'cyan');
            game.createFloatingText?.('РЕМОНТ СТАНЦИИ · +60',p.x,p.y-95,'#9bffe7');
            this._announce(game,'Полевой ремонт выполнен. Реактор защищён.');
            this._updateHud(game);
            return true;
        }
        p.used=true;
        if(p.type==='cache'){
            game.friendlyBases.addCredits(28,game,p.x,p.y);
            game.player.gainExp(42);
            game.worldVfx?.boostCollect(p.x,p.y,'gold');
            game.createFloatingText?.('ЗАПЧАСТИ · +28 ⚙ · +42 XP',p.x,p.y-56,'#ffdb96');
            this._announce(game,'Контейнер разобран. Собраны детали и энергия.');
        }else if(p.type==='rig'){
            this.quarry.started=true;this.quarry.nextEscort=Infinity;
            game.worldVfx?.nova(p.x,p.y,145,'cyan');
            this.log?.note('БУРЕНИЕ НАЧАТО · СОПРОВОЖДЕНИЕ',
                'Арсенал передал оборудование самоходной буровой «Крот». Проведите её к развилке, затем включите один из двух навигационных узлов. Быстрый проход опаснее, обход через укрытия позволит укрепить корпус. При необходимости ремонтируйте машину за 14 деталей.',
                'Проводите «Крота» к месторождению и защищайте от перехватчиков.',true);
        }else if(p.type==='decoy'){
            this.network.decoyChecked=true;
            this._spawnDecoyHunters(game);
            this.log?.note('ЛОВУШКА · ЛОЖНЫЙ СИГНАЛ',
                'Аварийный сигнал оказался приманкой. Вместо спасателей здесь скрывались охотники. Уничтожьте группу, чтобы восстановить подлинные координаты узла перехвата.',
                'Отбейте засаду возле ложного ретранслятора.',true);
        }else if(p.type==='beacon'){
            this.beaconOnline=true;
            if(this.index===1){
                const f=this.first;
                f.beacons=Number(p.id.slice(-1));
                f.nextWave=game.gameTime+7;
                if(f.beacons===2)f.betaHp=f.betaMaxHp;
                if(f.beacons===3){
                    f.finalStart=game.gameTime;
                    f.siegeElapsed=0;
                    f.nextSiege=42;
                    f.siegeWaves=0;
                    game.friendlyBases.addCredits(75,game,p.x,p.y);
                    game.player.gainExp(160);
                    this._announce(game,'Маяк «Гамма» запущен! До удара 42 секунды. '+
                        'Откройте три бастиона, установите турели и готовьте ремонт.');
                }else{
                    game.friendlyBases.addCredits(f.beacons===1?45:60,game,p.x,p.y);
                    game.player.gainExp(f.beacons===1?110:170);
                    this._announce(game,f.beacons===1?
                        'Маяк «Альфа» отвечает! Приготовьтесь к двум волнам разведчиков.':
                        'Маяк «Бета» включён. Вражеские абордажники попробуют захватить его.');
                }
            }else{
                game.friendlyBases.addCredits(25,game,p.x,p.y);
                game.player.gainExp(52);
                this._announce(game,'Аварийный маяк восстановлен. Ожидайте корабль охраны.');
            }
            game.worldVfx?.nova(p.x,p.y,180,'cyan');
        }else if(p.type==='gate'){
            this.exitOnline=true;
            game.friendlyBases.addCredits(35,game,p.x,p.y);
            game.player.gainExp(70);
            game.worldVfx?.nova(p.x,p.y,250,'cyan');
            this._announce(game,this.index===2?
                'Аварийный шлюз открыт! Геологи эвакуированы, сектор карьера зачищен.':
                'Врата эвакуации открыты. Вражеский флагман засёк сигнал: приготовьтесь к перехвату.');
            if(this.index===4)this.evacuation.bossCueAt=game.gameTime+8;
            if(this.index===2){this._victory(game);return true;}
        }else if(p.type==='jammer'){
            this.jammerOffline=true;
            game.friendlyBases.addCredits(30,game,p.x,p.y);
            game.player.gainExp(60);
            game.worldVfx?.nova(p.x,p.y,250,'cyan');
            game.friendlyBases.nextRaidAt=Infinity;
            this._announce(game,'Помехи устранены. Враг успел повредить удалённую лабораторию!');
            if(this.index===3&&!this.jammerBriefed){
                this.jammerBriefed=true;this.network.sabotaged=true;
                const lab=this.getBase(game,2);
                lab.hp=Math.max(70,Math.min(lab.hp,85));
                game.worldVfx?.nova(lab.x,lab.y,135,'orange');
                this.log?.note('ЗАДАНИЕ ИЗМЕНЕНО · ДИВЕРСИЯ',
                    'Перед отключением подавителя противник перегрузил реактор лаборатории «Пульс». Реле ещё работает, но его защита почти исчерпана. Доберитесь до лаборатории и восстановите корпус. После ремонта начнутся два налёта на выбранные вами станции.',
                    'Вернитесь к «Пульсу» и отремонтируйте реактор.',true);
            }
        }
        this._updateHud(game);
        return true;
    }
    // A nearby, currently unavailable object still explains what the player
    // must do. The disabled action button cannot consume input or grant rewards.
    blockedInteraction(game){
        const p=this.props.filter(v=>!v.used&&center(game.player,v)<175)
            .sort((a,b)=>center(game.player,a)-center(game.player,b))[0];
        if(!p)return null;
        const bases=game.friendlyBases.bases;
        let reason='';
        if(p.type==='beacon'&&this.index===1){
            const f=this.first;
            if(!bases[0]?.activated)reason='СНАЧАЛА ЗАПУСТИТЕ ВЕРФЬ';
            else if(p.id==='beacon-2'){
                if(f.beacons<1)reason='СНАЧАЛА ВКЛЮЧИТЕ «АЛЬФУ»';
                else if(f.alpha<2||game.enemies.some(e=>
                    e.missionBeaconWave==='alpha'&&e.hp>0))
                    reason='СНАЧАЛА ОТРАЗИТЕ ВОЛНЫ У «АЛЬФЫ»';
            }else if(p.id==='beacon-3'){
                if(f.beacons<2)reason='СНАЧАЛА ВКЛЮЧИТЕ «БЕТУ»';
                else if(f.beta<2||game.enemies.some(e=>
                    e.missionBeaconWave==='beta'&&e.hp>0))
                    reason='СНАЧАЛА ЗАЩИТИТЕ «БЕТУ»';
            }
        }else if(p.type==='rig'&&this.index===2&&!bases[1]?.activated)
            reason='СНАЧАЛА ВКЛЮЧИТЕ АРСЕНАЛ';
        else if(p.type==='route-choice'&&this.index===2){
            if(!this.quarry.started)reason='СНАЧАЛА ЗАПУСТИТЕ «КРОТА»';
            else if(!this.quarry.forkReached)reason='ДОЖДИТЕСЬ «КРОТА» У РАЗВИЛКИ';
            else if(this.quarry.routeChoice)reason='МАРШРУТ УЖЕ ВЫБРАН';
        }
        else if(p.type==='decoy'&&this.index===3&&!this.allBasesActive(game))
            reason='СНАЧАЛА ВОССТАНОВИТЕ 3 СТАНЦИИ';
        else if(p.type==='jammer'&&this.index===3){
            if(!this.network.decoyCleared)reason='СНАЧАЛА ПРОВЕРЬТЕ ЛОЖНЫЙ СИГНАЛ';
            else if(this.enemySiteAlive(game))reason='СНАЧАЛА УНИЧТОЖЬТЕ УЗЕЛ «ЭХО»';
            else if(!this.allBasesActive(game))
                reason='СНАЧАЛА ВОССТАНОВИТЕ ОБЯЗАТЕЛЬНЫЕ СТАНЦИИ';
        }else if(p.type==='gate'&&this.index===2){
            if(!this.quarry.completed)reason='СНАЧАЛА ПРОВЕДИТЕ БУРОВУЮ';
            else if(this.enemySiteAlive(game))reason='СНАЧАЛА УНИЧТОЖЬТЕ ФОРПОСТ';
            else if(!this.quarry.overload)
                reason='ДОЖДИТЕСЬ АВАРИЙНОГО СИГНАЛА';
            else if(!this.bossStarted)
                reason='БРОНЕНОСЕЦ В ПУТИ · ГОТОВЬТЕСЬ К БОЮ';
            else if(this.boss?.hp>0&&game.enemies.includes(this.boss))
                reason='СНАЧАЛА УНИЧТОЖЬТЕ «ДРОБИЛЬЩИКА»';
            else if(!this.allBasesActive(game))
                reason='СНАЧАЛА ВОССТАНОВИТЕ СТАНЦИИ';
        }else if(p.type==='gate'&&this.index===4){
            if(!this.trap?.cleared||this.convoy?.leg!==3)
                reason='СНАЧАЛА ОСВОБОДИТЕ КАРАВАН';
            else if(!this.allBasesActive(game))
                reason='СНАЧАЛА ВОССТАНОВИТЕ РЕЛЕ';
        }
        return {name:p.name,reason:reason||'ПОДЛЕТИТЕ БЛИЖЕ',
            locked:!!reason};
    }
    target(game){
        const bases=game.friendlyBases.bases;
        if(this.index===1){
            const f=this.first;
            if(!bases[0].activated)return bases[0];
            if(f.beacons===0)return this.props.find(p=>p.id==='beacon-1');
            if(f.beacons===1 || f.beacons===2){
                const name=f.beacons===1?'alpha':'beta';
                const living=game.enemies.filter(e=>
                    e.missionBeaconWave===name&&e.hp>0);
                if(living.length)return living.reduce((best,e)=>
                    center(e,game.player)<center(best,game.player)?e:best);
                const waiting=f.beacons===1?f.alpha<2:f.beta<2;
                return this.props.find(p=>p.id===(
                    waiting?'beacon-'+f.beacons:'beacon-'+(f.beacons+1)));
            }
            const inactive=bases.slice(1).find(b=>!b.activated&&b.hp>0);
            if(inactive)return inactive;
            if(this.boss&&this.boss.hp>0&&game.enemies.includes(this.boss))return this.boss;
            return this.props.find(p=>p.id==='beacon-3');
        }
        if(this.index===2){
            if(!bases[0].activated)return bases[0];
            if(this.sealRemaining(game)>4){
                const rocks=game.worldObstacles.filter(r=>r.missionSeal&&!r.destroyed);
                return rocks.reduce((best,r)=>!best||center(r,game.player)<center(best,game.player)?r:best,null);
            }
            if(!bases[1].activated)return bases[1];
            if(!this.quarry.completed){
                if(this.quarry.forkReached&&!this.quarry.routeChoice){
                    const choices=this.props.filter(p=>p.type==='route-choice');
                    return choices.reduce((best,p)=>!best||center(game.player,p)<center(game.player,best)?p:best,null);
                }
                const blockers=game.enemies.filter(e=>e.missionRigBlocker&&e.hp>0);
                if(this.quarry.awaitingClear&&blockers.length)
                    return blockers.reduce((best,e)=>center(game.player,e)<center(game.player,best)?e:best);
                return this.quarry.rig;
            }
            if(this.enemySiteAlive(game))return this.enemySite;
            const gate=this.props.find(p=>p.id==='escape-gate');
            if(this.boss && game.enemies.includes(this.boss) &&
                center(game.player,gate)<1050)return this.boss;
            return gate;
        }
        if(this.index===4){
            const c=this.convoy;
            if(!bases[0].activated)return bases[0];
            if(c.phase==='blocked'){
                const blocks=game.worldObstacles.filter(r=>r.missionRoadblock===c.leg+1&&!r.destroyed);
                return blocks.reduce((best,r)=>!best||center(r,game.player)<center(best,game.player)?r:best,null);
            }
            if(c.leg<2&&c.phase==='docking')return bases[c.leg+1];
            if(this.trap&&!this.trap.cleared)return c;
            if(c.leg===3&&!this.exitOnline)return this.props.find(p=>p.type==='gate');
            if(this.bossStarted&&this.boss?.hp>0&&game.enemies.includes(this.boss))return this.boss;
            return c;
        }
        const ruined=bases.find(b=>!b.missionOptional&&b.hp<=0);
        if(ruined)return ruined;
        const dormant=bases.filter(b=>!b.missionOptional&&!b.activated&&b.hp>0);
        if(dormant.length)return dormant.reduce((best,b)=>
            !best||center(b,game.player)<center(best,game.player)?b:best,null);
        if(!this.network.decoyChecked)return this.props.find(p=>p.id==='decoy');
        if(!this.network.decoyCleared)return game.enemies.find(e=>e.missionDecoy&&e.hp>0) ||
            this.props.find(p=>p.id==='decoy');
        if(this.enemySiteAlive(game))return this.enemySite;
        if(!this.jammerOffline)return this.props.find(p=>p.id==='jammer');
        if(!this.network.defenseReady)return bases[2];
        const raid=game.friendlyBases.raid;
        if(raid)return bases.find(b=>b.id===raid.baseId)||bases[2];
        if(this.defenses<2){
            const mandatory=bases.filter(b=>!b.missionOptional&&b.activated&&b.hp>0);
            return mandatory.reduce((best,b)=>!best||center(game.player,b)<center(game.player,best)?b:best,null);
        }
        return null;
    }
    objective(game){
        const message=this._objectiveRaw(game);
        if(!window.matchMedia?.('(any-pointer: coarse)').matches)return message;
        return message.replace(/ · E(?=[. ·]|$)/g,'').replace(/ · база: E/g,'');
    }
    _objectiveRaw(game){
        const t=game.gameTime;
        const b=game.friendlyBases.bases;
        if(this.index===1){
            const f=this.first;
            if(!b[0].activated)return '01 · Запустите верфь «Луч» · E · затем установите турель';
            if(f.beacons===0)return '02 · Найдите маяк «Альфа», соберите детали и включите его · E';
            if(f.beacons===1 && (f.alpha<2 ||
                game.enemies.some(e=>e.missionBeaconWave==='alpha'&&e.hp>0))){
                const alive=game.enemies.some(e=>e.missionBeaconWave==='alpha'&&e.hp>0);
                const beacon=this.props.find(p=>p.id==='beacon-1');
                const pause=f.alpha<2&&!alive?center(game.player,beacon)>960?
                    ' · вернитесь к маяку':' · следующая атака через '+
                    Math.ceil(Math.max(0,f.nextWave-t))+' с':'';
                return '02 · Защитите «Альфу» · волны '+f.alpha+'/2'+pause;
            }
            if(f.beacons===1)return '03 · Открыт маяк «Бета» · следуйте по туманному коридору';
            if(f.beacons===2 && (f.beta<2 ||
                game.enemies.some(e=>e.missionBeaconWave==='beta'&&e.hp>0))){
                const alive=game.enemies.some(e=>e.missionBeaconWave==='beta'&&e.hp>0);
                const beacon=this.props.find(p=>p.id==='beacon-2');
                const pause=f.beta<2&&!alive?center(game.player,beacon)>960?
                    ' · вернитесь к маяку':' · следующая атака через '+
                    Math.ceil(Math.max(0,f.nextWave-t))+' с':'';
                return '03 · Защитите «Бету» · волны '+f.beta+'/2'+
                    ' · узел '+Math.round(f.betaHp/f.betaMaxHp*100)+'%'+pause;
            }
            if(f.beacons===2)return '04 · Активируйте последний маяк «Гамма» · E';
            const active=b.slice(1).filter(x=>x.activated&&x.hp>0).length;
            const turrets=b.slice(1).reduce((n,x)=>n+x.turrets.filter(v=>v.integrity!==0).length,0);
            if(active<3 || turrets<3)return '05 · До налёта '+clock(Math.max(0,f.nextSiege-f.siegeElapsed))+
                ' · бастионы '+active+'/3 · турели '+turrets+'/3 · база: E';
            if(this.boss&&game.enemies.includes(this.boss))
                return '06 · Защищайте маяк от бомбардировщиков и уничтожьте «Стража верфи»';
            if(!this.bossStarted)return '06 · Щит «Гаммы» '+Math.ceil(f.coreHp/f.maxCoreHp*100)+
                '% · '+(f.siegeWaves<3?'волна '+(f.siegeWaves+1)+'/3 через '+
                clock(Math.max(0,f.nextSiege-f.siegeElapsed)):'ожидайте флагман');
            return '07 · Уничтожьте оставшихся осадных противников · '+
                game.enemies.filter(e=>e.missionFinalRaider&&e.hp>0).length+' целей';
        }
        if(this.index===2){
            if(!b[0].activated)return '01 · Подлетите к доку геологов · E · включите станцию';
            const sealed=this.sealRemaining(game);
            if(sealed>4)return '02 · Пробейте проход: '+(7-sealed)+'/3 рудных сердечника';
            if(!b[1].activated)return '03 · Запустите арсенал «Прометей» · E';
            const q=this.quarry,rig=q.rig;
            if(!q.started)return '04 · Запустите буровую «Крот» · E';
            if(!q.completed){
                if(q.forkReached&&!q.routeChoice)
                    return '04 · «Крот» ждёт выбора · включите БЫСТРЫЙ ПРОХОД или УКРЫТИЯ · E';
                if(q.awaitingClear)
                    return '04 · «Крот» под обстрелом! Сбейте засаду · целей '+
                        game.enemies.filter(e=>e.missionRigBlocker&&e.hp>0).length+
                        ' · корпус '+Math.ceil(rig.hp/rig.maxHp*100)+'%';
                const distance=Math.round(center(game.player,rig));
                if(distance>=660)return '04 · «Крот» ждёт вас · подлетите к буровой · '+
                    distance+' м · корпус '+Math.ceil(rig.hp/rig.maxHp*100)+'%';
                return '04 · «Крот»: '+(q.routeChoice==='direct'?'быстрый проход':
                    q.routeChoice==='shelter'?'укрытия':'развилка')+
                    ' · корпус '+Math.ceil(rig.hp/rig.maxHp*100)+'% · держитесь поблизости';
            }
            if(this.enemySiteAlive(game))return '05 · Уничтожьте форпост «Шлак» · гарнизон усиливается';
            if(!this.bossStarted)return '06 · АВАРИЯ РЕАКТОРА · уходите к шлюзу · '+Math.ceil(Math.max(0,q.overloadAt+10-t))+' с до прибытия броненосца';
            if(this.boss && game.enemies.includes(this.boss))
                return '06 · Уходите к аварийному шлюзу и уничтожьте «Дробильщика»';
            return '07 · Откройте аварийный шлюз · E · сектор нестабилен';
        }
        if(this.index===4){
            const c=this.convoy;
            if(!b[0].activated)return '01 · Запустите стартовый док · E · караван тронется';
            if(c.phase==='blocked')return '02 · Разобрать огнём завал на маршруте каравана';
            if(c.phase==='waiting')return '02 · Вернуться к каравану — он ждёт сопровождения';
            if(c.leg<2&&c.phase==='docking')return '03 · Активируйте '+b[c.leg+1].displayName+' · E';
            if(this.trap&&!this.trap.cleared)return this.trap.phase==='impact'?
                '04 · ЗАСАДА! Два транспорта уничтожены. Средний пытается освободиться':
                '04 · ЗАЩИЩАЙТЕ КАРАВАН · '+progressCaption(this.trap)+
                ' · абордажников '+game.enemies.filter(e=>e.missionBoarder&&e.hp>0).length;
            if(c.phase==='charging'&&center(game.player,c)>560)
                return '03 · Зарядка остановлена · вернитесь к каравану';
            if(c.phase==='charging')return '03 · Защищайте караван · реле '+Math.ceil(c.hold)+' с'+
                (c.combatCharge?' · победы ускорили на '+c.combatCharge+' с':'')+
                (c.overchargedLegs.has(c.leg)?' · форсаж использован':'');
            if(c.leg<3)return '02 · Сопроводить транспорт до '+(c.leg===0?'первого':'следующего')+' реле';
            if(!this.exitOnline)return '04 · Включить врата эвакуации · E';
            if(!this.bossStarted)return '05 · Флагман перехвата прибудет через '+
                clock(Math.max(0,(this.evacuation?.bossCueAt??t)-t))+' · готовьте оборону';
            if(this.boss&&game.enemies.includes(this.boss))
                return '05 · Защитить транспорт и уничтожить флагман «Корсар»';
            return '06 · Спасатели стыкуются · '+
                clock(Math.max(0,(this.evacuation?.rescueAt??t+12)-t))+
                ' · сохраните караван и работающие реле';
        }
        const ready=b.filter(x=>!x.missionOptional&&x.activated&&x.hp>0).length;
        if(b.some(x=>!x.missionOptional&&x.hp<=0))
            return '01 · Перезапустите повреждённую обязательную станцию · E';
        if(ready<3 && !this.jammerOffline)return '01 · Включите обязательные станции · E · '+ready+'/3';
        if(!this.network.decoyChecked)return '02 · Проверьте неизвестный сигнал · E';
        if(!this.network.decoyCleared)return '02 · Отразите засаду у ложного ретранслятора';
        if(this.enemySiteAlive(game))return '03 · Уничтожьте узел перехвата «Эхо»';
        if(!this.jammerOffline)return '04 · Отключите подавитель · E';
        const down=b.filter(x=>!x.missionOptional&&x.hp<=0);
        if(down.length)return '05 · РЕАКТОР ОТКЛЮЧЁН · вернитесь и перезапустите станцию · E';
        if(!this.network.defenseReady)return '05 · Отремонтируйте лабораторию «Пульс» · E';
        if(this.defenses<2){
            const raid=game.friendlyBases.raid;
            if(raid?.state==='warning'){
                const defended=b.find(base=>base.id===raid.baseId);
                return '06 · Налёт на «'+(defended?.displayName||'станцию')+
                    '» через '+Math.ceil(raid.countdown)+' с · отражено '+this.defenses+'/2';
            }
            if(raid?.state==='active'){
                const defended=b.find(base=>base.id===raid.baseId);
                return '06 · Защищайте «'+(defended?.displayName||'станцию')+
                    '» · сбейте бомбардировщики · отражено '+this.defenses+'/2';
            }
            const reserve=b[3]?.activated&&b[3].hp>0?' · резерв «Край» подключён':'';
            return '06 · Подлетите к ЛЮБОЙ обязательной станции: там начнётся налёт · '+
                this.defenses+'/2'+reserve;
        }
        return '07 · Сеть удержана · все обязательные реакторы работают';
    }
    /** Real raiders threaten the escort, but cannot damage it offscreen. */
    _spawnRigRaiders(game,blocking=false){
        const q=this.quarry,rig=q.rig;
        if(game.enemies.length>=53)return 0;
        const alive=game.enemies.filter(e=>e.missionRigRaider&&e.hp>0).length;
        if(alive>=4)return 0;
        const count=Math.min(blocking?3:2,4-alive,53-game.enemies.length);
        for(let i=0;i<count;i++){
            const a=(q.escorts*2+i)*2.399963+.6;
            const x=rig.x+Math.cos(a)*320,y=rig.y+Math.sin(a)*320;
            const enemy=new Enemy(x,y,i===1?ENEMIES.MAGE:ENEMIES.STALKER,
                blocking?1.18:1.08,1);
            enemy.missionRigRaider=true;
            enemy.missionRigBlocker=blocking;
            enemy.rigAttack=blocking?1.5:2.2;
            enemy.update=(delta,g)=>{
                enemy.flashTimer=Math.max(0,enemy.flashTimer-delta);
                if(center(g.player,rig)>720)return;
                const dx=rig.x-enemy.x,dy=rig.y-enemy.y,d=Math.hypot(dx,dy);
                if(d>82){
                    const step=Math.min(d-75,(blocking?117:104)*delta);
                    enemy.x+=dx/d*step;enemy.y+=dy/d*step;
                    enemy.visualAngle=Math.atan2(dy,dx);
                }else{
                    enemy.rigAttack-=delta;
                    if(enemy.rigAttack<=0){
                        rig.hp=Math.max(0,rig.hp-(blocking?12:10));
                        enemy.rigAttack=4.7;
                        g.createFloatingText?.('БУРОВАЯ ПОД УДАРОМ',
                            rig.x,rig.y-76,'#ffab88');
                        g.createParticles?.(rig.x,rig.y,'#ffa47d',5);
                    }
                }
            };
            game.enemies.push(enemy);game.worldVfx?.nova(x,y,34,'orange');
        }
        if(count>0)q.escorts++;
        return count;
    }
    _updateQuarry(game,dt){
        const q=this.quarry,rig=q.rig,t=game.gameTime;
        if(q.started&&!q.completed){
            if(rig.hp<=0){
                this.failed=true;
                this._announce(game,'Самоходная буровая уничтожена. Оборудование шахты потеряно.');
                game.gameOver();return;
            }
            const nearEscort=center(game.player,rig)<660;
            if(!q.forkReached){
                const fork={x:this.cx+this.scene.quarryFork.dx,
                    y:this.cy+this.scene.quarryFork.dy};
                const d=center(rig,fork);
                if(d<8){
                    q.forkReached=true;rig.x=fork.x;rig.y=fork.y;
                    this.log?.note('РАЗВИЛКА · ВАШЕ РЕШЕНИЕ',
                        '«Крот» ждёт команду. Подлетите к одному из двух навигационных узлов и нажмите E. Верхний маршрут быстрее, но разведчики устроили там засаду. Нижний длиннее: на первой стоянке ремонтный дрон укрепит корпус.',
                        'Выберите быстрый проход или тропу через укрытия.',true);
                }else if(nearEscort){
                    const step=Math.min(d,49*dt);
                    rig.x+=(fork.x-rig.x)/d*step;
                    rig.y+=(fork.y-rig.y)/d*step;
                }
            }else if(q.routeChoice){
                const blockers=game.enemies.filter(e=>e.missionRigBlocker&&e.hp>0);
                if(q.awaitingClear&&blockers.length===0){
                    q.awaitingClear=false;
                    game.friendlyBases.addCredits(24,game,rig.x,rig.y);
                    game.createFloatingText?.('ПРОХОД ОТКРЫТ · +24 ⚙',
                        rig.x,rig.y-105,'#a0ffde');
                    this._announce(game,'Перехватчики уничтожены. «Крот» снова идёт к залежи.');
                }
                if(!q.awaitingClear&&nearEscort){
                    const route=this.scene.quarryRoutes[q.routeChoice];
                    const waypoint=route[Math.min(q.routeLeg,route.length-1)];
                    const goal={x:this.cx+waypoint.dx,y:this.cy+waypoint.dy};
                    const d=center(rig,goal);
                    if(d<8){
                        rig.x=goal.x;rig.y=goal.y;
                        if(q.routeLeg===0&&q.routeChoice==='direct'&&!q.ambushTriggered){
                            // The blocking squad must exist before advancing
                            // the route; a full enemy cap retries next frame.
                            const spawned=this._spawnRigRaiders(game,true);
                            if(spawned>0){
                                q.ambushTriggered=true;q.awaitingClear=true;
                                this._announce(game,'ЗАСАДА В РУДНОМ ХРЕБТЕ! '+spawned+
                                    ' перехватчика блокируют «Крота». Уничтожьте их.');
                                q.routeLeg++;
                            }
                        }else{
                            if(q.routeLeg===0&&q.routeChoice==='shelter'&&!q.serviceUsed){
                                q.serviceUsed=true;
                                const restored=Math.min(55,rig.maxHp-rig.hp);
                                rig.hp+=restored;
                                game.worldVfx?.nova(rig.x,rig.y,120,'cyan');
                                game.createFloatingText?.('СЕРВИСНЫЙ ДРОН · +'+restored,
                                    rig.x,rig.y-108,'#b0ffdc');
                            }
                            q.routeLeg++;
                            if(q.routeLeg>=route.length){
                                q.completed=true;
                                game.friendlyBases.addCredits(48,game,rig.x,rig.y);
                                game.player.gainExp(85);
                                game.worldVfx?.nova(rig.x,rig.y,200,'cyan');
                                this.log?.note('БУРЕНИЕ ЗАВЕРШЕНО · НОВАЯ ЦЕЛЬ',
                                    '«Крот» достиг залежи и передал геологам оборудование. Защитные пушки форпоста «Шлак» ещё действуют. Уничтожьте форпост и откройте путь для эвакуации.',
                                    'Уничтожьте форпост «Шлак».',true);
                            }
                        }
                    }else{
                        const speed=q.routeChoice==='direct'?64:45;
                        const step=Math.min(d,speed*dt);
                        rig.x+=(goal.x-rig.x)/d*step;
                        rig.y+=(goal.y-rig.y)/d*step;
                    }
                    if(!q.completed&&!q.awaitingClear&&t>=q.nextEscort){
                        this._spawnRigRaiders(game);
                        q.nextEscort=t+(q.routeChoice==='direct'?12:20);
                    }
                }
            }
        }
        if(q.completed&&!q.overload&&!this.enemySiteAlive(game)){
            q.overload=true;q.overloadAt=t;q.nextShock=t+9;
            this.log?.note('АВАРИЯ · РЕАКТОРЫ КАРЬЕРА',
                'После гибели форпоста автоматика шахты перегрузила реакторы. Через несколько секунд в сектор войдёт тяжёлый броненосец «Дробильщик». Эвакуируйтесь через восточный шлюз. Не задерживайтесь в отмеченных зонах реакторных выбросов.',
                'Летите к аварийному шлюзу. Уничтожьте преследующий броненосец.',true);
            game.worldVfx?.nova(this.enemySite.x,this.enemySite.y,340,'orange');
        }
        if(!q.overload)return;
        if(t>=q.nextShock){
            const p=game.player;
            const x=p.x+clamp(p.vx||0,-150,150)*.28;
            const y=p.y+clamp(p.vy||0,-150,150)*.28;
            q.shots.push({x,y,ttl:2.6,total:2.6,radius:124});
            q.nextShock=t+19;
            game.createFloatingText?.('⚠ РЕАКТОРНЫЙ ВЫБРОС',x,y-112,'#ffcb87');
        }
        for(const shot of q.shots){
            shot.ttl-=dt;
            if(shot.ttl>0)continue;
            game.worldVfx?.nova(shot.x,shot.y,154,'orange');
            game.createParticles?.(shot.x,shot.y,'#ffc48d',14);
            if(center(game.player,shot)<=shot.radius)
                game.player.takeDamage(12,game);
        }
        q.shots=q.shots.filter(shot=>shot.ttl>0);
    }
    /** A real ambush is revealed where a false help signal was broadcast. */
    _spawnDecoyHunters(game){
        const p=this.props.find(v=>v.id==='decoy');
        for(let i=0;i<4&&game.enemies.length<55;i++){
            const a=i*Math.PI*.5+.4;
            const x=p.x+Math.cos(a)*295,y=p.y+Math.sin(a)*295;
            const enemy=new Enemy(x,y,i%2?ENEMIES.MAGE:ENEMIES.STALKER,1.06,1);
            enemy.missionDecoy=true;
            game.enemies.push(enemy);
            game.worldVfx?.nova(x,y,44,'orange');
        }
    }
    _updateNetwork(game){
        const n=this.network,t=game.gameTime;
        const reserve=this.getBase(game,3);
        if(reserve?.activated&&reserve.hp>0&&!n.reserveAnnounced){
            n.reserveAnnounced=true;
            this.log?.note('РЕЗЕРВНЫЙ КАНАЛ «КРАЙ» ПОДКЛЮЧЁН',
                'Резервный ретранслятор усилит оборону: при каждом из двух налётов он помешает одному бомбардировщику выйти на цель. «Край» необязателен; без него налёты тоже можно отбить.',
                'Продолжайте восстановление сети.',true);
        }
        if(n.decoyChecked&&!n.decoyCleared &&
            !game.enemies.some(e=>e.missionDecoy&&e.hp>0)){
            n.decoyCleared=true;
            const p=this.props.find(v=>v.id==='decoy');
            game.friendlyBases.addCredits(32,game,p.x,p.y);
            game.player.gainExp(72);
            this.log?.note('ЛОЖНАЯ ЦЕЛЬ РАСКРЫТА',
                'В сигнале охотников обнаружены подлинные координаты узла «Эхо». Он снабжает вражеский подавитель энергией. Выведите узел из строя, затем отключите подавитель.',
                'Найдите и уничтожьте узел «Эхо».',true);
        }
        if(n.sabotaged&&!n.defenseReady){
            const lab=this.getBase(game,2);
            if(lab.hp>=130&&this.allBasesActive(game)){
                n.defenseReady=true;
                game.friendlyBases.nextRaidAt=t+12;
                this.log?.note('ПУЛЬС ВОССТАНОВЛЕН · ОБОРОНА СЕТИ',
                    'Реактор лаборатории работает устойчиво. По восстановленным каналам противник нашёл сеть. Начинаются два локальных налёта. Можете выбрать позицию у любой действующей станции; удалённые станции не будут повреждаться без боя рядом с вами.',
                    'Отразите два налёта, сохранив три обязательных реактора.',true);
            }
        }
        const down=game.friendlyBases.bases.find(b=>!b.missionOptional&&b.hp<=0);
        if(!this.jammerOffline&&!down)return;
        if(down && n.lastDownId!==down.id){
            n.lastDownId=down.id;
            game.friendlyBases.nextRaidAt=Infinity;
            this.log?.note('АВАРИЙНАЯ ПОТЕРЯ СВЯЗИ',
                'Бомбардировщики отключили реактор станции «'+down.displayName+'». Дальняя станция больше не передаёт сигнал. Подлетите к её корпусу и перезапустите аварийный резерв. После восстановления атаки продолжатся.',
                'Перезапустите потерянную станцию · E.',true);
        }
    }
    /** Three-ship convoy becomes one trapped transport near the last gate. */
    _startConvoyAmbush(game){
        if(this.trap||!this.convoy)return;
        const c=this.convoy;
        this.trap=createConvoyTrap(c,this.route);
        c.phase='trapped';
        game.audio?.explosion?.();
        for(const wreck of this.trap.wrecks){
            game.worldVfx?.nova(wreck.x,wreck.y,176,'orange');
            game.createParticles?.(wreck.x,wreck.y,'#ffaf77',22);
        }
        this._announce(game,'ЗАСАДА! Орбитальные орудия уничтожили первый и последний транспорты. Главный корабль зажат между обломками.');
        game.createFloatingText?.('ОРБИТАЛЬНАЯ ЗАСАДА',c.x,c.y-170,'#ffac84');
    }

    /** Boarding squads are real targetable enemies and hurt the convoy. */
    _spawnConvoyBoarders(game){
        const c=this.convoy,trap=this.trap;
        if(!c||!trap||game.enemies.length>=55||
            game.enemies.filter(e=>e.missionBoarder&&e.hp>0).length>=6)return;
        const squad=trap.progress>.5?3:2;
        for(let i=0;i<squad&&game.enemies.length<55;i++){
            const a=trap.age*.71+i*2.39996;
            const x=c.x+Math.cos(a)*350,y=c.y+Math.sin(a)*350;
            const elite=trap.progress>.65&&i===0;
            const def=elite?ENEMIES.GUNSHIP:ENEMIES.STALKER;
            const rank=clamp(game.player?.level||1,1,15);
            const enemy=new Enemy(x,y,def,
                (elite ? .73 : 1.0)+rank*.024,1);
            enemy.missionConvoyRaider=true;
            enemy.missionBoarder=true;
            enemy.attackClock=2.9;
            enemy.update=(delta,g)=>{
                enemy.flashTimer=Math.max(0,enemy.flashTimer-delta);
                const dx=c.x-enemy.x,dy=c.y-enemy.y,d=Math.hypot(dx,dy);
                if(d>87){
                    const step=Math.min(d-72,(elite?92:125)*delta);
                    if(d>0){enemy.x+=dx/d*step;enemy.y+=dy/d*step;}
                    enemy.visualAngle=Math.atan2(dy,dx);
                }else{
                    enemy.attackClock-=delta;
                    if(enemy.attackClock<=0){
                        c.hp=Math.max(0,c.hp-(elite?11:8));
                        c.lastDamageAt=g.gameTime;
                        enemy.attackClock=4.3;
                        g.createFloatingText?.('АБОРДАЖ · КАРАВАН ПОВРЕЖДЁН',
                            c.x,c.y-112,'#ff9f8d');
                        g.createParticles?.(c.x,c.y,'#ff935c',6);
                    }
                }
            };
            game.enemies.push(enemy);
            game.worldVfx?.nova(x,y,42,'orange');
        }
    }

    _updateConvoyAmbush(game,dt){
        const trap=this.trap,c=this.convoy;
        if(!trap||trap.cleared)return;
        const events=advanceConvoyTrap(trap,dt);
        if(events.engineFailure){
            // The ship first attempts to push the wreck, overheats one engine,
            // then launches its own work drones: the player witnesses each step.
            game.audio?.explosion?.();
            game.worldVfx?.nova(c.x-trap.dx*105,c.y-trap.dy*105,90,'orange');
            game.createParticles?.(c.x-trap.dx*105,c.y-trap.dy*105,'#ff966d',18);
            c.hp=Math.max(1,c.hp-24);c.phase='salvaging';
            this.log?.note('ЗАДАНИЕ ИЗМЕНЕНО · ЗАСАДА',
                'Первый и последний транспорты уничтожены. Попытка протолкнуть обломки закончилась взрывом двигателя. Центральный корабль выпустил ремонтных дронов. Они постепенно разбирают обломки, а вам нужно отражать абордажные группы и избегать орбитальных ударов.',
                'Сохраните центральный транспорт до освобождения прохода.',true);
        }
        if(events.boarders)this._spawnConvoyBoarders(game);
        if(events.orbital && center(game.player,c)<850){
            const p=game.player;
            // Reticle stays where the shot was called: manoeuvring escapes it.
            const x=p.x+clamp(p.vx||0,-180,180)*.25;
            const y=p.y+clamp(p.vy||0,-180,180)*.25;
            trap.shots.push({x,y,ttl:CONVOY_TRAP.warningSeconds,
                total:CONVOY_TRAP.warningSeconds,radius:CONVOY_TRAP.orbitalRadius});
            game.createFloatingText?.('⚠ ОРБИТАЛЬНЫЙ ПРИЦЕЛ',
                x,y-96,'#ffc09a');
        }
        for(const shot of trap.shots){
            shot.ttl-=dt;
            if(shot.ttl>0)continue;
            game.audio?.explosion?.();
            game.worldVfx?.nova(shot.x,shot.y,118,'orange');
            game.createParticles?.(shot.x,shot.y,'#ff9d6d',16);
            if(center(shot,game.player)<=shot.radius)
                game.player.takeDamage(CONVOY_TRAP.orbitalDamage,game);
        }
        trap.shots=trap.shots.filter(shot=>shot.ttl>0);
        if(events.cleared){
            c.phase='exit';
            game.friendlyBases.addCredits(45,game,c.x,c.y);
            game.player.gainExp(95);
            this._announce(game,'Рабочие дроны разобрали обломки. Проход к вратам эвакуации освобождён.');
            this.log?.note('ПРОХОД ОСВОБОЖДЁН',
                'Дроны завершили разборку разбитых кораблей. Центральный транспорт спасён. Осталось включить эвакуационные врата и выдержать последнюю атаку.',
                'Активируйте врата. Уничтожьте флагман перехвата.',true);
        }
    }

    // Active escorting shortens a relay stop by up to eighteen seconds.
    // Only nearby convoy interceptors count; paid overcharge stays separate.
    onEnemyDestroyed(enemy){
        const c=this.convoy;
        if(this.index!==4 || !c || !enemy?.missionConvoyRaider ||
            c.phase!=='charging' || c.combatCharge>=18 ||
            center(enemy,c)>560)return 0;
        const bonus=Math.min(6,18-c.combatCharge,
            Math.floor(Math.max(0,c.hold-2)));
        if(bonus<=0)return 0;
        c.hold-=bonus;c.combatCharge+=bonus;
        return bonus;
    }

    _updateConvoy(game,dt){
        const c=this.convoy;
        if(!c)return;
        if(c.hp<=0){
            this.failed=true;
            this._announce(game,'Караван уничтожен. Коридор эвакуации потерян.');
            game.gameOver();
            return;
        }
        if(!this.getBase(game,0)?.activated){c.phase='launch';return;}
        c.launched=true;
        if(c.leg<this.route.length){
            const point=this.route[c.leg];
            const d=center(c,point);
            if(d<7){
                c.x=point.x;c.y=point.y;
                if(c.leg<2){
                    const base=this.getBase(game,c.leg+1);
                    if(!base.activated)c.phase='docking';
                    else{
                        if(!c.chargeStarted){
                            c.hold=point.hold;c.chargeStarted=true;c.combatCharge=0;
                            this._announce(game,base.displayName+
                                ' заряжает транспорт. Уничтожение перехватчиков рядом с реле ускоряет зарядку: до 18 секунд за стоянку.');
                        }
                        c.phase='charging';
                        // A distant pilot cannot safely skip the escort:
                        // relay charging resumes only when someone protects it.
                        if(center(game.player,c)<=560){
                            c.hold=Math.max(0,c.hold-dt);
                            if(c.hold<=0){
                                c.hp=Math.min(c.maxHp,c.hp+100);
                                c.leg++;c.chargeStarted=false;c.phase='moving';
                                game.worldVfx?.nova(c.x,c.y,140,'cyan');
                                this._announce(game,'Реле заряжено. Караван получил ремонт и продолжает путь.');
                            }
                        }
                    }
                }else{
                    c.leg=3;c.phase='trapped';
                    this._startConvoyAmbush(game);
                }
            }else{
                // The convoy stops before a real, destructible wreck barrier.
                const barrier=game.worldObstacles.find(r=>r.missionRoadblock===c.leg+1&&
                    !r.destroyed&&center(r,c)<235);
                if(barrier)c.phase='blocked';
                else if(center(game.player,c)>620)c.phase='waiting';
                else{
                    const step=Math.min(d,c.speed*dt);
                    c.x+=(point.x-c.x)/d*step;
                    c.y+=(point.y-c.y)/d*step;
                    c.phase='moving';
                }
            }
        }else c.phase=this.trap?.cleared?'exit':'trapped';
        // Raiders are native damageable enemies. Their close-range attacks
        // directly reduce the transport's HP rather than simulating losses.
        c.raidClock-=dt;
        if(center(game.player,c)>580||c.raidClock>0)return;
        const alive=game.enemies.filter(e=>e.missionConvoyRaider&&e.hp>0).length;
        if(alive<3&&game.enemies.length<55){
            const a=c.raids*2.399963+.3;
            const x=c.x+Math.cos(a)*380,y=c.y+Math.sin(a)*380;
            const isGunship=c.leg>=2&&c.raids%3===0;
            const def=isGunship?ENEMIES.GUNSHIP:ENEMIES.STALKER;
            const enemy=new Enemy(x,y,def,isGunship ? 0.78 : 2.0,1);
            enemy.missionConvoyRaider=true;enemy.attackClock=2.2;
            enemy.update=(delta,g)=>{
                enemy.flashTimer=Math.max(0,enemy.flashTimer-delta);
                // Never destroy an abandoned convoy invisibly while its
                // route and relay charge are intentionally suspended.
                if(center(g.player,c)>620)return;
                const dx=c.x-enemy.x,dy=c.y-enemy.y,distance=Math.hypot(dx,dy);
                if(distance>82){
                    const move=Math.min(distance-70,(isGunship?90:122)*delta);
                    if(distance>0){enemy.x+=dx/distance*move;enemy.y+=dy/distance*move;}
                    enemy.visualAngle=Math.atan2(dy,dx);
                }else{
                    enemy.attackClock-=delta;
                    if(enemy.attackClock<=0){
                        const damage=c.leg>=2?11:8;
                        c.hp=Math.max(0,c.hp-damage);
                        c.lastDamageAt=g.gameTime;
                        enemy.attackClock=4.4;
                        g.createFloatingText?.('КАРАВАН −'+damage,c.x,c.y-75,'#ff9879');
                        g.createParticles?.(c.x,c.y,'#ff9a74',8);
                    }
                }
            };
            game.enemies.push(enemy);c.raids++;
            game.worldVfx?.nova(x,y,42,'orange');
        }
        c.raidClock=Math.max(22,34-c.leg*4);
    }
    /** Compact, deterministic scripted bursts replace a slow random trickle. */
    _spawnBeaconWave(game,sector,count,hpMult,dmgMult){
        const f=this.first,at=this.props.find(p=>p.id===
            (sector==='alpha'?'beacon-1':'beacon-2'));
        if(!at)return 0;
        const num=sector==='alpha'?6+count*3:8+count*3;
        const safe=Math.max(0,55-game.enemies.length);
        const amount=Math.min(num,safe);
        if(!amount)return 0;
        for(let i=0;i<amount;i++){
            const angle=i*Math.PI*2/Math.max(1,amount)+count*.55;
            const d=335+(i%3)*44;
            const x=at.x+Math.cos(angle)*d,y=at.y+Math.sin(angle)*d;
            const def=sector==='alpha'?
                (i%4===0?ENEMIES.STALKER: i%3===0?ENEMIES.ZOMBIE:ENEMIES.BAT):
                (i%3===0?ENEMIES.STALKER:i%4===0?ENEMIES.WOLF:ENEMIES.ZOMBIE);
            const enemy=new Enemy(x,y,def,
                Math.min(1.25,Math.max(.75,hpMult*.88)),Math.max(.7,dmgMult*.76));
            enemy.missionBeaconWave=sector;
            if(sector==='beta' && i%4===0){
                enemy.missionSaboteur=true;
                enemy.attackClock=2.5+i*.1;
                enemy.update=(dt,g)=>{
                    enemy.flashTimer=Math.max(0,enemy.flashTimer-dt);
                    // An away pilot must not silently lose Beta offscreen.
                    if(center(g.player,at)>960)return;
                    const dx=at.x-enemy.x,dy=at.y-enemy.y,d=Math.hypot(dx,dy);
                    if(d>76){
                        const speed=85;
                        enemy.x+=dx/d*Math.min(d-70,speed*dt);
                        enemy.y+=dy/d*Math.min(d-70,speed*dt);
                        enemy.visualAngle=Math.atan2(dy,dx);
                    }else if(at.used){
                        enemy.attackClock-=dt;
                        if(enemy.attackClock<=0){
                            f.betaHp=Math.max(0,f.betaHp-10);
                            enemy.attackClock=3.2;
                            g.worldVfx?.hit(at.x,at.y,false,true);
                            g.createFloatingText?.('ЗАХВАТ −10',at.x,at.y-80,'#ff9f88');
                        }
                    }
                };
            }
            game.enemies.push(enemy);
        }
        game.worldVfx?.nova(at.x,at.y,105,sector==='alpha'?'orange':'violet');
        this._announce(game,sector==='alpha'?
            'ВОЛНА '+count+'/2 · разведчики атакуют «Альфу»!':
            'ВОЛНА '+count+'/2 · абордажники идут на захват «Беты»!');
        return amount;
    }
    _spawnFinalSiege(game){
        const f=this.first,bases=game.friendlyBases.bases.slice(1);
        const at=this.props.find(p=>p.id==='beacon-3');
        if(!at || !bases.length)return;
        const wave=++f.siegeWaves;
        const bombers=[0,1,2,3][Math.min(wave,3)];
        const escorts=[0,5,4,5][Math.min(wave,3)];
        const amount=Math.min(bombers+escorts,Math.max(0,60-game.enemies.length));
        for(let i=0;i<amount;i++){
            const heavy=i<bombers;
            const target=bases[(wave+i)%bases.length];
            const a=(wave*.85+i*.73)%(Math.PI*2);
            const x=at.x+Math.cos(a)*620,y=at.y+Math.sin(a)*620;
            const def=heavy?
                {...ENEMIES.BOMBER,id:'first_siege_bomber',name:'Осадный бомбардировщик',
                    hp:95+wave*17,speed:85,damage:12,exp:65,size:25,
                    bomber:false,archetype:'chaser'}:
                ENEMIES.STALKER;
            const enemy=new Enemy(x,y,def,heavy?1:1.15,1);
            enemy.missionFinalRaider=true;
            if(heavy){
                enemy.missionSiegeBomber=true;
                enemy.strikeTimer=2.8+i*.45;
                enemy.update=(dt,g)=>{
                    enemy.flashTimer=Math.max(0,enemy.flashTimer-dt);
                    if(center(g.player,at)>900)return;
                    const dx=target.x-enemy.x,dy=target.y-enemy.y,d=Math.hypot(dx,dy);
                    if(d>175){
                        const speed=75;
                        enemy.x+=dx/d*Math.min(speed*dt,d-170);
                        enemy.y+=dy/d*Math.min(speed*dt,d-170);
                        enemy.visualAngle=Math.atan2(dy,dx);
                    }else if(target.hp>0){
                        enemy.strikeTimer-=dt;
                        if(enemy.strikeTimer<=0){
                            enemy.strikeTimer=4.4;
                            const turret=target.turrets.find(v=>(v.integrity??100)>0);
                            if(target.defense.active>0 && target.defense.reserve>0){
                                target.defense.reserve=Math.max(0,target.defense.reserve-38);
                                g.createFloatingText?.('СТАЗИС ОТРАЗИЛ УДАР',
                                    target.x,target.y-95,'#97dfff');
                            }else if(turret){
                                turret.integrity=Math.max(0,(turret.integrity??100)-34);
                                if(turret.integrity<=0){
                                    turret.disabled=true;
                                    g.createFloatingText?.('ТУРЕЛЬ ВЫВЕДЕНА ИЗ СТРОЯ',
                                        target.x,target.y-110,'#ff8d81');
                                }
                                g.createFloatingText?.('ТУРЕЛЬ −34',target.x,
                                    target.y-80,'#ffb69a');
                            }else{
                                f.coreHp=Math.max(0,f.coreHp-24);
                                f.lastCoreHitAt=g.gameTime;
                                g.createFloatingText?.('ЩИТ МАЯКА −24',at.x,at.y-105,'#ff8d81');
                            }
                            g.friendlyBases?.bombTraces?.push({
                                x:enemy.x,y:enemy.y,x2:target.x,y2:target.y,
                                ttl:.54,life:.54});
                            g.worldVfx?.hit(target.x,target.y,true,true);
                        }
                    }
                };
            }
            game.enemies.push(enemy);
        }
        const names=['','Разведка боем','Прорыв обороны','Финальная атака'];
        this._announce(game,'ШТУРМ '+wave+'/3 · '+names[wave]+'. '+
            'Бомбардировщики атакуют турели. Пробел — ремонт, Q — стазис.');
        game.worldVfx?.bossPortal(at.x+380,at.y-320,35);
    }
    _updateFirstMission(game,dt,hpMult,dmgMult){
        const f=this.first,t=game.gameTime,player=game.player;
        const dock=this.getBase(game,0);
        if(!dock?.activated)return;
        if(f.beacons<3 && t>=f.ambientAt){
            f.ambientAt=t+(f.beacons?13:7);
            const ambient=game.enemies.filter(e=>!e.boss).length;
            if(ambient<16){
                const pool=f.beacons===0?['bat','zombie']:
                    f.beacons===1?['bat','stalker','zombie']:
                    ['stalker','wolf','zombie'];
                for(let i=0;i<(f.beacons?3:2);i++)
                    game._spawnOne(pool,clamp(hpMult*.74,.65,1.25),
                        clamp(dmgMult*.7,.6,1.15));
            }
        }
        if(f.beacons===1 && f.alpha<2){
            const beacon=this.props.find(p=>p.id==='beacon-1');
            const alive=game.enemies.some(e=>e.missionBeaconWave==='alpha'&&e.hp>0);
            // Clear the active wave, catch a breath, then start another fight.
            // No scripted attack begins where the pilot cannot see it.
            if(alive)f.nextWave=Math.max(f.nextWave,t+5);
            else if(t>=f.nextWave && beacon && center(player,beacon)<960){
                const count=f.alpha+1;
                if(this._spawnBeaconWave(game,'alpha',count,hpMult,dmgMult)>0){
                    f.alpha=count;f.nextWave=t+8;
                }else f.nextWave=t+3;
            }
        }else if(f.beacons===2 && f.beta<2){
            const beacon=this.props.find(p=>p.id==='beacon-2');
            const alive=game.enemies.some(e=>e.missionBeaconWave==='beta'&&e.hp>0);
            if(alive)f.nextWave=Math.max(f.nextWave,t+5);
            else if(t>=f.nextWave && beacon && center(player,beacon)<960){
                const count=f.beta+1;
                if(this._spawnBeaconWave(game,'beta',count,hpMult,dmgMult)>0){
                    f.beta=count;f.nextWave=t+8;
                }else f.nextWave=t+3;
            }
        }
        if(f.beacons===2 && f.betaHp<=0){
            const at=this.props.find(p=>p.id==='beacon-2');
            if(at)at.used=false;
            f.beacons=1;f.beta=0;f.betaHp=f.betaMaxHp;f.nextWave=Infinity;
            this._announce(game,'«Бета» захвачена! Уничтожьте абордажников и перезапустите маяк.');
            game.worldVfx?.nova(at.x,at.y,180,'red');
        }
        if(f.beacons!==3)return;
        const at=this.props.find(p=>p.id==='beacon-3');
        // No remote destruction while the player is out of the visible battle.
        if(Math.hypot(player.x-at.x,player.y-at.y)>900)return;
        f.siegeElapsed+=dt;
        if(f.siegeWaves<3 && f.siegeElapsed>=f.nextSiege-10 &&
            f.warnedSiegeWave!==f.siegeWaves+1){
            f.warnedSiegeWave=f.siegeWaves+1;
            this._announce(game,'ВНИМАНИЕ! Волна '+f.warnedSiegeWave+
                '/3 через 10 секунд. Бомбардировщики приближаются.');
        }
        if(f.siegeElapsed>=f.nextSiege && f.siegeWaves<3){
            const nearby=game.enemies.filter(e=>e.missionFinalRaider&&e.hp>0).length;
            if(nearby<10){
                this._spawnFinalSiege(game);
                f.nextSiege=f.siegeElapsed+Math.max(31,39-f.siegeWaves);
            }else f.nextSiege=f.siegeElapsed+9;
        }
        for(const base of game.friendlyBases.bases.slice(1)){
            if(base.activated&&base.hp<=0){
                this.failed=true;
                this._announce(game,'Бастион уничтожен. Оборонительная сеть потеряна.');
                game.gameOver();return;
            }
            if(base.missionStasis && base.defense.active<=0)base.missionStasis=null;
            const stasis=base.missionStasis;
            if(stasis?.rank>=3 && stasis.pulseAt<=t && base.defense.active>0){
                stasis.pulseAt=t+1.15;
                game.worldVfx?.nova(base.x,base.y,135,'cyan');
                for(const enemy of game.enemies){
                    if(enemy.hp>0&&center(enemy,base)<230){
                        enemy.hp-=enemy.boss?8:23;
                        enemy.slowTimer=Math.max(enemy.slowTimer||0,1.4);
                    }
                }
            }
        }
        const powered=game.friendlyBases.bases.slice(1).filter(base=>
            base.activated&&base.hp>0&&base.turrets.some(turret=>
                (turret.integrity??100)>0&&!turret.disabled)).length;
        if(powered>=2 && t-f.lastCoreHitAt>=8)
            f.coreHp=Math.min(f.maxCoreHp,f.coreHp+(powered-1)*1.25*dt);
        if(f.coreHp<=0){
            this.failed=true;
            this._announce(game,'Щит «Гаммы» разрушен. Противник захватил маяк.');
            game.gameOver();return;
        }
        if(!this.bossStarted && f.siegeWaves>=3 && f.siegeElapsed>=125){
            this._boss(game,{...BOSSES.HUNTER,id:'mission_guardian',
                name:'Корвет «Страж верфи»',hp:1350,speed:100},hpMult*.85,dmgMult*.84);
            this._announce(game,'ФИНАЛ · корвет «Страж верфи» вошёл в сектор! Защищайте маяк.');
        }
    }
    /**
     * All pilots can repair nearby stations. The Engineering skill upgrades
     * basic repair into a cheaper, faster, longer-range green beam.
     */
    useRepairBeam(game){
        if(this.index!==1 || game.state!==GameState.PLAYING)return false;
        const enhanced=(game.player.fieldSkills?.field_repair||0)>=1;
        const f=this.first,t=game.gameTime;
        if(t<f.repairCooldown)return false;
        const range=enhanced?195:145;
        const base=game.friendlyBases.bases.filter(b=>b.activated&&b.hp>0&&
            center(b,game.player)<range).sort((a,b)=>
                center(a,game.player)-center(b,game.player))[0];
        if(!base){
            this._announce(game,'Подлетите ближе к работающей станции для ремонта.');
            return false;
        }
        const turret=base.turrets.find(v=>(v.integrity??100)<100);
        if(!turret && base.hp>=base.maxHp-1){
            this._announce(game,'Поблизости нет повреждённых систем.');return false;
        }
        const price=enhanced?10:18;
        if(game.friendlyBases.credits<price){
            this._announce(game,'Для ремонта нужно '+price+' деталей. Разрушайте астероиды.');
            return false;
        }
        game.friendlyBases.credits-=price;
        if(turret){
            turret.integrity=Math.min(100,(turret.integrity??100)+(enhanced?50:30));
            if(turret.integrity>0)turret.disabled=false;
        }else base.hp=Math.min(base.maxHp,base.hp+(enhanced?45:28));
        f.repairCooldown=t+(enhanced?13:20);
        game.beams.push({x:game.player.x,y:game.player.y,x2:base.x,y2:base.y,
            color:enhanced?'#5fff90':'#8ce1dc',coreColor:'#e0ffed',
            ttl:enhanced?.65:.35,total:enhanced?.65:.35});
        game.worldVfx?.boostCollect(base.x,base.y,'green');
        game.createFloatingText?.(turret?'ТУРЕЛЬ ВОССТАНОВЛЕНА':'КОРПУС ВОССТАНОВЛЕН',
            base.x,base.y-100,'#91ffb9');
        return true;
    }
    /** Manual station stasis: rank I stops guns; rank II allows fire;
     * rank III adds periodic electrical counterfire. */
    useStationStasis(game){
        if(this.index!==1 || game.state!==GameState.PLAYING)return false;
        const rank=game.player.fieldSkills?.station_stasis||0;
        if(rank<1){this._announce(game,'Стазис открывается в ветке «Технологии».');return false;}
        const f=this.first,t=game.gameTime;
        if(t<f.stasisCooldown)return false;
        const base=game.friendlyBases.bases.filter(b=>b.activated&&b.hp>0&&
            center(b,game.player)<235).sort((a,b)=>
                center(a,game.player)-center(b,game.player))[0];
        if(!base){this._announce(game,'Для стазиса подлетите к действующей базе.');return false;}
        const duration=4.5+rank*.85;
        base.defense.active=duration;
        base.defense.reserve=Math.max(base.defense.reserve,150+rank*85);
        base.defense.cooldown=Math.max(base.defense.cooldown,42);
        base.missionStasis={rank,pulseAt:t+.6};
        f.stasisCooldown=t+42;
        game.worldVfx?.nova(base.x,base.y,215,rank>=3?'violet':'cyan');
        this._announce(game,rank===1?
            'Стазис I включён: станция защищена, но турели временно отключены.':
            rank===2?'Стазис II: турели продолжают огонь под щитом.':
            'Стазис III: турели работают, поле поражает ближайших врагов.');
        return true;
    }
    _detonateRocks(game){
        for(const rock of game.worldObstacles){
            if(!rock.missionVolatile || !rock.destroyed || rock.detonated)continue;
            rock.detonated=true;
            this.blastsTriggered++;
            const radius=165;
            game.worldVfx?.nova(rock.x,rock.y,radius,'orange');
            game.createParticles?.(rock.x,rock.y,'#ffd184',22);
            game.createFloatingText?.('РЕАКТОРНЫЙ ВЗРЫВ',rock.x,rock.y-65,'#ffcf85');
            for(const enemy of game.enemies){
                if(enemy.hp<=0)continue;
                const d=Math.hypot(enemy.x-rock.x,enemy.y-rock.y);
                if(d>radius+(enemy.size||0))continue;
                enemy.hp-=Math.max(32,Math.round(110*(1-d/(radius+(enemy.size||0)))));
            }
            // Chained asteroid destruction opens tactical shortcuts in the
            // actual obstacle field; the native renderer handles broken rocks.
            damageWorldObstacles(game,rock.x,rock.y,radius,72,new Set(),true);
            if(this.blastsTriggered===1)this._announce(game,
                'Нестабильные реакторные обломки можно взрывать, чтобы расчищать путь и уничтожать врагов.');
        }
    }
    update(game,dt,hpMult,dmgMult){
        if(this.victory||this.failed)return;
        const t=game.gameTime;
        if(!this.introShown&&t>=1.5){
            this.introShown=true;
            this.log?.open('ОПЕРАЦИЯ · '+this.scene.name,this._briefing());
        }
        this._detonateRocks(game);
        if(this.index===2&&!this.sealBriefed&&this.sealRemaining(game)<=4){
            this.sealBriefed=true;
            this.log?.note('ПРОЛИВ ОТКРЫТ · НОВЫЙ МАРШРУТ',
                'Три силовых сердечника разрушены. Открылся проход к дальнему арсеналу «Прометей». Там хранится оборудование для самоходной буровой. Восстановите арсенал, затем найдите буровую.',
                'Доберитесь до арсенала и включите его реактор.',true);
        }
        this._updateEnemySite(game,dt);
        if(this.index===2){this._updateQuarry(game,dt);if(this.failed)return;}
        if(this.index===3)this._updateNetwork(game);
        if(this.index===1){this._updateFirstMission(game,dt,hpMult,dmgMult);if(this.failed)return;}
        if(this.index===4){
            this._updateConvoy(game,dt);if(this.failed)return;
            this._updateConvoyAmbush(game,dt);
        }
        // Scripted wave pressure is independent of the endless-mode director.
        this.spawnClock-=dt;
        if(this.index!==1&&t>12&&this.spawnClock<=0){
            const cap=[0,22,30,38,42][this.index];
            let alive=0;
            for(const enemy of game.enemies)if(!enemy.boss && enemy.hp>0)alive++;
            if(alive<cap){
                const pool=missionAmbientPool(this.index,game.player?.level||1);
                const count=t>300?2:1;
                for(let i=0;i<count&&game.enemies.length<cap;i++)
                    game._spawnOne(pool,clamp(hpMult*.8,.7,2),clamp(dmgMult*.82,.65,1.7));
            }
            this.spawnClock=Math.max(2.9,7.4-t/125-(this.index-1)*.6);
        }
        if(this.index===2 && !this.bossStarted && this.quarry.overload &&
            t>=this.quarry.overloadAt+10){
            this._boss(game,{...BOSSES.HUNTER,id:'mission_crusher',
                name:'Броненосец «Дробильщик»',hp:1500,speed:79,
                size:58,ability:'charge',color:'#c98e55'},hpMult*.9,dmgMult*.9);
            this.log?.note('ПРЕСЛЕДОВАНИЕ · «ДРОБИЛЬЩИК»',
                'Тяжёлый броненосец вылетел из аварийной шахты и преследует ваш корабль. Ориентир — аварийный шлюз на востоке. Используйте большие скалы как укрытие, уклоняйтесь от реакторных выбросов и уничтожьте преследователя.',
                'Пробейтесь к шлюзу и уничтожьте «Дробильщика».',true);
        }
        if(this.index===4&&!this.bossStarted&&this.exitOnline&&
            this.trap?.cleared&&this.convoy?.leg===3&&
            Number.isFinite(this.evacuation?.bossCueAt)&&t>=this.evacuation.bossCueAt){
            this._boss(game,{...BOSSES.HUNTER,id:'mission_corsair',
                name:'Флагман перехвата «Корсар»',hp:1700,size:60,
                speed:80,color:'#a784ef'},hpMult*.92,dmgMult*.83);
            this._announce(game,'ФЛАГМАН «КОРСАР» ВОШЁЛ В СЕКТОР! ' +
                'Отвлеките его от каравана и уничтожьте.');
        }
        if(this.index===3){
            // Long distances demand recoverable stations. The native raid
            // director only attacks near a pilot, with an explicit warning.
            if(this.network.defenseReady && this.defenses<2 &&
                !game.friendlyBases.raid && this.allBasesActive(game) &&
                !Number.isFinite(game.friendlyBases.nextRaidAt))
                game.friendlyBases.nextRaidAt=t+18;
        }
        if(this.index===4){
            const clear=this.trap?.cleared&&this.exitOnline&&this.convoy?.leg===3&&
                this.convoy.hp>0&&this.allBasesActive(game)&&this.bossStarted&&
                this.boss&&!game.enemies.includes(this.boss);
            if(clear && !Number.isFinite(this.evacuation.rescueAt)){
                this.evacuation.rescueAt=t+12;
                this._announce(game,'«КОРСАР» УНИЧТОЖЕН. Спасательный корабль стыкуется. '+
                    'Продержитесь ещё 12 секунд, сохранив транспорт и реле.');
            }else if(!clear)this.evacuation.rescueAt=null;
        }
        const ready=this.index===4?
            Number.isFinite(this.evacuation.rescueAt)&&
                t>=this.evacuation.rescueAt&&this.convoy.hp>0&&this.allBasesActive(game):
            this.index===1?
            this.first.beacons===3&&this.first.coreHp>0&&this.allBasesActive(game)&&
                this.bossStarted&&this.boss&&!game.enemies.includes(this.boss)&&
                this.first.siegeWaves>=3&&
                !game.enemies.some(e=>e.missionFinalRaider&&e.hp>0):
            this.index===2?
                this.exitOnline&&this.quarry.completed&&this.quarry.overload&&
                this.allBasesActive(game)&&this.bossStarted&&this.boss&&!game.enemies.includes(this.boss):
                this.jammerOffline&&this.allBasesActive(game)&&this.network.defenseReady&&
                this.network.decoyCleared&&!this.enemySiteAlive(game)&&this.defenses>=2;
        if(ready){this._victory(game);return;}
        this._updateHud(game);
    }
    _boss(game,definition,hpMult,dmgMult){
        this.bossStarted=true;
        game._spawnBoss(definition,hpMult,dmgMult);
        this.boss=game.enemies[game.enemies.length-1];
    }
    onRaidEnded(game,won){
        if(this.index!==3||!this.network?.defenseReady||this.victory)return;
        if(won){
            this.defenses++;
            this._announce(game,'Бомбардировщики уничтожены! Отражено '+this.defenses+'/2 атак.');
            if(this.defenses===1)this.log?.note('ПЕРВЫЙ НАЛЁТ ОТБИТ',
                'Эскадрилья уничтожена. Противник собирает второй удар по сети. Можно укрепить нынешний узел или перелететь к другому действующему ретранслятору: следующий налёт начнётся возле вас.',
                'Защитите сеть от последней эскадрильи.',true);
        }else this._announce(game,'Сеть под ударом. Проверьте повреждённый реактор!');
        if(this.defenses<2)
            game.friendlyBases.nextRaidAt=this.allBasesActive(game)?
                game.gameTime+(won?36:29):Infinity;
        else game.friendlyBases.nextRaidAt=Infinity;
    }
    _victory(game){
        const result=game.completeMission(game.gameTime);
        if(!result.ok)return;
        this.victory=true;game.state=GameState.MENU;
        game.audio.stopMusic();
        document.getElementById('missionObjectiveHud')?.style.setProperty('display','none');
        document.getElementById('missionAction')?.style.setProperty('display','none');
        document.getElementById('missionRepairAbility')?.style.setProperty('display','none');
        document.getElementById('missionStasisAbility')?.style.setProperty('display','none');
        showMissionVictory(game,this,result);
    }
    _updateHud(game){
        const hud=document.getElementById('missionObjectiveHud');
        const button=document.getElementById('missionAction');
        if(!hud||!button)return;
        const mobileControls = window.matchMedia?.('(any-pointer: coarse)').matches;
        const message=this.objective(game);
        const dest=this.target(game);
        let bearing='';
        if(dest){
            const dx=dest.x-game.player.x,dy=dest.y-game.player.y;
            const a=Math.atan2(-dy,dx);
            const arrows=['→','↗','↑','↖','←','↙','↓','↘'];
            bearing=' · '+arrows[(Math.round(a/(Math.PI/4))+8)%8]+
                ' '+Math.round(Math.hypot(dx,dy))+' м';
        }
        let hudText=this.scene.name+'  |  '+message+bearing;
        if(this.index===4&&this.convoy){
            const c=this.convoy;
            hudText+=' · Караван '+Math.round(Math.max(0,c.hp)/c.maxHp*100)+'%';
        }
        if(this.index===1 && this.first){
            const f=this.first;
            hudText+=' · Маяки '+f.beacons+'/3';
            if(f.beacons===3)hudText+=' · Щит '+Math.ceil(f.coreHp/f.maxCoreHp*100)+'%';
        }
        if(this.index===3 && this.jammerOffline){
            const bs=game.friendlyBases.bases;
            const pct=Math.round(100*bs.reduce((n,b)=>n+Math.max(0,b.hp),0)/
                Math.max(1,bs.reduce((n,b)=>n+b.maxHp,0)));
            hudText+=' · Сеть '+pct+'%';
        }
        // DOM writes on every animation frame caused needless layout work.
        // A timer or objective change is the only reason to update the HUD.
        if(hud.textContent!==hudText)hud.textContent=hudText;
        hud.style.display='block';
        const interactive=this.canInteract(game);
        const blocked=interactive?null:this.blockedInteraction(game);
        button.style.display=(interactive||blocked)?'block':'none';
        button.disabled=!interactive;
        if(interactive){
            const label=interactive.type==='cache'?'СОБРАТЬ ДЕТАЛИ':
                interactive.type==='beacon'?'ВКЛЮЧИТЬ '+interactive.name.replace('Маяк ',''):
                interactive.type==='repair'?'РЕМОНТ · 18 ⚙':
                interactive.type==='reboot'?'ПЕРЕЗАПУСК РЕАКТОРА':
                interactive.type==='rig'?'ЗАПУСТИТЬ БУРОВУЮ':
                interactive.type==='route-choice'?(interactive.route==='direct'?
                    'ВЫБРАТЬ БЫСТРЫЙ ПРОХОД':'ВЫБРАТЬ МАРШРУТ ЧЕРЕЗ УКРЫТИЯ'):
                interactive.type==='relay-overcharge'?'УСКОРИТЬ ЗАРЯДКУ · 20 ⚙':
                interactive.type==='decoy'?'ПРОВЕРИТЬ СИГНАЛ':
                interactive.type==='rig-repair'?'РЕМОНТ БУРОВОЙ · 14 ⚙':
                interactive.type==='convoy-repair'?'РЕМОНТ КАРАВАНА · 24 ⚙':
                interactive.type==='gate'?(this.index===2?'ОТКРЫТЬ ШЛЮЗ':'ОТКРЫТЬ ВРАТА'):
                interactive.type==='station-panel'?(interactive.activated?
                    'ПАНЕЛЬ СТАНЦИИ':'ПОДКЛЮЧИТЬ СТАНЦИЮ'):
                'ОТКЛЮЧИТЬ ПОМЕХИ';
            button.textContent='✦ '+label+(mobileControls?'':' · E');
            const explanation=interactive.type==='cache'?'Получить 28 деталей и 42 опыта.':
                interactive.type==='beacon'?'Запустить маяк и привлечь очередную волну противника.':
                interactive.type==='rig'?'Буровая двинется к развилке. После остановки выберите один из двух маршрутов.':
                interactive.type==='route-choice'?(interactive.route==='direct'?
                    'Короткий проход. Более частые атаки и засада у рудного хребта.':
                    'Длинный безопасный обход. Реже атаки, ремонтный дрон на стоянке.'):
                interactive.type==='relay-overcharge'?'Потратить 20 деталей, сократить зарядку на 25 секунд и ускорить прибытие перехватчиков.':
                interactive.type==='decoy'?'Проверить сигнал. Источник может оказаться опасным.':
                interactive.type==='gate'?'Открыть путь к завершению операции.':
                interactive.type==='station-panel'?(interactive.activated?
                    'Открыть панель станции и установить оборудование.':
                    'Открыть панель, включить станцию и подготовить её оборону.'):
                interactive.type.includes('repair')?'Восстановить повреждённую технику за детали.':
                'Выполнить действие с оборудованием.';
            button.title=(interactive.name||label)+' — '+explanation;
            button.setAttribute('aria-label',button.title);
            if(interactive.type==='relay-overcharge'&&game.friendlyBases.credits<20){
                button.disabled=true;
                button.textContent='🔒 УСКОРЕНИЕ · НУЖНО 20 ДЕТАЛЕЙ';
                button.title='Соберите ещё детали, чтобы ускорить зарядку реле.';
                button.setAttribute('aria-label',button.title);
            }
        }else if(blocked){
            button.textContent=(blocked.locked?'🔒 ':'⌖ ')+blocked.reason;
            button.title=blocked.name+' — '+blocked.reason.toLowerCase()+'.';
            button.setAttribute('aria-label',button.title);
        }
        const repair=document.getElementById('missionRepairAbility');
        const stasis=document.getElementById('missionStasisAbility');
        if(repair){
            const unlocked=this.index===1;
            const enhanced=game.player?.fieldSkills?.field_repair>0;
            repair.style.display=unlocked?'block':'none';
            const left=Math.ceil(Math.max(0,(this.first?.repairCooldown||0)-game.gameTime));
            repair.textContent=left?'🔧 РЕМОНТ · '+left+'с':
                (enhanced?'💚 РЕМОНТНЫЙ ЛУЧ':'🔧 ПОЛЕВОЙ РЕМОНТ')+
                (mobileControls?'':' · ПРОБЕЛ');
            repair.disabled=!!left;
        }
        if(stasis){
            const rank=this.index===1?(game.player?.fieldSkills?.station_stasis||0):0;
            stasis.style.display=rank?'block':'none';
            const left=Math.ceil(Math.max(0,(this.first?.stasisCooldown||0)-game.gameTime));
            stasis.textContent=left?'🛡 СТАЗИС · '+left+'с':
                '🛡 СТАЗИС '+rank+(mobileControls?'':' · Q');
            stasis.disabled=!!left;
        }
    }
    drawBack(ctx,game){drawMissionBackdrop(ctx,game,this);}
    drawFront(ctx,game){drawMissionForeground(ctx,game,this);}
}

export function showCampaignPicker(game){
    const panel=document.getElementById('campaignPickerScreen');
    if(!panel)return;
    const list=panel.querySelector('.campaign-missions');
    list.replaceChildren();
    panel.querySelector('.prologue-in-campaign')?.style.setProperty('display','none');
    const progress=readCampaign(game.save);
    for(const profile of MISSION_PROFILES){
        const available=hasDesignedMission(profile.index) && isMissionUnlocked(game.save,profile.index);
        const done=progress.completed.includes(profile.index);
        const btn=document.createElement('button');
        btn.type='button';btn.className='campaign-mission'+(done?' completed':'');
        btn.disabled=!available;
        btn.textContent=String(profile.index).padStart(2,'0')+' · '+profile.name+
            '  '+(done?'✓ ПРОЙДЕНО':available?'▶ ИГРАТЬ':'ЗАКРЫТО');
        // Items 5–10 are deliberately labelled as work-in-progress,
        // not deceptively presented as playable infinite expeditions.
        if(profile.index>4)btn.textContent=
            String(profile.index).padStart(2,'0')+' · '+profile.name+' · В РАЗРАБОТКЕ';
        else if(!available)btn.textContent=
            String(profile.index).padStart(2,'0')+' · '+profile.name+' · ЗАКРЫТО';
        const desc=document.createElement('small');
        desc.textContent=profile.minutesMin+'–'+profile.minutesMax+
            ' мин · допуск '+profile.rankCap;
        btn.appendChild(desc);
        if(available)btn.addEventListener('click',()=>{
            panel.style.display='none';game.audio.unlock();game.startMission(profile.index);
        });
        list.appendChild(btn);
    }
    game.ui.hideStart();panel.style.display='flex';
}
export function installMissionUI(game){
    // Both original prologue links now launch mission 00 inside the shared game.
    for(const a of (document.querySelectorAll?.('a[href="./prologue/"]')||[])){
        a.addEventListener('click',event=>{
            event.preventDefault();
            document.getElementById('campaignPickerScreen')?.style.setProperty('display','none');
            game.audio.unlock();game.startMission(0);
        });
    }
    document.getElementById('btnCampaign')?.addEventListener('click',()=>showCampaignPicker(game));
    document.getElementById('missionAction')?.addEventListener('click',()=>game.missionWorld?.interact(game));
    // Mission 00 needs a genuine held beam, including touch. Other missions
    // retain their existing tap-to-repair ability.
    const repairButton=document.getElementById('missionRepairAbility');
    if(repairButton){
        repairButton.style.touchAction='none';
        let repairPointer=null;
        repairButton.addEventListener('pointerdown',(event)=>{
            if(game.missionWorld?.index!==0)return;
            event.preventDefault();
            if(repairPointer!==null)return;
            if(game.missionWorld.beginRepairBeam(game)){
                repairPointer=event.pointerId;
                repairButton.setPointerCapture?.(event.pointerId);
            }
        });
        const release=(event)=>{
            // A joystick finger may release while another finger holds repair.
            // Only the pointer that started repair is allowed to end it.
            if(repairPointer===null)return;
            if(event?.pointerId!==undefined&&event.pointerId!==repairPointer)return;
            repairPointer=null;game.missionWorld?.endRepairBeam?.();
        };
        repairButton.addEventListener('pointerup',release);
        repairButton.addEventListener('pointercancel',release);
        window.addEventListener('pointerup',release);
        window.addEventListener('pointercancel',release);
        window.addEventListener('blur',release);
        repairButton.addEventListener('click',()=>{
            if(game.missionWorld?.index!==0)game.missionWorld?.useRepairBeam(game);
        });
    }
    document.getElementById('missionStasisAbility')?.addEventListener('click',()=>
        game.missionWorld?.useStationStasis(game));
    document.getElementById('campaignBack')?.addEventListener('click',()=>{
        document.getElementById('campaignPickerScreen').style.display='none';
        game.ui.showStart();
    });
}
export function showMissionVictory(game,world,result){
    const panel=document.getElementById('missionVictoryScreen');
    if(!panel)return;
    panel.querySelector('.victory-title').textContent='МИССИЯ ВЫПОЛНЕНА · '+world.scene.name;
    panel.querySelector('.victory-info').textContent=
        'Время '+clock(game.gameTime)+' · Уничтожено врагов: '+game.kills+
        ' · '+(result.firstClear?'Первое прохождение!':'Рекорд можно улучшить.');
    panel.querySelector('.victory-reward').textContent=result.blueprints.length?
        'Постоянное открытие: '+result.blueprints.join(', '):
        'Прогресс сохранён на галактической карте.';
    if(world.index===0)panel.querySelector('.victory-reward').textContent=
        'Маршрут передан конвою. Ядро: '+Math.ceil(world.coreHp)+'/200 · Архивы: '+world.logsCollected+'/5 · Подготовка: '+['helios','coolant','capacitor'].filter(id=>world.done(id)).length+'/3. Следующий вылет — «Первая искра».';
    if(result.certificates?.length)panel.querySelector('.victory-reward').textContent+=
        ' · Сертификаты: '+result.certificates.map(c=>c.title).join(', ');
    const next=panel.querySelector('.victory-next');
    next.style.display=world.index<4?'inline-flex':'none';
    next.onclick=()=>{
        panel.style.display='none';game.startMission(world.index+1);
    };
    panel.querySelector('.victory-menu').onclick=()=>{
        panel.style.display='none';game.ui.showStart();game.state=GameState.MENU;
    };
    panel.style.display='flex';
}

