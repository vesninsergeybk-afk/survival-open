/**
 * Copy Kenney CC0 recordings into a game bundle, verifying the original Git
 * blob SHA-1 and byte count. All URLs are pinned to one inspected source commit.
 *
 * node tools/prepare-cc0-sfx.mjs _site
 * node tools/prepare-cc0-sfx.mjs .       # optional local development setup
 */
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname, join, resolve} from 'node:path';

const manifest = JSON.parse(await readFile(new URL('../audio-lab/assets/sfx/kenney/manifest.json', import.meta.url)));
const destination = resolve(process.argv[2] || '_site', 'audio-lab/assets/sfx/kenney');
const sourceRoot = 'https://raw.githubusercontent.com/' + manifest.sourceRepo + '/' + manifest.sourceCommit + '/';
if (!/^[0-9a-f]{40}$/.test(manifest.sourceCommit) || manifest.license !== 'CC0-1.0') {
  throw new Error('Unverified CC0 source configuration');
}
const gitSha = bytes => createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
await mkdir(destination, {recursive: true});
let cursor = 0, imported = 0, bytesTotal = 0;
const errors = [];
async function importOne(entry) {
  if (!/^[a-zA-Z0-9_-]+\.ogg$/.test(entry.file) ||
      !/^assets\/kenney\/(sci-fi-sounds|impact-sounds)\/Audio\/[a-zA-Z0-9_-]+\.ogg$/.test(entry.source)) {
    throw new Error('Unsafe recording path: ' + entry.file);
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(sourceRoot + entry.source, {signal: AbortSignal.timeout(25000)});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== entry.size || gitSha(bytes) !== entry.blobSha ||
          bytes.toString('ascii', 0, 4) !== 'OggS') {
        throw new Error('Source audio checksum or OGG signature mismatch: ' + entry.file);
      }
      await writeFile(join(destination, entry.file), bytes);
      imported++;
      bytesTotal += bytes.length;
      return;
    } catch (error) {
      if (attempt === 2 || /checksum|Unsafe/.test(error.message)) throw error;
    }
  }
}
const worker = async () => {
  while (cursor < manifest.files.length) {
    const entry = manifest.files[cursor++];
    try { await importOne(entry); }
    catch (error) { errors.push(entry.file + ': ' + error.message); }
  }
};
await Promise.all(Array.from({length: 5}, worker));
if (errors.length) throw new Error('CC0 audio import failed:\n' + errors.join('\n'));
console.log('Verified Kenney CC0 OGG recordings: ' + imported + ', bytes: ' + bytesTotal);
