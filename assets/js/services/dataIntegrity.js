import { normalizeAccount, normalizeAppExport, normalizeJournalEntries, normalizeProfile, normalizeSignups, mergeById } from './validation.js';
import { APP_SCHEMA_VERSION } from '../config/dataModel.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function countDuplicates(items = []) {
  const seen = new Set();
  const duplicates = new Set();
  asArray(items).forEach(item => {
    const id = String(item?.id || '').trim();
    if (!id) return;
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  });
  return duplicates.size;
}

function estimateBytes(value) {
  try {
    return new Blob([JSON.stringify(value ?? null)]).size;
  } catch {
    return JSON.stringify(value ?? null).length;
  }
}

function issue(severity, label, detail) {
  return { severity, label, detail };
}

export function repairAppData(input = {}) {
  const normalized = normalizeAppExport(input);
  return {
    profile: normalizeProfile(normalized.profile),
    journal: mergeById([], normalizeJournalEntries(normalized.journal)),
    signups: mergeById([], normalizeSignups(normalized.signups)),
    account: normalizeAccount(normalized.account)
  };
}

export function analyzeAppData(input = {}) {
  const source = input?.data && typeof input.data === 'object' ? input.data : input;
  const rawJournal = asArray(source.journal);
  const rawSignups = asArray(source.signups);
  const rawSync = asArray(source.pendingSync || source.syncQueue);
  const repaired = repairAppData(source);
  const issues = [];

  const invalidJournalCount = rawJournal.length - repaired.journal.length;
  const invalidSignupCount = rawSignups.length - repaired.signups.length;
  const duplicateJournalIds = countDuplicates(rawJournal);
  const duplicateSignupIds = countDuplicates(rawSignups);

  if (invalidJournalCount > 0) issues.push(issue('error', 'Invalid journal rows', `${invalidJournalCount} journal row${invalidJournalCount === 1 ? '' : 's'} would be rejected by normalization.`));
  if (invalidSignupCount > 0) issues.push(issue('error', 'Invalid signup rows', `${invalidSignupCount} signup row${invalidSignupCount === 1 ? '' : 's'} would be rejected by normalization.`));
  if (duplicateJournalIds > 0) issues.push(issue('warning', 'Duplicate journal IDs', `${duplicateJournalIds} duplicate journal ID${duplicateJournalIds === 1 ? '' : 's'} found; repair keeps the latest matching row.`));
  if (duplicateSignupIds > 0) issues.push(issue('warning', 'Duplicate signup IDs', `${duplicateSignupIds} duplicate signup ID${duplicateSignupIds === 1 ? '' : 's'} found; repair keeps the latest matching row.`));
  if (source.profile && !repaired.profile) issues.push(issue('warning', 'Profile needs repair', 'Saved profile data is incomplete or malformed.'));
  if (source.account && !repaired.account) issues.push(issue('warning', 'Account needs repair', 'Saved account data is incomplete or has an invalid email.'));
  if (rawSync.length > 25) issues.push(issue('info', 'Large sync queue', `${rawSync.length} pending writes are queued; retry or clear stale items before backend migration.`));

  const dataBytes = estimateBytes({ profile: source.profile, journal: source.journal, signups: source.signups, account: source.account });
  if (dataBytes > 2_000_000) issues.push(issue('warning', 'Large local dataset', 'Local data is over 2 MB. Export a backup and move to backend storage before heavy use.'));

  const hasRepairableChanges = JSON.stringify(repaired) !== JSON.stringify({
    profile: source.profile ?? null,
    journal: rawJournal,
    signups: rawSignups,
    account: source.account ?? null
  });

  return {
    schemaVersion: APP_SCHEMA_VERSION,
    status: issues.some(item => item.severity === 'error') ? 'needs-attention' : issues.length ? 'review' : 'healthy',
    checkedAt: new Date().toISOString(),
    counts: {
      profile: repaired.profile ? 1 : 0,
      journal: repaired.journal.length,
      signups: repaired.signups.length,
      account: repaired.account ? 1 : 0,
      pendingSync: rawSync.length
    },
    dataBytes,
    issues,
    hasRepairableChanges,
    repaired
  };
}

export function summarizeIntegrityReport(report = {}) {
  const issueCount = Array.isArray(report.issues) ? report.issues.length : 0;
  if (report.status === 'healthy') return 'Healthy';
  if (report.status === 'needs-attention') return `${issueCount} issue${issueCount === 1 ? '' : 's'} need attention`;
  return `${issueCount} item${issueCount === 1 ? '' : 's'} to review`;
}
