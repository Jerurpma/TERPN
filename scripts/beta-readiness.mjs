import { readFileSync, existsSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

if (packageJson.version !== '1.8.0-private-beta-handoff') throw new Error('Package version must be 1.8.0-private-beta-handoff.');

const betaControls = [
  'journalSubmitBtn',
  'cancelJournalEditBtn',
  'importJournalBtn',
  'exportAllBackendBtn',
  'importAllBtn',
  'backendFlagsForm',
  'checkBackendBtn',
  'authSessionForm',
  'requestMagicLinkBtn',
  'flushSyncQueueBtn',
  'runDiagnosticsBtn',
  'repairLocalDataBtn',
  'schemaVersionLabel',
  'betaVersionLabel',
  'runSelfTestBtn',
  'exportSelfTestBtn',
  'qaSelfTestStatus',
  'qaSelfTestIssues',
  'backupStatus',
  'backupDetail',
  'createBackupBtn',
  'restoreBackupBtn',
  'clearBackupsBtn',
  'exportBackupsBtn'
];

for (const id of betaControls) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing beta control: ${id}`);
}

const requiredCopy = [
  'not medical advice',
  'No dosing instructions',
  'No commerce',
  'local browser storage',
  'backend flags off by default',
  'safety backups'
];
const lower = html.toLowerCase();
for (const phrase of requiredCopy) {
  if (!lower.includes(phrase.toLowerCase())) throw new Error(`Missing beta trust/deployment copy: ${phrase}`);
}

if (!existsSync('deploy/BETA_QA_CHECKLIST.md')) throw new Error('Missing beta QA checklist.');
if (!existsSync('deploy/PRODUCTION_HANDOFF.md')) throw new Error('Missing production handoff notes.');

console.log('Beta-readiness checks passed');
