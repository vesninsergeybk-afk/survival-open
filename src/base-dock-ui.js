/**
 * Base dock 8.6: modular station engineering with interactive turret blueprint.
 * One delegated click handler, all pricing and validation live in FriendlyBases.
 */
import { drawStationPart, STATION_PARTS } from './station-art.js?v=base-86';
import { baseDevelopmentOptions } from './base-development.js?v=progression-1';

const DIRECTIONS=['↑ Север','↗ С.-восток','→ Восток','↘ Ю.-восток',
    '↓ Юг','↙ Ю.-запад','← Запад','↖ С.-запад'];
const escapeText=s=>String(s).replace(/[&<>"]/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'
}[c]));
export class BaseDockUI {
    constructor(game){
        this.game=game;this.modal=document.getElementById('baseDock');
        this.base=null;this.mount=0;this.notice='';
        this.justActivated=false;this.activationTimer=null;
        this.modal?.addEventListener('click',e=>{
            const btn=e.target.closest?.('[data-dock-action]');
            if(!btn||btn.disabled)return;
            const action=btn.dataset.dockAction;
            if(action==='close'){this.game.closeBaseDock();return;}
            if(action==='finishStartup'){
                this.justActivated=false;
                if(this.activationTimer)clearTimeout(this.activationTimer);
                this.activationTimer=null;
                this.render();return;
            }
            if(action==='mount'){
                this.mount=Math.min(7,Math.max(0,Number(btn.dataset.mount)||0));
                this.notice='';this.render();
                this.modal?.querySelector('[data-dock-action="mount"][data-mount="'+this.mount+'"]')
                    ?.focus({preventScroll:true});
                return;
            }
            const path=btn.dataset.branch||'';
            const network=this.game.friendlyBases;
            // Snapshot *before* the purchase: a second powered station of
            // this type closes a real resonance link after startup.
            const soundContext={
                action,type:this.base.type,branch:path,
                firstBranch:action==='baseDevelopment' &&
                    (this.base.development?.[path]||0)===0,
                sameTypePeer:action==='activate'&&network.bases.some(b=>
                    b!==this.base&&b.type===this.base.type&&b.activated&&b.hp>0)
            };
            const techBefore=network.technologyTier;
            const result=network.buy(this.game,this.base,action,this.mount,path);
            if(result.ok) this.game.audio?.baseAction({
                ...soundContext,
                discounted:result.discounted,
                techUnlocked:network.technologyTier>techBefore
            });
            this.notice=result.message;
            if(action==='activate'&&result.ok){
                this.justActivated=true;
                this.render();
                if(this.activationTimer)clearTimeout(this.activationTimer);
                const openedBase=this.base;
                this.activationTimer=setTimeout(()=>{
                    if(this.base===openedBase&&this.justActivated){
                        this.justActivated=false;
                        this.render();
                    }
                    this.activationTimer=null;
                },2850);
            }else this.render();
        });
    }
    open(base){
        if(!this.modal||!base)return;
        this.base=base;this.notice='';this.justActivated=false;
        const angle=Math.atan2(this.game.player.y-base.y,
            this.game.player.x-base.x);
        this.mount=((Math.round((angle+Math.PI/2)/(Math.PI/4))%8)+8)%8;
        this.modal.style.display='flex';this.render();
        this.modal.querySelector('[data-dock-action="close"]')?.focus();
    }
    close(){
        if(this.modal)this.modal.style.display='none';
        this.base=null;this.notice='';this.justActivated=false;
        if(this.activationTimer)clearTimeout(this.activationTimer);
        this.activationTimer=null;
    }
    render(){
        // Preserve the user's position in this long workshop. Rebuilding the
        // hologram after clicking a port must never jump back to the heading.
        const scrollTop=this.modal?.querySelector('.dock-card')?.scrollTop||0;
        const base=this.base,network=this.game.friendlyBases;
        if(!base||!this.modal)return;
        const info=network.typeInfo(base);
        const p=this.game.player,credits=network.credits;
        const turret=base.turrets.find(t=>t.mount===this.mount);
        const have=base.turrets.length,slots=base.sockets;
        const max=info.maxTurrets;
        const buy=(action,title,cost,can,description,branch='')=>{
            const quoteOption=action==='upgradeTurret'?this.mount:
                action==='specialize'?this.mount+':'+branch:branch;
            const quote=network.resonanceQuote(base,action,quoteOption);
            let priceText=cost+' ⚙';
            if(quote.discounted){
                cost=quote.cost;
                priceText='<del>'+quote.baseCost+'</del> '+cost+' ⚙';
                const donor=network.typeInfo(quote.source).name;
                description='🔗 СОПРЯЖЕНИЕ · экономия '+quote.saved+
                    ' ⚙ · источник: '+donor+' · '+description;
                title+=' (−'+Math.round((1-quote.rate)*100)+'%)';
            }
            const disabled=(!can||credits<cost||!Number.isFinite(cost));
            return '<button class="dock-shop-item" type="button" data-dock-action="'+
                action+'"'+(branch?' data-branch="'+branch+'"':'')+
                (disabled?' disabled':'')+'><strong>'+title+
                ' <span>'+priceText+'</span></strong><small>'+
                description+'</small></button>';
        };
        const maxText=level=>level>=3?'МАКСИМУМ':level+'/3';
        let html='<section class="overlay-card dock-card" role="document">'+
            '<div class="dock-heading"><div class="dock-kicker">КОСМИЧЕСКИЙ АВАНПОСТ</div>'+
            '<button class="dock-close" type="button" data-dock-action="close" aria-label="Выйти из мастерской">×</button></div>'+
            '<h2 class="dock-title">'+info.icon+' '+info.name+'</h2>'+
            '<div class="dock-stats"><span>⚙ Кредиты: <strong>'+credits+
            '</strong></span><span>🛡 Корабль: <strong>'+Math.ceil(p.hp)+
            '/'+Math.ceil(p.maxHp)+'</strong></span><span>🎯 Турели: '+
            have+'/'+slots+'</span><span>⚡ Технологии: '+network.technologyTier+'/3</span></div>';
        if(!base.activated){
            const cost=network.price(base,'activate');
            html+='<div class="dock-activation"><div class="dock-reactor">◉</div>'+
                '<h3>РЕАКТОР НЕАКТИВЕН</h3>'+
                '<p>Запустите питание, чтобы открыть мастерские, оборону и технологии. '+
                'Первая станция активируется бесплатно. За активацию вы получите опыт, кредиты и сигнал следующей базы. '+
                'Открытые технологии останутся с вами, даже если база погибнет.</p>'+
                buy('activate','⚡ Активировать станцию',cost,true,
                    'Откроет улучшения оружия до '+Math.min(5,network.getUpgradeCap()+1)+
                    '-го уровня, если сеть ещё не достигла максимума')+
                '</div><p class="dock-feedback" role="status">'+
                escapeText(this.notice||'Станция обнаружена. Питание отключено.')+
                '</p><button class="btn primary dock-exit" type="button" '+
                'data-dock-action="close">Вернуться в космос</button></section>';
            this.modal.innerHTML=html;return;
        }
        const sameType=network.bases.filter(other=>other!==base&&
            other.type===base.type&&other.activated&&other.hp>0);
        const resonanceText=sameType.length
            ?'🔗 Сопряжение активно: '+sameType.length+' однотипных станций. '+
                'Освоенные постройки дешевле на 50–90%. '
            :'🔗 Сопряжение ожидает вторую действующую станцию этого вида. ';
        const research={dock:'Укрепление корпуса и ремонт',
            carrier:'Боевые спутники и ведомые',
            arsenal:'Ракетные установки и гравиминное вооружение',
            lab:'Электроразряды и криоимпульсы',
            outpost:'Сканирование и дальнее обнаружение'}[base.type];
        if(this.justActivated){
            html+='<div class="dock-startup" role="status" aria-live="polite">'+
                '<div class="dock-startup-visual" aria-hidden="true">'+
                '<div class="dock-startup-ring ring-a"></div>'+
                '<div class="dock-startup-ring ring-b"></div>'+
                '<div class="dock-startup-ring ring-c"></div>'+
                '<div class="dock-startup-core">✦</div>'+
                '<span class="dock-power-node n1"></span>'+
                '<span class="dock-power-node n2"></span>'+
                '<span class="dock-power-node n3"></span>'+
                '<span class="dock-power-node n4"></span>'+
                '<span class="dock-power-node n5"></span>'+
                '<span class="dock-power-node n6"></span></div>'+
                '<h3>РЕАКТОР ЗАПУЩЕН</h3>'+
                '<p>Восстанавливается энергосистема · Подключаются оборонные секции · '+
                'Технологическая сеть '+network.technologyTier+'/3</p>'+ 
                '<p>'+resonanceText+'</p>'+
                '<button class="btn primary" type="button" data-dock-action="finishStartup">'+
                'Открыть мастерскую</button></div></section>';
            this.modal.innerHTML=html;
            return;
        }
        html+='<div class="dock-network-note">🟢 СТАНЦИЯ АКТИВНА · '+
            'Текущий предел оружия и модулей: '+network.getUpgradeCap()+'/5. '+
            (network.technologyTier<3?
                'Для следующего этапа найдите и запустите ещё одну базу.':
                'Все технологические уровни открыты.')+
            '<br>🧭 Разведка и запуск новых станций дают опыт. '+
            'Оборона здесь добровольна: корабль и ведомые могут улететь дальше.'+
            '<br>'+resonanceText+
            '<br>🔬 Специализация: '+research+'</div>';
        const departments=baseDevelopmentOptions(base,network);
        html+='<div class="dock-section-title">ДЕРЕВО РАЗВИТИЯ СТАНЦИИ</div>'+
            '<p class="dock-note">Три направления: оборона, исследования, логистика. '+
            'Первый выбранный модуль за миссию бесплатен. '+
            'Продолжение ветвей зависит от реакторов и допуска миссии. '+
            'Построенные улучшения работают в текущем вылете.</p>'+
            '<div class="dock-shop-grid dock-development-grid">'+
            departments.map(path=>{
                const heading=path.icon+' '+path.name+' · '+path.rank+'/3';
                if(path.state==='maxed')
                    return '<div class="dock-development-done"><strong>'+
                        heading+'</strong><small>Ветвь освоена полностью.</small></div>';
                return buy('baseDevelopment',heading,path.price,
                    path.state==='available',
                    path.nextEffect+(path.reason?' · '+path.reason:'')+
                    ' · '+path.summary,path.id);
            }).join('')+'</div>';
        html+='<div class="dock-section-title">РЕМОНТ И ОБСЛУЖИВАНИЕ</div>'+
            '<div class="dock-shop-grid">'+
            buy('repair','💚 Ремонт +'+Math.round(info.repair*100)+'%',
                network.price(base,'repair'),p.hp<p.maxHp-.5,
                info.repair<=.05?'Небольшой запас запасных частей':
                'Восстановить корпус корабля')+
            '</div>';
        const shield=base.defense;
        const shieldCap=36+shield.level*22;
        const shieldState=shield.active>0
            ?'🔵 Стазис активен · резерв '+Math.ceil(shield.reserve)
            :shield.cooldown>0
                ?'🟠 Перезарядка '+Math.ceil(shield.cooldown)+' с'
                :'🟢 Аварийный щит готов';
        html+='<div class="dock-section-title">АВАРИЙНАЯ ЗАЩИТА · СТАЗИС</div>'+
            '<p class="dock-note">'+shieldState+
            ' · вместимость '+shieldCap+
            ' · турели отключаются на время работы щита.'+
            ' Поле пробивается сильным обстрелом.</p>';
        if(shield.level<info.defenseMax){
            html+='<div class="dock-shop-grid">'+
                buy('stasisUpgrade','🛡️ Усилить стазис',
                    network.price(base,'stasisUpgrade'),true,
                    'Уровень '+(shield.level+1)+'/'+info.defenseMax+
                    ' · больше резерв и длительность')+'</div>';
        }
        if(shield.level>=1&&!shield.mode){
            html+='<div class="dock-section-title">ОТВЕТ ПРИ СРАБАТЫВАНИИ ЩИТА</div>'+
                '<div class="dock-shop-grid">'+
                info.responses.map(k=>buy('stasisMode',
                    k==='cryo'?'❄️ Криогенная волна':'⚡ Электроимпульс',
                    network.price(base,'stasisMode',k),true,
                    k==='cryo'?'Короткое замедление врагов, боссы устойчивее':
                        'Небольшой урон и сбой движения вокруг базы',k)).join('')+
                '</div>';
        } else if(shield.mode){
            html+='<p class="dock-note">'+(shield.mode==='cryo'?
                '❄️ Криоволна':'⚡ Ответный импульс')+
                ' · автоматически срабатывает вместе со стазисом.</p>';
        }
        html+='<div class="dock-section-title">ОБОРОНА · КОНСТРУКТОР СТАНЦИИ</div>'+
            '<p class="dock-note">Нажмите на светящуюся точку корпуса, чтобы выбрать место турели. '+
            'Установленные орудия показаны прямо на схеме.</p>'+
            this._schematicHtml(base,info);
        if(turret){
            const state=turret.overheat>0?'🔴 Перегрев · '+turret.overheat.toFixed(1)+' с':
                turret.heat>65?'🟠 Нагрев '+Math.round(turret.heat)+'%':
                '🟢 Работает · нагрев '+Math.round(turret.heat)+'%';
            const branch=turret.path?
                {arc:'⚡ Электродуга',rail:'🎯 Рельсотрон',
                    missile:'🚀 Ракетная батарея'}[turret.path]:'Базовое орудие';
            html+='<div class="dock-turret-detail"><strong>Турель '+DIRECTIONS[this.mount]+
                ' · уровень '+turret.level+'/5</strong>'+
                '<span>'+branch+'</span><small>'+state+'</small></div>';
            if(turret.level===2&&!turret.path){
                html+='<p class="dock-note">Выберите один из трёх путей развития.</p>'+
                    '<div class="dock-shop-grid">'+
                    buy('specialize','⚡ Электродуга',network.price(base,'specialize',this.mount+':arc'),true,'Цепной урон и замедление','arc')+
                    buy('specialize','🚀 Ракеты',network.price(base,'specialize',this.mount+':missile'),true,'Взрывной урон по группам','missile')+
                    buy('specialize','🎯 Рельсотрон',network.price(base,'specialize',this.mount+':rail'),true,'Бронебойное оружие','rail')+
                    '</div>';
            }else if(turret.level<5){
                const cost=network.price(base,'upgradeTurret',this.mount);
                html+='<div class="dock-shop-grid">'+
                    buy('upgradeTurret','⬆ Улучшить турель',cost,true,
                        'Уровень '+(turret.level+1)+' · больше урона и дальности')+
                    '</div>';
            }
        }else{
            html+='<div class="dock-shop-grid">'+
                buy('turret','🔧 Построить турель',network.price(base,'turret'),
                    have<slots,'Орудие прикрывает выбранный сектор')+
                '</div>';
        }
        if(slots<max)html+='<div class="dock-shop-grid dock-extension">'+
            buy('extension','🏗️ Дополнительная секция',
                network.price(base,'extension'),have>=slots,
                'Новое место для турели · '+(slots+1)+'/'+max)+
            '</div>';
        if(info.fleet){
            const owned=network.allies.filter(a=>a.homeId===base.id).length;
            html+='<div class="dock-section-title">АНГАР · ВЕДОМЫЕ '+
                owned+'/'+base.hangarCapacity+'</div>'+
                '<div class="dock-shop-grid">'+
                buy('escort','🛸 Нанять истребитель',
                    network.price(base,'escort'),owned<base.hangarCapacity,
                    'Самостоятельный корабль с уклонением')+
                (base.hangarCapacity<info.hangarMax?buy('hangar','🏗️ Расширить ангар',
                    network.price(base,'hangar'),true,
                    'Дополнительное место для ведомого'):'')+
                '</div><div class="dock-section-title">РАЗВИТИЕ ЭСКАДРЫ</div>'+
                '<div class="dock-shop-grid">'+
                ['hull','engine','gun'].map(k=>{
                    const names={hull:'🛡 Броня',engine:'🔥 Двигатели',gun:'🔫 Оружие'};
                    return buy('escortUpgrade',names[k],
                        network.price(base,'escortUpgrade',k),
                        base.escortUpgrades[k]<3,
                        'Уровень '+maxText(base.escortUpgrades[k]),k);
                }).join('')+'</div>';
        }
        if(info.escorts&&!info.fleet) {
            const owned=network.allies.filter(a=>a.homeId===base.id).length;
            html+='<div class="dock-section-title">МАЛЫЙ АНГАР · РАЗВЕДЧИК '+owned+'/1</div>'+
                '<div class="dock-shop-grid">'+
                buy('escort','🛰️ Нанять разведчика',
                    network.price(base,'escort'),owned<1,
                    'Один быстрый и уязвимый ведомый. Урон ниже, чем у авианосца.')+
                '</div>';
        }
        if(info.shipShop){
            const upgrades=network.shipUpgrades;
            const available=base.type==='lab'?['range','fireRate']:['damage','fireRate'];
            html+='<div class="dock-section-title">'+
                (base.type==='lab'?'ИССЛЕДОВАНИЯ КОРАБЛЯ':'ВООРУЖЕНИЕ КОРАБЛЯ')+
                '</div><div class="dock-shop-grid">'+
                available.map(k=>{
                    const names={damage:'⚔️ Урон +9%',range:'🔭 Дальность +8%',
                        fireRate:'❄️ Быстрота стрельбы +7%'};
                    return buy('shipUpgrade',names[k],
                        network.price(base,'shipUpgrade',k),
                        upgrades[k]<3,'Уровень '+maxText(upgrades[k]),k);
                }).join('')+'</div>';
        }
        if(!info.escorts&&!info.shipShop)
            html+='<p class="dock-note">Это оборонительный пункт. Здесь нет боевого ангара или мастерской вооружения.</p>';
        html+='<p class="dock-feedback" role="status" aria-live="polite">'+
            escapeText(this.notice||'Выберите постройку или улучшение.')+'</p>'+
            '<button class="btn primary dock-exit" type="button" data-dock-action="close">Вернуться в космос</button></section>';
        this.modal.innerHTML=html;
        const card=this.modal.querySelector('.dock-card');
        if(card)card.scrollTop=scrollTop;
        this._paintBlueprint(base,info);
    }

