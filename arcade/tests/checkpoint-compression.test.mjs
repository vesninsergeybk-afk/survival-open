import test from 'node:test';
import assert from 'node:assert/strict';
import {compressCheckpoint,decompressCheckpoint} from '../checkpoint-compression.js';
import {packRun,unpackRun,MAX_CHECKPOINT_LENGTH} from '../run-checkpoint.js';

test('checkpoint compression preserves Russian Unicode, punctuation and references',()=>{
 const input={title:'Кладбище кораблей · ионная буря',emoji:'🚀💫',
  records:Array.from({length:2200},(_,i)=>({id:i,label:'Вражеская колония',
   x:i*11.31,pool:i%9,ore:i%5,relay:'Радиосвязь → подкрепление'}))};
 input.shared=input.records[100];
 const compressed=compressCheckpoint(JSON.stringify(input));
 assert.ok(compressed.startsWith('~LZW1~'));
 assert.ok(compressed.length<JSON.stringify(input).length/2);
 assert.deepEqual(JSON.parse(decompressCheckpoint(compressed)),input);
 const graph=packRun(input);
 assert.ok(graph.length<MAX_CHECKPOINT_LENGTH);
 const loaded=unpackRun(graph);
 assert.deepEqual(loaded,input);
 assert.strictEqual(loaded.shared,loaded.records[100]);
});

test('old unsqueezed graph data loads and corrupt compressed input fails closed',()=>{
 const small={name:'Старое сохранение',score:42};
 const plain=packRun(small);
 assert.ok(plain.startsWith('{'));
 assert.deepEqual(unpackRun(plain),small);
 assert.throws(()=>unpackRun('~LZW1~'+String.fromCharCode(450)));
 assert.throws(()=>unpackRun('~LZW1~'));
 assert.throws(()=>unpackRun('~LZW1~'+String.fromCharCode(65,65535)));
});
