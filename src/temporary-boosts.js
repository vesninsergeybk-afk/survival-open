/**
 * Asteroid drops and roaming field finds.
 *
 * Timed boosts expire in game-time. Rare micro-modules last for a single run
 * (capped at four small stacks), while core weapons/passives still come from
 * energy-orb level-ups. No pickup is saved between runs.
 */
import { getFXSprite } from './vfx-textures.js?v=space-4';
import { CONFIG } from './config.js?v=cc0-6';

export const TEMPORARY_BOOSTS = Object.freeze({
    overcharge: Object.freeze({
        id:'overcharge', icon:'⚡', name:'Перегрузка', color:'#ffb76a',
        duration:12, description:'Урон +55%'
    }),
    rapid: Object.freeze({
        id:'rapid', icon:'💥', name:'Ускоритель', color:'#f891f7',
        duration:11, description:'Атаки на 42% чаще'
    }),
    reach: Object.freeze({
        id:'reach', icon:'🎯', name:'Дальнобойность', color:'#79eafa',
        duration:14, description:'Дальность +75%'
    }),
    thruster: Object.freeze({
        id:'thruster', icon:'🚀', name:'Форсаж', color:'#a4ff83',
        duration:15, description:'Скорость +45%'
    })
});

export const FIELD_MODULES = Object.freeze({
    capacitor: Object.freeze({
        id:'capacitor', icon:'🔶', name:'Микроконденсатор',
        color:'#ffc879', description:'Урон +6% до конца забега'
    }),
    lens: Object.freeze({
        id:'lens', icon:'🔭', name:'Фокусирующая линза',
        color:'#83e9ff', description:'Дальность +7% до конца забега'
    }),
    gyro: Object.freeze({
        id:'gyro', icon:'🌀', name:'Маневровый гироскоп',
        color:'#b4ffa1', description:'Скорость +6% до конца забега'
    })
});

const SPECIAL_FINDS = Object.freeze({
    repair: Object.freeze({
        id:'repair', icon:'💚', name:'Ремонтный контейнер',
        color:'#8effbe', description:'Восстанавливает прочность корпуса'
    }),
    energy: Object.freeze({
        id:'energy', icon:'💠', name:'Энергетический контейнер',
        color:'#8aafff', description:'Немного опыта для следующего уровня'
    })
});

const DROP_ORDER = ['reach','overcharge','rapid','thruster'];
const ALL_FINDS = Object.freeze({
    ...TEMPORARY_BOOSTS, ...FIELD_MODULES, ...SPECIAL_FINDS
});

function tintFor(id) {
    if (id === 'overcharge' || id === 'capacitor') return 'orange';
    if (id === 'rapid') return 'violet';
    if (id === 'thruster' || id === 'gyro' || id === 'repair') return 'green';
    if (id === 'energy') return 'gold';
    return 'cyan';
}

function putPickup(game,id,x,y,source='asteroid',first=false) {
    if (!ALL_FINDS[id] || !Array.isArray(game?.boostPickups)) return null;
    const pickup = {
        id, x, y, age:0, ttl:source === 'field' ? 43 : 24, source
    };
    game.boostPickups.push(pickup);
    game.worldVfx?.boostDrop(x,y,tintFor(id));
    if (source === 'asteroid') {
        game.createFloatingText?.(first ?
            'МОДУЛЬ! Подлетите к кристаллу' : 'МОДУЛЬ!',
            x, y - 44, ALL_FINDS[id].color);
    }
    return pickup;
}

/**
 * Asteroid chance stays separate from roaming finds. The first broken rock
 * guarantees a range booster, then each later rock has a 30% drop chance.
 */
export function spawnTemporaryBoost(game,x,y) {
    if (!game || !Array.isArray(game.boostPickups)) return null;
    const first = !game._firstBoostSpawned;
    if (!first && Math.random() >= .3) return null;
    const id = first ? 'reach' : DROP_ORDER[Math.floor(Math.random()*DROP_ORDER.length)];
    game._firstBoostSpawned = true;
    return putPickup(game,id,x,y,'asteroid',first);
}

/** Separate PRNG: loot does not change the enemy director's seeded sequence. */
function fieldRandom(game) {
    let x = game._fieldFindSeed | 0;
    if (!x) x = 0x5f23ce91;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    game._fieldFindSeed = x;
    return (x >>> 0) / 4294967296;
}

