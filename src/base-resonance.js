/**
 * Resonance 9.0 — per-sortie engineering knowledge for stations of one type.
 * The first original construction is full price. Live compatible stations
 * broadcast already mastered modules; no stacked or cross-type discounts.
 * Pure gameplay functions, shared by the dock, galaxy chart and world renderer.
 */
export const RESONANCE_RATES = Object.freeze({
    firstTurret: .10,
    additionalTurret: .25,
    turretUpgrade: .35,
    advancedTurretUpgrade: .50,
    specialization: .50,
    extension: .40,
    hangar: .40,
    stasisUpgrade: .50,
    stasisMode: .50,
    escortUpgrade: .50
});

const alive=base=>!!(base?.activated&&base.hp>0);
const turretIndex=(base,mount)=>base.turrets.findIndex(t=>t.mount===Number(mount));
const normalizeStep=(base,suffix,rate,label,test)=>({
    key:base.type+'/'+suffix,rate,label,test
});

/** Returns a unique step and a predicate proving the source has built it. */
export function resonanceStep(base,item,option='') {
    if(!base?.type)return null;
    const count=base.turrets?.length||0;
    if(item==='turret'){
        const ordinal=count+1;
        return normalizeStep(base,'turret/'+ordinal,
            ordinal===1?RESONANCE_RATES.firstTurret:RESONANCE_RATES.additionalTurret,
            ordinal===1?'первая турель':'турель №'+ordinal,
            source=>(source.turrets?.length||0)>=ordinal);
    }
    if(item==='extension'){
        const next=(base.sockets||1)+1;
        return normalizeStep(base,'extension/'+next,RESONANCE_RATES.extension,
            'секция №'+next,source=>(source.sockets||1)>=next);
    }
    if(item==='upgradeTurret'||item==='specialize'){
        const [mount,branch]=item==='specialize'
            ?String(option).split(':'):[option,null];
        const index=turretIndex(base,mount);
        if(index<0)return null;
        const turret=base.turrets[index];
        const ordinal=index+1;
        if(item==='specialize'){
            if(!['arc','missile','rail'].includes(branch))return null;
            return normalizeStep(base,'turret/'+ordinal+'/path/'+branch,
                RESONANCE_RATES.specialization,'специализация '+branch,
                source=>source.turrets?.[index]?.path===branch);
        }
        const targetLevel=turret.level+1;
        if(targetLevel>5)return null;
        return normalizeStep(base,'turret/'+ordinal+'/level/'+targetLevel,
            targetLevel>=4?RESONANCE_RATES.advancedTurretUpgrade:
                RESONANCE_RATES.turretUpgrade,
            'турель №'+ordinal+' · ур. '+targetLevel,
            source=>(source.turrets?.[index]?.level||0)>=targetLevel);
    }
    if(item==='hangar'){
        const level=(base.hangarTier||0)+1;
        return normalizeStep(base,'hangar/'+level,RESONANCE_RATES.hangar,
            'ангар · секция '+level,source=>(source.hangarTier||0)>=level);
    }
    if(item==='stasisUpgrade'){
        const level=(base.defense?.level||0)+1;
        return normalizeStep(base,'stasis/'+level,RESONANCE_RATES.stasisUpgrade,
            'защитный модуль · ур. '+level,source=>(source.defense?.level||0)>=level);
    }
    if(item==='stasisMode'){
        const mode=String(option);
        if(!['pulse','cryo'].includes(mode))return null;
        return normalizeStep(base,'stasis/mode/'+mode,RESONANCE_RATES.stasisMode,
            'защитный режим · '+mode,source=>source.defense?.mode===mode);
    }
    if(item==='escortUpgrade'){
        const branch=String(option);
        if(!['hull','engine','gun'].includes(branch))return null;
        const level=(base.escortUpgrades?.[branch]||0)+1;
        return normalizeStep(base,'escort/'+branch+'/'+level,
            RESONANCE_RATES.escortUpgrade,'эскадра · '+branch+' '+level,
            source=>(source.escortUpgrades?.[branch]||0)>=level);
    }
    return null;
}

/**
 * Quoting never changes credits. Discount requires a known, originally
 * researched step AND a different living active station of this type.
 */
export function resonanceQuote(base,bases,knownSteps,item,option,baseCost){
    const step=resonanceStep(base,item,option);
    const result={cost:baseCost,baseCost,step,source:null,
        rate:1,discounted:false,saved:0};
    if(!step||!alive(base)||!Number.isFinite(baseCost)||
        !knownSteps?.has(step.key))return result;
    const candidates=(bases||[]).filter(other=>
        other!==base&&other.id!==base.id&&other.type===base.type&&
        alive(other)&&step.test(other));
    if(!candidates.length)return result;
    candidates.sort((a,b)=>Math.hypot(a.x-base.x,a.y-base.y)-
        Math.hypot(b.x-base.x,b.y-base.y));
    result.source=candidates[0];
    result.rate=step.rate;
    result.cost=Math.max(1,Math.ceil(baseCost*step.rate));
    result.saved=baseCost-result.cost;
    result.discounted=result.saved>0;
    return result;
}

/**
 * A shortest-to-existing-station tree for each kind of base. Every active
 * node is connected without a distance limit; at most N-1 world beams.
 */
export function resonanceLinks(bases){
    const types=new Map(),links=[];
    for(const base of bases||[]){
        if(!alive(base))continue;
        if(!types.has(base.type))types.set(base.type,[]);
        types.get(base.type).push(base);
    }
    for(const sameType of types.values()){
        sameType.sort((a,b)=>(a.activationTime||0)-(b.activationTime||0)||
            String(a.id).localeCompare(String(b.id)));
        for(let i=1;i<sameType.length;i++){
            const to=sameType[i];
            let from=sameType[0],nearest=Infinity;
            for(let j=0;j<i;j++){
                const candidate=sameType[j];
                const d=Math.hypot(to.x-candidate.x,to.y-candidate.y);
                if(d<nearest){nearest=d;from=candidate;}
            }
            links.push({from,to,type:to.type});
        }
    }
    return links;
}
