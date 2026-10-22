import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

for (const file of walk('assets/js').filter(file => file.endsWith('.js'))) {
  execFileSync('node', ['--check', file], { stdio: 'inherit' });
}

await import('../assets/js/main.js');

const html = readFileSync('index.html', 'utf8');
const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map(match => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) throw new Error(`Duplicate HTML ids: ${[...new Set(duplicates)].join(', ')}`);

const allText = ['index.html', ...walk('assets'), ...walk('backend'), ...walk('scripts')]
  .filter(file => !file.includes('node_modules'))
  .map(file => `${file}\n${readFileSync(file, 'utf8')}`)
  .join('\n');
const blockedTerms = ['Event' + 'Flow', 'Sanctuary ' + 'Event' + 'Flow'];
const found = blockedTerms.filter(term => allText.includes(term));
if (found.length) throw new Error(`Blocked legacy term(s) found: ${found.join(', ')}`);

console.log('Structural checks passed');