export function resetFieldFinds(game) {
    game._fieldFindClock = 2.75;
    game._fieldFindCount = 0;
    const competitive = game.speedrunMode || game.dailyMode || game.replayActive;
    const base = competitive && game.speedrunRng ?
        game.speedrunRng.state : Math.floor(Math.random()*0xffffffff);
    game._fieldFindSeed = ((base >>> 0) ^ 0x71be8c35) || 0x5f23ce91;
}

function fieldModuleCount(p) {
    return Object.values(p?.fieldModules || {}).reduce((a,b) => a+b, 0);
}

function chooseFieldFind(game) {
    const n = game._fieldFindCount;
    // The first few finds give the weak starting weapon a fighting chance.
    if (n === 0) return 'reach';
    if (n === 1) return 'rapid';
    if (n === 2) return 'capacitor';
    // A pilot who couldn't finish enough enemies gets one visible,
    // collectable route to the first full upgrade instead of a death spiral.
    if (n === 3 && game.player.level < 2) return 'energy';
    const p = game.player;
    const modules = fieldModuleCount(p);
    const wounded = p.hp < p.maxHp * .65;
    const weighted = [
        ['reach',18], ['rapid',18], ['overcharge',16], ['thruster',15],
        ['repair',wounded ? 18 : 3], ['energy',10],
        ['capacitor',modules < 4 && (p.fieldModules?.capacitor || 0) < 2 ? 7 : 0],
        ['lens',modules < 4 && (p.fieldModules?.lens || 0) < 2 ? 7 : 0],
        ['gyro',modules < 4 && (p.fieldModules?.gyro || 0) < 2 ? 7 : 0]
    ];
    const total = weighted.reduce((a,entry) => a+entry[1],0);
    let roll=fieldRandom(game)*total;
    for (const [id,weight] of weighted) {
        roll -= weight;
        if (roll < 0) return id;
    }
    return 'overcharge';
}

/** A reachable location near the player, not inside rocks or another pickup. */
function fieldPosition(game) {
    const p=game.player;
    const width=CONFIG.ARENA_WIDTH, height=CONFIG.ARENA_HEIGHT;
    for (let attempt=0;attempt<20;attempt++) {
        const a=fieldRandom(game)*Math.PI*2;
        const d=(game.gameTime<90 ? 155 : 225) +
            fieldRandom(game)*(game.gameTime<90 ? 175 : 250);
        const x=Math.max(55,Math.min(width-55,p.x+Math.cos(a)*d));
        const y=Math.max(55,Math.min(height-55,p.y+Math.sin(a)*d));
        if (Math.hypot(x-p.x,y-p.y)<115) continue;
        if ((game.worldObstacles||[]).some(o=>!o.destroyed &&
            Math.hypot(o.x-x,o.y-y)<(o.radius||20)+58)) continue;
        if (game.boostPickups.some(o=>Math.hypot(o.x-x,o.y-y)<105)) continue;
        if ((game.enemies||[]).some(e=>Math.hypot(e.x-x,e.y-y)<75)) continue;
        return {x,y};
    }
    return {x:Math.max(55,Math.min(width-55,p.x+175)),
        y:Math.max(55,Math.min(height-55,p.y+100))};
}

/** Runs on game-time, pauses with the game, keeps at most three field finds. */
export function updateFieldFinds(game,dt) {
    if (!game?.player || !Array.isArray(game.boostPickups) || game.tutorial?.active) return;
    game._fieldFindClock -= dt;
    if (game._fieldFindClock > 0) return;
    if (game.boostPickups.filter(p=>p.source==='field').length >= 3) {
        game._fieldFindClock = 4;
        return;
    }
    const id=chooseFieldFind(game);
    const spot=fieldPosition(game);
    putPickup(game,id,spot.x,spot.y,'field');
    game._fieldFindCount++;
    game._fieldFindClock = game._fieldFindCount < 3 ?
        9.5+3*fieldRandom(game) :
        game.gameTime < 90 ? 13+6*fieldRandom(game) : 20+8*fieldRandom(game);
    if (game._fieldFindCount <= 4) {
        const def=ALL_FINDS[id];
        game.createFloatingText?.('НАЙДЕН: '+def.icon+' '+def.name,
            game.player.x,game.player.y-65,def.color);
        game._announce?.('На радаре найден бонус: '+def.name+
            '. Подлетите к светящемуся кристаллу.');
    }
}

