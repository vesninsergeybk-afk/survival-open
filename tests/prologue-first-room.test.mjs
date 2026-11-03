import assert from 'node:assert/strict';

class MockImage {
  complete = true;
  set src(value) { this.url = value; this.naturalWidth = value.includes('materials') ? 900 : 1152; }
}
globalThis.Image = MockImage;
const sprites = await import('../src/prologue-machine-sprites.js');

for (const [fn, duration] of [[sprites.reactorFrame, 5], [sprites.distributorFrame, 5]]) {
  assert.equal(fn(false, 99), 0);
  const frames = new Set();
  for (let t = 0; t < duration; t += 1 / 60) frames.add(fn(true, t));
  assert.deepEqual([...frames].sort((a, b) => a - b), [...Array(12).keys()]);
}

let previous = 0;
const gateFrames = new Set();
for (let t = 0; t <= 3; t += 1 / 120) {
  const openness = sprites.gateOpenProgress(t);
  assert.ok(openness >= previous && openness <= 1);
  gateFrames.add(sprites.gateFrame(openness));
  previous = openness;
}
assert.deepEqual([...gateFrames].sort((a, b) => a - b), [...Array(12).keys()]);
assert.equal(sprites.gateOpenProgress(1.1), sprites.gateOpenProgress(1.3), 'brief jam');
assert.equal(sprites.gateOpenProgress(2.9), 1, 'gate fully clears collision');

const calls = [];
const ctx = {
  save() {}, restore() {}, beginPath() {}, ellipse() {}, fill() {},
  drawImage(...args) { calls.push(args); }
};
assert.equal(sprites.drawFirstRoomProp(ctx, 'gate', 11, 100, 100, 316, 4), true);
assert.deepEqual(calls.at(-1).slice(1, 5), [864, 576, 288, 288]);
assert.equal(sprites.drawFirstRoomProp(ctx, 'reactor', 0, 100, 100, 194), true);
assert.deepEqual(calls.at(-1).slice(1, 5), [0, 0, 288, 288]);
assert.equal(sprites.drawFirstRoomMaterials(ctx, 0, 0), true);
assert.equal(calls.length, 8, 'two sprites and six deck panels');

console.log('PASS: first-room 12-frame atlas animation, damaged gate and material cells');
