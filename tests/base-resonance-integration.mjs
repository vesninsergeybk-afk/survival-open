import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const resonanceSource=readFileSync(
    new URL('../src/base-resonance.js',import.meta.url),'utf8');
const resonance=await import('data:text/javascript,'+encodeURIComponent(resonanceSource));
const source=readFileSync(new URL('../src/friendly-bases.js',import.meta.url),'utf8')
    .replace(/^import .*?;\n/gm,'')
    .replace('export class FriendlyBases','class FriendlyBases');
const nop=()=>{};
const parts={arc:17,missile:15,rail:16,dock:1,carrier:6,lab:3,
    arsenal:4,outpost:0,bridge:8,basic:12,turretIdle:18,
    turretFireStart:19};
const makeClass=new Function(
    'CONFIG','BASE_PATHS','baseDevelopmentCap','baseDevelopmentPrice',
    'Enemy','Projectile','ENEMIES','drawStationPart','STATION_PARTS',
    'drawCombatImpact','turnTurretTowards','turretMuzzle','drawTurretMount',
    'drawTurretHead','resonanceQuote','buildResonanceLinks',
    'drawStationMechanisms',source+'\nreturn FriendlyBases');
const FriendlyBases=makeClass({ARENA_WIDTH:20000,ARENA_HEIGHT:20000},
    [],()=>0,()=>26,class {},class {},{},nop,parts,nop,nop,nop,nop,nop,
    resonance.resonanceQuote,resonance.resonanceLinks,nop);
const base=(id,x)=>({id,type:'outpost',x,y:0,hp:180,maxHp:180,
    activated:true,turrets:[],sockets:1,hangarTier:0,hangarCapacity:1,
    defense:{level:0,mode:null},escortUpgrades:{hull:0,engine:0,gun:0},
    development:{defense:0,research:0,logistics:0}});
const net=new FriendlyBases();net.enabled=true;net.credits=1000;
const a=base('a',0),b=base('b',2000);net.bases=[a,b];
const game={player:{x:0,y:0,maxHp:100,hp:100},
    worldVfx:{nova:nop,boostDrop:nop,boostCollect:nop},_announce:nop};
const at=(station,item,mount=0,path='')=>{
    game.player.x=station.x;
    const result=net.buy(game,station,item,mount,path);
    assert.equal(result.ok,true,result.message);
    return result.cost;
};
assert.equal(at(a,'turret',2),35);
assert.equal(at(b,'turret',4),4);
assert.equal(at(a,'extension'),40);
assert.equal(at(b,'extension'),16);
assert.equal(at(a,'turret',5),35);
assert.equal(at(b,'turret',7),9);
assert.equal(at(a,'upgradeTurret',2),52);
assert.equal(at(b,'upgradeTurret',4),19);
const before=net.credits;
net.reset({player:{x:100,y:100},activeMission:{rankCap:5},
    stageId:'forest',worldObstacles:[]},false);
assert.equal(net.resonanceBlueprints.size,0);
assert.equal(net.credits,0);
assert.ok(before>0);
console.log('Resonance integration: purchases and run reset passed');
