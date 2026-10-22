import { readFileSync, existsSync } from 'node:fs';

const requiredFiles = [
  'index.html',
  'assets/js/main.js',
  'assets/js/config/dataModel.js',
  'assets/js/adapters/backendAdapter.js',
  'assets/js/adapters/authSessionAdapter.js',
  'backend/schema.sql',
  'backend/openapi.yaml'
];

for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`Missing launch-readiness file: ${file}`);
}

const html = readFileSync('index.html', 'utf8');
const requiredIds = [
  'journalSubmitBtn',
  'cancelJournalEditBtn',
  'schemaVersionLabel',
  'authSessionForm',
  'authSessionStatus',
  'backendFlagsForm',
  'syncQueueStatus',
  'backupStatus',
  'createBackupBtn',
  'restoreBackupBtn'
];

for (const id of requiredIds) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing launch-readiness control: ${id}`);
}

const trustPhrases = ['not medical advice', 'No dosing instructions', 'No commerce', 'local browser storage', 'safety backups'];
const missingTrust = trustPhrases.filter(phrase => !html.toLowerCase().includes(phrase.toLowerCase()));
if (missingTrust.length) throw new Error(`Missing trust phrase(s): ${missingTrust.join(', ')}`);

console.log('Launch-readiness checks passed');
