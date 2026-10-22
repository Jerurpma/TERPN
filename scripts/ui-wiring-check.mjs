import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const html = readFileSync('index.html', 'utf8');
const ids = new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map(match => match[1]));
const jsFiles = walk('assets/js').filter(file => file.endsWith('.js'));
const missing = [];

for (const file of jsFiles) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/(?:qs|qsa)\(["']#([A-Za-z0-9_-]+)["']\)/g)) {
    if (!ids.has(match[1])) missing.push(`${file}: #${match[1]}`);
  }
}

if (missing.length) {
  throw new Error(`Missing DOM ids referenced by JS:\n${missing.join('\n')}`);
}

const requiredActionAttributes = [
  'data-entry-action="edit"',
  'data-entry-action="export"',
  'data-entry-action="duplicate"',
  'data-entry-action="delete"',
  'data-plan="Starter"',
  'data-plan="Explorer"',
  'data-plan="Studio"'
];
const combinedUiSource = [html, ...jsFiles.map(file => readFileSync(file, 'utf8'))].join('\n');
for (const needle of requiredActionAttributes) {
  if (!combinedUiSource.includes(needle)) throw new Error(`Missing UI action attribute: ${needle}`);
}

const eventHandlerIds = [
  'runSelfTestBtn',
  'exportSelfTestBtn',
  'runDiagnosticsBtn',
  'repairLocalDataBtn',
  'checkBackendBtn',
  'requestMagicLinkBtn',
  'flushSyncQueueBtn',
  'createBackupBtn',
  'restoreBackupBtn',
  'clearBackupsBtn',
  'exportBackupsBtn'
];
const main = readFileSync('assets/js/main.js', 'utf8');
for (const id of eventHandlerIds) {
  if (!main.includes(`#${id}`)) throw new Error(`Missing main.js handler reference for #${id}`);
  if (!ids.has(id)) throw new Error(`Missing HTML node for #${id}`);
}

console.log('UI wiring checks passed');
