/** Mission 00's teaching and combat budget. Other sorties use the campaign catalogue. */
import {WEAPONS,PASSIVES,ENEMIES} from './data.js?v=tactics-106';

export const TRAINING_PULSE=Object.freeze({...WEAPONS.STARTER_PULSE,
    name:'Импульсная пушка',baseDamage:14,baseCooldown:.8,baseRange:150,
    description:'Автоматически стреляет по ближайшей видимой цели в радиусе 150. II ранг: два импульса, урон каждого +20%, дальность 165.',
    homing:false,evolveLevel:0});
export const TRAINING_RANGE_CAP=170;
export const TRAINING_LESSONS=Object.freeze(['workshop','forge','command']);
const REPAIR_KIT=Object.freeze({id:'field_repair',name:'Полевой ремонтный комплект',icon:'🔧',maxRank:1,
    description:'Ремонт: 10 деталей вместо 18; прочность орудия +50 вместо +30. Луч действует дальше, ремонт повреждённой техники идёт быстрее.'});

export function buildPrologueSkills(player){
    const definitions=[['weapon',TRAINING_PULSE,2],['passive',PASSIVES.SHIELD_CORE,1],
        ['passive',PASSIVES.MOVESPEED,1],['ability',REPAIR_KIT,1]];
    const nodes=definitions.map(([kind,def,maximum])=>{
        const rank=kind==='weapon'?player.weapons.find(w=>w.id===def.id)?.level||0:
            kind==='ability'?player.fieldSkills?.[def.id]||0:player.passives?.[def.id]?.count||0;
        const reason=kind==='weapon'&&!rank?'Сначала установите пушку в оружейном отсеке':
            rank>=maximum?'Улучшение установлено':'';
        return {id:def.id,kind,def,tier:0,rank,maximum,parents:[],fork:false,
            specialization:null,futurePaths:null,nextRank:Math.min(maximum,rank+1),branchId:'prologue',
            reason,state:rank>=maximum?'maxed':reason?'locked':'available'};
    });
    return {mode:'prologue',cap:2,branches:[{id:'prologue',title:'Оснащение корвета',tiers:[nodes]}],
        available:nodes.filter(n=>n.state==='available')};
}

export const PROLOGUE_TURRETS=Object.freeze({
    sentry:Object.freeze({range:325,damage:12,cooldown:1.45,heat:23}),
    heavy:Object.freeze({range:365,damage:18,cooldown:1.65,heat:27})
});
export function prologueTurretProfile(base){
    return base?.id?.startsWith('prologue-')?
        PROLOGUE_TURRETS[base.id.includes('heavy')?'heavy':'sentry']:null;
}

export const COMMAND_GUARD=Object.freeze({...ENEMIES.GOLEM,
    name:'Архивный страж',hp:96,shieldHp:28,damageReduction:.2,speed:52,damage:14});
export const LIGHT_GUARD=Object.freeze({...ENEMIES.BAT,name:'Охранник сопровождения',hp:38,speed:88,damage:8});
const SIEGE_TYPES=Object.freeze({
    core:Object.freeze({...ENEMIES.ZOMBIE,id:'core_breaker',name:'Взломщик ядра',hp:90,speed:70,damage:12}),
    hunt:Object.freeze({...ENEMIES.BAT,id:'core_hunter',name:'Перехватчик корвета',hp:42,speed:108,damage:9}),
    fire:Object.freeze({...ENEMIES.SNIPER,id:'core_suppressor',name:'Подавитель',hp:56,speed:72,damage:7,
        aimTime:.9,fireCooldown:3.1,firingRange:285,keepDistance:185,projectileDamage:7,projectileSpeed:225})
});
export const SIEGE_DURATION=54;
// Three readable attacks with space to repair and reposition between them.
export const SIEGE_PLAN=Object.freeze([2,19,36].flatMap((at,packet)=>
    ['core','hunt','fire','core','hunt'].map((duty,index)=>Object.freeze({
        at:at+index*1.1,packet,duty,type:SIEGE_TYPES[duty],
        side:packet===1?-1:packet===2?(index%2?-1:1):1,
        lane:[-270,220,0,260,-180][index]
    }))));

export function foundryHazard(age,lane){
    if(!Number.isFinite(age)||age<2)return 'idle';
    const phase=(age-2+lane*2.7)%6.4;
    return phase<1.2?'warning':phase<2.25?'active':'idle';
}
