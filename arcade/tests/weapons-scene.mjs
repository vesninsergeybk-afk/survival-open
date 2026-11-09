import {ArcadeGame} from './runtime-game.mjs';
import {World} from '../world.js';
import {SpatialGrid,STARTER_COMBAT} from '../balance.js';
import {createLoadout,createThermal,loadoutProfile,HangarSession} from '../ship-loadout.js';
const noop=()=>{};
export function game(slots=['plasma',null,null,null,null,null]){
 const g=Object.create(ArcadeGame.prototype),world=new World(20261102),base=world.home;
 base.active=true;base.enemy=false;base.discovered=true;world.discovered.add(base.id);
 Object.assign(g,{seed:world.seed,world,docked:base,activeBases:1,time:10,dead:false,paused:false,
  player:{x:0,y:0,vx:0,vy:0,r:19,angle:0,hp:STARTER_COMBAT.hull,maxHp:STARTER_COMBAT.hull,shield:0,ore:400,data:0,xp:0,level:14,points:20},
  skillRanks:{beam:0,double:0,range:0,rocket:1,hull:0,engine:0,shield:0,dodge:0,magnet:0,mining:0,extractor:0,radar:0,tactics:0},
  shipLoadout:{...createLoadout(),frame:4,slots:[...slots],owned:{plasma:5,rail:5,flak:5,rocket:5,howitzer:1}},
  weaponThermal:createThermal(),moduleClocks:{rail:0,flak:0},beamClock:0,rocketClock:0,
  heavyCharge:null,heavyCooldown:0,fieldLoan:null,fieldTrialTaken:false,fieldEffects:[],fieldReturnAt:-Infinity,
  ionMasteryAwarded:false,operation:null,contract:null,holdFire:false,mining:{active:false},probeRepairing:false,
  network:{armor:0,armament:0,engine:0,strikePower:0},support:{charges:0,cooldown:0,missions:[]},
  grid:new SpatialGrid(110),rockGrid:new SpatialGrid(140),enemies:[],allies:[],shots:[],missiles:[],drops:[],zones:[],hacks:[],flashes:[],
  nearArsenalBonus:false,overchargeUntil:0,doctrine:null,enemySerial:0,groupSerial:0,
  overlay:{hidden:true,dataset:{mode:'base'},querySelector:()=>null},keys:new Set(),touch:{x:0,y:0},
  heritage:{play:noop,ui:noop,station:noop,pause:noop,vfx:new Proxy({},{get:()=>noop})},cockpit:{resourceGain:noop},
  notice(text){this.lastNotice=text;},hud:noop,renderDock:noop,revealLoadoutApply:noop,
  enemyBasesUnlocked:()=>false,hangarSession:new HangarSession()});
 g.hangarSession.begin(g.shipLoadout);g.weaponProfile=loadoutProfile(g.shipLoadout);return g;
}