function applyFind(game,item) {
    const p=game.player;
    const timed=TEMPORARY_BOOSTS[item.id];
    if (timed) {
        const duration=timed.duration+(item.source==='field' && game.gameTime<90 ? 5 : 0);
        p.activateTemporaryBoost(timed.id,duration);
        return timed.name+' · '+duration+' с';
    }
    if (item.id === 'repair') {
        const missing=p.maxHp-p.hp;
        if (missing<1) {
            p.gainExp(9);
            return 'Полный корпус · +9 энергии';
        }
        const amount=Math.min(missing,Math.round(p.maxHp*.22));
        p.heal(amount);
        return 'Ремонт · +'+Math.round(amount)+' прочности';
    }
    if (item.id === 'energy') {
        const earlyCatchup=item.source==='field' && p.level<2 && game.gameTime<85;
        const amount=earlyCatchup ? Math.max(18,Math.ceil(p.expToNext-p.exp)) :
            12+Math.min(16,p.level*2);
        p.gainExp(amount);
        return 'Энергия · +'+amount+' опыта';
    }
    const module=FIELD_MODULES[item.id];
    if (module) {
        const count=p.fieldModules[item.id]||0;
        if (count<2 && fieldModuleCount(p)<4) {
            p.fieldModules[item.id]=count+1;
            return module.name+' · '+module.description;
        }
        p.gainExp(10);
        return 'Повторный модуль · +10 энергии';
    }
    return '';
}

export function updateTemporaryBoostPickups(game,dt) {
    const p=game?.player;
    if (!p || !Array.isArray(game.boostPickups)) return;
    for (let i=game.boostPickups.length-1;i>=0;i--) {
        const item=game.boostPickups[i];
        item.age+=dt;
        if (item.age>=item.ttl) {
            game.boostPickups.splice(i,1);
            continue;
        }
        const dx=p.x-item.x,dy=p.y-item.y;
        const dist=Math.hypot(dx,dy);
        if (dist<90 && dist>1) {
            const step=Math.min(dist,(100+(90-dist)*2.2)*dt);
            item.x+=dx/dist*step;
            item.y+=dy/dist*step;
        }
        if (Math.hypot(p.x-item.x,p.y-item.y)<=p.size+15) {
            const def=ALL_FINDS[item.id];
            if (!def) {game.boostPickups.splice(i,1);continue;}
            const message=applyFind(game,item);
            game.worldVfx?.boostCollect(item.x,item.y,tintFor(item.id));
            game.createParticles?.(item.x,item.y,def.color,12);
            game.createFloatingText?.(def.icon+' '+message,
                p.x,p.y-54,def.color);
            game._announce?.('Подобрано: '+message);
            game.audio?.pickup?.();
            game.boostPickups.splice(i,1);
        }
    }
}

export function renderTemporaryBoostPickups(ctx,items,gameTime) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
        const def=ALL_FINDS[item.id];
        if (!def) continue;
        const pulse=.85+Math.sin(gameTime*6+item.age*2)*.15;
        const fade=Math.max(0,Math.min(1,(item.ttl-item.age)/3));
        const y=item.y-Math.sin(gameTime*3+item.x)*5;
        ctx.save();
        ctx.translate(item.x,y);
        ctx.globalAlpha=fade;
        const halo=getFXSprite('glow',tintFor(item.id));
        if (halo) {
            ctx.save();
            ctx.globalCompositeOperation='lighter';
            ctx.globalAlpha=fade*.75;
            ctx.drawImage(halo,-41*pulse,-41*pulse,82*pulse,82*pulse);
            ctx.restore();
        }
        ctx.shadowBlur=23*pulse;
        ctx.shadowColor=def.color;
        ctx.fillStyle=def.color;
        ctx.beginPath();
        ctx.moveTo(0,-15);ctx.lineTo(12,0);ctx.lineTo(0,15);
        ctx.lineTo(-12,0);ctx.closePath();ctx.fill();
        ctx.shadowBlur=0;
        ctx.strokeStyle='#fff';
        ctx.lineWidth=2;
        ctx.stroke();
        ctx.globalAlpha=fade*(.45+.25*Math.sin(gameTime*5));
        ctx.strokeStyle=def.color;
        ctx.beginPath();ctx.arc(0,0,23+4*pulse,0,Math.PI*2);ctx.stroke();
        // Permanent field modules get an extra, clearly recognisable ring.
        if (FIELD_MODULES[item.id]) {
            ctx.setLineDash([5,4]);
            ctx.beginPath();ctx.arc(0,0,31,0,Math.PI*2);ctx.stroke();
        }
        ctx.restore();
    }
}
