/**
 * Combat director: readable, avoidable danger independent of the enemy wave RNG.
 * A stationary pilot receives an escalating orbital lock; meteor salvos create
 * periodic movement decisions. Timers use game-time, so pause/replay stay safe.
 */
import { atlas } from './asset-art.js?v=space-1';

export class CombatDirector {
    constructor() { this.reset(); }
    reset() {
        this.zones = [];
        this.anchor = null;
        this.campSeconds = 0;
        this.campCooldown = 0;
        this.campStrikes = 0;
        this.stormCooldown = 28;
    }
    addZone(x, y, radius, fuse, damage, kind = 'orbital') {
        if (this.zones.length >= 9) this.zones.shift();
        this.zones.push({ x, y, radius, fuse, total: fuse, damage, kind, blast: 0 });
    }
    /**
     * Combined, frame-stable danger field for overlapping orbital markers.
     * Weighted repulsion is continuous at zone boundaries; when symmetric
     * hazards cancel, try eight escape headings and select the safest.
     */
    avoidanceVector(x, y, size = 16, phase = 0) {
        const active=[];
        let sumX=0,sumY=0,total=0,strongest=null;
        for(const zone of this.zones) {
            if(zone.blast>0 || zone.fuse<=0 || zone.fuse>1.65)continue;
            const dx=x-zone.x,dy=y-zone.y;
            const d=Math.hypot(dx,dy);
            const reach=zone.radius+size+108;
            if(d>=reach)continue;
            const closeness=(reach-d)/reach;
            const urgency=1-Math.min(1,zone.fuse/1.65);
            const weight=(.2+closeness*closeness*1.4)*(0.8+urgency*.55);
            const angle=phase+zone.x*.0001+zone.y*.0002;
            const ux=d>1?dx/d:Math.cos(angle);
            const uy=d>1?dy/d:Math.sin(angle);
            sumX+=ux*weight;sumY+=uy*weight;total+=weight;
            const candidate={x:ux,y:uy,weight,reach,zone};
            active.push(candidate);
            if(!strongest||weight>strongest.weight)strongest=candidate;
        }
        if(!active.length)return null;
        let length=Math.hypot(sumX,sumY);
        if(active.length>1 && length<total*.38) {
            // Opposite warnings: stay on a route that clears BOTH markers.
            let bestScore=Infinity,bestX=strongest.x,bestY=strongest.y;
            for(let k=0;k<12;k++) {
                const a=(k/12)*Math.PI*2+phase*.17;
                const ux=Math.cos(a),uy=Math.sin(a);
                const nx=x+ux*130,ny=y+uy*130;
                let score=0;
                for(const c of active) {
                    const d=Math.hypot(nx-c.zone.x,ny-c.zone.y);
                    const penetration=Math.max(0,c.reach-d);
                    score+=penetration*penetration*(.5+c.weight);
                }
                if(score<bestScore){bestScore=score;bestX=ux;bestY=uy;}
            }
            sumX=bestX;sumY=bestY;length=1;
        }
        if(length<.001){sumX=strongest.x;sumY=strongest.y;length=1;}
        const intensity=Math.min(1,.38+total*.5);
        return {x:sumX/length,y:sumY/length,intensity};
    }
    update(dt, game) {
        const p = game.player;
        if (!p || p.dead) return;
        if (!this.anchor) this.anchor = { x: p.x, y: p.y };
        const sheltered=game.friendlyBases?.isMeteorSheltered?.(p) || false;
        if (sheltered) {
            // Stations prevent targeted orbital locks from repeatedly
            // punishing pilots for using their repair and upgrade facilities.
            this.anchor={x:p.x,y:p.y};
            this.campSeconds=0;this.campStrikes=0;
        } else if (Math.hypot(p.x - this.anchor.x, p.y - this.anchor.y) > 115) {
            this.anchor = { x: p.x, y: p.y };
            this.campSeconds = 0;
            this.campStrikes = 0;
        } else {
            this.campSeconds += dt;
        }
        this.campCooldown = Math.max(0, this.campCooldown - dt);
        if (!sheltered && game.gameTime > 10 && this.campSeconds >= 7.5 && this.campCooldown === 0) {
            const power = (25 + this.campStrikes * 12 + Math.floor(game.gameTime / 75) * 5)
                * (game.enemyDmgMult || 1);
            this.addZone(p.x, p.y, 92, 1.6, power, 'lock');
            this.campStrikes++;
            this.campSeconds = 0;
            this.campCooldown = 6;
            if (this.campStrikes === 1) game._announce?.('⚠️ Орбитальное наведение! Смените позицию');
        }
        this.stormCooldown -= dt;
        if (game.gameTime > 34 && this.stormCooldown <= 0) {
            if(sheltered) {this.stormCooldown=12;} else {
            this.stormCooldown = Math.max(12, 20 - game.gameTime / 150);
            const n = game.gameTime > 150 ? 3 : 2;
            const angle = game.gameTime * 0.71;
            for (let i = 0; i < n; i++) {
                const a = angle + (i * Math.PI * 2) / n;
                const r = i === 0 ? 55 : 135;
                this.addZone(
                    p.x + Math.cos(a) * r, p.y + Math.sin(a) * r,
                    66 + (i % 2) * 12, 1.9 + i * .16,
                    (18 + Math.floor(game.gameTime / 90) * 5) * (game.enemyDmgMult || 1),
                    'meteor'
                );
            }
            game._announce?.('☄️ Метеоритный залп! Уклоняйтесь от зон поражения');
            }
        }
        for (let i = this.zones.length - 1; i >= 0; i--) {
            const z = this.zones[i];
            if (z.blast > 0) {
                z.blast -= dt;
                if (z.blast <= 0) this.zones.splice(i, 1);
                continue;
            }
            z.fuse -= dt;
            if (z.fuse > 0) continue;
            z.blast = .32;
            game.worldVfx?.meteorStrike(z.x, z.y, z.radius, z.kind === 'lock');
            const d = Math.hypot(p.x - z.x, p.y - z.y);
            if (d < z.radius + p.size * .38) {
                p.takeDamage(z.damage, game);
                game.createFloatingText?.('ОРБИТАЛЬНЫЙ УДАР', p.x, p.y - 52, '#ff748c');
            }
            // Meteor and orbital fire are neutral hazards: every ship caught
            // inside the blast is damaged, including enemy bosses. Destroyed
            // enemies still award their energy on the next combat update.
            let affected = 0;
            for (const enemy of game.enemies || []) {
                if (enemy.hp <= 0) continue;
                const dx = enemy.x - z.x, dy = enemy.y - z.y;
                const dist = Math.hypot(dx, dy);
                const reach = z.radius + enemy.size * .35;
                if (dist >= reach) continue;
                const falloff = Math.max(.42, 1 - .55 * (dist / reach));
                const damage = z.damage * (enemy.boss ? 1.0 : 1.65) * falloff;
                enemy.takeDamage(damage);
                enemy.slowTimer = Math.max(enemy.slowTimer || 0, .65);
                enemy.slowPct = Math.max(enemy.slowPct || 0, .38);
                const push = (enemy.boss ? 12 : 27) * (1 - dist / reach);
                if (dist > 1) {
                    enemy.x += dx / dist * push;
                    enemy.y += dy / dist * push;
                }
                affected++;
            }
            if (affected) {
                game.createFloatingText?.('МЕТЕОРИТ · поражено ' + affected,
                    z.x, z.y - z.radius - 18, '#ffc48e');
            }
            game.damageTerrain?.(z.x, z.y, z.radius, z.damage * 1.15, null, false);
            game.createParticles?.(z.x, z.y, z.kind === 'lock' ? '#ff5478' : '#ffae68', 25);
            game.shake?.(.35);
            game.audio?.explosion?.();
        }
    }
    render(ctx) {
        ctx.save();
        for (const z of this.zones) {
            const locked = z.kind === 'lock';
            const color = locked ? '#ff567f' : '#ffba69';
            ctx.save();
            ctx.translate(z.x, z.y);
            if (z.blast > 0) {
                const alpha = Math.max(0, z.blast / .32);
                ctx.globalAlpha = alpha * .8;
                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, z.radius);
                grad.addColorStop(0, locked ? '#ffedfd' : '#fff0c5');
                grad.addColorStop(.2, color);
                grad.addColorStop(1, 'rgba(255,35,35,0)');
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(0, 0, z.radius, 0, Math.PI * 2); ctx.fill();
            } else {
                const remaining = Math.max(0, z.fuse / z.total);
                if (!locked) {
                    // The last part of the warning now shows a real falling
                    // Kenney meteor with a burning wake, not an invisible hit.
                    const fall = Math.max(0, Math.min(1, (1-remaining-.25)/.75));
                    if (fall > 0) {
                        const px = 155*(1-fall), py = -210*(1-fall);
                        const size = 15 + fall*42;
                        ctx.save();
                        ctx.globalAlpha = .45 + fall*.55;
                        const tail = ctx.createLinearGradient(px+60,py-70,px,py);
                        tail.addColorStop(0,'rgba(255,129,50,0)');
                        tail.addColorStop(1,'rgba(255,199,95,.95)');
                        ctx.strokeStyle=tail;
                        ctx.lineWidth=4+fall*7;
                        ctx.lineCap='round';
                        ctx.beginPath();ctx.moveTo(px+55,py-65);ctx.lineTo(px,py);ctx.stroke();
                        ctx.shadowColor='#ff9c58';ctx.shadowBlur=18;
                        const meteor=atlas.meteor2||atlas.meteor1;
                        if (meteor) ctx.drawImage(meteor,px-size/2,py-size/2,size,size);
                        else {
                            ctx.fillStyle='#c9a28b';
                            ctx.beginPath();ctx.arc(px,py,size/2,0,Math.PI*2);ctx.fill();
                        }
                        ctx.restore();
                    }
                }
                ctx.fillStyle = locked ? 'rgba(255,45,95,.12)' : 'rgba(255,138,55,.12)';
                ctx.beginPath(); ctx.arc(0, 0, z.radius, 0, Math.PI * 2); ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = color; ctx.shadowBlur = 13; ctx.shadowColor = color;
                ctx.setLineDash([10, 7]);
                ctx.beginPath(); ctx.arc(0, 0, z.radius, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]); ctx.shadowBlur = 0;
                ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(0, 0, z.radius * .76, -Math.PI / 2,
                    -Math.PI / 2 + (1 - remaining) * Math.PI * 2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(15, 0);
                ctx.moveTo(0, -15); ctx.lineTo(0, 15); ctx.stroke();
                ctx.font = 'bold 12px system-ui';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#fff1e7';
                ctx.fillText(locked ? 'НАВЕДЕНИЕ' : 'МЕТЕОРИТ', 0, -z.radius - 10);
            }
            ctx.restore();
        }
        ctx.restore();
    }
}