    _schematicHtml(base,info){
        const slotsFree=base.turrets.length<base.sockets;
        const nodes=DIRECTIONS.map((label,i)=>{
            const t=base.turrets.find(t=>t.mount===i);
            const a=(i-2)*Math.PI/4;
            const x=(50+37*Math.cos(a)).toFixed(2);
            const y=(50+37*Math.sin(a)).toFixed(2);
            const state=t?' armed':slotsFree?' free':' future';
            const selected=i===this.mount?' selected':'';
            const symbol=t?(t.path==='arc'?'⚡':t.path==='rail'?'🎯':
                t.path==='missile'?'🚀':'✦'):'＋';
            const detail=t?' · орудие ур. '+t.level:
                slotsFree?' · свободное крепление':' · требуется секция';
            return '<button type="button" class="dock-node'+state+selected+
                '" data-dock-action="mount" data-mount="'+i+
                '" style="left:'+x+'%;top:'+y+'%" aria-pressed="'+(i===this.mount)+
                '" aria-label="'+escapeText(label+detail)+'" title="'+
                escapeText(label+detail)+'"><span class="dock-node-symbol">'+symbol+
                '</span>'+(t?'<span class="dock-node-level">'+t.level+'</span>':'')+
                '</button>';
        }).join('');
        const t=base.turrets.find(t=>t.mount===this.mount);
        const description=t?'Установлена турель '+t.level+'/5'+
            (t.path?' · '+{arc:'Электродуга',missile:'Ракеты',rail:'Рельсотрон'}[t.path]:''):
            slotsFree?'Точка свободна · здесь можно построить орудие':
                'Для установки здесь нужна дополнительная секция';
        return '<div class="dock-blueprint">'+
            '<div class="dock-blueprint-top">'+
            '<span>▣ ГОЛОГРАФИЧЕСКАЯ СХЕМА</span>'+
            '<span>'+base.turrets.length+'/'+info.maxTurrets+' ОРУДИЙ</span></div>'+
            '<div class="dock-blueprint-scene" role="group" aria-label="Карта восьми мест для турелей">'+
            '<canvas class="dock-blueprint-canvas" width="480" height="480" aria-hidden="true"></canvas>'+
            nodes+
            '<div class="dock-blueprint-core-label" aria-hidden="true">РЕАКТОР</div>'+
            '</div><div class="dock-blueprint-foot">'+
            '<strong>Сектор: '+DIRECTIONS[this.mount]+'</strong><span>'+
            description+'</span></div>'+
            '<div class="dock-blueprint-legend"><span>🟡 Выбрано</span>'+
            '<span>🔷 Свободно</span><span>🟢 Орудие</span>'+
            '<span>⚫ Требуется секция</span></div></div>';
    }

