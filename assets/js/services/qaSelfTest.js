import { APP_SCHEMA_VERSION } from '../config/dataModel.js';
import { DEFAULT_FEATURE_FLAGS } from '../config/featureFlags.js';
import { normalizeJournalEntry } from './validation.js';

function pass(label, detail) {
  return { status: 'pass', label, detail };
}

function warn(label, detail) {
  return { status: 'warn', label, detail };
}

function fail(label, detail) {
  return { status: 'fail', label, detail };
}

function canUseLocalStorage(storage) {
  try {
    const key = '__terpn_self_test__';
    storage.setItem(key, 'ok');
    const ok = storage.getItem(key) === 'ok';
    storage.removeItem(key);
    return ok;
  } catch {
    return false;
  }
}

export function runQaSelfTest({ flags = {}, data = {}, diagnostics = null, repositoryMode = 'Unknown', storage = globalThis.localStorage } = {}) {
  const checks = [];
  const checkedAt = new Date().toISOString();

  checks.push(canUseLocalStorage(storage)
    ? pass('Local storage available', 'Browser storage can save and read a test value.')
    : fail('Local storage unavailable', 'The app needs browser storage for local-first beta use.'));

  checks.push(flags.useBackendAdapter || flags.backendReadEnabled || flags.backendWriteEnabled || flags.authSessionEnabled
    ? warn('Backend flags are enabled', 'Use this only in a controlled backend pilot, not the default public beta.')
    : pass('Backend flags are safely off', 'Local-first mode is active by default.'));

  checks.push(flags.queueFailedBackendWrites === DEFAULT_FEATURE_FLAGS.queueFailedBackendWrites
    ? pass('Queue default matches release policy', `queueFailedBackendWrites is ${String(DEFAULT_FEATURE_FLAGS.queueFailedBackendWrites)} by default.`)
    : warn('Queue flag differs from default', 'Confirm this is intentional for the current QA environment.'));

  checks.push(APP_SCHEMA_VERSION
    ? pass('Schema version available', APP_SCHEMA_VERSION)
    : fail('Schema version missing', 'Exports and imports should be schema-versioned.'));

  const sample = normalizeJournalEntry({ title: 'Self test', terpenes: 'Linalool', notes: 'Validation smoke test.' });
  checks.push(sample?.id && sample?.title
    ? pass('Journal validation available', 'A sample journal entry normalized successfully.')
    : fail('Journal validation failed', 'Journal save/import behavior may be unsafe.'));

  const journalCount = Array.isArray(data.journal) ? data.journal.length : 0;
  const signupCount = Array.isArray(data.signups) ? data.signups.length : 0;
  const backupCount = Array.isArray(data.backups) ? data.backups.length : 0;
  checks.push(pass('Local data readable', `Journal entries: ${journalCount}; signup-interest rows: ${signupCount}.`));
  checks.push(backupCount
    ? pass('Local backups available', `${backupCount} backup${backupCount === 1 ? '' : 's'} found for recovery.`)
    : warn('No local backups yet', 'Create a backup before destructive QA steps such as import, repair, clear, or restore.'));

  if (diagnostics?.status) {
    const issueCount = Array.isArray(diagnostics.issues) ? diagnostics.issues.length : 0;
    checks.push(issueCount
      ? warn('Diagnostics have findings', `${issueCount} local data issue${issueCount === 1 ? '' : 's'} reported.`)
      : pass('Diagnostics clear', `Diagnostics status: ${diagnostics.status}.`));
  } else {
    checks.push(warn('Diagnostics not run', 'Run local diagnostics before sharing a beta link.'));
  }

  checks.push(repositoryMode.toLowerCase().includes('local')
    ? pass('Repository mode is local-first', repositoryMode)
    : warn('Repository mode is not local-only', `Current mode: ${repositoryMode}. Confirm backend rollout intent.`));

  const failed = checks.filter(item => item.status === 'fail').length;
  const warnings = checks.filter(item => item.status === 'warn').length;
  return {
    checkedAt,
    status: failed ? 'Fail' : warnings ? 'Review' : 'Pass',
    summary: `${checks.length - failed - warnings} passed, ${warnings} review, ${failed} failed`,
    checks
  };
}
