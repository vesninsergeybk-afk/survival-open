import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Legacy, no longer loaded by the game. Container validity alone does not
// ensure that an encoded WebP kept its original alpha or all sprite cells.
// A WebP written by FFmpeg directly to stdout can contain RIFF size=0.
// Some image decoders tolerate it, but browsers reject the image and the
// game silently falls back to flat sprites. Check every bundled atlas.
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'space');
const names = readdirSync(dir).filter(name => name.endsWith('.webp'));
assert(names.length > 0, 'No bundled WebP art found');
for (const name of names) {
    const bytes = readFileSync(join(dir, name));
    assert(bytes.length >= 20, `${name}: file is too short`);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', `${name}: missing RIFF`);
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', `${name}: missing WEBP`);
    assert.equal(bytes.readUInt32LE(4), bytes.length - 8,
        `${name}: bad RIFF size; pipe-encoded WebP may fail in browsers`);
}
console.log(`Legacy WebP RIFF headers OK: ${names.length} graphics`);
