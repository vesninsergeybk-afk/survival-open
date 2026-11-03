// Verify the exact folder uploaded to GitHub Pages, not just the source checkout.
// This catches missing cross-folder ES modules such as ../src/audio.js.
import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, relative, resolve, sep} from 'node:path';

const site = resolve(process.argv[2] || '_site');
const problems = [];
const seen = new Set();
const mandatory = [
  'index.html',
  'arcade/index.html',
  'arcade/game.js',
  'arcade/style.css',
  'src/audio.js',
  'src/world-vfx.js',
  'audio-lab/audio-mixer.js',
  'audio-lab/sound-map.js',
  'assets/audio/music/CREDITS.md'
];

function visit(ref, from = site, isModule = false) {
  const value = ref.trim();
  if (!value || value.startsWith('#') || /^(?:https?:|\/\/|data:|blob:|mailto:|tel:|javascript:)/i.test(value)) return;
  const pathname = value.split(/[?#]/, 1)[0];
  if (!pathname) return;
  // In browser modules, a bare import cannot be resolved without an import map.
  if (isModule && !pathname.startsWith('.') && !pathname.startsWith('/')) {
    problems.push('Unsupported bare module import in ' + relative(site, from) + ': ' + value);
    return;
  }
  if (!pathname.startsWith('.') && !pathname.startsWith('/')) return;
  const target = pathname.startsWith('/')
    ? resolve(site, '.' + pathname)
    : resolve(dirname(from), pathname);
  if (target !== site && !target.startsWith(site + sep)) {
    problems.push('Reference escapes deployed site: ' + relative(site, from) + ' -> ' + value);
    return;
  }
  scan(target, from);
}

function scan(path, from = site) {
  if (!existsSync(path)) {
    problems.push('Missing from Pages artifact: ' + relative(site, path) + ' (referenced by ' + relative(site, from) + ')');
    return;
  }
  if (statSync(path).isDirectory()) {
    const index = resolve(path, 'index.html');
    if (existsSync(index)) scan(index, from);
    return;
  }
  if (seen.has(path)) return;
  seen.add(path);
  const kind = extname(path).toLowerCase();
  if (!['.html', '.js', '.mjs', '.css'].includes(kind)) return;
  const source = readFileSync(path, 'utf8');

  if (kind === '.js' || kind === '.mjs') {
    // Ordinary import/export, side-effect imports, and dynamic literal imports.
    const statics = /\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?(["'])([^"'\n]+)\1/g;
    for (const match of source.matchAll(statics)) visit(match[2], path, true);
    const dynamics = /\bimport\s*\(\s*(["'])([^"'\n]+)\1\s*\)/g;
    for (const match of source.matchAll(dynamics)) visit(match[2], path, true);
    // Literal import.meta asset URLs are also part of the deployed contract.
    const urls = /\bnew\s+URL\s*\(\s*(["'])([^"'\n]+)\1\s*,\s*import\.meta\.url/g;
    for (const match of source.matchAll(urls)) visit(match[2], path);
  } else if (kind === '.html') {
    const tags = /<(?:script|link|img|source)\b[^>]*>/gi;
    for (const [tag] of source.matchAll(tags)) {
      for (const match of tag.matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi)) visit(match[2], path);
    }
  } else if (kind === '.css') {
    const urls = /\burl\(\s*(["']?)([^)"']+)\1\s*\)/gi;
    for (const match of source.matchAll(urls)) visit(match[2], path);
    const imports = /@import\s+(?:url\(\s*)?(["'])([^"']+)\1/gi;
    for (const match of source.matchAll(imports)) visit(match[2], path);
  }
}

for (const entry of mandatory) scan(resolve(site, entry));
for (const entry of ['index.html', 'arcade/index.html', 'arcade/game.js']) scan(resolve(site, entry));

if (problems.length) {
  console.error('GitHub Pages dependency verification failed (' + problems.length + '):');
  for (const problem of problems) console.error(' - ' + problem);
  process.exitCode = 1;
} else {
  console.log('GitHub Pages artifact verified: ' + seen.size + ' referenced files scanned; all static local dependencies exist.');
}
