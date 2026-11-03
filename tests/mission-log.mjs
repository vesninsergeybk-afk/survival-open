import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/mission-log.js',import.meta.url),'utf8')
    .replace(/^import .*?;\n/gm,'').replace('export class MissionLog','class MissionLog');
const elements={};
for(const id of ['missionLogOverlay','btnMissionJournal','missionLogHeading',
    'missionLogIntroduction','missionLogEntries','missionLogOk']){
    elements[id]={style:{display:'none'},textContent:'',innerHTML:'',
        addEventListener(){},focus(){}};
}
globalThis.document={getElementById:id=>elements[id]};
globalThis.window={addEventListener(){}};
globalThis.cancelAnimationFrame=()=>{};
const MissionLog=new Function('GameState',src+'\nreturn MissionLog')({
    PLAYING:'playing',PAUSED:'paused'
});
const game={state:'playing',gameTime:38,raf:0,
    audio:{startMusic(){},stopMusic(){}},_scheduleFrame(){this.frames=(this.frames||0)+1;}};
const log=new MissionLog(game);log.reset({index:4});
assert.equal(elements.btnMissionJournal.style.display,'inline-flex');
log.note('Авария','Дроны <обломки>','Оборонять транспорт',true);
assert.equal(game.state,'paused');
assert.equal(log.isOpen(),true);
assert.match(elements.missionLogEntries.innerHTML,/Дроны &lt;обломки&gt;/);
log.close();
assert.equal(game.state,'playing');
assert.equal(game.frames,1);
log.hide();
assert.equal(elements.btnMissionJournal.style.display,'none');
console.log('Campaign journal: pause, acknowledged objective, HTML escaping, resume passed');
