import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync,existsSync} from 'node:fs';
import {paintMissionCell,paintMissionMorph,paintMissionImpact} from '../mission-objective-art.js';
import {createFieldOperation,drawFieldOperation} from '../field-operations.js';
import {World} from '../world.js';
import {ArcadeHeritage} from '../heritage.js';
import {SOUND_CATALOG} from '../../audio-lab/sound-map.js';

const missionRoot=new URL('../assets/missions/',import.meta.url);
const sheets={missionSpecial:'special-objectives-v1.webp',
 missionHardware:'reactor-hardware-v1.webp',
 missionFreighter:'hostile-freighter-v1.webp',
 missionImpacts:'mission-impacts-v1.webp'};
const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');

function fakeCanvas(){
 const drawn=[],stack=[];
 const c={globalAlpha:1,save(){stack.push(this.globalAlpha);},
  restore(){this.globalAlpha=stack.pop();},
  drawImage(...args){drawn.push({args,alpha:this.globalAlpha});}};
 return {c,drawn};
}

test('all four new painted sheets are small valid WebP assets used by production',()=>{
 for(const [key,file] of Object.entries(sheets)){
  const raw=readFileSync(new URL(file,missionRoot));
  assert.ok(raw.length>40_000&&raw.length<360_000,file);
  assert.equal(raw.toString('ascii',0,4),'RIFF');
  assert.equal(raw.toString('ascii',8,12),'WEBP');
  assert.ok(source.includes(`${key}:'./assets/missions/${file}'`),file);
 }
 assert.match(source,/drawCarrierCargo\(c,e\)[\s\S]*?paintMissionMorph\(c,this.images\?\.missionFreighter/);
 assert.match(source,/drawCorridorBeacon\(c,cam\)[\s\S]*?paintMissionCell\(c,this.images\?\.missionSpecial/);
 assert.match(source,/drawProbe\(c,cam\)[\s\S]*?paintMissionMorph\(c,this.images\?\.missionSpecial/);
 assert.match(source,/drawRelaySite\(c,cam,op,online=false\)[\s\S]*?paintMissionCell\(c,this.images\?\.missionHardware/);
});

test('different source quadrants render as independent sprite states',()=>{
 const image={complete:true,naturalWidth:1024,naturalHeight:1024};
 const {c,drawn}=fakeCanvas();
 for(let frame=0;frame<4;frame++)assert.equal(paintMissionCell(c,image,frame,0,0,70,70),true);
 assert.deepEqual(drawn.map(p=>p.args.slice(1,5)),[
  [0,0,512,512],[512,0,512,512],[0,512,512,512],[512,512,512,512]]);
 drawn.length=0;
 assert.equal(paintMissionMorph(c,image,2,3,5,10,50,50,.5),true);
 assert.deepEqual(drawn.map(p=>p.alpha),[.5,.5]);
 assert.equal(c.globalAlpha,1,'changing pose restores Canvas opacity');
 drawn.length=0;
 assert.equal(paintMissionMorph(c,image,2,3,5,10,50,50,1),true);
 assert.equal(drawn.length,1,'a complete transition has no wasted overdraw');
 assert.equal(drawn[0].args[1],512);
 assert.equal(drawn[0].args[2],512);
 assert.equal(paintMissionCell(c,null,0,0,0,70,70),false);
});

test('mission impacts are short, state-timed and retain four different signatures',()=>{
 const image={complete:true,naturalWidth:1024,naturalHeight:1024};
 const {c,drawn}=fakeCanvas();
 const game={time:10.3,images:{missionImpacts:image}};
 for(const kind of ['metal','shield','emp','repair'])
  assert.equal(paintMissionImpact(game,c,kind,2,3,10,100,.6),true);
 assert.deepEqual(drawn.map(p=>p.args.slice(1,3)),[[0,0],[512,0],[0,512],[512,512]]);
 assert.ok(drawn.every(p=>p.alpha>0&&p.alpha<1));
 assert.equal(paintMissionImpact(game,c,'metal',0,0,9,90,.4),false);
 assert.equal(paintMissionImpact(game,c,'unknown',0,0,10,90,.4),false);
 assert.equal(c.globalAlpha,1);
});

test('reactor cassettes use staged painted poses, then depart on extraction',()=>{
 const world=new World(20261107);
 const arsenal=world.nearbyStations(0,0,9000,false).find(x=>x.type==='arsenal');
 assert.ok(arsenal);arsenal.active=true;
 const op=createFieldOperation('sleeping-reactor',arsenal,world);
 const image={complete:true,naturalWidth:1024,naturalHeight:1024};
 const game={operation:op,player:{x:op.x,y:op.y},time:9,
  images:{missionHardware:image},visuals:{reducedMotion:true}};
 const {c,drawn}=fakeCanvas();
 for(const m of ['translate','rotate','beginPath','arc','stroke','fill','fillText',
  'setLineDash','fillRect','strokeRect'])c[m]=()=>{};
 const cam={x:op.x-1900,y:op.y-1900,w:4000,h:4000};
 op.nodes[0].progress=op.nodes[0].goal*.52;
 drawFieldOperation(game,c,cam);
 assert.ok(drawn.some(p=>p.args[0]===image&&p.args[1]===0));
 assert.ok(drawn.some(p=>p.args[0]===image&&p.args[1]===512));
 op.nodes[0].done=true;op.nodes[0].extractedAt=8.9;
 drawn.length=0;drawFieldOperation(game,c,cam);
 assert.ok(drawn.some(p=>p.args[0]===image&&p.args[1]===512),
  'removed cartridge visibly leaves the machine');
 game.time=11;drawn.length=0;drawFieldOperation(game,c,cam);
 assert.ok(!drawn.some(p=>p.args[0]===image&&p.args[1]===512),
  'extracted cartridge disappears after the exit animation');
});

test('all new mission sounds have recorded and provably licensed sources',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../../audio-lab/assets/sfx/kenney/manifest.json',import.meta.url),'utf8'));
 const keys=['mission_emp_charge','mission_emp_pulse','mission_probe_weld',
  'mission_probe_ready','mission_relay_wave','mission_relay_impact',
  'mission_relay_online','mission_carrier_contact','mission_carrier_boost',
  'field_scan_captured','field_reactor_charge'];
 const heritage=new ArcadeHeritage(),heard=[];
 heritage.soundOn=true;heritage.audio={playEvent:key=>heard.push(key)};
 heritage.vfx.clock=13;
 for(const key of keys){
  const cue=SOUND_CATALOG[key];assert.ok(cue?.sampleUrl,key);
  assert.ok(!('oscillator' in cue)&&!('frequency' in cue),key);
  const name=cue.sampleUrl.split('/').at(-1);
  if(cue.sampleUrl.includes('/kenney/')){
   assert.ok(manifest.files.some(f=>f.file===name&&f.size>0&&/^[a-f0-9]{40}$/.test(f.blobSha)),key);
  }else assert.ok(existsSync(new URL(cue.sampleUrl,new URL('../../audio-lab/',import.meta.url))),key);
 }
 for(const name of ['missionEmpCharge','missionEmpPulse','missionProbeWeld',
  'missionProbeReady','missionRelayWave','missionRelayImpact','missionRelayOnline',
  'missionCarrierContact','missionCarrierBoost','fieldScanCaptured']){
  assert.equal(heritage.play(name,.05),true,name);
 }
 assert.equal(heard.length,10);
});
