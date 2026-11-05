import {amberRegion} from './regions.js?v=regions-1';
import {STRATEGIC_STATIONS,createRegionalSupply} from './regional-supply.js?v=living-world-3-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-repair-qa-1-enemy-economy-1-enemy-balance-2';
import {CENTRAL_STATIONS} from './central-industry.js?v=living-world-1-home-conflict-1-enemy-balance-2';
import {FRONTIER_STATIONS} from './frontier-industry.js?v=living-world-3-radio-shadow-1-expedition-1-repair-qa-1';
import {RULES, hash, dist, baseNames} from './balance.js?v=arcade-network-20';
import {amberBeltDensity,nearAmberBelt,inAmberCorridor} from './terrain.js?v=arcade-belt-26';
import {createContours,fieldAt} from './territory-system.js?v=contours-1-world-feedback-1';
import {createEnemyExpansion} from './enemy-expansion.js?v=enemy-expansion-1-enemy-balance-2';
const BASE_CELL = 1250;
export const RELAY_RANGE = 1450;
export const RELAY_EXTENSION = 500;
const ROCK_CELL = RULES.rockCell;
const types = ['dock', 'arsenal', 'carrier', 'lab'];
const cellKey = (x, y) => x + ':' + y;
const nearbyCells = (x, y, r, cell, cb) => {
  const left = Math.floor((x-r)/cell), right = Math.floor((x+r)/cell);
  const top = Math.floor((y-r)/cell), bottom = Math.floor((y+r)/cell);
  for(let cy=top;cy<=bottom;cy++) for(let cx=left;cx<=right;cx++) cb(cx,cy);
};
export class World {
  constructor(seed=20261102) {
    this.seed = seed;
    this.stations = new Map();
    this.rocks = new Map();
    this.discovered = new Set();
    this.home = this.station(0, 0, true);
    this.ensureRegionalStations();
    this.regionalSupply=createRegionalSupply();
    this.contours=createContours();
    this.enemyExpansion=createEnemyExpansion();
  }
  ensureRegionalStations(){
    for(const spec of [...STRATEGIC_STATIONS,...CENTRAL_STATIONS,...FRONTIER_STATIONS]){
      const old=this.stations.get(spec.id);
      // Existing explored saves retain ownership, damage and installed equipment.
      if(old&&(old.strategicRole||old.discovered||old.active||old.captured||old.hp<old.maxHp||
        old.turrets?.some(t=>t.hp<t.maxHp))){
        old.strategicRole=spec.strategicRole;old.title=spec.title;continue;
      }
      const b={id:spec.id,x:spec.x,y:spec.y,type:spec.type,rank:spec.rank,
        strategicRole:spec.strategicRole,title:spec.title,enemy:true,active:false,
        activationIndex:0,discovered:false,usedUpgrade:false,captured:false,
        hp:spec.hp,maxHp:spec.hp,turrets:[],signalAt:0};
      for(let i=0;i<spec.turrets;i++){
        const a=i*Math.PI*2/spec.turrets;
        b.turrets.push({x:b.x+Math.cos(a)*92,y:b.y+Math.sin(a)*92,
          hp:spec.turretHp,maxHp:spec.turretHp,shot:1+i*.4});
      }
      this.stations.set(b.id,b);
    }
  }
  station(cx, cy, forced=false) {
    const key = cellKey(cx,cy);
    if (this.stations.has(key)) return this.stations.get(key);
    const roll = hash(cx,cy,this.seed+17);
    if (!forced && roll < .29) return null;
    const type = forced ? 'dock' : types[Math.floor(hash(cx+9,cy-7,this.seed)*types.length)];
    const x = forced ? 360 : cx*BASE_CELL + (hash(cx+34,cy,this.seed)-.5)*410;
    const y = forced ? -85 : cy*BASE_CELL + (hash(cx,cy+71,this.seed)-.5)*410;
    if(!forced && Math.hypot(x,y)<840) return null;
    const enemy = !forced && hash(cx-13,cy+31,this.seed)>.79;
    const rank=Math.max(1,Math.min(5,1+Math.floor(Math.hypot(cx,cy)/5)));
    const b={id:key,x,y,type,enemy,rank,active:false,activationIndex:0,discovered:false,usedUpgrade:false,
      hp:600+rank*160,maxHp:600+rank*160, turrets:[],captured:false, signalAt:0};
    if (enemy) {
      const count=2+Math.min(3,rank);
      for(let i=0;i<count;i++) {
        const a=i*Math.PI*2/count;
        b.turrets.push({x:x+Math.cos(a)*92,y:y+Math.sin(a)*92,
          hp:90+rank*28,maxHp:90+rank*28,shot:1+i*.3});
      }
    }
    this.stations.set(key,b);
    return b;
  }
  rockCell(cx,cy) {
    const key = cellKey(cx,cy);
    if(this.rocks.has(key)) return this.rocks.get(key);
    const list=[];
    const ordinary=2+Math.floor(hash(cx,cy,this.seed+5)*4);
    // Only the amber test field gets additional rocks; elsewhere the old
    // procedural world and its resource economy remain exactly the same.
    const field=nearAmberBelt((cx+.5)*ROCK_CELL,(cy+.5)*ROCK_CELL);
    const regional=amberRegion((cx+.5)*ROCK_CELL,(cy+.5)*ROCK_CELL);
    const count=ordinary+(field?5:regional?3:0);
    for(let i=0;i<count;i++){
      const x=(cx+hash(cx*17+i,cy,this.seed))*ROCK_CELL;
      const y=(cy+hash(cx,cy*13+i,this.seed+3))*ROCK_CELL;
      if(Math.hypot(x,y)<250||inAmberCorridor(x,y)||
        (amberRegion(x,y)&&Math.abs(y-x*.2)<175))continue;
      const density=amberBeltDensity(x,y);
      if(i>=ordinary&&density<.25&&!amberRegion(x,y))continue;
      const r=23+Math.floor(hash(cx+i*3,cy-i*5,this.seed+8)*24)+
        (density>=.25?10:0);
      if(this.nearbyStations(x,y,170).some(b=>dist(b,{x,y})<105+r))continue;
      const rich=hash(Math.floor(x),Math.floor(y),this.seed)>(amberRegion(x,y)?.65:.82);
      const durability=(30+r*.65)*(rich?1.35:1);
      list.push({x,y,r,originX:x,originY:y,vx:0,vy:0,spin:0,spinVelocity:0,
        flash:0,heat:0,rich,hp:durability,maxHp:durability,alive:true,id:key+'/'+i});
    }
    this.rocks.set(key,list);
    return list;
  }
  nearbyStations(x,y,r=2000,allowEnemy=true) {
    const found=[];
    nearbyCells(x,y,r,BASE_CELL,(cx,cy)=>{
      const b=this.station(cx,cy,cx===0&&cy===0);
      if(!b || (b.enemy&&!allowEnemy)) return;
      if(dist({x,y},b)<r) found.push(b);
    });
    for(const spec of [...CENTRAL_STATIONS,...FRONTIER_STATIONS]){
      const b=this.stations.get(spec.id);
      if(b&&(!b.enemy||allowEnemy)&&dist({x,y},b)<r)found.push(b);
    }
    return found;
  }
  nearbyRocks(x,y,r=1100) {
    const found=[];
    nearbyCells(x,y,r,ROCK_CELL,(cx,cy)=>{
      for(const rock of this.rockCell(cx,cy)){
        if(rock.alive && Math.abs(rock.x-x)<r+rock.r &&
          Math.abs(rock.y-y)<r+rock.r) found.push(rock);
      }
    });
    return found;
  }
  discover(x,y,r=570) {
    const discovered=[];
    for(const b of this.nearbyStations(x,y,r)) {
      if(!b.discovered){b.discovered=true;this.discovered.add(b.id);discovered.push(b);}
    }
    return discovered;
  }
  nearestUnactivated(x,y) {
    let best=null,nearest=Infinity;
    for(const b of this.nearbyStations(x,y,4500,false)){
      if(b.active)continue;
      const d=dist(b,{x,y});
      if(d<nearest){nearest=d;best=b;}
    }
    return best;
  }
  // The chart shows imprecise signatures, never exact positions of unseen stations.
  // This function does not reveal the station type or permanently discover it.
  signals(x,y,r=2200,allowEnemy=false){
    return this.nearbyStations(x,y,r,true).filter(b=>!b.discovered&&(allowEnemy||b.strategicRole||!b.enemy))
      .map(b=>({id:b.id,x:b.x+(hash(b.x|0,b.y|0,this.seed+233)-.5)*240,
        y:b.y+(hash(b.y|0,b.x|0,this.seed+239)-.5)*240,
        distance:Math.round(Math.hypot(b.x-x,b.y-y))}))
      .sort((a,b)=>a.distance-b.distance).slice(0,9);
  }
  networkTopology(previewBoost=null){
    // Only actual powered radio links count. A newly activated relay may
    // bridge an isolated station back into the home network.
    const nodes=[...this.stations.values()].filter(b=>b.active&&!b.enemy&&!b.suppressed);
    const linked=new Set(),links=[];
    if(!this.home.active||this.home.suppressed)return {count:0,linked,links};
    linked.add(this.home.id);
    const frontier=[this.home];
    while(frontier.length){
      const origin=frontier.shift();
      for(const b of nodes){
        if(linked.has(b.id))continue;
        const range=RELAY_RANGE+
          ((origin.relayBoost||origin.id===previewBoost)?RELAY_EXTENSION:0)+
          ((b.relayBoost||b.id===previewBoost)?RELAY_EXTENSION:0);
        if(dist(origin,b)>range)continue;
        linked.add(b.id);links.push([origin,b]);frontier.push(b);
      }
    }
    return {count:linked.size,linked,links};
  }
  sectorControl(x,y,r=1450){
    const stations=this.nearbyStations(x,y,r,true)
      .filter(b=>b.enemy||b.captured)
      .sort((a,b)=>dist(a,{x,y})-dist(b,{x,y}));
    const base=stations[0]||null;
    const field=fieldAt(this,x,y);
    if(field&&(!base?.enemy||dist(base,{x,y})>450))
      return {kind:'secured',base:base?.enemy?null:base,field};
    return {kind:base?(base.enemy?'hostile':'secured'):'neutral',base};
  }
  links(x,y,r=2200) {
    return this.networkTopology().links.filter(([a,b])=>
      Math.min(dist(a,{x,y}),dist(b,{x,y}))<r);
  }

}