    _paintBlueprint(base,info){
        const canvas=this.modal?.querySelector('.dock-blueprint-canvas');
        const ctx=canvas?.getContext('2d');
        if(!ctx)return;
        const c=240,TAU=Math.PI*2;
        const color=info.color||'#66dff1';
        ctx.clearRect(0,0,480,480);
        const bg=ctx.createRadialGradient(c,c,20,c,c,240);
        bg.addColorStop(0,'#1b52687a');
        bg.addColorStop(.65,'#0c2949');
        bg.addColorStop(1,'#06182c');
        ctx.fillStyle=bg;ctx.fillRect(0,0,480,480);
        ctx.lineWidth=1;
        for(let p=0;p<480;p+=24){
            ctx.strokeStyle=p===240?'#94ffff55':'#6dd6ef1c';
            ctx.beginPath();ctx.moveTo(p,0);ctx.lineTo(p,480);ctx.stroke();
            ctx.beginPath();ctx.moveTo(0,p);ctx.lineTo(480,p);ctx.stroke();
        }
        ctx.save();ctx.translate(c,c);
        ctx.strokeStyle='#69cfea40';ctx.lineWidth=1.5;
        ctx.setLineDash([5,10]);
        for(const r of [86,135,183]){
            ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();
        }
        ctx.setLineDash([]);
        // The selected turret shows its 52° sector of fire.
        const a=(this.mount-2)*Math.PI/4;
        ctx.fillStyle='#f7bf5530';ctx.strokeStyle='#ffd583a0';
        ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,199,a-.46,a+.46);
        ctx.closePath();ctx.fill();ctx.stroke();
        for(let i=0;i<8;i++){
            const ray=(i-2)*Math.PI/4;
            ctx.strokeStyle=base.turrets.some(t=>t.mount===i)?
                '#5fffd680':'#87a6c345';
            ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(Math.cos(ray)*62,Math.sin(ray)*62);
            ctx.lineTo(Math.cos(ray)*155,Math.sin(ray)*155);ctx.stroke();
        }
        ctx.restore();
        // Reuse the exact game atlas: the tactical view matches the model
        // actually visible after construction on the battlefield.
        if(!drawStationPart(ctx,STATION_PARTS[info.sprite],c,c,188)){
            ctx.fillStyle='#245776';ctx.strokeStyle=color;ctx.lineWidth=3;
            ctx.beginPath();ctx.arc(c,c,74,0,TAU);ctx.fill();ctx.stroke();
        }
        for(const turret of base.turrets){
            const a=(turret.mount-2)*Math.PI/4;
            const x=c+Math.cos(a)*118,y=c+Math.sin(a)*118;
            const art=turret.path==='arc'?STATION_PARTS.arc:
                turret.path==='missile'?STATION_PARTS.missile:
                turret.path==='rail'?STATION_PARTS.rail:
                turret.level>1?STATION_PARTS.turretIdle:STATION_PARTS.basic;
            drawStationPart(ctx,STATION_PARTS.bridge,
                c+Math.cos(a)*73,c+Math.sin(a)*73,100,a);
            drawStationPart(ctx,art,x,y,67,a-Math.PI/2);
        }
        ctx.save();ctx.shadowColor=color;ctx.shadowBlur=22;
        ctx.fillStyle=color;ctx.beginPath();ctx.arc(c,c,10,0,TAU);ctx.fill();
        ctx.restore();
        // Cargo-bay markings and coordinate readout.
        ctx.fillStyle='#83c9df';ctx.font='700 12px system-ui';
        ctx.fillText('N',c-5,30);ctx.fillText('S',c-4,465);
        ctx.fillText('W',19,c+4);ctx.fillText('E',451,c+4);
        ctx.fillStyle='#83c9df9b';ctx.font='500 11px monospace';
        ctx.fillText(base.type.toUpperCase()+' / TURRET LAYOUT',14,20);
    }
}
