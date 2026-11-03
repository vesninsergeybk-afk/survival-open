import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const art=read('src/prologue-robot-art.js');
const world=read('src/prologue-mission.js');
const game=read('src/main.js');
for(const file of ['kenney-robots-top.png','kenney-robots-side.png']){
 const b=fs.readFileSync(path.join(root,'assets/prologue',file));
 assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.ok(b.length>12000&&b.length<150000);
 assert.ok(b.readUInt32BE(16)>=500&&b.readUInt32BE(20)>=500);
}
assert.ok(art.includes('export function drawPrologueRobot(ctx,e,time)'));
assert.ok(art.includes('export function drawPrologueRobotDeath(ctx,death)'));
assert.ok(art.includes("license:'CC0-1.0'"));
assert.ok(art.includes('new WeakMap()'));
assert.ok(world.includes('if(drawPrologueRobot(ctx,e,time)){this._drawRobotStatus(ctx,e);return;}'));
assert.ok(world.includes('drawPrologueRobotDeath(ctx,wreck)'));
assert.ok(world.includes('this.robotDeaths.length>48'));
assert.ok(world.includes('this._advanceIf(game,6,7430,5)'));
assert.ok(game.includes('this.missionWorld?.onEnemyDestroyed?.(e)'));
for(const file of ['src/prologue-robot-art.js','src/prologue-mission.js']){
 await import(new URL('../'+file,import.meta.url).href);
}
console.log('PASS mission 00: Kenney robot PNG, 2D animation, wreck effects, campaign contract');