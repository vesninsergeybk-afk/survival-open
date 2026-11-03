/**
 * Friendly stations, per-run salvage currency, directed defense turrets and
 * independently maneuvering escort craft. No persistent power creep.
 * All positions use arena coordinates; no external assets or dependencies.
 */
import { CONFIG } from './config.js?v=base-87';
import { BASE_PATHS, baseDevelopmentCap, baseDevelopmentPrice } from './base-development.js?v=progression-1';
import { Enemy, Projectile } from './entities.js?v=design-127';
import { ENEMIES } from './data.js?v=base-87';
import { drawStationPart, STATION_PARTS } from './station-art.js?v=base-86';
import { drawCombatImpact } from './ship-art-v2.js?v=base-86';
import { turnTurretTowards, turretMuzzle } from './turret-motion.js?v=turret-1';
import { drawTurretMount, drawTurretHead } from './turret-visuals.js?v=turret-visuals-1';
import { resonanceQuote, resonanceLinks as buildResonanceLinks } from './base-resonance.js?v=resonance-90';
import { drawStationMechanisms } from './station-mechanics.js?v=visual-95';

const TAU = Math.PI * 2;
const TYPES = Object.freeze({
    dock:    { icon:'⚙️', name:'Ремонтный док', color:'#70e4ff',
        repair:.1, maxTurrets:3, escorts:true, fleet:false, hangarMax:1, defenseMax:2, responses:['cryo'], shipShop:false, sprite:'dock' },
    carrier: { icon:'🛸', name:'Космический авианосец', color:'#a9a4ff',
        repair:.08, maxTurrets:2, escorts:true, fleet:true, hangarMax:6, defenseMax:2, responses:['pulse'], shipShop:false, sprite:'carrier' },
    arsenal: { icon:'🛡️', name:'Военный арсенал', color:'#ffca84',
        repair:.05, maxTurrets:4, escorts:true, fleet:false, hangarMax:1, defenseMax:2, responses:['pulse'], shipShop:true, sprite:'arsenal' },
    lab:     { icon:'🔬', name:'Исследовательская станция', color:'#be9aff',
        repair:.05, maxTurrets:3, escorts:true, fleet:false, hangarMax:1, defenseMax:3, responses:['cryo','pulse'], shipShop:true, sprite:'lab' },
    outpost: { icon:'📡', name:'Малый аванпост', color:'#8af6e8',
        repair:.05, maxTurrets:8, escorts:true, fleet:false, hangarMax:1, defenseMax:3, responses:['pulse'], shipShop:false, sprite:'outpost' }
});
const TURRET_PATHS = Object.freeze({
    arc:{ name:'Электродуга', icon:'⚡', color:'#7df9ed', art:STATION_PARTS.arc },
    missile:{ name:'Ракетная батарея', icon:'🚀', color:'#ffbb7b', art:STATION_PARTS.missile },
    rail:{ name:'Рельсотрон', icon:'🎯', color:'#aed1ff', art:STATION_PARTS.rail }
});
const SHIP_SHOPS = Object.freeze({
    damage:{name:'Усилитель вооружения',icon:'⚔️',max:3},
    range:{name:'Дальнобойная оптика',icon:'🔭',max:3},
    fireRate:{name:'Контроль охлаждения',icon:'❄️',max:3}
});
const ESCORT_SHOPS = Object.freeze({
    hull:{name:'Броня ведомых',icon:'🛡️',max:3},
    engine:{name:'Двигатели ведомых',icon:'🔥',max:3},
    gun:{name:'Оружие ведомых',icon:'🔫',max:3}
});
const ESCORT_DEF = Object.freeze({
    id:'escort_pulse', baseRange:310, speed:490, piercing:false
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const mountAngle = (m) => (m - 2) * Math.PI / 4;
function hash(x, y, seed) {
    let v = Math.imul(x + 17, 374761393) ^ Math.imul(y + 41, 668265263) ^ seed;
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}
function safePosition(x, y, obstacles) {
    return !obstacles.some(o => !o.destroyed &&
        Math.hypot(x - o.x, y - o.y) < (o.radius || 20) + 88);
}
function station(id, x, y, type) {
    return {
        id, x, y, type, hp:180, maxHp:180, discovered:false, scanned:false, visited:false, activated:false, activationTime:0,
        anchorX:x,anchorY:y,vx:0,vy:0,mass:type==='carrier'?30000:
            type==='outpost'?14000:20000,
        turrets:[], sockets:1, hangarCapacity:1, hangarTier:0,
        escortUpgrades:{hull:0,engine:0,gun:0}, turretBeam:null,
        development:{defense:0,research:0,logistics:0},
        defense:{level:0,mode:null,active:0,cooldown:0,reserve:0,
            recent:0,recentTime:0,visual:0}
    };
}

export class FriendlyBases {
    constructor() {
        this.enabled = false;
        this.bases = [];
        this.allies = [];
        this.credits = 0;
        this.activationCount = 0;
        this.technologyTier = 0;
        this.missionRankCap = 5;
        this.freeDevelopmentUsed = false;
        this.resonanceBlueprints = new Set();
        this.navigationTargetId = null;
        this.nextAllyId = 1;
        this.shipUpgrades={damage:0,range:0,fireRate:0};
        this.raid=null;
        this.raidSerial=0;
        this.raidWave=0;
        this.nextRaidAt=385;
        this.bombTraces=[];
    }

    reset(game, enabled = true) {
        this.enabled = !!enabled;
        this.bases = [];
        this.allies = [];
        this.credits = 0;
        this.activationCount = 0;
        this.technologyTier = 0;
        this.missionRankCap = Math.max(2,Math.min(5,game?.activeMission?.rankCap || 5));
        this.freeDevelopmentUsed = false;
        this.resonanceBlueprints = new Set();
        this.navigationTargetId = null;
        this.nextAllyId = 1;
        this.shipUpgrades={damage:0,range:0,fireRate:0};
        this.raid=null;
        this.raidSerial=0;
        this.raidWave=0;
        this.nextRaidAt=385;
        this.bombTraces=[];
        if (!this.enabled || !game?.player) return;
        const cx = game.player.x, cy = game.player.y;
        const obstacles = game.worldObstacles || [];
        const origins = [
            [-350,-150], [365,-130], [-330,195], [320,205],
            [95,-290], [-110,295]
        ];
        const first = origins.find(([dx,dy]) =>
            safePosition(cx+dx,cy+dy,obstacles)) || [-350,-150];
        this.bases.push(station('home', cx+first[0],cy+first[1],'dock'));
        const seed = Array.from(game.stageId || 'forest').reduce((s,c) =>
            Math.imul(s, 31) + c.charCodeAt(0) | 0, 8191);
        const gap = 1180;
        for(let gy=1; gy<Math.ceil(CONFIG.ARENA_HEIGHT/gap); gy++) {
            for(let gx=1; gx<Math.ceil(CONFIG.ARENA_WIDTH/gap); gx++) {
                const roll = hash(gx,gy,seed);
                if (roll > .48) continue;
                const x = clamp(gx*gap + (hash(gx+43,gy,seed)-.5)*470,
                    170, CONFIG.ARENA_WIDTH-170);
                const y = clamp(gy*gap + (hash(gx,gy+17,seed)-.5)*470,
                    170, CONFIG.ARENA_HEIGHT-170);
                if (Math.hypot(x-cx,y-cy)<690) continue;
                if (!safePosition(x,y,obstacles)) continue;
                const type = ['carrier','arsenal','lab','dock','outpost'][
                    Math.floor(hash(gx+7,gy+29,seed)*5)];
                this.bases.push(station('station-'+gx+'-'+gy,x,y,type));
            }
        }
        this.revealNearby(game, true);
    }

    revealNearby(game, silent = false) {
        if (!this.enabled) return;
        for(const base of this.bases) {
            if (base.hp<=0) continue;
            const d = distance(base, game.player);
            if (d>565) continue;
            if (!base.discovered) {
                base.discovered = true;
                if (!silent) {
                    game.createFloatingText?.('ОТКРЫТА БАЗА',base.x,base.y-78,'#82eaff');
                    game._announce?.('Обнаружена база: '+TYPES[base.type].name+
                        '. Подлетите и нажмите E, чтобы открыть док.');
                }
            }
            // Scanning reveals coordinates, but only arriving in person
            // earns exploration XP. This cannot be farmed by circling a base.
            if (!base.visited && d<=205 && !silent) {
                base.visited = true;
                game.player.gainExp(12);
                if (base.id !== 'home') this.addCredits(8,game);
                if (game.run) game.run.basesVisited=(game.run.basesVisited||0)+1;
                game.createFloatingText?.('РАЗВЕДКА +12 ОПЫТА',base.x,base.y-85,'#a1ffe0');
                game._announce?.('Сектор исследован: '+TYPES[base.type].name+
                    '. +12 опыта'+(base.id === 'home'?'':' и +8 кредитов')+'.');
            }
        }
    }

    nearest(game, maxRange = Infinity) {
        if(!this.enabled || !game?.player) return null;
        let nearest = null, best = maxRange;
        for(const base of this.bases) {
            if (!base.discovered || base.hp<=0) continue;
            const d = distance(base,game.player);
            if(d<best) { best=d; nearest=base; }
        }
        return nearest;
    }

    dockable(game) {
        const base=this.nearest(game,135);
        return base?.defense?.active>0?null:base;
    }

    getUpgradeCap() {
        // Permanent technology discovery: an evacuated/destroyed station
        // never confiscates improvements already earned by the pilot.
        return this.enabled ? Math.min(this.missionRankCap, 2 + this.technologyTier) : 5;
    }

    scanNearest(game) {
        if(!this.enabled||!game?.player)return false;
        const hidden=this.bases.filter(b=>!b.discovered&&b.hp>0)
            .sort((a,b)=>distance(a,game.player)-distance(b,game.player));
        const target=hidden[0];
        if(!target)return false;
        target.discovered=true;
        target.scanned=true;
        game.createFloatingText?.('📡 СИГНАЛ СТАНЦИИ',game.player.x,
            game.player.y-70,'#9fe9ff');
        game._announce?.('Сканер обнаружил '+(target.displayName||TYPES[target.type].name)+
            '. Координаты добавлены на карту.');
        return true;
    }

    /** The next objective is a dormant station, never an upgraded base. */
    expeditionTarget(game) {
        if (!this.enabled || !game?.player) return null;
        const candidates=this.bases.filter(b=>b.discovered && !b.activated && b.hp>0);
        const pinned=candidates.find(b=>b.id===this.navigationTargetId);
        return pinned || candidates.reduce((best,b) =>
            !best || distance(b,game.player)<distance(best,game.player)?b:best,null);
    }

    setNavigationTarget(id) {
        const base=this.bases.find(b=>b.id===id && b.discovered &&
            !b.activated && b.hp>0);
        if(!base)return false;
        this.navigationTargetId=base.id;
        return true;
    }

    hasActivatedType(type) {
        return this.bases.some(base=>base.activated&&base.type===type);
    }

    activeStations() {
        return this.bases.filter(base => base.activated && base.hp > 0).length;
    }

    resonanceLinks() {
        return buildResonanceLinks(this.bases);
    }

    resonanceQuote(base,item,option='') {
        return resonanceQuote(base,this.bases,this.resonanceBlueprints,
            item,option,this.basePrice(base,item,option));
    }

    price(base,item,option='') {
        return this.resonanceQuote(base,item,option).cost;
    }

    basePrice(base, item, option = '') {
        const def=TYPES[base.type];
        if (item==='activate') return this.activationCount===0?0:
            this.activationCount===1?20:this.activationCount===2?35:45;
        if (item==='baseDevelopment') {
            if(!BASE_PATHS.some(p=>p.id===option))return Infinity;
            return baseDevelopmentPrice(base.development?.[option] || 0,!this.freeDevelopmentUsed);
        }
        if (item==='repair') return def.repair>=.1?10:8;
        if (item==='turret') return base.type==='arsenal'?28:35;
        if (item==='extension') return (base.type==='outpost'?40:60) +
            Math.max(0,base.sockets-1)*(base.type==='outpost'?28:55);
        if (item==='upgradeTurret') {
            const turret=base.turrets.find(t=>t.mount===Number(option));
            return turret ? [0,52,85,132,195][turret.level] || Infinity : Infinity;
        }
        if (item==='specialize') return 85;
        if (item==='escort') return def.fleet
            ? 24 + this.allies.filter(a=>a.homeId===base.id).length*18 : 22;
        if (item==='hangar') return def.fleet ? 115 + base.hangarTier*85 : Infinity;
        if (item==='stasisUpgrade') return [80,135,205][base.defense.level] ?? Infinity;
        if (item==='stasisMode') return base.type==='lab' ? 105 : 125;
        if (item==='escortUpgrade') {
            const [branch]=String(option).split(':');
            return 40 + (base.escortUpgrades[branch] || 0)*35;
        }
        if (item==='shipUpgrade') {
            const levels=this.shipUpgrades;
            return 60 + (levels[option] || 0)*55 -
                ((base.type==='lab'&&option!=='damage')?12:0);
        }
        return Infinity;
    }

    buy(game, base, item, mount = 0, branch = '') {
        if(!this.enabled || !base || base.hp<=0 ||
            distance(base,game.player)>145) return {ok:false,message:'Подлетите к базе'};
        const def=TYPES[base.type], turret=base.turrets.find(t=>t.mount===Number(mount));
        const option=item==='upgradeTurret'?mount:
            item==='specialize'?mount+':'+branch:
            item==='shipUpgrade'||item==='escortUpgrade'||item==='stasisMode'||
                item==='baseDevelopment'?branch:'';
        const quote=this.resonanceQuote(base,item,option);
        let cost=quote.cost;
        let message='';
        if(item!=='activate'&&!base.activated)
            return {ok:false,message:'Сначала запустите реактор станции'};
        if(item==='activate') {
            if(base.activated)return {ok:false,message:'Станция уже активирована'};
        } else if(item==='baseDevelopment') {
            if(!BASE_PATHS.some(p=>p.id===branch))
                return {ok:false,message:'Неизвестная ветвь станции'};
            if((base.development?.[branch]||0)>=3)
                return {ok:false,message:'Ветвь станции уже изучена полностью'};
            if((base.development?.[branch]||0)>=baseDevelopmentCap(this.getUpgradeCap()))
                return {ok:false,message:'Нужен следующий технологический допуск'};
        } else if(item==='repair') {
            if(game.player.hp>=game.player.maxHp-.5)
                return {ok:false,message:'Корпус полностью исправен'};
        } else if(item==='turret') {
            if(turret) return {ok:false,message:'В этом секторе уже есть турель'};
            if(base.turrets.length>=base.sockets)
                return {ok:false,message:'Постройте дополнительную секцию'};
            if(base.turrets.length>=def.maxTurrets)
                return {ok:false,message:'Достигнут предел обороны этой базы'};
        } else if(item==='extension') {
            if(base.sockets>=def.maxTurrets)
                return {ok:false,message:'Новые секции больше не помещаются'};
            if(base.turrets.length<base.sockets)
                return {ok:false,message:'Сначала заполните свободное место'};
        } else if(item==='upgradeTurret') {
            if(!turret) return {ok:false,message:'Сначала выберите построенную турель'};
            if(turret.level>=5) return {ok:false,message:'Турель полностью улучшена'};
            if(turret.level===2&&!turret.path)
                return {ok:false,message:'Выберите специализацию турели'};
        } else if(item==='specialize') {
            if(!turret || turret.level!==2 || turret.path)
                return {ok:false,message:'Для специализации нужен второй уровень турели'};
            if(!TURRET_PATHS[branch]) return {ok:false,message:'Неизвестная специализация'};
        } else if(item==='escort') {
            if(!def.escorts) return {ok:false,message:'На этой базе нет боевого ангара'};
            if(this.allies.filter(a=>a.homeId===base.id).length>=base.hangarCapacity)
                return {ok:false,message:'Ангар заполнен; расширьте его'};
            if(this.allies.length>=12)
                return {ok:false,message:'Достигнут предел эскадры'};
        } else if(item==='hangar') {
            if(!def.fleet || base.hangarCapacity>=def.hangarMax)
                return {ok:false,message:'Этот ангар нельзя расширить'};
        } else if(item==='escortUpgrade') {
            if(!def.fleet || !ESCORT_SHOPS[branch])
                return {ok:false,message:'Требуется база-авианосец'};
            if(base.escortUpgrades[branch]>=3)
                return {ok:false,message:'Это улучшение уже на максимуме'};
        } else if(item==='stasisUpgrade') {
            if(base.defense.level>=def.defenseMax)
                return {ok:false,message:'Защитная система достигла предела'};
        } else if(item==='stasisMode') {
            if(base.defense.level<1 || base.defense.mode || !def.responses.includes(branch))
                return {ok:false,message:'Эта станция не поддерживает выбранную защиту'};
        } else if(item==='shipUpgrade') {
            if(!def.shipShop || !SHIP_SHOPS[branch] ||
                (base.type==='arsenal'&&branch==='range') ||
                (base.type==='lab'&&branch==='damage'))
                return {ok:false,message:'На базе нет мастерской вооружения'};
            if(this.shipUpgrades[branch]>=3)
                return {ok:false,message:'Улучшение корабля достигло максимума'};
        } else return {ok:false,message:'Неизвестная покупка'};
        if(!Number.isFinite(cost) || this.credits<cost)
            return {ok:false,message:'Недостаточно кредитов: нужно '+cost};
        this.credits-=cost;
        if(item==='baseDevelopment' && cost===0)this.freeDevelopmentUsed=true;
        if(item==='activate') {
            base.activated=true;
            base.activationTime=game.gameTime||0;
            this.activationCount++;
            if(this.navigationTargetId===base.id)this.navigationTargetId=null;
            // Expedition milestones fund the next leg, rather than rewarding
            // players for camping by an already-powered workshop.
            const first=this.activationCount===1;
            game.player.gainExp(first?24:36);
            this.addCredits(first?10:26,game);
            if(game.run)game.run.basesActivated=(game.run.basesActivated||0)+1;
            const previous=this.technologyTier;
            this.technologyTier=Math.min(3,this.activationCount);
            message='Реактор запущен · сеть '+this.technologyTier+'/3'+
                (this.technologyTier>previous?
                    ' · оружие до ур. '+this.getUpgradeCap():'');
            game.worldVfx?.nova(base.x,base.y,180,'cyan');
            game.worldVfx?.boostDrop(base.x,base.y,'gold');
            game.createFloatingText?.('СТАНЦИЯ АКТИВНА · +'+(first?24:36)+' XP',
                base.x,base.y-95,'#89ffe8');
            // New coordinates are an actionable reason to depart. Discovery
            // XP requires physically arriving, not merely scanning.
            this.scanNearest(game);
            if((game._researchSaved||0)>0){
                game._pendingLevelUps=(game._pendingLevelUps||0)+game._researchSaved;
                game._researchSaved=0;
            }
        } else if(item==='baseDevelopment') {
            base.development ??= {defense:0,research:0,logistics:0};
            const rank=base.development[branch]++;
            if(branch==='defense') {
                const extra=[45,65,90][rank];
                base.maxHp+=extra;
                base.hp=Math.min(base.maxHp,base.hp+extra);
                game.player.baseMaxHp+=[8,12,16][rank];
                game.player.recalculateStats();
                message='Оборона ур. '+(rank+1)+' · корпуса станции и корабля укреплены';
            } else if(branch==='research') {
                const xp=[18,25,34][rank];
                game.player.gainExp(xp);
                message='Исследования ур. '+(rank+1)+' · опыт пилота +'+xp;
            } else {
                game.player.stationLogistics=Math.min(4,
                    (game.player.stationLogistics||0)+1);
                this.addCredits([6,8,10][rank],game);
                this.scanNearest(game);
                message='Логистика ур. '+(rank+1)+' · скорость полёта и новый маршрут';
            }
            game.worldVfx?.boostDrop(base.x,base.y,'cyan');
        } else if(item==='repair') {
            const pct=def.repair,amount=Math.ceil(game.player.maxHp*pct);
            game.player.heal(amount);
            message='Ремонт корпуса: +'+Math.round(pct*100)+'%';
            game.worldVfx?.boostCollect(base.x,base.y,'green');
        } else if(item==='turret') {
            base.turrets.push({
                mount:Math.max(0,Math.min(7,Number(mount)||0)),level:1,
                path:null,cooldown:.2,heat:0,overheat:0,
                learnedUntil:0,beam:null,lastShot:0,
                aimAngle:mountAngle(Math.max(0,Math.min(7,Number(mount)||0))),
                tracked:null,scanDelay:0,flash:0,recoil:0,
                integrity:100,disabled:false
            });
            message='Построена новая турель';
            game.worldVfx?.nova(base.x,base.y,110,'cyan');
        } else if(item==='extension') {
            base.sockets++;
            message='Секция построена · мест для турелей '+base.sockets;
            game.worldVfx?.boostDrop(base.x,base.y,'cyan');
        } else if(item==='upgradeTurret') {
            turret.level++;
            turret.heat=Math.max(0,turret.heat-30);
            message='Турель улучшена до уровня '+turret.level;
            game.worldVfx?.boostCollect(base.x,base.y,'cyan');
        } else if(item==='specialize') {
            turret.level=3;turret.path=branch;
            message='Специализация: '+TURRET_PATHS[branch].name;
            game.worldVfx?.nova(base.x,base.y,145,'gold');
        } else if(item==='escort') {
            const dir=this.nextAllyId%2?-1:1;
            const upgrades=base.escortUpgrades,scout=!def.fleet;
            const hp=(scout?23:45)+upgrades.hull*15;
            this.allies.push({
                id:this.nextAllyId++,homeId:base.id,kind:scout?'scout':'fighter',
                x:base.x+dir*44,y:base.y+30,vx:0,vy:0,
                hp,maxHp:hp,
                size:scout?10:13,state:'formation',target:null,think:0,shot:.4,
                hitCooldown:0,phase:dir*.7,angle:0
            });
            message=scout?'Слабый разведчик нанят':'Боевой истребитель поднялся с авианосца';
            game.worldVfx?.boostDrop(base.x,base.y,'cyan');
        } else if(item==='hangar') {
            base.hangarCapacity++;base.hangarTier++;
            message='Ангар расширен до '+base.hangarCapacity+' кораблей';
            game.worldVfx?.boostDrop(base.x,base.y,'gold');
        } else if(item==='stasisUpgrade') {
            base.defense.level++;
            message='Аварийный щит усилен · уровень '+base.defense.level;
            game.worldVfx?.nova(base.x,base.y,100,'cyan');
        } else if(item==='stasisMode') {
            base.defense.mode=branch;
            message=branch==='pulse'?'Установлен ответный электроимпульс':
                'Установлен криогенный излучатель';
            game.worldVfx?.nova(base.x,base.y,125,branch==='pulse'?'cyan':'blue');
        } else if(item==='escortUpgrade') {
            base.escortUpgrades[branch]++;
            if(branch==='hull') {
                for(const ally of this.allies.filter(a=>a.homeId===base.id)){
                    ally.maxHp+=15;ally.hp=Math.min(ally.maxHp,ally.hp+15);
                }
            }
            message=ESCORT_SHOPS[branch].name+' · уровень '+base.escortUpgrades[branch];
        } else if(item==='shipUpgrade') {
            this.shipUpgrades[branch]++;
            game.player.stationUpgrades=this.shipUpgrades;
            message=SHIP_SHOPS[branch].name+' · уровень '+this.shipUpgrades[branch];
        }
        if(quote.step&&!quote.discounted)this.resonanceBlueprints.add(quote.step.key);
        if(quote.discounted){
            message+=' · сопряжение: экономия '+quote.saved+' ⚙';
            game.createFloatingText?.('СОПРЯЖЕНИЕ −'+Math.round((1-quote.rate)*100)+'%',
                base.x,base.y-103,'#81ffe5');
        }
        if(cost>0)game.createFloatingText?.('−'+cost+' ⚙',base.x,base.y-75,'#ffdd98');
        game._announce?.(message);
        return {ok:true,message,cost,discounted:quote.discounted,saved:quote.saved};
    }

    addCredits(amount, game, x, y) {
        if (!this.enabled || !Number.isFinite(amount) || amount<=0) return;
        this.credits=Math.min(99999,this.credits+Math.floor(amount));
        if (x!==undefined && y!==undefined && distance({x,y},game.player)<650) {
            game.createFloatingText?.('⚙ +'+Math.floor(amount),x,y-28,'#ffd890');
        }
    }

    onEnemyKilled(enemy, game) {
        if (!this.enabled || enemy.siegeMite || distance(enemy,game.player)>760) return;
        const credits=enemy.boss?25:
            enemy.maxHp>=100?9:enemy.maxHp>=35?5:3;
        this.addCredits(credits,game);
    }

    update(dt, game) {
        if(!this.enabled || !game?.player) return;
        this.revealNearby(game);
        this.updateRaid(dt,game);
        for (const base of this.bases) {
            if (base.hp<=0 || !base.discovered)continue;
            // Prologue defense must keep working while the player moves to
            // another room; only ordinary expedition stations use local updates.
            if (distance(base,game.player)>1100 &&
                !(game.missionWorld?.index===0 && base.activated &&
                  base.id?.startsWith('prologue-')))continue;
            // Built-in station fixtures are bolted to the deck: never recoil
            // or drift while their weapons respond to incoming robots.
            if(game.missionWorld?.index!==0 || !base.id?.startsWith('prologue-'))
                this.updateStationPhysics(dt,base);
            this.updateStasis(dt,base,game);
            if(!base.activated ||
                (base.defense.active>0 && !(base.missionStasis?.rank>=2)))continue;
            for(const turret of base.turrets){
                if(turret.disabled || (turret.integrity??100)<=0)continue;
                this.updateTurret(dt,base,turret,game);
            }
        }
        for(let i=this.allies.length-1;i>=0;i--) {
            const ally=this.allies[i];
            this.updateAlly(dt,ally,game);
            if(ally.hp<=0) {
                game.worldVfx?.shipExplosion(ally.x,ally.y,16,'#81ebff',false);
                game.createParticles?.(ally.x,ally.y,'#9eeaff',14);
                this.allies.splice(i,1);
                game._announce?.('Ведомый потерян');
            }
        }
    }

    /** A massive base recoils a few pixels and settles back into its orbit.
     * The station and all mounted turrets share one coordinate transform. */
    updateStationPhysics(dt,base) {
        const ax=base.anchorX??base.x,ay=base.anchorY??base.y;
        base.vx=(base.vx||0)-(base.x-ax)*6*dt;
        base.vy=(base.vy||0)-(base.y-ay)*6*dt;
        const drag=Math.exp(-2.25*dt);
        base.vx*=drag;base.vy*=drag;
        base.x+=(base.vx||0)*dt;base.y+=(base.vy||0)*dt;
        const dx=base.x-ax,dy=base.y-ay,d=Math.hypot(dx,dy);
        if(d>25){base.x=ax+dx/d*25;base.y=ay+dy/d*25;
            base.vx*=.3;base.vy*=.3;}
    }

    recoilStation(base,amount,origin) {
        if(!origin || amount<=0)return;
        const dx=base.x-origin.x,dy=base.y-origin.y;
        const d=Math.hypot(dx,dy)||1;
        const kick=Math.min(38,amount*26000/(base.mass||20000));
        base.vx=(base.vx||0)+dx/d*kick;
        base.vy=(base.vy||0)+dy/d*kick;
    }

    /** Station-local, finite emergency shield. It absorbs a burst, never
     * grants absolute invulnerability, and disables all tower fire briefly. */
    updateStasis(dt,base,game) {
        const defense=base.defense;
        if(!defense)return;
        defense.active=Math.max(0,defense.active-dt);
        if(defense.active===0)defense.reserve=0;
        defense.cooldown=Math.max(0,defense.cooldown-dt);
        defense.recentTime=Math.max(0,defense.recentTime-dt);
        if(defense.recentTime===0)defense.recent=0;
    }

    damageBase(base,amount,game,source='bomb',origin=null) {
        if(!base || base.hp<=0 || !Number.isFinite(amount) || amount<=0)return 0;
        this.recoilStation(base,amount,origin);
        const shield=base.defense;
        let dmg=amount;
        if(shield) {
            if(shield.recentTime<=0){
                shield.recent=0;shield.recentTime=3.2;
            }
            // A fixed 3.2-second window, not indefinitely chained hits.
            shield.recent+=amount*(source==='swarm'?1.65:1);
            if(shield.active<=0 && shield.cooldown<=0 &&
                (shield.recent>=25 ||
                    (base.hp/base.maxHp<.27 && amount>=20))) {
                shield.active=4.8+shield.level*.75;
                shield.reserve=36+shield.level*22;
                shield.cooldown=84-shield.level*8;
                shield.recent=0;shield.recentTime=0;
                game.worldVfx?.nova(base.x,base.y,180,'cyan');
                game._announce?.('Аварийный стазис! Турели отключены, резерв щита ограничен.');
                game.audio?.playEvent('base_shield_engage');
                if(shield.mode)this.stationCounterPulse(base,game);
            }
            if(shield.active>0 && shield.reserve>0) {
                const blocked=Math.min(dmg,shield.reserve);
                dmg-=blocked;
                shield.reserve-=blocked;
                if(shield.reserve<=.01) {
                    shield.reserve=0;
                    shield.active=0;
                    game.worldVfx?.nova(base.x,base.y,135,'orange');
                    game._announce?.('Резерв стазиса исчерпан. База снова уязвима.');
                    game.audio?.playEvent('base_shield_break');
                }
            }
        }
        base.hp=Math.max(0,base.hp-dmg);
        if(dmg>0) {
            if(source!=='swarm')game.createFloatingText?.('−'+Math.ceil(dmg)+' БАЗА',
                base.x,base.y-70,'#ff816e');
            game.worldVfx?.hit(base.x,base.y,false,true);
            game.createParticles?.(base.x,base.y,'#ff9665',Math.min(14,5+Math.ceil(dmg/4)));
        } else if(source==='bomb') {
            game.createFloatingText?.('ЩИТ',base.x,base.y-70,'#86f7ff');
        }
        if(base.hp<=0) {
            game.worldVfx?.shipExplosion(base.x,base.y,70,'#ffc174',true);
            game._announce?.('База уничтожена! Откройте другую станцию.');
            game.audio?.playEvent('base_destroyed');
        }
        return dmg;
    }

    stationCounterPulse(base,game) {
        const defense=base.defense;
        const cryo=defense.mode==='cryo';
        const radius=cryo?215:185;
        game.worldVfx?.nova(base.x,base.y,radius,cryo?'blue':'cyan');
        for(const enemy of game.enemies) {
            if(enemy.hp<=0 || distance(enemy,base)>radius)continue;
            if(cryo) {
                enemy.slowTimer=Math.max(enemy.slowTimer||0,enemy.boss?.55:2.2);
                enemy.slowPct=Math.max(enemy.slowPct||0,enemy.boss?.45:.78);
            } else {
                enemy.takeDamage(enemy.siegeMite?9:5+defense.level*1.5);
                enemy.slowTimer=Math.max(enemy.slowTimer||0,enemy.boss?.18:.65);
                enemy.slowPct=Math.max(enemy.slowPct||0,.40);
            }
        }
    }

    /** Every ordinary pilot doesn't have the same answer to gunfire. */
    respondToTurret(enemy,base,turret,game,damage) {
        if(damage<=0 || enemy.hp<=0 || enemy.boss || enemy.siegeMite ||
            enemy.reactionCooldown>game.gameTime)return;
        const id=enemy.id;
        const attacker=enemy.flanker||enemy.dasher||id==='bat'||
            enemy.raidRole==='escort'||id==='stalker';
        const armored=enemy.shielded||enemy.maxHp>95||
            enemy.raidRole==='bomber'||
            (id==='zombie' && game.gameTime>240 && Math.random()<.17);
        const fabricator=game.gameTime>=220 &&
            (enemy.ranged||id==='slime'||id==='illusionist');
        if(attacker) {
            enemy.reactionBaseSpeed??=enemy.speed;
            enemy.speed=Math.min(enemy.reactionBaseSpeed*1.7,
                enemy.reactionBaseSpeed*(1.43+Math.random()*.22));
            enemy.reactionSpeedUntil=game.gameTime+2.8;
            enemy.reactionCooldown=game.gameTime+24;
            game.worldVfx?.muzzle(enemy.x,enemy.y,enemy.visualAngle||0,'afterburner');
        } else if(fabricator && this.spawnSiegeSwarm(enemy,base,turret,game)) {
            enemy.reactionCooldown=game.gameTime+56;
        } else if(armored) {
            enemy.reactiveShieldHp=Math.max(enemy.reactiveShieldHp||0,
                Math.min(34,12+enemy.maxHp*.2));
            enemy.reactiveShieldUntil=game.gameTime+4.7;
            enemy.reactionCooldown=game.gameTime+32;
            game.worldVfx?.nova(enemy.x,enemy.y,50,'blue');
        } else {
            enemy.reactionBaseSpeed??=enemy.speed;
            enemy.speed=enemy.reactionBaseSpeed*1.35;
            enemy.reactionSpeedUntil=game.gameTime+1.75;
            enemy.reactionCooldown=game.gameTime+30;
        }
    }

    spawnSiegeSwarm(enemy,base,turret,game) {
        const nearby=game.enemies.filter(e=>e.siegeMite&&e.hp>0).length;
        if(nearby>=24 || game.enemies.length>=CONFIG.MAX_ENEMIES-17 ||
            distance(base,game.player)>760)return false;
        const count=Math.min(12,8+Math.floor(game.gameTime/500),24-nearby);
        for(let i=0;i<count;i++){
            const a=i*TAU/count+Math.random()*.3;
            const def={...ENEMIES.SLIMELING,id:'siege_mite',
                name:'Штурмовой микродрон',hp:5,
                speed:196,damage:2.5,exp:0,size:6,
                splitter:false,color:'#ffbd73'};
            const mite=new Enemy(enemy.x+Math.cos(a)*24,
                enemy.y+Math.sin(a)*24,def,1,1);
            mite.siegeMite=true;
            mite.siegeBaseId=base.id;
            mite.siegeMount=turret.mount;
            mite.siegeTTL=18;
            mite.tacticPhase=a;
            game.enemies.push(mite);
        }
        game.worldVfx?.nova(enemy.x,enemy.y,70,'orange');
        game._announce?.('Противник выпустил рой микродронов на турель!');
        return true;
    }

    moveSiegeMite(enemy,dt,game) {
        if(!enemy.siegeMite)return false;
        const base=this.bases.find(b=>b.id===enemy.siegeBaseId);
        enemy.siegeTTL-=dt;
        if(!base || base.hp<=0 || enemy.siegeTTL<=0) {
            enemy.hp=0;return true;
        }
        if(distance(base,game.player)>900){enemy.hp=0;return true;}
        const angle=mountAngle(enemy.siegeMount);
        const tx=base.x+Math.cos(angle)*68;
        const ty=base.y+Math.sin(angle)*68;
        const dx=tx-enemy.x,dy=ty-enemy.y,d=Math.hypot(dx,dy);
        const slowed=enemy.slowTimer>0 ? .28 : 1;
        enemy.slowTimer=Math.max(0,(enemy.slowTimer||0)-dt);
        if(d>15) {
            enemy.x=clamp(enemy.x+dx/Math.max(d,1)*enemy.speed*slowed*dt,
                25,CONFIG.ARENA_WIDTH-25);
            enemy.y=clamp(enemy.y+dy/Math.max(d,1)*enemy.speed*slowed*dt,
                25,CONFIG.ARENA_HEIGHT-25);
            enemy.faceVelocity(dt,dx,dy);
        } else {
            const turret=base.turrets.find(t=>t.mount===enemy.siegeMount);
            if(turret && turret.overheat<=0){
                turret.heat=Math.min(100,turret.heat+12);
                if(turret.heat>=100)turret.overheat=3.3;
            }
            this.damageBase(base,2,game,'swarm',{x:enemy.x,y:enemy.y});
            game.worldVfx?.hit(enemy.x,enemy.y,false,true);
            enemy.hp=0;
        }
        return true;
    }

    /** A local tower-defense event: the world never destroys a remote base
     * while its defender is several screens away. */
    updateRaid(dt,game) {
        for(let i=this.bombTraces.length-1;i>=0;i--) {
            this.bombTraces[i].ttl-=dt;
            if(this.bombTraces[i].ttl<=0)this.bombTraces.splice(i,1);
        }
        if(!this.raid) {
            if(game.gameTime<this.nextRaidAt)return;
            const missionDefense=game.missionWorld?.index===3 &&
                game.missionWorld.network?.defenseReady;
            // Standing near any mandatory relay chooses it for the next raid.
            // The optional reserve cannot accidentally become the target.
            const base=missionDefense?
                this.bases.filter(b=>!b.missionOptional&&b.activated&&b.hp>0&&
                    distance(b,game.player)<520).sort((a,b)=>
                    distance(a,game.player)-distance(b,game.player))[0]:
                this.nearest(game,520);
            if(!base || base.hp<=0 || !base.activated ||
                (game.player.level<6 && game.gameTime<485 && !missionDefense))return;
            const warningSeconds=missionDefense?18:34;
            this.raid={id:++this.raidSerial,baseId:base.id,
                state:'warning',countdown:warningSeconds,elapsed:0,away:0,wave:this.raidWave+1};
            game._announce?.('Внимание! Обнаружена ударная эскадрилья. '+
                (base.displayName||TYPES[base.type].name)+
                ' будет атакована через '+warningSeconds+' секунд.');
            game.audio?.playEvent('base_raid_warning');
            return;
        }
        const raid=this.raid;
        const base=this.bases.find(b=>b.id===raid.baseId);
        if(!base || base.hp<=0) {
            this.endRaid(game,false);
            return;
        }
        const dist=distance(base,game.player);
        if(raid.state==='warning') {
            if(dist>950) {
                // De-escalation is explicit; never punish a player for
                // continuing exploration beyond the rendered battlefield.
                this.raid=null;
                this.nextRaidAt=game.gameTime+
                    (game.missionWorld?.index===3?12:95);
                return;
            }
            if(dist>790)return; // countdown pauses outside interception range
            raid.countdown-=dt;
            if(raid.countdown<=0)this.launchRaid(game,base,raid);
            return;
        }
        raid.elapsed+=dt;
        raid.away=dist>950?raid.away+dt:0;
        if(raid.away>7){this.endRaid(game,false,true);return;}
        const alive=game.enemies.filter(e=>e.raidTag===raid.id && e.hp>0);
        if(!alive.length) {
            this.endRaid(game,dist<790,dist>=790);
        } else if(raid.elapsed>105) {
            this.endRaid(game,false,true);
        }
    }

    launchRaid(game,base,raid) {
        raid.state='active';
        raid.elapsed=0;
        this.raidWave++;
        const tier=Math.min(3,Math.max(0,Math.floor((game.gameTime-380)/330)));
        const reserve=game.missionWorld?.index===3?
            this.bases.find(b=>b.missionOptional&&b.activated&&b.hp>0):null;
        raid.reserveAssisted=!!reserve;
        const bombers=Math.max(1,2+Math.min(2,tier)-(reserve?1:0));
        if(reserve){
            game.worldVfx?.nova(reserve.x,reserve.y,200,'cyan');
            game.worldVfx?.nova(base.x,base.y,150,'cyan');
            game._announce?.('Резерв «Край» сорвал заход одного бомбардировщика. '+
                'Остальных нужно остановить!');
        }
        const escorts=3+Math.min(4,tier*2);
        const angle=Math.atan2(game.player.y-base.y,game.player.x-base.x)+
            (Math.random()<.5?1:-1)*(.8+Math.random()*.5);
        const bx=base.x+Math.cos(angle)*515;
        const by=base.y+Math.sin(angle)*515;
        for(let i=0;i<bombers+escorts;i++){
            const heavy=i<bombers;
            const def=heavy?
                {...ENEMIES.BOMBER,id:'raid_bomber',name:'Осадный бомбардировщик',
                    bomber:false,archetype:'chaser',
                    hp:90+tier*30,speed:77+tier*4,damage:11,
                    size:24,exp:42,color:'#ff9070'}:
                {...ENEMIES.STALKER,id:'raid_escort',name:'Штурмовик прикрытия',
                    flanker:false,archetype:'chaser',
                    hp:34+tier*10,speed:138+tier*6,damage:12,
                    size:16,exp:20,color:'#ffbe64'};
            const offset=(i-(bombers+escorts-1)/2)*39;
            const enemy=new Enemy(
                clamp(bx+Math.cos(angle+Math.PI/2)*offset,60,CONFIG.ARENA_WIDTH-60),
                clamp(by+Math.sin(angle+Math.PI/2)*offset,60,CONFIG.ARENA_HEIGHT-60),
                def,1,1);
            enemy.raidTag=raid.id;
            enemy.raidRole=heavy?'bomber':'escort';
            enemy.raidBaseId=base.id;
            enemy.raidFireDelay=2.4+i*.28;
            enemy.raidOffset=(i%3-1)*1.15;
            game.enemies.push(enemy);
        }
        game.worldVfx?.nova(bx,by,100,'orange');
        game._announce?.('Ударная группа в секторе! Перехватите бомбардировщики.');
        game.audio?.playEvent('base_raid_warning',{intensity:1.15});
    }

    moveRaider(enemy,dt,game) {
        if(!this.raid || this.raid.state!=='active' ||
            enemy.raidTag!==this.raid.id)return false;
        const base=this.bases.find(b=>b.id===enemy.raidBaseId);
        if(!base || base.hp<=0)return false;
        // Off-screen sieges are frozen, then disengaged; no remote damage.
        if(distance(base,game.player)>860)return true;
        const dx=base.x-enemy.x,dy=base.y-enemy.y;
        const d=Math.hypot(dx,dy);
        let goalX,goalY;
        if(enemy.raidRole==='bomber') {
            goalX=base.x;goalY=base.y;
        } else {
            // Escorts screen ahead of the artillery and can opportunistically
            // break formation to pressure the player's interception path.
            const toP=distance(enemy,game.player);
            if(toP<260) {
                goalX=game.player.x+(game.player.vx||0)*.14;
                goalY=game.player.y+(game.player.vy||0)*.14;
            } else {
                const phase=game.gameTime*.72+enemy.tacticPhase;
                const a=Math.atan2(-dy,-dx)+enemy.raidOffset*.72;
                goalX=base.x+Math.cos(a)*155+Math.sin(phase)*45;
                goalY=base.y+Math.sin(a)*155+Math.cos(phase)*45;
            }
        }
        const gx=goalX-enemy.x,gy=goalY-enemy.y;
        const len=Math.hypot(gx,gy);
        let speed=enemy.speed*(enemy.slowTimer>0 ? .73 : 1);
        if(enemy.slowTimer>0)enemy.slowTimer=Math.max(0,enemy.slowTimer-dt);
        let vx=len>5?gx/len*speed:0,vy=len>5?gy/len*speed:0;
        if(enemy.raidRole==='bomber' && d<125){vx*=.12;vy*=.12;}
        const meteor=enemy.strikeThreat(dt,game);
        const dodge=meteor || this.avoidanceVector(enemy,game);
        if(dodge) {
            vx+=dodge.x*speed*dodge.intensity*.9;
            vy+=dodge.y*speed*dodge.intensity*.9;
        }
        enemy.x=clamp(enemy.x+vx*dt,35,CONFIG.ARENA_WIDTH-35);
        enemy.y=clamp(enemy.y+vy*dt,35,CONFIG.ARENA_HEIGHT-35);
        enemy.faceVelocity(dt,vx,vy);
        enemy.flashTimer=Math.max(0,enemy.flashTimer-dt);
        enemy.raidFireDelay-=dt;
        if(enemy.raidRole==='bomber' && d<205 && enemy.raidFireDelay<=0){
            enemy.raidFireDelay=6.8+Math.random()*1.5;
            const hit=22+this.raidWave*3;
            this.bombTraces.push({x:enemy.x,y:enemy.y,x2:base.x,y2:base.y,
                ttl:.54,life:.54});
            this.damageBase(base,hit,game,'bomb',{x:enemy.x,y:enemy.y});
        }
        return true;
    }

    endRaid(game,won,retreated=false) {
        const raid=this.raid;
        if(!raid)return;
        const base=this.bases.find(b=>b.id===raid.baseId);
        if(won && base && base.hp>0) {
            const earned=42+Math.min(3,raid.wave)*14;
            this.addCredits(earned,game,base.x,base.y);
            game.createFloatingText?.('БАЗА ОТСТОЯНА',base.x,base.y-115,'#8bffe7');
            game.worldVfx?.nova(base.x,base.y,105,'cyan');
            game._announce?.('Атака отбита! Награда: '+earned+' кредитов.');
            game.audio?.playEvent('base_raid_success');
        } else if(retreated) {
            game._announce?.('Эскадрилья покинула сектор. Атака прекращена.');
        }
        // The event is local. Raiders depart when the station is destroyed
        // or the player abandons the defense; regular waves continue.
        for(let i=game.enemies.length-1;i>=0;i--){
            if(game.enemies[i].raidTag===raid.id)
                game.enemies.splice(i,1);
        }
        this.raid=null;
        this.nextRaidAt=game.gameTime+(won?185:retreated?150:210);
        // Objective-based campaign counts only successfully defended raids.
        game.missionWorld?.onRaidEnded(game,Boolean(won && !retreated && base?.hp>0));
    }

    raidStatus(game) {
        if(!this.raid)return null;
        const base=this.bases.find(b=>b.id===this.raid.baseId);
        if(!base || base.hp<=0)return null;
        const dx=base.x-game.player.x,dy=base.y-game.player.y;
        const dirs=['→','↗','↑','↖','←','↙','↓','↘'];
        const oct=Math.round(Math.atan2(-dy,dx)/(Math.PI/4));
        return {state:this.raid.state,
            seconds:Math.max(0,Math.ceil(this.raid.countdown)),
            direction:dirs[((oct%8)+8)%8],
            distance:Math.round(Math.hypot(dx,dy)),
            hp:Math.ceil(base.hp),maxHp:base.maxHp,
            name:TYPES[base.type].name,
            bombers:game.enemies.filter(e=>e.raidTag===this.raid.id&&
                e.raidRole==='bomber'&&e.hp>0).length};
    }

    updateTurret(dt,base,turret,game) {
        turret.cooldown=Math.max(0,turret.cooldown-dt);
        turret.flash=Math.max(0,(turret.flash||0)-dt);
        turret.recoil=Math.max(0,(turret.recoil||0)-dt*45);
        if(turret.beam) {
            turret.beam.ttl-=dt;
            if(turret.beam.ttl<=0)turret.beam=null;
        }
        const bearing=mountAngle(turret.mount);
        const prologue=game.missionWorld?.index===0 &&
            base.id?.startsWith('prologue-');
        const profile=prologue?game.missionWorld.turretProfile(base):null;
        const range=profile?.range??(235+turret.level*32+((base.development?.defense||0)*12));
        // The turret head remains animated between shots. A cached target and
        // a staggered scan avoid walking the full enemy list every frame.
        turret.scanDelay=(turret.scanDelay||0)-dt;
        const inSector=(enemy)=>{
            if(!enemy || enemy.hp<=0)return false;
            const dx=enemy.x-base.x,dy=enemy.y-base.y;
            const d=Math.hypot(dx,dy);
            // Deck-mounted sentries have fully swiveling heads. A robot in the
            // same room must not survive just because it stood behind a mount.
            return d>=27 && d<=range &&
                (prologue || Math.abs(angleDiff(Math.atan2(dy,dx),bearing))<=.81) &&
                (!prologue || game.missionWorld.clearLineOfFire(
                    base.x,base.y,enemy.x,enemy.y));
        };
        if(!inSector(turret.tracked))turret.tracked=null;
        if(turret.scanDelay<=0 || (turret.cooldown<=0&&!turret.tracked)) {
            turret.scanDelay=.14+(turret.mount%3)*.025;
            let best=null,score=Infinity;
            for(const enemy of game.enemies) {
                if(!inSector(enemy))continue;
                const d=Math.hypot(enemy.x-base.x,enemy.y-base.y);
                // Hold an acquired target through small changes in distance:
                // no rapid left/right twitching between similar enemies.
                // The first level teaches the player to rely on sentries:
                // they interrupt a robot that is about to fire. Later, while
                // the core is defended, they prioritize approaching raiders.
                let urgency=0;
                if(prologue){
                    const playerDistance=Math.hypot(
                        enemy.x-game.player.x,enemy.y-game.player.y);
                    if(enemy.ranged&&enemy.aimTimer>0&&playerDistance<420)
                        urgency-=105;
                    else if(enemy.ranged&&playerDistance<300)urgency-=45;
                    if(enemy.prologueSiege&&game.missionWorld?.phase===5){
                        const wx=game.missionWorld.cx+6540,
                            wy=game.missionWorld.cy;
                        const coreDist=Math.hypot(enemy.x-wx,enemy.y-wy);
                        urgency-=Math.max(0,185-coreDist*.25);
                        if(enemy.id==='gunship')urgency-=30;
                    }
                    // Avoid wasting two ready barrels on the same near-dead
                    // target, while retaining lock on tougher enemies.
                    for(const mate of base.turrets){
                        if(mate===turret||mate.tracked!==enemy||
                            mate.disabled||mate.overheat>0||
                            (mate.cooldown||0)>.55)continue;
                        urgency+=enemy.hp<=25?68:19;
                    }
                }
                const value=d+(enemy.hp<=19?-70:0)+(enemy.boss?80:0)+
                    (enemy.raidRole==='escort'?-55:enemy.raidRole==='bomber'?-20:0)-
                    (enemy===turret.tracked?36:0)+urgency;
                if(value<score){score=value;best=enemy;}
            }
            turret.tracked=best;
        }
        const target=turret.tracked;
        const desired=target?Math.atan2(target.y-base.y,target.x-base.x):
            bearing+Math.sin((game.gameTime||0)*1.35+turret.mount*1.9)*.13;
        turret.aimAngle=turnTurretTowards(turret.aimAngle??bearing,
            desired,dt,7.4);
        if(turret.overheat>0) {
            turret.overheat=Math.max(0,turret.overheat-dt);
            if(turret.overheat===0){turret.heat=15;turret.cooldown=.45;}
            return;
        }
        turret.heat=Math.max(0,turret.heat-dt*9);
        // A weapon must be visibly aligned before releasing its instant hit.
        // Slewing takes at most a fraction of a second across its sector.
        if(turret.cooldown>0 || !target ||
            Math.abs(angleDiff(desired,turret.aimAngle))>.16)return;
        let baseDamage=8 + (turret.level-1)*6;
        if(turret.path==='rail')baseDamage=28+(turret.level-3)*16;
        if(turret.path==='missile')baseDamage=24+(turret.level-3)*9;
        if(turret.path==='arc')baseDamage=17+(turret.level-3)*8;
        if(profile)baseDamage=profile.damage;
        const armor=target.boss?(turret.level<3?.10:
            turret.path==='rail'?1:.43):
            target.maxHp>=130 && turret.level<3?.38:1;
        // Fast interceptors can partially dodge a visible salvo. Most
        // rounds still connect; a turret is a weapon, not an exclusion field.
        const evadeChance=target.dasher ? .2 : target.flanker ? .13 :
            target.raidRole==='escort' ? .12 : target.ranged ? .08 : .03;
        const actual=baseDamage*armor*(Math.random()<evadeChance ? .38 : 1);
        const hurt=(enemy,dmg)=>{
            const before=enemy.hp;
            enemy.takeDamage(dmg);
            const done=Math.max(0,before-enemy.hp);
            const w=enemy.stationWounds || (enemy.stationWounds={});
            const k=base.id+':'+turret.mount;
            if(!w[k] || game.gameTime-w[k].at>3.6)w[k]={at:game.gameTime,sum:0};
            w[k].sum+=done;w[k].at=game.gameTime;
            this.respondToTurret(enemy,base,turret,game,done);
            if(w[k].sum>=enemy.maxHp*.30)
                turret.learnedUntil=game.gameTime+34;
            return done;
        };
        hurt(target,actual);
        if(turret.path==='arc') {
            const second=game.enemies.filter(e=>e!==target&&e.hp>0&&
                distance(e,target)<105).sort((a,b)=>distance(a,target)-distance(b,target));
            for(const e of second.slice(0,turret.level>=5?3:1)){
                hurt(e,actual*.48);e.slowTimer=Math.max(e.slowTimer||0,1.05);
                e.slowPct=Math.max(e.slowPct||0,.33);
                game.worldVfx?.hit(e.x,e.y,false,true);
            }
            target.slowTimer=Math.max(target.slowTimer||0,.6);
            target.slowPct=Math.max(target.slowPct||0,.28);
        }
        if(turret.path==='missile'){
            for(const e of game.enemies){
                if(e===target||e.hp<=0||distance(e,target)>67)continue;
                hurt(e,actual*.55);
            }
            game.worldVfx?.nova(target.x,target.y,67,'orange');
        }
        if(turret.path==='rail'){
            const tx=target.x-base.x,ty=target.y-base.y;
            const length=Math.hypot(tx,ty);
            for(const e of game.enemies){
                if(e===target||e.hp<=0)continue;
                const ex=e.x-base.x,ey=e.y-base.y;
                const along=(ex*tx+ey*ty)/Math.max(1,length);
                const sideways=Math.abs(ex*ty-ey*tx)/Math.max(1,length);
                if(along>length && along<range && sideways<16 &&
                    (!prologue||game.missionWorld.clearLineOfFire(base.x,base.y,e.x,e.y)))
                    hurt(e,actual*.62);
            }
        }
        const a=Math.atan2(target.y-base.y,target.x-base.x);
        const muzzle=turretMuzzle(base.x,base.y,bearing,a,0);
        turret.beam={x:muzzle.x,y:muzzle.y,x2:target.x,y2:target.y,ttl:.19};
        turret.aimAngle=a;
        turret.flash=.19;
        turret.recoil=turret.path==='rail'?9:turret.path==='missile'?7:5;
        turret.lastShot=game.gameTime;
        turret.cooldown=profile?.cooldown??(turret.path==='rail'?2.65:
            turret.path==='missile'?2.1:Math.max(.72,1.5-.1*(turret.level-1)));
        turret.heat+=profile?.heat??(turret.path==='rail'?39:
            turret.path==='missile'?31:turret.path==='arc'?25:23);
        if(turret.heat>=100){turret.heat=100;turret.overheat=6.2;}
        game.worldVfx?.hit(target.x,target.y,false,false);
        game.audio?.shoot?.();
    }

    /** Defensive AI: dodge an observed tracer, never treat an entire turret
     * arc as a forbidden zone. Reckless attackers keep charging. */
    avoidanceVector(enemy,game) {
        if(!this.enabled || enemy.boss || enemy.dasher)return null;
        if(Math.sin((enemy.tacticPhase||0)*3.7+enemy.x*.014)<-.43)return null;
        let best=null,bestWeight=0;
        for(const base of this.bases) {
            if(base.hp<=0 || distance(base,game.player)>880)continue;
            for(const turret of base.turrets) {
                if(turret.overheat>0 || !turret.lastShot)continue;
                const since=game.gameTime-turret.lastShot;
                if(since<0 || since>1.05)continue;
                const dx=enemy.x-base.x,dy=enemy.y-base.y;
                const d=Math.hypot(dx,dy),range=235+turret.level*32;
                if(d>range+36 || d<45)continue;
                const angle=Math.atan2(dy,dx);
                const beamAngle=turret.beam
                    ?Math.atan2(turret.beam.y2-base.y,turret.beam.x2-base.x)
                    :mountAngle(turret.mount);
                const offset=angleDiff(angle,beamAngle);
                if(Math.abs(offset)>.46)continue;
                const intensity=(1-since/1.05)*(.18+
                    (turret.learnedUntil>game.gameTime?.14:.05))*
                    (enemy.ranged?.85:1);
                if(intensity<=bestWeight)continue;
                const side=offset>=0?1:-1;
                bestWeight=intensity;
                best={x:-dy/d*side,y:dx/d*side,intensity};
            }
        }
        return best;
    }

    isMeteorSheltered(player) {
        if(!this.enabled || !player)return false;
        return this.bases.some(b=>b.activated&&b.hp>0&&
            Math.hypot(b.x-player.x,b.y-player.y)<210);
    }

    /** Aggro is acquired locally and held briefly. Allies do not become
     * perfectly reliable decoys, and bosses still target the player. */
    targetForEnemy(enemy,player) {
        if(!this.enabled || enemy.boss || !this.allies.length)return player;
        let best=null,bestD=225;
        for(const ally of this.allies) {
            if(ally.hp<=0)continue;
            const d=distance(enemy,ally);
            if(d<bestD){best=ally;bestD=d;}
        }
        if(!best)return player;
        if(enemy.escortAggroId===best.id)return best;
        if(bestD<130 || Math.sin((enemy.tacticPhase||0)*9)>-.15) {
            enemy.escortAggroId=best.id;
            return best;
        }
        return player;
    }

    interceptEnemyProjectile(p,game) {
        if(!this.enabled || p.kind==='mine')return false;
        for(const ally of this.allies) {
            if(ally.hp<=0 || distance(p,ally)>=ally.size+p.size)continue;
            if(ally.hitCooldown<=0) {
                ally.hp-=p.damage;
                ally.hitCooldown=.38;
                game.worldVfx?.hit(ally.x,ally.y,false,false);
                game.createParticles?.(ally.x,ally.y,'#73e5ff',5);
            }
            p.shouldRemove=true;
            return true;
        }
        return false;
    }

    updateAlly(dt,ally,game) {
        const p=game.player;
        const home=this.bases.find(b=>b.id===ally.homeId);
        const improvements=home?.escortUpgrades||{hull:0,engine:0,gun:0};
        ally.think-=dt;
        ally.shot-=dt;
        ally.hitCooldown=Math.max(0,ally.hitCooldown-dt);
        if(ally.think<=0) {
            ally.think=.24+Math.abs(ally.phase)*.025;
            let best=null,bestScore=Infinity;
            const nearby=game.spatial?.queryRect ?
                game.spatial.queryRect(ally.x,ally.y,405) : game.enemies;
            for(const e of nearby) {
                if(e.hp<=0)continue;
                const d=distance(ally,e);
                if(d>385)continue;
                const score=d+(distance(p,e)<180?-95:0)+(e.boss?70:0);
                if(score<bestScore){bestScore=score;best=e;}
            }
            ally.target=best;
        }
        const target=ally.target && ally.target.hp>0 &&
            distance(ally,ally.target)<420?ally.target:null;
        const distHero=distance(ally,p);
        const slot=ally.id%6;
        const angle=slot*TAU/6 + Math.PI/3;
        const radius=ally.kind==='scout'?87:102;
        let goalX=p.x+Math.cos(angle)*radius;
        let goalY=p.y+Math.sin(angle)*radius;
        let desiredSpeed=(distHero>180?255:195)*(1+improvements.engine*.14)*
            (ally.kind==='scout'?1.12:1);
        if(target && distHero<490) {
            const dx=target.x-ally.x,dy=target.y-ally.y;
            const d=Math.hypot(dx,dy);
            ally.state=d<90?'evade':'attack';
            const ideal=145;
            goalX=target.x-dx/Math.max(1,d)*ideal;
            goalY=target.y-dy/Math.max(1,d)*ideal;
            if(d<88){
                goalX=ally.x-dx/Math.max(1,d)*145;
                goalY=ally.y-dy/Math.max(1,d)*145;
            }
        } else {
            ally.state=distHero>190?'regroup':'formation';
        }
        // Nearby projectiles are anticipated along their future trajectories,
        // not just avoided after they already overlap the escort.
        let dodgeX=0,dodgeY=0;
        for(const bullet of game.enemyProjectiles) {
            if(bullet.shouldRemove || bullet.kind==='mine')continue;
            const speed2=bullet.vx*bullet.vx+bullet.vy*bullet.vy;
            if(speed2<1)continue;
            const rx=ally.x-bullet.x,ry=ally.y-bullet.y;
            if(Math.abs(rx)>210||Math.abs(ry)>210)continue;
            const t=clamp((rx*bullet.vx+ry*bullet.vy)/speed2,0,.6);
            const dx=rx-bullet.vx*t,dy=ry-bullet.vy*t;
            if(Math.hypot(dx,dy)>ally.size+31)continue;
            const inv=1/Math.max(1,Math.hypot(dx,dy));
            dodgeX+=dx*inv*2.3;
            dodgeY+=dy*inv*2.3;
        }
        const hazard=game.battleDirector?.avoidanceVector?.(ally.x,ally.y,ally.size,ally.phase);
        if(hazard) {
            dodgeX+=hazard.x*2.9*hazard.intensity;
            dodgeY+=hazard.y*2.9*hazard.intensity;
        }
        for(const rock of game.worldObstacles||[]) {
            if(rock.destroyed)continue;
            const dx=ally.x-rock.x,dy=ally.y-rock.y;
            if(Math.abs(dx)>110||Math.abs(dy)>110)continue;
            const d=Math.hypot(dx,dy),reach=(rock.radius||20)+ally.size+44;
            if(d>0 && d<reach){
                dodgeX+=dx/d*(reach-d)/reach*2.6;
                dodgeY+=dy/d*(reach-d)/reach*2.6;
            }
        }
        for(const other of this.allies) {
            if(other===ally || other.hp<=0)continue;
            const dx=ally.x-other.x,dy=ally.y-other.y,d=Math.hypot(dx,dy);
            if(d>0&&d<58){dodgeX+=dx/d;dodgeY+=dy/d;}
        }
        const dx=goalX-ally.x,dy=goalY-ally.y,d=Math.hypot(dx,dy);
        const arrival=clamp(d/100,0,1);
        let vx=dx/Math.max(1,d)*desiredSpeed*arrival + dodgeX*138;
        let vy=dy/Math.max(1,d)*desiredSpeed*arrival + dodgeY*138;
        const mag=Math.hypot(vx,vy);
        const maxSpeed=(ally.kind==='scout'?328:285)*
            (1+improvements.engine*.15);
        if(mag>maxSpeed){vx=vx/mag*maxSpeed;vy=vy/mag*maxSpeed;}
        const blend=1-Math.exp(-6.2*dt);
        ally.vx+=(vx-ally.vx)*blend;
        ally.vy+=(vy-ally.vy)*blend;
        ally.x=clamp(ally.x+ally.vx*dt,24,CONFIG.ARENA_WIDTH-24);
        ally.y=clamp(ally.y+ally.vy*dt,24,CONFIG.ARENA_HEIGHT-24);
        if(Math.hypot(ally.vx,ally.vy)>6)
            ally.angle=Math.atan2(ally.vy,ally.vx)+Math.PI/2;
        // Enemies can ram escorts. A short impact cooldown prevents instant
        // deletion from multiple overlapping collision checks in one frame.
        if(ally.hitCooldown<=0) {
            for(const enemy of game.enemies) {
                if(enemy.hp<=0 || distance(ally,enemy)>=ally.size+enemy.size)continue;
                ally.hp-=Math.max(4,enemy.damage*.72);
                ally.hitCooldown=.6;
                game.createParticles?.(ally.x,ally.y,'#9deaff',6);
                break;
            }
        }
        if(target && ally.shot<=0 && distance(ally,target)<315) {
            ally.shot=(ally.kind==='scout'?1.76:1.18)/
                (1+improvements.gun*.17);
            const angle=Math.atan2(target.y-ally.y,target.x-ally.x);
            game.projectiles.push(new Projectile(ally.x,ally.y,angle,
                ESCORT_DEF,ally.kind==='scout'?6:11+improvements.gun*4,1,null));
            game.worldVfx?.muzzle(ally.x,ally.y,angle,'escort_pulse');
            game.audio?.shoot?.();
        }
    }

    render(ctx,game) {
        if(!this.enabled)return;
        const px=game.player?.x||0,py=game.player?.y||0;
        const time=game.gameTime||0;
        // Bright connection pulses travel between compatible active bases.
        for(const {from,to,type} of
            (game.missionWorld?.index===0 ? [] : this.resonanceLinks())){
            const left=Math.min(from.x,to.x),right=Math.max(from.x,to.x);
            const top=Math.min(from.y,to.y),bottom=Math.max(from.y,to.y);
            if(right<px-900||left>px+900||bottom<py-660||top>py+660)continue;
            const color=TYPES[type]?.color||'#8af6e8';
            const fresh=Math.max(0,1-(time-(to.activationTime||0))/3.6);
            ctx.save();ctx.strokeStyle=color;ctx.shadowColor=color;
            ctx.shadowBlur=fresh>0?22:7;
            ctx.lineWidth=fresh>0?2.5+2.5*fresh:1.35;
            ctx.globalAlpha=.23+.65*fresh;
            ctx.setLineDash(fresh>0?[]:[8,13]);
            ctx.lineDashOffset=-time*21;
            ctx.beginPath();ctx.moveTo(from.x,from.y);
            ctx.lineTo(to.x,to.y);ctx.stroke();
            ctx.setLineDash([]);
            const progress=((time*.18)%1+1)%1;
            const bx=from.x+(to.x-from.x)*progress;
            const by=from.y+(to.y-from.y)*progress;
            if(Math.abs(bx-px)<930&&Math.abs(by-py)<690){
                ctx.globalAlpha=.8;ctx.fillStyle='#edfffb';
                ctx.shadowBlur=18;ctx.beginPath();ctx.arc(bx,by,3.5+2*fresh,0,TAU);
                ctx.fill();
            }
            ctx.restore();
        }
        for(const base of this.bases) {
            // Prologue fixtures are embedded in the station's decks;
            // their bespoke 2D mounts are painted by PrologueMissionWorld.
            if(game.missionWorld?.index===0 && base.id?.startsWith('prologue-'))continue;
            if(!base.discovered||base.hp<=0||
                Math.abs(base.x-px)>900||Math.abs(base.y-py)>660)continue;
            const def=TYPES[base.type],size=base.type==='carrier'?190:
                base.type==='outpost'?122:160;
            ctx.save();ctx.translate(base.x,base.y);
            const online=!!base.activated;
            const startup=online?clamp((time-base.activationTime)/1.7,0,1):0;
            const glow=ctx.createRadialGradient(0,0,15,0,0,size*.73);
            glow.addColorStop(0,online?def.color+'45':'#72819415');
            glow.addColorStop(1,'rgba(30,115,189,0)');
            ctx.fillStyle=glow;ctx.beginPath();
            ctx.arc(0,0,size*.73,0,TAU);ctx.fill();
            // A new extension is visible immediately, even before it is armed.
            for(let slot=1;slot<base.sockets;slot++) {
                const occupied=base.turrets[slot];
                const a=occupied?mountAngle(occupied.mount):
                    (slot-1)*TAU/Math.max(3,base.sockets-1);
                const sx=Math.cos(a)*58,sy=Math.sin(a)*58;
                drawStationPart(ctx,STATION_PARTS.bridge,sx,sy,90,a);
                if(!occupied) {
                    ctx.strokeStyle='#77cbd977';ctx.lineWidth=2;
                    ctx.beginPath();ctx.arc(Math.cos(a)*84,
                        Math.sin(a)*84,20,0,TAU);ctx.stroke();
                }
            }
            // Dormant stations show only a cold hull; powered stations
            // visibly awaken their reactor and rotating equipment.
            ctx.save();ctx.globalAlpha=online?1:.55;
            if(!drawStationPart(ctx,STATION_PARTS[def.sprite],0,0,size)) {
                ctx.fillStyle='#173d55';ctx.strokeStyle=def.color;
                ctx.fillRect(-45,-45,90,90);ctx.strokeRect(-45,-45,90,90);
            }
            ctx.restore();
            if(online)drawStationMechanisms(ctx,base,size,time,
                !!game.save?.settings?.reducedMotion);
            if(online){
                // Startup becomes a visible wave of power after leaving the
                // paused dock: the hologram boot sequence and the space view
                // tell the same story without introducing extra gameplay time.
                const bootElapsed=time-(base.activationTime||0);
                if(bootElapsed>=0&&bootElapsed<3.2){
                    ctx.save();
                    ctx.globalAlpha=.72*(1-bootElapsed/3.2);
                    ctx.strokeStyle='#91fff0';ctx.shadowColor=def.color;
                    ctx.shadowBlur=25;ctx.lineWidth=5-bootElapsed*.9;
                    ctx.beginPath();
                    ctx.arc(0,0,24+bootElapsed*61,0,TAU);ctx.stroke();
                    ctx.restore();
                }
                ctx.save();
                ctx.globalAlpha=startup*(.65+.13*Math.sin(time*3.2));
                ctx.strokeStyle=def.color;ctx.shadowColor=def.color;
                ctx.shadowBlur=17;ctx.lineWidth=3;
                ctx.rotate(time*.38);
                ctx.beginPath();
                ctx.arc(0,0,size*.32,.2,2.7);
                ctx.arc(0,0,size*.32,Math.PI+.2,TAU-.35);
                ctx.stroke();
                ctx.rotate(-time*.9);
                ctx.lineWidth=1.7;ctx.globalAlpha=startup*.66;
                ctx.beginPath();
                ctx.arc(0,0,size*.43,.6,1.9);
                ctx.arc(0,0,size*.43,3.75,5.1);
                ctx.stroke();
                ctx.restore();
                for(let k=0;k<6;k++){
                    const a=k*TAU/6+time*.21;
                    const x=Math.cos(a)*size*.37,y=Math.sin(a)*size*.37;
                    ctx.save();ctx.globalAlpha=startup*(.42+.58*Math.sin(time*2.7+k*1.5)**2);
                    ctx.fillStyle=k%2?def.color:'#ffffff';
                    ctx.shadowColor=def.color;ctx.shadowBlur=10;
                    ctx.beginPath();ctx.arc(x,y,2.5,0,TAU);ctx.fill();
                    ctx.restore();
                }
            } else {
                ctx.save();ctx.globalAlpha=.32;
                ctx.strokeStyle='#8797ac';ctx.setLineDash([7,12]);
                ctx.lineWidth=1.6;ctx.beginPath();
                ctx.arc(0,0,size*.41,0,TAU);ctx.stroke();
                ctx.setLineDash([]);ctx.restore();
            }
            // The cyan pressure dome is visible to both pilots and enemies.
            if(base.defense?.active>0) {
                const reserve=clamp(base.defense.reserve/
                    (36+base.defense.level*22),0,1);
                ctx.save();ctx.strokeStyle='#77efff';
                ctx.shadowColor='#5cceff';ctx.shadowBlur=32;
                ctx.globalAlpha=.38+.28*Math.sin(time*8);
                ctx.lineWidth=3+reserve*3;
                ctx.beginPath();ctx.arc(0,0,139,0,TAU);ctx.stroke();
                ctx.globalAlpha=.1+reserve*.12;
                ctx.fillStyle='#63dfff';ctx.fill();
                ctx.restore();
                ctx.fillStyle='#b8f9ff';ctx.font='bold 12px system-ui';
                ctx.textAlign='center';
                ctx.fillText('СТАЗИС · РЕЗЕРВ '+Math.ceil(base.defense.reserve),
                    0,145);
            }
            const pulse=.75+.25*Math.sin(time*2.6+base.x);
            ctx.fillStyle=online?def.color:'#7c92a0';ctx.globalAlpha=(online?.65:.1)*pulse*startup+(online?0:.08);
            ctx.shadowColor=def.color;ctx.shadowBlur=19;
            ctx.beginPath();ctx.arc(0,0,14,0,TAU);ctx.fill();
            ctx.globalAlpha=1;ctx.shadowBlur=0;
            for(const turret of base.turrets) {
                ctx.save();
                const broken=turret.disabled || (turret.integrity??100)<=0;
                if(broken)ctx.globalAlpha=.34;
                const a=mountAngle(turret.mount);
                const tx=Math.cos(a)*78,ty=Math.sin(a)*78;
                if(!base.turrets.some(t=>t!==turret&&t.mount===turret.mount))
                    drawStationPart(ctx,STATION_PARTS.bridge,tx*.55,ty*.55,82,a);
                let part=STATION_PARTS.basic;
                if(turret.path&&TURRET_PATHS[turret.path])
                    part=TURRET_PATHS[turret.path].art;
                if(turret.level===2)part=STATION_PARTS.turretIdle;
                if(turret.level>=3&&!turret.path)part=STATION_PARTS.turretIdle;
                const aim=turret.aimAngle??a;
                const recoil=turret.recoil||0;
                const flash=clamp((turret.flash||0)/.19,0,1);
                if(turret.path==='arc'&&flash>0)
                    part=STATION_PARTS.turretFireStart+
                        Math.min(7,Math.floor((1-flash)*8));
                // Static armored mounting ring with one powered segment
                // per purchased rank; the gun head rotates independently.
                drawTurretMount(ctx,turret,tx,ty,time);
                const rx=-Math.cos(aim)*recoil,ry=-Math.sin(aim)*recoil;
                if(!drawStationPart(ctx,part,tx+rx,ty+ry,66,aim-Math.PI/2)) {
                    ctx.save();ctx.translate(tx+rx,ty+ry);ctx.rotate(aim);
                    ctx.fillStyle='#294c66';ctx.strokeStyle='#9be9ff';
                    ctx.lineWidth=2;ctx.fillRect(-11,-10,22,20);
                    ctx.strokeRect(-11,-10,22,20);
                    ctx.fillStyle='#a9eaff';ctx.fillRect(2,-4,24,8);
                    ctx.restore();
                }
                drawTurretHead(ctx,turret,tx+rx,ty+ry,aim,time);
                // Flash, expanding plasma plume and recoil are lightweight
                // Canvas effects; no additional textures or draw calls on idle.
                if(flash>0){
                    const color=turret.path==='rail'?'#b4e7ff':
                        turret.path==='missile'?'#ffc27a':
                        turret.path==='arc'?'#83fff1':'#9ef8ff';
                    const tip=turretMuzzle(0,0,a,aim,recoil);
                    ctx.save();ctx.translate(tx+(tip.x-Math.cos(a)*78),
                        ty+(tip.y-Math.sin(a)*78));
                    ctx.rotate(aim);
                    ctx.globalAlpha=flash;
                    ctx.shadowColor=color;ctx.shadowBlur=18+flash*16;
                    ctx.fillStyle=color;ctx.beginPath();
                    ctx.ellipse(0,0,7+flash*7,4+flash*3,0,0,TAU);ctx.fill();
                    ctx.beginPath();ctx.moveTo(0,-4);
                    ctx.lineTo(18+flash*24,0);ctx.lineTo(0,4);ctx.fill();
                    ctx.fillStyle='#fff';ctx.beginPath();
                    ctx.arc(0,0,2.5+flash*2,0,TAU);ctx.fill();
                    ctx.restore();
                }
                const hot=turret.overheat>0;
                if(hot) {
                    const countdown=Math.max(0,turret.overheat);
                    const hz=countdown<1.5?9:2.2;
                    const wave=.38+.62*Math.pow((Math.sin(time*hz*TAU)+1)/2,1.8);
                    ctx.strokeStyle='#ff4b54';
                    ctx.shadowColor='#ff2030';ctx.shadowBlur=25;
                    ctx.globalAlpha=.16+.7*wave;ctx.lineWidth=4;
                    ctx.beginPath();ctx.arc(tx,ty,29,0,TAU);ctx.stroke();
                    ctx.globalAlpha=1;ctx.shadowBlur=0;
                } else if(turret.heat>55){
                    ctx.strokeStyle='#ffa666';ctx.globalAlpha=.45;
                    ctx.lineWidth=2;ctx.beginPath();ctx.arc(tx,ty,25,0,TAU);
                    ctx.stroke();ctx.globalAlpha=1;
                }
                if(turret.beam){
                    ctx.save();ctx.strokeStyle=turret.path==='rail'?'#9ddaff':
                        turret.path==='missile'?'#ffae65':'#79ffe0';
                    ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=14;
                    ctx.globalAlpha=clamp(turret.beam.ttl/.19,0,1);
                    ctx.lineWidth=turret.path==='rail'?5:3;
                    ctx.beginPath();
                    ctx.moveTo(turret.beam.x-base.x,turret.beam.y-base.y);
                    ctx.lineTo(turret.beam.x2-base.x,turret.beam.y2-base.y);
                    ctx.stroke();ctx.restore();
                }
                if(broken){
                    ctx.globalAlpha=.92;ctx.strokeStyle='#ff675d';ctx.lineWidth=3;
                    ctx.beginPath();ctx.arc(tx,ty,24,0,Math.PI*2);ctx.stroke();
                    ctx.beginPath();ctx.moveTo(tx-12,ty-12);ctx.lineTo(tx+12,ty+12);
                    ctx.moveTo(tx+12,ty-12);ctx.lineTo(tx-12,ty+12);ctx.stroke();
                }
                ctx.restore();
            }
            ctx.textAlign='center';ctx.font='bold 14px system-ui';
            ctx.fillStyle='#f2fcff';
            ctx.shadowColor='#00182f';ctx.shadowBlur=8;
            ctx.fillText((online?'🟢 ':'⚫ ')+def.icon+' '+def.name,0,-size*.58-22);
            ctx.shadowBlur=0;
            if(base.hp<base.maxHp || this.raid?.baseId===base.id){
                const hpRatio=clamp(base.hp/base.maxHp,0,1);
                ctx.fillStyle='#061523';ctx.fillRect(-52,-size*.58-15,104,6);
                ctx.fillStyle=hpRatio<.4?'#ff665b':'#86e9e6';
                ctx.fillRect(-51,-size*.58-14,102*hpRatio,4);
            }
            if(Math.hypot(base.x-px,base.y-py)<175) {
                ctx.fillStyle='#c4ffe9';ctx.font='12px system-ui';
                ctx.fillText(online?'E — МАСТЕРСКАЯ · '+this.credits+' ⚙':'E — ЗАПУСТИТЬ СТАНЦИЮ',
                    0,size*.56+29);
            }
            ctx.restore();
        }
        // Visible siege bolts: bombs are distinct from ordinary gunfire.
        for(const trace of this.bombTraces) {
            if(Math.abs(trace.x-px)>1100 || Math.abs(trace.y-py)>850)continue;
            const opacity=clamp(trace.ttl/trace.life,0,1);
            ctx.save();
            ctx.globalAlpha=opacity;
            ctx.strokeStyle='#ffc080';ctx.lineWidth=6*opacity+1;
            ctx.shadowColor='#ff7441';ctx.shadowBlur=18;
            ctx.beginPath();ctx.moveTo(trace.x,trace.y);
            ctx.lineTo(trace.x2,trace.y2);ctx.stroke();
            ctx.restore();
            drawCombatImpact(ctx,trace.x2,trace.y2,66,opacity,2);
        }
        for(const ally of this.allies){
            if(ally.hp<=0||Math.abs(ally.x-px)>900||Math.abs(ally.y-py)>650)continue;
            ctx.save();ctx.translate(ally.x,ally.y);
            const speed=Math.hypot(ally.vx,ally.vy);
            const back=ally.angle-Math.PI/2;
            if(speed>25){
                ctx.save();ctx.rotate(back);
                const flare=ctx.createRadialGradient(-17,0,1,-18,0,25);
                flare.addColorStop(0,'rgba(176,247,255,.8)');
                flare.addColorStop(.45,'rgba(58,166,255,.4)');
                flare.addColorStop(1,'rgba(44,105,255,0)');
                ctx.fillStyle=flare;ctx.fillRect(-45,-28,55,56);
                ctx.restore();
            }
            ctx.restore();
            const frame=Math.floor(time*11+ally.id*3)%9;
            const art=ally.id%2?STATION_PARTS.scoutStart:STATION_PARTS.fighterStart;
            if(!drawStationPart(ctx,art+frame,ally.x,ally.y,44,back)) {
                ctx.save();ctx.translate(ally.x,ally.y);ctx.rotate(ally.angle);
                ctx.fillStyle='#98efff';ctx.beginPath();ctx.moveTo(0,-15);
                ctx.lineTo(11,11);ctx.lineTo(-11,11);ctx.fill();ctx.restore();
            }
            const ratio=clamp(ally.hp/ally.maxHp,0,1);
            ctx.fillStyle='#122738';ctx.fillRect(ally.x-16,ally.y+21,32,3);
            ctx.fillStyle=ratio<.35?'#ff978d':'#70efd9';
            ctx.fillRect(ally.x-16,ally.y+21,32*ratio,3);
        }
    }

    status(game) {
        if(!this.enabled)return {enabled:false};
        const dock=this.dockable(game);
        const local=this.nearest(game,220);
        const objective=this.expeditionTarget(game);
        const base=local || objective || this.nearest(game);
        if(!base)return {enabled:true,credits:this.credits,base:null,
            objective:null,dockable:!!dock};
        const dx=base.x-game.player.x,dy=base.y-game.player.y;
        const bearing=Math.atan2(-dy,dx);
        const dirs=['→','↗','↑','↖','←','↙','↓','↘'];
        const oct=Math.round(bearing/(Math.PI/4));
        return {enabled:true,credits:this.credits,base,
            distance:Math.round(Math.hypot(dx,dy)),
            direction:dirs[((oct%8)+8)%8],
            name:base.displayName||TYPES[base.type].name,active:!!base.activated,techTier:this.technologyTier,
            activeCount:this.activeStations(),
            dockable:!!dock, objective,
            navigation:!!(objective&&base.id===objective.id),
            visited:!!base.visited, escorts:this.allies.length};
    }

    typeInfo(base){
        const def=TYPES[base.type];
        return base.displayName?{...def,name:base.displayName}:def;
    }
}

