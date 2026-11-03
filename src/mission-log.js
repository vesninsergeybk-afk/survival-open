/**
 * Campaign journal and acknowledged objective changes.
 * Active only for authored missions; the underlying simulation is paused
 * while a briefing is open. All entries belong to the current sortie.
 */
import {GameState} from './config.js?v=base-87';
const escapeHtml=value=>String(value).replace(/[&<>"]/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'
}[ch]));

export class MissionLog {
    constructor(game){
        this.game=game;this.entries=[];this.visible=false;this.world=null;
        this.overlay=document.getElementById('missionLogOverlay');
        this.button=document.getElementById('btnMissionJournal');
        this.header=document.getElementById('missionLogHeading');
        this.intro=document.getElementById('missionLogIntroduction');
        this.list=document.getElementById('missionLogEntries');
        this.ok=document.getElementById('missionLogOk');
        this.button?.addEventListener('click',()=>this.toggle());
        this.ok?.addEventListener('click',()=>this.close());
        window.addEventListener('keydown',event=>{
            if(event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
            if(this.visible && (event.key==='Escape'||event.key==='Enter')){
                event.preventDefault();event.stopImmediatePropagation();
                this.close();return;
            }
            if(event.code==='KeyJ' && this.world &&
                (this.visible||game.state===GameState.PLAYING)){
                event.preventDefault();event.stopImmediatePropagation();
                this.toggle();
            }
        },true);
    }
    reset(world){
        this.world=world;this.entries=[];this.visible=false;
        if(this.overlay)this.overlay.style.display='none';
        if(this.button)this.button.style.display='inline-flex';
    }
    hide(){
        // A new non-campaign run must never inherit an open briefing.
        this.visible=false;this.world=null;this.entries=[];
        if(this.overlay)this.overlay.style.display='none';
        if(this.button)this.button.style.display='none';
    }
    note(title,description,objective,show=false){
        if(!this.world)return;
        this.entries.unshift({title,description,objective,
            at:Math.max(0,Math.floor(this.game.gameTime||0))});
        this.entries=this.entries.slice(0,24);
        if(show)this.open(title,description);
    }
    isOpen(){return this.visible;}
    toggle(){
        if(this.visible)this.close();
        else if(this.world && this.game.state===GameState.PLAYING)this.open();
    }
    open(title='',description=''){
        if(!this.overlay||this.game.state!==GameState.PLAYING||
            !this.world)return;
        this.visible=true;
        if(this.header)this.header.textContent=title||'ЖУРНАЛ ОПЕРАЦИИ';
        if(this.intro){
            this.intro.textContent=description||'Текущие цели и история событий этого вылета.';
            this.intro.style.display='block';
        }
        if(this.list)this.list.innerHTML=this.entries.map(entry=>
            '<li><div class="mission-log-entry-head"><strong>'+
                escapeHtml(entry.title)+'</strong><time>'+
                Math.floor(entry.at/60)+':'+String(entry.at%60).padStart(2,'0')+
                '</time></div><p>'+escapeHtml(entry.description)+
                '</p><small>ЦЕЛЬ: '+escapeHtml(entry.objective)+'</small></li>'
        ).join('');
        this.overlay.style.display='flex';
        this.game.state=GameState.PAUSED;
        this.game._pauseStartedAt=performance.now();
        this.game.audio?.stopMusic?.();
        cancelAnimationFrame(this.game.raf);
        this.ok?.focus();
    }
    close(){
        if(!this.visible)return;
        this.visible=false;
        if(this.overlay)this.overlay.style.display='none';
        if(this.game.state!==GameState.PAUSED)return;
        this.game.state=GameState.PLAYING;
        const paused=performance.now()-(this.game._pauseStartedAt||performance.now());
        if(paused>0&&Number.isFinite(paused)){
            if(this.game.speedrunStart)this.game.speedrunStart+=paused;
            if(this.game._runStartWallClock)this.game._runStartWallClock+=paused;
        }
        this.game._pauseStartedAt=0;
        this.game.lastTime=performance.now();
        this.game.audio?.startMusic?.();
        this.game._scheduleFrame?.();
    }
}
