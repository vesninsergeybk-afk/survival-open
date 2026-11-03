// Run: node site/games/survivor/tests/ship-missile-evasion.test.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
const entities=read('src/entities.js');
const segment=(name,next)=>entities.slice(
 entities.indexOf('export class '+name+' {'),
 entities.indexOf('export class '+next+' {')
).replace(/^export /gm,'');
const snippet=segment('Player','Enemy')+
 segment('Enemy','EnemyProjectile')+segment('EnemyProjectile','Projectile')+
 ';return {Player,Enemy,EnemyProjectile};';
const mockMath=Object.create(Math);let rng=0;mockMath.random=()=>rng;
const {Player,Enemy,EnemyProjectile}=new Function('CONFIG','Math','ENEMIES',snippet)(
 {PLAYER_SIZE:18,INVINCIBILITY_TIME:.4},mockMath,{});
const p=new Player(0,0);
const game={player:p,gameTime:10,friendlyBases:{interceptEnemyProjectile:()=>false},
 createParticles(){},createFloatingText(){},worldVfx:{playerHurt(){}},
 onPlayerHurt(){},run:{}};
function fired({moving=false,learned=false,time=10,rollReset=true}={}){
 p.hp=100;p.invincible=false;p.dead=false;p.vx=moving?220:0;p.vy=0;
 p.passives=learned?{dodge:{count:4,def:{effect:{dodgeChance:.05}}}}:{};
 if(rollReset)p.lastMissileEvasionAt=-100;
 game.gameTime=time;
 const ep=new EnemyProjectile(-10,0,0,230,25,'missile');
 ep.update(.01,game);
 assert.equal(ep.shouldRemove,true,'rocket collision resolves');
 return {hp:p.hp,evadeAt:p.missileEvasionAt};
}
rng=0;
assert.equal(fired({moving:false,learned:true}).hp,75,
 'an idle max-dodge ship MUST be hit by a guided missile');
assert.equal(fired({moving:true,learned:false}).hp,75,
 'piloting alone gives no random autopilot immunity');
assert.equal(fired({moving:true,learned:true,time:12}).hp,100,
 'unlocked evasion and active movement can dodge');
assert.equal(p.missileEvasionAt,12,'rendered barrel roll is an actual dodge event');
assert.equal(fired({moving:true,learned:true,time:12.1,rollReset:false}).hp,75,
 'evasion has a cooldown, rockets stay dangerous');
rng=1;
assert.equal(fired({moving:true,learned:true,time:15}).hp,75,
 'moving with skill does not guarantee dodging');
const shots={enemyProjectiles:[],enemyDmgMult:1,audio:{shoot(){}}};
Enemy.prototype._shoot.call({id:'gunship',
 type:{burstCount:5,spreadAngle:.2,projectileSpeed:270,projectileDamage:10},
 x:0,y:0},shots,0);
assert.equal(shots.enemyProjectiles.filter(p=>p.kind==='missile').length,1,
 'gunship salvo contains one guided missile and four plasma bolts');
assert.equal(shots.enemyProjectiles.length,5);
const hybrid=read('src/hybrid-3d.js');
assert.match(hybrid,/HULLS = \[19151,19151,19151,19151,19151,19151,19151\]/,
 'all upgrades retain one hull');
assert.ok(hybrid.includes('THREE.ConeGeometry'),'animated 3D thrusters');
assert.ok(hybrid.includes('missileEvasionAt'),'roll tied to gameplay dodge');
assert.ok(hybrid.includes('syncEnemyMissiles'),'guided rockets are real GLB meshes');
assert.ok(hybrid.includes('const localYaw=Math.atan2'),'ship guns track real enemy position');
assert.ok(hybrid.includes('kit.canDodge'),'evasion thrusters appear when skill is learned');
assert.ok(hybrid.includes('kit.armed'),'first weapon visibly adds a turret');
assert.ok(hybrid.includes('const hull=this.rigs.acquire(loaded.get(hullId),88,tint)'),
 'core hull scale is constant across tiers');
assert.ok(hybrid.includes('enemy.dashActive'),'enemy rolls follow real AI dash state');
const main=read('src/main.js');
assert.ok(main.includes('enemyProjectiles:this.enemyProjectiles'));
assert.ok(main.includes("workshop:this.missionWorld?.index===0"));
console.log('PASS: same 3D hull, modular thrusters, AI maneuvers and skill-gated nontrivial missile evasion');
