import { APP_SCHEMA_VERSION } from '../config/dataModel.js';

const BACKUP_RESOURCE = 'backups';
const MAX_BACKUPS = 8;

function timestamp() {
  return new Date().toISOString();
}

function makeBackupId() {
  return `backup-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function cloneData(data = {}) {
  return JSON.parse(JSON.stringify({
    profile: data.profile ?? null,
    journal: Array.isArray(data.journal) ? data.journal : [],
    signups: Array.isArray(data.signups) ? data.signups : [],
    account: data.account ?? null
  }));
}

function normalizeBackup(input = {}) {
  if (!input || typeof input !== 'object') return null;
  const data = input.data && typeof input.data === 'object' ? cloneData(input.data) : null;
  if (!data) return null;
  return {
    id: String(input.id || makeBackupId()),
    schemaVersion: String(input.schemaVersion || APP_SCHEMA_VERSION),
    createdAt: String(input.createdAt || timestamp()),
    reason: String(input.reason || 'manual').slice(0, 80),
    metadata: {
      journalCount: data.journal.length,
      signupCount: data.signups.length,
      hasProfile: Boolean(data.profile),
      hasAccount: Boolean(data.account)
    },
    data
  };
}

function normalizeBackups(value = []) {
  return (Array.isArray(value) ? value : [])
    .map(normalizeBackup)
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function listLocalBackups(adapter) {
  if (!adapter) return [];
  return normalizeBackups(await adapter.get(BACKUP_RESOURCE, []));
}

export async function createLocalBackup(adapter, data = {}, reason = 'manual') {
  if (!adapter) throw new Error('Local backup adapter is unavailable.');
  const backup = normalizeBackup({
    id: makeBackupId(),
    schemaVersion: APP_SCHEMA_VERSION,
    createdAt: timestamp(),
    reason,
    data: cloneData(data)
  });
  const existing = await listLocalBackups(adapter);
  const next = [backup, ...existing.filter(item => item.id !== backup.id)].slice(0, MAX_BACKUPS);
  await adapter.set(BACKUP_RESOURCE, next);
  return { backup, backups: next };
}

export async function restoreLatestBackup(adapter) {
  const backups = await listLocalBackups(adapter);
  const latest = backups[0] || null;
  if (!latest) throw new Error('No local backups are available to restore.');
  return latest;
}

export async function clearLocalBackups(adapter) {
  if (!adapter) return [];
  await adapter.remove(BACKUP_RESOURCE);
  return [];
}

export function summarizeLocalBackups(backups = []) {
  const list = normalizeBackups(backups);
  return {
    total: list.length,
    latest: list[0]?.createdAt || 'None',
    latestReason: list[0]?.reason || 'None',
    maxBackups: MAX_BACKUPS
  };
}
