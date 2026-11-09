import test from 'node:test';
import assert from 'node:assert/strict';
import {updateRockMotion,impactRock} from '../mining.js';

test('untouched procedural asteroids sleep while visible zoom includes more rock cells',()=>{
 const inert=Object.freeze({alive:true,x:40,y:80,originX:40,originY:80,hp:100});
 for(let i=0;i<300;i++)updateRockMotion(inert,1/60);
 assert.deepEqual([inert.x,inert.y],[40,80]);
});

test('a sleeping rock wakes after impact and still has moving, decaying physics',()=>{
 const rock={alive:true,x:40,y:80,originX:40,originY:80,hp:100,maxHp:100,r:25,
  vx:0,vy:0,spin:0,spinVelocity:0};
 impactRock(rock,10,0,80);
 const firstX=rock.x;
 updateRockMotion(rock,1/60);
 assert.ok(rock.x>firstX,'the impact must still displace the rock');
 assert.ok(rock.flash>0&&rock.flash<.68,'impact feedback still decays');
 assert.ok(rock.vx>0,'movement is not put to sleep early');
});
