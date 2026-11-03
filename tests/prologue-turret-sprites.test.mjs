import assert from 'node:assert/strict';

class MockImage {
    complete = true;
    naturalWidth = 640;
    set src(value) { this.url = value; }
}
globalThis.Image = MockImage;
const sprites = await import('../src/prologue-turret-sprites.js');

assert.equal(sprites.turretYawIndex(Math.PI / 2), 0);
assert.equal(sprites.turretYawIndex(0), 4);
assert.equal(sprites.turretYawIndex(-Math.PI / 2), 8);
assert.equal(sprites.turretYawIndex(Math.PI), 12);
assert.equal(sprites.turretYawIndex(Math.PI / 2 + Math.PI * 2), 0);
assert.equal(sprites.turretDeploymentFrame(0), 0);
const duration=sprites.PROLOGUE_TURRET_DEPLOY_SECONDS;
assert.equal(sprites.turretDeploymentFrame(duration*.4), 3);
assert.equal(sprites.turretDeploymentFrame(duration*.999), 8);
assert.equal(sprites.turretDeploymentFrame(duration), -1);

const calls=[];
const ctx={
    save(){},restore(){},
    drawImage(...args){calls.push(args);},
    beginPath(){},arc(){},fill(){},fillRect(){},
    moveTo(){},lineTo(){},stroke(){},
    createRadialGradient(){return {addColorStop(){}};}
};
const turret={disabled:true,integrity:100,mount:2};
assert.equal(sprites.drawPrologueTurretSprite(ctx,turret,200,300,{powered:false}),true);
assert.deepEqual(calls.at(-1).slice(1,5),[0,0,160,160],'closed hatch uses first cell');
assert.equal(sprites.drawPrologueTurretSprite(ctx,turret,200,300,
    {powered:true,activatedAt:5,time:5+duration*.5}),true);
assert.deepEqual(calls.at(-1).slice(1,5),[640,0,160,160],'raising stage selects deployment atlas');
assert.equal(sprites.drawPrologueTurretSprite(ctx,turret,200,300,
    {powered:true,activatedAt:5,time:7,aim:0}),true);
assert.deepEqual(calls.at(-1).slice(1,5),[0,160,160,160],'side aiming selects 90-degree yaw frame');
turret.disabled=false;
turret.tracked={};
turret.cooldown=.1;
assert.equal(sprites.drawPrologueTurretSprite(ctx,turret,200,300,
    {powered:true,activatedAt:5,time:7.2,aim:0,flash:.14}),true,
    'pulse and muzzle glow render without changing the base sprite');

console.log('PASS: 16-way orientation, time-based deployment, closed/open atlas selection');

